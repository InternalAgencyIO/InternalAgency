import { env } from "cloudflare:workers";
import { assertSolanaPublicKey, nodeChallenge } from "../../../../engagement/solana-wallet-proof.mjs";

const allowedOrigins = new Set(["https://internalagency.io", "https://ileriakil.com"]);

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function reserveChallengeWindow(subject: string, now: Date, cooldownMs: number) {
  const nextAllowedAt = new Date(now.valueOf() + cooldownMs).toISOString();
  const result = await env.DB.prepare("INSERT INTO node_challenge_rate_limits (subject_hash, next_allowed_at_utc, updated_at_utc) VALUES (?, ?, ?) ON CONFLICT(subject_hash) DO UPDATE SET next_allowed_at_utc = excluded.next_allowed_at_utc, updated_at_utc = excluded.updated_at_utc WHERE node_challenge_rate_limits.next_allowed_at_utc <= ?").bind(await sha256(subject), nextAllowedAt, now.toISOString(), now.toISOString()).run();
  return result.meta.changes === 1;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  if (!allowedOrigins.has(origin)) return json({ error: "UNTRUSTED_ORIGIN" }, 403);
  if (!env.DB) return json({ error: "CLAIM_SERVICE_NOT_CONFIGURED" }, 503);

  let wallet: string;
  try {
    ({ wallet } = await request.json() as { wallet: string });
    assertSolanaPublicKey(wallet);
  } catch {
    return json({ error: "INVALID_SOLANA_WALLET" }, 400);
  }

  const id = crypto.randomUUID();
  const nonce = randomNonce();
  const issued = new Date();
  const expires = new Date(issued.valueOf() + 5 * 60_000);
  const message = nodeChallenge({ wallet, nonce, issuedAtUtc: issued.toISOString(), expiresAtUtc: expires.toISOString(), origin });

  const clientIp = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
  const [ipAllowed, walletAllowed] = await Promise.all([
    reserveChallengeWindow(`ip:${clientIp}`, issued, 60_000),
    reserveChallengeWindow(`wallet:${wallet}`, issued, 30_000),
  ]);
  if (!ipAllowed || !walletAllowed) return json({ error: "CHALLENGE_RATE_LIMITED", retryAfterSeconds: 60 }, 429);

  await env.DB.batch([
    env.DB.prepare("DELETE FROM node_challenges WHERE expires_at_utc < ?").bind(issued.toISOString()),
    env.DB.prepare("INSERT INTO node_challenges (id, wallet_address, nonce_hash, origin, issued_at_utc, expires_at_utc) VALUES (?, ?, ?, ?, ?, ?)").bind(id, wallet, await sha256(nonce), origin, issued.toISOString(), expires.toISOString()),
  ]);

  return json({ challengeId: id, wallet, nonce, message, expiresAtUtc: expires.toISOString() });
}

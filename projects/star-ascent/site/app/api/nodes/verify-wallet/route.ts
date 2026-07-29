import { env } from "cloudflare:workers";
import { verifyNodeChallenge } from "../../../../engagement/solana-wallet-proof.mjs";

const allowedOrigins = new Set(["https://internalagency.io", "https://ileriakil.com"]);
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

type ChallengeRow = { id: string; wallet_address: string; nonce_hash: string; origin: string; issued_at_utc: string; expires_at_utc: string; consumed_at_utc: string | null };
type BindingRow = { id: string; state: string; genesis_slot: number | null };

export async function POST(request: Request) {
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  if (!allowedOrigins.has(origin)) return json({ error: "UNTRUSTED_ORIGIN" }, 403);
  if (!env.DB) return json({ error: "CLAIM_SERVICE_NOT_CONFIGURED" }, 503);

  let input: { challengeId?: string; wallet?: string; nonce?: string; signatureBase58?: string };
  try { input = await request.json(); } catch { return json({ error: "INVALID_REQUEST" }, 400); }
  if (!input.challengeId || !input.wallet || !input.nonce || !input.signatureBase58) return json({ error: "MISSING_WALLET_PROOF" }, 400);

  const challenge = await env.DB.prepare("SELECT id, wallet_address, nonce_hash, origin, issued_at_utc, expires_at_utc, consumed_at_utc FROM node_challenges WHERE id = ?").bind(input.challengeId).first<ChallengeRow>();
  if (!challenge || challenge.consumed_at_utc || challenge.wallet_address !== input.wallet || challenge.origin !== origin) return json({ error: "CHALLENGE_UNAVAILABLE" }, 409);
  if (await sha256(input.nonce) !== challenge.nonce_hash) return json({ error: "CHALLENGE_MISMATCH" }, 409);

  try {
    verifyNodeChallenge({ wallet: input.wallet, nonce: input.nonce, issuedAtUtc: challenge.issued_at_utc, expiresAtUtc: challenge.expires_at_utc, origin, signatureBase58: input.signatureBase58 });
  } catch {
    return json({ error: "INVALID_OR_EXPIRED_WALLET_PROOF" }, 400);
  }

  const now = new Date().toISOString();
  const bindingId = crypto.randomUUID();
  const consumed = await env.DB.prepare("UPDATE node_challenges SET consumed_at_utc = ? WHERE id = ? AND consumed_at_utc IS NULL AND expires_at_utc >= ?").bind(now, challenge.id, now).run();
  if (consumed.meta.changes !== 1) return json({ error: "CHALLENGE_UNAVAILABLE" }, 409);
  await env.DB.prepare("INSERT OR IGNORE INTO node_bindings (id, wallet_address, state, created_at_utc) VALUES (?, ?, 'pending', ?)").bind(bindingId, input.wallet, now).run();
  const binding = await env.DB.prepare("SELECT id, state, genesis_slot FROM node_bindings WHERE wallet_address = ?").bind(input.wallet).first<BindingRow>();

  return json({ nodeId: binding?.id, state: binding?.state ?? "pending", genesisSlot: binding?.genesis_slot ?? null, next: "X_OAUTH_REQUIRED", claimStatus: "HOLD" });
}

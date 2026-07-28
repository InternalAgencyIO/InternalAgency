import { env } from "cloudflare:workers";
import { assertSolanaPublicKey, nodeChallenge } from "../../../../../engagement/solana-wallet-proof.mjs";

const allowedOrigins = new Set(["https://internalagency.io", "https://ileriakil.com"]);
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const randomNonce = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
async function sha256(value: string) { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
export async function POST(request: Request) {
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  if (!allowedOrigins.has(origin)) return json({ error: "UNTRUSTED_ORIGIN" }, 403);
  if (!env.DB) return json({ error: "CLAIM_SERVICE_NOT_CONFIGURED" }, 503);
  let wallet: string;
  try { ({ wallet } = await request.json() as { wallet: string }); assertSolanaPublicKey(wallet); } catch { return json({ error: "INVALID_SOLANA_WALLET" }, 400); }
  const id = crypto.randomUUID(), nonce = randomNonce(), issued = new Date(), expires = new Date(issued.valueOf() + 5 * 60_000);
  const message = nodeChallenge({ wallet, nonce, issuedAtUtc: issued.toISOString(), expiresAtUtc: expires.toISOString(), origin });
  await env.DB.batch([env.DB.prepare("DELETE FROM node_challenges WHERE expires_at_utc < ?").bind(issued.toISOString()), env.DB.prepare("INSERT INTO node_challenges (id, wallet_address, nonce_hash, origin, issued_at_utc, expires_at_utc) VALUES (?, ?, ?, ?, ?, ?)").bind(id, wallet, await sha256(nonce), origin, issued.toISOString(), expires.toISOString())]);
  return json({ challengeId: id, wallet, nonce, message, expiresAtUtc: expires.toISOString() });
}

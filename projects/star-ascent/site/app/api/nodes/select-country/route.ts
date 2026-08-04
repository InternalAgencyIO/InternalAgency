import { env } from "cloudflare:workers";
import { hashNodeSessionNonce, readNodeSessionCookie, verifyNodeSession } from "../../../../engagement/node-session.mjs";

const allowedOrigins = new Set(["https://internalagency.io", "https://ileriakil.com"]);
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  if (!allowedOrigins.has(origin)) return json({ error: "UNTRUSTED_ORIGIN" }, 403);
  if (!env.DB) return json({ error: "CLAIM_SERVICE_NOT_CONFIGURED" }, 503);
  if (!env.NODE_SESSION_SECRET || env.NODE_SESSION_SECRET.length < 32) return json({ error: "NODE_SESSION_NOT_CONFIGURED" }, 503);
  let session: { nodeId: string; wallet: string; nonce: string };
  try {
    session = verifyNodeSession({ token: readNodeSessionCookie(request), secret: env.NODE_SESSION_SECRET });
  } catch {
    return json({ error: "NODE_SESSION_INVALID" }, 401);
  }
  let input: { countryCode?: string };
  try { input = await request.json(); } catch { return json({ error: "INVALID_REQUEST" }, 400); }
  const countryCode = input.countryCode?.trim().toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(countryCode)) return json({ error: "INVALID_COUNTRY_SELECTION" }, 400);
  const now = new Date().toISOString();
  const result = await env.DB.prepare("UPDATE node_bindings SET country_code = ? WHERE id = ? AND wallet_address = ? AND state = 'pending' AND country_code IS NULL AND session_nonce_hash = ? AND session_expires_at_utc >= ?")
    .bind(countryCode, session.nodeId, session.wallet, hashNodeSessionNonce(session.nonce), now)
    .run();
  if (result.meta.changes !== 1) return json({ error: "COUNTRY_SELECTION_LOCKED" }, 409);
  return json({ countryCode, next: "X_OAUTH_REQUIRED", claimStatus: "HOLD" });
}

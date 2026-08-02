import { env } from "cloudflare:workers";
import { hashNodeSessionNonce, readNodeSessionCookie, verifyNodeSession } from "../../../../engagement/node-session.mjs";
import { issueXOAuthState, pkceChallenge, pkceVerifier, verifyXOAuthState } from "../../../../engagement/x-oauth-state.mjs";

const callbackDefault = "https://internalagency.io/api/x/callback";
const allowedRedirectUris = new Set([callbackDefault]);

export async function GET(request: Request) {
  const clientId = env.X_CLIENT_ID;
  const secret = env.X_OAUTH_STATE_SECRET;
  const sessionSecret = env.NODE_SESSION_SECRET;
  const redirectUri = env.X_OAUTH_REDIRECT_URI ?? callbackDefault;
  if (!clientId || !secret || !sessionSecret) return Response.json({ error: "X_OAUTH_NOT_CONFIGURED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!allowedRedirectUris.has(redirectUri)) return Response.json({ error: "X_OAUTH_REDIRECT_NOT_ALLOWED" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!env.DB) return Response.json({ error: "CLAIM_SERVICE_NOT_CONFIGURED" }, { status: 503 });
  let session: { nodeId: string; wallet: string; nonce: string };
  try {
    session = verifyNodeSession({ token: readNodeSessionCookie(request), secret: sessionSecret });
  } catch {
    return Response.json({ error: "NODE_SESSION_INVALID" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const now = new Date().toISOString();
  const binding = await env.DB.prepare("SELECT id, state FROM node_bindings WHERE id = ? AND wallet_address = ? AND state = 'pending' AND country_code IS NOT NULL AND session_nonce_hash = ? AND session_expires_at_utc >= ?")
    .bind(session.nodeId, session.wallet, hashNodeSessionNonce(session.nonce), now)
    .first<{ id: string; state: string }>();
  if (!binding) return Response.json({ error: "NODE_NOT_ELIGIBLE_FOR_X_BINDING" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  const state = issueXOAuthState({ nodeId: session.nodeId, secret });
  const oauth = verifyXOAuthState({ state, secret });
  const stored = await env.DB.prepare("UPDATE node_bindings SET oauth_nonce_hash = ?, oauth_expires_at_utc = ? WHERE id = ? AND wallet_address = ? AND state = 'pending' AND session_nonce_hash = ?")
    .bind(hashNodeSessionNonce(oauth.nonce), new Date(oauth.exp).toISOString(), session.nodeId, session.wallet, hashNodeSessionNonce(session.nonce))
    .run();
  if (stored.meta.changes !== 1) return Response.json({ error: "OAUTH_STATE_STORAGE_FAILED" }, { status: 409, headers: { "Cache-Control": "no-store" } });
  const verifier = pkceVerifier({ state, secret });
  const authorize = new URL("https://x.com/i/oauth2/authorize");
  authorize.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: "users.read", state, code_challenge: pkceChallenge(verifier), code_challenge_method: "S256" }).toString();
  return Response.redirect(authorize, 302);
}

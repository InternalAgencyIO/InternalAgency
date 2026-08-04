import { env } from "cloudflare:workers";
import { GENESIS_REWARD_BASE_UNITS, GENESIS_SLOT_RESERVATION_SQL, NODE_ACTIVATION_SQL, isAllowedXSubscriptionType, normalizedEligibleXAccountCreatedAt, premiumRevalidationDeadline } from "../../../../engagement/node-binding-policy.mjs";
import { clearNodeSessionCookie, hashNodeSessionNonce, readNodeSessionCookie, verifyNodeSession } from "../../../../engagement/node-session.mjs";
import { pkceVerifier, verifyXOAuthState } from "../../../../engagement/x-oauth-state.mjs";

const callbackDefault = "https://internalagency.io/api/x/callback";
const allowedRedirectUris = new Set([callbackDefault]);
const fail = (code: string) => new Response(null, { status: 302, headers: { Location: new URL(`/rewards?binding=${encodeURIComponent(code)}`, "https://internalagency.io").toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });

export async function GET(request: Request) {
  const url = new URL(request.url), code = url.searchParams.get("code"), state = url.searchParams.get("state");
  const clientId = env.X_CLIENT_ID, secret = env.X_OAUTH_STATE_SECRET, sessionSecret = env.NODE_SESSION_SECRET, redirectUri = env.X_OAUTH_REDIRECT_URI ?? callbackDefault;
  if (!code || !state || !clientId || !secret || !sessionSecret || !env.DB || !allowedRedirectUris.has(redirectUri)) return fail("oauth-unavailable");
  let payload: { nodeId: string; nonce: string };
  let session: { nodeId: string; wallet: string; nonce: string };
  try { payload = verifyXOAuthState({ state, secret }); } catch { return fail("oauth-state-invalid"); }
  try { session = verifyNodeSession({ token: readNodeSessionCookie(request), secret: sessionSecret }); } catch { return fail("node-session-invalid"); }
  if (payload.nodeId !== session.nodeId) return fail("oauth-session-mismatch");
  const now = new Date();
  const nowUtc = now.toISOString();
  const eligible = await env.DB.prepare("SELECT id FROM node_bindings WHERE id = ? AND wallet_address = ? AND state = 'pending' AND country_code IS NOT NULL AND session_nonce_hash = ? AND session_expires_at_utc >= ? AND oauth_nonce_hash = ? AND oauth_expires_at_utc >= ?")
    .bind(session.nodeId, session.wallet, hashNodeSessionNonce(session.nonce), nowUtc, hashNodeSessionNonce(payload.nonce), nowUtc)
    .first<{ id: string }>();
  if (!eligible) return fail("oauth-session-replayed");
  const form = new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, code, redirect_uri: redirectUri, code_verifier: pkceVerifier({ state, secret }) });
  let tokenResponse: Response;
  try {
    tokenResponse = await fetch("https://api.x.com/2/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString(), signal: AbortSignal.timeout(5_000) });
  } catch { return fail("oauth-exchange-timeout"); }
  let token: { access_token?: string };
  try { token = await tokenResponse.json() as { access_token?: string }; } catch { return fail("oauth-exchange-failed"); }
  if (!tokenResponse.ok || !token.access_token) return fail("oauth-exchange-failed");
  let profileResponse: Response;
  try {
    profileResponse = await fetch("https://api.x.com/2/users/me?user.fields=created_at,subscription_type", { headers: { Authorization: `Bearer ${token.access_token}` }, signal: AbortSignal.timeout(5_000) });
  } catch { return fail("oauth-profile-timeout"); }
  let profile: { data?: { id?: string; created_at?: string; subscription_type?: string } };
  try { profile = await profileResponse.json() as { data?: { id?: string; created_at?: string; subscription_type?: string } }; } catch { return fail("oauth-profile-failed"); }
  const xUserId = profile.data?.id, subscriptionType = profile.data?.subscription_type;
  if (!profileResponse.ok || !xUserId) return fail("oauth-profile-failed");
  if (!isAllowedXSubscriptionType(subscriptionType)) return fail("x-premium-required");
  const xAccountCreatedAt = normalizedEligibleXAccountCreatedAt(profile.data?.created_at, now);
  if (!xAccountCreatedAt) return fail("x-account-too-new");
  const premiumRevalidateAt = premiumRevalidationDeadline(now);
  try {
    // D1 rolls a batch back only when a statement fails. Activate first so a
    // zero-row activation can never be followed by a successful orphan slot.
    const [activation, reservation] = await env.DB.batch([
      env.DB.prepare(NODE_ACTIVATION_SQL)
        .bind(xUserId, xAccountCreatedAt, subscriptionType, nowUtc, premiumRevalidateAt, nowUtc, session.nodeId, session.wallet, hashNodeSessionNonce(session.nonce), nowUtc, hashNodeSessionNonce(payload.nonce), nowUtc, xUserId),
      env.DB.prepare(GENESIS_SLOT_RESERVATION_SQL)
        .bind(GENESIS_REWARD_BASE_UNITS, nowUtc, session.nodeId, session.wallet, xUserId, nowUtc, session.nodeId),
    ]);
    if (activation.meta.changes !== 1) return fail("genesis-capacity-or-race");
    const result = reservation.meta.changes === 1 ? "active" : "active-genesis-capacity";
    return new Response(null, { status: 302, headers: { Location: new URL(`/rewards?binding=${result}`, "https://internalagency.io").toString(), "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Set-Cookie": clearNodeSessionCookie() } });
  } catch {
    return fail("node-or-x-already-bound");
  }
}

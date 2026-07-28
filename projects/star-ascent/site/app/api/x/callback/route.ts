import { env } from "cloudflare:workers";
import { pkceVerifier, verifyXOAuthState } from "../../../../../engagement/x-oauth-state.mjs";
const callbackDefault = "https://internalagency.io/api/x/callback";
const fail = (code: string) => Response.redirect(new URL(`/rewards?binding=${encodeURIComponent(code)}`, "https://internalagency.io"), 302);
export async function GET(request: Request) {
  const url = new URL(request.url), code = url.searchParams.get("code"), state = url.searchParams.get("state"), clientId = env.X_CLIENT_ID, secret = env.X_OAUTH_STATE_SECRET, redirectUri = env.X_OAUTH_REDIRECT_URI ?? callbackDefault;
  if (!code || !state || !clientId || !secret || !env.DB) return fail("oauth-unavailable");
  let payload: { nodeId: string }; try { payload = verifyXOAuthState({ state, secret }); } catch { return fail("oauth-state-invalid"); }
  const form = new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, code, redirect_uri: redirectUri, code_verifier: pkceVerifier({ state, secret }) });
  const tokenResponse = await fetch("https://api.x.com/2/oauth2/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
  const token = await tokenResponse.json() as { access_token?: string }; if (!tokenResponse.ok || !token.access_token) return fail("oauth-exchange-failed");
  const profileResponse = await fetch("https://api.x.com/2/users/me", { headers: { Authorization: `Bearer ${token.access_token}` } });
  const profile = await profileResponse.json() as { data?: { id?: string } }, xUserId = profile.data?.id; if (!profileResponse.ok || !xUserId) return fail("oauth-profile-failed");
  const update = await env.DB.prepare("UPDATE node_bindings SET x_user_id = ?, state = 'active', activated_at_utc = ? WHERE id = ? AND state = 'pending' AND x_user_id IS NULL").bind(xUserId, new Date().toISOString(), payload.nodeId).run();
  if (update.meta.changes !== 1) return fail("node-already-bound"); return Response.redirect(new URL(`/rewards?binding=active&node=${encodeURIComponent(payload.nodeId)}`, "https://internalagency.io"), 302);
}

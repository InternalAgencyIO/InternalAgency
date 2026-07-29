import { env } from "cloudflare:workers";
import { issueXOAuthState, pkceChallenge, pkceVerifier } from "../../../../engagement/x-oauth-state.mjs";

const callbackDefault = "https://internalagency.io/api/x/callback";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nodeId = url.searchParams.get("nodeId") ?? "";
  const clientId = env.X_CLIENT_ID;
  const secret = env.X_OAUTH_STATE_SECRET;
  const redirectUri = env.X_OAUTH_REDIRECT_URI ?? callbackDefault;
  if (!clientId || !secret) return Response.json({ error: "X_OAUTH_NOT_CONFIGURED", next: "Configure X_CLIENT_ID and X_OAUTH_STATE_SECRET in the deployment secret manager." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!env.DB) return Response.json({ error: "CLAIM_SERVICE_NOT_CONFIGURED" }, { status: 503 });
  if (!/^[0-9a-f-]{36}$/i.test(nodeId)) return Response.json({ error: "INVALID_NODE" }, { status: 400 });
  const binding = await env.DB.prepare("SELECT id, state FROM node_bindings WHERE id = ?").bind(nodeId).first<{ id: string; state: string }>();
  if (!binding || binding.state !== "pending") return Response.json({ error: "NODE_NOT_ELIGIBLE_FOR_X_BINDING" }, { status: 409 });
  const state = issueXOAuthState({ nodeId, secret });
  const verifier = pkceVerifier({ state, secret });
  const authorize = new URL("https://x.com/i/oauth2/authorize");
  authorize.search = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, scope: "users.read", state, code_challenge: pkceChallenge(verifier), code_challenge_method: "S256" }).toString();
  return Response.redirect(authorize, 302);
}

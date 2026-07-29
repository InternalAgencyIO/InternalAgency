import { issueXOAuthState, pkceChallenge, pkceVerifier, verifyXOAuthState } from "../engagement/x-oauth-state.mjs";

const secret = "this-is-a-test-only-oauth-state-secret-with-adequate-length";
const nodeId = "b4a87379-f716-4d00-8314-c4ad7274a873";
const now = new Date("2026-07-28T00:00:00.000Z");
const state = issueXOAuthState({ nodeId, secret, now, nonce: "abcdefghijklmnopqrstuvwx" });
const payload = verifyXOAuthState({ state, secret, now: new Date("2026-07-28T00:01:00.000Z") });
if (payload.nodeId !== nodeId || !/^[A-Za-z0-9_-]{43}$/.test(pkceVerifier({ state, secret, now }))) throw new Error("valid state or verifier failed");
if (!/^[A-Za-z0-9_-]{43}$/.test(pkceChallenge(pkceVerifier({ state, secret, now })))) throw new Error("PKCE challenge failed");
let rejected = false;
try { verifyXOAuthState({ state: `${state}x`, secret, now }); } catch { rejected = true; }
if (!rejected) throw new Error("tampered state accepted");
console.log("OK: signed X OAuth state and deterministic PKCE verifier reject tampering.");

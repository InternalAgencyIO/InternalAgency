import { createHmac, createHash, timingSafeEqual } from "node:crypto";
const base64url = (value) => Buffer.from(value).toString("base64url");
const decode = (value) => JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
const mac = (secret, value) => createHmac("sha256", secret).update(value).digest("base64url");
export function issueXOAuthState({ nodeId, secret, now = new Date(), ttlMs = 5 * 60_000, nonce }) {
  if (!secret || secret.length < 32) throw new Error("X OAuth state secret must be at least 32 characters");
  if (!/^[0-9a-f-]{36}$/i.test(nodeId)) throw new Error("node id must be a UUID");
  const payload = { v: 1, nodeId, nonce: nonce ?? crypto.randomUUID().replaceAll("-", ""), exp: now.valueOf() + ttlMs };
  const body = base64url(JSON.stringify(payload)); return `${body}.${mac(secret, body)}`;
}
export function verifyXOAuthState({ state, secret, now = new Date() }) {
  const [body, signature, extra] = String(state).split(".");
  if (!body || !signature || extra) throw new Error("malformed OAuth state");
  const expected = Buffer.from(mac(secret, body)), supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error("invalid OAuth state signature");
  const payload = decode(body);
  if (payload.v !== 1 || !/^[0-9a-f-]{36}$/i.test(payload.nodeId) || !/^[a-zA-Z0-9_-]{16,}$/.test(payload.nonce) || !Number.isFinite(payload.exp)) throw new Error("invalid OAuth state payload");
  if (now.valueOf() > payload.exp) throw new Error("OAuth state expired"); return payload;
}
export function pkceVerifier({ state, secret, now }) { verifyXOAuthState({ state, secret, now }); return mac(secret, `pkce:${state}`); }
export function pkceChallenge(verifier) { return createHash("sha256").update(verifier).digest("base64url"); }

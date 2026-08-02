import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { assertSolanaPublicKey } from "./solana-wallet-proof.mjs";

export const NODE_SESSION_COOKIE = "__Host-iat_node_session";
export const NODE_SESSION_TTL_MS = 15 * 60_000;

const base64url = (value) => Buffer.from(value).toString("base64url");
const mac = (secret, value) => createHmac("sha256", secret).update(value).digest("base64url");

const validateSecret = (secret) => {
  if (!secret || secret.length < 32) throw new Error("node session secret must be at least 32 characters");
};

export const hashNodeSessionNonce = (nonce) => createHash("sha256").update(nonce).digest("hex");

export function issueNodeSession({ nodeId, wallet, secret, now = new Date(), ttlMs = NODE_SESSION_TTL_MS, nonce = undefined }) {
  validateSecret(secret);
  if (!/^[0-9a-f-]{36}$/i.test(nodeId)) throw new Error("node id must be a UUID");
  assertSolanaPublicKey(wallet);
  const payload = {
    v: 1,
    nodeId,
    wallet,
    nonce: nonce ?? crypto.randomUUID().replaceAll("-", ""),
    exp: now.valueOf() + ttlMs,
  };
  const body = base64url(JSON.stringify(payload));
  return { token: `${body}.${mac(secret, body)}`, payload };
}

export function verifyNodeSession({ token, secret, now = new Date() }) {
  validateSecret(secret);
  const [body, signature, extra] = String(token ?? "").split(".");
  if (!body || !signature || extra) throw new Error("malformed node session");
  const expected = Buffer.from(mac(secret, body));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error("invalid node session signature");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (
    payload.v !== 1
    || !/^[0-9a-f-]{36}$/i.test(payload.nodeId)
    || !/^[a-zA-Z0-9_-]{16,}$/.test(payload.nonce)
    || !Number.isFinite(payload.exp)
  ) throw new Error("invalid node session payload");
  assertSolanaPublicKey(payload.wallet);
  if (now.valueOf() > payload.exp) throw new Error("node session expired");
  return payload;
}

export function readNodeSessionCookie(request) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === NODE_SESSION_COOKIE) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

export function nodeSessionCookie(token, ttlMs = NODE_SESSION_TTL_MS) {
  const maxAge = Math.max(1, Math.floor(ttlMs / 1000));
  return `${NODE_SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

export function clearNodeSessionCookie() {
  return `${NODE_SESSION_COOKIE}=; Max-Age=0; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

import { createPublicKey, verify } from "node:crypto";

const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const index = new Map([...alphabet].map((character, position) => [character, position]));
const ed25519SpkiPrefix = Buffer.from("302a300506032b6570032100", "hex");

export function decodeBase58(value) {
  if (typeof value !== "string" || value.length === 0) throw new Error("base58 value is required");
  let number = 0n;
  for (const character of value) {
    const digit = index.get(character);
    if (digit === undefined) throw new Error("invalid base58 character");
    number = number * 58n + BigInt(digit);
  }
  const bytes = [];
  while (number > 0n) { bytes.unshift(Number(number & 255n)); number >>= 8n; }
  for (const character of value) { if (character === "1") bytes.unshift(0); else break; }
  return Buffer.from(bytes);
}

export function encodeBase58(bytes) {
  let number = BigInt(`0x${Buffer.from(bytes).toString("hex") || "0"}`);
  let result = "";
  while (number > 0n) { result = alphabet[Number(number % 58n)] + result; number /= 58n; }
  for (const byte of bytes) { if (byte === 0) result = `1${result}`; else break; }
  return result || "1";
}

export function assertSolanaPublicKey(wallet) {
  const bytes = decodeBase58(wallet);
  if (bytes.length !== 32) throw new Error("wallet must decode to a 32-byte Solana public key");
  return bytes;
}

export function nodeChallenge({ wallet, nonce, issuedAtUtc, expiresAtUtc, origin }) {
  assertSolanaPublicKey(wallet);
  if (!/^[A-Za-z0-9_-]{24,128}$/.test(nonce ?? "")) throw new Error("nonce must be URL-safe and 24-128 characters");
  const issued = new Date(issuedAtUtc);
  const expires = new Date(expiresAtUtc);
  if (Number.isNaN(issued.valueOf()) || Number.isNaN(expires.valueOf()) || expires <= issued) throw new Error("challenge timestamps are invalid");
  if (!/^https:\/\/[a-z0-9.-]+$/i.test(origin ?? "")) throw new Error("origin must be an HTTPS origin without a path");
  return ["STAR ASCENT // NODE BINDING", `Origin: ${origin}`, `Wallet: ${wallet}`, `Nonce: ${nonce}`, `Issued at: ${issued.toISOString()}`, `Expires at: ${expires.toISOString()}`, "This proves control of this public wallet. It does not authorize a transfer or token approval."].join("\n");
}

export function verifyNodeChallenge({ wallet, nonce, issuedAtUtc, expiresAtUtc, origin, signatureBase58, now = new Date() }) {
  const expires = new Date(expiresAtUtc);
  if (Number.isNaN(expires.valueOf()) || now > expires) throw new Error("challenge has expired");
  const publicKey = assertSolanaPublicKey(wallet);
  const signature = decodeBase58(signatureBase58);
  if (signature.length !== 64) throw new Error("Ed25519 signature must be 64 bytes");
  const message = nodeChallenge({ wallet, nonce, issuedAtUtc, expiresAtUtc, origin });
  const key = createPublicKey({ key: Buffer.concat([ed25519SpkiPrefix, publicKey]), format: "der", type: "spki" });
  if (!verify(null, Buffer.from(message, "utf8"), key, signature)) throw new Error("wallet signature is invalid");
  return { wallet, message, verifiedAtUtc: now.toISOString() };
}

import { sha256 } from "@noble/hashes/sha256";

const encoder = new TextEncoder();

function toBytes(value, encoding) {
  if (typeof value === "string") {
    if (encoding !== undefined && encoding !== "utf8" && encoding !== "utf-8") {
      throw new TypeError(`Unsupported string encoding: ${encoding}`);
    }
    return encoder.encode(value);
  }
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError("Hash input must be a string, ArrayBuffer, or typed-array view");
}

function toHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Narrow browser compatibility surface for Switchboard SignatureAuth. This is
// intentionally SHA-256-only and delegates the primitive to pinned
// @noble/hashes rather than implementing cryptography locally.
export function createHash(algorithm) {
  if (String(algorithm).toLowerCase() !== "sha256") {
    throw new TypeError(`Unsupported hash algorithm: ${algorithm}`);
  }

  const state = sha256.create();
  let finalized = false;

  const hash = {
    update(value, encoding) {
      if (finalized) throw new Error("Hash already finalized");
      state.update(toBytes(value, encoding));
      return hash;
    },
    digest(encoding) {
      if (finalized) throw new Error("Hash already finalized");
      finalized = true;
      const bytes = state.digest();
      if (encoding === undefined) return bytes;
      if (encoding === "hex") return toHex(bytes);
      throw new TypeError(`Unsupported digest encoding: ${encoding}`);
    },
  };

  return hash;
}

const cryptoBrowserShim = { createHash };

export default cryptoBrowserShim;

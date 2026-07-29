import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

export function normalizeTextForDigest(value) {
  return value.replace(/\r\n?/g, "\n");
}

export function sha256CanonicalText(value) {
  return createHash("sha256")
    .update(normalizeTextForDigest(value), "utf8")
    .digest("hex");
}

export function sha256CanonicalTextFile(path) {
  return sha256CanonicalText(readFileSync(path, "utf8"));
}

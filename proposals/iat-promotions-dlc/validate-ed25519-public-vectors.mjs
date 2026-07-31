/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 * Public verification vectors only; this module never loads signing material.
 */

import { createPublicKey, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const vectorPath = fileURLToPath(new URL("./ed25519-public-vectors.v0.json", import.meta.url));
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const STATUS_LABELS = [
  "DRAFT",
  "INACTIVE",
  "NOT PART OF GENESIS",
  "NOT DEPLOYED",
  "NO CLAIM ROUTE",
];

export function loadEd25519PublicVectors() {
  return JSON.parse(readFileSync(vectorPath, "utf8"));
}

export function createEd25519PublicKey(publicKeyHex) {
  if (typeof publicKeyHex !== "string" || !/^[0-9a-f]{64}$/.test(publicKeyHex)) {
    throw new Error("INVALID_ED25519_PUBLIC_KEY_HEX");
  }
  return createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]),
    format: "der",
    type: "spki",
  });
}

export function verifyEd25519PublicVector(vector) {
  if (!vector || vector.algorithm !== "Ed25519") return false;
  if (typeof vector.messageHex !== "string" || !/^(?:[0-9a-f]{2})*$/.test(vector.messageHex)) {
    return false;
  }
  if (typeof vector.signatureHex !== "string" || !/^[0-9a-f]{128}$/.test(vector.signatureHex)) {
    return false;
  }
  try {
    return verify(
      null,
      Buffer.from(vector.messageHex, "hex"),
      createEd25519PublicKey(vector.publicKeyHex),
      Buffer.from(vector.signatureHex, "hex"),
    );
  } catch {
    return false;
  }
}

function containsForbiddenSecretField(value) {
  if (!value || typeof value !== "object") return false;
  for (const [key, nested] of Object.entries(value)) {
    if (/(private|secret|seed|mnemonic)/i.test(key)) return true;
    if (containsForbiddenSecretField(nested)) return true;
  }
  return false;
}

export function validateEd25519PublicVectors(definition) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };

  expect(definition?.vectorVersion === 0, "vector version must remain zero");
  expect(
    JSON.stringify(definition?.status?.labels) === JSON.stringify(STATUS_LABELS),
    "public status labels mismatch",
  );
  expect(definition?.status?.network === "NONE", "vectors must remain network-free");
  expect(definition?.status?.programId === null, "vectors must not claim a program ID");
  expect(
    definition?.source === "https://datatracker.ietf.org/doc/html/rfc8032#section-7.1",
    "RFC 8032 source mismatch",
  );
  expect(!containsForbiddenSecretField(definition), "secret-bearing field name is forbidden");
  expect(Array.isArray(definition?.vectors) && definition.vectors.length === 2, "vector set mismatch");

  const names = new Set();
  for (const vector of definition?.vectors ?? []) {
    expect(typeof vector.name === "string" && vector.name.length > 0, "vector name missing");
    expect(!names.has(vector.name), `duplicate vector name: ${vector.name}`);
    names.add(vector.name);
    expect(vector.algorithm === "Ed25519", `${vector.name} algorithm mismatch`);
    expect(/^[0-9a-f]{64}$/.test(vector.publicKeyHex ?? ""), `${vector.name} public key malformed`);
    expect(/^(?:[0-9a-f]{2})*$/.test(vector.messageHex ?? ""), `${vector.name} message malformed`);
    expect(/^[0-9a-f]{128}$/.test(vector.signatureHex ?? ""), `${vector.name} signature malformed`);
    expect(verifyEd25519PublicVector(vector), `${vector.name} signature does not verify`);
  }

  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateEd25519PublicVectors(loadEd25519PublicVectors());
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Public RFC 8032 Ed25519 vectors verify without secret material or chain access.");
  }
}

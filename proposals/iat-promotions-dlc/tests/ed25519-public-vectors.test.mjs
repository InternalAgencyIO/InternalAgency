/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  loadEd25519PublicVectors,
  validateEd25519PublicVectors,
  verifyEd25519PublicVector,
} from "../validate-ed25519-public-vectors.mjs";

const definition = loadEd25519PublicVectors();

function flipHexByte(hex, byteIndex) {
  const bytes = Buffer.from(hex, "hex");
  bytes[byteIndex] ^= 1;
  return bytes.toString("hex");
}

test("public-key-only RFC 8032 vectors validate and verify", () => {
  assert.deepEqual(validateEd25519PublicVectors(definition), []);
  assert.equal(definition.vectors.length, 2);
  assert.ok(definition.vectors.every(verifyEd25519PublicVector));
});

test("every signature-byte mutation and message/key substitution is rejected", () => {
  for (const vector of definition.vectors) {
    for (let byteIndex = 0; byteIndex < 64; byteIndex += 1) {
      assert.equal(
        verifyEd25519PublicVector({
          ...vector,
          signatureHex: flipHexByte(vector.signatureHex, byteIndex),
        }),
        false,
        `${vector.name} accepted signature mutation ${byteIndex}`,
      );
    }
    assert.equal(
      verifyEd25519PublicVector({ ...vector, messageHex: `${vector.messageHex}00` }),
      false,
    );
  }
  assert.equal(
    verifyEd25519PublicVector({
      ...definition.vectors[0],
      publicKeyHex: definition.vectors[1].publicKeyHex,
    }),
    false,
  );
});

test("deployment claims, secret-bearing fields, and malformed vectors fail validation", () => {
  const mutated = structuredClone(definition);
  mutated.status.network = "mainnet-beta";
  mutated.status.programId = "11111111111111111111111111111111";
  mutated.privateKeyHex = "forbidden-field-even-if-not-real-material";
  mutated.vectors[0].signatureHex = flipHexByte(mutated.vectors[0].signatureHex, 0);
  const errors = validateEd25519PublicVectors(mutated);

  assert.ok(errors.includes("vectors must remain network-free"));
  assert.ok(errors.includes("vectors must not claim a program ID"));
  assert.ok(errors.includes("secret-bearing field name is forbidden"));
  assert.ok(errors.includes("RFC8032_ED25519_TEST_1_EMPTY_MESSAGE signature does not verify"));
});

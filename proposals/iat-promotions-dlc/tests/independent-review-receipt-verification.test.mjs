/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import test from "node:test";

import { generateIndependentReviewVerificationVectors } from "../generate-independent-review-receipt-verification-vectors.mjs";
import { verifyDetachedEd25519Message, verifyExternalReviewReceiptAttestation } from "../independent-review-receipt-verifier.mjs";
import {
  loadIndependentReviewVerificationBundle,
  validateIndependentReviewVerificationVectors,
} from "../validate-independent-review-receipt-verification-vectors.mjs";

const bundle = loadIndependentReviewVerificationBundle();
const { vectors, payloadVectors } = bundle;
const rfc = vectors.publicRfcCases[0];
const payloadVector = payloadVectors.vectors[0];

const attestation = (overrides = {}) => ({
  algorithm: "Ed25519",
  publicKeyHex: rfc.publicKeyHex,
  signatureHex: rfc.signatureHex,
  payloadSha256: payloadVector.messageSha256,
  ...overrides,
});

test("verify-only receipt vectors deterministically reproduce under every HOLD gate", () => {
  assert.deepEqual(validateIndependentReviewVerificationVectors(bundle), []);
  assert.deepEqual(generateIndependentReviewVerificationVectors(), vectors);
  assert.equal(vectors.status.createsKeys, false);
  assert.equal(vectors.status.createsSignatures, false);
  assert.equal(vectors.status.validReviewReceiptAttestationPublished, false);
});

test("both published RFC 8032 public vectors verify through the detached adapter", () => {
  for (const testCase of vectors.publicRfcCases) {
    assert.equal(verifyDetachedEd25519Message(testCase), true, testCase.name);
  }
});

test("unrelated valid RFC signatures do not verify any canonical review payload", () => {
  for (const testCase of vectors.reviewPayloadNegativeCases) {
    const payload = payloadVectors.vectors.find((candidate) => candidate.name === testCase.payloadVector);
    const result = verifyExternalReviewReceiptAttestation(payload.input, {
      algorithm: "Ed25519",
      publicKeyHex: testCase.publicKeyHex,
      signatureHex: testCase.signatureHex,
      payloadSha256: testCase.payloadSha256,
    });
    assert.equal(result.payloadDigestMatches, true);
    assert.equal(result.cryptographicallyVerified, false);
    assert.equal(result.reason, "INVALID_EXTERNAL_SIGNATURE");
  }
});

test("changed public key, signature, or message byte fails detached verification", () => {
  const changedKey = `${rfc.publicKeyHex.slice(0, -2)}${rfc.publicKeyHex.endsWith("00") ? "01" : "00"}`;
  const changedSignature = `${rfc.signatureHex.slice(0, -2)}${rfc.signatureHex.endsWith("00") ? "01" : "00"}`;
  const changedMessage = rfc.messageHex.length ? `${rfc.messageHex.slice(0, -2)}00` : "00";
  assert.equal(verifyDetachedEd25519Message({ ...rfc, publicKeyHex: changedKey }), false);
  assert.equal(verifyDetachedEd25519Message({ ...rfc, signatureHex: changedSignature }), false);
  assert.equal(verifyDetachedEd25519Message({ ...rfc, messageHex: changedMessage }), false);
});

test("malformed detached material and attestation shapes fail without throwing", () => {
  for (const malformed of [
    { messageHex: "0", publicKeyHex: rfc.publicKeyHex, signatureHex: rfc.signatureHex },
    { messageHex: "", publicKeyHex: "0", signatureHex: rfc.signatureHex },
    { messageHex: "", publicKeyHex: rfc.publicKeyHex, signatureHex: "0" },
  ]) assert.equal(verifyDetachedEd25519Message(malformed), false);
  assert.equal(verifyExternalReviewReceiptAttestation(payloadVector.input, null).reason, "INVALID_ATTESTATION_SHAPE");
  assert.equal(
    verifyExternalReviewReceiptAttestation(payloadVector.input, { ...attestation(), extra: true }).reason,
    "INVALID_ATTESTATION_SHAPE",
  );
  assert.equal(
    verifyExternalReviewReceiptAttestation(payloadVector.input, attestation({ algorithm: "Other" })).reason,
    "UNSUPPORTED_ATTESTATION_ALGORITHM",
  );
});

test("payload digest mismatch stops before detached signature verification", () => {
  const result = verifyExternalReviewReceiptAttestation(
    payloadVector.input,
    attestation({ payloadSha256: "0".repeat(64) }),
  );
  assert.equal(result.payloadDigestMatches, false);
  assert.equal(result.cryptographicallyVerified, false);
  assert.equal(result.reason, "PAYLOAD_DIGEST_MISMATCH");
});

test("invalid or activation-authorizing receipt payloads stop before verification", () => {
  const invalid = { ...payloadVector.input, activationAuthorized: true };
  const result = verifyExternalReviewReceiptAttestation(invalid, attestation());
  assert.equal(result.cryptographicallyVerified, false);
  assert.match(result.reason, /^INVALID_PAYLOAD:/);
  assert.equal(result.activationAuthorized, false);
  assert.equal(result.activationEffect, "NONE");
});

test("cryptographic result never claims semantic review, independence, or activation", () => {
  const result = verifyExternalReviewReceiptAttestation(payloadVector.input, attestation());
  assert.equal(result.verificationOnly, true);
  assert.equal(result.reviewSemanticsVerified, false);
  assert.equal(result.reviewerIndependenceVerified, false);
  assert.equal(result.activationAuthorized, false);
  assert.equal(result.activationEffect, "NONE");
});

test("adapter source contains no signing, private-key, key-generation, wallet, or network capability", () => {
  assert.doesNotMatch(bundle.adapterSource, /\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/);
  assert.doesNotMatch(bundle.adapterSource, /\b(?:fetch|WebSocket|XMLHttpRequest)\s*\(/);
  const imports = [...bundle.adapterSource.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(imports, [
    "node:crypto",
    "./validate-ed25519-public-vectors.mjs",
    "./independent-review-receipt-payload.mjs",
  ]);
});

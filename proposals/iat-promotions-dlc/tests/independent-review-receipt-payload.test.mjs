/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildUnsignedReviewPayloadFixture,
  generateIndependentReviewPayloadVectors,
} from "../generate-independent-review-receipt-payload-vectors.mjs";
import {
  decodeUnsignedReviewReceiptPayload,
  encodeUnsignedReviewReceiptPayload,
  REVIEW_DECISIONS,
  REVIEW_PAYLOAD_KEYS,
  unsignedReviewPayloadSha256,
} from "../independent-review-receipt-payload.mjs";
import {
  loadIndependentReviewPayloadVectors,
  validateIndependentReviewPayloadVectors,
} from "../validate-independent-review-receipt-payload-vectors.mjs";

const vectors = loadIndependentReviewPayloadVectors();
const base = buildUnsignedReviewPayloadFixture("APPROVE_REVIEW_ONLY");
const clone = (value) => structuredClone(value);

test("unsigned review-payload vectors deterministically reproduce under every HOLD gate", () => {
  assert.deepEqual(validateIndependentReviewPayloadVectors(vectors), []);
  assert.deepEqual(generateIndependentReviewPayloadVectors(), vectors);
  assert.equal(vectors.status.containsKeys, false);
  assert.equal(vectors.status.containsSignatures, false);
  assert.equal(vectors.contract.attestationIncluded, false);
});

test("all three review-only decisions have fixed bytes and exact round trips", () => {
  assert.deepEqual(vectors.vectors.map((vector) => vector.name), Object.keys(REVIEW_DECISIONS));
  for (const vector of vectors.vectors) {
    const message = Buffer.from(vector.messageHex, "hex");
    assert.equal(message.length, Number(vector.messageLength));
    assert.deepEqual(decodeUnsignedReviewReceiptPayload(message), vector.input);
    assert.deepEqual(encodeUnsignedReviewReceiptPayload(vector.input), message);
  }
});

test("canonical field order is fixed and unknown, missing, or reordered fields fail", () => {
  assert.deepEqual(Object.keys(base), REVIEW_PAYLOAD_KEYS);
  const missing = clone(base);
  delete missing.reviewTreeRootSha256;
  assert.throws(() => encodeUnsignedReviewReceiptPayload(missing), /field order drift/);
  const extra = { ...base, unexpected: "field" };
  assert.throws(() => encodeUnsignedReviewReceiptPayload(extra), /field order drift/);
  const reordered = Object.fromEntries([...Object.entries(base)].reverse());
  assert.throws(() => encodeUnsignedReviewReceiptPayload(reordered), /field order drift/);
});

test("every target and scope binding independently changes the payload digest", () => {
  const original = unsignedReviewPayloadSha256(base);
  const mutations = {
    gitCommitSha: "f".repeat(40),
    reviewManifestContentSha256: "f".repeat(64),
    reviewTreeRootSha256: "e".repeat(64),
    coveredFileCount: "80",
    scopeCanonicalSha256: "d".repeat(64),
  };
  for (const [field, value] of Object.entries(mutations)) {
    assert.notEqual(unsignedReviewPayloadSha256({ ...base, [field]: value }), original, field);
  }
});

test("reviewer, decision, rationale, findings, and timestamp are independently committed", () => {
  const original = unsignedReviewPayloadSha256(base);
  const mutations = [
    { accountabilityLabel: "OTHER SYNTHETIC REVIEWER" },
    { reviewerIdentityCommitmentSha256: "c".repeat(64) },
    { decision: "REQUEST_CHANGES" },
    { rationaleCanonicalSha256: "b".repeat(64) },
    { findingsCommitmentSha256: "a".repeat(64) },
    { reviewedAtUnixSeconds: "1800000001" },
  ];
  for (const mutation of mutations) {
    assert.notEqual(unsignedReviewPayloadSha256({ ...base, ...mutation }), original, Object.keys(mutation)[0]);
  }
});

test("malformed hashes, integers, labels, decisions, and independence fail closed", () => {
  const mutations = [
    [{ gitCommitSha: "A".repeat(40) }, /lowercase-hex-40/],
    [{ reviewTreeRootSha256: "0" }, /lowercase-hex-64/],
    [{ coveredFileCount: "01" }, /canonical decimal/],
    [{ reviewedAtUnixSeconds: "-1" }, /canonical decimal/],
    [{ accountabilityLabel: "" }, /non-empty UTF-8/],
    [{ accountabilityLabel: "x".repeat(65) }, /exceeds 64/],
    [{ decision: "ACTIVATE" }, /decision is not allowed/],
    [{ independenceDeclaration: false }, /independence declaration/],
  ];
  for (const [mutation, pattern] of mutations) {
    assert.throws(() => encodeUnsignedReviewReceiptPayload({ ...base, ...mutation }), pattern);
  }
});

test("activation authorization and every non-NONE effect are impossible to encode", () => {
  assert.throws(
    () => encodeUnsignedReviewReceiptPayload({ ...base, activationAuthorized: true }),
    /cannot authorize activation/,
  );
  assert.throws(
    () => encodeUnsignedReviewReceiptPayload({ ...base, activationEffect: "DEPLOY" }),
    /must equal NONE/,
  );
});

test("truncation, trailing bytes, magic drift, and unknown decision bytes fail decoding", () => {
  const message = encodeUnsignedReviewReceiptPayload(base);
  for (let length = 0; length < message.length; length += 17) {
    assert.throws(() => decodeUnsignedReviewReceiptPayload(message.subarray(0, length)), /truncated|magic/);
  }
  assert.throws(() => decodeUnsignedReviewReceiptPayload(Buffer.concat([message, Buffer.from([0])])), /trailing bytes/);
  const badMagic = Buffer.from(message);
  badMagic[0] ^= 1;
  assert.throws(() => decodeUnsignedReviewReceiptPayload(badMagic), /magic mismatch/);
  const decisionOffset = message.length - 75;
  const badDecision = Buffer.from(message);
  badDecision[decisionOffset] = 255;
  assert.throws(() => decodeUnsignedReviewReceiptPayload(badDecision), /unknown review decision/);
});

test("public vectors contain no key, signature, raw identity, handle, or activation capability", () => {
  const serialized = JSON.stringify(vectors);
  for (const forbidden of ["publicKeyHex", "signatureHex", "privateKey", "secretKey", "seedPhrase", "rawXUserId", "xHandle"]) {
    assert.equal(serialized.includes(`"${forbidden}"`), false, forbidden);
  }
  for (const vector of vectors.vectors) {
    assert.equal(vector.input.activationAuthorized, false);
    assert.equal(vector.input.activationEffect, "NONE");
    assert.equal(vector.input.independenceDeclaration, true);
  }
});

test("decision vectors are byte-distinct without creating cryptographic attestations", () => {
  const digests = vectors.vectors.map((vector) => vector.messageSha256);
  assert.equal(new Set(digests).size, 3);
  assert.ok(digests.every((digest) => /^[0-9a-f]{64}$/.test(digest)));
  assert.equal(vectors.vectors.some((vector) => "attestation" in vector), false);
});

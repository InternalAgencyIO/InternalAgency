/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { verifyCampaignEnvelopeWithPublicKey } from "../campaign-envelope-verifier.mjs";
import { generateCampaignEnvelopeVerificationVectors } from "../generate-campaign-envelope-verification-vectors.mjs";
import { verifyDetachedEd25519Message } from "../independent-review-receipt-verifier.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  loadCampaignEnvelopeVerificationBundle,
  validateCampaignEnvelopeVerificationVectors,
} from "../validate-campaign-envelope-verification-vectors.mjs";

const ADAPTER_PATH = fileURLToPath(new URL("../campaign-envelope-verifier.mjs", import.meta.url));
const GENERATOR_PATH = fileURLToPath(
  new URL("../generate-campaign-envelope-verification-vectors.mjs", import.meta.url),
);
const bundle = loadCampaignEnvelopeVerificationBundle();
const vectors = bundle.vectors;
const NOW = 1_800_100_001;

function verifyCase(testCase) {
  return verifyCampaignEnvelopeWithPublicKey(testCase.envelope, {
    now: NOW,
    expectedCampaignId: testCase.expectedCampaignId,
    expectedKeyId: testCase.expectedKeyId,
    publicKeyHex: testCase.publicKeyHex,
  });
}

test("campaign-envelope vectors reproduce under every HOLD gate", () => {
  assert.deepEqual(validateCampaignEnvelopeVerificationVectors(bundle), []);
  assert.deepEqual(generateCampaignEnvelopeVerificationVectors(), vectors);
  assert.equal(vectors.status.validCampaignEnvelopeSignaturePublished, false);
  assert.equal(vectors.status.positiveCampaignIntegrationBlocked, true);
  assert.equal(vectors.contract.activationAuthorized, false);
  assert.equal(vectors.contract.activationEffect, "NONE");
});

test("both externally sourced RFC primitive controls verify", () => {
  assert.equal(vectors.publicPrimitiveControls.length, 2);
  for (const control of vectors.publicPrimitiveControls) {
    assert.equal(control.expectedValid, true, control.name);
    assert.equal(verifyDetachedEd25519Message(control), true, control.name);
    assert.equal(control.source, "https://datatracker.ietf.org/doc/html/rfc8032#section-7.1");
  }
});

test("both unrelated RFC signatures reject the exact canonical campaign envelope", () => {
  assert.equal(vectors.exactEnvelopeNegativeCases.length, 2);
  for (const testCase of vectors.exactEnvelopeNegativeCases) {
    const result = verifyCase(testCase);
    assert.equal(result.campaignEnvelopeVerified, false, testCase.name);
    assert.equal(result.reason, "INVALID_ATTESTATION_SIGNATURE", testCase.name);
    assert.match(result.canonicalMessageHex, /^(?:[0-9a-f]{2})+$/);
    assert.match(result.canonicalMessageSha256, /^[0-9a-f]{64}$/);
    assert.equal(result.canonicalMessageSha256, testCase.expectedCanonicalMessageSha256);
  }
});

test("all eleven canonical field mutations reach and fail the signature gate", () => {
  assert.equal(vectors.canonicalFieldMutationNegativeCases.length, 11);
  const fields = new Set();
  for (const testCase of vectors.canonicalFieldMutationNegativeCases) {
    fields.add(testCase.mutatedField);
    const result = verifyCase(testCase);
    assert.equal(result.campaignEnvelopeVerified, false, testCase.name);
    assert.equal(result.reason, "INVALID_ATTESTATION_SIGNATURE", testCase.name);
    assert.equal(result.canonicalMessageSha256, testCase.expectedCanonicalMessageSha256, testCase.name);
  }
  assert.equal(fields.size, 11);
});

test("cryptographic mutations fail and pre-signature guards remain ordered", () => {
  for (const testCase of vectors.cryptographicMutationNegativeCases) {
    const result = verifyCase(testCase);
    assert.equal(result.campaignEnvelopeVerified, false, testCase.name);
    assert.equal(result.reason, "INVALID_ATTESTATION_SIGNATURE", testCase.name);
    assert.match(result.canonicalMessageSha256, /^[0-9a-f]{64}$/);
  }
  const expectedGuards = [
    "ATTESTATION_DOMAIN_MISMATCH",
    "ATTESTATION_SCHEME_MISMATCH",
    "ATTESTATION_VERSION_MISMATCH",
    "ATTESTATION_ID_MISMATCH",
  ];
  assert.deepEqual(
    vectors.preSignatureGuardNegativeCases.map((testCase) => verifyCase(testCase).reason),
    expectedGuards,
  );
});

test("campaign verification tooling is verify-only, non-authoritative, and reviewed", () => {
  const source = `${readFileSync(ADAPTER_PATH, "utf8")}\n${readFileSync(GENERATOR_PATH, "utf8")}`;
  assert.doesNotMatch(source, /\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/);
  assert.doesNotMatch(readFileSync(ADAPTER_PATH, "utf8"), /\bwriteFile|\bfetch\s*\(|\bWebSocket\s*\(/);
  const allCases = [
    ...vectors.exactEnvelopeNegativeCases,
    ...vectors.canonicalFieldMutationNegativeCases,
    ...vectors.cryptographicMutationNegativeCases,
    ...vectors.preSignatureGuardNegativeCases,
  ];
  for (const testCase of allCases) {
    assert.equal(testCase.expectedCampaignEnvelopeVerified, false, testCase.name);
    assert.equal(testCase.expectedPositiveCampaignSignaturePublishedByVerifier, false, testCase.name);
    assert.equal(testCase.expectedReceiptIssued, false, testCase.name);
    assert.equal(testCase.expectedReviewCompleted, false, testCase.name);
    assert.equal(testCase.expectedActivationAuthorized, false, testCase.name);
    assert.equal(testCase.expectedActivationEffect, "NONE", testCase.name);
  }
  const roles = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => [
      "campaign-envelope-verifier.mjs",
      "generate-campaign-envelope-verification-vectors.mjs",
      "validate-campaign-envelope-verification-vectors.mjs",
      "tests/campaign-envelope-verification.test.mjs",
    ].includes(entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(roles, {
    "campaign-envelope-verifier.mjs": "SUPPORTING_SOURCE",
    "generate-campaign-envelope-verification-vectors.mjs": "GENERATOR",
    "tests/campaign-envelope-verification.test.mjs": "TEST",
    "validate-campaign-envelope-verification-vectors.mjs": "VALIDATOR",
  });
});

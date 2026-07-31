/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalSha256 } from "../compose-program-interface-preview.mjs";
import { generateIndependentReviewAcceptanceVectors } from "../generate-independent-review-receipt-acceptance-vectors.mjs";
import { evaluateIndependentReviewReceiptCandidate } from "../independent-review-receipt-acceptance.mjs";
import { encodeUnsignedReviewReceiptPayload } from "../independent-review-receipt-payload.mjs";
import {
  loadIndependentReviewAcceptanceBundle,
  validateIndependentReviewAcceptanceVectors,
} from "../validate-independent-review-receipt-acceptance-vectors.mjs";

const bundle = loadIndependentReviewAcceptanceBundle();
const { vectors, receiptTemplate } = bundle;
const clone = (value) => structuredClone(value);
const base = vectors.scenarios[0];
const evaluate = (candidate, expectedTarget = base.expectedTarget) =>
  evaluateIndependentReviewReceiptCandidate(candidate, expectedTarget, receiptTemplate);

test("rejection-only acceptance vectors reproduce under every HOLD gate", () => {
  assert.deepEqual(validateIndependentReviewAcceptanceVectors(bundle), []);
  assert.deepEqual(generateIndependentReviewAcceptanceVectors(), vectors);
  assert.equal(vectors.status.acceptedReceiptPublished, false);
  assert.equal(vectors.status.validReviewSignaturePublished, false);
});

test("fully aligned public fixture fails only the absent external review signature gate", () => {
  assert.deepEqual(base.expectedFailedGates, ["CRYPTOGRAPHIC_ATTESTATION"]);
  assert.deepEqual(base.result.gates, {
    exactShape: true,
    targetBinding: true,
    scopeComplete: true,
    reviewerIndependent: true,
    semanticReview: true,
    cryptographicAttestation: false,
  });
  assert.equal(base.result.accepted, false);
});

test("each public scenario exposes its intended fail-closed gate", () => {
  const expected = {
    TARGET_COMMIT_MISMATCH: "TARGET_BINDING",
    SCOPE_AREA_OMITTED: "SCOPE_COMPLETE",
    REVIEWER_ROLE_CONFLICT: "REVIEWER_INDEPENDENCE",
    BLOCKING_FINDING_WITH_APPROVAL: "SEMANTIC_REVIEW",
    ACTIVATION_AUTHORITY_CLAIM: "SEMANTIC_REVIEW",
  };
  for (const [name, gate] of Object.entries(expected)) {
    const scenario = vectors.scenarios.find((candidate) => candidate.name === name);
    assert.ok(scenario.expectedFailedGates.includes(gate), name);
    assert.equal(scenario.result.gates[{
      TARGET_BINDING: "targetBinding",
      SCOPE_COMPLETE: "scopeComplete",
      REVIEWER_INDEPENDENCE: "reviewerIndependent",
      SEMANTIC_REVIEW: "semanticReview",
    }[gate]], false, name);
  }
});

test("unknown, missing, or reordered candidate fields fail exact-shape gating", () => {
  const unknown = { ...clone(base.candidate), extra: true };
  assert.equal(evaluate(unknown).gates.exactShape, false);
  const missing = clone(base.candidate);
  delete missing.target;
  assert.equal(evaluate(missing).gates.exactShape, false);
  const reordered = Object.fromEntries(Object.entries(clone(base.candidate)).reverse());
  assert.equal(evaluate(reordered).gates.exactShape, false);
});

test("target must match expected review target and canonical payload simultaneously", () => {
  const candidate = clone(base.candidate);
  candidate.target.reviewTreeRootSha256 = "0".repeat(64);
  const result = evaluate(candidate);
  assert.equal(result.gates.targetBinding, false);
  assert.ok(result.failures.some((failure) => failure.gate === "TARGET_BINDING"));
});

test("scope rejects duplicate decisions, missing areas, count drift, and stale canonical hash", () => {
  const mutations = [
    (candidate) => candidate.scope.openSecurityDecisionDispositions.push(clone(candidate.scope.openSecurityDecisionDispositions[0])),
    (candidate) => candidate.scope.reviewAreas.pop(),
    (candidate) => { candidate.scope.manifestEntryCount = "90"; },
    (candidate) => { candidate.payload.scopeCanonicalSha256 = "0".repeat(64); },
  ];
  for (const mutate of mutations) {
    const candidate = clone(base.candidate);
    mutate(candidate);
    assert.equal(evaluate(candidate).gates.scopeComplete, false);
  }
});

test("every disallowed concurrent reviewer role fails independence", () => {
  for (const role of receiptTemplate.reviewerContract.disallowedConcurrentRoles) {
    const candidate = clone(base.candidate);
    candidate.reviewer.concurrentRoles = [role];
    assert.equal(evaluate(candidate).gates.reviewerIndependent, false, role);
  }
});

test("blocking dispositions prevent approval but remain compatible with request-changes", () => {
  const candidate = clone(base.candidate);
  candidate.scope.openSecurityDecisionDispositions[0].disposition = "DEFERRED_BLOCKING";
  candidate.payload.scopeCanonicalSha256 = canonicalSha256(candidate.scope);
  candidate.payload.decision = "REQUEST_CHANGES";
  candidate.attestation.payloadSha256 = createHash("sha256")
    .update(encodeUnsignedReviewReceiptPayload(candidate.payload))
    .digest("hex");
  const result = evaluate(candidate);
  assert.equal(result.gates.scopeComplete, true);
  assert.equal(result.gates.semanticReview, true);
  assert.equal(result.gates.cryptographicAttestation, false);
  assert.equal(result.accepted, false);
});

test("no public scenario issues a receipt, completes review, or authorizes activation", () => {
  for (const scenario of vectors.scenarios) {
    assert.equal(scenario.result.accepted, false, scenario.name);
    assert.equal(scenario.result.receiptIssued, false, scenario.name);
    assert.equal(scenario.result.reviewCompletedByThisEvaluator, false, scenario.name);
    assert.equal(scenario.result.activationAuthorized, false, scenario.name);
    assert.equal(scenario.result.activationEffect, "NONE", scenario.name);
  }
});

test("acceptance policy source has no signing, keygen, wallet, network, or chain capability", () => {
  assert.doesNotMatch(bundle.policySource, /\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(|\bfetch\s*\(|\bWebSocket\s*\(/);
  const imports = [...bundle.policySource.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(imports, [
    "./compose-program-interface-preview.mjs",
    "./independent-review-receipt-verifier.mjs",
  ]);
});

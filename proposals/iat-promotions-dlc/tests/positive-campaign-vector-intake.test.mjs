/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  generatePositiveCampaignVectorIntakeVectors,
} from "../generate-positive-campaign-vector-intake-vectors.mjs";
import {
  evaluatePositiveCampaignVectorIntake,
} from "../positive-campaign-vector-intake.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  loadPositiveCampaignVectorIntakeBundle,
  validatePositiveCampaignVectorIntakeVectors,
} from "../validate-positive-campaign-vector-intake-vectors.mjs";

const EVALUATOR_PATH = fileURLToPath(
  new URL("../positive-campaign-vector-intake.mjs", import.meta.url),
);
const bundle = loadPositiveCampaignVectorIntakeBundle();
const vectors = bundle.vectors;
const byName = Object.fromEntries(vectors.scenarios.map((scenario) => [scenario.name, scenario]));

const resultFor = (name) => {
  const scenario = byName[name];
  return evaluatePositiveCampaignVectorIntake(
    scenario.candidate,
    scenario.expectedTarget,
    { now: vectors.evaluationTime },
  );
};
const failedGates = (name) => resultFor(name).gates
  .filter((entry) => entry.result === "FAIL")
  .map((entry) => entry.id);

test("positive-vector intake corpus reproduces under every HOLD gate", () => {
  assert.deepEqual(validatePositiveCampaignVectorIntakeVectors(bundle), []);
  assert.deepEqual(generatePositiveCampaignVectorIntakeVectors(), vectors);
  assert.equal(vectors.status.positiveVectorAvailable, false);
  assert.equal(vectors.status.positiveVectorReviewCompleted, false);
  assert.equal(vectors.status.positiveVectorIntegrationBlocked, true);
  assert.equal(vectors.contract.everyPublicCandidateRejected, true);
  assert.equal(vectors.contract.activationAuthorized, false);
  assert.equal(vectors.contract.activationEffect, "NONE");
});

test("baseline passes structure, target shape, privacy, and canonical binding only", () => {
  const result = resultFor("BASE_UNRELATED_SIGNATURE_AND_REVIEW_ABSENT");
  assert.deepEqual(
    result.gates.map((entry) => [entry.id, entry.result]),
    [
      ["CLOSED_SCHEMA", "PASS"],
      ["EXPECTED_TARGET", "PASS"],
      ["PRIVATE_MATERIAL_EXCLUSION", "PASS"],
      ["EXTERNAL_PROVENANCE", "FAIL"],
      ["CANONICAL_MESSAGE_BINDING", "PASS"],
      ["CRYPTOGRAPHIC_SIGNATURE", "FAIL"],
      ["INDEPENDENT_VECTOR_REVIEW", "FAIL"],
      ["NON_AUTHORITY", "PASS"],
    ],
  );
  assert.equal(result.verificationReason, "INVALID_ATTESTATION_SIGNATURE");
});

test("closed schema and private-material exclusion reject malformed intake", () => {
  assert.ok(failedGates("MISSING_PROVENANCE").includes("CLOSED_SCHEMA"));
  const privateResult = resultFor("PRIVATE_KEY_FIELD_ADDED");
  assert.ok(privateResult.schemaErrors.some((error) => error.keyword === "additionalProperties"));
  assert.ok(failedGates("PRIVATE_KEY_FIELD_ADDED").includes("PRIVATE_MATERIAL_EXCLUSION"));
});

test("canonical bytes, digest, and independently supplied target remain bound", () => {
  assert.ok(failedGates("CANONICAL_MESSAGE_HEX_DRIFT").includes("CANONICAL_MESSAGE_BINDING"));
  assert.ok(failedGates("CANONICAL_MESSAGE_DIGEST_DRIFT").includes("CANONICAL_MESSAGE_BINDING"));
  assert.ok(failedGates("EXPECTED_TARGET_PUBLIC_KEY_MISMATCH").includes("CANONICAL_MESSAGE_BINDING"));
});

test("provenance cannot be self-asserted and an unrelated signature stays invalid", () => {
  assert.ok(failedGates("SOURCE_ARTIFACT_DIGEST_DRIFT").includes("EXTERNAL_PROVENANCE"));
  const mislabeled = resultFor("UNRELATED_SIGNATURE_MISLABELED_AS_SOURCE_SIGNED");
  assert.equal(mislabeled.gates.find((gate) => gate.id === "EXTERNAL_PROVENANCE").result, "PASS");
  assert.equal(mislabeled.gates.find((gate) => gate.id === "CRYPTOGRAPHIC_SIGNATURE").result, "FAIL");
  assert.equal(mislabeled.candidateSatisfiesIntakePolicy, false);
});

test("candidate review claims and authority claims remain powerless", () => {
  assert.ok(failedGates("CANDIDATE_ONLY_REVIEW_CLAIM").includes("INDEPENDENT_VECTOR_REVIEW"));
  assert.ok(failedGates("ACTIVATION_AUTHORITY_CLAIM").includes("NON_AUTHORITY"));
  for (const scenario of vectors.scenarios) {
    const result = resultFor(scenario.name);
    assert.equal(result.receiptIssued, false, scenario.name);
    assert.equal(result.reviewCompletedByThisEvaluator, false, scenario.name);
    assert.equal(result.activationAuthorized, false, scenario.name);
    assert.equal(result.activationEffect, "NONE", scenario.name);
  }
});

test("every published scenario is rejected in the fixed eight-gate order", () => {
  assert.equal(vectors.scenarios.length, 10);
  for (const scenario of vectors.scenarios) {
    const result = resultFor(scenario.name);
    assert.deepEqual(result.gates.map((entry) => entry.id), vectors.contract.gateOrder, scenario.name);
    assert.ok(result.gates.some((entry) => entry.result === "FAIL"), scenario.name);
    assert.equal(result.candidateSatisfiesIntakePolicy, false, scenario.name);
    assert.equal(result.positiveVectorAcceptedForSeparateReview, false, scenario.name);
  }
});

test("intake evaluator is local-read-only and review-manifest covered", () => {
  const source = readFileSync(EVALUATOR_PATH, "utf8");
  assert.doesNotMatch(source, /\bwriteFile(?:Sync)?\s*\(|\bfetch\s*\(|\bWebSocket\s*\(/);
  assert.doesNotMatch(source, /\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/);
  assert.doesNotMatch(source, /wallet-adapter|window\.solana|sendTransaction/);
  const expectedRoles = {
    "generate-positive-campaign-vector-intake-vectors.mjs": "GENERATOR",
    "positive-campaign-vector-intake-vectors.v1.json": "ARTIFACT",
    "positive-campaign-vector-intake.mjs": "SUPPORTING_SOURCE",
    "positive-campaign-vector-intake.schema.v1.json": "ARTIFACT",
    "tests/positive-campaign-vector-intake.test.mjs": "TEST",
    "validate-positive-campaign-vector-intake-vectors.mjs": "VALIDATOR",
  };
  const roles = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expectedRoles, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(roles, expectedRoles);
});

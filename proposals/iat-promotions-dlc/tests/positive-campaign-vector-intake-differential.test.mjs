/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { generatePositiveCampaignVectorIntakeDifferentialVectors } from "../generate-positive-campaign-vector-intake-differential-vectors.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  loadPositiveCampaignVectorIntakeDifferentialBundle,
  validatePositiveCampaignVectorIntakeDifferentialVectors,
} from "../validate-positive-campaign-vector-intake-differential-vectors.mjs";

const PYTHON_VERIFIER = fileURLToPath(
  new URL("../verify-positive-campaign-vector-intake.py", import.meta.url),
);
const GENERATOR = fileURLToPath(
  new URL("../generate-positive-campaign-vector-intake-differential-vectors.mjs", import.meta.url),
);
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) =>
  spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const pythonOptions = {
  encoding: "utf8",
  env: { ...process.env, PYTHONUTF8: "1" },
};
const bundle = loadPositiveCampaignVectorIntakeDifferentialBundle();
const vectors = bundle.vectors;
const byName = Object.fromEntries(vectors.scenarios.map((scenario) => [scenario.name, scenario]));
const gate = (name, id) => byName[name].expectedResult.gates.find((entry) => entry.id === id).result;

function runPython(path = null) {
  const args = [PYTHON_VERIFIER, "--verify-differential-vectors", "--format", "json"];
  if (path !== null) args.push("--differential-vectors", path);
  return spawnSync(PYTHON, args, pythonOptions);
}

test("differential corpus deterministically reproduces twenty rejected mutations", () => {
  assert.deepEqual(validatePositiveCampaignVectorIntakeDifferentialVectors(bundle), []);
  assert.deepEqual(generatePositiveCampaignVectorIntakeDifferentialVectors(), vectors);
  assert.equal(vectors.scenarios.length, 20);
  assert.equal(vectors.contract.everyMutationRejected, true);
  assert.equal(vectors.contract.nodeAndPythonMustMatchExactly, true);
  assert.equal(vectors.contract.activationAuthorized, false);
  assert.equal(vectors.contract.activationEffect, "NONE");
});

test("closed-schema mutations fail before acceptance", () => {
  for (const name of [
    "CANDIDATE_INTAKE_VERSION_CHANGED",
    "CANDIDATE_STATUS_REMOVED",
    "CANDIDATE_UNKNOWN_TOP_LEVEL_FIELD",
    "CANDIDATE_HOLD_LABELS_REORDERED",
  ]) {
    assert.equal(gate(name, "CLOSED_SCHEMA"), "FAIL", name);
  }
});

test("target shape and candidate-target binding mutations fail independently", () => {
  assert.equal(gate("EXPECTED_TARGET_KEYS_REORDERED", "EXPECTED_TARGET"), "FAIL");
  assert.equal(gate("EXPECTED_TARGET_VERSION_CHANGED", "EXPECTED_TARGET"), "FAIL");
  assert.equal(gate("EXPECTED_TARGET_PUBLIC_KEY_SUBSTITUTED", "EXPECTED_TARGET"), "PASS");
  assert.equal(gate("EXPECTED_TARGET_PUBLIC_KEY_SUBSTITUTED", "CANONICAL_MESSAGE_BINDING"), "FAIL");
});

test("privacy and provenance mutations expose their exact gate outcomes", () => {
  assert.equal(gate("CANDIDATE_ACCESS_TOKEN_FIELD_ADDED", "PRIVATE_MATERIAL_EXCLUSION"), "FAIL");
  assert.equal(gate("PROVENANCE_SOURCE_DIGEST_CHANGED", "EXTERNAL_PROVENANCE"), "FAIL");
  assert.equal(gate("PROVENANCE_SOURCE_SIGNED_ASSERTED", "EXTERNAL_PROVENANCE"), "PASS");
  assert.equal(gate("PROVENANCE_SOURCE_SIGNED_ASSERTED", "CRYPTOGRAPHIC_SIGNATURE"), "FAIL");
});

test("canonical-message and signature mutations remain cryptographically rejected", () => {
  for (const name of [
    "CLAIMED_CANONICAL_MESSAGE_HEX_CHANGED",
    "CLAIMED_CANONICAL_MESSAGE_DIGEST_CHANGED",
    "CANDIDATE_PUBLIC_KEY_SUBSTITUTED",
    "CANDIDATE_SIGNATURE_HEX_CHANGED",
    "ENVELOPE_NONCE_CHANGED_WITH_STALE_ATTESTATION_ID",
  ]) {
    assert.equal(gate(name, "CANONICAL_MESSAGE_BINDING"), "FAIL", name);
    assert.equal(gate(name, "CRYPTOGRAPHIC_SIGNATURE"), "FAIL", name);
  }
  assert.equal(
    gate("ENVELOPE_SIGNATURE_BYTE_CHANGED_WITH_MATCHING_HEX", "CANONICAL_MESSAGE_BINDING"),
    "PASS",
  );
  assert.equal(
    gate("ENVELOPE_SIGNATURE_BYTE_CHANGED_WITH_MATCHING_HEX", "CRYPTOGRAPHIC_SIGNATURE"),
    "FAIL",
  );
});

test("review binding can pass but cannot bypass absent valid cryptography", () => {
  assert.equal(gate("CANDIDATE_REVIEW_COMPLETE_TARGET_HELD", "INDEPENDENT_VECTOR_REVIEW"), "FAIL");
  assert.equal(
    gate("REVIEW_BINDING_COMPLETE_BUT_CRYPTOGRAPHY_ABSENT", "INDEPENDENT_VECTOR_REVIEW"),
    "PASS",
  );
  assert.equal(
    gate("REVIEW_BINDING_COMPLETE_BUT_CRYPTOGRAPHY_ABSENT", "CRYPTOGRAPHIC_SIGNATURE"),
    "FAIL",
  );
  assert.equal(
    byName.REVIEW_BINDING_COMPLETE_BUT_CRYPTOGRAPHY_ABSENT.expectedResult.candidateSatisfiesIntakePolicy,
    false,
  );
});

test("authority mutations fail schema and non-authority while output stays powerless", () => {
  for (const name of ["AUTHORITY_RECEIPT_ISSUED", "AUTHORITY_ACTIVATION_AUTHORIZED"]) {
    assert.equal(gate(name, "CLOSED_SCHEMA"), "FAIL", name);
    assert.equal(gate(name, "NON_AUTHORITY"), "FAIL", name);
  }
  for (const scenario of vectors.scenarios) {
    assert.equal(scenario.expectedResult.receiptIssued, false, scenario.name);
    assert.equal(scenario.expectedResult.reviewCompletedByThisEvaluator, false, scenario.name);
    assert.equal(scenario.expectedResult.activationAuthorized, false, scenario.name);
    assert.equal(scenario.expectedResult.activationEffect, "NONE", scenario.name);
  }
});

test("Python independently reproduces all twenty Node mutation results", () => {
  assert.ok(PYTHON, "Python 3 is required for differential intake verification");
  const result = runPython();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    valid: true,
    errors: [],
    mutationCount: 20,
    nodeAndPythonMatchExactly: true,
    receiptIssued: false,
    reviewCompleted: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  });
});

test("Python rejects changed mutation evidence and all tooling remains reviewed verify-only", () => {
  assert.ok(PYTHON, "Python 3 is required for differential intake verification");
  const directory = mkdtempSync(join(tmpdir(), "iat-differential-intake-"));
  try {
    const mutated = structuredClone(vectors);
    mutated.scenarios[12].expectedResult.gates[4].detail = "CHANGED_DIFFERENTIAL_DETAIL";
    const path = join(directory, "differential.json");
    writeFileSync(path, `${JSON.stringify(mutated, null, 2)}\n`, "utf8");
    const result = runPython(path);
    assert.equal(result.status, 2, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.ok(report.errors.some((error) => error.includes(mutated.scenarios[12].name)));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
  const sources = `${readFileSync(GENERATOR, "utf8")}\n${bundle.generatorSource}`;
  assert.doesNotMatch(sources, /\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/);
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  const expectedRoles = {
    "POSITIVE_CAMPAIGN_VECTOR_DIFFERENTIAL.md": "ARTIFACT",
    "generate-positive-campaign-vector-intake-differential-vectors.mjs": "GENERATOR",
    "positive-campaign-vector-intake-differential-vectors.v1.json": "ARTIFACT",
    "tests/positive-campaign-vector-intake-differential.test.mjs": "TEST",
    "validate-positive-campaign-vector-intake-differential-vectors.mjs": "VALIDATOR",
  };
  const roles = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expectedRoles, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(roles, expectedRoles);
});

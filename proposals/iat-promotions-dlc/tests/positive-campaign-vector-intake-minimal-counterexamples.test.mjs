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

import { FUZZ_FAMILIES } from "../generate-positive-campaign-vector-intake-fuzz-vectors.mjs";
import {
  generatePositiveCampaignVectorMinimalCounterexamples,
  replayPositiveCampaignVectorMinimalCounterexample,
} from "../generate-positive-campaign-vector-intake-minimal-counterexamples.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  loadPositiveCampaignVectorMinimalCounterexampleBundle,
  validatePositiveCampaignVectorMinimalCounterexamples,
} from "../validate-positive-campaign-vector-intake-minimal-counterexamples.mjs";

const PYTHON_VERIFIER = fileURLToPath(
  new URL("../verify-positive-campaign-vector-intake.py", import.meta.url),
);
const GENERATOR = fileURLToPath(
  new URL("../generate-positive-campaign-vector-intake-minimal-counterexamples.mjs", import.meta.url),
);
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) =>
  spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const pythonOptions = {
  encoding: "utf8",
  env: { ...process.env, PYTHONUTF8: "1" },
};
const bundle = loadPositiveCampaignVectorMinimalCounterexampleBundle();
const artifact = bundle.artifact;

function runPython(path = null) {
  const args = [PYTHON_VERIFIER, "--verify-minimal-counterexamples", "--format", "json"];
  if (path !== null) args.push("--minimal-counterexamples", path);
  return spawnSync(PYTHON, args, pythonOptions);
}

test("ten minimal counterexamples deterministically regenerate", () => {
  assert.deepEqual(validatePositiveCampaignVectorMinimalCounterexamples(bundle), []);
  assert.deepEqual(generatePositiveCampaignVectorMinimalCounterexamples(), artifact);
  assert.equal(artifact.fixtures.length, 10);
  assert.equal(artifact.contract.storesInputsOrFullResults, false);
});

test("every fuzz family has exactly one one-semantic-delta fixture", () => {
  assert.deepEqual(artifact.fixtures.map((fixture) => fixture.family), FUZZ_FAMILIES);
  assert.equal(new Set(artifact.fixtures.map((fixture) => fixture.sourceFuzzCaseName)).size, 10);
  for (const fixture of artifact.fixtures) {
    assert.equal(fixture.semanticDeltaCount, "1", fixture.family);
    assert.equal(fixture.sourceFuzzCaseIndex, fixture.index, fixture.family);
  }
});

test("eight fixtures isolate a primary gate PASS-to-FAIL transition", () => {
  const passToFail = artifact.fixtures.filter((fixture) =>
    fixture.proofMode === "PASS_TO_FAIL_GATE");
  assert.equal(passToFail.length, 8);
  for (const fixture of passToFail) {
    assert.equal(fixture.controlPrimaryGateResult, "PASS", fixture.family);
    assert.equal(fixture.mutatedPrimaryGateResult, "FAIL", fixture.family);
    assert.ok(fixture.changedGateIds.includes(fixture.primaryGateId), fixture.family);
  }
});

test("signature and guard fixtures stay negative without inventing positive material", () => {
  const signature = artifact.fixtures.find((fixture) =>
    fixture.family === "CRYPTOGRAPHIC_SIGNATURE");
  assert.equal(signature.proofMode, "REJECTION_PRESERVING_BYTE_DELTA");
  assert.equal(signature.storageDeltaCount, "2");
  assert.equal(signature.controlPrimaryGateResult, "FAIL");
  assert.equal(signature.mutatedPrimaryGateResult, "FAIL");
  const guard = artifact.fixtures.find((fixture) =>
    fixture.family === "CRYPTOGRAPHIC_GUARD");
  assert.equal(guard.proofMode, "REJECTION_REASON_DELTA");
  assert.notEqual(guard.controlVerificationReason, guard.mutatedVerificationReason);
});

test("ordered commitment binds the target-key-order counterexample", () => {
  const target = artifact.fixtures.find((fixture) => fixture.family === "EXPECTED_TARGET");
  assert.equal(target.controlInputCanonicalSha256, target.mutatedInputCanonicalSha256);
  assert.notEqual(target.controlInputOrderedSha256, target.mutatedInputOrderedSha256);
  const replay = replayPositiveCampaignVectorMinimalCounterexample(Number(target.index));
  assert.deepEqual(Object.keys(replay.controlTarget).sort(), Object.keys(replay.mutatedTarget).sort());
  assert.notDeepEqual(Object.keys(replay.controlTarget), Object.keys(replay.mutatedTarget));
});

test("controls and mutations remain rejected and permanently powerless", () => {
  for (let index = 0; index < artifact.fixtures.length; index += 1) {
    const fixture = artifact.fixtures[index];
    const replay = replayPositiveCampaignVectorMinimalCounterexample(index);
    assert.equal(fixture.controlAccepted, false, fixture.family);
    assert.equal(fixture.mutatedAccepted, false, fixture.family);
    assert.equal(replay.controlResult.candidateSatisfiesIntakePolicy, false, fixture.family);
    assert.equal(replay.mutatedResult.candidateSatisfiesIntakePolicy, false, fixture.family);
    assert.equal(fixture.receiptIssued, false, fixture.family);
    assert.equal(fixture.reviewCompleted, false, fixture.family);
    assert.equal(fixture.activationAuthorized, false, fixture.family);
    assert.equal(fixture.activationEffect, "NONE", fixture.family);
  }
});

test("Python independently reproduces all ten minimal commitments", () => {
  assert.ok(PYTHON, "Python 3 is required for minimal-counterexample verification");
  const result = runPython();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    valid: true,
    errors: [],
    fixtureCount: 10,
    familyCount: 10,
    nodeAndPythonMatchExactly: true,
    oneSemanticDeltaPerFixture: true,
    fixtureSetCommitmentSha256: artifact.summary.fixtureSetCommitmentSha256,
    receiptIssued: false,
    reviewCompleted: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  });
});

test("Python rejects a changed fixture and a stale set commitment", () => {
  assert.ok(PYTHON, "Python 3 is required for minimal-counterexample verification");
  const directory = mkdtempSync(join(tmpdir(), "iat-minimal-counterexamples-"));
  try {
    const changedFixture = structuredClone(artifact);
    changedFixture.fixtures[5].mutatedResultCommitmentSha256 = "f".repeat(64);
    const fixturePath = join(directory, "changed-fixture.json");
    writeFileSync(fixturePath, `${JSON.stringify(changedFixture, null, 2)}\n`, "utf8");
    const fixtureResult = runPython(fixturePath);
    assert.equal(fixtureResult.status, 2, fixtureResult.stderr || fixtureResult.stdout);
    assert.ok(JSON.parse(fixtureResult.stdout).errors.some((error) =>
      error.includes(changedFixture.fixtures[5].family)));

    const changedSet = structuredClone(artifact);
    changedSet.summary.fixtureSetCommitmentSha256 = "e".repeat(64);
    const setPath = join(directory, "changed-set.json");
    writeFileSync(setPath, `${JSON.stringify(changedSet, null, 2)}\n`, "utf8");
    const setResult = runPython(setPath);
    assert.equal(setResult.status, 2, setResult.stderr || setResult.stdout);
    assert.ok(JSON.parse(setResult.stdout).errors.includes("minimal fixture-set commitment drift"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("minimal tooling is offline verification-only and content-addressed", () => {
  const sources = `${readFileSync(GENERATOR, "utf8")}\n${bundle.pythonVerifierSource}`;
  assert.doesNotMatch(sources, /\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/);
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  const expectedRoles = {
    "POSITIVE_CAMPAIGN_VECTOR_MINIMAL_COUNTEREXAMPLES.md": "ARTIFACT",
    "generate-positive-campaign-vector-intake-minimal-counterexamples.mjs": "GENERATOR",
    "positive-campaign-vector-intake-minimal-counterexamples.v1.json": "ARTIFACT",
    "tests/positive-campaign-vector-intake-minimal-counterexamples.test.mjs": "TEST",
    "validate-positive-campaign-vector-intake-minimal-counterexamples.mjs": "VALIDATOR",
  };
  const roles = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expectedRoles, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(roles, expectedRoles);
});

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

import {
  FUZZ_CASE_COUNT,
  FUZZ_FAMILIES,
  FUZZ_SEED,
  fuzzMerkleRootSha256,
  generatePositiveCampaignVectorIntakeFuzzVectors,
  replayPositiveCampaignVectorIntakeFuzzCase,
} from "../generate-positive-campaign-vector-intake-fuzz-vectors.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  loadPositiveCampaignVectorIntakeFuzzBundle,
  validatePositiveCampaignVectorIntakeFuzzVectors,
} from "../validate-positive-campaign-vector-intake-fuzz-vectors.mjs";

const PYTHON_VERIFIER = fileURLToPath(
  new URL("../verify-positive-campaign-vector-intake.py", import.meta.url),
);
const GENERATOR = fileURLToPath(
  new URL("../generate-positive-campaign-vector-intake-fuzz-vectors.mjs", import.meta.url),
);
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) =>
  spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const pythonOptions = {
  encoding: "utf8",
  env: { ...process.env, PYTHONUTF8: "1" },
};
const bundle = loadPositiveCampaignVectorIntakeFuzzBundle();
const vectors = bundle.vectors;

function runPython(path = null) {
  const args = [PYTHON_VERIFIER, "--verify-fuzz-vectors", "--format", "json"];
  if (path !== null) args.push("--fuzz-vectors", path);
  return spawnSync(PYTHON, args, pythonOptions);
}

test("seeded fuzz corpus deterministically regenerates 256 compact rejected cases", () => {
  assert.deepEqual(validatePositiveCampaignVectorIntakeFuzzVectors(bundle), []);
  assert.deepEqual(generatePositiveCampaignVectorIntakeFuzzVectors(), vectors);
  assert.equal(FUZZ_SEED, 0x49544154);
  assert.equal(vectors.cases.length, FUZZ_CASE_COUNT);
  assert.equal(vectors.contract.storesInputsOrFullResults, false);
  assert.equal(vectors.contract.everyMutationRejected, true);
});

test("all ten fuzz families receive deterministic complete coverage", () => {
  const counts = Object.fromEntries(FUZZ_FAMILIES.map((family) => [family, 0]));
  for (const record of vectors.cases) counts[record.family] += 1;
  assert.deepEqual(counts, Object.fromEntries(FUZZ_FAMILIES.map((family, index) => [
    family,
    index < 6 ? 26 : 25,
  ])));
  assert.deepEqual(vectors.contract.familyCounts, Object.fromEntries(
    Object.entries(counts).map(([family, count]) => [family, String(count)]),
  ));
});

test("every fuzz record has a failing gate and fixed powerless output", () => {
  for (const record of vectors.cases) {
    assert.ok(record.failingGateIds.length > 0, record.name);
    assert.equal(record.expectedAccepted, false, record.name);
    assert.equal(record.expectedReceiptIssued, false, record.name);
    assert.equal(record.expectedReviewCompleted, false, record.name);
    assert.equal(record.expectedActivationAuthorized, false, record.name);
    assert.equal(record.expectedActivationEffect, "NONE", record.name);
  }
});

test("review-complete fuzz cases still fail the independent cryptographic gate", () => {
  const reviewCases = vectors.cases.filter((record) =>
    record.family === "INDEPENDENT_VECTOR_REVIEW");
  assert.equal(reviewCases.length, 25);
  for (const record of reviewCases) {
    assert.ok(record.passingGateIds.includes("INDEPENDENT_VECTOR_REVIEW"), record.name);
    assert.ok(record.failingGateIds.includes("CRYPTOGRAPHIC_SIGNATURE"), record.name);
    const replay = replayPositiveCampaignVectorIntakeFuzzCase(Number(record.index));
    assert.equal(replay.result.candidateSatisfiesIntakePolicy, false, record.name);
  }
});

test("case commitments and the domain-separated Merkle root are mutation-sensitive", () => {
  const commitments = vectors.cases.map((record) => record.caseCommitmentSha256);
  assert.equal(
    fuzzMerkleRootSha256(commitments),
    vectors.summary.caseCommitmentMerkleRootSha256,
  );
  const changed = [...commitments];
  changed[137] = `${changed[137].startsWith("00") ? "01" : "00"}${changed[137].slice(2)}`;
  assert.notEqual(fuzzMerkleRootSha256(changed), vectors.summary.caseCommitmentMerkleRootSha256);
});

test("Python independently reproduces all 256 compact Node commitments", () => {
  assert.ok(PYTHON, "Python 3 is required for seeded fuzz verification");
  const result = runPython();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    valid: true,
    errors: [],
    mutationCount: 256,
    seedHex: "49544154",
    familyCount: 10,
    nodeAndPythonMatchExactly: true,
    allRejected: true,
    caseCommitmentMerkleRootSha256: vectors.summary.caseCommitmentMerkleRootSha256,
    receiptIssued: false,
    reviewCompleted: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  });
});

test("Python names changed compact evidence and rejects a changed Merkle root", () => {
  assert.ok(PYTHON, "Python 3 is required for seeded fuzz verification");
  const directory = mkdtempSync(join(tmpdir(), "iat-seeded-intake-fuzz-"));
  try {
    const changedCase = structuredClone(vectors);
    changedCase.cases[91].resultCommitmentSha256 = "f".repeat(64);
    const casePath = join(directory, "changed-case.json");
    writeFileSync(casePath, `${JSON.stringify(changedCase, null, 2)}\n`, "utf8");
    const caseResult = runPython(casePath);
    assert.equal(caseResult.status, 2, caseResult.stderr || caseResult.stdout);
    const caseReport = JSON.parse(caseResult.stdout);
    assert.ok(caseReport.errors.some((error) => error.includes(changedCase.cases[91].name)));

    const changedRoot = structuredClone(vectors);
    changedRoot.summary.caseCommitmentMerkleRootSha256 = "e".repeat(64);
    const rootPath = join(directory, "changed-root.json");
    writeFileSync(rootPath, `${JSON.stringify(changedRoot, null, 2)}\n`, "utf8");
    const rootResult = runPython(rootPath);
    assert.equal(rootResult.status, 2, rootResult.stderr || rootResult.stdout);
    assert.ok(JSON.parse(rootResult.stdout).errors.includes("fuzz Merkle root drift"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("fuzz tooling is offline verification-only and content-addressed for review", () => {
  const sources = [GENERATOR, PYTHON_VERIFIER]
    .map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/);
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  const expectedRoles = {
    "POSITIVE_CAMPAIGN_VECTOR_FUZZING.md": "ARTIFACT",
    "generate-positive-campaign-vector-intake-fuzz-vectors.mjs": "GENERATOR",
    "positive-campaign-vector-intake-fuzz-vectors.v1.json": "ARTIFACT",
    "tests/positive-campaign-vector-intake-fuzz.test.mjs": "TEST",
    "validate-positive-campaign-vector-intake-fuzz-vectors.mjs": "VALIDATOR",
  };
  const roles = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expectedRoles, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(roles, expectedRoles);
});

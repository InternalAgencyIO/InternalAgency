/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateSettlementContentionMutationVectors } from "../generate-settlement-contention-mutation-vectors.mjs";
import {
  CONTENTION_MUTATION_DEFINITIONS,
  evaluateContentionMutation,
} from "../settlement-contention-mutations.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import { loadSettlementContentionVectorBundle } from "../validate-settlement-contention-vectors.mjs";
import {
  loadSettlementContentionMutationVectorBundle,
  validateSettlementContentionMutationVectors,
} from "../validate-settlement-contention-mutation-vectors.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-vectors.py", import.meta.url));
const EVALUATOR = fileURLToPath(new URL("../settlement-contention-mutations.mjs", import.meta.url));
const GENERATOR = fileURLToPath(new URL("../generate-settlement-contention-mutation-vectors.mjs", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const mutationBundle = loadSettlementContentionMutationVectorBundle();
const artifact = mutationBundle.artifact;
const baseBundle = loadSettlementContentionVectorBundle();

test("compact contention mutation vectors deterministically regenerate", () => {
  assert.deepEqual(validateSettlementContentionMutationVectors(mutationBundle), []);
  assert.deepEqual(generateSettlementContentionMutationVectors(), artifact);
  assert.equal(artifact.cases.length, 16);
  assert.equal(artifact.summary.commonReplayCommitmentSha256,
    "949fe48b3ae1d63bf31ead5a7e4ff251100de6fed0749654e9baef112db08032");
});

test("mutation corpus covers every declared failure family", () => {
  assert.deepEqual(artifact.summary.countsByPrimaryGate, {
    AUTHORITY: "2",
    CAPABILITY: "4",
    COMMITMENT: "2",
    ECONOMICS: "2",
    SEMANTIC_REPLAY: "2",
    SOURCE_BINDING: "1",
    STATUS: "1",
    STRUCTURE: "2",
  });
  assert.deepEqual(artifact.contract.primaryGates, Object.keys(artifact.summary.countsByPrimaryGate));
});

test("all sixteen in-memory candidates are rejected by the Node boundary", () => {
  for (const definition of CONTENTION_MUTATION_DEFINITIONS) {
    const result = evaluateContentionMutation(baseBundle, definition);
    assert.equal(result.semanticErrors.length > 0, true, definition.caseId);
    assert.equal(result.commonReplayRecord.accepted, false);
    assert.equal(result.commonReplayRecord.caseId, definition.caseId);
  }
  assert.equal(artifact.summary.allRejected, true);
});

test("schema-invalid and schema-valid semantic mutations stay distinct", () => {
  const results = CONTENTION_MUTATION_DEFINITIONS.map((definition) => ({
    definition,
    result: evaluateContentionMutation(baseBundle, definition),
  }));
  assert.equal(results.filter(({ result }) => result.schemaErrors.length === 0).length, 5);
  assert.equal(results.filter(({ result }) => result.schemaErrors.length > 0).length, 11);
  for (const { definition, result } of results) {
    assert.equal(result.schemaErrors.length === 0, definition.expectedSchemaValid, definition.caseId);
  }
});

test("rebound economic, authority, winner, and timeline mutations still reject", () => {
  const rebound = CONTENTION_MUTATION_DEFINITIONS.filter((definition) => definition.rebindScenarioCommitment);
  assert.equal(rebound.length, 5);
  for (const definition of rebound) {
    const evaluated = evaluateContentionMutation(baseBundle, definition);
    assert.equal(evaluated.semanticErrors.length > 0, true, definition.caseId);
    assert.equal(evaluated.candidate.summary.scenarioSetCommitmentSha256.length, 64);
  }
});

test("published mutation evidence contains descriptors, not runtime candidates", () => {
  assert.equal(artifact.contract.mutatedCandidatesRuntimeOnly, true);
  assert.equal(artifact.contract.storesExpandedState, false);
  assert.equal(artifact.contract.storesExpandedSchedules, false);
  assert.equal(artifact.summary.runtimeCandidateStored, false);
  assert.equal(Object.hasOwn(artifact, "candidates"), false);
  for (const entry of artifact.cases) {
    assert.equal(Object.hasOwn(entry, "candidate"), false);
    assert.equal(entry.runtimeCandidateStored, false);
    assert.equal(entry.expandedStateStored, false);
    assert.equal(entry.expandedScheduleStored, false);
  }
});

test("independent Python reproduces the compact common replay commitment", () => {
  assert.ok(PYTHON, "Python 3 is required for contention mutation replay");
  const result = spawnSync(
    PYTHON,
    [VERIFIER, "--root", ROOT, "--verify-mutation-vectors", "--json"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.mutationCaseCount, 16);
  assert.equal(report.commonReplayCommitmentSha256, artifact.summary.commonReplayCommitmentSha256);
  assert.equal(report.allRejected, true);
});

test("independent Python rejects changed compact mutation evidence with exit 2", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-contention-mutations-"));
  try {
    const changed = structuredClone(artifact);
    changed.summary.commonReplayCommitmentSha256 = "f".repeat(64);
    const path = join(directory, "changed-mutations.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(
      PYTHON,
      [VERIFIER, "--root", ROOT, "--verify-mutation-vectors", "--mutation-vectors", path, "--json"],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 2, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((error) => error.includes("common replay commitment drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("mutation tooling is offline, powerless, and review-manifest covered", () => {
  const sources = `${readFileSync(EVALUATOR, "utf8")}\n${readFileSync(GENERATOR, "utf8")}\n${readFileSync(VERIFIER, "utf8")}`;
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
  assert.doesNotMatch(sources, /\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/);
  const expected = {
    "generate-settlement-contention-mutation-vectors.mjs": "GENERATOR",
    "settlement-contention-mutation-vectors.v1.json": "ARTIFACT",
    "settlement-contention-mutations.mjs": "SUPPORTING_SOURCE",
    "tests/settlement-contention-mutations.test.mjs": "TEST",
    "validate-settlement-contention-mutation-vectors.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
});

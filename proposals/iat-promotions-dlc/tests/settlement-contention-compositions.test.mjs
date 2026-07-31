/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateSettlementContentionCompositionVectors } from "../generate-settlement-contention-composition-vectors.mjs";
import {
  COMPOSITION_GATE_PRECEDENCE,
  CONTENTION_COMPOSITION_DEFINITIONS,
  evaluateContentionComposition,
} from "../settlement-contention-compositions.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  loadSettlementContentionCompositionVectorBundle,
  validateSettlementContentionCompositionVectors,
} from "../validate-settlement-contention-composition-vectors.mjs";
import { loadSettlementContentionVectorBundle } from "../validate-settlement-contention-vectors.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-vectors.py", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const bundle = loadSettlementContentionCompositionVectorBundle();
const artifact = bundle.artifact;
const baseBundle = loadSettlementContentionVectorBundle();

test("all 28 unordered gate pairs deterministically regenerate", () => {
  assert.deepEqual(validateSettlementContentionCompositionVectors(bundle), []);
  assert.deepEqual(generateSettlementContentionCompositionVectors(), artifact);
  assert.equal(artifact.cases.length, 28);
});

test("pair corpus is complete and has no duplicate pair", () => {
  assert.equal(CONTENTION_COMPOSITION_DEFINITIONS.length, 28);
  assert.equal(new Set(CONTENTION_COMPOSITION_DEFINITIONS.map((item) => item.expectedGates.join("|"))).size, 28);
  assert.deepEqual(artifact.contract.gatePrecedence, COMPOSITION_GATE_PRECEDENCE);
});

test("every combined candidate exposes exactly both failures in fixed precedence", () => {
  for (const definition of CONTENTION_COMPOSITION_DEFINITIONS) {
    const result = evaluateContentionComposition(baseBundle, definition);
    assert.deepEqual(result.observedGates, definition.expectedGates, definition.caseId);
  }
  assert.equal(artifact.summary.allPairsObservedExactly, true);
});

test("every combined candidate and each isolated constituent reject", () => {
  for (const definition of CONTENTION_COMPOSITION_DEFINITIONS) {
    const result = evaluateContentionComposition(baseBundle, definition);
    assert.ok(result.semanticErrors.length > 0, definition.caseId);
    assert.deepEqual(result.isolationRejected, [true, true], definition.caseId);
  }
  assert.equal(artifact.summary.noFailureMasked, true);
  assert.equal(artifact.summary.allRejected, true);
});

test("published evidence stores descriptors and commitments, never candidates", () => {
  assert.equal(artifact.contract.mutatedCandidatesRuntimeOnly, true);
  assert.equal(Object.hasOwn(artifact, "candidates"), false);
  for (const entry of artifact.cases) {
    assert.equal(Object.hasOwn(entry, "candidate"), false);
    assert.equal(Object.hasOwn(entry, "state"), false);
    assert.equal(Object.hasOwn(entry, "trace"), false);
    assert.equal(Object.hasOwn(entry, "attempt"), false);
    assert.equal(entry.runtimeCandidateStored, false);
  }
});

test("independent Python reproduces the composition commitment", () => {
  assert.ok(PYTHON, "Python 3 is required for composition replay");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-composition-vectors", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.compositionCaseCount, 28);
  assert.equal(report.commonReplayCommitmentSha256, artifact.summary.commonReplayCommitmentSha256);
});

test("independent Python rejects changed composition evidence with exit 2", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-contention-compositions-"));
  try {
    const changed = structuredClone(artifact);
    changed.summary.commonReplayCommitmentSha256 = "f".repeat(64);
    const path = join(directory, "changed-compositions.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-composition-vectors", "--composition-vectors", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.equal(JSON.parse(result.stdout).valid, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("composition tooling is offline and powerless", () => {
  const sources = [
    "settlement-contention-compositions.mjs",
    "generate-settlement-contention-composition-vectors.mjs",
    "validate-settlement-contention-composition-vectors.mjs",
    "verify-settlement-contention-vectors.py",
  ].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
  assert.doesNotMatch(sources, /\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/);
});

test("composition files are review-manifest covered", () => {
  const expected = {
    "generate-settlement-contention-composition-vectors.mjs": "GENERATOR",
    "settlement-contention-composition-vectors.v1.json": "ARTIFACT",
    "settlement-contention-compositions.mjs": "SUPPORTING_SOURCE",
    "tests/settlement-contention-compositions.test.mjs": "TEST",
    "validate-settlement-contention-composition-vectors.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
});

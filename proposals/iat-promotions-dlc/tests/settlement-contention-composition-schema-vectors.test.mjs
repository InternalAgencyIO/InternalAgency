/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateCompositionSchemaVectors } from "../generate-settlement-contention-composition-schema-vectors.mjs";
import {
  COMPOSITION_SCHEMA_MUTATION_DEFINITIONS,
  evaluateCompositionSchemaMutation,
} from "../settlement-contention-composition-schema-mutations.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  loadCompositionSchemaVectorBundle,
  validateCompositionSchemaVectors,
} from "../validate-settlement-contention-composition-schema-vectors.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-vectors.py", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const bundle = loadCompositionSchemaVectorBundle();
const artifact = bundle.artifact;

test("composition schema diagnostic vectors deterministically regenerate", () => {
  assert.deepEqual(validateCompositionSchemaVectors(bundle), []);
  assert.deepEqual(generateCompositionSchemaVectors(), artifact);
  assert.equal(artifact.cases.length, 12);
  assert.equal(artifact.summary.commonReplayCommitmentSha256,
    "177a1030a7606fd8370310b237ddf2cf0c25e62870741a72c709caf312ea2118");
});

test("schema mutation corpus covers closed shape, HOLD, capability, authority, cardinality, hex, and enum families", () => {
  assert.deepEqual([...new Set(artifact.cases.map((item) => item.family))].sort(), [
    "AUTHORITY", "CANONICAL_HEX", "CAPABILITY", "CARDINALITY", "CLOSED_CASE",
    "CLOSED_REMOVAL", "CLOSED_ROOT", "GATE_ENUM", "HOLD_STATUS",
  ]);
});

test("every exact diagnostic carries JSON Pointer and schema-keyword provenance", () => {
  for (const entry of artifact.cases) {
    assert.ok(entry.diagnostics.length > 0, entry.caseId);
    for (const diagnostic of entry.diagnostics) {
      assert.match(diagnostic.instancePath, /^\//);
      assert.match(diagnostic.schemaPath, /^#\//);
      assert.ok(diagnostic.keyword.length > 0);
      assert.ok(diagnostic.message.length > 0);
    }
  }
});

test("all twelve runtime-only Node candidates reject the closed schema", () => {
  for (const definition of COMPOSITION_SCHEMA_MUTATION_DEFINITIONS) {
    const result = evaluateCompositionSchemaMutation(bundle.base, bundle.schema, definition);
    assert.ok(result.diagnostics.length > 0, definition.caseId);
    assert.equal(result.commonReplayRecord.accepted, false);
  }
});

test("independent Python reproduces every exact diagnostic and common commitment", () => {
  assert.ok(PYTHON, "Python 3 is required for schema diagnostic parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-composition-schema-vectors", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.compositionSchemaCaseCount, 12);
  assert.equal(report.exactDiagnosticsMatched, true);
  assert.equal(report.commonReplayCommitmentSha256, artifact.summary.commonReplayCommitmentSha256);
});

test("independent Python rejects a changed exact diagnostic with exit 2", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-composition-schema-vectors-"));
  try {
    const changed = structuredClone(artifact);
    changed.cases[0].diagnostics[0].instancePath = "/wrong";
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-composition-schema-vectors", "--composition-schema-vectors", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("exact diagnostic drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("published schema diagnostic evidence stores no runtime candidate or authority", () => {
  assert.equal(artifact.contract.mutatedCandidatesRuntimeOnly, true);
  assert.equal(artifact.status.network, "NONE");
  assert.equal(Object.hasOwn(artifact, "candidates"), false);
  for (const entry of artifact.cases) {
    assert.equal(Object.hasOwn(entry, "candidate"), false);
    assert.equal(entry.runtimeCandidateStored, false);
    assert.equal(entry.receiptIssued, false);
    assert.equal(entry.reviewCompleted, false);
    assert.equal(entry.activationAuthorized, false);
  }
});

test("schema diagnostic tooling is offline, powerless, and manifest-covered", () => {
  const expected = {
    "generate-settlement-contention-composition-schema-vectors.mjs": "GENERATOR",
    "settlement-contention-composition-schema-mutations.mjs": "SUPPORTING_SOURCE",
    "settlement-contention-composition-schema-vectors.v1.json": "ARTIFACT",
    "tests/settlement-contention-composition-schema-vectors.test.mjs": "TEST",
    "validate-settlement-contention-composition-schema-vectors.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  const sources = Object.keys(expected).filter((path) => /\.(mjs|py)$/.test(path) && !path.startsWith("tests/"))
    .map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

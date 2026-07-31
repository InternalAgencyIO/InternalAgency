/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { applyJsonPointerMutation, validateJsonSchemaSubset } from "../json-schema-subset.mjs";
import {
  CONTENTION_COMPOSITION_DEFINITIONS,
  evaluateContentionCompositionRemoval,
} from "../settlement-contention-compositions.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import { loadSettlementContentionCompositionVectorBundle } from "../validate-settlement-contention-composition-vectors.mjs";
import { loadSettlementContentionVectorBundle } from "../validate-settlement-contention-vectors.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-vectors.py", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const { artifact, schema } = loadSettlementContentionCompositionVectorBundle();
const baseBundle = loadSettlementContentionVectorBundle();

test("closed Draft-07 subset accepts the compact composition artifact", () => {
  assert.deepEqual(validateJsonSchemaSubset(schema, artifact), []);
  assert.equal(artifact.cases.length, 28);
  assert.equal(artifact.summary.removalCheckCount, "56");
  assert.equal(artifact.summary.allRemovalsMinimal, true);
});

test("closed schema rejects unknown root, case, and removal properties", () => {
  for (const mutation of [
    { operation: "add", path: "/candidate", value: {} },
    { operation: "add", path: "/cases/0/expandedState", value: {} },
    { operation: "add", path: "/cases/0/removalChecks/0/trace", value: [] },
  ]) {
    const changed = applyJsonPointerMutation(artifact, mutation);
    assert.ok(validateJsonSchemaSubset(schema, changed).some((error) => error.keyword === "additionalProperties"));
  }
});

test("closed schema rejects released status and operational authority", () => {
  for (const mutation of [
    { operation: "replace", path: "/status/network", value: "MAINNET" },
    { operation: "replace", path: "/contract/usesRpc", value: true },
    { operation: "replace", path: "/contract/usesWallet", value: true },
    { operation: "replace", path: "/contract/preparesTransactions", value: true },
    { operation: "replace", path: "/contract/activationAuthorized", value: true },
    { operation: "replace", path: "/summary/reviewCompleted", value: true },
  ]) {
    assert.ok(validateJsonSchemaSubset(schema, applyJsonPointerMutation(artifact, mutation)).length > 0);
  }
});

test("all 56 removal candidates expose only the remaining gate and reject", () => {
  let count = 0;
  for (const definition of CONTENTION_COMPOSITION_DEFINITIONS) {
    for (const removedGate of definition.expectedGates) {
      const result = evaluateContentionCompositionRemoval(baseBundle, definition, removedGate);
      assert.deepEqual(result.observedGates, [result.remainingGate], `${definition.caseId}:${removedGate}`);
      assert.ok(result.semanticErrors.length > 0, `${definition.caseId}:${removedGate}`);
      assert.equal(result.accepted, false);
      count += 1;
    }
  }
  assert.equal(count, 56);
});

test("independent Python rejects changed compact removal evidence with exit 2", () => {
  assert.ok(PYTHON, "Python 3 is required for removal replay");
  const directory = mkdtempSync(join(tmpdir(), "iat-contention-removal-proof-"));
  try {
    const changed = structuredClone(artifact);
    changed.cases[0].removalChecks[0].remainingGate = "SOURCE_BINDING";
    const path = join(directory, "changed-removal.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-composition-vectors", "--composition-vectors", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((error) => error.includes("removal proof drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("composition schema and removal proof are manifest-covered and powerless", () => {
  const expected = {
    "settlement-contention-composition-vectors.schema.v1.json": "ARTIFACT",
    "tests/settlement-contention-composition-schema.test.mjs": "TEST",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  const source = readFileSync(fileURLToPath(new URL("../settlement-contention-compositions.mjs", import.meta.url)), "utf8");
  assert.doesNotMatch(source, /\bfetch\s*\(|\bWebSocket\s*\(|sendTransaction|wallet-adapter/);
  assert.doesNotMatch(source, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

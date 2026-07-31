/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { loadReviewManifest } from "../validate-review-manifest.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-review-manifest.py", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);

test("independent zero-dependency Python verifier reproduces the Node review root", () => {
  assert.ok(PYTHON, "Python 3 is required for independent manifest verification");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.deepEqual(report.errors, []);
  assert.equal(report.treeRootSha256, loadReviewManifest().treeRootSha256);
});

test("independent Python verifier rejects a stale content digest and intermediate vector", () => {
  assert.ok(PYTHON, "Python 3 is required for independent manifest verification");
  const directory = mkdtempSync(join(tmpdir(), "iat-python-review-"));
  try {
    const mutated = structuredClone(loadReviewManifest());
    mutated.entries[0].contentSha256 = "f".repeat(64);
    mutated.merkleVectors.intermediateLevels[0].nodeSha256[0] = "0".repeat(64);
    const manifestPath = join(directory, "mutated-review-manifest.json");
    writeFileSync(manifestPath, `${JSON.stringify(mutated, null, 2)}\n`, "utf8");
    const result = spawnSync(
      PYTHON,
      [VERIFIER, "--root", ROOT, "--manifest", manifestPath, "--json"],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((error) => error.includes("independent deterministic Python generation")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the independent verifier is itself covered as a validator", () => {
  const entry = loadReviewManifest().entries.find((candidate) => candidate.path === "verify-review-manifest.py");
  assert.ok(entry);
  assert.equal(entry.role, "VALIDATOR");
  assert.match(entry.contentSha256, /^[0-9a-f]{64}$/);
  assert.match(entry.leafSha256, /^[0-9a-f]{64}$/);
});

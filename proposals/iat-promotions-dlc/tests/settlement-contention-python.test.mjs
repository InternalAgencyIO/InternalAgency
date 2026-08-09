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

import { canonicalSha256 } from "../compose-program-interface-preview.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import { loadSettlementContentionVectorBundle } from "../validate-settlement-contention-vectors.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-vectors.py", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadSettlementContentionVectorBundle().artifact;

function run(candidate) {
  const directory = mkdtempSync(join(tmpdir(), "iat-contention-python-"));
  try {
    const path = join(directory, "candidate.json");
    writeFileSync(path, `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--artifact", path, "--json"], { encoding: "utf8" });
    return { ...result, report: JSON.parse(result.stdout) };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("independent zero-dependency Python replay reproduces all compact outcomes", () => {
  assert.ok(PYTHON, "Python 3 is required for independent contention replay");
  const result = run(artifact);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.report.valid, true);
  assert.deepEqual(result.report.errors, []);
  assert.equal(result.report.scenarioCount, 6);
  assert.equal(result.report.scenarioSetCommitmentSha256,
    "87dad1a11f005cbb3ea25a857026a6a009522a1a6f735e428e7bba45e510f7d8");
  assert.match(result.report.replayCommitmentSha256, /^[0-9a-f]{64}$/);
});

test("Python replay rejects changed economics despite recomputed public commitments", () => {
  const changed = structuredClone(artifact);
  changed.scenarios[0].winnerHeroBalanceBaseUnits = "119999999999";
  const { scenarioCommitmentSha256: ignored, ...core } = changed.scenarios[0];
  changed.scenarios[0].scenarioCommitmentSha256 = canonicalSha256(core);
  changed.summary.scenarioSetCommitmentSha256 = canonicalSha256(
    changed.scenarios.map((scenario) => scenario.scenarioCommitmentSha256),
  );
  const result = run(changed);
  assert.equal(result.status, 1);
  assert.equal(result.report.valid, false);
  assert.ok(result.report.errors.some((error) => error.includes("winnerHeroBalanceBaseUnits")));
});

test("Python replay rejects expanded schedules and unknown properties", () => {
  const changed = structuredClone(artifact);
  changed.scenarios[0].expandedTimeline = ["not publishable"];
  const result = run(changed);
  assert.equal(result.status, 1);
  assert.ok(result.report.errors.some((error) => error.includes("closed-property mismatch")));
  assert.equal(result.report.expandedSchedulesStored, false);
});

test("Python replay rejects source-binding drift without executing proposal code", () => {
  const changed = structuredClone(artifact);
  changed.sources.contentionModel.normalizedTextSha256 = "0".repeat(64);
  const result = run(changed);
  assert.equal(result.status, 1);
  assert.ok(result.report.errors.some((error) => error.includes("sources.contentionModel digest drift")));
});

test("Python verifier stays offline, powerless, and manifest-covered", () => {
  const source = readFileSync(VERIFIER, "utf8");
  assert.doesNotMatch(source, /\brequests\b|\burllib\b|\bsocket\b|\bwebsocket\b/i);
  assert.doesNotMatch(source, /wallet-adapter|sendTransaction|solana-test-validator/);
  assert.doesNotMatch(source, /api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
  assert.doesNotMatch(source, /generateKeyPair|createPrivateKey|\bsign\s*\(/);
  const entry = loadReviewManifest().entries.find((candidate) => candidate.path === "verify-settlement-contention-vectors.py");
  assert.ok(entry);
  assert.equal(entry.role, "VALIDATOR");
});

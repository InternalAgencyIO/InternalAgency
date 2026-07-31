/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { renderReviewerInputPreflight } from "../reviewer-bundle-preflight.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import { loadReviewerBundlePreflightBundle } from "../validate-reviewer-bundle-preflight-vectors.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-reviewer-bundle-preflight.py", import.meta.url));
const SOURCE = readFileSync(VERIFIER, "utf8");
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) =>
  spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const bundle = loadReviewerBundlePreflightBundle();
const pythonOptions = {
  encoding: "utf8",
  env: { ...process.env, PYTHONUTF8: "1" },
};

function withScenarioFiles(scenario, run) {
  const directory = mkdtempSync(join(tmpdir(), "iat-python-preflight-"));
  try {
    const candidatePath = join(directory, "candidate.json");
    const targetPath = join(directory, "target.json");
    writeFileSync(candidatePath, JSON.stringify(scenario.candidate), "utf8");
    writeFileSync(targetPath, JSON.stringify(scenario.expectedTarget), "utf8");
    return run(candidatePath, targetPath);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function runScenario(scenario, format) {
  return withScenarioFiles(scenario, (candidatePath, targetPath) => spawnSync(
    PYTHON,
    [
      VERIFIER,
      "--candidate", candidatePath,
      "--expected-target", targetPath,
      "--format", format,
    ],
    pythonOptions,
  ));
}

test("independent Python verifier reproduces every fixed preflight vector", () => {
  assert.ok(PYTHON, "Python 3 is required for independent preflight verification");
  const result = spawnSync(
    PYTHON,
    [VERIFIER, "--verify-vectors", "--format", "json"],
    pythonOptions,
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    valid: true,
    errors: [],
    scenarioCount: 10,
  });
});

test("Python and Node produce identical result objects for all ten scenarios", () => {
  assert.ok(PYTHON, "Python 3 is required for independent preflight verification");
  for (const scenario of bundle.vectors.scenarios) {
    const result = runScenario(scenario, "json");
    assert.equal(result.status, scenario.expectedStructuralValid ? 0 : 3, scenario.name);
    assert.deepEqual(JSON.parse(result.stdout), scenario.result, scenario.name);
  }
});

test("Python and Node produce identical normalized Markdown diagnostics", () => {
  assert.ok(PYTHON, "Python 3 is required for independent preflight verification");
  for (const scenario of bundle.vectors.scenarios) {
    const result = runScenario(scenario, "markdown");
    assert.equal(result.status, scenario.expectedStructuralValid ? 0 : 3, scenario.name);
    assert.equal(
      result.stdout.replace(/\r\n/g, "\n"),
      renderReviewerInputPreflight(scenario.result),
      scenario.name,
    );
  }
});

test("independent vector verification rejects one changed diagnostic", () => {
  assert.ok(PYTHON, "Python 3 is required for independent preflight verification");
  const directory = mkdtempSync(join(tmpdir(), "iat-python-vector-"));
  try {
    const mutated = structuredClone(bundle.vectors);
    mutated.scenarios[1].result.documents[0].errors[0].message = "changed diagnostic";
    const vectorPath = join(directory, "mutated-vectors.json");
    writeFileSync(vectorPath, `${JSON.stringify(mutated, null, 2)}\n`, "utf8");
    const result = spawnSync(
      PYTHON,
      [VERIFIER, "--verify-vectors", "--vectors", vectorPath, "--format", "json"],
      pythonOptions,
    );
    assert.equal(result.status, 1, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.valid, false);
    assert.ok(report.errors.some((error) => error.includes(mutated.scenarios[1].name)));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("Python CLI fails malformed offline usage with exit 1", () => {
  assert.ok(PYTHON, "Python 3 is required for independent preflight verification");
  const result = spawnSync(
    PYTHON,
    [VERIFIER, "--candidate", "candidate-only.json", "--format", "json"],
    pythonOptions,
  );
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /both --candidate and --expected-target are required/);
});

test("independent Python preflight is local-read-only, non-authoritative, and reviewed", () => {
  assert.doesNotMatch(SOURCE, /^\s*(?:from|import)\s+(?:urllib|socket|subprocess|requests|httpx|websockets|solana|nacl|cryptography)\b/m);
  assert.doesNotMatch(SOURCE, /\b(?:write_text|write_bytes|urlopen|connect|send|sign|generate_key)\s*\(/);
  for (const scenario of bundle.vectors.scenarios) {
    assert.equal(scenario.result.semanticEvaluationRan, false, scenario.name);
    assert.equal(scenario.result.receiptIssued, false, scenario.name);
    assert.equal(scenario.result.reviewCompletedByThisPreflight, false, scenario.name);
    assert.equal(scenario.result.activationAuthorized, false, scenario.name);
    assert.equal(scenario.result.activationEffect, "NONE", scenario.name);
  }
  const entry = loadReviewManifest().entries.find((candidate) =>
    candidate.path === "verify-reviewer-bundle-preflight.py");
  assert.ok(entry);
  assert.equal(entry.role, "VALIDATOR");
});

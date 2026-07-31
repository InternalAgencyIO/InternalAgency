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

import { loadReviewManifest } from "../validate-review-manifest.mjs";
import { loadPositiveCampaignVectorIntakeBundle } from "../validate-positive-campaign-vector-intake-vectors.mjs";

const VERIFIER = fileURLToPath(
  new URL("../verify-positive-campaign-vector-intake.py", import.meta.url),
);
const SOURCE = readFileSync(VERIFIER, "utf8");
const bundle = loadPositiveCampaignVectorIntakeBundle();
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) =>
  spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const pythonOptions = {
  encoding: "utf8",
  env: { ...process.env, PYTHONUTF8: "1" },
};

function runVectors(path = null, format = "json") {
  const args = [VERIFIER, "--verify-vectors", "--format", format];
  if (path !== null) args.push("--vectors", path);
  return spawnSync(PYTHON, args, pythonOptions);
}

function withMutatedVectors(mutate, run) {
  const directory = mkdtempSync(join(tmpdir(), "iat-positive-intake-python-"));
  try {
    const vectors = structuredClone(bundle.vectors);
    mutate(vectors);
    const path = join(directory, "vectors.json");
    writeFileSync(path, `${JSON.stringify(vectors, null, 2)}\n`, "utf8");
    return run(path, vectors);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test("independent Python verifier reproduces all ten intake scenarios and both RFC controls", () => {
  assert.ok(PYTHON, "Python 3 is required for independent intake verification");
  const result = runVectors();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    valid: true,
    errors: [],
    scenarioCount: 10,
    positivePrimitiveControlCount: 2,
    receiptIssued: false,
    reviewCompleted: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  });
});

test("independent verifier rejects and names a changed published gate result", () => {
  assert.ok(PYTHON, "Python 3 is required for independent intake verification");
  withMutatedVectors(
    (vectors) => {
      vectors.scenarios[3].expectedResult.gates[4].detail = "CHANGED_DETAIL";
    },
    (path, vectors) => {
      const result = runVectors(path);
      assert.equal(result.status, 2, result.stderr || result.stdout);
      const report = JSON.parse(result.stdout);
      assert.equal(report.valid, false);
      assert.ok(report.errors.some((error) => error.includes(vectors.scenarios[3].name)));
    },
  );
});

test("independent verifier rejects candidate drift against stale Node evidence", () => {
  assert.ok(PYTHON, "Python 3 is required for independent intake verification");
  withMutatedVectors(
    (vectors) => {
      vectors.scenarios[0].candidate.campaignVector.claimedCanonicalMessageSha256 = "a".repeat(64);
    },
    (path, vectors) => {
      const result = runVectors(path);
      assert.equal(result.status, 2, result.stderr || result.stdout);
      const report = JSON.parse(result.stdout);
      assert.ok(report.errors.some((error) => error.includes(vectors.scenarios[0].name)));
    },
  );
});

test("released HOLD or authority claims fail independent verification", () => {
  assert.ok(PYTHON, "Python 3 is required for independent intake verification");
  withMutatedVectors(
    (vectors) => {
      vectors.status.positiveVectorIntegrationBlocked = false;
      vectors.contract.activationAuthorized = true;
      vectors.contract.activationEffect = "DEPLOY";
    },
    (path) => {
      const result = runVectors(path);
      assert.equal(result.status, 2, result.stderr || result.stdout);
      const report = JSON.parse(result.stdout);
      assert.ok(report.errors.some((error) => error.includes("HOLD was released")));
      assert.ok(report.errors.some((error) => error.includes("activationAuthorized")));
      assert.ok(report.errors.some((error) => error.includes("activation effect")));
    },
  );
});

test("Python CLI gives exit 1 for invalid usage and malformed JSON", () => {
  assert.ok(PYTHON, "Python 3 is required for independent intake verification");
  const usage = spawnSync(PYTHON, [VERIFIER, "--format", "json"], pythonOptions);
  assert.equal(usage.status, 1);
  assert.equal(usage.stdout, "");
  assert.match(usage.stderr, /exactly one of --verify-vectors or --verify-differential-vectors is required/);
  const directory = mkdtempSync(join(tmpdir(), "iat-positive-intake-json-"));
  try {
    const path = join(directory, "malformed.json");
    writeFileSync(path, "{", "utf8");
    const malformed = runVectors(path);
    assert.equal(malformed.status, 1);
    assert.equal(malformed.stdout, "");
    assert.match(malformed.stderr, /Unable to read public intake vectors/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("independent verifier is local-read-only and cryptographic verification-only", () => {
  assert.doesNotMatch(
    SOURCE,
    /^\s*(?:from|import)\s+(?:urllib|socket|subprocess|requests|httpx|websockets|solana|nacl|cryptography)\b/m,
  );
  assert.doesNotMatch(
    SOURCE,
    /\b(?:write_text|write_bytes|urlopen|connect|send|sign|generate_key)\s*\(/,
  );
  assert.doesNotMatch(SOURCE, /wallet-adapter|window\.solana|sendTransaction|mainnet|devnet/);
  for (const scenario of bundle.vectors.scenarios) {
    assert.equal(scenario.expectedResult.receiptIssued, false, scenario.name);
    assert.equal(scenario.expectedResult.reviewCompletedByThisEvaluator, false, scenario.name);
    assert.equal(scenario.expectedResult.activationAuthorized, false, scenario.name);
    assert.equal(scenario.expectedResult.activationEffect, "NONE", scenario.name);
  }
});

test("independent intake verifier is content-addressed as a validator", () => {
  const entry = loadReviewManifest().entries.find((candidate) =>
    candidate.path === "verify-positive-campaign-vector-intake.py");
  assert.ok(entry);
  assert.equal(entry.role, "VALIDATOR");
});

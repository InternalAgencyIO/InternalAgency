/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateDiagnosticRepresentationAudit } from "../generate-settlement-contention-composition-diagnostic-representation-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  loadDiagnosticRepresentationAuditBundle,
  validateDiagnosticRepresentationAudit,
} from "../validate-settlement-contention-composition-diagnostic-representation-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-vectors.py", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const bundle = loadDiagnosticRepresentationAuditBundle();
const artifact = bundle.artifact;

test("diagnostic representation audit deterministically regenerates", () => {
  assert.deepEqual(validateDiagnosticRepresentationAudit(bundle), []);
  assert.deepEqual(generateDiagnosticRepresentationAudit(), artifact);
  assert.equal(artifact.summary.commonReplayCommitmentSha256,
    "e878654551b14af9516e725230dadabdca72433890ff6c8a67cfbba111d0a68a");
});

test("audit covers all twelve mutations across exactly three representations", () => {
  assert.equal(artifact.cases.length, 12);
  assert.equal(artifact.cases.flatMap((entry) => entry.representations).length, 36);
  for (const entry of artifact.cases) {
    assert.deepEqual(entry.representations.map((trial) => trial.representationId), ["BASE_LF", "REVERSED_KEYS_LF", "BASE_CRLF"]);
  }
});

test("raw representation digests remain distinct within every mutation case", () => {
  for (const entry of artifact.cases) {
    assert.equal(new Set(entry.representations.map((trial) => trial.representationSha256)).size, 3, entry.caseId);
  }
  assert.equal(artifact.summary.allRepresentationDigestsDistinctWithinCase, true);
});

test("canonical candidates and exact diagnostics remain stable across representations", () => {
  for (const entry of artifact.cases) {
    const [baseline, ...others] = entry.representations;
    for (const trial of others) {
      assert.equal(trial.candidateCommitmentSha256, baseline.candidateCommitmentSha256, entry.caseId);
      assert.deepEqual(trial.diagnostics, baseline.diagnostics, entry.caseId);
      assert.equal(trial.diagnosticCommitmentSha256, baseline.diagnosticCommitmentSha256, entry.caseId);
      assert.equal(trial.accepted, false);
    }
  }
});

test("LF and CRLF bytes differ without changing parsed rejection evidence", () => {
  for (const entry of artifact.cases) {
    const lf = entry.representations[0];
    const crlf = entry.representations[2];
    assert.notEqual(lf.representationSha256, crlf.representationSha256, entry.caseId);
    assert.equal(lf.candidateCommitmentSha256, crlf.candidateCommitmentSha256, entry.caseId);
    assert.deepEqual(lf.diagnostics, crlf.diagnostics, entry.caseId);
  }
});

test("independent Python reproduces all 36 trials and common commitment", () => {
  assert.ok(PYTHON, "Python 3 is required for diagnostic representation parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-diagnostic-representation-audit", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.trialCount, 36);
  assert.equal(report.allDiagnosticsStable, true);
  assert.equal(report.commonReplayCommitmentSha256, artifact.summary.commonReplayCommitmentSha256);
});

test("independent Python rejects changed representation evidence with exit 2", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-diagnostic-representations-"));
  try {
    const changed = structuredClone(artifact);
    changed.cases[0].representations[1].representationSha256 = "f".repeat(64);
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-diagnostic-representation-audit", "--diagnostic-representation-audit", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("representation trial drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("representation tooling is compact, offline, powerless, and manifest-covered", () => {
  const expected = {
    "generate-settlement-contention-composition-diagnostic-representation-audit.mjs": "GENERATOR",
    "settlement-contention-composition-diagnostic-representation-audit.v1.json": "ARTIFACT",
    "settlement-contention-composition-diagnostic-representations.mjs": "SUPPORTING_SOURCE",
    "tests/settlement-contention-diagnostic-representation-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-diagnostic-representation-audit.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  assert.equal(artifact.contract.serializedRepresentationsStored, false);
  assert.equal(artifact.contract.runtimeCandidatesStored, false);
  const sources = Object.keys(expected).filter((path) => path.endsWith(".mjs") && !path.startsWith("tests/"))
    .map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

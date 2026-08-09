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

import { generateReviewerBundleGateReport } from "../generate-reviewer-bundle-gate-report.mjs";
import {
  lintReviewerBundle,
  renderReviewerBundleGateReport,
  REVIEW_GATE_DEFINITIONS,
} from "../reviewer-bundle-linter.mjs";
import { validateReviewerBundleGateReport } from "../validate-reviewer-bundle-gate-report.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const LINTER_PATH = fileURLToPath(new URL("../reviewer-bundle-linter.mjs", import.meta.url));
const REPORT_PATH = fileURLToPath(new URL("../reviewer-bundle-gate-report.v1.md", import.meta.url));
const VECTOR_PATH = fileURLToPath(
  new URL("../independent-review-receipt-acceptance-vectors.v1.json", import.meta.url),
);
const TEMPLATE_PATH = fileURLToPath(new URL("../independent-review-receipt-template.v1.json", import.meta.url));
const vectors = JSON.parse(readFileSync(VECTOR_PATH, "utf8"));
const receiptTemplate = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
const base = vectors.scenarios[0];
const clone = (value) => structuredClone(value);

test("public human-readable gate report reproduces exactly", () => {
  assert.deepEqual(validateReviewerBundleGateReport(), []);
  assert.equal(readFileSync(REPORT_PATH, "utf8"), generateReviewerBundleGateReport());
});

test("public bundle exposes five passes and one visible cryptographic failure", () => {
  const report = lintReviewerBundle(base.candidate, base.expectedTarget, receiptTemplate);
  assert.deepEqual(report.summary, {
    outcome: "CANDIDATE_REJECTED",
    passedGateCount: "5",
    failedGateCount: "1",
    totalGateCount: "6",
  });
  assert.equal(report.gates.find((gate) => gate.id === "CRYPTOGRAPHIC_ATTESTATION").result, "FAIL");
  assert.deepEqual(report.failures, [{
    gate: "CRYPTOGRAPHIC_ATTESTATION",
    detail: "INVALID_EXTERNAL_SIGNATURE",
  }]);
});

test("gate order is fixed and renderer preserves every gate", () => {
  const report = lintReviewerBundle(base.candidate, base.expectedTarget, receiptTemplate);
  assert.deepEqual(report.gates.map((gate) => gate.id), REVIEW_GATE_DEFINITIONS.map(([id]) => id));
  const markdown = renderReviewerBundleGateReport(report);
  for (const gate of report.gates) assert.match(markdown, new RegExp(`\\| ${gate.label} \\| \\*\\*${gate.result}\\*\\* \\|`));
});

test("candidate, expected target, and receipt template receive distinct stable commitments", () => {
  const first = lintReviewerBundle(base.candidate, base.expectedTarget, receiptTemplate);
  const second = lintReviewerBundle(clone(base.candidate), clone(base.expectedTarget), clone(receiptTemplate));
  assert.deepEqual(first.inputBindings, second.inputBindings);
  assert.equal(new Set(Object.values(first.inputBindings)).size, 3);
  const changed = clone(base.candidate);
  changed.target.gitCommitSha = "0".repeat(40);
  const changedReport = lintReviewerBundle(changed, base.expectedTarget, receiptTemplate);
  assert.notEqual(changedReport.inputBindings.candidateCanonicalSha256, first.inputBindings.candidateCanonicalSha256);
});

test("malformed programmatic input fails closed without authority claims", () => {
  const report = lintReviewerBundle(undefined, base.expectedTarget, receiptTemplate);
  assert.equal(report.candidateSatisfiesPolicy, false);
  assert.equal(report.receiptIssued, false);
  assert.equal(report.reviewCompletedByThisLinter, false);
  assert.equal(report.activationAuthorized, false);
  assert.equal(report.activationEffect, "NONE");
  assert.equal(report.inputBindings.candidateCanonicalSha256, null);
});

test("separately supplied expected-target mismatch remains rejected", () => {
  const expectedTarget = clone(base.expectedTarget);
  expectedTarget.reviewTreeRootSha256 = "0".repeat(64);
  const report = lintReviewerBundle(base.candidate, expectedTarget, receiptTemplate);
  assert.equal(report.candidateSatisfiesPolicy, false);
  assert.equal(report.gates.find((gate) => gate.id === "TARGET_BINDING").result, "FAIL");
});

test("every public scenario remains rejected, unissued, and non-activating", () => {
  for (const scenario of vectors.scenarios) {
    const report = lintReviewerBundle(scenario.candidate, scenario.expectedTarget, receiptTemplate);
    assert.equal(report.candidateSatisfiesPolicy, false, scenario.name);
    assert.equal(report.receiptIssued, false, scenario.name);
    assert.equal(report.reviewCompletedByThisLinter, false, scenario.name);
    assert.equal(report.activationAuthorized, false, scenario.name);
    assert.equal(report.activationEffect, "NONE", scenario.name);
  }
});

test("CLI returns rejection status 2 and a human-readable report", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-review-lint-"));
  try {
    const candidatePath = join(directory, "candidate.json");
    const targetPath = join(directory, "target.json");
    writeFileSync(candidatePath, JSON.stringify(base.candidate), "utf8");
    writeFileSync(targetPath, JSON.stringify(base.expectedTarget), "utf8");
    const result = spawnSync(process.execPath, [
      LINTER_PATH,
      "--candidate", candidatePath,
      "--expected-target", targetPath,
      "--format", "markdown",
    ], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stdout, /Candidate policy result: \*\*CANDIDATE_REJECTED\*\*/);
    assert.match(result.stdout, /Receipt issued: \*\*false\*\*/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("CLI JSON output is machine-readable and malformed JSON exits 1", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-review-lint-"));
  try {
    const candidatePath = join(directory, "candidate.json");
    const targetPath = join(directory, "target.json");
    writeFileSync(candidatePath, JSON.stringify(base.candidate), "utf8");
    writeFileSync(targetPath, JSON.stringify(base.expectedTarget), "utf8");
    const valid = spawnSync(process.execPath, [
      LINTER_PATH,
      "--candidate", candidatePath,
      "--expected-target", targetPath,
      "--format", "json",
    ], { encoding: "utf8" });
    assert.equal(valid.status, 2);
    assert.equal(JSON.parse(valid.stdout).activationEffect, "NONE");
    writeFileSync(candidatePath, "{", "utf8");
    const malformed = spawnSync(process.execPath, [
      LINTER_PATH,
      "--candidate", candidatePath,
      "--expected-target", targetPath,
    ], { encoding: "utf8" });
    assert.equal(malformed.status, 1);
    assert.equal(malformed.stdout, "");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("linter source has local-read-only capability and no signing or network path", () => {
  const source = readFileSync(LINTER_PATH, "utf8");
  assert.doesNotMatch(source, /\bwriteFile|\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(|\bfetch\s*\(|\bWebSocket\s*\(/);
  const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(imports, [
    "node:fs",
    "node:url",
    "./compose-program-interface-preview.mjs",
    "./independent-review-receipt-acceptance.mjs",
    "./reviewer-bundle-preflight.mjs",
  ]);
  assert.match(source, /readFileSync/);
  assert.ok(LINTER_PATH.startsWith(ROOT));
});

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

import { FUZZ_FAMILIES } from "../generate-positive-campaign-vector-intake-fuzz-vectors.mjs";
import {
  generatePositiveCampaignVectorRepresentationAudit,
  replayPositiveCampaignVectorRepresentationAudit,
} from "../generate-positive-campaign-vector-representation-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  loadPositiveCampaignVectorRepresentationAuditBundle,
  validatePositiveCampaignVectorRepresentationAudit,
} from "../validate-positive-campaign-vector-representation-audit.mjs";

const PYTHON_VERIFIER = fileURLToPath(new URL("../verify-positive-campaign-vector-intake.py", import.meta.url));
const GENERATOR = fileURLToPath(new URL("../generate-positive-campaign-vector-representation-audit.mjs", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const pythonOptions = { encoding: "utf8", env: { ...process.env, PYTHONUTF8: "1" } };
const bundle = loadPositiveCampaignVectorRepresentationAuditBundle();
const artifact = bundle.artifact;

function runPython(path = null) {
  const args = [PYTHON_VERIFIER, "--verify-representation-audit", "--format", "json"];
  if (path !== null) args.push("--representation-audit", path);
  return spawnSync(PYTHON, args, pythonOptions);
}

test("the compact 256-input representation audit deterministically regenerates", () => {
  assert.deepEqual(validatePositiveCampaignVectorRepresentationAudit(bundle), []);
  assert.deepEqual(generatePositiveCampaignVectorRepresentationAudit(), artifact);
  assert.deepEqual(replayPositiveCampaignVectorRepresentationAudit().records, artifact.records);
  assert.equal(artifact.records.length, 256);
});

test("all 256 insertion-order-sensitive input commitments are unique", () => {
  assert.equal(new Set(artifact.records.map((record) => record.orderedInputSha256)).size, 256);
  assert.ok(artifact.records.every((record) => record.orderedInputUnique && record.orderedClassSize === "1"));
});

test("only the 26 expected-target permutations share a canonical class", () => {
  assert.equal(artifact.summary.canonicalUniqueCount, "231");
  assert.equal(artifact.canonicalCollisionClasses.length, 1);
  const collision = artifact.canonicalCollisionClasses[0];
  assert.equal(collision.classSize, "26");
  assert.deepEqual(collision.families, ["EXPECTED_TARGET"]);
  assert.equal(collision.orderedCommitmentsAllDistinct, true);
});

test("every compact record remains source-bound and rejection-only", () => {
  for (const record of artifact.records) {
    assert.match(record.sourceCaseCommitmentSha256, /^[0-9a-f]{64}$/);
    assert.equal(record.inputOrResultStored, false);
    assert.equal(record.accepted, false);
    assert.equal(record.receiptIssued, false);
    assert.equal(record.reviewCompleted, false);
    assert.equal(record.activationAuthorized, false);
    assert.equal(record.activationEffect, "NONE");
  }
});

test("every family appears and only target permutations collide canonically", () => {
  assert.deepEqual([...new Set(artifact.records.map((record) => record.family))], FUZZ_FAMILIES);
  for (const record of artifact.records) {
    assert.equal(record.canonicalCollisionExpected, record.family === "EXPECTED_TARGET");
    assert.equal(record.canonicalClassSize, record.family === "EXPECTED_TARGET" ? "26" : "1");
  }
});

test("Python independently reproduces the representation audit", () => {
  assert.ok(PYTHON, "Python 3 is required for representation verification");
  const result = runPython();
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.deepEqual(JSON.parse(result.stdout), {
    valid: true,
    errors: [],
    caseCount: 256,
    canonicalUniqueCount: 231,
    orderedUniqueCount: 256,
    expectedCanonicalCollisionClassCount: 1,
    nodeAndPythonMatchExactly: true,
    allRejected: true,
    auditRecordSetCommitmentSha256: artifact.summary.auditRecordSetCommitmentSha256,
    receiptIssued: false,
    reviewCompleted: false,
    activationAuthorized: false,
    activationEffect: "NONE",
  });
});

test("Python rejects changed compact evidence and a stale set commitment", () => {
  assert.ok(PYTHON, "Python 3 is required for representation verification");
  const directory = mkdtempSync(join(tmpdir(), "iat-representation-audit-"));
  try {
    const changedRecord = structuredClone(artifact);
    changedRecord.records[87].orderedInputSha256 = "f".repeat(64);
    const recordPath = join(directory, "changed-record.json");
    writeFileSync(recordPath, `${JSON.stringify(changedRecord, null, 2)}\n`, "utf8");
    const recordResult = runPython(recordPath);
    assert.equal(recordResult.status, 2, recordResult.stderr || recordResult.stdout);
    assert.ok(JSON.parse(recordResult.stdout).errors.some((error) => error.includes("independently replay")));

    const changedSet = structuredClone(artifact);
    changedSet.summary.auditRecordSetCommitmentSha256 = "e".repeat(64);
    const setPath = join(directory, "changed-set.json");
    writeFileSync(setPath, `${JSON.stringify(changedSet, null, 2)}\n`, "utf8");
    const setResult = runPython(setPath);
    assert.equal(setResult.status, 2, setResult.stderr || setResult.stdout);
    assert.ok(JSON.parse(setResult.stdout).errors.includes("representation record-set commitment drift"));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("representation tooling is offline, powerless, and review-manifest bound", () => {
  const sources = `${readFileSync(GENERATOR, "utf8")}\n${bundle.pythonVerifierSource}`;
  assert.doesNotMatch(sources, /\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/);
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  const expectedRoles = {
    "POSITIVE_CAMPAIGN_VECTOR_REPRESENTATION_AUDIT.md": "ARTIFACT",
    "generate-positive-campaign-vector-representation-audit.mjs": "GENERATOR",
    "positive-campaign-vector-representation-audit.v1.json": "ARTIFACT",
    "tests/positive-campaign-vector-representation-audit.test.mjs": "TEST",
    "validate-positive-campaign-vector-representation-audit.mjs": "VALIDATOR",
  };
  const roles = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expectedRoles, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(roles, expectedRoles);
});

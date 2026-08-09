/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateTransportLimitAudit } from "../generate-settlement-contention-composition-transport-limit-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildTransportLimitCorpus,
  parseBoundedTransportEnvelope,
  TRANSPORT_LIMITS,
} from "../settlement-contention-composition-transport-limits.mjs";
import {
  loadTransportLimitAudit,
  validateTransportLimitAudit,
} from "../validate-settlement-contention-composition-transport-limit-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-transport-limits.py", import.meta.url));
const BASE = JSON.parse(readFileSync(join(ROOT, "settlement-contention-composition-vectors.v1.json"), "utf8"));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadTransportLimitAudit();
const corpus = buildTransportLimitCorpus(BASE);

test("transport limit audit deterministically regenerates", () => {
  assert.deepEqual(validateTransportLimitAudit(artifact), []);
  assert.deepEqual(generateTransportLimitAudit(), artifact);
  assert.equal(artifact.summary.controlSetCommitmentSha256,
    "3d738e4f62f837f5e0efccf14e61f82ae43423b9b907a8f053e1728e6180a249");
  assert.equal(artifact.summary.rejectionSetCommitmentSha256,
    "8422840dc082a557c0ede2b18c576eea3e3eaa0588d1a102b91fd1c4ce57eebd");
  assert.equal(artifact.summary.combinedReplayCommitmentSha256,
    "978ec26a9ecf5d0ef9697caa60cea689042feae27070b68a168511b84b24beca");
});

test("transport limits are exact fixed integers", () => {
  assert.deepEqual(TRANSPORT_LIMITS, {
    maxUtf8Bytes: 65_536,
    maxDepth: 16,
    maxObjectMembers: 32,
    maxArrayLength: 32,
    maxTotalNodes: 2_048,
  });
  assert.deepEqual(artifact.contract.limits, TRANSPORT_LIMITS);
});

test("baseline and exact-byte controls preserve the same runtime-only candidate", () => {
  const baseline = parseBoundedTransportEnvelope(corpus.controls[0].serialized);
  const exact = parseBoundedTransportEnvelope(corpus.controls[1].serialized);
  assert.deepEqual(baseline.candidate, BASE);
  assert.deepEqual(exact.candidate, BASE);
  assert.equal(baseline.metrics.utf8Bytes, 51_320);
  assert.equal(exact.metrics.utf8Bytes, TRANSPORT_LIMITS.maxUtf8Bytes);
  assert.deepEqual(baseline.metrics, { utf8Bytes: 51_320, totalNodes: 1_229, maxDepthObserved: 8, maxObjectMembersObserved: 19, maxArrayLengthObserved: 28 });
  assert.equal(artifact.controls.every((item) => item.acceptedAtParser && !item.candidateStored && !item.mutationEvaluated), true);
});

test("duplicate keys reject at envelope, candidate, and deep-case levels", () => {
  const duplicates = corpus.rejections.filter((item) => item.family === "DUPLICATE_KEY");
  assert.deepEqual(duplicates.map((item) => item.caseId), ["DUPLICATE_TOP_LEVEL_KEY", "DUPLICATE_CANDIDATE_KEY", "DUPLICATE_DEEP_KEY"]);
  for (const item of duplicates) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /DUPLICATE_JSON_KEY/, item.caseId);
});

test("the exact byte limit accepts while one extra byte rejects", () => {
  assert.equal(Buffer.byteLength(corpus.controls[1].serialized, "utf8"), TRANSPORT_LIMITS.maxUtf8Bytes);
  const over = corpus.rejections.find((item) => item.caseId === "BYTE_LIMIT_PLUS_ONE");
  assert.equal(Buffer.byteLength(over.serialized, "utf8"), TRANSPORT_LIMITS.maxUtf8Bytes + 1);
  assert.throws(() => parseBoundedTransportEnvelope(over.serialized), /TRANSPORT_BYTE_LIMIT/);
});

test("depth limit rejects before a candidate is returned", () => {
  const item = corpus.rejections.find((entry) => entry.family === "DEPTH_LIMIT");
  assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /TRANSPORT_DEPTH_LIMIT/);
});

test("object-member limit rejects before a candidate is returned", () => {
  const item = corpus.rejections.find((entry) => entry.family === "OBJECT_MEMBER_LIMIT");
  assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /TRANSPORT_OBJECT_MEMBER_LIMIT/);
});

test("array-length limit rejects before a candidate is returned", () => {
  const item = corpus.rejections.find((entry) => entry.family === "ARRAY_LENGTH_LIMIT");
  assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /TRANSPORT_ARRAY_LENGTH_LIMIT/);
});

test("total-node limit rejects a locally bounded wide tree", () => {
  const item = corpus.rejections.find((entry) => entry.family === "NODE_LIMIT");
  assert.ok(Buffer.byteLength(item.serialized, "utf8") < TRANSPORT_LIMITS.maxUtf8Bytes);
  assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /TRANSPORT_NODE_LIMIT/);
});

test("independent Python reproduces both controls and all eight rejections", () => {
  assert.ok(PYTHON, "Python 3 is required for transport-limit parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.acceptedControlCount, 2);
  assert.equal(report.rejectionCount, 8);
  assert.equal(report.combinedReplayCommitmentSha256, artifact.summary.combinedReplayCommitmentSha256);
});

test("independent Python rejects changed compact transport evidence with exit 2", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-transport-limit-audit-"));
  try {
    const changed = structuredClone(artifact);
    changed.rejections[3].observedError = "DUPLICATE_JSON_KEY";
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("transport rejections drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("transport-limit tooling is compact, offline, powerless, and manifest-covered", () => {
  const expected = {
    "generate-settlement-contention-composition-transport-limit-audit.mjs": "GENERATOR",
    "settlement-contention-composition-transport-limit-audit.v1.json": "ARTIFACT",
    "settlement-contention-composition-transport-limits.mjs": "SUPPORTING_SOURCE",
    "tests/settlement-contention-transport-limit-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-transport-limit-audit.mjs": "VALIDATOR",
    "verify-settlement-contention-transport-limits.py": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  assert.equal(artifact.contract.serializedRepresentationsStored, false);
  assert.equal(artifact.contract.runtimeCandidatesStored, false);
  assert.ok(artifact.rejections.every((item) => item.rejectedBeforeMutation && !item.candidateProduced));
  const sources = Object.keys(expected).filter((path) => /\.(mjs|py)$/.test(path) && !path.startsWith("tests/"))
    .map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { canonicalSha256 } from "../compose-program-interface-preview.mjs";
import { generateInputSnapshotAudit } from "../generate-settlement-contention-composition-input-snapshot-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildInputSnapshotCorpus,
  INPUT_SNAPSHOT_RULES,
  parseBoundedTransportEnvelopeBytes,
  snapshotBoundedTransportByteView,
} from "../settlement-contention-composition-transport-limits.mjs";
import {
  loadInputSnapshotAudit,
  validateInputSnapshotAudit,
} from "../validate-settlement-contention-composition-input-snapshot-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-transport-limits.py", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadInputSnapshotAudit();

test("input snapshot audit deterministically regenerates", () => {
  assert.deepEqual(validateInputSnapshotAudit(artifact), []);
  assert.deepEqual(generateInputSnapshotAudit(), artifact);
  assert.equal(artifact.summary.snapshotControlSetCommitmentSha256, "911a9435376122ebd6344df9db9532528c50ad8ed5c3ee2bca8e135076ac9fc0");
  assert.equal(artifact.summary.sharedRejectionSetCommitmentSha256, "0648ff010573042b6a8c1a61c5839654b514af85adc408bf9654988a6a767d3f");
  assert.equal(artifact.summary.combinedReplayCommitmentSha256, "18c32f8123725d75976f27737e193409f5848a305766646f3d6b37300ce88b69");
});

test("input snapshot rule fixes copy-before-decode and shared-buffer rejection", () => {
  assert.deepEqual(INPUT_SNAPSHOT_RULES, {
    acceptedInputType: "Uint8Array",
    ordinaryArrayBufferViewAccepted: true,
    ordinaryInputCopiedBeforeDecode: true,
    snapshotAliasesInput: false,
    sharedArrayBufferViewAccepted: false,
    sharedArrayBufferError: "SHARED_BYTE_VIEW_UNSAFE",
    sharedRejectionPrecedesUtf8Decoding: true,
    snapshotByteSequencesStored: false,
  });
  assert.deepEqual(artifact.contract.inputSnapshotRules, INPUT_SNAPSHOT_RULES);
});

test("ordinary byte views receive an independent immutable snapshot", () => {
  const item = buildInputSnapshotCorpus().snapshotControls[0];
  const snapshot = snapshotBoundedTransportByteView(item.serializedBytes);
  assert.deepEqual(snapshot, item.serializedBytes);
  assert.notEqual(snapshot.buffer, item.serializedBytes.buffer);
  assert.equal(snapshot.byteOffset, 0);
  assert.equal(snapshot.byteLength, item.serializedBytes.byteLength);
});

test("candidate alias mutation cannot change a completed snapshot", () => {
  const item = buildInputSnapshotCorpus().snapshotControls[0];
  const snapshot = snapshotBoundedTransportByteView(item.serializedBytes);
  const snapshotCommitment = canonicalSha256(parseBoundedTransportEnvelopeBytes(snapshot).candidate);
  item.backingBytes[item.mutationBackingIndex] = item.replacementByte;
  assert.equal(canonicalSha256(parseBoundedTransportEnvelopeBytes(snapshot).candidate), snapshotCommitment);
  assert.notEqual(canonicalSha256(parseBoundedTransportEnvelopeBytes(item.serializedBytes).candidate), snapshotCommitment);
});

test("marker alias mutation cannot invalidate a completed snapshot", () => {
  const item = buildInputSnapshotCorpus().snapshotControls[1];
  const snapshot = snapshotBoundedTransportByteView(item.serializedBytes);
  const snapshotCandidate = parseBoundedTransportEnvelopeBytes(snapshot).candidate;
  item.backingBytes[item.mutationBackingIndex] = item.replacementByte;
  assert.deepEqual(parseBoundedTransportEnvelopeBytes(snapshot).candidate, snapshotCandidate);
  assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /INVALID_TRANSPORT_ENVELOPE/);
});

test("excluded-prefix mutation changes neither the live view nor its snapshot", () => {
  const item = buildInputSnapshotCorpus().snapshotControls[2];
  const beforeLive = Uint8Array.from(item.serializedBytes);
  const snapshot = snapshotBoundedTransportByteView(item.serializedBytes);
  item.backingBytes[item.mutationBackingIndex] = item.replacementByte;
  assert.deepEqual(item.serializedBytes, beforeLive);
  assert.deepEqual(snapshot, beforeLive);
});

test("full SharedArrayBuffer-backed views reject before snapshot", () => {
  const item = buildInputSnapshotCorpus().sharedRejections[0];
  assert.equal(item.runtimeInput.buffer instanceof SharedArrayBuffer, true);
  assert.throws(() => snapshotBoundedTransportByteView(item.runtimeInput), /SHARED_BYTE_VIEW_UNSAFE/);
  assert.throws(() => parseBoundedTransportEnvelopeBytes(item.runtimeInput), /SHARED_BYTE_VIEW_UNSAFE/);
});

test("bounded and empty SharedArrayBuffer-backed views reject identically", () => {
  for (const item of buildInputSnapshotCorpus().sharedRejections.slice(1)) {
    assert.throws(() => parseBoundedTransportEnvelopeBytes(item.runtimeInput), /SHARED_BYTE_VIEW_UNSAFE/, item.caseId);
  }
});

test("shared-view evidence proves rejection precedes decode, JSON, and candidate creation", () => {
  assert.deepEqual(artifact.sharedRejections.map((item) => item.viewDescriptor), ["FULL_VIEW", "BOUNDED_VIEW", "EMPTY_VIEW"]);
  assert.equal(artifact.sharedRejections.every((item) => item.observedError === "SHARED_BYTE_VIEW_UNSAFE" && item.snapshotCreated === false && item.utf8DecodingAttempted === false && item.jsonParsingAttempted === false && item.candidateProduced === false), true);
  for (const field of ["backingBytes", "serializedBytes", "serializedView", "snapshotBytes", "runtimeInput", "runtimeCandidates"]) assert.equal(Object.hasOwn(artifact, field), false);
});

test("independent Python reproduces immutable-copy and shared-rejection evidence", () => {
  assert.ok(PYTHON, "Python 3 is required for input snapshot parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-input-snapshot-audit", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.snapshotControlCount, 3);
  assert.equal(report.sharedRejectionCount, 3);
  assert.equal(report.combinedReplayCommitmentSha256, artifact.summary.combinedReplayCommitmentSha256);
});

test("independent Python rejects changed input snapshot evidence with exit 2", () => {
  assert.ok(PYTHON, "Python 3 is required for input snapshot tamper replay");
  const directory = mkdtempSync(join(tmpdir(), "iat-input-snapshot-audit-"));
  try {
    const changed = structuredClone(artifact);
    changed.snapshotControls[0].snapshotBytesPreserved = false;
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-input-snapshot-audit", "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("input snapshot controls drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("input snapshot tooling is offline, powerless, and manifest-covered", () => {
  const expected = {
    "SETTLEMENT_CONTENTION_INPUT_SNAPSHOT_AUDIT.md": "ARTIFACT",
    "generate-settlement-contention-composition-input-snapshot-audit.mjs": "GENERATOR",
    "settlement-contention-composition-input-snapshot-audit.v1.json": "ARTIFACT",
    "tests/settlement-contention-input-snapshot-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-input-snapshot-audit.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  const sources = [
    "generate-settlement-contention-composition-input-snapshot-audit.mjs",
    "settlement-contention-composition-transport-limits.mjs",
    "validate-settlement-contention-composition-input-snapshot-audit.mjs",
    "verify-settlement-contention-transport-limits.py",
  ].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateVisibleViewTruncationAudit } from "../generate-settlement-contention-composition-visible-view-truncation-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildVisibleViewTruncationCorpus,
  parseBoundedTransportEnvelopeBytes,
  VISIBLE_VIEW_TRUNCATION_RULES,
} from "../settlement-contention-composition-transport-limits.mjs";
import {
  loadVisibleViewTruncationAudit,
  validateVisibleViewTruncationAudit,
} from "../validate-settlement-contention-composition-visible-view-truncation-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-transport-limits.py", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadVisibleViewTruncationAudit();
const corpus = buildVisibleViewTruncationCorpus();

test("visible-view truncation audit deterministically regenerates", () => {
  assert.deepEqual(validateVisibleViewTruncationAudit(artifact), []);
  assert.deepEqual(generateVisibleViewTruncationAudit(), artifact);
  assert.equal(artifact.summary.controlSetCommitmentSha256, "3aa67759435475ebedc218c711b3a5f20dbf8cdba2dfc1e13a478f27defd7c7c");
  assert.equal(artifact.summary.rejectionSetCommitmentSha256, "16a01aa00ad261692ee54b3d59cd4bd505b7f36dc5ded1d977aa153f4754010b");
  assert.equal(artifact.summary.combinedReplayCommitmentSha256, "2967c4e500e0f69a84d43368355fed5ac9fa916fd63eee33eef5ef4347b1fa44");
});

test("visible-view truncation rule fixes the exact bounded-input contract", () => {
  assert.deepEqual(VISIBLE_VIEW_TRUNCATION_RULES, {
    acceptedInputType: "Uint8Array",
    fullViewAccepted: true,
    emptyViewAccepted: false,
    prefixOnlyViewAccepted: false,
    suffixOnlyViewAccepted: false,
    oneByteShortViewAccepted: false,
    outsideViewReadAllowed: false,
    truncatedViewError: "MALFORMED_JSON",
    rejectionAfterSuccessfulUtf8Decode: true,
  });
  assert.deepEqual(artifact.contract.visibleViewTruncationRules, VISIBLE_VIEW_TRUNCATION_RULES);
});

test("full visible view accepts the complete backing envelope", () => {
  const item = corpus.controls[0];
  assert.ok(item.serializedBytes instanceof Uint8Array);
  assert.equal(item.byteOffset, 0);
  assert.equal(item.byteLength, item.backingBytes.length);
  assert.deepEqual(parseBoundedTransportEnvelopeBytes(item.serializedBytes).candidate, item.expectedCandidate);
});

for (const [caseId, expectedLength] of [
  ["EMPTY_VIEW_REJECTED", 0],
  ["PREFIX_ONLY_VIEW_REJECTED", 24],
  ["SUFFIX_ONLY_VIEW_REJECTED", null],
  ["ONE_BYTE_SHORT_VIEW_REJECTED", null],
]) {
  test(`${caseId} rejects as malformed JSON`, () => {
    const item = corpus.rejections.find((entry) => entry.caseId === caseId);
    assert.ok(item.serializedBytes instanceof Uint8Array);
    if (expectedLength !== null) assert.equal(item.byteLength, expectedLength);
    assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /MALFORMED_JSON/);
  });
}

test("all truncated views decode successfully but produce no candidate", () => {
  assert.equal(artifact.rejections.every((item) => item.utf8DecodingSucceeded && item.jsonParsingAttempted && item.rejectedBeforeCandidate && !item.candidateProduced && !item.mutationEvaluated), true);
  for (const item of corpus.rejections) {
    assert.doesNotThrow(() => new TextDecoder("utf-8", { fatal: true }).decode(item.serializedBytes));
    assert.deepEqual(parseBoundedTransportEnvelopeBytes(item.backingBytes).candidate, { viewTruncationProbe: 0 });
  }
});

test("compact evidence publishes exact view metadata without byte sequences", () => {
  const all = [...artifact.controls, ...artifact.rejections];
  assert.equal(new Set(all.map((item) => `${item.byteOffset}:${item.byteLength}`)).size, 5);
  assert.equal(all.every((item) => item.byteOffset + item.byteLength + item.excludedSuffixLength === item.backingByteLength), true);
  for (const field of ["backingBytes", "serializedBytes", "runtimeInput", "runtimeCandidates"]) assert.equal(Object.hasOwn(artifact, field), false);
  assert.equal(artifact.contract.backingByteSequencesStored, false);
  assert.equal(artifact.contract.visibleByteSequencesStored, false);
  assert.equal(artifact.contract.runtimeInputsStored, false);
  assert.equal(artifact.contract.runtimeCandidatesStored, false);
});

test("independent Python reproduces every visible-view truncation result", () => {
  assert.ok(PYTHON, "Python 3 is required for visible-view truncation parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-visible-view-truncation-audit", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.acceptedControlCount, 1);
  assert.equal(report.rejectionCount, 4);
  assert.equal(report.combinedReplayCommitmentSha256, artifact.summary.combinedReplayCommitmentSha256);
});

test("independent Python rejects changed visible-view evidence with exit 2", () => {
  assert.ok(PYTHON, "Python 3 is required for visible-view truncation tamper replay");
  const directory = mkdtempSync(join(tmpdir(), "iat-visible-view-truncation-audit-"));
  try {
    const changed = structuredClone(artifact);
    changed.rejections[0].byteLength = 1;
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-visible-view-truncation-audit", "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("visible-view truncation rejections drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("visible-view truncation tooling is offline, powerless, and manifest-covered", () => {
  const expected = {
    "SETTLEMENT_CONTENTION_VISIBLE_VIEW_TRUNCATION_AUDIT.md": "ARTIFACT",
    "generate-settlement-contention-composition-visible-view-truncation-audit.mjs": "GENERATOR",
    "settlement-contention-composition-visible-view-truncation-audit.v1.json": "ARTIFACT",
    "tests/settlement-contention-visible-view-truncation-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-visible-view-truncation-audit.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  const sources = [
    "generate-settlement-contention-composition-visible-view-truncation-audit.mjs",
    "settlement-contention-composition-transport-limits.mjs",
    "validate-settlement-contention-composition-visible-view-truncation-audit.mjs",
    "verify-settlement-contention-transport-limits.py",
  ].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateByteViewBoundaryAudit } from "../generate-settlement-contention-composition-byte-view-boundary-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildByteViewBoundaryCorpus,
  BYTE_VIEW_BOUNDARY_RULES,
  parseBoundedTransportEnvelopeBytes,
} from "../settlement-contention-composition-transport-limits.mjs";
import {
  loadByteViewBoundaryAudit,
  validateByteViewBoundaryAudit,
} from "../validate-settlement-contention-composition-byte-view-boundary-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-transport-limits.py", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadByteViewBoundaryAudit();
const corpus = buildByteViewBoundaryCorpus();

test("byte-view boundary audit deterministically regenerates", () => {
  assert.deepEqual(validateByteViewBoundaryAudit(artifact), []);
  assert.deepEqual(generateByteViewBoundaryAudit(), artifact);
  assert.equal(artifact.summary.controlSetCommitmentSha256, "21e39200009e0401baa456131ac2fed1018c4afda491ff7ed981a13024e2c924");
  assert.equal(artifact.summary.rejectionSetCommitmentSha256, "037a27664cdf22db88296cdb06aa7556a0913a48b0dd87a871b4a7c61f8f7bdb");
  assert.equal(artifact.summary.combinedReplayCommitmentSha256, "67aa51b0371b4cde1a0143bfcc11a4291d41dca55266b4057facd7d66b8583f6");
});

test("byte-view rule fixes the accepted input type and visible bounds", () => {
  assert.deepEqual(BYTE_VIEW_BOUNDARY_RULES, {
    acceptedInputType: "Uint8Array",
    byteOffsetRespected: true,
    byteLengthRespected: true,
    arrayBufferAccepted: false,
    dataViewAccepted: false,
    stringAccepted: false,
    numericArrayAccepted: false,
    invalidInputError: "INVALID_BYTE_VIEW",
    rejectionPrecedesUtf8Decoding: true,
  });
  assert.deepEqual(artifact.contract.byteViewBoundaryRules, BYTE_VIEW_BOUNDARY_RULES);
});

test("nonzero offset excludes an invalid UTF-8 prefix", () => {
  const item = corpus.controls.find((entry) => entry.caseId === "NONZERO_OFFSET_EXCLUDES_INVALID_PREFIX");
  assert.ok(item.serializedBytes instanceof Uint8Array);
  assert.equal(item.byteOffset, 2);
  assert.equal(item.excludedPrefixLength, 2);
  assert.deepEqual(parseBoundedTransportEnvelopeBytes(item.serializedBytes).candidate, item.expectedCandidate);
});

test("bounded length excludes an invalid UTF-8 suffix", () => {
  const item = corpus.controls.find((entry) => entry.caseId === "BOUNDED_LENGTH_EXCLUDES_INVALID_SUFFIX");
  assert.equal(item.byteOffset, 0);
  assert.equal(item.excludedSuffixLength, 2);
  assert.equal(item.byteLength + item.excludedSuffixLength, item.backingBytes.length);
  assert.deepEqual(parseBoundedTransportEnvelopeBytes(item.serializedBytes).candidate, item.expectedCandidate);
});

test("offset and length jointly exclude both invalid sentinels", () => {
  const item = corpus.controls.find((entry) => entry.caseId === "OFFSET_AND_LENGTH_EXCLUDE_BOTH_SENTINELS");
  assert.equal(item.excludedPrefixLength, 2);
  assert.equal(item.excludedSuffixLength, 2);
  assert.equal(item.byteOffset + item.byteLength + item.excludedSuffixLength, item.backingBytes.length);
  assert.deepEqual(parseBoundedTransportEnvelopeBytes(item.serializedBytes).candidate, item.expectedCandidate);
});

test("decoding each complete backing buffer would fail on excluded sentinels", () => {
  for (const item of corpus.controls) {
    assert.throws(() => parseBoundedTransportEnvelopeBytes(item.backingBytes), /INVALID_UTF8/, item.caseId);
  }
});

test("ArrayBuffer, DataView, string, and numeric array inputs fail closed", () => {
  assert.deepEqual(corpus.rejections.map((item) => item.inputType), ["ArrayBuffer", "DataView", "string", "Array<number>"]);
  for (const item of corpus.rejections) {
    assert.throws(() => parseBoundedTransportEnvelopeBytes(item.runtimeInput), /INVALID_BYTE_VIEW/, item.caseId);
  }
});

test("all wrong-type failures occur before UTF-8 decoding and JSON parsing", () => {
  assert.equal(artifact.rejections.length, 4);
  assert.equal(artifact.rejections.every((item) => item.observedError === "INVALID_BYTE_VIEW" && !item.utf8DecodingAttempted && !item.jsonParsingAttempted && item.rejectedBeforeCandidate && !item.candidateProduced && !item.mutationEvaluated), true);
});

test("compact evidence stores no backing bytes, visible bytes, runtime inputs, or candidates", () => {
  for (const field of ["backingByteSequences", "visibleByteSequences", "runtimeInputs", "runtimeCandidates"]) assert.equal(Object.hasOwn(artifact, field), false);
  assert.equal(artifact.contract.backingByteSequencesStored, false);
  assert.equal(artifact.contract.visibleByteSequencesStored, false);
  assert.equal(artifact.contract.runtimeInputsStored, false);
  assert.equal(artifact.contract.runtimeCandidatesStored, false);
});

test("independent Python reproduces every byte-view boundary result", () => {
  assert.ok(PYTHON, "Python 3 is required for byte-view boundary parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-byte-view-boundary-audit", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.acceptedControlCount, 3);
  assert.equal(report.rejectionCount, 4);
  assert.equal(report.combinedReplayCommitmentSha256, artifact.summary.combinedReplayCommitmentSha256);
});

test("independent Python rejects changed byte-view evidence with exit 2", () => {
  assert.ok(PYTHON, "Python 3 is required for byte-view tamper replay");
  const directory = mkdtempSync(join(tmpdir(), "iat-byte-view-boundary-audit-"));
  try {
    const changed = structuredClone(artifact);
    changed.controls[0].byteOffset = 0;
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-byte-view-boundary-audit", "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("byte-view boundary controls drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("byte-view tooling is offline, powerless, and manifest-covered", () => {
  const expected = {
    "SETTLEMENT_CONTENTION_BYTE_VIEW_BOUNDARY_AUDIT.md": "ARTIFACT",
    "generate-settlement-contention-composition-byte-view-boundary-audit.mjs": "GENERATOR",
    "settlement-contention-composition-byte-view-boundary-audit.v1.json": "ARTIFACT",
    "tests/settlement-contention-byte-view-boundary-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-byte-view-boundary-audit.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  const sources = [
    "generate-settlement-contention-composition-byte-view-boundary-audit.mjs",
    "settlement-contention-composition-transport-limits.mjs",
    "validate-settlement-contention-composition-byte-view-boundary-audit.mjs",
    "verify-settlement-contention-transport-limits.py",
  ].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

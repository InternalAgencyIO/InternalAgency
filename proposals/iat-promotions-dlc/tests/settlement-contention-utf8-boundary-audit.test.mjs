/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateUtf8BoundaryAudit } from "../generate-settlement-contention-composition-utf8-boundary-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildUtf8BoundaryCorpus,
  parseBoundedTransportEnvelopeBytes,
  UTF8_BOUNDARY_RULES,
} from "../settlement-contention-composition-transport-limits.mjs";
import {
  loadUtf8BoundaryAudit,
  validateUtf8BoundaryAudit,
} from "../validate-settlement-contention-composition-utf8-boundary-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-transport-limits.py", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadUtf8BoundaryAudit();
const corpus = buildUtf8BoundaryCorpus();

test("UTF-8 boundary audit deterministically regenerates", () => {
  assert.deepEqual(validateUtf8BoundaryAudit(artifact), []);
  assert.deepEqual(generateUtf8BoundaryAudit(), artifact);
  assert.equal(artifact.summary.controlSetCommitmentSha256, "067f2b1050b06c1adc74da0b9cdf0303dfaa65c6566eb3fc5118d38fa532b455");
  assert.equal(artifact.summary.rejectionSetCommitmentSha256, "651cf8eef421fb00643c45a52736459477ff5932de38ddc758e2b4916baaeaaa");
  assert.equal(artifact.summary.combinedReplayCommitmentSha256, "d8fa15fff3059e48b1d46b8e76faba165be4929ad791da809407774ac4da4534");
});

test("UTF-8 boundary rule fixes scalar and lead-byte limits", () => {
  assert.deepEqual(UTF8_BOUNDARY_RULES, {
    maximumUnicodeScalar: "U+10FFFF",
    shortestFormRequired: true,
    obsoleteFiveSixByteFormsAllowed: false,
    feFfLeadBytesAllowed: false,
    continuationBytesRequireActiveSequence: true,
    rejectionPrecedesJsonParsing: true,
  });
  assert.deepEqual(artifact.contract.utf8BoundaryRules, UTF8_BOUNDARY_RULES);
});

test("exact one-, two-, three-, and four-byte boundary controls accept", () => {
  assert.equal(corpus.controls.length, 4);
  for (const item of corpus.controls) {
    assert.deepEqual(parseBoundedTransportEnvelopeBytes(item.serializedBytes).candidate, item.expectedCandidate, item.caseId);
  }
  assert.deepEqual(artifact.controls.map((item) => item.scalarClass), ["U+007F", "U+07FF", "U+D7FF", "U+10FFFF"]);
  assert.deepEqual(artifact.controls.map((item) => item.encodedByteLength), [1, 2, 3, 4]);
});

test("out-of-range scalar encodings reject before JSON", () => {
  const items = corpus.rejections.filter((item) => item.family === "OUT_OF_RANGE_SCALAR_UTF8");
  assert.equal(items.length, 4);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /INVALID_UTF8/, item.caseId);
});

test("obsolete five- and six-byte forms reject before JSON", () => {
  const items = corpus.rejections.filter((item) => item.family === "OBSOLETE_FIVE_SIX_BYTE_PREFIX");
  assert.equal(items.length, 4);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /INVALID_UTF8/, item.caseId);
});

test("FE and FF lead forms reject before JSON", () => {
  const items = corpus.rejections.filter((item) => item.family === "ILLEGAL_FE_FF_LEAD");
  assert.equal(items.length, 4);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /INVALID_UTF8/, item.caseId);
});

test("redundant continuation runs reject before JSON", () => {
  const items = corpus.rejections.filter((item) => item.family === "REDUNDANT_CONTINUATION_RUN");
  assert.equal(items.length, 4);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /INVALID_UTF8/, item.caseId);
});

test("all sixteen compact boundary results stop before JSON and candidates", () => {
  assert.equal(artifact.rejections.length, 16);
  assert.equal(artifact.rejections.every((item) => item.observedError === "INVALID_UTF8" && !item.utf8DecodingSucceeded && !item.jsonParsingAttempted && item.rejectedBeforeCandidate && !item.candidateProduced && !item.mutationEvaluated), true);
  assert.equal(Object.hasOwn(artifact, "serializedByteSequences"), false);
  assert.equal(Object.hasOwn(artifact, "runtimeCandidates"), false);
});

test("all four UTF-8 boundary families retain exact balanced coverage", () => {
  const families = artifact.rejections.reduce((result, item) => ((result[item.family] ??= []).push(item), result), {});
  assert.deepEqual(Object.fromEntries(Object.entries(families).map(([family, items]) => [family, items.length])), {
    OUT_OF_RANGE_SCALAR_UTF8: 4,
    OBSOLETE_FIVE_SIX_BYTE_PREFIX: 4,
    ILLEGAL_FE_FF_LEAD: 4,
    REDUNDANT_CONTINUATION_RUN: 4,
  });
});

test("independent Python reproduces every UTF-8 boundary result", () => {
  assert.ok(PYTHON, "Python 3 is required for UTF-8 boundary parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-utf8-boundary-audit", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.acceptedControlCount, 4);
  assert.equal(report.rejectionCount, 16);
  assert.equal(report.combinedReplayCommitmentSha256, artifact.summary.combinedReplayCommitmentSha256);
});

test("independent Python rejects changed UTF-8 boundary evidence with exit 2", () => {
  assert.ok(PYTHON, "Python 3 is required for UTF-8 boundary tamper replay");
  const directory = mkdtempSync(join(tmpdir(), "iat-utf8-boundary-audit-"));
  try {
    const changed = structuredClone(artifact);
    changed.rejections[0].observedError = "MALFORMED_JSON";
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-utf8-boundary-audit", "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("UTF-8 boundary rejections drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("UTF-8 boundary tooling is offline, powerless, and manifest-covered", () => {
  const expected = {
    "SETTLEMENT_CONTENTION_UTF8_BOUNDARY_AUDIT.md": "ARTIFACT",
    "generate-settlement-contention-composition-utf8-boundary-audit.mjs": "GENERATOR",
    "settlement-contention-composition-utf8-boundary-audit.v1.json": "ARTIFACT",
    "tests/settlement-contention-utf8-boundary-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-utf8-boundary-audit.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  assert.equal(artifact.contract.serializedByteSequencesStored, false);
  assert.equal(artifact.contract.runtimeCandidatesStored, false);
  const sources = [
    "generate-settlement-contention-composition-utf8-boundary-audit.mjs",
    "settlement-contention-composition-transport-limits.mjs",
    "validate-settlement-contention-composition-utf8-boundary-audit.mjs",
    "verify-settlement-contention-transport-limits.py",
  ].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

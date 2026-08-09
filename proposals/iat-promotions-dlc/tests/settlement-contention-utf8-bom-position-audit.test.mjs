/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TextDecoder } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateUtf8BomPositionAudit } from "../generate-settlement-contention-composition-utf8-bom-position-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildUtf8BomPositionCorpus,
  parseBoundedTransportEnvelopeBytes,
  UTF8_BOM_POSITION_RULES,
} from "../settlement-contention-composition-transport-limits.mjs";
import {
  loadUtf8BomPositionAudit,
  validateUtf8BomPositionAudit,
} from "../validate-settlement-contention-composition-utf8-bom-position-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-transport-limits.py", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadUtf8BomPositionAudit();
const corpus = buildUtf8BomPositionCorpus();
const decodePreservingBom = (bytes) => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);

test("UTF-8 BOM-position audit deterministically regenerates", () => {
  assert.deepEqual(validateUtf8BomPositionAudit(artifact), []);
  assert.deepEqual(generateUtf8BomPositionAudit(), artifact);
  assert.equal(artifact.summary.controlSetCommitmentSha256, "a1386aa634e5e10509e19bea6cc9566ef6e16bcf20ac84bd4ad99421584063cd");
  assert.equal(artifact.summary.rejectionSetCommitmentSha256, "f0f05bde08a9c3c375596cf7182c88f9d6a61b00f4574b6b35de08455d76f3da");
  assert.equal(artifact.summary.combinedReplayCommitmentSha256, "0923900db598b39f534c91c64408dd3afb07b015303e8fb69f6fb967758d86fa");
});

test("UTF-8 BOM-position rule fixes decoding and delimiter semantics", () => {
  assert.deepEqual(UTF8_BOM_POSITION_RULES, {
    bomUtf8Bytes: "EF BB BF",
    decoderPreservesBomScalar: true,
    leadingBomAllowed: false,
    postWhitespaceBomAllowed: false,
    trailingBomAllowed: false,
    bomInsideJsonStringAllowed: true,
    delimiterRejectionAfterSuccessfulDecode: true,
  });
  assert.deepEqual(artifact.contract.utf8BomPositionRules, UTF8_BOM_POSITION_RULES);
});

test("literal U+FEFF inside the candidate string remains a valid scalar", () => {
  assert.equal(corpus.controls.length, 1);
  const control = corpus.controls[0];
  assert.equal(control.position, "INSIDE_CANDIDATE_STRING");
  assert.deepEqual(parseBoundedTransportEnvelopeBytes(control.serializedBytes).candidate, { utf8Probe: "\ufeff" });
  assert.equal(artifact.controls[0].utf8DecodingSucceeded, true);
});

test("leading BOM bytes are preserved then rejected by the delimiter rule", () => {
  const item = corpus.rejections.find((entry) => entry.position === "LEADING");
  const decoded = decodePreservingBom(item.serializedBytes);
  assert.equal(decoded.codePointAt(0), 0xfeff);
  assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /MALFORMED_JSON/);
});

test("post-whitespace BOM bytes are preserved then rejected by the delimiter rule", () => {
  const item = corpus.rejections.find((entry) => entry.position === "POST_WHITESPACE");
  const decoded = decodePreservingBom(item.serializedBytes);
  assert.equal(decoded.slice(0, 4), " \t\r\n");
  assert.equal(decoded.codePointAt(4), 0xfeff);
  assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /MALFORMED_JSON/);
});

test("trailing BOM bytes are preserved then rejected by the delimiter rule", () => {
  const item = corpus.rejections.find((entry) => entry.position === "TRAILING");
  const decoded = decodePreservingBom(item.serializedBytes);
  assert.equal(decoded.codePointAt(decoded.length - 1), 0xfeff);
  assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /MALFORMED_JSON/);
});

test("all delimiter-position failures occur after successful UTF-8 decoding", () => {
  assert.equal(artifact.rejections.length, 3);
  assert.equal(artifact.rejections.every((item) => item.observedError === "MALFORMED_JSON" && item.utf8DecodingSucceeded && item.jsonParsingAttempted && item.rejectedBeforeCandidate && !item.candidateProduced && !item.mutationEvaluated), true);
});

test("compact evidence stores neither raw byte sequences nor runtime candidates", () => {
  assert.equal(Object.hasOwn(artifact, "serializedByteSequences"), false);
  assert.equal(Object.hasOwn(artifact, "runtimeCandidates"), false);
  assert.equal(artifact.contract.serializedByteSequencesStored, false);
  assert.equal(artifact.contract.runtimeCandidatesStored, false);
});

test("three BOM delimiter positions retain exact non-overlapping coverage", () => {
  assert.deepEqual(artifact.rejections.map((item) => item.position), ["LEADING", "POST_WHITESPACE", "TRAILING"]);
  assert.equal(new Set(artifact.rejections.map((item) => item.caseId)).size, 3);
  assert.equal(artifact.rejections.every((item) => item.injectedByteLength === 3), true);
});

test("independent Python reproduces every UTF-8 BOM-position result", () => {
  assert.ok(PYTHON, "Python 3 is required for UTF-8 BOM-position parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-utf8-bom-position-audit", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.acceptedControlCount, 1);
  assert.equal(report.rejectionCount, 3);
  assert.equal(report.combinedReplayCommitmentSha256, artifact.summary.combinedReplayCommitmentSha256);
});

test("independent Python rejects changed UTF-8 BOM-position evidence with exit 2", () => {
  assert.ok(PYTHON, "Python 3 is required for UTF-8 BOM-position tamper replay");
  const directory = mkdtempSync(join(tmpdir(), "iat-utf8-bom-position-audit-"));
  try {
    const changed = structuredClone(artifact);
    changed.rejections[0].observedError = "INVALID_UTF8";
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-utf8-bom-position-audit", "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("UTF-8 BOM-position rejections drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("UTF-8 BOM-position tooling is offline, powerless, and manifest-covered", () => {
  const expected = {
    "SETTLEMENT_CONTENTION_UTF8_BOM_POSITION_AUDIT.md": "ARTIFACT",
    "generate-settlement-contention-composition-utf8-bom-position-audit.mjs": "GENERATOR",
    "settlement-contention-composition-utf8-bom-position-audit.v1.json": "ARTIFACT",
    "tests/settlement-contention-utf8-bom-position-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-utf8-bom-position-audit.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  const sources = [
    "generate-settlement-contention-composition-utf8-bom-position-audit.mjs",
    "settlement-contention-composition-transport-limits.mjs",
    "validate-settlement-contention-composition-utf8-bom-position-audit.mjs",
    "verify-settlement-contention-transport-limits.py",
  ].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

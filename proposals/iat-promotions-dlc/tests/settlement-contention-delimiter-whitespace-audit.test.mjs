/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateDelimiterWhitespaceAudit } from "../generate-settlement-contention-composition-delimiter-whitespace-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildDelimiterWhitespaceCorpus,
  DELIMITER_WHITESPACE_RULES,
  parseBoundedTransportEnvelope,
} from "../settlement-contention-composition-transport-limits.mjs";
import {
  loadDelimiterWhitespaceAudit,
  validateDelimiterWhitespaceAudit,
} from "../validate-settlement-contention-composition-delimiter-whitespace-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-transport-limits.py", import.meta.url));
const BASE = JSON.parse(readFileSync(join(ROOT, "settlement-contention-composition-vectors.v1.json"), "utf8"));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadDelimiterWhitespaceAudit();
const corpus = buildDelimiterWhitespaceCorpus(BASE);

test("delimiter and whitespace audit deterministically regenerates", () => {
  assert.deepEqual(validateDelimiterWhitespaceAudit(artifact), []);
  assert.deepEqual(generateDelimiterWhitespaceAudit(), artifact);
  assert.equal(artifact.summary.controlSetCommitmentSha256,
    "905d9e437767809082f5b3c81c685c79b61019c8747b7c35df9b3fdbeb777468");
  assert.equal(artifact.summary.rejectionSetCommitmentSha256,
    "9442728edfb07ce1349c2c135d65c14c7a5df77b0ec22ef42c7ce9745eeeaf55");
  assert.equal(artifact.summary.combinedReplayCommitmentSha256,
    "7ced5f5f2fe013dc599793c3ad515cb5b8660b747a870014377f966bbd7c4651");
});

test("delimiter and whitespace rule is exact and closed", () => {
  assert.deepEqual(DELIMITER_WHITESPACE_RULES, {
    allowedWhitespaceCodePoints: ["U+0020", "U+0009", "U+000A", "U+000D"],
    bomAllowed: false,
    unicodeWhitespaceAllowed: false,
    trailingValuesAllowed: false,
    concatenatedDocumentsAllowed: false,
    singleDocumentOnly: true,
  });
  assert.deepEqual(artifact.contract.delimiterWhitespaceRules, DELIMITER_WHITESPACE_RULES);
});

test("pretty LF, compact, and pretty CRLF preserve the base candidate", () => {
  for (const item of corpus.controls.slice(0, 3)) {
    assert.deepEqual(parseBoundedTransportEnvelope(item.serialized).candidate, BASE, item.caseId);
  }
  assert.notEqual(artifact.controls[0].representationSha256, artifact.controls[1].representationSha256);
  assert.notEqual(artifact.controls[0].representationSha256, artifact.controls[2].representationSha256);
});

test("space, tab, LF, and CR are accepted at structural boundaries", () => {
  const item = corpus.controls.find((entry) => entry.caseId === "STANDARD_WHITESPACE_MIX");
  assert.deepEqual(parseBoundedTransportEnvelope(item.serialized).candidate, { whitespaceProbe: 0 });
  for (const character of [" ", "\t", "\n", "\r"]) assert.ok(item.serialized.includes(character));
});

test("BOM rejects at prefix, suffix, and delimiter positions", () => {
  const items = corpus.rejections.filter((item) => item.family === "BOM");
  assert.deepEqual(items.map((item) => item.caseId), ["BOM_PREFIX", "BOM_SUFFIX", "BOM_AFTER_COLON"]);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /MALFORMED_JSON/, item.caseId);
});

test("seven non-JSON Unicode whitespace characters reject", () => {
  const items = corpus.rejections.filter((item) => item.family === "UNICODE_WHITESPACE");
  assert.deepEqual(items.map((item) => item.descriptor), [
    "U+00A0_PREFIX",
    "U+1680_SUFFIX",
    "U+2002_AFTER_FIRST_COLON",
    "U+2028_AFTER_FIRST_COMMA",
    "U+2029_PREFIX",
    "U+202F_BEFORE_FINAL_BRACE",
    "U+3000_AFTER_FIRST_COLON",
  ]);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /MALFORMED_JSON/, item.caseId);
});

test("trailing scalar, object, and array values reject", () => {
  const items = corpus.rejections.filter((item) => item.family === "TRAILING_VALUE");
  assert.deepEqual(items.map((item) => item.descriptor), ["TRAILING_TRUE", "TRAILING_EMPTY_OBJECT", "TRAILING_EMPTY_ARRAY"]);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /MALFORMED_JSON/, item.caseId);
});

test("concatenated documents reject with no, space, or LF separators", () => {
  const items = corpus.rejections.filter((item) => item.family === "CONCATENATED_DOCUMENT");
  assert.deepEqual(items.map((item) => item.descriptor), ["COMPACT_NO_SEPARATOR", "COMPACT_SPACE_COMPACT", "COMPACT_LF_COMPACT"]);
  for (const item of items) {
    assert.ok(Buffer.byteLength(item.serialized, "utf8") < 65_536);
    assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /MALFORMED_JSON/, item.caseId);
  }
});

test("all sixteen compact results reject without storing an input or candidate", () => {
  assert.equal(artifact.rejections.length, 16);
  assert.equal(artifact.rejections.every((item) => item.rejectedBeforeCandidate && !item.candidateProduced && !item.mutationEvaluated), true);
  assert.equal(Object.hasOwn(artifact, "serializedRepresentations"), false);
  assert.equal(Object.hasOwn(artifact, "runtimeCandidates"), false);
});

test("independent Python reproduces every delimiter and whitespace result", () => {
  assert.ok(PYTHON, "Python 3 is required for delimiter parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-delimiter-whitespace-audit", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.acceptedControlCount, 4);
  assert.equal(report.rejectionCount, 16);
  assert.equal(report.combinedReplayCommitmentSha256, artifact.summary.combinedReplayCommitmentSha256);
});

test("independent Python rejects changed delimiter evidence with exit 2", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-delimiter-audit-"));
  try {
    const changed = structuredClone(artifact);
    changed.rejections[0].observedError = "TRANSPORT_BYTE_LIMIT";
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-delimiter-whitespace-audit", "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("delimiter rejections drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("delimiter tooling is offline, powerless, and manifest-covered", () => {
  const expected = {
    "SETTLEMENT_CONTENTION_DELIMITER_WHITESPACE_AUDIT.md": "ARTIFACT",
    "generate-settlement-contention-composition-delimiter-whitespace-audit.mjs": "GENERATOR",
    "settlement-contention-composition-delimiter-whitespace-audit.v1.json": "ARTIFACT",
    "tests/settlement-contention-delimiter-whitespace-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-delimiter-whitespace-audit.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  assert.equal(artifact.contract.serializedRepresentationsStored, false);
  assert.equal(artifact.contract.runtimeCandidatesStored, false);
  const sources = [
    "generate-settlement-contention-composition-delimiter-whitespace-audit.mjs",
    "settlement-contention-composition-transport-limits.mjs",
    "validate-settlement-contention-composition-delimiter-whitespace-audit.mjs",
    "verify-settlement-contention-transport-limits.py",
  ].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

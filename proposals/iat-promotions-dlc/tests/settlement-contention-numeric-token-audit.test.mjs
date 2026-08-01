/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateNumericTokenAudit } from "../generate-settlement-contention-composition-numeric-token-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildNumericTokenCorpus,
  NUMERIC_TOKEN_RULES,
  parseBoundedTransportEnvelope,
} from "../settlement-contention-composition-transport-limits.mjs";
import {
  loadNumericTokenAudit,
  validateNumericTokenAudit,
} from "../validate-settlement-contention-composition-numeric-token-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-transport-limits.py", import.meta.url));
const BASE = JSON.parse(readFileSync(join(ROOT, "settlement-contention-composition-vectors.v1.json"), "utf8"));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadNumericTokenAudit();
const corpus = buildNumericTokenCorpus(BASE);

test("numeric token audit deterministically regenerates", () => {
  assert.deepEqual(validateNumericTokenAudit(artifact), []);
  assert.deepEqual(generateNumericTokenAudit(), artifact);
  assert.equal(artifact.summary.controlSetCommitmentSha256,
    "a232afc87617e570edadf508e26ba046b2b4a7ee6c97e5992747941c001fcb13");
  assert.equal(artifact.summary.rejectionSetCommitmentSha256,
    "949454ae890e8f2cf261c728a8bb4270bac5bb089c6230603e353a94a2b806cd");
  assert.equal(artifact.summary.combinedReplayCommitmentSha256,
    "1d0d6fb06996456732cfd9ba0baa8c7b57ca5bea702bcc9c2dc0efb20d93eaa5");
});

test("numeric token rule is exact and closed", () => {
  assert.deepEqual(NUMERIC_TOKEN_RULES, {
    representation: "CANONICAL_SAFE_INTEGER",
    canonicalPattern: "0|-?[1-9][0-9]*",
    minimumSafeInteger: "-9007199254740991",
    maximumSafeInteger: "9007199254740991",
    fractionsAllowed: false,
    exponentAllowed: false,
    negativeZeroAllowed: false,
    nonFiniteAllowed: false,
  });
  assert.deepEqual(artifact.contract.numericTokenRules, NUMERIC_TOKEN_RULES);
});

test("baseline, zero, and both safe-integer boundaries accept", () => {
  assert.deepEqual(corpus.controls.map((item) => item.caseId), [
    "BASELINE_CANONICAL_FIELDS",
    "ZERO_CANONICAL",
    "MAX_SAFE_INTEGER_CANONICAL",
    "MIN_SAFE_INTEGER_CANONICAL",
  ]);
  for (const item of corpus.controls) {
    assert.deepEqual(parseBoundedTransportEnvelope(item.serialized).candidate, item.expectedCandidate, item.caseId);
  }
});

test("fractional and exponent equivalents reject before candidate production", () => {
  const items = corpus.rejections.filter((item) => item.family === "EQUIVALENT_NONCANONICAL");
  assert.deepEqual(items.map((item) => item.token), ["1.0", "1e0", "1E+0"]);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /NONCANONICAL_JSON_NUMBER/, item.caseId);
});

test("all three negative-zero spellings reject distinctly", () => {
  const items = corpus.rejections.filter((item) => item.family === "NEGATIVE_ZERO");
  assert.deepEqual(items.map((item) => item.token), ["-0", "-0.0", "-0e0"]);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /NEGATIVE_ZERO_JSON_NUMBER/, item.caseId);
});

test("unsafe and precision-colliding integers reject", () => {
  const items = corpus.rejections.filter((item) => item.family === "UNSAFE_INTEGER");
  assert.deepEqual(items.map((item) => item.token), ["9007199254740992", "-9007199254740992", "9007199254740993"]);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /UNSAFE_JSON_INTEGER/, item.caseId);
});

test("finite-runtime overflow equivalents reject", () => {
  const items = corpus.rejections.filter((item) => item.family === "NONFINITE_EQUIVALENT");
  assert.deepEqual(items.map((item) => item.token), ["1e309", "-1e309"]);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /NONFINITE_JSON_NUMBER/, item.caseId);
});

test("non-JSON constants and illegal integer prefixes stay malformed", () => {
  const items = corpus.rejections.filter((item) => item.family === "NON_JSON_NUMBER");
  assert.deepEqual(items.map((item) => item.token), ["NaN", "Infinity", "-Infinity", "+1", "01"]);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /MALFORMED_JSON/, item.caseId);
});

test("all sixteen compact results reject without storing an input or candidate", () => {
  assert.equal(artifact.rejections.length, 16);
  assert.equal(artifact.rejections.every((item) => item.rejectedBeforeCandidate && !item.candidateProduced && !item.mutationEvaluated), true);
  assert.equal(Object.hasOwn(artifact, "serializedRepresentations"), false);
  assert.equal(Object.hasOwn(artifact, "runtimeCandidates"), false);
});

test("independent Python reproduces all controls and rejections", () => {
  assert.ok(PYTHON, "Python 3 is required for numeric-token parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-numeric-token-audit", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.acceptedControlCount, 4);
  assert.equal(report.rejectionCount, 16);
  assert.equal(report.combinedReplayCommitmentSha256, artifact.summary.combinedReplayCommitmentSha256);
});

test("independent Python rejects changed numeric evidence with exit 2", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-numeric-token-audit-"));
  try {
    const changed = structuredClone(artifact);
    changed.rejections[0].observedError = "MALFORMED_JSON";
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-numeric-token-audit", "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("numeric rejections drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("numeric-token tooling is offline, powerless, and manifest-covered", () => {
  const expected = {
    "SETTLEMENT_CONTENTION_NUMERIC_TOKEN_AUDIT.md": "ARTIFACT",
    "generate-settlement-contention-composition-numeric-token-audit.mjs": "GENERATOR",
    "settlement-contention-composition-numeric-token-audit.v1.json": "ARTIFACT",
    "tests/settlement-contention-numeric-token-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-numeric-token-audit.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  assert.equal(artifact.contract.serializedRepresentationsStored, false);
  assert.equal(artifact.contract.runtimeCandidatesStored, false);
  const sources = [
    "generate-settlement-contention-composition-numeric-token-audit.mjs",
    "settlement-contention-composition-transport-limits.mjs",
    "validate-settlement-contention-composition-numeric-token-audit.mjs",
    "verify-settlement-contention-transport-limits.py",
  ].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

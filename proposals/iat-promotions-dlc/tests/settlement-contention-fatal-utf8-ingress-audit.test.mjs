/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateFatalUtf8IngressAudit } from "../generate-settlement-contention-composition-fatal-utf8-ingress-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildFatalUtf8IngressCorpus,
  FATAL_UTF8_INGRESS_RULES,
  parseBoundedTransportEnvelopeBytes,
} from "../settlement-contention-composition-transport-limits.mjs";
import {
  loadFatalUtf8IngressAudit,
  validateFatalUtf8IngressAudit,
} from "../validate-settlement-contention-composition-fatal-utf8-ingress-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-transport-limits.py", import.meta.url));
const BASE = JSON.parse(readFileSync(join(ROOT, "settlement-contention-composition-vectors.v1.json"), "utf8"));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadFatalUtf8IngressAudit();
const corpus = buildFatalUtf8IngressCorpus(BASE);

test("fatal UTF-8 ingress audit deterministically regenerates", () => {
  assert.deepEqual(validateFatalUtf8IngressAudit(artifact), []);
  assert.deepEqual(generateFatalUtf8IngressAudit(), artifact);
  assert.equal(artifact.summary.controlSetCommitmentSha256, "68621bc5d34259865bb893e895f62c5eb1e130b11f5d68a99f201d42c1e867d0");
  assert.equal(artifact.summary.rejectionSetCommitmentSha256, "0af2ef6528cbe78c78481f9229852d39bbceb23b050266a6ea4aa205e2acaee9");
  assert.equal(artifact.summary.combinedReplayCommitmentSha256, "f1ad153fdf68fb12b9def32fd918f648ac032dbe71f3c043f8823a82d8e93058");
});

test("fatal UTF-8 rule rejects before JSON without replacement", () => {
  assert.deepEqual(FATAL_UTF8_INGRESS_RULES, {
    inputType: "BYTE_SEQUENCE",
    encoding: "UTF-8",
    decoderErrorMode: "FATAL",
    replacementCharacterInserted: false,
    bomHandling: "PRESERVE_FOR_JSON_DELIMITER_RULE",
    rejectionPrecedesJsonParsing: true,
  });
  assert.deepEqual(artifact.contract.fatalUtf8IngressRules, FATAL_UTF8_INGRESS_RULES);
});

test("one-, two-, three-, and four-byte scalar controls accept", () => {
  assert.equal(corpus.controls.length, 4);
  assert.deepEqual(parseBoundedTransportEnvelopeBytes(corpus.controls[0].serializedBytes).candidate, BASE);
  for (const item of corpus.controls.slice(1)) {
    assert.deepEqual(parseBoundedTransportEnvelopeBytes(item.serializedBytes).candidate, item.expectedCandidate, item.caseId);
  }
  assert.deepEqual(artifact.controls.map((item) => item.scalarClass), ["ONE_BYTE_ASCII", "U+00E9", "U+20AC", "U+1F642"]);
});

test("truncated multibyte sequences reject fatally at end of input", () => {
  const items = corpus.rejections.filter((item) => item.family === "TRUNCATED_UTF8");
  assert.equal(items.length, 4);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /INVALID_UTF8/, item.caseId);
});

test("overlong encodings reject before JSON", () => {
  const items = corpus.rejections.filter((item) => item.family === "OVERLONG_UTF8");
  assert.equal(items.length, 4);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /INVALID_UTF8/, item.caseId);
});

test("UTF-8 encodings of surrogate code points reject before JSON", () => {
  const items = corpus.rejections.filter((item) => item.family === "SURROGATE_ENCODED_UTF8");
  assert.equal(items.length, 4);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /INVALID_UTF8/, item.caseId);
});

test("invalid continuation patterns reject before JSON", () => {
  const items = corpus.rejections.filter((item) => item.family === "INVALID_CONTINUATION_UTF8");
  assert.equal(items.length, 4);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /INVALID_UTF8/, item.caseId);
});

test("all sixteen compact results stop before JSON or candidate production", () => {
  assert.equal(artifact.rejections.length, 16);
  assert.equal(artifact.rejections.every((item) => item.observedError === "INVALID_UTF8" && !item.utf8DecodingSucceeded && !item.jsonParsingAttempted && item.rejectedBeforeCandidate && !item.candidateProduced && !item.mutationEvaluated), true);
  assert.equal(Object.hasOwn(artifact, "serializedByteSequences"), false);
  assert.equal(Object.hasOwn(artifact, "runtimeCandidates"), false);
});

test("all four fatal UTF-8 families retain exact balanced coverage", () => {
  const families = Object.groupBy ? Object.groupBy(artifact.rejections, (item) => item.family) : artifact.rejections.reduce((result, item) => ((result[item.family] ??= []).push(item), result), {});
  assert.deepEqual(Object.fromEntries(Object.entries(families).map(([family, items]) => [family, items.length])), {
    TRUNCATED_UTF8: 4,
    OVERLONG_UTF8: 4,
    SURROGATE_ENCODED_UTF8: 4,
    INVALID_CONTINUATION_UTF8: 4,
  });
});

test("independent Python reproduces every fatal UTF-8 result", () => {
  assert.ok(PYTHON, "Python 3 is required for fatal UTF-8 parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-fatal-utf8-ingress-audit", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.acceptedControlCount, 4);
  assert.equal(report.rejectionCount, 16);
  assert.equal(report.combinedReplayCommitmentSha256, artifact.summary.combinedReplayCommitmentSha256);
});

test("independent Python rejects changed fatal UTF-8 evidence with exit 2", () => {
  assert.ok(PYTHON, "Python 3 is required for fatal UTF-8 tamper replay");
  const directory = mkdtempSync(join(tmpdir(), "iat-fatal-utf8-audit-"));
  try {
    const changed = structuredClone(artifact);
    changed.rejections[0].observedError = "MALFORMED_JSON";
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-fatal-utf8-ingress-audit", "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("fatal UTF-8 rejections drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("fatal UTF-8 tooling is offline, powerless, and manifest-covered", () => {
  const expected = {
    "SETTLEMENT_CONTENTION_FATAL_UTF8_INGRESS_AUDIT.md": "ARTIFACT",
    "generate-settlement-contention-composition-fatal-utf8-ingress-audit.mjs": "GENERATOR",
    "settlement-contention-composition-fatal-utf8-ingress-audit.v1.json": "ARTIFACT",
    "tests/settlement-contention-fatal-utf8-ingress-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-fatal-utf8-ingress-audit.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  assert.equal(artifact.contract.serializedByteSequencesStored, false);
  assert.equal(artifact.contract.runtimeCandidatesStored, false);
  const sources = [
    "generate-settlement-contention-composition-fatal-utf8-ingress-audit.mjs",
    "settlement-contention-composition-transport-limits.mjs",
    "validate-settlement-contention-composition-fatal-utf8-ingress-audit.mjs",
    "verify-settlement-contention-transport-limits.py",
  ].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateStringTokenAudit } from "../generate-settlement-contention-composition-string-token-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildStringTokenCorpus,
  parseBoundedTransportEnvelope,
  STRING_TOKEN_RULES,
} from "../settlement-contention-composition-transport-limits.mjs";
import {
  loadStringTokenAudit,
  validateStringTokenAudit,
} from "../validate-settlement-contention-composition-string-token-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-transport-limits.py", import.meta.url));
const BASE = JSON.parse(readFileSync(join(ROOT, "settlement-contention-composition-vectors.v1.json"), "utf8"));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadStringTokenAudit();
const corpus = buildStringTokenCorpus(BASE);

test("string-token audit deterministically regenerates", () => {
  assert.deepEqual(validateStringTokenAudit(artifact), []);
  assert.deepEqual(generateStringTokenAudit(), artifact);
  assert.equal(artifact.summary.controlSetCommitmentSha256,
    "5097123b98678a4a9c00f232c207b099c47eba1586d827ec6c56eb6c9761b0f1");
  assert.equal(artifact.summary.rejectionSetCommitmentSha256,
    "b3c4987b8e6ec477420379a087609a8c54c2ee048463155c6dd07728fd713912");
  assert.equal(artifact.summary.combinedReplayCommitmentSha256,
    "50ec472897a5398c8ebcf57f1b5a799da113d9cefd6dae08d0f1d7caaef999b0");
});

test("string-token rule fixes exact decoded required-key comparison", () => {
  assert.deepEqual(STRING_TOKEN_RULES, {
    requiredEnvelopeKeys: ["candidate", "transportMarker"],
    keyComparison: "EXACT_DECODED_UNICODE_SCALAR_SEQUENCE",
    rawControlCodePointsAllowedInStrings: false,
    escapedControlCodePointsAllowedInRequiredKeys: false,
    escapedCanonicalKeySpellingsAllowed: true,
    unicodeNormalizationAppliedToRequiredKeys: false,
    unicodeCompatibilityLookalikesAllowed: false,
  });
  assert.deepEqual(artifact.contract.stringTokenRules, STRING_TOKEN_RULES);
});

test("literal and escaped canonical required keys preserve candidates", () => {
  assert.equal(corpus.controls.length, 3);
  assert.deepEqual(parseBoundedTransportEnvelope(corpus.controls[0].serialized).candidate, BASE);
  for (const item of corpus.controls.slice(1)) {
    assert.deepEqual(parseBoundedTransportEnvelope(item.serialized).candidate, { stringProbe: 0 }, item.caseId);
  }
  assert.equal(new Set(artifact.controls.map((item) => item.representationSha256)).size, 3);
});

test("seven raw control code points in a quoted key are malformed JSON", () => {
  const items = corpus.rejections.filter((item) => item.family === "RAW_CONTROL_IN_STRING");
  assert.deepEqual(items.map((item) => item.descriptor), ["U+0000", "U+0008", "U+0009", "U+000A", "U+000C", "U+000D", "U+001F"]);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /MALFORMED_JSON/, item.caseId);
});

test("escaped controls decode but cannot become the candidate key", () => {
  const items = corpus.rejections.filter((item) => item.family === "ESCAPED_CONTROL_IN_REQUIRED_KEY");
  assert.equal(items.length, 7);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /INVALID_TRANSPORT_ENVELOPE/, item.caseId);
});

test("six compatibility-normalization lookalikes fail exact required-key matching", () => {
  const items = corpus.rejections.filter((item) => item.family === "UNICODE_NORMALIZATION_LOOKALIKE");
  assert.equal(items.length, 6);
  assert.deepEqual(items.map((item) => item.targetRequiredKey), ["candidate", "candidate", "candidate", "candidate", "transportMarker", "transportMarker"]);
  for (const item of items) {
    assert.equal(item.nfkcMatchesRequiredKey, true, item.caseId);
    assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /INVALID_TRANSPORT_ENVELOPE/, item.caseId);
  }
});

test("raw controls reject at syntax while decoded variants reject at envelope semantics", () => {
  const raw = artifact.rejections.filter((item) => item.family === "RAW_CONTROL_IN_STRING");
  const decoded = artifact.rejections.filter((item) => item.family !== "RAW_CONTROL_IN_STRING");
  assert.equal(raw.every((item) => item.expectedError === "MALFORMED_JSON" && item.observedError === "MALFORMED_JSON"), true);
  assert.equal(decoded.every((item) => item.expectedError === "INVALID_TRANSPORT_ENVELOPE" && item.observedError === "INVALID_TRANSPORT_ENVELOPE"), true);
});

test("all twenty compact rejections stop before candidate production", () => {
  assert.equal(artifact.rejections.length, 20);
  assert.equal(artifact.rejections.every((item) => item.rejectedBeforeCandidate && !item.candidateProduced && !item.mutationEvaluated), true);
  assert.equal(Object.hasOwn(artifact, "serializedRepresentations"), false);
  assert.equal(Object.hasOwn(artifact, "runtimeCandidates"), false);
});

test("normalization evidence records only the relation and required key", () => {
  const items = artifact.rejections.filter((item) => item.family === "UNICODE_NORMALIZATION_LOOKALIKE");
  assert.equal(items.every((item) => item.nfkcMatchesRequiredKey === true), true);
  assert.equal(items.every((item) => ["candidate", "transportMarker"].includes(item.targetRequiredKey)), true);
  assert.equal(items.every((item) => !Object.hasOwn(item, "serialized")), true);
});

test("independent Python reproduces every string-token result", () => {
  assert.ok(PYTHON, "Python 3 is required for string-token parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-string-token-audit", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.acceptedControlCount, 3);
  assert.equal(report.rejectionCount, 20);
  assert.equal(report.combinedReplayCommitmentSha256, artifact.summary.combinedReplayCommitmentSha256);
});

test("independent Python rejects changed string-token evidence with exit 2", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-string-token-audit-"));
  try {
    const changed = structuredClone(artifact);
    changed.rejections[0].observedError = "INVALID_TRANSPORT_ENVELOPE";
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-string-token-audit", "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("string-token rejections drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("string-token tooling is offline, powerless, and manifest-covered", () => {
  const expected = {
    "SETTLEMENT_CONTENTION_STRING_TOKEN_AUDIT.md": "ARTIFACT",
    "generate-settlement-contention-composition-string-token-audit.mjs": "GENERATOR",
    "settlement-contention-composition-string-token-audit.v1.json": "ARTIFACT",
    "tests/settlement-contention-string-token-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-string-token-audit.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  assert.equal(artifact.contract.serializedRepresentationsStored, false);
  assert.equal(artifact.contract.runtimeCandidatesStored, false);
  const sources = [
    "generate-settlement-contention-composition-string-token-audit.mjs",
    "settlement-contention-composition-transport-limits.mjs",
    "validate-settlement-contention-composition-string-token-audit.mjs",
    "verify-settlement-contention-transport-limits.py",
  ].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

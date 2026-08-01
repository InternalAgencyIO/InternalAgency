/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateKeyCollisionAudit } from "../generate-settlement-contention-composition-key-collision-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildKeyCollisionCorpus,
  KEY_COLLISION_RULES,
  parseBoundedTransportEnvelope,
} from "../settlement-contention-composition-transport-limits.mjs";
import {
  loadKeyCollisionAudit,
  validateKeyCollisionAudit,
} from "../validate-settlement-contention-composition-key-collision-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-transport-limits.py", import.meta.url));
const BASE = JSON.parse(readFileSync(join(ROOT, "settlement-contention-composition-vectors.v1.json"), "utf8"));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadKeyCollisionAudit();
const corpus = buildKeyCollisionCorpus(BASE);

test("required-key collision audit deterministically regenerates", () => {
  assert.deepEqual(validateKeyCollisionAudit(artifact), []);
  assert.deepEqual(generateKeyCollisionAudit(), artifact);
  assert.equal(artifact.summary.controlSetCommitmentSha256,
    "c0d81db8d0c945efbb4e59950e86626a0c4c43747ed63c3fd3ad169e16deceeb");
  assert.equal(artifact.summary.rejectionSetCommitmentSha256,
    "7a65a5117aa4c21caa578d0d4c9d0647d0ee85e5735fcb61158d2756054c858b");
  assert.equal(artifact.summary.combinedReplayCommitmentSha256,
    "bfb4789ba299d382338007671b601743504e452e8362fe875127ee860836f7a9");
});

test("key-collision rule separates decoded equality from normalization similarity", () => {
  assert.deepEqual(KEY_COLLISION_RULES, {
    duplicateComparison: "EXACT_DECODED_UNICODE_SCALAR_SEQUENCE",
    escapedCanonicalSpellingsCollide: true,
    unicodeNormalizationAppliedBeforeDuplicateCheck: false,
    normalizationLookalikesRemainDistinct: true,
    distinctUnexpectedKeysRejected: true,
  });
  assert.deepEqual(artifact.contract.keyCollisionRules, KEY_COLLISION_RULES);
});

test("literal and escaped canonical controls preserve candidates", () => {
  assert.equal(corpus.controls.length, 3);
  assert.deepEqual(parseBoundedTransportEnvelope(corpus.controls[0].serialized).candidate, BASE);
  for (const item of corpus.controls.slice(1)) {
    assert.deepEqual(parseBoundedTransportEnvelope(item.serialized).candidate, { collisionProbe: 0 }, item.caseId);
  }
});

test("candidate literal and escaped aliases collide in both orders", () => {
  const items = corpus.rejections.filter((item) => item.descriptor.startsWith("CANDIDATE_")).slice(0, 2);
  assert.deepEqual(items.map((item) => item.descriptor), ["CANDIDATE_LITERAL_THEN_ESCAPE", "CANDIDATE_ESCAPE_THEN_LITERAL"]);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /DUPLICATE_JSON_KEY/, item.caseId);
});

test("transportMarker literal and escaped aliases collide in both orders", () => {
  const items = corpus.rejections.filter((item) => item.descriptor.startsWith("MARKER_")).slice(0, 2);
  assert.deepEqual(items.map((item) => item.descriptor), ["MARKER_LITERAL_THEN_ESCAPE", "MARKER_ESCAPE_THEN_LITERAL"]);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /DUPLICATE_JSON_KEY/, item.caseId);
});

test("two different escape spellings of each required key still collide", () => {
  const items = corpus.rejections.filter((item) => item.descriptor.endsWith("TWO_ESCAPE_SPELLINGS"));
  assert.equal(items.length, 2);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /DUPLICATE_JSON_KEY/, item.caseId);
});

test("NFKC lookalikes remain distinct but make the envelope invalid", () => {
  const items = corpus.rejections.filter((item) => item.family === "NORMALIZATION_LOOKALIKE_DISTINCT_KEY");
  assert.equal(items.length, 6);
  for (const item of items) {
    assert.equal(item.decodedKeysCollide, false, item.caseId);
    assert.equal(item.nfkcMatchesRequiredKey, true, item.caseId);
    assert.equal(item.distinctDecodedKey, true, item.caseId);
    assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /INVALID_TRANSPORT_ENVELOPE/, item.caseId);
  }
});

test("duplicate and distinct-lookalike families retain separate error boundaries", () => {
  const duplicates = artifact.rejections.filter((item) => item.family === "DECODED_KEY_DUPLICATE");
  const lookalikes = artifact.rejections.filter((item) => item.family === "NORMALIZATION_LOOKALIKE_DISTINCT_KEY");
  assert.equal(duplicates.every((item) => item.observedError === "DUPLICATE_JSON_KEY" && item.decodedKeysCollide === true), true);
  assert.equal(lookalikes.every((item) => item.observedError === "INVALID_TRANSPORT_ENVELOPE" && item.distinctDecodedKey === true), true);
});

test("all twelve compact results reject without storing an input or candidate", () => {
  assert.equal(artifact.rejections.length, 12);
  assert.equal(artifact.rejections.every((item) => item.rejectedBeforeCandidate && !item.candidateProduced && !item.mutationEvaluated), true);
  assert.equal(Object.hasOwn(artifact, "serializedRepresentations"), false);
  assert.equal(Object.hasOwn(artifact, "runtimeCandidates"), false);
});

test("independent Python reproduces every key-collision result", () => {
  assert.ok(PYTHON, "Python 3 is required for key-collision parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-key-collision-audit", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.acceptedControlCount, 3);
  assert.equal(report.rejectionCount, 12);
  assert.equal(report.combinedReplayCommitmentSha256, artifact.summary.combinedReplayCommitmentSha256);
});

test("independent Python rejects changed key-collision evidence with exit 2", () => {
  const directory = mkdtempSync(join(tmpdir(), "iat-key-collision-audit-"));
  try {
    const changed = structuredClone(artifact);
    changed.rejections[0].observedError = "INVALID_TRANSPORT_ENVELOPE";
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-key-collision-audit", "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("key-collision rejections drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("key-collision tooling is offline, powerless, and manifest-covered", () => {
  const expected = {
    "SETTLEMENT_CONTENTION_KEY_COLLISION_AUDIT.md": "ARTIFACT",
    "generate-settlement-contention-composition-key-collision-audit.mjs": "GENERATOR",
    "settlement-contention-composition-key-collision-audit.v1.json": "ARTIFACT",
    "tests/settlement-contention-key-collision-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-key-collision-audit.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  assert.equal(artifact.contract.serializedRepresentationsStored, false);
  assert.equal(artifact.contract.runtimeCandidatesStored, false);
  const sources = [
    "generate-settlement-contention-composition-key-collision-audit.mjs",
    "settlement-contention-composition-transport-limits.mjs",
    "validate-settlement-contention-composition-key-collision-audit.mjs",
    "verify-settlement-contention-transport-limits.py",
  ].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { generateMarkerValueAudit } from "../generate-settlement-contention-composition-marker-value-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildTransportMarkerValueCorpus,
  parseBoundedTransportEnvelope,
  TRANSPORT_MARKER_VALUE_RULES,
} from "../settlement-contention-composition-transport-limits.mjs";
import {
  loadMarkerValueAudit,
  validateMarkerValueAudit,
} from "../validate-settlement-contention-composition-marker-value-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-transport-limits.py", import.meta.url));
const BASE = JSON.parse(readFileSync(join(ROOT, "settlement-contention-composition-vectors.v1.json"), "utf8"));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadMarkerValueAudit();
const corpus = buildTransportMarkerValueCorpus(BASE);

test("transport-marker value audit deterministically regenerates", () => {
  assert.deepEqual(validateMarkerValueAudit(artifact), []);
  assert.deepEqual(generateMarkerValueAudit(), artifact);
  assert.equal(artifact.summary.controlSetCommitmentSha256,
    "3053aef0920c442e2814fe2c2b1cc0314c311f0e610c2d621698dd5a95679316");
  assert.equal(artifact.summary.rejectionSetCommitmentSha256,
    "8057b55f1b93ec4bcf7232aaecf47673dcbc6134866da56c66fd58debaccf0ca");
  assert.equal(artifact.summary.combinedReplayCommitmentSha256,
    "09cb67b11dea7a1bd0efd9ccec2210baffb5bb8ce7ef1dc3c5da18f2f477c789");
});

test("transport-marker rule requires exact decoded Unicode scalar equality", () => {
  assert.deepEqual(TRANSPORT_MARKER_VALUE_RULES, {
    canonicalValue: "DRAFT/INACTIVE",
    comparison: "EXACT_DECODED_UNICODE_SCALAR_SEQUENCE",
    escapedCanonicalValueSpellingsAllowed: true,
    rawControlCodePointsAllowed: false,
    escapedControlCodePointsAllowed: false,
    caseFoldApplied: false,
    unicodeNormalizationApplied: false,
    confusableMappingApplied: false,
  });
  assert.deepEqual(artifact.contract.transportMarkerValueRules, TRANSPORT_MARKER_VALUE_RULES);
});

test("all four literal and escaped canonical controls accept", () => {
  assert.equal(corpus.controls.length, 4);
  assert.deepEqual(parseBoundedTransportEnvelope(corpus.controls[0].serialized).candidate, BASE);
  for (const item of corpus.controls.slice(1)) {
    assert.deepEqual(parseBoundedTransportEnvelope(item.serialized).candidate, { markerProbe: 0 }, item.caseId);
  }
});

test("raw controls in the marker value fail JSON syntax", () => {
  const items = corpus.rejections.filter((item) => item.family === "RAW_CONTROL_IN_MARKER_VALUE");
  assert.equal(items.length, 3);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /MALFORMED_JSON/, item.caseId);
});

test("escaped controls decode but fail exact marker comparison", () => {
  const items = corpus.rejections.filter((item) => item.family === "ESCAPED_CONTROL_IN_MARKER_VALUE");
  assert.equal(items.length, 4);
  for (const item of items) assert.throws(() => parseBoundedTransportEnvelope(item.serialized), /INVALID_TRANSPORT_ENVELOPE/, item.caseId);
});

test("case variants do not gain authority through case folding", () => {
  const results = artifact.rejections.filter((item) => item.family === "CASE_VARIANT");
  assert.equal(results.length, 3);
  assert.equal(results.every((item) => item.caseInsensitiveMatchesCanonical && item.observedError === "INVALID_TRANSPORT_ENVELOPE"), true);
});

test("NFKC-equivalent variants do not gain authority through normalization", () => {
  const results = artifact.rejections.filter((item) => item.family === "NORMALIZATION_VARIANT");
  assert.equal(results.length, 4);
  assert.equal(results.every((item) => item.nfkcMatchesCanonical && item.observedError === "INVALID_TRANSPORT_ENVELOPE"), true);
});

test("cross-script confusables do not gain marker authority", () => {
  const results = artifact.rejections.filter((item) => item.family === "CROSS_SCRIPT_CONFUSABLE");
  assert.equal(results.length, 2);
  assert.equal(results.every((item) => item.confusableCrossScript && item.observedError === "INVALID_TRANSPORT_ENVELOPE"), true);
});

test("all sixteen compact results retain their exact pre-candidate boundaries", () => {
  const raw = artifact.rejections.filter((item) => item.family === "RAW_CONTROL_IN_MARKER_VALUE");
  const decoded = artifact.rejections.filter((item) => item.family !== "RAW_CONTROL_IN_MARKER_VALUE");
  assert.equal(raw.every((item) => item.observedError === "MALFORMED_JSON"), true);
  assert.equal(decoded.every((item) => item.observedError === "INVALID_TRANSPORT_ENVELOPE"), true);
  assert.equal(artifact.rejections.every((item) => item.rejectedBeforeCandidate && !item.candidateProduced && !item.mutationEvaluated), true);
  assert.equal(Object.hasOwn(artifact, "serializedRepresentations"), false);
  assert.equal(Object.hasOwn(artifact, "runtimeCandidates"), false);
});

test("independent Python reproduces every marker-value result", () => {
  assert.ok(PYTHON, "Python 3 is required for marker-value parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-marker-value-audit", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.acceptedControlCount, 4);
  assert.equal(report.rejectionCount, 16);
  assert.equal(report.combinedReplayCommitmentSha256, artifact.summary.combinedReplayCommitmentSha256);
});

test("independent Python rejects changed marker-value evidence with exit 2", () => {
  assert.ok(PYTHON, "Python 3 is required for marker-value tamper replay");
  const directory = mkdtempSync(join(tmpdir(), "iat-marker-value-audit-"));
  try {
    const changed = structuredClone(artifact);
    changed.rejections[0].observedError = "INVALID_TRANSPORT_ENVELOPE";
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-marker-value-audit", "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("marker-value rejections drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("marker-value tooling is offline, powerless, and manifest-covered", () => {
  const expected = {
    "SETTLEMENT_CONTENTION_MARKER_VALUE_AUDIT.md": "ARTIFACT",
    "generate-settlement-contention-composition-marker-value-audit.mjs": "GENERATOR",
    "settlement-contention-composition-marker-value-audit.v1.json": "ARTIFACT",
    "tests/settlement-contention-marker-value-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-marker-value-audit.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  assert.equal(artifact.contract.serializedRepresentationsStored, false);
  assert.equal(artifact.contract.runtimeCandidatesStored, false);
  const sources = [
    "generate-settlement-contention-composition-marker-value-audit.mjs",
    "settlement-contention-composition-transport-limits.mjs",
    "validate-settlement-contention-composition-marker-value-audit.mjs",
    "verify-settlement-contention-transport-limits.py",
  ].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

/** DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { canonicalSha256 } from "../compose-program-interface-preview.mjs";
import { generateVisibleViewAliasMutationAudit } from "../generate-settlement-contention-composition-visible-view-alias-mutation-audit.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  buildVisibleViewAliasMutationCorpus,
  parseBoundedTransportEnvelopeBytes,
  VISIBLE_VIEW_ALIAS_MUTATION_RULES,
} from "../settlement-contention-composition-transport-limits.mjs";
import {
  loadVisibleViewAliasMutationAudit,
  validateVisibleViewAliasMutationAudit,
} from "../validate-settlement-contention-composition-visible-view-alias-mutation-audit.mjs";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const VERIFIER = fileURLToPath(new URL("../verify-settlement-contention-transport-limits.py", import.meta.url));
const candidates = [process.env.PYTHON, "python3", "python"].filter(Boolean);
const PYTHON = candidates.find((candidate) => spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0);
const artifact = loadVisibleViewAliasMutationAudit();

test("visible-view alias-mutation audit deterministically regenerates", () => {
  assert.deepEqual(validateVisibleViewAliasMutationAudit(artifact), []);
  assert.deepEqual(generateVisibleViewAliasMutationAudit(), artifact);
  assert.equal(artifact.summary.outsideControlSetCommitmentSha256, "e9007be1e32fffb794d3906d26d11f022c1f41c403344a9cf7336425019aceba");
  assert.equal(artifact.summary.insideDetectionSetCommitmentSha256, "36fada8a538372117c75f3bba800840b2b6a1187bc0940ad9e634634aece868c");
  assert.equal(artifact.summary.combinedReplayCommitmentSha256, "d22fbc58baff02839d8074f475e9347ad702a04cf8727f21dca457c31565b8cd");
});

test("visible-view alias-mutation rule fixes isolation and detection", () => {
  assert.deepEqual(VISIBLE_VIEW_ALIAS_MUTATION_RULES, {
    acceptedInputType: "Uint8Array",
    sharedBackingBufferRequired: true,
    outsideViewMutationsAffectVisibleBytes: false,
    outsideViewMutationsAffectCandidate: false,
    insideViewMutationsDetected: true,
    detectionModes: ["CANDIDATE_COMMITMENT_CHANGED", "PARSER_REJECTION"],
    backingByteSequencesStored: false,
    visibleByteSequencesStored: false,
  });
  assert.deepEqual(artifact.contract.visibleViewAliasMutationRules, VISIBLE_VIEW_ALIAS_MUTATION_RULES);
});

test("every runtime view aliases its backing buffer", () => {
  const corpus = buildVisibleViewAliasMutationCorpus();
  for (const item of [...corpus.outsideControls, ...corpus.insideDetections]) {
    assert.ok(item.serializedBytes instanceof Uint8Array);
    assert.equal(item.serializedBytes.buffer, item.backingBytes.buffer);
    assert.equal(item.serializedBytes.byteOffset, item.backingBytes.byteOffset + item.byteOffset);
  }
});

test("excluded prefix alias mutation cannot change visible bytes or candidate", () => {
  const item = buildVisibleViewAliasMutationCorpus().outsideControls[0];
  const beforeVisible = Uint8Array.from(item.serializedBytes);
  const beforeCommitment = canonicalSha256(parseBoundedTransportEnvelopeBytes(item.serializedBytes).candidate);
  item.backingBytes[item.mutationBackingIndex] = item.replacementByte;
  assert.deepEqual(item.serializedBytes, beforeVisible);
  assert.equal(canonicalSha256(parseBoundedTransportEnvelopeBytes(item.serializedBytes).candidate), beforeCommitment);
});

test("both excluded suffix alias mutations preserve view and candidate", () => {
  for (const item of buildVisibleViewAliasMutationCorpus().outsideControls.slice(1)) {
    const beforeVisible = Uint8Array.from(item.serializedBytes);
    const beforeCommitment = canonicalSha256(parseBoundedTransportEnvelopeBytes(item.serializedBytes).candidate);
    item.backingBytes[item.mutationBackingIndex] = item.replacementByte;
    assert.deepEqual(item.serializedBytes, beforeVisible);
    assert.equal(canonicalSha256(parseBoundedTransportEnvelopeBytes(item.serializedBytes).candidate), beforeCommitment);
  }
});

test("inside candidate alias mutation changes the candidate commitment", () => {
  const item = buildVisibleViewAliasMutationCorpus().insideDetections[0];
  const beforeCommitment = canonicalSha256(parseBoundedTransportEnvelopeBytes(item.serializedBytes).candidate);
  item.backingBytes[item.mutationBackingIndex] = item.replacementByte;
  const afterCommitment = canonicalSha256(parseBoundedTransportEnvelopeBytes(item.serializedBytes).candidate);
  assert.notEqual(afterCommitment, beforeCommitment);
  assert.equal(artifact.insideDetections[0].candidateCommitmentChanged, true);
});

test("inside marker alias mutation rejects exact envelope semantics", () => {
  const item = buildVisibleViewAliasMutationCorpus().insideDetections[1];
  item.backingBytes[item.mutationBackingIndex] = item.replacementByte;
  assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /INVALID_TRANSPORT_ENVELOPE/);
});

test("inside final-delimiter alias mutation rejects JSON syntax", () => {
  const item = buildVisibleViewAliasMutationCorpus().insideDetections[2];
  item.backingBytes[item.mutationBackingIndex] = item.replacementByte;
  assert.throws(() => parseBoundedTransportEnvelopeBytes(item.serializedBytes), /MALFORMED_JSON/);
});

test("compact evidence publishes hashes and regions without runtime bytes or candidates", () => {
  const all = [...artifact.outsideControls, ...artifact.insideDetections];
  assert.equal(all.every((item) => item.runtimeBytesStored === false && item.runtimeCandidatesStored === false && item.aliasMutationEvaluated === true && item.campaignMutationEvaluated === false), true);
  assert.equal(all.every((item) => item.beforeBackingRepresentationSha256 !== item.afterBackingRepresentationSha256), true);
  for (const field of ["backingBytes", "serializedBytes", "serializedView", "runtimeInput", "runtimeCandidates"]) assert.equal(Object.hasOwn(artifact, field), false);
  assert.equal(artifact.contract.backingByteSequencesStored, false);
  assert.equal(artifact.contract.visibleByteSequencesStored, false);
});

test("independent Python reproduces every visible-view alias mutation", () => {
  assert.ok(PYTHON, "Python 3 is required for visible-view alias-mutation parity");
  const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-visible-view-alias-mutation-audit", "--json"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.valid, true);
  assert.equal(report.outsideControlCount, 3);
  assert.equal(report.insideDetectionCount, 3);
  assert.equal(report.combinedReplayCommitmentSha256, artifact.summary.combinedReplayCommitmentSha256);
});

test("independent Python rejects changed alias-mutation evidence with exit 2", () => {
  assert.ok(PYTHON, "Python 3 is required for visible-view alias-mutation tamper replay");
  const directory = mkdtempSync(join(tmpdir(), "iat-visible-view-alias-mutation-audit-"));
  try {
    const changed = structuredClone(artifact);
    changed.outsideControls[0].visibleBytesChanged = true;
    const path = join(directory, "changed.json");
    writeFileSync(path, `${JSON.stringify(changed, null, 2)}\n`, "utf8");
    const result = spawnSync(PYTHON, [VERIFIER, "--root", ROOT, "--verify-visible-view-alias-mutation-audit", "--artifact", path, "--json"], { encoding: "utf8" });
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.ok(JSON.parse(result.stdout).errors.some((error) => error.includes("visible-view alias-mutation outside controls drift")));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("visible-view alias-mutation tooling is offline, powerless, and manifest-covered", () => {
  const expected = {
    "SETTLEMENT_CONTENTION_VISIBLE_VIEW_ALIAS_MUTATION_AUDIT.md": "ARTIFACT",
    "generate-settlement-contention-composition-visible-view-alias-mutation-audit.mjs": "GENERATOR",
    "settlement-contention-composition-visible-view-alias-mutation-audit.v1.json": "ARTIFACT",
    "tests/settlement-contention-visible-view-alias-mutation-audit.test.mjs": "TEST",
    "validate-settlement-contention-composition-visible-view-alias-mutation-audit.mjs": "VALIDATOR",
  };
  const actual = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expected, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(actual, expected);
  const sources = [
    "generate-settlement-contention-composition-visible-view-alias-mutation-audit.mjs",
    "settlement-contention-composition-transport-limits.mjs",
    "validate-settlement-contention-composition-visible-view-alias-mutation-audit.mjs",
    "verify-settlement-contention-transport-limits.py",
  ].map((path) => readFileSync(join(ROOT, path), "utf8")).join("\n");
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
});

#!/usr/bin/env node

import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const sandbox = mkdtempSync(join(tmpdir(), "iat-v2-ceremony-review-"));
const reviewPath = "launch/iat-v2-ceremony-review.template.json";
const validatorPath = "scripts/validate-iat-v2-ceremony-review.mjs";
const sourcePaths = [
  "launch/iat-v2-mainnet-readiness-gate.json",
  "launch/iat-v2-mainnet-stage-journal.template.json",
  "engagement/iat-economic-policy.v2.json",
  "launch/iat-v2-allocation-plan.template.json",
  "public/audits/iat-v2-remediation-20260802/manifest.json",
  "launch/iat-v2-local-time-gate-proof.json",
];
const clone = (value) => structuredClone(value);
const baseline = JSON.parse(readFileSync(join(root, reviewPath), "utf8"));

function copy(relativePath) {
  const target = join(sandbox, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(root, relativePath), target);
}
function writeJson(relativePath, value) {
  const target = join(sandbox, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function sha256(relativePath) {
  return createHash("sha256").update(readFileSync(join(sandbox, relativePath))).digest("hex");
}
function validate(review) {
  writeJson(reviewPath, review);
  return spawnSync(process.execPath, [validatorPath], { cwd: sandbox, encoding: "utf8" });
}
function expectPass(name, review) {
  const result = validate(review);
  if (result.status !== 0) throw new Error(`${name} should pass:\n${result.stderr}${result.stdout}`);
}
function expectFail(name, review, needle) {
  const result = validate(review);
  if (result.status === 0 || !`${result.stderr}${result.stdout}`.includes(needle)) {
    throw new Error(`${name} should fail with ${JSON.stringify(needle)}:\n${result.stderr}${result.stdout}`);
  }
}

function readyFixture() {
  const gatePath = "launch/iat-v2-mainnet-readiness-gate.json";
  const journalPath = "launch/iat-v2-mainnet-stage-journal.template.json";
  const gate = JSON.parse(readFileSync(join(sandbox, gatePath), "utf8"));
  gate.schedule.state = "SCHEDULED_HOLD";
  gate.schedule.publishedAtUtc = new Date().toISOString();
  gate.gates.releaseArtifactsRegeneratedAfterFundingAndScheduling = true;
  writeJson(gatePath, gate);
  const journal = JSON.parse(readFileSync(join(sandbox, journalPath), "utf8"));
  journal.status = "ARMED";
  writeJson(journalPath, journal);

  const review = clone(baseline);
  review.status = "READY";
  const digestSources = {
    readinessGateSha256: gatePath,
    stageJournalSha256: journalPath,
    policySha256: "engagement/iat-economic-policy.v2.json",
    allocationPlanSha256: "launch/iat-v2-allocation-plan.template.json",
    remediationAuditSha256: "public/audits/iat-v2-remediation-20260802/manifest.json",
    localTimeGateProofSha256: "launch/iat-v2-local-time-gate-proof.json",
  };
  for (const [field, sourcePath] of Object.entries(digestSources)) review.artifactDigests[field] = sha256(sourcePath);
  Object.assign(review.participants.soleTrezorOperator, {
    label: "Attended Model T operator",
    publicAddress: gate.funding.publicAddress,
    devicePathReviewed: true,
  });
  Object.assign(review.participants.independentVerifier, {
    label: "Independent evidence verifier",
    reviewedArtifacts: true,
    reviewedStagePlan: true,
  });
  Object.assign(review.review, {
    releaseArtifactsRegeneratedAfterFundingAndScheduling: true,
    replacementUtcWindowReviewed: true,
    currentSbfDigestReviewed: true,
    currentSignedDevnetEvidenceReviewed: true,
    readyAtUtc: new Date().toISOString(),
  });
  return review;
}

try {
  for (const relativePath of [reviewPath, validatorPath, ...sourcePaths]) copy(relativePath);
  expectPass("canonical HOLD", clone(baseline));

  const staleHold = clone(baseline);
  staleHold.artifactDigests.policySha256 = "a".repeat(64);
  expectFail("HOLD retaining a digest", staleHold, "HOLD must clear every artifact digest");

  const secretField = clone(baseline);
  secretField.participants.soleTrezorOperator.derivationPath = "redacted";
  expectFail("credential-shaped field", secretField, "credential-bearing field");

  const falseSeparation = clone(baseline);
  falseSeparation.controls.authorityRoleSeparationClaimed = true;
  expectFail("false authority separation claim", falseSeparation, "authorityRoleSeparationClaimed must remain false");

  const ready = readyFixture();
  expectPass("fully bound READY", ready);

  const driftedDigest = clone(ready);
  driftedDigest.artifactDigests.policySha256 = "b".repeat(64);
  expectFail("source digest drift", driftedDigest, "policySha256 must match the canonical V2 artifact");

  const mismatchedOperator = clone(ready);
  mismatchedOperator.participants.soleTrezorOperator.publicAddress = "Vote111111111111111111111111111111111111111";
  expectFail("unbound operator address", mismatchedOperator, "operator address must match the reviewed mainnet funding/administrator address");

  const sameReviewer = clone(ready);
  sameReviewer.participants.independentVerifier.label = sameReviewer.participants.soleTrezorOperator.label;
  expectFail("operator reused as verifier", sameReviewer, "verifier distinct from the sole-Trezor operator");

  const missingSignedDevnetReview = clone(ready);
  missingSignedDevnetReview.review.currentSignedDevnetEvidenceReviewed = false;
  expectFail("missing signed Devnet review", missingSignedDevnetReview, "current signed Devnet evidence review");

  const holdJournal = JSON.parse(readFileSync(join(sandbox, "launch/iat-v2-mainnet-stage-journal.template.json"), "utf8"));
  holdJournal.status = "HOLD";
  writeJson("launch/iat-v2-mainnet-stage-journal.template.json", holdJournal);
  const unarmed = clone(ready);
  unarmed.artifactDigests.stageJournalSha256 = sha256("launch/iat-v2-mainnet-stage-journal.template.json");
  expectFail("unarmed stage journal", unarmed, "stage journal to be ARMED");

  console.log("IAT V2 ceremony-review regression passed: HOLD hygiene, V2-only source binding, sole-Trezor truthfulness, independent verifier separation, signed-Devnet review, stage arming, credential rejection, and digest drift all fail closed.");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

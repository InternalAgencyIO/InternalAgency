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
  gate.schedule.scheduledAtUtc = new Date(Date.now() + 60 * 60_000).toISOString();
  gate.gates.releaseArtifactsRegeneratedAfterFundingAndScheduling = true;
  gate.gates.automatedSourceReceiptStateObservationComplete = true;
  writeJson(gatePath, gate);
  const journal = JSON.parse(readFileSync(join(sandbox, journalPath), "utf8"));
  journal.status = "ARMED";
  writeJson(journalPath, journal);
  const remediationPath = "public/audits/iat-v2-remediation-20260802/manifest.json";
  const remediation = JSON.parse(readFileSync(join(sandbox, remediationPath), "utf8"));
  remediation.clearance.freshCurrentSourceSbfComplete = true;
  remediation.clearance.freshSignedDevnetComplete = true;
  writeJson(remediationPath, remediation);

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
  Object.assign(review.signatureGate.soleTrezorOperator, {
    label: "Attended Model T operator",
    publicAddress: gate.funding.publicAddress,
    devicePathReviewed: true,
  });
  Object.assign(review.observation, {
    releaseArtifactsRegeneratedAfterFundingAndScheduling: true,
    replacementUtcWindowObserved: true,
    currentSbfDigestObserved: true,
    currentSignedDevnetReceiptObserved: true,
    stagePlanStateObserved: true,
    observedAtUtc: new Date().toISOString(),
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
  secretField.signatureGate.soleTrezorOperator.derivationPath = "redacted";
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
  mismatchedOperator.signatureGate.soleTrezorOperator.publicAddress = "Vote111111111111111111111111111111111111111";
  expectFail("unbound operator address", mismatchedOperator, "operator address must match the reviewed mainnet funding/administrator address");

  const injectedReviewer = clone(ready);
  injectedReviewer.signatureGate.independentVerifier = { role: "INDEPENDENT_VERIFIER" };
  expectFail("human reviewer injection", injectedReviewer, "signatureGate must contain only the sole Trezor operator");

  const missingSignedDevnetObservation = clone(ready);
  missingSignedDevnetObservation.observation.currentSignedDevnetReceiptObserved = false;
  expectFail("missing signed Devnet receipt observation", missingSignedDevnetObservation, "signed Devnet receipt observation");

  const assertionOnlySbf = clone(ready);
  const remediationPath = "public/audits/iat-v2-remediation-20260802/manifest.json";
  const remediation = JSON.parse(readFileSync(join(sandbox, remediationPath), "utf8"));
  remediation.clearance.freshCurrentSourceSbfComplete = false;
  writeJson(remediationPath, remediation);
  assertionOnlySbf.artifactDigests.remediationAuditSha256 = sha256(remediationPath);
  expectFail("assertion-only SBF observation", assertionOnlySbf, "source-bound SBF observation");
  remediation.clearance.freshCurrentSourceSbfComplete = true;
  writeJson(remediationPath, remediation);

  const holdJournal = JSON.parse(readFileSync(join(sandbox, "launch/iat-v2-mainnet-stage-journal.template.json"), "utf8"));
  holdJournal.status = "HOLD";
  writeJson("launch/iat-v2-mainnet-stage-journal.template.json", holdJournal);
  const unarmed = clone(ready);
  unarmed.artifactDigests.stageJournalSha256 = sha256("launch/iat-v2-mainnet-stage-journal.template.json");
  expectFail("unarmed stage journal", unarmed, "stage journal to be ARMED");

  const missingCeremonyTimeGate = JSON.parse(readFileSync(join(sandbox, "launch/iat-v2-mainnet-readiness-gate.json"), "utf8"));
  missingCeremonyTimeGate.schedule.scheduledAtUtc = null;
  writeJson("launch/iat-v2-mainnet-readiness-gate.json", missingCeremonyTimeGate);
  const missingCeremonyTime = clone(ready);
  missingCeremonyTime.artifactDigests.readinessGateSha256 = sha256("launch/iat-v2-mainnet-readiness-gate.json");
  expectFail("READY without exact ceremony time", missingCeremonyTime, "exact replacement UTC ceremony time");

  console.log("IAT V2 ceremony-review regression passed: HOLD hygiene, exact UTC scheduling, V2-only source binding, sole-Model-T signature truth, automated source/receipt/state observation, stage arming, credential rejection, and digest drift all fail closed.");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

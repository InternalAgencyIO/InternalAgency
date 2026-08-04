#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assessCanonicalCeremonyEntry,
  assessCeremonyEntry,
} from "./assess-iat-v2-mainnet-ceremony-entry.mjs";

const gate = JSON.parse(readFileSync(resolve("launch/iat-v2-mainnet-readiness-gate.json"), "utf8"));
const audit = JSON.parse(readFileSync(resolve("public/audits/iat-v2-prelaunch-20260802/manifest.json"), "utf8"));
const remediationAudit = JSON.parse(readFileSync(resolve("public/audits/iat-v2-remediation-20260802/manifest.json"), "utf8"));
const ceremonyReview = JSON.parse(readFileSync(resolve("launch/iat-v2-ceremony-review.template.json"), "utf8"));
const stageJournal = JSON.parse(readFileSync(resolve("launch/iat-v2-mainnet-stage-journal.template.json"), "utf8"));
const currentNowMs = Date.parse("2026-08-01T08:18:04Z");
const canonicalValidation = { readiness: true, prelaunch: true, remediation: true };
const canonicalCeremonyArtifacts = {
  ceremonyReview,
  stageJournal,
  validation: { ceremonyReview: true, stageJournal: true },
};
const current = assessCeremonyEntry(
  gate,
  "0".repeat(64),
  currentNowMs,
  audit,
  remediationAudit,
  canonicalValidation,
  canonicalCeremonyArtifacts,
);
assert.equal(current.state, "HOLD");
assert.equal(current.mainnetStatus, "HOLD");
assert.deepEqual(current.blockers, [
  "PRELAUNCH_SECURITY_AUDIT_CLEARANCE",
  "REMEDIATION_SECURITY_AUDIT_CLEARANCE",
  "FRESH_READ_ONLY_FUNDING_OBSERVATION",
  "MAINNET_FUNDING_FLOOR",
  "REPLACEMENT_UTC_WINDOW",
  "BOUND_RELEASE_ARTIFACTS_REGENERATED",
  "INDEPENDENT_MAINNET_VERIFIER_ASSIGNED",
  "MODEL_T_DEVICE_PATH_REVIEWED",
]);
assert.ok(current.limitations.every((value) => typeof value === "string" && value.length > 0));

const cli = resolve("scripts/assess-iat-v2-mainnet-ceremony-entry.mjs");
const holdResult = spawnSync(process.execPath, [cli, "--require-ready"], { encoding: "utf8" });
assert.equal(holdResult.status, 1);
assert.match(holdResult.stderr, /CEREMONY ENTRY BLOCKED/);
assert.match(holdResult.stderr, /Mainnet remains HOLD/);

const preflightResult = spawnSync(
  process.execPath,
  [resolve("scripts/run-launch-preflight.mjs"), "--require-ceremony-ready"],
  { encoding: "utf8" },
);
assert.equal(preflightResult.status, 1);
assert.match(preflightResult.stderr, /CEREMONY ENTRY BLOCKED/);
assert.doesNotMatch(preflightResult.stdout, /== test-accountability-label-normalization\.mjs ==/);

const readyGate = structuredClone(gate);
const readyAudit = structuredClone(audit);
const readyRemediationAudit = structuredClone(remediationAudit);
const readyCeremonyReview = structuredClone(ceremonyReview);
const readyStageJournal = structuredClone(stageJournal);
readyGate.funding.ceremonyFloorSatisfied = true;
readyGate.funding.observedLamports = readyGate.funding.ceremonyFloorLamports;
readyGate.observedAtUtc = "2099-01-01T00:00:00Z";
readyGate.schedule.state = "SCHEDULED_HOLD";
readyGate.schedule.publishedAtUtc = "2099-01-01T00:00:00Z";
readyGate.schedule.scheduledAtUtc = "2099-01-01T01:00:00Z";
readyGate.gates.releaseArtifactsRegeneratedAfterFundingAndScheduling = true;
readyGate.gates.independentMainnetVerifierAssigned = true;
readyGate.gates.physicalModelTDevicePathReviewed = true;
readyCeremonyReview.status = "READY";
readyCeremonyReview.review.releaseArtifactsRegeneratedAfterFundingAndScheduling = true;
Object.assign(readyCeremonyReview.participants.independentVerifier, {
  label: "Independent evidence verifier",
  reviewedArtifacts: true,
  reviewedStagePlan: true,
});
Object.assign(readyCeremonyReview.participants.soleTrezorOperator, {
  label: "Attended Model T operator",
  publicAddress: readyGate.funding.publicAddress,
  devicePathReviewed: true,
});
readyStageJournal.status = "ARMED";
const readyCeremonyArtifacts = {
  ceremonyReview: readyCeremonyReview,
  stageJournal: readyStageJournal,
  validation: { ceremonyReview: true, stageJournal: true },
};
readyAudit.launchDecision = "CLEAR";
readyAudit.findingSummary.openBySeverity.CRITICAL = 0;
readyAudit.findingSummary.openBySeverity.HIGH = 0;
readyAudit.clearance.securityBlockersResolved = true;
readyAudit.clearance.independentAuditComplete = true;
readyRemediationAudit.launchDecision = "CLEAR";
readyRemediationAudit.findingSummary.openBySeverity.CRITICAL = 1;
readyRemediationAudit.findingSummary.openBySeverity.HIGH = 0;
readyRemediationAudit.findingSummary.remediatedPendingReview = 0;
readyRemediationAudit.findingSummary.openBlockers = 0;
readyRemediationAudit.clearance.securityBlockersResolved = true;
readyRemediationAudit.clearance.independentAuditComplete = true;
readyRemediationAudit.clearance.freshCurrentSourceSbfComplete = true;
readyRemediationAudit.clearance.freshSignedDevnetComplete = true;
readyRemediationAudit.clearance.productionIdentityIntegrationComplete = true;
const ready = assessCeremonyEntry(
  readyGate,
  "f".repeat(64),
  Date.parse("2099-01-01T00:15:00Z"),
  readyAudit,
  readyRemediationAudit,
  canonicalValidation,
  readyCeremonyArtifacts,
);
assert.equal(ready.state, "READY_FOR_ATTENDED_PREFLIGHT");
assert.equal(ready.mainnetStatus, "HOLD_PENDING_ATTENDED_PREFLIGHT");
assert.deepEqual(ready.blockers, []);
assert.equal(ready.checks.MAINNET_HOLD_BOUNDARY, true);
assert.equal(ready.checks.MAINNET_READINESS_CANONICAL_VALIDATION, true);
assert.equal(ready.checks.LOCAL_TIME_GATE_CLASSIFICATION, true);
assert.equal(ready.checks.PRELAUNCH_AUDIT_CANONICAL_VALIDATION, true);
assert.equal(ready.checks.PRELAUNCH_SECURITY_AUDIT_CLEARANCE, true);
assert.equal(ready.checks.REMEDIATION_AUDIT_CANONICAL_VALIDATION, true);
assert.equal(ready.checks.REMEDIATION_SECURITY_AUDIT_CLEARANCE, true);
assert.equal(ready.checks.FRESH_READ_ONLY_FUNDING_OBSERVATION, true);
assert.equal(ready.checks.MAINNET_FUNDING_FLOOR, true);
assert.equal(ready.checks.REPLACEMENT_UTC_WINDOW, true);
assert.equal(ready.checks.V2_CEREMONY_REVIEW_CANONICAL_VALIDATION, true);
assert.equal(ready.checks.V2_STAGE_JOURNAL_CANONICAL_VALIDATION, true);
assert.equal(ready.checks.BOUND_RELEASE_ARTIFACTS_REGENERATED, true);
assert.equal(ready.checks.INDEPENDENT_MAINNET_VERIFIER_ASSIGNED, true);
assert.equal(ready.checks.MODEL_T_DEVICE_PATH_REVIEWED, true);

for (const [name, scheduledAtUtc] of [
  ["missing exact ceremony time", null],
  ["ceremony time before publication", "2098-12-31T23:59:59Z"],
  ["expired ceremony time", "2099-01-01T00:10:00Z"],
]) {
  const candidate = structuredClone(readyGate);
  candidate.schedule.scheduledAtUtc = scheduledAtUtc;
  const rejected = assessCeremonyEntry(
    candidate,
    "f".repeat(64),
    Date.parse("2099-01-01T00:15:00Z"),
    readyAudit,
    readyRemediationAudit,
    canonicalValidation,
    readyCeremonyArtifacts,
  );
  assert.equal(rejected.state, "HOLD", name);
  assert.ok(rejected.blockers.includes("REPLACEMENT_UTC_WINDOW"), name);
}

for (const [name, publishedAtUtc] of [
  ["noncanonical publication time", "2099-01-01T00:00:00.000Z"],
  ["future publication time", "2099-01-01T00:16:01Z"],
]) {
  const candidate = structuredClone(readyGate);
  candidate.schedule.publishedAtUtc = publishedAtUtc;
  const rejected = assessCeremonyEntry(
    candidate,
    "f".repeat(64),
    Date.parse("2099-01-01T00:15:00Z"),
    readyAudit,
    readyRemediationAudit,
    canonicalValidation,
    readyCeremonyArtifacts,
  );
  assert.equal(rejected.state, "HOLD", name);
  assert.ok(rejected.blockers.includes("REPLACEMENT_UTC_WINDOW"), name);
}

for (const mutate of [
  (candidate) => { candidate.findingSummary.openBySeverity.CRITICAL = 2; },
  (candidate) => { candidate.authorityDisposition.classifiedAsRoleSeparation = true; },
  (candidate) => { candidate.clearance.freshCurrentSourceSbfComplete = false; },
  (candidate) => { candidate.clearance.productionIdentityIntegrationComplete = false; },
]) {
  const candidate = structuredClone(readyRemediationAudit);
  mutate(candidate);
  const rejected = assessCeremonyEntry(
    readyGate,
    "f".repeat(64),
    Date.parse("2099-01-01T00:15:00Z"),
    readyAudit,
    candidate,
    canonicalValidation,
    readyCeremonyArtifacts,
  );
  assert.equal(rejected.state, "HOLD");
  assert.ok(rejected.blockers.includes("REMEDIATION_SECURITY_AUDIT_CLEARANCE"));
}

for (const auditValidation of [
  { readiness: false, prelaunch: true, remediation: true },
  { readiness: true, prelaunch: false, remediation: true },
  { readiness: true, prelaunch: true, remediation: false },
]) {
  const rejected = assessCeremonyEntry(
    readyGate,
    "f".repeat(64),
    Date.parse("2099-01-01T00:15:00Z"),
    readyAudit,
    readyRemediationAudit,
    auditValidation,
    readyCeremonyArtifacts,
  );
  assert.equal(rejected.state, "HOLD");
  const expectedBlocker = !auditValidation.readiness
    ? "MAINNET_READINESS_CANONICAL_VALIDATION"
    : !auditValidation.prelaunch
      ? "PRELAUNCH_AUDIT_CANONICAL_VALIDATION"
      : "REMEDIATION_AUDIT_CANONICAL_VALIDATION";
  assert.ok(rejected.blockers.includes(expectedBlocker));
}

for (const [name, mutate, blockers] of [
  [
    "V2 ceremony-review validator failure",
    (artifacts) => { artifacts.validation.ceremonyReview = false; },
    ["V2_CEREMONY_REVIEW_CANONICAL_VALIDATION", "BOUND_RELEASE_ARTIFACTS_REGENERATED", "INDEPENDENT_MAINNET_VERIFIER_ASSIGNED", "MODEL_T_DEVICE_PATH_REVIEWED"],
  ],
  [
    "HOLD V2 ceremony review with true readiness summaries",
    (artifacts) => { artifacts.ceremonyReview.status = "HOLD"; },
    ["BOUND_RELEASE_ARTIFACTS_REGENERATED", "INDEPENDENT_MAINNET_VERIFIER_ASSIGNED", "MODEL_T_DEVICE_PATH_REVIEWED"],
  ],
  [
    "V2 stage-journal validator failure",
    (artifacts) => { artifacts.validation.stageJournal = false; },
    ["V2_STAGE_JOURNAL_CANONICAL_VALIDATION", "BOUND_RELEASE_ARTIFACTS_REGENERATED"],
  ],
  [
    "HOLD stage journal with a true regeneration summary",
    (artifacts) => { artifacts.stageJournal.status = "HOLD"; },
    ["BOUND_RELEASE_ARTIFACTS_REGENERATED"],
  ],
  [
    "unreviewed V2 artifacts with a named verifier",
    (artifacts) => { artifacts.ceremonyReview.participants.independentVerifier.reviewedArtifacts = false; },
    ["INDEPENDENT_MAINNET_VERIFIER_ASSIGNED"],
  ],
  [
    "operator reused through whitespace and format characters",
    (artifacts) => { artifacts.ceremonyReview.participants.independentVerifier.label = "  ATTENDED\u200b   MODEL T OPERATOR  "; },
    ["INDEPENDENT_MAINNET_VERIFIER_ASSIGNED"],
  ],
  [
    "operator address outside the sole-Trezor readiness record",
    (artifacts) => { artifacts.ceremonyReview.participants.soleTrezorOperator.publicAddress = "Vote111111111111111111111111111111111111111"; },
    ["MODEL_T_DEVICE_PATH_REVIEWED"],
  ],
]) {
  const artifacts = structuredClone(readyCeremonyArtifacts);
  mutate(artifacts);
  const rejected = assessCeremonyEntry(
    readyGate,
    "f".repeat(64),
    Date.parse("2099-01-01T00:15:00Z"),
    readyAudit,
    readyRemediationAudit,
    canonicalValidation,
    artifacts,
  );
  assert.equal(rejected.state, "HOLD", name);
  for (const blocker of blockers) assert.ok(rejected.blockers.includes(blocker), `${name}: ${blocker}`);
}

const canonical = await assessCanonicalCeremonyEntry();
assert.equal(canonical.state, "HOLD");
assert.equal(canonical.readinessValidatorExitCode, 0);
assert.equal(canonical.checks.MAINNET_READINESS_CANONICAL_VALIDATION, true);

console.log("IAT V2 ceremony-entry regression passed: the readiness ledger, audits, V2 ceremony review, and V2 stage journal require same-assessment canonical validation; synthetic ready state permits exactly one named owner-accepted Trezor risk while missing, expired, or impossible UTC windows, unaccepted criticals, stale artifacts, unreviewed verifier data, and an unbound Model T address remain blockers.");

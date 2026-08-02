#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { assessCeremonyEntry } from "./assess-iat-v2-mainnet-ceremony-entry.mjs";

const gate = JSON.parse(readFileSync(resolve("launch/iat-v2-mainnet-readiness-gate.json"), "utf8"));
const audit = JSON.parse(readFileSync(resolve("public/audits/iat-v2-prelaunch-20260802/manifest.json"), "utf8"));
const remediationAudit = JSON.parse(readFileSync(resolve("public/audits/iat-v2-remediation-20260802/manifest.json"), "utf8"));
const currentNowMs = Date.parse("2026-08-01T08:18:04Z");
const current = assessCeremonyEntry(gate, "0".repeat(64), currentNowMs, audit, remediationAudit);
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
readyGate.funding.ceremonyFloorSatisfied = true;
readyGate.funding.observedLamports = readyGate.funding.ceremonyFloorLamports;
readyGate.observedAtUtc = "2099-01-01T00:00:00Z";
readyGate.schedule.state = "SCHEDULED_HOLD";
readyGate.schedule.publishedAtUtc = "2099-01-01T00:00:00Z";
readyGate.gates.releaseArtifactsRegeneratedAfterFundingAndScheduling = true;
readyGate.gates.independentMainnetVerifierAssigned = true;
readyGate.gates.physicalModelTDevicePathReviewed = true;
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
);
assert.equal(ready.state, "READY_FOR_ATTENDED_PREFLIGHT");
assert.equal(ready.mainnetStatus, "HOLD_PENDING_ATTENDED_PREFLIGHT");
assert.deepEqual(ready.blockers, []);
assert.equal(ready.checks.MAINNET_HOLD_BOUNDARY, true);
assert.equal(ready.checks.LOCAL_TIME_GATE_CLASSIFICATION, true);
assert.equal(ready.checks.PRELAUNCH_SECURITY_AUDIT_CLEARANCE, true);
assert.equal(ready.checks.REMEDIATION_SECURITY_AUDIT_CLEARANCE, true);
assert.equal(ready.checks.FRESH_READ_ONLY_FUNDING_OBSERVATION, true);
assert.equal(ready.checks.MAINNET_FUNDING_FLOOR, true);
assert.equal(ready.checks.REPLACEMENT_UTC_WINDOW, true);
assert.equal(ready.checks.BOUND_RELEASE_ARTIFACTS_REGENERATED, true);
assert.equal(ready.checks.INDEPENDENT_MAINNET_VERIFIER_ASSIGNED, true);
assert.equal(ready.checks.MODEL_T_DEVICE_PATH_REVIEWED, true);

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
  );
  assert.equal(rejected.state, "HOLD");
  assert.ok(rejected.blockers.includes("REMEDIATION_SECURITY_AUDIT_CLEARANCE"));
}

console.log("IAT V2 ceremony-entry regression passed: current ledger fails closed; synthetic ready state permits exactly one named owner-accepted Trezor risk while unaccepted criticals, missing current SBF, and missing identity integration remain blockers.");

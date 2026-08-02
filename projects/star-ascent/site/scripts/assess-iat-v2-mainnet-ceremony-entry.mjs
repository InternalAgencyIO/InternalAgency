#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalGatePath = path.join(siteRoot, "launch/iat-v2-mainnet-readiness-gate.json");
const canonicalAuditPath = path.join(siteRoot, "public/audits/iat-v2-prelaunch-20260802/manifest.json");
const canonicalRemediationAuditPath = path.join(siteRoot, "public/audits/iat-v2-remediation-20260802/manifest.json");

export function assessCeremonyEntry(
  gate,
  sourceSha256,
  nowMs = Date.now(),
  audit = undefined,
  remediationAudit = undefined,
) {
  const observedAtMs = Date.parse(gate.observedAtUtc ?? "");
  const fundingObservationFresh = Number.isFinite(observedAtMs)
    && observedAtMs <= nowMs + 60_000
    && nowMs - observedAtMs <= 30 * 60_000;
  let fundingFloorSatisfied = false;
  try {
    fundingFloorSatisfied = BigInt(gate.funding?.observedLamports ?? "-1")
      >= BigInt(gate.funding?.ceremonyFloorLamports ?? "-1");
  } catch {
    fundingFloorSatisfied = false;
  }
  const replacementUtcPublished = gate.schedule?.state === "SCHEDULED_HOLD"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(gate.schedule?.publishedAtUtc ?? "")
    && Number.isFinite(Date.parse(gate.schedule.publishedAtUtc));
  const securityAuditClear = audit?.launchDecision === "CLEAR"
    && audit?.findingSummary?.openBySeverity?.CRITICAL === 0
    && audit?.findingSummary?.openBySeverity?.HIGH === 0
    && audit?.clearance?.securityBlockersResolved === true
    && audit?.clearance?.independentAuditComplete === true;
  const acceptedCritical = remediationAudit?.findingSummary?.ownerAccepted ?? 0;
  const onlyNamedOwnerAcceptedCriticalRemains = acceptedCritical === 1
    && remediationAudit?.findingSummary?.openBySeverity?.CRITICAL === acceptedCritical
    && remediationAudit?.authorityDisposition?.model === "SOLE_TREZOR_MODEL_T"
    && remediationAudit?.authorityDisposition?.ownerDirected === true
    && remediationAudit?.authorityDisposition?.classifiedAsRoleSeparation === false
    && remediationAudit?.authorityDisposition?.riskStatus === "OPEN_OWNER_ACCEPTED";
  const remediationAuditClear = remediationAudit?.launchDecision === "CLEAR"
    && onlyNamedOwnerAcceptedCriticalRemains
    && remediationAudit?.findingSummary?.openBySeverity?.HIGH === 0
    && remediationAudit?.findingSummary?.remediatedPendingReview === 0
    && remediationAudit?.findingSummary?.openBlockers === 0
    && remediationAudit?.clearance?.securityBlockersResolved === true
    && remediationAudit?.clearance?.independentAuditComplete === true
    && remediationAudit?.clearance?.freshCurrentSourceSbfComplete === true
    && remediationAudit?.clearance?.freshSignedDevnetComplete === true
    && remediationAudit?.clearance?.productionIdentityIntegrationComplete === true;
  const safetyValues = Object.values(gate.safety ?? {});
  const required = [
    ["MAINNET_HOLD_BOUNDARY", gate.status === "HOLD" && gate.network === "mainnet-beta" && safetyValues.length > 0 && safetyValues.every((value) => value === false)],
    ["LOCAL_TIME_GATE_CLASSIFICATION", gate.timeGateEvidence?.status === "VERIFIED_LOCAL_HOST_ONLY" && gate.timeGateEvidence?.signedDevnetEvidence === false && gate.timeGateEvidence?.validatorTransaction === false],
    ["PRELAUNCH_SECURITY_AUDIT_CLEARANCE", securityAuditClear],
    ["REMEDIATION_SECURITY_AUDIT_CLEARANCE", remediationAuditClear],
    ["FRESH_READ_ONLY_FUNDING_OBSERVATION", fundingObservationFresh],
    ["MAINNET_FUNDING_FLOOR", gate.funding?.ceremonyFloorSatisfied === true && fundingFloorSatisfied],
    ["REPLACEMENT_UTC_WINDOW", replacementUtcPublished],
    ["BOUND_RELEASE_ARTIFACTS_REGENERATED", gate.gates?.releaseArtifactsRegeneratedAfterFundingAndScheduling === true],
    ["INDEPENDENT_MAINNET_VERIFIER_ASSIGNED", gate.gates?.independentMainnetVerifierAssigned === true],
    ["MODEL_T_DEVICE_PATH_REVIEWED", gate.gates?.physicalModelTDevicePathReviewed === true],
  ];
  const blockers = required.filter(([, passed]) => !passed).map(([id]) => id);
  return {
    schema: "iat-v2-mainnet-ceremony-entry-assessment/v1",
    sourcePath: "launch/iat-v2-mainnet-readiness-gate.json",
    sourceSha256,
    auditSourcePath: "public/audits/iat-v2-prelaunch-20260802/manifest.json",
    remediationAuditSourcePath: "public/audits/iat-v2-remediation-20260802/manifest.json",
    state: blockers.length === 0 ? "READY_FOR_ATTENDED_PREFLIGHT" : "HOLD",
    mainnetStatus: blockers.length === 0 ? "HOLD_PENDING_ATTENDED_PREFLIGHT" : "HOLD",
    blockers,
    checks: Object.fromEntries(required),
    limitations: [
      "This assessment is local and read-only.",
      "READY_FOR_ATTENDED_PREFLIGHT is not transaction, signing, broadcast, deployment, mint, transfer, or publication authority.",
      "The funding observation must be no more than 30 minutes old with no more than one minute of future skew.",
      "The sole named owner-accepted Trezor concentration risk may remain; every unaccepted critical/high finding and missing current-source assurance is a mandatory blocker.",
      "Physical review of each transaction and separate broadcast approval remain mandatory after entry.",
    ],
  };
}

export async function assessCanonicalCeremonyEntry() {
  const [bytes, auditBytes, remediationAuditBytes] = await Promise.all([
    readFile(canonicalGatePath),
    readFile(canonicalAuditPath),
    readFile(canonicalRemediationAuditPath),
  ]);
  const assessment = assessCeremonyEntry(
    JSON.parse(bytes.toString("utf8")),
    createHash("sha256").update(bytes).digest("hex"),
    Date.now(),
    JSON.parse(auditBytes.toString("utf8")),
    JSON.parse(remediationAuditBytes.toString("utf8")),
  );
  assessment.auditSourceSha256 = createHash("sha256").update(auditBytes).digest("hex");
  assessment.remediationAuditSourceSha256 = createHash("sha256")
    .update(remediationAuditBytes)
    .digest("hex");
  return assessment;
}

const invokedAsCli = process.argv[1]
  && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (invokedAsCli) {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => arg !== "--require-ready");
  if (unknown.length) {
    console.error(`Unknown ceremony-entry option: ${unknown.join(", ")}`);
    process.exit(2);
  }
  const assessment = await assessCanonicalCeremonyEntry();
  console.log(JSON.stringify(assessment, null, 2));
  if (args.includes("--require-ready") && assessment.state !== "READY_FOR_ATTENDED_PREFLIGHT") {
    console.error(`CEREMONY ENTRY BLOCKED: ${assessment.blockers.join(", ")}. Mainnet remains HOLD.`);
    process.exit(1);
  }
}

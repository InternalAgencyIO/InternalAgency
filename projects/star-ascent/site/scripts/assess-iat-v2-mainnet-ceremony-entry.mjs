#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { normalizeAccountabilityLabel } from "./normalize-accountability-label.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonicalGatePath = path.join(siteRoot, "launch/iat-v2-mainnet-readiness-gate.json");
const canonicalAuditPath = path.join(siteRoot, "public/audits/iat-v2-prelaunch-20260802/manifest.json");
const canonicalRemediationAuditPath = path.join(siteRoot, "public/audits/iat-v2-remediation-20260802/manifest.json");
const canonicalCeremonyReviewPath = path.join(siteRoot, "launch/iat-v2-ceremony-review.template.json");
const canonicalStageJournalPath = path.join(siteRoot, "launch/iat-v2-mainnet-stage-journal.template.json");

export function assessCeremonyEntry(
  gate,
  sourceSha256,
  nowMs = Date.now(),
  audit = undefined,
  remediationAudit = undefined,
  auditValidation = { readiness: false, prelaunch: false, remediation: false },
  ceremonyArtifacts = {
    ceremonyReview: undefined,
    stageJournal: undefined,
    validation: { ceremonyReview: false, stageJournal: false },
  },
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
  const canonicalUtcMs = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)) return Number.NaN;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString().replace(".000Z", "Z") === value
      ? parsed
      : Number.NaN;
  };
  const publishedAtMs = canonicalUtcMs(gate.schedule?.publishedAtUtc);
  const scheduledAtMs = canonicalUtcMs(gate.schedule?.scheduledAtUtc);
  const replacementUtcPublished = gate.schedule?.state === "SCHEDULED_HOLD"
    && Number.isFinite(publishedAtMs)
    && publishedAtMs <= nowMs + 60_000
    && Number.isFinite(scheduledAtMs)
    && scheduledAtMs > nowMs
    && scheduledAtMs > publishedAtMs;
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
  const ceremonyReviewValidated = ceremonyArtifacts.validation?.ceremonyReview === true;
  const stageJournalValidated = ceremonyArtifacts.validation?.stageJournal === true;
  const ceremonyReviewReady = ceremonyReviewValidated
    && ceremonyArtifacts.ceremonyReview?.status === "READY";
  const releaseArtifactsBound = ceremonyReviewReady
    && stageJournalValidated
    && ceremonyArtifacts.stageJournal?.status === "ARMED"
    && ceremonyArtifacts.ceremonyReview?.review?.releaseArtifactsRegeneratedAfterFundingAndScheduling === true
    && gate.gates?.releaseArtifactsRegeneratedAfterFundingAndScheduling === true;
  const soleTrezorOperator = ceremonyArtifacts.ceremonyReview?.participants?.soleTrezorOperator;
  const verifier = ceremonyArtifacts.ceremonyReview?.participants?.independentVerifier;
  const normalizedOperatorLabel = normalizeAccountabilityLabel(soleTrezorOperator?.label);
  const normalizedVerifierLabel = normalizeAccountabilityLabel(verifier?.label);
  const independentVerifierAssigned = ceremonyReviewReady
    && gate.gates?.independentMainnetVerifierAssigned === true
    && verifier?.role === "INDEPENDENT_VERIFIER"
    && normalizedOperatorLabel.length >= 3
    && normalizedVerifierLabel.length >= 3
    && normalizedVerifierLabel !== normalizedOperatorLabel
    && verifier.reviewedArtifacts === true
    && verifier.reviewedStagePlan === true
    && verifier.hasNoSigningAuthority === true;
  const modelTDevicePathReviewed = ceremonyReviewReady
    && gate.gates?.physicalModelTDevicePathReviewed === true
    && soleTrezorOperator?.role === "SOLE_TREZOR_SIGNER"
    && soleTrezorOperator?.physicalConfirmationRequired === true
    && soleTrezorOperator?.devicePathReviewed === true
    && typeof soleTrezorOperator?.publicAddress === "string"
    && soleTrezorOperator.publicAddress === gate.funding?.publicAddress;
  const safetyValues = Object.values(gate.safety ?? {});
  const required = [
    ["MAINNET_READINESS_CANONICAL_VALIDATION", auditValidation.readiness === true],
    ["MAINNET_HOLD_BOUNDARY", gate.status === "HOLD" && gate.network === "mainnet-beta" && safetyValues.length > 0 && safetyValues.every((value) => value === false)],
    ["LOCAL_TIME_GATE_CLASSIFICATION", gate.timeGateEvidence?.status === "VERIFIED_LOCAL_HOST_ONLY" && gate.timeGateEvidence?.signedDevnetEvidence === false && gate.timeGateEvidence?.validatorTransaction === false],
    ["PRELAUNCH_AUDIT_CANONICAL_VALIDATION", auditValidation.prelaunch === true],
    ["PRELAUNCH_SECURITY_AUDIT_CLEARANCE", securityAuditClear],
    ["REMEDIATION_AUDIT_CANONICAL_VALIDATION", auditValidation.remediation === true],
    ["REMEDIATION_SECURITY_AUDIT_CLEARANCE", remediationAuditClear],
    ["FRESH_READ_ONLY_FUNDING_OBSERVATION", fundingObservationFresh],
    ["MAINNET_FUNDING_FLOOR", gate.funding?.ceremonyFloorSatisfied === true && fundingFloorSatisfied],
    ["REPLACEMENT_UTC_WINDOW", replacementUtcPublished],
    ["V2_CEREMONY_REVIEW_CANONICAL_VALIDATION", ceremonyReviewValidated],
    ["V2_STAGE_JOURNAL_CANONICAL_VALIDATION", stageJournalValidated],
    ["BOUND_RELEASE_ARTIFACTS_REGENERATED", releaseArtifactsBound],
    ["INDEPENDENT_MAINNET_VERIFIER_ASSIGNED", independentVerifierAssigned],
    ["MODEL_T_DEVICE_PATH_REVIEWED", modelTDevicePathReviewed],
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
      "The replacement schedule must bind one canonical UTC ceremony time that is still future at assessment and later than its non-future publication time.",
      "The mainnet readiness ledger is never trusted from summary fields alone; its canonical validator must pass in this same assessment.",
      "Audit summary fields are never trusted alone; both public audit packages must pass their canonical source-binding and artifact-digest validators in this same assessment.",
      "Release and attended-review summary fields are never trusted alone; the canonical V2 ceremony review and V2 stage journal must pass their validators in this same assessment.",
      "The sole named owner-accepted Trezor concentration risk may remain; every unaccepted critical/high finding and missing current-source assurance is a mandatory blocker.",
      "Physical review of each transaction and separate broadcast approval remain mandatory after entry.",
    ],
  };
}

export async function assessCanonicalCeremonyEntry() {
  const [bytes, auditBytes, remediationAuditBytes, ceremonyReviewBytes, stageJournalBytes] = await Promise.all([
    readFile(canonicalGatePath),
    readFile(canonicalAuditPath),
    readFile(canonicalRemediationAuditPath),
    readFile(canonicalCeremonyReviewPath),
    readFile(canonicalStageJournalPath),
  ]);
  const validate = (script) => spawnSync(
    process.execPath,
    [path.join(siteRoot, "scripts", script)],
    { cwd: siteRoot, encoding: "utf8", windowsHide: true },
  );
  const readinessValidation = validate("validate-iat-v2-mainnet-readiness-gate.mjs");
  const prelaunchValidation = validate("validate-iat-v2-prelaunch-audit.mjs");
  const remediationValidation = validate("validate-iat-v2-remediation-audit.mjs");
  const ceremonyReviewValidation = validate("validate-iat-v2-ceremony-review.mjs");
  const stageJournalValidation = validate("validate-iat-v2-mainnet-stage-journal.mjs");
  const assessment = assessCeremonyEntry(
    JSON.parse(bytes.toString("utf8")),
    createHash("sha256").update(bytes).digest("hex"),
    Date.now(),
    JSON.parse(auditBytes.toString("utf8")),
    JSON.parse(remediationAuditBytes.toString("utf8")),
    {
      readiness: readinessValidation.status === 0,
      prelaunch: prelaunchValidation.status === 0,
      remediation: remediationValidation.status === 0,
    },
    {
      ceremonyReview: JSON.parse(ceremonyReviewBytes.toString("utf8")),
      stageJournal: JSON.parse(stageJournalBytes.toString("utf8")),
      validation: {
        ceremonyReview: ceremonyReviewValidation.status === 0,
        stageJournal: stageJournalValidation.status === 0,
      },
    },
  );
  assessment.auditSourceSha256 = createHash("sha256").update(auditBytes).digest("hex");
  assessment.remediationAuditSourceSha256 = createHash("sha256")
    .update(remediationAuditBytes)
    .digest("hex");
  assessment.ceremonyReviewSourcePath = "launch/iat-v2-ceremony-review.template.json";
  assessment.ceremonyReviewSourceSha256 = createHash("sha256")
    .update(ceremonyReviewBytes)
    .digest("hex");
  assessment.stageJournalSourcePath = "launch/iat-v2-mainnet-stage-journal.template.json";
  assessment.stageJournalSourceSha256 = createHash("sha256")
    .update(stageJournalBytes)
    .digest("hex");
  assessment.readinessValidatorExitCode = readinessValidation.status;
  assessment.auditValidatorExitCodes = {
    prelaunch: prelaunchValidation.status,
    remediation: remediationValidation.status,
  };
  assessment.ceremonyArtifactValidatorExitCodes = {
    ceremonyReview: ceremonyReviewValidation.status,
    stageJournal: stageJournalValidation.status,
  };
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

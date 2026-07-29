/*
 * STAR ASCENT COMPOSITE READINESS SNAPSHOT VALIDATOR
 * Version 0.1 — 27 July 2026
 *
 * LOCAL, DETERMINISTIC QA ONLY. This module composes supplied results from the
 * publication, cross-channel, and evidence-freshness gates. It makes no network
 * calls, inspects no wallet or Solana state, and cannot approve a launch.
 */

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function requireHold(result, label) {
  if (result.readinessDecision !== "HOLD") {
    throw new Error(`${label}.readinessDecision must remain HOLD`);
  }
  if (result.networkChecked !== false) {
    throw new Error(`${label}.networkChecked must remain false`);
  }
}

export function composeReadinessSnapshot(input) {
  const snapshot = requireRecord(input, "readiness snapshot");
  if (snapshot.lifecycle !== "pre-launch") {
    throw new Error("lifecycle must remain pre-launch");
  }
  if (snapshot.readinessDecision !== "HOLD") {
    throw new Error("readiness decision must remain HOLD");
  }

  const publication = requireRecord(snapshot.publication, "publication result");
  const releasePacket = requireRecord(snapshot.releasePacket, "release packet result");
  const evidenceLedger = requireRecord(snapshot.evidenceLedger, "evidence ledger result");
  requireHold(publication, "publication");
  requireHold(releasePacket, "releasePacket");
  requireHold(evidenceLedger, "evidenceLedger");

  if (publication.criticalMarkerStatus !== "pass") {
    throw new Error("publication critical markers must pass");
  }

  const publicationFileCount = requireCount(publication.fileCount, "publication.fileCount");
  const languagePairCount = requireCount(publication.languagePairCount, "publication.languagePairCount");
  const releaseChannelCount = requireCount(releasePacket.channelCount, "releasePacket.channelCount");
  const releaseFieldCount = requireCount(releasePacket.fieldCount, "releasePacket.fieldCount");
  const unresolvedReleaseCriticalCount = requireCount(
    releasePacket.unresolvedCriticalCount,
    "releasePacket.unresolvedCriticalCount",
  );
  const evidenceRecordCount = requireCount(evidenceLedger.evidenceRecordCount, "evidenceLedger.evidenceRecordCount");
  const verifiedCurrentCount = requireCount(evidenceLedger.verifiedCurrentCount, "evidenceLedger.verifiedCurrentCount");
  const unresolvedEvidenceCount = requireCount(evidenceLedger.unresolvedCount, "evidenceLedger.unresolvedCount");

  if (verifiedCurrentCount + unresolvedEvidenceCount !== evidenceRecordCount) {
    throw new Error("evidence counts must reconcile");
  }

  return Object.freeze({
    evidenceRecordCount,
    languagePairCount,
    launchApproved: false,
    networkChecked: false,
    publicationFileCount,
    readinessDecision: "HOLD",
    releaseChannelCount,
    releaseFieldCount,
    unresolvedEvidenceCount,
    unresolvedReleaseCriticalCount,
    verifiedCurrentCount,
  });
}

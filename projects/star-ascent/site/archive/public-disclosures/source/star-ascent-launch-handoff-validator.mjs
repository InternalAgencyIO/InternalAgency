/*
 * STAR ASCENT LAUNCH HANDOFF PACKET VALIDATOR
 * Version 0.2 — 27 July 2026
 *
 * LOCAL, DETERMINISTIC QA ONLY. This module composes supplied readiness,
 * rehearsal, and change-freeze results into a role-separated human handoff.
 * It makes no network calls, inspects no wallet or Solana state, handles no
 * secrets, personal data, or payments, and cannot approve a launch.
 */

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be non-empty text`);
  }
  return value.trim();
}

function requireRoleCode(value, label, expected) {
  const roleCode = requireText(value, label);
  if (roleCode !== expected) {
    throw new Error(`${label} must equal ${expected}; do not supply a name or email address`);
  }
  return roleCode;
}

function requireCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

function requireUtcTimestamp(value, label) {
  const timestamp = requireText(value, label);
  if (!timestamp.endsWith("Z") || !Number.isFinite(Date.parse(timestamp))) {
    throw new Error(`${label} must be a valid UTC timestamp ending in Z`);
  }
  return timestamp;
}

function requireHold(result, label) {
  const value = requireRecord(result, label);
  if (value.readinessDecision !== "HOLD") {
    throw new Error(`${label}.readinessDecision must remain HOLD`);
  }
  if (value.networkChecked !== false) {
    throw new Error(`${label}.networkChecked must remain false`);
  }
  return value;
}

export function validateLaunchHandoffPacket(input) {
  const packet = requireRecord(input, "launch handoff packet");
  if (packet.lifecycle !== "pre-launch") {
    throw new Error("lifecycle must remain pre-launch");
  }
  if (packet.readinessDecision !== "HOLD") {
    throw new Error("readiness decision must remain HOLD");
  }
  if (packet.humanDecision !== "pending") {
    throw new Error("humanDecision must remain pending");
  }

  const handoffId = requireText(packet.handoffId, "handoffId");
  const preparedAtUtc = requireUtcTimestamp(packet.preparedAtUtc, "preparedAtUtc");
  const roles = requireRecord(packet.roles, "roles");
  const roleValues = [
    requireRoleCode(
      roles.releaseOperator,
      "roles.releaseOperator",
      "release-operator",
    ),
    requireRoleCode(
      roles.safetyReviewer,
      "roles.safetyReviewer",
      "safety-reviewer",
    ),
    requireRoleCode(
      roles.decisionOwner,
      "roles.decisionOwner",
      "decision-owner",
    ),
  ];
  if (new Set(roleValues.map((role) => role.toLowerCase())).size !== roleValues.length) {
    throw new Error("release operator, safety reviewer, and decision owner roles must be separated");
  }

  const snapshot = requireHold(packet.readinessSnapshot, "readinessSnapshot");
  const rehearsal = requireHold(packet.rehearsalTrace, "rehearsalTrace");
  const freeze = requireHold(packet.changeFreeze, "changeFreeze");
  if (freeze.digestAlgorithm !== "sha256") {
    throw new Error("changeFreeze.digestAlgorithm must be sha256");
  }
  const frozenAtUtc = requireUtcTimestamp(freeze.frozenAtUtc, "changeFreeze.frozenAtUtc");
  if (Date.parse(frozenAtUtc) > Date.parse(preparedAtUtc)) {
    throw new Error("change freeze cannot be newer than the handoff packet");
  }

  const assetCount = requireCount(freeze.assetCount, "changeFreeze.assetCount");
  const unresolvedCount = (
    requireCount(snapshot.unresolvedEvidenceCount, "readinessSnapshot.unresolvedEvidenceCount")
    + requireCount(
      snapshot.unresolvedReleaseCriticalCount,
      "readinessSnapshot.unresolvedReleaseCriticalCount",
    )
    + requireCount(rehearsal.unresolvedCount, "rehearsalTrace.unresolvedCount")
  );

  return Object.freeze({
    assetCount,
    handoffId,
    humanDecisionRequired: true,
    launchApproved: false,
    networkChecked: false,
    preparedAtUtc,
    readinessDecision: "HOLD",
    roleCount: roleValues.length,
    unresolvedCount,
  });
}

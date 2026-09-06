const WITHOUT_PENDING = Object.freeze({
  PROMPT_ENTERED: [
    "PROMPT_ENTERED_WITHOUT_PENDING",
    "HOLD // PROMPT ENTERED; SIGNED RESULT UNKNOWN",
    "Permanent prompt entry has no recoverable signed record. Preserve browser data; do not retry, clear, discard, or broadcast.",
  ],
  PROMPT_FAILED: [
    "PROMPT_FAILED_WITHOUT_PENDING",
    "HOLD // PROMPT FAILED; SIGNED RESULT UNKNOWN",
    "The prompt callback failed after entry and has no recoverable signed record. Device outcome is unknown; preserve browser data and do not retry or broadcast.",
  ],
  PROMPT_VERIFIED: [
    "PROMPT_VERIFIED_WITHOUT_PENDING",
    "HOLD // VERIFIED CALLBACK; SIGNED RECORD MISSING",
    "The verified prompt callback has no required recoverable signed record. Preserve browser data; do not retry or broadcast.",
  ],
});

function hold(code, holdStatus, message) {
  return Object.freeze({ outcome: "HOLD", code, holdStatus, message });
}

export function classifyAttendedProgramRecovery({ promptLatch, signedPending, terminalDisposition = null } = {}) {
  if (terminalDisposition !== null) return hold(
    "TERMINAL_SIGNED_EVIDENCE_RETAINED",
    "HOLD // TERMINAL TRANSACTION; SIGNED EVIDENCE RETAINED",
    "This transaction is permanently excluded from sending. Preserve its signed evidence and prompt latch; do not retry or broadcast.",
  );
  if (signedPending === null) {
    if (promptLatch === null) return Object.freeze({ outcome: "NONE" });
    const row = WITHOUT_PENDING[promptLatch?.status];
    if (!row) throw new Error("Program recovery prompt latch status is not reviewed");
    return hold(...row);
  }
  if (promptLatch === null) return hold(
    "PENDING_WITHOUT_PROMPT_LATCH",
    "HOLD // SIGNED RECORD HAS NO PROMPT LATCH",
    "A signed record exists without its required permanent prompt latch. Do not retry or broadcast.",
  );
  if (promptLatch.status === "PROMPT_FAILED") return hold(
    "PENDING_WITH_FAILED_PROMPT_LATCH",
    "HOLD // FAILED PROMPT LATCH CONFLICTS WITH SIGNED RECORD",
    "A signed record conflicts with a failed prompt latch. Preserve both records; do not retry or broadcast.",
  );
  if (!["PROMPT_ENTERED", "PROMPT_VERIFIED"].includes(promptLatch.status)) {
    throw new Error("Program recovery prompt latch status is not reviewed");
  }
  if (
    promptLatch.messageSha256 !== signedPending.messageSha256
    || promptLatch.signer !== signedPending.signer
  ) return hold(
    "PENDING_PROMPT_IDENTITY_MISMATCH",
    "HOLD // SIGNED RECORD AND PROMPT LATCH DO NOT MATCH",
    "The signed record does not match the permanent prompt latch. Preserve both records; do not retry or broadcast.",
  );
  return Object.freeze({ outcome: "RECOVERABLE", code: "RECOVERABLE_SIGNED_PENDING" });
}

export function attendedProgramRecoveryHold(classification) {
  if (classification?.outcome !== "HOLD") {
    throw new Error("Program recovery classification is not a HOLD");
  }
  const error = new Error(classification.message);
  error.name = "AttendedProgramRecoveryHoldError";
  error.code = classification.code;
  error.holdStatus = classification.holdStatus;
  return error;
}

export function attendedProgramHoldStatus(error) {
  return typeof error?.holdStatus === "string" ? error.holdStatus : null;
}

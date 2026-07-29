/*
 * STAR ASCENT REHEARSAL TRACE VALIDATOR
 * Version 0.1 — 27 July 2026
 *
 * LOCAL, DETERMINISTIC QA ONLY. This module checks supplied rehearsal records.
 * It makes no network calls, inspects no wallet or Solana state, handles no
 * secrets or payments, and cannot approve a launch.
 */

export const REQUIRED_REHEARSAL_PHASES = Object.freeze([
  "t-60",
  "t-15",
  "pre-action",
]);

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value;
}

function requireText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be non-empty public text`);
  }
  return value.trim();
}

function requireUtc(value, label) {
  const text = requireText(value, label);
  if (!text.endsWith("Z") || !Number.isFinite(Date.parse(text))) {
    throw new Error(`${label} must be a valid UTC timestamp ending in Z`);
  }
  return text;
}

export function validateRehearsalTrace(trace) {
  const input = requireRecord(trace, "rehearsal trace");
  if (input.lifecycle !== "pre-launch") {
    throw new Error("lifecycle must remain pre-launch");
  }
  if (input.readinessDecision !== "HOLD") {
    throw new Error("readiness decision must remain HOLD");
  }
  if (!Array.isArray(input.checks)) {
    throw new TypeError("checks must be an array");
  }

  const checksByPhase = new Map();
  for (const [index, value] of input.checks.entries()) {
    const check = requireRecord(value, `checks[${index}]`);
    const phase = requireText(check.phase, `checks[${index}].phase`);
    if (!REQUIRED_REHEARSAL_PHASES.includes(phase)) {
      throw new Error(`unexpected rehearsal phase: ${phase}`);
    }
    if (checksByPhase.has(phase)) {
      throw new Error(`duplicate rehearsal phase: ${phase}`);
    }
    if (!["pass", "hold", "fail"].includes(check.status)) {
      throw new Error(`${phase}.status must be pass, hold, or fail`);
    }
    requireUtc(check.checkedAtUtc, `${phase}.checkedAtUtc`);
    const operatorRole = requireText(check.operatorRole, `${phase}.operatorRole`);
    const reviewerRole = requireText(check.reviewerRole, `${phase}.reviewerRole`);
    if (operatorRole === reviewerRole) {
      throw new Error(`${phase} requires separated operator and reviewer roles`);
    }
    requireText(check.notes, `${phase}.notes`);
    checksByPhase.set(phase, check);
  }

  for (const phase of REQUIRED_REHEARSAL_PHASES) {
    if (!checksByPhase.has(phase)) {
      throw new Error(`missing required rehearsal phase: ${phase}`);
    }
  }

  const orderedTimes = REQUIRED_REHEARSAL_PHASES.map((phase) =>
    Date.parse(checksByPhase.get(phase).checkedAtUtc),
  );
  for (let index = 1; index < orderedTimes.length; index += 1) {
    if (orderedTimes[index] <= orderedTimes[index - 1]) {
      throw new Error("rehearsal checks must have strictly increasing UTC times");
    }
  }

  const unresolvedCount = [...checksByPhase.values()].filter(
    (check) => check.status !== "pass",
  ).length;

  return Object.freeze({
    checkCount: checksByPhase.size,
    launchApproved: false,
    networkChecked: false,
    readinessDecision: "HOLD",
    unresolvedCount,
  });
}

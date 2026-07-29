/*
 * STAR ASCENT / $IAT AUTHORITY PLAN VALIDATOR SCAFFOLD
 * Version 0.1 — 27 July 2026
 *
 * DESIGN AND LOCAL TEST CODE ONLY. This module validates the internal
 * consistency of a proposed authority-transition plan. It cannot query
 * Solana, inspect authority state, sign, broadcast, mint, transfer, revoke,
 * or deploy anything.
 */

const AUTHORITY_ROLES = new Set(["mint", "freeze"]);
const FINAL_STATES = new Set(["retained", "transferred", "revoked"]);
const EVIDENCE_TYPES = new Set([
  "signed-change-record",
  "transaction-signature",
  "explorer-link",
  "independent-review",
]);

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty public identifier`);
  }
  return value.trim();
}

function requiredChoice(value, field, choices) {
  const choice = requiredText(value, field);
  if (!choices.has(choice)) {
    throw new RangeError(`${field} is not an allowed value: ${choice}`);
  }
  return choice;
}

export function validateAuthorityTransitionPlan(plan) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new TypeError("plan must be an object");
  }
  if (plan.status !== "proposed") {
    throw new Error("plan status must remain proposed until public evidence is linked");
  }
  if (plan.distributionBlockedUntilEvidence !== true) {
    throw new Error("distribution must remain blocked until authority evidence is public");
  }
  if (!Array.isArray(plan.authorities) || plan.authorities.length === 0) {
    throw new TypeError("authorities must be a non-empty array");
  }

  const roles = new Set();
  const finalStateCounts = { retained: 0, transferred: 0, revoked: 0 };

  for (const [index, authority] of plan.authorities.entries()) {
    const role = requiredChoice(authority?.role, `authorities[${index}].role`, AUTHORITY_ROLES);
    if (roles.has(role)) {
      throw new Error(`duplicate authority role: ${role}`);
    }
    roles.add(role);

    const current = requiredText(
      authority?.currentPublicAuthority,
      `${role}.currentPublicAuthority`,
    );
    const finalState = requiredChoice(authority?.intendedFinalState, `${role}.intendedFinalState`, FINAL_STATES);

    if (finalState === "transferred") {
      const destination = requiredText(
        authority?.destinationPublicAuthority,
        `${role}.destinationPublicAuthority`,
      );
      if (destination === current) {
        throw new Error(`${role} transfer destination must differ from current authority`);
      }
    } else if (authority?.destinationPublicAuthority != null) {
      throw new Error(`${role} destination is allowed only for a proposed transfer`);
    }

    if (!Array.isArray(authority.evidenceRequired) || authority.evidenceRequired.length === 0) {
      throw new TypeError(`${role}.evidenceRequired must be a non-empty array`);
    }
    const evidence = new Set();
    for (const [evidenceIndex, value] of authority.evidenceRequired.entries()) {
      const type = requiredChoice(
        value,
        `${role}.evidenceRequired[${evidenceIndex}]`,
        EVIDENCE_TYPES,
      );
      if (evidence.has(type)) {
        throw new Error(`duplicate ${role} evidence type: ${type}`);
      }
      evidence.add(type);
    }

    finalStateCounts[finalState] += 1;
  }

  return Object.freeze({
    authorityCount: roles.size,
    distributionBlockedUntilEvidence: true,
    finalStateCounts: Object.freeze(finalStateCounts),
    status: "proposed",
  });
}

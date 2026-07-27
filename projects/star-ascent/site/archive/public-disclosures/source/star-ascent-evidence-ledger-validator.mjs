/*
 * STAR ASCENT EVIDENCE-FRESHNESS LEDGER VALIDATOR
 * Version 0.1 — 27 July 2026
 *
 * LOCAL, DETERMINISTIC QA ONLY. This module validates supplied evidence
 * metadata. It makes no network calls, inspects no wallet or Solana state,
 * handles no secrets, and cannot approve a launch.
 */

export const REQUIRED_EVIDENCE_IDS = Object.freeze([
  "token-identity",
  "mint-authority",
  "freeze-authority",
  "allocation-map",
  "release-controls",
  "channel-consistency",
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

function parseUtc(value, label) {
  const text = requireText(value, label);
  if (!text.endsWith("Z")) {
    throw new Error(`${label} must be an explicit UTC timestamp ending in Z`);
  }
  const time = Date.parse(text);
  if (!Number.isFinite(time)) {
    throw new Error(`${label} must be a valid UTC timestamp`);
  }
  return time;
}

function validateVerifiedRecord(record, asOfTime, label) {
  const publicUrl = requireText(record.publicUrl, `${label}.publicUrl`);
  if (!publicUrl.startsWith("https://")) {
    throw new Error(`${label}.publicUrl must use https`);
  }
  requireText(record.observedValue, `${label}.observedValue`);
  const checkedAt = parseUtc(record.checkedAtUtc, `${label}.checkedAtUtc`);
  const expiresAt = parseUtc(record.expiresAtUtc, `${label}.expiresAtUtc`);
  if (checkedAt > asOfTime) {
    throw new Error(`${label}.checkedAtUtc cannot be in the future`);
  }
  if (expiresAt <= checkedAt) {
    throw new Error(`${label}.expiresAtUtc must be later than checkedAtUtc`);
  }
  if (expiresAt <= asOfTime) {
    throw new Error(`${label} evidence is stale`);
  }
  const reviewer = requireText(record.reviewerRole, `${label}.reviewerRole`);
  const independentReviewer = requireText(
    record.independentReviewerRole,
    `${label}.independentReviewerRole`,
  );
  if (reviewer === independentReviewer) {
    throw new Error(`${label} requires two separated review roles`);
  }
}

export function validateEvidenceFreshnessLedger(ledger) {
  const input = requireRecord(ledger, "evidence ledger");
  if (input.lifecycle !== "pre-launch") {
    throw new Error("lifecycle must remain pre-launch");
  }
  if (input.readinessDecision !== "HOLD") {
    throw new Error("readiness decision must remain HOLD");
  }
  const asOfTime = parseUtc(input.asOfUtc, "asOfUtc");
  if (!Array.isArray(input.records)) {
    throw new TypeError("records must be an array");
  }

  const recordsById = new Map();
  for (const [index, value] of input.records.entries()) {
    const record = requireRecord(value, `records[${index}]`);
    const id = requireText(record.id, `records[${index}].id`);
    if (!REQUIRED_EVIDENCE_IDS.includes(id)) {
      throw new Error(`unexpected evidence id: ${id}`);
    }
    if (recordsById.has(id)) {
      throw new Error(`duplicate evidence id: ${id}`);
    }
    if (record.status !== "pending" && record.status !== "verified") {
      throw new Error(`${id}.status must be pending or verified`);
    }
    if (record.status === "pending") {
      requireText(record.holdReason, `${id}.holdReason`);
    } else {
      validateVerifiedRecord(record, asOfTime, id);
    }
    recordsById.set(id, record);
  }

  for (const id of REQUIRED_EVIDENCE_IDS) {
    if (!recordsById.has(id)) {
      throw new Error(`missing required evidence record: ${id}`);
    }
  }

  const verifiedCurrentCount = [...recordsById.values()].filter(
    (record) => record.status === "verified",
  ).length;

  return Object.freeze({
    evidenceRecordCount: recordsById.size,
    networkChecked: false,
    readinessDecision: "HOLD",
    unresolvedCount: recordsById.size - verifiedCurrentCount,
    verifiedCurrentCount,
  });
}

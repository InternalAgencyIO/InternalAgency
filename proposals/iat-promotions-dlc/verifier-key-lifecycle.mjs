/**
 * Pure verifier-key lifecycle model for the Promotions DLC draft.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * Public verification keys only. This module creates no key, signs nothing,
 * connects to no network, and is not imported by any production surface.
 */

import { canonicalJson, sha256Hex } from "./attestation-transparency.mjs";

export const MINIMUM_ROTATION_NOTICE_SECONDS = 86_400;
export const MAXIMUM_ROTATION_OVERLAP_SECONDS = 3_600;
export const EMPTY_KEY_LIFECYCLE_HASH = "0".repeat(64);

export const KeyLifecycleStatus = Object.freeze({
  ACTIVE: "ACTIVE",
  EMERGENCY_DISABLED: "EMERGENCY_DISABLED",
});

export const EmergencyReason = Object.freeze({
  KEY_COMPROMISE: "KEY_COMPROMISE",
  VERIFIER_INTEGRITY_FAILURE: "VERIFIER_INTEGRITY_FAILURE",
  VERIFIER_UNAVAILABLE: "VERIFIER_UNAVAILABLE",
});

function fail(code) {
  throw new Error(code);
}

function requireString(value, code) {
  if (typeof value !== "string" || value.length === 0) fail(code);
  return value;
}

function requireHash(value, code) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail(code);
  return value;
}

function requireTimestamp(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) fail(code);
  return value;
}

function cloneKey(key) {
  return { ...key };
}

export function cloneVerifierKeyLifecycle(state) {
  return {
    ...state,
    config: { ...state.config },
    keys: new Map([...state.keys.entries()].map(([keyId, key]) => [keyId, cloneKey(key)])),
    pendingRotation: state.pendingRotation ? { ...state.pendingRotation } : null,
    usedReviewIds: new Set(state.usedReviewIds),
    events: state.events.map((event) => ({ ...event })),
  };
}

export function deriveVerifierKeyId(publicKeyHex) {
  const publicKey = requireHash(publicKeyHex, "INVALID_ED25519_PUBLIC_KEY");
  return sha256Hex(Buffer.from(publicKey, "hex"));
}

function appendEvent(state, type, occurredAt, details = {}) {
  const previousEventHash = state.events.at(-1)?.eventHash ?? EMPTY_KEY_LIFECYCLE_HASH;
  const body = {
    campaignId: state.config.campaignId,
    details,
    occurredAt,
    previousEventHash,
    sequence: state.events.length,
    type,
  };
  state.events.push({ ...body, eventHash: sha256Hex(canonicalJson(body)) });
}

function requireActiveLifecycle(state) {
  if (state.status === KeyLifecycleStatus.EMERGENCY_DISABLED) {
    fail("VERIFIER_LIFECYCLE_PERMANENTLY_DISABLED");
  }
  if (state.status !== KeyLifecycleStatus.ACTIVE) fail("VERIFIER_LIFECYCLE_NOT_ACTIVE");
}

function requireReview(state, { reviewApproved, reviewId, reviewHash }) {
  if (reviewApproved !== true) fail("SEPARATE_REVIEW_REQUIRED");
  const id = requireHash(reviewId, "INVALID_REVIEW_ID");
  const hash = requireHash(reviewHash, "INVALID_REVIEW_HASH");
  if (state.usedReviewIds.has(id)) fail("REVIEW_REPLAY");
  return { reviewId: id, reviewHash: hash };
}

function currentUnboundedKey(state, now) {
  const candidates = [...state.keys.values()].filter(
    (key) =>
      key.activationFinalizedAt !== null &&
      key.activationFinalizedAt <= now &&
      key.retiresAt === null &&
      key.cancelledAt === null,
  );
  if (candidates.length !== 1) fail("CURRENT_VERIFIER_KEY_AMBIGUOUS");
  return candidates[0];
}

export function createVerifierKeyLifecycle({
  campaignId,
  identityDomainHash,
  initialPublicKeyHex,
  activatedAt,
} = {}) {
  const timestamp = requireTimestamp(activatedAt, "INVALID_INITIAL_ACTIVATION_TIMESTAMP");
  const publicKeyHex = requireHash(initialPublicKeyHex, "INVALID_ED25519_PUBLIC_KEY");
  const keyId = deriveVerifierKeyId(publicKeyHex);
  const state = {
    config: {
      campaignId: requireString(campaignId, "INVALID_CAMPAIGN_ID"),
      identityDomainHash: requireHash(identityDomainHash, "INVALID_IDENTITY_DOMAIN_HASH"),
      minimumRotationNoticeSeconds: MINIMUM_ROTATION_NOTICE_SECONDS,
      maximumRotationOverlapSeconds: MAXIMUM_ROTATION_OVERLAP_SECONDS,
    },
    status: KeyLifecycleStatus.ACTIVE,
    createdAt: timestamp,
    emergencyDisabledAt: null,
    emergencyReason: null,
    rotationSequence: 0,
    keys: new Map([
      [
        keyId,
        {
          keyId,
          publicKeyHex,
          activationFinalizedAt: timestamp,
          scheduledActivationAt: timestamp,
          retiresAt: null,
          retirementFinalizedAt: null,
          cancelledAt: null,
          introducedByReviewId: null,
          sequence: 0,
        },
      ],
    ]),
    pendingRotation: null,
    usedReviewIds: new Set(),
    events: [],
  };
  appendEvent(state, "VerifierLifecycleCreated", timestamp, {
    identityDomainHash: state.config.identityDomainHash,
    initialKeyId: keyId,
    initialPublicKeyHex: publicKeyHex,
  });
  assertVerifierKeyLifecycleInvariants(state);
  return state;
}

export function scheduleVerifierKeyRotation(
  state,
  {
    now,
    newPublicKeyHex,
    activateAt,
    retireOldAt,
    reviewApproved,
    reviewId,
    reviewHash,
  },
) {
  requireActiveLifecycle(state);
  const timestamp = requireTimestamp(now, "INVALID_CURRENT_TIMESTAMP");
  const activation = requireTimestamp(activateAt, "INVALID_ROTATION_ACTIVATION_TIMESTAMP");
  const retirement = requireTimestamp(retireOldAt, "INVALID_ROTATION_RETIREMENT_TIMESTAMP");
  if (state.pendingRotation) fail("ROTATION_ALREADY_PENDING");
  if (
    [...state.keys.values()].some(
      (key) => key.retiresAt !== null && key.retirementFinalizedAt === null,
    )
  ) {
    fail("PREVIOUS_RETIREMENT_NOT_FINALIZED");
  }
  if (activation < timestamp + MINIMUM_ROTATION_NOTICE_SECONDS) {
    fail("ROTATION_NOTICE_TOO_SHORT");
  }
  if (retirement < activation) fail("OLD_KEY_RETIRES_BEFORE_NEW_KEY_ACTIVATES");
  if (retirement - activation > MAXIMUM_ROTATION_OVERLAP_SECONDS) {
    fail("ROTATION_OVERLAP_TOO_LONG");
  }

  const review = requireReview(state, { reviewApproved, reviewId, reviewHash });
  const publicKeyHex = requireHash(newPublicKeyHex, "INVALID_ED25519_PUBLIC_KEY");
  const newKeyId = deriveVerifierKeyId(publicKeyHex);
  if (state.keys.has(newKeyId)) fail("VERIFIER_KEY_REUSE");
  const oldKey = currentUnboundedKey(state, timestamp);
  const next = cloneVerifierKeyLifecycle(state);
  const rotationId = sha256Hex(
    canonicalJson({
      activateAt: activation,
      campaignId: next.config.campaignId,
      newKeyId,
      oldKeyId: oldKey.keyId,
      retireOldAt: retirement,
      reviewId: review.reviewId,
      sequence: next.rotationSequence,
    }),
  );
  next.keys.set(newKeyId, {
    keyId: newKeyId,
    publicKeyHex,
    activationFinalizedAt: null,
    scheduledActivationAt: activation,
    retiresAt: null,
    retirementFinalizedAt: null,
    cancelledAt: null,
    introducedByReviewId: review.reviewId,
    sequence: next.rotationSequence + 1,
  });
  next.pendingRotation = {
    rotationId,
    oldKeyId: oldKey.keyId,
    newKeyId,
    scheduledAt: timestamp,
    activateAt: activation,
    retireOldAt: retirement,
    reviewId: review.reviewId,
    reviewHash: review.reviewHash,
  };
  next.usedReviewIds.add(review.reviewId);
  next.rotationSequence += 1;
  appendEvent(next, "VerifierKeyRotationScheduled", timestamp, {
    ...next.pendingRotation,
    newPublicKeyHex: publicKeyHex,
  });
  assertVerifierKeyLifecycleInvariants(next);
  return { state: next, rotationId };
}

export function activateScheduledVerifierKey(state, { now, rotationId }) {
  requireActiveLifecycle(state);
  const timestamp = requireTimestamp(now, "INVALID_CURRENT_TIMESTAMP");
  const pending = state.pendingRotation;
  if (!pending) fail("NO_PENDING_ROTATION");
  if (pending.rotationId !== rotationId) fail("ROTATION_ID_MISMATCH");
  if (timestamp < pending.activateAt) fail("ROTATION_ACTIVATION_NOT_REACHED");

  const next = cloneVerifierKeyLifecycle(state);
  const oldKey = next.keys.get(pending.oldKeyId);
  const newKey = next.keys.get(pending.newKeyId);
  if (!oldKey || !newKey) fail("ROTATION_KEY_RECORD_MISSING");
  oldKey.retiresAt = pending.retireOldAt;
  newKey.activationFinalizedAt = timestamp;
  next.pendingRotation = null;
  appendEvent(next, "VerifierKeyRotationActivated", timestamp, {
    newKeyId: newKey.keyId,
    oldKeyId: oldKey.keyId,
    retireOldAt: oldKey.retiresAt,
    rotationId,
  });
  assertVerifierKeyLifecycleInvariants(next);
  return next;
}

export function finalizeVerifierKeyRetirement(state, { now, keyId }) {
  requireActiveLifecycle(state);
  const timestamp = requireTimestamp(now, "INVALID_CURRENT_TIMESTAMP");
  const key = state.keys.get(keyId);
  if (!key) fail("VERIFIER_KEY_NOT_FOUND");
  if (key.retiresAt === null) fail("VERIFIER_KEY_NOT_SCHEDULED_TO_RETIRE");
  if (key.retirementFinalizedAt !== null) fail("VERIFIER_KEY_RETIREMENT_ALREADY_FINALIZED");
  if (timestamp < key.retiresAt) fail("VERIFIER_KEY_RETIREMENT_NOT_REACHED");

  const next = cloneVerifierKeyLifecycle(state);
  next.keys.get(keyId).retirementFinalizedAt = timestamp;
  appendEvent(next, "VerifierKeyRetirementFinalized", timestamp, { keyId });
  assertVerifierKeyLifecycleInvariants(next);
  return next;
}

export function emergencyDisableVerifierLifecycle(
  state,
  { now, reason, reviewApproved, reviewId, reviewHash },
) {
  requireActiveLifecycle(state);
  const timestamp = requireTimestamp(now, "INVALID_CURRENT_TIMESTAMP");
  if (!Object.values(EmergencyReason).includes(reason)) fail("INVALID_EMERGENCY_REASON");
  const review = requireReview(state, { reviewApproved, reviewId, reviewHash });
  const next = cloneVerifierKeyLifecycle(state);
  const cancelledRotationId = next.pendingRotation?.rotationId ?? null;
  if (next.pendingRotation) {
    const pendingKey = next.keys.get(next.pendingRotation.newKeyId);
    if (pendingKey && pendingKey.activationFinalizedAt === null) pendingKey.cancelledAt = timestamp;
  }
  next.pendingRotation = null;
  next.status = KeyLifecycleStatus.EMERGENCY_DISABLED;
  next.emergencyDisabledAt = timestamp;
  next.emergencyReason = reason;
  next.usedReviewIds.add(review.reviewId);
  appendEvent(next, "VerifierLifecycleEmergencyDisabled", timestamp, {
    cancelledRotationId,
    reason,
    reviewHash: review.reviewHash,
    reviewId: review.reviewId,
  });
  assertVerifierKeyLifecycleInvariants(next);
  return next;
}

export function isVerifierKeyAllowedForIssuanceAt(state, keyId, issuedAt) {
  const timestamp = requireTimestamp(issuedAt, "INVALID_ATTESTATION_ISSUED_AT");
  const key = state.keys.get(keyId);
  if (!key || key.activationFinalizedAt === null || key.cancelledAt !== null) return false;
  if (timestamp < key.activationFinalizedAt) return false;
  if (key.retiresAt !== null && timestamp >= key.retiresAt) return false;
  if (state.emergencyDisabledAt !== null && timestamp >= state.emergencyDisabledAt) return false;
  return true;
}

export function createVerifierKeyLifecycleCheckpoint(state, { publishedAt }) {
  assertVerifierKeyLifecycleInvariants(state);
  const body = {
    campaignId: state.config.campaignId,
    eventCount: state.events.length,
    headEventHash: state.events.at(-1)?.eventHash ?? EMPTY_KEY_LIFECYCLE_HASH,
    identityDomainHash: state.config.identityDomainHash,
    publishedAt: requireTimestamp(publishedAt, "INVALID_CHECKPOINT_TIMESTAMP"),
    status: state.status,
  };
  return { ...body, checkpointHash: sha256Hex(canonicalJson(body)) };
}

export function verifyVerifierKeyLifecycleCheckpoint(checkpoint, state) {
  if (!checkpoint || typeof checkpoint !== "object") return false;
  if (validateVerifierKeyLifecycle(state).length) return false;
  const { checkpointHash, ...body } = checkpoint;
  if (checkpointHash !== sha256Hex(canonicalJson(body))) return false;
  if (checkpoint.campaignId !== state.config.campaignId) return false;
  if (checkpoint.identityDomainHash !== state.config.identityDomainHash) return false;
  if (!Number.isSafeInteger(checkpoint.eventCount) || checkpoint.eventCount < 0) return false;
  if (checkpoint.eventCount > state.events.length) return false;
  const expectedHead = checkpoint.eventCount
    ? state.events[checkpoint.eventCount - 1].eventHash
    : EMPTY_KEY_LIFECYCLE_HASH;
  return checkpoint.headEventHash === expectedHead;
}

export function validateVerifierKeyLifecycle(state) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };

  expect(state?.config?.minimumRotationNoticeSeconds === 86_400, "rotation notice mismatch");
  expect(state?.config?.maximumRotationOverlapSeconds === 3_600, "rotation overlap mismatch");
  expect(/^[0-9a-f]{64}$/.test(state?.config?.identityDomainHash ?? ""), "identity domain malformed");
  expect(
    Object.values(KeyLifecycleStatus).includes(state?.status),
    "key lifecycle status invalid",
  );
  if (state?.status === KeyLifecycleStatus.EMERGENCY_DISABLED) {
    expect(Number.isSafeInteger(state.emergencyDisabledAt), "emergency disabled time missing");
    expect(Object.values(EmergencyReason).includes(state.emergencyReason), "emergency reason invalid");
    expect(state.pendingRotation === null, "disabled lifecycle retains pending rotation");
  }

  const publicKeys = new Set();
  for (const [keyId, key] of state?.keys ?? []) {
    expect(keyId === key.keyId, `${keyId} map key mismatch`);
    try {
      expect(keyId === deriveVerifierKeyId(key.publicKeyHex), `${keyId} derivation mismatch`);
    } catch {
      errors.push(`${keyId} public key malformed`);
    }
    expect(!publicKeys.has(key.publicKeyHex), `${keyId} repeats a public key`);
    publicKeys.add(key.publicKeyHex);
    if (key.retirementFinalizedAt !== null) {
      expect(key.retiresAt !== null, `${keyId} finalized without retirement time`);
      expect(
        key.retirementFinalizedAt >= key.retiresAt,
        `${keyId} retirement finalized too early`,
      );
    }
  }

  let previousEventHash = EMPTY_KEY_LIFECYCLE_HASH;
  for (let index = 0; index < (state?.events?.length ?? 0); index += 1) {
    const event = state.events[index];
    const { eventHash, ...body } = event;
    expect(event.sequence === index, `event ${index} sequence mismatch`);
    expect(event.campaignId === state.config.campaignId, `event ${index} campaign mismatch`);
    expect(event.previousEventHash === previousEventHash, `event ${index} previous hash mismatch`);
    expect(eventHash === sha256Hex(canonicalJson(body)), `event ${index} hash mismatch`);
    previousEventHash = eventHash;
  }
  expect(
    state?.events?.[0]?.details?.identityDomainHash === state?.config?.identityDomainHash,
    "creation event identity domain mismatch",
  );

  return errors;
}

export function assertVerifierKeyLifecycleInvariants(state) {
  const errors = validateVerifierKeyLifecycle(state);
  if (errors.length) fail(`KEY_LIFECYCLE_INVARIANT_FAILURE: ${errors.join("; ")}`);
  return true;
}

export function snapshotVerifierKeyLifecycle(state) {
  return JSON.stringify(state, (_key, value) => {
    if (value instanceof Map) return { map: [...value.entries()] };
    if (value instanceof Set) return { set: [...value.values()] };
    return value;
  });
}

/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  EmergencyReason,
  KeyLifecycleStatus,
  MAXIMUM_ROTATION_OVERLAP_SECONDS,
  MINIMUM_ROTATION_NOTICE_SECONDS,
  activateScheduledVerifierKey,
  assertVerifierKeyLifecycleInvariants,
  cloneVerifierKeyLifecycle,
  createVerifierKeyLifecycle,
  createVerifierKeyLifecycleCheckpoint,
  deriveVerifierKeyId,
  emergencyDisableVerifierLifecycle,
  finalizeVerifierKeyRetirement,
  isVerifierKeyAllowedForIssuanceAt,
  scheduleVerifierKeyRotation,
  snapshotVerifierKeyLifecycle,
  validateVerifierKeyLifecycle,
  verifyVerifierKeyLifecycleCheckpoint,
} from "../verifier-key-lifecycle.mjs";

const START = 1_800_000_000;
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");
const INITIAL_KEY = hash("initial-public-verification-key");
const SECOND_KEY = hash("second-public-verification-key");
const THIRD_KEY = hash("third-public-verification-key");

function initialState() {
  return createVerifierKeyLifecycle({
    campaignId: "iat-promotions-dlc-v0-reference",
    identityDomainHash: hash("identity-domain"),
    initialPublicKeyHex: INITIAL_KEY,
    activatedAt: START,
  });
}

function rotationArgs(sequence = 1, overrides = {}) {
  const now = START + sequence * 100;
  const activateAt = now + MINIMUM_ROTATION_NOTICE_SECONDS;
  return {
    now,
    newPublicKeyHex: sequence === 1 ? SECOND_KEY : THIRD_KEY,
    activateAt,
    retireOldAt: activateAt + MAXIMUM_ROTATION_OVERLAP_SECONDS,
    reviewApproved: true,
    reviewId: hash(`review-id-${sequence}`),
    reviewHash: hash(`review-artifact-${sequence}`),
    ...overrides,
  };
}

test("rotation requires separate review, 24-hour notice, and no more than one-hour overlap", () => {
  const state = initialState();
  const before = snapshotVerifierKeyLifecycle(state);
  const valid = rotationArgs();

  assert.throws(
    () => scheduleVerifierKeyRotation(state, { ...valid, reviewApproved: false }),
    /SEPARATE_REVIEW_REQUIRED/,
  );
  assert.throws(
    () => scheduleVerifierKeyRotation(state, { ...valid, activateAt: valid.activateAt - 1 }),
    /ROTATION_NOTICE_TOO_SHORT/,
  );
  assert.throws(
    () => scheduleVerifierKeyRotation(state, {
      ...valid,
      retireOldAt: valid.activateAt + MAXIMUM_ROTATION_OVERLAP_SECONDS + 1,
    }),
    /ROTATION_OVERLAP_TOO_LONG/,
  );
  assert.equal(snapshotVerifierKeyLifecycle(state), before);

  const scheduled = scheduleVerifierKeyRotation(state, valid);
  assert.equal(scheduled.state.pendingRotation.rotationId, scheduled.rotationId);
  assert.equal(scheduled.state.config.identityDomainHash, state.config.identityDomainHash);
  assertVerifierKeyLifecycleInvariants(scheduled.state);
});

test("activation and retirement enforce exact public-key validity boundaries", () => {
  const state = initialState();
  const oldKeyId = deriveVerifierKeyId(INITIAL_KEY);
  const newKeyId = deriveVerifierKeyId(SECOND_KEY);
  const args = rotationArgs();
  const scheduled = scheduleVerifierKeyRotation(state, args);

  assert.equal(isVerifierKeyAllowedForIssuanceAt(scheduled.state, oldKeyId, args.activateAt), true);
  assert.equal(isVerifierKeyAllowedForIssuanceAt(scheduled.state, newKeyId, args.activateAt), false);
  assert.throws(
    () => activateScheduledVerifierKey(scheduled.state, {
      now: args.activateAt - 1,
      rotationId: scheduled.rotationId,
    }),
    /ROTATION_ACTIVATION_NOT_REACHED/,
  );

  let rotated = activateScheduledVerifierKey(scheduled.state, {
    now: args.activateAt,
    rotationId: scheduled.rotationId,
  });
  assert.equal(isVerifierKeyAllowedForIssuanceAt(rotated, oldKeyId, args.activateAt), true);
  assert.equal(isVerifierKeyAllowedForIssuanceAt(rotated, newKeyId, args.activateAt), true);
  assert.equal(isVerifierKeyAllowedForIssuanceAt(rotated, oldKeyId, args.retireOldAt - 1), true);
  assert.equal(isVerifierKeyAllowedForIssuanceAt(rotated, oldKeyId, args.retireOldAt), false);
  assert.equal(isVerifierKeyAllowedForIssuanceAt(rotated, newKeyId, args.retireOldAt), true);
  assert.throws(
    () => finalizeVerifierKeyRetirement(rotated, { now: args.retireOldAt - 1, keyId: oldKeyId }),
    /VERIFIER_KEY_RETIREMENT_NOT_REACHED/,
  );
  assert.throws(
    () => scheduleVerifierKeyRotation(rotated, rotationArgs(2, { now: args.activateAt + 1 })),
    /PREVIOUS_RETIREMENT_NOT_FINALIZED/,
  );

  rotated = finalizeVerifierKeyRetirement(rotated, { now: args.retireOldAt, keyId: oldKeyId });
  assert.equal(rotated.keys.get(oldKeyId).retirementFinalizedAt, args.retireOldAt);
  assertVerifierKeyLifecycleInvariants(rotated);
});

test("concurrent rotations, public-key reuse, and review replay are rejected", () => {
  const first = rotationArgs();
  let state = scheduleVerifierKeyRotation(initialState(), first).state;
  assert.throws(() => scheduleVerifierKeyRotation(state, rotationArgs(2)), /ROTATION_ALREADY_PENDING/);

  const rotationId = state.pendingRotation.rotationId;
  state = activateScheduledVerifierKey(state, { now: first.activateAt, rotationId });
  state = finalizeVerifierKeyRetirement(state, {
    now: first.retireOldAt,
    keyId: deriveVerifierKeyId(INITIAL_KEY),
  });

  assert.throws(
    () => scheduleVerifierKeyRotation(state, rotationArgs(2, {
      now: first.retireOldAt,
      activateAt: first.retireOldAt + MINIMUM_ROTATION_NOTICE_SECONDS,
      retireOldAt:
        first.retireOldAt + MINIMUM_ROTATION_NOTICE_SECONDS + MAXIMUM_ROTATION_OVERLAP_SECONDS,
      reviewId: first.reviewId,
    })),
    /REVIEW_REPLAY/,
  );
  assert.throws(
    () => scheduleVerifierKeyRotation(state, rotationArgs(2, {
      now: first.retireOldAt,
      activateAt: first.retireOldAt + MINIMUM_ROTATION_NOTICE_SECONDS,
      retireOldAt:
        first.retireOldAt + MINIMUM_ROTATION_NOTICE_SECONDS + MAXIMUM_ROTATION_OVERLAP_SECONDS,
      newPublicKeyHex: INITIAL_KEY,
    })),
    /VERIFIER_KEY_REUSE/,
  );
});

test("emergency disable is immediate, terminal, and preserves historical verification", () => {
  const state = initialState();
  const initialKeyId = deriveVerifierKeyId(INITIAL_KEY);
  const scheduled = scheduleVerifierKeyRotation(state, rotationArgs());
  const disabledAt = START + 1_000;
  const disabled = emergencyDisableVerifierLifecycle(scheduled.state, {
    now: disabledAt,
    reason: EmergencyReason.KEY_COMPROMISE,
    reviewApproved: true,
    reviewId: hash("emergency-review-id"),
    reviewHash: hash("emergency-review-artifact"),
  });

  assert.equal(disabled.status, KeyLifecycleStatus.EMERGENCY_DISABLED);
  assert.equal(disabled.pendingRotation, null);
  assert.equal(disabled.keys.get(deriveVerifierKeyId(SECOND_KEY)).cancelledAt, disabledAt);
  assert.equal(isVerifierKeyAllowedForIssuanceAt(disabled, initialKeyId, disabledAt - 1), true);
  assert.equal(isVerifierKeyAllowedForIssuanceAt(disabled, initialKeyId, disabledAt), false);
  assert.throws(() => scheduleVerifierKeyRotation(disabled, rotationArgs(2)), /PERMANENTLY_DISABLED/);
  assert.throws(
    () => emergencyDisableVerifierLifecycle(disabled, {
      now: disabledAt + 1,
      reason: EmergencyReason.VERIFIER_UNAVAILABLE,
      reviewApproved: true,
      reviewId: hash("second-emergency-review"),
      reviewHash: hash("second-emergency-artifact"),
    }),
    /PERMANENTLY_DISABLED/,
  );
  assertVerifierKeyLifecycleInvariants(disabled);
});

test("public checkpoints accept append-only extension and reject mutation or domain drift", () => {
  const state = initialState();
  const checkpoint = createVerifierKeyLifecycleCheckpoint(state, { publishedAt: START + 1 });
  const extended = scheduleVerifierKeyRotation(state, rotationArgs()).state;

  assert.equal(verifyVerifierKeyLifecycleCheckpoint(checkpoint, state), true);
  assert.equal(verifyVerifierKeyLifecycleCheckpoint(checkpoint, extended), true);

  const mutated = cloneVerifierKeyLifecycle(extended);
  mutated.events[0].details.initialKeyId = hash("rewritten-initial-key");
  assert.ok(validateVerifierKeyLifecycle(mutated).some((error) => error.includes("event 0 hash mismatch")));
  assert.equal(verifyVerifierKeyLifecycleCheckpoint(checkpoint, mutated), false);

  const domainDrift = cloneVerifierKeyLifecycle(extended);
  domainDrift.config.identityDomainHash = hash("changed-identity-domain");
  assert.ok(validateVerifierKeyLifecycle(domainDrift).includes("creation event identity domain mismatch"));
  assert.equal(verifyVerifierKeyLifecycleCheckpoint(checkpoint, domainDrift), false);
});

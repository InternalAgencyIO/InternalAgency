/**
 * Deterministic, network-free settlement lock scheduler for the IAT
 * "Propose a Hero" draft.
 *
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * This is an executable concurrency model, not a Solana transaction runner.
 * It imports no RPC, wallet, validator, site, or production code.
 */

import { createHash } from "node:crypto";

import {
  assertStateInvariants,
  cloneState,
  settlePair,
  snapshotState,
} from "./reference-engine.mjs";

export const ScheduleOperation = Object.freeze({
  ACQUIRE: "ACQUIRE",
  EXECUTE: "EXECUTE",
  RELEASE: "RELEASE",
});

function fail(code) {
  throw new Error(code);
}

function requireNonEmptyString(value, code) {
  if (typeof value !== "string" || value.length === 0) fail(code);
  return value;
}

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function settlementStateSha256(state) {
  return sha256Hex(snapshotState(state));
}

export function settlementWritableLockNames(state, attempt) {
  const nominationId = requireNonEmptyString(attempt?.nominationId, "INVALID_ATTEMPT_NOMINATION_ID");
  const nomination = state.nominations.get(nominationId);
  if (!nomination) fail("NOMINATION_NOT_FOUND_FOR_LOCK_DERIVATION");
  const hero = attempt?.heroAttestation;
  requireNonEmptyString(hero?.nodeId, "INVALID_ATTEMPT_HERO_NODE");
  requireNonEmptyString(hero?.wallet, "INVALID_ATTEMPT_HERO_WALLET");
  requireNonEmptyString(hero?.xIdentityCommitment, "INVALID_ATTEMPT_HERO_X_COMMITMENT");
  const names = [
    `campaign:${state.config.campaignId}`,
    `promotion-vault:${state.config.campaignId}`,
    `nomination:${nominationId}`,
    `settlement-sequence:${state.completedPairs}`,
    `hero-node-marker:${hero.nodeId}`,
    `hero-wallet-marker:${hero.wallet}`,
    `hero-x-marker:${hero.xIdentityCommitment}`,
    `proposer-node-marker:${nomination.proposerNodeId}`,
    `proposer-wallet-marker:${nomination.proposerWallet}`,
    `proposer-x-marker:${nomination.proposerXIdentityCommitment}`,
    `wallet-balance:${hero.wallet}`,
    `wallet-balance:${nomination.proposerWallet}`,
  ];
  return [...new Set(names)].sort();
}

function traceEntry(step, operation, attemptId, outcome, state, extra = {}) {
  return {
    step: String(step),
    operation,
    attemptId,
    outcome,
    stateSha256: settlementStateSha256(state),
    ...extra,
  };
}

export function runDeterministicSettlementSchedule(
  initialState,
  { attempts, timeline },
) {
  if (!Array.isArray(attempts) || attempts.length === 0) fail("SCHEDULER_ATTEMPTS_REQUIRED");
  if (!Array.isArray(timeline) || timeline.length === 0) fail("SCHEDULER_TIMELINE_REQUIRED");
  const callerSnapshot = snapshotState(initialState);
  let state = cloneState(initialState);
  const records = new Map();
  for (const attempt of attempts) {
    const attemptId = requireNonEmptyString(attempt?.attemptId, "INVALID_ATTEMPT_ID");
    if (records.has(attemptId)) fail("DUPLICATE_ATTEMPT_ID");
    records.set(attemptId, {
      attempt,
      status: "READY",
      conflictCount: 0,
      executeCount: 0,
      errorCode: null,
      rollbackPreserved: null,
      beforeExecuteStateSha256: null,
      afterExecuteStateSha256: null,
    });
  }
  const lockOwners = new Map();
  const heldLocks = new Map();
  const trace = [];
  for (const [step, instruction] of timeline.entries()) {
    const operation = instruction?.operation;
    const attemptId = requireNonEmptyString(instruction?.attemptId, "INVALID_TIMELINE_ATTEMPT_ID");
    const record = records.get(attemptId);
    if (!record) fail("UNKNOWN_TIMELINE_ATTEMPT");
    if (!Object.values(ScheduleOperation).includes(operation)) fail("UNKNOWN_SCHEDULE_OPERATION");
    if (operation === ScheduleOperation.ACQUIRE) {
      if (!["READY", "BLOCKED"].includes(record.status)) fail("ATTEMPT_NOT_ACQUIRABLE");
      const locks = settlementWritableLockNames(state, record.attempt);
      const conflictingOwners = [...new Set(
        locks.map((lock) => lockOwners.get(lock)).filter(Boolean),
      )].sort();
      const lockSetSha256 = sha256Hex(JSON.stringify(locks));
      if (conflictingOwners.length > 0) {
        record.status = "BLOCKED";
        record.conflictCount += 1;
        trace.push(traceEntry(step, operation, attemptId, "LOCK_CONFLICT", state, {
          lockCount: String(locks.length),
          lockSetSha256,
          conflictingAttemptIds: conflictingOwners,
        }));
        continue;
      }
      for (const lock of locks) lockOwners.set(lock, attemptId);
      heldLocks.set(attemptId, locks);
      record.status = "LOCKED";
      trace.push(traceEntry(step, operation, attemptId, "LOCK_ACQUIRED", state, {
        lockCount: String(locks.length),
        lockSetSha256,
      }));
      continue;
    }
    if (operation === ScheduleOperation.EXECUTE) {
      if (record.status !== "LOCKED" || !heldLocks.has(attemptId)) {
        fail("SCHEDULER_EXECUTE_WITHOUT_LOCK");
      }
      record.executeCount += 1;
      record.beforeExecuteStateSha256 = settlementStateSha256(state);
      try {
        state = settlePair(state, record.attempt);
        record.status = "COMMITTED";
        record.afterExecuteStateSha256 = settlementStateSha256(state);
        trace.push(traceEntry(step, operation, attemptId, "COMMITTED", state, {
          beforeStateSha256: record.beforeExecuteStateSha256,
        }));
      } catch (error) {
        record.errorCode = error instanceof Error ? error.message : "UNKNOWN_SETTLEMENT_ERROR";
        record.afterExecuteStateSha256 = settlementStateSha256(state);
        record.rollbackPreserved =
          record.beforeExecuteStateSha256 === record.afterExecuteStateSha256;
        record.status = record.errorCode.startsWith("INJECTED_FAILURE_")
          ? "ROLLED_BACK"
          : "REJECTED";
        trace.push(traceEntry(step, operation, attemptId, record.status, state, {
          beforeStateSha256: record.beforeExecuteStateSha256,
          errorCode: record.errorCode,
          rollbackPreserved: record.rollbackPreserved,
        }));
      }
      continue;
    }
    const locks = heldLocks.get(attemptId);
    if (!locks) fail("SCHEDULER_RELEASE_WITHOUT_LOCK");
    for (const lock of locks) {
      if (lockOwners.get(lock) !== attemptId) fail("SCHEDULER_LOCK_OWNER_DRIFT");
      lockOwners.delete(lock);
    }
    heldLocks.delete(attemptId);
    if (record.status === "LOCKED") record.status = "READY";
    trace.push(traceEntry(step, operation, attemptId, "LOCK_RELEASED", state, {
      releasedLockCount: String(locks.length),
    }));
  }
  if (lockOwners.size !== 0 || heldLocks.size !== 0) fail("SCHEDULER_UNRELEASED_LOCKS");
  assertStateInvariants(state);
  if (snapshotState(initialState) !== callerSnapshot) fail("SCHEDULER_MUTATED_CALLER_STATE");
  return {
    state,
    initialStateSha256: sha256Hex(callerSnapshot),
    finalStateSha256: settlementStateSha256(state),
    callerStateUnchanged: true,
    allLocksReleased: true,
    attempts: [...records.entries()].map(([attemptId, record]) => ({
      attemptId,
      status: record.status,
      conflictCount: String(record.conflictCount),
      executeCount: String(record.executeCount),
      errorCode: record.errorCode,
      rollbackPreserved: record.rollbackPreserved,
      beforeExecuteStateSha256: record.beforeExecuteStateSha256,
      afterExecuteStateSha256: record.afterExecuteStateSha256,
    })),
    trace,
  };
}

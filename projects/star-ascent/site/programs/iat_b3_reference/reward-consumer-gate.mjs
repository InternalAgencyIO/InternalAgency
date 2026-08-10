import {
  allocatorTranscriptSha256,
  decodeAllocatorReceiptEnvelope,
} from "./reward-allocator-receipt-codec.mjs";
import {
  REWARD_CAS_OPERATION,
  rewardCasStateSha256,
  validateRewardCasCommit,
  validateRewardCasRoundProofRecord,
  validateRewardCasSnapshot,
} from "./reward-persistence-cas.mjs";
import {
  validateRewardCasExternalCheckpoint,
  validateRewardCasPersistenceIdentity,
  verifyRewardCasSnapshotAgainstExternalCheckpoint,
} from "./reward-persistence-checkpoint.mjs";
import { assertDailyLawWriteAllowed } from "./daily-lockdown-consensus.mjs";

export const REWARD_CONSUMER_GATE_SCHEMA = "iat-b3-reward-consumer-gate/v1";
export const REWARD_CONSUMER_GATE_STATUS = "HOST_ONLY_NON_ACTIVATING_EXACT_CHECKPOINT_GATE";
export const REWARD_CONSUMER_GATE_MAINNET_STATUS = "HOLD";
export const REWARD_CONSUMER_SCOPE = Object.freeze({
  LOCAL_PROJECTION: "LOCAL_PROJECTION",
  EXTERNAL_EFFECT: "EXTERNAL_EFFECT",
});

const acceptedPermits = new WeakSet();
const CONSUMER_ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;

function asConsumerId(value) {
  if (typeof value !== "string" || !CONSUMER_ID.test(value)) {
    throw new TypeError("consumerId must be 1-128 canonical lowercase ASCII characters");
  }
  return value;
}

function asStoredU64(value, label) {
  if (typeof value !== "bigint" || value < 0n || value > (1n << 64n) - 1n) {
    throw new TypeError(`${label} must be stored as a u64 bigint`);
  }
  return value;
}

function asHex32(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${label} must be lowercase 32-byte hexadecimal`);
  }
  return value;
}

function cloneAndFreeze(value) {
  const copy = structuredClone(value);
  const freeze = (entry) => {
    if (entry && typeof entry === "object" && !Object.isFrozen(entry)) {
      for (const child of Object.values(entry)) freeze(child);
      Object.freeze(entry);
    }
    return entry;
  };
  return freeze(copy);
}

function requireStore(value) {
  if (!value
    || typeof value.readPersistenceIdentity !== "function"
    || typeof value.snapshot !== "function") {
    throw new TypeError("reward consumer gate store must expose readPersistenceIdentity and snapshot");
  }
  return value;
}

function operationEvidence(snapshot, commit) {
  if (commit.operation === REWARD_CAS_OPERATION.FINALIZE_ROUND) {
    const consumption = snapshot.roundConsumptions.find(
      (candidate) => candidate.commitSha256 === commit.commitSha256,
    );
    const proof = snapshot.roundProofs.find(
      (candidate) => candidate.commitSha256 === commit.commitSha256,
    );
    if (!consumption || !proof) throw new Error("REWARD_CONSUMER_FINALIZATION_EVIDENCE_MISSING");
    const round = snapshot.entities.find((candidate) => (
      candidate.entityKind === "ROUND"
      && candidate.entityKey === proof.fundingRoundAtUnixSeconds.toString()
    ));
    if (!round) throw new Error("REWARD_CONSUMER_FINALIZED_ROUND_MISSING");
    validateRewardCasRoundProofRecord(proof, round);
    if (consumption.proofBundleSha256 !== proof.proofBundleSha256
      || consumption.commitSha256 !== proof.commitSha256
      || consumption.toRoundStateSha256 !== proof.finalizedRoundStateSha256) {
      throw new Error("REWARD_CONSUMER_PROOF_CONSUMPTION_BINDING_MISMATCH");
    }
    const reservations = proof.proofBundle.receiptBytes.map((receiptBytes) => {
      const receipt = decodeAllocatorReceiptEnvelope(receiptBytes);
      const laneSum = receipt.plannedByLane.treasury
        + receipt.plannedByLane.ecosystem
        + receipt.plannedByLane.liquidity;
      if (receipt.disposition === "ADMITTED_RESERVED") {
        if (laneSum !== receipt.exactAmount || receipt.exactAmount === 0n) {
          throw new Error("REWARD_CONSUMER_PARTIAL_RESERVATION_FORBIDDEN");
        }
      } else if (laneSum !== 0n) {
        throw new Error("REWARD_CONSUMER_NULL_OUTCOME_MUST_NOT_RESERVE");
      }
      return Object.freeze({
        allocationIndex: receipt.allocationIndex,
        obligationIdSha256: receipt.obligationIdSha256,
        exactAmount: receipt.exactAmount,
        disposition: receipt.disposition,
        reason: receipt.reason,
        plannedByLane: Object.freeze({
          treasury: receipt.plannedByLane.treasury,
          ecosystem: receipt.plannedByLane.ecosystem,
          liquidity: receipt.plannedByLane.liquidity,
        }),
        binaryReceiptSha256: allocatorTranscriptSha256(receiptBytes),
      });
    });
    return Object.freeze({
      fundingRoundAtUnixSeconds: proof.fundingRoundAtUnixSeconds,
      evidenceSha256: proof.proofRecordSha256,
      reservations: Object.freeze(reservations),
    });
  }

  if (commit.operation === REWARD_CAS_OPERATION.RECORD_PREMIUM_UPGRADE) {
    const attempt = snapshot.upgradeAttempts.find(
      (candidate) => candidate.commitSha256 === commit.commitSha256,
    );
    if (!attempt) throw new Error("REWARD_CONSUMER_UPGRADE_EVIDENCE_MISSING");
    if (attempt.attemptSha256 !== commit.evidenceSha256) {
      throw new Error("REWARD_CONSUMER_UPGRADE_EVIDENCE_DIGEST_MISMATCH");
    }
    return Object.freeze({
      rewardId: attempt.rewardId,
      evidenceSha256: attempt.attemptSha256,
      reservations: Object.freeze([]),
    });
  }

  throw new Error("REWARD_CONSUMER_UNKNOWN_COMMIT_OPERATION");
}

/**
 * Prepare a branded host-only permit for one local projection consumer.
 *
 * Daily Law is checked before reading the store, checkpoint, target sequence,
 * or consumer fields. The local snapshot must be fully valid and exactly equal
 * to the externally retained checkpoint head. A checkpoint that is merely an
 * ancestor is insufficient. This prevents every local projection from
 * consuming an unanchored CAS write.
 *
 * The permit deliberately cannot authorize a payment, token transfer, queue
 * publish, webhook, or any other external effect. Production authentication,
 * rollback protection, a durable per-consumer cursor, and cross-system
 * idempotency are still absent and remain Mainnet blockers.
 */
export function prepareRewardConsumerPermit(input) {
  const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
  const store = requireStore(input?.store);
  const consumerId = asConsumerId(input.consumerId);
  const scope = input.scope;
  if (!Object.values(REWARD_CONSUMER_SCOPE).includes(scope)) {
    throw new Error("INVALID_REWARD_CONSUMER_SCOPE");
  }
  if (scope !== REWARD_CONSUMER_SCOPE.LOCAL_PROJECTION) {
    throw new Error("REWARD_CONSUMER_EXTERNAL_EFFECTS_HOLD");
  }

  const targetSequence = asStoredU64(input.targetCommitSequence, "targetCommitSequence");
  if (targetSequence === 0n) throw new Error("REWARD_CONSUMER_TARGET_MUST_BE_COMMITTED");
  const targetDigest = asHex32(input.targetCommitSha256, "targetCommitSha256");
  const persistenceIdentity = store.readPersistenceIdentity();
  const snapshot = store.snapshot();
  const checkpoint = input.checkpoint;
  validateRewardCasPersistenceIdentity(persistenceIdentity);
  validateRewardCasSnapshot(snapshot);
  validateRewardCasExternalCheckpoint(checkpoint);
  const relationship = verifyRewardCasSnapshotAgainstExternalCheckpoint({
    persistenceIdentity,
    snapshot,
    checkpoint,
  });
  if (relationship.relationship !== "EXACT") {
    throw new Error("REWARD_CONSUMER_UNANCHORED_LOCAL_HEAD_HOLD");
  }
  if (checkpoint.casCommitSequence !== snapshot.head.commitSequence
    || checkpoint.casHeadCommitSha256 !== snapshot.head.headCommitSha256) {
    throw new Error("REWARD_CONSUMER_CHECKPOINT_HEAD_MISMATCH");
  }

  const commit = snapshot.commits[Number(targetSequence - 1n)];
  if (!commit
    || commit.sequence !== targetSequence
    || commit.commitSha256 !== targetDigest) {
    throw new Error("REWARD_CONSUMER_TARGET_COMMIT_MISMATCH");
  }
  validateRewardCasCommit(commit, {
    expectedSequence: targetSequence,
    expectedPreviousCommitSha256: targetSequence === 1n
      ? "0".repeat(64)
      : snapshot.commits[Number(targetSequence - 2n)].commitSha256,
  });
  const evidence = operationEvidence(snapshot, commit);
  const core = {
    schema: REWARD_CONSUMER_GATE_SCHEMA,
    status: REWARD_CONSUMER_GATE_STATUS,
    consumerId,
    scope,
    persistenceIdentitySha256: persistenceIdentity.persistenceIdentitySha256,
    checkpointSha256: checkpoint.checkpointSha256,
    checkpointCommitSequence: checkpoint.casCommitSequence,
    checkpointHeadCommitSha256: checkpoint.casHeadCommitSha256,
    targetCommitSequence: targetSequence,
    targetCommitSha256: targetDigest,
    targetOperation: commit.operation,
    sourceDailyLawReferenceStateSha256: commit.dailyLawReferenceStateSha256,
    consumerDailyLawReferenceStateSha256: rewardCasStateSha256(dailyLawState),
    evidence,
    exactIndivisibleReservationsVerified: true,
    exactCheckpointRequired: true,
    runtimeAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    durableConsumerCursorVerified: false,
    externalSideEffectsAuthorized: false,
    activationReady: false,
    mainnetStatus: REWARD_CONSUMER_GATE_MAINNET_STATUS,
  };
  const permit = cloneAndFreeze({ ...core, permitSha256: rewardCasStateSha256(core) });
  acceptedPermits.add(permit);
  return permit;
}

export function assertRewardConsumerPermit(input) {
  const acceptedDailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
  const {
    permit,
    consumerId,
    targetCommitSequence,
    targetCommitSha256,
  } = input;
  if (!acceptedPermits.has(permit)
    || permit?.schema !== REWARD_CONSUMER_GATE_SCHEMA
    || permit.status !== REWARD_CONSUMER_GATE_STATUS
    || permit.scope !== REWARD_CONSUMER_SCOPE.LOCAL_PROJECTION
    || permit.consumerId !== asConsumerId(consumerId)
    || permit.targetCommitSequence !== asStoredU64(targetCommitSequence, "targetCommitSequence")
    || permit.targetCommitSha256 !== asHex32(targetCommitSha256, "targetCommitSha256")
    || permit.consumerDailyLawReferenceStateSha256 !== rewardCasStateSha256(acceptedDailyLawState)
    || permit.exactIndivisibleReservationsVerified !== true
    || permit.exactCheckpointRequired !== true
    || permit.runtimeAuthenticationVerified !== false
    || permit.rollbackProtectionVerified !== false
    || permit.durableConsumerCursorVerified !== false
    || permit.externalSideEffectsAuthorized !== false
    || permit.activationReady !== false
    || permit.mainnetStatus !== REWARD_CONSUMER_GATE_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_CONSUMER_PERMIT");
  }
  const { permitSha256, ...core } = permit;
  if (permitSha256 !== rewardCasStateSha256(core)) {
    throw new Error("REWARD_CONSUMER_PERMIT_DIGEST_MISMATCH");
  }
  return permit;
}

import { assertDailyLawWriteAllowed } from "./daily-lockdown-consensus.mjs";
import {
  REWARD_CAS_STORE_ADAPTER,
  rewardCasStateSha256,
  validateRewardCasSnapshot,
} from "./reward-persistence-cas.mjs";
import {
  validateRewardCasExternalCheckpoint,
  validateRewardCasPersistenceIdentity,
  verifyRewardCasSnapshotAgainstExternalCheckpoint,
} from "./reward-persistence-checkpoint.mjs";

export const REWARD_CHECKPOINT_GATED_CAS_SCHEMA =
  "iat-b3-reward-checkpoint-gated-cas/v1";
export const REWARD_CHECKPOINT_GATED_CAS_STATUS =
  "HOST_ONLY_NON_ACTIVATING_EXACT_CHECKPOINT_WRITE_GATE";
export const REWARD_CHECKPOINT_GATED_CAS_MAINNET_STATUS = "HOLD";

const READ_METHODS = Object.freeze([
  "readPragmas",
  "readPersistenceIdentity",
  "readHead",
  "readEntity",
  "readCommit",
  "readRoundConsumption",
  "readRoundProof",
  "readUpgradeAttempt",
  "snapshot",
]);

function requireStore(value) {
  const adapter = value?.[REWARD_CAS_STORE_ADAPTER];
  if (!value
    || typeof value.readPersistenceIdentity !== "function"
    || typeof value.snapshot !== "function"
    || !adapter
    || typeof adapter.finalizeRound !== "function"
    || typeof adapter.recordPremiumUpgrade !== "function") {
    throw new TypeError("checkpoint-gated reward CAS requires a complete reward CAS store");
  }
  return { store: value, adapter };
}

function requireCheckpointSource(value) {
  if (!value || typeof value.readCurrent !== "function") {
    throw new TypeError("checkpoint-gated reward CAS requires a checkpoint source with readCurrent");
  }
  return value;
}

/**
 * Prove that a local reward-CAS head is exactly equal to the currently read
 * external checkpoint before one more local write is attempted.
 *
 * Daily Law is deliberately checked before the store, checkpoint source, or
 * any later input is read. The returned facts remain host-only and expressly
 * do not authenticate the checkpoint provider or protect against a process
 * that bypasses this adapter and writes through the underlying store.
 */
export function assertRewardCasLocalWriteAllowed(input) {
  const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
  const { store } = requireStore(input.store);
  const checkpointSource = requireCheckpointSource(input.checkpointSource);

  const persistenceIdentity = store.readPersistenceIdentity();
  const snapshot = store.snapshot();
  const checkpoint = checkpointSource.readCurrent();
  validateRewardCasPersistenceIdentity(persistenceIdentity);
  validateRewardCasSnapshot(snapshot);
  validateRewardCasExternalCheckpoint(checkpoint);
  const relationship = verifyRewardCasSnapshotAgainstExternalCheckpoint({
    persistenceIdentity,
    snapshot,
    checkpoint,
  });
  if (relationship.relationship !== "EXACT"
    || checkpoint.casCommitSequence !== snapshot.head.commitSequence
    || checkpoint.casHeadCommitSha256 !== snapshot.head.headCommitSha256) {
    throw new Error("REWARD_CAS_LOCAL_WRITE_UNANCHORED_HEAD_HOLD");
  }

  return Object.freeze({
    schema: REWARD_CHECKPOINT_GATED_CAS_SCHEMA,
    status: REWARD_CHECKPOINT_GATED_CAS_STATUS,
    persistenceIdentitySha256: persistenceIdentity.persistenceIdentitySha256,
    localSnapshotSha256: rewardCasStateSha256(snapshot),
    localCommitSequence: snapshot.head.commitSequence,
    localHeadCommitSha256: snapshot.head.headCommitSha256,
    checkpointSha256: checkpoint.checkpointSha256,
    checkpointCommitSequence: checkpoint.casCommitSequence,
    checkpointHeadCommitSha256: checkpoint.casHeadCommitSha256,
    exactCheckpointHeadVerified: true,
    plannerDailyLawGatePassed: dailyLawState !== null,
    runtimeAuthenticationVerified: false,
    externalMonotonicityVerified: false,
    rollbackProtectionVerified: false,
    directStoreBypassPreventionVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_CHECKPOINT_GATED_CAS_MAINNET_STATUS,
  });
}

/**
 * Wrap a reward CAS so both supported mutation entry points require an exact
 * checkpoint match immediately before delegating to the store's atomic CAS.
 * The underlying store and checkpoint source are intentionally not exposed on
 * the returned object.
 */
export function createCheckpointGatedRewardPersistenceCas({
  store: candidateStore,
  checkpointSource: candidateCheckpointSource,
} = {}) {
  const { store, adapter } = requireStore(candidateStore);
  const checkpointSource = requireCheckpointSource(candidateCheckpointSource);
  const wrapped = {
    adapterSchema: store.adapterSchema,
    schemaVersion: store.schemaVersion,
    checkpointGateSchema: REWARD_CHECKPOINT_GATED_CAS_SCHEMA,
    status: REWARD_CHECKPOINT_GATED_CAS_STATUS,
    runtimeAuthenticationVerified: false,
    externalMonotonicityVerified: false,
    rollbackProtectionVerified: false,
    directStoreBypassPreventionVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_CHECKPOINT_GATED_CAS_MAINNET_STATUS,
  };
  for (const method of READ_METHODS) {
    if (typeof store[method] === "function") {
      Object.defineProperty(wrapped, method, {
        enumerable: true,
        value: (...args) => store[method](...args),
      });
    }
  }
  if (typeof store.close === "function") {
    Object.defineProperty(wrapped, "close", {
      enumerable: true,
      value: () => store.close(),
    });
  }
  Object.defineProperty(wrapped, REWARD_CAS_STORE_ADAPTER, {
    enumerable: false,
    value: Object.freeze({
      finalizeRound(input) {
        const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
        assertRewardCasLocalWriteAllowed({ dailyLawState, store, checkpointSource });
        return adapter.finalizeRound({ ...input, dailyLawState });
      },
      recordPremiumUpgrade(input) {
        const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
        assertRewardCasLocalWriteAllowed({ dailyLawState, store, checkpointSource });
        return adapter.recordPremiumUpgrade({ ...input, dailyLawState });
      },
    }),
  });
  return Object.freeze(wrapped);
}

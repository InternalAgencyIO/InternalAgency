import { REFERENCE_DEPLOYMENT_DOMAIN_SHA256 } from "./reward-allocator-receipt-codec.mjs";
import { assertDailyLawWriteAllowed } from "./daily-lockdown-consensus.mjs";
import {
  REWARD_CAS_ZERO_SHA256,
  rewardCasStateSha256,
  validateRewardCasSnapshot,
} from "./reward-persistence-cas.mjs";

export const REWARD_CAS_PERSISTENCE_IDENTITY_SCHEMA =
  "iat-b3-reward-cas-persistence-identity/v1";
export const REWARD_CAS_EXTERNAL_CHECKPOINT_SCHEMA =
  "iat-b3-reward-cas-external-checkpoint/v1";
export const REWARD_CAS_EXTERNAL_CHECKPOINT_PLAN_SCHEMA =
  "iat-b3-reward-cas-external-checkpoint-plan/v1";
export const REWARD_CAS_EXTERNAL_CHECKPOINT_STATUS =
  "NON_ACTIVATING_UNAUTHENTICATED_EXTERNAL_CHECKPOINT_REFERENCE";
export const REWARD_CAS_EXTERNAL_CHECKPOINT_MAINNET_STATUS = "HOLD";

export const REWARD_CAS_EXTERNAL_NAMESPACE =
  "IAT_B3_REWARD_CAS_EXTERNAL_CHECKPOINT_REFERENCE_V1";
export const REWARD_CAS_EXTERNAL_NAMESPACE_SHA256 =
  "4e8abed24118568935fd4de9e4d4fb21199cf08e8b060fcef8b556daac82fe32";
export const REWARD_CAS_EXTERNAL_TRUST_POLICY =
  "IAT_B3_REWARD_CAS_EXTERNAL_CHECKPOINT_TRUST_POLICY_UNAUTHENTICATED_PROVIDER_NEUTRAL_V1";
export const REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256 =
  "54cb5c50441d594ff029c59e7a79153bfb7344783278db59ef69377a32ea6cc5";

export const REWARD_CAS_EXTERNAL_CHECKPOINT_DISPOSITION = Object.freeze({
  ADVANCE_ONE: "ADVANCE_ONE",
  ALREADY_CURRENT: "ALREADY_CURRENT",
});

const U64_MAX = (1n << 64n) - 1n;
const HEX_32 = /^[0-9a-f]{64}$/u;

const IDENTITY_KEYS = Object.freeze([
  "schema",
  "status",
  "deploymentDomainSha256",
  "externalNamespaceSha256",
  "externalTrustPolicySha256",
  "adapterSchema",
  "adapterSchemaVersion",
  "schemaManifestSha256",
  "genesisEntitySetSha256",
  "runtimeAuthenticationVerified",
  "externalMonotonicityVerified",
  "rollbackProtectionVerified",
  "activationReady",
  "mainnetStatus",
  "persistenceIdentitySha256",
]);

const CHECKPOINT_KEYS = Object.freeze([
  "schema",
  "status",
  "deploymentDomainSha256",
  "externalNamespaceSha256",
  "externalTrustPolicySha256",
  "persistenceIdentitySha256",
  "checkpointRevision",
  "casCommitSequence",
  "casHeadCommitSha256",
  "previousCheckpointSha256",
  "runtimeAuthenticationVerified",
  "externalMonotonicityVerified",
  "rollbackProtectionVerified",
  "activationReady",
  "mainnetStatus",
  "checkpointSha256",
]);

const PLAN_KEYS = Object.freeze([
  "schema",
  "status",
  "disposition",
  "expectedCheckpointRevision",
  "expectedCheckpointSha256",
  "nextCheckpoint",
  "runtimeAuthenticationVerified",
  "externalMonotonicityVerified",
  "rollbackProtectionVerified",
  "activationReady",
  "mainnetStatus",
  "planSha256",
]);

const IDENTITY_INPUT_KEYS = Object.freeze([
  "adapterSchema",
  "adapterSchemaVersion",
  "schemaManifestSha256",
  "genesisEntitySetSha256",
]);

function isPlainRecord(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasExactKeys(value, expected) {
  if (!isPlainRecord(value)) return false;
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string")) return false;
  for (const key of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor
      || descriptor.enumerable !== true
      || !("value" in descriptor)
      || "get" in descriptor
      || "set" in descriptor) return false;
  }
  actual.sort();
  const canonical = [...expected].sort();
  return actual.length === canonical.length
    && actual.every((key, index) => key === canonical[index]);
}

function exactDataValues(value, expected, errorCode) {
  if (!hasExactKeys(value, expected)) throw new Error(errorCode);
  return Object.fromEntries(expected.map((key) => [
    key,
    Object.getOwnPropertyDescriptor(value, key).value,
  ]));
}

function asHex32(value, label) {
  if (typeof value !== "string" || !HEX_32.test(value)) {
    throw new TypeError(`${label} must be canonical lowercase 32-byte hexadecimal`);
  }
  return value;
}

function asU64(value, label) {
  if (typeof value !== "bigint" || value < 0n || value > U64_MAX) {
    throw new RangeError(`${label} must be an unsigned 64-bit bigint`);
  }
  return value;
}

function asPositiveSchemaVersion(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError("adapter schema version must be a positive safe integer");
  }
  return value;
}

function asNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`);
  }
  return value;
}

function referenceFlags() {
  return {
    runtimeAuthenticationVerified: false,
    externalMonotonicityVerified: false,
    rollbackProtectionVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_CAS_EXTERNAL_CHECKPOINT_MAINNET_STATUS,
  };
}

function validateReferenceFlags(record, label) {
  if (record.runtimeAuthenticationVerified !== false
    || record.externalMonotonicityVerified !== false
    || record.rollbackProtectionVerified !== false
    || record.activationReady !== false
    || record.mainnetStatus !== REWARD_CAS_EXTERNAL_CHECKPOINT_MAINNET_STATUS) {
    throw new Error(`INVALID_REWARD_CAS_${label}_REFERENCE_FLAGS`);
  }
}

function identityCore(input) {
  const values = exactDataValues(
    input,
    IDENTITY_INPUT_KEYS,
    "INVALID_REWARD_CAS_PERSISTENCE_IDENTITY_INPUT",
  );
  return {
    schema: REWARD_CAS_PERSISTENCE_IDENTITY_SCHEMA,
    status: REWARD_CAS_EXTERNAL_CHECKPOINT_STATUS,
    deploymentDomainSha256: REFERENCE_DEPLOYMENT_DOMAIN_SHA256,
    externalNamespaceSha256: REWARD_CAS_EXTERNAL_NAMESPACE_SHA256,
    externalTrustPolicySha256: REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256,
    adapterSchema: asNonEmptyString(values.adapterSchema, "adapter schema"),
    adapterSchemaVersion: asPositiveSchemaVersion(values.adapterSchemaVersion),
    schemaManifestSha256: asHex32(values.schemaManifestSha256, "schema manifest digest"),
    genesisEntitySetSha256: asHex32(values.genesisEntitySetSha256, "genesis entity-set digest"),
    ...referenceFlags(),
  };
}

export function createRewardCasPersistenceIdentity(input) {
  const core = identityCore(input);
  return Object.freeze({
    ...core,
    persistenceIdentitySha256: rewardCasStateSha256(core),
  });
}

export function validateRewardCasPersistenceIdentity(record) {
  if (!hasExactKeys(record, IDENTITY_KEYS)
    || record.schema !== REWARD_CAS_PERSISTENCE_IDENTITY_SCHEMA
    || record.status !== REWARD_CAS_EXTERNAL_CHECKPOINT_STATUS
    || record.deploymentDomainSha256 !== REFERENCE_DEPLOYMENT_DOMAIN_SHA256
    || record.externalNamespaceSha256 !== REWARD_CAS_EXTERNAL_NAMESPACE_SHA256
    || record.externalTrustPolicySha256 !== REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256) {
    throw new Error("INVALID_REWARD_CAS_PERSISTENCE_IDENTITY");
  }
  validateReferenceFlags(record, "PERSISTENCE_IDENTITY");
  const canonical = createRewardCasPersistenceIdentity({
    adapterSchema: record.adapterSchema,
    adapterSchemaVersion: record.adapterSchemaVersion,
    schemaManifestSha256: record.schemaManifestSha256,
    genesisEntitySetSha256: record.genesisEntitySetSha256,
  });
  if (asHex32(record.persistenceIdentitySha256, "persistence identity digest")
    !== canonical.persistenceIdentitySha256) {
    throw new Error("REWARD_CAS_PERSISTENCE_IDENTITY_DIGEST_MISMATCH");
  }
  return record;
}

function createCheckpoint({
  persistenceIdentity,
  checkpointRevision,
  casCommitSequence,
  casHeadCommitSha256,
  previousCheckpointSha256,
}) {
  validateRewardCasPersistenceIdentity(persistenceIdentity);
  const revision = asU64(checkpointRevision, "checkpoint revision");
  const sequence = asU64(casCommitSequence, "checkpoint CAS commit sequence");
  if (revision === 0n || revision !== sequence + 1n) {
    throw new Error("REWARD_CAS_CHECKPOINT_REVISION_MUST_TRACK_CONTIGUOUS_SEQUENCE");
  }
  const headDigest = asHex32(casHeadCommitSha256, "checkpoint CAS head digest");
  const previousDigest = asHex32(previousCheckpointSha256, "previous checkpoint digest");
  if ((sequence === 0n) !== (headDigest === REWARD_CAS_ZERO_SHA256)) {
    throw new Error("INVALID_REWARD_CAS_CHECKPOINT_GENESIS_HEAD");
  }
  if ((revision === 1n) !== (previousDigest === REWARD_CAS_ZERO_SHA256)) {
    throw new Error("INVALID_REWARD_CAS_CHECKPOINT_PREVIOUS_DIGEST");
  }
  const core = {
    schema: REWARD_CAS_EXTERNAL_CHECKPOINT_SCHEMA,
    status: REWARD_CAS_EXTERNAL_CHECKPOINT_STATUS,
    deploymentDomainSha256: REFERENCE_DEPLOYMENT_DOMAIN_SHA256,
    externalNamespaceSha256: REWARD_CAS_EXTERNAL_NAMESPACE_SHA256,
    externalTrustPolicySha256: REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256,
    persistenceIdentitySha256: persistenceIdentity.persistenceIdentitySha256,
    checkpointRevision: revision,
    casCommitSequence: sequence,
    casHeadCommitSha256: headDigest,
    previousCheckpointSha256: previousDigest,
    ...referenceFlags(),
  };
  return Object.freeze({ ...core, checkpointSha256: rewardCasStateSha256(core) });
}

export function validateRewardCasExternalCheckpoint(record) {
  if (!hasExactKeys(record, CHECKPOINT_KEYS)
    || record.schema !== REWARD_CAS_EXTERNAL_CHECKPOINT_SCHEMA
    || record.status !== REWARD_CAS_EXTERNAL_CHECKPOINT_STATUS
    || record.deploymentDomainSha256 !== REFERENCE_DEPLOYMENT_DOMAIN_SHA256
    || record.externalNamespaceSha256 !== REWARD_CAS_EXTERNAL_NAMESPACE_SHA256
    || record.externalTrustPolicySha256 !== REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256) {
    throw new Error("INVALID_REWARD_CAS_EXTERNAL_CHECKPOINT");
  }
  validateReferenceFlags(record, "EXTERNAL_CHECKPOINT");
  const revision = asU64(record.checkpointRevision, "checkpoint revision");
  const sequence = asU64(record.casCommitSequence, "checkpoint CAS commit sequence");
  if (revision === 0n || revision !== sequence + 1n) {
    throw new Error("REWARD_CAS_CHECKPOINT_REVISION_MUST_TRACK_CONTIGUOUS_SEQUENCE");
  }
  const headDigest = asHex32(record.casHeadCommitSha256, "checkpoint CAS head digest");
  const previousDigest = asHex32(record.previousCheckpointSha256, "previous checkpoint digest");
  asHex32(record.persistenceIdentitySha256, "persistence identity digest");
  if ((sequence === 0n) !== (headDigest === REWARD_CAS_ZERO_SHA256)
    || (revision === 1n) !== (previousDigest === REWARD_CAS_ZERO_SHA256)) {
    throw new Error("INVALID_REWARD_CAS_EXTERNAL_CHECKPOINT_CHAIN");
  }
  const { checkpointSha256, ...core } = record;
  if (asHex32(checkpointSha256, "checkpoint digest") !== rewardCasStateSha256(core)) {
    throw new Error("REWARD_CAS_EXTERNAL_CHECKPOINT_DIGEST_MISMATCH");
  }
  return record;
}

function expectedCheckpointAtSequence({ persistenceIdentity, snapshot, sequence }) {
  let expected = createCheckpoint({
    persistenceIdentity,
    checkpointRevision: 1n,
    casCommitSequence: 0n,
    casHeadCommitSha256: REWARD_CAS_ZERO_SHA256,
    previousCheckpointSha256: REWARD_CAS_ZERO_SHA256,
  });
  for (let index = 0; BigInt(index) < sequence; index += 1) {
    const commit = snapshot.commits[index];
    if (!commit || commit.sequence !== BigInt(index) + 1n) {
      throw new Error("REWARD_CAS_CHECKPOINT_RECONSTRUCTION_GAP");
    }
    expected = createCheckpoint({
      persistenceIdentity,
      checkpointRevision: commit.sequence + 1n,
      casCommitSequence: commit.sequence,
      casHeadCommitSha256: commit.commitSha256,
      previousCheckpointSha256: expected.checkpointSha256,
    });
  }
  return expected;
}

export function verifyRewardCasSnapshotAgainstExternalCheckpoint({
  persistenceIdentity,
  snapshot,
  checkpoint,
}) {
  validateRewardCasPersistenceIdentity(persistenceIdentity);
  validateRewardCasExternalCheckpoint(checkpoint);
  validateRewardCasSnapshot(snapshot);
  if (checkpoint.persistenceIdentitySha256 !== persistenceIdentity.persistenceIdentitySha256) {
    throw new Error("REWARD_CAS_CHECKPOINT_PERSISTENCE_IDENTITY_MISMATCH");
  }
  const localSequence = snapshot.head.commitSequence;
  const anchoredSequence = checkpoint.casCommitSequence;
  if (localSequence < anchoredSequence) {
    throw new Error("REWARD_CAS_LOCAL_BEHIND_EXTERNAL_CHECKPOINT");
  }
  if (anchoredSequence === 0n) {
    return Object.freeze({ relationship: localSequence === 0n ? "EXACT" : "LOCAL_AHEAD" });
  }
  const retained = snapshot.commits[Number(anchoredSequence - 1n)];
  if (!retained || retained.commitSha256 !== checkpoint.casHeadCommitSha256) {
    if (localSequence === anchoredSequence) {
      throw new Error("REWARD_CAS_SAME_SEQUENCE_CHECKPOINT_FORK");
    }
    throw new Error("REWARD_CAS_EXTERNAL_CHECKPOINT_NOT_RETAINED_ANCESTOR");
  }
  const expectedCheckpoint = expectedCheckpointAtSequence({
    persistenceIdentity,
    snapshot,
    sequence: anchoredSequence,
  });
  if (checkpoint.previousCheckpointSha256 !== expectedCheckpoint.previousCheckpointSha256
    || checkpoint.checkpointSha256 !== expectedCheckpoint.checkpointSha256) {
    throw new Error("REWARD_CAS_EXTERNAL_CHECKPOINT_CHAIN_MISMATCH");
  }
  return Object.freeze({ relationship: localSequence === anchoredSequence ? "EXACT" : "LOCAL_AHEAD" });
}

function planCore({ disposition, expectedRevision, expectedDigest, nextCheckpoint }) {
  return {
    schema: REWARD_CAS_EXTERNAL_CHECKPOINT_PLAN_SCHEMA,
    status: REWARD_CAS_EXTERNAL_CHECKPOINT_STATUS,
    disposition,
    expectedCheckpointRevision: expectedRevision,
    expectedCheckpointSha256: expectedDigest,
    nextCheckpoint,
    ...referenceFlags(),
  };
}

export function validateRewardCasExternalCheckpointPlan(plan) {
  if (!hasExactKeys(plan, PLAN_KEYS)
    || plan.schema !== REWARD_CAS_EXTERNAL_CHECKPOINT_PLAN_SCHEMA
    || plan.status !== REWARD_CAS_EXTERNAL_CHECKPOINT_STATUS
    || !Object.values(REWARD_CAS_EXTERNAL_CHECKPOINT_DISPOSITION).includes(plan.disposition)) {
    throw new Error("INVALID_REWARD_CAS_EXTERNAL_CHECKPOINT_PLAN");
  }
  validateReferenceFlags(plan, "EXTERNAL_CHECKPOINT_PLAN");
  const expectedRevision = asU64(plan.expectedCheckpointRevision, "expected checkpoint revision");
  const expectedDigest = asHex32(plan.expectedCheckpointSha256, "expected checkpoint digest");
  validateRewardCasExternalCheckpoint(plan.nextCheckpoint);
  if (plan.disposition === REWARD_CAS_EXTERNAL_CHECKPOINT_DISPOSITION.ADVANCE_ONE) {
    if (plan.nextCheckpoint.checkpointRevision !== expectedRevision + 1n
      || plan.nextCheckpoint.previousCheckpointSha256 !== expectedDigest) {
      throw new Error("REWARD_CAS_CHECKPOINT_PLAN_NOT_ONE_STEP");
    }
  } else if (plan.nextCheckpoint.checkpointRevision !== expectedRevision
    || plan.nextCheckpoint.checkpointSha256 !== expectedDigest) {
    throw new Error("REWARD_CAS_ALREADY_CURRENT_PLAN_MISMATCH");
  }
  const { planSha256, ...core } = plan;
  if (asHex32(planSha256, "checkpoint plan digest") !== rewardCasStateSha256(core)) {
    throw new Error("REWARD_CAS_EXTERNAL_CHECKPOINT_PLAN_DIGEST_MISMATCH");
  }
  return plan;
}

export function prepareRewardCasExternalCheckpointAdvance(input) {
  assertDailyLawWriteAllowed(input?.dailyLawState);
  const { persistenceIdentity, snapshot, currentCheckpoint = null } = input;
  validateRewardCasPersistenceIdentity(persistenceIdentity);
  validateRewardCasSnapshot(snapshot);
  let disposition = REWARD_CAS_EXTERNAL_CHECKPOINT_DISPOSITION.ADVANCE_ONE;
  let expectedRevision = 0n;
  let expectedDigest = REWARD_CAS_ZERO_SHA256;
  let nextCheckpoint;
  if (currentCheckpoint === null) {
    if (snapshot.head.commitSequence !== 0n) {
      throw new Error("REWARD_CAS_UNANCHORED_HISTORY_HOLD");
    }
    nextCheckpoint = createCheckpoint({
      persistenceIdentity,
      checkpointRevision: 1n,
      casCommitSequence: 0n,
      casHeadCommitSha256: REWARD_CAS_ZERO_SHA256,
      previousCheckpointSha256: REWARD_CAS_ZERO_SHA256,
    });
  } else {
    validateRewardCasExternalCheckpoint(currentCheckpoint);
    verifyRewardCasSnapshotAgainstExternalCheckpoint({
      persistenceIdentity,
      snapshot,
      checkpoint: currentCheckpoint,
    });
    expectedRevision = currentCheckpoint.checkpointRevision;
    expectedDigest = currentCheckpoint.checkpointSha256;
    if (currentCheckpoint.casCommitSequence === snapshot.head.commitSequence) {
      disposition = REWARD_CAS_EXTERNAL_CHECKPOINT_DISPOSITION.ALREADY_CURRENT;
      nextCheckpoint = currentCheckpoint;
    } else {
      const nextSequence = currentCheckpoint.casCommitSequence + 1n;
      const nextCommit = snapshot.commits[Number(nextSequence - 1n)];
      if (!nextCommit
        || nextCommit.sequence !== nextSequence
        || nextCommit.previousCommitSha256 !== currentCheckpoint.casHeadCommitSha256) {
        throw new Error("REWARD_CAS_CHECKPOINT_NEXT_COMMIT_ANCESTRY_MISMATCH");
      }
      nextCheckpoint = createCheckpoint({
        persistenceIdentity,
        checkpointRevision: expectedRevision + 1n,
        casCommitSequence: nextSequence,
        casHeadCommitSha256: nextCommit.commitSha256,
        previousCheckpointSha256: expectedDigest,
      });
    }
  }
  const core = planCore({ disposition, expectedRevision, expectedDigest, nextCheckpoint });
  const plan = Object.freeze({ ...core, planSha256: rewardCasStateSha256(core) });
  validateRewardCasExternalCheckpointPlan(plan);
  return plan;
}

function exactCheckpointOrNull(value, expected) {
  if (value === null) return null;
  validateRewardCasExternalCheckpoint(value);
  return value.checkpointSha256 === expected.checkpointSha256
    && value.checkpointRevision === expected.checkpointRevision
    ? value
    : null;
}

export function advanceRewardCasExternalCheckpoint(input) {
  const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
  const { store, sink } = input;
  if (!store || typeof store.readPersistenceIdentity !== "function" || typeof store.snapshot !== "function") {
    throw new TypeError("reward CAS checkpoint store must expose readPersistenceIdentity and snapshot");
  }
  if (!sink || typeof sink.readCurrent !== "function" || typeof sink.compareAndSwap !== "function") {
    throw new TypeError("reward CAS checkpoint sink must expose readCurrent and compareAndSwap");
  }
  const persistenceIdentity = store.readPersistenceIdentity();
  const snapshot = store.snapshot();
  const currentCheckpoint = sink.readCurrent();
  const plan = prepareRewardCasExternalCheckpointAdvance({
    dailyLawState,
    persistenceIdentity,
    snapshot,
    currentCheckpoint,
  });
  if (plan.disposition === REWARD_CAS_EXTERNAL_CHECKPOINT_DISPOSITION.ALREADY_CURRENT) {
    return Object.freeze({
      disposition: plan.disposition,
      checkpoint: plan.nextCheckpoint,
      recoveredAfterUncertainResponse: false,
    });
  }
  let uncertainFailure = null;
  try {
    sink.compareAndSwap(Object.freeze({
      expectedCheckpointRevision: plan.expectedCheckpointRevision,
      expectedCheckpointSha256: plan.expectedCheckpointSha256,
      nextCheckpoint: plan.nextCheckpoint,
      planSha256: plan.planSha256,
    }));
  } catch (error) {
    uncertainFailure = error;
  }
  let observed;
  try {
    observed = exactCheckpointOrNull(sink.readCurrent(), plan.nextCheckpoint);
  } catch (readError) {
    if (uncertainFailure) throw uncertainFailure;
    throw readError;
  }
  if (!observed) {
    if (uncertainFailure) throw uncertainFailure;
    throw new Error("REWARD_CAS_CHECKPOINT_SINK_DID_NOT_COMMIT_EXACT_PLAN");
  }
  return Object.freeze({
    disposition: plan.disposition,
    checkpoint: observed,
    recoveredAfterUncertainResponse: uncertainFailure !== null,
  });
}

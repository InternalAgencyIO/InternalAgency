import { assertDailyLawWriteAllowed } from "./daily-lockdown-consensus.mjs";
import {
  PROVIDER_AUTHENTICATION_MAINNET_STATUS,
  PROVIDER_KINDS,
  validateProviderTrustBinding,
} from "./provider-authenticated-envelope.mjs";
import {
  validateRewardRollbackAnchorVerificationReceipt,
  verifyRewardExternalRollbackAnchor,
} from "./reward-external-rollback-anchor.mjs";
import {
  REWARD_ROLLBACK_ANCHOR_SQLITE_ADAPTER_SCHEMA,
  REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS,
  REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP,
  REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS,
  assertSqliteRewardRollbackAnchorMirrorAdapter,
} from "./reward-rollback-anchor-sqlite.mjs";
import {
  decodeRewardCasTypedValue,
  encodeRewardCasTypedValue,
  rewardCasStateSha256,
  validateRewardCasSnapshot,
} from "./reward-persistence-cas.mjs";
import {
  validateRewardCasExternalCheckpoint,
  validateRewardCasPersistenceIdentity,
  verifyRewardCasSnapshotAgainstExternalCheckpoint,
} from "./reward-persistence-checkpoint.mjs";
import {
  REWARD_CHECKPOINT_GATED_CAS_MAINNET_STATUS,
  REWARD_CHECKPOINT_GATED_CAS_SCHEMA,
  REWARD_CHECKPOINT_GATED_CAS_STATUS,
  assertCheckpointGatedRewardPersistenceCasAdapter,
} from "./reward-checkpoint-gated-cas.mjs";
import {
  REWARD_CONSUMER_SCOPE,
  prepareRewardConsumerPermit,
} from "./reward-consumer-gate.mjs";
import {
  REWARD_CONSUMER_CURSOR_MAINNET_STATUS,
  REWARD_CONSUMER_CURSOR_SQLITE_ADAPTER_SCHEMA,
  REWARD_CONSUMER_CURSOR_STATUS,
  REWARD_CONSUMER_PROJECTION_COMMITMENT_SCHEMA,
  assertSqliteRewardConsumerCursorAdapter,
  validateRewardConsumerCursorRecord,
  validateRewardConsumerProjectionEventRecord,
} from "./reward-consumer-cursor-sqlite.mjs";

export const REWARD_AUTHENTICATED_CONSUMER_RUNTIME_BINDING_SCHEMA =
  "iat-b3-reward-authenticated-consumer-runtime-binding/v1";
export const REWARD_AUTHENTICATED_CONSUMER_RUNTIME_SCHEMA =
  "iat-b3-reward-authenticated-consumer-runtime/v1";
export const REWARD_AUTHENTICATED_CONSUMER_RECEIPT_SCHEMA =
  "iat-b3-reward-authenticated-consumer-composition-receipt/v1";
export const REWARD_AUTHENTICATED_CONSUMER_RUNTIME_STATUS =
  "HOST_ONLY_NON_ACTIVATING_SIGNED_ANCHOR_LOCAL_CONSUMER_COMPOSITION";
export const REWARD_AUTHENTICATED_CONSUMER_RUNTIME_MAINNET_STATUS = "HOLD";
export const REWARD_AUTHENTICATED_CONSUMER_DISPOSITION = Object.freeze({
  COMMITTED: "COMMITTED",
  RECONCILED_AFTER_COMMIT: "RECONCILED_AFTER_COMMIT",
});

const U64_MAX = (1n << 64n) - 1n;
const HEX_32 = /^[0-9a-f]{64}$/u;
const IDENTIFIER = /^[a-z0-9][a-z0-9._:/-]{7,127}$/u;
const CONSUMER_ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;
const PROJECTION_LABEL = /^[a-z0-9](?:[a-z0-9._:/-]{0,126}[a-z0-9])?$/u;
const EXECUTED_COMPOSITION_RECEIPTS = new WeakSet();

const BINDING_INPUT_KEYS = Object.freeze([
  "environment",
  "runtimeIdentitySha256",
  "productionIdentityFreezeManifestSha256",
  "productionDeploymentDomainSha256",
  "productionPersistenceIdentitySha256",
  "rewardAdapterSchema",
  "rewardAdapterSchemaVersion",
  "rewardSchemaManifestSha256",
  "rewardGenesisEntitySetSha256",
  "anchorNamespaceSha256",
  "providerTrustBindingSha256",
  "providerTrustRootSha256",
  "providerKeyRegistrySnapshotSha256",
  "providerReceiptDomainSha256",
  "ownerProductionKeyEvidenceSha256",
  "providerReadinessPacketSha256",
  "failureDomainSeparationEvidenceSha256",
  "consumerInventoryEvidenceSha256",
  "anchorMirrorSchemaManifestSha256",
  "consumerCursorSchemaManifestSha256",
  "consumerId",
  "projectionKind",
  "projectionKey",
]);

const BINDING_KEYS = Object.freeze([
  "schema",
  "status",
  ...BINDING_INPUT_KEYS,
  "productionIdentityEvidenceAccepted",
  "providerAuthenticationVerified",
  "externalMonotonicityVerified",
  "independentRollbackProtectionVerified",
  "runtimeConfinementVerified",
  "runtimeIntegrationVerified",
  "independentReviewAccepted",
  "activationReady",
  "mainnetStatus",
  "runtimeBindingSha256",
]);

const CONSUME_INPUT_KEYS = Object.freeze([
  "dailyLawState",
  "currentProviderState",
  "currentAnchorState",
  "providerEnvelope",
  "requestBytes",
  "anchorBytes",
  "expectedRequestNonceSha256",
  "checkpoint",
  "evaluationUnixSeconds",
  "consumerId",
  "scope",
  "targetCommitSequence",
  "targetCommitSha256",
  "projection",
]);

const RECEIPT_KEYS = Object.freeze([
  "schema",
  "status",
  "disposition",
  "runtimeBindingSha256",
  "consumerId",
  "targetCommitSequence",
  "targetCommitSha256",
  "checkpointSha256",
  "checkpointCommitSequence",
  "checkpointHeadCommitSha256",
  "anchorSequence",
  "anchorSha256",
  "providerEnvelopeSequence",
  "providerEnvelopeSha256",
  "sourceAnchorVerificationReceiptSha256",
  "durableAnchorReceiptRecordSha256",
  "durableAnchorCursorSha256",
  "consumerPermitSha256",
  "consumerCursorSha256",
  "projectionCommitmentSha256",
  "projectionEventRecordSha256",
  "dailyLawGatePassed",
  "configuredRuntimeBindingMatched",
  "cryptographicSignaturePrerequisiteVerified",
  "exactSignedCheckpointMatched",
  "durableLocalAnchorMirrorMatched",
  "durableLocalCursorEventMatched",
  "lostResponseReadbackReconciled",
  "providerAuthenticationVerified",
  "providerIdentityVerified",
  "productionKeyOwnershipVerified",
  "keyRegistryAuthenticityVerified",
  "externalProviderDurabilityVerified",
  "externalMonotonicityVerified",
  "independentRollbackProtectionVerified",
  "suppliedStateAuthenticityVerified",
  "materializedProjectionStateVerified",
  "projectionEffectAtomicityVerified",
  "runtimeConfinementVerified",
  "runtimeIntegrationVerified",
  "externalSideEffectsAuthorized",
  "independentReviewAccepted",
  "activationReady",
  "mainnetStatus",
  "compositionReceiptSha256",
]);

function isPlainRecord(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactDataValues(value, expected, errorCode) {
  if (!isPlainRecord(value)) throw new TypeError(errorCode);
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string")) throw new TypeError(errorCode);
  for (const key of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor
      || descriptor.enumerable !== true
      || !Object.hasOwn(descriptor, "value")
      || Object.hasOwn(descriptor, "get")
      || Object.hasOwn(descriptor, "set")) throw new TypeError(errorCode);
  }
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  if (sortedActual.length !== sortedExpected.length
    || sortedActual.some((key, index) => key !== sortedExpected[index])) {
    throw new TypeError(errorCode);
  }
  return Object.fromEntries(expected.map((key) => [
    key,
    Object.getOwnPropertyDescriptor(value, key).value,
  ]));
}

function asDigest(value, label, { allowZero = false } = {}) {
  if (typeof value !== "string" || !HEX_32.test(value)) {
    throw new TypeError(`${label} must be canonical lowercase 32-byte hexadecimal`);
  }
  if (!allowZero && value === "0".repeat(64)) throw new Error(`${label} must not be zero`);
  return value;
}

function asIdentifier(value, label) {
  if (typeof value !== "string" || !IDENTIFIER.test(value)) {
    throw new TypeError(`${label} must be a canonical production identifier`);
  }
  return value;
}

function asConsumerId(value) {
  if (typeof value !== "string" || !CONSUMER_ID.test(value)) {
    throw new TypeError("consumerId must be 1-128 canonical lowercase ASCII characters");
  }
  return value;
}

function asProjectionLabel(value, label) {
  if (typeof value !== "string" || !PROJECTION_LABEL.test(value)) {
    throw new TypeError(`${label} must be a canonical projection label`);
  }
  return value;
}

function asU64(value, label) {
  if (typeof value !== "bigint" || value < 0n || value > U64_MAX) {
    throw new TypeError(`${label} must be stored as an unsigned 64-bit bigint`);
  }
  return value;
}

function asU64Decimal(value, label, { positive = false } = {}) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,19})$/u.test(value)) {
    throw new TypeError(`${label} must be canonical unsigned decimal`);
  }
  const parsed = BigInt(value);
  if (parsed > U64_MAX || (positive && parsed === 0n)) {
    throw new RangeError(`${label} is outside the accepted range`);
  }
  return parsed;
}

function asPositiveVersion(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive safe integer`);
  }
  return value;
}

function freezeClone(value) {
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

function falseBoundary() {
  return {
    providerAuthenticationVerified: false,
    externalMonotonicityVerified: false,
    independentRollbackProtectionVerified: false,
    runtimeConfinementVerified: false,
    runtimeIntegrationVerified: false,
    independentReviewAccepted: false,
    activationReady: false,
    mainnetStatus: REWARD_AUTHENTICATED_CONSUMER_RUNTIME_MAINNET_STATUS,
  };
}

function bindingCore(input) {
  const values = exactDataValues(
    input,
    BINDING_INPUT_KEYS,
    "INVALID_REWARD_AUTHENTICATED_CONSUMER_RUNTIME_BINDING_INPUT",
  );
  if (values.environment !== "PRODUCTION") {
    throw new Error("reward authenticated consumer binding requires PRODUCTION");
  }
  const core = {
    schema: REWARD_AUTHENTICATED_CONSUMER_RUNTIME_BINDING_SCHEMA,
    status: REWARD_AUTHENTICATED_CONSUMER_RUNTIME_STATUS,
    environment: "PRODUCTION",
    runtimeIdentitySha256: asDigest(values.runtimeIdentitySha256, "runtime identity"),
    productionIdentityFreezeManifestSha256: asDigest(
      values.productionIdentityFreezeManifestSha256,
      "production identity-freeze manifest",
    ),
    productionDeploymentDomainSha256: asDigest(
      values.productionDeploymentDomainSha256,
      "production deployment domain",
    ),
    productionPersistenceIdentitySha256: asDigest(
      values.productionPersistenceIdentitySha256,
      "production persistence identity",
    ),
    rewardAdapterSchema: asIdentifier(values.rewardAdapterSchema, "reward adapter schema"),
    rewardAdapterSchemaVersion: asPositiveVersion(
      values.rewardAdapterSchemaVersion,
      "reward adapter schema version",
    ),
    rewardSchemaManifestSha256: asDigest(
      values.rewardSchemaManifestSha256,
      "reward schema manifest",
    ),
    rewardGenesisEntitySetSha256: asDigest(
      values.rewardGenesisEntitySetSha256,
      "reward Genesis entity set",
    ),
    anchorNamespaceSha256: asDigest(values.anchorNamespaceSha256, "anchor namespace"),
    providerTrustBindingSha256: asDigest(
      values.providerTrustBindingSha256,
      "provider trust binding",
    ),
    providerTrustRootSha256: asDigest(values.providerTrustRootSha256, "provider trust root"),
    providerKeyRegistrySnapshotSha256: asDigest(
      values.providerKeyRegistrySnapshotSha256,
      "provider key-registry snapshot",
    ),
    providerReceiptDomainSha256: asDigest(
      values.providerReceiptDomainSha256,
      "provider receipt domain",
    ),
    ownerProductionKeyEvidenceSha256: asDigest(
      values.ownerProductionKeyEvidenceSha256,
      "owner production-key evidence",
    ),
    providerReadinessPacketSha256: asDigest(
      values.providerReadinessPacketSha256,
      "provider readiness packet",
    ),
    failureDomainSeparationEvidenceSha256: asDigest(
      values.failureDomainSeparationEvidenceSha256,
      "failure-domain separation evidence",
    ),
    consumerInventoryEvidenceSha256: asDigest(
      values.consumerInventoryEvidenceSha256,
      "consumer inventory evidence",
    ),
    anchorMirrorSchemaManifestSha256: asDigest(
      values.anchorMirrorSchemaManifestSha256,
      "anchor mirror schema manifest",
    ),
    consumerCursorSchemaManifestSha256: asDigest(
      values.consumerCursorSchemaManifestSha256,
      "consumer cursor schema manifest",
    ),
    consumerId: asConsumerId(values.consumerId),
    projectionKind: asProjectionLabel(values.projectionKind, "projection kind"),
    projectionKey: asProjectionLabel(values.projectionKey, "projection key"),
    productionIdentityEvidenceAccepted: false,
    ...falseBoundary(),
  };
  return core;
}

export function createRewardAuthenticatedConsumerRuntimeBinding(input) {
  const core = bindingCore(input);
  return Object.freeze({
    ...core,
    runtimeBindingSha256: rewardCasStateSha256(core),
  });
}

export function validateRewardAuthenticatedConsumerRuntimeBinding(binding) {
  const values = exactDataValues(
    binding,
    BINDING_KEYS,
    "INVALID_REWARD_AUTHENTICATED_CONSUMER_RUNTIME_BINDING",
  );
  const canonical = createRewardAuthenticatedConsumerRuntimeBinding(
    Object.fromEntries(BINDING_INPUT_KEYS.map((key) => [key, values[key]])),
  );
  if (JSON.stringify(binding) !== JSON.stringify(canonical)) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_RUNTIME_BINDING_DIGEST_MISMATCH");
  }
  return binding;
}

function requireRewardStore(store, binding) {
  assertCheckpointGatedRewardPersistenceCasAdapter(store);
  if (!store
    || store.checkpointGateSchema !== REWARD_CHECKPOINT_GATED_CAS_SCHEMA
    || store.status !== REWARD_CHECKPOINT_GATED_CAS_STATUS
    || store.runtimeAuthenticationVerified !== false
    || store.externalMonotonicityVerified !== false
    || store.rollbackProtectionVerified !== false
    || store.directStoreBypassPreventionVerified !== false
    || store.activationReady !== false
    || store.mainnetStatus !== REWARD_CHECKPOINT_GATED_CAS_MAINNET_STATUS
    || typeof store.readPersistenceIdentity !== "function"
    || typeof store.snapshot !== "function") {
    throw new TypeError("authenticated reward consumer requires the exact checkpoint-gated store");
  }
  const identity = store.readPersistenceIdentity();
  validateRewardCasPersistenceIdentity(identity);
  if (store.adapterSchema !== identity.adapterSchema
    || store.schemaVersion !== identity.adapterSchemaVersion
    || identity.persistenceIdentitySha256 !== binding.productionPersistenceIdentitySha256
    || identity.deploymentDomainSha256 !== binding.productionDeploymentDomainSha256
    || identity.adapterSchema !== binding.rewardAdapterSchema
    || identity.adapterSchemaVersion !== binding.rewardAdapterSchemaVersion
    || identity.schemaManifestSha256 !== binding.rewardSchemaManifestSha256
    || identity.genesisEntitySetSha256 !== binding.rewardGenesisEntitySetSha256) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_REWARD_STORE_BINDING_MISMATCH");
  }
  validateRewardCasSnapshot(store.snapshot());
  return store;
}

function requireAnchorMirror(mirror, binding) {
  assertSqliteRewardRollbackAnchorMirrorAdapter(mirror);
  if (!mirror
    || mirror.adapterSchema !== REWARD_ROLLBACK_ANCHOR_SQLITE_ADAPTER_SCHEMA
    || mirror.status !== REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS
    || mirror.schemaManifestSha256 !== binding.anchorMirrorSchemaManifestSha256
    || mirror.durableLocalMirrorVerified !== true
    || mirror.cursorReceiptAtomicityVerified !== true
    || mirror.localRollbackComparisonVerified !== true
    || mirror.providerAuthenticationVerified !== false
    || mirror.externalProviderDurabilityVerified !== false
    || mirror.externalMonotonicityVerified !== false
    || mirror.independentRollbackProtectionVerified !== false
    || mirror.runtimeIntegrationVerified !== false
    || mirror.activationReady !== false
    || mirror.mainnetStatus !== REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS
    || typeof mirror.readHead !== "function"
    || typeof mirror.snapshot !== "function"
    || typeof mirror.consumeSignedAnchorReceipt !== "function"
    || typeof mirror.compareWithSuppliedAnchorState !== "function") {
    throw new TypeError("authenticated reward consumer requires the exact rollback-anchor mirror");
  }
  mirror.readHead();
  return mirror;
}

function requireConsumerCursor(cursor, binding) {
  assertSqliteRewardConsumerCursorAdapter(cursor);
  if (!cursor
    || cursor.adapterSchema !== REWARD_CONSUMER_CURSOR_SQLITE_ADAPTER_SCHEMA
    || cursor.status !== REWARD_CONSUMER_CURSOR_STATUS
    || cursor.schemaManifestSha256 !== binding.consumerCursorSchemaManifestSha256
    || cursor.durableCursorPersistenceVerified !== true
    || cursor.localProjectionEventAppendAtomicityVerified !== true
    || cursor.materializedProjectionStateVerified !== false
    || cursor.runtimeAuthenticationVerified !== false
    || cursor.rollbackProtectionVerified !== false
    || cursor.projectionEffectAtomicityVerified !== false
    || cursor.externalSideEffectsAuthorized !== false
    || cursor.activationReady !== false
    || cursor.mainnetStatus !== REWARD_CONSUMER_CURSOR_MAINNET_STATUS
    || typeof cursor.readCursor !== "function"
    || typeof cursor.readProjectionEvent !== "function"
    || typeof cursor.snapshot !== "function"
    || typeof cursor.consumePermit !== "function") {
    throw new TypeError("authenticated reward consumer requires the exact durable consumer cursor");
  }
  cursor.snapshot();
  return cursor;
}

function assertTrustBindingMatches(binding, trustBinding) {
  validateProviderTrustBinding(trustBinding);
  if (trustBinding.environment !== "PRODUCTION"
    || trustBinding.providerKind !== PROVIDER_KINDS.EXTERNAL_CHECKPOINT
    || trustBinding.mainnetStatus !== PROVIDER_AUTHENTICATION_MAINNET_STATUS
    || trustBinding.trustBindingSha256 !== binding.providerTrustBindingSha256
    || trustBinding.trustRootSha256 !== binding.providerTrustRootSha256
    || trustBinding.keyRegistrySnapshotSha256 !== binding.providerKeyRegistrySnapshotSha256
    || trustBinding.receiptDomainSha256 !== binding.providerReceiptDomainSha256
    || trustBinding.ownerProductionKeyEvidenceSha256
      !== binding.ownerProductionKeyEvidenceSha256) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_PROVIDER_TRUST_BINDING_MISMATCH");
  }
}

function assertCheckpointBinding({ checkpoint, identity, snapshot, binding }) {
  validateRewardCasExternalCheckpoint(checkpoint);
  const relationship = verifyRewardCasSnapshotAgainstExternalCheckpoint({
    persistenceIdentity: identity,
    snapshot,
    checkpoint,
  });
  if (relationship.relationship !== "EXACT"
    || checkpoint.persistenceIdentitySha256 !== binding.productionPersistenceIdentitySha256
    || checkpoint.deploymentDomainSha256 !== binding.productionDeploymentDomainSha256
    || checkpoint.casCommitSequence !== snapshot.head.commitSequence
    || checkpoint.casHeadCommitSha256 !== snapshot.head.headCommitSha256) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_CHECKPOINT_NOT_EXACT_LOCAL_HEAD");
  }
}

function signedAnchorCheckpointProjection(checkpoint) {
  validateRewardCasExternalCheckpoint(checkpoint);
  return Object.freeze({
    persistenceIdentitySha256: checkpoint.persistenceIdentitySha256,
    checkpointRevision: checkpoint.checkpointRevision.toString(),
    checkpointSha256: checkpoint.checkpointSha256,
    previousCheckpointSha256: checkpoint.previousCheckpointSha256,
    casCommitSequence: checkpoint.casCommitSequence.toString(),
    casHeadCommitSha256: checkpoint.casHeadCommitSha256,
  });
}

function assertAnchorReceiptBinding(receipt, checkpoint, binding) {
  validateRewardRollbackAnchorVerificationReceipt(receipt);
  if (receipt.anchorNamespaceSha256 !== binding.anchorNamespaceSha256
    || receipt.persistenceIdentitySha256 !== binding.productionPersistenceIdentitySha256
    || receipt.providerTrustBindingSha256 !== binding.providerTrustBindingSha256
    || receipt.providerTrustRootSha256 !== binding.providerTrustRootSha256
    || receipt.providerKeyRegistrySnapshotSha256
      !== binding.providerKeyRegistrySnapshotSha256
    || BigInt(receipt.checkpointRevision) !== checkpoint.checkpointRevision
    || receipt.checkpointSha256 !== checkpoint.checkpointSha256
    || BigInt(receipt.casCommitSequence) !== checkpoint.casCommitSequence
    || receipt.casHeadCommitSha256 !== checkpoint.casHeadCommitSha256) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_SIGNED_CHECKPOINT_BINDING_MISMATCH");
  }
}

function assertDurableAnchorResult({ mirror, result, receipt }) {
  if (!result
    || result.receiptRecord?.sourceVerificationReceiptSha256
      !== receipt.verificationReceiptSha256
    || result.receiptRecord.anchorSequence !== receipt.anchorSequence
    || result.receiptRecord.anchorSha256 !== receipt.anchorSha256
    || result.cursor?.receiptRecordSha256 !== result.receiptRecord.receiptRecordSha256
    || result.durableLocalMirrorVerified !== true
    || result.cursorReceiptAtomicityVerified !== true
    || result.localRollbackComparisonVerified !== true
    || result.providerAuthenticationVerified !== false
    || result.externalProviderDurabilityVerified !== false
    || result.externalMonotonicityVerified !== false
    || result.independentRollbackProtectionVerified !== false
    || result.runtimeIntegrationVerified !== false
    || result.activationReady !== false
    || result.mainnetStatus !== REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_DURABLE_ANCHOR_RESULT_MISMATCH");
  }
  const comparison = mirror.compareWithSuppliedAnchorState(receipt.anchorStateAfter);
  const head = mirror.readHead();
  if (comparison.relationship !== REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP.EXACT
    || comparison.suppliedStateAuthenticityVerified !== false
    || head.anchorSequence !== receipt.anchorSequence
    || head.anchorSha256 !== receipt.anchorSha256
    || head.checkpointRevision !== receipt.checkpointRevision
    || head.checkpointSha256 !== receipt.checkpointSha256
    || head.providerEnvelopeSequence !== receipt.providerEnvelopeSequence
    || head.providerEnvelopeSha256 !== receipt.providerEnvelopeSha256
    || head.anchorStateSha256 !== receipt.anchorStateAfter.stateSha256
    || head.providerStateSha256 !== receipt.providerStateAfter.stateSha256) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_DURABLE_ANCHOR_HEAD_MISMATCH");
  }
  return result;
}

function canonicalProjectionInput(projection, binding) {
  const values = exactDataValues(
    projection,
    ["kind", "key", "payload"],
    "INVALID_REWARD_AUTHENTICATED_CONSUMER_PROJECTION",
  );
  if (asProjectionLabel(values.kind, "projection kind") !== binding.projectionKind
    || asProjectionLabel(values.key, "projection key") !== binding.projectionKey) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_PROJECTION_BINDING_MISMATCH");
  }
  const payload = freezeClone(decodeRewardCasTypedValue(
    encodeRewardCasTypedValue(values.payload),
  ));
  return Object.freeze({
    kind: values.kind,
    key: values.key,
    payload,
    payloadSha256: rewardCasStateSha256(payload),
  });
}

function bindCanonicalProjection(projection, permit) {
  const core = {
    schema: REWARD_CONSUMER_PROJECTION_COMMITMENT_SCHEMA,
    consumerId: permit.consumerId,
    targetCommitSequence: permit.targetCommitSequence,
    targetCommitSha256: permit.targetCommitSha256,
    checkpointSha256: permit.checkpointSha256,
    permitSha256: permit.permitSha256,
    projectionKind: projection.kind,
    projectionKey: projection.key,
    payloadSha256: projection.payloadSha256,
  };
  return Object.freeze({
    kind: projection.kind,
    key: projection.key,
    payload: projection.payload,
    payloadSha256: core.payloadSha256,
    projectionCommitmentSha256: rewardCasStateSha256(core),
  });
}

function consumerHistory(cursor, consumerId) {
  const snapshot = cursor.snapshot();
  const cursors = snapshot.cursors
    .filter((record) => record.consumerId === consumerId)
    .sort((left, right) => (left.cursorRevision < right.cursorRevision ? -1 : 1));
  const events = snapshot.projectionEvents
    .filter((record) => record.consumerId === consumerId);
  if (cursors.length !== events.length) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_CURSOR_EVENT_SET_MISMATCH");
  }
  return { cursors, events };
}

function assertProjectionReadback({ cursor, permit, projection, binding }) {
  const { cursors, events } = consumerHistory(cursor, binding.consumerId);
  const current = cursors.at(-1) ?? null;
  const target = permit.targetCommitSequence;
  if (!current) return null;
  if (current.targetCommitSequence < target) return current;
  if (current.targetCommitSequence > target) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_CURSOR_ALREADY_ADVANCED");
  }
  const previous = cursors.at(-2) ?? null;
  validateRewardConsumerCursorRecord(current, previous);
  const event = events.find((candidate) => candidate.targetCommitSequence === target);
  validateRewardConsumerProjectionEventRecord(event, current);
  if (current.targetCommitSha256 !== permit.targetCommitSha256
    || current.checkpointSha256 !== permit.checkpointSha256
    || current.permitSha256 !== permit.permitSha256
    || current.projectionCommitmentSha256 !== projection.projectionCommitmentSha256
    || event.projectionKind !== projection.kind
    || event.projectionKey !== projection.key
    || event.payloadSha256 !== projection.payloadSha256
    || rewardCasStateSha256(event.payload) !== rewardCasStateSha256(projection.payload)) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_COMMITTED_PROJECTION_MISMATCH");
  }
  return Object.freeze({ cursor: current, event });
}

function assertCursorAdvanceAllowed(cursor, consumerId, targetSequence) {
  const { cursors } = consumerHistory(cursor, consumerId);
  const currentSequence = cursors.at(-1)?.targetCommitSequence ?? 0n;
  if (targetSequence !== currentSequence + 1n) {
    if (targetSequence <= currentSequence) {
      throw new Error("REWARD_AUTHENTICATED_CONSUMER_CURSOR_REPLAY");
    }
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_CURSOR_SKIP_FORBIDDEN");
  }
}

function createCompositionReceipt({
  disposition,
  binding,
  permit,
  anchorReceipt,
  anchorResult,
  cursor,
  event,
}) {
  const withoutDigest = {
    schema: REWARD_AUTHENTICATED_CONSUMER_RECEIPT_SCHEMA,
    status: REWARD_AUTHENTICATED_CONSUMER_RUNTIME_STATUS,
    disposition,
    runtimeBindingSha256: binding.runtimeBindingSha256,
    consumerId: binding.consumerId,
    targetCommitSequence: permit.targetCommitSequence,
    targetCommitSha256: permit.targetCommitSha256,
    checkpointSha256: permit.checkpointSha256,
    checkpointCommitSequence: anchorReceipt.casCommitSequence,
    checkpointHeadCommitSha256: anchorReceipt.casHeadCommitSha256,
    anchorSequence: anchorReceipt.anchorSequence,
    anchorSha256: anchorReceipt.anchorSha256,
    providerEnvelopeSequence: anchorReceipt.providerEnvelopeSequence,
    providerEnvelopeSha256: anchorReceipt.providerEnvelopeSha256,
    sourceAnchorVerificationReceiptSha256: anchorReceipt.verificationReceiptSha256,
    durableAnchorReceiptRecordSha256: anchorResult.receiptRecord.receiptRecordSha256,
    durableAnchorCursorSha256: anchorResult.cursor.cursorSha256,
    consumerPermitSha256: permit.permitSha256,
    consumerCursorSha256: cursor.cursorSha256,
    projectionCommitmentSha256: cursor.projectionCommitmentSha256,
    projectionEventRecordSha256: event.eventRecordSha256,
    dailyLawGatePassed: true,
    configuredRuntimeBindingMatched: true,
    cryptographicSignaturePrerequisiteVerified: true,
    exactSignedCheckpointMatched: true,
    durableLocalAnchorMirrorMatched: true,
    durableLocalCursorEventMatched: true,
    lostResponseReadbackReconciled:
      disposition === REWARD_AUTHENTICATED_CONSUMER_DISPOSITION.RECONCILED_AFTER_COMMIT,
    providerAuthenticationVerified: false,
    providerIdentityVerified: false,
    productionKeyOwnershipVerified: false,
    keyRegistryAuthenticityVerified: false,
    externalProviderDurabilityVerified: false,
    externalMonotonicityVerified: false,
    independentRollbackProtectionVerified: false,
    suppliedStateAuthenticityVerified: false,
    materializedProjectionStateVerified: false,
    projectionEffectAtomicityVerified: false,
    runtimeConfinementVerified: false,
    runtimeIntegrationVerified: false,
    externalSideEffectsAuthorized: false,
    independentReviewAccepted: false,
    activationReady: false,
    mainnetStatus: REWARD_AUTHENTICATED_CONSUMER_RUNTIME_MAINNET_STATUS,
  };
  const receipt = Object.freeze({
    ...withoutDigest,
    compositionReceiptSha256: rewardCasStateSha256(withoutDigest),
  });
  EXECUTED_COMPOSITION_RECEIPTS.add(receipt);
  validateRewardAuthenticatedConsumerCompositionReceipt(receipt);
  return receipt;
}

export function validateRewardAuthenticatedConsumerCompositionReceipt(candidate) {
  if (!EXECUTED_COMPOSITION_RECEIPTS.has(candidate)) {
    throw new Error("reward authenticated consumer receipt was not issued by this process");
  }
  const receipt = exactDataValues(
    candidate,
    RECEIPT_KEYS,
    "INVALID_REWARD_AUTHENTICATED_CONSUMER_COMPOSITION_RECEIPT",
  );
  if (receipt.schema !== REWARD_AUTHENTICATED_CONSUMER_RECEIPT_SCHEMA
    || receipt.status !== REWARD_AUTHENTICATED_CONSUMER_RUNTIME_STATUS
    || !Object.values(REWARD_AUTHENTICATED_CONSUMER_DISPOSITION)
      .includes(receipt.disposition)
    || receipt.mainnetStatus !== REWARD_AUTHENTICATED_CONSUMER_RUNTIME_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_AUTHENTICATED_CONSUMER_COMPOSITION_RECEIPT_HEADER");
  }
  asConsumerId(receipt.consumerId);
  const targetSequence = asU64(receipt.targetCommitSequence, "receipt target commit sequence");
  if (targetSequence === 0n) throw new Error("receipt target commit sequence must be positive");
  for (const key of [
    "runtimeBindingSha256",
    "targetCommitSha256",
    "checkpointSha256",
    "checkpointHeadCommitSha256",
    "anchorSha256",
    "providerEnvelopeSha256",
    "sourceAnchorVerificationReceiptSha256",
    "durableAnchorReceiptRecordSha256",
    "durableAnchorCursorSha256",
    "consumerPermitSha256",
    "consumerCursorSha256",
    "projectionCommitmentSha256",
    "projectionEventRecordSha256",
    "compositionReceiptSha256",
  ]) asDigest(receipt[key], `receipt.${key}`);
  const checkpointSequence = asU64Decimal(
    receipt.checkpointCommitSequence,
    "receipt.checkpointCommitSequence",
  );
  const anchorSequence = asU64Decimal(
    receipt.anchorSequence,
    "receipt.anchorSequence",
    { positive: true },
  );
  const providerSequence = asU64Decimal(
    receipt.providerEnvelopeSequence,
    "receipt.providerEnvelopeSequence",
    { positive: true },
  );
  if (targetSequence > checkpointSequence
    || anchorSequence !== checkpointSequence + 1n
    || providerSequence !== anchorSequence) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_COMPOSITION_SEQUENCE_MISMATCH");
  }
  for (const flag of [
    "dailyLawGatePassed",
    "configuredRuntimeBindingMatched",
    "cryptographicSignaturePrerequisiteVerified",
    "exactSignedCheckpointMatched",
    "durableLocalAnchorMirrorMatched",
    "durableLocalCursorEventMatched",
  ]) {
    if (receipt[flag] !== true) throw new Error(`receipt.${flag} must be true`);
  }
  if (receipt.lostResponseReadbackReconciled
    !== (receipt.disposition
      === REWARD_AUTHENTICATED_CONSUMER_DISPOSITION.RECONCILED_AFTER_COMMIT)) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_RECONCILIATION_FLAG_MISMATCH");
  }
  for (const flag of [
    "providerAuthenticationVerified",
    "providerIdentityVerified",
    "productionKeyOwnershipVerified",
    "keyRegistryAuthenticityVerified",
    "externalProviderDurabilityVerified",
    "externalMonotonicityVerified",
    "independentRollbackProtectionVerified",
    "suppliedStateAuthenticityVerified",
    "materializedProjectionStateVerified",
    "projectionEffectAtomicityVerified",
    "runtimeConfinementVerified",
    "runtimeIntegrationVerified",
    "externalSideEffectsAuthorized",
    "independentReviewAccepted",
    "activationReady",
  ]) {
    if (receipt[flag] !== false) throw new Error(`receipt.${flag} must remain false`);
  }
  const expectedSha256 = rewardCasStateSha256(Object.fromEntries(
    RECEIPT_KEYS
      .filter((key) => key !== "compositionReceiptSha256")
      .map((key) => [key, receipt[key]]),
  ));
  if (receipt.compositionReceiptSha256 !== expectedSha256) {
    throw new Error("REWARD_AUTHENTICATED_CONSUMER_COMPOSITION_RECEIPT_DIGEST_MISMATCH");
  }
  return candidate;
}

export function createRewardAuthenticatedConsumerRuntime(options = {}) {
  const values = exactDataValues(
    options,
    ["runtimeBinding", "trustBinding", "rewardStore", "rollbackAnchorMirror", "consumerCursor"],
    "INVALID_REWARD_AUTHENTICATED_CONSUMER_RUNTIME_OPTIONS",
  );
  const binding = validateRewardAuthenticatedConsumerRuntimeBinding(values.runtimeBinding);
  assertTrustBindingMatches(binding, values.trustBinding);
  const rewardStore = requireRewardStore(values.rewardStore, binding);
  const rollbackAnchorMirror = requireAnchorMirror(values.rollbackAnchorMirror, binding);
  const consumerCursor = requireConsumerCursor(values.consumerCursor, binding);

  const runtime = {
    schema: REWARD_AUTHENTICATED_CONSUMER_RUNTIME_SCHEMA,
    status: REWARD_AUTHENTICATED_CONSUMER_RUNTIME_STATUS,
    runtimeBindingSha256: binding.runtimeBindingSha256,
    configuredRuntimeBindingMatched: true,
    providerAuthenticationVerified: false,
    externalMonotonicityVerified: false,
    independentRollbackProtectionVerified: false,
    runtimeConfinementVerified: false,
    runtimeIntegrationVerified: false,
    externalSideEffectsAuthorized: false,
    activationReady: false,
    mainnetStatus: REWARD_AUTHENTICATED_CONSUMER_RUNTIME_MAINNET_STATUS,
    consumeAnchoredLocalProjection(input) {
      const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
      const request = exactDataValues(
        input,
        CONSUME_INPUT_KEYS,
        "INVALID_REWARD_AUTHENTICATED_CONSUMER_RUNTIME_INPUT",
      );
      if (request.scope !== REWARD_CONSUMER_SCOPE.LOCAL_PROJECTION) {
        throw new Error("REWARD_AUTHENTICATED_CONSUMER_EXTERNAL_EFFECTS_HOLD");
      }
      const consumerId = asConsumerId(request.consumerId);
      const targetCommitSequence = asU64(
        request.targetCommitSequence,
        "target commit sequence",
      );
      const targetCommitSha256 = asDigest(request.targetCommitSha256, "target commit digest");
      if (consumerId !== binding.consumerId || targetCommitSequence === 0n) {
        throw new Error("REWARD_AUTHENTICATED_CONSUMER_TARGET_BINDING_MISMATCH");
      }
      const projectionInput = canonicalProjectionInput(request.projection, binding);

      const identity = rewardStore.readPersistenceIdentity();
      validateRewardCasPersistenceIdentity(identity);
      const snapshot = rewardStore.snapshot();
      validateRewardCasSnapshot(snapshot);
      assertCheckpointBinding({
        checkpoint: request.checkpoint,
        identity,
        snapshot,
        binding,
      });
      const anchorCheckpoint = signedAnchorCheckpointProjection(request.checkpoint);

      const anchorReceipt = verifyRewardExternalRollbackAnchor({
        trustBinding: values.trustBinding,
        currentProviderState: request.currentProviderState,
        providerEnvelope: request.providerEnvelope,
        requestBytes: request.requestBytes,
        anchorBytes: request.anchorBytes,
        expectedRequestNonceSha256: request.expectedRequestNonceSha256,
        currentAnchorState: request.currentAnchorState,
        expectedCheckpoint: anchorCheckpoint,
        evaluationUnixSeconds: request.evaluationUnixSeconds,
      });
      assertAnchorReceiptBinding(anchorReceipt, request.checkpoint, binding);
      const anchorResult = assertDurableAnchorResult({
        mirror: rollbackAnchorMirror,
        result: rollbackAnchorMirror.consumeSignedAnchorReceipt({ receipt: anchorReceipt }),
        receipt: anchorReceipt,
      });

      const permit = prepareRewardConsumerPermit({
        dailyLawState,
        store: rewardStore,
        checkpoint: request.checkpoint,
        consumerId,
        scope: request.scope,
        targetCommitSequence,
        targetCommitSha256,
      });
      const projection = bindCanonicalProjection(projectionInput, permit);
      const existing = assertProjectionReadback({
        cursor: consumerCursor,
        permit,
        projection,
        binding,
      });
      let disposition;
      let cursorRecord;
      let projectionEvent;
      if (existing?.cursor) {
        disposition = REWARD_AUTHENTICATED_CONSUMER_DISPOSITION.RECONCILED_AFTER_COMMIT;
        cursorRecord = existing.cursor;
        projectionEvent = existing.event;
      } else {
        assertCursorAdvanceAllowed(consumerCursor, consumerId, targetCommitSequence);
        cursorRecord = consumerCursor.consumePermit({
          dailyLawState,
          permit,
          consumerId,
          targetCommitSequence,
          targetCommitSha256,
          projection: {
            kind: projection.kind,
            key: projection.key,
            payload: projection.payload,
          },
        });
        const readback = assertProjectionReadback({
          cursor: consumerCursor,
          permit,
          projection,
          binding,
        });
        if (!readback?.cursor || readback.cursor.cursorSha256 !== cursorRecord.cursorSha256) {
          throw new Error("REWARD_AUTHENTICATED_CONSUMER_CURSOR_COMMIT_READBACK_MISMATCH");
        }
        disposition = REWARD_AUTHENTICATED_CONSUMER_DISPOSITION.COMMITTED;
        cursorRecord = readback.cursor;
        projectionEvent = readback.event;
      }

      return createCompositionReceipt({
        disposition,
        binding,
        permit,
        anchorReceipt,
        anchorResult,
        cursor: cursorRecord,
        event: projectionEvent,
      });
    },
  };
  return Object.freeze(runtime);
}

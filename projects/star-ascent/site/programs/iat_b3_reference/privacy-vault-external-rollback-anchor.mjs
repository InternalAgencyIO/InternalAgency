import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";

import {
  PROVIDER_AUTHENTICATION_MAINNET_STATUS,
  PROVIDER_KINDS,
  validateProviderEnvelopeState,
  validateProviderEnvelopeVerificationReceipt,
  validateProviderSignedEnvelope,
  validateProviderTrustBinding,
  verifyProviderSignedEnvelope,
} from "./provider-authenticated-envelope.mjs";
import {
  PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS,
  PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_MANIFEST_SHA256,
  PRIVACY_VAULT_RECOVERY_SQLITE_SNAPSHOT_SCHEMA,
  PRIVACY_VAULT_RECOVERY_SQLITE_STATUS,
  assertPrivacyVaultRecoverySqliteAdapter,
} from "./privacy-vault-recovery-sqlite.mjs";

export const PRIVACY_VAULT_ROLLBACK_ANCHOR_STATE_SCHEMA =
  "iat-b3-privacy-vault-rollback-anchor-state/v1";
export const PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_SCHEMA =
  "iat-b3-privacy-vault-rollback-anchor-request/v1";
export const PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_SCHEMA =
  "iat-b3-privacy-vault-rollback-anchor-statement/v1";
export const PRIVACY_VAULT_ROLLBACK_ANCHOR_VERIFICATION_SCHEMA =
  "iat-b3-privacy-vault-rollback-anchor-verification/v1";
export const PRIVACY_VAULT_ROLLBACK_ANCHOR_STATUS =
  "HOST_ONLY_NON_ACTIVATING_SIGNED_PRIVACY_ROLLBACK_ANCHOR_PREREQUISITE";
export const PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS = "HOLD";
export const PRIVACY_VAULT_ROLLBACK_ANCHOR_PROVIDER_OPERATION =
  "CHECKPOINT_READ_CURRENT";

const ZERO_SHA256 = "0".repeat(64);
const U64_MAX = (1n << 64n) - 1n;
const HEX_32 = /^[0-9a-f]{64}$/u;
const U64_DECIMAL = /^(?:0|[1-9][0-9]{0,19})$/u;
const MAX_ANCHOR_AGE_SECONDS = 604_800n;
const MAX_FUTURE_SKEW_SECONDS = 3_600n;
const MAX_CANONICAL_BYTES = 65_536;
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const EXECUTED_ANCHOR_RECEIPTS = new WeakSet();

const GENESIS_INPUT_KEYS = Object.freeze([
  "trustBinding",
  "sqliteAdapter",
  "anchorNamespaceSha256",
  "maximumAnchorAgeSeconds",
  "maximumFutureSkewSeconds",
]);

const SNAPSHOT_BINDING_KEYS = Object.freeze([
  "sqliteSchemaManifestSha256",
  "sqliteSnapshotSha256",
  "vaultBindingSha256",
  "recoveryKeyCommitmentSha256",
  "maximumBundleAgeSeconds",
  "maximumBundleFutureSkewSeconds",
  "recoveryEpoch",
  "recoveryStateSha256",
  "recoveryBundleSha256",
  "recoveryCursorRevision",
  "recoveryCursorSha256",
]);

const NEGATIVE_FACT_KEYS = Object.freeze([
  "providerAuthenticationVerified",
  "providerIdentityVerified",
  "productionKeyOwnershipVerified",
  "keyRegistryAuthenticityVerified",
  "durableAnchorStateVerified",
  "externalDurabilityVerified",
  "trustedExternalMonotonicStorageVerified",
  "externalRollbackProtectionVerified",
  "runtimeIntegrationVerified",
  "privacyLegalReviewAccepted",
  "devnetLifecycleVerified",
  "activationReady",
  "mainnetExecutionAuthorized",
]);

const STATE_KEYS = Object.freeze([
  "schema",
  "status",
  "anchorNamespaceSha256",
  "providerTrustBindingSha256",
  "providerTrustRootSha256",
  "providerKeyRegistrySnapshotSha256",
  "sqliteSchemaManifestSha256",
  "vaultBindingSha256",
  "recoveryKeyCommitmentSha256",
  "maximumBundleAgeSeconds",
  "maximumBundleFutureSkewSeconds",
  "maximumAnchorAgeSeconds",
  "maximumFutureSkewSeconds",
  "lastAnchorSequence",
  "lastAnchorSha256",
  "lastSqliteSnapshotSha256",
  "lastRecoveryEpoch",
  "lastRecoveryStateSha256",
  "lastRecoveryBundleSha256",
  "lastRecoveryCursorRevision",
  "lastRecoveryCursorSha256",
  ...NEGATIVE_FACT_KEYS,
  "mainnetStatus",
  "stateSha256",
]);

const REQUEST_INPUT_KEYS = Object.freeze([
  "trustBinding",
  "sqliteAdapter",
  "currentAnchorState",
  "requestNonceSha256",
  "requestedAtUnixSeconds",
]);

const REQUEST_KEYS = Object.freeze([
  "schema",
  "status",
  "anchorNamespaceSha256",
  "providerTrustBindingSha256",
  "providerTrustRootSha256",
  "providerKeyRegistrySnapshotSha256",
  "anchorStateBeforeSha256",
  "minimumAnchorSequence",
  "expectedPreviousAnchorSha256",
  ...SNAPSHOT_BINDING_KEYS,
  "requestNonceSha256",
  "requestedAtUnixSeconds",
  "runtimeIntegrationVerified",
  "activationReady",
  "mainnetExecutionAuthorized",
  "mainnetStatus",
  "requestSha256",
]);

const STATEMENT_INPUT_KEYS = Object.freeze([
  "trustBinding",
  "currentAnchorState",
  "request",
  "observedAtUnixSeconds",
  "expiresAtUnixSeconds",
]);

const STATEMENT_KEYS = Object.freeze([
  "schema",
  "status",
  "anchorNamespaceSha256",
  "providerTrustBindingSha256",
  "providerTrustRootSha256",
  "providerKeyRegistrySnapshotSha256",
  "anchorStateBeforeSha256",
  "requestSha256",
  "anchorSequence",
  "previousAnchorSha256",
  ...SNAPSHOT_BINDING_KEYS,
  "observedAtUnixSeconds",
  "expiresAtUnixSeconds",
  ...NEGATIVE_FACT_KEYS,
  "mainnetStatus",
  "anchorSha256",
]);

const VERIFY_INPUT_KEYS = Object.freeze([
  "trustBinding",
  "currentProviderState",
  "providerEnvelope",
  "requestBytes",
  "anchorBytes",
  "expectedRequestNonceSha256",
  "currentAnchorState",
  "sqliteAdapter",
  "evaluationUnixSeconds",
]);

const VERIFICATION_KEYS = Object.freeze([
  "schema",
  "status",
  "anchorNamespaceSha256",
  "providerTrustBindingSha256",
  "providerTrustRootSha256",
  "providerKeyRegistrySnapshotSha256",
  "providerEnvelopeSha256",
  "providerEnvelopeSequence",
  "providerStateBeforeSha256",
  "providerStateAfter",
  "requestSha256",
  "anchorSequence",
  "anchorSha256",
  "anchorStateBeforeSha256",
  "anchorStateAfter",
  ...SNAPSHOT_BINDING_KEYS,
  "canonicalRequestVerified",
  "canonicalAnchorVerified",
  "cryptographicSignatureVerified",
  "configuredPublicKeyMatched",
  "requestNonceVerified",
  "suppliedProviderReplayStateAdvanced",
  "contiguousAnchorSequenceVerified",
  "predecessorAnchorVerified",
  "brandedLocalSnapshotReadVerified",
  "localSnapshotExactBindingVerified",
  "suppliedAnchorStateAncestryVerified",
  ...NEGATIVE_FACT_KEYS,
  "independentReviewAccepted",
  "mainnetStatus",
  "verificationReceiptSha256",
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
      || Object.hasOwn(descriptor, "set")) {
      throw new TypeError(errorCode);
    }
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

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Canonical(domain, value) {
  return sha256Bytes(Buffer.from(JSON.stringify({ domain, value }), "utf8"));
}

function asCanonicalDigest(value, label, { allowZero = false } = {}) {
  if (typeof value !== "string" || !HEX_32.test(value)) {
    throw new TypeError(`${label} must be canonical lowercase 32-byte hexadecimal`);
  }
  if (!allowZero && value === ZERO_SHA256) {
    throw new Error(`${label} must not be zero`);
  }
  if (value !== ZERO_SHA256
    && /^(?:([0-9a-f])\1{63}|([0-9a-f]{2})\2{31})$/u.test(value)) {
    throw new Error(`${label} must not be obvious placeholder material`);
  }
  return value;
}

function asU64Decimal(value, label, {
  positive = false,
  maximum = U64_MAX,
} = {}) {
  if (typeof value !== "string" || !U64_DECIMAL.test(value)) {
    throw new TypeError(`${label} must be a canonical unsigned decimal string`);
  }
  const parsed = BigInt(value);
  if (parsed > maximum || (positive && parsed === 0n)) {
    throw new RangeError(`${label} is outside its accepted range`);
  }
  return parsed;
}

function asEvaluationUnixSeconds(value) {
  if (typeof value !== "bigint" || value < 0n || value > U64_MAX) {
    throw new TypeError("evaluationUnixSeconds must be an unsigned 64-bit bigint");
  }
  return value;
}

function asExactBuffer(value, label) {
  if (!Buffer.isBuffer(value)
    || value.length === 0
    || value.length > MAX_CANONICAL_BYTES) {
    throw new TypeError(`${label} must be a nonempty bounded Buffer`);
  }
  return Buffer.from(value);
}

function negativeFacts() {
  return Object.fromEntries(NEGATIVE_FACT_KEYS.map((key) => [key, false]));
}

function requireExternalCheckpointTrust(trustBinding) {
  const trust = validateProviderTrustBinding(trustBinding);
  if (trust.environment !== "PRODUCTION"
    || trust.providerKind !== PROVIDER_KINDS.EXTERNAL_CHECKPOINT) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUIRES_PRODUCTION_CHECKPOINT_TRUST");
  }
  return trust;
}

function readBrandedSnapshot(sqliteAdapter) {
  const adapter = assertPrivacyVaultRecoverySqliteAdapter(sqliteAdapter);
  const snapshot = adapter.snapshot();
  if (snapshot.schema !== PRIVACY_VAULT_RECOVERY_SQLITE_SNAPSHOT_SCHEMA
    || snapshot.status !== PRIVACY_VAULT_RECOVERY_SQLITE_STATUS
    || snapshot.schemaManifestSha256 !== PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_MANIFEST_SHA256
    || snapshot.localBundleCursorAtomicityVerified !== true
    || snapshot.processPrivateReceiptRequired !== true
    || snapshot.durableLocalSqliteReopenVerified !== true
    || snapshot.externalWriterConfinementVerified !== false
    || snapshot.suppliedStateAuthenticityVerified !== false
    || snapshot.externalRollbackProtectionVerified !== false
    || snapshot.securePlatformKeystoreVerified !== false
    || snapshot.authenticatedChainObservationVerified !== false
    || snapshot.onchainRuntimeIntegrationVerified !== false
    || snapshot.privacyLegalReviewAccepted !== false
    || snapshot.devnetLifecycleVerified !== false
    || snapshot.activationReady !== false
    || snapshot.mainnetStatus !== PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_INVALID_BRANDED_SQLITE_SNAPSHOT");
  }
  const epoch = asU64Decimal(snapshot.currentState.lastEpoch, "snapshot recovery epoch");
  if (!Array.isArray(snapshot.bundles)
    || !Array.isArray(snapshot.cursors)
    || BigInt(snapshot.bundles.length) !== epoch
    || BigInt(snapshot.cursors.length) !== epoch) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_SQLITE_HISTORY_LENGTH_MISMATCH");
  }
  const lastBundle = snapshot.bundles.at(-1) ?? null;
  const lastCursor = snapshot.cursors.at(-1) ?? null;
  if (epoch === 0n) {
    if (lastBundle !== null
      || lastCursor !== null
      || snapshot.currentState.lastBundleSha256 !== ZERO_SHA256) {
      throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_INVALID_SQLITE_GENESIS");
    }
  } else if (lastBundle === null
    || lastCursor === null
    || lastBundle.epoch !== epoch.toString()
    || lastCursor.epoch !== epoch.toString()
    || lastCursor.cursorRevision !== epoch.toString()
    || lastBundle.bundleSha256 !== snapshot.currentState.lastBundleSha256
    || lastBundle.stateAfterSha256 !== snapshot.currentState.stateSha256
    || lastCursor.bundleSha256 !== lastBundle.bundleSha256
    || lastCursor.stateAfterSha256 !== lastBundle.stateAfterSha256
    || lastCursor.bundleRecordSha256 !== lastBundle.recordSha256) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_SQLITE_HEAD_MISMATCH");
  }
  return Object.freeze({
    snapshot,
    projection: Object.freeze({
      sqliteSchemaManifestSha256: snapshot.schemaManifestSha256,
      sqliteSnapshotSha256: snapshot.snapshotSha256,
      vaultBindingSha256: snapshot.currentState.vaultBindingSha256,
      recoveryKeyCommitmentSha256: snapshot.currentState.recoveryKeyCommitmentSha256,
      maximumBundleAgeSeconds: snapshot.currentState.maximumBundleAgeSeconds,
      maximumBundleFutureSkewSeconds: snapshot.currentState.maximumFutureSkewSeconds,
      recoveryEpoch: snapshot.currentState.lastEpoch,
      recoveryStateSha256: snapshot.currentState.stateSha256,
      recoveryBundleSha256: snapshot.currentState.lastBundleSha256,
      recoveryCursorRevision: lastCursor?.cursorRevision ?? "0",
      recoveryCursorSha256: lastCursor?.cursorSha256 ?? ZERO_SHA256,
    }),
  });
}

function assertProjectionBinding(left, right, errorCode) {
  for (const key of SNAPSHOT_BINDING_KEYS) {
    if (left[key] !== right[key]) throw new Error(errorCode);
  }
}

function validateProjectionFields(values) {
  asCanonicalDigest(values.sqliteSchemaManifestSha256, "SQLite schema manifest");
  asCanonicalDigest(values.sqliteSnapshotSha256, "SQLite snapshot");
  asCanonicalDigest(values.vaultBindingSha256, "Privacy Vault binding");
  asCanonicalDigest(values.recoveryKeyCommitmentSha256, "recovery-key commitment");
  asU64Decimal(values.maximumBundleAgeSeconds, "maximum bundle age", { positive: true });
  asU64Decimal(
    values.maximumBundleFutureSkewSeconds,
    "maximum bundle future skew",
  );
  const epoch = asU64Decimal(values.recoveryEpoch, "recovery epoch");
  asCanonicalDigest(values.recoveryStateSha256, "recovery state");
  const bundle = asCanonicalDigest(values.recoveryBundleSha256, "recovery bundle", {
    allowZero: true,
  });
  const cursorRevision = asU64Decimal(values.recoveryCursorRevision, "recovery cursor revision");
  const cursor = asCanonicalDigest(values.recoveryCursorSha256, "recovery cursor", {
    allowZero: true,
  });
  if (cursorRevision !== epoch
    || (epoch === 0n) !== (bundle === ZERO_SHA256)
    || (epoch === 0n) !== (cursor === ZERO_SHA256)) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_INVALID_PROJECTION_HEAD");
  }
}

function stateCore({
  trustBinding,
  anchorNamespaceSha256,
  projection,
  maximumAnchorAgeSeconds,
  maximumFutureSkewSeconds,
  lastAnchorSequence,
  lastAnchorSha256,
}) {
  const trust = requireExternalCheckpointTrust(trustBinding);
  const anchorNamespace = asCanonicalDigest(
    anchorNamespaceSha256,
    "privacy rollback-anchor namespace",
  );
  validateProjectionFields(projection);
  if (projection.sqliteSchemaManifestSha256
    !== PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_MANIFEST_SHA256) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_SQLITE_SCHEMA_MISMATCH");
  }
  const maximumAge = asU64Decimal(
    maximumAnchorAgeSeconds,
    "maximum anchor age",
    { positive: true, maximum: MAX_ANCHOR_AGE_SECONDS },
  );
  const maximumSkew = asU64Decimal(
    maximumFutureSkewSeconds,
    "maximum anchor future skew",
    { maximum: MAX_FUTURE_SKEW_SECONDS },
  );
  const sequence = asU64Decimal(lastAnchorSequence, "last anchor sequence");
  const anchor = asCanonicalDigest(lastAnchorSha256, "last anchor digest", {
    allowZero: true,
  });
  if ((sequence === 0n) !== (anchor === ZERO_SHA256)) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_STATE_SEQUENCE_HEAD_MISMATCH");
  }
  if (sequence === 0n && projection.recoveryEpoch !== "0") {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_STATE_GENESIS_PROJECTION_MISMATCH");
  }
  return {
    schema: PRIVACY_VAULT_ROLLBACK_ANCHOR_STATE_SCHEMA,
    status: PRIVACY_VAULT_ROLLBACK_ANCHOR_STATUS,
    anchorNamespaceSha256: anchorNamespace,
    providerTrustBindingSha256: trust.trustBindingSha256,
    providerTrustRootSha256: trust.trustRootSha256,
    providerKeyRegistrySnapshotSha256: trust.keyRegistrySnapshotSha256,
    sqliteSchemaManifestSha256: projection.sqliteSchemaManifestSha256,
    vaultBindingSha256: projection.vaultBindingSha256,
    recoveryKeyCommitmentSha256: projection.recoveryKeyCommitmentSha256,
    maximumBundleAgeSeconds: projection.maximumBundleAgeSeconds,
    maximumBundleFutureSkewSeconds: projection.maximumBundleFutureSkewSeconds,
    maximumAnchorAgeSeconds: maximumAge.toString(),
    maximumFutureSkewSeconds: maximumSkew.toString(),
    lastAnchorSequence: sequence.toString(),
    lastAnchorSha256: anchor,
    lastSqliteSnapshotSha256: projection.sqliteSnapshotSha256,
    lastRecoveryEpoch: projection.recoveryEpoch,
    lastRecoveryStateSha256: projection.recoveryStateSha256,
    lastRecoveryBundleSha256: projection.recoveryBundleSha256,
    lastRecoveryCursorRevision: projection.recoveryCursorRevision,
    lastRecoveryCursorSha256: projection.recoveryCursorSha256,
    ...negativeFacts(),
    mainnetStatus: PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS,
  };
}

function createState(input) {
  const core = stateCore(input);
  return Object.freeze({
    ...core,
    stateSha256: sha256Canonical(PRIVACY_VAULT_ROLLBACK_ANCHOR_STATE_SCHEMA, core),
  });
}

export function createPrivacyVaultRollbackAnchorGenesisState(candidate) {
  const values = exactDataValues(
    candidate,
    GENESIS_INPUT_KEYS,
    "INVALID_PRIVACY_VAULT_ROLLBACK_ANCHOR_GENESIS_INPUT",
  );
  const { projection } = readBrandedSnapshot(values.sqliteAdapter);
  if (projection.recoveryEpoch !== "0"
    || projection.recoveryBundleSha256 !== ZERO_SHA256
    || projection.recoveryCursorRevision !== "0"
    || projection.recoveryCursorSha256 !== ZERO_SHA256) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_GENESIS_REQUIRES_EMPTY_SQLITE");
  }
  return createState({
    trustBinding: values.trustBinding,
    anchorNamespaceSha256: values.anchorNamespaceSha256,
    projection,
    maximumAnchorAgeSeconds: values.maximumAnchorAgeSeconds,
    maximumFutureSkewSeconds: values.maximumFutureSkewSeconds,
    lastAnchorSequence: "0",
    lastAnchorSha256: ZERO_SHA256,
  });
}

export function validatePrivacyVaultRollbackAnchorState(state, trustBinding) {
  const trust = requireExternalCheckpointTrust(trustBinding);
  const values = exactDataValues(
    state,
    STATE_KEYS,
    "INVALID_PRIVACY_VAULT_ROLLBACK_ANCHOR_STATE",
  );
  if (values.schema !== PRIVACY_VAULT_ROLLBACK_ANCHOR_STATE_SCHEMA
    || values.status !== PRIVACY_VAULT_ROLLBACK_ANCHOR_STATUS
    || values.providerTrustBindingSha256 !== trust.trustBindingSha256
    || values.providerTrustRootSha256 !== trust.trustRootSha256
    || values.providerKeyRegistrySnapshotSha256 !== trust.keyRegistrySnapshotSha256
    || values.mainnetStatus !== PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_STATE_BINDING_MISMATCH");
  }
  for (const key of NEGATIVE_FACT_KEYS) {
    if (values[key] !== false) {
      throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_STATE_TRUTH_BOUNDARY");
    }
  }
  const projection = {
    sqliteSchemaManifestSha256: values.sqliteSchemaManifestSha256,
    sqliteSnapshotSha256: values.lastSqliteSnapshotSha256,
    vaultBindingSha256: values.vaultBindingSha256,
    recoveryKeyCommitmentSha256: values.recoveryKeyCommitmentSha256,
    maximumBundleAgeSeconds: values.maximumBundleAgeSeconds,
    maximumBundleFutureSkewSeconds: values.maximumBundleFutureSkewSeconds,
    recoveryEpoch: values.lastRecoveryEpoch,
    recoveryStateSha256: values.lastRecoveryStateSha256,
    recoveryBundleSha256: values.lastRecoveryBundleSha256,
    recoveryCursorRevision: values.lastRecoveryCursorRevision,
    recoveryCursorSha256: values.lastRecoveryCursorSha256,
  };
  const canonical = createState({
    trustBinding,
    anchorNamespaceSha256: values.anchorNamespaceSha256,
    projection,
    maximumAnchorAgeSeconds: values.maximumAnchorAgeSeconds,
    maximumFutureSkewSeconds: values.maximumFutureSkewSeconds,
    lastAnchorSequence: values.lastAnchorSequence,
    lastAnchorSha256: values.lastAnchorSha256,
  });
  if (JSON.stringify(state) !== JSON.stringify(canonical)) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_STATE_DIGEST_OR_CANONICALIZATION_MISMATCH");
  }
  return state;
}

function historicalSnapshotSha256(snapshot, anchoredEpoch) {
  const count = Number(anchoredEpoch);
  const currentState = count === 0
    ? snapshot.genesisState
    : JSON.parse(snapshot.bundles[count - 1].stateAfterJson);
  const { snapshotSha256: ignored, ...fullCore } = snapshot;
  void ignored;
  const historicalCore = {
    ...fullCore,
    currentState,
    bundles: snapshot.bundles.slice(0, count),
    cursors: snapshot.cursors.slice(0, count),
  };
  return sha256Canonical(PRIVACY_VAULT_RECOVERY_SQLITE_SNAPSHOT_SCHEMA, historicalCore);
}

function assertStateBindingToProjection(state, projection, snapshot) {
  for (const [stateKey, projectionKey] of [
    ["sqliteSchemaManifestSha256", "sqliteSchemaManifestSha256"],
    ["vaultBindingSha256", "vaultBindingSha256"],
    ["recoveryKeyCommitmentSha256", "recoveryKeyCommitmentSha256"],
    ["maximumBundleAgeSeconds", "maximumBundleAgeSeconds"],
    ["maximumBundleFutureSkewSeconds", "maximumBundleFutureSkewSeconds"],
  ]) {
    if (state[stateKey] !== projection[projectionKey]) {
      throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_LOCAL_BINDING_MISMATCH_HOLD");
    }
  }
  const anchoredEpoch = asU64Decimal(state.lastRecoveryEpoch, "anchored recovery epoch");
  const localEpoch = asU64Decimal(projection.recoveryEpoch, "local recovery epoch");
  if (localEpoch < anchoredEpoch) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_LOCAL_ROLLBACK_HOLD");
  }
  if (anchoredEpoch === 0n) {
    if (state.lastRecoveryBundleSha256 !== ZERO_SHA256
      || state.lastRecoveryCursorRevision !== "0"
      || state.lastRecoveryCursorSha256 !== ZERO_SHA256
      || state.lastRecoveryStateSha256 !== snapshot.genesisState.stateSha256) {
      throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_INVALID_ANCHORED_GENESIS");
    }
  } else {
    const index = Number(anchoredEpoch - 1n);
    const anchoredBundle = snapshot.bundles[index];
    const anchoredCursor = snapshot.cursors[index];
    if (!anchoredBundle
      || !anchoredCursor
      || anchoredBundle.bundleSha256 !== state.lastRecoveryBundleSha256
      || anchoredBundle.stateAfterSha256 !== state.lastRecoveryStateSha256
      || anchoredCursor.cursorRevision !== state.lastRecoveryCursorRevision
      || anchoredCursor.cursorSha256 !== state.lastRecoveryCursorSha256) {
      throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_LOCAL_FORK_HOLD");
    }
  }
  if (state.lastSqliteSnapshotSha256
    !== historicalSnapshotSha256(snapshot, anchoredEpoch)) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_HISTORICAL_SNAPSHOT_MISMATCH_HOLD");
  }
  if (localEpoch === anchoredEpoch
    && (projection.sqliteSnapshotSha256 !== state.lastSqliteSnapshotSha256
      || projection.recoveryStateSha256 !== state.lastRecoveryStateSha256
      || projection.recoveryBundleSha256 !== state.lastRecoveryBundleSha256
      || projection.recoveryCursorRevision !== state.lastRecoveryCursorRevision
      || projection.recoveryCursorSha256 !== state.lastRecoveryCursorSha256)) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_LOCAL_SAME_EPOCH_FORK_HOLD");
  }
}

function requestCore({ trustBinding, currentAnchorState, projection, requestNonceSha256,
  requestedAtUnixSeconds }) {
  const trust = requireExternalCheckpointTrust(trustBinding);
  const state = validatePrivacyVaultRollbackAnchorState(currentAnchorState, trust);
  validateProjectionFields(projection);
  const sequence = asU64Decimal(state.lastAnchorSequence, "last anchor sequence");
  if (sequence === U64_MAX) throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_SEQUENCE_EXHAUSTED_HOLD");
  return {
    schema: PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_SCHEMA,
    status: PRIVACY_VAULT_ROLLBACK_ANCHOR_STATUS,
    anchorNamespaceSha256: state.anchorNamespaceSha256,
    providerTrustBindingSha256: trust.trustBindingSha256,
    providerTrustRootSha256: trust.trustRootSha256,
    providerKeyRegistrySnapshotSha256: trust.keyRegistrySnapshotSha256,
    anchorStateBeforeSha256: state.stateSha256,
    minimumAnchorSequence: (sequence + 1n).toString(),
    expectedPreviousAnchorSha256: state.lastAnchorSha256,
    ...projection,
    requestNonceSha256: asCanonicalDigest(requestNonceSha256, "anchor request nonce"),
    requestedAtUnixSeconds: asU64Decimal(
      requestedAtUnixSeconds,
      "anchor request time",
    ).toString(),
    runtimeIntegrationVerified: false,
    activationReady: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS,
  };
}

function createRequest(input) {
  const core = requestCore(input);
  return Object.freeze({
    ...core,
    requestSha256: sha256Canonical(PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_SCHEMA, core),
  });
}

export function createPrivacyVaultRollbackAnchorRequest(candidate) {
  const values = exactDataValues(
    candidate,
    REQUEST_INPUT_KEYS,
    "INVALID_PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_INPUT",
  );
  const state = validatePrivacyVaultRollbackAnchorState(
    values.currentAnchorState,
    values.trustBinding,
  );
  const { projection, snapshot } = readBrandedSnapshot(values.sqliteAdapter);
  assertStateBindingToProjection(state, projection, snapshot);
  return createRequest({
    trustBinding: values.trustBinding,
    currentAnchorState: state,
    projection,
    requestNonceSha256: values.requestNonceSha256,
    requestedAtUnixSeconds: values.requestedAtUnixSeconds,
  });
}

export function validatePrivacyVaultRollbackAnchorRequest(request, trustBinding) {
  const trust = requireExternalCheckpointTrust(trustBinding);
  const values = exactDataValues(
    request,
    REQUEST_KEYS,
    "INVALID_PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST",
  );
  if (values.schema !== PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_SCHEMA
    || values.status !== PRIVACY_VAULT_ROLLBACK_ANCHOR_STATUS
    || values.providerTrustBindingSha256 !== trust.trustBindingSha256
    || values.providerTrustRootSha256 !== trust.trustRootSha256
    || values.providerKeyRegistrySnapshotSha256 !== trust.keyRegistrySnapshotSha256
    || values.runtimeIntegrationVerified !== false
    || values.activationReady !== false
    || values.mainnetExecutionAuthorized !== false
    || values.mainnetStatus !== PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_BINDING_MISMATCH");
  }
  asCanonicalDigest(values.anchorNamespaceSha256, "request anchor namespace");
  asCanonicalDigest(values.anchorStateBeforeSha256, "request anchor state-before");
  const sequence = asU64Decimal(values.minimumAnchorSequence, "request minimum anchor sequence", {
    positive: true,
  });
  const previous = asCanonicalDigest(values.expectedPreviousAnchorSha256, "request previous anchor", {
    allowZero: true,
  });
  if ((sequence === 1n) !== (previous === ZERO_SHA256)) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_SEQUENCE_PREDECESSOR_MISMATCH");
  }
  validateProjectionFields(values);
  const { requestSha256, ...core } = values;
  if (asCanonicalDigest(requestSha256, "anchor request digest")
    !== sha256Canonical(PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_SCHEMA, core)) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_DIGEST_MISMATCH");
  }
  if (JSON.stringify(request) !== JSON.stringify(values)) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_CANONICALIZATION_MISMATCH");
  }
  return request;
}

function statementCore({ trustBinding, currentAnchorState, request, observedAtUnixSeconds,
  expiresAtUnixSeconds }) {
  const trust = requireExternalCheckpointTrust(trustBinding);
  const state = validatePrivacyVaultRollbackAnchorState(currentAnchorState, trust);
  const validatedRequest = validatePrivacyVaultRollbackAnchorRequest(request, trust);
  const sequence = asU64Decimal(state.lastAnchorSequence, "last anchor sequence");
  const observed = asU64Decimal(observedAtUnixSeconds, "anchor observation time");
  const expires = asU64Decimal(expiresAtUnixSeconds, "anchor expiry time");
  const requested = asU64Decimal(validatedRequest.requestedAtUnixSeconds, "anchor request time");
  const maximumAge = BigInt(state.maximumAnchorAgeSeconds);
  if (expires <= observed
    || observed < requested
    || observed - requested > maximumAge
    || expires - observed > maximumAge
    || expires - requested > maximumAge) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_INVALID_TIME_WINDOW");
  }
  if (validatedRequest.anchorNamespaceSha256 !== state.anchorNamespaceSha256
    || validatedRequest.anchorStateBeforeSha256 !== state.stateSha256
    || validatedRequest.minimumAnchorSequence !== (sequence + 1n).toString()
    || validatedRequest.expectedPreviousAnchorSha256 !== state.lastAnchorSha256) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_STATE_MISMATCH");
  }
  return {
    schema: PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_SCHEMA,
    status: PRIVACY_VAULT_ROLLBACK_ANCHOR_STATUS,
    anchorNamespaceSha256: state.anchorNamespaceSha256,
    providerTrustBindingSha256: trust.trustBindingSha256,
    providerTrustRootSha256: trust.trustRootSha256,
    providerKeyRegistrySnapshotSha256: trust.keyRegistrySnapshotSha256,
    anchorStateBeforeSha256: state.stateSha256,
    requestSha256: validatedRequest.requestSha256,
    anchorSequence: (sequence + 1n).toString(),
    previousAnchorSha256: state.lastAnchorSha256,
    ...Object.fromEntries(SNAPSHOT_BINDING_KEYS.map((key) => [key, validatedRequest[key]])),
    observedAtUnixSeconds: observed.toString(),
    expiresAtUnixSeconds: expires.toString(),
    ...negativeFacts(),
    mainnetStatus: PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS,
  };
}

export function createPrivacyVaultRollbackAnchorStatement(candidate) {
  const values = exactDataValues(
    candidate,
    STATEMENT_INPUT_KEYS,
    "INVALID_PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_INPUT",
  );
  const core = statementCore(values);
  return Object.freeze({
    ...core,
    anchorSha256: sha256Canonical(PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_SCHEMA, core),
  });
}

export function validatePrivacyVaultRollbackAnchorStatement(statement, trustBinding) {
  const trust = requireExternalCheckpointTrust(trustBinding);
  const values = exactDataValues(
    statement,
    STATEMENT_KEYS,
    "INVALID_PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT",
  );
  if (values.schema !== PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_SCHEMA
    || values.status !== PRIVACY_VAULT_ROLLBACK_ANCHOR_STATUS
    || values.providerTrustBindingSha256 !== trust.trustBindingSha256
    || values.providerTrustRootSha256 !== trust.trustRootSha256
    || values.providerKeyRegistrySnapshotSha256 !== trust.keyRegistrySnapshotSha256
    || values.mainnetStatus !== PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_BINDING_MISMATCH");
  }
  for (const key of NEGATIVE_FACT_KEYS) {
    if (values[key] !== false) {
      throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_TRUTH_BOUNDARY");
    }
  }
  asCanonicalDigest(values.anchorNamespaceSha256, "statement anchor namespace");
  asCanonicalDigest(values.anchorStateBeforeSha256, "statement anchor state-before");
  asCanonicalDigest(values.requestSha256, "statement request digest");
  const sequence = asU64Decimal(values.anchorSequence, "statement anchor sequence", {
    positive: true,
  });
  const previous = asCanonicalDigest(values.previousAnchorSha256, "statement previous anchor", {
    allowZero: true,
  });
  if ((sequence === 1n) !== (previous === ZERO_SHA256)) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_SEQUENCE_PREDECESSOR_MISMATCH");
  }
  validateProjectionFields(values);
  const observed = asU64Decimal(values.observedAtUnixSeconds, "statement observed-at time");
  const expires = asU64Decimal(values.expiresAtUnixSeconds, "statement expiry time");
  if (expires <= observed) throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_EMPTY_TIME_WINDOW");
  const { anchorSha256, ...core } = values;
  if (asCanonicalDigest(anchorSha256, "statement anchor digest")
    !== sha256Canonical(PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_SCHEMA, core)) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_DIGEST_MISMATCH");
  }
  if (JSON.stringify(statement) !== JSON.stringify(values)) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_CANONICALIZATION_MISMATCH");
  }
  return statement;
}

function canonicalBytes(value, validator, trustBinding) {
  const validated = validator(value, trustBinding);
  return Buffer.from(JSON.stringify(validated), "utf8");
}

function parseCanonicalBytes(bytes, validator, trustBinding, label) {
  const exact = asExactBuffer(bytes, label);
  let parsed;
  try {
    parsed = JSON.parse(UTF8_DECODER.decode(exact));
  } catch {
    throw new Error(`${label} are not canonical UTF-8 JSON`);
  }
  const validated = validator(parsed, trustBinding);
  if (!exact.equals(Buffer.from(JSON.stringify(validated), "utf8"))) {
    throw new Error(`${label} do not match the single canonical encoding`);
  }
  return Object.freeze(validated);
}

export function privacyVaultRollbackAnchorRequestBytes(request, trustBinding) {
  return canonicalBytes(request, validatePrivacyVaultRollbackAnchorRequest, trustBinding);
}

export function parsePrivacyVaultRollbackAnchorRequestBytes(bytes, trustBinding) {
  return parseCanonicalBytes(
    bytes,
    validatePrivacyVaultRollbackAnchorRequest,
    trustBinding,
    "privacy rollback-anchor request bytes",
  );
}

export function privacyVaultRollbackAnchorStatementBytes(statement, trustBinding) {
  return canonicalBytes(statement, validatePrivacyVaultRollbackAnchorStatement, trustBinding);
}

export function parsePrivacyVaultRollbackAnchorStatementBytes(bytes, trustBinding) {
  return parseCanonicalBytes(
    bytes,
    validatePrivacyVaultRollbackAnchorStatement,
    trustBinding,
    "privacy rollback-anchor statement bytes",
  );
}

function stateAfterFromStatement(trustBinding, state, statement) {
  const projection = Object.fromEntries(
    SNAPSHOT_BINDING_KEYS.map((key) => [key, statement[key]]),
  );
  return createState({
    trustBinding,
    anchorNamespaceSha256: state.anchorNamespaceSha256,
    projection,
    maximumAnchorAgeSeconds: state.maximumAnchorAgeSeconds,
    maximumFutureSkewSeconds: state.maximumFutureSkewSeconds,
    lastAnchorSequence: statement.anchorSequence,
    lastAnchorSha256: statement.anchorSha256,
  });
}

export function verifyPrivacyVaultExternalRollbackAnchor(candidate) {
  const values = exactDataValues(
    candidate,
    VERIFY_INPUT_KEYS,
    "INVALID_PRIVACY_VAULT_ROLLBACK_ANCHOR_VERIFY_INPUT",
  );
  const trust = requireExternalCheckpointTrust(values.trustBinding);
  const providerState = validateProviderEnvelopeState(values.currentProviderState, trust);
  const envelope = validateProviderSignedEnvelope(values.providerEnvelope);
  const state = validatePrivacyVaultRollbackAnchorState(values.currentAnchorState, trust);
  const adapter = assertPrivacyVaultRecoverySqliteAdapter(values.sqliteAdapter);
  const expectedNonce = asCanonicalDigest(
    values.expectedRequestNonceSha256,
    "expected privacy rollback-anchor request nonce",
  );
  const evaluation = asEvaluationUnixSeconds(values.evaluationUnixSeconds);
  const requestBytes = asExactBuffer(values.requestBytes, "privacy rollback-anchor request bytes");
  const anchorBytes = asExactBuffer(values.anchorBytes, "privacy rollback-anchor statement bytes");
  const request = parsePrivacyVaultRollbackAnchorRequestBytes(requestBytes, trust);
  const statement = parsePrivacyVaultRollbackAnchorStatementBytes(anchorBytes, trust);
  const { projection, snapshot } = readBrandedSnapshot(adapter);
  assertStateBindingToProjection(state, projection, snapshot);
  assertProjectionBinding(
    request,
    projection,
    "PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_LOCAL_SNAPSHOT_MISMATCH_HOLD",
  );
  assertProjectionBinding(
    statement,
    projection,
    "PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_LOCAL_SNAPSHOT_MISMATCH_HOLD",
  );
  if (request.anchorNamespaceSha256 !== state.anchorNamespaceSha256
    || request.anchorStateBeforeSha256 !== state.stateSha256
    || request.minimumAnchorSequence
      !== (BigInt(state.lastAnchorSequence) + 1n).toString()
    || request.expectedPreviousAnchorSha256 !== state.lastAnchorSha256
    || request.requestNonceSha256 !== expectedNonce
    || statement.anchorNamespaceSha256 !== state.anchorNamespaceSha256
    || statement.anchorStateBeforeSha256 !== state.stateSha256
    || statement.requestSha256 !== request.requestSha256
    || statement.anchorSequence !== request.minimumAnchorSequence
    || statement.previousAnchorSha256 !== request.expectedPreviousAnchorSha256) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_TRANSCRIPT_BINDING_MISMATCH_HOLD");
  }
  const requested = BigInt(request.requestedAtUnixSeconds);
  const observed = BigInt(statement.observedAtUnixSeconds);
  const expires = BigInt(statement.expiresAtUnixSeconds);
  const envelopeIssued = BigInt(envelope.issuedAtUnixSeconds);
  const maximumAge = BigInt(state.maximumAnchorAgeSeconds);
  const maximumSkew = BigInt(state.maximumFutureSkewSeconds);
  if (observed < requested
    || observed - requested > maximumAge
    || expires <= observed
    || expires - observed > maximumAge
    || expires - requested > maximumAge
    || requested > evaluation + maximumSkew
    || observed > evaluation + maximumSkew
    || evaluation >= expires
    || envelopeIssued < observed
    || envelopeIssued >= expires) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_TIME_WINDOW_HOLD");
  }
  if (envelope.operation !== PRIVACY_VAULT_ROLLBACK_ANCHOR_PROVIDER_OPERATION) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_PROVIDER_OPERATION_MISMATCH");
  }
  const providerReceipt = verifyProviderSignedEnvelope({
    trustBinding: trust,
    currentState: providerState,
    envelope,
    requestBytes,
    responseBytes: anchorBytes,
    expectedRequestNonceSha256: expectedNonce,
    evaluationUnixSeconds: evaluation,
  });
  validateProviderEnvelopeVerificationReceipt(providerReceipt);
  const anchorStateAfter = stateAfterFromStatement(trust, state, statement);
  const core = {
    schema: PRIVACY_VAULT_ROLLBACK_ANCHOR_VERIFICATION_SCHEMA,
    status: PRIVACY_VAULT_ROLLBACK_ANCHOR_STATUS,
    anchorNamespaceSha256: state.anchorNamespaceSha256,
    providerTrustBindingSha256: trust.trustBindingSha256,
    providerTrustRootSha256: trust.trustRootSha256,
    providerKeyRegistrySnapshotSha256: trust.keyRegistrySnapshotSha256,
    providerEnvelopeSha256: envelope.envelopeSha256,
    providerEnvelopeSequence: envelope.sequence,
    providerStateBeforeSha256: providerState.stateSha256,
    providerStateAfter: providerReceipt.stateAfter,
    requestSha256: request.requestSha256,
    anchorSequence: statement.anchorSequence,
    anchorSha256: statement.anchorSha256,
    anchorStateBeforeSha256: state.stateSha256,
    anchorStateAfter,
    ...projection,
    canonicalRequestVerified: true,
    canonicalAnchorVerified: true,
    cryptographicSignatureVerified: true,
    configuredPublicKeyMatched: true,
    requestNonceVerified: true,
    suppliedProviderReplayStateAdvanced: true,
    contiguousAnchorSequenceVerified: true,
    predecessorAnchorVerified: true,
    brandedLocalSnapshotReadVerified: true,
    localSnapshotExactBindingVerified: true,
    suppliedAnchorStateAncestryVerified: true,
    ...negativeFacts(),
    independentReviewAccepted: false,
    mainnetStatus: PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS,
  };
  const receipt = Object.freeze({
    ...core,
    verificationReceiptSha256: sha256Canonical(
      PRIVACY_VAULT_ROLLBACK_ANCHOR_VERIFICATION_SCHEMA,
      core,
    ),
  });
  EXECUTED_ANCHOR_RECEIPTS.add(receipt);
  return receipt;
}

export function validatePrivacyVaultRollbackAnchorVerificationReceipt(receipt) {
  if (!EXECUTED_ANCHOR_RECEIPTS.has(receipt)) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_RECEIPT_NOT_EXECUTED_IN_THIS_PROCESS");
  }
  const values = exactDataValues(
    receipt,
    VERIFICATION_KEYS,
    "INVALID_PRIVACY_VAULT_ROLLBACK_ANCHOR_VERIFICATION_RECEIPT",
  );
  if (values.schema !== PRIVACY_VAULT_ROLLBACK_ANCHOR_VERIFICATION_SCHEMA
    || values.status !== PRIVACY_VAULT_ROLLBACK_ANCHOR_STATUS
    || values.canonicalRequestVerified !== true
    || values.canonicalAnchorVerified !== true
    || values.cryptographicSignatureVerified !== true
    || values.configuredPublicKeyMatched !== true
    || values.requestNonceVerified !== true
    || values.suppliedProviderReplayStateAdvanced !== true
    || values.contiguousAnchorSequenceVerified !== true
    || values.predecessorAnchorVerified !== true
    || values.brandedLocalSnapshotReadVerified !== true
    || values.localSnapshotExactBindingVerified !== true
    || values.suppliedAnchorStateAncestryVerified !== true
    || values.independentReviewAccepted !== false
    || values.mainnetStatus !== PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_VERIFICATION_FACTS_INVALID");
  }
  for (const key of NEGATIVE_FACT_KEYS) {
    if (values[key] !== false) {
      throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_VERIFICATION_TRUTH_BOUNDARY");
    }
  }
  validateProjectionFields(values);
  const { verificationReceiptSha256, ...core } = values;
  if (asCanonicalDigest(verificationReceiptSha256, "privacy anchor verification receipt")
    !== sha256Canonical(PRIVACY_VAULT_ROLLBACK_ANCHOR_VERIFICATION_SCHEMA, core)) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_VERIFICATION_DIGEST_MISMATCH");
  }
  if (values.providerStateAfter.mainnetStatus !== PROVIDER_AUTHENTICATION_MAINNET_STATUS
    || values.anchorStateAfter.mainnetStatus !== PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS) {
    throw new Error("PRIVACY_VAULT_ROLLBACK_ANCHOR_VERIFICATION_STATE_HOLD_MISMATCH");
  }
  return receipt;
}

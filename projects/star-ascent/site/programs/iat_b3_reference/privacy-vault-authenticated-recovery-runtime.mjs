import { createHash } from "node:crypto";
import { types } from "node:util";

import {
  PROVIDER_AUTHENTICATION_MAINNET_STATUS,
  validateProviderEnvelopeState,
  validateProviderTrustBinding,
} from "./provider-authenticated-envelope.mjs";
import {
  PRIVACY_VAULT_RECOVERY_MAINNET_STATUS,
  validatePrivacyVaultRecoveryBundle,
  verifyPrivacyVaultRecoveryBundle,
} from "./privacy-vault-recovery-lifecycle.mjs";
import {
  PRIVACY_VAULT_RECOVERY_SQLITE_DISPOSITION,
  PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS,
  PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_MANIFEST_SHA256,
  PRIVACY_VAULT_RECOVERY_SQLITE_STATUS,
  assertPrivacyVaultRecoverySqliteAdapter,
} from "./privacy-vault-recovery-sqlite.mjs";
import {
  PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS,
  PRIVACY_VAULT_ROLLBACK_ANCHOR_STATUS,
  createPrivacyVaultRollbackAnchorRequest,
  privacyVaultRollbackAnchorRequestBytes,
  validatePrivacyVaultRollbackAnchorState,
  validatePrivacyVaultRollbackAnchorVerificationReceipt,
  verifyPrivacyVaultExternalRollbackAnchor,
} from "./privacy-vault-external-rollback-anchor.mjs";

export const PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_SCHEMA =
  "iat-b3-privacy-vault-authenticated-recovery-runtime/v1";
export const PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_SNAPSHOT_SCHEMA =
  "iat-b3-privacy-vault-authenticated-recovery-runtime-snapshot/v1";
export const PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_RECEIPT_SCHEMA =
  "iat-b3-privacy-vault-authenticated-recovery-local-receipt/v1";
export const PRIVACY_VAULT_AUTHENTICATED_RECOVERY_PREPARED_REQUEST_SCHEMA =
  "iat-b3-privacy-vault-authenticated-recovery-prepared-request/v1";
export const PRIVACY_VAULT_AUTHENTICATED_RECOVERY_ANCHOR_RECEIPT_SCHEMA =
  "iat-b3-privacy-vault-authenticated-recovery-anchor-receipt/v1";
export const PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_STATUS =
  "HOST_ONLY_NON_ACTIVATING_RECOVERY_AND_SIGNED_ANCHOR_COMPOSITION";
export const PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_MAINNET_STATUS = "HOLD";

export const PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_DISPOSITION = Object.freeze({
  COMMITTED: "COMMITTED",
  RECONCILED_DURABLE_READBACK: "RECONCILED_DURABLE_READBACK",
});

const HEX_32 = /^[0-9a-f]{64}$/u;
const U64_DECIMAL = /^(?:0|[1-9][0-9]{0,19})$/u;
const U64_MAX = (1n << 64n) - 1n;
const RUNTIMES = new WeakSet();
const LOCAL_RECEIPTS = new WeakSet();
const ANCHOR_RECEIPTS = new WeakSet();
const PREPARED_REQUESTS = new WeakMap();
const CONSTRUCTOR_BINDING_NONCE_SHA256 = createHash("sha256")
  .update("IAT_B3_PRIVACY_VAULT_RUNTIME_LOCAL_BINDING_CHECK_V1\0", "utf8")
  .digest("hex");

const NEGATIVE_FACT_KEYS = Object.freeze([
  "providerAuthenticationVerified",
  "providerIdentityVerified",
  "productionKeyOwnershipVerified",
  "keyRegistryAuthenticityVerified",
  "providerOperationalTruthVerified",
  "externalDurabilityVerified",
  "externalRollbackProtectionVerified",
  "crossSystemAtomicityVerified",
  "runtimeConfinementVerified",
  "onchainRuntimeIntegrationVerified",
  "nativePrivacyVaultPlannerIntegrated",
  "authenticatedSolanaFinalityVerified",
  "securePlatformKeystoreVerified",
  "privacyLegalReviewAccepted",
  "devnetLifecycleVerified",
  "activationReady",
  "mainnetExecutionAuthorized",
]);

const CREATE_KEYS = Object.freeze([
  "trustBinding",
  "sqliteAdapter",
  "currentProviderState",
  "currentAnchorState",
]);

const COMMIT_KEYS = Object.freeze([
  "bundle",
  "recoveryKeyBytes",
  "expectedKeyMaterialCommitmentSha256",
  "evaluationUnixSeconds",
]);

const RECONCILE_KEYS = Object.freeze(["bundle"]);
const PREPARE_KEYS = Object.freeze(["requestNonceSha256", "requestedAtUnixSeconds"]);
const CONSUME_KEYS = Object.freeze([
  "preparedRequest",
  "providerEnvelope",
  "anchorBytes",
  "evaluationUnixSeconds",
]);

const LOCAL_RECEIPT_KEYS = Object.freeze([
  "schema",
  "status",
  "disposition",
  "bundleSha256",
  "recoveryEpoch",
  "recoveryStateSha256",
  "sqliteSnapshotSha256",
  "recoveryCursorSha256",
  "recoveryVerificationExecutedThisProcess",
  "storedProcessPrivateVerificationReceiptDigestBound",
  "localBundleCursorAtomicityVerified",
  "durableLocalSqliteReadbackVerified",
  "hostOrchestrationExecuted",
  ...NEGATIVE_FACT_KEYS,
  "mainnetStatus",
  "receiptSha256",
]);

const ANCHOR_RECEIPT_KEYS = Object.freeze([
  "schema",
  "status",
  "requestSha256",
  "providerEnvelopeSha256",
  "providerEnvelopeSequence",
  "providerStateAfterSha256",
  "anchorSha256",
  "anchorSequence",
  "anchorStateAfterSha256",
  "sqliteSnapshotSha256",
  "cryptographicEnvelopeVerificationExecuted",
  "configuredPublicKeyMatched",
  "inProcessReplayStatesAdvanced",
  "brandedLocalSnapshotReadVerified",
  "hostOrchestrationExecuted",
  ...NEGATIVE_FACT_KEYS,
  "mainnetStatus",
  "receiptSha256",
]);

function isPlainRecord(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && !types.isProxy(value)
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

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function canonicalClone(value) {
  return deepFreeze(JSON.parse(JSON.stringify(value)));
}

function sha256Canonical(domain, value) {
  return createHash("sha256")
    .update(Buffer.from(JSON.stringify({ domain, value }), "utf8"))
    .digest("hex");
}

function canonicalDigest(value, label) {
  if (typeof value !== "string" || !HEX_32.test(value)) {
    throw new TypeError(`${label} must be canonical lowercase 32-byte hexadecimal`);
  }
  return value;
}

function canonicalU64(value, label, { positive = false } = {}) {
  if (typeof value !== "string" || !U64_DECIMAL.test(value)) {
    throw new TypeError(`${label} must be a canonical unsigned decimal string`);
  }
  const parsed = BigInt(value);
  if (parsed > U64_MAX || (positive && parsed === 0n)) {
    throw new RangeError(`${label} is outside its accepted range`);
  }
  return parsed;
}

function negativeFacts() {
  return Object.fromEntries(NEGATIVE_FACT_KEYS.map((key) => [key, false]));
}

function assertNegativeFacts(values, errorCode) {
  for (const key of NEGATIVE_FACT_KEYS) {
    if (values[key] !== false) throw new Error(errorCode);
  }
}

function validateSharedHoldStatus() {
  if (PRIVACY_VAULT_RECOVERY_MAINNET_STATUS !== "HOLD"
    || PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS !== "HOLD"
    || PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS !== "HOLD"
    || PROVIDER_AUTHENTICATION_MAINNET_STATUS !== "HOLD") {
    throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_DEPENDENCY_NOT_HELD");
  }
}

function runtimeSnapshotCore({ trustBinding, providerState, anchorState, sqliteSnapshot }) {
  const lastCursor = sqliteSnapshot.cursors.at(-1) ?? null;
  return {
    schema: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_SNAPSHOT_SCHEMA,
    status: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_STATUS,
    providerTrustBindingSha256: trustBinding.trustBindingSha256,
    providerTrustRootSha256: trustBinding.trustRootSha256,
    providerKeyRegistrySnapshotSha256: trustBinding.keyRegistrySnapshotSha256,
    providerState,
    anchorState,
    sqliteSchemaManifestSha256: sqliteSnapshot.schemaManifestSha256,
    sqliteSnapshotSha256: sqliteSnapshot.snapshotSha256,
    recoveryEpoch: sqliteSnapshot.currentState.lastEpoch,
    recoveryStateSha256: sqliteSnapshot.currentState.stateSha256,
    recoveryBundleSha256: sqliteSnapshot.currentState.lastBundleSha256,
    recoveryCursorSha256: lastCursor?.cursorSha256 ?? "0".repeat(64),
    processPrivateRuntimeBrandRequired: true,
    brandedLocalSqliteBound: true,
    localAnchorAncestryChecked: true,
    ...negativeFacts(),
    mainnetStatus: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_MAINNET_STATUS,
  };
}

function localReceiptCore({ disposition, bundle, sqliteSnapshot,
  recoveryVerificationExecutedThisProcess }) {
  const lastBundle = sqliteSnapshot.bundles.at(-1);
  const lastCursor = sqliteSnapshot.cursors.at(-1);
  if (!lastBundle
    || !lastCursor
    || lastBundle.bundleSha256 !== bundle.bundleSha256
    || lastBundle.bundleJson !== JSON.stringify(bundle)
    || lastBundle.stateAfterSha256 !== sqliteSnapshot.currentState.stateSha256
    || lastCursor.bundleSha256 !== bundle.bundleSha256
    || lastCursor.stateAfterSha256 !== sqliteSnapshot.currentState.stateSha256) {
    throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_READBACK_MISMATCH_HOLD");
  }
  return {
    schema: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_RECEIPT_SCHEMA,
    status: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_STATUS,
    disposition,
    bundleSha256: bundle.bundleSha256,
    recoveryEpoch: sqliteSnapshot.currentState.lastEpoch,
    recoveryStateSha256: sqliteSnapshot.currentState.stateSha256,
    sqliteSnapshotSha256: sqliteSnapshot.snapshotSha256,
    recoveryCursorSha256: lastCursor.cursorSha256,
    recoveryVerificationExecutedThisProcess,
    storedProcessPrivateVerificationReceiptDigestBound: true,
    localBundleCursorAtomicityVerified: true,
    durableLocalSqliteReadbackVerified: true,
    hostOrchestrationExecuted: true,
    ...negativeFacts(),
    mainnetStatus: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_MAINNET_STATUS,
  };
}

function issueLocalReceipt(input) {
  const core = localReceiptCore(input);
  const receipt = deepFreeze({
    ...core,
    receiptSha256: sha256Canonical(
      PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_RECEIPT_SCHEMA,
      core,
    ),
  });
  LOCAL_RECEIPTS.add(receipt);
  return receipt;
}

function issueAnchorReceipt(anchorReceipt) {
  validatePrivacyVaultRollbackAnchorVerificationReceipt(anchorReceipt);
  const core = {
    schema: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_ANCHOR_RECEIPT_SCHEMA,
    status: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_STATUS,
    requestSha256: anchorReceipt.requestSha256,
    providerEnvelopeSha256: anchorReceipt.providerEnvelopeSha256,
    providerEnvelopeSequence: anchorReceipt.providerEnvelopeSequence,
    providerStateAfterSha256: anchorReceipt.providerStateAfter.stateSha256,
    anchorSha256: anchorReceipt.anchorSha256,
    anchorSequence: anchorReceipt.anchorSequence,
    anchorStateAfterSha256: anchorReceipt.anchorStateAfter.stateSha256,
    sqliteSnapshotSha256: anchorReceipt.sqliteSnapshotSha256,
    cryptographicEnvelopeVerificationExecuted: true,
    configuredPublicKeyMatched: true,
    inProcessReplayStatesAdvanced: true,
    brandedLocalSnapshotReadVerified: true,
    hostOrchestrationExecuted: true,
    ...negativeFacts(),
    mainnetStatus: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_MAINNET_STATUS,
  };
  const receipt = deepFreeze({
    ...core,
    receiptSha256: sha256Canonical(
      PRIVACY_VAULT_AUTHENTICATED_RECOVERY_ANCHOR_RECEIPT_SCHEMA,
      core,
    ),
  });
  ANCHOR_RECEIPTS.add(receipt);
  return receipt;
}

export function validatePrivacyVaultAuthenticatedRecoveryLocalReceipt(receipt) {
  if (!LOCAL_RECEIPTS.has(receipt)) {
    throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_RECEIPT_NOT_EXECUTED");
  }
  const values = exactDataValues(
    receipt,
    LOCAL_RECEIPT_KEYS,
    "INVALID_PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_RECEIPT",
  );
  const committed = values.disposition
    === PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_DISPOSITION.COMMITTED;
  if (values.schema !== PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_RECEIPT_SCHEMA
    || values.status !== PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_STATUS
    || (!committed && values.disposition
      !== PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_DISPOSITION
        .RECONCILED_DURABLE_READBACK)
    || values.recoveryVerificationExecutedThisProcess !== committed
    || values.storedProcessPrivateVerificationReceiptDigestBound !== true
    || values.localBundleCursorAtomicityVerified !== true
    || values.durableLocalSqliteReadbackVerified !== true
    || values.hostOrchestrationExecuted !== true
    || values.mainnetStatus !== PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_MAINNET_STATUS) {
    throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_RECEIPT_FACTS_INVALID");
  }
  for (const key of [
    "bundleSha256",
    "recoveryStateSha256",
    "sqliteSnapshotSha256",
    "recoveryCursorSha256",
  ]) canonicalDigest(values[key], `local receipt ${key}`);
  canonicalU64(values.recoveryEpoch, "local receipt recovery epoch", { positive: true });
  assertNegativeFacts(values, "PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_RECEIPT_OVERCLAIM");
  const { receiptSha256, ...core } = values;
  if (canonicalDigest(receiptSha256, "local receipt digest")
    !== sha256Canonical(PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_RECEIPT_SCHEMA, core)) {
    throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_RECEIPT_DIGEST_MISMATCH");
  }
  return receipt;
}

export function validatePrivacyVaultAuthenticatedRecoveryAnchorReceipt(receipt) {
  if (!ANCHOR_RECEIPTS.has(receipt)) {
    throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_ANCHOR_RECEIPT_NOT_EXECUTED");
  }
  const values = exactDataValues(
    receipt,
    ANCHOR_RECEIPT_KEYS,
    "INVALID_PRIVACY_VAULT_AUTHENTICATED_RECOVERY_ANCHOR_RECEIPT",
  );
  if (values.schema !== PRIVACY_VAULT_AUTHENTICATED_RECOVERY_ANCHOR_RECEIPT_SCHEMA
    || values.status !== PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_STATUS
    || values.cryptographicEnvelopeVerificationExecuted !== true
    || values.configuredPublicKeyMatched !== true
    || values.inProcessReplayStatesAdvanced !== true
    || values.brandedLocalSnapshotReadVerified !== true
    || values.hostOrchestrationExecuted !== true
    || values.mainnetStatus !== PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_MAINNET_STATUS) {
    throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_ANCHOR_RECEIPT_FACTS_INVALID");
  }
  for (const key of [
    "requestSha256",
    "providerEnvelopeSha256",
    "providerStateAfterSha256",
    "anchorSha256",
    "anchorStateAfterSha256",
    "sqliteSnapshotSha256",
  ]) canonicalDigest(values[key], `anchor receipt ${key}`);
  canonicalU64(values.providerEnvelopeSequence, "anchor receipt provider sequence", {
    positive: true,
  });
  canonicalU64(values.anchorSequence, "anchor receipt anchor sequence", { positive: true });
  assertNegativeFacts(values, "PRIVACY_VAULT_AUTHENTICATED_RECOVERY_ANCHOR_RECEIPT_OVERCLAIM");
  const { receiptSha256, ...core } = values;
  if (canonicalDigest(receiptSha256, "anchor receipt digest")
    !== sha256Canonical(PRIVACY_VAULT_AUTHENTICATED_RECOVERY_ANCHOR_RECEIPT_SCHEMA, core)) {
    throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_ANCHOR_RECEIPT_DIGEST_MISMATCH");
  }
  return receipt;
}

export function assertPrivacyVaultAuthenticatedRecoveryRuntime(value) {
  if (!RUNTIMES.has(value)) {
    throw new TypeError("privacy vault authenticated recovery runtime is not process-branded");
  }
  return value;
}

export function createPrivacyVaultAuthenticatedRecoveryRuntime(candidate) {
  validateSharedHoldStatus();
  const input = exactDataValues(
    candidate,
    CREATE_KEYS,
    "INVALID_PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_INPUT",
  );
  const trustBinding = canonicalClone(validateProviderTrustBinding(input.trustBinding));
  const sqliteAdapter = assertPrivacyVaultRecoverySqliteAdapter(input.sqliteAdapter);
  let providerState = canonicalClone(validateProviderEnvelopeState(
    input.currentProviderState,
    trustBinding,
  ));
  let anchorState = canonicalClone(validatePrivacyVaultRollbackAnchorState(
    input.currentAnchorState,
    trustBinding,
  ));
  const runtimeToken = Object.freeze({});

  function readBoundLocalState(boundAnchorState = anchorState) {
    if (boundAnchorState.status !== PRIVACY_VAULT_ROLLBACK_ANCHOR_STATUS) {
      throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_ANCHOR_STATUS_MISMATCH");
    }
    const bindingRequest = createPrivacyVaultRollbackAnchorRequest({
      trustBinding,
      sqliteAdapter,
      currentAnchorState: boundAnchorState,
      requestNonceSha256: CONSTRUCTOR_BINDING_NONCE_SHA256,
      requestedAtUnixSeconds: "0",
    });
    const sqliteSnapshot = sqliteAdapter.snapshot();
    if (sqliteSnapshot.status !== PRIVACY_VAULT_RECOVERY_SQLITE_STATUS
      || sqliteSnapshot.schemaManifestSha256
        !== PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_MANIFEST_SHA256
      || bindingRequest.sqliteSnapshotSha256 !== sqliteSnapshot.snapshotSha256
      || bindingRequest.recoveryStateSha256 !== sqliteSnapshot.currentState.stateSha256) {
      throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_SNAPSHOT_RACE_HOLD");
    }
    return sqliteSnapshot;
  }

  function snapshot() {
    const sqliteSnapshot = readBoundLocalState();
    const core = runtimeSnapshotCore({
      trustBinding,
      providerState,
      anchorState,
      sqliteSnapshot,
    });
    return deepFreeze({
      ...core,
      snapshotSha256: sha256Canonical(
        PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_SNAPSHOT_SCHEMA,
        core,
      ),
    });
  }

  function commitRecoveryBundle(commitCandidate) {
    const values = exactDataValues(
      commitCandidate,
      COMMIT_KEYS,
      "INVALID_PRIVACY_VAULT_AUTHENTICATED_RECOVERY_COMMIT_INPUT",
    );
    const before = readBoundLocalState();
    const verificationReceipt = verifyPrivacyVaultRecoveryBundle({
      currentState: before.currentState,
      bundle: values.bundle,
      recoveryKeyBytes: values.recoveryKeyBytes,
      expectedKeyMaterialCommitmentSha256: values.expectedKeyMaterialCommitmentSha256,
      evaluationUnixSeconds: values.evaluationUnixSeconds,
    });
    const commitResult = sqliteAdapter.commitVerifiedBundle({
      bundle: values.bundle,
      verificationReceipt,
      testFault: null,
    });
    if (commitResult.disposition !== PRIVACY_VAULT_RECOVERY_SQLITE_DISPOSITION.COMMITTED) {
      throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_UNEXPECTED_REPLAY_DISPOSITION");
    }
    const after = readBoundLocalState();
    if (commitResult.snapshotSha256 !== after.snapshotSha256
      || commitResult.currentState.stateSha256 !== after.currentState.stateSha256) {
      throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_COMMIT_READBACK_MISMATCH_HOLD");
    }
    return issueLocalReceipt({
      disposition: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_DISPOSITION.COMMITTED,
      bundle: validatePrivacyVaultRecoveryBundle(values.bundle),
      sqliteSnapshot: after,
      recoveryVerificationExecutedThisProcess: true,
    });
  }

  function reconcileCommittedRecoveryBundle(reconcileCandidate) {
    const values = exactDataValues(
      reconcileCandidate,
      RECONCILE_KEYS,
      "INVALID_PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RECONCILE_INPUT",
    );
    const bundle = validatePrivacyVaultRecoveryBundle(values.bundle);
    const sqliteSnapshot = readBoundLocalState();
    if (bundle.epoch !== sqliteSnapshot.currentState.lastEpoch
      || bundle.bundleSha256 !== sqliteSnapshot.currentState.lastBundleSha256) {
      throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RECONCILE_NOT_EXACT_HEAD_HOLD");
    }
    return issueLocalReceipt({
      disposition:
        PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_DISPOSITION.RECONCILED_DURABLE_READBACK,
      bundle,
      sqliteSnapshot,
      recoveryVerificationExecutedThisProcess: false,
    });
  }

  function prepareAnchorRequest(prepareCandidate) {
    const values = exactDataValues(
      prepareCandidate,
      PREPARE_KEYS,
      "INVALID_PRIVACY_VAULT_AUTHENTICATED_RECOVERY_PREPARE_INPUT",
    );
    const request = createPrivacyVaultRollbackAnchorRequest({
      trustBinding,
      sqliteAdapter,
      currentAnchorState: anchorState,
      requestNonceSha256: values.requestNonceSha256,
      requestedAtUnixSeconds: values.requestedAtUnixSeconds,
    });
    const requestBytes = privacyVaultRollbackAnchorRequestBytes(request, trustBinding);
    const sqliteSnapshot = sqliteAdapter.snapshot();
    if (request.sqliteSnapshotSha256 !== sqliteSnapshot.snapshotSha256) {
      throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_PREPARE_SNAPSHOT_RACE_HOLD");
    }
    const core = {
      schema: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_PREPARED_REQUEST_SCHEMA,
      status: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_STATUS,
      request: canonicalClone(request),
      requestBytesBase64url: requestBytes.toString("base64url"),
      requestSha256: request.requestSha256,
      sqliteSnapshotSha256: request.sqliteSnapshotSha256,
      hostRequestPreparationExecuted: true,
      ...negativeFacts(),
      mainnetStatus: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_MAINNET_STATUS,
    };
    const prepared = deepFreeze({
      ...core,
      preparedRequestSha256: sha256Canonical(
        PRIVACY_VAULT_AUTHENTICATED_RECOVERY_PREPARED_REQUEST_SCHEMA,
        core,
      ),
    });
    PREPARED_REQUESTS.set(prepared, {
      runtimeToken,
      requestBytes: Buffer.from(requestBytes),
    });
    return prepared;
  }

  function consumeSignedAnchor(consumeCandidate) {
    const values = exactDataValues(
      consumeCandidate,
      CONSUME_KEYS,
      "INVALID_PRIVACY_VAULT_AUTHENTICATED_RECOVERY_CONSUME_INPUT",
    );
    const preparedRecord = PREPARED_REQUESTS.get(values.preparedRequest);
    if (!preparedRecord || preparedRecord.runtimeToken !== runtimeToken) {
      throw new Error("PRIVACY_VAULT_AUTHENTICATED_RECOVERY_PREPARED_REQUEST_NOT_BRANDED");
    }
    const anchorReceipt = verifyPrivacyVaultExternalRollbackAnchor({
      trustBinding,
      currentProviderState: providerState,
      providerEnvelope: values.providerEnvelope,
      requestBytes: Buffer.from(preparedRecord.requestBytes),
      anchorBytes: values.anchorBytes,
      expectedRequestNonceSha256: values.preparedRequest.request.requestNonceSha256,
      currentAnchorState: anchorState,
      sqliteAdapter,
      evaluationUnixSeconds: values.evaluationUnixSeconds,
    });
    validatePrivacyVaultRollbackAnchorVerificationReceipt(anchorReceipt);
    const nextProviderState = canonicalClone(validateProviderEnvelopeState(
      anchorReceipt.providerStateAfter,
      trustBinding,
    ));
    const nextAnchorState = canonicalClone(validatePrivacyVaultRollbackAnchorState(
      anchorReceipt.anchorStateAfter,
      trustBinding,
    ));
    readBoundLocalState(nextAnchorState);
    const runtimeAnchorReceipt = issueAnchorReceipt(anchorReceipt);
    providerState = nextProviderState;
    anchorState = nextAnchorState;
    return runtimeAnchorReceipt;
  }

  readBoundLocalState();
  const runtime = Object.freeze({
    schema: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_SCHEMA,
    status: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_STATUS,
    processPrivateRuntimeBrandRequired: true,
    brandedLocalSqliteRequired: true,
    ...negativeFacts(),
    mainnetStatus: PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_MAINNET_STATUS,
    snapshot,
    commitRecoveryBundle,
    reconcileCommittedRecoveryBundle,
    prepareAnchorRequest,
    consumeSignedAnchor,
  });
  RUNTIMES.add(runtime);
  assertPrivacyVaultAuthenticatedRecoveryRuntime(runtime);
  return runtime;
}

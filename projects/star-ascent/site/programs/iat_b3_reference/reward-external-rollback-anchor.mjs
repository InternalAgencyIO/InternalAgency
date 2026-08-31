import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";

import {
  PROVIDER_AUTHENTICATION_MAINNET_STATUS,
  PROVIDER_KINDS,
  validateProviderEnvelopeState,
  validateProviderEnvelopeVerificationReceipt,
  validateProviderTrustBinding,
  verifyProviderSignedEnvelope,
} from "./provider-authenticated-envelope.mjs";

export const REWARD_ROLLBACK_ANCHOR_STATE_SCHEMA =
  "iat-b3-reward-rollback-anchor-state/v1";
export const REWARD_ROLLBACK_ANCHOR_REQUEST_SCHEMA =
  "iat-b3-reward-rollback-anchor-request/v1";
export const REWARD_ROLLBACK_ANCHOR_STATEMENT_SCHEMA =
  "iat-b3-reward-rollback-anchor-statement/v1";
export const REWARD_ROLLBACK_ANCHOR_VERIFICATION_SCHEMA =
  "iat-b3-reward-rollback-anchor-verification/v1";
export const REWARD_ROLLBACK_ANCHOR_STATUS =
  "HOST_ONLY_NON_ACTIVATING_SIGNED_ROLLBACK_ANCHOR_PREREQUISITE";
export const REWARD_ROLLBACK_ANCHOR_MAINNET_STATUS = "HOLD";
export const REWARD_ROLLBACK_ANCHOR_PROVIDER_OPERATION =
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
  "anchorNamespaceSha256",
  "persistenceIdentitySha256",
  "maximumAnchorAgeSeconds",
  "maximumFutureSkewSeconds",
]);

const STATE_KEYS = Object.freeze([
  "schema",
  "status",
  "anchorNamespaceSha256",
  "persistenceIdentitySha256",
  "providerTrustBindingSha256",
  "providerTrustRootSha256",
  "providerKeyRegistrySnapshotSha256",
  "maximumAnchorAgeSeconds",
  "maximumFutureSkewSeconds",
  "lastAnchorSequence",
  "lastAnchorSha256",
  "lastCheckpointRevision",
  "lastCheckpointSha256",
  "lastCasCommitSequence",
  "lastCasHeadCommitSha256",
  "contentAddressedStateVerified",
  "durablePersistenceVerified",
  "trustedMonotonicStorageVerified",
  "externalMonotonicityVerified",
  "providerAuthenticationVerified",
  "productionKeyOwnershipVerified",
  "externalRollbackProtectionVerified",
  "runtimeIntegrationVerified",
  "activationReady",
  "mainnetStatus",
  "stateSha256",
]);

const REQUEST_INPUT_KEYS = Object.freeze([
  "currentAnchorState",
  "requestNonceSha256",
  "requestedAtUnixSeconds",
]);

const REQUEST_KEYS = Object.freeze([
  "schema",
  "status",
  "anchorNamespaceSha256",
  "persistenceIdentitySha256",
  "providerTrustBindingSha256",
  "providerTrustRootSha256",
  "providerKeyRegistrySnapshotSha256",
  "anchorStateBeforeSha256",
  "minimumAnchorSequence",
  "expectedPreviousAnchorSha256",
  "expectedCheckpointRevision",
  "expectedPreviousCheckpointSha256",
  "requestNonceSha256",
  "requestedAtUnixSeconds",
  "runtimeIntegrationVerified",
  "activationReady",
  "mainnetStatus",
  "requestSha256",
]);

const CHECKPOINT_KEYS = Object.freeze([
  "persistenceIdentitySha256",
  "checkpointRevision",
  "checkpointSha256",
  "previousCheckpointSha256",
  "casCommitSequence",
  "casHeadCommitSha256",
]);

const STATEMENT_INPUT_KEYS = Object.freeze([
  "currentAnchorState",
  "request",
  "checkpoint",
  "observedAtUnixSeconds",
  "expiresAtUnixSeconds",
]);

const STATEMENT_KEYS = Object.freeze([
  "schema",
  "status",
  "anchorNamespaceSha256",
  "persistenceIdentitySha256",
  "providerTrustBindingSha256",
  "providerTrustRootSha256",
  "providerKeyRegistrySnapshotSha256",
  "anchorStateBeforeSha256",
  "requestSha256",
  "anchorSequence",
  "previousAnchorSha256",
  ...CHECKPOINT_KEYS.filter((key) => key !== "persistenceIdentitySha256"),
  "observedAtUnixSeconds",
  "expiresAtUnixSeconds",
  "providerIdentityVerified",
  "providerAuthenticationVerified",
  "productionKeyOwnershipVerified",
  "keyRegistryAuthenticityVerified",
  "trustedMonotonicStorageVerified",
  "externalMonotonicityVerified",
  "durablePersistenceVerified",
  "externalRollbackProtectionVerified",
  "runtimeIntegrationVerified",
  "activationReady",
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
  "expectedCheckpoint",
  "evaluationUnixSeconds",
]);

const VERIFICATION_KEYS = Object.freeze([
  "schema",
  "status",
  "anchorNamespaceSha256",
  "persistenceIdentitySha256",
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
  "checkpointRevision",
  "checkpointSha256",
  "casCommitSequence",
  "casHeadCommitSha256",
  "canonicalRequestVerified",
  "canonicalAnchorVerified",
  "cryptographicSignatureVerified",
  "configuredPublicKeyMatched",
  "requestNonceVerified",
  "suppliedProviderReplayStateAdvanced",
  "contiguousAnchorSequenceVerified",
  "predecessorAnchorVerified",
  "suppliedStateCheckpointMonotonicityVerified",
  "checkpointBindingVerified",
  "contentAddressedStateVerified",
  "providerAuthenticationVerified",
  "providerIdentityVerified",
  "productionKeyOwnershipVerified",
  "keyRegistryAuthenticityVerified",
  "durableAnchorStateVerified",
  "trustedMonotonicStorageVerified",
  "externalMonotonicityVerified",
  "externalRollbackProtectionVerified",
  "runtimeIntegrationVerified",
  "sourceBoundAutomatedDirectEvidenceVerified",
  "activationReady",
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
  if ((!allowZero && value === ZERO_SHA256)
    || (value !== ZERO_SHA256
      && /^(?:([0-9a-f])\1{63}|([0-9a-f]{2})\2{31})$/u.test(value))) {
    throw new Error(`${label} must not be zero or obvious placeholder material`);
  }
  return value;
}

function asU64Decimal(value, label, {
  positive = false,
  maximum = U64_MAX,
} = {}) {
  if (typeof value !== "string" || !U64_DECIMAL.test(value)) {
    throw new TypeError(`${label} must be a canonical unsigned 64-bit decimal string`);
  }
  const parsed = BigInt(value);
  if (parsed > U64_MAX || parsed > maximum || (positive && parsed === 0n)) {
    throw new RangeError(`${label} is outside the accepted range`);
  }
  return parsed;
}

function asInstant(value, label) {
  if (typeof value !== "bigint" || value < 0n || value > U64_MAX) {
    throw new TypeError(`${label} must be an unsigned 64-bit bigint`);
  }
  return value;
}

function asFalse(value, label) {
  if (value !== false) throw new Error(`${label} must remain false`);
  return false;
}

function stateWithoutDigest(values) {
  return Object.fromEntries(STATE_KEYS
    .filter((key) => key !== "stateSha256")
    .map((key) => [key, values[key]]));
}

function requestWithoutDigest(values) {
  return Object.fromEntries(REQUEST_KEYS
    .filter((key) => key !== "requestSha256")
    .map((key) => [key, values[key]]));
}

function statementWithoutDigest(values) {
  return Object.fromEntries(STATEMENT_KEYS
    .filter((key) => key !== "anchorSha256")
    .map((key) => [key, values[key]]));
}

function verificationWithoutDigest(values) {
  return Object.fromEntries(VERIFICATION_KEYS
    .filter((key) => key !== "verificationReceiptSha256")
    .map((key) => [key, values[key]]));
}

function canonicalBytes(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function parseCanonicalBytes(bytes, validator, encoder, label) {
  if (!Buffer.isBuffer(bytes)
    || bytes.length === 0
    || bytes.length > MAX_CANONICAL_BYTES) {
    throw new TypeError(`${label} must be a nonempty bounded Buffer`);
  }
  let parsed;
  try {
    parsed = JSON.parse(UTF8_DECODER.decode(bytes));
  } catch {
    throw new Error(`${label} must contain canonical UTF-8 JSON`);
  }
  validator(parsed);
  const canonical = encoder(parsed);
  try {
    if (!canonical.equals(bytes)) throw new Error(`${label} is not canonically encoded`);
  } finally {
    canonical.fill(0);
  }
  return Object.freeze(parsed);
}

function assertExternalCheckpointTrustBinding(trustBinding) {
  validateProviderTrustBinding(trustBinding);
  if (trustBinding.environment !== "PRODUCTION"
    || trustBinding.providerKind !== PROVIDER_KINDS.EXTERNAL_CHECKPOINT
    || trustBinding.mainnetStatus !== PROVIDER_AUTHENTICATION_MAINNET_STATUS) {
    throw new Error("rollback anchor requires an explicit production checkpoint trust binding");
  }
  return trustBinding;
}

function stateFieldsFromTrust(trustBinding) {
  return {
    providerTrustBindingSha256: trustBinding.trustBindingSha256,
    providerTrustRootSha256: trustBinding.trustRootSha256,
    providerKeyRegistrySnapshotSha256: trustBinding.keyRegistrySnapshotSha256,
  };
}

function assertStateTrustMatches(state, trustBinding) {
  if (state.providerTrustBindingSha256 !== trustBinding.trustBindingSha256
    || state.providerTrustRootSha256 !== trustBinding.trustRootSha256
    || state.providerKeyRegistrySnapshotSha256
      !== trustBinding.keyRegistrySnapshotSha256) {
    throw new Error("rollback anchor state does not match the supplied provider trust binding");
  }
}

export function validateRewardRollbackAnchorState(candidate) {
  const state = exactDataValues(
    candidate,
    STATE_KEYS,
    "reward rollback anchor state must have the exact canonical shape",
  );
  if (state.schema !== REWARD_ROLLBACK_ANCHOR_STATE_SCHEMA
    || state.status !== REWARD_ROLLBACK_ANCHOR_STATUS
    || state.mainnetStatus !== REWARD_ROLLBACK_ANCHOR_MAINNET_STATUS) {
    throw new Error("reward rollback anchor state has an invalid schema or status");
  }
  for (const [key, allowZero] of [
    ["anchorNamespaceSha256", false],
    ["persistenceIdentitySha256", false],
    ["providerTrustBindingSha256", false],
    ["providerTrustRootSha256", false],
    ["providerKeyRegistrySnapshotSha256", false],
  ]) asCanonicalDigest(state[key], `state.${key}`, { allowZero });
  asU64Decimal(
    state.maximumAnchorAgeSeconds,
    "state.maximumAnchorAgeSeconds",
    { positive: true, maximum: MAX_ANCHOR_AGE_SECONDS },
  );
  asU64Decimal(
    state.maximumFutureSkewSeconds,
    "state.maximumFutureSkewSeconds",
    { maximum: MAX_FUTURE_SKEW_SECONDS },
  );
  const anchorSequence = asU64Decimal(
    state.lastAnchorSequence,
    "state.lastAnchorSequence",
  );
  const checkpointRevision = asU64Decimal(
    state.lastCheckpointRevision,
    "state.lastCheckpointRevision",
  );
  const casSequence = asU64Decimal(
    state.lastCasCommitSequence,
    "state.lastCasCommitSequence",
  );
  for (const [key, allowZero] of [
    ["lastAnchorSha256", anchorSequence === 0n],
    ["lastCheckpointSha256", checkpointRevision === 0n],
    ["lastCasHeadCommitSha256", casSequence === 0n],
  ]) asCanonicalDigest(state[key], `state.${key}`, { allowZero });
  if (anchorSequence !== checkpointRevision
    || (checkpointRevision === 0n
      ? casSequence !== 0n
        || state.lastAnchorSha256 !== ZERO_SHA256
        || state.lastCheckpointSha256 !== ZERO_SHA256
        || state.lastCasHeadCommitSha256 !== ZERO_SHA256
      : casSequence !== checkpointRevision - 1n
        || state.lastAnchorSha256 === ZERO_SHA256
        || state.lastCheckpointSha256 === ZERO_SHA256
        || ((casSequence === 0n)
          !== (state.lastCasHeadCommitSha256 === ZERO_SHA256)))) {
    throw new Error("reward rollback anchor state chain fields are inconsistent");
  }
  if (state.contentAddressedStateVerified !== true) {
    throw new Error("state.contentAddressedStateVerified must be true");
  }
  for (const flag of [
    "durablePersistenceVerified",
    "trustedMonotonicStorageVerified",
    "externalMonotonicityVerified",
    "providerAuthenticationVerified",
    "productionKeyOwnershipVerified",
    "externalRollbackProtectionVerified",
    "runtimeIntegrationVerified",
    "activationReady",
  ]) asFalse(state[flag], `state.${flag}`);
  const expectedSha256 = sha256Canonical(
    "iat-b3-reward-rollback-anchor-state/v1",
    stateWithoutDigest(state),
  );
  if (state.stateSha256 !== expectedSha256) {
    throw new Error("reward rollback anchor state digest mismatch");
  }
  return candidate;
}

function createState(fields) {
  const withoutDigest = {
    schema: REWARD_ROLLBACK_ANCHOR_STATE_SCHEMA,
    status: REWARD_ROLLBACK_ANCHOR_STATUS,
    ...fields,
    contentAddressedStateVerified: true,
    durablePersistenceVerified: false,
    trustedMonotonicStorageVerified: false,
    externalMonotonicityVerified: false,
    providerAuthenticationVerified: false,
    productionKeyOwnershipVerified: false,
    externalRollbackProtectionVerified: false,
    runtimeIntegrationVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_ROLLBACK_ANCHOR_MAINNET_STATUS,
  };
  const state = Object.freeze({
    ...withoutDigest,
    stateSha256: sha256Canonical(
      "iat-b3-reward-rollback-anchor-state/v1",
      withoutDigest,
    ),
  });
  validateRewardRollbackAnchorState(state);
  return state;
}

export function createRewardRollbackAnchorGenesisState(candidate) {
  const input = exactDataValues(
    candidate,
    GENESIS_INPUT_KEYS,
    "reward rollback anchor genesis input must have the exact canonical shape",
  );
  const trustBinding = assertExternalCheckpointTrustBinding(input.trustBinding);
  asCanonicalDigest(input.anchorNamespaceSha256, "anchorNamespaceSha256");
  asCanonicalDigest(input.persistenceIdentitySha256, "persistenceIdentitySha256");
  asU64Decimal(
    input.maximumAnchorAgeSeconds,
    "maximumAnchorAgeSeconds",
    { positive: true, maximum: MAX_ANCHOR_AGE_SECONDS },
  );
  asU64Decimal(
    input.maximumFutureSkewSeconds,
    "maximumFutureSkewSeconds",
    { maximum: MAX_FUTURE_SKEW_SECONDS },
  );
  return createState({
    anchorNamespaceSha256: input.anchorNamespaceSha256,
    persistenceIdentitySha256: input.persistenceIdentitySha256,
    ...stateFieldsFromTrust(trustBinding),
    maximumAnchorAgeSeconds: input.maximumAnchorAgeSeconds,
    maximumFutureSkewSeconds: input.maximumFutureSkewSeconds,
    lastAnchorSequence: "0",
    lastAnchorSha256: ZERO_SHA256,
    lastCheckpointRevision: "0",
    lastCheckpointSha256: ZERO_SHA256,
    lastCasCommitSequence: "0",
    lastCasHeadCommitSha256: ZERO_SHA256,
  });
}

export function validateRewardRollbackAnchorRequest(candidate) {
  const request = exactDataValues(
    candidate,
    REQUEST_KEYS,
    "reward rollback anchor request must have the exact canonical shape",
  );
  if (request.schema !== REWARD_ROLLBACK_ANCHOR_REQUEST_SCHEMA
    || request.status !== REWARD_ROLLBACK_ANCHOR_STATUS
    || request.mainnetStatus !== REWARD_ROLLBACK_ANCHOR_MAINNET_STATUS) {
    throw new Error("reward rollback anchor request has an invalid schema or status");
  }
  for (const key of [
    "anchorNamespaceSha256",
    "persistenceIdentitySha256",
    "providerTrustBindingSha256",
    "providerTrustRootSha256",
    "providerKeyRegistrySnapshotSha256",
    "anchorStateBeforeSha256",
    "requestNonceSha256",
  ]) asCanonicalDigest(request[key], `request.${key}`);
  const minimumSequence = asU64Decimal(
    request.minimumAnchorSequence,
    "request.minimumAnchorSequence",
    { positive: true },
  );
  const checkpointRevision = asU64Decimal(
    request.expectedCheckpointRevision,
    "request.expectedCheckpointRevision",
    { positive: true },
  );
  asCanonicalDigest(
    request.expectedPreviousAnchorSha256,
    "request.expectedPreviousAnchorSha256",
    { allowZero: minimumSequence === 1n },
  );
  asCanonicalDigest(
    request.expectedPreviousCheckpointSha256,
    "request.expectedPreviousCheckpointSha256",
    { allowZero: checkpointRevision === 1n },
  );
  if (minimumSequence !== checkpointRevision
    || (minimumSequence === 1n
      ? request.expectedPreviousAnchorSha256 !== ZERO_SHA256
        || request.expectedPreviousCheckpointSha256 !== ZERO_SHA256
      : request.expectedPreviousAnchorSha256 === ZERO_SHA256
        || request.expectedPreviousCheckpointSha256 === ZERO_SHA256)) {
    throw new Error("reward rollback anchor request predecessor fields are inconsistent");
  }
  asU64Decimal(request.requestedAtUnixSeconds, "request.requestedAtUnixSeconds");
  asFalse(request.runtimeIntegrationVerified, "request.runtimeIntegrationVerified");
  asFalse(request.activationReady, "request.activationReady");
  const expectedSha256 = sha256Canonical(
    "iat-b3-reward-rollback-anchor-request/v1",
    requestWithoutDigest(request),
  );
  if (request.requestSha256 !== expectedSha256) {
    throw new Error("reward rollback anchor request digest mismatch");
  }
  return candidate;
}

export function createRewardRollbackAnchorRequest(candidate) {
  const input = exactDataValues(
    candidate,
    REQUEST_INPUT_KEYS,
    "reward rollback anchor request input must have the exact canonical shape",
  );
  const state = validateRewardRollbackAnchorState(input.currentAnchorState);
  const requestNonceSha256 = asCanonicalDigest(
    input.requestNonceSha256,
    "requestNonceSha256",
  );
  const requestedAt = asInstant(input.requestedAtUnixSeconds, "requestedAtUnixSeconds");
  if (BigInt(state.lastAnchorSequence) === U64_MAX) {
    throw new RangeError("reward rollback anchor sequence is exhausted");
  }
  const withoutDigest = {
    schema: REWARD_ROLLBACK_ANCHOR_REQUEST_SCHEMA,
    status: REWARD_ROLLBACK_ANCHOR_STATUS,
    anchorNamespaceSha256: state.anchorNamespaceSha256,
    persistenceIdentitySha256: state.persistenceIdentitySha256,
    providerTrustBindingSha256: state.providerTrustBindingSha256,
    providerTrustRootSha256: state.providerTrustRootSha256,
    providerKeyRegistrySnapshotSha256: state.providerKeyRegistrySnapshotSha256,
    anchorStateBeforeSha256: state.stateSha256,
    minimumAnchorSequence: (BigInt(state.lastAnchorSequence) + 1n).toString(),
    expectedPreviousAnchorSha256: state.lastAnchorSha256,
    expectedCheckpointRevision: (BigInt(state.lastCheckpointRevision) + 1n).toString(),
    expectedPreviousCheckpointSha256: state.lastCheckpointSha256,
    requestNonceSha256,
    requestedAtUnixSeconds: requestedAt.toString(),
    runtimeIntegrationVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_ROLLBACK_ANCHOR_MAINNET_STATUS,
  };
  const request = Object.freeze({
    ...withoutDigest,
    requestSha256: sha256Canonical(
      "iat-b3-reward-rollback-anchor-request/v1",
      withoutDigest,
    ),
  });
  validateRewardRollbackAnchorRequest(request);
  return request;
}

export function rewardRollbackAnchorRequestBytes(request) {
  validateRewardRollbackAnchorRequest(request);
  return canonicalBytes(Object.fromEntries(REQUEST_KEYS.map((key) => [key, request[key]])));
}

export function parseRewardRollbackAnchorRequestBytes(bytes) {
  return parseCanonicalBytes(
    bytes,
    validateRewardRollbackAnchorRequest,
    rewardRollbackAnchorRequestBytes,
    "reward rollback anchor request bytes",
  );
}

export function validateRewardRollbackAnchorCheckpoint(candidate) {
  const checkpoint = exactDataValues(
    candidate,
    CHECKPOINT_KEYS,
    "reward rollback anchor checkpoint must have the exact canonical shape",
  );
  asCanonicalDigest(
    checkpoint.persistenceIdentitySha256,
    "checkpoint.persistenceIdentitySha256",
  );
  const revision = asU64Decimal(
    checkpoint.checkpointRevision,
    "checkpoint.checkpointRevision",
    { positive: true },
  );
  const sequence = asU64Decimal(
    checkpoint.casCommitSequence,
    "checkpoint.casCommitSequence",
  );
  if (revision !== sequence + 1n) {
    throw new Error("rollback anchor checkpoint revision must equal commit sequence plus one");
  }
  asCanonicalDigest(checkpoint.checkpointSha256, "checkpoint.checkpointSha256");
  asCanonicalDigest(
    checkpoint.previousCheckpointSha256,
    "checkpoint.previousCheckpointSha256",
    { allowZero: revision === 1n },
  );
  asCanonicalDigest(
    checkpoint.casHeadCommitSha256,
    "checkpoint.casHeadCommitSha256",
    { allowZero: sequence === 0n },
  );
  if ((revision === 1n)
      !== (checkpoint.previousCheckpointSha256 === ZERO_SHA256)
    || (sequence === 0n)
      !== (checkpoint.casHeadCommitSha256 === ZERO_SHA256)) {
    throw new Error("reward rollback anchor checkpoint genesis fields are inconsistent");
  }
  return candidate;
}

function checkpointFromStatement(statement) {
  return Object.fromEntries(CHECKPOINT_KEYS.map((key) => [key, statement[key]]));
}

function sameCheckpoint(left, right) {
  return CHECKPOINT_KEYS.every((key) => left[key] === right[key]);
}

export function validateRewardRollbackAnchorStatement(candidate) {
  const statement = exactDataValues(
    candidate,
    STATEMENT_KEYS,
    "reward rollback anchor statement must have the exact canonical shape",
  );
  if (statement.schema !== REWARD_ROLLBACK_ANCHOR_STATEMENT_SCHEMA
    || statement.status !== REWARD_ROLLBACK_ANCHOR_STATUS
    || statement.mainnetStatus !== REWARD_ROLLBACK_ANCHOR_MAINNET_STATUS) {
    throw new Error("reward rollback anchor statement has an invalid schema or status");
  }
  for (const key of [
    "anchorNamespaceSha256",
    "persistenceIdentitySha256",
    "providerTrustBindingSha256",
    "providerTrustRootSha256",
    "providerKeyRegistrySnapshotSha256",
    "anchorStateBeforeSha256",
    "requestSha256",
  ]) asCanonicalDigest(statement[key], `statement.${key}`);
  const anchorSequence = asU64Decimal(
    statement.anchorSequence,
    "statement.anchorSequence",
    { positive: true },
  );
  asCanonicalDigest(
    statement.previousAnchorSha256,
    "statement.previousAnchorSha256",
    { allowZero: anchorSequence === 1n },
  );
  const checkpoint = checkpointFromStatement(statement);
  validateRewardRollbackAnchorCheckpoint(checkpoint);
  if (anchorSequence !== BigInt(checkpoint.checkpointRevision)
    || (anchorSequence === 1n)
      !== (statement.previousAnchorSha256 === ZERO_SHA256)) {
    throw new Error("reward rollback anchor statement sequence is inconsistent");
  }
  const observed = asU64Decimal(
    statement.observedAtUnixSeconds,
    "statement.observedAtUnixSeconds",
  );
  const expires = asU64Decimal(
    statement.expiresAtUnixSeconds,
    "statement.expiresAtUnixSeconds",
  );
  if (expires <= observed) {
    throw new Error("reward rollback anchor statement must expire after observation");
  }
  for (const flag of [
    "providerIdentityVerified",
    "providerAuthenticationVerified",
    "productionKeyOwnershipVerified",
    "keyRegistryAuthenticityVerified",
    "trustedMonotonicStorageVerified",
    "externalMonotonicityVerified",
    "durablePersistenceVerified",
    "externalRollbackProtectionVerified",
    "runtimeIntegrationVerified",
    "activationReady",
  ]) asFalse(statement[flag], `statement.${flag}`);
  const expectedSha256 = sha256Canonical(
    "iat-b3-reward-rollback-anchor-statement/v1",
    statementWithoutDigest(statement),
  );
  if (statement.anchorSha256 !== expectedSha256) {
    throw new Error("reward rollback anchor statement digest mismatch");
  }
  return candidate;
}

export function createRewardRollbackAnchorStatement(candidate) {
  const input = exactDataValues(
    candidate,
    STATEMENT_INPUT_KEYS,
    "reward rollback anchor statement input must have the exact canonical shape",
  );
  const state = validateRewardRollbackAnchorState(input.currentAnchorState);
  const request = validateRewardRollbackAnchorRequest(input.request);
  const checkpoint = validateRewardRollbackAnchorCheckpoint(input.checkpoint);
  const observed = asInstant(input.observedAtUnixSeconds, "observedAtUnixSeconds");
  const expires = asInstant(input.expiresAtUnixSeconds, "expiresAtUnixSeconds");
  if (expires <= observed
    || expires - observed > BigInt(state.maximumAnchorAgeSeconds)) {
    throw new Error("reward rollback anchor statement lifetime exceeds the configured maximum");
  }
  if (request.anchorStateBeforeSha256 !== state.stateSha256
    || request.anchorNamespaceSha256 !== state.anchorNamespaceSha256
    || request.persistenceIdentitySha256 !== state.persistenceIdentitySha256
    || request.providerTrustBindingSha256 !== state.providerTrustBindingSha256
    || request.providerTrustRootSha256 !== state.providerTrustRootSha256
    || request.providerKeyRegistrySnapshotSha256
      !== state.providerKeyRegistrySnapshotSha256
    || request.minimumAnchorSequence
      !== (BigInt(state.lastAnchorSequence) + 1n).toString()
    || request.expectedPreviousAnchorSha256 !== state.lastAnchorSha256
    || request.expectedCheckpointRevision !== checkpoint.checkpointRevision
    || request.expectedPreviousCheckpointSha256
      !== checkpoint.previousCheckpointSha256) {
    throw new Error("reward rollback anchor request does not bind the proposed statement");
  }
  if (checkpoint.persistenceIdentitySha256 !== state.persistenceIdentitySha256
    || checkpoint.checkpointRevision
      !== (BigInt(state.lastCheckpointRevision) + 1n).toString()
    || checkpoint.previousCheckpointSha256 !== state.lastCheckpointSha256) {
    throw new Error("reward rollback anchor checkpoint is not the next supplied state");
  }
  const withoutDigest = {
    schema: REWARD_ROLLBACK_ANCHOR_STATEMENT_SCHEMA,
    status: REWARD_ROLLBACK_ANCHOR_STATUS,
    anchorNamespaceSha256: state.anchorNamespaceSha256,
    persistenceIdentitySha256: state.persistenceIdentitySha256,
    providerTrustBindingSha256: state.providerTrustBindingSha256,
    providerTrustRootSha256: state.providerTrustRootSha256,
    providerKeyRegistrySnapshotSha256: state.providerKeyRegistrySnapshotSha256,
    anchorStateBeforeSha256: state.stateSha256,
    requestSha256: request.requestSha256,
    anchorSequence: request.minimumAnchorSequence,
    previousAnchorSha256: state.lastAnchorSha256,
    checkpointRevision: checkpoint.checkpointRevision,
    checkpointSha256: checkpoint.checkpointSha256,
    previousCheckpointSha256: checkpoint.previousCheckpointSha256,
    casCommitSequence: checkpoint.casCommitSequence,
    casHeadCommitSha256: checkpoint.casHeadCommitSha256,
    observedAtUnixSeconds: observed.toString(),
    expiresAtUnixSeconds: expires.toString(),
    providerIdentityVerified: false,
    providerAuthenticationVerified: false,
    productionKeyOwnershipVerified: false,
    keyRegistryAuthenticityVerified: false,
    trustedMonotonicStorageVerified: false,
    externalMonotonicityVerified: false,
    durablePersistenceVerified: false,
    externalRollbackProtectionVerified: false,
    runtimeIntegrationVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_ROLLBACK_ANCHOR_MAINNET_STATUS,
  };
  const statement = Object.freeze({
    ...withoutDigest,
    anchorSha256: sha256Canonical(
      "iat-b3-reward-rollback-anchor-statement/v1",
      withoutDigest,
    ),
  });
  validateRewardRollbackAnchorStatement(statement);
  return statement;
}

export function rewardRollbackAnchorStatementBytes(statement) {
  validateRewardRollbackAnchorStatement(statement);
  return canonicalBytes(Object.fromEntries(STATEMENT_KEYS.map((key) => [key, statement[key]])));
}

export function parseRewardRollbackAnchorStatementBytes(bytes) {
  return parseCanonicalBytes(
    bytes,
    validateRewardRollbackAnchorStatement,
    rewardRollbackAnchorStatementBytes,
    "reward rollback anchor statement bytes",
  );
}

function createAdvancedState(state, statement) {
  return createState({
    anchorNamespaceSha256: state.anchorNamespaceSha256,
    persistenceIdentitySha256: state.persistenceIdentitySha256,
    providerTrustBindingSha256: state.providerTrustBindingSha256,
    providerTrustRootSha256: state.providerTrustRootSha256,
    providerKeyRegistrySnapshotSha256: state.providerKeyRegistrySnapshotSha256,
    maximumAnchorAgeSeconds: state.maximumAnchorAgeSeconds,
    maximumFutureSkewSeconds: state.maximumFutureSkewSeconds,
    lastAnchorSequence: statement.anchorSequence,
    lastAnchorSha256: statement.anchorSha256,
    lastCheckpointRevision: statement.checkpointRevision,
    lastCheckpointSha256: statement.checkpointSha256,
    lastCasCommitSequence: statement.casCommitSequence,
    lastCasHeadCommitSha256: statement.casHeadCommitSha256,
  });
}

export function verifyRewardExternalRollbackAnchor(candidate) {
  const input = exactDataValues(
    candidate,
    VERIFY_INPUT_KEYS,
    "reward rollback anchor verification input must have the exact canonical shape",
  );
  const trustBinding = assertExternalCheckpointTrustBinding(input.trustBinding);
  const providerState = validateProviderEnvelopeState(
    input.currentProviderState,
    trustBinding,
  );
  const anchorState = validateRewardRollbackAnchorState(input.currentAnchorState);
  assertStateTrustMatches(anchorState, trustBinding);
  const expectedCheckpoint = validateRewardRollbackAnchorCheckpoint(
    input.expectedCheckpoint,
  );
  const requestNonceSha256 = asCanonicalDigest(
    input.expectedRequestNonceSha256,
    "expectedRequestNonceSha256",
  );
  const evaluation = asInstant(input.evaluationUnixSeconds, "evaluationUnixSeconds");
  const request = parseRewardRollbackAnchorRequestBytes(input.requestBytes);
  const statement = parseRewardRollbackAnchorStatementBytes(input.anchorBytes);

  if (request.requestNonceSha256 !== requestNonceSha256
    || request.anchorNamespaceSha256 !== anchorState.anchorNamespaceSha256
    || request.persistenceIdentitySha256 !== anchorState.persistenceIdentitySha256
    || request.providerTrustBindingSha256 !== trustBinding.trustBindingSha256
    || request.providerTrustRootSha256 !== trustBinding.trustRootSha256
    || request.providerKeyRegistrySnapshotSha256
      !== trustBinding.keyRegistrySnapshotSha256
    || request.anchorStateBeforeSha256 !== anchorState.stateSha256
    || request.minimumAnchorSequence
      !== (BigInt(anchorState.lastAnchorSequence) + 1n).toString()
    || request.expectedPreviousAnchorSha256 !== anchorState.lastAnchorSha256
    || request.expectedCheckpointRevision
      !== (BigInt(anchorState.lastCheckpointRevision) + 1n).toString()
    || request.expectedPreviousCheckpointSha256
      !== anchorState.lastCheckpointSha256) {
    throw new Error("reward rollback anchor request does not match current supplied state");
  }
  if (statement.anchorNamespaceSha256 !== anchorState.anchorNamespaceSha256
    || statement.persistenceIdentitySha256 !== anchorState.persistenceIdentitySha256
    || statement.providerTrustBindingSha256 !== trustBinding.trustBindingSha256
    || statement.providerTrustRootSha256 !== trustBinding.trustRootSha256
    || statement.providerKeyRegistrySnapshotSha256
      !== trustBinding.keyRegistrySnapshotSha256
    || statement.anchorStateBeforeSha256 !== anchorState.stateSha256
    || statement.requestSha256 !== request.requestSha256
    || statement.anchorSequence !== request.minimumAnchorSequence
    || statement.previousAnchorSha256 !== anchorState.lastAnchorSha256) {
    throw new Error("reward rollback anchor statement does not match request or state");
  }
  const statementCheckpoint = checkpointFromStatement(statement);
  if (!sameCheckpoint(statementCheckpoint, expectedCheckpoint)
    || expectedCheckpoint.persistenceIdentitySha256
      !== anchorState.persistenceIdentitySha256
    || expectedCheckpoint.checkpointRevision
      !== (BigInt(anchorState.lastCheckpointRevision) + 1n).toString()
    || expectedCheckpoint.previousCheckpointSha256
      !== anchorState.lastCheckpointSha256) {
    throw new Error("signed rollback anchor does not match the exact expected checkpoint");
  }
  const requested = BigInt(request.requestedAtUnixSeconds);
  const observed = BigInt(statement.observedAtUnixSeconds);
  const expires = BigInt(statement.expiresAtUnixSeconds);
  const skew = BigInt(anchorState.maximumFutureSkewSeconds);
  const maximumAge = BigInt(anchorState.maximumAnchorAgeSeconds);
  if (requested > evaluation + skew
    || observed > evaluation + skew
    || observed + skew < requested
    || expires <= observed
    || expires - observed > maximumAge
    || evaluation > expires) {
    throw new Error("reward rollback anchor timing is expired, premature, or inconsistent");
  }

  const providerReceipt = verifyProviderSignedEnvelope({
    trustBinding,
    currentState: providerState,
    envelope: input.providerEnvelope,
    requestBytes: input.requestBytes,
    responseBytes: input.anchorBytes,
    expectedRequestNonceSha256: requestNonceSha256,
    evaluationUnixSeconds: evaluation,
  });
  validateProviderEnvelopeVerificationReceipt(providerReceipt);
  if (input.providerEnvelope.operation !== REWARD_ROLLBACK_ANCHOR_PROVIDER_OPERATION
    || providerReceipt.requestSha256 !== sha256Bytes(input.requestBytes)
    || providerReceipt.responseSha256 !== sha256Bytes(input.anchorBytes)) {
    throw new Error("provider envelope does not sign the exact rollback anchor exchange");
  }

  const anchorStateAfter = createAdvancedState(anchorState, statement);
  const withoutDigest = {
    schema: REWARD_ROLLBACK_ANCHOR_VERIFICATION_SCHEMA,
    status: REWARD_ROLLBACK_ANCHOR_STATUS,
    anchorNamespaceSha256: anchorState.anchorNamespaceSha256,
    persistenceIdentitySha256: anchorState.persistenceIdentitySha256,
    providerTrustBindingSha256: trustBinding.trustBindingSha256,
    providerTrustRootSha256: trustBinding.trustRootSha256,
    providerKeyRegistrySnapshotSha256: trustBinding.keyRegistrySnapshotSha256,
    providerEnvelopeSha256: input.providerEnvelope.envelopeSha256,
    providerEnvelopeSequence: input.providerEnvelope.sequence,
    providerStateBeforeSha256: providerState.stateSha256,
    providerStateAfter: providerReceipt.stateAfter,
    requestSha256: request.requestSha256,
    anchorSequence: statement.anchorSequence,
    anchorSha256: statement.anchorSha256,
    anchorStateBeforeSha256: anchorState.stateSha256,
    anchorStateAfter,
    checkpointRevision: statement.checkpointRevision,
    checkpointSha256: statement.checkpointSha256,
    casCommitSequence: statement.casCommitSequence,
    casHeadCommitSha256: statement.casHeadCommitSha256,
    canonicalRequestVerified: true,
    canonicalAnchorVerified: true,
    cryptographicSignatureVerified: true,
    configuredPublicKeyMatched: true,
    requestNonceVerified: true,
    suppliedProviderReplayStateAdvanced: true,
    contiguousAnchorSequenceVerified: true,
    predecessorAnchorVerified: true,
    suppliedStateCheckpointMonotonicityVerified: true,
    checkpointBindingVerified: true,
    contentAddressedStateVerified: true,
    providerAuthenticationVerified: false,
    providerIdentityVerified: false,
    productionKeyOwnershipVerified: false,
    keyRegistryAuthenticityVerified: false,
    durableAnchorStateVerified: false,
    trustedMonotonicStorageVerified: false,
    externalMonotonicityVerified: false,
    externalRollbackProtectionVerified: false,
    runtimeIntegrationVerified: false,
    sourceBoundAutomatedDirectEvidenceVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_ROLLBACK_ANCHOR_MAINNET_STATUS,
  };
  const receipt = Object.freeze({
    ...withoutDigest,
    verificationReceiptSha256: sha256Canonical(
      "iat-b3-reward-rollback-anchor-verification/v1",
      withoutDigest,
    ),
  });
  EXECUTED_ANCHOR_RECEIPTS.add(receipt);
  validateRewardRollbackAnchorVerificationReceipt(receipt);
  return receipt;
}

export function validateRewardRollbackAnchorVerificationReceipt(candidate) {
  if (!EXECUTED_ANCHOR_RECEIPTS.has(candidate)) {
    throw new Error("reward rollback anchor receipt was not issued by this process");
  }
  const receipt = exactDataValues(
    candidate,
    VERIFICATION_KEYS,
    "reward rollback anchor receipt must have the exact canonical shape",
  );
  if (receipt.schema !== REWARD_ROLLBACK_ANCHOR_VERIFICATION_SCHEMA
    || receipt.status !== REWARD_ROLLBACK_ANCHOR_STATUS
    || receipt.mainnetStatus !== REWARD_ROLLBACK_ANCHOR_MAINNET_STATUS) {
    throw new Error("reward rollback anchor receipt has an invalid schema or status");
  }
  for (const key of [
    "anchorNamespaceSha256",
    "persistenceIdentitySha256",
    "providerTrustBindingSha256",
    "providerTrustRootSha256",
    "providerKeyRegistrySnapshotSha256",
    "providerEnvelopeSha256",
    "providerStateBeforeSha256",
    "requestSha256",
    "anchorSha256",
    "anchorStateBeforeSha256",
    "checkpointSha256",
    "casHeadCommitSha256",
  ]) asCanonicalDigest(receipt[key], `receipt.${key}`, {
    allowZero: key === "casHeadCommitSha256" && receipt.casCommitSequence === "0",
  });
  asU64Decimal(receipt.providerEnvelopeSequence, "receipt.providerEnvelopeSequence", {
    positive: true,
  });
  const anchorSequence = asU64Decimal(
    receipt.anchorSequence,
    "receipt.anchorSequence",
    { positive: true },
  );
  const checkpointRevision = asU64Decimal(
    receipt.checkpointRevision,
    "receipt.checkpointRevision",
    { positive: true },
  );
  const casSequence = asU64Decimal(
    receipt.casCommitSequence,
    "receipt.casCommitSequence",
  );
  if (anchorSequence !== checkpointRevision || checkpointRevision !== casSequence + 1n) {
    throw new Error("reward rollback anchor receipt sequence fields are inconsistent");
  }
  if (!isPlainRecord(receipt.providerStateAfter)
    || receipt.providerStateAfter.providerKind !== PROVIDER_KINDS.EXTERNAL_CHECKPOINT
    || receipt.providerStateAfter.trustBindingSha256
      !== receipt.providerTrustBindingSha256
    || receipt.providerStateAfter.lastSequence !== receipt.providerEnvelopeSequence
    || receipt.providerStateAfter.lastEnvelopeSha256 !== receipt.providerEnvelopeSha256) {
    throw new Error("reward rollback anchor receipt provider state is inconsistent");
  }
  asCanonicalDigest(
    receipt.providerStateAfter.stateSha256,
    "receipt.providerStateAfter.stateSha256",
  );
  validateRewardRollbackAnchorState(receipt.anchorStateAfter);
  if (receipt.anchorStateAfter.lastAnchorSequence !== receipt.anchorSequence
    || receipt.anchorStateAfter.lastAnchorSha256 !== receipt.anchorSha256
    || receipt.anchorStateAfter.lastCheckpointRevision !== receipt.checkpointRevision
    || receipt.anchorStateAfter.lastCheckpointSha256 !== receipt.checkpointSha256
    || receipt.anchorStateAfter.lastCasCommitSequence !== receipt.casCommitSequence
    || receipt.anchorStateAfter.lastCasHeadCommitSha256 !== receipt.casHeadCommitSha256) {
    throw new Error("reward rollback anchor receipt advanced state is inconsistent");
  }
  for (const flag of [
    "canonicalRequestVerified",
    "canonicalAnchorVerified",
    "cryptographicSignatureVerified",
    "configuredPublicKeyMatched",
    "requestNonceVerified",
    "suppliedProviderReplayStateAdvanced",
    "contiguousAnchorSequenceVerified",
    "predecessorAnchorVerified",
    "suppliedStateCheckpointMonotonicityVerified",
    "checkpointBindingVerified",
    "contentAddressedStateVerified",
  ]) {
    if (receipt[flag] !== true) throw new Error(`receipt.${flag} must be true`);
  }
  for (const flag of [
    "providerAuthenticationVerified",
    "providerIdentityVerified",
    "productionKeyOwnershipVerified",
    "keyRegistryAuthenticityVerified",
    "durableAnchorStateVerified",
    "trustedMonotonicStorageVerified",
    "externalMonotonicityVerified",
    "externalRollbackProtectionVerified",
    "runtimeIntegrationVerified",
    "sourceBoundAutomatedDirectEvidenceVerified",
    "activationReady",
  ]) asFalse(receipt[flag], `receipt.${flag}`);
  const expectedSha256 = sha256Canonical(
    "iat-b3-reward-rollback-anchor-verification/v1",
    verificationWithoutDigest(receipt),
  );
  if (receipt.verificationReceiptSha256 !== expectedSha256) {
    throw new Error("reward rollback anchor verification receipt digest mismatch");
  }
  return candidate;
}

import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  PROVIDER_AUTHENTICATION_MAINNET_STATUS,
  PROVIDER_KINDS,
  validateProviderEnvelopeState,
  validateProviderTrustBinding,
} from "./provider-authenticated-envelope.mjs";
import {
  validateRewardRollbackAnchorState,
  validateRewardRollbackAnchorVerificationReceipt,
} from "./reward-external-rollback-anchor.mjs";

export const REWARD_ROLLBACK_ANCHOR_SQLITE_ADAPTER_SCHEMA =
  "iat-b3-reward-rollback-anchor-sqlite-adapter/v1";
export const REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_VERSION = 1;
export const REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS =
  "HOST_ONLY_NON_ACTIVATING_DURABLE_LOCAL_SIGNED_ANCHOR_MIRROR";
export const REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS = "HOLD";
export const REWARD_ROLLBACK_ANCHOR_RECEIPT_RECORD_SCHEMA =
  "iat-b3-reward-rollback-anchor-durable-receipt/v1";
export const REWARD_ROLLBACK_ANCHOR_CURSOR_RECORD_SCHEMA =
  "iat-b3-reward-rollback-anchor-durable-cursor/v1";
export const REWARD_ROLLBACK_ANCHOR_SQLITE_DISPOSITION = Object.freeze({
  COMMITTED: "COMMITTED",
  ALREADY_CURRENT: "ALREADY_CURRENT",
});
export const REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP = Object.freeze({
  EXACT: "EXACT",
  LOCAL_AHEAD: "LOCAL_AHEAD",
  LOCAL_BEHIND: "LOCAL_BEHIND",
  SAME_SEQUENCE_FORK: "SAME_SEQUENCE_FORK",
});
export const REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT = Object.freeze({
  AFTER_RECEIPT_INSERT: "AFTER_RECEIPT_INSERT",
  AFTER_CURSOR_INSERT: "AFTER_CURSOR_INSERT",
  AFTER_DURABLE_COMMIT: "AFTER_DURABLE_COMMIT",
  HARD_EXIT_AFTER_RECEIPT_INSERT: "HARD_EXIT_AFTER_RECEIPT_INSERT",
  HARD_EXIT_AFTER_DURABLE_COMMIT: "HARD_EXIT_AFTER_DURABLE_COMMIT",
});

const ZERO_SHA256 = "0".repeat(64);
const U64_MAX = (1n << 64n) - 1n;
const HEX_32 = /^[0-9a-f]{64}$/u;
const HEX_32_CHECK = "length(%s) = 64 AND %s NOT GLOB '*[^0-9a-f]*'";
const SQLITE_REWARD_ROLLBACK_ANCHOR_MIRROR_ADAPTERS = new WeakSet();
const ACCEPTED_FAULTS = new Set([
  null,
  ...Object.values(REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT),
]);

const RECEIPT_RECORD_KEYS = Object.freeze([
  "schema",
  "status",
  "anchorNamespaceSha256",
  "persistenceIdentitySha256",
  "providerTrustBindingSha256",
  "providerTrustRootSha256",
  "providerKeyRegistrySnapshotSha256",
  "anchorSequence",
  "anchorSha256",
  "previousAnchorSha256",
  "anchorStateBeforeSha256",
  "anchorStateAfterSha256",
  "checkpointRevision",
  "checkpointSha256",
  "previousCheckpointSha256",
  "casCommitSequence",
  "casHeadCommitSha256",
  "providerEnvelopeSequence",
  "providerEnvelopeSha256",
  "providerStateBeforeSha256",
  "providerStateAfterSha256",
  "sourceVerificationReceiptSha256",
  "durableLocalMirrorVerified",
  "cursorReceiptAtomicityVerified",
  "providerAuthenticationVerified",
  "externalProviderDurabilityVerified",
  "externalMonotonicityVerified",
  "independentRollbackProtectionVerified",
  "runtimeIntegrationVerified",
  "activationReady",
  "mainnetStatus",
  "receiptRecordSha256",
]);

const CURSOR_RECORD_KEYS = Object.freeze([
  "schema",
  "status",
  "anchorSequence",
  "anchorSha256",
  "checkpointRevision",
  "checkpointSha256",
  "providerEnvelopeSequence",
  "providerEnvelopeSha256",
  "providerTrustRootSha256",
  "receiptRecordSha256",
  "previousCursorSha256",
  "durableLocalMirrorVerified",
  "cursorReceiptAtomicityVerified",
  "providerAuthenticationVerified",
  "externalProviderDurabilityVerified",
  "externalMonotonicityVerified",
  "independentRollbackProtectionVerified",
  "runtimeIntegrationVerified",
  "activationReady",
  "mainnetStatus",
  "cursorSha256",
]);

function hexCheck(column) {
  return HEX_32_CHECK.replaceAll("%s", column);
}

const TABLE_SQL = Object.freeze({
  reward_rollback_anchor_meta: `CREATE TABLE reward_rollback_anchor_meta (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    adapter_schema TEXT NOT NULL CHECK (adapter_schema = '${REWARD_ROLLBACK_ANCHOR_SQLITE_ADAPTER_SCHEMA}'),
    schema_version INTEGER NOT NULL CHECK (schema_version = ${REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_VERSION}),
    adapter_status TEXT NOT NULL CHECK (adapter_status = '${REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS}'),
    schema_manifest_sha256 TEXT NOT NULL CHECK (${hexCheck("schema_manifest_sha256")}),
    anchor_namespace_sha256 TEXT NOT NULL CHECK (${hexCheck("anchor_namespace_sha256")}),
    persistence_identity_sha256 TEXT NOT NULL CHECK (${hexCheck("persistence_identity_sha256")}),
    provider_trust_binding_sha256 TEXT NOT NULL CHECK (${hexCheck("provider_trust_binding_sha256")}),
    provider_trust_root_sha256 TEXT NOT NULL CHECK (${hexCheck("provider_trust_root_sha256")}),
    provider_key_registry_snapshot_sha256 TEXT NOT NULL CHECK (${hexCheck("provider_key_registry_snapshot_sha256")}),
    genesis_anchor_state_sha256 TEXT NOT NULL CHECK (${hexCheck("genesis_anchor_state_sha256")}),
    genesis_provider_state_sha256 TEXT NOT NULL CHECK (${hexCheck("genesis_provider_state_sha256")}),
    durable_local_mirror_verified INTEGER NOT NULL CHECK (durable_local_mirror_verified = 1),
    cursor_receipt_atomicity_verified INTEGER NOT NULL CHECK (cursor_receipt_atomicity_verified = 1),
    local_rollback_comparison_verified INTEGER NOT NULL CHECK (local_rollback_comparison_verified = 1),
    provider_authentication_verified INTEGER NOT NULL CHECK (provider_authentication_verified = 0),
    external_provider_durability_verified INTEGER NOT NULL CHECK (external_provider_durability_verified = 0),
    external_monotonicity_verified INTEGER NOT NULL CHECK (external_monotonicity_verified = 0),
    independent_rollback_protection_verified INTEGER NOT NULL CHECK (independent_rollback_protection_verified = 0),
    runtime_integration_verified INTEGER NOT NULL CHECK (runtime_integration_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS}')
  ) STRICT`,
  reward_rollback_anchor_receipts: `CREATE TABLE reward_rollback_anchor_receipts (
    anchor_sequence_be BLOB PRIMARY KEY CHECK (typeof(anchor_sequence_be) = 'blob' AND length(anchor_sequence_be) = 8),
    anchor_sequence_text TEXT NOT NULL UNIQUE CHECK (
      length(anchor_sequence_text) BETWEEN 1 AND 20
      AND anchor_sequence_text NOT GLOB '*[^0-9]*'
      AND substr(anchor_sequence_text, 1, 1) BETWEEN '1' AND '9'
    ),
    anchor_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("anchor_sha256")}),
    previous_anchor_sha256 TEXT NOT NULL CHECK (${hexCheck("previous_anchor_sha256")}),
    anchor_state_before_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("anchor_state_before_sha256")}),
    anchor_state_after_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("anchor_state_after_sha256")}),
    checkpoint_revision_be BLOB NOT NULL UNIQUE CHECK (typeof(checkpoint_revision_be) = 'blob' AND length(checkpoint_revision_be) = 8),
    checkpoint_revision_text TEXT NOT NULL UNIQUE CHECK (
      length(checkpoint_revision_text) BETWEEN 1 AND 20
      AND checkpoint_revision_text NOT GLOB '*[^0-9]*'
      AND substr(checkpoint_revision_text, 1, 1) BETWEEN '1' AND '9'
    ),
    checkpoint_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("checkpoint_sha256")}),
    previous_checkpoint_sha256 TEXT NOT NULL CHECK (${hexCheck("previous_checkpoint_sha256")}),
    cas_commit_sequence_be BLOB NOT NULL UNIQUE CHECK (typeof(cas_commit_sequence_be) = 'blob' AND length(cas_commit_sequence_be) = 8),
    cas_commit_sequence_text TEXT NOT NULL UNIQUE CHECK (
      length(cas_commit_sequence_text) BETWEEN 1 AND 20
      AND cas_commit_sequence_text NOT GLOB '*[^0-9]*'
      AND (cas_commit_sequence_text = '0' OR substr(cas_commit_sequence_text, 1, 1) BETWEEN '1' AND '9')
    ),
    cas_head_commit_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("cas_head_commit_sha256")}),
    provider_envelope_sequence_be BLOB NOT NULL UNIQUE CHECK (typeof(provider_envelope_sequence_be) = 'blob' AND length(provider_envelope_sequence_be) = 8),
    provider_envelope_sequence_text TEXT NOT NULL UNIQUE CHECK (
      length(provider_envelope_sequence_text) BETWEEN 1 AND 20
      AND provider_envelope_sequence_text NOT GLOB '*[^0-9]*'
      AND substr(provider_envelope_sequence_text, 1, 1) BETWEEN '1' AND '9'
    ),
    provider_envelope_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("provider_envelope_sha256")}),
    provider_state_before_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("provider_state_before_sha256")}),
    provider_state_after_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("provider_state_after_sha256")}),
    source_verification_receipt_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("source_verification_receipt_sha256")}),
    receipt_record_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("receipt_record_sha256")}),
    record_blob BLOB NOT NULL CHECK (typeof(record_blob) = 'blob' AND length(record_blob) > 0),
    status TEXT NOT NULL CHECK (status = '${REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS}'),
    durable_local_mirror_verified INTEGER NOT NULL CHECK (durable_local_mirror_verified = 1),
    cursor_receipt_atomicity_verified INTEGER NOT NULL CHECK (cursor_receipt_atomicity_verified = 1),
    provider_authentication_verified INTEGER NOT NULL CHECK (provider_authentication_verified = 0),
    external_provider_durability_verified INTEGER NOT NULL CHECK (external_provider_durability_verified = 0),
    external_monotonicity_verified INTEGER NOT NULL CHECK (external_monotonicity_verified = 0),
    independent_rollback_protection_verified INTEGER NOT NULL CHECK (independent_rollback_protection_verified = 0),
    runtime_integration_verified INTEGER NOT NULL CHECK (runtime_integration_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS}')
  ) STRICT, WITHOUT ROWID`,
  reward_rollback_anchor_cursors: `CREATE TABLE reward_rollback_anchor_cursors (
    cursor_revision_be BLOB PRIMARY KEY CHECK (typeof(cursor_revision_be) = 'blob' AND length(cursor_revision_be) = 8),
    cursor_revision_text TEXT NOT NULL UNIQUE CHECK (
      length(cursor_revision_text) BETWEEN 1 AND 20
      AND cursor_revision_text NOT GLOB '*[^0-9]*'
      AND substr(cursor_revision_text, 1, 1) BETWEEN '1' AND '9'
    ),
    anchor_sequence_be BLOB NOT NULL UNIQUE CHECK (typeof(anchor_sequence_be) = 'blob' AND length(anchor_sequence_be) = 8),
    anchor_sequence_text TEXT NOT NULL UNIQUE CHECK (
      length(anchor_sequence_text) BETWEEN 1 AND 20
      AND anchor_sequence_text NOT GLOB '*[^0-9]*'
      AND substr(anchor_sequence_text, 1, 1) BETWEEN '1' AND '9'
    ),
    anchor_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("anchor_sha256")}),
    checkpoint_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("checkpoint_sha256")}),
    provider_envelope_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("provider_envelope_sha256")}),
    provider_trust_root_sha256 TEXT NOT NULL CHECK (${hexCheck("provider_trust_root_sha256")}),
    receipt_record_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("receipt_record_sha256")}),
    previous_cursor_sha256 TEXT NOT NULL CHECK (${hexCheck("previous_cursor_sha256")}),
    cursor_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("cursor_sha256")}),
    record_blob BLOB NOT NULL CHECK (typeof(record_blob) = 'blob' AND length(record_blob) > 0),
    status TEXT NOT NULL CHECK (status = '${REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS}'),
    durable_local_mirror_verified INTEGER NOT NULL CHECK (durable_local_mirror_verified = 1),
    cursor_receipt_atomicity_verified INTEGER NOT NULL CHECK (cursor_receipt_atomicity_verified = 1),
    provider_authentication_verified INTEGER NOT NULL CHECK (provider_authentication_verified = 0),
    external_provider_durability_verified INTEGER NOT NULL CHECK (external_provider_durability_verified = 0),
    external_monotonicity_verified INTEGER NOT NULL CHECK (external_monotonicity_verified = 0),
    independent_rollback_protection_verified INTEGER NOT NULL CHECK (independent_rollback_protection_verified = 0),
    runtime_integration_verified INTEGER NOT NULL CHECK (runtime_integration_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS}'),
    FOREIGN KEY (receipt_record_sha256)
      REFERENCES reward_rollback_anchor_receipts(receipt_record_sha256)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT, WITHOUT ROWID`,
});

function immutableTriggerSql(table, operation) {
  return `CREATE TRIGGER ${table}_forbid_${operation.toLowerCase()}
    BEFORE ${operation} ON ${table}
    BEGIN
      SELECT RAISE(ABORT, 'REWARD_ROLLBACK_ANCHOR_APPEND_ONLY_${operation}_FORBIDDEN');
    END`;
}

const TABLE_NAMES = Object.freeze(Object.keys(TABLE_SQL));
const TRIGGER_SQL = Object.freeze(Object.fromEntries(TABLE_NAMES.flatMap((table) => [
  [`${table}_forbid_update`, immutableTriggerSql(table, "UPDATE")],
  [`${table}_forbid_delete`, immutableTriggerSql(table, "DELETE")],
])));

const DUPLICATE_INSERT_PREDICATES = Object.freeze({
  reward_rollback_anchor_meta: "singleton_id = NEW.singleton_id",
  reward_rollback_anchor_receipts: `anchor_sequence_be = NEW.anchor_sequence_be
    OR anchor_sequence_text = NEW.anchor_sequence_text
    OR anchor_sha256 = NEW.anchor_sha256
    OR source_verification_receipt_sha256 = NEW.source_verification_receipt_sha256
    OR receipt_record_sha256 = NEW.receipt_record_sha256`,
  reward_rollback_anchor_cursors: `cursor_revision_be = NEW.cursor_revision_be
    OR cursor_revision_text = NEW.cursor_revision_text
    OR anchor_sequence_be = NEW.anchor_sequence_be
    OR anchor_sequence_text = NEW.anchor_sequence_text
    OR anchor_sha256 = NEW.anchor_sha256
    OR receipt_record_sha256 = NEW.receipt_record_sha256
    OR cursor_sha256 = NEW.cursor_sha256`,
});

const DUPLICATE_TRIGGER_SQL = Object.freeze(Object.fromEntries(
  Object.entries(DUPLICATE_INSERT_PREDICATES).map(([table, predicate]) => [
    `${table}_forbid_duplicate_insert`,
    `CREATE TRIGGER ${table}_forbid_duplicate_insert
      BEFORE INSERT ON ${table}
      WHEN EXISTS (SELECT 1 FROM ${table} WHERE ${predicate})
      BEGIN
        SELECT RAISE(ABORT, 'REWARD_ROLLBACK_ANCHOR_DUPLICATE_INSERT_FORBIDDEN');
      END`,
  ]),
));

const SCHEMA_OBJECTS = Object.freeze([
  ...Object.entries(TABLE_SQL).map(([name, sql]) => ({
    type: "table", name, tableName: name, sql,
  })),
  ...Object.entries(TRIGGER_SQL).map(([name, sql]) => ({
    type: "trigger",
    name,
    tableName: name.replace(/_forbid_(?:update|delete)$/u, ""),
    sql,
  })),
  ...Object.entries(DUPLICATE_TRIGGER_SQL).map(([name, sql]) => ({
    type: "trigger",
    name,
    tableName: name.replace(/_forbid_duplicate_insert$/u, ""),
    sql,
  })),
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Canonical(domain, value) {
  return sha256(Buffer.from(JSON.stringify({ domain, value }), "utf8"));
}

function normalizeSql(sql) {
  return sql.replace(/;\s*$/u, "").replace(/\s+/gu, " ").trim();
}

function schemaManifestSha256(objects = SCHEMA_OBJECTS) {
  return sha256(objects
    .map(({ type, name, tableName, sql }) => (
      `${type}|${name}|${tableName}|${normalizeSql(sql)}`
    ))
    .sort()
    .join("\n"));
}

export const REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_MANIFEST_SHA256 =
  schemaManifestSha256();

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
  if (!allowZero && value === ZERO_SHA256) {
    throw new Error(`${label} must not be zero`);
  }
  return value;
}

function asU64String(value, label, { positive = false } = {}) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,19})$/u.test(value)) {
    throw new TypeError(`${label} must be a canonical unsigned 64-bit decimal string`);
  }
  const parsed = BigInt(value);
  if (parsed > U64_MAX || (positive && parsed === 0n)) {
    throw new RangeError(`${label} is outside the accepted range`);
  }
  return parsed;
}

function asFalse(value, label) {
  if (value !== false) throw new Error(`${label} must remain false`);
}

function u64Be(value, label) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(asU64String(value, label));
  return bytes;
}

function u64FromBe(value, label) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new TypeError(`${label} must be an eight-byte BLOB`);
  }
  const bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (bytes.length !== 8) throw new RangeError(`${label} must be an eight-byte BLOB`);
  return bytes.readBigUInt64BE();
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

function recordWithoutDigest(record, keys, digestKey) {
  return Object.fromEntries(keys
    .filter((key) => key !== digestKey)
    .map((key) => [key, record[key]]));
}

function encodeRecord(record, keys) {
  return Buffer.from(JSON.stringify(
    Object.fromEntries(keys.map((key) => [key, record[key]])),
  ), "utf8");
}

function decodeRecord(blob, keys, label) {
  const bytes = Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength);
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${label}_RECORD_DECODE_FAILED`, { cause: error });
  }
  const canonical = encodeRecord(parsed, keys);
  try {
    if (!canonical.equals(bytes)) throw new Error(`${label}_RECORD_NOT_CANONICAL`);
  } finally {
    canonical.fill(0);
  }
  return parsed;
}

function assertFalseBoundary(record, label) {
  for (const flag of [
    "providerAuthenticationVerified",
    "externalProviderDurabilityVerified",
    "externalMonotonicityVerified",
    "independentRollbackProtectionVerified",
    "runtimeIntegrationVerified",
    "activationReady",
  ]) asFalse(record[flag], `${label}.${flag}`);
  if (record.durableLocalMirrorVerified !== true
    || record.cursorReceiptAtomicityVerified !== true
    || record.mainnetStatus !== REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS) {
    throw new Error(`${label}_TRUTH_BOUNDARY_INVALID`);
  }
}

function assertExternalTrust(trustBinding) {
  validateProviderTrustBinding(trustBinding);
  if (trustBinding.environment !== "PRODUCTION"
    || trustBinding.providerKind !== PROVIDER_KINDS.EXTERNAL_CHECKPOINT
    || trustBinding.mainnetStatus !== PROVIDER_AUTHENTICATION_MAINNET_STATUS) {
    throw new Error("rollback anchor mirror requires production checkpoint trust");
  }
  return trustBinding;
}

function createConfiguration(trustBinding, anchorState, providerState) {
  assertExternalTrust(trustBinding);
  validateRewardRollbackAnchorState(anchorState);
  validateProviderEnvelopeState(providerState, trustBinding);
  if (anchorState.lastAnchorSequence !== "0"
    || providerState.lastSequence !== "0"
    || anchorState.providerTrustBindingSha256 !== trustBinding.trustBindingSha256
    || anchorState.providerTrustRootSha256 !== trustBinding.trustRootSha256
    || anchorState.providerKeyRegistrySnapshotSha256
      !== trustBinding.keyRegistrySnapshotSha256) {
    throw new Error("rollback anchor mirror requires exact trust-bound genesis states");
  }
  return Object.freeze({
    anchorNamespaceSha256: anchorState.anchorNamespaceSha256,
    persistenceIdentitySha256: anchorState.persistenceIdentitySha256,
    providerTrustBindingSha256: trustBinding.trustBindingSha256,
    providerTrustRootSha256: trustBinding.trustRootSha256,
    providerKeyRegistrySnapshotSha256: trustBinding.keyRegistrySnapshotSha256,
    genesisAnchorStateSha256: anchorState.stateSha256,
    genesisProviderStateSha256: providerState.stateSha256,
  });
}

function validateReceiptRecord(record, previous, configuration) {
  exactDataValues(
    record,
    RECEIPT_RECORD_KEYS,
    "reward rollback durable receipt must have the exact canonical shape",
  );
  if (record.schema !== REWARD_ROLLBACK_ANCHOR_RECEIPT_RECORD_SCHEMA
    || record.status !== REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS) {
    throw new Error("INVALID_REWARD_ROLLBACK_DURABLE_RECEIPT_RECORD");
  }
  assertFalseBoundary(record, "receiptRecord");
  for (const key of [
    "anchorNamespaceSha256",
    "persistenceIdentitySha256",
    "providerTrustBindingSha256",
    "providerTrustRootSha256",
    "providerKeyRegistrySnapshotSha256",
    "anchorSha256",
    "anchorStateBeforeSha256",
    "anchorStateAfterSha256",
    "checkpointSha256",
    "providerEnvelopeSha256",
    "providerStateBeforeSha256",
    "providerStateAfterSha256",
    "sourceVerificationReceiptSha256",
    "receiptRecordSha256",
  ]) asDigest(record[key], `receiptRecord.${key}`);
  const sequence = asU64String(record.anchorSequence, "receiptRecord.anchorSequence", {
    positive: true,
  });
  const checkpointRevision = asU64String(
    record.checkpointRevision,
    "receiptRecord.checkpointRevision",
    { positive: true },
  );
  const casSequence = asU64String(
    record.casCommitSequence,
    "receiptRecord.casCommitSequence",
  );
  const providerSequence = asU64String(
    record.providerEnvelopeSequence,
    "receiptRecord.providerEnvelopeSequence",
    { positive: true },
  );
  const expectedSequence = BigInt(previous?.anchorSequence ?? "0") + 1n;
  const expectedProviderSequence = BigInt(previous?.providerEnvelopeSequence ?? "0") + 1n;
  asDigest(record.previousAnchorSha256, "receiptRecord.previousAnchorSha256", {
    allowZero: sequence === 1n,
  });
  asDigest(record.previousCheckpointSha256, "receiptRecord.previousCheckpointSha256", {
    allowZero: checkpointRevision === 1n,
  });
  asDigest(record.casHeadCommitSha256, "receiptRecord.casHeadCommitSha256", {
    allowZero: casSequence === 0n,
  });
  if (sequence !== expectedSequence
    || sequence !== checkpointRevision
    || checkpointRevision !== casSequence + 1n
    || providerSequence !== expectedProviderSequence
    || record.previousAnchorSha256 !== (previous?.anchorSha256 ?? ZERO_SHA256)
    || record.previousCheckpointSha256 !== (previous?.checkpointSha256 ?? ZERO_SHA256)
    || record.anchorStateBeforeSha256
      !== (previous?.anchorStateAfterSha256 ?? configuration.genesisAnchorStateSha256)
    || record.providerStateBeforeSha256
      !== (previous?.providerStateAfterSha256 ?? configuration.genesisProviderStateSha256)
    || ((casSequence === 0n) !== (record.casHeadCommitSha256 === ZERO_SHA256))) {
    throw new Error("REWARD_ROLLBACK_DURABLE_RECEIPT_CHAIN_MISMATCH");
  }
  for (const key of [
    "anchorNamespaceSha256",
    "persistenceIdentitySha256",
    "providerTrustBindingSha256",
    "providerTrustRootSha256",
    "providerKeyRegistrySnapshotSha256",
  ]) {
    if (record[key] !== configuration[key]) {
      throw new Error("REWARD_ROLLBACK_DURABLE_RECEIPT_TRUST_BINDING_MISMATCH");
    }
  }
  const expectedSha256 = sha256Canonical(
    "iat-b3-reward-rollback-anchor-durable-receipt/v1",
    recordWithoutDigest(record, RECEIPT_RECORD_KEYS, "receiptRecordSha256"),
  );
  if (record.receiptRecordSha256 !== expectedSha256) {
    throw new Error("REWARD_ROLLBACK_DURABLE_RECEIPT_DIGEST_MISMATCH");
  }
  return record;
}

function validateCursorRecord(record, previous, receipt) {
  exactDataValues(
    record,
    CURSOR_RECORD_KEYS,
    "reward rollback anchor cursor must have the exact canonical shape",
  );
  if (record.schema !== REWARD_ROLLBACK_ANCHOR_CURSOR_RECORD_SCHEMA
    || record.status !== REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS) {
    throw new Error("INVALID_REWARD_ROLLBACK_ANCHOR_CURSOR_RECORD");
  }
  assertFalseBoundary(record, "cursorRecord");
  const sequence = asU64String(record.anchorSequence, "cursorRecord.anchorSequence", {
    positive: true,
  });
  const checkpointRevision = asU64String(
    record.checkpointRevision,
    "cursorRecord.checkpointRevision",
    { positive: true },
  );
  const providerSequence = asU64String(
    record.providerEnvelopeSequence,
    "cursorRecord.providerEnvelopeSequence",
    { positive: true },
  );
  for (const [key, allowZero] of [
    ["anchorSha256", false],
    ["checkpointSha256", false],
    ["providerEnvelopeSha256", false],
    ["providerTrustRootSha256", false],
    ["receiptRecordSha256", false],
    ["previousCursorSha256", sequence === 1n],
    ["cursorSha256", false],
  ]) asDigest(record[key], `cursorRecord.${key}`, { allowZero });
  if (!receipt
    || sequence !== BigInt(previous?.anchorSequence ?? "0") + 1n
    || sequence !== checkpointRevision
    || providerSequence !== BigInt(previous?.providerEnvelopeSequence ?? "0") + 1n
    || record.previousCursorSha256 !== (previous?.cursorSha256 ?? ZERO_SHA256)
    || record.anchorSequence !== receipt.anchorSequence
    || record.anchorSha256 !== receipt.anchorSha256
    || record.checkpointRevision !== receipt.checkpointRevision
    || record.checkpointSha256 !== receipt.checkpointSha256
    || record.providerEnvelopeSequence !== receipt.providerEnvelopeSequence
    || record.providerEnvelopeSha256 !== receipt.providerEnvelopeSha256
    || record.providerTrustRootSha256 !== receipt.providerTrustRootSha256
    || record.receiptRecordSha256 !== receipt.receiptRecordSha256) {
    throw new Error("REWARD_ROLLBACK_ANCHOR_CURSOR_RECEIPT_BINDING_MISMATCH");
  }
  const expectedSha256 = sha256Canonical(
    "iat-b3-reward-rollback-anchor-durable-cursor/v1",
    recordWithoutDigest(record, CURSOR_RECORD_KEYS, "cursorSha256"),
  );
  if (record.cursorSha256 !== expectedSha256) {
    throw new Error("REWARD_ROLLBACK_ANCHOR_CURSOR_DIGEST_MISMATCH");
  }
  return record;
}

export function validateRewardRollbackAnchorDurableReceiptRecord(
  record,
  previous = null,
  configuration,
) {
  if (!configuration || !isPlainRecord(configuration)) {
    throw new TypeError("durable receipt validation requires a mirror configuration");
  }
  return validateReceiptRecord(record, previous, configuration);
}

export function validateRewardRollbackAnchorCursorRecord(
  record,
  previous,
  receipt,
) {
  return validateCursorRecord(record, previous, receipt);
}

function createReceiptRecord(receipt, previous, configuration) {
  validateRewardRollbackAnchorVerificationReceipt(receipt);
  const anchorStateAfter = receipt.anchorStateAfter;
  const providerStateAfter = receipt.providerStateAfter;
  const withoutDigest = {
    schema: REWARD_ROLLBACK_ANCHOR_RECEIPT_RECORD_SCHEMA,
    status: REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS,
    anchorNamespaceSha256: receipt.anchorNamespaceSha256,
    persistenceIdentitySha256: receipt.persistenceIdentitySha256,
    providerTrustBindingSha256: receipt.providerTrustBindingSha256,
    providerTrustRootSha256: receipt.providerTrustRootSha256,
    providerKeyRegistrySnapshotSha256: receipt.providerKeyRegistrySnapshotSha256,
    anchorSequence: receipt.anchorSequence,
    anchorSha256: receipt.anchorSha256,
    previousAnchorSha256: previous?.anchorSha256 ?? ZERO_SHA256,
    anchorStateBeforeSha256: receipt.anchorStateBeforeSha256,
    anchorStateAfterSha256: anchorStateAfter.stateSha256,
    checkpointRevision: receipt.checkpointRevision,
    checkpointSha256: receipt.checkpointSha256,
    previousCheckpointSha256: previous?.checkpointSha256 ?? ZERO_SHA256,
    casCommitSequence: receipt.casCommitSequence,
    casHeadCommitSha256: receipt.casHeadCommitSha256,
    providerEnvelopeSequence: receipt.providerEnvelopeSequence,
    providerEnvelopeSha256: receipt.providerEnvelopeSha256,
    providerStateBeforeSha256: receipt.providerStateBeforeSha256,
    providerStateAfterSha256: providerStateAfter.stateSha256,
    sourceVerificationReceiptSha256: receipt.verificationReceiptSha256,
    durableLocalMirrorVerified: true,
    cursorReceiptAtomicityVerified: true,
    providerAuthenticationVerified: false,
    externalProviderDurabilityVerified: false,
    externalMonotonicityVerified: false,
    independentRollbackProtectionVerified: false,
    runtimeIntegrationVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS,
  };
  const record = Object.freeze({
    ...withoutDigest,
    receiptRecordSha256: sha256Canonical(
      "iat-b3-reward-rollback-anchor-durable-receipt/v1",
      withoutDigest,
    ),
  });
  validateReceiptRecord(record, previous, configuration);
  return record;
}

function createCursorRecord(receiptRecord, previous) {
  const withoutDigest = {
    schema: REWARD_ROLLBACK_ANCHOR_CURSOR_RECORD_SCHEMA,
    status: REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS,
    anchorSequence: receiptRecord.anchorSequence,
    anchorSha256: receiptRecord.anchorSha256,
    checkpointRevision: receiptRecord.checkpointRevision,
    checkpointSha256: receiptRecord.checkpointSha256,
    providerEnvelopeSequence: receiptRecord.providerEnvelopeSequence,
    providerEnvelopeSha256: receiptRecord.providerEnvelopeSha256,
    providerTrustRootSha256: receiptRecord.providerTrustRootSha256,
    receiptRecordSha256: receiptRecord.receiptRecordSha256,
    previousCursorSha256: previous?.cursorSha256 ?? ZERO_SHA256,
    durableLocalMirrorVerified: true,
    cursorReceiptAtomicityVerified: true,
    providerAuthenticationVerified: false,
    externalProviderDurabilityVerified: false,
    externalMonotonicityVerified: false,
    independentRollbackProtectionVerified: false,
    runtimeIntegrationVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS,
  };
  const record = Object.freeze({
    ...withoutDigest,
    cursorSha256: sha256Canonical(
      "iat-b3-reward-rollback-anchor-durable-cursor/v1",
      withoutDigest,
    ),
  });
  validateCursorRecord(record, previous, receiptRecord);
  return record;
}

function pragmaScalar(database, pragma) {
  const row = database.prepare(`PRAGMA ${pragma}`).get();
  return row ? Object.values(row)[0] : undefined;
}

function configureDatabase(database, busyTimeoutMs) {
  // Node 24.4 is the first pinned runtime for this prerequisite and does not
  // expose sqlite3_db_config(SQLITE_DBCONFIG_DEFENSIVE). Keep extensions
  // disabled at construction and rely on the exact schema, append-only
  // triggers, strict tables, and complete validation on every operation.
  // A later runtime may expose defensive mode; enabling it is additive and
  // must never be used as a claimed production boundary here.
  if (typeof database.enableDefensive === "function") database.enableDefensive(true);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA recursive_triggers = ON");
  database.exec("PRAGMA trusted_schema = OFF");
  database.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
  if (String(pragmaScalar(database, "journal_mode = WAL")).toLowerCase() !== "wal") {
    throw new Error("REWARD_ROLLBACK_ANCHOR_WAL_REQUIRED");
  }
  database.exec("PRAGMA synchronous = FULL");
  if (Number(pragmaScalar(database, "foreign_keys")) !== 1
    || Number(pragmaScalar(database, "recursive_triggers")) !== 1
    || Number(pragmaScalar(database, "trusted_schema")) !== 0
    || Number(pragmaScalar(database, "synchronous")) !== 2) {
    throw new Error("REWARD_ROLLBACK_ANCHOR_REQUIRED_PRAGMA_NOT_ACTIVE");
  }
}

function userSchemaRows(database) {
  return database.prepare(`
    SELECT type, name, tbl_name, sql
    FROM sqlite_schema
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY type, name
  `).all();
}

function validateSchema(database) {
  const actual = userSchemaRows(database);
  if (actual.length !== SCHEMA_OBJECTS.length) {
    throw new Error("REWARD_ROLLBACK_ANCHOR_SCHEMA_OBJECT_SET_MISMATCH");
  }
  const expectedByKey = new Map(SCHEMA_OBJECTS.map((entry) => [
    `${entry.type}|${entry.name}`,
    entry,
  ]));
  const normalized = actual.map((row) => {
    const expected = expectedByKey.get(`${row.type}|${row.name}`);
    if (!expected
      || row.tbl_name !== expected.tableName
      || normalizeSql(row.sql ?? "") !== normalizeSql(expected.sql)) {
      throw new Error("REWARD_ROLLBACK_ANCHOR_SCHEMA_DEFINITION_MISMATCH");
    }
    return { type: row.type, name: row.name, tableName: row.tbl_name, sql: row.sql };
  });
  if (schemaManifestSha256(normalized)
    !== REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_MANIFEST_SHA256) {
    throw new Error("REWARD_ROLLBACK_ANCHOR_SCHEMA_MANIFEST_MISMATCH");
  }
}

function assertDatabaseIntegrity(database) {
  const rows = database.prepare("PRAGMA integrity_check").all();
  if (rows.length !== 1 || String(Object.values(rows[0])[0]).toLowerCase() !== "ok") {
    throw new Error("REWARD_ROLLBACK_ANCHOR_INTEGRITY_CHECK_FAILED");
  }
  if (database.prepare("PRAGMA foreign_key_check").all().length !== 0) {
    throw new Error("REWARD_ROLLBACK_ANCHOR_FOREIGN_KEY_CHECK_FAILED");
  }
}

function validateMeta(database, configuration) {
  const rows = database.prepare("SELECT * FROM reward_rollback_anchor_meta").all();
  if (rows.length !== 1) throw new Error("REWARD_ROLLBACK_ANCHOR_META_SINGLETON_REQUIRED");
  const [row] = rows;
  if (row.singleton_id !== 1
    || row.adapter_schema !== REWARD_ROLLBACK_ANCHOR_SQLITE_ADAPTER_SCHEMA
    || row.schema_version !== REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_VERSION
    || row.adapter_status !== REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS
    || row.schema_manifest_sha256 !== REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_MANIFEST_SHA256
    || row.anchor_namespace_sha256 !== configuration.anchorNamespaceSha256
    || row.persistence_identity_sha256 !== configuration.persistenceIdentitySha256
    || row.provider_trust_binding_sha256 !== configuration.providerTrustBindingSha256
    || row.provider_trust_root_sha256 !== configuration.providerTrustRootSha256
    || row.provider_key_registry_snapshot_sha256
      !== configuration.providerKeyRegistrySnapshotSha256
    || row.genesis_anchor_state_sha256 !== configuration.genesisAnchorStateSha256
    || row.genesis_provider_state_sha256 !== configuration.genesisProviderStateSha256
    || row.durable_local_mirror_verified !== 1
    || row.cursor_receipt_atomicity_verified !== 1
    || row.local_rollback_comparison_verified !== 1
    || row.provider_authentication_verified !== 0
    || row.external_provider_durability_verified !== 0
    || row.external_monotonicity_verified !== 0
    || row.independent_rollback_protection_verified !== 0
    || row.runtime_integration_verified !== 0
    || row.activation_ready !== 0
    || row.mainnet_status !== REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS) {
    throw new Error("REWARD_ROLLBACK_ANCHOR_META_MISMATCH");
  }
}

function validateReceiptRow(row, record) {
  if (u64FromBe(row.anchor_sequence_be, "receipt anchor sequence") !== BigInt(record.anchorSequence)
    || row.anchor_sequence_text !== record.anchorSequence
    || row.anchor_sha256 !== record.anchorSha256
    || row.previous_anchor_sha256 !== record.previousAnchorSha256
    || row.anchor_state_before_sha256 !== record.anchorStateBeforeSha256
    || row.anchor_state_after_sha256 !== record.anchorStateAfterSha256
    || u64FromBe(row.checkpoint_revision_be, "receipt checkpoint revision")
      !== BigInt(record.checkpointRevision)
    || row.checkpoint_revision_text !== record.checkpointRevision
    || row.checkpoint_sha256 !== record.checkpointSha256
    || row.previous_checkpoint_sha256 !== record.previousCheckpointSha256
    || u64FromBe(row.cas_commit_sequence_be, "receipt commit sequence")
      !== BigInt(record.casCommitSequence)
    || row.cas_commit_sequence_text !== record.casCommitSequence
    || row.cas_head_commit_sha256 !== record.casHeadCommitSha256
    || u64FromBe(row.provider_envelope_sequence_be, "receipt provider sequence")
      !== BigInt(record.providerEnvelopeSequence)
    || row.provider_envelope_sequence_text !== record.providerEnvelopeSequence
    || row.provider_envelope_sha256 !== record.providerEnvelopeSha256
    || row.provider_state_before_sha256 !== record.providerStateBeforeSha256
    || row.provider_state_after_sha256 !== record.providerStateAfterSha256
    || row.source_verification_receipt_sha256 !== record.sourceVerificationReceiptSha256
    || row.receipt_record_sha256 !== record.receiptRecordSha256
    || row.status !== REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS
    || row.durable_local_mirror_verified !== 1
    || row.cursor_receipt_atomicity_verified !== 1
    || row.provider_authentication_verified !== 0
    || row.external_provider_durability_verified !== 0
    || row.external_monotonicity_verified !== 0
    || row.independent_rollback_protection_verified !== 0
    || row.runtime_integration_verified !== 0
    || row.activation_ready !== 0
    || row.mainnet_status !== REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS) {
    throw new Error("REWARD_ROLLBACK_ANCHOR_RECEIPT_ROW_BINDING_MISMATCH");
  }
}

function validateCursorRow(row, record) {
  if (u64FromBe(row.cursor_revision_be, "anchor cursor revision")
      !== BigInt(record.anchorSequence)
    || row.cursor_revision_text !== record.anchorSequence
    || u64FromBe(row.anchor_sequence_be, "cursor anchor sequence")
      !== BigInt(record.anchorSequence)
    || row.anchor_sequence_text !== record.anchorSequence
    || row.anchor_sha256 !== record.anchorSha256
    || row.checkpoint_sha256 !== record.checkpointSha256
    || row.provider_envelope_sha256 !== record.providerEnvelopeSha256
    || row.provider_trust_root_sha256 !== record.providerTrustRootSha256
    || row.receipt_record_sha256 !== record.receiptRecordSha256
    || row.previous_cursor_sha256 !== record.previousCursorSha256
    || row.cursor_sha256 !== record.cursorSha256
    || row.status !== REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS
    || row.durable_local_mirror_verified !== 1
    || row.cursor_receipt_atomicity_verified !== 1
    || row.provider_authentication_verified !== 0
    || row.external_provider_durability_verified !== 0
    || row.external_monotonicity_verified !== 0
    || row.independent_rollback_protection_verified !== 0
    || row.runtime_integration_verified !== 0
    || row.activation_ready !== 0
    || row.mainnet_status !== REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS) {
    throw new Error("REWARD_ROLLBACK_ANCHOR_CURSOR_ROW_BINDING_MISMATCH");
  }
}

function validateHistory(database, configuration) {
  const receiptRows = database.prepare(`
    SELECT * FROM reward_rollback_anchor_receipts
    ORDER BY anchor_sequence_be
  `).all();
  const cursorRows = database.prepare(`
    SELECT * FROM reward_rollback_anchor_cursors
    ORDER BY cursor_revision_be
  `).all();
  if (receiptRows.length !== cursorRows.length) {
    throw new Error("REWARD_ROLLBACK_ANCHOR_CURSOR_RECEIPT_SET_INCOMPLETE");
  }
  const receipts = [];
  const cursors = [];
  let previousReceipt = null;
  let previousCursor = null;
  for (let index = 0; index < receiptRows.length; index += 1) {
    const receipt = decodeRecord(
      receiptRows[index].record_blob,
      RECEIPT_RECORD_KEYS,
      "REWARD_ROLLBACK_ANCHOR_RECEIPT",
    );
    validateReceiptRecord(receipt, previousReceipt, configuration);
    validateReceiptRow(receiptRows[index], receipt);
    const cursor = decodeRecord(
      cursorRows[index].record_blob,
      CURSOR_RECORD_KEYS,
      "REWARD_ROLLBACK_ANCHOR_CURSOR",
    );
    validateCursorRecord(cursor, previousCursor, receipt);
    validateCursorRow(cursorRows[index], cursor);
    receipts.push(Object.freeze(receipt));
    cursors.push(Object.freeze(cursor));
    previousReceipt = receipt;
    previousCursor = cursor;
  }
  return {
    receipts: Object.freeze(receipts),
    cursors: Object.freeze(cursors),
    currentReceipt: previousReceipt,
    currentCursor: previousCursor,
  };
}

function validateDatabase(database, configuration) {
  validateSchema(database);
  validateMeta(database, configuration);
  assertDatabaseIntegrity(database);
  return validateHistory(database, configuration);
}

function initializeDatabase(database, configuration) {
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const { sql } of SCHEMA_OBJECTS) database.exec(sql);
    database.prepare(`
      INSERT INTO reward_rollback_anchor_meta (
        singleton_id, adapter_schema, schema_version, adapter_status,
        schema_manifest_sha256, anchor_namespace_sha256,
        persistence_identity_sha256, provider_trust_binding_sha256,
        provider_trust_root_sha256, provider_key_registry_snapshot_sha256,
        genesis_anchor_state_sha256, genesis_provider_state_sha256,
        durable_local_mirror_verified, cursor_receipt_atomicity_verified,
        local_rollback_comparison_verified, provider_authentication_verified,
        external_provider_durability_verified, external_monotonicity_verified,
        independent_rollback_protection_verified, runtime_integration_verified,
        activation_ready, mainnet_status
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 1, 0, 0, 0, 0, 0, 0, ?)
    `).run(
      REWARD_ROLLBACK_ANCHOR_SQLITE_ADAPTER_SCHEMA,
      REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_VERSION,
      REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS,
      REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_MANIFEST_SHA256,
      configuration.anchorNamespaceSha256,
      configuration.persistenceIdentitySha256,
      configuration.providerTrustBindingSha256,
      configuration.providerTrustRootSha256,
      configuration.providerKeyRegistrySnapshotSha256,
      configuration.genesisAnchorStateSha256,
      configuration.genesisProviderStateSha256,
      REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS,
    );
    validateDatabase(database, configuration);
    database.exec("COMMIT");
  } catch (error) {
    try {
      database.exec("ROLLBACK");
    } catch {
      // Preserve the first initialization failure.
    }
    throw error;
  }
}

function insertReceipt(database, record) {
  database.prepare(`
    INSERT INTO reward_rollback_anchor_receipts (
      anchor_sequence_be, anchor_sequence_text, anchor_sha256,
      previous_anchor_sha256, anchor_state_before_sha256,
      anchor_state_after_sha256, checkpoint_revision_be,
      checkpoint_revision_text, checkpoint_sha256,
      previous_checkpoint_sha256, cas_commit_sequence_be,
      cas_commit_sequence_text, cas_head_commit_sha256,
      provider_envelope_sequence_be, provider_envelope_sequence_text,
      provider_envelope_sha256, provider_state_before_sha256,
      provider_state_after_sha256, source_verification_receipt_sha256,
      receipt_record_sha256, record_blob, status,
      durable_local_mirror_verified, cursor_receipt_atomicity_verified,
      provider_authentication_verified, external_provider_durability_verified,
      external_monotonicity_verified, independent_rollback_protection_verified,
      runtime_integration_verified, activation_ready, mainnet_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      1, 1, 0, 0, 0, 0, 0, 0, ?)
  `).run(
    u64Be(record.anchorSequence, "anchor sequence"),
    record.anchorSequence,
    record.anchorSha256,
    record.previousAnchorSha256,
    record.anchorStateBeforeSha256,
    record.anchorStateAfterSha256,
    u64Be(record.checkpointRevision, "checkpoint revision"),
    record.checkpointRevision,
    record.checkpointSha256,
    record.previousCheckpointSha256,
    u64Be(record.casCommitSequence, "commit sequence"),
    record.casCommitSequence,
    record.casHeadCommitSha256,
    u64Be(record.providerEnvelopeSequence, "provider envelope sequence"),
    record.providerEnvelopeSequence,
    record.providerEnvelopeSha256,
    record.providerStateBeforeSha256,
    record.providerStateAfterSha256,
    record.sourceVerificationReceiptSha256,
    record.receiptRecordSha256,
    encodeRecord(record, RECEIPT_RECORD_KEYS),
    REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS,
    REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS,
  );
}

function insertCursor(database, record) {
  database.prepare(`
    INSERT INTO reward_rollback_anchor_cursors (
      cursor_revision_be, cursor_revision_text,
      anchor_sequence_be, anchor_sequence_text, anchor_sha256,
      checkpoint_sha256, provider_envelope_sha256,
      provider_trust_root_sha256, receipt_record_sha256,
      previous_cursor_sha256, cursor_sha256, record_blob, status,
      durable_local_mirror_verified, cursor_receipt_atomicity_verified,
      provider_authentication_verified, external_provider_durability_verified,
      external_monotonicity_verified, independent_rollback_protection_verified,
      runtime_integration_verified, activation_ready, mainnet_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 0, 0, 0, 0, 0, ?)
  `).run(
    u64Be(record.anchorSequence, "cursor revision"),
    record.anchorSequence,
    u64Be(record.anchorSequence, "cursor anchor sequence"),
    record.anchorSequence,
    record.anchorSha256,
    record.checkpointSha256,
    record.providerEnvelopeSha256,
    record.providerTrustRootSha256,
    record.receiptRecordSha256,
    record.previousCursorSha256,
    record.cursorSha256,
    encodeRecord(record, CURSOR_RECORD_KEYS),
    REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS,
    REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS,
  );
}

function storeTruth() {
  return {
    durableLocalMirrorVerified: true,
    cursorReceiptAtomicityVerified: true,
    localRollbackComparisonVerified: true,
    providerAuthenticationVerified: false,
    externalProviderDurabilityVerified: false,
    externalMonotonicityVerified: false,
    independentRollbackProtectionVerified: false,
    runtimeIntegrationVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS,
  };
}

/**
 * Require a rollback-anchor mirror created by this exact loaded module
 * instance. The process-private WeakSet check performs no candidate property
 * reads and therefore rejects clones, aliases, proxies, and accessor fakes.
 */
export function assertSqliteRewardRollbackAnchorMirrorAdapter(value) {
  if ((typeof value !== "object" && typeof value !== "function")
    || value === null
    || !SQLITE_REWARD_ROLLBACK_ANCHOR_MIRROR_ADAPTERS.has(value)) {
    throw new TypeError("reward rollback anchor mirror requires its process-branded SQLite adapter");
  }
  return value;
}

export function createSqliteRewardRollbackAnchorMirror(options = {}) {
  if (!isPlainRecord(options)) {
    throw new TypeError("reward rollback anchor mirror options must be a plain record");
  }
  const allowedKeys = new Set([
    "databasePath",
    "trustBinding",
    "genesisAnchorState",
    "genesisProviderState",
    "busyTimeoutMs",
    "testOnlyFault",
  ]);
  const optionKeys = Reflect.ownKeys(options);
  if (optionKeys.some((key) => typeof key !== "string" || !allowedKeys.has(key))) {
    throw new TypeError("reward rollback anchor mirror options contain an unknown field");
  }
  for (const key of optionKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(options, key);
    if (!descriptor
      || descriptor.enumerable !== true
      || !Object.hasOwn(descriptor, "value")
      || Object.hasOwn(descriptor, "get")
      || Object.hasOwn(descriptor, "set")) {
      throw new TypeError("reward rollback anchor mirror options must be data fields");
    }
  }
  for (const key of [
    "databasePath",
    "trustBinding",
    "genesisAnchorState",
    "genesisProviderState",
  ]) {
    if (!Object.hasOwn(options, key)) {
      throw new TypeError(`reward rollback anchor mirror requires ${key}`);
    }
  }
  const databasePath = options.databasePath;
  const busyTimeoutMs = options.busyTimeoutMs ?? 0;
  const testOnlyFault = options.testOnlyFault ?? null;
  if (typeof databasePath !== "string"
    || databasePath.length === 0
    || databasePath === ":memory:") {
    throw new TypeError("reward rollback anchor mirror requires a file-backed databasePath");
  }
  if (!Number.isSafeInteger(busyTimeoutMs)
    || busyTimeoutMs < 0
    || busyTimeoutMs > 60_000) {
    throw new RangeError("reward rollback anchor mirror busyTimeoutMs must be 0 through 60000");
  }
  if (!ACCEPTED_FAULTS.has(testOnlyFault)) {
    throw new Error("UNKNOWN_TEST_ONLY_REWARD_ROLLBACK_ANCHOR_SQLITE_FAULT");
  }
  const configuration = createConfiguration(
    options.trustBinding,
    options.genesisAnchorState,
    options.genesisProviderState,
  );
  const database = new DatabaseSync(databasePath, {
    allowExtension: false,
    enableForeignKeyConstraints: true,
    enableDoubleQuotedStringLiterals: false,
    timeout: busyTimeoutMs,
    readBigInts: false,
    returnArrays: false,
    allowBareNamedParameters: false,
    allowUnknownNamedParameters: false,
  });
  let closed = false;
  const ensureOpen = () => {
    if (closed) throw new Error("REWARD_ROLLBACK_ANCHOR_MIRROR_CLOSED");
  };
  const fault = (point) => {
    let hardExitPoint = null;
    if (point === REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT.AFTER_RECEIPT_INSERT) {
      hardExitPoint = REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT
        .HARD_EXIT_AFTER_RECEIPT_INSERT;
    } else if (point === REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT.AFTER_DURABLE_COMMIT) {
      hardExitPoint = REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT
        .HARD_EXIT_AFTER_DURABLE_COMMIT;
    }
    if (hardExitPoint !== null && testOnlyFault === hardExitPoint) process.exit(86);
    if (testOnlyFault === point) {
      throw new Error(`TEST_ONLY_REWARD_ROLLBACK_ANCHOR_SQLITE_FAULT_${point}`);
    }
  };
  try {
    configureDatabase(database, busyTimeoutMs);
    if (userSchemaRows(database).length === 0) initializeDatabase(database, configuration);
    else validateDatabase(database, configuration);
  } catch (error) {
    database.close();
    closed = true;
    throw error;
  }

  const store = {
    adapterSchema: REWARD_ROLLBACK_ANCHOR_SQLITE_ADAPTER_SCHEMA,
    schemaVersion: REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_VERSION,
    schemaManifestSha256: REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_MANIFEST_SHA256,
    status: REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS,
    ...storeTruth(),
    readHead() {
      ensureOpen();
      const { currentReceipt, currentCursor } = validateDatabase(database, configuration);
      return Object.freeze({
        anchorSequence: currentReceipt?.anchorSequence ?? "0",
        anchorSha256: currentReceipt?.anchorSha256 ?? ZERO_SHA256,
        checkpointRevision: currentReceipt?.checkpointRevision ?? "0",
        checkpointSha256: currentReceipt?.checkpointSha256 ?? ZERO_SHA256,
        providerEnvelopeSequence: currentReceipt?.providerEnvelopeSequence ?? "0",
        providerEnvelopeSha256: currentReceipt?.providerEnvelopeSha256 ?? ZERO_SHA256,
        anchorStateSha256:
          currentReceipt?.anchorStateAfterSha256 ?? configuration.genesisAnchorStateSha256,
        providerStateSha256:
          currentReceipt?.providerStateAfterSha256 ?? configuration.genesisProviderStateSha256,
        cursorSha256: currentCursor?.cursorSha256 ?? ZERO_SHA256,
        ...storeTruth(),
      });
    },
    snapshot() {
      ensureOpen();
      const history = validateDatabase(database, configuration);
      return Object.freeze({
        schema: REWARD_ROLLBACK_ANCHOR_SQLITE_ADAPTER_SCHEMA,
        schemaVersion: REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_VERSION,
        schemaManifestSha256: REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_MANIFEST_SHA256,
        receipts: Object.freeze(history.receipts.map(freezeClone)),
        cursors: Object.freeze(history.cursors.map(freezeClone)),
        ...storeTruth(),
      });
    },
    consumeSignedAnchorReceipt(input) {
      const values = exactDataValues(
        input,
        ["receipt"],
        "reward rollback anchor mirror consume input must contain only receipt",
      );
      const receipt = validateRewardRollbackAnchorVerificationReceipt(values.receipt);
      ensureOpen();
      database.exec("BEGIN IMMEDIATE");
      try {
        const history = validateDatabase(database, configuration);
        const currentReceipt = history.currentReceipt;
        const currentCursor = history.currentCursor;
        if (currentReceipt && receipt.anchorSequence === currentReceipt.anchorSequence) {
          if (receipt.anchorSha256 !== currentReceipt.anchorSha256
            || receipt.verificationReceiptSha256
              !== currentReceipt.sourceVerificationReceiptSha256) {
            throw new Error("REWARD_ROLLBACK_ANCHOR_MIRROR_SAME_SEQUENCE_FORK");
          }
          database.exec("COMMIT");
          return Object.freeze({
            disposition: REWARD_ROLLBACK_ANCHOR_SQLITE_DISPOSITION.ALREADY_CURRENT,
            receiptRecord: freezeClone(currentReceipt),
            cursor: freezeClone(currentCursor),
            ...storeTruth(),
          });
        }
        const receiptSequence = BigInt(receipt.anchorSequence);
        const currentSequence = BigInt(currentReceipt?.anchorSequence ?? "0");
        if (receiptSequence <= currentSequence) {
          throw new Error("REWARD_ROLLBACK_ANCHOR_MIRROR_REPLAY_OR_ROLLBACK");
        }
        if (receiptSequence !== currentSequence + 1n) {
          throw new Error("REWARD_ROLLBACK_ANCHOR_MIRROR_SKIP_FORBIDDEN");
        }
        const receiptRecord = createReceiptRecord(receipt, currentReceipt, configuration);
        const cursor = createCursorRecord(receiptRecord, currentCursor);
        insertReceipt(database, receiptRecord);
        fault(REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT.AFTER_RECEIPT_INSERT);
        insertCursor(database, cursor);
        fault(REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT.AFTER_CURSOR_INSERT);
        validateDatabase(database, configuration);
        database.exec("COMMIT");
        fault(REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT.AFTER_DURABLE_COMMIT);
        return Object.freeze({
          disposition: REWARD_ROLLBACK_ANCHOR_SQLITE_DISPOSITION.COMMITTED,
          receiptRecord: freezeClone(receiptRecord),
          cursor: freezeClone(cursor),
          ...storeTruth(),
        });
      } catch (error) {
        try {
          database.exec("ROLLBACK");
        } catch {
          // Preserve the first transaction or post-commit uncertainty failure.
        }
        throw error;
      }
    },
    compareWithSuppliedAnchorState(candidateState) {
      ensureOpen();
      const supplied = validateRewardRollbackAnchorState(candidateState);
      if (supplied.anchorNamespaceSha256 !== configuration.anchorNamespaceSha256
        || supplied.persistenceIdentitySha256 !== configuration.persistenceIdentitySha256
        || supplied.providerTrustBindingSha256 !== configuration.providerTrustBindingSha256
        || supplied.providerTrustRootSha256 !== configuration.providerTrustRootSha256
        || supplied.providerKeyRegistrySnapshotSha256
          !== configuration.providerKeyRegistrySnapshotSha256) {
        throw new Error("REWARD_ROLLBACK_ANCHOR_SUPPLIED_STATE_TRUST_MISMATCH");
      }
      const { currentReceipt } = validateDatabase(database, configuration);
      const localSequence = BigInt(currentReceipt?.anchorSequence ?? "0");
      const suppliedSequence = BigInt(supplied.lastAnchorSequence);
      const localAnchorSha256 = currentReceipt?.anchorSha256 ?? ZERO_SHA256;
      const localStateSha256 = currentReceipt?.anchorStateAfterSha256
        ?? configuration.genesisAnchorStateSha256;
      let relationship;
      let localRollbackSignalDetected = false;
      if (localSequence < suppliedSequence) {
        relationship = REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP.LOCAL_BEHIND;
        localRollbackSignalDetected = true;
      } else if (localSequence > suppliedSequence) {
        relationship = REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP.LOCAL_AHEAD;
      } else if (localAnchorSha256 !== supplied.lastAnchorSha256
        || localStateSha256 !== supplied.stateSha256) {
        relationship = REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP.SAME_SEQUENCE_FORK;
        localRollbackSignalDetected = true;
      } else {
        relationship = REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP.EXACT;
      }
      return Object.freeze({
        relationship,
        localAnchorSequence: localSequence.toString(),
        suppliedAnchorSequence: suppliedSequence.toString(),
        localAnchorSha256,
        suppliedAnchorSha256: supplied.lastAnchorSha256,
        localRollbackSignalDetected,
        suppliedStateAuthenticityVerified: false,
        ...storeTruth(),
      });
    },
    close() {
      if (!closed) {
        database.close();
        closed = true;
      }
    },
  };
  const frozen = Object.freeze(store);
  SQLITE_REWARD_ROLLBACK_ANCHOR_MIRROR_ADAPTERS.add(frozen);
  return frozen;
}

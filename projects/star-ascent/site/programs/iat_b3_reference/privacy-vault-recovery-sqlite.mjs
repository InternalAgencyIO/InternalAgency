import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  PRIVACY_VAULT_RECOVERY_MAINNET_STATUS,
  validatePrivacyVaultRecoveryBundle,
  validatePrivacyVaultRecoveryState,
  validatePrivacyVaultRecoveryVerificationReceipt,
} from "./privacy-vault-recovery-lifecycle.mjs";

export const PRIVACY_VAULT_RECOVERY_SQLITE_ADAPTER_SCHEMA =
  "iat-b3-privacy-vault-recovery-sqlite-adapter/v1";
export const PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_VERSION = 1;
export const PRIVACY_VAULT_RECOVERY_SQLITE_STATUS =
  "HOST_ONLY_NON_ACTIVATING_DURABLE_LOCAL_RECOVERY_MIRROR";
export const PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS =
  PRIVACY_VAULT_RECOVERY_MAINNET_STATUS;
export const PRIVACY_VAULT_RECOVERY_SQLITE_BUNDLE_RECORD_SCHEMA =
  "iat-b3-privacy-vault-recovery-sqlite-bundle-record/v1";
export const PRIVACY_VAULT_RECOVERY_SQLITE_CURSOR_RECORD_SCHEMA =
  "iat-b3-privacy-vault-recovery-sqlite-cursor-record/v1";
export const PRIVACY_VAULT_RECOVERY_SQLITE_SNAPSHOT_SCHEMA =
  "iat-b3-privacy-vault-recovery-sqlite-snapshot/v1";
export const PRIVACY_VAULT_RECOVERY_SQLITE_COMMIT_RESULT_SCHEMA =
  "iat-b3-privacy-vault-recovery-sqlite-commit-result/v1";
export const PRIVACY_VAULT_RECOVERY_SQLITE_COMPARISON_SCHEMA =
  "iat-b3-privacy-vault-recovery-sqlite-comparison/v1";

export const PRIVACY_VAULT_RECOVERY_SQLITE_DISPOSITION = Object.freeze({
  COMMITTED: "COMMITTED",
  RECONCILED_EXACT_REPLAY: "RECONCILED_EXACT_REPLAY",
});

export const PRIVACY_VAULT_RECOVERY_SQLITE_RELATIONSHIP = Object.freeze({
  EXACT: "EXACT",
  LOCAL_AHEAD: "LOCAL_AHEAD",
  LOCAL_BEHIND: "LOCAL_BEHIND",
  SAME_EPOCH_FORK: "SAME_EPOCH_FORK",
});

export const PRIVACY_VAULT_RECOVERY_SQLITE_TEST_FAULT = Object.freeze({
  AFTER_BUNDLE_INSERT: "AFTER_BUNDLE_INSERT",
  AFTER_CURSOR_INSERT: "AFTER_CURSOR_INSERT",
  AFTER_COMMIT_BEFORE_RETURN: "AFTER_COMMIT_BEFORE_RETURN",
});

const ZERO_SHA256 = "0".repeat(64);
const U64_MAX = (1n << 64n) - 1n;
const ADAPTERS = new WeakSet();

const COMMIT_INPUT_KEYS = Object.freeze([
  "bundle",
  "verificationReceipt",
  "testFault",
]);

const CREATE_INPUT_KEYS = Object.freeze([
  "databasePath",
  "genesisState",
]);

function hexCheck(column) {
  return `typeof(${column}) = 'text' AND length(${column}) = 64 AND lower(${column}) = ${column} AND ${column} NOT GLOB '*[^0-9a-f]*'`;
}

function positiveDecimalCheck(column) {
  return `typeof(${column}) = 'text'
    AND length(${column}) BETWEEN 1 AND 20
    AND ${column} NOT GLOB '*[^0-9]*'
    AND substr(${column}, 1, 1) BETWEEN '1' AND '9'`;
}

const TABLE_SQL = Object.freeze({
  privacy_vault_recovery_meta: `CREATE TABLE privacy_vault_recovery_meta (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    adapter_schema TEXT NOT NULL CHECK (adapter_schema = '${PRIVACY_VAULT_RECOVERY_SQLITE_ADAPTER_SCHEMA}'),
    schema_version INTEGER NOT NULL CHECK (schema_version = ${PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_VERSION}),
    schema_manifest_sha256 TEXT NOT NULL CHECK (${hexCheck("schema_manifest_sha256")}),
    vault_binding_sha256 TEXT NOT NULL CHECK (${hexCheck("vault_binding_sha256")}),
    recovery_key_commitment_sha256 TEXT NOT NULL CHECK (${hexCheck("recovery_key_commitment_sha256")}),
    maximum_bundle_age_seconds TEXT NOT NULL CHECK (${positiveDecimalCheck("maximum_bundle_age_seconds")}),
    maximum_future_skew_seconds TEXT NOT NULL CHECK (
      typeof(maximum_future_skew_seconds) = 'text'
      AND length(maximum_future_skew_seconds) BETWEEN 1 AND 20
      AND maximum_future_skew_seconds NOT GLOB '*[^0-9]*'
      AND (maximum_future_skew_seconds = '0' OR substr(maximum_future_skew_seconds, 1, 1) BETWEEN '1' AND '9')
    ),
    genesis_state_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("genesis_state_sha256")}),
    genesis_state_json TEXT NOT NULL,
    local_bundle_cursor_atomicity_verified INTEGER NOT NULL CHECK (local_bundle_cursor_atomicity_verified = 1),
    process_private_receipt_required INTEGER NOT NULL CHECK (process_private_receipt_required = 1),
    durable_local_sqlite_reopen_verified INTEGER NOT NULL CHECK (durable_local_sqlite_reopen_verified = 1),
    external_writer_confinement_verified INTEGER NOT NULL CHECK (external_writer_confinement_verified = 0),
    supplied_state_authenticity_verified INTEGER NOT NULL CHECK (supplied_state_authenticity_verified = 0),
    external_rollback_protection_verified INTEGER NOT NULL CHECK (external_rollback_protection_verified = 0),
    secure_platform_keystore_verified INTEGER NOT NULL CHECK (secure_platform_keystore_verified = 0),
    authenticated_chain_observation_verified INTEGER NOT NULL CHECK (authenticated_chain_observation_verified = 0),
    onchain_runtime_integration_verified INTEGER NOT NULL CHECK (onchain_runtime_integration_verified = 0),
    privacy_legal_review_accepted INTEGER NOT NULL CHECK (privacy_legal_review_accepted = 0),
    devnet_lifecycle_verified INTEGER NOT NULL CHECK (devnet_lifecycle_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS}')
  ) STRICT, WITHOUT ROWID`,
  privacy_vault_recovery_bundle_records: `CREATE TABLE privacy_vault_recovery_bundle_records (
    epoch_be BLOB PRIMARY KEY CHECK (typeof(epoch_be) = 'blob' AND length(epoch_be) = 8),
    epoch_text TEXT NOT NULL UNIQUE CHECK (${positiveDecimalCheck("epoch_text")}),
    bundle_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("bundle_sha256")}),
    previous_bundle_sha256 TEXT NOT NULL CHECK (${hexCheck("previous_bundle_sha256")}),
    state_before_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("state_before_sha256")}),
    state_after_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("state_after_sha256")}),
    key_material_commitment_sha256 TEXT NOT NULL CHECK (${hexCheck("key_material_commitment_sha256")}),
    verification_receipt_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("verification_receipt_sha256")}),
    bundle_json TEXT NOT NULL,
    bundle_json_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("bundle_json_sha256")}),
    state_after_json TEXT NOT NULL,
    state_after_json_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("state_after_json_sha256")}),
    record_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("record_sha256")}),
    process_private_receipt_accepted_at_adapter_boundary INTEGER NOT NULL CHECK (process_private_receipt_accepted_at_adapter_boundary = 1),
    durable_local_bundle_record_verified INTEGER NOT NULL CHECK (durable_local_bundle_record_verified = 1),
    external_writer_confinement_verified INTEGER NOT NULL CHECK (external_writer_confinement_verified = 0),
    supplied_state_authenticity_verified INTEGER NOT NULL CHECK (supplied_state_authenticity_verified = 0),
    external_rollback_protection_verified INTEGER NOT NULL CHECK (external_rollback_protection_verified = 0),
    secure_platform_keystore_verified INTEGER NOT NULL CHECK (secure_platform_keystore_verified = 0),
    authenticated_chain_observation_verified INTEGER NOT NULL CHECK (authenticated_chain_observation_verified = 0),
    onchain_runtime_integration_verified INTEGER NOT NULL CHECK (onchain_runtime_integration_verified = 0),
    privacy_legal_review_accepted INTEGER NOT NULL CHECK (privacy_legal_review_accepted = 0),
    devnet_lifecycle_verified INTEGER NOT NULL CHECK (devnet_lifecycle_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS}')
  ) STRICT, WITHOUT ROWID`,
  privacy_vault_recovery_cursor_history: `CREATE TABLE privacy_vault_recovery_cursor_history (
    cursor_revision_be BLOB PRIMARY KEY CHECK (typeof(cursor_revision_be) = 'blob' AND length(cursor_revision_be) = 8),
    cursor_revision_text TEXT NOT NULL UNIQUE CHECK (${positiveDecimalCheck("cursor_revision_text")}),
    epoch_be BLOB NOT NULL UNIQUE CHECK (typeof(epoch_be) = 'blob' AND length(epoch_be) = 8),
    epoch_text TEXT NOT NULL UNIQUE CHECK (${positiveDecimalCheck("epoch_text")}),
    bundle_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("bundle_sha256")}),
    state_after_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("state_after_sha256")}),
    bundle_record_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("bundle_record_sha256")}),
    verification_receipt_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("verification_receipt_sha256")}),
    previous_cursor_sha256 TEXT NOT NULL CHECK (${hexCheck("previous_cursor_sha256")}),
    cursor_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("cursor_sha256")}),
    local_bundle_cursor_atomicity_verified INTEGER NOT NULL CHECK (local_bundle_cursor_atomicity_verified = 1),
    process_private_receipt_required INTEGER NOT NULL CHECK (process_private_receipt_required = 1),
    external_writer_confinement_verified INTEGER NOT NULL CHECK (external_writer_confinement_verified = 0),
    supplied_state_authenticity_verified INTEGER NOT NULL CHECK (supplied_state_authenticity_verified = 0),
    external_rollback_protection_verified INTEGER NOT NULL CHECK (external_rollback_protection_verified = 0),
    secure_platform_keystore_verified INTEGER NOT NULL CHECK (secure_platform_keystore_verified = 0),
    authenticated_chain_observation_verified INTEGER NOT NULL CHECK (authenticated_chain_observation_verified = 0),
    onchain_runtime_integration_verified INTEGER NOT NULL CHECK (onchain_runtime_integration_verified = 0),
    privacy_legal_review_accepted INTEGER NOT NULL CHECK (privacy_legal_review_accepted = 0),
    devnet_lifecycle_verified INTEGER NOT NULL CHECK (devnet_lifecycle_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS}'),
    FOREIGN KEY (epoch_be) REFERENCES privacy_vault_recovery_bundle_records(epoch_be),
    FOREIGN KEY (bundle_sha256) REFERENCES privacy_vault_recovery_bundle_records(bundle_sha256),
    FOREIGN KEY (state_after_sha256) REFERENCES privacy_vault_recovery_bundle_records(state_after_sha256),
    FOREIGN KEY (bundle_record_sha256) REFERENCES privacy_vault_recovery_bundle_records(record_sha256),
    FOREIGN KEY (verification_receipt_sha256) REFERENCES privacy_vault_recovery_bundle_records(verification_receipt_sha256)
  ) STRICT, WITHOUT ROWID`,
});

function immutableTriggerSql(table, operation) {
  return `CREATE TRIGGER ${table}_forbid_${operation.toLowerCase()}
    BEFORE ${operation} ON ${table}
    BEGIN
      SELECT RAISE(ABORT, 'PRIVACY_VAULT_RECOVERY_SQLITE_APPEND_ONLY_${operation}_FORBIDDEN');
    END`;
}

const CONFLICTING_INSERT_WHERE = Object.freeze({
  privacy_vault_recovery_meta: "singleton_id = NEW.singleton_id",
  privacy_vault_recovery_bundle_records: `
    epoch_be = NEW.epoch_be
    OR epoch_text = NEW.epoch_text
    OR bundle_sha256 = NEW.bundle_sha256
    OR state_before_sha256 = NEW.state_before_sha256
    OR state_after_sha256 = NEW.state_after_sha256
    OR verification_receipt_sha256 = NEW.verification_receipt_sha256
    OR bundle_json_sha256 = NEW.bundle_json_sha256
    OR state_after_json_sha256 = NEW.state_after_json_sha256
    OR record_sha256 = NEW.record_sha256
  `,
  privacy_vault_recovery_cursor_history: `
    cursor_revision_be = NEW.cursor_revision_be
    OR cursor_revision_text = NEW.cursor_revision_text
    OR epoch_be = NEW.epoch_be
    OR epoch_text = NEW.epoch_text
    OR bundle_sha256 = NEW.bundle_sha256
    OR state_after_sha256 = NEW.state_after_sha256
    OR bundle_record_sha256 = NEW.bundle_record_sha256
    OR verification_receipt_sha256 = NEW.verification_receipt_sha256
    OR cursor_sha256 = NEW.cursor_sha256
  `,
});

function conflictingInsertTriggerSql(table) {
  return `CREATE TRIGGER ${table}_forbid_conflicting_insert
    BEFORE INSERT ON ${table}
    WHEN EXISTS (
      SELECT 1 FROM ${table}
      WHERE ${CONFLICTING_INSERT_WHERE[table].trim()}
    )
    BEGIN
      SELECT RAISE(ABORT, 'PRIVACY_VAULT_RECOVERY_SQLITE_APPEND_ONLY_INSERT_CONFLICT_FORBIDDEN');
    END`;
}

const TABLE_NAMES = Object.freeze(Object.keys(TABLE_SQL));
const TRIGGER_SQL = Object.freeze(Object.fromEntries(TABLE_NAMES.flatMap((table) => [
  [`${table}_forbid_update`, immutableTriggerSql(table, "UPDATE")],
  [`${table}_forbid_delete`, immutableTriggerSql(table, "DELETE")],
  [`${table}_forbid_conflicting_insert`, conflictingInsertTriggerSql(table)],
])));

const SCHEMA_OBJECTS = Object.freeze([
  ...Object.entries(TABLE_SQL).map(([name, sql]) => ({ type: "table", name, sql })),
  ...Object.entries(TRIGGER_SQL).map(([name, sql]) => ({ type: "trigger", name, sql })),
]);

function normalizeSql(sql) {
  return sql.replace(/;\s*$/u, "").replace(/\s+/gu, " ").trim();
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256Canonical(domain, value) {
  return sha256Bytes(Buffer.from(JSON.stringify({ domain, value }), "utf8"));
}

export const PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_MANIFEST_SHA256 =
  sha256Canonical(
    "iat-b3-privacy-vault-recovery-sqlite-schema-manifest/v1",
    SCHEMA_OBJECTS.map(({ type, name, sql }) => ({
      type,
      name,
      sql: normalizeSql(sql),
    })),
  );

function isPlainRecord(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactDataValues(value, expected, errorCode) {
  if (!isPlainRecord(value)) throw new TypeError(errorCode);
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string")
    || actual.length !== expected.length
    || expected.some((key) => !actual.includes(key))) {
    throw new TypeError(errorCode);
  }
  const result = {};
  for (const key of expected) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor
      || !("value" in descriptor)
      || descriptor.get !== undefined
      || descriptor.set !== undefined) {
      throw new TypeError(errorCode);
    }
    result[key] = descriptor.value;
  }
  return result;
}

function asDigest(value, label, { allowZero = false } = {}) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${label} must be a canonical SHA-256 digest`);
  }
  if (!allowZero && value === ZERO_SHA256) throw new Error(`${label} must not be zero`);
  return value;
}

function asU64String(value, label, { positive = false } = {}) {
  if (typeof value !== "string" || !/^(0|[1-9]\d*)$/u.test(value)) {
    throw new TypeError(`${label} must be a canonical u64 decimal string`);
  }
  const parsed = BigInt(value);
  if (parsed > U64_MAX || (positive && parsed === 0n)) {
    throw new RangeError(`${label} is outside the accepted u64 range`);
  }
  return parsed;
}

function u64Be(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(asU64String(value, "u64 storage value"));
  return bytes;
}

function parseCanonicalJson(text, label) {
  if (typeof text !== "string" || text.length === 0) {
    throw new Error(`${label} must be nonempty canonical JSON`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not JSON`);
  }
  if (JSON.stringify(parsed) !== text) throw new Error(`${label} is not canonical JSON`);
  return parsed;
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const item of Object.values(value)) deepFreeze(item);
  return Object.freeze(value);
}

function frozenClone(value) {
  return deepFreeze(structuredClone(value));
}

function falseTruthBoundary() {
  return {
    externalWriterConfinementVerified: false,
    suppliedStateAuthenticityVerified: false,
    externalRollbackProtectionVerified: false,
    securePlatformKeystoreVerified: false,
    authenticatedChainObservationVerified: false,
    onchainRuntimeIntegrationVerified: false,
    privacyLegalReviewAccepted: false,
    devnetLifecycleVerified: false,
    activationReady: false,
    mainnetStatus: PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS,
  };
}

function assertFalseBoundary(record, label) {
  const expected = falseTruthBoundary();
  for (const [key, value] of Object.entries(expected)) {
    if (record[key] !== value) throw new Error(`${label}.${key} truth boundary mismatch`);
  }
}

function bundleRecordCore(bundle, receipt) {
  const bundleJson = JSON.stringify(bundle);
  const stateAfterJson = JSON.stringify(receipt.stateAfter);
  return {
    schema: PRIVACY_VAULT_RECOVERY_SQLITE_BUNDLE_RECORD_SCHEMA,
    status: PRIVACY_VAULT_RECOVERY_SQLITE_STATUS,
    epoch: receipt.epoch,
    bundleSha256: receipt.bundleSha256,
    previousBundleSha256: bundle.previousBundleSha256,
    stateBeforeSha256: receipt.stateBeforeSha256,
    stateAfterSha256: receipt.stateAfter.stateSha256,
    keyMaterialCommitmentSha256: receipt.expectedKeyMaterialCommitmentSha256,
    verificationReceiptSha256: receipt.verificationReceiptSha256,
    bundleJson,
    bundleJsonSha256: sha256Bytes(Buffer.from(bundleJson, "utf8")),
    stateAfterJson,
    stateAfterJsonSha256: sha256Bytes(Buffer.from(stateAfterJson, "utf8")),
    processPrivateReceiptAcceptedAtAdapterBoundary: true,
    durableLocalBundleRecordVerified: true,
    ...falseTruthBoundary(),
  };
}

function createBundleRecord(bundle, receipt) {
  const core = bundleRecordCore(bundle, receipt);
  return frozenClone({
    ...core,
    recordSha256: sha256Canonical(
      "iat-b3-privacy-vault-recovery-sqlite-bundle-record/v1",
      core,
    ),
  });
}

function validateBundleRecord(record, previousState, previousRecord) {
  if (!isPlainRecord(record)
    || record.schema !== PRIVACY_VAULT_RECOVERY_SQLITE_BUNDLE_RECORD_SCHEMA
    || record.status !== PRIVACY_VAULT_RECOVERY_SQLITE_STATUS
    || record.processPrivateReceiptAcceptedAtAdapterBoundary !== true
    || record.durableLocalBundleRecordVerified !== true) {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_BUNDLE_RECORD_INVALID");
  }
  assertFalseBoundary(record, "bundleRecord");
  const epoch = asU64String(record.epoch, "bundleRecord.epoch", { positive: true });
  const expectedEpoch = BigInt(previousState.lastEpoch) + 1n;
  for (const [key, allowZero] of [
    ["bundleSha256", false],
    ["previousBundleSha256", epoch === 1n],
    ["stateBeforeSha256", false],
    ["stateAfterSha256", false],
    ["keyMaterialCommitmentSha256", false],
    ["verificationReceiptSha256", false],
    ["bundleJsonSha256", false],
    ["stateAfterJsonSha256", false],
    ["recordSha256", false],
  ]) asDigest(record[key], `bundleRecord.${key}`, { allowZero });
  if (epoch !== expectedEpoch
    || record.previousBundleSha256 !== previousState.lastBundleSha256
    || record.stateBeforeSha256 !== previousState.stateSha256) {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_BUNDLE_CHAIN_MISMATCH");
  }
  const bundle = validatePrivacyVaultRecoveryBundle(
    parseCanonicalJson(record.bundleJson, "bundleRecord.bundleJson"),
  );
  const stateAfter = validatePrivacyVaultRecoveryState(
    parseCanonicalJson(record.stateAfterJson, "bundleRecord.stateAfterJson"),
  );
  const bundleCreatedAt = asU64String(
    bundle.createdAtUnixSeconds,
    "bundle.createdAtUnixSeconds",
  );
  const bundleExpiresAt = asU64String(
    bundle.expiresAtUnixSeconds,
    "bundle.expiresAtUnixSeconds",
  );
  const maximumBundleAge = asU64String(
    previousState.maximumBundleAgeSeconds,
    "previousState.maximumBundleAgeSeconds",
    { positive: true },
  );
  if (sha256Bytes(Buffer.from(record.bundleJson, "utf8")) !== record.bundleJsonSha256
    || sha256Bytes(Buffer.from(record.stateAfterJson, "utf8")) !== record.stateAfterJsonSha256
    || bundle.epoch !== record.epoch
    || bundle.bundleSha256 !== record.bundleSha256
    || bundle.previousBundleSha256 !== record.previousBundleSha256
    || bundle.stateBeforeSha256 !== record.stateBeforeSha256
    || bundle.vaultBindingSha256 !== previousState.vaultBindingSha256
    || bundle.recoveryKeyCommitmentSha256
      !== previousState.recoveryKeyCommitmentSha256
    || bundle.previousKeyMaterialCommitmentSha256
      !== previousState.lastKeyMaterialCommitmentSha256
    || bundle.keyMaterialCommitmentSha256 !== record.keyMaterialCommitmentSha256
    || bundleExpiresAt - bundleCreatedAt > maximumBundleAge
    || stateAfter.stateSha256 !== record.stateAfterSha256
    || stateAfter.lastEpoch !== record.epoch
    || stateAfter.lastBundleSha256 !== record.bundleSha256
    || stateAfter.lastKeyMaterialCommitmentSha256 !== record.keyMaterialCommitmentSha256
    || stateAfter.vaultBindingSha256 !== previousState.vaultBindingSha256
    || stateAfter.recoveryKeyCommitmentSha256 !== previousState.recoveryKeyCommitmentSha256
    || stateAfter.maximumBundleAgeSeconds !== previousState.maximumBundleAgeSeconds
    || stateAfter.maximumFutureSkewSeconds !== previousState.maximumFutureSkewSeconds
    || (previousRecord !== null
      && previousRecord.stateAfterSha256 !== record.stateBeforeSha256)) {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_BUNDLE_STATE_BINDING_MISMATCH");
  }
  const { recordSha256, ...core } = record;
  if (recordSha256 !== sha256Canonical(
    "iat-b3-privacy-vault-recovery-sqlite-bundle-record/v1",
    core,
  )) {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_BUNDLE_RECORD_DIGEST_MISMATCH");
  }
  return { record, bundle, stateAfter };
}

function cursorRecordCore(bundleRecord, previousCursor) {
  return {
    schema: PRIVACY_VAULT_RECOVERY_SQLITE_CURSOR_RECORD_SCHEMA,
    status: PRIVACY_VAULT_RECOVERY_SQLITE_STATUS,
    cursorRevision: bundleRecord.epoch,
    epoch: bundleRecord.epoch,
    bundleSha256: bundleRecord.bundleSha256,
    stateAfterSha256: bundleRecord.stateAfterSha256,
    bundleRecordSha256: bundleRecord.recordSha256,
    verificationReceiptSha256: bundleRecord.verificationReceiptSha256,
    previousCursorSha256: previousCursor?.cursorSha256 ?? ZERO_SHA256,
    localBundleCursorAtomicityVerified: true,
    processPrivateReceiptRequired: true,
    ...falseTruthBoundary(),
  };
}

function createCursorRecord(bundleRecord, previousCursor) {
  const core = cursorRecordCore(bundleRecord, previousCursor);
  return frozenClone({
    ...core,
    cursorSha256: sha256Canonical(
      "iat-b3-privacy-vault-recovery-sqlite-cursor-record/v1",
      core,
    ),
  });
}

function validateCursorRecord(record, bundleRecord, previousCursor) {
  if (!isPlainRecord(record)
    || record.schema !== PRIVACY_VAULT_RECOVERY_SQLITE_CURSOR_RECORD_SCHEMA
    || record.status !== PRIVACY_VAULT_RECOVERY_SQLITE_STATUS
    || record.localBundleCursorAtomicityVerified !== true
    || record.processPrivateReceiptRequired !== true) {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_CURSOR_RECORD_INVALID");
  }
  assertFalseBoundary(record, "cursorRecord");
  const revision = asU64String(
    record.cursorRevision,
    "cursorRecord.cursorRevision",
    { positive: true },
  );
  const expectedRevision = BigInt(previousCursor?.cursorRevision ?? "0") + 1n;
  for (const [key, allowZero] of [
    ["bundleSha256", false],
    ["stateAfterSha256", false],
    ["bundleRecordSha256", false],
    ["verificationReceiptSha256", false],
    ["previousCursorSha256", revision === 1n],
    ["cursorSha256", false],
  ]) asDigest(record[key], `cursorRecord.${key}`, { allowZero });
  if (revision !== expectedRevision
    || record.cursorRevision !== record.epoch
    || record.epoch !== bundleRecord.epoch
    || record.bundleSha256 !== bundleRecord.bundleSha256
    || record.stateAfterSha256 !== bundleRecord.stateAfterSha256
    || record.bundleRecordSha256 !== bundleRecord.recordSha256
    || record.verificationReceiptSha256 !== bundleRecord.verificationReceiptSha256
    || record.previousCursorSha256 !== (previousCursor?.cursorSha256 ?? ZERO_SHA256)) {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_CURSOR_CHAIN_MISMATCH");
  }
  const { cursorSha256, ...core } = record;
  if (cursorSha256 !== sha256Canonical(
    "iat-b3-privacy-vault-recovery-sqlite-cursor-record/v1",
    core,
  )) {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_CURSOR_DIGEST_MISMATCH");
  }
  return record;
}

function configureDatabase(database) {
  if (typeof database.enableDefensive !== "function") {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_NODE24_DEFENSIVE_MODE_REQUIRED");
  }
  database.enableDefensive(true);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA recursive_triggers = ON");
  database.exec("PRAGMA trusted_schema = OFF");
  database.exec("PRAGMA busy_timeout = 5000");
  database.exec("PRAGMA synchronous = FULL");
  database.exec("PRAGMA journal_mode = WAL");
  const pragmas = {
    foreignKeys: Number(database.prepare("PRAGMA foreign_keys").get().foreign_keys),
    recursiveTriggers: Number(database.prepare("PRAGMA recursive_triggers").get().recursive_triggers),
    trustedSchema: Number(database.prepare("PRAGMA trusted_schema").get().trusted_schema),
    synchronous: Number(database.prepare("PRAGMA synchronous").get().synchronous),
    journalMode: String(database.prepare("PRAGMA journal_mode").get().journal_mode).toLowerCase(),
  };
  if (pragmas.foreignKeys !== 1
    || pragmas.recursiveTriggers !== 1
    || pragmas.trustedSchema !== 0
    || pragmas.synchronous !== 2
    || pragmas.journalMode !== "wal") {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_PRAGMA_HOLD");
  }
}

function rollbackWithoutMaskingPrimaryFailure(database) {
  try {
    database.exec("ROLLBACK");
  } catch {
    // SQLite may already have auto-aborted the transaction. The original
    // validation or storage failure is the actionable fail-closed cause.
  }
}

function schemaObjects(database) {
  return database.prepare(`
    SELECT type, name, sql
    FROM sqlite_schema
    WHERE name NOT LIKE 'sqlite_%'
    ORDER BY type, name
  `).all();
}

function validateSchema(database) {
  const actual = schemaObjects(database);
  const expected = [...SCHEMA_OBJECTS]
    .sort((left, right) => `${left.type}:${left.name}`.localeCompare(`${right.type}:${right.name}`));
  if (actual.length !== expected.length) {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_OBJECT_SET_MISMATCH");
  }
  for (let index = 0; index < expected.length; index += 1) {
    const observed = actual[index];
    const wanted = expected[index];
    if (observed.type !== wanted.type
      || observed.name !== wanted.name
      || normalizeSql(observed.sql) !== normalizeSql(wanted.sql)) {
      throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_OBJECT_MISMATCH");
    }
  }
}

function assertDatabaseIntegrity(database) {
  const integrityRows = database.prepare("PRAGMA integrity_check").all();
  if (integrityRows.length !== 1
    || String(Object.values(integrityRows[0])[0]).toLowerCase() !== "ok") {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_INTEGRITY_CHECK_FAILED");
  }
  if (database.prepare("PRAGMA foreign_key_check").all().length !== 0) {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_FOREIGN_KEY_CHECK_FAILED");
  }
}

function initializeSchema(database, genesisState) {
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const sql of Object.values(TABLE_SQL)) database.exec(sql);
    for (const sql of Object.values(TRIGGER_SQL)) database.exec(sql);
    const stateJson = JSON.stringify(genesisState);
    database.prepare(`
      INSERT INTO privacy_vault_recovery_meta (
        singleton_id, adapter_schema, schema_version, schema_manifest_sha256,
        vault_binding_sha256, recovery_key_commitment_sha256,
        maximum_bundle_age_seconds, maximum_future_skew_seconds,
        genesis_state_sha256, genesis_state_json,
        local_bundle_cursor_atomicity_verified,
        process_private_receipt_required,
        durable_local_sqlite_reopen_verified,
        external_writer_confinement_verified,
        supplied_state_authenticity_verified,
        external_rollback_protection_verified,
        secure_platform_keystore_verified,
        authenticated_chain_observation_verified,
        onchain_runtime_integration_verified,
        privacy_legal_review_accepted,
        devnet_lifecycle_verified,
        activation_ready,
        mainnet_status
      ) VALUES (
        1, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, ?
      )
    `).run(
      PRIVACY_VAULT_RECOVERY_SQLITE_ADAPTER_SCHEMA,
      PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_VERSION,
      PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_MANIFEST_SHA256,
      genesisState.vaultBindingSha256,
      genesisState.recoveryKeyCommitmentSha256,
      genesisState.maximumBundleAgeSeconds,
      genesisState.maximumFutureSkewSeconds,
      genesisState.stateSha256,
      stateJson,
      PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS,
    );
    loadSnapshot(database);
    database.exec("COMMIT");
  } catch (error) {
    rollbackWithoutMaskingPrimaryFailure(database);
    throw error;
  }
}

function assertStoredU64Be(bytes, text, label) {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength !== 8) {
    throw new Error(`${label} canonical big-endian bytes mismatch`);
  }
  const copy = Buffer.from(bytes);
  if (copy.readBigUInt64BE() !== asU64String(text, `${label} text`)) {
    throw new Error(`${label} canonical big-endian bytes mismatch`);
  }
}

function metaRow(database) {
  const row = database.prepare("SELECT * FROM privacy_vault_recovery_meta").get();
  if (!row
    || row.singleton_id !== 1
    || row.adapter_schema !== PRIVACY_VAULT_RECOVERY_SQLITE_ADAPTER_SCHEMA
    || row.schema_version !== PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_VERSION
    || row.schema_manifest_sha256 !== PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_MANIFEST_SHA256
    || row.local_bundle_cursor_atomicity_verified !== 1
    || row.process_private_receipt_required !== 1
    || row.durable_local_sqlite_reopen_verified !== 1
    || row.external_writer_confinement_verified !== 0
    || row.supplied_state_authenticity_verified !== 0
    || row.external_rollback_protection_verified !== 0
    || row.secure_platform_keystore_verified !== 0
    || row.authenticated_chain_observation_verified !== 0
    || row.onchain_runtime_integration_verified !== 0
    || row.privacy_legal_review_accepted !== 0
    || row.devnet_lifecycle_verified !== 0
    || row.activation_ready !== 0
    || row.mainnet_status !== PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS) {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_META_INVALID");
  }
  const genesisState = validatePrivacyVaultRecoveryState(
    parseCanonicalJson(row.genesis_state_json, "meta.genesisStateJson"),
  );
  if (genesisState.lastEpoch !== "0"
    || genesisState.lastBundleSha256 !== ZERO_SHA256
    || row.vault_binding_sha256 !== genesisState.vaultBindingSha256
    || row.recovery_key_commitment_sha256 !== genesisState.recoveryKeyCommitmentSha256
    || row.maximum_bundle_age_seconds !== genesisState.maximumBundleAgeSeconds
    || row.maximum_future_skew_seconds !== genesisState.maximumFutureSkewSeconds
    || row.genesis_state_sha256 !== genesisState.stateSha256) {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_GENESIS_MISMATCH");
  }
  return { row, genesisState };
}

function bundleRecordFromRow(row) {
  assertStoredU64Be(row.epoch_be, row.epoch_text, "bundle record epoch");
  return {
    schema: PRIVACY_VAULT_RECOVERY_SQLITE_BUNDLE_RECORD_SCHEMA,
    status: PRIVACY_VAULT_RECOVERY_SQLITE_STATUS,
    epoch: row.epoch_text,
    bundleSha256: row.bundle_sha256,
    previousBundleSha256: row.previous_bundle_sha256,
    stateBeforeSha256: row.state_before_sha256,
    stateAfterSha256: row.state_after_sha256,
    keyMaterialCommitmentSha256: row.key_material_commitment_sha256,
    verificationReceiptSha256: row.verification_receipt_sha256,
    bundleJson: row.bundle_json,
    bundleJsonSha256: row.bundle_json_sha256,
    stateAfterJson: row.state_after_json,
    stateAfterJsonSha256: row.state_after_json_sha256,
    processPrivateReceiptAcceptedAtAdapterBoundary:
      row.process_private_receipt_accepted_at_adapter_boundary === 1,
    durableLocalBundleRecordVerified: row.durable_local_bundle_record_verified === 1,
    externalWriterConfinementVerified: row.external_writer_confinement_verified === 1,
    suppliedStateAuthenticityVerified: row.supplied_state_authenticity_verified === 1,
    externalRollbackProtectionVerified: row.external_rollback_protection_verified === 1,
    securePlatformKeystoreVerified: row.secure_platform_keystore_verified === 1,
    authenticatedChainObservationVerified: row.authenticated_chain_observation_verified === 1,
    onchainRuntimeIntegrationVerified: row.onchain_runtime_integration_verified === 1,
    privacyLegalReviewAccepted: row.privacy_legal_review_accepted === 1,
    devnetLifecycleVerified: row.devnet_lifecycle_verified === 1,
    activationReady: row.activation_ready === 1,
    mainnetStatus: row.mainnet_status,
    recordSha256: row.record_sha256,
  };
}

function cursorRecordFromRow(row) {
  assertStoredU64Be(
    row.cursor_revision_be,
    row.cursor_revision_text,
    "cursor record revision",
  );
  assertStoredU64Be(row.epoch_be, row.epoch_text, "cursor record epoch");
  return {
    schema: PRIVACY_VAULT_RECOVERY_SQLITE_CURSOR_RECORD_SCHEMA,
    status: PRIVACY_VAULT_RECOVERY_SQLITE_STATUS,
    cursorRevision: row.cursor_revision_text,
    epoch: row.epoch_text,
    bundleSha256: row.bundle_sha256,
    stateAfterSha256: row.state_after_sha256,
    bundleRecordSha256: row.bundle_record_sha256,
    verificationReceiptSha256: row.verification_receipt_sha256,
    previousCursorSha256: row.previous_cursor_sha256,
    localBundleCursorAtomicityVerified: row.local_bundle_cursor_atomicity_verified === 1,
    processPrivateReceiptRequired: row.process_private_receipt_required === 1,
    externalWriterConfinementVerified: row.external_writer_confinement_verified === 1,
    suppliedStateAuthenticityVerified: row.supplied_state_authenticity_verified === 1,
    externalRollbackProtectionVerified: row.external_rollback_protection_verified === 1,
    securePlatformKeystoreVerified: row.secure_platform_keystore_verified === 1,
    authenticatedChainObservationVerified: row.authenticated_chain_observation_verified === 1,
    onchainRuntimeIntegrationVerified: row.onchain_runtime_integration_verified === 1,
    privacyLegalReviewAccepted: row.privacy_legal_review_accepted === 1,
    devnetLifecycleVerified: row.devnet_lifecycle_verified === 1,
    activationReady: row.activation_ready === 1,
    mainnetStatus: row.mainnet_status,
    cursorSha256: row.cursor_sha256,
  };
}

function loadSnapshot(database) {
  validateSchema(database);
  assertDatabaseIntegrity(database);
  const { genesisState } = metaRow(database);
  const rows = database.prepare(`
    SELECT * FROM privacy_vault_recovery_bundle_records ORDER BY epoch_be
  `).all();
  const cursorRows = database.prepare(`
    SELECT * FROM privacy_vault_recovery_cursor_history ORDER BY cursor_revision_be
  `).all();
  if (rows.length !== cursorRows.length) {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_CURSOR_BUNDLE_COUNT_MISMATCH");
  }
  const bundles = [];
  const cursors = [];
  let currentState = genesisState;
  let previousRecord = null;
  let previousCursor = null;
  for (let index = 0; index < rows.length; index += 1) {
    const record = bundleRecordFromRow(rows[index]);
    const validated = validateBundleRecord(record, currentState, previousRecord);
    const cursor = validateCursorRecord(
      cursorRecordFromRow(cursorRows[index]),
      record,
      previousCursor,
    );
    bundles.push(frozenClone({ ...record, bundle: validated.bundle }));
    cursors.push(cursor);
    currentState = validated.stateAfter;
    previousRecord = record;
    previousCursor = cursor;
  }
  const core = {
    schema: PRIVACY_VAULT_RECOVERY_SQLITE_SNAPSHOT_SCHEMA,
    status: PRIVACY_VAULT_RECOVERY_SQLITE_STATUS,
    schemaManifestSha256: PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_MANIFEST_SHA256,
    genesisState,
    currentState,
    bundles,
    cursors,
    localBundleCursorAtomicityVerified: true,
    processPrivateReceiptRequired: true,
    durableLocalSqliteReopenVerified: true,
    ...falseTruthBoundary(),
  };
  return frozenClone({
    ...core,
    snapshotSha256: sha256Canonical(
      "iat-b3-privacy-vault-recovery-sqlite-snapshot/v1",
      core,
    ),
  });
}

function transactionalSnapshot(database) {
  database.exec("BEGIN");
  try {
    const snapshot = loadSnapshot(database);
    database.exec("COMMIT");
    return snapshot;
  } catch (error) {
    rollbackWithoutMaskingPrimaryFailure(database);
    throw error;
  }
}

function insertBundleRecord(database, record) {
  database.prepare(`
    INSERT INTO privacy_vault_recovery_bundle_records (
      epoch_be, epoch_text, bundle_sha256, previous_bundle_sha256,
      state_before_sha256, state_after_sha256, key_material_commitment_sha256,
      verification_receipt_sha256, bundle_json, bundle_json_sha256,
      state_after_json, state_after_json_sha256, record_sha256,
      process_private_receipt_accepted_at_adapter_boundary,
      durable_local_bundle_record_verified,
      external_writer_confinement_verified,
      supplied_state_authenticity_verified,
      external_rollback_protection_verified,
      secure_platform_keystore_verified,
      authenticated_chain_observation_verified,
      onchain_runtime_integration_verified,
      privacy_legal_review_accepted,
      devnet_lifecycle_verified,
      activation_ready,
      mainnet_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, ?)
  `).run(
    u64Be(record.epoch),
    record.epoch,
    record.bundleSha256,
    record.previousBundleSha256,
    record.stateBeforeSha256,
    record.stateAfterSha256,
    record.keyMaterialCommitmentSha256,
    record.verificationReceiptSha256,
    record.bundleJson,
    record.bundleJsonSha256,
    record.stateAfterJson,
    record.stateAfterJsonSha256,
    record.recordSha256,
    PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS,
  );
}

function insertCursorRecord(database, record) {
  database.prepare(`
    INSERT INTO privacy_vault_recovery_cursor_history (
      cursor_revision_be, cursor_revision_text, epoch_be, epoch_text,
      bundle_sha256, state_after_sha256, bundle_record_sha256,
      verification_receipt_sha256, previous_cursor_sha256, cursor_sha256,
      local_bundle_cursor_atomicity_verified,
      process_private_receipt_required,
      external_writer_confinement_verified,
      supplied_state_authenticity_verified,
      external_rollback_protection_verified,
      secure_platform_keystore_verified,
      authenticated_chain_observation_verified,
      onchain_runtime_integration_verified,
      privacy_legal_review_accepted,
      devnet_lifecycle_verified,
      activation_ready,
      mainnet_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, ?)
  `).run(
    u64Be(record.cursorRevision),
    record.cursorRevision,
    u64Be(record.epoch),
    record.epoch,
    record.bundleSha256,
    record.stateAfterSha256,
    record.bundleRecordSha256,
    record.verificationReceiptSha256,
    record.previousCursorSha256,
    record.cursorSha256,
    PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS,
  );
}

function validateCommitBinding(bundle, receipt, currentState) {
  if (bundle.bundleSha256 !== receipt.bundleSha256
    || bundle.epoch !== receipt.epoch
    || bundle.vaultBindingSha256 !== receipt.vaultBindingSha256
    || bundle.recoveryKeyCommitmentSha256 !== receipt.recoveryKeyCommitmentSha256
    || bundle.stateBeforeSha256 !== receipt.stateBeforeSha256
    || bundle.keyMaterialCommitmentSha256
      !== receipt.expectedKeyMaterialCommitmentSha256
    || receipt.stateBeforeSha256 !== currentState.stateSha256
    || receipt.stateAfter.vaultBindingSha256 !== currentState.vaultBindingSha256
    || receipt.stateAfter.recoveryKeyCommitmentSha256
      !== currentState.recoveryKeyCommitmentSha256
    || receipt.stateAfter.maximumBundleAgeSeconds
      !== currentState.maximumBundleAgeSeconds
    || receipt.stateAfter.maximumFutureSkewSeconds
      !== currentState.maximumFutureSkewSeconds) {
    throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_COMMIT_BINDING_MISMATCH");
  }
}

function commitResult(disposition, record, cursor, snapshot) {
  const core = {
    schema: PRIVACY_VAULT_RECOVERY_SQLITE_COMMIT_RESULT_SCHEMA,
    status: PRIVACY_VAULT_RECOVERY_SQLITE_STATUS,
    disposition,
    bundleRecord: record,
    cursorRecord: cursor,
    currentState: snapshot.currentState,
    snapshotSha256: snapshot.snapshotSha256,
    localBundleCursorAtomicityVerified: true,
    processPrivateReceiptRequired: true,
    durableLocalSqliteReopenVerified: true,
    ...falseTruthBoundary(),
  };
  return frozenClone({
    ...core,
    commitResultSha256: sha256Canonical(
      "iat-b3-privacy-vault-recovery-sqlite-commit-result/v1",
      core,
    ),
  });
}

function compareStates(localState, suppliedState) {
  validatePrivacyVaultRecoveryState(localState);
  validatePrivacyVaultRecoveryState(suppliedState);
  for (const key of [
    "vaultBindingSha256",
    "recoveryKeyCommitmentSha256",
    "maximumBundleAgeSeconds",
    "maximumFutureSkewSeconds",
  ]) {
    if (localState[key] !== suppliedState[key]) {
      throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_COMPARISON_BINDING_MISMATCH_HOLD");
    }
  }
  const localEpoch = asU64String(localState.lastEpoch, "localState.lastEpoch");
  const suppliedEpoch = asU64String(suppliedState.lastEpoch, "suppliedState.lastEpoch");
  let relationship;
  if (localEpoch === suppliedEpoch) {
    relationship = localState.stateSha256 === suppliedState.stateSha256
      ? PRIVACY_VAULT_RECOVERY_SQLITE_RELATIONSHIP.EXACT
      : PRIVACY_VAULT_RECOVERY_SQLITE_RELATIONSHIP.SAME_EPOCH_FORK;
  } else {
    relationship = localEpoch > suppliedEpoch
      ? PRIVACY_VAULT_RECOVERY_SQLITE_RELATIONSHIP.LOCAL_AHEAD
      : PRIVACY_VAULT_RECOVERY_SQLITE_RELATIONSHIP.LOCAL_BEHIND;
  }
  const core = {
    schema: PRIVACY_VAULT_RECOVERY_SQLITE_COMPARISON_SCHEMA,
    status: PRIVACY_VAULT_RECOVERY_SQLITE_STATUS,
    relationship,
    localEpoch: localState.lastEpoch,
    localStateSha256: localState.stateSha256,
    suppliedEpoch: suppliedState.lastEpoch,
    suppliedStateSha256: suppliedState.stateSha256,
    localBehindSuppliedStateObserved:
      relationship === PRIVACY_VAULT_RECOVERY_SQLITE_RELATIONSHIP.LOCAL_BEHIND,
    sameEpochForkObserved:
      relationship === PRIVACY_VAULT_RECOVERY_SQLITE_RELATIONSHIP.SAME_EPOCH_FORK,
    comparisonOnlyNotRollbackProof: true,
    ...falseTruthBoundary(),
  };
  return frozenClone({
    ...core,
    comparisonSha256: sha256Canonical(
      "iat-b3-privacy-vault-recovery-sqlite-comparison/v1",
      core,
    ),
  });
}

export function assertPrivacyVaultRecoverySqliteAdapter(value) {
  if (!ADAPTERS.has(value)) {
    throw new TypeError("privacy vault recovery SQLite adapter is not process-branded");
  }
  return value;
}

export function createPrivacyVaultRecoverySqlite(candidate) {
  const input = exactDataValues(
    candidate,
    CREATE_INPUT_KEYS,
    "privacy vault recovery SQLite input must have the exact canonical shape",
  );
  if (typeof input.databasePath !== "string"
    || input.databasePath.length === 0
    || input.databasePath === ":memory:") {
    throw new TypeError("privacy vault recovery SQLite requires a file-backed database path");
  }
  const genesisState = validatePrivacyVaultRecoveryState(input.genesisState);
  if (genesisState.lastEpoch !== "0" || genesisState.lastBundleSha256 !== ZERO_SHA256) {
    throw new Error("privacy vault recovery SQLite requires an exact genesis state");
  }
  const database = new DatabaseSync(input.databasePath, {
    allowExtension: false,
    enableForeignKeyConstraints: true,
    enableDoubleQuotedStringLiterals: false,
    timeout: 5_000,
    readBigInts: false,
    returnArrays: false,
    allowBareNamedParameters: false,
    allowUnknownNamedParameters: false,
  });
  let closed = false;
  try {
    configureDatabase(database);
    const exists = database.prepare(`
      SELECT 1 AS present FROM sqlite_schema
      WHERE type = 'table' AND name = 'privacy_vault_recovery_meta'
    `).get();
    if (!exists) initializeSchema(database, genesisState);
    const opened = transactionalSnapshot(database);
    if (opened.genesisState.stateSha256 !== genesisState.stateSha256) {
      throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_OPEN_GENESIS_MISMATCH");
    }
  } catch (error) {
    database.close();
    throw error;
  }

  function requireOpen() {
    if (closed) throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_CLOSED");
  }

  const adapter = Object.freeze({
    schema: PRIVACY_VAULT_RECOVERY_SQLITE_ADAPTER_SCHEMA,
    status: PRIVACY_VAULT_RECOVERY_SQLITE_STATUS,
    schemaVersion: PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_VERSION,
    schemaManifestSha256: PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_MANIFEST_SHA256,
    localBundleCursorAtomicityVerified: true,
    processPrivateReceiptRequired: true,
    durableLocalSqliteReopenVerified: true,
    ...falseTruthBoundary(),
    snapshot() {
      requireOpen();
      return transactionalSnapshot(database);
    },
    compareSuppliedState(suppliedState) {
      requireOpen();
      return compareStates(transactionalSnapshot(database).currentState, suppliedState);
    },
    commitVerifiedBundle(commitCandidate) {
      requireOpen();
      const values = exactDataValues(
        commitCandidate,
        COMMIT_INPUT_KEYS,
        "privacy vault recovery SQLite commit input must have the exact canonical shape",
      );
      const receipt = validatePrivacyVaultRecoveryVerificationReceipt(
        values.verificationReceipt,
      );
      const bundle = validatePrivacyVaultRecoveryBundle(values.bundle);
      if (values.testFault !== null
        && !Object.values(PRIVACY_VAULT_RECOVERY_SQLITE_TEST_FAULT).includes(values.testFault)) {
        throw new TypeError("privacy vault recovery SQLite test fault is invalid");
      }

      database.exec("BEGIN IMMEDIATE");
      let record;
      let cursor;
      let disposition;
      try {
        const before = loadSnapshot(database);
        const currentState = before.currentState;
        const incomingEpoch = asU64String(receipt.epoch, "receipt.epoch", { positive: true });
        const currentEpoch = asU64String(currentState.lastEpoch, "currentState.lastEpoch");
        if (incomingEpoch <= currentEpoch) {
          const stored = before.bundles.at(-1);
          const storedCursor = before.cursors.at(-1);
          if (incomingEpoch !== currentEpoch
            || !stored
            || !storedCursor
            || stored.bundleSha256 !== receipt.bundleSha256
            || stored.verificationReceiptSha256 !== receipt.verificationReceiptSha256
            || stored.bundleJson !== JSON.stringify(bundle)
            || stored.stateAfterSha256 !== receipt.stateAfter.stateSha256) {
            throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_REPLAY_OR_FORK_HOLD");
          }
          record = stored;
          cursor = storedCursor;
          disposition = PRIVACY_VAULT_RECOVERY_SQLITE_DISPOSITION.RECONCILED_EXACT_REPLAY;
        } else {
          if (incomingEpoch !== currentEpoch + 1n) {
            throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_EPOCH_SKIP_HOLD");
          }
          validateCommitBinding(bundle, receipt, currentState);
          record = createBundleRecord(bundle, receipt);
          cursor = createCursorRecord(record, before.cursors.at(-1) ?? null);
          insertBundleRecord(database, record);
          if (values.testFault
            === PRIVACY_VAULT_RECOVERY_SQLITE_TEST_FAULT.AFTER_BUNDLE_INSERT) {
            throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_TEST_FAULT_AFTER_BUNDLE_INSERT");
          }
          insertCursorRecord(database, cursor);
          if (values.testFault
            === PRIVACY_VAULT_RECOVERY_SQLITE_TEST_FAULT.AFTER_CURSOR_INSERT) {
            throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_TEST_FAULT_AFTER_CURSOR_INSERT");
          }
          disposition = PRIVACY_VAULT_RECOVERY_SQLITE_DISPOSITION.COMMITTED;
        }
        const staged = loadSnapshot(database);
        if (staged.currentState.stateSha256 !== receipt.stateAfter.stateSha256
          || staged.bundles.at(-1)?.recordSha256 !== record.recordSha256
          || staged.cursors.at(-1)?.cursorSha256 !== cursor.cursorSha256) {
          throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_STAGED_READBACK_MISMATCH_HOLD");
        }
        database.exec("COMMIT");
      } catch (error) {
        rollbackWithoutMaskingPrimaryFailure(database);
        throw error;
      }
      if (values.testFault
        === PRIVACY_VAULT_RECOVERY_SQLITE_TEST_FAULT.AFTER_COMMIT_BEFORE_RETURN) {
        throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_TEST_FAULT_AFTER_COMMIT_BEFORE_RETURN");
      }
      const after = transactionalSnapshot(database);
      if (after.currentState.stateSha256 !== receipt.stateAfter.stateSha256
        || after.bundles.at(-1)?.recordSha256 !== record.recordSha256
        || after.cursors.at(-1)?.cursorSha256 !== cursor.cursorSha256) {
        throw new Error("PRIVACY_VAULT_RECOVERY_SQLITE_COMMIT_READBACK_MISMATCH_HOLD");
      }
      return commitResult(disposition, record, cursor, after);
    },
    close() {
      if (closed) return;
      database.close();
      closed = true;
    },
  });
  ADAPTERS.add(adapter);
  assertPrivacyVaultRecoverySqliteAdapter(adapter);
  return adapter;
}

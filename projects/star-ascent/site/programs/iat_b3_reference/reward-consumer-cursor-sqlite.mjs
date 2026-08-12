import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { assertDailyLawWriteAllowed } from "./daily-lockdown-consensus.mjs";
import {
  REWARD_CAS_ZERO_SHA256,
  decodeRewardCasTypedValue,
  encodeRewardCasTypedValue,
  rewardCasStateSha256,
} from "./reward-persistence-cas.mjs";
import { assertRewardConsumerPermit } from "./reward-consumer-gate.mjs";

export const REWARD_CONSUMER_CURSOR_SCHEMA = "iat-b3-reward-consumer-cursor/v1";
export const REWARD_CONSUMER_CURSOR_SQLITE_ADAPTER_SCHEMA =
  "iat-b3-reward-consumer-cursor-sqlite-adapter/v1";
export const REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_VERSION = 1;
export const REWARD_CONSUMER_CURSOR_STATUS =
  "HOST_ONLY_NON_ACTIVATING_DURABLE_LOCAL_PROJECTION_CURSOR";
export const REWARD_CONSUMER_CURSOR_MAINNET_STATUS = "HOLD";
export const REWARD_CONSUMER_PROJECTION_COMMITMENT_SCHEMA =
  "iat-b3-reward-consumer-local-projection-commitment/v1";
export const REWARD_CONSUMER_PROJECTION_EVENT_SCHEMA =
  "iat-b3-reward-consumer-local-projection-event/v1";
export const REWARD_CONSUMER_CURSOR_SQLITE_TEST_FAULT = Object.freeze({
  AFTER_CURSOR: "AFTER_CURSOR",
  AFTER_PROJECTION_EVENT: "AFTER_PROJECTION_EVENT",
});

const U64_MAX = (1n << 64n) - 1n;
const CONSUMER_ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;
const PROJECTION_LABEL = /^[a-z0-9](?:[a-z0-9._:/-]{0,126}[a-z0-9])?$/u;
const HEX_32_CHECK = "length(%s) = 64 AND %s NOT GLOB '*[^0-9a-f]*'";
const SQLITE_REWARD_CONSUMER_CURSOR_ADAPTERS = new WeakSet();
const ACCEPTED_FAULTS = new Set([
  null,
  ...Object.values(REWARD_CONSUMER_CURSOR_SQLITE_TEST_FAULT),
]);
const RECORD_KEYS = Object.freeze([
  "schema",
  "status",
  "consumerId",
  "cursorRevision",
  "targetCommitSequence",
  "targetCommitSha256",
  "checkpointSha256",
  "permitSha256",
  "previousCursorSha256",
  "sourceDailyLawReferenceStateSha256",
  "consumerDailyLawReferenceStateSha256",
  "projectionCommitmentSha256",
  "durableCursorPersistenceVerified",
  "localProjectionEventAppendAtomicityVerified",
  "runtimeAuthenticationVerified",
  "rollbackProtectionVerified",
  "projectionEffectAtomicityVerified",
  "externalSideEffectsAuthorized",
  "activationReady",
  "mainnetStatus",
  "cursorSha256",
]);
const PROJECTION_INPUT_KEYS = Object.freeze(["kind", "key", "payload"]);
const PROJECTION_EVENT_KEYS = Object.freeze([
  "schema",
  "status",
  "consumerId",
  "targetCommitSequence",
  "targetCommitSha256",
  "checkpointSha256",
  "permitSha256",
  "projectionKind",
  "projectionKey",
  "payload",
  "payloadSha256",
  "projectionCommitmentSha256",
  "cursorSha256",
  "durableCursorPersistenceVerified",
  "localProjectionEventAppendAtomicityVerified",
  "materializedProjectionStateVerified",
  "runtimeAuthenticationVerified",
  "rollbackProtectionVerified",
  "externalSideEffectsAuthorized",
  "activationReady",
  "mainnetStatus",
  "eventRecordSha256",
]);

function hexCheck(column) {
  return HEX_32_CHECK.replaceAll("%s", column);
}

const TABLE_SQL = Object.freeze({
  reward_consumer_cursor_meta: `CREATE TABLE reward_consumer_cursor_meta (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    adapter_schema TEXT NOT NULL CHECK (adapter_schema = '${REWARD_CONSUMER_CURSOR_SQLITE_ADAPTER_SCHEMA}'),
    schema_version INTEGER NOT NULL CHECK (schema_version = ${REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_VERSION}),
    adapter_status TEXT NOT NULL CHECK (adapter_status = '${REWARD_CONSUMER_CURSOR_STATUS}'),
    schema_manifest_sha256 TEXT NOT NULL CHECK (${hexCheck("schema_manifest_sha256")}),
    local_projection_event_append_atomicity_verified INTEGER NOT NULL CHECK (local_projection_event_append_atomicity_verified = 1),
    materialized_projection_state_verified INTEGER NOT NULL CHECK (materialized_projection_state_verified = 0),
    runtime_authentication_verified INTEGER NOT NULL CHECK (runtime_authentication_verified = 0),
    rollback_protection_verified INTEGER NOT NULL CHECK (rollback_protection_verified = 0),
    projection_effect_atomicity_verified INTEGER NOT NULL CHECK (projection_effect_atomicity_verified = 0),
    external_side_effects_authorized INTEGER NOT NULL CHECK (external_side_effects_authorized = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_CONSUMER_CURSOR_MAINNET_STATUS}')
  ) STRICT`,
  reward_consumer_cursor_history: `CREATE TABLE reward_consumer_cursor_history (
    consumer_id TEXT NOT NULL CHECK (
      length(consumer_id) BETWEEN 1 AND 128
      AND consumer_id = lower(consumer_id)
      AND consumer_id NOT GLOB '*[^a-z0-9._-]*'
    ),
    cursor_revision_be BLOB NOT NULL CHECK (typeof(cursor_revision_be) = 'blob' AND length(cursor_revision_be) = 8),
    cursor_revision_text TEXT NOT NULL CHECK (
      length(cursor_revision_text) BETWEEN 1 AND 20
      AND cursor_revision_text NOT GLOB '*[^0-9]*'
      AND substr(cursor_revision_text, 1, 1) BETWEEN '1' AND '9'
    ),
    target_commit_sequence_be BLOB NOT NULL CHECK (typeof(target_commit_sequence_be) = 'blob' AND length(target_commit_sequence_be) = 8),
    target_commit_sequence_text TEXT NOT NULL CHECK (
      length(target_commit_sequence_text) BETWEEN 1 AND 20
      AND target_commit_sequence_text NOT GLOB '*[^0-9]*'
      AND substr(target_commit_sequence_text, 1, 1) BETWEEN '1' AND '9'
    ),
    target_commit_sha256 TEXT NOT NULL CHECK (${hexCheck("target_commit_sha256")}),
    checkpoint_sha256 TEXT NOT NULL CHECK (${hexCheck("checkpoint_sha256")}),
    permit_sha256 TEXT NOT NULL CHECK (${hexCheck("permit_sha256")}),
    projection_commitment_sha256 TEXT NOT NULL CHECK (${hexCheck("projection_commitment_sha256")}),
    previous_cursor_sha256 TEXT NOT NULL CHECK (${hexCheck("previous_cursor_sha256")}),
    cursor_sha256 TEXT NOT NULL CHECK (${hexCheck("cursor_sha256")}),
    record_blob BLOB NOT NULL CHECK (typeof(record_blob) = 'blob' AND length(record_blob) > 0),
    status TEXT NOT NULL CHECK (status = '${REWARD_CONSUMER_CURSOR_STATUS}'),
    durable_cursor_persistence_verified INTEGER NOT NULL CHECK (durable_cursor_persistence_verified = 1),
    local_projection_event_append_atomicity_verified INTEGER NOT NULL CHECK (local_projection_event_append_atomicity_verified = 1),
    runtime_authentication_verified INTEGER NOT NULL CHECK (runtime_authentication_verified = 0),
    rollback_protection_verified INTEGER NOT NULL CHECK (rollback_protection_verified = 0),
    projection_effect_atomicity_verified INTEGER NOT NULL CHECK (projection_effect_atomicity_verified = 0),
    external_side_effects_authorized INTEGER NOT NULL CHECK (external_side_effects_authorized = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_CONSUMER_CURSOR_MAINNET_STATUS}'),
    PRIMARY KEY (consumer_id, cursor_revision_be),
    UNIQUE (consumer_id, cursor_revision_text),
    UNIQUE (consumer_id, target_commit_sequence_be),
    UNIQUE (consumer_id, target_commit_sequence_text),
    UNIQUE (consumer_id, permit_sha256),
    UNIQUE (consumer_id, projection_commitment_sha256),
    UNIQUE (cursor_sha256)
  ) STRICT, WITHOUT ROWID`,
  reward_consumer_projection_events: `CREATE TABLE reward_consumer_projection_events (
    consumer_id TEXT NOT NULL CHECK (
      length(consumer_id) BETWEEN 1 AND 128
      AND consumer_id = lower(consumer_id)
      AND consumer_id NOT GLOB '*[^a-z0-9._-]*'
    ),
    target_commit_sequence_be BLOB NOT NULL CHECK (typeof(target_commit_sequence_be) = 'blob' AND length(target_commit_sequence_be) = 8),
    target_commit_sequence_text TEXT NOT NULL CHECK (
      length(target_commit_sequence_text) BETWEEN 1 AND 20
      AND target_commit_sequence_text NOT GLOB '*[^0-9]*'
      AND substr(target_commit_sequence_text, 1, 1) BETWEEN '1' AND '9'
    ),
    target_commit_sha256 TEXT NOT NULL CHECK (${hexCheck("target_commit_sha256")}),
    checkpoint_sha256 TEXT NOT NULL CHECK (${hexCheck("checkpoint_sha256")}),
    permit_sha256 TEXT NOT NULL CHECK (${hexCheck("permit_sha256")}),
    projection_kind TEXT NOT NULL CHECK (length(projection_kind) BETWEEN 1 AND 128),
    projection_key TEXT NOT NULL CHECK (length(projection_key) BETWEEN 1 AND 128),
    payload_sha256 TEXT NOT NULL CHECK (${hexCheck("payload_sha256")}),
    projection_commitment_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("projection_commitment_sha256")}),
    cursor_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("cursor_sha256")}),
    event_record_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("event_record_sha256")}),
    record_blob BLOB NOT NULL CHECK (typeof(record_blob) = 'blob' AND length(record_blob) > 0),
    status TEXT NOT NULL CHECK (status = '${REWARD_CONSUMER_CURSOR_STATUS}'),
    durable_cursor_persistence_verified INTEGER NOT NULL CHECK (durable_cursor_persistence_verified = 1),
    local_projection_event_append_atomicity_verified INTEGER NOT NULL CHECK (local_projection_event_append_atomicity_verified = 1),
    materialized_projection_state_verified INTEGER NOT NULL CHECK (materialized_projection_state_verified = 0),
    runtime_authentication_verified INTEGER NOT NULL CHECK (runtime_authentication_verified = 0),
    rollback_protection_verified INTEGER NOT NULL CHECK (rollback_protection_verified = 0),
    external_side_effects_authorized INTEGER NOT NULL CHECK (external_side_effects_authorized = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_CONSUMER_CURSOR_MAINNET_STATUS}'),
    PRIMARY KEY (consumer_id, target_commit_sequence_be),
    UNIQUE (consumer_id, target_commit_sequence_text),
    UNIQUE (consumer_id, permit_sha256),
    FOREIGN KEY (cursor_sha256) REFERENCES reward_consumer_cursor_history(cursor_sha256)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT, WITHOUT ROWID`,
});

function immutableTriggerSql(table, operation) {
  return `CREATE TRIGGER ${table}_forbid_${operation.toLowerCase()}
    BEFORE ${operation} ON ${table}
    BEGIN
      SELECT RAISE(ABORT, 'REWARD_CONSUMER_CURSOR_APPEND_ONLY_${operation}_FORBIDDEN');
    END`;
}

const TABLE_NAMES = Object.freeze(Object.keys(TABLE_SQL));
const TRIGGER_SQL = Object.freeze(Object.fromEntries(TABLE_NAMES.flatMap((table) => [
  [`${table}_forbid_update`, immutableTriggerSql(table, "UPDATE")],
  [`${table}_forbid_delete`, immutableTriggerSql(table, "DELETE")],
])));
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
]);

function normalizeSql(sql) {
  return sql.replace(/;\s*$/u, "").replace(/\s+/gu, " ").trim();
}

function schemaManifestSha256(objects = SCHEMA_OBJECTS) {
  return createHash("sha256")
    .update(objects
      .map(({ type, name, tableName, sql }) => `${type}|${name}|${tableName}|${normalizeSql(sql)}`)
      .sort()
      .join("\n"))
    .digest("hex");
}

export const REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_MANIFEST_SHA256 =
  schemaManifestSha256();

function hasExactKeys(value, expected) {
  if (!value
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) return false;
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

function asConsumerId(value) {
  if (typeof value !== "string" || !CONSUMER_ID.test(value)) {
    throw new TypeError("consumerId must be 1-128 canonical lowercase ASCII characters");
  }
  return value;
}

function asProjectionLabel(value, label) {
  if (typeof value !== "string" || !PROJECTION_LABEL.test(value)) {
    throw new TypeError(`${label} must be 1-128 canonical lowercase ASCII characters`);
  }
  return value;
}

function asU64(value, label) {
  if (typeof value !== "bigint" || value < 0n || value > U64_MAX) {
    throw new TypeError(`${label} must be a u64 bigint`);
  }
  return value;
}

function asHex32(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${label} must be canonical lowercase 32-byte hexadecimal`);
  }
  return value;
}

function u64Be(value, label) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(asU64(value, label));
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

function cloneAndFreeze(value) {
  const copy = structuredClone(value);
  const seen = new Set();
  const freeze = (entry) => {
    if (entry === null || typeof entry !== "object" || seen.has(entry)) return entry;
    seen.add(entry);
    // ECMAScript forbids freezing a nonempty integer-indexed view. The typed
    // CAS codec and structuredClone above already detach the bytes; each
    // public read returns another detached clone, so no durable/caller alias
    // is exposed even though the copied view itself cannot be frozen.
    if (Buffer.isBuffer(entry) || entry instanceof Uint8Array) return entry;
    for (const child of Object.values(entry)) freeze(child);
    Object.freeze(entry);
    return entry;
  };
  return freeze(copy);
}

function pragmaScalar(database, pragma) {
  const row = database.prepare(`PRAGMA ${pragma}`).get();
  return row ? Object.values(row)[0] : undefined;
}

function configureDatabase(database, busyTimeoutMs) {
  if (typeof database.enableDefensive !== "function") {
    throw new Error("REWARD_CONSUMER_CURSOR_NODE24_DEFENSIVE_MODE_REQUIRED");
  }
  database.enableDefensive(true);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA recursive_triggers = ON");
  database.exec("PRAGMA trusted_schema = OFF");
  database.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
  if (String(pragmaScalar(database, "journal_mode = WAL")).toLowerCase() !== "wal") {
    throw new Error("REWARD_CONSUMER_CURSOR_WAL_REQUIRED");
  }
  database.exec("PRAGMA synchronous = FULL");
  if (Number(pragmaScalar(database, "foreign_keys")) !== 1
    || Number(pragmaScalar(database, "recursive_triggers")) !== 1
    || Number(pragmaScalar(database, "trusted_schema")) !== 0
    || Number(pragmaScalar(database, "synchronous")) !== 2) {
    throw new Error("REWARD_CONSUMER_CURSOR_REQUIRED_PRAGMA_NOT_ACTIVE");
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
    throw new Error("REWARD_CONSUMER_CURSOR_SCHEMA_OBJECT_SET_MISMATCH");
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
      throw new Error("REWARD_CONSUMER_CURSOR_SCHEMA_DEFINITION_MISMATCH");
    }
    return { type: row.type, name: row.name, tableName: row.tbl_name, sql: row.sql };
  });
  if (schemaManifestSha256(normalized)
    !== REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_MANIFEST_SHA256) {
    throw new Error("REWARD_CONSUMER_CURSOR_SCHEMA_MANIFEST_MISMATCH");
  }
}

function assertDatabaseIntegrity(database) {
  const rows = database.prepare("PRAGMA integrity_check").all();
  if (rows.length !== 1 || String(Object.values(rows[0])[0]).toLowerCase() !== "ok") {
    throw new Error("REWARD_CONSUMER_CURSOR_INTEGRITY_CHECK_FAILED");
  }
  if (database.prepare("PRAGMA foreign_key_check").all().length !== 0) {
    throw new Error("REWARD_CONSUMER_CURSOR_FOREIGN_KEY_CHECK_FAILED");
  }
}

function validateMeta(database) {
  const rows = database.prepare("SELECT * FROM reward_consumer_cursor_meta").all();
  if (rows.length !== 1) throw new Error("REWARD_CONSUMER_CURSOR_META_SINGLETON_REQUIRED");
  const [row] = rows;
  if (row.singleton_id !== 1
    || row.adapter_schema !== REWARD_CONSUMER_CURSOR_SQLITE_ADAPTER_SCHEMA
    || row.schema_version !== REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_VERSION
    || row.adapter_status !== REWARD_CONSUMER_CURSOR_STATUS
    || row.schema_manifest_sha256 !== REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_MANIFEST_SHA256
    || row.local_projection_event_append_atomicity_verified !== 1
    || row.materialized_projection_state_verified !== 0
    || row.runtime_authentication_verified !== 0
    || row.rollback_protection_verified !== 0
    || row.projection_effect_atomicity_verified !== 0
    || row.external_side_effects_authorized !== 0
    || row.activation_ready !== 0
    || row.mainnet_status !== REWARD_CONSUMER_CURSOR_MAINNET_STATUS) {
    throw new Error("REWARD_CONSUMER_CURSOR_META_MISMATCH");
  }
}

function normalizeProjectionInput(projection, permit) {
  if (!hasExactKeys(projection, PROJECTION_INPUT_KEYS)) {
    throw new Error("INVALID_REWARD_CONSUMER_LOCAL_PROJECTION_INPUT");
  }
  // Encode before cloning so hostile accessors/prototypes are rejected by the
  // canonical codec without being invoked by structuredClone.
  const payload = cloneAndFreeze(decodeRewardCasTypedValue(
    encodeRewardCasTypedValue(projection.payload),
  ));
  const core = {
    schema: REWARD_CONSUMER_PROJECTION_COMMITMENT_SCHEMA,
    consumerId: asConsumerId(permit.consumerId),
    targetCommitSequence: asU64(permit.targetCommitSequence, "projection target sequence"),
    targetCommitSha256: asHex32(permit.targetCommitSha256, "projection target digest"),
    checkpointSha256: asHex32(permit.checkpointSha256, "projection checkpoint digest"),
    permitSha256: asHex32(permit.permitSha256, "projection permit digest"),
    projectionKind: asProjectionLabel(projection.kind, "projection kind"),
    projectionKey: asProjectionLabel(projection.key, "projection key"),
    payloadSha256: rewardCasStateSha256(payload),
  };
  return Object.freeze({
    ...core,
    payload,
    projectionCommitmentSha256: rewardCasStateSha256(core),
  });
}

function createCursorRecord({ permit, previousCursor, projection }) {
  const sequence = asU64(permit.targetCommitSequence, "permit target commit sequence");
  if (sequence === 0n) throw new Error("REWARD_CONSUMER_CURSOR_TARGET_MUST_BE_COMMITTED");
  const previousRevision = previousCursor?.cursorRevision ?? 0n;
  if (sequence !== previousRevision + 1n) {
    if (sequence <= previousRevision) throw new Error("REWARD_CONSUMER_CURSOR_REPLAY");
    throw new Error("REWARD_CONSUMER_CURSOR_SKIP_FORBIDDEN");
  }
  const core = {
    schema: REWARD_CONSUMER_CURSOR_SCHEMA,
    status: REWARD_CONSUMER_CURSOR_STATUS,
    consumerId: asConsumerId(permit.consumerId),
    cursorRevision: sequence,
    targetCommitSequence: sequence,
    targetCommitSha256: asHex32(permit.targetCommitSha256, "target commit digest"),
    checkpointSha256: asHex32(permit.checkpointSha256, "checkpoint digest"),
    permitSha256: asHex32(permit.permitSha256, "permit digest"),
    previousCursorSha256: previousCursor?.cursorSha256 ?? REWARD_CAS_ZERO_SHA256,
    sourceDailyLawReferenceStateSha256: asHex32(
      permit.sourceDailyLawReferenceStateSha256,
      "source Daily-Law digest",
    ),
    consumerDailyLawReferenceStateSha256: asHex32(
      permit.consumerDailyLawReferenceStateSha256,
      "consumer Daily-Law digest",
    ),
    projectionCommitmentSha256: projection.projectionCommitmentSha256,
    durableCursorPersistenceVerified: true,
    localProjectionEventAppendAtomicityVerified: true,
    runtimeAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    projectionEffectAtomicityVerified: false,
    externalSideEffectsAuthorized: false,
    activationReady: false,
    mainnetStatus: REWARD_CONSUMER_CURSOR_MAINNET_STATUS,
  };
  return Object.freeze({ ...core, cursorSha256: rewardCasStateSha256(core) });
}

function createProjectionEventRecord({ permit, cursor, projection }) {
  const core = {
    schema: REWARD_CONSUMER_PROJECTION_EVENT_SCHEMA,
    status: REWARD_CONSUMER_CURSOR_STATUS,
    consumerId: cursor.consumerId,
    targetCommitSequence: cursor.targetCommitSequence,
    targetCommitSha256: cursor.targetCommitSha256,
    checkpointSha256: cursor.checkpointSha256,
    permitSha256: cursor.permitSha256,
    projectionKind: projection.projectionKind,
    projectionKey: projection.projectionKey,
    payload: projection.payload,
    payloadSha256: projection.payloadSha256,
    projectionCommitmentSha256: projection.projectionCommitmentSha256,
    cursorSha256: cursor.cursorSha256,
    durableCursorPersistenceVerified: true,
    localProjectionEventAppendAtomicityVerified: true,
    materializedProjectionStateVerified: false,
    runtimeAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    externalSideEffectsAuthorized: false,
    activationReady: false,
    mainnetStatus: REWARD_CONSUMER_CURSOR_MAINNET_STATUS,
  };
  if (permit.consumerId !== core.consumerId) {
    throw new Error("REWARD_CONSUMER_PROJECTION_PERMIT_BINDING_MISMATCH");
  }
  return Object.freeze({ ...core, eventRecordSha256: rewardCasStateSha256(core) });
}

export function validateRewardConsumerCursorRecord(record, previousCursor = null) {
  if (!hasExactKeys(record, RECORD_KEYS)
    || record.schema !== REWARD_CONSUMER_CURSOR_SCHEMA
    || record.status !== REWARD_CONSUMER_CURSOR_STATUS
    || record.durableCursorPersistenceVerified !== true
    || record.localProjectionEventAppendAtomicityVerified !== true
    || record.runtimeAuthenticationVerified !== false
    || record.rollbackProtectionVerified !== false
    || record.projectionEffectAtomicityVerified !== false
    || record.externalSideEffectsAuthorized !== false
    || record.activationReady !== false
    || record.mainnetStatus !== REWARD_CONSUMER_CURSOR_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_CONSUMER_CURSOR_RECORD");
  }
  asConsumerId(record.consumerId);
  const revision = asU64(record.cursorRevision, "cursor revision");
  if (revision === 0n
    || asU64(record.targetCommitSequence, "target commit sequence") !== revision
    || revision !== (previousCursor?.cursorRevision ?? 0n) + 1n
    || record.previousCursorSha256 !== (previousCursor?.cursorSha256 ?? REWARD_CAS_ZERO_SHA256)) {
    throw new Error("REWARD_CONSUMER_CURSOR_CHAIN_MISMATCH");
  }
  for (const [value, label] of [
    [record.targetCommitSha256, "target commit digest"],
    [record.checkpointSha256, "checkpoint digest"],
    [record.permitSha256, "permit digest"],
    [record.previousCursorSha256, "previous cursor digest"],
    [record.sourceDailyLawReferenceStateSha256, "source Daily-Law digest"],
    [record.consumerDailyLawReferenceStateSha256, "consumer Daily-Law digest"],
    [record.projectionCommitmentSha256, "projection commitment digest"],
    [record.cursorSha256, "cursor digest"],
  ]) asHex32(value, label);
  const { cursorSha256, ...core } = record;
  if (cursorSha256 !== rewardCasStateSha256(core)) {
    throw new Error("REWARD_CONSUMER_CURSOR_DIGEST_MISMATCH");
  }
  return record;
}

export function validateRewardConsumerProjectionEventRecord(record, cursor) {
  if (!hasExactKeys(record, PROJECTION_EVENT_KEYS)
    || record.schema !== REWARD_CONSUMER_PROJECTION_EVENT_SCHEMA
    || record.status !== REWARD_CONSUMER_CURSOR_STATUS
    || record.durableCursorPersistenceVerified !== true
    || record.localProjectionEventAppendAtomicityVerified !== true
    || record.materializedProjectionStateVerified !== false
    || record.runtimeAuthenticationVerified !== false
    || record.rollbackProtectionVerified !== false
    || record.externalSideEffectsAuthorized !== false
    || record.activationReady !== false
    || record.mainnetStatus !== REWARD_CONSUMER_CURSOR_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_CONSUMER_PROJECTION_EVENT_RECORD");
  }
  asConsumerId(record.consumerId);
  asProjectionLabel(record.projectionKind, "projection kind");
  asProjectionLabel(record.projectionKey, "projection key");
  const sequence = asU64(record.targetCommitSequence, "projection target sequence");
  for (const [value, label] of [
    [record.targetCommitSha256, "projection target digest"],
    [record.checkpointSha256, "projection checkpoint digest"],
    [record.permitSha256, "projection permit digest"],
    [record.payloadSha256, "projection payload digest"],
    [record.projectionCommitmentSha256, "projection commitment digest"],
    [record.cursorSha256, "projection cursor digest"],
    [record.eventRecordSha256, "projection event-record digest"],
  ]) asHex32(value, label);
  encodeRewardCasTypedValue(record.payload);
  if (record.payloadSha256 !== rewardCasStateSha256(record.payload)) {
    throw new Error("REWARD_CONSUMER_PROJECTION_PAYLOAD_DIGEST_MISMATCH");
  }
  const commitmentCore = {
    schema: REWARD_CONSUMER_PROJECTION_COMMITMENT_SCHEMA,
    consumerId: record.consumerId,
    targetCommitSequence: sequence,
    targetCommitSha256: record.targetCommitSha256,
    checkpointSha256: record.checkpointSha256,
    permitSha256: record.permitSha256,
    projectionKind: record.projectionKind,
    projectionKey: record.projectionKey,
    payloadSha256: record.payloadSha256,
  };
  if (record.projectionCommitmentSha256 !== rewardCasStateSha256(commitmentCore)) {
    throw new Error("REWARD_CONSUMER_PROJECTION_COMMITMENT_MISMATCH");
  }
  if (!cursor
    || record.consumerId !== cursor.consumerId
    || sequence !== cursor.targetCommitSequence
    || record.targetCommitSha256 !== cursor.targetCommitSha256
    || record.checkpointSha256 !== cursor.checkpointSha256
    || record.permitSha256 !== cursor.permitSha256
    || record.projectionCommitmentSha256 !== cursor.projectionCommitmentSha256
    || record.cursorSha256 !== cursor.cursorSha256) {
    throw new Error("REWARD_CONSUMER_PROJECTION_CURSOR_BINDING_MISMATCH");
  }
  const { eventRecordSha256, ...core } = record;
  if (eventRecordSha256 !== rewardCasStateSha256(core)) {
    throw new Error("REWARD_CONSUMER_PROJECTION_EVENT_DIGEST_MISMATCH");
  }
  return record;
}

function decodeRecord(value) {
  try {
    return decodeRewardCasTypedValue(value);
  } catch (error) {
    throw new Error("REWARD_CONSUMER_CURSOR_RECORD_DECODE_FAILED", { cause: error });
  }
}

function validateHistory(database) {
  const rows = database.prepare(`
    SELECT * FROM reward_consumer_cursor_history
    ORDER BY consumer_id, cursor_revision_be
  `).all();
  const previousByConsumer = new Map();
  const records = rows.map((row) => {
    const record = decodeRecord(row.record_blob);
    const previous = previousByConsumer.get(row.consumer_id) ?? null;
    validateRewardConsumerCursorRecord(record, previous);
    const revisionFromBlob = u64FromBe(row.cursor_revision_be, "cursor revision");
    const targetFromBlob = u64FromBe(row.target_commit_sequence_be, "target sequence");
    if (row.consumer_id !== record.consumerId
      || revisionFromBlob !== record.cursorRevision
      || row.cursor_revision_text !== record.cursorRevision.toString()
      || targetFromBlob !== record.targetCommitSequence
      || row.target_commit_sequence_text !== record.targetCommitSequence.toString()
      || row.target_commit_sha256 !== record.targetCommitSha256
      || row.checkpoint_sha256 !== record.checkpointSha256
      || row.permit_sha256 !== record.permitSha256
      || row.projection_commitment_sha256 !== record.projectionCommitmentSha256
      || row.previous_cursor_sha256 !== record.previousCursorSha256
      || row.cursor_sha256 !== record.cursorSha256
      || row.status !== REWARD_CONSUMER_CURSOR_STATUS
      || row.durable_cursor_persistence_verified !== 1
      || row.local_projection_event_append_atomicity_verified !== 1
      || row.runtime_authentication_verified !== 0
      || row.rollback_protection_verified !== 0
      || row.projection_effect_atomicity_verified !== 0
      || row.external_side_effects_authorized !== 0
      || row.activation_ready !== 0
      || row.mainnet_status !== REWARD_CONSUMER_CURSOR_MAINNET_STATUS) {
      throw new Error("REWARD_CONSUMER_CURSOR_ROW_BINDING_MISMATCH");
    }
    previousByConsumer.set(record.consumerId, record);
    return record;
  });
  const cursorBySha256 = new Map(records.map((record) => [record.cursorSha256, record]));
  const eventRows = database.prepare(`
    SELECT * FROM reward_consumer_projection_events
    ORDER BY consumer_id, target_commit_sequence_be
  `).all();
  const projectionEvents = eventRows.map((row) => {
    const event = decodeRecord(row.record_blob);
    const cursor = cursorBySha256.get(row.cursor_sha256);
    validateRewardConsumerProjectionEventRecord(event, cursor);
    const sequence = u64FromBe(row.target_commit_sequence_be, "projection target sequence");
    if (row.consumer_id !== event.consumerId
      || sequence !== event.targetCommitSequence
      || row.target_commit_sequence_text !== event.targetCommitSequence.toString()
      || row.target_commit_sha256 !== event.targetCommitSha256
      || row.checkpoint_sha256 !== event.checkpointSha256
      || row.permit_sha256 !== event.permitSha256
      || row.projection_kind !== event.projectionKind
      || row.projection_key !== event.projectionKey
      || row.payload_sha256 !== event.payloadSha256
      || row.projection_commitment_sha256 !== event.projectionCommitmentSha256
      || row.cursor_sha256 !== event.cursorSha256
      || row.event_record_sha256 !== event.eventRecordSha256
      || row.status !== REWARD_CONSUMER_CURSOR_STATUS
      || row.durable_cursor_persistence_verified !== 1
      || row.local_projection_event_append_atomicity_verified !== 1
      || row.materialized_projection_state_verified !== 0
      || row.runtime_authentication_verified !== 0
      || row.rollback_protection_verified !== 0
      || row.external_side_effects_authorized !== 0
      || row.activation_ready !== 0
      || row.mainnet_status !== REWARD_CONSUMER_CURSOR_MAINNET_STATUS) {
      throw new Error("REWARD_CONSUMER_PROJECTION_EVENT_ROW_BINDING_MISMATCH");
    }
    cursorBySha256.delete(event.cursorSha256);
    return event;
  });
  if (cursorBySha256.size !== 0 || projectionEvents.length !== records.length) {
    throw new Error("REWARD_CONSUMER_CURSOR_PROJECTION_EVENT_SET_INCOMPLETE");
  }
  return {
    records,
    projectionEvents,
    currentByConsumer: previousByConsumer,
  };
}

function validateDatabase(database) {
  validateSchema(database);
  validateMeta(database);
  assertDatabaseIntegrity(database);
  return validateHistory(database);
}

function initializeDatabase(database) {
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const { sql } of SCHEMA_OBJECTS) database.exec(sql);
    database.prepare(`
      INSERT INTO reward_consumer_cursor_meta (
        singleton_id, adapter_schema, schema_version, adapter_status,
        schema_manifest_sha256, local_projection_event_append_atomicity_verified,
        materialized_projection_state_verified, runtime_authentication_verified,
        rollback_protection_verified, projection_effect_atomicity_verified,
        external_side_effects_authorized, activation_ready, mainnet_status
      ) VALUES (1, ?, ?, ?, ?, 1, 0, 0, 0, 0, 0, 0, ?)
    `).run(
      REWARD_CONSUMER_CURSOR_SQLITE_ADAPTER_SCHEMA,
      REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_VERSION,
      REWARD_CONSUMER_CURSOR_STATUS,
      REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_MANIFEST_SHA256,
      REWARD_CONSUMER_CURSOR_MAINNET_STATUS,
    );
    validateDatabase(database);
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

function insertCursor(database, record) {
  database.prepare(`
    INSERT INTO reward_consumer_cursor_history (
      consumer_id, cursor_revision_be, cursor_revision_text,
      target_commit_sequence_be, target_commit_sequence_text,
      target_commit_sha256, checkpoint_sha256, permit_sha256, projection_commitment_sha256,
      previous_cursor_sha256, cursor_sha256, record_blob, status,
      durable_cursor_persistence_verified, local_projection_event_append_atomicity_verified,
      runtime_authentication_verified,
      rollback_protection_verified, projection_effect_atomicity_verified,
      external_side_effects_authorized, activation_ready, mainnet_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 0, 0, 0, 0, ?)
  `).run(
    record.consumerId,
    u64Be(record.cursorRevision, "cursor revision"),
    record.cursorRevision.toString(),
    u64Be(record.targetCommitSequence, "target commit sequence"),
    record.targetCommitSequence.toString(),
    record.targetCommitSha256,
    record.checkpointSha256,
    record.permitSha256,
    record.projectionCommitmentSha256,
    record.previousCursorSha256,
    record.cursorSha256,
    encodeRewardCasTypedValue(record),
    REWARD_CONSUMER_CURSOR_STATUS,
    REWARD_CONSUMER_CURSOR_MAINNET_STATUS,
  );
}

function insertProjectionEvent(database, event) {
  database.prepare(`
    INSERT INTO reward_consumer_projection_events (
      consumer_id, target_commit_sequence_be, target_commit_sequence_text,
      target_commit_sha256, checkpoint_sha256, permit_sha256,
      projection_kind, projection_key, payload_sha256,
      projection_commitment_sha256, cursor_sha256, event_record_sha256,
      record_blob, status, durable_cursor_persistence_verified,
      local_projection_event_append_atomicity_verified,
      materialized_projection_state_verified, runtime_authentication_verified,
      rollback_protection_verified, external_side_effects_authorized,
      activation_ready, mainnet_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 0, 0, 0, 0, ?)
  `).run(
    event.consumerId,
    u64Be(event.targetCommitSequence, "projection target sequence"),
    event.targetCommitSequence.toString(),
    event.targetCommitSha256,
    event.checkpointSha256,
    event.permitSha256,
    event.projectionKind,
    event.projectionKey,
    event.payloadSha256,
    event.projectionCommitmentSha256,
    event.cursorSha256,
    event.eventRecordSha256,
    encodeRewardCasTypedValue(event),
    REWARD_CONSUMER_CURSOR_STATUS,
    REWARD_CONSUMER_CURSOR_MAINNET_STATUS,
  );
}

/**
 * Require a cursor adapter created by this exact loaded module instance.
 * Candidate properties are never read before WeakSet membership succeeds.
 */
export function assertSqliteRewardConsumerCursorAdapter(value) {
  if ((typeof value !== "object" && typeof value !== "function")
    || value === null
    || !SQLITE_REWARD_CONSUMER_CURSOR_ADAPTERS.has(value)) {
    throw new TypeError("reward consumer cursor requires its process-branded SQLite adapter");
  }
  return value;
}

export function createSqliteRewardConsumerCursor({
  databasePath,
  busyTimeoutMs = 0,
  testOnlyFault = null,
} = {}) {
  if (typeof databasePath !== "string" || databasePath.length === 0 || databasePath === ":memory:") {
    throw new TypeError("reward consumer cursor requires a file-backed databasePath");
  }
  if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0 || busyTimeoutMs > 60_000) {
    throw new RangeError("reward consumer cursor busyTimeoutMs must be from 0 through 60000");
  }
  if (!ACCEPTED_FAULTS.has(testOnlyFault)) {
    throw new Error("UNKNOWN_TEST_ONLY_REWARD_CONSUMER_CURSOR_SQLITE_FAULT");
  }
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
    if (closed) throw new Error("REWARD_CONSUMER_CURSOR_STORE_CLOSED");
  };
  const fault = (point) => {
    if (testOnlyFault === point) {
      throw new Error(`TEST_ONLY_REWARD_CONSUMER_CURSOR_SQLITE_FAULT_${point}`);
    }
  };
  try {
    configureDatabase(database, busyTimeoutMs);
    if (userSchemaRows(database).length === 0) initializeDatabase(database);
    else validateDatabase(database);
  } catch (error) {
    database.close();
    closed = true;
    throw error;
  }

  const store = {
    adapterSchema: REWARD_CONSUMER_CURSOR_SQLITE_ADAPTER_SCHEMA,
    schemaVersion: REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_VERSION,
    schemaManifestSha256: REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_MANIFEST_SHA256,
    status: REWARD_CONSUMER_CURSOR_STATUS,
    durableCursorPersistenceVerified: true,
    localProjectionEventAppendAtomicityVerified: true,
    materializedProjectionStateVerified: false,
    runtimeAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    projectionEffectAtomicityVerified: false,
    externalSideEffectsAuthorized: false,
    activationReady: false,
    mainnetStatus: REWARD_CONSUMER_CURSOR_MAINNET_STATUS,
    readCursor(consumerId) {
      ensureOpen();
      const { currentByConsumer } = validateDatabase(database);
      const record = currentByConsumer.get(asConsumerId(consumerId));
      return record ? cloneAndFreeze(record) : null;
    },
    readProjectionEvent(consumerId, targetCommitSequence) {
      ensureOpen();
      const canonicalConsumerId = asConsumerId(consumerId);
      const sequence = asU64(targetCommitSequence, "targetCommitSequence");
      const { projectionEvents } = validateDatabase(database);
      const event = projectionEvents.find((candidate) => (
        candidate.consumerId === canonicalConsumerId
        && candidate.targetCommitSequence === sequence
      ));
      return event ? cloneAndFreeze(event) : null;
    },
    snapshot() {
      ensureOpen();
      const { records, projectionEvents } = validateDatabase(database);
      return Object.freeze({
        schema: REWARD_CONSUMER_CURSOR_SQLITE_ADAPTER_SCHEMA,
        schemaVersion: REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_VERSION,
        schemaManifestSha256: REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_MANIFEST_SHA256,
        cursors: Object.freeze(records.map(cloneAndFreeze)),
        projectionEvents: Object.freeze(projectionEvents.map(cloneAndFreeze)),
        durableCursorPersistenceVerified: true,
        localProjectionEventAppendAtomicityVerified: true,
        materializedProjectionStateVerified: false,
        runtimeAuthenticationVerified: false,
        rollbackProtectionVerified: false,
        projectionEffectAtomicityVerified: false,
        externalSideEffectsAuthorized: false,
        activationReady: false,
        mainnetStatus: REWARD_CONSUMER_CURSOR_MAINNET_STATUS,
      });
    },
    consumePermit(input) {
      const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
      const consumerId = asConsumerId(input.consumerId);
      const targetCommitSequence = asU64(input.targetCommitSequence, "targetCommitSequence");
      const targetCommitSha256 = asHex32(input.targetCommitSha256, "targetCommitSha256");
      const permit = assertRewardConsumerPermit({
        dailyLawState,
        permit: input.permit,
        consumerId,
        targetCommitSequence,
        targetCommitSha256,
      });
      ensureOpen();
      database.exec("BEGIN IMMEDIATE");
      try {
        const { currentByConsumer } = validateDatabase(database);
        const projection = normalizeProjectionInput(input.projection, permit);
        const record = createCursorRecord({
          permit,
          previousCursor: currentByConsumer.get(consumerId) ?? null,
          projection,
        });
        const projectionEvent = createProjectionEventRecord({ permit, cursor: record, projection });
        insertCursor(database, record);
        fault(REWARD_CONSUMER_CURSOR_SQLITE_TEST_FAULT.AFTER_CURSOR);
        insertProjectionEvent(database, projectionEvent);
        fault(REWARD_CONSUMER_CURSOR_SQLITE_TEST_FAULT.AFTER_PROJECTION_EVENT);
        validateDatabase(database);
        database.exec("COMMIT");
        return cloneAndFreeze(record);
      } catch (error) {
        try {
          database.exec("ROLLBACK");
        } catch {
          // Preserve the first transaction failure.
        }
        throw error;
      }
    },
    close() {
      if (!closed) {
        database.close();
        closed = true;
      }
    },
  };
  const frozen = Object.freeze(store);
  SQLITE_REWARD_CONSUMER_CURSOR_ADAPTERS.add(frozen);
  return frozen;
}

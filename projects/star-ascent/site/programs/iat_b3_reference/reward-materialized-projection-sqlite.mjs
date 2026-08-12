import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { assertDailyLawWriteAllowed } from "./daily-lockdown-consensus.mjs";
import { assertRewardConsumerPermit } from "./reward-consumer-gate.mjs";
import {
  REWARD_CAS_ZERO_SHA256,
  decodeRewardCasTypedValue,
  encodeRewardCasTypedValue,
  rewardCasStateSha256,
} from "./reward-persistence-cas.mjs";

export const REWARD_MATERIALIZED_PROJECTION_CURSOR_SCHEMA =
  "iat-b3-reward-materialized-projection-cursor/v1";
export const REWARD_MATERIALIZED_PROJECTION_COMMITMENT_SCHEMA =
  "iat-b3-reward-materialized-projection-commitment/v1";
export const REWARD_MATERIALIZED_PROJECTION_EVENT_SCHEMA =
  "iat-b3-reward-materialized-projection-event/v1";
export const REWARD_MATERIALIZED_PROJECTION_STATE_SCHEMA =
  "iat-b3-reward-materialized-projection-state/v1";
export const REWARD_MATERIALIZED_PROJECTION_SQLITE_ADAPTER_SCHEMA =
  "iat-b3-reward-materialized-projection-sqlite-adapter/v1";
export const REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_VERSION = 1;
export const REWARD_MATERIALIZED_PROJECTION_STATUS =
  "HOST_ONLY_NON_ACTIVATING_ATOMIC_MATERIALIZED_LOCAL_PROJECTION";
export const REWARD_MATERIALIZED_PROJECTION_EFFECT_SCOPE =
  "DURABLE_LOCAL_SQLITE_STATE_ONLY";
export const REWARD_MATERIALIZED_PROJECTION_MAINNET_STATUS = "HOLD";
export const REWARD_MATERIALIZED_PROJECTION_DISPOSITION = Object.freeze({
  COMMITTED: "COMMITTED",
  RECONCILED_EXACT_REPLAY: "RECONCILED_EXACT_REPLAY",
});
export const REWARD_MATERIALIZED_PROJECTION_SQLITE_TEST_FAULT = Object.freeze({
  AFTER_CURSOR: "AFTER_CURSOR",
  AFTER_PROJECTION_EVENT: "AFTER_PROJECTION_EVENT",
  AFTER_MATERIALIZED_STATE: "AFTER_MATERIALIZED_STATE",
  AFTER_COMMIT: "AFTER_COMMIT",
});

const U64_MAX = (1n << 64n) - 1n;
const CONSUMER_ID = /^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$/u;
const PROJECTION_LABEL = /^[a-z0-9](?:[a-z0-9._:/-]{0,126}[a-z0-9])?$/u;
const HEX_32_CHECK = "length(%s) = 64 AND %s NOT GLOB '*[^0-9a-f]*'";
const SQLITE_REWARD_MATERIALIZED_PROJECTION_ADAPTERS = new WeakSet();
const ACCEPTED_FAULTS = new Set([
  null,
  ...Object.values(REWARD_MATERIALIZED_PROJECTION_SQLITE_TEST_FAULT),
]);
const PROJECTION_INPUT_KEYS = Object.freeze(["kind", "key", "payload"]);
const CURSOR_KEYS = Object.freeze([
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
  "materializedProjectionStateVerified",
  "projectionEffectScope",
  "projectionEffectAtomicityVerified",
  "runtimeAuthenticationVerified",
  "providerAuthenticityVerified",
  "externalRollbackAnchorVerified",
  "rollbackProtectionVerified",
  "externalSideEffectsAuthorized",
  "activationReady",
  "mainnetStatus",
  "cursorSha256",
]);
const STATE_KEYS = Object.freeze([
  "schema",
  "status",
  "consumerId",
  "projectionKind",
  "projectionKey",
  "stateRevision",
  "targetCommitSequence",
  "targetCommitSha256",
  "checkpointSha256",
  "permitSha256",
  "payload",
  "payloadSha256",
  "projectionCommitmentSha256",
  "previousMaterializedStateSha256",
  "cursorSha256",
  "durableCursorPersistenceVerified",
  "localProjectionEventAppendAtomicityVerified",
  "materializedProjectionStateVerified",
  "projectionEffectScope",
  "projectionEffectAtomicityVerified",
  "runtimeAuthenticationVerified",
  "providerAuthenticityVerified",
  "externalRollbackAnchorVerified",
  "rollbackProtectionVerified",
  "externalSideEffectsAuthorized",
  "activationReady",
  "mainnetStatus",
  "materializedStateSha256",
]);
const EVENT_KEYS = Object.freeze([
  "schema",
  "status",
  "consumerId",
  "targetCommitSequence",
  "targetCommitSha256",
  "checkpointSha256",
  "permitSha256",
  "projectionKind",
  "projectionKey",
  "payloadSha256",
  "projectionCommitmentSha256",
  "cursorSha256",
  "materializedStateSha256",
  "durableCursorPersistenceVerified",
  "localProjectionEventAppendAtomicityVerified",
  "materializedProjectionStateVerified",
  "projectionEffectScope",
  "projectionEffectAtomicityVerified",
  "runtimeAuthenticationVerified",
  "providerAuthenticityVerified",
  "externalRollbackAnchorVerified",
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
  reward_materialized_projection_meta: `CREATE TABLE reward_materialized_projection_meta (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    adapter_schema TEXT NOT NULL CHECK (adapter_schema = '${REWARD_MATERIALIZED_PROJECTION_SQLITE_ADAPTER_SCHEMA}'),
    schema_version INTEGER NOT NULL CHECK (schema_version = ${REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_VERSION}),
    adapter_status TEXT NOT NULL CHECK (adapter_status = '${REWARD_MATERIALIZED_PROJECTION_STATUS}'),
    schema_manifest_sha256 TEXT NOT NULL CHECK (${hexCheck("schema_manifest_sha256")}),
    durable_cursor_persistence_verified INTEGER NOT NULL CHECK (durable_cursor_persistence_verified = 1),
    local_projection_event_append_atomicity_verified INTEGER NOT NULL CHECK (local_projection_event_append_atomicity_verified = 1),
    materialized_projection_state_verified INTEGER NOT NULL CHECK (materialized_projection_state_verified = 1),
    projection_effect_scope TEXT NOT NULL CHECK (projection_effect_scope = '${REWARD_MATERIALIZED_PROJECTION_EFFECT_SCOPE}'),
    projection_effect_atomicity_verified INTEGER NOT NULL CHECK (projection_effect_atomicity_verified = 1),
    runtime_authentication_verified INTEGER NOT NULL CHECK (runtime_authentication_verified = 0),
    provider_authenticity_verified INTEGER NOT NULL CHECK (provider_authenticity_verified = 0),
    external_rollback_anchor_verified INTEGER NOT NULL CHECK (external_rollback_anchor_verified = 0),
    rollback_protection_verified INTEGER NOT NULL CHECK (rollback_protection_verified = 0),
    external_side_effects_authorized INTEGER NOT NULL CHECK (external_side_effects_authorized = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_MATERIALIZED_PROJECTION_MAINNET_STATUS}')
  ) STRICT`,
  reward_materialized_projection_cursor_history: `CREATE TABLE reward_materialized_projection_cursor_history (
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
    cursor_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("cursor_sha256")}),
    record_blob BLOB NOT NULL CHECK (typeof(record_blob) = 'blob' AND length(record_blob) > 0),
    PRIMARY KEY (consumer_id, cursor_revision_be),
    UNIQUE (consumer_id, cursor_revision_text),
    UNIQUE (consumer_id, target_commit_sequence_be),
    UNIQUE (consumer_id, target_commit_sequence_text),
    UNIQUE (consumer_id, permit_sha256),
    UNIQUE (consumer_id, projection_commitment_sha256)
  ) STRICT, WITHOUT ROWID`,
  reward_materialized_projection_events: `CREATE TABLE reward_materialized_projection_events (
    consumer_id TEXT NOT NULL,
    target_commit_sequence_be BLOB NOT NULL CHECK (typeof(target_commit_sequence_be) = 'blob' AND length(target_commit_sequence_be) = 8),
    target_commit_sequence_text TEXT NOT NULL CHECK (
      length(target_commit_sequence_text) BETWEEN 1 AND 20
      AND target_commit_sequence_text NOT GLOB '*[^0-9]*'
      AND substr(target_commit_sequence_text, 1, 1) BETWEEN '1' AND '9'
    ),
    projection_kind TEXT NOT NULL CHECK (length(projection_kind) BETWEEN 1 AND 128),
    projection_key TEXT NOT NULL CHECK (length(projection_key) BETWEEN 1 AND 128),
    projection_commitment_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("projection_commitment_sha256")}),
    cursor_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("cursor_sha256")}),
    materialized_state_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("materialized_state_sha256")}),
    event_record_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("event_record_sha256")}),
    record_blob BLOB NOT NULL CHECK (typeof(record_blob) = 'blob' AND length(record_blob) > 0),
    PRIMARY KEY (consumer_id, target_commit_sequence_be),
    UNIQUE (consumer_id, target_commit_sequence_text),
    FOREIGN KEY (consumer_id, target_commit_sequence_be)
      REFERENCES reward_materialized_projection_cursor_history(consumer_id, target_commit_sequence_be)
      DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (cursor_sha256)
      REFERENCES reward_materialized_projection_cursor_history(cursor_sha256)
      DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (materialized_state_sha256)
      REFERENCES reward_materialized_projection_state_history(materialized_state_sha256)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT, WITHOUT ROWID`,
  reward_materialized_projection_state_history: `CREATE TABLE reward_materialized_projection_state_history (
    consumer_id TEXT NOT NULL,
    projection_kind TEXT NOT NULL CHECK (length(projection_kind) BETWEEN 1 AND 128),
    projection_key TEXT NOT NULL CHECK (length(projection_key) BETWEEN 1 AND 128),
    state_revision_be BLOB NOT NULL CHECK (typeof(state_revision_be) = 'blob' AND length(state_revision_be) = 8),
    state_revision_text TEXT NOT NULL CHECK (
      length(state_revision_text) BETWEEN 1 AND 20
      AND state_revision_text NOT GLOB '*[^0-9]*'
      AND substr(state_revision_text, 1, 1) BETWEEN '1' AND '9'
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
    payload_sha256 TEXT NOT NULL CHECK (${hexCheck("payload_sha256")}),
    projection_commitment_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("projection_commitment_sha256")}),
    previous_materialized_state_sha256 TEXT NOT NULL CHECK (${hexCheck("previous_materialized_state_sha256")}),
    cursor_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("cursor_sha256")}),
    materialized_state_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("materialized_state_sha256")}),
    record_blob BLOB NOT NULL CHECK (typeof(record_blob) = 'blob' AND length(record_blob) > 0),
    PRIMARY KEY (consumer_id, projection_kind, projection_key, state_revision_be),
    UNIQUE (consumer_id, projection_kind, projection_key, state_revision_text),
    UNIQUE (consumer_id, target_commit_sequence_be),
    UNIQUE (consumer_id, target_commit_sequence_text),
    FOREIGN KEY (consumer_id, target_commit_sequence_be)
      REFERENCES reward_materialized_projection_cursor_history(consumer_id, target_commit_sequence_be)
      DEFERRABLE INITIALLY DEFERRED,
    FOREIGN KEY (cursor_sha256)
      REFERENCES reward_materialized_projection_cursor_history(cursor_sha256)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT, WITHOUT ROWID`,
});

function immutableTriggerSql(table, operation) {
  return `CREATE TRIGGER ${table}_forbid_${operation.toLowerCase()}
    BEFORE ${operation} ON ${table}
    BEGIN
      SELECT RAISE(ABORT, 'REWARD_MATERIALIZED_PROJECTION_APPEND_ONLY_${operation}_FORBIDDEN');
    END`;
}

const CONFLICTING_INSERT_WHERE = Object.freeze({
  reward_materialized_projection_meta: `singleton_id = NEW.singleton_id`,
  reward_materialized_projection_cursor_history: `
    cursor_sha256 = NEW.cursor_sha256
    OR (consumer_id = NEW.consumer_id AND cursor_revision_be = NEW.cursor_revision_be)
    OR (consumer_id = NEW.consumer_id AND cursor_revision_text = NEW.cursor_revision_text)
    OR (consumer_id = NEW.consumer_id AND target_commit_sequence_be = NEW.target_commit_sequence_be)
    OR (consumer_id = NEW.consumer_id AND target_commit_sequence_text = NEW.target_commit_sequence_text)
    OR (consumer_id = NEW.consumer_id AND permit_sha256 = NEW.permit_sha256)
    OR (consumer_id = NEW.consumer_id AND projection_commitment_sha256 = NEW.projection_commitment_sha256)
  `,
  reward_materialized_projection_events: `
    projection_commitment_sha256 = NEW.projection_commitment_sha256
    OR cursor_sha256 = NEW.cursor_sha256
    OR materialized_state_sha256 = NEW.materialized_state_sha256
    OR event_record_sha256 = NEW.event_record_sha256
    OR (consumer_id = NEW.consumer_id AND target_commit_sequence_be = NEW.target_commit_sequence_be)
    OR (consumer_id = NEW.consumer_id AND target_commit_sequence_text = NEW.target_commit_sequence_text)
  `,
  reward_materialized_projection_state_history: `
    projection_commitment_sha256 = NEW.projection_commitment_sha256
    OR cursor_sha256 = NEW.cursor_sha256
    OR materialized_state_sha256 = NEW.materialized_state_sha256
    OR (
      consumer_id = NEW.consumer_id
      AND projection_kind = NEW.projection_kind
      AND projection_key = NEW.projection_key
      AND state_revision_be = NEW.state_revision_be
    )
    OR (
      consumer_id = NEW.consumer_id
      AND projection_kind = NEW.projection_kind
      AND projection_key = NEW.projection_key
      AND state_revision_text = NEW.state_revision_text
    )
    OR (consumer_id = NEW.consumer_id AND target_commit_sequence_be = NEW.target_commit_sequence_be)
    OR (consumer_id = NEW.consumer_id AND target_commit_sequence_text = NEW.target_commit_sequence_text)
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
      SELECT RAISE(ABORT, 'REWARD_MATERIALIZED_PROJECTION_APPEND_ONLY_INSERT_CONFLICT_FORBIDDEN');
    END`;
}

const TABLE_NAMES = Object.freeze(Object.keys(TABLE_SQL));
const TRIGGER_SQL = Object.freeze(Object.fromEntries(TABLE_NAMES.flatMap((table) => [
  [`${table}_forbid_update`, immutableTriggerSql(table, "UPDATE")],
  [`${table}_forbid_delete`, immutableTriggerSql(table, "DELETE")],
  [`${table}_forbid_conflicting_insert`, conflictingInsertTriggerSql(table)],
])));
const SCHEMA_OBJECTS = Object.freeze([
  ...Object.entries(TABLE_SQL).map(([name, sql]) => ({
    type: "table", name, tableName: name, sql,
  })),
  ...Object.entries(TRIGGER_SQL).map(([name, sql]) => ({
    type: "trigger",
    name,
    tableName: name.replace(/_forbid_(?:update|delete|conflicting_insert)$/u, ""),
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

export const REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_MANIFEST_SHA256 =
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
    // CAS codec and structuredClone above already create detached byte copies;
    // every public read/replay clones again, so no returned view aliases the
    // durable record or another caller's view.
    if (Buffer.isBuffer(entry) || entry instanceof Uint8Array) return entry;
    for (const child of Object.values(entry)) freeze(child);
    Object.freeze(entry);
    return entry;
  };
  return freeze(copy);
}

function projectionNamespace(consumerId, projectionKind, projectionKey) {
  return `${consumerId}\u0000${projectionKind}\u0000${projectionKey}`;
}

function pragmaScalar(database, pragma) {
  const row = database.prepare(`PRAGMA ${pragma}`).get();
  return row ? Object.values(row)[0] : undefined;
}

function configureDatabase(database, busyTimeoutMs) {
  if (typeof database.enableDefensive !== "function") {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_NODE24_DEFENSIVE_MODE_REQUIRED");
  }
  database.enableDefensive(true);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA recursive_triggers = ON");
  database.exec("PRAGMA trusted_schema = OFF");
  database.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
  if (String(pragmaScalar(database, "journal_mode = WAL")).toLowerCase() !== "wal") {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_WAL_REQUIRED");
  }
  database.exec("PRAGMA synchronous = FULL");
  if (Number(pragmaScalar(database, "foreign_keys")) !== 1
    || Number(pragmaScalar(database, "recursive_triggers")) !== 1
    || Number(pragmaScalar(database, "trusted_schema")) !== 0
    || Number(pragmaScalar(database, "synchronous")) !== 2) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_REQUIRED_PRAGMA_NOT_ACTIVE");
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
    throw new Error("REWARD_MATERIALIZED_PROJECTION_SCHEMA_OBJECT_SET_MISMATCH");
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
      throw new Error("REWARD_MATERIALIZED_PROJECTION_SCHEMA_DEFINITION_MISMATCH");
    }
    return { type: row.type, name: row.name, tableName: row.tbl_name, sql: row.sql };
  });
  if (schemaManifestSha256(normalized)
    !== REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_MANIFEST_SHA256) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_SCHEMA_MANIFEST_MISMATCH");
  }
}

function assertDatabaseIntegrity(database) {
  const rows = database.prepare("PRAGMA integrity_check").all();
  if (rows.length !== 1 || String(Object.values(rows[0])[0]).toLowerCase() !== "ok") {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_INTEGRITY_CHECK_FAILED");
  }
  if (database.prepare("PRAGMA foreign_key_check").all().length !== 0) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_FOREIGN_KEY_CHECK_FAILED");
  }
}

function validateMeta(database) {
  const rows = database.prepare("SELECT * FROM reward_materialized_projection_meta").all();
  if (rows.length !== 1) throw new Error("REWARD_MATERIALIZED_PROJECTION_META_SINGLETON_REQUIRED");
  const [row] = rows;
  if (row.singleton_id !== 1
    || row.adapter_schema !== REWARD_MATERIALIZED_PROJECTION_SQLITE_ADAPTER_SCHEMA
    || row.schema_version !== REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_VERSION
    || row.adapter_status !== REWARD_MATERIALIZED_PROJECTION_STATUS
    || row.schema_manifest_sha256
      !== REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_MANIFEST_SHA256
    || row.durable_cursor_persistence_verified !== 1
    || row.local_projection_event_append_atomicity_verified !== 1
    || row.materialized_projection_state_verified !== 1
    || row.projection_effect_scope !== REWARD_MATERIALIZED_PROJECTION_EFFECT_SCOPE
    || row.projection_effect_atomicity_verified !== 1
    || row.runtime_authentication_verified !== 0
    || row.provider_authenticity_verified !== 0
    || row.external_rollback_anchor_verified !== 0
    || row.rollback_protection_verified !== 0
    || row.external_side_effects_authorized !== 0
    || row.activation_ready !== 0
    || row.mainnet_status !== REWARD_MATERIALIZED_PROJECTION_MAINNET_STATUS) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_META_MISMATCH");
  }
}

function normalizeProjectionInput(projection, permit) {
  if (!hasExactKeys(projection, PROJECTION_INPUT_KEYS)) {
    throw new Error("INVALID_REWARD_MATERIALIZED_PROJECTION_INPUT");
  }
  const payload = cloneAndFreeze(decodeRewardCasTypedValue(
    encodeRewardCasTypedValue(projection.payload),
  ));
  const core = {
    schema: REWARD_MATERIALIZED_PROJECTION_COMMITMENT_SCHEMA,
    consumerId: asConsumerId(permit.consumerId),
    targetCommitSequence: asU64(
      permit.targetCommitSequence,
      "projection target sequence",
    ),
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

function verifiedLocalFlags() {
  return {
    durableCursorPersistenceVerified: true,
    localProjectionEventAppendAtomicityVerified: true,
    materializedProjectionStateVerified: true,
    projectionEffectScope: REWARD_MATERIALIZED_PROJECTION_EFFECT_SCOPE,
    projectionEffectAtomicityVerified: true,
    runtimeAuthenticationVerified: false,
    providerAuthenticityVerified: false,
    externalRollbackAnchorVerified: false,
    rollbackProtectionVerified: false,
    externalSideEffectsAuthorized: false,
    activationReady: false,
    mainnetStatus: REWARD_MATERIALIZED_PROJECTION_MAINNET_STATUS,
  };
}

function createCursorRecord({ permit, previousCursor, projection }) {
  const sequence = asU64(permit.targetCommitSequence, "permit target commit sequence");
  if (sequence === 0n) throw new Error("REWARD_MATERIALIZED_PROJECTION_TARGET_MUST_BE_COMMITTED");
  const previousRevision = previousCursor?.cursorRevision ?? 0n;
  if (sequence !== previousRevision + 1n) {
    if (sequence <= previousRevision) throw new Error("REWARD_MATERIALIZED_PROJECTION_REPLAY");
    throw new Error("REWARD_MATERIALIZED_PROJECTION_SKIP_FORBIDDEN");
  }
  const core = {
    schema: REWARD_MATERIALIZED_PROJECTION_CURSOR_SCHEMA,
    status: REWARD_MATERIALIZED_PROJECTION_STATUS,
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
    ...verifiedLocalFlags(),
  };
  return Object.freeze({ ...core, cursorSha256: rewardCasStateSha256(core) });
}

function createMaterializedStateRecord({ cursor, previousState, projection }) {
  const stateRevision = (previousState?.stateRevision ?? 0n) + 1n;
  const core = {
    schema: REWARD_MATERIALIZED_PROJECTION_STATE_SCHEMA,
    status: REWARD_MATERIALIZED_PROJECTION_STATUS,
    consumerId: cursor.consumerId,
    projectionKind: projection.projectionKind,
    projectionKey: projection.projectionKey,
    stateRevision,
    targetCommitSequence: cursor.targetCommitSequence,
    targetCommitSha256: cursor.targetCommitSha256,
    checkpointSha256: cursor.checkpointSha256,
    permitSha256: cursor.permitSha256,
    payload: projection.payload,
    payloadSha256: projection.payloadSha256,
    projectionCommitmentSha256: projection.projectionCommitmentSha256,
    previousMaterializedStateSha256:
      previousState?.materializedStateSha256 ?? REWARD_CAS_ZERO_SHA256,
    cursorSha256: cursor.cursorSha256,
    ...verifiedLocalFlags(),
  };
  return Object.freeze({
    ...core,
    materializedStateSha256: rewardCasStateSha256(core),
  });
}

function createProjectionEventRecord({ cursor, state, projection }) {
  const core = {
    schema: REWARD_MATERIALIZED_PROJECTION_EVENT_SCHEMA,
    status: REWARD_MATERIALIZED_PROJECTION_STATUS,
    consumerId: cursor.consumerId,
    targetCommitSequence: cursor.targetCommitSequence,
    targetCommitSha256: cursor.targetCommitSha256,
    checkpointSha256: cursor.checkpointSha256,
    permitSha256: cursor.permitSha256,
    projectionKind: projection.projectionKind,
    projectionKey: projection.projectionKey,
    payloadSha256: projection.payloadSha256,
    projectionCommitmentSha256: projection.projectionCommitmentSha256,
    cursorSha256: cursor.cursorSha256,
    materializedStateSha256: state.materializedStateSha256,
    ...verifiedLocalFlags(),
  };
  return Object.freeze({ ...core, eventRecordSha256: rewardCasStateSha256(core) });
}

function validateLocalFlags(record) {
  if (record.durableCursorPersistenceVerified !== true
    || record.localProjectionEventAppendAtomicityVerified !== true
    || record.materializedProjectionStateVerified !== true
    || record.projectionEffectScope !== REWARD_MATERIALIZED_PROJECTION_EFFECT_SCOPE
    || record.projectionEffectAtomicityVerified !== true
    || record.runtimeAuthenticationVerified !== false
    || record.providerAuthenticityVerified !== false
    || record.externalRollbackAnchorVerified !== false
    || record.rollbackProtectionVerified !== false
    || record.externalSideEffectsAuthorized !== false
    || record.activationReady !== false
    || record.mainnetStatus !== REWARD_MATERIALIZED_PROJECTION_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_MATERIALIZED_PROJECTION_TRUTH_BOUNDARY");
  }
}

export function validateRewardMaterializedProjectionCursor(record, previousCursor = null) {
  if (!hasExactKeys(record, CURSOR_KEYS)
    || record.schema !== REWARD_MATERIALIZED_PROJECTION_CURSOR_SCHEMA
    || record.status !== REWARD_MATERIALIZED_PROJECTION_STATUS) {
    throw new Error("INVALID_REWARD_MATERIALIZED_PROJECTION_CURSOR");
  }
  validateLocalFlags(record);
  asConsumerId(record.consumerId);
  const revision = asU64(record.cursorRevision, "cursor revision");
  if (revision === 0n
    || asU64(record.targetCommitSequence, "target commit sequence") !== revision
    || revision !== (previousCursor?.cursorRevision ?? 0n) + 1n
    || record.previousCursorSha256
      !== (previousCursor?.cursorSha256 ?? REWARD_CAS_ZERO_SHA256)) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_CURSOR_CHAIN_MISMATCH");
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
    throw new Error("REWARD_MATERIALIZED_PROJECTION_CURSOR_DIGEST_MISMATCH");
  }
  return record;
}

export function validateRewardMaterializedProjectionState(record, cursor, previousState = null) {
  if (!hasExactKeys(record, STATE_KEYS)
    || record.schema !== REWARD_MATERIALIZED_PROJECTION_STATE_SCHEMA
    || record.status !== REWARD_MATERIALIZED_PROJECTION_STATUS) {
    throw new Error("INVALID_REWARD_MATERIALIZED_PROJECTION_STATE");
  }
  validateLocalFlags(record);
  asConsumerId(record.consumerId);
  asProjectionLabel(record.projectionKind, "projection kind");
  asProjectionLabel(record.projectionKey, "projection key");
  const stateRevision = asU64(record.stateRevision, "state revision");
  const targetSequence = asU64(record.targetCommitSequence, "state target sequence");
  if (stateRevision === 0n
    || stateRevision !== (previousState?.stateRevision ?? 0n) + 1n
    || record.previousMaterializedStateSha256
      !== (previousState?.materializedStateSha256 ?? REWARD_CAS_ZERO_SHA256)) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_STATE_CHAIN_MISMATCH");
  }
  if (previousState
    && (previousState.consumerId !== record.consumerId
      || previousState.projectionKind !== record.projectionKind
      || previousState.projectionKey !== record.projectionKey
      || previousState.targetCommitSequence >= targetSequence)) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_STATE_NAMESPACE_MISMATCH");
  }
  for (const [value, label] of [
    [record.targetCommitSha256, "state target digest"],
    [record.checkpointSha256, "state checkpoint digest"],
    [record.permitSha256, "state permit digest"],
    [record.payloadSha256, "state payload digest"],
    [record.projectionCommitmentSha256, "state projection commitment digest"],
    [record.previousMaterializedStateSha256, "previous materialized-state digest"],
    [record.cursorSha256, "state cursor digest"],
    [record.materializedStateSha256, "materialized-state digest"],
  ]) asHex32(value, label);
  encodeRewardCasTypedValue(record.payload);
  if (record.payloadSha256 !== rewardCasStateSha256(record.payload)) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_PAYLOAD_DIGEST_MISMATCH");
  }
  const commitmentCore = {
    schema: REWARD_MATERIALIZED_PROJECTION_COMMITMENT_SCHEMA,
    consumerId: record.consumerId,
    targetCommitSequence: targetSequence,
    targetCommitSha256: record.targetCommitSha256,
    checkpointSha256: record.checkpointSha256,
    permitSha256: record.permitSha256,
    projectionKind: record.projectionKind,
    projectionKey: record.projectionKey,
    payloadSha256: record.payloadSha256,
  };
  if (record.projectionCommitmentSha256 !== rewardCasStateSha256(commitmentCore)) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_COMMITMENT_MISMATCH");
  }
  if (!cursor
    || record.consumerId !== cursor.consumerId
    || targetSequence !== cursor.targetCommitSequence
    || record.targetCommitSha256 !== cursor.targetCommitSha256
    || record.checkpointSha256 !== cursor.checkpointSha256
    || record.permitSha256 !== cursor.permitSha256
    || record.projectionCommitmentSha256 !== cursor.projectionCommitmentSha256
    || record.cursorSha256 !== cursor.cursorSha256) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_STATE_CURSOR_BINDING_MISMATCH");
  }
  const { materializedStateSha256, ...core } = record;
  if (materializedStateSha256 !== rewardCasStateSha256(core)) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_STATE_DIGEST_MISMATCH");
  }
  return record;
}

export function validateRewardMaterializedProjectionEvent(record, cursor, state) {
  if (!hasExactKeys(record, EVENT_KEYS)
    || record.schema !== REWARD_MATERIALIZED_PROJECTION_EVENT_SCHEMA
    || record.status !== REWARD_MATERIALIZED_PROJECTION_STATUS) {
    throw new Error("INVALID_REWARD_MATERIALIZED_PROJECTION_EVENT");
  }
  validateLocalFlags(record);
  asConsumerId(record.consumerId);
  asProjectionLabel(record.projectionKind, "event projection kind");
  asProjectionLabel(record.projectionKey, "event projection key");
  const targetSequence = asU64(record.targetCommitSequence, "event target sequence");
  for (const [value, label] of [
    [record.targetCommitSha256, "event target digest"],
    [record.checkpointSha256, "event checkpoint digest"],
    [record.permitSha256, "event permit digest"],
    [record.payloadSha256, "event payload digest"],
    [record.projectionCommitmentSha256, "event projection commitment digest"],
    [record.cursorSha256, "event cursor digest"],
    [record.materializedStateSha256, "event materialized-state digest"],
    [record.eventRecordSha256, "event record digest"],
  ]) asHex32(value, label);
  if (!cursor
    || !state
    || record.consumerId !== cursor.consumerId
    || record.consumerId !== state.consumerId
    || targetSequence !== cursor.targetCommitSequence
    || targetSequence !== state.targetCommitSequence
    || record.targetCommitSha256 !== cursor.targetCommitSha256
    || record.targetCommitSha256 !== state.targetCommitSha256
    || record.checkpointSha256 !== cursor.checkpointSha256
    || record.checkpointSha256 !== state.checkpointSha256
    || record.permitSha256 !== cursor.permitSha256
    || record.permitSha256 !== state.permitSha256
    || record.projectionKind !== state.projectionKind
    || record.projectionKey !== state.projectionKey
    || record.payloadSha256 !== state.payloadSha256
    || record.projectionCommitmentSha256 !== cursor.projectionCommitmentSha256
    || record.projectionCommitmentSha256 !== state.projectionCommitmentSha256
    || record.cursorSha256 !== cursor.cursorSha256
    || record.materializedStateSha256 !== state.materializedStateSha256) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_EVENT_BINDING_MISMATCH");
  }
  const { eventRecordSha256, ...core } = record;
  if (eventRecordSha256 !== rewardCasStateSha256(core)) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_EVENT_DIGEST_MISMATCH");
  }
  return record;
}

function decodeRecord(value) {
  try {
    return decodeRewardCasTypedValue(value);
  } catch (error) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_RECORD_DECODE_FAILED", { cause: error });
  }
}

function validateHistory(database) {
  const cursorRows = database.prepare(`
    SELECT * FROM reward_materialized_projection_cursor_history
    ORDER BY consumer_id, cursor_revision_be
  `).all();
  const previousCursorByConsumer = new Map();
  const cursorBySha256 = new Map();
  const cursorBySequence = new Map();
  const cursors = cursorRows.map((row) => {
    const cursor = decodeRecord(row.record_blob);
    const previousCursor = previousCursorByConsumer.get(row.consumer_id) ?? null;
    validateRewardMaterializedProjectionCursor(cursor, previousCursor);
    const cursorRevision = u64FromBe(row.cursor_revision_be, "cursor revision");
    const targetSequence = u64FromBe(
      row.target_commit_sequence_be,
      "cursor target sequence",
    );
    if (row.consumer_id !== cursor.consumerId
      || cursorRevision !== cursor.cursorRevision
      || row.cursor_revision_text !== cursor.cursorRevision.toString()
      || targetSequence !== cursor.targetCommitSequence
      || row.target_commit_sequence_text !== cursor.targetCommitSequence.toString()
      || row.target_commit_sha256 !== cursor.targetCommitSha256
      || row.checkpoint_sha256 !== cursor.checkpointSha256
      || row.permit_sha256 !== cursor.permitSha256
      || row.projection_commitment_sha256 !== cursor.projectionCommitmentSha256
      || row.previous_cursor_sha256 !== cursor.previousCursorSha256
      || row.cursor_sha256 !== cursor.cursorSha256) {
      throw new Error("REWARD_MATERIALIZED_PROJECTION_CURSOR_ROW_BINDING_MISMATCH");
    }
    previousCursorByConsumer.set(cursor.consumerId, cursor);
    cursorBySha256.set(cursor.cursorSha256, cursor);
    cursorBySequence.set(`${cursor.consumerId}\u0000${cursor.targetCommitSequence}`, cursor);
    return cursor;
  });

  const stateRows = database.prepare(`
    SELECT * FROM reward_materialized_projection_state_history
    ORDER BY consumer_id, target_commit_sequence_be
  `).all();
  const previousStateByNamespace = new Map();
  const stateBySha256 = new Map();
  const stateBySequence = new Map();
  const materializedStates = stateRows.map((row) => {
    const state = decodeRecord(row.record_blob);
    const namespace = projectionNamespace(
      row.consumer_id,
      row.projection_kind,
      row.projection_key,
    );
    const previousState = previousStateByNamespace.get(namespace) ?? null;
    const cursor = cursorBySha256.get(row.cursor_sha256);
    validateRewardMaterializedProjectionState(state, cursor, previousState);
    const stateRevision = u64FromBe(row.state_revision_be, "state revision");
    const targetSequence = u64FromBe(row.target_commit_sequence_be, "state target sequence");
    if (row.consumer_id !== state.consumerId
      || row.projection_kind !== state.projectionKind
      || row.projection_key !== state.projectionKey
      || stateRevision !== state.stateRevision
      || row.state_revision_text !== state.stateRevision.toString()
      || targetSequence !== state.targetCommitSequence
      || row.target_commit_sequence_text !== state.targetCommitSequence.toString()
      || row.target_commit_sha256 !== state.targetCommitSha256
      || row.checkpoint_sha256 !== state.checkpointSha256
      || row.permit_sha256 !== state.permitSha256
      || row.payload_sha256 !== state.payloadSha256
      || row.projection_commitment_sha256 !== state.projectionCommitmentSha256
      || row.previous_materialized_state_sha256 !== state.previousMaterializedStateSha256
      || row.cursor_sha256 !== state.cursorSha256
      || row.materialized_state_sha256 !== state.materializedStateSha256) {
      throw new Error("REWARD_MATERIALIZED_PROJECTION_STATE_ROW_BINDING_MISMATCH");
    }
    previousStateByNamespace.set(namespace, state);
    stateBySha256.set(state.materializedStateSha256, state);
    stateBySequence.set(`${state.consumerId}\u0000${state.targetCommitSequence}`, state);
    return state;
  });

  const eventRows = database.prepare(`
    SELECT * FROM reward_materialized_projection_events
    ORDER BY consumer_id, target_commit_sequence_be
  `).all();
  const eventsBySequence = new Map();
  const projectionEvents = eventRows.map((row) => {
    const event = decodeRecord(row.record_blob);
    const cursor = cursorBySha256.get(row.cursor_sha256);
    const state = stateBySha256.get(row.materialized_state_sha256);
    validateRewardMaterializedProjectionEvent(event, cursor, state);
    const targetSequence = u64FromBe(row.target_commit_sequence_be, "event target sequence");
    if (row.consumer_id !== event.consumerId
      || targetSequence !== event.targetCommitSequence
      || row.target_commit_sequence_text !== event.targetCommitSequence.toString()
      || row.projection_kind !== event.projectionKind
      || row.projection_key !== event.projectionKey
      || row.projection_commitment_sha256 !== event.projectionCommitmentSha256
      || row.cursor_sha256 !== event.cursorSha256
      || row.materialized_state_sha256 !== event.materializedStateSha256
      || row.event_record_sha256 !== event.eventRecordSha256) {
      throw new Error("REWARD_MATERIALIZED_PROJECTION_EVENT_ROW_BINDING_MISMATCH");
    }
    eventsBySequence.set(`${event.consumerId}\u0000${event.targetCommitSequence}`, event);
    return event;
  });

  if (cursors.length !== materializedStates.length
    || cursors.length !== projectionEvents.length) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_ATOMIC_SET_INCOMPLETE");
  }
  for (const cursor of cursors) {
    const key = `${cursor.consumerId}\u0000${cursor.targetCommitSequence}`;
    const state = stateBySequence.get(key);
    const event = eventsBySequence.get(key);
    if (!state
      || !event
      || state.cursorSha256 !== cursor.cursorSha256
      || event.cursorSha256 !== cursor.cursorSha256
      || event.materializedStateSha256 !== state.materializedStateSha256) {
      throw new Error("REWARD_MATERIALIZED_PROJECTION_ATOMIC_BINDING_INCOMPLETE");
    }
  }
  return {
    cursors,
    projectionEvents,
    materializedStates,
    currentCursorByConsumer: previousCursorByConsumer,
    currentStateByNamespace: previousStateByNamespace,
    cursorBySequence,
    stateBySequence,
    eventsBySequence,
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
      INSERT INTO reward_materialized_projection_meta (
        singleton_id, adapter_schema, schema_version, adapter_status,
        schema_manifest_sha256, durable_cursor_persistence_verified,
        local_projection_event_append_atomicity_verified,
        materialized_projection_state_verified, projection_effect_scope,
        projection_effect_atomicity_verified, runtime_authentication_verified,
        provider_authenticity_verified, external_rollback_anchor_verified,
        rollback_protection_verified, external_side_effects_authorized,
        activation_ready, mainnet_status
      ) VALUES (1, ?, ?, ?, ?, 1, 1, 1, ?, 1, 0, 0, 0, 0, 0, 0, ?)
    `).run(
      REWARD_MATERIALIZED_PROJECTION_SQLITE_ADAPTER_SCHEMA,
      REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_VERSION,
      REWARD_MATERIALIZED_PROJECTION_STATUS,
      REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_MANIFEST_SHA256,
      REWARD_MATERIALIZED_PROJECTION_EFFECT_SCOPE,
      REWARD_MATERIALIZED_PROJECTION_MAINNET_STATUS,
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
    INSERT INTO reward_materialized_projection_cursor_history (
      consumer_id, cursor_revision_be, cursor_revision_text,
      target_commit_sequence_be, target_commit_sequence_text,
      target_commit_sha256, checkpoint_sha256, permit_sha256,
      projection_commitment_sha256, previous_cursor_sha256,
      cursor_sha256, record_blob
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  );
}

function insertProjectionEvent(database, record) {
  database.prepare(`
    INSERT INTO reward_materialized_projection_events (
      consumer_id, target_commit_sequence_be, target_commit_sequence_text,
      projection_kind, projection_key, projection_commitment_sha256,
      cursor_sha256, materialized_state_sha256, event_record_sha256, record_blob
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.consumerId,
    u64Be(record.targetCommitSequence, "event target sequence"),
    record.targetCommitSequence.toString(),
    record.projectionKind,
    record.projectionKey,
    record.projectionCommitmentSha256,
    record.cursorSha256,
    record.materializedStateSha256,
    record.eventRecordSha256,
    encodeRewardCasTypedValue(record),
  );
}

function insertMaterializedState(database, record) {
  database.prepare(`
    INSERT INTO reward_materialized_projection_state_history (
      consumer_id, projection_kind, projection_key,
      state_revision_be, state_revision_text,
      target_commit_sequence_be, target_commit_sequence_text,
      target_commit_sha256, checkpoint_sha256, permit_sha256,
      payload_sha256, projection_commitment_sha256,
      previous_materialized_state_sha256, cursor_sha256,
      materialized_state_sha256, record_blob
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.consumerId,
    record.projectionKind,
    record.projectionKey,
    u64Be(record.stateRevision, "state revision"),
    record.stateRevision.toString(),
    u64Be(record.targetCommitSequence, "state target sequence"),
    record.targetCommitSequence.toString(),
    record.targetCommitSha256,
    record.checkpointSha256,
    record.permitSha256,
    record.payloadSha256,
    record.projectionCommitmentSha256,
    record.previousMaterializedStateSha256,
    record.cursorSha256,
    record.materializedStateSha256,
    encodeRewardCasTypedValue(record),
  );
}

function consumptionResult(disposition, cursor, projectionEvent, materializedState) {
  return cloneAndFreeze({
    disposition,
    cursor,
    projectionEvent,
    materializedState,
  });
}

function exactReplayResult(history, permit, projection) {
  const key = `${permit.consumerId}\u0000${permit.targetCommitSequence}`;
  const cursor = history.cursorBySequence.get(key);
  const projectionEvent = history.eventsBySequence.get(key);
  const materializedState = history.stateBySequence.get(key);
  if (!cursor || !projectionEvent || !materializedState) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_REPLAY_TARGET_MISSING");
  }
  if (cursor.targetCommitSha256 !== permit.targetCommitSha256
    || cursor.checkpointSha256 !== permit.checkpointSha256
    || cursor.permitSha256 !== permit.permitSha256
    || cursor.sourceDailyLawReferenceStateSha256
      !== permit.sourceDailyLawReferenceStateSha256
    || cursor.consumerDailyLawReferenceStateSha256
      !== permit.consumerDailyLawReferenceStateSha256
    || cursor.projectionCommitmentSha256 !== projection.projectionCommitmentSha256
    || projectionEvent.projectionCommitmentSha256 !== projection.projectionCommitmentSha256
    || materializedState.projectionCommitmentSha256
      !== projection.projectionCommitmentSha256) {
    throw new Error("REWARD_MATERIALIZED_PROJECTION_REPLAY_MISMATCH");
  }
  return consumptionResult(
    REWARD_MATERIALIZED_PROJECTION_DISPOSITION.RECONCILED_EXACT_REPLAY,
    cursor,
    projectionEvent,
    materializedState,
  );
}

/**
 * Require a materialized-projection adapter created by this exact loaded
 * module instance. Candidate properties are never read before process-private
 * WeakSet membership succeeds, so clones, aliases, proxies, prototypes, and
 * accessor fakes cannot manufacture the factory brand.
 */
export function assertSqliteRewardMaterializedProjectionAdapter(value) {
  if ((typeof value !== "object" && typeof value !== "function")
    || value === null
    || !SQLITE_REWARD_MATERIALIZED_PROJECTION_ADAPTERS.has(value)) {
    throw new TypeError(
      "materialized reward projection requires its process-branded SQLite adapter",
    );
  }
  return value;
}

export function createSqliteRewardMaterializedProjection({
  databasePath,
  busyTimeoutMs = 0,
  testOnlyFault = null,
} = {}) {
  if (typeof databasePath !== "string" || databasePath.length === 0 || databasePath === ":memory:") {
    throw new TypeError("materialized reward projection requires a file-backed databasePath");
  }
  if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0 || busyTimeoutMs > 60_000) {
    throw new RangeError("materialized reward projection busyTimeoutMs must be from 0 through 60000");
  }
  if (!ACCEPTED_FAULTS.has(testOnlyFault)) {
    throw new Error("UNKNOWN_TEST_ONLY_REWARD_MATERIALIZED_PROJECTION_SQLITE_FAULT");
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
    if (closed) throw new Error("REWARD_MATERIALIZED_PROJECTION_STORE_CLOSED");
  };
  const fault = (point) => {
    if (testOnlyFault === point) {
      throw new Error(`TEST_ONLY_REWARD_MATERIALIZED_PROJECTION_SQLITE_FAULT_${point}`);
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
    adapterSchema: REWARD_MATERIALIZED_PROJECTION_SQLITE_ADAPTER_SCHEMA,
    schemaVersion: REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_VERSION,
    schemaManifestSha256: REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_MANIFEST_SHA256,
    status: REWARD_MATERIALIZED_PROJECTION_STATUS,
    ...verifiedLocalFlags(),
    readCursor(consumerId) {
      ensureOpen();
      const history = validateDatabase(database);
      const cursor = history.currentCursorByConsumer.get(asConsumerId(consumerId));
      return cursor ? cloneAndFreeze(cursor) : null;
    },
    readProjectionEvent(consumerId, targetCommitSequence) {
      ensureOpen();
      const canonicalConsumerId = asConsumerId(consumerId);
      const sequence = asU64(targetCommitSequence, "targetCommitSequence");
      const history = validateDatabase(database);
      const event = history.eventsBySequence.get(`${canonicalConsumerId}\u0000${sequence}`);
      return event ? cloneAndFreeze(event) : null;
    },
    readMaterializedProjection(consumerId, projectionKind, projectionKey) {
      ensureOpen();
      const namespace = projectionNamespace(
        asConsumerId(consumerId),
        asProjectionLabel(projectionKind, "projectionKind"),
        asProjectionLabel(projectionKey, "projectionKey"),
      );
      const history = validateDatabase(database);
      const state = history.currentStateByNamespace.get(namespace);
      return state ? cloneAndFreeze(state) : null;
    },
    snapshot() {
      ensureOpen();
      const history = validateDatabase(database);
      return Object.freeze({
        schema: REWARD_MATERIALIZED_PROJECTION_SQLITE_ADAPTER_SCHEMA,
        schemaVersion: REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_VERSION,
        schemaManifestSha256:
          REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_MANIFEST_SHA256,
        cursors: Object.freeze(history.cursors.map(cloneAndFreeze)),
        projectionEvents: Object.freeze(history.projectionEvents.map(cloneAndFreeze)),
        materializedStates: Object.freeze(history.materializedStates.map(cloneAndFreeze)),
        ...verifiedLocalFlags(),
      });
    },
    consumePermit(input) {
      const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
      const consumerId = asConsumerId(input.consumerId);
      const targetCommitSequence = asU64(
        input.targetCommitSequence,
        "targetCommitSequence",
      );
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
      let committed = false;
      try {
        const history = validateDatabase(database);
        const projection = normalizeProjectionInput(input.projection, permit);
        const currentCursor = history.currentCursorByConsumer.get(consumerId) ?? null;
        let result;
        if (targetCommitSequence <= (currentCursor?.cursorRevision ?? 0n)) {
          result = exactReplayResult(history, permit, projection);
        } else {
          const namespace = projectionNamespace(
            consumerId,
            projection.projectionKind,
            projection.projectionKey,
          );
          const cursor = createCursorRecord({
            permit,
            previousCursor: currentCursor,
            projection,
          });
          const materializedState = createMaterializedStateRecord({
            cursor,
            previousState: history.currentStateByNamespace.get(namespace) ?? null,
            projection,
          });
          const projectionEvent = createProjectionEventRecord({
            cursor,
            state: materializedState,
            projection,
          });
          insertCursor(database, cursor);
          fault(REWARD_MATERIALIZED_PROJECTION_SQLITE_TEST_FAULT.AFTER_CURSOR);
          insertProjectionEvent(database, projectionEvent);
          fault(REWARD_MATERIALIZED_PROJECTION_SQLITE_TEST_FAULT.AFTER_PROJECTION_EVENT);
          insertMaterializedState(database, materializedState);
          fault(REWARD_MATERIALIZED_PROJECTION_SQLITE_TEST_FAULT.AFTER_MATERIALIZED_STATE);
          validateDatabase(database);
          result = consumptionResult(
            REWARD_MATERIALIZED_PROJECTION_DISPOSITION.COMMITTED,
            cursor,
            projectionEvent,
            materializedState,
          );
        }
        database.exec("COMMIT");
        committed = true;
        fault(REWARD_MATERIALIZED_PROJECTION_SQLITE_TEST_FAULT.AFTER_COMMIT);
        return result;
      } catch (error) {
        if (!committed) {
          try {
            database.exec("ROLLBACK");
          } catch {
            // Preserve the first transaction failure.
          }
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
  SQLITE_REWARD_MATERIALIZED_PROJECTION_ADAPTERS.add(frozen);
  return frozen;
}

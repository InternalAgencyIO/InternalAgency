import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import { REFERENCE_DEPLOYMENT_DOMAIN_SHA256 } from "./reward-allocator-receipt-codec.mjs";
import { assertDailyLawWriteAllowed } from "./daily-lockdown-consensus.mjs";
import {
  REWARD_CAS_COMMIT_SCHEMA,
  REWARD_CAS_ENTITY_KIND,
  REWARD_CAS_ENTITY_SCHEMA,
  REWARD_CAS_GLOBAL_LEDGER_KEY,
  REWARD_CAS_MAINNET_STATUS,
  REWARD_CAS_OPERATION,
  REWARD_CAS_STATUS,
  REWARD_CAS_STORE_ADAPTER,
  REWARD_CAS_ZERO_SHA256,
  createInitialRewardCasHead,
  createRewardCasCommit,
  createRewardCasEntityRecord,
  createRewardCasFixtureRecords,
  createRewardCasRoundProofRecord,
  decodeRewardCasTypedValue,
  encodeRewardCasTypedValue,
  preparePremiumUpgradeCas,
  prepareRewardRoundFinalizationCas,
  rewardCasRoundKey,
  rewardCasStateSha256,
  validateRewardCasCommit,
  validateRewardCasHead,
  validateRewardCasSnapshot,
} from "./reward-persistence-cas.mjs";

export const REWARD_CAS_SQLITE_ADAPTER_SCHEMA = "iat-b3-reward-cas-sqlite-adapter/v1";
export const REWARD_CAS_SQLITE_SCHEMA_VERSION = 1;
export const REWARD_CAS_SQLITE_STATUS = "HOST_ONLY_NON_ACTIVATING_DURABLE_REFERENCE";
export const REWARD_CAS_SQLITE_MAINNET_STATUS = "HOLD";

export const REWARD_CAS_SQLITE_TEST_FAULT = Object.freeze({
  AFTER_MARKER: "AFTER_MARKER",
  AFTER_FIRST_ENTITY: "AFTER_FIRST_ENTITY",
  AFTER_PROOF: "AFTER_PROOF",
  AFTER_COMMIT: "AFTER_COMMIT",
  AFTER_HEAD: "AFTER_HEAD",
  AFTER_DURABLE_COMMIT: "AFTER_DURABLE_COMMIT",
});

const U64_MAX = (1n << 64n) - 1n;
const HEX_32_CHECK = "length(%s) = 64 AND %s NOT GLOB '*[^0-9a-f]*'";
const ACCEPTED_FAULTS = new Set([null, ...Object.values(REWARD_CAS_SQLITE_TEST_FAULT)]);
const TABLE_NAMES = Object.freeze([
  "reward_cas_sqlite_meta",
  "reward_cas_entity_versions",
  "reward_cas_commits",
  "reward_cas_head_history",
  "reward_cas_round_consumptions",
  "reward_cas_round_proofs",
  "reward_cas_upgrade_attempts",
]);

function hexCheck(column) {
  return HEX_32_CHECK.replaceAll("%s", column);
}

const TABLE_SQL = Object.freeze({
  reward_cas_sqlite_meta: `CREATE TABLE reward_cas_sqlite_meta (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    adapter_schema TEXT NOT NULL CHECK (adapter_schema = '${REWARD_CAS_SQLITE_ADAPTER_SCHEMA}'),
    schema_version INTEGER NOT NULL CHECK (schema_version = ${REWARD_CAS_SQLITE_SCHEMA_VERSION}),
    adapter_status TEXT NOT NULL CHECK (adapter_status = '${REWARD_CAS_SQLITE_STATUS}'),
    reference_status TEXT NOT NULL CHECK (reference_status = '${REWARD_CAS_STATUS}'),
    deployment_domain_sha256 TEXT NOT NULL CHECK (${hexCheck("deployment_domain_sha256")}),
    schema_manifest_sha256 TEXT NOT NULL CHECK (${hexCheck("schema_manifest_sha256")}),
    genesis_entity_set_sha256 TEXT NOT NULL CHECK (${hexCheck("genesis_entity_set_sha256")}),
    runtime_authentication_verified INTEGER NOT NULL CHECK (runtime_authentication_verified = 0),
    rollback_protection_verified INTEGER NOT NULL CHECK (rollback_protection_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_CAS_SQLITE_MAINNET_STATUS}')
  ) STRICT`,
  reward_cas_entity_versions: `CREATE TABLE reward_cas_entity_versions (
    entity_kind TEXT NOT NULL CHECK (entity_kind IN ('LANE_LEDGER', 'ROUND', 'X_REWARD')),
    entity_key TEXT NOT NULL CHECK (length(entity_key) > 0),
    revision_be BLOB NOT NULL CHECK (typeof(revision_be) = 'blob' AND length(revision_be) = 8),
    revision_text TEXT NOT NULL CHECK (
      length(revision_text) BETWEEN 1 AND 20
      AND revision_text NOT GLOB '*[^0-9]*'
      AND (revision_text = '0' OR substr(revision_text, 1, 1) BETWEEN '1' AND '9')
    ),
    state_sha256 TEXT NOT NULL CHECK (${hexCheck("state_sha256")}),
    record_blob BLOB NOT NULL CHECK (typeof(record_blob) = 'blob' AND length(record_blob) > 0),
    status TEXT NOT NULL CHECK (status = '${REWARD_CAS_STATUS}'),
    runtime_authentication_verified INTEGER NOT NULL CHECK (runtime_authentication_verified = 0),
    rollback_protection_verified INTEGER NOT NULL CHECK (rollback_protection_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_CAS_MAINNET_STATUS}'),
    PRIMARY KEY (entity_kind, entity_key, revision_be),
    UNIQUE (entity_kind, entity_key, revision_text)
  ) STRICT, WITHOUT ROWID`,
  reward_cas_commits: `CREATE TABLE reward_cas_commits (
    sequence_be BLOB PRIMARY KEY CHECK (typeof(sequence_be) = 'blob' AND length(sequence_be) = 8),
    sequence_text TEXT NOT NULL UNIQUE CHECK (
      length(sequence_text) BETWEEN 1 AND 20
      AND sequence_text NOT GLOB '*[^0-9]*'
      AND substr(sequence_text, 1, 1) BETWEEN '1' AND '9'
    ),
    commit_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("commit_sha256")}),
    previous_commit_sha256 TEXT NOT NULL CHECK (${hexCheck("previous_commit_sha256")}),
    operation TEXT NOT NULL CHECK (operation IN ('FINALIZE_REWARD_CAPACITY_ROUND', 'RECORD_X_PREMIUM_UPGRADE')),
    record_blob BLOB NOT NULL CHECK (typeof(record_blob) = 'blob' AND length(record_blob) > 0),
    status TEXT NOT NULL CHECK (status = '${REWARD_CAS_STATUS}'),
    runtime_authentication_verified INTEGER NOT NULL CHECK (runtime_authentication_verified = 0),
    rollback_protection_verified INTEGER NOT NULL CHECK (rollback_protection_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_CAS_MAINNET_STATUS}')
  ) STRICT, WITHOUT ROWID`,
  reward_cas_head_history: `CREATE TABLE reward_cas_head_history (
    sequence_be BLOB PRIMARY KEY CHECK (typeof(sequence_be) = 'blob' AND length(sequence_be) = 8),
    sequence_text TEXT NOT NULL UNIQUE CHECK (
      length(sequence_text) BETWEEN 1 AND 20
      AND sequence_text NOT GLOB '*[^0-9]*'
      AND (sequence_text = '0' OR substr(sequence_text, 1, 1) BETWEEN '1' AND '9')
    ),
    head_commit_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("head_commit_sha256")}),
    record_blob BLOB NOT NULL CHECK (typeof(record_blob) = 'blob' AND length(record_blob) > 0),
    status TEXT NOT NULL CHECK (status = '${REWARD_CAS_STATUS}'),
    runtime_authentication_verified INTEGER NOT NULL CHECK (runtime_authentication_verified = 0),
    rollback_protection_verified INTEGER NOT NULL CHECK (rollback_protection_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_CAS_MAINNET_STATUS}')
  ) STRICT, WITHOUT ROWID`,
  reward_cas_round_consumptions: `CREATE TABLE reward_cas_round_consumptions (
    funding_round_at_unix_seconds TEXT PRIMARY KEY CHECK (length(funding_round_at_unix_seconds) > 0),
    commit_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("commit_sha256")}),
    proof_bundle_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("proof_bundle_sha256")}),
    record_blob BLOB NOT NULL CHECK (typeof(record_blob) = 'blob' AND length(record_blob) > 0),
    status TEXT NOT NULL CHECK (status = '${REWARD_CAS_STATUS}'),
    runtime_authentication_verified INTEGER NOT NULL CHECK (runtime_authentication_verified = 0),
    rollback_protection_verified INTEGER NOT NULL CHECK (rollback_protection_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_CAS_MAINNET_STATUS}'),
    UNIQUE (funding_round_at_unix_seconds, commit_sha256),
    FOREIGN KEY (commit_sha256) REFERENCES reward_cas_commits(commit_sha256)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT, WITHOUT ROWID`,
  reward_cas_round_proofs: `CREATE TABLE reward_cas_round_proofs (
    funding_round_at_unix_seconds TEXT PRIMARY KEY CHECK (length(funding_round_at_unix_seconds) > 0),
    commit_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("commit_sha256")}),
    proof_bundle_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("proof_bundle_sha256")}),
    proof_record_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("proof_record_sha256")}),
    record_blob BLOB NOT NULL CHECK (typeof(record_blob) = 'blob' AND length(record_blob) > 0),
    status TEXT NOT NULL CHECK (status = '${REWARD_CAS_STATUS}'),
    runtime_authentication_verified INTEGER NOT NULL CHECK (runtime_authentication_verified = 0),
    rollback_protection_verified INTEGER NOT NULL CHECK (rollback_protection_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_CAS_MAINNET_STATUS}'),
    FOREIGN KEY (funding_round_at_unix_seconds, commit_sha256)
      REFERENCES reward_cas_round_consumptions(funding_round_at_unix_seconds, commit_sha256)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT, WITHOUT ROWID`,
  reward_cas_upgrade_attempts: `CREATE TABLE reward_cas_upgrade_attempts (
    reward_id TEXT PRIMARY KEY CHECK (${hexCheck("reward_id")}),
    commit_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("commit_sha256")}),
    attempt_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("attempt_sha256")}),
    record_blob BLOB NOT NULL CHECK (typeof(record_blob) = 'blob' AND length(record_blob) > 0),
    status TEXT NOT NULL CHECK (status = '${REWARD_CAS_STATUS}'),
    runtime_authentication_verified INTEGER NOT NULL CHECK (runtime_authentication_verified = 0),
    rollback_protection_verified INTEGER NOT NULL CHECK (rollback_protection_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_CAS_MAINNET_STATUS}'),
    FOREIGN KEY (commit_sha256) REFERENCES reward_cas_commits(commit_sha256)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT, WITHOUT ROWID`,
});

function immutableTriggerSql(table, operation) {
  const suffix = operation.toLowerCase();
  return `CREATE TRIGGER ${table}_forbid_${suffix}
    BEFORE ${operation} ON ${table}
    BEGIN
      SELECT RAISE(ABORT, 'REWARD_CAS_SQLITE_APPEND_ONLY_${operation}_FORBIDDEN');
    END`;
}

const TRIGGER_SQL = Object.freeze(Object.fromEntries(TABLE_NAMES.flatMap((table) => [
  [`${table}_forbid_update`, immutableTriggerSql(table, "UPDATE")],
  [`${table}_forbid_delete`, immutableTriggerSql(table, "DELETE")],
])));

const DUPLICATE_INSERT_PREDICATES = Object.freeze({
  reward_cas_sqlite_meta: "singleton_id = NEW.singleton_id",
  reward_cas_entity_versions: `entity_kind = NEW.entity_kind
    AND entity_key = NEW.entity_key
    AND (revision_be = NEW.revision_be OR revision_text = NEW.revision_text)`,
  reward_cas_commits: `sequence_be = NEW.sequence_be
    OR sequence_text = NEW.sequence_text
    OR commit_sha256 = NEW.commit_sha256`,
  reward_cas_head_history: `sequence_be = NEW.sequence_be
    OR sequence_text = NEW.sequence_text
    OR head_commit_sha256 = NEW.head_commit_sha256`,
  reward_cas_round_consumptions: `funding_round_at_unix_seconds = NEW.funding_round_at_unix_seconds
    OR commit_sha256 = NEW.commit_sha256
    OR proof_bundle_sha256 = NEW.proof_bundle_sha256`,
  reward_cas_round_proofs: `funding_round_at_unix_seconds = NEW.funding_round_at_unix_seconds
    OR commit_sha256 = NEW.commit_sha256
    OR proof_bundle_sha256 = NEW.proof_bundle_sha256
    OR proof_record_sha256 = NEW.proof_record_sha256`,
  reward_cas_upgrade_attempts: `reward_id = NEW.reward_id
    OR commit_sha256 = NEW.commit_sha256
    OR attempt_sha256 = NEW.attempt_sha256`,
});

const DUPLICATE_TRIGGER_SQL = Object.freeze(Object.fromEntries(
  Object.entries(DUPLICATE_INSERT_PREDICATES).map(([table, predicate]) => [
    `${table}_forbid_duplicate_insert`,
    `CREATE TRIGGER ${table}_forbid_duplicate_insert
      BEFORE INSERT ON ${table}
      WHEN EXISTS (SELECT 1 FROM ${table} WHERE ${predicate})
      BEGIN
        SELECT RAISE(ABORT, 'REWARD_CAS_SQLITE_REPLACE_OR_DUPLICATE_FORBIDDEN');
      END`,
  ]),
));

const SCHEMA_OBJECTS = Object.freeze([
  ...Object.entries(TABLE_SQL).map(([name, sql]) => ({ type: "table", name, tableName: name, sql })),
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

export const REWARD_CAS_SQLITE_SCHEMA_MANIFEST_SHA256 = schemaManifestSha256();

function clone(value) {
  return structuredClone(value);
}

function asU64(value, label) {
  if (typeof value !== "bigint" || value < 0n || value > U64_MAX) {
    throw new TypeError(`${label} must be a u64 bigint`);
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
  return bytes.readBigUInt64BE(0);
}

function asHex32(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${label} must be canonical lowercase 32-byte hexadecimal`);
  }
  return value;
}

function encodeRecord(record) {
  return encodeRewardCasTypedValue(record);
}

function decodeRecord(value, label) {
  try {
    return decodeRewardCasTypedValue(value);
  } catch (error) {
    throw new Error(`REWARD_CAS_SQLITE_INVALID_${label}_RECORD`, { cause: error });
  }
}

function flags(record, label) {
  if (record?.status !== REWARD_CAS_STATUS
    || record.runtimeAuthenticationVerified !== false
    || record.rollbackProtectionVerified !== false
    || record.activationReady !== false
    || record.mainnetStatus !== REWARD_CAS_MAINNET_STATUS) {
    throw new Error(`REWARD_CAS_SQLITE_INVALID_${label}_FLAGS`);
  }
}

function rowFlags() {
  return [REWARD_CAS_STATUS, 0, 0, 0, REWARD_CAS_MAINNET_STATUS];
}

function pragmaScalar(database, pragma) {
  const row = database.prepare(`PRAGMA ${pragma}`).get();
  return row ? Object.values(row)[0] : undefined;
}

function configureDatabase(database, { fileBacked, busyTimeoutMs }) {
  if (typeof database.enableDefensive !== "function") {
    throw new Error("REWARD_CAS_SQLITE_NODE24_DEFENSIVE_MODE_REQUIRED");
  }
  database.enableDefensive(true);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA recursive_triggers = ON");
  database.exec("PRAGMA trusted_schema = OFF");
  database.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
  if (fileBacked) {
    const mode = String(pragmaScalar(database, "journal_mode = WAL")).toLowerCase();
    if (mode !== "wal") throw new Error("REWARD_CAS_SQLITE_WAL_REQUIRED");
  }
  database.exec("PRAGMA synchronous = FULL");
  if (Number(pragmaScalar(database, "foreign_keys")) !== 1
    || Number(pragmaScalar(database, "recursive_triggers")) !== 1
    || Number(pragmaScalar(database, "trusted_schema")) !== 0
    || Number(pragmaScalar(database, "synchronous")) !== 2) {
    throw new Error("REWARD_CAS_SQLITE_REQUIRED_PRAGMA_NOT_ACTIVE");
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
  if (actual.length !== SCHEMA_OBJECTS.length) throw new Error("REWARD_CAS_SQLITE_SCHEMA_OBJECT_SET_MISMATCH");
  const expectedByKey = new Map(SCHEMA_OBJECTS.map((entry) => [`${entry.type}|${entry.name}`, entry]));
  const normalizedActual = [];
  for (const row of actual) {
    const key = `${row.type}|${row.name}`;
    const expected = expectedByKey.get(key);
    if (!expected
      || row.tbl_name !== expected.tableName
      || normalizeSql(row.sql ?? "") !== normalizeSql(expected.sql)) {
      throw new Error("REWARD_CAS_SQLITE_SCHEMA_DEFINITION_MISMATCH");
    }
    normalizedActual.push({
      type: row.type,
      name: row.name,
      tableName: row.tbl_name,
      sql: row.sql,
    });
  }
  if (schemaManifestSha256(normalizedActual) !== REWARD_CAS_SQLITE_SCHEMA_MANIFEST_SHA256) {
    throw new Error("REWARD_CAS_SQLITE_SCHEMA_MANIFEST_MISMATCH");
  }
}

function validateMeta(database) {
  const rows = database.prepare("SELECT * FROM reward_cas_sqlite_meta").all();
  if (rows.length !== 1) throw new Error("REWARD_CAS_SQLITE_META_SINGLETON_REQUIRED");
  const [row] = rows;
  if (row.singleton_id !== 1
    || row.adapter_schema !== REWARD_CAS_SQLITE_ADAPTER_SCHEMA
    || row.schema_version !== REWARD_CAS_SQLITE_SCHEMA_VERSION
    || row.adapter_status !== REWARD_CAS_SQLITE_STATUS
    || row.reference_status !== REWARD_CAS_STATUS
    || row.deployment_domain_sha256 !== REFERENCE_DEPLOYMENT_DOMAIN_SHA256
    || row.schema_manifest_sha256 !== REWARD_CAS_SQLITE_SCHEMA_MANIFEST_SHA256
    || asHex32(row.genesis_entity_set_sha256, "genesis entity-set digest") !== row.genesis_entity_set_sha256
    || row.runtime_authentication_verified !== 0
    || row.rollback_protection_verified !== 0
    || row.activation_ready !== 0
    || row.mainnet_status !== REWARD_CAS_SQLITE_MAINNET_STATUS) {
    throw new Error("REWARD_CAS_SQLITE_META_MISMATCH");
  }
  return row;
}

function assertDatabaseIntegrity(database) {
  const integrityRows = database.prepare("PRAGMA integrity_check").all();
  if (integrityRows.length !== 1 || String(Object.values(integrityRows[0])[0]).toLowerCase() !== "ok") {
    throw new Error("REWARD_CAS_SQLITE_INTEGRITY_CHECK_FAILED");
  }
  if (database.prepare("PRAGMA foreign_key_check").all().length !== 0) {
    throw new Error("REWARD_CAS_SQLITE_FOREIGN_KEY_CHECK_FAILED");
  }
}

function insertEntityGenesis(database, record) {
  database.prepare(`
    INSERT INTO reward_cas_entity_versions (
      entity_kind, entity_key, revision_be, revision_text, state_sha256, record_blob,
      status, runtime_authentication_verified, rollback_protection_verified,
      activation_ready, mainnet_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.entityKind,
    record.entityKey,
    u64Be(record.revision, "genesis entity revision"),
    record.revision.toString(),
    record.stateSha256,
    encodeRecord(record),
    ...rowFlags(),
  );
}

function insertHeadGenesis(database, head) {
  database.prepare(`
    INSERT INTO reward_cas_head_history (
      sequence_be, sequence_text, head_commit_sha256, record_blob, status,
      runtime_authentication_verified, rollback_protection_verified,
      activation_ready, mainnet_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    u64Be(head.commitSequence, "genesis head sequence"),
    head.commitSequence.toString(),
    head.headCommitSha256,
    encodeRecord(head),
    ...rowFlags(),
  );
}

function genesisEntitySetSha256(records) {
  return rewardCasStateSha256([...records].sort((left, right) => (
    left.entityKind.localeCompare(right.entityKind) || left.entityKey.localeCompare(right.entityKey)
  )));
}

function initializeDatabase(database, initialState) {
  const entities = createRewardCasFixtureRecords(initialState);
  const genesisDigest = genesisEntitySetSha256(entities);
  const head = createInitialRewardCasHead();
  const snapshot = {
    head: clone(head),
    entities: entities.map(clone),
    commits: [],
    roundConsumptions: [],
    roundProofs: [],
    upgradeAttempts: [],
  };
  validateRewardCasSnapshot(snapshot);
  database.exec("BEGIN IMMEDIATE");
  let transactionOpen = true;
  try {
    for (const { sql } of SCHEMA_OBJECTS) database.exec(sql);
    database.prepare(`
      INSERT INTO reward_cas_sqlite_meta (
        singleton_id, adapter_schema, schema_version, adapter_status, reference_status,
        deployment_domain_sha256, schema_manifest_sha256, genesis_entity_set_sha256,
        runtime_authentication_verified, rollback_protection_verified,
        activation_ready, mainnet_status
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)
    `).run(
      REWARD_CAS_SQLITE_ADAPTER_SCHEMA,
      REWARD_CAS_SQLITE_SCHEMA_VERSION,
      REWARD_CAS_SQLITE_STATUS,
      REWARD_CAS_STATUS,
      REFERENCE_DEPLOYMENT_DOMAIN_SHA256,
      REWARD_CAS_SQLITE_SCHEMA_MANIFEST_SHA256,
      genesisDigest,
      REWARD_CAS_SQLITE_MAINNET_STATUS,
    );
    for (const record of entities) insertEntityGenesis(database, record);
    insertHeadGenesis(database, head);
    database.exec("COMMIT");
    transactionOpen = false;
  } catch (error) {
    if (transactionOpen) database.exec("ROLLBACK");
    throw error;
  }
}

function hasExactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function validateRowFlags(row, label) {
  if (row.status !== REWARD_CAS_STATUS
    || row.runtime_authentication_verified !== 0
    || row.rollback_protection_verified !== 0
    || row.activation_ready !== 0
    || row.mainnet_status !== REWARD_CAS_MAINNET_STATUS) {
    throw new Error(`REWARD_CAS_SQLITE_${label}_ROW_FLAGS_MISMATCH`);
  }
}

function validateEntityRecord(record, row) {
  if (!hasExactKeys(record, [
    "schema", "status", "entityKind", "entityKey", "revision", "stateSha256", "value",
    "runtimeAuthenticationVerified", "rollbackProtectionVerified", "activationReady", "mainnetStatus",
  ])
    || record.schema !== REWARD_CAS_ENTITY_SCHEMA
    || !Object.values(REWARD_CAS_ENTITY_KIND).includes(record.entityKind)
    || typeof record.entityKey !== "string"
    || record.entityKey.length === 0) {
    throw new Error("REWARD_CAS_SQLITE_INVALID_ENTITY_RECORD");
  }
  flags(record, "ENTITY");
  asU64(record.revision, "stored entity revision");
  if (asHex32(record.stateSha256, "stored entity digest") !== rewardCasStateSha256(record.value)
    || row.entity_kind !== record.entityKind
    || row.entity_key !== record.entityKey
    || u64FromBe(row.revision_be, "entity revision BLOB") !== record.revision
    || row.revision_text !== record.revision.toString()
    || row.state_sha256 !== record.stateSha256) {
    throw new Error("REWARD_CAS_SQLITE_ENTITY_ROW_BINDING_MISMATCH");
  }
  validateRowFlags(row, "ENTITY");
  const rebuilt = createRewardCasEntityRecord({
    entityKind: record.entityKind,
    entityKey: record.entityKey,
    revision: record.revision,
    value: record.value,
  });
  if (!encodeRecord(rebuilt).equals(encodeRecord(record))) {
    throw new Error("REWARD_CAS_SQLITE_ENTITY_NOT_CANONICAL_REBUILD");
  }
  return record;
}

function validateHeadRecord(record, row) {
  validateRewardCasHead(record);
  flags(record, "HEAD");
  if (u64FromBe(row.sequence_be, "head sequence BLOB") !== record.commitSequence
    || row.sequence_text !== record.commitSequence.toString()
    || row.head_commit_sha256 !== record.headCommitSha256) {
    throw new Error("REWARD_CAS_SQLITE_HEAD_ROW_BINDING_MISMATCH");
  }
  validateRowFlags(row, "HEAD");
  return record;
}

function validateCommitRecord(record, row, expectedSequence, expectedPrevious) {
  if (record.schema !== REWARD_CAS_COMMIT_SCHEMA) throw new Error("REWARD_CAS_SQLITE_COMMIT_SCHEMA_MISMATCH");
  validateRewardCasCommit(record, {
    expectedSequence,
    expectedPreviousCommitSha256: expectedPrevious,
  });
  flags(record, "COMMIT");
  if (u64FromBe(row.sequence_be, "commit sequence BLOB") !== record.sequence
    || row.sequence_text !== record.sequence.toString()
    || row.commit_sha256 !== record.commitSha256
    || row.previous_commit_sha256 !== record.previousCommitSha256
    || row.operation !== record.operation) {
    throw new Error("REWARD_CAS_SQLITE_COMMIT_ROW_BINDING_MISMATCH");
  }
  validateRowFlags(row, "COMMIT");
  return record;
}

function validateMarkerRecord(record, row, kind) {
  flags(record, kind);
  validateRowFlags(row, kind);
  if (kind === "ROUND_CONSUMPTION") {
    if (row.funding_round_at_unix_seconds !== record.fundingRoundAtUnixSeconds.toString()
      || row.commit_sha256 !== record.commitSha256
      || row.proof_bundle_sha256 !== record.proofBundleSha256) {
      throw new Error("REWARD_CAS_SQLITE_ROUND_CONSUMPTION_ROW_BINDING_MISMATCH");
    }
  } else if (kind === "ROUND_PROOF") {
    if (row.funding_round_at_unix_seconds !== record.fundingRoundAtUnixSeconds.toString()
      || row.commit_sha256 !== record.commitSha256
      || row.proof_bundle_sha256 !== record.proofBundleSha256
      || row.proof_record_sha256 !== record.proofRecordSha256) {
      throw new Error("REWARD_CAS_SQLITE_ROUND_PROOF_ROW_BINDING_MISMATCH");
    }
  } else if (row.reward_id !== record.rewardId
    || row.commit_sha256 !== record.commitSha256
    || row.attempt_sha256 !== record.attemptSha256) {
    throw new Error("REWARD_CAS_SQLITE_UPGRADE_ATTEMPT_ROW_BINDING_MISMATCH");
  }
  return record;
}

function entityIdentity(kind, key) {
  return `${kind}\u0000${key}`;
}

function readAndValidateSnapshot(database) {
  const entityRows = database.prepare(`
    SELECT * FROM reward_cas_entity_versions
    ORDER BY entity_kind, entity_key, revision_be
  `).all();
  const entitiesByIdentity = new Map();
  for (const row of entityRows) {
    const record = validateEntityRecord(decodeRecord(row.record_blob, "ENTITY"), row);
    const identity = entityIdentity(record.entityKind, record.entityKey);
    const versions = entitiesByIdentity.get(identity) ?? [];
    if (record.revision !== BigInt(versions.length)) {
      throw new Error("REWARD_CAS_SQLITE_ENTITY_VERSION_GAP");
    }
    versions.push(record);
    entitiesByIdentity.set(identity, versions);
  }
  if (entitiesByIdentity.size === 0) throw new Error("REWARD_CAS_SQLITE_ENTITY_SET_EMPTY");
  const genesisRecords = [...entitiesByIdentity.values()].map(([genesis]) => genesis);
  const genesisDigest = database.prepare(`
    SELECT genesis_entity_set_sha256 FROM reward_cas_sqlite_meta WHERE singleton_id = 1
  `).get()?.genesis_entity_set_sha256;
  if (genesisEntitySetSha256(genesisRecords) !== genesisDigest) {
    throw new Error("REWARD_CAS_SQLITE_GENESIS_ENTITY_SET_MISMATCH");
  }

  const commitRows = database.prepare("SELECT * FROM reward_cas_commits ORDER BY sequence_be").all();
  const commits = [];
  let previousCommitSha256 = REWARD_CAS_ZERO_SHA256;
  for (const [index, row] of commitRows.entries()) {
    const commit = validateCommitRecord(
      decodeRecord(row.record_blob, "COMMIT"),
      row,
      BigInt(index + 1),
      previousCommitSha256,
    );
    commits.push(commit);
    previousCommitSha256 = commit.commitSha256;
  }

  const headRows = database.prepare("SELECT * FROM reward_cas_head_history ORDER BY sequence_be").all();
  if (headRows.length !== commits.length + 1) throw new Error("REWARD_CAS_SQLITE_HEAD_HISTORY_GAP");
  const heads = headRows.map((row) => validateHeadRecord(decodeRecord(row.record_blob, "HEAD"), row));
  for (const [index, head] of heads.entries()) {
    if (head.commitSequence !== BigInt(index)
      || head.headCommitSha256 !== (index === 0 ? REWARD_CAS_ZERO_SHA256 : commits[index - 1].commitSha256)) {
      throw new Error("REWARD_CAS_SQLITE_HEAD_HISTORY_COMMIT_MISMATCH");
    }
  }

  const changeByNextVersion = new Map();
  for (const commit of commits) {
    for (const change of commit.changes) {
      const key = `${entityIdentity(change.entityKind, change.entityKey)}\u0000${change.nextRevision}`;
      if (changeByNextVersion.has(key)) throw new Error("REWARD_CAS_SQLITE_DUPLICATE_ENTITY_CHANGE");
      changeByNextVersion.set(key, change);
    }
  }
  for (const [identity, versions] of entitiesByIdentity) {
    for (let index = 1; index < versions.length; index += 1) {
      const before = versions[index - 1];
      const after = versions[index];
      const key = `${identity}\u0000${after.revision}`;
      const change = changeByNextVersion.get(key);
      if (!change
        || change.expectedRevision !== before.revision
        || change.expectedStateSha256 !== before.stateSha256
        || change.nextRevision !== after.revision
        || change.nextStateSha256 !== after.stateSha256) {
        throw new Error("REWARD_CAS_SQLITE_ENTITY_HISTORY_CHANGE_MISMATCH");
      }
      changeByNextVersion.delete(key);
    }
  }
  if (changeByNextVersion.size !== 0) throw new Error("REWARD_CAS_SQLITE_CHANGE_WITHOUT_ENTITY_VERSION");

  const consumptionRows = database.prepare(`
    SELECT marker.*
    FROM reward_cas_round_consumptions AS marker
    JOIN reward_cas_commits AS commit_record ON commit_record.commit_sha256 = marker.commit_sha256
    ORDER BY commit_record.sequence_be
  `).all();
  const proofRows = database.prepare(`
    SELECT proof.*
    FROM reward_cas_round_proofs AS proof
    JOIN reward_cas_commits AS commit_record ON commit_record.commit_sha256 = proof.commit_sha256
    ORDER BY commit_record.sequence_be
  `).all();
  const attemptRows = database.prepare(`
    SELECT attempt.*
    FROM reward_cas_upgrade_attempts AS attempt
    JOIN reward_cas_commits AS commit_record ON commit_record.commit_sha256 = attempt.commit_sha256
    ORDER BY commit_record.sequence_be
  `).all();
  const roundConsumptions = consumptionRows.map((row) => validateMarkerRecord(
    decodeRecord(row.record_blob, "ROUND_CONSUMPTION"),
    row,
    "ROUND_CONSUMPTION",
  ));
  const roundProofs = proofRows.map((row) => validateMarkerRecord(
    decodeRecord(row.record_blob, "ROUND_PROOF"),
    row,
    "ROUND_PROOF",
  ));
  const upgradeAttempts = attemptRows.map((row) => validateMarkerRecord(
    decodeRecord(row.record_blob, "UPGRADE_ATTEMPT"),
    row,
    "UPGRADE_ATTEMPT",
  ));
  const snapshot = {
    head: heads.at(-1),
    entities: [...entitiesByIdentity.values()].map((versions) => versions.at(-1)),
    commits,
    roundConsumptions,
    roundProofs,
    upgradeAttempts,
  };
  validateRewardCasSnapshot(snapshot);
  return snapshot;
}

function validateDatabaseNoTransaction(database) {
  validateSchema(database);
  validateMeta(database);
  assertDatabaseIntegrity(database);
  return readAndValidateSnapshot(database);
}

function validateDatabase(database) {
  let transactionOpen = false;
  try {
    database.exec("BEGIN");
    transactionOpen = true;
    const snapshot = validateDatabaseNoTransaction(database);
    database.exec("COMMIT");
    transactionOpen = false;
    return snapshot;
  } catch (error) {
    if (transactionOpen) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Preserve the validation failure.
      }
    }
    throw error;
  }
}

function insertEntityVersionCas(database, before, after) {
  const result = database.prepare(`
    INSERT INTO reward_cas_entity_versions (
      entity_kind, entity_key, revision_be, revision_text, state_sha256, record_blob,
      status, runtime_authentication_verified, rollback_protection_verified,
      activation_ready, mainnet_status
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (
      SELECT 1
      FROM reward_cas_entity_versions AS current
      WHERE current.entity_kind = ?
        AND current.entity_key = ?
        AND current.revision_be = ?
        AND current.state_sha256 = ?
        AND NOT EXISTS (
          SELECT 1
          FROM reward_cas_entity_versions AS newer
          WHERE newer.entity_kind = current.entity_kind
            AND newer.entity_key = current.entity_key
            AND newer.revision_be > current.revision_be
        )
    )
  `).run(
    after.entityKind,
    after.entityKey,
    u64Be(after.revision, "next entity revision"),
    after.revision.toString(),
    after.stateSha256,
    encodeRecord(after),
    ...rowFlags(),
    before.entityKind,
    before.entityKey,
    u64Be(before.revision, "expected entity revision"),
    before.stateSha256,
  );
  if (result.changes !== 1) throw new Error("REWARD_CAS_STALE_VERSION_OR_DIGEST");
}

function insertCommit(database, commit) {
  database.prepare(`
    INSERT INTO reward_cas_commits (
      sequence_be, sequence_text, commit_sha256, previous_commit_sha256,
      operation, record_blob, status, runtime_authentication_verified,
      rollback_protection_verified, activation_ready, mainnet_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    u64Be(commit.sequence, "commit sequence"),
    commit.sequence.toString(),
    commit.commitSha256,
    commit.previousCommitSha256,
    commit.operation,
    encodeRecord(commit),
    ...rowFlags(),
  );
}

function insertHeadCas(database, before, after) {
  const result = database.prepare(`
    INSERT INTO reward_cas_head_history (
      sequence_be, sequence_text, head_commit_sha256, record_blob, status,
      runtime_authentication_verified, rollback_protection_verified,
      activation_ready, mainnet_status
    )
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (
      SELECT 1
      FROM reward_cas_head_history AS current
      WHERE current.sequence_be = ?
        AND current.head_commit_sha256 = ?
        AND NOT EXISTS (
          SELECT 1 FROM reward_cas_head_history AS newer
          WHERE newer.sequence_be > current.sequence_be
        )
    )
  `).run(
    u64Be(after.commitSequence, "next head sequence"),
    after.commitSequence.toString(),
    after.headCommitSha256,
    encodeRecord(after),
    ...rowFlags(),
    u64Be(before.commitSequence, "expected head sequence"),
    before.headCommitSha256,
  );
  if (result.changes !== 1) throw new Error("REWARD_CAS_SQLITE_STALE_HEAD");
}

function insertRoundConsumption(database, record) {
  database.prepare(`
    INSERT INTO reward_cas_round_consumptions (
      funding_round_at_unix_seconds, commit_sha256, proof_bundle_sha256,
      record_blob, status, runtime_authentication_verified,
      rollback_protection_verified, activation_ready, mainnet_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.fundingRoundAtUnixSeconds.toString(),
    record.commitSha256,
    record.proofBundleSha256,
    encodeRecord(record),
    ...rowFlags(),
  );
}

function insertRoundProof(database, record) {
  database.prepare(`
    INSERT INTO reward_cas_round_proofs (
      funding_round_at_unix_seconds, commit_sha256, proof_bundle_sha256,
      proof_record_sha256, record_blob, status, runtime_authentication_verified,
      rollback_protection_verified, activation_ready, mainnet_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.fundingRoundAtUnixSeconds.toString(),
    record.commitSha256,
    record.proofBundleSha256,
    record.proofRecordSha256,
    encodeRecord(record),
    ...rowFlags(),
  );
}

function insertUpgradeAttempt(database, record) {
  database.prepare(`
    INSERT INTO reward_cas_upgrade_attempts (
      reward_id, commit_sha256, attempt_sha256, record_blob, status,
      runtime_authentication_verified, rollback_protection_verified,
      activation_ready, mainnet_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.rewardId,
    record.commitSha256,
    record.attemptSha256,
    encodeRecord(record),
    ...rowFlags(),
  );
}

function executeImmediateTransaction(database, operation, fault) {
  let transactionOpen = false;
  try {
    database.exec("BEGIN IMMEDIATE");
    transactionOpen = true;
    const result = operation();
    database.exec("COMMIT");
    transactionOpen = false;
    fault(REWARD_CAS_SQLITE_TEST_FAULT.AFTER_DURABLE_COMMIT);
    return result;
  } catch (error) {
    if (transactionOpen) {
      try {
        database.exec("ROLLBACK");
      } catch {
        // Preserve the first failure; reopen validation will detect any impossible rollback failure.
      }
    }
    throw error;
  }
}

function currentEntity(snapshot, kind, key) {
  return snapshot.entities.find((record) => record.entityKind === kind && record.entityKey === key) ?? null;
}

function finalizeRound(database, input, fault) {
  const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
  return executeImmediateTransaction(database, () => {
    const snapshot = validateDatabaseNoTransaction(database);
    const roundKey = rewardCasRoundKey(input.fundingRoundAtUnixSeconds);
    const fundingRound = BigInt(roundKey);
    if (snapshot.roundConsumptions.some((record) => record.fundingRoundAtUnixSeconds === fundingRound)) {
      throw new Error("REWARD_CAS_ROUND_ALREADY_CONSUMED");
    }
    if (snapshot.entities.some((record) => (
      record.entityKind === REWARD_CAS_ENTITY_KIND.ROUND
      && record.value.status === "SEALED_PENDING_FINALIZATION"
      && BigInt(record.entityKey) < fundingRound
    ))) throw new Error("REWARD_CAS_EARLIER_PENDING_ROUND_EXISTS");
    const roundRecord = currentEntity(snapshot, REWARD_CAS_ENTITY_KIND.ROUND, roundKey);
    const ledgerRecord = currentEntity(
      snapshot,
      REWARD_CAS_ENTITY_KIND.LANE_LEDGER,
      REWARD_CAS_GLOBAL_LEDGER_KEY,
    );
    if (!roundRecord || !ledgerRecord) throw new Error("REWARD_CAS_REQUIRED_ENTITY_MISSING");
    const prepared = prepareRewardRoundFinalizationCas({
      ...input,
      dailyLawState,
      roundRecord,
      ledgerRecord,
    });
    const { commit, nextHead } = createRewardCasCommit({
      head: snapshot.head,
      operation: REWARD_CAS_OPERATION.FINALIZE_ROUND,
      changes: prepared.changes,
      evidenceSha256: prepared.evidenceSha256,
      dailyLawState,
    });
    const consumption = Object.freeze({
      ...prepared.roundConsumption,
      commitSha256: commit.commitSha256,
    });
    const proofRecord = createRewardCasRoundProofRecord({
      prepared,
      commit,
      cccRandomnessReveal: input.cccRandomnessReveal ?? null,
    });
    insertRoundConsumption(database, consumption);
    fault(REWARD_CAS_SQLITE_TEST_FAULT.AFTER_MARKER);
    insertEntityVersionCas(database, roundRecord, prepared.nextRoundRecord);
    fault(REWARD_CAS_SQLITE_TEST_FAULT.AFTER_FIRST_ENTITY);
    insertRoundProof(database, proofRecord);
    fault(REWARD_CAS_SQLITE_TEST_FAULT.AFTER_PROOF);
    insertEntityVersionCas(database, ledgerRecord, prepared.nextLedgerRecord);
    insertCommit(database, commit);
    fault(REWARD_CAS_SQLITE_TEST_FAULT.AFTER_COMMIT);
    insertHeadCas(database, snapshot.head, nextHead);
    fault(REWARD_CAS_SQLITE_TEST_FAULT.AFTER_HEAD);
    validateDatabaseNoTransaction(database);
    return clone({
      commit,
      roundConsumption: consumption,
      proofRecord,
      roundRecord: prepared.nextRoundRecord,
      ledgerRecord: prepared.nextLedgerRecord,
      proofBundle: prepared.proofBundle,
    });
  }, fault);
}

function recordPremiumUpgrade(database, input, fault) {
  const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
  return executeImmediateTransaction(database, () => {
    const snapshot = validateDatabaseNoTransaction(database);
    const rewardId = asHex32(input.rewardId, "rewardId");
    if (snapshot.upgradeAttempts.some((record) => record.rewardId === rewardId)) {
      throw new Error("REWARD_CAS_UPGRADE_ATTEMPT_ALREADY_RECORDED");
    }
    const rewardRecord = currentEntity(snapshot, REWARD_CAS_ENTITY_KIND.X_REWARD, rewardId);
    if (!rewardRecord) throw new Error("REWARD_CAS_REQUIRED_ENTITY_MISSING");
    const prepared = preparePremiumUpgradeCas({ ...input, dailyLawState, rewardRecord });
    const { commit, nextHead } = createRewardCasCommit({
      head: snapshot.head,
      operation: REWARD_CAS_OPERATION.RECORD_PREMIUM_UPGRADE,
      changes: prepared.changes,
      evidenceSha256: prepared.evidenceSha256,
      dailyLawState,
    });
    const attempt = Object.freeze({
      ...prepared.upgradeAttempt,
      commitSha256: commit.commitSha256,
    });
    insertUpgradeAttempt(database, attempt);
    fault(REWARD_CAS_SQLITE_TEST_FAULT.AFTER_MARKER);
    insertEntityVersionCas(database, rewardRecord, prepared.nextRewardRecord);
    fault(REWARD_CAS_SQLITE_TEST_FAULT.AFTER_FIRST_ENTITY);
    insertCommit(database, commit);
    fault(REWARD_CAS_SQLITE_TEST_FAULT.AFTER_COMMIT);
    insertHeadCas(database, snapshot.head, nextHead);
    fault(REWARD_CAS_SQLITE_TEST_FAULT.AFTER_HEAD);
    validateDatabaseNoTransaction(database);
    return clone({ commit, upgradeAttempt: attempt, rewardRecord: prepared.nextRewardRecord });
  }, fault);
}

export function createSqliteRewardPersistenceCas({
  databasePath,
  initialState = undefined,
  busyTimeoutMs = 0,
  testOnlyFault = null,
} = {}) {
  if (typeof databasePath !== "string" || databasePath.length === 0) {
    throw new TypeError("reward CAS SQLite databasePath must be a non-empty string");
  }
  if (databasePath === ":memory:") {
    throw new Error("REWARD_CAS_SQLITE_FILE_BACKED_DATABASE_REQUIRED");
  }
  if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0 || busyTimeoutMs > 60_000) {
    throw new RangeError("reward CAS SQLite busyTimeoutMs must be an integer from 0 through 60000");
  }
  if (!ACCEPTED_FAULTS.has(testOnlyFault)) throw new Error("UNKNOWN_TEST_ONLY_REWARD_CAS_SQLITE_FAULT");
  const fileBacked = true;
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
    if (closed) throw new Error("REWARD_CAS_SQLITE_STORE_CLOSED");
  };
  const fault = (point) => {
    if (testOnlyFault === point) throw new Error(`TEST_ONLY_REWARD_CAS_SQLITE_FAULT_${point}`);
  };
  try {
    configureDatabase(database, { fileBacked, busyTimeoutMs });
    const existingObjects = userSchemaRows(database);
    if (existingObjects.length === 0) {
      if (initialState === undefined || initialState === null) {
        throw new Error("REWARD_CAS_SQLITE_INITIAL_STATE_REQUIRED");
      }
      initializeDatabase(database, initialState);
    } else if (initialState !== undefined && initialState !== null) {
      throw new Error("REWARD_CAS_SQLITE_ALREADY_INITIALIZED");
    }
    validateDatabase(database);
  } catch (error) {
    database.close();
    closed = true;
    throw error;
  }

  const readSnapshot = () => {
    ensureOpen();
    return clone(validateDatabase(database));
  };
  const store = {
    adapterSchema: REWARD_CAS_SQLITE_ADAPTER_SCHEMA,
    schemaVersion: REWARD_CAS_SQLITE_SCHEMA_VERSION,
    status: REWARD_CAS_SQLITE_STATUS,
    runtimeAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_CAS_SQLITE_MAINNET_STATUS,
    readPragmas() {
      ensureOpen();
      return Object.freeze({
        foreignKeys: Number(pragmaScalar(database, "foreign_keys")),
        journalMode: String(pragmaScalar(database, "journal_mode")).toLowerCase(),
        synchronous: Number(pragmaScalar(database, "synchronous")),
        recursiveTriggers: Number(pragmaScalar(database, "recursive_triggers")),
        trustedSchema: Number(pragmaScalar(database, "trusted_schema")),
        defensive: true,
        busyTimeoutMs: Number(pragmaScalar(database, "busy_timeout")),
      });
    },
    readHead() {
      return readSnapshot().head;
    },
    readEntity(kind, key) {
      if (!Object.values(REWARD_CAS_ENTITY_KIND).includes(kind)
        || typeof key !== "string"
        || key.length === 0) throw new TypeError("invalid reward CAS entity kind or key");
      return readSnapshot().entities.find((record) => (
        record.entityKind === kind && record.entityKey === key
      )) ?? null;
    },
    readCommit(sequence) {
      const canonicalSequence = asU64(sequence, "commit sequence");
      return readSnapshot().commits.find((commit) => commit.sequence === canonicalSequence) ?? null;
    },
    readRoundConsumption(fundingRoundAtUnixSeconds) {
      const roundKey = rewardCasRoundKey(fundingRoundAtUnixSeconds);
      return readSnapshot().roundConsumptions.find((record) => (
        record.fundingRoundAtUnixSeconds.toString() === roundKey
      )) ?? null;
    },
    readRoundProof(fundingRoundAtUnixSeconds) {
      const roundKey = rewardCasRoundKey(fundingRoundAtUnixSeconds);
      return readSnapshot().roundProofs.find((record) => (
        record.fundingRoundAtUnixSeconds.toString() === roundKey
      )) ?? null;
    },
    readUpgradeAttempt(rewardId) {
      const canonicalRewardId = asHex32(rewardId, "rewardId");
      return readSnapshot().upgradeAttempts.find((record) => record.rewardId === canonicalRewardId) ?? null;
    },
    snapshot: readSnapshot,
    close() {
      if (!closed) {
        database.close();
        closed = true;
      }
    },
  };
  Object.defineProperty(store, REWARD_CAS_STORE_ADAPTER, {
    enumerable: false,
    value: Object.freeze({
      finalizeRound(input) {
        const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
        ensureOpen();
        return finalizeRound(database, { ...input, dailyLawState }, fault);
      },
      recordPremiumUpgrade(input) {
        const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
        ensureOpen();
        return recordPremiumUpgrade(database, { ...input, dailyLawState }, fault);
      },
    }),
  });
  return Object.freeze(store);
}

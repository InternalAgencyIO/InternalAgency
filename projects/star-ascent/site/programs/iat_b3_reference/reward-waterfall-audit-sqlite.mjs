import { DatabaseSync } from "node:sqlite";

import { allocatorTranscriptSha256 } from "./reward-allocator-receipt-codec.mjs";
import {
  REWARD_ALLOCATOR_PROOF_BUNDLE_SCHEMA,
  REWARD_ALLOCATOR_PROOF_BUNDLE_STATUS,
  validateRewardAllocatorProofBundle,
} from "./reward-allocator-proof-bundle.mjs";
import {
  decodeRewardCasTypedValue,
  encodeRewardCasTypedValue,
  rewardAllocatorProofBundleSha256,
  rewardCasStateSha256,
} from "./reward-persistence-cas.mjs";

export const REWARD_WATERFALL_AUDIT_SQLITE_SCHEMA =
  "iat-b3-reward-waterfall-audit-sqlite/v1";
export const REWARD_WATERFALL_AUDIT_SQLITE_STATUS =
  "HOST_ONLY_NONACTIVATING_REPLAY_AUDIT";
export const REWARD_WATERFALL_AUDIT_SQLITE_MAINNET_STATUS = "HOLD";
export const REWARD_WATERFALL_AUDIT_SQLITE_DEFENSIVE_MODE_REQUIRED = true;
export const REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT = Object.freeze({
  AFTER_ROUND_INSERT: "AFTER_ROUND_INSERT",
  AFTER_RECEIPT_INSERT: "AFTER_RECEIPT_INSERT",
  BEFORE_COMMIT: "BEFORE_COMMIT",
  AFTER_DURABLE_COMMIT: "AFTER_DURABLE_COMMIT",
  HARD_EXIT_AFTER_RECEIPT_INSERT: "HARD_EXIT_AFTER_RECEIPT_INSERT",
  HARD_EXIT_AFTER_DURABLE_COMMIT: "HARD_EXIT_AFTER_DURABLE_COMMIT",
});

const ACCEPTED_FAULTS = new Set([
  null,
  ...Object.values(REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT),
]);
const ROUND_TABLE = "reward_waterfall_audit_rounds";
const RECEIPT_TABLE = "reward_waterfall_audit_receipts";
const TABLES = Object.freeze([ROUND_TABLE, RECEIPT_TABLE]);

const TABLE_SQL = Object.freeze({
  [ROUND_TABLE]: `CREATE TABLE ${ROUND_TABLE} (
    funding_round_at_unix_seconds TEXT PRIMARY KEY CHECK (
      length(funding_round_at_unix_seconds) BETWEEN 1 AND 20
      AND (
        funding_round_at_unix_seconds = '0'
        OR (
          substr(funding_round_at_unix_seconds, 1, 1) BETWEEN '1' AND '9'
          AND funding_round_at_unix_seconds NOT GLOB '*[^0-9]*'
        )
        OR (
          substr(funding_round_at_unix_seconds, 1, 2) BETWEEN '-1' AND '-9'
          AND substr(funding_round_at_unix_seconds, 2) NOT GLOB '*[^0-9]*'
        )
      )
    ),
    finalized_round_sha256 TEXT NOT NULL UNIQUE CHECK (length(finalized_round_sha256) = 64 AND finalized_round_sha256 NOT GLOB '*[^0-9a-f]*'),
    batch_sha256 TEXT NOT NULL UNIQUE CHECK (length(batch_sha256) = 64 AND batch_sha256 NOT GLOB '*[^0-9a-f]*'),
    proof_bundle_sha256 TEXT NOT NULL UNIQUE CHECK (length(proof_bundle_sha256) = 64 AND proof_bundle_sha256 NOT GLOB '*[^0-9a-f]*'),
    receipt_count INTEGER NOT NULL CHECK (receipt_count BETWEEN 0 AND 4294967295),
    finalized_round_blob BLOB NOT NULL CHECK (typeof(finalized_round_blob) = 'blob' AND length(finalized_round_blob) > 0),
    ccc_reveal_blob BLOB NOT NULL CHECK (typeof(ccc_reveal_blob) = 'blob' AND length(ccc_reveal_blob) > 0),
    batch_blob BLOB NOT NULL CHECK (typeof(batch_blob) = 'blob' AND length(batch_blob) = 320),
    status TEXT NOT NULL CHECK (status = '${REWARD_WATERFALL_AUDIT_SQLITE_STATUS}'),
    runtime_authentication_verified INTEGER NOT NULL CHECK (runtime_authentication_verified = 0),
    rollback_protection_verified INTEGER NOT NULL CHECK (rollback_protection_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_WATERFALL_AUDIT_SQLITE_MAINNET_STATUS}')
  ) STRICT, WITHOUT ROWID`,
  [RECEIPT_TABLE]: `CREATE TABLE ${RECEIPT_TABLE} (
    funding_round_at_unix_seconds TEXT NOT NULL,
    allocation_index INTEGER NOT NULL CHECK (allocation_index BETWEEN 0 AND 4294967295),
    receipt_sha256 TEXT NOT NULL UNIQUE CHECK (length(receipt_sha256) = 64 AND receipt_sha256 NOT GLOB '*[^0-9a-f]*'),
    receipt_blob BLOB NOT NULL CHECK (typeof(receipt_blob) = 'blob' AND length(receipt_blob) = 288),
    status TEXT NOT NULL CHECK (status = '${REWARD_WATERFALL_AUDIT_SQLITE_STATUS}'),
    runtime_authentication_verified INTEGER NOT NULL CHECK (runtime_authentication_verified = 0),
    rollback_protection_verified INTEGER NOT NULL CHECK (rollback_protection_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${REWARD_WATERFALL_AUDIT_SQLITE_MAINNET_STATUS}'),
    PRIMARY KEY (funding_round_at_unix_seconds, allocation_index),
    FOREIGN KEY (funding_round_at_unix_seconds)
      REFERENCES ${ROUND_TABLE}(funding_round_at_unix_seconds)
      DEFERRABLE INITIALLY DEFERRED
  ) STRICT, WITHOUT ROWID`,
});

function immutableTrigger(table, operation) {
  return `CREATE TRIGGER ${table}_forbid_${operation.toLowerCase()}
    BEFORE ${operation} ON ${table}
    BEGIN
      SELECT RAISE(ABORT, 'REWARD_WATERFALL_AUDIT_APPEND_ONLY_${operation}_FORBIDDEN');
    END`;
}

const DUPLICATE_CONFIG = Object.freeze({
  [ROUND_TABLE]: Object.freeze({
    predicate: "funding_round_at_unix_seconds = NEW.funding_round_at_unix_seconds",
    error: "REWARD_WATERFALL_AUDIT_ROUND_ALREADY_RETAINED",
  }),
  [RECEIPT_TABLE]: Object.freeze({
    predicate: `(funding_round_at_unix_seconds = NEW.funding_round_at_unix_seconds
      AND allocation_index = NEW.allocation_index) OR receipt_sha256 = NEW.receipt_sha256`,
    error: "REWARD_WATERFALL_AUDIT_RECEIPT_ALREADY_RETAINED",
  }),
});

const TRIGGER_SQL = Object.freeze(Object.fromEntries(TABLES.flatMap((table) => [
  [`${table}_forbid_update`, immutableTrigger(table, "UPDATE")],
  [`${table}_forbid_delete`, immutableTrigger(table, "DELETE")],
  [`${table}_forbid_duplicate_insert`, `CREATE TRIGGER ${table}_forbid_duplicate_insert
    BEFORE INSERT ON ${table}
    WHEN EXISTS (SELECT 1 FROM ${table} WHERE ${DUPLICATE_CONFIG[table].predicate})
    BEGIN
      SELECT RAISE(ABORT, '${DUPLICATE_CONFIG[table].error}');
    END`],
])));

const SCHEMA_OBJECTS = Object.freeze([
  ...Object.entries(TABLE_SQL).map(([name, sql]) => ({ type: "table", name, tableName: name, sql })),
  ...Object.entries(TRIGGER_SQL).map(([name, sql]) => ({
    type: "trigger",
    name,
    tableName: name.replace(/_forbid_(?:update|delete|duplicate_insert)$/u, ""),
    sql,
  })),
]);

function normalizeSql(sql) {
  return sql.replace(/;\s*$/u, "").replace(/\s+/gu, " ").trim();
}

function decodeCanonical(blob, label) {
  try {
    const bytes = Buffer.from(blob.buffer, blob.byteOffset, blob.byteLength);
    return decodeRewardCasTypedValue(bytes);
  } catch (error) {
    throw new Error(`REWARD_WATERFALL_AUDIT_INVALID_${label}_BLOB`, { cause: error });
  }
}

function requireInput(input) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype) {
    throw new TypeError("reward waterfall audit append requires exact data-only input");
  }
  const keys = Reflect.ownKeys(input);
  const descriptors = Object.getOwnPropertyDescriptors(input);
  if (keys.some((key) => typeof key !== "string")
    || keys.slice().sort().join("|") !== "bundle|cccRandomnessReveal|roundState"
    || keys.some((key) => !descriptors[key]?.enumerable || !("value" in descriptors[key]))) {
    throw new TypeError("reward waterfall audit append requires exact data-only input");
  }
  const normalizedInput = decodeRewardCasTypedValue(encodeRewardCasTypedValue({
    roundState: descriptors.roundState.value,
    cccRandomnessReveal: descriptors.cccRandomnessReveal.value,
    bundle: descriptors.bundle.value,
  }));
  const validated = validateRewardAllocatorProofBundle(normalizedInput);
  return {
    validated,
    input: Object.freeze(normalizedInput),
  };
}

function configure(database, busyTimeoutMs) {
  if (typeof database.enableDefensive !== "function") {
    throw new Error("REWARD_WATERFALL_AUDIT_SQLITE_DEFENSIVE_MODE_REQUIRED");
  }
  database.enableDefensive(true);
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA recursive_triggers = ON");
  database.exec("PRAGMA trusted_schema = OFF");
  database.exec(`PRAGMA busy_timeout = ${busyTimeoutMs}`);
  if (String(Object.values(database.prepare("PRAGMA journal_mode = WAL").get())[0]).toLowerCase() !== "wal") {
    throw new Error("REWARD_WATERFALL_AUDIT_WAL_REQUIRED");
  }
  database.exec("PRAGMA synchronous = FULL");
  const scalar = (pragma) => Object.values(database.prepare(`PRAGMA ${pragma}`).get())[0];
  if (Number(scalar("foreign_keys")) !== 1
    || Number(scalar("recursive_triggers")) !== 1
    || Number(scalar("trusted_schema")) !== 0
    || Number(scalar("synchronous")) !== 2
    || Number(scalar("busy_timeout")) !== busyTimeoutMs) {
    throw new Error("REWARD_WATERFALL_AUDIT_REQUIRED_PRAGMA_NOT_ACTIVE");
  }
}

function schemaRows(database) {
  return database.prepare(`SELECT type, name, tbl_name, sql FROM sqlite_schema
    WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`).all();
}

function validateSchema(database) {
  const actual = schemaRows(database);
  if (actual.length !== SCHEMA_OBJECTS.length) throw new Error("REWARD_WATERFALL_AUDIT_SCHEMA_OBJECT_SET_MISMATCH");
  const expected = new Map(SCHEMA_OBJECTS.map((entry) => [`${entry.type}|${entry.name}`, entry]));
  for (const row of actual) {
    const match = expected.get(`${row.type}|${row.name}`);
    if (!match || row.tbl_name !== match.tableName || normalizeSql(row.sql ?? "") !== normalizeSql(match.sql)) {
      throw new Error("REWARD_WATERFALL_AUDIT_SCHEMA_DEFINITION_MISMATCH");
    }
  }
}

function validateDatabase(database, { insideTransaction = false } = {}) {
  if (!insideTransaction) database.exec("BEGIN");
  try {
    validateSchema(database);
    const integrity = database.prepare("PRAGMA integrity_check").all();
    if (integrity.length !== 1 || String(Object.values(integrity[0])[0]).toLowerCase() !== "ok") {
      throw new Error("REWARD_WATERFALL_AUDIT_INTEGRITY_CHECK_FAILED");
    }
    if (database.prepare("PRAGMA foreign_key_check").all().length !== 0) {
      throw new Error("REWARD_WATERFALL_AUDIT_FOREIGN_KEY_CHECK_FAILED");
    }
    const rounds = database.prepare(`SELECT * FROM ${ROUND_TABLE} ORDER BY funding_round_at_unix_seconds`).all();
    for (const row of rounds) {
      const roundState = decodeCanonical(row.finalized_round_blob, "ROUND");
      const reveal = decodeCanonical(row.ccc_reveal_blob, "REVEAL");
      const receiptRows = database.prepare(`SELECT * FROM ${RECEIPT_TABLE}
        WHERE funding_round_at_unix_seconds = ? ORDER BY allocation_index`).all(row.funding_round_at_unix_seconds);
      if (receiptRows.length !== row.receipt_count
        || receiptRows.some((receipt, index) => receipt.allocation_index !== index)) {
        throw new Error("REWARD_WATERFALL_AUDIT_RECEIPT_SET_NOT_CONTIGUOUS");
      }
      const bundle = Object.freeze({
        schema: REWARD_ALLOCATOR_PROOF_BUNDLE_SCHEMA,
        status: REWARD_ALLOCATOR_PROOF_BUNDLE_STATUS,
        batchBytes: Buffer.from(row.batch_blob),
        receiptBytes: Object.freeze(receiptRows.map((receipt) => Buffer.from(receipt.receipt_blob))),
        runtimeAuthenticationVerified: false,
        activationReady: false,
        mainnetStatus: REWARD_WATERFALL_AUDIT_SQLITE_MAINNET_STATUS,
      });
      const validated = validateRewardAllocatorProofBundle({ roundState, cccRandomnessReveal: reveal, bundle });
      if (BigInt(row.funding_round_at_unix_seconds) !== validated.batch.fundingRoundAtUnixSeconds
        || row.finalized_round_sha256 !== rewardCasStateSha256(roundState)
        || row.batch_sha256 !== allocatorTranscriptSha256(bundle.batchBytes)
        || row.proof_bundle_sha256 !== rewardAllocatorProofBundleSha256(bundle)
        || receiptRows.some((receipt) => (
          receipt.receipt_sha256 !== allocatorTranscriptSha256(receipt.receipt_blob)
          || receipt.status !== REWARD_WATERFALL_AUDIT_SQLITE_STATUS
          || receipt.runtime_authentication_verified !== 0
          || receipt.rollback_protection_verified !== 0
          || receipt.activation_ready !== 0
          || receipt.mainnet_status !== REWARD_WATERFALL_AUDIT_SQLITE_MAINNET_STATUS
        ))
        || row.status !== REWARD_WATERFALL_AUDIT_SQLITE_STATUS
        || row.runtime_authentication_verified !== 0
        || row.rollback_protection_verified !== 0
        || row.activation_ready !== 0
        || row.mainnet_status !== REWARD_WATERFALL_AUDIT_SQLITE_MAINNET_STATUS) {
        throw new Error("REWARD_WATERFALL_AUDIT_ROW_BINDING_MISMATCH");
      }
    }
    if (!insideTransaction) database.exec("COMMIT");
    return rounds.length;
  } catch (error) {
    if (!insideTransaction) {
      try { database.exec("ROLLBACK"); } catch { /* preserve original failure */ }
    }
    throw error;
  }
}

function initialize(database) {
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const sql of Object.values(TABLE_SQL)) database.exec(sql);
    for (const sql of Object.values(TRIGGER_SQL)) database.exec(sql);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function createRewardWaterfallAuditSqlite({
  databasePath,
  busyTimeoutMs = 0,
  testOnlyFault = null,
} = {}) {
  if (typeof databasePath !== "string" || databasePath.length === 0 || databasePath === ":memory:") {
    throw new TypeError("reward waterfall audit requires a file-backed databasePath");
  }
  if (!Number.isSafeInteger(busyTimeoutMs) || busyTimeoutMs < 0 || busyTimeoutMs > 60_000) {
    throw new RangeError("reward waterfall audit busyTimeoutMs must be 0 through 60000");
  }
  if (!ACCEPTED_FAULTS.has(testOnlyFault)) throw new Error("UNKNOWN_TEST_ONLY_REWARD_WATERFALL_AUDIT_FAULT");
  const database = new DatabaseSync(databasePath, {
    allowExtension: false,
    enableForeignKeyConstraints: true,
    enableDoubleQuotedStringLiterals: false,
    timeout: busyTimeoutMs,
    allowBareNamedParameters: false,
    allowUnknownNamedParameters: false,
  });
  let closed = false;
  const ensureOpen = () => {
    if (closed) throw new Error("REWARD_WATERFALL_AUDIT_CLOSED");
  };
  const fault = (point) => {
    const hardExitPoint = point === REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.AFTER_RECEIPT_INSERT
      ? REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.HARD_EXIT_AFTER_RECEIPT_INSERT
      : point === REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.AFTER_DURABLE_COMMIT
        ? REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.HARD_EXIT_AFTER_DURABLE_COMMIT
        : null;
    if (hardExitPoint !== null && testOnlyFault === hardExitPoint) process.exit(86);
    if (testOnlyFault === point) throw new Error(`TEST_ONLY_REWARD_WATERFALL_AUDIT_FAULT_${point}`);
  };
  try {
    configure(database, busyTimeoutMs);
    if (schemaRows(database).length === 0) initialize(database);
    validateDatabase(database);
  } catch (error) {
    database.close();
    throw error;
  }

  const adapter = {
    schema: REWARD_WATERFALL_AUDIT_SQLITE_SCHEMA,
    status: REWARD_WATERFALL_AUDIT_SQLITE_STATUS,
    runtimeAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_WATERFALL_AUDIT_SQLITE_MAINNET_STATUS,
    appendFinalizedRound(input) {
      ensureOpen();
      const checked = requireInput(input);
      const { validated } = checked;
      const roundKey = validated.batch.fundingRoundAtUnixSeconds.toString();
      const roundBlob = encodeRewardCasTypedValue(checked.input.roundState);
      const revealBlob = encodeRewardCasTypedValue(checked.input.cccRandomnessReveal);
      const batchBlob = Buffer.from(checked.input.bundle.batchBytes);
      const roundSha256 = rewardCasStateSha256(checked.input.roundState);
      const batchSha256 = allocatorTranscriptSha256(batchBlob);
      const bundleSha256 = rewardAllocatorProofBundleSha256(checked.input.bundle);
      let open = false;
      try {
        database.exec("BEGIN IMMEDIATE");
        open = true;
        validateDatabase(database, { insideTransaction: true });
        database.prepare(`INSERT INTO ${ROUND_TABLE} (
          funding_round_at_unix_seconds, finalized_round_sha256, batch_sha256,
          proof_bundle_sha256, receipt_count, finalized_round_blob, ccc_reveal_blob,
          batch_blob, status, runtime_authentication_verified, rollback_protection_verified,
          activation_ready, mainnet_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'HOLD')`).run(
          roundKey, roundSha256, batchSha256, bundleSha256, checked.input.bundle.receiptBytes.length,
          roundBlob, revealBlob, batchBlob, REWARD_WATERFALL_AUDIT_SQLITE_STATUS,
        );
        fault(REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.AFTER_ROUND_INSERT);
        const insertReceipt = database.prepare(`INSERT INTO ${RECEIPT_TABLE} (
          funding_round_at_unix_seconds, allocation_index, receipt_sha256, receipt_blob,
          status, runtime_authentication_verified, rollback_protection_verified,
          activation_ready, mainnet_status
        ) VALUES (?, ?, ?, ?, ?, 0, 0, 0, 'HOLD')`);
        checked.input.bundle.receiptBytes.forEach((receiptBytes, allocationIndex) => {
          const bytes = Buffer.from(receiptBytes);
          insertReceipt.run(roundKey, allocationIndex, allocatorTranscriptSha256(bytes), bytes,
            REWARD_WATERFALL_AUDIT_SQLITE_STATUS);
          if (allocationIndex === 0) fault(REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.AFTER_RECEIPT_INSERT);
        });
        fault(REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.BEFORE_COMMIT);
        validateDatabase(database, { insideTransaction: true });
        database.exec("COMMIT");
        open = false;
        fault(REWARD_WATERFALL_AUDIT_SQLITE_TEST_FAULT.AFTER_DURABLE_COMMIT);
      } catch (error) {
        if (open) {
          try { database.exec("ROLLBACK"); } catch { /* preserve original failure */ }
        }
        throw error;
      }
      return Object.freeze({
        fundingRoundAtUnixSeconds: validated.batch.fundingRoundAtUnixSeconds,
        finalizedRoundSha256: roundSha256,
        batchSha256,
        proofBundleSha256: bundleSha256,
        receiptCount: checked.input.bundle.receiptBytes.length,
        durableLocalReplayAuditVerified: true,
        runtimeAuthenticationVerified: false,
        rollbackProtectionVerified: false,
        activationReady: false,
        mainnetStatus: REWARD_WATERFALL_AUDIT_SQLITE_MAINNET_STATUS,
      });
    },
    count() {
      ensureOpen();
      return validateDatabase(database);
    },
    close() {
      if (!closed) {
        database.close();
        closed = true;
      }
    },
  };
  return Object.freeze(adapter);
}

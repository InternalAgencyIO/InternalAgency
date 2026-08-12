import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  lstatSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export const PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA =
  "iat-b3-privacy-vault-journal-cas-sqlite/v1";
export const PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA_VERSION = 1;
export const PRIVACY_VAULT_JOURNAL_CAS_SQLITE_STATUS =
  "HOST_ONLY_LOCAL_SQLITE_VERIFIED_TRANSITION_CAS";
export const PRIVACY_VAULT_JOURNAL_CAS_SQLITE_MAINNET_STATUS = "HOLD";
export const PRIVACY_VAULT_JOURNAL_CAS_VERIFIER_RESPONSE_BYTES = 730;

export const PRIVACY_VAULT_JOURNAL_CAS_DISPOSITION = Object.freeze({
  COMMITTED: "COMMITTED",
  RECONCILED_EXACT_REPLAY: "RECONCILED_EXACT_REPLAY",
});

export const PRIVACY_VAULT_JOURNAL_CAS_TEST_FAULT = Object.freeze({
  AFTER_INSERT_BEFORE_STAGED_READBACK: "AFTER_INSERT_BEFORE_STAGED_READBACK",
  AFTER_COMMIT_BEFORE_RETURN: "AFTER_COMMIT_BEFORE_RETURN",
});

const TRANSITION_FRAME_BYTES = 650;
const VERIFIER_RESPONSE_MAGIC = Buffer.from("IATB3JVR", "ascii");
const VERIFIER_RESPONSE_PAYLOAD_BYTES = TRANSITION_FRAME_BYTES + 64;
const VERIFIER_FRAME_OFFSET = 16;
const VERIFIER_BEFORE_DIGEST_OFFSET = VERIFIER_FRAME_OFFSET + TRANSITION_FRAME_BYTES;
const VERIFIER_AFTER_DIGEST_OFFSET = VERIFIER_BEFORE_DIGEST_OFFSET + 32;
const VERIFIER_MAX_BUFFER_BYTES = 4_096;
const MAX_BOUND_EXECUTABLE_BYTES = 64 * 1024 * 1024;
const ZERO_SHA256 = "0".repeat(64);
const U64_MAX = (1n << 64n) - 1n;
const ADAPTERS = new WeakSet();

const CREATE_KEYS = Object.freeze([
  "databasePath",
  "expectedGenesisJournalDigest",
  "verifierLaunch",
]);
const VERIFIER_LAUNCH_KEYS = Object.freeze([
  "argv",
  "environment",
  "executablePath",
  "executableSha256",
  "timeoutMs",
  "verifierArtifactLaunchArgument",
  "verifierArtifactPath",
  "verifierArtifactSha256",
  "workingDirectory",
]);
const COMMIT_KEYS = Object.freeze([
  "expectedHeadDigest",
  "expectedRevision",
  "testFault",
  "transitionFrame",
]);

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Domain(domain, parts) {
  const hash = createHash("sha256");
  hash.update(domain, "ascii");
  hash.update(Buffer.from([0]));
  for (const part of parts) hash.update(part);
  return hash.digest("hex");
}

function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function exactDataValues(candidate, expectedKeys, message) {
  if (!isPlainRecord(candidate)) throw new TypeError(message);
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(candidate);
    descriptors = Object.getOwnPropertyDescriptors(candidate);
  } catch {
    throw new TypeError(message);
  }
  if (keys.some((key) => typeof key !== "string")
    || keys.length !== expectedKeys.length
    || [...keys].sort().some((key, index) => key !== [...expectedKeys].sort()[index])) {
    throw new TypeError(message);
  }
  const values = Object.create(null);
  for (const key of expectedKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !("value" in descriptor)) throw new TypeError(message);
    values[key] = descriptor.value;
  }
  return values;
}

function asDigest(value, label, { allowZero = false } = {}) {
  if (typeof value !== "string"
    || !/^[0-9a-f]{64}$/.test(value)
    || (!allowZero && value === ZERO_SHA256)) {
    throw new TypeError(`${label} must be a canonical nonzero SHA-256 digest`);
  }
  return value;
}

function asU64(value, label) {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]{0,19})$/.test(value)) {
    throw new TypeError(`${label} must be canonical unsigned decimal text`);
  }
  const parsed = BigInt(value);
  if (parsed > U64_MAX || parsed.toString() !== value) {
    throw new TypeError(`${label} exceeds canonical u64 range`);
  }
  return parsed;
}

function u64Be(value) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(value);
  return bytes;
}

function detachedFrame(value) {
  let frame;
  try {
    if (Buffer.isBuffer(value)) {
      frame = Buffer.from(value);
    } else if (value instanceof Uint8Array
      && Object.getPrototypeOf(value) === Uint8Array.prototype) {
      frame = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
      frame = Buffer.from(frame);
    } else {
      throw new TypeError("transitionFrame must be a Buffer or exact Uint8Array");
    }
  } catch {
    throw new TypeError("transitionFrame must be a Buffer or exact Uint8Array");
  }
  if (frame.length !== TRANSITION_FRAME_BYTES) {
    throw new TypeError("transitionFrame must be exactly 650 bytes");
  }
  return frame;
}

function normalizedRealPath(value) {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function fileFingerprint(candidatePath, expectedSha256, label) {
  if (typeof candidatePath !== "string"
    || candidatePath.length === 0
    || candidatePath.includes("\0")
    || !path.isAbsolute(candidatePath)) {
    throw new TypeError(`${label} path must be exact and absolute`);
  }
  asDigest(expectedSha256, `${label} sha256`);
  const stated = lstatSync(candidatePath, { bigint: true });
  if (!stated.isFile()
    || stated.isSymbolicLink()
    || stated.size === 0n
    || stated.size > BigInt(MAX_BOUND_EXECUTABLE_BYTES)) {
    throw new Error(`${label} must be a regular non-symlink file`);
  }
  const real = realpathSync.native(candidatePath);
  if (normalizedRealPath(real) !== normalizedRealPath(candidatePath)) {
    throw new Error(`${label} path must contain no symlink or alias component`);
  }
  const bytes = readFileSync(real);
  if (sha256Bytes(bytes) !== expectedSha256) {
    throw new Error(`${label} SHA-256 mismatch`);
  }
  const afterRead = statSync(real, { bigint: true });
  if (!afterRead.isFile()
    || afterRead.dev !== stated.dev
    || afterRead.ino !== stated.ino
    || afterRead.size !== stated.size
    || afterRead.mtimeNs !== stated.mtimeNs
    || afterRead.ctimeNs !== stated.ctimeNs) {
    throw new Error(`${label} changed while being bound`);
  }
  return Object.freeze({
    path: real,
    sha256: expectedSha256,
    dev: stated.dev.toString(),
    ino: stated.ino.toString(),
    size: stated.size.toString(),
    mtimeNs: stated.mtimeNs.toString(),
    ctimeNs: stated.ctimeNs.toString(),
  });
}

function directoryFingerprint(candidatePath, label) {
  if (typeof candidatePath !== "string"
    || candidatePath.length === 0
    || candidatePath.includes("\0")
    || !path.isAbsolute(candidatePath)) {
    throw new TypeError(`${label} path must be exact and absolute`);
  }
  const stated = lstatSync(candidatePath, { bigint: true });
  if (!stated.isDirectory() || stated.isSymbolicLink()) {
    throw new Error(`${label} must be a non-symlink directory`);
  }
  const real = realpathSync.native(candidatePath);
  if (normalizedRealPath(real) !== normalizedRealPath(candidatePath)) {
    throw new Error(`${label} path must contain no symlink or alias component`);
  }
  return Object.freeze({
    path: real,
    dev: stated.dev.toString(),
    ino: stated.ino.toString(),
  });
}

function exactEnvironment(candidate) {
  if (!isPlainRecord(candidate)) {
    throw new TypeError("verifierLaunch.environment must be an exact data object");
  }
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(candidate);
    descriptors = Object.getOwnPropertyDescriptors(candidate);
  } catch {
    throw new TypeError("verifierLaunch.environment must be an exact data object");
  }
  if (keys.some((key) => typeof key !== "string") || keys.length > 64) {
    throw new TypeError("verifierLaunch.environment keys are invalid");
  }
  const lowered = new Set();
  const environment = Object.create(null);
  for (const key of [...keys].sort()) {
    const descriptor = descriptors[key];
    const folded = process.platform === "win32" ? key.toLowerCase() : key;
    if (!descriptor
      || !("value" in descriptor)
      || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
      || lowered.has(folded)
      || typeof descriptor.value !== "string"
      || descriptor.value.includes("\0")
      || descriptor.value.length > 8_192) {
      throw new TypeError("verifierLaunch.environment entry is invalid");
    }
    lowered.add(folded);
    environment[key] = descriptor.value;
  }
  return Object.freeze(environment);
}

function exactArgv(candidate) {
  if (!Array.isArray(candidate)) {
    throw new TypeError("verifierLaunch.argv must be an exact bounded string array");
  }
  let keys;
  let descriptors;
  try {
    keys = Reflect.ownKeys(candidate);
    descriptors = Object.getOwnPropertyDescriptors(candidate);
  } catch {
    throw new TypeError("verifierLaunch.argv must be an exact bounded string array");
  }
  const lengthDescriptor = descriptors.length;
  const length = lengthDescriptor && "value" in lengthDescriptor
    ? lengthDescriptor.value
    : -1;
  if (!Number.isSafeInteger(length) || length < 0 || length > 32) {
    throw new TypeError("verifierLaunch.argv must be an exact bounded string array");
  }
  const expectedKeys = [
    ...Array.from({ length }, (_, index) => String(index)),
    "length",
  ];
  if (keys.some((key) => typeof key !== "string")
    || keys.length !== expectedKeys.length
    || [...keys].sort().some((key, index) => key !== [...expectedKeys].sort()[index])) {
    throw new TypeError("verifierLaunch.argv must be an exact bounded string array");
  }
  const argv = [];
  for (let index = 0; index < length; index += 1) {
    const descriptor = descriptors[String(index)];
    if (!descriptor
      || !("value" in descriptor)
      || typeof descriptor.value !== "string"
      || descriptor.value.includes("\0")
      || descriptor.value.length > 4_096) {
      throw new TypeError("verifierLaunch.argv must be an exact bounded string array");
    }
    argv.push(descriptor.value);
  }
  return Object.freeze(argv);
}

function validateVerifierLaunch(candidate) {
  const input = exactDataValues(
    candidate,
    VERIFIER_LAUNCH_KEYS,
    "verifierLaunch must have the exact canonical shape",
  );
  const argv = exactArgv(input.argv);
  if (!Number.isSafeInteger(input.timeoutMs)
    || input.timeoutMs < 100
    || input.timeoutMs > 30_000) {
    throw new TypeError("verifierLaunch.timeoutMs must be between 100 and 30000");
  }
  const executable = fileFingerprint(
    input.executablePath,
    input.executableSha256,
    "verifier launch executable",
  );
  const artifact = fileFingerprint(
    input.verifierArtifactPath,
    input.verifierArtifactSha256,
    "Rust verifier artifact",
  );
  const workingDirectory = directoryFingerprint(
    input.workingDirectory,
    "verifier working directory",
  );
  const environment = exactEnvironment(input.environment);
  if (input.verifierArtifactLaunchArgument === null) {
    if (normalizedRealPath(executable.path) !== normalizedRealPath(artifact.path)) {
      throw new TypeError(
        "verifierArtifactLaunchArgument may be null only for direct artifact execution",
      );
    }
  } else if (typeof input.verifierArtifactLaunchArgument !== "string"
    || input.verifierArtifactLaunchArgument.length === 0
    || input.verifierArtifactLaunchArgument.includes("\0")
    || argv.filter((argument) => argument === input.verifierArtifactLaunchArgument).length !== 1) {
    throw new TypeError(
      "verifierArtifactLaunchArgument must bind exactly one argv entry",
    );
  }
  const bindingCore = {
    protocol: "iat-b3-privacy-vault-journal-verifier-launch/v1",
    executable,
    artifact,
    argv,
    verifierArtifactLaunchArgument: input.verifierArtifactLaunchArgument,
    workingDirectory,
    environment: Object.entries(environment),
    timeoutMs: input.timeoutMs,
    inputBytes: TRANSITION_FRAME_BYTES,
    outputBytes: PRIVACY_VAULT_JOURNAL_CAS_VERIFIER_RESPONSE_BYTES,
    maxBufferBytes: VERIFIER_MAX_BUFFER_BYTES,
    maxBoundExecutableBytes: MAX_BOUND_EXECUTABLE_BYTES,
    shell: false,
  };
  return Object.freeze({
    ...bindingCore,
    launchBindingSha256: sha256Domain(
      "iat-b3-privacy-vault-journal-verifier-launch/v1",
      [Buffer.from(JSON.stringify(bindingCore), "utf8")],
    ),
  });
}

function assertBoundFileUnchanged(expected, label) {
  const current = fileFingerprint(expected.path, expected.sha256, label);
  if (current.dev !== expected.dev
    || current.ino !== expected.ino
    || current.size !== expected.size
    || current.mtimeNs !== expected.mtimeNs
    || current.ctimeNs !== expected.ctimeNs) {
    throw new Error(`${label} identity changed after binding`);
  }
}

function assertBoundDirectoryUnchanged(expected, label) {
  const current = directoryFingerprint(expected.path, label);
  if (current.dev !== expected.dev || current.ino !== expected.ino) {
    throw new Error(`${label} identity changed after binding`);
  }
}

function invokeVerifier(launch, frame) {
  assertBoundFileUnchanged(launch.executable, "verifier launch executable");
  assertBoundFileUnchanged(launch.artifact, "Rust verifier artifact");
  assertBoundDirectoryUnchanged(launch.workingDirectory, "verifier working directory");

  const result = spawnSync(launch.executable.path, launch.argv, {
    cwd: launch.workingDirectory.path,
    env: launch.environment,
    input: frame,
    encoding: null,
    shell: false,
    windowsHide: true,
    timeout: launch.timeoutMs,
    maxBuffer: VERIFIER_MAX_BUFFER_BYTES,
  });

  assertBoundFileUnchanged(launch.executable, "verifier launch executable");
  assertBoundFileUnchanged(launch.artifact, "Rust verifier artifact");
  assertBoundDirectoryUnchanged(launch.workingDirectory, "verifier working directory");

  if (result.error
    || result.signal !== null
    || result.status !== 0
    || !Buffer.isBuffer(result.stdout)
    || !Buffer.isBuffer(result.stderr)
    || result.stderr.length !== 0
    || result.stdout.length !== PRIVACY_VAULT_JOURNAL_CAS_VERIFIER_RESPONSE_BYTES) {
    throw new Error("PRIVACY_VAULT_JOURNAL_CAS_VERIFIER_REJECTED");
  }
  const response = result.stdout;
  if (!response.subarray(0, 8).equals(VERIFIER_RESPONSE_MAGIC)
    || response[8] !== 1
    || response[9] !== 1
    || response[10] !== 0
    || response[11] !== 0
    || response.readUInt32BE(12) !== VERIFIER_RESPONSE_PAYLOAD_BYTES
    || !response.subarray(
      VERIFIER_FRAME_OFFSET,
      VERIFIER_BEFORE_DIGEST_OFFSET,
    ).equals(frame)) {
    throw new Error("PRIVACY_VAULT_JOURNAL_CAS_VERIFIER_RESPONSE_MISMATCH");
  }
  return Object.freeze({
    beforeJournalDigest: response.subarray(
      VERIFIER_BEFORE_DIGEST_OFFSET,
      VERIFIER_AFTER_DIGEST_OFFSET,
    ).toString("hex"),
    afterJournalDigest: response.subarray(VERIFIER_AFTER_DIGEST_OFFSET).toString("hex"),
  });
}

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
  privacy_vault_journal_cas_meta: `CREATE TABLE privacy_vault_journal_cas_meta (
    singleton_id INTEGER PRIMARY KEY CHECK (singleton_id = 1),
    adapter_schema TEXT NOT NULL CHECK (adapter_schema = '${PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA}'),
    schema_version INTEGER NOT NULL CHECK (schema_version = ${PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA_VERSION}),
    schema_manifest_sha256 TEXT NOT NULL CHECK (${hexCheck("schema_manifest_sha256")}),
    expected_genesis_journal_digest TEXT NOT NULL CHECK (${hexCheck("expected_genesis_journal_digest")}),
    verifier_launch_binding_sha256 TEXT NOT NULL CHECK (${hexCheck("verifier_launch_binding_sha256")}),
    local_transition_cas_atomicity_verified INTEGER NOT NULL CHECK (local_transition_cas_atomicity_verified = 1),
    durable_local_sqlite_reopen_verified INTEGER NOT NULL CHECK (durable_local_sqlite_reopen_verified = 1),
    configured_verifier_replay_required INTEGER NOT NULL CHECK (configured_verifier_replay_required = 1),
    verifier_identity_authenticated INTEGER NOT NULL CHECK (verifier_identity_authenticated = 0),
    verifier_launch_environment_authenticated INTEGER NOT NULL CHECK (verifier_launch_environment_authenticated = 0),
    verifier_path_race_confinement_verified INTEGER NOT NULL CHECK (verifier_path_race_confinement_verified = 0),
    verifier_artifact_path_mapping_authenticated INTEGER NOT NULL CHECK (verifier_artifact_path_mapping_authenticated = 0),
    external_writer_confinement_verified INTEGER NOT NULL CHECK (external_writer_confinement_verified = 0),
    external_rollback_protection_verified INTEGER NOT NULL CHECK (external_rollback_protection_verified = 0),
    authenticated_chain_observation_verified INTEGER NOT NULL CHECK (authenticated_chain_observation_verified = 0),
    provider_authentication_verified INTEGER NOT NULL CHECK (provider_authentication_verified = 0),
    runtime_integration_verified INTEGER NOT NULL CHECK (runtime_integration_verified = 0),
    privacy_legal_review_accepted INTEGER NOT NULL CHECK (privacy_legal_review_accepted = 0),
    devnet_lifecycle_verified INTEGER NOT NULL CHECK (devnet_lifecycle_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${PRIVACY_VAULT_JOURNAL_CAS_SQLITE_MAINNET_STATUS}')
  ) STRICT, WITHOUT ROWID`,
  privacy_vault_journal_cas_transitions: `CREATE TABLE privacy_vault_journal_cas_transitions (
    revision_be BLOB PRIMARY KEY CHECK (typeof(revision_be) = 'blob' AND length(revision_be) = 8),
    revision_text TEXT NOT NULL UNIQUE CHECK (${positiveDecimalCheck("revision_text")}),
    before_journal_digest TEXT NOT NULL CHECK (${hexCheck("before_journal_digest")}),
    after_journal_digest TEXT NOT NULL UNIQUE CHECK (${hexCheck("after_journal_digest")}),
    transition_frame BLOB NOT NULL CHECK (typeof(transition_frame) = 'blob' AND length(transition_frame) = ${TRANSITION_FRAME_BYTES}),
    transition_frame_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("transition_frame_sha256")}),
    previous_transition_frame_sha256 TEXT NOT NULL CHECK (${hexCheck("previous_transition_frame_sha256")}),
    verifier_launch_binding_sha256 TEXT NOT NULL CHECK (${hexCheck("verifier_launch_binding_sha256")}),
    record_sha256 TEXT NOT NULL UNIQUE CHECK (${hexCheck("record_sha256")}),
    configured_verifier_replay_accepted INTEGER NOT NULL CHECK (configured_verifier_replay_accepted = 1),
    local_transition_cas_atomicity_verified INTEGER NOT NULL CHECK (local_transition_cas_atomicity_verified = 1),
    verifier_identity_authenticated INTEGER NOT NULL CHECK (verifier_identity_authenticated = 0),
    verifier_launch_environment_authenticated INTEGER NOT NULL CHECK (verifier_launch_environment_authenticated = 0),
    verifier_path_race_confinement_verified INTEGER NOT NULL CHECK (verifier_path_race_confinement_verified = 0),
    verifier_artifact_path_mapping_authenticated INTEGER NOT NULL CHECK (verifier_artifact_path_mapping_authenticated = 0),
    external_writer_confinement_verified INTEGER NOT NULL CHECK (external_writer_confinement_verified = 0),
    external_rollback_protection_verified INTEGER NOT NULL CHECK (external_rollback_protection_verified = 0),
    authenticated_chain_observation_verified INTEGER NOT NULL CHECK (authenticated_chain_observation_verified = 0),
    provider_authentication_verified INTEGER NOT NULL CHECK (provider_authentication_verified = 0),
    runtime_integration_verified INTEGER NOT NULL CHECK (runtime_integration_verified = 0),
    privacy_legal_review_accepted INTEGER NOT NULL CHECK (privacy_legal_review_accepted = 0),
    devnet_lifecycle_verified INTEGER NOT NULL CHECK (devnet_lifecycle_verified = 0),
    activation_ready INTEGER NOT NULL CHECK (activation_ready = 0),
    mainnet_status TEXT NOT NULL CHECK (mainnet_status = '${PRIVACY_VAULT_JOURNAL_CAS_SQLITE_MAINNET_STATUS}')
  ) STRICT, WITHOUT ROWID`,
});

function immutableTriggerSql(table, operation) {
  return `CREATE TRIGGER ${table}_forbid_${operation.toLowerCase()}
    BEFORE ${operation} ON ${table}
    BEGIN
      SELECT RAISE(ABORT, 'PRIVACY_VAULT_JOURNAL_CAS_APPEND_ONLY_${operation}_FORBIDDEN');
    END`;
}

const TRIGGER_SQL = Object.freeze({
  privacy_vault_journal_cas_meta_forbid_update:
    immutableTriggerSql("privacy_vault_journal_cas_meta", "UPDATE"),
  privacy_vault_journal_cas_meta_forbid_delete:
    immutableTriggerSql("privacy_vault_journal_cas_meta", "DELETE"),
  privacy_vault_journal_cas_transitions_forbid_update:
    immutableTriggerSql("privacy_vault_journal_cas_transitions", "UPDATE"),
  privacy_vault_journal_cas_transitions_forbid_delete:
    immutableTriggerSql("privacy_vault_journal_cas_transitions", "DELETE"),
});

function normalizeSql(sql) {
  return String(sql).replace(/\s+/g, " ").trim();
}

const SCHEMA_OBJECTS = Object.freeze([
  ...Object.entries(TABLE_SQL).map(([name, sql]) => ({ type: "table", name, sql })),
  ...Object.entries(TRIGGER_SQL).map(([name, sql]) => ({ type: "trigger", name, sql })),
]);
export const PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA_MANIFEST_SHA256 = sha256Domain(
  "iat-b3-privacy-vault-journal-cas-sqlite-schema/v1",
  SCHEMA_OBJECTS
    .map(({ type, name, sql }) => `${type}\0${name}\0${normalizeSql(sql)}\n`)
    .sort()
    .map((value) => Buffer.from(value, "utf8")),
);

function falseTruthBoundary() {
  return {
    verifierIdentityAuthenticated: false,
    verifierLaunchEnvironmentAuthenticated: false,
    verifierPathRaceConfinementVerified: false,
    verifierArtifactPathMappingAuthenticated: false,
    externalWriterConfinementVerified: false,
    externalRollbackProtectionVerified: false,
    authenticatedChainObservationVerified: false,
    providerAuthenticationVerified: false,
    runtimeIntegrationVerified: false,
    privacyLegalReviewAccepted: false,
    devnetLifecycleVerified: false,
    activationReady: false,
    mainnetStatus: PRIVACY_VAULT_JOURNAL_CAS_SQLITE_MAINNET_STATUS,
  };
}

function configureDatabase(database) {
  if (typeof database.enableDefensive !== "function") {
    throw new Error("PRIVACY_VAULT_JOURNAL_CAS_NODE24_DEFENSIVE_MODE_REQUIRED");
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
    throw new Error("PRIVACY_VAULT_JOURNAL_CAS_SQLITE_PRAGMA_HOLD");
  }
}

function rollbackWithoutMasking(database) {
  try {
    database.exec("ROLLBACK");
  } catch {
    // Preserve the primary validation/storage failure if SQLite already ended it.
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
    throw new Error("PRIVACY_VAULT_JOURNAL_CAS_SCHEMA_OBJECT_SET_MISMATCH");
  }
  for (let index = 0; index < expected.length; index += 1) {
    if (actual[index].type !== expected[index].type
      || actual[index].name !== expected[index].name
      || normalizeSql(actual[index].sql) !== normalizeSql(expected[index].sql)) {
      throw new Error("PRIVACY_VAULT_JOURNAL_CAS_SCHEMA_OBJECT_MISMATCH");
    }
  }
}

function assertIntegrity(database) {
  const integrity = database.prepare("PRAGMA integrity_check").all();
  if (integrity.length !== 1
    || String(Object.values(integrity[0])[0]).toLowerCase() !== "ok") {
    throw new Error("PRIVACY_VAULT_JOURNAL_CAS_INTEGRITY_CHECK_FAILED");
  }
  if (database.prepare("PRAGMA foreign_key_check").all().length !== 0) {
    throw new Error("PRIVACY_VAULT_JOURNAL_CAS_FOREIGN_KEY_CHECK_FAILED");
  }
}

function readU64Be(value, text, label) {
  const bytes = Buffer.from(value);
  const parsed = asU64(text, `${label}.text`);
  if (bytes.length !== 8 || bytes.readBigUInt64BE() !== parsed || parsed === 0n) {
    throw new Error(`${label} canonical big-endian mismatch`);
  }
  return parsed;
}

function recordDigest(record) {
  return sha256Domain("iat-b3-privacy-vault-journal-cas-record/v1", [
    u64Be(BigInt(record.revision)),
    Buffer.from(record.beforeJournalDigest, "hex"),
    Buffer.from(record.afterJournalDigest, "hex"),
    Buffer.from(record.transitionFrameSha256, "hex"),
    Buffer.from(record.previousTransitionFrameSha256, "hex"),
    Buffer.from(record.verifierLaunchBindingSha256, "hex"),
  ]);
}

function decodeMeta(row, expectedGenesisDigest, verifierLaunchBindingSha256) {
  if (!row
    || row.singleton_id !== 1
    || row.adapter_schema !== PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA
    || row.schema_version !== PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA_VERSION
    || row.schema_manifest_sha256 !== PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA_MANIFEST_SHA256
    || row.expected_genesis_journal_digest !== expectedGenesisDigest
    || row.verifier_launch_binding_sha256 !== verifierLaunchBindingSha256
    || row.local_transition_cas_atomicity_verified !== 1
    || row.durable_local_sqlite_reopen_verified !== 1
    || row.configured_verifier_replay_required !== 1
    || row.verifier_identity_authenticated !== 0
    || row.verifier_launch_environment_authenticated !== 0
    || row.verifier_path_race_confinement_verified !== 0
    || row.verifier_artifact_path_mapping_authenticated !== 0
    || row.external_writer_confinement_verified !== 0
    || row.external_rollback_protection_verified !== 0
    || row.authenticated_chain_observation_verified !== 0
    || row.provider_authentication_verified !== 0
    || row.runtime_integration_verified !== 0
    || row.privacy_legal_review_accepted !== 0
    || row.devnet_lifecycle_verified !== 0
    || row.activation_ready !== 0
    || row.mainnet_status !== PRIVACY_VAULT_JOURNAL_CAS_SQLITE_MAINNET_STATUS) {
    throw new Error("PRIVACY_VAULT_JOURNAL_CAS_META_MISMATCH");
  }
}

function loadSnapshot(database, expectedGenesisDigest, launch) {
  validateSchema(database);
  assertIntegrity(database);
  const meta = database.prepare("SELECT * FROM privacy_vault_journal_cas_meta").get();
  decodeMeta(meta, expectedGenesisDigest, launch.launchBindingSha256);
  const rows = database.prepare(`
    SELECT * FROM privacy_vault_journal_cas_transitions
    ORDER BY revision_be
  `).all();
  const records = [];
  let expectedRevision = 1n;
  let headDigest = expectedGenesisDigest;
  let previousFrameSha256 = ZERO_SHA256;
  for (const row of rows) {
    const revision = readU64Be(row.revision_be, row.revision_text, "transition.revision");
    if (revision !== expectedRevision) {
      throw new Error("PRIVACY_VAULT_JOURNAL_CAS_REVISION_GAP_OR_REORDER");
    }
    const frame = detachedFrame(row.transition_frame);
    const beforeJournalDigest = asDigest(row.before_journal_digest, "stored before digest");
    const afterJournalDigest = asDigest(row.after_journal_digest, "stored after digest");
    const transitionFrameSha256 = asDigest(
      row.transition_frame_sha256,
      "stored frame digest",
    );
    const storedPrevious = asDigest(
      row.previous_transition_frame_sha256,
      "stored previous frame digest",
      { allowZero: revision === 1n },
    );
    const verifierBinding = asDigest(
      row.verifier_launch_binding_sha256,
      "stored verifier launch binding",
    );
    const storedRecordDigest = asDigest(row.record_sha256, "stored record digest");
    if (sha256Bytes(frame) !== transitionFrameSha256
      || beforeJournalDigest !== headDigest
      || storedPrevious !== previousFrameSha256
      || verifierBinding !== launch.launchBindingSha256
      || row.configured_verifier_replay_accepted !== 1
      || row.local_transition_cas_atomicity_verified !== 1
      || row.verifier_identity_authenticated !== 0
      || row.verifier_launch_environment_authenticated !== 0
      || row.verifier_path_race_confinement_verified !== 0
      || row.verifier_artifact_path_mapping_authenticated !== 0
      || row.external_writer_confinement_verified !== 0
      || row.external_rollback_protection_verified !== 0
      || row.authenticated_chain_observation_verified !== 0
      || row.provider_authentication_verified !== 0
      || row.runtime_integration_verified !== 0
      || row.privacy_legal_review_accepted !== 0
      || row.devnet_lifecycle_verified !== 0
      || row.activation_ready !== 0
      || row.mainnet_status !== PRIVACY_VAULT_JOURNAL_CAS_SQLITE_MAINNET_STATUS) {
      throw new Error("PRIVACY_VAULT_JOURNAL_CAS_STORED_RECORD_MISMATCH");
    }
    const verified = invokeVerifier(launch, frame);
    if (verified.beforeJournalDigest !== beforeJournalDigest
      || verified.afterJournalDigest !== afterJournalDigest) {
      throw new Error("PRIVACY_VAULT_JOURNAL_CAS_STORED_VERIFIER_MISMATCH");
    }
    const record = {
      revision: revision.toString(),
      beforeJournalDigest,
      afterJournalDigest,
      transitionFrameSha256,
      previousTransitionFrameSha256: storedPrevious,
      verifierLaunchBindingSha256: verifierBinding,
      recordSha256: storedRecordDigest,
      configuredVerifierReplayAccepted: true,
      localTransitionCasAtomicityVerified: true,
      ...falseTruthBoundary(),
    };
    if (recordDigest(record) !== storedRecordDigest) {
      throw new Error("PRIVACY_VAULT_JOURNAL_CAS_RECORD_DIGEST_MISMATCH");
    }
    records.push(Object.freeze(record));
    headDigest = afterJournalDigest;
    previousFrameSha256 = transitionFrameSha256;
    expectedRevision += 1n;
  }
  return Object.freeze({
    schema: PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA,
    status: PRIVACY_VAULT_JOURNAL_CAS_SQLITE_STATUS,
    schemaVersion: PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA_VERSION,
    schemaManifestSha256: PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA_MANIFEST_SHA256,
    expectedGenesisJournalDigest: expectedGenesisDigest,
    verifierLaunchBindingSha256: launch.launchBindingSha256,
    currentRevision: BigInt(records.length).toString(),
    currentHeadDigest: headDigest,
    records: Object.freeze(records),
    localTransitionCasAtomicityVerified: true,
    durableLocalSqliteReopenVerified: true,
    configuredVerifierReplayRequired: true,
    ...falseTruthBoundary(),
  });
}

function transactionalSnapshot(database, expectedGenesisDigest, launch) {
  database.exec("BEGIN");
  try {
    const snapshot = loadSnapshot(database, expectedGenesisDigest, launch);
    database.exec("COMMIT");
    return snapshot;
  } catch (error) {
    rollbackWithoutMasking(database);
    throw error;
  }
}

function initializeSchema(database, expectedGenesisDigest, launch) {
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const sql of Object.values(TABLE_SQL)) database.exec(sql);
    for (const sql of Object.values(TRIGGER_SQL)) database.exec(sql);
    database.prepare(`
      INSERT INTO privacy_vault_journal_cas_meta (
        singleton_id, adapter_schema, schema_version, schema_manifest_sha256,
        expected_genesis_journal_digest, verifier_launch_binding_sha256,
        local_transition_cas_atomicity_verified,
        durable_local_sqlite_reopen_verified,
        configured_verifier_replay_required,
        verifier_identity_authenticated,
        verifier_launch_environment_authenticated,
        verifier_path_race_confinement_verified,
        verifier_artifact_path_mapping_authenticated,
        external_writer_confinement_verified,
        external_rollback_protection_verified,
        authenticated_chain_observation_verified,
        provider_authentication_verified,
        runtime_integration_verified,
        privacy_legal_review_accepted,
        devnet_lifecycle_verified,
        activation_ready,
        mainnet_status
      ) VALUES (
        1, ?, ?, ?, ?, ?,
        1, 1, 1,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ?
      )
    `).run(
      PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA,
      PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA_VERSION,
      PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA_MANIFEST_SHA256,
      expectedGenesisDigest,
      launch.launchBindingSha256,
      PRIVACY_VAULT_JOURNAL_CAS_SQLITE_MAINNET_STATUS,
    );
    loadSnapshot(database, expectedGenesisDigest, launch);
    database.exec("COMMIT");
  } catch (error) {
    rollbackWithoutMasking(database);
    throw error;
  }
}

function insertRecord(database, record, frame) {
  database.prepare(`
    INSERT INTO privacy_vault_journal_cas_transitions (
      revision_be, revision_text,
      before_journal_digest, after_journal_digest,
      transition_frame, transition_frame_sha256,
      previous_transition_frame_sha256,
      verifier_launch_binding_sha256, record_sha256,
      configured_verifier_replay_accepted,
      local_transition_cas_atomicity_verified,
      verifier_identity_authenticated,
      verifier_launch_environment_authenticated,
      verifier_path_race_confinement_verified,
      verifier_artifact_path_mapping_authenticated,
      external_writer_confinement_verified,
      external_rollback_protection_verified,
      authenticated_chain_observation_verified,
      provider_authentication_verified,
      runtime_integration_verified,
      privacy_legal_review_accepted,
      devnet_lifecycle_verified,
      activation_ready,
      mainnet_status
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?,
      1, 1,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ?
    )
  `).run(
    u64Be(BigInt(record.revision)),
    record.revision,
    record.beforeJournalDigest,
    record.afterJournalDigest,
    frame,
    record.transitionFrameSha256,
    record.previousTransitionFrameSha256,
    record.verifierLaunchBindingSha256,
    record.recordSha256,
    PRIVACY_VAULT_JOURNAL_CAS_SQLITE_MAINNET_STATUS,
  );
}

function assertDatabasePath(databasePath) {
  if (typeof databasePath !== "string"
    || databasePath.length === 0
    || databasePath.includes("\0")
    || !path.isAbsolute(databasePath)
    || databasePath === ":memory:") {
    throw new TypeError("journal CAS SQLite requires an absolute file-backed database path");
  }
  const parent = directoryFingerprint(path.dirname(databasePath), "journal CAS database parent");
  try {
    const stated = lstatSync(databasePath, { bigint: true });
    if (!stated.isFile() || stated.isSymbolicLink()) {
      throw new Error("journal CAS database must be a regular non-symlink file");
    }
    if (normalizedRealPath(realpathSync.native(databasePath)) !== normalizedRealPath(databasePath)) {
      throw new Error("journal CAS database path must contain no alias component");
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return parent;
}

export function assertPrivacyVaultJournalCasSqliteAdapter(value) {
  if (!ADAPTERS.has(value)) {
    throw new TypeError("privacy vault journal CAS SQLite adapter is not process-branded");
  }
  return value;
}

export function createPrivacyVaultJournalCasSqlite(candidate) {
  const input = exactDataValues(
    candidate,
    CREATE_KEYS,
    "privacy vault journal CAS SQLite input must have the exact canonical shape",
  );
  const expectedGenesisDigest = asDigest(
    input.expectedGenesisJournalDigest,
    "expectedGenesisJournalDigest",
  );
  const launch = validateVerifierLaunch(input.verifierLaunch);
  const databaseParent = assertDatabasePath(input.databasePath);
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
    assertDatabasePath(input.databasePath);
    configureDatabase(database);
    const exists = database.prepare(`
      SELECT 1 AS present FROM sqlite_schema
      WHERE type = 'table' AND name = 'privacy_vault_journal_cas_meta'
    `).get();
    if (!exists) initializeSchema(database, expectedGenesisDigest, launch);
    transactionalSnapshot(database, expectedGenesisDigest, launch);
    assertBoundDirectoryUnchanged(databaseParent, "journal CAS database parent");
  } catch (error) {
    database.close();
    throw error;
  }

  function requireOpen() {
    if (closed) throw new Error("PRIVACY_VAULT_JOURNAL_CAS_SQLITE_CLOSED");
  }

  const adapter = Object.freeze({
    schema: PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA,
    status: PRIVACY_VAULT_JOURNAL_CAS_SQLITE_STATUS,
    schemaVersion: PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA_VERSION,
    schemaManifestSha256: PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA_MANIFEST_SHA256,
    expectedGenesisJournalDigest: expectedGenesisDigest,
    verifierLaunchBindingSha256: launch.launchBindingSha256,
    localTransitionCasAtomicityVerified: true,
    durableLocalSqliteReopenVerified: true,
    configuredVerifierReplayRequired: true,
    ...falseTruthBoundary(),
    snapshot() {
      requireOpen();
      return transactionalSnapshot(database, expectedGenesisDigest, launch);
    },
    commitTransition(commitCandidate) {
      requireOpen();
      const values = exactDataValues(
        commitCandidate,
        COMMIT_KEYS,
        "privacy vault journal CAS commit input must have the exact canonical shape",
      );
      const frame = detachedFrame(values.transitionFrame);
      const expectedRevision = asU64(values.expectedRevision, "expectedRevision");
      const expectedHeadDigest = asDigest(values.expectedHeadDigest, "expectedHeadDigest");
      if (values.testFault !== null
        && !Object.values(PRIVACY_VAULT_JOURNAL_CAS_TEST_FAULT).includes(values.testFault)) {
        throw new TypeError("privacy vault journal CAS test fault is invalid");
      }
      const verified = invokeVerifier(launch, frame);
      const frameSha256 = sha256Bytes(frame);

      database.exec("BEGIN IMMEDIATE");
      let record;
      let disposition;
      try {
        const before = loadSnapshot(database, expectedGenesisDigest, launch);
        const currentRevision = BigInt(before.currentRevision);
        const currentHeadDigest = before.currentHeadDigest;
        const last = before.records.at(-1) ?? null;
        const storedLastFrame = last
          ? Buffer.from(database.prepare(`
            SELECT transition_frame
            FROM privacy_vault_journal_cas_transitions
            WHERE revision_be = ?
          `).get(u64Be(BigInt(last.revision))).transition_frame)
          : null;

        const exactReplay = last
          && last.transitionFrameSha256 === frameSha256
          && last.beforeJournalDigest === verified.beforeJournalDigest
          && last.afterJournalDigest === verified.afterJournalDigest
          && last.afterJournalDigest === currentHeadDigest
          && storedLastFrame?.equals(frame) === true
          && expectedRevision + 1n === currentRevision
          && expectedHeadDigest === verified.beforeJournalDigest;
        if (exactReplay) {
          record = last;
          disposition = PRIVACY_VAULT_JOURNAL_CAS_DISPOSITION.RECONCILED_EXACT_REPLAY;
        } else {
          if (expectedRevision !== currentRevision
            || expectedHeadDigest !== currentHeadDigest
            || verified.beforeJournalDigest !== currentHeadDigest
            || verified.afterJournalDigest === currentHeadDigest) {
            throw new Error("PRIVACY_VAULT_JOURNAL_CAS_STALE_REPLAY_FORK_OR_NOOP_HOLD");
          }
          if (currentRevision === U64_MAX) {
            throw new Error("PRIVACY_VAULT_JOURNAL_CAS_REVISION_OVERFLOW_HOLD");
          }
          const revision = currentRevision + 1n;
          record = {
            revision: revision.toString(),
            beforeJournalDigest: verified.beforeJournalDigest,
            afterJournalDigest: verified.afterJournalDigest,
            transitionFrameSha256: frameSha256,
            previousTransitionFrameSha256: last?.transitionFrameSha256 ?? ZERO_SHA256,
            verifierLaunchBindingSha256: launch.launchBindingSha256,
          };
          record.recordSha256 = recordDigest(record);
          insertRecord(database, record, frame);
          if (values.testFault
            === PRIVACY_VAULT_JOURNAL_CAS_TEST_FAULT.AFTER_INSERT_BEFORE_STAGED_READBACK) {
            throw new Error("PRIVACY_VAULT_JOURNAL_CAS_TEST_FAULT_AFTER_INSERT");
          }
          disposition = PRIVACY_VAULT_JOURNAL_CAS_DISPOSITION.COMMITTED;
        }

        const staged = loadSnapshot(database, expectedGenesisDigest, launch);
        const stagedLast = staged.records.at(-1);
        if (!stagedLast
          || stagedLast.recordSha256 !== record.recordSha256
          || staged.currentHeadDigest !== record.afterJournalDigest) {
          throw new Error("PRIVACY_VAULT_JOURNAL_CAS_STAGED_READBACK_MISMATCH_HOLD");
        }
        record = stagedLast;
        database.exec("COMMIT");
      } catch (error) {
        rollbackWithoutMasking(database);
        throw error;
      }

      if (values.testFault
        === PRIVACY_VAULT_JOURNAL_CAS_TEST_FAULT.AFTER_COMMIT_BEFORE_RETURN) {
        throw new Error("PRIVACY_VAULT_JOURNAL_CAS_TEST_FAULT_AFTER_COMMIT");
      }
      const reopened = transactionalSnapshot(database, expectedGenesisDigest, launch);
      if (reopened.currentHeadDigest !== record.afterJournalDigest
        || reopened.records.at(-1)?.recordSha256 !== record.recordSha256) {
        throw new Error("PRIVACY_VAULT_JOURNAL_CAS_POST_COMMIT_READBACK_MISMATCH_HOLD");
      }
      return Object.freeze({
        schema: "iat-b3-privacy-vault-journal-cas-commit-result/v1",
        status: PRIVACY_VAULT_JOURNAL_CAS_SQLITE_STATUS,
        disposition,
        record,
        currentRevision: reopened.currentRevision,
        currentHeadDigest: reopened.currentHeadDigest,
        localTransitionCasAtomicityVerified: true,
        durableLocalSqliteReopenVerified: true,
        configuredVerifierReplayAccepted: true,
        ...falseTruthBoundary(),
      });
    },
    close() {
      requireOpen();
      database.close();
      closed = true;
    },
  });
  ADAPTERS.add(adapter);
  return adapter;
}

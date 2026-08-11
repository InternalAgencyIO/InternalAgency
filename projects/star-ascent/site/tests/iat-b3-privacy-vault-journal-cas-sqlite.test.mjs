import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import {
  assertPrivacyVaultJournalCasSqliteAdapter,
  createPrivacyVaultJournalCasSqlite,
  PRIVACY_VAULT_JOURNAL_CAS_DISPOSITION,
  PRIVACY_VAULT_JOURNAL_CAS_SQLITE_MAINNET_STATUS,
  PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA_MANIFEST_SHA256,
  PRIVACY_VAULT_JOURNAL_CAS_SQLITE_STATUS,
  PRIVACY_VAULT_JOURNAL_CAS_TEST_FAULT,
} from "../programs/iat_b3_reference/privacy-vault-journal-cas-sqlite.mjs";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "iat-b3-journal-cas-"));
const verifierName = "iat_b3_vault_journal_transition_verifier";
const targetDirectory = path.join(siteRoot, "target", "iat-b3-journal-cas-test");

after(() => {
  rmSync(temporaryRoot, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Domain(domain, value) {
  return createHash("sha256")
    .update(domain, "ascii")
    .update(Buffer.from([0]))
    .update(value)
    .digest();
}

function windowsToWsl(value) {
  const resolved = path.resolve(value);
  const match = /^([A-Za-z]):\\(.*)$/.exec(resolved);
  if (!match) throw new Error(`cannot map Windows path to WSL: ${resolved}`);
  return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
}

function buildVerifierLaunch() {
  const binaryFile = process.platform === "win32" ? verifierName : verifierName;
  const binaryPath = path.join(targetDirectory, "debug", binaryFile);
  const manifestPath = path.join(siteRoot, "Cargo.toml");
  let build;
  let executablePath;
  let argv;
  let environment;
  let verifierArtifactLaunchArgument;
  if (process.platform === "win32") {
    executablePath = path.join(process.env.SystemRoot, "System32", "wsl.exe");
    const cargoLookup = spawnSync(executablePath, [
      "--exec",
      "bash",
      "-lc",
      "command -v cargo",
    ], {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 10_000,
    });
    assert.equal(cargoLookup.error, undefined, cargoLookup.error?.message);
    assert.equal(cargoLookup.status, 0, cargoLookup.stderr);
    const cargoPath = cargoLookup.stdout.trim();
    assert.match(cargoPath, /^\/.+\/cargo$/);
    build = spawnSync(executablePath, [
      "--exec",
      "env",
      `CARGO_TARGET_DIR=${windowsToWsl(targetDirectory)}`,
      cargoPath,
      "+1.97.1",
      "build",
      "--manifest-path",
      windowsToWsl(manifestPath),
      "-p",
      "iat-b3-vault",
      "--bin",
      verifierName,
    ], {
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 180_000,
    });
    argv = ["--exec", windowsToWsl(binaryPath)];
    verifierArtifactLaunchArgument = windowsToWsl(binaryPath);
    environment = {
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
    };
  } else {
    build = spawnSync("cargo", [
      "+1.97.1",
      "build",
      "--manifest-path",
      manifestPath,
      "-p",
      "iat-b3-vault",
      "--bin",
      verifierName,
    ], {
      encoding: "utf8",
      env: { ...process.env, CARGO_TARGET_DIR: targetDirectory },
      shell: false,
      timeout: 180_000,
    });
    executablePath = binaryPath;
    argv = [];
    verifierArtifactLaunchArgument = null;
    environment = {};
  }
  assert.equal(build.error, undefined, build.error?.message);
  assert.equal(build.status, 0, `${build.stdout}\n${build.stderr}`);
  return Object.freeze({
    executablePath,
    executableSha256: sha256(readFileSync(executablePath)),
    argv: Object.freeze(argv),
    workingDirectory: siteRoot,
    environment: Object.freeze(environment),
    timeoutMs: 10_000,
    verifierArtifactLaunchArgument,
    verifierArtifactPath: binaryPath,
    verifierArtifactSha256: sha256(readFileSync(binaryPath)),
  });
}

const verifierLaunch = buildVerifierLaunch();

function writeU64(buffer, offset, value) {
  buffer.writeBigUInt64BE(BigInt(value), offset);
  return offset + 8;
}

function encodeStep(buffer, offset, {
  kind,
  invokesHook,
  changesOwner,
  cleanup,
  visibility,
  amount,
}) {
  buffer[offset] = kind;
  buffer[offset + 1] = 1;
  buffer[offset + 2] = Number(invokesHook);
  buffer[offset + 3] = Number(changesOwner);
  buffer[offset + 4] = Number(cleanup);
  buffer[offset + 5] = visibility;
  writeU64(buffer, offset + 6, amount);
  return offset + 14;
}

function transferPlanPayload() {
  const payload = Buffer.alloc(220);
  let offset = 0;
  payload[offset++] = 1;
  payload[offset++] = 3;
  payload.fill(0x11, offset, offset + 32);
  offset += 32;
  payload.fill(0x22, offset, offset + 32);
  offset += 32;
  payload.fill(0x33, offset, offset + 32);
  offset += 32;
  payload[offset++] = 3;
  offset = encodeStep(payload, offset, {
    kind: 5,
    invokesHook: false,
    changesOwner: false,
    cleanup: true,
    visibility: 2,
    amount: 0,
  });
  offset = encodeStep(payload, offset, {
    kind: 6,
    invokesHook: true,
    changesOwner: true,
    cleanup: true,
    visibility: 2,
    amount: 0,
  });
  offset = encodeStep(payload, offset, {
    kind: 7,
    invokesHook: false,
    changesOwner: false,
    cleanup: false,
    visibility: 0,
    amount: 0,
  });
  offset += 14;
  for (const value of [1, 1, 1, 0, 0, 1, 0, 0]) payload[offset++] = value;
  offset = writeU64(payload, offset, 0);
  payload[offset++] = 0;
  offset = writeU64(payload, offset, 0);
  payload[offset++] = 0;
  payload[offset++] = 0;
  payload.fill(0x44, offset, offset + 32);
  offset += 32;
  for (const value of [0, 0, 0, 0, 0, 1]) payload[offset++] = value;
  assert.equal(offset, payload.length);
  return payload;
}

function framed(kind, payload) {
  const bytes = Buffer.alloc(16 + payload.length);
  bytes.write("IATB3PJC", 0, "ascii");
  bytes[8] = 1;
  bytes[9] = kind;
  bytes.writeUInt32BE(payload.length, 12);
  payload.copy(bytes, 16);
  return bytes;
}

function journalBytes(planPayload, operationId, nextStep, openContexts, status) {
  const planFrame = framed(1, planPayload);
  const planDigest = sha256Domain(
    "IAT_B3_PRIVACY_OPERATION_PLAN_CODEC_DIGEST_V1",
    planFrame,
  );
  const payload = Buffer.alloc(267);
  let offset = writeU64(payload, 0, operationId);
  planPayload.copy(payload, offset);
  offset += planPayload.length;
  planDigest.copy(payload, offset);
  offset += 32;
  payload[offset++] = nextStep;
  payload[offset++] = openContexts;
  payload[offset++] = status;
  payload[offset++] = 0;
  payload[offset++] = 0;
  payload[offset++] = 0;
  payload[offset++] = 1;
  assert.equal(offset, payload.length);
  return framed(2, payload);
}

function journalDigest(bytes) {
  return sha256Domain("IAT_B3_OPERATION_JOURNAL_CODEC_DIGEST_V1", bytes);
}

function transitionFrame(before, after, stepIndex, observation) {
  const payload = Buffer.alloc(634);
  let offset = 0;
  payload[offset++] = 1;
  payload[offset++] = 1;
  payload[offset++] = stepIndex;
  payload[offset++] = observation;
  journalDigest(before).copy(payload, offset);
  offset += 32;
  before.copy(payload, offset);
  offset += before.length;
  journalDigest(after).copy(payload, offset);
  offset += 32;
  after.copy(payload, offset);
  offset += after.length;
  assert.equal(offset, payload.length);
  const frame = Buffer.alloc(650);
  frame.write("IATB3JTR", 0, "ascii");
  frame[8] = 1;
  frame[9] = 1;
  frame.writeUInt32BE(payload.length, 12);
  payload.copy(frame, 16);
  return frame;
}

function fixtureChain() {
  const plan = transferPlanPayload();
  const operationId = 0x0102_0304_0506_0708n;
  const journals = [
    journalBytes(plan, operationId, 0, 0, 1),
    journalBytes(plan, operationId, 1, 3, 1),
    journalBytes(plan, operationId, 2, 3, 1),
    journalBytes(plan, operationId, 3, 0, 4),
  ];
  return {
    genesisDigest: journalDigest(journals[0]).toString("hex"),
    headDigests: journals.map((journal) => journalDigest(journal).toString("hex")),
    frames: [
      transitionFrame(journals[0], journals[1], 0, 1),
      transitionFrame(journals[1], journals[2], 1, 1),
      transitionFrame(journals[2], journals[3], 2, 1),
    ],
    forkFrame: transitionFrame(
      journals[0],
      journalBytes(plan, operationId, 0, 0, 3),
      0,
      3,
    ),
  };
}

const fixtures = fixtureChain();

function databasePath(label) {
  return path.join(temporaryRoot, `${label}-${randomUUID()}.sqlite`);
}

function createAdapter(databaseFile, launch = verifierLaunch) {
  return createPrivacyVaultJournalCasSqlite({
    databasePath: databaseFile,
    expectedGenesisJournalDigest: fixtures.genesisDigest,
    verifierLaunch: launch,
  });
}

function commit(adapter, index, options = {}) {
  return adapter.commitTransition({
    expectedRevision: String(index),
    expectedHeadDigest: fixtures.headDigests[index],
    transitionFrame: fixtures.frames[index],
    testFault: options.testFault ?? null,
  });
}

test("empty adapter is process-branded, file-backed, and truthfully local-only", () => {
  const adapter = createAdapter(databasePath("empty"));
  assert.equal(assertPrivacyVaultJournalCasSqliteAdapter(adapter), adapter);
  const snapshot = adapter.snapshot();
  assert.equal(snapshot.status, PRIVACY_VAULT_JOURNAL_CAS_SQLITE_STATUS);
  assert.equal(snapshot.schemaManifestSha256, PRIVACY_VAULT_JOURNAL_CAS_SQLITE_SCHEMA_MANIFEST_SHA256);
  assert.equal(snapshot.currentRevision, "0");
  assert.equal(snapshot.currentHeadDigest, fixtures.genesisDigest);
  assert.equal(snapshot.localTransitionCasAtomicityVerified, true);
  assert.equal(snapshot.durableLocalSqliteReopenVerified, true);
  assert.equal(snapshot.configuredVerifierReplayRequired, true);
  assert.equal(snapshot.verifierIdentityAuthenticated, false);
  assert.equal(snapshot.verifierLaunchEnvironmentAuthenticated, false);
  assert.equal(snapshot.verifierPathRaceConfinementVerified, false);
  assert.equal(snapshot.verifierArtifactPathMappingAuthenticated, false);
  assert.equal(snapshot.externalWriterConfinementVerified, false);
  assert.equal(snapshot.externalRollbackProtectionVerified, false);
  assert.equal(snapshot.authenticatedChainObservationVerified, false);
  assert.equal(snapshot.providerAuthenticationVerified, false);
  assert.equal(snapshot.runtimeIntegrationVerified, false);
  assert.equal(snapshot.devnetLifecycleVerified, false);
  assert.equal(snapshot.activationReady, false);
  assert.equal(snapshot.mainnetStatus, PRIVACY_VAULT_JOURNAL_CAS_SQLITE_MAINNET_STATUS);
  adapter.close();
});

test("three exact Rust-verified transitions commit contiguously and reopen", () => {
  const file = databasePath("chain");
  let adapter = createAdapter(file);
  for (let index = 0; index < fixtures.frames.length; index += 1) {
    const result = commit(adapter, index);
    assert.equal(result.disposition, PRIVACY_VAULT_JOURNAL_CAS_DISPOSITION.COMMITTED);
    assert.equal(result.currentRevision, String(index + 1));
    assert.equal(result.currentHeadDigest, fixtures.headDigests[index + 1]);
  }
  adapter.close();
  adapter = createAdapter(file);
  const reopened = adapter.snapshot();
  assert.equal(reopened.currentRevision, "3");
  assert.equal(reopened.currentHeadDigest, fixtures.headDigests[3]);
  assert.equal(reopened.records.length, 3);
  assert.deepEqual(reopened.records.map((record) => record.revision), ["1", "2", "3"]);
  adapter.close();
});

test("rollback fault leaves no row and exact retry succeeds after reopen", () => {
  const file = databasePath("rollback");
  let adapter = createAdapter(file);
  assert.throws(() => commit(adapter, 0, {
    testFault: PRIVACY_VAULT_JOURNAL_CAS_TEST_FAULT.AFTER_INSERT_BEFORE_STAGED_READBACK,
  }), /TEST_FAULT_AFTER_INSERT/);
  assert.equal(adapter.snapshot().currentRevision, "0");
  adapter.close();
  adapter = createAdapter(file);
  assert.equal(adapter.snapshot().currentRevision, "0");
  assert.equal(commit(adapter, 0).disposition, PRIVACY_VAULT_JOURNAL_CAS_DISPOSITION.COMMITTED);
  adapter.close();
});

test("lost response reconciles only the exact current-head frame", () => {
  const file = databasePath("reconcile");
  let adapter = createAdapter(file);
  assert.throws(() => commit(adapter, 0, {
    testFault: PRIVACY_VAULT_JOURNAL_CAS_TEST_FAULT.AFTER_COMMIT_BEFORE_RETURN,
  }), /TEST_FAULT_AFTER_COMMIT/);
  adapter.close();
  adapter = createAdapter(file);
  const reconciled = commit(adapter, 0);
  assert.equal(
    reconciled.disposition,
    PRIVACY_VAULT_JOURNAL_CAS_DISPOSITION.RECONCILED_EXACT_REPLAY,
  );
  assert.equal(reconciled.currentRevision, "1");
  adapter.close();
});

test("stale revision, skip, fork, no-op, and malformed frames fail closed", () => {
  const adapter = createAdapter(databasePath("hostile"));
  assert.throws(() => adapter.commitTransition({
    expectedRevision: "0",
    expectedHeadDigest: fixtures.genesisDigest,
    transitionFrame: fixtures.frames[1],
    testFault: null,
  }));
  const corrupted = Buffer.from(fixtures.frames[0]);
  corrupted[400] ^= 1;
  assert.throws(() => adapter.commitTransition({
    expectedRevision: "0",
    expectedHeadDigest: fixtures.genesisDigest,
    transitionFrame: corrupted,
    testFault: null,
  }), /VERIFIER_REJECTED/);
  commit(adapter, 0);
  assert.throws(() => adapter.commitTransition({
    expectedRevision: "0",
    expectedHeadDigest: fixtures.genesisDigest,
    transitionFrame: fixtures.forkFrame,
    testFault: null,
  }), /STALE_REPLAY_FORK_OR_NOOP/);
  assert.throws(() => adapter.commitTransition({
    expectedRevision: "1",
    expectedHeadDigest: fixtures.headDigests[1],
    transitionFrame: fixtures.frames[0],
    testFault: null,
  }), /STALE_REPLAY_FORK_OR_NOOP/);
  assert.equal(adapter.snapshot().currentRevision, "1");
  adapter.close();
});

test("two adapters cannot commit competing transitions from one CAS head", () => {
  const file = databasePath("competing");
  const first = createAdapter(file);
  const second = createAdapter(file);
  commit(first, 0);
  assert.throws(() => second.commitTransition({
    expectedRevision: "0",
    expectedHeadDigest: fixtures.genesisDigest,
    transitionFrame: fixtures.forkFrame,
    testFault: null,
  }), /STALE_REPLAY_FORK_OR_NOOP/);
  assert.equal(second.snapshot().currentHeadDigest, fixtures.headDigests[1]);
  first.close();
  second.close();
});

test("separate-writer REPLACE bypass remains detected, never overclaimed as confined", () => {
  const file = databasePath("external-writer");
  const adapter = createAdapter(file);
  commit(adapter, 0);
  const writer = new DatabaseSync(file);
  writer.exec("PRAGMA recursive_triggers = OFF");
  writer.exec(`
    INSERT OR REPLACE INTO privacy_vault_journal_cas_transitions
    SELECT
      revision_be, revision_text,
      before_journal_digest, after_journal_digest,
      zeroblob(650), transition_frame_sha256,
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
    FROM privacy_vault_journal_cas_transitions
    WHERE revision_text = '1'
  `);
  writer.close();
  assert.throws(() => adapter.snapshot(), /STORED_RECORD_MISMATCH|VERIFIER/);
  adapter.close();
});

test("schema drift and verifier launch-binding substitution fail on reopen", () => {
  const schemaFile = databasePath("schema-drift");
  let adapter = createAdapter(schemaFile);
  adapter.close();
  const writer = new DatabaseSync(schemaFile);
  writer.exec("CREATE TABLE unauthorized_object (value TEXT)");
  writer.close();
  assert.throws(() => createAdapter(schemaFile), /SCHEMA_OBJECT_SET_MISMATCH/);

  const bindingFile = databasePath("binding-drift");
  adapter = createAdapter(bindingFile);
  adapter.close();
  const changedLaunch = {
    ...verifierLaunch,
    argv: [...verifierLaunch.argv, "unexpected"],
  };
  assert.throws(() => createAdapter(bindingFile, changedLaunch), /META_MISMATCH/);
});

test("wrong executable or artifact hash and structural clones are rejected", () => {
  const wrongExecutable = {
    ...verifierLaunch,
    executableSha256: "1".repeat(64),
  };
  assert.throws(() => createAdapter(databasePath("wrong-command"), wrongExecutable), /SHA-256 mismatch/);
  const wrongArtifact = {
    ...verifierLaunch,
    verifierArtifactSha256: "2".repeat(64),
  };
  assert.throws(() => createAdapter(databasePath("wrong-artifact"), wrongArtifact), /SHA-256 mismatch/);
  const accessorArgv = [...verifierLaunch.argv];
  if (accessorArgv.length === 0) accessorArgv.push("");
  const originalFirstArgument = accessorArgv[0];
  Object.defineProperty(accessorArgv, "0", {
    configurable: true,
    enumerable: true,
    get: () => originalFirstArgument,
  });
  assert.throws(
    () => createAdapter(databasePath("accessor-argv"), {
      ...verifierLaunch,
      argv: accessorArgv,
    }),
    /argv must be an exact bounded string array/,
  );
  assert.throws(() => assertPrivacyVaultJournalCasSqliteAdapter({}), /not process-branded/);
});

test("post-bind verifier artifact substitution is detected before another commit", () => {
  const copiedArtifact = path.join(temporaryRoot, `verifier-copy-${Date.now()}`);
  copyFileSync(verifierLaunch.verifierArtifactPath, copiedArtifact);
  const copiedDigest = sha256(readFileSync(copiedArtifact));
  const copiedLaunch = process.platform === "win32"
    ? {
      ...verifierLaunch,
      argv: ["--exec", windowsToWsl(copiedArtifact)],
      verifierArtifactLaunchArgument: windowsToWsl(copiedArtifact),
      verifierArtifactPath: copiedArtifact,
      verifierArtifactSha256: copiedDigest,
    }
    : {
      ...verifierLaunch,
      executablePath: copiedArtifact,
      executableSha256: copiedDigest,
      argv: [],
      verifierArtifactLaunchArgument: null,
      verifierArtifactPath: copiedArtifact,
      verifierArtifactSha256: copiedDigest,
    };
  const adapter = createAdapter(databasePath("artifact-toctou"), copiedLaunch);
  const tampered = readFileSync(copiedArtifact);
  tampered[0] ^= 1;
  writeFileSync(copiedArtifact, tampered);
  assert.throws(() => commit(adapter, 0), /Rust verifier artifact (SHA-256 mismatch|identity changed)/);
  adapter.close();
});

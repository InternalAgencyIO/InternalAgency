import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import test from "node:test";

import {
  PROVIDER_AUTHENTICATION_STATUS,
  PROVIDER_KEY_MATERIAL_CLASS,
  PROVIDER_KINDS,
  PROVIDER_SIGNATURE_ALGORITHM,
  PROVIDER_SIGNED_ENVELOPE_SCHEMA,
  createProviderEnvelopeGenesisState,
  createProviderSignedEnvelope,
  createProviderTrustBinding,
  providerEnvelopeSigningBytes,
} from "../programs/iat_b3_reference/provider-authenticated-envelope.mjs";
import {
  REWARD_ROLLBACK_ANCHOR_PROVIDER_OPERATION,
  createRewardRollbackAnchorGenesisState,
  createRewardRollbackAnchorRequest,
  createRewardRollbackAnchorStatement,
  rewardRollbackAnchorRequestBytes,
  rewardRollbackAnchorStatementBytes,
  verifyRewardExternalRollbackAnchor,
} from "../programs/iat_b3_reference/reward-external-rollback-anchor.mjs";
import {
  REWARD_ROLLBACK_ANCHOR_SQLITE_ADAPTER_SCHEMA,
  REWARD_ROLLBACK_ANCHOR_SQLITE_DISPOSITION,
  REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS,
  REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP,
  REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_MANIFEST_SHA256,
  REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS,
  REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT,
  assertSqliteRewardRollbackAnchorMirrorAdapter,
  createSqliteRewardRollbackAnchorMirror,
  validateRewardRollbackAnchorCursorRecord,
  validateRewardRollbackAnchorDurableReceiptRecord,
} from "../programs/iat_b3_reference/reward-rollback-anchor-sqlite.mjs";

const NOW = 2_000_000_000n;
const ZERO_SHA256 = "0".repeat(64);
const THIS_TEST = fileURLToPath(import.meta.url);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function digest(label) {
  return sha256(Buffer.from(`iat-b3-reward-rollback-anchor-sqlite-test:${label}`, "utf8"));
}

function createKey({ keyId = "prod-sqlite-anchor-key-2026-a" } = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = Buffer.from(publicKey.export({ format: "der", type: "spki" }));
  return {
    privateKey,
    record: {
      keyId,
      algorithm: PROVIDER_SIGNATURE_ALGORITHM,
      keyMaterialClass: PROVIDER_KEY_MATERIAL_CLASS,
      publicKeySpkiDerBase64url: der.toString("base64url"),
      publicKeySha256: sha256(der),
      activationSequence: "1",
      retirementSequence: null,
      notBeforeUnixSeconds: (NOW - 3_600n).toString(),
      notAfterUnixSeconds: (NOW + 86_400n).toString(),
      revokedAtUnixSeconds: null,
      compromiseCutoffUnixSeconds: null,
    },
  };
}

function createContext({ suffix = "primary" } = {}) {
  const key = createKey({ keyId: `prod-sqlite-anchor-key-2026-${suffix}` });
  const trustBinding = createProviderTrustBinding({
    environment: "PRODUCTION",
    providerKind: PROVIDER_KINDS.EXTERNAL_CHECKPOINT,
    providerIdentitySha256: digest(`${suffix}:provider-identity`),
    subjectBindingSha256: digest(`${suffix}:anchor-subject`),
    receiptDomainId: `iat-b3/external-checkpoint-provider/reward-anchor-${suffix}/v1`,
    keyRegistryResourceId: `prod-sqlite-anchor-registry-${suffix}`,
    ownerProductionKeyEvidenceSha256: digest(`${suffix}:owner-key-evidence`),
    maximumEnvelopeAgeSeconds: "300",
    maximumFutureSkewSeconds: "30",
    maximumKeyOverlapSequences: "1",
    keys: [key.record],
  });
  const providerState = createProviderEnvelopeGenesisState(trustBinding);
  const anchorState = createRewardRollbackAnchorGenesisState({
    trustBinding,
    anchorNamespaceSha256: digest(`${suffix}:anchor-namespace`),
    persistenceIdentitySha256: digest(`${suffix}:persistence-identity`),
    maximumAnchorAgeSeconds: "600",
    maximumFutureSkewSeconds: "30",
  });
  return { key, trustBinding, providerState, anchorState };
}

function genesisCheckpoint(persistenceIdentitySha256, suffix = "primary") {
  return {
    persistenceIdentitySha256,
    checkpointRevision: "1",
    checkpointSha256: digest(`${suffix}:checkpoint-1`),
    previousCheckpointSha256: ZERO_SHA256,
    casCommitSequence: "0",
    casHeadCommitSha256: ZERO_SHA256,
  };
}

function nextCheckpoint(previous, suffix = "primary") {
  const nextRevision = BigInt(previous.checkpointRevision) + 1n;
  return {
    persistenceIdentitySha256: previous.persistenceIdentitySha256,
    checkpointRevision: nextRevision.toString(),
    checkpointSha256: digest(`${suffix}:checkpoint-${nextRevision}`),
    previousCheckpointSha256: previous.checkpointSha256,
    casCommitSequence: (BigInt(previous.casCommitSequence) + 1n).toString(),
    casHeadCommitSha256: digest(`${suffix}:cas-head-${nextRevision}`),
  };
}

function createProviderEnvelope({
  context,
  providerState,
  requestBytes,
  anchorBytes,
  requestNonceSha256,
  issuedAtUnixSeconds,
  expiresAtUnixSeconds,
} = {}) {
  const unsigned = {
    schema: PROVIDER_SIGNED_ENVELOPE_SCHEMA,
    status: PROVIDER_AUTHENTICATION_STATUS,
    environment: "PRODUCTION",
    providerKind: PROVIDER_KINDS.EXTERNAL_CHECKPOINT,
    providerIdentitySha256: context.trustBinding.providerIdentitySha256,
    subjectBindingSha256: context.trustBinding.subjectBindingSha256,
    trustBindingSha256: context.trustBinding.trustBindingSha256,
    receiptDomainSha256: context.trustBinding.receiptDomainSha256,
    trustRootSha256: context.trustBinding.trustRootSha256,
    keyRegistrySnapshotSha256: context.trustBinding.keyRegistrySnapshotSha256,
    keyId: context.key.record.keyId,
    signatureAlgorithm: PROVIDER_SIGNATURE_ALGORITHM,
    operation: REWARD_ROLLBACK_ANCHOR_PROVIDER_OPERATION,
    sequence: (BigInt(providerState.lastSequence) + 1n).toString(),
    previousEnvelopeSha256: providerState.lastEnvelopeSha256,
    requestNonceSha256,
    requestSha256: sha256(requestBytes),
    responseSha256: sha256(anchorBytes),
    issuedAtUnixSeconds: issuedAtUnixSeconds.toString(),
    expiresAtUnixSeconds: expiresAtUnixSeconds.toString(),
  };
  const signatureBase64url = sign(
    null,
    providerEnvelopeSigningBytes(unsigned),
    context.key.privateKey,
  ).toString("base64url");
  return createProviderSignedEnvelope({ unsignedEnvelope: unsigned, signatureBase64url });
}

function createExchange({
  context,
  providerState = context.providerState,
  anchorState = context.anchorState,
  checkpoint = genesisCheckpoint(anchorState.persistenceIdentitySha256),
  requestNonceSha256 = digest(`nonce:${checkpoint.checkpointSha256}`),
  requestedAtUnixSeconds = NOW - 6n,
  observedAtUnixSeconds = NOW - 5n,
  expiresAtUnixSeconds = NOW + 120n,
} = {}) {
  const request = createRewardRollbackAnchorRequest({
    currentAnchorState: anchorState,
    requestNonceSha256,
    requestedAtUnixSeconds,
  });
  const statement = createRewardRollbackAnchorStatement({
    currentAnchorState: anchorState,
    request,
    checkpoint,
    observedAtUnixSeconds,
    expiresAtUnixSeconds,
  });
  const requestBytes = rewardRollbackAnchorRequestBytes(request);
  const anchorBytes = rewardRollbackAnchorStatementBytes(statement);
  const providerEnvelope = createProviderEnvelope({
    context,
    providerState,
    requestBytes,
    anchorBytes,
    requestNonceSha256,
    issuedAtUnixSeconds: observedAtUnixSeconds + 1n,
    expiresAtUnixSeconds,
  });
  return {
    providerState,
    anchorState,
    checkpoint,
    requestBytes,
    anchorBytes,
    providerEnvelope,
    requestNonceSha256,
  };
}

function verify(context, exchange, evaluationUnixSeconds = NOW) {
  return verifyRewardExternalRollbackAnchor({
    trustBinding: context.trustBinding,
    currentProviderState: exchange.providerState,
    providerEnvelope: exchange.providerEnvelope,
    requestBytes: exchange.requestBytes,
    anchorBytes: exchange.anchorBytes,
    expectedRequestNonceSha256: exchange.requestNonceSha256,
    currentAnchorState: exchange.anchorState,
    expectedCheckpoint: exchange.checkpoint,
    evaluationUnixSeconds,
  });
}

function createReceiptPair(context, { suffix = "primary" } = {}) {
  const firstExchange = createExchange({
    context,
    checkpoint: genesisCheckpoint(context.anchorState.persistenceIdentitySha256, suffix),
  });
  const first = verify(context, firstExchange);
  const secondExchange = createExchange({
    context,
    providerState: first.providerStateAfter,
    anchorState: first.anchorStateAfter,
    checkpoint: nextCheckpoint(firstExchange.checkpoint, suffix),
    requestedAtUnixSeconds: NOW + 1n,
    observedAtUnixSeconds: NOW + 2n,
    expiresAtUnixSeconds: NOW + 180n,
  });
  const second = verify(context, secondExchange, NOW + 3n);
  return { first, second, firstExchange, secondExchange };
}

function mirrorOptions(context, databasePath, testOnlyFault = null) {
  return {
    databasePath,
    trustBinding: context.trustBinding,
    genesisAnchorState: context.anchorState,
    genesisProviderState: context.providerState,
    ...(testOnlyFault === null ? {} : { testOnlyFault }),
  };
}

function temporaryDatabase(t, label) {
  const directory = mkdtempSync(join(tmpdir(), `iat-b3-anchor-${label}-`));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  return join(directory, "rollback-anchor.sqlite");
}

function assertHoldBoundary(record) {
  assert.equal(record.durableLocalMirrorVerified, true);
  assert.equal(record.cursorReceiptAtomicityVerified, true);
  for (const key of [
    "providerAuthenticationVerified",
    "externalProviderDurabilityVerified",
    "externalMonotonicityVerified",
    "independentRollbackProtectionVerified",
    "runtimeIntegrationVerified",
    "activationReady",
  ]) assert.equal(record[key], false, key);
  assert.equal(record.mainnetStatus, REWARD_ROLLBACK_ANCHOR_SQLITE_MAINNET_STATUS);
}

function runCrashChild() {
  const scenario = process.env.IAT_B3_SQLITE_ANCHOR_CRASH_SCENARIO;
  if (!scenario) return;
  const databasePath = process.env.IAT_B3_SQLITE_ANCHOR_CRASH_DATABASE;
  const contextPath = process.env.IAT_B3_SQLITE_ANCHOR_CRASH_CONTEXT;
  if (!databasePath || !contextPath) process.exit(85);
  const context = createContext({ suffix: `crash-${scenario}` });
  const { first } = createReceiptPair(context, { suffix: `crash-${scenario}` });
  writeFileSync(contextPath, JSON.stringify({
    trustBinding: context.trustBinding,
    anchorState: context.anchorState,
    providerState: context.providerState,
    suppliedAnchorState: first.anchorStateAfter,
  }));
  const fault = scenario === "before-commit"
    ? REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT.HARD_EXIT_AFTER_RECEIPT_INSERT
    : REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT.HARD_EXIT_AFTER_DURABLE_COMMIT;
  const mirror = createSqliteRewardRollbackAnchorMirror({
    ...mirrorOptions(context, databasePath),
    testOnlyFault: fault,
  });
  mirror.consumeSignedAnchorReceipt({ receipt: first });
  process.exit(84);
}

runCrashChild();

test("mirror adapter brand rejects clones, aliases, proxies, and lookalikes without reads", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-anchor-adapter-brand-"));
  const databasePath = join(directory, "rollback-anchor.sqlite");
  const context = createContext({ suffix: "adapter-brand" });
  const mirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, databasePath));
  t.after(() => {
    mirror.close();
    rmSync(directory, { force: true, recursive: true });
  });
  assert.equal(assertSqliteRewardRollbackAnchorMirrorAdapter(mirror), mirror);

  const structuralClone = Object.freeze({ ...mirror });
  const boundMethodAlias = Object.freeze({
    ...mirror,
    readHead: mirror.readHead.bind(mirror),
    snapshot: mirror.snapshot.bind(mirror),
    consumeSignedAnchorReceipt: mirror.consumeSignedAnchorReceipt.bind(mirror),
    compareWithSuppliedAnchorState: mirror.compareWithSuppliedAnchorState.bind(mirror),
  });
  const prototypeLookalike = Object.create(mirror);
  let accessorRead = false;
  const accessorFake = {};
  Object.defineProperty(accessorFake, "adapterSchema", {
    enumerable: true,
    get() {
      accessorRead = true;
      throw new Error("ROLLBACK_MIRROR_ADAPTER_ACCESSOR_EXECUTED");
    },
  });
  const proxy = new Proxy(mirror, {
    get() {
      accessorRead = true;
      throw new Error("ROLLBACK_MIRROR_ADAPTER_PROXY_EXECUTED");
    },
  });

  for (const candidate of [
    structuralClone,
    boundMethodAlias,
    prototypeLookalike,
    accessorFake,
    proxy,
  ]) {
    assert.throws(
      () => assertSqliteRewardRollbackAnchorMirrorAdapter(candidate),
      /process-branded SQLite adapter/u,
    );
  }
  assert.equal(accessorRead, false);
});

test("file-backed mirror atomically persists a branded signed anchor and reopens exactly", (t) => {
  const databasePath = temporaryDatabase(t, "persist");
  const context = createContext();
  const { first, second } = createReceiptPair(context);
  const mirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, databasePath));

  assert.equal(mirror.adapterSchema, REWARD_ROLLBACK_ANCHOR_SQLITE_ADAPTER_SCHEMA);
  assert.equal(mirror.status, REWARD_ROLLBACK_ANCHOR_SQLITE_STATUS);
  assert.equal(mirror.schemaManifestSha256, REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_MANIFEST_SHA256);
  assert.deepEqual(mirror.readHead(), {
    anchorSequence: "0",
    anchorSha256: ZERO_SHA256,
    checkpointRevision: "0",
    checkpointSha256: ZERO_SHA256,
    providerEnvelopeSequence: "0",
    providerEnvelopeSha256: ZERO_SHA256,
    anchorStateSha256: context.anchorState.stateSha256,
    providerStateSha256: context.providerState.stateSha256,
    cursorSha256: ZERO_SHA256,
    durableLocalMirrorVerified: true,
    cursorReceiptAtomicityVerified: true,
    localRollbackComparisonVerified: true,
    providerAuthenticationVerified: false,
    externalProviderDurabilityVerified: false,
    externalMonotonicityVerified: false,
    independentRollbackProtectionVerified: false,
    runtimeIntegrationVerified: false,
    activationReady: false,
    mainnetStatus: "HOLD",
  });

  const committed = mirror.consumeSignedAnchorReceipt({ receipt: first });
  assert.equal(committed.disposition, REWARD_ROLLBACK_ANCHOR_SQLITE_DISPOSITION.COMMITTED);
  assert.equal(committed.receiptRecord.anchorSequence, "1");
  assert.equal(committed.cursor.anchorSequence, "1");
  assert.equal(committed.cursor.receiptRecordSha256, committed.receiptRecord.receiptRecordSha256);
  assertHoldBoundary(committed);
  assertHoldBoundary(committed.receiptRecord);
  assertHoldBoundary(committed.cursor);
  const firstSnapshot = mirror.snapshot();
  assert.equal(firstSnapshot.receipts.length, 1);
  assert.equal(firstSnapshot.cursors.length, 1);
  assert.equal(Object.isFrozen(firstSnapshot), true);
  assert.equal(Object.isFrozen(firstSnapshot.receipts[0]), true);
  mirror.close();
  assert.throws(() => mirror.readHead(), /MIRROR_CLOSED/u);

  const reopened = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, databasePath));
  assert.equal(reopened.readHead().anchorSha256, first.anchorSha256);
  const duplicate = reopened.consumeSignedAnchorReceipt({ receipt: first });
  assert.equal(duplicate.disposition, REWARD_ROLLBACK_ANCHOR_SQLITE_DISPOSITION.ALREADY_CURRENT);
  assert.equal(reopened.snapshot().receipts.length, 1);
  const next = reopened.consumeSignedAnchorReceipt({ receipt: second });
  assert.equal(next.disposition, REWARD_ROLLBACK_ANCHOR_SQLITE_DISPOSITION.COMMITTED);
  assert.equal(next.receiptRecord.anchorSequence, "2");
  assert.equal(reopened.snapshot().receipts.length, 2);
  assert.equal(reopened.snapshot().cursors.length, 2);
  reopened.close();
});

test("receipt and cursor validators bind exact canonical chain records", (t) => {
  const databasePath = temporaryDatabase(t, "validators");
  const context = createContext({ suffix: "validators" });
  const { first, second } = createReceiptPair(context, { suffix: "validators" });
  const mirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, databasePath));
  const firstStored = mirror.consumeSignedAnchorReceipt({ receipt: first });
  const secondStored = mirror.consumeSignedAnchorReceipt({ receipt: second });
  const configuration = {
    anchorNamespaceSha256: context.anchorState.anchorNamespaceSha256,
    persistenceIdentitySha256: context.anchorState.persistenceIdentitySha256,
    providerTrustBindingSha256: context.trustBinding.trustBindingSha256,
    providerTrustRootSha256: context.trustBinding.trustRootSha256,
    providerKeyRegistrySnapshotSha256: context.trustBinding.keyRegistrySnapshotSha256,
    genesisAnchorStateSha256: context.anchorState.stateSha256,
    genesisProviderStateSha256: context.providerState.stateSha256,
  };
  assert.equal(validateRewardRollbackAnchorDurableReceiptRecord(
    firstStored.receiptRecord,
    null,
    configuration,
  ), firstStored.receiptRecord);
  assert.equal(validateRewardRollbackAnchorDurableReceiptRecord(
    secondStored.receiptRecord,
    firstStored.receiptRecord,
    configuration,
  ), secondStored.receiptRecord);
  assert.equal(validateRewardRollbackAnchorCursorRecord(
    secondStored.cursor,
    firstStored.cursor,
    secondStored.receiptRecord,
  ), secondStored.cursor);
  assert.throws(() => validateRewardRollbackAnchorDurableReceiptRecord(
    { ...secondStored.receiptRecord, anchorSequence: "3" },
    firstStored.receiptRecord,
    configuration,
  ), /CHAIN_MISMATCH|DIGEST_MISMATCH/u);
  assert.throws(() => validateRewardRollbackAnchorCursorRecord(
    { ...secondStored.cursor, receiptRecordSha256: digest("wrong-receipt") },
    firstStored.cursor,
    secondStored.receiptRecord,
  ), /BINDING_MISMATCH|DIGEST_MISMATCH/u);
  mirror.close();
});

test("pre-commit faults roll back both receipt and cursor and reopen empty", async (t) => {
  for (const fault of [
    REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT.AFTER_RECEIPT_INSERT,
    REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT.AFTER_CURSOR_INSERT,
  ]) {
    await t.test(fault, () => {
      const databasePath = temporaryDatabase(t, fault.toLowerCase());
      const context = createContext({ suffix: fault.toLowerCase() });
      const { first } = createReceiptPair(context, { suffix: fault.toLowerCase() });
      const mirror = createSqliteRewardRollbackAnchorMirror(
        mirrorOptions(context, databasePath, fault),
      );
      assert.throws(
        () => mirror.consumeSignedAnchorReceipt({ receipt: first }),
        new RegExp(`TEST_ONLY_REWARD_ROLLBACK_ANCHOR_SQLITE_FAULT_${fault}`, "u"),
      );
      mirror.close();
      const reopened = createSqliteRewardRollbackAnchorMirror(
        mirrorOptions(context, databasePath),
      );
      assert.equal(reopened.snapshot().receipts.length, 0);
      assert.equal(reopened.snapshot().cursors.length, 0);
      assert.equal(reopened.readHead().anchorSequence, "0");
      reopened.close();
    });
  }
});

test("post-commit uncertainty reopens committed and exact retry is idempotent", (t) => {
  const databasePath = temporaryDatabase(t, "post-commit");
  const context = createContext({ suffix: "post-commit" });
  const { first } = createReceiptPair(context, { suffix: "post-commit" });
  const mirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(
    context,
    databasePath,
    REWARD_ROLLBACK_ANCHOR_SQLITE_TEST_FAULT.AFTER_DURABLE_COMMIT,
  ));
  assert.throws(
    () => mirror.consumeSignedAnchorReceipt({ receipt: first }),
    /FAULT_AFTER_DURABLE_COMMIT/u,
  );
  mirror.close();
  const reopened = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, databasePath));
  assert.equal(reopened.snapshot().receipts.length, 1);
  assert.equal(reopened.snapshot().cursors.length, 1);
  assert.equal(
    reopened.consumeSignedAnchorReceipt({ receipt: first }).disposition,
    REWARD_ROLLBACK_ANCHOR_SQLITE_DISPOSITION.ALREADY_CURRENT,
  );
  reopened.close();
});

test("abrupt process exit before commit recovers empty; exit after commit recovers complete", async (t) => {
  for (const scenario of ["before-commit", "after-commit"]) {
    await t.test(scenario, () => {
      const databasePath = temporaryDatabase(t, `crash-${scenario}`);
      const contextPath = `${databasePath}.context.json`;
      const child = spawnSync(process.execPath, [THIS_TEST], {
        encoding: "utf8",
        env: {
          ...process.env,
          IAT_B3_SQLITE_ANCHOR_CRASH_SCENARIO: scenario,
          IAT_B3_SQLITE_ANCHOR_CRASH_DATABASE: databasePath,
          IAT_B3_SQLITE_ANCHOR_CRASH_CONTEXT: contextPath,
        },
        timeout: 30_000,
      });
      assert.equal(child.status, 86, `${child.stdout}\n${child.stderr}`);
      const context = JSON.parse(readFileSync(contextPath, "utf8"));
      const reopened = createSqliteRewardRollbackAnchorMirror({
        databasePath,
        trustBinding: context.trustBinding,
        genesisAnchorState: context.anchorState,
        genesisProviderState: context.providerState,
      });
      const snapshot = reopened.snapshot();
      const expectedCount = scenario === "before-commit" ? 0 : 1;
      assert.equal(snapshot.receipts.length, expectedCount);
      assert.equal(snapshot.cursors.length, expectedCount);
      assert.equal(reopened.readHead().anchorSequence, expectedCount.toString());
      if (scenario === "after-commit") {
        assert.equal(
          reopened.compareWithSuppliedAnchorState(context.suppliedAnchorState).relationship,
          REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP.EXACT,
        );
      }
      reopened.close();
    });
  }
});

test("supplied higher state detects a restored older local database without overclaiming", (t) => {
  const databasePath = temporaryDatabase(t, "restore");
  const backupPath = `${databasePath}.sequence-1-backup`;
  const context = createContext({ suffix: "restore" });
  const { first, second } = createReceiptPair(context, { suffix: "restore" });
  let mirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, databasePath));
  mirror.consumeSignedAnchorReceipt({ receipt: first });
  assert.equal(
    mirror.compareWithSuppliedAnchorState(first.anchorStateAfter).relationship,
    REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP.EXACT,
  );
  mirror.close();
  copyFileSync(databasePath, backupPath);

  mirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, databasePath));
  mirror.consumeSignedAnchorReceipt({ receipt: second });
  const exact = mirror.compareWithSuppliedAnchorState(second.anchorStateAfter);
  assert.equal(exact.relationship, REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP.EXACT);
  assert.equal(exact.localRollbackSignalDetected, false);
  const localAhead = mirror.compareWithSuppliedAnchorState(first.anchorStateAfter);
  assert.equal(localAhead.relationship, REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP.LOCAL_AHEAD);
  assert.equal(localAhead.localRollbackSignalDetected, false);
  mirror.close();

  rmSync(`${databasePath}-wal`, { force: true });
  rmSync(`${databasePath}-shm`, { force: true });
  copyFileSync(backupPath, databasePath);
  mirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, databasePath));
  const behind = mirror.compareWithSuppliedAnchorState(second.anchorStateAfter);
  assert.equal(behind.relationship, REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP.LOCAL_BEHIND);
  assert.equal(behind.localAnchorSequence, "1");
  assert.equal(behind.suppliedAnchorSequence, "2");
  assert.equal(behind.localRollbackSignalDetected, true);
  assert.equal(behind.suppliedStateAuthenticityVerified, false);
  assertHoldBoundary(behind);
  mirror.close();
});

test("same-sequence supplied fork is detected but supplied authenticity stays false", (t) => {
  const databasePath = temporaryDatabase(t, "fork-compare");
  const context = createContext({ suffix: "fork-compare" });
  const original = createReceiptPair(context, { suffix: "original" }).first;
  const fork = createReceiptPair(context, { suffix: "fork" }).first;
  const mirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, databasePath));
  mirror.consumeSignedAnchorReceipt({ receipt: original });
  const comparison = mirror.compareWithSuppliedAnchorState(fork.anchorStateAfter);
  assert.equal(
    comparison.relationship,
    REWARD_ROLLBACK_ANCHOR_SQLITE_RELATIONSHIP.SAME_SEQUENCE_FORK,
  );
  assert.equal(comparison.localRollbackSignalDetected, true);
  assert.equal(comparison.suppliedStateAuthenticityVerified, false);
  assertHoldBoundary(comparison);
  mirror.close();
});

test("brand, sequence, predecessor, trust-root, shape, and closed-store bypasses fail", (t) => {
  const context = createContext({ suffix: "hostile" });
  const { first, second } = createReceiptPair(context, { suffix: "hostile" });

  const skipPath = temporaryDatabase(t, "skip");
  const skipMirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, skipPath));
  assert.throws(
    () => skipMirror.consumeSignedAnchorReceipt({ receipt: second }),
    /MIRROR_SKIP_FORBIDDEN/u,
  );
  skipMirror.close();

  const brandPath = temporaryDatabase(t, "brand");
  const brandMirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, brandPath));
  assert.throws(
    () => brandMirror.consumeSignedAnchorReceipt({ receipt: structuredClone(first) }),
    /process|brand|verification receipt/u,
  );
  assert.throws(
    () => brandMirror.consumeSignedAnchorReceipt({ receipt: first, extra: true }),
    /exact canonical shape|only receipt/u,
  );
  const accessor = {};
  Object.defineProperty(accessor, "receipt", { enumerable: true, get: () => first });
  assert.throws(
    () => brandMirror.consumeSignedAnchorReceipt(accessor),
    /must contain only receipt/u,
  );
  brandMirror.consumeSignedAnchorReceipt({ receipt: first });
  brandMirror.close();
  assert.throws(
    () => brandMirror.consumeSignedAnchorReceipt({ receipt: second }),
    /MIRROR_CLOSED/u,
  );

  const forkPath = temporaryDatabase(t, "fork");
  const forkMirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, forkPath));
  const fork = createReceiptPair(context, { suffix: "hostile-fork" }).first;
  forkMirror.consumeSignedAnchorReceipt({ receipt: first });
  assert.throws(
    () => forkMirror.consumeSignedAnchorReceipt({ receipt: fork }),
    /SAME_SEQUENCE_FORK/u,
  );
  forkMirror.close();

  const wrongContext = createContext({ suffix: "wrong-trust" });
  const wrongReceipt = createReceiptPair(wrongContext, { suffix: "wrong-trust" }).first;
  const trustPath = temporaryDatabase(t, "wrong-trust");
  const trustMirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, trustPath));
  assert.throws(
    () => trustMirror.consumeSignedAnchorReceipt({ receipt: wrongReceipt }),
    /TRUST_BINDING_MISMATCH|CHAIN_MISMATCH/u,
  );
  trustMirror.close();
});

test("append-only triggers reject update, delete, replace, and schema drift", (t) => {
  const databasePath = temporaryDatabase(t, "append-only");
  const context = createContext({ suffix: "append-only" });
  const { first } = createReceiptPair(context, { suffix: "append-only" });
  let mirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, databasePath));
  mirror.consumeSignedAnchorReceipt({ receipt: first });
  mirror.close();

  const raw = new DatabaseSync(databasePath);
  raw.exec("PRAGMA recursive_triggers = ON");
  assert.throws(
    () => raw.exec("UPDATE reward_rollback_anchor_receipts SET status = status"),
    /APPEND_ONLY_UPDATE_FORBIDDEN/u,
  );
  assert.throws(
    () => raw.exec("DELETE FROM reward_rollback_anchor_cursors"),
    /APPEND_ONLY_DELETE_FORBIDDEN/u,
  );
  assert.throws(
    () => raw.exec(`
      INSERT OR REPLACE INTO reward_rollback_anchor_receipts
      SELECT * FROM reward_rollback_anchor_receipts
    `),
    /DUPLICATE_INSERT_FORBIDDEN|APPEND_ONLY_DELETE_FORBIDDEN/u,
  );
  raw.close();

  mirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, databasePath));
  assert.equal(mirror.snapshot().receipts.length, 1);
  mirror.close();

  const tamper = new DatabaseSync(databasePath);
  tamper.exec("DROP TRIGGER reward_rollback_anchor_receipts_forbid_update");
  tamper.close();
  assert.throws(
    () => createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, databasePath)),
    /SCHEMA_OBJECT_SET_MISMATCH|SCHEMA_DEFINITION_MISMATCH/u,
  );
});

test("database identity and constructor option drift fail closed", (t) => {
  const databasePath = temporaryDatabase(t, "identity");
  const context = createContext({ suffix: "identity" });
  const mirror = createSqliteRewardRollbackAnchorMirror(mirrorOptions(context, databasePath));
  mirror.close();

  const wrongContext = createContext({ suffix: "identity-wrong" });
  assert.throws(
    () => createSqliteRewardRollbackAnchorMirror(mirrorOptions(wrongContext, databasePath)),
    /META_MISMATCH/u,
  );
  const alternateGenesis = createRewardRollbackAnchorGenesisState({
    trustBinding: context.trustBinding,
    anchorNamespaceSha256: digest("identity:alternate-namespace"),
    persistenceIdentitySha256: context.anchorState.persistenceIdentitySha256,
    maximumAnchorAgeSeconds: "600",
    maximumFutureSkewSeconds: "30",
  });
  assert.throws(
    () => createSqliteRewardRollbackAnchorMirror({
      ...mirrorOptions(context, databasePath),
      genesisAnchorState: alternateGenesis,
    }),
    /META_MISMATCH/u,
  );
  assert.throws(
    () => createSqliteRewardRollbackAnchorMirror({
      ...mirrorOptions(context, databasePath),
      unexpected: true,
    }),
    /unknown field/u,
  );
  assert.throws(
    () => createSqliteRewardRollbackAnchorMirror({
      ...mirrorOptions(context, ":memory:"),
    }),
    /file-backed/u,
  );
  assert.throws(
    () => createSqliteRewardRollbackAnchorMirror({
      ...mirrorOptions(context, databasePath),
      busyTimeoutMs: 60_001,
    }),
    /0 through 60000/u,
  );
});

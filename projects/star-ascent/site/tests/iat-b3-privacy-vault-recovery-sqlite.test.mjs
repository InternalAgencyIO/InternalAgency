import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  PRIVACY_VAULT_RECOVERY_MAINNET_STATUS,
  createPrivacyVaultRecoveryGenesisState,
  privacyVaultKeyMaterialCommitmentSha256,
  privacyVaultRecoveryKeyCommitmentSha256,
  sealPrivacyVaultRecoveryBundle,
  verifyPrivacyVaultRecoveryBundle,
} from "../programs/iat_b3_reference/privacy-vault-recovery-lifecycle.mjs";
import {
  PRIVACY_VAULT_RECOVERY_SQLITE_ADAPTER_SCHEMA,
  PRIVACY_VAULT_RECOVERY_SQLITE_DISPOSITION,
  PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS,
  PRIVACY_VAULT_RECOVERY_SQLITE_RELATIONSHIP,
  PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_MANIFEST_SHA256,
  PRIVACY_VAULT_RECOVERY_SQLITE_STATUS,
  PRIVACY_VAULT_RECOVERY_SQLITE_TEST_FAULT,
  assertPrivacyVaultRecoverySqliteAdapter,
  createPrivacyVaultRecoverySqlite,
} from "../programs/iat_b3_reference/privacy-vault-recovery-sqlite.mjs";

const NOW = 2_000_000_000n;
const THIS_TEST = fileURLToPath(import.meta.url);
const SQLITE_MODULE_PATH = fileURLToPath(new URL(
  "../programs/iat_b3_reference/privacy-vault-recovery-sqlite.mjs",
  import.meta.url,
));
const LIFECYCLE_MODULE_URL = new URL(
  "../programs/iat_b3_reference/privacy-vault-recovery-lifecycle.mjs",
  import.meta.url,
).href;
const CRASH_POINT_MARKER = "IAT_B3_PRIVACY_RECOVERY_EXTERNAL_CRASH_POINT";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function digest(label) {
  return sha256(Buffer.from(`iat-b3-privacy-vault-recovery-sqlite:${label}`, "utf8"));
}

function sha256Canonical(domain, value) {
  return sha256(Buffer.from(JSON.stringify({ domain, value }), "utf8"));
}

function fixture(t, suffix = "default") {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-privacy-recovery-sqlite-"));
  const stores = new Set();
  t.after(() => {
    for (const store of stores) store.close();
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
  const databasePath = join(directory, `${suffix}.sqlite`);
  const recoveryKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 17));
  const keyMaterial = Buffer.from(
    `opaque-privacy-vault-elgamal-material-${suffix}-v1`,
    "utf8",
  );
  const genesisState = createPrivacyVaultRecoveryGenesisState({
    vaultBindingSha256: digest(`vault:${suffix}`),
    recoveryKeyCommitmentSha256:
      privacyVaultRecoveryKeyCommitmentSha256(recoveryKey),
    maximumBundleAgeSeconds: "600",
    maximumFutureSkewSeconds: "30",
  });
  return {
    directory,
    databasePath,
    recoveryKey,
    keyMaterial,
    genesisState,
    open(state = genesisState, path = databasePath) {
      const store = createPrivacyVaultRecoverySqlite({ databasePath: path, genesisState: state });
      stores.add(store);
      return store;
    },
  };
}

function verified(context, state = context.genesisState, {
  keyMaterial = context.keyMaterial,
  createdAtUnixSeconds = NOW - 5n,
  expiresAtUnixSeconds = NOW + 300n,
} = {}) {
  const bundle = sealPrivacyVaultRecoveryBundle({
    currentState: state,
    recoveryKeyBytes: context.recoveryKey,
    keyMaterialBytes: keyMaterial,
    createdAtUnixSeconds,
    expiresAtUnixSeconds,
  });
  const receipt = verifyPrivacyVaultRecoveryBundle({
    currentState: state,
    bundle,
    recoveryKeyBytes: context.recoveryKey,
    expectedKeyMaterialCommitmentSha256:
      privacyVaultKeyMaterialCommitmentSha256(keyMaterial),
    evaluationUnixSeconds: NOW,
  });
  return { bundle, receipt };
}

function commit(store, evidence, testFault = null) {
  return store.commitVerifiedBundle({
    bundle: evidence.bundle,
    verificationReceipt: evidence.receipt,
    testFault,
  });
}

function crashContext(scenario) {
  const recoveryKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 41));
  const keyMaterial = Buffer.from(`crash-key-material-${scenario}`, "utf8");
  const genesisState = createPrivacyVaultRecoveryGenesisState({
    vaultBindingSha256: digest(`crash-vault:${scenario}`),
    recoveryKeyCommitmentSha256:
      privacyVaultRecoveryKeyCommitmentSha256(recoveryKey),
    maximumBundleAgeSeconds: "600",
    maximumFutureSkewSeconds: "30",
  });
  const context = { recoveryKey, keyMaterial, genesisState };
  return { ...context, evidence: verified(context) };
}

function replaceExactlyOnce(source, needle, replacement, label) {
  const first = source.indexOf(needle);
  assert.notEqual(first, -1, `${label} injection target is missing`);
  assert.equal(source.indexOf(needle, first + needle.length), -1,
    `${label} injection target is ambiguous`);
  return `${source.slice(0, first)}${replacement}${source.slice(first + needle.length)}`;
}

function materializeCrashInstrumentedModule(directory, scenario) {
  const newline = readFileSync(SQLITE_MODULE_PATH, "utf8").includes("\r\n")
    ? "\r\n"
    : "\n";
  let source = readFileSync(SQLITE_MODULE_PATH, "utf8");
  source = replaceExactlyOnce(
    source,
    '"./privacy-vault-recovery-lifecycle.mjs"',
    JSON.stringify(LIFECYCLE_MODULE_URL),
    "lifecycle import",
  );
  source = `import { writeSync as __iatB3CrashWriteSync } from "node:fs";${newline}${source}`;
  const marker = `${CRASH_POINT_MARKER}:${scenario}\n`;
  const crashWait = (indent) => [
    `${indent}__iatB3CrashWriteSync(1, ${JSON.stringify(marker)});`,
    `${indent}Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);`,
  ].join(newline);
  if (scenario === "before-commit") {
    const target = `          insertBundleRecord(database, record);${newline}`;
    source = replaceExactlyOnce(
      source,
      target,
      `${target}${crashWait("          ")}${newline}`,
      scenario,
    );
  } else if (scenario === "after-commit") {
    const target = [
      '        database.exec("COMMIT");',
      "      } catch (error) {",
    ].join(newline);
    source = replaceExactlyOnce(
      source,
      target,
      [
        '        database.exec("COMMIT");',
        crashWait("        "),
        "      } catch (error) {",
      ].join(newline),
      scenario,
    );
  } else {
    throw new Error("unknown crash instrumentation scenario");
  }
  const instrumentedPath = join(directory, `instrumented-${scenario}.mjs`);
  writeFileSync(instrumentedPath, source, { encoding: "utf8", flag: "wx" });
  return instrumentedPath;
}

async function runCrashChild() {
  const scenario = process.env.IAT_B3_PRIVACY_RECOVERY_CRASH_SCENARIO;
  if (!scenario) return;
  const databasePath = process.env.IAT_B3_PRIVACY_RECOVERY_CRASH_DATABASE;
  const modulePath = process.env.IAT_B3_PRIVACY_RECOVERY_CRASH_MODULE;
  if (!databasePath || !modulePath || !["before-commit", "after-commit"].includes(scenario)) {
    process.exit(85);
  }
  const crashModule = await import(pathToFileURL(modulePath).href);
  const context = crashContext(scenario);
  const store = crashModule.createPrivacyVaultRecoverySqlite({
    databasePath,
    genesisState: context.genesisState,
  });
  commit(store, context.evidence);
  process.exit(84);
}

await runCrashChild();

function terminateChildAtInstrumentedCrashPoint({
  databasePath,
  instrumentedModulePath,
  scenario,
}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [THIS_TEST], {
      env: {
        ...process.env,
        IAT_B3_PRIVACY_RECOVERY_CRASH_SCENARIO: scenario,
        IAT_B3_PRIVACY_RECOVERY_CRASH_DATABASE: databasePath,
        IAT_B3_PRIVACY_RECOVERY_CRASH_MODULE: instrumentedModulePath,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let markerObserved = false;
    let terminationRequested = false;
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`crash child timed out\n${stdout}\n${stderr}`));
    }, 30_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (markerObserved || !stdout.includes(`${CRASH_POINT_MARKER}:${scenario}\n`)) return;
      markerObserved = true;
      terminationRequested = child.kill("SIGKILL");
      if (!terminationRequested && !settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`crash child could not be terminated\n${stdout}\n${stderr}`));
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on("exit", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (!markerObserved || !terminationRequested) {
        reject(new Error(
          `crash child exited before external termination: code=${code} signal=${signal}`
          + `\n${stdout}\n${stderr}`,
        ));
        return;
      }
      resolve({ code, signal, stderr, stdout });
    });
  });
}

function assertHoldBoundary(record) {
  assert.equal(record.externalWriterConfinementVerified, false);
  assert.equal(record.suppliedStateAuthenticityVerified, false);
  assert.equal(record.externalRollbackProtectionVerified, false);
  assert.equal(record.securePlatformKeystoreVerified, false);
  assert.equal(record.authenticatedChainObservationVerified, false);
  assert.equal(record.onchainRuntimeIntegrationVerified, false);
  assert.equal(record.privacyLegalReviewAccepted, false);
  assert.equal(record.devnetLifecycleVerified, false);
  assert.equal(record.activationReady, false);
  assert.equal(record.mainnetStatus, PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS);
}

function rewriteStateDigestWithExactInternalHashes(databasePath, bundleRecord, cursorRecord) {
  const nextBundle = structuredClone(bundleRecord);
  delete nextBundle.bundle;
  const nextCursor = structuredClone(cursorRecord);
  nextBundle.stateAfterSha256 = digest("separate-writer-substituted-state-after");
  const { recordSha256: ignoredRecordSha256, ...bundleCore } = nextBundle;
  nextBundle.recordSha256 = sha256Canonical(
    "iat-b3-privacy-vault-recovery-sqlite-bundle-record/v1",
    bundleCore,
  );
  nextCursor.stateAfterSha256 = nextBundle.stateAfterSha256;
  nextCursor.bundleRecordSha256 = nextBundle.recordSha256;
  const { cursorSha256: ignoredCursorSha256, ...cursorCore } = nextCursor;
  nextCursor.cursorSha256 = sha256Canonical(
    "iat-b3-privacy-vault-recovery-sqlite-cursor-record/v1",
    cursorCore,
  );
  assert.equal(typeof ignoredRecordSha256, "string");
  assert.equal(typeof ignoredCursorSha256, "string");

  const attacker = new DatabaseSync(databasePath, {
    allowExtension: false,
    enableForeignKeyConstraints: false,
  });
  const triggerNames = [
    "privacy_vault_recovery_bundle_records_forbid_update",
    "privacy_vault_recovery_cursor_history_forbid_update",
  ];
  const triggerDefinitions = triggerNames.map((name) => attacker.prepare(
    "SELECT sql FROM sqlite_schema WHERE type = 'trigger' AND name = ?",
  ).get(name).sql);
  attacker.exec("PRAGMA foreign_keys = OFF");
  for (const name of triggerNames) attacker.exec(`DROP TRIGGER ${name}`);
  attacker.prepare(`
    UPDATE privacy_vault_recovery_bundle_records
    SET state_after_sha256 = ?, record_sha256 = ?
    WHERE epoch_text = '1'
  `).run(nextBundle.stateAfterSha256, nextBundle.recordSha256);
  attacker.prepare(`
    UPDATE privacy_vault_recovery_cursor_history
    SET state_after_sha256 = ?, bundle_record_sha256 = ?, cursor_sha256 = ?
    WHERE epoch_text = '1'
  `).run(
    nextCursor.stateAfterSha256,
    nextCursor.bundleRecordSha256,
    nextCursor.cursorSha256,
  );
  for (const sql of triggerDefinitions) attacker.exec(sql);
  attacker.exec("PRAGMA foreign_keys = ON");
  assert.deepEqual(attacker.prepare("PRAGMA foreign_key_check").all(), []);
  attacker.close();
}

test("file-backed adapter starts at exact Genesis with only local capability facts", (t) => {
  const context = fixture(t, "genesis");
  const store = context.open();
  t.after(() => store.close());
  const snapshot = store.snapshot();

  assert.equal(store.schema, PRIVACY_VAULT_RECOVERY_SQLITE_ADAPTER_SCHEMA);
  assert.equal(store.status, PRIVACY_VAULT_RECOVERY_SQLITE_STATUS);
  assert.equal(store.schemaManifestSha256, PRIVACY_VAULT_RECOVERY_SQLITE_SCHEMA_MANIFEST_SHA256);
  assert.equal(store.localBundleCursorAtomicityVerified, true);
  assert.equal(store.processPrivateReceiptRequired, true);
  assert.equal(store.durableLocalSqliteReopenVerified, true);
  assertHoldBoundary(store);
  assert.deepEqual(snapshot.genesisState, context.genesisState);
  assert.deepEqual(snapshot.currentState, context.genesisState);
  assert.deepEqual(snapshot.bundles, []);
  assert.deepEqual(snapshot.cursors, []);
  assert.equal(snapshot.localBundleCursorAtomicityVerified, true);
  assertHoldBoundary(snapshot);
  assert.equal(assertPrivacyVaultRecoverySqliteAdapter(store), store);
  assert.throws(
    () => assertPrivacyVaultRecoverySqliteAdapter({ ...store }),
    /not process-branded/u,
  );
  assert.throws(
    () => assertPrivacyVaultRecoverySqliteAdapter(new Proxy(store, {})),
    /not process-branded/u,
  );
  assert.equal(existsSync(context.databasePath), true);
});

test("verified bundle and cursor commit atomically, reopen, and reconcile exact replay", (t) => {
  const context = fixture(t, "commit-reopen");
  const evidence = verified(context);
  let store = context.open();
  const committed = commit(store, evidence);

  assert.equal(committed.disposition, PRIVACY_VAULT_RECOVERY_SQLITE_DISPOSITION.COMMITTED);
  assert.equal(committed.bundleRecord.bundleSha256, evidence.bundle.bundleSha256);
  assert.equal(
    committed.bundleRecord.verificationReceiptSha256,
    evidence.receipt.verificationReceiptSha256,
  );
  assert.equal(committed.cursorRecord.cursorRevision, "1");
  assert.equal(committed.cursorRecord.bundleRecordSha256, committed.bundleRecord.recordSha256);
  assert.equal(committed.currentState.stateSha256, evidence.receipt.stateAfter.stateSha256);
  assert.equal(committed.localBundleCursorAtomicityVerified, true);
  assertHoldBoundary(committed);
  store.close();

  store = context.open();
  t.after(() => store.close());
  const reopened = store.snapshot();
  assert.equal(reopened.bundles.length, 1);
  assert.equal(reopened.cursors.length, 1);
  assert.equal(reopened.currentState.stateSha256, evidence.receipt.stateAfter.stateSha256);
  assert.equal(reopened.bundles[0].bundle.bundleSha256, evidence.bundle.bundleSha256);

  const retry = commit(store, evidence);
  assert.equal(
    retry.disposition,
    PRIVACY_VAULT_RECOVERY_SQLITE_DISPOSITION.RECONCILED_EXACT_REPLAY,
  );
  assert.equal(store.snapshot().bundles.length, 1);
  assert.equal(store.snapshot().cursors.length, 1);
});

test("two verified epochs preserve exact bundle, state, receipt, and cursor ancestry", (t) => {
  const context = fixture(t, "two-epochs");
  const store = context.open();
  t.after(() => store.close());
  const first = verified(context);
  const firstResult = commit(store, first);
  const secondMaterial = Buffer.from("rotated-opaque-elgamal-material-epoch-two", "utf8");
  const second = verified(context, first.receipt.stateAfter, { keyMaterial: secondMaterial });
  const secondResult = commit(store, second);
  const snapshot = store.snapshot();

  assert.equal(snapshot.bundles.length, 2);
  assert.equal(snapshot.cursors.length, 2);
  assert.equal(snapshot.bundles[1].epoch, "2");
  assert.equal(
    snapshot.bundles[1].previousBundleSha256,
    snapshot.bundles[0].bundleSha256,
  );
  assert.equal(
    snapshot.bundles[1].stateBeforeSha256,
    snapshot.bundles[0].stateAfterSha256,
  );
  assert.equal(
    snapshot.cursors[1].previousCursorSha256,
    snapshot.cursors[0].cursorSha256,
  );
  assert.equal(
    secondResult.cursorRecord.previousCursorSha256,
    firstResult.cursorRecord.cursorSha256,
  );
  assert.equal(snapshot.currentState.stateSha256, second.receipt.stateAfter.stateSha256);
});

test("structural clones, accessors, and transparent or hostile receipt proxies fail provenance", (t) => {
  const context = fixture(t, "receipt-brand");
  const store = context.open();
  t.after(() => store.close());
  const evidence = verified(context);
  const clonedReceipt = { ...evidence.receipt };
  assert.throws(
    () => commit(store, { ...evidence, receipt: clonedReceipt }),
    /was not issued by this process/u,
  );
  assert.throws(
    () => commit(store, {
      ...evidence,
      receipt: Object.create(evidence.receipt),
    }),
    /was not issued by this process/u,
  );

  let transparentReads = 0;
  const transparentProxy = new Proxy(evidence.receipt, {
    get(target, property, receiver) {
      transparentReads += 1;
      return Reflect.get(target, property, receiver);
    },
  });
  assert.throws(
    () => commit(store, { ...evidence, receipt: transparentProxy }),
    /was not issued by this process/u,
  );
  assert.equal(transparentReads, 0);

  let accessorReads = 0;
  const accessorFake = { ...evidence.receipt };
  Object.defineProperty(accessorFake, "bundleSha256", {
    enumerable: true,
    configurable: true,
    get() {
      accessorReads += 1;
      return evidence.receipt.bundleSha256;
    },
  });
  assert.throws(
    () => commit(store, { ...evidence, receipt: accessorFake }),
    /was not issued by this process/u,
  );
  assert.equal(accessorReads, 0);

  const hostileProxy = new Proxy(evidence.receipt, {
    get() {
      throw new Error("receipt proxy property trap must not run");
    },
    ownKeys() {
      throw new Error("receipt proxy ownKeys trap must not run");
    },
    getOwnPropertyDescriptor() {
      throw new Error("receipt proxy descriptor trap must not run");
    },
  });
  assert.throws(
    () => commit(store, { ...evidence, receipt: hostileProxy }),
    /was not issued by this process/u,
  );
  const revoked = Proxy.revocable(evidence.receipt, {});
  revoked.revoke();
  assert.throws(
    () => commit(store, { ...evidence, receipt: revoked.proxy }),
    /was not issued by this process/u,
  );
  assert.deepEqual(store.snapshot().bundles, []);
});

test("cross-vault, bundle, state, replay, fork, and epoch-skip substitutions fail closed", async (t) => {
  await t.test("cross-vault bundle substitution", (t2) => {
    const left = fixture(t2, "cross-left");
    const right = fixture(t2, "cross-right");
    const leftEvidence = verified(left);
    const rightEvidence = verified(right);
    const store = left.open();
    t2.after(() => store.close());
    assert.throws(
      () => commit(store, {
        bundle: rightEvidence.bundle,
        receipt: leftEvidence.receipt,
      }),
      /COMMIT_BINDING_MISMATCH/u,
    );
  });

  await t.test("same-epoch fork and stale replay", (t2) => {
    const context = fixture(t2, "fork-replay");
    const store = context.open();
    t2.after(() => store.close());
    const first = verified(context);
    commit(store, first);
    const fork = verified(context, context.genesisState, {
      keyMaterial: Buffer.from("forked-opaque-elgamal-material", "utf8"),
    });
    assert.throws(() => commit(store, fork), /REPLAY_OR_FORK_HOLD/u);
    const second = verified(context, first.receipt.stateAfter, {
      keyMaterial: Buffer.from("second-opaque-elgamal-material", "utf8"),
    });
    commit(store, second);
    assert.throws(() => commit(store, first), /REPLAY_OR_FORK_HOLD/u);
  });

  await t.test("verified later epoch cannot skip an empty local mirror", (t2) => {
    const context = fixture(t2, "skip");
    const first = verified(context);
    const second = verified(context, first.receipt.stateAfter, {
      keyMaterial: Buffer.from("later-opaque-elgamal-material", "utf8"),
    });
    const store = context.open();
    t2.after(() => store.close());
    assert.throws(() => commit(store, second), /EPOCH_SKIP_HOLD/u);
    assert.deepEqual(store.snapshot().bundles, []);
  });
});

test("faults before commit roll back both the bundle and cursor", async (t) => {
  for (const fault of [
    PRIVACY_VAULT_RECOVERY_SQLITE_TEST_FAULT.AFTER_BUNDLE_INSERT,
    PRIVACY_VAULT_RECOVERY_SQLITE_TEST_FAULT.AFTER_CURSOR_INSERT,
  ]) {
    await t.test(fault, (t2) => {
      const context = fixture(t2, fault.toLowerCase());
      const evidence = verified(context);
      let store = context.open();
      assert.throws(
        () => commit(store, evidence, fault),
        new RegExp(fault, "u"),
      );
      assert.deepEqual(store.snapshot().bundles, []);
      assert.deepEqual(store.snapshot().cursors, []);
      store.close();
      store = context.open();
      t2.after(() => store.close());
      assert.deepEqual(store.snapshot().bundles, []);
      assert.deepEqual(store.snapshot().cursors, []);
      assert.equal(commit(store, evidence).disposition, "COMMITTED");
    });
  }
});

test("lost response after commit reconciles only by exact durable reopen", (t) => {
  const context = fixture(t, "lost-response");
  const evidence = verified(context);
  let store = context.open();
  assert.throws(
    () => commit(
      store,
      evidence,
      PRIVACY_VAULT_RECOVERY_SQLITE_TEST_FAULT.AFTER_COMMIT_BEFORE_RETURN,
    ),
    /AFTER_COMMIT_BEFORE_RETURN/u,
  );
  assert.equal(store.snapshot().bundles.length, 1);
  assert.equal(store.snapshot().cursors.length, 1);
  store.close();
  store = context.open();
  const reconciled = commit(store, evidence);
  assert.equal(
    reconciled.disposition,
    PRIVACY_VAULT_RECOVERY_SQLITE_DISPOSITION.RECONCILED_EXACT_REPLAY,
  );
  assert.equal(store.snapshot().bundles.length, 1);
});

test("external termination at exact transaction phases reopens empty or complete", async (t) => {
  for (const scenario of ["before-commit", "after-commit"]) {
    await t.test(scenario, async () => {
      const directory = mkdtempSync(join(tmpdir(), `iat-b3-privacy-crash-${scenario}-`));
      t.after(() => rmSync(directory, {
        recursive: true,
        force: true,
        maxRetries: 5,
        retryDelay: 50,
      }));
      const databasePath = join(directory, "recovery.sqlite");
      const instrumentedModulePath = materializeCrashInstrumentedModule(directory, scenario);
      const child = await terminateChildAtInstrumentedCrashPoint({
        databasePath,
        instrumentedModulePath,
        scenario,
      });
      assert.notEqual(child.code, 84, `${child.stdout}\n${child.stderr}`);
      assert.notEqual(child.code, 85, `${child.stdout}\n${child.stderr}`);
      const context = crashContext(scenario);
      const reopened = createPrivacyVaultRecoverySqlite({
        databasePath,
        genesisState: context.genesisState,
      });
      const snapshot = reopened.snapshot();
      const expectedCount = scenario === "before-commit" ? 0 : 1;
      assert.equal(snapshot.bundles.length, expectedCount);
      assert.equal(snapshot.cursors.length, expectedCount);
      const recovered = commit(reopened, context.evidence);
      assert.equal(
        recovered.disposition,
        scenario === "before-commit"
          ? PRIVACY_VAULT_RECOVERY_SQLITE_DISPOSITION.COMMITTED
          : PRIVACY_VAULT_RECOVERY_SQLITE_DISPOSITION.RECONCILED_EXACT_REPLAY,
      );
      assert.equal(reopened.snapshot().bundles.length, 1);
      reopened.close();
    });
  }
});

test("a valid receipt cannot select any production host-termination behavior", (t) => {
  const context = fixture(t, "no-public-hard-exit");
  const store = context.open();
  t.after(() => store.close());
  const evidence = verified(context);
  const deployableSource = readFileSync(SQLITE_MODULE_PATH, "utf8");

  assert.deepEqual(Object.values(PRIVACY_VAULT_RECOVERY_SQLITE_TEST_FAULT), [
    "AFTER_BUNDLE_INSERT",
    "AFTER_CURSOR_INSERT",
    "AFTER_COMMIT_BEFORE_RETURN",
  ]);
  assert.doesNotMatch(deployableSource, /\bprocess\.(?:abort|exit|kill)\s*\(/u);
  assert.doesNotMatch(deployableSource, /HARD_EXIT/u);
  for (const selector of [
    "HARD_EXIT_AFTER_BUNDLE_INSERT",
    "HARD_EXIT_AFTER_DURABLE_COMMIT",
  ]) {
    assert.throws(
      () => commit(store, evidence, selector),
      /test fault is invalid/u,
    );
  }
  assert.deepEqual(store.snapshot().bundles, []);
  assert.equal(
    commit(store, evidence).disposition,
    PRIVACY_VAULT_RECOVERY_SQLITE_DISPOSITION.COMMITTED,
  );
});

test("append-only triggers reject external UPDATE, DELETE, and REPLACE with recursive triggers off", (t) => {
  const context = fixture(t, "external-writer");
  const store = context.open();
  t.after(() => store.close());
  commit(store, verified(context));
  const before = store.snapshot();
  const attacker = new DatabaseSync(context.databasePath, {
    allowExtension: false,
    enableForeignKeyConstraints: true,
  });
  try {
    attacker.exec("PRAGMA recursive_triggers = OFF");
    assert.equal(attacker.prepare("PRAGMA recursive_triggers").get().recursive_triggers, 0);
    for (const table of [
      "privacy_vault_recovery_meta",
      "privacy_vault_recovery_bundle_records",
      "privacy_vault_recovery_cursor_history",
    ]) {
      assert.throws(
        () => attacker.exec(`UPDATE ${table} SET mainnet_status = 'HOLD'`),
        /APPEND_ONLY_UPDATE_FORBIDDEN/u,
      );
      assert.throws(
        () => attacker.exec(`DELETE FROM ${table}`),
        /APPEND_ONLY_DELETE_FORBIDDEN/u,
      );
      assert.throws(
        () => attacker.exec(`INSERT OR REPLACE INTO ${table} SELECT * FROM ${table} LIMIT 1`),
        /APPEND_ONLY_INSERT_CONFLICT_FORBIDDEN/u,
      );
    }
  } finally {
    attacker.close();
  }
  assert.deepEqual(store.snapshot(), before);
  assert.equal(store.externalWriterConfinementVerified, false);
});

test("schema-trigger tamper is detected on reopen without claiming writer confinement", (t) => {
  const context = fixture(t, "schema-tamper");
  const store = context.open();
  commit(store, verified(context));
  store.close();
  const attacker = new DatabaseSync(context.databasePath);
  attacker.exec(
    "DROP TRIGGER privacy_vault_recovery_bundle_records_forbid_conflicting_insert",
  );
  attacker.close();
  assert.throws(
    () => context.open(),
    /SCHEMA_OBJECT_SET_MISMATCH/u,
  );
});

test("separate writer cannot make a rehashed cursor bless a mismatched state-after digest", (t) => {
  const context = fixture(t, "rehashed-state-digest");
  const store = context.open();
  commit(store, verified(context));
  const snapshot = store.snapshot();
  store.close();
  rewriteStateDigestWithExactInternalHashes(
    context.databasePath,
    snapshot.bundles[0],
    snapshot.cursors[0],
  );
  assert.throws(
    () => context.open(),
    /BUNDLE_STATE_BINDING_MISMATCH/u,
  );
});

test("unlisted user schema objects are rejected in the dedicated database", (t) => {
  const context = fixture(t, "extra-object");
  const store = context.open();
  store.close();
  const attacker = new DatabaseSync(context.databasePath);
  attacker.exec("CREATE TABLE unrelated_user_table (value TEXT) STRICT");
  attacker.close();
  assert.throws(
    () => context.open(),
    /SCHEMA_OBJECT_SET_MISMATCH/u,
  );
});

test("supplied-state comparison detects local-behind and fork relationships but never authenticates them", (t) => {
  const context = fixture(t, "comparison");
  const oldStorePath = join(context.directory, "old.sqlite");
  const newStorePath = join(context.directory, "new.sqlite");
  const oldStore = context.open(context.genesisState, oldStorePath);
  const newStore = context.open(context.genesisState, newStorePath);
  t.after(() => oldStore.close());
  t.after(() => newStore.close());
  const first = verified(context);
  commit(oldStore, first);
  commit(newStore, first);
  const second = verified(context, first.receipt.stateAfter, {
    keyMaterial: Buffer.from("comparison-second-key-material", "utf8"),
  });
  commit(newStore, second);

  const behind = oldStore.compareSuppliedState(second.receipt.stateAfter);
  assert.equal(behind.relationship, PRIVACY_VAULT_RECOVERY_SQLITE_RELATIONSHIP.LOCAL_BEHIND);
  assert.equal(behind.localBehindSuppliedStateObserved, true);
  assert.equal(behind.comparisonOnlyNotRollbackProof, true);
  assertHoldBoundary(behind);

  const exact = oldStore.compareSuppliedState(first.receipt.stateAfter);
  assert.equal(exact.relationship, PRIVACY_VAULT_RECOVERY_SQLITE_RELATIONSHIP.EXACT);
  const ahead = newStore.compareSuppliedState(first.receipt.stateAfter);
  assert.equal(ahead.relationship, PRIVACY_VAULT_RECOVERY_SQLITE_RELATIONSHIP.LOCAL_AHEAD);

  const forkEvidence = verified(context, context.genesisState, {
    keyMaterial: Buffer.from("comparison-fork-key-material", "utf8"),
  });
  const fork = oldStore.compareSuppliedState(forkEvidence.receipt.stateAfter);
  assert.equal(fork.relationship, PRIVACY_VAULT_RECOVERY_SQLITE_RELATIONSHIP.SAME_EPOCH_FORK);
  assert.equal(fork.sameEpochForkObserved, true);
  assertHoldBoundary(fork);
});

test("wrong Genesis policy is rejected and secret inputs are never persisted", (t) => {
  const context = fixture(t, "secret-free");
  const evidence = verified(context);
  const store = context.open();
  commit(store, evidence);
  const snapshotText = JSON.stringify(store.snapshot());
  store.close();

  const secretRepresentations = [
    context.recoveryKey.toString("hex"),
    context.recoveryKey.toString("base64url"),
    context.keyMaterial.toString("utf8"),
    context.keyMaterial.toString("hex"),
    context.keyMaterial.toString("base64url"),
  ];
  const persistedPaths = [
    context.databasePath,
    `${context.databasePath}-wal`,
    `${context.databasePath}-shm`,
  ].filter((path) => existsSync(path));
  for (const path of persistedPaths) {
    const databaseBytes = readFileSync(path);
    assert.equal(databaseBytes.includes(context.recoveryKey), false, path);
    assert.equal(databaseBytes.includes(context.keyMaterial), false, path);
    for (const secret of secretRepresentations) {
      assert.equal(snapshotText.includes(secret), false, secret);
      assert.equal(databaseBytes.includes(Buffer.from(secret, "utf8")), false, secret);
    }
  }

  const wrongGenesis = createPrivacyVaultRecoveryGenesisState({
    vaultBindingSha256: digest("wrong-vault"),
    recoveryKeyCommitmentSha256:
      privacyVaultRecoveryKeyCommitmentSha256(context.recoveryKey),
    maximumBundleAgeSeconds: "600",
    maximumFutureSkewSeconds: "30",
  });
  assert.throws(
    () => context.open(wrongGenesis),
    /OPEN_GENESIS_MISMATCH/u,
  );
});

test("file-only, shape, closed-adapter, and truth-promotion attempts fail closed", (t) => {
  const context = fixture(t, "shape-truth");
  assert.throws(
    () => createPrivacyVaultRecoverySqlite({
      databasePath: ":memory:",
      genesisState: context.genesisState,
    }),
    /file-backed/u,
  );
  assert.throws(
    () => createPrivacyVaultRecoverySqlite({
      databasePath: context.databasePath,
      genesisState: context.genesisState,
      activationReady: true,
    }),
    /exact canonical shape/u,
  );
  const evidence = verified(context);
  const store = context.open();
  assert.throws(
    () => store.commitVerifiedBundle({
      bundle: evidence.bundle,
      verificationReceipt: evidence.receipt,
    }),
    /exact canonical shape/u,
  );
  store.close();
  assert.throws(() => store.snapshot(), /SQLITE_CLOSED/u);
  assert.throws(
    () => store.compareSuppliedState(context.genesisState),
    /SQLITE_CLOSED/u,
  );
  assert.throws(
    () => commit(store, evidence),
    /SQLITE_CLOSED/u,
  );
  assert.equal(PRIVACY_VAULT_RECOVERY_SQLITE_MAINNET_STATUS, "HOLD");
  assert.equal(PRIVACY_VAULT_RECOVERY_MAINNET_STATUS, "HOLD");
});

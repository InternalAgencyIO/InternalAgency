import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
  createPrivacyVaultRecoveryGenesisState,
  privacyVaultKeyMaterialCommitmentSha256,
  privacyVaultRecoveryKeyCommitmentSha256,
  sealPrivacyVaultRecoveryBundle,
} from "../programs/iat_b3_reference/privacy-vault-recovery-lifecycle.mjs";
import {
  createPrivacyVaultRecoverySqlite,
} from "../programs/iat_b3_reference/privacy-vault-recovery-sqlite.mjs";
import {
  PRIVACY_VAULT_ROLLBACK_ANCHOR_PROVIDER_OPERATION,
  createPrivacyVaultRollbackAnchorGenesisState,
  createPrivacyVaultRollbackAnchorStatement,
  privacyVaultRollbackAnchorStatementBytes,
} from "../programs/iat_b3_reference/privacy-vault-external-rollback-anchor.mjs";
import {
  PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_DISPOSITION,
  PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_MAINNET_STATUS,
  PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_SCHEMA,
  PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_STATUS,
  assertPrivacyVaultAuthenticatedRecoveryRuntime,
  createPrivacyVaultAuthenticatedRecoveryRuntime,
  validatePrivacyVaultAuthenticatedRecoveryAnchorReceipt,
  validatePrivacyVaultAuthenticatedRecoveryLocalReceipt,
} from "../programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs";

const NOW = 2_000_000_000n;
const MODULE_PATH = fileURLToPath(new URL(
  "../programs/iat_b3_reference/privacy-vault-authenticated-recovery-runtime.mjs",
  import.meta.url,
));
const RACE_HOOK = "__IAT_B3_PRIVACY_RUNTIME_POST_VERIFY_RACE_HOOK__";
const NEGATIVE_FACT_KEYS = Object.freeze([
  "providerAuthenticationVerified",
  "providerIdentityVerified",
  "productionKeyOwnershipVerified",
  "keyRegistryAuthenticityVerified",
  "providerOperationalTruthVerified",
  "externalDurabilityVerified",
  "externalRollbackProtectionVerified",
  "crossSystemAtomicityVerified",
  "runtimeConfinementVerified",
  "onchainRuntimeIntegrationVerified",
  "nativePrivacyVaultPlannerIntegrated",
  "authenticatedSolanaFinalityVerified",
  "securePlatformKeystoreVerified",
  "privacyLegalReviewAccepted",
  "devnetLifecycleVerified",
  "activationReady",
  "mainnetExecutionAuthorized",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function digest(label) {
  return sha256(Buffer.from(`iat-b3-privacy-runtime-test:${label}`, "utf8"));
}

function createKey() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = Buffer.from(publicKey.export({ format: "der", type: "spki" }));
  return {
    privateKey,
    record: {
      keyId: "prod-privacy-runtime-key-2026-a",
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

function trustInput(key, suffix) {
  return {
    environment: "PRODUCTION",
    providerKind: PROVIDER_KINDS.EXTERNAL_CHECKPOINT,
    providerIdentitySha256: digest(`provider:${suffix}`),
    subjectBindingSha256: digest(`subject:${suffix}`),
    receiptDomainId: `iat-b3/external-checkpoint-provider/privacy-runtime-${suffix}/v1`,
    keyRegistryResourceId: `prod-privacy-runtime-registry-${suffix}`,
    ownerProductionKeyEvidenceSha256: digest(`owner-key-evidence:${suffix}`),
    maximumEnvelopeAgeSeconds: "300",
    maximumFutureSkewSeconds: "30",
    maximumKeyOverlapSequences: "1",
    keys: [key.record],
  };
}

function fixture(t, suffix = "default",
  runtimeFactory = createPrivacyVaultAuthenticatedRecoveryRuntime) {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-privacy-runtime-"));
  const adapters = new Set();
  t.after(() => {
    for (const adapter of adapters) adapter.close();
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
  const key = createKey();
  const trustBinding = createProviderTrustBinding(trustInput(key, suffix));
  const recoveryKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 17));
  const genesisState = createPrivacyVaultRecoveryGenesisState({
    vaultBindingSha256: digest(`vault:${suffix}`),
    recoveryKeyCommitmentSha256: privacyVaultRecoveryKeyCommitmentSha256(recoveryKey),
    maximumBundleAgeSeconds: "600",
    maximumFutureSkewSeconds: "30",
  });
  const databasePath = join(directory, "privacy-runtime.sqlite");
  const sqliteAdapter = createPrivacyVaultRecoverySqlite({ databasePath, genesisState });
  adapters.add(sqliteAdapter);
  const providerState = createProviderEnvelopeGenesisState(trustBinding);
  const anchorState = createPrivacyVaultRollbackAnchorGenesisState({
    trustBinding,
    sqliteAdapter,
    anchorNamespaceSha256: digest(`anchor-namespace:${suffix}`),
    maximumAnchorAgeSeconds: "600",
    maximumFutureSkewSeconds: "30",
  });
  const runtime = runtimeFactory({
    trustBinding,
    sqliteAdapter,
    currentProviderState: providerState,
    currentAnchorState: anchorState,
  });
  return {
    directory,
    adapters,
    key,
    trustBinding,
    recoveryKey,
    genesisState,
    databasePath,
    sqliteAdapter,
    providerState,
    anchorState,
    runtime,
  };
}

async function importRaceInstrumentedRuntime() {
  let source = readFileSync(MODULE_PATH, "utf8");
  for (const dependency of [
    "provider-authenticated-envelope.mjs",
    "privacy-vault-recovery-lifecycle.mjs",
    "privacy-vault-recovery-sqlite.mjs",
    "privacy-vault-external-rollback-anchor.mjs",
  ]) {
    const relativeSpecifier = `./${dependency}`;
    const absoluteSpecifier = new URL(
      `../programs/iat_b3_reference/${dependency}`,
      import.meta.url,
    ).href;
    const before = `from "${relativeSpecifier}";`;
    const after = `from "${absoluteSpecifier}";`;
    assert.equal(source.split(before).length - 1, 1, relativeSpecifier);
    source = source.replace(before, after);
  }
  const raceBoundary = "    readBoundLocalState(nextAnchorState);";
  assert.equal(source.split(raceBoundary).length - 1, 1, "race boundary");
  source = source.replace(
    raceBoundary,
    `    globalThis.${RACE_HOOK}();\n${raceBoundary}`,
  );
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

function bundleFor(context, label = "epoch") {
  const keyMaterial = Buffer.from(`opaque-privacy-key-material:${label}`, "utf8");
  const bundle = sealPrivacyVaultRecoveryBundle({
    currentState: context.sqliteAdapter.snapshot().currentState,
    recoveryKeyBytes: context.recoveryKey,
    keyMaterialBytes: keyMaterial,
    createdAtUnixSeconds: NOW - 10n,
    expiresAtUnixSeconds: NOW + 300n,
  });
  return {
    bundle,
    expectedKeyMaterialCommitmentSha256:
      privacyVaultKeyMaterialCommitmentSha256(keyMaterial),
  };
}

function commit(context, label = "epoch") {
  const prepared = bundleFor(context, label);
  const receipt = context.runtime.commitRecoveryBundle({
    ...prepared,
    recoveryKeyBytes: context.recoveryKey,
    evaluationUnixSeconds: NOW,
  });
  return { ...prepared, receipt };
}

function signedExchange(context, prepared, {
  privateKey = context.key.privateKey,
  providerState = context.runtime.snapshot().providerState,
  anchorState = context.runtime.snapshot().anchorState,
  operation = PRIVACY_VAULT_ROLLBACK_ANCHOR_PROVIDER_OPERATION,
  issuedAtUnixSeconds = NOW - 4n,
  expiresAtUnixSeconds = NOW + 120n,
  requestNonceSha256 = prepared.request.requestNonceSha256,
  anchorBytesMutator = (bytes) => bytes,
} = {}) {
  const statement = createPrivacyVaultRollbackAnchorStatement({
    trustBinding: context.trustBinding,
    currentAnchorState: anchorState,
    request: prepared.request,
    observedAtUnixSeconds: (NOW - 5n).toString(),
    expiresAtUnixSeconds: (NOW + 120n).toString(),
  });
  const canonicalAnchorBytes = privacyVaultRollbackAnchorStatementBytes(
    statement,
    context.trustBinding,
  );
  const anchorBytes = anchorBytesMutator(Buffer.from(canonicalAnchorBytes));
  const requestBytes = Buffer.from(prepared.requestBytesBase64url, "base64url");
  const unsignedEnvelope = {
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
    operation,
    sequence: (BigInt(providerState.lastSequence) + 1n).toString(),
    previousEnvelopeSha256: providerState.lastEnvelopeSha256,
    requestNonceSha256,
    requestSha256: sha256(requestBytes),
    responseSha256: sha256(anchorBytes),
    issuedAtUnixSeconds: issuedAtUnixSeconds.toString(),
    expiresAtUnixSeconds: expiresAtUnixSeconds.toString(),
  };
  return {
    anchorBytes,
    providerEnvelope: createProviderSignedEnvelope({
      unsignedEnvelope,
      signatureBase64url: sign(
        null,
        providerEnvelopeSigningBytes(unsignedEnvelope),
        privateKey,
      ).toString("base64url"),
    }),
  };
}

function prepare(context, suffix = "default") {
  return context.runtime.prepareAnchorRequest({
    requestNonceSha256: digest(`request-nonce:${suffix}`),
    requestedAtUnixSeconds: (NOW - 6n).toString(),
  });
}

function assertHeld(value) {
  for (const key of NEGATIVE_FACT_KEYS) assert.equal(value[key], false, key);
  assert.equal(value.mainnetStatus, "HOLD");
}

test("constructor binds only explicit trust, branded SQLite, and supplied HOLD states", (t) => {
  const context = fixture(t, "constructor");
  assert.equal(context.runtime.schema, PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_SCHEMA);
  assert.equal(context.runtime.status, PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_STATUS);
  assert.equal(context.runtime.mainnetStatus,
    PRIVACY_VAULT_AUTHENTICATED_RECOVERY_RUNTIME_MAINNET_STATUS);
  assert.equal(assertPrivacyVaultAuthenticatedRecoveryRuntime(context.runtime), context.runtime);
  assertHeld(context.runtime);
  const snapshot = context.runtime.snapshot();
  assert.equal(snapshot.recoveryEpoch, "0");
  assert.equal(snapshot.processPrivateRuntimeBrandRequired, true);
  assert.equal(snapshot.brandedLocalSqliteBound, true);
  assert.equal(snapshot.localAnchorAncestryChecked, true);
  assertHeld(snapshot);

  assert.throws(
    () => assertPrivacyVaultAuthenticatedRecoveryRuntime({ ...context.runtime }),
    /not process-branded/u,
  );
  let proxyRead = false;
  const proxy = new Proxy(context.runtime, {
    get() {
      proxyRead = true;
      throw new Error("RUNTIME_PROXY_READ");
    },
  });
  assert.throws(
    () => assertPrivacyVaultAuthenticatedRecoveryRuntime(proxy),
    /not process-branded/u,
  );
  assert.equal(proxyRead, false);
  assert.throws(
    () => createPrivacyVaultAuthenticatedRecoveryRuntime({
      trustBinding: context.trustBinding,
      sqliteAdapter: { ...context.sqliteAdapter },
      currentProviderState: context.providerState,
      currentAnchorState: context.anchorState,
    }),
    /not process-branded/u,
  );

  const mutableTrustBinding = structuredClone(context.trustBinding);
  const mutableProviderState = structuredClone(context.providerState);
  const mutableAnchorState = structuredClone(context.anchorState);
  const isolatedRuntime = createPrivacyVaultAuthenticatedRecoveryRuntime({
    trustBinding: mutableTrustBinding,
    sqliteAdapter: context.sqliteAdapter,
    currentProviderState: mutableProviderState,
    currentAnchorState: mutableAnchorState,
  });
  mutableTrustBinding.providerIdentitySha256 = digest("mutated-provider-identity");
  mutableProviderState.lastSequence = "1";
  mutableAnchorState.lastAnchorSequence = "1";
  const isolatedSnapshot = isolatedRuntime.snapshot();
  assert.equal(
    isolatedSnapshot.providerTrustBindingSha256,
    context.trustBinding.trustBindingSha256,
  );
  assert.equal(isolatedSnapshot.providerState.lastSequence, "0");
  assert.equal(isolatedSnapshot.anchorState.lastAnchorSequence, "0");
  assertHeld(isolatedSnapshot);
});

test("runtime verifies encrypted recovery then commits and reads back one atomic local head", (t) => {
  const context = fixture(t, "commit");
  const originalKey = Buffer.from(context.recoveryKey);
  const { bundle, receipt } = commit(context, "commit-1");
  assert.equal(
    receipt.disposition,
    PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_DISPOSITION.COMMITTED,
  );
  assert.equal(receipt.bundleSha256, bundle.bundleSha256);
  assert.equal(receipt.recoveryEpoch, "1");
  assert.equal(receipt.recoveryVerificationExecutedThisProcess, true);
  assert.equal(validatePrivacyVaultAuthenticatedRecoveryLocalReceipt(receipt), receipt);
  assertHeld(receipt);
  context.recoveryKey.fill(0xff);
  const snapshot = context.runtime.snapshot();
  assert.equal(snapshot.recoveryEpoch, "1");
  assert.equal(snapshot.recoveryBundleSha256, bundle.bundleSha256);
  assert.ok(originalKey.some((value) => value !== 0xff));
  assert.doesNotMatch(JSON.stringify(receipt), /opaque-privacy-key-material|recoveryKeyBytes/u);
});

test("wrong key, bundle drift, accessors, and proxies fail before local mutation", (t) => {
  const context = fixture(t, "commit-hostile");
  const prepared = bundleFor(context, "hostile");
  const before = context.sqliteAdapter.snapshot().snapshotSha256;
  assert.throws(
    () => context.runtime.commitRecoveryBundle({
      ...prepared,
      recoveryKeyBytes: Buffer.from(
        [...context.recoveryKey].map((value) => value ^ 0x55),
      ),
      evaluationUnixSeconds: NOW,
    }),
    /recovery key does not match/u,
  );
  const drifted = { ...prepared.bundle, ciphertextBase64url: "AA" };
  assert.throws(
    () => context.runtime.commitRecoveryBundle({
      bundle: drifted,
      recoveryKeyBytes: context.recoveryKey,
      expectedKeyMaterialCommitmentSha256: prepared.expectedKeyMaterialCommitmentSha256,
      evaluationUnixSeconds: NOW,
    }),
  );
  let accessorRead = false;
  const accessorInput = {
    recoveryKeyBytes: context.recoveryKey,
    expectedKeyMaterialCommitmentSha256: prepared.expectedKeyMaterialCommitmentSha256,
    evaluationUnixSeconds: NOW,
  };
  Object.defineProperty(accessorInput, "bundle", {
    enumerable: true,
    get() {
      accessorRead = true;
      throw new Error("BUNDLE_ACCESSOR_READ");
    },
  });
  assert.throws(
    () => context.runtime.commitRecoveryBundle(accessorInput),
    /INVALID_PRIVACY_VAULT_AUTHENTICATED_RECOVERY_COMMIT_INPUT/u,
  );
  assert.equal(accessorRead, false);
  let proxyRead = false;
  const proxy = new Proxy({
    ...prepared,
    recoveryKeyBytes: context.recoveryKey,
    evaluationUnixSeconds: NOW,
  }, {
    getPrototypeOf() {
      proxyRead = true;
      throw new Error("COMMIT_PROXY_READ");
    },
  });
  assert.throws(
    () => context.runtime.commitRecoveryBundle(proxy),
    /INVALID_PRIVACY_VAULT_AUTHENTICATED_RECOVERY_COMMIT_INPUT/u,
  );
  assert.equal(proxyRead, false);
  assert.equal(context.sqliteAdapter.snapshot().snapshotSha256, before);
});

test("durable reopen reconciles only the exact committed head without reasserting crypto", (t) => {
  const context = fixture(t, "reconcile");
  const { bundle } = commit(context, "reconcile-1");
  context.sqliteAdapter.close();
  const reopened = createPrivacyVaultRecoverySqlite({
    databasePath: context.databasePath,
    genesisState: context.genesisState,
  });
  context.adapters.add(reopened);
  const runtime = createPrivacyVaultAuthenticatedRecoveryRuntime({
    trustBinding: context.trustBinding,
    sqliteAdapter: reopened,
    currentProviderState: context.providerState,
    currentAnchorState: context.anchorState,
  });
  const receipt = runtime.reconcileCommittedRecoveryBundle({ bundle });
  assert.equal(
    receipt.disposition,
    PRIVACY_VAULT_AUTHENTICATED_RECOVERY_LOCAL_DISPOSITION.RECONCILED_DURABLE_READBACK,
  );
  assert.equal(receipt.recoveryVerificationExecutedThisProcess, false);
  assert.equal(receipt.storedProcessPrivateVerificationReceiptDigestBound, true);
  assert.equal(validatePrivacyVaultAuthenticatedRecoveryLocalReceipt(receipt), receipt);
  assertHeld(receipt);
  assert.throws(
    () => runtime.reconcileCommittedRecoveryBundle({
      bundle: { ...bundle, bundleSha256: digest("forged-bundle") },
    }),
    /digest mismatch/u,
  );
});

test("prepared canonical request consumes one signed anchor and advances only in-memory states", (t) => {
  const context = fixture(t, "anchor");
  commit(context, "anchor-epoch");
  const prepared = prepare(context, "anchor-1");
  const exchange = signedExchange(context, prepared);
  const receipt = context.runtime.consumeSignedAnchor({
    preparedRequest: prepared,
    ...exchange,
    evaluationUnixSeconds: NOW,
  });
  assert.equal(validatePrivacyVaultAuthenticatedRecoveryAnchorReceipt(receipt), receipt);
  assert.equal(receipt.providerEnvelopeSequence, "1");
  assert.equal(receipt.anchorSequence, "1");
  assert.equal(receipt.cryptographicEnvelopeVerificationExecuted, true);
  assert.equal(receipt.inProcessReplayStatesAdvanced, true);
  assertHeld(receipt);
  const snapshot = context.runtime.snapshot();
  assert.equal(snapshot.providerState.lastSequence, "1");
  assert.equal(snapshot.anchorState.lastAnchorSequence, "1");
  assertHeld(snapshot);
  assert.throws(
    () => context.runtime.consumeSignedAnchor({
      preparedRequest: prepared,
      ...exchange,
      evaluationUnixSeconds: NOW,
    }),
  );
});

test("post-verification writer race rejects without advancing either replay state", async (t) => {
  const instrumented = await importRaceInstrumentedRuntime();
  const context = fixture(
    t,
    "anchor-race",
    instrumented.createPrivacyVaultAuthenticatedRecoveryRuntime,
  );
  commit(context, "anchor-race-epoch");
  const prepared = prepare(context, "anchor-race");
  const exchange = signedExchange(context, prepared);
  let injected = 0;
  globalThis[RACE_HOOK] = () => {
    injected += 1;
    const writer = new DatabaseSync(context.databasePath, {
      allowExtension: false,
      enableForeignKeyConstraints: true,
      enableDoubleQuotedStringLiterals: false,
      timeout: 5_000,
      readBigInts: false,
      returnArrays: false,
      allowBareNamedParameters: false,
      allowUnknownNamedParameters: false,
    });
    try {
      writer.exec(`
        CREATE TABLE privacy_runtime_race_tamper (
          marker INTEGER NOT NULL
        ) STRICT
      `);
    } finally {
      writer.close();
    }
  };
  t.after(() => {
    delete globalThis[RACE_HOOK];
  });

  assert.throws(
    () => context.runtime.consumeSignedAnchor({
      preparedRequest: prepared,
      ...exchange,
      evaluationUnixSeconds: NOW,
    }),
    /SCHEMA_OBJECT_SET_MISMATCH/u,
  );
  assert.equal(injected, 1);

  const cleanupWriter = new DatabaseSync(context.databasePath);
  try {
    cleanupWriter.exec("DROP TABLE privacy_runtime_race_tamper");
  } finally {
    cleanupWriter.close();
  }
  const unchanged = context.runtime.snapshot();
  assert.equal(unchanged.providerState.lastSequence, "0");
  assert.equal(unchanged.anchorState.lastAnchorSequence, "0");
  assertHeld(unchanged);

  globalThis[RACE_HOOK] = () => {};
  const retried = context.runtime.consumeSignedAnchor({
    preparedRequest: prepared,
    ...exchange,
    evaluationUnixSeconds: NOW,
  });
  assert.equal(retried.providerEnvelopeSequence, "1");
  assert.equal(retried.anchorSequence, "1");
  assert.equal(context.runtime.snapshot().providerState.lastSequence, "1");
  assert.equal(context.runtime.snapshot().anchorState.lastAnchorSequence, "1");
  assertHeld(retried);
});

test("prepared requests are runtime-private and reject clones, proxies, and cross-runtime use", (t) => {
  const context = fixture(t, "prepared-brand");
  const prepared = prepare(context, "brand");
  const exchange = signedExchange(context, prepared);
  assert.throws(
    () => context.runtime.consumeSignedAnchor({
      preparedRequest: structuredClone(prepared),
      ...exchange,
      evaluationUnixSeconds: NOW,
    }),
    /PREPARED_REQUEST_NOT_BRANDED/u,
  );
  let proxyRead = false;
  const proxy = new Proxy(prepared, {
    get() {
      proxyRead = true;
      throw new Error("PREPARED_PROXY_READ");
    },
  });
  assert.throws(
    () => context.runtime.consumeSignedAnchor({
      preparedRequest: proxy,
      ...exchange,
      evaluationUnixSeconds: NOW,
    }),
    /PREPARED_REQUEST_NOT_BRANDED/u,
  );
  assert.equal(proxyRead, false);
  const second = fixture(t, "prepared-brand-second");
  assert.throws(
    () => second.runtime.consumeSignedAnchor({
      preparedRequest: prepared,
      ...exchange,
      evaluationUnixSeconds: NOW,
    }),
    /PREPARED_REQUEST_NOT_BRANDED/u,
  );
});

test("signature, response, provider operation, and request-snapshot substitutions fail", (t) => {
  const wrongSignature = fixture(t, "wrong-signature");
  const wrongKey = generateKeyPairSync("ed25519").privateKey;
  const preparedWrongSignature = prepare(wrongSignature, "wrong-signature");
  assert.throws(
    () => wrongSignature.runtime.consumeSignedAnchor({
      preparedRequest: preparedWrongSignature,
      ...signedExchange(wrongSignature, preparedWrongSignature, { privateKey: wrongKey }),
      evaluationUnixSeconds: NOW,
    }),
    /signature/iu,
  );

  const wrongOperation = fixture(t, "wrong-operation");
  const preparedWrongOperation = prepare(wrongOperation, "wrong-operation");
  assert.throws(
    () => wrongOperation.runtime.consumeSignedAnchor({
      preparedRequest: preparedWrongOperation,
      ...signedExchange(wrongOperation, preparedWrongOperation, {
        operation: "CHECKPOINT_COMPARE_AND_SWAP",
      }),
      evaluationUnixSeconds: NOW,
    }),
  );

  const wrongNonce = fixture(t, "wrong-nonce");
  const preparedWrongNonce = prepare(wrongNonce, "wrong-nonce");
  assert.throws(
    () => wrongNonce.runtime.consumeSignedAnchor({
      preparedRequest: preparedWrongNonce,
      ...signedExchange(wrongNonce, preparedWrongNonce, {
        requestNonceSha256: digest("substituted-request-nonce"),
      }),
      evaluationUnixSeconds: NOW,
    }),
    /nonce/iu,
  );

  const expired = fixture(t, "expired");
  const preparedExpired = prepare(expired, "expired");
  assert.throws(
    () => expired.runtime.consumeSignedAnchor({
      preparedRequest: preparedExpired,
      ...signedExchange(expired, preparedExpired),
      evaluationUnixSeconds: NOW + 120n,
    }),
    /TIME_WINDOW/u,
  );

  const responseDrift = fixture(t, "response-drift");
  const preparedResponseDrift = prepare(responseDrift, "response-drift");
  const responseExchange = signedExchange(responseDrift, preparedResponseDrift);
  responseExchange.anchorBytes[responseExchange.anchorBytes.length - 2] ^= 1;
  assert.throws(
    () => responseDrift.runtime.consumeSignedAnchor({
      preparedRequest: preparedResponseDrift,
      ...responseExchange,
      evaluationUnixSeconds: NOW,
    }),
  );

  const staleSnapshot = fixture(t, "stale-snapshot");
  const preparedStale = prepare(staleSnapshot, "stale");
  const staleExchange = signedExchange(staleSnapshot, preparedStale);
  commit(staleSnapshot, "advanced-after-prepare");
  assert.throws(
    () => staleSnapshot.runtime.consumeSignedAnchor({
      preparedRequest: preparedStale,
      ...staleExchange,
      evaluationUnixSeconds: NOW,
    }),
    /SNAPSHOT_MISMATCH|SNAPSHOT_RACE/u,
  );
});

test("a higher anchor rejects an empty local restore while triple supplied rollback stays HOLD", (t) => {
  const context = fixture(t, "rollback");
  commit(context, "rollback-epoch");
  const prepared = prepare(context, "rollback-anchor");
  context.runtime.consumeSignedAnchor({
    preparedRequest: prepared,
    ...signedExchange(context, prepared),
    evaluationUnixSeconds: NOW,
  });
  const advanced = context.runtime.snapshot();

  const emptyPath = join(context.directory, "empty-restore.sqlite");
  const empty = createPrivacyVaultRecoverySqlite({
    databasePath: emptyPath,
    genesisState: context.genesisState,
  });
  context.adapters.add(empty);
  assert.throws(
    () => createPrivacyVaultAuthenticatedRecoveryRuntime({
      trustBinding: context.trustBinding,
      sqliteAdapter: empty,
      currentProviderState: advanced.providerState,
      currentAnchorState: advanced.anchorState,
    }),
    /LOCAL_ROLLBACK|LOCAL_FORK/u,
  );

  const held = createPrivacyVaultAuthenticatedRecoveryRuntime({
    trustBinding: context.trustBinding,
    sqliteAdapter: empty,
    currentProviderState: context.providerState,
    currentAnchorState: context.anchorState,
  });
  assert.equal(held.snapshot().recoveryEpoch, "0");
  assertHeld(held.snapshot());
});

test("runtime receipts cannot be cloned, promoted, or digested into authorization", (t) => {
  const context = fixture(t, "receipt-brand");
  const { receipt } = commit(context, "receipt");
  assert.throws(
    () => validatePrivacyVaultAuthenticatedRecoveryLocalReceipt(structuredClone(receipt)),
    /NOT_EXECUTED/u,
  );
  assert.equal(Object.isFrozen(receipt), true);
  assert.throws(() => {
    receipt.mainnetExecutionAuthorized = true;
  }, TypeError);

  const prepared = prepare(context, "receipt-anchor");
  const anchorReceipt = context.runtime.consumeSignedAnchor({
    preparedRequest: prepared,
    ...signedExchange(context, prepared),
    evaluationUnixSeconds: NOW,
  });
  assert.throws(
    () => validatePrivacyVaultAuthenticatedRecoveryAnchorReceipt({ ...anchorReceipt }),
    /NOT_EXECUTED/u,
  );
  assertHeld(anchorReceipt);
});

test("deployable runtime exposes no signing, private-key, RPC, or activation API", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.doesNotMatch(source, /generateKeyPair|privateKey|providerEnvelopeSigningBytes/u);
  assert.doesNotMatch(source, /\bsign\s*\(|sendTransaction|sendRawTransaction|broadcast/u);
  assert.doesNotMatch(source, /mainnetExecutionAuthorized:\s*true|activationReady:\s*true/u);
  const exports = [...source.matchAll(/export\s+(?:const|function)\s+([A-Za-z0-9_]+)/gu)]
    .map((match) => match[1]);
  assert.ok(exports.includes("createPrivacyVaultAuthenticatedRecoveryRuntime"));
  assert.equal(exports.some((name) => /sign|private|deploy|activate|broadcast/iu.test(name)), false);
});

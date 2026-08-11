import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  verifyPrivacyVaultRecoveryBundle,
} from "../programs/iat_b3_reference/privacy-vault-recovery-lifecycle.mjs";
import {
  createPrivacyVaultRecoverySqlite,
} from "../programs/iat_b3_reference/privacy-vault-recovery-sqlite.mjs";
import {
  PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS,
  PRIVACY_VAULT_ROLLBACK_ANCHOR_PROVIDER_OPERATION,
  PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_SCHEMA,
  PRIVACY_VAULT_ROLLBACK_ANCHOR_STATE_SCHEMA,
  PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_SCHEMA,
  PRIVACY_VAULT_ROLLBACK_ANCHOR_STATUS,
  PRIVACY_VAULT_ROLLBACK_ANCHOR_VERIFICATION_SCHEMA,
  createPrivacyVaultRollbackAnchorGenesisState,
  createPrivacyVaultRollbackAnchorRequest,
  createPrivacyVaultRollbackAnchorStatement,
  parsePrivacyVaultRollbackAnchorRequestBytes,
  parsePrivacyVaultRollbackAnchorStatementBytes,
  privacyVaultRollbackAnchorRequestBytes,
  privacyVaultRollbackAnchorStatementBytes,
  validatePrivacyVaultRollbackAnchorRequest,
  validatePrivacyVaultRollbackAnchorState,
  validatePrivacyVaultRollbackAnchorStatement,
  validatePrivacyVaultRollbackAnchorVerificationReceipt,
  verifyPrivacyVaultExternalRollbackAnchor,
} from "../programs/iat_b3_reference/privacy-vault-external-rollback-anchor.mjs";

const NOW = 2_000_000_000n;
const ZERO_SHA256 = "0".repeat(64);
const MODULE_PATH = fileURLToPath(new URL(
  "../programs/iat_b3_reference/privacy-vault-external-rollback-anchor.mjs",
  import.meta.url,
));

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function digest(label) {
  return sha256(Buffer.from(`iat-b3-privacy-rollback-anchor-test:${label}`, "utf8"));
}

function sha256Canonical(domain, value) {
  return sha256(Buffer.from(JSON.stringify({ domain, value }), "utf8"));
}

function createKey({
  keyId = "prod-privacy-anchor-key-2026-a",
  activationSequence = "1",
  retirementSequence = null,
} = {}) {
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
      activationSequence,
      retirementSequence,
      notBeforeUnixSeconds: (NOW - 3_600n).toString(),
      notAfterUnixSeconds: (NOW + 86_400n).toString(),
      revokedAtUnixSeconds: null,
      compromiseCutoffUnixSeconds: null,
    },
  };
}

function trustInput(key, {
  providerKind = PROVIDER_KINDS.EXTERNAL_CHECKPOINT,
  suffix = "primary",
} = {}) {
  return {
    environment: "PRODUCTION",
    providerKind,
    providerIdentitySha256: digest(`provider-identity:${suffix}`),
    subjectBindingSha256: digest(`privacy-vault-anchor-subject:${suffix}`),
    receiptDomainId: providerKind === PROVIDER_KINDS.EXTERNAL_CHECKPOINT
      ? `iat-b3/external-checkpoint-provider/privacy-vault-anchor-${suffix}/v1`
      : `iat-b3/x-social-evidence-provider/privacy-vault-anchor-${suffix}/v1`,
    keyRegistryResourceId: `prod-privacy-anchor-key-registry-${suffix}`,
    ownerProductionKeyEvidenceSha256: digest(`production-key-evidence:${suffix}`),
    maximumEnvelopeAgeSeconds: "300",
    maximumFutureSkewSeconds: "30",
    maximumKeyOverlapSequences: "1",
    keys: [key.record],
  };
}

function fixture(t, suffix = "default") {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-privacy-anchor-"));
  const stores = new Set();
  t.after(() => {
    for (const store of stores) store.close();
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });
  const key = createKey();
  const trustBinding = createProviderTrustBinding(trustInput(key, { suffix }));
  const recoveryKey = Buffer.from(Array.from({ length: 32 }, (_, index) => index + 31));
  const genesisState = createPrivacyVaultRecoveryGenesisState({
    vaultBindingSha256: digest(`vault:${suffix}`),
    recoveryKeyCommitmentSha256: privacyVaultRecoveryKeyCommitmentSha256(recoveryKey),
    maximumBundleAgeSeconds: "600",
    maximumFutureSkewSeconds: "30",
  });
  const databasePath = join(directory, "privacy-recovery.sqlite");
  const sqliteAdapter = createPrivacyVaultRecoverySqlite({ databasePath, genesisState });
  stores.add(sqliteAdapter);
  const anchorState = createPrivacyVaultRollbackAnchorGenesisState({
    trustBinding,
    sqliteAdapter,
    anchorNamespaceSha256: digest(`anchor-namespace:${suffix}`),
    maximumAnchorAgeSeconds: "600",
    maximumFutureSkewSeconds: "30",
  });
  return {
    directory,
    stores,
    key,
    trustBinding,
    recoveryKey,
    genesisState,
    sqliteAdapter,
    anchorState,
    providerState: createProviderEnvelopeGenesisState(trustBinding),
  };
}

function commitRecovery(context, suffix = "epoch-1") {
  const currentState = context.sqliteAdapter.snapshot().currentState;
  const keyMaterial = Buffer.from(`opaque-elgamal-key-material:${suffix}`, "utf8");
  const bundle = sealPrivacyVaultRecoveryBundle({
    currentState,
    recoveryKeyBytes: context.recoveryKey,
    keyMaterialBytes: keyMaterial,
    createdAtUnixSeconds: NOW - 5n,
    expiresAtUnixSeconds: NOW + 300n,
  });
  const receipt = verifyPrivacyVaultRecoveryBundle({
    currentState,
    bundle,
    recoveryKeyBytes: context.recoveryKey,
    expectedKeyMaterialCommitmentSha256:
      privacyVaultKeyMaterialCommitmentSha256(keyMaterial),
    evaluationUnixSeconds: NOW,
  });
  return context.sqliteAdapter.commitVerifiedBundle({
    bundle,
    verificationReceipt: receipt,
    testFault: null,
  });
}

function providerEnvelope({
  context,
  providerState,
  requestBytes,
  anchorBytes,
  requestNonceSha256,
  privateKey = context.key.privateKey,
  operation = PRIVACY_VAULT_ROLLBACK_ANCHOR_PROVIDER_OPERATION,
  sequence = (BigInt(providerState.lastSequence) + 1n).toString(),
  previousEnvelopeSha256 = providerState.lastEnvelopeSha256,
  issuedAtUnixSeconds = NOW - 4n,
  expiresAtUnixSeconds = NOW + 120n,
} = {}) {
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
    sequence,
    previousEnvelopeSha256,
    requestNonceSha256,
    requestSha256: sha256(requestBytes),
    responseSha256: sha256(anchorBytes),
    issuedAtUnixSeconds: issuedAtUnixSeconds.toString(),
    expiresAtUnixSeconds: expiresAtUnixSeconds.toString(),
  };
  return createProviderSignedEnvelope({
    unsignedEnvelope,
    signatureBase64url: sign(
      null,
      providerEnvelopeSigningBytes(unsignedEnvelope),
      privateKey,
    ).toString("base64url"),
  });
}

function exchange(context, {
  anchorState = context.anchorState,
  providerState = context.providerState,
  requestNonceSha256 = digest(`request-nonce:${anchorState.lastAnchorSequence}`),
  requestedAtUnixSeconds = NOW - 6n,
  observedAtUnixSeconds = NOW - 5n,
  anchorExpiresAtUnixSeconds = NOW + 120n,
  mutateStatement = (value) => value,
  operation,
  privateKey,
  providerSequence,
  previousEnvelopeSha256,
  envelopeIssuedAtUnixSeconds,
  envelopeExpiresAtUnixSeconds,
} = {}) {
  const request = createPrivacyVaultRollbackAnchorRequest({
    trustBinding: context.trustBinding,
    sqliteAdapter: context.sqliteAdapter,
    currentAnchorState: anchorState,
    requestNonceSha256,
    requestedAtUnixSeconds: requestedAtUnixSeconds.toString(),
  });
  const createdStatement = createPrivacyVaultRollbackAnchorStatement({
    trustBinding: context.trustBinding,
    currentAnchorState: anchorState,
    request,
    observedAtUnixSeconds: observedAtUnixSeconds.toString(),
    expiresAtUnixSeconds: anchorExpiresAtUnixSeconds.toString(),
  });
  const statement = mutateStatement(createdStatement);
  const requestBytes = privacyVaultRollbackAnchorRequestBytes(
    request,
    context.trustBinding,
  );
  const anchorBytes = privacyVaultRollbackAnchorStatementBytes(
    statement,
    context.trustBinding,
  );
  return {
    anchorState,
    providerState,
    requestNonceSha256,
    request,
    statement,
    requestBytes,
    anchorBytes,
    providerEnvelope: providerEnvelope({
      context,
      providerState,
      requestBytes,
      anchorBytes,
      requestNonceSha256,
      operation,
      privateKey,
      sequence: providerSequence,
      previousEnvelopeSha256,
      issuedAtUnixSeconds: envelopeIssuedAtUnixSeconds,
      expiresAtUnixSeconds: envelopeExpiresAtUnixSeconds,
    }),
  };
}

function verify(context, value, overrides = {}) {
  return verifyPrivacyVaultExternalRollbackAnchor({
    trustBinding: context.trustBinding,
    currentProviderState: value.providerState,
    providerEnvelope: value.providerEnvelope,
    requestBytes: value.requestBytes,
    anchorBytes: value.anchorBytes,
    expectedRequestNonceSha256: value.requestNonceSha256,
    currentAnchorState: value.anchorState,
    sqliteAdapter: context.sqliteAdapter,
    evaluationUnixSeconds: NOW,
    ...overrides,
  });
}

function rehashStatement(statement, changes = {}) {
  const next = { ...statement, ...changes };
  const { anchorSha256: ignored, ...core } = next;
  void ignored;
  next.anchorSha256 = sha256Canonical(PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_SCHEMA, core);
  return next;
}

function rehashRequest(request, changes = {}) {
  const next = { ...request, ...changes };
  const { requestSha256: ignored, ...core } = next;
  void ignored;
  next.requestSha256 = sha256Canonical(PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_SCHEMA, core);
  return next;
}

function rehashState(state, changes = {}) {
  const next = { ...state, ...changes };
  const { stateSha256: ignored, ...core } = next;
  void ignored;
  next.stateSha256 = sha256Canonical(PRIVACY_VAULT_ROLLBACK_ANCHOR_STATE_SCHEMA, core);
  return next;
}

function assertHoldBoundary(value) {
  for (const key of [
    "providerAuthenticationVerified",
    "providerIdentityVerified",
    "productionKeyOwnershipVerified",
    "keyRegistryAuthenticityVerified",
    "durableAnchorStateVerified",
    "externalDurabilityVerified",
    "trustedExternalMonotonicStorageVerified",
    "externalRollbackProtectionVerified",
    "runtimeIntegrationVerified",
    "privacyLegalReviewAccepted",
    "devnetLifecycleVerified",
    "activationReady",
    "mainnetExecutionAuthorized",
  ]) {
    assert.equal(value[key], false, key);
  }
  assert.equal(value.mainnetStatus, PRIVACY_VAULT_ROLLBACK_ANCHOR_MAINNET_STATUS);
}

test("branded empty SQLite and explicit production trust create only a HOLD genesis", (t) => {
  const context = fixture(t, "genesis");
  assert.equal(context.anchorState.schema, PRIVACY_VAULT_ROLLBACK_ANCHOR_STATE_SCHEMA);
  assert.equal(context.anchorState.status, PRIVACY_VAULT_ROLLBACK_ANCHOR_STATUS);
  assert.equal(context.anchorState.lastAnchorSequence, "0");
  assert.equal(context.anchorState.lastAnchorSha256, ZERO_SHA256);
  assert.equal(context.anchorState.lastRecoveryEpoch, "0");
  assertHoldBoundary(context.anchorState);
  assert.equal(
    validatePrivacyVaultRollbackAnchorState(context.anchorState, context.trustBinding),
    context.anchorState,
  );

  assert.throws(
    () => createPrivacyVaultRollbackAnchorGenesisState({
      trustBinding: context.trustBinding,
      sqliteAdapter: { ...context.sqliteAdapter },
      anchorNamespaceSha256: digest("clone-namespace"),
      maximumAnchorAgeSeconds: "600",
      maximumFutureSkewSeconds: "30",
    }),
    /not process-branded/u,
  );
  let proxyReads = 0;
  const hostileAdapter = new Proxy(context.sqliteAdapter, {
    get() {
      proxyReads += 1;
      throw new Error("must not execute");
    },
    getPrototypeOf() {
      proxyReads += 1;
      throw new Error("must not execute");
    },
  });
  assert.throws(
    () => createPrivacyVaultRollbackAnchorGenesisState({
      trustBinding: context.trustBinding,
      sqliteAdapter: hostileAdapter,
      anchorNamespaceSha256: digest("hostile-proxy-namespace"),
      maximumAnchorAgeSeconds: "600",
      maximumFutureSkewSeconds: "30",
    }),
    /not process-branded/u,
  );
  assert.equal(proxyReads, 0);
  assert.throws(
    () => createPrivacyVaultRollbackAnchorGenesisState({
      trustBinding: context.trustBinding,
      sqliteAdapter: new Proxy(context.sqliteAdapter, {}),
      anchorNamespaceSha256: digest("proxy-namespace"),
      maximumAnchorAgeSeconds: "600",
      maximumFutureSkewSeconds: "30",
    }),
    /not process-branded/u,
  );

  const xKey = createKey({ keyId: "prod-privacy-anchor-key-2026-x" });
  const xTrust = createProviderTrustBinding(trustInput(xKey, {
    providerKind: PROVIDER_KINDS.X_SOCIAL_EVIDENCE,
    suffix: "x-provider",
  }));
  assert.throws(
    () => validatePrivacyVaultRollbackAnchorState(context.anchorState, xTrust),
    /REQUIRES_PRODUCTION_CHECKPOINT_TRUST/u,
  );
});

test("one exact signed anchor binds the branded local snapshot and stays nonactivating", (t) => {
  const context = fixture(t, "first-anchor");
  const value = exchange(context);
  const receipt = verify(context, value);

  assert.equal(receipt.schema, PRIVACY_VAULT_ROLLBACK_ANCHOR_VERIFICATION_SCHEMA);
  assert.equal(receipt.anchorSequence, "1");
  assert.equal(receipt.anchorStateAfter.lastAnchorSha256, receipt.anchorSha256);
  assert.equal(receipt.anchorStateAfter.lastRecoveryEpoch, "0");
  assert.equal(receipt.canonicalRequestVerified, true);
  assert.equal(receipt.canonicalAnchorVerified, true);
  assert.equal(receipt.cryptographicSignatureVerified, true);
  assert.equal(receipt.configuredPublicKeyMatched, true);
  assert.equal(receipt.brandedLocalSnapshotReadVerified, true);
  assert.equal(receipt.localSnapshotExactBindingVerified, true);
  assert.equal(receipt.suppliedAnchorStateAncestryVerified, true);
  assertHoldBoundary(receipt);
  assertHoldBoundary(receipt.anchorStateAfter);
  assert.equal(
    validatePrivacyVaultRollbackAnchorVerificationReceipt(receipt),
    receipt,
  );
});

test("a second anchor binds an advanced recovery cursor and exact ancestry", (t) => {
  const context = fixture(t, "advanced-anchor");
  const first = verify(context, exchange(context));
  commitRecovery(context, "epoch-one");
  const secondExchange = exchange(context, {
    anchorState: first.anchorStateAfter,
    providerState: first.providerStateAfter,
  });
  const second = verify(context, secondExchange);

  assert.equal(second.anchorSequence, "2");
  assert.equal(second.recoveryEpoch, "1");
  assert.equal(second.recoveryCursorRevision, "1");
  assert.notEqual(second.recoveryBundleSha256, ZERO_SHA256);
  assert.notEqual(second.recoveryCursorSha256, ZERO_SHA256);
  assert.equal(second.anchorStateAfter.lastRecoveryStateSha256, second.recoveryStateSha256);
  assert.equal(second.anchorStateAfter.lastRecoveryCursorSha256, second.recoveryCursorSha256);
  assertHoldBoundary(second);
  const falseGenesis = rehashState(second.anchorStateAfter, {
    lastAnchorSequence: "0",
    lastAnchorSha256: ZERO_SHA256,
  });
  assert.throws(
    () => validatePrivacyVaultRollbackAnchorState(falseGenesis, context.trustBinding),
    /GENESIS_PROJECTION_MISMATCH/u,
  );
});

test("provider and anchor replay, skip, fork, and predecessor rollback fail closed", (t) => {
  const context = fixture(t, "replay-fork");
  const firstExchange = exchange(context);
  const first = verify(context, firstExchange);

  assert.throws(
    () => verify(context, firstExchange, {
      currentProviderState: first.providerStateAfter,
      currentAnchorState: first.anchorStateAfter,
    }),
    /REPLAY|MISMATCH|ROLLBACK/u,
  );

  for (const [label, changes] of [
    ["skip", { anchorSequence: "3" }],
    ["predecessor", { previousAnchorSha256: digest("wrong-anchor-predecessor") }],
    ["state-before", { anchorStateBeforeSha256: digest("wrong-state-before") }],
  ]) {
    const next = exchange(context, {
      anchorState: first.anchorStateAfter,
      providerState: first.providerStateAfter,
      mutateStatement: (statement) => rehashStatement(statement, changes),
    });
    assert.throws(() => verify(context, next), /MISMATCH|HOLD/u, label);
  }

  const providerSkip = exchange(context, {
    anchorState: first.anchorStateAfter,
    providerState: first.providerStateAfter,
    providerSequence: "3",
  });
  assert.throws(() => verify(context, providerSkip), /REPLAY_SKIP|SEQUENCE/u);
});

test("a locally restored older database is rejected against a supplied higher anchor", (t) => {
  const context = fixture(t, "restored-rollback");
  const first = verify(context, exchange(context));
  commitRecovery(context, "rollback-epoch");
  const second = verify(context, exchange(context, {
    anchorState: first.anchorStateAfter,
    providerState: first.providerStateAfter,
  }));

  const rolledBackPath = join(context.directory, "rolled-back.sqlite");
  const rolledBack = createPrivacyVaultRecoverySqlite({
    databasePath: rolledBackPath,
    genesisState: context.genesisState,
  });
  context.stores.add(rolledBack);
  assert.throws(
    () => createPrivacyVaultRollbackAnchorRequest({
      trustBinding: context.trustBinding,
      sqliteAdapter: rolledBack,
      currentAnchorState: second.anchorStateAfter,
      requestNonceSha256: digest("rolled-back-request"),
      requestedAtUnixSeconds: (NOW - 6n).toString(),
    }),
    /LOCAL_ROLLBACK_HOLD/u,
  );
});

test("rolling back SQLite plus both supplied states remains an explicit HOLD limitation", (t) => {
  const context = fixture(t, "triple-rollback");
  const original = exchange(context);
  const first = verify(context, original);
  commitRecovery(context, "later-state");
  verify(context, exchange(context, {
    anchorState: first.anchorStateAfter,
    providerState: first.providerStateAfter,
  }));

  const restored = createPrivacyVaultRecoverySqlite({
    databasePath: join(context.directory, "restored-genesis.sqlite"),
    genesisState: context.genesisState,
  });
  context.stores.add(restored);
  const replayed = verify(context, original, { sqliteAdapter: restored });
  assert.equal(replayed.cryptographicSignatureVerified, true);
  assert.equal(replayed.suppliedAnchorStateAncestryVerified, true);
  assertHoldBoundary(replayed);
  assert.equal(replayed.externalRollbackProtectionVerified, false);
});

test("snapshot, nonce, bytes, operation, key, and time substitutions fail closed", async (t) => {
  const context = fixture(t, "substitutions");
  const value = exchange(context);
  const cases = [
    () => verify(context, value, {
      expectedRequestNonceSha256: digest("wrong-nonce"),
    }),
    () => verify(context, value, {
      requestBytes: Buffer.concat([value.requestBytes, Buffer.from(" ")]),
    }),
    () => verify(context, value, {
      anchorBytes: new Uint8Array(value.anchorBytes),
    }),
  ];
  for (const invoke of cases) assert.throws(invoke);

  const casOperation = exchange(context, { operation: "CHECKPOINT_COMPARE_AND_SWAP" });
  assert.throws(() => verify(context, casOperation), /PROVIDER_OPERATION_MISMATCH/u);

  const wrongKey = createKey({ keyId: context.key.record.keyId });
  const wrongSignature = exchange(context, { privateKey: wrongKey.privateKey });
  assert.throws(() => verify(context, wrongSignature), /SIGNATURE_INVALID/u);

  const expired = exchange(context, {
    anchorExpiresAtUnixSeconds: NOW,
    envelopeExpiresAtUnixSeconds: NOW + 120n,
  });
  assert.throws(() => verify(context, expired), /TIME_WINDOW_HOLD/u);

  const envelopeBeforeObservation = exchange(context, {
    envelopeIssuedAtUnixSeconds: NOW - 7n,
  });
  assert.throws(() => verify(context, envelopeBeforeObservation), /TIME_WINDOW_HOLD/u);

  const drift = exchange(context);
  commitRecovery(context, "post-request-drift");
  assert.throws(() => verify(context, drift), /LOCAL_SNAPSHOT_MISMATCH|SAME_EPOCH/u);
});

test("canonical request and statement encodings reject aliases and truth promotion", (t) => {
  const context = fixture(t, "canonical");
  const value = exchange(context);
  assert.equal(value.request.schema, PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_SCHEMA);
  assert.equal(value.statement.schema, PRIVACY_VAULT_ROLLBACK_ANCHOR_STATEMENT_SCHEMA);
  assert.deepEqual(
    parsePrivacyVaultRollbackAnchorRequestBytes(value.requestBytes, context.trustBinding),
    value.request,
  );
  assert.deepEqual(
    parsePrivacyVaultRollbackAnchorStatementBytes(value.anchorBytes, context.trustBinding),
    value.statement,
  );
  assert.throws(
    () => parsePrivacyVaultRollbackAnchorRequestBytes(
      Buffer.concat([Buffer.from(" "), value.requestBytes]),
      context.trustBinding,
    ),
    /canonical/u,
  );
  const duplicateSchema = Buffer.from(
    value.requestBytes.toString("utf8").replace(
      "{",
      `{"schema":${JSON.stringify(PRIVACY_VAULT_ROLLBACK_ANCHOR_REQUEST_SCHEMA)},`,
    ),
    "utf8",
  );
  assert.throws(
    () => parsePrivacyVaultRollbackAnchorRequestBytes(
      duplicateSchema,
      context.trustBinding,
    ),
    /canonical/u,
  );
  assert.throws(
    () => validatePrivacyVaultRollbackAnchorRequest(
      { ...value.request, extra: false },
      context.trustBinding,
    ),
  );
  const invalidRequestPredecessor = rehashRequest(value.request, {
    minimumAnchorSequence: "2",
  });
  assert.throws(
    () => validatePrivacyVaultRollbackAnchorRequest(
      invalidRequestPredecessor,
      context.trustBinding,
    ),
    /SEQUENCE_PREDECESSOR_MISMATCH/u,
  );
  const reorderedRequest = Object.fromEntries(Object.entries(value.request).reverse());
  assert.throws(
    () => validatePrivacyVaultRollbackAnchorRequest(
      reorderedRequest,
      context.trustBinding,
    ),
    /CANONICALIZATION_MISMATCH/u,
  );
  const accessor = { ...value.statement };
  Object.defineProperty(accessor, "anchorSha256", {
    enumerable: true,
    get() {
      throw new Error("must not execute");
    },
  });
  assert.throws(
    () => validatePrivacyVaultRollbackAnchorStatement(accessor, context.trustBinding),
    /INVALID_PRIVACY/u,
  );
  const promoted = rehashStatement(value.statement, { externalRollbackProtectionVerified: true });
  assert.throws(
    () => validatePrivacyVaultRollbackAnchorStatement(promoted, context.trustBinding),
    /TRUTH_BOUNDARY/u,
  );
});

test("receipt provenance rejects clones, accessors, prototypes, and proxies before reads", (t) => {
  const context = fixture(t, "receipt-provenance");
  const receipt = verify(context, exchange(context));
  assert.throws(
    () => validatePrivacyVaultRollbackAnchorVerificationReceipt({ ...receipt }),
    /NOT_EXECUTED/u,
  );
  assert.throws(
    () => validatePrivacyVaultRollbackAnchorVerificationReceipt(
      Object.create(receipt),
    ),
    /NOT_EXECUTED/u,
  );
  let reads = 0;
  const hostile = new Proxy(receipt, {
    get() {
      reads += 1;
      throw new Error("must not execute");
    },
    getPrototypeOf() {
      reads += 1;
      throw new Error("must not execute");
    },
    ownKeys() {
      reads += 1;
      throw new Error("must not execute");
    },
  });
  assert.throws(
    () => validatePrivacyVaultRollbackAnchorVerificationReceipt(hostile),
    /NOT_EXECUTED/u,
  );
  assert.equal(reads, 0);
  assert.throws(
    () => validatePrivacyVaultRollbackAnchorVerificationReceipt(
      JSON.parse(JSON.stringify(receipt)),
    ),
    /NOT_EXECUTED/u,
  );
});

test("state and statement content addressing cannot convert HOLD into production truth", (t) => {
  const context = fixture(t, "truth-boundary");
  const promotedState = rehashState(context.anchorState, {
    providerIdentityVerified: true,
  });
  assert.throws(
    () => validatePrivacyVaultRollbackAnchorState(promotedState, context.trustBinding),
    /TRUTH_BOUNDARY/u,
  );
  const value = exchange(context);
  for (const key of [
    "providerAuthenticationVerified",
    "providerIdentityVerified",
    "productionKeyOwnershipVerified",
    "keyRegistryAuthenticityVerified",
    "durableAnchorStateVerified",
    "externalDurabilityVerified",
    "trustedExternalMonotonicStorageVerified",
    "externalRollbackProtectionVerified",
    "runtimeIntegrationVerified",
    "privacyLegalReviewAccepted",
    "devnetLifecycleVerified",
    "activationReady",
    "mainnetExecutionAuthorized",
  ]) {
    const statement = rehashStatement(value.statement, { [key]: true });
    assert.throws(
      () => validatePrivacyVaultRollbackAnchorStatement(statement, context.trustBinding),
      /TRUTH_BOUNDARY/u,
      key,
    );
  }
});

test("the privacy anchor module exposes no signing or private-key API", () => {
  const source = readFileSync(MODULE_PATH, "utf8");
  assert.doesNotMatch(source, /\b(?:generateKeyPair|privateKey|sign)\s*\(/u);
  assert.doesNotMatch(source, /export\s+(?:const|function)\s+\w*(?:sign|private)/iu);
  assert.match(source, /verifyProviderSignedEnvelope/u);
});

import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_MANIFEST_SHA256,
  createSqliteRewardRollbackAnchorMirror,
} from "../programs/iat_b3_reference/reward-rollback-anchor-sqlite.mjs";
import {
  createCccPrecommitRegistrySnapshot,
  sealRewardCapacityRound,
} from "../programs/iat_b3_reference/reward-capacity-waterfall.mjs";
import {
  REWARD_CAS_ENTITY_KIND,
  REWARD_CAS_GLOBAL_LEDGER_KEY,
  REWARD_CAS_ZERO_SHA256,
  finalizeRewardCapacityRoundCas,
} from "../programs/iat_b3_reference/reward-persistence-cas.mjs";
import { createSqliteRewardPersistenceCas } from "../programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs";
import {
  advanceRewardCasExternalCheckpoint,
  validateRewardCasExternalCheckpoint,
} from "../programs/iat_b3_reference/reward-persistence-checkpoint.mjs";
import { createCheckpointGatedRewardPersistenceCas } from "../programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs";
import {
  REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_MANIFEST_SHA256,
  createSqliteRewardConsumerCursor,
} from "../programs/iat_b3_reference/reward-consumer-cursor-sqlite.mjs";
import {
  REWARD_MATERIALIZED_PROJECTION_EFFECT_SCOPE,
  REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_MANIFEST_SHA256,
  createSqliteRewardMaterializedProjection,
} from "../programs/iat_b3_reference/reward-materialized-projection-sqlite.mjs";
import { REWARD_CONSUMER_SCOPE } from "../programs/iat_b3_reference/reward-consumer-gate.mjs";
import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";
import {
  REWARD_AUTHENTICATED_CONSUMER_DISPOSITION,
  REWARD_AUTHENTICATED_CONSUMER_RECEIPT_SCHEMA,
  REWARD_AUTHENTICATED_CONSUMER_RUNTIME_MAINNET_STATUS,
  REWARD_AUTHENTICATED_CONSUMER_RUNTIME_SCHEMA,
  REWARD_AUTHENTICATED_CONSUMER_RUNTIME_STATUS,
  REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_DISPOSITION,
  REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_RECEIPT_SCHEMA,
  REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_RUNTIME_BINDING_SCHEMA,
  REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_RUNTIME_MAINNET_STATUS,
  REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_RUNTIME_SCHEMA,
  REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_RUNTIME_STATUS,
  createRewardAuthenticatedConsumerRuntime,
  createRewardAuthenticatedConsumerRuntimeBinding,
  createRewardAuthenticatedMaterializedConsumerRuntime,
  createRewardAuthenticatedMaterializedConsumerRuntimeBinding,
  validateRewardAuthenticatedConsumerCompositionReceipt,
  validateRewardAuthenticatedMaterializedConsumerCompositionReceipt,
  validateRewardAuthenticatedMaterializedConsumerRuntimeBinding,
  validateRewardAuthenticatedConsumerRuntimeBinding,
} from "../programs/iat_b3_reference/reward-authenticated-consumer-runtime.mjs";

const NOW = 2_000_000_000n;
const LOCAL_0001_UTC = 1_786_050_060n;
const ROUND_ONE = 1_786_060_800n;
const SCHEDULE = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: LOCAL_0001_UTC - 86_520n,
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-runtime-composition-production-reference",
});
const CURRENT_DAY = protocolLocalDay(LOCAL_0001_UTC);
const ZERO_SHA256 = "0".repeat(64);
const hex = (value) => BigInt(value).toString(16).padStart(64, "0");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function digest(label) {
  return sha256(Buffer.from(`iat-b3-runtime-composition:${label}`, "utf8"));
}

function lawWithDisposition(locked) {
  for (let candidate = 0; candidate <= 0xffff; candidate += 1) {
    const decision = createLockdownDecision({
      localDay: CURRENT_DAY,
      randomnessOutputHex: candidate.toString(16).padStart(64, "0"),
      schedule: SCHEDULE,
    });
    if (decision.locked === locked) {
      return createDailyLawState({
        protocolHeight: 86_520n,
        schedule: SCHEDULE,
        currentDecision: decision,
      });
    }
  }
  throw new Error("test vector search did not find the requested Daily-Law disposition");
}

const OPEN_LAW = lawWithDisposition(false);
const LOCKED_LAW = lawWithDisposition(true);

function laneLedger() {
  const empty = { unlocked: 0n, reserved: 0n, paid: 0n, withdrawn: 0n };
  return {
    lanes: {
      treasury: { unlocked: 1_000n, reserved: 0n, paid: 0n, withdrawn: 0n },
      ecosystem: { ...empty },
      liquidity: { ...empty },
    },
  };
}

function sealedRound(boundaryLedger) {
  return sealRewardCapacityRound({
    dailyLawState: OPEN_LAW,
    fundingRoundAtUnixSeconds: ROUND_ONE,
    sealedAtUnixSeconds: ROUND_ONE,
    obligations: [{
      id: hex(1n),
      priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
      amount: 100n,
      fundingRoundAtUnixSeconds: ROUND_ONE,
      fundingPool: "SHARED_REWARD_RESERVE",
      reservationStatus: "NEW_UNRESERVED",
      chronology: {
        eligibleSequence: 1n,
        activitySequence: 1n,
        nodeSequence: 1n,
        immutableIdentity: "runtime-composition-node-1",
        commitmentDigest: hex(50_001n),
      },
    }],
    ledgerSnapshot: boundaryLedger,
    cccPrecommitRegistrySnapshot: createCccPrecommitRegistrySnapshot({
      fundingRoundAtUnixSeconds: ROUND_ONE,
      commitments: [],
    }),
  });
}

function checkpointSink() {
  let current = null;
  return Object.freeze({
    readCurrent() {
      return current;
    },
    compareAndSwap({ expectedCheckpointRevision, expectedCheckpointSha256, nextCheckpoint }) {
      assert.equal(current?.checkpointRevision ?? 0n, expectedCheckpointRevision);
      assert.equal(current?.checkpointSha256 ?? REWARD_CAS_ZERO_SHA256, expectedCheckpointSha256);
      validateRewardCasExternalCheckpoint(nextCheckpoint);
      current = nextCheckpoint;
    },
  });
}

function finalizationInput(store) {
  const round = store.readEntity(REWARD_CAS_ENTITY_KIND.ROUND, ROUND_ONE.toString());
  const ledger = store.readEntity(
    REWARD_CAS_ENTITY_KIND.LANE_LEDGER,
    REWARD_CAS_GLOBAL_LEDGER_KEY,
  );
  return {
    dailyLawState: OPEN_LAW,
    store,
    fundingRoundAtUnixSeconds: ROUND_ONE,
    expectedRoundRevision: round.revision,
    expectedRoundSha256: round.stateSha256,
    expectedLedgerRevision: ledger.revision,
    expectedLedgerSha256: ledger.stateSha256,
  };
}

function createProviderContext(persistenceIdentitySha256) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = Buffer.from(publicKey.export({ format: "der", type: "spki" }));
  const key = {
    privateKey,
    record: {
      keyId: "prod-reward-anchor-key-2026-primary",
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
  const trustBinding = createProviderTrustBinding({
    environment: "PRODUCTION",
    providerKind: PROVIDER_KINDS.EXTERNAL_CHECKPOINT,
    providerIdentitySha256: digest("checkpoint-provider-identity"),
    subjectBindingSha256: persistenceIdentitySha256,
    receiptDomainId: "iat-b3/external-checkpoint-provider/reward-runtime-primary/v1",
    keyRegistryResourceId: "prod-reward-anchor-key-registry-primary",
    ownerProductionKeyEvidenceSha256: digest("owner-production-key-evidence"),
    maximumEnvelopeAgeSeconds: "300",
    maximumFutureSkewSeconds: "30",
    maximumKeyOverlapSequences: "1",
    keys: [key.record],
  });
  const providerState = createProviderEnvelopeGenesisState(trustBinding);
  const anchorState = createRewardRollbackAnchorGenesisState({
    trustBinding,
    anchorNamespaceSha256: digest("reward-anchor-namespace"),
    persistenceIdentitySha256,
    maximumAnchorAgeSeconds: "600",
    maximumFutureSkewSeconds: "30",
  });
  return { key, trustBinding, providerState, anchorState };
}

function anchorCheckpoint(checkpoint) {
  return {
    persistenceIdentitySha256: checkpoint.persistenceIdentitySha256,
    checkpointRevision: checkpoint.checkpointRevision.toString(),
    checkpointSha256: checkpoint.checkpointSha256,
    previousCheckpointSha256: checkpoint.previousCheckpointSha256,
    casCommitSequence: checkpoint.casCommitSequence.toString(),
    casHeadCommitSha256: checkpoint.casHeadCommitSha256,
  };
}

function signedExchange({
  providerContext,
  checkpoint,
  providerState,
  anchorState,
  timeOffset = 0n,
} = {}) {
  const projectedCheckpoint = anchorCheckpoint(checkpoint);
  const requestNonceSha256 = digest(`request-nonce-${projectedCheckpoint.checkpointRevision}`);
  const request = createRewardRollbackAnchorRequest({
    currentAnchorState: anchorState,
    requestNonceSha256,
    requestedAtUnixSeconds: NOW - 6n + timeOffset,
  });
  const statement = createRewardRollbackAnchorStatement({
    currentAnchorState: anchorState,
    request,
    checkpoint: projectedCheckpoint,
    observedAtUnixSeconds: NOW - 5n + timeOffset,
    expiresAtUnixSeconds: NOW + 120n + timeOffset,
  });
  const requestBytes = rewardRollbackAnchorRequestBytes(request);
  const anchorBytes = rewardRollbackAnchorStatementBytes(statement);
  const unsignedEnvelope = {
    schema: PROVIDER_SIGNED_ENVELOPE_SCHEMA,
    status: PROVIDER_AUTHENTICATION_STATUS,
    environment: "PRODUCTION",
    providerKind: PROVIDER_KINDS.EXTERNAL_CHECKPOINT,
    providerIdentitySha256: providerContext.trustBinding.providerIdentitySha256,
    subjectBindingSha256: providerContext.trustBinding.subjectBindingSha256,
    trustBindingSha256: providerContext.trustBinding.trustBindingSha256,
    receiptDomainSha256: providerContext.trustBinding.receiptDomainSha256,
    trustRootSha256: providerContext.trustBinding.trustRootSha256,
    keyRegistrySnapshotSha256: providerContext.trustBinding.keyRegistrySnapshotSha256,
    keyId: providerContext.key.record.keyId,
    signatureAlgorithm: PROVIDER_SIGNATURE_ALGORITHM,
    operation: REWARD_ROLLBACK_ANCHOR_PROVIDER_OPERATION,
    sequence: (BigInt(providerState.lastSequence) + 1n).toString(),
    previousEnvelopeSha256: providerState.lastEnvelopeSha256,
    requestNonceSha256,
    requestSha256: sha256(requestBytes),
    responseSha256: sha256(anchorBytes),
    issuedAtUnixSeconds: (NOW - 4n + timeOffset).toString(),
    expiresAtUnixSeconds: (NOW + 120n + timeOffset).toString(),
  };
  const signatureBase64url = sign(
    null,
    providerEnvelopeSigningBytes(unsignedEnvelope),
    providerContext.key.privateKey,
  ).toString("base64url");
  const providerEnvelope = createProviderSignedEnvelope({
    unsignedEnvelope,
    signatureBase64url,
  });
  return {
    currentProviderState: providerState,
    currentAnchorState: anchorState,
    providerEnvelope,
    requestBytes,
    anchorBytes,
    expectedRequestNonceSha256: requestNonceSha256,
    evaluationUnixSeconds: NOW + timeOffset,
    checkpoint,
  };
}

function verifyExchange(providerContext, exchange) {
  return verifyRewardExternalRollbackAnchor({
    trustBinding: providerContext.trustBinding,
    currentProviderState: exchange.currentProviderState,
    providerEnvelope: exchange.providerEnvelope,
    requestBytes: exchange.requestBytes,
    anchorBytes: exchange.anchorBytes,
    expectedRequestNonceSha256: exchange.expectedRequestNonceSha256,
    currentAnchorState: exchange.currentAnchorState,
    expectedCheckpoint: anchorCheckpoint(exchange.checkpoint),
    evaluationUnixSeconds: exchange.evaluationUnixSeconds,
  });
}

function projectionInput(targetCommit) {
  return {
    kind: "reward-ledger-projection",
    key: "canonical-reward-state",
    payload: {
      commitSequence: targetCommit.sequence,
      commitSha256: targetCommit.commitSha256,
      operation: targetCommit.operation,
    },
  };
}

function runtimeInput(context, overrides = {}) {
  const commit = context.rewardStore.readCommit(1n);
  return {
    dailyLawState: OPEN_LAW,
    ...context.currentExchange,
    consumerId: context.binding.consumerId,
    scope: REWARD_CONSUMER_SCOPE.LOCAL_PROJECTION,
    targetCommitSequence: commit.sequence,
    targetCommitSha256: commit.commitSha256,
    projection: projectionInput(commit),
    ...overrides,
  };
}

function materializedRuntimeInput(context, overrides = {}) {
  return runtimeInput({ ...context, binding: context.materializedBinding }, overrides);
}

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-authenticated-runtime-"));
  const ledger = laneLedger();
  const baseStore = createSqliteRewardPersistenceCas({
    databasePath: join(directory, "reward-cas.sqlite"),
    initialState: {
      laneLedger: ledger,
      roundStates: [sealedRound(ledger)],
      rewardStates: [],
    },
  });
  const sink = checkpointSink();
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store: baseStore, sink });
  const rewardStore = createCheckpointGatedRewardPersistenceCas({
    store: baseStore,
    checkpointSource: sink,
  });
  const identity = rewardStore.readPersistenceIdentity();
  const providerContext = createProviderContext(identity.persistenceIdentitySha256);
  const rollbackAnchorMirror = createSqliteRewardRollbackAnchorMirror({
    databasePath: join(directory, "rollback-anchor.sqlite"),
    trustBinding: providerContext.trustBinding,
    genesisAnchorState: providerContext.anchorState,
    genesisProviderState: providerContext.providerState,
  });
  const genesisExchange = signedExchange({
    providerContext,
    checkpoint: sink.readCurrent(),
    providerState: providerContext.providerState,
    anchorState: providerContext.anchorState,
  });
  const genesisReceipt = verifyExchange(providerContext, genesisExchange);
  rollbackAnchorMirror.consumeSignedAnchorReceipt({ receipt: genesisReceipt });

  finalizeRewardCapacityRoundCas(finalizationInput(rewardStore));
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store: rewardStore, sink });
  const currentExchange = signedExchange({
    providerContext,
    checkpoint: sink.readCurrent(),
    providerState: genesisReceipt.providerStateAfter,
    anchorState: genesisReceipt.anchorStateAfter,
    timeOffset: 10n,
  });
  const consumerCursor = createSqliteRewardConsumerCursor({
    databasePath: join(directory, "consumer-cursor.sqlite"),
  });
  const materializedProjection = createSqliteRewardMaterializedProjection({
    databasePath: join(directory, "materialized-projection.sqlite"),
  });
  const bindingInput = {
    environment: "PRODUCTION",
    runtimeIdentitySha256: digest("runtime-identity"),
    productionIdentityFreezeManifestSha256: digest("identity-freeze-manifest"),
    productionDeploymentDomainSha256: identity.deploymentDomainSha256,
    productionPersistenceIdentitySha256: identity.persistenceIdentitySha256,
    rewardAdapterSchema: identity.adapterSchema,
    rewardAdapterSchemaVersion: identity.adapterSchemaVersion,
    rewardSchemaManifestSha256: identity.schemaManifestSha256,
    rewardGenesisEntitySetSha256: identity.genesisEntitySetSha256,
    anchorNamespaceSha256: providerContext.anchorState.anchorNamespaceSha256,
    providerTrustBindingSha256: providerContext.trustBinding.trustBindingSha256,
    providerTrustRootSha256: providerContext.trustBinding.trustRootSha256,
    providerKeyRegistrySnapshotSha256:
      providerContext.trustBinding.keyRegistrySnapshotSha256,
    providerReceiptDomainSha256: providerContext.trustBinding.receiptDomainSha256,
    ownerProductionKeyEvidenceSha256:
      providerContext.trustBinding.ownerProductionKeyEvidenceSha256,
    providerReadinessPacketSha256: digest("provider-readiness-packet"),
    failureDomainSeparationEvidenceSha256: digest("failure-domain-separation-evidence"),
    consumerInventoryEvidenceSha256: digest("consumer-inventory-evidence"),
    anchorMirrorSchemaManifestSha256:
      REWARD_ROLLBACK_ANCHOR_SQLITE_SCHEMA_MANIFEST_SHA256,
    consumerCursorSchemaManifestSha256:
      REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_MANIFEST_SHA256,
    consumerId: "reward-projection-v1",
    projectionKind: "reward-ledger-projection",
    projectionKey: "canonical-reward-state",
  };
  const binding = createRewardAuthenticatedConsumerRuntimeBinding(bindingInput);
  const materializedBindingInput = Object.fromEntries(Object.entries(bindingInput).map(
    ([key, value]) => key === "consumerCursorSchemaManifestSha256"
      ? [
        "materializedProjectionSchemaManifestSha256",
        REWARD_MATERIALIZED_PROJECTION_SQLITE_SCHEMA_MANIFEST_SHA256,
      ]
      : [key, value],
  ));
  const materializedBinding = createRewardAuthenticatedMaterializedConsumerRuntimeBinding({
    ...materializedBindingInput,
    consumerId: "reward-materialized-projection-v2",
  });
  const runtime = createRewardAuthenticatedConsumerRuntime({
    runtimeBinding: binding,
    trustBinding: providerContext.trustBinding,
    rewardStore,
    rollbackAnchorMirror,
    consumerCursor,
  });
  const materializedRuntime = createRewardAuthenticatedMaterializedConsumerRuntime({
    runtimeBinding: materializedBinding,
    trustBinding: providerContext.trustBinding,
    rewardStore,
    rollbackAnchorMirror,
    materializedProjection,
  });
  t.after(() => {
    consumerCursor.close();
    materializedProjection.close();
    rollbackAnchorMirror.close();
    rewardStore.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return {
    directory,
    rewardStore,
    sink,
    providerContext,
    rollbackAnchorMirror,
    consumerCursor,
    materializedProjection,
    binding,
    materializedBinding,
    runtime,
    materializedRuntime,
    genesisCheckpoint: genesisExchange.checkpoint,
    currentExchange,
  };
}

function assertHoldBoundary(value) {
  for (const flag of [
    "providerAuthenticationVerified",
    "externalMonotonicityVerified",
    "independentRollbackProtectionVerified",
    "runtimeConfinementVerified",
    "runtimeIntegrationVerified",
    "activationReady",
  ]) assert.equal(value[flag], false, flag);
  assert.equal(value.mainnetStatus, REWARD_AUTHENTICATED_CONSUMER_RUNTIME_MAINNET_STATUS);
  assert.equal(value.mainnetStatus, "HOLD");
}

test("exact signed checkpoint composes durable anchor and local cursor without authorization", (t) => {
  const context = fixture(t);
  assert.equal(context.runtime.schema, REWARD_AUTHENTICATED_CONSUMER_RUNTIME_SCHEMA);
  assert.equal(context.runtime.status, REWARD_AUTHENTICATED_CONSUMER_RUNTIME_STATUS);
  assert.equal(context.runtime.configuredRuntimeBindingMatched, true);
  assertHoldBoundary(context.runtime);

  const receipt = context.runtime.consumeAnchoredLocalProjection(runtimeInput(context));
  assert.equal(receipt.schema, REWARD_AUTHENTICATED_CONSUMER_RECEIPT_SCHEMA);
  assert.equal(receipt.disposition, REWARD_AUTHENTICATED_CONSUMER_DISPOSITION.COMMITTED);
  assert.equal(receipt.anchorSequence, "2");
  assert.equal(receipt.checkpointCommitSequence, "1");
  assert.equal(receipt.targetCommitSequence, 1n);
  for (const flag of [
    "dailyLawGatePassed",
    "configuredRuntimeBindingMatched",
    "cryptographicSignaturePrerequisiteVerified",
    "exactSignedCheckpointMatched",
    "durableLocalAnchorMirrorMatched",
    "durableLocalCursorEventMatched",
  ]) assert.equal(receipt[flag], true, flag);
  assert.equal(receipt.lostResponseReadbackReconciled, false);
  assert.equal(receipt.providerIdentityVerified, false);
  assert.equal(receipt.productionKeyOwnershipVerified, false);
  assert.equal(receipt.keyRegistryAuthenticityVerified, false);
  assert.equal(receipt.externalProviderDurabilityVerified, false);
  assert.equal(receipt.suppliedStateAuthenticityVerified, false);
  assert.equal(receipt.materializedProjectionStateVerified, false);
  assert.equal(receipt.projectionEffectAtomicityVerified, false);
  assert.equal(receipt.externalSideEffectsAuthorized, false);
  assert.equal(receipt.independentReviewAccepted, false);
  assertHoldBoundary(receipt);
  assert.equal(validateRewardAuthenticatedConsumerCompositionReceipt(receipt), receipt);
  assert.throws(
    () => validateRewardAuthenticatedConsumerCompositionReceipt(structuredClone(receipt)),
    /not issued by this process/u,
  );

  const anchorSnapshot = context.rollbackAnchorMirror.snapshot();
  const cursorSnapshot = context.consumerCursor.snapshot();
  assert.equal(anchorSnapshot.receipts.length, 2);
  assert.equal(anchorSnapshot.cursors.length, 2);
  assert.equal(cursorSnapshot.cursors.length, 1);
  assert.equal(cursorSnapshot.projectionEvents.length, 1);
  assert.equal(cursorSnapshot.cursors[0].cursorSha256, receipt.consumerCursorSha256);
  assert.equal(
    cursorSnapshot.projectionEvents[0].eventRecordSha256,
    receipt.projectionEventRecordSha256,
  );
});

test("lost return reconciles exact durable records without duplicate writes", (t) => {
  const context = fixture(t);
  const input = runtimeInput(context);
  const first = context.runtime.consumeAnchoredLocalProjection(input);
  const anchorBefore = context.rollbackAnchorMirror.snapshot();
  const cursorBefore = context.consumerCursor.snapshot();
  const reconciled = context.runtime.consumeAnchoredLocalProjection(input);
  assert.equal(
    reconciled.disposition,
    REWARD_AUTHENTICATED_CONSUMER_DISPOSITION.RECONCILED_AFTER_COMMIT,
  );
  assert.equal(reconciled.lostResponseReadbackReconciled, true);
  assert.equal(reconciled.durableAnchorReceiptRecordSha256, first.durableAnchorReceiptRecordSha256);
  assert.equal(reconciled.consumerCursorSha256, first.consumerCursorSha256);
  assert.equal(reconciled.projectionEventRecordSha256, first.projectionEventRecordSha256);
  assert.deepEqual(context.rollbackAnchorMirror.snapshot(), anchorBefore);
  assert.deepEqual(context.consumerCursor.snapshot(), cursorBefore);
  assertHoldBoundary(reconciled);
});

test("a changed projection cannot be reconciled over an already committed cursor", (t) => {
  const context = fixture(t);
  context.runtime.consumeAnchoredLocalProjection(runtimeInput(context));
  const cursorBefore = context.consumerCursor.snapshot();
  assert.throws(
    () => context.runtime.consumeAnchoredLocalProjection(runtimeInput(context, {
      projection: {
        ...runtimeInput(context).projection,
        payload: { different: "payload" },
      },
    })),
    /COMMITTED_PROJECTION_MISMATCH/u,
  );
  assert.deepEqual(context.consumerCursor.snapshot(), cursorBefore);
});

test("Daily Law denial precedes provider, store, cursor, and accessor reads", (t) => {
  const context = fixture(t);
  const anchorBefore = context.rollbackAnchorMirror.snapshot();
  const cursorBefore = context.consumerCursor.snapshot();
  let hostileRead = false;
  const hostile = { dailyLawState: LOCKED_LAW };
  Object.defineProperty(hostile, "providerEnvelope", {
    enumerable: true,
    get() {
      hostileRead = true;
      throw new Error("HOSTILE_PROVIDER_ACCESSOR_EXECUTED");
    },
  });
  assert.throws(
    () => context.runtime.consumeAnchoredLocalProjection(hostile),
    /IAT_DAILY_LOCKDOWN/u,
  );
  assert.equal(hostileRead, false);
  assert.deepEqual(context.rollbackAnchorMirror.snapshot(), anchorBefore);
  assert.deepEqual(context.consumerCursor.snapshot(), cursorBefore);
});

test("external effect, consumer substitution, and projection namespace fail before persistence", (t) => {
  const context = fixture(t);
  const anchorBefore = context.rollbackAnchorMirror.snapshot();
  const cursorBefore = context.consumerCursor.snapshot();
  for (const [overrides, pattern] of [
    [{ scope: REWARD_CONSUMER_SCOPE.EXTERNAL_EFFECT }, /EXTERNAL_EFFECTS_HOLD/u],
    [{ consumerId: "alternate-consumer" }, /TARGET_BINDING_MISMATCH/u],
    [{ projection: {
      ...runtimeInput(context).projection,
      kind: "alternate-projection",
    } }, /PROJECTION_BINDING_MISMATCH/u],
  ]) {
    assert.throws(
      () => context.runtime.consumeAnchoredLocalProjection(runtimeInput(context, overrides)),
      pattern,
    );
  }
  assert.deepEqual(context.rollbackAnchorMirror.snapshot(), anchorBefore);
  assert.deepEqual(context.consumerCursor.snapshot(), cursorBefore);
});

test("signature, canonical bytes, nonce, and exact local checkpoint substitutions fail closed", (t) => {
  const context = fixture(t);
  const anchorBefore = context.rollbackAnchorMirror.snapshot();
  const cursorBefore = context.consumerCursor.snapshot();
  const input = runtimeInput(context);

  const changedRequest = Buffer.from(input.requestBytes);
  changedRequest[changedRequest.length - 1] ^= 1;
  assert.throws(
    () => context.runtime.consumeAnchoredLocalProjection({ ...input, requestBytes: changedRequest }),
    /canonical|digest|JSON|request/iu,
  );
  assert.throws(
    () => context.runtime.consumeAnchoredLocalProjection({
      ...input,
      expectedRequestNonceSha256: digest("wrong-nonce"),
    }),
    /nonce|request does not match/iu,
  );
  const checkpointFork = {
    ...input.checkpoint,
    casHeadCommitSha256: digest("forked-head"),
  };
  assert.throws(
    () => context.runtime.consumeAnchoredLocalProjection({ ...input, checkpoint: checkpointFork }),
    /CHECKPOINT|DIGEST/u,
  );
  const substitutedSignature = `${input.providerEnvelope.signatureBase64url[0] === "A" ? "B" : "A"}${input.providerEnvelope.signatureBase64url.slice(1)}`;
  const envelope = {
    ...input.providerEnvelope,
    signatureBase64url: substitutedSignature,
  };
  assert.throws(
    () => context.runtime.consumeAnchoredLocalProjection({ ...input, providerEnvelope: envelope }),
    /digest|signature|envelope/iu,
  );
  assert.deepEqual(context.rollbackAnchorMirror.snapshot(), anchorBefore);
  assert.deepEqual(context.consumerCursor.snapshot(), cursorBefore);
});

test("current-state rollback, skip, and wrong trust root cannot reach the cursor", (t) => {
  const context = fixture(t);
  const cursorBefore = context.consumerCursor.snapshot();
  const input = runtimeInput(context);
  const advancedProviderState = verifyExchange(
    context.providerContext,
    context.currentExchange,
  ).providerStateAfter;
  assert.throws(
    () => context.runtime.consumeAnchoredLocalProjection({
      ...input,
      currentProviderState: advancedProviderState,
    }),
    /request does not match|REPLAY|state/iu,
  );
  const wrongContext = createProviderContext(
    context.rewardStore.readPersistenceIdentity().persistenceIdentitySha256,
  );
  const wrongGenesisExchange = signedExchange({
    providerContext: wrongContext,
    checkpoint: context.genesisCheckpoint,
    providerState: wrongContext.providerState,
    anchorState: wrongContext.anchorState,
  });
  const wrongGenesisReceipt = verifyExchange(wrongContext, wrongGenesisExchange);
  const wrongExchange = signedExchange({
    providerContext: wrongContext,
    checkpoint: context.sink.readCurrent(),
    providerState: wrongGenesisReceipt.providerStateAfter,
    anchorState: wrongGenesisReceipt.anchorStateAfter,
    timeOffset: 10n,
  });
  assert.throws(
    () => context.runtime.consumeAnchoredLocalProjection({
      ...input,
      ...wrongExchange,
    }),
    /trust|binding|provider/iu,
  );
  assert.deepEqual(context.consumerCursor.snapshot(), cursorBefore);
});

test("runtime binding is exact, content addressed, and never accepts production truth", (t) => {
  const context = fixture(t);
  assert.equal(validateRewardAuthenticatedConsumerRuntimeBinding(context.binding), context.binding);
  assert.equal(context.binding.productionIdentityEvidenceAccepted, false);
  assertHoldBoundary(context.binding);
  assert.throws(
    () => validateRewardAuthenticatedConsumerRuntimeBinding({
      ...context.binding,
      runtimeIdentitySha256: digest("substituted-runtime"),
    }),
    /DIGEST_MISMATCH/u,
  );
  const bindingInput = Object.fromEntries(Object.entries(context.binding).filter(([key]) => ![
    "schema",
    "status",
    "productionIdentityEvidenceAccepted",
    "providerAuthenticationVerified",
    "externalMonotonicityVerified",
    "independentRollbackProtectionVerified",
    "runtimeConfinementVerified",
    "runtimeIntegrationVerified",
    "independentReviewAccepted",
    "activationReady",
    "mainnetStatus",
    "runtimeBindingSha256",
  ].includes(key)));
  assert.throws(
    () => createRewardAuthenticatedConsumerRuntimeBinding({
      ...bindingInput,
      environment: "TEST_FIXTURE",
    }),
    /requires PRODUCTION/u,
  );
  assert.throws(
    () => createRewardAuthenticatedConsumerRuntimeBinding({
      ...bindingInput,
      providerReadinessPacketSha256: ZERO_SHA256,
    }),
    /must not be zero/u,
  );
});

test("constructor rejects raw stores, substituted trust, unknown options, and lookalike cursors", (t) => {
  const context = fixture(t);
  const options = {
    runtimeBinding: context.binding,
    trustBinding: context.providerContext.trustBinding,
    rewardStore: context.rewardStore,
    rollbackAnchorMirror: context.rollbackAnchorMirror,
    consumerCursor: context.consumerCursor,
  };
  assert.throws(
    () => createRewardAuthenticatedConsumerRuntime({ ...options, extra: true }),
    /INVALID_REWARD_AUTHENTICATED_CONSUMER_RUNTIME_OPTIONS/u,
  );
  const other = createProviderContext(
    context.rewardStore.readPersistenceIdentity().persistenceIdentitySha256,
  );
  assert.throws(
    () => createRewardAuthenticatedConsumerRuntime({
      ...options,
      trustBinding: other.trustBinding,
    }),
    /TRUST_BINDING_MISMATCH/u,
  );
  assert.throws(
    () => createRewardAuthenticatedConsumerRuntime({
      ...options,
      rewardStore: Object.freeze({
        ...context.rewardStore,
        checkpointGateSchema: "lookalike",
      }),
    }),
    /process-branded adapter/u,
  );
  assert.throws(
    () => createRewardAuthenticatedConsumerRuntime({
      ...options,
      consumerCursor: Object.freeze({
        ...context.consumerCursor,
        schemaManifestSha256: digest("lookalike-cursor"),
      }),
    }),
    /process-branded SQLite adapter/u,
  );
});

test("constructor rejects exact-property clones, bound aliases, proxies, and prototypes before reads", (t) => {
  const context = fixture(t);
  const options = {
    runtimeBinding: context.binding,
    trustBinding: context.providerContext.trustBinding,
    rewardStore: context.rewardStore,
    rollbackAnchorMirror: context.rollbackAnchorMirror,
    consumerCursor: context.consumerCursor,
  };
  const cases = [
    {
      key: "rewardStore",
      adapter: context.rewardStore,
      methods: ["readPersistenceIdentity", "snapshot"],
      error: /process-branded adapter/u,
    },
    {
      key: "rollbackAnchorMirror",
      adapter: context.rollbackAnchorMirror,
      methods: [
        "readHead",
        "snapshot",
        "consumeSignedAnchorReceipt",
        "compareWithSuppliedAnchorState",
      ],
      error: /process-branded SQLite adapter/u,
    },
    {
      key: "consumerCursor",
      adapter: context.consumerCursor,
      methods: ["readCursor", "readProjectionEvent", "snapshot", "consumePermit"],
      error: /process-branded SQLite adapter/u,
    },
  ];
  let hostileRead = false;
  for (const { key, adapter, methods, error } of cases) {
    const boundAliases = Object.fromEntries(methods.map((method) => (
      [method, adapter[method].bind(adapter)]
    )));
    const accessorFake = {};
    Object.defineProperty(accessorFake, "status", {
      enumerable: true,
      get() {
        hostileRead = true;
        throw new Error("AUTHENTICATED_RUNTIME_ADAPTER_ACCESSOR_EXECUTED");
      },
    });
    const proxy = new Proxy(adapter, {
      get() {
        hostileRead = true;
        throw new Error("AUTHENTICATED_RUNTIME_ADAPTER_PROXY_EXECUTED");
      },
    });
    const candidates = [
      Object.freeze({ ...adapter }),
      Object.freeze({ ...adapter, ...boundAliases }),
      Object.create(adapter),
      accessorFake,
      proxy,
    ];
    for (const candidate of candidates) {
      assert.throws(
        () => createRewardAuthenticatedConsumerRuntime({
          ...options,
          [key]: candidate,
        }),
        error,
      );
    }
  }
  assert.equal(hostileRead, false);
});

test("input extra fields, symbols, prototypes, and accessors fail without persistence", (t) => {
  const context = fixture(t);
  const canonical = runtimeInput(context);
  const anchorBefore = context.rollbackAnchorMirror.snapshot();
  const cursorBefore = context.consumerCursor.snapshot();
  assert.throws(
    () => context.runtime.consumeAnchoredLocalProjection({ ...canonical, extra: true }),
    /INVALID_REWARD_AUTHENTICATED_CONSUMER_RUNTIME_INPUT/u,
  );
  const symbolInput = { ...canonical, [Symbol("extra")]: true };
  assert.throws(
    () => context.runtime.consumeAnchoredLocalProjection(symbolInput),
    /INVALID_REWARD_AUTHENTICATED_CONSUMER_RUNTIME_INPUT/u,
  );
  const prototypeInput = Object.assign(Object.create({ inherited: true }), canonical);
  assert.throws(
    () => context.runtime.consumeAnchoredLocalProjection(prototypeInput),
    /INVALID_REWARD_AUTHENTICATED_CONSUMER_RUNTIME_INPUT/u,
  );
  let projectionAccessorRead = false;
  const projection = {
    kind: context.binding.projectionKind,
    key: context.binding.projectionKey,
  };
  Object.defineProperty(projection, "payload", {
    enumerable: true,
    get() {
      projectionAccessorRead = true;
      throw new Error("PROJECTION_ACCESSOR_EXECUTED");
    },
  });
  assert.throws(
    () => context.runtime.consumeAnchoredLocalProjection({ ...canonical, projection }),
    /INVALID_REWARD_AUTHENTICATED_CONSUMER_PROJECTION/u,
  );
  assert.equal(projectionAccessorRead, false);
  assert.deepEqual(context.rollbackAnchorMirror.snapshot(), anchorBefore);
  assert.deepEqual(context.consumerCursor.snapshot(), cursorBefore);
});

test("authenticated materialized runtime atomically commits canonical local state under HOLD", (t) => {
  const context = fixture(t);
  assert.equal(
    context.materializedBinding.schema,
    REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_RUNTIME_BINDING_SCHEMA,
  );
  assert.equal(
    validateRewardAuthenticatedMaterializedConsumerRuntimeBinding(
      context.materializedBinding,
    ),
    context.materializedBinding,
  );
  assert.deepEqual(context.materializedProjection.snapshot().cursors, []);
  assert.deepEqual(context.materializedProjection.snapshot().projectionEvents, []);
  assert.deepEqual(context.materializedProjection.snapshot().materializedStates, []);
  assert.equal(
    context.materializedRuntime.schema,
    REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_RUNTIME_SCHEMA,
  );
  assert.equal(
    context.materializedRuntime.status,
    REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_RUNTIME_STATUS,
  );
  assert.equal(context.materializedRuntime.materializedProjectionStateVerified, false);
  assert.equal(context.materializedRuntime.projectionEffectAtomicityVerified, false);
  assert.equal(
    context.materializedRuntime.projectionEffectScope,
    REWARD_MATERIALIZED_PROJECTION_EFFECT_SCOPE,
  );
  assert.equal(context.materializedRuntime.crossDatabaseAnchorProjectionAtomicityVerified, false);
  assert.equal(context.materializedRuntime.runtimeAuthenticationVerified, false);
  assert.equal(
    context.materializedRuntime.mainnetStatus,
    REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_RUNTIME_MAINNET_STATUS,
  );

  const receipt = context.materializedRuntime.consumeAnchoredMaterializedProjection(
    materializedRuntimeInput(context),
  );
  assert.equal(receipt.schema, REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_RECEIPT_SCHEMA);
  assert.equal(
    receipt.disposition,
    REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_DISPOSITION.COMMITTED,
  );
  assert.equal(receipt.durableLocalMaterializedProjectionMatched, true);
  assert.equal(receipt.materializedProjectionStateVerified, true);
  assert.equal(receipt.projectionEffectAtomicityVerified, true);
  assert.equal(receipt.projectionEffectScope, REWARD_MATERIALIZED_PROJECTION_EFFECT_SCOPE);
  assert.equal(receipt.exactReplayReadbackReconciled, false);
  for (const flag of [
    "providerAuthenticationVerified",
    "providerIdentityVerified",
    "productionKeyOwnershipVerified",
    "keyRegistryAuthenticityVerified",
    "externalProviderDurabilityVerified",
    "externalMonotonicityVerified",
    "independentRollbackProtectionVerified",
    "suppliedStateAuthenticityVerified",
    "externalRollbackAnchorVerified",
    "crossDatabaseAnchorProjectionAtomicityVerified",
    "runtimeAuthenticationVerified",
    "runtimeConfinementVerified",
    "runtimeIntegrationVerified",
    "externalSideEffectsAuthorized",
    "independentReviewAccepted",
    "activationReady",
  ]) assert.equal(receipt[flag], false, flag);
  assert.equal(
    validateRewardAuthenticatedMaterializedConsumerCompositionReceipt(receipt),
    receipt,
  );
  assert.throws(
    () => validateRewardAuthenticatedMaterializedConsumerCompositionReceipt({
      ...structuredClone(receipt),
      mainnetStatus: "READY",
    }),
    /not issued by this process/u,
  );

  const snapshot = context.materializedProjection.snapshot();
  assert.equal(snapshot.cursors.length, 1);
  assert.equal(snapshot.projectionEvents.length, 1);
  assert.equal(snapshot.materializedStates.length, 1);
  assert.equal(snapshot.cursors[0].cursorSha256, receipt.materializedCursorSha256);
  assert.equal(
    snapshot.projectionEvents[0].eventRecordSha256,
    receipt.materializedProjectionEventRecordSha256,
  );
  assert.equal(
    snapshot.materializedStates[0].materializedStateSha256,
    receipt.materializedStateSha256,
  );
});

test("authenticated materialized runtime reconciles exact retry without duplicate writes", (t) => {
  const context = fixture(t);
  const input = materializedRuntimeInput(context);
  const first = context.materializedRuntime.consumeAnchoredMaterializedProjection(input);
  const anchorBefore = context.rollbackAnchorMirror.snapshot();
  const projectionBefore = context.materializedProjection.snapshot();
  const replay = context.materializedRuntime.consumeAnchoredMaterializedProjection(input);
  assert.equal(
    replay.disposition,
    REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_DISPOSITION.RECONCILED_EXACT_REPLAY,
  );
  assert.equal(replay.exactReplayReadbackReconciled, true);
  assert.equal(replay.materializedCursorSha256, first.materializedCursorSha256);
  assert.equal(replay.materializedStateSha256, first.materializedStateSha256);
  assert.deepEqual(context.rollbackAnchorMirror.snapshot(), anchorBefore);
  assert.deepEqual(context.materializedProjection.snapshot(), projectionBefore);
});

test("materialized runtime constructor rejects every unbranded adapter without candidate reads", (t) => {
  const context = fixture(t);
  const options = {
    runtimeBinding: context.materializedBinding,
    trustBinding: context.providerContext.trustBinding,
    rewardStore: context.rewardStore,
    rollbackAnchorMirror: context.rollbackAnchorMirror,
    materializedProjection: context.materializedProjection,
  };
  const materializedBindingInput = Object.fromEntries(
    Object.entries(context.materializedBinding).filter(([key]) => ![
      "schema",
      "status",
      "productionIdentityEvidenceAccepted",
      "providerAuthenticationVerified",
      "externalMonotonicityVerified",
      "independentRollbackProtectionVerified",
      "runtimeConfinementVerified",
      "runtimeIntegrationVerified",
      "independentReviewAccepted",
      "activationReady",
      "mainnetStatus",
      "runtimeBindingSha256",
    ].includes(key)),
  );
  const cursorManifestBinding = createRewardAuthenticatedMaterializedConsumerRuntimeBinding({
    ...materializedBindingInput,
    materializedProjectionSchemaManifestSha256:
      REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_MANIFEST_SHA256,
  });
  assert.throws(
    () => createRewardAuthenticatedMaterializedConsumerRuntime({
      ...options,
      runtimeBinding: cursorManifestBinding,
    }),
    /projection adapter/u,
  );
  assert.throws(
    () => validateRewardAuthenticatedMaterializedConsumerRuntimeBinding({
      ...context.materializedBinding,
      materializedProjectionSchemaManifestSha256:
        REWARD_CONSUMER_CURSOR_SQLITE_SCHEMA_MANIFEST_SHA256,
    }),
    /DIGEST_MISMATCH/u,
  );
  const adapter = context.materializedProjection;
  const boundAliases = Object.freeze({
    ...adapter,
    readCursor: adapter.readCursor.bind(adapter),
    readProjectionEvent: adapter.readProjectionEvent.bind(adapter),
    readMaterializedProjection: adapter.readMaterializedProjection.bind(adapter),
    snapshot: adapter.snapshot.bind(adapter),
    consumePermit: adapter.consumePermit.bind(adapter),
  });
  let hostileRead = false;
  const accessorFake = {};
  Object.defineProperty(accessorFake, "status", {
    enumerable: true,
    get() {
      hostileRead = true;
      throw new Error("MATERIALIZED_RUNTIME_ACCESSOR_EXECUTED");
    },
  });
  const hostileProxy = new Proxy(adapter, {
    get() {
      hostileRead = true;
      throw new Error("MATERIALIZED_RUNTIME_PROXY_EXECUTED");
    },
  });
  const { proxy: revokedProxy, revoke } = Proxy.revocable(adapter, {});
  revoke();
  for (const candidate of [
    Object.freeze({ ...adapter }),
    boundAliases,
    Object.create(adapter),
    accessorFake,
    new Proxy(adapter, {}),
    hostileProxy,
    revokedProxy,
  ]) {
    assert.throws(
      () => createRewardAuthenticatedMaterializedConsumerRuntime({
        ...options,
        materializedProjection: candidate,
      }),
      /process-branded SQLite adapter/u,
    );
  }
  assert.equal(hostileRead, false);
});

test("byte payloads remain detached across V1 and materialized commit, reopen, and replay", (t) => {
  const context = fixture(t);
  const v1Buffer = Buffer.from([1, 2, 3, 4]);
  const v1Typed = new Uint8Array([5, 6, 7, 8]);
  context.runtime.consumeAnchoredLocalProjection(runtimeInput(context, {
    projection: {
      kind: context.binding.projectionKind,
      key: context.binding.projectionKey,
      payload: { v1Buffer, v1Typed },
    },
  }));
  v1Buffer[0] = 99;
  v1Typed[0] = 99;
  const v1Payload = context.consumerCursor.snapshot().projectionEvents[0].payload;
  assert.deepEqual([...v1Payload.v1Buffer], [1, 2, 3, 4]);
  assert.deepEqual([...v1Payload.v1Typed], [5, 6, 7, 8]);
  context.consumerCursor.close();
  const reopenedV1Cursor = createSqliteRewardConsumerCursor({
    databasePath: join(context.directory, "consumer-cursor.sqlite"),
  });
  t.after(() => reopenedV1Cursor.close());
  const reopenedV1Runtime = createRewardAuthenticatedConsumerRuntime({
    runtimeBinding: context.binding,
    trustBinding: context.providerContext.trustBinding,
    rewardStore: context.rewardStore,
    rollbackAnchorMirror: context.rollbackAnchorMirror,
    consumerCursor: reopenedV1Cursor,
  });
  const v1Replay = reopenedV1Runtime.consumeAnchoredLocalProjection(runtimeInput(context, {
    projection: {
      kind: context.binding.projectionKind,
      key: context.binding.projectionKey,
      payload: {
        v1Buffer: Buffer.from([1, 2, 3, 4]),
        v1Typed: new Uint8Array([5, 6, 7, 8]),
      },
    },
  }));
  assert.equal(
    v1Replay.disposition,
    REWARD_AUTHENTICATED_CONSUMER_DISPOSITION.RECONCILED_AFTER_COMMIT,
  );
  assert.equal(v1Replay.lostResponseReadbackReconciled, true);
  reopenedV1Cursor.close();

  const materializedBuffer = Buffer.from([9, 10, 11, 12]);
  const materializedTyped = new Uint8Array([13, 14, 15, 16]);
  const input = materializedRuntimeInput(context, {
    projection: {
      kind: context.materializedBinding.projectionKind,
      key: context.materializedBinding.projectionKey,
      payload: { materializedBuffer, materializedTyped },
    },
  });
  const first = context.materializedRuntime.consumeAnchoredMaterializedProjection(input);
  materializedBuffer[0] = 99;
  materializedTyped[0] = 99;
  let state = context.materializedProjection.readMaterializedProjection(
    context.materializedBinding.consumerId,
    context.materializedBinding.projectionKind,
    context.materializedBinding.projectionKey,
  );
  assert.deepEqual([...state.payload.materializedBuffer], [9, 10, 11, 12]);
  assert.deepEqual([...state.payload.materializedTyped], [13, 14, 15, 16]);

  context.materializedProjection.close();
  const reopened = createSqliteRewardMaterializedProjection({
    databasePath: join(context.directory, "materialized-projection.sqlite"),
  });
  t.after(() => reopened.close());
  const reopenedRuntime = createRewardAuthenticatedMaterializedConsumerRuntime({
    runtimeBinding: context.materializedBinding,
    trustBinding: context.providerContext.trustBinding,
    rewardStore: context.rewardStore,
    rollbackAnchorMirror: context.rollbackAnchorMirror,
    materializedProjection: reopened,
  });
  state = reopened.readMaterializedProjection(
    context.materializedBinding.consumerId,
    context.materializedBinding.projectionKind,
    context.materializedBinding.projectionKey,
  );
  assert.deepEqual([...state.payload.materializedBuffer], [9, 10, 11, 12]);
  assert.deepEqual([...state.payload.materializedTyped], [13, 14, 15, 16]);
  const replay = reopenedRuntime.consumeAnchoredMaterializedProjection(
    materializedRuntimeInput(context, {
      projection: {
        kind: context.materializedBinding.projectionKind,
        key: context.materializedBinding.projectionKey,
        payload: {
          materializedBuffer: Buffer.from([9, 10, 11, 12]),
          materializedTyped: new Uint8Array([13, 14, 15, 16]),
        },
      },
    }),
  );
  assert.equal(
    replay.disposition,
    REWARD_AUTHENTICATED_MATERIALIZED_CONSUMER_DISPOSITION.RECONCILED_EXACT_REPLAY,
  );
  assert.equal(replay.materializedStateSha256, first.materializedStateSha256);
  reopened.close();
});

test("materialized path rejects Daily Law and signature failures before local projection writes", (t) => {
  const context = fixture(t);
  const projectionBefore = context.materializedProjection.snapshot();
  let hostileRead = false;
  const hostile = { dailyLawState: LOCKED_LAW };
  Object.defineProperty(hostile, "providerEnvelope", {
    enumerable: true,
    get() {
      hostileRead = true;
      throw new Error("MATERIALIZED_PROVIDER_ACCESSOR_EXECUTED");
    },
  });
  assert.throws(
    () => context.materializedRuntime.consumeAnchoredMaterializedProjection(hostile),
    /IAT_DAILY_LOCKDOWN/u,
  );
  assert.equal(hostileRead, false);
  const input = materializedRuntimeInput(context);
  const providerEnvelope = {
    ...input.providerEnvelope,
    signatureBase64url:
      `${input.providerEnvelope.signatureBase64url[0] === "A" ? "B" : "A"}`
      + input.providerEnvelope.signatureBase64url.slice(1),
  };
  assert.throws(
    () => context.materializedRuntime.consumeAnchoredMaterializedProjection({
      ...input,
      providerEnvelope,
    }),
    /digest|signature|envelope/iu,
  );
  assert.deepEqual(context.materializedProjection.snapshot(), projectionBefore);
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { encodeBase58 } from "../engagement/solana-wallet-proof.mjs";
import {
  allocateRewardCapacity,
  applyXBoundFundingOutcome,
  buildXBoundFundingObligation,
  createCccPrecommitRegistrySnapshot,
  createXBoundReward,
  sealRewardCapacityRound,
} from "../programs/iat_b3_reference/reward-capacity-waterfall.mjs";
import {
  REWARD_CAS_ENTITY_KIND,
  REWARD_CAS_GLOBAL_LEDGER_KEY,
  REWARD_CAS_ZERO_SHA256,
  finalizeRewardCapacityRoundCas,
  recordPremiumUpgradeCas,
  rewardCasStateSha256,
} from "../programs/iat_b3_reference/reward-persistence-cas.mjs";
import {
  REWARD_CAS_EXTERNAL_CHECKPOINT_DISPOSITION,
  REWARD_CAS_EXTERNAL_CHECKPOINT_MAINNET_STATUS,
  REWARD_CAS_EXTERNAL_CHECKPOINT_STATUS,
  REWARD_CAS_EXTERNAL_NAMESPACE,
  REWARD_CAS_EXTERNAL_NAMESPACE_SHA256,
  REWARD_CAS_EXTERNAL_TRUST_POLICY,
  REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256,
  advanceRewardCasExternalCheckpoint,
  createRewardCasPersistenceIdentity,
  prepareRewardCasExternalCheckpointAdvance,
  validateRewardCasExternalCheckpoint,
  validateRewardCasExternalCheckpointPlan,
  validateRewardCasPersistenceIdentity,
  verifyRewardCasSnapshotAgainstExternalCheckpoint,
} from "../programs/iat_b3_reference/reward-persistence-checkpoint.mjs";
import { createSqliteRewardPersistenceCas } from "../programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs";
import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";

const LOCAL_0001_UTC = 1_786_050_060n;
const FUNDING_ROUND = 1_786_060_800n;
const TEST_SCHEDULE = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: LOCAL_0001_UTC - 86_520n,
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-testnet-1",
});
const CURRENT_DAY = protocolLocalDay(LOCAL_0001_UTC);
const OPEN_LAW = createDailyLawState({
  protocolHeight: 86_520n,
  schedule: TEST_SCHEDULE,
  currentDecision: createLockdownDecision({
    localDay: CURRENT_DAY,
    randomnessOutputHex: "00".repeat(32),
    schedule: TEST_SCHEDULE,
  }),
});
const LOCKED_LAW = createDailyLawState({
  protocolHeight: 86_520n,
  schedule: TEST_SCHEDULE,
  currentDecision: createLockdownDecision({
    localDay: CURRENT_DAY,
    randomnessOutputHex: `${"00".repeat(31)}01`,
    schedule: TEST_SCHEDULE,
  }),
});

const hex = (value) => value.toString(16).padStart(64, "0");

function walletFor(value) {
  const bytes = Buffer.alloc(32);
  bytes[0] = 1;
  bytes.writeUInt32BE(value, 28);
  return encodeBase58(bytes);
}

function laneLedger(treasury = 1_000n) {
  const lane = (unlocked) => ({ unlocked, reserved: 0n, paid: 0n, withdrawn: 0n });
  return {
    lanes: {
      treasury: lane(treasury),
      ecosystem: lane(0n),
      liquidity: lane(0n),
    },
  };
}

function obligation(amount = 100n) {
  return {
    id: hex(1),
    priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
    amount,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    chronology: {
      eligibleSequence: 1n,
      activitySequence: 1n,
      nodeSequence: 1n,
      immutableIdentity: "checkpoint-round-identity",
      commitmentDigest: hex(10_001),
    },
  };
}

function sealedRound(ledger = laneLedger()) {
  return sealRewardCapacityRound({
    dailyLawState: OPEN_LAW,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    sealedAtUnixSeconds: FUNDING_ROUND,
    obligations: [obligation()],
    ledgerSnapshot: ledger,
    cccPrecommitRegistrySnapshot: createCccPrecommitRegistrySnapshot({
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
      commitments: [],
    }),
  });
}

function admittedReward() {
  const reward = createXBoundReward({
    dailyLawState: OPEN_LAW,
    rewardId: hex(501),
    rewardSourceKind: "X_INTERACTION",
    wallet: walletFor(501),
    xUserId: "9000000000000501",
    grossBaseUnits: 1_000n,
    epochClosedAtUnixSeconds: FUNDING_ROUND,
    subscriptionType: "None",
    subscriptionObservedAtUnixSeconds: FUNDING_ROUND - 3_600n,
    activityQualificationSequence: 10n,
    nodeActivationSequence: 8n,
  });
  const due = buildXBoundFundingObligation({ reward, fundingRoundAtUnixSeconds: FUNDING_ROUND });
  const roundState = sealRewardCapacityRound({
    dailyLawState: OPEN_LAW,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    sealedAtUnixSeconds: FUNDING_ROUND,
    obligations: [due],
    ledgerSnapshot: laneLedger(),
    cccPrecommitRegistrySnapshot: createCccPrecommitRegistrySnapshot({
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
      commitments: [],
    }),
  });
  const allocation = allocateRewardCapacity({ dailyLawState: OPEN_LAW, roundState });
  return applyXBoundFundingOutcome({
    dailyLawState: OPEN_LAW,
    reward,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    outcome: allocation.funded[0],
    roundState: allocation.roundState,
  });
}

function initialState(treasury = 1_000n) {
  const ledger = laneLedger(treasury);
  return {
    laneLedger: ledger,
    roundStates: [sealedRound(ledger)],
    rewardStates: [admittedReward()],
  };
}

function testDatabase(t, label) {
  const directory = mkdtempSync(join(tmpdir(), `iat-b3-checkpoint-${label}-`));
  const databasePath = join(directory, "reward-cas.sqlite");
  const stores = [];
  t.after(() => {
    for (const store of stores) store.close();
    rmSync(directory, { force: true, recursive: true });
  });
  return {
    directory,
    databasePath,
    open(options = {}) {
      const store = createSqliteRewardPersistenceCas({ databasePath, ...options });
      stores.push(store);
      return store;
    },
  };
}

function finalizationInput(store) {
  const round = store.readEntity(REWARD_CAS_ENTITY_KIND.ROUND, FUNDING_ROUND.toString());
  const ledger = store.readEntity(REWARD_CAS_ENTITY_KIND.LANE_LEDGER, REWARD_CAS_GLOBAL_LEDGER_KEY);
  return {
    dailyLawState: OPEN_LAW,
    store,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    expectedRoundRevision: round.revision,
    expectedRoundSha256: round.stateSha256,
    expectedLedgerRevision: ledger.revision,
    expectedLedgerSha256: ledger.stateSha256,
  };
}

function upgradeInput(store) {
  const rewardId = hex(501);
  const reward = store.readEntity(REWARD_CAS_ENTITY_KIND.X_REWARD, rewardId);
  return {
    dailyLawState: OPEN_LAW,
    store,
    rewardId,
    expectedRewardRevision: reward.revision,
    expectedRewardSha256: reward.stateSha256,
    subscriptionType: "Premium",
    subscriptionObservedAtUnixSeconds: FUNDING_ROUND + 3_600n,
    premiumProofAcceptedAtUnixSeconds: FUNDING_ROUND + 3_600n,
    premiumProofAcceptedSequence: 11n,
    premiumEvidenceSha256: "ab".repeat(32),
  };
}

function mockSink({ fault = null } = {}) {
  let current = null;
  let compareCalls = 0;
  let readCalls = 0;
  let faultPending = fault;
  return Object.freeze({
    readCurrent() {
      readCalls += 1;
      return current;
    },
    compareAndSwap(envelope) {
      compareCalls += 1;
      const actualRevision = current?.checkpointRevision ?? 0n;
      const actualDigest = current?.checkpointSha256 ?? REWARD_CAS_ZERO_SHA256;
      if (actualRevision !== envelope.expectedCheckpointRevision
        || actualDigest !== envelope.expectedCheckpointSha256) {
        throw new Error("TEST_CHECKPOINT_SINK_STALE_CAS");
      }
      validateRewardCasExternalCheckpoint(envelope.nextCheckpoint);
      if (faultPending === "BEFORE_COMMIT") {
        faultPending = null;
        throw new Error("TEST_CHECKPOINT_SINK_BEFORE_COMMIT");
      }
      current = envelope.nextCheckpoint;
      if (faultPending === "AFTER_COMMIT") {
        faultPending = null;
        throw new Error("TEST_CHECKPOINT_SINK_AFTER_COMMIT");
      }
    },
    setCurrentForTest(value) {
      current = value;
    },
    stats() {
      return { current, compareCalls, readCalls };
    },
  });
}

function checkpointWith(record, changes) {
  const { checkpointSha256: ignored, ...core } = { ...record, ...changes };
  void ignored;
  return Object.freeze({ ...core, checkpointSha256: rewardCasStateSha256(core) });
}

function hostileRecordVariants(record) {
  const withSymbol = { ...record };
  withSymbol[Symbol("extra")] = true;
  const withHidden = { ...record };
  Object.defineProperty(withHidden, "hidden", { enumerable: false, value: true });
  const withCustomPrototype = { ...record };
  Object.setPrototypeOf(withCustomPrototype, { inherited: true });
  return [
    null,
    Object.assign(Object.create(null), record),
    withCustomPrototype,
    withSymbol,
    withHidden,
  ];
}

test("persistence identity binds immutable SQLite genesis/schema and fixed reference-only policy", (t) => {
  const fixture = testDatabase(t, "identity");
  const store = fixture.open({ initialState: initialState() });
  const identity = store.readPersistenceIdentity();
  assert.equal(validateRewardCasPersistenceIdentity(identity), identity);
  assert.equal(identity.status, REWARD_CAS_EXTERNAL_CHECKPOINT_STATUS);
  assert.equal(identity.externalNamespaceSha256, REWARD_CAS_EXTERNAL_NAMESPACE_SHA256);
  assert.equal(identity.externalTrustPolicySha256, REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256);
  assert.equal(
    createHash("sha256").update(REWARD_CAS_EXTERNAL_NAMESPACE, "utf8").digest("hex"),
    REWARD_CAS_EXTERNAL_NAMESPACE_SHA256,
  );
  assert.equal(
    createHash("sha256").update(REWARD_CAS_EXTERNAL_TRUST_POLICY, "utf8").digest("hex"),
    REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256,
  );
  for (const flag of [
    "runtimeAuthenticationVerified",
    "externalMonotonicityVerified",
    "rollbackProtectionVerified",
    "activationReady",
  ]) assert.equal(identity[flag], false);
  assert.equal(identity.mainnetStatus, REWARD_CAS_EXTERNAL_CHECKPOINT_MAINNET_STATUS);
  const before = identity.persistenceIdentitySha256;
  store.close();
  assert.equal(fixture.open().readPersistenceIdentity().persistenceIdentitySha256, before);

  const other = testDatabase(t, "identity-other").open({ initialState: initialState(2_000n) });
  assert.notEqual(other.readPersistenceIdentity().persistenceIdentitySha256, before);
});

test("checkpoint revisions advance exactly one retained CAS commit and exact replay is idempotent", (t) => {
  const store = testDatabase(t, "sequential").open({ initialState: initialState() });
  const sink = mockSink();
  const genesis = advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink });
  assert.equal(genesis.checkpoint.checkpointRevision, 1n);
  assert.equal(genesis.checkpoint.casCommitSequence, 0n);
  assert.equal(genesis.checkpoint.previousCheckpointSha256, REWARD_CAS_ZERO_SHA256);

  finalizeRewardCapacityRoundCas(finalizationInput(store));
  recordPremiumUpgradeCas(upgradeInput(store));
  assert.equal(store.readHead().commitSequence, 2n);
  assert.equal(
    verifyRewardCasSnapshotAgainstExternalCheckpoint({
      persistenceIdentity: store.readPersistenceIdentity(),
      snapshot: store.snapshot(),
      checkpoint: genesis.checkpoint,
    }).relationship,
    "LOCAL_AHEAD",
  );
  const first = advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink });
  assert.equal(first.checkpoint.checkpointRevision, 2n);
  assert.equal(first.checkpoint.casCommitSequence, 1n);
  assert.equal(first.checkpoint.previousCheckpointSha256, genesis.checkpoint.checkpointSha256);
  const second = advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink });
  assert.equal(second.checkpoint.checkpointRevision, 3n);
  assert.equal(second.checkpoint.casCommitSequence, 2n);
  assert.equal(second.checkpoint.previousCheckpointSha256, first.checkpoint.checkpointSha256);
  const calls = sink.stats().compareCalls;
  const replay = advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink });
  assert.equal(replay.disposition, REWARD_CAS_EXTERNAL_CHECKPOINT_DISPOSITION.ALREADY_CURRENT);
  assert.equal(replay.checkpoint.checkpointSha256, second.checkpoint.checkpointSha256);
  assert.equal(sink.stats().compareCalls, calls);
});

test("identity, checkpoint, and plan records reject shape, type, case, tamper, sparse, and cycle aliases", (t) => {
  const store = testDatabase(t, "adversarial-records").open({ initialState: initialState() });
  const identity = store.readPersistenceIdentity();
  const plan = prepareRewardCasExternalCheckpointAdvance({
    dailyLawState: OPEN_LAW,
    persistenceIdentity: identity,
    snapshot: store.snapshot(),
    currentCheckpoint: null,
  });
  validateRewardCasExternalCheckpointPlan(plan);
  const checkpoint = plan.nextCheckpoint;
  const { schema: omittedIdentitySchema, ...identityMissing } = identity;
  void omittedIdentitySchema;
  const { schema: omittedCheckpointSchema, ...checkpointMissing } = checkpoint;
  void omittedCheckpointSchema;
  const { schema: omittedPlanSchema, ...planMissing } = plan;
  void omittedPlanSchema;
  for (const candidate of [
    identityMissing,
    { ...identity, extra: true },
    { ...identity, schemaManifestSha256: identity.schemaManifestSha256.toUpperCase() },
    Array(2),
    ...hostileRecordVariants(identity),
  ]) assert.throws(() => validateRewardCasPersistenceIdentity(candidate));
  let identityGetterRead = false;
  const identityAccessor = { ...identity };
  Object.defineProperty(identityAccessor, "schema", {
    enumerable: true,
    get() {
      identityGetterRead = true;
      throw new Error("IDENTITY_GETTER_EXECUTED");
    },
  });
  assert.throws(
    () => validateRewardCasPersistenceIdentity(identityAccessor),
    /INVALID_REWARD_CAS_PERSISTENCE_IDENTITY/u,
  );
  assert.equal(identityGetterRead, false);
  const cyclicIdentity = { ...identity };
  cyclicIdentity.self = cyclicIdentity;
  assert.throws(() => validateRewardCasPersistenceIdentity(cyclicIdentity));

  for (const candidate of [
    checkpointMissing,
    { ...checkpoint, extra: true },
    { ...checkpoint, checkpointRevision: 1 },
    { ...checkpoint, checkpointSha256: checkpoint.checkpointSha256.toUpperCase() },
    { ...checkpoint, persistenceIdentitySha256: "01".repeat(32) },
    Array(3),
    ...hostileRecordVariants(checkpoint),
  ]) assert.throws(() => validateRewardCasExternalCheckpoint(candidate));
  let checkpointGetterRead = false;
  const checkpointAccessor = { ...checkpoint };
  Object.defineProperty(checkpointAccessor, "schema", {
    enumerable: true,
    get() {
      checkpointGetterRead = true;
      throw new Error("CHECKPOINT_GETTER_EXECUTED");
    },
  });
  assert.throws(
    () => validateRewardCasExternalCheckpoint(checkpointAccessor),
    /INVALID_REWARD_CAS_EXTERNAL_CHECKPOINT/u,
  );
  assert.equal(checkpointGetterRead, false);
  const cyclicCheckpoint = { ...checkpoint };
  cyclicCheckpoint.self = cyclicCheckpoint;
  assert.throws(() => validateRewardCasExternalCheckpoint(cyclicCheckpoint));

  for (const candidate of [
    planMissing,
    { ...plan, extra: true },
    { ...plan, expectedCheckpointRevision: 0 },
    { ...plan, planSha256: "ff".repeat(32) },
    Array(1),
    ...hostileRecordVariants(plan),
  ]) assert.throws(() => validateRewardCasExternalCheckpointPlan(candidate));
  let planGetterRead = false;
  const planAccessor = { ...plan };
  Object.defineProperty(planAccessor, "schema", {
    enumerable: true,
    get() {
      planGetterRead = true;
      throw new Error("PLAN_GETTER_EXECUTED");
    },
  });
  assert.throws(
    () => validateRewardCasExternalCheckpointPlan(planAccessor),
    /INVALID_REWARD_CAS_EXTERNAL_CHECKPOINT_PLAN/u,
  );
  assert.equal(planGetterRead, false);
  assert.throws(() => createRewardCasPersistenceIdentity({
    adapterSchema: [],
    adapterSchemaVersion: 1,
    schemaManifestSha256: "00".repeat(32),
    genesisEntitySetSha256: "00".repeat(32),
  }));
  let inputGetterRead = false;
  const identityInput = {
    adapterSchema: "test",
    adapterSchemaVersion: 1,
    schemaManifestSha256: "00".repeat(32),
    genesisEntitySetSha256: "00".repeat(32),
  };
  Object.defineProperty(identityInput, "adapterSchema", {
    enumerable: true,
    get() {
      inputGetterRead = true;
      throw new Error("IDENTITY_INPUT_GETTER_EXECUTED");
    },
  });
  assert.throws(
    () => createRewardCasPersistenceIdentity(identityInput),
    /INVALID_REWARD_CAS_PERSISTENCE_IDENTITY_INPUT/u,
  );
  assert.equal(inputGetterRead, false);
});

test("first anchor fails closed after any unanchored commit or provider reset", (t) => {
  const store = testDatabase(t, "unanchored-history").open({ initialState: initialState() });
  const sink = mockSink();
  finalizeRewardCapacityRoundCas(finalizationInput(store));
  const before = store.snapshot();
  assert.throws(
    () => prepareRewardCasExternalCheckpointAdvance({
      dailyLawState: OPEN_LAW,
      persistenceIdentity: store.readPersistenceIdentity(),
      snapshot: before,
      currentCheckpoint: null,
    }),
    /REWARD_CAS_UNANCHORED_HISTORY_HOLD/u,
  );
  assert.throws(
    () => advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink }),
    /REWARD_CAS_UNANCHORED_HISTORY_HOLD/u,
  );
  assert.equal(sink.stats().compareCalls, 0);
  assert.deepEqual(store.snapshot(), before);

  const resetStore = testDatabase(t, "provider-reset").open({ initialState: initialState() });
  const resetSink = mockSink();
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store: resetStore, sink: resetSink });
  finalizeRewardCapacityRoundCas(finalizationInput(resetStore));
  resetSink.setCurrentForTest(null);
  const resetBefore = resetStore.snapshot();
  assert.throws(
    () => advanceRewardCasExternalCheckpoint({
      dailyLawState: OPEN_LAW,
      store: resetStore,
      sink: resetSink,
    }),
    /REWARD_CAS_UNANCHORED_HISTORY_HOLD/u,
  );
  assert.equal(resetSink.stats().compareCalls, 1);
  assert.deepEqual(resetStore.snapshot(), resetBefore);
});

test("behind restore, same-sequence fork, and unrelated local-ahead ancestry fail closed", (t) => {
  const store = testDatabase(t, "ancestry").open({ initialState: initialState() });
  const identity = store.readPersistenceIdentity();
  const genesisPlan = prepareRewardCasExternalCheckpointAdvance({
    dailyLawState: OPEN_LAW,
    persistenceIdentity: identity,
    snapshot: store.snapshot(),
  });
  finalizeRewardCapacityRoundCas(finalizationInput(store));
  const snapshotOne = store.snapshot();
  const onePlan = prepareRewardCasExternalCheckpointAdvance({
    dailyLawState: OPEN_LAW,
    persistenceIdentity: identity,
    snapshot: snapshotOne,
    currentCheckpoint: genesisPlan.nextCheckpoint,
  });
  const checkpointOne = onePlan.nextCheckpoint;
  const behindStore = testDatabase(t, "ancestry-behind").open({ initialState: initialState() });
  assert.equal(
    behindStore.readPersistenceIdentity().persistenceIdentitySha256,
    identity.persistenceIdentitySha256,
  );
  assert.throws(
    () => verifyRewardCasSnapshotAgainstExternalCheckpoint({
      persistenceIdentity: identity,
      snapshot: behindStore.snapshot(),
      checkpoint: checkpointOne,
    }),
    /LOCAL_BEHIND_EXTERNAL_CHECKPOINT/u,
  );
  const fork = checkpointWith(checkpointOne, { casHeadCommitSha256: "fe".repeat(32) });
  validateRewardCasExternalCheckpoint(fork);
  assert.throws(
    () => verifyRewardCasSnapshotAgainstExternalCheckpoint({
      persistenceIdentity: identity,
      snapshot: snapshotOne,
      checkpoint: fork,
    }),
    /SAME_SEQUENCE_CHECKPOINT_FORK/u,
  );
  const forgedPredecessor = checkpointWith(checkpointOne, {
    previousCheckpointSha256: "fd".repeat(32),
  });
  validateRewardCasExternalCheckpoint(forgedPredecessor);
  assert.throws(
    () => verifyRewardCasSnapshotAgainstExternalCheckpoint({
      persistenceIdentity: identity,
      snapshot: snapshotOne,
      checkpoint: forgedPredecessor,
    }),
    /EXTERNAL_CHECKPOINT_CHAIN_MISMATCH/u,
  );
  recordPremiumUpgradeCas(upgradeInput(store));
  const snapshotTwo = store.snapshot();
  const twoPlan = prepareRewardCasExternalCheckpointAdvance({
    dailyLawState: OPEN_LAW,
    persistenceIdentity: identity,
    snapshot: snapshotTwo,
    currentCheckpoint: checkpointOne,
  });
  const splicedCheckpoint = checkpointWith(twoPlan.nextCheckpoint, {
    previousCheckpointSha256: genesisPlan.nextCheckpoint.checkpointSha256,
  });
  validateRewardCasExternalCheckpoint(splicedCheckpoint);
  assert.throws(
    () => verifyRewardCasSnapshotAgainstExternalCheckpoint({
      persistenceIdentity: identity,
      snapshot: snapshotTwo,
      checkpoint: splicedCheckpoint,
    }),
    /EXTERNAL_CHECKPOINT_CHAIN_MISMATCH/u,
  );
  assert.throws(
    () => verifyRewardCasSnapshotAgainstExternalCheckpoint({
      persistenceIdentity: identity,
      snapshot: snapshotTwo,
      checkpoint: fork,
    }),
    /NOT_RETAINED_ANCESTOR/u,
  );
});

test("lost sink response recovers by exact readback while pre-commit and stale failures change neither side", (t) => {
  const store = testDatabase(t, "sink-faults").open({ initialState: initialState() });
  const before = store.snapshot();
  const uncertain = mockSink({ fault: "AFTER_COMMIT" });
  const recovered = advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink: uncertain });
  assert.equal(recovered.recoveredAfterUncertainResponse, true);
  assert.equal(recovered.checkpoint.casCommitSequence, 0n);
  assert.deepEqual(store.snapshot(), before);
  const retry = advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink: uncertain });
  assert.equal(retry.disposition, REWARD_CAS_EXTERNAL_CHECKPOINT_DISPOSITION.ALREADY_CURRENT);

  const rejected = mockSink({ fault: "BEFORE_COMMIT" });
  assert.throws(
    () => advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink: rejected }),
    /BEFORE_COMMIT/u,
  );
  assert.equal(rejected.stats().current, null);
  assert.deepEqual(store.snapshot(), before);

  const stale = mockSink();
  stale.setCurrentForTest(recovered.checkpoint);
  assert.throws(
    () => stale.compareAndSwap({
      expectedCheckpointRevision: 0n,
      expectedCheckpointSha256: REWARD_CAS_ZERO_SHA256,
      nextCheckpoint: recovered.checkpoint,
      planSha256: "00".repeat(32),
    }),
    /STALE_CAS/u,
  );
  assert.equal(stale.stats().current.checkpointSha256, recovered.checkpoint.checkpointSha256);
});

test("a closed valid DB restored behind an external checkpoint passes SQLite reopen but fails checkpoint verification", (t) => {
  const fixture = testDatabase(t, "restore");
  let store = fixture.open({ initialState: initialState() });
  const sink = mockSink();
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink });
  finalizeRewardCapacityRoundCas(finalizationInput(store));
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink });
  assert.equal(store.readHead().commitSequence, 1n);
  store.close();
  const backupPath = join(fixture.directory, "reward-cas-sequence-one.sqlite");
  copyFileSync(fixture.databasePath, backupPath);

  store = fixture.open();
  recordPremiumUpgradeCas(upgradeInput(store));
  const checkpointTwo = advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink }).checkpoint;
  assert.equal(checkpointTwo.casCommitSequence, 2n);
  store.close();
  copyFileSync(backupPath, fixture.databasePath);

  store = fixture.open();
  const restoredSnapshot = store.snapshot();
  assert.equal(restoredSnapshot.head.commitSequence, 1n);
  const before = store.snapshot();
  const compareCalls = sink.stats().compareCalls;
  assert.throws(
    () => verifyRewardCasSnapshotAgainstExternalCheckpoint({
      persistenceIdentity: store.readPersistenceIdentity(),
      snapshot: restoredSnapshot,
      checkpoint: checkpointTwo,
    }),
    /LOCAL_BEHIND_EXTERNAL_CHECKPOINT/u,
  );
  assert.throws(
    () => advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink }),
    /LOCAL_BEHIND_EXTERNAL_CHECKPOINT/u,
  );
  assert.equal(sink.stats().compareCalls, compareCalls);
  assert.deepEqual(store.snapshot(), before);
});

test("Daily Law is first for direct preparation and sink-backed checkpoint writes", (t) => {
  const store = testDatabase(t, "daily-law-first").open({ initialState: initialState() });
  let preparationRead = false;
  const preparationInput = {
    dailyLawState: LOCKED_LAW,
    get persistenceIdentity() {
      preparationRead = true;
      throw new Error("PREPARATION_INPUT_READ_TOO_EARLY");
    },
    get snapshot() {
      preparationRead = true;
      throw new Error("PREPARATION_INPUT_READ_TOO_EARLY");
    },
  };
  assert.throws(
    () => prepareRewardCasExternalCheckpointAdvance(preparationInput),
    /IAT_DAILY_LOCKDOWN/u,
  );
  assert.equal(preparationRead, false);

  let storeRead = false;
  let sinkRead = false;
  const guardedStore = {
    readPersistenceIdentity() {
      storeRead = true;
      throw new Error("STORE_READ_TOO_EARLY");
    },
    snapshot() {
      storeRead = true;
      throw new Error("STORE_READ_TOO_EARLY");
    },
  };
  const guardedSink = {
    readCurrent() {
      sinkRead = true;
      throw new Error("SINK_READ_TOO_EARLY");
    },
    compareAndSwap() {
      sinkRead = true;
      throw new Error("SINK_WRITE_TOO_EARLY");
    },
  };
  assert.throws(
    () => advanceRewardCasExternalCheckpoint({
      dailyLawState: LOCKED_LAW,
      store: guardedStore,
      sink: guardedSink,
    }),
    /IAT_DAILY_LOCKDOWN/u,
  );
  assert.equal(storeRead, false);
  assert.equal(sinkRead, false);
  assert.equal(store.readHead().commitSequence, 0n);
});

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  REWARD_CHECKPOINT_GATED_CAS_MAINNET_STATUS,
  REWARD_CHECKPOINT_GATED_CAS_SCHEMA,
  REWARD_CHECKPOINT_GATED_CAS_STATUS,
  assertRewardCasLocalWriteAllowed,
  createCheckpointGatedRewardPersistenceCas,
} from "../programs/iat_b3_reference/reward-checkpoint-gated-cas.mjs";
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
import { createSqliteRewardPersistenceCas } from "../programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs";
import {
  advanceRewardCasExternalCheckpoint,
  validateRewardCasExternalCheckpoint,
} from "../programs/iat_b3_reference/reward-persistence-checkpoint.mjs";
import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";

const LOCAL_0001_UTC = 1_786_050_060n;
const ROUND_ONE = 1_786_060_800n;
const ROUND_TWO = ROUND_ONE + 86_400n;
const SCHEDULE = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: LOCAL_0001_UTC - 86_520n,
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-checkpoint-gated-cas-test",
});
const CURRENT_DAY = protocolLocalDay(LOCAL_0001_UTC);
const hex = (value) => BigInt(value).toString(16).padStart(64, "0");

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

function laneLedger({ unlocked = 1_000n, reserved = 0n } = {}) {
  const empty = { unlocked: 0n, reserved: 0n, paid: 0n, withdrawn: 0n };
  return {
    lanes: {
      treasury: { unlocked, reserved, paid: 0n, withdrawn: 0n },
      ecosystem: { ...empty },
      liquidity: { ...empty },
    },
  };
}

function sealedRound(fundingRoundAtUnixSeconds, boundaryLedger, id) {
  return sealRewardCapacityRound({
    dailyLawState: OPEN_LAW,
    fundingRoundAtUnixSeconds,
    sealedAtUnixSeconds: fundingRoundAtUnixSeconds,
    obligations: [{
      id: hex(id),
      priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
      amount: 100n,
      fundingRoundAtUnixSeconds,
      fundingPool: "SHARED_REWARD_RESERVE",
      reservationStatus: "NEW_UNRESERVED",
      chronology: {
        eligibleSequence: BigInt(id),
        activitySequence: BigInt(id),
        nodeSequence: BigInt(id),
        immutableIdentity: `checkpoint-gated-${id}`,
        commitmentDigest: hex(10_000n + BigInt(id)),
      },
    }],
    ledgerSnapshot: boundaryLedger,
    cccPrecommitRegistrySnapshot: createCccPrecommitRegistrySnapshot({
      fundingRoundAtUnixSeconds,
      commitments: [],
    }),
  });
}

function checkpointSink() {
  let current = null;
  let reads = 0;
  return Object.freeze({
    readCurrent() {
      reads += 1;
      return current;
    },
    readCount() {
      return reads;
    },
    compareAndSwap({ expectedCheckpointRevision, expectedCheckpointSha256, nextCheckpoint }) {
      assert.equal(current?.checkpointRevision ?? 0n, expectedCheckpointRevision);
      assert.equal(current?.checkpointSha256 ?? REWARD_CAS_ZERO_SHA256, expectedCheckpointSha256);
      validateRewardCasExternalCheckpoint(nextCheckpoint);
      current = nextCheckpoint;
    },
  });
}

function roundFinalizationInput(store, fundingRoundAtUnixSeconds) {
  const round = store.readEntity(REWARD_CAS_ENTITY_KIND.ROUND, fundingRoundAtUnixSeconds.toString());
  const ledger = store.readEntity(
    REWARD_CAS_ENTITY_KIND.LANE_LEDGER,
    REWARD_CAS_GLOBAL_LEDGER_KEY,
  );
  return {
    dailyLawState: OPEN_LAW,
    store,
    fundingRoundAtUnixSeconds,
    expectedRoundRevision: round.revision,
    expectedRoundSha256: round.stateSha256,
    expectedLedgerRevision: ledger.revision,
    expectedLedgerSha256: ledger.stateSha256,
  };
}

function roundFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-checkpoint-gated-cas-"));
  const firstLedger = laneLedger();
  const secondLedger = laneLedger({ reserved: 100n });
  const baseStore = createSqliteRewardPersistenceCas({
    databasePath: join(directory, "reward-cas.sqlite"),
    initialState: {
      laneLedger: firstLedger,
      roundStates: [
        sealedRound(ROUND_ONE, firstLedger, 1n),
        sealedRound(ROUND_TWO, secondLedger, 2n),
      ],
      rewardStates: [],
    },
  });
  const sink = checkpointSink();
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store: baseStore, sink });
  const store = createCheckpointGatedRewardPersistenceCas({
    store: baseStore,
    checkpointSource: sink,
  });
  t.after(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  return { store, baseStore, sink };
}

function admittedReward(rewardNumber) {
  const rewardId = hex(rewardNumber);
  const reward = createXBoundReward({
    dailyLawState: OPEN_LAW,
    rewardId,
    rewardSourceKind: "X_INTERACTION",
    wallet: "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH",
    xUserId: `900000000000${rewardNumber}`,
    grossBaseUnits: 1_000n,
    epochClosedAtUnixSeconds: ROUND_ONE,
    subscriptionType: "None",
    subscriptionObservedAtUnixSeconds: ROUND_ONE - 3_600n,
    activityQualificationSequence: BigInt(rewardNumber),
    nodeActivationSequence: BigInt(rewardNumber - 1),
  });
  const obligation = buildXBoundFundingObligation({
    reward,
    fundingRoundAtUnixSeconds: ROUND_ONE,
  });
  const pending = sealRewardCapacityRound({
    dailyLawState: OPEN_LAW,
    fundingRoundAtUnixSeconds: ROUND_ONE,
    sealedAtUnixSeconds: ROUND_ONE,
    obligations: [obligation],
    ledgerSnapshot: laneLedger(),
    cccPrecommitRegistrySnapshot: createCccPrecommitRegistrySnapshot({
      fundingRoundAtUnixSeconds: ROUND_ONE,
      commitments: [],
    }),
  });
  const allocation = allocateRewardCapacity({ dailyLawState: OPEN_LAW, roundState: pending });
  return applyXBoundFundingOutcome({
    dailyLawState: OPEN_LAW,
    reward,
    fundingRoundAtUnixSeconds: ROUND_ONE,
    outcome: allocation.funded[0],
    roundState: allocation.roundState,
  });
}

function premiumUpgradeInput(store, rewardId, evidenceByte) {
  const reward = store.readEntity(REWARD_CAS_ENTITY_KIND.X_REWARD, rewardId);
  return {
    dailyLawState: OPEN_LAW,
    store,
    rewardId,
    expectedRewardRevision: reward.revision,
    expectedRewardSha256: reward.stateSha256,
    subscriptionType: "Premium",
    subscriptionObservedAtUnixSeconds: ROUND_ONE + 3_600n,
    premiumProofAcceptedAtUnixSeconds: ROUND_ONE + 3_600n,
    premiumProofAcceptedSequence: 1_000n,
    premiumEvidenceSha256: evidenceByte.repeat(32),
  };
}

test("one exact anchored local write is allowed, then every later write stays closed until reconciliation", (t) => {
  const context = roundFixture(t);
  const initialGate = assertRewardCasLocalWriteAllowed({
    dailyLawState: OPEN_LAW,
    store: context.store,
    checkpointSource: context.sink,
  });
  assert.equal(initialGate.schema, REWARD_CHECKPOINT_GATED_CAS_SCHEMA);
  assert.equal(initialGate.status, REWARD_CHECKPOINT_GATED_CAS_STATUS);
  assert.equal(initialGate.mainnetStatus, REWARD_CHECKPOINT_GATED_CAS_MAINNET_STATUS);
  assert.equal(initialGate.exactCheckpointHeadVerified, true);
  assert.equal(initialGate.runtimeAuthenticationVerified, false);
  assert.equal(initialGate.externalMonotonicityVerified, false);
  assert.equal(initialGate.rollbackProtectionVerified, false);
  assert.equal(initialGate.directStoreBypassPreventionVerified, false);
  assert.equal(initialGate.activationReady, false);

  const first = finalizeRewardCapacityRoundCas(roundFinalizationInput(context.store, ROUND_ONE));
  assert.equal(first.commit.sequence, 1n);
  const beforeBlockedAttempt = context.store.snapshot();
  assert.throws(
    () => finalizeRewardCapacityRoundCas(roundFinalizationInput(context.store, ROUND_TWO)),
    /REWARD_CAS_LOCAL_WRITE_UNANCHORED_HEAD_HOLD/u,
  );
  assert.deepEqual(context.store.snapshot(), beforeBlockedAttempt);
  assert.equal(
    context.store.readEntity(REWARD_CAS_ENTITY_KIND.ROUND, ROUND_TWO.toString()).value.status,
    "SEALED_PENDING_FINALIZATION",
  );

  advanceRewardCasExternalCheckpoint({
    dailyLawState: OPEN_LAW,
    store: context.store,
    sink: context.sink,
  });
  const reconciledGate = assertRewardCasLocalWriteAllowed({
    dailyLawState: OPEN_LAW,
    store: context.store,
    checkpointSource: context.sink,
  });
  assert.equal(reconciledGate.localCommitSequence, 1n);
  assert.equal(reconciledGate.checkpointCommitSequence, 1n);
  const second = finalizeRewardCapacityRoundCas(roundFinalizationInput(context.store, ROUND_TWO));
  assert.equal(second.commit.sequence, 2n);
});

test("Premium-upgrade CAS writes use the same exact-head gate", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-checkpoint-gated-upgrade-"));
  const rewardOne = admittedReward(501);
  const rewardTwo = admittedReward(502);
  const baseStore = createSqliteRewardPersistenceCas({
    databasePath: join(directory, "reward-cas.sqlite"),
    initialState: {
      laneLedger: laneLedger(),
      roundStates: [],
      rewardStates: [rewardOne, rewardTwo],
    },
  });
  const sink = checkpointSink();
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store: baseStore, sink });
  const store = createCheckpointGatedRewardPersistenceCas({ store: baseStore, checkpointSource: sink });
  t.after(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const first = recordPremiumUpgradeCas(premiumUpgradeInput(store, rewardOne.rewardId, "ab"));
  assert.equal(first.commit.sequence, 1n);
  const beforeBlockedAttempt = store.snapshot();
  assert.throws(
    () => recordPremiumUpgradeCas(premiumUpgradeInput(store, rewardTwo.rewardId, "cd")),
    /REWARD_CAS_LOCAL_WRITE_UNANCHORED_HEAD_HOLD/u,
  );
  assert.deepEqual(store.snapshot(), beforeBlockedAttempt);
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink });
  const second = recordPremiumUpgradeCas(premiumUpgradeInput(store, rewardTwo.rewardId, "cd"));
  assert.equal(second.commit.sequence, 2n);
});

test("missing, stale, forked, or copied checkpoint reads stay honestly unauthenticated", (t) => {
  const context = roundFixture(t);
  const canonicalCheckpoint = context.sink.readCurrent();
  const copiedSource = { readCurrent: () => structuredClone(canonicalCheckpoint) };
  const copiedFacts = assertRewardCasLocalWriteAllowed({
    dailyLawState: OPEN_LAW,
    store: context.store,
    checkpointSource: copiedSource,
  });
  assert.equal(copiedFacts.exactCheckpointHeadVerified, true);
  assert.equal(copiedFacts.runtimeAuthenticationVerified, false);
  assert.equal(copiedFacts.rollbackProtectionVerified, false);

  const missingStore = createCheckpointGatedRewardPersistenceCas({
    store: context.baseStore,
    checkpointSource: { readCurrent: () => null },
  });
  const beforeMissing = context.store.snapshot();
  assert.throws(
    () => finalizeRewardCapacityRoundCas(roundFinalizationInput(missingStore, ROUND_ONE)),
    /INVALID_REWARD_CAS_EXTERNAL_CHECKPOINT/u,
  );
  assert.deepEqual(context.store.snapshot(), beforeMissing);

  const forked = structuredClone(canonicalCheckpoint);
  forked.casHeadCommitSha256 = "ff".repeat(32);
  const forkCore = { ...forked };
  delete forkCore.checkpointSha256;
  forked.checkpointSha256 = rewardCasStateSha256(forkCore);
  const forkedStore = createCheckpointGatedRewardPersistenceCas({
    store: context.baseStore,
    checkpointSource: { readCurrent: () => forked },
  });
  assert.throws(
    () => finalizeRewardCapacityRoundCas(roundFinalizationInput(forkedStore, ROUND_ONE)),
    /INVALID_REWARD_CAS_EXTERNAL_CHECKPOINT_CHAIN/u,
  );
  assert.deepEqual(context.store.snapshot(), beforeMissing);

  finalizeRewardCapacityRoundCas(roundFinalizationInput(context.store, ROUND_ONE));
  assert.throws(
    () => finalizeRewardCapacityRoundCas(roundFinalizationInput(context.store, ROUND_TWO)),
    /REWARD_CAS_LOCAL_WRITE_UNANCHORED_HEAD_HOLD/u,
  );
});

test("Daily Law fails before any store, checkpoint, or later mutation input is read", (t) => {
  let laterRead = false;
  const poisoned = {
    dailyLawState: {},
    get store() {
      laterRead = true;
      throw new Error("STORE_READ_BEFORE_LAW");
    },
    get checkpointSource() {
      laterRead = true;
      throw new Error("CHECKPOINT_READ_BEFORE_LAW");
    },
  };
  assert.throws(() => assertRewardCasLocalWriteAllowed(poisoned), /INVALID_IAT_DAILY_LAW_STATE/u);
  assert.equal(laterRead, false);

  const context = roundFixture(t);
  const readsBefore = context.sink.readCount();
  const snapshotBefore = context.store.snapshot();
  const input = roundFinalizationInput(context.store, ROUND_ONE);
  assert.throws(
    () => finalizeRewardCapacityRoundCas({ ...input, dailyLawState: LOCKED_LAW }),
    /IAT_DAILY_LOCKDOWN/u,
  );
  assert.equal(context.sink.readCount(), readsBefore);
  assert.deepEqual(context.store.snapshot(), snapshotBefore);
});

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

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
} from "../programs/iat_b3_reference/reward-persistence-cas.mjs";
import { createSqliteRewardPersistenceCas } from "../programs/iat_b3_reference/reward-persistence-cas-sqlite.mjs";
import {
  advanceRewardCasExternalCheckpoint,
  validateRewardCasExternalCheckpoint,
} from "../programs/iat_b3_reference/reward-persistence-checkpoint.mjs";
import {
  REWARD_CONSUMER_GATE_MAINNET_STATUS,
  REWARD_CONSUMER_GATE_STATUS,
  REWARD_CONSUMER_SCOPE,
  assertRewardConsumerPermit,
  prepareRewardConsumerPermit,
} from "../programs/iat_b3_reference/reward-consumer-gate.mjs";
import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";

const LOCAL_0001_UTC = 1_786_050_060n;
const FUNDING_ROUND = 1_786_060_800n;
const SCHEDULE = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: LOCAL_0001_UTC - 86_520n,
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-consumer-gate-test",
});
const CURRENT_DAY = protocolLocalDay(LOCAL_0001_UTC);

function lawWithDisposition(locked) {
  for (let candidate = 0; candidate <= 0xffff; candidate += 1) {
    const randomnessOutputHex = candidate.toString(16).padStart(64, "0");
    const decision = createLockdownDecision({
      localDay: CURRENT_DAY,
      randomnessOutputHex,
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

const hex = (value) => value.toString(16).padStart(64, "0");

function laneLedger(unlocked) {
  const lane = (amount) => ({ unlocked: amount, reserved: 0n, paid: 0n, withdrawn: 0n });
  return {
    lanes: {
      treasury: lane(unlocked),
      ecosystem: lane(0n),
      liquidity: lane(0n),
    },
  };
}

function sealedRound(ledger, amount = 100n) {
  return sealRewardCapacityRound({
    dailyLawState: OPEN_LAW,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    sealedAtUnixSeconds: FUNDING_ROUND,
    obligations: [{
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
        immutableIdentity: "consumer-gate-test-identity",
        commitmentDigest: hex(2),
      },
    }],
    ledgerSnapshot: ledger,
    cccPrecommitRegistrySnapshot: createCccPrecommitRegistrySnapshot({
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
      commitments: [],
    }),
  });
}

function admittedReward() {
  const ledger = laneLedger(1_000n);
  const reward = createXBoundReward({
    dailyLawState: OPEN_LAW,
    rewardId: hex(501),
    rewardSourceKind: "X_INTERACTION",
    wallet: "7XZjd7aNNci63LZy9syqgjvjNHvkQ83Uwo7cyynrfzPH",
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
    ledgerSnapshot: ledger,
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

function fixture(t, unlocked = 1_000n) {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-consumer-gate-"));
  const ledger = laneLedger(unlocked);
  const store = createSqliteRewardPersistenceCas({
    databasePath: join(directory, "reward-cas.sqlite"),
    initialState: {
      laneLedger: ledger,
      roundStates: [sealedRound(ledger)],
      rewardStates: [],
    },
  });
  const sink = checkpointSink();
  t.after(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink });
  const round = store.readEntity(REWARD_CAS_ENTITY_KIND.ROUND, FUNDING_ROUND.toString());
  const storedLedger = store.readEntity(
    REWARD_CAS_ENTITY_KIND.LANE_LEDGER,
    REWARD_CAS_GLOBAL_LEDGER_KEY,
  );
  const committed = finalizeRewardCapacityRoundCas({
    dailyLawState: OPEN_LAW,
    store,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    expectedRoundRevision: round.revision,
    expectedRoundSha256: round.stateSha256,
    expectedLedgerRevision: storedLedger.revision,
    expectedLedgerSha256: storedLedger.stateSha256,
  });
  return { store, sink, committed };
}

function permitInput({ store, sink, committed }) {
  return {
    dailyLawState: OPEN_LAW,
    store,
    checkpoint: sink.readCurrent(),
    consumerId: "reward-projection-v1",
    scope: REWARD_CONSUMER_SCOPE.LOCAL_PROJECTION,
    targetCommitSequence: committed.commit.sequence,
    targetCommitSha256: committed.commit.commitSha256,
  };
}

function upgradeFixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-consumer-upgrade-"));
  const store = createSqliteRewardPersistenceCas({
    databasePath: join(directory, "reward-cas.sqlite"),
    initialState: {
      laneLedger: laneLedger(1_000n),
      roundStates: [],
      rewardStates: [admittedReward()],
    },
  });
  const sink = checkpointSink();
  t.after(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink });
  const rewardId = hex(501);
  const reward = store.readEntity(REWARD_CAS_ENTITY_KIND.X_REWARD, rewardId);
  const committed = recordPremiumUpgradeCas({
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
  });
  advanceRewardCasExternalCheckpoint({ dailyLawState: OPEN_LAW, store, sink });
  return { store, sink, committed, rewardId };
}

test("local consumers reject an exact but stale checkpoint ancestor until the current head is anchored", (t) => {
  const context = fixture(t);
  assert.throws(
    () => prepareRewardConsumerPermit(permitInput(context)),
    /UNANCHORED_LOCAL_HEAD_HOLD/u,
  );
  advanceRewardCasExternalCheckpoint({
    dailyLawState: OPEN_LAW,
    store: context.store,
    sink: context.sink,
  });
  const permit = prepareRewardConsumerPermit(permitInput(context));
  assert.equal(permit.status, REWARD_CONSUMER_GATE_STATUS);
  assert.equal(permit.mainnetStatus, REWARD_CONSUMER_GATE_MAINNET_STATUS);
  assert.equal(permit.checkpointCommitSequence, 1n);
  assert.equal(permit.targetCommitSha256, context.committed.commit.commitSha256);
  assert.equal(permit.evidence.reservations.length, 1);
  const [reservation] = permit.evidence.reservations;
  assert.equal(reservation.disposition, "ADMITTED_RESERVED");
  assert.equal(reservation.exactAmount, 100n);
  assert.equal(
    Object.values(reservation.plannedByLane).reduce((sum, amount) => sum + amount, 0n),
    reservation.exactAmount,
  );
  assert.equal(permit.exactIndivisibleReservationsVerified, true);
  assert.equal(permit.externalSideEffectsAuthorized, false);
  assert.equal(permit.runtimeAuthenticationVerified, false);
  assert.equal(permit.rollbackProtectionVerified, false);
  assert.equal(permit.durableConsumerCursorVerified, false);
  assert.equal(permit.activationReady, false);
  assert.equal(assertRewardConsumerPermit({
    dailyLawState: OPEN_LAW,
    permit,
    consumerId: "reward-projection-v1",
    targetCommitSequence: 1n,
    targetCommitSha256: context.committed.commit.commitSha256,
  }), permit);
});

test("a copied structurally valid checkpoint is indistinguishable from an authenticated provider read", (t) => {
  const context = fixture(t);
  advanceRewardCasExternalCheckpoint({
    dailyLawState: OPEN_LAW,
    store: context.store,
    sink: context.sink,
  });
  const fabricatedProviderRead = structuredClone(context.sink.readCurrent());
  const input = { ...permitInput(context), checkpoint: fabricatedProviderRead };
  const first = prepareRewardConsumerPermit(input);
  const replay = prepareRewardConsumerPermit(input);
  assert.notEqual(first, replay);
  assert.deepEqual(first, replay);
  assert.equal(first.runtimeAuthenticationVerified, false);
  assert.equal(first.rollbackProtectionVerified, false);
  assert.equal(first.durableConsumerCursorVerified, false);
  assert.equal(first.externalSideEffectsAuthorized, false);
  assert.equal(first.activationReady, false);
  assert.equal(first.mainnetStatus, "HOLD");
});

test("underfunded outcomes carry zero lane writes and never become partial reservations", (t) => {
  const context = fixture(t, 50n);
  advanceRewardCasExternalCheckpoint({
    dailyLawState: OPEN_LAW,
    store: context.store,
    sink: context.sink,
  });
  const permit = prepareRewardConsumerPermit(permitInput(context));
  const [reservation] = permit.evidence.reservations;
  assert.equal(reservation.disposition, "NULL_UNDERFUNDED");
  assert.equal(reservation.exactAmount, 100n);
  assert.deepEqual(reservation.plannedByLane, {
    treasury: 0n,
    ecosystem: 0n,
    liquidity: 0n,
  });
});

test("Premium-upgrade projection is bound to the exact one-shot attempt and anchored commit", (t) => {
  const context = upgradeFixture(t);
  const permit = prepareRewardConsumerPermit({
    dailyLawState: OPEN_LAW,
    store: context.store,
    checkpoint: context.sink.readCurrent(),
    consumerId: "premium-upgrade-projection-v1",
    scope: REWARD_CONSUMER_SCOPE.LOCAL_PROJECTION,
    targetCommitSequence: context.committed.commit.sequence,
    targetCommitSha256: context.committed.commit.commitSha256,
  });
  assert.equal(permit.targetOperation, "RECORD_X_PREMIUM_UPGRADE");
  assert.equal(permit.evidence.rewardId, context.rewardId);
  assert.equal(permit.evidence.evidenceSha256, context.committed.upgradeAttempt.attemptSha256);
  assert.deepEqual(permit.evidence.reservations, []);
  assert.equal(permit.externalSideEffectsAuthorized, false);
});

test("external effects, stale targets, forged permits, and changed law state all fail closed", (t) => {
  const context = fixture(t);
  advanceRewardCasExternalCheckpoint({
    dailyLawState: OPEN_LAW,
    store: context.store,
    sink: context.sink,
  });
  const canonical = permitInput(context);
  assert.throws(
    () => prepareRewardConsumerPermit({ ...canonical, scope: REWARD_CONSUMER_SCOPE.EXTERNAL_EFFECT }),
    /EXTERNAL_EFFECTS_HOLD/u,
  );
  assert.throws(
    () => prepareRewardConsumerPermit({ ...canonical, targetCommitSha256: "ff".repeat(32) }),
    /TARGET_COMMIT_MISMATCH/u,
  );
  const permit = prepareRewardConsumerPermit(canonical);
  assert.throws(() => assertRewardConsumerPermit({
    dailyLawState: OPEN_LAW,
    permit: structuredClone(permit),
    consumerId: canonical.consumerId,
    targetCommitSequence: 1n,
    targetCommitSha256: canonical.targetCommitSha256,
  }), /INVALID_REWARD_CONSUMER_PERMIT/u);
  assert.throws(() => assertRewardConsumerPermit({
    dailyLawState: LOCKED_LAW,
    permit,
    consumerId: canonical.consumerId,
    targetCommitSequence: 1n,
    targetCommitSha256: canonical.targetCommitSha256,
  }), /IAT_DAILY_LOCKDOWN/u);
});

test("Daily Law is checked before any store, checkpoint, or consumer field is read", () => {
  let laterRead = false;
  const poison = {
    dailyLawState: {},
    get store() {
      laterRead = true;
      throw new Error("STORE_READ_BEFORE_LAW");
    },
    get checkpoint() {
      laterRead = true;
      throw new Error("CHECKPOINT_READ_BEFORE_LAW");
    },
  };
  assert.throws(() => prepareRewardConsumerPermit(poison), /INVALID_IAT_DAILY_LAW_STATE/u);
  assert.equal(laterRead, false);

  const poisonAssertion = {
    dailyLawState: {},
    get permit() {
      laterRead = true;
      throw new Error("PERMIT_READ_BEFORE_LAW");
    },
  };
  assert.throws(() => assertRewardConsumerPermit(poisonAssertion), /INVALID_IAT_DAILY_LAW_STATE/u);
  assert.equal(laterRead, false);
});

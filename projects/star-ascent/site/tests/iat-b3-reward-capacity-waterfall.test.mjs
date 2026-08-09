import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  CLAIM_EXPIRY_DAYS,
  REWARD_CAPACITY_POLICY,
  REWARD_LANE_ORDER,
  REWARD_PRIORITY_CLASSES,
  UTC_DAY_SECONDS,
  X_BOUND_SOURCE_PRIORITY,
  X_TRANCHE_BASIS_POINTS,
  X_TRANCHE_KIND,
  allocateRewardCapacity,
  applyXBoundMissedFundingOutcome,
  applyXBoundFundingOutcome,
  buildWeeklyFactionManifestObligation,
  buildXBoundFundingObligation,
  claimReservedXBoundTranches,
  cleanupExpiredXBoundReward,
  createCccPrecommitRegistrySnapshot,
  createCccRevealCommitment,
  createXBoundReward,
  effectiveXBoundRewardStatus,
  logicalMissedFundingOutcome,
  orderCccCapacityCandidates,
  recordPremiumUpgrade,
  sealRewardCapacityRound,
} from "../programs/iat_b3_reference/reward-capacity-waterfall.mjs";
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
const OPEN_DECISION = createLockdownDecision({
  localDay: CURRENT_DAY,
  randomnessOutputHex: "00".repeat(32),
  schedule: TEST_SCHEDULE,
});
const LOCKED_DECISION = createLockdownDecision({
  localDay: CURRENT_DAY,
  randomnessOutputHex: `${"00".repeat(31)}01`,
  schedule: TEST_SCHEDULE,
});
const OPEN_LAW = createDailyLawState({
  protocolHeight: 86_520n,
  schedule: TEST_SCHEDULE,
  currentDecision: OPEN_DECISION,
});
const LOCKED_LAW = createDailyLawState({
  protocolHeight: 86_520n,
  schedule: TEST_SCHEDULE,
  currentDecision: LOCKED_DECISION,
});
const hex = (value) => value.toString(16).padStart(64, "0");
const canonicalize = (value) => Array.isArray(value)
  ? value.map(canonicalize)
  : (value && typeof value === "object"
    ? Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((key) => [key, canonicalize(value[key])]),
    )
    : value);
const stateDigest = (value) => createHash("sha256")
  .update(JSON.stringify(canonicalize(value), (_key, entry) => (
    typeof entry === "bigint" ? entry.toString() : entry
  )))
  .digest("hex");

function rewardInput(overrides = {}) {
  return {
    dailyLawState: OPEN_LAW,
    rewardId: hex(1),
    rewardSourceKind: "X_INTERACTION",
    wallet: "wallet-one",
    xUserId: "9000000000000001",
    grossBaseUnits: 1_000n,
    epochClosedAtUnixSeconds: FUNDING_ROUND,
    subscriptionType: "None",
    subscriptionObservedAtUnixSeconds: FUNDING_ROUND - 3_600n,
    activityQualificationSequence: 10n,
    nodeActivationSequence: 8n,
    ...overrides,
  };
}

function ledger({
  treasury = 0n,
  ecosystem = 0n,
  liquidity = 0n,
  treasuryReserved = 0n,
  ecosystemReserved = 0n,
  liquidityReserved = 0n,
} = {}) {
  const lane = (unlocked, reserved = 0n) => ({ unlocked, reserved, paid: 0n, withdrawn: 0n });
  return {
    lanes: {
      treasury: lane(treasury, treasuryReserved),
      ecosystem: lane(ecosystem, ecosystemReserved),
      liquidity: lane(liquidity, liquidityReserved),
    },
  };
}

function chronology(sequence, identity = `identity-${sequence}`) {
  return {
    eligibleSequence: BigInt(sequence),
    activitySequence: BigInt(sequence),
    nodeSequence: BigInt(sequence),
    immutableIdentity: identity,
    commitmentDigest: hex(10_000 + Number(sequence)),
  };
}

function obligation({ id, priorityClass, amount, sequence = 1, fundingPool = "SHARED_REWARD_RESERVE" }) {
  return {
    id: hex(id),
    priorityClass,
    amount: BigInt(amount),
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool,
    reservationStatus: "NEW_UNRESERVED",
    chronology: chronology(sequence),
  };
}

function ccc({
  id,
  priorityClass = "CCC_AGENT",
  amount = 1,
  activity = 1,
  node = 1,
  eligible = Math.max(activity, node),
  pda = id,
}) {
  return {
    id: hex(id),
    priorityClass,
    amount: BigInt(amount),
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    qualifyingActivityStartSlot: BigInt(activity),
    nodeActivationSlot: BigInt(node),
    eligibleSequence: BigInt(eligible),
    qualificationPda: hex(pda),
  };
}

function factionFragment({ id, amount, sequence = id, trancheKind = X_TRANCHE_KIND.BASE }) {
  return {
    id: hex(id),
    kind: "X_BOUND_FACTION_FRAGMENT",
    rewardId: hex(1_000 + id),
    rewardSourceKind: "FACTION_FOLLOWER",
    trancheKinds: [trancheKind],
    priorityClass: "WEEKLY_FACTION",
    amount: BigInt(amount),
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    chronology: chronology(sequence, `faction-follower-${id}`),
  };
}

function factionManifest({ id = "2026-W32", fragments }) {
  return buildWeeklyFactionManifestObligation({
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    factionWeekId: id,
    followerObligations: fragments,
  });
}

function sealRound({
  obligations,
  boundaryLedger = ledger({ treasury: 1_000n }),
  revealHex = null,
  sourceId = "slot-hashes-round-42",
}) {
  const cccRevealCommitment = revealHex === null ? null : createCccRevealCommitment({
    sourceId,
    committedAtUnixSeconds: FUNDING_ROUND - 1n,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    randomnessHex: revealHex,
  });
  const cccPrecommitRegistrySnapshot = createCccPrecommitRegistrySnapshot({
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    commitments: cccRevealCommitment === null ? [] : [cccRevealCommitment],
  });
  const roundState = sealRewardCapacityRound({
    dailyLawState: OPEN_LAW,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    sealedAtUnixSeconds: FUNDING_ROUND,
    obligations,
    ledgerSnapshot: boundaryLedger,
    cccPrecommitRegistrySnapshot,
  });
  return {
    roundState,
    seal: roundState.roundSeal,
    reveal: revealHex === null ? null : { sourceId, randomnessHex: revealHex },
  };
}

function allocateSealed({ roundState, reveal }, overrides = {}) {
  return allocateRewardCapacity({
    dailyLawState: OPEN_LAW,
    roundState,
    cccRandomnessReveal: reveal,
    ...overrides,
  });
}

function admitRewardBase(reward, capacity = 1_000n) {
  const due = buildXBoundFundingObligation({ reward, fundingRoundAtUnixSeconds: FUNDING_ROUND });
  const sealed = sealRound({ obligations: [due], boundaryLedger: ledger({ treasury: capacity }) });
  const allocation = allocateSealed(sealed);
  return {
    reward: applyXBoundFundingOutcome({
      dailyLawState: OPEN_LAW,
      reward,
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
      outcome: allocation.funded[0] ?? allocation.nullOutcomes[0],
      roundState: allocation.roundState,
      cccRandomnessReveal: sealed.reveal,
    }),
    sealed,
    allocation,
  };
}

test("policy freezes non-activation, class/lane order, and the common three-kind basis-point model", () => {
  assert.deepEqual(REWARD_PRIORITY_CLASSES, [
    "CCC_AGENT",
    "CCC_ASSOCIATE",
    "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
    "WEEKLY_FACTION",
    "CORE",
  ]);
  assert.deepEqual(REWARD_LANE_ORDER, ["treasury", "ecosystem", "liquidity"]);
  assert.deepEqual(X_TRANCHE_KIND, {
    BASE: "X_BASE_10",
    PREMIUM_FULL: "X_PREMIUM_FULL_100",
    UPGRADE: "X_PREMIUM_UPGRADE_90",
  });
  assert.deepEqual(X_TRANCHE_BASIS_POINTS, {
    X_BASE_10: 1_000,
    X_PREMIUM_FULL_100: 10_000,
    X_PREMIUM_UPGRADE_90: 9_000,
  });
  assert.equal(REWARD_CAPACITY_POLICY.activationReady, false);
  assert.equal(REWARD_CAPACITY_POLICY.directApplicationPermitted, false);
  assert.equal(REWARD_CAPACITY_POLICY.scope.cccGenesisActive, false);
  assert.equal(REWARD_CAPACITY_POLICY.scope.roundSnapshotAdapterAuthenticated, false);
  assert.equal(REWARD_CAPACITY_POLICY.scope.cccRandomnessProvenanceAuthenticated, false);
  assert.equal(REWARD_CAPACITY_POLICY.scope.cccPrecommitRegistryAuthenticated, false);
  assert.equal(REWARD_CAPACITY_POLICY.scope.roundStatePersistenceAuthenticated, false);
  assert.equal(REWARD_CAPACITY_POLICY.scope.allocatorReceiptPersistenceAuthenticated, false);
  assert.equal(
    REWARD_CAPACITY_POLICY.roundSealing.outcomeValidationRule,
    "EXACT_DETERMINISTIC_RECOMPUTATION_FROM_SEALED_INPUTS",
  );
  assert.deepEqual(REWARD_CAPACITY_POLICY.xBoundRewards.sourceKindPriorityMap, X_BOUND_SOURCE_PRIORITY);
});

test("every supported new X-bound source retains its class while generic airdrop/core are rejected", () => {
  const expected = Object.entries(X_BOUND_SOURCE_PRIORITY);
  for (const [rewardSourceKind, priorityClass] of expected) {
    const offset = expected.findIndex(([kind]) => kind === rewardSourceKind);
    const cccFields = priorityClass.startsWith("CCC_")
      ? { qualifyingActivityStartSlot: 1n, nodeActivationSlot: 2n, qualificationPda: hex(offset + 100) }
      : {};
    const reward = createXBoundReward(rewardInput({ rewardId: hex(offset + 10), rewardSourceKind, ...cccFields }));
    assert.equal(reward.priorityClass, priorityClass);
    const due = buildXBoundFundingObligation({ reward, fundingRoundAtUnixSeconds: FUNDING_ROUND });
    assert.equal(due.priorityClass, priorityClass);
    assert.equal(due.fundingPool, "SHARED_REWARD_RESERVE");
    if (rewardSourceKind === "FACTION_FOLLOWER") {
      assert.equal(due.kind, "X_BOUND_FACTION_FRAGMENT");
      assert.throws(() => sealRound({ obligations: [due] }), /AGGREGATE_WEEKLY_MANIFEST/u);
    }
  }
  for (const rewardSourceKind of ["AIRDROP", "CORE", "DEVNET_FAUCET"]) {
    assert.throws(() => createXBoundReward(rewardInput({ rewardSourceKind })), /UNSUPPORTED_X_BOUND/u);
  }
});

test("non-Premium is exact 10/90 and Premium-at-close is one indivisible full-100 tranche", () => {
  const nonPremium = createXBoundReward(rewardInput());
  assert.equal(nonPremium.baseTranche.amount, 100n);
  assert.equal(nonPremium.premiumFullTranche, null);
  assert.equal(nonPremium.upgradeTranche.amount, 900n);
  assert.equal(nonPremium.upgradeTranche.status, "LOCKED_PENDING_PREMIUM");
  assert.deepEqual(
    buildXBoundFundingObligation({ reward: nonPremium, fundingRoundAtUnixSeconds: FUNDING_ROUND }).trancheKinds,
    [X_TRANCHE_KIND.BASE],
  );

  const premium = createXBoundReward(rewardInput({ rewardId: hex(2), subscriptionType: "Premium" }));
  assert.equal(premium.baseTranche, null);
  assert.equal(premium.upgradeTranche, null);
  assert.equal(premium.premiumFullTranche.amount, 1_000n);
  const due = buildXBoundFundingObligation({ reward: premium, fundingRoundAtUnixSeconds: FUNDING_ROUND });
  assert.equal(due.amount, 1_000n);
  assert.deepEqual(due.trancheKinds, [X_TRANCHE_KIND.PREMIUM_FULL]);

  const admitted = admitRewardBase(premium, 1_000n).reward;
  assert.equal(admitted.premiumFullTranche.status, "ADMITTED_RESERVED");
  assert.throws(() => claimReservedXBoundTranches({
    dailyLawState: OPEN_LAW,
    reward: admitted,
    trancheKinds: [X_TRANCHE_KIND.BASE],
    nowUnixSeconds: FUNDING_ROUND + 1n,
  }), /NOT_EXACTLY_RESERVED/u);
  const claimed = claimReservedXBoundTranches({
    dailyLawState: OPEN_LAW,
    reward: admitted,
    trancheKinds: [X_TRANCHE_KIND.PREMIUM_FULL],
    nowUnixSeconds: FUNDING_ROUND + 1n,
  });
  assert.equal(claimed.premiumFullTranche.status, "CLAIMED");

  for (const bad of [
    { grossBaseUnits: 1_001n },
    { subscriptionType: "Unknown" },
    { subscriptionObservedAtUnixSeconds: FUNDING_ROUND - UTC_DAY_SECONDS - 1n },
    { epochClosedAtUnixSeconds: FUNDING_ROUND + 1n },
  ]) assert.throws(() => createXBoundReward(rewardInput(bad)));
});

test("Daily Law capability is checked before malformed reward, seal, allocation, or receipt inputs", () => {
  assert.throws(
    () => createXBoundReward(rewardInput({ dailyLawState: { disposition: "ALLOWED" }, grossBaseUnits: 1n })),
    /INVALID_IAT_DAILY_LAW_STATE/u,
  );
  assert.throws(
    () => sealRewardCapacityRound({ dailyLawState: LOCKED_LAW, fundingRoundAtUnixSeconds: 1n, obligations: null }),
    /IAT_DAILY_LOCKDOWN/u,
  );
  assert.throws(
    () => allocateRewardCapacity({ dailyLawState: LOCKED_LAW, roundSeal: null, ledger: {} }),
    /IAT_DAILY_LOCKDOWN/u,
  );
  assert.throws(
    () => applyXBoundFundingOutcome({ dailyLawState: LOCKED_LAW, reward: null, outcome: null }),
    /IAT_DAILY_LOCKDOWN/u,
  );
});

test("later Premium proof uses the next UTC round and cannot inherit an old queue position", () => {
  let reward = admitRewardBase(createXBoundReward(rewardInput()), 100n).reward;
  reward = recordPremiumUpgrade({
    dailyLawState: OPEN_LAW,
    reward,
    wallet: reward.wallet,
    xUserId: reward.xUserId,
    subscriptionType: "PremiumPlus",
    subscriptionObservedAtUnixSeconds: FUNDING_ROUND + 3_600n,
    premiumProofAcceptedAtUnixSeconds: FUNDING_ROUND + 3_600n,
    premiumProofAcceptedSequence: 50n,
  });
  assert.equal(reward.upgradeTranche.fundingRoundAtUnixSeconds, FUNDING_ROUND + UTC_DAY_SECONDS);
  assert.equal(reward.upgradeTranche.eligibleSequence, 50n);
  const topUp = buildXBoundFundingObligation({
    reward,
    fundingRoundAtUnixSeconds: FUNDING_ROUND + UTC_DAY_SECONDS,
  });
  assert.equal(topUp.amount, 900n);
  assert.equal(topUp.chronology.eligibleSequence, 50n);

  const base = admitRewardBase(createXBoundReward(rewardInput({ rewardId: hex(3) })), 100n).reward;
  assert.throws(() => recordPremiumUpgrade({
    dailyLawState: OPEN_LAW,
    reward: base,
    wallet: base.wallet,
    xUserId: base.xUserId,
    subscriptionType: "Premium",
    subscriptionObservedAtUnixSeconds: FUNDING_ROUND - 1n,
    premiumProofAcceptedAtUnixSeconds: FUNDING_ROUND + 1n,
    premiumProofAcceptedSequence: 51n,
  }), /PREMIUM_UPGRADE_MUST_BE_LATER/u);
  assert.throws(() => recordPremiumUpgrade({
    dailyLawState: OPEN_LAW,
    reward: base,
    wallet: base.wallet,
    xUserId: base.xUserId,
    subscriptionType: "Premium",
    subscriptionObservedAtUnixSeconds: FUNDING_ROUND + 1n,
    premiumProofAcceptedAtUnixSeconds: FUNDING_ROUND + 1n,
    premiumProofAcceptedSequence: base.activityQualificationSequence,
  }), /PROOF_SEQUENCE_MUST_FOLLOW/u);
});

test("failed base funding voids upgrade; missed rounds and 30-day claim expiry remain separate", () => {
  const original = createXBoundReward(rewardInput());
  const failedResult = admitRewardBase(original, 99n);
  assert.equal(failedResult.reward.baseTranche.status, "NULL_UNDERFUNDED");
  assert.equal(failedResult.reward.upgradeTranche.status, "NULL_PARENT_UNFUNDED");
  assert.throws(() => recordPremiumUpgrade({
    dailyLawState: OPEN_LAW,
    reward: failedResult.reward,
    wallet: failedResult.reward.wallet,
    xUserId: failedResult.reward.xUserId,
    subscriptionType: "Premium",
    subscriptionObservedAtUnixSeconds: FUNDING_ROUND + 1n,
    premiumProofAcceptedAtUnixSeconds: FUNDING_ROUND + 1n,
    premiumProofAcceptedSequence: 20n,
  }), /BASE_FUNDING_REQUIRED/u);

  const due = buildXBoundFundingObligation({ reward: original, fundingRoundAtUnixSeconds: FUNDING_ROUND });
  assert.throws(() => logicalMissedFundingOutcome(due, { nowUnixSeconds: FUNDING_ROUND }), /NOT_YET_DECIDABLE/u);
  assert.equal(logicalMissedFundingOutcome(due, { nowUnixSeconds: FUNDING_ROUND + 1n }).disposition, "NULL_MISSED");
  const missed = applyXBoundMissedFundingOutcome({
    dailyLawState: OPEN_LAW,
    reward: original,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    roundState: sealRound({ obligations: [] }).roundState,
    nowUnixSeconds: FUNDING_ROUND + 1n,
  });
  assert.equal(missed.baseTranche.status, "NULL_MISSED");
  assert.equal(missed.upgradeTranche.status, "NULL_PARENT_UNFUNDED");
  assert.equal(buildXBoundFundingObligation({
    reward: missed,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
  }), null);

  const expiredPending = cleanupExpiredXBoundReward({
    dailyLawState: OPEN_LAW,
    reward: createXBoundReward(rewardInput({ rewardId: hex(401) })),
    nowUnixSeconds: FUNDING_ROUND + CLAIM_EXPIRY_DAYS * UTC_DAY_SECONDS,
  });
  assert.equal(expiredPending.baseTranche.status, "NULL_CLAIM_EXPIRED");
  assert.equal(buildXBoundFundingObligation({
    reward: expiredPending,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
  }), null);

  const admitted = admitRewardBase(createXBoundReward(rewardInput({ rewardId: hex(4) })), 100n).reward;
  assert.equal(effectiveXBoundRewardStatus(admitted, FUNDING_ROUND + UTC_DAY_SECONDS).base, "ADMITTED_RESERVED");
  assert.equal(effectiveXBoundRewardStatus(admitted, admitted.claimExpiresAtUnixSeconds).base, "NULL_CLAIM_EXPIRED");
  const cleaned = cleanupExpiredXBoundReward({
    dailyLawState: OPEN_LAW,
    reward: admitted,
    nowUnixSeconds: admitted.claimExpiresAtUnixSeconds,
  });
  assert.equal(cleaned.baseTranche.status, "NULL_CLAIM_EXPIRED");
  assert.equal(cleanupExpiredXBoundReward({
    dailyLawState: OPEN_LAW,
    reward: cleaned,
    nowUnixSeconds: cleaned.claimExpiresAtUnixSeconds,
  }), cleaned);
  assert.equal(admitted.claimExpiresAtUnixSeconds, FUNDING_ROUND + CLAIM_EXPIRY_DAYS * UTC_DAY_SECONDS);
});

test("boundary seal binds candidate set and capacity; late arrivals, free ledgers, and replay fail closed", () => {
  const first = obligation({ id: 11, priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN", amount: 2, sequence: 2 });
  const second = obligation({ id: 12, priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN", amount: 2, sequence: 1 });
  const source = [first, second];
  const sealed = sealRound({ obligations: source, boundaryLedger: ledger({ treasury: 4n }) });
  source.push(obligation({ id: 13, priorityClass: "CORE", amount: 1, sequence: 1 }));
  assert.deepEqual(sealed.seal.candidateIds, [second.id, first.id]);
  assert.equal(sealed.seal.ledgerSnapshot.lanes.treasury.unlocked, 4n);
  assert.equal(logicalMissedFundingOutcome(first, {
    roundState: sealed.roundState,
    nowUnixSeconds: FUNDING_ROUND + 1n,
  }), null);
  assert.throws(() => logicalMissedFundingOutcome(source.at(-1), {
    roundState: sealed.roundState,
    nowUnixSeconds: FUNDING_ROUND,
  }), /NOT_YET_DECIDABLE/u);
  assert.equal(logicalMissedFundingOutcome(source.at(-1), {
    roundState: sealed.roundState,
    nowUnixSeconds: FUNDING_ROUND + 1n,
  }).disposition, "NULL_MISSED");
  const result = allocateSealed(sealed);
  assert.equal(result.funded.length, 2);
  assert.throws(() => allocateSealed(sealed, { ledger: ledger({ treasury: 0n }) }), /MUST_COME_FROM_BOUNDARY_SEAL/u);
  assert.throws(() => allocateSealed(sealed, { existingFinalization: null }), /TYPED_BY_VALUE_ROUND_STATE/u);
  assert.throws(() => allocateRewardCapacity({
    dailyLawState: OPEN_LAW,
    roundState: result.roundState,
  }), /NO_REPLAY/u);
  const forged = structuredClone(sealed.roundState);
  forged.roundSeal.ledgerSnapshot.lanes.treasury.unlocked = 5n;
  assert.throws(() => allocateRewardCapacity({
    dailyLawState: OPEN_LAW,
    roundState: forged,
    cccRandomnessReveal: null,
  }), /COMMITMENT_MISMATCH/u);
  assert.throws(() => sealRewardCapacityRound({
    dailyLawState: OPEN_LAW,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    sealedAtUnixSeconds: FUNDING_ROUND + 1n,
    obligations: [],
    ledgerSnapshot: ledger(),
  }), /DESIGNATED_UTC_BOUNDARY/u);
});

test("strict waterfall stops at the first underfunded head and explicitly nulls all following work", () => {
  const agent = ccc({ id: 21, amount: 6, activity: 1 });
  const associate = ccc({ id: 22, priorityClass: "CCC_ASSOCIATE", amount: 5, activity: 1 });
  const standard = obligation({ id: 23, priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN", amount: 1, sequence: 1 });
  const faction = factionManifest({ fragments: [factionFragment({ id: 24, amount: 1 })] });
  const core = obligation({ id: 25, priorityClass: "CORE", amount: 1, sequence: 1 });
  const result = allocateSealed(sealRound({
    obligations: [core, faction, standard, associate, agent],
    boundaryLedger: ledger({ treasury: 10n }),
  }));
  assert.deepEqual(result.funded.map(({ id }) => id), [agent.id]);
  assert.deepEqual(result.nullOutcomes.map(({ id, disposition }) => [id, disposition]), [
    [associate.id, "NULL_UNDERFUNDED"],
    [standard.id, "NULL_BLOCKED"],
    [faction.id, "NULL_BLOCKED"],
    [core.id, "NULL_BLOCKED"],
  ]);
  assert.equal(result.ledger.lanes.treasury.reserved, 6n);
});

test("sealed ledger preserves old reservations and plans treasury then ecosystem then liquidity", () => {
  const item = obligation({ id: 31, priorityClass: "CORE", amount: 8, sequence: 1 });
  let sealed = sealRound({
    obligations: [item],
    boundaryLedger: ledger({ treasury: 10n, ecosystem: 10n, treasuryReserved: 5n }),
  });
  let result = allocateSealed(sealed);
  assert.deepEqual(result.funded[0].plannedByLane, { treasury: 5n, ecosystem: 3n, liquidity: 0n });
  assert.equal(result.ledger.lanes.treasury.reserved, 10n);
  assert.equal(result.finalization.preLedgerSha256, sealed.seal.ledgerSnapshotSha256);
  assert.notEqual(result.finalization.postLedgerSha256, result.finalization.preLedgerSha256);

  const reorderedLedger = {
    lanes: {
      liquidity: { withdrawn: 0n, paid: 0n, reserved: 0n, unlocked: 0n },
      treasury: { paid: 0n, unlocked: 8n, withdrawn: 0n, reserved: 0n },
      ecosystem: { reserved: 0n, withdrawn: 0n, unlocked: 0n, paid: 0n },
    },
  };
  sealed = sealRound({ obligations: [item], boundaryLedger: reorderedLedger });
  result = allocateSealed(sealed);
  assert.equal(result.ledger.lanes.treasury.reserved, 8n);
  assert.deepEqual(Object.keys(result.ledger.lanes), REWARD_LANE_ORDER);

  sealed = sealRound({
    obligations: [{ ...item, amount: 16n }],
    boundaryLedger: ledger({ treasury: 10n, ecosystem: 10n, treasuryReserved: 5n }),
  });
  result = allocateSealed(sealed);
  assert.equal(result.funded.length, 0);
  assert.equal(result.nullOutcomes[0].disposition, "NULL_UNDERFUNDED");
  assert.equal(result.ledger.lanes.treasury.reserved, 5n);
  assert.throws(() => sealRound({ obligations: [{ ...item, reservationStatus: "EXISTING_RESERVED" }] }), /EXISTING_RESERVATIONS/u);
});

test("CCC exact ties require one pre-bound reveal and internally derived decision context", () => {
  const early = ccc({ id: 41, activity: 1, node: 9, pda: 41 });
  const later = ccc({ id: 42, activity: 2, node: 1, pda: 42 });
  const tieA = ccc({ id: 43, activity: 3, node: 3, pda: 43 });
  const tieB = ccc({ id: 44, activity: 3, node: 3, pda: 44 });
  const laterProof = ccc({ id: 45, activity: 3, node: 3, eligible: 50, pda: 45 });
  const revealHex = "ab".repeat(32);
  const sealed = sealRound({
    obligations: [laterProof, tieB, later, tieA, early],
    boundaryLedger: ledger({ treasury: 5n }),
    revealHex,
  });
  const result = allocateSealed(sealed);
  assert.equal(result.orderedIds[0], early.id);
  assert.equal(result.orderedIds[1], later.id);
  assert.equal(result.orderedIds.at(-1), laterProof.id);
  assert.equal(result.finalization.cccRevealCommitmentSha256, sealed.seal.cccRevealCommitment.commitmentSha256);
  assert.equal(result.finalization.cccDecisionContextSha256, sealed.seal.cccDecisionContextSha256);
  assert.equal(
    result.finalization.cccPrecommitRegistrySnapshotSha256,
    sealed.seal.cccPrecommitRegistrySnapshot.snapshotSha256,
  );
  assert.throws(() => allocateRewardCapacity({
    dailyLawState: OPEN_LAW,
    roundState: sealed.roundState,
    cccRandomnessReveal: { ...sealed.reveal, randomnessHex: "ac".repeat(32) },
  }), /DOES_NOT_MATCH_SEALED_COMMITMENT/u);
  assert.throws(() => allocateRewardCapacity({
    dailyLawState: OPEN_LAW,
    roundState: sealed.roundState,
    cccRandomnessHex: revealHex,
    cccDecisionContextHex: "cd".repeat(32),
  }), /FREE_CCC_RANDOMNESS/u);
  const forged = structuredClone(sealed.roundState);
  forged.roundSeal.cccDecisionContextSha256 = "cd".repeat(32);
  assert.throws(() => allocateRewardCapacity({
    dailyLawState: OPEN_LAW,
    roundState: forged,
    cccRandomnessReveal: sealed.reveal,
  }), /NOT_DERIVED/u);
  assert.throws(() => sealRound({
    obligations: [tieA, tieB],
    boundaryLedger: ledger({ treasury: 2n }),
  }), /ONE_CANONICAL_PRECOMMIT/u);
  const commitment = createCccRevealCommitment({
    sourceId: "slot-hashes-round-42",
    committedAtUnixSeconds: FUNDING_ROUND - 1n,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    randomnessHex: revealHex,
  });
  assert.throws(() => createCccPrecommitRegistrySnapshot({
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    commitments: [commitment, commitment],
  }), /ZERO_OR_ONE_CANONICAL_ENTRY/u);
  const mismatchedCommitmentState = structuredClone(sealed.roundState);
  mismatchedCommitmentState.roundSeal.cccRevealCommitment = {
    ...mismatchedCommitmentState.roundSeal.cccRevealCommitment,
    commitmentSha256: "ef".repeat(32),
  };
  assert.throws(() => allocateRewardCapacity({
    dailyLawState: OPEN_LAW,
    roundState: mismatchedCommitmentState,
    cccRandomnessReveal: sealed.reveal,
  }), /DOES_NOT_MATCH_CANONICAL_PRECOMMIT_REGISTRY/u);
  const mismatchedRegistryState = structuredClone(sealed.roundState);
  mismatchedRegistryState.roundSeal.cccPrecommitRegistrySnapshot.snapshotSha256 = "ef".repeat(32);
  assert.throws(() => allocateRewardCapacity({
    dailyLawState: OPEN_LAW,
    roundState: mismatchedRegistryState,
    cccRandomnessReveal: sealed.reveal,
  }), /REGISTRY_SNAPSHOT_COMMITMENT_MISMATCH/u);
  assert.throws(() => createCccRevealCommitment({
    sourceId: "late",
    committedAtUnixSeconds: FUNDING_ROUND,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    randomnessHex: revealHex,
  }), /BEFORE_FUNDING_ROUND/u);

  const options = { randomnessHex: revealHex, decisionContextHex: sealed.seal.cccDecisionContextSha256 };
  const forward = orderCccCapacityCandidates([tieB, tieA], options);
  const reverse = orderCccCapacityCandidates([tieA, tieB], options);
  assert.deepEqual(forward.map(({ id }) => id), reverse.map(({ id }) => id));
});

test("one aggregate weekly faction manifest binds every follower payout and is all-or-null", () => {
  const fragments = [factionFragment({ id: 51, amount: 4 }), factionFragment({ id: 52, amount: 4 })];
  assert.throws(() => sealRound({ obligations: fragments }), /AGGREGATE_WEEKLY_MANIFEST/u);
  const manifest = factionManifest({ fragments });
  assert.equal(manifest.followerCount, 2);
  assert.equal(manifest.amount, 8n);
  let result = allocateSealed(sealRound({
    obligations: [manifest],
    boundaryLedger: ledger({ treasury: 7n }),
  }));
  assert.equal(result.funded.length, 0);
  assert.equal(result.nullOutcomes[0].amount, 8n);
  result = allocateSealed(sealRound({
    obligations: [manifest],
    boundaryLedger: ledger({ treasury: 8n }),
  }));
  assert.deepEqual(result.funded.map(({ id }) => id), [manifest.id]);
  const secondManifest = factionManifest({ id: "2026-W33", fragments: [factionFragment({ id: 53, amount: 1 })] });
  assert.throws(() => sealRound({ obligations: [manifest, secondManifest] }), /ONE_AGGREGATE_WEEKLY/u);
  assert.throws(() => factionManifest({ fragments: [fragments[0], fragments[0]] }), /DUPLICATE_FACTION/u);
});

test("faction follower rewards are admitted only through their sealed aggregate manifest receipt", () => {
  const firstReward = createXBoundReward(rewardInput({
    rewardId: hex(61),
    rewardSourceKind: "FACTION_FOLLOWER",
    xUserId: "101",
    wallet: "faction-wallet-1",
  }));
  const secondReward = createXBoundReward(rewardInput({
    rewardId: hex(62),
    rewardSourceKind: "FACTION_FOLLOWER",
    xUserId: "102",
    wallet: "faction-wallet-2",
  }));
  const firstFragment = buildXBoundFundingObligation({ reward: firstReward, fundingRoundAtUnixSeconds: FUNDING_ROUND });
  const secondFragment = buildXBoundFundingObligation({ reward: secondReward, fundingRoundAtUnixSeconds: FUNDING_ROUND });
  const manifest = factionManifest({ fragments: [firstFragment, secondFragment] });
  const sealed = sealRound({ obligations: [manifest], boundaryLedger: ledger({ treasury: 200n }) });
  const allocation = allocateSealed(sealed);
  for (const reward of [firstReward, secondReward]) {
    const admitted = applyXBoundFundingOutcome({
      dailyLawState: OPEN_LAW,
      reward,
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
      outcome: allocation.funded[0],
      roundState: allocation.roundState,
    });
    assert.equal(admitted.baseTranche.status, "ADMITTED_RESERVED");
  }
});

test("new faction manifest uses shared residual lanes after standard and before core", () => {
  const standard = obligation({ id: 71, priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN", amount: 2, sequence: 1 });
  const faction = factionManifest({ fragments: [factionFragment({ id: 72, amount: 4 })] });
  const core = obligation({ id: 73, priorityClass: "CORE", amount: 1, sequence: 1 });
  let result = allocateSealed(sealRound({
    obligations: [core, faction, standard],
    boundaryLedger: ledger({ treasury: 7n }),
  }));
  assert.deepEqual(result.funded.map(({ id }) => id), [standard.id, faction.id, core.id]);
  result = allocateSealed(sealRound({
    obligations: [core, faction, standard],
    boundaryLedger: ledger({ treasury: 10n, treasuryReserved: 5n }),
  }));
  assert.deepEqual(result.funded.map(({ id }) => id), [standard.id]);
  assert.deepEqual(result.nullOutcomes.map(({ id, disposition }) => [id, disposition]), [
    [faction.id, "NULL_UNDERFUNDED"],
    [core.id, "NULL_BLOCKED"],
  ]);
  assert.throws(() => sealRound({
    obligations: [{ ...faction, fundingPool: "SEPARATE_COMMUNITY_CARVEOUT" }],
  }), /REQUIRES_SHARED/u);
});

test("X funding state accepts only an exact receipt bound to the seal and finalization", () => {
  const reward = createXBoundReward(rewardInput({ rewardId: hex(81) }));
  const due = buildXBoundFundingObligation({ reward, fundingRoundAtUnixSeconds: FUNDING_ROUND });
  const sealed = sealRound({ obligations: [due], boundaryLedger: ledger({ treasury: 100n }) });
  const allocation = allocateSealed(sealed);
  const outcome = allocation.funded[0];
  assert.throws(() => applyXBoundFundingOutcome({
    dailyLawState: OPEN_LAW,
    reward,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    outcome: { id: due.id, disposition: "ADMITTED_RESERVED", plannedByLane: outcome.plannedByLane },
    roundState: allocation.roundState,
  }), /NOT_EXACT_RECOMPUTATION/u);
  const forgedOutcome = structuredClone(outcome);
  forgedOutcome.allocatorReceipt.exactAmount = 99n;
  assert.throws(() => applyXBoundFundingOutcome({
    dailyLawState: OPEN_LAW,
    reward,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    outcome: forgedOutcome,
    roundState: allocation.roundState,
  }), /NOT_EXACT_RECOMPUTATION/u);
  const forgedRoundState = structuredClone(allocation.roundState);
  forgedRoundState.finalization.postLedgerSha256 = "ff".repeat(32);
  assert.throws(() => applyXBoundFundingOutcome({
    dailyLawState: OPEN_LAW,
    reward,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    outcome,
    roundState: forgedRoundState,
  }), /NOT_EXACT_RECOMPUTATION/u);

  const underfundedSealed = sealRound({
    obligations: [due],
    boundaryLedger: ledger(),
  });
  const underfundedAllocation = allocateSealed(underfundedSealed);
  const selfConsistentForgedOutcome = structuredClone(underfundedAllocation.nullOutcomes[0]);
  selfConsistentForgedOutcome.disposition = "ADMITTED_RESERVED";
  selfConsistentForgedOutcome.reason = null;
  selfConsistentForgedOutcome.plannedByLane = { treasury: 100n, ecosystem: 0n, liquidity: 0n };
  const forgedReceipt = selfConsistentForgedOutcome.allocatorReceipt;
  forgedReceipt.disposition = "ADMITTED_RESERVED";
  forgedReceipt.reason = null;
  forgedReceipt.plannedByLane = structuredClone(selfConsistentForgedOutcome.plannedByLane);
  const forgedReceiptCore = { ...forgedReceipt };
  delete forgedReceiptCore.receiptSha256;
  forgedReceipt.receiptSha256 = stateDigest(forgedReceiptCore);
  const selfConsistentForgedState = structuredClone(underfundedAllocation.roundState);
  const selfConsistentForgedFinalization = selfConsistentForgedState.finalization;
  selfConsistentForgedFinalization.receiptDigests = [forgedReceipt.receiptSha256];
  selfConsistentForgedFinalization.receiptSetSha256 = stateDigest(
    selfConsistentForgedFinalization.receiptDigests,
  );
  selfConsistentForgedFinalization.outcomeSha256 = stateDigest({
    sealSha256: selfConsistentForgedFinalization.sealSha256,
    preLedgerSha256: selfConsistentForgedFinalization.preLedgerSha256,
    postLedgerSha256: selfConsistentForgedFinalization.postLedgerSha256,
    cccPrecommitRegistrySnapshotSha256:
      selfConsistentForgedFinalization.cccPrecommitRegistrySnapshotSha256,
    cccRevealCommitmentSha256: selfConsistentForgedFinalization.cccRevealCommitmentSha256,
    cccRevealSha256: selfConsistentForgedFinalization.cccRevealSha256,
    cccRevealSourceId: selfConsistentForgedFinalization.cccRevealSourceId,
    cccDecisionContextSha256: selfConsistentForgedFinalization.cccDecisionContextSha256,
    receiptDigests: selfConsistentForgedFinalization.receiptDigests,
  });
  assert.throws(() => applyXBoundFundingOutcome({
    dailyLawState: OPEN_LAW,
    reward,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    outcome: selfConsistentForgedOutcome,
    roundState: selfConsistentForgedState,
  }), /NOT_EXACT_RECOMPUTATION/u);

  const admitted = applyXBoundFundingOutcome({
    dailyLawState: OPEN_LAW,
    reward,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    outcome,
    roundState: allocation.roundState,
  });
  assert.equal(admitted.baseTranche.status, "ADMITTED_RESERVED");
});

test("committed validator is read-only", () => {
  const script = fileURLToPath(new URL("../scripts/validate-iat-b3-reward-capacity-waterfall.mjs", import.meta.url));
  const run = spawnSync(process.execPath, [script], { encoding: "utf8", timeout: 20_000 });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /PASS: non-activating B3 reward-capacity reference/u);
});

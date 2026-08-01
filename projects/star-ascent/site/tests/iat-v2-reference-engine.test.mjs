import assert from "node:assert/strict";
import test from "node:test";
import {
  IAT_V2_POLICY,
  availableLaneCapacity,
  claimVestedLanePrincipal,
  cccRoundAtTimestamp,
  closePosition,
  cumulativeCorePrincipalUnlocked,
  cumulativeRewardDue,
  cumulativeUnlocked,
  initializeRewardLedger,
  maximumRewardObligation,
  openPosition,
  policyWeekAtTimestamp,
  reserveOrdered,
  selectAgencyIndex,
  selectUniformTiebreakOutcome,
  selectUniformTiebreakIndex,
  settleCccRound,
  settleCoreRewardWeek,
  settlePositionWeek,
  withdrawPositionPrincipal,
} from "../engagement/iat-v2-reference-engine.mjs";

const IAT = 1_000_000_000n;

test("fixed supply, allocation total, and reward reserve are exact", () => {
  const allocations = Object.values(IAT_V2_POLICY.allocations)
    .reduce((sum, allocation) => sum + BigInt(allocation.baseUnitAmount), 0n);
  assert.equal(allocations, 1_000_000_000_000_000_000n);
  const reserve = IAT_V2_POLICY.rewardReserve.orderedLanes
    .reduce((sum, lane) => sum + BigInt(IAT_V2_POLICY.allocations[lane].baseUnitAmount), 0n);
  assert.equal(reserve, 400_000_000_000_000_000n);
  assert.equal(IAT_V2_POLICY.rewardReserve.genesisUnlockedBaseUnits, "100000000000000000");
});

test("reserve lanes expose 25% at genesis and only linear remainder after each cliff", () => {
  assert.equal(cumulativeUnlocked("treasury", 0), 50_000_000n * IAT);
  assert.equal(cumulativeUnlocked("treasury", 51), 50_000_000n * IAT);
  assert.equal(cumulativeUnlocked("treasury", 130), 125_000_000n * IAT);
  assert.equal(cumulativeUnlocked("treasury", 208), 200_000_000n * IAT);
  assert.equal(cumulativeUnlocked("ecosystem", 0), 37_500_000n * IAT);
  assert.equal(cumulativeUnlocked("ecosystem", 65), 93_750_000n * IAT);
  assert.equal(cumulativeUnlocked("ecosystem", 104), 150_000_000n * IAT);
  assert.equal(cumulativeUnlocked("liquidity", 0), 12_500_000n * IAT);
  assert.equal(cumulativeUnlocked("liquidity", 65), 31_250_000n * IAT);
  assert.equal(cumulativeUnlocked("liquidity", 104), 50_000_000n * IAT);
});

test("core principal has a 26-week cliff and reaches 100% at week 104", () => {
  assert.equal(cumulativeCorePrincipalUnlocked(25), 0n);
  assert.equal(cumulativeCorePrincipalUnlocked(26), 0n);
  assert.equal(cumulativeCorePrincipalUnlocked(65), 50_000_000n * IAT);
  assert.equal(cumulativeCorePrincipalUnlocked(104), 100_000_000n * IAT);
});

test("virtual timestamps flip only at exact policy and CCC boundaries", () => {
  const genesis = 1_900_000_000;
  const week = IAT_V2_POLICY.time.secondsPerWeek;
  assert.throws(() => policyWeekAtTimestamp(genesis, genesis - 1), /TIMESTAMP_BEFORE_GENESIS/);
  assert.equal(policyWeekAtTimestamp(genesis, genesis), 0);
  assert.equal(policyWeekAtTimestamp(genesis, genesis + 52 * week - 1), 51);
  assert.equal(policyWeekAtTimestamp(genesis, genesis + 52 * week), 52);
  assert.throws(() => cccRoundAtTimestamp(genesis, genesis + 86_399), /CCC_SELECTION_NOT_OPEN/);
  assert.equal(cccRoundAtTimestamp(genesis, genesis + 86_400), 0);
  assert.equal(cccRoundAtTimestamp(genesis, genesis + 86_400 + week - 1), 0);
  assert.equal(cccRoundAtTimestamp(genesis, genesis + 86_400 + week), 1);
});

test("simple annual rates do not compound and round cumulatively", () => {
  const principal = 1_000n * IAT;
  assert.equal(maximumRewardObligation(principal, 1000, 52), 100n * IAT);
  assert.equal(maximumRewardObligation(principal, 2000, 52), 200n * IAT);
  assert.equal(maximumRewardObligation(principal, 2800, 52), 280n * IAT);
  assert.equal(cumulativeRewardDue(principal, 1000, 26), 50n * IAT);
  assert.equal(cumulativeRewardDue(principal, 1000, 52), 100n * IAT);
});

test("core reward reserves 34M IAT before user positions and remains 17%", () => {
  let { ledger, coreReward } = initializeRewardLedger();
  assert.equal(coreReward.reservation.treasury, 34_000_000n * IAT);
  assert.equal(availableLaneCapacity(ledger, "treasury", 0), 16_000_000n * IAT);
  for (let week = 0; week < 104; week += 1) {
    ({ ledger, coreReward } = settleCoreRewardWeek({ ledger, coreReward, week }));
  }
  assert.equal(coreReward.paid, 34_000_000n * IAT);
  assert.equal(coreReward.reservation.treasury, 0n);
});

test("ordered reservations cross treasury, ecosystem, then liquidity and reject debt", () => {
  const initialized = initializeRewardLedger();
  const reserved = reserveOrdered(initialized.ledger, 66_000_000n * IAT, 0);
  assert.deepEqual(reserved.reservation, {
    treasury: 16_000_000n * IAT,
    ecosystem: 37_500_000n * IAT,
    liquidity: 12_500_000n * IAT,
  });
  assert.throws(
    () => reserveOrdered(reserved.ledger, 1n, 0),
    (error) => error.code === "INSUFFICIENT_UNLOCKED_REWARD_CAPACITY",
  );
});

test("positions reserve their complete fixed-term obligation at acceptance", () => {
  const initialized = initializeRewardLedger();
  const opened = openPosition({
    ledger: initialized.ledger,
    owner: "owner-1",
    principal: 10_000_000n * IAT,
    role: "cccAgent",
    agencyIndex: 7,
    acceptedWeek: 0,
  });
  assert.equal(opened.position.maximumObligation, 2_800_000n * IAT);
  assert.equal(opened.position.firstAccrualWeek, 1);
  assert.equal(opened.position.termWeeks, 52);
});

test("standard positions settle without depending on a CCC round", () => {
  const initialized = initializeRewardLedger();
  const opened = openPosition({
    ledger: initialized.ledger,
    owner: "standard",
    principal: 520n * IAT,
    role: "standard",
    acceptedWeek: 0,
  });
  const settled = settlePositionWeek({
    ledger: opened.ledger,
    position: opened.position,
    week: 1,
  });
  assert.equal(settled.settlement.paused, false);
  assert(settled.settlement.amount > 0n);
  assert.throws(
    () => settlePositionWeek({
      ledger: opened.ledger,
      position: opened.position,
      round: { week: 1, status: "SETTLED", selectedAgencyIndex: 0 },
    }),
    /STANDARD_ROUND_MUST_BE_OMITTED/,
  );
});

test("weekly CCC selection is deterministic, public, and cannot reroll", () => {
  const randomness = "f".repeat(64);
  const expected = selectAgencyIndex(randomness, 11);
  assert.equal(selectAgencyIndex(randomness, 11), expected);
  assert(expected >= 0 && expected < 11);
  const round = settleCccRound({ week: 4, agencyCountSnapshot: 11, randomnessHex: randomness });
  assert.equal(round.selectedAgencyIndex, expected);
  assert.throws(
    () => settleCccRound({ week: 4, agencyCountSnapshot: 11, randomnessHex: "0".repeat(64), existingRound: round }),
    /ROUND_ALREADY_SETTLED_NO_REROLL/,
  );
});

test("one oracle roll resolves a 100-way tie with exact-uniform rejection sampling", () => {
  const input = {
    randomnessHex: "a5".repeat(32),
    candidateCount: 100,
    decisionContextHex: "42".repeat(32),
  };
  const winner = selectUniformTiebreakIndex(input);
  assert.equal(selectUniformTiebreakIndex(input), winner);
  assert.equal(winner, 1);
  assert.deepEqual(selectUniformTiebreakOutcome(input), {
    index: 1,
    derivationCounter: 0,
  });
});

test("sniped agency and associates earn zero for the turn while core rate is unchanged", () => {
  const initialized = initializeRewardLedger();
  const agentOpened = openPosition({
    ledger: initialized.ledger,
    owner: "agent",
    principal: 1_000n * IAT,
    role: "cccAgent",
    agencyIndex: 3,
    acceptedWeek: 0,
  });
  const round = { week: 1, status: "SETTLED", selectedAgencyIndex: 3 };
  const agentSettlement = settlePositionWeek({
    ledger: agentOpened.ledger,
    position: agentOpened.position,
    round,
  });
  assert.equal(agentSettlement.settlement.paused, true);
  assert.equal(agentSettlement.settlement.amount, 0n);
  const coreSettlement = settleCoreRewardWeek({
    ledger: agentSettlement.ledger,
    coreReward: initialized.coreReward,
    week: 0,
  });
  assert.equal(coreSettlement.settlement.rateBps, 1700);
  assert(coreSettlement.settlement.amount > 0n);
});

test("unused reserved rewards return at exact on-chain maturity after principal return and 52 settlements", () => {
  const initialized = initializeRewardLedger();
  let { ledger, position } = openPosition({
    ledger: initialized.ledger,
    owner: "associate",
    principal: 52_000n * IAT,
    role: "cccAssociate",
    agencyIndex: 2,
    acceptedWeek: 0,
  });
  for (let week = 1; week <= 52; week += 1) {
    ({ ledger, position } = settlePositionWeek({
      ledger,
      position,
      round: { week, status: "SETTLED", selectedAgencyIndex: 2 },
    }));
  }
  assert.equal(position.paid, 0n);
  assert(position.reservation.treasury > 0n);
  assert.throws(() => withdrawPositionPrincipal({ position, currentWeek: 51 }), /POSITION_TERM_NOT_COMPLETE/);
  assert.throws(
    () => closePosition({ ledger, position, currentWeek: 52 }),
    /PRINCIPAL_NOT_RETURNED/,
  );
  const withdrawn = withdrawPositionPrincipal({ position, currentWeek: 52 });
  assert.equal(withdrawn.principalReturned, 52_000n * IAT);
  const closed = closePosition({ ledger, position: withdrawn.position, currentWeek: 52 });
  assert.equal(closed.position.reservation.treasury, 0n);
});

test("permissionless vested-lane release cannot spend reserved rewards", () => {
  const initialized = initializeRewardLedger();
  const claimed = claimVestedLanePrincipal(initialized.ledger, "treasury", 0);
  assert.equal(claimed.amount, 16_000_000n * IAT);
  assert.equal(availableLaneCapacity(claimed.ledger, "treasury", 0), 0n);
  assert.throws(
    () => claimVestedLanePrincipal(claimed.ledger, "treasury", 0),
    /NOTHING_VESTED_TO_CLAIM/,
  );
});

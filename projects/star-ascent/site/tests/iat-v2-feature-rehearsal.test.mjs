import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  IAT_V2_SECONDS_PER_DAY,
  IAT_V2_POSITION_TERM_WEEKS,
  IAT_V2_SECONDS_PER_WEEK,
  assertIatV2RehearsalAllocationBalances,
  currentIatV2CccRound,
  currentIatV2Week,
  earliestDueIatV2PositionWeek,
  formatRehearsalWait,
  isIatV2LinkedRoundReadyForSettlement,
  iterateUnsetIatV2PositionWeeks,
  selectIatV2FeatureDuePositionSettlement,
  secondsUntilIatV2CccRound,
  secondsUntilIatV2RoundRecovery,
  secondsUntilIatV2Week,
} from "../programs/iat_v2/feature-rehearsal.mjs";

const featureConsoleSource = readFileSync(
  "tools/iat-v2-admin-console/FeatureRehearsal.jsx",
  "utf8",
);

const allocations = {
  community: { amount: 500n },
  treasury: { amount: 200n },
  ecosystem: { amount: 150n },
  coreTeam: { amount: 100n },
  liquidity: { amount: 50n },
};

test("allocation verification permits only legitimate post-activation outflows", () => {
  const exact = {
    community: 500n,
    treasury: 200n,
    ecosystem: 150n,
    coreTeam: 100n,
    liquidity: 50n,
  };
  assert.doesNotThrow(() => assertIatV2RehearsalAllocationBalances({
    balances: exact,
    allocationDestinations: allocations,
    active: false,
  }));
  assert.throws(
    () => assertIatV2RehearsalAllocationBalances({
      balances: { ...exact, community: 470n },
      allocationDestinations: allocations,
      active: false,
    }),
    /community balance is 470, expected 500/,
  );
  assert.doesNotThrow(() => assertIatV2RehearsalAllocationBalances({
    balances: {
      community: 470n,
      treasury: 199n,
      ecosystem: 150n,
      coreTeam: 100n,
      liquidity: 37n,
    },
    allocationDestinations: allocations,
    active: true,
  }));
  assert.throws(
    () => assertIatV2RehearsalAllocationBalances({
      balances: { ...exact, treasury: 201n },
      allocationDestinations: allocations,
      active: true,
    }),
    /treasury balance is 201, above original allocation 200/,
  );
});

test("policy weeks and CCC rounds preserve the reviewed 24-hour offset", () => {
  const genesis = 1_800_000_000;
  assert.equal(currentIatV2Week(genesis, genesis), 0);
  assert.equal(currentIatV2CccRound(genesis, genesis), null);
  assert.equal(currentIatV2CccRound(genesis, genesis + IAT_V2_SECONDS_PER_DAY), 0);
  assert.equal(
    currentIatV2Week(genesis, genesis + IAT_V2_SECONDS_PER_WEEK),
    1,
  );
  assert.equal(
    currentIatV2CccRound(genesis, genesis + IAT_V2_SECONDS_PER_WEEK),
    0,
  );
  assert.equal(
    currentIatV2CccRound(
      genesis,
      genesis + IAT_V2_SECONDS_PER_DAY + IAT_V2_SECONDS_PER_WEEK,
    ),
    1,
  );
});

test("wait helpers expose the unavoidable CCC-linked settlement delay", () => {
  const genesis = 1_800_000_000;
  const justBeforeWeekEight = genesis + (8 * IAT_V2_SECONDS_PER_WEEK) - 3_600;
  assert.equal(secondsUntilIatV2Week(genesis, 8, justBeforeWeekEight), 3_600);
  assert.equal(
    secondsUntilIatV2CccRound(genesis, 8, justBeforeWeekEight),
    IAT_V2_SECONDS_PER_DAY + 3_600,
  );
  assert.equal(formatRehearsalWait(IAT_V2_SECONDS_PER_DAY + 3_600), "1d 1h 0m");
});

test("round recovery wait flips only at the exact 24-hour reveal timeout", () => {
  const committedAt = 1_900_000_000;
  assert.equal(
    secondsUntilIatV2RoundRecovery(committedAt, committedAt + IAT_V2_SECONDS_PER_DAY - 1),
    1,
  );
  assert.equal(
    secondsUntilIatV2RoundRecovery(committedAt, committedAt + IAT_V2_SECONDS_PER_DAY),
    0,
  );
  assert.throws(
    () => secondsUntilIatV2RoundRecovery(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
    /outside the safe integer range/,
  );
});

test("the 52-bit iterator preserves ordinal zero and finds the earliest gap", () => {
  assert.equal(IAT_V2_POSITION_TERM_WEEKS, 52);
  assert.deepEqual(
    [...iterateUnsetIatV2PositionWeeks({
      firstAccrualWeek: 9n,
      settledMask: 0n,
    })].slice(0, 3),
    [
      { ordinal: 0, week: 9 },
      { ordinal: 1, week: 10 },
      { ordinal: 2, week: 11 },
    ],
  );
  assert.deepEqual(
    [...iterateUnsetIatV2PositionWeeks({
      firstAccrualWeek: 9n,
      settledMask: 0b0101n,
    })].slice(0, 2),
    [
      { ordinal: 1, week: 10 },
      { ordinal: 3, week: 12 },
    ],
  );
  assert.deepEqual(
    [...iterateUnsetIatV2PositionWeeks({
      firstAccrualWeek: 9n,
      settledMask: (1n << 52n) - 1n,
    })],
    [],
  );
});

test("due-week selection rejects future weeks and malformed masks", () => {
  assert.equal(earliestDueIatV2PositionWeek({
    firstAccrualWeek: 9n,
    settledMask: 0n,
    currentWeek: 8,
  }), null);
  assert.deepEqual(earliestDueIatV2PositionWeek({
    firstAccrualWeek: 9n,
    settledMask: 0n,
    currentWeek: 9,
  }), { ordinal: 0, week: 9 });
  assert.equal(earliestDueIatV2PositionWeek({
    firstAccrualWeek: 9n,
    settledMask: 1n,
    currentWeek: 9,
  }), null);
  assert.deepEqual(earliestDueIatV2PositionWeek({
    firstAccrualWeek: 9n,
    settledMask: 1n,
    currentWeek: 10,
  }), { ordinal: 1, week: 10 });
  for (const hostileMask of [-1n, 1n << 52n, 0]) {
    assert.throws(
      () => [...iterateUnsetIatV2PositionWeeks({
        firstAccrualWeek: 9n,
        settledMask: hostileMask,
      })],
      /unsigned 52-bit bigint/u,
    );
  }
});

test("linked weekly settlement accepts only terminal round states", () => {
  assert.equal(isIatV2LinkedRoundReadyForSettlement({ status: 0 }), false);
  assert.equal(isIatV2LinkedRoundReadyForSettlement({ status: 1 }), true);
  assert.equal(isIatV2LinkedRoundReadyForSettlement({ status: 2 }), true);
  assert.equal(isIatV2LinkedRoundReadyForSettlement({ status: 3 }), false);
  assert.equal(isIatV2LinkedRoundReadyForSettlement({ status: "1" }), false);
  assert.equal(isIatV2LinkedRoundReadyForSettlement(null), false);
});

test("a due standard week 9 blocks linked work and the CCC round 9 commit", () => {
  const positions = [
    { firstAccrualWeek: 9n, settledMask: 0n },
    { firstAccrualWeek: 9n, settledMask: 0n },
    { firstAccrualWeek: 9n, settledMask: 0n },
  ];
  assert.deepEqual(selectIatV2FeatureDuePositionSettlement({
    positions,
    currentWeek: 9,
    linkedRounds: { 9: { status: 1 } },
  }), {
    positionIndex: 0,
    ordinal: 0,
    week: 9,
    round: null,
  });

  const plannerSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("function nextFeatureAction"),
    featureConsoleSource.indexOf("function waitDescription"),
  );
  const settlementPriority = plannerSource.indexOf(
    "const dueSettlement = selectIatV2FeatureDuePositionSettlement",
  );
  const randomnessCreation = plannerSource.indexOf("if (!state.randomnessAddress)");
  const roundCommit = plannerSource.indexOf(
    "if (state.currentCccRound !== null && !state.currentRound)",
  );
  assert.ok(settlementPriority >= 0, "due settlement selector is missing");
  assert.ok(randomnessCreation > settlementPriority, "randomness creation jumped ahead of settlement");
  assert.ok(roundCommit > settlementPriority, "CCC commit jumped ahead of due standard settlement");
  assert.match(
    plannerSource.slice(settlementPriority, randomnessCreation),
    /SETTLE_STANDARD_POSITION_WEEK_\$\{dueSettlement\.week\}[\s\S]*ordinal: dueSettlement\.ordinal/u,
  );

  assert.deepEqual(selectIatV2FeatureDuePositionSettlement({
    positions: [
      { firstAccrualWeek: 8n, settledMask: 1n },
      { firstAccrualWeek: 8n, settledMask: 1n },
      { firstAccrualWeek: 8n, settledMask: 1n },
    ],
    currentWeek: 9,
    linkedRounds: { 9: { status: 1 } },
  }), {
    positionIndex: 0,
    ordinal: 1,
    week: 9,
    round: null,
  }, "the exact live week-8/bit-0 state must advance to week 9/ordinal 1");
});

test("the browser loads only exact due linked-round PDAs", () => {
  const loaderSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("async function loadFeatureState"),
    featureConsoleSource.indexOf("function nextFeatureAction"),
  );
  const dueSelection = loaderSource.indexOf("const duePositionSettlements = positions.map");
  const linkedSelection = loaderSource.indexOf("const linkedRoundWeeks =");
  const linkedAddresses = loaderSource.indexOf("const linkedRoundAddresses =");
  assert.ok(dueSelection >= 0, "due position settlements are not computed");
  assert.ok(linkedSelection > dueSelection, "linked weeks are not derived from due settlements");
  assert.ok(linkedAddresses > linkedSelection, "linked Round PDAs are not derived after due weeks");
  const linkedSelectionSource = loaderSource.slice(linkedSelection, linkedAddresses);
  assert.match(linkedSelectionSource, /duePositionSettlements[\s\S]*settlement\.week/u);
  assert.doesNotMatch(linkedSelectionSource, /firstAccrualWeek/u);
});

test("the UI exposes exactly one action through separate user clicks", () => {
  assert.match(featureConsoleSource, /ONE VERIFIED ACTION \/\/ EXPLICIT USER STEPS ONLY/u);
  assert.match(featureConsoleSource, /<button onClick=\{simulateAndRequestSignature\}/u);
  assert.match(featureConsoleSource, /<button onClick=\{broadcastSigned\}/u);
  const effectsSource = featureConsoleSource.slice(
    featureConsoleSource.indexOf("useEffect(() =>"),
    featureConsoleSource.indexOf("async function simulateAndRequestSignature"),
  );
  assert.doesNotMatch(
    effectsSource,
    /(?:simulateAndRequestSignature|broadcastSigned)\s*\(/u,
  );
  assert.match(
    featureConsoleSource,
    /Long-term maturity remains a deterministic production-host time-gate proof; Devnet wall-clock time is not warped\./u,
  );
  assert.doesNotMatch(featureConsoleSource, /validator time-warp proof/u);
});

test("the browser never offers timestamp recovery for a deployed legacy Round", () => {
  assert.match(
    featureConsoleSource,
    /currentRound\.layoutVersion === IAT_V2_ROUND_LAYOUT\.LEGACY_V1[\s\S]*id: `REVEAL_CCC_ROUND_/u,
  );
  assert.match(
    featureConsoleSource,
    /deployed 198-byte V1 round has no timestamp or neutral-expiry instruction/u,
  );
  assert.match(
    featureConsoleSource,
    /EXPIRE_CCC_ROUND_[\s\S]*layoutVersion === IAT_V2_ROUND_LAYOUT\.LEGACY_V1[\s\S]*has no neutral-expiry instruction/u,
  );
});

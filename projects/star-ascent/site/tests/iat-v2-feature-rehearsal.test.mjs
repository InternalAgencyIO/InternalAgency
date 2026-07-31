import test from "node:test";
import assert from "node:assert/strict";
import {
  IAT_V2_SECONDS_PER_DAY,
  IAT_V2_SECONDS_PER_WEEK,
  assertIatV2RehearsalAllocationBalances,
  currentIatV2CccRound,
  currentIatV2Week,
  formatRehearsalWait,
  secondsUntilIatV2CccRound,
  secondsUntilIatV2Week,
} from "../programs/iat_v2/feature-rehearsal.mjs";

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

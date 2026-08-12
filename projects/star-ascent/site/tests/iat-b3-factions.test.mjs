import assert from "node:assert/strict";
import test from "node:test";

import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";
import {
  ALLEGIANCE_COOLDOWN_SECONDS,
  I64_MAX,
  U64_MAX,
  FACTIONS,
  FACTION_IDS,
  allocateCommunityPoolProportionally,
  applyAllegianceChange,
  equalFollowerDistribution,
  factionWeekIndex,
  finalizeFactionWeek,
} from "../programs/iat_b3_reference/factions.mjs";

function unixSeconds(iso) {
  return BigInt(Date.parse(iso) / 1_000);
}

const TEST_SCHEDULE = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: unixSeconds("2026-08-06T20:59:00Z"),
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-testnet-1",
});
const FRIDAY_DAY = protocolLocalDay(unixSeconds("2026-08-06T21:01:00Z"));
const FRIDAY_LOCKED_DECISION = createLockdownDecision({
  localDay: FRIDAY_DAY,
  randomnessOutputHex: `${"00".repeat(31)}01`,
  schedule: TEST_SCHEDULE,
});
const SATURDAY_OPEN_DECISION = createLockdownDecision({
  localDay: FRIDAY_DAY + 1n,
  randomnessOutputHex: "00".repeat(32),
  schedule: TEST_SCHEDULE,
});
const OPEN_DAILY_LAW_STATE = createDailyLawState({
  protocolHeight: 86_520n,
  schedule: TEST_SCHEDULE,
  currentDecision: SATURDAY_OPEN_DECISION,
});
const LOCKED_DAILY_LAW_STATE = createDailyLawState({
  protocolHeight: 120n,
  schedule: TEST_SCHEDULE,
  currentDecision: FRIDAY_LOCKED_DECISION,
});
const UNFINALIZED_DAILY_LAW_STATE = createDailyLawState({
  protocolHeight: 86_520n,
  schedule: TEST_SCHEDULE,
  currentDecision: null,
  previousDecision: FRIDAY_LOCKED_DECISION,
});

const SCORES = Object.freeze({
  radiance: 5n,
  ellie: 4n,
  alia: 3n,
  ece: 2n,
  boss: 1n,
});

test("the five factions and unnamed boss label are fixed", () => {
  assert.deepEqual(FACTION_IDS, ["radiance", "ellie", "alia", "ece", "boss"]);
  assert.deepEqual(
    FACTIONS.map(({ displayLabel }) => displayLabel),
    ["Radiance", "Ellie", "Alia", "Ece", "the boss"],
  );
  assert.equal(
    FACTIONS.every((faction) => !Object.hasOwn(faction, "authority")),
    true,
  );
});

test("first pledge is immediate and exact 24-hour switch boundary is allowed", () => {
  const first = applyAllegianceChange({
    operator: "operator-1",
    nextFactionId: "radiance",
    unixTimestamp: 1_000n,
    dailyLawState: OPEN_DAILY_LAW_STATE,
  });
  assert.equal(first.factionId, "radiance");
  assert.throws(
    () =>
      applyAllegianceChange({
        operator: "operator-1",
        nextFactionId: "ellie",
        unixTimestamp: 1_000n + ALLEGIANCE_COOLDOWN_SECONDS - 1n,
        currentAllegiance: first,
        dailyLawState: OPEN_DAILY_LAW_STATE,
      }),
    /ALLEGIANCE_COOLDOWN_ACTIVE/u,
  );
  const switched = applyAllegianceChange({
    operator: "operator-1",
    nextFactionId: "ellie",
    unixTimestamp: 1_000n + ALLEGIANCE_COOLDOWN_SECONDS,
    currentAllegiance: first,
    dailyLawState: OPEN_DAILY_LAW_STATE,
  });
  assert.equal(switched.factionId, "ellie");
});

test("no-op changes, missing day finalization, and lockdown all fail closed", () => {
  const current = Object.freeze({
    operator: "operator-1",
    factionId: "alia",
    lastChangedAt: 0n,
  });
  assert.throws(
    () =>
      applyAllegianceChange({
        operator: "operator-1",
        nextFactionId: "alia",
        unixTimestamp: ALLEGIANCE_COOLDOWN_SECONDS,
        currentAllegiance: current,
        dailyLawState: OPEN_DAILY_LAW_STATE,
      }),
    /ALLEGIANCE_NO_OP/u,
  );
  for (const [dailyLawState, expected] of [
    [UNFINALIZED_DAILY_LAW_STATE, /IAT_DAY_UNFINALIZED/u],
    [LOCKED_DAILY_LAW_STATE, /IAT_DAILY_LOCKDOWN/u],
  ]) {
    assert.throws(
      () =>
        applyAllegianceChange({
          operator: "operator-1",
          nextFactionId: "ece",
          unixTimestamp: ALLEGIANCE_COOLDOWN_SECONDS,
          currentAllegiance: current,
          dailyLawState,
        }),
      expected,
    );
  }
});

test("caller-authored ALLOWED values cannot impersonate canonical Daily Law state", () => {
  for (const dailyLawState of [
    "ALLOWED",
    { disposition: "ALLOWED" },
    { ...OPEN_DAILY_LAW_STATE },
  ]) {
    assert.throws(
      () =>
        applyAllegianceChange({
          operator: "operator-forged-law",
          nextFactionId: "radiance",
          unixTimestamp: 1_000n,
          dailyLawState,
        }),
      /INVALID_IAT_DAILY_LAW_STATE/u,
    );
  }
});

test("weekly pool allocation is proportional, conservative, and has no order bonus", () => {
  const result = allocateCommunityPoolProportionally({
    poolAmount: 101n,
    scores: SCORES,
  });
  const allocated = FACTION_IDS.reduce(
    (total, factionId) => total + result.allocations[factionId],
    0n,
  );
  assert.equal(allocated + result.carryForward, 101n);
  assert.deepEqual(result.allocations, {
    radiance: 33n,
    ellie: 26n,
    alia: 20n,
    ece: 13n,
    boss: 6n,
  });
  assert.equal(result.carryForward, 3n);
});

test("zero activity and zero followers carry rewards forward", () => {
  const allocation = allocateCommunityPoolProportionally({
    poolAmount: 77n,
    scores: Object.fromEntries(FACTION_IDS.map((id) => [id, 0n])),
  });
  assert.equal(allocation.carryForward, 77n);
  assert.equal(
    FACTION_IDS.every((id) => allocation.allocations[id] === 0n),
    true,
  );
  assert.deepEqual(
    equalFollowerDistribution({ rewardAmount: 77n, eligibleFollowerCount: 0n }),
    { perFollower: 0n, carryForward: 77n },
  );
  assert.deepEqual(
    equalFollowerDistribution({ rewardAmount: 77n, eligibleFollowerCount: 5n }),
    { perFollower: 15n, carryForward: 2n },
  );
});

test("weekly finalization is permissionless-idempotent and ties fail closed", () => {
  const result = finalizeFactionWeek({
    weekIndex: 3n,
    scores: SCORES,
    dailyLawState: OPEN_DAILY_LAW_STATE,
  });
  assert.equal(result.winnerFactionId, "radiance");
  assert.equal(
    finalizeFactionWeek({
      weekIndex: 3n,
      scores: SCORES,
      dailyLawState: OPEN_DAILY_LAW_STATE,
      existingFinalization: result,
    }),
    result,
  );
  assert.throws(
    () =>
      finalizeFactionWeek({
        weekIndex: 3n,
        scores: SCORES,
        dailyLawState: OPEN_DAILY_LAW_STATE,
        existingFinalization: { ...result, winnerFactionId: "boss" },
      }),
    /CONFLICTING_FACTION_WEEK_FINALIZATION/u,
  );
  assert.throws(
    () =>
      finalizeFactionWeek({
        weekIndex: 3n,
        scores: SCORES,
        dailyLawState: OPEN_DAILY_LAW_STATE,
        existingFinalization: { ...result, extra: "malleable" },
      }),
    /CONFLICTING_FACTION_WEEK_FINALIZATION/u,
  );
  assert.throws(
    () =>
      finalizeFactionWeek({
        weekIndex: 3n,
        scores: { ...SCORES, ellie: 5n },
        dailyLawState: OPEN_DAILY_LAW_STATE,
      }),
    /FACTION_WEEK_TIE_REQUIRES_SEALED_TIEBREAK/u,
  );
});

test("week boundaries are derived from the immutable epoch anchor", () => {
  assert.equal(
    factionWeekIndex({ unixTimestamp: 1_000n, epochStartUnixTimestamp: 1_000n }),
    0n,
  );
  assert.equal(
    factionWeekIndex({ unixTimestamp: 605_799n, epochStartUnixTimestamp: 1_000n }),
    0n,
  );
  assert.equal(
    factionWeekIndex({ unixTimestamp: 605_800n, epochStartUnixTimestamp: 1_000n }),
    1n,
  );
});

test("operator and numeric inputs fail closed at Solana boundaries", () => {
  assert.throws(
    () =>
      applyAllegianceChange({
        operator: " operator-1",
        nextFactionId: "radiance",
        unixTimestamp: 1n,
        dailyLawState: OPEN_DAILY_LAW_STATE,
      }),
    /trimmed nonempty string/u,
  );
  assert.throws(
    () =>
      allocateCommunityPoolProportionally({
        poolAmount: U64_MAX + 1n,
        scores: SCORES,
      }),
    /exceeds u64/u,
  );
  assert.throws(
    () =>
      applyAllegianceChange({
        operator: "operator-1",
        nextFactionId: "ellie",
        unixTimestamp: I64_MAX,
        currentAllegiance: {
          operator: "operator-1",
          factionId: "radiance",
          lastChangedAt: I64_MAX,
        },
        dailyLawState: OPEN_DAILY_LAW_STATE,
      }),
    /ALLEGIANCE_COOLDOWN_OVERFLOW/u,
  );
});

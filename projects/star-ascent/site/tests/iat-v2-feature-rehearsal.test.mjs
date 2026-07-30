import test from "node:test";
import assert from "node:assert/strict";
import {
  IAT_V2_SECONDS_PER_DAY,
  IAT_V2_SECONDS_PER_WEEK,
  currentIatV2CccRound,
  currentIatV2Week,
  formatRehearsalWait,
  secondsUntilIatV2CccRound,
  secondsUntilIatV2Week,
} from "../programs/iat_v2/feature-rehearsal.mjs";

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

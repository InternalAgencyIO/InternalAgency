import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_DECISION_LOCAL_SECOND,
  DAILY_LOCKDOWN_ERROR,
  DAILY_LOCKDOWN_LAW_ID,
  DRAW_DENOMINATOR,
  FRIDAY_LOCKDOWN_NUMERATOR,
  IAT_PROTOCOL_OFFSET_SECONDS,
  LOCKDOWN_DURATION_NOMINAL_SECONDS,
  NORMAL_DAY_LOCKDOWN_NUMERATOR,
  OPERATION_KIND,
  ceilDiv,
  createImmutableSchedule,
  createLockdownDecision,
  dailyLockdownWindow,
  deriveLockdownDraw,
  floorDiv,
  floorMod,
  isDailyLockdown,
  isFridayLocalDay,
  lockdownChanceNumerator,
  nominalUnixSecondsAtHeight,
  operationDisposition,
  protocolLocalDay,
  validateBlockUserTransactions,
  validateLockdownDecision,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";

function unixSeconds(iso) {
  return BigInt(Date.parse(iso) / 1_000);
}

const TEST_SCHEDULE = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: unixSeconds("2026-08-06T20:59:00Z"),
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-testnet-1",
});
const FRIDAY_LOCAL_DAY = protocolLocalDay(unixSeconds("2026-08-07T00:00:00Z"));
const SATURDAY_LOCAL_DAY = FRIDAY_LOCAL_DAY + 1n;
const FRIDAY_LOCKED_ENTROPY = `${"00".repeat(31)}01`;
const FRIDAY_OPEN_ENTROPY = "00".repeat(32);
const NORMAL_LOCKED_ENTROPY = `${"00".repeat(31)}9d`;
const NORMAL_OPEN_ENTROPY = "00".repeat(32);
const FRIDAY_LOCKED_DECISION = createLockdownDecision({
  localDay: FRIDAY_LOCAL_DAY,
  randomnessOutputHex: FRIDAY_LOCKED_ENTROPY,
  schedule: TEST_SCHEDULE,
});
const NORMAL_LOCKED_DECISION = createLockdownDecision({
  localDay: SATURDAY_LOCAL_DAY,
  randomnessOutputHex: NORMAL_LOCKED_ENTROPY,
  schedule: TEST_SCHEDULE,
});
const NORMAL_OPEN_DECISION = createLockdownDecision({
  localDay: SATURDAY_LOCAL_DAY,
  randomnessOutputHex: NORMAL_OPEN_ENTROPY,
  schedule: TEST_SCHEDULE,
});

test("the daily schedule is height-derived nominal UTC+03:00 with no live clock", () => {
  assert.equal(IAT_PROTOCOL_OFFSET_SECONDS, 10_800n);
  assert.equal(DAILY_DECISION_LOCAL_SECOND, 0n);
  assert.equal(LOCKDOWN_DURATION_NOMINAL_SECONDS, 86_400n);
  assert.equal(Object.isFrozen(TEST_SCHEDULE), true);
  assert.equal(
    nominalUnixSecondsAtHeight(60n, TEST_SCHEDULE),
    unixSeconds("2026-08-06T21:00:00Z"),
  );
});

test("the first block reaching local 00:00 decides and opens the 24-hour window", () => {
  assert.deepEqual(dailyLockdownWindow(FRIDAY_LOCAL_DAY, TEST_SCHEDULE), {
    localDay: FRIDAY_LOCAL_DAY,
    isFriday: true,
    decisionHeight: 60n,
    opensAtHeight: 60n,
    closesAtHeight: 86_460n,
    decisionAtNominalUnixSeconds: unixSeconds("2026-08-06T21:00:00Z"),
    closesAtNominalUnixSeconds: unixSeconds("2026-08-07T21:00:00Z"),
  });
  assert.equal(isDailyLockdown(59n, FRIDAY_LOCKED_DECISION, TEST_SCHEDULE), false);
  assert.equal(isDailyLockdown(60n, FRIDAY_LOCKED_DECISION, TEST_SCHEDULE), true);
  assert.equal(isDailyLockdown(86_459n, FRIDAY_LOCKED_DECISION, TEST_SCHEDULE), true);
  assert.equal(isDailyLockdown(86_460n, FRIDAY_LOCKED_DECISION, TEST_SCHEDULE), false);
});

test("normal days use exactly 1 percent and Fridays exactly 66.67 percent", () => {
  assert.equal(DRAW_DENOMINATOR, 10_000n);
  assert.equal(NORMAL_DAY_LOCKDOWN_NUMERATOR, 100n);
  assert.equal(FRIDAY_LOCKDOWN_NUMERATOR, 6_667n);
  assert.equal(isFridayLocalDay(FRIDAY_LOCAL_DAY), true);
  assert.equal(isFridayLocalDay(SATURDAY_LOCAL_DAY), false);
  assert.equal(lockdownChanceNumerator(FRIDAY_LOCAL_DAY), 6_667n);
  assert.equal(lockdownChanceNumerator(SATURDAY_LOCAL_DAY), 100n);
});

test("public Friday vectors reproduce both locked and open decisions", () => {
  assert.deepEqual(FRIDAY_LOCKED_DECISION, {
    lawId: DAILY_LOCKDOWN_LAW_ID,
    localDay: FRIDAY_LOCAL_DAY,
    isFriday: true,
    decisionHeight: 60n,
    randomnessOutputHex: FRIDAY_LOCKED_ENTROPY,
    drawCounter: 0n,
    drawBucket: 2_128n,
    chanceNumerator: 6_667n,
    chanceDenominator: 10_000n,
    locked: true,
  });
  assert.deepEqual(
    deriveLockdownDraw({
      randomnessOutputHex: FRIDAY_OPEN_ENTROPY,
      localDay: FRIDAY_LOCAL_DAY,
      networkId: TEST_SCHEDULE.networkId,
    }),
    {
      counter: 0n,
      bucket: 8_358n,
      chanceNumerator: 6_667n,
      chanceDenominator: 10_000n,
      locked: false,
    },
  );
  assert.equal(validateLockdownDecision(FRIDAY_LOCKED_DECISION, TEST_SCHEDULE), true);
});

test("public normal-day vectors reproduce the exact one-percent draw", () => {
  assert.deepEqual(NORMAL_LOCKED_DECISION, {
    lawId: DAILY_LOCKDOWN_LAW_ID,
    localDay: SATURDAY_LOCAL_DAY,
    isFriday: false,
    decisionHeight: 86_460n,
    randomnessOutputHex: NORMAL_LOCKED_ENTROPY,
    drawCounter: 0n,
    drawBucket: 59n,
    chanceNumerator: 100n,
    chanceDenominator: 10_000n,
    locked: true,
  });
  assert.deepEqual(
    deriveLockdownDraw({
      randomnessOutputHex: NORMAL_OPEN_ENTROPY,
      localDay: SATURDAY_LOCAL_DAY,
      networkId: TEST_SCHEDULE.networkId,
    }),
    {
      counter: 0n,
      bucket: 7_986n,
      chanceNumerator: 100n,
      chanceDenominator: 10_000n,
      locked: false,
    },
  );
});

test("selected decision blocks reject user transactions but preserve consensus and reads", () => {
  assert.deepEqual(
    operationDisposition(
      60n,
      FRIDAY_LOCKED_DECISION,
      OPERATION_KIND.USER_TRANSACTION,
      TEST_SCHEDULE,
    ),
    { accepted: false, code: DAILY_LOCKDOWN_ERROR, binding: true },
  );
  assert.throws(
    () => validateBlockUserTransactions(60n, FRIDAY_LOCKED_DECISION, 1n, TEST_SCHEDULE),
    new RegExp(DAILY_LOCKDOWN_ERROR),
  );
  for (const operationKind of [
    OPERATION_KIND.CONSENSUS_HOUSEKEEPING,
    OPERATION_KIND.QUERY,
  ]) {
    assert.deepEqual(
      operationDisposition(60n, FRIDAY_LOCKED_DECISION, operationKind, TEST_SCHEDULE),
      { accepted: true, code: "ALLOWED", binding: true },
    );
  }
});

test("an unselected day stays transactional and selected days may be consecutive", () => {
  assert.equal(isDailyLockdown(90_000n, NORMAL_OPEN_DECISION, TEST_SCHEDULE), false);
  assert.deepEqual(
    operationDisposition(
      90_000n,
      NORMAL_OPEN_DECISION,
      OPERATION_KIND.USER_TRANSACTION,
      TEST_SCHEDULE,
    ),
    { accepted: true, code: "ALLOWED", binding: true },
  );
  assert.equal(isDailyLockdown(86_460n, FRIDAY_LOCKED_DECISION, TEST_SCHEDULE), false);
  assert.equal(isDailyLockdown(86_460n, NORMAL_LOCKED_DECISION, TEST_SCHEDULE), true);
});

test("forged, missing, malformed, or bypass decisions fail closed", () => {
  assert.throws(
    () =>
      validateLockdownDecision(
        { ...NORMAL_LOCKED_DECISION, chanceNumerator: 99n },
        TEST_SCHEDULE,
      ),
    /invalid lockdown decision field: chanceNumerator/u,
  );
  assert.throws(() => isDailyLockdown(60n, null, TEST_SCHEDULE), /decision must/u);
  assert.throws(
    () =>
      createLockdownDecision({
        localDay: FRIDAY_LOCAL_DAY,
        randomnessOutputHex: "not-randomness",
        schedule: TEST_SCHEDULE,
      }),
    /exactly 32 bytes/u,
  );
  assert.throws(
    () => createImmutableSchedule({ ...TEST_SCHEDULE, networkId: "IAT B3" }),
    /networkId must/u,
  );
  assert.throws(
    () =>
      operationDisposition(60n, FRIDAY_LOCKED_DECISION, "ADMIN_BYPASS", TEST_SCHEDULE),
    /unknown operation/u,
  );
});

test("integer schedule arithmetic remains deterministic across the Unix epoch", () => {
  assert.equal(floorDiv(-1n, 86_400n), -1n);
  assert.equal(ceilDiv(-1n, 86_400n), 0n);
  assert.equal(floorMod(-1n, 7n), 6n);
  assert.throws(() => nominalUnixSecondsAtHeight(1.5, TEST_SCHEDULE), /integer/u);
  assert.throws(
    () =>
      validateBlockUserTransactions(60n, FRIDAY_LOCKED_DECISION, -1n, TEST_SCHEDULE),
    /cannot be negative/u,
  );
});

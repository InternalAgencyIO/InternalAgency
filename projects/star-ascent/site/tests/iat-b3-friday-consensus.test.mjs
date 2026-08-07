import assert from "node:assert/strict";
import test from "node:test";

import {
  FRIDAY_LOCKDOWN_ERROR,
  IAT_PROTOCOL_OFFSET_SECONDS,
  LOCKDOWN_CHANCE_DENOMINATOR,
  LOCKDOWN_CHANCE_NUMERATOR,
  LOCKDOWN_DURATION_NOMINAL_SECONDS,
  LOCKDOWN_START_LOCAL_SECOND,
  OPERATION_KIND,
  RANDOM_FRIDAY_LOCKDOWN_LAW_ID,
  ceilDiv,
  createImmutableSchedule,
  createLockdownDecision,
  deriveLockdownDraw,
  floorDiv,
  floorMod,
  fridayLockdownWindow,
  isFridayLockdown,
  nominalUnixSecondsAtHeight,
  operationDisposition,
  protocolLocalDay,
  validateBlockUserTransactions,
  validateLockdownDecision,
} from "../programs/iat_b3_reference/friday-consensus.mjs";

function unixSeconds(iso) {
  return BigInt(Date.parse(iso) / 1_000);
}

const TEST_SCHEDULE = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: unixSeconds("2026-08-06T21:00:00Z"),
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-testnet-1",
});
const FRIDAY_LOCAL_DAY = protocolLocalDay(unixSeconds("2026-08-07T00:00:00Z"));
const LOCKED_ENTROPY = "11".repeat(32);
const OPEN_ENTROPY = "00".repeat(32);
const LOCKED_DECISION = createLockdownDecision({
  fridayLocalDay: FRIDAY_LOCAL_DAY,
  randomnessOutputHex: LOCKED_ENTROPY,
  schedule: TEST_SCHEDULE,
});
const OPEN_DECISION = createLockdownDecision({
  fridayLocalDay: FRIDAY_LOCAL_DAY,
  randomnessOutputHex: OPEN_ENTROPY,
  schedule: TEST_SCHEDULE,
});

test("the immutable schedule uses height-derived nominal UTC+03:00, not a live clock", () => {
  assert.equal(IAT_PROTOCOL_OFFSET_SECONDS, 10_800n);
  assert.equal(LOCKDOWN_START_LOCAL_SECOND, 60n);
  assert.equal(LOCKDOWN_DURATION_NOMINAL_SECONDS, 86_400n);
  assert.equal(Object.isFrozen(TEST_SCHEDULE), true);
  assert.equal(
    nominalUnixSecondsAtHeight(60n, TEST_SCHEDULE),
    unixSeconds("2026-08-06T21:01:00Z"),
  );
});

test("Friday 00:01 through Saturday 00:01 is a half-open 24-hour height window", () => {
  assert.deepEqual(fridayLockdownWindow(FRIDAY_LOCAL_DAY, TEST_SCHEDULE), {
    fridayLocalDay: FRIDAY_LOCAL_DAY,
    decisionHeight: 59n,
    opensAtHeight: 60n,
    closesAtHeight: 86_460n,
    opensAtNominalUnixSeconds: unixSeconds("2026-08-06T21:01:00Z"),
    closesAtNominalUnixSeconds: unixSeconds("2026-08-07T21:01:00Z"),
  });
  assert.equal(isFridayLockdown(59n, LOCKED_DECISION, TEST_SCHEDULE), false);
  assert.equal(isFridayLockdown(60n, LOCKED_DECISION, TEST_SCHEDULE), true);
  assert.equal(isFridayLockdown(86_459n, LOCKED_DECISION, TEST_SCHEDULE), true);
  assert.equal(isFridayLockdown(86_460n, LOCKED_DECISION, TEST_SCHEDULE), false);
});

test("the final block before activation binds the random-Friday decision", () => {
  assert.deepEqual(LOCKED_DECISION, {
    lawId: RANDOM_FRIDAY_LOCKDOWN_LAW_ID,
    fridayLocalDay: FRIDAY_LOCAL_DAY,
    decisionHeight: 59n,
    randomnessOutputHex: LOCKED_ENTROPY,
    drawCounter: 0n,
    drawBucket: 6_441n,
    locked: true,
  });
  assert.equal(validateLockdownDecision(LOCKED_DECISION, TEST_SCHEDULE), true);
});

test("the draw implements the exact 6733/10000 probability without modulo bias", () => {
  assert.equal(LOCKDOWN_CHANCE_NUMERATOR, 6_733n);
  assert.equal(LOCKDOWN_CHANCE_DENOMINATOR, 10_000n);
  assert.deepEqual(
    deriveLockdownDraw({
      randomnessOutputHex: LOCKED_ENTROPY,
      fridayLocalDay: FRIDAY_LOCAL_DAY,
      networkId: TEST_SCHEDULE.networkId,
    }),
    { counter: 0n, bucket: 6_441n, locked: true },
  );
  assert.deepEqual(
    deriveLockdownDraw({
      randomnessOutputHex: OPEN_ENTROPY,
      fridayLocalDay: FRIDAY_LOCAL_DAY,
      networkId: TEST_SCHEDULE.networkId,
    }),
    { counter: 0n, bucket: 9_987n, locked: false },
  );
  assert.equal(OPEN_DECISION.locked, false);
});

test("locked Fridays reject user transactions without stopping consensus or reads", () => {
  const lockedHeight = 10_000n;
  assert.deepEqual(
    operationDisposition(
      lockedHeight,
      LOCKED_DECISION,
      OPERATION_KIND.USER_TRANSACTION,
      TEST_SCHEDULE,
    ),
    { accepted: false, code: FRIDAY_LOCKDOWN_ERROR, binding: true },
  );
  assert.throws(
    () => validateBlockUserTransactions(lockedHeight, LOCKED_DECISION, 1n, TEST_SCHEDULE),
    new RegExp(FRIDAY_LOCKDOWN_ERROR),
  );
  assert.equal(
    validateBlockUserTransactions(lockedHeight, LOCKED_DECISION, 0n, TEST_SCHEDULE),
    true,
  );
  for (const operationKind of [
    OPERATION_KIND.CONSENSUS_HOUSEKEEPING,
    OPERATION_KIND.QUERY,
  ]) {
    assert.deepEqual(
      operationDisposition(lockedHeight, LOCKED_DECISION, operationKind, TEST_SCHEDULE),
      { accepted: true, code: "ALLOWED", binding: true },
    );
  }
  assert.deepEqual(
    operationDisposition(
      lockedHeight,
      LOCKED_DECISION,
      OPERATION_KIND.SIMULATION,
      TEST_SCHEDULE,
    ),
    { accepted: true, code: "NON_BINDING_SIMULATION", binding: false },
  );
});

test("an unselected Friday remains fully transactional", () => {
  assert.equal(isFridayLockdown(10_000n, OPEN_DECISION, TEST_SCHEDULE), false);
  assert.deepEqual(
    operationDisposition(
      10_000n,
      OPEN_DECISION,
      OPERATION_KIND.USER_TRANSACTION,
      TEST_SCHEDULE,
    ),
    { accepted: true, code: "ALLOWED", binding: true },
  );
  assert.equal(
    validateBlockUserTransactions(10_000n, OPEN_DECISION, 3n, TEST_SCHEDULE),
    true,
  );
});

test("forged, missing, malformed, or bypass decisions fail closed", () => {
  assert.throws(
    () => validateLockdownDecision({ ...LOCKED_DECISION, locked: false }, TEST_SCHEDULE),
    /invalid lockdown decision field: locked/u,
  );
  assert.throws(() => isFridayLockdown(60n, null, TEST_SCHEDULE), /decision must/u);
  assert.throws(
    () =>
      createLockdownDecision({
        fridayLocalDay: FRIDAY_LOCAL_DAY,
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
      operationDisposition(60n, LOCKED_DECISION, "ADMIN_BYPASS", TEST_SCHEDULE),
    /unknown operation/u,
  );
});

test("integer schedule arithmetic remains deterministic across the Unix epoch", () => {
  assert.equal(floorDiv(-1n, 86_400n), -1n);
  assert.equal(ceilDiv(-1n, 86_400n), 0n);
  assert.equal(floorMod(-1n, 7n), 6n);
  assert.throws(() => nominalUnixSecondsAtHeight(1.5, TEST_SCHEDULE), /integer/u);
  assert.throws(
    () => validateBlockUserTransactions(60n, LOCKED_DECISION, -1n, TEST_SCHEDULE),
    /cannot be negative/u,
  );
});

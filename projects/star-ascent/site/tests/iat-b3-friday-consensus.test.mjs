import assert from "node:assert/strict";
import test from "node:test";

import {
  FRIDAY_PAUSE_ERROR,
  IAT_PROTOCOL_OFFSET_SECONDS,
  OPERATION_KIND,
  floorDiv,
  floorMod,
  fridayPauseWindow,
  isFridayPause,
  operationDisposition,
  protocolLocalDay,
  validateBlockUserTransactions,
} from "../programs/iat_b3_reference/friday-consensus.mjs";

function unixSeconds(iso) {
  return BigInt(Date.parse(iso) / 1_000);
}

test("B3 snapshots Turkish protocol time as an immutable UTC+03:00 offset", () => {
  assert.equal(IAT_PROTOCOL_OFFSET_SECONDS, 10_800n);
  assert.equal(protocolLocalDay(0n), 0n);
  assert.equal(isFridayPause(0n), false, "1970-01-01 was Thursday");
  assert.equal(isFridayPause(86_400n), true, "1970-01-02 was Friday");
});

test("Friday pause uses exact half-open UTC boundaries", () => {
  assert.equal(isFridayPause(unixSeconds("2026-08-06T20:59:59Z")), false);
  assert.equal(isFridayPause(unixSeconds("2026-08-06T21:00:00Z")), true);
  assert.equal(isFridayPause(unixSeconds("2026-08-07T20:59:59Z")), true);
  assert.equal(isFridayPause(unixSeconds("2026-08-07T21:00:00Z")), false);

  assert.deepEqual(fridayPauseWindow(unixSeconds("2026-08-07T12:00:00Z")), {
    opensAtUnixSeconds: unixSeconds("2026-08-06T21:00:00Z"),
    closesAtUnixSeconds: unixSeconds("2026-08-07T21:00:00Z"),
  });
  assert.equal(fridayPauseWindow(unixSeconds("2026-08-08T12:00:00Z")), null);
});

test("floor arithmetic is deterministic before and after the Unix epoch", () => {
  assert.equal(floorDiv(-1n, 86_400n), -1n);
  assert.equal(floorMod(-1n, 7n), 6n);
  assert.equal(isFridayPause(unixSeconds("1969-12-26T12:00:00Z")), true);
  assert.equal(isFridayPause(unixSeconds("2000-02-25T12:00:00Z")), true);
});

test("Friday rejects every user transaction without charging or consuming state", () => {
  const friday = unixSeconds("2026-08-07T10:00:00Z");
  assert.deepEqual(operationDisposition(friday, OPERATION_KIND.USER_TRANSACTION), {
    accepted: false,
    code: FRIDAY_PAUSE_ERROR,
    binding: true,
  });
  assert.throws(
    () => validateBlockUserTransactions(friday, 1n),
    new RegExp(FRIDAY_PAUSE_ERROR),
  );
  assert.equal(validateBlockUserTransactions(friday, 0n), true);
});

test("consensus and read-only services continue during Friday", () => {
  const friday = unixSeconds("2026-08-07T10:00:00Z");
  assert.deepEqual(operationDisposition(friday, OPERATION_KIND.CONSENSUS_HOUSEKEEPING), {
    accepted: true,
    code: "ALLOWED",
    binding: true,
  });
  assert.deepEqual(operationDisposition(friday, OPERATION_KIND.QUERY), {
    accepted: true,
    code: "ALLOWED",
    binding: true,
  });
  assert.deepEqual(operationDisposition(friday, OPERATION_KIND.SIMULATION), {
    accepted: true,
    code: "NON_BINDING_SIMULATION",
    binding: false,
  });
});

test("the reference API rejects ambiguous timestamps and operation classes", () => {
  assert.throws(() => isFridayPause(1.5), /integer Unix-second/u);
  assert.throws(() => isFridayPause("2026-08-07"), /integer Unix-second/u);
  assert.throws(() => validateBlockUserTransactions(0n, -1n), /cannot be negative/u);
  assert.throws(() => operationDisposition(0n, "ADMIN_BYPASS"), /unknown operation/u);
});

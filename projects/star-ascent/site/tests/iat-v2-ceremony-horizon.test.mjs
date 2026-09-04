import assert from "node:assert/strict";
import test from "node:test";

import {
  IAT_V2_DEVNET_CEREMONY_BACKFILL_WEEKS,
  IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
  IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_TIMESTAMP,
  IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_UTC,
  IAT_V2_DEVNET_CEREMONY_LINKED_HISTORICAL_WEEKS,
  IAT_V2_DEVNET_CEREMONY_MIGRATION_WEEKS,
  IAT_V2_DEVNET_CEREMONY_POLICY_WEEK,
  IAT_V2_DEVNET_CEREMONY_ROSTER_VERSION,
  IAT_V2_DEVNET_CEREMONY_STANDARD_SETTLEMENT_WEEKS,
  assertIatV2DevnetCeremonyHorizon,
  iatV2DevnetCeremonyTerminalActions,
} from "../programs/iat_v2/ceremony-horizon.mjs";
import {
  currentIatV2CccRound,
  currentIatV2Week,
} from "../programs/iat_v2/feature-rehearsal.mjs";

const GENESIS_TIMESTAMP = 1_780_636_775;

test("source-bound Devnet ceremony freezes the exact policy-week and delayed CCC-round pair", () => {
  assert.equal(IAT_V2_DEVNET_CEREMONY_POLICY_WEEK, 13);
  assert.equal(IAT_V2_DEVNET_CEREMONY_CCC_ROUND, 12);
  assert.equal(IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_TIMESTAMP, 1_788_585_575);
  assert.equal(
    new Date(IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_TIMESTAMP * 1_000).toISOString(),
    IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_UTC,
  );
  assert.equal(IAT_V2_DEVNET_CEREMONY_ROSTER_VERSION, "IAT_V2_MIGRATION_BACKFILL_POLICY13_CCC12_V1");
  assert.deepEqual(IAT_V2_DEVNET_CEREMONY_MIGRATION_WEEKS, [7, 8]);
  assert.deepEqual(IAT_V2_DEVNET_CEREMONY_BACKFILL_WEEKS, [9, 10, 11]);
  assert.deepEqual(IAT_V2_DEVNET_CEREMONY_STANDARD_SETTLEMENT_WEEKS, [10, 11, 12, 13]);
  assert.deepEqual(IAT_V2_DEVNET_CEREMONY_LINKED_HISTORICAL_WEEKS, [9, 10, 11]);
  assert.deepEqual(iatV2DevnetCeremonyTerminalActions(), [
    "REVEAL_CCC_ROUND_12",
    "EXPIRE_CCC_ROUND_12",
  ]);
});

test("ceremony horizon accepts the final valid second and closes exactly when CCC round 13 opens", () => {
  const finalValidTimestamp = IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_TIMESTAMP - 1;
  assert.equal(currentIatV2Week(GENESIS_TIMESTAMP, finalValidTimestamp), 13);
  assert.equal(currentIatV2CccRound(GENESIS_TIMESTAMP, finalValidTimestamp), 12);
  assert.deepEqual(assertIatV2DevnetCeremonyHorizon({
    policyWeek: 13,
    cccRound: 12,
    nowTimestamp: finalValidTimestamp,
  }), {
    policyWeek: 13,
    cccRound: 12,
    closesAtTimestamp: IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_TIMESTAMP,
    closesAtUtc: IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_UTC,
  });

  assert.equal(currentIatV2Week(GENESIS_TIMESTAMP, IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_TIMESTAMP), 13);
  assert.equal(currentIatV2CccRound(GENESIS_TIMESTAMP, IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_TIMESTAMP), 13);
  assert.throws(
    () => assertIatV2DevnetCeremonyHorizon({
      policyWeek: 13,
      cccRound: 13,
      nowTimestamp: IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_TIMESTAMP,
    }),
    /CCC round drifted/u,
  );
  assert.throws(
    () => assertIatV2DevnetCeremonyHorizon({ policyWeek: 12, cccRound: 12, nowTimestamp: finalValidTimestamp }),
    /policy week drifted/u,
  );
  assert.throws(
    () => assertIatV2DevnetCeremonyHorizon({ policyWeek: 13, cccRound: 12, nowTimestamp: 1.5 }),
    /timestamp is unavailable/u,
  );
});

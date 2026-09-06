import assert from "node:assert/strict";
import test from "node:test";

import {
  IAT_V2_DEVNET_CEREMONY_BACKFILL_WEEKS,
  IAT_V2_DEVNET_CEREMONY_CCC_ROUND,
  IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP,
  IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP,
  IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_UTC,
  IAT_V2_DEVNET_CEREMONY_HORIZON_TRANSITION,
  IAT_V2_DEVNET_CEREMONY_LINKED_HISTORICAL_WEEKS,
  IAT_V2_DEVNET_CEREMONY_MIGRATION_WEEKS,
  IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_UTC,
  IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_TIMESTAMP,
  IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_UTC,
  IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_TIMESTAMP,
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

const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_WEEK = 604_800;

test("source-bound Devnet ceremony freezes the exact policy-week and CCC-round pair", () => {
  assert.equal(IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP, 1_780_636_775);
  assert.equal(IAT_V2_DEVNET_CEREMONY_POLICY_WEEK, 13);
  assert.equal(IAT_V2_DEVNET_CEREMONY_CCC_ROUND, 13);
  assert.equal(IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_TIMESTAMP, 1_789_103_975);
  assert.equal(IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_UTC, "2026-09-11T05:19:35.000Z");
  assert.equal(IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_TIMESTAMP, 1_789_190_375);
  assert.equal(IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_UTC, "2026-09-12T05:19:35.000Z");
  assert.equal(
    IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_TIMESTAMP,
    IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP + (14 * SECONDS_PER_WEEK),
  );
  assert.equal(
    IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_TIMESTAMP,
    IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP + SECONDS_PER_DAY + (14 * SECONDS_PER_WEEK),
  );
  assert.equal(
    IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP,
    Math.min(
      IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_TIMESTAMP,
      IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_TIMESTAMP,
    ),
  );
  assert.equal(
    new Date(IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_TIMESTAMP * 1_000).toISOString(),
    IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_UTC,
  );
  assert.equal(
    new Date(IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_TIMESTAMP * 1_000).toISOString(),
    IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_UTC,
  );
  assert.equal(
    new Date(IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP * 1_000).toISOString(),
    IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_UTC,
  );
  assert.equal(IAT_V2_DEVNET_CEREMONY_HORIZON_TRANSITION, "POLICY_WEEK");
  assert.equal(IAT_V2_DEVNET_CEREMONY_ROSTER_VERSION, "IAT_V2_MIGRATION_BACKFILL_POLICY13_CCC13_V1");
  assert.deepEqual(IAT_V2_DEVNET_CEREMONY_MIGRATION_WEEKS, [7, 8]);
  assert.deepEqual(IAT_V2_DEVNET_CEREMONY_BACKFILL_WEEKS, [9, 10, 11, 12]);
  assert.deepEqual(IAT_V2_DEVNET_CEREMONY_STANDARD_SETTLEMENT_WEEKS, [10, 11, 12, 13]);
  assert.deepEqual(IAT_V2_DEVNET_CEREMONY_LINKED_HISTORICAL_WEEKS, [9, 10, 11, 12]);
  assert.deepEqual(iatV2DevnetCeremonyTerminalActions(), [
    "REVEAL_CCC_ROUND_13",
    "EXPIRE_CCC_ROUND_13",
  ]);
});

test("ceremony horizon accepts the final valid second and closes at the first derived boundary", () => {
  const firstValidTimestamp = IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP
    + SECONDS_PER_DAY
    + (IAT_V2_DEVNET_CEREMONY_CCC_ROUND * SECONDS_PER_WEEK);
  const finalValidTimestamp = IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP - 1;
  assert.equal(currentIatV2Week(IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP, firstValidTimestamp), 13);
  assert.equal(currentIatV2CccRound(IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP, firstValidTimestamp), 13);
  assert.deepEqual(assertIatV2DevnetCeremonyHorizon({
    policyWeek: 13,
    cccRound: 13,
    nowTimestamp: firstValidTimestamp,
  }), {
    policyWeek: 13,
    cccRound: 13,
    closesAtTimestamp: IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP,
    closesAtUtc: IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_UTC,
    closesOn: "POLICY_WEEK",
  });
  assert.equal(currentIatV2Week(IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP, finalValidTimestamp), 13);
  assert.equal(currentIatV2CccRound(IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP, finalValidTimestamp), 13);
  assert.deepEqual(assertIatV2DevnetCeremonyHorizon({
    policyWeek: 13,
    cccRound: 13,
    nowTimestamp: finalValidTimestamp,
  }), {
    policyWeek: 13,
    cccRound: 13,
    closesAtTimestamp: IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP,
    closesAtUtc: IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_UTC,
    closesOn: "POLICY_WEEK",
  });

  assert.equal(
    currentIatV2Week(
      IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP,
      IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP,
    ),
    14,
  );
  assert.equal(
    currentIatV2CccRound(
      IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP,
      IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP,
    ),
    13,
  );
  assert.throws(
    () => assertIatV2DevnetCeremonyHorizon({
      policyWeek: 14,
      cccRound: 13,
      nowTimestamp: IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP,
    }),
    /policy week drifted/u,
  );
  assert.throws(
    () => assertIatV2DevnetCeremonyHorizon({
      policyWeek: 13,
      cccRound: 13,
      nowTimestamp: IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP,
    }),
    /horizon has closed/u,
  );
  assert.throws(
    () => assertIatV2DevnetCeremonyHorizon({ policyWeek: 12, cccRound: 13, nowTimestamp: finalValidTimestamp }),
    /policy week drifted/u,
  );
  assert.throws(
    () => assertIatV2DevnetCeremonyHorizon({ policyWeek: 13, cccRound: 12, nowTimestamp: finalValidTimestamp }),
    /CCC round drifted/u,
  );
  assert.throws(
    () => assertIatV2DevnetCeremonyHorizon({
      policyWeek: 13,
      cccRound: 13,
      nowTimestamp: firstValidTimestamp - 1,
    }),
    /timestamp does not derive the source-bound CCC round/u,
  );
  assert.throws(
    () => assertIatV2DevnetCeremonyHorizon({ policyWeek: 13, cccRound: 13, nowTimestamp: 1.5 }),
    /timestamp is unavailable/u,
  );
});

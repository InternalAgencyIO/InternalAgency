export const IAT_V2_DEVNET_CEREMONY_POLICY_WEEK = 13;
export const IAT_V2_DEVNET_CEREMONY_CCC_ROUND = 12;
export const IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_TIMESTAMP = 1_788_585_575;
export const IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_UTC = "2026-09-05T05:19:35.000Z";
export const IAT_V2_DEVNET_CEREMONY_ROSTER_VERSION =
  "IAT_V2_MIGRATION_BACKFILL_POLICY13_CCC12_V1";

export const IAT_V2_DEVNET_CEREMONY_MIGRATION_WEEKS = Object.freeze([7, 8]);
export const IAT_V2_DEVNET_CEREMONY_BACKFILL_WEEKS = Object.freeze([9, 10, 11]);
export const IAT_V2_DEVNET_CEREMONY_STANDARD_SETTLEMENT_WEEKS = Object.freeze([
  10,
  11,
  12,
  13,
]);
export const IAT_V2_DEVNET_CEREMONY_LINKED_HISTORICAL_WEEKS = Object.freeze([
  9,
  10,
  11,
]);

export function iatV2DevnetCeremonyTerminalActions() {
  return Object.freeze([
    `REVEAL_CCC_ROUND_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`,
    `EXPIRE_CCC_ROUND_${IAT_V2_DEVNET_CEREMONY_CCC_ROUND}`,
  ]);
}

export function assertIatV2DevnetCeremonyHorizon({
  policyWeek,
  cccRound,
  nowTimestamp,
} = {}) {
  if (policyWeek !== IAT_V2_DEVNET_CEREMONY_POLICY_WEEK) {
    throw new Error("Current Devnet policy week drifted from the source-bound ceremony horizon");
  }
  if (cccRound !== IAT_V2_DEVNET_CEREMONY_CCC_ROUND) {
    throw new Error("Current Devnet CCC round drifted from the source-bound ceremony horizon");
  }
  if (!Number.isSafeInteger(nowTimestamp)) {
    throw new Error("Current finalized Devnet timestamp is unavailable for the ceremony horizon");
  }
  if (nowTimestamp >= IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_TIMESTAMP) {
    throw new Error("The source-bound Devnet ceremony horizon has closed");
  }
  return Object.freeze({
    policyWeek,
    cccRound,
    closesAtTimestamp: IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_TIMESTAMP,
    closesAtUtc: IAT_V2_DEVNET_CEREMONY_CCC_ROUND_CLOSE_UTC,
  });
}

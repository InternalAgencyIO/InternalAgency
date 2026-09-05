export const IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP = 1_780_636_775;
export const IAT_V2_DEVNET_CEREMONY_POLICY_WEEK = 13;
export const IAT_V2_DEVNET_CEREMONY_CCC_ROUND = 13;
export const IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_TIMESTAMP = 1_789_103_975;
export const IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_UTC = "2026-09-11T05:19:35.000Z";
export const IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_TIMESTAMP = 1_789_190_375;
export const IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_UTC = "2026-09-12T05:19:35.000Z";
export const IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP = Math.min(
  IAT_V2_DEVNET_CEREMONY_NEXT_POLICY_BOUNDARY_TIMESTAMP,
  IAT_V2_DEVNET_CEREMONY_NEXT_CCC_BOUNDARY_TIMESTAMP,
);
export const IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_UTC = "2026-09-11T05:19:35.000Z";
export const IAT_V2_DEVNET_CEREMONY_HORIZON_TRANSITION = "POLICY_WEEK";
export const IAT_V2_DEVNET_CEREMONY_ROSTER_VERSION =
  "IAT_V2_MIGRATION_BACKFILL_POLICY13_CCC13_V1";

const IAT_V2_SECONDS_PER_DAY = 86_400;
const IAT_V2_SECONDS_PER_WEEK = 604_800;

export const IAT_V2_DEVNET_CEREMONY_MIGRATION_WEEKS = Object.freeze([7, 8]);
export const IAT_V2_DEVNET_CEREMONY_BACKFILL_WEEKS = Object.freeze([9, 10, 11, 12]);
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
  12,
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
  if (nowTimestamp >= IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP) {
    throw new Error("The source-bound Devnet ceremony horizon has closed");
  }
  const derivedPolicyWeek = nowTimestamp < IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP
    ? null
    : Math.floor(
      (nowTimestamp - IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP) / IAT_V2_SECONDS_PER_WEEK,
    );
  const firstCccTimestamp = IAT_V2_DEVNET_CEREMONY_GENESIS_TIMESTAMP + IAT_V2_SECONDS_PER_DAY;
  const derivedCccRound = nowTimestamp < firstCccTimestamp
    ? null
    : Math.floor((nowTimestamp - firstCccTimestamp) / IAT_V2_SECONDS_PER_WEEK);
  if (derivedPolicyWeek !== policyWeek) {
    throw new Error("Current finalized Devnet timestamp does not derive the source-bound policy week");
  }
  if (derivedCccRound !== cccRound) {
    throw new Error("Current finalized Devnet timestamp does not derive the source-bound CCC round");
  }
  return Object.freeze({
    policyWeek,
    cccRound,
    closesAtTimestamp: IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_TIMESTAMP,
    closesAtUtc: IAT_V2_DEVNET_CEREMONY_HORIZON_CLOSE_UTC,
    closesOn: IAT_V2_DEVNET_CEREMONY_HORIZON_TRANSITION,
  });
}

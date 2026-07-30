export const IAT_V2_SECONDS_PER_DAY = 86_400;
export const IAT_V2_SECONDS_PER_WEEK = 604_800;

function integerTimestamp(value, label) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized)) {
    throw new Error(`${label} must be a safe integer Unix timestamp`);
  }
  return normalized;
}

export function currentIatV2Week(genesisTimestamp, nowTimestamp) {
  const genesis = integerTimestamp(genesisTimestamp, "Genesis timestamp");
  const now = integerTimestamp(nowTimestamp, "Current timestamp");
  if (now < genesis) return null;
  return Math.floor((now - genesis) / IAT_V2_SECONDS_PER_WEEK);
}

export function currentIatV2CccRound(genesisTimestamp, nowTimestamp) {
  const genesis = integerTimestamp(genesisTimestamp, "Genesis timestamp");
  const now = integerTimestamp(nowTimestamp, "Current timestamp");
  const firstSelection = genesis + IAT_V2_SECONDS_PER_DAY;
  if (now < firstSelection) return null;
  return Math.floor((now - firstSelection) / IAT_V2_SECONDS_PER_WEEK);
}

export function secondsUntilIatV2Week(genesisTimestamp, week, nowTimestamp) {
  const genesis = integerTimestamp(genesisTimestamp, "Genesis timestamp");
  const now = integerTimestamp(nowTimestamp, "Current timestamp");
  if (!Number.isSafeInteger(week) || week < 0) {
    throw new Error("Policy week must be a non-negative safe integer");
  }
  return Math.max(0, genesis + (week * IAT_V2_SECONDS_PER_WEEK) - now);
}

export function secondsUntilIatV2CccRound(genesisTimestamp, round, nowTimestamp) {
  const genesis = integerTimestamp(genesisTimestamp, "Genesis timestamp");
  const now = integerTimestamp(nowTimestamp, "Current timestamp");
  if (!Number.isSafeInteger(round) || round < 0) {
    throw new Error("CCC round must be a non-negative safe integer");
  }
  return Math.max(
    0,
    genesis + IAT_V2_SECONDS_PER_DAY + (round * IAT_V2_SECONDS_PER_WEEK) - now,
  );
}

export function formatRehearsalWait(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error("Wait must be non-negative");
  const rounded = Math.ceil(seconds);
  const days = Math.floor(rounded / IAT_V2_SECONDS_PER_DAY);
  const hours = Math.floor((rounded % IAT_V2_SECONDS_PER_DAY) / 3_600);
  const minutes = Math.floor((rounded % 3_600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours || days) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

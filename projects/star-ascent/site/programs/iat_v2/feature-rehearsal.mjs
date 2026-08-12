export const IAT_V2_SECONDS_PER_DAY = 86_400;
export const IAT_V2_SECONDS_PER_WEEK = 604_800;
export const IAT_V2_POSITION_TERM_WEEKS = 52;

const IAT_V2_POSITION_SETTLED_MASK =
  (1n << BigInt(IAT_V2_POSITION_TERM_WEEKS)) - 1n;

function integerTimestamp(value, label) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized)) {
    throw new Error(`${label} must be a safe integer Unix timestamp`);
  }
  return normalized;
}

function nonNegativeSafeInteger(value, label) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return normalized;
}

function positionSettledMask(value) {
  if (
    typeof value !== "bigint"
    || value < 0n
    || value > IAT_V2_POSITION_SETTLED_MASK
  ) {
    throw new Error("Position settled mask must be an unsigned 52-bit bigint");
  }
  return value;
}

export function* iterateUnsetIatV2PositionWeeks({
  firstAccrualWeek,
  settledMask,
}) {
  const firstWeek = nonNegativeSafeInteger(firstAccrualWeek, "First accrual week");
  const lastWeek = firstWeek + IAT_V2_POSITION_TERM_WEEKS - 1;
  if (!Number.isSafeInteger(lastWeek)) {
    throw new Error("Position settlement range is outside the safe integer range");
  }
  const mask = positionSettledMask(settledMask);
  for (let ordinal = 0; ordinal < IAT_V2_POSITION_TERM_WEEKS; ordinal += 1) {
    if ((mask & (1n << BigInt(ordinal))) === 0n) {
      yield Object.freeze({ ordinal, week: firstWeek + ordinal });
    }
  }
}

export function earliestDueIatV2PositionWeek({
  firstAccrualWeek,
  settledMask,
  currentWeek,
}) {
  const next = iterateUnsetIatV2PositionWeeks({ firstAccrualWeek, settledMask }).next();
  if (currentWeek === null) return null;
  const throughWeek = nonNegativeSafeInteger(currentWeek, "Current policy week");
  if (next.done || next.value.week > throughWeek) return null;
  return next.value;
}

export function isIatV2LinkedRoundReadyForSettlement(round) {
  return (
    round !== null
    && typeof round === "object"
    && (round.status === 1 || round.status === 2)
  );
}

export function selectIatV2FeatureDuePositionSettlement({
  positions,
  currentWeek,
  linkedRounds = {},
}) {
  if (!Array.isArray(positions)) throw new Error("Feature positions must be an array");
  const due = positions.map((position) => (
    position
      ? earliestDueIatV2PositionWeek({
        firstAccrualWeek: position.firstAccrualWeek,
        settledMask: position.settledMask,
        currentWeek,
      })
      : null
  ));
  if (positions[0] && due[0]) {
    return Object.freeze({ positionIndex: 0, ...due[0], round: null });
  }
  for (let positionIndex = 1; positionIndex < positions.length; positionIndex += 1) {
    if (!positions[positionIndex] || !due[positionIndex]) continue;
    const round = linkedRounds[due[positionIndex].week];
    if (isIatV2LinkedRoundReadyForSettlement(round)) {
      return Object.freeze({ positionIndex, ...due[positionIndex], round });
    }
  }
  return null;
}

export function assertIatV2RehearsalAllocationBalances({
  balances,
  allocationDestinations,
  active,
}) {
  for (const [name, allocation] of Object.entries(allocationDestinations)) {
    const balance = balances[name];
    if (typeof balance !== "bigint") {
      throw new Error(`${name} balance is unavailable`);
    }
    if (!active && balance !== allocation.amount) {
      throw new Error(`${name} balance is ${balance}, expected ${allocation.amount}`);
    }
    if (active && balance > allocation.amount) {
      throw new Error(
        `${name} balance is ${balance}, above original allocation ${allocation.amount}`,
      );
    }
  }
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

export function secondsUntilIatV2RoundRecovery(commitTimestamp, nowTimestamp) {
  const committedAt = integerTimestamp(commitTimestamp, "CCC commit timestamp");
  const now = integerTimestamp(nowTimestamp, "Current timestamp");
  const recoveryTimestamp = committedAt + IAT_V2_SECONDS_PER_DAY;
  if (!Number.isSafeInteger(recoveryTimestamp)) {
    throw new Error("CCC recovery timestamp is outside the safe integer range");
  }
  return Math.max(0, recoveryTimestamp - now);
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

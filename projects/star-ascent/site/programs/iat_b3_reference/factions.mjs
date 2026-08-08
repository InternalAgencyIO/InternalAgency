import { createHash } from "node:crypto";

import { assertDailyLawWriteAllowed } from "./daily-lockdown-consensus.mjs";

export const FACTION_LAW_ID = "IAT_B3_FACTIONS_V1";
export const ALLEGIANCE_COOLDOWN_SECONDS = 86_400n;
export const FACTION_WEEK_SECONDS = 604_800n;
export const U64_MAX = (1n << 64n) - 1n;
export const I64_MIN = -(1n << 63n);
export const I64_MAX = (1n << 63n) - 1n;

export const FACTIONS = Object.freeze([
  Object.freeze({ id: "radiance", displayLabel: "Radiance" }),
  Object.freeze({ id: "ellie", displayLabel: "Ellie" }),
  Object.freeze({ id: "alia", displayLabel: "Alia" }),
  Object.freeze({ id: "ece", displayLabel: "Ece" }),
  Object.freeze({ id: "boss", displayLabel: "the boss" }),
]);

export const FACTION_IDS = Object.freeze(FACTIONS.map(({ id }) => id));

function asInteger(value, label) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/u.test(value)) return BigInt(value);
  throw new TypeError(`${label} must be an integer value`);
}

function asNonnegativeInteger(value, label) {
  const normalized = asInteger(value, label);
  if (normalized < 0n) throw new RangeError(`${label} cannot be negative`);
  return normalized;
}

function asU64(value, label) {
  const normalized = asNonnegativeInteger(value, label);
  if (normalized > U64_MAX) throw new RangeError(`${label} exceeds u64`);
  return normalized;
}

function asI64(value, label) {
  const normalized = asInteger(value, label);
  if (normalized < I64_MIN || normalized > I64_MAX) {
    throw new RangeError(`${label} exceeds i64`);
  }
  return normalized;
}

function assertString(value, label) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 128 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new TypeError(
      `${label} must be a trimmed nonempty string of at most 128 characters without controls`,
    );
  }
  return value;
}

export function assertFactionId(factionId) {
  if (!FACTION_IDS.includes(factionId)) {
    throw new Error("UNKNOWN_FACTION");
  }
  return factionId;
}

/**
 * Apply a first pledge or allegiance switch. Character leaders never sign and
 * own no authority in this transition; only the operator identity is stored.
 */
export function applyAllegianceChange({
  operator,
  nextFactionId,
  unixTimestamp,
  currentAllegiance = null,
  dailyLawState,
}) {
  assertDailyLawWriteAllowed(dailyLawState);
  const owner = assertString(operator, "operator");
  const factionId = assertFactionId(nextFactionId);
  const now = asI64(unixTimestamp, "unixTimestamp");

  if (currentAllegiance === null) {
    return Object.freeze({
      operator: owner,
      factionId,
      lastChangedAt: now,
    });
  }
  if (currentAllegiance === undefined || typeof currentAllegiance !== "object") {
    throw new TypeError("currentAllegiance must be null or an allegiance object");
  }
  if (currentAllegiance.operator !== owner) {
    throw new Error("ALLEGIANCE_OWNER_MISMATCH");
  }
  assertFactionId(currentAllegiance.factionId);
  if (currentAllegiance.factionId === factionId) {
    throw new Error("ALLEGIANCE_NO_OP");
  }
  const lastChangedAt = asI64(currentAllegiance.lastChangedAt, "lastChangedAt");
  if (lastChangedAt > I64_MAX - ALLEGIANCE_COOLDOWN_SECONDS) {
    throw new Error("ALLEGIANCE_COOLDOWN_OVERFLOW");
  }
  const earliestChangeAt = lastChangedAt + ALLEGIANCE_COOLDOWN_SECONDS;
  if (now < earliestChangeAt) {
    throw new Error("ALLEGIANCE_COOLDOWN_ACTIVE");
  }

  return Object.freeze({
    operator: owner,
    factionId,
    lastChangedAt: now,
  });
}

export function factionWeekIndex({ unixTimestamp, epochStartUnixTimestamp }) {
  const now = asI64(unixTimestamp, "unixTimestamp");
  const epoch = asI64(epochStartUnixTimestamp, "epochStartUnixTimestamp");
  if (now < epoch) throw new Error("FACTION_EPOCH_NOT_STARTED");
  return (now - epoch) / FACTION_WEEK_SECONDS;
}

function normalizeFactionScores(scores) {
  if (scores === null || typeof scores !== "object" || Array.isArray(scores)) {
    throw new TypeError("scores must be an object keyed by every fixed faction id");
  }
  const keys = Object.keys(scores).sort();
  const expectedKeys = [...FACTION_IDS].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new Error("FACTION_SCORE_SET_MISMATCH");
  }
  return Object.freeze(
    Object.fromEntries(
      FACTION_IDS.map((id) => [id, asU64(scores[id], `scores.${id}`)]),
    ),
  );
}

/**
 * Allocate only whole base units. Fractional dust is carried forward instead
 * of giving a canonical-order faction an artificial advantage.
 */
export function allocateCommunityPoolProportionally({ poolAmount, scores }) {
  const pool = asU64(poolAmount, "poolAmount");
  const normalizedScores = normalizeFactionScores(scores);
  const totalScore = FACTION_IDS.reduce(
    (total, factionId) => total + normalizedScores[factionId],
    0n,
  );
  if (totalScore === 0n) {
    return Object.freeze({
      allocations: Object.freeze(Object.fromEntries(FACTION_IDS.map((id) => [id, 0n]))),
      carryForward: pool,
      totalScore,
    });
  }

  const allocations = Object.freeze(
    Object.fromEntries(
      FACTION_IDS.map((id) => [id, (pool * normalizedScores[id]) / totalScore]),
    ),
  );
  const allocated = FACTION_IDS.reduce((total, id) => total + allocations[id], 0n);
  return Object.freeze({
    allocations,
    carryForward: pool - allocated,
    totalScore,
  });
}

export function equalFollowerDistribution({ rewardAmount, eligibleFollowerCount }) {
  const reward = asU64(rewardAmount, "rewardAmount");
  const count = asU64(eligibleFollowerCount, "eligibleFollowerCount");
  if (count === 0n) {
    return Object.freeze({ perFollower: 0n, carryForward: reward });
  }
  const perFollower = reward / count;
  return Object.freeze({
    perFollower,
    carryForward: reward - perFollower * count,
  });
}

function scoreCommitment(weekIndex, scores) {
  const payload = [
    FACTION_LAW_ID,
    weekIndex.toString(),
    ...FACTION_IDS.map((id) => `${id}:${scores[id].toString()}`),
  ].join("\u0000");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Record a unique weekly winner. A tied maximum deliberately fails closed:
 * the scoring/Sybil system and a sealed exact tie rule must be frozen before
 * Mainnet rather than invented inside this reference.
 */
export function finalizeFactionWeek({
  weekIndex,
  scores,
  dailyLawState,
  existingFinalization = null,
}) {
  assertDailyLawWriteAllowed(dailyLawState);
  const week = asU64(weekIndex, "weekIndex");
  const normalizedScores = normalizeFactionScores(scores);
  const commitment = scoreCommitment(week, normalizedScores);
  const highestScore = FACTION_IDS.reduce(
    (highest, id) =>
      normalizedScores[id] > highest ? normalizedScores[id] : highest,
    0n,
  );
  const leaders = FACTION_IDS.filter((id) => normalizedScores[id] === highestScore);
  if (leaders.length !== 1) {
    throw new Error("FACTION_WEEK_TIE_REQUIRES_SEALED_TIEBREAK");
  }

  const expected = Object.freeze({
    lawId: FACTION_LAW_ID,
    weekIndex: week,
    winnerFactionId: leaders[0],
    winningScore: highestScore,
    scoreCommitment: commitment,
  });
  if (existingFinalization !== null) {
    if (
      existingFinalization === undefined ||
      typeof existingFinalization !== "object" ||
      Array.isArray(existingFinalization)
    ) {
      throw new Error("CONFLICTING_FACTION_WEEK_FINALIZATION");
    }
    const keys = Object.keys(existingFinalization).sort();
    const expectedKeys = Object.keys(expected).sort();
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key, index) => key !== expectedKeys[index]) ||
      Object.entries(expected).some(
        ([field, expectedValue]) => existingFinalization[field] !== expectedValue,
      )
    ) {
      throw new Error("CONFLICTING_FACTION_WEEK_FINALIZATION");
    }
    return existingFinalization;
  }
  return expected;
}

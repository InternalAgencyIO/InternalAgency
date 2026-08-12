import {
  assertDailyLawUnfinalizedTransition,
  assertDailyLawWriteAllowed,
  createLockdownDecision,
  protocolLocalDay,
} from "./daily-lockdown-consensus.mjs";

export const CORE_TEAM_CAP_LAW_ID = "IAT_B3_CORE_TEAM_CAP_LAW_V1";
export const CORE_TEAM_CAP_NUMERATOR = 1n;
export const CORE_TEAM_CAP_DENOMINATOR = 10n;
export const FIXED_UTC_PLUS_3_SECONDS = 10_800n;
export const SECONDS_PER_DAY = 86_400n;
export const CORE_CAP_RECONCILIATION_LOCAL_SECOND = 0n;
export const U64_MAX = (1n << 64n) - 1n;
export const I64_MIN = -(1n << 63n);
export const I64_MAX = (1n << 63n) - 1n;

export const CORE_CAP_WITHDRAWAL_DISPOSITION = Object.freeze({
  ALLOWED: "ALLOWED",
  RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED",
  STATE_CORRUPT: "STATE_CORRUPT",
});

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

function floorDiv(dividend, divisor) {
  const quotient = dividend / divisor;
  const remainder = dividend % divisor;
  return remainder < 0n ? quotient - 1n : quotient;
}

function ceilDivNonnegative(dividend, divisor) {
  if (dividend < 0n || divisor <= 0n) {
    throw new RangeError("ceilDivNonnegative requires a nonnegative dividend and positive divisor");
  }
  return (dividend + divisor - 1n) / divisor;
}

/**
 * The core-cap accounting day is the fixed-UTC+03:00 interval
 * [00:00:00, next 00:00:00). This is deliberately distinct from the IAT
 * lockdown day, which rolls at local 00:01:00.
 */
export function coreCapLocalDay(unixTimestamp) {
  const timestamp = asI64(unixTimestamp, "unixTimestamp");
  return floorDiv(
    timestamp + FIXED_UTC_PLUS_3_SECONDS - CORE_CAP_RECONCILIATION_LOCAL_SECOND,
    SECONDS_PER_DAY,
  );
}

/**
 * Return the smallest burn that makes the program-custodied core balance no
 * greater than 10% of the post-burn mint supply.
 *
 * Let S be the pre-burn mint supply, C the enforceable core-custody balance,
 * and B the burn. The immutable condition is:
 *
 *   10 * (C - B) <= S - B
 *
 * Therefore B = ceil(max(0, 10*C - S) / 9). Computing the cap against the
 * pre-burn supply alone would under-burn because burning also reduces supply.
 */
export function requiredCoreCustodyBurn({ mintSupply, coreCustodyBalance }) {
  const supply = asU64(mintSupply, "mintSupply");
  const core = asU64(coreCustodyBalance, "coreCustodyBalance");
  if (core > supply) {
    throw new RangeError("coreCustodyBalance cannot exceed mintSupply");
  }

  const excessNumerator =
    CORE_TEAM_CAP_DENOMINATOR * core - CORE_TEAM_CAP_NUMERATOR * supply;
  if (excessNumerator <= 0n) return 0n;

  return ceilDivNonnegative(
    excessNumerator,
    CORE_TEAM_CAP_DENOMINATOR - CORE_TEAM_CAP_NUMERATOR,
  );
}

export function postBurnCoreCapHolds({ mintSupply, coreCustodyBalance, burnAmount }) {
  const supply = asU64(mintSupply, "mintSupply");
  const core = asU64(coreCustodyBalance, "coreCustodyBalance");
  const burn = asU64(burnAmount, "burnAmount");
  if (core > supply || burn > core) return false;

  return (
    CORE_TEAM_CAP_DENOMINATOR * (core - burn) <=
    CORE_TEAM_CAP_NUMERATOR * (supply - burn)
  );
}

/** Pure calculation used only by the atomic reconciliation/finalization path. */
function calculateCoreCapReconciliation({
  unixTimestamp,
  lastReconciledLocalDay,
  mintSupply,
  coreCustodyBalance,
}) {
  const localDay = coreCapLocalDay(unixTimestamp);
  if (lastReconciledLocalDay !== null && lastReconciledLocalDay !== undefined) {
    const last = asI64(lastReconciledLocalDay, "lastReconciledLocalDay");
    if (last >= localDay) {
      throw new Error(
        last === localDay
          ? "CORE_CAP_DAY_ALREADY_RECONCILED"
          : "CORE_CAP_STATE_FROM_FUTURE_DAY",
      );
    }
  }

  const supply = asU64(mintSupply, "mintSupply");
  const core = asU64(coreCustodyBalance, "coreCustodyBalance");
  const burnAmount = requiredCoreCustodyBurn({
    mintSupply: supply,
    coreCustodyBalance: core,
  });
  const postBurnMintSupply = supply - burnAmount;
  const postBurnCoreCustodyBalance = core - burnAmount;

  if (
    !postBurnCoreCapHolds({
      mintSupply: supply,
      coreCustodyBalance: core,
      burnAmount,
    })
  ) {
    throw new Error("CORE_CAP_RECONCILIATION_FAILED");
  }

  return Object.freeze({
    lawId: CORE_TEAM_CAP_LAW_ID,
    localDay,
    burnAmount,
    postBurnMintSupply,
    postBurnCoreCustodyBalance,
  });
}

/**
 * The sole authoritative daily transition. At or after local 00:01, the cap
 * result is calculated from the balances observed by this call, BurnChecked
 * must succeed, and the current Daily Law decision is finalized in the same
 * atomic instruction. The adapter must commit every result or none of them.
 */
export function reconcileCoreCapAndFinalizeDailyLaw({
  unixTimestamp,
  lastReconciledLocalDay,
  mintSupply,
  coreCustodyBalance,
  dailyLawState,
  randomnessOutputHex,
}) {
  const acceptedLawState = assertDailyLawUnfinalizedTransition(dailyLawState);
  const timestamp = asI64(unixTimestamp, "unixTimestamp");
  const localDay = coreCapLocalDay(unixTimestamp);
  if (
    localDay !== acceptedLawState.currentLocalDay ||
    protocolLocalDay(timestamp) !== acceptedLawState.currentLocalDay
  ) {
    throw new Error("CORE_CAP_DAILY_LAW_DAY_MISMATCH");
  }
  const reconciliation = calculateCoreCapReconciliation({
    unixTimestamp,
    lastReconciledLocalDay,
    mintSupply,
    coreCustodyBalance,
  });
  const lockdownDecision = createLockdownDecision({
    localDay: acceptedLawState.currentLocalDay,
    randomnessOutputHex,
    schedule: acceptedLawState.schedule,
  });
  return Object.freeze({ reconciliation, lockdownDecision });
}

export function coreWithdrawalDisposition({
  unixTimestamp,
  lastReconciledLocalDay,
  dailyLawState,
}) {
  const acceptedLawState = assertDailyLawWriteAllowed(dailyLawState);
  const currentDay = coreCapLocalDay(unixTimestamp);
  if (
    currentDay !== acceptedLawState.currentLocalDay &&
    currentDay !== acceptedLawState.currentLocalDay + 1n
  ) {
    return CORE_CAP_WITHDRAWAL_DISPOSITION.STATE_CORRUPT;
  }
  if (lastReconciledLocalDay === null || lastReconciledLocalDay === undefined) {
    return CORE_CAP_WITHDRAWAL_DISPOSITION.RECONCILIATION_REQUIRED;
  }
  const last = asI64(lastReconciledLocalDay, "lastReconciledLocalDay");
  if (last > currentDay) return CORE_CAP_WITHDRAWAL_DISPOSITION.STATE_CORRUPT;
  // During local 00:00:00..00:00:59 the cap day has advanced but the new
  // Daily Law decision cannot yet prove an atomic reconciliation.
  if (currentDay !== acceptedLawState.currentLocalDay) {
    return CORE_CAP_WITHDRAWAL_DISPOSITION.RECONCILIATION_REQUIRED;
  }
  return last === currentDay
    ? CORE_CAP_WITHDRAWAL_DISPOSITION.ALLOWED
    : CORE_CAP_WITHDRAWAL_DISPOSITION.RECONCILIATION_REQUIRED;
}

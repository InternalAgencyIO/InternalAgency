export const IAT_PROTOCOL_OFFSET_SECONDS = 10_800n;
export const SECONDS_PER_DAY = 86_400n;
export const FRIDAY_LOCAL_DAY_MODULUS = 1n;
export const FRIDAY_PAUSE_ERROR = "FRIDAY_PAUSE";

export const OPERATION_KIND = Object.freeze({
  USER_TRANSACTION: "USER_TRANSACTION",
  CONSENSUS_HOUSEKEEPING: "CONSENSUS_HOUSEKEEPING",
  QUERY: "QUERY",
  SIMULATION: "SIMULATION",
});

function asInteger(value, label) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/u.test(value)) return BigInt(value);
  throw new TypeError(`${label} must be an integer Unix-second value`);
}

export function floorDiv(dividend, divisor) {
  const a = asInteger(dividend, "dividend");
  const b = asInteger(divisor, "divisor");
  if (b <= 0n) throw new RangeError("divisor must be positive");
  const quotient = a / b;
  const remainder = a % b;
  return remainder < 0n ? quotient - 1n : quotient;
}

export function floorMod(dividend, divisor) {
  const a = asInteger(dividend, "dividend");
  const b = asInteger(divisor, "divisor");
  if (b <= 0n) throw new RangeError("divisor must be positive");
  const remainder = a % b;
  return remainder < 0n ? remainder + b : remainder;
}

export function protocolLocalDay(consensusUnixSeconds) {
  const seconds = asInteger(consensusUnixSeconds, "consensusUnixSeconds");
  return floorDiv(seconds + IAT_PROTOCOL_OFFSET_SECONDS, SECONDS_PER_DAY);
}

export function isFridayPause(consensusUnixSeconds) {
  return floorMod(protocolLocalDay(consensusUnixSeconds), 7n) === FRIDAY_LOCAL_DAY_MODULUS;
}

export function fridayPauseWindow(consensusUnixSeconds) {
  if (!isFridayPause(consensusUnixSeconds)) return null;
  const localDay = protocolLocalDay(consensusUnixSeconds);
  const opensAtUnixSeconds = localDay * SECONDS_PER_DAY - IAT_PROTOCOL_OFFSET_SECONDS;
  return Object.freeze({
    opensAtUnixSeconds,
    closesAtUnixSeconds: opensAtUnixSeconds + SECONDS_PER_DAY,
  });
}

export function operationDisposition(consensusUnixSeconds, operationKind) {
  if (!Object.values(OPERATION_KIND).includes(operationKind)) {
    throw new TypeError(`unknown operation kind: ${operationKind}`);
  }

  const paused = isFridayPause(consensusUnixSeconds);
  if (paused && operationKind === OPERATION_KIND.USER_TRANSACTION) {
    return Object.freeze({ accepted: false, code: FRIDAY_PAUSE_ERROR, binding: true });
  }
  if (operationKind === OPERATION_KIND.SIMULATION) {
    return Object.freeze({ accepted: true, code: "NON_BINDING_SIMULATION", binding: false });
  }
  return Object.freeze({ accepted: true, code: "ALLOWED", binding: true });
}

export function validateBlockUserTransactions(consensusUnixSeconds, userTransactionCount) {
  const count = asInteger(userTransactionCount, "userTransactionCount");
  if (count < 0n) throw new RangeError("userTransactionCount cannot be negative");
  if (isFridayPause(consensusUnixSeconds) && count !== 0n) {
    throw new Error(`${FRIDAY_PAUSE_ERROR}: Friday blocks cannot contain user transactions`);
  }
  return true;
}

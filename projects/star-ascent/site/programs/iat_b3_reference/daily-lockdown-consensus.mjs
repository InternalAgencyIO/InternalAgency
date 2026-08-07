import { createHash } from "node:crypto";

export const IAT_PROTOCOL_OFFSET_SECONDS = 10_800n;
export const SECONDS_PER_DAY = 86_400n;
export const FRIDAY_LOCAL_DAY_MODULUS = 1n;
export const DAILY_DECISION_LOCAL_SECOND = 0n;
export const LOCKDOWN_DURATION_NOMINAL_SECONDS = SECONDS_PER_DAY;
export const DRAW_DENOMINATOR = 10_000n;
export const NORMAL_DAY_LOCKDOWN_NUMERATOR = 100n;
export const FRIDAY_LOCKDOWN_NUMERATOR = 6_667n;
export const DAILY_LOCKDOWN_ERROR = "DAILY_LOCKDOWN";
export const DAILY_LOCKDOWN_LAW_ID = "IAT_B3_DAILY_LOCKDOWN_LAW_V1";

const TWO_TO_256 = 1n << 256n;
const UNBIASED_DRAW_LIMIT = TWO_TO_256 - (TWO_TO_256 % DRAW_DENOMINATOR);

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
  throw new TypeError(`${label} must be an integer value`);
}

function asNetworkId(value) {
  if (
    typeof value !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value)
  ) {
    throw new TypeError(
      "networkId must be 1-128 lowercase ASCII letters, digits, dots, underscores, or hyphens",
    );
  }
  return value;
}

function asBytes32Hex(value, label) {
  if (typeof value !== "string" || !/^[0-9a-fA-F]{64}$/u.test(value)) {
    throw new TypeError(`${label} must be exactly 32 bytes encoded as hexadecimal`);
  }
  return value.toLowerCase();
}

export function floorDiv(dividend, divisor) {
  const a = asInteger(dividend, "dividend");
  const b = asInteger(divisor, "divisor");
  if (b <= 0n) throw new RangeError("divisor must be positive");
  const quotient = a / b;
  const remainder = a % b;
  return remainder < 0n ? quotient - 1n : quotient;
}

export function ceilDiv(dividend, divisor) {
  const a = asInteger(dividend, "dividend");
  const b = asInteger(divisor, "divisor");
  if (b <= 0n) throw new RangeError("divisor must be positive");
  return -floorDiv(-a, b);
}

export function floorMod(dividend, divisor) {
  const a = asInteger(dividend, "dividend");
  const b = asInteger(divisor, "divisor");
  if (b <= 0n) throw new RangeError("divisor must be positive");
  const remainder = a % b;
  return remainder < 0n ? remainder + b : remainder;
}

export function protocolLocalDay(nominalUnixSeconds) {
  const seconds = asInteger(nominalUnixSeconds, "nominalUnixSeconds");
  return floorDiv(seconds + IAT_PROTOCOL_OFFSET_SECONDS, SECONDS_PER_DAY);
}

export function isFridayLocalDay(localDay) {
  return floorMod(asInteger(localDay, "localDay"), 7n) === FRIDAY_LOCAL_DAY_MODULUS;
}

export function lockdownChanceNumerator(localDay) {
  return isFridayLocalDay(localDay)
    ? FRIDAY_LOCKDOWN_NUMERATOR
    : NORMAL_DAY_LOCKDOWN_NUMERATOR;
}

export function createImmutableSchedule({
  genesisHeight,
  genesisNominalUnixSeconds,
  nominalBlockSeconds,
  networkId,
}) {
  const normalized = {
    genesisHeight: asInteger(genesisHeight, "genesisHeight"),
    genesisNominalUnixSeconds: asInteger(
      genesisNominalUnixSeconds,
      "genesisNominalUnixSeconds",
    ),
    nominalBlockSeconds: asInteger(nominalBlockSeconds, "nominalBlockSeconds"),
    networkId: asNetworkId(networkId),
  };
  if (normalized.genesisHeight < 0n) throw new RangeError("genesisHeight cannot be negative");
  if (normalized.nominalBlockSeconds <= 0n) {
    throw new RangeError("nominalBlockSeconds must be positive");
  }
  return Object.freeze(normalized);
}

function normalizeSchedule(schedule) {
  if (schedule === null || typeof schedule !== "object") {
    throw new TypeError("schedule must be an immutable schedule object");
  }
  return createImmutableSchedule(schedule);
}

export function nominalUnixSecondsAtHeight(protocolHeight, schedule) {
  const spec = normalizeSchedule(schedule);
  const height = asInteger(protocolHeight, "protocolHeight");
  if (height < spec.genesisHeight) throw new RangeError("protocolHeight predates Genesis");
  return (
    spec.genesisNominalUnixSeconds +
    (height - spec.genesisHeight) * spec.nominalBlockSeconds
  );
}

export function firstHeightAtOrAfterNominalUnixSeconds(nominalUnixSeconds, schedule) {
  const spec = normalizeSchedule(schedule);
  const target = asInteger(nominalUnixSeconds, "nominalUnixSeconds");
  return (
    spec.genesisHeight +
    ceilDiv(target - spec.genesisNominalUnixSeconds, spec.nominalBlockSeconds)
  );
}

export function dailyLockdownWindow(localDay, schedule) {
  const spec = normalizeSchedule(schedule);
  const day = asInteger(localDay, "localDay");
  const decisionAtNominalUnixSeconds =
    day * SECONDS_PER_DAY -
    IAT_PROTOCOL_OFFSET_SECONDS +
    DAILY_DECISION_LOCAL_SECOND;
  const closesAtNominalUnixSeconds =
    decisionAtNominalUnixSeconds + LOCKDOWN_DURATION_NOMINAL_SECONDS;
  const decisionHeight = firstHeightAtOrAfterNominalUnixSeconds(
    decisionAtNominalUnixSeconds,
    spec,
  );
  const closesAtHeight = firstHeightAtOrAfterNominalUnixSeconds(
    closesAtNominalUnixSeconds,
    spec,
  );

  if (decisionHeight <= spec.genesisHeight) {
    throw new RangeError("daily decision must occur after the Genesis block");
  }

  return Object.freeze({
    localDay: day,
    isFriday: isFridayLocalDay(day),
    decisionHeight,
    opensAtHeight: decisionHeight,
    closesAtHeight,
    decisionAtNominalUnixSeconds,
    closesAtNominalUnixSeconds,
  });
}

function encodeDrawInput(networkId, localDay, randomnessOutputHex, counter) {
  const counterHex = counter.toString(16).padStart(16, "0");
  if (counterHex.length > 16) throw new RangeError("draw counter exceeds uint64");
  return Buffer.concat([
    Buffer.from(DAILY_LOCKDOWN_LAW_ID, "utf8"),
    Buffer.from([0]),
    Buffer.from(networkId, "ascii"),
    Buffer.from([0]),
    Buffer.from(localDay.toString(10), "ascii"),
    Buffer.from([0]),
    Buffer.from(randomnessOutputHex, "hex"),
    Buffer.from(counterHex, "hex"),
  ]);
}

export function deriveLockdownDraw({ randomnessOutputHex, localDay, networkId }) {
  const entropy = asBytes32Hex(randomnessOutputHex, "randomnessOutputHex");
  const day = asInteger(localDay, "localDay");
  const domainNetworkId = asNetworkId(networkId);
  const chanceNumerator = lockdownChanceNumerator(day);

  for (let counter = 0n; ; counter += 1n) {
    const digest = createHash("sha256")
      .update(encodeDrawInput(domainNetworkId, day, entropy, counter))
      .digest();
    const sample = BigInt(`0x${digest.toString("hex")}`);
    if (sample >= UNBIASED_DRAW_LIMIT) continue;

    const bucket = sample % DRAW_DENOMINATOR;
    return Object.freeze({
      counter,
      bucket,
      chanceNumerator,
      chanceDenominator: DRAW_DENOMINATOR,
      locked: bucket < chanceNumerator,
    });
  }
}

export function createLockdownDecision({ localDay, randomnessOutputHex, schedule }) {
  const spec = normalizeSchedule(schedule);
  const window = dailyLockdownWindow(localDay, spec);
  const entropy = asBytes32Hex(randomnessOutputHex, "randomnessOutputHex");
  const draw = deriveLockdownDraw({
    randomnessOutputHex: entropy,
    localDay: window.localDay,
    networkId: spec.networkId,
  });

  return Object.freeze({
    lawId: DAILY_LOCKDOWN_LAW_ID,
    localDay: window.localDay,
    isFriday: window.isFriday,
    decisionHeight: window.decisionHeight,
    randomnessOutputHex: entropy,
    drawCounter: draw.counter,
    drawBucket: draw.bucket,
    chanceNumerator: draw.chanceNumerator,
    chanceDenominator: draw.chanceDenominator,
    locked: draw.locked,
  });
}

export function validateLockdownDecision(decision, schedule) {
  if (decision === null || typeof decision !== "object") {
    throw new TypeError("decision must be a lockdown decision object");
  }
  const expected = createLockdownDecision({
    localDay: decision.localDay,
    randomnessOutputHex: decision.randomnessOutputHex,
    schedule,
  });
  for (const field of [
    "lawId",
    "localDay",
    "isFriday",
    "decisionHeight",
    "randomnessOutputHex",
    "drawCounter",
    "drawBucket",
    "chanceNumerator",
    "chanceDenominator",
    "locked",
  ]) {
    if (decision[field] !== expected[field]) {
      throw new Error(`invalid lockdown decision field: ${field}`);
    }
  }
  return true;
}

export function isDailyLockdown(protocolHeight, decision, schedule) {
  const height = asInteger(protocolHeight, "protocolHeight");
  validateLockdownDecision(decision, schedule);
  const window = dailyLockdownWindow(decision.localDay, schedule);
  return (
    decision.locked &&
    height >= window.opensAtHeight &&
    height < window.closesAtHeight
  );
}

export function operationDisposition(protocolHeight, decision, operationKind, schedule) {
  if (!Object.values(OPERATION_KIND).includes(operationKind)) {
    throw new TypeError(`unknown operation kind: ${operationKind}`);
  }

  const locked = isDailyLockdown(protocolHeight, decision, schedule);
  if (locked && operationKind === OPERATION_KIND.USER_TRANSACTION) {
    return Object.freeze({ accepted: false, code: DAILY_LOCKDOWN_ERROR, binding: true });
  }
  if (operationKind === OPERATION_KIND.SIMULATION) {
    return Object.freeze({ accepted: true, code: "NON_BINDING_SIMULATION", binding: false });
  }
  return Object.freeze({ accepted: true, code: "ALLOWED", binding: true });
}

export function validateBlockUserTransactions(
  protocolHeight,
  decision,
  userTransactionCount,
  schedule,
) {
  const count = asInteger(userTransactionCount, "userTransactionCount");
  if (count < 0n) throw new RangeError("userTransactionCount cannot be negative");
  if (isDailyLockdown(protocolHeight, decision, schedule) && count !== 0n) {
    throw new Error(
      `${DAILY_LOCKDOWN_ERROR}: locked blocks cannot contain user transactions`,
    );
  }
  return true;
}

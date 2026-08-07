import { createHash } from "node:crypto";

export const IAT_PROTOCOL_OFFSET_SECONDS = 10_800n;
export const SECONDS_PER_DAY = 86_400n;
export const FRIDAY_LOCAL_DAY_MODULUS = 1n;
export const LOCKDOWN_START_LOCAL_SECOND = 60n;
export const LOCKDOWN_DURATION_NOMINAL_SECONDS = SECONDS_PER_DAY;
export const LOCKDOWN_CHANCE_NUMERATOR = 6_733n;
export const LOCKDOWN_CHANCE_DENOMINATOR = 10_000n;
export const FRIDAY_LOCKDOWN_ERROR = "FRIDAY_LOCKDOWN";
export const RANDOM_FRIDAY_LOCKDOWN_LAW_ID = "IAT_B3_RANDOM_FRIDAY_LOCKDOWN_V1";

const TWO_TO_256 = 1n << 256n;
const UNBIASED_DRAW_LIMIT =
  TWO_TO_256 - (TWO_TO_256 % LOCKDOWN_CHANCE_DENOMINATOR);

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

export function fridayLockdownWindow(fridayLocalDay, schedule) {
  const spec = normalizeSchedule(schedule);
  const localDay = asInteger(fridayLocalDay, "fridayLocalDay");
  if (floorMod(localDay, 7n) !== FRIDAY_LOCAL_DAY_MODULUS) {
    throw new RangeError("fridayLocalDay must identify a Friday in fixed UTC+03:00");
  }

  const opensAtNominalUnixSeconds =
    localDay * SECONDS_PER_DAY -
    IAT_PROTOCOL_OFFSET_SECONDS +
    LOCKDOWN_START_LOCAL_SECOND;
  const closesAtNominalUnixSeconds =
    opensAtNominalUnixSeconds + LOCKDOWN_DURATION_NOMINAL_SECONDS;
  const opensAtHeight = firstHeightAtOrAfterNominalUnixSeconds(
    opensAtNominalUnixSeconds,
    spec,
  );
  const closesAtHeight = firstHeightAtOrAfterNominalUnixSeconds(
    closesAtNominalUnixSeconds,
    spec,
  );

  if (opensAtHeight <= spec.genesisHeight) {
    throw new RangeError("Friday lockdown window must begin after the Genesis block");
  }

  return Object.freeze({
    fridayLocalDay: localDay,
    decisionHeight: opensAtHeight - 1n,
    opensAtHeight,
    closesAtHeight,
    opensAtNominalUnixSeconds,
    closesAtNominalUnixSeconds,
  });
}

function encodeDrawInput(networkId, fridayLocalDay, randomnessOutputHex, counter) {
  const counterHex = counter.toString(16).padStart(16, "0");
  if (counterHex.length > 16) throw new RangeError("draw counter exceeds uint64");
  return Buffer.concat([
    Buffer.from(RANDOM_FRIDAY_LOCKDOWN_LAW_ID, "utf8"),
    Buffer.from([0]),
    Buffer.from(networkId, "utf8"),
    Buffer.from([0]),
    Buffer.from(fridayLocalDay.toString(10), "ascii"),
    Buffer.from([0]),
    Buffer.from(randomnessOutputHex, "hex"),
    Buffer.from(counterHex, "hex"),
  ]);
}

export function deriveLockdownDraw({
  randomnessOutputHex,
  fridayLocalDay,
  networkId,
}) {
  const entropy = asBytes32Hex(randomnessOutputHex, "randomnessOutputHex");
  const localDay = asInteger(fridayLocalDay, "fridayLocalDay");
  const domainNetworkId = asNetworkId(networkId);
  if (floorMod(localDay, 7n) !== FRIDAY_LOCAL_DAY_MODULUS) {
    throw new RangeError("fridayLocalDay must identify a Friday in fixed UTC+03:00");
  }

  for (let counter = 0n; ; counter += 1n) {
    const digest = createHash("sha256")
      .update(encodeDrawInput(domainNetworkId, localDay, entropy, counter))
      .digest();
    const sample = BigInt(`0x${digest.toString("hex")}`);
    if (sample >= UNBIASED_DRAW_LIMIT) continue;

    const bucket = sample % LOCKDOWN_CHANCE_DENOMINATOR;
    return Object.freeze({
      counter,
      bucket,
      locked: bucket < LOCKDOWN_CHANCE_NUMERATOR,
    });
  }
}

export function createLockdownDecision({
  fridayLocalDay,
  randomnessOutputHex,
  schedule,
}) {
  const spec = normalizeSchedule(schedule);
  const window = fridayLockdownWindow(fridayLocalDay, spec);
  const entropy = asBytes32Hex(randomnessOutputHex, "randomnessOutputHex");
  const draw = deriveLockdownDraw({
    randomnessOutputHex: entropy,
    fridayLocalDay: window.fridayLocalDay,
    networkId: spec.networkId,
  });

  return Object.freeze({
    lawId: RANDOM_FRIDAY_LOCKDOWN_LAW_ID,
    fridayLocalDay: window.fridayLocalDay,
    decisionHeight: window.decisionHeight,
    randomnessOutputHex: entropy,
    drawCounter: draw.counter,
    drawBucket: draw.bucket,
    locked: draw.locked,
  });
}

export function validateLockdownDecision(decision, schedule) {
  if (decision === null || typeof decision !== "object") {
    throw new TypeError("decision must be a lockdown decision object");
  }
  const expected = createLockdownDecision({
    fridayLocalDay: decision.fridayLocalDay,
    randomnessOutputHex: decision.randomnessOutputHex,
    schedule,
  });
  for (const field of [
    "lawId",
    "fridayLocalDay",
    "decisionHeight",
    "randomnessOutputHex",
    "drawCounter",
    "drawBucket",
    "locked",
  ]) {
    if (decision[field] !== expected[field]) {
      throw new Error(`invalid lockdown decision field: ${field}`);
    }
  }
  return true;
}

export function isFridayLockdown(protocolHeight, decision, schedule) {
  const height = asInteger(protocolHeight, "protocolHeight");
  validateLockdownDecision(decision, schedule);
  const window = fridayLockdownWindow(decision.fridayLocalDay, schedule);
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

  const locked = isFridayLockdown(protocolHeight, decision, schedule);
  if (locked && operationKind === OPERATION_KIND.USER_TRANSACTION) {
    return Object.freeze({ accepted: false, code: FRIDAY_LOCKDOWN_ERROR, binding: true });
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
  if (isFridayLockdown(protocolHeight, decision, schedule) && count !== 0n) {
    throw new Error(
      `${FRIDAY_LOCKDOWN_ERROR}: locked Friday blocks cannot contain user transactions`,
    );
  }
  return true;
}

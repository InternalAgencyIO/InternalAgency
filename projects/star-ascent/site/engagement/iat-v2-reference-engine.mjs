import { createHash } from "node:crypto";
import policy from "./iat-economic-policy.v2.json" with { type: "json" };

const BPS = BigInt(policy.rates.denominatorBasisPoints);
const RATE_WEEKS = BigInt(policy.rates.weeksPerRateYear);
export const LANE_ORDER = Object.freeze([...policy.rewardReserve.orderedLanes]);
export const IAT_V2_POLICY = Object.freeze(policy);

function asAmount(value, label) {
  let amount;
  try {
    amount = BigInt(value);
  } catch {
    throw new Error(`${label} must be an integer amount`);
  }
  if (amount < 0n) throw new Error(`${label} cannot be negative`);
  return amount;
}

function asWeek(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative safe integer`);
  return value;
}

function cloneLedger(ledger) {
  return {
    lanes: Object.fromEntries(LANE_ORDER.map((lane) => [lane, { ...ledger.lanes[lane] }])),
  };
}

export function maximumRewardObligation(principal, annualRateBps, termWeeks) {
  const amount = asAmount(principal, "Principal");
  const rate = asAmount(annualRateBps, "Annual rate");
  const weeks = BigInt(asWeek(termWeeks, "Term weeks"));
  return amount * rate * weeks / (BPS * RATE_WEEKS);
}

export function cumulativeRewardDue(principal, annualRateBps, elapsedWeeks) {
  return maximumRewardObligation(principal, annualRateBps, elapsedWeeks);
}

export function rewardForWeek(principal, annualRateBps, weekOrdinal) {
  const week = asWeek(weekOrdinal, "Week ordinal");
  return cumulativeRewardDue(principal, annualRateBps, week + 1)
    - cumulativeRewardDue(principal, annualRateBps, week);
}

export function policyWeekAtTimestamp(genesisTimestamp, nowTimestamp) {
  const genesis = asWeek(genesisTimestamp, "Genesis timestamp");
  const now = asWeek(nowTimestamp, "Current timestamp");
  if (now < genesis) throw new Error("TIMESTAMP_BEFORE_GENESIS");
  return Math.floor((now - genesis) / policy.time.secondsPerWeek);
}

export function cccRoundAtTimestamp(genesisTimestamp, nowTimestamp) {
  const genesis = asWeek(genesisTimestamp, "Genesis timestamp");
  const now = asWeek(nowTimestamp, "Current timestamp");
  const firstSelection = genesis + 86_400;
  if (!Number.isSafeInteger(firstSelection)) throw new Error("TIMESTAMP_OVERFLOW");
  if (now < firstSelection) throw new Error("CCC_SELECTION_NOT_OPEN");
  return Math.floor((now - firstSelection) / policy.time.secondsPerWeek);
}

export function cumulativeUnlocked(lane, currentWeek) {
  const week = asWeek(currentWeek, "Current week");
  const schedule = policy.allocations[lane];
  if (!schedule || !schedule.rewardSource) throw new Error(`${lane} is not a reward lane`);
  const total = BigInt(schedule.baseUnitAmount);
  const genesis = BigInt(schedule.genesisUnlockedBaseUnits);
  if (week < schedule.cliffWeek) return genesis;
  if (week >= schedule.linearEndWeek) return total;
  const elapsed = BigInt(week - schedule.cliffWeek);
  const duration = BigInt(schedule.linearEndWeek - schedule.cliffWeek);
  return genesis + (total - genesis) * elapsed / duration;
}

export function cumulativeCorePrincipalUnlocked(currentWeek) {
  const week = asWeek(currentWeek, "Current week");
  const schedule = policy.allocations.coreTeam;
  const total = BigInt(schedule.baseUnitAmount);
  if (week < schedule.cliffWeek) return 0n;
  if (week >= schedule.linearEndWeek) return total;
  return total * BigInt(week - schedule.cliffWeek)
    / BigInt(schedule.linearEndWeek - schedule.cliffWeek);
}

export function availableLaneCapacity(ledger, lane, currentWeek) {
  const state = ledger.lanes[lane];
  if (!state) throw new Error(`Unknown reward lane ${lane}`);
  const unlocked = cumulativeUnlocked(lane, currentWeek);
  const used = state.reserved + state.paid + state.withdrawn;
  return unlocked > used ? unlocked - used : 0n;
}

export function claimVestedLanePrincipal(ledger, lane, currentWeek) {
  const claimable = availableLaneCapacity(ledger, lane, currentWeek);
  if (claimable === 0n) throw new Error("NOTHING_VESTED_TO_CLAIM");
  const next = cloneLedger(ledger);
  next.lanes[lane].withdrawn += claimable;
  return { ledger: next, lane, amount: claimable };
}

export function reserveOrdered(ledger, requestedAmount, currentWeek) {
  let remaining = asAmount(requestedAmount, "Requested reservation");
  if (remaining === 0n) return { ledger: cloneLedger(ledger), reservation: Object.fromEntries(LANE_ORDER.map((lane) => [lane, 0n])) };
  const next = cloneLedger(ledger);
  const reservation = Object.fromEntries(LANE_ORDER.map((lane) => [lane, 0n]));
  for (const lane of LANE_ORDER) {
    const capacity = availableLaneCapacity(next, lane, currentWeek);
    const take = capacity < remaining ? capacity : remaining;
    next.lanes[lane].reserved += take;
    reservation[lane] = take;
    remaining -= take;
    if (remaining === 0n) break;
  }
  if (remaining !== 0n) {
    const error = new Error("INSUFFICIENT_UNLOCKED_REWARD_CAPACITY");
    error.code = "INSUFFICIENT_UNLOCKED_REWARD_CAPACITY";
    throw error;
  }
  return { ledger: next, reservation };
}

export function payFromReservation(ledger, reservation, requestedAmount) {
  let remaining = asAmount(requestedAmount, "Requested payment");
  const next = cloneLedger(ledger);
  const nextReservation = { ...reservation };
  const paidByLane = Object.fromEntries(LANE_ORDER.map((lane) => [lane, 0n]));
  for (const lane of LANE_ORDER) {
    const reserved = asAmount(nextReservation[lane] ?? 0n, `${lane} reservation`);
    const take = reserved < remaining ? reserved : remaining;
    nextReservation[lane] = reserved - take;
    next.lanes[lane].reserved -= take;
    next.lanes[lane].paid += take;
    paidByLane[lane] = take;
    remaining -= take;
    if (remaining === 0n) break;
  }
  if (remaining !== 0n) throw new Error("PAYMENT_EXCEEDS_RESERVED_OBLIGATION");
  return { ledger: next, reservation: nextReservation, paidByLane };
}

export function releaseReservation(ledger, reservation) {
  const next = cloneLedger(ledger);
  for (const lane of LANE_ORDER) {
    const amount = asAmount(reservation[lane] ?? 0n, `${lane} reservation`);
    if (amount > next.lanes[lane].reserved) throw new Error("RESERVATION_LEDGER_MISMATCH");
    next.lanes[lane].reserved -= amount;
  }
  return next;
}

export function initializeRewardLedger() {
  const ledger = {
    lanes: Object.fromEntries(LANE_ORDER.map((lane) => [lane, {
      total: BigInt(policy.allocations[lane].baseUnitAmount),
      reserved: 0n,
      paid: 0n,
      withdrawn: 0n,
    }])),
  };
  const coreObligation = maximumRewardObligation(
    policy.allocations.coreTeam.baseUnitAmount,
    policy.rates.coreTeam,
    policy.time.coreRewardTermWeeks,
  );
  const reserved = reserveOrdered(ledger, coreObligation, 0);
  return {
    ledger: reserved.ledger,
    coreReward: {
      principal: BigInt(policy.allocations.coreTeam.baseUnitAmount),
      annualRateBps: policy.rates.coreTeam,
      termWeeks: policy.time.coreRewardTermWeeks,
      reservation: reserved.reservation,
      paid: 0n,
      settledWeeks: [],
    },
  };
}

function roleRate(role) {
  const rates = {
    standard: policy.rates.standard,
    cccAgent: policy.rates.cccAgent,
    cccAssociate: policy.rates.cccAssociate,
  };
  if (!(role in rates)) throw new Error(`Unsupported position role ${role}`);
  return rates[role];
}

export function openPosition({
  ledger,
  owner,
  principal,
  role,
  agencyIndex = null,
  acceptedWeek,
  termWeeks = policy.time.userPositionTermWeeks,
}) {
  if (typeof owner !== "string" || owner.length === 0) throw new Error("Position owner is required");
  const amount = asAmount(principal, "Position principal");
  if (amount === 0n) throw new Error("Position principal must be positive");
  const week = asWeek(acceptedWeek, "Accepted week");
  const term = asWeek(termWeeks, "Position term");
  if (term !== policy.time.userPositionTermWeeks) throw new Error("POSITION_TERM_MUST_EQUAL_POLICY_TERM");
  if (role === "standard" && agencyIndex !== null) throw new Error("STANDARD_POSITION_CANNOT_LINK_AGENCY");
  if (role !== "standard" && (!Number.isSafeInteger(agencyIndex) || agencyIndex < 0)) {
    throw new Error("CCC_POSITION_REQUIRES_AGENCY_INDEX");
  }
  const annualRateBps = roleRate(role);
  const maximumObligation = maximumRewardObligation(amount, annualRateBps, term);
  const reserved = reserveOrdered(ledger, maximumObligation, week);
  return {
    ledger: reserved.ledger,
    position: {
      owner,
      principal: amount,
      role,
      agencyIndex,
      acceptedWeek: week,
      firstAccrualWeek: week + 1,
      termWeeks: term,
      annualRateBps,
      maximumObligation,
      reservation: reserved.reservation,
      paid: 0n,
      settledWeeks: [],
      principalReturned: false,
      closed: false,
    },
  };
}

export function settlePositionWeek({ ledger, position, round = null, week = round?.week }) {
  if (position.closed) throw new Error("POSITION_CLOSED");
  const policyWeek = asWeek(week, "Settlement week");
  const ordinal = policyWeek - position.firstAccrualWeek;
  if (ordinal < 0 || ordinal >= position.termWeeks) throw new Error("ROUND_OUTSIDE_POSITION_TERM");
  if (position.settledWeeks.includes(policyWeek)) throw new Error("POSITION_WEEK_ALREADY_SETTLED");
  if (position.role === "standard" && round !== null) throw new Error("STANDARD_ROUND_MUST_BE_OMITTED");
  if (position.role !== "standard" && (!round || round.status !== "SETTLED")) throw new Error("CCC_ROUND_NOT_SETTLED");
  const paused = position.role !== "standard" && position.agencyIndex === round.selectedAgencyIndex;
  const rate = paused ? 0 : position.annualRateBps;
  const amount = rewardForWeek(position.principal, rate, ordinal);
  const payment = payFromReservation(ledger, position.reservation, amount);
  return {
    ledger: payment.ledger,
    position: {
      ...position,
      reservation: payment.reservation,
      paid: position.paid + amount,
      settledWeeks: [...position.settledWeeks, policyWeek],
    },
    settlement: {
      week: policyWeek,
      paused,
      rateBps: rate,
      amount,
      paidByLane: payment.paidByLane,
    },
  };
}

export function withdrawPositionPrincipal({ position, currentWeek }) {
  const week = asWeek(currentWeek, "Current week");
  if (position.closed) throw new Error("POSITION_CLOSED");
  if (position.principalReturned) throw new Error("PRINCIPAL_ALREADY_RETURNED");
  if (week < position.acceptedWeek + position.termWeeks) throw new Error("POSITION_TERM_NOT_COMPLETE");
  return {
    position: { ...position, principalReturned: true },
    principalReturned: position.principal,
  };
}

export function closePosition({ ledger, position, currentWeek }) {
  const week = asWeek(currentWeek, "Current week");
  if (position.closed) throw new Error("POSITION_CLOSED");
  if (week < position.acceptedWeek + position.termWeeks) throw new Error("POSITION_TERM_NOT_COMPLETE");
  if (!position.principalReturned) throw new Error("PRINCIPAL_NOT_RETURNED");
  if (position.settledWeeks.length !== position.termWeeks) throw new Error("POSITION_WEEKS_OUTSTANDING");
  return {
    ledger: releaseReservation(ledger, position.reservation),
    position: { ...position, reservation: Object.fromEntries(LANE_ORDER.map((lane) => [lane, 0n])), closed: true },
  };
}

export function settleCoreRewardWeek({ ledger, coreReward, week }) {
  const ordinal = asWeek(week, "Core reward week");
  if (ordinal >= coreReward.termWeeks) throw new Error("CORE_REWARD_TERM_COMPLETE");
  if (coreReward.settledWeeks.includes(ordinal)) throw new Error("CORE_REWARD_WEEK_ALREADY_SETTLED");
  const amount = rewardForWeek(coreReward.principal, coreReward.annualRateBps, ordinal);
  const payment = payFromReservation(ledger, coreReward.reservation, amount);
  return {
    ledger: payment.ledger,
    coreReward: {
      ...coreReward,
      reservation: payment.reservation,
      paid: coreReward.paid + amount,
      settledWeeks: [...coreReward.settledWeeks, ordinal],
    },
    settlement: { week: ordinal, amount, rateBps: coreReward.annualRateBps, paidByLane: payment.paidByLane },
  };
}

function asBytes32(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error(`${label} must be 32 bytes of hexadecimal`);
  }
  return Buffer.from(value, "hex");
}

export function selectUniformTiebreakOutcome({
  randomnessHex,
  candidateCount,
  decisionContextHex,
}) {
  if (!Number.isSafeInteger(candidateCount) || candidateCount <= 0 || candidateCount > 0xffff_ffff) {
    throw new Error("CANDIDATE_COUNT_MUST_FIT_POSITIVE_U32");
  }
  if (candidateCount === 1) return { index: 0, derivationCounter: 0 };
  const randomness = asBytes32(randomnessHex, "Randomness");
  const context = asBytes32(decisionContextHex, "Decision context");
  const count = BigInt(candidateCount);
  const sampleSpace = 1n << 256n;
  const limit = sampleSpace - (sampleSpace % count);
  for (let counter = 0; counter < 16; counter += 1) {
    const counterBytes = Buffer.alloc(4);
    counterBytes.writeUInt32BE(counter);
    const sample = createHash("sha256")
      .update("IAT_TIEBREAK_V1")
      .update(context)
      .update(randomness)
      .update(counterBytes)
      .digest();
    const value = BigInt(`0x${sample.toString("hex")}`);
    if (value < limit) {
      return {
        index: Number(value % count),
        derivationCounter: counter,
      };
    }
  }
  throw new Error("TIEBREAK_REJECTION_SAMPLING_EXHAUSTED");
}

export function selectUniformTiebreakIndex(input) {
  return selectUniformTiebreakOutcome(input).index;
}

export function selectAgencyIndex(
  randomnessHex,
  agencyCount,
  decisionContextHex = "0".repeat(64),
) {
  if (typeof randomnessHex !== "string" || !/^[0-9a-f]{64}$/i.test(randomnessHex)) {
    throw new Error("RANDOMNESS_MUST_BE_32_BYTES_HEX");
  }
  return selectUniformTiebreakIndex({
    randomnessHex,
    candidateCount: agencyCount,
    decisionContextHex,
  });
}

export function settleCccRound({
  week,
  agencyCountSnapshot,
  randomnessHex,
  decisionContextHex = "0".repeat(64),
  existingRound = null,
}) {
  const roundWeek = asWeek(week, "Round week");
  if (existingRound?.status === "SETTLED") throw new Error("ROUND_ALREADY_SETTLED_NO_REROLL");
  const outcome = selectUniformTiebreakOutcome({
    randomnessHex,
    candidateCount: agencyCountSnapshot,
    decisionContextHex,
  });
  return {
    week: roundWeek,
    status: "SETTLED",
    agencyCountSnapshot,
    randomnessHex: randomnessHex.toLowerCase(),
    decisionContextHex: decisionContextHex.toLowerCase(),
    selectedAgencyIndex: outcome.index,
    derivationCounter: outcome.derivationCounter,
  };
}

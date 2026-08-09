import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  REWARD_LANE_ORDER,
  REWARD_PRIORITY_CLASSES,
  allocateRewardCapacity,
  buildWeeklyFactionManifestObligation,
  createCccPrecommitRegistrySnapshot,
  createCccRevealCommitment,
  sealRewardCapacityRound,
} from "../programs/iat_b3_reference/reward-capacity-waterfall.mjs";
import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";

const CASE_COUNT = 1_024;
const FUNDING_ROUND = 1_786_060_800n;
const LOCAL_0001_UTC = 1_786_050_060n;
const REVEAL_HEX = "9d".repeat(32);
const REVEAL_SOURCE_ID = "property-suite-fixed-reveal";

const schedule = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: LOCAL_0001_UTC - 86_520n,
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-property-testnet-1",
});
const dailyLawState = createDailyLawState({
  protocolHeight: 86_520n,
  schedule,
  currentDecision: createLockdownDecision({
    localDay: protocolLocalDay(LOCAL_0001_UTC),
    randomnessOutputHex: "00".repeat(32),
    schedule,
  }),
});
const revealCommitment = createCccRevealCommitment({
  sourceId: REVEAL_SOURCE_ID,
  committedAtUnixSeconds: FUNDING_ROUND - 1n,
  fundingRoundAtUnixSeconds: FUNDING_ROUND,
  randomnessHex: REVEAL_HEX,
});
const precommitRegistry = createCccPrecommitRegistrySnapshot({
  fundingRoundAtUnixSeconds: FUNDING_ROUND,
  commitments: [revealCommitment],
});
const reveal = Object.freeze({ sourceId: REVEAL_SOURCE_ID, randomnessHex: REVEAL_HEX });

let randomState = 0x6d2b79f5;

function nextU32() {
  randomState ^= randomState << 13;
  randomState ^= randomState >>> 17;
  randomState ^= randomState << 5;
  return randomState >>> 0;
}

function randomInt(exclusiveMaximum) {
  assert.ok(Number.isSafeInteger(exclusiveMaximum) && exclusiveMaximum > 0);
  return nextU32() % exclusiveMaximum;
}

function digest(label) {
  return createHash("sha256").update(label).digest("hex");
}

function chronology(label, sequence) {
  const value = BigInt(sequence);
  return {
    eligibleSequence: value,
    activitySequence: value,
    nodeSequence: value,
    immutableIdentity: label,
    commitmentDigest: digest(`chronology|${label}|${sequence}`),
  };
}

function genericObligation({ caseIndex, label, priorityClass, amount, sequence }) {
  return {
    id: digest(`obligation|${caseIndex}|${label}`),
    priorityClass,
    amount: BigInt(amount),
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    chronology: chronology(`${label}-${caseIndex}`, sequence),
  };
}

function cccObligation({ caseIndex, label, priorityClass, amount, activity, node, eligible }) {
  return {
    id: digest(`obligation|${caseIndex}|${label}`),
    priorityClass,
    amount: BigInt(amount),
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    qualifyingActivityStartSlot: BigInt(activity),
    nodeActivationSlot: BigInt(node),
    eligibleSequence: BigInt(eligible),
    qualificationPda: digest(`qualification|${caseIndex}|${label}`),
  };
}

function factionManifest(caseIndex, amount, sequence) {
  const rewardId = digest(`faction-reward|${caseIndex}`);
  const trancheKinds = ["X_BASE_10"];
  const fragmentId = digest(
    `IAT_B3_X_FUNDING_V1|${rewardId}|${FUNDING_ROUND}|${trancheKinds.join(",")}`,
  );
  return buildWeeklyFactionManifestObligation({
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    factionWeekId: `property-week-${caseIndex}`,
    followerObligations: [{
      id: fragmentId,
      kind: "X_BOUND_FACTION_FRAGMENT",
      rewardId,
      rewardSourceKind: "FACTION_FOLLOWER",
      trancheKinds,
      priorityClass: "WEEKLY_FACTION",
      amount: BigInt(amount),
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
      fundingPool: "SHARED_REWARD_RESERVE",
      reservationStatus: "NEW_UNRESERVED",
      chronology: chronology(`faction-${caseIndex}`, sequence),
    }],
  });
}

function shuffled(values) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const selected = randomInt(index + 1);
    [result[index], result[selected]] = [result[selected], result[index]];
  }
  return result;
}

function buildLedger(caseIndex, totalAmount) {
  let capacity;
  if (caseIndex % 8 === 0) capacity = 0;
  else if (caseIndex % 8 === 1) capacity = totalAmount;
  else if (caseIndex % 8 === 2) capacity = totalAmount + 5;
  else capacity = randomInt(totalAmount + 6);

  let treasuryAvailable;
  let ecosystemAvailable;
  let liquidityAvailable;
  if (caseIndex % 4 === 0) {
    treasuryAvailable = capacity;
    ecosystemAvailable = 0;
    liquidityAvailable = 0;
  } else if (caseIndex % 4 === 1) {
    treasuryAvailable = Math.floor(capacity / 3);
    ecosystemAvailable = capacity - treasuryAvailable;
    liquidityAvailable = 0;
  } else if (caseIndex % 4 === 2) {
    treasuryAvailable = 0;
    ecosystemAvailable = Math.floor(capacity / 2);
    liquidityAvailable = capacity - ecosystemAvailable;
  } else {
    treasuryAvailable = randomInt(capacity + 1);
    ecosystemAvailable = randomInt(capacity - treasuryAvailable + 1);
    liquidityAvailable = capacity - treasuryAvailable - ecosystemAvailable;
  }

  const availableByLane = {
    treasury: BigInt(treasuryAvailable),
    ecosystem: BigInt(ecosystemAvailable),
    liquidity: BigInt(liquidityAvailable),
  };
  const lanes = Object.fromEntries(REWARD_LANE_ORDER.map((lane, laneIndex) => {
    const reserved = BigInt(1 + ((caseIndex + laneIndex) % 3));
    const paid = BigInt(1 + ((caseIndex + laneIndex * 2) % 2));
    const withdrawn = BigInt(1 + ((caseIndex + laneIndex * 3) % 2));
    return [lane, {
      unlocked: reserved + paid + withdrawn + availableByLane[lane],
      reserved,
      paid,
      withdrawn,
    }];
  }));
  return { ledger: { lanes }, availableByLane };
}

function seal(obligations, ledgerSnapshot) {
  return sealRewardCapacityRound({
    dailyLawState,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    sealedAtUnixSeconds: FUNDING_ROUND,
    obligations,
    ledgerSnapshot,
    cccPrecommitRegistrySnapshot: precommitRegistry,
  });
}

function allocate(roundState) {
  return allocateRewardCapacity({
    dailyLawState,
    roundState,
    cccRandomnessReveal: reveal,
  });
}

function outcomeProjection(allocation) {
  return {
    orderedIds: allocation.orderedIds,
    funded: allocation.funded.map(({ id, disposition, plannedByLane, allocatorReceipt }) => ({
      id,
      disposition,
      plannedByLane,
      receiptSha256: allocatorReceipt.receiptSha256,
    })),
    nullOutcomes: allocation.nullOutcomes.map(({ id, disposition, reason, allocatorReceipt }) => ({
      id,
      disposition,
      reason,
      plannedByLane: allocatorReceipt.plannedByLane,
      receiptSha256: allocatorReceipt.receiptSha256,
    })),
    ledger: allocation.ledger,
    receiptDigests: allocation.finalization.receiptDigests,
    outcomeSha256: allocation.finalization.outcomeSha256,
  };
}

test("fixed-seed mixed-class waterfall conformance holds across 1,024 permutations and capacities", () => {
  for (let caseIndex = 0; caseIndex < CASE_COUNT; caseIndex += 1) {
    const earlyActivity = 1 + randomInt(20);
    const tieActivity = earlyActivity + 1;
    const tieNode = 1 + randomInt(20);
    const tieEligible = 1 + randomInt(20);
    const amounts = Array.from({ length: 7 }, () => 1 + randomInt(9));
    const earlyAgent = cccObligation({
      caseIndex,
      label: "agent-early",
      priorityClass: "CCC_AGENT",
      amount: amounts[0],
      activity: earlyActivity,
      node: tieNode + 100,
      eligible: tieEligible + 100,
    });
    const tieAgentA = cccObligation({
      caseIndex,
      label: "agent-tie-a",
      priorityClass: "CCC_AGENT",
      amount: amounts[1],
      activity: tieActivity,
      node: tieNode,
      eligible: tieEligible,
    });
    const tieAgentB = cccObligation({
      caseIndex,
      label: "agent-tie-b",
      priorityClass: "CCC_AGENT",
      amount: amounts[2],
      activity: tieActivity,
      node: tieNode,
      eligible: tieEligible,
    });
    const associate = cccObligation({
      caseIndex,
      label: "associate",
      priorityClass: "CCC_ASSOCIATE",
      amount: amounts[3],
      activity: randomInt(20),
      node: randomInt(20),
      eligible: randomInt(20),
    });
    const standard = genericObligation({
      caseIndex,
      label: "standard",
      priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
      amount: amounts[4],
      sequence: 1 + randomInt(50),
    });
    const faction = factionManifest(caseIndex, amounts[5], 1 + randomInt(50));
    const core = genericObligation({
      caseIndex,
      label: "core",
      priorityClass: "CORE",
      amount: amounts[6],
      sequence: 1 + randomInt(50),
    });
    const candidates = [earlyAgent, tieAgentA, tieAgentB, associate, standard, faction, core];
    const totalAmount = amounts.reduce((total, amount) => total + amount, 0);
    const { ledger, availableByLane } = buildLedger(caseIndex, totalAmount);
    const firstPermutation = shuffled(candidates);
    let secondPermutation = shuffled(candidates);
    if (firstPermutation.every(({ id }, index) => id === secondPermutation[index].id)) {
      secondPermutation = [...secondPermutation.slice(1), secondPermutation[0]];
    }

    const firstSeal = seal(firstPermutation, ledger);
    const secondSeal = seal(secondPermutation, ledger);
    assert.deepEqual(firstSeal, secondSeal, `case ${caseIndex}: permutation changed the canonical seal`);
    const firstAllocation = allocate(firstSeal);
    const secondAllocation = allocate(secondSeal);
    assert.deepEqual(
      outcomeProjection(firstAllocation),
      outcomeProjection(secondAllocation),
      `case ${caseIndex}: permutation changed the deterministic allocation`,
    );

    const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const orderedCandidates = firstAllocation.orderedIds.map((id) => candidateById.get(id));
    const classRanks = orderedCandidates.map(({ priorityClass }) => (
      REWARD_PRIORITY_CLASSES.indexOf(priorityClass)
    ));
    assert.ok(
      classRanks.every((rank, index) => index === 0 || rank >= classRanks[index - 1]),
      `case ${caseIndex}: class priority regressed`,
    );
    assert.equal(firstAllocation.orderedIds[0], earlyAgent.id, `case ${caseIndex}: CCC activity order drifted`);
    assert.deepEqual(
      new Set(firstAllocation.orderedIds.slice(1, 3)),
      new Set([tieAgentA.id, tieAgentB.id]),
      `case ${caseIndex}: exact CCC tie cohort drifted`,
    );
    assert.deepEqual(
      orderedCandidates.map(({ priorityClass }) => priorityClass),
      [
        "CCC_AGENT",
        "CCC_AGENT",
        "CCC_AGENT",
        "CCC_ASSOCIATE",
        "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
        "WEEKLY_FACTION",
        "CORE",
      ],
      `case ${caseIndex}: mixed-class order drifted`,
    );

    const outcomesById = new Map([
      ...firstAllocation.funded,
      ...firstAllocation.nullOutcomes,
    ].map((outcome) => [outcome.id, outcome]));
    const orderedOutcomes = firstAllocation.orderedIds.map((id) => outcomesById.get(id));
    const firstNullIndex = orderedOutcomes.findIndex(({ disposition }) => disposition !== "ADMITTED_RESERVED");
    const fundedPrefixLength = firstNullIndex === -1 ? orderedOutcomes.length : firstNullIndex;
    assert.ok(
      orderedOutcomes.slice(0, fundedPrefixLength)
        .every(({ disposition }) => disposition === "ADMITTED_RESERVED"),
      `case ${caseIndex}: admitted work was not a prefix`,
    );
    if (firstNullIndex !== -1) {
      assert.equal(orderedOutcomes[firstNullIndex].disposition, "NULL_UNDERFUNDED");
      assert.ok(
        orderedOutcomes.slice(firstNullIndex + 1)
          .every(({ disposition }) => disposition === "NULL_BLOCKED"),
        `case ${caseIndex}: null suffix was not blocked`,
      );
    }
    assert.ok(
      orderedOutcomes.filter(({ disposition }) => disposition === "NULL_UNDERFUNDED").length <= 1,
      `case ${caseIndex}: more than one obligation was underfunded`,
    );

    const remainingByLane = { ...availableByLane };
    const plannedByLane = Object.fromEntries(REWARD_LANE_ORDER.map((lane) => [lane, 0n]));
    let expectedBlocked = false;
    let admittedAmount = 0n;
    for (const outcome of orderedOutcomes) {
      const totalRemaining = REWARD_LANE_ORDER.reduce(
        (total, lane) => total + remainingByLane[lane],
        0n,
      );
      if (expectedBlocked || totalRemaining < outcome.amount) {
        const expectedDisposition = expectedBlocked ? "NULL_BLOCKED" : "NULL_UNDERFUNDED";
        assert.equal(outcome.disposition, expectedDisposition, `case ${caseIndex}: null disposition drifted`);
        assert.equal(outcome.allocatorReceipt.plannedByLane, null, `case ${caseIndex}: partial null plan`);
        expectedBlocked = true;
        continue;
      }
      assert.equal(outcome.disposition, "ADMITTED_RESERVED");
      let amountRemaining = outcome.amount;
      const exactPlan = {};
      for (const lane of REWARD_LANE_ORDER) {
        const take = remainingByLane[lane] < amountRemaining ? remainingByLane[lane] : amountRemaining;
        exactPlan[lane] = take;
        remainingByLane[lane] -= take;
        plannedByLane[lane] += take;
        amountRemaining -= take;
      }
      assert.equal(amountRemaining, 0n, `case ${caseIndex}: admitted obligation was partial`);
      assert.deepEqual(outcome.plannedByLane, exactPlan, `case ${caseIndex}: T->E->L plan drifted`);
      assert.deepEqual(outcome.allocatorReceipt.plannedByLane, exactPlan);
      assert.equal(
        REWARD_LANE_ORDER.reduce((total, lane) => total + exactPlan[lane], 0n),
        outcome.amount,
      );
      admittedAmount += outcome.amount;
    }

    for (const lane of REWARD_LANE_ORDER) {
      const before = ledger.lanes[lane];
      const after = firstAllocation.ledger.lanes[lane];
      assert.equal(after.unlocked, before.unlocked, `case ${caseIndex}: ${lane} unlocked changed`);
      assert.equal(after.paid, before.paid, `case ${caseIndex}: ${lane} paid changed`);
      assert.equal(after.withdrawn, before.withdrawn, `case ${caseIndex}: ${lane} withdrawn changed`);
      assert.equal(
        after.reserved,
        before.reserved + plannedByLane[lane],
        `case ${caseIndex}: ${lane} reservation conservation drifted`,
      );
    }
    assert.equal(
      REWARD_LANE_ORDER.reduce((total, lane) => total + plannedByLane[lane], 0n),
      admittedAmount,
      `case ${caseIndex}: aggregate reservation conservation drifted`,
    );
  }
});

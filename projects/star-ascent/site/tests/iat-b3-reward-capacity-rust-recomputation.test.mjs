import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  encodeAllocatorBatchFromFinalizedRound,
  encodeAllocatorReceiptFromOutcome,
} from "../programs/iat_b3_reference/reward-allocator-receipt-codec.mjs";
import {
  allocateRewardCapacity,
  buildWeeklyFactionManifestObligation,
  createCccPrecommitRegistrySnapshot,
  createCccRevealCommitment,
  sealRewardCapacityRound,
  validateFinalizedRewardCapacityRound,
} from "../programs/iat_b3_reference/reward-capacity-waterfall.mjs";
import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXTURE_PATH = fileURLToPath(new URL(
  "./fixtures/iat-b3-reward-capacity-recomputation-v1.txt",
  import.meta.url,
));
const FUNDING_ROUND = 1_786_060_800n;
const LOCAL_0001_UTC = 1_786_050_060n;
const RANDOMNESS = "42".repeat(32);
const SOURCE_ID = "ccc-test-source";
const ESCAPED_SOURCE_ID = "ccc/\"quoted\"\\path\b\f\n\r\t\u0001\u001e|é|雪|🚀|\u2028|end";
const WEEKLY_FACTION_WEEK_ID = "week/\"quoted\"\\path\b\f\n\r\t\u0001|é|雪|🚀|\u2028|\u2029|end";
const WEEKLY_FACTION_FOLLOWER_IDENTITY =
  "follower/\"quoted\"\\path\b\f\n\r\t\u0001|é|雪|🚀|\u2028|\u2029|end";
const X_BOUND_SOURCE_PRIORITY = Object.freeze({
  GENESIS_AIRDROP: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
  X_INTERACTION: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
  STANDARD_POSITION: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
  CCC_AGENT: "CCC_AGENT",
  CCC_ASSOCIATE: "CCC_ASSOCIATE",
});
const X_BOUND_TRANCHES = Object.freeze([
  "X_BASE_10",
  "X_PREMIUM_FULL_100",
  "X_PREMIUM_UPGRADE_90",
]);
const UPDATE = process.env.IAT_B3_PRINT_REWARD_RECOMPUTATION_FIXTURE === "1";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const hex = (value) => BigInt(value).toString(16).padStart(64, "0");

const schedule = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: LOCAL_0001_UTC - 86_520n,
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-testnet-1",
});
const law = createDailyLawState({
  protocolHeight: 86_520n,
  schedule,
  currentDecision: createLockdownDecision({
    localDay: protocolLocalDay(LOCAL_0001_UTC),
    randomnessOutputHex: "00".repeat(32),
    schedule,
  }),
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value)
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((key) => [key, canonicalize(value[key])]));
}

function canonicalBytes(value) {
  return Buffer.from(JSON.stringify(canonicalize(value), (_key, entry) => (
    typeof entry === "bigint" ? entry.toString() : entry
  )), "utf8");
}

function generic(id, priorityClass, amount, sequence) {
  const common = {
    id: hex(id),
    priorityClass,
    amount: BigInt(amount),
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
  };
  if (priorityClass === "CCC_AGENT" || priorityClass === "CCC_ASSOCIATE") {
    return {
      ...common,
      qualifyingActivityStartSlot: 10n + BigInt(priorityClass === "CCC_ASSOCIATE"),
      nodeActivationSlot: 20n,
      eligibleSequence: 30n,
      qualificationPda: hex(id + 1000),
    };
  }
  return {
    ...common,
    chronology: {
      eligibleSequence: BigInt(sequence),
      activitySequence: BigInt(sequence),
      nodeSequence: BigInt(sequence),
      immutableIdentity: `identity-${sequence}`,
      commitmentDigest: hex(10_000 + sequence),
    },
  };
}

function xBound(rewardIdNumber, trancheKind, sequence) {
  const rewardId = hex(rewardIdNumber);
  const id = sha256(`IAT_B3_X_FUNDING_V1|${rewardId}|${FUNDING_ROUND}|${trancheKind}`);
  return {
    id,
    kind: "X_BOUND_FUNDING",
    rewardId,
    rewardSourceKind: "X_INTERACTION",
    trancheKinds: [trancheKind],
    priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
    amount: 100n,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    ...(trancheKind === "X_PREMIUM_UPGRADE_90" ? {
      originalBaseAdmissionLineage: {
        schema: "iat-b3-x-base-admission-lineage/v1",
        status: "NON_ACTIVATING_UNAUTHENTICATED_REFERENCE_LINEAGE",
        rewardId,
        fundingRoundAtUnixSeconds: FUNDING_ROUND - 86_400n,
        allocationIndex: 0,
        referenceReceiptSha256: hex(90_001),
        referenceFinalizationSha256: hex(90_002),
        batchCommitmentSha256: hex(90_003),
        binaryReceiptSha256: hex(90_004),
        authenticated: false,
      },
    } : {}),
    chronology: {
      eligibleSequence: BigInt(sequence),
      activitySequence: BigInt(sequence),
      nodeSequence: BigInt(sequence),
      immutableIdentity: `x-identity-${sequence}`,
      commitmentDigest: rewardId,
    },
  };
}

function matrixXBound(rewardIdNumber, rewardSourceKind, trancheKind, sequence) {
  const rewardId = hex(rewardIdNumber);
  const priorityClass = X_BOUND_SOURCE_PRIORITY[rewardSourceKind];
  const id = sha256(`IAT_B3_X_FUNDING_V1|${rewardId}|${FUNDING_ROUND}|${trancheKind}`);
  const common = {
    id,
    kind: "X_BOUND_FUNDING",
    rewardId,
    rewardSourceKind,
    trancheKinds: [trancheKind],
    priorityClass,
    amount: 100n,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    ...(trancheKind === "X_PREMIUM_UPGRADE_90" ? {
      originalBaseAdmissionLineage: {
        schema: "iat-b3-x-base-admission-lineage/v1",
        status: "NON_ACTIVATING_UNAUTHENTICATED_REFERENCE_LINEAGE",
        rewardId,
        fundingRoundAtUnixSeconds: FUNDING_ROUND - 86_400n,
        allocationIndex: sequence,
        referenceReceiptSha256: hex(200_000 + sequence),
        referenceFinalizationSha256: hex(300_000 + sequence),
        batchCommitmentSha256: hex(400_000 + sequence),
        binaryReceiptSha256: hex(500_000 + sequence),
        authenticated: false,
      },
    } : {}),
  };
  if (priorityClass === "CCC_AGENT" || priorityClass === "CCC_ASSOCIATE") {
    return {
      ...common,
      qualifyingActivityStartSlot: 100n + BigInt(priorityClass === "CCC_ASSOCIATE"),
      nodeActivationSlot: 200n,
      eligibleSequence: 300n,
      qualificationPda: hex(600_000 + sequence),
    };
  }
  return {
    ...common,
    chronology: {
      eligibleSequence: BigInt(sequence),
      activitySequence: BigInt(sequence),
      nodeSequence: BigInt(sequence),
      immutableIdentity: `matrix-${sequence}`,
      commitmentDigest: rewardId,
    },
  };
}

function factionFragment({
  rewardNumber,
  trancheKind,
  sequence,
  identity,
  amount,
  eligibleSequence = sequence,
  activitySequence = sequence,
  nodeSequence = sequence,
  commitmentNumber = rewardNumber,
}) {
  const rewardId = hex(rewardNumber);
  const trancheKinds = [trancheKind];
  return {
    id: sha256(`IAT_B3_X_FUNDING_V1|${rewardId}|${FUNDING_ROUND}|${trancheKind}`),
    kind: "X_BOUND_FACTION_FRAGMENT",
    rewardId,
    rewardSourceKind: "FACTION_FOLLOWER",
    trancheKinds,
    priorityClass: "WEEKLY_FACTION",
    amount: BigInt(amount),
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    chronology: {
      eligibleSequence: BigInt(eligibleSequence),
      activitySequence: BigInt(activitySequence),
      nodeSequence: BigInt(nodeSequence),
      immutableIdentity: identity,
      commitmentDigest: hex(commitmentNumber),
    },
    ...(trancheKind === "X_PREMIUM_UPGRADE_90" ? {
      originalBaseAdmissionLineage: {
        schema: "iat-b3-x-base-admission-lineage/v1",
        status: "NON_ACTIVATING_UNAUTHENTICATED_REFERENCE_LINEAGE",
        rewardId,
        fundingRoundAtUnixSeconds: FUNDING_ROUND - 86_400n,
        allocationIndex: sequence,
        referenceReceiptSha256: hex(810_000 + sequence),
        referenceFinalizationSha256: hex(820_000 + sequence),
        batchCommitmentSha256: hex(830_000 + sequence),
        binaryReceiptSha256: hex(840_000 + sequence),
        authenticated: false,
      },
    } : {}),
  };
}

function factionManifest({
  rewardNumber = 80_001,
  weekId = "week-1",
  sequence = 80,
  identity = "faction-follower-1",
} = {}) {
  const fragment = factionFragment({
    rewardNumber,
    trancheKind: "X_BASE_10",
    sequence,
    identity,
    amount: 100,
  });
  return buildWeeklyFactionManifestObligation({
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    factionWeekId: weekId,
    followerObligations: [fragment],
  });
}

function multiEntryFactionManifest() {
  return buildWeeklyFactionManifestObligation({
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    factionWeekId: WEEKLY_FACTION_WEEK_ID,
    followerObligations: [
      factionFragment({
        rewardNumber: 91_001,
        trancheKind: "X_BASE_10",
        sequence: 91,
        identity: "follower-base",
        amount: 100,
        eligibleSequence: 5,
        activitySequence: 9,
        nodeSequence: 10,
        commitmentNumber: 990_001,
      }),
      factionFragment({
        rewardNumber: 91_002,
        trancheKind: "X_PREMIUM_FULL_100",
        sequence: 92,
        identity: "follower-full",
        amount: 200,
        eligibleSequence: 5,
        activitySequence: 9,
        nodeSequence: 10,
        commitmentNumber: 990_001,
      }),
      factionFragment({
        rewardNumber: 91_003,
        trancheKind: "X_PREMIUM_UPGRADE_90",
        sequence: 93,
        identity: WEEKLY_FACTION_FOLLOWER_IDENTITY,
        amount: 300,
        eligibleSequence: 5,
        activitySequence: 9,
        nodeSequence: 10,
        commitmentNumber: 990_001,
      }),
    ],
  });
}

function referenceCoreBytes(receipt) {
  return canonicalBytes(Object.fromEntries(Object.entries(receipt)
    .filter(([key]) => key !== "receiptSha256")));
}

function finalizedVectors({ sourceId, obligations, ledgerSnapshot }) {
  const revealCommitment = createCccRevealCommitment({
    sourceId,
    committedAtUnixSeconds: FUNDING_ROUND - 10n,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    randomnessHex: RANDOMNESS,
  });
  const pending = sealRewardCapacityRound({
    dailyLawState: law,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    sealedAtUnixSeconds: FUNDING_ROUND,
    obligations,
    ledgerSnapshot,
    cccPrecommitRegistrySnapshot: createCccPrecommitRegistrySnapshot({
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
      commitments: [revealCommitment],
    }),
  });
  const allocation = allocateRewardCapacity({
    dailyLawState: law,
    roundState: pending,
    cccRandomnessReveal: { sourceId, randomnessHex: RANDOMNESS },
  });
  const outcomes = [...allocation.funded, ...allocation.nullOutcomes]
    .sort((left, right) => allocation.orderedIds.indexOf(left.id) - allocation.orderedIds.indexOf(right.id));
  return Object.freeze({
    roundState: allocation.roundState,
    sealBytes: canonicalBytes(allocation.roundState.roundSeal),
    batchBytes: encodeAllocatorBatchFromFinalizedRound(allocation.roundState),
    receiptBytes: outcomes.map((outcome, allocationIndex) => encodeAllocatorReceiptFromOutcome({
      roundState: allocation.roundState,
      outcome,
      allocationIndex,
    })),
    referenceCores: outcomes.map(({ allocatorReceipt }) => referenceCoreBytes(allocatorReceipt)),
    orderedIds: allocation.orderedIds,
    dispositions: outcomes.map(({ allocatorReceipt }) => allocatorReceipt.disposition),
  });
}

function canonicalVectors() {
  return finalizedVectors({
    sourceId: SOURCE_ID,
    obligations: [
      generic(1, "CCC_AGENT", 100, 1),
      generic(2, "CCC_AGENT", 100, 1),
      generic(3, "CCC_ASSOCIATE", 100, 2),
      generic(4, "STANDARD_10_PERCENT_AND_X_CAMPAIGN", 100, 40),
      xBound(50_001, "X_BASE_10", 50),
      xBound(50_002, "X_PREMIUM_FULL_100", 60),
      xBound(50_003, "X_PREMIUM_UPGRADE_90", 70),
      factionManifest(),
      generic(9, "CORE", 100, 90),
    ],
    ledgerSnapshot: {
      lanes: {
        treasury: { unlocked: 150n, reserved: 0n, paid: 0n, withdrawn: 0n },
        ecosystem: { unlocked: 250n, reserved: 0n, paid: 0n, withdrawn: 0n },
        liquidity: { unlocked: 250n, reserved: 0n, paid: 0n, withdrawn: 0n },
      },
    },
  });
}

function escapedSourceVectors() {
  return finalizedVectors({
    sourceId: ESCAPED_SOURCE_ID,
    obligations: [
      generic(101, "CCC_AGENT", 100, 1),
      generic(102, "CCC_AGENT", 100, 1),
    ],
    ledgerSnapshot: {
      lanes: {
        treasury: { unlocked: 200n, reserved: 0n, paid: 0n, withdrawn: 0n },
        ecosystem: { unlocked: 0n, reserved: 0n, paid: 0n, withdrawn: 0n },
        liquidity: { unlocked: 0n, reserved: 0n, paid: 0n, withdrawn: 0n },
      },
    },
  });
}

function xBoundMatrixVectors() {
  let sequence = 1;
  const obligations = Object.keys(X_BOUND_SOURCE_PRIORITY).flatMap((rewardSourceKind) => (
    X_BOUND_TRANCHES.map((trancheKind) => {
      const candidate = matrixXBound(100_000 + sequence, rewardSourceKind, trancheKind, sequence);
      sequence += 1;
      return candidate;
    })
  ));
  return finalizedVectors({
    sourceId: SOURCE_ID,
    obligations,
    ledgerSnapshot: {
      lanes: {
        treasury: { unlocked: 1_500n, reserved: 0n, paid: 0n, withdrawn: 0n },
        ecosystem: { unlocked: 0n, reserved: 0n, paid: 0n, withdrawn: 0n },
        liquidity: { unlocked: 0n, reserved: 0n, paid: 0n, withdrawn: 0n },
      },
    },
  });
}

function weeklyFactionVectors() {
  return finalizedVectors({
    sourceId: SOURCE_ID,
    obligations: [
      generic(301, "CCC_AGENT", 100, 1),
      generic(302, "CCC_AGENT", 100, 1),
      multiEntryFactionManifest(),
    ],
    ledgerSnapshot: {
      lanes: {
        treasury: { unlocked: 800n, reserved: 0n, paid: 0n, withdrawn: 0n },
        ecosystem: { unlocked: 0n, reserved: 0n, paid: 0n, withdrawn: 0n },
        liquidity: { unlocked: 0n, reserved: 0n, paid: 0n, withdrawn: 0n },
      },
    },
  });
}

function bindHostileSeal(canonical, mutate) {
  const roundSeal = structuredClone(canonical.roundState.roundSeal);
  mutate(roundSeal);
  roundSeal.candidateSetSha256 = sha256(canonicalBytes(roundSeal.candidates));
  const sealBytes = canonicalBytes(roundSeal);
  const batchBytes = Buffer.from(canonical.batchBytes);
  createHash("sha256").update(sealBytes).digest().copy(batchBytes, 88);
  Buffer.from(roundSeal.candidateSetSha256, "hex").copy(batchBytes, 120);
  return Object.freeze({
    roundState: Object.freeze({ ...canonical.roundState, roundSeal }),
    sealBytes,
    batchBytes,
  });
}

function hostileUniquenessVectors(canonical) {
  return Object.freeze({
    duplicateCandidateId: bindHostileSeal(canonical, (roundSeal) => {
      roundSeal.candidates[1].id = roundSeal.candidates[0].id;
      roundSeal.candidateIds[1] = roundSeal.candidateIds[0];
    }),
    duplicateCccQualificationPda: bindHostileSeal(canonical, (roundSeal) => {
      roundSeal.candidates[1].qualificationPda = roundSeal.candidates[0].qualificationPda;
    }),
    multipleWeeklyFactionManifests: bindHostileSeal(canonical, (roundSeal) => {
      const replacement = factionManifest({
        rewardNumber: 81_001,
        weekId: "week-2",
        sequence: 81,
        identity: "faction-follower-2",
      });
      const index = roundSeal.candidates.length - 1;
      roundSeal.candidates[index] = replacement;
      roundSeal.candidateIds[index] = replacement.id;
    }),
  });
}

function findXBoundCandidate(roundSeal, rewardSourceKind, trancheKind) {
  const candidate = roundSeal.candidates.find((entry) => (
    entry.kind === "X_BOUND_FUNDING"
      && entry.rewardSourceKind === rewardSourceKind
      && entry.trancheKinds[0] === trancheKind
  ));
  assert.ok(candidate, `${rewardSourceKind}/${trancheKind} candidate`);
  return candidate;
}

function findWeeklyFactionCandidate(roundSeal) {
  const candidate = roundSeal.candidates.find((entry) => (
    entry.kind === "WEEKLY_FACTION_MANIFEST"
  ));
  assert.ok(candidate, "weekly faction manifest candidate");
  return candidate;
}

function hostileXBoundVectors(canonical) {
  return Object.freeze({
    rewardIdDerivedMismatch: bindHostileSeal(canonical, (roundSeal) => {
      findXBoundCandidate(roundSeal, "X_INTERACTION", "X_BASE_10").rewardId = hex(900_001);
    }),
    idDerivedMismatch: bindHostileSeal(canonical, (roundSeal) => {
      const candidate = findXBoundCandidate(roundSeal, "X_INTERACTION", "X_BASE_10");
      const index = roundSeal.candidates.indexOf(candidate);
      candidate.id = hex(900_002);
      roundSeal.candidateIds[index] = candidate.id;
    }),
    wrongSourcePriority: bindHostileSeal(canonical, (roundSeal) => {
      findXBoundCandidate(roundSeal, "X_INTERACTION", "X_BASE_10").rewardSourceKind = "CCC_AGENT";
    }),
    factionFollowerDirect: bindHostileSeal(canonical, (roundSeal) => {
      const candidate = findXBoundCandidate(roundSeal, "X_INTERACTION", "X_BASE_10");
      candidate.rewardSourceKind = "FACTION_FOLLOWER";
      candidate.priorityClass = "WEEKLY_FACTION";
    }),
    coreDirect: bindHostileSeal(canonical, (roundSeal) => {
      findXBoundCandidate(roundSeal, "X_INTERACTION", "X_BASE_10").rewardSourceKind = "CORE";
    }),
    emptyTranche: bindHostileSeal(canonical, (roundSeal) => {
      findXBoundCandidate(roundSeal, "X_INTERACTION", "X_BASE_10").trancheKinds = [];
    }),
    multipleTranches: bindHostileSeal(canonical, (roundSeal) => {
      findXBoundCandidate(roundSeal, "X_INTERACTION", "X_BASE_10").trancheKinds = [
        "X_BASE_10", "X_PREMIUM_FULL_100",
      ];
    }),
    unknownTranche: bindHostileSeal(canonical, (roundSeal) => {
      findXBoundCandidate(roundSeal, "X_INTERACTION", "X_BASE_10").trancheKinds = ["UNKNOWN"];
    }),
    missingRewardId: bindHostileSeal(canonical, (roundSeal) => {
      delete findXBoundCandidate(roundSeal, "X_INTERACTION", "X_BASE_10").rewardId;
    }),
    missingUpgradeLineage: bindHostileSeal(canonical, (roundSeal) => {
      delete findXBoundCandidate(
        roundSeal, "X_INTERACTION", "X_PREMIUM_UPGRADE_90",
      ).originalBaseAdmissionLineage;
    }),
    extraBaseLineage: bindHostileSeal(canonical, (roundSeal) => {
      const base = findXBoundCandidate(roundSeal, "X_INTERACTION", "X_BASE_10");
      base.originalBaseAdmissionLineage = structuredClone(findXBoundCandidate(
        roundSeal, "X_INTERACTION", "X_PREMIUM_UPGRADE_90",
      ).originalBaseAdmissionLineage);
    }),
    genericFieldSmuggling: bindHostileSeal(canonical, (roundSeal) => {
      delete findXBoundCandidate(roundSeal, "X_INTERACTION", "X_BASE_10").kind;
    }),
    chronologyOnCcc: bindHostileSeal(canonical, (roundSeal) => {
      const candidate = findXBoundCandidate(roundSeal, "X_INTERACTION", "X_BASE_10");
      candidate.rewardSourceKind = "CCC_AGENT";
      candidate.priorityClass = "CCC_AGENT";
    }),
    cccOrderingOnStandard: bindHostileSeal(canonical, (roundSeal) => {
      const candidate = findXBoundCandidate(roundSeal, "CCC_AGENT", "X_BASE_10");
      candidate.rewardSourceKind = "X_INTERACTION";
      candidate.priorityClass = "STANDARD_10_PERCENT_AND_X_CAMPAIGN";
    }),
  });
}

function refreshWeeklyManifestBindings(roundSeal, candidate) {
  const payoutDigest = sha256(canonicalBytes(candidate.payoutEntries));
  candidate.payoutDigest = payoutDigest;
  candidate.chronology.commitmentDigest = payoutDigest;
  const index = roundSeal.candidates.indexOf(candidate);
  candidate.id = sha256(
    `IAT_B3_WEEKLY_FACTION_MANIFEST_V1|${FUNDING_ROUND}|${candidate.factionWeekId}|${payoutDigest}`,
  );
  roundSeal.candidateIds[index] = candidate.id;
}

function hostileWeeklyFactionVectors(canonical) {
  const vectors = {
    payoutRawMutation: bindHostileSeal(canonical, (roundSeal) => {
      findWeeklyFactionCandidate(roundSeal).payoutEntries[0].chronology.commitmentDigest = hex(999_001);
    }),
    emptyPayoutEntries: bindHostileSeal(canonical, (roundSeal) => {
      const candidate = findWeeklyFactionCandidate(roundSeal);
      candidate.payoutEntries = [];
      candidate.followerCount = 0;
      candidate.chronology = {
        eligibleSequence: 0n,
        activitySequence: 0n,
        nodeSequence: 0n,
        immutableIdentity: `FACTION_WEEK|${candidate.factionWeekId}`,
        commitmentDigest: hex(0),
      };
      refreshWeeklyManifestBindings(roundSeal, candidate);
    }),
    zeroEntryAmount: bindHostileSeal(canonical, (roundSeal) => {
      const candidate = findWeeklyFactionCandidate(roundSeal);
      candidate.payoutEntries[0].amount = 0n;
      refreshWeeklyManifestBindings(roundSeal, candidate);
    }),
    entryAmountSumOverflow: bindHostileSeal(canonical, (roundSeal) => {
      const candidate = findWeeklyFactionCandidate(roundSeal);
      candidate.payoutEntries[0].amount = (1n << 64n) - 1n;
      candidate.payoutEntries[1].amount = 1n;
      refreshWeeklyManifestBindings(roundSeal, candidate);
    }),
    declaredAmountMismatch: bindHostileSeal(canonical, (roundSeal) => {
      findWeeklyFactionCandidate(roundSeal).amount = 601n;
    }),
    followerCountMismatch: bindHostileSeal(canonical, (roundSeal) => {
      findWeeklyFactionCandidate(roundSeal).followerCount = 4;
    }),
    eligibleMaximumMismatch: bindHostileSeal(canonical, (roundSeal) => {
      findWeeklyFactionCandidate(roundSeal).chronology.eligibleSequence = 6n;
    }),
    activityMaximumMismatch: bindHostileSeal(canonical, (roundSeal) => {
      findWeeklyFactionCandidate(roundSeal).chronology.activitySequence = 10n;
    }),
    nodeMaximumMismatch: bindHostileSeal(canonical, (roundSeal) => {
      findWeeklyFactionCandidate(roundSeal).chronology.nodeSequence = 11n;
    }),
    identityMismatch: bindHostileSeal(canonical, (roundSeal) => {
      findWeeklyFactionCandidate(roundSeal).chronology.immutableIdentity = "FACTION_WEEK|wrong";
    }),
    commitmentMismatch: bindHostileSeal(canonical, (roundSeal) => {
      findWeeklyFactionCandidate(roundSeal).chronology.commitmentDigest = hex(999_002);
    }),
    identifierMismatch: bindHostileSeal(canonical, (roundSeal) => {
      const candidate = findWeeklyFactionCandidate(roundSeal);
      const index = roundSeal.candidates.indexOf(candidate);
      candidate.id = hex(999_003);
      roundSeal.candidateIds[index] = candidate.id;
    }),
    weekIdIdentifierMismatch: bindHostileSeal(canonical, (roundSeal) => {
      const candidate = findWeeklyFactionCandidate(roundSeal);
      candidate.factionWeekId = "week-other";
      candidate.chronology.immutableIdentity = "FACTION_WEEK|week-other";
    }),
  };
  const boundaryTrimScalars = [
    ["tab", "\u0009"], ["lineFeed", "\u000a"], ["verticalTab", "\u000b"],
    ["formFeed", "\u000c"], ["carriageReturn", "\u000d"], ["space", "\u0020"],
    ["nbsp", "\u00a0"], ["ogham", "\u1680"], ["enQuad", "\u2000"],
    ["emQuad", "\u2001"], ["enSpace", "\u2002"], ["emSpace", "\u2003"],
    ["threePerEm", "\u2004"], ["fourPerEm", "\u2005"], ["sixPerEm", "\u2006"],
    ["figureSpace", "\u2007"], ["punctuationSpace", "\u2008"], ["thinSpace", "\u2009"],
    ["hairSpace", "\u200a"], ["lineSeparator", "\u2028"],
    ["paragraphSeparator", "\u2029"], ["narrowNbsp", "\u202f"],
    ["mediumMathematicalSpace", "\u205f"], ["ideographicSpace", "\u3000"],
    ["bom", "\ufeff"],
  ];
  for (const [name, scalar] of boundaryTrimScalars) {
    vectors[`leadingTrim${name}`] = bindHostileSeal(canonical, (roundSeal) => {
      findWeeklyFactionCandidate(roundSeal).factionWeekId = `${scalar}${WEEKLY_FACTION_WEEK_ID}`;
    });
    vectors[`trailingTrim${name}`] = bindHostileSeal(canonical, (roundSeal) => {
      findWeeklyFactionCandidate(roundSeal).factionWeekId = `${WEEKLY_FACTION_WEEK_ID}${scalar}`;
    });
  }
  return Object.freeze(vectors);
}

function hostileWeeklyPayoutEntryVectors(canonical) {
  const canonicalEntries = findWeeklyFactionCandidate(canonical.roundState.roundSeal).payoutEntries;
  const entryIndexFor = (tranche) => {
    const index = canonicalEntries.findIndex((entry) => entry.trancheKinds[0] === tranche);
    assert.ok(index >= 0, `weekly payout entry ${tranche}`);
    return index;
  };
  const mutateEntry = (mutate, index = 1) => bindHostileSeal(canonical, (roundSeal) => {
    const candidate = findWeeklyFactionCandidate(roundSeal);
    mutate(candidate.payoutEntries[index], candidate);
    refreshWeeklyManifestBindings(roundSeal, candidate);
  });
  return Object.freeze({
    middleMissingAmount: mutateEntry((entry) => { delete entry.amount; }),
    middleMissingChronology: mutateEntry((entry) => { delete entry.chronology; }),
    middleMissingFragmentId: mutateEntry((entry) => { delete entry.fragmentId; }),
    middleMissingRewardId: mutateEntry((entry) => { delete entry.rewardId; }),
    middleMissingTrancheKinds: mutateEntry((entry) => { delete entry.trancheKinds; }),
    middleExtraField: mutateEntry((entry) => { entry.unexpected = false; }),
    middleEmptyTranche: mutateEntry((entry) => { entry.trancheKinds = []; }),
    middleMultipleTranches: mutateEntry((entry) => {
      entry.trancheKinds = ["X_PREMIUM_FULL_100", "X_BASE_10"];
    }),
    middleUnknownTranche: mutateEntry((entry) => { entry.trancheKinds = ["X_UNKNOWN"]; }),
    middleFragmentIdMismatch: mutateEntry((entry) => { entry.fragmentId = hex(991_001); }),
    middleRewardIdDerivedMismatch: mutateEntry((entry) => { entry.rewardId = hex(991_002); }),
    middleUppercaseFragmentId: mutateEntry((entry) => {
      entry.fragmentId = entry.fragmentId.toUpperCase();
    }),
    middleUppercaseRewardId: mutateEntry((entry) => {
      entry.rewardId = entry.rewardId.toUpperCase();
    }),
    baseExtraLineage: mutateEntry((entry) => {
      entry.originalBaseAdmissionLineage = structuredClone(
        canonicalEntries[entryIndexFor("X_PREMIUM_UPGRADE_90")].originalBaseAdmissionLineage,
      );
    }, entryIndexFor("X_BASE_10")),
    upgradeMissingLineage: mutateEntry((entry) => {
      delete entry.originalBaseAdmissionLineage;
    }, entryIndexFor("X_PREMIUM_UPGRADE_90")),
    upgradeNullLineageContents: mutateEntry((entry) => {
      entry.originalBaseAdmissionLineage = null;
    }, entryIndexFor("X_PREMIUM_UPGRADE_90")),
    upgradeOpaqueLineageContents: mutateEntry((entry) => {
      entry.originalBaseAdmissionLineage = { opaque: "externally-prevalidated-only" };
    }, entryIndexFor("X_PREMIUM_UPGRADE_90")),
    chronologyMissingActivity: mutateEntry((entry) => {
      delete entry.chronology.activitySequence;
    }),
    chronologyMissingCommitment: mutateEntry((entry) => {
      delete entry.chronology.commitmentDigest;
    }),
    chronologyMissingEligible: mutateEntry((entry) => {
      delete entry.chronology.eligibleSequence;
    }),
    chronologyMissingIdentity: mutateEntry((entry) => {
      delete entry.chronology.immutableIdentity;
    }),
    chronologyMissingNode: mutateEntry((entry) => {
      delete entry.chronology.nodeSequence;
    }),
    chronologyExtraField: mutateEntry((entry) => { entry.chronology.unexpected = "0"; }),
    chronologyActivityWrongStoredType: mutateEntry((entry) => {
      entry.chronology.activitySequence = 9;
    }),
    chronologyCommitmentNotHex32: mutateEntry((entry) => {
      entry.chronology.commitmentDigest = "not-a-canonical-digest";
    }),
    chronologyIdentityEmpty: mutateEntry((entry) => { entry.chronology.immutableIdentity = ""; }),
    chronologyIdentityLeadingTrim: mutateEntry((entry) => {
      entry.chronology.immutableIdentity = `\u00a0${WEEKLY_FACTION_FOLLOWER_IDENTITY}`;
    }),
    chronologyIdentityTrailingTrim: mutateEntry((entry) => {
      entry.chronology.immutableIdentity = `${WEEKLY_FACTION_FOLLOWER_IDENTITY}\t`;
    }),
  });
}

function hostileWeeklyPayoutUniquenessVectors(canonical) {
  const rebind = (mutate) => bindHostileSeal(canonical, (roundSeal) => {
    const candidate = findWeeklyFactionCandidate(roundSeal);
    assert.equal(candidate.payoutEntries.length, 3, "three-entry uniqueness fixture");
    mutate(candidate.payoutEntries);
    refreshWeeklyManifestBindings(roundSeal, candidate);
  });
  const deriveFragment = (entry) => sha256(
    `IAT_B3_X_FUNDING_V1|${entry.rewardId}|${FUNDING_ROUND}|${entry.trancheKinds[0]}`,
  );
  const copyFragmentSemantics = (target, source) => {
    target.rewardId = source.rewardId;
    target.trancheKinds = [...source.trancheKinds];
    target.fragmentId = source.fragmentId;
    if (source.trancheKinds[0] === "X_PREMIUM_UPGRADE_90") {
      target.originalBaseAdmissionLineage = structuredClone(source.originalBaseAdmissionLineage);
    } else {
      delete target.originalBaseAdmissionLineage;
    }
  };
  return Object.freeze({
    duplicateFragmentAdjacentFirstMiddle: rebind((entries) => {
      copyFragmentSemantics(entries[1], entries[0]);
    }),
    duplicateFragmentFirstLast: rebind((entries) => {
      copyFragmentSemantics(entries[2], entries[0]);
    }),
    duplicateRewardAdjacentDistinctFragment: rebind((entries) => {
      entries[1].rewardId = entries[0].rewardId;
      entries[1].originalBaseAdmissionLineage.rewardId = entries[0].rewardId;
      entries[1].fragmentId = deriveFragment(entries[1]);
      assert.notEqual(entries[1].fragmentId, entries[0].fragmentId);
    }),
    duplicateRewardFirstLastDistinctFragment: rebind((entries) => {
      entries[2].rewardId = entries[0].rewardId;
      entries[2].fragmentId = deriveFragment(entries[2]);
      assert.notEqual(entries[2].fragmentId, entries[0].fragmentId);
    }),
    duplicateIdentityAdjacentFirstMiddle: rebind((entries) => {
      entries[1].chronology.immutableIdentity = entries[0].chronology.immutableIdentity;
    }),
    duplicateIdentityFirstLast: rebind((entries) => {
      entries[2].chronology.immutableIdentity = entries[0].chronology.immutableIdentity;
    }),
  });
}

function replaceBufferOnce(bytes, needle, replacement) {
  const offset = bytes.indexOf(needle);
  assert.ok(offset >= 0, `raw marker ${needle.toString("utf8")}`);
  return Buffer.concat([
    bytes.subarray(0, offset),
    replacement,
    bytes.subarray(offset + needle.length),
  ]);
}

function bindRawWeeklyPayout(canonical, mutatePayoutBytes) {
  const roundSeal = structuredClone(canonical.roundState.roundSeal);
  const candidate = findWeeklyFactionCandidate(roundSeal);
  const canonicalPayout = canonicalBytes(candidate.payoutEntries);
  const mutatedPayout = mutatePayoutBytes(Buffer.from(canonicalPayout), candidate);
  const payoutDigest = sha256(mutatedPayout);
  candidate.payoutDigest = payoutDigest;
  candidate.chronology.commitmentDigest = payoutDigest;
  candidate.id = sha256(
    `IAT_B3_WEEKLY_FACTION_MANIFEST_V1|${FUNDING_ROUND}|${candidate.factionWeekId}|${payoutDigest}`,
  );
  const candidateIndex = roundSeal.candidates.indexOf(candidate);
  roundSeal.candidateIds[candidateIndex] = candidate.id;
  roundSeal.candidateSetSha256 = "0".repeat(64);

  let sealBytes = replaceBufferOnce(canonicalBytes(roundSeal), canonicalPayout, mutatedPayout);
  const candidatesMarker = Buffer.from("\"candidates\":", "utf8");
  const candidatesStart = sealBytes.indexOf(candidatesMarker) + candidatesMarker.length;
  assert.ok(candidatesStart >= candidatesMarker.length, "raw candidates marker");
  const candidatesEnd = sealBytes.indexOf(
    Buffer.from(",\"candidateSetSha256\":", "utf8"),
    candidatesStart,
  );
  assert.ok(candidatesEnd > candidatesStart, "raw candidate-set boundary");
  const candidateSetSha256 = sha256(sealBytes.subarray(candidatesStart, candidatesEnd));
  sealBytes = replaceBufferOnce(
    sealBytes,
    Buffer.from(`\"candidateSetSha256\":\"${"0".repeat(64)}\"`, "utf8"),
    Buffer.from(`\"candidateSetSha256\":\"${candidateSetSha256}\"`, "utf8"),
  );
  const batchBytes = Buffer.from(canonical.batchBytes);
  createHash("sha256").update(sealBytes).digest().copy(batchBytes, 88);
  Buffer.from(candidateSetSha256, "hex").copy(batchBytes, 120);
  return Object.freeze({ sealBytes, batchBytes });
}

function rawHostileWeeklyPayoutEntryVectors(canonical) {
  const mutateMiddleEntry = (mutateEntryBytes) => (payoutBytes, candidate) => {
    const middle = canonicalBytes(candidate.payoutEntries[1]);
    return replaceBufferOnce(payoutBytes, middle, mutateEntryBytes(Buffer.from(middle), candidate));
  };
  const mutateIdentity = (mutateQuotedBytes) => mutateMiddleEntry((entryBytes) => {
    const quoted = Buffer.from(JSON.stringify(WEEKLY_FACTION_FOLLOWER_IDENTITY), "utf8");
    return replaceBufferOnce(entryBytes, quoted, mutateQuotedBytes(Buffer.from(quoted)));
  });
  const replaceQuoted = (needle, replacement) => (quoted) => replaceBufferOnce(
    quoted,
    Buffer.from(needle, "utf8"),
    Buffer.from(replacement, "utf8"),
  );
  return Object.freeze({
    escapedFragmentKey: bindRawWeeklyPayout(canonical, mutateMiddleEntry((entryBytes) => (
      replaceBufferOnce(
        entryBytes,
        Buffer.from("\"fragmentId\"", "utf8"),
        Buffer.from("\"fragm\\u0065ntId\"", "utf8"),
      )
    ))),
    wrongRewardTrancheKeyOrder: bindRawWeeklyPayout(canonical, mutateMiddleEntry((entryBytes, candidate) => {
      const entry = candidate.payoutEntries[1];
      const reward = Buffer.from(`\"rewardId\":\"${entry.rewardId}\"`, "utf8");
      const tranche = Buffer.from(`\"trancheKinds\":[\"${entry.trancheKinds[0]}\"]`, "utf8");
      return replaceBufferOnce(
        entryBytes,
        Buffer.concat([reward, Buffer.from(","), tranche]),
        Buffer.concat([tranche, Buffer.from(","), reward]),
      );
    })),
    identityRedundantSlashEscape: bindRawWeeklyPayout(
      canonical,
      mutateIdentity(replaceQuoted("follower/", "follower\\/")),
    ),
    identityRedundantUnicodeEscape: bindRawWeeklyPayout(
      canonical,
      mutateIdentity(replaceQuoted("follower", "f\\u006fllower")),
    ),
    identitySurrogatePairEscape: bindRawWeeklyPayout(
      canonical,
      mutateIdentity(replaceQuoted("🚀", "\\ud83d\\ude80")),
    ),
    identityLoneSurrogateEscape: bindRawWeeklyPayout(
      canonical,
      mutateIdentity(replaceQuoted("🚀", "\\ud800")),
    ),
    identityMalformedEscape: bindRawWeeklyPayout(
      canonical,
      mutateIdentity(replaceQuoted("\\t", "\\q")),
    ),
    identityInvalidUtf8: bindRawWeeklyPayout(canonical, mutateIdentity((quoted) => {
      const marker = Buffer.from("é", "utf8");
      const offset = quoted.indexOf(marker);
      assert.ok(offset >= 0, "raw payout identity UTF-8 marker");
      return Buffer.concat([
        quoted.subarray(0, offset),
        Buffer.from([0xff]),
        quoted.subarray(offset + marker.length),
      ]);
    })),
  });
}

function bindRawWeeklyWeekId(canonical, mutateQuotedBytes) {
  const quoted = Buffer.from(JSON.stringify(WEEKLY_FACTION_WEEK_ID), "utf8");
  const marker = Buffer.concat([Buffer.from("\"factionWeekId\":", "utf8"), quoted]);
  const offset = canonical.sealBytes.indexOf(marker);
  assert.ok(offset >= 0, "weekly faction week ID marker");
  const replacementQuoted = mutateQuotedBytes(Buffer.from(quoted));
  const sealBytes = Buffer.concat([
    canonical.sealBytes.subarray(0, offset + marker.length - quoted.length),
    replacementQuoted,
    canonical.sealBytes.subarray(offset + marker.length),
  ]);
  const batchBytes = Buffer.from(canonical.batchBytes);
  createHash("sha256").update(sealBytes).digest().copy(batchBytes, 88);
  return Object.freeze({ sealBytes, batchBytes });
}

function rawHostileWeeklyFactionVectors(canonical) {
  const replaceQuoted = (needle, replacement) => (quoted) => {
    const offset = quoted.indexOf(Buffer.from(needle, "utf8"));
    assert.ok(offset >= 0, `raw week ID marker ${needle}`);
    return Buffer.concat([
      quoted.subarray(0, offset),
      Buffer.from(replacement, "utf8"),
      quoted.subarray(offset + Buffer.byteLength(needle)),
    ]);
  };
  return Object.freeze({
    redundantSlashEscape: bindRawWeeklyWeekId(canonical, replaceQuoted("week/", "week\\/")),
    redundantUnicodeEscape: bindRawWeeklyWeekId(canonical, replaceQuoted("week", "w\\u0065ek")),
    redundantShortControlEscape: bindRawWeeklyWeekId(canonical, replaceQuoted("\\t", "\\u0009")),
    uppercaseUnicodeEscape: bindRawWeeklyWeekId(canonical, replaceQuoted("\\u0001", "\\u001E")),
    surrogatePairEscape: bindRawWeeklyWeekId(canonical, replaceQuoted("🚀", "\\ud83d\\ude80")),
    loneSurrogateEscape: bindRawWeeklyWeekId(canonical, replaceQuoted("🚀", "\\ud800")),
    malformedEscape: bindRawWeeklyWeekId(canonical, replaceQuoted("\\t", "\\q")),
    invalidUtf8: bindRawWeeklyWeekId(canonical, (quoted) => {
      const marker = Buffer.from("é", "utf8");
      const offset = quoted.indexOf(marker);
      assert.ok(offset >= 0, "raw UTF-8 marker");
      return Buffer.concat([
        quoted.subarray(0, offset), Buffer.from([0xff]), quoted.subarray(offset + marker.length),
      ]);
    }),
  });
}

function renderFixture() {
  const vectors = canonicalVectors();
  const escaped = escapedSourceVectors();
  const xbound = xBoundMatrixVectors();
  const weekly = weeklyFactionVectors();
  const hostile = hostileUniquenessVectors(vectors);
  const hostileXBound = hostileXBoundVectors(xbound);
  const hostileWeekly = hostileWeeklyFactionVectors(weekly);
  const hostileWeeklyEntry = hostileWeeklyPayoutEntryVectors(weekly);
  const hostileWeeklyUnique = hostileWeeklyPayoutUniquenessVectors(weekly);
  const rawHostileWeekly = rawHostileWeeklyFactionVectors(weekly);
  const rawHostileWeeklyEntry = rawHostileWeeklyPayoutEntryVectors(weekly);
  const lines = [
    "# Generated only from the exact host reference; consumed read-only by Rust tests.",
    "schema=iat-b3-reward-capacity-rust-recomputation/v1",
    `source_id=${Buffer.from(SOURCE_ID, "utf8").toString("hex")}`,
    `randomness=${RANDOMNESS}`,
    `seal=${vectors.sealBytes.toString("hex")}`,
    `batch=${vectors.batchBytes.toString("hex")}`,
    `count=${vectors.receiptBytes.length}`,
  ];
  for (let index = 0; index < vectors.receiptBytes.length; index += 1) {
    lines.push(`receipt.${index}=${vectors.receiptBytes[index].toString("hex")}`);
    lines.push(`reference_core.${index}=${vectors.referenceCores[index].toString("hex")}`);
  }
  lines.push(`escaped.source_id=${Buffer.from(ESCAPED_SOURCE_ID, "utf8").toString("hex")}`);
  lines.push(`escaped.randomness=${RANDOMNESS}`);
  lines.push(`escaped.seal=${escaped.sealBytes.toString("hex")}`);
  lines.push(`escaped.batch=${escaped.batchBytes.toString("hex")}`);
  lines.push(`escaped.count=${escaped.receiptBytes.length}`);
  for (let index = 0; index < escaped.receiptBytes.length; index += 1) {
    lines.push(`escaped.receipt.${index}=${escaped.receiptBytes[index].toString("hex")}`);
    lines.push(`escaped.reference_core.${index}=${escaped.referenceCores[index].toString("hex")}`);
  }
  lines.push(`xbound.source_id=${Buffer.from(SOURCE_ID, "utf8").toString("hex")}`);
  lines.push(`xbound.randomness=${RANDOMNESS}`);
  lines.push(`xbound.seal=${xbound.sealBytes.toString("hex")}`);
  lines.push(`xbound.batch=${xbound.batchBytes.toString("hex")}`);
  lines.push(`xbound.count=${xbound.receiptBytes.length}`);
  for (let index = 0; index < xbound.receiptBytes.length; index += 1) {
    lines.push(`xbound.receipt.${index}=${xbound.receiptBytes[index].toString("hex")}`);
    lines.push(`xbound.reference_core.${index}=${xbound.referenceCores[index].toString("hex")}`);
  }
  lines.push(`weekly.source_id=${Buffer.from(SOURCE_ID, "utf8").toString("hex")}`);
  lines.push(`weekly.randomness=${RANDOMNESS}`);
  lines.push(`weekly.seal=${weekly.sealBytes.toString("hex")}`);
  lines.push(`weekly.batch=${weekly.batchBytes.toString("hex")}`);
  lines.push(`weekly.count=${weekly.receiptBytes.length}`);
  for (let index = 0; index < weekly.receiptBytes.length; index += 1) {
    lines.push(`weekly.receipt.${index}=${weekly.receiptBytes[index].toString("hex")}`);
    lines.push(`weekly.reference_core.${index}=${weekly.referenceCores[index].toString("hex")}`);
  }
  for (const [name, vector] of Object.entries(hostile)) {
    lines.push(`hostile.${name}.seal=${vector.sealBytes.toString("hex")}`);
    lines.push(`hostile.${name}.batch=${vector.batchBytes.toString("hex")}`);
  }
  for (const [name, vector] of Object.entries(hostileXBound)) {
    lines.push(`hostile.xbound.${name}.seal=${vector.sealBytes.toString("hex")}`);
    lines.push(`hostile.xbound.${name}.batch=${vector.batchBytes.toString("hex")}`);
  }
  for (const [name, vector] of Object.entries(hostileWeekly)) {
    lines.push(`hostile.weekly.${name}.seal=${vector.sealBytes.toString("hex")}`);
    lines.push(`hostile.weekly.${name}.batch=${vector.batchBytes.toString("hex")}`);
  }
  for (const [name, vector] of Object.entries(hostileWeeklyEntry)) {
    lines.push(`hostile.weeklyEntry.${name}.seal=${vector.sealBytes.toString("hex")}`);
    lines.push(`hostile.weeklyEntry.${name}.batch=${vector.batchBytes.toString("hex")}`);
  }
  for (const [name, vector] of Object.entries(hostileWeeklyUnique)) {
    lines.push(`hostile.weeklyUnique.${name}.seal=${vector.sealBytes.toString("hex")}`);
    lines.push(`hostile.weeklyUnique.${name}.batch=${vector.batchBytes.toString("hex")}`);
  }
  for (const [name, vector] of Object.entries(rawHostileWeekly)) {
    lines.push(`hostile.weeklyRaw.${name}.seal=${vector.sealBytes.toString("hex")}`);
    lines.push(`hostile.weeklyRaw.${name}.batch=${vector.batchBytes.toString("hex")}`);
  }
  for (const [name, vector] of Object.entries(rawHostileWeeklyEntry)) {
    lines.push(`hostile.weeklyEntryRaw.${name}.seal=${vector.sealBytes.toString("hex")}`);
    lines.push(`hostile.weeklyEntryRaw.${name}.batch=${vector.batchBytes.toString("hex")}`);
  }
  return `${lines.join("\n")}\n`;
}

function parseFixture() {
  return Object.fromEntries(readFileSync(FIXTURE_PATH, "utf8")
    .trim()
    .split(/\r?\n/u)
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      assert.ok(separator > 0, `invalid fixture line: ${line}`);
      return [line.slice(0, separator), line.slice(separator + 1)];
    }));
}

if (UPDATE) {
  process.stdout.write(renderFixture());
} else {
  test("canonical host allocation bytes exactly match the native recomputation fixture", () => {
    const fixture = parseFixture();
    const vectors = canonicalVectors();
    const escaped = escapedSourceVectors();
    const xbound = xBoundMatrixVectors();
    const weekly = weeklyFactionVectors();
    const hostile = hostileUniquenessVectors(vectors);
    const hostileXBound = hostileXBoundVectors(xbound);
    const hostileWeekly = hostileWeeklyFactionVectors(weekly);
    const hostileWeeklyEntry = hostileWeeklyPayoutEntryVectors(weekly);
    const hostileWeeklyUnique = hostileWeeklyPayoutUniquenessVectors(weekly);
    const rawHostileWeekly = rawHostileWeeklyFactionVectors(weekly);
    const rawHostileWeeklyEntry = rawHostileWeeklyPayoutEntryVectors(weekly);
    assert.equal(fixture.schema, "iat-b3-reward-capacity-rust-recomputation/v1");
    assert.equal(fixture.source_id, Buffer.from(SOURCE_ID).toString("hex"));
    assert.equal(fixture.randomness, RANDOMNESS);
    assert.equal(fixture.seal, vectors.sealBytes.toString("hex"));
    assert.equal(fixture.batch, vectors.batchBytes.toString("hex"));
    assert.equal(Number(fixture.count), vectors.receiptBytes.length);
    for (let index = 0; index < vectors.receiptBytes.length; index += 1) {
      assert.equal(fixture[`receipt.${index}`], vectors.receiptBytes[index].toString("hex"));
      assert.equal(fixture[`reference_core.${index}`], vectors.referenceCores[index].toString("hex"));
    }
    assert.equal(fixture["escaped.source_id"], Buffer.from(ESCAPED_SOURCE_ID).toString("hex"));
    assert.equal(fixture["escaped.randomness"], RANDOMNESS);
    assert.equal(fixture["escaped.seal"], escaped.sealBytes.toString("hex"));
    assert.equal(fixture["escaped.batch"], escaped.batchBytes.toString("hex"));
    assert.equal(Number(fixture["escaped.count"]), escaped.receiptBytes.length);
    for (let index = 0; index < escaped.receiptBytes.length; index += 1) {
      assert.equal(
        fixture[`escaped.receipt.${index}`],
        escaped.receiptBytes[index].toString("hex"),
      );
      assert.equal(
        fixture[`escaped.reference_core.${index}`],
        escaped.referenceCores[index].toString("hex"),
      );
    }
    assert.equal(fixture["xbound.source_id"], Buffer.from(SOURCE_ID).toString("hex"));
    assert.equal(fixture["xbound.randomness"], RANDOMNESS);
    assert.equal(fixture["xbound.seal"], xbound.sealBytes.toString("hex"));
    assert.equal(fixture["xbound.batch"], xbound.batchBytes.toString("hex"));
    assert.equal(Number(fixture["xbound.count"]), xbound.receiptBytes.length);
    for (let index = 0; index < xbound.receiptBytes.length; index += 1) {
      assert.equal(
        fixture[`xbound.receipt.${index}`],
        xbound.receiptBytes[index].toString("hex"),
      );
      assert.equal(
        fixture[`xbound.reference_core.${index}`],
        xbound.referenceCores[index].toString("hex"),
      );
    }
    assert.equal(fixture["weekly.source_id"], Buffer.from(SOURCE_ID).toString("hex"));
    assert.equal(fixture["weekly.randomness"], RANDOMNESS);
    assert.equal(fixture["weekly.seal"], weekly.sealBytes.toString("hex"));
    assert.equal(fixture["weekly.batch"], weekly.batchBytes.toString("hex"));
    assert.equal(Number(fixture["weekly.count"]), weekly.receiptBytes.length);
    for (let index = 0; index < weekly.receiptBytes.length; index += 1) {
      assert.equal(
        fixture[`weekly.receipt.${index}`],
        weekly.receiptBytes[index].toString("hex"),
      );
      assert.equal(
        fixture[`weekly.reference_core.${index}`],
        weekly.referenceCores[index].toString("hex"),
      );
    }
    for (const [name, vector] of Object.entries(hostile)) {
      assert.equal(
        fixture[`hostile.${name}.seal`],
        vector.sealBytes.toString("hex"),
        `${name} seal`,
      );
      assert.equal(
        fixture[`hostile.${name}.batch`],
        vector.batchBytes.toString("hex"),
        `${name} batch`,
      );
    }
    for (const [name, vector] of Object.entries(hostileXBound)) {
      assert.equal(
        fixture[`hostile.xbound.${name}.seal`],
        vector.sealBytes.toString("hex"),
        `${name} X-bound seal`,
      );
      assert.equal(
        fixture[`hostile.xbound.${name}.batch`],
        vector.batchBytes.toString("hex"),
        `${name} X-bound batch`,
      );
    }
    for (const [name, vector] of Object.entries(hostileWeekly)) {
      assert.equal(
        fixture[`hostile.weekly.${name}.seal`], vector.sealBytes.toString("hex"), `${name} seal`,
      );
      assert.equal(
        fixture[`hostile.weekly.${name}.batch`], vector.batchBytes.toString("hex"), `${name} batch`,
      );
    }
    for (const [name, vector] of Object.entries(hostileWeeklyEntry)) {
      assert.equal(
        fixture[`hostile.weeklyEntry.${name}.seal`],
        vector.sealBytes.toString("hex"),
        `${name} payout-entry seal`,
      );
      assert.equal(
        fixture[`hostile.weeklyEntry.${name}.batch`],
        vector.batchBytes.toString("hex"),
        `${name} payout-entry batch`,
      );
    }
    for (const [name, vector] of Object.entries(hostileWeeklyUnique)) {
      assert.equal(
        fixture[`hostile.weeklyUnique.${name}.seal`],
        vector.sealBytes.toString("hex"),
        `${name} uniqueness seal`,
      );
      assert.equal(
        fixture[`hostile.weeklyUnique.${name}.batch`],
        vector.batchBytes.toString("hex"),
        `${name} uniqueness batch`,
      );
    }
    for (const [name, vector] of Object.entries(rawHostileWeekly)) {
      assert.equal(
        fixture[`hostile.weeklyRaw.${name}.seal`],
        vector.sealBytes.toString("hex"),
        `${name} raw seal`,
      );
      assert.equal(
        fixture[`hostile.weeklyRaw.${name}.batch`],
        vector.batchBytes.toString("hex"),
        `${name} raw batch`,
      );
    }
    for (const [name, vector] of Object.entries(rawHostileWeeklyEntry)) {
      assert.equal(
        fixture[`hostile.weeklyEntryRaw.${name}.seal`],
        vector.sealBytes.toString("hex"),
        `${name} raw payout-entry seal`,
      );
      assert.equal(
        fixture[`hostile.weeklyEntryRaw.${name}.batch`],
        vector.batchBytes.toString("hex"),
        `${name} raw payout-entry batch`,
      );
    }
    assert.deepEqual(vectors.dispositions, [
      "ADMITTED_RESERVED", "ADMITTED_RESERVED", "ADMITTED_RESERVED",
      "ADMITTED_RESERVED", "ADMITTED_RESERVED", "ADMITTED_RESERVED",
      "NULL_UNDERFUNDED", "NULL_BLOCKED", "NULL_BLOCKED",
    ]);
    assert.deepEqual(escaped.dispositions, ["ADMITTED_RESERVED", "ADMITTED_RESERVED"]);
    assert.equal(xbound.dispositions.length, 15);
    assert.ok(xbound.dispositions.every((value) => value === "ADMITTED_RESERVED"));
    assert.deepEqual(weekly.dispositions, [
      "ADMITTED_RESERVED", "ADMITTED_RESERVED", "ADMITTED_RESERVED",
    ]);
  });

  test("host finalization covers every five-source by three-tranche X-bound pair", () => {
    const vectors = xBoundMatrixVectors();
    const candidates = vectors.roundState.roundSeal.candidates;
    assert.equal(candidates.length, 15);
    for (const [source, priority] of Object.entries(X_BOUND_SOURCE_PRIORITY)) {
      for (const tranche of X_BOUND_TRANCHES) {
        const candidate = findXBoundCandidate(vectors.roundState.roundSeal, source, tranche);
        assert.equal(candidate.priorityClass, priority);
        assert.equal(
          candidate.id,
          sha256(`IAT_B3_X_FUNDING_V1|${candidate.rewardId}|${FUNDING_ROUND}|${tranche}`),
        );
        assert.equal(
          Object.hasOwn(candidate, "originalBaseAdmissionLineage"),
          tranche === "X_PREMIUM_UPGRADE_90",
        );
        assert.equal(Object.hasOwn(candidate, "chronology"), priority.startsWith("STANDARD_"));
        assert.equal(Object.hasOwn(candidate, "qualificationPda"), priority.startsWith("CCC_"));
      }
    }
    validateFinalizedRewardCapacityRound({
      roundState: vectors.roundState,
      cccRandomnessReveal: { sourceId: SOURCE_ID, randomnessHex: RANDOMNESS },
    });
  });

  test("host-generated weekly manifest binds raw payouts, checked aggregates, week identity, and ID", () => {
    const vectors = weeklyFactionVectors();
    const candidate = findWeeklyFactionCandidate(vectors.roundState.roundSeal);
    assert.equal(candidate.payoutEntries.length, 3);
    assert.deepEqual(
      candidate.payoutEntries.map(({ trancheKinds }) => trancheKinds[0]).sort(),
      [...X_BOUND_TRANCHES].sort(),
    );
    for (const entry of candidate.payoutEntries) {
      assert.equal(
        entry.fragmentId,
        sha256(`IAT_B3_X_FUNDING_V1|${entry.rewardId}|${FUNDING_ROUND}|${entry.trancheKinds[0]}`),
      );
      assert.deepEqual(Object.keys(entry), entry.trancheKinds[0] === "X_PREMIUM_UPGRADE_90"
        ? [
          "fragmentId", "rewardId", "amount", "trancheKinds", "chronology",
          "originalBaseAdmissionLineage",
        ]
        : ["fragmentId", "rewardId", "amount", "trancheKinds", "chronology"]);
      assert.deepEqual(Object.keys(entry.chronology), [
        "eligibleSequence", "activitySequence", "nodeSequence", "immutableIdentity",
        "commitmentDigest",
      ]);
    }
    assert.equal(
      candidate.payoutEntries.find(
        ({ trancheKinds }) => trancheKinds[0] === "X_PREMIUM_UPGRADE_90",
      ).chronology.immutableIdentity,
      WEEKLY_FACTION_FOLLOWER_IDENTITY,
    );
    assert.equal(new Set(candidate.payoutEntries.map(
      ({ chronology }) => chronology.eligibleSequence,
    )).size, 1);
    assert.equal(new Set(candidate.payoutEntries.map(
      ({ chronology }) => chronology.activitySequence,
    )).size, 1);
    assert.equal(new Set(candidate.payoutEntries.map(
      ({ chronology }) => chronology.nodeSequence,
    )).size, 1);
    assert.equal(new Set(candidate.payoutEntries.map(
      ({ chronology }) => chronology.commitmentDigest,
    )).size, 1);
    assert.equal(new Set(candidate.payoutEntries.map(
      ({ chronology }) => chronology.immutableIdentity,
    )).size, 3);
    assert.equal(candidate.amount, 600n);
    assert.equal(candidate.followerCount, 3);
    assert.equal(candidate.factionWeekId, WEEKLY_FACTION_WEEK_ID);
    assert.deepEqual(candidate.chronology, {
      eligibleSequence: 5n,
      activitySequence: 9n,
      nodeSequence: 10n,
      immutableIdentity: `FACTION_WEEK|${WEEKLY_FACTION_WEEK_ID}`,
      commitmentDigest: candidate.payoutDigest,
    });
    assert.equal(candidate.payoutDigest, sha256(canonicalBytes(candidate.payoutEntries)));
    assert.equal(
      candidate.id,
      sha256(
        `IAT_B3_WEEKLY_FACTION_MANIFEST_V1|${FUNDING_ROUND}|${WEEKLY_FACTION_WEEK_ID}|${candidate.payoutDigest}`,
      ),
    );
    validateFinalizedRewardCapacityRound({
      roundState: vectors.roundState,
      cccRandomnessReveal: { sourceId: SOURCE_ID, randomnessHex: RANDOMNESS },
    });
  });

  test("host JSON.stringify source vector covers every supported canonical escape and Unicode literal", () => {
    const vectors = escapedSourceVectors();
    validateFinalizedRewardCapacityRound({
      roundState: vectors.roundState,
      cccRandomnessReveal: { sourceId: ESCAPED_SOURCE_ID, randomnessHex: RANDOMNESS },
    });
    const seal = vectors.sealBytes.toString("utf8");
    for (const escape of ["\\\"", "\\\\", "\\b", "\\f", "\\n", "\\r", "\\t", "\\u0001", "\\u001e"]) {
      assert.ok(seal.includes(escape), `missing canonical escape ${escape}`);
    }
    for (const literal of ["é", "雪", "🚀", "\u2028"]) {
      assert.ok(seal.includes(literal), `missing literal ${JSON.stringify(literal)}`);
    }
    for (const forbidden of ["\\/", "\\u0022", "\\u00e9", "\\ud83d", "\\u2028"]) {
      assert.ok(!seal.includes(forbidden), `noncanonical escape ${forbidden}`);
    }
  });

  test("host validator rejects every uniqueness-hostile seal committed for native parity", () => {
    const canonical = canonicalVectors();
    const hostile = hostileUniquenessVectors(canonical);
    for (const [name, expected] of [
      ["duplicateCandidateId", /DUPLICATE_REWARD_OBLIGATION_ID/u],
      ["duplicateCccQualificationPda", /DUPLICATE_CCC_QUALIFICATION_PDA_IN_TIER/u],
      ["multipleWeeklyFactionManifests", /ONE_AGGREGATE_WEEKLY_FACTION_MANIFEST/u],
    ]) {
      assert.throws(
        () => validateFinalizedRewardCapacityRound({
          roundState: hostile[name].roundState,
          cccRandomnessReveal: { sourceId: SOURCE_ID, randomnessHex: RANDOMNESS },
        }),
        expected,
        name,
      );
    }
  });

  test("host validator rejects every X-bound semantic drift committed for native parity", () => {
    const canonical = xBoundMatrixVectors();
    const hostile = hostileXBoundVectors(canonical);
    for (const [name, expected] of [
      ["rewardIdDerivedMismatch", /ID_NOT_DERIVED/u],
      ["idDerivedMismatch", /ID_NOT_DERIVED/u],
      ["wrongSourcePriority", /SOURCE_PRIORITY_CLASS_MISMATCH/u],
      ["factionFollowerDirect", /WEEKLY_FACTION_REQUIRES_AGGREGATE/u],
      ["coreDirect", /SOURCE_PRIORITY_CLASS_MISMATCH/u],
      ["emptyTranche", /INVALID_X_BOUND_FUNDING_TRANCHE_SET/u],
      ["multipleTranches", /INVALID_X_BOUND_FUNDING_TRANCHE_SET/u],
      ["unknownTranche", /INVALID_X_BOUND_FUNDING_TRANCHE_SET/u],
      ["missingRewardId", /VARIANT_KEY_SET/u],
      ["missingUpgradeLineage", /VARIANT_KEY_SET/u],
      ["extraBaseLineage", /VARIANT_KEY_SET/u],
      ["genericFieldSmuggling", /X_BOUND_SOURCE_KIND_REQUIRES_X_BOUND_FUNDING_KIND/u],
      ["chronologyOnCcc", /VARIANT_KEY_SET/u],
      ["cccOrderingOnStandard", /VARIANT_KEY_SET/u],
    ]) {
      assert.throws(
        () => validateFinalizedRewardCapacityRound({
          roundState: hostile[name].roundState,
          cccRandomnessReveal: { sourceId: SOURCE_ID, randomnessHex: RANDOMNESS },
        }),
        expected,
        name,
      );
    }
  });

  test("host rejects every structured weekly aggregate and boundary-trim drift", () => {
    const canonical = weeklyFactionVectors();
    const hostile = hostileWeeklyFactionVectors(canonical);
    for (const [name, vector] of Object.entries(hostile)) {
      assert.throws(
        () => validateFinalizedRewardCapacityRound({
          roundState: vector.roundState,
          cccRandomnessReveal: { sourceId: SOURCE_ID, randomnessHex: RANDOMNESS },
        }),
        /FACTION|faction|week|trim|u64|U64/u,
        name,
      );
    }
  });

  test("host rejects every structured weekly payout-entry field and fragment drift", () => {
    const canonical = weeklyFactionVectors();
    for (const [name, vector] of Object.entries(hostileWeeklyPayoutEntryVectors(canonical))) {
      assert.throws(
        () => validateFinalizedRewardCapacityRound({
          roundState: vector.roundState,
          cccRandomnessReveal: { sourceId: SOURCE_ID, randomnessHex: RANDOMNESS },
        }),
        /FACTION|faction|X_BOUND|LINEAGE|lineage|chronology|u64|U64|trim|digest/u,
        name,
      );
    }
  });

  test("host rejects adjacent and nonadjacent weekly fragment, reward, and identity duplicates", () => {
    const canonical = weeklyFactionVectors();
    for (const [name, vector] of Object.entries(hostileWeeklyPayoutUniquenessVectors(canonical))) {
      assert.throws(
        () => validateFinalizedRewardCapacityRound({
          roundState: vector.roundState,
          cccRandomnessReveal: { sourceId: SOURCE_ID, randomnessHex: RANDOMNESS },
        }),
        /DUPLICATE|duplicate|CANONICALLY_ORDERED/u,
        name,
      );
    }
  });

  test("raw weekly week-ID vectors fail the supported canonical seal subset", () => {
    const canonical = weeklyFactionVectors();
    for (const [name, vector] of Object.entries(rawHostileWeeklyFactionVectors(canonical))) {
      const decoded = vector.sealBytes.toString("utf8");
      let canonicalRoundTrip = null;
      try {
        canonicalRoundTrip = canonicalBytes(JSON.parse(decoded));
      } catch {
        // Malformed JSON and invalid UTF-8 are both expected to fail closed.
      }
      if (name === "loneSurrogateEscape") {
        // JSON.stringify preserves lone surrogate escapes; this native subset
        // intentionally rejects them instead of claiming JS string parity.
        assert.deepEqual(canonicalRoundTrip, vector.sealBytes, name);
      } else {
        assert.notDeepEqual(canonicalRoundTrip, vector.sealBytes, name);
      }
    }
  });

  test("raw weekly payout-entry key and identity vectors fail canonical round-trip", () => {
    const canonical = weeklyFactionVectors();
    for (const [name, vector] of Object.entries(rawHostileWeeklyPayoutEntryVectors(canonical))) {
      const decoded = vector.sealBytes.toString("utf8");
      let canonicalRoundTrip = null;
      try {
        canonicalRoundTrip = canonicalBytes(JSON.parse(decoded));
      } catch {
        // Malformed JSON and invalid UTF-8 are both expected to fail closed.
      }
      if (name === "identityLoneSurrogateEscape") {
        assert.deepEqual(canonicalRoundTrip, vector.sealBytes, name);
      } else {
        assert.notDeepEqual(canonicalRoundTrip, vector.sealBytes, name);
      }
    }
  });

  test("native no_std suite accepts the host vector and rejects hostile committed drift", {
    timeout: 240_000,
  }, () => {
    const manifest = "programs/iat_b3_economy/Cargo.toml";
    const command = process.platform === "win32" ? "wsl.exe" : "cargo";
    const args = process.platform === "win32"
      ? ["bash", "-lc", `cd '${SITE_ROOT.replaceAll("'", "'\\''").replace(/^([A-Za-z]):/u, (_m, drive) => `/mnt/${drive.toLowerCase()}` ).replaceAll("\\", "/")}' && cargo test --manifest-path ${manifest} --test reward_capacity_recomputation_spec`]
      : ["test", "--manifest-path", manifest, "--test", "reward_capacity_recomputation_spec"];
    const run = spawnSync(command, args, { cwd: SITE_ROOT, encoding: "utf8", timeout: 230_000 });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /test result: ok/u);
  });

  test("guarded canonical path imports this full differential suite", () => {
    const guardTest = readFileSync(join(SITE_ROOT, "tests", "iat-b3-reward-guarded-source-inventory.test.mjs"), "utf8");
    assert.match(guardTest, /iat-b3-reward-capacity-rust-recomputation\.test\.mjs/u);
  });
}

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

function factionManifest({
  rewardNumber = 80_001,
  weekId = "week-1",
  sequence = 80,
  identity = "faction-follower-1",
} = {}) {
  const rewardId = hex(rewardNumber);
  const trancheKinds = ["X_BASE_10"];
  const fragment = {
    id: sha256(`IAT_B3_X_FUNDING_V1|${rewardId}|${FUNDING_ROUND}|${trancheKinds[0]}`),
    kind: "X_BOUND_FACTION_FRAGMENT",
    rewardId,
    rewardSourceKind: "FACTION_FOLLOWER",
    trancheKinds,
    priorityClass: "WEEKLY_FACTION",
    amount: 100n,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    chronology: {
      eligibleSequence: BigInt(sequence),
      activitySequence: BigInt(sequence),
      nodeSequence: BigInt(sequence),
      immutableIdentity: identity,
      commitmentDigest: rewardId,
    },
  };
  return buildWeeklyFactionManifestObligation({
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    factionWeekId: weekId,
    followerObligations: [fragment],
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

function renderFixture() {
  const vectors = canonicalVectors();
  const escaped = escapedSourceVectors();
  const xbound = xBoundMatrixVectors();
  const hostile = hostileUniquenessVectors(vectors);
  const hostileXBound = hostileXBoundVectors(xbound);
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
  for (const [name, vector] of Object.entries(hostile)) {
    lines.push(`hostile.${name}.seal=${vector.sealBytes.toString("hex")}`);
    lines.push(`hostile.${name}.batch=${vector.batchBytes.toString("hex")}`);
  }
  for (const [name, vector] of Object.entries(hostileXBound)) {
    lines.push(`hostile.xbound.${name}.seal=${vector.sealBytes.toString("hex")}`);
    lines.push(`hostile.xbound.${name}.batch=${vector.batchBytes.toString("hex")}`);
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
    const hostile = hostileUniquenessVectors(vectors);
    const hostileXBound = hostileXBoundVectors(xbound);
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
    assert.deepEqual(vectors.dispositions, [
      "ADMITTED_RESERVED", "ADMITTED_RESERVED", "ADMITTED_RESERVED",
      "ADMITTED_RESERVED", "ADMITTED_RESERVED", "ADMITTED_RESERVED",
      "NULL_UNDERFUNDED", "NULL_BLOCKED", "NULL_BLOCKED",
    ]);
    assert.deepEqual(escaped.dispositions, ["ADMITTED_RESERVED", "ADMITTED_RESERVED"]);
    assert.equal(xbound.dispositions.length, 15);
    assert.ok(xbound.dispositions.every((value) => value === "ADMITTED_RESERVED"));
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

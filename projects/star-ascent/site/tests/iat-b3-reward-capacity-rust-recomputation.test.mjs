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

function canonicalVectors() {
  const revealCommitment = createCccRevealCommitment({
    sourceId: SOURCE_ID,
    committedAtUnixSeconds: FUNDING_ROUND - 10n,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    randomnessHex: RANDOMNESS,
  });
  const obligations = [
    generic(1, "CCC_AGENT", 100, 1),
    generic(2, "CCC_AGENT", 100, 1),
    generic(3, "CCC_ASSOCIATE", 100, 2),
    generic(4, "STANDARD_10_PERCENT_AND_X_CAMPAIGN", 100, 40),
    xBound(50_001, "X_BASE_10", 50),
    xBound(50_002, "X_PREMIUM_FULL_100", 60),
    xBound(50_003, "X_PREMIUM_UPGRADE_90", 70),
    factionManifest(),
    generic(9, "CORE", 100, 90),
  ];
  const pending = sealRewardCapacityRound({
    dailyLawState: law,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    sealedAtUnixSeconds: FUNDING_ROUND,
    obligations,
    ledgerSnapshot: {
      lanes: {
        treasury: { unlocked: 150n, reserved: 0n, paid: 0n, withdrawn: 0n },
        ecosystem: { unlocked: 250n, reserved: 0n, paid: 0n, withdrawn: 0n },
        liquidity: { unlocked: 250n, reserved: 0n, paid: 0n, withdrawn: 0n },
      },
    },
    cccPrecommitRegistrySnapshot: createCccPrecommitRegistrySnapshot({
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
      commitments: [revealCommitment],
    }),
  });
  const allocation = allocateRewardCapacity({
    dailyLawState: law,
    roundState: pending,
    cccRandomnessReveal: { sourceId: SOURCE_ID, randomnessHex: RANDOMNESS },
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

function renderFixture() {
  const vectors = canonicalVectors();
  const hostile = hostileUniquenessVectors(vectors);
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
  for (const [name, vector] of Object.entries(hostile)) {
    lines.push(`hostile.${name}.seal=${vector.sealBytes.toString("hex")}`);
    lines.push(`hostile.${name}.batch=${vector.batchBytes.toString("hex")}`);
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
    const hostile = hostileUniquenessVectors(vectors);
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
    assert.deepEqual(vectors.dispositions, [
      "ADMITTED_RESERVED", "ADMITTED_RESERVED", "ADMITTED_RESERVED",
      "ADMITTED_RESERVED", "ADMITTED_RESERVED", "ADMITTED_RESERVED",
      "NULL_UNDERFUNDED", "NULL_BLOCKED", "NULL_BLOCKED",
    ]);
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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  allocatorTranscriptSha256,
  decodeAllocatorBatchCommitment,
  decodeAllocatorReceiptEnvelope,
  encodeAllocatorBatchFromFinalizedRound,
  encodeAllocatorReceiptFromOutcome,
  validateAllocatorReceiptBinding,
} from "../programs/iat_b3_reference/reward-allocator-receipt-codec.mjs";
import {
  allocateRewardCapacity,
  createCccPrecommitRegistrySnapshot,
  sealRewardCapacityRound,
} from "../programs/iat_b3_reference/reward-capacity-waterfall.mjs";
import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";

const SITE_ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXTURE_PATH = fileURLToPath(new URL(
  "./fixtures/iat-b3-reward-allocator-transcript-v1.txt",
  import.meta.url,
));
const FUNDING_ROUND = 1_786_060_800n;
const LOCAL_0001_UTC = 1_786_050_060n;
const hex = (value) => value.toString(16).padStart(64, "0");

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

function referenceCoreBytes(referenceReceipt) {
  const core = Object.fromEntries(Object.entries(referenceReceipt)
    .filter(([key]) => key !== "receiptSha256"));
  return Buffer.from(JSON.stringify(canonicalize(core), (_key, entry) => (
    typeof entry === "bigint" ? entry.toString() : entry
  )), "utf8");
}

function obligation(id, amount, sequence) {
  return {
    id: hex(id),
    priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
    amount: BigInt(amount),
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    chronology: {
      eligibleSequence: BigInt(sequence),
      activitySequence: BigInt(sequence),
      nodeSequence: BigInt(sequence),
      immutableIdentity: `identity-${sequence}`,
      commitmentDigest: hex(10_000 + sequence),
    },
  };
}

function canonicalVectors() {
  const pending = sealRewardCapacityRound({
    dailyLawState: law,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    sealedAtUnixSeconds: FUNDING_ROUND,
    obligations: [obligation(1, 600, 1), obligation(2, 500, 2), obligation(3, 100, 3)],
    ledgerSnapshot: {
      lanes: {
        treasury: { unlocked: 1_000n, reserved: 0n, paid: 0n, withdrawn: 0n },
        ecosystem: { unlocked: 0n, reserved: 0n, paid: 0n, withdrawn: 0n },
        liquidity: { unlocked: 0n, reserved: 0n, paid: 0n, withdrawn: 0n },
      },
    },
    cccPrecommitRegistrySnapshot: createCccPrecommitRegistrySnapshot({
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
      commitments: [],
    }),
  });
  const allocation = allocateRewardCapacity({ dailyLawState: law, roundState: pending });
  const outcomes = [...allocation.funded, ...allocation.nullOutcomes]
    .sort((left, right) => allocation.orderedIds.indexOf(left.id) - allocation.orderedIds.indexOf(right.id));
  const referenceReceipts = Object.freeze(outcomes.map(({ allocatorReceipt }) => allocatorReceipt));
  const referenceDigests = allocation.finalization.receiptDigests;
  const referenceCores = Object.freeze(referenceReceipts.map(referenceCoreBytes));
  const batchBytes = encodeAllocatorBatchFromFinalizedRound(allocation.roundState);
  const receiptBytes = outcomes.map((outcome, allocationIndex) => (
    encodeAllocatorReceiptFromOutcome({ roundState: allocation.roundState, outcome, allocationIndex })
  ));
  return Object.freeze({
    referenceReceipts,
    referenceDigests,
    referenceCores,
    batchBytes,
    receiptBytes,
  });
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

test("JS encoder bytes are the exact vectors consumed by the native Rust decoder", () => {
  const fixture = parseFixture();
  const vectors = canonicalVectors();
  assert.equal(fixture.schema, "iat-b3-reward-allocator-transcript-differential/v1");
  assert.equal(vectors.batchBytes.toString("hex"), fixture.batch);
  assert.deepEqual(vectors.referenceReceipts.map((receipt) => ({
    activationReady: receipt.activationReady,
    schema: receipt.schema,
    status: receipt.status,
    plannedByLane: receipt.plannedByLane,
    reason: receipt.reason,
  })), [
    {
      activationReady: false,
      schema: "iat-b3-reward-capacity-allocator-receipt/v1",
      status: "NON_ACTIVATING_REFERENCE_RECEIPT",
      plannedByLane: { treasury: 600n, ecosystem: 0n, liquidity: 0n },
      reason: null,
    },
    {
      activationReady: false,
      schema: "iat-b3-reward-capacity-allocator-receipt/v1",
      status: "NON_ACTIVATING_REFERENCE_RECEIPT",
      plannedByLane: null,
      reason: "EXACT_AMOUNT_NOT_AVAILABLE",
    },
    {
      activationReady: false,
      schema: "iat-b3-reward-capacity-allocator-receipt/v1",
      status: "NON_ACTIVATING_REFERENCE_RECEIPT",
      plannedByLane: null,
      reason: "HIGHER_PRIORITY_OR_EARLIER_OBLIGATION_UNDERFUNDED",
    },
  ]);
  for (let index = 0; index < vectors.receiptBytes.length; index += 1) {
    assert.equal(vectors.referenceDigests[index], fixture[`reference_receipt.${index}`]);
    assert.equal(vectors.referenceCores[index].toString("hex"), fixture[`reference_core.${index}`]);
    assert.equal(allocatorTranscriptSha256(vectors.referenceCores[index]), vectors.referenceDigests[index]);
    assert.equal(vectors.receiptBytes[index].toString("hex"), fixture[`receipt.${index}`]);
    assert.doesNotThrow(() => validateAllocatorReceiptBinding({
      batchBytes: vectors.batchBytes,
      receiptBytes: vectors.receiptBytes[index],
      referenceReceiptDigests: vectors.referenceDigests,
      referenceReceipt: vectors.referenceReceipts[index],
    }));
  }
  assert.equal(decodeAllocatorBatchCommitment(vectors.batchBytes).receiptCount, 3);
  assert.deepEqual(vectors.receiptBytes.map((bytes) => decodeAllocatorReceiptEnvelope(bytes).allocationIndex), [0, 1, 2]);
});

test("JS semantic validator rejects locally canonical envelope decisions hidden behind a member digest", () => {
  const vectors = canonicalVectors();
  const assertRejects = (receiptBytes, referenceIndex) => assert.throws(
    () => validateAllocatorReceiptBinding({
      batchBytes: vectors.batchBytes,
      receiptBytes,
      referenceReceiptDigests: vectors.referenceDigests,
      referenceReceipt: vectors.referenceReceipts[referenceIndex],
    }),
    /does not match its reference decision|lane plan does not match/u,
  );

  const obligationId = Buffer.from(vectors.receiptBytes[0]);
  obligationId[120] ^= 1;
  assertRejects(obligationId, 0);

  const obligation = Buffer.from(vectors.receiptBytes[0]);
  obligation[152] ^= 1;
  assertRejects(obligation, 0);

  const exactAmount = Buffer.from(vectors.receiptBytes[0]);
  exactAmount.writeBigUInt64LE(601n, 184);
  exactAmount.writeBigUInt64LE(601n, 192);
  assertRejects(exactAmount, 0);

  const lanePlan = Buffer.from(vectors.receiptBytes[0]);
  lanePlan.writeBigUInt64LE(599n, 192);
  lanePlan.writeBigUInt64LE(1n, 200);
  assertRejects(lanePlan, 0);

  const faction = Buffer.from(vectors.receiptBytes[1]);
  faction.fill(0xdd, 248, 280);
  faction[282] = 1;
  assertRejects(faction, 1);

  const dispositionAndReason = Buffer.from(vectors.receiptBytes[1]);
  dispositionAndReason[280] = 3;
  dispositionAndReason[281] = 2;
  assertRejects(dispositionAndReason, 1);
});

test("native Rust differential suite accepts the same vectors and hostile mutations", {
  timeout: 240_000,
}, () => {
  const manifestRelative = "programs/iat_b3_economy/Cargo.toml";
  let command;
  let args;
  let options;
  if (process.platform === "win32") {
    const drive = SITE_ROOT.slice(0, 1).toLowerCase();
    const wslRoot = `/mnt/${drive}/${SITE_ROOT.slice(3).replaceAll("\\", "/")}`;
    const quotedRoot = `'${wslRoot.replaceAll("'", "'\\''")}'`;
    command = "wsl.exe";
    args = ["sh", "-lc", `cd ${quotedRoot} && CARGO_TARGET_DIR=/tmp/iat-b3-reward-allocator-differential-target cargo test --locked --manifest-path ${manifestRelative} --test reward_allocator_transcript_spec`];
    options = { cwd: dirname(SITE_ROOT) };
  } else {
    command = "cargo";
    args = ["test", "--locked", "--manifest-path", manifestRelative, "--test", "reward_allocator_transcript_spec"];
    options = {
      cwd: SITE_ROOT,
      env: {
        ...process.env,
        CARGO_TARGET_DIR: join(tmpdir(), "iat-b3-reward-allocator-differential-target"),
      },
    };
  }
  const result = spawnSync(command, args, {
    ...options,
    encoding: "utf8",
    timeout: 230_000,
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `Rust differential failed:\n${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /test result: ok/u);
});

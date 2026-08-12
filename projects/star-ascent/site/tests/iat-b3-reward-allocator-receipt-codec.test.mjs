import assert from "node:assert/strict";
import test from "node:test";

import {
  ALLOCATOR_BATCH_TRANSCRIPT_LENGTH,
  ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH,
  REFERENCE_DEPLOYMENT_DOMAIN_SHA256,
  allocatorTranscriptSha256,
  decodeAllocatorBatchCommitment,
  decodeAllocatorReceiptEnvelope,
  deriveAllocatorReceiptLineage,
  encodeAllocatorBatchCommitment,
  encodeAllocatorBatchFromFinalizedRound,
  encodeAllocatorReceiptEnvelope,
  encodeAllocatorReceiptFromOutcome,
  validateAllocatorReceiptBinding,
} from "../programs/iat_b3_reference/reward-allocator-receipt-codec.mjs";
import {
  REWARD_CAPACITY_POLICY_CANONICAL_SHA256,
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

const LOCAL_0001_UTC = 1_786_050_060n;
const FUNDING_ROUND = 1_786_060_800n;
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

function fixture() {
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
  return { allocation, outcomes };
}

test("fixed transcripts bind an admitted decision and the two exact allocator null decisions", () => {
  const { allocation, outcomes } = fixture();
  const batch = encodeAllocatorBatchFromFinalizedRound(allocation.roundState);
  assert.equal(batch.length, ALLOCATOR_BATCH_TRANSCRIPT_LENGTH);
  const decodedBatch = decodeAllocatorBatchCommitment(batch);
  assert.equal(decodedBatch.policySha256, REWARD_CAPACITY_POLICY_CANONICAL_SHA256);
  assert.equal(decodedBatch.deploymentDomainSha256, REFERENCE_DEPLOYMENT_DOMAIN_SHA256);
  assert.equal(decodedBatch.receiptCount, 3);

  const receipts = outcomes.map((outcome, allocationIndex) => (
    encodeAllocatorReceiptFromOutcome({ roundState: allocation.roundState, outcome, allocationIndex })
  ));
  assert.ok(receipts.every((receipt) => receipt.length === ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH));
  assert.deepEqual(receipts.map((receipt) => decodeAllocatorReceiptEnvelope(receipt).disposition), [
    "ADMITTED_RESERVED",
    "NULL_UNDERFUNDED",
    "NULL_BLOCKED",
  ]);
  assert.deepEqual(receipts.map((receipt) => decodeAllocatorReceiptEnvelope(receipt).reason), [
    "NONE",
    "EXACT_AMOUNT_NOT_AVAILABLE",
    "HIGHER_PRIORITY_OR_EARLIER_OBLIGATION_UNDERFUNDED",
  ]);
  assert.deepEqual(receipts.map((receipt) => decodeAllocatorReceiptEnvelope(receipt).allocationIndex), [0, 1, 2]);
});

test("golden batch and receipt hashes freeze exact little-endian layouts", () => {
  const { allocation, outcomes } = fixture();
  const batch = encodeAllocatorBatchFromFinalizedRound(allocation.roundState);
  const receipts = outcomes.map((outcome, allocationIndex) => (
    encodeAllocatorReceiptFromOutcome({ roundState: allocation.roundState, outcome, allocationIndex })
  ));
  assert.equal(allocatorTranscriptSha256(batch), "73f459eac52b997281567c6a89630779832557b0661de103118594c687723f09");
  assert.deepEqual(receipts.map(allocatorTranscriptSha256), [
    "20274c0054a37bca9e6f8f374d4e639c8fb2e7decd7016d482f3b6aa3b95c000",
    "8f50fe7153c828c2b9faeec41b923ca02aef1026fdae107e6d96a1540761ef6d",
    "14b9070e4c0d4b8768a28d319995e1bdd6c9fdaa4c5118f1d4c056aaf708d2f7",
  ]);
});

test("ordered unique membership and every duplicated reference field are enforced", () => {
  const { allocation, outcomes } = fixture();
  const batch = encodeAllocatorBatchFromFinalizedRound(allocation.roundState);
  const receipt = encodeAllocatorReceiptFromOutcome({
    roundState: allocation.roundState,
    outcome: outcomes[1],
    allocationIndex: 1,
  });
  assert.doesNotThrow(() => validateAllocatorReceiptBinding({
    batchBytes: batch,
    receiptBytes: receipt,
    referenceReceiptDigests: allocation.finalization.receiptDigests,
    referenceReceipt: outcomes[1].allocatorReceipt,
  }));
  assert.throws(() => validateAllocatorReceiptBinding({
    batchBytes: batch,
    receiptBytes: receipt,
    referenceReceiptDigests: [...allocation.finalization.receiptDigests].reverse(),
    referenceReceipt: outcomes[1].allocatorReceipt,
  }), /ordered reference receipt set/);
  assert.throws(() => validateAllocatorReceiptBinding({
    batchBytes: batch,
    receiptBytes: receipt,
    referenceReceiptDigests: allocation.finalization.receiptDigests,
    referenceReceipt: { ...outcomes[1].allocatorReceipt, exactAmount: 501n },
  }), /reference allocator receipt digest mismatch|does not match/);
});

test("codec rejects terminal ledger events, partial payments, overflow, and non-midnight rounds", () => {
  const common = {
    batchCommitmentSha256: hex(1),
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    sealSha256: hex(2),
    referenceFinalizationSha256: hex(3),
    obligationIdSha256: hex(4),
    obligationSha256: hex(5),
    exactAmount: 100n,
    plannedByLane: { treasury: 100n, ecosystem: 0n, liquidity: 0n },
    referenceReceiptSha256: hex(6),
    factionPayoutDigest: null,
    disposition: "ADMITTED_RESERVED",
    reason: "NONE",
    allocationIndex: 0,
  };
  assert.throws(() => encodeAllocatorReceiptEnvelope({ ...common, disposition: "NULL_MISSED" }), /unsupported/);
  assert.throws(() => encodeAllocatorReceiptEnvelope({
    ...common,
    plannedByLane: { treasury: 99n, ecosystem: 0n, liquidity: 0n },
  }), /lane sum/);
  assert.throws(() => encodeAllocatorReceiptEnvelope({
    ...common,
    plannedByLane: { treasury: (1n << 64n) - 1n, ecosystem: 1n, liquidity: 0n },
  }), /sum must fit/);
  assert.throws(() => encodeAllocatorReceiptEnvelope({
    ...common,
    fundingRoundAtUnixSeconds: FUNDING_ROUND + 1n,
  }), /00:00 UTC/);
});

test("decoders fail closed on type, version, reserve, enum, boolean, and length corruption", () => {
  const { allocation, outcomes } = fixture();
  const batch = encodeAllocatorBatchFromFinalizedRound(allocation.roundState);
  const receipt = encodeAllocatorReceiptFromOutcome({
    roundState: allocation.roundState,
    outcome: outcomes[0],
    allocationIndex: 0,
  });
  for (const [bytes, offset, decode] of [
    [batch, 0, decodeAllocatorBatchCommitment],
    [batch, 8, decodeAllocatorBatchCommitment],
    [batch, 11, decodeAllocatorBatchCommitment],
    [batch, 316, decodeAllocatorBatchCommitment],
    [receipt, 0, decodeAllocatorReceiptEnvelope],
    [receipt, 8, decodeAllocatorReceiptEnvelope],
    [receipt, 11, decodeAllocatorReceiptEnvelope],
    [receipt, 280, decodeAllocatorReceiptEnvelope],
    [receipt, 282, decodeAllocatorReceiptEnvelope],
    [receipt, 283, decodeAllocatorReceiptEnvelope],
  ]) {
    const corrupt = Buffer.from(bytes);
    corrupt[offset] ^= 0xff;
    assert.throws(() => decode(corrupt));
  }
  assert.throws(() => decodeAllocatorBatchCommitment(batch.subarray(0, -1)), /exactly/);
  assert.throws(() => decodeAllocatorReceiptEnvelope(Buffer.concat([receipt, Buffer.of(0)])), /exactly/);
});

test("failed encodes are atomic and lineage digests are derived rather than caller-selected", () => {
  const output = Buffer.alloc(ALLOCATOR_BATCH_TRANSCRIPT_LENGTH, 0xa5);
  const before = Buffer.from(output);
  assert.throws(() => encodeAllocatorBatchCommitment({
    policySha256: REWARD_CAPACITY_POLICY_CANONICAL_SHA256,
    deploymentDomainSha256: "00".repeat(32),
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    sealSha256: hex(1),
    candidateSetSha256: hex(2),
    preLedgerSha256: hex(3),
    postLedgerSha256: hex(4),
    receiptSetSha256: hex(5),
    outcomeSha256: hex(6),
    referenceFinalizationSha256: hex(7),
    receiptCount: 1,
  }, output), /deployment domain/);
  assert.deepEqual(output, before);

  const { allocation, outcomes } = fixture();
  const lineage = deriveAllocatorReceiptLineage({
    roundState: allocation.roundState,
    outcome: outcomes[0],
    allocationIndex: 0,
  });
  assert.equal(lineage.referenceReceiptSha256, outcomes[0].allocatorReceipt.receiptSha256);
  assert.match(lineage.batchCommitmentSha256, /^[0-9a-f]{64}$/u);
  assert.match(lineage.binaryReceiptSha256, /^[0-9a-f]{64}$/u);
  assert.notEqual(lineage.batchCommitmentSha256, lineage.binaryReceiptSha256);
});

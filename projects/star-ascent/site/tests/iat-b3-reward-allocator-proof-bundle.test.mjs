import assert from "node:assert/strict";
import test from "node:test";

import { encodeBase58 } from "../engagement/solana-wallet-proof.mjs";
import {
  ALLOCATOR_BATCH_TRANSCRIPT_LENGTH,
  ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH,
  REFERENCE_DEPLOYMENT_DOMAIN_SHA256,
  allocatorTranscriptSha256,
  canonicalReferenceSha256,
  decodeAllocatorBatchCommitment,
  decodeAllocatorReceiptEnvelope,
  encodeAllocatorBatchCommitment,
  encodeAllocatorReceiptEnvelope,
} from "../programs/iat_b3_reference/reward-allocator-receipt-codec.mjs";
import {
  REWARD_ALLOCATOR_PROOF_BUNDLE_SCHEMA,
  REWARD_ALLOCATOR_PROOF_BUNDLE_STATUS,
  buildRewardAllocatorProofBundle,
  validateRewardAllocatorProofBundle,
} from "../programs/iat_b3_reference/reward-allocator-proof-bundle.mjs";
import {
  allocateRewardCapacity,
  buildWeeklyFactionManifestObligation,
  buildXBoundFundingObligation,
  createCccPrecommitRegistrySnapshot,
  createCccRevealCommitment,
  createXBoundReward,
  sealRewardCapacityRound,
  validateFinalizedRewardCapacityRound,
} from "../programs/iat_b3_reference/reward-capacity-waterfall.mjs";
import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";

const LOCAL_0001_UTC = 1_786_050_060n;
const FUNDING_ROUND = 1_786_060_800n;
const hex32 = (value) => BigInt(value).toString(16).padStart(64, "0");

const schedule = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: LOCAL_0001_UTC - 86_520n,
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-proof-bundle-testnet-1",
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
const walletBytes = Buffer.alloc(32);
walletBytes[0] = 1;
const wallet = encodeBase58(walletBytes);

function chronology(sequence, identity) {
  return {
    eligibleSequence: BigInt(sequence),
    activitySequence: BigInt(sequence),
    nodeSequence: BigInt(sequence),
    immutableIdentity: identity,
    commitmentDigest: hex32(10_000n + BigInt(sequence)),
  };
}

function genericObligation({ id, priorityClass, amount, sequence }) {
  return {
    id: hex32(id),
    priorityClass,
    amount: BigInt(amount),
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    chronology: chronology(sequence, `identity-${id}`),
  };
}

function cccObligation({ id, priorityClass, amount, activity = id, node = id, eligible = id }) {
  return {
    id: hex32(id),
    priorityClass,
    amount: BigInt(amount),
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    qualifyingActivityStartSlot: BigInt(activity),
    nodeActivationSlot: BigInt(node),
    eligibleSequence: BigInt(eligible),
    qualificationPda: hex32(1_000_000n + BigInt(id)),
  };
}

function ledger(treasury = 1_000n, ecosystem = 0n, liquidity = 0n) {
  return {
    lanes: {
      treasury: { unlocked: treasury, reserved: 0n, paid: 0n, withdrawn: 0n },
      ecosystem: { unlocked: ecosystem, reserved: 0n, paid: 0n, withdrawn: 0n },
      liquidity: { unlocked: liquidity, reserved: 0n, paid: 0n, withdrawn: 0n },
    },
  };
}

function factionManifest(amount = 40n) {
  const reward = createXBoundReward({
    dailyLawState: law,
    rewardId: hex32(2_000_000n),
    rewardSourceKind: "FACTION_FOLLOWER",
    wallet,
    xUserId: "2000000",
    grossBaseUnits: amount * 10n,
    epochClosedAtUnixSeconds: FUNDING_ROUND,
    subscriptionType: "None",
    subscriptionObservedAtUnixSeconds: FUNDING_ROUND - 1n,
    activityQualificationSequence: 4n,
    nodeActivationSequence: 4n,
  });
  return buildWeeklyFactionManifestObligation({
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    factionWeekId: "2026-W32-proof-bundle",
    followerObligations: [buildXBoundFundingObligation({
      reward,
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
    })],
  });
}

function finalizeRound({ obligations, boundaryLedger = ledger(), reveal = null, commitments = [] }) {
  const pending = sealRewardCapacityRound({
    dailyLawState: law,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    sealedAtUnixSeconds: FUNDING_ROUND,
    obligations,
    ledgerSnapshot: boundaryLedger,
    cccPrecommitRegistrySnapshot: createCccPrecommitRegistrySnapshot({
      fundingRoundAtUnixSeconds: FUNDING_ROUND,
      commitments,
    }),
  });
  return allocateRewardCapacity({
    dailyLawState: law,
    roundState: pending,
    cccRandomnessReveal: reveal,
  });
}

function mixedClassFixture() {
  return finalizeRound({
    obligations: [
      cccObligation({ id: 1n, priorityClass: "CCC_AGENT", amount: 10n }),
      cccObligation({ id: 2n, priorityClass: "CCC_ASSOCIATE", amount: 20n }),
      genericObligation({
        id: 3n,
        priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
        amount: 30n,
        sequence: 3n,
      }),
      factionManifest(40n),
      genericObligation({ id: 5n, priorityClass: "CORE", amount: 1n, sequence: 5n }),
    ],
    boundaryLedger: ledger(25n, 20n, 20n),
  });
}

function cloneBundle(bundle) {
  return {
    ...bundle,
    batchBytes: Buffer.from(bundle.batchBytes),
    receiptBytes: bundle.receiptBytes.map((bytes) => Buffer.from(bytes)),
  };
}

test("zero and one-outcome finalized rounds emit exact complete nonactivating bundles", () => {
  for (const allocation of [
    finalizeRound({ obligations: [] }),
    finalizeRound({
      obligations: [genericObligation({
        id: 10n,
        priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
        amount: 1n,
        sequence: 1n,
      })],
      boundaryLedger: ledger(1n),
    }),
  ]) {
    const before = structuredClone(allocation.roundState);
    const recomputed = validateFinalizedRewardCapacityRound({ roundState: allocation.roundState });
    const bundle = buildRewardAllocatorProofBundle({ roundState: allocation.roundState });
    const decoded = validateRewardAllocatorProofBundle({ roundState: allocation.roundState, bundle });
    assert.deepEqual(allocation.roundState, before);
    assert.deepEqual(recomputed.finalization, allocation.finalization);
    assert.equal(Object.isFrozen(recomputed), true);
    assert.equal(Object.isFrozen(recomputed.orderedIds), true);
    assert.equal(Object.isFrozen(recomputed.funded), true);
    assert.equal(Object.isFrozen(recomputed.nullOutcomes), true);
    assert.equal(Object.isFrozen(recomputed.ledger.lanes.treasury), true);
    assert.throws(() => recomputed.orderedIds.push(hex32(999n)), TypeError);
    assert.throws(() => {
      recomputed.ledger.lanes.treasury.reserved = 999n;
    }, TypeError);
    if (recomputed.funded.length > 0) {
      assert.equal(Object.isFrozen(recomputed.funded[0].allocatorReceipt.plannedByLane), true);
      assert.throws(() => {
        recomputed.funded[0].allocatorReceipt.plannedByLane.treasury = 999n;
      }, TypeError);
    }
    assert.equal(bundle.schema, REWARD_ALLOCATOR_PROOF_BUNDLE_SCHEMA);
    assert.equal(bundle.status, REWARD_ALLOCATOR_PROOF_BUNDLE_STATUS);
    assert.equal(bundle.batchBytes.length, ALLOCATOR_BATCH_TRANSCRIPT_LENGTH);
    assert.equal(bundle.receiptBytes.length, allocation.orderedIds.length);
    assert.equal(decoded.batch.receiptCount, allocation.orderedIds.length);
    assert.deepEqual(decoded.orderedIds, allocation.orderedIds);
    assert.equal(decoded.runtimeAuthenticationVerified, false);
    assert.equal(decoded.activationReady, false);
    assert.equal(decoded.mainnetStatus, "HOLD");
  }
});

test("all five priority classes and all three dispositions decode in exact ordered membership", () => {
  const allocation = mixedClassFixture();
  const bundle = buildRewardAllocatorProofBundle({ roundState: allocation.roundState });
  const decoded = validateRewardAllocatorProofBundle({ roundState: allocation.roundState, bundle });
  assert.equal(decoded.batch.deploymentDomainSha256, REFERENCE_DEPLOYMENT_DOMAIN_SHA256);
  assert.deepEqual(decoded.orderedOutcomes.map(({ priorityClass }) => priorityClass), [
    "CCC_AGENT",
    "CCC_ASSOCIATE",
    "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
    "WEEKLY_FACTION",
    "CORE",
  ]);
  assert.deepEqual(decoded.receipts.map(({ disposition }) => disposition), [
    "ADMITTED_RESERVED",
    "ADMITTED_RESERVED",
    "ADMITTED_RESERVED",
    "NULL_UNDERFUNDED",
    "NULL_BLOCKED",
  ]);
  assert.deepEqual(decoded.receipts.map(({ allocationIndex }) => allocationIndex), [0, 1, 2, 3, 4]);
  assert.ok(bundle.receiptBytes.every((bytes) => bytes.length === ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH));
  assert.equal(decoded.receipts[3].factionPayoutDigest, allocation.nullOutcomes[0].payoutDigest);
});

test("a committed CCC tie reveal is required by both build and validation", () => {
  const randomnessHex = "ab".repeat(32);
  const sourceId = "slot-hashes-proof-bundle-round";
  const commitment = createCccRevealCommitment({
    sourceId,
    committedAtUnixSeconds: FUNDING_ROUND - 1n,
    fundingRoundAtUnixSeconds: FUNDING_ROUND,
    randomnessHex,
  });
  const reveal = { sourceId, randomnessHex };
  const allocation = finalizeRound({
    obligations: [
      cccObligation({ id: 20n, priorityClass: "CCC_AGENT", amount: 1n, activity: 1n, node: 1n, eligible: 1n }),
      cccObligation({ id: 21n, priorityClass: "CCC_AGENT", amount: 1n, activity: 1n, node: 1n, eligible: 1n }),
    ],
    boundaryLedger: ledger(2n),
    reveal,
    commitments: [commitment],
  });
  const bundle = buildRewardAllocatorProofBundle({
    roundState: allocation.roundState,
    cccRandomnessReveal: reveal,
  });
  assert.doesNotThrow(() => validateRewardAllocatorProofBundle({
    roundState: allocation.roundState,
    cccRandomnessReveal: reveal,
    bundle,
  }));
  assert.throws(() => validateRewardAllocatorProofBundle({
    roundState: allocation.roundState,
    cccRandomnessReveal: { ...reveal, randomnessHex: "cd".repeat(32) },
    bundle,
  }), /CCC_RANDOMNESS_REVEAL_DOES_NOT_MATCH_SEALED_COMMITMENT/u);
});

test("omission, duplicate, reorder, extra, batch tamper, and receipt tamper all fail closed", () => {
  const allocation = mixedClassFixture();
  const bundle = buildRewardAllocatorProofBundle({ roundState: allocation.roundState });
  const invalidBundles = [];

  const omitted = cloneBundle(bundle);
  omitted.receiptBytes.pop();
  invalidBundles.push(omitted);

  const duplicated = cloneBundle(bundle);
  duplicated.receiptBytes[1] = Buffer.from(duplicated.receiptBytes[0]);
  invalidBundles.push(duplicated);

  const reordered = cloneBundle(bundle);
  [reordered.receiptBytes[0], reordered.receiptBytes[1]] = [
    reordered.receiptBytes[1],
    reordered.receiptBytes[0],
  ];
  invalidBundles.push(reordered);

  const extra = cloneBundle(bundle);
  extra.receiptBytes.push(Buffer.from(extra.receiptBytes.at(-1)));
  invalidBundles.push(extra);

  const batchTamper = cloneBundle(bundle);
  batchTamper.batchBytes[184] ^= 0x01;
  invalidBundles.push(batchTamper);

  const receiptTamper = cloneBundle(bundle);
  receiptTamper.receiptBytes[0][152] ^= 0x01;
  invalidBundles.push(receiptTamper);

  for (const invalid of invalidBundles) {
    assert.throws(() => validateRewardAllocatorProofBundle({
      roundState: allocation.roundState,
      bundle: invalid,
    }));
  }
});

test("sparse receipt arrays cannot masquerade as complete one- or many-member bundles", () => {
  const allocations = [
    finalizeRound({
      obligations: [genericObligation({
        id: 30n,
        priorityClass: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
        amount: 1n,
        sequence: 1n,
      })],
      boundaryLedger: ledger(1n),
    }),
    mixedClassFixture(),
  ];
  for (const allocation of allocations) {
    const bundle = buildRewardAllocatorProofBundle({ roundState: allocation.roundState });
    const sparse = [];
    sparse.length = bundle.receiptBytes.length;
    assert.throws(() => validateRewardAllocatorProofBundle({
      roundState: allocation.roundState,
      bundle: { ...bundle, receiptBytes: sparse },
    }), /DENSE_AND_CONTIGUOUS/u);
  }
});

test("self-consistent invented binary decisions are rejected against the recomputed waterfall", () => {
  const allocation = mixedClassFixture();
  const valid = buildRewardAllocatorProofBundle({ roundState: allocation.roundState });
  const originalBatch = decodeAllocatorBatchCommitment(valid.batchBytes);
  const originalReceipts = valid.receiptBytes.map(decodeAllocatorReceiptEnvelope);
  const inventedReferenceDigest = hex32(9_999_999n);
  const inventedReferenceDigests = originalReceipts.map((receipt, index) => (
    index === 0 ? inventedReferenceDigest : receipt.referenceReceiptSha256
  ));
  const inventedFinalizationSha256 = hex32(8_888_888n);
  const inventedBatch = encodeAllocatorBatchCommitment({
    ...originalBatch,
    receiptSetSha256: canonicalReferenceSha256(inventedReferenceDigests),
    outcomeSha256: hex32(7_777_777n),
    referenceFinalizationSha256: inventedFinalizationSha256,
  });
  const inventedReceipts = originalReceipts.map((receipt, index) => encodeAllocatorReceiptEnvelope({
    ...receipt,
    batchCommitmentSha256: allocatorTranscriptSha256(inventedBatch),
    referenceFinalizationSha256: inventedFinalizationSha256,
    referenceReceiptSha256: inventedReferenceDigests[index],
    exactAmount: index === 0 ? receipt.exactAmount + 1n : receipt.exactAmount,
    plannedByLane: index === 0
      ? { ...receipt.plannedByLane, treasury: receipt.plannedByLane.treasury + 1n }
      : receipt.plannedByLane,
  }));
  assert.throws(() => validateRewardAllocatorProofBundle({
    roundState: allocation.roundState,
    bundle: {
      ...valid,
      batchBytes: inventedBatch,
      receiptBytes: inventedReceipts,
    },
  }), /BATCH_NOT_EXACT_RECOMPUTATION/u);
});

test("forged post-ledger, outcome, finalization, receipt set, and wrapper authority claims fail closed", () => {
  const allocation = mixedClassFixture();
  const bundle = buildRewardAllocatorProofBundle({ roundState: allocation.roundState });
  for (const key of ["postLedgerSha256", "outcomeSha256", "receiptSetSha256", "sealSha256"]) {
    const forgedRoundState = structuredClone(allocation.roundState);
    forgedRoundState.finalization[key] = "ff".repeat(32);
    assert.throws(() => validateRewardAllocatorProofBundle({
      roundState: forgedRoundState,
      bundle,
    }), /FINALIZATION_NOT_EXACT_RECOMPUTATION|INVALID_FINALIZED/u);
  }
  for (const patch of [
    { runtimeAuthenticationVerified: true },
    { activationReady: true },
    { mainnetStatus: "READY" },
    { unexpectedWriteAuthority: true },
  ]) {
    assert.throws(() => validateRewardAllocatorProofBundle({
      roundState: allocation.roundState,
      bundle: { ...bundle, ...patch },
    }), /INVALID_NON_ACTIVATING/u);
  }
});

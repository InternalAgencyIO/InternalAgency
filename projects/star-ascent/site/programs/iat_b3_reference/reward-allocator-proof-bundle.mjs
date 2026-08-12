import {
  ALLOCATOR_BATCH_TRANSCRIPT_LENGTH,
  ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH,
  REFERENCE_DEPLOYMENT_DOMAIN_SHA256,
  allocatorTranscriptSha256,
  decodeAllocatorBatchCommitment,
  decodeAllocatorReceiptEnvelope,
  encodeAllocatorBatchFromFinalizedRound,
  encodeAllocatorReceiptFromOutcome,
  validateAllocatorReceiptBinding,
} from "./reward-allocator-receipt-codec.mjs";
import { validateFinalizedRewardCapacityRound } from "./reward-capacity-waterfall.mjs";

export const REWARD_ALLOCATOR_PROOF_BUNDLE_SCHEMA = "iat-b3-reward-allocator-proof-bundle/v1";
export const REWARD_ALLOCATOR_PROOF_BUNDLE_STATUS = "FINALIZED_NON_ACTIVATING_REFERENCE_PROOF";

const BUNDLE_KEYS = Object.freeze([
  "schema",
  "status",
  "batchBytes",
  "receiptBytes",
  "runtimeAuthenticationVerified",
  "activationReady",
  "mainnetStatus",
]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  const canonical = [...expected].sort((left, right) => left.localeCompare(right, "en"));
  return JSON.stringify(actual) === JSON.stringify(canonical);
}

function asExactBytes(value, length, label) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new TypeError(`${label} must be bytes`);
  }
  const bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (bytes.length !== length) throw new RangeError(`${label} must be exactly ${length} bytes`);
  return bytes;
}

function deriveOrderedOutcomes(allocation) {
  const outcomes = [...allocation.funded, ...allocation.nullOutcomes];
  if (!Array.isArray(allocation.orderedIds)
    || allocation.orderedIds.length !== outcomes.length
    || new Set(allocation.orderedIds).size !== allocation.orderedIds.length
    || new Set(outcomes.map(({ id }) => id)).size !== outcomes.length) {
    throw new Error("FINALIZED_WATERFALL_ORDERED_OUTCOME_SET_INVALID");
  }
  const byId = new Map(outcomes.map((outcome) => [outcome.id, outcome]));
  const orderedOutcomes = allocation.orderedIds.map((id) => byId.get(id));
  if (orderedOutcomes.some((outcome) => outcome === undefined)
    || orderedOutcomes.some(({ id }, index) => id !== allocation.orderedIds[index])) {
    throw new Error("FINALIZED_WATERFALL_ORDERED_IDS_DO_NOT_COVER_OUTCOMES");
  }
  const receiptDigests = orderedOutcomes.map(({ allocatorReceipt }) => allocatorReceipt?.receiptSha256);
  if (new Set(receiptDigests).size !== receiptDigests.length
    || JSON.stringify(receiptDigests) !== JSON.stringify(allocation.finalization.receiptDigests)) {
    throw new Error("FINALIZED_WATERFALL_RECEIPT_MEMBERSHIP_NOT_CONTIGUOUS_UNIQUE");
  }
  return Object.freeze(orderedOutcomes);
}

function requireProofBundle(bundle) {
  if (!hasExactKeys(bundle, BUNDLE_KEYS)
    || bundle.schema !== REWARD_ALLOCATOR_PROOF_BUNDLE_SCHEMA
    || bundle.status !== REWARD_ALLOCATOR_PROOF_BUNDLE_STATUS
    || bundle.runtimeAuthenticationVerified !== false
    || bundle.activationReady !== false
    || bundle.mainnetStatus !== "HOLD"
    || !Array.isArray(bundle.receiptBytes)) {
    throw new Error("INVALID_NON_ACTIVATING_REWARD_ALLOCATOR_PROOF_BUNDLE");
  }
  return bundle;
}

/**
 * Build a nonactivating audit bundle from a finalized round. Allocation
 * indices are derived solely by walking the recomputed `orderedIds` array.
 */
export function buildRewardAllocatorProofBundle({
  roundState,
  cccRandomnessReveal = null,
} = {}) {
  const allocation = validateFinalizedRewardCapacityRound({
    roundState,
    cccRandomnessReveal,
  });
  const orderedOutcomes = deriveOrderedOutcomes(allocation);
  const batchBytes = encodeAllocatorBatchFromFinalizedRound(roundState);
  const receiptBytes = orderedOutcomes.map((outcome, allocationIndex) => (
    encodeAllocatorReceiptFromOutcome({ roundState, outcome, allocationIndex })
  ));
  const bundle = Object.freeze({
    schema: REWARD_ALLOCATOR_PROOF_BUNDLE_SCHEMA,
    status: REWARD_ALLOCATOR_PROOF_BUNDLE_STATUS,
    batchBytes,
    receiptBytes: Object.freeze(receiptBytes),
    runtimeAuthenticationVerified: false,
    activationReady: false,
    mainnetStatus: "HOLD",
  });
  validateRewardAllocatorProofBundle({
    roundState,
    cccRandomnessReveal,
    bundle,
  });
  return bundle;
}

/**
 * Validate the complete proof bundle against a fresh deterministic waterfall
 * recomputation. This is a read-only audit check, not persistence or runtime
 * authentication.
 */
export function validateRewardAllocatorProofBundle({
  roundState,
  cccRandomnessReveal = null,
  bundle,
} = {}) {
  const proof = requireProofBundle(bundle);
  const allocation = validateFinalizedRewardCapacityRound({
    roundState,
    cccRandomnessReveal,
  });
  const orderedOutcomes = deriveOrderedOutcomes(allocation);
  const batchBytes = asExactBytes(
    proof.batchBytes,
    ALLOCATOR_BATCH_TRANSCRIPT_LENGTH,
    "allocator proof bundle batch",
  );
  const expectedBatchBytes = encodeAllocatorBatchFromFinalizedRound(roundState);
  if (!batchBytes.equals(expectedBatchBytes)) {
    throw new Error("ALLOCATOR_PROOF_BUNDLE_BATCH_NOT_EXACT_RECOMPUTATION");
  }
  const batch = decodeAllocatorBatchCommitment(batchBytes);
  if (batch.deploymentDomainSha256 !== REFERENCE_DEPLOYMENT_DOMAIN_SHA256) {
    throw new Error("ALLOCATOR_PROOF_BUNDLE_PRODUCTION_DOMAIN_FORBIDDEN");
  }
  if (proof.receiptBytes.length !== orderedOutcomes.length
    || batch.receiptCount !== orderedOutcomes.length) {
    throw new Error("ALLOCATOR_PROOF_BUNDLE_REQUIRES_ONE_RECEIPT_PER_ORDERED_OUTCOME");
  }
  if (Array.from(
    { length: proof.receiptBytes.length },
    (_unused, index) => Object.hasOwn(proof.receiptBytes, index),
  ).some((present) => !present)) {
    throw new Error("ALLOCATOR_PROOF_BUNDLE_RECEIPTS_MUST_BE_DENSE_AND_CONTIGUOUS");
  }

  const decodedReceipts = Array.from(proof.receiptBytes, (value, allocationIndex) => {
    const receiptBytes = asExactBytes(
      value,
      ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH,
      `allocator proof bundle receipt ${allocationIndex}`,
    );
    const outcome = orderedOutcomes[allocationIndex];
    const expectedReceiptBytes = encodeAllocatorReceiptFromOutcome({
      roundState,
      outcome,
      allocationIndex,
    });
    if (!receiptBytes.equals(expectedReceiptBytes)) {
      throw new Error("ALLOCATOR_PROOF_BUNDLE_RECEIPT_NOT_EXACT_ORDERED_RECOMPUTATION");
    }
    const validated = validateAllocatorReceiptBinding({
      batchBytes,
      receiptBytes,
      referenceReceiptDigests: allocation.finalization.receiptDigests,
      referenceReceipt: outcome.allocatorReceipt,
    });
    if (validated.receipt.allocationIndex !== allocationIndex) {
      throw new Error("ALLOCATOR_PROOF_BUNDLE_RECEIPT_INDEX_NOT_CONTIGUOUS");
    }
    return decodeAllocatorReceiptEnvelope(receiptBytes);
  });
  if (new Set(decodedReceipts.map(({ referenceReceiptSha256 }) => referenceReceiptSha256)).size
      !== decodedReceipts.length
    || new Set(proof.receiptBytes.map(allocatorTranscriptSha256)).size !== proof.receiptBytes.length) {
    throw new Error("ALLOCATOR_PROOF_BUNDLE_DUPLICATE_RECEIPT_MEMBERSHIP");
  }

  return Object.freeze({
    schema: proof.schema,
    status: proof.status,
    orderedIds: Object.freeze([...allocation.orderedIds]),
    orderedOutcomes,
    batch,
    receipts: Object.freeze(decodedReceipts),
    runtimeAuthenticationVerified: false,
    activationReady: false,
    mainnetStatus: "HOLD",
  });
}

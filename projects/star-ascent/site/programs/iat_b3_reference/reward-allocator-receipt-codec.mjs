import { createHash } from "node:crypto";

export const ALLOCATOR_BATCH_TRANSCRIPT_LENGTH = 320;
export const ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH = 288;
export const REWARD_CAPACITY_POLICY_CANONICAL_SHA256 = "2054c881f9c7524acb965454286950445cd37c99f7485b45e2c787bcfb3617e2";
export const REFERENCE_DEPLOYMENT_DOMAIN_SHA256 = createHash("sha256")
  .update("IAT_B3_DEPLOYMENT_DOMAIN_UNFROZEN_V1", "utf8")
  .digest("hex");

const BATCH_MAGIC = Buffer.from("IATB3RCF", "ascii");
const RECEIPT_MAGIC = Buffer.from("IATB3ALR", "ascii");
const VERSION = 1;
const FINALIZED_NON_ACTIVATING = 1;
const NON_ACTIVATING_REFERENCE_RECEIPT = 1;
const SHA256_SUITE = 1;
const UTC_DAY_SECONDS = 86_400n;
const U64_MAX = (1n << 64n) - 1n;

export const ALLOCATOR_DISPOSITION = Object.freeze({
  ADMITTED_RESERVED: 1,
  NULL_UNDERFUNDED: 2,
  NULL_BLOCKED: 3,
});

export const ALLOCATOR_REASON = Object.freeze({
  NONE: 0,
  EXACT_AMOUNT_NOT_AVAILABLE: 1,
  HIGHER_PRIORITY_OR_EARLIER_OBLIGATION_UNDERFUNDED: 2,
});

const DISPOSITION_BY_CODE = invertEnum(ALLOCATOR_DISPOSITION);
const REASON_BY_CODE = invertEnum(ALLOCATOR_REASON);

function invertEnum(source) {
  return Object.freeze(Object.fromEntries(Object.entries(source).map(([key, value]) => [value, key])));
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function canonicalReferenceSha256(value) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value), (_key, entry) => (
      typeof entry === "bigint" ? entry.toString() : entry
    )))
    .digest("hex");
}

export function allocatorTranscriptSha256(bytes) {
  return createHash("sha256").update(asExactBytes(bytes, bytes?.length, "transcript")).digest("hex");
}

export function allocatorObligationIdSha256(obligationId) {
  if (typeof obligationId !== "string" || obligationId.length === 0) {
    throw new TypeError("obligationId must be a non-empty string");
  }
  return createHash("sha256").update(obligationId, "utf8").digest("hex");
}

function asInteger(value, label) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/u.test(value)) return BigInt(value);
  throw new TypeError(`${label} must be an integer`);
}

function asI64(value, label) {
  const normalized = asInteger(value, label);
  if (normalized < -(1n << 63n) || normalized > (1n << 63n) - 1n) {
    throw new RangeError(`${label} must fit i64`);
  }
  return normalized;
}

function asU64(value, label) {
  const normalized = asInteger(value, label);
  if (normalized < 0n || normalized > U64_MAX) throw new RangeError(`${label} must fit u64`);
  return normalized;
}

function asU32(value, label) {
  const normalized = asInteger(value, label);
  if (normalized < 0n || normalized > 0xffff_ffffn) throw new RangeError(`${label} must fit u32`);
  return Number(normalized);
}

function asMidnight(value, label) {
  const normalized = asI64(value, label);
  if (normalized % UTC_DAY_SECONDS !== 0n) throw new Error(`${label} must be exact 00:00 UTC`);
  return normalized;
}

function asHex32(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${label} must be lowercase 32-byte hexadecimal`);
  }
  return value;
}

function asExactBytes(value, length, label) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new TypeError(`${label} must be bytes`);
  }
  const bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (bytes.length !== length) throw new RangeError(`${label} must be exactly ${length} bytes`);
  return bytes;
}

function assertZero(bytes, start, end, label) {
  if (bytes.subarray(start, end).some((value) => value !== 0)) throw new Error(`${label} must be zero`);
}

function writeHex(bytes, offset, value, label) {
  Buffer.from(asHex32(value, label), "hex").copy(bytes, offset);
}

function readHex(bytes, offset) {
  return bytes.subarray(offset, offset + 32).toString("hex");
}

function checkedLanePlan(plannedByLane, disposition) {
  const source = plannedByLane ?? { treasury: 0n, ecosystem: 0n, liquidity: 0n };
  if (!isRecord(source)) throw new TypeError("plannedByLane must be an object or null");
  const treasury = asU64(source.treasury, "plannedByLane.treasury");
  const ecosystem = asU64(source.ecosystem, "plannedByLane.ecosystem");
  const liquidity = asU64(source.liquidity, "plannedByLane.liquidity");
  const sum = treasury + ecosystem + liquidity;
  if (sum > U64_MAX) throw new RangeError("planned lane sum must fit u64");
  if (disposition !== "ADMITTED_RESERVED" && sum !== 0n) {
    throw new Error("null allocator receipts must have a zero lane plan");
  }
  return Object.freeze({ treasury, ecosystem, liquidity, sum });
}

function validateDispositionReason(disposition, reason) {
  if (!Object.hasOwn(ALLOCATOR_DISPOSITION, disposition)) throw new Error("unsupported allocator disposition");
  const normalizedReason = reason ?? "NONE";
  if (!Object.hasOwn(ALLOCATOR_REASON, normalizedReason)) throw new Error("unsupported allocator reason");
  const valid = (disposition === "ADMITTED_RESERVED" && normalizedReason === "NONE")
    || (disposition === "NULL_UNDERFUNDED" && normalizedReason === "EXACT_AMOUNT_NOT_AVAILABLE")
    || (disposition === "NULL_BLOCKED"
      && normalizedReason === "HIGHER_PRIORITY_OR_EARLIER_OBLIGATION_UNDERFUNDED");
  if (!valid) throw new Error("allocator disposition/reason mismatch");
  return normalizedReason;
}

function copyAtomic(scratch, output, length, label) {
  if (output === undefined) return scratch;
  const target = asExactBytes(output, length, label);
  scratch.copy(target);
  return output;
}

export function encodeAllocatorBatchCommitment(input, output) {
  if (!isRecord(input)) throw new TypeError("batch transcript input is required");
  const fundingRound = asMidnight(input.fundingRoundAtUnixSeconds, "fundingRoundAtUnixSeconds");
  const receiptCount = asU32(input.receiptCount, "receiptCount");
  const policySha256 = asHex32(input.policySha256, "policySha256");
  const deploymentDomainSha256 = asHex32(input.deploymentDomainSha256, "deploymentDomainSha256");
  if (policySha256 !== REWARD_CAPACITY_POLICY_CANONICAL_SHA256) throw new Error("reward capacity policy digest drifted");
  if (deploymentDomainSha256 !== REFERENCE_DEPLOYMENT_DOMAIN_SHA256) {
    throw new Error("deployment domain must remain the unfrozen reference sentinel");
  }
  const scratch = Buffer.alloc(ALLOCATOR_BATCH_TRANSCRIPT_LENGTH);
  BATCH_MAGIC.copy(scratch, 0);
  scratch[8] = VERSION;
  scratch[9] = FINALIZED_NON_ACTIVATING;
  scratch[10] = SHA256_SUITE;
  writeHex(scratch, 16, policySha256, "policySha256");
  writeHex(scratch, 48, deploymentDomainSha256, "deploymentDomainSha256");
  scratch.writeBigInt64LE(fundingRound, 80);
  writeHex(scratch, 88, input.sealSha256, "sealSha256");
  writeHex(scratch, 120, input.candidateSetSha256, "candidateSetSha256");
  writeHex(scratch, 152, input.preLedgerSha256, "preLedgerSha256");
  writeHex(scratch, 184, input.postLedgerSha256, "postLedgerSha256");
  writeHex(scratch, 216, input.receiptSetSha256, "receiptSetSha256");
  writeHex(scratch, 248, input.outcomeSha256, "outcomeSha256");
  writeHex(scratch, 280, input.referenceFinalizationSha256, "referenceFinalizationSha256");
  scratch.writeUInt32LE(receiptCount, 312);
  return copyAtomic(scratch, output, ALLOCATOR_BATCH_TRANSCRIPT_LENGTH, "batch transcript output");
}

export function decodeAllocatorBatchCommitment(value) {
  const bytes = asExactBytes(value, ALLOCATOR_BATCH_TRANSCRIPT_LENGTH, "batch transcript");
  if (!bytes.subarray(0, 8).equals(BATCH_MAGIC)) throw new Error("wrong allocator batch magic");
  if (bytes[8] !== VERSION) throw new Error("unsupported allocator batch version");
  if (bytes[9] !== FINALIZED_NON_ACTIVATING) throw new Error("allocator batch is not finalized nonactivating");
  if (bytes[10] !== SHA256_SUITE) throw new Error("unsupported allocator batch hash suite");
  assertZero(bytes, 11, 16, "allocator batch header reserve");
  assertZero(bytes, 316, 320, "allocator batch tail reserve");
  const decoded = {
    policySha256: readHex(bytes, 16),
    deploymentDomainSha256: readHex(bytes, 48),
    fundingRoundAtUnixSeconds: asMidnight(bytes.readBigInt64LE(80), "fundingRoundAtUnixSeconds"),
    sealSha256: readHex(bytes, 88),
    candidateSetSha256: readHex(bytes, 120),
    preLedgerSha256: readHex(bytes, 152),
    postLedgerSha256: readHex(bytes, 184),
    receiptSetSha256: readHex(bytes, 216),
    outcomeSha256: readHex(bytes, 248),
    referenceFinalizationSha256: readHex(bytes, 280),
    receiptCount: bytes.readUInt32LE(312),
  };
  if (decoded.policySha256 !== REWARD_CAPACITY_POLICY_CANONICAL_SHA256) throw new Error("reward capacity policy digest drifted");
  if (decoded.deploymentDomainSha256 !== REFERENCE_DEPLOYMENT_DOMAIN_SHA256) {
    throw new Error("allocator batch deployment domain is not the reference sentinel");
  }
  return Object.freeze(decoded);
}

export function encodeAllocatorReceiptEnvelope(input, output) {
  if (!isRecord(input)) throw new TypeError("receipt transcript input is required");
  const disposition = input.disposition;
  const reason = validateDispositionReason(disposition, input.reason);
  const exactAmount = asU64(input.exactAmount, "exactAmount");
  if (exactAmount === 0n) throw new Error("allocator receipt amount must be positive");
  const lanes = checkedLanePlan(input.plannedByLane, disposition);
  if (disposition === "ADMITTED_RESERVED" && lanes.sum !== exactAmount) {
    throw new Error("admitted allocator receipt lane sum must equal exact amount");
  }
  const fundingRound = asMidnight(input.fundingRoundAtUnixSeconds, "fundingRoundAtUnixSeconds");
  const allocationIndex = asU32(input.allocationIndex, "allocationIndex");
  const factionPresent = input.factionPayoutDigest !== null && input.factionPayoutDigest !== undefined;
  const factionDigest = factionPresent
    ? asHex32(input.factionPayoutDigest, "factionPayoutDigest")
    : "00".repeat(32);
  if (factionPresent && factionDigest === "00".repeat(32)) throw new Error("present faction digest cannot be zero");
  const scratch = Buffer.alloc(ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH);
  RECEIPT_MAGIC.copy(scratch, 0);
  scratch[8] = VERSION;
  scratch[9] = NON_ACTIVATING_REFERENCE_RECEIPT;
  scratch[10] = SHA256_SUITE;
  writeHex(scratch, 16, input.batchCommitmentSha256, "batchCommitmentSha256");
  scratch.writeBigInt64LE(fundingRound, 48);
  writeHex(scratch, 56, input.sealSha256, "sealSha256");
  writeHex(scratch, 88, input.referenceFinalizationSha256, "referenceFinalizationSha256");
  writeHex(scratch, 120, input.obligationIdSha256, "obligationIdSha256");
  writeHex(scratch, 152, input.obligationSha256, "obligationSha256");
  scratch.writeBigUInt64LE(exactAmount, 184);
  scratch.writeBigUInt64LE(lanes.treasury, 192);
  scratch.writeBigUInt64LE(lanes.ecosystem, 200);
  scratch.writeBigUInt64LE(lanes.liquidity, 208);
  writeHex(scratch, 216, input.referenceReceiptSha256, "referenceReceiptSha256");
  writeHex(scratch, 248, factionDigest, "factionPayoutDigest");
  scratch[280] = ALLOCATOR_DISPOSITION[disposition];
  scratch[281] = ALLOCATOR_REASON[reason];
  scratch[282] = factionPresent ? 1 : 0;
  scratch.writeUInt32LE(allocationIndex, 284);
  return copyAtomic(scratch, output, ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH, "receipt transcript output");
}

export function decodeAllocatorReceiptEnvelope(value) {
  const bytes = asExactBytes(value, ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH, "receipt transcript");
  if (!bytes.subarray(0, 8).equals(RECEIPT_MAGIC)) throw new Error("wrong allocator receipt magic");
  if (bytes[8] !== VERSION) throw new Error("unsupported allocator receipt version");
  if (bytes[9] !== NON_ACTIVATING_REFERENCE_RECEIPT) throw new Error("allocator receipt is not nonactivating");
  if (bytes[10] !== SHA256_SUITE) throw new Error("unsupported allocator receipt hash suite");
  assertZero(bytes, 11, 16, "allocator receipt header reserve");
  if (bytes[283] !== 0) throw new Error("allocator receipt reserve must be zero");
  const disposition = DISPOSITION_BY_CODE[bytes[280]];
  const reason = REASON_BY_CODE[bytes[281]];
  if (!disposition || !reason) throw new Error("unsupported allocator receipt enum");
  if (bytes[282] !== 0 && bytes[282] !== 1) throw new Error("allocator receipt faction flag must be canonical");
  validateDispositionReason(disposition, reason);
  const exactAmount = bytes.readBigUInt64LE(184);
  if (exactAmount === 0n) throw new Error("allocator receipt amount must be positive");
  const plannedByLane = Object.freeze({
    treasury: bytes.readBigUInt64LE(192),
    ecosystem: bytes.readBigUInt64LE(200),
    liquidity: bytes.readBigUInt64LE(208),
  });
  const lanes = checkedLanePlan(plannedByLane, disposition);
  if (disposition === "ADMITTED_RESERVED" && lanes.sum !== exactAmount) {
    throw new Error("admitted allocator receipt lane sum must equal exact amount");
  }
  const factionHex = readHex(bytes, 248);
  const factionPresent = bytes[282] === 1;
  if ((!factionPresent && factionHex !== "00".repeat(32))
    || (factionPresent && factionHex === "00".repeat(32))) {
    throw new Error("allocator receipt faction presence mismatch");
  }
  return Object.freeze({
    batchCommitmentSha256: readHex(bytes, 16),
    fundingRoundAtUnixSeconds: asMidnight(bytes.readBigInt64LE(48), "fundingRoundAtUnixSeconds"),
    sealSha256: readHex(bytes, 56),
    referenceFinalizationSha256: readHex(bytes, 88),
    obligationIdSha256: readHex(bytes, 120),
    obligationSha256: readHex(bytes, 152),
    exactAmount,
    plannedByLane,
    referenceReceiptSha256: readHex(bytes, 216),
    factionPayoutDigest: factionPresent ? factionHex : null,
    disposition,
    reason,
    allocationIndex: bytes.readUInt32LE(284),
  });
}

function requireFinalizedRoundState(roundState) {
  if (!isRecord(roundState)
    || roundState.status !== "FINALIZED_NON_ACTIVATING"
    || !isRecord(roundState.roundSeal)
    || !isRecord(roundState.finalization)
    || roundState.roundSeal.status !== "SEALED_NON_ACTIVATING"
    || roundState.roundSeal.finalized !== false
    || roundState.finalization.status !== "FINALIZED_NON_ACTIVATING"
    || roundState.finalization.finalized !== true
    || roundState.finalization.activationReady !== false
    || !Array.isArray(roundState.finalization.receiptDigests)
    || roundState.finalization.fundingRoundAtUnixSeconds !== roundState.roundSeal.fundingRoundAtUnixSeconds) {
    throw new Error("finalized nonactivating allocator round state is required");
  }
  return roundState;
}

export function encodeAllocatorBatchFromFinalizedRound(roundState, output) {
  const state = requireFinalizedRoundState(roundState);
  const { roundSeal, finalization } = state;
  const receiptSetSha256 = canonicalReferenceSha256(finalization.receiptDigests);
  if (receiptSetSha256 !== finalization.receiptSetSha256) throw new Error("reference receipt-set digest mismatch");
  const sealSha256 = canonicalReferenceSha256(roundSeal);
  if (sealSha256 !== finalization.sealSha256) throw new Error("reference seal digest mismatch");
  if (roundSeal.candidateSetSha256 !== canonicalReferenceSha256(roundSeal.candidates)) {
    throw new Error("reference candidate-set digest mismatch");
  }
  if (roundSeal.ledgerSnapshotSha256 !== canonicalReferenceSha256(roundSeal.ledgerSnapshot)) {
    throw new Error("reference pre-ledger digest mismatch");
  }
  if (finalization.preLedgerSha256 !== roundSeal.ledgerSnapshotSha256
    || finalization.receiptDigests.length !== roundSeal.candidateCount) {
    throw new Error("reference finalization does not match the sealed candidate and ledger snapshots");
  }
  return encodeAllocatorBatchCommitment({
    policySha256: REWARD_CAPACITY_POLICY_CANONICAL_SHA256,
    deploymentDomainSha256: REFERENCE_DEPLOYMENT_DOMAIN_SHA256,
    fundingRoundAtUnixSeconds: finalization.fundingRoundAtUnixSeconds,
    sealSha256,
    candidateSetSha256: roundSeal.candidateSetSha256,
    preLedgerSha256: finalization.preLedgerSha256,
    postLedgerSha256: finalization.postLedgerSha256,
    receiptSetSha256,
    outcomeSha256: finalization.outcomeSha256,
    referenceFinalizationSha256: canonicalReferenceSha256(finalization),
    receiptCount: finalization.receiptDigests.length,
  }, output);
}

function requireReferenceReceipt(outcome) {
  if (!isRecord(outcome) || !isRecord(outcome.allocatorReceipt)) {
    throw new Error("allocator outcome with reference receipt is required");
  }
  const receipt = outcome.allocatorReceipt;
  const { receiptSha256, ...core } = receipt;
  if (canonicalReferenceSha256(core) !== receiptSha256) throw new Error("reference allocator receipt digest mismatch");
  if (receipt.obligationId !== outcome.id
    || receipt.obligationSha256 !== canonicalReferenceSha256(
      Object.fromEntries(Object.entries(outcome).filter(([key]) => !["allocatorReceipt", "disposition", "reason", "plannedByLane"].includes(key))),
    )) {
    throw new Error("reference allocator receipt obligation mismatch");
  }
  return receipt;
}

export function encodeAllocatorReceiptFromOutcome({ roundState, outcome, allocationIndex }, output) {
  const state = requireFinalizedRoundState(roundState);
  const batchBytes = encodeAllocatorBatchFromFinalizedRound(state);
  const batch = decodeAllocatorBatchCommitment(batchBytes);
  const receipt = requireReferenceReceipt(outcome);
  const index = asU32(allocationIndex, "allocationIndex");
  if (index >= state.finalization.receiptDigests.length
    || state.finalization.receiptDigests[index] !== receipt.receiptSha256
    || state.finalization.receiptDigests.filter((digest) => digest === receipt.receiptSha256).length !== 1) {
    throw new Error("reference allocator receipt is not a unique member at allocationIndex");
  }
  if (receipt.fundingRoundAtUnixSeconds !== batch.fundingRoundAtUnixSeconds
    || receipt.sealSha256 !== batch.sealSha256) {
    throw new Error("reference allocator receipt does not bind the finalized batch");
  }
  const scratch = encodeAllocatorReceiptEnvelope({
    batchCommitmentSha256: allocatorTranscriptSha256(batchBytes),
    fundingRoundAtUnixSeconds: receipt.fundingRoundAtUnixSeconds,
    sealSha256: receipt.sealSha256,
    referenceFinalizationSha256: batch.referenceFinalizationSha256,
    obligationIdSha256: allocatorObligationIdSha256(receipt.obligationId),
    obligationSha256: receipt.obligationSha256,
    exactAmount: receipt.exactAmount,
    plannedByLane: receipt.plannedByLane,
    referenceReceiptSha256: receipt.receiptSha256,
    factionPayoutDigest: receipt.factionPayoutDigest,
    disposition: receipt.disposition,
    reason: receipt.reason,
    allocationIndex: index,
  });
  validateAllocatorReceiptBinding({
    batchBytes,
    receiptBytes: scratch,
    referenceReceiptDigests: state.finalization.receiptDigests,
    referenceReceipt: receipt,
  });
  return copyAtomic(scratch, output, ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH, "receipt transcript output");
}

export function validateAllocatorReceiptBinding({
  batchBytes,
  receiptBytes,
  referenceReceiptDigests,
  referenceReceipt,
}) {
  const batch = decodeAllocatorBatchCommitment(batchBytes);
  const receipt = decodeAllocatorReceiptEnvelope(receiptBytes);
  if (!Array.isArray(referenceReceiptDigests)
    || referenceReceiptDigests.length !== batch.receiptCount
    || canonicalReferenceSha256(referenceReceiptDigests) !== batch.receiptSetSha256) {
    throw new Error("ordered reference receipt set does not match the batch");
  }
  if (receipt.allocationIndex >= referenceReceiptDigests.length
    || referenceReceiptDigests[receipt.allocationIndex] !== receipt.referenceReceiptSha256
    || referenceReceiptDigests.filter((digest) => digest === receipt.referenceReceiptSha256).length !== 1) {
    throw new Error("receipt is not a unique ordered member of the batch");
  }
  if (receipt.batchCommitmentSha256 !== allocatorTranscriptSha256(batchBytes)
    || receipt.fundingRoundAtUnixSeconds !== batch.fundingRoundAtUnixSeconds
    || receipt.sealSha256 !== batch.sealSha256
    || receipt.referenceFinalizationSha256 !== batch.referenceFinalizationSha256) {
    throw new Error("receipt envelope does not bind the exact finalized batch");
  }
  if (!isRecord(referenceReceipt)) throw new Error("reference receipt is required");
  const { receiptSha256, ...core } = referenceReceipt;
  if (canonicalReferenceSha256(core) !== receiptSha256
    || receipt.referenceReceiptSha256 !== receiptSha256
    || receipt.fundingRoundAtUnixSeconds !== asI64(referenceReceipt.fundingRoundAtUnixSeconds, "reference funding round")
    || receipt.sealSha256 !== referenceReceipt.sealSha256
    || receipt.obligationIdSha256 !== allocatorObligationIdSha256(referenceReceipt.obligationId)
    || receipt.obligationSha256 !== referenceReceipt.obligationSha256
    || receipt.exactAmount !== asU64(referenceReceipt.exactAmount, "reference exact amount")
    || receipt.disposition !== referenceReceipt.disposition
    || receipt.reason !== (referenceReceipt.reason ?? "NONE")
    || receipt.factionPayoutDigest !== (referenceReceipt.factionPayoutDigest ?? null)) {
    throw new Error("receipt envelope does not match its reference decision");
  }
  const referenceLanes = checkedLanePlan(referenceReceipt.plannedByLane, referenceReceipt.disposition);
  if (receipt.plannedByLane.treasury !== referenceLanes.treasury
    || receipt.plannedByLane.ecosystem !== referenceLanes.ecosystem
    || receipt.plannedByLane.liquidity !== referenceLanes.liquidity) {
    throw new Error("receipt envelope lane plan does not match its reference decision");
  }
  return Object.freeze({ batch, receipt });
}

export function deriveAllocatorReceiptLineage({ roundState, outcome, allocationIndex }) {
  const batchBytes = encodeAllocatorBatchFromFinalizedRound(roundState);
  const receiptBytes = encodeAllocatorReceiptFromOutcome({ roundState, outcome, allocationIndex });
  return Object.freeze({
    allocationIndex: asU32(allocationIndex, "allocationIndex"),
    referenceReceiptSha256: outcome.allocatorReceipt.receiptSha256,
    referenceFinalizationSha256: canonicalReferenceSha256(roundState.finalization),
    batchCommitmentSha256: allocatorTranscriptSha256(batchBytes),
    binaryReceiptSha256: allocatorTranscriptSha256(receiptBytes),
  });
}

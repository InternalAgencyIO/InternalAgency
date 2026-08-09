import { createHash } from "node:crypto";

import {
  REWARD_LANE_ORDER,
  allocateRewardCapacity,
  recordPremiumUpgrade,
  validateXBoundRewardReferenceState,
} from "./reward-capacity-waterfall.mjs";
import {
  buildRewardAllocatorProofBundle,
  validateRewardAllocatorProofBundle,
} from "./reward-allocator-proof-bundle.mjs";
import {
  ALLOCATOR_BATCH_TRANSCRIPT_LENGTH,
  ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH,
  REFERENCE_DEPLOYMENT_DOMAIN_SHA256,
  allocatorTranscriptSha256,
  decodeAllocatorBatchCommitment,
} from "./reward-allocator-receipt-codec.mjs";
import { assertDailyLawWriteAllowed } from "./daily-lockdown-consensus.mjs";

export const REWARD_CAS_HEAD_SCHEMA = "iat-b3-reward-cas-head/v1";
export const REWARD_CAS_ENTITY_SCHEMA = "iat-b3-reward-cas-entity/v1";
export const REWARD_CAS_COMMIT_SCHEMA = "iat-b3-reward-cas-commit/v1";
export const REWARD_ROUND_CONSUMPTION_SCHEMA = "iat-b3-reward-round-consumption/v1";
export const REWARD_ROUND_PROOF_SCHEMA = "iat-b3-reward-round-proof/v1";
export const X_PREMIUM_UPGRADE_ATTEMPT_SCHEMA = "iat-b3-x-premium-upgrade-attempt/v1";
export const REWARD_CAS_STATUS = "NON_ACTIVATING_UNAUTHENTICATED_REFERENCE";
export const REWARD_CAS_MAINNET_STATUS = "HOLD";
export const REWARD_CAS_GLOBAL_LEDGER_KEY = "GLOBAL_SHARED_REWARD_RESERVE";
export const REWARD_CAS_ZERO_SHA256 = "0".repeat(64);

export const REWARD_CAS_ENTITY_KIND = Object.freeze({
  LANE_LEDGER: "LANE_LEDGER",
  ROUND: "ROUND",
  X_REWARD: "X_REWARD",
});

export const REWARD_CAS_OPERATION = Object.freeze({
  FINALIZE_ROUND: "FINALIZE_REWARD_CAPACITY_ROUND",
  RECORD_PREMIUM_UPGRADE: "RECORD_X_PREMIUM_UPGRADE",
});

const U64_MAX = (1n << 64n) - 1n;
const I64_MIN = -(1n << 63n);
const I64_MAX = (1n << 63n) - 1n;
const UTC_DAY_SECONDS = 86_400n;
const STATE_DIGEST_DOMAIN = Buffer.from("IAT_B3_REWARD_CAS_STATE_V1\0", "utf8");
const PROOF_BUNDLE_DIGEST_DOMAIN = Buffer.from("IAT_B3_ALLOCATOR_PROOF_BUNDLE_V1\0", "utf8");
const ACCEPTED_ENTITY_KINDS = new Set(Object.values(REWARD_CAS_ENTITY_KIND));
const ACCEPTED_OPERATIONS = new Set(Object.values(REWARD_CAS_OPERATION));

export const REWARD_CAS_STORE_ADAPTER = Symbol("IAT_B3_REWARD_CAS_STORE_ADAPTER_V1");

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  return JSON.stringify(actual) === JSON.stringify(canonical);
}

function asCanonicalHex32(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new TypeError(`${label} must be canonical lowercase 32-byte hexadecimal`);
  }
  return value;
}

function asStoredU64(value, label) {
  if (typeof value !== "bigint" || value < 0n || value > U64_MAX) {
    throw new TypeError(`${label} must be stored as a u64 bigint`);
  }
  return value;
}

function asStoredI64(value, label) {
  if (typeof value !== "bigint" || value < I64_MIN || value > I64_MAX) {
    throw new TypeError(`${label} must be stored as an i64 bigint`);
  }
  return value;
}

function asRevision(value, label) {
  const revision = asStoredU64(value, label);
  if (revision === U64_MAX) throw new RangeError(`${label} cannot increment past u64`);
  return revision;
}

function asFundingRound(value, label = "funding round") {
  const round = asStoredI64(value, label);
  if ((round % UTC_DAY_SECONDS + UTC_DAY_SECONDS) % UTC_DAY_SECONDS !== 0n) {
    throw new RangeError(`${label} must be exact 00:00 UTC`);
  }
  return round;
}

function clone(value) {
  return structuredClone(value);
}

function deepFreezeRecord(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return value;
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor && Object.hasOwn(descriptor, "value")) deepFreezeRecord(descriptor.value, seen);
  }
  return Object.freeze(value);
}

function ownIndexedDataValues(value, { includesLength, label }) {
  const keys = Reflect.ownKeys(value);
  const expectedKeyCount = value.length + (includesLength ? 1 : 0);
  if (keys.length !== expectedKeyCount) {
    throw new TypeError(`${label} must be dense and cannot have extra properties`);
  }
  for (let index = 0; index < value.length; index += 1) {
    if (keys[index] !== String(index)) {
      throw new TypeError(`${label} must be dense and cannot have extra properties`);
    }
  }
  if (includesLength && keys[value.length] !== "length") {
    throw new TypeError(`${label} must be dense and cannot have extra properties`);
  }
  return Array.from({ length: value.length }, (_unused, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
      throw new TypeError(`${label} requires enumerable data elements`);
    }
    return descriptor.value;
  });
}

function typedNode(value, ancestors) {
  if (value === null) return ["null"];
  if (typeof value === "boolean") return ["boolean", value];
  if (typeof value === "string") return ["string", value];
  if (typeof value === "bigint") return ["bigint", value.toString()];
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError("typed CAS values permit canonical safe integers only");
    }
    return ["number", value.toString()];
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const expectedPrototype = Buffer.isBuffer(value) ? Buffer.prototype : Uint8Array.prototype;
    if (Object.getPrototypeOf(value) !== expectedPrototype) {
      throw new TypeError("typed CAS byte views require a canonical Buffer or Uint8Array prototype");
    }
    ownIndexedDataValues(value, { includesLength: false, label: "typed CAS byte views" });
    return ["bytes", Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("hex")];
  }
  if (typeof value !== "object") throw new TypeError("unsupported typed CAS value");
  if (ancestors.has(value)) throw new TypeError("cyclic typed CAS value");
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      throw new TypeError("typed CAS arrays require the canonical Array prototype");
    }
    const values = ownIndexedDataValues(value, { includesLength: true, label: "typed CAS arrays" });
    ancestors.add(value);
    try {
      return ["array", values.map((entry) => typedNode(entry, ancestors))];
    } finally {
      ancestors.delete(value);
    }
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("typed CAS objects must be plain records");
  }
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) {
    throw new TypeError("typed CAS objects cannot contain symbol keys");
  }
  const descriptors = new Map();
  for (const key of ownKeys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) {
      throw new TypeError("typed CAS objects require enumerable data properties");
    }
    descriptors.set(key, descriptor);
  }
  ancestors.add(value);
  try {
    const entries = ownKeys
      .sort()
      .map((key) => [key, typedNode(descriptors.get(key).value, ancestors)]);
    return ["object", entries];
  } finally {
    ancestors.delete(value);
  }
}

function decodeTypedNode(node) {
  if (!Array.isArray(node) || typeof node[0] !== "string") {
    throw new TypeError("invalid typed CAS node");
  }
  const [tag, payload] = node;
  if (tag === "null" && node.length === 1) return null;
  if (tag === "boolean" && node.length === 2 && typeof payload === "boolean") return payload;
  if (tag === "string" && node.length === 2 && typeof payload === "string") return payload;
  if (tag === "bigint" && node.length === 2 && typeof payload === "string" && /^-?(0|[1-9]\d*)$/u.test(payload)) {
    return BigInt(payload);
  }
  if (tag === "number" && node.length === 2 && typeof payload === "string" && /^-?(0|[1-9]\d*)$/u.test(payload)) {
    const number = Number(payload);
    if (!Number.isSafeInteger(number)) throw new TypeError("typed CAS number exceeds safe integer range");
    return number;
  }
  if (tag === "bytes" && node.length === 2 && typeof payload === "string" && /^(?:[0-9a-f]{2})*$/u.test(payload)) {
    return Buffer.from(payload, "hex");
  }
  if (tag === "array" && node.length === 2 && Array.isArray(payload)) {
    return payload.map(decodeTypedNode);
  }
  if (tag === "object" && node.length === 2 && Array.isArray(payload)) {
    const result = {};
    let previous = null;
    for (const entry of payload) {
      if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string") {
        throw new TypeError("invalid typed CAS object entry");
      }
      const [key, encoded] = entry;
      if ((previous !== null && previous >= key) || Object.hasOwn(result, key)) {
        throw new TypeError("typed CAS object keys must be unique and sorted");
      }
      Object.defineProperty(result, key, {
        value: decodeTypedNode(encoded),
        enumerable: true,
        configurable: true,
        writable: true,
      });
      previous = key;
    }
    return result;
  }
  throw new TypeError("invalid typed CAS tag or payload");
}

export function encodeRewardCasTypedValue(value) {
  return Buffer.from(JSON.stringify(typedNode(value, new Set())), "utf8");
}

export function decodeRewardCasTypedValue(value) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new TypeError("typed CAS payload must be bytes");
  }
  const bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new TypeError("typed CAS payload must be canonical JSON bytes");
  }
  const decoded = decodeTypedNode(parsed);
  if (!encodeRewardCasTypedValue(decoded).equals(bytes)) {
    throw new TypeError("typed CAS payload is not canonical");
  }
  return decoded;
}

export function rewardCasStateSha256(value) {
  return createHash("sha256")
    .update(STATE_DIGEST_DOMAIN)
    .update(encodeRewardCasTypedValue(value))
    .digest("hex");
}

function asExactBytes(value, length, label) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) {
    throw new TypeError(`${label} must be bytes`);
  }
  const bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (bytes.length !== length) throw new RangeError(`${label} must be exactly ${length} bytes`);
  return bytes;
}

export function rewardAllocatorProofBundleSha256(bundle) {
  if (!isRecord(bundle) || !Array.isArray(bundle.receiptBytes)) {
    throw new TypeError("allocator proof bundle is required");
  }
  if (bundle.receiptBytes.length > 0xffff_ffff) throw new RangeError("allocator proof receipt count exceeds u32");
  const count = Buffer.alloc(4);
  count.writeUInt32LE(bundle.receiptBytes.length, 0);
  const hash = createHash("sha256")
    .update(PROOF_BUNDLE_DIGEST_DOMAIN)
    .update(count)
    .update(asExactBytes(bundle.batchBytes, ALLOCATOR_BATCH_TRANSCRIPT_LENGTH, "allocator proof batch"));
  for (const [index, receipt] of bundle.receiptBytes.entries()) {
    hash.update(asExactBytes(receipt, ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH, `allocator proof receipt ${index}`));
  }
  return hash.digest("hex");
}

function validateLaneLedger(ledger) {
  if (!hasExactKeys(ledger, ["lanes"]) || !hasExactKeys(ledger.lanes, REWARD_LANE_ORDER)) {
    throw new Error("INVALID_REWARD_CAS_LANE_LEDGER");
  }
  for (const lane of REWARD_LANE_ORDER) {
    const state = ledger.lanes[lane];
    if (!hasExactKeys(state, ["unlocked", "reserved", "paid", "withdrawn"])) {
      throw new Error("INVALID_REWARD_CAS_LANE_LEDGER");
    }
    const unlocked = asStoredU64(state.unlocked, `${lane}.unlocked`);
    const reserved = asStoredU64(state.reserved, `${lane}.reserved`);
    const paid = asStoredU64(state.paid, `${lane}.paid`);
    const withdrawn = asStoredU64(state.withdrawn, `${lane}.withdrawn`);
    if (reserved + paid + withdrawn > unlocked) throw new Error("INVALID_REWARD_CAS_LANE_ACCOUNTING");
  }
  return ledger;
}

function entityKey(kind, key) {
  if (!ACCEPTED_ENTITY_KINDS.has(kind) || typeof key !== "string" || key.length === 0) {
    throw new TypeError("invalid reward CAS entity kind or key");
  }
  return `${kind}\u0000${key}`;
}

export function rewardCasRoundKey(fundingRoundAtUnixSeconds) {
  return asFundingRound(fundingRoundAtUnixSeconds).toString();
}

export function createRewardCasEntityRecord({ entityKind, entityKey: key, revision, value }) {
  if (!ACCEPTED_ENTITY_KINDS.has(entityKind)) throw new Error("UNKNOWN_REWARD_CAS_ENTITY_KIND");
  const storedRevision = asStoredU64(revision, "entity revision");
  if (typeof key !== "string" || key.length === 0) throw new TypeError("entity key is required");
  const storedValue = clone(value);
  if (entityKind === REWARD_CAS_ENTITY_KIND.LANE_LEDGER) {
    if (key !== REWARD_CAS_GLOBAL_LEDGER_KEY) throw new Error("INVALID_REWARD_CAS_LEDGER_KEY");
    validateLaneLedger(storedValue);
  } else if (entityKind === REWARD_CAS_ENTITY_KIND.ROUND) {
    const round = asFundingRound(storedValue?.roundSeal?.fundingRoundAtUnixSeconds, "stored round funding boundary");
    if (key !== round.toString()) throw new Error("REWARD_CAS_ROUND_KEY_MISMATCH");
  } else {
    validateXBoundRewardReferenceState(storedValue);
    if (key !== storedValue.rewardId) throw new Error("REWARD_CAS_REWARD_KEY_MISMATCH");
  }
  return deepFreezeRecord({
    schema: REWARD_CAS_ENTITY_SCHEMA,
    status: REWARD_CAS_STATUS,
    entityKind,
    entityKey: key,
    revision: storedRevision,
    stateSha256: rewardCasStateSha256(storedValue),
    value: storedValue,
    runtimeAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_CAS_MAINNET_STATUS,
  });
}

function validateEntityRecord(record, expectedKind, expectedKey) {
  if (!hasExactKeys(record, [
    "schema", "status", "entityKind", "entityKey", "revision", "stateSha256", "value",
    "runtimeAuthenticationVerified", "rollbackProtectionVerified", "activationReady", "mainnetStatus",
  ])
    || record.schema !== REWARD_CAS_ENTITY_SCHEMA
    || record.status !== REWARD_CAS_STATUS
    || record.entityKind !== expectedKind
    || record.entityKey !== expectedKey
    || record.runtimeAuthenticationVerified !== false
    || record.rollbackProtectionVerified !== false
    || record.activationReady !== false
    || record.mainnetStatus !== REWARD_CAS_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_CAS_ENTITY_RECORD");
  }
  asStoredU64(record.revision, "stored entity revision");
  if (asCanonicalHex32(record.stateSha256, "stored entity digest") !== rewardCasStateSha256(record.value)) {
    throw new Error("REWARD_CAS_ENTITY_DIGEST_MISMATCH");
  }
  return record;
}

function assertExpectedEntity(record, expectedRevision, expectedSha256, label) {
  const revision = asRevision(expectedRevision, `${label} expected revision`);
  const digest = asCanonicalHex32(expectedSha256, `${label} expected digest`);
  if (record.revision !== revision || record.stateSha256 !== digest) {
    throw new Error("REWARD_CAS_STALE_VERSION_OR_DIGEST");
  }
}

export function createInitialRewardCasHead() {
  return Object.freeze({
    schema: REWARD_CAS_HEAD_SCHEMA,
    status: REWARD_CAS_STATUS,
    deploymentDomainSha256: REFERENCE_DEPLOYMENT_DOMAIN_SHA256,
    commitSequence: 0n,
    headCommitSha256: REWARD_CAS_ZERO_SHA256,
    runtimeAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_CAS_MAINNET_STATUS,
  });
}

export function validateRewardCasHead(head) {
  if (!hasExactKeys(head, [
    "schema", "status", "deploymentDomainSha256", "commitSequence", "headCommitSha256",
    "runtimeAuthenticationVerified", "rollbackProtectionVerified", "activationReady", "mainnetStatus",
  ])
    || head.schema !== REWARD_CAS_HEAD_SCHEMA
    || head.status !== REWARD_CAS_STATUS
    || head.deploymentDomainSha256 !== REFERENCE_DEPLOYMENT_DOMAIN_SHA256
    || head.runtimeAuthenticationVerified !== false
    || head.rollbackProtectionVerified !== false
    || head.activationReady !== false
    || head.mainnetStatus !== REWARD_CAS_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_CAS_HEAD");
  }
  asRevision(head.commitSequence, "CAS head commit sequence");
  asCanonicalHex32(head.headCommitSha256, "CAS head commit digest");
  if ((head.commitSequence === 0n) !== (head.headCommitSha256 === REWARD_CAS_ZERO_SHA256)) {
    throw new Error("INVALID_REWARD_CAS_GENESIS_HEAD");
  }
  return head;
}

function canonicalChanges(changes) {
  if (!Array.isArray(changes) || changes.length === 0) throw new Error("REWARD_CAS_COMMIT_REQUIRES_CHANGES");
  const normalized = changes.map((change) => {
    if (!hasExactKeys(change, [
      "entityKind", "entityKey", "expectedRevision", "expectedStateSha256", "nextRevision", "nextStateSha256",
    ])) throw new Error("INVALID_REWARD_CAS_CHANGE");
    if (!ACCEPTED_ENTITY_KINDS.has(change.entityKind) || typeof change.entityKey !== "string" || !change.entityKey) {
      throw new Error("INVALID_REWARD_CAS_CHANGE_KEY");
    }
    const expectedRevision = asStoredU64(change.expectedRevision, "change expected revision");
    const nextRevision = asStoredU64(change.nextRevision, "change next revision");
    if (nextRevision !== expectedRevision + 1n) throw new Error("REWARD_CAS_REVISION_MUST_INCREMENT_ONCE");
    return {
      entityKind: change.entityKind,
      entityKey: change.entityKey,
      expectedRevision,
      expectedStateSha256: asCanonicalHex32(change.expectedStateSha256, "change expected digest"),
      nextRevision,
      nextStateSha256: asCanonicalHex32(change.nextStateSha256, "change next digest"),
    };
  }).sort((left, right) => (
    left.entityKind.localeCompare(right.entityKind) || left.entityKey.localeCompare(right.entityKey)
  ));
  if (new Set(normalized.map(({ entityKind, entityKey: key }) => entityKey(entityKind, key))).size !== normalized.length) {
    throw new Error("DUPLICATE_REWARD_CAS_CHANGE_KEY");
  }
  return normalized;
}

export function createRewardCasCommit(input) {
  const acceptedDailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
  const { head, operation, changes, evidenceSha256 } = input;
  validateRewardCasHead(head);
  if (!ACCEPTED_OPERATIONS.has(operation)) throw new Error("UNKNOWN_REWARD_CAS_OPERATION");
  const sequence = head.commitSequence + 1n;
  asStoredU64(sequence, "next CAS commit sequence");
  const core = {
    schema: REWARD_CAS_COMMIT_SCHEMA,
    status: REWARD_CAS_STATUS,
    deploymentDomainSha256: REFERENCE_DEPLOYMENT_DOMAIN_SHA256,
    sequence,
    previousCommitSha256: head.headCommitSha256,
    operation,
    changes: canonicalChanges(changes),
    evidenceSha256: asCanonicalHex32(evidenceSha256, "CAS commit evidence digest"),
    dailyLawReferenceStateSha256: rewardCasStateSha256(acceptedDailyLawState),
    runtimeAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_CAS_MAINNET_STATUS,
  };
  const commitSha256 = rewardCasStateSha256(core);
  const commit = deepFreezeRecord({ ...core, commitSha256 });
  const nextHead = Object.freeze({
    ...head,
    commitSequence: sequence,
    headCommitSha256: commitSha256,
  });
  return Object.freeze({ commit, nextHead });
}

export function validateRewardCasCommit(commit, {
  expectedSequence = null,
  expectedPreviousCommitSha256 = null,
} = {}) {
  if (!hasExactKeys(commit, [
    "schema", "status", "deploymentDomainSha256", "sequence", "previousCommitSha256",
    "operation", "changes", "evidenceSha256", "dailyLawReferenceStateSha256",
    "runtimeAuthenticationVerified", "rollbackProtectionVerified", "activationReady",
    "mainnetStatus", "commitSha256",
  ])
    || commit.schema !== REWARD_CAS_COMMIT_SCHEMA
    || commit.status !== REWARD_CAS_STATUS
    || commit.deploymentDomainSha256 !== REFERENCE_DEPLOYMENT_DOMAIN_SHA256
    || !ACCEPTED_OPERATIONS.has(commit.operation)
    || commit.runtimeAuthenticationVerified !== false
    || commit.rollbackProtectionVerified !== false
    || commit.activationReady !== false
    || commit.mainnetStatus !== REWARD_CAS_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_CAS_COMMIT");
  }
  const sequence = asStoredU64(commit.sequence, "commit sequence");
  if (sequence === 0n) throw new Error("REWARD_CAS_COMMIT_SEQUENCE_MUST_BE_POSITIVE");
  const previous = asCanonicalHex32(commit.previousCommitSha256, "previous commit digest");
  if (expectedSequence !== null && sequence !== asStoredU64(expectedSequence, "expected commit sequence")) {
    throw new Error("REWARD_CAS_COMMIT_SEQUENCE_GAP");
  }
  if (expectedPreviousCommitSha256 !== null
    && previous !== asCanonicalHex32(expectedPreviousCommitSha256, "expected previous commit digest")) {
    throw new Error("REWARD_CAS_COMMIT_CHAIN_MISMATCH");
  }
  const changes = canonicalChanges(commit.changes);
  if (!encodeRewardCasTypedValue(changes).equals(encodeRewardCasTypedValue(commit.changes))) {
    throw new Error("REWARD_CAS_COMMIT_CHANGES_NOT_CANONICAL");
  }
  const atomicShapeIsValid = commit.operation === REWARD_CAS_OPERATION.FINALIZE_ROUND
    ? changes.length === 2
      && changes.some(({ entityKind, entityKey: key }) => (
        entityKind === REWARD_CAS_ENTITY_KIND.LANE_LEDGER
        && key === REWARD_CAS_GLOBAL_LEDGER_KEY
      ))
      && changes.filter(({ entityKind }) => entityKind === REWARD_CAS_ENTITY_KIND.ROUND).length === 1
    : changes.length === 1 && changes[0].entityKind === REWARD_CAS_ENTITY_KIND.X_REWARD;
  if (!atomicShapeIsValid) throw new Error("REWARD_CAS_COMMIT_ATOMIC_CHANGE_SET_INVALID");
  const core = {
    schema: commit.schema,
    status: commit.status,
    deploymentDomainSha256: commit.deploymentDomainSha256,
    sequence,
    previousCommitSha256: previous,
    operation: commit.operation,
    changes,
    evidenceSha256: asCanonicalHex32(commit.evidenceSha256, "commit evidence digest"),
    dailyLawReferenceStateSha256: asCanonicalHex32(
      commit.dailyLawReferenceStateSha256,
      "commit Daily-Law digest",
    ),
    runtimeAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_CAS_MAINNET_STATUS,
  };
  const digest = rewardCasStateSha256(core);
  if (asCanonicalHex32(commit.commitSha256, "commit digest") !== digest) {
    throw new Error("REWARD_CAS_COMMIT_DIGEST_MISMATCH");
  }
  return commit;
}

function changeFor(before, after) {
  return Object.freeze({
    entityKind: before.entityKind,
    entityKey: before.entityKey,
    expectedRevision: before.revision,
    expectedStateSha256: before.stateSha256,
    nextRevision: after.revision,
    nextStateSha256: after.stateSha256,
  });
}

export function prepareRewardRoundFinalizationCas(input) {
  const acceptedDailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
  const {
    roundRecord,
    ledgerRecord,
    fundingRoundAtUnixSeconds,
    expectedRoundRevision,
    expectedRoundSha256,
    expectedLedgerRevision,
    expectedLedgerSha256,
    cccRandomnessReveal = null,
  } = input;
  const fundingRound = asFundingRound(fundingRoundAtUnixSeconds);
  const roundKey = fundingRound.toString();
  validateEntityRecord(roundRecord, REWARD_CAS_ENTITY_KIND.ROUND, roundKey);
  validateEntityRecord(ledgerRecord, REWARD_CAS_ENTITY_KIND.LANE_LEDGER, REWARD_CAS_GLOBAL_LEDGER_KEY);
  assertExpectedEntity(roundRecord, expectedRoundRevision, expectedRoundSha256, "round");
  assertExpectedEntity(ledgerRecord, expectedLedgerRevision, expectedLedgerSha256, "lane ledger");
  if (roundRecord.value.status !== "SEALED_PENDING_FINALIZATION" || roundRecord.value.finalization !== null) {
    throw new Error("REWARD_CAS_ROUND_NOT_PENDING");
  }
  if (rewardCasStateSha256(roundRecord.value.roundSeal.ledgerSnapshot) !== ledgerRecord.stateSha256) {
    throw new Error("REWARD_CAS_SEALED_LEDGER_SNAPSHOT_STALE");
  }
  const allocation = allocateRewardCapacity({
    dailyLawState: acceptedDailyLawState,
    roundState: clone(roundRecord.value),
    cccRandomnessReveal,
  });
  const proofBundle = buildRewardAllocatorProofBundle({
    roundState: allocation.roundState,
    cccRandomnessReveal,
  });
  validateRewardAllocatorProofBundle({
    roundState: allocation.roundState,
    cccRandomnessReveal,
    bundle: proofBundle,
  });
  const nextRoundRecord = createRewardCasEntityRecord({
    entityKind: REWARD_CAS_ENTITY_KIND.ROUND,
    entityKey: roundKey,
    revision: roundRecord.revision + 1n,
    value: allocation.roundState,
  });
  const nextLedgerRecord = createRewardCasEntityRecord({
    entityKind: REWARD_CAS_ENTITY_KIND.LANE_LEDGER,
    entityKey: REWARD_CAS_GLOBAL_LEDGER_KEY,
    revision: ledgerRecord.revision + 1n,
    value: allocation.ledger,
  });
  const batch = decodeAllocatorBatchCommitment(proofBundle.batchBytes);
  const proofBundleSha256 = rewardAllocatorProofBundleSha256(proofBundle);
  const consumptionCore = {
    schema: REWARD_ROUND_CONSUMPTION_SCHEMA,
    status: REWARD_CAS_STATUS,
    fundingRoundAtUnixSeconds: fundingRound,
    fromRoundStateSha256: roundRecord.stateSha256,
    toRoundStateSha256: nextRoundRecord.stateSha256,
    preLedgerStateSha256: ledgerRecord.stateSha256,
    postLedgerStateSha256: nextLedgerRecord.stateSha256,
    allocatorBatchSha256: allocatorTranscriptSha256(proofBundle.batchBytes),
    referenceFinalizationSha256: batch.referenceFinalizationSha256,
    proofBundleSha256,
    receiptCount: proofBundle.receiptBytes.length,
    runtimeAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_CAS_MAINNET_STATUS,
  };
  const roundConsumption = Object.freeze({
    ...consumptionCore,
    consumptionSha256: rewardCasStateSha256(consumptionCore),
  });
  return Object.freeze({
    nextRoundRecord,
    nextLedgerRecord,
    proofBundle,
    roundConsumption,
    evidenceSha256: proofBundleSha256,
    changes: Object.freeze([
      changeFor(roundRecord, nextRoundRecord),
      changeFor(ledgerRecord, nextLedgerRecord),
    ]),
  });
}

function createRoundProofRecord({ prepared, commit, cccRandomnessReveal }) {
  const core = {
    schema: REWARD_ROUND_PROOF_SCHEMA,
    status: REWARD_CAS_STATUS,
    fundingRoundAtUnixSeconds: prepared.roundConsumption.fundingRoundAtUnixSeconds,
    finalizedRoundStateSha256: prepared.nextRoundRecord.stateSha256,
    proofBundleSha256: prepared.evidenceSha256,
    cccRandomnessReveal: clone(cccRandomnessReveal),
    proofBundle: clone(prepared.proofBundle),
    commitSha256: commit.commitSha256,
    runtimeAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_CAS_MAINNET_STATUS,
  };
  return deepFreezeRecord({
    ...core,
    proofRecordSha256: rewardCasStateSha256(core),
  });
}

function validateRoundProofRecord(record, roundRecord) {
  if (!hasExactKeys(record, [
    "schema", "status", "fundingRoundAtUnixSeconds", "finalizedRoundStateSha256",
    "proofBundleSha256", "cccRandomnessReveal", "proofBundle", "commitSha256",
    "runtimeAuthenticationVerified", "rollbackProtectionVerified", "activationReady",
    "mainnetStatus", "proofRecordSha256",
  ])
    || record.schema !== REWARD_ROUND_PROOF_SCHEMA
    || record.status !== REWARD_CAS_STATUS
    || record.runtimeAuthenticationVerified !== false
    || record.rollbackProtectionVerified !== false
    || record.activationReady !== false
    || record.mainnetStatus !== REWARD_CAS_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_CAS_ROUND_PROOF_RECORD");
  }
  const fundingRound = asFundingRound(record.fundingRoundAtUnixSeconds, "proof funding round");
  validateEntityRecord(roundRecord, REWARD_CAS_ENTITY_KIND.ROUND, fundingRound.toString());
  if (record.finalizedRoundStateSha256 !== roundRecord.stateSha256) {
    throw new Error("REWARD_CAS_PROOF_ROUND_DIGEST_MISMATCH");
  }
  if (asCanonicalHex32(record.proofBundleSha256, "proof bundle digest")
    !== rewardAllocatorProofBundleSha256(record.proofBundle)) {
    throw new Error("REWARD_CAS_PROOF_BUNDLE_DIGEST_MISMATCH");
  }
  validateRewardAllocatorProofBundle({
    roundState: roundRecord.value,
    cccRandomnessReveal: record.cccRandomnessReveal,
    bundle: record.proofBundle,
  });
  asCanonicalHex32(record.commitSha256, "proof commit digest");
  const core = { ...record };
  delete core.proofRecordSha256;
  if (asCanonicalHex32(record.proofRecordSha256, "proof record digest") !== rewardCasStateSha256(core)) {
    throw new Error("REWARD_CAS_PROOF_RECORD_DIGEST_MISMATCH");
  }
  return record;
}

export function preparePremiumUpgradeCas(input) {
  const acceptedDailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
  const {
    rewardRecord,
    rewardId,
    expectedRewardRevision,
    expectedRewardSha256,
    subscriptionType,
    subscriptionObservedAtUnixSeconds,
    premiumProofAcceptedAtUnixSeconds,
    premiumProofAcceptedSequence,
    premiumEvidenceSha256,
  } = input;
  const canonicalRewardId = asCanonicalHex32(rewardId, "rewardId");
  validateEntityRecord(rewardRecord, REWARD_CAS_ENTITY_KIND.X_REWARD, canonicalRewardId);
  assertExpectedEntity(rewardRecord, expectedRewardRevision, expectedRewardSha256, "reward");
  const evidenceDigest = asCanonicalHex32(premiumEvidenceSha256, "premium evidence digest");
  const nextReward = recordPremiumUpgrade({
    dailyLawState: acceptedDailyLawState,
    reward: clone(rewardRecord.value),
    wallet: rewardRecord.value.wallet,
    xUserId: rewardRecord.value.xUserId,
    subscriptionType,
    subscriptionObservedAtUnixSeconds,
    premiumProofAcceptedAtUnixSeconds,
    premiumProofAcceptedSequence,
  });
  const nextRewardRecord = createRewardCasEntityRecord({
    entityKind: REWARD_CAS_ENTITY_KIND.X_REWARD,
    entityKey: canonicalRewardId,
    revision: rewardRecord.revision + 1n,
    value: nextReward,
  });
  const attemptCore = {
    schema: X_PREMIUM_UPGRADE_ATTEMPT_SCHEMA,
    status: REWARD_CAS_STATUS,
    rewardId: canonicalRewardId,
    baseAdmissionLineageSha256: rewardCasStateSha256(rewardRecord.value.originalBaseAdmissionLineage),
    fromRewardRevision: rewardRecord.revision,
    fromRewardStateSha256: rewardRecord.stateSha256,
    toRewardRevision: nextRewardRecord.revision,
    toRewardStateSha256: nextRewardRecord.stateSha256,
    subscriptionType,
    subscriptionObservedAtUnixSeconds: asStoredI64(
      subscriptionObservedAtUnixSeconds,
      "subscriptionObservedAtUnixSeconds",
    ),
    premiumProofAcceptedAtUnixSeconds: asStoredI64(
      premiumProofAcceptedAtUnixSeconds,
      "premiumProofAcceptedAtUnixSeconds",
    ),
    premiumProofAcceptedSequence: asStoredU64(
      premiumProofAcceptedSequence,
      "premiumProofAcceptedSequence",
    ),
    premiumEvidenceSha256: evidenceDigest,
    authenticated: false,
    runtimeAuthenticationVerified: false,
    rollbackProtectionVerified: false,
    activationReady: false,
    mainnetStatus: REWARD_CAS_MAINNET_STATUS,
  };
  const upgradeAttempt = Object.freeze({
    ...attemptCore,
    attemptSha256: rewardCasStateSha256(attemptCore),
  });
  return Object.freeze({
    nextRewardRecord,
    upgradeAttempt,
    evidenceSha256: upgradeAttempt.attemptSha256,
    changes: Object.freeze([changeFor(rewardRecord, nextRewardRecord)]),
  });
}

function normalizeInitialState(initialState) {
  if (!hasExactKeys(initialState, ["laneLedger", "roundStates", "rewardStates"])
    || !Array.isArray(initialState.roundStates)
    || !Array.isArray(initialState.rewardStates)) {
    throw new Error("INVALID_REWARD_CAS_INITIAL_FIXTURE_STATE");
  }
  const records = [];
  records.push(createRewardCasEntityRecord({
    entityKind: REWARD_CAS_ENTITY_KIND.LANE_LEDGER,
    entityKey: REWARD_CAS_GLOBAL_LEDGER_KEY,
    revision: 0n,
    value: initialState.laneLedger,
  }));
  for (const roundState of initialState.roundStates) {
    if (!hasExactKeys(roundState, ["schema", "status", "roundSeal", "finalization"])
      || roundState.status !== "SEALED_PENDING_FINALIZATION"
      || roundState.finalization !== null) {
      throw new Error("REWARD_CAS_INITIAL_ROUND_MUST_BE_PENDING_FINALIZATION");
    }
    records.push(createRewardCasEntityRecord({
      entityKind: REWARD_CAS_ENTITY_KIND.ROUND,
      entityKey: rewardCasRoundKey(roundState?.roundSeal?.fundingRoundAtUnixSeconds),
      revision: 0n,
      value: roundState,
    }));
  }
  for (const rewardState of initialState.rewardStates) {
    validateXBoundRewardReferenceState(rewardState);
    records.push(createRewardCasEntityRecord({
      entityKind: REWARD_CAS_ENTITY_KIND.X_REWARD,
      entityKey: rewardState.rewardId,
      revision: 0n,
      value: rewardState,
    }));
  }
  if (new Set(records.map(({ entityKind, entityKey: key }) => entityKey(entityKind, key))).size !== records.length) {
    throw new Error("DUPLICATE_REWARD_CAS_INITIAL_ENTITY");
  }
  return records;
}

export function createRewardCasFixtureRecords(initialState) {
  return normalizeInitialState(clone(initialState)).map((record) => clone(record));
}

function snapshotFromMemory(store) {
  return {
    head: clone(store.head),
    entities: [...store.entities.values()].map(clone)
      .sort((left, right) => left.entityKind.localeCompare(right.entityKind)
        || left.entityKey.localeCompare(right.entityKey)),
    commits: store.commits.map(clone),
    roundConsumptions: [...store.roundConsumptions.values()].map(clone),
    roundProofs: [...store.roundProofs.values()].map(clone),
    upgradeAttempts: [...store.upgradeAttempts.values()].map(clone),
  };
}

function validateRoundConsumption(record) {
  if (!hasExactKeys(record, [
    "schema", "status", "fundingRoundAtUnixSeconds", "fromRoundStateSha256",
    "toRoundStateSha256", "preLedgerStateSha256", "postLedgerStateSha256",
    "allocatorBatchSha256", "referenceFinalizationSha256", "proofBundleSha256",
    "receiptCount", "runtimeAuthenticationVerified", "rollbackProtectionVerified",
    "activationReady", "mainnetStatus", "consumptionSha256", "commitSha256",
  ])
    || record.schema !== REWARD_ROUND_CONSUMPTION_SCHEMA
    || record.status !== REWARD_CAS_STATUS
    || !Number.isSafeInteger(record.receiptCount)
    || record.receiptCount < 0
    || record.runtimeAuthenticationVerified !== false
    || record.rollbackProtectionVerified !== false
    || record.activationReady !== false
    || record.mainnetStatus !== REWARD_CAS_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_CAS_ROUND_CONSUMPTION");
  }
  asFundingRound(record.fundingRoundAtUnixSeconds, "consumption funding round");
  for (const [label, digest] of [
    ["consumption from-round digest", record.fromRoundStateSha256],
    ["consumption to-round digest", record.toRoundStateSha256],
    ["consumption pre-ledger digest", record.preLedgerStateSha256],
    ["consumption post-ledger digest", record.postLedgerStateSha256],
    ["consumption allocator batch digest", record.allocatorBatchSha256],
    ["consumption finalization digest", record.referenceFinalizationSha256],
    ["consumption proof bundle digest", record.proofBundleSha256],
    ["consumption commit digest", record.commitSha256],
  ]) asCanonicalHex32(digest, label);
  const core = { ...record };
  delete core.consumptionSha256;
  delete core.commitSha256;
  if (asCanonicalHex32(record.consumptionSha256, "consumption digest") !== rewardCasStateSha256(core)) {
    throw new Error("REWARD_CAS_ROUND_CONSUMPTION_DIGEST_MISMATCH");
  }
  return record;
}

function validateUpgradeAttempt(record) {
  if (!hasExactKeys(record, [
    "schema", "status", "rewardId", "baseAdmissionLineageSha256", "fromRewardRevision",
    "fromRewardStateSha256", "toRewardRevision", "toRewardStateSha256", "subscriptionType",
    "subscriptionObservedAtUnixSeconds", "premiumProofAcceptedAtUnixSeconds",
    "premiumProofAcceptedSequence", "premiumEvidenceSha256", "authenticated",
    "runtimeAuthenticationVerified", "rollbackProtectionVerified", "activationReady",
    "mainnetStatus", "attemptSha256", "commitSha256",
  ])
    || record.schema !== X_PREMIUM_UPGRADE_ATTEMPT_SCHEMA
    || record.status !== REWARD_CAS_STATUS
    || record.authenticated !== false
    || record.runtimeAuthenticationVerified !== false
    || record.rollbackProtectionVerified !== false
    || record.activationReady !== false
    || record.mainnetStatus !== REWARD_CAS_MAINNET_STATUS) {
    throw new Error("INVALID_REWARD_CAS_UPGRADE_ATTEMPT");
  }
  asCanonicalHex32(record.rewardId, "upgrade reward ID");
  asStoredU64(record.fromRewardRevision, "upgrade from revision");
  asStoredU64(record.toRewardRevision, "upgrade to revision");
  if (record.toRewardRevision !== record.fromRewardRevision + 1n) {
    throw new Error("REWARD_CAS_UPGRADE_REVISION_MUST_INCREMENT_ONCE");
  }
  for (const [label, digest] of [
    ["upgrade lineage digest", record.baseAdmissionLineageSha256],
    ["upgrade from-state digest", record.fromRewardStateSha256],
    ["upgrade to-state digest", record.toRewardStateSha256],
    ["upgrade evidence digest", record.premiumEvidenceSha256],
    ["upgrade commit digest", record.commitSha256],
  ]) asCanonicalHex32(digest, label);
  asStoredI64(record.subscriptionObservedAtUnixSeconds, "upgrade observed at");
  asStoredI64(record.premiumProofAcceptedAtUnixSeconds, "upgrade accepted at");
  asStoredU64(record.premiumProofAcceptedSequence, "upgrade proof sequence");
  const core = { ...record };
  delete core.attemptSha256;
  delete core.commitSha256;
  if (asCanonicalHex32(record.attemptSha256, "upgrade attempt digest") !== rewardCasStateSha256(core)) {
    throw new Error("REWARD_CAS_UPGRADE_ATTEMPT_DIGEST_MISMATCH");
  }
  return record;
}

export function validateRewardCasSnapshot(snapshot) {
  if (!hasExactKeys(snapshot, [
    "head", "entities", "commits", "roundConsumptions", "roundProofs", "upgradeAttempts",
  ])) throw new Error("INVALID_REWARD_CAS_SNAPSHOT");
  validateRewardCasHead(snapshot.head);
  const entities = ownIndexedDataValues(snapshot.entities, {
    includesLength: true,
    label: "reward CAS snapshot entities",
  });
  const commits = ownIndexedDataValues(snapshot.commits, {
    includesLength: true,
    label: "reward CAS snapshot commits",
  });
  const consumptions = ownIndexedDataValues(snapshot.roundConsumptions, {
    includesLength: true,
    label: "reward CAS snapshot round consumptions",
  });
  const proofs = ownIndexedDataValues(snapshot.roundProofs, {
    includesLength: true,
    label: "reward CAS snapshot round proofs",
  });
  const attempts = ownIndexedDataValues(snapshot.upgradeAttempts, {
    includesLength: true,
    label: "reward CAS snapshot upgrade attempts",
  });
  const entitiesByKey = new Map();
  for (const record of entities) {
    const key = entityKey(record?.entityKind, record?.entityKey);
    if (entitiesByKey.has(key)) throw new Error("DUPLICATE_REWARD_CAS_SNAPSHOT_ENTITY");
    validateEntityRecord(record, record.entityKind, record.entityKey);
    if (record.entityKind === REWARD_CAS_ENTITY_KIND.LANE_LEDGER) validateLaneLedger(record.value);
    if (record.entityKind === REWARD_CAS_ENTITY_KIND.X_REWARD) validateXBoundRewardReferenceState(record.value);
    entitiesByKey.set(key, record);
  }
  let previous = REWARD_CAS_ZERO_SHA256;
  let latestFinalizedFundingRound = null;
  const commitsByDigest = new Map();
  const latestChangeByEntity = new Map();
  for (const [index, commit] of commits.entries()) {
    validateRewardCasCommit(commit, {
      expectedSequence: BigInt(index + 1),
      expectedPreviousCommitSha256: previous,
    });
    if (commit.operation === REWARD_CAS_OPERATION.FINALIZE_ROUND) {
      const roundChange = commit.changes.find(({ entityKind }) => entityKind === REWARD_CAS_ENTITY_KIND.ROUND);
      let fundingRound;
      try {
        fundingRound = asFundingRound(BigInt(roundChange.entityKey), "commit funding round");
      } catch {
        throw new Error("REWARD_CAS_COMMIT_ROUND_KEY_INVALID");
      }
      if (roundChange.entityKey !== fundingRound.toString()
        || (latestFinalizedFundingRound !== null && fundingRound <= latestFinalizedFundingRound)) {
        throw new Error("REWARD_CAS_FINALIZATION_COMMITS_MUST_BE_STRICTLY_ASCENDING_BY_ROUND");
      }
      latestFinalizedFundingRound = fundingRound;
    }
    for (const change of commit.changes) {
      const key = entityKey(change.entityKind, change.entityKey);
      const prior = latestChangeByEntity.get(key);
      if ((!prior && change.expectedRevision !== 0n)
        || (prior && (change.expectedRevision !== prior.nextRevision
          || change.expectedStateSha256 !== prior.nextStateSha256))) {
        throw new Error("REWARD_CAS_ENTITY_CHANGE_CHAIN_MISMATCH");
      }
      latestChangeByEntity.set(key, change);
    }
    commitsByDigest.set(commit.commitSha256, commit);
    previous = commit.commitSha256;
  }
  if (snapshot.head.commitSequence !== BigInt(commits.length)
    || snapshot.head.headCommitSha256 !== previous) {
    throw new Error("REWARD_CAS_HEAD_DOES_NOT_MATCH_COMMIT_CHAIN");
  }
  if (latestFinalizedFundingRound !== null && entities.some((record) => (
    record.entityKind === REWARD_CAS_ENTITY_KIND.ROUND
    && record.value.status === "SEALED_PENDING_FINALIZATION"
    && BigInt(record.entityKey) < latestFinalizedFundingRound
  ))) throw new Error("REWARD_CAS_FINALIZED_ROUND_LEAPFROGS_EARLIER_PENDING_ROUND");
  for (const [key, change] of latestChangeByEntity) {
    const entity = entitiesByKey.get(key);
    if (!entity || entity.revision !== change.nextRevision || entity.stateSha256 !== change.nextStateSha256) {
      throw new Error("REWARD_CAS_ENTITY_HEAD_DOES_NOT_MATCH_CHANGE_CHAIN");
    }
  }
  for (const [key, entity] of entitiesByKey) {
    if (!latestChangeByEntity.has(key) && entity.revision !== 0n) {
      throw new Error("REWARD_CAS_UNTRACKED_ENTITY_REVISION");
    }
  }
  const consumptionsByRound = new Map();
  const consumptionsByCommit = new Map();
  for (const consumption of consumptions) {
    validateRoundConsumption(consumption);
    const key = rewardCasRoundKey(consumption.fundingRoundAtUnixSeconds);
    if (consumptionsByRound.has(key)) throw new Error("DUPLICATE_REWARD_CAS_ROUND_CONSUMPTION");
    const commit = commitsByDigest.get(consumption.commitSha256);
    if (!commit || commit.operation !== REWARD_CAS_OPERATION.FINALIZE_ROUND
      || commit.evidenceSha256 !== consumption.proofBundleSha256) {
      throw new Error("REWARD_CAS_CONSUMPTION_COMMIT_BINDING_MISMATCH");
    }
    if (consumptionsByCommit.has(consumption.commitSha256)) {
      throw new Error("DUPLICATE_REWARD_CAS_CONSUMPTION_COMMIT_BINDING");
    }
    const roundChange = commit.changes.find(({ entityKind, entityKey: candidateKey }) => (
      entityKind === REWARD_CAS_ENTITY_KIND.ROUND && candidateKey === key
    ));
    const ledgerChange = commit.changes.find(({ entityKind, entityKey: candidateKey }) => (
      entityKind === REWARD_CAS_ENTITY_KIND.LANE_LEDGER
      && candidateKey === REWARD_CAS_GLOBAL_LEDGER_KEY
    ));
    if (!roundChange || !ledgerChange
      || roundChange.expectedStateSha256 !== consumption.fromRoundStateSha256
      || roundChange.nextStateSha256 !== consumption.toRoundStateSha256
      || ledgerChange.expectedStateSha256 !== consumption.preLedgerStateSha256
      || ledgerChange.nextStateSha256 !== consumption.postLedgerStateSha256) {
      throw new Error("REWARD_CAS_CONSUMPTION_CHANGE_SET_BINDING_MISMATCH");
    }
    consumptionsByRound.set(key, consumption);
    consumptionsByCommit.set(consumption.commitSha256, consumption);
  }
  const proofsByRound = new Map();
  const proofsByCommit = new Map();
  for (const proof of proofs) {
    const key = rewardCasRoundKey(proof?.fundingRoundAtUnixSeconds);
    if (proofsByRound.has(key)) throw new Error("DUPLICATE_REWARD_CAS_ROUND_PROOF");
    const round = entitiesByKey.get(entityKey(REWARD_CAS_ENTITY_KIND.ROUND, key));
    if (!round) throw new Error("REWARD_CAS_PROOF_ROUND_MISSING");
    validateRoundProofRecord(proof, round);
    const consumption = consumptionsByRound.get(key);
    const batch = decodeAllocatorBatchCommitment(proof.proofBundle.batchBytes);
    if (!consumption
      || proof.proofBundleSha256 !== consumption.proofBundleSha256
      || proof.commitSha256 !== consumption.commitSha256
      || proof.finalizedRoundStateSha256 !== consumption.toRoundStateSha256
      || proof.proofBundle.receiptBytes.length !== consumption.receiptCount
      || allocatorTranscriptSha256(proof.proofBundle.batchBytes) !== consumption.allocatorBatchSha256
      || batch.referenceFinalizationSha256 !== consumption.referenceFinalizationSha256) {
      throw new Error("REWARD_CAS_PROOF_CONSUMPTION_BINDING_MISMATCH");
    }
    if (proofsByCommit.has(proof.commitSha256)) {
      throw new Error("DUPLICATE_REWARD_CAS_PROOF_COMMIT_BINDING");
    }
    proofsByRound.set(key, proof);
    proofsByCommit.set(proof.commitSha256, proof);
  }
  if (proofsByRound.size !== consumptionsByRound.size) {
    throw new Error("REWARD_CAS_ROUND_PROOF_SET_INCOMPLETE");
  }
  const attemptsByReward = new Map();
  const attemptsByCommit = new Map();
  for (const attempt of attempts) {
    validateUpgradeAttempt(attempt);
    if (attemptsByReward.has(attempt.rewardId)) throw new Error("DUPLICATE_REWARD_CAS_UPGRADE_ATTEMPT");
    const commit = commitsByDigest.get(attempt.commitSha256);
    if (!commit || commit.operation !== REWARD_CAS_OPERATION.RECORD_PREMIUM_UPGRADE
      || commit.evidenceSha256 !== attempt.attemptSha256) {
      throw new Error("REWARD_CAS_UPGRADE_COMMIT_BINDING_MISMATCH");
    }
    const [change] = commit.changes;
    if (change.entityKey !== attempt.rewardId
      || change.expectedRevision !== attempt.fromRewardRevision
      || change.expectedStateSha256 !== attempt.fromRewardStateSha256
      || change.nextRevision !== attempt.toRewardRevision
      || change.nextStateSha256 !== attempt.toRewardStateSha256) {
      throw new Error("REWARD_CAS_UPGRADE_CHANGE_SET_BINDING_MISMATCH");
    }
    const reward = entitiesByKey.get(entityKey(REWARD_CAS_ENTITY_KIND.X_REWARD, attempt.rewardId));
    if (!reward) throw new Error("REWARD_CAS_UPGRADE_REWARD_MISSING");
    if (attemptsByCommit.has(attempt.commitSha256)) {
      throw new Error("DUPLICATE_REWARD_CAS_UPGRADE_COMMIT_BINDING");
    }
    attemptsByReward.set(attempt.rewardId, attempt);
    attemptsByCommit.set(attempt.commitSha256, attempt);
  }
  for (const commit of commits) {
    if (commit.operation === REWARD_CAS_OPERATION.FINALIZE_ROUND
      && (!consumptionsByCommit.has(commit.commitSha256)
        || !proofsByCommit.has(commit.commitSha256))) {
      throw new Error("REWARD_CAS_FINALIZE_COMMIT_REQUIRES_CONSUMPTION_AND_PROOF");
    }
    if (commit.operation === REWARD_CAS_OPERATION.RECORD_PREMIUM_UPGRADE
      && !attemptsByCommit.has(commit.commitSha256)) {
      throw new Error("REWARD_CAS_UPGRADE_COMMIT_REQUIRES_ATTEMPT");
    }
  }
  return snapshot;
}

export function createInMemoryRewardPersistenceCas({ initialState, testOnlyFault = null }) {
  if (testOnlyFault !== null && !new Set([
    "AFTER_MARKER", "AFTER_PROOF", "AFTER_FIRST_ENTITY", "BEFORE_HEAD",
  ]).has(testOnlyFault)) throw new Error("UNKNOWN_TEST_ONLY_REWARD_CAS_FAULT");
  const state = {
    head: createInitialRewardCasHead(),
    entities: new Map(),
    commits: [],
    roundConsumptions: new Map(),
    roundProofs: new Map(),
    upgradeAttempts: new Map(),
  };
  for (const record of normalizeInitialState(clone(initialState))) {
    state.entities.set(entityKey(record.entityKind, record.entityKey), record);
  }
  const fault = (point) => {
    if (testOnlyFault === point) throw new Error(`TEST_ONLY_REWARD_CAS_FAULT_${point}`);
  };
  const store = {
    readHead() {
      return clone(state.head);
    },
    readEntity(kind, key) {
      const record = state.entities.get(entityKey(kind, key));
      return record ? clone(record) : null;
    },
    readUpgradeAttempt(rewardId) {
      const attempt = state.upgradeAttempts.get(asCanonicalHex32(rewardId, "rewardId"));
      return attempt ? clone(attempt) : null;
    },
    readCommit(sequence) {
      const canonicalSequence = asStoredU64(sequence, "commit sequence");
      const commit = state.commits.find((candidate) => candidate.sequence === canonicalSequence);
      return commit ? clone(commit) : null;
    },
    readRoundConsumption(fundingRoundAtUnixSeconds) {
      const record = state.roundConsumptions.get(rewardCasRoundKey(fundingRoundAtUnixSeconds));
      return record ? clone(record) : null;
    },
    readRoundProof(fundingRoundAtUnixSeconds) {
      const record = state.roundProofs.get(rewardCasRoundKey(fundingRoundAtUnixSeconds));
      return record ? clone(record) : null;
    },
    snapshot() {
      const snapshot = snapshotFromMemory(state);
      validateRewardCasSnapshot(snapshot);
      return snapshot;
    },
  };
  Object.defineProperty(store, REWARD_CAS_STORE_ADAPTER, {
    enumerable: false,
    value: Object.freeze({
      finalizeRound(input) {
        const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
        const roundKey = rewardCasRoundKey(input.fundingRoundAtUnixSeconds);
        const fundingRound = BigInt(roundKey);
        if (state.roundConsumptions.has(roundKey)) throw new Error("REWARD_CAS_ROUND_ALREADY_CONSUMED");
        const earlierPendingRoundExists = [...state.entities.values()].some((record) => (
          record.entityKind === REWARD_CAS_ENTITY_KIND.ROUND
          && record.value.status === "SEALED_PENDING_FINALIZATION"
          && BigInt(record.entityKey) < fundingRound
        ));
        if (earlierPendingRoundExists) throw new Error("REWARD_CAS_EARLIER_PENDING_ROUND_EXISTS");
        const roundRecord = state.entities.get(entityKey(REWARD_CAS_ENTITY_KIND.ROUND, roundKey));
        const ledgerRecord = state.entities.get(entityKey(
          REWARD_CAS_ENTITY_KIND.LANE_LEDGER,
          REWARD_CAS_GLOBAL_LEDGER_KEY,
        ));
        if (!roundRecord || !ledgerRecord) throw new Error("REWARD_CAS_REQUIRED_ENTITY_MISSING");
        const prepared = prepareRewardRoundFinalizationCas({
          ...input,
          dailyLawState,
          roundRecord,
          ledgerRecord,
        });
        const { commit, nextHead } = createRewardCasCommit({
          head: state.head,
          operation: REWARD_CAS_OPERATION.FINALIZE_ROUND,
          changes: prepared.changes,
          evidenceSha256: prepared.evidenceSha256,
          dailyLawState,
        });
        const consumption = Object.freeze({ ...prepared.roundConsumption, commitSha256: commit.commitSha256 });
        const proofRecord = createRoundProofRecord({
          prepared,
          commit,
          cccRandomnessReveal: input.cccRandomnessReveal ?? null,
        });
        const nextEntities = new Map(state.entities);
        const nextConsumptions = new Map(state.roundConsumptions);
        const nextProofs = new Map(state.roundProofs);
        const nextCommits = [...state.commits];
        nextConsumptions.set(roundKey, consumption);
        fault("AFTER_MARKER");
        nextProofs.set(roundKey, proofRecord);
        fault("AFTER_PROOF");
        nextEntities.set(entityKey(
          prepared.nextRoundRecord.entityKind,
          prepared.nextRoundRecord.entityKey,
        ), prepared.nextRoundRecord);
        fault("AFTER_FIRST_ENTITY");
        nextEntities.set(entityKey(
          prepared.nextLedgerRecord.entityKind,
          prepared.nextLedgerRecord.entityKey,
        ), prepared.nextLedgerRecord);
        nextCommits.push(commit);
        fault("BEFORE_HEAD");
        state.entities = nextEntities;
        state.roundConsumptions = nextConsumptions;
        state.roundProofs = nextProofs;
        state.commits = nextCommits;
        state.head = nextHead;
        return clone({
          commit,
          roundConsumption: consumption,
          proofRecord,
          roundRecord: prepared.nextRoundRecord,
          ledgerRecord: prepared.nextLedgerRecord,
          proofBundle: prepared.proofBundle,
        });
      },
      recordPremiumUpgrade(input) {
        const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
        const rewardId = asCanonicalHex32(input.rewardId, "rewardId");
        if (state.upgradeAttempts.has(rewardId)) throw new Error("REWARD_CAS_UPGRADE_ATTEMPT_ALREADY_RECORDED");
        const rewardRecord = state.entities.get(entityKey(REWARD_CAS_ENTITY_KIND.X_REWARD, rewardId));
        if (!rewardRecord) throw new Error("REWARD_CAS_REQUIRED_ENTITY_MISSING");
        const prepared = preparePremiumUpgradeCas({ ...input, dailyLawState, rewardRecord });
        const { commit, nextHead } = createRewardCasCommit({
          head: state.head,
          operation: REWARD_CAS_OPERATION.RECORD_PREMIUM_UPGRADE,
          changes: prepared.changes,
          evidenceSha256: prepared.evidenceSha256,
          dailyLawState,
        });
        const attempt = Object.freeze({ ...prepared.upgradeAttempt, commitSha256: commit.commitSha256 });
        const nextEntities = new Map(state.entities);
        const nextAttempts = new Map(state.upgradeAttempts);
        const nextCommits = [...state.commits];
        nextAttempts.set(rewardId, attempt);
        fault("AFTER_MARKER");
        nextEntities.set(entityKey(
          prepared.nextRewardRecord.entityKind,
          prepared.nextRewardRecord.entityKey,
        ), prepared.nextRewardRecord);
        fault("AFTER_FIRST_ENTITY");
        nextCommits.push(commit);
        fault("BEFORE_HEAD");
        state.entities = nextEntities;
        state.upgradeAttempts = nextAttempts;
        state.commits = nextCommits;
        state.head = nextHead;
        return clone({ commit, upgradeAttempt: attempt, rewardRecord: prepared.nextRewardRecord });
      },
    }),
  });
  return Object.freeze(store);
}

export function finalizeRewardCapacityRoundCas(input) {
  const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
  const adapter = input?.store?.[REWARD_CAS_STORE_ADAPTER];
  if (!adapter || typeof adapter.finalizeRound !== "function") throw new Error("INVALID_REWARD_CAS_STORE");
  return adapter.finalizeRound({ ...input, dailyLawState });
}

export function recordPremiumUpgradeCas(input) {
  const dailyLawState = assertDailyLawWriteAllowed(input?.dailyLawState);
  const adapter = input?.store?.[REWARD_CAS_STORE_ADAPTER];
  if (!adapter || typeof adapter.recordPremiumUpgrade !== "function") {
    throw new Error("INVALID_REWARD_CAS_STORE");
  }
  return adapter.recordPremiumUpgrade({ ...input, dailyLawState });
}

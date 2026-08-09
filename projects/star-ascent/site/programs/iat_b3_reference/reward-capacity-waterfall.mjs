import { createHash } from "node:crypto";

import policy from "../../docs/b3/iat-b3-reward-capacity-waterfall.v1.json" with { type: "json" };
import { selectUniformTiebreakOutcome } from "../../engagement/iat-v2-reference-engine.mjs";
import { assertSolanaPublicKey } from "../../engagement/solana-wallet-proof.mjs";
import { deriveAllocatorReceiptLineage } from "./reward-allocator-receipt-codec.mjs";
import { assertDailyLawWriteAllowed } from "./daily-lockdown-consensus.mjs";

export const REWARD_CAPACITY_POLICY_CANONICAL_SHA256 = "2054c881f9c7524acb965454286950445cd37c99f7485b45e2c787bcfb3617e2";
export const REWARD_CAPACITY_POLICY_FILE_SHA256 = "423fc268c184271023af0ca0664b194e9570149e4c61a916c27bad5d9bb17858";
export const UTC_DAY_SECONDS = 86_400n;
export const CLAIM_EXPIRY_DAYS = 30n;
export const U64_MAX = (1n << 64n) - 1n;
const I64_MIN = -(1n << 63n);
const I64_MAX = (1n << 63n) - 1n;

export const REWARD_PRIORITY_CLASSES = Object.freeze([
  "CCC_AGENT",
  "CCC_ASSOCIATE",
  "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
  "WEEKLY_FACTION",
  "CORE",
]);
export const REWARD_LANE_ORDER = Object.freeze(["treasury", "ecosystem", "liquidity"]);
export const X_TRANCHE_KIND = Object.freeze({
  BASE: "X_BASE_10",
  PREMIUM_FULL: "X_PREMIUM_FULL_100",
  UPGRADE: "X_PREMIUM_UPGRADE_90",
});
export const X_TRANCHE_BASIS_POINTS = Object.freeze({
  [X_TRANCHE_KIND.BASE]: 1_000,
  [X_TRANCHE_KIND.PREMIUM_FULL]: 10_000,
  [X_TRANCHE_KIND.UPGRADE]: 9_000,
});

const SHARED_CLASS = "STANDARD_10_PERCENT_AND_X_CAMPAIGN";
export const X_BOUND_SOURCE_PRIORITY = Object.freeze({
  GENESIS_AIRDROP: SHARED_CLASS,
  X_INTERACTION: SHARED_CLASS,
  STANDARD_POSITION: SHARED_CLASS,
  CCC_AGENT: "CCC_AGENT",
  CCC_ASSOCIATE: "CCC_ASSOCIATE",
  FACTION_FOLLOWER: "WEEKLY_FACTION",
});
const X_REWARD_KINDS = new Set(Object.keys(X_BOUND_SOURCE_PRIORITY));
const KNOWN_NON_PREMIUM_TYPES = new Set(["None", "Basic"]);
const PREMIUM_TYPES = new Set(["Premium", "PremiumPlus"]);
const CCC_CLASSES = new Set(["CCC_AGENT", "CCC_ASSOCIATE"]);
const CCC_REVEAL_COMMITMENT_SCHEME = "IAT_B3_CCC_REVEAL_COMMITMENT_V1";
const CCC_PRECOMMIT_REGISTRY_SCHEMA = "iat-b3-ccc-precommit-registry-snapshot/v1";
const CCC_DECISION_CONTEXT_DOMAIN = "IAT_B3_CCC_CAPACITY_DECISION_CONTEXT_V1";
const ALLOCATOR_RECEIPT_SCHEMA = "iat-b3-reward-capacity-allocator-receipt/v1";
const ROUND_STATE_SCHEMA = "iat-b3-reward-capacity-round-state/v1";
const X_BASE_ADMISSION_LINEAGE_SCHEMA = "iat-b3-x-base-admission-lineage/v1";
const X_BASE_ADMISSION_LINEAGE_STATUS = "NON_ACTIVATING_UNAUTHENTICATED_REFERENCE_LINEAGE";
const FACTION_FRAGMENT_KIND = "X_BOUND_FACTION_FRAGMENT";
const FACTION_MANIFEST_KIND = "WEEKLY_FACTION_MANIFEST";
const X_FUNDING_ID_DOMAIN = "IAT_B3_X_FUNDING_V1";
const REWARD_CAPACITY_ROUND_SEAL_KEYS = Object.freeze([
  "schema",
  "status",
  "fundingRoundAtUnixSeconds",
  "sealedAtUnixSeconds",
  "candidateCount",
  "candidateIds",
  "candidateSetSha256",
  "candidates",
  "ledgerSnapshot",
  "ledgerSnapshotSha256",
  "cccPrecommitRegistrySnapshot",
  "cccPrecommitRegistrySnapshotSha256",
  "cccRevealCommitment",
  "cccDecisionContextSha256",
  "finalized",
]);
const OBLIGATION_COMMON_KEYS = Object.freeze([
  "id",
  "priorityClass",
  "amount",
  "fundingRoundAtUnixSeconds",
  "fundingPool",
  "reservationStatus",
]);
const OBLIGATION_CCC_ORDERING_KEYS = Object.freeze([
  "qualifyingActivityStartSlot",
  "nodeActivationSlot",
  "eligibleSequence",
  "qualificationPda",
]);
const OBLIGATION_CHRONOLOGY_KEYS = Object.freeze([
  "eligibleSequence",
  "activitySequence",
  "nodeSequence",
  "immutableIdentity",
  "commitmentDigest",
]);
const X_FUNDING_COMMON_KEYS = Object.freeze([
  "kind",
  "rewardId",
  "rewardSourceKind",
  "trancheKinds",
]);
const FACTION_MANIFEST_KEYS = Object.freeze([
  ...OBLIGATION_COMMON_KEYS,
  "kind",
  "factionWeekId",
  "followerCount",
  "payoutDigest",
  "payoutEntries",
  "chronology",
]);
const X_BOUND_REWARD_STATE_KEYS = Object.freeze([
  "schema",
  "rewardId",
  "wallet",
  "xUserId",
  "rewardSourceKind",
  "priorityClass",
  "cccOrdering",
  "grossBaseUnits",
  "epochClosedAtUnixSeconds",
  "claimExpiresAtUnixSeconds",
  "activityQualificationSequence",
  "nodeActivationSequence",
  "initialSubscriptionType",
  "latestSubscriptionType",
  "latestSubscriptionObservedAtUnixSeconds",
  "premiumProofAcceptedAtUnixSeconds",
  "premiumProofAcceptedSequence",
  "originalBaseAdmissionLineage",
  "baseTranche",
  "premiumFullTranche",
  "upgradeTranche",
  "expiredCleanupRecorded",
]);
const X_TRANCHE_KEYS = Object.freeze([
  "kind",
  "amount",
  "fundingRoundAtUnixSeconds",
  "eligibleSequence",
  "status",
]);
const X_CCC_ORDERING_KEYS = Object.freeze([
  "qualifyingActivityStartSlot",
  "nodeActivationSlot",
  "qualificationPda",
]);
const X_BASE_ADMISSION_LINEAGE_KEYS = Object.freeze([
  "schema",
  "status",
  "rewardId",
  "fundingRoundAtUnixSeconds",
  "allocationIndex",
  "referenceReceiptSha256",
  "referenceFinalizationSha256",
  "batchCommitmentSha256",
  "binaryReceiptSha256",
  "authenticated",
]);
const BASE_TRANCHE_STATUSES = new Set([
  "PENDING_FUNDING",
  "ADMITTED_RESERVED",
  "CLAIMED",
  "NULL_UNDERFUNDED",
  "NULL_BLOCKED",
  "NULL_MISSED",
  "NULL_CLAIM_EXPIRED",
]);
const PREMIUM_FULL_TRANCHE_STATUSES = new Set(BASE_TRANCHE_STATUSES);
const UPGRADE_TRANCHE_STATUSES = new Set([
  "LOCKED_PENDING_PREMIUM",
  "PENDING_FUNDING",
  "ADMITTED_RESERVED",
  "CLAIMED",
  "NULL_UNDERFUNDED",
  "NULL_BLOCKED",
  "NULL_MISSED",
  "NULL_PARENT_UNFUNDED",
  "NULL_CLAIM_EXPIRED",
]);
const ACTIVE_AT_EXPIRY_STATUSES = new Set([
  "LOCKED_PENDING_PREMIUM",
  "PENDING_FUNDING",
  "ADMITTED_RESERVED",
]);
const BASE_FUNDING_FAILURE_STATUSES = new Set([
  "NULL_UNDERFUNDED",
  "NULL_BLOCKED",
  "NULL_MISSED",
]);
const UPGRADE_POST_PROOF_STATUSES = new Set([
  "PENDING_FUNDING",
  "ADMITTED_RESERVED",
  "CLAIMED",
  "NULL_UNDERFUNDED",
  "NULL_BLOCKED",
  "NULL_MISSED",
  "NULL_CLAIM_EXPIRED",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actualKeys = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  const expectedKeys = [...expected].sort((left, right) => left.localeCompare(right, "en"));
  return JSON.stringify(actualKeys) === JSON.stringify(expectedKeys);
}

function deepFreeze(value) {
  if ((Array.isArray(value) || isRecord(value)) && !Object.isFrozen(value)) {
    for (const entry of Object.values(value)) deepFreeze(entry);
    Object.freeze(value);
  }
  return value;
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

export function canonicalJsonSha256(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function canonicalStateSha256(value) {
  return sha256(JSON.stringify(canonicalize(value), (_key, entry) => (
    typeof entry === "bigint" ? entry.toString() : entry
  )));
}

function asInteger(value, label) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^-?\d+$/u.test(value)) return BigInt(value);
  throw new TypeError(`${label} must be an integer`);
}

function asU64(value, label) {
  const normalized = asInteger(value, label);
  if (normalized < 0n || normalized > U64_MAX) throw new RangeError(`${label} must fit u64`);
  return normalized;
}

function asI64(value, label) {
  const normalized = asInteger(value, label);
  if (normalized < I64_MIN || normalized > I64_MAX) {
    throw new RangeError(`${label} must fit i64`);
  }
  return normalized;
}

function asHex32(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/iu.test(value)) {
    throw new TypeError(`${label} must be 32 bytes of hexadecimal`);
  }
  return value.toLowerCase();
}

function asStoredU64(value, label) {
  if (typeof value !== "bigint") throw new TypeError(`${label} must be stored as bigint`);
  return asU64(value, label);
}

function asStoredI64(value, label) {
  if (typeof value !== "bigint") throw new TypeError(`${label} must be stored as bigint`);
  return asI64(value, label);
}

function asCanonicalHex32(value, label) {
  const normalized = asHex32(value, label);
  if (normalized !== value) throw new TypeError(`${label} must be canonical lowercase hexadecimal`);
  return normalized;
}

function asNonEmptyString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${label} is required`);
  return value;
}

function asCanonicalNonEmptyString(value, label) {
  const normalized = asNonEmptyString(value, label);
  if (normalized !== normalized.trim()) throw new TypeError(`${label} must not contain surrounding whitespace`);
  return normalized;
}

function floorDiv(dividend, divisor) {
  const quotient = dividend / divisor;
  const remainder = dividend % divisor;
  return remainder < 0n ? quotient - 1n : quotient;
}

export function nextUtcMidnight(unixTimestamp) {
  const timestamp = asI64(unixTimestamp, "unixTimestamp");
  return asI64(
    (floorDiv(timestamp, UTC_DAY_SECONDS) + 1n) * UTC_DAY_SECONDS,
    "next UTC midnight",
  );
}

function assertUtcMidnight(value, label) {
  const timestamp = asI64(value, label);
  if (timestamp % UTC_DAY_SECONDS !== 0n) throw new Error(`${label} must be exact 00:00 UTC`);
  return timestamp;
}

export function createCccRevealCommitment({
  sourceId,
  committedAtUnixSeconds,
  fundingRoundAtUnixSeconds,
  randomnessHex,
}) {
  const normalizedSourceId = asCanonicalNonEmptyString(sourceId, "CCC randomness sourceId");
  const committedAt = asI64(committedAtUnixSeconds, "CCC randomness committedAtUnixSeconds");
  const fundingRound = assertUtcMidnight(fundingRoundAtUnixSeconds, "CCC randomness fundingRoundAtUnixSeconds");
  const randomness = asHex32(randomnessHex, "CCC randomness reveal");
  if (committedAt >= fundingRound) throw new Error("CCC_REVEAL_MUST_BE_COMMITTED_BEFORE_FUNDING_ROUND");
  return Object.freeze({
    scheme: CCC_REVEAL_COMMITMENT_SCHEME,
    sourceId: normalizedSourceId,
    committedAtUnixSeconds: committedAt,
    commitmentSha256: sha256([
      CCC_REVEAL_COMMITMENT_SCHEME,
      normalizedSourceId,
      committedAt,
      fundingRound,
      randomness,
    ].join("|")),
  });
}

function normalizeCccRevealCommitment(value, fundingRound) {
  if (!hasExactKeys(value, ["scheme", "sourceId", "committedAtUnixSeconds", "commitmentSha256"])
    || value.scheme !== CCC_REVEAL_COMMITMENT_SCHEME) throw new Error("INVALID_CCC_REVEAL_COMMITMENT");
  const normalized = {
    scheme: CCC_REVEAL_COMMITMENT_SCHEME,
    sourceId: asCanonicalNonEmptyString(value.sourceId, "CCC randomness sourceId"),
    committedAtUnixSeconds: asStoredI64(value.committedAtUnixSeconds, "CCC randomness committedAtUnixSeconds"),
    commitmentSha256: asCanonicalHex32(value.commitmentSha256, "CCC randomness commitment"),
  };
  if (normalized.committedAtUnixSeconds >= fundingRound) {
    throw new Error("CCC_REVEAL_MUST_BE_COMMITTED_BEFORE_FUNDING_ROUND");
  }
  return normalized;
}

export function createCccPrecommitRegistrySnapshot({
  fundingRoundAtUnixSeconds,
  commitments,
}) {
  const fundingRound = assertUtcMidnight(
    fundingRoundAtUnixSeconds,
    "CCC precommit registry fundingRoundAtUnixSeconds",
  );
  if (!Array.isArray(commitments) || commitments.length > 1) {
    throw new Error("CCC_PRECOMMIT_REGISTRY_REQUIRES_ZERO_OR_ONE_CANONICAL_ENTRY");
  }
  const entries = commitments
    .map((entry) => normalizeCccRevealCommitment(entry, fundingRound))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId)
      || left.commitmentSha256.localeCompare(right.commitmentSha256));
  if (new Set(entries.map(({ sourceId }) => sourceId)).size !== entries.length
    || new Set(entries.map(({ commitmentSha256 }) => commitmentSha256)).size !== entries.length) {
    throw new Error("DUPLICATE_CCC_PRECOMMIT_REGISTRY_ENTRY");
  }
  const core = {
    schema: CCC_PRECOMMIT_REGISTRY_SCHEMA,
    status: "COMPLETE_UNAUTHENTICATED_REFERENCE_SNAPSHOT",
    complete: true,
    fundingRoundAtUnixSeconds: fundingRound,
    entries,
  };
  return deepFreeze({ ...core, snapshotSha256: canonicalStateSha256(core) });
}

function normalizeCccPrecommitRegistrySnapshot(value, fundingRound) {
  if (!hasExactKeys(value, [
    "schema", "status", "complete", "fundingRoundAtUnixSeconds", "entries", "snapshotSha256",
  ])
    || value.schema !== CCC_PRECOMMIT_REGISTRY_SCHEMA
    || value.status !== "COMPLETE_UNAUTHENTICATED_REFERENCE_SNAPSHOT"
    || value.complete !== true
    || assertUtcMidnight(
      asStoredI64(value.fundingRoundAtUnixSeconds, "CCC precommit registry funding round"),
      "CCC precommit registry funding round",
    ) !== fundingRound
    || !Array.isArray(value.entries)
    || value.entries.length > 1) {
    throw new Error("INVALID_OR_INCOMPLETE_CCC_PRECOMMIT_REGISTRY_SNAPSHOT");
  }
  const entries = value.entries
    .map((entry) => normalizeCccRevealCommitment(entry, fundingRound))
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId)
      || left.commitmentSha256.localeCompare(right.commitmentSha256));
  if (new Set(entries.map(({ sourceId }) => sourceId)).size !== entries.length
    || new Set(entries.map(({ commitmentSha256 }) => commitmentSha256)).size !== entries.length) {
    throw new Error("DUPLICATE_CCC_PRECOMMIT_REGISTRY_ENTRY");
  }
  const core = {
    schema: CCC_PRECOMMIT_REGISTRY_SCHEMA,
    status: "COMPLETE_UNAUTHENTICATED_REFERENCE_SNAPSHOT",
    complete: true,
    fundingRoundAtUnixSeconds: fundingRound,
    entries,
  };
  const snapshotSha256 = canonicalStateSha256(core);
  if (asCanonicalHex32(value.snapshotSha256, "CCC precommit registry snapshot digest") !== snapshotSha256) {
    throw new Error("CCC_PRECOMMIT_REGISTRY_SNAPSHOT_COMMITMENT_MISMATCH");
  }
  return { ...core, snapshotSha256 };
}

function cccTierHasExactTie(obligations) {
  for (const priorityClass of CCC_CLASSES) {
    const seen = new Set();
    for (const entry of obligations.filter((candidate) => candidate.priorityClass === priorityClass)) {
      const key = `${entry.qualifyingActivityStartSlot}|${entry.nodeActivationSlot}|${entry.eligibleSequence}`;
      if (seen.has(key)) return true;
      seen.add(key);
    }
  }
  return false;
}

function deriveCccDecisionContext({
  fundingRoundAtUnixSeconds,
  candidateSetSha256,
  ledgerSnapshotSha256,
  precommitRegistrySnapshotSha256,
  revealCommitment,
}) {
  return sha256([
    CCC_DECISION_CONTEXT_DOMAIN,
    REWARD_CAPACITY_POLICY_CANONICAL_SHA256,
    fundingRoundAtUnixSeconds,
    candidateSetSha256,
    ledgerSnapshotSha256,
    precommitRegistrySnapshotSha256,
    revealCommitment.sourceId,
    revealCommitment.committedAtUnixSeconds,
    revealCommitment.commitmentSha256,
  ].join("|"));
}

function verifyCccReveal(roundSeal, reveal) {
  if (roundSeal.cccRevealCommitment === null) {
    if (reveal !== null && reveal !== undefined) throw new Error("UNEXPECTED_CCC_RANDOMNESS_REVEAL");
    return { randomnessHex: null, revealSha256: null, sourceId: null };
  }
  if (!hasExactKeys(reveal, ["sourceId", "randomnessHex"])) throw new Error("CCC_RANDOMNESS_REVEAL_REQUIRED");
  const sourceId = asNonEmptyString(reveal.sourceId, "CCC randomness reveal sourceId");
  const randomnessHex = asHex32(reveal.randomnessHex, "CCC randomness reveal");
  const commitment = roundSeal.cccRevealCommitment;
  const actualCommitment = sha256([
    CCC_REVEAL_COMMITMENT_SCHEME,
    sourceId,
    commitment.committedAtUnixSeconds,
    roundSeal.fundingRoundAtUnixSeconds,
    randomnessHex,
  ].join("|"));
  if (sourceId !== commitment.sourceId || actualCommitment !== commitment.commitmentSha256) {
    throw new Error("CCC_RANDOMNESS_REVEAL_DOES_NOT_MATCH_SEALED_COMMITMENT");
  }
  return { randomnessHex, revealSha256: sha256(randomnessHex), sourceId };
}

function assertExactArray(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${label} drifted`);
}

function assertExactObject(actual, expected, label) {
  if (!isRecord(actual) || canonicalJsonSha256(actual) !== canonicalJsonSha256(expected)) {
    throw new Error(`${label} drifted`);
  }
}

export function validateRewardCapacityPolicy(candidate) {
  if (!isRecord(candidate)) throw new Error("reward-capacity policy must be an object");
  if (candidate.schema !== "iat-b3-reward-capacity-waterfall/v1"
    || candidate.status !== "REFERENCE_ONLY_BLOCKED_NON_ACTIVATING"
    || candidate.activationReady !== false
    || candidate.directApplicationPermitted !== false
    || candidate.runtimeDependency !== false) {
    throw new Error("reward-capacity policy must remain reference-only and non-activating");
  }
  if (candidate.dailyLaw?.lawId !== "IAT_B3_DAILY_LOCKDOWN_LAW_V1"
    || candidate.dailyLaw?.writeRule !== "CANONICAL_CURRENT_OPEN_DAILY_LAW_CAPABILITY_FIRST"
    || candidate.dailyLaw?.expiryReadRequiresWrite !== false
    || candidate.dailyLaw?.cleanupRequiresWrite !== true) throw new Error("Daily Law binding drifted");
  assertExactArray(candidate.capacity?.priorityClasses, REWARD_PRIORITY_CLASSES, "reward priority classes");
  assertExactArray(candidate.capacity?.physicalRewardLanes, REWARD_LANE_ORDER, "physical reward lanes");
  if (candidate.capacity?.existingReservationsHavePriority !== true
    || candidate.capacity?.existingCoreReservationGrandfathered !== true
    || candidate.capacity?.existingFactionCarveoutReservationsGrandfathered !== true
    || candidate.capacity?.corePrincipalIsRewardSource !== false
    || candidate.capacity?.obligationPaymentRule !== "EXACT_ATOMIC_ALL_OR_NOTHING"
    || candidate.capacity?.referenceAllocationEffect !== "PURE_RESERVATION_PLAN_NO_PERSISTENCE_OR_CPI"
    || candidate.capacity?.underfundedRule !== "STOP_NO_SKIP_NO_LOWER_CLASS"
    || candidate.capacity?.rewardDebtAllowed !== false) throw new Error("capacity conservation policy drifted");
  assertExactObject(candidate.xBoundRewards?.sourceKindPriorityMap, X_BOUND_SOURCE_PRIORITY, "X source-kind priority map");
  assertExactArray(candidate.xBoundRewards?.knownNonPremiumSubscriptionTypes, [...KNOWN_NON_PREMIUM_TYPES], "known non-Premium types");
  assertExactArray(candidate.xBoundRewards?.premiumSubscriptionTypes, [...PREMIUM_TYPES], "Premium types");
  assertExactArray(candidate.xBoundRewards?.trancheKinds, Object.values(X_TRANCHE_KIND), "X tranche kinds");
  assertExactObject(candidate.xBoundRewards?.trancheBasisPoints, X_TRANCHE_BASIS_POINTS, "X tranche basis points");
  if (candidate.xBoundRewards?.unknownOrMissingSubscriptionAction !== "REJECT"
    || candidate.xBoundRewards?.grossBaseUnitDivisor !== 10
    || candidate.xBoundRewards?.baseTrancheNumerator !== 1
    || candidate.xBoundRewards?.upgradeTrancheNumerator !== 9
    || candidate.xBoundRewards?.trancheDenominator !== 10
    || candidate.xBoundRewards?.premiumObservationMaximumAgeSeconds !== 86_400
    || candidate.xBoundRewards?.upgradeMustFollowQualification !== true
    || candidate.xBoundRewards?.upgradeIdentityBinding !== "SAME_IMMUTABLE_X_USER_ID_AND_WALLET"
    || candidate.xBoundRewards?.originalFundingDecision !== "ORIGINAL_EPOCH_CLOSE_00_00_UTC"
    || candidate.xBoundRewards?.upgradeFundingDecision !== "FIRST_00_00_UTC_AFTER_PREMIUM_PROOF_ACCEPTANCE"
    || candidate.xBoundRewards?.fundingAttemptsPerTranche !== 1
    || candidate.xBoundRewards?.unfundedOrMissedFundingDisposition !== "NULL_TRANCHE_NO_DEBT_NO_RECREATION"
    || candidate.xBoundRewards?.baseFailureVoidsUpgrade !== true
    || candidate.xBoundRewards?.claimExpiryDays !== 30
    || candidate.xBoundRewards?.claimExpiryInterval !== "HALF_OPEN"
    || candidate.xBoundRewards?.admittedDisposition !== "RESERVED_UNTIL_ORIGINAL_CLAIM_EXPIRY"
    || candidate.xBoundRewards?.upgradeOrderRule !== "MAX_ORIGINAL_ACTIVITY_NODE_AND_PREMIUM_PROOF_SEQUENCE"
    || candidate.xBoundRewards?.premiumProofSequenceRule !== "STRICTLY_GREATER_THAN_ORIGINAL_ACTIVITY_AND_NODE"
    || candidate.xBoundRewards?.priorityClassFromSourceKind !== true
    || candidate.xBoundRewards?.premiumAtQualificationTrancheKind !== X_TRANCHE_KIND.PREMIUM_FULL
    || candidate.xBoundRewards?.premiumAtQualificationAtomic !== true
    || candidate.xBoundRewards?.genericAirdropKindAllowed !== false
    || candidate.xBoundRewards?.coreAutomaticallyXBound !== false
    || candidate.xBoundRewards?.retroactiveSplitOfExistingObligations !== false) throw new Error("X-bound 10/90 policy drifted");
  if (candidate.roundSealing?.candidateSetRule !== "COMPLETE_DUE_SET_SEALED_AT_DESIGNATED_00_00_UTC"
    || candidate.roundSealing?.capacitySnapshotRule !== "EXACT_LEDGER_WITH_EXISTING_RESERVATIONS_SEALED_AT_DESIGNATED_00_00_UTC"
    || candidate.roundSealing?.sealedAtMustEqualFundingRound !== true
    || candidate.roundSealing?.omittedDueCandidateDisposition !== "NULL_MISSED_NO_DEBT_NO_REOPEN"
    || candidate.roundSealing?.absentSealMissDecidable !== "STRICTLY_AFTER_DESIGNATED_BOUNDARY"
    || candidate.roundSealing?.missDecidableAtRule !== "FUNDING_ROUND_PLUS_ONE_SECOND_EARLIEST"
    || candidate.roundSealing?.allocationExecutionDelayChangesSealedResult !== false
    || candidate.roundSealing?.freeAllocatorLedgerInputAllowed !== false
    || candidate.roundSealing?.finalizationBindsPreAndPostLedgerDigests !== true
    || candidate.roundSealing?.typedRoundStateRule !== "BY_VALUE_SEALED_THEN_FINALIZED_NO_FREE_REPLAY_GUARD"
    || candidate.roundSealing?.outcomeValidationRule !== "EXACT_DETERMINISTIC_RECOMPUTATION_FROM_SEALED_INPUTS"
    || candidate.roundSealing?.conflictingSealOrFinalizationAction !== "REJECT") {
    throw new Error("round sealing policy drifted");
  }
  if (candidate.cccOrdering?.primary !== "qualifyingActivityStartSlotAscending"
    || candidate.cccOrdering?.secondary !== "nodeActivationSlotAscending"
    || candidate.cccOrdering?.tertiary !== "xEligibilitySequenceAscending"
    || candidate.cccOrdering?.exactTieCandidateOrdering !== "QUALIFICATION_PDA_BYTES_ASCENDING"
    || candidate.cccOrdering?.exactTieResolution !== "ONE_REVEAL_EXACT_UNIFORM_WITHOUT_REPLACEMENT"
    || candidate.cccOrdering?.revealRule !== "PREBOUND_SOURCE_AND_SHA256_COMMITMENT_STRICTLY_BEFORE_FUNDING_ROUND"
    || candidate.cccOrdering?.precommitRegistryRule !== "COMPLETE_CANONICAL_ZERO_OR_ONE_ENTRY_SNAPSHOT_BOUND_IN_SEAL"
    || candidate.cccOrdering?.exactTieRegistryRequirement !== "EXACTLY_ONE_ENTRY_MATCHING_REVEAL_COMMITMENT"
    || candidate.cccOrdering?.duplicateOrMismatchedRegistryAction !== "REJECT"
    || candidate.cccOrdering?.decisionContextRule !== "DERIVED_FROM_POLICY_ROUND_CANDIDATE_CAPACITY_REGISTRY_AND_REVEAL_COMMITMENT"
    || candidate.cccOrdering?.freeAllocatorDecisionContextAllowed !== false
    || candidate.cccOrdering?.finalizationBindsRevealAndContext !== true
    || candidate.cccOrdering?.operatorReroll !== false) throw new Error("CCC deterministic order drifted");
  if (candidate.faction?.existingFundingBoundary !== "SEPARATE_CAPPED_COMMUNITY_CARVEOUT"
    || candidate.faction?.newUnreservedFundingBoundary !== "SHARED_REWARD_RESERVE_AFTER_STANDARD_BEFORE_CORE"
    || candidate.faction?.sharedRewardLaneCompetition !== true
    || candidate.faction?.existingCarveoutMayEnterNewWaterfall !== false
    || candidate.faction?.weeklyManifestIsIndivisible !== true
    || candidate.faction?.maximumNewWeeklyManifestsPerFundingRound !== 1
    || candidate.faction?.individualFollowerObligationMayEnterWaterfall !== false
    || candidate.faction?.manifestBinding !== "CANONICAL_ALL_FOLLOWER_PAYOUT_DIGEST_AND_EXACT_TOTAL") {
    throw new Error("faction carve-out boundary drifted");
  }
  if (candidate.allocatorReceipts?.requiredForXFundingStateTransition !== true
    || candidate.allocatorReceipts?.binding !== "ROUND_SEAL_PRECOMMIT_REGISTRY_FINALIZATION_OBLIGATION_EXACT_AMOUNT_AND_LANES"
    || candidate.allocatorReceipts?.validationRule !== "RECOMPUTE_COMPLETE_ALLOCATION_AND_FINALIZATION_FROM_SEALED_SNAPSHOT"
    || candidate.allocatorReceipts?.replayStateRule !== "ALLOCATOR_CONSUMES_PENDING_TYPED_ROUND_STATE_AND_RETURNS_FINALIZED_STATE"
    || candidate.allocatorReceipts?.callerAssertedDispositionAllowed !== false
    || candidate.allocatorReceipts?.replayAllowed !== false
    || candidate.allocatorReceipts?.referencePersistenceEffect !== "NONE_NON_ACTIVATING") {
    throw new Error("allocator receipt policy drifted");
  }
  if (candidate.scope?.cccGenesisActive !== false
    || candidate.scope?.changesExistingReservations !== false
    || candidate.scope?.changesDailyLaw !== false
    || candidate.scope?.changesRuntimeCatalog !== false
    || candidate.scope?.authorizesDeployment !== false
    || candidate.scope?.chronologyAdapterAuthenticated !== false
    || candidate.scope?.roundSnapshotAdapterAuthenticated !== false
    || candidate.scope?.sourceKindAdapterAuthenticated !== false
    || candidate.scope?.cccRandomnessProvenanceAuthenticated !== false
    || candidate.scope?.cccPrecommitRegistryAuthenticated !== false
    || candidate.scope?.roundStatePersistenceAuthenticated !== false
    || candidate.scope?.allocatorReceiptPersistenceAuthenticated !== false) throw new Error("non-activating scope drifted");
  if (canonicalJsonSha256(candidate) !== REWARD_CAPACITY_POLICY_CANONICAL_SHA256) {
    throw new Error("reward-capacity policy canonical digest drifted");
  }
  return structuredClone(candidate);
}

function validateSubscriptionObservation({ subscriptionType, observedAt, evaluatedAt }) {
  if (!KNOWN_NON_PREMIUM_TYPES.has(subscriptionType) && !PREMIUM_TYPES.has(subscriptionType)) {
    throw new Error("UNKNOWN_OR_MISSING_X_SUBSCRIPTION");
  }
  const observed = asI64(observedAt, "subscriptionObservedAtUnixSeconds");
  const evaluated = asI64(evaluatedAt, "evaluatedAtUnixSeconds");
  if (observed > evaluated || evaluated - observed > UTC_DAY_SECONDS) {
    throw new Error("STALE_OR_FUTURE_X_SUBSCRIPTION_OBSERVATION");
  }
  return observed;
}

function validateRewardIdentity({ rewardId, wallet, xUserId }) {
  if (typeof xUserId !== "string" || !/^[1-9]\d{0,31}$/u.test(xUserId)) {
    throw new TypeError("xUserId must be a canonical positive decimal immutable X ID");
  }
  const normalizedWallet = asNonEmptyString(wallet, "wallet");
  assertSolanaPublicKey(normalizedWallet);
  return {
    rewardId: asHex32(rewardId, "rewardId"),
    wallet: normalizedWallet,
    xUserId,
  };
}

function tranche(kind, amount, fundingRoundAtUnixSeconds, eligibleSequence, status) {
  return Object.freeze({ kind, amount, fundingRoundAtUnixSeconds, eligibleSequence, status });
}

export function createXBoundReward({
  dailyLawState,
  rewardId,
  rewardSourceKind,
  wallet,
  xUserId,
  grossBaseUnits,
  epochClosedAtUnixSeconds,
  subscriptionType,
  subscriptionObservedAtUnixSeconds,
  activityQualificationSequence,
  nodeActivationSequence,
  qualifyingActivityStartSlot = null,
  nodeActivationSlot = null,
  qualificationPda = null,
}) {
  assertDailyLawWriteAllowed(dailyLawState);
  const identity = validateRewardIdentity({ rewardId, wallet, xUserId });
  if (!X_REWARD_KINDS.has(rewardSourceKind)) throw new Error("UNSUPPORTED_X_BOUND_REWARD_SOURCE_KIND");
  const priorityClass = X_BOUND_SOURCE_PRIORITY[rewardSourceKind];
  const gross = asU64(grossBaseUnits, "grossBaseUnits");
  if (gross === 0n || gross % 10n !== 0n) throw new Error("GROSS_MUST_BE_POSITIVE_AND_DIVISIBLE_BY_TEN");
  const epochClose = assertUtcMidnight(epochClosedAtUnixSeconds, "epochClosedAtUnixSeconds");
  const observed = validateSubscriptionObservation({
    subscriptionType,
    observedAt: subscriptionObservedAtUnixSeconds,
    evaluatedAt: epochClose,
  });
  const activitySequence = asU64(activityQualificationSequence, "activityQualificationSequence");
  const nodeSequence = asU64(nodeActivationSequence, "nodeActivationSequence");
  const originalEligibleSequence = activitySequence > nodeSequence ? activitySequence : nodeSequence;
  const premium = PREMIUM_TYPES.has(subscriptionType);
  const baseAmount = gross / 10n;
  const claimExpiry = asI64(
    epochClose + CLAIM_EXPIRY_DAYS * UTC_DAY_SECONDS,
    "claimExpiresAtUnixSeconds",
  );
  const cccOrdering = CCC_CLASSES.has(priorityClass)
    ? Object.freeze({
      qualifyingActivityStartSlot: asU64(qualifyingActivityStartSlot, "qualifyingActivityStartSlot"),
      nodeActivationSlot: asU64(nodeActivationSlot, "nodeActivationSlot"),
      qualificationPda: asHex32(qualificationPda, "qualificationPda"),
    })
    : null;
  return Object.freeze({
    schema: "iat-b3-x-bound-reward/v1",
    ...identity,
    rewardSourceKind,
    priorityClass,
    cccOrdering,
    grossBaseUnits: gross,
    epochClosedAtUnixSeconds: epochClose,
    claimExpiresAtUnixSeconds: claimExpiry,
    activityQualificationSequence: activitySequence,
    nodeActivationSequence: nodeSequence,
    initialSubscriptionType: subscriptionType,
    latestSubscriptionType: subscriptionType,
    latestSubscriptionObservedAtUnixSeconds: observed,
    premiumProofAcceptedAtUnixSeconds: premium ? epochClose : null,
    premiumProofAcceptedSequence: premium ? originalEligibleSequence : null,
    originalBaseAdmissionLineage: null,
    baseTranche: premium
      ? null
      : tranche(X_TRANCHE_KIND.BASE, baseAmount, epochClose, originalEligibleSequence, "PENDING_FUNDING"),
    premiumFullTranche: premium
      ? tranche(X_TRANCHE_KIND.PREMIUM_FULL, gross, epochClose, originalEligibleSequence, "PENDING_FUNDING")
      : null,
    upgradeTranche: premium
      ? null
      : tranche(X_TRANCHE_KIND.UPGRADE, gross - baseAmount, null, null, "LOCKED_PENDING_PREMIUM"),
    expiredCleanupRecorded: false,
  });
}

function assertTrancheShape(value, expectedKind, allowedStatuses) {
  if (!hasExactKeys(value, X_TRANCHE_KEYS) || value.kind !== expectedKind) {
    throw new Error("INVALID_X_REWARD_TRANCHE_KEY_SET_OR_KIND");
  }
  if (typeof value.amount !== "bigint") throw new Error("X_REWARD_TRANCHE_AMOUNT_MUST_BE_STORED_AS_BIGINT");
  if (asU64(value.amount, `${expectedKind}.amount`) === 0n) {
    throw new Error("X_REWARD_TRANCHE_AMOUNT_MUST_BE_POSITIVE");
  }
  const roundIsNull = value.fundingRoundAtUnixSeconds === null;
  const sequenceIsNull = value.eligibleSequence === null;
  if (roundIsNull !== sequenceIsNull) throw new Error("X_REWARD_TRANCHE_ROUND_SEQUENCE_NULLABILITY_MISMATCH");
  if (!roundIsNull) {
    if (typeof value.fundingRoundAtUnixSeconds !== "bigint"
      || typeof value.eligibleSequence !== "bigint") {
      throw new Error("X_REWARD_TRANCHE_ROUND_AND_SEQUENCE_MUST_BE_STORED_AS_BIGINT");
    }
    assertUtcMidnight(value.fundingRoundAtUnixSeconds, `${expectedKind}.fundingRound`);
    asU64(value.eligibleSequence, `${expectedKind}.eligibleSequence`);
  }
  if (!allowedStatuses.has(value.status)) throw new Error("INVALID_X_REWARD_TRANCHE_STATUS");
}

function assertOptionalTrancheShape(value, expectedKind, allowedStatuses) {
  if (value !== null) assertTrancheShape(value, expectedKind, allowedStatuses);
}

function normalizeOriginalBaseAdmissionLineage(value, expectedRewardId) {
  if (!hasExactKeys(value, X_BASE_ADMISSION_LINEAGE_KEYS)
    || value.schema !== X_BASE_ADMISSION_LINEAGE_SCHEMA
    || value.status !== X_BASE_ADMISSION_LINEAGE_STATUS
    || value.authenticated !== false) {
    throw new Error("INVALID_X_BASE_ADMISSION_LINEAGE");
  }
  const normalized = {
    schema: X_BASE_ADMISSION_LINEAGE_SCHEMA,
    status: X_BASE_ADMISSION_LINEAGE_STATUS,
    rewardId: asHex32(value.rewardId, "base admission lineage reward ID"),
    fundingRoundAtUnixSeconds: assertUtcMidnight(
      value.fundingRoundAtUnixSeconds,
      "base admission lineage funding round",
    ),
    allocationIndex: value.allocationIndex,
    referenceReceiptSha256: asHex32(
      value.referenceReceiptSha256,
      "base admission lineage reference receipt digest",
    ),
    referenceFinalizationSha256: asHex32(
      value.referenceFinalizationSha256,
      "base admission lineage finalization digest",
    ),
    batchCommitmentSha256: asHex32(
      value.batchCommitmentSha256,
      "base admission lineage batch commitment",
    ),
    binaryReceiptSha256: asHex32(
      value.binaryReceiptSha256,
      "base admission lineage binary receipt digest",
    ),
    authenticated: false,
  };
  if (typeof value.fundingRoundAtUnixSeconds !== "bigint"
    || normalized.rewardId !== value.rewardId
    || normalized.referenceReceiptSha256 !== value.referenceReceiptSha256
    || normalized.referenceFinalizationSha256 !== value.referenceFinalizationSha256
    || normalized.batchCommitmentSha256 !== value.batchCommitmentSha256
    || normalized.binaryReceiptSha256 !== value.binaryReceiptSha256) {
    throw new Error("X_BASE_ADMISSION_LINEAGE_MUST_USE_CANONICAL_STORED_TYPES");
  }
  if (!Number.isSafeInteger(normalized.allocationIndex)
    || normalized.allocationIndex < 0
    || normalized.allocationIndex > 0xffff_ffff) {
    throw new Error("INVALID_X_BASE_ADMISSION_ALLOCATION_INDEX");
  }
  if (normalized.rewardId !== asHex32(expectedRewardId, "expected base admission reward ID")) {
    throw new Error("X_BASE_ADMISSION_LINEAGE_REWARD_MISMATCH");
  }
  return Object.freeze(normalized);
}

function createOriginalBaseAdmissionLineage({ reward, expected, outcome, roundState, allocationIndex }) {
  if (outcome.allocatorReceipt.disposition !== "ADMITTED_RESERVED"
    || !expected.trancheKinds.includes(X_TRANCHE_KIND.BASE)) {
    throw new Error("BASE_ADMISSION_LINEAGE_REQUIRES_ADMITTED_BASE_RECEIPT");
  }
  const derived = deriveAllocatorReceiptLineage({ roundState, outcome, allocationIndex });
  return normalizeOriginalBaseAdmissionLineage({
    schema: X_BASE_ADMISSION_LINEAGE_SCHEMA,
    status: X_BASE_ADMISSION_LINEAGE_STATUS,
    rewardId: reward.rewardId,
    fundingRoundAtUnixSeconds: outcome.allocatorReceipt.fundingRoundAtUnixSeconds,
    ...derived,
    authenticated: false,
  }, reward.rewardId);
}

export function validateXBoundRewardReferenceState(reward) {
  if (!hasExactKeys(reward, X_BOUND_REWARD_STATE_KEYS)
    || reward.schema !== "iat-b3-x-bound-reward/v1") {
    throw new Error("INVALID_X_BOUND_REWARD_KEY_SET_OR_SCHEMA");
  }
  const identity = validateRewardIdentity(reward);
  if (identity.rewardId !== reward.rewardId) throw new Error("X_REWARD_ID_MUST_BE_CANONICAL_LOWERCASE_HEX");
  if (!X_REWARD_KINDS.has(reward.rewardSourceKind)
    || reward.priorityClass !== X_BOUND_SOURCE_PRIORITY[reward.rewardSourceKind]) {
    throw new Error("INVALID_X_REWARD_SOURCE_CLASS_BINDING");
  }
  if (CCC_CLASSES.has(reward.priorityClass)) {
    if (!hasExactKeys(reward.cccOrdering, X_CCC_ORDERING_KEYS)) {
      throw new Error("INVALID_X_REWARD_CCC_ORDERING_KEY_SET");
    }
    if (typeof reward.cccOrdering.qualifyingActivityStartSlot !== "bigint"
      || typeof reward.cccOrdering.nodeActivationSlot !== "bigint") {
      throw new Error("X_REWARD_CCC_SLOTS_MUST_BE_STORED_AS_BIGINT");
    }
    asU64(reward.cccOrdering.qualifyingActivityStartSlot, "reward.cccOrdering.qualifyingActivityStartSlot");
    asU64(reward.cccOrdering.nodeActivationSlot, "reward.cccOrdering.nodeActivationSlot");
    if (asHex32(reward.cccOrdering.qualificationPda, "reward.cccOrdering.qualificationPda")
      !== reward.cccOrdering.qualificationPda) {
      throw new Error("X_REWARD_CCC_PDA_MUST_BE_CANONICAL_LOWERCASE_HEX");
    }
  } else if (reward.cccOrdering !== null) throw new Error("UNEXPECTED_X_REWARD_CCC_ORDERING");
  for (const [label, value] of [
    ["grossBaseUnits", reward.grossBaseUnits],
    ["epochClosedAtUnixSeconds", reward.epochClosedAtUnixSeconds],
    ["claimExpiresAtUnixSeconds", reward.claimExpiresAtUnixSeconds],
    ["activityQualificationSequence", reward.activityQualificationSequence],
    ["nodeActivationSequence", reward.nodeActivationSequence],
    ["latestSubscriptionObservedAtUnixSeconds", reward.latestSubscriptionObservedAtUnixSeconds],
  ]) {
    if (typeof value !== "bigint") throw new Error(`X_REWARD_${label.toUpperCase()}_MUST_BE_STORED_AS_BIGINT`);
  }
  if (reward.premiumProofAcceptedAtUnixSeconds !== null
    && typeof reward.premiumProofAcceptedAtUnixSeconds !== "bigint") {
    throw new Error("X_REWARD_PREMIUM_PROOF_ACCEPTED_AT_MUST_BE_STORED_AS_BIGINT_OR_NULL");
  }
  if (reward.premiumProofAcceptedSequence !== null
    && typeof reward.premiumProofAcceptedSequence !== "bigint") {
    throw new Error("X_REWARD_PREMIUM_PROOF_SEQUENCE_MUST_BE_STORED_AS_BIGINT_OR_NULL");
  }
  const gross = asU64(reward.grossBaseUnits, "reward.grossBaseUnits");
  if (gross === 0n || gross % 10n !== 0n) throw new Error("INVALID_X_REWARD_GROSS_AMOUNT");
  const epochClose = assertUtcMidnight(reward.epochClosedAtUnixSeconds, "reward.epochClosedAtUnixSeconds");
  const claimExpiry = asI64(reward.claimExpiresAtUnixSeconds, "reward.claimExpiresAtUnixSeconds");
  const expectedClaimExpiry = asI64(
    epochClose + CLAIM_EXPIRY_DAYS * UTC_DAY_SECONDS,
    "expected reward.claimExpiresAtUnixSeconds",
  );
  if (claimExpiry !== expectedClaimExpiry) {
    throw new Error("INVALID_30_DAY_CLAIM_EXPIRY");
  }
  const activitySequence = asU64(reward.activityQualificationSequence, "reward.activityQualificationSequence");
  const nodeSequence = asU64(reward.nodeActivationSequence, "reward.nodeActivationSequence");
  const originalEligibleSequence = activitySequence > nodeSequence ? activitySequence : nodeSequence;
  assertOptionalTrancheShape(reward.baseTranche, X_TRANCHE_KIND.BASE, BASE_TRANCHE_STATUSES);
  assertOptionalTrancheShape(
    reward.premiumFullTranche,
    X_TRANCHE_KIND.PREMIUM_FULL,
    PREMIUM_FULL_TRANCHE_STATUSES,
  );
  assertOptionalTrancheShape(reward.upgradeTranche, X_TRANCHE_KIND.UPGRADE, UPGRADE_TRANCHE_STATUSES);
  const originalBaseAdmissionLineage = reward.originalBaseAdmissionLineage === null
    ? null
    : normalizeOriginalBaseAdmissionLineage(reward.originalBaseAdmissionLineage, reward.rewardId);
  if (originalBaseAdmissionLineage !== null
    && originalBaseAdmissionLineage.fundingRoundAtUnixSeconds !== epochClose) {
    throw new Error("X_BASE_ADMISSION_LINEAGE_ROUND_MISMATCH");
  }
  if (typeof reward.expiredCleanupRecorded !== "boolean") {
    throw new Error("X_EXPIRED_CLEANUP_RECORDED_MUST_BE_CANONICAL_BOOLEAN");
  }
  const storedTranches = [reward.baseTranche, reward.premiumFullTranche, reward.upgradeTranche]
    .filter((value) => value !== null);
  if (reward.expiredCleanupRecorded
    && storedTranches.some(({ status }) => ACTIVE_AT_EXPIRY_STATUSES.has(status))) {
    throw new Error("X_EXPIRED_CLEANUP_RECORDED_WITH_ACTIVE_TRANCHE");
  }
  if (!reward.expiredCleanupRecorded
    && storedTranches.some(({ status }) => status === "NULL_CLAIM_EXPIRED")) {
    throw new Error("X_CLAIM_EXPIRED_STATUS_REQUIRES_CLEANUP_RECORD");
  }

  if (PREMIUM_TYPES.has(reward.initialSubscriptionType)) {
    if (reward.baseTranche !== null || reward.upgradeTranche !== null
      || reward.premiumFullTranche?.amount !== gross
      || reward.premiumFullTranche?.fundingRoundAtUnixSeconds !== epochClose
      || reward.premiumFullTranche?.eligibleSequence !== originalEligibleSequence
      || originalBaseAdmissionLineage !== null) {
      throw new Error("INVALID_X_REWARD_PREMIUM_FULL_TRANCHE");
    }
    if (reward.latestSubscriptionType !== reward.initialSubscriptionType) {
      throw new Error("PREMIUM_ORIGIN_TIER_MUST_REMAIN_INITIAL_TIER");
    }
    validateSubscriptionObservation({
      subscriptionType: reward.latestSubscriptionType,
      observedAt: reward.latestSubscriptionObservedAtUnixSeconds,
      evaluatedAt: epochClose,
    });
    if (reward.premiumProofAcceptedSequence !== originalEligibleSequence) {
      throw new Error("PREMIUM_ORIGIN_SEQUENCE_MUST_MATCH_ORIGINAL_ELIGIBILITY");
    }
    if (reward.premiumProofAcceptedAtUnixSeconds !== epochClose) {
      throw new Error("PREMIUM_ORIGIN_ACCEPTANCE_MUST_EQUAL_QUALIFICATION_CLOSE");
    }
  } else if (KNOWN_NON_PREMIUM_TYPES.has(reward.initialSubscriptionType)) {
    if (reward.premiumFullTranche !== null
      || reward.baseTranche?.amount !== gross / 10n
      || reward.baseTranche?.fundingRoundAtUnixSeconds !== epochClose
      || reward.baseTranche?.eligibleSequence !== originalEligibleSequence
      || reward.upgradeTranche?.amount !== gross - gross / 10n) {
      throw new Error("INVALID_X_REWARD_10_90_SPLIT");
    }
    if (["ADMITTED_RESERVED", "CLAIMED"].includes(reward.baseTranche.status)
      && originalBaseAdmissionLineage === null) {
      throw new Error("X_BASE_ADMISSION_LINEAGE_REQUIRED");
    }
    if (originalBaseAdmissionLineage !== null
      && !["ADMITTED_RESERVED", "CLAIMED", "NULL_CLAIM_EXPIRED"].includes(reward.baseTranche.status)) {
      throw new Error("X_BASE_ADMISSION_LINEAGE_WITHOUT_BASE_ADMISSION");
    }

    if (KNOWN_NON_PREMIUM_TYPES.has(reward.latestSubscriptionType)) {
      if (reward.latestSubscriptionType !== reward.initialSubscriptionType
        || reward.premiumProofAcceptedAtUnixSeconds !== null
        || reward.premiumProofAcceptedSequence !== null) {
        throw new Error("NON_PREMIUM_STATE_HAS_NONCANONICAL_TIER_OR_PROOF_SEQUENCE");
      }
      validateSubscriptionObservation({
        subscriptionType: reward.latestSubscriptionType,
        observedAt: reward.latestSubscriptionObservedAtUnixSeconds,
        evaluatedAt: epochClose,
      });
      if (reward.upgradeTranche.fundingRoundAtUnixSeconds !== null
        || reward.upgradeTranche.eligibleSequence !== null) {
        throw new Error("PREMIUM_LOCKED_UPGRADE_MUST_NOT_HAVE_ROUND_OR_SEQUENCE");
      }
      const legalProoflessPair = (
        (["PENDING_FUNDING", "ADMITTED_RESERVED"].includes(reward.baseTranche.status)
          && reward.upgradeTranche.status === "LOCKED_PENDING_PREMIUM")
        || (reward.baseTranche.status === "CLAIMED"
          && ["LOCKED_PENDING_PREMIUM", "NULL_CLAIM_EXPIRED"].includes(reward.upgradeTranche.status))
        || (BASE_FUNDING_FAILURE_STATUSES.has(reward.baseTranche.status)
          && reward.upgradeTranche.status === "NULL_PARENT_UNFUNDED")
        || (reward.baseTranche.status === "NULL_CLAIM_EXPIRED"
          && reward.upgradeTranche.status === "NULL_CLAIM_EXPIRED")
      );
      if (!legalProoflessPair) throw new Error("ILLEGAL_X_BASE_UPGRADE_TRANCHE_STATE_PAIR");
    } else if (PREMIUM_TYPES.has(reward.latestSubscriptionType)) {
      const observed = asI64(
        reward.latestSubscriptionObservedAtUnixSeconds,
        "reward.latestSubscriptionObservedAtUnixSeconds",
      );
      const acceptedAt = asI64(
        reward.premiumProofAcceptedAtUnixSeconds,
        "reward.premiumProofAcceptedAtUnixSeconds",
      );
      if (observed <= epochClose
        || acceptedAt <= epochClose
        || acceptedAt >= claimExpiry) {
        throw new Error("PREMIUM_UPGRADE_OBSERVATION_OUTSIDE_ORIGINAL_CLAIM_WINDOW");
      }
      validateSubscriptionObservation({
        subscriptionType: reward.latestSubscriptionType,
        observedAt: observed,
        evaluatedAt: acceptedAt,
      });
      const proofSequence = asU64(
        reward.premiumProofAcceptedSequence,
        "reward.premiumProofAcceptedSequence",
      );
      if (proofSequence <= activitySequence || proofSequence <= nodeSequence) {
        throw new Error("PREMIUM_PROOF_SEQUENCE_MUST_FOLLOW_ORIGINAL_ELIGIBILITY");
      }
      if (originalBaseAdmissionLineage === null) throw new Error("X_UPGRADE_REQUIRES_BASE_ADMISSION_LINEAGE");
      if (!["ADMITTED_RESERVED", "CLAIMED", "NULL_CLAIM_EXPIRED"].includes(reward.baseTranche.status)
        || !UPGRADE_POST_PROOF_STATUSES.has(reward.upgradeTranche.status)) {
        throw new Error("ILLEGAL_X_POST_PROOF_TRANCHE_STATE_PAIR");
      }
      const upgradeRound = assertUtcMidnight(
        reward.upgradeTranche.fundingRoundAtUnixSeconds,
        "reward.upgradeTranche.fundingRoundAtUnixSeconds",
      );
      if (upgradeRound <= epochClose
        || upgradeRound >= claimExpiry
        || upgradeRound !== nextUtcMidnight(acceptedAt)
        || reward.upgradeTranche.eligibleSequence !== proofSequence) {
        throw new Error("INVALID_X_PREMIUM_UPGRADE_ROUND_OR_SEQUENCE");
      }
    } else {
      throw new Error("INVALID_X_REWARD_LATEST_SUBSCRIPTION_TYPE");
    }
  } else {
    throw new Error("INVALID_X_REWARD_INITIAL_SUBSCRIPTION_TYPE");
  }
  return reward;
}

function effectiveTrancheStatus(reward, value, now) {
  if (value === null) return null;
  if (["ADMITTED_RESERVED", "LOCKED_PENDING_PREMIUM", "PENDING_FUNDING"].includes(value.status)
    && now >= reward.claimExpiresAtUnixSeconds) return "NULL_CLAIM_EXPIRED";
  return value.status;
}

export function effectiveXBoundRewardStatus(reward, nowUnixSeconds) {
  validateXBoundRewardReferenceState(reward);
  const now = asI64(nowUnixSeconds, "nowUnixSeconds");
  return Object.freeze({
    base: effectiveTrancheStatus(reward, reward.baseTranche, now),
    premiumFull: effectiveTrancheStatus(reward, reward.premiumFullTranche, now),
    upgrade: effectiveTrancheStatus(reward, reward.upgradeTranche, now),
  });
}

export function recordPremiumUpgrade({
  dailyLawState,
  reward,
  wallet,
  xUserId,
  subscriptionType,
  subscriptionObservedAtUnixSeconds,
  premiumProofAcceptedAtUnixSeconds,
  premiumProofAcceptedSequence,
}) {
  assertDailyLawWriteAllowed(dailyLawState);
  validateXBoundRewardReferenceState(reward);
  const acceptedAt = asI64(premiumProofAcceptedAtUnixSeconds, "premiumProofAcceptedAtUnixSeconds");
  if (acceptedAt >= reward.claimExpiresAtUnixSeconds) throw new Error("ORIGINAL_CLAIM_EXPIRED");
  if (reward.baseTranche === null || !["ADMITTED_RESERVED", "CLAIMED"].includes(reward.baseTranche.status)) {
    throw new Error("BASE_FUNDING_REQUIRED_BEFORE_UPGRADE");
  }
  normalizeOriginalBaseAdmissionLineage(reward.originalBaseAdmissionLineage, reward.rewardId);
  if (reward.upgradeTranche?.status !== "LOCKED_PENDING_PREMIUM") throw new Error("PREMIUM_ALREADY_RECORDED_OR_UPGRADE_VOID");
  if (wallet !== reward.wallet || xUserId !== reward.xUserId) throw new Error("PREMIUM_UPGRADE_IDENTITY_MISMATCH");
  if (!PREMIUM_TYPES.has(subscriptionType)) throw new Error("PREMIUM_UPGRADE_REQUIRED");
  const observed = validateSubscriptionObservation({
    subscriptionType,
    observedAt: subscriptionObservedAtUnixSeconds,
    evaluatedAt: acceptedAt,
  });
  if (observed <= reward.latestSubscriptionObservedAtUnixSeconds
    || observed <= reward.epochClosedAtUnixSeconds
    || acceptedAt <= reward.epochClosedAtUnixSeconds) {
    throw new Error("PREMIUM_UPGRADE_MUST_BE_LATER");
  }
  const proofSequence = asU64(premiumProofAcceptedSequence, "premiumProofAcceptedSequence");
  if (proofSequence <= reward.activityQualificationSequence
    || proofSequence <= reward.nodeActivationSequence) {
    throw new Error("PREMIUM_PROOF_SEQUENCE_MUST_FOLLOW_ORIGINAL_ELIGIBILITY");
  }
  const eligibleSequence = [reward.activityQualificationSequence, reward.nodeActivationSequence, proofSequence]
    .reduce((maximum, value) => value > maximum ? value : maximum, 0n);
  const fundingRound = nextUtcMidnight(acceptedAt);
  if (fundingRound >= reward.claimExpiresAtUnixSeconds) throw new Error("NO_UPGRADE_FUNDING_ROUND_BEFORE_CLAIM_EXPIRY");
  return Object.freeze({
    ...reward,
    latestSubscriptionType: subscriptionType,
    latestSubscriptionObservedAtUnixSeconds: observed,
    premiumProofAcceptedAtUnixSeconds: acceptedAt,
    premiumProofAcceptedSequence: proofSequence,
    upgradeTranche: tranche(X_TRANCHE_KIND.UPGRADE, reward.upgradeTranche.amount, fundingRound, eligibleSequence, "PENDING_FUNDING"),
  });
}

function xFundingKindsForRound(reward, fundingRound) {
  const due = [reward.baseTranche, reward.premiumFullTranche, reward.upgradeTranche]
    .filter((entry) => entry !== null
      && entry.status === "PENDING_FUNDING"
      && entry.fundingRoundAtUnixSeconds === fundingRound);
  if (due.some(({ kind }) => kind === X_TRANCHE_KIND.UPGRADE)
    && reward.baseTranche?.status === "PENDING_FUNDING"
    && reward.baseTranche.fundingRoundAtUnixSeconds !== fundingRound) {
    throw new Error("UPGRADE_CANNOT_FUND_BEFORE_BASE");
  }
  return due;
}

function deriveXBoundFundingObligationId({ rewardId, fundingRoundAtUnixSeconds, trancheKinds }) {
  return sha256([
    X_FUNDING_ID_DOMAIN,
    rewardId,
    fundingRoundAtUnixSeconds,
    trancheKinds.join(","),
  ].join("|"));
}

export function buildXBoundFundingObligation({ reward, fundingRoundAtUnixSeconds }) {
  validateXBoundRewardReferenceState(reward);
  const fundingRound = assertUtcMidnight(fundingRoundAtUnixSeconds, "fundingRoundAtUnixSeconds");
  const due = xFundingKindsForRound(reward, fundingRound);
  if (due.length === 0) return null;
  const amount = due.reduce((total, entry) => total + entry.amount, 0n);
  const eligibleSequence = due.reduce((maximum, entry) => entry.eligibleSequence > maximum ? entry.eligibleSequence : maximum, 0n);
  const trancheKinds = due.map(({ kind }) => kind);
  const base = {
    kind: reward.rewardSourceKind === "FACTION_FOLLOWER" ? FACTION_FRAGMENT_KIND : "X_BOUND_FUNDING",
    rewardId: reward.rewardId,
    rewardSourceKind: reward.rewardSourceKind,
    trancheKinds,
    priorityClass: reward.priorityClass,
    amount,
    fundingRoundAtUnixSeconds: fundingRound,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    ...(trancheKinds.includes(X_TRANCHE_KIND.UPGRADE)
      ? {
        originalBaseAdmissionLineage: normalizeOriginalBaseAdmissionLineage(
          reward.originalBaseAdmissionLineage,
          reward.rewardId,
        ),
      }
      : {}),
  };
  let semantics;
  if (CCC_CLASSES.has(reward.priorityClass)) {
    semantics = {
      ...base,
      qualifyingActivityStartSlot: reward.cccOrdering.qualifyingActivityStartSlot,
      nodeActivationSlot: reward.cccOrdering.nodeActivationSlot,
      eligibleSequence,
      qualificationPda: reward.cccOrdering.qualificationPda,
    };
  } else {
    semantics = {
      ...base,
      chronology: Object.freeze({
        eligibleSequence,
        activitySequence: reward.activityQualificationSequence,
        nodeSequence: reward.nodeActivationSequence,
        immutableIdentity: `${reward.xUserId}|${reward.wallet}`,
        commitmentDigest: reward.rewardId,
      }),
    };
  }
  return Object.freeze({
    id: deriveXBoundFundingObligationId(semantics),
    ...semantics,
  });
}

function normalizeFactionFragment(fragment, index, fundingRound) {
  if (!isRecord(fragment)) {
    throw new Error(`INVALID_FACTION_FOLLOWER_FRAGMENT_${index}`);
  }
  const trancheKinds = Array.isArray(fragment.trancheKinds) ? [...fragment.trancheKinds] : [];
  if (trancheKinds.length !== 1 || !Object.values(X_TRANCHE_KIND).includes(trancheKinds[0])) {
    throw new Error("FACTION_FRAGMENT_MUST_CONTAIN_ONE_ATOMIC_X_TRANCHE");
  }
  const isUpgrade = trancheKinds[0] === X_TRANCHE_KIND.UPGRADE;
  const expectedKeys = [
    ...OBLIGATION_COMMON_KEYS,
    ...X_FUNDING_COMMON_KEYS,
    "chronology",
    ...(isUpgrade ? ["originalBaseAdmissionLineage"] : []),
  ];
  if (!hasExactKeys(fragment, expectedKeys)) {
    throw new Error("INVALID_FACTION_FOLLOWER_FRAGMENT_KEY_SET");
  }
  if (fragment.kind !== FACTION_FRAGMENT_KIND
    || fragment.rewardSourceKind !== "FACTION_FOLLOWER"
    || fragment.priorityClass !== "WEEKLY_FACTION"
    || fragment.fundingPool !== "SHARED_REWARD_RESERVE"
    || fragment.reservationStatus !== "NEW_UNRESERVED") {
    throw new Error(`INVALID_FACTION_FOLLOWER_FRAGMENT_${index}`);
  }
  const fragmentId = asCanonicalHex32(fragment.id, `faction fragment ${index} id`);
  const rewardId = asCanonicalHex32(fragment.rewardId, `faction fragment ${index} reward ID`);
  const amount = asStoredU64(fragment.amount, `faction fragment ${index} amount`);
  const normalizedFundingRound = assertUtcMidnight(
    asStoredI64(fragment.fundingRoundAtUnixSeconds, `faction fragment ${index} funding round`),
    `faction fragment ${index} funding round`,
  );
  const chronology = normalizeChronology(fragment.chronology, `faction fragment ${index}`);
  const originalBaseAdmissionLineage = isUpgrade
    ? normalizeOriginalBaseAdmissionLineage(fragment.originalBaseAdmissionLineage, rewardId)
    : null;
  if (fragmentId !== deriveXBoundFundingObligationId({
    rewardId,
    fundingRoundAtUnixSeconds: normalizedFundingRound,
    trancheKinds,
  })) {
    throw new Error("X_BOUND_FUNDING_OBLIGATION_ID_NOT_DERIVED_FROM_CANONICAL_SEMANTICS");
  }
  const normalized = {
    fragmentId,
    rewardId,
    amount,
    trancheKinds,
    chronology,
    ...(isUpgrade ? { originalBaseAdmissionLineage } : {}),
  };
  if (normalized.amount === 0n) throw new Error("ZERO_FACTION_FOLLOWER_TRANCHE");
  if (normalizedFundingRound !== fundingRound) {
    throw new Error("FACTION_FRAGMENT_FUNDING_ROUND_MISMATCH");
  }
  return normalized;
}

export function buildWeeklyFactionManifestObligation({
  fundingRoundAtUnixSeconds,
  factionWeekId,
  followerObligations,
}) {
  const fundingRound = assertUtcMidnight(fundingRoundAtUnixSeconds, "fundingRoundAtUnixSeconds");
  const weekId = asCanonicalNonEmptyString(factionWeekId, "factionWeekId");
  if (!Array.isArray(followerObligations) || followerObligations.length === 0) {
    throw new Error("FACTION_MANIFEST_REQUIRES_COMPLETE_FOLLOWER_SET");
  }
  const payoutEntries = followerObligations
    .map((entry, index) => normalizeFactionFragment(entry, index, fundingRound))
    .sort((left, right) => left.fragmentId.localeCompare(right.fragmentId));
  if (new Set(payoutEntries.map(({ fragmentId }) => fragmentId)).size !== payoutEntries.length
    || new Set(payoutEntries.map(({ rewardId }) => rewardId)).size !== payoutEntries.length
    || new Set(payoutEntries.map(({ chronology }) => chronology.immutableIdentity)).size !== payoutEntries.length) {
    throw new Error("DUPLICATE_FACTION_FOLLOWER_IN_MANIFEST");
  }
  const amount = asU64(
    payoutEntries.reduce((total, entry) => total + entry.amount, 0n),
    "weekly faction manifest amount",
  );
  const payoutDigest = canonicalStateSha256(payoutEntries);
  const maximumChronology = (key) => payoutEntries.reduce(
    (maximum, entry) => entry.chronology[key] > maximum ? entry.chronology[key] : maximum,
    0n,
  );
  const chronology = Object.freeze({
    eligibleSequence: maximumChronology("eligibleSequence"),
    activitySequence: maximumChronology("activitySequence"),
    nodeSequence: maximumChronology("nodeSequence"),
    immutableIdentity: `FACTION_WEEK|${weekId}`,
    commitmentDigest: payoutDigest,
  });
  return Object.freeze({
    id: sha256(`IAT_B3_WEEKLY_FACTION_MANIFEST_V1|${fundingRound}|${weekId}|${payoutDigest}`),
    kind: FACTION_MANIFEST_KIND,
    priorityClass: "WEEKLY_FACTION",
    amount,
    fundingRoundAtUnixSeconds: fundingRound,
    fundingPool: "SHARED_REWARD_RESERVE",
    reservationStatus: "NEW_UNRESERVED",
    factionWeekId: weekId,
    followerCount: payoutEntries.length,
    payoutDigest,
    payoutEntries: Object.freeze(payoutEntries.map((entry) => Object.freeze(entry))),
    chronology,
  });
}

function validateFinalizedAllocatorOutcome({
  expected,
  outcome,
  roundState,
  cccRandomnessReveal,
}) {
  const validatedState = validateCapacityRoundState(roundState);
  if (validatedState.finalization === null) throw new Error("ALLOCATOR_ROUND_NOT_FINALIZED");
  const recomputed = computeCapacityAllocation({
    roundSeal: validatedState.roundSeal,
    cccRandomnessReveal,
  });
  if (canonicalStateSha256(validatedState.finalization) !== canonicalStateSha256(recomputed.finalization)) {
    throw new Error("ALLOCATOR_FINALIZATION_NOT_EXACT_RECOMPUTATION");
  }
  const validatedSeal = validatedState.validatedSeal;
  let sealedCandidate;
  if (expected.kind === FACTION_FRAGMENT_KIND) {
    const expectedEntry = normalizeFactionFragment(expected, 0, validatedSeal.fundingRound);
    sealedCandidate = validatedSeal.candidates.find((candidate) => candidate.kind === FACTION_MANIFEST_KIND
      && candidate.payoutEntries.some(({ fragmentId }) => fragmentId === expected.id));
    const sealedEntry = sealedCandidate?.payoutEntries.find(({ fragmentId }) => fragmentId === expected.id);
    if (!sealedCandidate || canonicalStateSha256(sealedEntry) !== canonicalStateSha256(expectedEntry)) {
      throw new Error("X_FACTION_FRAGMENT_NOT_BOUND_TO_SEALED_WEEKLY_MANIFEST");
    }
  } else {
    const normalizedExpected = normalizeObligation(expected, 0, validatedSeal.fundingRound);
    sealedCandidate = validatedSeal.candidates.find(({ id }) => id === normalizedExpected.id);
    if (!sealedCandidate || canonicalStateSha256(sealedCandidate) !== canonicalStateSha256(normalizedExpected)) {
      throw new Error("X_FUNDING_OBLIGATION_NOT_EXACTLY_BOUND_TO_SEAL");
    }
  }
  const recomputedOutcome = [...recomputed.funded, ...recomputed.nullOutcomes]
    .find(({ id }) => id === sealedCandidate.id);
  if (!recomputedOutcome
    || canonicalStateSha256(outcome) !== canonicalStateSha256(recomputedOutcome)) {
    throw new Error("ALLOCATOR_OUTCOME_NOT_EXACT_RECOMPUTATION");
  }
  const receipt = recomputedOutcome.allocatorReceipt;
  const receiptIndexes = validatedState.finalization.receiptDigests
    .flatMap((digest, index) => digest === receipt.receiptSha256 ? [index] : []);
  if (receiptIndexes.length !== 1) {
    throw new Error("ALLOCATOR_RECEIPT_MUST_OCCUR_EXACTLY_ONCE_IN_FINALIZATION");
  }
  return Object.freeze({
    outcome: recomputedOutcome,
    receipt,
    allocationIndex: receiptIndexes[0],
  });
}

export function applyXBoundFundingOutcome(input) {
  assertDailyLawWriteAllowed(input?.dailyLawState);
  if (Object.hasOwn(input, "roundSeal") || Object.hasOwn(input, "finalization")) {
    throw new Error("X_FUNDING_OUTCOME_REQUIRES_FINALIZED_TYPED_ROUND_STATE");
  }
  const {
    reward,
    outcome,
    fundingRoundAtUnixSeconds,
    roundState,
    cccRandomnessReveal = null,
  } = input;
  validateXBoundRewardReferenceState(reward);
  const expected = buildXBoundFundingObligation({ reward, fundingRoundAtUnixSeconds });
  if (!expected) throw new Error("NO_X_TRANCHE_DUE_IN_FUNDING_ROUND");
  const { outcome: validatedOutcome, receipt, allocationIndex } = validateFinalizedAllocatorOutcome({
    expected,
    outcome,
    roundState,
    cccRandomnessReveal,
  });
  const funded = receipt.disposition === "ADMITTED_RESERVED";
  const nextStatus = receipt.disposition;
  const dueKinds = new Set(expected.trancheKinds);
  let baseTranche = dueKinds.has(X_TRANCHE_KIND.BASE)
    ? tranche(X_TRANCHE_KIND.BASE, reward.baseTranche.amount, reward.baseTranche.fundingRoundAtUnixSeconds, reward.baseTranche.eligibleSequence, nextStatus)
    : reward.baseTranche;
  const premiumFullTranche = dueKinds.has(X_TRANCHE_KIND.PREMIUM_FULL)
    ? tranche(
      X_TRANCHE_KIND.PREMIUM_FULL,
      reward.premiumFullTranche.amount,
      reward.premiumFullTranche.fundingRoundAtUnixSeconds,
      reward.premiumFullTranche.eligibleSequence,
      nextStatus,
    )
    : reward.premiumFullTranche;
  let upgradeTranche = dueKinds.has(X_TRANCHE_KIND.UPGRADE)
    ? tranche(X_TRANCHE_KIND.UPGRADE, reward.upgradeTranche.amount, reward.upgradeTranche.fundingRoundAtUnixSeconds, reward.upgradeTranche.eligibleSequence, nextStatus)
    : reward.upgradeTranche;
  if (!funded && dueKinds.has(X_TRANCHE_KIND.BASE)) {
    baseTranche = tranche(X_TRANCHE_KIND.BASE, baseTranche.amount, baseTranche.fundingRoundAtUnixSeconds, baseTranche.eligibleSequence, receipt.disposition);
    upgradeTranche = tranche(X_TRANCHE_KIND.UPGRADE, upgradeTranche.amount, upgradeTranche.fundingRoundAtUnixSeconds, upgradeTranche.eligibleSequence, "NULL_PARENT_UNFUNDED");
  }
  const originalBaseAdmissionLineage = funded && dueKinds.has(X_TRANCHE_KIND.BASE)
    ? createOriginalBaseAdmissionLineage({
      reward,
      expected,
      outcome: validatedOutcome,
      roundState,
      allocationIndex,
    })
    : reward.originalBaseAdmissionLineage;
  return Object.freeze({
    ...reward,
    originalBaseAdmissionLineage,
    baseTranche,
    premiumFullTranche,
    upgradeTranche,
  });
}

export function claimReservedXBoundTranches({ dailyLawState, reward, trancheKinds, nowUnixSeconds }) {
  assertDailyLawWriteAllowed(dailyLawState);
  validateXBoundRewardReferenceState(reward);
  const now = asI64(nowUnixSeconds, "nowUnixSeconds");
  if (now >= reward.claimExpiresAtUnixSeconds) throw new Error("ORIGINAL_CLAIM_EXPIRED");
  if (!Array.isArray(trancheKinds) || trancheKinds.length === 0 || new Set(trancheKinds).size !== trancheKinds.length) {
    throw new Error("EXACT_TRANCHE_SET_REQUIRED");
  }
  let baseTranche = reward.baseTranche;
  let premiumFullTranche = reward.premiumFullTranche;
  let upgradeTranche = reward.upgradeTranche;
  for (const kind of trancheKinds) {
    if (kind === X_TRANCHE_KIND.BASE && baseTranche?.status === "ADMITTED_RESERVED") {
      baseTranche = tranche(kind, baseTranche.amount, baseTranche.fundingRoundAtUnixSeconds, baseTranche.eligibleSequence, "CLAIMED");
    } else if (kind === X_TRANCHE_KIND.PREMIUM_FULL && premiumFullTranche?.status === "ADMITTED_RESERVED") {
      premiumFullTranche = tranche(kind, premiumFullTranche.amount, premiumFullTranche.fundingRoundAtUnixSeconds, premiumFullTranche.eligibleSequence, "CLAIMED");
    } else if (kind === X_TRANCHE_KIND.UPGRADE && upgradeTranche?.status === "ADMITTED_RESERVED") {
      upgradeTranche = tranche(kind, upgradeTranche.amount, upgradeTranche.fundingRoundAtUnixSeconds, upgradeTranche.eligibleSequence, "CLAIMED");
    } else {
      throw new Error("TRANCHE_NOT_EXACTLY_RESERVED_AND_CLAIMABLE");
    }
  }
  return Object.freeze({ ...reward, baseTranche, premiumFullTranche, upgradeTranche });
}

export function cleanupExpiredXBoundReward({ dailyLawState, reward, nowUnixSeconds }) {
  assertDailyLawWriteAllowed(dailyLawState);
  validateXBoundRewardReferenceState(reward);
  const now = asI64(nowUnixSeconds, "nowUnixSeconds");
  if (now < reward.claimExpiresAtUnixSeconds) throw new Error("ORIGINAL_CLAIM_NOT_EXPIRED");
  if (reward.expiredCleanupRecorded) return reward;
  const expire = (value) => value !== null
    && ["ADMITTED_RESERVED", "LOCKED_PENDING_PREMIUM", "PENDING_FUNDING"].includes(value.status)
    ? tranche(value.kind, value.amount, value.fundingRoundAtUnixSeconds, value.eligibleSequence, "NULL_CLAIM_EXPIRED")
    : value;
  return Object.freeze({
    ...reward,
    baseTranche: expire(reward.baseTranche),
    premiumFullTranche: expire(reward.premiumFullTranche),
    upgradeTranche: expire(reward.upgradeTranche),
    expiredCleanupRecorded: true,
  });
}

function normalizeLedger(ledger) {
  if (!hasExactKeys(ledger, ["lanes"]) || !hasExactKeys(ledger.lanes, REWARD_LANE_ORDER)) {
    throw new Error("LEDGER_MUST_HAVE_EXACT_REWARD_LANE_KEY_SET");
  }
  return {
    lanes: Object.fromEntries(REWARD_LANE_ORDER.map((lane) => {
      const state = ledger.lanes[lane];
      if (!hasExactKeys(state, ["unlocked", "reserved", "paid", "withdrawn"])) {
        throw new Error(`INVALID_${lane.toUpperCase()}_LANE_KEY_SET`);
      }
      const normalized = {
        unlocked: asStoredU64(state.unlocked, `${lane}.unlocked`),
        reserved: asStoredU64(state.reserved, `${lane}.reserved`),
        paid: asStoredU64(state.paid, `${lane}.paid`),
        withdrawn: asStoredU64(state.withdrawn, `${lane}.withdrawn`),
      };
      if (normalized.reserved + normalized.paid + normalized.withdrawn > normalized.unlocked) {
        throw new Error(`${lane.toUpperCase()}_LANE_ACCOUNTING_CORRUPT`);
      }
      return [lane, normalized];
    })),
  };
}

function laneAvailable(state) {
  return state.unlocked - state.reserved - state.paid - state.withdrawn;
}

function planExactReservation(ledger, amount) {
  const required = asU64(amount, "obligation amount");
  const capacity = REWARD_LANE_ORDER.reduce((total, lane) => total + laneAvailable(ledger.lanes[lane]), 0n);
  if (capacity < required) return null;
  let remaining = required;
  const plannedByLane = Object.fromEntries(REWARD_LANE_ORDER.map((lane) => [lane, 0n]));
  for (const lane of REWARD_LANE_ORDER) {
    const available = laneAvailable(ledger.lanes[lane]);
    const take = available < remaining ? available : remaining;
    ledger.lanes[lane].reserved += take;
    plannedByLane[lane] = take;
    remaining -= take;
    if (remaining === 0n) break;
  }
  if (remaining !== 0n) throw new Error("ATOMIC_RESERVATION_PLAN_MISMATCH");
  return plannedByLane;
}

function normalizeChronology(value, label) {
  if (!hasExactKeys(value, OBLIGATION_CHRONOLOGY_KEYS)) {
    throw new Error(`${label} requires exact precommitted chronology key set`);
  }
  return {
    eligibleSequence: asStoredU64(value.eligibleSequence, `${label}.eligibleSequence`),
    activitySequence: asStoredU64(value.activitySequence, `${label}.activitySequence`),
    nodeSequence: asStoredU64(value.nodeSequence, `${label}.nodeSequence`),
    immutableIdentity: asCanonicalNonEmptyString(value.immutableIdentity, `${label}.immutableIdentity`),
    commitmentDigest: asCanonicalHex32(value.commitmentDigest, `${label}.commitmentDigest`),
  };
}

function normalizeFactionManifest(obligation, index, fundingRound, normalized) {
  const weekId = asCanonicalNonEmptyString(obligation.factionWeekId, `obligation ${index}.factionWeekId`);
  if (!Array.isArray(obligation.payoutEntries) || obligation.payoutEntries.length === 0) {
    throw new Error("FACTION_MANIFEST_REQUIRES_COMPLETE_PAYOUT_ENTRIES");
  }
  const payoutEntries = obligation.payoutEntries.map((entry, entryIndex) => {
    const trancheKinds = Array.isArray(entry.trancheKinds) ? [...entry.trancheKinds] : [];
    if (trancheKinds.length !== 1 || !Object.values(X_TRANCHE_KIND).includes(trancheKinds[0])) {
      throw new Error("FACTION_MANIFEST_ENTRY_MUST_BE_ONE_ATOMIC_X_TRANCHE");
    }
    const isUpgrade = trancheKinds[0] === X_TRANCHE_KIND.UPGRADE;
    const expectedKeys = ["fragmentId", "rewardId", "amount", "trancheKinds", "chronology"];
    if (isUpgrade) expectedKeys.push("originalBaseAdmissionLineage");
    if (!hasExactKeys(entry, expectedKeys)) {
      throw new Error("INVALID_FACTION_MANIFEST_PAYOUT_ENTRY_KEY_SET");
    }
    const rewardId = asCanonicalHex32(entry.rewardId, `faction payout ${entryIndex} reward ID`);
    const fragmentId = asCanonicalHex32(entry.fragmentId, `faction payout ${entryIndex} fragment ID`);
    if (fragmentId !== deriveXBoundFundingObligationId({
      rewardId,
      fundingRoundAtUnixSeconds: fundingRound,
      trancheKinds,
    })) {
      throw new Error("X_BOUND_FUNDING_OBLIGATION_ID_NOT_DERIVED_FROM_CANONICAL_SEMANTICS");
    }
    return {
      fragmentId,
      rewardId,
      amount: asStoredU64(entry.amount, `faction payout ${entryIndex} amount`),
      trancheKinds,
      chronology: normalizeChronology(entry.chronology, `faction payout ${entryIndex}`),
      ...(isUpgrade
        ? {
          originalBaseAdmissionLineage: normalizeOriginalBaseAdmissionLineage(
            entry.originalBaseAdmissionLineage,
            rewardId,
          ),
        }
        : {}),
    };
  }).sort((left, right) => left.fragmentId.localeCompare(right.fragmentId));
  if (JSON.stringify(obligation.payoutEntries.map(({ fragmentId }) => fragmentId))
    !== JSON.stringify(payoutEntries.map(({ fragmentId }) => fragmentId))) {
    throw new Error("FACTION_MANIFEST_PAYOUT_ENTRIES_MUST_BE_CANONICALLY_ORDERED");
  }
  if (payoutEntries.some(({ amount }) => amount === 0n)
    || new Set(payoutEntries.map(({ fragmentId }) => fragmentId)).size !== payoutEntries.length
    || new Set(payoutEntries.map(({ rewardId }) => rewardId)).size !== payoutEntries.length
    || new Set(payoutEntries.map(({ chronology }) => chronology.immutableIdentity)).size !== payoutEntries.length) {
    throw new Error("INVALID_OR_DUPLICATE_FACTION_MANIFEST_PAYOUT");
  }
  const exactAmount = payoutEntries.reduce((total, entry) => total + entry.amount, 0n);
  const payoutDigest = canonicalStateSha256(payoutEntries);
  if (asU64(exactAmount, "faction manifest exact amount") !== normalized.amount
    || !Number.isSafeInteger(obligation.followerCount)
    || obligation.followerCount !== payoutEntries.length
    || asCanonicalHex32(obligation.payoutDigest, "faction manifest payout digest") !== payoutDigest
    || normalized.id !== sha256(`IAT_B3_WEEKLY_FACTION_MANIFEST_V1|${fundingRound}|${weekId}|${payoutDigest}`)) {
    throw new Error("FACTION_MANIFEST_EXACT_TOTAL_OR_DIGEST_MISMATCH");
  }
  const maximumChronology = (key) => payoutEntries.reduce(
    (maximum, entry) => entry.chronology[key] > maximum ? entry.chronology[key] : maximum,
    0n,
  );
  const expectedChronology = {
    eligibleSequence: maximumChronology("eligibleSequence"),
    activitySequence: maximumChronology("activitySequence"),
    nodeSequence: maximumChronology("nodeSequence"),
    immutableIdentity: `FACTION_WEEK|${weekId}`,
    commitmentDigest: payoutDigest,
  };
  const suppliedChronology = normalizeChronology(obligation.chronology, `obligation ${index}`);
  if (canonicalStateSha256(suppliedChronology) !== canonicalStateSha256(expectedChronology)) {
    throw new Error("FACTION_MANIFEST_CHRONOLOGY_MISMATCH");
  }
  normalized.factionWeekId = weekId;
  normalized.followerCount = payoutEntries.length;
  normalized.payoutDigest = payoutDigest;
  normalized.payoutEntries = payoutEntries;
  normalized.chronology = expectedChronology;
}

function normalizeObligation(obligation, index, fundingRound) {
  if (!isRecord(obligation)) throw new Error(`obligation ${index} must be an object`);
  if (!REWARD_PRIORITY_CLASSES.includes(obligation.priorityClass)) throw new Error("UNKNOWN_REWARD_PRIORITY_CLASS");
  if (obligation.kind === FACTION_FRAGMENT_KIND) {
    throw new Error("FACTION_FOLLOWER_REQUIRES_ONE_AGGREGATE_WEEKLY_MANIFEST");
  }
  const cccClass = CCC_CLASSES.has(obligation.priorityClass);
  const xBound = obligation.kind === "X_BOUND_FUNDING";
  const factionManifest = obligation.kind === FACTION_MANIFEST_KIND;
  const trancheKinds = xBound && Array.isArray(obligation.trancheKinds)
    ? [...obligation.trancheKinds]
    : [];
  const trancheSignature = JSON.stringify(trancheKinds);
  const upgradeSignature = JSON.stringify([X_TRANCHE_KIND.UPGRADE]);
  let expectedKeys;
  if (xBound) {
    expectedKeys = [
      ...OBLIGATION_COMMON_KEYS,
      ...X_FUNDING_COMMON_KEYS,
      ...(cccClass ? OBLIGATION_CCC_ORDERING_KEYS : ["chronology"]),
      ...(trancheSignature === upgradeSignature ? ["originalBaseAdmissionLineage"] : []),
    ];
  } else if (factionManifest) {
    expectedKeys = FACTION_MANIFEST_KEYS;
  } else {
    if (Object.hasOwn(obligation, "kind")) throw new Error("UNKNOWN_REWARD_OBLIGATION_KIND");
    if (Object.hasOwn(obligation, "rewardSourceKind")) {
      throw new Error("X_BOUND_SOURCE_KIND_REQUIRES_X_BOUND_FUNDING_KIND");
    }
    expectedKeys = [
      ...OBLIGATION_COMMON_KEYS,
      ...(cccClass ? OBLIGATION_CCC_ORDERING_KEYS : ["chronology"]),
    ];
  }
  if (!hasExactKeys(obligation, expectedKeys)) {
    throw new Error("INVALID_REWARD_OBLIGATION_VARIANT_KEY_SET");
  }
  const normalizedFundingRound = assertUtcMidnight(
    asStoredI64(obligation.fundingRoundAtUnixSeconds, `obligation ${index} funding round`),
    `obligation ${index} funding round`,
  );
  const normalized = {
    id: asCanonicalHex32(obligation.id, `obligation ${index} id`),
    priorityClass: obligation.priorityClass,
    amount: asStoredU64(obligation.amount, `obligation ${index} amount`),
    fundingRoundAtUnixSeconds: normalizedFundingRound,
    fundingPool: obligation.fundingPool,
    reservationStatus: obligation.reservationStatus,
  };
  if (normalized.amount === 0n) throw new Error("ZERO_REWARD_OBLIGATION");
  if (normalized.fundingRoundAtUnixSeconds !== fundingRound) throw new Error("OBLIGATION_NOT_BOUND_TO_DESIGNATED_FUNDING_ROUND");
  if (obligation.reservationStatus !== "NEW_UNRESERVED") throw new Error("EXISTING_RESERVATIONS_CANNOT_ENTER_NEW_WATERFALL");
  if (xBound) {
    if (!X_REWARD_KINDS.has(obligation.rewardSourceKind)
      || X_BOUND_SOURCE_PRIORITY[obligation.rewardSourceKind] !== obligation.priorityClass) {
      throw new Error("X_BOUND_SOURCE_PRIORITY_CLASS_MISMATCH");
    }
    const acceptedTrancheSets = [
      [X_TRANCHE_KIND.BASE],
      [X_TRANCHE_KIND.PREMIUM_FULL],
      [X_TRANCHE_KIND.UPGRADE],
    ].map((entry) => JSON.stringify(entry));
    if (!acceptedTrancheSets.includes(trancheSignature)) {
      throw new Error("INVALID_X_BOUND_FUNDING_TRANCHE_SET");
    }
    normalized.kind = "X_BOUND_FUNDING";
    normalized.rewardId = asCanonicalHex32(obligation.rewardId, `obligation ${index} reward ID`);
    normalized.rewardSourceKind = obligation.rewardSourceKind;
    normalized.trancheKinds = trancheKinds;
    if (trancheSignature === upgradeSignature) {
      normalized.originalBaseAdmissionLineage = normalizeOriginalBaseAdmissionLineage(
        obligation.originalBaseAdmissionLineage,
        normalized.rewardId,
      );
    }
  }
  if (obligation.fundingPool !== "SHARED_REWARD_RESERVE") {
    throw new Error("NEW_WATERFALL_REQUIRES_SHARED_REWARD_FUNDING_POOL");
  }
  if (obligation.priorityClass === "WEEKLY_FACTION") {
    if (!factionManifest) throw new Error("WEEKLY_FACTION_REQUIRES_AGGREGATE_MANIFEST_KIND");
    normalized.kind = FACTION_MANIFEST_KIND;
    normalizeFactionManifest(obligation, index, fundingRound, normalized);
  } else if (factionManifest) {
    throw new Error("FACTION_MANIFEST_PRIORITY_CLASS_MISMATCH");
  } else if (cccClass) {
    normalized.qualifyingActivityStartSlot = asStoredU64(obligation.qualifyingActivityStartSlot, `obligation ${index} activity slot`);
    normalized.nodeActivationSlot = asStoredU64(obligation.nodeActivationSlot, `obligation ${index} node slot`);
    normalized.eligibleSequence = asStoredU64(obligation.eligibleSequence, `obligation ${index} X eligibility sequence`);
    normalized.qualificationPda = asCanonicalHex32(obligation.qualificationPda, `obligation ${index} qualification PDA`);
  } else {
    normalized.chronology = normalizeChronology(obligation.chronology, `obligation ${index}`);
  }
  if (xBound) {
    if (normalized.id !== deriveXBoundFundingObligationId(normalized)) {
      throw new Error("X_BOUND_FUNDING_OBLIGATION_ID_NOT_DERIVED_FROM_CANONICAL_SEMANTICS");
    }
  }
  return normalized;
}

function exactUniformCohortOrder(cohort, randomnessHex, decisionContextHex) {
  if (cohort.length <= 1) return cohort;
  const randomness = asHex32(randomnessHex, "cccRandomnessHex");
  const baseContext = asHex32(decisionContextHex, "cccDecisionContextHex");
  const remaining = [...cohort].sort((left, right) => left.qualificationPda.localeCompare(right.qualificationPda));
  const cohortHash = sha256(JSON.stringify(remaining.map(({ qualificationPda }) => qualificationPda)));
  const ordered = [];
  for (let rank = 0; remaining.length > 0; rank += 1) {
    const rankContext = sha256([
      "IAT_B3_CCC_CAPACITY_ORDER_V1", baseContext, cohort[0].priorityClass,
      cohort[0].qualifyingActivityStartSlot, cohort[0].nodeActivationSlot,
      cohort[0].eligibleSequence, cohortHash, rank,
    ].join("|"));
    const outcome = selectUniformTiebreakOutcome({
      randomnessHex: randomness,
      candidateCount: remaining.length,
      decisionContextHex: rankContext,
    });
    ordered.push(remaining.splice(outcome.index, 1)[0]);
  }
  return ordered;
}

export function orderCccCapacityCandidates(obligations, { randomnessHex = null, decisionContextHex = null } = {}) {
  if (new Set(obligations.map(({ qualificationPda }) => qualificationPda)).size !== obligations.length) {
    throw new Error("DUPLICATE_CCC_QUALIFICATION_PDA_IN_TIER");
  }
  const sorted = [...obligations].sort((left, right) => {
    if (left.qualifyingActivityStartSlot !== right.qualifyingActivityStartSlot) return left.qualifyingActivityStartSlot < right.qualifyingActivityStartSlot ? -1 : 1;
    if (left.nodeActivationSlot !== right.nodeActivationSlot) return left.nodeActivationSlot < right.nodeActivationSlot ? -1 : 1;
    if (left.eligibleSequence !== right.eligibleSequence) return left.eligibleSequence < right.eligibleSequence ? -1 : 1;
    return 0;
  });
  const ordered = [];
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (end < sorted.length
      && sorted[end].qualifyingActivityStartSlot === sorted[start].qualifyingActivityStartSlot
      && sorted[end].nodeActivationSlot === sorted[start].nodeActivationSlot
      && sorted[end].eligibleSequence === sorted[start].eligibleSequence) end += 1;
    ordered.push(...exactUniformCohortOrder(sorted.slice(start, end), randomnessHex, decisionContextHex));
    start = end;
  }
  return ordered;
}

function compareChronology(left, right) {
  for (const key of ["eligibleSequence", "activitySequence", "nodeSequence"]) {
    if (left.chronology[key] !== right.chronology[key]) return left.chronology[key] < right.chronology[key] ? -1 : 1;
  }
  return left.chronology.immutableIdentity.localeCompare(right.chronology.immutableIdentity)
    || left.chronology.commitmentDigest.localeCompare(right.chronology.commitmentDigest)
    || left.id.localeCompare(right.id);
}

function orderCapacityObligations(obligations, tieInput) {
  const ordered = [];
  for (const priorityClass of REWARD_PRIORITY_CLASSES) {
    const tier = obligations.filter((entry) => entry.priorityClass === priorityClass);
    ordered.push(...(CCC_CLASSES.has(priorityClass)
      ? orderCccCapacityCandidates(tier, tieInput)
      : tier.sort(compareChronology)));
  }
  return ordered;
}

function canonicalPreRandomnessOrder(obligations) {
  return [...obligations].sort((left, right) => {
    const classOrder = REWARD_PRIORITY_CLASSES.indexOf(left.priorityClass)
      - REWARD_PRIORITY_CLASSES.indexOf(right.priorityClass);
    if (classOrder !== 0) return classOrder;
    if (CCC_CLASSES.has(left.priorityClass)) {
      if (left.qualifyingActivityStartSlot !== right.qualifyingActivityStartSlot) {
        return left.qualifyingActivityStartSlot < right.qualifyingActivityStartSlot ? -1 : 1;
      }
      if (left.nodeActivationSlot !== right.nodeActivationSlot) {
        return left.nodeActivationSlot < right.nodeActivationSlot ? -1 : 1;
      }
      if (left.eligibleSequence !== right.eligibleSequence) {
        return left.eligibleSequence < right.eligibleSequence ? -1 : 1;
      }
      return left.qualificationPda.localeCompare(right.qualificationPda);
    }
    return compareChronology(left, right);
  });
}

function validateSealedCandidateUniqueness(normalized) {
  const xRewardIds = normalized.flatMap((entry) => {
    if (entry.kind === "X_BOUND_FUNDING") return [entry.rewardId];
    if (entry.kind === FACTION_MANIFEST_KIND) return entry.payoutEntries.map(({ rewardId }) => rewardId);
    return [];
  });
  if (new Set(xRewardIds).size !== xRewardIds.length) {
    throw new Error("DUPLICATE_X_BOUND_REWARD_SEMANTICS_IN_FUNDING_ROUND");
  }
  if (new Set(normalized.map(({ id }) => id)).size !== normalized.length) {
    throw new Error("DUPLICATE_REWARD_OBLIGATION_ID");
  }
  for (const priorityClass of CCC_CLASSES) {
    const tier = normalized.filter((entry) => entry.priorityClass === priorityClass);
    if (new Set(tier.map(({ qualificationPda }) => qualificationPda)).size !== tier.length) {
      throw new Error("DUPLICATE_CCC_QUALIFICATION_PDA_IN_TIER");
    }
  }
  if (normalized.filter(({ priorityClass }) => priorityClass === "WEEKLY_FACTION").length > 1) {
    throw new Error("ONE_AGGREGATE_WEEKLY_FACTION_MANIFEST_PER_FUNDING_ROUND");
  }
}

function validateCapacityRoundSeal(roundSeal) {
  if (!hasExactKeys(roundSeal, REWARD_CAPACITY_ROUND_SEAL_KEYS)
    || roundSeal.schema !== "iat-b3-reward-capacity-round-seal/v1"
    || roundSeal.status !== "SEALED_NON_ACTIVATING"
    || roundSeal.finalized !== false
    || !Array.isArray(roundSeal.candidates)
    || !Array.isArray(roundSeal.candidateIds)
    || !Number.isSafeInteger(roundSeal.candidateCount)
    || roundSeal.candidateCount < 0) throw new Error("INVALID_CAPACITY_ROUND_SEAL_KEY_SET_OR_TYPES");
  const fundingRound = assertUtcMidnight(
    asStoredI64(roundSeal.fundingRoundAtUnixSeconds, "round seal funding round"),
    "round seal funding round",
  );
  const sealedAt = asStoredI64(roundSeal.sealedAtUnixSeconds, "round seal boundary timestamp");
  if (sealedAt !== fundingRound) throw new Error("CAPACITY_ROUND_MUST_SEAL_AT_DESIGNATED_UTC_BOUNDARY");
  const candidateIds = roundSeal.candidateIds.map((id, index) => (
    asCanonicalHex32(id, `round seal candidate ID ${index}`)
  ));
  const candidateSetSha256 = asCanonicalHex32(roundSeal.candidateSetSha256, "round seal candidate-set digest");
  const storedLedgerSnapshotSha256 = asCanonicalHex32(
    roundSeal.ledgerSnapshotSha256,
    "round seal ledger snapshot digest",
  );
  const storedRegistrySnapshotSha256 = asCanonicalHex32(
    roundSeal.cccPrecommitRegistrySnapshotSha256,
    "round seal CCC precommit registry digest",
  );
  const storedDecisionContextSha256 = roundSeal.cccDecisionContextSha256 === null
    ? null
    : asCanonicalHex32(roundSeal.cccDecisionContextSha256, "round seal CCC decision context");
  const normalized = roundSeal.candidates.map((entry, index) => normalizeObligation(entry, index, fundingRound));
  validateSealedCandidateUniqueness(normalized);
  const canonical = canonicalPreRandomnessOrder(normalized);
  if (JSON.stringify(normalized.map(({ id }) => id)) !== JSON.stringify(canonical.map(({ id }) => id))) {
    throw new Error("CAPACITY_ROUND_CANDIDATES_MUST_BE_CANONICALLY_ORDERED");
  }
  const normalizedLedger = normalizeLedger(roundSeal.ledgerSnapshot);
  const ledgerSnapshotSha256 = canonicalStateSha256(normalizedLedger);
  const precommitRegistry = normalizeCccPrecommitRegistrySnapshot(
    roundSeal.cccPrecommitRegistrySnapshot,
    fundingRound,
  );
  if (roundSeal.candidateCount !== canonical.length
    || candidateSetSha256 !== canonicalStateSha256(canonical)
    || JSON.stringify(candidateIds) !== JSON.stringify(canonical.map(({ id }) => id))
    || storedLedgerSnapshotSha256 !== ledgerSnapshotSha256
    || storedRegistrySnapshotSha256 !== precommitRegistry.snapshotSha256) {
    throw new Error("CAPACITY_ROUND_SEAL_COMMITMENT_MISMATCH");
  }
  const tiePresent = cccTierHasExactTie(canonical);
  let revealCommitment = null;
  let decisionContext = null;
  if (tiePresent) {
    if (precommitRegistry.entries.length !== 1) {
      throw new Error("CCC_EXACT_TIE_REQUIRES_ONE_CANONICAL_PRECOMMIT_REGISTRY_ENTRY");
    }
    revealCommitment = precommitRegistry.entries[0];
    const storedRevealCommitment = normalizeCccRevealCommitment(
      roundSeal.cccRevealCommitment,
      fundingRound,
    );
    if (canonicalStateSha256(storedRevealCommitment) !== canonicalStateSha256(revealCommitment)) {
      throw new Error("CCC_REVEAL_COMMITMENT_DOES_NOT_MATCH_CANONICAL_PRECOMMIT_REGISTRY");
    }
    decisionContext = deriveCccDecisionContext({
      fundingRoundAtUnixSeconds: fundingRound,
      candidateSetSha256,
      ledgerSnapshotSha256,
      precommitRegistrySnapshotSha256: precommitRegistry.snapshotSha256,
      revealCommitment,
    });
    if (storedDecisionContextSha256 !== decisionContext) {
      throw new Error("CCC_DECISION_CONTEXT_NOT_DERIVED_FROM_SEALED_INPUTS");
    }
  } else if (precommitRegistry.entries.length !== 0
    || roundSeal.cccRevealCommitment !== null
    || storedDecisionContextSha256 !== null) {
    throw new Error("UNEXPECTED_CCC_REVEAL_COMMITMENT_WITHOUT_EXACT_TIE");
  }
  return {
    fundingRound,
    candidates: canonical,
    ledgerSnapshot: normalizedLedger,
    ledgerSnapshotSha256,
    cccPrecommitRegistrySnapshot: precommitRegistry,
    cccPrecommitRegistrySnapshotSha256: precommitRegistry.snapshotSha256,
    cccDecisionContextSha256: decisionContext,
  };
}

export function sealRewardCapacityRound(input) {
  assertDailyLawWriteAllowed(input?.dailyLawState);
  if (Object.hasOwn(input, "cccRevealCommitment") || Object.hasOwn(input, "existingSeal")) {
    throw new Error("CAPACITY_SEAL_REQUIRES_CANONICAL_PRECOMMIT_REGISTRY_AND_PERSISTED_ROUND_STATE");
  }
  const {
    fundingRoundAtUnixSeconds,
    sealedAtUnixSeconds,
    obligations,
    ledgerSnapshot,
    cccPrecommitRegistrySnapshot,
  } = input;
  const fundingRound = assertUtcMidnight(fundingRoundAtUnixSeconds, "fundingRoundAtUnixSeconds");
  const sealedAt = asI64(sealedAtUnixSeconds, "sealedAtUnixSeconds");
  if (sealedAt !== fundingRound) throw new Error("CAPACITY_ROUND_MUST_SEAL_AT_DESIGNATED_UTC_BOUNDARY");
  if (!Array.isArray(obligations)) throw new Error("obligations must be an array");
  const normalized = obligations.map((entry, index) => normalizeObligation(entry, index, fundingRound));
  validateSealedCandidateUniqueness(normalized);
  const candidates = canonicalPreRandomnessOrder(normalized).map((entry) => Object.freeze(entry));
  const sealedLedger = deepFreeze(normalizeLedger(ledgerSnapshot));
  const candidateSetSha256 = canonicalStateSha256(candidates);
  const ledgerSnapshotSha256 = canonicalStateSha256(sealedLedger);
  const normalizedPrecommitRegistry = deepFreeze(normalizeCccPrecommitRegistrySnapshot(
    cccPrecommitRegistrySnapshot,
    fundingRound,
  ));
  const tiePresent = cccTierHasExactTie(candidates);
  let normalizedRevealCommitment = null;
  let cccDecisionContextSha256 = null;
  if (tiePresent) {
    if (normalizedPrecommitRegistry.entries.length !== 1) {
      throw new Error("CCC_EXACT_TIE_REQUIRES_ONE_CANONICAL_PRECOMMIT_REGISTRY_ENTRY");
    }
    normalizedRevealCommitment = normalizedPrecommitRegistry.entries[0];
    cccDecisionContextSha256 = deriveCccDecisionContext({
      fundingRoundAtUnixSeconds: fundingRound,
      candidateSetSha256,
      ledgerSnapshotSha256,
      precommitRegistrySnapshotSha256: normalizedPrecommitRegistry.snapshotSha256,
      revealCommitment: normalizedRevealCommitment,
    });
  } else if (normalizedPrecommitRegistry.entries.length !== 0) {
    throw new Error("CCC_PRECOMMIT_REGISTRY_ENTRY_REQUIRES_EXACT_TIE");
  }
  const roundSeal = deepFreeze({
    schema: "iat-b3-reward-capacity-round-seal/v1",
    status: "SEALED_NON_ACTIVATING",
    fundingRoundAtUnixSeconds: fundingRound,
    sealedAtUnixSeconds: sealedAt,
    candidateCount: candidates.length,
    candidateIds: Object.freeze(candidates.map(({ id }) => id)),
    candidateSetSha256,
    candidates: Object.freeze(candidates),
    ledgerSnapshot: sealedLedger,
    ledgerSnapshotSha256,
    cccPrecommitRegistrySnapshot: normalizedPrecommitRegistry,
    cccPrecommitRegistrySnapshotSha256: normalizedPrecommitRegistry.snapshotSha256,
    cccRevealCommitment: normalizedRevealCommitment,
    cccDecisionContextSha256,
    finalized: false,
  });
  return deepFreeze({
    schema: ROUND_STATE_SCHEMA,
    status: "SEALED_PENDING_FINALIZATION",
    roundSeal,
    finalization: null,
  });
}

function validateCapacityRoundState(roundState) {
  if (!hasExactKeys(roundState, ["schema", "status", "roundSeal", "finalization"])
    || roundState.schema !== ROUND_STATE_SCHEMA) {
    throw new Error("INVALID_REWARD_CAPACITY_ROUND_STATE");
  }
  const validatedSeal = validateCapacityRoundSeal(roundState.roundSeal);
  if (roundState.finalization === null) {
    if (roundState.status !== "SEALED_PENDING_FINALIZATION") {
      throw new Error("INVALID_PENDING_REWARD_CAPACITY_ROUND_STATE");
    }
  } else if (roundState.status !== "FINALIZED_NON_ACTIVATING"
    || !isRecord(roundState.finalization)
    || roundState.finalization.schema !== "iat-b3-reward-capacity-round-finalization/v1"
    || roundState.finalization.status !== "FINALIZED_NON_ACTIVATING"
    || roundState.finalization.finalized !== true
    || roundState.finalization.activationReady !== false
    || roundState.finalization.fundingRoundAtUnixSeconds !== validatedSeal.fundingRound
    || roundState.finalization.sealSha256 !== canonicalStateSha256(roundState.roundSeal)) {
    throw new Error("INVALID_FINALIZED_REWARD_CAPACITY_ROUND_STATE");
  }
  return { roundSeal: roundState.roundSeal, finalization: roundState.finalization, validatedSeal };
}

function createAllocatorReceipt({ roundSeal, obligation, disposition, plannedByLane = null, reason = null }) {
  const core = {
    schema: ALLOCATOR_RECEIPT_SCHEMA,
    status: "NON_ACTIVATING_REFERENCE_RECEIPT",
    fundingRoundAtUnixSeconds: roundSeal.fundingRoundAtUnixSeconds,
    sealSha256: canonicalStateSha256(roundSeal),
    obligationId: obligation.id,
    obligationSha256: canonicalStateSha256(obligation),
    exactAmount: obligation.amount,
    disposition,
    plannedByLane,
    reason,
    factionPayoutDigest: obligation.kind === FACTION_MANIFEST_KIND ? obligation.payoutDigest : null,
    activationReady: false,
  };
  return Object.freeze({ ...core, receiptSha256: canonicalStateSha256(core) });
}

function computeCapacityAllocation({ roundSeal, cccRandomnessReveal = null }) {
  const {
    fundingRound,
    candidates: normalized,
    ledgerSnapshot,
    ledgerSnapshotSha256,
    cccDecisionContextSha256,
  } = validateCapacityRoundSeal(roundSeal);
  const reveal = verifyCccReveal(roundSeal, cccRandomnessReveal);
  const nextLedger = normalizeLedger(ledgerSnapshot);
  const ordered = orderCapacityObligations(normalized, {
    randomnessHex: reveal.randomnessHex,
    decisionContextHex: cccDecisionContextSha256,
  });
  const funded = [];
  const nullOutcomes = [];
  const orderedOutcomes = [];
  let blocked = false;
  for (const obligation of ordered) {
    if (blocked) {
      const disposition = "NULL_BLOCKED";
      const reason = "HIGHER_PRIORITY_OR_EARLIER_OBLIGATION_UNDERFUNDED";
      const allocatorReceipt = createAllocatorReceipt({ roundSeal, obligation, disposition, reason });
      const outcome = Object.freeze({ ...obligation, disposition, reason, allocatorReceipt });
      nullOutcomes.push(outcome);
      orderedOutcomes.push(outcome);
      continue;
    }
    const plannedByLane = planExactReservation(nextLedger, obligation.amount);
    if (!plannedByLane) {
      blocked = true;
      const disposition = "NULL_UNDERFUNDED";
      const reason = "EXACT_AMOUNT_NOT_AVAILABLE";
      const allocatorReceipt = createAllocatorReceipt({ roundSeal, obligation, disposition, reason });
      const outcome = Object.freeze({ ...obligation, disposition, reason, allocatorReceipt });
      nullOutcomes.push(outcome);
      orderedOutcomes.push(outcome);
      continue;
    }
    const disposition = "ADMITTED_RESERVED";
    const allocatorReceipt = createAllocatorReceipt({ roundSeal, obligation, disposition, plannedByLane });
    const outcome = Object.freeze({ ...obligation, disposition, plannedByLane, reason: null, allocatorReceipt });
    funded.push(outcome);
    orderedOutcomes.push(outcome);
  }
  const postLedgerSha256 = canonicalStateSha256(nextLedger);
  const receiptDigests = orderedOutcomes.map(({ allocatorReceipt }) => allocatorReceipt.receiptSha256);
  const outcomeCommitment = {
    sealSha256: canonicalStateSha256(roundSeal),
    preLedgerSha256: ledgerSnapshotSha256,
    postLedgerSha256,
    cccPrecommitRegistrySnapshotSha256: roundSeal.cccPrecommitRegistrySnapshotSha256,
    cccRevealCommitmentSha256: roundSeal.cccRevealCommitment?.commitmentSha256 ?? null,
    cccRevealSha256: reveal.revealSha256,
    cccRevealSourceId: reveal.sourceId,
    cccDecisionContextSha256,
    receiptDigests,
  };
  const finalization = Object.freeze({
    schema: "iat-b3-reward-capacity-round-finalization/v1",
    status: "FINALIZED_NON_ACTIVATING",
    fundingRoundAtUnixSeconds: fundingRound,
    sealSha256: outcomeCommitment.sealSha256,
    preLedgerSha256: ledgerSnapshotSha256,
    postLedgerSha256,
    cccPrecommitRegistrySnapshotSha256: outcomeCommitment.cccPrecommitRegistrySnapshotSha256,
    cccRevealCommitmentSha256: outcomeCommitment.cccRevealCommitmentSha256,
    cccRevealSha256: reveal.revealSha256,
    cccRevealSourceId: reveal.sourceId,
    cccDecisionContextSha256,
    receiptDigests: Object.freeze(receiptDigests),
    receiptSetSha256: canonicalStateSha256(receiptDigests),
    outcomeSha256: canonicalStateSha256(outcomeCommitment),
    finalized: true,
    activationReady: false,
  });
  return Object.freeze({
    fundingRoundAtUnixSeconds: fundingRound,
    ledger: nextLedger,
    funded,
    nullOutcomes,
    orderedIds: ordered.map(({ id }) => id),
    finalization,
  });
}

export function allocateRewardCapacity(input) {
  assertDailyLawWriteAllowed(input?.dailyLawState);
  if (Object.hasOwn(input, "ledger")) throw new Error("CAPACITY_LEDGER_MUST_COME_FROM_BOUNDARY_SEAL");
  if (Object.hasOwn(input, "roundSeal") || Object.hasOwn(input, "existingFinalization")) {
    throw new Error("ALLOCATION_REQUIRES_TYPED_BY_VALUE_ROUND_STATE");
  }
  if (Object.hasOwn(input, "cccRandomnessHex") || Object.hasOwn(input, "cccDecisionContextHex")) {
    throw new Error("FREE_CCC_RANDOMNESS_OR_DECISION_CONTEXT_FORBIDDEN");
  }
  const { roundState, cccRandomnessReveal = null } = input;
  const validatedState = validateCapacityRoundState(roundState);
  if (validatedState.finalization !== null) throw new Error("CAPACITY_ROUND_ALREADY_FINALIZED_NO_REPLAY");
  const allocation = computeCapacityAllocation({
    roundSeal: validatedState.roundSeal,
    cccRandomnessReveal,
  });
  const finalizedRoundState = deepFreeze({
    schema: ROUND_STATE_SCHEMA,
    status: "FINALIZED_NON_ACTIVATING",
    roundSeal: validatedState.roundSeal,
    finalization: allocation.finalization,
  });
  return Object.freeze({ ...allocation, roundState: finalizedRoundState });
}

export function logicalMissedFundingOutcome(obligation, {
  roundState = null,
  nowUnixSeconds,
} = {}) {
  if (!isRecord(obligation)) throw new Error("obligation is required");
  const fundingRound = assertUtcMidnight(obligation.fundingRoundAtUnixSeconds, "obligation funding round");
  const now = asI64(nowUnixSeconds, "nowUnixSeconds");
  const missDecidableAtUnixSeconds = asI64(fundingRound + 1n, "missDecidableAtUnixSeconds");
  if (now < missDecidableAtUnixSeconds) throw new Error("FUNDING_ROUND_NOT_YET_DECIDABLE");
  if (roundState === null) {
    return Object.freeze({
      ...obligation,
      disposition: "NULL_MISSED",
      reason: "DESIGNATED_ROUND_UNSEALED_AT_BOUNDARY",
      missDecidableAtUnixSeconds,
    });
  }
  const { validatedSeal: validated } = validateCapacityRoundState(roundState);
  if (validated.fundingRound !== fundingRound) throw new Error("OBLIGATION_AND_SEAL_FUNDING_ROUND_MISMATCH");
  let normalized;
  let sealedCandidate;
  let sealedEntry = null;
  if (obligation.kind === FACTION_FRAGMENT_KIND) {
    normalized = normalizeFactionFragment(obligation, 0, fundingRound);
    sealedCandidate = validated.candidates.find((candidate) => candidate.kind === FACTION_MANIFEST_KIND
      && candidate.payoutEntries.some(({ fragmentId }) => fragmentId === obligation.id));
    sealedEntry = sealedCandidate?.payoutEntries.find(({ fragmentId }) => fragmentId === obligation.id) ?? null;
  } else {
    normalized = normalizeObligation(obligation, 0, fundingRound);
    sealedCandidate = validated.candidates.find(({ id }) => id === normalized.id);
  }
  if (!sealedCandidate) {
    return Object.freeze({
      ...obligation,
      disposition: "NULL_MISSED",
      reason: "OMITTED_FROM_DESIGNATED_ROUND_SEAL",
      missDecidableAtUnixSeconds,
    });
  }
  if ((obligation.kind === FACTION_FRAGMENT_KIND
    && canonicalStateSha256(sealedEntry) !== canonicalStateSha256(normalized))
    || (obligation.kind !== FACTION_FRAGMENT_KIND
      && canonicalStateSha256(sealedCandidate) !== canonicalStateSha256(normalized))) {
    throw new Error("OBLIGATION_CONFLICTS_WITH_SEALED_CANDIDATE");
  }
  return null;
}

export function applyXBoundMissedFundingOutcome({
  dailyLawState,
  reward,
  fundingRoundAtUnixSeconds,
  roundState = null,
  nowUnixSeconds,
}) {
  assertDailyLawWriteAllowed(dailyLawState);
  validateXBoundRewardReferenceState(reward);
  const expected = buildXBoundFundingObligation({ reward, fundingRoundAtUnixSeconds });
  if (!expected) throw new Error("NO_X_TRANCHE_DUE_IN_FUNDING_ROUND");
  const missed = logicalMissedFundingOutcome(expected, { roundState, nowUnixSeconds });
  if (missed === null) throw new Error("X_FUNDING_OBLIGATION_PRESENT_IN_DESIGNATED_ROUND");
  const dueKinds = new Set(expected.trancheKinds);
  let baseTranche = dueKinds.has(X_TRANCHE_KIND.BASE)
    ? tranche(
      X_TRANCHE_KIND.BASE,
      reward.baseTranche.amount,
      reward.baseTranche.fundingRoundAtUnixSeconds,
      reward.baseTranche.eligibleSequence,
      "NULL_MISSED",
    )
    : reward.baseTranche;
  const premiumFullTranche = dueKinds.has(X_TRANCHE_KIND.PREMIUM_FULL)
    ? tranche(
      X_TRANCHE_KIND.PREMIUM_FULL,
      reward.premiumFullTranche.amount,
      reward.premiumFullTranche.fundingRoundAtUnixSeconds,
      reward.premiumFullTranche.eligibleSequence,
      "NULL_MISSED",
    )
    : reward.premiumFullTranche;
  let upgradeTranche = dueKinds.has(X_TRANCHE_KIND.UPGRADE)
    ? tranche(
      X_TRANCHE_KIND.UPGRADE,
      reward.upgradeTranche.amount,
      reward.upgradeTranche.fundingRoundAtUnixSeconds,
      reward.upgradeTranche.eligibleSequence,
      "NULL_MISSED",
    )
    : reward.upgradeTranche;
  if (dueKinds.has(X_TRANCHE_KIND.BASE)) {
    baseTranche = tranche(
      X_TRANCHE_KIND.BASE,
      baseTranche.amount,
      baseTranche.fundingRoundAtUnixSeconds,
      baseTranche.eligibleSequence,
      "NULL_MISSED",
    );
    upgradeTranche = tranche(
      X_TRANCHE_KIND.UPGRADE,
      upgradeTranche.amount,
      upgradeTranche.fundingRoundAtUnixSeconds,
      upgradeTranche.eligibleSequence,
      "NULL_PARENT_UNFUNDED",
    );
  }
  return Object.freeze({ ...reward, baseTranche, premiumFullTranche, upgradeTranche });
}

export const REWARD_CAPACITY_POLICY = deepFreeze(validateRewardCapacityPolicy(policy));

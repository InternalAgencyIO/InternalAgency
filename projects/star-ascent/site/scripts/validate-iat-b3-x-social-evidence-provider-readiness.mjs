#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { REFERENCE_DEPLOYMENT_DOMAIN_SHA256 } from "../programs/iat_b3_reference/reward-allocator-receipt-codec.mjs";
import {
  REWARD_CAS_EXTERNAL_NAMESPACE_SHA256,
  REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256,
} from "../programs/iat_b3_reference/reward-persistence-checkpoint.mjs";
import {
  canonicalizeRfc8785,
  sha256CanonicalJson,
} from "./iat-v2-canonical-json.mjs";

export const X_SOCIAL_EVIDENCE_READINESS_SCHEMA =
  "iat-b3-x-social-evidence-provider-readiness/v1";
export const X_SOCIAL_EVIDENCE_READINESS_STATUS =
  "NON_ACTIVATING_X_SOCIAL_EVIDENCE_REVIEW_PACKET";
export const X_SOCIAL_EVIDENCE_MAINNET_STATUS = "HOLD";
export const X_SOCIAL_EVIDENCE_MAX_AGE_SECONDS = 2_592_000n;

const U64_MAX = (1n << 64n) - 1n;
const HEX_32 = /^[0-9a-f]{64}$/u;
const CANONICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$/u;
const GENERIC_URL = /^[a-z][a-z0-9+.-]*:\/\//iu;
const PLACEHOLDER = /^(?:blocked|change[-_ ]?me|none|null|pending|placeholder|replace[-_ ]?me|tbd|todo|unknown|x+|0+)$/iu;
const NON_PRODUCTION_MARKER = /(?:^|[._:/-])(?:dev|dummy|example|fake|fixture|invalid|local|mock|sample|sandbox|staging|synthetic|test)(?:$|[._:/-])/iu;
const OBVIOUS_NON_PRODUCTION_PREFIX = /^(?:dummy|example|fake|fixture|local|mock|sample|synthetic|test)(?:app|artifact|collector|domain|evidence|key|observer|project|provider|registry|resource|reviewer|service|tenant|verifier)/iu;
const LOW_ENTROPY_ID = /^(.)\1{7,}$/u;
const REPEATED_NIBBLE_SHA256 = /^([0-9a-f])\1{63}$/u;
const NEAR_ZERO_SHA256 = /^0{48,}[0-9a-f]+$/u;
const PLACEHOLDER_FRAGMENT = /(?:^|[._:/-])(?:blocked|change[-_]?me|pending|placeholder|replace[-_]?me|tbd|todo|unknown)(?:$|[._:/-])/iu;

const TOP_LEVEL_KEYS = Object.freeze([
  "$schema",
  "schema",
  "profile",
  "readiness",
  "status",
  "scope",
  "referenceContract",
  "subjectBinding",
  "xProviderBinding",
  "walletAndIdentityBinding",
  "collectorAndTargetBinding",
  "receiptTrustBinding",
  "privacyTermsAndRetention",
  "failureDomainSeparation",
  "controlRequirements",
  "terminalPredicate",
  "providerEvidenceAuthenticationVerified",
  "collectorCompletenessVerified",
  "walletBindingAuthenticationVerified",
  "allocatorLineageAuthenticationVerified",
  "externalMonotonicityVerified",
  "rollbackProtectionVerified",
  "runtimeConsumerGatingVerified",
  "activationReady",
  "mainnetOrReleaseReady",
  "mainnetStatus",
]);

const SCOPE_EXCLUSIONS = Object.freeze([
  "PROVIDER_OPERATIONAL_TRUTH",
  "X_ACCOUNT_EQUALS_ONE_BIOLOGICAL_HUMAN",
  "BIOLOGICAL_SYBIL_RESISTANCE",
  "COLLECTOR_COMPLETENESS",
  "RUNTIME_AUTHENTICATION",
  "EXTERNAL_MONOTONICITY_OR_ROLLBACK_PROTECTION",
  "MAINNET_OR_RELEASE_READINESS",
  "ACTIVATION_PAYMENT_OR_MINT_AUTHORITY",
]);

export const X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT = Object.freeze({
  rewardPolicySchema: "star-ascent-daily-rewards-policy/v2",
  rewardLedgerSchemaVersion: 2,
  rewardCapacityPolicySchema: "iat-b3-reward-capacity-waterfall/v1",
  dailyLawId: "IAT_B3_DAILY_LOCKDOWN_LAW_V1",
  oauthScopes: Object.freeze(["users.read"]),
  recognizedSubscriptionTypes: Object.freeze(["None", "Basic", "Premium", "PremiumPlus"]),
  tenPercentSubscriptionTypes: Object.freeze(["None", "Basic"]),
  fullRewardSubscriptionTypes: Object.freeze(["Premium", "PremiumPlus"]),
  verifiedBooleanPayoutRole: "INFORMATIONAL_ONLY_NEVER_ELIGIBILITY_OR_AMOUNT_KEY",
  minimumXAccountAgeDays: 40,
  subscriptionObservationMaximumAgeHours: 24,
  qualifyingActions: Object.freeze(["original", "reply", "quote", "repost", "like", "follow"]),
  actionAliases: Object.freeze({ retweet: "repost" }),
  postActions: Object.freeze(["original", "reply", "quote", "repost"]),
  collectorFirstObservedActions: Object.freeze(["like", "follow"]),
  trancheBasisPoints: Object.freeze({
    X_BASE_10: 1_000,
    X_PREMIUM_FULL_100: 10_000,
    X_PREMIUM_UPGRADE_90: 9_000,
  }),
  rewardSourceKinds: Object.freeze(["X_INTERACTION", "GENESIS_AIRDROP"]),
  upgradeProofRule:
    "SAME_X_ID_AND_WALLET_FRESH_LATER_PREMIUM_ACCEPTED_AFTER_ORIGINAL_ROUND_BEFORE_EXPIRY",
  upgradeDecisionBoundary: "NEXT_UTC_00:00_STRICTLY_AFTER_PROOF_ACCEPTANCE",
  dailyDecisionBoundary: "EXACT_UTC_00:00_ALL_OR_NULL_NO_BACKFILL",
  partialPaymentsAllowed: false,
  providerIntegrationPresent: false,
});

const PACKET_COMMON_KEYS = Object.freeze(["status", "environment", "evidence", "blocker"]);
const CONTROL_KEYS = Object.freeze(["id", "status", "requiredClaims", "evidence", "blocker"]);
const TERMINAL_KEYS = Object.freeze(["status", "requiredSections", "evaluationRule", "blocker"]);
const EVIDENCE_KEYS = Object.freeze([
  "evidenceKind",
  "artifactSha256",
  "subjectBindingSha256",
  "policySha256",
  "independentObserverId",
  "observerFailureDomainId",
  "observerIdentitySha256",
  "independentReviewerId",
  "reviewerFailureDomainId",
  "reviewerIdentitySha256",
  "capturedAtUnixSeconds",
  "validThroughUnixSeconds",
  "maximumAgeSeconds",
  "environment",
  "evidenceDescriptorSha256",
]);
const EVIDENCE_DESCRIPTOR_KEYS = Object.freeze(EVIDENCE_KEYS.filter(
  (key) => key !== "evidenceDescriptorSha256",
));

const section = ({ id, key, shaKeys = [], idKeys = [], constants = {} }) => Object.freeze({
  id,
  key,
  shaKeys: Object.freeze(shaKeys),
  idKeys: Object.freeze(idKeys),
  constants: Object.freeze(constants),
  valueKeys: Object.freeze([...shaKeys, ...idKeys, ...Object.keys(constants)]),
});

export const X_SOCIAL_EVIDENCE_SECTION_SPECS = Object.freeze([
  section({
    id: "SUBJECT_BINDING",
    key: "subjectBinding",
    shaKeys: [
      "productionIdentityFreezeManifestSha256",
      "productionCheckpointProviderReviewPacketSha256",
      "productionDeploymentDomainSha256",
      "productionPersistenceIdentitySha256",
      "rewardPolicyArtifactSha256",
      "rewardLedgerSchemaArtifactSha256",
      "epochEngineArtifactSha256",
      "rewardCapacityPolicySha256",
      "dailyLawBindingSha256",
      "actionEvidenceContractSha256",
      "sourceLineageContractSha256",
    ],
  }),
  section({
    id: "X_PROVIDER_BINDING",
    key: "xProviderBinding",
    shaKeys: [
      "oauthScopePolicySha256",
      "termsSha256",
      "rateLimitPolicySha256",
      "paginationPolicySha256",
      "tierObservationPolicySha256",
    ],
    idKeys: [
      "providerLegalEntityId",
      "developerProjectId",
      "applicationId",
      "apiProductId",
      "apiVersion",
      "oauthAuthorizationEndpointId",
      "oauthTokenEndpointId",
      "userLookupEndpointId",
    ],
  }),
  section({
    id: "WALLET_AND_IDENTITY_BINDING",
    key: "walletAndIdentityBinding",
    shaKeys: [
      "walletChallengeDomainSha256",
      "countryEvidencePolicySha256",
      "accountAgePolicySha256",
      "identityUniquenessPolicySha256",
      "tombstonePolicySha256",
    ],
    idKeys: [
      "walletChallengeFormatId",
      "walletVerifierServiceId",
      "bindingStoreResourceId",
      "identityTombstoneStoreResourceId",
    ],
    constants: {
      sybilClaimBoundary: "ONE_X_ID_ONE_WALLET_NOT_ONE_BIOLOGICAL_HUMAN",
    },
  }),
  section({
    id: "COLLECTOR_AND_TARGET_BINDING",
    key: "collectorAndTargetBinding",
    shaKeys: [
      "activityCollectionPolicySha256",
      "campaignTargetRegistrySha256",
      "finalizedSlotPolicySha256",
      "completenessPolicySha256",
      "replayPolicySha256",
    ],
    idKeys: [
      "collectorServiceId",
      "collectorResourceId",
      "collectorRegionPolicyId",
      "campaignTargetRegistryResourceId",
      "finalizedSlotProviderId",
      "replayStoreResourceId",
    ],
  }),
  section({
    id: "RECEIPT_TRUST_BINDING",
    key: "receiptTrustBinding",
    shaKeys: [
      "receiptDomainSha256",
      "trustRootSha256",
      "rotationPolicySha256",
      "revocationPolicySha256",
      "compromisePolicySha256",
      "antiReplayPolicySha256",
    ],
    idKeys: [
      "receiptFormatId",
      "signatureAlgorithmId",
      "keyRegistryResourceId",
      "currentKeyId",
    ],
  }),
  section({
    id: "PRIVACY_TERMS_AND_RETENTION",
    key: "privacyTermsAndRetention",
    shaKeys: [
      "privacyPolicySha256",
      "xTermsSha256",
      "dataInventorySha256",
      "retentionScheduleSha256",
      "deletionAndAppealPolicySha256",
      "tombstonePseudonymizationPolicySha256",
      "incidentResponsePolicySha256",
    ],
    idKeys: ["privacyPolicyVersion", "xTermsVersion"],
  }),
  section({
    id: "FAILURE_DOMAIN_SEPARATION",
    key: "failureDomainSeparation",
    idKeys: [
      "xProviderFailureDomainId",
      "collectorRuntimeFailureDomainId",
      "finalizedSlotFailureDomainId",
      "localPersistenceFailureDomainId",
      "externalCheckpointFailureDomainId",
      "administrativeFailureDomainId",
      "credentialCustodyFailureDomainId",
      "backupFailureDomainId",
      "independentObserverFailureDomainId",
      "independentReviewerFailureDomainId",
    ],
    constants: {
      separationRule:
        "X_PROVIDER_COLLECTOR_FINALITY_LOCAL_DB_CHECKPOINT_ADMIN_CREDENTIAL_BACKUP_OBSERVER_AND_REVIEWER_DOMAINS_ALL_DISTINCT",
    },
  }),
]);

export const X_SOCIAL_EVIDENCE_CONTROL_SPECS = Object.freeze([
  Object.freeze({
    id: "OAUTH_PKCE_IMMUTABLE_X_ID_AND_ACCOUNT_AGE",
    claims: Object.freeze([
      "AUTHORIZATION_CODE_PKCE_EXACT_REDIRECT_AND_LEAST_SCOPE",
      "AUTHENTICATED_CANONICAL_NUMERIC_X_USER_ID",
      "PROVIDER_CREATED_AT_PROVES_AT_LEAST_40_FULL_DAYS_AT_ACCEPTANCE",
      "TOKEN_CUSTODY_AND_DISCARD_RULES_ARE_ENFORCED",
      "MISSING_UNKNOWN_MALFORMED_OR_PROVIDER_ERROR_FAILS_CLOSED",
    ]),
  }),
  Object.freeze({
    id: "WALLET_ONE_TO_ONE_AND_TOMBSTONES",
    claims: Object.freeze([
      "DOMAIN_SEPARATED_WALLET_CHALLENGE_BINDS_X_ID_WALLET_NONCE_AND_EXPIRY",
      "SIGNATURE_IS_VERIFIED_BEFORE_IDENTITY_ACCEPTANCE",
      "ONE_IMMUTABLE_X_ID_MAPS_TO_ONE_WALLET_AND_ONE_WALLET_TO_ONE_X_ID",
      "REBINDING_AND_REPLAY_TOMBSTONES_ARE_APPEND_ONLY",
      "BIOLOGICAL_ONE_HUMAN_OR_STRONG_SYBIL_RESISTANCE_IS_NOT_CLAIMED",
    ]),
  }),
  Object.freeze({
    id: "TIER_OBSERVATION_FRESHNESS_AND_ACCEPTANCE_TIMING",
    claims: Object.freeze([
      "EXACT_SUBSCRIPTION_TYPE_IS_PROVIDER_OBSERVED_AND_RECEIPT_BOUND",
      "ONLY_NONE_BASIC_PREMIUM_AND_PREMIUMPLUS_ARE_ADMITTED",
      "OBSERVATION_IS_AT_MOST_24_HOURS_OLD_AT_EXACT_DECISION_ACCEPTANCE",
      "VERIFIED_BOOLEAN_IS_INFORMATIONAL_ONLY",
      "STALE_MISSING_UNKNOWN_OR_FAILED_TIER_OBSERVATION_FAILS_CLOSED",
    ]),
  }),
  Object.freeze({
    id: "EXACT_TEN_NINETY_FULL_AND_UPGRADE_RULES",
    claims: Object.freeze([
      "NONE_OR_BASIC_MAPS_TO_ATOMIC_X_BASE_10_AND_UNRESERVED_X_PREMIUM_UPGRADE_90",
      "PREMIUM_OR_PREMIUMPLUS_MAPS_TO_ATOMIC_X_PREMIUM_FULL_100_ONLY",
      "UPGRADE_REQUIRES_SAME_X_ID_WALLET_AUTHENTICATED_BASE_ADMISSION_AND_FRESH_LATER_PREMIUM",
      "UPGRADE_IS_ACCEPTED_AFTER_ORIGINAL_ROUND_BEFORE_EXPIRY_AND_DECIDED_NEXT_UTC_MIDNIGHT",
      "NO_PARTIAL_PAYMENT_DEBT_RETRY_OR_BACKFILL_IS_ALLOWED",
    ]),
  }),
  Object.freeze({
    id: "SIX_ACTIONS_AND_RETWEET_NORMALIZATION",
    claims: Object.freeze([
      "ONLY_ORIGINAL_REPLY_QUOTE_REPOST_LIKE_AND_FOLLOW_QUALIFY",
      "RETWEET_NORMALIZES_TO_REPOST_BEFORE_HASH_KEY_REPLAY_AND_SELECTION",
      "ONE_NODE_HAS_AT_MOST_ONE_DAILY_REWARD_CANDIDATE",
      "PRIVATE_OR_UNATTRIBUTABLE_ACTIONS_FAIL_CLOSED",
    ]),
  }),
  Object.freeze({
    id: "POST_ACTION_PROVIDER_EVIDENCE",
    claims: Object.freeze([
      "ORIGINAL_REPLY_QUOTE_AND_REPOST_BIND_CANONICAL_NUMERIC_POST_ID",
      "PROVIDER_CREATED_AT_IS_INSIDE_THE_CLOSED_UTC_EPOCH",
      "ACTOR_X_ID_EQUALS_THE_IMMUTABLY_BOUND_X_ID",
      "DELETED_UNAVAILABLE_OR_UNATTRIBUTABLE_POST_EVIDENCE_FAILS_CLOSED",
    ]),
  }),
  Object.freeze({
    id: "LIKE_FOLLOW_FIRST_OBSERVED_FINALITY",
    claims: Object.freeze([
      "CALLER_ACTION_ID_AND_OCCURRENCE_TIMESTAMP_ARE_FORBIDDEN",
      "SYNTHETIC_ID_BINDS_ACTION_ACTOR_AND_CANONICAL_TARGET",
      "FIRST_OBSERVED_TIME_IS_INSIDE_THE_CLOSED_EPOCH",
      "ACTIVITY_SLOT_EQUALS_APPEND_ONLY_FIRST_OBSERVED_FINALIZED_SOLANA_SLOT",
      "UNLIKE_UNFOLLOW_CURSOR_GAP_AND_OUTAGE_AMBIGUITY_FAIL_CLOSED",
    ]),
  }),
  Object.freeze({
    id: "CAMPAIGN_TARGET_AUTHORITY",
    claims: Object.freeze([
      "IMMUTABLE_TARGET_REGISTRY_BINDS_NUMERIC_ACCOUNT_OR_POST_ID_KIND_AND_VALIDITY_WINDOW",
      "ACTION_BINDS_EXACT_TARGET_EVIDENCE_DIGEST_AND_REGISTRY_REVISION",
      "UNBOUND_EXPIRED_FORKED_OR_MUTATED_TARGETS_FAIL_CLOSED",
    ]),
  }),
  Object.freeze({
    id: "COLLECTOR_COMPLETENESS_PAGINATION_AND_REPLAY",
    claims: Object.freeze([
      "EVERY_ACTION_SOURCE_HAS_PINNED_API_VERSION_CURSOR_AND_PAGINATION_SEMANTICS",
      "RATE_LIMIT_PAGE_GAP_PARTIAL_WINDOW_AND_PROVIDER_OUTAGE_FAIL_CLOSED",
      "CANONICAL_ACTION_KEYS_ARE_GLOBALLY_APPEND_ONLY_AND_REPLAY_UNIQUE",
      "COMPLETE_CLOSED_EPOCH_SNAPSHOT_IS_CONTENT_ADDRESSED_AND_INDEPENDENTLY_OBSERVED",
    ]),
  }),
  Object.freeze({
    id: "GENESIS_FIRST_1000_COMPLETE_REGISTRY",
    claims: Object.freeze([
      "GENESIS_BINDS_COMPLETE_AUTHENTICATED_FIRST_1000_REGISTRY_SNAPSHOT",
      "RESERVATION_SEQUENCE_IS_CONTIGUOUS_IMMUTABLE_AND_NOT_ARRAY_POSITION",
      "LEGACY_PREMIUM_ONLY_STATE_HAS_REVIEWED_MIGRATION_OR_EXPLICIT_REJECTION",
      "OMITTED_DUPLICATE_REBOUND_OR_LATE_RESERVATION_FAILS_CLOSED",
    ]),
  }),
  Object.freeze({
    id: "AUTHENTICATED_RECEIPTS_AND_KEY_LIFECYCLE",
    claims: Object.freeze([
      "VERSIONED_DOMAIN_SEPARATED_RECEIPT_BINDS_REQUEST_RESPONSE_SUBJECT_AND_ENVIRONMENT",
      "SIGNATURE_TRUST_ROOT_KEY_ID_AND_ANTI_REPLAY_STATE_ARE_VERIFIED",
      "RECEIPT_SEQUENCE_NEVER_DECREASES_AND_SAME_SEQUENCE_DIFFERENT_DIGEST_IS_REJECTED",
      "ROTATION_HAS_BOUNDED_OVERLAP_AND_EXPLICIT_ACTIVATION_SEQUENCE",
      "REVOCATION_AND_COMPROMISE_CUTOFF_FAIL_CLOSED",
      "SIGNING_CREDENTIALS_ARE_ISOLATED_FROM_PROVIDER_RUNTIME_ADMIN_AND_BACKUP_DOMAINS",
      "CALLER_BOOLEANS_OR_SELF_ATTESTATION_NEVER_AUTHENTICATE_EVIDENCE",
    ]),
  }),
  Object.freeze({
    id: "OUTAGE_RATE_LIMIT_AND_UNCERTAIN_RESPONSE",
    claims: Object.freeze([
      "PROVIDER_OR_COLLECTOR_ERROR_NEVER_COERCES_TO_NONE_BASIC_OR_QUALIFYING_ACTION",
      "UNCERTAIN_WRITE_RESPONSE_RECONCILES_ONLY_BY_EXACT_AUTHENTICATED_READBACK",
      "ALTERNATE_OR_STALE_RETRY_IS_REJECTED_WITHOUT_DUPLICATION",
      "MISSED_UTC_BOUNDARY_IS_NULL_WITH_NO_LATE_BACKFILL",
    ]),
  }),
  Object.freeze({
    id: "PRIVACY_TERMS_RETENTION_AND_ERASURE",
    claims: Object.freeze([
      "DATA_INVENTORY_AND_LEAST_SCOPE_BIND_EVERY_COLLECTED_FIELD_AND_PURPOSE",
      "X_TERMS_PRIVACY_AND_API_POLICY_VERSIONS_ARE_PINNED_AND_REVIEWED",
      "TOKEN_RECEIPT_ACTION_AND_AUDIT_RETENTION_WINDOWS_ARE_EXACT",
      "DELETION_APPEAL_AND_INCIDENT_PATHS_PRESERVE_NON_REBINDING_WITHOUT_UNNECESSARY_PII",
      "TOMBSTONE_PSEUDONYMIZATION_AND_LEGAL_BASIS_ARE_INDEPENDENTLY_REVIEWED",
    ]),
  }),
  Object.freeze({
    id: "BACKUP_RESTORE_DR_AND_ROLLBACK_DETECTION",
    claims: Object.freeze([
      "CLOSED_DATABASE_COPY_RESTORE_AND_BACKUP_API_RESTORE_DRILLS_ARE_EVIDENCED",
      "PROVIDER_OUTAGE_AND_COLLECTOR_RECOVERY_DRILLS_FAIL_CLOSED",
      "SINK_OR_LOCAL_ROLLBACK_AND_FORK_ARE_EXTERNALLY_DETECTED",
      "EXTERNAL_CHECKPOINT_ADVANCES_EXACTLY_ONE_RETAINED_LOCAL_COMMIT_WITH_NO_SKIP_OR_FORK",
      "NO_EXTERNAL_CHECKPOINT_REWIND_OR_UNAUTHENTICATED_RESEED_IS_ALLOWED",
    ]),
  }),
  Object.freeze({
    id: "DAILY_LAW_FIRST_AND_CONSUMER_GATING",
    claims: Object.freeze([
      "EVERY_EVIDENCE_WRITE_OR_PREPARATION_CHECKS_DAILY_LAW_BEFORE_PROVIDER_STORE_OR_CALLER_DATA",
      "EVERY_ACCEPTED_EVIDENCE_RECEIPT_BINDS_THE_EXACT_LOCAL_CAS_HEAD",
      "UNANCHORED_OR_UNAUTHENTICATED_STATE_BLOCKS_THE_NEXT_LOCAL_REWARD_WRITE",
      "UNANCHORED_OR_UNAUTHENTICATED_STATE_BLOCKS_GENESIS_DAILY_UPGRADE_ALLOCATOR_CAS_AND_ALL_DOWNSTREAM_CONSUMERS",
      "LOCKED_OR_UNFINALIZED_DAILY_LAW_STATE_CANNOT_ADVANCE_CURSOR_RECEIPT_TOMBSTONE_OR_REWARD_STATE",
    ]),
  }),
  Object.freeze({
    id: "SOURCE_KIND_LINEAGE_ALLOCATOR_AND_PERSISTENCE",
    claims: Object.freeze([
      "BUILDER_SCHEMA_DERIVES_GENESIS_AIRDROP_OR_X_INTERACTION_SOURCE_KIND",
      "CALLER_CANNOT_SELECT_SOURCE_TRANCHE_AMOUNT_CLASS_PRIORITY_OR_LINEAGE",
      "UPGRADE_BINDS_AUTHENTICATED_ORIGINAL_BASE_ADMISSION_RECEIPT_AND_EXACT_DESCENDANT_LINEAGE",
      "COMPLETE_CROSS_CLASS_DUE_SET_ALLOCATOR_RECEIPT_AND_CAS_HEAD_ARE_ATOMICALLY_PERSISTED",
      "SOURCE_CHRONOLOGY_FINALIZED_SLOT_AND_TARGET_EVIDENCE_SURVIVE_REOPEN_AND_REPLAY",
    ]),
  }),
  Object.freeze({
    id: "INDEPENDENT_AUDIT_AND_PRODUCTION_REVIEW",
    claims: Object.freeze([
      "EVERY_REQUIRED_CONTROL_HAS_CONTENT_ADDRESSED_SUBJECT_AND_POLICY_BOUND_EVIDENCE",
      "OBSERVER_AND_REVIEWER_IDENTITIES_ARE_DISTINCT_FROM_PROVIDER_RUNTIME_ADMIN_CREDENTIAL_AND_BACKUP_DOMAINS",
      "DECLARED_EVIDENCE_INTERVAL_IS_BOUNDED_AND_CONTAINS_EXPLICIT_EVALUATION_TIME",
      "STRUCTURAL_PACKET_COMPLETENESS_DOES_NOT_CERTIFY_PROVIDER_TRUTH_AUTHENTICATION_SYBIL_RESISTANCE_OR_LAUNCH_READINESS",
    ]),
  }),
]);

export const REQUIRED_X_SOCIAL_EVIDENCE_SECTIONS = Object.freeze([
  ...X_SOCIAL_EVIDENCE_SECTION_SPECS.map(({ id }) => id),
  ...X_SOCIAL_EVIDENCE_CONTROL_SPECS.map(({ id }) => id),
]);

const fixtureSha256 = (label) => sha256CanonicalJson({
  domain: "iat-b3-x-social-evidence-provider-readiness-fixture/v1",
  label,
});

const fixtureSectionValues = Object.freeze(Object.fromEntries(
  X_SOCIAL_EVIDENCE_SECTION_SPECS.map((spec) => [
    spec.id,
    Object.freeze(Object.fromEntries(spec.valueKeys.map((key) => {
      if (Object.hasOwn(spec.constants, key)) return [key, spec.constants[key]];
      if (spec.shaKeys.includes(key)) return [key, fixtureSha256(`${spec.id}:${key}`)];
      return [key, `fixture-${spec.id.toLowerCase().replaceAll("_", "-")}-${key.toLowerCase()}`.slice(0, 160)];
    }))),
  ]),
));

function evidenceIdentityBindingSha256(role, identityId, failureDomainId) {
  return sha256CanonicalJson({
    domain: "iat-b3-x-social-evidence-independent-identity/v1",
    role,
    identityId,
    failureDomainId,
  });
}

const fixtureObserverId = "fixture-independent-observer";
const fixtureReviewerId = "fixture-independent-reviewer";
const fixtureObserverFailureDomainId =
  fixtureSectionValues.FAILURE_DOMAIN_SEPARATION.independentObserverFailureDomainId;
const fixtureReviewerFailureDomainId =
  fixtureSectionValues.FAILURE_DOMAIN_SEPARATION.independentReviewerFailureDomainId;

export const TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES = Object.freeze({
  sections: fixtureSectionValues,
  independentObserverId: fixtureObserverId,
  observerFailureDomainId: fixtureObserverFailureDomainId,
  observerIdentitySha256: evidenceIdentityBindingSha256(
    "OBSERVER",
    fixtureObserverId,
    fixtureObserverFailureDomainId,
  ),
  independentReviewerId: fixtureReviewerId,
  reviewerFailureDomainId: fixtureReviewerFailureDomainId,
  reviewerIdentitySha256: evidenceIdentityBindingSha256(
    "REVIEWER",
    fixtureReviewerId,
    fixtureReviewerFailureDomainId,
  ),
  capturedAtUnixSeconds: "2000000000",
  validThroughUnixSeconds: "2002592000",
  maximumAgeSeconds: "2592000",
  evidenceArtifactSha256BySection: Object.freeze(Object.fromEntries(
    REQUIRED_X_SOCIAL_EVIDENCE_SECTIONS.map((id) => [id, fixtureSha256(`evidence:${id}`)]),
  )),
});

function isPlainRecord(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, expected, path, violations) {
  if (!isPlainRecord(value)) {
    violations.push(`${path}: expected a plain JSON object`);
    return false;
  }
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) {
    violations.push(`${path}: symbol keys are forbidden`);
    return false;
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.enumerable !== true || !("value" in descriptor)) {
      violations.push(`${path}.${key}: expected an enumerable own data property`);
      return false;
    }
  }
  const actual = [...keys].sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length
    || actual.some((key, index) => key !== canonical[index])) {
    violations.push(`${path}: keys must be exactly ${expected.join(", ")}`);
    return false;
  }
  return true;
}

function denseArray(value, path, violations) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    violations.push(`${path}: expected a canonical JSON array`);
    return false;
  }
  const keys = Reflect.ownKeys(value);
  const expected = ["length", ...Array.from({ length: value.length }, (_, index) => String(index))];
  if (keys.some((key) => typeof key !== "string")
    || keys.length !== expected.length
    || keys.some((key) => !expected.includes(key))) {
    violations.push(`${path}: sparse, decorated, or symbol-key arrays are forbidden`);
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
      violations.push(`${path}[${index}]: expected an enumerable own data property`);
      return false;
    }
  }
  return true;
}

function canonicalJsonTree(value, path, violations, seen = new Set()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) {
      violations.push(`${path}: non-finite numbers and negative zero are forbidden`);
      return false;
    }
    return true;
  }
  if (!value || typeof value !== "object") {
    violations.push(`${path}: expected canonical JSON data`);
    return false;
  }
  if (seen.has(value)) {
    violations.push(`${path}: object aliases and cycles are forbidden`);
    return false;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    if (!denseArray(value, path, violations)) return false;
    let valid = true;
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      valid = canonicalJsonTree(descriptor.value, `${path}[${index}]`, violations, seen) && valid;
    }
    return valid;
  }
  if (!isPlainRecord(value)) {
    violations.push(`${path}: expected a plain JSON object`);
    return false;
  }
  let valid = true;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") {
      violations.push(`${path}: symbol keys are forbidden`);
      valid = false;
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.enumerable !== true || !("value" in descriptor)) {
      violations.push(`${path}.${key}: expected an enumerable own data property`);
      valid = false;
      continue;
    }
    valid = canonicalJsonTree(descriptor.value, `${path}.${key}`, violations, seen) && valid;
  }
  return valid;
}

function safeCanonicalClone(value, label) {
  const violations = [];
  if (!canonicalJsonTree(value, label, violations)) throw new TypeError(violations.join("; "));
  return JSON.parse(canonicalizeRfc8785(value));
}

function exactArray(value, expected, path, violations) {
  return denseArray(value, path, violations)
    && value.length === expected.length
    && value.every((entry, index) => entry === expected[index]);
}

function packetStatus(packet, path, blockers, violations) {
  if (packet.status !== "BLOCKED" && packet.status !== "PACKET_COMPLETE") {
    violations.push(`${path}.status: expected BLOCKED or PACKET_COMPLETE`);
    return false;
  }
  if (packet.status === "BLOCKED") {
    if (typeof packet.blocker !== "string"
      || packet.blocker.trim().length < 24
      || PLACEHOLDER.test(packet.blocker.trim())) {
      violations.push(`${path}.blocker: BLOCKED requires a specific non-placeholder reason`);
    } else {
      blockers.push(`${path}: ${packet.blocker}`);
    }
    if (Object.hasOwn(packet, "evidence") && packet.evidence !== null) {
      violations.push(`${path}.evidence: BLOCKED packet cannot carry completion evidence`);
    }
    return false;
  }
  if (packet.blocker !== null) violations.push(`${path}.blocker: PACKET_COMPLETE requires null`);
  return true;
}

function canonicalSha256(value, path, required, violations) {
  if (value === null) {
    if (required) violations.push(`${path}: PACKET_COMPLETE digest is missing`);
    return false;
  }
  if (typeof value !== "string" || !HEX_32.test(value)) {
    violations.push(`${path}: expected canonical lowercase 32-byte hexadecimal`);
    return false;
  }
  const shortPeriod = [1, 2, 4, 8].some(
    (length) => value === value.slice(0, length).repeat(64 / length),
  );
  if (REPEATED_NIBBLE_SHA256.test(value) || NEAR_ZERO_SHA256.test(value) || shortPeriod) {
    violations.push(`${path}: zero, near-zero, or low-entropy placeholder digest is forbidden`);
    return false;
  }
  return true;
}

function canonicalIdentifier(value, path, required, profile, violations) {
  if (value === null) {
    if (required) violations.push(`${path}: PACKET_COMPLETE identifier is missing`);
    return false;
  }
  if (typeof value !== "string"
    || !CANONICAL_ID.test(value)
    || GENERIC_URL.test(value)
    || PLACEHOLDER.test(value.trim())
    || PLACEHOLDER_FRAGMENT.test(value.trim())
    || LOW_ENTROPY_ID.test(value)) {
    violations.push(`${path}: expected a canonical non-placeholder identifier, not a URL`);
    return false;
  }
  if (profile === "PRODUCTION"
    && (NON_PRODUCTION_MARKER.test(value) || OBVIOUS_NON_PRODUCTION_PREFIX.test(value))) {
    violations.push(`${path}: production identifier contains a non-production marker`);
    return false;
  }
  return true;
}

function asU64(value, path, violations) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    violations.push(`${path}: expected canonical unsigned decimal string`);
    return null;
  }
  const parsed = BigInt(value);
  if (parsed > U64_MAX) {
    violations.push(`${path}: exceeds unsigned 64-bit range`);
    return null;
  }
  return parsed;
}

function positiveU64(value, path, violations) {
  const parsed = asU64(value, path, violations);
  if (parsed === 0n) {
    violations.push(`${path}: expected a positive unsigned 64-bit value`);
    return null;
  }
  return parsed;
}

function parseEvaluationUnixSeconds(value, violations) {
  if (value === undefined || value === null) return null;
  if (typeof value === "bigint") {
    if (value < 0n || value > U64_MAX) {
      violations.push("options.evaluationUnixSeconds: expected unsigned 64-bit value");
      return null;
    }
    return value;
  }
  return asU64(value, "options.evaluationUnixSeconds", violations);
}

function packetKeys(spec) {
  return [...PACKET_COMMON_KEYS.slice(0, 2), ...spec.valueKeys, ...PACKET_COMMON_KEYS.slice(2)];
}

function sectionValues(record, spec, label) {
  const violations = [];
  const expected = Object.hasOwn(record, "status") ? packetKeys(spec) : spec.valueKeys;
  if (!exactKeys(record, expected, label, violations)) throw new TypeError(violations.join("; "));
  return Object.fromEntries(spec.valueKeys.map((key) => [key, record[key]]));
}

function subjectDigestFromParts(profile, referenceContract, sections) {
  return sha256CanonicalJson({
    domain: "iat-b3-x-social-evidence-subject/v1",
    schema: X_SOCIAL_EVIDENCE_READINESS_SCHEMA,
    profile,
    referenceContract,
    sections,
  });
}

function policyDescriptor(sectionId) {
  const packetSpec = X_SOCIAL_EVIDENCE_SECTION_SPECS.find(({ id }) => id === sectionId);
  if (packetSpec) return { id: packetSpec.id, requiredFields: packetSpec.valueKeys };
  const controlSpec = X_SOCIAL_EVIDENCE_CONTROL_SPECS.find(({ id }) => id === sectionId);
  if (controlSpec) return { id: controlSpec.id, requiredClaims: controlSpec.claims };
  throw new Error(`UNKNOWN_X_SOCIAL_EVIDENCE_SECTION:${sectionId}`);
}

function policyDigestFromSubject(profile, subjectBindingSha256, sectionId) {
  return sha256CanonicalJson({
    domain: "iat-b3-x-social-evidence-policy/v1",
    schema: X_SOCIAL_EVIDENCE_READINESS_SCHEMA,
    profile,
    subjectBindingSha256,
    sectionId,
    policy: policyDescriptor(sectionId),
  });
}

export function xSocialEvidenceSubjectBindingSha256(manifest) {
  const safe = safeCanonicalClone(manifest, "manifest");
  const violations = [];
  if (!exactKeys(safe, TOP_LEVEL_KEYS, "manifest", violations)) {
    throw new TypeError(violations.join("; "));
  }
  if (safe.profile !== "PRODUCTION" && safe.profile !== "TEST_FIXTURE") {
    throw new TypeError("manifest.profile must be PRODUCTION or TEST_FIXTURE");
  }
  if (sha256CanonicalJson(safe.referenceContract) !== sha256CanonicalJson(X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT)) {
    throw new TypeError("manifest.referenceContract must be exact");
  }
  const sections = Object.fromEntries(X_SOCIAL_EVIDENCE_SECTION_SPECS.map((spec) => [
    spec.id,
    sectionValues(safe[spec.key], spec, spec.key),
  ]));
  return subjectDigestFromParts(safe.profile, safe.referenceContract, sections);
}

export function xSocialEvidencePolicySha256(manifest, sectionId) {
  const safe = safeCanonicalClone(manifest, "manifest");
  return policyDigestFromSubject(
    safe.profile,
    xSocialEvidenceSubjectBindingSha256(safe),
    sectionId,
  );
}

export function xSocialEvidenceDescriptorSha256(evidence) {
  const safe = safeCanonicalClone(evidence, "evidence");
  const violations = [];
  const expected = Object.hasOwn(safe, "evidenceDescriptorSha256")
    ? EVIDENCE_KEYS
    : EVIDENCE_DESCRIPTOR_KEYS;
  if (!exactKeys(safe, expected, "evidence", violations)) {
    throw new TypeError(violations.join("; "));
  }
  return sha256CanonicalJson({
    domain: "iat-b3-x-social-evidence-descriptor/v1",
    descriptor: Object.fromEntries(EVIDENCE_DESCRIPTOR_KEYS.map((key) => [key, safe[key]])),
  });
}

function fixtureSubjectDigest() {
  return subjectDigestFromParts(
    "TEST_FIXTURE",
    X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT,
    fixtureSectionValues,
  );
}

function fixtureKnownValues() {
  const known = new Set();
  const visit = (value) => {
    if (typeof value === "string") known.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  for (const spec of X_SOCIAL_EVIDENCE_SECTION_SPECS) {
    for (const key of [...spec.shaKeys, ...spec.idKeys]) {
      visit(TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.sections[spec.id][key]);
    }
  }
  visit(TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.independentObserverId);
  visit(TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.observerFailureDomainId);
  visit(TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.observerIdentitySha256);
  visit(TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.independentReviewerId);
  visit(TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.reviewerFailureDomainId);
  visit(TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.reviewerIdentitySha256);
  visit(TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.capturedAtUnixSeconds);
  visit(TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.validThroughUnixSeconds);
  visit(TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.maximumAgeSeconds);
  visit(TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.evidenceArtifactSha256BySection);
  const subject = fixtureSubjectDigest();
  known.add(subject);
  for (const id of REQUIRED_X_SOCIAL_EVIDENCE_SECTIONS) {
    const policySha256 = policyDigestFromSubject("TEST_FIXTURE", subject, id);
    known.add(policySha256);
    known.add(xSocialEvidenceDescriptorSha256({
      evidenceKind: `${id}_INDEPENDENT_EVIDENCE`,
      artifactSha256: TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES
        .evidenceArtifactSha256BySection[id],
      subjectBindingSha256: subject,
      policySha256,
      independentObserverId: TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.independentObserverId,
      observerFailureDomainId:
        TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.observerFailureDomainId,
      observerIdentitySha256:
        TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.observerIdentitySha256,
      independentReviewerId: TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.independentReviewerId,
      reviewerFailureDomainId:
        TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.reviewerFailureDomainId,
      reviewerIdentitySha256:
        TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.reviewerIdentitySha256,
      capturedAtUnixSeconds: TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.capturedAtUnixSeconds,
      validThroughUnixSeconds:
        TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.validThroughUnixSeconds,
      maximumAgeSeconds: TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.maximumAgeSeconds,
      environment: "TEST_FIXTURE",
    }));
  }
  return known;
}

const KNOWN_FIXTURE_VALUES = fixtureKnownValues();
const FORBIDDEN_REFERENCE_ONLY_PRODUCTION_VALUES = new Set([
  REFERENCE_DEPLOYMENT_DOMAIN_SHA256,
  REWARD_CAS_EXTERNAL_NAMESPACE_SHA256,
  REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256,
]);

function rejectFixtureRelabel(manifest, options, violations) {
  if (manifest.profile === "TEST_FIXTURE" && options.allowTestFixture === true) return;
  const inspect = (value, path) => {
    if (typeof value === "string") {
      if (KNOWN_FIXTURE_VALUES.has(value)) {
        violations.push(`${path}: known TEST_FIXTURE value requires TEST_FIXTURE profile plus explicit allowTestFixture`);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry, index) => inspect(entry, `${path}[${index}]`));
    } else if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, entry]) => inspect(entry, `${path}.${key}`));
    }
  };
  inspect(manifest, "manifest");
}

function validateEvidence({
  evidence,
  path,
  expectedSectionId,
  expectedSubjectSha256,
  expectedPolicySha256,
  profile,
  evaluationUnixSeconds,
  expectedObserverFailureDomainId,
  expectedReviewerFailureDomainId,
  forbiddenObserverIds,
  artifacts,
  violations,
}) {
  if (!exactKeys(evidence, EVIDENCE_KEYS, path, violations)) return;
  if (evidence.evidenceKind !== `${expectedSectionId}_INDEPENDENT_EVIDENCE`) {
    violations.push(`${path}.evidenceKind: expected ${expectedSectionId}_INDEPENDENT_EVIDENCE`);
  }
  canonicalSha256(evidence.artifactSha256, `${path}.artifactSha256`, true, violations);
  if (evidence.subjectBindingSha256 !== expectedSubjectSha256) {
    violations.push(`${path}.subjectBindingSha256: evidence must bind the exact subject`);
  }
  if (evidence.policySha256 !== expectedPolicySha256) {
    violations.push(`${path}.policySha256: evidence must bind the exact section control and policy`);
  }
  canonicalSha256(evidence.subjectBindingSha256, `${path}.subjectBindingSha256`, true, violations);
  canonicalSha256(evidence.policySha256, `${path}.policySha256`, true, violations);
  canonicalIdentifier(evidence.independentObserverId, `${path}.independentObserverId`, true, profile, violations);
  canonicalIdentifier(evidence.observerFailureDomainId, `${path}.observerFailureDomainId`, true, profile, violations);
  canonicalSha256(evidence.observerIdentitySha256, `${path}.observerIdentitySha256`, true, violations);
  canonicalIdentifier(evidence.independentReviewerId, `${path}.independentReviewerId`, true, profile, violations);
  canonicalIdentifier(evidence.reviewerFailureDomainId, `${path}.reviewerFailureDomainId`, true, profile, violations);
  canonicalSha256(evidence.reviewerIdentitySha256, `${path}.reviewerIdentitySha256`, true, violations);
  if (evidence.observerFailureDomainId !== expectedObserverFailureDomainId
    || evidence.reviewerFailureDomainId !== expectedReviewerFailureDomainId) {
    violations.push(`${path}: observer and reviewer must bind the exact independently reviewed failure domains`);
  }
  if (evidence.observerFailureDomainId === evidence.reviewerFailureDomainId) {
    violations.push(`${path}: observer and reviewer failure domains must be distinct`);
  }
  const expectedObserverIdentitySha256 = evidenceIdentityBindingSha256(
    "OBSERVER",
    evidence.independentObserverId,
    evidence.observerFailureDomainId,
  );
  const expectedReviewerIdentitySha256 = evidenceIdentityBindingSha256(
    "REVIEWER",
    evidence.independentReviewerId,
    evidence.reviewerFailureDomainId,
  );
  if (evidence.observerIdentitySha256 !== expectedObserverIdentitySha256
    || evidence.reviewerIdentitySha256 !== expectedReviewerIdentitySha256) {
    violations.push(`${path}: observer and reviewer identity digests must bind exact identity and failure domain`);
  }
  if (evidence.independentObserverId === evidence.independentReviewerId
    || evidence.observerIdentitySha256 === evidence.reviewerIdentitySha256) {
    violations.push(`${path}: independent observer and reviewer identities must be distinct`);
  }
  if (forbiddenObserverIds.has(evidence.independentObserverId)
    || forbiddenObserverIds.has(evidence.independentReviewerId)) {
    violations.push(`${path}: observer and reviewer must be independent from provider, runtime, admin, credential, and backup identities`);
  }
  if (evidence.environment !== profile) {
    violations.push(`${path}.environment: evidence must match manifest.profile`);
  }
  const captured = positiveU64(evidence.capturedAtUnixSeconds, `${path}.capturedAtUnixSeconds`, violations);
  const validThrough = positiveU64(evidence.validThroughUnixSeconds, `${path}.validThroughUnixSeconds`, violations);
  const maximumAge = positiveU64(evidence.maximumAgeSeconds, `${path}.maximumAgeSeconds`, violations);
  if (maximumAge !== X_SOCIAL_EVIDENCE_MAX_AGE_SECONDS) {
    violations.push(`${path}.maximumAgeSeconds: exact externally pinned maximum age is required`);
  }
  if (captured !== null && validThrough !== null && captured >= validThrough) {
    violations.push(`${path}: capturedAtUnixSeconds must be before validThroughUnixSeconds`);
  }
  if (captured !== null && validThrough !== null && maximumAge !== null
    && validThrough - captured > maximumAge) {
    violations.push(`${path}: declared evidence interval exceeds the externally pinned maximum age`);
  }
  if (evaluationUnixSeconds === null) {
    violations.push(`${path}: packet evaluation requires explicit options.evaluationUnixSeconds`);
  } else if (captured !== null && validThrough !== null
    && (evaluationUnixSeconds < captured || evaluationUnixSeconds >= validThrough)) {
    violations.push(`${path}: declared half-open evidence interval does not contain options.evaluationUnixSeconds`);
  }
  canonicalSha256(
    evidence.evidenceDescriptorSha256,
    `${path}.evidenceDescriptorSha256`,
    true,
    violations,
  );
  if (evidence.evidenceDescriptorSha256 !== xSocialEvidenceDescriptorSha256(evidence)) {
    violations.push(`${path}.evidenceDescriptorSha256: descriptor must content-address every evidence metadata field`);
  }
  if (artifacts.has(evidence.artifactSha256)) {
    violations.push(`${path}.artifactSha256: evidence artifacts must be unique per required section`);
  }
  artifacts.add(evidence.artifactSha256);
}

function validateSection({
  manifest,
  spec,
  profile,
  subjectBindingSha256,
  evaluationUnixSeconds,
  forbiddenObserverIds,
  artifacts,
  blockers,
  violations,
}) {
  const value = manifest[spec.key];
  const path = spec.key;
  if (!exactKeys(value, packetKeys(spec), path, violations)) return false;
  const complete = packetStatus(value, path, blockers, violations);
  if (value.environment !== profile) violations.push(`${path}.environment: must match manifest.profile`);
  for (const key of spec.shaKeys) {
    canonicalSha256(value[key], `${path}.${key}`, complete, violations);
    if (profile === "PRODUCTION" && FORBIDDEN_REFERENCE_ONLY_PRODUCTION_VALUES.has(value[key])) {
      violations.push(`${path}.${key}: current reference-only digest cannot be relabeled as production`);
    }
  }
  for (const key of spec.idKeys) {
    canonicalIdentifier(value[key], `${path}.${key}`, complete, profile, violations);
  }
  for (const [key, expected] of Object.entries(spec.constants)) {
    if (value[key] !== expected) violations.push(`${path}.${key}: exact invariant drifted`);
  }
  if (complete) {
    validateEvidence({
      evidence: value.evidence,
      path: `${path}.evidence`,
      expectedSectionId: spec.id,
      expectedSubjectSha256: subjectBindingSha256,
      expectedPolicySha256: policyDigestFromSubject(profile, subjectBindingSha256, spec.id),
      profile,
      evaluationUnixSeconds,
      expectedObserverFailureDomainId:
        manifest.failureDomainSeparation.independentObserverFailureDomainId,
      expectedReviewerFailureDomainId:
        manifest.failureDomainSeparation.independentReviewerFailureDomainId,
      forbiddenObserverIds,
      artifacts,
      violations,
    });
  }
  return complete;
}

function validateControls({
  manifest,
  profile,
  subjectBindingSha256,
  evaluationUnixSeconds,
  forbiddenObserverIds,
  artifacts,
  blockers,
  violations,
}) {
  const controls = manifest.controlRequirements;
  if (!denseArray(controls, "controlRequirements", violations)) return [];
  if (controls.length !== X_SOCIAL_EVIDENCE_CONTROL_SPECS.length) {
    violations.push(`controlRequirements: expected exactly ${X_SOCIAL_EVIDENCE_CONTROL_SPECS.length} ordered controls`);
  }
  return X_SOCIAL_EVIDENCE_CONTROL_SPECS.map((expected, index) => {
    const control = controls[index];
    const path = `controlRequirements[${index}]`;
    if (!exactKeys(control, CONTROL_KEYS, path, violations)) return false;
    if (control.id !== expected.id) violations.push(`${path}.id: expected ${expected.id}`);
    if (!exactArray(control.requiredClaims, expected.claims, `${path}.requiredClaims`, violations)) {
      violations.push(`${path}.requiredClaims: exact ordered control claims are required`);
    }
    const complete = packetStatus(control, path, blockers, violations);
    if (complete) {
      validateEvidence({
        evidence: control.evidence,
        path: `${path}.evidence`,
        expectedSectionId: expected.id,
        expectedSubjectSha256: subjectBindingSha256,
        expectedPolicySha256: policyDigestFromSubject(profile, subjectBindingSha256, expected.id),
        profile,
        evaluationUnixSeconds,
        expectedObserverFailureDomainId:
          manifest.failureDomainSeparation.independentObserverFailureDomainId,
        expectedReviewerFailureDomainId:
          manifest.failureDomainSeparation.independentReviewerFailureDomainId,
        forbiddenObserverIds,
        artifacts,
        violations,
      });
    }
    return complete;
  });
}

function resultSurface({ profile, complete, productionComplete, blockers, violations }) {
  return Object.freeze({
    profile,
    xSocialEvidenceReviewPacketComplete: complete,
    productionXSocialEvidenceReviewPacketComplete: productionComplete,
    certifiesProviderOperationalTruth: false,
    certifiesOneBiologicalHumanPerXAccount: false,
    providerEvidenceAuthenticationVerified: false,
    collectorCompletenessVerified: false,
    walletBindingAuthenticationVerified: false,
    allocatorLineageAuthenticationVerified: false,
    externalMonotonicityVerified: false,
    rollbackProtectionVerified: false,
    runtimeConsumerGatingVerified: false,
    activationReady: false,
    mainnetOrReleaseReady: false,
    mainnetStatus: X_SOCIAL_EVIDENCE_MAINNET_STATUS,
    blockers: Object.freeze([...blockers]),
    violations: Object.freeze([...violations]),
  });
}

export function validateXSocialEvidenceProviderReadinessManifest(manifest, options = {}) {
  const violations = [];
  const blockers = [];
  const evaluationUnixSeconds = parseEvaluationUnixSeconds(options.evaluationUnixSeconds, violations);
  if (!canonicalJsonTree(manifest, "manifest", violations)) {
    return resultSurface({
      profile: null,
      complete: false,
      productionComplete: false,
      blockers,
      violations,
    });
  }
  let safe;
  try {
    safe = JSON.parse(canonicalizeRfc8785(manifest));
  } catch (error) {
    violations.push(`manifest: ${error instanceof Error ? error.message : String(error)}`);
    return resultSurface({
      profile: null,
      complete: false,
      productionComplete: false,
      blockers,
      violations,
    });
  }
  if (!exactKeys(safe, TOP_LEVEL_KEYS, "manifest", violations)) {
    return resultSurface({
      profile: null,
      complete: false,
      productionComplete: false,
      blockers,
      violations,
    });
  }
  const profile = safe.profile;
  if (safe.$schema !== "./iat-b3-x-social-evidence-provider-readiness.v1.schema.json") {
    violations.push("manifest.$schema: exact local schema reference is required");
  }
  if (safe.schema !== X_SOCIAL_EVIDENCE_READINESS_SCHEMA) {
    violations.push("manifest.schema: unsupported schema");
  }
  if (profile !== "PRODUCTION" && profile !== "TEST_FIXTURE") {
    violations.push("manifest.profile: expected PRODUCTION or TEST_FIXTURE");
  }
  if (safe.readiness !== "BLOCKED" && safe.readiness !== "REVIEW_PACKET_COMPLETE") {
    violations.push("manifest.readiness: expected BLOCKED or REVIEW_PACKET_COMPLETE");
  }
  if (safe.status !== X_SOCIAL_EVIDENCE_READINESS_STATUS) {
    violations.push("manifest.status: nonactivating review-packet status is immutable");
  }
  if (profile === "TEST_FIXTURE" && options.allowTestFixture !== true) {
    violations.push("manifest.profile: TEST_FIXTURE requires explicit allowTestFixture and never completes a production review packet");
  }
  if (exactKeys(safe.scope, ["contract", "doesNotCertify"], "scope", violations)) {
    if (safe.scope.contract !== "X_SOCIAL_EVIDENCE_REVIEW_PACKET_INPUTS_ONLY") {
      violations.push("scope.contract: structural-only scope is immutable");
    }
    if (!exactArray(safe.scope.doesNotCertify, SCOPE_EXCLUSIONS, "scope.doesNotCertify", violations)) {
      violations.push("scope.doesNotCertify: exact non-certification boundary is required");
    }
  }
  if (sha256CanonicalJson(safe.referenceContract) !== sha256CanonicalJson(X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT)) {
    violations.push("referenceContract: exact reward identity, tier, action, time, finality, tranche, and source contract drifted");
  }
  for (const key of [
    "providerEvidenceAuthenticationVerified",
    "collectorCompletenessVerified",
    "walletBindingAuthenticationVerified",
    "allocatorLineageAuthenticationVerified",
    "externalMonotonicityVerified",
    "rollbackProtectionVerified",
    "runtimeConsumerGatingVerified",
    "activationReady",
    "mainnetOrReleaseReady",
  ]) {
    if (safe[key] !== false) violations.push(`manifest.${key}: must remain false`);
  }
  if (safe.mainnetStatus !== X_SOCIAL_EVIDENCE_MAINNET_STATUS) {
    violations.push("manifest.mainnetStatus: must remain HOLD");
  }
  rejectFixtureRelabel(safe, options, violations);

  let subjectBindingSha256 = null;
  try {
    subjectBindingSha256 = xSocialEvidenceSubjectBindingSha256(safe);
  } catch (error) {
    violations.push(`manifest subject binding: ${error.message}`);
  }
  const artifacts = new Set();
  const forbiddenObserverIds = new Set();
  for (const spec of X_SOCIAL_EVIDENCE_SECTION_SPECS) {
    const value = safe[spec.key];
    if (!isPlainRecord(value)) continue;
    for (const key of spec.idKeys) {
      if (typeof value[key] === "string") forbiddenObserverIds.add(value[key]);
    }
  }
  const sectionResults = subjectBindingSha256 === null
    ? X_SOCIAL_EVIDENCE_SECTION_SPECS.map(() => false)
    : X_SOCIAL_EVIDENCE_SECTION_SPECS.map((spec) => validateSection({
      manifest: safe,
      spec,
      profile,
      subjectBindingSha256,
      evaluationUnixSeconds,
      forbiddenObserverIds,
      artifacts,
      blockers,
      violations,
    }));
  if (sectionResults[X_SOCIAL_EVIDENCE_SECTION_SPECS.findIndex(
    ({ id }) => id === "FAILURE_DOMAIN_SEPARATION",
  )]) {
    const failureDomains = X_SOCIAL_EVIDENCE_SECTION_SPECS
      .find(({ id }) => id === "FAILURE_DOMAIN_SEPARATION")
      .idKeys
      .map((key) => safe.failureDomainSeparation[key]);
    if (new Set(failureDomains).size !== failureDomains.length) {
      violations.push("failureDomainSeparation: all ten provider, runtime, finality, persistence, checkpoint, administration, credential, backup, observer, and reviewer domains must be distinct");
    }
  }
  const controlResults = subjectBindingSha256 === null
    ? []
    : validateControls({
      manifest: safe,
      profile,
      subjectBindingSha256,
      evaluationUnixSeconds,
      forbiddenObserverIds,
      artifacts,
      blockers,
      violations,
    });

  let terminalComplete = false;
  const terminal = safe.terminalPredicate;
  if (exactKeys(terminal, TERMINAL_KEYS, "terminalPredicate", violations)) {
    terminalComplete = packetStatus(terminal, "terminalPredicate", blockers, violations);
    if (!exactArray(
      terminal.requiredSections,
      REQUIRED_X_SOCIAL_EVIDENCE_SECTIONS,
      "terminalPredicate.requiredSections",
      violations,
    )) {
      violations.push("terminalPredicate.requiredSections: exact ordered review packets are required");
    }
    if (terminal.evaluationRule !== "ALL_REQUIRED_PACKETS_COMPLETE_ZERO_VIOLATIONS_ZERO_BLOCKERS") {
      violations.push("terminalPredicate.evaluationRule: terminal rule drifted");
    }
  }
  const allPacketsComplete = sectionResults.length === X_SOCIAL_EVIDENCE_SECTION_SPECS.length
    && sectionResults.every(Boolean)
    && controlResults.length === X_SOCIAL_EVIDENCE_CONTROL_SPECS.length
    && controlResults.every(Boolean);
  if (terminalComplete && !allPacketsComplete) {
    violations.push("terminalPredicate.status: PACKET_COMPLETE contradicts incomplete required packets");
  }
  if (!terminalComplete && allPacketsComplete) {
    violations.push("terminalPredicate.status: BLOCKED contradicts complete required packets");
  }
  if (safe.readiness === "REVIEW_PACKET_COMPLETE" && (!terminalComplete || !allPacketsComplete)) {
    violations.push("manifest.readiness: REVIEW_PACKET_COMPLETE contradicts an incomplete packet");
  }
  if (safe.readiness === "BLOCKED" && terminalComplete && allPacketsComplete) {
    violations.push("manifest.readiness: BLOCKED contradicts a complete packet");
  }
  const complete = violations.length === 0
    && blockers.length === 0
    && safe.readiness === "REVIEW_PACKET_COMPLETE"
    && terminalComplete
    && allPacketsComplete
    && (profile === "PRODUCTION" || options.allowTestFixture === true);
  return resultSurface({
    profile,
    complete,
    productionComplete: complete && profile === "PRODUCTION",
    blockers,
    violations,
  });
}

export function assertXSocialEvidenceReviewPacketComplete(manifest, options = {}) {
  const result = validateXSocialEvidenceProviderReadinessManifest(manifest, options);
  if (!result.xSocialEvidenceReviewPacketComplete) {
    throw new Error(`X_SOCIAL_EVIDENCE_REVIEW_PACKET_INCOMPLETE: ${[
      ...result.blockers,
      ...result.violations,
    ].join("; ")}`);
  }
  return result;
}

export function parseXSocialEvidenceProviderReadinessJson(text, label = "manifest") {
  if (typeof text !== "string") throw new TypeError(`${label}: JSON source must be a string`);
  let index = 0;
  const whitespace = /[\t\n\r ]/u;
  const skipWhitespace = () => {
    while (index < text.length && whitespace.test(text[index])) index += 1;
  };
  const fail = (message) => {
    throw new SyntaxError(`${label}: ${message} at byte ${index}`);
  };
  const parseStringToken = () => {
    if (text[index] !== "\"") fail("expected JSON string");
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === "\"") {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      if (character === "\\") {
        index += 2;
      } else {
        if (character < " ") fail("unescaped control character");
        index += 1;
      }
    }
    fail("unterminated JSON string");
  };
  const parseValue = (path) => {
    skipWhitespace();
    if (text[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      while (index < text.length) {
        skipWhitespace();
        const key = parseStringToken();
        if (keys.has(key)) throw new SyntaxError(`${label}: duplicate JSON member ${path}.${key}`);
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") fail("expected colon");
        index += 1;
        parseValue(`${path}.${key}`);
        skipWhitespace();
        if (text[index] === "}") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing brace");
        index += 1;
      }
      fail("unterminated JSON object");
    }
    if (text[index] === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      let item = 0;
      while (index < text.length) {
        parseValue(`${path}[${item}]`);
        item += 1;
        skipWhitespace();
        if (text[index] === "]") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing bracket");
        index += 1;
      }
      fail("unterminated JSON array");
    }
    if (text[index] === "\"") {
      parseStringToken();
      return;
    }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) fail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skipWhitespace();
  parseValue("$root");
  skipWhitespace();
  if (index !== text.length) fail("unexpected trailing data");
  return JSON.parse(text);
}

export function loadXSocialEvidenceProviderReadinessManifest(path) {
  const resolved = resolve(path);
  return parseXSocialEvidenceProviderReadinessJson(readFileSync(resolved, "utf8"), resolved);
}

function parseCliArgs(argv) {
  let manifestPath = fileURLToPath(new URL(
    "../docs/b3/iat-b3-x-social-evidence-provider-readiness.v1.json",
    import.meta.url,
  ));
  let allowTestFixture = false;
  let evaluationUnixSeconds;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--fixture") {
      allowTestFixture = true;
    } else if (argv[index] === "--evaluation-unix-seconds") {
      evaluationUnixSeconds = argv[index + 1];
      index += 1;
    } else if (!argv[index].startsWith("--")) {
      manifestPath = resolve(argv[index]);
    } else {
      throw new Error(`UNKNOWN_ARGUMENT:${argv[index]}`);
    }
  }
  return { manifestPath, allowTestFixture, evaluationUnixSeconds };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    const { manifestPath, allowTestFixture, evaluationUnixSeconds } = parseCliArgs(process.argv.slice(2));
    const result = validateXSocialEvidenceProviderReadinessManifest(
      loadXSocialEvidenceProviderReadinessManifest(manifestPath),
      { allowTestFixture, evaluationUnixSeconds },
    );
    console.log(JSON.stringify({ manifestPath, evaluationUnixSeconds: evaluationUnixSeconds ?? null, ...result }, null, 2));
    if (!result.xSocialEvidenceReviewPacketComplete) process.exitCode = 2;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

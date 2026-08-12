#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { REFERENCE_DEPLOYMENT_DOMAIN_SHA256 } from "../programs/iat_b3_reference/reward-allocator-receipt-codec.mjs";
import {
  REWARD_CAS_EXTERNAL_NAMESPACE_SHA256,
  REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256,
} from "../programs/iat_b3_reference/reward-persistence-checkpoint.mjs";
import { sha256CanonicalJson } from "./iat-v2-canonical-json.mjs";

export const PROVIDER_READINESS_SCHEMA =
  "iat-b3-external-checkpoint-provider-readiness/v1";
export const PROVIDER_READINESS_STATUS =
  "NON_ACTIVATING_PROVIDER_READINESS_REVIEW_PACKET";
export const PROVIDER_READINESS_MAINNET_STATUS = "HOLD";

const U64_MAX = (1n << 64n) - 1n;
const HEX_32 = /^[0-9a-f]{64}$/u;
const CANONICAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{7,159}$/u;
const GENERIC_URL = /^[a-z][a-z0-9+.-]*:\/\//iu;
const PLACEHOLDER = /^(?:blocked|change[-_ ]?me|none|null|pending|placeholder|replace[-_ ]?me|tbd|todo|unknown|x+|0+)$/iu;
const NON_PRODUCTION_MARKER = /(?:^|[._:/-])(?:dev|dummy|example|fake|fixture|invalid|local|mock|sample|sandbox|staging|synthetic|test)(?:$|[._:/-])/iu;
const OBVIOUS_NON_PRODUCTION_PREFIX = /^(?:dummy|example|fake|fixture|local|mock|sample|synthetic|test)(?:artifact|domain|evidence|key|observer|provider|resource|reviewer|service|tenant)/iu;
const LOW_ENTROPY_ID = /^(.)\1{7,}$/u;
const REPEATED_NIBBLE_SHA256 = /^([0-9a-f])\1{63}$/u;

const TOP_LEVEL_KEYS = Object.freeze([
  "$schema",
  "schema",
  "profile",
  "readiness",
  "status",
  "scope",
  "referenceContract",
  "subjectBinding",
  "providerBinding",
  "failureDomainSeparation",
  "controlRequirements",
  "terminalPredicate",
  "runtimeAuthenticationVerified",
  "externalMonotonicityVerified",
  "rollbackProtectionVerified",
  "activationReady",
  "mainnetStatus",
]);

const SCOPE_EXCLUSIONS = Object.freeze([
  "PROVIDER_OPERATIONAL_TRUTH",
  "RUNTIME_AUTHENTICATION",
  "EXTERNAL_MONOTONICITY",
  "ROLLBACK_PROTECTION",
  "MAINNET_OR_RELEASE_READINESS",
  "ACTIVATION_PAYMENT_OR_MINT_AUTHORITY",
]);

const REFERENCE_KEYS = Object.freeze([
  "checkpointSchema",
  "persistenceIdentitySchema",
  "dailyLawId",
  "checkpointAdvanceRule",
  "localCommitOrdering",
  "providerIntegrationPresent",
]);

const SUBJECT_KEYS = Object.freeze([
  "status",
  "environment",
  "productionIdentityFreezeManifestSha256",
  "productionPersistenceIdentitySha256",
  "productionDeploymentDomainSha256",
  "adapterSchema",
  "adapterSchemaVersion",
  "schemaManifestSha256",
  "genesisEntitySetSha256",
  "externalNamespaceSha256",
  "externalTrustPolicySha256",
  "evidence",
  "blocker",
]);

const SUBJECT_VALUE_KEYS = Object.freeze([
  "environment",
  "productionIdentityFreezeManifestSha256",
  "productionPersistenceIdentitySha256",
  "productionDeploymentDomainSha256",
  "adapterSchema",
  "adapterSchemaVersion",
  "schemaManifestSha256",
  "genesisEntitySetSha256",
  "externalNamespaceSha256",
  "externalTrustPolicySha256",
]);

const PROVIDER_KEYS = Object.freeze([
  "status",
  "environment",
  "providerLegalEntityId",
  "serviceProductId",
  "tenantId",
  "resourceId",
  "serviceRegionPolicyId",
  "termsVersion",
  "termsSha256",
  "retentionPolicySha256",
  "receiptFormatId",
  "receiptTrustRootSha256",
  "keyRegistryResourceId",
  "evidence",
  "blocker",
]);

const PROVIDER_VALUE_KEYS = Object.freeze(PROVIDER_KEYS.filter(
  (key) => !["status", "evidence", "blocker"].includes(key),
));

const FAILURE_KEYS = Object.freeze([
  "status",
  "environment",
  "localPersistenceFailureDomainId",
  "providerWriteFailureDomainId",
  "administrativeFailureDomainId",
  "credentialFailureDomainId",
  "backupFailureDomainId",
  "separationRule",
  "evidence",
  "blocker",
]);

const FAILURE_VALUE_KEYS = Object.freeze(FAILURE_KEYS.filter(
  (key) => !["status", "evidence", "blocker"].includes(key),
));

const CONTROL_KEYS = Object.freeze(["id", "status", "requiredClaims", "evidence", "blocker"]);
const TERMINAL_KEYS = Object.freeze(["status", "requiredSections", "evaluationRule", "blocker"]);
const EVIDENCE_KEYS = Object.freeze([
  "evidenceKind",
  "artifactSha256",
  "subjectBindingSha256",
  "policySha256",
  "independentObserverId",
  "observerIdentitySha256",
  "capturedAtUnixSeconds",
  "validThroughUnixSeconds",
  "environment",
]);

export const CONTROL_SPECS = Object.freeze([
  Object.freeze({
    id: "LINEARIZABLE_CAS_READBACK",
    claims: Object.freeze([
      "SINGLE_COPY_LINEARIZABLE_READBACK",
      "EXACT_REVISION_AND_DIGEST_COMPARE_AND_SWAP",
      "CONCURRENT_WRITERS_HAVE_EXACTLY_ONE_WINNER",
      "STALE_COMPARE_AND_SWAP_REJECTS_WITHOUT_MUTATION",
    ]),
  }),
  Object.freeze({
    id: "AUTHENTICATED_RECEIPTS_AND_KEY_LIFECYCLE",
    claims: Object.freeze([
      "VERSIONED_DOMAIN_SEPARATED_RECEIPT_FORMAT",
      "RECEIPT_BINDS_SUBJECT_CHECKPOINT_REQUEST_AND_RESPONSE",
      "RECEIPT_ANTI_REPLAY_IS_ENFORCED",
      "SIGNING_KEYS_ROTATE_WITH_BOUNDED_OVERLAP",
      "REVOKED_OR_COMPROMISED_KEYS_FAIL_CLOSED",
      "COMPROMISE_CUTOFF_REJECTS_RECEIPTS_AT_OR_AFTER_CUTOFF",
    ]),
  }),
  Object.freeze({
    id: "MONOTONIC_SEQUENCE_AND_FORK_PREVENTION",
    claims: Object.freeze([
      "CHECKPOINT_SEQUENCE_NEVER_DECREASES",
      "SAME_SEQUENCE_DIFFERENT_DIGEST_IS_REJECTED",
      "UNRELATED_OR_FORKED_ANCESTRY_IS_REJECTED",
      "MONOTONIC_STATE_SURVIVES_SERVICE_RESTART",
    ]),
  }),
  Object.freeze({
    id: "AVAILABILITY_AND_RECOVERY",
    claims: Object.freeze([
      "OUTAGE_AND_TIMEOUT_BEHAVIOR_FAILS_CLOSED",
      "SERVICE_RECOVERY_PRESERVES_LAST_COMMITTED_CHECKPOINT",
      "READ_AFTER_RECOVERY_IS_LINEARIZABLE",
      "RECOVERY_TIME_AND_DATA_LOSS_OBJECTIVES_ARE_CONTRACTED",
    ]),
  }),
  Object.freeze({
    id: "SINK_ROLLBACK_AND_RESTORE_DETECTION",
    claims: Object.freeze([
      "OLDER_SINK_SNAPSHOT_IS_DETECTED",
      "SINK_RESTORE_CANNOT_SILENTLY_DECREASE_SEQUENCE",
      "CONTROL_PLANE_ROLLBACK_IS_DETECTED",
      "ROLLBACK_DRILL_BINDS_PRE_AND_POST_STATE",
    ]),
  }),
  Object.freeze({
    id: "DAILY_LAW_AND_LOCAL_HEAD_BINDING",
    claims: Object.freeze([
      "DAILY_LAW_VALIDATED_BEFORE_STORE_OR_PROVIDER_READ",
      "CHECKPOINT_BINDS_EXACT_PRODUCTION_PERSISTENCE_IDENTITY",
      "CHECKPOINT_BINDS_EXACT_LOCAL_HEAD_SEQUENCE_AND_DIGEST",
      "DENIED_DAILY_LAW_ATTEMPT_LEAVES_LOCAL_AND_EXTERNAL_STATE_UNCHANGED",
    ]),
  }),
  Object.freeze({
    id: "SEQUENTIAL_CHECKPOINT_CONTINUITY",
    claims: Object.freeze([
      "FIRST_ANCHOR_REQUIRES_LOCAL_GENESIS_HEAD",
      "EVERY_ADVANCE_BINDS_EXACT_PREVIOUS_CHECKPOINT_DIGEST",
      "EVERY_ADVANCE_COVERS_EXACTLY_ONE_RETAINED_CAS_COMMIT",
      "SKIPPED_COMMIT_OR_SPLICED_PREDECESSOR_IS_REJECTED",
    ]),
  }),
  Object.freeze({
    id: "UNANCHORED_WRITE_AND_CONSUMER_GATING",
    claims: Object.freeze([
      "DATABASE_AHEAD_BLOCKS_NEXT_AND_SUBSEQUENT_LOCAL_CAS_WRITES",
      "DATABASE_AHEAD_BLOCKS_EVERY_DOWNSTREAM_REWARD_CONSUMER",
      "GATING_REMAINS_CLOSED_DURING_PROVIDER_OUTAGE",
      "GATING_REOPENS_ONLY_AFTER_EXACT_SEQUENTIAL_RECONCILIATION",
    ]),
  }),
  Object.freeze({
    id: "UNCERTAIN_RESPONSE_RECONCILIATION",
    claims: Object.freeze([
      "LOST_RESPONSE_RECOVERS_ONLY_BY_EXACT_READBACK",
      "ALTERNATE_READBACK_IS_REJECTED",
      "STALE_RETRY_CANNOT_REPLACE_COMMITTED_CHECKPOINT",
      "LOCAL_STATE_IS_UNCHANGED_BY_RECONCILIATION",
    ]),
  }),
  Object.freeze({
    id: "CREDENTIAL_ISOLATION",
    claims: Object.freeze([
      "CHECKPOINT_CREDENTIALS_ARE_NOT_AVAILABLE_TO_APPLICATION_RUNTIME",
      "WRITE_READ_ADMIN_AND_BACKUP_CREDENTIALS_ARE_SEPARATED",
      "CREDENTIALS_ARE_HARDWARE_OR_MANAGED_KEY_BOUND",
      "CREDENTIAL_ROTATION_AND_EMERGENCY_REVOCATION_FAIL_CLOSED",
    ]),
  }),
  Object.freeze({
    id: "BACKUP_INCIDENT_AND_DR",
    claims: Object.freeze([
      "CLOSED_DATABASE_AND_PROVIDER_BACKUP_API_RESTORE_DRILL_PASSES",
      "PROVIDER_OUTAGE_RECOVERY_PRESERVES_LAST_CHECKPOINT",
      "SINK_ROLLBACK_IS_DETECTED_WITHOUT_EXTERNAL_REWIND",
      "INCIDENT_RUNBOOK_COVERS_KEY_PROVIDER_AND_DATA_COMPROMISE",
      "RECOVERY_EVIDENCE_BINDS_EXACT_PRODUCTION_SUBJECT",
    ]),
  }),
  Object.freeze({
    id: "INDEPENDENT_AUDIT_AND_REVIEW",
    claims: Object.freeze([
      "SECURITY_REVIEW_IS_INDEPENDENT",
      "LEGAL_TERMS_AND_RETENTION_ARE_REVIEWED",
      "OPERATIONS_AND_DISASTER_RECOVERY_ARE_REVIEWED",
      "EVIDENCE_DIGESTS_ARE_REPRODUCIBLE",
      "REVIEWERS_ARE_NOT_PROVIDER_ADMINS_OR_CHECKPOINT_OPERATORS",
    ]),
  }),
]);

export const REQUIRED_PROVIDER_READINESS_SECTIONS = Object.freeze([
  "SUBJECT_BINDING",
  "PROVIDER_BINDING",
  "FAILURE_DOMAIN_SEPARATION",
  ...CONTROL_SPECS.map(({ id }) => id),
]);

function fixtureSha256(label) {
  return sha256CanonicalJson({ fixture: "IAT_B3_PROVIDER_READINESS_TEST_ONLY", label });
}

export const TEST_FIXTURE_PROVIDER_READINESS_VALUES = Object.freeze({
  subject: Object.freeze({
    environment: "TEST_FIXTURE",
    productionIdentityFreezeManifestSha256: fixtureSha256("identity-freeze-manifest"),
    productionPersistenceIdentitySha256: fixtureSha256("persistence-identity"),
    productionDeploymentDomainSha256: fixtureSha256("deployment-domain"),
    adapterSchema: "fixture-reward-cas-sqlite/v1",
    adapterSchemaVersion: 1,
    schemaManifestSha256: fixtureSha256("sqlite-schema-manifest"),
    genesisEntitySetSha256: fixtureSha256("genesis-entity-set"),
    externalNamespaceSha256: fixtureSha256("external-namespace"),
    externalTrustPolicySha256: fixtureSha256("external-trust-policy"),
  }),
  provider: Object.freeze({
    environment: "TEST_FIXTURE",
    providerLegalEntityId: "fixture-provider-legal-entity",
    serviceProductId: "fixture-linearizable-checkpoint-service",
    tenantId: "fixture-tenant-iat-b3",
    resourceId: "fixture-checkpoint-resource",
    serviceRegionPolicyId: "fixture-independent-region-policy",
    termsVersion: "fixture-terms-version-1",
    termsSha256: fixtureSha256("provider-terms"),
    retentionPolicySha256: fixtureSha256("retention-policy"),
    receiptFormatId: "fixture-authenticated-receipt-v1",
    receiptTrustRootSha256: fixtureSha256("receipt-trust-root"),
    keyRegistryResourceId: "fixture-key-registry-resource",
  }),
  failureDomains: Object.freeze({
    environment: "TEST_FIXTURE",
    localPersistenceFailureDomainId: "fixture-local-db-domain",
    providerWriteFailureDomainId: "fixture-provider-write-domain",
    administrativeFailureDomainId: "fixture-provider-admin-domain",
    credentialFailureDomainId: "fixture-credential-custody-domain",
    backupFailureDomainId: "fixture-independent-backup-domain",
  }),
  independentObserverId: "fixture-independent-reviewer",
  observerIdentitySha256: fixtureSha256("independent-reviewer-identity"),
  capturedAtUnixSeconds: "2000000000",
  validThroughUnixSeconds: "2100000000",
  evidenceArtifactSha256BySection: Object.freeze(Object.fromEntries(
    REQUIRED_PROVIDER_READINESS_SECTIONS.map((section) => [
      section,
      fixtureSha256(`evidence:${section}`),
    ]),
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

function assertCanonicalJsonTree(value, path) {
  const violations = [];
  if (!canonicalJsonTree(value, path, violations)) {
    throw new TypeError(violations.join("; "));
  }
}

function exactArray(value, expected, path, violations) {
  return denseArray(value, path, violations)
    && value.length === expected.length
    && value.every((entry, index) => entry === expected[index]);
}

function packetStatus(section, path, blockers, violations) {
  if (section.status !== "BLOCKED" && section.status !== "PACKET_COMPLETE") {
    violations.push(`${path}.status: expected BLOCKED or PACKET_COMPLETE`);
    return false;
  }
  if (section.status === "BLOCKED") {
    if (typeof section.blocker !== "string"
      || section.blocker.trim().length < 24
      || PLACEHOLDER.test(section.blocker.trim())) {
      violations.push(`${path}.blocker: BLOCKED requires a specific non-placeholder reason`);
    } else {
      blockers.push(`${path}: ${section.blocker}`);
    }
    if (Object.hasOwn(section, "evidence") && section.evidence !== null) {
      violations.push(`${path}.evidence: BLOCKED packet cannot carry completion evidence`);
    }
    return false;
  }
  if (section.blocker !== null) {
    violations.push(`${path}.blocker: PACKET_COMPLETE requires null`);
  }
  return true;
}

function canonicalSha256(value, path, required, violations) {
  if (value === null) {
    if (required) violations.push(`${path}: PACKET_COMPLETE value is missing`);
    return false;
  }
  if (typeof value !== "string" || !HEX_32.test(value)) {
    violations.push(`${path}: expected canonical lowercase 32-byte hexadecimal`);
    return false;
  }
  if (REPEATED_NIBBLE_SHA256.test(value)) {
    violations.push(`${path}: zero or repeated-nibble placeholder digest is forbidden`);
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

function asPositiveU64(value, path, violations) {
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

function valuesForKeys(record, keys) {
  if (!isPlainRecord(record)) throw new TypeError("provider-readiness hash input must be a plain JSON object");
  return Object.fromEntries(keys.map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    if (!descriptor || descriptor.enumerable !== true || !("value" in descriptor)) {
      throw new TypeError(`provider-readiness hash input ${key} must be an enumerable own data property`);
    }
    return [key, descriptor.value];
  }));
}

function exactHashInputRecord(record, fullKeys, valueKeys, label) {
  const violations = [];
  if (!isPlainRecord(record)) {
    throw new TypeError(`${label}: expected a plain JSON object`);
  }
  const expected = Object.hasOwn(record, "status") ? fullKeys : valueKeys;
  if (!exactKeys(record, expected, label, violations)) {
    throw new TypeError(violations.join("; "));
  }
  assertCanonicalJsonTree(record, label);
  return record;
}

function ownDataValue(record, key, label) {
  if (!isPlainRecord(record)) throw new TypeError(`${label} must be a plain JSON object`);
  const descriptor = Object.getOwnPropertyDescriptor(record, key);
  if (!descriptor || descriptor.enumerable !== true || !("value" in descriptor)) {
    throw new TypeError(`${label}.${key} must be an enumerable own data property`);
  }
  return descriptor.value;
}

export function providerReadinessSubjectBindingSha256(manifest) {
  if (!isPlainRecord(manifest)) throw new TypeError("provider-readiness subject hash input must be a plain JSON object");
  const subjectDescriptor = Object.getOwnPropertyDescriptor(manifest, "subjectBinding");
  if (subjectDescriptor
    && (subjectDescriptor.enumerable !== true || !("value" in subjectDescriptor))) {
    throw new TypeError("provider-readiness subjectBinding must be an enumerable own data property");
  }
  const subject = subjectDescriptor ? subjectDescriptor.value : manifest;
  exactHashInputRecord(subject, SUBJECT_KEYS, SUBJECT_VALUE_KEYS, "subjectBinding");
  return sha256CanonicalJson(valuesForKeys(subject, SUBJECT_VALUE_KEYS));
}

function sectionPolicy(manifest, sectionId) {
  if (sectionId === "SUBJECT_BINDING") {
    const subject = ownDataValue(manifest, "subjectBinding", "manifest");
    exactHashInputRecord(subject, SUBJECT_KEYS, SUBJECT_VALUE_KEYS, "subjectBinding");
    return { requiredFields: SUBJECT_VALUE_KEYS, values: valuesForKeys(subject, SUBJECT_VALUE_KEYS) };
  }
  if (sectionId === "PROVIDER_BINDING") {
    const provider = ownDataValue(manifest, "providerBinding", "manifest");
    exactHashInputRecord(provider, PROVIDER_KEYS, PROVIDER_VALUE_KEYS, "providerBinding");
    return { requiredFields: PROVIDER_VALUE_KEYS, values: valuesForKeys(provider, PROVIDER_VALUE_KEYS) };
  }
  if (sectionId === "FAILURE_DOMAIN_SEPARATION") {
    const failureDomains = ownDataValue(manifest, "failureDomainSeparation", "manifest");
    exactHashInputRecord(failureDomains, FAILURE_KEYS, FAILURE_VALUE_KEYS, "failureDomainSeparation");
    return { requiredFields: FAILURE_VALUE_KEYS, values: valuesForKeys(failureDomains, FAILURE_VALUE_KEYS) };
  }
  const spec = CONTROL_SPECS.find(({ id }) => id === sectionId);
  if (!spec) throw new Error(`UNKNOWN_PROVIDER_READINESS_SECTION:${sectionId}`);
  return { id: spec.id, requiredClaims: spec.claims };
}

export function providerReadinessEvidencePolicySha256(manifest, sectionId) {
  const profile = ownDataValue(manifest, "profile", "manifest");
  if (profile !== "PRODUCTION" && profile !== "TEST_FIXTURE") {
    throw new TypeError("manifest.profile must be PRODUCTION or TEST_FIXTURE");
  }
  return sha256CanonicalJson({
    schema: PROVIDER_READINESS_SCHEMA,
    profile,
    subjectBindingSha256: providerReadinessSubjectBindingSha256(manifest),
    sectionId,
    policy: sectionPolicy(manifest, sectionId),
  });
}

function fixtureKnownValues() {
  const known = new Set();
  const visit = (value) => {
    if (typeof value === "string") known.add(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(TEST_FIXTURE_PROVIDER_READINESS_VALUES);
  const fixtureManifest = {
    profile: "TEST_FIXTURE",
    subjectBinding: TEST_FIXTURE_PROVIDER_READINESS_VALUES.subject,
    providerBinding: TEST_FIXTURE_PROVIDER_READINESS_VALUES.provider,
    failureDomainSeparation: {
      ...TEST_FIXTURE_PROVIDER_READINESS_VALUES.failureDomains,
      separationRule: "LOCAL_DB_PROVIDER_WRITE_ADMIN_CREDENTIAL_AND_BACKUP_DOMAINS_ALL_DISTINCT",
    },
  };
  known.add(providerReadinessSubjectBindingSha256(fixtureManifest));
  for (const section of REQUIRED_PROVIDER_READINESS_SECTIONS) {
    known.add(providerReadinessEvidencePolicySha256(fixtureManifest, section));
  }
  return known;
}

const KNOWN_FIXTURE_VALUES = fixtureKnownValues();

function rejectFixtureRelabel(manifest, options, violations) {
  if (manifest.profile === "TEST_FIXTURE" && options.allowTestFixture === true) return;
  const visited = new Set();
  const inspect = (value, path) => {
    if (typeof value === "string") {
      if (KNOWN_FIXTURE_VALUES.has(value)) {
        violations.push(`${path}: known TEST_FIXTURE value requires TEST_FIXTURE profile plus explicit allowTestFixture`);
      }
      return;
    }
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") continue;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && "value" in descriptor) inspect(descriptor.value, `${path}.${key}`);
    }
  };
  inspect(manifest, "manifest");
}

function validateEvidence({
  evidence,
  path,
  expectedKind,
  expectedPolicySha256,
  manifest,
  evaluationUnixSeconds,
  resourceIds,
  artifactDigests,
  violations,
}) {
  if (!exactKeys(evidence, EVIDENCE_KEYS, path, violations)) return;
  const subjectDigest = providerReadinessSubjectBindingSha256(manifest);
  if (evidence.evidenceKind !== expectedKind) {
    violations.push(`${path}.evidenceKind: expected ${expectedKind}`);
  }
  canonicalSha256(evidence.artifactSha256, `${path}.artifactSha256`, true, violations);
  if (evidence.subjectBindingSha256 !== subjectDigest) {
    violations.push(`${path}.subjectBindingSha256: evidence must bind the exact subject`);
  }
  if (evidence.policySha256 !== expectedPolicySha256) {
    violations.push(`${path}.policySha256: evidence must bind the exact section control and policy`);
  }
  canonicalIdentifier(
    evidence.independentObserverId,
    `${path}.independentObserverId`,
    true,
    manifest.profile,
    violations,
  );
  canonicalSha256(evidence.observerIdentitySha256, `${path}.observerIdentitySha256`, true, violations);
  if (evidence.environment !== manifest.profile) {
    violations.push(`${path}.environment: must equal manifest.profile`);
  }
  if (resourceIds.has(evidence.independentObserverId)) {
    violations.push(`${path}.independentObserverId: observer cannot be a provider, admin, credential, backup, or local persistence resource`);
  }
  const captured = asPositiveU64(
    evidence.capturedAtUnixSeconds,
    `${path}.capturedAtUnixSeconds`,
    violations,
  );
  const validThrough = asPositiveU64(
    evidence.validThroughUnixSeconds,
    `${path}.validThroughUnixSeconds`,
    violations,
  );
  if (captured !== null && validThrough !== null && captured >= validThrough) {
    violations.push(`${path}: evidence validity must end after capture`);
  }
  if (evaluationUnixSeconds === null) {
    violations.push(`${path}: readiness evaluation requires explicit options.evaluationUnixSeconds`);
  } else if (captured !== null && validThrough !== null
    && (evaluationUnixSeconds < captured || evaluationUnixSeconds > validThrough)) {
    violations.push(`${path}: evidence is not valid at options.evaluationUnixSeconds`);
  }
  if (artifactDigests.has(evidence.artifactSha256)) {
    violations.push(`${path}.artifactSha256: duplicate evidence artifact digest`);
  } else {
    artifactDigests.add(evidence.artifactSha256);
  }
}

function validateScopeAndReference(manifest, violations) {
  if (exactKeys(manifest.scope, ["contract", "doesNotCertify"], "scope", violations)) {
    if (manifest.scope.contract !== "EXTERNAL_CHECKPOINT_PROVIDER_READINESS_INPUTS_ONLY") {
      violations.push("scope.contract: expected provider-readiness inputs-only boundary");
    }
    if (!exactArray(manifest.scope.doesNotCertify, SCOPE_EXCLUSIONS, "scope.doesNotCertify", violations)) {
      violations.push("scope.doesNotCertify: exact non-certification boundary is required");
    }
  }
  const reference = manifest.referenceContract;
  if (!exactKeys(reference, REFERENCE_KEYS, "referenceContract", violations)) return;
  const expected = {
    checkpointSchema: "iat-b3-reward-cas-external-checkpoint/v1",
    persistenceIdentitySchema: "iat-b3-reward-cas-persistence-identity/v1",
    dailyLawId: "IAT_B3_DAILY_LOCKDOWN_LAW_V1",
    checkpointAdvanceRule: "GENESIS_ONLY_FIRST_ANCHOR_THEN_EXACTLY_ONE_RETAINED_CAS_COMMIT",
    localCommitOrdering: "LOCAL_COMMIT_FIRST_EXTERNAL_CHECKPOINT_SECOND",
    providerIntegrationPresent: false,
  };
  for (const key of REFERENCE_KEYS) {
    if (reference[key] !== expected[key]) violations.push(`referenceContract.${key}: immutable reference contract drifted`);
  }
}

function validateSubject(manifest, blockers, violations) {
  const section = manifest.subjectBinding;
  if (!exactKeys(section, SUBJECT_KEYS, "subjectBinding", violations)) return false;
  const complete = packetStatus(section, "subjectBinding", blockers, violations);
  if (section.environment !== manifest.profile) {
    violations.push("subjectBinding.environment: must equal manifest.profile");
  }
  for (const key of SUBJECT_VALUE_KEYS.filter((key) => key.endsWith("Sha256"))) {
    canonicalSha256(section[key], `subjectBinding.${key}`, complete, violations);
  }
  canonicalIdentifier(section.adapterSchema, "subjectBinding.adapterSchema", complete, manifest.profile, violations);
  if (section.adapterSchemaVersion === null) {
    if (complete) violations.push("subjectBinding.adapterSchemaVersion: PACKET_COMPLETE version is missing");
  } else if (!Number.isSafeInteger(section.adapterSchemaVersion) || section.adapterSchemaVersion <= 0) {
    violations.push("subjectBinding.adapterSchemaVersion: expected a positive safe integer");
  }
  if (complete && manifest.profile === "PRODUCTION") {
    const referenceOnly = [
      ["productionDeploymentDomainSha256", REFERENCE_DEPLOYMENT_DOMAIN_SHA256],
      ["externalNamespaceSha256", REWARD_CAS_EXTERNAL_NAMESPACE_SHA256],
      ["externalTrustPolicySha256", REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256],
    ];
    for (const [key, forbidden] of referenceOnly) {
      if (section[key] === forbidden) {
        violations.push(`subjectBinding.${key}: current reference-only value is explicitly unfrozen and cannot be a production binding`);
      }
    }
  }
  return complete;
}

function validateProvider(manifest, blockers, violations) {
  const section = manifest.providerBinding;
  if (!exactKeys(section, PROVIDER_KEYS, "providerBinding", violations)) return false;
  const complete = packetStatus(section, "providerBinding", blockers, violations);
  if (section.environment !== manifest.profile) {
    violations.push("providerBinding.environment: must equal manifest.profile");
  }
  const digestKeys = ["termsSha256", "retentionPolicySha256", "receiptTrustRootSha256"];
  for (const key of digestKeys) canonicalSha256(section[key], `providerBinding.${key}`, complete, violations);
  for (const key of PROVIDER_VALUE_KEYS.filter((key) => key !== "environment" && !digestKeys.includes(key))) {
    canonicalIdentifier(section[key], `providerBinding.${key}`, complete, manifest.profile, violations);
  }
  return complete;
}

function validateFailureDomains(manifest, blockers, violations) {
  const section = manifest.failureDomainSeparation;
  if (!exactKeys(section, FAILURE_KEYS, "failureDomainSeparation", violations)) return false;
  const complete = packetStatus(section, "failureDomainSeparation", blockers, violations);
  if (section.environment !== manifest.profile) {
    violations.push("failureDomainSeparation.environment: must equal manifest.profile");
  }
  if (section.separationRule !== "LOCAL_DB_PROVIDER_WRITE_ADMIN_CREDENTIAL_AND_BACKUP_DOMAINS_ALL_DISTINCT") {
    violations.push("failureDomainSeparation.separationRule: exact five-domain separation is required");
  }
  const ids = FAILURE_VALUE_KEYS
    .filter((key) => !["environment", "separationRule"].includes(key))
    .map((key) => section[key]);
  for (let index = 0; index < ids.length; index += 1) {
    canonicalIdentifier(
      ids[index],
      `failureDomainSeparation.${FAILURE_VALUE_KEYS[index + 1]}`,
      complete,
      manifest.profile,
      violations,
    );
  }
  const present = ids.filter((value) => typeof value === "string");
  if (new Set(present).size !== present.length) {
    violations.push("failureDomainSeparation: all five failure-domain identifiers must be distinct");
  }
  return complete;
}

function collectResourceIds(manifest, violations) {
  const ids = [
    ...PROVIDER_VALUE_KEYS.filter((key) => !["environment", "termsSha256", "retentionPolicySha256", "receiptTrustRootSha256"].includes(key))
      .map((key) => manifest.providerBinding?.[key]),
    ...FAILURE_VALUE_KEYS.filter((key) => !["environment", "separationRule"].includes(key))
      .map((key) => manifest.failureDomainSeparation?.[key]),
  ].filter((value) => typeof value === "string");
  if (new Set(ids).size !== ids.length) {
    violations.push("provider/failure-domain bindings: tenant, resource, key-registry, and failure-domain identifiers must be globally distinct");
  }
  return new Set(ids);
}

function validateControls({
  manifest,
  evaluationUnixSeconds,
  resourceIds,
  artifactDigests,
  blockers,
  violations,
}) {
  const controls = manifest.controlRequirements;
  if (!denseArray(controls, "controlRequirements", violations)) return [];
  if (controls.length !== CONTROL_SPECS.length) {
    violations.push(`controlRequirements: expected exactly ${CONTROL_SPECS.length} ordered controls`);
  }
  const complete = [];
  for (let index = 0; index < controls.length; index += 1) {
    const control = controls[index];
    const path = `controlRequirements[${index}]`;
    if (!exactKeys(control, CONTROL_KEYS, path, violations)) {
      complete.push(false);
      continue;
    }
    const expected = CONTROL_SPECS[index];
    const packetComplete = packetStatus(control, `${path}(${control.id})`, blockers, violations);
    complete.push(packetComplete);
    if (!expected) {
      violations.push(`${path}: unexpected control ${control.id}`);
      continue;
    }
    if (control.id !== expected.id) violations.push(`${path}.id: expected ${expected.id}`);
    if (!exactArray(control.requiredClaims, expected.claims, `${path}.requiredClaims`, violations)) {
      violations.push(`${path}.requiredClaims: exact ordered control claims are required`);
    }
    if (packetComplete) {
      if (control.evidence === null) {
        violations.push(`${path}.evidence: PACKET_COMPLETE requires content-addressed evidence`);
      } else {
        validateEvidence({
          evidence: control.evidence,
          path: `${path}.evidence`,
          expectedKind: `${expected.id}_EVIDENCE_V1`,
          expectedPolicySha256: providerReadinessEvidencePolicySha256(manifest, expected.id),
          manifest,
          evaluationUnixSeconds,
          resourceIds,
          artifactDigests,
          violations,
        });
      }
    }
  }
  return complete;
}

function resultSurface({ profile, providerReviewPacketComplete, productionReviewPacketComplete, blockers, violations }) {
  return {
    valid: violations.length === 0,
    providerReviewPacketComplete,
    productionReviewPacketComplete,
    certifiesProviderOperationalTruth: false,
    mainnetOrReleaseReady: false,
    runtimeAuthenticationVerified: false,
    externalMonotonicityVerified: false,
    rollbackProtectionVerified: false,
    activationReady: false,
    mainnetStatus: PROVIDER_READINESS_MAINNET_STATUS,
    profile,
    blockers,
    violations,
  };
}

export function validateExternalCheckpointProviderReadinessManifest(manifest, options = {}) {
  const blockers = [];
  const violations = [];
  const evaluationUnixSeconds = parseEvaluationUnixSeconds(options.evaluationUnixSeconds, violations);
  let canonicalTree = false;
  let topLevelShape = false;
  try {
    canonicalTree = canonicalJsonTree(manifest, "manifest", violations);
    topLevelShape = exactKeys(manifest, TOP_LEVEL_KEYS, "manifest", violations);
  } catch (error) {
    violations.push(`manifest: canonical JSON inspection failed closed (${error instanceof Error ? error.message : String(error)})`);
  }
  if (!canonicalTree || !topLevelShape) {
    return resultSurface({
      profile: null,
      providerReviewPacketComplete: false,
      productionReviewPacketComplete: false,
      blockers,
      violations,
    });
  }
  if (manifest.$schema !== "./iat-b3-external-checkpoint-provider-readiness.v1.schema.json") {
    violations.push("manifest.$schema: unexpected schema path");
  }
  if (manifest.schema !== PROVIDER_READINESS_SCHEMA) violations.push("manifest.schema: unsupported version");
  if (manifest.profile !== "PRODUCTION" && manifest.profile !== "TEST_FIXTURE") {
    violations.push("manifest.profile: expected PRODUCTION or TEST_FIXTURE");
  }
  if (manifest.profile === "TEST_FIXTURE" && options.allowTestFixture !== true) {
    violations.push("manifest.profile: TEST_FIXTURE requires explicit allowTestFixture and never completes a production review packet");
  }
  if (manifest.readiness !== "BLOCKED" && manifest.readiness !== "READY_FOR_PROVIDER_REVIEW") {
    violations.push("manifest.readiness: expected BLOCKED or READY_FOR_PROVIDER_REVIEW");
  }
  if (manifest.status !== PROVIDER_READINESS_STATUS) violations.push("manifest.status: immutable status drifted");
  for (const flag of [
    "runtimeAuthenticationVerified",
    "externalMonotonicityVerified",
    "rollbackProtectionVerified",
    "activationReady",
  ]) {
    if (manifest[flag] !== false) violations.push(`manifest.${flag}: must remain false`);
  }
  if (manifest.mainnetStatus !== PROVIDER_READINESS_MAINNET_STATUS) {
    violations.push("manifest.mainnetStatus: must remain HOLD");
  }

  validateScopeAndReference(manifest, violations);
  const subjectComplete = validateSubject(manifest, blockers, violations);
  const providerComplete = validateProvider(manifest, blockers, violations);
  const failureDomainsComplete = validateFailureDomains(manifest, blockers, violations);
  const resourceIds = collectResourceIds(manifest, violations);
  const artifactDigests = new Set();

  const baseEvidenceSections = [
    ["SUBJECT_BINDING", manifest.subjectBinding, subjectComplete],
    ["PROVIDER_BINDING", manifest.providerBinding, providerComplete],
    ["FAILURE_DOMAIN_SEPARATION", manifest.failureDomainSeparation, failureDomainsComplete],
  ];
  for (const [sectionId, section, complete] of baseEvidenceSections) {
    if (!complete) continue;
    if (section.evidence === null) {
      violations.push(`${sectionId}.evidence: PACKET_COMPLETE requires content-addressed evidence`);
      continue;
    }
    validateEvidence({
      evidence: section.evidence,
      path: `${sectionId}.evidence`,
      expectedKind: `${sectionId}_EVIDENCE_V1`,
      expectedPolicySha256: providerReadinessEvidencePolicySha256(manifest, sectionId),
      manifest,
      evaluationUnixSeconds,
      resourceIds,
      artifactDigests,
      violations,
    });
  }

  const controlCompleteness = validateControls({
    manifest,
    evaluationUnixSeconds,
    resourceIds,
    artifactDigests,
    blockers,
    violations,
  });

  const terminal = manifest.terminalPredicate;
  let terminalComplete = false;
  if (exactKeys(terminal, TERMINAL_KEYS, "terminalPredicate", violations)) {
    terminalComplete = packetStatus(terminal, "terminalPredicate", blockers, violations);
    if (!exactArray(
      terminal.requiredSections,
      REQUIRED_PROVIDER_READINESS_SECTIONS,
      "terminalPredicate.requiredSections",
      violations,
    )) {
      violations.push("terminalPredicate.requiredSections: exact ordered readiness packets are required");
    }
    if (terminal.evaluationRule !== "ALL_REQUIRED_PACKETS_COMPLETE_ZERO_VIOLATIONS_ZERO_BLOCKERS") {
      violations.push("terminalPredicate.evaluationRule: terminal rule drifted");
    }
  }

  rejectFixtureRelabel(manifest, options, violations);

  const allPacketsComplete = subjectComplete
    && providerComplete
    && failureDomainsComplete
    && controlCompleteness.length === CONTROL_SPECS.length
    && controlCompleteness.every(Boolean);
  if (terminalComplete && !allPacketsComplete) {
    violations.push("terminalPredicate.status: PACKET_COMPLETE contradicts incomplete required packets");
  }
  if (!terminalComplete && allPacketsComplete) {
    violations.push("terminalPredicate.status: BLOCKED contradicts complete required packets");
  }
  const computedReady = violations.length === 0 && blockers.length === 0 && terminalComplete && allPacketsComplete;
  if (manifest.readiness === "READY_FOR_PROVIDER_REVIEW" && !computedReady) {
    violations.push("manifest.readiness: READY_FOR_PROVIDER_REVIEW contradicts incomplete or invalid packets");
  } else if (manifest.readiness === "BLOCKED" && computedReady) {
    violations.push("manifest.readiness: BLOCKED contradicts a complete review packet");
  }
  const providerReviewPacketComplete = violations.length === 0
    && blockers.length === 0
    && manifest.readiness === "READY_FOR_PROVIDER_REVIEW";
  const productionReviewPacketComplete = providerReviewPacketComplete && manifest.profile === "PRODUCTION";
  return resultSurface({
    profile: manifest.profile,
    providerReviewPacketComplete,
    productionReviewPacketComplete,
    blockers,
    violations,
  });
}

export function assertExternalCheckpointProviderReviewPacketComplete(manifest, options = {}) {
  const result = validateExternalCheckpointProviderReadinessManifest(manifest, options);
  if (!result.providerReviewPacketComplete) {
    const reasons = [...result.violations, ...result.blockers];
    throw new Error(`IAT B3 external checkpoint provider review packet is not complete:\n- ${reasons.join("\n- ")}`);
  }
  return result;
}

export function loadExternalCheckpointProviderReadinessManifest(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function parseCliArgs(argv) {
  let manifestPath = resolve(fileURLToPath(new URL(
    "../docs/b3/iat-b3-external-checkpoint-provider-readiness.v1.json",
    import.meta.url,
  )));
  let allowTestFixture = false;
  let evaluationUnixSeconds;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--manifest" && argv[index + 1]) {
      manifestPath = resolve(argv[index + 1]);
      index += 1;
    } else if (argument === "--allow-test-fixture") {
      allowTestFixture = true;
    } else if (argument === "--evaluation-unix-seconds" && argv[index + 1]) {
      evaluationUnixSeconds = argv[index + 1];
      index += 1;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }
  return { manifestPath, allowTestFixture, evaluationUnixSeconds };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    const { manifestPath, allowTestFixture, evaluationUnixSeconds } = parseCliArgs(process.argv.slice(2));
    const manifest = loadExternalCheckpointProviderReadinessManifest(manifestPath);
    const result = validateExternalCheckpointProviderReadinessManifest(manifest, {
      allowTestFixture,
      evaluationUnixSeconds,
    });
    console.log(JSON.stringify({ manifestPath, evaluationUnixSeconds: evaluationUnixSeconds ?? null, ...result }, null, 2));
    if (!result.providerReviewPacketComplete) process.exitCode = 2;
  } catch (error) {
    console.error(`IAT B3 external checkpoint provider-readiness validation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

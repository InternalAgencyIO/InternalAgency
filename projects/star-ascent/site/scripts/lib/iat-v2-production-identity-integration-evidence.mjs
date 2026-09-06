import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  PROVIDER_KINDS,
  validateProviderTrustBinding,
  verifyProviderSignedEnvelope,
} from "../../programs/iat_b3_reference/provider-authenticated-envelope.mjs";
import { canonicalizeRfc8785 } from "../iat-v2-canonical-json.mjs";
import { parseB3OwnerPolicyFreezeJson } from "../validate-iat-b3-owner-policy-freeze.mjs";

export const PRODUCTION_IDENTITY_INTEGRATION_EVIDENCE_SCHEMA =
  "iat-v2-production-identity-integration-evidence/v2";
export const PRODUCTION_IDENTITY_INTEGRATION_TRUST_SCHEMA =
  "iat-v2-production-identity-integration-trust/v1";
export const PRODUCTION_IDENTITY_INTEGRATION_PREDICATE =
  "PRODUCTION_IDENTITY_INTEGRATION_REHEARSAL";
export const PRODUCTION_IDENTITY_INTEGRATION_ENVIRONMENT =
  "NONPRODUCTION_X_CLOUDFLARE_INTEGRATION";

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(SCRIPT_ROOT, "../..");
const CANONICAL_TRUST_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-v2-production-identity-integration-trust.v1.json",
);
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const GIT_OBJECT = /^[0-9a-f]{40}$/u;
const SOURCE_ID = /^[a-z0-9][a-z0-9._:/-]{7,127}$/u;
const NONPRODUCTION_ID =
  /(?:^|[._:/-])(?:dev|dummy|example|fake|fixture|local|mock|placeholder|sample|sandbox|staging|synthetic|test)(?:$|[._:/-])/u;
const MAX_EVIDENCE_WINDOW_SECONDS = 900n;
const MAX_FUTURE_SKEW_SECONDS = 30n;
const MINIMUM_X_ACCOUNT_AGE_SECONDS = 40n * 24n * 60n * 60n;
const PROVIDER_ENDPOINT =
  "https://api.x.com/2/users/me?user.fields=created_at,subscription_type";
const RECEIPT_ROLES = Object.freeze([
  "CLOUDFLARE_D1_OBSERVER",
  "X_PROVIDER_OBSERVER",
]);
const ROLE_PROVIDER_KINDS = Object.freeze({
  CLOUDFLARE_D1_OBSERVER: PROVIDER_KINDS.EXTERNAL_CHECKPOINT,
  X_PROVIDER_OBSERVER: PROVIDER_KINDS.X_SOCIAL_EVIDENCE,
});
export const PRODUCTION_IDENTITY_INTEGRATION_SCENARIO_IDS = Object.freeze([
  "OAUTH-STATE-01",
  "D1-ROLLBACK-01",
  "IDENTITY-DUPLICATE-01",
  "OAUTH-REPLAY-01",
  "GENESIS-CONTENTION-01",
  "GENESIS-ORPHAN-01",
  "OAUTH-DEADLINE-01",
  "PROVIDER-GATE-01",
]);

const TRUST_KEYS = Object.freeze([
  "$schema",
  "schema",
  "status",
  "sources",
  "sourceSetSha256",
  "expectedSubjectBindingSha256",
  "expectedHarnessSha256",
  "expectedEnvironmentIdentitySha256",
  "expectedD1DeploymentIdentitySha256",
  "packetMaySelectEvidenceSources",
  "noSelfAttestation",
  "mainnetStatus",
]);
const TRUST_SOURCE_KEYS = Object.freeze([
  "sourceId",
  "role",
  "failureDomainId",
  "trustBinding",
]);
const EVIDENCE_KEYS = Object.freeze([
  "schema",
  "status",
  "predicate",
  "environment",
  "sourceBinding",
  "runBinding",
  "trustBindingSha256",
  "correlationNonceSha256",
  "xObservation",
  "d1Observation",
  "scenarios",
  "safety",
  "observedAtUtc",
  "expiresAtUtc",
  "receiptUrls",
  "mainnetStatus",
]);
const SOURCE_BINDING_KEYS = Object.freeze([
  "commit",
  "tree",
  "programArtifactSha256",
]);
const RUN_BINDING_KEYS = Object.freeze([
  "harnessSha256",
  "environmentIdentitySha256",
  "startedAtUtc",
  "completedAtUtc",
]);
const OBSERVATION_KEYS = Object.freeze([
  "sourceId",
  "stateBefore",
  "envelope",
  "requestObservationBase64url",
  "responseObservationBase64url",
  "expectedRequestNonceSha256",
  "verificationReceipt",
]);
const SCENARIO_KEYS = Object.freeze(["id", "result", "evidenceSha256"]);
const SAFETY = Object.freeze({
  credentialMaterialIncluded: false,
  oauthTokenRetained: false,
  personalDataIncluded: false,
  walletAccessed: false,
  signingPerformed: false,
  simulationForSigningPerformed: false,
  broadcastingPerformed: false,
  mainnetRequestPerformed: false,
  productionResourceMutationPerformed: false,
  nonproductionNetworkRequestsPerformed: true,
  nonproductionD1MutationPerformed: true,
  authorizesMainnet: false,
});
const X_REQUEST_KEYS = Object.freeze([
  "schema",
  "environment",
  "endpoint",
  "method",
  "correlationNonceSha256",
  "sourceCommit",
  "programArtifactSha256",
]);
const X_RESPONSE_KEYS = Object.freeze([
  "schema",
  "environment",
  "httpStatus",
  "providerRequestIdSha256",
  "immutableXUserIdSha256",
  "subscriptionType",
  "accountCreatedAtUtc",
  "observedAtUtc",
  "oauthTokenRetained",
  "personalDataRetained",
]);
const D1_REQUEST_KEYS = Object.freeze([
  "schema",
  "environment",
  "operation",
  "correlationNonceSha256",
  "sourceCommit",
  "programArtifactSha256",
]);
const D1_RESPONSE_KEYS = Object.freeze([
  "schema",
  "environment",
  "httpStatus",
  "cloudflareRequestIdSha256",
  "databaseIdentitySha256",
  "deploymentIdentitySha256",
  "stateBeforeSha256",
  "stateAfterSha256",
  "mutationReceipt",
  "scenarioSetSha256",
  "observedAtUtc",
]);
const MUTATION_RECEIPT_KEYS = Object.freeze([
  "schema",
  "status",
  "atomicCommitVerified",
  "subjectBindingSha256",
  "writeAdapterSha256",
  "immediateTranchePersisted",
  "conditionalUpgradePersisted",
  "mutationReceiptSha256",
]);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const semanticSha256 = (domain, value) => sha256(Buffer.concat([
  Buffer.from(`${domain}\0`, "utf8"),
  Buffer.from(canonicalizeRfc8785(value), "utf8"),
]));
const exactJson = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const isPlainObject = (value) => value !== null
  && typeof value === "object"
  && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;

function exactKeys(value, keys, path, violations) {
  const actual = isPlainObject(value) ? Object.keys(value).sort() : [];
  const expected = [...keys].sort();
  if (!isPlainObject(value) || !exactJson(actual, expected)) {
    violations.push(`${path}: keys must be exactly ${keys.join(", ")}`);
    return false;
  }
  return true;
}

function canonicalDigest(value, path, violations, { production = false } = {}) {
  if (typeof value !== "string" || !HEX_SHA256.test(value)) {
    violations.push(`${path}: expected lowercase SHA-256`);
    return false;
  }
  if (production && (/^0{64}$/u.test(value)
    || /^(?:([0-9a-f])\1{63}|([0-9a-f]{2})\2{31})$/u.test(value))) {
    violations.push(`${path}: placeholder digest is forbidden`);
    return false;
  }
  return true;
}

function canonicalUtc(value, path, violations) {
  if (typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)) {
    violations.push(`${path}: expected canonical whole-second UTC`);
    return null;
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)
    || new Date(milliseconds).toISOString().replace(".000Z", "Z") !== value) {
    violations.push(`${path}: invalid canonical UTC`);
    return null;
  }
  return BigInt(milliseconds / 1_000);
}

function canonicalEvaluationTime(value, violations) {
  if (typeof value === "bigint" && value >= 0n) return value;
  if (typeof value === "string" && /^(?:0|[1-9][0-9]*)$/u.test(value)) {
    return BigInt(value);
  }
  violations.push("evaluationUnixSeconds: explicit canonical unsigned time is required");
  return null;
}

function decodeCanonicalObservation(value, path, violations) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    violations.push(`${path}: expected unpadded base64url`);
    return null;
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length < 2 || bytes.length > 131_072 || bytes.toString("base64url") !== value) {
    violations.push(`${path}: noncanonical or out-of-bounds base64url`);
    return null;
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    violations.push(`${path}: observation bytes are not UTF-8`);
    return null;
  }
  let record;
  try {
    record = parseB3OwnerPolicyFreezeJson(text, path);
  } catch (error) {
    violations.push(`${path}: ${error.message}`);
    return null;
  }
  if (text !== canonicalizeRfc8785(record)) {
    violations.push(`${path}: observation JSON must be RFC8785 canonical bytes`);
    return null;
  }
  return { bytes, record };
}

function validateIdentifier(value, path, violations) {
  if (typeof value !== "string" || !SOURCE_ID.test(value) || NONPRODUCTION_ID.test(value)) {
    violations.push(`${path}: expected a non-placeholder configured source identifier`);
    return false;
  }
  return true;
}

function trustSourceSetCore({
  sources,
  expectedSubjectBindingSha256,
  expectedHarnessSha256,
  expectedEnvironmentIdentitySha256,
  expectedD1DeploymentIdentitySha256,
}) {
  return {
    schema: PRODUCTION_IDENTITY_INTEGRATION_TRUST_SCHEMA,
    status: "CONFIGURED_CANONICAL_OBSERVERS",
    sources,
    expectedSubjectBindingSha256,
    expectedHarnessSha256,
    expectedEnvironmentIdentitySha256,
    expectedD1DeploymentIdentitySha256,
    packetMaySelectEvidenceSources: false,
    noSelfAttestation: true,
    mainnetStatus: "HOLD",
  };
}

export function createProductionIdentityIntegrationTrust({
  sources,
  expectedSubjectBindingSha256,
  expectedHarnessSha256,
  expectedEnvironmentIdentitySha256,
  expectedD1DeploymentIdentitySha256,
} = {}) {
  if (!Array.isArray(sources)) throw new TypeError("sources must be an array");
  const violations = [];
  for (const [field, value] of Object.entries({
    expectedSubjectBindingSha256,
    expectedHarnessSha256,
    expectedEnvironmentIdentitySha256,
    expectedD1DeploymentIdentitySha256,
  })) canonicalDigest(value, field, violations, { production: true });
  if (violations.length > 0) throw new TypeError(violations.join("; "));
  const ordered = structuredClone(sources)
    .sort((left, right) => String(left.sourceId).localeCompare(String(right.sourceId)));
  const core = trustSourceSetCore({
    sources: ordered,
    expectedSubjectBindingSha256,
    expectedHarnessSha256,
    expectedEnvironmentIdentitySha256,
    expectedD1DeploymentIdentitySha256,
  });
  return {
    $schema: "./iat-v2-production-identity-integration-trust.v1.schema.json",
    schema: core.schema,
    status: core.status,
    sources: core.sources,
    sourceSetSha256: semanticSha256(
      "IAT_V2_PRODUCTION_IDENTITY_INTEGRATION_CANONICAL_OBSERVER_SET_V1",
      core,
    ),
    expectedSubjectBindingSha256: core.expectedSubjectBindingSha256,
    expectedHarnessSha256: core.expectedHarnessSha256,
    expectedEnvironmentIdentitySha256: core.expectedEnvironmentIdentitySha256,
    expectedD1DeploymentIdentitySha256: core.expectedD1DeploymentIdentitySha256,
    packetMaySelectEvidenceSources: core.packetMaySelectEvidenceSources,
    noSelfAttestation: core.noSelfAttestation,
    mainnetStatus: core.mainnetStatus,
  };
}

export function validateProductionIdentityIntegrationTrust(trust) {
  const violations = [];
  const sourcesByRole = new Map();
  if (!exactKeys(trust, TRUST_KEYS, "trust", violations)) {
    return { valid: false, configured: false, sourcesByRole, violations };
  }
  if (trust.$schema !== "./iat-v2-production-identity-integration-trust.v1.schema.json"
    || trust.schema !== PRODUCTION_IDENTITY_INTEGRATION_TRUST_SCHEMA
    || trust.packetMaySelectEvidenceSources !== false
    || trust.noSelfAttestation !== true
    || trust.mainnetStatus !== "HOLD") {
    violations.push("trust: schema, no-self-attestation, or Mainnet HOLD boundary drifted");
  }
  if (trust.status === "UNCONFIGURED_HOLD") {
    if (!Array.isArray(trust.sources) || trust.sources.length !== 0
      || trust.sourceSetSha256 !== null
      || trust.expectedSubjectBindingSha256 !== null
      || trust.expectedHarnessSha256 !== null
      || trust.expectedEnvironmentIdentitySha256 !== null
      || trust.expectedD1DeploymentIdentitySha256 !== null) {
      violations.push("trust: UNCONFIGURED_HOLD requires no sources and null canonical trust pins");
    }
    return {
      valid: violations.length === 0,
      configured: false,
      sourcesByRole,
      sourceSetSha256: null,
      expectedSubjectBindingSha256: null,
      expectedHarnessSha256: null,
      expectedEnvironmentIdentitySha256: null,
      expectedD1DeploymentIdentitySha256: null,
      violations,
    };
  }
  if (trust.status !== "CONFIGURED_CANONICAL_OBSERVERS") {
    violations.push("trust.status: expected UNCONFIGURED_HOLD or CONFIGURED_CANONICAL_OBSERVERS");
  }
  for (const field of [
    "expectedSubjectBindingSha256",
    "expectedHarnessSha256",
    "expectedEnvironmentIdentitySha256",
    "expectedD1DeploymentIdentitySha256",
  ]) canonicalDigest(trust[field], `trust.${field}`, violations, { production: true });
  if (!Array.isArray(trust.sources) || trust.sources.length !== 2) {
    violations.push("trust.sources: configured trust requires exactly two canonical observers");
  } else {
    const sourceIds = new Set();
    const failureDomains = new Set();
    const publicKeys = new Set();
    for (let index = 0; index < trust.sources.length; index += 1) {
      const source = trust.sources[index];
      const path = `trust.sources[${index}]`;
      if (!exactKeys(source, TRUST_SOURCE_KEYS, path, violations)) continue;
      validateIdentifier(source.sourceId, `${path}.sourceId`, violations);
      validateIdentifier(source.failureDomainId, `${path}.failureDomainId`, violations);
      if (!RECEIPT_ROLES.includes(source.role) || sourcesByRole.has(source.role)) {
        violations.push(`${path}.role: exact distinct observer role is required`);
      } else {
        sourcesByRole.set(source.role, source);
      }
      if (index > 0 && trust.sources[index - 1].sourceId >= source.sourceId) {
        violations.push("trust.sources: source IDs must be strictly sorted");
      }
      if (sourceIds.has(source.sourceId)) violations.push(`${path}.sourceId: duplicate`);
      if (failureDomains.has(source.failureDomainId)) violations.push(`${path}.failureDomainId: duplicate`);
      sourceIds.add(source.sourceId);
      failureDomains.add(source.failureDomainId);
      try {
        validateProviderTrustBinding(source.trustBinding);
        if (source.trustBinding.subjectBindingSha256
          !== trust.expectedSubjectBindingSha256) {
          violations.push(`${path}.trustBinding: canonical subject binding mismatch`);
        }
        if (source.trustBinding.providerKind !== ROLE_PROVIDER_KINDS[source.role]) {
          violations.push(`${path}.trustBinding: provider kind does not match observer role`);
        }
        for (const key of source.trustBinding.keys) {
          if (publicKeys.has(key.publicKeySha256)) {
            violations.push(`${path}.trustBinding: observer signing key is reused`);
          }
          publicKeys.add(key.publicKeySha256);
        }
      } catch (error) {
        violations.push(`${path}.trustBinding: ${error.message}`);
      }
    }
    if (!RECEIPT_ROLES.every((role) => sourcesByRole.has(role))) {
      violations.push("trust.sources: exact X and Cloudflare D1 observer roles are required");
    }
    const core = trustSourceSetCore({
      sources: trust.sources,
      expectedSubjectBindingSha256: trust.expectedSubjectBindingSha256,
      expectedHarnessSha256: trust.expectedHarnessSha256,
      expectedEnvironmentIdentitySha256: trust.expectedEnvironmentIdentitySha256,
      expectedD1DeploymentIdentitySha256: trust.expectedD1DeploymentIdentitySha256,
    });
    const expected = semanticSha256(
      "IAT_V2_PRODUCTION_IDENTITY_INTEGRATION_CANONICAL_OBSERVER_SET_V1",
      core,
    );
    if (trust.sourceSetSha256 !== expected) {
      violations.push("trust.sourceSetSha256: configured canonical observer-set digest mismatch");
    }
  }
  return {
    valid: violations.length === 0,
    configured: violations.length === 0,
    sourcesByRole,
    sourceSetSha256: trust.sourceSetSha256,
    expectedSubjectBindingSha256: trust.expectedSubjectBindingSha256,
    expectedHarnessSha256: trust.expectedHarnessSha256,
    expectedEnvironmentIdentitySha256: trust.expectedEnvironmentIdentitySha256,
    expectedD1DeploymentIdentitySha256: trust.expectedD1DeploymentIdentitySha256,
    violations,
  };
}

export function parseProductionIdentityIntegrationEvidenceJson(text, label = "evidence") {
  return parseB3OwnerPolicyFreezeJson(text, label);
}

export function loadProductionIdentityIntegrationTrust(path = CANONICAL_TRUST_PATH) {
  const resolved = resolve(path);
  return parseB3OwnerPolicyFreezeJson(readFileSync(resolved, "utf8"), resolved);
}

export function productionIdentityIntegrationScenarioSetSha256(scenarios) {
  return semanticSha256("IAT_V2_PRODUCTION_IDENTITY_INTEGRATION_SCENARIOS_V2", scenarios);
}

export function productionIdentityIntegrationObservationSigningBytes(unsignedReceipt) {
  if (!isPlainObject(unsignedReceipt)) throw new TypeError("unsigned observation receipt is required");
  return Buffer.concat([
    Buffer.from("IAT_V2_PRODUCTION_IDENTITY_INTEGRATION_OBSERVATION_V2\0", "utf8"),
    Buffer.from(canonicalizeRfc8785(unsignedReceipt), "utf8"),
  ]);
}

function validateReceiptUrl(value, envelopeSha256, path, violations) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.+$/u, "");
    if (url.protocol !== "https:" || url.username !== "" || url.password !== ""
      || url.hash !== "" || host === "localhost" || host === "example.com"
      || host.startsWith("placeholder") || !value.includes(envelopeSha256)) {
      violations.push(`${path}: receipt must be public HTTPS and bind the exact envelope digest`);
      return false;
    }
    return true;
  } catch {
    violations.push(`${path}: invalid receipt URL`);
    return false;
  }
}

function validateProviderObservation({
  observation,
  role,
  trustResult,
  evidence,
  evaluationUnixSeconds,
  path,
  violations,
}) {
  const before = violations.length;
  if (!exactKeys(observation, OBSERVATION_KEYS, path, violations)) return null;
  const source = trustResult.sourcesByRole.get(role);
  if (!source || observation.sourceId !== source.sourceId) {
    violations.push(`${path}.sourceId: does not select the configured ${role}`);
  }
  if (observation.expectedRequestNonceSha256 !== evidence.correlationNonceSha256) {
    violations.push(`${path}.expectedRequestNonceSha256: correlation nonce mismatch`);
  }
  const request = decodeCanonicalObservation(
    observation.requestObservationBase64url,
    `${path}.requestObservationBase64url`,
    violations,
  );
  const response = decodeCanonicalObservation(
    observation.responseObservationBase64url,
    `${path}.responseObservationBase64url`,
    violations,
  );
  let executedReceipt = null;
  if (source && request && response && evaluationUnixSeconds !== null) {
    try {
      executedReceipt = verifyProviderSignedEnvelope({
        trustBinding: source.trustBinding,
        currentState: observation.stateBefore,
        envelope: observation.envelope,
        requestBytes: request.bytes,
        responseBytes: response.bytes,
        expectedRequestNonceSha256: observation.expectedRequestNonceSha256,
        evaluationUnixSeconds,
      });
      if (!exactJson(executedReceipt, observation.verificationReceipt)) {
        violations.push(`${path}.verificationReceipt: does not equal directly executed verification`);
      }
    } catch (error) {
      violations.push(`${path}: ${error.message}`);
    }
  }
  return violations.length === before ? {
    request: request.record,
    response: response.record,
    executedReceipt,
  } : null;
}

function validateXObservation(value, evidence, trustResult, evaluationUnixSeconds, violations) {
  const observed = validateProviderObservation({
    observation: value,
    role: "X_PROVIDER_OBSERVER",
    trustResult,
    evidence,
    evaluationUnixSeconds,
    path: "evidence.xObservation",
    violations,
  });
  if (!observed) return false;
  const request = observed.request;
  const response = observed.response;
  if (!exactKeys(request, X_REQUEST_KEYS, "x request observation", violations)
    || request.schema !== "iat-v2-production-identity-x-request-observation/v1"
    || request.environment !== PRODUCTION_IDENTITY_INTEGRATION_ENVIRONMENT
    || request.endpoint !== PROVIDER_ENDPOINT
    || request.method !== "GET"
    || request.correlationNonceSha256 !== evidence.correlationNonceSha256
    || request.sourceCommit !== evidence.sourceBinding?.commit
    || request.programArtifactSha256 !== evidence.sourceBinding?.programArtifactSha256) {
    violations.push("x request observation: exact nonproduction source-bound request is required");
  }
  if (!exactKeys(response, X_RESPONSE_KEYS, "x response observation", violations)
    || response.schema !== "iat-v2-production-identity-x-response-observation/v1"
    || response.environment !== PRODUCTION_IDENTITY_INTEGRATION_ENVIRONMENT
    || response.httpStatus !== 200
    || !["None", "Basic", "Premium", "PremiumPlus"].includes(response.subscriptionType)
    || response.observedAtUtc !== evidence.observedAtUtc
    || response.oauthTokenRetained !== false
    || response.personalDataRetained !== false) {
    violations.push("x response observation: exact redacted nonproduction result is required");
  }
  canonicalDigest(response.providerRequestIdSha256, "x response providerRequestIdSha256", violations, { production: true });
  canonicalDigest(response.immutableXUserIdSha256, "x response immutableXUserIdSha256", violations, { production: true });
  const createdAt = canonicalUtc(response.accountCreatedAtUtc, "x response accountCreatedAtUtc", violations);
  const observedAt = canonicalUtc(response.observedAtUtc, "x response observedAtUtc", violations);
  if (createdAt !== null && observedAt !== null
    && (createdAt > observedAt || observedAt - createdAt < MINIMUM_X_ACCOUNT_AGE_SECONDS)) {
    violations.push("x response account age: at least forty complete days are required");
  }
  if (value.envelope?.operation !== "X_IDENTITY_TIER_OBSERVATION") {
    violations.push("evidence.xObservation.envelope.operation: exact X identity-tier operation required");
  }
  return true;
}

function validateMutationReceipt(value, expectedSubjectBindingSha256, violations) {
  if (!exactKeys(value, MUTATION_RECEIPT_KEYS, "D1 mutation receipt", violations)) return false;
  if (value.schema !== "iat-b3-retained-v2-x-callback-mutation-receipt/v1"
    || value.status !== "COMMITTED"
    || value.atomicCommitVerified !== true
    || value.subjectBindingSha256 !== expectedSubjectBindingSha256
    || value.immediateTranchePersisted !== true
    || ![null, true].includes(value.conditionalUpgradePersisted)) {
    violations.push("D1 mutation receipt: exact canonical-subject-bound atomic retained-V2 result required");
  }
  for (const field of ["subjectBindingSha256", "writeAdapterSha256", "mutationReceiptSha256"]) {
    canonicalDigest(value[field], `D1 mutation receipt.${field}`, violations, { production: true });
  }
  return true;
}

function validateD1Observation(value, evidence, trustResult, evaluationUnixSeconds, violations) {
  const observed = validateProviderObservation({
    observation: value,
    role: "CLOUDFLARE_D1_OBSERVER",
    trustResult,
    evidence,
    evaluationUnixSeconds,
    path: "evidence.d1Observation",
    violations,
  });
  if (!observed) return false;
  const request = observed.request;
  const response = observed.response;
  if (!exactKeys(request, D1_REQUEST_KEYS, "D1 request observation", violations)
    || request.schema !== "iat-v2-production-identity-d1-request-observation/v1"
    || request.environment !== PRODUCTION_IDENTITY_INTEGRATION_ENVIRONMENT
    || request.operation !== "INTEGRATION_REHEARSAL_ATOMIC_MUTATION"
    || request.correlationNonceSha256 !== evidence.correlationNonceSha256
    || request.sourceCommit !== evidence.sourceBinding?.commit
    || request.programArtifactSha256 !== evidence.sourceBinding?.programArtifactSha256) {
    violations.push("D1 request observation: exact nonproduction source-bound request is required");
  }
  if (!exactKeys(response, D1_RESPONSE_KEYS, "D1 response observation", violations)
    || response.schema !== "iat-v2-production-identity-d1-response-observation/v1"
    || response.environment !== PRODUCTION_IDENTITY_INTEGRATION_ENVIRONMENT
    || response.httpStatus !== 200
    || response.deploymentIdentitySha256
      !== trustResult.expectedD1DeploymentIdentitySha256
    || response.observedAtUtc !== evidence.observedAtUtc) {
    violations.push("D1 response observation: exact canonical-deployment nonproduction result is required");
  }
  for (const field of [
    "cloudflareRequestIdSha256",
    "databaseIdentitySha256",
    "deploymentIdentitySha256",
    "stateBeforeSha256",
    "stateAfterSha256",
  ]) canonicalDigest(response[field], `D1 response.${field}`, violations, { production: true });
  if (response.stateBeforeSha256 === response.stateAfterSha256) {
    violations.push("D1 response: before and after state digests must differ");
  }
  validateMutationReceipt(
    response.mutationReceipt,
    trustResult.expectedSubjectBindingSha256,
    violations,
  );
  if (response.scenarioSetSha256 !== productionIdentityIntegrationScenarioSetSha256(evidence.scenarios)) {
    violations.push("D1 response.scenarioSetSha256: scenario result set is not bound");
  }
  if (value.envelope?.operation !== "CHECKPOINT_COMPARE_AND_SWAP") {
    violations.push("evidence.d1Observation.envelope.operation: exact D1 compare-and-swap operation required");
  }
  return true;
}

function invalidResult(violations, evidence = null, extra = {}) {
  return Object.freeze({
    valid: false,
    predicate: evidence?.predicate ?? null,
    sourceBound: false,
    canonicalTrustPinsConfigured: false,
    canonicalTrustPinnedObserverSignaturesVerified: false,
    xOAuthObserved: false,
    d1MutationObserved: false,
    allScenariosPassed: false,
    sourceCommit: evidence?.sourceBinding?.commit ?? null,
    sourceTree: evidence?.sourceBinding?.tree ?? null,
    programArtifactSha256: evidence?.sourceBinding?.programArtifactSha256 ?? null,
    observedAtUtc: evidence?.observedAtUtc ?? null,
    expiresAtUtc: evidence?.expiresAtUtc ?? null,
    receiptUrls: Object.freeze([]),
    checkIds: Object.freeze([]),
    mainnetStatus: "HOLD",
    ...extra,
    violations: Object.freeze([...violations]),
  });
}

export function validateProductionIdentityIntegrationEvidence({
  evidenceBytes,
  trust = undefined,
  expectedSourceCommit,
  expectedSourceTree,
  expectedProgramArtifactSha256,
  evaluationUnixSeconds,
  projectRoot = SITE_ROOT,
} = {}) {
  void projectRoot;
  const violations = [];
  let evidence;
  try {
    if (!(evidenceBytes instanceof Uint8Array) || evidenceBytes.byteLength < 2
      || evidenceBytes.byteLength > 2_097_152) {
      throw new TypeError("evidenceBytes must be bounded direct bytes");
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(evidenceBytes);
    evidence = parseProductionIdentityIntegrationEvidenceJson(text, "evidence");
  } catch (error) {
    return invalidResult([`evidence: ${error.message}`]);
  }
  if (!exactKeys(evidence, EVIDENCE_KEYS, "evidence", violations)) {
    return invalidResult(violations, evidence);
  }
  if (evidence.schema !== PRODUCTION_IDENTITY_INTEGRATION_EVIDENCE_SCHEMA
    || evidence.status !== "DIRECT_EVIDENCE_COMPLETE"
    || evidence.predicate !== PRODUCTION_IDENTITY_INTEGRATION_PREDICATE
    || evidence.environment !== PRODUCTION_IDENTITY_INTEGRATION_ENVIRONMENT
    || evidence.mainnetStatus !== "HOLD") {
    violations.push("evidence: exact v2 nonproduction predicate and Mainnet HOLD header required");
  }
  let trustValue = trust;
  try {
    if (trustValue === undefined) trustValue = loadProductionIdentityIntegrationTrust();
  } catch (error) {
    violations.push(`trust: ${error.message}`);
    return invalidResult(violations, evidence);
  }
  const trustResult = validateProductionIdentityIntegrationTrust(trustValue);
  violations.push(...trustResult.violations);
  if (!trustResult.configured) violations.push("TRUST_UNCONFIGURED_HOLD");
  if (evidence.trustBindingSha256 !== trustResult.sourceSetSha256) {
    violations.push("evidence.trustBindingSha256: canonical observer trust mismatch");
  }

  let sourceBound = false;
  if (exactKeys(evidence.sourceBinding, SOURCE_BINDING_KEYS, "evidence.sourceBinding", violations)) {
    if (!GIT_OBJECT.test(evidence.sourceBinding.commit)
      || !GIT_OBJECT.test(evidence.sourceBinding.tree)
      || !HEX_SHA256.test(evidence.sourceBinding.programArtifactSha256)) {
      violations.push("evidence.sourceBinding: malformed Git or artifact identity");
    }
    sourceBound = evidence.sourceBinding.commit === expectedSourceCommit
      && evidence.sourceBinding.tree === expectedSourceTree
      && evidence.sourceBinding.programArtifactSha256 === expectedProgramArtifactSha256;
    if (!sourceBound) violations.push("evidence.sourceBinding: expected clearance binding mismatch");
  }
  canonicalDigest(evidence.correlationNonceSha256, "evidence.correlationNonceSha256", violations, { production: true });
  if (exactKeys(evidence.runBinding, RUN_BINDING_KEYS, "evidence.runBinding", violations)) {
    canonicalDigest(evidence.runBinding.harnessSha256, "evidence.runBinding.harnessSha256", violations, { production: true });
    canonicalDigest(evidence.runBinding.environmentIdentitySha256, "evidence.runBinding.environmentIdentitySha256", violations, { production: true });
    if (evidence.runBinding.harnessSha256 !== trustResult.expectedHarnessSha256) {
      violations.push("evidence.runBinding.harnessSha256: canonical trust pin mismatch");
    }
    if (evidence.runBinding.environmentIdentitySha256
      !== trustResult.expectedEnvironmentIdentitySha256) {
      violations.push("evidence.runBinding.environmentIdentitySha256: canonical trust pin mismatch");
    }
  }
  const startedAt = canonicalUtc(evidence.runBinding?.startedAtUtc, "evidence.runBinding.startedAtUtc", violations);
  const completedAt = canonicalUtc(evidence.runBinding?.completedAtUtc, "evidence.runBinding.completedAtUtc", violations);
  const observedAt = canonicalUtc(evidence.observedAtUtc, "evidence.observedAtUtc", violations);
  const expiresAt = canonicalUtc(evidence.expiresAtUtc, "evidence.expiresAtUtc", violations);
  const evaluation = canonicalEvaluationTime(evaluationUnixSeconds, violations);
  if (startedAt !== null && completedAt !== null && observedAt !== null && expiresAt !== null) {
    if (startedAt > completedAt || completedAt !== observedAt
      || completedAt - startedAt > MAX_EVIDENCE_WINDOW_SECONDS
      || expiresAt <= observedAt || expiresAt - observedAt > MAX_EVIDENCE_WINDOW_SECONDS) {
      violations.push("evidence timing: run/observation/expiry interval is invalid or too wide");
    }
    if (evaluation !== null
      && (observedAt > evaluation + MAX_FUTURE_SKEW_SECONDS || evaluation >= expiresAt)) {
      violations.push("evidence timing: evidence is future-dated or expired");
    }
  }

  let allScenariosPassed = false;
  if (!Array.isArray(evidence.scenarios) || evidence.scenarios.length !== 8) {
    violations.push("evidence.scenarios: exactly eight results required");
  } else {
    allScenariosPassed = true;
    for (let index = 0; index < evidence.scenarios.length; index += 1) {
      const scenario = evidence.scenarios[index];
      if (!exactKeys(scenario, SCENARIO_KEYS, `evidence.scenarios[${index}]`, violations)
        || scenario.id !== PRODUCTION_IDENTITY_INTEGRATION_SCENARIO_IDS[index]
        || scenario.result !== "PASS"
        || !canonicalDigest(scenario.evidenceSha256, `evidence.scenarios[${index}].evidenceSha256`, violations, { production: true })) {
        allScenariosPassed = false;
      }
    }
  }
  if (!exactKeys(evidence.safety, Object.keys(SAFETY), "evidence.safety", violations)
    || !exactJson(evidence.safety, SAFETY)) {
    violations.push("evidence.safety: exact nonproduction/no-secret/no-Mainnet boundary required");
  }

  const xOAuthObserved = trustResult.configured
    && validateXObservation(evidence.xObservation, evidence, trustResult, evaluation, violations);
  const d1MutationObserved = trustResult.configured
    && validateD1Observation(evidence.d1Observation, evidence, trustResult, evaluation, violations);
  let receiptUrlsValid = true;
  if (!Array.isArray(evidence.receiptUrls) || evidence.receiptUrls.length !== 2
    || new Set(evidence.receiptUrls).size !== 2) {
    violations.push("evidence.receiptUrls: exactly two distinct public receipts required");
    receiptUrlsValid = false;
  } else {
    receiptUrlsValid = validateReceiptUrl(
      evidence.receiptUrls[0],
      evidence.xObservation?.envelope?.envelopeSha256,
      "evidence.receiptUrls[0]",
      violations,
    ) && validateReceiptUrl(
      evidence.receiptUrls[1],
      evidence.d1Observation?.envelope?.envelopeSha256,
      "evidence.receiptUrls[1]",
      violations,
    );
  }
  const canonicalTrustPinnedObserverSignaturesVerified = trustResult.configured
    && xOAuthObserved && d1MutationObserved;
  const valid = violations.length === 0
    && sourceBound
    && canonicalTrustPinnedObserverSignaturesVerified
    && allScenariosPassed
    && receiptUrlsValid;
  return Object.freeze({
    valid,
    predicate: evidence.predicate,
    sourceBound,
    canonicalTrustPinsConfigured: trustResult.configured,
    canonicalTrustPinnedObserverSignaturesVerified,
    xOAuthObserved,
    d1MutationObserved,
    allScenariosPassed,
    sourceCommit: evidence.sourceBinding?.commit ?? null,
    sourceTree: evidence.sourceBinding?.tree ?? null,
    programArtifactSha256: evidence.sourceBinding?.programArtifactSha256 ?? null,
    observedAtUtc: evidence.observedAtUtc,
    expiresAtUtc: evidence.expiresAtUtc,
    receiptUrls: Object.freeze(valid ? [...evidence.receiptUrls] : []),
    checkIds: Object.freeze(valid ? [...PRODUCTION_IDENTITY_INTEGRATION_SCENARIO_IDS] : []),
    mainnetStatus: "HOLD",
    violations: Object.freeze([...violations]),
  });
}

#!/usr/bin/env node

import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { canonicalizeRfc8785 } from "./iat-v2-canonical-json.mjs";
import {
  EXPECTED_SEAL_ORDER,
  IAT_V2_PROGRAM_ID,
  isCanonicalBase58Key,
  parseIdentityFreezeJson,
  validateIdentityFreezeManifest,
} from "./validate-iat-b3-identity-freeze.mjs";
import { parseB3OwnerPolicyFreezeJson } from "./validate-iat-b3-owner-policy-freeze.mjs";

export const PRODUCTION_IDENTITY_AUTHORITY_EVIDENCE_SCHEMA =
  "iat-b3-production-identity-authority-evidence/v1";
export const PRODUCTION_IDENTITY_AUTHORITY_TRUST_SCHEMA =
  "iat-b3-production-identity-authority-trust-binding/v1";
export const PRODUCTION_IDENTITY_AUTHORITY_ATTESTATION_SCHEMA =
  "iat-b3-production-identity-authority-attestation/v1";
export const PRODUCTION_IDENTITY_AUTHORITY_MAINNET_STATUS = "HOLD";

export const PRODUCTION_IDENTITY_AUTHORITY_SOURCE_BINDINGS = Object.freeze({
  ownerPolicyFreeze: Object.freeze({
    path: "projects/star-ascent/site/docs/b3/iat-b3-owner-policy-freeze.v1.json",
    sha256: "9bd866fa99735b1b53d3b99d8083397e1d734b0b80587ff9e513340d437efd6c",
    bindingScope: "EXACT_COMMITTED_INPUT_ONLY",
  }),
  identityInputFreeze: Object.freeze({
    path: "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json",
    sha256: "a6811b48c739ee4570e7f13793a9bb324a6e44598f7852105f4afa2f73acfa29",
    bindingScope: "EXACT_COMMITTED_INPUT_ONLY",
  }),
  costFeasibilityReference: Object.freeze({
    path: "projects/star-ascent/site/docs/b3/COST_FEASIBILITY.md",
    sha256: "44684ef17a173e01eb36e9e7a0de3297b62c5f7b6aa1035f0d1995641ba3c289",
    bindingScope: "REFERENCE_ONLY_NEVER_COMPLETION_EVIDENCE",
  }),
});

export const PRODUCTION_IDENTITY_AUTHORITY_SCOPE = Object.freeze({
  contract: "NONACTIVATING_PRODUCTION_IDENTITY_AUTHORITY_EVIDENCE_INTAKE",
  stagedPredicates: Object.freeze([
    "A_PRODUCTION_IDENTITY_INPUT_FREEZE",
    "B_COST_CEREMONY_FUNDING",
    "C_DEPLOYED_IDENTITY_AUTHORITY_SEAL",
  ]),
  doesNotCertify: Object.freeze([
    "PACKET_SELECTED_TRUST_KEYS",
    "LIVE_RPC_OR_CHAIN_TRUTH_WITHOUT_TWO_SIGNED_OBSERVATIONS",
    "FINAL_BINARY_TRUTH_WITHOUT_EXACT_BINDINGS",
    "OWNER_OR_REVIEWER_IDENTITY_WITHOUT_EXTERNAL_TRUST_CONFIGURATION",
    "TRANSACTION_SIGNING_DEPLOYMENT_FUNDING_OR_ACTIVATION_AUTHORITY",
    "INDEPENDENT_GATE_8_ACCEPTANCE",
    "RELEASE_OR_MAINNET_EXECUTION_AUTHORIZATION",
  ]),
});

export const EMPTY_PRODUCTION_IDENTITY_AUTHORITY_TRUST_BINDING = Object.freeze({
  schema: PRODUCTION_IDENTITY_AUTHORITY_TRUST_SCHEMA,
  status: "EXTERNAL_ACCEPTANCE_REQUIRED",
  keys: Object.freeze([]),
  trustRootSha256: null,
  packetMaySelectTrustKeys: false,
});

const SCRIPT_ROOT = fileURLToPath(new URL("./", import.meta.url));
const DEFAULT_MANIFEST_PATH = resolve(
  SCRIPT_ROOT,
  "../docs/b3/iat-b3-production-identity-authority-evidence.v1.json",
);
const HEX_32 = /^[0-9a-f]{64}$/u;
const U64_DECIMAL = /^(?:0|[1-9][0-9]{0,19})$/u;
const KEY_ID = /^[a-z0-9][a-z0-9._:/-]{7,127}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const SIGNING_PREFIX = Buffer.from(
  "IAT_B3_PRODUCTION_IDENTITY_AUTHORITY_ATTESTATION_V1\0",
  "utf8",
);
const MAX_U64 = (1n << 64n) - 1n;
const COST_CEILING_LAMPORTS = 3_000_000_000n;
const MAX_LIVE_OBSERVATION_AGE_SECONDS = 900n;
const MAX_ENDPOINT_PAIR_SKEW_SECONDS = 120n;
const MAX_INDEPENDENT_REVIEW_LAG_SECONDS = 300n;
const MAX_FUNDING_EVIDENCE_LIFETIME_SECONDS = 900n;
const FORBIDDEN_PRODUCTION_IDENTITIES = new Set([
  IAT_V2_PROGRAM_ID,
  "7XZpNks16qmWruJxKzmB3JSsZUdtAJYCNSPEZ3GxdoZ8",
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
  "D6UucuMprPAYyCmr5UPU5h9YhRf2ZNtn23JTS32EjdjY",
  "GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU",
]);

const TOP_LEVEL_KEYS = Object.freeze([
  "$schema",
  "schema",
  "profile",
  "status",
  "scope",
  "sourceBindings",
  "productionChoices",
  "phaseAProductionIdentityFreeze",
  "phaseBCeremonyFunding",
  "phaseCDeployedSeal",
  "authorizationBoundary",
]);
const CHOICE_KEYS = Object.freeze([
  "lawProgramId",
  "economyProgramId",
  "canonicalMint",
  "mainnetGenesisHash",
  "ceremonySignerPublicKey",
  "lawUpgradeAuthorityPublicKey",
  "economyUpgradeAuthorityPublicKey",
  "payerPublicKey",
]);
const ATTESTATION_KEYS = Object.freeze([
  "schema",
  "kind",
  "stage",
  "keyId",
  "observedAtUnixSeconds",
  "endpointSha256",
  "subjectSha256",
  "observationValue",
  "decision",
  "signatureBase64url",
]);
const TRUST_KEYS = Object.freeze([
  "schema",
  "status",
  "keys",
  "trustRootSha256",
  "packetMaySelectTrustKeys",
]);
const TRUST_KEY_KEYS = Object.freeze([
  "keyId",
  "role",
  "publicKeySpkiDerBase64url",
  "publicKeySha256",
]);
const BINARY_KEYS = Object.freeze([
  "programId",
  "sha256",
  "byteLength",
  "sourceHeadSha256",
]);
const JOURNAL_KEYS = Object.freeze(["ordinal", "step", "status", "evidenceSha256"]);
const TERMINAL_STATE_KEYS = Object.freeze([
  "lawProgramId",
  "economyProgramId",
  "canonicalMint",
  "lawBinarySha256",
  "economyBinarySha256",
  "lawUpgradeAuthority",
  "economyUpgradeAuthority",
  "mintAuthority",
  "freezeAuthority",
  "transferHookAuthority",
  "confidentialTransferMintAuthority",
  "active",
  "genesisStagingWritesDisabled",
  "stateSha256",
]);
const TRUST_ROLES = Object.freeze({
  OWNER_DECISION: "OWNER_DECISION",
  ENDPOINT_OBSERVER: "ENDPOINT_OBSERVER",
  INDEPENDENT_REVIEWER: "INDEPENDENT_REVIEWER",
});

function isPlainObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, expected, path, violations) {
  if (!isPlainObject(value)) {
    violations.push(`${path}: expected a plain object`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length
    || actual.some((key, index) => key !== wanted[index])) {
    violations.push(`${path}: expected exact keys ${wanted.join(",")}`);
    return false;
  }
  return true;
}

function exactJson(left, right) {
  try {
    return canonicalizeRfc8785(left) === canonicalizeRfc8785(right);
  } catch {
    return false;
  }
}

function safeCanonicalClone(value, violations) {
  try {
    return JSON.parse(canonicalizeRfc8785(value));
  } catch (error) {
    violations.push(`manifest: expected strict RFC8785-compatible data (${error.message})`);
    return null;
  }
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Canonical(domain, value) {
  return sha256Bytes(Buffer.from(canonicalizeRfc8785({ domain, value }), "utf8"));
}

function canonicalDigest(value, path, violations, { nullable = false } = {}) {
  if (value === null && nullable) return null;
  if (typeof value !== "string"
    || !HEX_32.test(value)
    || /^(?:([0-9a-f])\1{63}|([0-9a-f]{2})\2{31})$/u.test(value)) {
    violations.push(`${path}: expected a non-placeholder lowercase SHA-256`);
    return null;
  }
  return value;
}

function canonicalU64(value, path, violations, { nullable = false, positive = false } = {}) {
  if (value === null && nullable) return null;
  if (typeof value !== "string" || !U64_DECIMAL.test(value)) {
    violations.push(`${path}: expected a canonical unsigned 64-bit decimal string`);
    return null;
  }
  const parsed = BigInt(value);
  if (parsed > MAX_U64 || (positive && parsed === 0n)) {
    violations.push(`${path}: unsigned 64-bit value is out of range`);
    return null;
  }
  return parsed;
}

function validateProductionKey(value, path, violations, { nullable }) {
  if (value === null && nullable) return false;
  if (!isCanonicalBase58Key(value)) {
    violations.push(`${path}: expected a canonical 32-byte base58 public value`);
    return false;
  }
  if (FORBIDDEN_PRODUCTION_IDENTITIES.has(value)) {
    violations.push(`${path}: retained V2, 7XZ, system, token-program, and disposable fixture identities are forbidden`);
    return false;
  }
  return true;
}

function decodedBase64url(value, expectedBytes, path, violations) {
  if (typeof value !== "string" || !BASE64URL.test(value)) {
    violations.push(`${path}: expected canonical unpadded base64url`);
    return null;
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== expectedBytes || bytes.toString("base64url") !== value) {
    violations.push(`${path}: wrong length or noncanonical base64url`);
    return null;
  }
  return bytes;
}

function validateExternalTrustBinding(binding, violations, blockers) {
  if (!exactKeys(binding, TRUST_KEYS, "trustBinding", violations)) return null;
  if (binding.schema !== PRODUCTION_IDENTITY_AUTHORITY_TRUST_SCHEMA) {
    violations.push("trustBinding.schema: unsupported schema");
  }
  if (binding.packetMaySelectTrustKeys !== false) {
    violations.push("trustBinding.packetMaySelectTrustKeys: packet-selected trust keys are forbidden");
  }
  if (binding.status === "EXTERNAL_ACCEPTANCE_REQUIRED") {
    if (!Array.isArray(binding.keys) || binding.keys.length !== 0 || binding.trustRootSha256 !== null) {
      violations.push("trustBinding: pending external acceptance requires zero keys and null trust root");
    }
    blockers.push("trustBinding: externally pinned owner, two observer, and independent reviewer keys are absent");
    return null;
  }
  if (binding.status !== "CONFIGURED_EXTERNAL_TRUST_ROOT") {
    violations.push("trustBinding.status: expected EXTERNAL_ACCEPTANCE_REQUIRED or CONFIGURED_EXTERNAL_TRUST_ROOT");
    return null;
  }
  if (!Array.isArray(binding.keys) || binding.keys.length !== 4) {
    violations.push("trustBinding.keys: expected exactly owner + two observer + independent reviewer keys");
    return null;
  }
  const records = [];
  const ids = new Set();
  const publicKeyDigests = new Set();
  for (let index = 0; index < binding.keys.length; index += 1) {
    const entry = binding.keys[index];
    const path = `trustBinding.keys[${index}]`;
    if (!exactKeys(entry, TRUST_KEY_KEYS, path, violations)) continue;
    if (typeof entry.keyId !== "string" || !KEY_ID.test(entry.keyId)) {
      violations.push(`${path}.keyId: expected a canonical external key identifier`);
    }
    if (!Object.values(TRUST_ROLES).includes(entry.role)) {
      violations.push(`${path}.role: unsupported trust role`);
    }
    if (ids.has(entry.keyId)) violations.push(`${path}.keyId: duplicate key identifier`);
    ids.add(entry.keyId);
    if (index > 0 && String(binding.keys[index - 1]?.keyId) >= String(entry.keyId)) {
      violations.push("trustBinding.keys: key identifiers must be unique and strictly sorted");
    }
    const der = decodedBase64url(
      entry.publicKeySpkiDerBase64url,
      ED25519_SPKI_PREFIX.length + 32,
      `${path}.publicKeySpkiDerBase64url`,
      violations,
    );
    let keyObject = null;
    if (der) {
      if (!der.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
        violations.push(`${path}.publicKeySpkiDerBase64url: expected canonical Ed25519 SPKI`);
      } else if (der.subarray(ED25519_SPKI_PREFIX.length).every((byte) => byte === 0)) {
        violations.push(`${path}.publicKeySpkiDerBase64url: zero Ed25519 key is forbidden`);
      } else {
        try {
          keyObject = createPublicKey({ key: der, format: "der", type: "spki" });
          if (keyObject.asymmetricKeyType !== "ed25519"
            || !keyObject.export({ format: "der", type: "spki" }).equals(der)) {
            violations.push(`${path}.publicKeySpkiDerBase64url: noncanonical Ed25519 key`);
            keyObject = null;
          }
        } catch {
          violations.push(`${path}.publicKeySpkiDerBase64url: invalid Ed25519 key`);
        }
      }
      const digest = sha256Bytes(der);
      if (entry.publicKeySha256 !== digest) {
        violations.push(`${path}.publicKeySha256: does not bind exact SPKI bytes`);
      }
      if (publicKeyDigests.has(digest)) violations.push(`${path}: public key reused across independent roles`);
      publicKeyDigests.add(digest);
    }
    records.push({ ...entry, keyObject });
  }
  const roleCount = (role) => records.filter((entry) => entry.role === role).length;
  if (roleCount(TRUST_ROLES.OWNER_DECISION) !== 1
    || roleCount(TRUST_ROLES.ENDPOINT_OBSERVER) !== 2
    || roleCount(TRUST_ROLES.INDEPENDENT_REVIEWER) !== 1) {
    violations.push("trustBinding.keys: exact role cardinality is 1 owner, 2 observers, 1 reviewer");
  }
  const expectedRoot = sha256Canonical(
    "IAT_B3_PRODUCTION_IDENTITY_AUTHORITY_EXTERNAL_TRUST_ROOT_V1",
    {
      schema: binding.schema,
      status: binding.status,
      keys: binding.keys,
      packetMaySelectTrustKeys: binding.packetMaySelectTrustKeys,
    },
  );
  if (binding.trustRootSha256 !== expectedRoot) {
    violations.push("trustBinding.trustRootSha256: external trust-root commitment mismatch");
  }
  if (violations.length > 0) return null;
  return new Map(records.map((entry) => [entry.keyId, entry]));
}

export function createProductionIdentityAuthorityTrustBinding(keys) {
  const sorted = structuredClone(keys).sort((left, right) => left.keyId.localeCompare(right.keyId));
  const core = {
    schema: PRODUCTION_IDENTITY_AUTHORITY_TRUST_SCHEMA,
    status: "CONFIGURED_EXTERNAL_TRUST_ROOT",
    keys: sorted,
    packetMaySelectTrustKeys: false,
  };
  return {
    ...core,
    trustRootSha256: sha256Canonical(
      "IAT_B3_PRODUCTION_IDENTITY_AUTHORITY_EXTERNAL_TRUST_ROOT_V1",
      core,
    ),
  };
}

export function productionIdentityAuthorityAttestationSigningBytes(unsignedAttestation) {
  const coreKeys = ATTESTATION_KEYS.filter((key) => key !== "signatureBase64url");
  const violations = [];
  if (!exactKeys(unsignedAttestation, coreKeys, "unsignedAttestation", violations)) {
    throw new TypeError(violations.join("; "));
  }
  return Buffer.concat([
    SIGNING_PREFIX,
    Buffer.from(canonicalizeRfc8785(unsignedAttestation), "utf8"),
  ]);
}

function validateAttestation(value, expected, trustKeys, path, violations) {
  if (!exactKeys(value, ATTESTATION_KEYS, path, violations)) return false;
  if (value.schema !== PRODUCTION_IDENTITY_AUTHORITY_ATTESTATION_SCHEMA) {
    violations.push(`${path}.schema: unsupported attestation schema`);
  }
  for (const [key, wanted] of Object.entries({
    kind: expected.kind,
    stage: expected.stage,
    subjectSha256: expected.subjectSha256,
    decision: expected.decision,
  })) {
    if (value[key] !== wanted) violations.push(`${path}.${key}: expected ${wanted}`);
  }
  const observedAt = canonicalU64(
    value.observedAtUnixSeconds,
    `${path}.observedAtUnixSeconds`,
    violations,
    { positive: true },
  );
  if (observedAt !== null && expected.evaluationUnixSeconds !== null) {
    if (observedAt > expected.evaluationUnixSeconds) {
      violations.push(`${path}.observedAtUnixSeconds: signed evidence is in the future relative to externally supplied evaluation time`);
    } else if (expected.liveEndpoint === true
      && expected.evaluationUnixSeconds - observedAt > MAX_LIVE_OBSERVATION_AGE_SECONDS) {
      violations.push(`${path}.observedAtUnixSeconds: live endpoint evidence is stale`);
    }
  }
  if (expected.endpointRequired) {
    canonicalDigest(value.endpointSha256, `${path}.endpointSha256`, violations);
  } else if (value.endpointSha256 !== null) {
    violations.push(`${path}.endpointSha256: owner/reviewer attestation must not select an endpoint`);
  }
  if (value.observationValue !== expected.observationValue) {
    violations.push(`${path}.observationValue: does not match the bound stage value`);
  }
  if (typeof value.keyId !== "string" || !KEY_ID.test(value.keyId)) {
    violations.push(`${path}.keyId: expected a canonical externally configured key ID`);
  }
  const record = trustKeys?.get(value.keyId);
  if (!record || record.role !== expected.role || !record.keyObject) {
    violations.push(`${path}.keyId: key is absent from the external ${expected.role} trust role`);
    return false;
  }
  const signature = decodedBase64url(value.signatureBase64url, 64, `${path}.signatureBase64url`, violations);
  if (!signature) return false;
  const unsigned = Object.fromEntries(ATTESTATION_KEYS
    .filter((key) => key !== "signatureBase64url")
    .map((key) => [key, value[key]]));
  let verified = false;
  try {
    verified = verifySignature(
      null,
      productionIdentityAuthorityAttestationSigningBytes(unsigned),
      record.keyObject,
      signature,
    );
  } catch {
    verified = false;
  }
  if (!verified) violations.push(`${path}.signatureBase64url: Ed25519 signature is invalid`);
  return verified;
}

function validateTwoEndpointObservations(observations, expected, trustKeys, path, violations) {
  if (!Array.isArray(observations) || observations.length !== 2) {
    violations.push(`${path}: expected exactly two independently signed endpoint observations`);
    return false;
  }
  const before = violations.length;
  for (let index = 0; index < observations.length; index += 1) {
    validateAttestation(
      observations[index],
      {
        ...expected,
        role: TRUST_ROLES.ENDPOINT_OBSERVER,
        endpointRequired: true,
        liveEndpoint: true,
      },
      trustKeys,
      `${path}[${index}]`,
      violations,
    );
  }
  if (observations[0]?.keyId === observations[1]?.keyId) {
    violations.push(`${path}: observer key IDs must be distinct`);
  }
  if (observations[0]?.endpointSha256 === observations[1]?.endpointSha256) {
    violations.push(`${path}: endpoint commitments must be distinct`);
  }
  const observedTimes = observations.map((entry) => (
    typeof entry?.observedAtUnixSeconds === "string" && U64_DECIMAL.test(entry.observedAtUnixSeconds)
      ? BigInt(entry.observedAtUnixSeconds)
      : null
  ));
  if (observedTimes.every((value) => value !== null)
    && (observedTimes[0] > observedTimes[1]
      ? observedTimes[0] - observedTimes[1]
      : observedTimes[1] - observedTimes[0]) > MAX_ENDPOINT_PAIR_SKEW_SECONDS) {
    violations.push(`${path}: endpoint observation timestamps exceed the bounded pair skew`);
  }
  return violations.length === before;
}

function validateIndependentReviewTiming(attestations, review, path, violations) {
  const prerequisiteTimes = attestations.map((entry) => (
    typeof entry?.observedAtUnixSeconds === "string" && U64_DECIMAL.test(entry.observedAtUnixSeconds)
      ? BigInt(entry.observedAtUnixSeconds)
      : null
  ));
  const reviewTime = typeof review?.observedAtUnixSeconds === "string"
    && U64_DECIMAL.test(review.observedAtUnixSeconds)
    ? BigInt(review.observedAtUnixSeconds)
    : null;
  if (reviewTime === null || prerequisiteTimes.some((value) => value === null)) return;
  const latestPrerequisite = prerequisiteTimes.reduce(
    (latest, value) => value > latest ? value : latest,
    0n,
  );
  if (reviewTime < latestPrerequisite) {
    violations.push(`${path}: independent review predates required signed evidence`);
  } else if (reviewTime - latestPrerequisite > MAX_INDEPENDENT_REVIEW_LAG_SECONDS) {
    violations.push(`${path}: independent review exceeds the bounded evidence-review interval`);
  }
}

function validateChoices(choices, phaseAComplete, violations) {
  if (!exactKeys(choices, CHOICE_KEYS, "productionChoices", violations)) return false;
  const required = phaseAComplete;
  let every = true;
  for (const key of CHOICE_KEYS) {
    every = validateProductionKey(
      choices[key],
      `productionChoices.${key}`,
      violations,
      { nullable: !required },
    ) && every;
  }
  if (!required && CHOICE_KEYS.some((key) => choices[key] !== null)) {
    violations.push("productionChoices: canonical PENDING packet must keep every owner-null identity/authority/funding choice null");
  }
  if (required) {
    const identityValues = [choices.lawProgramId, choices.economyProgramId, choices.canonicalMint];
    if (new Set(identityValues).size !== identityValues.length) {
      violations.push("productionChoices: law, economy, and canonical mint identities must be pairwise distinct");
    }
  }
  return every;
}

function validateSourceBindings(value, violations) {
  if (!exactKeys(value, Object.keys(PRODUCTION_IDENTITY_AUTHORITY_SOURCE_BINDINGS), "sourceBindings", violations)
    || !exactJson(value, PRODUCTION_IDENTITY_AUTHORITY_SOURCE_BINDINGS)) {
    violations.push("sourceBindings: exact owner policy, identity input, and reference-only COST bindings drifted");
  }
}

export function productionIdentityFreezeEvidenceSubjectSha256(manifest) {
  return sha256Canonical("IAT_B3_PRODUCTION_IDENTITY_FREEZE_EVIDENCE_SUBJECT_V1", {
    ownerPolicyFreeze: manifest.sourceBindings.ownerPolicyFreeze,
    identityInputFreeze: manifest.sourceBindings.identityInputFreeze,
    productionChoices: manifest.productionChoices,
    ownerDecisionPreimageSha256: manifest.phaseAProductionIdentityFreeze.ownerDecisionPreimageSha256,
  });
}

function validateProductionIdentityInput(manifest, options, violations, blockers) {
  if (manifest.profile === "TEST_FIXTURE" && options.allowTestFixture === true) return true;
  const identityBytes = options.identityInputBytes;
  const ownerPolicyBytes = options.ownerPolicyBytes;
  if (!Buffer.isBuffer(identityBytes) && typeof identityBytes !== "string") {
    blockers.push("phaseA: exact committed identity-input bytes were not supplied");
    return false;
  }
  if (!Buffer.isBuffer(ownerPolicyBytes) && typeof ownerPolicyBytes !== "string") {
    blockers.push("phaseA: exact committed owner-policy bytes were not supplied");
    return false;
  }
  const exactIdentityBytes = Buffer.isBuffer(identityBytes)
    ? identityBytes
    : Buffer.from(identityBytes, "utf8");
  const exactOwnerBytes = Buffer.isBuffer(ownerPolicyBytes)
    ? ownerPolicyBytes
    : Buffer.from(ownerPolicyBytes, "utf8");
  if (sha256Bytes(exactIdentityBytes) !== manifest.sourceBindings.identityInputFreeze.sha256) {
    violations.push("phaseA: supplied identity-input bytes do not match the exact source binding");
    return false;
  }
  if (sha256Bytes(exactOwnerBytes) !== manifest.sourceBindings.ownerPolicyFreeze.sha256) {
    violations.push("phaseA: supplied owner-policy bytes do not match the exact source binding");
    return false;
  }
  let identity;
  try {
    identity = parseIdentityFreezeJson(exactIdentityBytes.toString("utf8"), "identityInputBytes");
  } catch (error) {
    violations.push(`phaseA: strict identity-input parse failed (${error.message})`);
    return false;
  }
  const result = validateIdentityFreezeManifest(identity, { ownerPolicyBytes: exactOwnerBytes });
  for (const violation of result.violations) violations.push(`phaseA.identityInput: ${violation}`);
  if (result.productionIdentityReady !== true) {
    blockers.push("phaseA: source-bound production identity input remains BLOCKED");
    return false;
  }
  for (const key of ["lawProgramId", "economyProgramId", "canonicalMint"]) {
    if (identity.identities?.[key] !== manifest.productionChoices[key]) {
      violations.push(`phaseA: productionChoices.${key} does not match the source-bound identity input`);
    }
  }
  if (identity.networkBinding?.genesisHash !== manifest.productionChoices.mainnetGenesisHash) {
    violations.push("phaseA: mainnetGenesisHash does not match the source-bound identity input");
  }
  return result.productionIdentityReady === true;
}

function validatePendingAttestation(value, path, violations) {
  if (value !== null) violations.push(`${path}: PENDING stage requires null`);
}

function validatePhaseA(manifest, options, trustKeys, evaluationUnixSeconds, violations, blockers) {
  const phaseStart = violations.length;
  const phase = manifest.phaseAProductionIdentityFreeze;
  const keys = [
    "status",
    "subjectSha256",
    "ownerDecisionPreimageSha256",
    "ownerAcceptance",
    "mainnetGenesisObservations",
    "independentReview",
    "blocker",
  ];
  if (!exactKeys(phase, keys, "phaseAProductionIdentityFreeze", violations)) return false;
  if (phase.status === "PENDING") {
    validatePendingAttestation(phase.subjectSha256, "phaseAProductionIdentityFreeze.subjectSha256", violations);
    validatePendingAttestation(phase.ownerDecisionPreimageSha256, "phaseAProductionIdentityFreeze.ownerDecisionPreimageSha256", violations);
    validatePendingAttestation(phase.ownerAcceptance, "phaseAProductionIdentityFreeze.ownerAcceptance", violations);
    validatePendingAttestation(phase.independentReview, "phaseAProductionIdentityFreeze.independentReview", violations);
    if (!Array.isArray(phase.mainnetGenesisObservations) || phase.mainnetGenesisObservations.length !== 0) {
      violations.push("phaseAProductionIdentityFreeze.mainnetGenesisObservations: PENDING requires empty array");
    }
    if (typeof phase.blocker !== "string" || phase.blocker.length < 24) {
      violations.push("phaseAProductionIdentityFreeze.blocker: PENDING requires a specific blocker");
    } else blockers.push(`phaseA: ${phase.blocker}`);
    return false;
  }
  if (phase.status !== "EVIDENCE_COMPLETE") {
    violations.push("phaseAProductionIdentityFreeze.status: expected PENDING or EVIDENCE_COMPLETE");
    return false;
  }
  if (phase.blocker !== null) violations.push("phaseAProductionIdentityFreeze.blocker: complete requires null");
  canonicalDigest(phase.ownerDecisionPreimageSha256, "phaseAProductionIdentityFreeze.ownerDecisionPreimageSha256", violations);
  const subject = productionIdentityFreezeEvidenceSubjectSha256(manifest);
  if (phase.subjectSha256 !== subject) {
    violations.push("phaseAProductionIdentityFreeze.subjectSha256: identity/authority subject commitment mismatch");
  }
  validateAttestation(phase.ownerAcceptance, {
    kind: "OWNER_IDENTITY_DECISION_ACCEPTANCE",
    stage: "A",
    subjectSha256: subject,
    observationValue: phase.ownerDecisionPreimageSha256,
    decision: "ACCEPT",
    role: TRUST_ROLES.OWNER_DECISION,
    endpointRequired: false,
    evaluationUnixSeconds,
  }, trustKeys, "phaseAProductionIdentityFreeze.ownerAcceptance", violations);
  validateTwoEndpointObservations(phase.mainnetGenesisObservations, {
    kind: "MAINNET_GENESIS_OBSERVATION",
    stage: "A",
    subjectSha256: subject,
    observationValue: manifest.productionChoices.mainnetGenesisHash,
    decision: "MATCHED",
    evaluationUnixSeconds,
  }, trustKeys, "phaseAProductionIdentityFreeze.mainnetGenesisObservations", violations);
  validateAttestation(phase.independentReview, {
    kind: "INDEPENDENT_IDENTITY_REVIEW",
    stage: "A",
    subjectSha256: subject,
    observationValue: subject,
    decision: "ACCEPT",
    role: TRUST_ROLES.INDEPENDENT_REVIEWER,
    endpointRequired: false,
    evaluationUnixSeconds,
  }, trustKeys, "phaseAProductionIdentityFreeze.independentReview", violations);
  validateIndependentReviewTiming(
    [phase.ownerAcceptance, ...(Array.isArray(phase.mainnetGenesisObservations)
      ? phase.mainnetGenesisObservations
      : [])],
    phase.independentReview,
    "phaseAProductionIdentityFreeze.independentReview",
    violations,
  );
  const inputReady = validateProductionIdentityInput(manifest, options, violations, blockers);
  return violations.length === phaseStart && inputReady;
}

function validateBinary(value, role, expectedProgramId, complete, path, violations) {
  if (!exactKeys(value, BINARY_KEYS, path, violations)) return false;
  if (!complete) {
    if (BINARY_KEYS.some((key) => value[key] !== null)) {
      violations.push(`${path}: PENDING binary binding must be entirely null`);
    }
    return false;
  }
  if (value.programId !== expectedProgramId) violations.push(`${path}.programId: ${role} program identity mismatch`);
  canonicalDigest(value.sha256, `${path}.sha256`, violations);
  canonicalDigest(value.sourceHeadSha256, `${path}.sourceHeadSha256`, violations);
  if (!Number.isSafeInteger(value.byteLength) || value.byteLength < 1 || value.byteLength > 10_000_000) {
    violations.push(`${path}.byteLength: expected a positive bounded exact byte length`);
  }
  return true;
}

export function ceremonyFundingEvidenceSubjectSha256(manifest) {
  const phase = manifest.phaseBCeremonyFunding;
  return sha256Canonical("IAT_B3_COST_CEREMONY_FUNDING_EVIDENCE_SUBJECT_V1", {
    phaseASubjectSha256: manifest.phaseAProductionIdentityFreeze.subjectSha256,
    costFeasibilityReference: manifest.sourceBindings.costFeasibilityReference,
    payerPublicKey: manifest.productionChoices.payerPublicKey,
    finalBinaries: phase.finalBinaries,
    freshCostMeasurementSha256: phase.freshCostMeasurementSha256,
    fundingSourceApprovalSha256: phase.fundingSourceApprovalSha256,
    ceremonyFloorPolicySha256: phase.ceremonyFloorPolicySha256,
    bufferRecoveryPlanSha256: phase.bufferRecoveryPlanSha256,
    ceremonyFloorLamports: phase.ceremonyFloorLamports,
    aggregateFreshPayerPeakLamports: phase.aggregateFreshPayerPeakLamports,
    aggregatePermanentRentLamports: phase.aggregatePermanentRentLamports,
    aggregateRecoverableBufferLamports: phase.aggregateRecoverableBufferLamports,
    aggregateFeeBudgetLamports: phase.aggregateFeeBudgetLamports,
    expiresAtUnixSeconds: phase.expiresAtUnixSeconds,
  });
}

function validatePhaseB(manifest, phaseAComplete, trustKeys, evaluationUnixSeconds, violations, blockers) {
  const phaseStart = violations.length;
  const phase = manifest.phaseBCeremonyFunding;
  const keys = [
    "status",
    "subjectSha256",
    "finalBinaries",
    "freshCostMeasurementSha256",
    "fundingSourceApprovalSha256",
    "ceremonyFloorPolicySha256",
    "bufferRecoveryPlanSha256",
    "ceremonyFloorLamports",
    "aggregateFreshPayerPeakLamports",
    "aggregatePermanentRentLamports",
    "aggregateRecoverableBufferLamports",
    "aggregateFeeBudgetLamports",
    "expiresAtUnixSeconds",
    "fundingApproval",
    "payerBalanceObservations",
    "independentReview",
    "blocker",
  ];
  if (!exactKeys(phase, keys, "phaseBCeremonyFunding", violations)) return false;
  if (!exactKeys(phase.finalBinaries, ["law", "economy"], "phaseBCeremonyFunding.finalBinaries", violations)) return false;
  const complete = phase.status === "EVIDENCE_COMPLETE";
  validateBinary(phase.finalBinaries.law, "law", manifest.productionChoices.lawProgramId, complete, "phaseBCeremonyFunding.finalBinaries.law", violations);
  validateBinary(phase.finalBinaries.economy, "economy", manifest.productionChoices.economyProgramId, complete, "phaseBCeremonyFunding.finalBinaries.economy", violations);
  if (phase.status === "PENDING") {
    for (const key of keys.filter((key) => !["status", "finalBinaries", "payerBalanceObservations", "blocker"].includes(key))) {
      validatePendingAttestation(phase[key], `phaseBCeremonyFunding.${key}`, violations);
    }
    if (!Array.isArray(phase.payerBalanceObservations) || phase.payerBalanceObservations.length !== 0) {
      violations.push("phaseBCeremonyFunding.payerBalanceObservations: PENDING requires empty array");
    }
    if (typeof phase.blocker !== "string" || phase.blocker.length < 24) {
      violations.push("phaseBCeremonyFunding.blocker: PENDING requires a specific blocker");
    } else blockers.push(`phaseB: ${phase.blocker}`);
    return false;
  }
  if (!complete) {
    violations.push("phaseBCeremonyFunding.status: expected PENDING or EVIDENCE_COMPLETE");
    return false;
  }
  if (!phaseAComplete) violations.push("phaseBCeremonyFunding.status: phase A must complete first");
  if (phase.blocker !== null) violations.push("phaseBCeremonyFunding.blocker: complete requires null");
  for (const key of [
    "freshCostMeasurementSha256",
    "fundingSourceApprovalSha256",
    "ceremonyFloorPolicySha256",
    "bufferRecoveryPlanSha256",
  ]) canonicalDigest(phase[key], `phaseBCeremonyFunding.${key}`, violations);
  const floor = canonicalU64(phase.ceremonyFloorLamports, "phaseBCeremonyFunding.ceremonyFloorLamports", violations, { positive: true });
  const peak = canonicalU64(phase.aggregateFreshPayerPeakLamports, "phaseBCeremonyFunding.aggregateFreshPayerPeakLamports", violations, { positive: true });
  const permanent = canonicalU64(phase.aggregatePermanentRentLamports, "phaseBCeremonyFunding.aggregatePermanentRentLamports", violations, { positive: true });
  const recoverable = canonicalU64(phase.aggregateRecoverableBufferLamports, "phaseBCeremonyFunding.aggregateRecoverableBufferLamports", violations);
  const fees = canonicalU64(phase.aggregateFeeBudgetLamports, "phaseBCeremonyFunding.aggregateFeeBudgetLamports", violations, { positive: true });
  const expiresAt = canonicalU64(
    phase.expiresAtUnixSeconds,
    "phaseBCeremonyFunding.expiresAtUnixSeconds",
    violations,
    { positive: true },
  );
  if (peak !== null && peak > COST_CEILING_LAMPORTS) {
    violations.push("phaseBCeremonyFunding.aggregateFreshPayerPeakLamports: exceeds frozen 3 SOL aggregate ceiling");
  }
  if (peak !== null && permanent !== null && recoverable !== null && permanent + recoverable > peak) {
    violations.push("phaseBCeremonyFunding: permanent rent plus recoverable buffer exceeds fresh-payer peak");
  }
  if (floor !== null && peak !== null && fees !== null && floor < peak + fees) {
    violations.push("phaseBCeremonyFunding.ceremonyFloorLamports: does not cover exact peak plus fee budget");
  }
  const subject = ceremonyFundingEvidenceSubjectSha256(manifest);
  if (phase.subjectSha256 !== subject) violations.push("phaseBCeremonyFunding.subjectSha256: cost/funding subject commitment mismatch");
  validateAttestation(phase.fundingApproval, {
    kind: "OWNER_FUNDING_SOURCE_ACCEPTANCE",
    stage: "B",
    subjectSha256: subject,
    observationValue: phase.fundingSourceApprovalSha256,
    decision: "ACCEPT",
    role: TRUST_ROLES.OWNER_DECISION,
    endpointRequired: false,
    evaluationUnixSeconds,
  }, trustKeys, "phaseBCeremonyFunding.fundingApproval", violations);
  if (Array.isArray(phase.payerBalanceObservations)) {
    for (let index = 0; index < phase.payerBalanceObservations.length; index += 1) {
      const balance = canonicalU64(
        phase.payerBalanceObservations[index]?.observationValue,
        `phaseBCeremonyFunding.payerBalanceObservations[${index}].observationValue`,
        violations,
        { positive: true },
      );
      if (balance !== null && floor !== null && balance < floor) {
        violations.push(`phaseBCeremonyFunding.payerBalanceObservations[${index}]: observed balance is below ceremony floor`);
      }
    }
  }
  if (!Array.isArray(phase.payerBalanceObservations) || phase.payerBalanceObservations.length !== 2) {
    violations.push("phaseBCeremonyFunding.payerBalanceObservations: expected exactly two endpoint observations");
  } else {
    for (let index = 0; index < 2; index += 1) {
      validateAttestation(phase.payerBalanceObservations[index], {
        kind: "PAYER_BALANCE_OBSERVATION",
        stage: "B",
        subjectSha256: subject,
        observationValue: phase.payerBalanceObservations[index].observationValue,
        decision: "MATCHED",
        role: TRUST_ROLES.ENDPOINT_OBSERVER,
        endpointRequired: true,
        liveEndpoint: true,
        evaluationUnixSeconds,
      }, trustKeys, `phaseBCeremonyFunding.payerBalanceObservations[${index}]`, violations);
    }
    if (phase.payerBalanceObservations[0].keyId === phase.payerBalanceObservations[1].keyId
      || phase.payerBalanceObservations[0].endpointSha256 === phase.payerBalanceObservations[1].endpointSha256) {
      violations.push("phaseBCeremonyFunding.payerBalanceObservations: observer keys and endpoints must both be distinct");
    }
    const payerObservationTimes = phase.payerBalanceObservations.map((entry) => (
      typeof entry?.observedAtUnixSeconds === "string" && U64_DECIMAL.test(entry.observedAtUnixSeconds)
        ? BigInt(entry.observedAtUnixSeconds)
        : null
    ));
    if (payerObservationTimes.every((value) => value !== null)
      && (payerObservationTimes[0] > payerObservationTimes[1]
        ? payerObservationTimes[0] - payerObservationTimes[1]
        : payerObservationTimes[1] - payerObservationTimes[0]) > MAX_ENDPOINT_PAIR_SKEW_SECONDS) {
      violations.push("phaseBCeremonyFunding.payerBalanceObservations: endpoint observation timestamps exceed the bounded pair skew");
    }
  }
  validateAttestation(phase.independentReview, {
    kind: "INDEPENDENT_FUNDING_REVIEW",
    stage: "B",
    subjectSha256: subject,
    observationValue: subject,
    decision: "ACCEPT",
    role: TRUST_ROLES.INDEPENDENT_REVIEWER,
    endpointRequired: false,
    evaluationUnixSeconds,
  }, trustKeys, "phaseBCeremonyFunding.independentReview", violations);
  validateIndependentReviewTiming(
    [phase.fundingApproval, ...(Array.isArray(phase.payerBalanceObservations)
      ? phase.payerBalanceObservations
      : [])],
    phase.independentReview,
    "phaseBCeremonyFunding.independentReview",
    violations,
  );
  const payerTimes = Array.isArray(phase.payerBalanceObservations)
    ? phase.payerBalanceObservations.map((entry) => (
      typeof entry?.observedAtUnixSeconds === "string" && U64_DECIMAL.test(entry.observedAtUnixSeconds)
        ? BigInt(entry.observedAtUnixSeconds)
        : null
    ))
    : [];
  const reviewTime = typeof phase.independentReview?.observedAtUnixSeconds === "string"
    && U64_DECIMAL.test(phase.independentReview.observedAtUnixSeconds)
    ? BigInt(phase.independentReview.observedAtUnixSeconds)
    : null;
  if (expiresAt !== null) {
    if (evaluationUnixSeconds !== null && evaluationUnixSeconds > expiresAt) {
      violations.push("phaseBCeremonyFunding.expiresAtUnixSeconds: funding evidence has expired at externally supplied evaluation time");
    }
    if (reviewTime !== null && reviewTime > expiresAt) {
      violations.push("phaseBCeremonyFunding.expiresAtUnixSeconds: independent acceptance is after expiry");
    }
    if (payerTimes.length === 2 && payerTimes.every((value) => value !== null)) {
      const latestPayer = payerTimes[0] > payerTimes[1] ? payerTimes[0] : payerTimes[1];
      if (expiresAt < latestPayer
        || expiresAt - latestPayer > MAX_FUNDING_EVIDENCE_LIFETIME_SECONDS) {
        violations.push("phaseBCeremonyFunding.expiresAtUnixSeconds: expected a bounded post-observation funding evidence lifetime");
      }
    }
  }
  return violations.length === phaseStart;
}

function terminalStateCore(state) {
  return Object.fromEntries(TERMINAL_STATE_KEYS
    .filter((key) => key !== "stateSha256")
    .map((key) => [key, state[key]]));
}

export function deployedSealEvidenceSubjectSha256(manifest) {
  const phase = manifest.phaseCDeployedSeal;
  return sha256Canonical("IAT_B3_DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE_SUBJECT_V1", {
    phaseBSubjectSha256: manifest.phaseBCeremonyFunding.subjectSha256,
    sealOrder: EXPECTED_SEAL_ORDER,
    journal: phase.journal,
    terminalState: phase.terminalState,
  });
}

function validatePhaseC(manifest, phaseBComplete, trustKeys, evaluationUnixSeconds, violations, blockers) {
  const phaseStart = violations.length;
  const phase = manifest.phaseCDeployedSeal;
  const keys = [
    "status",
    "subjectSha256",
    "journal",
    "terminalState",
    "terminalEndpointObservations",
    "independentReview",
    "blocker",
  ];
  if (!exactKeys(phase, keys, "phaseCDeployedSeal", violations)) return false;
  const complete = phase.status === "EVIDENCE_COMPLETE";
  if (!Array.isArray(phase.journal) || phase.journal.length !== EXPECTED_SEAL_ORDER.length) {
    violations.push(`phaseCDeployedSeal.journal: expected exact ${EXPECTED_SEAL_ORDER.length}-stage order`);
  } else {
    const evidenceDigests = new Set();
    for (let index = 0; index < EXPECTED_SEAL_ORDER.length; index += 1) {
      const entry = phase.journal[index];
      const path = `phaseCDeployedSeal.journal[${index}]`;
      if (!exactKeys(entry, JOURNAL_KEYS, path, violations)) continue;
      if (entry.ordinal !== index + 1 || entry.step !== EXPECTED_SEAL_ORDER[index]) {
        violations.push(`${path}: exact ordered ceremony stage drifted`);
      }
      if (complete) {
        if (entry.status !== "FINALIZED_MATCHED") violations.push(`${path}.status: complete seal requires FINALIZED_MATCHED`);
        const evidenceSha256 = canonicalDigest(entry.evidenceSha256, `${path}.evidenceSha256`, violations);
        if (evidenceSha256 !== null) {
          if (evidenceDigests.has(evidenceSha256)) {
            violations.push(`${path}.evidenceSha256: every finalized ceremony stage requires distinct evidence`);
          }
          evidenceDigests.add(evidenceSha256);
        }
      } else if (entry.status !== "PENDING" || entry.evidenceSha256 !== null) {
        violations.push(`${path}: PENDING packet requires PENDING/null journal evidence`);
      }
    }
  }
  if (!exactKeys(phase.terminalState, TERMINAL_STATE_KEYS, "phaseCDeployedSeal.terminalState", violations)) return false;
  if (phase.status === "PENDING") {
    if (phase.subjectSha256 !== null || phase.independentReview !== null) {
      violations.push("phaseCDeployedSeal: PENDING requires null subject and review");
    }
    if (!Array.isArray(phase.terminalEndpointObservations) || phase.terminalEndpointObservations.length !== 0) {
      violations.push("phaseCDeployedSeal.terminalEndpointObservations: PENDING requires empty array");
    }
    if (TERMINAL_STATE_KEYS.some((key) => phase.terminalState[key] !== null)) {
      violations.push("phaseCDeployedSeal.terminalState: PENDING requires every field null");
    }
    if (typeof phase.blocker !== "string" || phase.blocker.length < 24) {
      violations.push("phaseCDeployedSeal.blocker: PENDING requires a specific blocker");
    } else blockers.push(`phaseC: ${phase.blocker}`);
    return false;
  }
  if (!complete) {
    violations.push("phaseCDeployedSeal.status: expected PENDING or EVIDENCE_COMPLETE");
    return false;
  }
  if (!phaseBComplete) violations.push("phaseCDeployedSeal.status: phase B must complete first");
  if (phase.blocker !== null) violations.push("phaseCDeployedSeal.blocker: complete requires null");
  const expectedTerminal = {
    lawProgramId: manifest.productionChoices.lawProgramId,
    economyProgramId: manifest.productionChoices.economyProgramId,
    canonicalMint: manifest.productionChoices.canonicalMint,
    lawBinarySha256: manifest.phaseBCeremonyFunding.finalBinaries.law.sha256,
    economyBinarySha256: manifest.phaseBCeremonyFunding.finalBinaries.economy.sha256,
    lawUpgradeAuthority: null,
    economyUpgradeAuthority: null,
    mintAuthority: null,
    freezeAuthority: null,
    transferHookAuthority: null,
    confidentialTransferMintAuthority: null,
    active: true,
    genesisStagingWritesDisabled: true,
  };
  for (const [key, expected] of Object.entries(expectedTerminal)) {
    if (phase.terminalState[key] !== expected) {
      violations.push(`phaseCDeployedSeal.terminalState.${key}: terminal identity/authority state mismatch`);
    }
  }
  const stateSha256 = productionIdentityAuthorityTerminalStateSha256(
    phase.terminalState,
  );
  if (phase.terminalState.stateSha256 !== stateSha256) {
    violations.push("phaseCDeployedSeal.terminalState.stateSha256: terminal state commitment mismatch");
  }
  const subject = deployedSealEvidenceSubjectSha256(manifest);
  if (phase.subjectSha256 !== subject) violations.push("phaseCDeployedSeal.subjectSha256: journal/terminal-state subject mismatch");
  validateTwoEndpointObservations(phase.terminalEndpointObservations, {
    kind: "TERMINAL_AUTHORITY_STATE_OBSERVATION",
    stage: "C",
    subjectSha256: subject,
    observationValue: stateSha256,
    decision: "MATCHED",
    evaluationUnixSeconds,
  }, trustKeys, "phaseCDeployedSeal.terminalEndpointObservations", violations);
  validateAttestation(phase.independentReview, {
    kind: "INDEPENDENT_DEPLOYED_SEAL_REVIEW",
    stage: "C",
    subjectSha256: subject,
    observationValue: subject,
    decision: "ACCEPT",
    role: TRUST_ROLES.INDEPENDENT_REVIEWER,
    endpointRequired: false,
    evaluationUnixSeconds,
  }, trustKeys, "phaseCDeployedSeal.independentReview", violations);
  validateIndependentReviewTiming(
    Array.isArray(phase.terminalEndpointObservations)
      ? phase.terminalEndpointObservations
      : [],
    phase.independentReview,
    "phaseCDeployedSeal.independentReview",
    violations,
  );
  return violations.length === phaseStart;
}

export function productionIdentityAuthorityTerminalStateSha256(terminalState) {
  return sha256Canonical(
    "IAT_B3_DEPLOYED_IDENTITY_AUTHORITY_TERMINAL_STATE_V1",
    terminalStateCore(terminalState),
  );
}

function validateAuthorizationBoundary(value, violations) {
  const expected = {
    signingAuthorized: false,
    deploymentAuthorized: false,
    fundingSpendAuthorized: false,
    activationAuthorized: false,
    independentGate8Accepted: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: PRODUCTION_IDENTITY_AUTHORITY_MAINNET_STATUS,
  };
  if (!exactKeys(value, Object.keys(expected), "authorizationBoundary", violations)
    || !exactJson(value, expected)) {
    violations.push("authorizationBoundary: every execution/authorization flag must remain false and HOLD");
  }
}

function resultSurface(manifest, phaseAComplete, phaseBComplete, phaseCComplete, trustConfigured, blockers, violations) {
  const production = manifest?.profile === "PRODUCTION";
  return {
    valid: violations.length === 0,
    profile: typeof manifest?.profile === "string" ? manifest.profile : null,
    externalTrustConfigured: trustConfigured,
    phaseAProductionIdentityFreezeComplete: phaseAComplete,
    phaseBCeremonyFundingComplete: phaseBComplete,
    phaseCDeployedIdentityAuthoritySealComplete: phaseCComplete,
    productionIdentityFreezeEvidenceComplete: production && phaseAComplete,
    ceremonyFundingEvidenceComplete: production && phaseAComplete && phaseBComplete,
    deployedIdentityAuthoritySealEvidenceComplete:
      production && phaseAComplete && phaseBComplete && phaseCComplete,
    signingAuthorized: false,
    deploymentAuthorized: false,
    fundingSpendAuthorized: false,
    activationAuthorized: false,
    independentGate8Accepted: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: PRODUCTION_IDENTITY_AUTHORITY_MAINNET_STATUS,
    blockers: Object.freeze([...blockers]),
    violations: Object.freeze([...violations]),
  };
}

export function validateProductionIdentityAuthorityEvidenceManifest(manifest, options = {}) {
  const violations = [];
  const blockers = [];
  const safe = safeCanonicalClone(manifest, violations);
  if (!safe || !exactKeys(safe, TOP_LEVEL_KEYS, "manifest", violations)) {
    return resultSurface(safe, false, false, false, false, blockers, violations);
  }
  if (safe.$schema !== "./iat-b3-production-identity-authority-evidence.v1.schema.json") {
    violations.push("manifest.$schema: unexpected schema path");
  }
  if (safe.schema !== PRODUCTION_IDENTITY_AUTHORITY_EVIDENCE_SCHEMA) {
    violations.push("manifest.schema: unsupported schema");
  }
  if (safe.profile !== "PRODUCTION" && safe.profile !== "TEST_FIXTURE") {
    violations.push("manifest.profile: expected PRODUCTION or TEST_FIXTURE");
  }
  if (safe.profile === "TEST_FIXTURE" && options.allowTestFixture !== true) {
    violations.push("manifest.profile: TEST_FIXTURE requires explicit allowTestFixture and never satisfies production predicates");
  }
  if (!exactJson(safe.scope, PRODUCTION_IDENTITY_AUTHORITY_SCOPE)) {
    violations.push("manifest.scope: nonactivating staged evidence boundary drifted");
  }
  validateSourceBindings(safe.sourceBindings, violations);
  validateAuthorizationBoundary(safe.authorizationBoundary, violations);

  const phaseADeclaredComplete = safe.phaseAProductionIdentityFreeze?.status === "EVIDENCE_COMPLETE";
  const anyPhaseDeclaredComplete = phaseADeclaredComplete
    || safe.phaseBCeremonyFunding?.status === "EVIDENCE_COMPLETE"
    || safe.phaseCDeployedSeal?.status === "EVIDENCE_COMPLETE";
  let evaluationUnixSeconds = null;
  if (anyPhaseDeclaredComplete) {
    if (options.evaluationUnixSeconds === undefined) {
      violations.push("evaluationUnixSeconds: completed evidence requires externally supplied trusted evaluation time");
    } else {
      evaluationUnixSeconds = canonicalU64(
        options.evaluationUnixSeconds,
        "evaluationUnixSeconds",
        violations,
        { positive: true },
      );
    }
  }
  validateChoices(safe.productionChoices, phaseADeclaredComplete, violations);
  const trustBinding = options.trustBinding ?? EMPTY_PRODUCTION_IDENTITY_AUTHORITY_TRUST_BINDING;
  const trustViolationStart = violations.length;
  const trustKeys = validateExternalTrustBinding(trustBinding, violations, blockers);
  const trustConfigured = trustKeys !== null && violations.length === trustViolationStart;

  const phaseAComplete = validatePhaseA(
    safe,
    options,
    trustKeys,
    evaluationUnixSeconds,
    violations,
    blockers,
  );
  const phaseBComplete = validatePhaseB(
    safe,
    phaseAComplete,
    trustKeys,
    evaluationUnixSeconds,
    violations,
    blockers,
  );
  const phaseCComplete = validatePhaseC(
    safe,
    phaseBComplete,
    trustKeys,
    evaluationUnixSeconds,
    violations,
    blockers,
  );
  const allComplete = phaseAComplete && phaseBComplete && phaseCComplete;
  if (safe.status === "PENDING") {
    if (allComplete) violations.push("manifest.status: PENDING contradicts all three complete evidence stages");
  } else if (safe.status === "EVIDENCE_COMPLETE") {
    if (!allComplete) violations.push("manifest.status: EVIDENCE_COMPLETE requires stages A, B, and C");
  } else violations.push("manifest.status: expected PENDING or EVIDENCE_COMPLETE");

  return resultSurface(
    safe,
    phaseAComplete && violations.length === 0,
    phaseBComplete && violations.length === 0,
    phaseCComplete && violations.length === 0,
    trustConfigured,
    blockers,
    violations,
  );
}

export function parseProductionIdentityAuthorityEvidenceJson(text, label = "manifest") {
  return parseB3OwnerPolicyFreezeJson(text, label);
}

export function loadProductionIdentityAuthorityEvidenceManifest(path = DEFAULT_MANIFEST_PATH) {
  const resolved = resolve(path);
  return parseProductionIdentityAuthorityEvidenceJson(readFileSync(resolved, "utf8"), resolved);
}

function main() {
  const args = process.argv.slice(2);
  let path = DEFAULT_MANIFEST_PATH;
  let requireComplete = false;
  for (const argument of args) {
    if (argument === "--require-evidence-complete") requireComplete = true;
    else if (path === DEFAULT_MANIFEST_PATH) path = resolve(argument);
    else {
      console.error(`unknown argument: ${argument}`);
      process.exitCode = 1;
      return;
    }
  }
  try {
    const manifest = loadProductionIdentityAuthorityEvidenceManifest(path);
    const result = validateProductionIdentityAuthorityEvidenceManifest(manifest);
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
    else if (requireComplete && !result.deployedIdentityAuthoritySealEvidenceComplete) process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();

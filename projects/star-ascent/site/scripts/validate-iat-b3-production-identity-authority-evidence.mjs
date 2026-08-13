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
  "iat-b3-production-identity-authority-evidence/v3";
export const PRODUCTION_IDENTITY_AUTHORITY_AUTOMATED_EVIDENCE_SCHEMA =
  "iat-b3-production-identity-authority-automated-evidence-binding/v3";
export const PRODUCTION_IDENTITY_AUTHORITY_RECEIPT_SCHEMA =
  "iat-b3-production-identity-authority-automated-receipt/v3";
export const PRODUCTION_IDENTITY_AUTHORITY_OWNER_DECISION_RECEIPT_SCHEMA =
  "iat-b3-production-identity-authority-owner-decision-ocms-receipt/v1";
export const PRODUCTION_IDENTITY_AUTHORITY_MODEL_T_OBSERVATION_SCHEMA =
  "iat-b3-production-identity-authority-model-t-capability-observation/v1";
export const PRODUCTION_IDENTITY_AUTHORITY_MAINNET_STATUS = "HOLD";

export const PRODUCTION_IDENTITY_AUTHORITY_SOURCE_BINDINGS = Object.freeze({
  ownerPolicyFreeze: Object.freeze({
    path: "projects/star-ascent/site/docs/b3/iat-b3-owner-policy-freeze.v1.json",
    sha256: "95c508a47f9ccfed8d466851196cf4de0928027bebccc35b5842fb2c77449f06",
    bindingScope: "EXACT_COMMITTED_INPUT_ONLY",
  }),
  identityInputFreeze: Object.freeze({
    path: "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json",
    sha256: "17bcf00f97c5fd95bc39fa9eff120fd7f7678ed77f9bc333c36189f44633cacf",
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
    "PACKET_SELECTED_AUTOMATED_EVIDENCE_SOURCES",
    "LIVE_RPC_OR_CHAIN_TRUTH_WITHOUT_TWO_SOURCE_BOUND_ENDPOINT_RECEIPTS",
    "FINAL_BINARY_TRUTH_WITHOUT_EXACT_BINDINGS",
    "OWNER_DECISION_OR_AUTOMATED_CLOSURE_TRUTH_WITHOUT_EXTERNAL_SOURCE_CONFIGURATION",
    "MODEL_T_SOLANA_OCMS_CAPABILITY_WITHOUT_SEPARATE_SOURCE_BOUND_DEVICE_OBSERVATION",
    "MODEL_T_HARDWARE_PROVENANCE_FROM_ED25519_SIGNATURE_BYTES_ALONE",
    "TRANSACTION_SIGNING_DEPLOYMENT_FUNDING_OR_ACTIVATION_AUTHORITY",
    "AUTOMATED_GATE_8_EVIDENCE_COMPLETION",
    "RELEASE_OR_MAINNET_EXECUTION_AUTHORIZATION",
  ]),
});

export const EMPTY_PRODUCTION_IDENTITY_AUTHORITY_AUTOMATED_EVIDENCE_BINDING = Object.freeze({
  schema: PRODUCTION_IDENTITY_AUTHORITY_AUTOMATED_EVIDENCE_SCHEMA,
  status: "AUTOMATED_EVIDENCE_SOURCES_UNCONFIGURED",
  sources: Object.freeze([]),
  modelTDeviceObservationReceipt: null,
  sourceSetSha256: null,
  packetMaySelectEvidenceSources: false,
  noSelfAttestation: true,
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
const AUTOMATED_RECEIPT_SIGNING_PREFIX = Buffer.from(
  "IAT_B3_PRODUCTION_IDENTITY_AUTHORITY_AUTOMATED_RECEIPT_V3\0",
  "utf8",
);
const MODEL_T_OBSERVATION_SIGNING_PREFIX = Buffer.from(
  "IAT_B3_PRODUCTION_IDENTITY_AUTHORITY_MODEL_T_CAPABILITY_OBSERVATION_V1\0",
  "utf8",
);
const OCMS_PREFIX = Buffer.concat([
  Buffer.from([0xff]),
  Buffer.from("solana offchain", "ascii"),
]);
const OCMS_V0_APPLICATION_DOMAIN = createHash("sha256")
  .update("internal.agency/iat-b3/production-identity-authority", "utf8")
  .digest();
const OWNER_DECISION_DOMAIN =
  "IAT_B3_PRODUCTION_IDENTITY_AUTHORITY_OWNER_DECISION_OCMS_V1";
const RAW_ED25519_SCHEME = "RAW_ED25519_SOURCE_BOUND_RECEIPT_V3";
const MODEL_T_OCMS_SCHEME = "TREZOR_MODEL_T_SOLANA_OCMS";
const MODEL_T_DEVICE = "Trezor Model T";
const MODEL_T_CAPABILITY_PREDICATE = "MODEL_T_SOLANA_OCMS_CAPABILITY_OBSERVED";
const PRODUCTION_DEVICE_OBSERVATION_CLASS = "PRODUCTION_SOURCE_BOUND_DEVICE_OBSERVATION";
const TEST_DEVICE_OBSERVATION_CLASS = "SYNTHETIC_SOFTWARE_TEST_FIXTURE";
const MAX_U64 = (1n << 64n) - 1n;
const COST_CEILING_LAMPORTS = 3_000_000_000n;
const MAX_LIVE_OBSERVATION_AGE_SECONDS = 900n;
const MAX_ENDPOINT_PAIR_SKEW_SECONDS = 120n;
const MAX_AUTOMATED_CLOSURE_LAG_SECONDS = 300n;
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
  "modelTCapabilityBoundary",
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
const RECEIPT_CORE_KEYS = Object.freeze([
  "schema",
  "kind",
  "stage",
  "sourceId",
  "observedAtUnixSeconds",
  "endpointSha256",
  "subjectSha256",
  "observationValue",
  "decision",
]);
const AUTOMATED_RECEIPT_KEYS = Object.freeze([
  ...RECEIPT_CORE_KEYS,
  "signatureBase64url",
]);
const OWNER_RECEIPT_KEYS = Object.freeze([
  ...RECEIPT_CORE_KEYS,
  "signatureScheme",
  "ocmsVersion",
  "signerDerivationPath",
  "signerSolanaPublicKey",
  "capabilityObservationSha256",
  "ocmsApplicationDomainBase64url",
  "decisionPayloadBase64url",
  "decisionPayloadSha256",
  "ocmsMessageBase64url",
  "ocmsMessageSha256",
  "ocmsEnvelopeBase64url",
  "ocmsEnvelopeSha256",
  "signatureBase64url",
]);
const MODEL_T_OBSERVATION_KEYS = Object.freeze([
  "schema",
  "sourceId",
  "observedAtUnixSeconds",
  "ownerDecisionSourceId",
  "deviceModel",
  "firmwareVersion",
  "capabilityPredicate",
  "ocmsVersion",
  "derivationPath",
  "solanaPublicKey",
  "observationClass",
  "observationValue",
  "signatureBase64url",
]);
const EVIDENCE_BINDING_KEYS = Object.freeze([
  "schema",
  "status",
  "sources",
  "modelTDeviceObservationReceipt",
  "sourceSetSha256",
  "packetMaySelectEvidenceSources",
  "noSelfAttestation",
]);
const AUTOMATED_EVIDENCE_SOURCE_KEYS = Object.freeze([
  "sourceId",
  "role",
  "publicKeySpkiDerBase64url",
  "publicKeySha256",
  "signingScheme",
]);
const OWNER_EVIDENCE_SOURCE_KEYS = Object.freeze([
  ...AUTOMATED_EVIDENCE_SOURCE_KEYS,
  "deviceModel",
  "derivationPath",
  "solanaPublicKey",
  "capabilityPredicate",
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
const EVIDENCE_SOURCE_ROLES = Object.freeze({
  OWNER_DECISION_SOURCE: "OWNER_DECISION_SOURCE",
  AUTOMATED_ENDPOINT_SOURCE: "AUTOMATED_ENDPOINT_SOURCE",
  AUTOMATED_EVIDENCE_CLOSURE: "AUTOMATED_EVIDENCE_CLOSURE",
  AUTOMATED_DEVICE_OBSERVATION_SOURCE: "AUTOMATED_DEVICE_OBSERVATION_SOURCE",
});

export const PRODUCTION_IDENTITY_AUTHORITY_MODEL_T_CAPABILITY_BOUNDARY = Object.freeze({
  predicate: MODEL_T_CAPABILITY_PREDICATE,
  requiredDeviceModel: MODEL_T_DEVICE,
  acceptedOcmsVersions: Object.freeze(["OCMS_V0", "OCMS_V1"]),
  ocmsV0FirmwareRange: ">=2.12.1 <2.12.4",
  ocmsV1FirmwareRange: ">=2.12.4",
  sourceRequirement: "SEPARATE_EXTERNAL_SOURCE_BOUND_DEVICE_OBSERVATION_RECEIPT",
  signerPathAndPublicKeyMustMatchObservation: true,
  signatureBytesProveHardwareProvenance: false,
  rawEd25519OwnerDecisionAllowed: false,
  packetSelfAttestedCapabilityObserved: false,
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

function decodedVariableBase64url(value, minimumBytes, maximumBytes, path, violations) {
  if (typeof value !== "string" || !BASE64URL.test(value)) {
    violations.push(`${path}: expected canonical unpadded base64url`);
    return null;
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length < minimumBytes
    || bytes.length > maximumBytes
    || bytes.toString("base64url") !== value) {
    violations.push(`${path}: wrong length or noncanonical base64url`);
    return null;
  }
  return bytes;
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, BigInt(index)]));

function decodeBase58PublicKey(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  let number = 0n;
  for (const character of value) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) return null;
    number = number * 58n + digit;
  }
  let encoded = number === 0n ? Buffer.alloc(0) : Buffer.from(
    (number.toString(16).length % 2 === 0 ? "" : "0") + number.toString(16),
    "hex",
  );
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  encoded = Buffer.concat([Buffer.alloc(leadingZeroes), encoded]);
  return encoded.length === 32 ? encoded : null;
}

function parseFirmwareVersion(value, path, violations) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/u.test(value)) {
    violations.push(`${path}: expected canonical major.minor.patch firmware version`);
    return null;
  }
  return value.split(".").map((part) => Number(part));
}

function compareFirmware(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

function firmwareSupportsOcms(version, ocmsVersion) {
  if (ocmsVersion === "OCMS_V0") {
    return compareFirmware(version, [2, 12, 1]) >= 0
      && compareFirmware(version, [2, 12, 4]) < 0;
  }
  if (ocmsVersion === "OCMS_V1") return compareFirmware(version, [2, 12, 4]) >= 0;
  return false;
}

export function productionIdentityAuthorityModelTObservationSigningBytes(unsignedReceipt) {
  const coreKeys = MODEL_T_OBSERVATION_KEYS.filter((key) => key !== "signatureBase64url");
  const violations = [];
  if (!exactKeys(unsignedReceipt, coreKeys, "unsignedModelTObservationReceipt", violations)) {
    throw new TypeError(violations.join("; "));
  }
  return Buffer.concat([
    MODEL_T_OBSERVATION_SIGNING_PREFIX,
    Buffer.from(canonicalizeRfc8785(unsignedReceipt), "utf8"),
  ]);
}

export function productionIdentityAuthorityModelTObservationSha256(receipt) {
  return sha256Canonical(
    "IAT_B3_PRODUCTION_IDENTITY_AUTHORITY_MODEL_T_CAPABILITY_OBSERVATION_RECEIPT_V1",
    receipt,
  );
}

export function productionIdentityAuthoritySerializeOcmsMessage(
  ocmsVersion,
  signerPublicKey,
  decisionPayload,
) {
  if (!Buffer.isBuffer(signerPublicKey) || signerPublicKey.length !== 32) {
    throw new TypeError("owner Solana signer must be an exact 32-byte public key");
  }
  if (!Buffer.isBuffer(decisionPayload) || decisionPayload.length < 1 || decisionPayload.length > 65_535) {
    throw new TypeError("owner decision payload must be nonempty and fit the bounded OCMS payload contract");
  }
  if (ocmsVersion === "OCMS_V0") {
    if (decisionPayload.length > 1_147) {
      throw new TypeError(
        "OCMS v0 UTF8_SHORT decision payload exceeds 1147 bytes (85-byte framing plus payload must be <=1232)",
      );
    }
    const length = Buffer.alloc(2);
    length.writeUInt16LE(decisionPayload.length);
    return Buffer.concat([
      OCMS_PREFIX,
      Buffer.from([0]),
      OCMS_V0_APPLICATION_DOMAIN,
      Buffer.from([1, 1]),
      signerPublicKey,
      length,
      decisionPayload,
    ]);
  }
  if (ocmsVersion === "OCMS_V1") {
    return Buffer.concat([
      OCMS_PREFIX,
      Buffer.from([1, 1]),
      signerPublicKey,
      decisionPayload,
    ]);
  }
  throw new TypeError("unsupported Solana OCMS version");
}

export function productionIdentityAuthorityOwnerDecisionOcmsSigningMaterial(
  unsignedReceipt,
  ownerSource,
  capabilityObservationReceipt,
) {
  const violations = [];
  if (!exactKeys(unsignedReceipt, RECEIPT_CORE_KEYS, "unsignedOwnerDecisionReceipt", violations)) {
    throw new TypeError(violations.join("; "));
  }
  if (unsignedReceipt.schema !== PRODUCTION_IDENTITY_AUTHORITY_OWNER_DECISION_RECEIPT_SCHEMA
    || ownerSource?.role !== EVIDENCE_SOURCE_ROLES.OWNER_DECISION_SOURCE
    || ownerSource?.signingScheme !== MODEL_T_OCMS_SCHEME
    || ownerSource?.deviceModel !== MODEL_T_DEVICE
    || ownerSource?.capabilityPredicate !== MODEL_T_CAPABILITY_PREDICATE) {
    throw new TypeError("owner decision source is not an exact Model T Solana OCMS source");
  }
  const signerPublicKey = decodeBase58PublicKey(ownerSource.solanaPublicKey);
  if (!signerPublicKey
    || capabilityObservationReceipt?.ownerDecisionSourceId !== ownerSource.sourceId
    || capabilityObservationReceipt?.solanaPublicKey !== ownerSource.solanaPublicKey
    || capabilityObservationReceipt?.derivationPath !== ownerSource.derivationPath
    || capabilityObservationReceipt?.deviceModel !== MODEL_T_DEVICE
    || capabilityObservationReceipt?.capabilityPredicate !== MODEL_T_CAPABILITY_PREDICATE) {
    throw new TypeError("Model T capability observation does not bind the owner signer, path, and public key");
  }
  const capabilityObservationSha256 = productionIdentityAuthorityModelTObservationSha256(
    capabilityObservationReceipt,
  );
  const decisionPayload = Buffer.from(canonicalizeRfc8785({
    domain: OWNER_DECISION_DOMAIN,
    receipt: unsignedReceipt,
    modelTCapability: {
      capabilityObservationSha256,
      deviceModel: capabilityObservationReceipt.deviceModel,
      firmwareVersion: capabilityObservationReceipt.firmwareVersion,
      ocmsVersion: capabilityObservationReceipt.ocmsVersion,
      derivationPath: capabilityObservationReceipt.derivationPath,
      signerSolanaPublicKey: capabilityObservationReceipt.solanaPublicKey,
    },
  }), "utf8");
  const ocmsMessage = productionIdentityAuthoritySerializeOcmsMessage(
    capabilityObservationReceipt.ocmsVersion,
    signerPublicKey,
    decisionPayload,
  );
  return {
    signatureScheme: MODEL_T_OCMS_SCHEME,
    ocmsVersion: capabilityObservationReceipt.ocmsVersion,
    signerDerivationPath: ownerSource.derivationPath,
    signerSolanaPublicKey: ownerSource.solanaPublicKey,
    capabilityObservationSha256,
    ocmsApplicationDomainBase64url:
      capabilityObservationReceipt.ocmsVersion === "OCMS_V0"
        ? OCMS_V0_APPLICATION_DOMAIN.toString("base64url")
        : null,
    decisionPayloadBase64url: decisionPayload.toString("base64url"),
    decisionPayloadSha256: sha256Bytes(decisionPayload),
    ocmsMessageBase64url: ocmsMessage.toString("base64url"),
    ocmsMessageSha256: sha256Bytes(ocmsMessage),
  };
}

export function productionIdentityAuthorityOcmsEnvelopeBytes(ocmsMessage, signatures) {
  if (!Buffer.isBuffer(ocmsMessage) || !Array.isArray(signatures)
    || signatures.length !== 1 || !Buffer.isBuffer(signatures[0]) || signatures[0].length !== 64) {
    throw new TypeError("the owner decision OCMS envelope requires exactly one 64-byte signature");
  }
  return Buffer.concat([Buffer.from([1]), signatures[0], ocmsMessage]);
}

function validateModelTDeviceObservation(
  value,
  recordsById,
  profile,
  evaluationUnixSeconds,
  path,
  violations,
) {
  const before = violations.length;
  if (!exactKeys(value, MODEL_T_OBSERVATION_KEYS, path, violations)) return null;
  if (value.schema !== PRODUCTION_IDENTITY_AUTHORITY_MODEL_T_OBSERVATION_SCHEMA) {
    violations.push(`${path}.schema: unsupported Model T observation schema`);
  }
  const observer = recordsById.get(value.sourceId);
  const owner = recordsById.get(value.ownerDecisionSourceId);
  if (!observer
    || observer.role !== EVIDENCE_SOURCE_ROLES.AUTOMATED_DEVICE_OBSERVATION_SOURCE
    || observer.signingScheme !== RAW_ED25519_SCHEME
    || !observer.keyObject) {
    violations.push(`${path}.sourceId: source is not the configured automated device-observation source`);
  }
  if (!owner || owner.role !== EVIDENCE_SOURCE_ROLES.OWNER_DECISION_SOURCE || !owner.keyObject) {
    violations.push(`${path}.ownerDecisionSourceId: source is not the configured owner-decision signer`);
  }
  if (value.sourceId === value.ownerDecisionSourceId) {
    violations.push(`${path}: device capability observation cannot self-attest the owner signer`);
  }
  if (value.deviceModel !== MODEL_T_DEVICE
    || value.capabilityPredicate !== MODEL_T_CAPABILITY_PREDICATE
    || value.observationValue !== "CAPABILITY_PRESENT") {
    violations.push(`${path}: exact Model T OCMS capability observation values are required`);
  }
  if (value.derivationPath !== owner?.derivationPath
    || value.solanaPublicKey !== owner?.solanaPublicKey) {
    violations.push(`${path}: observed derivation path and Solana public key must match the owner source`);
  }
  const firmware = parseFirmwareVersion(value.firmwareVersion, `${path}.firmwareVersion`, violations);
  if (!PRODUCTION_IDENTITY_AUTHORITY_MODEL_T_CAPABILITY_BOUNDARY.acceptedOcmsVersions.includes(value.ocmsVersion)) {
    violations.push(`${path}.ocmsVersion: expected OCMS_V0 or OCMS_V1`);
  } else if (firmware && !firmwareSupportsOcms(firmware, value.ocmsVersion)) {
    violations.push(`${path}: observed firmware and OCMS version are incompatible`);
  }
  const expectedClass = profile === "TEST_FIXTURE"
    ? TEST_DEVICE_OBSERVATION_CLASS
    : PRODUCTION_DEVICE_OBSERVATION_CLASS;
  if (value.observationClass !== expectedClass) {
    violations.push(`${path}.observationClass: ${profile} requires ${expectedClass}`);
  }
  const observedAt = canonicalU64(
    value.observedAtUnixSeconds,
    `${path}.observedAtUnixSeconds`,
    violations,
    { positive: true },
  );
  if (observedAt !== null && evaluationUnixSeconds !== null) {
    if (observedAt > evaluationUnixSeconds) {
      violations.push(`${path}.observedAtUnixSeconds: device observation is in the future`);
    } else if (evaluationUnixSeconds - observedAt > MAX_LIVE_OBSERVATION_AGE_SECONDS) {
      violations.push(`${path}.observedAtUnixSeconds: Model T capability observation is stale`);
    }
  }
  const signature = decodedBase64url(
    value.signatureBase64url,
    64,
    `${path}.signatureBase64url`,
    violations,
  );
  if (signature && observer?.keyObject) {
    const unsigned = Object.fromEntries(MODEL_T_OBSERVATION_KEYS
      .filter((key) => key !== "signatureBase64url")
      .map((key) => [key, value[key]]));
    if (!verifySignature(
      null,
      productionIdentityAuthorityModelTObservationSigningBytes(unsigned),
      observer.keyObject,
      signature,
    )) violations.push(`${path}.signatureBase64url: source-bound device observation signature is invalid`);
  }
  return violations.length === before ? value : null;
}

function validateAutomatedEvidenceBinding(
  binding,
  profile,
  evaluationUnixSeconds,
  violations,
  blockers,
) {
  const before = violations.length;
  if (!exactKeys(binding, EVIDENCE_BINDING_KEYS, "automatedEvidenceBinding", violations)) return null;
  if (binding.schema !== PRODUCTION_IDENTITY_AUTHORITY_AUTOMATED_EVIDENCE_SCHEMA) {
    violations.push("automatedEvidenceBinding.schema: unsupported schema");
  }
  if (binding.packetMaySelectEvidenceSources !== false) {
    violations.push("automatedEvidenceBinding.packetMaySelectEvidenceSources: packet-selected evidence sources are forbidden");
  }
  if (binding.noSelfAttestation !== true) {
    violations.push("automatedEvidenceBinding.noSelfAttestation: must be true");
  }
  if (binding.status === "AUTOMATED_EVIDENCE_SOURCES_UNCONFIGURED") {
    if (!Array.isArray(binding.sources)
      || binding.sources.length !== 0
      || binding.modelTDeviceObservationReceipt !== null
      || binding.sourceSetSha256 !== null) {
      violations.push("automatedEvidenceBinding: unconfigured evidence requires zero sources, null device observation, and null source-set digest");
    }
    blockers.push("automatedEvidenceBinding: owner-decision, device-observation, two endpoint, and closure sources are unconfigured");
    blockers.push("modelTCapability: MODEL_T_SOLANA_OCMS_CAPABILITY_OBSERVED has no separate source-bound device observation receipt");
    return null;
  }
  if (binding.status !== "CONFIGURED_AUTOMATED_EVIDENCE_SOURCES") {
    violations.push("automatedEvidenceBinding.status: expected AUTOMATED_EVIDENCE_SOURCES_UNCONFIGURED or CONFIGURED_AUTOMATED_EVIDENCE_SOURCES");
    return null;
  }
  if (!Array.isArray(binding.sources) || binding.sources.length !== 5) {
    violations.push("automatedEvidenceBinding.sources: expected exactly one owner-decision, one device-observation, two endpoint, and one closure source");
    return null;
  }
  const records = [];
  const ids = new Set();
  const publicKeyDigests = new Set();
  for (let index = 0; index < binding.sources.length; index += 1) {
    const entry = binding.sources[index];
    const path = `automatedEvidenceBinding.sources[${index}]`;
    const sourceKeys = entry?.role === EVIDENCE_SOURCE_ROLES.OWNER_DECISION_SOURCE
      ? OWNER_EVIDENCE_SOURCE_KEYS
      : AUTOMATED_EVIDENCE_SOURCE_KEYS;
    if (!exactKeys(entry, sourceKeys, path, violations)) continue;
    if (typeof entry.sourceId !== "string" || !KEY_ID.test(entry.sourceId)) {
      violations.push(`${path}.sourceId: expected a canonical externally configured source identifier`);
    }
    if (!Object.values(EVIDENCE_SOURCE_ROLES).includes(entry.role)) {
      violations.push(`${path}.role: unsupported evidence-source role`);
    }
    if (ids.has(entry.sourceId)) violations.push(`${path}.sourceId: duplicate source identifier`);
    ids.add(entry.sourceId);
    if (index > 0 && String(binding.sources[index - 1]?.sourceId) >= String(entry.sourceId)) {
      violations.push("automatedEvidenceBinding.sources: source identifiers must be unique and strictly sorted");
    }
    if (entry.role === EVIDENCE_SOURCE_ROLES.OWNER_DECISION_SOURCE) {
      if (entry.signingScheme !== MODEL_T_OCMS_SCHEME
        || entry.deviceModel !== MODEL_T_DEVICE
        || entry.capabilityPredicate !== MODEL_T_CAPABILITY_PREDICATE
        || typeof entry.derivationPath !== "string"
        || !/^m\/44'\/501'\/(?:0|[1-9][0-9]*)'\/(?:0|[1-9][0-9]*)'$/u.test(entry.derivationPath)) {
        violations.push(`${path}: owner source requires exact Model T OCMS scheme, predicate, and canonical Solana derivation path`);
      }
      if (!isCanonicalBase58Key(entry.solanaPublicKey)) {
        violations.push(`${path}.solanaPublicKey: expected a canonical 32-byte Solana public key`);
      }
    } else if (entry.signingScheme !== RAW_ED25519_SCHEME) {
      violations.push(`${path}.signingScheme: automated sources require raw source-bound Ed25519 receipts`);
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
      if (publicKeyDigests.has(digest)) violations.push(`${path}: signing key reused across evidence roles`);
      publicKeyDigests.add(digest);
      if (entry.role === EVIDENCE_SOURCE_ROLES.OWNER_DECISION_SOURCE) {
        const solanaPublicKey = decodeBase58PublicKey(entry.solanaPublicKey);
        if (!solanaPublicKey
          || !der.subarray(ED25519_SPKI_PREFIX.length).equals(solanaPublicKey)) {
          violations.push(`${path}.solanaPublicKey: must match the exact Ed25519 SPKI public key bytes`);
        }
      }
    }
    records.push({ ...entry, keyObject });
  }
  const roleCount = (role) => records.filter((entry) => entry.role === role).length;
  if (roleCount(EVIDENCE_SOURCE_ROLES.OWNER_DECISION_SOURCE) !== 1
    || roleCount(EVIDENCE_SOURCE_ROLES.AUTOMATED_ENDPOINT_SOURCE) !== 2
    || roleCount(EVIDENCE_SOURCE_ROLES.AUTOMATED_EVIDENCE_CLOSURE) !== 1
    || roleCount(EVIDENCE_SOURCE_ROLES.AUTOMATED_DEVICE_OBSERVATION_SOURCE) !== 1) {
    violations.push("automatedEvidenceBinding.sources: exact role cardinality is 1 owner-decision, 1 device-observation, 2 endpoint, and 1 closure source");
  }
  const recordsById = new Map(records.map((entry) => [entry.sourceId, entry]));
  const modelTDeviceObservationReceipt = validateModelTDeviceObservation(
    binding.modelTDeviceObservationReceipt,
    recordsById,
    profile,
    evaluationUnixSeconds,
    "automatedEvidenceBinding.modelTDeviceObservationReceipt",
    violations,
  );
  const expectedRoot = sha256Canonical(
    "IAT_B3_PRODUCTION_IDENTITY_AUTHORITY_AUTOMATED_EVIDENCE_SOURCE_SET_V3",
    {
      schema: binding.schema,
      status: binding.status,
      sources: binding.sources,
      modelTDeviceObservationReceipt: binding.modelTDeviceObservationReceipt,
      packetMaySelectEvidenceSources: binding.packetMaySelectEvidenceSources,
      noSelfAttestation: binding.noSelfAttestation,
    },
  );
  if (binding.sourceSetSha256 !== expectedRoot) {
    violations.push("automatedEvidenceBinding.sourceSetSha256: automated evidence source-set commitment mismatch");
  }
  if (violations.length !== before || !modelTDeviceObservationReceipt) return null;
  recordsById.modelTDeviceObservationReceipt = modelTDeviceObservationReceipt;
  recordsById.modelTCapabilityObservationSha256 =
    productionIdentityAuthorityModelTObservationSha256(modelTDeviceObservationReceipt);
  recordsById.modelTCapabilityObserved =
    profile === "PRODUCTION"
    && modelTDeviceObservationReceipt.observationClass === PRODUCTION_DEVICE_OBSERVATION_CLASS;
  return recordsById;
}

export function createProductionIdentityAuthorityAutomatedEvidenceBinding(
  sources,
  modelTDeviceObservationReceipt,
) {
  if (!Array.isArray(sources) || !isPlainObject(modelTDeviceObservationReceipt)) {
    throw new TypeError(
      "configured evidence binding requires sources plus a separate Model T device-observation receipt",
    );
  }
  const sorted = structuredClone(sources).sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  const core = {
    schema: PRODUCTION_IDENTITY_AUTHORITY_AUTOMATED_EVIDENCE_SCHEMA,
    status: "CONFIGURED_AUTOMATED_EVIDENCE_SOURCES",
    sources: sorted,
    modelTDeviceObservationReceipt: structuredClone(modelTDeviceObservationReceipt),
    packetMaySelectEvidenceSources: false,
    noSelfAttestation: true,
  };
  return {
    ...core,
    sourceSetSha256: sha256Canonical(
      "IAT_B3_PRODUCTION_IDENTITY_AUTHORITY_AUTOMATED_EVIDENCE_SOURCE_SET_V3",
      core,
    ),
  };
}

export function productionIdentityAuthorityReceiptSigningBytes(unsignedReceipt) {
  const violations = [];
  if (!exactKeys(unsignedReceipt, RECEIPT_CORE_KEYS, "unsignedAutomatedReceipt", violations)
    || unsignedReceipt.schema !== PRODUCTION_IDENTITY_AUTHORITY_RECEIPT_SCHEMA
    || String(unsignedReceipt.kind).startsWith("OWNER_")) {
    if (violations.length === 0) {
      violations.push("owner decisions require the exact Model T Solana OCMS envelope; raw Ed25519 is forbidden");
    }
    throw new TypeError(violations.join("; "));
  }
  return Buffer.concat([
    AUTOMATED_RECEIPT_SIGNING_PREFIX,
    Buffer.from(canonicalizeRfc8785(unsignedReceipt), "utf8"),
  ]);
}

function validateReceipt(value, expected, evidenceSources, path, violations) {
  const ownerDecision = expected.role === EVIDENCE_SOURCE_ROLES.OWNER_DECISION_SOURCE;
  const receiptKeys = ownerDecision ? OWNER_RECEIPT_KEYS : AUTOMATED_RECEIPT_KEYS;
  if (!exactKeys(value, receiptKeys, path, violations)) return false;
  const expectedSchema = ownerDecision
    ? PRODUCTION_IDENTITY_AUTHORITY_OWNER_DECISION_RECEIPT_SCHEMA
    : PRODUCTION_IDENTITY_AUTHORITY_RECEIPT_SCHEMA;
  if (value.schema !== expectedSchema) {
    violations.push(`${path}.schema: unsupported receipt schema`);
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
      violations.push(`${path}.observedAtUnixSeconds: receipt is in the future relative to externally supplied evaluation time`);
    } else if (expected.liveEndpoint === true
      && expected.evaluationUnixSeconds - observedAt > MAX_LIVE_OBSERVATION_AGE_SECONDS) {
      violations.push(`${path}.observedAtUnixSeconds: live endpoint evidence is stale`);
    }
  }
  if (expected.endpointRequired) {
    canonicalDigest(value.endpointSha256, `${path}.endpointSha256`, violations);
  } else if (value.endpointSha256 !== null) {
    violations.push(`${path}.endpointSha256: decision or closure receipt must not select an endpoint`);
  }
  if (value.observationValue !== expected.observationValue) {
    violations.push(`${path}.observationValue: does not match the bound stage value`);
  }
  if (typeof value.sourceId !== "string" || !KEY_ID.test(value.sourceId)) {
    violations.push(`${path}.sourceId: expected a canonical externally configured evidence-source ID`);
  }
  const record = evidenceSources?.get(value.sourceId);
  if (!record || record.role !== expected.role || !record.keyObject) {
    violations.push(`${path}.sourceId: source is absent from the configured ${expected.role} evidence role`);
    return false;
  }
  const signature = decodedBase64url(value.signatureBase64url, 64, `${path}.signatureBase64url`, violations);
  if (!signature) return false;
  if (ownerDecision) {
    const capabilityReceipt = evidenceSources.modelTDeviceObservationReceipt;
    if (!capabilityReceipt
      || value.capabilityObservationSha256 !== evidenceSources.modelTCapabilityObservationSha256) {
      violations.push(`${path}.capabilityObservationSha256: owner receipt does not bind the separate Model T device observation`);
      return false;
    }
    const capabilityTime = canonicalU64(
      capabilityReceipt.observedAtUnixSeconds,
      `${path}.capabilityObservation.observedAtUnixSeconds`,
      violations,
      { positive: true },
    );
    if (observedAt !== null && capabilityTime !== null
      && (observedAt < capabilityTime
        || observedAt - capabilityTime > MAX_LIVE_OBSERVATION_AGE_SECONDS)) {
      violations.push(`${path}: owner OCMS decision must follow the fresh Model T capability observation`);
    }
    const unsigned = Object.fromEntries(RECEIPT_CORE_KEYS.map((key) => [key, value[key]]));
    let material;
    try {
      material = productionIdentityAuthorityOwnerDecisionOcmsSigningMaterial(
        unsigned,
        record,
        capabilityReceipt,
      );
    } catch (error) {
      violations.push(`${path}: ${error.message}`);
      return false;
    }
    for (const [key, wanted] of Object.entries(material)) {
      if (value[key] !== wanted) violations.push(`${path}.${key}: OCMS signing material mismatch`);
    }
    const ocmsMessage = decodedVariableBase64url(
      value.ocmsMessageBase64url,
      1,
      70_000,
      `${path}.ocmsMessageBase64url`,
      violations,
    );
    const decisionPayload = decodedVariableBase64url(
      value.decisionPayloadBase64url,
      1,
      65_535,
      `${path}.decisionPayloadBase64url`,
      violations,
    );
    const envelope = decodedVariableBase64url(
      value.ocmsEnvelopeBase64url,
      66,
      70_065,
      `${path}.ocmsEnvelopeBase64url`,
      violations,
    );
    if (decisionPayload && value.decisionPayloadSha256 !== sha256Bytes(decisionPayload)) {
      violations.push(`${path}.decisionPayloadSha256: canonical owner decision payload mismatch`);
    }
    if (ocmsMessage && value.ocmsMessageSha256 !== sha256Bytes(ocmsMessage)) {
      violations.push(`${path}.ocmsMessageSha256: serialized OCMS message mismatch`);
    }
    if (envelope && value.ocmsEnvelopeSha256 !== sha256Bytes(envelope)) {
      violations.push(`${path}.ocmsEnvelopeSha256: serialized OCMS envelope mismatch`);
    }
    if (ocmsMessage) {
      const expectedEnvelope = productionIdentityAuthorityOcmsEnvelopeBytes(ocmsMessage, [signature]);
      if (!envelope?.equals(expectedEnvelope)) {
        violations.push(`${path}.ocmsEnvelopeBase64url: envelope must be signature_count || signature || exact OCMS message`);
      }
    }
    let verified = false;
    try {
      verified = ocmsMessage !== null
        && verifySignature(null, ocmsMessage, record.keyObject, signature);
    } catch {
      verified = false;
    }
    if (!verified) violations.push(`${path}.signatureBase64url: OCMS Ed25519 signature is invalid`);
    return verified;
  }
  const unsigned = Object.fromEntries(RECEIPT_CORE_KEYS.map((key) => [key, value[key]]));
  let verified = false;
  try {
    verified = verifySignature(
      null,
      productionIdentityAuthorityReceiptSigningBytes(unsigned),
      record.keyObject,
      signature,
    );
  } catch {
    verified = false;
  }
  if (!verified) violations.push(`${path}.signatureBase64url: Ed25519 signature is invalid`);
  return verified;
}

function validateTwoEndpointReceipts(receipts, expected, evidenceSources, path, violations) {
  if (!Array.isArray(receipts) || receipts.length !== 2) {
    violations.push(`${path}: expected exactly two source-bound automated endpoint receipts`);
    return false;
  }
  const before = violations.length;
  for (let index = 0; index < receipts.length; index += 1) {
    validateReceipt(
      receipts[index],
      {
        ...expected,
        role: EVIDENCE_SOURCE_ROLES.AUTOMATED_ENDPOINT_SOURCE,
        endpointRequired: true,
        liveEndpoint: true,
      },
      evidenceSources,
      `${path}[${index}]`,
      violations,
    );
  }
  if (receipts[0]?.sourceId === receipts[1]?.sourceId) {
    violations.push(`${path}: automated endpoint source IDs must be distinct`);
  }
  if (receipts[0]?.endpointSha256 === receipts[1]?.endpointSha256) {
    violations.push(`${path}: endpoint commitments must be distinct`);
  }
  const observedTimes = receipts.map((entry) => (
    typeof entry?.observedAtUnixSeconds === "string" && U64_DECIMAL.test(entry.observedAtUnixSeconds)
      ? BigInt(entry.observedAtUnixSeconds)
      : null
  ));
  if (observedTimes.every((value) => value !== null)
    && (observedTimes[0] > observedTimes[1]
      ? observedTimes[0] - observedTimes[1]
      : observedTimes[1] - observedTimes[0]) > MAX_ENDPOINT_PAIR_SKEW_SECONDS) {
    violations.push(`${path}: endpoint receipt timestamps exceed the bounded pair skew`);
  }
  return violations.length === before;
}

function validateAutomatedClosureTiming(receipts, closure, path, violations) {
  const prerequisiteTimes = receipts.map((entry) => (
    typeof entry?.observedAtUnixSeconds === "string" && U64_DECIMAL.test(entry.observedAtUnixSeconds)
      ? BigInt(entry.observedAtUnixSeconds)
      : null
  ));
  const closureTime = typeof closure?.observedAtUnixSeconds === "string"
    && U64_DECIMAL.test(closure.observedAtUnixSeconds)
    ? BigInt(closure.observedAtUnixSeconds)
    : null;
  if (closureTime === null || prerequisiteTimes.some((value) => value === null)) return;
  const latestPrerequisite = prerequisiteTimes.reduce(
    (latest, value) => value > latest ? value : latest,
    0n,
  );
  if (closureTime < latestPrerequisite) {
    violations.push(`${path}: automated closure predates required source-bound receipts`);
  } else if (closureTime - latestPrerequisite > MAX_AUTOMATED_CLOSURE_LAG_SECONDS) {
    violations.push(`${path}: automated closure exceeds the bounded receipt-closure interval`);
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

function validatePendingEvidence(value, path, violations) {
  if (value !== null) violations.push(`${path}: PENDING stage requires null`);
}

function validatePhaseA(manifest, options, evidenceSources, evaluationUnixSeconds, violations, blockers) {
  const phaseStart = violations.length;
  const phase = manifest.phaseAProductionIdentityFreeze;
  const keys = [
    "status",
    "subjectSha256",
    "ownerDecisionPreimageSha256",
    "ownerDecisionReceipt",
    "mainnetGenesisEndpointReceipts",
    "automatedClosureReceipt",
    "blocker",
  ];
  if (!exactKeys(phase, keys, "phaseAProductionIdentityFreeze", violations)) return false;
  if (phase.status === "PENDING") {
    validatePendingEvidence(phase.subjectSha256, "phaseAProductionIdentityFreeze.subjectSha256", violations);
    validatePendingEvidence(phase.ownerDecisionPreimageSha256, "phaseAProductionIdentityFreeze.ownerDecisionPreimageSha256", violations);
    validatePendingEvidence(phase.ownerDecisionReceipt, "phaseAProductionIdentityFreeze.ownerDecisionReceipt", violations);
    validatePendingEvidence(phase.automatedClosureReceipt, "phaseAProductionIdentityFreeze.automatedClosureReceipt", violations);
    if (!Array.isArray(phase.mainnetGenesisEndpointReceipts) || phase.mainnetGenesisEndpointReceipts.length !== 0) {
      violations.push("phaseAProductionIdentityFreeze.mainnetGenesisEndpointReceipts: PENDING requires empty array");
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
  validateReceipt(phase.ownerDecisionReceipt, {
    kind: "OWNER_IDENTITY_DECISION_RECEIPT",
    stage: "A",
    subjectSha256: subject,
    observationValue: phase.ownerDecisionPreimageSha256,
    decision: "ACCEPT",
    role: EVIDENCE_SOURCE_ROLES.OWNER_DECISION_SOURCE,
    endpointRequired: false,
    evaluationUnixSeconds,
  }, evidenceSources, "phaseAProductionIdentityFreeze.ownerDecisionReceipt", violations);
  validateTwoEndpointReceipts(phase.mainnetGenesisEndpointReceipts, {
    kind: "MAINNET_GENESIS_ENDPOINT_RECEIPT",
    stage: "A",
    subjectSha256: subject,
    observationValue: manifest.productionChoices.mainnetGenesisHash,
    decision: "MATCHED",
    evaluationUnixSeconds,
  }, evidenceSources, "phaseAProductionIdentityFreeze.mainnetGenesisEndpointReceipts", violations);
  validateReceipt(phase.automatedClosureReceipt, {
    kind: "AUTOMATED_IDENTITY_CLOSURE_RECEIPT",
    stage: "A",
    subjectSha256: subject,
    observationValue: subject,
    decision: "ACCEPT",
    role: EVIDENCE_SOURCE_ROLES.AUTOMATED_EVIDENCE_CLOSURE,
    endpointRequired: false,
    evaluationUnixSeconds,
  }, evidenceSources, "phaseAProductionIdentityFreeze.automatedClosureReceipt", violations);
  validateAutomatedClosureTiming(
    [phase.ownerDecisionReceipt, ...(Array.isArray(phase.mainnetGenesisEndpointReceipts)
      ? phase.mainnetGenesisEndpointReceipts
      : [])],
    phase.automatedClosureReceipt,
    "phaseAProductionIdentityFreeze.automatedClosureReceipt",
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

function validatePhaseB(manifest, phaseAComplete, evidenceSources, evaluationUnixSeconds, violations, blockers) {
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
    "fundingDecisionReceipt",
    "payerBalanceEndpointReceipts",
    "automatedClosureReceipt",
    "blocker",
  ];
  if (!exactKeys(phase, keys, "phaseBCeremonyFunding", violations)) return false;
  if (!exactKeys(phase.finalBinaries, ["law", "economy"], "phaseBCeremonyFunding.finalBinaries", violations)) return false;
  const complete = phase.status === "EVIDENCE_COMPLETE";
  validateBinary(phase.finalBinaries.law, "law", manifest.productionChoices.lawProgramId, complete, "phaseBCeremonyFunding.finalBinaries.law", violations);
  validateBinary(phase.finalBinaries.economy, "economy", manifest.productionChoices.economyProgramId, complete, "phaseBCeremonyFunding.finalBinaries.economy", violations);
  if (phase.status === "PENDING") {
    for (const key of keys.filter((key) => !["status", "finalBinaries", "payerBalanceEndpointReceipts", "blocker"].includes(key))) {
      validatePendingEvidence(phase[key], `phaseBCeremonyFunding.${key}`, violations);
    }
    if (!Array.isArray(phase.payerBalanceEndpointReceipts) || phase.payerBalanceEndpointReceipts.length !== 0) {
      violations.push("phaseBCeremonyFunding.payerBalanceEndpointReceipts: PENDING requires empty array");
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
  validateReceipt(phase.fundingDecisionReceipt, {
    kind: "OWNER_FUNDING_DECISION_RECEIPT",
    stage: "B",
    subjectSha256: subject,
    observationValue: phase.fundingSourceApprovalSha256,
    decision: "ACCEPT",
    role: EVIDENCE_SOURCE_ROLES.OWNER_DECISION_SOURCE,
    endpointRequired: false,
    evaluationUnixSeconds,
  }, evidenceSources, "phaseBCeremonyFunding.fundingDecisionReceipt", violations);
  if (Array.isArray(phase.payerBalanceEndpointReceipts)) {
    for (let index = 0; index < phase.payerBalanceEndpointReceipts.length; index += 1) {
      const balance = canonicalU64(
        phase.payerBalanceEndpointReceipts[index]?.observationValue,
        `phaseBCeremonyFunding.payerBalanceEndpointReceipts[${index}].observationValue`,
        violations,
        { positive: true },
      );
      if (balance !== null && floor !== null && balance < floor) {
        violations.push(`phaseBCeremonyFunding.payerBalanceEndpointReceipts[${index}]: observed balance is below ceremony floor`);
      }
    }
  }
  if (!Array.isArray(phase.payerBalanceEndpointReceipts) || phase.payerBalanceEndpointReceipts.length !== 2) {
    violations.push("phaseBCeremonyFunding.payerBalanceEndpointReceipts: expected exactly two automated endpoint receipts");
  } else {
    for (let index = 0; index < 2; index += 1) {
      validateReceipt(phase.payerBalanceEndpointReceipts[index], {
        kind: "PAYER_BALANCE_ENDPOINT_RECEIPT",
        stage: "B",
        subjectSha256: subject,
        observationValue: phase.payerBalanceEndpointReceipts[index].observationValue,
        decision: "MATCHED",
        role: EVIDENCE_SOURCE_ROLES.AUTOMATED_ENDPOINT_SOURCE,
        endpointRequired: true,
        liveEndpoint: true,
        evaluationUnixSeconds,
      }, evidenceSources, `phaseBCeremonyFunding.payerBalanceEndpointReceipts[${index}]`, violations);
    }
    if (phase.payerBalanceEndpointReceipts[0].sourceId === phase.payerBalanceEndpointReceipts[1].sourceId
      || phase.payerBalanceEndpointReceipts[0].endpointSha256 === phase.payerBalanceEndpointReceipts[1].endpointSha256) {
      violations.push("phaseBCeremonyFunding.payerBalanceEndpointReceipts: automated sources and endpoints must both be distinct");
    }
    const payerObservationTimes = phase.payerBalanceEndpointReceipts.map((entry) => (
      typeof entry?.observedAtUnixSeconds === "string" && U64_DECIMAL.test(entry.observedAtUnixSeconds)
        ? BigInt(entry.observedAtUnixSeconds)
        : null
    ));
    if (payerObservationTimes.every((value) => value !== null)
      && (payerObservationTimes[0] > payerObservationTimes[1]
        ? payerObservationTimes[0] - payerObservationTimes[1]
        : payerObservationTimes[1] - payerObservationTimes[0]) > MAX_ENDPOINT_PAIR_SKEW_SECONDS) {
      violations.push("phaseBCeremonyFunding.payerBalanceEndpointReceipts: endpoint receipt timestamps exceed the bounded pair skew");
    }
  }
  validateReceipt(phase.automatedClosureReceipt, {
    kind: "AUTOMATED_FUNDING_CLOSURE_RECEIPT",
    stage: "B",
    subjectSha256: subject,
    observationValue: subject,
    decision: "ACCEPT",
    role: EVIDENCE_SOURCE_ROLES.AUTOMATED_EVIDENCE_CLOSURE,
    endpointRequired: false,
    evaluationUnixSeconds,
  }, evidenceSources, "phaseBCeremonyFunding.automatedClosureReceipt", violations);
  validateAutomatedClosureTiming(
    [phase.fundingDecisionReceipt, ...(Array.isArray(phase.payerBalanceEndpointReceipts)
      ? phase.payerBalanceEndpointReceipts
      : [])],
    phase.automatedClosureReceipt,
    "phaseBCeremonyFunding.automatedClosureReceipt",
    violations,
  );
  const payerTimes = Array.isArray(phase.payerBalanceEndpointReceipts)
    ? phase.payerBalanceEndpointReceipts.map((entry) => (
      typeof entry?.observedAtUnixSeconds === "string" && U64_DECIMAL.test(entry.observedAtUnixSeconds)
        ? BigInt(entry.observedAtUnixSeconds)
        : null
    ))
    : [];
  const closureTime = typeof phase.automatedClosureReceipt?.observedAtUnixSeconds === "string"
    && U64_DECIMAL.test(phase.automatedClosureReceipt.observedAtUnixSeconds)
    ? BigInt(phase.automatedClosureReceipt.observedAtUnixSeconds)
    : null;
  if (expiresAt !== null) {
    if (evaluationUnixSeconds !== null && evaluationUnixSeconds > expiresAt) {
      violations.push("phaseBCeremonyFunding.expiresAtUnixSeconds: funding evidence has expired at externally supplied evaluation time");
    }
    if (closureTime !== null && closureTime > expiresAt) {
      violations.push("phaseBCeremonyFunding.expiresAtUnixSeconds: automated closure is after expiry");
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

function validatePhaseC(manifest, phaseBComplete, evidenceSources, evaluationUnixSeconds, violations, blockers) {
  const phaseStart = violations.length;
  const phase = manifest.phaseCDeployedSeal;
  const keys = [
    "status",
    "subjectSha256",
    "journal",
    "terminalState",
    "terminalEndpointReceipts",
    "automatedClosureReceipt",
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
    if (phase.subjectSha256 !== null || phase.automatedClosureReceipt !== null) {
      violations.push("phaseCDeployedSeal: PENDING requires null subject and automated closure receipt");
    }
    if (!Array.isArray(phase.terminalEndpointReceipts) || phase.terminalEndpointReceipts.length !== 0) {
      violations.push("phaseCDeployedSeal.terminalEndpointReceipts: PENDING requires empty array");
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
  validateTwoEndpointReceipts(phase.terminalEndpointReceipts, {
    kind: "TERMINAL_AUTHORITY_STATE_ENDPOINT_RECEIPT",
    stage: "C",
    subjectSha256: subject,
    observationValue: stateSha256,
    decision: "MATCHED",
    evaluationUnixSeconds,
  }, evidenceSources, "phaseCDeployedSeal.terminalEndpointReceipts", violations);
  validateReceipt(phase.automatedClosureReceipt, {
    kind: "AUTOMATED_DEPLOYED_SEAL_CLOSURE_RECEIPT",
    stage: "C",
    subjectSha256: subject,
    observationValue: subject,
    decision: "ACCEPT",
    role: EVIDENCE_SOURCE_ROLES.AUTOMATED_EVIDENCE_CLOSURE,
    endpointRequired: false,
    evaluationUnixSeconds,
  }, evidenceSources, "phaseCDeployedSeal.automatedClosureReceipt", violations);
  validateAutomatedClosureTiming(
    Array.isArray(phase.terminalEndpointReceipts)
      ? phase.terminalEndpointReceipts
      : [],
    phase.automatedClosureReceipt,
    "phaseCDeployedSeal.automatedClosureReceipt",
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
    automatedGate8EvidenceComplete: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: PRODUCTION_IDENTITY_AUTHORITY_MAINNET_STATUS,
  };
  if (!exactKeys(value, Object.keys(expected), "authorizationBoundary", violations)
    || !exactJson(value, expected)) {
    violations.push("authorizationBoundary: every execution/authorization flag must remain false and HOLD");
  }
}

function resultSurface(
  manifest,
  phaseAComplete,
  phaseBComplete,
  phaseCComplete,
  automatedEvidenceSourcesConfigured,
  modelTCapabilityObserved,
  blockers,
  violations,
) {
  const production = manifest?.profile === "PRODUCTION";
  return {
    valid: violations.length === 0,
    profile: typeof manifest?.profile === "string" ? manifest.profile : null,
    automatedEvidenceSourcesConfigured: automatedEvidenceSourcesConfigured,
    modelTCapabilityPredicate: MODEL_T_CAPABILITY_PREDICATE,
    modelTCapabilityObserved: modelTCapabilityObserved === true,
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
    automatedGate8EvidenceComplete: false,
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
    return resultSurface(safe, false, false, false, false, false, blockers, violations);
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
  if (!exactJson(
    safe.modelTCapabilityBoundary,
    PRODUCTION_IDENTITY_AUTHORITY_MODEL_T_CAPABILITY_BOUNDARY,
  )) {
    violations.push("manifest.modelTCapabilityBoundary: Model T OCMS capability HOLD policy drifted");
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
      violations.push("evaluationUnixSeconds: completed evidence requires externally supplied evaluation time");
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
  const automatedEvidenceBinding = options.automatedEvidenceBinding ?? EMPTY_PRODUCTION_IDENTITY_AUTHORITY_AUTOMATED_EVIDENCE_BINDING;
  const bindingViolationStart = violations.length;
  const evidenceSources = validateAutomatedEvidenceBinding(
    automatedEvidenceBinding,
    safe.profile,
    evaluationUnixSeconds,
    violations,
    blockers,
  );
  const automatedEvidenceSourcesConfigured = evidenceSources !== null && violations.length === bindingViolationStart;

  const phaseAComplete = validatePhaseA(
    safe,
    options,
    evidenceSources,
    evaluationUnixSeconds,
    violations,
    blockers,
  );
  const phaseBComplete = validatePhaseB(
    safe,
    phaseAComplete,
    evidenceSources,
    evaluationUnixSeconds,
    violations,
    blockers,
  );
  const phaseCComplete = validatePhaseC(
    safe,
    phaseBComplete,
    evidenceSources,
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
    automatedEvidenceSourcesConfigured,
    evidenceSources?.modelTCapabilityObserved === true,
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

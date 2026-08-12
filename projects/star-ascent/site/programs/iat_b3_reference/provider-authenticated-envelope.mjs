import {
  createHash,
  createPublicKey,
  verify as verifySignature,
} from "node:crypto";

export const PROVIDER_TRUST_BINDING_SCHEMA =
  "iat-b3-provider-trust-binding/v1";
export const PROVIDER_SIGNED_ENVELOPE_SCHEMA =
  "iat-b3-provider-signed-envelope/v1";
export const PROVIDER_ENVELOPE_STATE_SCHEMA =
  "iat-b3-provider-envelope-state/v1";
export const PROVIDER_ENVELOPE_VERIFICATION_SCHEMA =
  "iat-b3-provider-envelope-verification/v1";
export const PROVIDER_AUTHENTICATION_STATUS =
  "HOST_ONLY_NON_ACTIVATING_CONFIGURED_KEY_SIGNATURE_PREREQUISITE";
export const PROVIDER_AUTHENTICATION_MAINNET_STATUS = "HOLD";
export const PROVIDER_SIGNATURE_ALGORITHM = "Ed25519";
export const PROVIDER_KEY_MATERIAL_CLASS =
  "OWNER_SUPPLIED_PRODUCTION_PUBLIC_KEY";

export const PROVIDER_KINDS = Object.freeze({
  EXTERNAL_CHECKPOINT: "EXTERNAL_CHECKPOINT_PROVIDER",
  X_SOCIAL_EVIDENCE: "X_SOCIAL_EVIDENCE_PROVIDER",
});

export const PROVIDER_OPERATIONS = Object.freeze({
  [PROVIDER_KINDS.EXTERNAL_CHECKPOINT]: Object.freeze([
    "CHECKPOINT_READ_CURRENT",
    "CHECKPOINT_COMPARE_AND_SWAP",
  ]),
  [PROVIDER_KINDS.X_SOCIAL_EVIDENCE]: Object.freeze([
    "X_IDENTITY_TIER_OBSERVATION",
    "X_PUBLIC_ACTION_OBSERVATION",
    "X_COLLECTOR_EPOCH_FINALIZATION",
  ]),
});

const ZERO_SHA256 = "0".repeat(64);
const U64_MAX = (1n << 64n) - 1n;
const HEX_32 = /^[0-9a-f]{64}$/u;
const U64_DECIMAL = /^(?:0|[1-9][0-9]{0,19})$/u;
const IDENTIFIER = /^[a-z0-9][a-z0-9._:/-]{7,127}$/u;
const BASE64URL = /^[A-Za-z0-9_-]+$/u;
const NON_PRODUCTION_TOKEN =
  /(?:^|[._:/-])(?:dev|devnet|dummy|example|fake|fixture|local|localhost|mock|placeholder|sample|staging|synthetic|test)(?:$|[._:/-])/u;
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const SIGNING_PREFIX = Buffer.from(
  "IAT_B3_PROVIDER_SIGNED_ENVELOPE_TRANSCRIPT_V1\0",
  "utf8",
);
const ENVELOPE_DIGEST_PREFIX = Buffer.from(
  "IAT_B3_PROVIDER_SIGNED_ENVELOPE_DIGEST_V1\0",
  "utf8",
);
const EXECUTED_VERIFICATION_RECEIPTS = new WeakSet();

const TRUST_INPUT_KEYS = Object.freeze([
  "environment",
  "providerKind",
  "providerIdentitySha256",
  "subjectBindingSha256",
  "receiptDomainId",
  "keyRegistryResourceId",
  "ownerProductionKeyEvidenceSha256",
  "maximumEnvelopeAgeSeconds",
  "maximumFutureSkewSeconds",
  "maximumKeyOverlapSequences",
  "keys",
]);

const KEY_KEYS = Object.freeze([
  "keyId",
  "algorithm",
  "keyMaterialClass",
  "publicKeySpkiDerBase64url",
  "publicKeySha256",
  "activationSequence",
  "retirementSequence",
  "notBeforeUnixSeconds",
  "notAfterUnixSeconds",
  "revokedAtUnixSeconds",
  "compromiseCutoffUnixSeconds",
]);

const TRUST_KEYS = Object.freeze([
  "schema",
  "status",
  ...TRUST_INPUT_KEYS,
  "receiptDomainSha256",
  "trustRootSha256",
  "keyRegistrySnapshotSha256",
  "providerAuthenticationVerified",
  "productionKeyOwnershipVerified",
  "providerIdentityVerified",
  "keyRegistryAuthenticityVerified",
  "activationReady",
  "mainnetStatus",
  "trustBindingSha256",
]);

const UNSIGNED_ENVELOPE_KEYS = Object.freeze([
  "schema",
  "status",
  "environment",
  "providerKind",
  "providerIdentitySha256",
  "subjectBindingSha256",
  "trustBindingSha256",
  "receiptDomainSha256",
  "trustRootSha256",
  "keyRegistrySnapshotSha256",
  "keyId",
  "signatureAlgorithm",
  "operation",
  "sequence",
  "previousEnvelopeSha256",
  "requestNonceSha256",
  "requestSha256",
  "responseSha256",
  "issuedAtUnixSeconds",
  "expiresAtUnixSeconds",
]);

const SIGNED_ENVELOPE_KEYS = Object.freeze([
  ...UNSIGNED_ENVELOPE_KEYS,
  "signatureBase64url",
  "envelopeSha256",
]);

const STATE_KEYS = Object.freeze([
  "schema",
  "status",
  "environment",
  "providerKind",
  "providerIdentitySha256",
  "subjectBindingSha256",
  "trustBindingSha256",
  "lastSequence",
  "lastEnvelopeSha256",
  "durablePersistenceVerified",
  "externalRollbackProtectionVerified",
  "activationReady",
  "mainnetStatus",
  "stateSha256",
]);

const VERIFY_INPUT_KEYS = Object.freeze([
  "trustBinding",
  "currentState",
  "envelope",
  "requestBytes",
  "responseBytes",
  "expectedRequestNonceSha256",
  "evaluationUnixSeconds",
]);

const VERIFICATION_KEYS = Object.freeze([
  "schema",
  "status",
  "environment",
  "providerKind",
  "trustBindingSha256",
  "trustRootSha256",
  "keyRegistrySnapshotSha256",
  "keyId",
  "sequence",
  "envelopeSha256",
  "stateBeforeSha256",
  "stateAfter",
  "requestSha256",
  "responseSha256",
  "canonicalEnvelopeVerified",
  "cryptographicSignatureVerified",
  "configuredPublicKeyMatched",
  "requestNonceVerified",
  "contiguousSequenceVerified",
  "predecessorEnvelopeVerified",
  "providerAuthenticationVerified",
  "productionKeyOwnershipVerified",
  "providerIdentityVerified",
  "keyRegistryAuthenticityVerified",
  "responseSemanticsVerified",
  "durableReplayStateVerified",
  "externalRollbackProtectionVerified",
  "runtimeConsumerGatingVerified",
  "providerOperationalTruthVerified",
  "activationReady",
  "mainnetStatus",
  "verificationReceiptSha256",
]);

function isPlainRecord(value) {
  return Boolean(value)
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactDataValues(value, expected, errorCode) {
  if (!isPlainRecord(value)) throw new TypeError(errorCode);
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string")) throw new TypeError(errorCode);
  for (const key of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor
      || descriptor.enumerable !== true
      || !Object.hasOwn(descriptor, "value")
      || Object.hasOwn(descriptor, "get")
      || Object.hasOwn(descriptor, "set")) throw new TypeError(errorCode);
  }
  const sortedActual = [...actual].sort();
  const sortedExpected = [...expected].sort();
  if (sortedActual.length !== sortedExpected.length
    || sortedActual.some((key, index) => key !== sortedExpected[index])) {
    throw new TypeError(errorCode);
  }
  return Object.fromEntries(expected.map((key) => [
    key,
    Object.getOwnPropertyDescriptor(value, key).value,
  ]));
}

function exactArrayValues(value, errorCode) {
  if (!Array.isArray(value)) throw new TypeError(errorCode);
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === "symbol")) throw new TypeError(errorCode);
  const expectedKeys = new Set(["length", ...Array.from(
    { length: value.length },
    (_unused, index) => String(index),
  )]);
  if (ownKeys.length !== expectedKeys.size
    || ownKeys.some((key) => !expectedKeys.has(key))) throw new TypeError(errorCode);
  const values = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor
      || descriptor.enumerable !== true
      || !Object.hasOwn(descriptor, "value")
      || Object.hasOwn(descriptor, "get")
      || Object.hasOwn(descriptor, "set")) throw new TypeError(errorCode);
    values.push(descriptor.value);
  }
  return values;
}

function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}

function sha256Canonical(domain, value) {
  return sha256Bytes(Buffer.from(JSON.stringify({ domain, value }), "utf8"));
}

function asCanonicalDigest(value, label, { production = false } = {}) {
  if (typeof value !== "string" || !HEX_32.test(value)) {
    throw new TypeError(`${label} must be canonical lowercase 32-byte hexadecimal`);
  }
  if (production
    && (value === ZERO_SHA256 || /^(?:([0-9a-f])\1{63}|([0-9a-f]{2})\2{31})$/u.test(value))) {
    throw new Error(`${label} must not be zero or obvious placeholder material`);
  }
  return value;
}

function asProductionIdentifier(value, label) {
  if (typeof value !== "string"
    || !IDENTIFIER.test(value)
    || NON_PRODUCTION_TOKEN.test(value)) {
    throw new TypeError(`${label} must be a canonical production identifier`);
  }
  return value;
}

function asU64Decimal(value, label, { positive = false } = {}) {
  if (typeof value !== "string" || !U64_DECIMAL.test(value)) {
    throw new TypeError(`${label} must be a canonical unsigned 64-bit decimal string`);
  }
  const parsed = BigInt(value);
  if (parsed > U64_MAX || (positive && parsed === 0n)) {
    throw new RangeError(`${label} is outside the required unsigned 64-bit range`);
  }
  return parsed;
}

function asBoundedSeconds(value, label, maximum, { allowZero = false } = {}) {
  const parsed = asU64Decimal(value, label);
  if ((!allowZero && parsed === 0n) || parsed > maximum) {
    throw new RangeError(`${label} is outside its fail-closed bound`);
  }
  return parsed;
}

function asEvaluationUnixSeconds(value) {
  if (typeof value !== "bigint" || value < 0n || value > U64_MAX) {
    throw new TypeError("evaluationUnixSeconds must be an explicit unsigned 64-bit bigint");
  }
  return value;
}

function asExactBuffer(value, label) {
  if (!Buffer.isBuffer(value)) throw new TypeError(`${label} must be a Buffer`);
  return Buffer.from(value);
}

function asCanonicalBase64url(value, byteLength, label) {
  if (typeof value !== "string" || !BASE64URL.test(value)) {
    throw new TypeError(`${label} must be unpadded canonical base64url`);
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== byteLength || bytes.toString("base64url") !== value) {
    throw new TypeError(`${label} has the wrong length or a noncanonical encoding`);
  }
  return bytes;
}

function referenceFlags() {
  return {
    providerAuthenticationVerified: false,
    productionKeyOwnershipVerified: false,
    providerIdentityVerified: false,
    keyRegistryAuthenticityVerified: false,
    activationReady: false,
    mainnetStatus: PROVIDER_AUTHENTICATION_MAINNET_STATUS,
  };
}

function validateReferenceFlags(record, label) {
  if (record.providerAuthenticationVerified !== false
    || record.productionKeyOwnershipVerified !== false
    || record.providerIdentityVerified !== false
    || record.keyRegistryAuthenticityVerified !== false
    || record.activationReady !== false
    || record.mainnetStatus !== PROVIDER_AUTHENTICATION_MAINNET_STATUS) {
    throw new Error(`INVALID_${label}_NONACTIVATION_FLAGS`);
  }
}

function requireProviderKind(value) {
  if (!Object.values(PROVIDER_KINDS).includes(value)) {
    throw new TypeError("provider kind is not supported");
  }
  return value;
}

function requireOperation(providerKind, value) {
  if (typeof value !== "string" || !PROVIDER_OPERATIONS[providerKind].includes(value)) {
    throw new TypeError("provider operation is not supported for this provider kind");
  }
  return value;
}

function validateReceiptDomainId(providerKind, value) {
  const identifier = asProductionIdentifier(value, "receipt domain ID");
  const prefix = providerKind === PROVIDER_KINDS.EXTERNAL_CHECKPOINT
    ? "iat-b3/external-checkpoint-provider/"
    : "iat-b3/x-social-evidence-provider/";
  if (!identifier.startsWith(prefix) || !identifier.endsWith("/v1")) {
    throw new Error("receipt domain ID must be provider-specific and versioned");
  }
  return identifier;
}

function publicKeyRecord(value) {
  const record = exactDataValues(value, KEY_KEYS, "INVALID_PROVIDER_PUBLIC_KEY_RECORD");
  const keyId = asProductionIdentifier(record.keyId, "provider key ID");
  if (record.algorithm !== PROVIDER_SIGNATURE_ALGORITHM
    || record.keyMaterialClass !== PROVIDER_KEY_MATERIAL_CLASS) {
    throw new Error("provider key must be an explicit owner-supplied production Ed25519 public key");
  }
  const der = asCanonicalBase64url(
    record.publicKeySpkiDerBase64url,
    ED25519_SPKI_PREFIX.length + 32,
    "provider public key",
  );
  if (!der.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)
    || der.subarray(ED25519_SPKI_PREFIX.length).every((byte) => byte === 0)) {
    throw new Error("provider public key is not a nonzero canonical Ed25519 SPKI key");
  }
  let keyObject;
  try {
    keyObject = createPublicKey({ key: der, format: "der", type: "spki" });
  } catch {
    throw new Error("provider public key cannot be decoded as Ed25519 SPKI");
  }
  const exported = keyObject.export({ format: "der", type: "spki" });
  if (keyObject.asymmetricKeyType !== "ed25519" || !Buffer.from(exported).equals(der)) {
    throw new Error("provider public key is not canonical Ed25519 SPKI");
  }
  const publicKeySha256 = asCanonicalDigest(
    record.publicKeySha256,
    "provider public-key digest",
    { production: true },
  );
  if (publicKeySha256 !== sha256Bytes(der)) {
    throw new Error("provider public-key digest mismatch");
  }
  const activation = asU64Decimal(
    record.activationSequence,
    "provider key activation sequence",
    { positive: true },
  );
  const retirement = record.retirementSequence === null
    ? null
    : asU64Decimal(record.retirementSequence, "provider key retirement sequence", { positive: true });
  if (retirement !== null && retirement <= activation) {
    throw new Error("provider key retirement sequence must follow activation");
  }
  const notBefore = asU64Decimal(record.notBeforeUnixSeconds, "provider key not-before time");
  const notAfter = asU64Decimal(record.notAfterUnixSeconds, "provider key not-after time");
  if (notAfter <= notBefore) throw new Error("provider key validity interval must be nonempty");
  const revokedAt = record.revokedAtUnixSeconds === null
    ? null
    : asU64Decimal(record.revokedAtUnixSeconds, "provider key revocation time");
  const compromiseCutoff = record.compromiseCutoffUnixSeconds === null
    ? null
    : asU64Decimal(record.compromiseCutoffUnixSeconds, "provider key compromise cutoff");
  if (revokedAt !== null && revokedAt < notBefore) {
    throw new Error("provider key revocation time cannot precede key activation time");
  }
  if (compromiseCutoff !== null && compromiseCutoff < notBefore) {
    throw new Error("provider key compromise cutoff cannot precede key activation time");
  }
  return Object.freeze({
    keyId,
    algorithm: PROVIDER_SIGNATURE_ALGORITHM,
    keyMaterialClass: PROVIDER_KEY_MATERIAL_CLASS,
    publicKeySpkiDerBase64url: der.toString("base64url"),
    publicKeySha256,
    activationSequence: activation.toString(),
    retirementSequence: retirement?.toString() ?? null,
    notBeforeUnixSeconds: notBefore.toString(),
    notAfterUnixSeconds: notAfter.toString(),
    revokedAtUnixSeconds: revokedAt?.toString() ?? null,
    compromiseCutoffUnixSeconds: compromiseCutoff?.toString() ?? null,
  });
}

function trustCore(input) {
  const values = exactDataValues(input, TRUST_INPUT_KEYS, "INVALID_PROVIDER_TRUST_BINDING_INPUT");
  if (values.environment !== "PRODUCTION") {
    throw new Error("provider trust binding requires the explicit PRODUCTION environment");
  }
  const providerKind = requireProviderKind(values.providerKind);
  const providerIdentitySha256 = asCanonicalDigest(
    values.providerIdentitySha256,
    "provider identity digest",
    { production: true },
  );
  const subjectBindingSha256 = asCanonicalDigest(
    values.subjectBindingSha256,
    "provider subject-binding digest",
    { production: true },
  );
  const receiptDomainId = validateReceiptDomainId(providerKind, values.receiptDomainId);
  const keyRegistryResourceId = asProductionIdentifier(
    values.keyRegistryResourceId,
    "provider key-registry resource ID",
  );
  const ownerProductionKeyEvidenceSha256 = asCanonicalDigest(
    values.ownerProductionKeyEvidenceSha256,
    "owner production-key evidence digest",
    { production: true },
  );
  const maximumEnvelopeAgeSeconds = asBoundedSeconds(
    values.maximumEnvelopeAgeSeconds,
    "maximum envelope age",
    86_400n,
  ).toString();
  const maximumFutureSkewSeconds = asBoundedSeconds(
    values.maximumFutureSkewSeconds,
    "maximum future clock skew",
    300n,
    { allowZero: true },
  ).toString();
  const maximumKeyOverlapSequences = asBoundedSeconds(
    values.maximumKeyOverlapSequences,
    "maximum key-rotation overlap sequences",
    1_000_000n,
    { allowZero: true },
  ).toString();
  const rawKeys = exactArrayValues(values.keys, "INVALID_PROVIDER_PUBLIC_KEY_SET");
  if (rawKeys.length === 0 || rawKeys.length > 32) {
    throw new RangeError("provider trust binding requires between 1 and 32 public keys");
  }
  const keys = rawKeys.map(publicKeyRecord);
  for (let index = 1; index < keys.length; index += 1) {
    if (keys[index - 1].keyId >= keys[index].keyId) {
      throw new Error("provider public keys must have unique strictly sorted key IDs");
    }
  }
  if (new Set(keys.map(({ publicKeySha256 }) => publicKeySha256)).size !== keys.length) {
    throw new Error("provider public-key bytes must be unique");
  }
  const maximumOverlap = BigInt(maximumKeyOverlapSequences);
  for (let leftIndex = 0; leftIndex < keys.length; leftIndex += 1) {
    const left = keys[leftIndex];
    const leftStart = BigInt(left.activationSequence);
    const leftEnd = left.retirementSequence === null
      ? U64_MAX + 1n
      : BigInt(left.retirementSequence);
    for (let rightIndex = leftIndex + 1; rightIndex < keys.length; rightIndex += 1) {
      const right = keys[rightIndex];
      const rightStart = BigInt(right.activationSequence);
      const rightEnd = right.retirementSequence === null
        ? U64_MAX + 1n
        : BigInt(right.retirementSequence);
      const overlapStart = leftStart > rightStart ? leftStart : rightStart;
      const overlapEnd = leftEnd < rightEnd ? leftEnd : rightEnd;
      if (overlapEnd > overlapStart && overlapEnd - overlapStart > maximumOverlap) {
        throw new Error("provider key-rotation overlap exceeds its explicit sequence bound");
      }
    }
  }
  const receiptDomainSha256 = sha256Canonical(
    "iat-b3-provider-receipt-domain/v1",
    { providerKind, receiptDomainId },
  );
  const trustRootSha256 = sha256Canonical(
    "iat-b3-provider-trust-root/v1",
    {
      environment: "PRODUCTION",
      providerKind,
      providerIdentitySha256,
      subjectBindingSha256,
      receiptDomainSha256,
      ownerProductionKeyEvidenceSha256,
      maximumKeyOverlapSequences,
      keys,
    },
  );
  const keyRegistrySnapshotSha256 = sha256Canonical(
    "iat-b3-provider-key-registry-snapshot/v1",
    {
      environment: "PRODUCTION",
      providerKind,
      providerIdentitySha256,
      keyRegistryResourceId,
      ownerProductionKeyEvidenceSha256,
      trustRootSha256,
      keys,
    },
  );
  return {
    schema: PROVIDER_TRUST_BINDING_SCHEMA,
    status: PROVIDER_AUTHENTICATION_STATUS,
    environment: "PRODUCTION",
    providerKind,
    providerIdentitySha256,
    subjectBindingSha256,
    receiptDomainId,
    keyRegistryResourceId,
    ownerProductionKeyEvidenceSha256,
    maximumEnvelopeAgeSeconds,
    maximumFutureSkewSeconds,
    maximumKeyOverlapSequences,
    keys: Object.freeze(keys),
    receiptDomainSha256,
    trustRootSha256,
    keyRegistrySnapshotSha256,
    ...referenceFlags(),
  };
}

export function createProviderTrustBinding(input) {
  const core = trustCore(input);
  return Object.freeze({
    ...core,
    trustBindingSha256: sha256Canonical("iat-b3-provider-trust-binding/v1", core),
  });
}

export function validateProviderTrustBinding(binding) {
  const values = exactDataValues(binding, TRUST_KEYS, "INVALID_PROVIDER_TRUST_BINDING");
  if (values.schema !== PROVIDER_TRUST_BINDING_SCHEMA
    || values.status !== PROVIDER_AUTHENTICATION_STATUS) {
    throw new Error("INVALID_PROVIDER_TRUST_BINDING_HEADER");
  }
  validateReferenceFlags(values, "PROVIDER_TRUST_BINDING");
  const canonical = createProviderTrustBinding(Object.fromEntries(
    TRUST_INPUT_KEYS.map((key) => [key, values[key]]),
  ));
  if (JSON.stringify(binding) !== JSON.stringify(canonical)) {
    throw new Error("PROVIDER_TRUST_BINDING_DIGEST_OR_CANONICALIZATION_MISMATCH");
  }
  return binding;
}

function unsignedEnvelopeCore(value) {
  const envelope = exactDataValues(
    value,
    UNSIGNED_ENVELOPE_KEYS,
    "INVALID_PROVIDER_UNSIGNED_ENVELOPE",
  );
  if (envelope.schema !== PROVIDER_SIGNED_ENVELOPE_SCHEMA
    || envelope.status !== PROVIDER_AUTHENTICATION_STATUS
    || envelope.environment !== "PRODUCTION") {
    throw new Error("INVALID_PROVIDER_UNSIGNED_ENVELOPE_HEADER");
  }
  const providerKind = requireProviderKind(envelope.providerKind);
  asCanonicalDigest(envelope.providerIdentitySha256, "envelope provider identity", { production: true });
  asCanonicalDigest(envelope.subjectBindingSha256, "envelope subject binding", { production: true });
  asCanonicalDigest(envelope.trustBindingSha256, "envelope trust binding", { production: true });
  asCanonicalDigest(envelope.receiptDomainSha256, "envelope receipt domain", { production: true });
  asCanonicalDigest(envelope.keyRegistrySnapshotSha256, "envelope key registry", { production: true });
  asProductionIdentifier(envelope.keyId, "envelope key ID");
  if (envelope.signatureAlgorithm !== PROVIDER_SIGNATURE_ALGORITHM) {
    throw new Error("provider envelope signature algorithm is not supported");
  }
  requireOperation(providerKind, envelope.operation);
  const sequence = asU64Decimal(envelope.sequence, "provider envelope sequence", { positive: true });
  const previous = asCanonicalDigest(
    envelope.previousEnvelopeSha256,
    "previous provider-envelope digest",
  );
  if ((sequence === 1n) !== (previous === ZERO_SHA256)) {
    throw new Error("provider envelope genesis/predecessor relationship is invalid");
  }
  asCanonicalDigest(envelope.requestNonceSha256, "provider request nonce digest", { production: true });
  asCanonicalDigest(envelope.requestSha256, "provider request digest");
  asCanonicalDigest(envelope.responseSha256, "provider response digest");
  const issuedAt = asU64Decimal(envelope.issuedAtUnixSeconds, "provider envelope issued-at time");
  const expiresAt = asU64Decimal(envelope.expiresAtUnixSeconds, "provider envelope expiry time");
  if (expiresAt <= issuedAt) throw new Error("provider envelope validity interval must be nonempty");
  return envelope;
}

export function providerEnvelopeSigningBytes(unsignedEnvelope) {
  const canonical = unsignedEnvelopeCore(unsignedEnvelope);
  return Buffer.concat([
    SIGNING_PREFIX,
    Buffer.from(JSON.stringify(canonical), "utf8"),
  ]);
}

function envelopeDigest(signingBytes, signatureBytes) {
  return sha256Bytes(Buffer.concat([
    ENVELOPE_DIGEST_PREFIX,
    signingBytes,
    signatureBytes,
  ]));
}

export function createProviderSignedEnvelope(input) {
  const values = exactDataValues(
    input,
    ["unsignedEnvelope", "signatureBase64url"],
    "INVALID_PROVIDER_SIGNED_ENVELOPE_INPUT",
  );
  const signingBytes = providerEnvelopeSigningBytes(values.unsignedEnvelope);
  const signatureBytes = asCanonicalBase64url(
    values.signatureBase64url,
    64,
    "provider envelope signature",
  );
  return Object.freeze({
    ...unsignedEnvelopeCore(values.unsignedEnvelope),
    signatureBase64url: signatureBytes.toString("base64url"),
    envelopeSha256: envelopeDigest(signingBytes, signatureBytes),
  });
}

export function validateProviderSignedEnvelope(envelope) {
  const values = exactDataValues(
    envelope,
    SIGNED_ENVELOPE_KEYS,
    "INVALID_PROVIDER_SIGNED_ENVELOPE",
  );
  const unsignedEnvelope = Object.fromEntries(
    UNSIGNED_ENVELOPE_KEYS.map((key) => [key, values[key]]),
  );
  const signingBytes = providerEnvelopeSigningBytes(unsignedEnvelope);
  const signatureBytes = asCanonicalBase64url(
    values.signatureBase64url,
    64,
    "provider envelope signature",
  );
  if (asCanonicalDigest(values.envelopeSha256, "provider envelope digest", { production: true })
    !== envelopeDigest(signingBytes, signatureBytes)) {
    throw new Error("PROVIDER_SIGNED_ENVELOPE_DIGEST_MISMATCH");
  }
  return envelope;
}

function stateCore({ trustBinding, lastSequence, lastEnvelopeSha256 }) {
  validateProviderTrustBinding(trustBinding);
  const sequence = asU64Decimal(lastSequence, "provider envelope state sequence");
  const envelopeDigestValue = asCanonicalDigest(
    lastEnvelopeSha256,
    "provider envelope state head digest",
  );
  if ((sequence === 0n) !== (envelopeDigestValue === ZERO_SHA256)) {
    throw new Error("provider envelope state genesis/head relationship is invalid");
  }
  return {
    schema: PROVIDER_ENVELOPE_STATE_SCHEMA,
    status: PROVIDER_AUTHENTICATION_STATUS,
    environment: "PRODUCTION",
    providerKind: trustBinding.providerKind,
    providerIdentitySha256: trustBinding.providerIdentitySha256,
    subjectBindingSha256: trustBinding.subjectBindingSha256,
    trustBindingSha256: trustBinding.trustBindingSha256,
    lastSequence: sequence.toString(),
    lastEnvelopeSha256: envelopeDigestValue,
    durablePersistenceVerified: false,
    externalRollbackProtectionVerified: false,
    activationReady: false,
    mainnetStatus: PROVIDER_AUTHENTICATION_MAINNET_STATUS,
  };
}

function createState({ trustBinding, lastSequence, lastEnvelopeSha256 }) {
  const core = stateCore({ trustBinding, lastSequence, lastEnvelopeSha256 });
  return Object.freeze({
    ...core,
    stateSha256: sha256Canonical("iat-b3-provider-envelope-state/v1", core),
  });
}

export function createProviderEnvelopeGenesisState(trustBinding) {
  return createState({
    trustBinding,
    lastSequence: "0",
    lastEnvelopeSha256: ZERO_SHA256,
  });
}

export function validateProviderEnvelopeState(state, trustBinding) {
  validateProviderTrustBinding(trustBinding);
  const values = exactDataValues(state, STATE_KEYS, "INVALID_PROVIDER_ENVELOPE_STATE");
  if (values.schema !== PROVIDER_ENVELOPE_STATE_SCHEMA
    || values.status !== PROVIDER_AUTHENTICATION_STATUS
    || values.environment !== "PRODUCTION"
    || values.providerKind !== trustBinding.providerKind
    || values.providerIdentitySha256 !== trustBinding.providerIdentitySha256
    || values.subjectBindingSha256 !== trustBinding.subjectBindingSha256
    || values.trustBindingSha256 !== trustBinding.trustBindingSha256
    || values.durablePersistenceVerified !== false
    || values.externalRollbackProtectionVerified !== false
    || values.activationReady !== false
    || values.mainnetStatus !== PROVIDER_AUTHENTICATION_MAINNET_STATUS) {
    throw new Error("INVALID_PROVIDER_ENVELOPE_STATE_BINDING");
  }
  const canonical = createState({
    trustBinding,
    lastSequence: values.lastSequence,
    lastEnvelopeSha256: values.lastEnvelopeSha256,
  });
  if (JSON.stringify(state) !== JSON.stringify(canonical)) {
    throw new Error("PROVIDER_ENVELOPE_STATE_DIGEST_OR_CANONICALIZATION_MISMATCH");
  }
  return state;
}

function verificationNegativeFlags() {
  return {
    providerAuthenticationVerified: false,
    productionKeyOwnershipVerified: false,
    providerIdentityVerified: false,
    keyRegistryAuthenticityVerified: false,
    responseSemanticsVerified: false,
    durableReplayStateVerified: false,
    externalRollbackProtectionVerified: false,
    runtimeConsumerGatingVerified: false,
    providerOperationalTruthVerified: false,
    activationReady: false,
    mainnetStatus: PROVIDER_AUTHENTICATION_MAINNET_STATUS,
  };
}

export function verifyProviderSignedEnvelope(input) {
  const values = exactDataValues(input, VERIFY_INPUT_KEYS, "INVALID_PROVIDER_ENVELOPE_VERIFY_INPUT");
  const trustBinding = validateProviderTrustBinding(values.trustBinding);
  const currentState = validateProviderEnvelopeState(values.currentState, trustBinding);
  const envelope = validateProviderSignedEnvelope(values.envelope);
  const requestBytes = asExactBuffer(values.requestBytes, "provider request bytes");
  const responseBytes = asExactBuffer(values.responseBytes, "provider response bytes");
  const expectedRequestNonceSha256 = asCanonicalDigest(
    values.expectedRequestNonceSha256,
    "expected provider request nonce digest",
    { production: true },
  );
  const evaluationUnixSeconds = asEvaluationUnixSeconds(values.evaluationUnixSeconds);

  for (const [key, expected] of [
    ["environment", "PRODUCTION"],
    ["providerKind", trustBinding.providerKind],
    ["providerIdentitySha256", trustBinding.providerIdentitySha256],
    ["subjectBindingSha256", trustBinding.subjectBindingSha256],
    ["trustBindingSha256", trustBinding.trustBindingSha256],
    ["receiptDomainSha256", trustBinding.receiptDomainSha256],
    ["trustRootSha256", trustBinding.trustRootSha256],
    ["keyRegistrySnapshotSha256", trustBinding.keyRegistrySnapshotSha256],
  ]) {
    if (envelope[key] !== expected) {
      throw new Error(`PROVIDER_ENVELOPE_${key.toUpperCase()}_MISMATCH`);
    }
  }
  if (envelope.requestNonceSha256 !== expectedRequestNonceSha256) {
    throw new Error("PROVIDER_ENVELOPE_REQUEST_NONCE_MISMATCH");
  }
  if (envelope.requestSha256 !== sha256Bytes(requestBytes)) {
    throw new Error("PROVIDER_ENVELOPE_REQUEST_BYTES_MISMATCH");
  }
  if (envelope.responseSha256 !== sha256Bytes(responseBytes)) {
    throw new Error("PROVIDER_ENVELOPE_RESPONSE_BYTES_MISMATCH");
  }

  const currentSequence = asU64Decimal(currentState.lastSequence, "current provider envelope sequence");
  if (currentSequence === U64_MAX) throw new Error("PROVIDER_ENVELOPE_SEQUENCE_EXHAUSTED_HOLD");
  const sequence = asU64Decimal(envelope.sequence, "provider envelope sequence", { positive: true });
  if (sequence !== currentSequence + 1n) {
    throw new Error("PROVIDER_ENVELOPE_REPLAY_SKIP_OR_SAME_SEQUENCE_FORK_HOLD");
  }
  if (envelope.previousEnvelopeSha256 !== currentState.lastEnvelopeSha256) {
    throw new Error("PROVIDER_ENVELOPE_PREDECESSOR_OR_ROLLBACK_MISMATCH_HOLD");
  }

  const keyRecord = trustBinding.keys.find(({ keyId }) => keyId === envelope.keyId);
  if (!keyRecord) throw new Error("PROVIDER_ENVELOPE_KEY_ID_NOT_CONFIGURED");
  const activation = BigInt(keyRecord.activationSequence);
  const retirement = keyRecord.retirementSequence === null
    ? null
    : BigInt(keyRecord.retirementSequence);
  if (sequence < activation || (retirement !== null && sequence >= retirement)) {
    throw new Error("PROVIDER_ENVELOPE_KEY_NOT_ACTIVE_FOR_SEQUENCE");
  }

  const issuedAt = BigInt(envelope.issuedAtUnixSeconds);
  const expiresAt = BigInt(envelope.expiresAtUnixSeconds);
  const notBefore = BigInt(keyRecord.notBeforeUnixSeconds);
  const notAfter = BigInt(keyRecord.notAfterUnixSeconds);
  const maximumAge = BigInt(trustBinding.maximumEnvelopeAgeSeconds);
  const maximumFutureSkew = BigInt(trustBinding.maximumFutureSkewSeconds);
  if (issuedAt < notBefore || issuedAt >= notAfter || expiresAt > notAfter) {
    throw new Error("PROVIDER_ENVELOPE_OUTSIDE_KEY_VALIDITY_INTERVAL");
  }
  if (expiresAt - issuedAt > maximumAge) {
    throw new Error("PROVIDER_ENVELOPE_VALIDITY_EXCEEDS_CONFIGURED_MAXIMUM");
  }
  if (issuedAt > evaluationUnixSeconds + maximumFutureSkew) {
    throw new Error("PROVIDER_ENVELOPE_ISSUED_TOO_FAR_IN_FUTURE");
  }
  if (evaluationUnixSeconds >= expiresAt) {
    throw new Error("PROVIDER_ENVELOPE_EXPIRED");
  }
  if (keyRecord.revokedAtUnixSeconds !== null) {
    const revokedAt = BigInt(keyRecord.revokedAtUnixSeconds);
    if (issuedAt >= revokedAt || evaluationUnixSeconds >= revokedAt) {
      throw new Error("PROVIDER_ENVELOPE_KEY_REVOKED_HOLD");
    }
  }
  if (keyRecord.compromiseCutoffUnixSeconds !== null
    && issuedAt >= BigInt(keyRecord.compromiseCutoffUnixSeconds)) {
    throw new Error("PROVIDER_ENVELOPE_AT_OR_AFTER_COMPROMISE_CUTOFF_HOLD");
  }

  const publicKeyBytes = Buffer.from(keyRecord.publicKeySpkiDerBase64url, "base64url");
  const publicKey = createPublicKey({ key: publicKeyBytes, format: "der", type: "spki" });
  const signatureBytes = Buffer.from(envelope.signatureBase64url, "base64url");
  const unsignedEnvelope = Object.fromEntries(
    UNSIGNED_ENVELOPE_KEYS.map((key) => [key, envelope[key]]),
  );
  if (!verifySignature(null, providerEnvelopeSigningBytes(unsignedEnvelope), publicKey, signatureBytes)) {
    throw new Error("PROVIDER_ENVELOPE_SIGNATURE_INVALID");
  }

  const stateAfter = createState({
    trustBinding,
    lastSequence: envelope.sequence,
    lastEnvelopeSha256: envelope.envelopeSha256,
  });
  const core = {
    schema: PROVIDER_ENVELOPE_VERIFICATION_SCHEMA,
    status: PROVIDER_AUTHENTICATION_STATUS,
    environment: "PRODUCTION",
    providerKind: trustBinding.providerKind,
    trustBindingSha256: trustBinding.trustBindingSha256,
    trustRootSha256: trustBinding.trustRootSha256,
    keyRegistrySnapshotSha256: trustBinding.keyRegistrySnapshotSha256,
    keyId: envelope.keyId,
    sequence: envelope.sequence,
    envelopeSha256: envelope.envelopeSha256,
    stateBeforeSha256: currentState.stateSha256,
    stateAfter,
    requestSha256: envelope.requestSha256,
    responseSha256: envelope.responseSha256,
    canonicalEnvelopeVerified: true,
    cryptographicSignatureVerified: true,
    configuredPublicKeyMatched: true,
    requestNonceVerified: true,
    contiguousSequenceVerified: true,
    predecessorEnvelopeVerified: true,
    ...verificationNegativeFlags(),
  };
  const receipt = Object.freeze({
    ...core,
    verificationReceiptSha256: sha256Canonical(
      "iat-b3-provider-envelope-verification/v1",
      core,
    ),
  });
  EXECUTED_VERIFICATION_RECEIPTS.add(receipt);
  return receipt;
}

export function validateProviderEnvelopeVerificationReceipt(receipt) {
  const values = exactDataValues(
    receipt,
    VERIFICATION_KEYS,
    "INVALID_PROVIDER_ENVELOPE_VERIFICATION_RECEIPT",
  );
  if (values.schema !== PROVIDER_ENVELOPE_VERIFICATION_SCHEMA
    || values.status !== PROVIDER_AUTHENTICATION_STATUS
    || values.environment !== "PRODUCTION"
    || !Object.values(PROVIDER_KINDS).includes(values.providerKind)
    || values.canonicalEnvelopeVerified !== true
    || values.cryptographicSignatureVerified !== true
    || values.configuredPublicKeyMatched !== true
    || values.requestNonceVerified !== true
    || values.contiguousSequenceVerified !== true
    || values.predecessorEnvelopeVerified !== true) {
    throw new Error("INVALID_PROVIDER_ENVELOPE_VERIFICATION_FACTS");
  }
  const negative = verificationNegativeFlags();
  for (const [key, expected] of Object.entries(negative)) {
    if (values[key] !== expected) throw new Error("INVALID_PROVIDER_ENVELOPE_VERIFICATION_TRUTH_BOUNDARY");
  }
  asCanonicalDigest(values.trustBindingSha256, "verification trust binding", { production: true });
  asCanonicalDigest(values.trustRootSha256, "verification trust root", { production: true });
  asCanonicalDigest(values.keyRegistrySnapshotSha256, "verification key registry", { production: true });
  asProductionIdentifier(values.keyId, "verification key ID");
  asU64Decimal(values.sequence, "verification sequence", { positive: true });
  asCanonicalDigest(values.envelopeSha256, "verification envelope", { production: true });
  asCanonicalDigest(values.stateBeforeSha256, "verification state-before", { production: true });
  asCanonicalDigest(values.requestSha256, "verification request");
  asCanonicalDigest(values.responseSha256, "verification response");
  const stateAfter = exactDataValues(
    values.stateAfter,
    STATE_KEYS,
    "INVALID_PROVIDER_ENVELOPE_VERIFICATION_STATE_TRANSITION",
  );
  if (stateAfter.schema !== PROVIDER_ENVELOPE_STATE_SCHEMA
    || stateAfter.status !== PROVIDER_AUTHENTICATION_STATUS
    || stateAfter.environment !== "PRODUCTION"
    || stateAfter.providerKind !== values.providerKind
    || stateAfter.trustBindingSha256 !== values.trustBindingSha256
    || stateAfter.stateSha256 === values.stateBeforeSha256
    || stateAfter.lastSequence !== values.sequence
    || stateAfter.lastEnvelopeSha256 !== values.envelopeSha256
    || stateAfter.durablePersistenceVerified !== false
    || stateAfter.externalRollbackProtectionVerified !== false
    || stateAfter.activationReady !== false
    || stateAfter.mainnetStatus !== PROVIDER_AUTHENTICATION_MAINNET_STATUS) {
    throw new Error("INVALID_PROVIDER_ENVELOPE_VERIFICATION_STATE_TRANSITION");
  }
  asCanonicalDigest(stateAfter.providerIdentitySha256, "verification state provider identity", {
    production: true,
  });
  asCanonicalDigest(stateAfter.subjectBindingSha256, "verification state subject binding", {
    production: true,
  });
  const { stateSha256, ...stateAfterCore } = stateAfter;
  if (asCanonicalDigest(stateSha256, "verification state-after digest", { production: true })
    !== sha256Canonical("iat-b3-provider-envelope-state/v1", stateAfterCore)) {
    throw new Error("INVALID_PROVIDER_ENVELOPE_VERIFICATION_STATE_DIGEST");
  }
  const { verificationReceiptSha256, ...core } = values;
  if (asCanonicalDigest(
    verificationReceiptSha256,
    "provider verification receipt digest",
    { production: true },
  ) !== sha256Canonical("iat-b3-provider-envelope-verification/v1", core)) {
    throw new Error("PROVIDER_ENVELOPE_VERIFICATION_RECEIPT_DIGEST_MISMATCH");
  }
  if (!EXECUTED_VERIFICATION_RECEIPTS.has(receipt)) {
    throw new Error("PROVIDER_ENVELOPE_VERIFICATION_RECEIPT_NOT_EXECUTED_IN_THIS_PROCESS");
  }
  return receipt;
}

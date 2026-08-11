import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export const PRIVACY_VAULT_RECOVERY_STATE_SCHEMA =
  "iat-b3-privacy-vault-recovery-state/v1";
export const PRIVACY_VAULT_RECOVERY_BUNDLE_SCHEMA =
  "iat-b3-privacy-vault-recovery-bundle/v1";
export const PRIVACY_VAULT_RECOVERY_VERIFICATION_SCHEMA =
  "iat-b3-privacy-vault-recovery-verification/v1";
export const PRIVACY_VAULT_RECOVERY_STATUS =
  "HOST_ONLY_NON_ACTIVATING_ENCRYPTED_RECOVERY_PREREQUISITE";
export const PRIVACY_VAULT_RECOVERY_MAINNET_STATUS = "HOLD";
export const PRIVACY_VAULT_RECOVERY_CIPHER = "AES-256-GCM";
export const PRIVACY_VAULT_RECOVERY_KEY_DERIVATION =
  "HMAC-SHA256_VAULT_BOUND_DOMAIN_SEPARATED_SUBKEYS";
export const PRIVACY_VAULT_RECOVERY_NONCE_DERIVATION =
  "HMAC-SHA256_NONCE_SUBKEY_OVER_CANONICAL_AAD_TRUNCATED_96_BITS";

const ZERO_SHA256 = "0".repeat(64);
const U64_MAX = (1n << 64n) - 1n;
const HEX_32 = /^[0-9a-f]{64}$/u;
const U64_DECIMAL = /^(?:0|[1-9][0-9]{0,19})$/u;
const BASE64URL = /^(?:[A-Za-z0-9_-]+)$/u;
const MAX_KEY_MATERIAL_BYTES = 16_384;
const MAX_BUNDLE_AGE_SECONDS = 2_592_000n;
const MAX_FUTURE_SKEW_SECONDS = 3_600n;
const AES_GCM_NONCE_BYTES = 12;
const AES_GCM_TAG_BYTES = 16;
const PLAINTEXT_PREFIX = Buffer.from(
  "IAT_B3_PRIVACY_VAULT_RECOVERY_PLAINTEXT_V1\0",
  "utf8",
);
const RECOVERY_KEY_COMMITMENT_PREFIX = Buffer.from(
  "IAT_B3_PRIVACY_VAULT_RECOVERY_KEY_COMMITMENT_V1\0",
  "utf8",
);
const KEY_MATERIAL_COMMITMENT_PREFIX = Buffer.from(
  "IAT_B3_PRIVACY_VAULT_KEY_MATERIAL_COMMITMENT_V1\0",
  "utf8",
);
const ENCRYPTION_SUBKEY_PREFIX = Buffer.from(
  "IAT_B3_PRIVACY_VAULT_RECOVERY_ENCRYPTION_SUBKEY_V1\0",
  "utf8",
);
const NONCE_SUBKEY_PREFIX = Buffer.from(
  "IAT_B3_PRIVACY_VAULT_RECOVERY_NONCE_SUBKEY_V1\0",
  "utf8",
);
const AAD_TRANSCRIPT_PREFIX = Buffer.from(
  "IAT_B3_PRIVACY_VAULT_RECOVERY_AAD_V1\0",
  "utf8",
);
const NONCE_TRANSCRIPT_PREFIX = Buffer.from(
  "IAT_B3_PRIVACY_VAULT_RECOVERY_NONCE_V1\0",
  "utf8",
);
const EXECUTED_VERIFICATION_RECEIPTS = new WeakSet();

const GENESIS_INPUT_KEYS = Object.freeze([
  "vaultBindingSha256",
  "recoveryKeyCommitmentSha256",
  "maximumBundleAgeSeconds",
  "maximumFutureSkewSeconds",
]);

const STATE_KEYS = Object.freeze([
  "schema",
  "status",
  "vaultBindingSha256",
  "recoveryKeyCommitmentSha256",
  "maximumBundleAgeSeconds",
  "maximumFutureSkewSeconds",
  "lastEpoch",
  "lastBundleSha256",
  "lastKeyMaterialCommitmentSha256",
  "durablePersistenceVerified",
  "externalRollbackProtectionVerified",
  "securePlatformKeystoreVerified",
  "onchainRuntimeIntegrationVerified",
  "activationReady",
  "mainnetStatus",
  "stateSha256",
]);

const SEAL_INPUT_KEYS = Object.freeze([
  "currentState",
  "recoveryKeyBytes",
  "keyMaterialBytes",
  "createdAtUnixSeconds",
  "expiresAtUnixSeconds",
]);

const BUNDLE_AAD_KEYS = Object.freeze([
  "schema",
  "status",
  "cipher",
  "keyDerivation",
  "nonceDerivation",
  "vaultBindingSha256",
  "recoveryKeyCommitmentSha256",
  "stateBeforeSha256",
  "epoch",
  "previousBundleSha256",
  "previousKeyMaterialCommitmentSha256",
  "keyMaterialCommitmentSha256",
  "keyMaterialByteLength",
  "createdAtUnixSeconds",
  "expiresAtUnixSeconds",
  "walletSignatureDerivationVerified",
  "token2022ElGamalKeypairVerified",
  "securePlatformKeystoreVerified",
  "durablePersistenceVerified",
  "externalRollbackProtectionVerified",
  "onchainRuntimeIntegrationVerified",
  "activationReady",
  "mainnetStatus",
]);

const BUNDLE_KEYS = Object.freeze([
  ...BUNDLE_AAD_KEYS,
  "aadSha256",
  "nonceBase64url",
  "ciphertextBase64url",
  "authenticationTagBase64url",
  "bundleSha256",
]);

const VERIFY_INPUT_KEYS = Object.freeze([
  "currentState",
  "bundle",
  "recoveryKeyBytes",
  "expectedKeyMaterialCommitmentSha256",
  "evaluationUnixSeconds",
]);

const VERIFICATION_KEYS = Object.freeze([
  "schema",
  "status",
  "vaultBindingSha256",
  "recoveryKeyCommitmentSha256",
  "epoch",
  "bundleSha256",
  "stateBeforeSha256",
  "stateAfter",
  "expectedKeyMaterialCommitmentSha256",
  "canonicalBundleVerified",
  "aes256GcmAuthenticationVerified",
  "deterministicNonceVerified",
  "keyMaterialCommitmentVerified",
  "contiguousEpochVerified",
  "predecessorBundleVerified",
  "plaintextExported",
  "walletSignatureDerivationVerified",
  "token2022ElGamalKeypairVerified",
  "securePlatformKeystoreVerified",
  "durablePersistenceVerified",
  "externalRollbackProtectionVerified",
  "onchainRuntimeIntegrationVerified",
  "falseZeroUiPreventionVerified",
  "privacyLegalReviewAccepted",
  "devnetLifecycleVerified",
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

function sha256Bytes(...values) {
  const hash = createHash("sha256");
  for (const value of values) hash.update(value);
  return hash.digest("hex");
}

function sha256Canonical(domain, value) {
  return sha256Bytes(Buffer.from(JSON.stringify({ domain, value }), "utf8"));
}

function asCanonicalDigest(value, label, { allowZero = false } = {}) {
  if (typeof value !== "string" || !HEX_32.test(value)) {
    throw new TypeError(`${label} must be canonical lowercase 32-byte hexadecimal`);
  }
  if ((!allowZero && value === ZERO_SHA256)
    || (value !== ZERO_SHA256
      && /^(?:([0-9a-f])\1{63}|([0-9a-f]{2})\2{31})$/u.test(value))) {
    throw new Error(`${label} must not be zero or obvious placeholder material`);
  }
  return value;
}

function asU64Decimal(value, label, {
  positive = false,
  maximum = U64_MAX,
} = {}) {
  if (typeof value !== "string" || !U64_DECIMAL.test(value)) {
    throw new TypeError(`${label} must be a canonical unsigned 64-bit decimal string`);
  }
  const parsed = BigInt(value);
  if (parsed > U64_MAX || parsed > maximum || (positive && parsed === 0n)) {
    throw new RangeError(`${label} is outside the accepted range`);
  }
  return parsed;
}

function asInstant(value, label) {
  if (typeof value !== "bigint" || value < 0n || value > U64_MAX) {
    throw new TypeError(`${label} must be an unsigned 64-bit bigint`);
  }
  return value;
}

function asFalse(value, label) {
  if (value !== false) throw new Error(`${label} must remain false`);
  return false;
}

function copyRecoveryKey(value) {
  if (!Buffer.isBuffer(value) || value.length !== 32) {
    throw new TypeError("recoveryKeyBytes must be an exact 32-byte Buffer");
  }
  if (value.every((byte) => byte === value[0])
    || value.every((byte, index) => byte === value[index % 2])) {
    throw new Error("recoveryKeyBytes must not be obvious placeholder material");
  }
  return Buffer.from(value);
}

function copyKeyMaterial(value) {
  if (!Buffer.isBuffer(value)
    || value.length === 0
    || value.length > MAX_KEY_MATERIAL_BYTES) {
    throw new TypeError(
      `keyMaterialBytes must be a nonempty Buffer of at most ${MAX_KEY_MATERIAL_BYTES} bytes`,
    );
  }
  if (value.every((byte) => byte === 0)) {
    throw new Error("keyMaterialBytes must not be all-zero placeholder material");
  }
  return Buffer.from(value);
}

function exactBase64url(value, label, expectedLength) {
  if (typeof value !== "string" || !BASE64URL.test(value)) {
    throw new TypeError(`${label} must be canonical nonempty base64url`);
  }
  const bytes = Buffer.from(value, "base64url");
  if (bytes.toString("base64url") !== value
    || (expectedLength !== undefined && bytes.length !== expectedLength)) {
    throw new TypeError(`${label} must be canonical base64url with the expected length`);
  }
  return bytes;
}

function equalBytes(left, right) {
  return left.length === right.length && timingSafeEqual(left, right);
}

function equalDigest(left, right) {
  return equalBytes(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function freezeRecord(value) {
  return Object.freeze(value);
}

function stateWithoutDigest(values) {
  return Object.fromEntries(STATE_KEYS
    .filter((key) => key !== "stateSha256")
    .map((key) => [key, values[key]]));
}

function bundleAadFields(values) {
  return Object.fromEntries(BUNDLE_AAD_KEYS.map((key) => [key, values[key]]));
}

function bundleWithoutDigest(values) {
  return Object.fromEntries(BUNDLE_KEYS
    .filter((key) => key !== "bundleSha256")
    .map((key) => [key, values[key]]));
}

function verificationWithoutDigest(values) {
  return Object.fromEntries(VERIFICATION_KEYS
    .filter((key) => key !== "verificationReceiptSha256")
    .map((key) => [key, values[key]]));
}

function canonicalAadBytes(aadFields) {
  return Buffer.concat([
    AAD_TRANSCRIPT_PREFIX,
    Buffer.from(JSON.stringify(aadFields), "utf8"),
  ]);
}

function deriveSubkey(recoveryKey, domain, vaultBindingSha256) {
  return createHmac("sha256", recoveryKey)
    .update(domain)
    .update(Buffer.from(vaultBindingSha256, "hex"))
    .digest();
}

function deriveNonce(nonceKey, aadBytes) {
  return createHmac("sha256", nonceKey)
    .update(NONCE_TRANSCRIPT_PREFIX)
    .update(aadBytes)
    .digest()
    .subarray(0, AES_GCM_NONCE_BYTES);
}

function buildPlaintext(keyMaterial) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(keyMaterial.length);
  return Buffer.concat([PLAINTEXT_PREFIX, length, keyMaterial]);
}

function validatePlaintext(plaintext) {
  const headerLength = PLAINTEXT_PREFIX.length + 4;
  if (plaintext.length <= headerLength
    || !equalBytes(plaintext.subarray(0, PLAINTEXT_PREFIX.length), PLAINTEXT_PREFIX)) {
    throw new Error("recovery bundle plaintext has an invalid domain or shape");
  }
  const length = plaintext.readUInt32BE(PLAINTEXT_PREFIX.length);
  if (length === 0
    || length > MAX_KEY_MATERIAL_BYTES
    || plaintext.length !== headerLength + length) {
    throw new Error("recovery bundle plaintext has an invalid key-material length");
  }
  return plaintext.subarray(headerLength);
}

/**
 * Derive a public commitment from a caller-owned recovery key. The caller's
 * Buffer is not mutated; the private copy used here is zeroed after hashing.
 */
export function privacyVaultRecoveryKeyCommitmentSha256(recoveryKeyBytes) {
  const recoveryKey = copyRecoveryKey(recoveryKeyBytes);
  try {
    return sha256Bytes(RECOVERY_KEY_COMMITMENT_PREFIX, recoveryKey);
  } finally {
    recoveryKey.fill(0);
  }
}

/**
 * Derive a public commitment from opaque caller-owned Privacy Vault key bytes.
 */
export function privacyVaultKeyMaterialCommitmentSha256(keyMaterialBytes) {
  const keyMaterial = copyKeyMaterial(keyMaterialBytes);
  try {
    return sha256Bytes(KEY_MATERIAL_COMMITMENT_PREFIX, keyMaterial);
  } finally {
    keyMaterial.fill(0);
  }
}

export function validatePrivacyVaultRecoveryState(candidate) {
  const state = exactDataValues(
    candidate,
    STATE_KEYS,
    "privacy vault recovery state must have the exact canonical shape",
  );
  if (state.schema !== PRIVACY_VAULT_RECOVERY_STATE_SCHEMA
    || state.status !== PRIVACY_VAULT_RECOVERY_STATUS
    || state.mainnetStatus !== PRIVACY_VAULT_RECOVERY_MAINNET_STATUS) {
    throw new Error("privacy vault recovery state has an invalid schema or status");
  }
  asCanonicalDigest(state.vaultBindingSha256, "state.vaultBindingSha256");
  asCanonicalDigest(
    state.recoveryKeyCommitmentSha256,
    "state.recoveryKeyCommitmentSha256",
  );
  asU64Decimal(
    state.maximumBundleAgeSeconds,
    "state.maximumBundleAgeSeconds",
    { positive: true, maximum: MAX_BUNDLE_AGE_SECONDS },
  );
  asU64Decimal(
    state.maximumFutureSkewSeconds,
    "state.maximumFutureSkewSeconds",
    { maximum: MAX_FUTURE_SKEW_SECONDS },
  );
  const lastEpoch = asU64Decimal(state.lastEpoch, "state.lastEpoch");
  asCanonicalDigest(state.lastBundleSha256, "state.lastBundleSha256", {
    allowZero: lastEpoch === 0n,
  });
  asCanonicalDigest(
    state.lastKeyMaterialCommitmentSha256,
    "state.lastKeyMaterialCommitmentSha256",
    { allowZero: lastEpoch === 0n },
  );
  if (lastEpoch === 0n
    ? state.lastBundleSha256 !== ZERO_SHA256
      || state.lastKeyMaterialCommitmentSha256 !== ZERO_SHA256
    : state.lastBundleSha256 === ZERO_SHA256
      || state.lastKeyMaterialCommitmentSha256 === ZERO_SHA256) {
    throw new Error("privacy vault recovery state genesis/head fields are inconsistent");
  }
  asFalse(state.durablePersistenceVerified, "state.durablePersistenceVerified");
  asFalse(
    state.externalRollbackProtectionVerified,
    "state.externalRollbackProtectionVerified",
  );
  asFalse(state.securePlatformKeystoreVerified, "state.securePlatformKeystoreVerified");
  asFalse(
    state.onchainRuntimeIntegrationVerified,
    "state.onchainRuntimeIntegrationVerified",
  );
  asFalse(state.activationReady, "state.activationReady");
  const expectedDigest = sha256Canonical(
    "iat-b3-privacy-vault-recovery-state/v1",
    stateWithoutDigest(state),
  );
  if (state.stateSha256 !== expectedDigest) {
    throw new Error("privacy vault recovery state digest mismatch");
  }
  return candidate;
}

function createState(fields) {
  const stateWithoutSha = {
    schema: PRIVACY_VAULT_RECOVERY_STATE_SCHEMA,
    status: PRIVACY_VAULT_RECOVERY_STATUS,
    ...fields,
    durablePersistenceVerified: false,
    externalRollbackProtectionVerified: false,
    securePlatformKeystoreVerified: false,
    onchainRuntimeIntegrationVerified: false,
    activationReady: false,
    mainnetStatus: PRIVACY_VAULT_RECOVERY_MAINNET_STATUS,
  };
  const state = freezeRecord({
    ...stateWithoutSha,
    stateSha256: sha256Canonical(
      "iat-b3-privacy-vault-recovery-state/v1",
      stateWithoutSha,
    ),
  });
  validatePrivacyVaultRecoveryState(state);
  return state;
}

export function createPrivacyVaultRecoveryGenesisState(candidate) {
  const input = exactDataValues(
    candidate,
    GENESIS_INPUT_KEYS,
    "privacy vault recovery genesis input must have the exact canonical shape",
  );
  asCanonicalDigest(input.vaultBindingSha256, "vaultBindingSha256");
  asCanonicalDigest(
    input.recoveryKeyCommitmentSha256,
    "recoveryKeyCommitmentSha256",
  );
  asU64Decimal(
    input.maximumBundleAgeSeconds,
    "maximumBundleAgeSeconds",
    { positive: true, maximum: MAX_BUNDLE_AGE_SECONDS },
  );
  asU64Decimal(
    input.maximumFutureSkewSeconds,
    "maximumFutureSkewSeconds",
    { maximum: MAX_FUTURE_SKEW_SECONDS },
  );
  return createState({
    ...input,
    lastEpoch: "0",
    lastBundleSha256: ZERO_SHA256,
    lastKeyMaterialCommitmentSha256: ZERO_SHA256,
  });
}

export function validatePrivacyVaultRecoveryBundle(candidate) {
  const bundle = exactDataValues(
    candidate,
    BUNDLE_KEYS,
    "privacy vault recovery bundle must have the exact canonical shape",
  );
  if (bundle.schema !== PRIVACY_VAULT_RECOVERY_BUNDLE_SCHEMA
    || bundle.status !== PRIVACY_VAULT_RECOVERY_STATUS
    || bundle.cipher !== PRIVACY_VAULT_RECOVERY_CIPHER
    || bundle.keyDerivation !== PRIVACY_VAULT_RECOVERY_KEY_DERIVATION
    || bundle.nonceDerivation !== PRIVACY_VAULT_RECOVERY_NONCE_DERIVATION
    || bundle.mainnetStatus !== PRIVACY_VAULT_RECOVERY_MAINNET_STATUS) {
    throw new Error("privacy vault recovery bundle has an invalid schema or algorithm");
  }
  asCanonicalDigest(bundle.vaultBindingSha256, "bundle.vaultBindingSha256");
  asCanonicalDigest(
    bundle.recoveryKeyCommitmentSha256,
    "bundle.recoveryKeyCommitmentSha256",
  );
  asCanonicalDigest(bundle.stateBeforeSha256, "bundle.stateBeforeSha256");
  const epoch = asU64Decimal(bundle.epoch, "bundle.epoch", { positive: true });
  asCanonicalDigest(
    bundle.previousBundleSha256,
    "bundle.previousBundleSha256",
    { allowZero: bundle.epoch === "1" },
  );
  asCanonicalDigest(
    bundle.previousKeyMaterialCommitmentSha256,
    "bundle.previousKeyMaterialCommitmentSha256",
    { allowZero: bundle.epoch === "1" },
  );
  if (epoch === 1n
    ? bundle.previousBundleSha256 !== ZERO_SHA256
      || bundle.previousKeyMaterialCommitmentSha256 !== ZERO_SHA256
    : bundle.previousBundleSha256 === ZERO_SHA256
      || bundle.previousKeyMaterialCommitmentSha256 === ZERO_SHA256) {
    throw new Error("privacy vault recovery bundle predecessor fields are inconsistent");
  }
  asCanonicalDigest(
    bundle.keyMaterialCommitmentSha256,
    "bundle.keyMaterialCommitmentSha256",
  );
  const materialLength = asU64Decimal(
    bundle.keyMaterialByteLength,
    "bundle.keyMaterialByteLength",
    { positive: true, maximum: BigInt(MAX_KEY_MATERIAL_BYTES) },
  );
  const created = asU64Decimal(bundle.createdAtUnixSeconds, "bundle.createdAtUnixSeconds");
  const expires = asU64Decimal(bundle.expiresAtUnixSeconds, "bundle.expiresAtUnixSeconds");
  if (expires <= created) throw new Error("privacy vault recovery bundle must expire after creation");
  for (const flag of [
    "walletSignatureDerivationVerified",
    "token2022ElGamalKeypairVerified",
    "securePlatformKeystoreVerified",
    "durablePersistenceVerified",
    "externalRollbackProtectionVerified",
    "onchainRuntimeIntegrationVerified",
    "activationReady",
  ]) asFalse(bundle[flag], `bundle.${flag}`);
  asCanonicalDigest(bundle.aadSha256, "bundle.aadSha256");
  const nonce = exactBase64url(
    bundle.nonceBase64url,
    "bundle.nonceBase64url",
    AES_GCM_NONCE_BYTES,
  );
  const ciphertext = exactBase64url(
    bundle.ciphertextBase64url,
    "bundle.ciphertextBase64url",
    Number(materialLength) + PLAINTEXT_PREFIX.length + 4,
  );
  const tag = exactBase64url(
    bundle.authenticationTagBase64url,
    "bundle.authenticationTagBase64url",
    AES_GCM_TAG_BYTES,
  );
  nonce.fill(0);
  ciphertext.fill(0);
  tag.fill(0);
  const aadFields = bundleAadFields(bundle);
  const aadBytes = canonicalAadBytes(aadFields);
  try {
    const expectedAadSha256 = sha256Bytes(aadBytes);
    if (bundle.aadSha256 !== expectedAadSha256) {
      throw new Error("privacy vault recovery bundle AAD digest mismatch");
    }
  } finally {
    aadBytes.fill(0);
  }
  const expectedBundleSha256 = sha256Canonical(
    "iat-b3-privacy-vault-recovery-bundle/v1",
    bundleWithoutDigest(bundle),
  );
  if (bundle.bundleSha256 !== expectedBundleSha256) {
    throw new Error("privacy vault recovery bundle digest mismatch");
  }
  return candidate;
}

export function sealPrivacyVaultRecoveryBundle(candidate) {
  const input = exactDataValues(
    candidate,
    SEAL_INPUT_KEYS,
    "privacy vault recovery seal input must have the exact canonical shape",
  );
  const state = validatePrivacyVaultRecoveryState(input.currentState);
  const created = asInstant(input.createdAtUnixSeconds, "createdAtUnixSeconds");
  const expires = asInstant(input.expiresAtUnixSeconds, "expiresAtUnixSeconds");
  const maximumAge = BigInt(state.maximumBundleAgeSeconds);
  if (expires <= created || expires - created > maximumAge) {
    throw new Error("privacy vault recovery bundle lifetime exceeds the configured maximum");
  }
  if (BigInt(state.lastEpoch) === U64_MAX) {
    throw new RangeError("privacy vault recovery epoch is exhausted");
  }

  const recoveryKey = copyRecoveryKey(input.recoveryKeyBytes);
  const keyMaterial = copyKeyMaterial(input.keyMaterialBytes);
  let plaintext;
  let aadBytes;
  let nonce;
  let encryptionKey;
  let nonceKey;
  try {
    const recoveryKeyCommitment = sha256Bytes(
      RECOVERY_KEY_COMMITMENT_PREFIX,
      recoveryKey,
    );
    if (!equalDigest(recoveryKeyCommitment, state.recoveryKeyCommitmentSha256)) {
      throw new Error("recovery key does not match the state commitment");
    }
    const keyMaterialCommitment = sha256Bytes(
      KEY_MATERIAL_COMMITMENT_PREFIX,
      keyMaterial,
    );
    encryptionKey = deriveSubkey(
      recoveryKey,
      ENCRYPTION_SUBKEY_PREFIX,
      state.vaultBindingSha256,
    );
    nonceKey = deriveSubkey(
      recoveryKey,
      NONCE_SUBKEY_PREFIX,
      state.vaultBindingSha256,
    );
    const aadFields = {
      schema: PRIVACY_VAULT_RECOVERY_BUNDLE_SCHEMA,
      status: PRIVACY_VAULT_RECOVERY_STATUS,
      cipher: PRIVACY_VAULT_RECOVERY_CIPHER,
      keyDerivation: PRIVACY_VAULT_RECOVERY_KEY_DERIVATION,
      nonceDerivation: PRIVACY_VAULT_RECOVERY_NONCE_DERIVATION,
      vaultBindingSha256: state.vaultBindingSha256,
      recoveryKeyCommitmentSha256: state.recoveryKeyCommitmentSha256,
      stateBeforeSha256: state.stateSha256,
      epoch: (BigInt(state.lastEpoch) + 1n).toString(),
      previousBundleSha256: state.lastBundleSha256,
      previousKeyMaterialCommitmentSha256: state.lastKeyMaterialCommitmentSha256,
      keyMaterialCommitmentSha256: keyMaterialCommitment,
      keyMaterialByteLength: keyMaterial.length.toString(),
      createdAtUnixSeconds: created.toString(),
      expiresAtUnixSeconds: expires.toString(),
      walletSignatureDerivationVerified: false,
      token2022ElGamalKeypairVerified: false,
      securePlatformKeystoreVerified: false,
      durablePersistenceVerified: false,
      externalRollbackProtectionVerified: false,
      onchainRuntimeIntegrationVerified: false,
      activationReady: false,
      mainnetStatus: PRIVACY_VAULT_RECOVERY_MAINNET_STATUS,
    };
    aadBytes = canonicalAadBytes(aadFields);
    nonce = deriveNonce(nonceKey, aadBytes);
    plaintext = buildPlaintext(keyMaterial);
    const cipher = createCipheriv(PRIVACY_VAULT_RECOVERY_CIPHER.toLowerCase(), encryptionKey, nonce, {
      authTagLength: AES_GCM_TAG_BYTES,
    });
    cipher.setAAD(aadBytes);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authenticationTag = cipher.getAuthTag();
    const withoutDigest = {
      ...aadFields,
      aadSha256: sha256Bytes(aadBytes),
      nonceBase64url: nonce.toString("base64url"),
      ciphertextBase64url: ciphertext.toString("base64url"),
      authenticationTagBase64url: authenticationTag.toString("base64url"),
    };
    const bundle = freezeRecord({
      ...withoutDigest,
      bundleSha256: sha256Canonical(
        "iat-b3-privacy-vault-recovery-bundle/v1",
        withoutDigest,
      ),
    });
    ciphertext.fill(0);
    authenticationTag.fill(0);
    validatePrivacyVaultRecoveryBundle(bundle);
    return bundle;
  } finally {
    recoveryKey.fill(0);
    keyMaterial.fill(0);
    plaintext?.fill(0);
    aadBytes?.fill(0);
    nonce?.fill(0);
    encryptionKey?.fill(0);
    nonceKey?.fill(0);
  }
}

export function verifyPrivacyVaultRecoveryBundle(candidate) {
  const input = exactDataValues(
    candidate,
    VERIFY_INPUT_KEYS,
    "privacy vault recovery verification input must have the exact canonical shape",
  );
  const state = validatePrivacyVaultRecoveryState(input.currentState);
  const bundle = validatePrivacyVaultRecoveryBundle(input.bundle);
  const expectedCommitment = asCanonicalDigest(
    input.expectedKeyMaterialCommitmentSha256,
    "expectedKeyMaterialCommitmentSha256",
  );
  const evaluation = asInstant(input.evaluationUnixSeconds, "evaluationUnixSeconds");

  if (bundle.vaultBindingSha256 !== state.vaultBindingSha256
    || bundle.recoveryKeyCommitmentSha256 !== state.recoveryKeyCommitmentSha256
    || bundle.stateBeforeSha256 !== state.stateSha256) {
    throw new Error("recovery bundle does not bind the supplied current state");
  }
  const expectedEpoch = BigInt(state.lastEpoch) + 1n;
  if (expectedEpoch > U64_MAX || bundle.epoch !== expectedEpoch.toString()) {
    throw new Error("recovery bundle epoch is not contiguous");
  }
  if (bundle.previousBundleSha256 !== state.lastBundleSha256
    || bundle.previousKeyMaterialCommitmentSha256
      !== state.lastKeyMaterialCommitmentSha256) {
    throw new Error("recovery bundle predecessor does not match the current state");
  }
  if (bundle.keyMaterialCommitmentSha256 !== expectedCommitment) {
    throw new Error("recovery bundle does not match the expected key-material commitment");
  }
  const created = BigInt(bundle.createdAtUnixSeconds);
  const expires = BigInt(bundle.expiresAtUnixSeconds);
  const skew = BigInt(state.maximumFutureSkewSeconds);
  const maximumAge = BigInt(state.maximumBundleAgeSeconds);
  if (expires - created > maximumAge
    || evaluation > expires
    || created > evaluation + skew) {
    throw new Error("recovery bundle is expired, premature, or exceeds the configured age");
  }

  const recoveryKey = copyRecoveryKey(input.recoveryKeyBytes);
  let aadBytes;
  let expectedNonce;
  let nonce;
  let ciphertext;
  let authenticationTag;
  let firstPlaintextChunk;
  let finalPlaintextChunk;
  let plaintext;
  let encryptionKey;
  let nonceKey;
  try {
    const recoveryKeyCommitment = sha256Bytes(
      RECOVERY_KEY_COMMITMENT_PREFIX,
      recoveryKey,
    );
    if (!equalDigest(recoveryKeyCommitment, state.recoveryKeyCommitmentSha256)) {
      throw new Error("recovery key does not match the state commitment");
    }
    encryptionKey = deriveSubkey(
      recoveryKey,
      ENCRYPTION_SUBKEY_PREFIX,
      state.vaultBindingSha256,
    );
    nonceKey = deriveSubkey(
      recoveryKey,
      NONCE_SUBKEY_PREFIX,
      state.vaultBindingSha256,
    );
    aadBytes = canonicalAadBytes(bundleAadFields(bundle));
    expectedNonce = deriveNonce(nonceKey, aadBytes);
    nonce = exactBase64url(
      bundle.nonceBase64url,
      "bundle.nonceBase64url",
      AES_GCM_NONCE_BYTES,
    );
    if (!equalBytes(expectedNonce, nonce)) {
      throw new Error("recovery bundle deterministic nonce mismatch");
    }
    ciphertext = exactBase64url(bundle.ciphertextBase64url, "bundle.ciphertextBase64url");
    authenticationTag = exactBase64url(
      bundle.authenticationTagBase64url,
      "bundle.authenticationTagBase64url",
      AES_GCM_TAG_BYTES,
    );
    const decipher = createDecipheriv(
      PRIVACY_VAULT_RECOVERY_CIPHER.toLowerCase(),
      encryptionKey,
      nonce,
      { authTagLength: AES_GCM_TAG_BYTES },
    );
    decipher.setAAD(aadBytes);
    decipher.setAuthTag(authenticationTag);
    try {
      firstPlaintextChunk = decipher.update(ciphertext);
      finalPlaintextChunk = decipher.final();
    } catch {
      throw new Error("recovery bundle AES-256-GCM authentication failed");
    }
    plaintext = Buffer.concat([firstPlaintextChunk, finalPlaintextChunk]);
    const keyMaterial = validatePlaintext(plaintext);
    if (keyMaterial.length.toString() !== bundle.keyMaterialByteLength) {
      throw new Error("recovered key-material length does not match the bundle");
    }
    const recoveredCommitment = sha256Bytes(
      KEY_MATERIAL_COMMITMENT_PREFIX,
      keyMaterial,
    );
    if (!equalDigest(recoveredCommitment, expectedCommitment)) {
      throw new Error("recovered key material does not match the expected commitment");
    }

    const stateAfter = createState({
      vaultBindingSha256: state.vaultBindingSha256,
      recoveryKeyCommitmentSha256: state.recoveryKeyCommitmentSha256,
      maximumBundleAgeSeconds: state.maximumBundleAgeSeconds,
      maximumFutureSkewSeconds: state.maximumFutureSkewSeconds,
      lastEpoch: bundle.epoch,
      lastBundleSha256: bundle.bundleSha256,
      lastKeyMaterialCommitmentSha256: bundle.keyMaterialCommitmentSha256,
    });
    const receiptWithoutDigest = {
      schema: PRIVACY_VAULT_RECOVERY_VERIFICATION_SCHEMA,
      status: PRIVACY_VAULT_RECOVERY_STATUS,
      vaultBindingSha256: state.vaultBindingSha256,
      recoveryKeyCommitmentSha256: state.recoveryKeyCommitmentSha256,
      epoch: bundle.epoch,
      bundleSha256: bundle.bundleSha256,
      stateBeforeSha256: state.stateSha256,
      stateAfter,
      expectedKeyMaterialCommitmentSha256: expectedCommitment,
      canonicalBundleVerified: true,
      aes256GcmAuthenticationVerified: true,
      deterministicNonceVerified: true,
      keyMaterialCommitmentVerified: true,
      contiguousEpochVerified: true,
      predecessorBundleVerified: true,
      plaintextExported: false,
      walletSignatureDerivationVerified: false,
      token2022ElGamalKeypairVerified: false,
      securePlatformKeystoreVerified: false,
      durablePersistenceVerified: false,
      externalRollbackProtectionVerified: false,
      onchainRuntimeIntegrationVerified: false,
      falseZeroUiPreventionVerified: false,
      privacyLegalReviewAccepted: false,
      devnetLifecycleVerified: false,
      activationReady: false,
      mainnetStatus: PRIVACY_VAULT_RECOVERY_MAINNET_STATUS,
    };
    const receipt = freezeRecord({
      ...receiptWithoutDigest,
      verificationReceiptSha256: sha256Canonical(
        "iat-b3-privacy-vault-recovery-verification/v1",
        receiptWithoutDigest,
      ),
    });
    EXECUTED_VERIFICATION_RECEIPTS.add(receipt);
    validatePrivacyVaultRecoveryVerificationReceipt(receipt);
    return receipt;
  } finally {
    recoveryKey.fill(0);
    aadBytes?.fill(0);
    expectedNonce?.fill(0);
    nonce?.fill(0);
    ciphertext?.fill(0);
    authenticationTag?.fill(0);
    firstPlaintextChunk?.fill(0);
    finalPlaintextChunk?.fill(0);
    plaintext?.fill(0);
    encryptionKey?.fill(0);
    nonceKey?.fill(0);
  }
}

export function validatePrivacyVaultRecoveryVerificationReceipt(candidate) {
  if (!EXECUTED_VERIFICATION_RECEIPTS.has(candidate)) {
    throw new Error(
      "privacy vault recovery verification receipt was not issued by this process",
    );
  }
  const receipt = exactDataValues(
    candidate,
    VERIFICATION_KEYS,
    "privacy vault recovery verification receipt must have the exact canonical shape",
  );
  if (receipt.schema !== PRIVACY_VAULT_RECOVERY_VERIFICATION_SCHEMA
    || receipt.status !== PRIVACY_VAULT_RECOVERY_STATUS
    || receipt.mainnetStatus !== PRIVACY_VAULT_RECOVERY_MAINNET_STATUS) {
    throw new Error("privacy vault recovery verification receipt has an invalid status");
  }
  asCanonicalDigest(receipt.vaultBindingSha256, "receipt.vaultBindingSha256");
  asCanonicalDigest(
    receipt.recoveryKeyCommitmentSha256,
    "receipt.recoveryKeyCommitmentSha256",
  );
  asU64Decimal(receipt.epoch, "receipt.epoch", { positive: true });
  asCanonicalDigest(receipt.bundleSha256, "receipt.bundleSha256");
  asCanonicalDigest(receipt.stateBeforeSha256, "receipt.stateBeforeSha256");
  asCanonicalDigest(
    receipt.expectedKeyMaterialCommitmentSha256,
    "receipt.expectedKeyMaterialCommitmentSha256",
  );
  validatePrivacyVaultRecoveryState(receipt.stateAfter);
  for (const flag of [
    "canonicalBundleVerified",
    "aes256GcmAuthenticationVerified",
    "deterministicNonceVerified",
    "keyMaterialCommitmentVerified",
    "contiguousEpochVerified",
    "predecessorBundleVerified",
  ]) {
    if (receipt[flag] !== true) throw new Error(`receipt.${flag} must be true`);
  }
  for (const flag of [
    "plaintextExported",
    "walletSignatureDerivationVerified",
    "token2022ElGamalKeypairVerified",
    "securePlatformKeystoreVerified",
    "durablePersistenceVerified",
    "externalRollbackProtectionVerified",
    "onchainRuntimeIntegrationVerified",
    "falseZeroUiPreventionVerified",
    "privacyLegalReviewAccepted",
    "devnetLifecycleVerified",
    "activationReady",
  ]) asFalse(receipt[flag], `receipt.${flag}`);
  if (receipt.stateAfter.lastEpoch !== receipt.epoch
    || receipt.stateAfter.lastBundleSha256 !== receipt.bundleSha256
    || receipt.stateAfter.lastKeyMaterialCommitmentSha256
      !== receipt.expectedKeyMaterialCommitmentSha256) {
    throw new Error("privacy vault recovery verification receipt state is inconsistent");
  }
  const expectedDigest = sha256Canonical(
    "iat-b3-privacy-vault-recovery-verification/v1",
    verificationWithoutDigest(receipt),
  );
  if (receipt.verificationReceiptSha256 !== expectedDigest) {
    throw new Error("privacy vault recovery verification receipt digest mismatch");
  }
  return candidate;
}

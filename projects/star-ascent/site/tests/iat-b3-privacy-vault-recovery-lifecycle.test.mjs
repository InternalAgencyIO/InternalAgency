import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";

import {
  PRIVACY_VAULT_RECOVERY_BUNDLE_SCHEMA,
  PRIVACY_VAULT_RECOVERY_CIPHER,
  PRIVACY_VAULT_RECOVERY_KEY_DERIVATION,
  PRIVACY_VAULT_RECOVERY_MAINNET_STATUS,
  PRIVACY_VAULT_RECOVERY_NONCE_DERIVATION,
  PRIVACY_VAULT_RECOVERY_STATE_SCHEMA,
  PRIVACY_VAULT_RECOVERY_STATUS,
  PRIVACY_VAULT_RECOVERY_VERIFICATION_SCHEMA,
  createPrivacyVaultRecoveryGenesisState,
  privacyVaultKeyMaterialCommitmentSha256,
  privacyVaultRecoveryKeyCommitmentSha256,
  sealPrivacyVaultRecoveryBundle,
  validatePrivacyVaultRecoveryBundle,
  validatePrivacyVaultRecoveryState,
  validatePrivacyVaultRecoveryVerificationReceipt,
  verifyPrivacyVaultRecoveryBundle,
} from "../programs/iat_b3_reference/privacy-vault-recovery-lifecycle.mjs";

const NOW = 2_000_000_000n;
const ZERO_SHA256 = "0".repeat(64);
const AAD_PREFIX = Buffer.from(
  "IAT_B3_PRIVACY_VAULT_RECOVERY_AAD_V1\0",
  "utf8",
);
const AAD_KEYS = [
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
];

function sha256(...values) {
  const hash = createHash("sha256");
  for (const value of values) hash.update(value);
  return hash.digest("hex");
}

function digest(label) {
  return sha256(Buffer.from(`iat-b3-privacy-vault-recovery-test:${label}`, "utf8"));
}

function sha256Canonical(domain, value) {
  return sha256(Buffer.from(JSON.stringify({ domain, value }), "utf8"));
}

function createContext({
  recoveryKey = randomBytes(32),
  keyMaterial = Buffer.from(
    "opaque-wallet-derived-elgamal-and-aes-recovery-material-v1",
    "utf8",
  ),
  maximumBundleAgeSeconds = "600",
  maximumFutureSkewSeconds = "30",
} = {}) {
  const state = createPrivacyVaultRecoveryGenesisState({
    vaultBindingSha256: digest("vault-binding"),
    recoveryKeyCommitmentSha256:
      privacyVaultRecoveryKeyCommitmentSha256(recoveryKey),
    maximumBundleAgeSeconds,
    maximumFutureSkewSeconds,
  });
  return {
    recoveryKey,
    keyMaterial,
    expectedCommitment:
      privacyVaultKeyMaterialCommitmentSha256(keyMaterial),
    state,
  };
}

function seal(context, overrides = {}) {
  return sealPrivacyVaultRecoveryBundle({
    currentState: context.state,
    recoveryKeyBytes: context.recoveryKey,
    keyMaterialBytes: context.keyMaterial,
    createdAtUnixSeconds: NOW - 5n,
    expiresAtUnixSeconds: NOW + 300n,
    ...overrides,
  });
}

function verify(context, bundle, overrides = {}) {
  return verifyPrivacyVaultRecoveryBundle({
    currentState: context.state,
    bundle,
    recoveryKeyBytes: context.recoveryKey,
    expectedKeyMaterialCommitmentSha256: context.expectedCommitment,
    evaluationUnixSeconds: NOW,
    ...overrides,
  });
}

function rehashBundle(bundle, overrides = {}, { rehashAad = false } = {}) {
  const next = { ...bundle, ...overrides };
  if (rehashAad) {
    const aad = Object.fromEntries(AAD_KEYS.map((key) => [key, next[key]]));
    next.aadSha256 = sha256(
      AAD_PREFIX,
      Buffer.from(JSON.stringify(aad), "utf8"),
    );
  }
  const withoutDigest = Object.fromEntries(
    Object.entries(next).filter(([key]) => key !== "bundleSha256"),
  );
  next.bundleSha256 = sha256Canonical(
    "iat-b3-privacy-vault-recovery-bundle/v1",
    withoutDigest,
  );
  return next;
}

function flipBase64url(value, offset = 0) {
  const bytes = Buffer.from(value, "base64url");
  bytes[offset] ^= 1;
  return bytes.toString("base64url");
}

test("canonical encrypted recovery round trip advances only host-local state", () => {
  const context = createContext();
  const recoveryKeyBefore = Buffer.from(context.recoveryKey);
  const keyMaterialBefore = Buffer.from(context.keyMaterial);
  const bundle = seal(context);
  const receipt = verify(context, bundle);

  assert.equal(context.state.schema, PRIVACY_VAULT_RECOVERY_STATE_SCHEMA);
  assert.equal(bundle.schema, PRIVACY_VAULT_RECOVERY_BUNDLE_SCHEMA);
  assert.equal(receipt.schema, PRIVACY_VAULT_RECOVERY_VERIFICATION_SCHEMA);
  assert.equal(bundle.status, PRIVACY_VAULT_RECOVERY_STATUS);
  assert.equal(bundle.cipher, PRIVACY_VAULT_RECOVERY_CIPHER);
  assert.equal(bundle.keyDerivation, PRIVACY_VAULT_RECOVERY_KEY_DERIVATION);
  assert.equal(bundle.nonceDerivation, PRIVACY_VAULT_RECOVERY_NONCE_DERIVATION);
  assert.equal(bundle.mainnetStatus, PRIVACY_VAULT_RECOVERY_MAINNET_STATUS);
  assert.equal(receipt.mainnetStatus, PRIVACY_VAULT_RECOVERY_MAINNET_STATUS);
  assert.equal(receipt.epoch, "1");
  assert.equal(receipt.stateAfter.lastEpoch, "1");
  assert.equal(receipt.stateAfter.lastBundleSha256, bundle.bundleSha256);
  assert.equal(
    receipt.stateAfter.lastKeyMaterialCommitmentSha256,
    context.expectedCommitment,
  );
  for (const flag of [
    "canonicalBundleVerified",
    "aes256GcmAuthenticationVerified",
    "deterministicNonceVerified",
    "keyMaterialCommitmentVerified",
    "contiguousEpochVerified",
    "predecessorBundleVerified",
  ]) assert.equal(receipt[flag], true, flag);
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
  ]) assert.equal(receipt[flag], false, flag);
  assert.equal(validatePrivacyVaultRecoveryState(context.state), context.state);
  assert.equal(validatePrivacyVaultRecoveryBundle(bundle), bundle);
  assert.equal(
    validatePrivacyVaultRecoveryVerificationReceipt(receipt),
    receipt,
  );
  assert.equal(Object.isFrozen(context.state), true);
  assert.equal(Object.isFrozen(bundle), true);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.stateAfter), true);
  assert.deepEqual(context.recoveryKey, recoveryKeyBefore);
  assert.deepEqual(context.keyMaterial, keyMaterialBefore);
});

test("encrypted artifact and receipt never export plaintext or secret fields", () => {
  const context = createContext({
    keyMaterial: Buffer.from(
      "unique-private-recovery-material-that-must-never-be-exported-9c6d",
      "utf8",
    ),
  });
  const bundle = seal(context);
  const receipt = verify(context, bundle);
  const serialized = JSON.stringify({ bundle, receipt });

  assert.equal(serialized.includes(context.keyMaterial.toString("utf8")), false);
  assert.equal(serialized.includes(context.keyMaterial.toString("hex")), false);
  assert.equal(serialized.includes(context.keyMaterial.toString("base64url")), false);
  assert.equal(serialized.includes(context.recoveryKey.toString("hex")), false);
  for (const forbidden of [
    "keyMaterialBytes",
    "recoveryKeyBytes",
    "privateKey",
    "secretKey",
    "decryptedKeyMaterial",
    "plaintextBase64url",
  ]) assert.equal(serialized.includes(`\"${forbidden}\"`), false, forbidden);
});

test("same state, material, key, and timestamps deterministically reproduce one bundle", () => {
  const context = createContext();
  assert.deepEqual(seal(context), seal(context));
});

test("vault-bound subkeys separate otherwise identical recovery snapshots", () => {
  const first = createContext();
  const second = {
    ...first,
    state: createPrivacyVaultRecoveryGenesisState({
      vaultBindingSha256: digest("different-vault-binding"),
      recoveryKeyCommitmentSha256: first.state.recoveryKeyCommitmentSha256,
      maximumBundleAgeSeconds: first.state.maximumBundleAgeSeconds,
      maximumFutureSkewSeconds: first.state.maximumFutureSkewSeconds,
    }),
  };
  const firstBundle = seal(first);
  const secondBundle = seal(second);
  assert.notEqual(firstBundle.nonceBase64url, secondBundle.nonceBase64url);
  assert.notEqual(firstBundle.ciphertextBase64url, secondBundle.ciphertextBase64url);
});

test("a rotated opaque key-material snapshot binds the prior verified head", () => {
  const firstContext = createContext();
  const firstBundle = seal(firstContext);
  const firstReceipt = verify(firstContext, firstBundle);
  const rotatedMaterial = Buffer.from("opaque-rotated-recovery-material-v2", "utf8");
  const secondContext = {
    ...firstContext,
    state: firstReceipt.stateAfter,
    keyMaterial: rotatedMaterial,
    expectedCommitment:
      privacyVaultKeyMaterialCommitmentSha256(rotatedMaterial),
  };
  const secondBundle = seal(secondContext, {
    createdAtUnixSeconds: NOW + 1n,
    expiresAtUnixSeconds: NOW + 301n,
  });
  const secondReceipt = verify(secondContext, secondBundle, {
    evaluationUnixSeconds: NOW + 2n,
  });

  assert.equal(secondBundle.epoch, "2");
  assert.equal(secondBundle.previousBundleSha256, firstBundle.bundleSha256);
  assert.equal(
    secondBundle.previousKeyMaterialCommitmentSha256,
    firstContext.expectedCommitment,
  );
  assert.equal(secondReceipt.stateAfter.lastEpoch, "2");
});

test("wrong recovery key and wrong expected material commitment fail closed", () => {
  const context = createContext();
  const bundle = seal(context);
  assert.throws(
    () => verify(context, bundle, { recoveryKeyBytes: randomBytes(32) }),
    /recovery key does not match/u,
  );
  assert.throws(
    () => verify(context, bundle, {
      expectedKeyMaterialCommitmentSha256: digest("different-material"),
    }),
    /expected key-material commitment/u,
  );
});

test("canonical ciphertext and authentication-tag tampering reaches and fails AEAD", async (t) => {
  const context = createContext();
  const bundle = seal(context);
  for (const [label, field] of [
    ["ciphertext", "ciphertextBase64url"],
    ["authentication tag", "authenticationTagBase64url"],
  ]) {
    await t.test(label, () => {
      const tampered = rehashBundle(bundle, {
        [field]: flipBase64url(bundle[field]),
      });
      assert.equal(validatePrivacyVaultRecoveryBundle(tampered), tampered);
      assert.throws(
        () => verify(context, tampered),
        /AES-256-GCM authentication failed/u,
      );
    });
  }
});

test("canonical nonce tampering fails deterministic derivation before decrypt", () => {
  const context = createContext();
  const bundle = seal(context);
  const tampered = rehashBundle(bundle, {
    nonceBase64url: flipBase64url(bundle.nonceBase64url),
  });
  assert.equal(validatePrivacyVaultRecoveryBundle(tampered), tampered);
  assert.throws(() => verify(context, tampered), /deterministic nonce mismatch/u);
});

test("AAD mutation cannot be authenticated even with recomputed public digests", () => {
  const context = createContext();
  const bundle = seal(context);
  const differentCommitment = digest("substituted-key-material");
  const tampered = rehashBundle(
    bundle,
    { keyMaterialCommitmentSha256: differentCommitment },
    { rehashAad: true },
  );
  assert.equal(validatePrivacyVaultRecoveryBundle(tampered), tampered);
  assert.throws(
    () => verify(context, tampered, {
      expectedKeyMaterialCommitmentSha256: differentCommitment,
    }),
    /deterministic nonce mismatch/u,
  );
});

test("stale bundle digest or AAD digest is rejected structurally", () => {
  const context = createContext();
  const bundle = seal(context);
  assert.throws(
    () => validatePrivacyVaultRecoveryBundle({
      ...bundle,
      ciphertextBase64url: flipBase64url(bundle.ciphertextBase64url),
    }),
    /bundle digest mismatch/u,
  );
  assert.throws(
    () => validatePrivacyVaultRecoveryBundle(rehashBundle(bundle, {
      aadSha256: digest("incorrect-aad"),
    })),
    /AAD digest mismatch/u,
  );
});

test("replay, skipped epoch, forked predecessor, and supplied-state rollback fail", async (t) => {
  const context = createContext();
  const firstBundle = seal(context);
  const firstReceipt = verify(context, firstBundle);
  const advanced = { ...context, state: firstReceipt.stateAfter };

  await t.test("replay against advanced state", () => {
    assert.throws(
      () => verify(advanced, firstBundle),
      /does not bind the supplied current state/u,
    );
  });
  await t.test("skipped epoch", () => {
    const skipped = rehashBundle(
      firstBundle,
      {
        epoch: "2",
        previousBundleSha256: digest("synthetic-prior-bundle"),
        previousKeyMaterialCommitmentSha256: digest("synthetic-prior-key"),
      },
      { rehashAad: true },
    );
    assert.throws(() => verify(context, skipped), /epoch is not contiguous/u);
  });
  await t.test("forked predecessor", () => {
    const secondContext = { ...context, state: firstReceipt.stateAfter };
    const secondBundle = seal(secondContext, {
      createdAtUnixSeconds: NOW + 1n,
      expiresAtUnixSeconds: NOW + 301n,
    });
    const forked = rehashBundle(
      secondBundle,
      { previousBundleSha256: digest("forked-head") },
      { rehashAad: true },
    );
    assert.throws(
      () => verify(secondContext, forked, { evaluationUnixSeconds: NOW + 2n }),
      /predecessor does not match/u,
    );
  });
  await t.test("different supplied state policy", () => {
    const alternateState = createPrivacyVaultRecoveryGenesisState({
      vaultBindingSha256: context.state.vaultBindingSha256,
      recoveryKeyCommitmentSha256: context.state.recoveryKeyCommitmentSha256,
      maximumBundleAgeSeconds: context.state.maximumBundleAgeSeconds,
      maximumFutureSkewSeconds: "29",
    });
    assert.throws(
      () => verify({ ...context, state: alternateState }, firstBundle),
      /does not bind the supplied current state/u,
    );
  });
});

test("expiry, future issuance, and maximum lifetime are enforced", async (t) => {
  const context = createContext({
    maximumBundleAgeSeconds: "60",
    maximumFutureSkewSeconds: "5",
  });
  await t.test("expired", () => {
    const bundle = seal(context, {
      createdAtUnixSeconds: NOW - 60n,
      expiresAtUnixSeconds: NOW,
    });
    assert.throws(
      () => verify(context, bundle, { evaluationUnixSeconds: NOW + 1n }),
      /expired, premature/u,
    );
  });
  await t.test("future beyond skew", () => {
    const bundle = seal(context, {
      createdAtUnixSeconds: NOW + 6n,
      expiresAtUnixSeconds: NOW + 60n,
    });
    assert.throws(() => verify(context, bundle), /expired, premature/u);
  });
  await t.test("future at skew boundary", () => {
    const bundle = seal(context, {
      createdAtUnixSeconds: NOW + 5n,
      expiresAtUnixSeconds: NOW + 60n,
    });
    assert.equal(verify(context, bundle).aes256GcmAuthenticationVerified, true);
  });
  await t.test("lifetime beyond configured maximum", () => {
    assert.throws(
      () => seal(context, {
        createdAtUnixSeconds: NOW,
        expiresAtUnixSeconds: NOW + 61n,
      }),
      /lifetime exceeds/u,
    );
  });
});

test("malformed, zero, placeholder, and oversized inputs fail closed", async (t) => {
  const key = randomBytes(32);
  const validGenesis = {
    vaultBindingSha256: digest("vault-binding"),
    recoveryKeyCommitmentSha256: privacyVaultRecoveryKeyCommitmentSha256(key),
    maximumBundleAgeSeconds: "600",
    maximumFutureSkewSeconds: "30",
  };
  const cases = [
    ["zero vault binding", { ...validGenesis, vaultBindingSha256: ZERO_SHA256 }],
    ["placeholder vault binding", {
      ...validGenesis,
      vaultBindingSha256: "ab".repeat(32),
    }],
    ["malformed recovery commitment", {
      ...validGenesis,
      recoveryKeyCommitmentSha256: "ABC",
    }],
    ["zero age", { ...validGenesis, maximumBundleAgeSeconds: "0" }],
    ["noncanonical age", { ...validGenesis, maximumBundleAgeSeconds: "0600" }],
    ["excessive age", {
      ...validGenesis,
      maximumBundleAgeSeconds: "2592001",
    }],
    ["excessive skew", {
      ...validGenesis,
      maximumFutureSkewSeconds: "3601",
    }],
  ];
  for (const [label, value] of cases) {
    await t.test(label, () => assert.throws(
      () => createPrivacyVaultRecoveryGenesisState(value),
    ));
  }

  const context = createContext();
  assert.throws(
    () => seal(context, { recoveryKeyBytes: Buffer.alloc(31) }),
    /exact 32-byte Buffer/u,
  );
  assert.throws(
    () => privacyVaultRecoveryKeyCommitmentSha256(Buffer.alloc(32)),
    /placeholder material/u,
  );
  assert.throws(
    () => privacyVaultRecoveryKeyCommitmentSha256(
      Buffer.from("abcd".repeat(16), "hex"),
    ),
    /placeholder material/u,
  );
  assert.throws(
    () => seal(context, { keyMaterialBytes: Buffer.alloc(0) }),
    /nonempty Buffer/u,
  );
  assert.throws(
    () => seal(context, { keyMaterialBytes: Buffer.alloc(32) }),
    /all-zero placeholder/u,
  );
  assert.throws(
    () => seal(context, { keyMaterialBytes: Buffer.alloc(16_385) }),
    /at most 16384/u,
  );
  assert.throws(
    () => privacyVaultRecoveryKeyCommitmentSha256(new Uint8Array(32)),
    /32-byte Buffer/u,
  );
});

test("canonical records reject extra, missing, symbol, prototype, and accessor surfaces", async (t) => {
  const context = createContext();
  const bundle = seal(context);
  const receipt = verify(context, bundle);
  const symbol = Symbol("hidden");
  const accessor = {};
  let reads = 0;
  for (const [key, value] of Object.entries(bundle)) {
    if (key === "ciphertextBase64url") continue;
    Object.defineProperty(accessor, key, {
      enumerable: true,
      value,
    });
  }
  Object.defineProperty(accessor, "ciphertextBase64url", {
    configurable: true,
    enumerable: true,
    get() {
      reads += 1;
      return bundle.ciphertextBase64url;
    },
  });

  const cases = [
    ["extra", { ...bundle, unexpected: true }],
    ["missing", Object.fromEntries(
      Object.entries(bundle).filter(([key]) => key !== "bundleSha256"),
    )],
    ["symbol", { ...bundle, [symbol]: true }],
    ["prototype", Object.assign(Object.create({ inherited: true }), bundle)],
    ["accessor", accessor],
  ];
  for (const [label, value] of cases) {
    await t.test(label, () => assert.throws(
      () => validatePrivacyVaultRecoveryBundle(value),
      /exact canonical shape/u,
    ));
  }
  assert.equal(reads, 0);

  assert.throws(
    () => createPrivacyVaultRecoveryGenesisState({
      vaultBindingSha256: context.state.vaultBindingSha256,
      recoveryKeyCommitmentSha256: context.state.recoveryKeyCommitmentSha256,
      maximumBundleAgeSeconds: "600",
      maximumFutureSkewSeconds: "30",
      unexpected: true,
    }),
    /exact canonical shape/u,
  );
  assert.throws(
    () => verifyPrivacyVaultRecoveryBundle({
      currentState: context.state,
      bundle,
      recoveryKeyBytes: context.recoveryKey,
      expectedKeyMaterialCommitmentSha256: context.expectedCommitment,
      evaluationUnixSeconds: NOW,
      unexpected: true,
    }),
    /exact canonical shape/u,
  );
  assert.throws(
    () => validatePrivacyVaultRecoveryVerificationReceipt({ ...receipt }),
    /not issued by this process/u,
  );
  assert.throws(
    () => validatePrivacyVaultRecoveryVerificationReceipt(
      JSON.parse(JSON.stringify(receipt)),
    ),
    /not issued by this process/u,
  );
});

test("state and bundle truth flags cannot be self-attested or digest-substituted", () => {
  const context = createContext();
  const bundle = seal(context);
  assert.throws(
    () => validatePrivacyVaultRecoveryState({
      ...context.state,
      durablePersistenceVerified: true,
    }),
    /must remain false/u,
  );
  assert.throws(
    () => validatePrivacyVaultRecoveryState({
      ...context.state,
      stateSha256: digest("forged-state"),
    }),
    /state digest mismatch/u,
  );
  assert.throws(
    () => validatePrivacyVaultRecoveryBundle({
      ...bundle,
      bundleSha256: digest("forged-bundle"),
    }),
    /bundle digest mismatch/u,
  );
  assert.throws(
    () => validatePrivacyVaultRecoveryBundle({
      ...bundle,
      durablePersistenceVerified: true,
    }),
    /must remain false/u,
  );
});

test("first-bundle predecessor fields must be the canonical zero genesis", () => {
  const context = createContext();
  const bundle = seal(context);
  const invalid = rehashBundle(
    bundle,
    {
      previousBundleSha256: digest("impossible-first-predecessor"),
      previousKeyMaterialCommitmentSha256: digest("impossible-first-key"),
    },
    { rehashAad: true },
  );
  assert.throws(() => verify(context, invalid), /predecessor fields are inconsistent/u);
});

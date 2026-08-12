import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import test from "node:test";

import {
  PROVIDER_AUTHENTICATION_MAINNET_STATUS,
  PROVIDER_AUTHENTICATION_STATUS,
  PROVIDER_ENVELOPE_STATE_SCHEMA,
  PROVIDER_ENVELOPE_VERIFICATION_SCHEMA,
  PROVIDER_KEY_MATERIAL_CLASS,
  PROVIDER_KINDS,
  PROVIDER_SIGNATURE_ALGORITHM,
  PROVIDER_SIGNED_ENVELOPE_SCHEMA,
  PROVIDER_TRUST_BINDING_SCHEMA,
  createProviderEnvelopeGenesisState,
  createProviderSignedEnvelope,
  createProviderTrustBinding,
  providerEnvelopeSigningBytes,
  validateProviderEnvelopeState,
  validateProviderEnvelopeVerificationReceipt,
  validateProviderSignedEnvelope,
  validateProviderTrustBinding,
  verifyProviderSignedEnvelope,
} from "../programs/iat_b3_reference/provider-authenticated-envelope.mjs";

const ZERO_SHA256 = "0".repeat(64);
const NOW = 2_000_000_000n;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function digest(label) {
  return sha256(Buffer.from(`iat-b3-provider-auth-test:${label}`, "utf8"));
}

function createKey({
  keyId = "prod-provider-key-2026-a",
  activationSequence = "1",
  retirementSequence = null,
  notBeforeUnixSeconds = (NOW - 3_600n).toString(),
  notAfterUnixSeconds = (NOW + 86_400n).toString(),
  revokedAtUnixSeconds = null,
  compromiseCutoffUnixSeconds = null,
} = {}) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const der = Buffer.from(publicKey.export({ format: "der", type: "spki" }));
  return {
    privateKey,
    record: {
      keyId,
      algorithm: PROVIDER_SIGNATURE_ALGORITHM,
      keyMaterialClass: PROVIDER_KEY_MATERIAL_CLASS,
      publicKeySpkiDerBase64url: der.toString("base64url"),
      publicKeySha256: sha256(der),
      activationSequence,
      retirementSequence,
      notBeforeUnixSeconds,
      notAfterUnixSeconds,
      revokedAtUnixSeconds,
      compromiseCutoffUnixSeconds,
    },
  };
}

function trustInput(providerKind, keys) {
  const checkpoint = providerKind === PROVIDER_KINDS.EXTERNAL_CHECKPOINT;
  return {
    environment: "PRODUCTION",
    providerKind,
    providerIdentitySha256: digest(`${providerKind}:provider-identity`),
    subjectBindingSha256: digest(`${providerKind}:subject-binding`),
    receiptDomainId: checkpoint
      ? "iat-b3/external-checkpoint-provider/production-primary/v1"
      : "iat-b3/x-social-evidence-provider/production-primary/v1",
    keyRegistryResourceId: checkpoint
      ? "prod-checkpoint-key-registry-primary"
      : "prod-x-social-key-registry-primary",
    ownerProductionKeyEvidenceSha256: digest(`${providerKind}:owner-key-evidence`),
    maximumEnvelopeAgeSeconds: "300",
    maximumFutureSkewSeconds: "30",
    maximumKeyOverlapSequences: "1",
    keys,
  };
}

function createContext(providerKind = PROVIDER_KINDS.EXTERNAL_CHECKPOINT, keyOptions = {}) {
  const key = createKey({
    keyId: providerKind === PROVIDER_KINDS.EXTERNAL_CHECKPOINT
      ? "prod-checkpoint-key-2026-a"
      : "prod-x-social-key-2026-a",
    ...keyOptions,
  });
  const trustBinding = createProviderTrustBinding(trustInput(providerKind, [key.record]));
  const state = createProviderEnvelopeGenesisState(trustBinding);
  return { providerKind, key, trustBinding, state };
}

function operationFor(providerKind) {
  return providerKind === PROVIDER_KINDS.EXTERNAL_CHECKPOINT
    ? "CHECKPOINT_READ_CURRENT"
    : "X_IDENTITY_TIER_OBSERVATION";
}

function signedEnvelope({
  context,
  state = context.state,
  privateKey = context.key.privateKey,
  keyId = context.key.record.keyId,
  sequence = (BigInt(state.lastSequence) + 1n).toString(),
  previousEnvelopeSha256 = state.lastEnvelopeSha256,
  operation = operationFor(context.providerKind),
  requestBytes = Buffer.from("canonical-provider-request", "utf8"),
  responseBytes = Buffer.from("canonical-provider-response", "utf8"),
  nonceSha256 = digest(`nonce:${sequence}:${operation}`),
  issuedAtUnixSeconds = (NOW - 5n).toString(),
  expiresAtUnixSeconds = (NOW + 120n).toString(),
  mutateUnsigned = (value) => value,
} = {}) {
  const unsigned = mutateUnsigned({
    schema: PROVIDER_SIGNED_ENVELOPE_SCHEMA,
    status: PROVIDER_AUTHENTICATION_STATUS,
    environment: "PRODUCTION",
    providerKind: context.trustBinding.providerKind,
    providerIdentitySha256: context.trustBinding.providerIdentitySha256,
    subjectBindingSha256: context.trustBinding.subjectBindingSha256,
    trustBindingSha256: context.trustBinding.trustBindingSha256,
    receiptDomainSha256: context.trustBinding.receiptDomainSha256,
    trustRootSha256: context.trustBinding.trustRootSha256,
    keyRegistrySnapshotSha256: context.trustBinding.keyRegistrySnapshotSha256,
    keyId,
    signatureAlgorithm: PROVIDER_SIGNATURE_ALGORITHM,
    operation,
    sequence,
    previousEnvelopeSha256,
    requestNonceSha256: nonceSha256,
    requestSha256: sha256(requestBytes),
    responseSha256: sha256(responseBytes),
    issuedAtUnixSeconds,
    expiresAtUnixSeconds,
  });
  const signatureBase64url = sign(
    null,
    providerEnvelopeSigningBytes(unsigned),
    privateKey,
  ).toString("base64url");
  return {
    envelope: createProviderSignedEnvelope({ unsignedEnvelope: unsigned, signatureBase64url }),
    requestBytes,
    responseBytes,
    nonceSha256,
  };
}

function verify(context, signed, overrides = {}) {
  return verifyProviderSignedEnvelope({
    trustBinding: context.trustBinding,
    currentState: context.state,
    envelope: signed.envelope,
    requestBytes: signed.requestBytes,
    responseBytes: signed.responseBytes,
    expectedRequestNonceSha256: signed.nonceSha256,
    evaluationUnixSeconds: NOW,
    ...overrides,
  });
}

for (const providerKind of Object.values(PROVIDER_KINDS)) {
  test(`${providerKind} accepts one canonical configured-key signature and stays nonactivating`, () => {
    const context = createContext(providerKind);
    const signed = signedEnvelope({ context });
    const receipt = verify(context, signed);

    assert.equal(context.trustBinding.schema, PROVIDER_TRUST_BINDING_SCHEMA);
    assert.equal(context.state.schema, PROVIDER_ENVELOPE_STATE_SCHEMA);
    assert.equal(signed.envelope.schema, PROVIDER_SIGNED_ENVELOPE_SCHEMA);
    assert.equal(receipt.schema, PROVIDER_ENVELOPE_VERIFICATION_SCHEMA);
    assert.equal(receipt.canonicalEnvelopeVerified, true);
    assert.equal(receipt.cryptographicSignatureVerified, true);
    assert.equal(receipt.configuredPublicKeyMatched, true);
    assert.equal(receipt.requestNonceVerified, true);
    assert.equal(receipt.contiguousSequenceVerified, true);
    assert.equal(receipt.predecessorEnvelopeVerified, true);
    assert.equal(receipt.stateAfter.lastSequence, "1");
    assert.equal(receipt.stateAfter.lastEnvelopeSha256, signed.envelope.envelopeSha256);
    for (const flag of [
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
    ]) assert.equal(receipt[flag], false, flag);
    assert.equal(receipt.mainnetStatus, PROVIDER_AUTHENTICATION_MAINNET_STATUS);
    assert.equal(validateProviderTrustBinding(context.trustBinding), context.trustBinding);
    assert.equal(validateProviderEnvelopeState(context.state, context.trustBinding), context.state);
    assert.equal(validateProviderSignedEnvelope(signed.envelope), signed.envelope);
    assert.equal(validateProviderEnvelopeVerificationReceipt(receipt), receipt);
    assert.equal(JSON.stringify(context.trustBinding).includes("privateKey"), false);
  });
}

test("trust binding has no default and rejects fixture, placeholder, zero, malformed, or non-Ed25519 keys", async (t) => {
  const key = createKey();
  const base = trustInput(PROVIDER_KINDS.EXTERNAL_CHECKPOINT, [key.record]);
  const cases = [
    ["non-production environment", { ...base, environment: "TEST_FIXTURE" }, /PRODUCTION environment/u],
    ["fixture key class", {
      ...base,
      keys: [{ ...key.record, keyMaterialClass: "TEST_FIXTURE_PUBLIC_KEY" }],
    }, /owner-supplied production Ed25519/u],
    ["fixture key ID", {
      ...base,
      keys: [{ ...key.record, keyId: "fixture-provider-key-2026-a" }],
    }, /production identifier/u],
    ["fixture registry", {
      ...base,
      keyRegistryResourceId: "test-provider-key-registry",
    }, /production identifier/u],
    ["zero evidence digest", {
      ...base,
      ownerProductionKeyEvidenceSha256: ZERO_SHA256,
    }, /placeholder material/u],
    ["zero Ed25519 key", (() => {
      const der = Buffer.concat([
        Buffer.from("302a300506032b6570032100", "hex"),
        Buffer.alloc(32),
      ]);
      return {
        ...base,
        keys: [{
          ...key.record,
          publicKeySpkiDerBase64url: der.toString("base64url"),
          publicKeySha256: sha256(der),
        }],
      };
    })(), /nonzero canonical Ed25519/u],
    ["malformed key", {
      ...base,
      keys: [{ ...key.record, publicKeySpkiDerBase64url: "AQID" }],
    }, /wrong length|noncanonical/u],
    ["padded key encoding", {
      ...base,
      keys: [{
        ...key.record,
        publicKeySpkiDerBase64url: `${key.record.publicKeySpkiDerBase64url}=`,
      }],
    }, /base64url/u],
    ["empty key set", { ...base, keys: [] }, /between 1 and 32/u],
  ];
  for (const [name, input, pattern] of cases) {
    await t.test(name, () => assert.throws(() => createProviderTrustBinding(input), pattern));
  }

  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey
    .export({ format: "der", type: "spki" });
  assert.throws(
    () => createProviderTrustBinding({
      ...base,
      keys: [{
        ...key.record,
        publicKeySpkiDerBase64url: Buffer.from(rsa).toString("base64url"),
        publicKeySha256: sha256(rsa),
      }],
    }),
    /wrong length|Ed25519/u,
  );

  const second = createKey({ keyId: "prod-provider-key-2026-b" });
  assert.throws(
    () => createProviderTrustBinding({
      ...base,
      keys: [key.record, second.record],
    }),
    /overlap exceeds/u,
  );
});

test("cross-provider, subject, registry, key, operation, and signature substitution fail closed", async (t) => {
  const checkpoint = createContext(PROVIDER_KINDS.EXTERNAL_CHECKPOINT);
  const social = createContext(PROVIDER_KINDS.X_SOCIAL_EVIDENCE);
  const signed = signedEnvelope({ context: checkpoint });

  await t.test("cross-provider trust binding", () => {
    assert.throws(
      () => verify(social, signed, { currentState: social.state }),
      /PROVIDERKIND_MISMATCH|TRUST_BINDING_SHA256_MISMATCH/u,
    );
  });
  await t.test("unknown key ID", () => {
    const alternate = signedEnvelope({
      context: checkpoint,
      keyId: "prod-checkpoint-key-2026-b",
    });
    assert.throws(() => verify(checkpoint, alternate), /KEY_ID_NOT_CONFIGURED/u);
  });
  await t.test("wrong private key", () => {
    const wrong = createKey();
    const alternate = signedEnvelope({ context: checkpoint, privateKey: wrong.privateKey });
    assert.throws(() => verify(checkpoint, alternate), /SIGNATURE_INVALID/u);
  });
  await t.test("allowed-operation substitution with retained signature", () => {
    const originalUnsigned = Object.fromEntries(
      Object.entries(signed.envelope).filter(([key]) => ![
        "signatureBase64url",
        "envelopeSha256",
      ].includes(key)),
    );
    const changed = createProviderSignedEnvelope({
      unsignedEnvelope: {
        ...originalUnsigned,
        operation: "CHECKPOINT_COMPARE_AND_SWAP",
      },
      signatureBase64url: signed.envelope.signatureBase64url,
    });
    assert.throws(
      () => verify(checkpoint, { ...signed, envelope: changed }),
      /SIGNATURE_INVALID/u,
    );
  });
  await t.test("signature bit flip", () => {
    const signature = Buffer.from(signed.envelope.signatureBase64url, "base64url");
    signature[0] ^= 1;
    const unsigned = Object.fromEntries(
      Object.entries(signed.envelope).filter(([key]) => ![
        "signatureBase64url",
        "envelopeSha256",
      ].includes(key)),
    );
    const changed = createProviderSignedEnvelope({
      unsignedEnvelope: unsigned,
      signatureBase64url: signature.toString("base64url"),
    });
    assert.throws(
      () => verify(checkpoint, { ...signed, envelope: changed }),
      /SIGNATURE_INVALID/u,
    );
  });
});

test("request, response, and caller nonce are exact signed byte bindings", async (t) => {
  const context = createContext();
  const signed = signedEnvelope({ context });
  await t.test("request bytes", () => assert.throws(
    () => verify(context, signed, { requestBytes: Buffer.from("alternate-request") }),
    /REQUEST_BYTES_MISMATCH/u,
  ));
  await t.test("response bytes", () => assert.throws(
    () => verify(context, signed, { responseBytes: Buffer.from("alternate-response") }),
    /RESPONSE_BYTES_MISMATCH/u,
  ));
  await t.test("request nonce", () => assert.throws(
    () => verify(context, signed, { expectedRequestNonceSha256: digest("alternate-nonce") }),
    /REQUEST_NONCE_MISMATCH/u,
  ));
  await t.test("non-Buffer aliases", () => assert.throws(
    () => verify(context, signed, { requestBytes: new Uint8Array(signed.requestBytes) }),
    /must be a Buffer/u,
  ));
});

test("supplied monotonic state rejects replay, skip, same-sequence fork, and predecessor rollback", async (t) => {
  const context = createContext();
  const first = signedEnvelope({ context });
  const firstReceipt = verify(context, first);
  const advanced = { ...context, state: firstReceipt.stateAfter };

  await t.test("exact replay", () => assert.throws(
    () => verify(advanced, first),
    /REPLAY_SKIP_OR_SAME_SEQUENCE_FORK/u,
  ));
  await t.test("sequence skip", () => {
    const third = signedEnvelope({ context: advanced, sequence: "3" });
    assert.throws(() => verify(advanced, third), /REPLAY_SKIP_OR_SAME_SEQUENCE_FORK/u);
  });
  await t.test("same-sequence fork", () => {
    const fork = signedEnvelope({
      context,
      responseBytes: Buffer.from("forked-first-response"),
    });
    assert.notEqual(fork.envelope.envelopeSha256, first.envelope.envelopeSha256);
    assert.throws(() => verify(advanced, fork), /REPLAY_SKIP_OR_SAME_SEQUENCE_FORK/u);
  });
  await t.test("wrong predecessor", () => {
    const second = signedEnvelope({
      context: advanced,
      previousEnvelopeSha256: digest("unrelated-predecessor"),
    });
    assert.throws(() => verify(advanced, second), /PREDECESSOR_OR_ROLLBACK_MISMATCH/u);
  });
  assert.equal(firstReceipt.externalRollbackProtectionVerified, false);
  assert.equal(firstReceipt.durableReplayStateVerified, false);
});

test("key sequence rotation is explicit and bounded", () => {
  const first = createKey({
    keyId: "prod-provider-key-2026-a",
    activationSequence: "1",
    retirementSequence: "3",
  });
  const second = createKey({
    keyId: "prod-provider-key-2026-b",
    activationSequence: "2",
  });
  const providerKind = PROVIDER_KINDS.EXTERNAL_CHECKPOINT;
  const trustBinding = createProviderTrustBinding(trustInput(providerKind, [first.record, second.record]));
  const context = {
    providerKind,
    key: first,
    trustBinding,
    state: createProviderEnvelopeGenesisState(trustBinding),
  };
  const one = signedEnvelope({ context });
  const oneReceipt = verify(context, one);
  const advanced = { ...context, key: second, state: oneReceipt.stateAfter };
  const two = signedEnvelope({ context: advanced });
  const twoReceipt = verify(advanced, two);
  assert.equal(twoReceipt.keyId, second.record.keyId);
  assert.equal(twoReceipt.sequence, "2");

  const notYetActive = signedEnvelope({ context, keyId: second.record.keyId, privateKey: second.privateKey });
  assert.throws(() => verify(context, notYetActive), /KEY_NOT_ACTIVE_FOR_SEQUENCE/u);
});

test("time, expiry, revocation, and compromise boundaries fail closed", async (t) => {
  await t.test("expired", () => {
    const context = createContext();
    const signed = signedEnvelope({
      context,
      issuedAtUnixSeconds: (NOW - 100n).toString(),
      expiresAtUnixSeconds: NOW.toString(),
    });
    assert.throws(() => verify(context, signed), /EXPIRED/u);
  });
  await t.test("too far future", () => {
    const context = createContext();
    const signed = signedEnvelope({
      context,
      issuedAtUnixSeconds: (NOW + 31n).toString(),
      expiresAtUnixSeconds: (NOW + 60n).toString(),
    });
    assert.throws(() => verify(context, signed), /TOO_FAR_IN_FUTURE/u);
  });
  await t.test("lifetime exceeds maximum", () => {
    const context = createContext();
    const signed = signedEnvelope({
      context,
      issuedAtUnixSeconds: NOW.toString(),
      expiresAtUnixSeconds: (NOW + 301n).toString(),
    });
    assert.throws(() => verify(context, signed), /EXCEEDS_CONFIGURED_MAXIMUM/u);
  });
  await t.test("known revocation invalidates use", () => {
    const context = createContext(PROVIDER_KINDS.EXTERNAL_CHECKPOINT, {
      revokedAtUnixSeconds: (NOW - 1n).toString(),
    });
    const signed = signedEnvelope({
      context,
      issuedAtUnixSeconds: (NOW - 5n).toString(),
    });
    assert.throws(() => verify(context, signed), /KEY_REVOKED_HOLD/u);
  });
  await t.test("compromise cutoff rejects at cutoff", () => {
    const context = createContext(PROVIDER_KINDS.EXTERNAL_CHECKPOINT, {
      compromiseCutoffUnixSeconds: (NOW - 5n).toString(),
    });
    const signed = signedEnvelope({
      context,
      issuedAtUnixSeconds: (NOW - 5n).toString(),
    });
    assert.throws(() => verify(context, signed), /COMPROMISE_CUTOFF_HOLD/u);
  });
});

test("shape aliases, accessors, sparse key sets, state tamper, and receipt overclaim fail closed", async (t) => {
  const context = createContext();
  const signed = signedEnvelope({ context });
  const receipt = verify(context, signed);

  await t.test("extra unsigned member", () => {
    const unsigned = Object.fromEntries(
      Object.entries(signed.envelope).filter(([key]) => ![
        "signatureBase64url",
        "envelopeSha256",
      ].includes(key)),
    );
    assert.throws(
      () => providerEnvelopeSigningBytes({ ...unsigned, allow: true }),
      /INVALID_PROVIDER_UNSIGNED_ENVELOPE/u,
    );
  });
  await t.test("accessor is rejected without execution", () => {
    let reads = 0;
    const malicious = { ...trustInput(PROVIDER_KINDS.EXTERNAL_CHECKPOINT, [context.key.record]) };
    Object.defineProperty(malicious, "providerKind", {
      enumerable: true,
      get() {
        reads += 1;
        return PROVIDER_KINDS.EXTERNAL_CHECKPOINT;
      },
    });
    assert.throws(() => createProviderTrustBinding(malicious), /INVALID_PROVIDER_TRUST_BINDING_INPUT/u);
    assert.equal(reads, 0);
  });
  await t.test("sparse key set", () => {
    const keys = new Array(2);
    keys[1] = context.key.record;
    assert.throws(
      () => createProviderTrustBinding(trustInput(PROVIDER_KINDS.EXTERNAL_CHECKPOINT, keys)),
      /INVALID_PROVIDER_PUBLIC_KEY_SET/u,
    );
  });
  await t.test("state digest tamper", () => {
    assert.throws(
      () => verify(context, signed, {
        currentState: { ...context.state, stateSha256: digest("forged-state") },
      }),
      /STATE_DIGEST_OR_CANONICALIZATION_MISMATCH/u,
    );
  });
  await t.test("envelope digest tamper", () => {
    assert.throws(
      () => verify(context, {
        ...signed,
        envelope: { ...signed.envelope, envelopeSha256: digest("forged-envelope") },
      }),
      /SIGNED_ENVELOPE_DIGEST_MISMATCH/u,
    );
  });
  await t.test("verification receipt overclaim", () => {
    assert.throws(
      () => validateProviderEnvelopeVerificationReceipt({
        ...receipt,
        providerAuthenticationVerified: true,
      }),
      /TRUTH_BOUNDARY/u,
    );
  });
  await t.test("verification receipt digest tamper", () => {
    assert.throws(
      () => validateProviderEnvelopeVerificationReceipt({
        ...receipt,
        verificationReceiptSha256: digest("forged-verification-receipt"),
      }),
      /RECEIPT_DIGEST_MISMATCH/u,
    );
  });
  await t.test("nested state accessor is rejected without execution", () => {
    let reads = 0;
    const maliciousState = { ...receipt.stateAfter };
    Object.defineProperty(maliciousState, "lastSequence", {
      enumerable: true,
      get() {
        reads += 1;
        return "1";
      },
    });
    assert.throws(
      () => validateProviderEnvelopeVerificationReceipt({
        ...receipt,
        stateAfter: maliciousState,
      }),
      /INVALID_PROVIDER_ENVELOPE_VERIFICATION_STATE_TRANSITION/u,
    );
    assert.equal(reads, 0);
  });
  await t.test("serialized verification receipt loses the execution brand", () => {
    assert.throws(
      () => validateProviderEnvelopeVerificationReceipt(structuredClone(receipt)),
      /NOT_EXECUTED_IN_THIS_PROCESS/u,
    );
  });
});

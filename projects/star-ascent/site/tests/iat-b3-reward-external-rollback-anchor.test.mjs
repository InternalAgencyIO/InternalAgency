import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import test from "node:test";

import {
  PROVIDER_AUTHENTICATION_STATUS,
  PROVIDER_KEY_MATERIAL_CLASS,
  PROVIDER_KINDS,
  PROVIDER_SIGNATURE_ALGORITHM,
  PROVIDER_SIGNED_ENVELOPE_SCHEMA,
  createProviderEnvelopeGenesisState,
  createProviderSignedEnvelope,
  createProviderTrustBinding,
  providerEnvelopeSigningBytes,
} from "../programs/iat_b3_reference/provider-authenticated-envelope.mjs";
import {
  REWARD_ROLLBACK_ANCHOR_MAINNET_STATUS,
  REWARD_ROLLBACK_ANCHOR_PROVIDER_OPERATION,
  REWARD_ROLLBACK_ANCHOR_REQUEST_SCHEMA,
  REWARD_ROLLBACK_ANCHOR_STATEMENT_SCHEMA,
  REWARD_ROLLBACK_ANCHOR_STATE_SCHEMA,
  REWARD_ROLLBACK_ANCHOR_STATUS,
  REWARD_ROLLBACK_ANCHOR_VERIFICATION_SCHEMA,
  createRewardRollbackAnchorGenesisState,
  createRewardRollbackAnchorRequest,
  createRewardRollbackAnchorStatement,
  parseRewardRollbackAnchorRequestBytes,
  parseRewardRollbackAnchorStatementBytes,
  rewardRollbackAnchorRequestBytes,
  rewardRollbackAnchorStatementBytes,
  validateRewardRollbackAnchorCheckpoint,
  validateRewardRollbackAnchorRequest,
  validateRewardRollbackAnchorState,
  validateRewardRollbackAnchorStatement,
  validateRewardRollbackAnchorVerificationReceipt,
  verifyRewardExternalRollbackAnchor,
} from "../programs/iat_b3_reference/reward-external-rollback-anchor.mjs";

const NOW = 2_000_000_000n;
const ZERO_SHA256 = "0".repeat(64);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function digest(label) {
  return sha256(Buffer.from(`iat-b3-reward-rollback-anchor-test:${label}`, "utf8"));
}

function sha256Canonical(domain, value) {
  return sha256(Buffer.from(JSON.stringify({ domain, value }), "utf8"));
}

function createKey({
  keyId = "prod-rollback-anchor-key-2026-a",
  activationSequence = "1",
  retirementSequence = null,
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
      notBeforeUnixSeconds: (NOW - 3_600n).toString(),
      notAfterUnixSeconds: (NOW + 86_400n).toString(),
      revokedAtUnixSeconds: null,
      compromiseCutoffUnixSeconds: null,
    },
  };
}

function trustInput(providerKind, keys) {
  return {
    environment: "PRODUCTION",
    providerKind,
    providerIdentitySha256: digest(`${providerKind}:identity`),
    subjectBindingSha256: digest(`${providerKind}:rollback-anchor-subject`),
    receiptDomainId: providerKind === PROVIDER_KINDS.EXTERNAL_CHECKPOINT
      ? "iat-b3/external-checkpoint-provider/reward-rollback-anchor-primary/v1"
      : "iat-b3/x-social-evidence-provider/production-primary/v1",
    keyRegistryResourceId: providerKind === PROVIDER_KINDS.EXTERNAL_CHECKPOINT
      ? "prod-rollback-anchor-key-registry-primary"
      : "prod-x-key-registry-primary",
    ownerProductionKeyEvidenceSha256: digest(`${providerKind}:key-evidence`),
    maximumEnvelopeAgeSeconds: "300",
    maximumFutureSkewSeconds: "30",
    maximumKeyOverlapSequences: "1",
    keys,
  };
}

function createContext({ providerKind = PROVIDER_KINDS.EXTERNAL_CHECKPOINT } = {}) {
  const key = createKey();
  const trustBinding = createProviderTrustBinding(
    trustInput(providerKind, [key.record]),
  );
  const providerState = createProviderEnvelopeGenesisState(trustBinding);
  const anchorState = providerKind === PROVIDER_KINDS.EXTERNAL_CHECKPOINT
    ? createRewardRollbackAnchorGenesisState({
      trustBinding,
      anchorNamespaceSha256: digest("external-anchor-namespace"),
      persistenceIdentitySha256: digest("reward-persistence-identity"),
      maximumAnchorAgeSeconds: "600",
      maximumFutureSkewSeconds: "30",
    })
    : null;
  return { key, trustBinding, providerState, anchorState };
}

function genesisCheckpoint(persistenceIdentitySha256) {
  return {
    persistenceIdentitySha256,
    checkpointRevision: "1",
    checkpointSha256: digest("checkpoint-1"),
    previousCheckpointSha256: ZERO_SHA256,
    casCommitSequence: "0",
    casHeadCommitSha256: ZERO_SHA256,
  };
}

function nextCheckpoint(previous, {
  checkpointSha256 = digest(`checkpoint-${BigInt(previous.checkpointRevision) + 1n}`),
  casHeadCommitSha256 = digest(`cas-head-${BigInt(previous.casCommitSequence) + 1n}`),
} = {}) {
  return {
    persistenceIdentitySha256: previous.persistenceIdentitySha256,
    checkpointRevision: (BigInt(previous.checkpointRevision) + 1n).toString(),
    checkpointSha256,
    previousCheckpointSha256: previous.checkpointSha256,
    casCommitSequence: (BigInt(previous.casCommitSequence) + 1n).toString(),
    casHeadCommitSha256,
  };
}

function rehashStatement(statement, changes = {}) {
  const next = { ...statement, ...changes };
  const { anchorSha256: ignored, ...withoutDigest } = next;
  void ignored;
  next.anchorSha256 = sha256Canonical(
    "iat-b3-reward-rollback-anchor-statement/v1",
    withoutDigest,
  );
  return next;
}

function createProviderEnvelope({
  context,
  providerState,
  requestBytes,
  anchorBytes,
  requestNonceSha256,
  privateKey = context.key.privateKey,
  operation = REWARD_ROLLBACK_ANCHOR_PROVIDER_OPERATION,
  issuedAtUnixSeconds = NOW - 4n,
  expiresAtUnixSeconds = NOW + 120n,
  sequence = (BigInt(providerState.lastSequence) + 1n).toString(),
  previousEnvelopeSha256 = providerState.lastEnvelopeSha256,
} = {}) {
  const unsigned = {
    schema: PROVIDER_SIGNED_ENVELOPE_SCHEMA,
    status: PROVIDER_AUTHENTICATION_STATUS,
    environment: "PRODUCTION",
    providerKind: PROVIDER_KINDS.EXTERNAL_CHECKPOINT,
    providerIdentitySha256: context.trustBinding.providerIdentitySha256,
    subjectBindingSha256: context.trustBinding.subjectBindingSha256,
    trustBindingSha256: context.trustBinding.trustBindingSha256,
    receiptDomainSha256: context.trustBinding.receiptDomainSha256,
    trustRootSha256: context.trustBinding.trustRootSha256,
    keyRegistrySnapshotSha256: context.trustBinding.keyRegistrySnapshotSha256,
    keyId: context.key.record.keyId,
    signatureAlgorithm: PROVIDER_SIGNATURE_ALGORITHM,
    operation,
    sequence,
    previousEnvelopeSha256,
    requestNonceSha256,
    requestSha256: sha256(requestBytes),
    responseSha256: sha256(anchorBytes),
    issuedAtUnixSeconds: issuedAtUnixSeconds.toString(),
    expiresAtUnixSeconds: expiresAtUnixSeconds.toString(),
  };
  const signatureBase64url = sign(
    null,
    providerEnvelopeSigningBytes(unsigned),
    privateKey,
  ).toString("base64url");
  return createProviderSignedEnvelope({
    unsignedEnvelope: unsigned,
    signatureBase64url,
  });
}

function createExchange({
  context,
  providerState = context.providerState,
  anchorState = context.anchorState,
  checkpoint = genesisCheckpoint(anchorState.persistenceIdentitySha256),
  requestNonceSha256 = digest(`request-nonce-${checkpoint.checkpointRevision}`),
  requestedAtUnixSeconds = NOW - 6n,
  observedAtUnixSeconds = NOW - 5n,
  anchorExpiresAtUnixSeconds = NOW + 120n,
  mutateStatement = (value) => value,
  operation,
  privateKey,
} = {}) {
  const request = createRewardRollbackAnchorRequest({
    currentAnchorState: anchorState,
    requestNonceSha256,
    requestedAtUnixSeconds,
  });
  const createdStatement = createRewardRollbackAnchorStatement({
    currentAnchorState: anchorState,
    request,
    checkpoint,
    observedAtUnixSeconds,
    expiresAtUnixSeconds: anchorExpiresAtUnixSeconds,
  });
  const statement = mutateStatement(createdStatement);
  const requestBytes = rewardRollbackAnchorRequestBytes(request);
  const anchorBytes = rewardRollbackAnchorStatementBytes(statement);
  const providerEnvelope = createProviderEnvelope({
    context,
    providerState,
    requestBytes,
    anchorBytes,
    requestNonceSha256,
    operation,
    privateKey,
  });
  return {
    anchorState,
    providerState,
    checkpoint,
    request,
    statement,
    requestNonceSha256,
    requestBytes,
    anchorBytes,
    providerEnvelope,
  };
}

function verify(context, exchange, overrides = {}) {
  return verifyRewardExternalRollbackAnchor({
    trustBinding: context.trustBinding,
    currentProviderState: exchange.providerState,
    providerEnvelope: exchange.providerEnvelope,
    requestBytes: exchange.requestBytes,
    anchorBytes: exchange.anchorBytes,
    expectedRequestNonceSha256: exchange.requestNonceSha256,
    currentAnchorState: exchange.anchorState,
    expectedCheckpoint: exchange.checkpoint,
    evaluationUnixSeconds: NOW,
    ...overrides,
  });
}

test("one exact owner-key-signed anchor advances both supplied monotonic states and stays HOLD", () => {
  const context = createContext();
  const exchange = createExchange({ context });
  const receipt = verify(context, exchange);

  assert.equal(context.anchorState.schema, REWARD_ROLLBACK_ANCHOR_STATE_SCHEMA);
  assert.equal(exchange.request.schema, REWARD_ROLLBACK_ANCHOR_REQUEST_SCHEMA);
  assert.equal(exchange.statement.schema, REWARD_ROLLBACK_ANCHOR_STATEMENT_SCHEMA);
  assert.equal(receipt.schema, REWARD_ROLLBACK_ANCHOR_VERIFICATION_SCHEMA);
  assert.equal(receipt.status, REWARD_ROLLBACK_ANCHOR_STATUS);
  assert.equal(receipt.mainnetStatus, REWARD_ROLLBACK_ANCHOR_MAINNET_STATUS);
  assert.equal(receipt.anchorSequence, "1");
  assert.equal(receipt.checkpointRevision, "1");
  assert.equal(receipt.casCommitSequence, "0");
  assert.equal(receipt.anchorStateAfter.lastAnchorSha256, exchange.statement.anchorSha256);
  assert.equal(receipt.providerStateAfter.lastEnvelopeSha256, exchange.providerEnvelope.envelopeSha256);
  for (const flag of [
    "canonicalRequestVerified",
    "canonicalAnchorVerified",
    "cryptographicSignatureVerified",
    "configuredPublicKeyMatched",
    "requestNonceVerified",
    "suppliedProviderReplayStateAdvanced",
    "contiguousAnchorSequenceVerified",
    "predecessorAnchorVerified",
    "suppliedStateCheckpointMonotonicityVerified",
    "checkpointBindingVerified",
    "contentAddressedStateVerified",
  ]) assert.equal(receipt[flag], true, flag);
  for (const flag of [
    "providerAuthenticationVerified",
    "providerIdentityVerified",
    "productionKeyOwnershipVerified",
    "keyRegistryAuthenticityVerified",
    "durableAnchorStateVerified",
    "trustedMonotonicStorageVerified",
    "externalMonotonicityVerified",
    "externalRollbackProtectionVerified",
    "runtimeIntegrationVerified",
    "independentReviewAccepted",
    "activationReady",
  ]) assert.equal(receipt[flag], false, flag);
  assert.equal(validateRewardRollbackAnchorState(context.anchorState), context.anchorState);
  assert.equal(validateRewardRollbackAnchorRequest(exchange.request), exchange.request);
  assert.equal(validateRewardRollbackAnchorStatement(exchange.statement), exchange.statement);
  assert.equal(validateRewardRollbackAnchorCheckpoint(exchange.checkpoint), exchange.checkpoint);
  assert.deepEqual(parseRewardRollbackAnchorRequestBytes(exchange.requestBytes), exchange.request);
  assert.deepEqual(parseRewardRollbackAnchorStatementBytes(exchange.anchorBytes), exchange.statement);
  assert.equal(validateRewardRollbackAnchorVerificationReceipt(receipt), receipt);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.anchorStateAfter), true);
});

test("a second anchor requires both exact predecessor states and exact next checkpoint", () => {
  const context = createContext();
  const first = createExchange({ context });
  const firstReceipt = verify(context, first);
  const checkpoint = nextCheckpoint(first.checkpoint);
  const second = createExchange({
    context,
    providerState: firstReceipt.providerStateAfter,
    anchorState: firstReceipt.anchorStateAfter,
    checkpoint,
    requestedAtUnixSeconds: NOW + 1n,
    observedAtUnixSeconds: NOW + 2n,
    anchorExpiresAtUnixSeconds: NOW + 180n,
  });
  const secondReceipt = verify(context, second, { evaluationUnixSeconds: NOW + 3n });

  assert.equal(secondReceipt.anchorSequence, "2");
  assert.equal(second.statement.previousAnchorSha256, first.statement.anchorSha256);
  assert.equal(second.statement.previousCheckpointSha256, first.checkpoint.checkpointSha256);
  assert.equal(secondReceipt.anchorStateAfter.lastCheckpointSha256, checkpoint.checkpointSha256);
});

test("replay against either advanced state, sequence skip, fork, and rollback fail closed", async (t) => {
  const context = createContext();
  const first = createExchange({ context });
  const receipt = verify(context, first);

  await t.test("both states advanced", () => assert.throws(
    () => verify(context, first, {
      currentProviderState: receipt.providerStateAfter,
      currentAnchorState: receipt.anchorStateAfter,
    }),
    /request does not match current supplied state/u,
  ));
  await t.test("provider state only advanced", () => assert.throws(
    () => verify(context, first, { currentProviderState: receipt.providerStateAfter }),
    /PROVIDER_ENVELOPE_REPLAY_SKIP_OR_SAME_SEQUENCE_FORK_HOLD/u,
  ));
  await t.test("anchor state only advanced", () => assert.throws(
    () => verify(context, first, { currentAnchorState: receipt.anchorStateAfter }),
    /request does not match current supplied state/u,
  ));
  await t.test("skipped checkpoint revision", () => {
    const skippedCheckpoint = {
      ...first.checkpoint,
      checkpointRevision: "2",
      casCommitSequence: "1",
      previousCheckpointSha256: digest("synthetic-prior-checkpoint"),
      casHeadCommitSha256: digest("synthetic-cas-head"),
    };
    const statement = rehashStatement(first.statement, {
      anchorSequence: "2",
      previousAnchorSha256: digest("synthetic-prior-anchor"),
      checkpointRevision: "2",
      previousCheckpointSha256: skippedCheckpoint.previousCheckpointSha256,
      casCommitSequence: "1",
      casHeadCommitSha256: skippedCheckpoint.casHeadCommitSha256,
    });
    const anchorBytes = Buffer.from(JSON.stringify(statement), "utf8");
    const envelope = createProviderEnvelope({
      context,
      providerState: first.providerState,
      requestBytes: first.requestBytes,
      anchorBytes,
      requestNonceSha256: first.requestNonceSha256,
    });
    assert.throws(
      () => verify(context, { ...first, statement, anchorBytes, providerEnvelope: envelope }, {
        expectedCheckpoint: skippedCheckpoint,
      }),
      /statement does not match request or state/u,
    );
  });
  await t.test("same-sequence signed fork", () => {
    const forkCheckpoint = {
      ...first.checkpoint,
      checkpointSha256: digest("forked-checkpoint-1"),
    };
    const fork = createExchange({ context, checkpoint: forkCheckpoint });
    assert.throws(
      () => verify(context, fork, { expectedCheckpoint: first.checkpoint }),
      /does not match the exact expected checkpoint/u,
    );
  });
  await t.test("older checkpoint supplied after advance", () => {
    const secondCheckpoint = nextCheckpoint(first.checkpoint);
    assert.throws(
      () => createExchange({
        context,
        providerState: receipt.providerStateAfter,
        anchorState: receipt.anchorStateAfter,
        checkpoint: first.checkpoint,
      }),
      /request does not bind|not the next supplied state/u,
    );
    assert.equal(secondCheckpoint.checkpointRevision, "2");
  });
});

test("a caller replaying both old supplied states remains an explicit non-durable limitation", () => {
  const context = createContext();
  const exchange = createExchange({ context });
  const first = verify(context, exchange);
  const replay = verify(context, exchange);
  assert.equal(replay.anchorSha256, first.anchorSha256);
  assert.equal(replay.durableAnchorStateVerified, false);
  assert.equal(replay.trustedMonotonicStorageVerified, false);
  assert.equal(replay.externalRollbackProtectionVerified, false);
});

test("wrong key, substituted trust, wrong operation, and nonce fail cryptographically", async (t) => {
  const context = createContext();
  const exchange = createExchange({ context });
  await t.test("wrong signing key", () => {
    const wrong = createKey({ keyId: context.key.record.keyId });
    const providerEnvelope = createProviderEnvelope({
      context,
      providerState: exchange.providerState,
      requestBytes: exchange.requestBytes,
      anchorBytes: exchange.anchorBytes,
      requestNonceSha256: exchange.requestNonceSha256,
      privateKey: wrong.privateKey,
    });
    assert.throws(
      () => verify(context, { ...exchange, providerEnvelope }),
      /PROVIDER_ENVELOPE_SIGNATURE_INVALID/u,
    );
  });
  await t.test("different trust binding", () => {
    const other = createContext();
    assert.throws(
      () => verify(context, exchange, { trustBinding: other.trustBinding }),
      /INVALID_PROVIDER_ENVELOPE_STATE_BINDING|state does not match/u,
    );
  });
  await t.test("wrong signed provider operation", () => {
    const wrongOperation = createExchange({
      context,
      operation: "CHECKPOINT_COMPARE_AND_SWAP",
    });
    assert.throws(
      () => verify(context, wrongOperation),
      /does not sign the exact rollback anchor exchange/u,
    );
  });
  await t.test("caller nonce substitution", () => assert.throws(
    () => verify(context, exchange, {
      expectedRequestNonceSha256: digest("different-nonce"),
    }),
    /request does not match current supplied state|nonce/u,
  ));
});

test("X-provider trust, missing trust, zero identities, and malformed checkpoints are rejected", async (t) => {
  const xContext = createContext({ providerKind: PROVIDER_KINDS.X_SOCIAL_EVIDENCE });
  assert.throws(
    () => createRewardRollbackAnchorGenesisState({
      trustBinding: xContext.trustBinding,
      anchorNamespaceSha256: digest("namespace"),
      persistenceIdentitySha256: digest("persistence"),
      maximumAnchorAgeSeconds: "600",
      maximumFutureSkewSeconds: "30",
    }),
    /production checkpoint trust binding/u,
  );
  assert.throws(
    () => createRewardRollbackAnchorGenesisState({
      trustBinding: undefined,
      anchorNamespaceSha256: digest("namespace"),
      persistenceIdentitySha256: digest("persistence"),
      maximumAnchorAgeSeconds: "600",
      maximumFutureSkewSeconds: "30",
    }),
  );
  const context = createContext();
  assert.throws(
    () => createRewardRollbackAnchorGenesisState({
      trustBinding: context.trustBinding,
      anchorNamespaceSha256: ZERO_SHA256,
      persistenceIdentitySha256: digest("persistence"),
      maximumAnchorAgeSeconds: "600",
      maximumFutureSkewSeconds: "30",
    }),
    /placeholder material/u,
  );
  const checkpoint = genesisCheckpoint(context.anchorState.persistenceIdentitySha256);
  const cases = [
    ["revision zero", { ...checkpoint, checkpointRevision: "0" }],
    ["revision/sequence mismatch", { ...checkpoint, checkpointRevision: "2" }],
    ["noncanonical revision", { ...checkpoint, checkpointRevision: "01" }],
    ["nonzero genesis previous", {
      ...checkpoint,
      previousCheckpointSha256: digest("nonzero-previous"),
    }],
    ["nonzero genesis head", {
      ...checkpoint,
      casHeadCommitSha256: digest("nonzero-head"),
    }],
    ["extra field", { ...checkpoint, allowRollback: true }],
  ];
  for (const [label, value] of cases) {
    await t.test(label, () => assert.throws(
      () => validateRewardRollbackAnchorCheckpoint(value),
    ));
  }
});

test("signed overclaims, canonical tamper, whitespace, byte aliases, and accessors fail closed", async (t) => {
  const context = createContext();
  const exchange = createExchange({ context });

  await t.test("signed rollback overclaim", () => {
    const statement = rehashStatement(exchange.statement, {
      externalRollbackProtectionVerified: true,
    });
    const anchorBytes = Buffer.from(JSON.stringify(statement), "utf8");
    const providerEnvelope = createProviderEnvelope({
      context,
      providerState: exchange.providerState,
      requestBytes: exchange.requestBytes,
      anchorBytes,
      requestNonceSha256: exchange.requestNonceSha256,
    });
    assert.throws(
      () => verify(context, { ...exchange, statement, anchorBytes, providerEnvelope }),
      /must remain false/u,
    );
  });
  await t.test("ciphertext-like byte tamper", () => {
    const anchorBytes = Buffer.from(exchange.anchorBytes);
    anchorBytes[anchorBytes.length - 3] ^= 1;
    assert.throws(
      () => verify(context, { ...exchange, anchorBytes }),
      /canonical UTF-8 JSON|canonically encoded|digest mismatch/u,
    );
  });
  await t.test("noncanonical whitespace", () => assert.throws(
    () => parseRewardRollbackAnchorStatementBytes(Buffer.concat([
      Buffer.from(" ", "utf8"),
      exchange.anchorBytes,
    ])),
    /not canonically encoded/u,
  ));
  await t.test("Uint8Array alias", () => assert.throws(
    () => parseRewardRollbackAnchorRequestBytes(new Uint8Array(exchange.requestBytes)),
    /bounded Buffer/u,
  ));
  await t.test("request accessor without execution", () => {
    let reads = 0;
    const hostile = { ...exchange.request };
    Object.defineProperty(hostile, "requestNonceSha256", {
      configurable: true,
      enumerable: true,
      get() {
        reads += 1;
        return exchange.request.requestNonceSha256;
      },
    });
    assert.throws(
      () => validateRewardRollbackAnchorRequest(hostile),
      /exact canonical shape/u,
    );
    assert.equal(reads, 0);
  });
});

test("anchor and request time windows fail closed", async (t) => {
  const context = createContext();
  await t.test("expired anchor", () => {
    const exchange = createExchange({
      context,
      observedAtUnixSeconds: NOW - 100n,
      anchorExpiresAtUnixSeconds: NOW - 1n,
    });
    assert.throws(() => verify(context, exchange), /timing is expired/u);
  });
  await t.test("future request", () => {
    const exchange = createExchange({
      context,
      requestedAtUnixSeconds: NOW + 31n,
      observedAtUnixSeconds: NOW + 31n,
      anchorExpiresAtUnixSeconds: NOW + 100n,
    });
    assert.throws(() => verify(context, exchange), /timing is expired/u);
  });
  await t.test("anchor observed before request beyond skew", () => {
    const exchange = createExchange({
      context,
      requestedAtUnixSeconds: NOW,
      observedAtUnixSeconds: NOW - 31n,
      anchorExpiresAtUnixSeconds: NOW + 100n,
    });
    assert.throws(() => verify(context, exchange), /timing is expired/u);
  });
  await t.test("excessive lifetime rejected at construction", () => assert.throws(
    () => createExchange({
      context,
      observedAtUnixSeconds: NOW,
      anchorExpiresAtUnixSeconds: NOW + 601n,
    }),
    /lifetime exceeds/u,
  ));
});

test("receipt serialization loses the process execution brand", () => {
  const context = createContext();
  const receipt = verify(context, createExchange({ context }));
  assert.throws(
    () => validateRewardRollbackAnchorVerificationReceipt({ ...receipt }),
    /not issued by this process/u,
  );
  assert.throws(
    () => validateRewardRollbackAnchorVerificationReceipt(
      JSON.parse(JSON.stringify(receipt)),
    ),
    /not issued by this process/u,
  );
});

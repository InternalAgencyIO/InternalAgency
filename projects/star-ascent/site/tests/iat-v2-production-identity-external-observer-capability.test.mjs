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
import { canonicalizeRfc8785 } from "../scripts/iat-v2-canonical-json.mjs";
import {
  PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_BINDING_SCHEMA,
  PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_CLEARANCE_BLOCKER,
  PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_RESPONSE_SCHEMA,
  acquireProductionIdentityExternalObserverCapability,
  consumeProductionIdentityExternalObserverCapability,
  createProductionIdentityExternalObserverChallenge,
  inspectProductionIdentityExternalObserverCapability,
  inspectProductionIdentityExternalObserverChallenge,
  isProductionIdentityExternalObserverCapability,
} from "../scripts/lib/iat-v2-production-identity-external-observer-capability.mjs";
import {
  createProductionIdentityIntegrationTrust,
} from "../scripts/lib/iat-v2-production-identity-integration-evidence.mjs";

const NOW = 2_100_000_000n;
const ZERO_SHA256 = "0".repeat(64);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digest = (label) => sha256(Buffer.from(`iat-v2-external-observer:${label}`, "utf8"));
const gitObject = (label) => digest(label).slice(0, 40);
const canonicalBytes = (record) => Buffer.from(canonicalizeRfc8785(record), "utf8");
const NEGATIVE_TRUTH_FLAGS = Object.freeze([
  "authenticated",
  "clearanceValid",
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
]);

function assertNonClearingTruth(result) {
  for (const flag of NEGATIVE_TRUTH_FLAGS) assert.equal(result[flag], false, flag);
  assert.equal(result.blocker, PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_CLEARANCE_BLOCKER);
  assert.equal(result.authorizesMainnet, false);
  assert.equal(result.mainnetStatus, "HOLD");
}

function keyRecord(keyId) {
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
      activationSequence: "1",
      retirementSequence: null,
      notBeforeUnixSeconds: (NOW - 3_600n).toString(),
      notAfterUnixSeconds: (NOW + 86_400n).toString(),
      revokedAtUnixSeconds: null,
      compromiseCutoffUnixSeconds: null,
    },
  };
}

function providerTrust({ role, subjectBindingSha256 }) {
  const isX = role === "X_PROVIDER_OBSERVER";
  const key = keyRecord(isX ? "prod-x-observer-key-2026-a" : "prod-d1-observer-key-2026-a");
  const providerKind = isX
    ? PROVIDER_KINDS.X_SOCIAL_EVIDENCE
    : PROVIDER_KINDS.EXTERNAL_CHECKPOINT;
  const trustBinding = createProviderTrustBinding({
    environment: "PRODUCTION",
    providerKind,
    providerIdentitySha256: digest(`${role}:provider-identity`),
    subjectBindingSha256,
    receiptDomainId: isX
      ? "iat-b3/x-social-evidence-provider/production-primary/v1"
      : "iat-b3/external-checkpoint-provider/production-primary/v1",
    keyRegistryResourceId: isX
      ? "prod-x-observer-key-registry-primary"
      : "prod-d1-observer-key-registry-primary",
    ownerProductionKeyEvidenceSha256: digest(`${role}:owner-key-evidence`),
    maximumEnvelopeAgeSeconds: "120",
    maximumFutureSkewSeconds: "30",
    maximumKeyOverlapSequences: "1",
    keys: [key.record],
  });
  return { role, key, trustBinding };
}

function fixture({ duplicateFailureDomain = false } = {}) {
  const subjectBindingSha256 = digest("common-subject-binding");
  const x = providerTrust({ role: "X_PROVIDER_OBSERVER", subjectBindingSha256 });
  const d1 = providerTrust({ role: "CLOUDFLARE_D1_OBSERVER", subjectBindingSha256 });
  const sources = [
    {
      sourceId: "prod-cloudflare-d1-observer-primary",
      role: d1.role,
      failureDomainId: "cloudflare-account-primary",
      trustBinding: d1.trustBinding,
    },
    {
      sourceId: "prod-x-observer-primary",
      role: x.role,
      failureDomainId: duplicateFailureDomain
        ? "cloudflare-account-primary"
        : "x-provider-account-primary",
      trustBinding: x.trustBinding,
    },
  ];
  const trust = createProductionIdentityIntegrationTrust({
    sources,
    expectedSubjectBindingSha256: subjectBindingSha256,
    expectedHarnessSha256: digest("harness"),
    expectedEnvironmentIdentitySha256: digest("environment-identity"),
    expectedD1DeploymentIdentitySha256: digest("d1-deployment-identity"),
  });
  const binding = {
    schema: PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_BINDING_SCHEMA,
    sourceCommit: gitObject("source-commit"),
    sourceTree: gitObject("source-tree"),
    programArtifactSha256: digest("program-artifact"),
    predicateEvidenceSha256: digest("predicate-evidence"),
    trustSourceSetSha256: trust.sourceSetSha256,
    evaluationNotBeforeUnixSeconds: (NOW - 10n).toString(),
    evaluationNotAfterUnixSeconds: (NOW + 240n).toString(),
  };
  return { trust, binding, contexts: { [x.role]: x, [d1.role]: d1 } };
}

function signedObservation({
  challengeRequest,
  context,
  observedAt,
  expiresAt = observedAt + 60n,
  responseMutation = (record) => record,
  signer = context.key.privateKey,
  sequence = "1",
  previousEnvelopeSha256 = ZERO_SHA256,
}) {
  const requestBytes = Buffer.from(challengeRequest.requestBase64url, "base64url");
  const request = JSON.parse(requestBytes.toString("utf8"));
  const response = responseMutation({
    schema: PRODUCTION_IDENTITY_EXTERNAL_OBSERVER_RESPONSE_SCHEMA,
    environment: request.environment,
    role: request.role,
    sourceId: request.sourceId,
    failureDomainId: request.failureDomainId,
    providerKind: request.providerKind,
    operation: request.operation,
    host: request.host,
    receiptDomainId: request.receiptDomainId,
    receiptDomainSha256: request.receiptDomainSha256,
    subjectBindingSha256: request.subjectBindingSha256,
    trustSourceSetSha256: request.trustSourceSetSha256,
    capabilityBindingSha256: request.capabilityBindingSha256,
    challengeNonceSha256: request.challengeNonceSha256,
    requestSha256: sha256(requestBytes),
    observationSha256: digest(`${request.role}:${observedAt}`),
    observedAtUnixSeconds: observedAt.toString(),
    expiresAtUnixSeconds: expiresAt.toString(),
  });
  const responseBytes = canonicalBytes(response);
  const unsignedEnvelope = {
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
    keyId: context.key.record.keyId,
    signatureAlgorithm: PROVIDER_SIGNATURE_ALGORITHM,
    operation: request.operation,
    sequence,
    previousEnvelopeSha256,
    requestNonceSha256: request.challengeNonceSha256,
    requestSha256: sha256(requestBytes),
    responseSha256: sha256(responseBytes),
    issuedAtUnixSeconds: (observedAt - 2n).toString(),
    expiresAtUnixSeconds: expiresAt.toString(),
  };
  const signatureBase64url = sign(
    null,
    providerEnvelopeSigningBytes(unsignedEnvelope),
    signer,
  ).toString("base64url");
  return {
    sourceId: request.sourceId,
    stateBefore: createProviderEnvelopeGenesisState(context.trustBinding),
    envelope: createProviderSignedEnvelope({ unsignedEnvelope, signatureBase64url }),
    requestBytes,
    responseBytes,
  };
}

function observationsForChallenge(
  setup,
  challenge,
  { x = {}, d1 = {} } = {},
) {
  const inspected = inspectProductionIdentityExternalObserverChallenge(challenge);
  assert.equal(inspected.status, "STRUCTURAL_CHALLENGE_READY_HOLD_ONLY");
  assertNonClearingTruth(inspected);
  const requests = Object.fromEntries(inspected.requests.map((request) => [request.role, request]));
  return {
    xObservation: signedObservation({
      challengeRequest: requests.X_PROVIDER_OBSERVER,
      context: setup.contexts.X_PROVIDER_OBSERVER,
      observedAt: NOW,
      ...x,
    }),
    d1Observation: signedObservation({
      challengeRequest: requests.CLOUDFLARE_D1_OBSERVER,
      context: setup.contexts.CLOUDFLARE_D1_OBSERVER,
      observedAt: NOW + 2n,
      ...d1,
    }),
  };
}

function acquire(setup, challenge, observations, extras = {}) {
  return acquireProductionIdentityExternalObserverCapability({
    challenge,
    trust: setup.trust,
    ...observations,
    ...extras,
  });
}

function challengeFor(setup) {
  return createProductionIdentityExternalObserverChallenge({
    trust: setup.trust,
    binding: setup.binding,
  });
}

test("default trust is UNCONFIGURED_HOLD and caller bytes cannot forge a challenge", () => {
  const result = createProductionIdentityExternalObserverChallenge();
  assert.equal(result.status, "HOLD");
  assert.equal(result.failureReason, "UNCONFIGURED_HOLD");
  assert.equal(result.capabilityIssued, false);
  assertNonClearingTruth(result);
  assert.equal(inspectProductionIdentityExternalObserverChallenge({}), null);
  const forged = acquireProductionIdentityExternalObserverCapability({
    challenge: {},
    trust: {},
    xObservation: {},
    d1Observation: {},
  });
  assert.equal(forged.failureReason, "EXTERNAL_OBSERVER_CHALLENGE_INVALID_OR_CONSUMED_HOLD");
  assertNonClearingTruth(forged);
});

test("two distinct signed observers issue one opaque capability and exact binding consumes once", () => {
  const setup = fixture();
  const challenge = challengeFor(setup);
  assertNonClearingTruth(challenge);
  const challengeFacts = inspectProductionIdentityExternalObserverChallenge(challenge);
  assert.equal(challengeFacts.requests.length, 2);
  assert.deepEqual(challengeFacts.requests.map(({ host }) => host).sort(), [
    "api.cloudflare.com",
    "api.x.com",
  ]);
  const capability = acquire(setup, challenge, observationsForChallenge(setup, challenge));
  assert.equal(isProductionIdentityExternalObserverCapability(capability), true);
  assertNonClearingTruth(capability);
  assert.ok(Reflect.ownKeys(capability).length > 0);
  assert.equal(Object.getPrototypeOf(capability), null);
  const facts = inspectProductionIdentityExternalObserverCapability(capability);
  assert.equal(facts.evaluationUnixSeconds, (NOW + 2n).toString());
  assert.equal(facts.sources.length, 2);
  assert.equal(facts.inspectOnly, true);
  assertNonClearingTruth(facts);
  assert.equal(isProductionIdentityExternalObserverCapability({ ...capability }), false);
  assert.equal(isProductionIdentityExternalObserverCapability(structuredClone(capability)), false);

  const consumed = consumeProductionIdentityExternalObserverCapability(capability, setup.binding);
  assert.equal(consumed.status, "CONSUMED_HOLD_ONLY_CLAIMS");
  assert.equal(consumed.capabilityConsumed, true);
  assertNonClearingTruth(consumed);
  assert.equal(isProductionIdentityExternalObserverCapability(capability), false);
  assert.equal(
    consumeProductionIdentityExternalObserverCapability(capability, setup.binding).failureReason,
    "EXTERNAL_OBSERVER_CAPABILITY_INVALID_OR_CONSUMED_HOLD",
  );
});

test("caller scalar time is HOLD and burns the one-use challenge", () => {
  const setup = fixture();
  const challenge = challengeFor(setup);
  const observations = observationsForChallenge(setup, challenge);
  const result = acquire(setup, challenge, observations, { evaluationUnixSeconds: NOW });
  assert.equal(result.failureReason, "CALLER_SUPPLIED_EVALUATION_TIME_HOLD");
  assertNonClearingTruth(result);
  assert.equal(acquire(setup, challenge, observations).failureReason,
    "EXTERNAL_OBSERVER_CHALLENGE_INVALID_OR_CONSUMED_HOLD");
});

test("binding mismatch burns capability and inspection cannot activate it", () => {
  const setup = fixture();
  const challenge = challengeFor(setup);
  const capability = acquire(setup, challenge, observationsForChallenge(setup, challenge));
  assert.equal(inspectProductionIdentityExternalObserverCapability(capability).mainnetStatus, "HOLD");
  const mismatch = {
    ...setup.binding,
    predicateEvidenceSha256: digest("other-predicate-evidence"),
  };
  assert.equal(
    consumeProductionIdentityExternalObserverCapability(capability, mismatch).failureReason,
    "EXTERNAL_OBSERVER_CAPABILITY_BINDING_MISMATCH_HOLD",
  );
  assert.equal(isProductionIdentityExternalObserverCapability(capability), false);
});

test("trust must contain fixed roles in two distinct configured failure domains", () => {
  const setup = fixture({ duplicateFailureDomain: true });
  const result = challengeFor(setup);
  assert.equal(result.status, "HOLD");
  assert.equal(result.failureReason, "EXTERNAL_OBSERVER_TRUST_INVALID");
  assertNonClearingTruth(result);
});

test("signed host, domain, source, signature, expiry, skew, and replay substitutions fail closed", async (t) => {
  const cases = [
    ["host", { x: { responseMutation: (record) => ({ ...record, host: "api.x.com.evil" }) } }, /HOST_MISMATCH/u],
    ["receipt domain", {
      d1: { responseMutation: (record) => ({ ...record, receiptDomainId: "iat-v2/cloudflare-d1/production-secondary/v1" }) },
    }, /RECEIPTDOMAINID_MISMATCH/u],
    ["source", {
      x: { responseMutation: (record) => ({ ...record, sourceId: "prod-x-observer-secondary" }) },
    }, /SOURCEID_MISMATCH/u],
    ["failure domain", {
      d1: { responseMutation: (record) => ({ ...record, failureDomainId: "cloudflare-account-secondary" }) },
    }, /FAILUREDOMAINID_MISMATCH/u],
    ["challenge nonce", {
      x: { responseMutation: (record) => ({ ...record, challengeNonceSha256: digest("other-nonce") }) },
    }, /CHALLENGENONCESHA256_MISMATCH/u],
    ["expired response", { x: { expiresAt: NOW } }, /FRESHNESS_WINDOW_INVALID/u],
    ["signed time skew", { d1: { observedAt: NOW + 31n } }, /SIGNED_TIME_SKEW_HOLD/u],
    ["sequence skip", {
      x: { sequence: "2", previousEnvelopeSha256: digest("unbound-predecessor") },
    }, /REPLAY_SKIP_OR_SAME_SEQUENCE_FORK_HOLD/u],
  ];
  for (const [name, mutations, expected] of cases) {
    await t.test(name, () => {
      const setup = fixture();
      const challenge = challengeFor(setup);
      const result = acquire(
        setup,
        challenge,
        observationsForChallenge(setup, challenge, mutations),
      );
      assert.equal(result.status, "HOLD");
      assert.match(result.failureReason, expected);
      assertNonClearingTruth(result);
    });
  }

  await t.test("cryptographic signature", () => {
    const setup = fixture();
    const wrong = generateKeyPairSync("ed25519").privateKey;
    const challenge = challengeFor(setup);
    const result = acquire(setup, challenge, observationsForChallenge(setup, challenge, {
      x: { signer: wrong },
    }));
    assert.equal(result.status, "HOLD");
    assert.match(result.failureReason, /SIGNATURE_INVALID/u);
  });

  await t.test("same challenge replay", () => {
    const setup = fixture();
    const challenge = challengeFor(setup);
    const observations = observationsForChallenge(setup, challenge);
    assert.equal(isProductionIdentityExternalObserverCapability(
      acquire(setup, challenge, observations),
    ), true);
    assert.equal(acquire(setup, challenge, observations).failureReason,
      "EXTERNAL_OBSERVER_CHALLENGE_INVALID_OR_CONSUMED_HOLD");
  });
});

test("nested accessors and symbols fail after burn; proxy-backed inputs are snapshotted without reads", async (t) => {
  await t.test("nested envelope accessor", () => {
    const setup = fixture();
    const challenge = challengeFor(setup);
    const observations = observationsForChallenge(setup, challenge);
    const envelope = { ...observations.xObservation.envelope };
    Object.defineProperty(envelope, "operation", {
      enumerable: true,
      get: () => "X_PUBLIC_ACTION_OBSERVATION",
    });
    observations.xObservation = { ...observations.xObservation, envelope };
    const result = acquire(setup, challenge, observations);
    assert.equal(result.status, "HOLD");
    assert.match(result.failureReason, /accessor forbidden/u);
    assert.equal(acquire(setup, challenge, observations).failureReason,
      "EXTERNAL_OBSERVER_CHALLENGE_INVALID_OR_CONSUMED_HOLD");
  });

  await t.test("nested state symbol", () => {
    const setup = fixture();
    const challenge = challengeFor(setup);
    const observations = observationsForChallenge(setup, challenge);
    const stateBefore = { ...observations.d1Observation.stateBefore };
    stateBefore[Symbol("hostile")] = true;
    observations.d1Observation = { ...observations.d1Observation, stateBefore };
    const result = acquire(setup, challenge, observations);
    assert.equal(result.status, "HOLD");
    assert.match(result.failureReason, /symbol keys forbidden/u);
  });

  await t.test("proxy get substitution is isolated by data-descriptor snapshot", () => {
    const setup = fixture();
    const challenge = challengeFor(setup);
    const observations = observationsForChallenge(setup, challenge);
    let propertyReads = 0;
    observations.xObservation = {
      ...observations.xObservation,
      envelope: new Proxy(observations.xObservation.envelope, {
        get() {
          propertyReads += 1;
          return "attacker-substitution";
        },
      }),
    };
    const capability = acquire(setup, challenge, observations);
    assert.equal(isProductionIdentityExternalObserverCapability(capability), true);
    assert.equal(propertyReads, 0);
  });
});

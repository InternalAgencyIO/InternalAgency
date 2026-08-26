import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PROVIDER_AUTHENTICATION_STATUS,
  PROVIDER_KEY_MATERIAL_CLASS,
  PROVIDER_KINDS,
  PROVIDER_SIGNATURE_ALGORITHM,
  createProviderEnvelopeGenesisState,
  createProviderSignedEnvelope,
  createProviderTrustBinding,
  providerEnvelopeSigningBytes,
  verifyProviderSignedEnvelope,
} from "../programs/iat_b3_reference/provider-authenticated-envelope.mjs";
import { canonicalizeRfc8785 } from "../scripts/iat-v2-canonical-json.mjs";
import {
  PRODUCTION_IDENTITY_INTEGRATION_ENVIRONMENT,
  PRODUCTION_IDENTITY_INTEGRATION_EVIDENCE_SCHEMA,
  PRODUCTION_IDENTITY_INTEGRATION_PREDICATE,
  PRODUCTION_IDENTITY_INTEGRATION_SCENARIO_IDS,
  createProductionIdentityIntegrationTrust,
  loadProductionIdentityIntegrationTrust,
  parseProductionIdentityIntegrationEvidenceJson,
  productionIdentityIntegrationScenarioSetSha256,
  validateProductionIdentityIntegrationEvidence,
  validateProductionIdentityIntegrationTrust,
} from "../scripts/lib/iat-v2-production-identity-integration-evidence.mjs";
import {
  produceProductionIdentityIntegrationEvidence,
} from "../scripts/run-iat-v2-production-identity-integration-rehearsal.mjs";

const NOW = 2_000_000_000n;
const SOURCE_COMMIT = "a".repeat(40);
const SOURCE_TREE = "b".repeat(40);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const digest = (value) => sha256(Buffer.from(`identity-integration:${value}`, "utf8"));
const EXPECTED_SUBJECT_BINDING_SHA256 = digest("canonical-integration-subject");
const EXPECTED_HARNESS_SHA256 = digest("canonical-rehearsal-harness");
const EXPECTED_ENVIRONMENT_IDENTITY_SHA256 = digest("canonical-integration-environment");
const EXPECTED_D1_DEPLOYMENT_IDENTITY_SHA256 = digest("canonical-cloudflare-deployment");
const utc = (seconds) => new Date(Number(seconds) * 1_000)
  .toISOString()
  .replace(".000Z", "Z");
const canonicalBytes = (value) => Buffer.from(canonicalizeRfc8785(value), "utf8");
const evidenceBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

function createObserver({
  providerKind,
  role,
  sourceId,
  failureDomainId,
  identity,
  subjectBindingSha256,
}) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = Buffer.from(publicKey.export({ format: "der", type: "spki" }));
  const providerSegment = providerKind === PROVIDER_KINDS.EXTERNAL_CHECKPOINT
    ? "external-checkpoint-provider"
    : "x-social-evidence-provider";
  const trustBinding = createProviderTrustBinding({
    environment: "PRODUCTION",
    providerKind,
    providerIdentitySha256: digest(`${identity}:provider`),
    subjectBindingSha256,
    receiptDomainId: `iat-b3/${providerSegment}/${identity}/v1`,
    keyRegistryResourceId: `registry.identity.${identity}.primary`,
    ownerProductionKeyEvidenceSha256: digest(`${identity}:owner-key-evidence`),
    maximumEnvelopeAgeSeconds: "300",
    maximumFutureSkewSeconds: "30",
    maximumKeyOverlapSequences: "1",
    keys: [{
      keyId: `identity-observer-key-${identity}-2026-a`,
      algorithm: PROVIDER_SIGNATURE_ALGORITHM,
      keyMaterialClass: PROVIDER_KEY_MATERIAL_CLASS,
      publicKeySpkiDerBase64url: publicKeyDer.toString("base64url"),
      publicKeySha256: sha256(publicKeyDer),
      activationSequence: "1",
      retirementSequence: null,
      notBeforeUnixSeconds: (NOW - 3_600n).toString(),
      notAfterUnixSeconds: (NOW + 86_400n).toString(),
      revokedAtUnixSeconds: null,
      compromiseCutoffUnixSeconds: null,
    }],
  });
  return {
    privateKey,
    source: {
      sourceId,
      role,
      failureDomainId,
      trustBinding,
    },
  };
}

function createSignedObservation({
  observer,
  operation,
  request,
  response,
  correlationNonceSha256,
}) {
  const { source } = observer;
  const requestBytes = canonicalBytes(request);
  const responseBytes = canonicalBytes(response);
  const stateBefore = createProviderEnvelopeGenesisState(source.trustBinding);
  const unsignedEnvelope = {
    schema: "iat-b3-provider-signed-envelope/v1",
    status: PROVIDER_AUTHENTICATION_STATUS,
    environment: "PRODUCTION",
    providerKind: source.trustBinding.providerKind,
    providerIdentitySha256: source.trustBinding.providerIdentitySha256,
    subjectBindingSha256: source.trustBinding.subjectBindingSha256,
    trustBindingSha256: source.trustBinding.trustBindingSha256,
    receiptDomainSha256: source.trustBinding.receiptDomainSha256,
    trustRootSha256: source.trustBinding.trustRootSha256,
    keyRegistrySnapshotSha256: source.trustBinding.keyRegistrySnapshotSha256,
    keyId: source.trustBinding.keys[0].keyId,
    signatureAlgorithm: PROVIDER_SIGNATURE_ALGORITHM,
    operation,
    sequence: "1",
    previousEnvelopeSha256: "0".repeat(64),
    requestNonceSha256: correlationNonceSha256,
    requestSha256: sha256(requestBytes),
    responseSha256: sha256(responseBytes),
    issuedAtUnixSeconds: (NOW - 5n).toString(),
    expiresAtUnixSeconds: (NOW + 120n).toString(),
  };
  const signatureBase64url = sign(
    null,
    providerEnvelopeSigningBytes(unsignedEnvelope),
    observer.privateKey,
  ).toString("base64url");
  const envelope = createProviderSignedEnvelope({
    unsignedEnvelope,
    signatureBase64url,
  });
  const verificationReceipt = verifyProviderSignedEnvelope({
    trustBinding: source.trustBinding,
    currentState: stateBefore,
    envelope,
    requestBytes,
    responseBytes,
    expectedRequestNonceSha256: correlationNonceSha256,
    evaluationUnixSeconds: NOW,
  });
  return {
    sourceId: source.sourceId,
    stateBefore,
    envelope,
    requestObservationBase64url: requestBytes.toString("base64url"),
    responseObservationBase64url: responseBytes.toString("base64url"),
    expectedRequestNonceSha256: correlationNonceSha256,
    verificationReceipt,
  };
}

function fixture({
  xSubjectBindingSha256 = EXPECTED_SUBJECT_BINDING_SHA256,
  d1SubjectBindingSha256 = EXPECTED_SUBJECT_BINDING_SHA256,
  mutationSubjectBindingSha256 = EXPECTED_SUBJECT_BINDING_SHA256,
  harnessSha256 = EXPECTED_HARNESS_SHA256,
  environmentIdentitySha256 = EXPECTED_ENVIRONMENT_IDENTITY_SHA256,
  d1DeploymentIdentitySha256 = EXPECTED_D1_DEPLOYMENT_IDENTITY_SHA256,
} = {}) {
  const xObserver = createObserver({
    providerKind: PROVIDER_KINDS.X_SOCIAL_EVIDENCE,
    role: "X_PROVIDER_OBSERVER",
    sourceId: "observer.x.primary",
    failureDomainId: "domain.x.primary",
    identity: "x-primary",
    subjectBindingSha256: xSubjectBindingSha256,
  });
  const d1Observer = createObserver({
    providerKind: PROVIDER_KINDS.EXTERNAL_CHECKPOINT,
    role: "CLOUDFLARE_D1_OBSERVER",
    sourceId: "observer.cloudflare.primary",
    failureDomainId: "domain.cloudflare.primary",
    identity: "cloudflare-primary",
    subjectBindingSha256: d1SubjectBindingSha256,
  });
  const trust = createProductionIdentityIntegrationTrust({
    sources: [xObserver.source, d1Observer.source],
    expectedSubjectBindingSha256: EXPECTED_SUBJECT_BINDING_SHA256,
    expectedHarnessSha256: EXPECTED_HARNESS_SHA256,
    expectedEnvironmentIdentitySha256: EXPECTED_ENVIRONMENT_IDENTITY_SHA256,
    expectedD1DeploymentIdentitySha256: EXPECTED_D1_DEPLOYMENT_IDENTITY_SHA256,
  });
  const programArtifactSha256 = digest("program-artifact");
  const correlationNonceSha256 = digest("correlation-nonce");
  const observedAtUtc = utc(NOW);
  const scenarios = PRODUCTION_IDENTITY_INTEGRATION_SCENARIO_IDS.map((id) => ({
    id,
    result: "PASS",
    evidenceSha256: digest(`scenario:${id}`),
  }));
  const xRequest = {
    schema: "iat-v2-production-identity-x-request-observation/v1",
    environment: PRODUCTION_IDENTITY_INTEGRATION_ENVIRONMENT,
    endpoint: "https://api.x.com/2/users/me?user.fields=created_at,subscription_type",
    method: "GET",
    correlationNonceSha256,
    sourceCommit: SOURCE_COMMIT,
    programArtifactSha256,
  };
  const xResponse = {
    schema: "iat-v2-production-identity-x-response-observation/v1",
    environment: PRODUCTION_IDENTITY_INTEGRATION_ENVIRONMENT,
    httpStatus: 200,
    providerRequestIdSha256: digest("x-provider-request"),
    immutableXUserIdSha256: digest("x-user"),
    subscriptionType: "Premium",
    accountCreatedAtUtc: utc(NOW - (41n * 24n * 60n * 60n)),
    observedAtUtc,
    oauthTokenRetained: false,
    personalDataRetained: false,
  };
  const mutationReceipt = {
    schema: "iat-b3-retained-v2-x-callback-mutation-receipt/v1",
    status: "COMMITTED",
    atomicCommitVerified: true,
    subjectBindingSha256: mutationSubjectBindingSha256,
    writeAdapterSha256: digest("d1-write-adapter"),
    immediateTranchePersisted: true,
    conditionalUpgradePersisted: true,
    mutationReceiptSha256: digest("d1-mutation-receipt"),
  };
  const d1Request = {
    schema: "iat-v2-production-identity-d1-request-observation/v1",
    environment: PRODUCTION_IDENTITY_INTEGRATION_ENVIRONMENT,
    operation: "INTEGRATION_REHEARSAL_ATOMIC_MUTATION",
    correlationNonceSha256,
    sourceCommit: SOURCE_COMMIT,
    programArtifactSha256,
  };
  const d1Response = {
    schema: "iat-v2-production-identity-d1-response-observation/v1",
    environment: PRODUCTION_IDENTITY_INTEGRATION_ENVIRONMENT,
    httpStatus: 200,
    cloudflareRequestIdSha256: digest("cloudflare-request"),
    databaseIdentitySha256: digest("d1-database"),
    deploymentIdentitySha256: d1DeploymentIdentitySha256,
    stateBeforeSha256: digest("d1-state-before"),
    stateAfterSha256: digest("d1-state-after"),
    mutationReceipt,
    scenarioSetSha256: productionIdentityIntegrationScenarioSetSha256(scenarios),
    observedAtUtc,
  };
  const xObservation = createSignedObservation({
    observer: xObserver,
    operation: "X_IDENTITY_TIER_OBSERVATION",
    request: xRequest,
    response: xResponse,
    correlationNonceSha256,
  });
  const d1Observation = createSignedObservation({
    observer: d1Observer,
    operation: "CHECKPOINT_COMPARE_AND_SWAP",
    request: d1Request,
    response: d1Response,
    correlationNonceSha256,
  });
  const evidence = {
    schema: PRODUCTION_IDENTITY_INTEGRATION_EVIDENCE_SCHEMA,
    status: "DIRECT_EVIDENCE_COMPLETE",
    predicate: PRODUCTION_IDENTITY_INTEGRATION_PREDICATE,
    environment: PRODUCTION_IDENTITY_INTEGRATION_ENVIRONMENT,
    sourceBinding: {
      commit: SOURCE_COMMIT,
      tree: SOURCE_TREE,
      programArtifactSha256,
    },
    runBinding: {
      harnessSha256,
      environmentIdentitySha256,
      startedAtUtc: utc(NOW - 60n),
      completedAtUtc: observedAtUtc,
    },
    trustBindingSha256: trust.sourceSetSha256,
    correlationNonceSha256,
    xObservation,
    d1Observation,
    scenarios,
    safety: {
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
    },
    observedAtUtc,
    expiresAtUtc: utc(NOW + 600n),
    receiptUrls: [
      `https://evidence.internalagency.io/x/${xObservation.envelope.envelopeSha256}`,
      `https://evidence.internalagency.io/d1/${d1Observation.envelope.envelopeSha256}`,
    ],
    mainnetStatus: "HOLD",
  };
  return { evidence, programArtifactSha256, trust };
}

function validate({ evidence, programArtifactSha256, trust }, overrides = {}) {
  return validateProductionIdentityIntegrationEvidence({
    evidenceBytes: evidenceBytes(evidence),
    trust,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedProgramArtifactSha256: programArtifactSha256,
    evaluationUnixSeconds: NOW,
    ...overrides,
  });
}

test("canonical trust is an explicit empty HOLD without source identities or key material", () => {
  const trust = loadProductionIdentityIntegrationTrust();
  assert.deepEqual(validateProductionIdentityIntegrationTrust(trust), {
    valid: true,
    configured: false,
    sourcesByRole: new Map(),
    sourceSetSha256: null,
    expectedSubjectBindingSha256: null,
    expectedHarnessSha256: null,
    expectedEnvironmentIdentitySha256: null,
    expectedD1DeploymentIdentitySha256: null,
    violations: [],
  });
  assert.equal(trust.status, "UNCONFIGURED_HOLD");
  assert.deepEqual(trust.sources, []);
  assert.equal(trust.sourceSetSha256, null);

  const configuredFixture = fixture();
  const result = validate(configuredFixture, { trust });
  assert.equal(result.valid, false);
  assert.ok(result.violations.includes("TRUST_UNCONFIGURED_HOLD"));
  assert.equal(result.mainnetStatus, "HOLD");
});

test("canonical-trust-pinned X and D1 observer envelopes validate while Mainnet remains HOLD", () => {
  const value = fixture();
  const trustResult = validateProductionIdentityIntegrationTrust(value.trust);
  assert.equal(trustResult.valid, true);
  assert.equal(trustResult.configured, true);

  const result = validate(value);
  assert.equal(result.valid, true, result.violations.join("\n"));
  assert.equal(result.sourceBound, true);
  assert.equal(result.canonicalTrustPinsConfigured, true);
  assert.equal(result.canonicalTrustPinnedObserverSignaturesVerified, true);
  assert.equal(result.xOAuthObserved, true);
  assert.equal(result.d1MutationObserved, true);
  assert.equal(result.allScenariosPassed, true);
  assert.deepEqual(result.checkIds, PRODUCTION_IDENTITY_INTEGRATION_SCENARIO_IDS);
  assert.equal(result.mainnetStatus, "HOLD");

  const produced = produceProductionIdentityIntegrationEvidence({
    candidateBytes: evidenceBytes(value.evidence),
    trust: value.trust,
    expectedSourceCommit: SOURCE_COMMIT,
    expectedSourceTree: SOURCE_TREE,
    expectedProgramArtifactSha256: value.programArtifactSha256,
    evaluationUnixSeconds: NOW,
  });
  assert.equal(produced, `${JSON.stringify(value.evidence, null, 2)}\n`);
});

test("duplicate JSON fields are rejected before any observer-evidence decision", () => {
  assert.throws(
    () => parseProductionIdentityIntegrationEvidenceJson(
      '{"schema":"first","schema":"second"}',
    ),
    /duplicate JSON member/u,
  );
});

test("binding, scenario, safety, signature, and D1 mutations fail closed", () => {
  const cases = [
    (value) => { value.evidence.sourceBinding.commit = "c".repeat(40); },
    (value) => { value.evidence.scenarios[0].result = "FAIL"; },
    (value) => { value.evidence.safety.mainnetRequestPerformed = true; },
    (value) => {
      value.evidence.xObservation.envelope = {
        ...value.evidence.xObservation.envelope,
        signatureBase64url: "A".repeat(86),
      };
    },
    (value) => {
      const response = parseProductionIdentityIntegrationEvidenceJson(
        Buffer.from(value.evidence.d1Observation.responseObservationBase64url, "base64url")
          .toString("utf8"),
        "D1 response",
      );
      response.mutationReceipt.atomicCommitVerified = false;
      value.evidence.d1Observation.responseObservationBase64url = canonicalBytes(response)
        .toString("base64url");
    },
  ];
  for (const mutate of cases) {
    const value = fixture();
    mutate(value);
    assert.equal(validate(value).valid, false);
  }
});

test("subject, harness, environment, deployment, and mutation-subject drift fail closed", () => {
  const cases = [
    [
      fixture({ xSubjectBindingSha256: digest("cross-subject-drift") }),
      /canonical subject binding mismatch/u,
    ],
    [
      fixture({ harnessSha256: digest("harness-drift") }),
      /harnessSha256: canonical trust pin mismatch/u,
    ],
    [
      fixture({ environmentIdentitySha256: digest("environment-drift") }),
      /environmentIdentitySha256: canonical trust pin mismatch/u,
    ],
    [
      fixture({ d1DeploymentIdentitySha256: digest("deployment-drift") }),
      /canonical-deployment nonproduction result/u,
    ],
    [
      fixture({ mutationSubjectBindingSha256: digest("mutation-subject-drift") }),
      /canonical-subject-bound atomic retained-V2 result/u,
    ],
  ];
  for (const [value, expectedViolation] of cases) {
    const result = validate(value);
    assert.equal(result.valid, false);
    assert.match(result.violations.join("\n"), expectedViolation);
    assert.equal(result.mainnetStatus, "HOLD");
  }
});

test("producer refuses production-targeted or missing observer receipt candidates", () => {
  const production = fixture();
  production.evidence.environment = "PRODUCTION";
  assert.throws(
    () => produceProductionIdentityIntegrationEvidence({
      candidateBytes: evidenceBytes(production.evidence),
      trust: production.trust,
      expectedSourceCommit: SOURCE_COMMIT,
      expectedSourceTree: SOURCE_TREE,
      expectedProgramArtifactSha256: production.programArtifactSha256,
      evaluationUnixSeconds: NOW,
    }),
    /PRODUCTION_OR_MISSING_EXTERNAL_RECEIPTS_HOLD/u,
  );

  const missingReceipts = fixture();
  missingReceipts.evidence.receiptUrls = [];
  assert.throws(
    () => produceProductionIdentityIntegrationEvidence({
      candidateBytes: evidenceBytes(missingReceipts.evidence),
      trust: missingReceipts.trust,
      expectedSourceCommit: SOURCE_COMMIT,
      expectedSourceTree: SOURCE_TREE,
      expectedProgramArtifactSha256: missingReceipts.programArtifactSha256,
      evaluationUnixSeconds: NOW,
    }),
    /CANONICAL_OBSERVER_IDENTITY_INTEGRATION_HOLD/u,
  );

  const source = readFileSync(
    new URL("../scripts/run-iat-v2-production-identity-integration-rehearsal.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /\bfetch\s*\(/u);
});

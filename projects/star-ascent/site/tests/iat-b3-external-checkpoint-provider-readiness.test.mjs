import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { REFERENCE_DEPLOYMENT_DOMAIN_SHA256 } from "../programs/iat_b3_reference/reward-allocator-receipt-codec.mjs";
import {
  REWARD_CAS_EXTERNAL_NAMESPACE_SHA256,
  REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256,
} from "../programs/iat_b3_reference/reward-persistence-checkpoint.mjs";
import {
  CONTROL_SPECS,
  PROVIDER_READINESS_MAINNET_STATUS,
  PROVIDER_READINESS_SCHEMA,
  PROVIDER_READINESS_STATUS,
  REQUIRED_PROVIDER_READINESS_SECTIONS,
  TEST_FIXTURE_PROVIDER_READINESS_VALUES as FIXTURE,
  assertExternalCheckpointProviderReviewPacketComplete,
  providerReadinessEvidencePolicySha256,
  providerReadinessSubjectBindingSha256,
  validateExternalCheckpointProviderReadinessManifest,
} from "../scripts/validate-iat-b3-external-checkpoint-provider-readiness.mjs";

const manifestPath = new URL(
  "../docs/b3/iat-b3-external-checkpoint-provider-readiness.v1.json",
  import.meta.url,
);
const schemaPath = new URL(
  "../docs/b3/iat-b3-external-checkpoint-provider-readiness.v1.schema.json",
  import.meta.url,
);
const validatorPath = new URL(
  "../scripts/validate-iat-b3-external-checkpoint-provider-readiness.mjs",
  import.meta.url,
);
const draft = JSON.parse(readFileSync(manifestPath, "utf8"));
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const EVALUATION_UNIX_SECONDS = "2050000000";

const clone = (value) => structuredClone(value);

function evidenceFor(manifest, sectionId) {
  return {
    evidenceKind: `${sectionId}_EVIDENCE_V1`,
    artifactSha256: FIXTURE.evidenceArtifactSha256BySection[sectionId],
    subjectBindingSha256: providerReadinessSubjectBindingSha256(manifest),
    policySha256: providerReadinessEvidencePolicySha256(manifest, sectionId),
    independentObserverId: FIXTURE.independentObserverId,
    observerIdentitySha256: FIXTURE.observerIdentitySha256,
    capturedAtUnixSeconds: FIXTURE.capturedAtUnixSeconds,
    validThroughUnixSeconds: FIXTURE.validThroughUnixSeconds,
    environment: manifest.profile,
  };
}

function rebindAllEvidence(manifest) {
  manifest.subjectBinding.evidence = evidenceFor(manifest, "SUBJECT_BINDING");
  manifest.providerBinding.evidence = evidenceFor(manifest, "PROVIDER_BINDING");
  manifest.failureDomainSeparation.evidence = evidenceFor(manifest, "FAILURE_DOMAIN_SEPARATION");
  for (const control of manifest.controlRequirements) {
    control.evidence = evidenceFor(manifest, control.id);
  }
}

function completeFixture() {
  const manifest = clone(draft);
  manifest.profile = "TEST_FIXTURE";
  manifest.readiness = "READY_FOR_PROVIDER_REVIEW";
  Object.assign(manifest.subjectBinding, FIXTURE.subject, {
    status: "PACKET_COMPLETE",
    blocker: null,
  });
  Object.assign(manifest.providerBinding, FIXTURE.provider, {
    status: "PACKET_COMPLETE",
    blocker: null,
  });
  Object.assign(manifest.failureDomainSeparation, FIXTURE.failureDomains, {
    status: "PACKET_COMPLETE",
    blocker: null,
  });
  for (const control of manifest.controlRequirements) {
    Object.assign(control, { status: "PACKET_COMPLETE", blocker: null });
  }
  Object.assign(manifest.terminalPredicate, { status: "PACKET_COMPLETE", blocker: null });
  rebindAllEvidence(manifest);
  return manifest;
}

function fixtureResult(manifest, options = {}) {
  return validateExternalCheckpointProviderReadinessManifest(manifest, {
    allowTestFixture: true,
    evaluationUnixSeconds: EVALUATION_UNIX_SECONDS,
    ...options,
  });
}

function expectNotReady(mutator, pattern, options = {}) {
  const manifest = completeFixture();
  mutator(manifest);
  const result = fixtureResult(manifest, options);
  assert.equal(result.providerReviewPacketComplete, false);
  assert.match(result.violations.join("\n"), pattern);
  return result;
}

test("the production provider-readiness manifest is strict, honestly BLOCKED, null-unresolved, and held", () => {
  const result = validateExternalCheckpointProviderReadinessManifest(draft);
  assert.equal(result.valid, true);
  assert.equal(result.providerReviewPacketComplete, false);
  assert.equal("providerReadinessReady" in result, false);
  assert.equal(result.productionReviewPacketComplete, false);
  assert.equal(result.certifiesProviderOperationalTruth, false);
  assert.equal(result.mainnetOrReleaseReady, false);
  assert.equal("productionReady" in result, false);
  assert.equal(result.mainnetStatus, "HOLD");
  assert.equal(PROVIDER_READINESS_SCHEMA, "iat-b3-external-checkpoint-provider-readiness/v1");
  assert.equal(PROVIDER_READINESS_STATUS, "NON_ACTIVATING_PROVIDER_READINESS_REVIEW_PACKET");
  assert.equal(PROVIDER_READINESS_MAINNET_STATUS, "HOLD");
  for (const flag of [
    "runtimeAuthenticationVerified",
    "externalMonotonicityVerified",
    "rollbackProtectionVerified",
    "activationReady",
  ]) {
    assert.equal(result[flag], false);
    assert.equal(draft[flag], false);
  }
  assert.equal(draft.profile, "PRODUCTION");
  assert.equal(draft.readiness, "BLOCKED");
  assert.equal(draft.subjectBinding.productionPersistenceIdentitySha256, null);
  assert.equal(draft.subjectBinding.productionDeploymentDomainSha256, null);
  assert.equal(draft.providerBinding.providerLegalEntityId, null);
  assert.equal(draft.providerBinding.resourceId, null);
  assert.equal(draft.failureDomainSeparation.providerWriteFailureDomainId, null);
  assert.equal(draft.controlRequirements.every(({ status, evidence }) => status === "BLOCKED" && evidence === null), true);
  assert.equal(result.blockers.length, 16);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.$defs.evidence.additionalProperties, false);
  assert.equal(schema.properties.runtimeAuthenticationVerified.const, false);
  assert.equal(schema.properties.mainnetStatus.const, "HOLD");
  assert.throws(
    () => assertExternalCheckpointProviderReviewPacketComplete(draft),
    /provider review packet is not complete/iu,
  );
});

test("a complete explicitly authorized fixture proves packet structure without provider or Mainnet verification", () => {
  const manifest = completeFixture();
  const result = fixtureResult(manifest);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.valid, true);
  assert.equal(result.providerReviewPacketComplete, true);
  assert.equal(result.productionReviewPacketComplete, false);
  assert.equal(result.certifiesProviderOperationalTruth, false);
  assert.equal(result.mainnetOrReleaseReady, false);
  assert.equal(result.runtimeAuthenticationVerified, false);
  assert.equal(result.externalMonotonicityVerified, false);
  assert.equal(result.rollbackProtectionVerified, false);
  assert.equal(result.activationReady, false);
  assert.equal(result.mainnetStatus, "HOLD");
  assert.equal(
    assertExternalCheckpointProviderReviewPacketComplete(manifest, {
      allowTestFixture: true,
      evaluationUnixSeconds: EVALUATION_UNIX_SECONDS,
    }).providerReviewPacketComplete,
    true,
  );

  const unauthorized = validateExternalCheckpointProviderReadinessManifest(manifest, {
    evaluationUnixSeconds: EVALUATION_UNIX_SECONDS,
  });
  assert.equal(unauthorized.providerReviewPacketComplete, false);
  assert.match(unauthorized.violations.join("\n"), /requires explicit allowTestFixture/u);
});

test("fixture provider, subject, key, observer, policy, evidence, and DR values cannot be relabeled as production", () => {
  const manifest = completeFixture();
  manifest.profile = "PRODUCTION";
  manifest.subjectBinding.environment = "PRODUCTION";
  manifest.providerBinding.environment = "PRODUCTION";
  manifest.failureDomainSeparation.environment = "PRODUCTION";
  rebindAllEvidence(manifest);
  const result = validateExternalCheckpointProviderReadinessManifest(manifest, {
    allowTestFixture: true,
    evaluationUnixSeconds: EVALUATION_UNIX_SECONDS,
    allowProduction: true,
  });
  assert.equal(result.providerReviewPacketComplete, false);
  assert.equal(result.productionReviewPacketComplete, false);
  assert.match(result.violations.join("\n"), /known TEST_FIXTURE value/u);
  for (const expected of [
    "providerLegalEntityId",
    "resourceId",
    "receiptTrustRootSha256",
    "observerIdentitySha256",
    "artifactSha256",
  ]) assert.match(result.violations.join("\n"), new RegExp(expected, "u"));
});

test("readiness labels, allow-like fields, false flags, and terminal status cannot bypass missing packets", () => {
  const relabeled = clone(draft);
  relabeled.readiness = "READY_FOR_PROVIDER_REVIEW";
  relabeled.terminalPredicate.status = "PACKET_COMPLETE";
  relabeled.terminalPredicate.blocker = null;
  relabeled.runtimeAuthenticationVerified = true;
  const result = validateExternalCheckpointProviderReadinessManifest(relabeled, {
    allowTestFixture: true,
    allowProduction: true,
    evaluationUnixSeconds: EVALUATION_UNIX_SECONDS,
  });
  assert.equal(result.providerReviewPacketComplete, false);
  assert.equal(result.runtimeAuthenticationVerified, false);
  assert.match(result.violations.join("\n"), /runtimeAuthenticationVerified: must remain false/u);
  assert.match(result.violations.join("\n"), /PACKET_COMPLETE contradicts incomplete/u);
  assert.match(result.violations.join("\n"), /READY_FOR_PROVIDER_REVIEW contradicts/u);

  const injected = clone(draft);
  injected.allow = true;
  assert.equal(validateExternalCheckpointProviderReadinessManifest(injected).providerReviewPacketComplete, false);
  assert.match(
    validateExternalCheckpointProviderReadinessManifest(injected).violations.join("\n"),
    /keys must be exactly/u,
  );
});

test("the exact ordered controls and terminal predicate cannot be omitted, duplicated, weakened, or reordered", () => {
  assert.deepEqual(draft.controlRequirements.map(({ id }) => id), CONTROL_SPECS.map(({ id }) => id));
  assert.deepEqual(draft.terminalPredicate.requiredSections, REQUIRED_PROVIDER_READINESS_SECTIONS);
  expectNotReady((value) => {
    [value.controlRequirements[0], value.controlRequirements[1]] = [
      value.controlRequirements[1],
      value.controlRequirements[0],
    ];
  }, /expected LINEARIZABLE_CAS_READBACK/u);
  expectNotReady((value) => {
    value.controlRequirements[1].requiredClaims.pop();
  }, /exact ordered control claims/u);
  expectNotReady((value) => {
    value.controlRequirements.push(clone(value.controlRequirements[0]));
  }, /expected exactly 12 ordered controls/u);
  expectNotReady((value) => {
    value.terminalPredicate.requiredSections.pop();
  }, /exact ordered readiness packets/u);
  expectNotReady((value) => {
    value.controlRequirements[7].requiredClaims[0] = "DATABASE_AHEAD_MAY_CONTINUE_LOCAL_WRITES";
  }, /exact ordered control claims/u);
});

test("content-addressed evidence binds exact subject and policy, is unique and independently observed", () => {
  expectNotReady((value) => {
    value.controlRequirements[0].evidence.subjectBindingSha256 = "aa".repeat(32);
  }, /bind the exact subject/u);
  expectNotReady((value) => {
    value.controlRequirements[1].evidence.policySha256 = "bb".repeat(32);
  }, /bind the exact section control and policy/u);
  expectNotReady((value) => {
    value.controlRequirements[2].evidence.artifactSha256 = value.controlRequirements[1].evidence.artifactSha256;
  }, /duplicate evidence artifact digest/u);
  expectNotReady((value) => {
    value.controlRequirements[3].evidence.independentObserverId = value.providerBinding.resourceId;
  }, /observer cannot be a provider/u);
  expectNotReady((value) => {
    value.controlRequirements[4].evidence.independentObserverId = "https://generic.example/reviewer";
  }, /not a URL/u);
  expectNotReady((value) => {
    value.controlRequirements[5].evidence.artifactSha256 = value.controlRequirements[5].evidence.artifactSha256.toUpperCase();
  }, /lowercase 32-byte hexadecimal/u);
  expectNotReady((value) => {
    value.controlRequirements[6].evidence.environment = "PRODUCTION";
  }, /must equal manifest.profile/u);
});

test("evidence readiness requires an explicit in-window evaluation time and rejects expiry or inverted validity", () => {
  const manifest = completeFixture();
  const missingEvaluation = validateExternalCheckpointProviderReadinessManifest(manifest, {
    allowTestFixture: true,
  });
  assert.equal(missingEvaluation.providerReviewPacketComplete, false);
  assert.match(missingEvaluation.violations.join("\n"), /requires explicit options\.evaluationUnixSeconds/u);
  assert.equal(fixtureResult(manifest, { evaluationUnixSeconds: "1999999999" }).providerReviewPacketComplete, false);
  assert.match(
    fixtureResult(manifest, { evaluationUnixSeconds: "2100000001" }).violations.join("\n"),
    /evidence is not valid/u,
  );
  expectNotReady((value) => {
    value.controlRequirements[0].evidence.validThroughUnixSeconds = value.controlRequirements[0].evidence.capturedAtUnixSeconds;
  }, /validity must end after capture/u);
  expectNotReady((value) => {
    value.controlRequirements[0].evidence.capturedAtUnixSeconds = "0";
  }, /expected a positive unsigned 64-bit value/u);
});

test("provider resources and five failure domains reject placeholders, URLs, cross-environment markers, and duplicates", () => {
  expectNotReady((value) => { value.providerBinding.providerLegalEntityId = "TBD"; }, /non-placeholder identifier/u);
  expectNotReady((value) => { value.providerBinding.resourceId = "https://provider.example/resource"; }, /not a URL/u);
  expectNotReady((value) => {
    value.failureDomainSeparation.backupFailureDomainId = value.failureDomainSeparation.providerWriteFailureDomainId;
  }, /five failure-domain identifiers must be distinct/u);
  expectNotReady((value) => {
    value.failureDomainSeparation.credentialFailureDomainId = value.providerBinding.keyRegistryResourceId;
  }, /globally distinct/u);
  expectNotReady((value) => {
    value.providerBinding.serviceProductId = "aaaaaaaa";
  }, /canonical non-placeholder identifier/u);
  expectNotReady((value) => {
    value.subjectBinding.schemaManifestSha256 = "0".repeat(64);
  }, /repeated-nibble placeholder digest/u);
  expectNotReady((value) => {
    value.controlRequirements[0].evidence.artifactSha256 = "a".repeat(64);
  }, /repeated-nibble placeholder digest/u);

  const productionAttempt = completeFixture();
  productionAttempt.profile = "PRODUCTION";
  productionAttempt.subjectBinding.environment = "PRODUCTION";
  productionAttempt.providerBinding.environment = "PRODUCTION";
  productionAttempt.failureDomainSeparation.environment = "PRODUCTION";
  productionAttempt.subjectBinding.productionDeploymentDomainSha256 = REFERENCE_DEPLOYMENT_DOMAIN_SHA256;
  productionAttempt.subjectBinding.externalNamespaceSha256 = REWARD_CAS_EXTERNAL_NAMESPACE_SHA256;
  productionAttempt.subjectBinding.externalTrustPolicySha256 = REWARD_CAS_EXTERNAL_TRUST_POLICY_SHA256;
  productionAttempt.providerBinding.providerLegalEntityId = "fakeprovider001";
  productionAttempt.providerBinding.serviceProductId = "mockservice001";
  rebindAllEvidence(productionAttempt);
  const result = validateExternalCheckpointProviderReadinessManifest(productionAttempt, {
    allowTestFixture: true,
    evaluationUnixSeconds: EVALUATION_UNIX_SECONDS,
  });
  assert.match(result.violations.join("\n"), /reference-only value is explicitly unfrozen/u);
  assert.match(
    result.violations.join("\n"),
    /providerBinding\.providerLegalEntityId: production identifier contains a non-production marker/u,
  );
  assert.match(
    result.violations.join("\n"),
    /providerBinding\.serviceProductId: production identifier contains a non-production marker/u,
  );
});

test("strict JSON records reject missing, extra, sparse, accessor, symbol, cycle, and prototype aliases without invoking getters", () => {
  const { status: omittedStatus, ...missing } = completeFixture();
  void omittedStatus;
  assert.equal(fixtureResult(missing).providerReviewPacketComplete, false);
  const withSymbol = completeFixture();
  withSymbol[Symbol("extra")] = true;
  assert.match(fixtureResult(withSymbol).violations.join("\n"), /symbol keys are forbidden/u);
  const withHidden = completeFixture();
  Object.defineProperty(withHidden, "hidden", { value: true, enumerable: false });
  assert.match(fixtureResult(withHidden).violations.join("\n"), /data property|keys must be exactly/u);
  const customPrototype = completeFixture();
  Object.setPrototypeOf(customPrototype, { inherited: true });
  assert.match(fixtureResult(customPrototype).violations.join("\n"), /plain JSON object/u);
  const sparse = completeFixture();
  delete sparse.controlRequirements[3];
  assert.match(fixtureResult(sparse).violations.join("\n"), /sparse, decorated, or symbol-key arrays/u);
  let getterRead = false;
  const accessor = completeFixture();
  Object.defineProperty(accessor, "status", {
    enumerable: true,
    get() {
      getterRead = true;
      throw new Error("GETTER_EXECUTED");
    },
  });
  assert.match(fixtureResult(accessor).violations.join("\n"), /data property/u);
  assert.equal(getterRead, false);
  let profileGetterReads = 0;
  const profileAccessor = completeFixture();
  Object.defineProperty(profileAccessor, "profile", {
    enumerable: true,
    get() {
      profileGetterReads += 1;
      throw new Error("PROFILE_GETTER_EXECUTED");
    },
  });
  const profileAccessorResult = fixtureResult(profileAccessor);
  assert.equal(profileAccessorResult.providerReviewPacketComplete, false);
  assert.equal(profileAccessorResult.profile, null);
  assert.match(profileAccessorResult.violations.join("\n"), /data property/u);
  assert.equal(profileGetterReads, 0);

  const valueBearingCycle = completeFixture();
  const cyclicAdapterSchema = {};
  cyclicAdapterSchema.self = cyclicAdapterSchema;
  valueBearingCycle.subjectBinding.adapterSchema = cyclicAdapterSchema;
  assert.match(fixtureResult(valueBearingCycle).violations.join("\n"), /aliases and cycles are forbidden/u);
  const nonfinite = completeFixture();
  nonfinite.subjectBinding.adapterSchemaVersion = Number.POSITIVE_INFINITY;
  assert.match(fixtureResult(nonfinite).violations.join("\n"), /non-finite numbers/u);
  const bigint = completeFixture();
  bigint.subjectBinding.adapterSchemaVersion = 1n;
  assert.match(fixtureResult(bigint).violations.join("\n"), /expected canonical JSON data/u);

  let helperGetterReads = 0;
  const subjectHelperAccessor = completeFixture();
  Object.defineProperty(subjectHelperAccessor, "subjectBinding", {
    enumerable: true,
    get() {
      helperGetterReads += 1;
      throw new Error("SUBJECT_HELPER_GETTER_EXECUTED");
    },
  });
  assert.throws(
    () => providerReadinessSubjectBindingSha256(subjectHelperAccessor),
    /enumerable own data property/u,
  );
  const policyHelperAccessor = completeFixture();
  Object.defineProperty(policyHelperAccessor, "profile", {
    enumerable: true,
    get() {
      helperGetterReads += 1;
      throw new Error("POLICY_HELPER_GETTER_EXECUTED");
    },
  });
  assert.throws(
    () => providerReadinessEvidencePolicySha256(policyHelperAccessor, "SUBJECT_BINDING"),
    /enumerable own data property/u,
  );
  assert.equal(helperGetterReads, 0);
});

test("the CLI reports the canonical production packet as BLOCKED and accepts only an explicit timed fixture", (t) => {
  const validatorFile = fileURLToPath(validatorPath);
  const blocked = spawnSync(process.execPath, [validatorFile], { encoding: "utf8" });
  assert.equal(blocked.status, 2);
  const blockedResult = JSON.parse(blocked.stdout);
  assert.equal(blockedResult.providerReviewPacketComplete, false);
  assert.equal(blockedResult.productionReviewPacketComplete, false);
  assert.equal(blockedResult.mainnetStatus, "HOLD");

  const directory = mkdtempSync(join(tmpdir(), "iat-b3-provider-readiness-"));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  const fixturePath = join(directory, "fixture.json");
  writeFileSync(fixturePath, `${JSON.stringify(completeFixture(), null, 2)}\n`, "utf8");
  const accepted = spawnSync(process.execPath, [
    validatorFile,
    "--manifest",
    fixturePath,
    "--allow-test-fixture",
    "--evaluation-unix-seconds",
    EVALUATION_UNIX_SECONDS,
  ], { encoding: "utf8" });
  assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);
  const acceptedResult = JSON.parse(accepted.stdout);
  assert.equal(acceptedResult.providerReviewPacketComplete, true);
  assert.equal(acceptedResult.productionReviewPacketComplete, false);
  assert.equal(acceptedResult.mainnetOrReleaseReady, false);
});

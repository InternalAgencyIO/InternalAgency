import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { REFERENCE_DEPLOYMENT_DOMAIN_SHA256 } from "../programs/iat_b3_reference/reward-allocator-receipt-codec.mjs";
import {
  REQUIRED_X_SOCIAL_EVIDENCE_SECTIONS,
  TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES,
  X_SOCIAL_EVIDENCE_CONTROL_SPECS,
  X_SOCIAL_EVIDENCE_MAINNET_STATUS,
  X_SOCIAL_EVIDENCE_MAX_AGE_SECONDS,
  X_SOCIAL_EVIDENCE_READINESS_SCHEMA,
  X_SOCIAL_EVIDENCE_READINESS_STATUS,
  X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT,
  X_SOCIAL_EVIDENCE_SECTION_SPECS,
  assertXSocialEvidenceReviewPacketComplete,
  parseXSocialEvidenceProviderReadinessJson,
  validateXSocialEvidenceProviderReadinessManifest,
  xSocialEvidenceDescriptorSha256,
  xSocialEvidencePolicySha256,
  xSocialEvidenceSubjectBindingSha256,
} from "../scripts/validate-iat-b3-x-social-evidence-provider-readiness.mjs";

const SITE = fileURLToPath(new URL("../", import.meta.url));
const MANIFEST_PATH = join(
  SITE,
  "docs",
  "b3",
  "iat-b3-x-social-evidence-provider-readiness.v1.json",
);
const SCHEMA_PATH = join(
  SITE,
  "docs",
  "b3",
  "iat-b3-x-social-evidence-provider-readiness.v1.schema.json",
);
const VALIDATOR_PATH = join(
  SITE,
  "scripts",
  "validate-iat-b3-x-social-evidence-provider-readiness.mjs",
);
const DRAFT = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
const EVALUATION_UNIX_SECONDS = "2001000000";

const clone = (value) => structuredClone(value);

function completeFixture() {
  const manifest = clone(DRAFT);
  manifest.profile = "TEST_FIXTURE";
  manifest.readiness = "REVIEW_PACKET_COMPLETE";
  for (const spec of X_SOCIAL_EVIDENCE_SECTION_SPECS) {
    Object.assign(manifest[spec.key], {
      status: "PACKET_COMPLETE",
      environment: "TEST_FIXTURE",
      ...TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.sections[spec.id],
      evidence: null,
      blocker: null,
    });
  }
  for (const control of manifest.controlRequirements) {
    Object.assign(control, { status: "PACKET_COMPLETE", evidence: null, blocker: null });
  }
  Object.assign(manifest.terminalPredicate, { status: "PACKET_COMPLETE", blocker: null });
  const subjectBindingSha256 = xSocialEvidenceSubjectBindingSha256(manifest);
  const evidence = (sectionId) => {
    const descriptor = {
      evidenceKind: `${sectionId}_AUTOMATED_DIRECT_EVIDENCE`,
      artifactSha256:
        TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.evidenceArtifactSha256BySection[sectionId],
      subjectBindingSha256,
      policySha256: xSocialEvidencePolicySha256(manifest, sectionId),
      automatedEvidenceSourceAId: TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.automatedEvidenceSourceAId,
      evidenceSourceAFailureDomainId:
        TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.evidenceSourceAFailureDomainId,
      evidenceSourceAIdentitySha256:
        TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.evidenceSourceAIdentitySha256,
      automatedEvidenceSourceBId: TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.automatedEvidenceSourceBId,
      evidenceSourceBFailureDomainId:
        TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.evidenceSourceBFailureDomainId,
      evidenceSourceBIdentitySha256:
        TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.evidenceSourceBIdentitySha256,
      capturedAtUnixSeconds:
        TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.capturedAtUnixSeconds,
      validThroughUnixSeconds:
        TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.validThroughUnixSeconds,
      maximumAgeSeconds: TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.maximumAgeSeconds,
      environment: "TEST_FIXTURE",
    };
    return {
      ...descriptor,
      evidenceDescriptorSha256: xSocialEvidenceDescriptorSha256(descriptor),
    };
  };
  for (const spec of X_SOCIAL_EVIDENCE_SECTION_SPECS) {
    manifest[spec.key].evidence = evidence(spec.id);
  }
  for (const control of manifest.controlRequirements) control.evidence = evidence(control.id);
  return manifest;
}

function fixtureResult(manifest, options = {}) {
  return validateXSocialEvidenceProviderReadinessManifest(manifest, {
    allowTestFixture: true,
    evaluationUnixSeconds: EVALUATION_UNIX_SECONDS,
    ...options,
  });
}

function expectIncomplete(mutator, pattern) {
  const manifest = completeFixture();
  mutator(manifest);
  const result = fixtureResult(manifest);
  assert.equal(result.xSocialEvidenceReviewPacketComplete, false);
  assert.match(result.violations.join("\n"), pattern);
}

test("the canonical production X/social evidence packet is structurally valid, blocked, and nonactivating", () => {
  const result = validateXSocialEvidenceProviderReadinessManifest(DRAFT);
  assert.equal(DRAFT.schema, X_SOCIAL_EVIDENCE_READINESS_SCHEMA);
  assert.equal(DRAFT.status, X_SOCIAL_EVIDENCE_READINESS_STATUS);
  assert.equal(DRAFT.profile, "PRODUCTION");
  assert.equal(DRAFT.readiness, "BLOCKED");
  assert.equal(result.xSocialEvidenceReviewPacketComplete, false);
  assert.equal(result.productionXSocialEvidenceReviewPacketComplete, false);
  assert.equal(result.violations.length, 0);
  assert.equal(result.blockers.length, REQUIRED_X_SOCIAL_EVIDENCE_SECTIONS.length + 1);
  assert.equal(result.certifiesProviderOperationalTruth, false);
  assert.equal(result.certifiesOneBiologicalHumanPerXAccount, false);
  assert.equal(result.providerEvidenceAuthenticationVerified, false);
  assert.equal(result.collectorCompletenessVerified, false);
  assert.equal(result.walletBindingAuthenticationVerified, false);
  assert.equal(result.allocatorLineageAuthenticationVerified, false);
  assert.equal(result.externalMonotonicityVerified, false);
  assert.equal(result.rollbackProtectionVerified, false);
  assert.equal(result.runtimeConsumerGatingVerified, false);
  assert.equal(result.activationReady, false);
  assert.equal(result.mainnetOrReleaseReady, false);
  assert.equal(result.mainnetStatus, "HOLD");
  assert.equal(X_SOCIAL_EVIDENCE_MAINNET_STATUS, "HOLD");
  assert.equal(X_SOCIAL_EVIDENCE_MAX_AGE_SECONDS, 2_592_000n);
  assert.equal("providerReadinessReady" in result, false);
  assert.equal("productionReady" in result, false);
  assert.equal("providerVerified" in result, false);
  assert.equal(DRAFT.subjectBinding.productionDeploymentDomainSha256, null);
  assert.equal(DRAFT.xProviderBinding.applicationId, null);
  assert.equal(DRAFT.receiptTrustBinding.trustRootSha256, null);
  assert.equal(DRAFT.collectorAndTargetBinding.collectorResourceId, null);
});

test("the JSON Schema freezes the exact structural-only surface and immutable false/HOLD flags", () => {
  assert.equal(SCHEMA.properties.schema.const, X_SOCIAL_EVIDENCE_READINESS_SCHEMA);
  assert.equal(SCHEMA.properties.status.const, X_SOCIAL_EVIDENCE_READINESS_STATUS);
  assert.equal(SCHEMA.properties.controlRequirements.minItems, 17);
  assert.equal(SCHEMA.properties.controlRequirements.maxItems, 17);
  assert.equal(SCHEMA.properties.terminalPredicate.$ref, "#/$defs/terminalPredicate");
  for (const key of [
    "providerEvidenceAuthenticationVerified",
    "collectorCompletenessVerified",
    "walletBindingAuthenticationVerified",
    "allocatorLineageAuthenticationVerified",
    "externalMonotonicityVerified",
    "rollbackProtectionVerified",
    "runtimeConsumerGatingVerified",
    "activationReady",
    "mainnetOrReleaseReady",
  ]) assert.equal(SCHEMA.properties[key].const, false);
  assert.equal(SCHEMA.properties.mainnetStatus.const, "HOLD");
  assert.equal(SCHEMA.additionalProperties, false);
  assert.deepEqual([...SCHEMA.required].sort(), Object.keys(DRAFT).sort());
  for (const spec of X_SOCIAL_EVIDENCE_SECTION_SPECS) {
    const definition = SCHEMA.$defs[spec.key];
    assert.deepEqual([...definition.required].sort(), Object.keys(DRAFT[spec.key]).sort());
    assert.equal(definition.additionalProperties, false);
  }
  assert.deepEqual(SCHEMA.$defs.evidence.required, [
    "evidenceKind",
    "artifactSha256",
    "subjectBindingSha256",
    "policySha256",
    "automatedEvidenceSourceAId",
    "evidenceSourceAFailureDomainId",
    "evidenceSourceAIdentitySha256",
    "automatedEvidenceSourceBId",
    "evidenceSourceBFailureDomainId",
    "evidenceSourceBIdentitySha256",
    "capturedAtUnixSeconds",
    "validThroughUnixSeconds",
    "maximumAgeSeconds",
    "environment",
    "evidenceDescriptorSha256",
  ]);
});

test("an explicitly authorized complete fixture proves only review-packet structure", () => {
  const manifest = completeFixture();
  const result = fixtureResult(manifest);
  assert.equal(result.xSocialEvidenceReviewPacketComplete, true);
  assert.equal(result.productionXSocialEvidenceReviewPacketComplete, false);
  assert.equal(result.certifiesProviderOperationalTruth, false);
  assert.equal(result.certifiesOneBiologicalHumanPerXAccount, false);
  assert.equal(result.providerEvidenceAuthenticationVerified, false);
  assert.equal(result.collectorCompletenessVerified, false);
  assert.equal(result.rollbackProtectionVerified, false);
  assert.equal(result.runtimeConsumerGatingVerified, false);
  assert.equal(result.activationReady, false);
  assert.equal(result.mainnetOrReleaseReady, false);
  assert.equal(result.mainnetStatus, "HOLD");
  assert.equal(result.blockers.length, 0);
  assert.equal(result.violations.length, 0);
  assert.equal(
    assertXSocialEvidenceReviewPacketComplete(manifest, {
      allowTestFixture: true,
      evaluationUnixSeconds: EVALUATION_UNIX_SECONDS,
    }).xSocialEvidenceReviewPacketComplete,
    true,
  );

  const unauthorized = validateXSocialEvidenceProviderReadinessManifest(manifest, {
    evaluationUnixSeconds: EVALUATION_UNIX_SECONDS,
  });
  assert.equal(unauthorized.xSocialEvidenceReviewPacketComplete, false);
  assert.match(unauthorized.violations.join("\n"), /requires explicit allowTestFixture/u);
});

test("fixture values, subject digests, policies, and artifacts cannot be relabeled as production", () => {
  const relabeled = completeFixture();
  relabeled.profile = "PRODUCTION";
  for (const spec of X_SOCIAL_EVIDENCE_SECTION_SPECS) {
    relabeled[spec.key].environment = "PRODUCTION";
    relabeled[spec.key].evidence.environment = "PRODUCTION";
  }
  for (const control of relabeled.controlRequirements) control.evidence.environment = "PRODUCTION";
  const result = validateXSocialEvidenceProviderReadinessManifest(relabeled, {
    allowTestFixture: true,
    evaluationUnixSeconds: EVALUATION_UNIX_SECONDS,
  });
  assert.equal(result.xSocialEvidenceReviewPacketComplete, false);
  assert.equal(result.productionXSocialEvidenceReviewPacketComplete, false);
  assert.match(result.violations.join("\n"), /known TEST_FIXTURE value|non-production marker/u);

  const currentReference = clone(DRAFT);
  currentReference.subjectBinding.productionDeploymentDomainSha256 =
    REFERENCE_DEPLOYMENT_DOMAIN_SHA256;
  const referenceResult = validateXSocialEvidenceProviderReadinessManifest(currentReference);
  assert.match(referenceResult.violations.join("\n"), /reference-only digest/u);
});

test("the exact identity, tier, amount, action, time, finality, and source contract is immutable", () => {
  assert.deepEqual(DRAFT.referenceContract, X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT);
  assert.deepEqual(X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT.recognizedSubscriptionTypes, [
    "None", "Basic", "Premium", "PremiumPlus",
  ]);
  assert.deepEqual(X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT.tenPercentSubscriptionTypes, [
    "None", "Basic",
  ]);
  assert.deepEqual(X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT.fullRewardSubscriptionTypes, [
    "Premium", "PremiumPlus",
  ]);
  assert.deepEqual(X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT.trancheBasisPoints, {
    X_BASE_10: 1_000,
    X_PREMIUM_FULL_100: 10_000,
    X_PREMIUM_UPGRADE_90: 9_000,
  });
  assert.deepEqual(X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT.qualifyingActions, [
    "original", "reply", "quote", "repost", "like", "follow",
  ]);
  assert.deepEqual(X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT.actionAliases, { retweet: "repost" });
  assert.deepEqual(X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT.rewardSourceKinds, [
    "X_INTERACTION", "GENESIS_AIRDROP",
  ]);
  assert.equal(X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT.minimumXAccountAgeDays, 40);
  assert.equal(X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT.subscriptionObservationMaximumAgeHours, 24);
  assert.equal(X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT.partialPaymentsAllowed, false);
  assert.equal(X_SOCIAL_EVIDENCE_REFERENCE_CONTRACT.providerIntegrationPresent, false);

  for (const mutate of [
    (value) => value.referenceContract.tenPercentSubscriptionTypes.push("Unknown"),
    (value) => { value.referenceContract.actionAliases.retweet = "quote"; },
    (value) => { value.referenceContract.trancheBasisPoints.X_BASE_10 = 999; },
    (value) => { value.referenceContract.verifiedBooleanPayoutRole = "ELIGIBILITY_KEY"; },
    (value) => { value.referenceContract.subscriptionObservationMaximumAgeHours = 25; },
    (value) => value.referenceContract.rewardSourceKinds.reverse(),
    (value) => { value.referenceContract.dailyDecisionBoundary = "LATE_BACKFILL_ALLOWED"; },
  ]) expectIncomplete(mutate, /referenceContract/u);
});

test("all 17 controls, exact claims, and terminal order are mandatory", () => {
  assert.deepEqual(
    DRAFT.controlRequirements.map(({ id }) => id),
    X_SOCIAL_EVIDENCE_CONTROL_SPECS.map(({ id }) => id),
  );
  assert.deepEqual(DRAFT.terminalPredicate.requiredSections, REQUIRED_X_SOCIAL_EVIDENCE_SECTIONS);
  assert.equal(X_SOCIAL_EVIDENCE_CONTROL_SPECS.length, 17);
  assert.equal(REQUIRED_X_SOCIAL_EVIDENCE_SECTIONS.length, 24);
  assert.deepEqual(
    DRAFT.controlRequirements.map(({ requiredClaims }) => requiredClaims),
    X_SOCIAL_EVIDENCE_CONTROL_SPECS.map(({ claims }) => [...claims]),
  );
  expectIncomplete((value) => {
    [value.controlRequirements[0], value.controlRequirements[1]] = [
      value.controlRequirements[1], value.controlRequirements[0],
    ];
  }, /expected OAUTH_PKCE|exact ordered control claims/u);
  expectIncomplete((value) => value.controlRequirements[2].requiredClaims.pop(), /exact ordered control claims/u);
  expectIncomplete((value) => value.terminalPredicate.requiredSections.pop(), /exact ordered review packets/u);
  expectIncomplete((value) => {
    value.controlRequirements[14].requiredClaims[0] =
      "PROVIDER_READ_HAPPENS_BEFORE_DAILY_LAW";
  }, /exact ordered control claims/u);
});

test("evidence descriptors are subject/policy bound, bounded, half-open, unique, and domain-linked", () => {
  expectIncomplete((value) => {
    value.controlRequirements[0].evidence.subjectBindingSha256 = "ab".repeat(32);
  }, /bind the exact subject/u);
  expectIncomplete((value) => {
    value.controlRequirements[1].evidence.policySha256 = "bc".repeat(32);
  }, /bind the exact section control and policy/u);
  expectIncomplete((value) => {
    value.controlRequirements[2].evidence.artifactSha256 =
      value.controlRequirements[1].evidence.artifactSha256;
  }, /artifacts must be unique/u);
  expectIncomplete((value) => {
    value.controlRequirements[3].evidence.automatedEvidenceSourceBId =
      value.controlRequirements[3].evidence.automatedEvidenceSourceAId;
  }, /automated evidence source A and B identities must be distinct/u);
  expectIncomplete((value) => {
    value.controlRequirements[4].evidence.automatedEvidenceSourceAId =
      value.xProviderBinding.applicationId;
  }, /must be distinct/u);
  expectIncomplete((value) => {
    value.controlRequirements[5].evidence.environment = "PRODUCTION";
  }, /must match manifest.profile/u);
  expectIncomplete((value) => {
    value.controlRequirements[6].evidence.capturedAtUnixSeconds = "0";
  }, /positive unsigned/u);
  expectIncomplete((value) => {
    value.controlRequirements[7].evidence.validThroughUnixSeconds = "2002000000";
  }, /content-address every evidence metadata field/u);
  expectIncomplete((value) => {
    const evidence = value.controlRequirements[8].evidence;
    evidence.capturedAtUnixSeconds = "1";
    evidence.validThroughUnixSeconds = ((1n << 64n) - 1n).toString();
    evidence.evidenceDescriptorSha256 = xSocialEvidenceDescriptorSha256(evidence);
  }, /exceeds the externally pinned maximum age/u);
  expectIncomplete((value) => {
    const evidence = value.controlRequirements[9].evidence;
    evidence.evidenceSourceAFailureDomainId =
      `${value.failureDomainSeparation.externalCheckpointFailureDomainId}-evidence-source`;
    evidence.evidenceDescriptorSha256 = xSocialEvidenceDescriptorSha256(evidence);
  }, /exact bound to automated direct evidence failure domains|identity digests must bind/u);
  const manifest = completeFixture();
  assert.match(
    fixtureResult(manifest, { evaluationUnixSeconds: "1999999999" }).violations.join("\n"),
    /does not contain options.evaluationUnixSeconds/u,
  );
  assert.match(
    validateXSocialEvidenceProviderReadinessManifest(manifest, { allowTestFixture: true })
      .violations.join("\n"),
    /requires explicit options.evaluationUnixSeconds|packet evaluation requires explicit/u,
  );
  assert.match(
    fixtureResult(manifest, {
      evaluationUnixSeconds: TEST_FIXTURE_X_SOCIAL_EVIDENCE_VALUES.validThroughUnixSeconds,
    }).violations.join("\n"),
    /declared half-open evidence interval/u,
  );
});

test("production identifiers, digests, and failure domains reject obvious fabrication", () => {
  for (const [mutate, pattern] of [
    [(value) => {
      value.profile = "PRODUCTION";
      value.xProviderBinding.applicationId = "fakeprovider001";
    }, /non-production marker/u],
    [(value) => {
      value.profile = "PRODUCTION";
      value.xProviderBinding.applicationId = "https://generic.example/app";
    }, /not a URL/u],
    [(value) => {
      value.profile = "PRODUCTION";
      value.xProviderBinding.applicationId = "prod-placeholder-service-001";
    }, /non-placeholder identifier/u],
    [(value) => {
      value.subjectBinding.rewardPolicyArtifactSha256 = "a".repeat(64);
    }, /low-entropy placeholder/u],
    [(value) => {
      value.subjectBinding.rewardPolicyArtifactSha256 = "AB".repeat(32);
    }, /canonical lowercase/u],
    [(value) => {
      value.subjectBinding.rewardPolicyArtifactSha256 = `${"0".repeat(63)}1`;
    }, /near-zero/u],
    [(value) => {
      value.failureDomainSeparation.backupFailureDomainId =
        value.failureDomainSeparation.localPersistenceFailureDomainId;
    }, /domains must be distinct/u],
  ]) {
    const manifest = completeFixture();
    mutate(manifest);
    if (manifest.profile === "PRODUCTION") {
      for (const spec of X_SOCIAL_EVIDENCE_SECTION_SPECS) {
        manifest[spec.key].environment = "PRODUCTION";
        manifest[spec.key].evidence.environment = "PRODUCTION";
      }
      for (const control of manifest.controlRequirements) control.evidence.environment = "PRODUCTION";
    }
    const result = validateXSocialEvidenceProviderReadinessManifest(manifest, {
      allowTestFixture: true,
      evaluationUnixSeconds: EVALUATION_UNIX_SECONDS,
    });
    assert.equal(result.xSocialEvidenceReviewPacketComplete, false);
    assert.match(result.violations.join("\n"), pattern);
  }
});

test("strict canonical JSON rejects aliases, sparse arrays, hidden keys, accessors, cycles, and unsupported scalars without invoking getters", () => {
  const cases = [];
  const symbol = completeFixture();
  symbol[Symbol("extra")] = true;
  cases.push(symbol);
  const hidden = completeFixture();
  Object.defineProperty(hidden, "hidden", { enumerable: false, value: true });
  cases.push(hidden);
  const sparse = completeFixture();
  delete sparse.controlRequirements[3];
  cases.push(sparse);
  const alias = completeFixture();
  alias.scope.doesNotCertify[0] = alias.referenceContract.oauthScopes;
  alias.referenceContract.oauthScopes = alias.scope.doesNotCertify[0];
  cases.push(alias);
  const cycle = completeFixture();
  cycle.subjectBinding.rewardPolicyArtifactSha256 = {};
  cycle.subjectBinding.rewardPolicyArtifactSha256.self =
    cycle.subjectBinding.rewardPolicyArtifactSha256;
  cases.push(cycle);
  const bigint = completeFixture();
  bigint.referenceContract.minimumXAccountAgeDays = 40n;
  cases.push(bigint);
  const nonfinite = completeFixture();
  nonfinite.referenceContract.minimumXAccountAgeDays = Number.POSITIVE_INFINITY;
  cases.push(nonfinite);
  const loneSurrogate = completeFixture();
  loneSurrogate.receiptTrustBinding.currentKeyId = "valid-key-\ud800";
  cases.push(loneSurrogate);
  const customPrototype = completeFixture();
  Object.setPrototypeOf(customPrototype.subjectBinding, { inherited: true });
  cases.push(customPrototype);
  for (const malformed of cases) {
    let result;
    assert.doesNotThrow(() => { result = fixtureResult(malformed); });
    assert.equal(result.xSocialEvidenceReviewPacketComplete, false);
    assert.notEqual(result.violations.length, 0);
  }

  const accessor = completeFixture();
  let reads = 0;
  Object.defineProperty(accessor, "profile", {
    configurable: true,
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("PROFILE_GETTER_EXECUTED");
    },
  });
  let accessorResult;
  assert.doesNotThrow(() => { accessorResult = fixtureResult(accessor); });
  assert.equal(reads, 0);
  assert.equal(accessorResult.xSocialEvidenceReviewPacketComplete, false);
  assert.match(accessorResult.violations.join("\n"), /data property/u);
});

test("hash helpers are deterministic and reject noncanonical or ambiguous inputs", () => {
  const first = completeFixture();
  const second = clone(first);
  assert.equal(
    xSocialEvidenceSubjectBindingSha256(first),
    xSocialEvidenceSubjectBindingSha256(second),
  );
  for (const id of REQUIRED_X_SOCIAL_EVIDENCE_SECTIONS) {
    assert.equal(xSocialEvidencePolicySha256(first, id), xSocialEvidencePolicySha256(second, id));
  }
  second.subjectBinding.actionEvidenceContractSha256 = "cd".repeat(32);
  assert.notEqual(
    xSocialEvidenceSubjectBindingSha256(first),
    xSocialEvidenceSubjectBindingSha256(second),
  );
  const decorated = completeFixture();
  decorated.extra = true;
  assert.throws(() => xSocialEvidenceSubjectBindingSha256(decorated), /keys must be exactly/u);
  const getter = completeFixture();
  Object.defineProperty(getter.subjectBinding, "rewardPolicyArtifactSha256", {
    enumerable: true,
    get() {
      throw new Error("HASH_GETTER_EXECUTED");
    },
  });
  assert.throws(
    () => xSocialEvidenceSubjectBindingSha256(getter),
    /data property/u,
  );
  assert.throws(() => xSocialEvidencePolicySha256(first, "UNKNOWN_SECTION"), /UNKNOWN_/u);
  assert.throws(
    () => parseXSocialEvidenceProviderReadinessJson('{"profile":"PRODUCTION","pr\\u006ffile":"TEST_FIXTURE"}'),
    /duplicate JSON member/u,
  );
});

test("terminal and immutable truth flags cannot be relabeled into operational readiness", () => {
  for (const key of [
    "providerEvidenceAuthenticationVerified",
    "collectorCompletenessVerified",
    "walletBindingAuthenticationVerified",
    "allocatorLineageAuthenticationVerified",
    "externalMonotonicityVerified",
    "rollbackProtectionVerified",
    "runtimeConsumerGatingVerified",
    "activationReady",
    "mainnetOrReleaseReady",
  ]) expectIncomplete((value) => { value[key] = true; }, new RegExp(`${key}: must remain false`, "u"));
  expectIncomplete((value) => { value.mainnetStatus = "READY"; }, /must remain HOLD/u);
  expectIncomplete((value) => { value.readiness = "BLOCKED"; }, /BLOCKED contradicts a complete packet/u);
  expectIncomplete((value) => { value.terminalPredicate.status = "BLOCKED"; }, /BLOCKED contradicts complete required packets/u);
});

test("the CLI reports canonical BLOCKED, accepts only an explicit timed fixture, and rejects duplicate JSON members", () => {
  const blocked = spawnSync(process.execPath, [VALIDATOR_PATH, MANIFEST_PATH], {
    encoding: "utf8",
  });
  assert.equal(blocked.status, 2);
  assert.equal(JSON.parse(blocked.stdout).xSocialEvidenceReviewPacketComplete, false);

  const directory = mkdtempSync(join(tmpdir(), "iat-x-social-readiness-"));
  try {
    const fixturePath = join(directory, "fixture.json");
    writeFileSync(fixturePath, `${JSON.stringify(completeFixture())}\n`, "utf8");
    const accepted = spawnSync(process.execPath, [
      VALIDATOR_PATH,
      fixturePath,
      "--fixture",
      "--evaluation-unix-seconds",
      EVALUATION_UNIX_SECONDS,
    ], { encoding: "utf8" });
    assert.equal(accepted.status, 0, accepted.stderr);
    const result = JSON.parse(accepted.stdout);
    assert.equal(result.xSocialEvidenceReviewPacketComplete, true);
    assert.equal(result.productionXSocialEvidenceReviewPacketComplete, false);
    assert.equal(result.providerEvidenceAuthenticationVerified, false);
    assert.equal(result.mainnetStatus, "HOLD");

    const duplicatePath = join(directory, "duplicate.json");
    writeFileSync(duplicatePath, '{"profile":"PRODUCTION","pr\\u006ffile":"TEST_FIXTURE"}', "utf8");
    const duplicate = spawnSync(process.execPath, [VALIDATOR_PATH, duplicatePath], {
      encoding: "utf8",
    });
    assert.equal(duplicate.status, 1);
    assert.match(duplicate.stderr, /duplicate JSON member/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

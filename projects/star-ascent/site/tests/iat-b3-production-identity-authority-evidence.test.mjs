import assert from "node:assert/strict";
import {
  createHash,
  generateKeyPairSync,
  sign,
} from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  EMPTY_PRODUCTION_IDENTITY_AUTHORITY_TRUST_BINDING,
  PRODUCTION_IDENTITY_AUTHORITY_ATTESTATION_SCHEMA,
  PRODUCTION_IDENTITY_AUTHORITY_EVIDENCE_SCHEMA,
  PRODUCTION_IDENTITY_AUTHORITY_MAINNET_STATUS,
  PRODUCTION_IDENTITY_AUTHORITY_SCOPE,
  PRODUCTION_IDENTITY_AUTHORITY_SOURCE_BINDINGS,
  ceremonyFundingEvidenceSubjectSha256,
  createProductionIdentityAuthorityTrustBinding,
  deployedSealEvidenceSubjectSha256,
  parseProductionIdentityAuthorityEvidenceJson,
  productionIdentityAuthorityAttestationSigningBytes,
  productionIdentityAuthorityTerminalStateSha256,
  productionIdentityFreezeEvidenceSubjectSha256,
  validateProductionIdentityAuthorityEvidenceManifest,
} from "../scripts/validate-iat-b3-production-identity-authority-evidence.mjs";
import { EXPECTED_SEAL_ORDER } from "../scripts/validate-iat-b3-identity-freeze.mjs";

const SITE = fileURLToPath(new URL("../", import.meta.url));
const MANIFEST_PATH = join(
  SITE,
  "docs",
  "b3",
  "iat-b3-production-identity-authority-evidence.v1.json",
);
const SCHEMA_PATH = join(
  SITE,
  "docs",
  "b3",
  "iat-b3-production-identity-authority-evidence.v1.schema.json",
);
const VALIDATOR_PATH = join(
  SITE,
  "scripts",
  "validate-iat-b3-production-identity-authority-evidence.mjs",
);
const DRAFT = parseProductionIdentityAuthorityEvidenceJson(
  readFileSync(MANIFEST_PATH, "utf8"),
  MANIFEST_PATH,
);
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
const VALIDATOR_SOURCE = readFileSync(VALIDATOR_PATH, "utf8");
const clone = (value) => structuredClone(value);
const digest = (label) => createHash("sha256").update(label, "utf8").digest("hex");
const FIXTURE_EVALUATION_UNIX_SECONDS = "2001000025";

function makeTrustContext() {
  const roles = [
    ["owner.decision.prod", "OWNER_DECISION"],
    ["observer.alpha.prod", "ENDPOINT_OBSERVER"],
    ["observer.beta.prod", "ENDPOINT_OBSERVER"],
    ["independent.reviewer.prod", "INDEPENDENT_REVIEWER"],
  ];
  const privateKeys = new Map();
  const keys = roles.map(([keyId, role]) => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const der = publicKey.export({ format: "der", type: "spki" });
    privateKeys.set(keyId, privateKey);
    return {
      keyId,
      role,
      publicKeySpkiDerBase64url: der.toString("base64url"),
      publicKeySha256: createHash("sha256").update(der).digest("hex"),
    };
  });
  return {
    trustBinding: createProductionIdentityAuthorityTrustBinding(keys),
    privateKeys,
  };
}

function signedAttestation(context, fields) {
  const unsigned = {
    schema: PRODUCTION_IDENTITY_AUTHORITY_ATTESTATION_SCHEMA,
    kind: fields.kind,
    stage: fields.stage,
    keyId: fields.keyId,
    observedAtUnixSeconds: fields.observedAtUnixSeconds,
    endpointSha256: fields.endpointSha256,
    subjectSha256: fields.subjectSha256,
    observationValue: fields.observationValue,
    decision: fields.decision,
  };
  return {
    ...unsigned,
    signatureBase64url: sign(
      null,
      productionIdentityAuthorityAttestationSigningBytes(unsigned),
      context.privateKeys.get(fields.keyId),
    ).toString("base64url"),
  };
}

function resignAttestation(context, attestation, overrides = {}) {
  const unsigned = { ...attestation };
  delete unsigned.signatureBase64url;
  return signedAttestation(context, { ...unsigned, ...overrides });
}

function rebindPhaseBAttestations(fixture) {
  const phase = fixture.manifest.phaseBCeremonyFunding;
  phase.subjectSha256 = ceremonyFundingEvidenceSubjectSha256(fixture.manifest);
  phase.fundingApproval = resignAttestation(fixture.context, phase.fundingApproval, {
    subjectSha256: phase.subjectSha256,
  });
  phase.payerBalanceObservations = phase.payerBalanceObservations.map((entry) => (
    resignAttestation(fixture.context, entry, { subjectSha256: phase.subjectSha256 })
  ));
  phase.independentReview = resignAttestation(fixture.context, phase.independentReview, {
    subjectSha256: phase.subjectSha256,
    observationValue: phase.subjectSha256,
  });
}

function completeFixture() {
  const context = makeTrustContext();
  const manifest = clone(DRAFT);
  manifest.profile = "TEST_FIXTURE";
  manifest.status = "EVIDENCE_COMPLETE";
  Object.assign(manifest.productionChoices, {
    lawProgramId: "29dv8e1WcjL4w6a7HDaHbUfXrF12yiJiVcKQ1qgeT3rF",
    economyProgramId: "2xfTrFbdiJtncBaCWoVK5yvgn9XT4UYZCWKGiQDqR3ij",
    canonicalMint: "3uXbrU7mzV3xZT5Jcz4BAEjNCNUGVNA32DeTXirDsiEd",
    mainnetGenesisHash: "4zEL9HZwTFoanu5RbmGspF5a6uqVGP99xkJxToZoq3Pw",
    ceremonySignerPublicKey: "29dv8e1WcjL4w6a7HDaHbUfXrF12yiJiVcKQ1qgeT3rF",
    lawUpgradeAuthorityPublicKey: "2xfTrFbdiJtncBaCWoVK5yvgn9XT4UYZCWKGiQDqR3ij",
    economyUpgradeAuthorityPublicKey: "3uXbrU7mzV3xZT5Jcz4BAEjNCNUGVNA32DeTXirDsiEd",
    payerPublicKey: "4zEL9HZwTFoanu5RbmGspF5a6uqVGP99xkJxToZoq3Pw",
  });

  const phaseA = manifest.phaseAProductionIdentityFreeze;
  phaseA.status = "EVIDENCE_COMPLETE";
  phaseA.ownerDecisionPreimageSha256 = digest("owner-identity-decision-preimage");
  phaseA.blocker = null;
  phaseA.subjectSha256 = productionIdentityFreezeEvidenceSubjectSha256(manifest);
  phaseA.ownerAcceptance = signedAttestation(context, {
    kind: "OWNER_IDENTITY_DECISION_ACCEPTANCE",
    stage: "A",
    keyId: "owner.decision.prod",
    observedAtUnixSeconds: "2001000000",
    endpointSha256: null,
    subjectSha256: phaseA.subjectSha256,
    observationValue: phaseA.ownerDecisionPreimageSha256,
    decision: "ACCEPT",
  });
  phaseA.mainnetGenesisObservations = [
    ["observer.alpha.prod", digest("rpc-mainnet-alpha"), "2001000001"],
    ["observer.beta.prod", digest("rpc-mainnet-beta"), "2001000002"],
  ].map(([keyId, endpointSha256, observedAtUnixSeconds]) => signedAttestation(context, {
    kind: "MAINNET_GENESIS_OBSERVATION",
    stage: "A",
    keyId,
    observedAtUnixSeconds,
    endpointSha256,
    subjectSha256: phaseA.subjectSha256,
    observationValue: manifest.productionChoices.mainnetGenesisHash,
    decision: "MATCHED",
  }));
  phaseA.independentReview = signedAttestation(context, {
    kind: "INDEPENDENT_IDENTITY_REVIEW",
    stage: "A",
    keyId: "independent.reviewer.prod",
    observedAtUnixSeconds: "2001000003",
    endpointSha256: null,
    subjectSha256: phaseA.subjectSha256,
    observationValue: phaseA.subjectSha256,
    decision: "ACCEPT",
  });

  const phaseB = manifest.phaseBCeremonyFunding;
  phaseB.status = "EVIDENCE_COMPLETE";
  phaseB.finalBinaries.law = {
    programId: manifest.productionChoices.lawProgramId,
    sha256: digest("final-law-binary"),
    byteLength: 180000,
    sourceHeadSha256: digest("final-source-head"),
  };
  phaseB.finalBinaries.economy = {
    programId: manifest.productionChoices.economyProgramId,
    sha256: digest("final-economy-binary"),
    byteLength: 210000,
    sourceHeadSha256: digest("final-source-head"),
  };
  phaseB.freshCostMeasurementSha256 = digest("fresh-cost-measurement");
  phaseB.fundingSourceApprovalSha256 = digest("funding-source-approval");
  phaseB.ceremonyFloorPolicySha256 = digest("ceremony-floor-policy");
  phaseB.bufferRecoveryPlanSha256 = digest("buffer-recovery-plan");
  phaseB.ceremonyFloorLamports = "2100000000";
  phaseB.aggregateFreshPayerPeakLamports = "2000000000";
  phaseB.aggregatePermanentRentLamports = "1000000000";
  phaseB.aggregateRecoverableBufferLamports = "900000000";
  phaseB.aggregateFeeBudgetLamports = "10000000";
  phaseB.expiresAtUnixSeconds = "2001000100";
  phaseB.blocker = null;
  phaseB.subjectSha256 = ceremonyFundingEvidenceSubjectSha256(manifest);
  phaseB.fundingApproval = signedAttestation(context, {
    kind: "OWNER_FUNDING_SOURCE_ACCEPTANCE",
    stage: "B",
    keyId: "owner.decision.prod",
    observedAtUnixSeconds: "2001000010",
    endpointSha256: null,
    subjectSha256: phaseB.subjectSha256,
    observationValue: phaseB.fundingSourceApprovalSha256,
    decision: "ACCEPT",
  });
  phaseB.payerBalanceObservations = [
    ["observer.alpha.prod", digest("rpc-payer-alpha"), "2200000000", "2001000011"],
    ["observer.beta.prod", digest("rpc-payer-beta"), "2300000000", "2001000012"],
  ].map(([keyId, endpointSha256, observationValue, observedAtUnixSeconds]) => signedAttestation(context, {
    kind: "PAYER_BALANCE_OBSERVATION",
    stage: "B",
    keyId,
    observedAtUnixSeconds,
    endpointSha256,
    subjectSha256: phaseB.subjectSha256,
    observationValue,
    decision: "MATCHED",
  }));
  phaseB.independentReview = signedAttestation(context, {
    kind: "INDEPENDENT_FUNDING_REVIEW",
    stage: "B",
    keyId: "independent.reviewer.prod",
    observedAtUnixSeconds: "2001000013",
    endpointSha256: null,
    subjectSha256: phaseB.subjectSha256,
    observationValue: phaseB.subjectSha256,
    decision: "ACCEPT",
  });

  const phaseC = manifest.phaseCDeployedSeal;
  phaseC.status = "EVIDENCE_COMPLETE";
  phaseC.blocker = null;
  phaseC.journal = EXPECTED_SEAL_ORDER.map((step, index) => ({
    ordinal: index + 1,
    step,
    status: "FINALIZED_MATCHED",
    evidenceSha256: digest(`ceremony-journal-${index + 1}-${step}`),
  }));
  phaseC.terminalState = {
    lawProgramId: manifest.productionChoices.lawProgramId,
    economyProgramId: manifest.productionChoices.economyProgramId,
    canonicalMint: manifest.productionChoices.canonicalMint,
    lawBinarySha256: phaseB.finalBinaries.law.sha256,
    economyBinarySha256: phaseB.finalBinaries.economy.sha256,
    lawUpgradeAuthority: null,
    economyUpgradeAuthority: null,
    mintAuthority: null,
    freezeAuthority: null,
    transferHookAuthority: null,
    confidentialTransferMintAuthority: null,
    active: true,
    genesisStagingWritesDisabled: true,
    stateSha256: null,
  };
  phaseC.terminalState.stateSha256 = productionIdentityAuthorityTerminalStateSha256(
    phaseC.terminalState,
  );
  phaseC.subjectSha256 = deployedSealEvidenceSubjectSha256(manifest);
  phaseC.terminalEndpointObservations = [
    ["observer.alpha.prod", digest("rpc-terminal-alpha"), "2001000020"],
    ["observer.beta.prod", digest("rpc-terminal-beta"), "2001000021"],
  ].map(([keyId, endpointSha256, observedAtUnixSeconds]) => signedAttestation(context, {
    kind: "TERMINAL_AUTHORITY_STATE_OBSERVATION",
    stage: "C",
    keyId,
    observedAtUnixSeconds,
    endpointSha256,
    subjectSha256: phaseC.subjectSha256,
    observationValue: phaseC.terminalState.stateSha256,
    decision: "MATCHED",
  }));
  phaseC.independentReview = signedAttestation(context, {
    kind: "INDEPENDENT_DEPLOYED_SEAL_REVIEW",
    stage: "C",
    keyId: "independent.reviewer.prod",
    observedAtUnixSeconds: "2001000022",
    endpointSha256: null,
    subjectSha256: phaseC.subjectSha256,
    observationValue: phaseC.subjectSha256,
    decision: "ACCEPT",
  });
  return { context, manifest };
}

function fixtureResult(fixture) {
  return validateProductionIdentityAuthorityEvidenceManifest(fixture.manifest, {
    allowTestFixture: true,
    trustBinding: fixture.context.trustBinding,
    evaluationUnixSeconds: FIXTURE_EVALUATION_UNIX_SECONDS,
  });
}

function expectFixtureViolation(mutator, pattern) {
  const fixture = completeFixture();
  mutator(fixture);
  const result = fixtureResult(fixture);
  assert.equal(result.valid, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.match(result.violations.join("\n"), pattern);
}

test("canonical production packet is structurally valid, owner-null, staged PENDING, and HOLD", () => {
  const result = validateProductionIdentityAuthorityEvidenceManifest(DRAFT);
  assert.equal(DRAFT.schema, PRODUCTION_IDENTITY_AUTHORITY_EVIDENCE_SCHEMA);
  assert.equal(DRAFT.profile, "PRODUCTION");
  assert.equal(DRAFT.status, "PENDING");
  assert.deepEqual(DRAFT.scope, PRODUCTION_IDENTITY_AUTHORITY_SCOPE);
  assert.deepEqual(DRAFT.sourceBindings, PRODUCTION_IDENTITY_AUTHORITY_SOURCE_BINDINGS);
  assert.deepEqual(EMPTY_PRODUCTION_IDENTITY_AUTHORITY_TRUST_BINDING.keys, []);
  assert.equal(Object.values(DRAFT.productionChoices).every((value) => value === null), true);
  assert.equal(result.valid, true);
  assert.equal(result.externalTrustConfigured, false);
  assert.equal(result.phaseAProductionIdentityFreezeComplete, false);
  assert.equal(result.phaseBCeremonyFundingComplete, false);
  assert.equal(result.phaseCDeployedIdentityAuthoritySealComplete, false);
  assert.equal(result.blockers.length, 4);
  assert.deepEqual(result.violations, []);
  for (const key of [
    "signingAuthorized",
    "deploymentAuthorized",
    "fundingSpendAuthorized",
    "activationAuthorized",
    "independentGate8Accepted",
    "releaseAuthorized",
    "mainnetExecutionAuthorized",
  ]) assert.equal(result[key], false);
  assert.equal(result.mainnetStatus, PRODUCTION_IDENTITY_AUTHORITY_MAINNET_STATUS);
});

test("schema pins the three stages, source inputs, exact 17-step order, and immutable authorization boundary", () => {
  assert.deepEqual(SCHEMA.properties.scope.const, PRODUCTION_IDENTITY_AUTHORITY_SCOPE);
  assert.deepEqual(SCHEMA.properties.sourceBindings.const, PRODUCTION_IDENTITY_AUTHORITY_SOURCE_BINDINGS);
  assert.equal(
    SCHEMA.properties.phaseCDeployedSeal.properties.journal.prefixItems.length,
    EXPECTED_SEAL_ORDER.length,
  );
  assert.equal(
    SCHEMA.properties.phaseBCeremonyFunding.required.includes("expiresAtUnixSeconds"),
    true,
  );
  const schemaSteps = SCHEMA.properties.phaseCDeployedSeal.properties.journal.prefixItems.map(
    (entry) => SCHEMA.$defs[entry.$ref.split("/").at(-1)].allOf[1].properties.step.const,
  );
  assert.deepEqual(schemaSteps, EXPECTED_SEAL_ORDER);
  assert.equal(SCHEMA.properties.authorizationBoundary.const.independentGate8Accepted, false);
  assert.equal(SCHEMA.properties.authorizationBoundary.const.mainnetExecutionAuthorized, false);
  assert.equal(SCHEMA.properties.authorizationBoundary.const.mainnetStatus, "HOLD");
});

test("fully signed fixture proves staged mechanics without ever satisfying a production predicate", () => {
  const fixture = completeFixture();
  const result = fixtureResult(fixture);
  assert.equal(result.valid, true, result.violations.join("\n"));
  assert.equal(result.externalTrustConfigured, true);
  assert.equal(result.phaseAProductionIdentityFreezeComplete, true);
  assert.equal(result.phaseBCeremonyFundingComplete, true);
  assert.equal(result.phaseCDeployedIdentityAuthoritySealComplete, true);
  assert.equal(result.productionIdentityFreezeEvidenceComplete, false);
  assert.equal(result.ceremonyFundingEvidenceComplete, false);
  assert.equal(result.deployedIdentityAuthoritySealEvidenceComplete, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
});

test("fixture use requires explicit authority and production relabel cannot bypass source-bound identity readiness", () => {
  const fixture = completeFixture();
  const denied = validateProductionIdentityAuthorityEvidenceManifest(fixture.manifest, {
    trustBinding: fixture.context.trustBinding,
  });
  assert.equal(denied.valid, false);
  assert.match(denied.violations.join("\n"), /TEST_FIXTURE requires explicit/iu);

  fixture.manifest.profile = "PRODUCTION";
  const relabeled = validateProductionIdentityAuthorityEvidenceManifest(fixture.manifest, {
    trustBinding: fixture.context.trustBinding,
  });
  assert.equal(relabeled.valid, false);
  assert.equal(relabeled.productionIdentityFreezeEvidenceComplete, false);
  assert.match(
    [...relabeled.blockers, ...relabeled.violations].join("\n"),
    /identity-input bytes|phase A must complete first|EVIDENCE_COMPLETE requires/iu,
  );
});

test("packet cannot select trust keys and completion requires exact external role cardinality", () => {
  expectFixtureViolation(({ manifest }) => {
    manifest.trustBinding = clone(EMPTY_PRODUCTION_IDENTITY_AUTHORITY_TRUST_BINDING);
  }, /expected exact keys/iu);

  const fixture = completeFixture();
  const noTrust = validateProductionIdentityAuthorityEvidenceManifest(fixture.manifest, {
    allowTestFixture: true,
  });
  assert.equal(noTrust.valid, false);
  assert.match(noTrust.violations.join("\n"), /key is absent from the external/iu);

  for (const mutate of [
    (trust) => trust.keys.pop(),
    (trust) => { trust.packetMaySelectTrustKeys = true; },
    (trust) => { trust.trustRootSha256 = digest("substituted-root"); },
    (trust) => { trust.keys[0].role = "OWNER_DECISION"; },
    (trust) => { trust.keys[1].keyId = trust.keys[0].keyId; },
    (trust) => { trust.keys[1].publicKeySpkiDerBase64url = trust.keys[0].publicKeySpkiDerBase64url; },
    (trust) => { trust.keys[1].publicKeySha256 = trust.keys[0].publicKeySha256; },
  ]) {
    const hostile = completeFixture();
    mutate(hostile.context.trustBinding);
    assert.equal(fixtureResult(hostile).valid, false);
  }
});

test("every attestation class is cryptographically bound to kind, stage, subject, value, decision, key, and endpoint", () => {
  const paths = [
    ["phaseAProductionIdentityFreeze", "ownerAcceptance"],
    ["phaseAProductionIdentityFreeze", "mainnetGenesisObservations", 0],
    ["phaseAProductionIdentityFreeze", "independentReview"],
    ["phaseBCeremonyFunding", "fundingApproval"],
    ["phaseBCeremonyFunding", "payerBalanceObservations", 0],
    ["phaseBCeremonyFunding", "independentReview"],
    ["phaseCDeployedSeal", "terminalEndpointObservations", 0],
    ["phaseCDeployedSeal", "independentReview"],
  ];
  for (const path of paths) {
    for (const field of ["kind", "stage", "subjectSha256", "observationValue", "decision", "keyId", "observedAtUnixSeconds"]) {
      expectFixtureViolation(({ manifest }) => {
        let target = manifest;
        for (const key of path) target = target[key];
        target[field] = field === "observedAtUnixSeconds" ? "0" : `tampered-${field}`;
      }, /expected|does not match|invalid|absent|out of range/iu);
    }
  }
});

test("two-observer requirements reject same key, same endpoint, wrong value, missing, extra, or unsigned observations", () => {
  const locations = [
    ["phaseAProductionIdentityFreeze", "mainnetGenesisObservations"],
    ["phaseBCeremonyFunding", "payerBalanceObservations"],
    ["phaseCDeployedSeal", "terminalEndpointObservations"],
  ];
  for (const path of locations) {
    expectFixtureViolation(({ manifest }) => {
      const list = manifest[path[0]][path[1]];
      list[1].keyId = list[0].keyId;
    }, /observer key|observer keys|signature is invalid/iu);
    expectFixtureViolation(({ manifest }) => {
      const list = manifest[path[0]][path[1]];
      list[1].endpointSha256 = list[0].endpointSha256;
    }, /endpoint/iu);
    expectFixtureViolation(({ manifest }) => {
      manifest[path[0]][path[1]].pop();
    }, /exactly two|expected exactly two/iu);
    expectFixtureViolation(({ manifest }) => {
      manifest[path[0]][path[1]][0].signatureBase64url = "A".repeat(86);
    }, /signature is invalid/iu);
  }
});

test("phase A fails closed on identity drift, V2/7XZ reuse, source substitutions, and unsigned owner policy", () => {
  for (const value of [
    "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj",
    "7XZpNks16qmWruJxKzmB3JSsZUdtAJYCNSPEZ3GxdoZ8",
    "11111111111111111111111111111111",
  ]) expectFixtureViolation(({ manifest }) => {
    manifest.productionChoices.lawProgramId = value;
  }, /forbidden|subject commitment/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.productionChoices.canonicalMint = manifest.productionChoices.economyProgramId;
  }, /pairwise distinct|subject commitment/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.sourceBindings.identityInputFreeze.sha256 = digest("alternate-identity-input");
  }, /sourceBindings|subject commitment/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.phaseAProductionIdentityFreeze.ownerDecisionPreimageSha256 = digest("changed-owner-preimage");
  }, /subject commitment|does not match|signature is invalid/iu);
});

test("phase B binds two exact final binaries and fresh cost, funding, floor, buffer, recovery, and payer evidence", () => {
  const cases = [
    [(manifest) => { manifest.phaseBCeremonyFunding.finalBinaries.law.programId = manifest.productionChoices.economyProgramId; }, /program identity mismatch|subject commitment/iu],
    [(manifest) => { manifest.phaseBCeremonyFunding.finalBinaries.law.sha256 = digest("different-binary"); }, /subject commitment|signature is invalid/iu],
    [(manifest) => { manifest.phaseBCeremonyFunding.freshCostMeasurementSha256 = null; }, /SHA-256|subject commitment/iu],
    [(manifest) => { manifest.phaseBCeremonyFunding.aggregateFreshPayerPeakLamports = "3000000001"; }, /exceeds frozen 3 SOL|subject commitment/iu],
    [(manifest) => { manifest.phaseBCeremonyFunding.aggregatePermanentRentLamports = "1900000000"; }, /permanent rent plus recoverable buffer|subject commitment/iu],
    [(manifest) => { manifest.phaseBCeremonyFunding.ceremonyFloorLamports = "2000000000"; }, /does not cover exact peak plus fee|subject commitment/iu],
    [(manifest) => { manifest.phaseBCeremonyFunding.payerBalanceObservations[0].observationValue = "1"; }, /below ceremony floor|signature is invalid/iu],
    [(manifest) => { manifest.sourceBindings.costFeasibilityReference.bindingScope = "COMPLETION_EVIDENCE"; }, /reference-only COST|sourceBindings/iu],
  ];
  for (const [mutate, pattern] of cases) {
    expectFixtureViolation(({ manifest }) => mutate(manifest), pattern);
  }
});

test("completed evidence requires external evaluation time and rejects stale, future, skewed, or expired live observations", () => {
  const noEvaluation = completeFixture();
  const noEvaluationResult = validateProductionIdentityAuthorityEvidenceManifest(
    noEvaluation.manifest,
    {
      allowTestFixture: true,
      trustBinding: noEvaluation.context.trustBinding,
    },
  );
  assert.equal(noEvaluationResult.valid, false);
  assert.match(noEvaluationResult.violations.join("\n"), /externally supplied trusted evaluation time/iu);

  expectFixtureViolation((fixture) => {
    const phase = fixture.manifest.phaseBCeremonyFunding;
    phase.payerBalanceObservations[0] = resignAttestation(
      fixture.context,
      phase.payerBalanceObservations[0],
      { observedAtUnixSeconds: "2000999000" },
    );
  }, /live endpoint evidence is stale|bounded pair skew|evidence-review interval/iu);

  expectFixtureViolation((fixture) => {
    const phase = fixture.manifest.phaseBCeremonyFunding;
    phase.payerBalanceObservations[1] = resignAttestation(
      fixture.context,
      phase.payerBalanceObservations[1],
      { observedAtUnixSeconds: "2001000101" },
    );
  }, /future relative to externally supplied evaluation time|predates required signed evidence/iu);

  expectFixtureViolation((fixture) => {
    const phase = fixture.manifest.phaseBCeremonyFunding;
    phase.payerBalanceObservations[1] = resignAttestation(
      fixture.context,
      phase.payerBalanceObservations[1],
      { observedAtUnixSeconds: "2000999800" },
    );
  }, /bounded pair skew|live endpoint evidence is stale/iu);

  expectFixtureViolation((fixture) => {
    fixture.manifest.phaseBCeremonyFunding.expiresAtUnixSeconds = "2001000024";
    rebindPhaseBAttestations(fixture);
  }, /funding evidence has expired/iu);

  expectFixtureViolation((fixture) => {
    fixture.manifest.phaseBCeremonyFunding.expiresAtUnixSeconds = "2001002000";
    rebindPhaseBAttestations(fixture);
  }, /bounded post-observation funding evidence lifetime/iu);
});

test("phase order is strict: B cannot complete before A and C cannot complete before B", () => {
  expectFixtureViolation(({ manifest }) => {
    manifest.phaseAProductionIdentityFreeze.status = "PENDING";
    manifest.phaseAProductionIdentityFreeze.subjectSha256 = null;
    manifest.phaseAProductionIdentityFreeze.ownerDecisionPreimageSha256 = null;
    manifest.phaseAProductionIdentityFreeze.ownerAcceptance = null;
    manifest.phaseAProductionIdentityFreeze.mainnetGenesisObservations = [];
    manifest.phaseAProductionIdentityFreeze.independentReview = null;
    manifest.phaseAProductionIdentityFreeze.blocker = "The exact phase A identity evidence remains deliberately pending.";
  }, /phase A must complete first|owner-null|EVIDENCE_COMPLETE requires/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.phaseBCeremonyFunding.status = "PENDING";
    manifest.phaseBCeremonyFunding.subjectSha256 = null;
    manifest.phaseBCeremonyFunding.finalBinaries.law = Object.fromEntries(
      Object.keys(manifest.phaseBCeremonyFunding.finalBinaries.law).map((key) => [key, null]),
    );
    manifest.phaseBCeremonyFunding.finalBinaries.economy = clone(manifest.phaseBCeremonyFunding.finalBinaries.law);
    for (const key of [
      "freshCostMeasurementSha256", "fundingSourceApprovalSha256", "ceremonyFloorPolicySha256",
      "bufferRecoveryPlanSha256", "ceremonyFloorLamports", "aggregateFreshPayerPeakLamports",
      "aggregatePermanentRentLamports", "aggregateRecoverableBufferLamports", "aggregateFeeBudgetLamports",
      "fundingApproval", "independentReview",
    ]) manifest.phaseBCeremonyFunding[key] = null;
    manifest.phaseBCeremonyFunding.payerBalanceObservations = [];
    manifest.phaseBCeremonyFunding.blocker = "The exact phase B cost and funding evidence remains deliberately pending.";
  }, /phase B must complete first|EVIDENCE_COMPLETE requires/iu);
});

test("phase C requires every exact ordered stage, distinct evidence, terminal null authorities, and active/staging truth", () => {
  expectFixtureViolation(({ manifest }) => {
    [manifest.phaseCDeployedSeal.journal[0], manifest.phaseCDeployedSeal.journal[1]] =
      [manifest.phaseCDeployedSeal.journal[1], manifest.phaseCDeployedSeal.journal[0]];
  }, /exact ordered ceremony stage|subject mismatch/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.phaseCDeployedSeal.journal[8].status = "PENDING";
  }, /FINALIZED_MATCHED|subject mismatch/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.phaseCDeployedSeal.journal[8].evidenceSha256 = null;
  }, /SHA-256|subject mismatch/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.phaseCDeployedSeal.journal[8].evidenceSha256 =
      manifest.phaseCDeployedSeal.journal[7].evidenceSha256;
  }, /distinct evidence|subject mismatch/iu);
  for (const key of [
    "lawUpgradeAuthority",
    "economyUpgradeAuthority",
    "mintAuthority",
    "freezeAuthority",
    "transferHookAuthority",
    "confidentialTransferMintAuthority",
  ]) expectFixtureViolation(({ manifest }) => {
    manifest.phaseCDeployedSeal.terminalState[key] = manifest.productionChoices.ceremonySignerPublicKey;
  }, /terminal identity\/authority state mismatch|terminal state commitment/iu);
  for (const key of ["active", "genesisStagingWritesDisabled"]) expectFixtureViolation(({ manifest }) => {
    manifest.phaseCDeployedSeal.terminalState[key] = false;
  }, /terminal identity\/authority state mismatch|terminal state commitment/iu);
});

test("authorization, Gate 8, release, and Mainnet flags are immutable even after all three evidence stages", () => {
  for (const key of [
    "signingAuthorized",
    "deploymentAuthorized",
    "fundingSpendAuthorized",
    "activationAuthorized",
    "independentGate8Accepted",
    "releaseAuthorized",
    "mainnetExecutionAuthorized",
  ]) expectFixtureViolation(({ manifest }) => {
    manifest.authorizationBoundary[key] = true;
  }, /authorizationBoundary/iu);
  expectFixtureViolation(({ manifest }) => {
    manifest.authorizationBoundary.mainnetStatus = "GO";
  }, /authorizationBoundary/iu);
});

test("strict input rejects duplicate JSON keys, accessors, symbols, sparse arrays, cycles, and extra packet trust material", () => {
  assert.throws(
    () => parseProductionIdentityAuthorityEvidenceJson('{"alpha":1,"\\u0061lpha":2}'),
    /duplicate JSON member/iu,
  );
  const cases = [];
  const symbol = clone(DRAFT);
  symbol[Symbol("extra")] = true;
  cases.push(symbol);
  const sparse = clone(DRAFT);
  sparse.phaseCDeployedSeal.journal.length = 18;
  delete sparse.phaseCDeployedSeal.journal[17];
  cases.push(sparse);
  const cycle = clone(DRAFT);
  cycle.scope.loop = cycle;
  cases.push(cycle);
  const extra = clone(DRAFT);
  extra.trustKeys = [];
  cases.push(extra);
  for (const malformed of cases) {
    const result = validateProductionIdentityAuthorityEvidenceManifest(malformed);
    assert.equal(result.valid, false);
    assert.notEqual(result.violations.length, 0);
  }
  const accessor = clone(DRAFT);
  let reads = 0;
  Object.defineProperty(accessor, "profile", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("PROFILE_GETTER_EXECUTED");
    },
  });
  const result = validateProductionIdentityAuthorityEvidenceManifest(accessor);
  assert.equal(reads, 0);
  assert.equal(result.valid, false);
  assert.match(result.violations.join("\n"), /data property/iu);
});

test("validator remains pure, host-only, network-free, nonexecuting, and nonauthorizing", () => {
  assert.doesNotMatch(VALIDATOR_SOURCE, /fetch\(|https\.request|http\.request|@solana|web3/iu);
  assert.doesNotMatch(VALIDATOR_SOURCE, /execFile|spawn|writeFile|appendFile|git\s+(?:add|commit|push)/iu);
  assert.doesNotMatch(VALIDATOR_SOURCE, /privateKey|secretKey|keypair/iu);
  assert.match(VALIDATOR_SOURCE, /canonicalizeRfc8785/iu);
  assert.match(VALIDATOR_SOURCE, /verifySignature/iu);
  assert.match(VALIDATOR_SOURCE, /mainnetExecutionAuthorized:\s*false/iu);
  assert.match(VALIDATOR_SOURCE, /independentGate8Accepted:\s*false/iu);
});

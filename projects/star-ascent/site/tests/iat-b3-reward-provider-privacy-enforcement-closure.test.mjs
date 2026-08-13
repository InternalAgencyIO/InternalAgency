import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  AUTOMATED_GATE_8_PREDICATE,
  AUDITED_FEATURES,
  ENFORCEMENT_CLOSURE_HUMAN_GATE_SCOPE,
  ENFORCEMENT_CLOSURE_MAINNET_STATUS,
  ENFORCEMENT_CLOSURE_SCHEMA,
  ENFORCEMENT_CLOSURE_SOLE_HUMAN_GATE,
  ENFORCEMENT_CLOSURE_STATUS,
  EXPECTED_SOURCE_BINDINGS,
  REQUIRED_DEPENDENCY_NODE_IDS,
  REQUIRED_RUNTIME_SURFACES,
  assertRewardProviderPrivacyRuntimeAuthenticated,
  validateRewardProviderPrivacyEnforcementClosure,
} from "../scripts/validate-iat-b3-reward-provider-privacy-enforcement-closure.mjs";

const manifestPath = new URL(
  "../docs/b3/iat-b3-reward-provider-privacy-enforcement-closure.v1.json",
  import.meta.url,
);
const validatorPath = fileURLToPath(new URL(
  "../scripts/validate-iat-b3-reward-provider-privacy-enforcement-closure.mjs",
  import.meta.url,
));
const draft = JSON.parse(readFileSync(manifestPath, "utf8"));
const closureDoc = readFileSync(new URL(
  "../docs/b3/REWARD_PROVIDER_PRIVACY_ENFORCEMENT_CLOSURE.md",
  import.meta.url,
), "utf8");
const clone = (value) => structuredClone(value);

function repositoryFile(path) {
  return new URL(`../../../../${path}`, import.meta.url);
}

test("current reward/provider/privacy truth is structurally valid but explicitly HOLD", () => {
  const result = validateRewardProviderPrivacyEnforcementClosure(draft);
  assert.equal(result.valid, true);
  assert.deepEqual(result.violations, []);
  assert.equal(result.schema, ENFORCEMENT_CLOSURE_SCHEMA);
  assert.equal(result.status, ENFORCEMENT_CLOSURE_STATUS);
  assert.equal(result.mainnetStatus, ENFORCEMENT_CLOSURE_MAINNET_STATUS);
  assert.equal(result.retainedParityFeatureCount, 53);
  assert.equal(result.auditedFeatureCount, 12);
  assert.equal(result.runtimeAuthenticatedFeatureCount, 0);
  assert.equal(result.closureComplete, false);
  assert.equal(result.runtimeAuthenticationVerified, false);
  assert.equal(result.activationReady, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.deepEqual(result.unresolvedRuntimeExposureIds, []);
  assert.equal(result.blockers.length, 12);
  assert.deepEqual(
    draft.featureRows.map(({ ordinal }) => ordinal),
    AUDITED_FEATURES.map(({ ordinal }) => ordinal),
  );
  assert.deepEqual(
    draft.dependencyNodes.map(({ id }) => id),
    REQUIRED_DEPENDENCY_NODE_IDS,
  );
  assert.deepEqual(EXPECTED_SOURCE_BINDINGS.slice(0, 2), [
    {
      path: "projects/star-ascent/site/docs/b3/iat-b3-v2-parity-claims-readiness.v1.json",
      sha256: "114b17900867df54407bb5f4bdec5f9916596f57e8e096df1cbad595c93edca2",
      byteLength: 12662,
    },
    {
      path: "projects/star-ascent/site/docs/b3/iat-b3-release-dependency-graph.v1.json",
      sha256: "68b22e29f555adb2f59fe5cf42e6a1bf7783a8c962195de6f7736ccd9b1ea843",
      byteLength: 31813,
    },
  ]);
});

test("Gate 8 is automated direct evidence while Model T remains signature-only human gate", () => {
  const result = validateRewardProviderPrivacyEnforcementClosure(draft);
  assert.deepEqual(draft.gatePolicy, {
    gate8Predicate: AUTOMATED_GATE_8_PREDICATE,
    gate8PredicateSatisfied: false,
    directEvidenceOnly: true,
    humanReviewerRequired: false,
    multipleAutomatedEvidenceSourcesRequired: true,
    noSelfAttestation: true,
    soleHumanGate: ENFORCEMENT_CLOSURE_SOLE_HUMAN_GATE,
    humanGateScope: ENFORCEMENT_CLOSURE_HUMAN_GATE_SCOPE,
  });
  assert.equal(result.gate8Predicate, AUTOMATED_GATE_8_PREDICATE);
  assert.equal(result.gate8PredicateSatisfied, false);
  assert.equal(result.humanReviewerRequired, false);
  assert.equal(result.soleHumanGate, "TREZOR_MODEL_T_PHYSICAL_CONFIRMATION");
  assert.match(closureDoc, /SOURCE_BOUND_AUTOMATED_GATE_8_DIRECT_EVIDENCE_PACKET/u);
  assert.match(closureDoc, /Trezor Model T.*sole human gate/isu);
  assert.doesNotMatch(
    closureDoc,
    /independent observers|independent privacy\/security review|independently review(?:ed|able)?/iu,
  );

  for (const mutate of [
    (packet) => { packet.gatePolicy.gate8PredicateSatisfied = true; },
    (packet) => { packet.gatePolicy.humanReviewerRequired = true; },
    (packet) => { packet.gatePolicy.multipleAutomatedEvidenceSourcesRequired = false; },
    (packet) => { packet.gatePolicy.noSelfAttestation = false; },
    (packet) => { packet.gatePolicy.soleHumanGate = "SEPARATE_HUMAN_REVIEW"; },
    (packet) => { packet.gatePolicy.humanGateScope = "ALL_RELEASE_DECISIONS"; },
  ]) {
    const invalid = clone(draft);
    mutate(invalid);
    const invalidResult = validateRewardProviderPrivacyEnforcementClosure(invalid);
    assert.equal(invalidResult.valid, false);
    assert.equal(invalidResult.gate8PredicateSatisfied, false);
    assert.equal(invalidResult.mainnetStatus, "HOLD");
    assert.match(invalidResult.violations.join("\n"), /gatePolicy/u);
  }
});

test("source-bound disable evidence now includes the replaced X callback without promoting runtime authentication", () => {
  const result = validateRewardProviderPrivacyEnforcementClosure(draft);
  assert.equal(
    result.sourceBoundDisabledSurfaceIds.includes("REWARD_PUBLICATION_SIGNING_AND_BROADCAST"),
    true,
  );
  assert.equal(
    result.sourceBoundDisabledSurfaceIds.includes("PRIVACY_VAULT_NATIVE_EXECUTION"),
    true,
  );
  assert.equal(
    result.sourceBoundDisabledSurfaceIds.includes("RETAINED_V2_X_CALLBACK_WRITE_BOUNDARY"),
    true,
  );
  const xBoundary = draft.runtimeSurfaces.find(({ id }) => id === "RETAINED_V2_X_CALLBACK_WRITE_BOUNDARY");
  assert.equal(xBoundary.present, true);
  assert.equal(xBoundary.writesRuntimeState, false);
  assert.equal(xBoundary.runtimeAuthenticated, false);
  assert.equal(xBoundary.sourceBoundDisableVerified, true);

  const relabeled = clone(draft);
  relabeled.runtimeSurfaces[1].state = "RUNTIME_AUTHENTICATED";
  relabeled.runtimeSurfaces[1].writesRuntimeState = true;
  relabeled.runtimeSurfaces[1].runtimeAuthenticated = true;
  const relabeledResult = validateRewardProviderPrivacyEnforcementClosure(relabeled);
  assert.equal(relabeledResult.valid, false);
  assert.match(relabeledResult.violations.join("\n"), /RETAINED_V2_X_CALLBACK_WRITE_BOUNDARY|writesRuntimeState|runtimeAuthenticated/u);
});

test("audited retained features cannot be omitted, reordered, or promoted by assertion", () => {
  const omitted = clone(draft);
  omitted.featureRows.splice(5, 1);
  assert.equal(validateRewardProviderPrivacyEnforcementClosure(omitted).valid, false);
  assert.match(
    validateRewardProviderPrivacyEnforcementClosure(omitted).violations.join("\n"),
    /expected exactly 12 audited retained rows/u,
  );

  const promoted = clone(draft);
  promoted.featureRows[0].runtimeAuthenticated = true;
  promoted.featureRows[0].activationAuthorized = true;
  promoted.runtimeAuthenticationVerified = true;
  promoted.activationReady = true;
  const promotedResult = validateRewardProviderPrivacyEnforcementClosure(promoted);
  assert.equal(promotedResult.valid, false);
  assert.equal(promotedResult.runtimeAuthenticationVerified, false);
  assert.equal(promotedResult.activationReady, false);
  assert.match(promotedResult.violations.join("\n"), /must remain false/u);
});

test("bound source drift and false provider or privacy evidence fail closed", () => {
  const driftPath = EXPECTED_SOURCE_BINDINGS[2].path;
  const driftedFiles = new Map([[
    driftPath,
    Buffer.concat([readFileSync(repositoryFile(driftPath)), Buffer.from("\n")]),
  ]]);
  const drifted = validateRewardProviderPrivacyEnforcementClosure(draft, {
    boundFiles: driftedFiles,
  });
  assert.equal(drifted.valid, false);
  assert.match(drifted.violations.join("\n"), /byte length|SHA-256/u);

  const checkpointPath = EXPECTED_SOURCE_BINDINGS[8].path;
  const checkpoint = JSON.parse(readFileSync(repositoryFile(checkpointPath), "utf8"));
  checkpoint.runtimeAuthenticationVerified = true;
  checkpoint.referenceContract.providerIntegrationPresent = true;
  const falseProvider = validateRewardProviderPrivacyEnforcementClosure(draft, {
    boundFiles: new Map([[checkpointPath, JSON.stringify(checkpoint, null, 2)]]),
  });
  assert.equal(falseProvider.valid, false);
  assert.match(falseProvider.violations.join("\n"), /external checkpoint integration|runtimeAuthenticationVerified/u);

  const privacyPath = EXPECTED_SOURCE_BINDINGS[10].path;
  const privacy = JSON.parse(readFileSync(repositoryFile(privacyPath), "utf8"));
  privacy.constructionChecks.instructionSubmitted = true;
  privacy.mainnetExecutionAuthorized = true;
  const falsePrivacy = validateRewardProviderPrivacyEnforcementClosure(draft, {
    boundFiles: new Map([[privacyPath, JSON.stringify(privacy, null, 2)]]),
  });
  assert.equal(falsePrivacy.valid, false);
  assert.match(falsePrivacy.violations.join("\n"), /privacy boundary|mainnetExecutionAuthorized/u);
});

test("runtime-authenticated assertion always rejects today's valid HOLD packet", () => {
  assert.throws(
    () => assertRewardProviderPrivacyRuntimeAuthenticated(draft),
    /REWARD_PROVIDER_PRIVACY_RUNTIME_AUTHENTICATION_HOLD/u,
  );
  assert.equal(REQUIRED_RUNTIME_SURFACES.length, 6);
});

test("CLI is machine-readable and exits nonzero for today's valid HOLD", () => {
  const run = spawnSync(process.execPath, [validatorPath], {
    cwd: fileURLToPath(new URL("../", import.meta.url)),
    encoding: "utf8",
  });
  assert.equal(run.status, 2, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.valid, true);
  assert.equal(result.status, ENFORCEMENT_CLOSURE_STATUS);
  assert.equal(result.mainnetStatus, "HOLD");
  assert.deepEqual(result.unresolvedRuntimeExposureIds, []);
  assert.equal(result.runtimeAuthenticatedFeatureCount, 0);
  assert.equal(result.closureComplete, false);
});

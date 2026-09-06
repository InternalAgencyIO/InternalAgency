import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = resolve(
  root,
  "docs/b3/evidence/authenticated-daily-law-stake-ingress-final-artifact-20260813.json",
);
const ownerPolicyPath = resolve(root, "docs/b3/iat-b3-owner-policy-freeze.v1.json");
const graphPath = resolve(root, "docs/b3/iat-b3-release-dependency-graph.v1.json");
const FINAL_GRAPH_SHA256 = "68b22e29f555adb2f59fe5cf42e6a1bf7783a8c962195de6f7736ccd9b1ea843";
const FINAL_GRAPH_BYTE_LENGTH = 31813;
const AUTOMATED_GATE_8_PREDICATE =
  "SOURCE_BOUND_AUTOMATED_GATE_8_DIRECT_EVIDENCE_PACKET";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("the final artifact binds every unchanged production law and stake source", async () => {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  const sourcePaths = {
    lawLibSha256: "programs/iat_b3_law/src/lib.rs",
    lawStakeIngressSha256: "programs/iat_b3_law/src/stake_ingress.rs",
    economyStakeIngressRuntimeSha256: "programs/iat_b3_economy/src/stake_ingress_runtime.rs",
    economyStakeIngressKernelSha256: "programs/iat_b3_economy/src/stake_ingress.rs",
    combinedRehearsalDriverSha256:
      "scripts/iat-b3-combined-law-stake-local-rehearsal-driver.mjs",
    combinedRehearsalRunnerSha256: "scripts/run-iat-b3-combined-law-stake-local-rehearsal.sh",
  };
  for (const [field, relativePath] of Object.entries(sourcePaths)) {
    assert.equal(sha256(await readFile(resolve(root, relativePath))), artifact.sourceBinding[field]);
  }
  assert.equal(
    sha256(await readFile(ownerPolicyPath)),
    artifact.sourceBinding.ownerPolicyFreezeSha256,
  );
  const graphBytes = await readFile(graphPath);
  assert.equal(graphBytes.length, FINAL_GRAPH_BYTE_LENGTH);
  assert.equal(sha256(graphBytes), FINAL_GRAPH_SHA256);
  assert.equal(artifact.sourceBinding.releaseGraphSha256, FINAL_GRAPH_SHA256);
});

test("the artifact binds the two prior local-validator packets by exact bytes", async () => {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  for (const evidence of [
    artifact.evidenceInputs.combinedLawStakeLocalValidator,
    artifact.evidenceInputs.stakeIngressProductionExecutor,
  ]) {
    assert.equal(sha256(await readFile(resolve(root, evidence.path))), evidence.sha256);
  }
});

test("owner entropy acceptance remains null and every release claim remains HOLD", async () => {
  const [artifact, ownerPolicy] = await Promise.all([
    readFile(artifactPath, "utf8").then(JSON.parse),
    readFile(ownerPolicyPath, "utf8").then(JSON.parse),
  ]);
  const ownerChoice =
    ownerPolicy.nodes.PRODUCTION_IDENTITY_INPUT_FREEZE.ownerChoices.entropyRiskAcceptance;
  assert.equal(ownerChoice, null);
  assert.equal(artifact.ownerControl.entropyRiskAcceptance, ownerChoice);
  assert.equal(artifact.ownerControl.selectedByEngineering, false);
  assert.equal(artifact.truth.ownerEntropyRiskAccepted, false);
  assert.equal(artifact.truth.productionIdentityBindingFrozen, false);
  assert.equal(artifact.truth.finalBinary, false);
  assert.equal(artifact.truth.fullFeatureDevnetRehearsalComplete, false);
  assert.equal(artifact.truth.activationReady, false);
  assert.equal(artifact.truth.mainnetExecutionAuthorized, false);
  assert.equal(artifact.truth.mainnetStatus, "HOLD");
});

test("law and stake evidence is one fail-closed artifact without a probability overclaim", async () => {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  assert.equal(artifact.authenticatedDailyLaw.directHookBypassRejected, true);
  assert.equal(artifact.authenticatedDailyLaw.invocationRelativeEntropyMeasuredOffline, true);
  assert.equal(artifact.authenticatedDailyLaw.unbiasedVrfClaimed, false);
  assert.equal(artifact.authenticatedDailyLaw.realizedFridayProbabilityClaimed, false);
  assert.equal(artifact.authenticatedStakeIngress.dailyLawAuthenticatedBeforeTokenParsing, true);
  assert.equal(artifact.authenticatedStakeIngress.directStakeVaultDonationRejected, true);
  assert.equal(artifact.authenticatedStakeIngress.priorDelegateRestoredExactly, true);
  assert.equal(
    artifact.authenticatedStakeIngress.persistenceCallbackFailureRolledBackFullSequence,
    true,
  );
  assert.deepEqual(artifact.remainingGates, [
    "OWNER_ENTROPY_RISK_ACCEPTANCE_OR_REDESIGN",
    "EMPIRICAL_SKIPPED_SLOT_FORK_CONGESTION_AND_ORDERING_TRACE",
    "FROZEN_PRODUCTION_LAW_ECONOMY_MINT_IDENTITIES",
    "PRODUCTION_ECONOMY_ENTRYPOINT_AND_COMPLETE_ALL_15_DISPATCH",
    "RETAINED_V2_PERSISTENCE_COMPLETION",
    "EXACT_FINAL_BINARY_REPRODUCIBLE_BUILD",
    "FINAL_BINARY_PUBLIC_DEVNET_ADVERSARIAL_REHEARSAL",
    AUTOMATED_GATE_8_PREDICATE,
  ]);
  assert.deepEqual(artifact.gatePolicy, {
    gate8Predicate: AUTOMATED_GATE_8_PREDICATE,
    gate8PredicateSatisfied: false,
    directEvidenceOnly: true,
    humanReviewerRequired: false,
    independentObserverRequired: false,
    soleHumanGate: "TREZOR_MODEL_T_PHYSICAL_CONFIRMATION",
    humanGateScope: "ACTUAL_CRYPTOGRAPHIC_SIGNATURES_ONLY",
  });
});

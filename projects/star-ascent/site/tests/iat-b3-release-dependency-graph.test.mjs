import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  RELEASE_DEPENDENCY_APPLICABILITY_POLICY,
  RELEASE_DEPENDENCY_ARTIFACT_POLICY,
  RELEASE_DEPENDENCY_EDGES,
  RELEASE_DEPENDENCY_GRAPH_MAINNET_STATUS,
  RELEASE_DEPENDENCY_GRAPH_SCHEMA,
  RELEASE_DEPENDENCY_GRAPH_SHA256,
  RELEASE_DEPENDENCY_GRAPH_STATUS,
  RELEASE_DEPENDENCY_NODE_IDS,
  RELEASE_DEPENDENCY_NODE_SPECS,
  assertReleaseDependencyReviewPacketComplete,
  createReleaseDependencyGraphTestFixture,
  parseReleaseDependencyGraphJson,
  validateReleaseDependencyGraphManifest,
} from "../scripts/validate-iat-b3-release-dependency-graph.mjs";

const SITE = fileURLToPath(new URL("../", import.meta.url));
const MANIFEST_PATH = join(SITE, "docs", "b3", "iat-b3-release-dependency-graph.v1.json");
const SCHEMA_PATH = join(SITE, "docs", "b3", "iat-b3-release-dependency-graph.v1.schema.json");
const VALIDATOR_PATH = join(SITE, "scripts", "validate-iat-b3-release-dependency-graph.mjs");
const DRAFT = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
const VALIDATOR_SOURCE = readFileSync(VALIDATOR_PATH, "utf8");

const EXPECTED_NODE_IDS = Object.freeze([
  "LIVE_ESTATE_CANONICAL_MINT_DECISION",
  "V2_FEATURE_PARITY",
  "TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY",
  "CORE_CUSTODY_POLICY_ADAPTER",
  "FACTION_ECONOMICS_FUNDING",
  "CONFIG_GENESIS_PHASE_CODEC",
  "GENESIS_ALLOCATIONS_CONSERVATION",
  "PRODUCTION_IDENTITY_INPUT_FREEZE",
  "DAILY_LAW_NATIVE_HOOK",
  "COMBINED_STAKE_INGRESS_HOOK",
  "REWARD_WATERFALL_PROOFS",
  "DURABLE_REWARD_CAS",
  "EXTERNAL_CHECKPOINT_PROVIDER",
  "X_SOCIAL_EVIDENCE_PROVIDER",
  "ECONOMY_ALL_15_WRITE_ADAPTER",
  "REWARD_LOCAL_WRITE_CONSUMER_GATING",
  "PRIVACY_VAULT_CLIENT",
  "DEPENDENCY_SECURITY_REMEDIATION",
  "PRODUCTION_BINARY_REPRODUCIBILITY",
  "ADVERSARIAL_DEVNET_REHEARSAL",
  "DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE",
  "B3_COST_CEREMONY_FUNDING",
  "LOCALIZATION_EVIDENCE",
  "MEDIA_MASTER_COMPLETENESS",
  "V2_LAUNCH_CEREMONY_BOUNDARY",
  "RELEASE_SURFACE_PUBLIC_CLAIMS",
  "INDEPENDENT_SECURITY_ECONOMIC_PRIVACY_LEGAL_REVIEW",
  "TERMINAL_B3_REVIEW_PACKET",
]);

const EXPECTED_DEPENDENCIES = Object.freeze({
  LIVE_ESTATE_CANONICAL_MINT_DECISION: [],
  V2_FEATURE_PARITY: [],
  TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY: [],
  CORE_CUSTODY_POLICY_ADAPTER: ["V2_FEATURE_PARITY"],
  FACTION_ECONOMICS_FUNDING: ["V2_FEATURE_PARITY"],
  CONFIG_GENESIS_PHASE_CODEC: ["V2_FEATURE_PARITY", "CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING"],
  GENESIS_ALLOCATIONS_CONSERVATION: ["LIVE_ESTATE_CANONICAL_MINT_DECISION", "V2_FEATURE_PARITY", "CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING", "CONFIG_GENESIS_PHASE_CODEC"],
  PRODUCTION_IDENTITY_INPUT_FREEZE: ["LIVE_ESTATE_CANONICAL_MINT_DECISION", "TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING", "CONFIG_GENESIS_PHASE_CODEC", "GENESIS_ALLOCATIONS_CONSERVATION"],
  DAILY_LAW_NATIVE_HOOK: ["TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "PRODUCTION_IDENTITY_INPUT_FREEZE"],
  COMBINED_STAKE_INGRESS_HOOK: ["TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "CONFIG_GENESIS_PHASE_CODEC", "PRODUCTION_IDENTITY_INPUT_FREEZE", "DAILY_LAW_NATIVE_HOOK"],
  REWARD_WATERFALL_PROOFS: ["V2_FEATURE_PARITY", "CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING"],
  DURABLE_REWARD_CAS: ["DAILY_LAW_NATIVE_HOOK", "REWARD_WATERFALL_PROOFS"],
  EXTERNAL_CHECKPOINT_PROVIDER: ["PRODUCTION_IDENTITY_INPUT_FREEZE", "DURABLE_REWARD_CAS"],
  X_SOCIAL_EVIDENCE_PROVIDER: ["PRODUCTION_IDENTITY_INPUT_FREEZE", "REWARD_WATERFALL_PROOFS", "DURABLE_REWARD_CAS", "EXTERNAL_CHECKPOINT_PROVIDER"],
  ECONOMY_ALL_15_WRITE_ADAPTER: ["V2_FEATURE_PARITY", "TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING", "CONFIG_GENESIS_PHASE_CODEC", "GENESIS_ALLOCATIONS_CONSERVATION", "PRODUCTION_IDENTITY_INPUT_FREEZE", "DAILY_LAW_NATIVE_HOOK", "COMBINED_STAKE_INGRESS_HOOK", "REWARD_WATERFALL_PROOFS"],
  REWARD_LOCAL_WRITE_CONSUMER_GATING: ["PRODUCTION_IDENTITY_INPUT_FREEZE", "DAILY_LAW_NATIVE_HOOK", "REWARD_WATERFALL_PROOFS", "DURABLE_REWARD_CAS", "EXTERNAL_CHECKPOINT_PROVIDER", "X_SOCIAL_EVIDENCE_PROVIDER", "ECONOMY_ALL_15_WRITE_ADAPTER"],
  PRIVACY_VAULT_CLIENT: ["V2_FEATURE_PARITY", "TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "PRODUCTION_IDENTITY_INPUT_FREEZE", "DAILY_LAW_NATIVE_HOOK"],
  DEPENDENCY_SECURITY_REMEDIATION: ["V2_FEATURE_PARITY"],
  PRODUCTION_BINARY_REPRODUCIBILITY: ["TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "PRODUCTION_IDENTITY_INPUT_FREEZE", "DAILY_LAW_NATIVE_HOOK", "COMBINED_STAKE_INGRESS_HOOK", "ECONOMY_ALL_15_WRITE_ADAPTER", "REWARD_LOCAL_WRITE_CONSUMER_GATING", "PRIVACY_VAULT_CLIENT", "DEPENDENCY_SECURITY_REMEDIATION"],
  ADVERSARIAL_DEVNET_REHEARSAL: ["TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "PRODUCTION_BINARY_REPRODUCIBILITY"],
  DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE: ["LIVE_ESTATE_CANONICAL_MINT_DECISION", "PRODUCTION_IDENTITY_INPUT_FREEZE", "PRODUCTION_BINARY_REPRODUCIBILITY", "ADVERSARIAL_DEVNET_REHEARSAL"],
  B3_COST_CEREMONY_FUNDING: ["GENESIS_ALLOCATIONS_CONSERVATION", "PRODUCTION_BINARY_REPRODUCIBILITY"],
  LOCALIZATION_EVIDENCE: ["V2_FEATURE_PARITY"],
  MEDIA_MASTER_COMPLETENESS: ["V2_FEATURE_PARITY"],
  V2_LAUNCH_CEREMONY_BOUNDARY: ["LIVE_ESTATE_CANONICAL_MINT_DECISION", "V2_FEATURE_PARITY"],
  RELEASE_SURFACE_PUBLIC_CLAIMS: ["LIVE_ESTATE_CANONICAL_MINT_DECISION", "V2_FEATURE_PARITY", "PRODUCTION_IDENTITY_INPUT_FREEZE", "DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE", "LOCALIZATION_EVIDENCE", "MEDIA_MASTER_COMPLETENESS", "V2_LAUNCH_CEREMONY_BOUNDARY"],
  INDEPENDENT_SECURITY_ECONOMIC_PRIVACY_LEGAL_REVIEW: ["TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING", "CONFIG_GENESIS_PHASE_CODEC", "GENESIS_ALLOCATIONS_CONSERVATION", "PRODUCTION_IDENTITY_INPUT_FREEZE", "DAILY_LAW_NATIVE_HOOK", "COMBINED_STAKE_INGRESS_HOOK", "REWARD_WATERFALL_PROOFS", "DURABLE_REWARD_CAS", "EXTERNAL_CHECKPOINT_PROVIDER", "X_SOCIAL_EVIDENCE_PROVIDER", "ECONOMY_ALL_15_WRITE_ADAPTER", "REWARD_LOCAL_WRITE_CONSUMER_GATING", "PRIVACY_VAULT_CLIENT", "DEPENDENCY_SECURITY_REMEDIATION", "PRODUCTION_BINARY_REPRODUCIBILITY", "ADVERSARIAL_DEVNET_REHEARSAL", "DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE", "B3_COST_CEREMONY_FUNDING", "LOCALIZATION_EVIDENCE", "MEDIA_MASTER_COMPLETENESS", "RELEASE_SURFACE_PUBLIC_CLAIMS"],
  TERMINAL_B3_REVIEW_PACKET: EXPECTED_NODE_IDS.slice(0, -1),
});

const EXPECTED_EDGES = Object.freeze(EXPECTED_NODE_IDS.flatMap((dependent) =>
  EXPECTED_DEPENDENCIES[dependent].map((prerequisite) => [prerequisite, dependent])));
const clone = (value) => structuredClone(value);
const fixture = () => createReleaseDependencyGraphTestFixture(DRAFT);
const node = (manifest, id) => manifest.nodes.find((entry) => entry.id === id);

function fixtureResult(manifest) {
  return validateReleaseDependencyGraphManifest(manifest, {
    allowTestFixture: true,
    evaluationUnixSeconds: "2001000000",
  });
}

function expectFixtureViolation(mutator, pattern) {
  const manifest = fixture();
  mutator(manifest);
  let result;
  assert.doesNotThrow(() => { result = fixtureResult(manifest); });
  assert.equal(result.dependencyReviewPacketComplete, false);
  assert.match(result.violations.join("\n"), pattern);
}

test("canonical production graph is valid, records the completed host root, and remains nonactivating", () => {
  const result = validateReleaseDependencyGraphManifest(DRAFT);
  assert.equal(DRAFT.schema, RELEASE_DEPENDENCY_GRAPH_SCHEMA);
  assert.equal(DRAFT.status, "BLOCKED");
  assert.equal(RELEASE_DEPENDENCY_GRAPH_STATUS, "NONACTIVATING_STRUCTURAL_DEPENDENCY_REVIEW_PACKET");
  assert.equal(result.valid, true);
  assert.equal(result.dependencyInventoryComplete, true);
  assert.equal(result.dependencyGraphValid, true);
  assert.equal(result.dependencyReviewPacketComplete, false);
  assert.equal(result.productionDependencyReviewPacketComplete, false);
  assert.equal(result.blockers.length, 28);
  assert.deepEqual(result.violations, []);
  assert.equal(node(DRAFT, "TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY").status, "STRUCTURAL_REVIEW_PACKET_COMPLETE");
  assert.equal(node(DRAFT, "TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY").blocker, null);
  assert.equal(
    node(DRAFT, "TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY").completionEvidence.artifactSha256,
    "90ee8a911cd33fc64ffe475421251539dadfc8d617508bd9302d88269c4a74c3",
  );
  for (const key of [
    "externalTruthVerified",
    "runtimeAuthenticationVerified",
    "providerEvidenceVerified",
    "rollbackProtectionVerified",
    "runtimeEnforcementVerified",
    "activationReady",
    "releaseAuthorizationVerified",
    "mainnetExecutionAuthorized",
  ]) assert.equal(result[key], false);
  assert.equal(result.mainnetStatus, "HOLD");
  assert.equal(RELEASE_DEPENDENCY_GRAPH_MAINNET_STATUS, "HOLD");
  assert.equal("ready" in result, false);
  assert.equal("GO" in result, false);
  assert.equal("productionReady" in result, false);
  assert.equal("mainnetReady" in result, false);
});

test("schema pins the exact 28-node, 132-edge structural-only surface", () => {
  assert.equal(SCHEMA.$id, "urn:iat:b3:release-dependency-graph:v1");
  assert.equal(SCHEMA.additionalProperties, false);
  assert.deepEqual([...SCHEMA.required].sort(), Object.keys(DRAFT).sort());
  assert.equal(SCHEMA.properties.nodes.minItems, 28);
  assert.equal(SCHEMA.properties.nodes.maxItems, 28);
  assert.equal(SCHEMA.properties.nodes.prefixItems.length, 28);
  assert.equal(SCHEMA.properties.edges.minItems, 132);
  assert.equal(SCHEMA.properties.edges.maxItems, 132);
  assert.equal(SCHEMA.properties.edges.prefixItems.length, 132);
  assert.deepEqual(SCHEMA.properties.applicabilityPolicy.const, RELEASE_DEPENDENCY_APPLICABILITY_POLICY);
  assert.deepEqual(SCHEMA.properties.artifactBindingPolicy.const, RELEASE_DEPENDENCY_ARTIFACT_POLICY);
  for (const key of [
    "externalTruthVerified",
    "runtimeAuthenticationVerified",
    "providerEvidenceVerified",
    "rollbackProtectionVerified",
    "runtimeEnforcementVerified",
    "activationReady",
    "releaseAuthorizationVerified",
    "mainnetExecutionAuthorized",
  ]) assert.equal(SCHEMA.properties[key].const, false);
  assert.equal(SCHEMA.properties.mainnetStatus.const, "HOLD");
});

test("an explicit fixture closes only the structural graph and is never production readiness", () => {
  const manifest = fixture();
  const result = fixtureResult(manifest);
  assert.equal(result.valid, true);
  assert.equal(result.dependencyReviewPacketComplete, true);
  assert.equal(result.productionDependencyReviewPacketComplete, false);
  assert.equal(result.externalTruthVerified, false);
  assert.equal(result.runtimeAuthenticationVerified, false);
  assert.equal(result.activationReady, false);
  assert.equal(result.releaseAuthorizationVerified, false);
  assert.equal(result.mainnetExecutionAuthorized, false);
  assert.equal(result.mainnetStatus, "HOLD");
  assert.equal(
    assertReleaseDependencyReviewPacketComplete(manifest, {
      allowTestFixture: true,
      evaluationUnixSeconds: "2001000000",
    }).dependencyReviewPacketComplete,
    true,
  );
  const unauthorized = validateReleaseDependencyGraphManifest(manifest);
  assert.equal(unauthorized.dependencyReviewPacketComplete, false);
  assert.match(unauthorized.violations.join("\n"), /requires explicit allowTestFixture/u);
});

test("exact ordered node and edge inventories encode the corrected dependency DAG", () => {
  assert.deepEqual(RELEASE_DEPENDENCY_NODE_IDS, EXPECTED_NODE_IDS);
  assert.deepEqual(
    RELEASE_DEPENDENCY_NODE_SPECS.at(-1).dependencies,
    EXPECTED_NODE_IDS.slice(0, -1),
  );
  assert.deepEqual(DRAFT.nodes.map(({ id }) => id), EXPECTED_NODE_IDS);
  assert.deepEqual(RELEASE_DEPENDENCY_EDGES, EXPECTED_EDGES);
  assert.deepEqual(DRAFT.edges, EXPECTED_EDGES);
  assert.equal(RELEASE_DEPENDENCY_EDGES.length, 132);
  assert.equal(RELEASE_DEPENDENCY_GRAPH_SHA256, "1299256f34d40131144c76c22510408255cb06970a09ffdd653c9326f4b7fa00");
  assert.equal(DRAFT.graphDefinitionSha256, RELEASE_DEPENDENCY_GRAPH_SHA256);
  assert.deepEqual(
    DRAFT.terminalPredicate.requiredNodeIds,
    EXPECTED_NODE_IDS.slice(0, -1),
  );
  assert.equal(
    DRAFT.edges.filter(([, dependent]) => dependent === "TERMINAL_B3_REVIEW_PACKET").length,
    27,
  );
});

test("missing, extra, duplicate, unknown, self, cyclic, and sparse graph members fail closed", () => {
  expectFixtureViolation((value) => value.nodes.pop(), /exact ordered 28-node inventory/u);
  expectFixtureViolation((value) => value.nodes.push(clone(value.nodes[0])), /exact ordered 28-node inventory/u);
  expectFixtureViolation((value) => { value.nodes[4] = clone(value.nodes[3]); }, /exact ordered node inventory drifted/u);
  expectFixtureViolation((value) => { value.nodes[4] = null; }, /expected an object/u);
  expectFixtureViolation((value) => value.edges.pop(), /exact 132-edge inventory/u);
  expectFixtureViolation((value) => { value.edges[1] = clone(value.edges[0]); }, /duplicate edge|exact ordered edge/u);
  expectFixtureViolation((value) => { value.edges[1] = ["UNRECOGNIZED_NODE", value.edges[1][1]]; }, /unknown node/u);
  expectFixtureViolation((value) => { value.edges[1] = [value.edges[1][1], value.edges[1][1]]; }, /self edge/u);
  expectFixtureViolation((value) => {
    const index = value.edges.findIndex(([from, to]) =>
      from === "V2_FEATURE_PARITY" && to === "TERMINAL_B3_REVIEW_PACKET");
    value.edges[index] = ["CORE_CUSTODY_POLICY_ADAPTER", "V2_FEATURE_PARITY"];
  }, /cycle reaches/u);
  expectFixtureViolation((value) => { delete value.edges[2][1]; }, /dense undecorated JSON array/u);
});

test("inventory completeness is false for node, edge, scope, or artifact inconsistency", () => {
  const cases = [
    (value) => { value.nodes[4] = clone(value.nodes[3]); },
    (value) => { value.edges[1] = ["UNRECOGNIZED_NODE", value.edges[1][1]]; },
    (value) => { value.scope.contract = "ALTERED_STRUCTURAL_SCOPE"; },
    (value) => {
      node(value, "CORE_CUSTODY_POLICY_ADAPTER").contractArtifact = clone(
        node(value, "FACTION_ECONOMICS_FUNDING").contractArtifact,
      );
    },
  ];
  for (const mutate of cases) {
    const manifest = fixture();
    mutate(manifest);
    const result = fixtureResult(manifest);
    assert.equal(result.valid, false);
    assert.equal(result.dependencyInventoryComplete, false);
    assert.equal(result.dependencyGraphValid, false);
    assert.equal(result.dependencyReviewPacketComplete, false);
  }
});

test("DAG closure and status, evidence, blocker, and terminal contradictions fail closed", () => {
  expectFixtureViolation((value) => {
    Object.assign(node(value, "V2_FEATURE_PARITY"), clone(node(DRAFT, "V2_FEATURE_PARITY")));
  }, /complete child .* has BLOCKED prerequisite V2_FEATURE_PARITY/u);
  expectFixtureViolation((value) => {
    node(value, "CORE_CUSTODY_POLICY_ADAPTER").blocker = "Contradictory blocker retained after completion.";
  }, /complete packet requires null/u);
  expectFixtureViolation((value) => {
    const target = node(value, "CORE_CUSTODY_POLICY_ADAPTER");
    target.status = "BLOCKED";
    target.blocker = clone(node(DRAFT, target.id).blocker);
  }, /BLOCKED requires null/u);
  const blockedTerminal = clone(DRAFT);
  blockedTerminal.terminalPredicate.status = "STRUCTURAL_REVIEW_PACKET_COMPLETE";
  blockedTerminal.terminalPredicate.blocker = null;
  assert.match(
    validateReleaseDependencyGraphManifest(blockedTerminal).violations.join("\n"),
    /cannot complete while any required node is BLOCKED/u,
  );
  const falseManifestComplete = clone(DRAFT);
  falseManifestComplete.status = "STRUCTURAL_REVIEW_PACKET_COMPLETE";
  assert.match(
    validateReleaseDependencyGraphManifest(falseManifestComplete).violations.join("\n"),
    /cannot complete while a node or terminal predicate is BLOCKED/u,
  );
});

test("critical semantic blockers cannot be erased behind generic completion prose", () => {
  const manifest = clone(DRAFT);
  for (const id of [
    "CORE_CUSTODY_POLICY_ADAPTER",
    "FACTION_ECONOMICS_FUNDING",
    "CONFIG_GENESIS_PHASE_CODEC",
    "GENESIS_ALLOCATIONS_CONSERVATION",
    "COMBINED_STAKE_INGRESS_HOOK",
    "PRODUCTION_BINARY_REPRODUCIBILITY",
    "DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE",
    "LOCALIZATION_EVIDENCE",
    "MEDIA_MASTER_COMPLETENESS",
    "V2_LAUNCH_CEREMONY_BOUNDARY",
  ]) node(manifest, id).blocker = "This dependency still has material review work remaining.";
  const violations = validateReleaseDependencyGraphManifest(manifest).violations.join("\n");
  for (const id of [
    "CORE_CUSTODY_POLICY_ADAPTER",
    "FACTION_ECONOMICS_FUNDING",
    "CONFIG_GENESIS_PHASE_CODEC",
    "GENESIS_ALLOCATIONS_CONSERVATION",
    "COMBINED_STAKE_INGRESS_HOOK",
    "PRODUCTION_BINARY_REPRODUCIBILITY",
    "DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE",
    "LOCALIZATION_EVIDENCE",
    "MEDIA_MASTER_COMPLETENESS",
    "V2_LAUNCH_CEREMONY_BOUNDARY",
  ]) assert.match(violations, new RegExp(id, "u"));
});

test("artifact bindings reject traversal, absolute, command-like, swap, stale, and self-digest substitutions", () => {
  const manifest = clone(DRAFT);
  node(manifest, "LIVE_ESTATE_CANONICAL_MINT_DECISION").contractArtifact.path = "../package.json";
  node(manifest, "V2_FEATURE_PARITY").contractArtifact.path = "C:/Windows/System32/cmd.exe";
  node(manifest, "TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY").contractArtifact.path =
    "projects/star-ascent/site/docs/b3/SHIELDED_TRANSFERS.md;touch-pwned";
  node(manifest, "CORE_CUSTODY_POLICY_ADAPTER").contractArtifact = clone(
    node(DRAFT, "FACTION_ECONOMICS_FUNDING").contractArtifact,
  );
  node(manifest, "FACTION_ECONOMICS_FUNDING").contractArtifact.sha256 = "ab".repeat(32);
  manifest.graphDefinitionSha256 = createHash("sha256")
    .update(JSON.stringify(manifest))
    .digest("hex");
  const result = validateReleaseDependencyGraphManifest(manifest);
  assert.equal(result.dependencyReviewPacketComplete, false);
  assert.match(result.violations.join("\n"), /artifact path, digest, or reference-only scope drifted/u);
  assert.match(result.violations.join("\n"), /self-substituted graph definition/u);
  assert.equal(existsSync(join(SITE, "touch-pwned")), false);
  assert.match(VALIDATOR_SOURCE, /path is not in the immutable B3 artifact allowlist/u);
  assert.match(VALIDATOR_SOURCE, /symbolic links are forbidden/u);
  assert.doesNotMatch(VALIDATOR_SOURCE, /shell\s*:\s*true/u);
});

test("fixtures, valid booleans, V2 gates, parsed matrices, and partial proof shapes cannot promote production", () => {
  const relabeled = fixture();
  relabeled.profile = "PRODUCTION";
  for (const entry of relabeled.nodes) entry.completionEvidence.environment = "PRODUCTION";
  const relabeledResult = validateReleaseDependencyGraphManifest(relabeled, {
    allowTestFixture: true,
    evaluationUnixSeconds: "2001000000",
  });
  assert.equal(relabeledResult.productionDependencyReviewPacketComplete, false);
  assert.match(relabeledResult.violations.join("\n"), /immutable committed contract artifact SHA-256/u);
  assert.match(relabeledResult.violations.join("\n"), /scoped production completion predicate is false/u);
  assert.match(relabeledResult.violations.join("\n"), /ECONOMY_ALL_15_WRITE_ADAPTER/u);
  assert.match(relabeledResult.violations.join("\n"), /V2_FEATURE_PARITY/u);

  const localRelabel = fixture();
  localRelabel.profile = "LOCAL";
  assert.match(
    fixtureResult(localRelabel).violations.join("\n"),
    /expected PRODUCTION or TEST_FIXTURE/u,
  );

  const parsedButBlocked = validateReleaseDependencyGraphManifest(DRAFT);
  assert.equal(parsedButBlocked.valid, true);
  assert.equal(parsedButBlocked.productionDependencyReviewPacketComplete, false);
  const callerValid = clone(DRAFT);
  callerValid.valid = true;
  assert.match(validateReleaseDependencyGraphManifest(callerValid).violations.join("\n"), /expected exact keys/u);

  expectFixtureViolation((value) => {
    Object.assign(node(value, "DAILY_LAW_NATIVE_HOOK").completionEvidence, {
      productionLawArtifact: { byteLength: 141824, executedByThisTargetedRun: false },
    });
  }, /expected exact keys/u);
  expectFixtureViolation((value) => {
    Object.assign(node(value, "COMBINED_STAKE_INGRESS_HOOK").completionEvidence, {
      combinedDailyLawAndStakeIngressHookProven: false,
      productionLawArtifact: { byteLength: 154952, executedByThisTargetedRun: false },
    });
  }, /expected exact keys/u);
  expectFixtureViolation((value) => {
    node(value, "V2_LAUNCH_CEREMONY_BOUNDARY").completionPredicate =
      "LEGACY_ORIGINAL_SPL_LAUNCH_GATE";
  }, /expected V2_HOLD_AND_B3_SUPERSESSION_PACKET/u);
  expectFixtureViolation((value) => {
    node(value, "GENESIS_ALLOCATIONS_CONSERVATION").completionEvidence.destinations = null;
  }, /expected exact keys/u);
  expectFixtureViolation((value) => {
    node(value, "CORE_CUSTODY_POLICY_ADAPTER").completionPredicate =
      "PERMANENT_DELEGATE_AND_HIDDEN_CORE_WALLET_BROADENING";
  }, /SCOPED_CORE_CUSTODY/u);
  expectFixtureViolation((value) => {
    node(value, "FACTION_ECONOMICS_FUNDING").completionPredicate =
      "INFERRED_FACTION_ECONOMICS";
  }, /SCOPED_FACTION_ECONOMICS/u);
});

test("Privacy Vault, all 50 locales, and media remain REQUIRED with no N/A bypass", () => {
  assert.equal(DRAFT.applicabilityPolicy.privacyVaultRequired, true);
  assert.equal(DRAFT.applicabilityPolicy.requiredLocaleCount, 50);
  assert.equal(DRAFT.applicabilityPolicy.localizationRequired, true);
  assert.equal(DRAFT.applicabilityPolicy.mediaRequired, true);
  assert.equal(DRAFT.applicabilityPolicy.naDispositionAllowed, false);
  assert.equal(DRAFT.applicabilityPolicy.ownerCutAuthenticationSupported, false);
  assert.equal(node(DRAFT, "LOCALIZATION_EVIDENCE").contractArtifact, null);
  assert.equal(node(DRAFT, "MEDIA_MASTER_COMPLETENESS").contractArtifact, null);
  assert.match(node(DRAFT, "LOCALIZATION_EVIDENCE").blocker, /50 required locales.*native review/iu);
  assert.match(node(DRAFT, "MEDIA_MASTER_COMPLETENESS").blocker, /14 full masters are missing.*N\/A is forbidden/iu);

  const manifest = clone(DRAFT);
  manifest.applicabilityPolicy.requiredLocaleCount = 49;
  node(manifest, "LOCALIZATION_EVIDENCE").applicability = "OPTIONAL";
  node(manifest, "MEDIA_MASTER_COMPLETENESS").applicability = "N/A";
  node(manifest, "MEDIA_MASTER_COMPLETENESS").contractArtifact = clone(
    node(DRAFT, "V2_FEATURE_PARITY").contractArtifact,
  );
  const result = validateReleaseDependencyGraphManifest(manifest);
  assert.match(result.violations.join("\n"), /all 50 locales, and media must remain REQUIRED/u);
  assert.match(result.violations.join("\n"), /every v1 node is REQUIRED/u);
  assert.match(result.violations.join("\n"), /unresolved or dirty artifact must remain null/u);

  const relabeledReview = clone(DRAFT);
  node(relabeledReview, "LOCALIZATION_EVIDENCE").blocker =
    "All 50 required locales have only AI-generated review and remain required.";
  assert.match(
    validateReleaseDependencyGraphManifest(relabeledReview).violations.join("\n"),
    /must retain 50, native review, required blocker detail/u,
  );
});

test("strict canonical input rejects symbols, hidden keys, accessors, aliases, sparse arrays, cycles, and unsupported scalars", () => {
  const cases = [];
  const symbol = fixture();
  symbol[Symbol("extra")] = true;
  cases.push(symbol);
  const hidden = fixture();
  Object.defineProperty(hidden, "hidden", { enumerable: false, value: true });
  cases.push(hidden);
  const sparse = fixture();
  delete sparse.nodes[3];
  cases.push(sparse);
  const cycle = fixture();
  cycle.scope.doesNotCertify.push(cycle.scope);
  cases.push(cycle);
  const alias = fixture();
  alias.nodes[1].contractArtifact = alias.nodes[0].contractArtifact;
  cases.push(alias);
  const bigint = fixture();
  bigint.applicabilityPolicy.requiredLocaleCount = 50n;
  cases.push(bigint);
  const nonfinite = fixture();
  nonfinite.applicabilityPolicy.requiredLocaleCount = Number.NaN;
  cases.push(nonfinite);
  const loneSurrogate = fixture();
  loneSurrogate.nodes[0].blocker = "invalid-\ud800";
  cases.push(loneSurrogate);
  const customPrototype = fixture();
  Object.setPrototypeOf(customPrototype.nodes, Object.create(Array.prototype));
  cases.push(customPrototype);
  const primitiveNode = fixture();
  primitiveNode.nodes[4] = null;
  cases.push(primitiveNode);
  for (const malformed of cases) {
    let result;
    assert.doesNotThrow(() => { result = fixtureResult(malformed); });
    assert.equal(result.dependencyReviewPacketComplete, false);
    assert.notEqual(result.violations.length, 0);
  }

  const accessor = fixture();
  let reads = 0;
  Object.defineProperty(accessor, "profile", {
    enumerable: true,
    get() {
      reads += 1;
      throw new Error("PROFILE_GETTER_EXECUTED");
    },
  });
  let result;
  assert.doesNotThrow(() => { result = fixtureResult(accessor); });
  assert.equal(reads, 0);
  assert.equal(result.dependencyReviewPacketComplete, false);
  assert.match(result.violations.join("\n"), /data property/u);
});

test("raw JSON rejects decoded duplicate keys and immutable truth flags reject relabeling", () => {
  assert.throws(
    () => parseReleaseDependencyGraphJson('{"alpha":1,"\\u0061lpha":2}'),
    /duplicate JSON member/u,
  );
  for (const key of [
    "externalTruthVerified",
    "runtimeAuthenticationVerified",
    "providerEvidenceVerified",
    "rollbackProtectionVerified",
    "runtimeEnforcementVerified",
    "activationReady",
    "releaseAuthorizationVerified",
    "mainnetExecutionAuthorized",
  ]) expectFixtureViolation((value) => { value[key] = true; }, new RegExp(`${key}: must remain false`, "u"));
  expectFixtureViolation((value) => { value.mainnetStatus = "GO"; }, /must remain HOLD/u);
});

test("validator remains host-only, read-only, nonactivating, and free of runtime wiring", () => {
  assert.match(VALIDATOR_SOURCE, /execFileSync\("git", \["show"/u);
  assert.match(VALIDATOR_SOURCE, /spawnSync\("git", \["diff", "--quiet"/u);
  assert.doesNotMatch(VALIDATOR_SOURCE, /@solana|web3|fetch\(|https\.request|http\.request/u);
  assert.doesNotMatch(VALIDATOR_SOURCE, /iat_b3_reference|programs[\\/]iat_b3/u);
  assert.doesNotMatch(VALIDATOR_SOURCE, /git", \["(?:add|commit|push|checkout|reset)|npm", \["(?:publish|deploy)/u);
  assert.equal(DRAFT.scope.doesNotCertify.includes("TRANSACTION_SIGNING_DEPLOYMENT_OR_EXECUTION_AUTHORITY"), true);
  assert.equal(DRAFT.artifactBindingPolicy.arbitraryValidatorExecutionAllowed, false);
  assert.equal(DRAFT.artifactBindingPolicy.networkReadsAllowed, false);
});

test("CLI reports canonical BLOCKED, requires explicit fixture authority, and enforces completion on demand", () => {
  const blocked = spawnSync(process.execPath, [VALIDATOR_PATH, MANIFEST_PATH], {
    encoding: "utf8",
  });
  assert.equal(blocked.status, 0, blocked.stderr);
  assert.equal(JSON.parse(blocked.stdout).dependencyReviewPacketComplete, false);

  const required = spawnSync(process.execPath, [
    VALIDATOR_PATH,
    MANIFEST_PATH,
    "--require-review-packet-complete",
  ], { encoding: "utf8" });
  assert.equal(required.status, 2, required.stderr);

  const directory = mkdtempSync(join(tmpdir(), "iat-b3-dependency-graph-"));
  try {
    const fixturePath = join(directory, "fixture.json");
    writeFileSync(fixturePath, `${JSON.stringify(fixture())}\n`, "utf8");
    const denied = spawnSync(process.execPath, [VALIDATOR_PATH, fixturePath], {
      encoding: "utf8",
    });
    assert.equal(denied.status, 2, denied.stderr);
    const accepted = spawnSync(process.execPath, [
      VALIDATOR_PATH,
      fixturePath,
      "--fixture",
      "--evaluation-unix-seconds",
      "2001000000",
      "--require-review-packet-complete",
    ], { encoding: "utf8" });
    assert.equal(accepted.status, 0, accepted.stderr);
    const result = JSON.parse(accepted.stdout);
    assert.equal(result.dependencyReviewPacketComplete, true);
    assert.equal(result.productionDependencyReviewPacketComplete, false);
    assert.equal(result.releaseAuthorizationVerified, false);
    assert.equal(result.mainnetStatus, "HOLD");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

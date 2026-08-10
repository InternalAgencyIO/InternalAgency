import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { canonicalizeRfc8785 } from "./iat-v2-canonical-json.mjs";
import { validateExternalCheckpointProviderReadinessManifest } from "./validate-iat-b3-external-checkpoint-provider-readiness.mjs";
import { validateIdentityFreezeManifest } from "./validate-iat-b3-identity-freeze.mjs";
import { validateXSocialEvidenceProviderReadinessManifest } from "./validate-iat-b3-x-social-evidence-provider-readiness.mjs";

export const RELEASE_DEPENDENCY_GRAPH_SCHEMA = "iat-b3-release-dependency-graph/v1";
export const RELEASE_DEPENDENCY_GRAPH_STATUS = "NONACTIVATING_STRUCTURAL_DEPENDENCY_REVIEW_PACKET";
export const RELEASE_DEPENDENCY_GRAPH_MAINNET_STATUS = "HOLD";

const SCRIPT_ROOT = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(SCRIPT_ROOT, "..");
const REPOSITORY_ROOT = resolve(SCRIPT_ROOT, "../../../..");
const DEFAULT_MANIFEST_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-release-dependency-graph.v1.json",
);

const SCOPE = Object.freeze({
  contract: RELEASE_DEPENDENCY_GRAPH_STATUS,
  doesNotCertify: Object.freeze([
    "PRODUCTION_OR_PROVIDER_TRUTH",
    "AUTHENTICATION_OR_AUTHORIZATION",
    "RUNTIME_ENFORCEMENT_OR_ATOMICITY",
    "ROLLBACK_PROTECTION",
    "OWNER_CUT_AUTHENTICITY",
    "RELEASE_OR_MAINNET_READINESS",
    "TRANSACTION_SIGNING_DEPLOYMENT_OR_EXECUTION_AUTHORITY",
  ]),
});

export const RELEASE_DEPENDENCY_APPLICABILITY_POLICY = Object.freeze({
  allNodesRequired: true,
  privacyVaultRequired: true,
  requiredLocaleCount: 50,
  localizationRequired: true,
  mediaRequired: true,
  inactiveFutureMediaDisposition: "RETAINED_INACTIVE_REQUIRED",
  radianceStandaloneDisposition: "SEPARATE_PRODUCT_BLOCKER_REQUIRED",
  naDispositionAllowed: false,
  ownerCutAuthenticationSupported: false,
});

export const RELEASE_DEPENDENCY_ARTIFACT_POLICY = Object.freeze({
  stableCommittedB3ArtifactsOnly: true,
  dirtyOrUnresolvedArtifactDisposition: "NULL_AND_BLOCKED",
  arbitraryValidatorExecutionAllowed: false,
  networkReadsAllowed: false,
});

const artifact = (path, sha256) => Object.freeze({
  path,
  sha256,
  bindingScope: "REFERENCE_CONTRACT_ONLY",
});

const ARTIFACTS = Object.freeze({
  estate: artifact(
    "projects/star-ascent/site/docs/b3/ESTATE_BASELINE.md",
    "dbe8dca34e9423b7daff2bb1e47cbf34b5318cfba6bf31300a053917833f5e66",
  ),
  parity: artifact(
    "projects/star-ascent/site/docs/b3/V2_FEATURE_PARITY.md",
    "360a8511d5f2cc92a3a3e78509134a6c7096322ab88fca1be5e67f6fdf8fce26",
  ),
  shielded: artifact(
    "projects/star-ascent/site/docs/b3/SHIELDED_TRANSFERS.md",
    "c2540c628e37eabc720ceeee6686141e06b6725a8139b343cef1f2f43d315c68",
  ),
  core: artifact(
    "projects/star-ascent/site/docs/b3/CORE_TEAM_CAP.md",
    "cf29a6cdda6c2e5024e0c003566958f7a2711d6379be1d4f33aac902c2405014",
  ),
  factions: artifact(
    "projects/star-ascent/site/docs/b3/FACTIONS.md",
    "1bc82c007b235da3073daa7fc418665a9f5d8bd01923974ff77ad41dec933b3c",
  ),
  economyMatrix: artifact(
    "projects/star-ascent/site/docs/b3/iat-b3-economic-write-gates.v1.json",
    "dfca9a6ba265dda50154f2dcdb0490f46624d5745741ee459c141cf82fbc10ae",
  ),
  identity: artifact(
    "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json",
    "613e864effa7ac6d9c94b81b9fb4dbb42756dfe8065f313caefc7355bbc89c62",
  ),
  law: artifact(
    "projects/star-ascent/site/docs/b3/LAW_ADAPTER.md",
    "5f37529cbc12c0f171e026d08e37d465ea639bd16de9eaa3de009b8d5c081df8",
  ),
  localRehearsal: artifact(
    "projects/star-ascent/site/docs/b3/LOCAL_VALIDATOR_REHEARSAL.md",
    "463daa6afe5641087f477c755853e720a027aed73aaf3dfc2c3c9f9b506afca4",
  ),
  waterfall: artifact(
    "projects/star-ascent/site/docs/b3/iat-b3-reward-capacity-waterfall.v1.json",
    "423fc268c184271023af0ca0664b194e9570149e4c61a916c27bad5d9bb17858",
  ),
  cas: artifact(
    "projects/star-ascent/site/docs/b3/REWARD_PERSISTENCE_CAS_REFERENCE.md",
    "f9a08da6e337afba1acd0eb439ebc193b8ae93625c425ad71ab82e89e72eda9a",
  ),
  checkpointProvider: artifact(
    "projects/star-ascent/site/docs/b3/iat-b3-external-checkpoint-provider-readiness.v1.json",
    "f36ed9746c756c16d5b517e3c26c5da592fcce01ee79facfa49141bc6753872d",
  ),
  xProvider: artifact(
    "projects/star-ascent/site/docs/b3/iat-b3-x-social-evidence-provider-readiness.v1.json",
    "4f1ef74e606be4436590e495492866d4b553bff6bed60d489ff425341168b87b",
  ),
  cost: artifact(
    "projects/star-ascent/site/docs/b3/COST_FEASIBILITY.md",
    "44684ef17a173e01eb36e9e7a0de3297b62c5f7b6aa1035f0d1995641ba3c289",
  ),
  devnet: artifact(
    "projects/star-ascent/site/docs/b3/DEVNET_REHEARSAL.md",
    "0dc182a9bb4d861356767aeb277b7e74c3b5a394af531180d3782a935658c110",
  ),
  mainnetPath: artifact(
    "projects/star-ascent/site/docs/b3/MAINNET_PATH.md",
    "e6c8bf20f713fb5c8fea7c5fadab09bea7d3c4cf8250c17d733a26c571600763",
  ),
});

const spec = (id, dependencies, completionPredicate, contractArtifact = null) => Object.freeze({
  id,
  dependencies: Object.freeze(dependencies),
  completionPredicate,
  contractArtifact,
});

const RELEASE_DEPENDENCY_NONTERMINAL_NODE_SPECS = Object.freeze([
  spec("LIVE_ESTATE_CANONICAL_MINT_DECISION", [], "SIGNED_LIVE_ESTATE_CANONICAL_MINT_DECISION_PACKET", ARTIFACTS.estate),
  spec("V2_FEATURE_PARITY", [], "ZERO_UNAUTHORIZED_CUT_V2_PARITY_PACKET", ARTIFACTS.parity),
  spec("TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", [], "EXACT_TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY_PACKET", ARTIFACTS.shielded),
  spec("CORE_CUSTODY_POLICY_ADAPTER", ["V2_FEATURE_PARITY"], "SCOPED_CORE_CUSTODY_POLICY_AND_NATIVE_ADAPTER_PACKET", ARTIFACTS.core),
  spec("FACTION_ECONOMICS_FUNDING", ["V2_FEATURE_PARITY"], "SCOPED_FACTION_ECONOMICS_FUNDING_PACKET", ARTIFACTS.factions),
  spec("CONFIG_GENESIS_PHASE_CODEC", ["V2_FEATURE_PARITY", "CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING"], "NONVACUOUS_GENESIS_BOOTSTRAP_PHASE_AND_CONFIG_CODEC_PACKET", ARTIFACTS.economyMatrix),
  spec("GENESIS_ALLOCATIONS_CONSERVATION", ["LIVE_ESTATE_CANONICAL_MINT_DECISION", "V2_FEATURE_PARITY", "CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING", "CONFIG_GENESIS_PHASE_CODEC"], "EXACT_GENESIS_ALLOCATION_CONSERVATION_PACKET"),
  spec("PRODUCTION_IDENTITY_INPUT_FREEZE", ["LIVE_ESTATE_CANONICAL_MINT_DECISION", "TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING", "CONFIG_GENESIS_PHASE_CODEC", "GENESIS_ALLOCATIONS_CONSERVATION"], "PRODUCTION_IDENTITY_INPUT_FREEZE_SCOPED_OUTPUT", ARTIFACTS.identity),
  spec("DAILY_LAW_NATIVE_HOOK", ["TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "PRODUCTION_IDENTITY_INPUT_FREEZE"], "PRODUCTION_DAILY_LAW_NATIVE_HOOK_PACKET", ARTIFACTS.law),
  spec("COMBINED_STAKE_INGRESS_HOOK", ["TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "CONFIG_GENESIS_PHASE_CODEC", "PRODUCTION_IDENTITY_INPUT_FREEZE", "DAILY_LAW_NATIVE_HOOK"], "SAME_ARTIFACT_DAILY_LAW_AND_STAKE_INGRESS_PACKET", ARTIFACTS.localRehearsal),
  spec("REWARD_WATERFALL_PROOFS", ["V2_FEATURE_PARITY", "CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING"], "REWARD_WATERFALL_PROOF_CONTRACT_PACKET", ARTIFACTS.waterfall),
  spec("DURABLE_REWARD_CAS", ["DAILY_LAW_NATIVE_HOOK", "REWARD_WATERFALL_PROOFS"], "DURABLE_CAS_AND_ROLLBACK_BOUNDARY_PACKET", ARTIFACTS.cas),
  spec("EXTERNAL_CHECKPOINT_PROVIDER", ["PRODUCTION_IDENTITY_INPUT_FREEZE", "DURABLE_REWARD_CAS"], "EXTERNAL_CHECKPOINT_PRODUCTION_REVIEW_PACKET_SCOPED_OUTPUT", ARTIFACTS.checkpointProvider),
  spec("X_SOCIAL_EVIDENCE_PROVIDER", ["PRODUCTION_IDENTITY_INPUT_FREEZE", "REWARD_WATERFALL_PROOFS", "DURABLE_REWARD_CAS", "EXTERNAL_CHECKPOINT_PROVIDER"], "X_SOCIAL_PRODUCTION_REVIEW_PACKET_SCOPED_OUTPUT", ARTIFACTS.xProvider),
  spec("ECONOMY_ALL_15_WRITE_ADAPTER", ["V2_FEATURE_PARITY", "TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING", "CONFIG_GENESIS_PHASE_CODEC", "GENESIS_ALLOCATIONS_CONSERVATION", "PRODUCTION_IDENTITY_INPUT_FREEZE", "DAILY_LAW_NATIVE_HOOK", "COMBINED_STAKE_INGRESS_HOOK", "REWARD_WATERFALL_PROOFS"], "ALL_15_ECONOMY_WRITE_ADAPTER_SCOPED_OUTPUT", ARTIFACTS.economyMatrix),
  spec("REWARD_LOCAL_WRITE_CONSUMER_GATING", ["PRODUCTION_IDENTITY_INPUT_FREEZE", "DAILY_LAW_NATIVE_HOOK", "REWARD_WATERFALL_PROOFS", "DURABLE_REWARD_CAS", "EXTERNAL_CHECKPOINT_PROVIDER", "X_SOCIAL_EVIDENCE_PROVIDER", "ECONOMY_ALL_15_WRITE_ADAPTER"], "REWARD_LOCAL_WRITE_AND_EVERY_CONSUMER_GATE_PACKET"),
  spec("PRIVACY_VAULT_CLIENT", ["V2_FEATURE_PARITY", "TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "PRODUCTION_IDENTITY_INPUT_FREEZE", "DAILY_LAW_NATIVE_HOOK"], "PRIVACY_VAULT_FULL_LIFECYCLE_REVIEW_PACKET", ARTIFACTS.shielded),
  spec("DEPENDENCY_SECURITY_REMEDIATION", ["V2_FEATURE_PARITY"], "ZERO_UNACCEPTED_DEPENDENCY_FINDINGS_PACKET"),
  spec("PRODUCTION_BINARY_REPRODUCIBILITY", ["TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "PRODUCTION_IDENTITY_INPUT_FREEZE", "DAILY_LAW_NATIVE_HOOK", "COMBINED_STAKE_INGRESS_HOOK", "ECONOMY_ALL_15_WRITE_ADAPTER", "REWARD_LOCAL_WRITE_CONSUMER_GATING", "PRIVACY_VAULT_CLIENT", "DEPENDENCY_SECURITY_REMEDIATION"], "REPRODUCIBLE_FINAL_BINARIES_PACKET", ARTIFACTS.cost),
  spec("ADVERSARIAL_DEVNET_REHEARSAL", ["TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "PRODUCTION_BINARY_REPRODUCIBILITY"], "FULL_SYSTEM_ADVERSARIAL_DEVNET_PACKET", ARTIFACTS.devnet),
  spec("DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE", ["LIVE_ESTATE_CANONICAL_MINT_DECISION", "PRODUCTION_IDENTITY_INPUT_FREEZE", "PRODUCTION_BINARY_REPRODUCIBILITY", "ADVERSARIAL_DEVNET_REHEARSAL"], "DEPLOYED_BYTES_IDENTITIES_AND_AUTHORITY_SEAL_PACKET"),
  spec("B3_COST_CEREMONY_FUNDING", ["GENESIS_ALLOCATIONS_CONSERVATION", "PRODUCTION_BINARY_REPRODUCIBILITY"], "B3_COST_AND_CEREMONY_FUNDING_PACKET", ARTIFACTS.cost),
  spec("LOCALIZATION_EVIDENCE", ["V2_FEATURE_PARITY"], "ALL_50_LOCALES_ACCEPTED_NATIVE_REVIEW_PACKET"),
  spec("MEDIA_MASTER_COMPLETENESS", ["V2_FEATURE_PARITY"], "ALL_REQUIRED_MEDIA_MASTERS_PACKET"),
  spec("V2_LAUNCH_CEREMONY_BOUNDARY", ["LIVE_ESTATE_CANONICAL_MINT_DECISION", "V2_FEATURE_PARITY"], "V2_HOLD_AND_B3_SUPERSESSION_PACKET"),
  spec("RELEASE_SURFACE_PUBLIC_CLAIMS", ["LIVE_ESTATE_CANONICAL_MINT_DECISION", "V2_FEATURE_PARITY", "PRODUCTION_IDENTITY_INPUT_FREEZE", "DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE", "LOCALIZATION_EVIDENCE", "MEDIA_MASTER_COMPLETENESS", "V2_LAUNCH_CEREMONY_BOUNDARY"], "SOURCE_BOUND_RELEASE_SURFACE_CLAIMS_PACKET"),
  spec("INDEPENDENT_SECURITY_ECONOMIC_PRIVACY_LEGAL_REVIEW", ["TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY", "CORE_CUSTODY_POLICY_ADAPTER", "FACTION_ECONOMICS_FUNDING", "CONFIG_GENESIS_PHASE_CODEC", "GENESIS_ALLOCATIONS_CONSERVATION", "PRODUCTION_IDENTITY_INPUT_FREEZE", "DAILY_LAW_NATIVE_HOOK", "COMBINED_STAKE_INGRESS_HOOK", "REWARD_WATERFALL_PROOFS", "DURABLE_REWARD_CAS", "EXTERNAL_CHECKPOINT_PROVIDER", "X_SOCIAL_EVIDENCE_PROVIDER", "ECONOMY_ALL_15_WRITE_ADAPTER", "REWARD_LOCAL_WRITE_CONSUMER_GATING", "PRIVACY_VAULT_CLIENT", "DEPENDENCY_SECURITY_REMEDIATION", "PRODUCTION_BINARY_REPRODUCIBILITY", "ADVERSARIAL_DEVNET_REHEARSAL", "DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE", "B3_COST_CEREMONY_FUNDING", "LOCALIZATION_EVIDENCE", "MEDIA_MASTER_COMPLETENESS", "RELEASE_SURFACE_PUBLIC_CLAIMS"], "INDEPENDENT_MULTI_DOMAIN_REVIEW_PACKET", ARTIFACTS.mainnetPath),
]);

const TERMINAL_ID = "TERMINAL_B3_REVIEW_PACKET";
const TERMINAL_PREREQUISITES = Object.freeze(
  RELEASE_DEPENDENCY_NONTERMINAL_NODE_SPECS.map(({ id }) => id),
);
export const RELEASE_DEPENDENCY_NODE_SPECS = Object.freeze([
  ...RELEASE_DEPENDENCY_NONTERMINAL_NODE_SPECS,
  spec(TERMINAL_ID, TERMINAL_PREREQUISITES, "ALL_27_PREREQUISITES_STRUCTURALLY_COMPLETE"),
]);
export const RELEASE_DEPENDENCY_NODE_IDS = Object.freeze(
  RELEASE_DEPENDENCY_NODE_SPECS.map(({ id }) => id),
);
const NODE_SPEC_BY_ID = new Map(RELEASE_DEPENDENCY_NODE_SPECS.map((entry) => [entry.id, entry]));

export const RELEASE_DEPENDENCY_EDGES = Object.freeze(
  RELEASE_DEPENDENCY_NODE_IDS.flatMap((dependent) => {
    const dependencies = NODE_SPEC_BY_ID.get(dependent).dependencies;
    return dependencies.map((prerequisite) => Object.freeze([prerequisite, dependent]));
  }),
);

if (RELEASE_DEPENDENCY_NODE_IDS.length !== 28 || RELEASE_DEPENDENCY_EDGES.length !== 132) {
  throw new Error("IAT B3 release dependency graph constant count drift");
}

const sha256Bytes = (value) => createHash("sha256").update(value).digest("hex");
const sha256Canonical = (value) => sha256Bytes(canonicalizeRfc8785(value));

const graphDefinition = () => ({
  domain: "IAT_B3_RELEASE_DEPENDENCY_GRAPH_DEFINITION_V1",
  schema: RELEASE_DEPENDENCY_GRAPH_SCHEMA,
  scope: SCOPE,
  applicabilityPolicy: RELEASE_DEPENDENCY_APPLICABILITY_POLICY,
  artifactBindingPolicy: RELEASE_DEPENDENCY_ARTIFACT_POLICY,
  nodes: RELEASE_DEPENDENCY_NODE_IDS.map((id) => {
    const node = NODE_SPEC_BY_ID.get(id);
    return {
      id,
      dependencies: node.dependencies,
      completionPredicate: node.completionPredicate,
      contractArtifact: node.contractArtifact,
    };
  }),
  edges: RELEASE_DEPENDENCY_EDGES,
});

export const RELEASE_DEPENDENCY_GRAPH_SHA256 = sha256Canonical(graphDefinition());

const TOP_LEVEL_KEYS = Object.freeze([
  "$schema",
  "schema",
  "profile",
  "status",
  "scope",
  "applicabilityPolicy",
  "artifactBindingPolicy",
  "graphDefinitionSha256",
  "nodes",
  "edges",
  "terminalPredicate",
  "externalTruthVerified",
  "runtimeAuthenticationVerified",
  "providerEvidenceVerified",
  "rollbackProtectionVerified",
  "runtimeEnforcementVerified",
  "activationReady",
  "releaseAuthorizationVerified",
  "mainnetExecutionAuthorized",
  "mainnetStatus",
]);
const NODE_KEYS = Object.freeze([
  "id",
  "applicability",
  "status",
  "completionPredicate",
  "contractArtifact",
  "completionEvidence",
  "blocker",
]);
const ARTIFACT_KEYS = Object.freeze(["path", "sha256", "bindingScope"]);
const EVIDENCE_KEYS = Object.freeze([
  "schema",
  "nodeId",
  "predicate",
  "subjectSha256",
  "artifactSha256",
  "environment",
]);
const TERMINAL_KEYS = Object.freeze(["status", "requiredNodeIds", "blocker"]);
const FALSE_FLAG_KEYS = Object.freeze([
  "externalTruthVerified",
  "runtimeAuthenticationVerified",
  "providerEvidenceVerified",
  "rollbackProtectionVerified",
  "runtimeEnforcementVerified",
  "activationReady",
  "releaseAuthorizationVerified",
  "mainnetExecutionAuthorized",
]);
const PLACEHOLDER = /(?:placeholder|example|sample|dummy|fake|mock|synthetic|todo|tbd|unknown|replace[-_ ]?me)/iu;
const HEX_32 = /^[0-9a-f]{64}$/u;

const CANONICAL_BLOCKERS = Object.freeze({
  LIVE_ESTATE_CANONICAL_MINT_DECISION: "Signed canonical mint decision for every live Estate remains unresolved.",
  V2_FEATURE_PARITY: "Retained V2 feature parity and explicit supersession evidence remain incomplete.",
  TOKEN_2022_CONFIDENTIAL_HOST_COMPATIBILITY: "Exact Token-2022 confidential-transfer host compatibility evidence remains incomplete.",
  CORE_CUSTODY_POLICY_ADAPTER: "Core custody boundaries, native adapter behavior, and owner acceptance remain unresolved.",
  FACTION_ECONOMICS_FUNDING: "Faction scoring, Sybil controls, and weekly funding evidence remain unresolved.",
  CONFIG_GENESIS_PHASE_CODEC: "Genesis preactivation, vacuous-cap prevention, finalize, and activate phase semantics remain unresolved.",
  GENESIS_ALLOCATIONS_CONSERVATION: "Exact allocation destinations and end-to-end Genesis conservation evidence remain unresolved.",
  PRODUCTION_IDENTITY_INPUT_FREEZE: "Production identity inputs remain unfrozen and cannot authorize deployed identities.",
  DAILY_LAW_NATIVE_HOOK: "Production Daily Law native-hook bytes and fail-closed execution evidence remain unresolved.",
  COMBINED_STAKE_INGRESS_HOOK: "Daily Law and stake ingress are not combined in the same production artifact.",
  REWARD_WATERFALL_PROOFS: "Reward waterfall proof coverage remains structural and nonactivating.",
  DURABLE_REWARD_CAS: "Durable reward CAS lacks externally verified rollback protection and activation authority.",
  EXTERNAL_CHECKPOINT_PROVIDER: "External checkpoint provider review packet remains structurally blocked and unauthenticated.",
  X_SOCIAL_EVIDENCE_PROVIDER: "X social evidence provider review packet remains structurally blocked and unauthenticated.",
  ECONOMY_ALL_15_WRITE_ADAPTER: "All 15 economy writes do not yet have production native adapter completion evidence.",
  REWARD_LOCAL_WRITE_CONSUMER_GATING: "Unanchored local reward writes and every downstream consumer are not yet gated.",
  PRIVACY_VAULT_CLIENT: "Required Privacy Vault client lifecycle and native integration evidence remain incomplete.",
  DEPENDENCY_SECURITY_REMEDIATION: "Dependency security findings lack accepted remediation and independent closure evidence.",
  PRODUCTION_BINARY_REPRODUCIBILITY: "The 154,952-byte local candidate is not production; reproducible final binaries remain unresolved.",
  ADVERSARIAL_DEVNET_REHEARSAL: "Full-system adversarial Devnet rehearsal against final binaries remains incomplete.",
  DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE: "Deployed bytes and authority seal evidence remain absent because there is no Mainnet deployment.",
  B3_COST_CEREMONY_FUNDING: "B3 cost model, ceremony funding, and accountable source evidence remain unresolved.",
  LOCALIZATION_EVIDENCE: "All 50 required locales lack complete native review and immutable acceptance evidence.",
  MEDIA_MASTER_COMPLETENESS: "All media are required; 14 full masters are missing and N/A is forbidden.",
  V2_LAUNCH_CEREMONY_BOUNDARY: "V2 remains HOLD; B3 supersession is unresolved and Original SPL cannot authorize launch.",
  RELEASE_SURFACE_PUBLIC_CLAIMS: "Public release claims cannot be enabled before identity, localization, media, and boundary closure.",
  INDEPENDENT_SECURITY_ECONOMIC_PRIVACY_LEGAL_REVIEW: "Independent security, economic, privacy, and legal review remains incomplete.",
  TERMINAL_B3_REVIEW_PACKET: "One or more required B3 dependency review packets remain blocked.",
});

function hasLoneSurrogate(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return true;
  }
  return false;
}

function canonicalJsonTree(value, path, violations, ancestors = new Set(), observed = new Set()) {
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string") {
    if (hasLoneSurrogate(value)) violations.push(`${path}: lone Unicode surrogate is forbidden`);
    return !hasLoneSurrogate(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) violations.push(`${path}: expected a finite safe JSON integer`);
    return Number.isSafeInteger(value);
  }
  if (typeof value !== "object") {
    violations.push(`${path}: expected canonical JSON data`);
    return false;
  }
  if (ancestors.has(value)) {
    violations.push(`${path}: contains a cycle`);
    return false;
  }
  if (observed.has(value)) {
    violations.push(`${path}: shared object aliases are forbidden`);
    return false;
  }
  ancestors.add(value);
  observed.add(value);
  let valid = true;
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      violations.push(`${path}: expected the canonical Array prototype`);
      valid = false;
    }
    const expectedKeys = [...Array.from({ length: value.length }, (_, index) => String(index)), "length"];
    const actualKeys = Reflect.ownKeys(value);
    if (actualKeys.length !== expectedKeys.length
      || actualKeys.some((key, index) => key !== expectedKeys[index])) {
      violations.push(`${path}: expected a dense undecorated JSON array`);
      valid = false;
    }
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        violations.push(`${path}[${index}]: expected an enumerable own data property`);
        valid = false;
      } else {
        valid = canonicalJsonTree(
          descriptor.value,
          `${path}[${index}]`,
          violations,
          ancestors,
          observed,
        ) && valid;
      }
    }
  } else {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      violations.push(`${path}: expected the canonical Object prototype`);
      valid = false;
    }
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        violations.push(`${path}: symbol properties are forbidden`);
        valid = false;
        continue;
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true) {
        violations.push(`${path}.${key}: expected an enumerable own data property`);
        valid = false;
      } else {
        valid = canonicalJsonTree(
          descriptor.value,
          `${path}.${key}`,
          violations,
          ancestors,
          observed,
        ) && valid;
      }
    }
  }
  ancestors.delete(value);
  return valid;
}

function exactKeys(value, expected, path, violations) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    violations.push(`${path}: expected an object`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const canonical = [...expected].sort();
  if (actual.length !== canonical.length
    || actual.some((key, index) => key !== canonical[index])) {
    violations.push(`${path}: expected exact keys ${canonical.join(",")}`);
    return false;
  }
  return true;
}

function exactJson(left, right) {
  return canonicalizeRfc8785(left) === canonicalizeRfc8785(right);
}

function canonicalHex(value) {
  return typeof value === "string"
    && HEX_32.test(value)
    && !/^([0-9a-f])\1{63}$/u.test(value);
}

function nodeSubjectSha256(node) {
  const specForNode = NODE_SPEC_BY_ID.get(node.id);
  if (!specForNode) return null;
  return sha256Canonical({
    domain: "IAT_B3_RELEASE_DEPENDENCY_NODE_SUBJECT_V1",
    nodeId: node.id,
    applicability: node.applicability,
    completionPredicate: node.completionPredicate,
    dependencies: specForNode.dependencies,
    contractArtifact: node.contractArtifact,
  });
}

const fixtureArtifactSha256 = (nodeId) => sha256Canonical({
  domain: "IAT_B3_RELEASE_DEPENDENCY_FIXTURE_EVIDENCE_V1",
  nodeId,
});

function expectedFixtureEvidence(node) {
  return {
    schema: "iat-b3-release-dependency-node-evidence/v1",
    nodeId: node.id,
    predicate: node.completionPredicate,
    subjectSha256: nodeSubjectSha256(node),
    artifactSha256: fixtureArtifactSha256(node.id),
    environment: "TEST_FIXTURE",
  };
}

function readCommittedArtifact(path, expectedSha256, violations) {
  if (isAbsolute(path) || path.includes("\\") || path.split("/").includes("..")) {
    violations.push(`artifact ${path}: absolute, backslash, and traversal paths are forbidden`);
    return null;
  }
  const allowed = [...new Set(RELEASE_DEPENDENCY_NODE_SPECS
    .map(({ contractArtifact }) => contractArtifact?.path)
    .filter(Boolean))];
  if (!allowed.includes(path)) {
    violations.push(`artifact ${path}: path is not in the immutable B3 artifact allowlist`);
    return null;
  }
  const absolutePath = resolve(REPOSITORY_ROOT, path);
  try {
    if (lstatSync(absolutePath).isSymbolicLink()) {
      violations.push(`artifact ${path}: symbolic links are forbidden`);
      return null;
    }
  } catch (error) {
    violations.push(`artifact ${path}: cannot inspect committed artifact (${error.message})`);
    return null;
  }
  const clean = spawnSync("git", ["diff", "--quiet", "HEAD", "--", path], {
    cwd: REPOSITORY_ROOT,
    windowsHide: true,
  });
  if (clean.status !== 0) {
    violations.push(`artifact ${path}: stable binding refuses dirty or staged content`);
    return null;
  }
  try {
    const bytes = execFileSync("git", ["show", `HEAD:${path}`], {
      cwd: REPOSITORY_ROOT,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    });
    const actualSha256 = sha256Bytes(bytes);
    if (actualSha256 !== expectedSha256) {
      violations.push(`artifact ${path}: committed SHA-256 drifted`);
      return null;
    }
    return bytes;
  } catch (error) {
    violations.push(`artifact ${path}: cannot read exact HEAD bytes (${error.message})`);
    return null;
  }
}

function stableArtifactJson(nodeId, bytesByPath, violations) {
  const contractArtifact = NODE_SPEC_BY_ID.get(nodeId)?.contractArtifact;
  if (!contractArtifact) return null;
  const bytes = bytesByPath.get(contractArtifact.path);
  if (!bytes) return null;
  try {
    return parseReleaseDependencyGraphJson(bytes.toString("utf8"), contractArtifact.path);
  } catch (error) {
    violations.push(`${contractArtifact.path}: invalid strict JSON (${error.message})`);
    return null;
  }
}

function scopedProductionPredicateStates(bytesByPath, violations, evaluationUnixSeconds) {
  const states = new Map(RELEASE_DEPENDENCY_NODE_IDS.map((id) => [id, false]));

  const identity = stableArtifactJson("PRODUCTION_IDENTITY_INPUT_FREEZE", bytesByPath, violations);
  if (identity) {
    try {
      const result = validateIdentityFreezeManifest(identity);
      states.set("PRODUCTION_IDENTITY_INPUT_FREEZE", result.productionIdentityReady === true);
    } catch (error) {
      violations.push(`PRODUCTION_IDENTITY_INPUT_FREEZE: scoped validator failed closed (${error.message})`);
    }
  }

  const checkpoint = stableArtifactJson("EXTERNAL_CHECKPOINT_PROVIDER", bytesByPath, violations);
  if (checkpoint) {
    try {
      const result = validateExternalCheckpointProviderReadinessManifest(checkpoint, {
        evaluationUnixSeconds,
      });
      states.set("EXTERNAL_CHECKPOINT_PROVIDER", result.productionReviewPacketComplete === true);
    } catch (error) {
      violations.push(`EXTERNAL_CHECKPOINT_PROVIDER: scoped validator failed closed (${error.message})`);
    }
  }

  const xEvidence = stableArtifactJson("X_SOCIAL_EVIDENCE_PROVIDER", bytesByPath, violations);
  if (xEvidence) {
    try {
      const result = validateXSocialEvidenceProviderReadinessManifest(xEvidence, {
        evaluationUnixSeconds,
      });
      states.set(
        "X_SOCIAL_EVIDENCE_PROVIDER",
        result.productionXSocialEvidenceReviewPacketComplete === true,
      );
    } catch (error) {
      violations.push(`X_SOCIAL_EVIDENCE_PROVIDER: scoped validator failed closed (${error.message})`);
    }
  }

  const matrix = stableArtifactJson("ECONOMY_ALL_15_WRITE_ADAPTER", bytesByPath, violations);
  if (matrix) {
    const handlers = Array.isArray(matrix.handlers) ? matrix.handlers : [];
    const complete = matrix.schema === "iat-b3-economic-write-gate-matrix/v1"
      && handlers.length === 15
      && handlers.every((handler) => handler.handlerComplete === true)
      && handlers.every((handler) => handler.publicExposure === "ENABLED_AFTER_ALL_15_PASS")
      && matrix.deploymentExposure === "ENABLED_AFTER_ALL_15_PASS"
      && matrix.nativeCodecPreparation?.complete === true
      && !String(matrix.nativeCodecPreparation?.configCodecStatus ?? "").startsWith("BLOCKED_")
      && handlers.every((handler) => !String(handler.parity ?? "").startsWith("BLOCKED_"));
    states.set("ECONOMY_ALL_15_WRITE_ADAPTER", complete);
  }

  return states;
}

function resultSurface({ profile, inventoryComplete, graphValid, packetComplete, blockers, violations }) {
  return {
    valid: violations.length === 0,
    profile,
    dependencyInventoryComplete: inventoryComplete,
    dependencyGraphValid: graphValid,
    dependencyReviewPacketComplete: packetComplete,
    productionDependencyReviewPacketComplete: packetComplete && profile === "PRODUCTION",
    externalTruthVerified: false,
    runtimeAuthenticationVerified: false,
    providerEvidenceVerified: false,
    rollbackProtectionVerified: false,
    runtimeEnforcementVerified: false,
    activationReady: false,
    releaseAuthorizationVerified: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: RELEASE_DEPENDENCY_GRAPH_MAINNET_STATUS,
    blockers: Object.freeze([...blockers]),
    violations: Object.freeze([...violations]),
  };
}

function invalidResult(violations, profile = null) {
  return resultSurface({
    profile,
    inventoryComplete: false,
    graphValid: false,
    packetComplete: false,
    blockers: [],
    violations,
  });
}

function validateScopeAndPolicies(manifest, violations) {
  if (!exactKeys(manifest.scope, ["contract", "doesNotCertify"], "scope", violations)
    || !exactJson(manifest.scope, SCOPE)) {
    violations.push("scope: structural-only certification boundary drifted");
  }
  if (!exactKeys(manifest.applicabilityPolicy, Object.keys(RELEASE_DEPENDENCY_APPLICABILITY_POLICY), "applicabilityPolicy", violations)
    || !exactJson(manifest.applicabilityPolicy, RELEASE_DEPENDENCY_APPLICABILITY_POLICY)) {
    violations.push("applicabilityPolicy: Privacy Vault, all 50 locales, and media must remain REQUIRED with no N/A path");
  }
  if (!exactKeys(manifest.artifactBindingPolicy, Object.keys(RELEASE_DEPENDENCY_ARTIFACT_POLICY), "artifactBindingPolicy", violations)
    || !exactJson(manifest.artifactBindingPolicy, RELEASE_DEPENDENCY_ARTIFACT_POLICY)) {
    violations.push("artifactBindingPolicy: only clean committed allowlisted B3 artifacts may be bound");
  }
}

function validateArtifactShape(value, expected, path, violations) {
  if (expected === null) {
    if (value !== null) violations.push(`${path}: unresolved or dirty artifact must remain null`);
    return;
  }
  if (!exactKeys(value, ARTIFACT_KEYS, path, violations)) return;
  if (!exactJson(value, expected)) violations.push(`${path}: artifact path, digest, or reference-only scope drifted`);
}

function validateNode(node, index, manifest, scopedStates, blockers, violations) {
  const path = `nodes[${index}]`;
  if (!exactKeys(node, NODE_KEYS, path, violations)) return false;
  const expected = RELEASE_DEPENDENCY_NODE_SPECS[index];
  const effectiveExpected = NODE_SPEC_BY_ID.get(expected.id);
  if (node.id !== expected.id) violations.push(`${path}.id: exact ordered node inventory drifted; expected ${expected.id}`);
  if (node.applicability !== "REQUIRED") violations.push(`${path}.applicability: every v1 node is REQUIRED; N/A and optional cuts are unsupported`);
  if (node.completionPredicate !== effectiveExpected.completionPredicate) {
    violations.push(`${path}.completionPredicate: expected ${effectiveExpected.completionPredicate}`);
  }
  validateArtifactShape(node.contractArtifact, effectiveExpected.contractArtifact, `${path}.contractArtifact`, violations);

  if (node.status !== "BLOCKED" && node.status !== "STRUCTURAL_REVIEW_PACKET_COMPLETE") {
    violations.push(`${path}.status: expected BLOCKED or STRUCTURAL_REVIEW_PACKET_COMPLETE`);
    return false;
  }
  if (node.status === "BLOCKED") {
    if (node.completionEvidence !== null) violations.push(`${path}.completionEvidence: BLOCKED requires null`);
    if (typeof node.blocker !== "string" || node.blocker.length < 24 || PLACEHOLDER.test(node.blocker)) {
      violations.push(`${path}.blocker: BLOCKED requires a specific non-placeholder reason`);
    } else blockers.push(`${node.id}: ${node.blocker}`);
    return false;
  }

  if (node.blocker !== null) violations.push(`${path}.blocker: complete packet requires null`);
  if (!exactKeys(node.completionEvidence, EVIDENCE_KEYS, `${path}.completionEvidence`, violations)) return false;
  const evidence = node.completionEvidence;
  for (const key of ["subjectSha256", "artifactSha256"]) {
    if (!canonicalHex(evidence[key])) violations.push(`${path}.completionEvidence.${key}: expected nontrivial lowercase SHA-256`);
  }
  if (evidence.schema !== "iat-b3-release-dependency-node-evidence/v1"
    || evidence.nodeId !== node.id
    || evidence.predicate !== node.completionPredicate
    || evidence.environment !== manifest.profile
    || evidence.subjectSha256 !== nodeSubjectSha256(node)) {
    violations.push(`${path}.completionEvidence: evidence is not exactly bound to this node, predicate, subject, and profile`);
  }

  if (manifest.profile === "TEST_FIXTURE") {
    if (!exactJson(evidence, expectedFixtureEvidence(node))) {
      violations.push(`${path}.completionEvidence: expected exact conspicuous fixture evidence`);
      return false;
    }
    return true;
  }
  if (manifest.profile === "PRODUCTION") {
    if (node.contractArtifact === null) {
      violations.push(`${path}.completionEvidence: production completion requires a reviewed immutable contract artifact binding`);
    } else if (evidence.artifactSha256 !== node.contractArtifact.sha256) {
      violations.push(`${path}.completionEvidence.artifactSha256: must equal the immutable committed contract artifact SHA-256`);
    }
    if (!scopedStates.get(node.id)) {
      violations.push(`${path}.status: scoped production completion predicate is false; valid:true, reference parsing, or self-attestation cannot satisfy it`);
      return false;
    }
    return true;
  }
  return false;
}

function validateBlockerSpecificity(nodes, violations) {
  const byId = new Map(nodes
    .filter((node) => node && typeof node === "object" && !Array.isArray(node)
      && typeof node.id === "string")
    .map((node) => [node.id, node]));
  const requireTerms = (id, terms) => {
    const node = byId.get(id);
    if (node?.status !== "BLOCKED") return;
    const blocker = node.blocker;
    if (typeof blocker !== "string" || terms.some((term) => !blocker.toLowerCase().includes(term.toLowerCase()))) {
      violations.push(`nodes.${id}.blocker: must retain ${terms.join(", ")} blocker detail`);
    }
  };
  requireTerms("CORE_CUSTODY_POLICY_ADAPTER", ["custody", "owner acceptance"]);
  requireTerms("FACTION_ECONOMICS_FUNDING", ["scoring", "Sybil", "funding"]);
  requireTerms("CONFIG_GENESIS_PHASE_CODEC", ["preactivation", "vacuous-cap", "finalize", "activate"]);
  requireTerms("GENESIS_ALLOCATIONS_CONSERVATION", ["exact allocation", "conservation"]);
  requireTerms("COMBINED_STAKE_INGRESS_HOOK", ["same production artifact", "not combined"]);
  requireTerms("PRODUCTION_BINARY_REPRODUCIBILITY", ["154,952", "not production"]);
  requireTerms("DEPLOYED_IDENTITY_AUTHORITY_SEAL_EVIDENCE", ["deployed bytes", "authority", "no Mainnet deployment"]);
  requireTerms("LOCALIZATION_EVIDENCE", ["50", "native review", "required"]);
  requireTerms("MEDIA_MASTER_COMPLETENESS", ["14", "missing", "required", "N/A"]);
  requireTerms("V2_LAUNCH_CEREMONY_BOUNDARY", ["HOLD", "supersession", "Original SPL"]);
}

function validateEdges(edges, completeById, violations) {
  if (!Array.isArray(edges) || edges.length !== RELEASE_DEPENDENCY_EDGES.length) {
    violations.push(`edges: expected exact ${RELEASE_DEPENDENCY_EDGES.length}-edge inventory`);
    return false;
  }
  const ids = new Set(RELEASE_DEPENDENCY_NODE_IDS);
  const seen = new Set();
  const adjacency = new Map(RELEASE_DEPENDENCY_NODE_IDS.map((id) => [id, []]));
  for (let index = 0; index < edges.length; index += 1) {
    const edge = edges[index];
    const expected = RELEASE_DEPENDENCY_EDGES[index];
    if (!Array.isArray(edge) || edge.length !== 2
      || Reflect.ownKeys(edge).length !== 3) {
      violations.push(`edges[${index}]: expected a dense undecorated [prerequisite,dependent] pair`);
      continue;
    }
    const [from, to] = edge;
    if (from !== expected[0] || to !== expected[1]) {
      violations.push(`edges[${index}]: exact ordered edge inventory drifted; expected ${expected[0]} -> ${expected[1]}`);
    }
    if (!ids.has(from) || !ids.has(to)) violations.push(`edges[${index}]: unknown node`);
    if (from === to) violations.push(`edges[${index}]: self edge is forbidden`);
    const key = `${from}->${to}`;
    if (seen.has(key)) violations.push(`edges[${index}]: duplicate edge ${key}`);
    seen.add(key);
    if (ids.has(from) && ids.has(to) && from !== to) adjacency.get(from).push(to);
    if (completeById.get(to) === true && completeById.get(from) !== true) {
      violations.push(`edges[${index}]: complete child ${to} has BLOCKED prerequisite ${from}`);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visiting.has(id)) {
      violations.push(`edges: cycle reaches ${id}`);
      return;
    }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) visit(next);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of RELEASE_DEPENDENCY_NODE_IDS) visit(id);

  for (const id of TERMINAL_PREREQUISITES) {
    const reachable = new Set([id]);
    const queue = [id];
    while (queue.length > 0) {
      const current = queue.shift();
      for (const next of adjacency.get(current) ?? []) {
        if (!reachable.has(next)) {
          reachable.add(next);
          queue.push(next);
        }
      }
    }
    if (!reachable.has(TERMINAL_ID)) violations.push(`edges: required node ${id} cannot reach ${TERMINAL_ID}`);
  }
  return violations.length === 0;
}

export function validateReleaseDependencyGraphManifest(manifest, options = {}) {
  const violations = [];
  if (!canonicalJsonTree(manifest, "manifest", violations)) return invalidResult(violations);
  let safe;
  try {
    safe = JSON.parse(canonicalizeRfc8785(manifest));
  } catch (error) {
    return invalidResult([`manifest: canonicalization failed (${error.message})`]);
  }
  if (!exactKeys(safe, TOP_LEVEL_KEYS, "manifest", violations)) {
    return invalidResult(violations, typeof safe.profile === "string" ? safe.profile : null);
  }
  const profile = safe.profile;
  if (profile !== "PRODUCTION" && profile !== "TEST_FIXTURE") {
    violations.push("manifest.profile: expected PRODUCTION or TEST_FIXTURE");
  }
  if (profile === "TEST_FIXTURE" && options.allowTestFixture !== true) {
    violations.push("manifest.profile: TEST_FIXTURE requires explicit allowTestFixture and never satisfies production review");
  }
  if (safe.$schema !== "./iat-b3-release-dependency-graph.v1.schema.json") violations.push("manifest.$schema: unexpected schema path");
  if (safe.schema !== RELEASE_DEPENDENCY_GRAPH_SCHEMA) violations.push("manifest.schema: unsupported schema version");
  if (safe.status !== "BLOCKED" && safe.status !== "STRUCTURAL_REVIEW_PACKET_COMPLETE") {
    violations.push("manifest.status: expected BLOCKED or STRUCTURAL_REVIEW_PACKET_COMPLETE");
  }
  validateScopeAndPolicies(safe, violations);
  if (safe.graphDefinitionSha256 !== RELEASE_DEPENDENCY_GRAPH_SHA256) {
    violations.push("manifest.graphDefinitionSha256: alternate, stale, or self-substituted graph definition");
  }
  for (const key of FALSE_FLAG_KEYS) {
    if (safe[key] !== false) violations.push(`manifest.${key}: must remain false`);
  }
  if (safe.mainnetStatus !== RELEASE_DEPENDENCY_GRAPH_MAINNET_STATUS) {
    violations.push("manifest.mainnetStatus: must remain HOLD");
  }

  const bytesByPath = new Map();
  if (profile === "PRODUCTION") {
    for (const contractArtifact of new Map(
      RELEASE_DEPENDENCY_NODE_SPECS
        .filter((entry) => entry.contractArtifact)
        .map((entry) => [entry.contractArtifact.path, entry.contractArtifact]),
    ).values()) {
      const bytes = readCommittedArtifact(contractArtifact.path, contractArtifact.sha256, violations);
      if (bytes) bytesByPath.set(contractArtifact.path, bytes);
    }
  }
  const scopedStates = scopedProductionPredicateStates(
    bytesByPath,
    violations,
    options.evaluationUnixSeconds,
  );

  const blockers = [];
  const completeById = new Map();
  if (!Array.isArray(safe.nodes) || safe.nodes.length !== RELEASE_DEPENDENCY_NODE_IDS.length) {
    violations.push(`nodes: expected exact ordered ${RELEASE_DEPENDENCY_NODE_IDS.length}-node inventory`);
  } else {
    for (let index = 0; index < safe.nodes.length; index += 1) {
      const node = safe.nodes[index];
      const complete = validateNode(node, index, safe, scopedStates, blockers, violations);
      if (typeof node?.id === "string") completeById.set(node.id, complete);
    }
    validateBlockerSpecificity(safe.nodes, violations);
  }

  const graphValid = validateEdges(safe.edges, completeById, violations);
  if (exactKeys(safe.terminalPredicate, TERMINAL_KEYS, "terminalPredicate", violations)) {
    const terminal = safe.terminalPredicate;
    if (!exactJson(terminal.requiredNodeIds, TERMINAL_PREREQUISITES)) {
      violations.push("terminalPredicate.requiredNodeIds: must include every ordered nonterminal node exactly once");
    }
    const allNodesComplete = RELEASE_DEPENDENCY_NODE_IDS.every((id) => completeById.get(id) === true);
    if (terminal.status === "BLOCKED") {
      if (typeof terminal.blocker !== "string" || terminal.blocker.length < 24 || PLACEHOLDER.test(terminal.blocker)) {
        violations.push("terminalPredicate.blocker: BLOCKED requires a specific non-placeholder reason");
      } else blockers.push(`${TERMINAL_ID}: ${terminal.blocker}`);
      if (allNodesComplete) violations.push("terminalPredicate.status: BLOCKED contradicts complete prerequisites");
    } else if (terminal.status === "STRUCTURAL_REVIEW_PACKET_COMPLETE") {
      if (terminal.blocker !== null) violations.push("terminalPredicate.blocker: complete predicate requires null");
      if (!allNodesComplete) violations.push("terminalPredicate.status: cannot complete while any required node is BLOCKED");
    } else violations.push("terminalPredicate.status: unexpected status");
  }

  const allNodesComplete = RELEASE_DEPENDENCY_NODE_IDS.every((id) => completeById.get(id) === true);
  const terminalComplete = safe.terminalPredicate?.status === "STRUCTURAL_REVIEW_PACKET_COMPLETE";
  if (safe.status === "BLOCKED" && allNodesComplete && terminalComplete) {
    violations.push("manifest.status: BLOCKED contradicts a complete structural dependency packet");
  }
  if (safe.status === "STRUCTURAL_REVIEW_PACKET_COMPLETE" && (!allNodesComplete || !terminalComplete)) {
    violations.push("manifest.status: cannot complete while a node or terminal predicate is BLOCKED");
  }
  if (profile === "PRODUCTION" && safe.status !== "BLOCKED" && scopedStates.size > 0) {
    const incompleteScoped = RELEASE_DEPENDENCY_NODE_IDS.filter((id) => !scopedStates.get(id));
    if (incompleteScoped.length > 0) {
      violations.push(`manifest.status: production scoped predicates remain false for ${incompleteScoped.join(",")}`);
    }
  }

  const inventoryComplete = violations.length === 0
    && graphValid
    && safe.nodes?.length === 28
    && safe.edges?.length === 132
    && safe.graphDefinitionSha256 === RELEASE_DEPENDENCY_GRAPH_SHA256
    && exactJson(safe.applicabilityPolicy, RELEASE_DEPENDENCY_APPLICABILITY_POLICY)
    && exactJson(safe.artifactBindingPolicy, RELEASE_DEPENDENCY_ARTIFACT_POLICY);
  const packetComplete = violations.length === 0
    && graphValid
    && allNodesComplete
    && terminalComplete
    && safe.status === "STRUCTURAL_REVIEW_PACKET_COMPLETE";
  return resultSurface({
    profile,
    inventoryComplete,
    graphValid: graphValid && violations.length === 0,
    packetComplete,
    blockers,
    violations,
  });
}

export function assertReleaseDependencyReviewPacketComplete(manifest, options = {}) {
  const result = validateReleaseDependencyGraphManifest(manifest, options);
  if (!result.dependencyReviewPacketComplete) {
    throw new Error(`B3_RELEASE_DEPENDENCY_REVIEW_PACKET_INCOMPLETE: ${[
      ...result.blockers,
      ...result.violations,
    ].join("; ")}`);
  }
  return result;
}

export function createBlockedReleaseDependencyGraphManifest() {
  return {
    $schema: "./iat-b3-release-dependency-graph.v1.schema.json",
    schema: RELEASE_DEPENDENCY_GRAPH_SCHEMA,
    profile: "PRODUCTION",
    status: "BLOCKED",
    scope: structuredClone(SCOPE),
    applicabilityPolicy: structuredClone(RELEASE_DEPENDENCY_APPLICABILITY_POLICY),
    artifactBindingPolicy: structuredClone(RELEASE_DEPENDENCY_ARTIFACT_POLICY),
    graphDefinitionSha256: RELEASE_DEPENDENCY_GRAPH_SHA256,
    nodes: RELEASE_DEPENDENCY_NODE_IDS.map((id) => {
      const node = NODE_SPEC_BY_ID.get(id);
      return {
        id,
        applicability: "REQUIRED",
        status: "BLOCKED",
        completionPredicate: node.completionPredicate,
        contractArtifact: node.contractArtifact ? structuredClone(node.contractArtifact) : null,
        completionEvidence: null,
        blocker: CANONICAL_BLOCKERS[id],
      };
    }),
    edges: RELEASE_DEPENDENCY_EDGES.map((edge) => [...edge]),
    terminalPredicate: {
      status: "BLOCKED",
      requiredNodeIds: [...TERMINAL_PREREQUISITES],
      blocker: "The required 27 nonterminal packets have not all reached structural completion.",
    },
    externalTruthVerified: false,
    runtimeAuthenticationVerified: false,
    providerEvidenceVerified: false,
    rollbackProtectionVerified: false,
    runtimeEnforcementVerified: false,
    activationReady: false,
    releaseAuthorizationVerified: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: RELEASE_DEPENDENCY_GRAPH_MAINNET_STATUS,
  };
}

export function createReleaseDependencyGraphTestFixture(manifest) {
  const fixture = structuredClone(manifest);
  fixture.profile = "TEST_FIXTURE";
  fixture.status = "STRUCTURAL_REVIEW_PACKET_COMPLETE";
  for (const node of fixture.nodes) {
    node.status = "STRUCTURAL_REVIEW_PACKET_COMPLETE";
    node.blocker = null;
    node.completionEvidence = expectedFixtureEvidence(node);
  }
  fixture.terminalPredicate.status = "STRUCTURAL_REVIEW_PACKET_COMPLETE";
  fixture.terminalPredicate.blocker = null;
  return fixture;
}

export function parseReleaseDependencyGraphJson(text, label = "manifest") {
  if (typeof text !== "string") throw new TypeError(`${label}: JSON source must be a string`);
  let index = 0;
  const whitespace = /[\t\n\r ]/u;
  const skipWhitespace = () => {
    while (index < text.length && whitespace.test(text[index])) index += 1;
  };
  const fail = (message) => {
    throw new SyntaxError(`${label}: ${message} at byte ${index}`);
  };
  const parseStringToken = () => {
    if (text[index] !== "\"") fail("expected JSON string");
    const start = index;
    index += 1;
    while (index < text.length) {
      const character = text[index];
      if (character === "\"") {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      if (character === "\\") index += 2;
      else {
        if (character < " ") fail("unescaped control character");
        index += 1;
      }
    }
    fail("unterminated JSON string");
  };
  const parseValue = (path) => {
    skipWhitespace();
    if (text[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      while (index < text.length) {
        skipWhitespace();
        const key = parseStringToken();
        if (keys.has(key)) throw new SyntaxError(`${label}: duplicate JSON member ${path}.${key}`);
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") fail("expected colon");
        index += 1;
        parseValue(`${path}.${key}`);
        skipWhitespace();
        if (text[index] === "}") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing brace");
        index += 1;
      }
      fail("unterminated JSON object");
    }
    if (text[index] === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      let item = 0;
      while (index < text.length) {
        parseValue(`${path}[${item}]`);
        item += 1;
        skipWhitespace();
        if (text[index] === "]") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing bracket");
        index += 1;
      }
      fail("unterminated JSON array");
    }
    if (text[index] === "\"") {
      parseStringToken();
      return;
    }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) fail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skipWhitespace();
  parseValue("$root");
  skipWhitespace();
  if (index !== text.length) fail("unexpected trailing data");
  return JSON.parse(text);
}

export function loadReleaseDependencyGraphManifest(path = DEFAULT_MANIFEST_PATH) {
  const resolved = resolve(path);
  return parseReleaseDependencyGraphJson(readFileSync(resolved, "utf8"), resolved);
}

function parseCliArgs(argv) {
  let manifestPath = DEFAULT_MANIFEST_PATH;
  let allowTestFixture = false;
  let requireComplete = false;
  let evaluationUnixSeconds;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--fixture") allowTestFixture = true;
    else if (argument === "--require-review-packet-complete") requireComplete = true;
    else if (argument === "--evaluation-unix-seconds") {
      evaluationUnixSeconds = argv[index + 1];
      if (evaluationUnixSeconds === undefined) throw new Error("--evaluation-unix-seconds requires a value");
      index += 1;
    }
    else if (argument.startsWith("--")) throw new Error(`unknown option ${argument}`);
    else manifestPath = resolve(argument);
  }
  return { manifestPath, allowTestFixture, requireComplete, evaluationUnixSeconds };
}

function runCli() {
  try {
    const {
      manifestPath,
      allowTestFixture,
      requireComplete,
      evaluationUnixSeconds,
    } = parseCliArgs(process.argv.slice(2));
    const manifest = loadReleaseDependencyGraphManifest(manifestPath);
    const result = validateReleaseDependencyGraphManifest(manifest, {
      allowTestFixture,
      evaluationUnixSeconds,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!result.valid || (requireComplete && !result.dependencyReviewPacketComplete)) process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  }
}

const entryPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entryPath === import.meta.url) runCli();

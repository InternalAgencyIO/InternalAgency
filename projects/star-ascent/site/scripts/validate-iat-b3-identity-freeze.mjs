#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  parseB3OwnerPolicyFreezeJson,
  validateB3OwnerPolicyFreezeManifest,
} from "./validate-iat-b3-owner-policy-freeze.mjs";

export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const IAT_V2_PROGRAM_ID = "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map([...BASE58_ALPHABET].map((character, index) => [character, BigInt(index)]));
const TOP_LEVEL_KEYS = [
  "$schema",
  "schema",
  "profile",
  "readiness",
  "scope",
  "ownerPolicyBinding",
  "identities",
  "combinedArtifactBinding",
  "clusterPolicy",
  "networkBinding",
  "entropy",
  "seedTable",
  "factionPolicy",
  "mintConfig",
  "genesis",
  "sealOrder",
];
const PLACEHOLDER = /^(?:blocked|change[-_ ]?me|none|pending|placeholder|replace[-_ ]?me|tbd|todo|x+|0+)$/iu;
const SCOPE_EXCLUSIONS = Object.freeze([
  "FACTION_ECONOMICS",
  "GENESIS_ALLOCATION_AMOUNTS_OR_CONSERVATION_EVIDENCE",
  "REVIEWED_BINARY_HASHES_OR_DEPLOYED_BYTES",
  "MAINNET_OR_RELEASE_READINESS",
]);
export const PRODUCTION_OWNER_POLICY_BINDING = Object.freeze({
  status: "FROZEN",
  packetPath: "projects/star-ascent/site/docs/b3/iat-b3-owner-policy-freeze.v1.json",
  packetSha256: "9bd866fa99735b1b53d3b99d8083397e1d734b0b80587ff9e513340d437efd6c",
  liveEstateNodeId: "LIVE_ESTATE_CANONICAL_MINT_DECISION",
  requiredLiveEstateOwnerChoices: Object.freeze({
    liveEstateAssertion: "NO_LIVE_ESTATE_MINT",
    candidateMint: null,
    candidateTokenProgramId: null,
    canonicalMintDecision: "NEW_TOKEN_2022_FROM_INCEPTION",
    duplicateSupplyRetirementPolicy: "NOT_APPLICABLE",
  }),
  inputPolicy: "EXACT_COMMITTED_OWNER_POLICY_PACKET_ONLY",
  testFixturesSatisfyProduction: false,
  blocker: null,
});
export const TEST_FIXTURE_IDENTITIES = Object.freeze({
  lawProgramId: "29dv8e1WcjL4w6a7HDaHbUfXrF12yiJiVcKQ1qgeT3rF",
  economyProgramId: "2xfTrFbdiJtncBaCWoVK5yvgn9XT4UYZCWKGiQDqR3ij",
  canonicalMint: "3uXbrU7mzV3xZT5Jcz4BAEjNCNUGVNA32DeTXirDsiEd",
  genesisHash: "4zEL9HZwTFoanu5RbmGspF5a6uqVGP99xkJxToZoq3Pw",
});
const TEST_FIXTURE_IDENTITY_VALUES = new Set(Object.values(TEST_FIXTURE_IDENTITIES));
export const COMBINED_HOOK_HOST_TEST_IDENTITIES = Object.freeze({
  lawProgramId: "D6UucuMprPAYyCmr5UPU5h9YhRf2ZNtn23JTS32EjdjY",
  economyProgramId: "GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU",
  canonicalMint: "3JF3sEqM796hk5WFqA6EtmEwJQ9quALszsfJyvXNQKy3",
});
const FORBIDDEN_IDENTITY_LABELS = new Map([
  [IAT_V2_PROGRAM_ID, "retained V2 program ID"],
  ["6c725SoXTRThCVgEFrG6q2f3GKLR5m3A7dv7Gf11hNrq", "disposable local Daily Law program ID"],
  [COMBINED_HOOK_HOST_TEST_IDENTITIES.economyProgramId, "disposable stake-ingress economy fixture ID"],
  ["DAQCmCpqSgTn7J2MWmiPNZvJwasEESabaSy7VR4qUy4F", "disposable stake-ingress hook fixture ID"],
  [COMBINED_HOOK_HOST_TEST_IDENTITIES.lawProgramId, "combined-hook host-test law fixture ID"],
  [COMBINED_HOOK_HOST_TEST_IDENTITIES.canonicalMint, "combined-hook host-test mint fixture ID"],
  ["11111111111111111111111111111111", "System Program ID"],
  ["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", "Original SPL Token Program ID"],
  [TOKEN_2022_PROGRAM_ID, "Token-2022 program ID"],
  ["BPFLoaderUpgradeab1e11111111111111111111111", "upgradeable loader ID"],
]);

export const PRODUCTION_COMBINED_ARTIFACT_INPUT_SPECS = Object.freeze([
  Object.freeze({
    role: "LAW_PROGRAM_ID",
    environmentVariable: "IAT_B3_PRODUCTION_LAW_PROGRAM_ID",
    manifestPath: "identities.lawProgramId",
    identityField: "lawProgramId",
  }),
  Object.freeze({
    role: "ECONOMY_PROGRAM_ID",
    environmentVariable: "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID",
    manifestPath: "identities.economyProgramId",
    identityField: "economyProgramId",
  }),
  Object.freeze({
    role: "CANONICAL_MINT",
    environmentVariable: "IAT_B3_PRODUCTION_CANONICAL_MINT",
    manifestPath: "identities.canonicalMint",
    identityField: "canonicalMint",
  }),
]);

export const PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE = Object.freeze({
  status: "FROZEN",
  sourcePolicy: "EXACT_COMMITTED_CLEAN_HEAD",
  sourceHeadEnvironmentVariable: "IAT_B3_EXACT_SOURCE_HEAD_SHA",
  requiresNoTrackedOrUntrackedChanges: true,
  hostPlatform: "linux/amd64",
  rustToolchain: "1.97.1",
  cargoBuildSbfVersion: "3.1.10",
  platformToolsVersion: "1.52",
  networkPolicy: "OFFLINE_PREINSTALLED_TOOLCHAIN_ONLY",
  command: "cargo",
  arguments: Object.freeze([
    "build-sbf",
    "--manifest-path",
    "projects/star-ascent/site/programs/iat_b3_law/Cargo.toml",
    "--sbf-out-dir",
    "<FRESH_OUTPUT_DIRECTORY>",
    "--arch",
    "v0",
    "--no-default-features",
    "--features",
    "production-combined-hook",
    "--optimize-size",
    "--offline",
    "--skip-tools-install",
    "--tools-version",
    "v1.52",
    "--",
    "--locked",
    "--target-dir",
    "<FRESH_TARGET_DIRECTORY>",
  ]),
  outputFileName: "iat_b3_law.so",
  repetitions: 2,
  requiresIdenticalSha256: true,
  requiresIdenticalByteLength: true,
  publicNetworkWrites: false,
  signing: false,
  deployment: false,
  blocker: null,
});

export const SEED_SPECS = Object.freeze([
  ["lawState", "LAW", ["utf8:law-state", "pubkey:mint"]],
  ["extraAccountMetas", "LAW", ["utf8:extra-account-metas", "pubkey:mint"]],
  ["economyConfig", "ECONOMY", ["utf8:config", "pubkey:mint"]],
  ["vaultAuthority", "ECONOMY", ["utf8:vault-authority", "pubkey:economyConfig"]],
  ["laneState", "ECONOMY", ["utf8:lane", "pubkey:economyConfig", "u8:lane"]],
  ["laneToken", "ECONOMY", ["utf8:lane-token", "pubkey:economyConfig", "u8:lane"]],
  ["stakeToken", "ECONOMY", ["utf8:stake-token", "pubkey:economyConfig"]],
  ["stakeIngress", "ECONOMY", ["utf8:stake-ingress", "pubkey:economyConfig"]],
  ["coreReward", "ECONOMY", ["utf8:core-reward", "pubkey:economyConfig"]],
  ["agency", "ECONOMY", ["utf8:agency", "pubkey:economyConfig", "u32le:agencyIndex"]],
  ["agencyOwnerIndex", "ECONOMY", ["utf8:agency-owner", "pubkey:economyConfig", "pubkey:agencyOwner"]],
  ["eligibility", "ECONOMY", ["utf8:eligibility", "pubkey:economyConfig", "pubkey:operator"]],
  ["position", "ECONOMY", ["utf8:position", "pubkey:economyConfig", "pubkey:operator", "u64le:positionId"]],
  ["round", "ECONOMY", ["utf8:round", "pubkey:economyConfig", "u64le:week"]],
  ["factionConfig", "ECONOMY", ["utf8:faction-config", "pubkey:economyConfig"]],
  ["factionAllegiance", "ECONOMY", ["utf8:faction-allegiance", "pubkey:factionConfig", "pubkey:operator"]],
  ["factionWeek", "ECONOMY", ["utf8:faction-week", "pubkey:factionConfig", "u64le:week"]],
  ["factionScore", "ECONOMY", ["utf8:faction-score", "pubkey:factionWeek", "u8:factionId"]],
  ["factionRewardVault", "ECONOMY", ["utf8:faction-reward-vault", "pubkey:factionConfig"]],
  ["factionRewardManifest", "ECONOMY", ["utf8:faction-reward", "pubkey:factionWeek"]],
  ["factionFollowerSnapshot", "ECONOMY", ["utf8:faction-followers", "pubkey:factionWeek", "u8:factionId"]],
  ["factionClaim", "ECONOMY", ["utf8:faction-claim", "pubkey:factionRewardManifest", "pubkey:operator"]],
]);

const EXPECTED_FORBIDDEN_STAGING_WRITES = Object.freeze([
  "RELEASE",
  "REWARD",
  "FACTION",
  "POSITION",
  "ELIGIBILITY",
  "RESERVATION",
  "WITHDRAWAL",
  "CLAIM",
]);

const EXPECTED_FACTIONS = Object.freeze([
  Object.freeze({ id: "radiance", displayLabel: "Radiance" }),
  Object.freeze({ id: "ellie", displayLabel: "Ellie" }),
  Object.freeze({ id: "alia", displayLabel: "Alia" }),
  Object.freeze({ id: "ece", displayLabel: "Ece" }),
  Object.freeze({ id: "boss", displayLabel: "the boss" }),
]);

export const EXPECTED_SEAL_ORDER = Object.freeze([
  "DEPLOY_LAW_WITH_HARDWARE_UPGRADE_AUTHORITY",
  "DEPLOY_ECONOMY_WITH_HARDWARE_UPGRADE_AUTHORITY",
  "VERIFY_EXACT_PROGRAM_BYTES_AND_IDENTITIES",
  "REVOKE_LAW_UPGRADE_AUTHORITY",
  "REVOKE_ECONOMY_UPGRADE_AUTHORITY",
  "VERIFY_BOTH_PROGRAMS_IMMUTABLE",
  "CREATE_EXACT_TOKEN_2022_MINT",
  "ENTER_GENESIS_STAGING",
  "CREATE_AND_FUND_CANONICAL_ACCOUNTS",
  "VERIFY_GENESIS_CONSERVATION_AND_BINDINGS",
  "REVOKE_MINT_AUTHORITY",
  "REVOKE_FREEZE_AUTHORITY",
  "INITIALIZE_LAW_AND_SEAL_EXTENSION_AUTHORITIES",
  "VERIFY_MINT_AND_PROGRAM_AUTHORITIES_SEALED",
  "FINALIZE_CURRENT_DAY",
  "ACTIVATE_ONLY_IF_CURRENT_DAY_OPEN",
  "VERIFY_ACTIVE_AND_STAGING_DISABLED",
]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function equalArray(left, right) {
  return Array.isArray(left)
    && left.length === right.length
    && left.every((value, index) => value === right[index]);
}

function decodeBase58(value) {
  if (typeof value !== "string" || value.length === 0) return null;
  let magnitude = 0n;
  for (const character of value) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) return null;
    magnitude = magnitude * 58n + digit;
  }
  const bytes = [];
  while (magnitude > 0n) {
    bytes.push(Number(magnitude & 0xffn));
    magnitude >>= 8n;
  }
  bytes.reverse();
  let leadingZeroes = 0;
  while (leadingZeroes < value.length && value[leadingZeroes] === "1") leadingZeroes += 1;
  return Uint8Array.from([...new Array(leadingZeroes).fill(0), ...bytes]);
}

export function isCanonicalBase58Key(value) {
  const decoded = decodeBase58(value);
  return decoded?.length === 32;
}

function placeholderValue(value) {
  return typeof value === "string" && PLACEHOLDER.test(value.trim());
}

function exactKeys(value, expected, path, violations) {
  if (!isObject(value)) {
    violations.push(`${path}: expected object`);
    return false;
  }
  const actual = Object.keys(value);
  if (!equalArray(actual, expected)) {
    violations.push(`${path}: keys must be exactly ${expected.join(", ")}`);
    return false;
  }
  return true;
}

function validateOwnerPolicyBinding(manifest, options, blockers, violations) {
  const violationCountBeforeBinding = violations.length;
  const binding = manifest.ownerPolicyBinding;
  const expected = PRODUCTION_OWNER_POLICY_BINDING;
  const bindingKeys = [
    "status",
    "packetPath",
    "packetSha256",
    "liveEstateNodeId",
    "requiredLiveEstateOwnerChoices",
    "inputPolicy",
    "testFixturesSatisfyProduction",
    "blocker",
  ];
  if (!exactKeys(binding, bindingKeys, "ownerPolicyBinding", violations)) {
    return { ownerPolicyBindingVerified: false, ownerPolicyExternalTruthVerified: false };
  }
  for (const key of bindingKeys.filter((key) => key !== "requiredLiveEstateOwnerChoices")) {
    if (binding[key] !== expected[key]) {
      violations.push(`ownerPolicyBinding.${key}: expected ${String(expected[key])}`);
    }
  }
  const choiceKeys = Object.keys(expected.requiredLiveEstateOwnerChoices);
  if (exactKeys(
    binding.requiredLiveEstateOwnerChoices,
    choiceKeys,
    "ownerPolicyBinding.requiredLiveEstateOwnerChoices",
    violations,
  )) {
    for (const key of choiceKeys) {
      if (binding.requiredLiveEstateOwnerChoices[key] !== expected.requiredLiveEstateOwnerChoices[key]) {
        violations.push(`ownerPolicyBinding.requiredLiveEstateOwnerChoices.${key}: owner-selected inception tuple drifted`);
      }
    }
  }

  if (manifest.profile === "TEST_FIXTURE" && options.allowTestFixture === true) {
    return { ownerPolicyBindingVerified: false, ownerPolicyExternalTruthVerified: false };
  }

  const source = options.ownerPolicyBytes;
  if (source === undefined) {
    blockers.push("ownerPolicyBinding: exact committed owner-policy packet bytes were not supplied to the identity validator");
    return { ownerPolicyBindingVerified: false, ownerPolicyExternalTruthVerified: false };
  }
  if (typeof source !== "string" && !Buffer.isBuffer(source)) {
    violations.push("ownerPolicyBinding: ownerPolicyBytes must be an exact UTF-8 string or Buffer");
    return { ownerPolicyBindingVerified: false, ownerPolicyExternalTruthVerified: false };
  }
  const bytes = Buffer.isBuffer(source) ? source : Buffer.from(source, "utf8");
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== binding.packetSha256) {
    violations.push("ownerPolicyBinding.packetSha256: supplied owner-policy bytes do not match the frozen digest");
    return { ownerPolicyBindingVerified: false, ownerPolicyExternalTruthVerified: false };
  }

  let ownerPolicy;
  try {
    ownerPolicy = parseB3OwnerPolicyFreezeJson(bytes.toString("utf8"), binding.packetPath);
  } catch (error) {
    violations.push(`ownerPolicyBinding: strict owner-policy parse failed (${error.message})`);
    return { ownerPolicyBindingVerified: false, ownerPolicyExternalTruthVerified: false };
  }
  const result = validateB3OwnerPolicyFreezeManifest(ownerPolicy);
  for (const violation of result.violations) {
    violations.push(`ownerPolicyBinding.ownerPolicy: ${violation}`);
  }
  if (!result.valid) {
    return { ownerPolicyBindingVerified: false, ownerPolicyExternalTruthVerified: false };
  }

  const liveChoices = ownerPolicy.nodes?.[binding.liveEstateNodeId]?.ownerChoices;
  if (!exactKeys(liveChoices, choiceKeys, `ownerPolicyBinding.ownerPolicy.nodes.${binding.liveEstateNodeId}.ownerChoices`, violations)) {
    return { ownerPolicyBindingVerified: false, ownerPolicyExternalTruthVerified: false };
  }
  for (const key of choiceKeys) {
    if (liveChoices[key] !== binding.requiredLiveEstateOwnerChoices[key]) {
      violations.push(`ownerPolicyBinding.ownerPolicy.nodes.${binding.liveEstateNodeId}.ownerChoices.${key}: does not match the frozen owner-selected inception tuple`);
    }
  }

  const identityChoices = ownerPolicy.nodes?.PRODUCTION_IDENTITY_INPUT_FREEZE?.ownerChoices;
  const identityMappings = [
    ["identities.lawProgramId", manifest.identities?.lawProgramId, identityChoices?.lawProgramId],
    ["identities.economyProgramId", manifest.identities?.economyProgramId, identityChoices?.economyProgramId],
    ["identities.canonicalMint", manifest.identities?.canonicalMint, identityChoices?.canonicalMint],
    ["clusterPolicy.identityPolicy", manifest.clusterPolicy?.identityPolicy, identityChoices?.clusterIdentityPolicy],
    ["entropy.lagSlots", manifest.entropy?.lagSlots, identityChoices?.entropyLagSlots],
    ["mintConfig.metadataPolicy", manifest.mintConfig?.metadataPolicy, identityChoices?.metadataPolicy],
  ];
  for (const [path, manifestValue, policyValue] of identityMappings) {
    if (manifestValue !== policyValue) {
      violations.push(`${path}: must equal the exact owner-policy PRODUCTION_IDENTITY_INPUT_FREEZE choice`);
    }
  }
  const everyCanonicalSeedFrozen = Array.isArray(manifest.seedTable)
    && manifest.seedTable.length === SEED_SPECS.length
    && manifest.seedTable.every((entry) => entry?.status === "FROZEN");
  const manifestSeedAcceptance = everyCanonicalSeedFrozen ? true : null;
  if (manifestSeedAcceptance !== identityChoices?.acceptCanonicalSeedTable) {
    violations.push("seedTable: FROZEN state must exactly match the owner-policy acceptCanonicalSeedTable choice");
  }

  const ownerPolicyBindingVerified = violations.length === violationCountBeforeBinding;
  const ownerPolicyExternalTruthVerified = result.ownerAcceptanceVerified === true
    && result.externalEvidenceVerified === true
    && result.chainTruthVerified === true;
  if (!ownerPolicyExternalTruthVerified) {
    blockers.push("ownerPolicyBinding: authenticated owner acceptance plus independent live-estate and chain evidence remain unverified");
  }
  return { ownerPolicyBindingVerified, ownerPolicyExternalTruthVerified };
}

function validateStatus(section, path, blockers, violations) {
  if (section.status !== "BLOCKED" && section.status !== "FROZEN") {
    violations.push(`${path}.status: expected BLOCKED or FROZEN`);
    return;
  }
  if (section.status === "BLOCKED") {
    if (typeof section.blocker !== "string" || section.blocker.trim().length < 12) {
      violations.push(`${path}.blocker: BLOCKED requires a specific non-placeholder reason`);
    } else if (placeholderValue(section.blocker)) {
      violations.push(`${path}.blocker: placeholder reason is forbidden`);
    } else {
      blockers.push(`${path}: ${section.blocker}`);
    }
  } else if (section.blocker !== null) {
    violations.push(`${path}.blocker: FROZEN requires null`);
  }
}

function validatePublicIdentity(value, path, required, violations) {
  if (value === null) {
    if (required) violations.push(`${path}: FROZEN identity is missing`);
    return;
  }
  if (placeholderValue(value)) {
    violations.push(`${path}: placeholder identity is forbidden`);
    return;
  }
  if (!isCanonicalBase58Key(value)) {
    violations.push(`${path}: expected a canonical Base58 value decoding to 32 bytes`);
    return;
  }
  const forbiddenLabel = FORBIDDEN_IDENTITY_LABELS.get(value);
  if (forbiddenLabel) violations.push(`${path}: ${forbiddenLabel} cannot be a B3 production identity`);
}

function validateIdentities(manifest, blockers, violations) {
  const identities = manifest.identities;
  if (!exactKeys(
    identities,
    ["status", "lawProgramId", "economyProgramId", "canonicalMint", "blocker"],
    "identities",
    violations,
  )) return;
  validateStatus(identities, "identities", blockers, violations);
  const required = identities.status === "FROZEN";
  const entries = [
    ["lawProgramId", identities.lawProgramId],
    ["economyProgramId", identities.economyProgramId],
    ["canonicalMint", identities.canonicalMint],
  ];
  for (const [name, value] of entries) {
    validatePublicIdentity(value, `identities.${name}`, required, violations);
  }
  const present = entries.filter(([, value]) => typeof value === "string");
  if (new Set(present.map(([, value]) => value)).size !== present.length) {
    violations.push("identities: law program, economy program, and canonical mint must be distinct");
  }
}

function validateCombinedArtifactSbfBuildRecipe(recipe, violations) {
  const expected = PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE;
  const keys = [
    "status",
    "sourcePolicy",
    "sourceHeadEnvironmentVariable",
    "requiresNoTrackedOrUntrackedChanges",
    "hostPlatform",
    "rustToolchain",
    "cargoBuildSbfVersion",
    "platformToolsVersion",
    "networkPolicy",
    "command",
    "arguments",
    "outputFileName",
    "repetitions",
    "requiresIdenticalSha256",
    "requiresIdenticalByteLength",
    "publicNetworkWrites",
    "signing",
    "deployment",
    "blocker",
  ];
  if (!exactKeys(recipe, keys, "combinedArtifactBinding.reproducibleSbfBuild", violations)) return;
  for (const key of keys.filter((key) => key !== "arguments")) {
    if (recipe[key] !== expected[key]) {
      violations.push(`combinedArtifactBinding.reproducibleSbfBuild.${key}: expected ${String(expected[key])}`);
    }
  }
  if (!equalArray(recipe.arguments, expected.arguments)) {
    violations.push("combinedArtifactBinding.reproducibleSbfBuild.arguments: exact offline, locked, fresh-target production command is required");
  }
}

function validateCombinedArtifactBinding(manifest, blockers, violations) {
  const binding = manifest.combinedArtifactBinding;
  const keys = [
    "status",
    "programCrate",
    "cargoFeature",
    "inputPolicy",
    "testFixturesSatisfyProduction",
    "inputs",
    "reproducibleSbfBuild",
    "blocker",
  ];
  if (!exactKeys(binding, keys, "combinedArtifactBinding", violations)) return;
  validateStatus(binding, "combinedArtifactBinding", blockers, violations);
  if (binding.programCrate !== "projects/star-ascent/site/programs/iat_b3_law") {
    violations.push("combinedArtifactBinding.programCrate: expected the executable Daily Law crate");
  }
  if (binding.cargoFeature !== "production-combined-hook") {
    violations.push("combinedArtifactBinding.cargoFeature: expected production-combined-hook");
  }
  if (binding.inputPolicy !== "OWNER_SUPPLIED_PUBLIC_IDENTITIES_ONLY") {
    violations.push("combinedArtifactBinding.inputPolicy: only owner-supplied public identities may bind production bytes");
  }
  if (binding.testFixturesSatisfyProduction !== false) {
    violations.push("combinedArtifactBinding.testFixturesSatisfyProduction: test fixtures must never satisfy production binding");
  }
  if (!Array.isArray(binding.inputs)
    || binding.inputs.length !== PRODUCTION_COMBINED_ARTIFACT_INPUT_SPECS.length) {
    violations.push("combinedArtifactBinding.inputs: expected exactly three ordered production build inputs");
  } else {
    for (let index = 0; index < PRODUCTION_COMBINED_ARTIFACT_INPUT_SPECS.length; index += 1) {
      const actual = binding.inputs[index];
      const expected = PRODUCTION_COMBINED_ARTIFACT_INPUT_SPECS[index];
      const path = `combinedArtifactBinding.inputs[${index}]`;
      if (!exactKeys(actual, ["role", "environmentVariable", "manifestPath"], path, violations)) continue;
      for (const key of ["role", "environmentVariable", "manifestPath"]) {
        if (actual[key] !== expected[key]) {
          violations.push(`${path}.${key}: expected ${expected[key]}`);
        }
      }
    }
  }
  validateCombinedArtifactSbfBuildRecipe(binding.reproducibleSbfBuild, violations);
  if (binding.status === "FROZEN" && manifest.identities?.status !== "FROZEN") {
    violations.push("combinedArtifactBinding.status: cannot freeze build inputs before all three production identities are frozen");
  }
}

function validateScope(manifest, violations) {
  const scope = manifest.scope;
  if (!exactKeys(scope, ["contract", "doesNotCertify"], "scope", violations)) return;
  if (scope.contract !== "IDENTITY_FREEZE_INPUTS_ONLY") {
    violations.push("scope.contract: this validator covers identity-freeze inputs only");
  }
  if (!equalArray(scope.doesNotCertify, SCOPE_EXCLUSIONS)) {
    violations.push("scope.doesNotCertify: must disclaim faction economics, Genesis allocations, binary review, and Mainnet/release readiness");
  }
}

function rejectFixtureIdentityRelabel(manifest, options, violations) {
  const fixtureUseAuthorized = manifest.profile === "TEST_FIXTURE" && options.allowTestFixture === true;
  if (fixtureUseAuthorized) return;
  const fields = [
    ["identities.lawProgramId", manifest.identities?.lawProgramId],
    ["identities.economyProgramId", manifest.identities?.economyProgramId],
    ["identities.canonicalMint", manifest.identities?.canonicalMint],
    ["networkBinding.genesisHash", manifest.networkBinding?.genesisHash],
  ];
  for (const [path, value] of fields) {
    if (TEST_FIXTURE_IDENTITY_VALUES.has(value)) {
      violations.push(`${path}: known TEST_FIXTURE identity requires profile TEST_FIXTURE plus explicit allowTestFixture`);
    }
  }
}

function validateClusterAndNetwork(manifest, blockers, violations) {
  const cluster = manifest.clusterPolicy;
  if (exactKeys(
    cluster,
    ["status", "identityPolicy", "canonicalScope", "nonProductionIdentitiesAreCanonical", "blocker"],
    "clusterPolicy",
    violations,
  )) {
    validateStatus(cluster, "clusterPolicy", blockers, violations);
    const policies = new Set([
      "SAME_LAW_ECONOMY_AND_MINT_IDS_ACROSS_CLUSTERS",
      "SAME_PROGRAM_IDS_DISTINCT_MINT_PER_CLUSTER",
      "DISTINCT_PROGRAM_AND_MINT_IDS_PER_CLUSTER",
    ]);
    if (cluster.identityPolicy === null) {
      if (cluster.status === "FROZEN") violations.push("clusterPolicy.identityPolicy: FROZEN policy is missing");
    } else if (!policies.has(cluster.identityPolicy)) {
      violations.push("clusterPolicy.identityPolicy: unsupported same/different-cluster policy");
    }
    if (cluster.canonicalScope !== "MAINNET_BETA_ONLY") {
      violations.push("clusterPolicy.canonicalScope: only Mainnet Beta may be canonical");
    }
    if (cluster.nonProductionIdentitiesAreCanonical !== false) {
      violations.push("clusterPolicy.nonProductionIdentitiesAreCanonical: non-production identities must remain disposable");
    }
  }

  const network = manifest.networkBinding;
  if (!exactKeys(
    network,
    ["status", "lawDomainSeparator", "cluster", "genesisHash", "genesisHashSource", "bindMintAndEntropySlot", "blocker"],
    "networkBinding",
    violations,
  )) return;
  validateStatus(network, "networkBinding", blockers, violations);
  if (network.lawDomainSeparator !== "IAT_B3_SOLANA_DAILY_LAW_V1") {
    violations.push("networkBinding.lawDomainSeparator: consensus domain drifted");
  }
  if (network.cluster !== "mainnet-beta") violations.push("networkBinding.cluster: expected mainnet-beta");
  if (network.genesisHashSource !== "SOLANA_GET_GENESIS_HASH_FINALIZED") {
    violations.push("networkBinding.genesisHashSource: expected finalized getGenesisHash evidence");
  }
  if (network.bindMintAndEntropySlot !== true) {
    violations.push("networkBinding.bindMintAndEntropySlot: mint and entropy slot must be domain-bound");
  }
  validatePublicIdentity(
    network.genesisHash,
    "networkBinding.genesisHash",
    network.status === "FROZEN",
    violations,
  );
}

function validateFactionPolicy(manifest, blockers, violations) {
  const policy = manifest.factionPolicy;
  const keys = [
    "status",
    "factions",
    "allegianceCooldownSeconds",
    "sameFactionPledgeRule",
    "leadersHaveProtocolAuthority",
    "blocker",
  ];
  if (!exactKeys(policy, keys, "factionPolicy", violations)) return;
  validateStatus(policy, "factionPolicy", blockers, violations);
  if (policy.status !== "FROZEN") violations.push("factionPolicy.status: fixed faction identities and cooldown must remain FROZEN");
  if (!Array.isArray(policy.factions) || policy.factions.length !== EXPECTED_FACTIONS.length) {
    violations.push("factionPolicy.factions: expected exactly five fixed factions");
  } else {
    for (let index = 0; index < EXPECTED_FACTIONS.length; index += 1) {
      const faction = policy.factions[index];
      const path = `factionPolicy.factions[${index}]`;
      if (!exactKeys(faction, ["id", "displayLabel"], path, violations)) continue;
      const expected = EXPECTED_FACTIONS[index];
      if (faction.id !== expected.id || faction.displayLabel !== expected.displayLabel) {
        violations.push(`${path}: expected ${expected.id}/${expected.displayLabel}`);
      }
    }
  }
  if (policy.allegianceCooldownSeconds !== 86_400) {
    violations.push("factionPolicy.allegianceCooldownSeconds: expected exactly 86,400 seconds");
  }
  if (policy.sameFactionPledgeRule !== "REJECT_NO_OP") {
    violations.push("factionPolicy.sameFactionPledgeRule: pledging to the current faction must be rejected");
  }
  if (policy.leadersHaveProtocolAuthority !== false) {
    violations.push("factionPolicy.leadersHaveProtocolAuthority: narrative leaders cannot hold protocol authority");
  }
}

function validateEntropy(manifest, blockers, violations) {
  const entropy = manifest.entropy;
  if (!exactKeys(
    entropy,
    ["status", "lagSlots", "skippedSlotRule", "insufficientHistoryRule", "blocker"],
    "entropy",
    violations,
  )) return;
  validateStatus(entropy, "entropy", blockers, violations);
  if (entropy.lagSlots === null) {
    if (entropy.status === "FROZEN") violations.push("entropy.lagSlots: FROZEN lag is missing");
  } else if (!Number.isSafeInteger(entropy.lagSlots) || entropy.lagSlots < 1 || entropy.lagSlots > 512) {
    violations.push("entropy.lagSlots: expected an integer from 1 through 512");
  }
  if (entropy.skippedSlotRule !== "NEWEST_AVAILABLE_ANCESTOR_AT_OR_BEFORE_CURRENT_SLOT_MINUS_LAG") {
    violations.push("entropy.skippedSlotRule: rule must select the newest available ancestor at or before the lag target");
  }
  if (entropy.insufficientHistoryRule !== "FAIL_CLOSED") {
    violations.push("entropy.insufficientHistoryRule: missing lag history must fail closed");
  }
}

function validateSeedTable(manifest, blockers, violations) {
  if (!Array.isArray(manifest.seedTable)) {
    violations.push("seedTable: expected array");
    return;
  }
  if (manifest.seedTable.length !== SEED_SPECS.length) {
    violations.push(`seedTable: expected exactly ${SEED_SPECS.length} canonical account roles`);
  }
  const names = new Set();
  const derivations = new Map();
  for (let index = 0; index < manifest.seedTable.length; index += 1) {
    const entry = manifest.seedTable[index];
    const path = `seedTable[${index}]`;
    if (!exactKeys(entry, ["name", "program", "status", "components", "purpose", "blocker"], path, violations)) continue;
    validateStatus(entry, `${path}(${entry.name})`, blockers, violations);
    if (names.has(entry.name)) violations.push(`${path}.name: duplicate seed role ${entry.name}`);
    names.add(entry.name);
    const expected = SEED_SPECS[index];
    if (!expected) {
      violations.push(`${path}: unexpected seed role ${entry.name}`);
      continue;
    }
    if (entry.name !== expected[0] || entry.program !== expected[1] || !equalArray(entry.components, expected[2])) {
      violations.push(`${path}: expected ${expected[0]} ${expected[1]} [${expected[2].join(", ")}]`);
    }
    if (typeof entry.purpose !== "string" || entry.purpose.trim().length < 8) {
      violations.push(`${path}.purpose: expected a specific purpose`);
    }
    if (!Array.isArray(entry.components)) continue;
    for (const [componentIndex, component] of entry.components.entries()) {
      const componentPath = `${path}.components[${componentIndex}]`;
      if (typeof component !== "string" || !/^(?:utf8|pubkey|u8|u32le|u64le):[A-Za-z][A-Za-z0-9-]*$/u.test(component)) {
        violations.push(`${componentPath}: unsupported seed encoding`);
      } else if (component.startsWith("utf8:") && Buffer.byteLength(component.slice(5), "utf8") > 32) {
        violations.push(`${componentPath}: literal seed exceeds Solana's 32-byte component limit`);
      }
    }
    const derivationKey = `${entry.program}|${entry.components.join("\u0000")}`;
    const prior = derivations.get(derivationKey);
    if (prior) violations.push(`${path}: seed collision with ${prior}`);
    else derivations.set(derivationKey, entry.name);
  }
}

function validateMintConfig(manifest, blockers, violations) {
  const mint = manifest.mintConfig;
  const keys = [
    "status",
    "tokenProgramId",
    "decimals",
    "fixedSupplyBaseUnits",
    "extensionsOrdered",
    "allowAdditionalExtensions",
    "mintAuthorityAtCreation",
    "mintAuthorityAfterFunding",
    "freezeAuthorityAtCreation",
    "freezeAuthorityBeforeLawInitialization",
    "permanentDelegate",
    "mintCloseAuthority",
    "transferHook",
    "confidentialTransferMint",
    "metadataPolicy",
    "blocker",
  ];
  if (!exactKeys(mint, keys, "mintConfig", violations)) return;
  validateStatus(mint, "mintConfig", blockers, violations);
  if (mint.tokenProgramId !== TOKEN_2022_PROGRAM_ID) violations.push("mintConfig.tokenProgramId: expected canonical Token-2022 program");
  if (mint.decimals !== 9) violations.push("mintConfig.decimals: expected 9");
  if (mint.fixedSupplyBaseUnits !== "1000000000000000000") violations.push("mintConfig.fixedSupplyBaseUnits: expected exact fixed supply");
  if (!equalArray(mint.extensionsOrdered, ["ConfidentialTransferMint", "TransferHook"])) {
    violations.push("mintConfig.extensionsOrdered: exactly ConfidentialTransferMint then TransferHook are allowed");
  }
  if (mint.allowAdditionalExtensions !== false) violations.push("mintConfig.allowAdditionalExtensions: additional extensions are forbidden");
  if (mint.mintAuthorityAtCreation !== "CEREMONY_SIGNER" || mint.mintAuthorityAfterFunding !== null) {
    violations.push("mintConfig: mint authority must be ceremony-only and null immediately after funding");
  }
  if (mint.freezeAuthorityAtCreation !== "CEREMONY_SIGNER" || mint.freezeAuthorityBeforeLawInitialization !== null) {
    violations.push("mintConfig: freeze authority must be ceremony-only and null before law initialization");
  }
  if (mint.permanentDelegate !== "ABSENT" || mint.mintCloseAuthority !== "ABSENT") {
    violations.push("mintConfig: permanent delegate and mint-close authority must be absent");
  }
  if (exactKeys(
    mint.transferHook,
    ["programId", "authorityAtCreation", "authorityAfterLawInitialization"],
    "mintConfig.transferHook",
    violations,
  )) {
    if (mint.transferHook.programId === null) {
      if (mint.status === "FROZEN") violations.push("mintConfig.transferHook.programId: FROZEN hook binding is missing");
    } else {
      validatePublicIdentity(mint.transferHook.programId, "mintConfig.transferHook.programId", true, violations);
      if (mint.transferHook.programId !== manifest.identities?.lawProgramId) {
        violations.push("mintConfig.transferHook.programId: must equal identities.lawProgramId");
      }
    }
    if (mint.transferHook.authorityAtCreation !== "CEREMONY_SIGNER" || mint.transferHook.authorityAfterLawInitialization !== null) {
      violations.push("mintConfig.transferHook: authority must be ceremony-only and null after atomic law initialization");
    }
  }
  if (exactKeys(
    mint.confidentialTransferMint,
    ["autoApproveNewAccounts", "auditorElGamalPubkey", "authorityAtCreation", "authorityAfterLawInitialization"],
    "mintConfig.confidentialTransferMint",
    violations,
  )) {
    const confidential = mint.confidentialTransferMint;
    if (confidential.autoApproveNewAccounts !== true || confidential.auditorElGamalPubkey !== null) {
      violations.push("mintConfig.confidentialTransferMint: requires auto-approval and no global auditor key");
    }
    if (confidential.authorityAtCreation !== "CEREMONY_SIGNER" || confidential.authorityAfterLawInitialization !== null) {
      violations.push("mintConfig.confidentialTransferMint: authority must be ceremony-only and null after atomic law initialization");
    }
  }
  if (mint.metadataPolicy === null) {
    if (mint.status === "FROZEN") violations.push("mintConfig.metadataPolicy: FROZEN metadata policy is missing");
  } else if (mint.metadataPolicy !== "NO_MINT_METADATA_EXTENSION_IMMUTABLE_EXTERNAL_RECORD") {
    violations.push("mintConfig.metadataPolicy: mint metadata extensions are outside the exact two-extension allowlist");
  }
}

function validateGenesis(manifest, blockers, violations) {
  const genesis = manifest.genesis;
  if (!exactKeys(genesis, ["status", "phaseOrder", "stagingPredicate", "activationPredicate", "blocker"], "genesis", violations)) return;
  validateStatus(genesis, "genesis", blockers, violations);
  if (!equalArray(genesis.phaseOrder, ["UNINITIALIZED", "GENESIS_STAGING", "ACTIVE"])) {
    violations.push("genesis.phaseOrder: activation must be a one-way Uninitialized -> GenesisStaging -> Active transition");
  }
  const staging = genesis.stagingPredicate;
  const stagingKeys = [
    "requiresPhase",
    "requiresProgramsImmutable",
    "canonicalAddressesOnly",
    "exactManifestAmountsOnly",
    "lawDecisionRequired",
    "allowedWrites",
    "forbiddenWrites",
  ];
  if (exactKeys(staging, stagingKeys, "genesis.stagingPredicate", violations)) {
    if (staging.requiresPhase !== "GENESIS_STAGING"
      || staging.requiresProgramsImmutable !== true
      || staging.canonicalAddressesOnly !== true
      || staging.exactManifestAmountsOnly !== true
      || staging.lawDecisionRequired !== false) {
      violations.push("genesis.stagingPredicate: staging must be immutable, canonical, exact-amount, and pre-law only");
    }
    if (!equalArray(staging.allowedWrites, ["CREATE_CANONICAL_ACCOUNT", "FUND_CANONICAL_VAULT"])) {
      violations.push("genesis.stagingPredicate.allowedWrites: only canonical creation and exact funding are allowed");
    }
    if (!equalArray(staging.forbiddenWrites, EXPECTED_FORBIDDEN_STAGING_WRITES)) {
      violations.push("genesis.stagingPredicate.forbiddenWrites: every release, reward, faction, position, eligibility, reservation, withdrawal, and claim write must be forbidden");
    }
  }
  const activation = genesis.activationPredicate;
  const activationKeys = [
    "oneWay",
    "requiresCurrentFinalizedOpenLaw",
    "requiresCanonicalAccountsExact",
    "requiresGenesisConservation",
    "requiresCoreCapCompliant",
    "requiresStakeIngressEnforced",
    "requiresFactionPolicySealed",
    "requiresMintAuthorityNull",
    "requiresFreezeAuthorityNull",
    "requiresTransferHookAuthorityNull",
    "requiresConfidentialTransferMintAuthorityNull",
    "disablesStagingWrites",
  ];
  if (exactKeys(activation, activationKeys, "genesis.activationPredicate", violations)) {
    for (const key of activationKeys) {
      if (activation[key] !== true) violations.push(`genesis.activationPredicate.${key}: must be true`);
    }
  }
}

function validateSealOrder(manifest, blockers, violations) {
  const seal = manifest.sealOrder;
  if (!exactKeys(seal, ["status", "steps", "blocker"], "sealOrder", violations)) return;
  validateStatus(seal, "sealOrder", blockers, violations);
  if (!equalArray(seal.steps, EXPECTED_SEAL_ORDER)) {
    violations.push("sealOrder.steps: unsafe order; programs must be byte-verified and immutable before mint creation, mint/freeze authorities must be revoked before atomic law sealing, and activation must be last");
  }
  if (Array.isArray(seal.steps) && new Set(seal.steps).size !== seal.steps.length) {
    violations.push("sealOrder.steps: duplicate ceremony step");
  }
}

export function validateIdentityFreezeManifest(manifest, options = {}) {
  const blockers = [];
  const violations = [];
  if (!exactKeys(manifest, TOP_LEVEL_KEYS, "manifest", violations)) {
    return {
      valid: false,
      identityFreezeReady: false,
      productionIdentityReady: false,
      productionCombinedArtifactBindingReady: false,
      ownerPolicyBindingVerified: false,
      ownerPolicyExternalTruthVerified: false,
      combinedArtifactBuildEnvironment: null,
      blockers,
      violations,
    };
  }
  if (manifest.$schema !== "./iat-b3-identity-freeze.v1.schema.json") violations.push("manifest.$schema: unexpected schema path");
  if (manifest.schema !== "iat-b3-identity-freeze/v1") violations.push("manifest.schema: unsupported schema version");
  if (manifest.profile !== "PRODUCTION" && manifest.profile !== "TEST_FIXTURE") violations.push("manifest.profile: expected PRODUCTION or TEST_FIXTURE");
  if (manifest.profile === "TEST_FIXTURE" && options.allowTestFixture !== true) {
    violations.push("manifest.profile: TEST_FIXTURE requires explicit allowTestFixture and never satisfies production identity readiness");
  }
  if (manifest.readiness !== "BLOCKED" && manifest.readiness !== "READY") violations.push("manifest.readiness: expected BLOCKED or READY");

  validateScope(manifest, violations);
  const ownerPolicy = validateOwnerPolicyBinding(manifest, options, blockers, violations);
  validateIdentities(manifest, blockers, violations);
  validateCombinedArtifactBinding(manifest, blockers, violations);
  rejectFixtureIdentityRelabel(manifest, options, violations);
  validateClusterAndNetwork(manifest, blockers, violations);
  validateEntropy(manifest, blockers, violations);
  validateSeedTable(manifest, blockers, violations);
  validateFactionPolicy(manifest, blockers, violations);
  validateMintConfig(manifest, blockers, violations);
  validateGenesis(manifest, blockers, violations);
  validateSealOrder(manifest, blockers, violations);

  const valid = violations.length === 0;
  const computedIdentityFreezeReady = valid
    && blockers.length === 0
    && (manifest.profile === "TEST_FIXTURE"
      || (ownerPolicy.ownerPolicyBindingVerified === true
        && ownerPolicy.ownerPolicyExternalTruthVerified === true));
  if (manifest.readiness === "READY" && !computedIdentityFreezeReady) {
    violations.push("manifest.readiness: READY contradicts unresolved or invalid fields");
  } else if (manifest.readiness === "BLOCKED" && computedIdentityFreezeReady) {
    violations.push("manifest.readiness: BLOCKED contradicts a complete frozen manifest");
  }
  const identityFreezeReady = violations.length === 0
    && blockers.length === 0
    && manifest.readiness === "READY";
  const productionIdentityReady = identityFreezeReady && manifest.profile === "PRODUCTION";
  const productionCombinedArtifactBindingReady = productionIdentityReady
    && manifest.combinedArtifactBinding.status === "FROZEN";
  const combinedArtifactBuildEnvironment = productionCombinedArtifactBindingReady
    ? Object.fromEntries(PRODUCTION_COMBINED_ARTIFACT_INPUT_SPECS.map((input) => [
      input.environmentVariable,
      manifest.identities[input.identityField],
    ]))
    : null;
  return {
    valid: violations.length === 0,
    identityFreezeReady,
    productionIdentityReady,
    productionCombinedArtifactBindingReady,
    ownerPolicyBindingVerified: ownerPolicy.ownerPolicyBindingVerified,
    ownerPolicyExternalTruthVerified: ownerPolicy.ownerPolicyExternalTruthVerified,
    combinedArtifactBuildEnvironment,
    blockers,
    violations,
  };
}

export function assertIdentityFreezeReady(manifest, options = {}) {
  const result = validateIdentityFreezeManifest(manifest, options);
  if (!result.identityFreezeReady) {
    const reasons = [...result.violations, ...result.blockers];
    throw new Error(`IAT B3 identity freeze is not ready:\n- ${reasons.join("\n- ")}`);
  }
  return result;
}

export function assertProductionCombinedArtifactBindingReady(manifest, options = {}) {
  const result = validateIdentityFreezeManifest(manifest, options);
  if (!result.productionCombinedArtifactBindingReady) {
    const reasons = [...result.violations, ...result.blockers];
    throw new Error(`IAT B3 production combined-artifact binding is not ready:\n- ${reasons.join("\n- ")}`);
  }
  return result;
}

export function loadIdentityFreezeManifest(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function parseCliArgs(argv) {
  let manifestPath = resolve(fileURLToPath(new URL("../docs/b3/iat-b3-identity-freeze.v1.json", import.meta.url)));
  let allowTestFixture = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--manifest" && argv[index + 1]) {
      manifestPath = resolve(argv[index + 1]);
      index += 1;
    } else if (argument === "--allow-test-fixture") {
      allowTestFixture = true;
    } else {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
  }
  return { manifestPath, allowTestFixture };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    const { manifestPath, allowTestFixture } = parseCliArgs(process.argv.slice(2));
    const ownerPolicyPath = resolve(fileURLToPath(new URL(
      "../docs/b3/iat-b3-owner-policy-freeze.v1.json",
      import.meta.url,
    )));
    const result = validateIdentityFreezeManifest(loadIdentityFreezeManifest(manifestPath), {
      allowTestFixture,
      ownerPolicyBytes: allowTestFixture ? undefined : readFileSync(ownerPolicyPath),
    });
    console.log(JSON.stringify({ manifestPath, ...result }, null, 2));
    if (!result.identityFreezeReady) process.exitCode = 2;
  } catch (error) {
    console.error(`IAT B3 identity-freeze validation failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

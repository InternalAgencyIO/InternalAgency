#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import {
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  statfsSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  COMBINED_LAW_BUILD_DISK_BUDGET,
  COMBINED_LAW_LFS_POLICY,
  COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA,
  COMBINED_LAW_SUBMODULE_POLICY,
  PINNED_COMBINED_LAW_BUILD_CONTAINER,
  PINNED_DOCKER_COMMAND_PURPOSE,
  assertExactCleanSourceSequence,
  assertCleanSourceObservation,
  assertExactMaterializedSourceSequence,
  assertPinnedContainerObservation,
  assertPinnedToolchainObservation,
  createExactSourceBuildRoot,
  createNativeSourceReceiptBinding,
  executePinnedDocker,
  loadExactDeclaredHeadSource,
  observeExactSource,
  observeMaterializedSourceSnapshot,
  readExactCommittedFile as readSharedExactCommittedFile,
  removeExactSourceBuildRoot,
} from "./run-iat-b3-combined-law-reproducible-build.mjs";
import {
  PRODUCTION_OWNER_POLICY_BINDING,
  assertProductionCombinedArtifactBindingReady,
  isCanonicalBase58Key,
  parseIdentityFreezeJson,
} from "./validate-iat-b3-identity-freeze.mjs";
import {
  NATIVE_WSL_BUILD_BACKEND,
  assertNativeWslObservationOnlyBuildDisabled,
  createNativeWslBuildPreflight,
  createNativeWslBuildReceipt,
  executeNativeWslFreshBuild,
  observeNativeWslPinnedToolchain,
  selectReproducibleBuildBackend,
  validateNativeWslBuildReceipt,
  verifyNativeCargoLockArchiveClosure,
} from "./iat-b3-native-wsl-build-backend.mjs";

export const ECONOMY_BUILD_PREFLIGHT_SCHEMA =
  "iat-b3-economy-exact-source-build-preflight/v2";
export const ECONOMY_BUILD_PREFLIGHT_READY = "READY_TO_EXECUTE_DUAL_BUILD";
export const ECONOMY_BUILD_PREFLIGHT_HOLD = "HOLD";
export const ECONOMY_BUILD_RECEIPT_SCHEMA =
  "iat-b3-economy-exact-source-dual-sbf-build/v2";
export const ECONOMY_BUILD_RECEIPT_STATUS =
  "EXACT_SOURCE_DUAL_FRESH_SBF_BYTE_EQUALITY_VERIFIED";
export const ECONOMY_BUILD_MAINNET_STATUS = "HOLD";
export const ECONOMY_PRODUCTION_FEATURE = "runtime-production-entrypoint";
export const ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE = "sbf-preflight-entrypoint";

export const ECONOMY_BUILD_INPUT_SPECS = Object.freeze([
  Object.freeze({
    environmentVariable: "IAT_B3_PRODUCTION_LAW_PROGRAM_ID",
    manifestPath: "identities.lawProgramId",
  }),
  Object.freeze({
    environmentVariable: "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID",
    manifestPath: "identities.economyProgramId",
  }),
  Object.freeze({
    environmentVariable: "IAT_B3_PRODUCTION_CANONICAL_MINT",
    manifestPath: "identities.canonicalMint",
  }),
  Object.freeze({
    environmentVariable: "IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH",
    manifestPath: "networkBinding.genesisHash",
  }),
]);

export const ECONOMY_SBF_BUILD_RECIPE = Object.freeze({
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
    "projects/star-ascent/site/programs/iat_b3_economy/Cargo.toml",
    "--sbf-out-dir",
    "<FRESH_OUTPUT_DIRECTORY>",
    "--arch",
    "v0",
    "--no-default-features",
    "--features",
    ECONOMY_PRODUCTION_FEATURE,
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
  outputFileName: "iat_b3_economy.so",
  repetitions: 2,
  requiresIdenticalSha256: true,
  requiresIdenticalByteLength: true,
  requiresDistinctBuildLogs: true,
  publicNetworkWrites: false,
  signing: false,
  deployment: false,
});

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const RUNNER_PATH = fileURLToPath(import.meta.url);
const RUNNER_REPOSITORY_PATH =
  "projects/star-ascent/site/scripts/run-iat-b3-economy-reproducible-build.mjs";
const CARGO_LOCK_REPOSITORY_PATH = "projects/star-ascent/site/Cargo.lock";
const IDENTITY_REPOSITORY_PATH =
  "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json";
const OWNER_POLICY_REPOSITORY_PATH = PRODUCTION_OWNER_POLICY_BINDING.packetPath;
const ECONOMY_MANIFEST_REPOSITORY_PATH =
  "projects/star-ascent/site/programs/iat_b3_economy/Cargo.toml";
const ECONOMY_LIB_REPOSITORY_PATH =
  "projects/star-ascent/site/programs/iat_b3_economy/src/lib.rs";
const ECONOMY_ENTRYPOINT_REPOSITORY_PATH =
  "projects/star-ascent/site/programs/iat_b3_economy/src/production_entrypoint.rs";
const ECONOMY_BUILD_RS_REPOSITORY_PATH =
  "projects/star-ascent/site/programs/iat_b3_economy/build.rs";
const ECONOMY_SOURCE_CLOSURE_PATHS = Object.freeze([
  ECONOMY_MANIFEST_REPOSITORY_PATH,
  ECONOMY_LIB_REPOSITORY_PATH,
  ECONOMY_ENTRYPOINT_REPOSITORY_PATH,
  ECONOMY_BUILD_RS_REPOSITORY_PATH,
]);
const ECONOMY_BUILD_ROOT_PREFIX = "iat-b3-economy-sbf-";
const ECONOMY_CONTAINER_BUILD_ROOT = "/iat-economy-build";
const REQUIRED_ENVIRONMENT_NAMES = Object.freeze(
  ECONOMY_BUILD_INPUT_SPECS.map(({ environmentVariable }) => environmentVariable),
);
const HEX_SHA1 = /^[0-9a-f]{40}$/u;
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const UNSAFE_COMPILER_DIAGNOSTIC =
  /Stack offset of|stack frame of [0-9]+ bytes exceeds|max offset exceeded|overwrites values|undefined behavior/iu;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function digestRecord(value) {
  return sha256(canonicalJson(value));
}

function freezeResult(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) freezeResult(child);
  }
  return Object.freeze(value);
}

function exactKeys(value, expected) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());
}

function isCanonicalTimestamp(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function assertHex(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`IAT_B3_ECONOMY_${label}_INVALID`);
  }
  return value;
}

function isWithin(parent, candidate) {
  const path = relative(parent, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function nodeVersionSupported(value) {
  const match = typeof value === "string" ? value.match(/^v?(\d+)\.(\d+)\.(\d+)$/u) : null;
  if (!match) return false;
  const observed = match.slice(1).map(Number);
  const minimum = [22, 13, 0];
  for (let index = 0; index < minimum.length; index += 1) {
    if (observed[index] > minimum[index]) return true;
    if (observed[index] < minimum[index]) return false;
  }
  return true;
}

function readCommittedFile(repositoryRoot, headSha, relativePath) {
  assertHex(headSha, HEX_SHA1, "COMMITTED_HEAD");
  if (!ECONOMY_SOURCE_CLOSURE_PATHS.includes(relativePath)
    && ![
      RUNNER_REPOSITORY_PATH,
      IDENTITY_REPOSITORY_PATH,
      OWNER_POLICY_REPOSITORY_PATH,
      CARGO_LOCK_REPOSITORY_PATH,
    ].includes(relativePath)) {
    throw new Error("IAT_B3_ECONOMY_COMMITTED_SOURCE_PATH_NOT_ALLOWLISTED");
  }
  return readSharedExactCommittedFile(repositoryRoot, headSha, relativePath);
}

function statusEntryCount(statusPorcelain) {
  return typeof statusPorcelain === "string"
    ? statusPorcelain.split("\0").filter(Boolean).length
    : null;
}

export function assertEconomyBuildRecipe(recipe = ECONOMY_SBF_BUILD_RECIPE) {
  if (canonicalJson(recipe) !== canonicalJson(ECONOMY_SBF_BUILD_RECIPE)) {
    throw new Error("IAT_B3_ECONOMY_BUILD_RECIPE_DRIFT_HOLD");
  }
  const featureIndex = recipe.arguments.indexOf("--features");
  if (featureIndex < 0
    || recipe.arguments[featureIndex + 1] !== ECONOMY_PRODUCTION_FEATURE
    || recipe.arguments.includes(ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE)
    || recipe.arguments.filter((value) => value === "--features").length !== 1) {
    throw new Error("IAT_B3_ECONOMY_PRODUCTION_FEATURE_EXCLUSIVITY_HOLD");
  }
  return recipe;
}

export function inspectEconomyProductionSourceClosure({
  cargoManifestSource,
  librarySource,
  entrypointSource,
  buildScriptSource,
} = {}) {
  if ([cargoManifestSource, librarySource, entrypointSource, buildScriptSource]
    .some((value) => typeof value !== "string" || value.length === 0)) {
    throw new Error("IAT_B3_ECONOMY_SOURCE_CLOSURE_INPUT_REQUIRED");
  }
  const productionFeature = cargoManifestSource.match(
    /^runtime-production-entrypoint\s*=\s*\[([\s\S]*?)^\]/mu,
  );
  const preflightFeature = cargoManifestSource.match(
    /^sbf-preflight-entrypoint\s*=\s*\[([\s\S]*?)^\]/mu,
  );
  const checks = Object.freeze({
    productionFeatureDeclared: productionFeature !== null,
    productionFeatureDoesNotEnablePreflight:
      productionFeature !== null
      && !productionFeature[1].includes(ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE),
    preflightFeatureSeparate: preflightFeature !== null,
    libraryProductionModuleGated:
      /#\[cfg\(feature = "runtime-production-entrypoint"\)\]\s*pub mod production_entrypoint;/u
        .test(librarySource),
    mutualEntrypointCompileError:
      /feature = "sbf-preflight-entrypoint"[\s\S]*feature = "runtime-production-entrypoint"[\s\S]*compile_error!\([\s\S]*cannot expose the same SBF artifact/u
        .test(librarySource),
    productionEntrypointMacroGated:
      /#\[cfg\(not\(feature = "no-entrypoint"\)\)\]\s*solana_program_entrypoint::entrypoint!\(process_instruction\);/u
        .test(entrypointSource),
    buildScriptRequiresProductionFeature:
      buildScriptSource.includes("CARGO_FEATURE_RUNTIME_PRODUCTION_ENTRYPOINT"),
    buildScriptRequiresAllFourInputs: REQUIRED_ENVIRONMENT_NAMES.every(
      (name) => buildScriptSource.includes(name),
    ),
    recipeUsesProductionFeatureOnly: (() => {
      try {
        assertEconomyBuildRecipe();
        return true;
      } catch {
        return false;
      }
    })(),
  });
  if (!Object.values(checks).every(Boolean)) {
    throw new Error("IAT_B3_ECONOMY_PRODUCTION_SOURCE_CLOSURE_HOLD");
  }
  const sources = Object.freeze({
    cargoManifestSha256: sha256(cargoManifestSource),
    librarySha256: sha256(librarySource),
    entrypointSha256: sha256(entrypointSource),
    buildScriptSha256: sha256(buildScriptSource),
  });
  return freezeResult({
    productionFeature: ECONOMY_PRODUCTION_FEATURE,
    forbiddenFeature: ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE,
    checks,
    sources,
    bindingSha256: digestRecord({ checks, sources, recipe: ECONOMY_SBF_BUILD_RECIPE }),
  });
}

export function deriveEconomyProductionBuildEnvironment(manifest, validation) {
  if (validation?.productionCombinedArtifactBindingReady !== true
    || validation.combinedArtifactBuildEnvironment === null
    || !isCanonicalBase58Key(manifest?.networkBinding?.genesisHash)) {
    throw new Error("IAT_B3_ECONOMY_PRODUCTION_IDENTITY_ENVIRONMENT_HOLD");
  }
  const environment = {
    ...validation.combinedArtifactBuildEnvironment,
    IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH: manifest.networkBinding.genesisHash,
  };
  if (canonicalJson(Object.keys(environment).sort())
    !== canonicalJson([...REQUIRED_ENVIRONMENT_NAMES].sort())
    || new Set(Object.values(environment)).size !== 4
    || !Object.values(environment).every(isCanonicalBase58Key)) {
    throw new Error("IAT_B3_ECONOMY_PRODUCTION_IDENTITY_SET_INVALID");
  }
  return Object.freeze(environment);
}

export function assertEconomyIdentityAndOwnerPolicyBytes({
  identityManifestBytes,
  ownerPolicyBytes,
} = {}) {
  if (!Buffer.isBuffer(identityManifestBytes) || identityManifestBytes.length === 0
    || !Buffer.isBuffer(ownerPolicyBytes) || ownerPolicyBytes.length === 0) {
    throw new Error("IAT_B3_ECONOMY_IDENTITY_AND_OWNER_POLICY_BYTES_REQUIRED");
  }
  const manifest = parseIdentityFreezeJson(
    identityManifestBytes.toString("utf8"),
    IDENTITY_REPOSITORY_PATH,
  );
  const validation = assertProductionCombinedArtifactBindingReady(manifest, {
    ownerPolicyBytes,
  });
  const environment = deriveEconomyProductionBuildEnvironment(manifest, validation);
  return freezeResult({
    environment,
    receiptBinding: {
      manifestPath: IDENTITY_REPOSITORY_PATH,
      manifestSha256: sha256(identityManifestBytes),
      ownerPolicyPath: OWNER_POLICY_REPOSITORY_PATH,
      ownerPolicySha256: sha256(ownerPolicyBytes),
      environmentNames: [...REQUIRED_ENVIRONMENT_NAMES],
      environmentBindingSha256: digestRecord(environment),
      canonicalManifestReady: true,
    },
  });
}

function emptyIdentityObservation(failure = null) {
  return Object.freeze({
    ready: false,
    manifestSha256: null,
    ownerPolicySha256: null,
    environmentBindingSha256: null,
    failure,
  });
}

function observeCommittedIdentity(repositoryRoot, headSha) {
  try {
    const identityBytes = readCommittedFile(repositoryRoot, headSha, IDENTITY_REPOSITORY_PATH);
    const ownerPolicyBytes = readCommittedFile(
      repositoryRoot,
      headSha,
      OWNER_POLICY_REPOSITORY_PATH,
    );
    const binding = assertEconomyIdentityAndOwnerPolicyBytes({
      identityManifestBytes: identityBytes,
      ownerPolicyBytes,
    });
    return Object.freeze({
      ready: true,
      manifestSha256: binding.receiptBinding.manifestSha256,
      ownerPolicySha256: binding.receiptBinding.ownerPolicySha256,
      environmentBindingSha256: binding.receiptBinding.environmentBindingSha256,
      failure: null,
    });
  } catch (error) {
    return emptyIdentityObservation(error instanceof Error ? error.message.slice(0, 512) : String(error));
  }
}

function observeCommittedSourceClosure(repositoryRoot, headSha) {
  try {
    return Object.freeze({
      ready: true,
      result: inspectEconomyProductionSourceClosure({
        cargoManifestSource:
          readCommittedFile(repositoryRoot, headSha, ECONOMY_MANIFEST_REPOSITORY_PATH)
            .toString("utf8"),
        librarySource:
          readCommittedFile(repositoryRoot, headSha, ECONOMY_LIB_REPOSITORY_PATH)
            .toString("utf8"),
        entrypointSource:
          readCommittedFile(repositoryRoot, headSha, ECONOMY_ENTRYPOINT_REPOSITORY_PATH)
            .toString("utf8"),
        buildScriptSource:
          readCommittedFile(repositoryRoot, headSha, ECONOMY_BUILD_RS_REPOSITORY_PATH)
            .toString("utf8"),
      }),
      failure: null,
    });
  } catch (error) {
    return Object.freeze({
      ready: false,
      result: null,
      failure: error instanceof Error ? error.message.slice(0, 512) : String(error),
    });
  }
}

function observeContainerAndToolchain() {
  try {
    const platform = executePinnedDocker([
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "image",
      "inspect",
      "--format={{.Os}}/{{.Architecture}}",
      PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference,
    ], { purpose: PINNED_DOCKER_COMMAND_PURPOSE.imagePlatformInspect }).stdout.trim();
    const localImageId = executePinnedDocker([
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "image",
      "inspect",
      "--format={{.Id}}",
      PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference,
    ], { purpose: PINNED_DOCKER_COMMAND_PURPOSE.imageIdInspect }).stdout.trim();
    const container = assertPinnedContainerObservation({
      ...PINNED_COMBINED_LAW_BUILD_CONTAINER,
      platform,
      localImageId,
    });
    const common = (entrypoint) => [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "run",
      "--rm",
      "--pull=never",
      "--network=none",
      "--platform=linux/amd64",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      `--entrypoint=${entrypoint}`,
      PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference,
    ];
    const toolchain = assertPinnedToolchainObservation({
      rustc: executePinnedDocker([...common("rustc"), "--version"], {
        purpose: PINNED_DOCKER_COMMAND_PURPOSE.toolchainRustc,
      }).stdout.trim(),
      cargo: executePinnedDocker([...common("cargo"), "--version"], {
        purpose: PINNED_DOCKER_COMMAND_PURPOSE.toolchainCargo,
      }).stdout.trim(),
      cargoBuildSbf: executePinnedDocker(
        [...common("cargo"), "build-sbf", "--version"],
        { purpose: PINNED_DOCKER_COMMAND_PURPOSE.toolchainCargoBuildSbf },
      ).stdout.trim(),
    });
    return Object.freeze({ container, toolchain, failure: null });
  } catch (error) {
    return Object.freeze({
      container: null,
      toolchain: null,
      failure: error instanceof Error ? error.message.slice(0, 512) : String(error),
    });
  }
}

function preflightCheck(id, passed) {
  return Object.freeze({ id, passed: passed === true });
}

function preflightIdentityReady(observation) {
  return exactKeys(observation, [
    "ready",
    "manifestSha256",
    "ownerPolicySha256",
    "environmentBindingSha256",
    "failure",
  ])
    && observation.ready === true
    && HEX_SHA256.test(observation.manifestSha256 ?? "")
    && HEX_SHA256.test(observation.ownerPolicySha256 ?? "")
    && HEX_SHA256.test(observation.environmentBindingSha256 ?? "")
    && observation.failure === null;
}

function preflightSourceClosureReady(observation) {
  if (observation?.ready !== true || observation.failure !== null) return false;
  try {
    validateSourceClosureRecord(observation.result);
    return true;
  } catch {
    return false;
  }
}

function preflightContainerReady(observation) {
  try {
    assertPinnedContainerObservation(observation);
    return true;
  } catch {
    return false;
  }
}

function preflightToolchainReady(observation) {
  try {
    assertPinnedToolchainObservation(observation);
    return true;
  } catch {
    return false;
  }
}

export function createEconomyBuildPreflight({
  generatedAt,
  declaredHeadSha,
  sourceObservation,
  executedRunnerSha256,
  committedRunnerSha256,
  nodeVersion,
  hostPlatform,
  hostArchitecture,
  identityObservation,
  sourceClosureObservation,
  containerObservation,
  toolchainObservation,
  diskPath,
  diskFreeBytes,
} = {}) {
  const cleanSource = sourceObservation?.statusPorcelain === "";
  const checks = Object.freeze([
    preflightCheck("CANONICAL_GENERATED_AT", isCanonicalTimestamp(generatedAt)),
    preflightCheck("EXACT_SOURCE_HEAD_DECLARED", HEX_SHA1.test(declaredHeadSha ?? "")),
    preflightCheck(
      "EXACT_SOURCE_OBSERVED",
      HEX_SHA1.test(sourceObservation?.headSha ?? "")
        && HEX_SHA1.test(sourceObservation?.treeSha ?? ""),
    ),
    preflightCheck(
      "EXACT_SOURCE_HEAD_MATCH",
      sourceObservation?.headSha === declaredHeadSha,
    ),
    preflightCheck("REPOSITORY_CLEAN_TRACKED_AND_NONIGNORED_UNTRACKED", cleanSource),
    preflightCheck(
      "EXECUTED_RUNNER_MATCHES_DECLARED_HEAD",
      HEX_SHA256.test(executedRunnerSha256 ?? "")
        && executedRunnerSha256 === committedRunnerSha256,
    ),
    preflightCheck("LINUX_AMD64_HOST", hostPlatform === "linux" && hostArchitecture === "x64"),
    preflightCheck("HOST_NODE_AT_LEAST_22_13_0", nodeVersionSupported(nodeVersion)),
    preflightCheck(
      "PRODUCTION_FOUR_INPUT_IDENTITY_BINDING",
      preflightIdentityReady(identityObservation),
    ),
    preflightCheck(
      "PRODUCTION_FEATURE_SOURCE_CLOSURE",
      preflightSourceClosureReady(sourceClosureObservation),
    ),
    preflightCheck("PINNED_CONTAINER_PRESENT", preflightContainerReady(containerObservation)),
    preflightCheck(
      "PINNED_CONTAINER_TOOLCHAIN",
      preflightToolchainReady(toolchainObservation),
    ),
    preflightCheck(
      "BUILD_VOLUME_MINIMUM_24_GIB_FREE",
      Number.isSafeInteger(diskFreeBytes)
        && diskFreeBytes >= COMBINED_LAW_BUILD_DISK_BUDGET.minimumFreeBytes,
    ),
    preflightCheck("FROZEN_PRODUCTION_ECONOMY_BUILD_RECIPE", (() => {
      try {
        assertEconomyBuildRecipe();
        return true;
      } catch {
        return false;
      }
    })()),
  ]);
  const blockers = Object.freeze(checks.filter(({ passed }) => !passed).map(({ id }) => id));
  const ready = blockers.length === 0;
  const core = {
    schema: ECONOMY_BUILD_PREFLIGHT_SCHEMA,
    status: ready ? ECONOMY_BUILD_PREFLIGHT_READY : ECONOMY_BUILD_PREFLIGHT_HOLD,
    exitCode: ready ? 0 : 2,
    generatedAt,
    buildExecuted: false,
    source: {
      declaredHeadSha: declaredHeadSha ?? null,
      observedHeadSha: sourceObservation?.headSha ?? null,
      observedTreeSha: sourceObservation?.treeSha ?? null,
      repositoryCleanTrackedAndNonignoredUntracked: cleanSource,
      dirtyStatusEntryCount: statusEntryCount(sourceObservation?.statusPorcelain),
      statusPorcelainSha256: typeof sourceObservation?.statusPorcelain === "string"
        ? sha256(sourceObservation.statusPorcelain)
        : null,
    },
    tooling: {
      executedRunnerSha256: executedRunnerSha256 ?? null,
      committedRunnerSha256: committedRunnerSha256 ?? null,
      executedRunnerMatchesDeclaredHead:
        executedRunnerSha256 !== null && executedRunnerSha256 === committedRunnerSha256,
      hostNodeMinimumVersion: "22.13.0",
      observedNodeVersion: nodeVersion ?? null,
      observedNodeSupported: nodeVersionSupported(nodeVersion),
    },
    host: {
      requiredPlatform: "linux",
      requiredArchitecture: "x64",
      observedPlatform: hostPlatform ?? null,
      observedArchitecture: hostArchitecture ?? null,
    },
    identityBinding: identityObservation ?? emptyIdentityObservation(),
    sourceClosure: {
      ready: sourceClosureObservation?.ready === true,
      result: sourceClosureObservation?.result ?? null,
      failure: sourceClosureObservation?.failure ?? null,
    },
    container: containerObservation,
    toolchain: toolchainObservation,
    disk: {
      path: diskPath ?? null,
      observedFreeBytes: diskFreeBytes ?? null,
      ...COMBINED_LAW_BUILD_DISK_BUDGET,
    },
    recipe: ECONOMY_SBF_BUILD_RECIPE,
    checks,
    blockers,
    safety: {
      sourceOnlyObservation: true,
      artifactCreated: false,
      keyGenerated: false,
      rpcUsed: false,
      networkUsed: false,
      signing: false,
      deployment: false,
      reproducibleBuildVerified: false,
      mainnetStatus: ECONOMY_BUILD_MAINNET_STATUS,
    },
  };
  return validateEconomyBuildPreflight(
    freezeResult({ ...core, preflightSha256: digestRecord(core) }),
  );
}

export function validateEconomyBuildPreflight(preflight) {
  if (!preflight
    || preflight.schema !== ECONOMY_BUILD_PREFLIGHT_SCHEMA
    || !Array.isArray(preflight.checks)
    || !Array.isArray(preflight.blockers)
    || preflight.buildExecuted !== false
    || preflight.safety?.artifactCreated !== false
    || preflight.safety?.keyGenerated !== false
    || preflight.safety?.rpcUsed !== false
    || preflight.safety?.networkUsed !== false
    || preflight.safety?.signing !== false
    || preflight.safety?.deployment !== false
    || preflight.safety?.mainnetStatus !== ECONOMY_BUILD_MAINNET_STATUS
    || canonicalJson(preflight.recipe) !== canonicalJson(ECONOMY_SBF_BUILD_RECIPE)) {
    throw new Error("INVALID_IAT_B3_ECONOMY_BUILD_PREFLIGHT");
  }
  const blockers = preflight.checks.filter(({ passed }) => !passed).map(({ id }) => id);
  const expectedChecks = [
    preflightCheck("CANONICAL_GENERATED_AT", isCanonicalTimestamp(preflight.generatedAt)),
    preflightCheck(
      "EXACT_SOURCE_HEAD_DECLARED",
      HEX_SHA1.test(preflight.source?.declaredHeadSha ?? ""),
    ),
    preflightCheck(
      "EXACT_SOURCE_OBSERVED",
      HEX_SHA1.test(preflight.source?.observedHeadSha ?? "")
        && HEX_SHA1.test(preflight.source?.observedTreeSha ?? ""),
    ),
    preflightCheck(
      "EXACT_SOURCE_HEAD_MATCH",
      preflight.source?.declaredHeadSha === preflight.source?.observedHeadSha,
    ),
    preflightCheck(
      "REPOSITORY_CLEAN_TRACKED_AND_NONIGNORED_UNTRACKED",
      preflight.source?.repositoryCleanTrackedAndNonignoredUntracked === true
        && preflight.source?.dirtyStatusEntryCount === 0
        && preflight.source?.statusPorcelainSha256 === sha256(""),
    ),
    preflightCheck(
      "EXECUTED_RUNNER_MATCHES_DECLARED_HEAD",
      HEX_SHA256.test(preflight.tooling?.executedRunnerSha256 ?? "")
        && preflight.tooling?.executedRunnerSha256
          === preflight.tooling?.committedRunnerSha256
        && preflight.tooling?.executedRunnerMatchesDeclaredHead === true,
    ),
    preflightCheck(
      "LINUX_AMD64_HOST",
      preflight.host?.requiredPlatform === "linux"
        && preflight.host?.requiredArchitecture === "x64"
        && preflight.host?.observedPlatform === "linux"
        && preflight.host?.observedArchitecture === "x64",
    ),
    preflightCheck(
      "HOST_NODE_AT_LEAST_22_13_0",
      preflight.tooling?.hostNodeMinimumVersion === "22.13.0"
        && nodeVersionSupported(preflight.tooling?.observedNodeVersion)
        && preflight.tooling?.observedNodeSupported === true,
    ),
    preflightCheck(
      "PRODUCTION_FOUR_INPUT_IDENTITY_BINDING",
      preflightIdentityReady(preflight.identityBinding),
    ),
    preflightCheck(
      "PRODUCTION_FEATURE_SOURCE_CLOSURE",
      preflightSourceClosureReady(preflight.sourceClosure),
    ),
    preflightCheck("PINNED_CONTAINER_PRESENT", preflightContainerReady(preflight.container)),
    preflightCheck(
      "PINNED_CONTAINER_TOOLCHAIN",
      preflightToolchainReady(preflight.toolchain),
    ),
    preflightCheck(
      "BUILD_VOLUME_MINIMUM_24_GIB_FREE",
      Number.isSafeInteger(preflight.disk?.observedFreeBytes)
        && preflight.disk.observedFreeBytes >= COMBINED_LAW_BUILD_DISK_BUDGET.minimumFreeBytes
        && preflight.disk.minimumFreeBytes === COMBINED_LAW_BUILD_DISK_BUDGET.minimumFreeBytes
        && preflight.disk.containerImageAlreadyPresentRequired === true
        && preflight.disk.containerImageBytesIncluded === false,
    ),
    preflightCheck("FROZEN_PRODUCTION_ECONOMY_BUILD_RECIPE", (() => {
      try {
        assertEconomyBuildRecipe(preflight.recipe);
        return true;
      } catch {
        return false;
      }
    })()),
  ];
  if (canonicalJson(preflight.checks) !== canonicalJson(expectedChecks)) {
    throw new Error("IAT_B3_ECONOMY_BUILD_PREFLIGHT_CHECK_SET_MISMATCH");
  }
  if (canonicalJson(blockers) !== canonicalJson(preflight.blockers)) {
    throw new Error("IAT_B3_ECONOMY_BUILD_PREFLIGHT_BLOCKER_SET_MISMATCH");
  }
  const ready = blockers.length === 0;
  if (preflight.status !== (ready ? ECONOMY_BUILD_PREFLIGHT_READY : ECONOMY_BUILD_PREFLIGHT_HOLD)
    || preflight.exitCode !== (ready ? 0 : 2)) {
    throw new Error("IAT_B3_ECONOMY_BUILD_PREFLIGHT_STATUS_MISMATCH");
  }
  const { preflightSha256, ...core } = preflight;
  if (!HEX_SHA256.test(preflightSha256 ?? "") || preflightSha256 !== digestRecord(core)) {
    throw new Error("IAT_B3_ECONOMY_BUILD_PREFLIGHT_DIGEST_MISMATCH");
  }
  return preflight;
}

export function observeEconomyBuildPreflight({
  repositoryRoot = REPOSITORY_ROOT,
  environment = process.env,
  generatedAt = new Date().toISOString(),
  hostPlatform = process.platform,
  hostArchitecture = process.arch,
  nodeVersion = process.versions.node,
  probeContainer = true,
} = {}) {
  let sourceObservation = null;
  try {
    sourceObservation = observeExactSource(repositoryRoot);
  } catch {
    sourceObservation = null;
  }
  const declaredHeadSha = environment?.IAT_B3_EXACT_SOURCE_HEAD_SHA ?? null;
  const observedHeadSha = sourceObservation?.headSha ?? null;
  let committedRunnerSha256 = null;
  if (HEX_SHA1.test(observedHeadSha ?? "")) {
    try {
      committedRunnerSha256 = sha256(
        readCommittedFile(repositoryRoot, observedHeadSha, RUNNER_REPOSITORY_PATH),
      );
    } catch {
      committedRunnerSha256 = null;
    }
  }
  const identityObservation = HEX_SHA1.test(observedHeadSha ?? "")
    ? observeCommittedIdentity(repositoryRoot, observedHeadSha)
    : emptyIdentityObservation("HEAD_UNAVAILABLE");
  const sourceClosureObservation = HEX_SHA1.test(observedHeadSha ?? "")
    ? observeCommittedSourceClosure(repositoryRoot, observedHeadSha)
    : Object.freeze({ ready: false, result: null, failure: "HEAD_UNAVAILABLE" });
  const pinned = probeContainer
    ? observeContainerAndToolchain()
    : Object.freeze({ container: null, toolchain: null, failure: "PROBE_DISABLED" });
  const diskPath = realpathSync(tmpdir());
  const fileSystem = statfsSync(diskPath);
  return createEconomyBuildPreflight({
    generatedAt,
    declaredHeadSha,
    sourceObservation,
    executedRunnerSha256: sha256(readFileSync(RUNNER_PATH)),
    committedRunnerSha256,
    nodeVersion,
    hostPlatform,
    hostArchitecture,
    identityObservation,
    sourceClosureObservation,
    containerObservation: pinned.container,
    toolchainObservation: pinned.toolchain,
    diskPath,
    diskFreeBytes: fileSystem.bavail * fileSystem.bsize,
  });
}

export function observeEconomyNativeWslBuildPreflight({
  repositoryRoot = REPOSITORY_ROOT,
  environment = process.env,
  generatedAt = new Date().toISOString(),
  probeNative = true,
} = {}) {
  const base = observeEconomyBuildPreflight({
    repositoryRoot,
    environment,
    generatedAt,
    probeContainer: false,
  });
  let toolchainObservation = null;
  let dependencyClosure = null;
  if (probeNative === true && process.platform === "linux" && process.arch === "x64") {
    try {
      toolchainObservation = observeNativeWslPinnedToolchain();
    } catch {
      toolchainObservation = null;
    }
    try {
      dependencyClosure = verifyNativeCargoLockArchiveClosure(
        readCommittedFile(
          repositoryRoot,
          base.source.observedHeadSha,
          CARGO_LOCK_REPOSITORY_PATH,
        ),
      );
    } catch {
      dependencyClosure = null;
    }
  }
  return createNativeWslBuildPreflight({
    generatedAt,
    programKind: "ECONOMY",
    source: {
      declaredHeadSha: base.source.declaredHeadSha,
      observedHeadSha: base.source.observedHeadSha,
      observedTreeSha: base.source.observedTreeSha,
      statusPorcelain: base.source.repositoryCleanTrackedAndNonignoredUntracked ? "" : "DIRTY",
    },
    runnerBinding: {
      executedRunnerSha256: base.tooling.executedRunnerSha256,
      committedRunnerSha256: base.tooling.committedRunnerSha256,
    },
    identityReady: base.identityBinding.ready,
    sourceClosureReady: base.sourceClosure.ready,
    toolchainObservation,
    dependencyClosure,
    disk: { path: base.disk.path, freeBytes: base.disk.observedFreeBytes },
    recipe: ECONOMY_SBF_BUILD_RECIPE,
    minimumFreeBytes: COMBINED_LAW_BUILD_DISK_BUDGET.minimumFreeBytes,
  });
}

const RECEIPT_KEYS = Object.freeze([
  "schema",
  "status",
  "generatedAt",
  "scope",
  "source",
  "sourceClosure",
  "identityBinding",
  "container",
  "toolchain",
  "recipe",
  "artifact",
  "safety",
  "receiptSha256",
]);
const RECEIPT_SOURCE_KEYS = Object.freeze([
  "declaredHeadSha",
  "observedHeadSha",
  "observedTreeSha",
  "repositoryCleanTrackedAndNonignoredUntracked",
  "revalidationCount",
  "executedRunnerSha256",
  "committedRunnerSha256",
  "materializationSchema",
  "materializedTreeSha",
  "mountedInputSha256",
  "materializedFileCount",
  "materializedByteLength",
  "lfsPointerCount",
  "ignoredWorktreeBytesIncluded",
  "submodulePolicy",
  "lfsPolicy",
  "materializationRevalidationCount",
]);
const RECEIPT_IDENTITY_KEYS = Object.freeze([
  "manifestPath",
  "manifestSha256",
  "ownerPolicyPath",
  "ownerPolicySha256",
  "environmentNames",
  "environmentBindingSha256",
  "canonicalManifestReady",
]);
const RECEIPT_CONTAINER_KEYS = Object.freeze([
  "image",
  "reviewedIndexDigest",
  "platform",
  "platformManifestDigest",
  "executionReference",
  "dockerEndpoint",
  "localImageId",
  "pullPolicy",
  "networkMode",
]);
const RECEIPT_TOOLCHAIN_KEYS = Object.freeze([
  "rustc",
  "cargo",
  "cargoBuildSbf",
  "platformToolsVersion",
  "preinstalledToolsOnly",
]);
const RECEIPT_RECIPE_KEYS = Object.freeze([
  "recipeSha256",
  "command",
  "arguments",
  "productionFeature",
  "forbiddenFeature",
  "repetitions",
  "freshOutputAndTargetDirectories",
  "distinctBuildLogs",
]);
const RECEIPT_ARTIFACT_KEYS = Object.freeze([
  "fileName",
  "byteLength",
  "sha256",
  "firstBuildSha256",
  "secondBuildSha256",
  "firstBuildLogSha256",
  "secondBuildLogSha256",
  "preservedArtifactSha256",
  "preservedArtifactByteLength",
  "identicalByteLength",
  "identicalSha256",
  "identicalBytes",
  "preservedOutputAtomicNoOverwrite",
  "preservedOutputReadbackVerified",
]);
const RECEIPT_SAFETY_KEYS = Object.freeze([
  "publicNetworkWrites",
  "signing",
  "deployment",
  "keyGeneration",
  "rpc",
  "identityAuthorityVerified",
  "adversarialDevnetFinalBinaryAccepted",
  "productionCandidate",
  "mainnetExecutionAuthorized",
  "reproducibleBuildVerified",
  "mainnetStatus",
]);

function validateSourceClosureRecord(sourceClosure) {
  if (!exactKeys(sourceClosure, [
    "productionFeature",
    "forbiddenFeature",
    "checks",
    "sources",
    "bindingSha256",
  ])
    || sourceClosure.productionFeature !== ECONOMY_PRODUCTION_FEATURE
    || sourceClosure.forbiddenFeature !== ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE
    || !exactKeys(sourceClosure.checks, [
      "productionFeatureDeclared",
      "productionFeatureDoesNotEnablePreflight",
      "preflightFeatureSeparate",
      "libraryProductionModuleGated",
      "mutualEntrypointCompileError",
      "productionEntrypointMacroGated",
      "buildScriptRequiresProductionFeature",
      "buildScriptRequiresAllFourInputs",
      "recipeUsesProductionFeatureOnly",
    ])
    || !Object.values(sourceClosure.checks).every((value) => value === true)
    || !exactKeys(sourceClosure.sources, [
      "cargoManifestSha256",
      "librarySha256",
      "entrypointSha256",
      "buildScriptSha256",
    ])
    || !Object.values(sourceClosure.sources).every(
      (value) => typeof value === "string" && HEX_SHA256.test(value),
    )
    || sourceClosure.bindingSha256 !== digestRecord({
      checks: sourceClosure.checks,
      sources: sourceClosure.sources,
      recipe: ECONOMY_SBF_BUILD_RECIPE,
    })) {
    throw new Error("INVALID_IAT_B3_ECONOMY_SOURCE_CLOSURE_RECEIPT");
  }
  return sourceClosure;
}

function validateReceiptIdentityBinding(binding) {
  if (!exactKeys(binding, RECEIPT_IDENTITY_KEYS)
    || binding.manifestPath !== IDENTITY_REPOSITORY_PATH
    || binding.ownerPolicyPath !== OWNER_POLICY_REPOSITORY_PATH
    || !HEX_SHA256.test(binding.manifestSha256 ?? "")
    || !HEX_SHA256.test(binding.ownerPolicySha256 ?? "")
    || !HEX_SHA256.test(binding.environmentBindingSha256 ?? "")
    || canonicalJson(binding.environmentNames)
      !== canonicalJson(REQUIRED_ENVIRONMENT_NAMES)
    || binding.canonicalManifestReady !== true) {
    throw new Error("INVALID_IAT_B3_ECONOMY_RECEIPT_IDENTITY_BINDING");
  }
  return binding;
}

function normalizeBuildArtifact(artifact, expectedLabel) {
  if (!exactKeys(artifact, ["fileName", "bytes", "logSha256"])
    || artifact.fileName !== ECONOMY_SBF_BUILD_RECIPE.outputFileName
    || !Buffer.isBuffer(artifact.bytes)
    || artifact.bytes.length === 0
    || !HEX_SHA256.test(artifact.logSha256 ?? "")) {
    throw new Error(`IAT_B3_ECONOMY_${expectedLabel}_ARTIFACT_INVALID`);
  }
  return Object.freeze({
    fileName: artifact.fileName,
    bytes: artifact.bytes,
    byteLength: artifact.bytes.length,
    sha256: sha256(artifact.bytes),
    logSha256: artifact.logSha256,
  });
}

function normalizePreservedArtifact(artifact) {
  if (!exactKeys(artifact, ["fileName", "bytes", "atomicNoOverwrite", "readbackVerified"])
    || artifact.fileName !== ECONOMY_SBF_BUILD_RECIPE.outputFileName
    || !Buffer.isBuffer(artifact.bytes)
    || artifact.bytes.length === 0
    || artifact.atomicNoOverwrite !== true
    || artifact.readbackVerified !== true) {
    throw new Error("IAT_B3_ECONOMY_PRESERVED_ARTIFACT_INVALID");
  }
  return Object.freeze({
    fileName: artifact.fileName,
    bytes: artifact.bytes,
    byteLength: artifact.bytes.length,
    sha256: sha256(artifact.bytes),
  });
}

export function createEconomyBuildReceipt({
  generatedAt,
  declaredHeadSha,
  sourceObservations,
  materializedSourceObservations,
  runnerBinding,
  sourceClosure,
  identityBinding,
  containerObservation,
  toolchainObservation,
  firstArtifact,
  secondArtifact,
  preservedArtifact,
} = {}) {
  if (!isCanonicalTimestamp(generatedAt)) {
    throw new Error("IAT_B3_ECONOMY_RECEIPT_TIME_INVALID");
  }
  const source = assertExactCleanSourceSequence({
    declaredHeadSha,
    observations: sourceObservations,
  });
  const materialized = assertExactMaterializedSourceSequence({
    declaredHeadSha,
    observations: materializedSourceObservations,
  });
  if (source.treeSha !== materialized.treeSha) {
    throw new Error("IAT_B3_ECONOMY_MATERIALIZED_TREE_HEAD_MISMATCH_HOLD");
  }
  if (!exactKeys(runnerBinding, ["executedRunnerSha256", "committedRunnerSha256"])
    || !HEX_SHA256.test(runnerBinding.executedRunnerSha256 ?? "")
    || runnerBinding.executedRunnerSha256 !== runnerBinding.committedRunnerSha256) {
    throw new Error("IAT_B3_ECONOMY_RECEIPT_RUNNER_BINDING_INVALID");
  }
  validateSourceClosureRecord(sourceClosure);
  validateReceiptIdentityBinding(identityBinding);
  assertPinnedContainerObservation(containerObservation);
  assertPinnedToolchainObservation(toolchainObservation);
  assertEconomyBuildRecipe();
  const first = normalizeBuildArtifact(firstArtifact, "FIRST");
  const second = normalizeBuildArtifact(secondArtifact, "SECOND");
  const preserved = normalizePreservedArtifact(preservedArtifact);
  if (first.logSha256 === second.logSha256) {
    throw new Error("IAT_B3_ECONOMY_DISTINCT_BUILD_LOGS_REQUIRED");
  }
  if (first.byteLength !== second.byteLength
    || first.sha256 !== second.sha256
    || !first.bytes.equals(second.bytes)) {
    throw new Error("IAT_B3_ECONOMY_DUAL_BUILD_BYTE_MISMATCH_HOLD");
  }
  if (preserved.byteLength !== first.byteLength
    || preserved.sha256 !== first.sha256
    || !preserved.bytes.equals(first.bytes)) {
    throw new Error("IAT_B3_ECONOMY_PRESERVED_ARTIFACT_MISMATCH_HOLD");
  }
  const core = {
    schema: ECONOMY_BUILD_RECEIPT_SCHEMA,
    status: ECONOMY_BUILD_RECEIPT_STATUS,
    generatedAt,
    scope: "EXACT_CLEAN_SOURCE_PINNED_CONTAINER_PRODUCTION_ECONOMY_DUAL_SBF_BYTE_EQUALITY_ONLY",
    source: {
      declaredHeadSha,
      observedHeadSha: source.headSha,
      observedTreeSha: source.treeSha,
      repositoryCleanTrackedAndNonignoredUntracked: true,
      revalidationCount: sourceObservations.length,
      executedRunnerSha256: runnerBinding.executedRunnerSha256,
      committedRunnerSha256: runnerBinding.committedRunnerSha256,
      materializationSchema: materialized.schema,
      materializedTreeSha: materialized.treeSha,
      mountedInputSha256: materialized.mountedInputSha256,
      materializedFileCount: materialized.fileCount,
      materializedByteLength: materialized.byteLength,
      lfsPointerCount: materialized.lfsPointerCount,
      ignoredWorktreeBytesIncluded: false,
      submodulePolicy: COMBINED_LAW_SUBMODULE_POLICY,
      lfsPolicy: COMBINED_LAW_LFS_POLICY,
      materializationRevalidationCount: materializedSourceObservations.length,
    },
    sourceClosure,
    identityBinding,
    container: containerObservation,
    toolchain: {
      ...toolchainObservation,
      platformToolsVersion: ECONOMY_SBF_BUILD_RECIPE.platformToolsVersion,
      preinstalledToolsOnly: true,
    },
    recipe: {
      recipeSha256: digestRecord(ECONOMY_SBF_BUILD_RECIPE),
      command: ECONOMY_SBF_BUILD_RECIPE.command,
      arguments: [...ECONOMY_SBF_BUILD_RECIPE.arguments],
      productionFeature: ECONOMY_PRODUCTION_FEATURE,
      forbiddenFeature: ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE,
      repetitions: 2,
      freshOutputAndTargetDirectories: true,
      distinctBuildLogs: true,
    },
    artifact: {
      fileName: first.fileName,
      byteLength: first.byteLength,
      sha256: first.sha256,
      firstBuildSha256: first.sha256,
      secondBuildSha256: second.sha256,
      firstBuildLogSha256: first.logSha256,
      secondBuildLogSha256: second.logSha256,
      preservedArtifactSha256: preserved.sha256,
      preservedArtifactByteLength: preserved.byteLength,
      identicalByteLength: true,
      identicalSha256: true,
      identicalBytes: true,
      preservedOutputAtomicNoOverwrite: true,
      preservedOutputReadbackVerified: true,
    },
    safety: {
      publicNetworkWrites: false,
      signing: false,
      deployment: false,
      keyGeneration: false,
      rpc: false,
      identityAuthorityVerified: false,
      adversarialDevnetFinalBinaryAccepted: false,
      productionCandidate: false,
      mainnetExecutionAuthorized: false,
      reproducibleBuildVerified: true,
      mainnetStatus: ECONOMY_BUILD_MAINNET_STATUS,
    },
  };
  const receipt = freezeResult({ ...core, receiptSha256: digestRecord(core) });
  validateEconomyBuildReceipt(receipt);
  return receipt;
}

export function validateEconomyBuildReceipt(receipt) {
  if (!exactKeys(receipt, RECEIPT_KEYS)
    || receipt.schema !== ECONOMY_BUILD_RECEIPT_SCHEMA
    || receipt.status !== ECONOMY_BUILD_RECEIPT_STATUS
    || receipt.scope
      !== "EXACT_CLEAN_SOURCE_PINNED_CONTAINER_PRODUCTION_ECONOMY_DUAL_SBF_BYTE_EQUALITY_ONLY"
    || !isCanonicalTimestamp(receipt.generatedAt)
    || !exactKeys(receipt.source, RECEIPT_SOURCE_KEYS)
    || receipt.source.declaredHeadSha !== receipt.source.observedHeadSha
    || receipt.source.repositoryCleanTrackedAndNonignoredUntracked !== true
    || receipt.source.revalidationCount < 3
    || receipt.source.executedRunnerSha256 !== receipt.source.committedRunnerSha256
    || receipt.source.materializationSchema !== COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA
    || receipt.source.materializedTreeSha !== receipt.source.observedTreeSha
    || receipt.source.ignoredWorktreeBytesIncluded !== false
    || receipt.source.submodulePolicy !== COMBINED_LAW_SUBMODULE_POLICY
    || receipt.source.lfsPolicy !== COMBINED_LAW_LFS_POLICY
    || receipt.source.materializationRevalidationCount < 3) {
    throw new Error("INVALID_IAT_B3_ECONOMY_BUILD_RECEIPT");
  }
  for (const [value, pattern, label] of [
    [receipt.source.declaredHeadSha, HEX_SHA1, "RECEIPT_HEAD"],
    [receipt.source.observedTreeSha, HEX_SHA1, "RECEIPT_TREE"],
    [receipt.source.executedRunnerSha256, HEX_SHA256, "RECEIPT_RUNNER"],
    [receipt.source.mountedInputSha256, HEX_SHA256, "RECEIPT_MOUNTED_INPUT"],
  ]) assertHex(value, pattern, label);
  if (!Number.isSafeInteger(receipt.source.materializedFileCount)
    || receipt.source.materializedFileCount <= 0
    || !Number.isSafeInteger(receipt.source.materializedByteLength)
    || receipt.source.materializedByteLength <= 0
    || !Number.isSafeInteger(receipt.source.lfsPointerCount)
    || receipt.source.lfsPointerCount < 0
    || receipt.source.lfsPointerCount > receipt.source.materializedFileCount) {
    throw new Error("INVALID_IAT_B3_ECONOMY_BUILD_SOURCE_BINDING");
  }
  validateSourceClosureRecord(receipt.sourceClosure);
  validateReceiptIdentityBinding(receipt.identityBinding);
  if (!exactKeys(receipt.container, RECEIPT_CONTAINER_KEYS)) {
    throw new Error("INVALID_IAT_B3_ECONOMY_BUILD_CONTAINER");
  }
  assertPinnedContainerObservation(receipt.container);
  if (!exactKeys(receipt.toolchain, RECEIPT_TOOLCHAIN_KEYS)
    || receipt.toolchain.platformToolsVersion !== ECONOMY_SBF_BUILD_RECIPE.platformToolsVersion
    || receipt.toolchain.preinstalledToolsOnly !== true) {
    throw new Error("INVALID_IAT_B3_ECONOMY_BUILD_TOOLCHAIN");
  }
  assertPinnedToolchainObservation({
    rustc: receipt.toolchain.rustc,
    cargo: receipt.toolchain.cargo,
    cargoBuildSbf: receipt.toolchain.cargoBuildSbf,
  });
  if (!exactKeys(receipt.recipe, RECEIPT_RECIPE_KEYS)
    || receipt.recipe.recipeSha256 !== digestRecord(ECONOMY_SBF_BUILD_RECIPE)
    || receipt.recipe.command !== "cargo"
    || canonicalJson(receipt.recipe.arguments)
      !== canonicalJson(ECONOMY_SBF_BUILD_RECIPE.arguments)
    || receipt.recipe.productionFeature !== ECONOMY_PRODUCTION_FEATURE
    || receipt.recipe.forbiddenFeature !== ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE
    || receipt.recipe.arguments.includes(ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE)
    || receipt.recipe.repetitions !== 2
    || receipt.recipe.freshOutputAndTargetDirectories !== true
    || receipt.recipe.distinctBuildLogs !== true) {
    throw new Error("INVALID_IAT_B3_ECONOMY_BUILD_RECIPE");
  }
  if (!exactKeys(receipt.artifact, RECEIPT_ARTIFACT_KEYS)
    || receipt.artifact.fileName !== ECONOMY_SBF_BUILD_RECIPE.outputFileName
    || !Number.isSafeInteger(receipt.artifact.byteLength)
    || receipt.artifact.byteLength <= 0
    || receipt.artifact.sha256 !== receipt.artifact.firstBuildSha256
    || receipt.artifact.sha256 !== receipt.artifact.secondBuildSha256
    || receipt.artifact.sha256 !== receipt.artifact.preservedArtifactSha256
    || receipt.artifact.byteLength !== receipt.artifact.preservedArtifactByteLength
    || receipt.artifact.firstBuildLogSha256 === receipt.artifact.secondBuildLogSha256
    || receipt.artifact.identicalByteLength !== true
    || receipt.artifact.identicalSha256 !== true
    || receipt.artifact.identicalBytes !== true
    || receipt.artifact.preservedOutputAtomicNoOverwrite !== true
    || receipt.artifact.preservedOutputReadbackVerified !== true) {
    throw new Error("INVALID_IAT_B3_ECONOMY_BUILD_ARTIFACT");
  }
  for (const value of [
    receipt.artifact.sha256,
    receipt.artifact.firstBuildLogSha256,
    receipt.artifact.secondBuildLogSha256,
    receipt.receiptSha256,
  ]) assertHex(value, HEX_SHA256, "RECEIPT_SHA256");
  if (!exactKeys(receipt.safety, RECEIPT_SAFETY_KEYS)
    || receipt.safety.publicNetworkWrites !== false
    || receipt.safety.signing !== false
    || receipt.safety.deployment !== false
    || receipt.safety.keyGeneration !== false
    || receipt.safety.rpc !== false
    || receipt.safety.identityAuthorityVerified !== false
    || receipt.safety.adversarialDevnetFinalBinaryAccepted !== false
    || receipt.safety.productionCandidate !== false
    || receipt.safety.mainnetExecutionAuthorized !== false
    || receipt.safety.reproducibleBuildVerified !== true
    || receipt.safety.mainnetStatus !== ECONOMY_BUILD_MAINNET_STATUS) {
    throw new Error("INVALID_IAT_B3_ECONOMY_BUILD_SAFETY_BOUNDARY");
  }
  const { receiptSha256, ...core } = receipt;
  if (receiptSha256 !== digestRecord(core)) {
    throw new Error("IAT_B3_ECONOMY_BUILD_RECEIPT_DIGEST_MISMATCH");
  }
  return receipt;
}

function createEconomyBuildRoot() {
  return createExactSourceBuildRoot({ prefix: ECONOMY_BUILD_ROOT_PREFIX });
}

function removeEconomyBuildRoot(root) {
  return removeExactSourceBuildRoot(root);
}

function readSnapshotFile(snapshot, relativePath) {
  if (!ECONOMY_SOURCE_CLOSURE_PATHS.includes(relativePath)
    && ![
      IDENTITY_REPOSITORY_PATH,
      OWNER_POLICY_REPOSITORY_PATH,
      RUNNER_REPOSITORY_PATH,
      CARGO_LOCK_REPOSITORY_PATH,
    ].includes(relativePath)) {
    throw new Error("IAT_B3_ECONOMY_SNAPSHOT_PATH_NOT_ALLOWLISTED");
  }
  const path = resolve(snapshot.root, ...relativePath.split("/"));
  if (!isWithin(snapshot.root, path)) throw new Error("IAT_B3_ECONOMY_SNAPSHOT_PATH_ESCAPE");
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("IAT_B3_ECONOMY_SNAPSHOT_REGULAR_FILE_REQUIRED");
  }
  return readFileSync(path);
}

function inspectSnapshotSourceClosure(snapshot) {
  observeMaterializedSourceSnapshot(snapshot);
  return inspectEconomyProductionSourceClosure({
    cargoManifestSource: readSnapshotFile(snapshot, ECONOMY_MANIFEST_REPOSITORY_PATH)
      .toString("utf8"),
    librarySource: readSnapshotFile(snapshot, ECONOMY_LIB_REPOSITORY_PATH).toString("utf8"),
    entrypointSource: readSnapshotFile(snapshot, ECONOMY_ENTRYPOINT_REPOSITORY_PATH)
      .toString("utf8"),
    buildScriptSource: readSnapshotFile(snapshot, ECONOMY_BUILD_RS_REPOSITORY_PATH)
      .toString("utf8"),
  });
}

function loadSnapshotIdentity(snapshot) {
  observeMaterializedSourceSnapshot(snapshot);
  return assertEconomyIdentityAndOwnerPolicyBytes({
    identityManifestBytes: readSnapshotFile(snapshot, IDENTITY_REPOSITORY_PATH),
    ownerPolicyBytes: readSnapshotFile(snapshot, OWNER_POLICY_REPOSITORY_PATH),
  });
}

function materializeBuildArguments(containerRoot) {
  return ECONOMY_SBF_BUILD_RECIPE.arguments.map((argument) => {
    if (argument === "<FRESH_OUTPUT_DIRECTORY>") return `${containerRoot}/output`;
    if (argument === "<FRESH_TARGET_DIRECTORY>") return `${containerRoot}/target`;
    return argument;
  });
}

export function createEconomyDockerBuildArguments({
  sourceSnapshotRoot,
  hostBuildRoot,
  containerBuildRoot,
  identityEnvironmentNames,
} = {}) {
  if (typeof sourceSnapshotRoot !== "string"
    || typeof hostBuildRoot !== "string"
    || !isAbsolute(sourceSnapshotRoot)
    || !isAbsolute(hostBuildRoot)
    || typeof containerBuildRoot !== "string"
    || !containerBuildRoot.startsWith(`${ECONOMY_CONTAINER_BUILD_ROOT}/run-`)
    || canonicalJson([...(identityEnvironmentNames ?? [])].sort())
      !== canonicalJson([...REQUIRED_ENVIRONMENT_NAMES].sort())) {
    throw new Error("IAT_B3_ECONOMY_DOCKER_BUILD_ARGUMENT_INPUT_INVALID");
  }
  for (const path of [sourceSnapshotRoot, hostBuildRoot]) {
    if (path.includes(",") || /[\r\n\0]/u.test(path)) {
      throw new Error("IAT_B3_ECONOMY_DOCKER_MOUNT_PATH_UNSAFE");
    }
  }
  const arguments_ = [
    `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
    "run",
    "--rm",
    "--pull=never",
    "--network=none",
    "--platform=linux/amd64",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--workdir=/iat-source",
    `--mount=type=bind,source=${sourceSnapshotRoot},target=/iat-source,readonly`,
    `--mount=type=bind,source=${hostBuildRoot},target=${containerBuildRoot}`,
    "--env=IAT_B3_EXACT_SOURCE_HEAD_SHA",
    ...identityEnvironmentNames.map((name) => `--env=${name}`),
    "--entrypoint=cargo",
    PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference,
    ...materializeBuildArguments(containerBuildRoot),
  ];
  if (arguments_.includes(ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE)
    || arguments_.filter((value) => value === ECONOMY_PRODUCTION_FEATURE).length !== 1) {
    throw new Error("IAT_B3_ECONOMY_DOCKER_PRODUCTION_FEATURE_EXCLUSIVITY_HOLD");
  }
  return Object.freeze(arguments_);
}

function executeFreshBuild({
  sourceSnapshot,
  buildRoot,
  containerBuildRoot,
  declaredHeadSha,
  identityEnvironment,
  runLabel,
}) {
  observeMaterializedSourceSnapshot(sourceSnapshot);
  mkdirSync(buildRoot, { recursive: false, mode: 0o700 });
  if (readdirSync(buildRoot).length !== 0) {
    throw new Error("IAT_B3_ECONOMY_FRESH_BUILD_DIRECTORY_REQUIRED");
  }
  const arguments_ = createEconomyDockerBuildArguments({
    sourceSnapshotRoot: sourceSnapshot.root,
    hostBuildRoot: buildRoot,
    containerBuildRoot,
    identityEnvironmentNames: Object.keys(identityEnvironment),
  });
  const result = executePinnedDocker(arguments_, {
    environment: {
      IAT_B3_EXACT_SOURCE_HEAD_SHA: declaredHeadSha,
      ...identityEnvironment,
    },
    purpose: PINNED_DOCKER_COMMAND_PURPOSE.economyBuild,
    timeout: 30 * 60 * 1_000,
  });
  const logBytes = Buffer.from(
    `IAT_B3_ECONOMY_BUILD_RUN=${runLabel}\n${result.stdout}\n${result.stderr}`,
    "utf8",
  );
  if (UNSAFE_COMPILER_DIAGNOSTIC.test(logBytes.toString("utf8"))) {
    throw new Error("IAT_B3_ECONOMY_UNSAFE_SBF_COMPILER_DIAGNOSTIC_HOLD");
  }
  const outputDirectory = join(buildRoot, "output");
  const entries = readdirSync(outputDirectory, { withFileTypes: true });
  if (entries.length !== 1
    || entries[0].name !== ECONOMY_SBF_BUILD_RECIPE.outputFileName
    || !entries[0].isFile()
    || entries[0].isSymbolicLink()) {
    throw new Error("IAT_B3_ECONOMY_EXACT_SBF_OUTPUT_SET_REQUIRED");
  }
  const forbiddenKeypairs = readdirSync(buildRoot, { recursive: true })
    .filter((path) => /(?:^|[\\/]).*(?:keypair|key-pair).*\.json$/iu.test(String(path)));
  if (forbiddenKeypairs.length > 0) {
    throw new Error("IAT_B3_ECONOMY_BUILD_EMITTED_FORBIDDEN_KEYPAIR_MATERIAL");
  }
  const artifactPath = join(outputDirectory, entries[0].name);
  const stat = lstatSync(artifactPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error("IAT_B3_ECONOMY_REGULAR_NONEMPTY_SBF_REQUIRED");
  }
  return Object.freeze({
    fileName: entries[0].name,
    bytes: readFileSync(artifactPath),
    logSha256: sha256(logBytes),
    artifactPath,
  });
}

function reobserveBuildArtifact(artifact) {
  const bytes = readFileSync(artifact.artifactPath);
  const stat = lstatSync(artifact.artifactPath);
  if (!stat.isFile() || stat.isSymbolicLink() || !bytes.equals(artifact.bytes)) {
    throw new Error("IAT_B3_ECONOMY_SBF_CHANGED_BEFORE_RECEIPT_HOLD");
  }
  return Object.freeze({
    fileName: artifact.fileName,
    bytes,
    logSha256: artifact.logSha256,
  });
}

function validateDestination(path, repositoryRoot, expectedFileName) {
  if (typeof path !== "string" || !isAbsolute(path) || basename(path) !== expectedFileName) {
    throw new Error("IAT_B3_ECONOMY_OUTPUT_ABSOLUTE_EXACT_FILE_NAME_REQUIRED");
  }
  const normalized = resolve(path);
  if (existsSync(normalized)) throw new Error("IAT_B3_ECONOMY_OUTPUT_MUST_NOT_EXIST");
  const parent = realpathSync(dirname(normalized));
  const repository = realpathSync(repositoryRoot);
  if (parent !== resolve(dirname(normalized)) || isWithin(repository, normalized)) {
    throw new Error("IAT_B3_ECONOMY_OUTPUT_MUST_BE_OUTSIDE_REPOSITORY");
  }
  return normalized;
}

function preserveArtifact({ outputPath, artifact, repositoryRoot }) {
  const destination = validateDestination(
    outputPath,
    repositoryRoot,
    ECONOMY_SBF_BUILD_RECIPE.outputFileName,
  );
  const temporaryPath = join(
    dirname(destination),
    `.${basename(destination)}.${process.pid}.${randomBytes(8).toString("hex")}.partial`,
  );
  try {
    writeFileSync(temporaryPath, artifact.bytes, { flag: "wx", mode: 0o600 });
    const temporaryStat = lstatSync(temporaryPath);
    const temporaryBytes = readFileSync(temporaryPath);
    if (!temporaryStat.isFile()
      || temporaryStat.isSymbolicLink()
      || !temporaryBytes.equals(artifact.bytes)) {
      throw new Error("IAT_B3_ECONOMY_ARTIFACT_TEMPORARY_COPY_DRIFT_HOLD");
    }
    linkSync(temporaryPath, destination);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
  const bytes = readFileSync(destination);
  const stat = lstatSync(destination);
  if (!stat.isFile() || stat.isSymbolicLink() || !bytes.equals(artifact.bytes)) {
    throw new Error("IAT_B3_ECONOMY_PRESERVED_ARTIFACT_READBACK_DRIFT_HOLD");
  }
  return Object.freeze({
    fileName: artifact.fileName,
    bytes,
    atomicNoOverwrite: true,
    readbackVerified: true,
  });
}

function emitReceipt(receiptPath, receipt, repositoryRoot) {
  const destination = validateDestination(
    receiptPath,
    repositoryRoot,
    "iat_b3_economy.receipt.json",
  );
  validateEconomyBuildReceipt(receipt);
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  const temporaryPath = join(
    dirname(destination),
    `.${basename(destination)}.${process.pid}.${randomBytes(8).toString("hex")}.partial`,
  );
  try {
    writeFileSync(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
    linkSync(temporaryPath, destination);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
  const stat = lstatSync(destination);
  if (!stat.isFile() || stat.isSymbolicLink() || !readFileSync(destination).equals(bytes)) {
    throw new Error("IAT_B3_ECONOMY_RECEIPT_WRITE_VERIFICATION_FAILED");
  }
}

function emitEconomyNativeWslReceipt(receiptPath, receipt, repositoryRoot) {
  const destination = validateDestination(
    receiptPath,
    repositoryRoot,
    "iat_b3_economy.receipt.json",
  );
  validateNativeWslBuildReceipt(receipt, {
    programKind: "ECONOMY",
    recipe: ECONOMY_SBF_BUILD_RECIPE,
    outputFileName: ECONOMY_SBF_BUILD_RECIPE.outputFileName,
  });
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  const temporaryPath = join(
    dirname(destination),
    `.${basename(destination)}.${process.pid}.${randomBytes(8).toString("hex")}.partial`,
  );
  try {
    writeFileSync(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
    linkSync(temporaryPath, destination);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
  if (!readFileSync(destination).equals(bytes)) {
    throw new Error("IAT_B3_ECONOMY_NATIVE_WSL_RECEIPT_WRITE_VERIFICATION_FAILED");
  }
}

export function runEconomyNativeWslReproducibleBuild({
  receiptPath,
  artifactPath,
  environment = process.env,
  repositoryRoot = REPOSITORY_ROOT,
} = {}) {
  assertNativeWslObservationOnlyBuildDisabled();
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error("IAT_B3_ECONOMY_NATIVE_WSL_BUILD_REQUIRES_LINUX_AMD64_HOST");
  }
  assertEconomyBuildRecipe();
  const receiptDestination = validateDestination(
    receiptPath,
    repositoryRoot,
    "iat_b3_economy.receipt.json",
  );
  const artifactDestination = validateDestination(
    artifactPath,
    repositoryRoot,
    ECONOMY_SBF_BUILD_RECIPE.outputFileName,
  );
  const declaredHeadSha = environment?.IAT_B3_EXACT_SOURCE_HEAD_SHA;
  assertHex(declaredHeadSha, HEX_SHA1, "EXACT_SOURCE_HEAD");
  const sourceObservations = [observeExactSource(repositoryRoot)];
  assertCleanSourceObservation({
    declaredHeadSha,
    observation: sourceObservations[0],
    index: 0,
  });
  const toolchainObservations = [observeNativeWslPinnedToolchain()];
  const executedRunnerSha256 = sha256(readFileSync(RUNNER_PATH));
  let buildRoot = null;
  try {
    buildRoot = createEconomyBuildRoot();
    const snapshot = loadExactDeclaredHeadSource({ repositoryRoot, buildRoot, declaredHeadSha });
    const materializedSourceObservations = [observeMaterializedSourceSnapshot(snapshot)];
    if (snapshot.treeSha !== sourceObservations[0].treeSha) {
      throw new Error("IAT_B3_ECONOMY_MATERIALIZED_TREE_HEAD_MISMATCH_HOLD");
    }
    const committedRunnerSha256 = sha256(readSnapshotFile(snapshot, RUNNER_REPOSITORY_PATH));
    if (executedRunnerSha256 !== committedRunnerSha256) {
      throw new Error("IAT_B3_ECONOMY_EXECUTED_RUNNER_NOT_COMMITTED_HOLD");
    }
    const identity = loadSnapshotIdentity(snapshot);
    const sourceClosure = inspectSnapshotSourceClosure(snapshot);
    const dependencyClosure = verifyNativeCargoLockArchiveClosure(
      readSnapshotFile(snapshot, CARGO_LOCK_REPOSITORY_PATH),
    );
    toolchainObservations.push(observeNativeWslPinnedToolchain());
    sourceObservations.push(observeExactSource(repositoryRoot));
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(snapshot));
    const first = executeNativeWslFreshBuild({
      sourceRoot: snapshot.root,
      buildRoot: join(buildRoot, "run-1"),
      recipe: ECONOMY_SBF_BUILD_RECIPE,
      identityEnvironment: identity.environment,
      declaredHeadSha,
      expectedOutputFileName: ECONOMY_SBF_BUILD_RECIPE.outputFileName,
      runLabel: "run-1",
    });
    sourceObservations.push(observeExactSource(repositoryRoot));
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(snapshot));
    const second = executeNativeWslFreshBuild({
      sourceRoot: snapshot.root,
      buildRoot: join(buildRoot, "run-2"),
      recipe: ECONOMY_SBF_BUILD_RECIPE,
      identityEnvironment: identity.environment,
      declaredHeadSha,
      expectedOutputFileName: ECONOMY_SBF_BUILD_RECIPE.outputFileName,
      runLabel: "run-2",
    });
    toolchainObservations.push(observeNativeWslPinnedToolchain());
    sourceObservations.push(observeExactSource(repositoryRoot));
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(snapshot));
    const preservedArtifact = preserveArtifact({
      outputPath: artifactDestination,
      artifact: { fileName: first.fileName, bytes: first.bytes },
      repositoryRoot,
    });
    const receipt = createNativeWslBuildReceipt({
      generatedAt: new Date().toISOString(),
      programKind: "ECONOMY",
      source: createNativeSourceReceiptBinding({
        declaredHeadSha,
        sourceObservations,
        materializedSourceObservations,
        executedRunnerSha256,
        committedRunnerSha256,
      }),
      identityBinding: {
        manifestSha256: identity.receiptBinding.manifestSha256,
        environmentBindingSha256: identity.receiptBinding.environmentBindingSha256,
        inputNames: [...REQUIRED_ENVIRONMENT_NAMES],
      },
      sourceClosure,
      dependencyClosure,
      toolchainObservations,
      recipe: ECONOMY_SBF_BUILD_RECIPE,
      firstArtifact: first,
      secondArtifact: second,
      preservedArtifact,
    });
    emitEconomyNativeWslReceipt(receiptDestination, receipt, repositoryRoot);
    return receipt;
  } finally {
    if (buildRoot !== null) removeEconomyBuildRoot(buildRoot);
  }
}

export function runEconomyReproducibleBuild({
  receiptPath,
  artifactPath,
  environment = process.env,
  repositoryRoot = REPOSITORY_ROOT,
  stopAfterSourceMaterialization = false,
} = {}) {
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error("IAT_B3_ECONOMY_BUILD_REQUIRES_LINUX_AMD64_HOST");
  }
  assertEconomyBuildRecipe();
  const receiptDestination = validateDestination(
    receiptPath,
    repositoryRoot,
    "iat_b3_economy.receipt.json",
  );
  const artifactDestination = validateDestination(
    artifactPath,
    repositoryRoot,
    ECONOMY_SBF_BUILD_RECIPE.outputFileName,
  );
  const declaredHeadSha = environment?.IAT_B3_EXACT_SOURCE_HEAD_SHA;
  assertHex(declaredHeadSha, HEX_SHA1, "EXACT_SOURCE_HEAD");
  const executedRunnerSha256 = sha256(readFileSync(RUNNER_PATH));
  const committedRunnerSha256 = sha256(
    readCommittedFile(repositoryRoot, declaredHeadSha, RUNNER_REPOSITORY_PATH),
  );
  if (executedRunnerSha256 !== committedRunnerSha256) {
    throw new Error("IAT_B3_ECONOMY_EXECUTED_RUNNER_NOT_COMMITTED_HOLD");
  }
  const sourceObservations = [observeExactSource(repositoryRoot)];
  assertCleanSourceObservation({
    declaredHeadSha,
    observation: sourceObservations[0],
    index: 0,
  });
  let buildRoot = null;
  try {
    buildRoot = createEconomyBuildRoot();
    const snapshot = loadExactDeclaredHeadSource({
      repositoryRoot,
      buildRoot,
      declaredHeadSha,
    });
    const materializedSourceObservations = [observeMaterializedSourceSnapshot(snapshot)];
    if (snapshot.treeSha !== sourceObservations[0].treeSha) {
      throw new Error("IAT_B3_ECONOMY_MATERIALIZED_TREE_HEAD_MISMATCH_HOLD");
    }
    if (stopAfterSourceMaterialization === true) {
      throw new Error("IAT_B3_ECONOMY_TEST_STOP_AFTER_SOURCE_MATERIALIZATION");
    }
    const sourceClosure = inspectSnapshotSourceClosure(snapshot);
    const identity = loadSnapshotIdentity(snapshot);
    const pinned = observeContainerAndToolchain();
    if (pinned.container === null || pinned.toolchain === null) {
      throw new Error(`IAT_B3_ECONOMY_PINNED_TOOLCHAIN_HOLD: ${pinned.failure}`);
    }
    sourceObservations.push(observeExactSource(repositoryRoot));
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(snapshot));
    assertExactCleanSourceSequence({ declaredHeadSha, observations: sourceObservations });
    const first = executeFreshBuild({
      sourceSnapshot: snapshot,
      buildRoot: join(buildRoot, "run-1"),
      containerBuildRoot: `${ECONOMY_CONTAINER_BUILD_ROOT}/run-1`,
      declaredHeadSha,
      identityEnvironment: identity.environment,
      runLabel: "run-1",
    });
    sourceObservations.push(observeExactSource(repositoryRoot));
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(snapshot));
    assertExactCleanSourceSequence({ declaredHeadSha, observations: sourceObservations });
    const second = executeFreshBuild({
      sourceSnapshot: snapshot,
      buildRoot: join(buildRoot, "run-2"),
      containerBuildRoot: `${ECONOMY_CONTAINER_BUILD_ROOT}/run-2`,
      declaredHeadSha,
      identityEnvironment: identity.environment,
      runLabel: "run-2",
    });
    sourceObservations.push(observeExactSource(repositoryRoot));
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(snapshot));
    assertExactCleanSourceSequence({ declaredHeadSha, observations: sourceObservations });
    const firstArtifact = reobserveBuildArtifact(first);
    const secondArtifact = reobserveBuildArtifact(second);
    if (!firstArtifact.bytes.equals(secondArtifact.bytes)) {
      throw new Error("IAT_B3_ECONOMY_DUAL_BUILD_BYTE_MISMATCH_HOLD");
    }
    const preservedArtifact = preserveArtifact({
      outputPath: artifactDestination,
      artifact: firstArtifact,
      repositoryRoot,
    });
    const receipt = createEconomyBuildReceipt({
      generatedAt: new Date().toISOString(),
      declaredHeadSha,
      sourceObservations,
      materializedSourceObservations,
      runnerBinding: { executedRunnerSha256, committedRunnerSha256 },
      sourceClosure,
      identityBinding: identity.receiptBinding,
      containerObservation: pinned.container,
      toolchainObservation: pinned.toolchain,
      firstArtifact,
      secondArtifact,
      preservedArtifact,
    });
    emitReceipt(receiptDestination, receipt, repositoryRoot);
    const finalBytes = readFileSync(artifactDestination);
    if (sha256(finalBytes) !== receipt.artifact.sha256
      || finalBytes.length !== receipt.artifact.byteLength) {
      throw new Error("IAT_B3_ECONOMY_FINAL_ARTIFACT_READBACK_DRIFT_HOLD");
    }
    return receipt;
  } finally {
    if (buildRoot !== null) removeEconomyBuildRoot(buildRoot);
  }
}

function parseCliArguments(argv) {
  if (argv.length === 1 && argv[0] === "--preflight") {
    return Object.freeze({ mode: "preflight" });
  }
  if (argv.length === 4
    && argv[0] === "--receipt"
    && argv[1]
    && argv[2] === "--artifact"
    && argv[3]) {
    return Object.freeze({ mode: "build", receiptPath: argv[1], artifactPath: argv[3] });
  }
  throw new Error(
    "Usage: run-iat-b3-economy-reproducible-build.mjs --preflight | --receipt <absolute-outside-repository/iat_b3_economy.receipt.json> --artifact <absolute-outside-repository/iat_b3_economy.so>",
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    const arguments_ = parseCliArguments(process.argv.slice(2));
    const backend = selectReproducibleBuildBackend(process.env);
    if (arguments_.mode === "preflight") {
      const preflight = backend === NATIVE_WSL_BUILD_BACKEND
        ? observeEconomyNativeWslBuildPreflight()
        : observeEconomyBuildPreflight();
      process.stdout.write(`${JSON.stringify(preflight, null, 2)}\n`);
      process.exitCode = preflight.exitCode;
    } else {
      const receipt = backend === NATIVE_WSL_BUILD_BACKEND
        ? runEconomyNativeWslReproducibleBuild(arguments_)
        : runEconomyReproducibleBuild(arguments_);
      process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    }
  } catch (error) {
    process.stderr.write(
      `IAT B3 economy exact-source build HOLD: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 2;
  }
}

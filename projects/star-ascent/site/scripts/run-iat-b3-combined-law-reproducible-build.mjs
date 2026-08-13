#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  chmodSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
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
  PRODUCTION_COMBINED_ARTIFACT_INPUT_SPECS,
  PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
  PRODUCTION_OWNER_POLICY_BINDING,
  assertProductionCombinedArtifactBindingReady,
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

export const COMBINED_LAW_BUILD_RECEIPT_SCHEMA =
  "iat-b3-combined-law-exact-source-dual-sbf-build/v1";
export const COMBINED_LAW_BUILD_RECEIPT_STATUS =
  "EXACT_SOURCE_DUAL_FRESH_SBF_BYTE_EQUALITY_VERIFIED";
export const COMBINED_LAW_BUILD_MAINNET_STATUS = "HOLD";
export const COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA =
  "iat-b3-combined-law-exact-git-object-materialization/v1";
export const COMBINED_LAW_SUBMODULE_POLICY = "REJECT_ALL_GITLINKS";
export const COMBINED_LAW_LFS_POLICY =
  "RAW_COMMITTED_POINTER_BLOBS_ONLY_NO_SMUDGE";
export const COMBINED_LAW_BUILD_PREFLIGHT_SCHEMA =
  "iat-b3-combined-law-exact-source-build-preflight/v1";
export const COMBINED_LAW_BUILD_PREFLIGHT_READY = "READY_TO_EXECUTE_DUAL_BUILD";
export const COMBINED_LAW_BUILD_PREFLIGHT_HOLD = "HOLD";

const GIBIBYTE = 1024 ** 3;
export const COMBINED_LAW_BUILD_DISK_BUDGET = Object.freeze({
  estimatedDualFreshBuildWorkspaceBytes: 16 * GIBIBYTE,
  requiredPostRunReserveBytes: 8 * GIBIBYTE,
  minimumFreeBytes: 24 * GIBIBYTE,
  containerImageAlreadyPresentRequired: true,
  containerImageBytesIncluded: false,
});

export const COMBINED_LAW_PROGRAMDATA_BINDING = Object.freeze({
  loaderProgramId: "BPFLoaderUpgradeab1e11111111111111111111111",
  programAccount: Object.freeze({
    executable: true,
    byteLength: 36,
    stateDiscriminatorU32Le: 2,
    programDataAddressOffset: 4,
    programDataAddressByteLength: 32,
  }),
  programDataAccount: Object.freeze({
    stateDiscriminatorU32Le: 3,
    programBytesOffset: 45,
    reviewedTemporaryAuthorityRequiredBeforeFreeze: true,
    terminalUpgradeAuthorityOption: 0,
    terminalUnusedAuthorityBytesAllZero: true,
    artifactBinding: "EXACT_RECEIPT_SHA256_BYTE_LENGTH_AND_BYTES",
    trailingLoaderPadding: "ALL_ZERO",
  }),
  requiredEvidenceFields: Object.freeze([
    "programAddress",
    "programDataAddress",
    "programAccountOwner",
    "programAccountExecutable",
    "programAccountDataByteLength",
    "programAccountStateDiscriminatorU32Le",
    "programDataAccountOwner",
    "programDataAccountStateDiscriminatorU32Le",
    "upgradeAuthority",
    "artifactSha256",
    "artifactByteLength",
    "deployedProgramBytesSha256",
    "deployedProgramBytesByteLength",
    "trailingZeroPaddingByteLength",
    "observationSlot",
    "rpcGenesisHash",
  ]),
});

export const PINNED_COMBINED_LAW_BUILD_CONTAINER = Object.freeze({
  image: "solanafoundation/anchor",
  reviewedIndexDigest: "sha256:05a13b9f0a6d7dd5dc86955dd0e14a098110f12d2862ac5e0cf588049a48841b",
  platform: "linux/amd64",
  platformManifestDigest: "sha256:28fde4e63a063727c9520a925de4e9a3be29fcc717b5d759363c23ddea28f59d",
  executionReference:
    "solanafoundation/anchor@sha256:28fde4e63a063727c9520a925de4e9a3be29fcc717b5d759363c23ddea28f59d",
  dockerEndpoint: "unix:///var/run/docker.sock",
  pullPolicy: "never",
  networkMode: "none",
});

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const IDENTITY_MANIFEST_RELATIVE_PATH =
  "projects/star-ascent/site/docs/b3/iat-b3-identity-freeze.v1.json";
const OWNER_POLICY_RELATIVE_PATH = PRODUCTION_OWNER_POLICY_BINDING.packetPath;
const RUNNER_RELATIVE_PATH =
  "projects/star-ascent/site/scripts/run-iat-b3-combined-law-reproducible-build.mjs";
const CARGO_LOCK_RELATIVE_PATH = "projects/star-ascent/site/Cargo.lock";
const BUILD_ROOT_PREFIX = "iat-b3-combined-law-sbf-";
const MATERIALIZED_SOURCE_DIRECTORY = "exact-source";
const REQUIRED_IDENTITY_ENVIRONMENT_NAMES = Object.freeze(
  PRODUCTION_COMBINED_ARTIFACT_INPUT_SPECS.map(({ environmentVariable }) => environmentVariable),
);
const HEX_SHA1 = /^[0-9a-f]{40}$/u;
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const CONTAINER_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const RUSTC_VERSION = /^rustc 1\.97\.1 \([0-9a-f]+ 2026-07-14\)$/u;
const CARGO_VERSION = /^cargo 1\.97\.1 \([0-9a-f]+ 2026-06-30\)$/u;
const CARGO_BUILD_SBF_VERSION = /^solana-cargo-build-sbf 3\.1\.10$/u;
const UNSAFE_COMPILER_DIAGNOSTIC =
  /Stack offset of|stack frame of [0-9]+ bytes exceeds|max offset exceeded|overwrites values|undefined behavior/iu;
// Shared process-owned root registry for every exact-source production runner.
// Materialization remains closed to arbitrary caller-provided paths.
const ACTIVE_BUILD_ROOTS = new Map();
const MATERIALIZED_SOURCE_SNAPSHOTS = new WeakSet();
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });
const NULL_GIT_CONFIG_PATH = process.platform === "win32" ? "NUL" : "/dev/null";

const RECEIPT_KEYS = Object.freeze([
  "schema",
  "status",
  "generatedAt",
  "scope",
  "source",
  "identityBinding",
  "container",
  "toolchain",
  "recipe",
  "artifact",
  "safety",
  "receiptSha256",
]);
const SOURCE_KEYS = Object.freeze([
  "declaredHeadSha",
  "observedHeadSha",
  "observedTreeSha",
  "repositoryCleanTrackedAndUntracked",
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
const IDENTITY_BINDING_KEYS = Object.freeze([
  "manifestPath",
  "manifestSha256",
  "environmentBindingSha256",
  "canonicalManifestReady",
]);
const CONTAINER_KEYS = Object.freeze([
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
const TOOLCHAIN_KEYS = Object.freeze([
  "rustc",
  "cargo",
  "cargoBuildSbf",
  "platformToolsVersion",
  "preinstalledToolsOnly",
]);
const RECIPE_KEYS = Object.freeze([
  "recipeSha256",
  "command",
  "arguments",
  "repetitions",
  "freshOutputAndTargetDirectories",
]);
const ARTIFACT_KEYS = Object.freeze([
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

const MATERIALIZED_SOURCE_OBSERVATION_KEYS = Object.freeze([
  "schema",
  "declaredHeadSha",
  "treeSha",
  "mountedInputSha256",
  "fileCount",
  "byteLength",
  "lfsPointerCount",
  "ignoredWorktreeBytesIncluded",
  "submodulePolicy",
  "lfsPolicy",
]);

const MATERIALIZED_SOURCE_ENTRY_KEYS = Object.freeze([
  "path",
  "gitMode",
  "gitObjectSha1",
  "byteLength",
  "sha256",
  "lfsPointer",
]);
const SAFETY_KEYS = Object.freeze([
  "publicNetworkWrites",
  "signing",
  "deployment",
  "identityAuthorityVerified",
  "adversarialDevnetFinalBinaryAccepted",
  "productionCandidate",
  "mainnetExecutionAuthorized",
  "reproducibleBuildVerified",
  "mainnetStatus",
]);

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function gitBlobSha1(bytes) {
  return createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
    .update(bytes)
    .digest("hex");
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

function isCanonicalTimestamp(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function freezeResult(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) freezeResult(child);
  }
  return Object.freeze(value);
}

function hasExactDataKeys(value, expected) {
  if (!value
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const actual = Reflect.ownKeys(value);
  if (actual.some((key) => typeof key !== "string")) return false;
  for (const key of actual) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor
      || descriptor.enumerable !== true
      || !("value" in descriptor)
      || "get" in descriptor
      || "set" in descriptor) return false;
  }
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length
    && [...actual].sort().every((key, index) => key === sortedExpected[index]);
}

function hasExactDataArray(value, expected) {
  if (!Array.isArray(value)
    || Object.getPrototypeOf(value) !== Array.prototype
    || value.length !== expected.length) return false;
  const ownKeys = Reflect.ownKeys(value);
  const expectedKeys = [...expected.keys()].map(String);
  if (ownKeys.some((key) => typeof key !== "string")
    || ownKeys.length !== expectedKeys.length + 1
    || !ownKeys.includes("length")) return false;
  for (const [index, expectedValue] of expected.entries()) {
    const key = String(index);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor
      || descriptor.enumerable !== true
      || !("value" in descriptor)
      || "get" in descriptor
      || "set" in descriptor
      || descriptor.value !== expectedValue) return false;
  }
  const sortedExpectedKeys = [...expectedKeys].sort();
  return ownKeys.filter((key) => key !== "length").sort()
    .every((key, index) => key === sortedExpectedKeys[index]);
}

function assertHex(value, expression, label) {
  if (typeof value !== "string" || !expression.test(value)) {
    throw new Error(`${label}_INVALID`);
  }
  return value;
}

function isWithin(parent, candidate) {
  const path = relative(parent, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

function assertExactBuildRecipe(recipe) {
  if (!hasExactDataKeys(recipe, Object.keys(PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE))
    || !hasExactDataArray(
      recipe.arguments,
      PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.arguments,
    )
    || canonicalJson(recipe) !== canonicalJson(PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE)) {
    throw new Error("IAT_B3_COMBINED_LAW_BUILD_RECIPE_DRIFT_HOLD");
  }
  return recipe;
}

function isSupportedNodeVersion(value) {
  const match = typeof value === "string"
    ? value.match(/^v?(\d+)\.(\d+)\.(\d+)$/u)
    : null;
  if (!match) return false;
  const observed = match.slice(1).map(Number);
  const minimum = [22, 13, 0];
  for (let index = 0; index < minimum.length; index += 1) {
    if (observed[index] > minimum[index]) return true;
    if (observed[index] < minimum[index]) return false;
  }
  return true;
}

function failureSummary(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replaceAll("\r\n", "\n").split("\n", 1)[0].slice(0, 512);
}

function preflightCheck(id, passed) {
  return Object.freeze({ id, passed: passed === true });
}

export function createCombinedLawBuildPreflight({
  generatedAt,
  declaredHeadSha,
  sourceObservation,
  sourceFailure = null,
  executedRunnerSha256,
  committedRunnerSha256,
  nodeVersion,
  hostPlatform,
  hostArchitecture,
  diskVolumePath,
  diskFreeBytes,
  diskFailure = null,
  identityObservation,
  containerObservation = null,
  containerFailure = null,
  toolchainObservation = null,
  toolchainFailure = null,
} = {}) {
  const declaredHeadValid = typeof declaredHeadSha === "string" && HEX_SHA1.test(declaredHeadSha);
  const sourceValid = hasExactDataKeys(
    sourceObservation,
    ["headSha", "treeSha", "statusPorcelain"],
  )
    && typeof sourceObservation.statusPorcelain === "string"
    && HEX_SHA1.test(sourceObservation.headSha)
    && HEX_SHA1.test(sourceObservation.treeSha);
  const sourceHeadMatches = sourceValid
    && declaredHeadValid
    && sourceObservation.headSha === declaredHeadSha;
  const sourceClean = sourceValid && sourceObservation.statusPorcelain === "";
  const runnerMatchesCommittedHead = sourceHeadMatches
    && typeof executedRunnerSha256 === "string"
    && HEX_SHA256.test(executedRunnerSha256)
    && typeof committedRunnerSha256 === "string"
    && HEX_SHA256.test(committedRunnerSha256)
    && executedRunnerSha256 === committedRunnerSha256;
  const hostSupported = hostPlatform === "linux" && hostArchitecture === "x64";
  const nodeSupported = isSupportedNodeVersion(nodeVersion);
  const diskSufficient = Number.isSafeInteger(diskFreeBytes)
    && diskFreeBytes >= COMBINED_LAW_BUILD_DISK_BUDGET.minimumFreeBytes;

  let recipePinned = true;
  try {
    assertExactBuildRecipe(PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE);
  } catch {
    recipePinned = false;
  }
  let containerPinned = false;
  try {
    if (containerObservation !== null) assertPinnedContainerObservation(containerObservation);
    containerPinned = containerObservation !== null;
  } catch {
    containerPinned = false;
  }
  let toolchainPinned = false;
  try {
    if (toolchainObservation !== null) assertPinnedToolchainObservation(toolchainObservation);
    toolchainPinned = toolchainObservation !== null;
  } catch {
    toolchainPinned = false;
  }
  const identityReady = identityObservation?.ready === true
    && Number.isSafeInteger(identityObservation.manifestByteLength)
    && identityObservation.manifestByteLength > 0
    && typeof identityObservation.manifestSha256 === "string"
    && HEX_SHA256.test(identityObservation.manifestSha256)
    && Number.isSafeInteger(identityObservation.ownerPolicyByteLength)
    && identityObservation.ownerPolicyByteLength > 0
    && typeof identityObservation.ownerPolicySha256 === "string"
    && HEX_SHA256.test(identityObservation.ownerPolicySha256)
    && typeof identityObservation.environmentBindingSha256 === "string"
    && HEX_SHA256.test(identityObservation.environmentBindingSha256);

  const checks = Object.freeze([
    preflightCheck("CANONICAL_GENERATED_AT", isCanonicalTimestamp(generatedAt)),
    preflightCheck("EXACT_SOURCE_HEAD_DECLARED", declaredHeadValid),
    preflightCheck("EXACT_SOURCE_OBSERVED", sourceValid),
    preflightCheck("EXACT_SOURCE_HEAD_MATCH", sourceHeadMatches),
    preflightCheck("REPOSITORY_CLEAN_TRACKED_AND_UNTRACKED", sourceClean),
    preflightCheck("EXECUTED_RUNNER_MATCHES_DECLARED_HEAD", runnerMatchesCommittedHead),
    preflightCheck("LINUX_AMD64_HOST", hostSupported),
    preflightCheck("HOST_NODE_AT_LEAST_22_13_0", nodeSupported),
    preflightCheck("PRODUCTION_COMBINED_IDENTITY_BINDING", identityReady),
    preflightCheck("PINNED_CONTAINER_PRESENT", containerPinned),
    preflightCheck("PINNED_CONTAINER_TOOLCHAIN", toolchainPinned),
    preflightCheck("BUILD_VOLUME_MINIMUM_24_GIB_FREE", diskSufficient),
    preflightCheck("FROZEN_PRODUCTION_BUILD_RECIPE", recipePinned),
  ]);
  const blockers = Object.freeze(checks.filter(({ passed }) => !passed).map(({ id }) => id));
  const status = blockers.length === 0
    ? COMBINED_LAW_BUILD_PREFLIGHT_READY
    : COMBINED_LAW_BUILD_PREFLIGHT_HOLD;
  const statusPorcelain = sourceValid ? sourceObservation.statusPorcelain : "";
  const core = {
    schema: COMBINED_LAW_BUILD_PREFLIGHT_SCHEMA,
    status,
    exitCode: status === COMBINED_LAW_BUILD_PREFLIGHT_READY ? 0 : 2,
    generatedAt: isCanonicalTimestamp(generatedAt) ? generatedAt : null,
    scope: "OFFLINE_PRE_BUILD_ELIGIBILITY_ONLY",
    buildExecuted: false,
    source: {
      declaredHeadSha: declaredHeadValid ? declaredHeadSha : null,
      observedHeadSha: sourceValid ? sourceObservation.headSha : null,
      observedTreeSha: sourceValid ? sourceObservation.treeSha : null,
      repositoryCleanTrackedAndUntracked: sourceClean,
      dirtyStatusEntryCount: sourceClean
        ? 0
        : statusPorcelain.split("\0").filter(Boolean).length,
      statusPorcelainSha256: sourceValid ? sha256(statusPorcelain) : null,
      observationFailure: sourceFailure,
      sourcePolicy: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.sourcePolicy,
    },
    tooling: {
      runnerPath: RUNNER_RELATIVE_PATH,
      executedRunnerSha256: typeof executedRunnerSha256 === "string"
        && HEX_SHA256.test(executedRunnerSha256)
        ? executedRunnerSha256
        : null,
      committedRunnerSha256: typeof committedRunnerSha256 === "string"
        && HEX_SHA256.test(committedRunnerSha256)
        ? committedRunnerSha256
        : null,
      executedRunnerMatchesDeclaredHead: runnerMatchesCommittedHead,
      hostNodeExactPin: null,
      hostNodeMinimumVersion: "22.13.0",
      ciNodeMajor: 24,
      observedNodeVersion: typeof nodeVersion === "string" ? nodeVersion : null,
      observedNodeSupported: nodeSupported,
    },
    host: {
      requiredPlatform: "linux",
      requiredArchitecture: "x64",
      observedPlatform: typeof hostPlatform === "string" ? hostPlatform : null,
      observedArchitecture: typeof hostArchitecture === "string" ? hostArchitecture : null,
      supported: hostSupported,
    },
    identityBinding: {
      manifestPath: IDENTITY_MANIFEST_RELATIVE_PATH,
      ownerPolicyPath: OWNER_POLICY_RELATIVE_PATH,
      requiredEnvironmentVariables: [...REQUIRED_IDENTITY_ENVIRONMENT_NAMES],
      manifestSha256: identityObservation?.manifestSha256 ?? null,
      manifestByteLength: identityObservation?.manifestByteLength ?? null,
      ownerPolicySha256: identityObservation?.ownerPolicySha256 ?? null,
      ownerPolicyByteLength: identityObservation?.ownerPolicyByteLength ?? null,
      environmentBindingSha256: identityObservation?.environmentBindingSha256 ?? null,
      canonicalProductionBindingReady: identityReady,
      failure: identityObservation?.failure ?? null,
    },
    container: {
      ...PINNED_COMBINED_LAW_BUILD_CONTAINER,
      localImageId: containerObservation?.localImageId ?? null,
      observedPlatform: containerObservation?.platform ?? null,
      pinnedObservationReady: containerPinned,
      failure: containerFailure,
    },
    toolchain: {
      expectedRustc: "rustc 1.97.1 (* 2026-07-14)",
      expectedCargo: "cargo 1.97.1 (* 2026-06-30)",
      expectedCargoBuildSbf: "solana-cargo-build-sbf 3.1.10",
      requestedPlatformToolsVersion: "v1.52",
      platformToolsAvailabilityProof:
        "PINNED_IMAGE_DIGEST_PLUS_SUCCESSFUL_SKIP_TOOLS_INSTALL_BUILD",
      observedRustc: toolchainObservation?.rustc ?? null,
      observedCargo: toolchainObservation?.cargo ?? null,
      observedCargoBuildSbf: toolchainObservation?.cargoBuildSbf ?? null,
      pinnedObservationReady: toolchainPinned,
      failure: toolchainFailure,
    },
    disk: {
      volumePath: typeof diskVolumePath === "string" ? diskVolumePath : null,
      observedFreeBytes: Number.isSafeInteger(diskFreeBytes) ? diskFreeBytes : null,
      ...COMBINED_LAW_BUILD_DISK_BUDGET,
      sufficient: diskSufficient,
      failure: diskFailure,
    },
    recipe: {
      recipeSha256: digestRecord(PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE),
      command: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.command,
      arguments: [...PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.arguments],
      productionFeature: "production-combined-hook",
      outputFileName: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.outputFileName,
      repetitions: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.repetitions,
      requiresIdenticalSha256:
        PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.requiresIdenticalSha256,
      requiresIdenticalByteLength:
        PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.requiresIdenticalByteLength,
      freshOutputAndTargetDirectories: true,
    },
    finalBinaryEvidenceRequired: {
      receiptSchema: COMBINED_LAW_BUILD_RECEIPT_SCHEMA,
      receiptStatus: COMBINED_LAW_BUILD_RECEIPT_STATUS,
      fields: [
        "source.declaredHeadSha",
        "source.observedTreeSha",
        "source.executedRunnerSha256",
        "source.committedRunnerSha256",
        "source.mountedInputSha256",
        "identityBinding.manifestSha256",
        "identityBinding.environmentBindingSha256",
        "container.platformManifestDigest",
        "container.localImageId",
        "toolchain.rustc",
        "toolchain.cargo",
        "toolchain.cargoBuildSbf",
        "recipe.recipeSha256",
        "artifact.byteLength",
        "artifact.sha256",
        "artifact.firstBuildSha256",
        "artifact.secondBuildSha256",
        "artifact.firstBuildLogSha256",
        "artifact.secondBuildLogSha256",
        "artifact.preservedArtifactSha256",
      ],
      unavailableUntilTwoBuildsComplete: true,
    },
    programDataBinding: COMBINED_LAW_PROGRAMDATA_BINDING,
    checks,
    blockers,
    safety: {
      publicNetworkWrites: false,
      signing: false,
      deployment: false,
      reproducibleBuildVerified: false,
      finalProgramDataBindingVerified: false,
      productionCandidate: false,
      mainnetExecutionAuthorized: false,
      mainnetStatus: COMBINED_LAW_BUILD_MAINNET_STATUS,
    },
  };
  const preflight = freezeResult({ ...core, preflightSha256: digestRecord(core) });
  return validateCombinedLawBuildPreflight(preflight);
}

export function validateCombinedLawBuildPreflight(preflight) {
  if (!preflight
    || typeof preflight !== "object"
    || Array.isArray(preflight)
    || preflight.schema !== COMBINED_LAW_BUILD_PREFLIGHT_SCHEMA
    || !Array.isArray(preflight.checks)
    || !Array.isArray(preflight.blockers)
    || preflight.buildExecuted !== false
    || preflight.scope !== "OFFLINE_PRE_BUILD_ELIGIBILITY_ONLY"
    || preflight.recipe?.recipeSha256
      !== digestRecord(PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE)
    || canonicalJson(preflight.programDataBinding)
      !== canonicalJson(COMBINED_LAW_PROGRAMDATA_BINDING)
    || preflight.safety?.publicNetworkWrites !== false
    || preflight.safety?.signing !== false
    || preflight.safety?.deployment !== false
    || preflight.safety?.reproducibleBuildVerified !== false
    || preflight.safety?.finalProgramDataBindingVerified !== false
    || preflight.safety?.productionCandidate !== false
    || preflight.safety?.mainnetExecutionAuthorized !== false
    || preflight.safety?.mainnetStatus !== COMBINED_LAW_BUILD_MAINNET_STATUS) {
    throw new Error("INVALID_IAT_B3_COMBINED_LAW_BUILD_PREFLIGHT");
  }
  const declaredHeadValid = typeof preflight.source?.declaredHeadSha === "string"
    && HEX_SHA1.test(preflight.source.declaredHeadSha);
  const sourceObserved = typeof preflight.source?.observedHeadSha === "string"
    && HEX_SHA1.test(preflight.source.observedHeadSha)
    && typeof preflight.source?.observedTreeSha === "string"
    && HEX_SHA1.test(preflight.source.observedTreeSha)
    && typeof preflight.source?.statusPorcelainSha256 === "string"
    && HEX_SHA256.test(preflight.source.statusPorcelainSha256);
  const sourceHeadMatches = declaredHeadValid
    && sourceObserved
    && preflight.source.declaredHeadSha === preflight.source.observedHeadSha;
  const sourceClean = sourceObserved
    && preflight.source.repositoryCleanTrackedAndUntracked === true
    && preflight.source.dirtyStatusEntryCount === 0
    && preflight.source.statusPorcelainSha256 === sha256("");
  const runnerMatches = sourceHeadMatches
    && typeof preflight.tooling?.executedRunnerSha256 === "string"
    && HEX_SHA256.test(preflight.tooling.executedRunnerSha256)
    && typeof preflight.tooling?.committedRunnerSha256 === "string"
    && HEX_SHA256.test(preflight.tooling.committedRunnerSha256)
    && preflight.tooling.executedRunnerSha256 === preflight.tooling.committedRunnerSha256
    && preflight.tooling.executedRunnerMatchesDeclaredHead === true;
  const hostSupported = preflight.host?.requiredPlatform === "linux"
    && preflight.host?.requiredArchitecture === "x64"
    && preflight.host?.observedPlatform === "linux"
    && preflight.host?.observedArchitecture === "x64"
    && preflight.host?.supported === true;
  const nodeSupported = preflight.tooling?.hostNodeExactPin === null
    && preflight.tooling?.hostNodeMinimumVersion === "22.13.0"
    && preflight.tooling?.ciNodeMajor === 24
    && isSupportedNodeVersion(preflight.tooling?.observedNodeVersion)
    && preflight.tooling?.observedNodeSupported === true;
  const identityReady = preflight.identityBinding?.manifestPath
      === IDENTITY_MANIFEST_RELATIVE_PATH
    && preflight.identityBinding?.ownerPolicyPath === OWNER_POLICY_RELATIVE_PATH
    && canonicalJson(preflight.identityBinding?.requiredEnvironmentVariables)
      === canonicalJson(REQUIRED_IDENTITY_ENVIRONMENT_NAMES)
    && typeof preflight.identityBinding?.manifestSha256 === "string"
    && HEX_SHA256.test(preflight.identityBinding.manifestSha256)
    && Number.isSafeInteger(preflight.identityBinding?.manifestByteLength)
    && preflight.identityBinding.manifestByteLength > 0
    && typeof preflight.identityBinding?.ownerPolicySha256 === "string"
    && HEX_SHA256.test(preflight.identityBinding.ownerPolicySha256)
    && Number.isSafeInteger(preflight.identityBinding?.ownerPolicyByteLength)
    && preflight.identityBinding.ownerPolicyByteLength > 0
    && typeof preflight.identityBinding?.environmentBindingSha256 === "string"
    && HEX_SHA256.test(preflight.identityBinding.environmentBindingSha256)
    && preflight.identityBinding.canonicalProductionBindingReady === true;
  let containerPinned = false;
  try {
    assertPinnedContainerObservation({
      image: preflight.container?.image,
      reviewedIndexDigest: preflight.container?.reviewedIndexDigest,
      platform: preflight.container?.observedPlatform,
      platformManifestDigest: preflight.container?.platformManifestDigest,
      executionReference: preflight.container?.executionReference,
      dockerEndpoint: preflight.container?.dockerEndpoint,
      localImageId: preflight.container?.localImageId,
      pullPolicy: preflight.container?.pullPolicy,
      networkMode: preflight.container?.networkMode,
    });
    containerPinned = preflight.container?.pinnedObservationReady === true;
  } catch {
    containerPinned = false;
  }
  let toolchainPinned = false;
  try {
    assertPinnedToolchainObservation({
      rustc: preflight.toolchain?.observedRustc,
      cargo: preflight.toolchain?.observedCargo,
      cargoBuildSbf: preflight.toolchain?.observedCargoBuildSbf,
    });
    toolchainPinned = preflight.toolchain?.pinnedObservationReady === true;
  } catch {
    toolchainPinned = false;
  }
  const diskSufficient = preflight.disk?.volumePath !== null
    && typeof preflight.disk?.volumePath === "string"
    && Number.isSafeInteger(preflight.disk?.observedFreeBytes)
    && preflight.disk.observedFreeBytes >= COMBINED_LAW_BUILD_DISK_BUDGET.minimumFreeBytes
    && preflight.disk.estimatedDualFreshBuildWorkspaceBytes
      === COMBINED_LAW_BUILD_DISK_BUDGET.estimatedDualFreshBuildWorkspaceBytes
    && preflight.disk.requiredPostRunReserveBytes
      === COMBINED_LAW_BUILD_DISK_BUDGET.requiredPostRunReserveBytes
    && preflight.disk.minimumFreeBytes === COMBINED_LAW_BUILD_DISK_BUDGET.minimumFreeBytes
    && preflight.disk.containerImageAlreadyPresentRequired === true
    && preflight.disk.containerImageBytesIncluded === false
    && preflight.disk.sufficient === true;
  const recipePinned = preflight.recipe?.recipeSha256
      === digestRecord(PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE)
    && preflight.recipe?.command === PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.command
    && hasExactDataArray(
      preflight.recipe?.arguments,
      PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.arguments,
    )
    && preflight.recipe?.productionFeature === "production-combined-hook"
    && preflight.recipe?.outputFileName
      === PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.outputFileName
    && preflight.recipe?.repetitions === 2
    && preflight.recipe?.requiresIdenticalSha256 === true
    && preflight.recipe?.requiresIdenticalByteLength === true
    && preflight.recipe?.freshOutputAndTargetDirectories === true;
  const expectedChecks = [
    preflightCheck("CANONICAL_GENERATED_AT", isCanonicalTimestamp(preflight.generatedAt)),
    preflightCheck("EXACT_SOURCE_HEAD_DECLARED", declaredHeadValid),
    preflightCheck("EXACT_SOURCE_OBSERVED", sourceObserved),
    preflightCheck("EXACT_SOURCE_HEAD_MATCH", sourceHeadMatches),
    preflightCheck("REPOSITORY_CLEAN_TRACKED_AND_UNTRACKED", sourceClean),
    preflightCheck("EXECUTED_RUNNER_MATCHES_DECLARED_HEAD", runnerMatches),
    preflightCheck("LINUX_AMD64_HOST", hostSupported),
    preflightCheck("HOST_NODE_AT_LEAST_22_13_0", nodeSupported),
    preflightCheck("PRODUCTION_COMBINED_IDENTITY_BINDING", identityReady),
    preflightCheck("PINNED_CONTAINER_PRESENT", containerPinned),
    preflightCheck("PINNED_CONTAINER_TOOLCHAIN", toolchainPinned),
    preflightCheck("BUILD_VOLUME_MINIMUM_24_GIB_FREE", diskSufficient),
    preflightCheck("FROZEN_PRODUCTION_BUILD_RECIPE", recipePinned),
  ];
  if (canonicalJson(preflight.checks) !== canonicalJson(expectedChecks)) {
    throw new Error("IAT_B3_COMBINED_LAW_PREFLIGHT_CHECK_SET_MISMATCH");
  }
  const failedCheckIds = expectedChecks
    .filter((check) => check?.passed !== true)
    .map((check) => check?.id);
  if (canonicalJson(failedCheckIds) !== canonicalJson(preflight.blockers)) {
    throw new Error("IAT_B3_COMBINED_LAW_PREFLIGHT_BLOCKER_SET_MISMATCH");
  }
  const ready = failedCheckIds.length === 0;
  if (preflight.status !== (ready
    ? COMBINED_LAW_BUILD_PREFLIGHT_READY
    : COMBINED_LAW_BUILD_PREFLIGHT_HOLD)
    || preflight.exitCode !== (ready ? 0 : 2)) {
    throw new Error("IAT_B3_COMBINED_LAW_PREFLIGHT_STATUS_MISMATCH");
  }
  const { preflightSha256, ...core } = preflight;
  if (typeof preflightSha256 !== "string"
    || !HEX_SHA256.test(preflightSha256)
    || preflightSha256 !== digestRecord(core)) {
    throw new Error("IAT_B3_COMBINED_LAW_PREFLIGHT_DIGEST_MISMATCH");
  }
  return preflight;
}

export function assertCleanSourceObservation({
  declaredHeadSha,
  observation,
  index,
  expectedTreeSha = null,
}) {
  if (!hasExactDataKeys(observation, ["headSha", "treeSha", "statusPorcelain"])) {
    throw new Error("IAT_B3_COMBINED_LAW_SOURCE_OBSERVATION_INVALID");
  }
  assertHex(observation.headSha, HEX_SHA1, "IAT_B3_COMBINED_LAW_OBSERVED_HEAD");
  assertHex(observation.treeSha, HEX_SHA1, "IAT_B3_COMBINED_LAW_OBSERVED_TREE");
  if (observation.headSha !== declaredHeadSha) {
    throw new Error(`IAT_B3_COMBINED_LAW_SOURCE_HEAD_MISMATCH_AT_${index}`);
  }
  if (observation.statusPorcelain !== "") {
    throw new Error(`IAT_B3_COMBINED_LAW_DIRTY_TRACKED_OR_UNTRACKED_HOLD_AT_${index}`);
  }
  if (expectedTreeSha !== null && observation.treeSha !== expectedTreeSha) {
    throw new Error(`IAT_B3_COMBINED_LAW_SOURCE_TREE_DRIFT_HOLD_AT_${index}`);
  }
  return observation.treeSha;
}

export function assertExactCleanSourceSequence({ declaredHeadSha, observations } = {}) {
  assertHex(declaredHeadSha, HEX_SHA1, "IAT_B3_EXACT_SOURCE_HEAD_SHA");
  if (!Array.isArray(observations) || observations.length < 3) {
    throw new Error("IAT_B3_COMBINED_LAW_SOURCE_REVALIDATIONS_REQUIRED");
  }
  let treeSha = null;
  for (const [index, observation] of observations.entries()) {
    treeSha = assertCleanSourceObservation({
      declaredHeadSha,
      observation,
      index,
      expectedTreeSha: treeSha,
    });
  }
  return Object.freeze({ headSha: declaredHeadSha, treeSha });
}

function assertMaterializedSourceObservation({
  declaredHeadSha,
  observation,
  index,
  expected = null,
}) {
  if (!hasExactDataKeys(observation, MATERIALIZED_SOURCE_OBSERVATION_KEYS)
    || observation.schema !== COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA
    || observation.declaredHeadSha !== declaredHeadSha
    || observation.ignoredWorktreeBytesIncluded !== false
    || observation.submodulePolicy !== COMBINED_LAW_SUBMODULE_POLICY
    || observation.lfsPolicy !== COMBINED_LAW_LFS_POLICY
    || !Number.isSafeInteger(observation.fileCount)
    || observation.fileCount <= 0
    || !Number.isSafeInteger(observation.byteLength)
    || observation.byteLength <= 0
    || !Number.isSafeInteger(observation.lfsPointerCount)
    || observation.lfsPointerCount < 0
    || observation.lfsPointerCount > observation.fileCount) {
    throw new Error(`IAT_B3_COMBINED_LAW_MATERIALIZED_SOURCE_OBSERVATION_INVALID_AT_${index}`);
  }
  assertHex(observation.declaredHeadSha, HEX_SHA1, "IAT_B3_COMBINED_LAW_MATERIALIZED_HEAD");
  assertHex(observation.treeSha, HEX_SHA1, "IAT_B3_COMBINED_LAW_MATERIALIZED_TREE");
  assertHex(
    observation.mountedInputSha256,
    HEX_SHA256,
    "IAT_B3_COMBINED_LAW_MOUNTED_INPUT_SHA256",
  );
  if (observation.mountedInputSha256 === "0".repeat(64)) {
    throw new Error("IAT_B3_COMBINED_LAW_MOUNTED_INPUT_SHA256_ZERO");
  }
  if (expected !== null && canonicalJson(observation) !== canonicalJson(expected)) {
    throw new Error(`IAT_B3_COMBINED_LAW_MATERIALIZED_SOURCE_DRIFT_HOLD_AT_${index}`);
  }
  return observation;
}

export function assertExactMaterializedSourceSequence({ declaredHeadSha, observations } = {}) {
  assertHex(declaredHeadSha, HEX_SHA1, "IAT_B3_EXACT_SOURCE_HEAD_SHA");
  if (!Array.isArray(observations) || observations.length < 3) {
    throw new Error("IAT_B3_COMBINED_LAW_MATERIALIZED_SOURCE_REVALIDATIONS_REQUIRED");
  }
  let expected = null;
  for (const [index, observation] of observations.entries()) {
    expected = assertMaterializedSourceObservation({
      declaredHeadSha,
      observation,
      index,
      expected,
    });
  }
  return expected;
}

export function assertPinnedContainerObservation(observation) {
  if (!hasExactDataKeys(observation, [
    "image",
    "reviewedIndexDigest",
    "platform",
    "platformManifestDigest",
    "executionReference",
    "dockerEndpoint",
    "localImageId",
    "pullPolicy",
    "networkMode",
  ])) throw new Error("IAT_B3_COMBINED_LAW_CONTAINER_OBSERVATION_INVALID");
  for (const key of [
    "image",
    "reviewedIndexDigest",
    "platform",
    "platformManifestDigest",
    "executionReference",
    "dockerEndpoint",
    "pullPolicy",
    "networkMode",
  ]) {
    if (observation[key] !== PINNED_COMBINED_LAW_BUILD_CONTAINER[key]) {
      throw new Error(`IAT_B3_COMBINED_LAW_CONTAINER_${key.toUpperCase()}_DRIFT_HOLD`);
    }
  }
  assertHex(observation.reviewedIndexDigest, CONTAINER_DIGEST, "IAT_B3_COMBINED_LAW_CONTAINER_INDEX_DIGEST");
  assertHex(observation.platformManifestDigest, CONTAINER_DIGEST, "IAT_B3_COMBINED_LAW_CONTAINER_PLATFORM_DIGEST");
  assertHex(observation.localImageId, CONTAINER_DIGEST, "IAT_B3_COMBINED_LAW_CONTAINER_IMAGE_ID");
  return observation;
}

export function assertPinnedToolchainObservation(observation) {
  if (!hasExactDataKeys(observation, ["rustc", "cargo", "cargoBuildSbf"])) {
    throw new Error("IAT_B3_COMBINED_LAW_TOOLCHAIN_OBSERVATION_INVALID");
  }
  if (!RUSTC_VERSION.test(observation.rustc)) {
    throw new Error("IAT_B3_COMBINED_LAW_RUSTC_VERSION_DRIFT_HOLD");
  }
  if (!CARGO_VERSION.test(observation.cargo)) {
    throw new Error("IAT_B3_COMBINED_LAW_CARGO_VERSION_DRIFT_HOLD");
  }
  if (!CARGO_BUILD_SBF_VERSION.test(observation.cargoBuildSbf)) {
    throw new Error("IAT_B3_COMBINED_LAW_CARGO_BUILD_SBF_VERSION_DRIFT_HOLD");
  }
  return observation;
}

function assertIdentityBinding(binding) {
  if (!hasExactDataKeys(binding, [
    "manifestPath",
    "manifestSha256",
    "environmentBindingSha256",
    "canonicalManifestReady",
  ])
    || binding.manifestPath !== IDENTITY_MANIFEST_RELATIVE_PATH
    || binding.canonicalManifestReady !== true) {
    throw new Error("IAT_B3_COMBINED_LAW_IDENTITY_BINDING_INVALID");
  }
  assertHex(binding.manifestSha256, HEX_SHA256, "IAT_B3_COMBINED_LAW_IDENTITY_MANIFEST_SHA256");
  assertHex(binding.environmentBindingSha256, HEX_SHA256, "IAT_B3_COMBINED_LAW_IDENTITY_ENVIRONMENT_SHA256");
  return binding;
}

function normalizeBuildArtifact(artifact, label) {
  if (!hasExactDataKeys(artifact, ["fileName", "bytes", "logSha256"])
    || artifact.fileName !== PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.outputFileName
    || !Buffer.isBuffer(artifact.bytes)
    || artifact.bytes.length === 0) {
    throw new Error(`IAT_B3_COMBINED_LAW_${label}_ARTIFACT_INVALID`);
  }
  assertHex(artifact.logSha256, HEX_SHA256, `IAT_B3_COMBINED_LAW_${label}_LOG_SHA256`);
  return Object.freeze({
    fileName: artifact.fileName,
    bytes: artifact.bytes,
    byteLength: artifact.bytes.length,
    sha256: sha256(artifact.bytes),
    logSha256: artifact.logSha256,
  });
}

function normalizePreservedArtifact(artifact) {
  if (!hasExactDataKeys(artifact, [
    "fileName",
    "bytes",
    "atomicNoOverwrite",
    "readbackVerified",
  ])
    || artifact.fileName !== PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.outputFileName
    || !Buffer.isBuffer(artifact.bytes)
    || artifact.bytes.length === 0
    || artifact.atomicNoOverwrite !== true
    || artifact.readbackVerified !== true) {
    throw new Error("IAT_B3_COMBINED_LAW_PRESERVED_ARTIFACT_INVALID");
  }
  return Object.freeze({
    fileName: artifact.fileName,
    bytes: artifact.bytes,
    byteLength: artifact.bytes.length,
    sha256: sha256(artifact.bytes),
  });
}

export function createCombinedLawBuildReceipt({
  generatedAt,
  declaredHeadSha,
  sourceObservations,
  materializedSourceObservations,
  runnerBinding,
  identityBinding,
  containerObservation,
  toolchainObservation,
  recipe = PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
  firstArtifact,
  secondArtifact,
  preservedArtifact,
} = {}) {
  if (!isCanonicalTimestamp(generatedAt)) {
    throw new Error("IAT_B3_COMBINED_LAW_RECEIPT_TIME_INVALID");
  }
  const source = assertExactCleanSourceSequence({ declaredHeadSha, observations: sourceObservations });
  const materializedSource = assertExactMaterializedSourceSequence({
    declaredHeadSha,
    observations: materializedSourceObservations,
  });
  if (materializedSource.treeSha !== source.treeSha) {
    throw new Error("IAT_B3_COMBINED_LAW_MATERIALIZED_TREE_HEAD_MISMATCH_HOLD");
  }
  assertIdentityBinding(identityBinding);
  assertPinnedContainerObservation(containerObservation);
  assertPinnedToolchainObservation(toolchainObservation);
  assertExactBuildRecipe(recipe);
  const first = normalizeBuildArtifact(firstArtifact, "FIRST");
  const second = normalizeBuildArtifact(secondArtifact, "SECOND");
  const preserved = normalizePreservedArtifact(preservedArtifact);
  if (first.byteLength !== second.byteLength) {
    throw new Error("IAT_B3_COMBINED_LAW_SBF_BYTE_LENGTH_MISMATCH_HOLD");
  }
  if (first.sha256 !== second.sha256) {
    throw new Error("IAT_B3_COMBINED_LAW_SBF_SHA256_MISMATCH_HOLD");
  }
  if (!first.bytes.equals(second.bytes)) {
    throw new Error("IAT_B3_COMBINED_LAW_SBF_BYTE_MISMATCH_HOLD");
  }
  if (preserved.byteLength !== first.byteLength
    || preserved.sha256 !== first.sha256
    || !preserved.bytes.equals(first.bytes)) {
    throw new Error("IAT_B3_COMBINED_LAW_PRESERVED_SBF_MISMATCH_HOLD");
  }
  if (!hasExactDataKeys(runnerBinding, ["executedRunnerSha256", "committedRunnerSha256"])
    || !HEX_SHA256.test(runnerBinding.executedRunnerSha256 ?? "")
    || runnerBinding.executedRunnerSha256 !== runnerBinding.committedRunnerSha256) {
    throw new Error("IAT_B3_COMBINED_LAW_RECEIPT_RUNNER_BINDING_INVALID");
  }

  const core = {
    schema: COMBINED_LAW_BUILD_RECEIPT_SCHEMA,
    status: COMBINED_LAW_BUILD_RECEIPT_STATUS,
    generatedAt,
    scope: "EXACT_CLEAN_SOURCE_PINNED_CONTAINER_DUAL_SBF_BYTE_EQUALITY_ONLY",
    source: {
      declaredHeadSha,
      observedHeadSha: source.headSha,
      observedTreeSha: source.treeSha,
      repositoryCleanTrackedAndUntracked: true,
      revalidationCount: sourceObservations.length,
      executedRunnerSha256: runnerBinding.executedRunnerSha256,
      committedRunnerSha256: runnerBinding.committedRunnerSha256,
      materializationSchema: materializedSource.schema,
      materializedTreeSha: materializedSource.treeSha,
      mountedInputSha256: materializedSource.mountedInputSha256,
      materializedFileCount: materializedSource.fileCount,
      materializedByteLength: materializedSource.byteLength,
      lfsPointerCount: materializedSource.lfsPointerCount,
      ignoredWorktreeBytesIncluded: false,
      submodulePolicy: COMBINED_LAW_SUBMODULE_POLICY,
      lfsPolicy: COMBINED_LAW_LFS_POLICY,
      materializationRevalidationCount: materializedSourceObservations.length,
    },
    identityBinding: { ...identityBinding },
    container: { ...containerObservation },
    toolchain: {
      ...toolchainObservation,
      platformToolsVersion: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.platformToolsVersion,
      preinstalledToolsOnly: true,
    },
    recipe: {
      recipeSha256: digestRecord(recipe),
      command: recipe.command,
      arguments: [...recipe.arguments],
      repetitions: recipe.repetitions,
      freshOutputAndTargetDirectories: true,
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
      identityAuthorityVerified: false,
      adversarialDevnetFinalBinaryAccepted: false,
      productionCandidate: false,
      mainnetExecutionAuthorized: false,
      reproducibleBuildVerified: false,
      mainnetStatus: COMBINED_LAW_BUILD_MAINNET_STATUS,
    },
  };
  const receipt = freezeResult({ ...core, receiptSha256: digestRecord(core) });
  validateCombinedLawBuildReceipt(receipt);
  return receipt;
}

export function validateCombinedLawBuildReceipt(receipt) {
  if (!hasExactDataKeys(receipt, RECEIPT_KEYS)
    || receipt.schema !== COMBINED_LAW_BUILD_RECEIPT_SCHEMA
    || receipt.status !== COMBINED_LAW_BUILD_RECEIPT_STATUS
    || receipt.scope !== "EXACT_CLEAN_SOURCE_PINNED_CONTAINER_DUAL_SBF_BYTE_EQUALITY_ONLY"
    || !isCanonicalTimestamp(receipt.generatedAt)) {
    throw new Error("INVALID_IAT_B3_COMBINED_LAW_BUILD_RECEIPT");
  }
  if (!hasExactDataKeys(receipt.source, SOURCE_KEYS)
    || receipt.source.declaredHeadSha !== receipt.source.observedHeadSha
    || receipt.source.repositoryCleanTrackedAndUntracked !== true
    || !Number.isSafeInteger(receipt.source.revalidationCount)
    || receipt.source.revalidationCount < 3
    || receipt.source.executedRunnerSha256 !== receipt.source.committedRunnerSha256
    || receipt.source.materializationSchema !== COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA
    || receipt.source.materializedTreeSha !== receipt.source.observedTreeSha
    || !Number.isSafeInteger(receipt.source.materializedFileCount)
    || receipt.source.materializedFileCount <= 0
    || !Number.isSafeInteger(receipt.source.materializedByteLength)
    || receipt.source.materializedByteLength <= 0
    || !Number.isSafeInteger(receipt.source.lfsPointerCount)
    || receipt.source.lfsPointerCount < 0
    || receipt.source.lfsPointerCount > receipt.source.materializedFileCount
    || receipt.source.ignoredWorktreeBytesIncluded !== false
    || receipt.source.submodulePolicy !== COMBINED_LAW_SUBMODULE_POLICY
    || receipt.source.lfsPolicy !== COMBINED_LAW_LFS_POLICY
    || !Number.isSafeInteger(receipt.source.materializationRevalidationCount)
    || receipt.source.materializationRevalidationCount < 3) {
    throw new Error("INVALID_IAT_B3_COMBINED_LAW_BUILD_SOURCE_BINDING");
  }
  assertHex(receipt.source.declaredHeadSha, HEX_SHA1, "IAT_B3_COMBINED_LAW_RECEIPT_HEAD");
  assertHex(receipt.source.observedTreeSha, HEX_SHA1, "IAT_B3_COMBINED_LAW_RECEIPT_TREE");
  assertHex(
    receipt.source.executedRunnerSha256,
    HEX_SHA256,
    "IAT_B3_COMBINED_LAW_RECEIPT_RUNNER_SHA256",
  );
  assertHex(
    receipt.source.mountedInputSha256,
    HEX_SHA256,
    "IAT_B3_COMBINED_LAW_RECEIPT_MOUNTED_INPUT_SHA256",
  );
  if (receipt.source.mountedInputSha256 === "0".repeat(64)) {
    throw new Error("INVALID_IAT_B3_COMBINED_LAW_BUILD_SOURCE_BINDING");
  }
  if (!hasExactDataKeys(receipt.identityBinding, IDENTITY_BINDING_KEYS)) {
    throw new Error("INVALID_IAT_B3_COMBINED_LAW_BUILD_IDENTITY_BINDING");
  }
  assertIdentityBinding(receipt.identityBinding);
  if (!hasExactDataKeys(receipt.container, CONTAINER_KEYS)) {
    throw new Error("INVALID_IAT_B3_COMBINED_LAW_BUILD_CONTAINER");
  }
  assertPinnedContainerObservation(receipt.container);
  if (!hasExactDataKeys(receipt.toolchain, TOOLCHAIN_KEYS)
    || receipt.toolchain.platformToolsVersion
      !== PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.platformToolsVersion
    || receipt.toolchain.preinstalledToolsOnly !== true) {
    throw new Error("INVALID_IAT_B3_COMBINED_LAW_BUILD_TOOLCHAIN");
  }
  assertPinnedToolchainObservation({
    rustc: receipt.toolchain.rustc,
    cargo: receipt.toolchain.cargo,
    cargoBuildSbf: receipt.toolchain.cargoBuildSbf,
  });
  if (!hasExactDataKeys(receipt.recipe, RECIPE_KEYS)
    || receipt.recipe.recipeSha256 !== digestRecord(PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE)
    || receipt.recipe.command !== PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.command
    || !hasExactDataArray(
      receipt.recipe.arguments,
      PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.arguments,
    )
    || receipt.recipe.repetitions !== 2
    || receipt.recipe.freshOutputAndTargetDirectories !== true) {
    throw new Error("INVALID_IAT_B3_COMBINED_LAW_BUILD_RECIPE");
  }
  if (!hasExactDataKeys(receipt.artifact, ARTIFACT_KEYS)
    || receipt.artifact.fileName !== PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.outputFileName
    || !Number.isSafeInteger(receipt.artifact.byteLength)
    || receipt.artifact.byteLength <= 0
    || receipt.artifact.sha256 !== receipt.artifact.firstBuildSha256
    || receipt.artifact.sha256 !== receipt.artifact.secondBuildSha256
    || receipt.artifact.sha256 !== receipt.artifact.preservedArtifactSha256
    || receipt.artifact.byteLength !== receipt.artifact.preservedArtifactByteLength
    || receipt.artifact.identicalByteLength !== true
    || receipt.artifact.identicalSha256 !== true
    || receipt.artifact.identicalBytes !== true
    || receipt.artifact.preservedOutputAtomicNoOverwrite !== true
    || receipt.artifact.preservedOutputReadbackVerified !== true) {
    throw new Error("INVALID_IAT_B3_COMBINED_LAW_BUILD_ARTIFACT");
  }
  for (const [value, label] of [
    [receipt.artifact.sha256, "IAT_B3_COMBINED_LAW_RECEIPT_ARTIFACT_SHA256"],
    [receipt.artifact.preservedArtifactSha256, "IAT_B3_COMBINED_LAW_RECEIPT_PRESERVED_SHA256"],
    [receipt.artifact.firstBuildLogSha256, "IAT_B3_COMBINED_LAW_RECEIPT_FIRST_LOG_SHA256"],
    [receipt.artifact.secondBuildLogSha256, "IAT_B3_COMBINED_LAW_RECEIPT_SECOND_LOG_SHA256"],
    [receipt.receiptSha256, "IAT_B3_COMBINED_LAW_RECEIPT_SHA256"],
  ]) assertHex(value, HEX_SHA256, label);
  if (!hasExactDataKeys(receipt.safety, SAFETY_KEYS)
    || receipt.safety.publicNetworkWrites !== false
    || receipt.safety.signing !== false
    || receipt.safety.deployment !== false
    || receipt.safety.identityAuthorityVerified !== false
    || receipt.safety.adversarialDevnetFinalBinaryAccepted !== false
    || receipt.safety.productionCandidate !== false
    || receipt.safety.mainnetExecutionAuthorized !== false
    || receipt.safety.reproducibleBuildVerified !== false
    || receipt.safety.mainnetStatus !== COMBINED_LAW_BUILD_MAINNET_STATUS) {
    throw new Error("INVALID_IAT_B3_COMBINED_LAW_BUILD_SAFETY_BOUNDARY");
  }
  const { receiptSha256, ...core } = receipt;
  if (receiptSha256 !== digestRecord(core)) {
    throw new Error("IAT_B3_COMBINED_LAW_BUILD_RECEIPT_DIGEST_MISMATCH");
  }
  return receipt;
}

function execute(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim().slice(-4_096);
    const reason = result.error instanceof Error ? result.error.message : `exit ${String(result.status)}`;
    throw new Error(`IAT_B3_COMBINED_LAW_COMMAND_FAILED: ${command}: ${reason}${output ? `\n${output}` : ""}`);
  }
  return Object.freeze({ stdout: result.stdout ?? "", stderr: result.stderr ?? "" });
}

function executeBinary(command, arguments_, options = {}) {
  const result = spawnSync(command, arguments_, {
    cwd: options.cwd,
    env: options.env,
    input: options.input,
    encoding: null,
    maxBuffer: options.maxBuffer ?? 512 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0 || !Buffer.isBuffer(result.stdout)) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString("utf8") : "";
    const output = stderr.trim().slice(-4_096);
    const reason = result.error instanceof Error ? result.error.message : `exit ${String(result.status)}`;
    throw new Error(`IAT_B3_COMBINED_LAW_COMMAND_FAILED: ${command}: ${reason}${output ? `\n${output}` : ""}`);
  }
  return result.stdout;
}

export function createExactSourceGitEnvironment(environment = process.env) {
  if (!environment || typeof environment !== "object" || Array.isArray(environment)) {
    throw new Error("IAT_B3_COMBINED_LAW_GIT_ENVIRONMENT_INVALID");
  }
  const scrubbed = {};
  for (const [name, value] of Object.entries(environment)) {
    if (name.toUpperCase().startsWith("GIT_") || value === undefined) continue;
    scrubbed[name] = String(value);
  }
  return Object.freeze({
    ...scrubbed,
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: NULL_GIT_CONFIG_PATH,
  });
}

function resolveLinuxGitControlTarget(controlValue) {
  if (typeof controlValue !== "string"
    || controlValue.length === 0
    || /[\r\n\0]/u.test(controlValue)) {
    throw new Error("IAT_B3_EXACT_SOURCE_WSL_GITDIR_CONTROL_INVALID");
  }
  const windowsPath = /^(?<drive>[A-Za-z]):[\\/](?<path>.+)$/u.exec(controlValue);
  const translated = windowsPath?.groups
    ? `/mnt/${windowsPath.groups.drive.toLowerCase()}/${windowsPath.groups.path.replaceAll("\\", "/")}`
    : controlValue;
  if (!translated.startsWith("/")) {
    throw new Error("IAT_B3_EXACT_SOURCE_WSL_GITDIR_CONTROL_INVALID");
  }
  return realpathSync(translated);
}

function executeExactSourceGit(
  repositoryRoot,
  arguments_,
  { binary = false, ...options } = {},
) {
  const executeGit = binary ? executeBinary : execute;
  let repositoryArguments = ["-C", repositoryRoot];
  if (process.platform === "linux") {
    const controlPath = join(repositoryRoot, ".git");
    let stat = null;
    try {
      stat = lstatSync(controlPath);
    } catch {
      stat = null;
    }
    if (stat?.isFile() && !stat.isSymbolicLink()) {
      const control = readFileSync(controlPath, "utf8").trim();
      const controlMatch = /^gitdir: (?<path>[^\r\n]+)$/u.exec(control);
      if (!controlMatch?.groups?.path) {
        throw new Error("IAT_B3_EXACT_SOURCE_WSL_GITDIR_CONTROL_INVALID");
      }
      const gitDirectory = resolveLinuxGitControlTarget(controlMatch.groups.path);
      const gitDirectoryStat = lstatSync(gitDirectory);
      if (!gitDirectoryStat.isDirectory()
        || gitDirectoryStat.isSymbolicLink()
        || !gitDirectory.replaceAll("\\", "/").includes("/.git/worktrees/")) {
        throw new Error("IAT_B3_EXACT_SOURCE_WSL_GITDIR_BOUNDARY_INVALID");
      }
      const backlinkPath = join(gitDirectory, "gitdir");
      const backlinkStat = lstatSync(backlinkPath);
      if (!backlinkStat.isFile() || backlinkStat.isSymbolicLink()) {
        throw new Error("IAT_B3_EXACT_SOURCE_WSL_GITDIR_BACKLINK_INVALID");
      }
      const backlinkControlPath = resolveLinuxGitControlTarget(
        readFileSync(backlinkPath, "utf8").trim(),
      );
      if (backlinkControlPath !== realpathSync(controlPath)) {
        throw new Error("IAT_B3_EXACT_SOURCE_WSL_GITDIR_BACKLINK_MISMATCH");
      }
      repositoryArguments = [`--git-dir=${gitDirectory}`, `--work-tree=${repositoryRoot}`];
    }
  }
  return executeGit("git", [
    "--no-replace-objects",
    ...repositoryArguments,
    ...arguments_,
  ], {
    ...options,
    env: createExactSourceGitEnvironment(process.env),
  });
}

export function createExactSourceBuildRoot({ prefix = BUILD_ROOT_PREFIX } = {}) {
  if (typeof prefix !== "string"
    || !/^iat-b3-[a-z0-9-]+-sbf-$/u.test(prefix)) {
    throw new Error("IAT_B3_EXACT_SOURCE_BUILD_ROOT_PREFIX_INVALID");
  }
  const realTemporaryRoot = realpathSync(tmpdir());
  const created = mkdtempSync(join(realTemporaryRoot, prefix));
  const realBuildRoot = realpathSync(created);
  const stat = lstatSync(realBuildRoot);
  if (!stat.isDirectory()
    || stat.isSymbolicLink()
    || dirname(realBuildRoot) !== realTemporaryRoot
    || !basename(realBuildRoot).startsWith(prefix)) {
    throw new Error("IAT_B3_EXACT_SOURCE_BUILD_ROOT_CREATION_BOUNDARY_INVALID");
  }
  ACTIVE_BUILD_ROOTS.set(realBuildRoot, prefix);
  return realBuildRoot;
}

export function removeExactSourceBuildRoot(buildRoot) {
  const prefix = typeof buildRoot === "string" ? ACTIVE_BUILD_ROOTS.get(buildRoot) : null;
  if (!prefix) {
    throw new Error("IAT_B3_EXACT_SOURCE_BUILD_ROOT_NOT_PROCESS_CREATED");
  }
  const realTemporaryRoot = realpathSync(tmpdir());
  const realBuildRoot = realpathSync(buildRoot);
  if (realBuildRoot !== buildRoot
    || dirname(realBuildRoot) !== realTemporaryRoot
    || !basename(realBuildRoot).startsWith(prefix)) {
    throw new Error("IAT_B3_EXACT_SOURCE_BUILD_ROOT_CLEANUP_BOUNDARY_INVALID");
  }
  restoreDirectoryRemovalPermissions(realBuildRoot, realBuildRoot);
  rmSync(realBuildRoot, { recursive: true, force: true });
  ACTIVE_BUILD_ROOTS.delete(realBuildRoot);
}

export function createCombinedLawBuildRoot() {
  return createExactSourceBuildRoot({ prefix: BUILD_ROOT_PREFIX });
}

export function removeSelfCreatedBuildRoot(buildRoot) {
  return removeExactSourceBuildRoot(buildRoot);
}

function restoreDirectoryRemovalPermissions(directory, boundary) {
  const resolvedDirectory = resolve(directory);
  if (
    resolvedDirectory !== boundary
    && !isWithin(boundary, resolvedDirectory)
  ) {
    throw new Error("IAT_B3_COMBINED_LAW_BUILD_ROOT_CLEANUP_PATH_ESCAPE");
  }
  const stat = lstatSync(resolvedDirectory);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    throw new Error("IAT_B3_COMBINED_LAW_BUILD_ROOT_CLEANUP_DIRECTORY_INVALID");
  }

  // Exact-source materialization deliberately removes owner write permission.
  // Restore it only inside the process-branded, already boundary-checked temp
  // root so POSIX cleanup can unlink files from every nested directory. Never
  // follow symlinks while reopening directory permissions.
  chmodSync(resolvedDirectory, 0o700);
  for (const entry of readdirSync(resolvedDirectory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    restoreDirectoryRemovalPermissions(join(resolvedDirectory, entry.name), boundary);
  }
}

function decodeExactUtf8(bytes, label) {
  try {
    return UTF8_DECODER.decode(bytes);
  } catch {
    throw new Error(`${label}_NON_UTF8_HOLD`);
  }
}

function assertCanonicalGitPath(path) {
  if (typeof path !== "string"
    || path.length === 0
    || path.startsWith("/")
    || path.includes("\\")
    || /[\r\n\0]/u.test(path)
    || path.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("IAT_B3_COMBINED_LAW_GIT_TREE_PATH_UNSAFE");
  }
  return path;
}

export function parseExactGitTreeListing(listingBytes) {
  if (!Buffer.isBuffer(listingBytes) || listingBytes.length === 0) {
    throw new Error("IAT_B3_COMBINED_LAW_GIT_TREE_LISTING_REQUIRED");
  }
  const descriptors = [];
  const seenPaths = new Set();
  let cursor = 0;
  while (cursor < listingBytes.length) {
    const end = listingBytes.indexOf(0, cursor);
    if (end < 0 || end === cursor) {
      throw new Error("IAT_B3_COMBINED_LAW_GIT_TREE_LISTING_MALFORMED");
    }
    const record = listingBytes.subarray(cursor, end);
    cursor = end + 1;
    const separator = record.indexOf(9);
    if (separator <= 0 || separator === record.length - 1) {
      throw new Error("IAT_B3_COMBINED_LAW_GIT_TREE_LISTING_MALFORMED");
    }
    const metadata = decodeExactUtf8(
      record.subarray(0, separator),
      "IAT_B3_COMBINED_LAW_GIT_TREE_METADATA",
    );
    const match = /^(?<gitMode>[0-7]{6}) (?<type>blob|commit) (?<gitObjectSha1>[0-9a-f]{40})$/u.exec(metadata);
    if (!match?.groups) {
      throw new Error("IAT_B3_COMBINED_LAW_GIT_TREE_ENTRY_INVALID");
    }
    const path = assertCanonicalGitPath(decodeExactUtf8(
      record.subarray(separator + 1),
      "IAT_B3_COMBINED_LAW_GIT_TREE_PATH",
    ));
    if (seenPaths.has(path)) throw new Error("IAT_B3_COMBINED_LAW_GIT_TREE_DUPLICATE_PATH");
    seenPaths.add(path);
    if (match.groups.type === "commit" || match.groups.gitMode === "160000") {
      throw new Error("IAT_B3_COMBINED_LAW_SUBMODULE_GITLINK_FORBIDDEN_HOLD");
    }
    if (match.groups.type !== "blob"
      || (match.groups.gitMode !== "100644" && match.groups.gitMode !== "100755")) {
      throw new Error("IAT_B3_COMBINED_LAW_NONREGULAR_GIT_ENTRY_FORBIDDEN_HOLD");
    }
    descriptors.push(Object.freeze({
      path,
      gitMode: match.groups.gitMode,
      gitObjectSha1: match.groups.gitObjectSha1,
    }));
  }
  if (descriptors.length === 0) {
    throw new Error("IAT_B3_COMBINED_LAW_GIT_TREE_EMPTY_HOLD");
  }
  return Object.freeze(descriptors);
}

export function parseExactGitBlobBatchResponse({ descriptors, response } = {}) {
  if (!Array.isArray(descriptors)
    || descriptors.length === 0
    || descriptors.some((descriptor) => !hasExactDataKeys(
      descriptor,
      ["path", "gitMode", "gitObjectSha1"],
    ))
    || !Buffer.isBuffer(response)) {
    throw new Error("IAT_B3_COMBINED_LAW_GIT_BLOB_BATCH_INPUT_INVALID");
  }
  const files = [];
  let cursor = 0;
  for (const descriptor of descriptors) {
    const headerEnd = response.indexOf(10, cursor);
    if (headerEnd < 0) throw new Error("IAT_B3_COMBINED_LAW_GIT_BLOB_BATCH_MALFORMED");
    const header = decodeExactUtf8(
      response.subarray(cursor, headerEnd),
      "IAT_B3_COMBINED_LAW_GIT_BLOB_HEADER",
    );
    const match = /^(?<gitObjectSha1>[0-9a-f]{40}) blob (?<byteLength>0|[1-9][0-9]*)$/u.exec(header);
    if (!match?.groups || match.groups.gitObjectSha1 !== descriptor.gitObjectSha1) {
      throw new Error("IAT_B3_COMBINED_LAW_GIT_BLOB_BATCH_BINDING_MISMATCH");
    }
    const byteLength = Number(match.groups.byteLength);
    if (!Number.isSafeInteger(byteLength) || byteLength < 0) {
      throw new Error("IAT_B3_COMBINED_LAW_GIT_BLOB_SIZE_INVALID");
    }
    const start = headerEnd + 1;
    const end = start + byteLength;
    if (end >= response.length || response[end] !== 10) {
      throw new Error("IAT_B3_COMBINED_LAW_GIT_BLOB_BATCH_TRUNCATED");
    }
    const bytes = Buffer.from(response.subarray(start, end));
    if (gitBlobSha1(bytes) !== descriptor.gitObjectSha1) {
      throw new Error("IAT_B3_COMBINED_LAW_GIT_BLOB_SHA1_MISMATCH_HOLD");
    }
    files.push(Object.freeze({ ...descriptor, bytes }));
    cursor = end + 1;
  }
  if (cursor !== response.length) {
    throw new Error("IAT_B3_COMBINED_LAW_GIT_BLOB_BATCH_TRAILING_DATA");
  }
  return Object.freeze(files);
}

function readExactGitBlobs(repositoryRoot, descriptors) {
  const request = Buffer.from(`${descriptors.map(({ gitObjectSha1 }) => gitObjectSha1).join("\n")}\n`);
  const response = executeExactSourceGit(repositoryRoot, [
    "cat-file",
    "--batch",
  ], { binary: true, input: request });
  return parseExactGitBlobBatchResponse({ descriptors, response });
}

function isCanonicalLfsPointer(bytes) {
  const prefix = Buffer.from("version https://git-lfs.github.com/spec/v1\n", "utf8");
  if (!bytes.subarray(0, prefix.length).equals(prefix)) return false;
  const text = decodeExactUtf8(bytes, "IAT_B3_COMBINED_LAW_LFS_POINTER");
  if (!/^version https:\/\/git-lfs\.github\.com\/spec\/v1\noid sha256:[0-9a-f]{64}\nsize (?:0|[1-9][0-9]*)\n?$/u.test(text)) {
    throw new Error("IAT_B3_COMBINED_LAW_LFS_POINTER_NONCANONICAL_HOLD");
  }
  return true;
}

function exactSourceEntryFromFile(file) {
  if (!hasExactDataKeys(file, ["path", "gitMode", "gitObjectSha1", "bytes"])
    || !Buffer.isBuffer(file.bytes)) {
    throw new Error("IAT_B3_COMBINED_LAW_SOURCE_MATERIALIZATION_FILE_INVALID");
  }
  const path = assertCanonicalGitPath(file.path);
  if ((file.gitMode !== "100644" && file.gitMode !== "100755")
    || !HEX_SHA1.test(file.gitObjectSha1)
    || gitBlobSha1(file.bytes) !== file.gitObjectSha1) {
    throw new Error("IAT_B3_COMBINED_LAW_SOURCE_MATERIALIZATION_BLOB_DRIFT_HOLD");
  }
  return Object.freeze({
    path,
    gitMode: file.gitMode,
    gitObjectSha1: file.gitObjectSha1,
    byteLength: file.bytes.length,
    sha256: sha256(file.bytes),
    lfsPointer: isCanonicalLfsPointer(file.bytes),
  });
}

function expectedSourceDirectories(entries) {
  const directories = new Set();
  for (const entry of entries) {
    const parts = entry.path.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      directories.add(parts.slice(0, index).join("/"));
    }
  }
  return directories;
}

function walkMaterializedSource(root) {
  const files = [];
  const directories = new Set();
  const visit = (relativeDirectory) => {
    const absoluteDirectory = relativeDirectory
      ? join(root, ...relativeDirectory.split("/"))
      : root;
    const entries = readdirSync(absoluteDirectory, { withFileTypes: true })
      .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      assertCanonicalGitPath(relativePath);
      const absolutePath = join(root, ...relativePath.split("/"));
      const stat = lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        throw new Error("IAT_B3_COMBINED_LAW_MATERIALIZED_SOURCE_SYMLINK_HOLD");
      }
      if (stat.isDirectory()) {
        directories.add(relativePath);
        visit(relativePath);
      } else if (stat.isFile()) {
        files.push(Object.freeze({ relativePath, stat }));
      } else {
        throw new Error("IAT_B3_COMBINED_LAW_MATERIALIZED_SOURCE_NONREGULAR_HOLD");
      }
    }
  };
  visit("");
  return Object.freeze({ files: Object.freeze(files), directories });
}

function mountedInputDigest({ declaredHeadSha, treeSha, entries }) {
  if (!Array.isArray(entries)
    || entries.length === 0
    || entries.some((entry) => !hasExactDataKeys(entry, MATERIALIZED_SOURCE_ENTRY_KEYS))) {
    throw new Error("IAT_B3_COMBINED_LAW_MOUNTED_INPUT_LEDGER_INVALID");
  }
  return digestRecord({
    schema: COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA,
    declaredHeadSha,
    treeSha,
    entries,
  });
}

export function materializeExactSourceSnapshot({
  buildRoot,
  declaredHeadSha,
  treeSha,
  files,
} = {}) {
  assertHex(declaredHeadSha, HEX_SHA1, "IAT_B3_EXACT_SOURCE_HEAD_SHA");
  assertHex(treeSha, HEX_SHA1, "IAT_B3_COMBINED_LAW_EXACT_TREE_SHA");
  if (typeof buildRoot !== "string" || !ACTIVE_BUILD_ROOTS.has(buildRoot)) {
    throw new Error("IAT_B3_COMBINED_LAW_SOURCE_REQUIRES_PROCESS_BUILD_ROOT");
  }
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("IAT_B3_COMBINED_LAW_SOURCE_MATERIALIZATION_FILES_REQUIRED");
  }
  const snapshotRoot = join(buildRoot, MATERIALIZED_SOURCE_DIRECTORY);
  assertFreshDirectory(snapshotRoot);
  const seenPaths = new Set();
  const sourceEntries = [];
  for (const file of files) {
    const sourceEntry = exactSourceEntryFromFile(file);
    if (seenPaths.has(sourceEntry.path)) {
      throw new Error("IAT_B3_COMBINED_LAW_SOURCE_MATERIALIZATION_DUPLICATE_PATH");
    }
    seenPaths.add(sourceEntry.path);
    const destination = join(snapshotRoot, ...sourceEntry.path.split("/"));
    if (!isWithin(snapshotRoot, destination)) {
      throw new Error("IAT_B3_COMBINED_LAW_SOURCE_MATERIALIZATION_PATH_ESCAPE");
    }
    mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
    writeFileSync(destination, file.bytes, {
      flag: "wx",
      mode: sourceEntry.gitMode === "100755" ? 0o500 : 0o400,
    });
    const written = readFileSync(destination);
    if (!written.equals(file.bytes)
      || gitBlobSha1(written) !== sourceEntry.gitObjectSha1
      || sha256(written) !== sourceEntry.sha256) {
      throw new Error("IAT_B3_COMBINED_LAW_SOURCE_MATERIALIZATION_WRITE_DRIFT_HOLD");
    }
    chmodSync(destination, sourceEntry.gitMode === "100755" ? 0o555 : 0o444);
    sourceEntries.push(sourceEntry);
  }
  sourceEntries.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  const directories = [...expectedSourceDirectories(sourceEntries)]
    .sort((left, right) => right.split("/").length - left.split("/").length);
  for (const directory of directories) {
    chmodSync(join(snapshotRoot, ...directory.split("/")), 0o555);
  }
  chmodSync(snapshotRoot, 0o555);
  const entries = Object.freeze(sourceEntries);
  const snapshot = freezeResult({
    root: snapshotRoot,
    declaredHeadSha,
    treeSha,
    mountedInputSha256: mountedInputDigest({ declaredHeadSha, treeSha, entries }),
    fileCount: entries.length,
    byteLength: entries.reduce((total, entry) => total + entry.byteLength, 0),
    lfsPointerCount: entries.filter(({ lfsPointer }) => lfsPointer).length,
    ignoredWorktreeBytesIncluded: false,
    submodulePolicy: COMBINED_LAW_SUBMODULE_POLICY,
    lfsPolicy: COMBINED_LAW_LFS_POLICY,
    entries,
  });
  MATERIALIZED_SOURCE_SNAPSHOTS.add(snapshot);
  observeMaterializedSourceSnapshot(snapshot);
  return snapshot;
}

export function observeMaterializedSourceSnapshot(snapshot) {
  if (!MATERIALIZED_SOURCE_SNAPSHOTS.has(snapshot)) {
    throw new Error("IAT_B3_COMBINED_LAW_MATERIALIZED_SOURCE_NOT_PROCESS_CREATED");
  }
  const walked = walkMaterializedSource(snapshot.root);
  const expectedDirectories = expectedSourceDirectories(snapshot.entries);
  if (walked.files.length !== snapshot.entries.length
    || walked.directories.size !== expectedDirectories.size
    || [...walked.directories].some((path) => !expectedDirectories.has(path))) {
    throw new Error("IAT_B3_COMBINED_LAW_MATERIALIZED_SOURCE_PATH_SET_DRIFT_HOLD");
  }
  const observedByPath = new Map(walked.files.map((file) => [file.relativePath, file]));
  if (observedByPath.size !== walked.files.length) {
    throw new Error("IAT_B3_COMBINED_LAW_MATERIALIZED_SOURCE_PATH_SET_DRIFT_HOLD");
  }
  const observedEntries = [];
  for (const expected of snapshot.entries) {
    const observed = observedByPath.get(expected.path);
    if (!observed) {
      throw new Error("IAT_B3_COMBINED_LAW_MATERIALIZED_SOURCE_PATH_SET_DRIFT_HOLD");
    }
    const bytes = readFileSync(join(snapshot.root, ...expected.path.split("/")));
    const executable = (observed.stat.mode & 0o111) !== 0;
    if (bytes.length !== expected.byteLength
      || sha256(bytes) !== expected.sha256
      || gitBlobSha1(bytes) !== expected.gitObjectSha1
      || isCanonicalLfsPointer(bytes) !== expected.lfsPointer
      || (process.platform !== "win32" && executable !== (expected.gitMode === "100755"))) {
      throw new Error("IAT_B3_COMBINED_LAW_MATERIALIZED_SOURCE_CONTENT_DRIFT_HOLD");
    }
    observedEntries.push(expected);
  }
  const mountedInputSha256 = mountedInputDigest({
    declaredHeadSha: snapshot.declaredHeadSha,
    treeSha: snapshot.treeSha,
    entries: observedEntries,
  });
  if (mountedInputSha256 !== snapshot.mountedInputSha256) {
    throw new Error("IAT_B3_COMBINED_LAW_MOUNTED_INPUT_DIGEST_DRIFT_HOLD");
  }
  return Object.freeze({
    schema: COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA,
    declaredHeadSha: snapshot.declaredHeadSha,
    treeSha: snapshot.treeSha,
    mountedInputSha256,
    fileCount: snapshot.fileCount,
    byteLength: snapshot.byteLength,
    lfsPointerCount: snapshot.lfsPointerCount,
    ignoredWorktreeBytesIncluded: false,
    submodulePolicy: COMBINED_LAW_SUBMODULE_POLICY,
    lfsPolicy: COMBINED_LAW_LFS_POLICY,
  });
}

export function loadExactDeclaredHeadSource({ repositoryRoot, buildRoot, declaredHeadSha }) {
  const resolvedCommit = executeExactSourceGit(repositoryRoot, [
    "rev-parse",
    "--verify",
    `${declaredHeadSha}^{commit}`,
  ]).stdout.trim();
  if (resolvedCommit !== declaredHeadSha) {
    throw new Error("IAT_B3_COMBINED_LAW_DECLARED_HEAD_OBJECT_MISMATCH_HOLD");
  }
  const treeSha = executeExactSourceGit(repositoryRoot, [
    "rev-parse",
    `${declaredHeadSha}^{tree}`,
  ]).stdout.trim();
  assertHex(treeSha, HEX_SHA1, "IAT_B3_COMBINED_LAW_EXACT_TREE_SHA");
  const descriptors = parseExactGitTreeListing(executeExactSourceGit(repositoryRoot, [
    "ls-tree",
    "-r",
    "-z",
    "--full-tree",
    treeSha,
  ], { binary: true }));
  const files = readExactGitBlobs(repositoryRoot, descriptors);
  return materializeExactSourceSnapshot({
    buildRoot,
    declaredHeadSha,
    treeSha,
    files,
  });
}

function readExactMaterializedPacket({ snapshot, relativePath, expectedSha256, label }) {
  observeMaterializedSourceSnapshot(snapshot);
  const absolutePath = resolve(snapshot.root, ...relativePath.split("/"));
  if (!isWithin(snapshot.root, absolutePath)) {
    throw new Error(`IAT_B3_COMBINED_LAW_${label}_PATH_ESCAPE`);
  }
  let stat;
  try {
    stat = lstatSync(absolutePath);
  } catch {
    throw new Error(`IAT_B3_COMBINED_LAW_${label}_FILE_REQUIRED`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`IAT_B3_COMBINED_LAW_${label}_REGULAR_FILE_REQUIRED`);
  }
  const committedBytes = readFileSync(absolutePath);
  if (expectedSha256 !== null && sha256(committedBytes) !== expectedSha256) {
    throw new Error(`IAT_B3_COMBINED_LAW_${label}_SHA256_DRIFT_HOLD`);
  }
  return committedBytes;
}

export function observeExactSource(repositoryRoot) {
  const headSha = executeExactSourceGit(repositoryRoot, ["rev-parse", "HEAD"]).stdout.trim();
  const treeSha = executeExactSourceGit(repositoryRoot, ["rev-parse", "HEAD^{tree}"])
    .stdout.trim();
  const statusPorcelain = executeExactSourceGit(repositoryRoot, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
  ]).stdout;
  return Object.freeze({ headSha, treeSha, statusPorcelain });
}

function assertHostPlatform() {
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error("IAT_B3_COMBINED_LAW_BUILD_REQUIRES_LINUX_AMD64_HOST");
  }
}

function commonDockerRunArguments(entrypoint) {
  return [
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
}

function observeContainer() {
  const platform = execute("docker", [
    `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
    "image",
    "inspect",
    "--format={{.Os}}/{{.Architecture}}",
    PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference,
  ]).stdout.trim();
  const localImageId = execute("docker", [
    `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
    "image",
    "inspect",
    "--format={{.Id}}",
    PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference,
  ]).stdout.trim();
  return assertPinnedContainerObservation({
    ...PINNED_COMBINED_LAW_BUILD_CONTAINER,
    platform,
    localImageId,
  });
}

function observeToolchain() {
  const rustc = execute("docker", [
    ...commonDockerRunArguments("rustc"),
    "--version",
  ]).stdout.trim();
  const cargo = execute("docker", [
    ...commonDockerRunArguments("cargo"),
    "--version",
  ]).stdout.trim();
  const cargoBuildSbf = execute("docker", [
    ...commonDockerRunArguments("cargo"),
    "build-sbf",
    "--version",
  ]).stdout.trim();
  return assertPinnedToolchainObservation({ rustc, cargo, cargoBuildSbf });
}

export function assertIdentityAndOwnerPolicyBytes({
  identityManifestBytes,
  ownerPolicyBytes,
} = {}) {
  if (!Buffer.isBuffer(identityManifestBytes) || identityManifestBytes.length === 0) {
    throw new Error("IAT_B3_COMBINED_LAW_IDENTITY_MANIFEST_BYTES_REQUIRED");
  }
  if (!Buffer.isBuffer(ownerPolicyBytes) || ownerPolicyBytes.length === 0) {
    throw new Error("IAT_B3_COMBINED_LAW_OWNER_POLICY_BYTES_REQUIRED");
  }
  const manifest = parseIdentityFreezeJson(
    identityManifestBytes.toString("utf8"),
    IDENTITY_MANIFEST_RELATIVE_PATH,
  );
  const result = assertProductionCombinedArtifactBindingReady(manifest, { ownerPolicyBytes });
  if (!result.combinedArtifactBuildEnvironment) {
    throw new Error("IAT_B3_COMBINED_LAW_PRODUCTION_IDENTITY_ENVIRONMENT_MISSING");
  }
  return Object.freeze({
    environment: Object.freeze({ ...result.combinedArtifactBuildEnvironment }),
    receiptBinding: Object.freeze({
      manifestPath: IDENTITY_MANIFEST_RELATIVE_PATH,
      manifestSha256: sha256(identityManifestBytes),
      environmentBindingSha256: digestRecord(result.combinedArtifactBuildEnvironment),
      canonicalManifestReady: true,
    }),
  });
}

function loadCanonicalIdentityBinding(snapshot) {
  const identityManifestBytes = readExactMaterializedPacket({
    snapshot,
    relativePath: IDENTITY_MANIFEST_RELATIVE_PATH,
    expectedSha256: null,
    label: "IDENTITY_MANIFEST",
  });
  const ownerPolicyBytes = readExactMaterializedPacket({
    snapshot,
    relativePath: OWNER_POLICY_RELATIVE_PATH,
    expectedSha256: PRODUCTION_OWNER_POLICY_BINDING.packetSha256,
    label: "OWNER_POLICY",
  });
  return assertIdentityAndOwnerPolicyBytes({ identityManifestBytes, ownerPolicyBytes });
}

export function readExactCommittedFile(repositoryRoot, headSha, relativePath) {
  assertHex(headSha, HEX_SHA1, "IAT_B3_COMBINED_LAW_PREFLIGHT_HEAD");
  if (typeof relativePath !== "string"
    || relativePath.length === 0
    || relativePath.startsWith("/")
    || relativePath.includes("\\")
    || relativePath.includes("..")
    || /[\r\n\0:]/u.test(relativePath)) {
    throw new Error("IAT_B3_COMBINED_LAW_PREFLIGHT_SOURCE_PATH_INVALID");
  }
  return executeExactSourceGit(
    repositoryRoot,
    ["show", `${headSha}:${relativePath}`],
    { binary: true },
  );
}

export function observeCombinedLawBuildPreflight({
  repositoryRoot = REPOSITORY_ROOT,
  environment = process.env,
  generatedAt = new Date().toISOString(),
  hostPlatform = process.platform,
  hostArchitecture = process.arch,
  nodeVersion = process.versions.node,
  probeContainer = true,
} = {}) {
  const declaredHeadSha = environment?.IAT_B3_EXACT_SOURCE_HEAD_SHA ?? null;
  let sourceObservation = null;
  let sourceFailure = null;
  try {
    sourceObservation = observeExactSource(repositoryRoot);
  } catch (error) {
    sourceFailure = failureSummary(error);
  }

  let committedRunnerSha256 = null;
  let identityObservation = Object.freeze({
    ready: false,
    manifestSha256: null,
    manifestByteLength: null,
    ownerPolicySha256: null,
    ownerPolicyByteLength: null,
    environmentBindingSha256: null,
    failure: "EXACT_COMMITTED_SOURCE_UNAVAILABLE",
  });
  if (sourceObservation !== null && HEX_SHA1.test(sourceObservation.headSha)) {
    try {
      const committedRunnerBytes = readExactCommittedFile(
        repositoryRoot,
        sourceObservation.headSha,
        RUNNER_RELATIVE_PATH,
      );
      committedRunnerSha256 = sha256(committedRunnerBytes);
      const identityManifestBytes = readExactCommittedFile(
        repositoryRoot,
        sourceObservation.headSha,
        IDENTITY_MANIFEST_RELATIVE_PATH,
      );
      const ownerPolicyBytes = readExactCommittedFile(
        repositoryRoot,
        sourceObservation.headSha,
        OWNER_POLICY_RELATIVE_PATH,
      );
      let identityBinding = null;
      let identityFailure = null;
      try {
        identityBinding = assertIdentityAndOwnerPolicyBytes({
          identityManifestBytes,
          ownerPolicyBytes,
        });
      } catch (error) {
        identityFailure = failureSummary(error);
      }
      identityObservation = Object.freeze({
        ready: identityBinding !== null,
        manifestSha256: sha256(identityManifestBytes),
        manifestByteLength: identityManifestBytes.length,
        ownerPolicySha256: sha256(ownerPolicyBytes),
        ownerPolicyByteLength: ownerPolicyBytes.length,
        environmentBindingSha256:
          identityBinding?.receiptBinding.environmentBindingSha256 ?? null,
        failure: identityFailure,
      });
    } catch (error) {
      identityObservation = Object.freeze({
        ...identityObservation,
        failure: failureSummary(error),
      });
    }
  }

  const executedRunnerSha256 = sha256(readFileSync(fileURLToPath(import.meta.url)));
  const diskVolumePath = realpathSync(tmpdir());
  let diskFreeBytes = null;
  let diskFailure = null;
  try {
    const fileSystem = statfsSync(diskVolumePath);
    const observedFreeBytes = fileSystem.bavail * fileSystem.bsize;
    if (!Number.isSafeInteger(observedFreeBytes) || observedFreeBytes < 0) {
      throw new Error("IAT_B3_COMBINED_LAW_PREFLIGHT_DISK_OBSERVATION_INVALID");
    }
    diskFreeBytes = observedFreeBytes;
  } catch (error) {
    diskFailure = failureSummary(error);
  }

  let containerObservation = null;
  let containerFailure = null;
  let toolchainObservation = null;
  let toolchainFailure = null;
  if (hostPlatform !== "linux" || hostArchitecture !== "x64") {
    containerFailure = "PINNED_CONTAINER_PROBE_SKIPPED_UNSUPPORTED_HOST";
    toolchainFailure = "PINNED_TOOLCHAIN_PROBE_SKIPPED_UNSUPPORTED_HOST";
  } else if (probeContainer !== true) {
    containerFailure = "PINNED_CONTAINER_PROBE_DISABLED";
    toolchainFailure = "PINNED_TOOLCHAIN_PROBE_DISABLED";
  } else {
    try {
      containerObservation = observeContainer();
    } catch (error) {
      containerFailure = failureSummary(error);
    }
    if (containerObservation !== null) {
      try {
        toolchainObservation = observeToolchain();
      } catch (error) {
        toolchainFailure = failureSummary(error);
      }
    } else {
      toolchainFailure = "PINNED_CONTAINER_REQUIRED_BEFORE_TOOLCHAIN_PROBE";
    }
  }

  return createCombinedLawBuildPreflight({
    generatedAt,
    declaredHeadSha,
    sourceObservation,
    sourceFailure,
    executedRunnerSha256,
    committedRunnerSha256,
    nodeVersion,
    hostPlatform,
    hostArchitecture,
    diskVolumePath,
    diskFreeBytes,
    diskFailure,
    identityObservation,
    containerObservation,
    containerFailure,
    toolchainObservation,
    toolchainFailure,
  });
}

export function observeCombinedLawNativeWslBuildPreflight({
  repositoryRoot = REPOSITORY_ROOT,
  environment = process.env,
  generatedAt = new Date().toISOString(),
  probeNative = true,
} = {}) {
  const base = observeCombinedLawBuildPreflight({
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
        readExactCommittedFile(
          repositoryRoot,
          base.source.observedHeadSha,
          CARGO_LOCK_RELATIVE_PATH,
        ),
      );
    } catch {
      dependencyClosure = null;
    }
  }
  let sourceClosureReady = false;
  try {
    assertExactBuildRecipe(PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE);
    sourceClosureReady = true;
  } catch {
    sourceClosureReady = false;
  }
  return createNativeWslBuildPreflight({
    generatedAt,
    programKind: "LAW",
    source: {
      declaredHeadSha: base.source.declaredHeadSha,
      observedHeadSha: base.source.observedHeadSha,
      observedTreeSha: base.source.observedTreeSha,
      statusPorcelain: base.source.repositoryCleanTrackedAndUntracked ? "" : "DIRTY",
    },
    runnerBinding: {
      executedRunnerSha256: base.tooling.executedRunnerSha256,
      committedRunnerSha256: base.tooling.committedRunnerSha256,
    },
    identityReady: base.identityBinding.canonicalProductionBindingReady,
    sourceClosureReady,
    toolchainObservation,
    dependencyClosure,
    disk: { path: base.disk.volumePath, freeBytes: base.disk.observedFreeBytes },
    recipe: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
    minimumFreeBytes: COMBINED_LAW_BUILD_DISK_BUDGET.minimumFreeBytes,
  });
}

function materializeBuildArguments(containerBuildRoot) {
  return PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.arguments.map((argument) => {
    if (argument === "<FRESH_OUTPUT_DIRECTORY>") return `${containerBuildRoot}/output`;
    if (argument === "<FRESH_TARGET_DIRECTORY>") return `${containerBuildRoot}/target`;
    return argument;
  });
}

export function createCombinedLawDockerBuildArguments({
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
    || !containerBuildRoot.startsWith("/iat-build/run-")
    || !Array.isArray(identityEnvironmentNames)
    || identityEnvironmentNames.length !== REQUIRED_IDENTITY_ENVIRONMENT_NAMES.length
    || [...identityEnvironmentNames].sort().join("\u0000")
      !== [...REQUIRED_IDENTITY_ENVIRONMENT_NAMES].sort().join("\u0000")) {
    throw new Error("IAT_B3_COMBINED_LAW_DOCKER_BUILD_ARGUMENT_INPUT_INVALID");
  }
  for (const path of [sourceSnapshotRoot, hostBuildRoot]) {
    if (path.includes(",") || /[\r\n\0]/u.test(path)) {
      throw new Error("IAT_B3_COMBINED_LAW_DOCKER_MOUNT_PATH_UNSAFE");
    }
  }
  return Object.freeze([
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
  ]);
}

function assertFreshDirectory(path) {
  mkdirSync(path, { recursive: false, mode: 0o700 });
  if (readdirSync(path).length !== 0) {
    throw new Error("IAT_B3_COMBINED_LAW_FRESH_BUILD_DIRECTORY_REQUIRED");
  }
}

function executeFreshBuild({
  sourceSnapshot,
  buildRoot,
  containerBuildRoot,
  declaredHeadSha,
  identityEnvironment,
}) {
  observeMaterializedSourceSnapshot(sourceSnapshot);
  assertFreshDirectory(buildRoot);
  const arguments_ = createCombinedLawDockerBuildArguments({
    sourceSnapshotRoot: sourceSnapshot.root,
    hostBuildRoot: buildRoot,
    containerBuildRoot,
    identityEnvironmentNames: Object.keys(identityEnvironment),
  });
  const result = execute("docker", arguments_, {
    env: {
      ...process.env,
      IAT_B3_EXACT_SOURCE_HEAD_SHA: declaredHeadSha,
      ...identityEnvironment,
    },
  });
  const logBytes = Buffer.from(`${result.stdout}\n${result.stderr}`, "utf8");
  if (UNSAFE_COMPILER_DIAGNOSTIC.test(logBytes.toString("utf8"))) {
    throw new Error("IAT_B3_COMBINED_LAW_UNSAFE_SBF_COMPILER_DIAGNOSTIC_HOLD");
  }
  const outputDirectory = join(buildRoot, "output");
  const entries = readdirSync(outputDirectory, { withFileTypes: true });
  if (entries.length !== 1
    || entries[0].name !== PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.outputFileName
    || !entries[0].isFile()
    || entries[0].isSymbolicLink()) {
    throw new Error("IAT_B3_COMBINED_LAW_EXACT_SBF_OUTPUT_SET_REQUIRED");
  }
  const artifactPath = join(outputDirectory, entries[0].name);
  const stat = lstatSync(artifactPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error("IAT_B3_COMBINED_LAW_REGULAR_NONEMPTY_SBF_REQUIRED");
  }
  const forbiddenKeypairs = readdirSync(buildRoot, { recursive: true })
    .filter((path) => /(?:^|[\\/]).*(?:keypair|key-pair).*\.json$/iu.test(String(path)));
  if (forbiddenKeypairs.length > 0) {
    throw new Error("IAT_B3_COMBINED_LAW_BUILD_EMITTED_FORBIDDEN_KEYPAIR_MATERIAL");
  }
  return Object.freeze({
    fileName: entries[0].name,
    bytes: readFileSync(artifactPath),
    logSha256: sha256(logBytes),
    artifactPath,
  });
}

function reobserveArtifact(artifact) {
  const stat = lstatSync(artifact.artifactPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error("IAT_B3_COMBINED_LAW_SBF_CHANGED_BEFORE_RECEIPT_HOLD");
  }
  const bytes = readFileSync(artifact.artifactPath);
  if (!bytes.equals(artifact.bytes)) {
    throw new Error("IAT_B3_COMBINED_LAW_SBF_CHANGED_BEFORE_RECEIPT_HOLD");
  }
  return Object.freeze({
    fileName: artifact.fileName,
    bytes,
    logSha256: artifact.logSha256,
  });
}

function validateReceiptDestination(receiptPath, repositoryRoot) {
  if (typeof receiptPath !== "string" || !isAbsolute(receiptPath)) {
    throw new Error("IAT_B3_COMBINED_LAW_RECEIPT_ABSOLUTE_PATH_REQUIRED");
  }
  const normalized = resolve(receiptPath);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/u.test(basename(normalized))) {
    throw new Error("IAT_B3_COMBINED_LAW_RECEIPT_FILE_NAME_INVALID");
  }
  if (existsSync(normalized)) {
    throw new Error("IAT_B3_COMBINED_LAW_RECEIPT_MUST_NOT_ALREADY_EXIST");
  }
  const realParent = realpathSync(dirname(normalized));
  const realRepository = realpathSync(repositoryRoot);
  if (realParent !== resolve(dirname(normalized)) || isWithin(realRepository, normalized)) {
    throw new Error("IAT_B3_COMBINED_LAW_RECEIPT_MUST_BE_OUTSIDE_REPOSITORY");
  }
  return normalized;
}

function validateArtifactDestination(artifactPath, repositoryRoot) {
  if (typeof artifactPath !== "string" || !isAbsolute(artifactPath)) {
    throw new Error("IAT_B3_COMBINED_LAW_ARTIFACT_ABSOLUTE_PATH_REQUIRED");
  }
  const normalized = resolve(artifactPath);
  if (basename(normalized) !== PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.outputFileName) {
    throw new Error("IAT_B3_COMBINED_LAW_ARTIFACT_FILE_NAME_INVALID");
  }
  if (existsSync(normalized)) {
    throw new Error("IAT_B3_COMBINED_LAW_ARTIFACT_MUST_NOT_ALREADY_EXIST");
  }
  const realParent = realpathSync(dirname(normalized));
  const realRepository = realpathSync(repositoryRoot);
  if (realParent !== resolve(dirname(normalized)) || isWithin(realRepository, normalized)) {
    throw new Error("IAT_B3_COMBINED_LAW_ARTIFACT_MUST_BE_OUTSIDE_REPOSITORY");
  }
  return normalized;
}

export function observePreservedArtifact({
  outputPath,
  expectedFileName,
  expectedByteLength,
  expectedSha256,
} = {}) {
  if (typeof outputPath !== "string"
    || basename(outputPath) !== expectedFileName
    || expectedFileName !== PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.outputFileName
    || !Number.isSafeInteger(expectedByteLength)
    || expectedByteLength <= 0) {
    throw new Error("IAT_B3_COMBINED_LAW_PRESERVED_ARTIFACT_OBSERVATION_INVALID");
  }
  assertHex(expectedSha256, HEX_SHA256, "IAT_B3_COMBINED_LAW_EXPECTED_PRESERVED_SHA256");
  const stat = lstatSync(outputPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== expectedByteLength) {
    throw new Error("IAT_B3_COMBINED_LAW_PRESERVED_ARTIFACT_READBACK_DRIFT_HOLD");
  }
  const bytes = readFileSync(outputPath);
  if (bytes.length !== expectedByteLength || sha256(bytes) !== expectedSha256) {
    throw new Error("IAT_B3_COMBINED_LAW_PRESERVED_ARTIFACT_READBACK_DRIFT_HOLD");
  }
  return Object.freeze({
    fileName: expectedFileName,
    bytes,
    atomicNoOverwrite: true,
    readbackVerified: true,
  });
}

export function preserveReceiptBoundArtifact({
  outputPath,
  artifact,
  repositoryRoot = REPOSITORY_ROOT,
} = {}) {
  if (!hasExactDataKeys(artifact, ["fileName", "bytes"])
    || artifact.fileName !== PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.outputFileName
    || !Buffer.isBuffer(artifact.bytes)
    || artifact.bytes.length === 0) {
    throw new Error("IAT_B3_COMBINED_LAW_ARTIFACT_COPY_INPUT_INVALID");
  }
  const destination = validateArtifactDestination(outputPath, repositoryRoot);
  const expectedSha256 = sha256(artifact.bytes);
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
      || temporaryBytes.length !== artifact.bytes.length
      || sha256(temporaryBytes) !== expectedSha256
      || !temporaryBytes.equals(artifact.bytes)) {
      throw new Error("IAT_B3_COMBINED_LAW_ARTIFACT_TEMPORARY_COPY_DRIFT_HOLD");
    }
    linkSync(temporaryPath, destination);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
  return observePreservedArtifact({
    outputPath: destination,
    expectedFileName: artifact.fileName,
    expectedByteLength: artifact.bytes.length,
    expectedSha256,
  });
}

function emitReceipt(receiptPath, receipt) {
  validateCombinedLawBuildReceipt(receipt);
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  const temporaryPath = join(
    dirname(receiptPath),
    `.${basename(receiptPath)}.${process.pid}.${randomBytes(8).toString("hex")}.partial`,
  );
  try {
    writeFileSync(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
    linkSync(temporaryPath, receiptPath);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
  const stat = lstatSync(receiptPath);
  if (!stat.isFile() || stat.isSymbolicLink() || !readFileSync(receiptPath).equals(bytes)) {
    throw new Error("IAT_B3_COMBINED_LAW_RECEIPT_WRITE_VERIFICATION_FAILED");
  }
}

function emitNativeWslReceipt(receiptPath, receipt, programKind, recipe) {
  validateNativeWslBuildReceipt(receipt, {
    programKind,
    recipe,
    outputFileName: recipe.outputFileName,
  });
  const bytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  const temporaryPath = join(
    dirname(receiptPath),
    `.${basename(receiptPath)}.${process.pid}.${randomBytes(8).toString("hex")}.partial`,
  );
  try {
    writeFileSync(temporaryPath, bytes, { flag: "wx", mode: 0o600 });
    linkSync(temporaryPath, receiptPath);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
  if (!readFileSync(receiptPath).equals(bytes)) {
    throw new Error("IAT_B3_NATIVE_WSL_RECEIPT_WRITE_VERIFICATION_FAILED");
  }
}

export function createNativeSourceReceiptBinding({
  declaredHeadSha,
  sourceObservations,
  materializedSourceObservations,
  executedRunnerSha256,
  committedRunnerSha256,
}) {
  assertExactCleanSourceSequence({ declaredHeadSha, observations: sourceObservations });
  assertExactMaterializedSourceSequence({
    declaredHeadSha,
    observations: materializedSourceObservations,
  });
  const source = sourceObservations[0];
  const materialized = materializedSourceObservations[0];
  return Object.freeze({
    declaredHeadSha,
    observedHeadSha: source.headSha,
    observedTreeSha: source.treeSha,
    repositoryCleanTrackedAndUntracked: true,
    revalidationCount: sourceObservations.length,
    executedRunnerSha256,
    committedRunnerSha256,
    materializationSchema: materialized.schema,
    materializedTreeSha: materialized.treeSha,
    mountedInputSha256: materialized.mountedInputSha256,
    materializedFileCount: materialized.fileCount,
    materializedByteLength: materialized.byteLength,
    lfsPointerCount: materialized.lfsPointerCount,
    ignoredWorktreeBytesIncluded: false,
    submodulePolicy: materialized.submodulePolicy,
    lfsPolicy: materialized.lfsPolicy,
    materializationRevalidationCount: materializedSourceObservations.length,
  });
}

export function runCombinedLawNativeWslReproducibleBuild({
  receiptPath,
  artifactPath,
  environment = process.env,
} = {}) {
  assertNativeWslObservationOnlyBuildDisabled();
  assertHostPlatform();
  assertExactBuildRecipe(PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE);
  const receiptDestination = validateReceiptDestination(receiptPath, REPOSITORY_ROOT);
  const artifactDestination = validateArtifactDestination(artifactPath, REPOSITORY_ROOT);
  const declaredHeadSha = environment.IAT_B3_EXACT_SOURCE_HEAD_SHA;
  assertHex(declaredHeadSha, HEX_SHA1, "IAT_B3_EXACT_SOURCE_HEAD_SHA");
  const sourceObservations = [observeExactSource(REPOSITORY_ROOT)];
  assertCleanSourceObservation({
    declaredHeadSha,
    observation: sourceObservations[0],
    index: 0,
  });
  const toolchainObservations = [observeNativeWslPinnedToolchain()];
  const executedRunnerSha256 = sha256(readFileSync(fileURLToPath(import.meta.url)));
  let buildRoot = null;
  try {
    buildRoot = createCombinedLawBuildRoot();
    const snapshot = loadExactDeclaredHeadSource({
      repositoryRoot: REPOSITORY_ROOT,
      buildRoot,
      declaredHeadSha,
    });
    const materializedSourceObservations = [observeMaterializedSourceSnapshot(snapshot)];
    if (snapshot.treeSha !== sourceObservations[0].treeSha) {
      throw new Error("IAT_B3_COMBINED_LAW_MATERIALIZED_TREE_HEAD_MISMATCH_HOLD");
    }
    const committedRunnerSha256 = sha256(readExactMaterializedPacket({
      snapshot,
      relativePath: RUNNER_RELATIVE_PATH,
      expectedSha256: null,
      label: "RUNNER",
    }));
    if (executedRunnerSha256 !== committedRunnerSha256) {
      throw new Error("IAT_B3_COMBINED_LAW_EXECUTED_RUNNER_NOT_COMMITTED_HOLD");
    }
    const identity = loadCanonicalIdentityBinding(snapshot);
    const dependencyClosure = verifyNativeCargoLockArchiveClosure(
      readExactMaterializedPacket({
        snapshot,
        relativePath: CARGO_LOCK_RELATIVE_PATH,
        expectedSha256: null,
        label: "CARGO_LOCK",
      }),
    );
    const sourceClosure = Object.freeze({
      policy: "EXACT_GIT_OBJECT_SOURCE_PLUS_FROZEN_PRODUCTION_LAW_RECIPE",
      recipeSha256: digestRecord(PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE),
      cargoLockSha256: dependencyClosure.lockSha256,
      mountedInputSha256: snapshot.mountedInputSha256,
    });
    toolchainObservations.push(observeNativeWslPinnedToolchain());
    sourceObservations.push(observeExactSource(REPOSITORY_ROOT));
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(snapshot));
    const first = executeNativeWslFreshBuild({
      sourceRoot: snapshot.root,
      buildRoot: join(buildRoot, "run-1"),
      recipe: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
      identityEnvironment: identity.environment,
      declaredHeadSha,
      expectedOutputFileName: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.outputFileName,
      runLabel: "run-1",
    });
    sourceObservations.push(observeExactSource(REPOSITORY_ROOT));
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(snapshot));
    const second = executeNativeWslFreshBuild({
      sourceRoot: snapshot.root,
      buildRoot: join(buildRoot, "run-2"),
      recipe: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
      identityEnvironment: identity.environment,
      declaredHeadSha,
      expectedOutputFileName: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.outputFileName,
      runLabel: "run-2",
    });
    toolchainObservations.push(observeNativeWslPinnedToolchain());
    sourceObservations.push(observeExactSource(REPOSITORY_ROOT));
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(snapshot));
    const preservedArtifact = preserveReceiptBoundArtifact({
      outputPath: artifactDestination,
      artifact: { fileName: first.fileName, bytes: first.bytes },
    });
    const receipt = createNativeWslBuildReceipt({
      generatedAt: new Date().toISOString(),
      programKind: "LAW",
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
        inputNames: [...REQUIRED_IDENTITY_ENVIRONMENT_NAMES],
      },
      sourceClosure,
      dependencyClosure,
      toolchainObservations,
      recipe: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
      firstArtifact: first,
      secondArtifact: second,
      preservedArtifact,
    });
    emitNativeWslReceipt(
      receiptDestination,
      receipt,
      "LAW",
      PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
    );
    return receipt;
  } finally {
    if (buildRoot !== null) removeSelfCreatedBuildRoot(buildRoot);
  }
}

export function runCombinedLawReproducibleBuild({
  receiptPath,
  artifactPath,
  environment = process.env,
} = {}) {
  assertHostPlatform();
  assertExactBuildRecipe(PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE);
  const receiptDestination = validateReceiptDestination(receiptPath, REPOSITORY_ROOT);
  const artifactDestination = validateArtifactDestination(artifactPath, REPOSITORY_ROOT);
  if (receiptDestination === artifactDestination) {
    throw new Error("IAT_B3_COMBINED_LAW_RECEIPT_ARTIFACT_DESTINATIONS_MUST_DIFFER");
  }
  const declaredHeadSha = environment.IAT_B3_EXACT_SOURCE_HEAD_SHA;
  assertHex(declaredHeadSha, HEX_SHA1, "IAT_B3_EXACT_SOURCE_HEAD_SHA");
  const executedRunnerSha256 = sha256(readFileSync(fileURLToPath(import.meta.url)));
  const committedRunnerSha256 = sha256(
    readExactCommittedFile(REPOSITORY_ROOT, declaredHeadSha, RUNNER_RELATIVE_PATH),
  );
  if (executedRunnerSha256 !== committedRunnerSha256) {
    throw new Error("IAT_B3_COMBINED_LAW_EXECUTED_RUNNER_NOT_COMMITTED_HOLD");
  }

  const sourceObservations = [observeExactSource(REPOSITORY_ROOT)];
  assertCleanSourceObservation({
    declaredHeadSha,
    observation: sourceObservations[0],
    index: 0,
  });

  let buildRoot = null;
  try {
    buildRoot = createCombinedLawBuildRoot();
    const sourceSnapshot = loadExactDeclaredHeadSource({
      repositoryRoot: REPOSITORY_ROOT,
      buildRoot,
      declaredHeadSha,
    });
    const materializedSourceObservations = [observeMaterializedSourceSnapshot(sourceSnapshot)];
    if (sourceSnapshot.treeSha !== sourceObservations[0].treeSha) {
      throw new Error("IAT_B3_COMBINED_LAW_MATERIALIZED_TREE_HEAD_MISMATCH_HOLD");
    }
    const identityBinding = loadCanonicalIdentityBinding(sourceSnapshot);
    const containerObservation = observeContainer();
    const toolchainObservation = observeToolchain();
    sourceObservations.push(observeExactSource(REPOSITORY_ROOT));
    assertCleanSourceObservation({
      declaredHeadSha,
      observation: sourceObservations[1],
      index: 1,
      expectedTreeSha: sourceObservations[0].treeSha,
    });
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(sourceSnapshot));

    const first = executeFreshBuild({
      sourceSnapshot,
      buildRoot: join(buildRoot, "run-1"),
      containerBuildRoot: "/iat-build/run-1",
      declaredHeadSha,
      identityEnvironment: identityBinding.environment,
    });
    sourceObservations.push(observeExactSource(REPOSITORY_ROOT));
    assertExactCleanSourceSequence({ declaredHeadSha, observations: sourceObservations });
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(sourceSnapshot));
    const second = executeFreshBuild({
      sourceSnapshot,
      buildRoot: join(buildRoot, "run-2"),
      containerBuildRoot: "/iat-build/run-2",
      declaredHeadSha,
      identityEnvironment: identityBinding.environment,
    });
    sourceObservations.push(observeExactSource(REPOSITORY_ROOT));
    assertExactCleanSourceSequence({ declaredHeadSha, observations: sourceObservations });
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(sourceSnapshot));

    const firstArtifact = reobserveArtifact(first);
    const secondArtifact = reobserveArtifact(second);
    if (firstArtifact.bytes.length !== secondArtifact.bytes.length
      || sha256(firstArtifact.bytes) !== sha256(secondArtifact.bytes)
      || !firstArtifact.bytes.equals(secondArtifact.bytes)) {
      throw new Error("IAT_B3_COMBINED_LAW_SBF_BYTE_MISMATCH_HOLD");
    }
    const preservedArtifact = preserveReceiptBoundArtifact({
      outputPath: artifactDestination,
      artifact: {
        fileName: firstArtifact.fileName,
        bytes: firstArtifact.bytes,
      },
    });

    const receipt = createCombinedLawBuildReceipt({
      generatedAt: new Date().toISOString(),
      declaredHeadSha,
      sourceObservations,
      materializedSourceObservations,
      runnerBinding: { executedRunnerSha256, committedRunnerSha256 },
      identityBinding: identityBinding.receiptBinding,
      containerObservation,
      toolchainObservation,
      firstArtifact,
      secondArtifact,
      preservedArtifact,
    });
    emitReceipt(receiptDestination, receipt);
    observePreservedArtifact({
      outputPath: artifactDestination,
      expectedFileName: receipt.artifact.fileName,
      expectedByteLength: receipt.artifact.byteLength,
      expectedSha256: receipt.artifact.sha256,
    });
    return receipt;
  } finally {
    if (buildRoot !== null) removeSelfCreatedBuildRoot(buildRoot);
  }
}

function parseCliArguments(argv) {
  if (argv.length === 1 && argv[0] === "--preflight") {
    return Object.freeze({ mode: "preflight" });
  }
  if (argv.length !== 4
    || argv[0] !== "--receipt"
    || !argv[1]
    || argv[2] !== "--artifact"
    || !argv[3]) {
    throw new Error("Usage: run-iat-b3-combined-law-reproducible-build.mjs --preflight | --receipt <absolute-outside-repository.json> --artifact <absolute-outside-repository/iat_b3_law.so>");
  }
  return Object.freeze({ mode: "build", receiptPath: argv[1], artifactPath: argv[3] });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    const arguments_ = parseCliArguments(process.argv.slice(2));
    const backend = selectReproducibleBuildBackend(process.env);
    if (arguments_.mode === "preflight") {
      const preflight = backend === NATIVE_WSL_BUILD_BACKEND
        ? observeCombinedLawNativeWslBuildPreflight()
        : observeCombinedLawBuildPreflight();
      console.log(JSON.stringify(preflight, null, 2));
      process.exitCode = preflight.exitCode;
    } else {
      const receipt = backend === NATIVE_WSL_BUILD_BACKEND
        ? runCombinedLawNativeWslReproducibleBuild(arguments_)
        : runCombinedLawReproducibleBuild(arguments_);
      console.log(JSON.stringify(receipt, null, 2));
    }
  } catch (error) {
    console.error(`IAT B3 combined-law exact-source build HOLD: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

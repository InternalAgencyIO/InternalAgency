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
const ACTIVE_BUILD_ROOTS = new Set();
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
  "independentReviewAccepted",
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

function assertCleanSourceObservation({
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
      independentReviewAccepted: false,
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
    || receipt.safety.independentReviewAccepted !== false
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

function executeExactSourceGit(
  repositoryRoot,
  arguments_,
  { binary = false, ...options } = {},
) {
  const executeGit = binary ? executeBinary : execute;
  return executeGit("git", [
    "--no-replace-objects",
    "-C",
    repositoryRoot,
    ...arguments_,
  ], {
    ...options,
    env: createExactSourceGitEnvironment(process.env),
  });
}

export function createCombinedLawBuildRoot() {
  const realTemporaryRoot = realpathSync(tmpdir());
  const created = mkdtempSync(join(realTemporaryRoot, BUILD_ROOT_PREFIX));
  const realBuildRoot = realpathSync(created);
  const stat = lstatSync(realBuildRoot);
  if (!stat.isDirectory()
    || stat.isSymbolicLink()
    || dirname(realBuildRoot) !== realTemporaryRoot
    || !basename(realBuildRoot).startsWith(BUILD_ROOT_PREFIX)) {
    throw new Error("IAT_B3_COMBINED_LAW_BUILD_ROOT_CREATION_BOUNDARY_INVALID");
  }
  ACTIVE_BUILD_ROOTS.add(realBuildRoot);
  return realBuildRoot;
}

export function removeSelfCreatedBuildRoot(buildRoot) {
  if (typeof buildRoot !== "string" || !ACTIVE_BUILD_ROOTS.has(buildRoot)) {
    throw new Error("IAT_B3_COMBINED_LAW_BUILD_ROOT_NOT_PROCESS_CREATED");
  }
  const realTemporaryRoot = realpathSync(tmpdir());
  const realBuildRoot = realpathSync(buildRoot);
  if (realBuildRoot !== buildRoot
    || dirname(realBuildRoot) !== realTemporaryRoot
    || !basename(realBuildRoot).startsWith(BUILD_ROOT_PREFIX)) {
    throw new Error("IAT_B3_COMBINED_LAW_BUILD_ROOT_CLEANUP_BOUNDARY_INVALID");
  }
  rmSync(realBuildRoot, { recursive: true, force: true });
  ACTIVE_BUILD_ROOTS.delete(realBuildRoot);
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
  if (argv.length !== 4
    || argv[0] !== "--receipt"
    || !argv[1]
    || argv[2] !== "--artifact"
    || !argv[3]) {
    throw new Error("Usage: run-iat-b3-combined-law-reproducible-build.mjs --receipt <absolute-outside-repository.json> --artifact <absolute-outside-repository/iat_b3_law.so>");
  }
  return Object.freeze({ receiptPath: argv[1], artifactPath: argv[3] });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  try {
    const receipt = runCombinedLawReproducibleBuild(parseCliArguments(process.argv.slice(2)));
    console.log(JSON.stringify(receipt, null, 2));
  } catch (error) {
    console.error(`IAT B3 combined-law exact-source build HOLD: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  }
}

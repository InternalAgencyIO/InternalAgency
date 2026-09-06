#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  closeSync,
  constants as fsConstants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  parse as parsePath,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
  isCanonicalBase58Key,
} from "./validate-iat-b3-identity-freeze.mjs";
import { parseB3OwnerPolicyFreezeJson } from "./validate-iat-b3-owner-policy-freeze.mjs";
import {
  ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE,
  ECONOMY_PRODUCTION_FEATURE,
  ECONOMY_SBF_BUILD_RECIPE,
  inspectEconomyProductionSourceClosure,
} from "./run-iat-b3-economy-reproducible-build.mjs";
import {
  assertPinnedContainerObservation,
  assertPinnedToolchainObservation,
  observeExactSource,
  readExactCommittedFile,
} from "./run-iat-b3-combined-law-reproducible-build.mjs";

export const DISPOSABLE_DEVNET_PREFLIGHT_SCHEMA =
  "iat-b3-disposable-devnet-structural-contract-preflight/v2";
export const DISPOSABLE_DEVNET_RECEIPT_SCHEMA =
  "iat-b3-disposable-devnet-structural-contract-receipt/v2";
export const DISPOSABLE_DEVNET_IDENTITY_OBSERVATION_SCHEMA =
  "iat-b3-disposable-devnet-self-authored-identity-record/v2";
export const DISPOSABLE_DEVNET_GENESIS_OBSERVATION_SCHEMA =
  "iat-b3-disposable-devnet-self-authored-genesis-record/v2";
export const DISPOSABLE_DEVNET_BUILD_LOG_HEADER_SCHEMA =
  "iat-b3-disposable-devnet-self-authored-build-log-header/v2";
export const DISPOSABLE_DEVNET_EVIDENCE_STATE_SCHEMA =
  "iat-b3-disposable-devnet-dual-build-evidence-state/v2";
export const DISPOSABLE_DEVNET_PREFLIGHT_STRUCTURAL_HOLD =
  "STRUCTURAL_CONTRACT_INPUTS_BOUND_HOLD";
export const DISPOSABLE_DEVNET_RECEIPT_STRUCTURAL_HOLD =
  "STRUCTURAL_CONTRACT_BYTE_EQUALITY_RECORDED_HOLD";
export const DISPOSABLE_DEVNET_SCOPE =
  "DISPOSABLE_DEVNET_STRUCTURAL_CONTRACT_ONLY_NONAUTHORITATIVE";
export const DISPOSABLE_DEVNET_MAINNET_STATUS = "HOLD";
export const DISPOSABLE_DEVNET_NETWORK = "solana-devnet";
export const DISPOSABLE_DEVNET_RPC_URL = "https://api.devnet.solana.com";
export const DISPOSABLE_DEVNET_GENESIS_HASH =
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const DISPOSABLE_DEVNET_RUNNER_REPOSITORY_PATH =
  "projects/star-ascent/site/scripts/validate-iat-b3-disposable-devnet-dual-build-evidence.mjs";
export const DISPOSABLE_DEVNET_STATE_REPOSITORY_PATH =
  "projects/star-ascent/site/docs/b3/iat-b3-disposable-devnet-dual-build-evidence-state.v1.json";

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const RUNNER_PATH = fileURLToPath(import.meta.url);
const SITE_PREFIX = "projects/star-ascent/site/";
const DEVNET_DRIVER_REPOSITORY_PATH =
  "projects/star-ascent/site/scripts/iat-b3-devnet-rehearsal-driver.mjs";
const HEX_SHA1 = /^[0-9a-f]{40}$/u;
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const LANE_ID = /^b09-devnet-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{16}$/u;
const MAX_IDENTITY_OBSERVATION_BYTES = 16 * 1024;
const MAX_GENESIS_OBSERVATION_BYTES = 16 * 1024;
const MAX_BUILD_LOG_BYTES = 16 * 1024 * 1024;
const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024;
const MAX_OBSERVATION_AGE_MILLISECONDS = 15 * 60 * 1000;
const MAX_RECEIPT_DELAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const TEXT_SOURCE_EXTENSIONS = new Set([
  ".json", ".jsonl", ".md", ".mjs", ".js", ".jsx", ".ts", ".tsx",
  ".rs", ".toml", ".sh", ".yml", ".yaml",
]);
const UNTRACKED_SOURCE_SCAN_EXCLUDED_DIRECTORIES = new Set([
  ".git", ".next", "coverage", "node_modules", "target",
]);

const PREFLIGHT_KEYS = Object.freeze([
  "schema", "status", "generatedAtUtc", "laneId", "scope", "source",
  "devnet", "identities", "container", "toolchain", "recipes", "safety",
  "preflightSha256",
]);
const SOURCE_KEYS = Object.freeze([
  "declaredHeadSha", "observedHeadSha", "observedTreeSha",
  "repositoryCleanTrackedAndUntracked", "runnerPath", "executedRunnerSha256",
  "committedRunnerSha256", "sourceClosureFileCount", "sourceClosureSha256",
  "lawProductionFeatureClosureSha256", "economyProductionFeatureClosureSha256",
]);
const DEVNET_KEYS = Object.freeze([
  "network", "rpcUrl", "observedGenesisHash", "observation",
]);
const IDENTITY_KEYS = Object.freeze([
  "lawProgramId", "economyProgramId", "canonicalMint", "observation",
  "bindingSha256", "freshAndDisposable",
]);
const FILE_DESCRIPTOR_KEYS = Object.freeze([
  "absolutePath", "sha256", "byteLength", "device", "inode",
  "parentChainSha256",
]);
const RECIPE_SET_KEYS = Object.freeze(["law", "economy"]);
const RECIPE_KEYS = Object.freeze([
  "feature", "forbiddenFeature", "recipeSha256", "environment",
  "environmentSha256", "backend", "networkPolicy", "repetitions",
]);
const RECEIPT_KEYS = Object.freeze([
  "schema", "status", "generatedAtUtc", "laneId", "scope", "preflightSha256",
  "sourceAndIdentityBindingSha256", "builds", "preservedRoot",
  "preservedRootDevice", "preservedRootInode", "preservedRootParentChainSha256",
  "artifacts", "safety", "receiptSha256",
]);
const BUILD_SET_KEYS = Object.freeze(["first", "second"]);
const BUILD_INPUT_KEYS = Object.freeze([
  "ordinal", "workspaceRoot", "workspaceWasFresh", "targetDirectoryWasFresh",
  "outputDirectoryWasFresh", "law", "economy",
]);
const BUILD_KEYS = Object.freeze([
  ...BUILD_INPUT_KEYS,
  "workspaceDevice", "workspaceInode", "workspaceParentChainSha256",
]);
const BUILD_OUTPUT_KEYS = Object.freeze(["artifact", "rawLog"]);
const ARTIFACT_SET_KEYS = Object.freeze(["law", "economy"]);
const ARTIFACT_EQUALITY_KEYS = Object.freeze([
  "fileName", "byteLength", "sha256", "firstBuildSha256", "secondBuildSha256",
  "preservedArtifact", "identicalByteLength", "identicalSha256",
  "identicalBytes",
]);
const PREFLIGHT_SAFETY = Object.freeze({
  classification: "STRUCTURAL_CONTRACT_ONLY",
  selfAuthoredClaimsOnly: true,
  executionProvenanceObserved: false,
  buildExecutionObserved: false,
  containerExecutionObserved: false,
  toolchainExecutionObserved: false,
  identityGenerationObserved: false,
  devnetRpcExecutionObserved: false,
  contractPerformedBuild: false,
  contractPerformedNetworkCall: false,
  contractGeneratedKey: false,
  nativeBuildAccepted: false,
  productionReceiptAccepted: false,
  productionFinalByteEvidenceAccepted: false,
  devnetExecutionObserved: false,
  devnetRehearsalComplete: false,
  signingAuthorized: false,
  deploymentAuthorized: false,
  releaseAuthorized: false,
  mainnetExecutionAuthorized: false,
  mainnetStatus: DISPOSABLE_DEVNET_MAINNET_STATUS,
});
const RECEIPT_SAFETY = Object.freeze({
  classification: "STRUCTURAL_CONTRACT_ONLY",
  selfAuthoredBundlePossible: true,
  structuralByteEqualityRecorded: true,
  executionProvenanceObserved: false,
  buildExecutionObserved: false,
  behavioralDevnetEvidence: false,
  adversarialDevnetExecutionEvidence: false,
  productionCandidate: false,
  productionReceiptCompatible: false,
  productionFinalByteEvidence: false,
  devnetExecutionObserved: false,
  devnetRehearsalComplete: false,
  signingObserved: false,
  deploymentObserved: false,
  releaseAuthorized: false,
  mainnetExecutionAuthorized: false,
  mainnetStatus: DISPOSABLE_DEVNET_MAINNET_STATUS,
});

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isPlainDataObject(value) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, expected) {
  if (!isPlainDataObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length
    && actual.every((key, index) => key === wanted[index]);
}

function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isPlainDataObject(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  throw new TypeError("DISPOSABLE_DEVNET_CANONICAL_DATA_REQUIRED");
}

export function disposableDevnetCanonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function disposableDevnetCanonicalSha256(value) {
  return sha256(disposableDevnetCanonicalJson(value));
}

function withoutDigest(value, key) {
  return Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
}

function assertHex(value, expression, label) {
  if (typeof value !== "string" || !expression.test(value)) {
    throw new Error(`${label}_INVALID`);
  }
  return value;
}

function parseExactUtc(value, label) {
  if (typeof value !== "string") throw new Error(`${label}_INVALID`);
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    throw new Error(`${label}_INVALID`);
  }
  return milliseconds;
}

function assertObservationFresh(observedAtUtc, generatedAtUtc, label) {
  const observed = parseExactUtc(observedAtUtc, `${label}_OBSERVED_AT_UTC`);
  const generated = parseExactUtc(generatedAtUtc, "DISPOSABLE_DEVNET_GENERATED_AT_UTC");
  const age = generated - observed;
  if (age < 0 || age > MAX_OBSERVATION_AGE_MILLISECONDS) {
    throw new Error(`${label}_STALE_OR_FUTURE_HOLD`);
  }
}

function isWithinRoot(path, root) {
  const candidate = relative(root, path);
  return candidate !== ""
    && candidate !== ".."
    && !candidate.startsWith(`..${sep}`)
    && !isAbsolute(candidate);
}

function pathIdentity(path) {
  const canonical = resolve(path);
  return process.platform === "win32" ? canonical.toLowerCase() : canonical;
}

function samePath(left, right) {
  return pathIdentity(left) === pathIdentity(right);
}

function exactRealpath(path) {
  return typeof realpathSync.native === "function"
    ? realpathSync.native(path)
    : realpathSync(path);
}

function assertAbsoluteCanonicalPath(path, label) {
  if (typeof path !== "string" || !isAbsolute(path) || resolve(path) !== path) {
    throw new Error(`${label}_ABSOLUTE_CANONICAL_PATH_REQUIRED`);
  }
  return path;
}

function directoryIdentity(stat) {
  return Object.freeze({
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
  });
}

function observeDirectoryChain(path, label) {
  const absolutePath = assertAbsoluteCanonicalPath(path, label);
  const root = parsePath(absolutePath).root;
  const relativePath = relative(root, absolutePath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`)) {
    throw new Error(`${label}_DIRECTORY_CHAIN_INVALID`);
  }
  const components = relativePath === "" ? [] : relativePath.split(sep);
  const entries = [];
  let current = root;
  for (const component of [null, ...components]) {
    if (component !== null) current = resolve(current, component);
    const link = lstatSync(current, { bigint: true });
    if (!link.isDirectory() || link.isSymbolicLink()) {
      throw new Error(`${label}_PARENT_REPARSE_OR_NON_DIRECTORY_HOLD`);
    }
    const actual = exactRealpath(current);
    if (!samePath(actual, current)) {
      throw new Error(`${label}_PARENT_REPARSE_OR_ALIAS_HOLD`);
    }
    entries.push(Object.freeze({
      absolutePath: resolve(actual),
      ...directoryIdentity(link),
    }));
  }
  return Object.freeze({
    absolutePath: entries.at(-1).absolutePath,
    entries: Object.freeze(entries),
    parentChainSha256: disposableDevnetCanonicalSha256(entries),
  });
}

function observeExternalDirectory(path, repositoryRoot, label) {
  const chain = observeDirectoryChain(path, label);
  const repository = exactRealpath(repositoryRoot);
  if (samePath(chain.absolutePath, repository)
    || isWithinRoot(chain.absolutePath, repository)) {
    throw new Error(`${label}_MUST_BE_OUTSIDE_REPOSITORY`);
  }
  const leaf = chain.entries.at(-1);
  return Object.freeze({
    absolutePath: chain.absolutePath,
    device: leaf.device,
    inode: leaf.inode,
    parentChainSha256: chain.parentChainSha256,
  });
}

function assertExternalDirectory(path, repositoryRoot, label, declared = null) {
  const observed = observeExternalDirectory(path, repositoryRoot, label);
  if (declared !== null
    && (declared.device !== observed.device
      || declared.inode !== observed.inode
      || declared.parentChainSha256 !== observed.parentChainSha256)) {
    throw new Error(`${label}_DIRECTORY_IDENTITY_OR_PARENT_CHAIN_CHANGED_HOLD`);
  }
  return observed;
}

function sameFileSnapshot(left, right) {
  return ["dev", "ino", "mode", "nlink", "size", "mtimeNs", "ctimeNs"]
    .every((key) => left[key] === right[key]);
}

function readStableExternalFile(path, repositoryRoot, label, maximumBytes) {
  const absolutePath = assertAbsoluteCanonicalPath(path, label);
  const parentBefore = observeDirectoryChain(dirname(absolutePath), `${label}_PARENT`);
  const repository = exactRealpath(repositoryRoot);
  const actualBefore = exactRealpath(absolutePath);
  if (!samePath(actualBefore, absolutePath)) {
    throw new Error(`${label}_FILE_REPARSE_OR_ALIAS_HOLD`);
  }
  if (samePath(actualBefore, repository) || isWithinRoot(actualBefore, repository)) {
    throw new Error(`${label}_MUST_BE_OUTSIDE_REPOSITORY`);
  }
  const linkBefore = lstatSync(absolutePath, { bigint: true });
  if (!linkBefore.isFile() || linkBefore.isSymbolicLink()) {
    throw new Error(`${label}_REAL_REGULAR_FILE_REQUIRED`);
  }
  if (linkBefore.nlink !== 1n || linkBefore.size < 1n
    || linkBefore.size > BigInt(maximumBytes)) {
    throw new Error(`${label}_SAFE_BOUNDED_SINGLE_LINK_FILE_REQUIRED`);
  }
  const noFollow = typeof fsConstants.O_NOFOLLOW === "number"
    ? fsConstants.O_NOFOLLOW
    : 0;
  const descriptor = openSync(absolutePath, fsConstants.O_RDONLY | noFollow);
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile() || !sameFileSnapshot(linkBefore, before)) {
      throw new Error(`${label}_LSTAT_FSTAT_IDENTITY_MISMATCH_HOLD`);
    }
    const bytes = readFileSync(descriptor);
    const after = fstatSync(descriptor, { bigint: true });
    const linkAfter = lstatSync(absolutePath, { bigint: true });
    const parentAfter = observeDirectoryChain(dirname(absolutePath), `${label}_PARENT`);
    const actualAfter = exactRealpath(absolutePath);
    if (!sameFileSnapshot(before, after)
      || !sameFileSnapshot(after, linkAfter)
      || after.nlink !== 1n
      || BigInt(bytes.length) !== after.size
      || parentBefore.parentChainSha256 !== parentAfter.parentChainSha256
      || !samePath(actualBefore, actualAfter)) {
      throw new Error(`${label}_CHANGED_DURING_READ_HOLD`);
    }
    return Object.freeze({
      absolutePath: resolve(actualAfter),
      bytes,
      sha256: sha256(bytes),
      byteLength: bytes.length,
      device: after.dev.toString(),
      inode: after.ino.toString(),
      parentChainSha256: parentAfter.parentChainSha256,
    });
  } finally {
    closeSync(descriptor);
  }
}

export function describeDisposableDevnetExternalFile({
  absolutePath,
  repositoryRoot = REPOSITORY_ROOT,
  label = "DISPOSABLE_DEVNET_EXTERNAL_FILE",
  maximumBytes = MAX_ARTIFACT_BYTES,
} = {}) {
  const observed = readStableExternalFile(absolutePath, repositoryRoot, label, maximumBytes);
  return Object.freeze({
    absolutePath: observed.absolutePath,
    sha256: observed.sha256,
    byteLength: observed.byteLength,
    device: observed.device,
    inode: observed.inode,
    parentChainSha256: observed.parentChainSha256,
  });
}

function readDescriptor(descriptor, repositoryRoot, label, maximumBytes, requireElf = false) {
  if (!exactKeys(descriptor, FILE_DESCRIPTOR_KEYS)) {
    throw new Error(`${label}_DESCRIPTOR_INVALID`);
  }
  assertHex(descriptor.sha256, HEX_SHA256, `${label}_SHA256`);
  if (!Number.isSafeInteger(descriptor.byteLength) || descriptor.byteLength < 1
    || descriptor.byteLength > maximumBytes) {
    throw new Error(`${label}_BYTE_LENGTH_INVALID`);
  }
  const observed = readStableExternalFile(
    descriptor.absolutePath,
    repositoryRoot,
    label,
    maximumBytes,
  );
  if (observed.sha256 !== descriptor.sha256
    || observed.byteLength !== descriptor.byteLength
    || observed.device !== descriptor.device
    || observed.inode !== descriptor.inode
    || observed.parentChainSha256 !== descriptor.parentChainSha256) {
    throw new Error(`${label}_OBSERVED_BYTES_MISMATCH`);
  }
  if (requireElf && !observed.bytes.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) {
    throw new Error(`${label}_ELF_MAGIC_REQUIRED`);
  }
  return observed;
}

function parseStrictJson(bytes, label) {
  return parseB3OwnerPolicyFreezeJson(bytes.toString("utf8"), label);
}

function extractStringConstant(source, name) {
  const match = source.match(new RegExp(
    `export\\s+const\\s+${name}\\s*=\\s*["']([^"']+)["']\\s*;`,
    "u",
  ));
  if (!match) throw new Error(`DISPOSABLE_DEVNET_${name}_SOURCE_CONSTANT_MISSING`);
  return match[1];
}

function inspectLawProductionFeatureClosure({ cargoManifest, library, buildScript }) {
  const checks = Object.freeze({
    productionFeatureDeclared:
      /^production-combined-hook\s*=\s*\[\s*\]\s*$/mu.test(cargoManifest),
    productionIdentityModuleGated:
      /#\[cfg\(feature = "production-combined-hook"\)\][\s\S]{0,160}mod production_combined_identity/u
        .test(library),
    productionEntrypointPresent:
      /solana_program_entrypoint::entrypoint!\(process_instruction\);/u.test(library),
    buildRequiresProductionFeature:
      buildScript.includes("CARGO_FEATURE_PRODUCTION_COMBINED_HOOK"),
    buildRequiresAllThreeDisposableInputs: [
      "IAT_B3_PRODUCTION_LAW_PROGRAM_ID",
      "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID",
      "IAT_B3_PRODUCTION_CANONICAL_MINT",
    ].every((name) => buildScript.includes(name)),
    recipeUsesProductionFeatureOnly:
      PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.arguments.includes(
        "production-combined-hook",
      ),
  });
  if (!Object.values(checks).every(Boolean)) {
    throw new Error("DISPOSABLE_DEVNET_LAW_PRODUCTION_FEATURE_CLOSURE_HOLD");
  }
  return Object.freeze({
    feature: "production-combined-hook",
    checks,
    sources: Object.freeze({
      cargoManifestSha256: sha256(cargoManifest),
      librarySha256: sha256(library),
      buildScriptSha256: sha256(buildScript),
    }),
  });
}

function readCommittedBlob(repositoryRoot, headSha, path) {
  return readExactCommittedFile(repositoryRoot, headSha, path);
}

export function observeDisposableDevnetExactGitSource(repositoryRoot = REPOSITORY_ROOT) {
  const source = observeExactSource(repositoryRoot);
  if (!HEX_SHA1.test(source.headSha) || !HEX_SHA1.test(source.treeSha)
    || typeof source.statusPorcelain !== "string") {
    throw new Error("DISPOSABLE_DEVNET_CANONICAL_GIT_SOURCE_INVALID_OR_CHANGED_HOLD");
  }
  return Object.freeze({
    ...source,
    treeClosureSha256: disposableDevnetCanonicalSha256({
      headSha: source.headSha,
      treeSha: source.treeSha,
    }),
  });
}

function collectForbiddenIdentities(repositoryRoot) {
  const identities = new Set();
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const absolutePath = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        if (!UNTRACKED_SOURCE_SCAN_EXCLUDED_DIRECTORIES.has(entry.name)) visit(absolutePath);
        continue;
      }
      if (!entry.isFile()) continue;
      const dot = entry.name.lastIndexOf(".");
      if (dot < 0 || !TEXT_SOURCE_EXTENSIONS.has(entry.name.slice(dot))) continue;
      const stat = lstatSync(absolutePath, { bigint: true });
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2n * 1024n * 1024n) continue;
      const bytes = readFileSync(absolutePath);
      if (bytes.includes(0)) continue;
      const source = bytes.toString("utf8");
      for (const match of source.matchAll(/[1-9A-HJ-NP-Za-km-z]{32,44}/gu)) {
        if (isCanonicalBase58Key(match[0])) identities.add(match[0]);
      }
    }
  };
  visit(repositoryRoot);
  return Object.freeze([...identities].sort());
}

export function collectDisposableDevnetCommittedSourceContext({
  repositoryRoot = REPOSITORY_ROOT,
} = {}) {
  const source = observeDisposableDevnetExactGitSource(repositoryRoot);
  if (!HEX_SHA1.test(source.headSha) || !HEX_SHA1.test(source.treeSha)
    || source.statusPorcelain !== "") {
    throw new Error("DISPOSABLE_DEVNET_EXACT_CLEAN_SOURCE_REQUIRED");
  }
  const exactText = (path) => readCommittedBlob(
    repositoryRoot, source.headSha, path,
  ).toString("utf8");
  const lawFeatureClosure = inspectLawProductionFeatureClosure({
    cargoManifest: exactText(`${SITE_PREFIX}programs/iat_b3_law/Cargo.toml`),
    library: exactText(`${SITE_PREFIX}programs/iat_b3_law/src/lib.rs`),
    buildScript: exactText(`${SITE_PREFIX}programs/iat_b3_law/build.rs`),
  });
  const economyFeatureClosure = inspectEconomyProductionSourceClosure({
    cargoManifestSource: exactText(`${SITE_PREFIX}programs/iat_b3_economy/Cargo.toml`),
    librarySource: exactText(`${SITE_PREFIX}programs/iat_b3_economy/src/lib.rs`),
    entrypointSource: exactText(
      `${SITE_PREFIX}programs/iat_b3_economy/src/production_entrypoint.rs`,
    ),
    buildScriptSource: exactText(`${SITE_PREFIX}programs/iat_b3_economy/build.rs`),
  });
  const devnetDriver = exactText(DEVNET_DRIVER_REPOSITORY_PATH);
  const rpcUrl = extractStringConstant(devnetDriver, "DEVNET_RPC");
  const genesisHash = extractStringConstant(devnetDriver, "DEVNET_GENESIS_HASH");
  if (rpcUrl !== DISPOSABLE_DEVNET_RPC_URL
    || genesisHash !== DISPOSABLE_DEVNET_GENESIS_HASH) {
    throw new Error("DISPOSABLE_DEVNET_CANONICAL_NETWORK_SOURCE_DRIFT_HOLD");
  }
  const executedRunnerSha256 = sha256(readFileSync(RUNNER_PATH));
  const committedRunnerSha256 = sha256(readCommittedBlob(
    repositoryRoot, source.headSha, DISPOSABLE_DEVNET_RUNNER_REPOSITORY_PATH,
  ));
  const sourceAfter = observeDisposableDevnetExactGitSource(repositoryRoot);
  const executedRunnerAfterSha256 = sha256(readFileSync(RUNNER_PATH));
  if (executedRunnerSha256 !== committedRunnerSha256
    || executedRunnerAfterSha256 !== executedRunnerSha256) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTED_RUNNER_NOT_COMMITTED_HOLD");
  }
  if (sourceAfter.headSha !== source.headSha
    || sourceAfter.treeSha !== source.treeSha
    || sourceAfter.statusPorcelain !== source.statusPorcelain
    || sourceAfter.treeClosureSha256 !== source.treeClosureSha256) {
    throw new Error("DISPOSABLE_DEVNET_SOURCE_CHANGED_DURING_CLOSURE_HOLD");
  }
  return Object.freeze({
    mode: "COMMITTED_REPOSITORY_DIRECT",
    headSha: source.headSha,
    treeSha: source.treeSha,
    statusPorcelain: source.statusPorcelain,
    runnerPath: DISPOSABLE_DEVNET_RUNNER_REPOSITORY_PATH,
    executedRunnerSha256,
    committedRunnerSha256,
    sourceClosureFileCount: null,
    sourceClosureSha256: source.treeClosureSha256,
    lawProductionFeatureClosureSha256:
      disposableDevnetCanonicalSha256(lawFeatureClosure),
    economyProductionFeatureClosureSha256:
      disposableDevnetCanonicalSha256(economyFeatureClosure),
    devnetDriverSha256: sha256(devnetDriver),
    rpcUrl,
    genesisHash,
    forbiddenIdentities: collectForbiddenIdentities(repositoryRoot),
  });
}

function assertSourceContext(context) {
  const keys = [
    "mode", "headSha", "treeSha", "statusPorcelain", "runnerPath",
    "executedRunnerSha256", "committedRunnerSha256", "sourceClosureFileCount",
    "sourceClosureSha256", "lawProductionFeatureClosureSha256",
    "economyProductionFeatureClosureSha256", "devnetDriverSha256", "rpcUrl",
    "genesisHash", "forbiddenIdentities",
  ];
  if (!exactKeys(context, keys)
    || context.mode !== "COMMITTED_REPOSITORY_DIRECT"
    || !HEX_SHA1.test(context.headSha)
    || !HEX_SHA1.test(context.treeSha)
    || context.statusPorcelain !== ""
    || context.runnerPath !== DISPOSABLE_DEVNET_RUNNER_REPOSITORY_PATH
    || context.executedRunnerSha256 !== context.committedRunnerSha256
    || (context.sourceClosureFileCount !== null
      && (!Number.isSafeInteger(context.sourceClosureFileCount)
        || context.sourceClosureFileCount < 1))
    || context.rpcUrl !== DISPOSABLE_DEVNET_RPC_URL
    || context.genesisHash !== DISPOSABLE_DEVNET_GENESIS_HASH
    || !Array.isArray(context.forbiddenIdentities)
    || !context.forbiddenIdentities.every(isCanonicalBase58Key)) {
    throw new Error("DISPOSABLE_DEVNET_TRUSTED_SOURCE_CONTEXT_INVALID");
  }
  for (const key of [
    "executedRunnerSha256", "committedRunnerSha256", "sourceClosureSha256",
    "lawProductionFeatureClosureSha256", "economyProductionFeatureClosureSha256",
    "devnetDriverSha256",
  ]) assertHex(context[key], HEX_SHA256, `DISPOSABLE_DEVNET_CONTEXT_${key.toUpperCase()}`);
  return context;
}

function validateIdentityRecord(record, preflight, context) {
  const keys = [
    "schema", "laneId", "observedAtUtc", "sourceHeadSha", "runnerSha256",
    "generationMode", "lawProgramId", "economyProgramId", "canonicalMint",
    "publicKeysOnly", "privateKeyMaterialIncluded",
  ];
  if (!exactKeys(record, keys)
    || record.schema !== DISPOSABLE_DEVNET_IDENTITY_OBSERVATION_SCHEMA
    || record.laneId !== preflight.laneId
    || record.sourceHeadSha !== context.headSha
    || record.runnerSha256 !== context.committedRunnerSha256
    || record.generationMode !== "FRESH_ISOLATED_OFFLINE_KEYGEN"
    || record.publicKeysOnly !== true
    || record.privateKeyMaterialIncluded !== false) {
    throw new Error("DISPOSABLE_DEVNET_SELF_AUTHORED_IDENTITY_RECORD_INVALID");
  }
  assertObservationFresh(
    record.observedAtUtc,
    preflight.generatedAtUtc,
    "DISPOSABLE_DEVNET_SELF_AUTHORED_IDENTITY_RECORD",
  );
  const identities = [record.lawProgramId, record.economyProgramId, record.canonicalMint];
  if (!identities.every(isCanonicalBase58Key) || new Set(identities).size !== 3) {
    throw new Error("DISPOSABLE_DEVNET_THREE_DISTINCT_CANONICAL_IDENTITIES_REQUIRED");
  }
  const forbidden = new Set(context.forbiddenIdentities);
  if (identities.some((identity) => forbidden.has(identity))) {
    throw new Error("DISPOSABLE_DEVNET_PRODUCTION_OR_CHECKED_IN_IDENTITY_REUSE_HOLD");
  }
  return record;
}

function validateGenesisRecord(record, preflight, context) {
  const keys = [
    "schema", "laneId", "observedAtUtc", "sourceHeadSha", "runnerSha256",
    "rpcUrl", "method", "request", "response",
  ];
  if (!exactKeys(record, keys)
    || record.schema !== DISPOSABLE_DEVNET_GENESIS_OBSERVATION_SCHEMA
    || record.laneId !== preflight.laneId
    || record.sourceHeadSha !== context.headSha
    || record.runnerSha256 !== context.committedRunnerSha256
    || record.rpcUrl !== context.rpcUrl
    || record.method !== "getGenesisHash"
    || !exactKeys(record.request, ["jsonrpc", "id", "method"])
    || record.request.jsonrpc !== "2.0"
    || record.request.id !== 1
    || record.request.method !== "getGenesisHash"
    || !exactKeys(record.response, ["jsonrpc", "id", "result"])
    || record.response.jsonrpc !== "2.0"
    || record.response.id !== 1
    || record.response.result !== context.genesisHash) {
    throw new Error("DISPOSABLE_DEVNET_SELF_AUTHORED_GENESIS_RECORD_INVALID");
  }
  assertObservationFresh(
    record.observedAtUtc,
    preflight.generatedAtUtc,
    "DISPOSABLE_DEVNET_SELF_AUTHORED_GENESIS_RECORD",
  );
  return record;
}

function expectedRecipes(identities) {
  const lawEnvironment = Object.freeze({
    IAT_B3_PRODUCTION_LAW_PROGRAM_ID: identities.lawProgramId,
    IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID: identities.economyProgramId,
    IAT_B3_PRODUCTION_CANONICAL_MINT: identities.canonicalMint,
  });
  const economyEnvironment = Object.freeze({
    ...lawEnvironment,
    IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH: DISPOSABLE_DEVNET_GENESIS_HASH,
  });
  return Object.freeze({
    law: Object.freeze({
      feature: "production-combined-hook",
      forbiddenFeature: null,
      recipeSha256: disposableDevnetCanonicalSha256(
        PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
      ),
      environment: lawEnvironment,
      environmentSha256: disposableDevnetCanonicalSha256(lawEnvironment),
      backend: "DOCKER_ONLY",
      networkPolicy: "OFFLINE_PREINSTALLED_TOOLCHAIN_ONLY",
      repetitions: 2,
    }),
    economy: Object.freeze({
      feature: ECONOMY_PRODUCTION_FEATURE,
      forbiddenFeature: ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE,
      recipeSha256: disposableDevnetCanonicalSha256(ECONOMY_SBF_BUILD_RECIPE),
      environment: economyEnvironment,
      environmentSha256: disposableDevnetCanonicalSha256(economyEnvironment),
      backend: "DOCKER_ONLY",
      networkPolicy: "OFFLINE_PREINSTALLED_TOOLCHAIN_ONLY",
      repetitions: 2,
    }),
  });
}

function assertExactRecord(actual, expected, label) {
  if (disposableDevnetCanonicalJson(actual) !== disposableDevnetCanonicalJson(expected)) {
    throw new Error(`${label}_DRIFT_HOLD`);
  }
}

export function createDisposableDevnetDualBuildPreflight({
  generatedAtUtc,
  laneId,
  sourceContext,
  identityObservation,
  genesisObservation,
  container,
  toolchain,
  repositoryRoot = REPOSITORY_ROOT,
} = {}) {
  const context = assertSourceContext(sourceContext);
  if (!LANE_ID.test(laneId ?? "")) throw new Error("DISPOSABLE_DEVNET_LANE_ID_INVALID");
  parseExactUtc(generatedAtUtc, "DISPOSABLE_DEVNET_GENERATED_AT_UTC");
  assertPinnedContainerObservation(container);
  assertPinnedToolchainObservation(toolchain);
  const identityFile = readDescriptor(
    identityObservation,
    repositoryRoot,
    "DISPOSABLE_DEVNET_IDENTITY_OBSERVATION",
    MAX_IDENTITY_OBSERVATION_BYTES,
  );
  const genesisFile = readDescriptor(
    genesisObservation,
    repositoryRoot,
    "DISPOSABLE_DEVNET_GENESIS_OBSERVATION",
    MAX_GENESIS_OBSERVATION_BYTES,
  );
  if (identityFile.absolutePath === genesisFile.absolutePath) {
    throw new Error("DISPOSABLE_DEVNET_OBSERVATION_PATH_ALIAS_HOLD");
  }
  const shell = { laneId, generatedAtUtc };
  const identityRecord = validateIdentityRecord(
    parseStrictJson(identityFile.bytes, identityFile.absolutePath),
    shell,
    context,
  );
  const genesisRecord = validateGenesisRecord(
    parseStrictJson(genesisFile.bytes, genesisFile.absolutePath),
    shell,
    context,
  );
  const identityCore = Object.freeze({
    lawProgramId: identityRecord.lawProgramId,
    economyProgramId: identityRecord.economyProgramId,
    canonicalMint: identityRecord.canonicalMint,
  });
  const core = {
    schema: DISPOSABLE_DEVNET_PREFLIGHT_SCHEMA,
    status: DISPOSABLE_DEVNET_PREFLIGHT_STRUCTURAL_HOLD,
    generatedAtUtc,
    laneId,
    scope: DISPOSABLE_DEVNET_SCOPE,
    source: {
      declaredHeadSha: context.headSha,
      observedHeadSha: context.headSha,
      observedTreeSha: context.treeSha,
      repositoryCleanTrackedAndUntracked: true,
      runnerPath: context.runnerPath,
      executedRunnerSha256: context.executedRunnerSha256,
      committedRunnerSha256: context.committedRunnerSha256,
      sourceClosureFileCount: context.sourceClosureFileCount,
      sourceClosureSha256: context.sourceClosureSha256,
      lawProductionFeatureClosureSha256: context.lawProductionFeatureClosureSha256,
      economyProductionFeatureClosureSha256:
        context.economyProductionFeatureClosureSha256,
    },
    devnet: {
      network: DISPOSABLE_DEVNET_NETWORK,
      rpcUrl: context.rpcUrl,
      observedGenesisHash: genesisRecord.response.result,
      observation: genesisObservation,
    },
    identities: {
      ...identityCore,
      observation: identityObservation,
      bindingSha256: disposableDevnetCanonicalSha256({
        laneId,
        sourceHeadSha: context.headSha,
        genesisHash: genesisRecord.response.result,
        identityObservationSha256: identityFile.sha256,
        identities: identityCore,
      }),
      freshAndDisposable: true,
    },
    container: { ...container },
    toolchain: { ...toolchain },
    recipes: expectedRecipes(identityCore),
    safety: { ...PREFLIGHT_SAFETY },
  };
  return Object.freeze({
    ...core,
    preflightSha256: disposableDevnetCanonicalSha256(core),
  });
}

export function validateDisposableDevnetDualBuildPreflight(
  preflight,
  { sourceContext, repositoryRoot = REPOSITORY_ROOT } = {},
) {
  const context = assertSourceContext(sourceContext);
  if (!exactKeys(preflight, PREFLIGHT_KEYS)
    || preflight.schema !== DISPOSABLE_DEVNET_PREFLIGHT_SCHEMA
    || preflight.status !== DISPOSABLE_DEVNET_PREFLIGHT_STRUCTURAL_HOLD
    || preflight.scope !== DISPOSABLE_DEVNET_SCOPE
    || !LANE_ID.test(preflight.laneId ?? "")
    || !exactKeys(preflight.source, SOURCE_KEYS)
    || !exactKeys(preflight.devnet, DEVNET_KEYS)
    || !exactKeys(preflight.identities, IDENTITY_KEYS)
    || !exactKeys(preflight.recipes, RECIPE_SET_KEYS)
    || !exactKeys(preflight.recipes.law, RECIPE_KEYS)
    || !exactKeys(preflight.recipes.economy, RECIPE_KEYS)) {
    throw new Error("DISPOSABLE_DEVNET_PREFLIGHT_SHAPE_INVALID");
  }
  parseExactUtc(preflight.generatedAtUtc, "DISPOSABLE_DEVNET_GENERATED_AT_UTC");
  assertHex(preflight.preflightSha256, HEX_SHA256, "DISPOSABLE_DEVNET_PREFLIGHT_SHA256");
  if (preflight.preflightSha256
    !== disposableDevnetCanonicalSha256(withoutDigest(preflight, "preflightSha256"))) {
    throw new Error("DISPOSABLE_DEVNET_PREFLIGHT_DIGEST_MISMATCH");
  }
  const expectedSource = {
    declaredHeadSha: context.headSha,
    observedHeadSha: context.headSha,
    observedTreeSha: context.treeSha,
    repositoryCleanTrackedAndUntracked: true,
    runnerPath: context.runnerPath,
    executedRunnerSha256: context.executedRunnerSha256,
    committedRunnerSha256: context.committedRunnerSha256,
    sourceClosureFileCount: context.sourceClosureFileCount,
    sourceClosureSha256: context.sourceClosureSha256,
    lawProductionFeatureClosureSha256: context.lawProductionFeatureClosureSha256,
    economyProductionFeatureClosureSha256: context.economyProductionFeatureClosureSha256,
  };
  assertExactRecord(preflight.source, expectedSource, "DISPOSABLE_DEVNET_SOURCE_BINDING");
  if (preflight.devnet.network !== DISPOSABLE_DEVNET_NETWORK
    || preflight.devnet.rpcUrl !== context.rpcUrl
    || preflight.devnet.observedGenesisHash !== context.genesisHash
    || preflight.identities.freshAndDisposable !== true) {
    throw new Error("DISPOSABLE_DEVNET_NETWORK_OR_IDENTITY_BOUNDARY_INVALID");
  }
  const identityFile = readDescriptor(
    preflight.identities.observation,
    repositoryRoot,
    "DISPOSABLE_DEVNET_IDENTITY_OBSERVATION",
    MAX_IDENTITY_OBSERVATION_BYTES,
  );
  const genesisFile = readDescriptor(
    preflight.devnet.observation,
    repositoryRoot,
    "DISPOSABLE_DEVNET_GENESIS_OBSERVATION",
    MAX_GENESIS_OBSERVATION_BYTES,
  );
  if (identityFile.absolutePath === genesisFile.absolutePath) {
    throw new Error("DISPOSABLE_DEVNET_OBSERVATION_PATH_ALIAS_HOLD");
  }
  const identityRecord = validateIdentityRecord(
    parseStrictJson(identityFile.bytes, identityFile.absolutePath),
    preflight,
    context,
  );
  validateGenesisRecord(
    parseStrictJson(genesisFile.bytes, genesisFile.absolutePath),
    preflight,
    context,
  );
  const identityCore = {
    lawProgramId: identityRecord.lawProgramId,
    economyProgramId: identityRecord.economyProgramId,
    canonicalMint: identityRecord.canonicalMint,
  };
  for (const [key, value] of Object.entries(identityCore)) {
    if (preflight.identities[key] !== value) {
      throw new Error("DISPOSABLE_DEVNET_IDENTITY_OBSERVED_BYTES_MISMATCH");
    }
  }
  const expectedIdentityBinding = disposableDevnetCanonicalSha256({
    laneId: preflight.laneId,
    sourceHeadSha: context.headSha,
    genesisHash: context.genesisHash,
    identityObservationSha256: identityFile.sha256,
    identities: identityCore,
  });
  if (preflight.identities.bindingSha256 !== expectedIdentityBinding) {
    throw new Error("DISPOSABLE_DEVNET_IDENTITY_BINDING_MISMATCH");
  }
  assertPinnedContainerObservation(preflight.container);
  assertPinnedToolchainObservation(preflight.toolchain);
  assertExactRecord(
    preflight.recipes,
    expectedRecipes(identityCore),
    "DISPOSABLE_DEVNET_PRODUCTION_FEATURE_RECIPE",
  );
  assertExactRecord(preflight.safety, PREFLIGHT_SAFETY, "DISPOSABLE_DEVNET_PREFLIGHT_SAFETY");
  return preflight;
}

export function formatDisposableDevnetBuildLog({
  laneId,
  preflightSha256,
  sourceHeadSha,
  sourceClosureSha256,
  identityBindingSha256,
  buildOrdinal,
  kind,
  workspaceRoot,
  backend,
  containerExecutionReference,
  networkMode,
  pullPolicy,
  recipeSha256,
  environmentSha256,
  artifactSha256,
  artifactByteLength,
  rawBuildOutput = "",
} = {}) {
  const header = {
    schema: DISPOSABLE_DEVNET_BUILD_LOG_HEADER_SCHEMA,
    laneId,
    preflightSha256,
    sourceHeadSha,
    sourceClosureSha256,
    identityBindingSha256,
    buildOrdinal,
    kind,
    workspaceRoot,
    backend,
    containerExecutionReference,
    networkMode,
    pullPolicy,
    recipeSha256,
    environmentSha256,
    artifactSha256,
    artifactByteLength,
  };
  return `${JSON.stringify(header)}\n${rawBuildOutput}`;
}

function parseBuildLogHeader(bytes, expected) {
  const newline = bytes.indexOf(0x0a);
  if (newline < 1 || newline === bytes.length - 1) {
    throw new Error("DISPOSABLE_DEVNET_BUILD_LOG_HEADER_OR_RAW_OUTPUT_MISSING");
  }
  const header = parseB3OwnerPolicyFreezeJson(
    bytes.subarray(0, newline).toString("utf8"),
    "DISPOSABLE_DEVNET_BUILD_LOG_HEADER",
  );
  const keys = [
    "schema", "laneId", "preflightSha256", "sourceHeadSha",
    "sourceClosureSha256", "identityBindingSha256", "buildOrdinal", "kind",
    "workspaceRoot", "backend", "containerExecutionReference", "networkMode",
    "pullPolicy", "recipeSha256", "environmentSha256",
    "artifactSha256", "artifactByteLength",
  ];
  if (!exactKeys(header, keys)
    || header.schema !== DISPOSABLE_DEVNET_BUILD_LOG_HEADER_SCHEMA) {
    throw new Error("DISPOSABLE_DEVNET_BUILD_LOG_HEADER_INVALID");
  }
  assertExactRecord(header, expected, "DISPOSABLE_DEVNET_BUILD_LOG_LANE_BINDING");
  return header;
}

function observeBuildOutput({
  output,
  kind,
  ordinal,
  workspaceRoot,
  preflight,
  repositoryRoot,
}) {
  if (!exactKeys(output, BUILD_OUTPUT_KEYS)) {
    throw new Error(`DISPOSABLE_DEVNET_${kind}_BUILD_${ordinal}_OUTPUT_INVALID`);
  }
  const artifact = readDescriptor(
    output.artifact,
    repositoryRoot,
    `DISPOSABLE_DEVNET_${kind}_BUILD_${ordinal}_ARTIFACT`,
    MAX_ARTIFACT_BYTES,
    true,
  );
  const rawLog = readDescriptor(
    output.rawLog,
    repositoryRoot,
    `DISPOSABLE_DEVNET_${kind}_BUILD_${ordinal}_RAW_LOG`,
    MAX_BUILD_LOG_BYTES,
  );
  if (!isWithinRoot(artifact.absolutePath, workspaceRoot)
    || !isWithinRoot(rawLog.absolutePath, workspaceRoot)) {
    throw new Error(`DISPOSABLE_DEVNET_${kind}_BUILD_${ordinal}_PATH_ESCAPES_WORKSPACE`);
  }
  const expectedName = kind === "LAW" ? "iat_b3_law.so" : "iat_b3_economy.so";
  if (basename(artifact.absolutePath) !== expectedName) {
    throw new Error(`DISPOSABLE_DEVNET_${kind}_BUILD_${ordinal}_ARTIFACT_NAME_INVALID`);
  }
  parseBuildLogHeader(rawLog.bytes, {
    schema: DISPOSABLE_DEVNET_BUILD_LOG_HEADER_SCHEMA,
    laneId: preflight.laneId,
    preflightSha256: preflight.preflightSha256,
    sourceHeadSha: preflight.source.declaredHeadSha,
    sourceClosureSha256: preflight.source.sourceClosureSha256,
    identityBindingSha256: preflight.identities.bindingSha256,
    buildOrdinal: ordinal,
    kind,
    workspaceRoot,
    backend: "DOCKER_ONLY",
    containerExecutionReference: preflight.container.executionReference,
    networkMode: "none",
    pullPolicy: "never",
    recipeSha256: preflight.recipes[kind.toLowerCase()].recipeSha256,
    environmentSha256: preflight.recipes[kind.toLowerCase()].environmentSha256,
    artifactSha256: artifact.sha256,
    artifactByteLength: artifact.byteLength,
  });
  return Object.freeze({ artifact, rawLog });
}

function validateBuildRecord(build, ordinal, preflight, repositoryRoot) {
  const inputShape = exactKeys(build, BUILD_INPUT_KEYS);
  const boundShape = exactKeys(build, BUILD_KEYS);
  if ((!inputShape && !boundShape)
    || build.ordinal !== ordinal
    || build.workspaceWasFresh !== true
    || build.targetDirectoryWasFresh !== true
    || build.outputDirectoryWasFresh !== true) {
    throw new Error(`DISPOSABLE_DEVNET_BUILD_${ordinal}_FRESH_ISOLATION_REQUIRED`);
  }
  const declaredDirectory = boundShape ? {
    device: build.workspaceDevice,
    inode: build.workspaceInode,
    parentChainSha256: build.workspaceParentChainSha256,
  } : null;
  const workspace = assertExternalDirectory(
    build.workspaceRoot,
    repositoryRoot,
    `DISPOSABLE_DEVNET_BUILD_${ordinal}_WORKSPACE`,
    declaredDirectory,
  );
  const law = observeBuildOutput({
    output: build.law,
    kind: "LAW",
    ordinal,
    workspaceRoot: workspace.absolutePath,
    preflight,
    repositoryRoot,
  });
  const economy = observeBuildOutput({
    output: build.economy,
    kind: "ECONOMY",
    ordinal,
    workspaceRoot: workspace.absolutePath,
    preflight,
    repositoryRoot,
  });
  assertExternalDirectory(
    workspace.absolutePath,
    repositoryRoot,
    `DISPOSABLE_DEVNET_BUILD_${ordinal}_WORKSPACE`,
    workspace,
  );
  return Object.freeze({
    workspaceRoot: workspace.absolutePath,
    directory: workspace,
    record: Object.freeze({
      ...build,
      workspaceRoot: workspace.absolutePath,
      workspaceDevice: workspace.device,
      workspaceInode: workspace.inode,
      workspaceParentChainSha256: workspace.parentChainSha256,
    }),
    law,
    economy,
  });
}

function expectedArtifactEquality(kind, first, second, preservedDescriptor, preserved) {
  const fileName = kind === "law" ? "iat_b3_law.so" : "iat_b3_economy.so";
  if (!first.bytes.equals(second.bytes) || !first.bytes.equals(preserved.bytes)) {
    throw new Error(`DISPOSABLE_DEVNET_${kind.toUpperCase()}_DUAL_BUILD_BYTES_DIFFER_HOLD`);
  }
  return {
    fileName,
    byteLength: first.byteLength,
    sha256: first.sha256,
    firstBuildSha256: first.sha256,
    secondBuildSha256: second.sha256,
    preservedArtifact: preservedDescriptor,
    identicalByteLength: true,
    identicalSha256: true,
    identicalBytes: true,
  };
}

function sourceAndIdentityBinding(preflight) {
  return disposableDevnetCanonicalSha256({
    laneId: preflight.laneId,
    preflightSha256: preflight.preflightSha256,
    source: preflight.source,
    devnet: {
      network: preflight.devnet.network,
      rpcUrl: preflight.devnet.rpcUrl,
      observedGenesisHash: preflight.devnet.observedGenesisHash,
      observationSha256: preflight.devnet.observation.sha256,
    },
    identities: {
      lawProgramId: preflight.identities.lawProgramId,
      economyProgramId: preflight.identities.economyProgramId,
      canonicalMint: preflight.identities.canonicalMint,
      bindingSha256: preflight.identities.bindingSha256,
    },
    container: preflight.container,
    toolchain: preflight.toolchain,
    recipes: preflight.recipes,
  });
}

export function createDisposableDevnetDualBuildReceipt({
  generatedAtUtc,
  preflight,
  sourceContext,
  firstBuild,
  secondBuild,
  preservedRoot,
  preservedLawArtifact,
  preservedEconomyArtifact,
  repositoryRoot = REPOSITORY_ROOT,
} = {}) {
  validateDisposableDevnetDualBuildPreflight(preflight, { sourceContext, repositoryRoot });
  const receiptTime = parseExactUtc(generatedAtUtc, "DISPOSABLE_DEVNET_RECEIPT_TIME");
  const preflightTime = parseExactUtc(preflight.generatedAtUtc, "DISPOSABLE_DEVNET_PREFLIGHT_TIME");
  if (receiptTime < preflightTime
    || receiptTime - preflightTime > MAX_RECEIPT_DELAY_MILLISECONDS) {
    throw new Error("DISPOSABLE_DEVNET_RECEIPT_TIME_OUTSIDE_LANE_WINDOW_HOLD");
  }
  const preserveRoot = assertExternalDirectory(
    preservedRoot,
    repositoryRoot,
    "DISPOSABLE_DEVNET_PRESERVED_ROOT",
  );
  const observedFirst = validateBuildRecord(firstBuild, 1, preflight, repositoryRoot);
  const observedSecond = validateBuildRecord(secondBuild, 2, preflight, repositoryRoot);
  if (observedFirst.workspaceRoot === observedSecond.workspaceRoot
    || isWithinRoot(observedFirst.workspaceRoot, observedSecond.workspaceRoot)
    || isWithinRoot(observedSecond.workspaceRoot, observedFirst.workspaceRoot)
    || preserveRoot.absolutePath === observedFirst.workspaceRoot
    || preserveRoot.absolutePath === observedSecond.workspaceRoot
    || isWithinRoot(preserveRoot.absolutePath, observedFirst.workspaceRoot)
    || isWithinRoot(preserveRoot.absolutePath, observedSecond.workspaceRoot)
    || isWithinRoot(observedFirst.workspaceRoot, preserveRoot.absolutePath)
    || isWithinRoot(observedSecond.workspaceRoot, preserveRoot.absolutePath)) {
    throw new Error("DISPOSABLE_DEVNET_TWO_DISTINCT_NONNESTED_BUILD_ROOTS_REQUIRED");
  }
  const preservedLaw = readDescriptor(
    preservedLawArtifact,
    repositoryRoot,
    "DISPOSABLE_DEVNET_PRESERVED_LAW_ARTIFACT",
    MAX_ARTIFACT_BYTES,
    true,
  );
  const preservedEconomy = readDescriptor(
    preservedEconomyArtifact,
    repositoryRoot,
    "DISPOSABLE_DEVNET_PRESERVED_ECONOMY_ARTIFACT",
    MAX_ARTIFACT_BYTES,
    true,
  );
  if (!isWithinRoot(preservedLaw.absolutePath, preserveRoot.absolutePath)
    || !isWithinRoot(preservedEconomy.absolutePath, preserveRoot.absolutePath)) {
    throw new Error("DISPOSABLE_DEVNET_PRESERVED_ARTIFACT_PATH_INVALID");
  }
  const paths = [
    preflight.identities.observation.absolutePath,
    preflight.devnet.observation.absolutePath,
    ...[observedFirst, observedSecond].flatMap((build) => [
      build.law.artifact.absolutePath,
      build.law.rawLog.absolutePath,
      build.economy.artifact.absolutePath,
      build.economy.rawLog.absolutePath,
    ]),
    preservedLaw.absolutePath,
    preservedEconomy.absolutePath,
  ];
  if (new Set(paths).size !== paths.length) {
    throw new Error("DISPOSABLE_DEVNET_EVIDENCE_PATH_ALIAS_HOLD");
  }
  const artifactEquality = {
    law: expectedArtifactEquality(
      "law",
      observedFirst.law.artifact,
      observedSecond.law.artifact,
      preservedLawArtifact,
      preservedLaw,
    ),
    economy: expectedArtifactEquality(
      "economy",
      observedFirst.economy.artifact,
      observedSecond.economy.artifact,
      preservedEconomyArtifact,
      preservedEconomy,
    ),
  };
  if (artifactEquality.law.sha256 === artifactEquality.economy.sha256) {
    throw new Error("DISPOSABLE_DEVNET_LAW_AND_ECONOMY_ARTIFACT_ALIAS_HOLD");
  }
  assertExternalDirectory(
    preserveRoot.absolutePath,
    repositoryRoot,
    "DISPOSABLE_DEVNET_PRESERVED_ROOT",
    preserveRoot,
  );
  const core = {
    schema: DISPOSABLE_DEVNET_RECEIPT_SCHEMA,
    status: DISPOSABLE_DEVNET_RECEIPT_STRUCTURAL_HOLD,
    generatedAtUtc,
    laneId: preflight.laneId,
    scope: DISPOSABLE_DEVNET_SCOPE,
    preflightSha256: preflight.preflightSha256,
    sourceAndIdentityBindingSha256: sourceAndIdentityBinding(preflight),
    builds: { first: observedFirst.record, second: observedSecond.record },
    preservedRoot: preserveRoot.absolutePath,
    preservedRootDevice: preserveRoot.device,
    preservedRootInode: preserveRoot.inode,
    preservedRootParentChainSha256: preserveRoot.parentChainSha256,
    artifacts: artifactEquality,
    safety: { ...RECEIPT_SAFETY },
  };
  return Object.freeze({ ...core, receiptSha256: disposableDevnetCanonicalSha256(core) });
}

export function validateDisposableDevnetDualBuildReceipt(
  receipt,
  { preflight, sourceContext, repositoryRoot = REPOSITORY_ROOT } = {},
) {
  validateDisposableDevnetDualBuildPreflight(preflight, { sourceContext, repositoryRoot });
  if (!exactKeys(receipt, RECEIPT_KEYS)
    || receipt.schema !== DISPOSABLE_DEVNET_RECEIPT_SCHEMA
    || receipt.status !== DISPOSABLE_DEVNET_RECEIPT_STRUCTURAL_HOLD
    || receipt.scope !== DISPOSABLE_DEVNET_SCOPE
    || receipt.laneId !== preflight.laneId
    || receipt.preflightSha256 !== preflight.preflightSha256
    || !exactKeys(receipt.builds, BUILD_SET_KEYS)
    || !exactKeys(receipt.artifacts, ARTIFACT_SET_KEYS)
    || !exactKeys(receipt.artifacts.law, ARTIFACT_EQUALITY_KEYS)
    || !exactKeys(receipt.artifacts.economy, ARTIFACT_EQUALITY_KEYS)) {
    throw new Error("DISPOSABLE_DEVNET_RECEIPT_SHAPE_OR_LANE_INVALID");
  }
  const receiptTime = parseExactUtc(receipt.generatedAtUtc, "DISPOSABLE_DEVNET_RECEIPT_TIME");
  const preflightTime = parseExactUtc(preflight.generatedAtUtc, "DISPOSABLE_DEVNET_PREFLIGHT_TIME");
  if (receiptTime < preflightTime
    || receiptTime - preflightTime > MAX_RECEIPT_DELAY_MILLISECONDS) {
    throw new Error("DISPOSABLE_DEVNET_RECEIPT_TIME_OUTSIDE_LANE_WINDOW_HOLD");
  }
  assertHex(receipt.receiptSha256, HEX_SHA256, "DISPOSABLE_DEVNET_RECEIPT_SHA256");
  if (receipt.receiptSha256
    !== disposableDevnetCanonicalSha256(withoutDigest(receipt, "receiptSha256"))) {
    throw new Error("DISPOSABLE_DEVNET_RECEIPT_DIGEST_MISMATCH");
  }
  if (receipt.sourceAndIdentityBindingSha256 !== sourceAndIdentityBinding(preflight)) {
    throw new Error("DISPOSABLE_DEVNET_RECEIPT_SOURCE_IDENTITY_BINDING_MISMATCH");
  }
  const preserveRoot = assertExternalDirectory(
    receipt.preservedRoot,
    repositoryRoot,
    "DISPOSABLE_DEVNET_PRESERVED_ROOT",
    {
      device: receipt.preservedRootDevice,
      inode: receipt.preservedRootInode,
      parentChainSha256: receipt.preservedRootParentChainSha256,
    },
  );
  const first = validateBuildRecord(receipt.builds.first, 1, preflight, repositoryRoot);
  const second = validateBuildRecord(receipt.builds.second, 2, preflight, repositoryRoot);
  if (first.workspaceRoot === second.workspaceRoot
    || isWithinRoot(first.workspaceRoot, second.workspaceRoot)
    || isWithinRoot(second.workspaceRoot, first.workspaceRoot)
    || preserveRoot.absolutePath === first.workspaceRoot
    || preserveRoot.absolutePath === second.workspaceRoot
    || isWithinRoot(preserveRoot.absolutePath, first.workspaceRoot)
    || isWithinRoot(preserveRoot.absolutePath, second.workspaceRoot)
    || isWithinRoot(first.workspaceRoot, preserveRoot.absolutePath)
    || isWithinRoot(second.workspaceRoot, preserveRoot.absolutePath)) {
    throw new Error("DISPOSABLE_DEVNET_TWO_DISTINCT_NONNESTED_BUILD_ROOTS_REQUIRED");
  }
  const preservedLaw = readDescriptor(
    receipt.artifacts.law.preservedArtifact,
    repositoryRoot,
    "DISPOSABLE_DEVNET_PRESERVED_LAW_ARTIFACT",
    MAX_ARTIFACT_BYTES,
    true,
  );
  const preservedEconomy = readDescriptor(
    receipt.artifacts.economy.preservedArtifact,
    repositoryRoot,
    "DISPOSABLE_DEVNET_PRESERVED_ECONOMY_ARTIFACT",
    MAX_ARTIFACT_BYTES,
    true,
  );
  if (!isWithinRoot(preservedLaw.absolutePath, preserveRoot.absolutePath)
    || !isWithinRoot(preservedEconomy.absolutePath, preserveRoot.absolutePath)) {
    throw new Error("DISPOSABLE_DEVNET_PRESERVED_ARTIFACT_PATH_INVALID");
  }
  const expected = {
    law: expectedArtifactEquality(
      "law",
      first.law.artifact,
      second.law.artifact,
      receipt.artifacts.law.preservedArtifact,
      preservedLaw,
    ),
    economy: expectedArtifactEquality(
      "economy",
      first.economy.artifact,
      second.economy.artifact,
      receipt.artifacts.economy.preservedArtifact,
      preservedEconomy,
    ),
  };
  assertExactRecord(receipt.artifacts, expected, "DISPOSABLE_DEVNET_ARTIFACT_EQUALITY");
  if (expected.law.sha256 === expected.economy.sha256) {
    throw new Error("DISPOSABLE_DEVNET_LAW_AND_ECONOMY_ARTIFACT_ALIAS_HOLD");
  }
  const paths = [
    preflight.identities.observation.absolutePath,
    preflight.devnet.observation.absolutePath,
    ...[first, second].flatMap((build) => [
      build.law.artifact.absolutePath,
      build.law.rawLog.absolutePath,
      build.economy.artifact.absolutePath,
      build.economy.rawLog.absolutePath,
    ]),
    preservedLaw.absolutePath,
    preservedEconomy.absolutePath,
  ];
  if (new Set(paths).size !== paths.length) {
    throw new Error("DISPOSABLE_DEVNET_EVIDENCE_PATH_ALIAS_HOLD");
  }
  assertExternalDirectory(
    preserveRoot.absolutePath,
    repositoryRoot,
    "DISPOSABLE_DEVNET_PRESERVED_ROOT",
    preserveRoot,
  );
  assertExactRecord(receipt.safety, RECEIPT_SAFETY, "DISPOSABLE_DEVNET_RECEIPT_SAFETY");
  return receipt;
}

export function validateDisposableDevnetEvidenceState(state) {
  const keys = [
    "schema", "status", "implementationBaseHeadSha", "contract", "evidence",
    "truth", "blockers",
  ];
  if (!exactKeys(state, keys)
    || state.schema !== DISPOSABLE_DEVNET_EVIDENCE_STATE_SCHEMA
    || state.status !== "HOLD"
    || !HEX_SHA1.test(state.implementationBaseHeadSha ?? "")
    || !exactKeys(state.contract, [
      "runnerPath", "preflightSchema", "receiptSchema", "scope",
      "classification", "authorizing", "committedRunnerAtEvidenceHeadRequired",
    ])
    || state.contract.runnerPath !== DISPOSABLE_DEVNET_RUNNER_REPOSITORY_PATH
    || state.contract.preflightSchema !== DISPOSABLE_DEVNET_PREFLIGHT_SCHEMA
    || state.contract.receiptSchema !== DISPOSABLE_DEVNET_RECEIPT_SCHEMA
    || state.contract.scope !== DISPOSABLE_DEVNET_SCOPE
    || state.contract.classification !== "STRUCTURAL_CONTRACT_ONLY"
    || state.contract.authorizing !== false
    || state.contract.committedRunnerAtEvidenceHeadRequired !== true
    || !exactKeys(state.evidence, ["preflight", "receipt"])
    || state.evidence.preflight !== null
    || state.evidence.receipt !== null
    || !exactKeys(state.truth, [
      "structuralContractValidated", "executionProvenanceObserved",
      "buildExecutionObserved", "behavioralDevnetEvidence",
      "adversarialDevnetExecutionEvidence", "productionFinalByteEvidence",
      "devnetExecutionObserved", "devnetRehearsalComplete", "signingAuthorized",
      "deploymentAuthorized", "releaseAuthorized", "mainnetExecutionAuthorized",
      "mainnetStatus",
    ])
    || Object.entries(state.truth).some(([key, value]) => (
      key === "mainnetStatus" ? value !== "HOLD" : value !== false
    ))
    || !Array.isArray(state.blockers)
    || state.blockers.length < 1
    || !state.blockers.every((value) => typeof value === "string" && value.length > 0)
    || !state.blockers.includes("DISPOSABLE_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE")) {
    throw new Error("DISPOSABLE_DEVNET_CANONICAL_EVIDENCE_STATE_INVALID");
  }
  return state;
}

function failClosedReport(blocker) {
  return {
    schema: "iat-b3-disposable-devnet-structural-contract-validation/v2",
    valid: false,
    status: "HOLD",
    structuralContractOnly: true,
    structuralContractValidated: false,
    structuralByteEqualityRecorded: false,
    selfAuthoredBundlePossible: true,
    executionProvenanceObserved: false,
    buildExecutionObserved: false,
    behavioralDevnetEvidence: false,
    adversarialDevnetExecutionEvidence: false,
    productionFinalByteEvidence: false,
    devnetExecutionObserved: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
    blocker,
  };
}

function runCli() {
  const arguments_ = process.argv.slice(2);
  if (arguments_.length === 0) {
    const statePath = resolve(REPOSITORY_ROOT, DISPOSABLE_DEVNET_STATE_REPOSITORY_PATH);
    const state = validateDisposableDevnetEvidenceState(
      parseB3OwnerPolicyFreezeJson(readFileSync(statePath, "utf8"), statePath),
    );
    process.stdout.write(`${JSON.stringify({
      ...failClosedReport("DISPOSABLE_DEVNET_STRUCTURAL_CONTRACT_INPUTS_UNAVAILABLE"),
      valid: true,
      implementationBaseHeadSha: state.implementationBaseHeadSha,
    }, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }
  if (arguments_.length !== 2 || arguments_[0] !== "--input" || !isAbsolute(arguments_[1])) {
    throw new Error("USAGE: --input <absolute-preflight-and-receipt-json>");
  }
  const packetFile = readStableExternalFile(
    arguments_[1],
    REPOSITORY_ROOT,
    "DISPOSABLE_DEVNET_CLI_PACKET",
    MAX_BUILD_LOG_BYTES,
  );
  const packet = parseB3OwnerPolicyFreezeJson(
    packetFile.bytes.toString("utf8"),
    packetFile.absolutePath,
  );
  if (!exactKeys(packet, ["preflight", "receipt"])) {
    throw new Error("DISPOSABLE_DEVNET_CLI_PACKET_SHAPE_INVALID");
  }
  const sourceContext = collectDisposableDevnetCommittedSourceContext();
  validateDisposableDevnetDualBuildReceipt(packet.receipt, {
    preflight: packet.preflight,
    sourceContext,
  });
  process.stdout.write(`${JSON.stringify({
    schema: "iat-b3-disposable-devnet-structural-contract-validation/v2",
    valid: true,
    status: DISPOSABLE_DEVNET_RECEIPT_STRUCTURAL_HOLD,
    structuralContractOnly: true,
    structuralContractValidated: true,
    structuralByteEqualityRecorded: true,
    selfAuthoredBundlePossible: true,
    executionProvenanceObserved: false,
    buildExecutionObserved: false,
    behavioralDevnetEvidence: false,
    adversarialDevnetExecutionEvidence: false,
    productionFinalByteEvidence: false,
    devnetExecutionObserved: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
    blocker: "DISPOSABLE_DEVNET_EXECUTION_PROVENANCE_UNAVAILABLE",
  }, null, 2)}\n`);
  process.exitCode = 2;
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  try {
    runCli();
  } catch (error) {
    process.stdout.write(`${JSON.stringify(failClosedReport(
      error instanceof Error ? error.message : String(error),
    ), null, 2)}\n`);
    process.exitCode = 2;
  }
}

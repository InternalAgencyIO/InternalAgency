#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmodSync,
  closeSync,
  constants as fsConstants,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  realpathSync,
  rmSync,
  writeSync,
} from "node:fs";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const DISPOSABLE_DEVNET_EXECUTION_TRANSCRIPT_SCHEMA =
  "iat-b3-disposable-devnet-live-build-execution-transcript/v1";
export const DISPOSABLE_DEVNET_EXECUTION_PROJECTION_SCHEMA =
  "iat-b3-disposable-devnet-build-execution-provenance-projection/v1";
export const DISPOSABLE_DEVNET_EXECUTION_STATE_SCHEMA =
  "iat-b3-disposable-devnet-build-execution-provenance-state/v1";
export const DISPOSABLE_DEVNET_IDENTITY_INPUT_SCHEMA =
  "iat-b3-disposable-devnet-public-identity-input/v1";
export const DISPOSABLE_DEVNET_GENESIS_INPUT_SCHEMA =
  "iat-b3-disposable-devnet-genesis-observation-input/v1";
export const DISPOSABLE_DEVNET_EXECUTION_STATUS =
  "EXECUTION_PROVENANCE_OBSERVED_HOLD";
export const DISPOSABLE_DEVNET_EXECUTION_TEST_STATUS =
  "HOLD_TEST_INJECTED_EXECUTOR_NOT_EVIDENCE";
export const DISPOSABLE_DEVNET_EXECUTION_REPLAY_STATUS =
  "HOLD_SERIALIZED_TRANSCRIPT_NOT_LIVE_PROCESS_EVIDENCE";
export const DISPOSABLE_DEVNET_EXECUTION_HOLD_STATUS = "HOLD";
export const DISPOSABLE_DEVNET_EXECUTION_GATE_ENVIRONMENT_VARIABLE =
  "IAT_B3_DISPOSABLE_DEVNET_OFFLINE_BUILD_EXECUTION_GATE";
export const DISPOSABLE_DEVNET_EXECUTION_GATE_VALUE =
  "AUTHORIZED_EXACT_SOURCE_OFFLINE_DOCKER_DUAL_BUILD_ONLY";
export const DISPOSABLE_DEVNET_EXECUTION_RUNNER_REPOSITORY_PATH =
  "projects/star-ascent/site/scripts/run-iat-b3-disposable-devnet-build-execution-provenance.mjs";
export const DISPOSABLE_DEVNET_EXECUTION_STATE_REPOSITORY_PATH =
  "projects/star-ascent/site/docs/b3/iat-b3-disposable-devnet-build-execution-provenance-state.v1.json";
export const DISPOSABLE_DEVNET_NETWORK = "solana-devnet";
export const DISPOSABLE_DEVNET_RPC_URL = "https://api.devnet.solana.com";
export const DISPOSABLE_DEVNET_GENESIS_HASH =
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

export const PINNED_DISPOSABLE_DEVNET_DOCKER_CLI = Object.freeze({
  platform: "linux/amd64",
  absolutePath: "/usr/bin/docker",
  sha256: "7ed12b00293d64742419a6601ae97960a367a0ce97c88b06e3278cc0a409557b",
  byteLength: 31_369_824,
  version: "Docker version 29.1.3, build 29.1.3-0ubuntu3~24.04.2",
});
const PINNED_DISPOSABLE_DEVNET_DOCKER_SOCKET = Object.freeze({
  path: "/var/run/docker.sock",
  canonicalPath: "/run/docker.sock",
  uid: 0,
  gid: 108,
  mode: 0o660,
  linkCount: 1,
});
const PINNED_DISPOSABLE_DEVNET_DOCKER_RUNTIME = Object.freeze({
  client: Object.freeze({
    Version: "29.1.3",
    ApiVersion: "1.52",
    DefaultAPIVersion: "1.52",
    GitCommit: "29.1.3-0ubuntu3~24.04.2",
    GoVersion: "go1.24.4",
    Os: "linux",
    Arch: "amd64",
  }),
  server: Object.freeze({
    Version: "29.1.3",
    ApiVersion: "1.52",
    MinAPIVersion: "1.44",
    GitCommit: "29.1.3-0ubuntu3~24.04.2",
    GoVersion: "go1.24.4",
    Os: "linux",
    Arch: "amd64",
  }),
  components: Object.freeze({
    Engine: "29.1.3",
    containerd: "2.2.1",
    runc: "1.3.4-0ubuntu1~24.04.1",
    "docker-init": "0.19.0",
  }),
});
export const PINNED_DISPOSABLE_DEVNET_NODE_RUNTIME = Object.freeze({
  platform: "linux/amd64",
  version: "v24.10.0",
  sha256: "141542ec0c8f73b568cd774ea8df43f23768cb086eb5bf21d2dea33072fb2f56",
  byteLength: 129_491_456,
});
export const PINNED_DISPOSABLE_DEVNET_GIT_CLIENT = Object.freeze({
  platform: "linux/amd64",
  absolutePath: "/usr/bin/git",
  version: "git version 2.43.0",
  sha256: "2a8c18fbf43da9f692d75474c72bea9dfd796c260b0f3dfe456376abc3bbd668",
  byteLength: 4_066_232,
});

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const RUNNER_PATH = fileURLToPath(import.meta.url);
const PINNED_EXECUTION_MODULE_CLOSURE = Object.freeze([
  Object.freeze({
    repositoryPath: "projects/star-ascent/site/scripts/run-iat-b3-combined-law-reproducible-build.mjs",
    url: new URL("./run-iat-b3-combined-law-reproducible-build.mjs", import.meta.url),
    sha256: "68cdcc31fac0f9e8880ca6f51f0ae8ea9c36255a8675febbce2d7345e6fc302b",
    byteLength: 158_934,
  }),
  Object.freeze({
    repositoryPath: "projects/star-ascent/site/scripts/run-iat-b3-economy-reproducible-build.mjs",
    url: new URL("./run-iat-b3-economy-reproducible-build.mjs", import.meta.url),
    sha256: "da703f6cfb03f1b6abe1fdfc0c7fbca4189a6eeec8eb4cfbf270d34e32774be1",
    byteLength: 68_635,
  }),
  Object.freeze({
    repositoryPath: "projects/star-ascent/site/scripts/validate-iat-b3-identity-freeze.mjs",
    url: new URL("./validate-iat-b3-identity-freeze.mjs", import.meta.url),
    sha256: "24bb5652ed0c86482ae4c68f32cf6e8f33ab7923cdfe3bb686d43cd5a0f94370",
    byteLength: 43_533,
  }),
  Object.freeze({
    repositoryPath: "projects/star-ascent/site/scripts/validate-iat-b3-owner-policy-freeze.mjs",
    url: new URL("./validate-iat-b3-owner-policy-freeze.mjs", import.meta.url),
    sha256: "32f1d5c839dfbf0b0b1b679fdd1e33691a8f0825eca1f3dececd338598876818",
    byteLength: 49_162,
  }),
  Object.freeze({
    repositoryPath: "projects/star-ascent/site/scripts/iat-b3-native-wsl-build-backend.mjs",
    url: new URL("./iat-b3-native-wsl-build-backend.mjs", import.meta.url),
    sha256: "aa411522e3d26ca7e9687da7aa328b76109d3bdd54a43f63371fc996d7135d74",
    byteLength: 41_626,
  }),
]);

function observePinnedExecutionModuleClosure() {
  return Object.freeze(PINNED_EXECUTION_MODULE_CLOSURE.map((expected) => {
    const file = readStableRegularFile(fileURLToPath(expected.url), {
      label: "DISPOSABLE_DEVNET_EXECUTION_PINNED_MODULE_CLOSURE",
      maximumBytes: 2 * 1024 * 1024,
    });
    if (file.sha256 !== expected.sha256 || file.byteLength !== expected.byteLength) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_MODULE_CLOSURE_DRIFT_HOLD");
    }
    return Object.freeze({
      repositoryPath: expected.repositoryPath,
      sha256: file.sha256,
      byteLength: file.byteLength,
      device: file.device,
      inode: file.inode,
    });
  }));
}

// Validate the entire local executable module closure before evaluating any of
// it. This prevents a dirty helper from redefining the clean-source observer
// that later authenticates the committed runner process.
const BOOTSTRAP_MODULE_CLOSURE = observePinnedExecutionModuleClosure();
const combinedLawBuildModule = await import("./run-iat-b3-combined-law-reproducible-build.mjs");
const economyBuildModule = await import("./run-iat-b3-economy-reproducible-build.mjs");
const identityFreezeModule = await import("./validate-iat-b3-identity-freeze.mjs");
const {
  COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA,
  PINNED_COMBINED_LAW_BUILD_CONTAINER,
  assertCleanSourceObservation,
  assertExactCleanSourceSequence,
  assertExactMaterializedSourceSequence,
  createCombinedLawDockerBuildArguments,
  createExactSourceBuildRoot,
  loadExactDeclaredHeadSource,
  observeExactSource,
  observeMaterializedSourceSnapshot,
  observePinnedDockerHostExecutableBoundary,
  readExactCommittedFile,
  removeExactSourceBuildRoot,
} = combinedLawBuildModule;
const {
  ECONOMY_BUILD_INPUT_SPECS,
  ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE,
  ECONOMY_PRODUCTION_FEATURE,
  ECONOMY_SBF_BUILD_RECIPE,
  createEconomyDockerBuildArguments,
} = economyBuildModule;
const {
  PRODUCTION_COMBINED_ARTIFACT_INPUT_SPECS,
  PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
  isCanonicalBase58Key,
} = identityFreezeModule;
const BUILD_ROOT_PREFIX = "iat-b3-disposable-devnet-provenance-sbf-";
const OUTPUT_ROOT_NAME = /^iat-b3-disposable-devnet-provenance-[a-z0-9][a-z0-9._-]{0,80}$/u;
const LANE_ID = /^b15-devnet-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{16}$/u;
const HEX_SHA1 = /^[0-9a-f]{40}$/u;
const RUSTC_VERSION = "rustc 1.97.1 (8bab26f4f 2026-07-14)";
const CARGO_VERSION = "cargo 1.97.1 (c980f4866 2026-06-30)";
const CARGO_BUILD_SBF_VERSION = [
  "solana-cargo-build-sbf 3.1.10",
  "platform-tools v1.52",
  "rustc 1.89.0",
].join("\n");
const MAX_INPUT_BYTES = 64 * 1024;
const MAX_ARTIFACT_BYTES = 32 * 1024 * 1024;
const MAX_CAPTURE_BYTES = 128 * 1024 * 1024;
const DOCKER_PROBE_TIMEOUT_MILLISECONDS = 30_000;
const DOCKER_TOOLCHAIN_CLOSURE_TIMEOUT_MILLISECONDS = 10 * 60 * 1000;
const DOCKER_BUILD_TIMEOUT_MILLISECONDS = 30 * 60 * 1000;
const DOCKER_TRUSTED_WORKING_DIRECTORY = "/usr/bin";
const DOCKER_TRUSTED_PATH = "/usr/bin:/bin";
const MAX_INPUT_AGE_MILLISECONDS = 15 * 60 * 1000;
const MAX_FUTURE_SKEW_MILLISECONDS = 30 * 1000;
const KEY_SCAN_CONTENT_LIMIT = 1024 * 1024;
const PROCESS_CREATED_STAGES = new Map();
const CANONICAL_EXECUTION_BRAND = Symbol("iat-b3-disposable-devnet-live-execution");
const HERMETIC_MOUNT_CAUSALITY_PROVEN = false;
const LAW_IDENTITY_ENVIRONMENT_NAMES = Object.freeze(
  PRODUCTION_COMBINED_ARTIFACT_INPUT_SPECS.map(({ environmentVariable }) => environmentVariable),
);
const REQUIRED_IDENTITY_ENVIRONMENT_NAMES = Object.freeze(
  ECONOMY_BUILD_INPUT_SPECS.map(({ environmentVariable }) => environmentVariable),
);
const FORBIDDEN_PROCESS_ARGUMENT =
  /(?:^|[^a-z])(?:airdrop|deploy|keygen|program\s+deploy|request-airdrop|sign|transfer)(?:$|[^a-z])/iu;
const CREDENTIAL_FILE_SUFFIX =
  /(?:keypair|keystore|mnemonic|privatekey|secretkey|seedphrase|recoveryphrase|wallet)$/u;
const PRIVATE_KEY_TEXT =
  /-----BEGIN (?:EC |OPENSSH |RSA )?PRIVATE KEY-----|\b(?:mnemonic|private[._-]?key|secret[._-]?key|seed[._-]?phrase|recovery[._-]?phrase)\s*[:=]/iu;
const TEXT_SOURCE_EXTENSIONS = new Set([
  ".json", ".jsonl", ".md", ".mjs", ".js", ".jsx", ".ts", ".tsx",
  ".rs", ".toml", ".sh", ".yml", ".yaml",
]);
const FORBIDDEN_HOST_INJECTION_ENVIRONMENT = Object.freeze([
  "BASH_ENV",
  "DYLD_INSERT_LIBRARIES",
  "DYLD_LIBRARY_PATH",
  "ENV",
  "LD_AUDIT",
  "LD_LIBRARY_PATH",
  "LD_PRELOAD",
  "NODE_EXTRA_CA_CERTS",
  "NODE_OPTIONS",
  "NODE_PATH",
  "NODE_REPL_EXTERNAL_MODULE",
]);
const BASE_DOCKER_ENVIRONMENT = Object.freeze({
  DOCKER_API_VERSION: "1.52",
  DOCKER_CLI_HINTS: "false",
  DOCKER_CONTENT_TRUST: "0",
  DOCKER_HOST: PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint,
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
  PATH: DOCKER_TRUSTED_PATH,
  TZ: "UTC",
});
const FIXED_HOST_ENVIRONMENT = Object.freeze({
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
  PATH: DOCKER_TRUSTED_PATH,
  TZ: "UTC",
});
const PLATFORM_TOOLS_CLOSURE_SCRIPT = [
  "set -eu",
  "root=/root/.cache/solana/v1.52/platform-tools",
  "test -d \"$root\"",
  "find \"$root\" -type f -exec sha256sum '{}' ';' | LC_ALL=C sort",
].join("; ");

const TEST_SAFETY = Object.freeze({
  classification: "TEST_INJECTED_EXECUTOR_ONLY",
  modulePrivateLiveProcessBrandObserved: false,
  exactCommittedRunnerProcessObserved: false,
  exactCleanSourceObserved: false,
  pinnedDockerClientObserved: false,
  pinnedContainerObserved: false,
  pinnedToolchainObserved: false,
  twoIsolatedBuildsObserved: false,
  recursiveKeyScanPassed: false,
  cleanupObserved: false,
  executionProvenanceObserved: false,
  buildExecutionObserved: false,
  productionFinalByteEvidence: false,
  devnetBehavioralExecutionObserved: false,
  signingObserved: false,
  deploymentObserved: false,
  releaseAuthorized: false,
  mainnetExecutionAuthorized: false,
  mainnetStatus: "HOLD",
});

const REPLAY_SAFETY = Object.freeze({
  ...TEST_SAFETY,
  classification: "SERIALIZED_OR_EXTERNAL_INPUT_NOT_LIVE_PROCESS_EVIDENCE",
});

const OFFICIAL_SAFETY = Object.freeze({
  classification: "LIVE_EXACT_COMMITTED_RUNNER_PROCESS_OBSERVATION_ONLY",
  modulePrivateLiveProcessBrandObserved: true,
  exactCommittedRunnerProcessObserved: true,
  exactCleanSourceObserved: true,
  pinnedDockerClientObserved: true,
  pinnedContainerObserved: true,
  pinnedToolchainObserved: true,
  twoIsolatedBuildsObserved: true,
  recursiveKeyScanPassed: true,
  cleanupObserved: true,
  executionProvenanceObserved: true,
  buildExecutionObserved: true,
  productionFinalByteEvidence: false,
  devnetBehavioralExecutionObserved: false,
  signingObserved: false,
  deploymentObserved: false,
  releaseAuthorized: false,
  mainnetExecutionAuthorized: false,
  mainnetStatus: "HOLD",
});

const CURRENT_HOLD_BLOCKERS = Object.freeze([
  "HERMETIC_MOUNT_CAUSALITY_UNPROVEN",
  "EXACT_COMMITTED_CLEAN_B15_RUNNER_REQUIRED",
  "PINNED_EXECUTABLE_MODULE_CLOSURE_NOT_OBSERVED",
  "EXPLICIT_OFFLINE_BUILD_EXECUTION_GATE_NOT_OBSERVED",
  "DISPOSABLE_PUBLIC_IDENTITIES_NOT_BOUND",
  "DEVNET_GENESIS_OBSERVATION_NOT_BOUND",
  "PINNED_NODE24_AND_GIT_CLIENT_NOT_OBSERVED",
  "PINNED_DOCKER_CLIENT_NOT_OBSERVED",
  "PINNED_DOCKER_SOCKET_AND_DAEMON_RUNTIME_NOT_OBSERVED",
  "PINNED_PLATFORM_MANIFEST_NOT_OBSERVED",
  "PINNED_RUST_1_97_1_SOLANA_3_1_10_PLATFORM_TOOLS_1_52_NOT_OBSERVED",
  "TWO_ISOLATED_LAW_AND_ECONOMY_BUILDS_NOT_EXECUTED",
  "RECURSIVE_KEY_MATERIAL_SCAN_NOT_EXECUTED",
  "PROCESS_OWNED_BUILD_ROOT_CLEANUP_NOT_OBSERVED",
  "LIVE_PROCESS_BRAND_UNAVAILABLE",
  "DISPOSABLE_DEVNET_BEHAVIORAL_REHEARSAL_NOT_EXECUTED",
  "PRODUCTION_FINAL_BYTE_EVIDENCE_UNAVAILABLE",
  "MAINNET_HOLD",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertPlainData(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    for (const item of value) assertPlainData(item);
    return;
  }
  if (typeof value !== "object"
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Object.getOwnPropertySymbols(value).length !== 0) {
    throw new TypeError("DISPOSABLE_DEVNET_EXECUTION_CANONICAL_DATA_REQUIRED");
  }
  for (const key of Object.keys(value)) assertPlainData(value[key]);
}

function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).sort().map(
    (key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`,
  ).join(",")}}`;
}

export function disposableDevnetExecutionCanonicalJson(value) {
  assertPlainData(value);
  return canonicalize(value);
}

export function disposableDevnetExecutionCanonicalSha256(value) {
  return sha256(Buffer.from(disposableDevnetExecutionCanonicalJson(value), "utf8"));
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function hasExactKeys(value, keys) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.keys(value).sort().join("\0") === [...keys].sort().join("\0");
}

function parseExactUtc(value, label, now = Date.now()) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) {
    throw new Error(`${label}_UTC_INVALID`);
  }
  const time = Date.parse(value);
  if (!Number.isFinite(time)
    || now - time > MAX_INPUT_AGE_MILLISECONDS
    || time - now > MAX_FUTURE_SKEW_MILLISECONDS) {
    throw new Error(`${label}_STALE_OR_FUTURE_HOLD`);
  }
  return time;
}

function normalizedRealPath(path) {
  const normalized = resolve(path);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isWithin(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath !== ""
    && relativePath !== ".."
    && !relativePath.startsWith(`..${sep}`)
    && !isAbsolute(relativePath);
}

function statFingerprint(stat) {
  return [
    stat.dev, stat.ino, stat.mode, stat.nlink, stat.size, stat.mtimeNs, stat.ctimeNs,
  ].join(":");
}

function directoryIdentityFingerprint(stat) {
  return [stat.dev, stat.ino, stat.mode, stat.uid, stat.gid].join(":");
}

function observeDirectoryChain(path, label) {
  const resolved = resolve(path);
  const root = resolve(resolved, sep);
  const relativePath = relative(root, resolved);
  const pieces = relativePath === "" ? [] : relativePath.split(sep);
  const observations = [];
  let cursor = root;
  for (const piece of pieces) {
    cursor = join(cursor, piece);
    const stat = lstatSync(cursor, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()
      || normalizedRealPath(realpathSync(cursor)) !== normalizedRealPath(cursor)) {
      throw new Error(`${label}_PARENT_DIRECTORY_REPARSE_OR_TYPE_HOLD`);
    }
    observations.push({ path: cursor, fingerprint: statFingerprint(stat) });
  }
  return Object.freeze({
    observations: Object.freeze(observations),
    sha256: disposableDevnetExecutionCanonicalSha256(observations),
  });
}

function assertDirectoryChainStable(chain, label) {
  for (const observation of chain.observations) {
    const stat = lstatSync(observation.path, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()
      || statFingerprint(stat) !== observation.fingerprint
      || normalizedRealPath(realpathSync(observation.path))
        !== normalizedRealPath(observation.path)) {
      throw new Error(`${label}_PARENT_DIRECTORY_CHANGED_HOLD`);
    }
  }
}

function observeDirectoryIdentityChain(path, label) {
  const resolved = resolve(path);
  const root = resolve(resolved, sep);
  const pieces = relative(root, resolved) === "" ? [] : relative(root, resolved).split(sep);
  const observations = [];
  let cursor = root;
  for (const piece of pieces) {
    cursor = join(cursor, piece);
    const stat = lstatSync(cursor, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()
      || normalizedRealPath(realpathSync(cursor)) !== normalizedRealPath(cursor)) {
      throw new Error(`${label}_PARENT_DIRECTORY_REPARSE_OR_TYPE_HOLD`);
    }
    observations.push({ path: cursor, fingerprint: directoryIdentityFingerprint(stat) });
  }
  return Object.freeze({ observations: Object.freeze(observations) });
}

function assertDirectoryIdentityChainStable(chain, label) {
  for (const observation of chain.observations) {
    const stat = lstatSync(observation.path, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink()
      || directoryIdentityFingerprint(stat) !== observation.fingerprint
      || normalizedRealPath(realpathSync(observation.path))
        !== normalizedRealPath(observation.path)) {
      throw new Error(`${label}_PARENT_DIRECTORY_CHANGED_HOLD`);
    }
  }
}

function readStableRegularFile(path, {
  label,
  maximumBytes,
  mustBeOutsideRepository = false,
  allowEmpty = false,
} = {}) {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error(`${label}_ABSOLUTE_PATH_REQUIRED`);
  }
  const absolutePath = resolve(path);
  const realRepository = realpathSync(REPOSITORY_ROOT);
  if (mustBeOutsideRepository
    && (absolutePath === realRepository || isWithin(realRepository, absolutePath))) {
    throw new Error(`${label}_MUST_BE_OUTSIDE_REPOSITORY`);
  }
  const parent = dirname(absolutePath);
  const chain = observeDirectoryChain(parent, label);
  const before = lstatSync(absolutePath, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n
    || (!allowEmpty && before.size <= 0n) || before.size > BigInt(maximumBytes)) {
    throw new Error(`${label}_REGULAR_SINGLE_LINK_SIZE_HOLD`);
  }
  if (normalizedRealPath(realpathSync(absolutePath)) !== normalizedRealPath(absolutePath)) {
    throw new Error(`${label}_REPARSE_OR_ALIAS_HOLD`);
  }
  const descriptor = openSync(
    absolutePath,
    fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0),
  );
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    if (statFingerprint(opened) !== statFingerprint(before)) {
      throw new Error(`${label}_DESCRIPTOR_BINDING_HOLD`);
    }
    const bytes = readFileSync(descriptor);
    const afterDescriptor = fstatSync(descriptor, { bigint: true });
    const afterPath = lstatSync(absolutePath, { bigint: true });
    assertDirectoryChainStable(chain, label);
    if (statFingerprint(opened) !== statFingerprint(afterDescriptor)
      || statFingerprint(opened) !== statFingerprint(afterPath)
      || BigInt(bytes.length) !== afterDescriptor.size) {
      throw new Error(`${label}_CHANGED_DURING_READ_HOLD`);
    }
    return Object.freeze({
      absolutePath,
      bytes,
      sha256: sha256(bytes),
      byteLength: bytes.length,
      device: opened.dev.toString(),
      inode: opened.ino.toString(),
      parentChainSha256: chain.sha256,
    });
  } finally {
    closeSync(descriptor);
  }
}

function parseCanonicalJsonInput(file, label) {
  let value;
  try {
    value = JSON.parse(file.bytes.toString("utf8"));
  } catch {
    throw new Error(`${label}_JSON_INVALID`);
  }
  const canonicalBytes = Buffer.from(
    `${disposableDevnetExecutionCanonicalJson(value)}\n`,
    "utf8",
  );
  if (!file.bytes.equals(canonicalBytes)) {
    throw new Error(`${label}_CANONICAL_JSON_BYTES_REQUIRED`);
  }
  return value;
}

export function validateDisposableDevnetIdentityInput(record, {
  now = Date.now(),
  forbiddenIdentities = new Set(),
} = {}) {
  if (!hasExactKeys(record, [
    "schema", "generatedAtUtc", "laneId", "lawProgramId", "economyProgramId",
    "canonicalMint",
  ])
    || record.schema !== DISPOSABLE_DEVNET_IDENTITY_INPUT_SCHEMA
    || !LANE_ID.test(record.laneId ?? "")) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_IDENTITY_INPUT_SHAPE_HOLD");
  }
  parseExactUtc(record.generatedAtUtc, "DISPOSABLE_DEVNET_EXECUTION_IDENTITY_INPUT", now);
  const identities = [record.lawProgramId, record.economyProgramId, record.canonicalMint];
  if (identities.some((value) => !isCanonicalBase58Key(value))
    || new Set(identities).size !== identities.length) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_THREE_DISTINCT_PUBLIC_IDENTITIES_REQUIRED");
  }
  if (identities.some((value) => forbiddenIdentities.has(value))) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PRODUCTION_OR_CHECKED_IN_IDENTITY_REUSE_HOLD");
  }
  return record;
}

export function validateDisposableDevnetGenesisInput(record, {
  now = Date.now(),
  laneId,
} = {}) {
  if (!hasExactKeys(record, [
    "schema", "generatedAtUtc", "laneId", "network", "rpcUrl", "genesisHash",
  ])
    || record.schema !== DISPOSABLE_DEVNET_GENESIS_INPUT_SCHEMA
    || record.laneId !== laneId
    || record.network !== DISPOSABLE_DEVNET_NETWORK
    || record.rpcUrl !== DISPOSABLE_DEVNET_RPC_URL
    || record.genesisHash !== DISPOSABLE_DEVNET_GENESIS_HASH) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_GENESIS_INPUT_SHAPE_OR_DOMAIN_HOLD");
  }
  parseExactUtc(record.generatedAtUtc, "DISPOSABLE_DEVNET_EXECUTION_GENESIS_INPUT", now);
  return record;
}

function walkRegularFiles(root, label) {
  const realRoot = realpathSync(root);
  if (normalizedRealPath(realRoot) !== normalizedRealPath(root)) {
    throw new Error(`${label}_ROOT_REPARSE_HOLD`);
  }
  const files = [];
  const visit = (directory, relativeDirectory) => {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const relativePath = relativeDirectory === ""
        ? entry.name
        : `${relativeDirectory}/${entry.name}`;
      const stat = lstatSync(path, { bigint: true });
      if (stat.isSymbolicLink()) throw new Error(`${label}_SYMLINK_OR_REPARSE_HOLD`);
      if (stat.isDirectory()) {
        if (normalizedRealPath(realpathSync(path)) !== normalizedRealPath(path)) {
          throw new Error(`${label}_DIRECTORY_REPARSE_HOLD`);
        }
        visit(path, relativePath);
      } else if (stat.isFile()) {
        if (stat.nlink !== 1n) throw new Error(`${label}_HARDLINK_HOLD`);
        files.push(Object.freeze({ path, relativePath, stat }));
      } else {
        throw new Error(`${label}_NONREGULAR_ENTRY_HOLD`);
      }
    }
  };
  visit(realRoot, "");
  return Object.freeze(files);
}

function hashFileAndReadPrefix(file, prefixLimit = KEY_SCAN_CONTENT_LIMIT) {
  const descriptor = openSync(file.path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  try {
    const opened = fstatSync(descriptor, { bigint: true });
    if (!opened.isFile() || opened.nlink !== 1n
      || statFingerprint(opened) !== statFingerprint(file.stat)) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_SCAN_FILE_DESCRIPTOR_BINDING_HOLD");
    }
    const digest = createHash("sha256");
    const chunk = Buffer.allocUnsafe(1024 * 1024);
    const prefixChunks = [];
    let prefixLength = 0;
    let total = 0;
    let scanTail = "";
    let privateKeyTextObserved = false;
    while (true) {
      const read = readSync(descriptor, chunk, 0, chunk.length, null);
      if (read === 0) break;
      const bytes = chunk.subarray(0, read);
      digest.update(bytes);
      total += read;
      const scanText = `${scanTail}${bytes.toString("latin1")}`;
      if (PRIVATE_KEY_TEXT.test(scanText)) privateKeyTextObserved = true;
      scanTail = scanText.slice(-512);
      if (prefixLength < prefixLimit) {
        const retained = bytes.subarray(0, Math.min(read, prefixLimit - prefixLength));
        prefixChunks.push(Buffer.from(retained));
        prefixLength += retained.length;
      }
    }
    const after = fstatSync(descriptor, { bigint: true });
    const pathAfter = lstatSync(file.path, { bigint: true });
    if (statFingerprint(opened) !== statFingerprint(after)
      || statFingerprint(opened) !== statFingerprint(pathAfter)
      || BigInt(total) !== after.size) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_SCAN_FILE_CHANGED_HOLD");
    }
    return Object.freeze({
      sha256: digest.digest("hex"),
      byteLength: total,
      prefix: Buffer.concat(prefixChunks),
      privateKeyTextObserved,
    });
  } finally {
    closeSync(descriptor);
  }
}

function containsJsonSecretMaterial(prefix) {
  let value;
  try {
    value = JSON.parse(prefix.toString("utf8"));
  } catch {
    return false;
  }
  const visit = (candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    if (Array.isArray(candidate)) {
      if (candidate.length === 64
        && candidate.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) {
        return true;
      }
      return candidate.some(visit);
    }
    return Object.entries(candidate).some(([key, child]) => (
      /^(?:mnemonic|privatekey|secretkey|seed|seedphrase|recoveryphrase)$/u.test(
        key.replaceAll("_", "").replaceAll("-", "").replaceAll(".", "").toLowerCase(),
      ) || visit(child)
    ));
  };
  return visit(value);
}

function isForbiddenKeyMaterialFileName(fileName) {
  const extensionMatch = /^(?<stem>.*?)(?<extension>\.(?:json|txt|pem|key|secret|seed))?$/iu
    .exec(fileName);
  if (!extensionMatch?.groups) return false;
  const normalizedStem = extensionMatch.groups.stem
    .replaceAll("_", "")
    .replaceAll("-", "")
    .replaceAll(".", "")
    .toLowerCase();
  return normalizedStem === "id" || CREDENTIAL_FILE_SUFFIX.test(normalizedStem);
}

export function scanDisposableDevnetBuildTreeForKeyMaterial(root) {
  const files = walkRegularFiles(root, "DISPOSABLE_DEVNET_EXECUTION_KEY_SCAN");
  const records = [];
  let totalByteLength = 0;
  for (const file of files) {
    if (isForbiddenKeyMaterialFileName(basename(file.path))) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_FORBIDDEN_KEY_MATERIAL_FILE_NAME_HOLD");
    }
    const observation = hashFileAndReadPrefix(file);
    totalByteLength += observation.byteLength;
    if (fileExtension(file.relativePath) === ".json"
      && observation.byteLength > KEY_SCAN_CONTENT_LIMIT) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_OVERSIZED_JSON_KEY_SCAN_HOLD");
    }
    if (observation.privateKeyTextObserved
      || containsJsonSecretMaterial(observation.prefix)) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_FORBIDDEN_KEY_MATERIAL_BYTES_HOLD");
    }
    records.push(Object.freeze({
      path: file.relativePath,
      sha256: observation.sha256,
      byteLength: observation.byteLength,
    }));
  }
  const finalFiles = walkRegularFiles(root, "DISPOSABLE_DEVNET_EXECUTION_KEY_SCAN_REVALIDATION");
  if (finalFiles.length !== files.length
    || finalFiles.some((file, index) => (
      file.relativePath !== files[index].relativePath
      || statFingerprint(file.stat) !== statFingerprint(files[index].stat)
    ))) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_KEY_SCAN_TREE_CHANGED_HOLD");
  }
  return Object.freeze({
    root: realpathSync(root),
    fileCount: records.length,
    totalByteLength,
    closureSha256: disposableDevnetExecutionCanonicalSha256(records),
    forbiddenKeyMaterialObserved: false,
  });
}

function fileExtension(path) {
  const dot = path.lastIndexOf(".");
  return dot < 0 ? "" : path.slice(dot).toLowerCase();
}

function collectCheckedInPublicIdentities(snapshotRoot) {
  const identities = new Set();
  for (const file of walkRegularFiles(
    snapshotRoot,
    "DISPOSABLE_DEVNET_EXECUTION_SOURCE_IDENTITY_SCAN",
  )) {
    if (!TEXT_SOURCE_EXTENSIONS.has(fileExtension(file.relativePath))
      || file.stat.size > 2n * 1024n * 1024n) continue;
    const bytes = readStableRegularFile(file.path, {
      label: "DISPOSABLE_DEVNET_EXECUTION_SOURCE_TEXT",
      maximumBytes: 2 * 1024 * 1024,
    }).bytes;
    const candidates = bytes.toString("utf8").match(/[1-9A-HJ-NP-Za-km-z]{32,44}/gu) ?? [];
    for (const candidate of candidates) {
      if (isCanonicalBase58Key(candidate)) identities.add(candidate);
    }
  }
  return identities;
}

function assertExactIdentityEnvironment(environment) {
  if (!hasExactKeys(environment, REQUIRED_IDENTITY_ENVIRONMENT_NAMES)
    || REQUIRED_IDENTITY_ENVIRONMENT_NAMES.some((name) => typeof environment[name] !== "string")) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_IDENTITY_ENVIRONMENT_INVALID");
  }
  return Object.freeze({ ...environment });
}

function createIdentityEnvironment(identity, genesis) {
  return assertExactIdentityEnvironment({
    IAT_B3_PRODUCTION_LAW_PROGRAM_ID: identity.lawProgramId,
    IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID: identity.economyProgramId,
    IAT_B3_PRODUCTION_CANONICAL_MINT: identity.canonicalMint,
    IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH: genesis.genesisHash,
  });
}

function convertDockerRunToCreate(arguments_, containerName) {
  if (!Array.isArray(arguments_) || arguments_[1] !== "run") {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_RUN_ARGUMENTS_INVALID");
  }
  const hardened = [
    arguments_[0],
    "create",
    `--name=${containerName}`,
    "--read-only",
    "--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=268435456",
    ...arguments_.slice(2).filter((value) => value !== "--rm"),
  ];
  assertOfflineDockerCreateArguments(hardened);
  return Object.freeze(hardened);
}

function exactStringArrayEquals(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

function materializeRecipeArguments(recipe, containerBuildRoot) {
  return recipe.arguments.map((argument) => {
    if (argument === "<FRESH_OUTPUT_DIRECTORY>") return `${containerBuildRoot}/output`;
    if (argument === "<FRESH_TARGET_DIRECTORY>") return `${containerBuildRoot}/target`;
    return argument;
  });
}

function assertOfflineDockerCreateArguments(arguments_) {
  const host = `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`;
  const image = PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference;
  const name = arguments_?.[2];
  const prefix = [
    host,
    "create",
    name,
    "--read-only",
    "--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=268435456",
    "--pull=never",
    "--network=none",
    "--platform=linux/amd64",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
  ];
  if (!Array.isArray(arguments_)
    || arguments_.some((value) => typeof value !== "string" || /[\r\n\0]/u.test(value))
    || !/^--name=iat-b3-b15-[a-z0-9-]{1,80}$/u.test(name ?? "")
    || arguments_.some((value) => FORBIDDEN_PROCESS_ARGUMENT.test(value))) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_OFFLINE_CONFINEMENT_HOLD");
  }

  const entrypoint = arguments_[10];
  if (["--entrypoint=rustc", "--entrypoint=cargo", "--entrypoint=/bin/sh"].includes(entrypoint)) {
    const suffix = entrypoint === "--entrypoint=rustc"
      ? ["--version"]
      : entrypoint === "--entrypoint=cargo" && arguments_[12] === "--version"
        ? ["--version"]
        : entrypoint === "--entrypoint=cargo"
          ? ["build-sbf", "--version"]
          : ["-c", PLATFORM_TOOLS_CLOSURE_SCRIPT];
    if (!exactStringArrayEquals(arguments_, [...prefix, entrypoint, image, ...suffix])) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_TOOLCHAIN_GRAMMAR_HOLD");
    }
    return arguments_;
  }

  const sourceMount = arguments_[11];
  const buildMount = arguments_[12];
  const sourceMatch = /^--mount=type=bind,source=(?<source>[^,\r\n\0]+),target=\/iat-source,readonly$/u
    .exec(sourceMount ?? "");
  const buildMatch = /^--mount=type=bind,source=(?<source>[^,\r\n\0]+),target=(?<target>\/iat(?:-economy)?-build\/run-(?<ordinal>[12])-(?<kind>law|economy))$/u
    .exec(buildMount ?? "");
  if (arguments_[10] !== "--workdir=/iat-source"
    || !sourceMatch?.groups?.source || !buildMatch?.groups?.source
    || !isAbsolute(sourceMatch.groups.source) || !isAbsolute(buildMatch.groups.source)
    || (buildMatch.groups.kind === "law" && !buildMatch.groups.target.startsWith("/iat-build/"))
    || (buildMatch.groups.kind === "economy"
      && !buildMatch.groups.target.startsWith("/iat-economy-build/"))) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_BUILD_MOUNT_GRAMMAR_HOLD");
  }
  const kind = buildMatch.groups.kind;
  const identityNames = kind === "law"
    ? LAW_IDENTITY_ENVIRONMENT_NAMES
    : REQUIRED_IDENTITY_ENVIRONMENT_NAMES;
  const recipe = kind === "law"
    ? PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE
    : ECONOMY_SBF_BUILD_RECIPE;
  const expected = [
    ...prefix,
    "--workdir=/iat-source",
    sourceMount,
    buildMount,
    "--env=IAT_B3_EXACT_SOURCE_HEAD_SHA",
    ...identityNames.map((environmentName) => `--env=${environmentName}`),
    "--entrypoint=cargo",
    image,
    ...materializeRecipeArguments(recipe, buildMatch.groups.target),
  ];
  if (!exactStringArrayEquals(arguments_, expected)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_EXACT_BUILD_GRAMMAR_HOLD");
  }
  return arguments_;
}

export function validateDisposableDevnetDockerCreateArguments(arguments_) {
  assertOfflineDockerCreateArguments(arguments_);
  return true;
}

function assertProductionFeatureBuildArguments(lawArguments, economyArguments) {
  const lawFeature = PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.arguments.at(
    PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.arguments.indexOf("--features") + 1,
  );
  if (!lawFeature
    || lawArguments.filter((value) => value === lawFeature).length !== 1
    || economyArguments.filter((value) => value === ECONOMY_PRODUCTION_FEATURE).length !== 1
    || economyArguments.includes(ECONOMY_FORBIDDEN_PREFLIGHT_FEATURE)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PRODUCTION_FEATURE_EXCLUSIVITY_HOLD");
  }
}

export function createDisposableDevnetDockerBuildInvocationPlan({
  sourceSnapshotRoot,
  runRoot,
  ordinal,
  laneId,
  identityEnvironment,
} = {}) {
  if (typeof sourceSnapshotRoot !== "string" || !isAbsolute(sourceSnapshotRoot)
    || typeof runRoot !== "string" || !isAbsolute(runRoot)
    || ![1, 2].includes(ordinal)
    || !LANE_ID.test(laneId ?? "")) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_BUILD_PLAN_INPUT_INVALID");
  }
  const environment = assertExactIdentityEnvironment(identityEnvironment);
  const lawEnvironment = Object.freeze(Object.fromEntries(
    LAW_IDENTITY_ENVIRONMENT_NAMES.map((name) => [name, environment[name]]),
  ));
  const nonce = sha256(Buffer.from(`${laneId}\0${ordinal}`, "utf8")).slice(0, 16);
  const lawRoot = join(runRoot, "law");
  const economyRoot = join(runRoot, "economy");
  const lawArguments = convertDockerRunToCreate(
    createCombinedLawDockerBuildArguments({
      sourceSnapshotRoot,
      hostBuildRoot: lawRoot,
      containerBuildRoot: `/iat-build/run-${ordinal}-law`,
      identityEnvironmentNames: LAW_IDENTITY_ENVIRONMENT_NAMES,
    }),
    `iat-b3-b15-${nonce}-law`,
  );
  const economyArguments = convertDockerRunToCreate(
    createEconomyDockerBuildArguments({
      sourceSnapshotRoot,
      hostBuildRoot: economyRoot,
      containerBuildRoot: `/iat-economy-build/run-${ordinal}-economy`,
      identityEnvironmentNames: REQUIRED_IDENTITY_ENVIRONMENT_NAMES,
    }),
    `iat-b3-b15-${nonce}-economy`,
  );
  assertProductionFeatureBuildArguments(lawArguments, economyArguments);
  return deepFreeze({
    ordinal,
    roots: { run: runRoot, law: lawRoot, economy: economyRoot },
    law: { createArguments: lawArguments, environment: lawEnvironment },
    economy: { createArguments: economyArguments, environment },
  });
}

function createToolchainCreateArguments(entrypoint, commandArguments, containerName) {
  return convertDockerRunToCreate([
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
    ...commandArguments,
  ], containerName);
}

export function createDisposableDevnetToolchainInvocationPlan(laneId) {
  if (!LANE_ID.test(laneId ?? "")) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_TOOLCHAIN_PLAN_LANE_INVALID");
  }
  const nonce = sha256(Buffer.from(laneId, "utf8")).slice(0, 16);
  return deepFreeze([
    {
      purpose: "rustc-version",
      createArguments: createToolchainCreateArguments(
        "rustc", ["--version"], `iat-b3-b15-${nonce}-rustc`,
      ),
    },
    {
      purpose: "cargo-version",
      createArguments: createToolchainCreateArguments(
        "cargo", ["--version"], `iat-b3-b15-${nonce}-cargo`,
      ),
    },
    {
      purpose: "cargo-build-sbf-version",
      createArguments: createToolchainCreateArguments(
        "cargo", ["build-sbf", "--version"], `iat-b3-b15-${nonce}-sbf`,
      ),
    },
    {
      purpose: "platform-tools-v1.52-closure",
      createArguments: createToolchainCreateArguments(
        "/bin/sh", ["-c", PLATFORM_TOOLS_CLOSURE_SCRIPT], `iat-b3-b15-${nonce}-tools`,
      ),
    },
  ]);
}

function createInjectedHold(observations) {
  const core = {
    schema: DISPOSABLE_DEVNET_EXECUTION_PROJECTION_SCHEMA,
    status: DISPOSABLE_DEVNET_EXECUTION_TEST_STATUS,
    valid: true,
    ready: false,
    injectedObservationCount: observations.length,
    injectedObservationsSha256: disposableDevnetExecutionCanonicalSha256(observations),
    blockers: [
      "INJECTED_EXECUTOR_NOT_CANONICAL_EXECUTION",
      "MODULE_PRIVATE_LIVE_PROCESS_BRAND_UNAVAILABLE",
      "EXECUTION_PROVENANCE_UNOBSERVED",
      "MAINNET_HOLD",
    ],
    safety: { ...TEST_SAFETY },
  };
  return deepFreeze({ ...core, projectionSha256: disposableDevnetExecutionCanonicalSha256(core) });
}

export function runDisposableDevnetBuildExecutionWithInjectedExecutor({
  execute,
  invocations,
} = {}) {
  if (typeof execute !== "function" || !Array.isArray(invocations)
    || invocations.length === 0 || invocations.length > 32) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_TEST_SEAM_INPUT_INVALID");
  }
  const observations = invocations.map((invocation, index) => {
    assertPlainData(invocation);
    const result = execute(deepFreeze(structuredClone(invocation)));
    assertPlainData(result);
    return deepFreeze({ index, invocation, result });
  });
  return createInjectedHold(observations);
}

function serializedCandidateDigest(candidate) {
  try {
    return disposableDevnetExecutionCanonicalSha256(candidate);
  } catch {
    return null;
  }
}

export function assessDisposableDevnetExecutionProvenance(candidate) {
  const core = {
    schema: DISPOSABLE_DEVNET_EXECUTION_PROJECTION_SCHEMA,
    status: candidate?.status === DISPOSABLE_DEVNET_EXECUTION_TEST_STATUS
      ? DISPOSABLE_DEVNET_EXECUTION_TEST_STATUS
      : DISPOSABLE_DEVNET_EXECUTION_REPLAY_STATUS,
    valid: true,
    ready: false,
    candidateSha256: serializedCandidateDigest(candidate),
    blockers: [
      "SERIALIZED_JSON_LOG_OR_ELF_INPUT_NOT_LIVE_PROCESS_EVIDENCE",
      "MODULE_PRIVATE_LIVE_PROCESS_BRAND_UNAVAILABLE",
      "EXECUTION_PROVENANCE_UNOBSERVED",
      "MAINNET_HOLD",
    ],
    safety: { ...(candidate?.status === DISPOSABLE_DEVNET_EXECUTION_TEST_STATUS
      ? TEST_SAFETY : REPLAY_SAFETY) },
  };
  return deepFreeze({ ...core, projectionSha256: disposableDevnetExecutionCanonicalSha256(core) });
}

export function validateDisposableDevnetExecutionState(state) {
  if (!hasExactKeys(state, ["schema", "status", "evidence", "truth", "blockers"])
    || state.schema !== DISPOSABLE_DEVNET_EXECUTION_STATE_SCHEMA
    || state.status !== DISPOSABLE_DEVNET_EXECUTION_HOLD_STATUS
    || !hasExactKeys(state.evidence, ["transcript"])
    || state.evidence.transcript !== null
    || !hasExactKeys(state.truth, [
      "modulePrivateLiveProcessBrandObserved", "executionProvenanceObserved",
      "twoIsolatedBuildsObserved", "recursiveKeyScanPassed", "cleanupObserved",
      "productionFinalByteEvidence", "devnetBehavioralExecutionObserved",
      "releaseAuthorized", "mainnetExecutionAuthorized", "mainnetStatus",
    ])
    || Object.entries(state.truth).some(([key, value]) => (
      key === "mainnetStatus" ? value !== "HOLD" : value !== false
    ))
    || !Array.isArray(state.blockers)
    || state.blockers.join("\0") !== CURRENT_HOLD_BLOCKERS.join("\0")) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_CANONICAL_STATE_INVALID");
  }
  return state;
}

function createStaticHoldReport(blocker = "DISPOSABLE_DEVNET_EXECUTION_INPUT_REQUIRED") {
  const core = {
    schema: DISPOSABLE_DEVNET_EXECUTION_PROJECTION_SCHEMA,
    status: DISPOSABLE_DEVNET_EXECUTION_HOLD_STATUS,
    valid: true,
    ready: false,
    blocker,
    blockers: [...CURRENT_HOLD_BLOCKERS],
    safety: { ...REPLAY_SAFETY },
  };
  return deepFreeze({ ...core, projectionSha256: disposableDevnetExecutionCanonicalSha256(core) });
}

function validatePinnedExecutionModuleClosureAtHead(declaredHeadSha) {
  const current = observePinnedExecutionModuleClosure();
  if (disposableDevnetExecutionCanonicalSha256(current)
    !== disposableDevnetExecutionCanonicalSha256(BOOTSTRAP_MODULE_CLOSURE)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_MODULE_CLOSURE_CHANGED_AFTER_EVALUATION_HOLD");
  }
  const observations = PINNED_EXECUTION_MODULE_CLOSURE.map((expected, index) => {
    const committedBytes = readExactCommittedFile(
      REPOSITORY_ROOT,
      declaredHeadSha,
      expected.repositoryPath,
    );
    const committedSha256 = sha256(committedBytes);
    if (committedSha256 !== expected.sha256
      || committedBytes.length !== expected.byteLength
      || current[index].sha256 !== committedSha256
      || current[index].byteLength !== committedBytes.length) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_MODULE_CLOSURE_NOT_EXACT_COMMITTED_BYTES_HOLD");
    }
    return Object.freeze({
      repositoryPath: expected.repositoryPath,
      executedSha256: current[index].sha256,
      committedSha256,
      byteLength: committedBytes.length,
      exactCommittedBytes: true,
    });
  });
  return deepFreeze({
    files: observations,
    closureSha256: disposableDevnetExecutionCanonicalSha256(observations),
  });
}

function validateDockerExecutable() {
  if (process.platform !== "linux" || process.arch !== "x64") {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_REQUIRES_LINUX_AMD64_HOST");
  }
  const strictSharedBoundary = observePinnedDockerHostExecutableBoundary();
  const file = readStableRegularFile(PINNED_DISPOSABLE_DEVNET_DOCKER_CLI.absolutePath, {
    label: "DISPOSABLE_DEVNET_EXECUTION_PINNED_DOCKER_CLIENT",
    maximumBytes: 64 * 1024 * 1024,
  });
  if (file.sha256 !== PINNED_DISPOSABLE_DEVNET_DOCKER_CLI.sha256
    || file.byteLength !== PINNED_DISPOSABLE_DEVNET_DOCKER_CLI.byteLength
    || strictSharedBoundary.executablePath !== file.absolutePath
    || strictSharedBoundary.executableSha256 !== file.sha256
    || strictSharedBoundary.executableByteLength !== file.byteLength) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_DOCKER_CLIENT_BYTES_DRIFT_HOLD");
  }
  return file;
}

function projectStableFileBoundary(file) {
  return Object.freeze({
    absolutePath: file.absolutePath,
    sha256: file.sha256,
    byteLength: file.byteLength,
    device: file.device,
    inode: file.inode,
    parentChainSha256: file.parentChainSha256,
  });
}

function observePinnedDockerSocket() {
  const policy = PINNED_DISPOSABLE_DEVNET_DOCKER_SOCKET;
  const stat = lstatSync(policy.path, { bigint: true });
  const canonicalPath = realpathSync(policy.path);
  if (!stat.isSocket() || stat.isSymbolicLink()
    || stat.uid !== BigInt(policy.uid) || stat.gid !== BigInt(policy.gid)
    || (stat.mode & 0o777n) !== BigInt(policy.mode)
    || stat.nlink !== BigInt(policy.linkCount)
    || normalizedRealPath(canonicalPath) !== normalizedRealPath(policy.canonicalPath)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_DOCKER_SOCKET_BOUNDARY_HOLD");
  }
  return Object.freeze({
    path: policy.path,
    canonicalPath,
    fingerprint: statFingerprint(stat),
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
    uid: Number(stat.uid),
    gid: Number(stat.gid),
    mode: Number(stat.mode & 0o777n),
    linkCount: Number(stat.nlink),
  });
}

function assertPinnedDockerSocketStable(observation) {
  const current = observePinnedDockerSocket();
  if (current.fingerprint !== observation.fingerprint) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_DOCKER_SOCKET_CHANGED_HOLD");
  }
  return current;
}

function observeDockerConfigRoot(environment) {
  const configRoot = environment?.DOCKER_CONFIG;
  if (typeof configRoot !== "string" || !isAbsolute(configRoot)
    || environment.HOME !== configRoot) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_CONFIG_ROOT_REQUIRED");
  }
  const repositoryRoot = realpathSync(REPOSITORY_ROOT);
  const canonicalRoot = realpathSync(configRoot);
  const stat = lstatSync(configRoot, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()
    || normalizedRealPath(canonicalRoot) !== normalizedRealPath(configRoot)
    || normalizedRealPath(canonicalRoot) === normalizedRealPath(repositoryRoot)
    || isWithin(repositoryRoot, canonicalRoot)
    || (stat.mode & 0o777n) !== 0o700n
    || readdirSync(canonicalRoot).length !== 0) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_CONFIG_ROOT_BOUNDARY_HOLD");
  }
  return Object.freeze({
    absolutePath: canonicalRoot,
    fingerprint: statFingerprint(stat),
    device: stat.dev.toString(),
    inode: stat.ino.toString(),
    mode: Number(stat.mode & 0o777n),
    empty: true,
  });
}

function assertDockerConfigRootStable(observation, environment) {
  const current = observeDockerConfigRoot(environment);
  if (current.fingerprint !== observation.fingerprint) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_CONFIG_ROOT_CHANGED_HOLD");
  }
  return current;
}

function validateHostRuntime(environment) {
  const expectedEnvironment = {
    ...FIXED_HOST_ENVIRONMENT,
    IAT_B3_EXACT_SOURCE_HEAD_SHA: environment.IAT_B3_EXACT_SOURCE_HEAD_SHA,
    [DISPOSABLE_DEVNET_EXECUTION_GATE_ENVIRONMENT_VARIABLE]:
      environment[DISPOSABLE_DEVNET_EXECUTION_GATE_ENVIRONMENT_VARIABLE],
  };
  if (process.platform !== "linux" || process.arch !== "x64"
    || process.version !== PINNED_DISPOSABLE_DEVNET_NODE_RUNTIME.version
    || !HEX_SHA1.test(expectedEnvironment.IAT_B3_EXACT_SOURCE_HEAD_SHA ?? "")
    || expectedEnvironment[DISPOSABLE_DEVNET_EXECUTION_GATE_ENVIRONMENT_VARIABLE]
      !== DISPOSABLE_DEVNET_EXECUTION_GATE_VALUE
    || !hasExactKeys(environment, Object.keys(expectedEnvironment))
    || Object.entries(expectedEnvironment).some(([name, value]) => environment[name] !== value)
    || process.execArgv.length !== 0
    || process.argv[0] !== process.execPath
    || FORBIDDEN_HOST_INJECTION_ENVIRONMENT.some((name) => environment[name] !== undefined)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_HOST_RUNTIME_REQUIRED");
  }
  const procExecutable = realpathSync("/proc/self/exe");
  const procCommandLine = readFileSync("/proc/self/cmdline")
    .toString("utf8").split("\0").filter((value) => value.length > 0);
  const procEnvironmentBytes = readFileSync("/proc/self/environ");
  const procEnvironmentEntries = procEnvironmentBytes.toString("utf8")
    .split("\0").filter(Boolean);
  const procEnvironment = Object.fromEntries(
    procEnvironmentEntries.map((entry) => {
      const separator = entry.indexOf("=");
      return [entry.slice(0, separator), entry.slice(separator + 1)];
    }),
  );
  if (normalizedRealPath(procExecutable) !== normalizedRealPath(process.execPath)
    || procCommandLine.join("\0") !== process.argv.join("\0")
    || procEnvironmentEntries.length !== Object.keys(expectedEnvironment).length
    || !hasExactKeys(procEnvironment, Object.keys(expectedEnvironment))
    || Object.entries(expectedEnvironment).some(([name, value]) => procEnvironment[name] !== value)
    || FORBIDDEN_HOST_INJECTION_ENVIRONMENT.some((name) => procEnvironment[name] !== undefined)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_HOST_PROCESS_OR_ENVIRONMENT_INJECTION_HOLD");
  }
  const node = readStableRegularFile(process.execPath, {
    label: "DISPOSABLE_DEVNET_EXECUTION_PINNED_NODE_RUNTIME",
    maximumBytes: 256 * 1024 * 1024,
  });
  if (node.sha256 !== PINNED_DISPOSABLE_DEVNET_NODE_RUNTIME.sha256
    || node.byteLength !== PINNED_DISPOSABLE_DEVNET_NODE_RUNTIME.byteLength) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_NODE_RUNTIME_BYTES_DRIFT_HOLD");
  }
  const git = readStableRegularFile(PINNED_DISPOSABLE_DEVNET_GIT_CLIENT.absolutePath, {
    label: "DISPOSABLE_DEVNET_EXECUTION_PINNED_GIT_CLIENT",
    maximumBytes: 16 * 1024 * 1024,
  });
  if (git.sha256 !== PINNED_DISPOSABLE_DEVNET_GIT_CLIENT.sha256
    || git.byteLength !== PINNED_DISPOSABLE_DEVNET_GIT_CLIENT.byteLength) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_GIT_CLIENT_BYTES_DRIFT_HOLD");
  }
  const version = spawnSync(PINNED_DISPOSABLE_DEVNET_GIT_CLIENT.absolutePath, ["--version"], {
    cwd: dirname(PINNED_DISPOSABLE_DEVNET_GIT_CLIENT.absolutePath),
    encoding: "utf8",
    env: { LANG: "C.UTF-8", LC_ALL: "C.UTF-8", PATH: "/usr/bin:/bin" },
    timeout: 10_000,
    windowsHide: true,
  });
  if (version.error || version.status !== 0 || version.signal !== null
    || version.stderr !== ""
    || version.stdout.trim() !== PINNED_DISPOSABLE_DEVNET_GIT_CLIENT.version) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_GIT_CLIENT_VERSION_DRIFT_HOLD");
  }
  return deepFreeze({
    node: {
      ...PINNED_DISPOSABLE_DEVNET_NODE_RUNTIME,
      absolutePath: node.absolutePath,
      device: node.device,
      inode: node.inode,
    },
    git: {
      ...PINNED_DISPOSABLE_DEVNET_GIT_CLIENT,
      device: git.device,
      inode: git.inode,
      versionStdoutSha256: sha256(Buffer.from(version.stdout, "utf8")),
    },
    argv: [...process.argv],
    environment: { ...expectedEnvironment },
    process: {
      procExecutable,
      execArgv: [...process.execArgv],
      argvSha256: disposableDevnetExecutionCanonicalSha256(process.argv),
      procCommandLineSha256: sha256(readFileSync("/proc/self/cmdline")),
      procEnvironmentSha256: sha256(procEnvironmentBytes),
      forbiddenInjectionEnvironmentObserved: false,
    },
  });
}

function validateOutputRoot(outputRoot) {
  if (typeof outputRoot !== "string" || !isAbsolute(outputRoot)
    || !OUTPUT_ROOT_NAME.test(basename(outputRoot))) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_OUTPUT_ROOT_INVALID");
  }
  const target = resolve(outputRoot);
  const parent = dirname(target);
  const realParent = realpathSync(parent);
  const realRepository = realpathSync(REPOSITORY_ROOT);
  if (normalizedRealPath(realParent) !== normalizedRealPath(parent)
    || target === realRepository || isWithin(realRepository, target)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_OUTPUT_ROOT_BOUNDARY_HOLD");
  }
  try {
    lstatSync(target);
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_OUTPUT_ROOT_MUST_NOT_EXIST");
  } catch (error) {
    if (error instanceof Error
      && error.message === "DISPOSABLE_DEVNET_EXECUTION_OUTPUT_ROOT_MUST_NOT_EXIST") throw error;
  }
  const parentChain = observeDirectoryChain(realParent, "DISPOSABLE_DEVNET_EXECUTION_OUTPUT_ROOT");
  return Object.freeze({ target, parent: realParent, parentChain });
}

function createOutputStage(output) {
  assertDirectoryChainStable(output.parentChain, "DISPOSABLE_DEVNET_EXECUTION_OUTPUT_ROOT");
  mkdirSync(output.target, { recursive: false, mode: 0o700 });
  chmodSync(output.target, 0o700);
  const stage = realpathSync(output.target);
  const stat = lstatSync(stage, { bigint: true });
  if (normalizedRealPath(stage) !== normalizedRealPath(output.target)
    || dirname(stage) !== output.parent
    || !OUTPUT_ROOT_NAME.test(basename(stage))
    || !stat.isDirectory() || stat.isSymbolicLink()
    || (stat.mode & 0o777n) !== 0o700n
    || readdirSync(stage).length !== 0) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_OUTPUT_STAGE_BOUNDARY_HOLD");
  }
  PROCESS_CREATED_STAGES.set(stage, Object.freeze({
    fingerprint: directoryIdentityFingerprint(stat),
    parentChain: observeDirectoryIdentityChain(
      output.parent,
      "DISPOSABLE_DEVNET_EXECUTION_OUTPUT_ROOT",
    ),
  }));
  return stage;
}

function assertOutputStageStable(stage) {
  const observation = PROCESS_CREATED_STAGES.get(stage);
  if (!observation) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_OUTPUT_STAGE_NOT_PROCESS_OWNED");
  }
  assertDirectoryIdentityChainStable(
    observation.parentChain,
    "DISPOSABLE_DEVNET_EXECUTION_OUTPUT_ROOT",
  );
  const stat = lstatSync(stage, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()
    || directoryIdentityFingerprint(stat) !== observation.fingerprint
    || normalizedRealPath(realpathSync(stage)) !== normalizedRealPath(stage)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_OUTPUT_STAGE_CHANGED_HOLD");
  }
}

function removeOutputStage(stage) {
  assertOutputStageStable(stage);
  rmSync(stage, { recursive: true, force: true });
  PROCESS_CREATED_STAGES.delete(stage);
}

function ensureDirectory(path) {
  mkdirSync(path, { recursive: false, mode: 0o700 });
  const stat = lstatSync(path, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()
    || (stat.mode & 0o777n) !== 0o700n
    || normalizedRealPath(realpathSync(path)) !== normalizedRealPath(path)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_FRESH_DIRECTORY_HOLD");
  }
  return path;
}

function writeExclusiveFile(path, bytes, mode = 0o600) {
  const descriptor = openSync(
    path,
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL
      | (fsConstants.O_NOFOLLOW ?? 0),
    mode,
  );
  try {
    let offset = 0;
    while (offset < bytes.length) offset += writeSync(descriptor, bytes, offset);
    fsyncSync(descriptor);
    const stat = fstatSync(descriptor, { bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n || BigInt(bytes.length) !== stat.size) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_OUTPUT_FILE_WRITE_BINDING_HOLD");
    }
  } finally {
    closeSync(descriptor);
  }
  const readback = readStableRegularFile(path, {
    label: "DISPOSABLE_DEVNET_EXECUTION_OUTPUT_FILE",
    maximumBytes: Math.max(bytes.length, 1),
    allowEmpty: true,
  });
  if (!readback.bytes.equals(bytes)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_OUTPUT_FILE_READBACK_HOLD");
  }
  return readback;
}

function relativeFileDescriptor(file, stageRoot) {
  const relativePath = relative(stageRoot, file.absolutePath).replaceAll("\\", "/");
  if (relativePath === "" || relativePath === ".." || relativePath.startsWith("../")) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_OUTPUT_DESCRIPTOR_PATH_HOLD");
  }
  return Object.freeze({
    relativePath,
    sha256: file.sha256,
    byteLength: file.byteLength,
    device: file.device,
    inode: file.inode,
  });
}

function safeDockerEnvironment({
  dockerConfigRoot,
  declaredHeadSha,
  identityEnvironment = null,
} = {}) {
  if (!HEX_SHA1.test(declaredHeadSha ?? "")) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_EXACT_SOURCE_HEAD_REQUIRED");
  }
  const environment = {
    ...BASE_DOCKER_ENVIRONMENT,
    DOCKER_CONFIG: dockerConfigRoot,
    HOME: dockerConfigRoot,
    IAT_B3_EXACT_SOURCE_HEAD_SHA: declaredHeadSha,
  };
  if (identityEnvironment) Object.assign(environment, identityEnvironment);
  return Object.freeze(Object.fromEntries(Object.entries(environment).sort(([a], [b]) => a.localeCompare(b))));
}

function assertExactDockerEnvironment(environment, logicalArguments) {
  const forwardedNames = logicalArguments
    .filter((argument) => argument.startsWith("--env="))
    .map((argument) => argument.slice("--env=".length));
  const expected = {
    ...BASE_DOCKER_ENVIRONMENT,
    DOCKER_CONFIG: environment?.DOCKER_CONFIG,
    HOME: environment?.DOCKER_CONFIG,
    IAT_B3_EXACT_SOURCE_HEAD_SHA: environment?.IAT_B3_EXACT_SOURCE_HEAD_SHA,
    ...Object.fromEntries(forwardedNames
      .filter((name) => name !== "IAT_B3_EXACT_SOURCE_HEAD_SHA")
      .map((name) => [name, environment?.[name]])),
  };
  if (!HEX_SHA1.test(expected.IAT_B3_EXACT_SOURCE_HEAD_SHA ?? "")
    || Object.values(expected).some((value) => typeof value !== "string" || /[\r\n\0]/u.test(value))
    || !hasExactKeys(environment, Object.keys(expected))
    || Object.entries(expected).some(([name, value]) => environment[name] !== value)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_ENVIRONMENT_HOLD");
  }
}

function spawnPinnedDocker({ purpose, arguments_, environment, allowFailure = false }) {
  assertOfflineOrInspectArguments(arguments_);
  assertExactDockerEnvironment(environment, arguments_);
  const dockerBefore = validateDockerExecutable();
  const socketBefore = observePinnedDockerSocket();
  const configBefore = observeDockerConfigRoot(environment);
  const actualArguments = [`--config=${configBefore.absolutePath}`, ...arguments_];
  const timeoutMilliseconds = /^run-[12]-(?:law|economy)-build-start$/u.test(purpose)
    ? DOCKER_BUILD_TIMEOUT_MILLISECONDS
    : /^platform-tools-v1\.52-closure-start$/u.test(purpose)
      ? DOCKER_TOOLCHAIN_CLOSURE_TIMEOUT_MILLISECONDS
    : DOCKER_PROBE_TIMEOUT_MILLISECONDS;
  const result = spawnSync(PINNED_DISPOSABLE_DEVNET_DOCKER_CLI.absolutePath, actualArguments, {
    cwd: DOCKER_TRUSTED_WORKING_DIRECTORY,
    encoding: null,
    env: environment,
    maxBuffer: MAX_CAPTURE_BYTES,
    timeout: timeoutMilliseconds,
    windowsHide: true,
  });
  const dockerAfter = validateDockerExecutable();
  const socketAfter = assertPinnedDockerSocketStable(socketBefore);
  const configAfter = assertDockerConfigRootStable(configBefore, environment);
  if (dockerAfter.sha256 !== dockerBefore.sha256
    || dockerAfter.byteLength !== dockerBefore.byteLength
    || dockerAfter.device !== dockerBefore.device
    || dockerAfter.inode !== dockerBefore.inode) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_DOCKER_CLIENT_CHANGED_HOLD");
  }
  const stdout = Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.alloc(0);
  const stderr = Buffer.isBuffer(result.stderr) ? result.stderr : Buffer.alloc(0);
  if (result.error || (!allowFailure && result.status !== 0) || result.signal !== null) {
    throw new Error(`DISPOSABLE_DEVNET_EXECUTION_DOCKER_${purpose.toUpperCase().replaceAll("-", "_")}_HOLD`);
  }
  return Object.freeze({
    purpose,
    logicalArguments: Object.freeze([...arguments_]),
    arguments: Object.freeze(actualArguments),
    environment,
    trustedWorkingDirectory: DOCKER_TRUSTED_WORKING_DIRECTORY,
    timeoutMilliseconds,
    dockerExecutableBefore: projectStableFileBoundary(dockerBefore),
    dockerExecutableAfter: projectStableFileBoundary(dockerAfter),
    dockerSocketBefore: socketBefore,
    dockerSocketAfter: socketAfter,
    dockerConfigBefore: configBefore,
    dockerConfigAfter: configAfter,
    exitStatus: result.status,
    signal: result.signal,
    stdout,
    stderr,
  });
}

function assertOfflineOrInspectArguments(arguments_) {
  if (!Array.isArray(arguments_)
    || arguments_.some((value) => typeof value !== "string" || /[\r\n\0]/u.test(value))) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_ARGUMENTS_INVALID");
  }
  if (exactStringArrayEquals(arguments_, ["--version"])) return;
  const host = `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`;
  if (arguments_.length < 2 || arguments_[0] !== host) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_ARGUMENTS_INVALID");
  }
  if (exactStringArrayEquals(arguments_, [host, "version", "--format={{json .}}"])) {
    return;
  }
  if (arguments_[1] === "create") {
    assertOfflineDockerCreateArguments(arguments_);
  } else if (arguments_[1] === "image") {
    if (arguments_.length !== 4
      || arguments_[2] !== "inspect"
      || arguments_[3] !== PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_IMAGE_COMMAND_FORBIDDEN");
    }
  } else if (arguments_[1] === "container") {
    const subcommand = arguments_[2];
    const valid = (subcommand === "inspect"
        && arguments_.length === 4
        && /^iat-b3-b15-[a-z0-9-]{1,80}$/u.test(arguments_[3]))
      || (subcommand === "start"
        && arguments_.length === 5
        && arguments_[3] === "--attach"
        && /^iat-b3-b15-[a-z0-9-]{1,80}$/u.test(arguments_[4]))
      || (subcommand === "rm"
        && arguments_.length === 5
        && arguments_[3] === "--force"
        && /^iat-b3-b15-[a-z0-9-]{1,80}$/u.test(arguments_[4]));
    if (!valid) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_CONTAINER_COMMAND_FORBIDDEN");
    }
  } else {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_COMMAND_FORBIDDEN");
  }
  if (arguments_.some((value) => FORBIDDEN_PROCESS_ARGUMENT.test(value))) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DOCKER_COMMAND_FORBIDDEN");
  }
}

function containerNameFromCreateArguments(arguments_) {
  assertOfflineDockerCreateArguments(arguments_);
  const nameArgument = arguments_.find((value) => value.startsWith("--name="));
  const name = nameArgument?.slice("--name=".length);
  if (!name || !/^iat-b3-b15-[a-z0-9-]{1,80}$/u.test(name)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_CONTAINER_NAME_INVALID");
  }
  return name;
}

function assertPinnedDockerRuntimeValue(actual, expected, label) {
  for (const [name, value] of Object.entries(expected)) {
    if (actual?.[name] !== value) {
      throw new Error(`DISPOSABLE_DEVNET_EXECUTION_PINNED_DOCKER_${label}_DRIFT_HOLD`);
    }
  }
}

function observePinnedDockerRuntime({
  dockerEnvironment,
  stageRoot,
  invocationRecords,
  nextOrdinal,
}) {
  const invoke = (purpose, arguments_) => {
    const invocation = spawnPinnedDocker({
      purpose,
      arguments_,
      environment: dockerEnvironment,
    });
    const record = persistInvocation(stageRoot, nextOrdinal(), invocation);
    invocationRecords.push(record);
    return { invocation, record };
  };
  const version = invoke("docker-client-version", ["--version"]);
  if (version.invocation.stderr.length !== 0
    || version.invocation.stdout.toString("utf8").trim()
      !== PINNED_DISPOSABLE_DEVNET_DOCKER_CLI.version) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_DOCKER_CLIENT_VERSION_DRIFT_HOLD");
  }
  const host = `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`;
  const runtime = invoke("docker-client-server-runtime", [
    host,
    "version",
    "--format={{json .}}",
  ]);
  if (runtime.invocation.stderr.length !== 0) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_DOCKER_RUNTIME_STDERR_HOLD");
  }
  let parsed;
  try {
    parsed = JSON.parse(runtime.invocation.stdout.toString("utf8"));
  } catch {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_DOCKER_RUNTIME_JSON_HOLD");
  }
  assertPinnedDockerRuntimeValue(
    parsed?.Client,
    PINNED_DISPOSABLE_DEVNET_DOCKER_RUNTIME.client,
    "CLIENT_RUNTIME",
  );
  assertPinnedDockerRuntimeValue(
    parsed?.Server,
    PINNED_DISPOSABLE_DEVNET_DOCKER_RUNTIME.server,
    "SERVER_RUNTIME",
  );
  const components = parsed?.Server?.Components;
  if (!Array.isArray(components)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_DOCKER_RUNTIME_COMPONENTS_HOLD");
  }
  const engine = components.find((component) => component?.Name === "Engine");
  assertPinnedDockerRuntimeValue(engine, { Name: "Engine", Version: "29.1.3" }, "ENGINE");
  assertPinnedDockerRuntimeValue(
    engine?.Details,
    PINNED_DISPOSABLE_DEVNET_DOCKER_RUNTIME.server,
    "ENGINE_DETAILS",
  );
  for (const [name, expectedVersion] of Object.entries(
    PINNED_DISPOSABLE_DEVNET_DOCKER_RUNTIME.components,
  )) {
    if (components.find((component) => component?.Name === name)?.Version !== expectedVersion) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_DOCKER_RUNTIME_COMPONENT_DRIFT_HOLD");
    }
  }
  return deepFreeze({
    policy: PINNED_DISPOSABLE_DEVNET_DOCKER_RUNTIME,
    clientVersionInvocationOrdinal: version.record.ordinal,
    clientVersionStdoutSha256: sha256(version.invocation.stdout),
    runtimeInvocationOrdinal: runtime.record.ordinal,
    runtimeStdoutSha256: sha256(runtime.invocation.stdout),
    socket: runtime.record.socketAfter,
  });
}

function parseContainerInspect(bytes, {
  name,
  expectedState,
  expectedImageId = null,
  expectedContainerId = null,
  createArguments,
  environment,
}) {
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_CONTAINER_INSPECT_JSON_HOLD");
  }
  const record = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : null;
  const securityOptions = record?.HostConfig?.SecurityOpt;
  const capDrop = record?.HostConfig?.CapDrop;
  const imageIndex = createArguments.indexOf(PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference);
  const entrypoint = createArguments.find((argument) => argument.startsWith("--entrypoint="))
    ?.slice("--entrypoint=".length);
  const workdir = createArguments.find((argument) => argument.startsWith("--workdir="))
    ?.slice("--workdir=".length);
  const expectedMounts = createArguments.filter((argument) => argument.startsWith("--mount="))
    .map((argument) => {
      const match = /^--mount=type=bind,source=(?<source>[^,\r\n\0]+),target=(?<target>[^,\r\n\0]+)(?<readonly>,readonly)?$/u
        .exec(argument);
      if (!match?.groups?.source || !match.groups.target) {
        throw new Error("DISPOSABLE_DEVNET_EXECUTION_CONTAINER_INSPECT_MOUNT_GRAMMAR_HOLD");
      }
      return {
        Source: match.groups.source,
        Destination: match.groups.target,
        RW: match.groups.readonly === undefined,
      };
    });
  const observedMounts = record?.Mounts;
  const forwardedEnvironmentNames = createArguments
    .filter((argument) => argument.startsWith("--env="))
    .map((argument) => argument.slice("--env=".length));
  const observedEnvironment = record?.Config?.Env;
  const exactCreateBinding = imageIndex > 0
    && Array.isArray(record?.Config?.Entrypoint)
    && exactStringArrayEquals(record.Config.Entrypoint, [entrypoint])
    && exactStringArrayEquals(record.Config.Cmd, createArguments.slice(imageIndex + 1))
    && (workdir === undefined || record.Config.WorkingDir === workdir)
    && Array.isArray(observedMounts)
    && observedMounts.length === expectedMounts.length
    && expectedMounts.every((expected) => observedMounts.some((actual) => (
      actual?.Type === "bind"
      && normalizedRealPath(actual.Source) === normalizedRealPath(expected.Source)
      && actual.Destination === expected.Destination
      && actual.RW === expected.RW
    )))
    && Array.isArray(observedEnvironment)
    && forwardedEnvironmentNames.every((environmentName) => (
      observedEnvironment.filter((value) => value === `${environmentName}=${environment[environmentName]}`)
        .length === 1
      && observedEnvironment.filter((value) => value.startsWith(`${environmentName}=`)).length === 1
    ));
  if (!record
    || (expectedContainerId !== null && record.Id !== expectedContainerId)
    || record.Name !== `/${name}`
    || record.Config?.Image !== PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference
    || (expectedImageId !== null && record.Image !== expectedImageId)
    || record.HostConfig?.NetworkMode !== "none"
    || record.HostConfig?.ReadonlyRootfs !== true
    || record.HostConfig?.Tmpfs?.["/tmp"] !== "rw,nosuid,nodev,noexec,size=268435456"
    || !Array.isArray(securityOptions)
    || securityOptions.length !== 1
    || !securityOptions.some((value) => value === "no-new-privileges"
      || value === "no-new-privileges:true")
    || !Array.isArray(capDrop)
    || !exactStringArrayEquals(capDrop, ["ALL"])
    || record.HostConfig?.Privileged !== false
    || ![null, undefined].includes(record.HostConfig?.CapAdd)
      && !(Array.isArray(record.HostConfig?.CapAdd) && record.HostConfig.CapAdd.length === 0)
    || !Array.isArray(record.HostConfig?.Devices) || record.HostConfig.Devices.length !== 0
    || record.HostConfig?.AutoRemove !== false
    || !exactCreateBinding
    || record.State?.Status !== expectedState
    || (expectedState === "exited" && record.State?.ExitCode !== 0)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_CONTAINER_INSPECT_CONFINEMENT_HOLD");
  }
  return record;
}

function persistInvocation(stageRoot, ordinal, invocation) {
  const logRoot = join(stageRoot, "logs");
  if (!lstatSync(logRoot).isDirectory()) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_LOG_ROOT_INVALID");
  }
  const prefix = `${String(ordinal).padStart(2, "0")}-${invocation.purpose}`;
  const stdout = relativeFileDescriptor(
    writeExclusiveFile(join(logRoot, `${prefix}.stdout.bin`), invocation.stdout),
    stageRoot,
  );
  const stderr = relativeFileDescriptor(
    writeExclusiveFile(join(logRoot, `${prefix}.stderr.bin`), invocation.stderr),
    stageRoot,
  );
  return deepFreeze({
    ordinal,
    purpose: invocation.purpose,
    executable: { ...PINNED_DISPOSABLE_DEVNET_DOCKER_CLI },
    executableBefore: invocation.dockerExecutableBefore,
    executableAfter: invocation.dockerExecutableAfter,
    trustedWorkingDirectory: invocation.trustedWorkingDirectory,
    timeoutMilliseconds: invocation.timeoutMilliseconds,
    logicalArguments: [...invocation.logicalArguments],
    logicalArgumentsSha256: disposableDevnetExecutionCanonicalSha256(invocation.logicalArguments),
    arguments: [...invocation.arguments],
    argumentsSha256: disposableDevnetExecutionCanonicalSha256(invocation.arguments),
    environment: { ...invocation.environment },
    environmentSha256: disposableDevnetExecutionCanonicalSha256(invocation.environment),
    socketBefore: invocation.dockerSocketBefore,
    socketAfter: invocation.dockerSocketAfter,
    configBefore: invocation.dockerConfigBefore,
    configAfter: invocation.dockerConfigAfter,
    exitStatus: invocation.exitStatus,
    signal: invocation.signal,
    stdout,
    stderr,
  });
}

function executePinnedContainer({
  purpose,
  createArguments,
  environment,
  expectedImageId,
  stageRoot,
  invocationRecords,
  nextOrdinal,
}) {
  const name = containerNameFromCreateArguments(createArguments);
  const invocationStartIndex = invocationRecords.length;
  let creationAttempted = false;
  let absenceProven = false;
  let commandOutput = null;
  const invoke = (suffix, arguments_, allowFailure = false) => {
    const invocation = spawnPinnedDocker({
      purpose: `${purpose}-${suffix}`,
      arguments_,
      environment,
      allowFailure,
    });
    invocationRecords.push(persistInvocation(stageRoot, nextOrdinal(), invocation));
    return invocation;
  };
  const assertAbsent = (invocation) => {
    const stderr = invocation.stderr.toString("utf8");
    if (invocation.exitStatus !== 1 || invocation.stdout.length !== 0
      || !stderr.includes(`No such container: ${name}`)) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_CONTAINER_ABSENCE_NOT_PROVEN_HOLD");
    }
  };
  const cleanupAndProveAbsence = (suffix) => {
    const cleanup = invoke(`${suffix}-remove`, [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "container", "rm", "--force", name,
    ], true);
    const cleanupStderr = cleanup.stderr.toString("utf8");
    if (![
      0,
      1,
    ].includes(cleanup.exitStatus)
      || (cleanup.exitStatus === 0
        && (cleanup.stderr.length !== 0 || cleanup.stdout.toString("utf8").trim() !== name))
      || (cleanup.exitStatus === 1 && !cleanupStderr.includes(`No such container: ${name}`))) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_CONTAINER_CLEANUP_HOLD");
    }
    const absent = invoke(`${suffix}-absence-proof`, [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "container", "inspect", name,
    ], true);
    assertAbsent(absent);
    absenceProven = true;
  };
  try {
    const preexisting = invoke("preexisting-absence-proof", [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "container", "inspect", name,
    ], true);
    assertAbsent(preexisting);
    creationAttempted = true;
    const creation = invoke("create", createArguments);
    const containerId = creation.stdout.toString("utf8").trim();
    if (!/^[0-9a-f]{64}$/u.test(containerId)) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_CONTAINER_ID_INVALID");
    }
    const before = invoke("inspect-before", [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "container", "inspect", name,
    ]);
    parseContainerInspect(before.stdout, {
      name,
      expectedState: "created",
      expectedImageId,
      expectedContainerId: containerId,
      createArguments,
      environment,
    });
    commandOutput = invoke("start", [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "container", "start", "--attach", name,
    ]);
    const after = invoke("inspect-after", [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "container", "inspect", name,
    ]);
    parseContainerInspect(after.stdout, {
      name,
      expectedState: "exited",
      expectedImageId,
      expectedContainerId: containerId,
      createArguments,
      environment,
    });
    cleanupAndProveAbsence("normal-cleanup");
    const selectedRecords = invocationRecords.slice(invocationStartIndex);
    const observation = deepFreeze({
      containerId,
      name,
      invocationOrdinals: selectedRecords.map(({ ordinal }) => ordinal),
      invocationClosureSha256: disposableDevnetExecutionCanonicalSha256(selectedRecords),
      imageId: expectedImageId,
      networkMode: "none",
      pullPolicy: "never",
      preexistingContainerAbsenceProven: true,
      postExecutionContainerAbsenceProven: true,
      cleanupObserved: true,
    });
    return Object.freeze({
      observation,
      commandOutput,
    });
  } finally {
    if (creationAttempted && !absenceProven) cleanupAndProveAbsence("failure-cleanup");
  }
}

function inspectPinnedContainer({ dockerEnvironment, stageRoot, invocationRecords, nextOrdinal }) {
  const invocation = spawnPinnedDocker({
    purpose: "image-inspect",
    arguments_: [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "image",
      "inspect",
      PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference,
    ],
    environment: dockerEnvironment,
  });
  invocationRecords.push(persistInvocation(stageRoot, nextOrdinal(), invocation));
  let parsed;
  try {
    parsed = JSON.parse(invocation.stdout.toString("utf8"));
  } catch {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_IMAGE_INSPECT_JSON_HOLD");
  }
  if (!Array.isArray(parsed) || parsed.length !== 1
    || parsed[0]?.Os !== "linux" || parsed[0]?.Architecture !== "amd64"
    || !/^sha256:[0-9a-f]{64}$/u.test(parsed[0]?.Id ?? "")
    || !Array.isArray(parsed[0]?.RepoDigests)
    || !parsed[0].RepoDigests.includes(PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_PLATFORM_MANIFEST_NOT_LOCAL_HOLD");
  }
  return deepFreeze({
    ...PINNED_COMBINED_LAW_BUILD_CONTAINER,
    localImageId: parsed[0].Id,
    inspectInvocationOrdinal: invocationRecords.at(-1).ordinal,
    inspectBytesSha256: sha256(invocation.stdout),
  });
}

function observePinnedToolchain({
  laneId,
  dockerEnvironment,
  stageRoot,
  invocationRecords,
  nextOrdinal,
  expectedImageId,
}) {
  const outputs = {};
  const containerObservations = [];
  for (const planned of createDisposableDevnetToolchainInvocationPlan(laneId)) {
    const container = executePinnedContainer({
      purpose: planned.purpose,
      createArguments: planned.createArguments,
      environment: dockerEnvironment,
      expectedImageId,
      stageRoot,
      invocationRecords,
      nextOrdinal,
    });
    outputs[planned.purpose] = container.commandOutput.stdout.toString("utf8").trim();
    containerObservations.push(container.observation);
  }
  if (outputs["rustc-version"] !== RUSTC_VERSION
    || outputs["cargo-version"] !== CARGO_VERSION
    || outputs["cargo-build-sbf-version"] !== CARGO_BUILD_SBF_VERSION
    || outputs["platform-tools-v1.52-closure"].length === 0
    || !outputs["platform-tools-v1.52-closure"].includes("/v1.52/platform-tools/")) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_TOOLCHAIN_DRIFT_HOLD");
  }
  return deepFreeze({
    rustc: outputs["rustc-version"],
    cargo: outputs["cargo-version"],
    cargoBuildSbf: outputs["cargo-build-sbf-version"],
    platformToolsVersion: "1.52",
    platformToolsClosureSha256: sha256(Buffer.from(outputs["platform-tools-v1.52-closure"], "utf8")),
    containers: containerObservations,
  });
}

function readBuildArtifact(path, label) {
  const artifact = readStableRegularFile(path, { label, maximumBytes: MAX_ARTIFACT_BYTES });
  if (artifact.byteLength < 1_024
    || artifact.bytes[0] !== 0x7f || artifact.bytes[1] !== 0x45
    || artifact.bytes[2] !== 0x4c || artifact.bytes[3] !== 0x46
    || artifact.bytes[4] !== 2 || artifact.bytes[5] !== 1 || artifact.bytes[6] !== 1
    || artifact.bytes.readUInt16LE(16) !== 3
    || artifact.bytes.readUInt16LE(18) !== 247) {
    throw new Error(`${label}_SOLANA_SBF_ELF_HEADER_HOLD`);
  }
  return artifact;
}

function persistArtifact(stageRoot, runOrdinal, kind, artifact) {
  const artifactRoot = join(stageRoot, "artifacts");
  const fileName = `run-${runOrdinal}-${kind}.so`;
  return relativeFileDescriptor(
    writeExclusiveFile(join(artifactRoot, fileName), artifact.bytes, 0o600),
    stageRoot,
  );
}

function executeBuildPair({
  sourceSnapshot,
  buildRoot,
  ordinal,
  laneId,
  identityEnvironment,
  dockerEnvironment,
  stageRoot,
  invocationRecords,
  nextOrdinal,
  expectedImageId,
}) {
  const runRoot = ensureDirectory(join(buildRoot, `run-${ordinal}`));
  const plan = createDisposableDevnetDockerBuildInvocationPlan({
    sourceSnapshotRoot: sourceSnapshot.root,
    runRoot,
    ordinal,
    laneId,
    identityEnvironment,
  });
  ensureDirectory(plan.roots.law);
  ensureDirectory(plan.roots.economy);
  const observations = {};
  for (const kind of ["law", "economy"]) {
    const container = executePinnedContainer({
      purpose: `run-${ordinal}-${kind}-build`,
      createArguments: plan[kind].createArguments,
      environment: Object.freeze({ ...dockerEnvironment, ...plan[kind].environment }),
      expectedImageId,
      stageRoot,
      invocationRecords,
      nextOrdinal,
    });
    const recipe = kind === "law"
      ? PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE
      : ECONOMY_SBF_BUILD_RECIPE;
    const artifact = readBuildArtifact(
      join(plan.roots[kind], "output", recipe.outputFileName),
      `DISPOSABLE_DEVNET_EXECUTION_RUN_${ordinal}_${kind.toUpperCase()}_ARTIFACT`,
    );
    observations[kind] = deepFreeze({
      container: container.observation,
      sourceArtifact: {
        sha256: artifact.sha256,
        byteLength: artifact.byteLength,
        device: artifact.device,
        inode: artifact.inode,
      },
      preservedArtifact: persistArtifact(stageRoot, ordinal, kind, artifact),
    });
  }
  const keyScan = scanDisposableDevnetBuildTreeForKeyMaterial(runRoot);
  return deepFreeze({ ordinal, law: observations.law, economy: observations.economy, keyScan });
}

function assertDualBuildEquality(builds) {
  if (!Array.isArray(builds) || builds.length !== 2
    || builds[0].ordinal !== 1 || builds[1].ordinal !== 2) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_TWO_ISOLATED_BUILDS_REQUIRED");
  }
  const equality = {};
  for (const kind of ["law", "economy"]) {
    const first = builds[0][kind].sourceArtifact;
    const second = builds[1][kind].sourceArtifact;
    const firstPreserved = builds[0][kind].preservedArtifact;
    const secondPreserved = builds[1][kind].preservedArtifact;
    if (first.sha256 !== second.sha256 || first.byteLength !== second.byteLength
      || (first.device === second.device && first.inode === second.inode)
      || firstPreserved.relativePath === secondPreserved.relativePath
      || (firstPreserved.device === secondPreserved.device
        && firstPreserved.inode === secondPreserved.inode)
      || builds[0][kind].container.name === builds[1][kind].container.name
      || builds[0][kind].container.containerId === builds[1][kind].container.containerId) {
      throw new Error(`DISPOSABLE_DEVNET_EXECUTION_${kind.toUpperCase()}_DUAL_BUILD_MISMATCH_HOLD`);
    }
    equality[kind] = {
      sha256: first.sha256,
      byteLength: first.byteLength,
      identicalSha256: true,
      identicalByteLength: true,
      productionFinalByteEvidence: false,
    };
  }
  if (equality.law.sha256 === equality.economy.sha256) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_LAW_ECONOMY_ARTIFACT_ALIAS_HOLD");
  }
  for (const build of builds) {
    if (build.law.container.name === build.economy.container.name
      || build.law.container.containerId === build.economy.container.containerId
      || (build.law.sourceArtifact.device === build.economy.sourceArtifact.device
        && build.law.sourceArtifact.inode === build.economy.sourceArtifact.inode)) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_LAW_ECONOMY_ISOLATION_HOLD");
    }
  }
  return deepFreeze(equality);
}

function assertInvocationAndContainerClosure({ invocationRecords, toolchain, builds }) {
  if (!Array.isArray(invocationRecords) || invocationRecords.length === 0
    || invocationRecords.some(({ ordinal }, index) => ordinal !== index + 1)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_INVOCATION_ORDINAL_CLOSURE_HOLD");
  }
  const logPaths = invocationRecords.flatMap(({ stdout, stderr }) => [
    stdout.relativePath,
    stderr.relativePath,
  ]);
  if (new Set(logPaths).size !== logPaths.length) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_INVOCATION_LOG_ALIAS_HOLD");
  }
  const containers = [
    ...toolchain.containers,
    ...builds.flatMap((build) => [build.law.container, build.economy.container]),
  ];
  if (containers.length !== 8
    || new Set(containers.map(({ containerId }) => containerId)).size !== containers.length
    || new Set(containers.map(({ name }) => name)).size !== containers.length
    || containers.some((container) => (
      container.preexistingContainerAbsenceProven !== true
      || container.postExecutionContainerAbsenceProven !== true
      || container.cleanupObserved !== true
    ))) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_CONTAINER_CLEANUP_CLOSURE_HOLD");
  }
  return Object.freeze({
    invocationCount: invocationRecords.length,
    rawLogFileCount: logPaths.length,
    containerCount: containers.length,
    everyContainerPreAndPostAbsent: true,
  });
}

function createOutputInputDescriptor(file) {
  return Object.freeze({
    absolutePath: file.absolutePath,
    sha256: file.sha256,
    byteLength: file.byteLength,
    device: file.device,
    inode: file.inode,
    parentChainSha256: file.parentChainSha256,
  });
}

function createCanonicalTranscript({
  brand,
  generatedAtUtc,
  completedAtUtc,
  laneId,
  source,
  runner,
  identityInput,
  genesisInput,
  identityEnvironment,
  dockerClient,
  dockerRuntime,
  image,
  toolchain,
  invocations,
  builds,
  equality,
  keyScan,
  cleanup,
}) {
  throw new Error("HERMETIC_MOUNT_CAUSALITY_UNPROVEN");
  /* c8 ignore start -- unreachable while the categorical B19 hold is active */
  if (brand !== CANONICAL_EXECUTION_BRAND) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PRIVATE_BRAND_REQUIRED");
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(completedAtUtc ?? "")
    || Date.parse(completedAtUtc) < Date.parse(generatedAtUtc)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_COMPLETION_TIME_INVALID");
  }
  const core = {
    schema: DISPOSABLE_DEVNET_EXECUTION_TRANSCRIPT_SCHEMA,
    status: DISPOSABLE_DEVNET_EXECUTION_STATUS,
    generatedAtUtc,
    completedAtUtc,
    laneId,
    scope: "DISPOSABLE_DEVNET_BUILD_EXECUTION_PROVENANCE_ONLY",
    source,
    runner,
    inputs: {
      identity: identityInput,
      genesis: genesisInput,
      environmentSha256: disposableDevnetExecutionCanonicalSha256(identityEnvironment),
    },
    docker: { client: dockerClient, runtime: dockerRuntime, image, toolchain, invocations },
    builds,
    equality,
    keyScan,
    cleanup,
    ready: false,
    blockers: [
      "DISPOSABLE_DEVNET_BEHAVIORAL_REHEARSAL_NOT_EXECUTED",
      "PRODUCTION_FINAL_BYTE_EVIDENCE_UNAVAILABLE",
      "MAINNET_HOLD",
    ],
    safety: { ...OFFICIAL_SAFETY },
  };
  const record = deepFreeze({
    ...core,
    transcriptSha256: disposableDevnetExecutionCanonicalSha256(core),
  });
  return record;
  /* c8 ignore stop */
}

function assertDirectInvocation() {
  const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
  if (invokedPath !== import.meta.url) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_DIRECT_RUNNER_PROCESS_REQUIRED");
  }
}

function parseExecutionArguments(argv) {
  if (argv.length !== 7
    || argv[0] !== "--execute"
    || argv[1] !== "--output-root"
    || argv[3] !== "--identity-input"
    || argv[5] !== "--genesis-input"
    || argv.some((value) => typeof value !== "string" || /[\r\n\0]/u.test(value))) {
    throw new Error(
      "USAGE: --execute --output-root <absolute-new-off-repo-directory> --identity-input <absolute-canonical-json> --genesis-input <absolute-canonical-json>",
    );
  }
  return Object.freeze({ outputRoot: argv[2], identityPath: argv[4], genesisPath: argv[6] });
}

function runCanonicalDisposableDevnetExecution({ brand, request, environment = process.env }) {
  if (brand !== CANONICAL_EXECUTION_BRAND) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_PRIVATE_BRAND_REQUIRED");
  }
  assertDirectInvocation();
  if (environment[DISPOSABLE_DEVNET_EXECUTION_GATE_ENVIRONMENT_VARIABLE]
    !== DISPOSABLE_DEVNET_EXECUTION_GATE_VALUE) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_EXPLICIT_GATE_REQUIRED");
  }
  const declaredHeadSha = environment.IAT_B3_EXACT_SOURCE_HEAD_SHA;
  if (!HEX_SHA1.test(declaredHeadSha ?? "")) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_EXACT_SOURCE_HEAD_REQUIRED");
  }
  // B19 categorical safety boundary. Host-side pathname observations cannot
  // prove which inode the Docker daemon mounted across start/attach. Do not
  // inspect paths, read inputs, create output/build roots, invoke a process, or
  // create a live-branded record until a same-container private-copy executor
  // and exact retained-file ledger are implemented and reviewed.
  if (HERMETIC_MOUNT_CAUSALITY_PROVEN !== true) {
    throw new Error("HERMETIC_MOUNT_CAUSALITY_UNPROVEN");
  }
  const output = validateOutputRoot(request.outputRoot);
  const hostRuntime = validateHostRuntime(environment);
  const dockerClient = validateDockerExecutable();
  const identityFile = readStableRegularFile(request.identityPath, {
    label: "DISPOSABLE_DEVNET_EXECUTION_IDENTITY_INPUT",
    maximumBytes: MAX_INPUT_BYTES,
    mustBeOutsideRepository: true,
  });
  const genesisFile = readStableRegularFile(request.genesisPath, {
    label: "DISPOSABLE_DEVNET_EXECUTION_GENESIS_INPUT",
    maximumBytes: MAX_INPUT_BYTES,
    mustBeOutsideRepository: true,
  });
  if (identityFile.absolutePath === genesisFile.absolutePath
    || (identityFile.device === genesisFile.device && identityFile.inode === genesisFile.inode)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_INPUT_PATH_OR_INODE_ALIAS_HOLD");
  }
  const identityRecord = parseCanonicalJsonInput(
    identityFile,
    "DISPOSABLE_DEVNET_EXECUTION_IDENTITY_INPUT",
  );
  const genesisRecord = parseCanonicalJsonInput(
    genesisFile,
    "DISPOSABLE_DEVNET_EXECUTION_GENESIS_INPUT",
  );
  if (identityRecord.laneId !== genesisRecord.laneId
    || identityRecord.generatedAtUtc !== genesisRecord.generatedAtUtc) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_INPUT_LANE_OR_GENERATION_TIME_MISMATCH_HOLD");
  }
  const laneId = identityRecord.laneId;
  const generatedAtUtc = new Date().toISOString();
  const sourceObservations = [observeExactSource(REPOSITORY_ROOT)];
  assertCleanSourceObservation({
    declaredHeadSha,
    observation: sourceObservations[0],
    index: 0,
  });
  const moduleClosure = validatePinnedExecutionModuleClosureAtHead(declaredHeadSha);
  const executedRunner = readStableRegularFile(RUNNER_PATH, {
    label: "DISPOSABLE_DEVNET_EXECUTION_EXECUTED_RUNNER",
    maximumBytes: 2 * 1024 * 1024,
  });
  const committedRunnerBytes = readExactCommittedFile(
    REPOSITORY_ROOT,
    declaredHeadSha,
    DISPOSABLE_DEVNET_EXECUTION_RUNNER_REPOSITORY_PATH,
  );
  const committedRunnerSha256 = sha256(committedRunnerBytes);
  if (executedRunner.sha256 !== committedRunnerSha256) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_EXECUTED_RUNNER_NOT_COMMITTED_HOLD");
  }

  let buildRoot = null;
  let stageRoot = null;
  let stagePromoted = false;
  const invocationRecords = [];
  let invocationOrdinal = 0;
  const nextOrdinal = () => {
    invocationOrdinal += 1;
    return invocationOrdinal;
  };
  try {
    buildRoot = createExactSourceBuildRoot({ prefix: BUILD_ROOT_PREFIX });
    const sourceSnapshot = loadExactDeclaredHeadSource({
      repositoryRoot: REPOSITORY_ROOT,
      buildRoot,
      declaredHeadSha,
    });
    const materializedSourceObservations = [observeMaterializedSourceSnapshot(sourceSnapshot)];
    if (sourceSnapshot.treeSha !== sourceObservations[0].treeSha
      || sourceSnapshot.schema !== COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_MATERIALIZED_SOURCE_BINDING_HOLD");
    }
    const forbiddenIdentities = collectCheckedInPublicIdentities(sourceSnapshot.root);
    validateDisposableDevnetIdentityInput(identityRecord, { forbiddenIdentities });
    validateDisposableDevnetGenesisInput(genesisRecord, { laneId });
    const identityEnvironment = createIdentityEnvironment(identityRecord, genesisRecord);

    stageRoot = createOutputStage(output);
    ensureDirectory(join(stageRoot, "logs"));
    ensureDirectory(join(stageRoot, "artifacts"));
    ensureDirectory(join(stageRoot, "inputs"));
    const sourceClosureCore = {
      schema: "iat-b3-disposable-devnet-materialized-source-closure/v1",
      declaredHeadSha,
      treeSha: sourceSnapshot.treeSha,
      mountedInputSha256: sourceSnapshot.mountedInputSha256,
      entries: sourceSnapshot.entries,
    };
    const sourceClosureSha256 = disposableDevnetExecutionCanonicalSha256(sourceClosureCore);
    const preservedSourceClosure = relativeFileDescriptor(
      writeExclusiveFile(
        join(stageRoot, "inputs", "materialized-source-closure.cjson"),
        Buffer.from(`${disposableDevnetExecutionCanonicalJson({
          ...sourceClosureCore,
          closureSha256: sourceClosureSha256,
        })}\n`, "utf8"),
      ),
      stageRoot,
    );
    const preservedIdentityInput = relativeFileDescriptor(
      writeExclusiveFile(join(stageRoot, "inputs", "disposable-identities.json"), identityFile.bytes),
      stageRoot,
    );
    const preservedGenesisInput = relativeFileDescriptor(
      writeExclusiveFile(join(stageRoot, "inputs", "devnet-genesis.json"), genesisFile.bytes),
      stageRoot,
    );
    const dockerConfigRoot = ensureDirectory(join(buildRoot, "docker-client-home"));
    const dockerEnvironment = safeDockerEnvironment({ dockerConfigRoot, declaredHeadSha });
    const dockerRuntimeObservations = [observePinnedDockerRuntime({
      dockerEnvironment,
      stageRoot,
      invocationRecords,
      nextOrdinal,
    })];
    const imageObservations = [inspectPinnedContainer({
      dockerEnvironment,
      stageRoot,
      invocationRecords,
      nextOrdinal,
    })];
    const toolchain = observePinnedToolchain({
      laneId,
      dockerEnvironment,
      stageRoot,
      invocationRecords,
      nextOrdinal,
      expectedImageId: imageObservations[0].localImageId,
    });
    sourceObservations.push(observeExactSource(REPOSITORY_ROOT));
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(sourceSnapshot));

    const builds = [];
    for (const ordinal of [1, 2]) {
      builds.push(executeBuildPair({
        sourceSnapshot,
        buildRoot,
        ordinal,
        laneId,
        identityEnvironment,
        dockerEnvironment,
        stageRoot,
        invocationRecords,
        nextOrdinal,
        expectedImageId: imageObservations[0].localImageId,
      }));
      sourceObservations.push(observeExactSource(REPOSITORY_ROOT));
      materializedSourceObservations.push(observeMaterializedSourceSnapshot(sourceSnapshot));
    }
    dockerRuntimeObservations.push(observePinnedDockerRuntime({
      dockerEnvironment,
      stageRoot,
      invocationRecords,
      nextOrdinal,
    }));
    imageObservations.push(inspectPinnedContainer({
      dockerEnvironment,
      stageRoot,
      invocationRecords,
      nextOrdinal,
    }));
    if (imageObservations[1].localImageId !== imageObservations[0].localImageId
      || imageObservations[1].inspectBytesSha256 !== imageObservations[0].inspectBytesSha256) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_PINNED_IMAGE_CHANGED_DURING_BUILDS_HOLD");
    }
    sourceObservations.push(observeExactSource(REPOSITORY_ROOT));
    materializedSourceObservations.push(observeMaterializedSourceSnapshot(sourceSnapshot));
    assertExactCleanSourceSequence({ declaredHeadSha, observations: sourceObservations });
    assertExactMaterializedSourceSequence({
      declaredHeadSha,
      observations: materializedSourceObservations,
    });
    const finalModuleClosure = validatePinnedExecutionModuleClosureAtHead(declaredHeadSha);
    if (finalModuleClosure.closureSha256 !== moduleClosure.closureSha256) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_MODULE_CLOSURE_CHANGED_DURING_BUILDS_HOLD");
    }
    const equality = assertDualBuildEquality(builds);
    const executionClosure = assertInvocationAndContainerClosure({
      invocationRecords,
      toolchain,
      builds,
    });
    const preservedKeyScan = scanDisposableDevnetBuildTreeForKeyMaterial(stageRoot);

    removeExactSourceBuildRoot(buildRoot);
    buildRoot = null;
    const cleanup = deepFreeze({
      processOwnedTemporaryBuildRootRemoved: true,
      dockerRunRmRequired: true,
      allContainerAbsenceProofsRequired: true,
      executionClosure,
      preservedOutputStageKeyScanPassed: true,
      preservedOutputStageKeyScanSha256: preservedKeyScan.closureSha256,
    });
    const transcript = createCanonicalTranscript({
      brand,
      generatedAtUtc,
      completedAtUtc: new Date().toISOString(),
      laneId,
      source: {
        declaredHeadSha,
        observedHeadSha: sourceObservations[0].headSha,
        observedTreeSha: sourceObservations[0].treeSha,
        cleanObservationCount: sourceObservations.length,
        materializationSchema: sourceSnapshot.schema,
        mountedInputSha256: sourceSnapshot.mountedInputSha256,
        materializedFileCount: sourceSnapshot.fileCount,
        materializedByteLength: sourceSnapshot.byteLength,
        materializedObservationCount: materializedSourceObservations.length,
        closureSha256: sourceClosureSha256,
        preservedClosure: preservedSourceClosure,
      },
      runner: {
        repositoryPath: DISPOSABLE_DEVNET_EXECUTION_RUNNER_REPOSITORY_PATH,
        executedSha256: executedRunner.sha256,
        committedSha256: committedRunnerSha256,
        exactCommittedBytes: true,
        moduleClosure,
        hostRuntime,
      },
      identityInput: {
        external: createOutputInputDescriptor(identityFile),
        preserved: preservedIdentityInput,
      },
      genesisInput: {
        external: createOutputInputDescriptor(genesisFile),
        preserved: preservedGenesisInput,
      },
      identityEnvironment,
      dockerClient: createOutputInputDescriptor(dockerClient),
      dockerRuntime: dockerRuntimeObservations,
      image: imageObservations,
      toolchain,
      invocations: invocationRecords,
      builds,
      equality,
      keyScan: {
        buildOne: builds[0].keyScan,
        buildTwo: builds[1].keyScan,
        preservedOutput: preservedKeyScan,
      },
      cleanup,
    });
    const transcriptBytes = Buffer.from(
      `${disposableDevnetExecutionCanonicalJson(transcript)}\n`,
      "utf8",
    );
    assertOutputStageStable(stageRoot);
    writeExclusiveFile(join(stageRoot, "transcript.json"), transcriptBytes);
    assertOutputStageStable(stageRoot);
    const transcriptReadback = readStableRegularFile(join(output.target, "transcript.json"), {
      label: "DISPOSABLE_DEVNET_EXECUTION_FINAL_TRANSCRIPT",
      maximumBytes: 8 * 1024 * 1024,
    });
    if (!transcriptReadback.bytes.equals(transcriptBytes)) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_FINAL_TRANSCRIPT_READBACK_HOLD");
    }
    assertOutputStageStable(stageRoot);
    PROCESS_CREATED_STAGES.delete(stageRoot);
    stagePromoted = true;
    return transcript;
  } finally {
    if (buildRoot !== null) removeExactSourceBuildRoot(buildRoot);
    if (stageRoot !== null && !stagePromoted) removeOutputStage(stageRoot);
  }
}

function runCli() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    process.stdout.write(`${JSON.stringify(createStaticHoldReport(), null, 2)}\n`);
    process.exitCode = 2;
    return;
  }
  try {
    const request = parseExecutionArguments(argv);
    if (process.env[DISPOSABLE_DEVNET_EXECUTION_GATE_ENVIRONMENT_VARIABLE]
      !== DISPOSABLE_DEVNET_EXECUTION_GATE_VALUE) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_EXPLICIT_GATE_REQUIRED");
    }
    const transcript = runCanonicalDisposableDevnetExecution({
      brand: CANONICAL_EXECUTION_BRAND,
      request,
    });
    const projection = assessDisposableDevnetExecutionProvenance(transcript);
    process.stdout.write(`${JSON.stringify({ transcript, projection }, null, 2)}\n`);
    process.exitCode = 2;
  } catch (error) {
    process.stdout.write(`${JSON.stringify(createStaticHoldReport(
      error instanceof Error ? error.message : String(error),
    ), null, 2)}\n`);
    process.exitCode = 2;
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) runCli();

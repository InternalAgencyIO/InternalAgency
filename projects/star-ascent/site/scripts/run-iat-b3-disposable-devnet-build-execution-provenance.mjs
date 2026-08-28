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
  "iat-b3-disposable-devnet-live-build-execution-transcript/v3";
export const DISPOSABLE_DEVNET_HERMETIC_EXECUTION_CONTRACT_SCHEMA =
  "iat-b3-disposable-devnet-hermetic-same-container-build-contract/v2";
export const DISPOSABLE_DEVNET_HERMETIC_FRAME_SCHEMA =
  "iat-b3-disposable-devnet-hermetic-same-container-frame/v1";
export const DISPOSABLE_DEVNET_RETAINED_FILE_LEDGER_SCHEMA =
  "iat-b3-disposable-devnet-retained-file-ledger/v1";
export const DISPOSABLE_DEVNET_OUTPUT_PROMOTION_SCHEMA =
  "iat-b3-disposable-devnet-output-stage-promotion/v1";
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
  version: "git version 2.55.0",
  sha256: "d4d2ba562243015206d4248edfec871a74786499292d00ed072dbca2f5ae8073",
  byteLength: 4_576_040,
});

const REPOSITORY_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const RUNNER_PATH = fileURLToPath(import.meta.url);
const PINNED_EXECUTION_MODULE_CLOSURE = Object.freeze([
  Object.freeze({
    repositoryPath: "projects/star-ascent/site/scripts/run-iat-b3-combined-law-reproducible-build.mjs",
    url: new URL("./run-iat-b3-combined-law-reproducible-build.mjs", import.meta.url),
    sha256: "de05316bce5a8d24fbd369c7214d9087517a131f0b977ff030cd973ef38941f3",
    byteLength: 161_351,
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
const nativeWslBuildModule = await import("./iat-b3-native-wsl-build-backend.mjs");
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
const { NATIVE_WSL_PINNED_TOOLCHAIN_POLICY } = nativeWslBuildModule;
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
const HERMETIC_PRIVATE_ROOT = "/iat-private";
const HERMETIC_PRIVATE_STORE_BYTES = 8 * 1024 * 1024 * 1024;
const HERMETIC_PRIVATE_TMPFS =
  `--tmpfs=${HERMETIC_PRIVATE_ROOT}:rw,nosuid,nodev,exec,size=${HERMETIC_PRIVATE_STORE_BYTES},uid=0,gid=0,mode=0755`;
const HERMETIC_BUILD_ROOT = "/iat-build";
const HERMETIC_BUILD_STORE_BYTES = 24 * 1024 * 1024 * 1024;
const HERMETIC_BUILD_TMPFS =
  `--tmpfs=${HERMETIC_BUILD_ROOT}:rw,nosuid,nodev,exec,size=${HERMETIC_BUILD_STORE_BYTES},uid=65534,gid=65534,mode=0700`;
const HERMETIC_INITIALIZATION_FRAME_PHASE = "PRIVATE_INPUT_CLOSURE_INITIALIZED";
const HERMETIC_FRAME_PHASES = Object.freeze([
  "PRIVATE_INPUT_CLOSURE_PRE_CARGO",
  "PRIVATE_INPUT_CLOSURE_POST_CARGO",
  "PRIVATE_ARTIFACT_EXPORTED",
]);
const MAX_INPUT_AGE_MILLISECONDS = 15 * 60 * 1000;
const MAX_FUTURE_SKEW_MILLISECONDS = 30 * 1000;
const KEY_SCAN_CONTENT_LIMIT = 1024 * 1024;
const PROCESS_CREATED_STAGES = new Map();
const PROCESS_CREATED_EXPORT_ROOTS = new Map();
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
  "HERMETIC_SAME_CONTAINER_EXECUTION_CONTRACT_NOT_INDEPENDENTLY_ACCEPTED",
  "PINNED_DOCKER_SOCKET_EXCLUSIVE_PRINCIPAL_NOT_PROVEN",
  "FINAL_RETAINED_FILE_LEDGER_NOT_INDEPENDENTLY_ACCEPTED",
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

const HERMETIC_LOCAL_BYTE_CLOSURE_CORE = {
  schema: "iat-b3-disposable-devnet-local-byte-toolchain-closure/v1",
  manifestEncoding:
    "TYPE_TAB_UTF8_PATH_BASE64_TAB_POSIX_MODE_TAB_BYTE_LENGTH_TAB_CONTENT_SHA256_OR_SYMLINK_BASE64_LF",
  manifestSort: "RAW_UTF8_PATH_BYTES_ASCENDING",
  versions: {
    rustc: RUSTC_VERSION,
    cargo: CARGO_VERSION,
    cargoBuildSbf: CARGO_BUILD_SBF_VERSION,
    solanaCargoBuildSbf: "3.1.10",
    platformTools: "1.52",
  },
  trees: {
    rustToolchain: {
      mountTarget: "/iat-host/rust-toolchain",
      privateTarget: "/iat-private/home/a/.rustup/toolchains/1.97.1-x86_64-unknown-linux-gnu",
      manifestSha256: "5d4b1a80279f8169ff7f7fb2dea8535e9498ab4e5cd5914a9ca0390dfe4a14b9",
      manifestByteLength: 24_678,
      entryCount: 188,
      fileCount: 166,
      directoryCount: 22,
      symlinkCount: 0,
      byteLength: 653_573_351,
      nativeObservationSha256: NATIVE_WSL_PINNED_TOOLCHAIN_POLICY.sha256.rustToolchainTree,
    },
    solanaRelease: {
      mountTarget: "/iat-host/solana-release",
      privateTarget: "/iat-private/home/a/.local/share/solana/install/releases/3.1.10/solana-release",
      manifestSha256: "7c60c723f9b74f734ca4f6caf46565b54bf8f65527d3680f5784c14b79903a3f",
      manifestByteLength: 12_446,
      entryCount: 104,
      fileCount: 87,
      directoryCount: 15,
      symlinkCount: 2,
      byteLength: 419_506_102,
      cargoBuildSbfSha256: NATIVE_WSL_PINNED_TOOLCHAIN_POLICY.sha256.cargoBuildSbf,
    },
    platformTools: {
      mountTarget: "/iat-host/platform-tools",
      privateTarget: "/iat-private/home/a/.cache/solana/v1.52/platform-tools",
      manifestSha256: "f879ef69841177c086891ed5c4291eddac14580698c4f37d8eae9c556e30bdaf",
      manifestByteLength: 560_692,
      entryCount: 3_828,
      fileCount: 3_198,
      directoryCount: 618,
      symlinkCount: 12,
      byteLength: 1_663_263_438,
      nativeObservationSha256: NATIVE_WSL_PINNED_TOOLCHAIN_POLICY.sha256.platformToolsTree,
    },
    criterion: {
      mountTarget: "/iat-host/criterion",
      privateTarget: "/iat-private/home/a/.cache/solana/v2.3.3/criterion",
      manifestSha256: "9c5cc9c7135f8984eef0ffa9725732e292bc446840a6ad6b815d388d208508d9",
      manifestByteLength: 3_982,
      entryCount: 38,
      fileCount: 30,
      directoryCount: 6,
      symlinkCount: 2,
      byteLength: 2_201_370,
    },
    registryCache: {
      mountTarget: "/iat-host/registry-cache",
      privateTarget: "/iat-private/home/a/.cargo/registry/cache",
      manifestSha256: "02b7a46d4d16cb4a573fccd96e628dce07ae6e31037fd67964acf44345110b75",
      manifestByteLength: 326_800,
      entryCount: 2_092,
      fileCount: 2_090,
      directoryCount: 2,
      symlinkCount: 0,
      byteLength: 234_988_779,
    },
    registryIndex: {
      mountTarget: "/iat-host/registry-index",
      privateTarget: "/iat-private/home/a/.cargo/registry/index",
      manifestSha256: "73f669e18accdd5134e94d6781016ecaab17c152b005e6620b7e7cd0503b5ec6",
      manifestByteLength: 292_553,
      entryCount: 2_376,
      fileCount: 1_460,
      directoryCount: 916,
      symlinkCount: 0,
      byteLength: 179_474_589,
    },
  },
  cargoLockClosure: {
    lockSha256: "9cdf2e9bb6b618c993dd482e6b5e2558359826e2aff0a80eb1b62957d2578d84",
    sourcePolicy: "CARGO_LOCK_REGISTRY_CHECKSUMS_AND_FRESH_ARCHIVE_EXTRACTION",
    packageCount: 229,
    packagesSha256: "d9c69702259270a6e9a9263ef92f6226d97aff98d997d437b1695640cceb47cf",
    bindingSha256: "8a447110f4aed5dae2c1c1b592cb441a8270eba97b51284cd76b8912a46a3e3f",
  },
};

export const PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE = deepFreeze({
  ...HERMETIC_LOCAL_BYTE_CLOSURE_CORE,
  closureSha256: disposableDevnetExecutionCanonicalSha256(HERMETIC_LOCAL_BYTE_CLOSURE_CORE),
});

const LAW_HERMETIC_RECIPE_SHA256 = disposableDevnetExecutionCanonicalSha256(
  PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
);
const ECONOMY_HERMETIC_RECIPE_SHA256 = disposableDevnetExecutionCanonicalSha256(
  ECONOMY_SBF_BUILD_RECIPE,
);
const HERMETIC_LOCAL_BYTE_HOST_ROOTS = Object.freeze({
  rustToolchain: NATIVE_WSL_PINNED_TOOLCHAIN_POLICY.paths.rustToolchainRoot,
  solanaRelease: NATIVE_WSL_PINNED_TOOLCHAIN_POLICY.paths.solanaReleaseRoot,
  platformTools: NATIVE_WSL_PINNED_TOOLCHAIN_POLICY.paths.platformToolsRoot,
  criterion: join(
    dirname(dirname(NATIVE_WSL_PINNED_TOOLCHAIN_POLICY.paths.platformToolsRoot)),
    "v2.3.3",
    "criterion",
  ),
  registryCache: NATIVE_WSL_PINNED_TOOLCHAIN_POLICY.paths.registryCacheRoot,
  registryIndex: NATIVE_WSL_PINNED_TOOLCHAIN_POLICY.paths.registryIndexRoot,
});

export const DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_SCRIPT = [
  "set -euo pipefail",
  "umask 077",
  "fail() { /usr/bin/printf 'IAT_B3_HERMETIC_INITIALIZER_HOLD:%s\\n' \"$1\" >&2; exit 96; }",
  "[[ \"$(/usr/bin/id -u):$(/usr/bin/id -g)\" == 0:0 ]] || fail ROOT_IDENTITY",
  "[[ -d /iat-private && -z \"$(/usr/bin/find /iat-private -mindepth 1 -print -quit)\" ]] || fail PRIVATE_ROOT_NOT_EMPTY",
  "/usr/bin/mkdir -p -m 0700 /iat-private/home/a/.iat-ledger /iat-private/home/a/iat-source",
  "copy_tree() {",
  "  local source=\"$1\" destination=\"$2\"; [[ -d \"$source\" ]] || fail COPY_SOURCE",
  "  /usr/bin/mkdir -p -m 0700 \"$destination\"",
  "  [[ -z \"$(/usr/bin/find \"$destination\" -mindepth 1 -print -quit)\" ]] || fail COPY_DESTINATION_NOT_EMPTY",
  "  /usr/bin/cp -a --no-preserve=ownership --reflink=never -- \"$source/.\" \"$destination/\"",
  "}",
  "manifest_tree() {",
  "  local root=\"$1\" output=\"$2\" scope=\"$3\" list=\"$2.list\" sorted=\"$2.sorted\"",
  "  [[ -d \"$root\" ]] || fail MANIFEST_ROOT; : > \"$output\"",
  "  /usr/bin/find \"$root\" -mindepth 1 -printf '%P\\0' > \"$list\"; LC_ALL=C /usr/bin/sort -z \"$list\" > \"$sorted\"",
  "  while IFS= read -r -d '' relative_path; do",
  "    local path=\"$root/$relative_path\" type mode size content target resolved links",
  "    mode=\"$(/usr/bin/stat -c '%a' -- \"$path\")\"",
  "    if [[ -L \"$path\" ]]; then type=L; target=\"$(/usr/bin/readlink -- \"$path\")\"; size=\"$(/usr/bin/stat -c '%s' -- \"$path\")\"; content=\"$(/usr/bin/printf '%s' \"$target\" | /usr/bin/base64 -w0)\";",
  "      if [[ \"$scope\" == private ]]; then resolved=\"$(/usr/bin/readlink -f -- \"$path\")\" || fail PRIVATE_SYMLINK; [[ \"$resolved\" == /iat-private/* ]] || fail PRIVATE_SYMLINK_ESCAPE; fi",
  "    elif [[ -d \"$path\" ]]; then type=D; size=0; content=-",
  "    elif [[ -f \"$path\" ]]; then type=F; links=\"$(/usr/bin/stat -c '%h' -- \"$path\")\"; [[ \"$links\" == 1 ]] || fail HARDLINK; size=\"$(/usr/bin/stat -c '%s' -- \"$path\")\"; content=\"$(/usr/bin/sha256sum -- \"$path\")\"; content=\"${content%% *}\"",
  "    else fail NONREGULAR; fi",
  "    /usr/bin/printf '%s\\t%s\\t%s\\t%s\\t%s\\n' \"$type\" \"$(/usr/bin/printf '%s' \"$relative_path\" | /usr/bin/base64 -w0)\" \"$mode\" \"$size\" \"$content\" >> \"$output\"",
  "  done < \"$sorted\"; /usr/bin/rm -f -- \"$list\" \"$sorted\"",
  "}",
  "copy_tree /iat-host/source /iat-private/home/a/iat-source",
  ...Object.values(PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE.trees).map(
    (value) => `copy_tree ${value.mountTarget} ${value.privateTarget}`,
  ),
  "manifest_tree /iat-host/source /iat-private/home/a/.iat-ledger/source.host host",
  "manifest_tree /iat-private/home/a/iat-source /iat-private/home/a/.iat-ledger/source.private private",
  "/usr/bin/cmp -s /iat-private/home/a/.iat-ledger/source.host /iat-private/home/a/.iat-ledger/source.private || fail SOURCE_COPY",
  "source_sha=\"$(/usr/bin/sha256sum /iat-private/home/a/.iat-ledger/source.private)\"; source_sha=\"${source_sha%% *}\"; [[ \"$source_sha\" == \"$IAT_B3_HERMETIC_SOURCE_MANIFEST_SHA256\" ]] || fail SOURCE_MANIFEST",
  ...Object.entries(PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE.trees).flatMap(
    ([key, value]) => [
      `manifest_tree ${value.mountTarget} /iat-private/home/a/.iat-ledger/${key}.host host`,
      `manifest_tree ${value.privateTarget} /iat-private/home/a/.iat-ledger/${key}.private private`,
      `/usr/bin/cmp -s /iat-private/home/a/.iat-ledger/${key}.host /iat-private/home/a/.iat-ledger/${key}.private || fail ${key.toUpperCase()}_COPY`,
      `${key}_sha="$(/usr/bin/sha256sum /iat-private/home/a/.iat-ledger/${key}.private)"; ${key}_sha="\${${key}_sha%% *}"; [[ "$${key}_sha" == '${value.manifestSha256}' ]] || fail ${key.toUpperCase()}_MANIFEST`,
    ],
  ),
  "/usr/bin/chown -R 0:0 /iat-private/home/a",
  "/usr/bin/chmod -R go-w /iat-private/home/a",
  "/usr/bin/chmod 0555 /iat-private/home/a /iat-private/home/a/iat-source /iat-private/home/a/.rustup /iat-private/home/a/.rustup/toolchains /iat-private/home/a/.rustup/toolchains/1.97.1-x86_64-unknown-linux-gnu /iat-private/home/a/.local /iat-private/home/a/.local/share /iat-private/home/a/.local/share/solana /iat-private/home/a/.local/share/solana/install /iat-private/home/a/.local/share/solana/install/releases /iat-private/home/a/.local/share/solana/install/releases/3.1.10 /iat-private/home/a/.local/share/solana/install/releases/3.1.10/solana-release /iat-private/home/a/.cache /iat-private/home/a/.cache/solana /iat-private/home/a/.cache/solana/v1.52 /iat-private/home/a/.cache/solana/v1.52/platform-tools /iat-private/home/a/.cache/solana/v2.3.3 /iat-private/home/a/.cache/solana/v2.3.3/criterion /iat-private/home/a/.cargo /iat-private/home/a/.cargo/registry /iat-private/home/a/.cargo/registry/cache /iat-private/home/a/.cargo/registry/index",
  "[[ -z \"$(/usr/bin/find /iat-private/home/a -type d \\( ! -user root -o ! -group root -o -perm /0022 \\) -print -quit)\" ]] || fail DIRECTORY_OWNERSHIP_OR_MODE",
  "[[ -z \"$(/usr/bin/find /iat-private/home/a -type f \\( ! -user root -o ! -group root -o -perm /0022 -o -links +1 \\) -print -quit)\" ]] || fail FILE_OWNERSHIP_MODE_OR_LINK",
  "while IFS= read -r -d '' link; do resolved=\"$(/usr/bin/readlink -f -- \"$link\")\" || fail PRIVATE_SYMLINK; [[ \"$resolved\" == /iat-private/* ]] || fail PRIVATE_SYMLINK_ESCAPE; done < <(/usr/bin/find /iat-private/home/a -type l -print0)",
  "/usr/bin/printf '%s\\n' 'IAT_B3_HERMETIC_PRIVATE_INPUTS_READY_V2' > /iat-private/.ready.tmp",
  "/usr/bin/chown 0:0 /iat-private/.ready.tmp; /usr/bin/chmod 0444 /iat-private/.ready.tmp",
  "/usr/bin/mv -T /iat-private/.ready.tmp /iat-private/.ready",
  "/usr/bin/printf '{\"contractSha256\":\"%s\",\"kind\":\"%s\",\"laneId\":\"%s\",\"ordinal\":%s,\"phase\":\"PRIVATE_INPUT_CLOSURE_INITIALIZED\",\"schema\":\"iat-b3-disposable-devnet-hermetic-same-container-frame/v1\"}\\n' \"$IAT_B3_HERMETIC_CONTRACT_SHA256\" \"$IAT_B3_HERMETIC_KIND\" \"$IAT_B3_HERMETIC_LANE_ID\" \"$IAT_B3_HERMETIC_ORDINAL\"",
  "trap 'exit 0' TERM INT",
  "/usr/bin/tail -f /dev/null & wait $!",
].join("\n");

export const DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_SHA256 = sha256(
  Buffer.from(DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_SCRIPT, "utf8"),
);

export const DISPOSABLE_DEVNET_HERMETIC_CONTAINER_WRAPPER_SCRIPT = [
  "set -euo pipefail",
  "umask 077",
  "fail() { /usr/bin/printf 'IAT_B3_HERMETIC_WRAPPER_HOLD:%s\\n' \"$1\" >&2; exit 97; }",
  "require_hex() { [[ \"${!1:-}\" =~ ^[0-9a-f]{64}$ ]] || fail \"$1\"; }",
  "require_hex IAT_B3_HERMETIC_CONTRACT_SHA256",
  "require_hex IAT_B3_HERMETIC_SOURCE_MANIFEST_SHA256",
  "require_hex IAT_B3_HERMETIC_SOURCE_MOUNTED_INPUT_SHA256",
  "require_hex IAT_B3_HERMETIC_RECIPE_SHA256",
  "require_hex IAT_B3_HERMETIC_TOOLCHAIN_CLOSURE_SHA256",
  "[[ \"${IAT_B3_HERMETIC_LANE_ID:-}\" =~ ^b15-devnet-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{16}$ ]] || fail LANE",
  "[[ \"${IAT_B3_HERMETIC_ORDINAL:-}\" =~ ^[12]$ ]] || fail ORDINAL",
  "[[ \"${IAT_B3_HERMETIC_KIND:-}\" =~ ^(law|economy)$ ]] || fail KIND",
  "[[ \"${IAT_B3_EXACT_SOURCE_HEAD_SHA:-}\" =~ ^[0-9a-f]{40}$ ]] || fail HEAD",
  "[[ \"$IAT_B3_HERMETIC_TOOLCHAIN_CLOSURE_SHA256\" == "
    + `'${PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE.closureSha256}' ]] || fail TOOLCHAIN_BINDING`,
  "[[ \"$(/usr/bin/id -u):$(/usr/bin/id -g)\" == 65534:65534 ]] || fail BUILD_IDENTITY",
  "for ((ready_wait=0; ready_wait<1800; ready_wait+=1)); do [[ -f /iat-private/.ready ]] && break; /usr/bin/sleep 1; done",
  "[[ \"$(/usr/bin/cat /iat-private/.ready)\" == IAT_B3_HERMETIC_PRIVATE_INPUTS_READY_V2 ]] || fail PRIVATE_INPUTS_NOT_READY",
  "[[ -d /iat-private/home/a && -d /iat-build ]] || fail PRIVATE_ROOT",
  "[[ -z \"$(/usr/bin/find /iat-private/home/a -type d \\( ! -user root -o ! -group root -o -perm /0022 \\) -print -quit)\" ]] || fail DIRECTORY_OWNERSHIP_OR_MODE",
  "[[ -z \"$(/usr/bin/find /iat-private/home/a -type f \\( ! -user root -o ! -group root -o -perm /0022 -o -links +1 \\) -print -quit)\" ]] || fail FILE_OWNERSHIP_MODE_OR_LINK",
  "/usr/bin/mkdir -m 0700 /iat-build/.iat-ledger /iat-build/target /iat-build/output /iat-build/tmp /iat-build/home /iat-build/cargo-home",
  "manifest_tree() {",
  "  local root=\"$1\" output=\"$2\" scope=\"$3\" list=\"$2.list\" sorted=\"$2.sorted\"",
  "  [[ -d \"$root\" ]] || fail MANIFEST_ROOT",
  "  : > \"$output\"",
  "  /usr/bin/find \"$root\" -mindepth 1 -printf '%P\\0' > \"$list\"",
  "  LC_ALL=C /usr/bin/sort -z \"$list\" > \"$sorted\"",
  "  while IFS= read -r -d '' relative_path; do",
  "    local path=\"$root/$relative_path\" type mode size content target resolved links",
  "    mode=\"$(/usr/bin/stat -c '%a' -- \"$path\")\"",
  "    if [[ -L \"$path\" ]]; then",
  "      type=L; target=\"$(/usr/bin/readlink -- \"$path\")\"; size=\"$(/usr/bin/stat -c '%s' -- \"$path\")\"",
  "      content=\"$(/usr/bin/printf '%s' \"$target\" | /usr/bin/base64 -w0)\"",
  "      if [[ \"$scope\" == private ]]; then",
  "        resolved=\"$(/usr/bin/readlink -f -- \"$path\")\" || fail PRIVATE_SYMLINK",
  "        [[ \"$resolved\" == /iat-private/* ]] || fail PRIVATE_SYMLINK_ESCAPE",
  "      fi",
  "    elif [[ -d \"$path\" ]]; then type=D; size=0; content=-",
  "    elif [[ -f \"$path\" ]]; then",
  "      type=F; links=\"$(/usr/bin/stat -c '%h' -- \"$path\")\"; [[ \"$links\" == 1 ]] || fail HARDLINK",
  "      size=\"$(/usr/bin/stat -c '%s' -- \"$path\")\"; content=\"$(/usr/bin/sha256sum -- \"$path\")\"; content=\"${content%% *}\"",
  "    else fail NONREGULAR; fi",
  "    /usr/bin/printf '%s\\t%s\\t%s\\t%s\\t%s\\n' \"$type\" \"$(/usr/bin/printf '%s' \"$relative_path\" | /usr/bin/base64 -w0)\" \"$mode\" \"$size\" \"$content\" >> \"$output\"",
  "  done < \"$sorted\"",
  "  /usr/bin/rm -f -- \"$list\" \"$sorted\"",
  "}",
  "copy_tree() {",
  "  local source=\"$1\" destination=\"$2\"; [[ -d \"$source\" ]] || fail COPY_SOURCE",
  "  /usr/bin/mkdir -p -m 0700 \"$destination\"",
  "  [[ -z \"$(/usr/bin/find \"$destination\" -mindepth 1 -print -quit)\" ]] || fail COPY_DESTINATION_NOT_EMPTY",
  "  /usr/bin/cp -a --no-preserve=ownership --reflink=never -- \"$source/.\" \"$destination/\"",
  "}",
  "manifest_tree /iat-private/home/a/iat-source /iat-build/.iat-ledger/source.private.pre private",
  "source_pre=\"$(/usr/bin/sha256sum /iat-build/.iat-ledger/source.private.pre)\"; source_pre=\"${source_pre%% *}\"",
  "[[ \"$source_pre\" == \"$IAT_B3_HERMETIC_SOURCE_MANIFEST_SHA256\" ]] || fail SOURCE_MANIFEST",
  ...Object.entries(PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE.trees).flatMap(
    ([key, value]) => [
      `manifest_tree ${value.privateTarget} /iat-build/.iat-ledger/${key}.private.pre private`,
      `${key}_pre="$(/usr/bin/sha256sum /iat-build/.iat-ledger/${key}.private.pre)"; ${key}_pre="\${${key}_pre%% *}"`,
      `[[ "$${key}_pre" == '${value.manifestSha256}' ]] || fail ${key.toUpperCase()}_MANIFEST`,
    ],
  ),
  "manifest_tree /iat-private/home/a/iat-source /iat-build/.iat-ledger/source.private.build private",
  "/usr/bin/cmp -s /iat-build/.iat-ledger/source.private.pre /iat-build/.iat-ledger/source.private.build || fail SOURCE_PERMISSION_DRIFT",
  ...Object.entries(PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE.trees).map(
    ([key, value]) => `manifest_tree ${value.privateTarget} /iat-build/.iat-ledger/${key}.private.build private`,
  ),
  "/usr/bin/mkdir -p -m 0700 /iat-build/home/.cache/solana/v1.52 /iat-build/home/.cache/solana/v2.3.3 /iat-build/cargo-home/registry/src /iat-build/cargo-home/git",
  "/usr/bin/ln -s /iat-private/home/a/.cache/solana/v1.52/platform-tools /iat-build/home/.cache/solana/v1.52/platform-tools",
  "/usr/bin/ln -s /iat-private/home/a/.cache/solana/v2.3.3/criterion /iat-build/home/.cache/solana/v2.3.3/criterion",
  "/usr/bin/ln -s /iat-private/home/a/.cargo/registry/cache /iat-build/cargo-home/registry/cache",
  "/usr/bin/ln -s /iat-private/home/a/.cargo/registry/index /iat-build/cargo-home/registry/index",
  "export HOME=/iat-build/home CARGO_HOME=/iat-build/cargo-home RUSTUP_HOME=/iat-private/home/a/.rustup TMPDIR=/iat-build/tmp CARGO_NET_OFFLINE=true CARGO_INCREMENTAL=0 RUSTUP_TOOLCHAIN=1.97.1-x86_64-unknown-linux-gnu LANG=C.UTF-8 LC_ALL=C.UTF-8 TZ=UTC",
  "export PATH=/iat-private/home/a/.rustup/toolchains/1.97.1-x86_64-unknown-linux-gnu/bin:/iat-private/home/a/.local/share/solana/install/releases/3.1.10/solana-release/bin:/usr/bin:/bin",
  "case \"$IAT_B3_HERMETIC_KIND\" in",
  `  law) [[ "$IAT_B3_HERMETIC_RECIPE_SHA256" == '${LAW_HERMETIC_RECIPE_SHA256}' ]] || fail LAW_RECIPE; output_name=iat_b3_law.so ;;`,
  `  economy) [[ "$IAT_B3_HERMETIC_RECIPE_SHA256" == '${ECONOMY_HERMETIC_RECIPE_SHA256}' ]] || fail ECONOMY_RECIPE; output_name=iat_b3_economy.so ;;`,
  "esac",
  "/usr/bin/printf '{\"contractSha256\":\"%s\",\"kind\":\"%s\",\"laneId\":\"%s\",\"ordinal\":%s,\"phase\":\"PRIVATE_INPUT_CLOSURE_PRE_CARGO\",\"recipeSha256\":\"%s\",\"schema\":\"iat-b3-disposable-devnet-hermetic-same-container-frame/v1\",\"sourceManifestSha256\":\"%s\",\"toolchainClosureSha256\":\"%s\"}\\n' \"$IAT_B3_HERMETIC_CONTRACT_SHA256\" \"$IAT_B3_HERMETIC_KIND\" \"$IAT_B3_HERMETIC_LANE_ID\" \"$IAT_B3_HERMETIC_ORDINAL\" \"$IAT_B3_HERMETIC_RECIPE_SHA256\" \"$source_pre\" \"$IAT_B3_HERMETIC_TOOLCHAIN_CLOSURE_SHA256\"",
  "cd /iat-private/home/a/iat-source",
  "set +e",
  "if [[ \"$IAT_B3_HERMETIC_KIND\" == law ]]; then",
  "  /iat-private/home/a/.rustup/toolchains/1.97.1-x86_64-unknown-linux-gnu/bin/cargo build-sbf --manifest-path projects/star-ascent/site/programs/iat_b3_law/Cargo.toml --sbf-out-dir /iat-build/output --arch v0 --no-default-features --features production-combined-hook --optimize-size --offline --skip-tools-install --tools-version v1.52 -- --locked --target-dir /iat-build/target 1>&2 2>&2",
  "else",
  "  /iat-private/home/a/.rustup/toolchains/1.97.1-x86_64-unknown-linux-gnu/bin/cargo build-sbf --manifest-path projects/star-ascent/site/programs/iat_b3_economy/Cargo.toml --sbf-out-dir /iat-build/output --arch v0 --no-default-features --features runtime-production-entrypoint --optimize-size --offline --skip-tools-install --tools-version v1.52 -- --locked --target-dir /iat-build/target 1>&2 2>&2",
  "fi",
  "cargo_status=$?; set -e; [[ \"$cargo_status\" == 0 ]] || fail CARGO",
  "manifest_tree /iat-private/home/a/iat-source /iat-build/.iat-ledger/source.private.post private",
  "/usr/bin/cmp -s /iat-build/.iat-ledger/source.private.build /iat-build/.iat-ledger/source.private.post || fail SOURCE_POST_CARGO",
  ...Object.entries(PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE.trees).flatMap(
    ([key, value]) => [
      `manifest_tree ${value.privateTarget} /iat-build/.iat-ledger/${key}.private.post private`,
      `/usr/bin/cmp -s /iat-build/.iat-ledger/${key}.private.build /iat-build/.iat-ledger/${key}.private.post || fail ${key.toUpperCase()}_POST_CARGO`,
    ],
  ),
  "/usr/bin/printf '{\"contractSha256\":\"%s\",\"kind\":\"%s\",\"laneId\":\"%s\",\"ordinal\":%s,\"phase\":\"PRIVATE_INPUT_CLOSURE_POST_CARGO\",\"recipeSha256\":\"%s\",\"schema\":\"iat-b3-disposable-devnet-hermetic-same-container-frame/v1\",\"sourceManifestSha256\":\"%s\",\"toolchainClosureSha256\":\"%s\"}\\n' \"$IAT_B3_HERMETIC_CONTRACT_SHA256\" \"$IAT_B3_HERMETIC_KIND\" \"$IAT_B3_HERMETIC_LANE_ID\" \"$IAT_B3_HERMETIC_ORDINAL\" \"$IAT_B3_HERMETIC_RECIPE_SHA256\" \"$source_pre\" \"$IAT_B3_HERMETIC_TOOLCHAIN_CLOSURE_SHA256\"",
  "artifact=/iat-build/output/$output_name; [[ -f \"$artifact\" && ! -L \"$artifact\" ]] || fail ARTIFACT",
  "/usr/bin/chmod 0444 \"$artifact\"",
  "[[ \"$(/usr/bin/stat -c '%h' -- \"$artifact\")\" == 1 ]] || fail ARTIFACT_HARDLINK",
  "artifact_sha=\"$(/usr/bin/sha256sum -- \"$artifact\")\"; artifact_sha=\"${artifact_sha%% *}\"; artifact_size=\"$(/usr/bin/stat -c '%s' -- \"$artifact\")\"",
  "[[ \"$artifact_size\" -ge 1024 ]] || fail ARTIFACT_SIZE",
  "exported=/iat-host/export/$output_name; [[ ! -e \"$exported\" && ! -L \"$exported\" ]] || fail EXPORT_NOT_EMPTY",
  "set -o noclobber; exec 3> \"$exported\"; set +o noclobber",
  "/usr/bin/cat -- \"$artifact\" >&3; exec 3>&-; /usr/bin/chmod 0444 \"$exported\"",
  "[[ \"$(/usr/bin/stat -c '%h' -- \"$exported\")\" == 1 && \"$(/usr/bin/stat -c '%a' -- \"$exported\")\" == 444 && \"$(/usr/bin/stat -c '%u:%g' -- \"$exported\")\" == 65534:65534 ]] || fail EXPORTED_ARTIFACT_BOUNDARY",
  "exported_sha=\"$(/usr/bin/sha256sum -- \"$exported\")\"; exported_sha=\"${exported_sha%% *}\"; exported_size=\"$(/usr/bin/stat -c '%s' -- \"$exported\")\"",
  "artifact_sha_after=\"$(/usr/bin/sha256sum -- \"$artifact\")\"; artifact_sha_after=\"${artifact_sha_after%% *}\"; artifact_size_after=\"$(/usr/bin/stat -c '%s' -- \"$artifact\")\"",
  "[[ \"$artifact_sha\" == \"$artifact_sha_after\" && \"$artifact_sha\" == \"$exported_sha\" && \"$artifact_size\" == \"$artifact_size_after\" && \"$artifact_size\" == \"$exported_size\" ]] || fail ARTIFACT_EXPORT",
  "/usr/bin/printf '{\"artifactByteLength\":%s,\"artifactSha256\":\"%s\",\"cargoExitStatus\":0,\"contractSha256\":\"%s\",\"kind\":\"%s\",\"laneId\":\"%s\",\"ordinal\":%s,\"phase\":\"PRIVATE_ARTIFACT_EXPORTED\",\"recipeSha256\":\"%s\",\"schema\":\"iat-b3-disposable-devnet-hermetic-same-container-frame/v1\",\"sourceManifestSha256\":\"%s\",\"toolchainClosureSha256\":\"%s\"}\\n' \"$artifact_size\" \"$artifact_sha\" \"$IAT_B3_HERMETIC_CONTRACT_SHA256\" \"$IAT_B3_HERMETIC_KIND\" \"$IAT_B3_HERMETIC_LANE_ID\" \"$IAT_B3_HERMETIC_ORDINAL\" \"$IAT_B3_HERMETIC_RECIPE_SHA256\" \"$source_pre\" \"$IAT_B3_HERMETIC_TOOLCHAIN_CLOSURE_SHA256\"",
].join("\n");

export const DISPOSABLE_DEVNET_HERMETIC_WRAPPER_SHA256 = sha256(
  Buffer.from(DISPOSABLE_DEVNET_HERMETIC_CONTAINER_WRAPPER_SCRIPT, "utf8"),
);

function assertCanonicalLinuxAbsolutePath(path, label) {
  if (typeof path !== "string" || !path.startsWith("/") || path === "/"
    || /[\r\n\0,]/u.test(path)
    || path.includes("//")
    || path.split("/").some((part, index) => index > 0 && ["", ".", ".."].includes(part))) {
    throw new Error(`${label}_CANONICAL_LINUX_ABSOLUTE_PATH_REQUIRED`);
  }
  return path;
}

function sourceManifestRecords(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_SOURCE_ENTRIES_REQUIRED");
  }
  const byPath = new Map();
  const directories = new Set();
  for (const entry of entries) {
    if (!hasExactKeys(entry, [
      "path", "gitMode", "gitObjectSha1", "byteLength", "sha256", "lfsPointer",
    ])
      || typeof entry.path !== "string" || entry.path.length === 0
      || entry.path.startsWith("/") || entry.path.includes("\\")
      || /[\r\n\0]/u.test(entry.path)
      || entry.path.split("/").some((part) => ["", ".", ".."].includes(part))
      || !["100644", "100755"].includes(entry.gitMode)
      || !HEX_SHA1.test(entry.gitObjectSha1 ?? "")
      || !/^[0-9a-f]{64}$/u.test(entry.sha256 ?? "")
      || !Number.isSafeInteger(entry.byteLength) || entry.byteLength < 0
      || typeof entry.lfsPointer !== "boolean"
      || byPath.has(entry.path)) {
      throw new Error("DISPOSABLE_DEVNET_HERMETIC_SOURCE_ENTRY_INVALID");
    }
    byPath.set(entry.path, Object.freeze({
      type: "F",
      path: entry.path,
      mode: entry.gitMode === "100755" ? "555" : "444",
      byteLength: entry.byteLength,
      content: entry.sha256,
    }));
    const parts = entry.path.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      directories.add(parts.slice(0, index).join("/"));
    }
  }
  for (const path of directories) {
    if (byPath.has(path)) throw new Error("DISPOSABLE_DEVNET_HERMETIC_SOURCE_PATH_ALIAS_HOLD");
    byPath.set(path, Object.freeze({ type: "D", path, mode: "555", byteLength: 0, content: "-" }));
  }
  return [...byPath.values()].sort((left, right) => (
    Buffer.compare(Buffer.from(left.path, "utf8"), Buffer.from(right.path, "utf8"))
  ));
}

export function createDisposableDevnetHermeticSourceManifest(entries) {
  const records = sourceManifestRecords(entries);
  const bytes = Buffer.from(records.map((record) => [
    record.type,
    Buffer.from(record.path, "utf8").toString("base64"),
    record.mode,
    record.byteLength,
    record.content,
  ].join("\t")).join("\n") + "\n", "utf8");
  return deepFreeze({
    schema: "iat-b3-disposable-devnet-hermetic-tree-manifest/v1",
    sha256: sha256(bytes),
    byteLength: bytes.length,
    entryCount: records.length,
    fileCount: records.filter(({ type }) => type === "F").length,
    directoryCount: records.filter(({ type }) => type === "D").length,
    sourceByteLength: records.filter(({ type }) => type === "F")
      .reduce((total, { byteLength }) => total + byteLength, 0),
  });
}

const HERMETIC_LOCAL_BYTE_ROOT_KEYS = Object.freeze(
  Object.keys(PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE.trees),
);
const HERMETIC_ENVIRONMENT_NAMES = Object.freeze([
  "IAT_B3_EXACT_SOURCE_HEAD_SHA",
  "IAT_B3_HERMETIC_CONTRACT_SHA256",
  "IAT_B3_HERMETIC_KIND",
  "IAT_B3_HERMETIC_LANE_ID",
  "IAT_B3_HERMETIC_ORDINAL",
  "IAT_B3_HERMETIC_RECIPE_SHA256",
  "IAT_B3_HERMETIC_SOURCE_MANIFEST_SHA256",
  "IAT_B3_HERMETIC_SOURCE_MOUNTED_INPUT_SHA256",
  "IAT_B3_HERMETIC_TOOLCHAIN_CLOSURE_SHA256",
  ...REQUIRED_IDENTITY_ENVIRONMENT_NAMES,
]);
const HERMETIC_BUILD_ENVIRONMENT_NAMES = HERMETIC_ENVIRONMENT_NAMES;

function validateHermeticLocalByteRoots(localByteRoots) {
  if (!hasExactKeys(localByteRoots, HERMETIC_LOCAL_BYTE_ROOT_KEYS)) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_LOCAL_BYTE_ROOTS_INVALID");
  }
  const roots = Object.fromEntries(HERMETIC_LOCAL_BYTE_ROOT_KEYS.map((key) => [
    key,
    assertCanonicalLinuxAbsolutePath(
      localByteRoots[key],
      `DISPOSABLE_DEVNET_HERMETIC_${key.toUpperCase()}_ROOT`,
    ),
  ]));
  if (new Set(Object.values(roots)).size !== HERMETIC_LOCAL_BYTE_ROOT_KEYS.length) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_LOCAL_BYTE_ROOT_ALIAS_HOLD");
  }
  return Object.freeze(roots);
}

function hermeticRecipe(kind) {
  if (kind === "law") {
    return Object.freeze({
      value: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE,
      sha256: LAW_HERMETIC_RECIPE_SHA256,
      outputFileName: PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE.outputFileName,
    });
  }
  if (kind === "economy") {
    return Object.freeze({
      value: ECONOMY_SBF_BUILD_RECIPE,
      sha256: ECONOMY_HERMETIC_RECIPE_SHA256,
      outputFileName: ECONOMY_SBF_BUILD_RECIPE.outputFileName,
    });
  }
  throw new Error("DISPOSABLE_DEVNET_HERMETIC_KIND_INVALID");
}

function hermeticMounts({ sourceSnapshotRoot, localByteRoots, exportRoot }) {
  const mounts = [
    { key: "source", source: sourceSnapshotRoot, target: "/iat-host/source", readonly: true },
    ...HERMETIC_LOCAL_BYTE_ROOT_KEYS.map((key) => ({
      key,
      source: localByteRoots[key],
      target: PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE.trees[key].mountTarget,
      readonly: true,
    })),
    { key: "export", source: exportRoot, target: "/iat-host/export", readonly: false },
  ];
  if (new Set(mounts.map(({ source }) => source)).size !== mounts.length
    || new Set(mounts.map(({ target }) => target)).size !== mounts.length
    || mounts.some((left, leftIndex) => mounts.some((right, rightIndex) => (
      leftIndex !== rightIndex
      && (left.source.startsWith(`${right.source}/`)
        || right.source.startsWith(`${left.source}/`))
    )))) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_MOUNT_ALIAS_HOLD");
  }
  return deepFreeze(mounts);
}

function hermeticMountArgument({ source, target, readonly }) {
  return `--mount=type=bind,source=${source},target=${target}${readonly ? ",readonly" : ""}`;
}

export function createDisposableDevnetHermeticBuildContract({
  sourceClosure,
  sourceSnapshotRoot,
  localByteRoots,
  exportRoot,
  ordinal,
  kind,
  laneId,
  identityEnvironment,
} = {}) {
  if (!hasExactKeys(sourceClosure, [
    "declaredHeadSha", "treeSha", "mountedInputSha256", "entries",
  ])
    || !HEX_SHA1.test(sourceClosure.declaredHeadSha ?? "")
    || !HEX_SHA1.test(sourceClosure.treeSha ?? "")
    || !/^[0-9a-f]{64}$/u.test(sourceClosure.mountedInputSha256 ?? "")
    || ![1, 2].includes(ordinal)
    || !LANE_ID.test(laneId ?? "")) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_CONTRACT_INPUT_INVALID");
  }
  const expectedMountedInputSha256 = disposableDevnetExecutionCanonicalSha256({
    schema: COMBINED_LAW_SOURCE_MATERIALIZATION_SCHEMA,
    declaredHeadSha: sourceClosure.declaredHeadSha,
    treeSha: sourceClosure.treeSha,
    entries: sourceClosure.entries,
  });
  if (sourceClosure.mountedInputSha256 !== expectedMountedInputSha256) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_MOUNTED_INPUT_BINDING_HOLD");
  }
  const normalizedSourceRoot = assertCanonicalLinuxAbsolutePath(
    sourceSnapshotRoot,
    "DISPOSABLE_DEVNET_HERMETIC_SOURCE_ROOT",
  );
  const normalizedExportRoot = assertCanonicalLinuxAbsolutePath(
    exportRoot,
    "DISPOSABLE_DEVNET_HERMETIC_EXPORT_ROOT",
  );
  const normalizedLocalRoots = validateHermeticLocalByteRoots(localByteRoots);
  const environment = assertExactIdentityEnvironment(identityEnvironment);
  const sourceManifest = createDisposableDevnetHermeticSourceManifest(sourceClosure.entries);
  const recipe = hermeticRecipe(kind);
  const mounts = hermeticMounts({
    sourceSnapshotRoot: normalizedSourceRoot,
    localByteRoots: normalizedLocalRoots,
    exportRoot: normalizedExportRoot,
  });
  const nonce = sha256(Buffer.from(`${laneId}\0${ordinal}\0${kind}`, "utf8")).slice(0, 16);
  const contractCore = {
    schema: DISPOSABLE_DEVNET_HERMETIC_EXECUTION_CONTRACT_SCHEMA,
    implementationStatus: "IMPLEMENTED_HARD_DISABLED_PENDING_INDEPENDENT_ACCEPTANCE",
    enabled: false,
    laneId,
    ordinal,
    kind,
    attempt: 1,
    retryPolicy: "NO_RETRY_WITHIN_CONTRACT",
    containerName: `iat-b3-b24-${nonce}-${kind}`,
    source: {
      declaredHeadSha: sourceClosure.declaredHeadSha,
      treeSha: sourceClosure.treeSha,
      mountedInputSha256: sourceClosure.mountedInputSha256,
      manifest: sourceManifest,
    },
    localByteToolchain: PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE,
    recipe,
    identityEnvironmentSha256: disposableDevnetExecutionCanonicalSha256(environment),
    wrapper: {
      initializerSha256: DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_SHA256,
      executable: "/bin/bash",
      sha256: DISPOSABLE_DEVNET_HERMETIC_WRAPPER_SHA256,
      initializerIdentity: "UID_GID_0_CAP_DROP_ALL",
      buildIdentity: "DOCKER_EXEC_UID_GID_65534_CAP_DROP_ALL",
      stdoutPolicy: "EXACT_INITIALIZER_FRAME_PLUS_THREE_BUILD_FRAMES_CARGO_STDOUT_TO_STDERR",
    },
    privateStore: {
      type: "CONTAINER_PRIVATE_TMPFS",
      root: HERMETIC_PRIVATE_ROOT,
      byteLength: HERMETIC_PRIVATE_STORE_BYTES,
      options: "rw,nosuid,nodev,exec,uid=0,gid=0,mode=0755",
      owner: "UID_GID_0_BUILD_UID_UNWRITABLE",
      freshPerContainer: true,
      removedWithContainer: true,
    },
    buildStore: {
      type: "CONTAINER_PRIVATE_TMPFS",
      root: HERMETIC_BUILD_ROOT,
      byteLength: HERMETIC_BUILD_STORE_BYTES,
      options: "rw,nosuid,nodev,exec,uid=65534,gid=65534,mode=0700",
      owner: "UID_GID_65534",
      freshPerContainer: true,
      removedWithContainer: true,
    },
    exportBoundary: {
      hostDirectoryOpenMode: "703",
      hostDirectoryClosedMode: "700",
      hostDirectoryOwner: "EXECUTING_NODE_UID_GID",
      containerWriter: "UID_GID_65534_CAP_DROP_ALL_USES_OTHER_WRITE_EXECUTE",
      exportedArtifactMode: "444",
      creation: "BASH_NOCLOBBER_EXCLUSIVE_DESCRIPTOR_THEN_CAT",
      exactSingleOutputRequired: true,
    },
    mounts,
    lifecycle: {
      requirePreexistingContainerAbsence: true,
      requireCreatedInspect: true,
      requireRunningInspect: true,
      requireRootInitializerFrame: true,
      requireExactUnprivilegedExec: true,
      requireStopBeforeArtifactRead: true,
      requireExitedInspect: true,
      requireContainerRemoval: true,
      requirePostRemovalAbsence: true,
      requirePrivateInputPreAndPostEquality: true,
      requirePrivateAndExportedArtifactEquality: true,
      requireExportDirectoryOpenCloseIdentity: true,
      requireFinalRetainedFileLedger: true,
    },
    daemonTrust: {
      pinnedLocalSocketAndDaemonRequired: true,
      exclusiveDockerSocketPrincipalRequired: true,
      exclusiveDockerSocketPrincipalObserved: false,
      status: "HOLD_PINNED_DOCKER_SOCKET_EXCLUSIVE_PRINCIPAL_NOT_PROVEN",
    },
    safety: {
      dockerApiInvoked: false,
      buildExecuted: false,
      executionProvenanceObserved: false,
      signing: false,
      rpc: false,
      deployment: false,
      mainnetExecutionAuthorized: false,
      mainnetStatus: "HOLD",
    },
  };
  const contract = deepFreeze({
    ...contractCore,
    contractSha256: disposableDevnetExecutionCanonicalSha256(contractCore),
  });
  const containerEnvironment = Object.freeze({
    ...environment,
    IAT_B3_EXACT_SOURCE_HEAD_SHA: contract.source.declaredHeadSha,
    IAT_B3_HERMETIC_CONTRACT_SHA256: contract.contractSha256,
    IAT_B3_HERMETIC_KIND: kind,
    IAT_B3_HERMETIC_LANE_ID: laneId,
    IAT_B3_HERMETIC_ORDINAL: String(ordinal),
    IAT_B3_HERMETIC_RECIPE_SHA256: recipe.sha256,
    IAT_B3_HERMETIC_SOURCE_MANIFEST_SHA256: sourceManifest.sha256,
    IAT_B3_HERMETIC_SOURCE_MOUNTED_INPUT_SHA256: contract.source.mountedInputSha256,
    IAT_B3_HERMETIC_TOOLCHAIN_CLOSURE_SHA256:
      PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE.closureSha256,
  });
  const createArguments = Object.freeze([
    `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
    "create",
    `--name=${contract.containerName}`,
    "--read-only",
    "--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=268435456",
    HERMETIC_PRIVATE_TMPFS,
    HERMETIC_BUILD_TMPFS,
    "--pull=never",
    "--network=none",
    "--platform=linux/amd64",
    "--cap-drop=ALL",
    "--security-opt=no-new-privileges",
    "--pids-limit=512",
    "--workdir=/usr/bin",
    ...mounts.map(hermeticMountArgument),
    ...HERMETIC_ENVIRONMENT_NAMES.map((name) => `--env=${name}`),
    "--entrypoint=/bin/bash",
    PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference,
    "--noprofile",
    "--norc",
    "-c",
    DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_SCRIPT,
  ]);
  const execArguments = hermeticDockerExecArguments(contract);
  const planCore = { contract, createArguments, execArguments, environment: containerEnvironment };
  const plan = deepFreeze({
    ...planCore,
    planSha256: disposableDevnetExecutionCanonicalSha256(planCore),
  });
  validateDisposableDevnetHermeticBuildContract(plan);
  return plan;
}

function assertHermeticDockerCreateArguments(arguments_) {
  const prefix = [
    `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
    "create",
  ];
  if (!Array.isArray(arguments_)
    || arguments_.some((value) => typeof value !== "string" || /[\r\0]/u.test(value))
    || !exactStringArrayEquals(arguments_.slice(0, 2), prefix)
    || !/^--name=iat-b3-b24-[0-9a-f]{16}-(?:law|economy)$/u.test(arguments_[2] ?? "")
    || !exactStringArrayEquals(arguments_.slice(3, 14), [
      "--read-only",
      "--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=268435456",
      HERMETIC_PRIVATE_TMPFS,
      HERMETIC_BUILD_TMPFS,
      "--pull=never",
      "--network=none",
      "--platform=linux/amd64",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=512",
      "--workdir=/usr/bin",
    ])) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_DOCKER_PREFIX_HOLD");
  }
  const mountTokens = arguments_.slice(14, 14 + HERMETIC_LOCAL_BYTE_ROOT_KEYS.length + 2);
  const expectedTargets = [
    "/iat-host/source",
    ...HERMETIC_LOCAL_BYTE_ROOT_KEYS.map(
      (key) => PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE.trees[key].mountTarget,
    ),
    "/iat-host/export",
  ];
  const observedSources = [];
  for (const [index, token] of mountTokens.entries()) {
    const match = /^--mount=type=bind,source=(?<source>[^,\r\n\0]+),target=(?<target>\/[^,\r\n\0]+)(?<readonly>,readonly)?$/u
      .exec(token ?? "");
    if (!match?.groups
      || match.groups.target !== expectedTargets[index]
      || (index === mountTokens.length - 1) !== (match.groups.readonly === undefined)) {
      throw new Error("DISPOSABLE_DEVNET_HERMETIC_DOCKER_MOUNT_GRAMMAR_HOLD");
    }
    assertCanonicalLinuxAbsolutePath(
      match.groups.source,
      "DISPOSABLE_DEVNET_HERMETIC_DOCKER_MOUNT_SOURCE",
    );
    observedSources.push(match.groups.source);
  }
  if (mountTokens.length !== expectedTargets.length
    || new Set(observedSources).size !== observedSources.length) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_DOCKER_MOUNT_CLOSURE_HOLD");
  }
  const environmentStart = 14 + expectedTargets.length;
  const environmentEnd = environmentStart + HERMETIC_ENVIRONMENT_NAMES.length;
  if (!exactStringArrayEquals(
    arguments_.slice(environmentStart, environmentEnd),
    HERMETIC_ENVIRONMENT_NAMES.map((name) => `--env=${name}`),
  )
    || !exactStringArrayEquals(arguments_.slice(environmentEnd), [
      "--entrypoint=/bin/bash",
      PINNED_COMBINED_LAW_BUILD_CONTAINER.executionReference,
      "--noprofile",
      "--norc",
      "-c",
      DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_SCRIPT,
    ])) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_DOCKER_COMMAND_GRAMMAR_HOLD");
  }
  if (arguments_.filter((value) => value.startsWith("--tmpfs=")).length !== 3
    || arguments_.filter((value) => value.startsWith("--mount=")).length !== expectedTargets.length
    || arguments_.filter((value) => value.startsWith("--network=")).length !== 1
    || arguments_.filter((value) => value.startsWith("--pull=")).length !== 1
    || arguments_.some((value) => /^(?:--privileged|--cap-add|--device|--pid|--ipc|--uts|--userns|--volume|-v)(?:=|$)/u.test(value))) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_DOCKER_PRIVILEGE_OR_DUPLICATE_HOLD");
  }
  return true;
}

function hermeticDockerExecArguments(contract) {
  return Object.freeze([
    `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
    "container",
    "exec",
    "--user=65534:65534",
    "--workdir=/iat-private/home/a/iat-source",
    ...HERMETIC_BUILD_ENVIRONMENT_NAMES.map((name) => `--env=${name}`),
    contract.containerName,
    "/bin/bash",
    "--noprofile",
    "--norc",
    "-c",
    DISPOSABLE_DEVNET_HERMETIC_CONTAINER_WRAPPER_SCRIPT,
  ]);
}

function assertHermeticDockerExecArguments(arguments_) {
  const nameIndex = 5 + HERMETIC_BUILD_ENVIRONMENT_NAMES.length;
  if (!Array.isArray(arguments_)
    || !exactStringArrayEquals(arguments_.slice(0, 5), [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "container",
      "exec",
      "--user=65534:65534",
      "--workdir=/iat-private/home/a/iat-source",
    ])
    || !exactStringArrayEquals(
      arguments_.slice(5, nameIndex),
      HERMETIC_BUILD_ENVIRONMENT_NAMES.map((name) => `--env=${name}`),
    )
    || !/^iat-b3-b24-[0-9a-f]{16}-(?:law|economy)$/u.test(arguments_[nameIndex] ?? "")
    || !exactStringArrayEquals(arguments_.slice(nameIndex + 1), [
      "/bin/bash", "--noprofile", "--norc", "-c",
      DISPOSABLE_DEVNET_HERMETIC_CONTAINER_WRAPPER_SCRIPT,
    ])
    || arguments_.some((value) => /^(?:--detach|-d|--interactive|-i|--tty|-t|--privileged)(?:=|$)/u.test(value))) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_DOCKER_EXEC_GRAMMAR_HOLD");
  }
  return true;
}

export function validateDisposableDevnetHermeticDockerExecArguments(arguments_) {
  return assertHermeticDockerExecArguments(arguments_);
}

export function validateDisposableDevnetHermeticDockerCreateArguments(arguments_) {
  return assertHermeticDockerCreateArguments(arguments_);
}

export function validateDisposableDevnetHermeticBuildContract(plan) {
  if (!hasExactKeys(plan, [
    "contract", "createArguments", "execArguments", "environment", "planSha256",
  ])
    || !hasExactKeys(plan.contract, [
      "schema", "implementationStatus", "enabled", "laneId", "ordinal", "kind", "attempt",
      "retryPolicy", "containerName", "source", "localByteToolchain", "recipe",
      "identityEnvironmentSha256", "wrapper", "privateStore", "buildStore", "exportBoundary", "mounts",
      "lifecycle", "daemonTrust", "safety", "contractSha256",
    ])
    || plan.contract.schema !== DISPOSABLE_DEVNET_HERMETIC_EXECUTION_CONTRACT_SCHEMA
    || plan.contract.implementationStatus
      !== "IMPLEMENTED_HARD_DISABLED_PENDING_INDEPENDENT_ACCEPTANCE"
    || plan.contract.enabled !== false
    || plan.contract.attempt !== 1
    || plan.contract.retryPolicy !== "NO_RETRY_WITHIN_CONTRACT"
    || plan.contract.wrapper?.sha256 !== DISPOSABLE_DEVNET_HERMETIC_WRAPPER_SHA256
    || plan.contract.privateStore?.byteLength !== HERMETIC_PRIVATE_STORE_BYTES
    || plan.contract.privateStore?.root !== HERMETIC_PRIVATE_ROOT
    || disposableDevnetExecutionCanonicalJson(plan.contract.localByteToolchain)
      !== disposableDevnetExecutionCanonicalJson(PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE)) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_CONTRACT_SHAPE_HOLD");
  }
  const contract = plan.contract;
  const expectedRecipe = hermeticRecipe(contract.kind);
  const expectedNonce = sha256(
    Buffer.from(`${contract.laneId}\0${contract.ordinal}\0${contract.kind}`, "utf8"),
  ).slice(0, 16);
  const identityEnvironment = Object.fromEntries(
    REQUIRED_IDENTITY_ENVIRONMENT_NAMES.map((name) => [name, plan.environment?.[name]]),
  );
  if (!LANE_ID.test(contract.laneId ?? "")
    || ![1, 2].includes(contract.ordinal)
    || !["law", "economy"].includes(contract.kind)
    || contract.containerName !== `iat-b3-b24-${expectedNonce}-${contract.kind}`
    || disposableDevnetExecutionCanonicalJson(contract.recipe)
      !== disposableDevnetExecutionCanonicalJson(expectedRecipe)
    || !hasExactKeys(contract.source, [
      "declaredHeadSha", "treeSha", "mountedInputSha256", "manifest",
    ])
    || !HEX_SHA1.test(contract.source.declaredHeadSha ?? "")
    || !HEX_SHA1.test(contract.source.treeSha ?? "")
    || !/^[0-9a-f]{64}$/u.test(contract.source.mountedInputSha256 ?? "")
    || !hasExactKeys(contract.source.manifest, [
      "schema", "sha256", "byteLength", "entryCount", "fileCount", "directoryCount",
      "sourceByteLength",
    ])
    || contract.source.manifest.schema !== "iat-b3-disposable-devnet-hermetic-tree-manifest/v1"
    || !/^[0-9a-f]{64}$/u.test(contract.source.manifest.sha256 ?? "")
    || !Number.isSafeInteger(contract.source.manifest.byteLength)
    || contract.source.manifest.byteLength <= 0
    || !Number.isSafeInteger(contract.source.manifest.entryCount)
    || contract.source.manifest.entryCount
      !== contract.source.manifest.fileCount + contract.source.manifest.directoryCount
    || contract.source.manifest.fileCount <= 0
    || contract.source.manifest.directoryCount < 0
    || contract.source.manifest.sourceByteLength < 0
    || !hasExactKeys(plan.environment, HERMETIC_ENVIRONMENT_NAMES)
    || Object.values(plan.environment).some(
      (value) => typeof value !== "string" || /[\r\n\0]/u.test(value),
    )
    || contract.identityEnvironmentSha256
      !== disposableDevnetExecutionCanonicalSha256(identityEnvironment)
    || !hasExactKeys(contract.wrapper, [
      "initializerSha256", "executable", "sha256", "initializerIdentity", "buildIdentity",
      "stdoutPolicy",
    ])
    || contract.wrapper.initializerSha256 !== DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_SHA256
    || contract.wrapper.executable !== "/bin/bash"
    || contract.wrapper.initializerIdentity !== "UID_GID_0_CAP_DROP_ALL"
    || contract.wrapper.buildIdentity !== "DOCKER_EXEC_UID_GID_65534_CAP_DROP_ALL"
    || contract.wrapper.stdoutPolicy
      !== "EXACT_INITIALIZER_FRAME_PLUS_THREE_BUILD_FRAMES_CARGO_STDOUT_TO_STDERR"
    || disposableDevnetExecutionCanonicalJson(contract.privateStore)
      !== disposableDevnetExecutionCanonicalJson({
        type: "CONTAINER_PRIVATE_TMPFS",
        root: HERMETIC_PRIVATE_ROOT,
        byteLength: HERMETIC_PRIVATE_STORE_BYTES,
        options: "rw,nosuid,nodev,exec,uid=0,gid=0,mode=0755",
        owner: "UID_GID_0_BUILD_UID_UNWRITABLE",
        freshPerContainer: true,
        removedWithContainer: true,
      })
    || disposableDevnetExecutionCanonicalJson(contract.buildStore)
      !== disposableDevnetExecutionCanonicalJson({
        type: "CONTAINER_PRIVATE_TMPFS",
        root: HERMETIC_BUILD_ROOT,
        byteLength: HERMETIC_BUILD_STORE_BYTES,
        options: "rw,nosuid,nodev,exec,uid=65534,gid=65534,mode=0700",
        owner: "UID_GID_65534",
        freshPerContainer: true,
        removedWithContainer: true,
      })
    || disposableDevnetExecutionCanonicalJson(contract.exportBoundary)
      !== disposableDevnetExecutionCanonicalJson({
        hostDirectoryOpenMode: "703",
        hostDirectoryClosedMode: "700",
        hostDirectoryOwner: "EXECUTING_NODE_UID_GID",
        containerWriter: "UID_GID_65534_CAP_DROP_ALL_USES_OTHER_WRITE_EXECUTE",
        exportedArtifactMode: "444",
        creation: "BASH_NOCLOBBER_EXCLUSIVE_DESCRIPTOR_THEN_CAT",
        exactSingleOutputRequired: true,
      })
    || disposableDevnetExecutionCanonicalJson(contract.lifecycle)
      !== disposableDevnetExecutionCanonicalJson({
        requirePreexistingContainerAbsence: true,
        requireCreatedInspect: true,
        requireRunningInspect: true,
        requireRootInitializerFrame: true,
        requireExactUnprivilegedExec: true,
        requireStopBeforeArtifactRead: true,
        requireExitedInspect: true,
        requireContainerRemoval: true,
        requirePostRemovalAbsence: true,
        requirePrivateInputPreAndPostEquality: true,
        requirePrivateAndExportedArtifactEquality: true,
        requireExportDirectoryOpenCloseIdentity: true,
        requireFinalRetainedFileLedger: true,
      })
    || disposableDevnetExecutionCanonicalJson(contract.daemonTrust)
      !== disposableDevnetExecutionCanonicalJson({
        pinnedLocalSocketAndDaemonRequired: true,
        exclusiveDockerSocketPrincipalRequired: true,
        exclusiveDockerSocketPrincipalObserved: false,
        status: "HOLD_PINNED_DOCKER_SOCKET_EXCLUSIVE_PRINCIPAL_NOT_PROVEN",
      })
    || disposableDevnetExecutionCanonicalJson(contract.safety)
      !== disposableDevnetExecutionCanonicalJson({
        dockerApiInvoked: false,
        buildExecuted: false,
        executionProvenanceObserved: false,
        signing: false,
        rpc: false,
        deployment: false,
        mainnetExecutionAuthorized: false,
        mainnetStatus: "HOLD",
      })
    || !Array.isArray(contract.mounts) || contract.mounts.length !== 8
    || !exactStringArrayEquals(
      contract.mounts.map(({ key }) => key),
      ["source", ...HERMETIC_LOCAL_BYTE_ROOT_KEYS, "export"],
    )
    || contract.mounts.some((mount) => !hasExactKeys(
      mount,
      ["key", "source", "target", "readonly"],
    ))
    || new Set(contract.mounts.map(({ key }) => key)).size !== contract.mounts.length
    || new Set(contract.mounts.map(({ source }) => source)).size !== contract.mounts.length
    || new Set(contract.mounts.map(({ target }) => target)).size !== contract.mounts.length
    || contract.mounts.some((left, leftIndex) => contract.mounts.some((right, rightIndex) => (
      leftIndex !== rightIndex
      && (left.source.startsWith(`${right.source}/`)
        || right.source.startsWith(`${left.source}/`))
    )))
    || contract.mounts.some(({ source }) => {
      try {
        assertCanonicalLinuxAbsolutePath(source, "DISPOSABLE_DEVNET_HERMETIC_CONTRACT_MOUNT");
        return false;
      } catch {
        return true;
      }
    })
    || !exactStringArrayEquals(
      plan.createArguments.slice(14, 22),
      contract.mounts.map(hermeticMountArgument),
    )
    || !assertHermeticDockerExecArguments(plan.execArguments)) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_CONTRACT_SHAPE_HOLD");
  }
  const { contractSha256, ...contractCore } = contract;
  if (contractSha256 !== disposableDevnetExecutionCanonicalSha256(contractCore)
    || plan.planSha256 !== disposableDevnetExecutionCanonicalSha256({
      contract: plan.contract,
      createArguments: plan.createArguments,
      execArguments: plan.execArguments,
      environment: plan.environment,
    })
    || plan.environment?.IAT_B3_HERMETIC_CONTRACT_SHA256 !== contractSha256
    || plan.environment?.IAT_B3_HERMETIC_SOURCE_MANIFEST_SHA256
      !== plan.contract.source?.manifest?.sha256
    || plan.environment?.IAT_B3_HERMETIC_SOURCE_MOUNTED_INPUT_SHA256
      !== plan.contract.source?.mountedInputSha256
    || plan.environment?.IAT_B3_HERMETIC_TOOLCHAIN_CLOSURE_SHA256
      !== PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE.closureSha256
    || plan.environment?.IAT_B3_HERMETIC_RECIPE_SHA256 !== plan.contract.recipe?.sha256
    || plan.contract.safety?.dockerApiInvoked !== false
    || plan.contract.safety?.buildExecuted !== false
    || plan.contract.safety?.executionProvenanceObserved !== false
    || plan.contract.safety?.mainnetStatus !== "HOLD") {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_CONTRACT_BINDING_HOLD");
  }
  assertHermeticDockerCreateArguments(plan.createArguments);
  assertHermeticDockerExecArguments(plan.execArguments);
  return plan;
}

function exactHermeticCommonFrame(contract, phase) {
  return {
    contractSha256: contract.contractSha256,
    kind: contract.kind,
    laneId: contract.laneId,
    ordinal: contract.ordinal,
    phase,
    recipeSha256: contract.recipe.sha256,
    schema: DISPOSABLE_DEVNET_HERMETIC_FRAME_SCHEMA,
    sourceManifestSha256: contract.source.manifest.sha256,
    toolchainClosureSha256: PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE.closureSha256,
  };
}

function exactHermeticInitializerFrame(contract) {
  return {
    contractSha256: contract.contractSha256,
    kind: contract.kind,
    laneId: contract.laneId,
    ordinal: contract.ordinal,
    phase: HERMETIC_INITIALIZATION_FRAME_PHASE,
    schema: DISPOSABLE_DEVNET_HERMETIC_FRAME_SCHEMA,
  };
}

export function validateDisposableDevnetHermeticInitializerFrame(bytes, plan) {
  validateDisposableDevnetHermeticBuildContract(plan);
  const { contract } = plan;
  const expected = Buffer.from(
    `${disposableDevnetExecutionCanonicalJson(exactHermeticInitializerFrame(contract))}\n`,
    "utf8",
  );
  if (!Buffer.isBuffer(bytes) || !bytes.equals(expected)) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_FRAME_BINDING_HOLD");
  }
  return true;
}

export function validateDisposableDevnetHermeticFrameSequence(stdoutBytes, {
  contract,
  exportedArtifactBytes,
} = {}) {
  if (!Buffer.isBuffer(stdoutBytes) || !Buffer.isBuffer(exportedArtifactBytes)
    || exportedArtifactBytes.length < 1_024
    || exportedArtifactBytes[0] !== 0x7f || exportedArtifactBytes[1] !== 0x45
    || exportedArtifactBytes[2] !== 0x4c || exportedArtifactBytes[3] !== 0x46
    || exportedArtifactBytes[4] !== 2 || exportedArtifactBytes[5] !== 1
    || exportedArtifactBytes[6] !== 1
    || exportedArtifactBytes.readUInt16LE(16) !== 3
    || exportedArtifactBytes.readUInt16LE(18) !== 247) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_FRAME_OR_ARTIFACT_BYTES_REQUIRED");
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(stdoutBytes);
  } catch {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_FRAME_UTF8_HOLD");
  }
  if (!Buffer.from(text, "utf8").equals(stdoutBytes) || text.includes("\r")) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_FRAME_ENCODING_HOLD");
  }
  const lines = text.split("\n");
  if (lines.length !== 4 || lines[3] !== "" || lines.slice(0, 3).some((line) => line === "")) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_EXACT_THREE_FRAMES_REQUIRED");
  }
  const frames = lines.slice(0, 3).map((line) => {
    let frame;
    try {
      frame = JSON.parse(line);
    } catch {
      throw new Error("DISPOSABLE_DEVNET_HERMETIC_FRAME_JSON_HOLD");
    }
    if (disposableDevnetExecutionCanonicalJson(frame) !== line) {
      throw new Error("DISPOSABLE_DEVNET_HERMETIC_FRAME_CANONICAL_JSON_HOLD");
    }
    return frame;
  });
  const expectedPre = exactHermeticCommonFrame(contract, HERMETIC_FRAME_PHASES[0]);
  const expectedPost = exactHermeticCommonFrame(contract, HERMETIC_FRAME_PHASES[1]);
  const artifactSha256 = sha256(exportedArtifactBytes);
  const expectedArtifact = {
    artifactByteLength: exportedArtifactBytes.length,
    artifactSha256,
    cargoExitStatus: 0,
    ...exactHermeticCommonFrame(contract, HERMETIC_FRAME_PHASES[2]),
  };
  if (disposableDevnetExecutionCanonicalJson(frames[0])
      !== disposableDevnetExecutionCanonicalJson(expectedPre)
    || disposableDevnetExecutionCanonicalJson(frames[1])
      !== disposableDevnetExecutionCanonicalJson(expectedPost)
    || disposableDevnetExecutionCanonicalJson(frames[2])
      !== disposableDevnetExecutionCanonicalJson(expectedArtifact)) {
    throw new Error("DISPOSABLE_DEVNET_HERMETIC_FRAME_BINDING_HOLD");
  }
  return deepFreeze({
    status: "HOLD_HERMETIC_CONTRACT_STRUCTURAL_VALIDATION_ONLY",
    valid: true,
    ready: false,
    structuralContractValidated: true,
    exactSourceReceiptValidated: false,
    executionProvenanceObserved: false,
    buildExecutionObserved: false,
    artifactSha256,
    artifactByteLength: exportedArtifactBytes.length,
    frameSequenceSha256: sha256(stdoutBytes),
    blocker: "HERMETIC_MOUNT_CAUSALITY_UNPROVEN",
    mainnetStatus: "HOLD",
  });
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

function exportDirectoryObjectFingerprint(stat) {
  return [stat.dev, stat.ino, stat.uid, stat.gid, stat.nlink].join(":");
}

function ensureContainerWritableExportDirectory(path) {
  mkdirSync(path, { recursive: false, mode: 0o703 });
  chmodSync(path, 0o703);
  const absolutePath = realpathSync(path);
  const stat = lstatSync(absolutePath, { bigint: true });
  const processUid = process.getuid?.();
  const processGid = process.getgid?.();
  if (normalizedRealPath(absolutePath) !== normalizedRealPath(path)
    || !stat.isDirectory() || stat.isSymbolicLink()
    || (stat.mode & 0o777n) !== 0o703n
    || !Number.isSafeInteger(processUid) || !Number.isSafeInteger(processGid)
    || stat.uid !== BigInt(processUid) || stat.gid !== BigInt(processGid)
    || stat.nlink < 2n
    || readdirSync(absolutePath).length !== 0) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_EXPORT_DIRECTORY_OPEN_BOUNDARY_HOLD");
  }
  PROCESS_CREATED_EXPORT_ROOTS.set(absolutePath, Object.freeze({
    objectFingerprint: exportDirectoryObjectFingerprint(stat),
    parentChain: observeDirectoryIdentityChain(
      dirname(absolutePath),
      "DISPOSABLE_DEVNET_EXECUTION_EXPORT_DIRECTORY",
    ),
  }));
  return absolutePath;
}

function assertContainerExportDirectoryStable(path, { mode, entries }) {
  const absolutePath = resolve(path);
  const observation = PROCESS_CREATED_EXPORT_ROOTS.get(absolutePath);
  if (!observation || ![0o703, 0o700].includes(mode)
    || !Array.isArray(entries)
    || entries.some((entry) => typeof entry !== "string" || /[\\/\r\n\0]/u.test(entry))) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_EXPORT_DIRECTORY_CONTRACT_INVALID");
  }
  assertDirectoryIdentityChainStable(
    observation.parentChain,
    "DISPOSABLE_DEVNET_EXECUTION_EXPORT_DIRECTORY",
  );
  const stat = lstatSync(absolutePath, { bigint: true });
  const observedEntries = readdirSync(absolutePath)
    .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  const expectedEntries = [...entries]
    .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
  if (!stat.isDirectory() || stat.isSymbolicLink()
    || normalizedRealPath(realpathSync(absolutePath)) !== normalizedRealPath(absolutePath)
    || exportDirectoryObjectFingerprint(stat) !== observation.objectFingerprint
    || (stat.mode & 0o777n) !== BigInt(mode)
    || !exactStringArrayEquals(observedEntries, expectedEntries)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_EXPORT_DIRECTORY_CHANGED_HOLD");
  }
}

function closeContainerWritableExportDirectory(path, expectedFileName) {
  assertContainerExportDirectoryStable(path, { mode: 0o703, entries: [expectedFileName] });
  chmodSync(path, 0o700);
  assertContainerExportDirectoryStable(path, { mode: 0o700, entries: [expectedFileName] });
}

function releaseContainerExportDirectory(path, expectedFileName) {
  assertContainerExportDirectoryStable(path, { mode: 0o700, entries: [expectedFileName] });
  PROCESS_CREATED_EXPORT_ROOTS.delete(resolve(path));
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

function retainedPathCompare(left, right) {
  return Buffer.compare(Buffer.from(left.relativePath, "utf8"), Buffer.from(right.relativePath, "utf8"));
}

function normalizeRetainedDescriptors(descriptors) {
  if (!Array.isArray(descriptors) || descriptors.length === 0) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_RETAINED_DESCRIPTORS_REQUIRED");
  }
  const normalized = descriptors.map((descriptor) => {
    if (!hasExactKeys(descriptor, ["relativePath", "sha256", "byteLength", "device", "inode"])
      || typeof descriptor.relativePath !== "string" || descriptor.relativePath.length === 0
      || descriptor.relativePath.startsWith("/") || descriptor.relativePath.includes("\\")
      || descriptor.relativePath.split("/").some((part) => ["", ".", ".."].includes(part))
      || !/^[0-9a-f]{64}$/u.test(descriptor.sha256 ?? "")
      || !Number.isSafeInteger(descriptor.byteLength) || descriptor.byteLength < 0
      || !/^\d+$/u.test(descriptor.device ?? "") || !/^\d+$/u.test(descriptor.inode ?? "")) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_RETAINED_DESCRIPTOR_INVALID");
    }
    return Object.freeze({ ...descriptor });
  }).sort(retainedPathCompare);
  if (new Set(normalized.map(({ relativePath }) => relativePath)).size !== normalized.length
    || new Set(normalized.map(({ device, inode }) => `${device}:${inode}`)).size !== normalized.length) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_RETAINED_DESCRIPTOR_ALIAS_HOLD");
  }
  return Object.freeze(normalized);
}

function observeRetainedFileTree(root, label) {
  const absoluteRoot = resolve(root);
  const realRoot = realpathSync(absoluteRoot);
  if (normalizedRealPath(realRoot) !== normalizedRealPath(absoluteRoot)) {
    throw new Error(`${label}_ROOT_REPARSE_HOLD`);
  }
  const directories = [];
  const files = [];
  const visit = (directory, relativeDirectory) => {
    const before = lstatSync(directory, { bigint: true });
    if (!before.isDirectory() || before.isSymbolicLink()
      || normalizedRealPath(realpathSync(directory)) !== normalizedRealPath(directory)) {
      throw new Error(`${label}_DIRECTORY_BOUNDARY_HOLD`);
    }
    const names = readdirSync(directory)
      .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
    directories.push(Object.freeze({
      relativePath: relativeDirectory === "" ? "." : relativeDirectory,
      device: before.dev.toString(),
      inode: before.ino.toString(),
      mode: Number(before.mode & 0o777n).toString(8).padStart(3, "0"),
      uid: before.uid.toString(),
      gid: before.gid.toString(),
      linkCount: before.nlink.toString(),
      modifiedNanoseconds: before.mtimeNs.toString(),
      changedNanoseconds: before.ctimeNs.toString(),
    }));
    for (const name of names) {
      if (name.includes("/") || name.includes("\\") || /[\r\n\0]/u.test(name)) {
        throw new Error(`${label}_ENTRY_NAME_HOLD`);
      }
      const path = join(directory, name);
      const relativePath = relativeDirectory === "" ? name : `${relativeDirectory}/${name}`;
      const stat = lstatSync(path, { bigint: true });
      if (stat.isSymbolicLink()) throw new Error(`${label}_SYMLINK_OR_REPARSE_HOLD`);
      if (stat.isDirectory()) {
        visit(path, relativePath);
      } else if (stat.isFile()) {
        if (stat.nlink !== 1n) throw new Error(`${label}_HARDLINK_HOLD`);
        const observed = hashFileAndReadPrefix(Object.freeze({ path, relativePath, stat }), 0);
        files.push(Object.freeze({
          relativePath,
          sha256: observed.sha256,
          byteLength: observed.byteLength,
          device: stat.dev.toString(),
          inode: stat.ino.toString(),
          mode: Number(stat.mode & 0o777n).toString(8).padStart(3, "0"),
          uid: stat.uid.toString(),
          gid: stat.gid.toString(),
          linkCount: stat.nlink.toString(),
          modifiedNanoseconds: stat.mtimeNs.toString(),
          changedNanoseconds: stat.ctimeNs.toString(),
        }));
      } else {
        throw new Error(`${label}_NONREGULAR_ENTRY_HOLD`);
      }
    }
    const after = lstatSync(directory, { bigint: true });
    const namesAfter = readdirSync(directory)
      .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
    if (statFingerprint(before) !== statFingerprint(after)
      || !exactStringArrayEquals(namesAfter, names)
      || normalizedRealPath(realpathSync(directory)) !== normalizedRealPath(directory)) {
      throw new Error(`${label}_DIRECTORY_CHANGED_DURING_SCAN_HOLD`);
    }
  };
  visit(realRoot, "");
  directories.sort(retainedPathCompare);
  files.sort(retainedPathCompare);
  return Object.freeze({ directories: Object.freeze(directories), files: Object.freeze(files) });
}

function projectRetainedFileDescriptor(record) {
  return Object.freeze(Object.fromEntries(
    ["relativePath", "sha256", "byteLength", "device", "inode"]
      .map((name) => [name, record[name]]),
  ));
}

export function createDisposableDevnetRetainedFileLedger(root, expectedDescriptors) {
  const expected = normalizeRetainedDescriptors(expectedDescriptors);
  const observed = observeRetainedFileTree(
    root,
    "DISPOSABLE_DEVNET_EXECUTION_RETAINED_FILE_LEDGER",
  );
  const observedDescriptors = observed.files.map(projectRetainedFileDescriptor);
  if (disposableDevnetExecutionCanonicalJson(observedDescriptors)
    !== disposableDevnetExecutionCanonicalJson(expected)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_RETAINED_FILE_SET_OR_IDENTITY_HOLD");
  }
  const core = {
    schema: DISPOSABLE_DEVNET_RETAINED_FILE_LEDGER_SCHEMA,
    status: "HOLD_RETAINED_FILE_LEDGER_STRUCTURAL_VALIDATION_ONLY",
    valid: true,
    ready: false,
    directories: observed.directories,
    files: observed.files,
    expectedDescriptorClosureSha256: disposableDevnetExecutionCanonicalSha256(expected),
    executionProvenanceObserved: false,
    buildExecutionObserved: false,
    outputStagePromotionAuthorized: false,
    releaseAuthorized: false,
    mainnetStatus: "HOLD",
  };
  return deepFreeze({ ...core, ledgerSha256: disposableDevnetExecutionCanonicalSha256(core) });
}

function assertDisposableDevnetRetainedFileLedgerShape(ledger) {
  if (!hasExactKeys(ledger, [
    "schema", "status", "valid", "ready", "directories", "files",
    "expectedDescriptorClosureSha256", "executionProvenanceObserved",
    "buildExecutionObserved", "outputStagePromotionAuthorized", "releaseAuthorized",
    "mainnetStatus", "ledgerSha256",
  ])
    || ledger.schema !== DISPOSABLE_DEVNET_RETAINED_FILE_LEDGER_SCHEMA
    || ledger.status !== "HOLD_RETAINED_FILE_LEDGER_STRUCTURAL_VALIDATION_ONLY"
    || ledger.valid !== true || ledger.ready !== false
    || ledger.executionProvenanceObserved !== false
    || ledger.buildExecutionObserved !== false
    || ledger.outputStagePromotionAuthorized !== false
    || ledger.releaseAuthorized !== false || ledger.mainnetStatus !== "HOLD"
    || !Array.isArray(ledger.directories) || !Array.isArray(ledger.files)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_RETAINED_FILE_LEDGER_SHAPE_HOLD");
  }
  const { ledgerSha256, ...core } = ledger;
  if (!/^[0-9a-f]{64}$/u.test(ledgerSha256 ?? "")
    || ledgerSha256 !== disposableDevnetExecutionCanonicalSha256(core)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_RETAINED_FILE_LEDGER_DIGEST_HOLD");
  }
  return ledger;
}

export function validateDisposableDevnetRetainedFileLedger(root, ledger) {
  assertDisposableDevnetRetainedFileLedgerShape(ledger);
  const recomputed = createDisposableDevnetRetainedFileLedger(
    root,
    ledger.files.map(projectRetainedFileDescriptor),
  );
  if (disposableDevnetExecutionCanonicalJson(recomputed)
    !== disposableDevnetExecutionCanonicalJson(ledger)) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_RETAINED_FILE_LEDGER_REVALIDATION_HOLD");
  }
  return ledger;
}

export function createDisposableDevnetFinalOutputStagePromotion({
  stageRoot,
  retainedEvidenceLedger,
  retainedEvidenceDescriptors,
  transcriptDescriptor,
}) {
  const absoluteStageRoot = resolve(stageRoot);
  const evidenceRoot = join(absoluteStageRoot, "evidence");
  if (normalizedRealPath(realpathSync(evidenceRoot)) !== normalizedRealPath(evidenceRoot)
    || transcriptDescriptor?.relativePath !== "transcript.json") {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_FINAL_OUTPUT_PROMOTION_ROOT_HOLD");
  }
  validateDisposableDevnetRetainedFileLedger(evidenceRoot, retainedEvidenceLedger);
  const finalEvidenceDescriptors = normalizeRetainedDescriptors(retainedEvidenceDescriptors)
    .map((descriptor) => Object.freeze({
      ...descriptor,
      relativePath: `evidence/${descriptor.relativePath}`,
    }));
  const finalLedger = createDisposableDevnetRetainedFileLedger(
    absoluteStageRoot,
    [...finalEvidenceDescriptors, transcriptDescriptor],
  );
  validateDisposableDevnetRetainedFileLedger(absoluteStageRoot, finalLedger);
  const finalEvidenceFiles = finalLedger.files.filter(
    ({ relativePath }) => relativePath !== transcriptDescriptor.relativePath,
  );
  const expectedFinalEvidenceFiles = retainedEvidenceLedger.files.map((file) => Object.freeze({
    ...file,
    relativePath: `evidence/${file.relativePath}`,
  }));
  const expectedFinalEvidenceDirectories = retainedEvidenceLedger.directories.map(
    (directory) => Object.freeze({
      ...directory,
      relativePath: directory.relativePath === "."
        ? "evidence"
        : `evidence/${directory.relativePath}`,
    }),
  );
  const observedFinalEvidenceDirectories = finalLedger.directories.filter(
    ({ relativePath }) => relativePath !== ".",
  );
  if (disposableDevnetExecutionCanonicalJson(finalEvidenceFiles)
      !== disposableDevnetExecutionCanonicalJson(expectedFinalEvidenceFiles)
    || disposableDevnetExecutionCanonicalJson(observedFinalEvidenceDirectories)
      !== disposableDevnetExecutionCanonicalJson(expectedFinalEvidenceDirectories)
    || !finalLedger.files.some(({ relativePath, sha256, byteLength, device, inode }) => (
      relativePath === transcriptDescriptor.relativePath
      && sha256 === transcriptDescriptor.sha256
      && byteLength === transcriptDescriptor.byteLength
      && device === transcriptDescriptor.device
      && inode === transcriptDescriptor.inode
    ))) {
    throw new Error("DISPOSABLE_DEVNET_EXECUTION_FINAL_OUTPUT_PROMOTION_LEDGER_HOLD");
  }
  const core = {
    schema: DISPOSABLE_DEVNET_OUTPUT_PROMOTION_SCHEMA,
    status: "HOLD_OUTPUT_STAGE_PROMOTION_STRUCTURALLY_VALIDATED_ONLY",
    valid: true,
    ready: false,
    retainedEvidenceLedgerSha256: retainedEvidenceLedger.ledgerSha256,
    finalLedger,
    transcript: transcriptDescriptor,
    outputStageFilesystemPromotionValidated: true,
    executionProvenanceObserved: false,
    buildExecutionObserved: false,
    releaseAuthorized: false,
    mainnetStatus: "HOLD",
  };
  return deepFreeze({ ...core, promotionSha256: disposableDevnetExecutionCanonicalSha256(core) });
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
  const timeoutMilliseconds = /^run-[12]-(?:law|economy)-build-exec$/u.test(purpose)
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
    || arguments_.some((value) => typeof value !== "string" || /[\r\0]/u.test(value)
      || (value.includes("\n")
        && ![
          DISPOSABLE_DEVNET_HERMETIC_INITIALIZER_SCRIPT,
          DISPOSABLE_DEVNET_HERMETIC_CONTAINER_WRAPPER_SCRIPT,
        ].includes(value)))) {
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
    if ((arguments_[2] ?? "").startsWith("--name=iat-b3-b24-")) {
      assertHermeticDockerCreateArguments(arguments_);
    } else {
      assertOfflineDockerCreateArguments(arguments_);
    }
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
        && /^iat-b3-(?:b15-[a-z0-9-]{1,80}|b24-[0-9a-f]{16}-(?:law|economy))$/u.test(arguments_[3]))
      || (subcommand === "start"
        && ((arguments_.length === 4
          && /^iat-b3-b24-[0-9a-f]{16}-(?:law|economy)$/u.test(arguments_[3]))
          || (arguments_.length === 5
            && arguments_[3] === "--attach"
            && /^iat-b3-b15-[a-z0-9-]{1,80}$/u.test(arguments_[4]))))
      || (subcommand === "logs" && arguments_.length === 4
        && /^iat-b3-b24-[0-9a-f]{16}-(?:law|economy)$/u.test(arguments_[3]))
      || (subcommand === "stop" && arguments_.length === 5
        && arguments_[3] === "--time=10"
        && /^iat-b3-b24-[0-9a-f]{16}-(?:law|economy)$/u.test(arguments_[4]))
      || (subcommand === "rm"
        && arguments_.length === 5
        && arguments_[3] === "--force"
        && /^iat-b3-(?:b15-[a-z0-9-]{1,80}|b24-[0-9a-f]{16}-(?:law|economy))$/u.test(arguments_[4]))
      || (subcommand === "exec" && (() => {
        try { return assertHermeticDockerExecArguments(arguments_); } catch { return false; }
      })());
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
  if ((arguments_?.[2] ?? "").startsWith("--name=iat-b3-b24-")) {
    assertHermeticDockerCreateArguments(arguments_);
  } else {
    assertOfflineDockerCreateArguments(arguments_);
  }
  const nameArgument = arguments_.find((value) => value.startsWith("--name="));
  const name = nameArgument?.slice("--name=".length);
  if (!name || !/^iat-b3-(?:b15-[a-z0-9-]{1,80}|b24-[0-9a-f]{16}-(?:law|economy))$/u.test(name)) {
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
  const expectedTmpfs = name.startsWith("iat-b3-b24-")
    ? {
        "/tmp": "rw,nosuid,nodev,noexec,size=268435456",
        [HERMETIC_PRIVATE_ROOT]:
          `rw,nosuid,nodev,exec,size=${HERMETIC_PRIVATE_STORE_BYTES},uid=0,gid=0,mode=0755`,
        [HERMETIC_BUILD_ROOT]:
          `rw,nosuid,nodev,exec,size=${HERMETIC_BUILD_STORE_BYTES},uid=65534,gid=65534,mode=0700`,
      }
    : { "/tmp": "rw,nosuid,nodev,noexec,size=268435456" };
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
    || (name.startsWith("iat-b3-b24-") && !["", "0", "0:0"].includes(record.Config?.User))
    || record.HostConfig?.NetworkMode !== "none"
    || record.HostConfig?.ReadonlyRootfs !== true
    || disposableDevnetExecutionCanonicalJson(record.HostConfig?.Tmpfs)
      !== disposableDevnetExecutionCanonicalJson(expectedTmpfs)
    || (name.startsWith("iat-b3-b24-") && record.HostConfig?.PidsLimit !== 512)
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
  execArguments,
  hermeticPlan,
  environment,
  expectedImageId,
  stageRoot,
  invocationRecords,
  nextOrdinal,
  exportRoot,
  expectedOutputFileName,
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
    assertContainerExportDirectoryStable(exportRoot, { mode: 0o703, entries: [] });
    const preexisting = invoke("preexisting-absence-proof", [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "container", "inspect", name,
    ], true);
    assertAbsent(preexisting);
    assertContainerExportDirectoryStable(exportRoot, { mode: 0o703, entries: [] });
    creationAttempted = true;
    const creation = invoke("create", createArguments);
    const containerId = creation.stdout.toString("utf8").trim();
    if (!/^[0-9a-f]{64}$/u.test(containerId)) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_CONTAINER_ID_INVALID");
    }
    assertContainerExportDirectoryStable(exportRoot, { mode: 0o703, entries: [] });
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
    assertContainerExportDirectoryStable(exportRoot, { mode: 0o703, entries: [] });
    const start = invoke("start", [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "container", "start", name,
    ]);
    if (start.stderr.length !== 0 || start.stdout.toString("utf8") !== `${name}\n`) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_CONTAINER_START_OUTPUT_HOLD");
    }
    const running = invoke("inspect-running", [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "container", "inspect", name,
    ]);
    parseContainerInspect(running.stdout, {
      name,
      expectedState: "running",
      expectedImageId,
      expectedContainerId: containerId,
      createArguments,
      environment,
    });
    commandOutput = invoke("exec", execArguments);
    assertContainerExportDirectoryStable(
      exportRoot,
      { mode: 0o703, entries: [expectedOutputFileName] },
    );
    const initializerLogs = invoke("initializer-logs", [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "container", "logs", name,
    ]);
    if (initializerLogs.stderr.length !== 0
      || !validateDisposableDevnetHermeticInitializerFrame(
        initializerLogs.stdout,
        hermeticPlan,
      )) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_INITIALIZER_LOG_BINDING_HOLD");
    }
    const stop = invoke("stop", [
      `--host=${PINNED_COMBINED_LAW_BUILD_CONTAINER.dockerEndpoint}`,
      "container", "stop", "--time=10", name,
    ]);
    if (stop.stderr.length !== 0 || stop.stdout.toString("utf8") !== `${name}\n`) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_CONTAINER_STOP_OUTPUT_HOLD");
    }
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
    assertContainerExportDirectoryStable(
      exportRoot,
      { mode: 0o703, entries: [expectedOutputFileName] },
    );
    cleanupAndProveAbsence("normal-cleanup");
    assertContainerExportDirectoryStable(
      exportRoot,
      { mode: 0o703, entries: [expectedOutputFileName] },
    );
    const selectedRecords = invocationRecords.slice(invocationStartIndex);
    const observation = deepFreeze({
      containerId,
      name,
      invocationOrdinals: selectedRecords.map(({ ordinal }) => ordinal),
      invocationClosureSha256: disposableDevnetExecutionCanonicalSha256(selectedRecords),
      imageId: expectedImageId,
      initializationFrameValidated: true,
      buildExecIdentity: "65534:65534",
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

function readBuildArtifact(path, label) {
  const boundary = lstatSync(path, { bigint: true });
  if (!boundary.isFile() || boundary.isSymbolicLink() || boundary.nlink !== 1n
    || boundary.uid !== 65_534n || boundary.gid !== 65_534n
    || (boundary.mode & 0o777n) !== 0o444n) {
    throw new Error(`${label}_EXPORT_MODE_OR_LINK_HOLD`);
  }
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
  const roots = {
    law: ensureContainerWritableExportDirectory(join(runRoot, "law")),
    economy: ensureContainerWritableExportDirectory(join(runRoot, "economy")),
  };
  const observations = {};
  for (const kind of ["law", "economy"]) {
    const recipe = kind === "law"
      ? PRODUCTION_COMBINED_ARTIFACT_SBF_BUILD_RECIPE
      : ECONOMY_SBF_BUILD_RECIPE;
    const plan = createDisposableDevnetHermeticBuildContract({
      sourceClosure: {
        declaredHeadSha: sourceSnapshot.declaredHeadSha,
        treeSha: sourceSnapshot.treeSha,
        mountedInputSha256: sourceSnapshot.mountedInputSha256,
        entries: sourceSnapshot.entries,
      },
      sourceSnapshotRoot: sourceSnapshot.root,
      localByteRoots: HERMETIC_LOCAL_BYTE_HOST_ROOTS,
      exportRoot: roots[kind],
      ordinal,
      kind,
      laneId,
      identityEnvironment,
    });
    const container = executePinnedContainer({
      purpose: `run-${ordinal}-${kind}-build`,
      createArguments: plan.createArguments,
      execArguments: plan.execArguments,
      hermeticPlan: plan,
      environment: Object.freeze({ ...dockerEnvironment, ...plan.environment }),
      expectedImageId,
      stageRoot,
      invocationRecords,
      nextOrdinal,
      exportRoot: roots[kind],
      expectedOutputFileName: recipe.outputFileName,
    });
    closeContainerWritableExportDirectory(roots[kind], recipe.outputFileName);
    const artifact = readBuildArtifact(
      join(roots[kind], recipe.outputFileName),
      `DISPOSABLE_DEVNET_EXECUTION_RUN_${ordinal}_${kind.toUpperCase()}_ARTIFACT`,
    );
    const hermeticFrameValidation = validateDisposableDevnetHermeticFrameSequence(
      container.commandOutput.stdout,
      { contract: plan.contract, exportedArtifactBytes: artifact.bytes },
    );
    observations[kind] = deepFreeze({
      container: container.observation,
      hermeticContract: plan.contract,
      hermeticFrameValidation,
      sourceArtifact: {
        sha256: artifact.sha256,
        byteLength: artifact.byteLength,
        device: artifact.device,
        inode: artifact.inode,
      },
      preservedArtifact: persistArtifact(stageRoot, ordinal, kind, artifact),
    });
    releaseContainerExportDirectory(roots[kind], recipe.outputFileName);
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
  const containers = builds.flatMap((build) => [build.law.container, build.economy.container]);
  if (toolchain.verificationAuthority !== "SAME_BUILD_CONTAINER_PRIVATE_COPY_PRE_POST_FRAMES"
    || disposableDevnetExecutionCanonicalJson(toolchain.localByteClosure)
      !== disposableDevnetExecutionCanonicalJson(PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE)
    || toolchain.requiredBuildFrameCount !== 12
    || toolchain.validatedBuildFrameCount !== 12
    || toolchain.executionObserved !== true
    || containers.length !== 4
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

function collectRetainedEvidenceDescriptors({
  preservedSourceClosure,
  preservedIdentityInput,
  preservedGenesisInput,
  invocationRecords,
  builds,
}) {
  const descriptors = [
    preservedSourceClosure,
    preservedIdentityInput,
    preservedGenesisInput,
    ...invocationRecords.flatMap(({ stdout, stderr }) => [stdout, stderr]),
    ...builds.flatMap(({ law, economy }) => [law.preservedArtifact, economy.preservedArtifact]),
  ];
  return normalizeRetainedDescriptors(descriptors);
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
  retainedFileLedger,
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
    retainedFileLedger,
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
  // prove which inode the Docker daemon mounted across initializer start and
  // the later unprivileged exec. Do not
  // inspect paths, read inputs, create output/build roots, invoke a process, or
  // create a live-branded record until the same-container private-copy and
  // retained-file-ledger contracts are independently accepted and a later,
  // explicit source change replaces this categorical guard.
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
    const evidenceRoot = ensureDirectory(join(stageRoot, "evidence"));
    ensureDirectory(join(evidenceRoot, "logs"));
    ensureDirectory(join(evidenceRoot, "artifacts"));
    ensureDirectory(join(evidenceRoot, "inputs"));
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
        join(evidenceRoot, "inputs", "materialized-source-closure.cjson"),
        Buffer.from(`${disposableDevnetExecutionCanonicalJson({
          ...sourceClosureCore,
          closureSha256: sourceClosureSha256,
        })}\n`, "utf8"),
      ),
      evidenceRoot,
    );
    const preservedIdentityInput = relativeFileDescriptor(
      writeExclusiveFile(join(evidenceRoot, "inputs", "disposable-identities.json"), identityFile.bytes),
      evidenceRoot,
    );
    const preservedGenesisInput = relativeFileDescriptor(
      writeExclusiveFile(join(evidenceRoot, "inputs", "devnet-genesis.json"), genesisFile.bytes),
      evidenceRoot,
    );
    const dockerConfigRoot = ensureDirectory(join(buildRoot, "docker-client-home"));
    const dockerEnvironment = safeDockerEnvironment({ dockerConfigRoot, declaredHeadSha });
    const dockerRuntimeObservations = [observePinnedDockerRuntime({
      dockerEnvironment,
      stageRoot: evidenceRoot,
      invocationRecords,
      nextOrdinal,
    })];
    const imageObservations = [inspectPinnedContainer({
      dockerEnvironment,
      stageRoot: evidenceRoot,
      invocationRecords,
      nextOrdinal,
    })];
    const toolchainContract = deepFreeze({
      verificationAuthority: "SAME_BUILD_CONTAINER_PRIVATE_COPY_PRE_POST_FRAMES",
      localByteClosure: PINNED_DISPOSABLE_DEVNET_LOCAL_BYTE_CLOSURE,
      requiredBuildFrameCount: 12,
      rustc: RUSTC_VERSION,
      cargo: CARGO_VERSION,
      cargoBuildSbf: CARGO_BUILD_SBF_VERSION,
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
        stageRoot: evidenceRoot,
        invocationRecords,
        nextOrdinal,
        expectedImageId: imageObservations[0].localImageId,
      }));
      sourceObservations.push(observeExactSource(REPOSITORY_ROOT));
      materializedSourceObservations.push(observeMaterializedSourceSnapshot(sourceSnapshot));
    }
    dockerRuntimeObservations.push(observePinnedDockerRuntime({
      dockerEnvironment,
      stageRoot: evidenceRoot,
      invocationRecords,
      nextOrdinal,
    }));
    imageObservations.push(inspectPinnedContainer({
      dockerEnvironment,
      stageRoot: evidenceRoot,
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
    const toolchain = deepFreeze({
      ...toolchainContract,
      validatedBuildFrameCount: builds.length * 2 * HERMETIC_FRAME_PHASES.length,
      executionObserved: true,
    });
    const equality = assertDualBuildEquality(builds);
    const executionClosure = assertInvocationAndContainerClosure({
      invocationRecords,
      toolchain,
      builds,
    });
    const preservedKeyScan = scanDisposableDevnetBuildTreeForKeyMaterial(evidenceRoot);
    const retainedEvidenceDescriptors = collectRetainedEvidenceDescriptors({
      preservedSourceClosure,
      preservedIdentityInput,
      preservedGenesisInput,
      invocationRecords,
      builds,
    });
    const retainedEvidenceLedger = createDisposableDevnetRetainedFileLedger(
      evidenceRoot,
      retainedEvidenceDescriptors,
    );
    validateDisposableDevnetRetainedFileLedger(evidenceRoot, retainedEvidenceLedger);

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
      retainedFileLedger: retainedEvidenceLedger,
    });
    const transcriptBytes = Buffer.from(
      `${disposableDevnetExecutionCanonicalJson(transcript)}\n`,
      "utf8",
    );
    assertOutputStageStable(stageRoot);
    const transcriptDescriptor = relativeFileDescriptor(
      writeExclusiveFile(join(stageRoot, "transcript.json"), transcriptBytes),
      stageRoot,
    );
    assertOutputStageStable(stageRoot);
    const transcriptReadback = readStableRegularFile(join(output.target, "transcript.json"), {
      label: "DISPOSABLE_DEVNET_EXECUTION_FINAL_TRANSCRIPT",
      maximumBytes: 8 * 1024 * 1024,
    });
    if (!transcriptReadback.bytes.equals(transcriptBytes)) {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_FINAL_TRANSCRIPT_READBACK_HOLD");
    }
    const outputPromotion = createDisposableDevnetFinalOutputStagePromotion({
      stageRoot,
      retainedEvidenceLedger,
      retainedEvidenceDescriptors,
      transcriptDescriptor,
    });
    if (outputPromotion.outputStageFilesystemPromotionValidated !== true
      || outputPromotion.executionProvenanceObserved !== false
      || outputPromotion.buildExecutionObserved !== false
      || outputPromotion.releaseAuthorized !== false
      || outputPromotion.mainnetStatus !== "HOLD") {
      throw new Error("DISPOSABLE_DEVNET_EXECUTION_OUTPUT_PROMOTION_TRUTH_HOLD");
    }
    assertOutputStageStable(stageRoot);
    validateDisposableDevnetRetainedFileLedger(stageRoot, outputPromotion.finalLedger);
    PROCESS_CREATED_STAGES.delete(stageRoot);
    stagePromoted = true;
    return deepFreeze({ transcript, outputPromotion });
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

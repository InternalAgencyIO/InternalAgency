import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative } from "node:path";

export const NATIVE_WSL_BUILD_BACKEND =
  "NATIVE_WSL_LINUX_AMD64_PINNED_TOOLCHAIN";
export const DOCKER_BUILD_BACKEND = "PINNED_OFFLINE_CONTAINER";
export const REPRODUCIBLE_BUILD_BACKEND_ENV =
  "IAT_B3_REPRODUCIBLE_BUILD_BACKEND";
export const NATIVE_WSL_BUILD_PREFLIGHT_SCHEMA =
  "iat-b3-native-wsl-linux-amd64-build-preflight/v1";
export const NATIVE_WSL_BUILD_RECEIPT_SCHEMA =
  "iat-b3-native-wsl-linux-amd64-exact-source-dual-sbf-build/v1";
export const NATIVE_WSL_BUILD_RECEIPT_STATUS =
  "EXACT_SOURCE_DUAL_FRESH_SBF_BYTE_EQUALITY_VERIFIED";
export const NATIVE_WSL_BUILD_READY = "READY_TO_EXECUTE_DUAL_BUILD";
export const NATIVE_WSL_BUILD_HOLD = "HOLD";
export const NATIVE_WSL_EXECUTION_MODE = "OBSERVATION_PREFLIGHT_ONLY";

export const NATIVE_WSL_FUTURE_EXECUTION_CONTRACT = Object.freeze({
  mode: NATIVE_WSL_EXECUTION_MODE,
  immutableHermeticRootfsDirectlyProven: false,
  buildExecutionPermitted: false,
  buildReceiptCreationPermitted: false,
  buildReceiptAcceptancePermitted: false,
  requiredBeforeEnablement: Object.freeze({
    immutableRootfsDigest: true,
    completeBuildInputClosure: true,
    solanaSdkTreeBinding: true,
    cargoRegistryIndexBinding: true,
    dynamicRuntimeClosureBinding: true,
    recursiveWholeBuildRootKeyMaterialRejection: true,
    preservedRawStdoutAndStderrPerRun: true,
    preservedLogSha256AndByteLengthPerRun: true,
    independentlyReconstructedSourceAndToolchainBindings: true,
  }),
});

const HEX_SHA1 = /^[0-9a-f]{40}$/u;
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const REGISTRY_SOURCE = "registry+https://github.com/rust-lang/crates.io-index";
// Discover the observed user's WSL home at runtime. Exact executable and tree
// hashes below still fail closed for any different installation, and the native
// backend remains observation-only with build/receipt creation disabled.
const NATIVE_WSL_OBSERVED_HOME = homedir();
const REGISTRY_CACHE_ROOT = join(
  NATIVE_WSL_OBSERVED_HOME,
  ".cargo",
  "registry",
  "cache",
);
const REGISTRY_INDEX_ROOT = join(
  NATIVE_WSL_OBSERVED_HOME,
  ".cargo",
  "registry",
  "index",
);
const RUST_TOOLCHAIN_ROOT = join(
  NATIVE_WSL_OBSERVED_HOME,
  ".rustup",
  "toolchains",
  "1.97.1-x86_64-unknown-linux-gnu",
);
const SOLANA_RELEASE_ROOT = join(
  NATIVE_WSL_OBSERVED_HOME,
  ".local",
  "share",
  "solana",
  "install",
  "releases",
  "3.1.10",
  "solana-release",
);
const PLATFORM_TOOLS_ROOT = join(
  NATIVE_WSL_OBSERVED_HOME,
  ".cache",
  "solana",
  "v1.52",
  "platform-tools",
);

export const NATIVE_WSL_PINNED_TOOLCHAIN_POLICY = Object.freeze({
  backend: NATIVE_WSL_BUILD_BACKEND,
  platform: "linux",
  architecture: "x64",
  kernelMachine: "x86_64",
  distribution: "Ubuntu-24.04",
  networkIsolation: "UNSHARE_NEW_NETWORK_NAMESPACE_PLUS_CARGO_OFFLINE",
  filesystemIsolation:
    "UNSHARE_NEW_MOUNT_NAMESPACE_READONLY_SOURCE_TOOLCHAINS_AND_REGISTRY_CACHE",
  freshRegistryExtractionPerBuild: true,
  cargoLockRegistryOnly: true,
  paths: Object.freeze({
    node: join(
      NATIVE_WSL_OBSERVED_HOME,
      ".local",
      "node-v24.10.0-linux-x64",
      "bin",
      "node",
    ),
    rustToolchainRoot: RUST_TOOLCHAIN_ROOT,
    rustc: join(RUST_TOOLCHAIN_ROOT, "bin", "rustc"),
    cargo: join(RUST_TOOLCHAIN_ROOT, "bin", "cargo"),
    cargoBuildSbf: join(SOLANA_RELEASE_ROOT, "bin", "cargo-build-sbf"),
    solanaReleaseRoot: SOLANA_RELEASE_ROOT,
    platformToolsRoot: PLATFORM_TOOLS_ROOT,
    platformRustc: join(PLATFORM_TOOLS_ROOT, "rust", "bin", "rustc"),
    platformCargo: join(PLATFORM_TOOLS_ROOT, "rust", "bin", "cargo"),
    platformClang: join(PLATFORM_TOOLS_ROOT, "llvm", "bin", "clang-20"),
    platformObjcopy: join(PLATFORM_TOOLS_ROOT, "llvm", "bin", "llvm-objcopy"),
    platformVersion: join(PLATFORM_TOOLS_ROOT, "version.md"),
    registryCacheRoot: REGISTRY_CACHE_ROOT,
    registryIndexRoot: REGISTRY_INDEX_ROOT,
    unshare: "/usr/bin/unshare",
    mount: "/usr/bin/mount",
    bash: "/usr/bin/bash",
    env: "/usr/bin/env",
  }),
  versions: Object.freeze({
    node: "v24.10.0",
    rustc: "rustc 1.97.1 (8bab26f4f 2026-07-14)",
    cargo: "cargo 1.97.1 (c980f4866 2026-06-30)",
    cargoBuildSbf:
      "solana-cargo-build-sbf 3.1.10\nplatform-tools v1.52\nrustc 1.89.0",
  }),
  sha256: Object.freeze({
    node: "141542ec0c8f73b568cd774ea8df43f23768cb086eb5bf21d2dea33072fb2f56",
    rustc: "d3a664c970a9fd8361b64194861bebc1ae37b9054e5ee3400dc1c9e691797eea",
    cargo: "828980723df339d62434390e9fb8ef8831036583343ae2316b7ab5646b5c1953",
    cargoBuildSbf:
      "4f62f903ff5f97262b000111dfc776bf63d5658733fd4f11bb0a545f87f85560",
    platformRustc:
      "d95c95b68e321ad76634e1fd26b0a7c20ccdbae9ad9ca733f3ae2f2b4a0b6002",
    platformCargo:
      "b4171a5b807c0d54cd02fe2ca2ae9505d6bd1c9c8d1d8b23e5189de9abdd4f98",
    platformClang:
      "76e4fab466de587cea7d0bf864b96a7047235303ee48570b10eaba0e2e4820ca",
    platformObjcopy:
      "673b3b86f0b1b8eadd755e29e2f66a7582248ef3bda7a267fbb370b733c1cb69",
    platformVersion:
      "851c4d2be2cc6a20594232180aaefabf5b694d15ad67505b75d725fb5721327c",
    rustToolchainTree:
      "e24d358f231f1c80a2a08232f88ccb5bce7ff1b3225a0984c888964d2726a1c3",
    platformToolsTree:
      "abc9dbceaca37c3ae168b7ab7fe0b667941fbd3a06e106931ddc393f99bf8e0f",
    unshare:
      "51bcc77ba5db162c80028f861f0a2770d728c1de80773816d863f28d7a817adb",
    mount: "ac5aa68d34add5a33ae81ac3a971aea677c4032d768aab5a3c4c2707f728885e",
    bash: "bc5945feb8bd26203ebfafea5ce1878bb2e32cb8fb50ab7ae395cfb1e1aaaef1",
    env: "595f3912fa7d5f91b45cac22a4a772b23232ace24ff9d82ee47cc762c59be5e1",
  }),
  trees: Object.freeze({
    rustToolchain: Object.freeze({
      entryCount: 188,
      fileCount: 166,
      directoryCount: 22,
      symlinkCount: 0,
      byteLength: 653_573_351,
    }),
    platformTools: Object.freeze({
      entryCount: 3_828,
      fileCount: 3_198,
      directoryCount: 618,
      symlinkCount: 12,
      byteLength: 1_663_263_438,
    }),
  }),
});

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

export function nativeCanonicalSha256(value) {
  return sha256(JSON.stringify(canonicalize(value)));
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function exactKeys(value, keys) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function freezeResult(value) {
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) freezeResult(child);
  }
  return Object.freeze(value);
}

function isCanonicalTimestamp(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString() === value;
}

function execute(command, arguments_, options = {}) {
  const result = (options.runner ?? spawnSync)(command, arguments_, {
    cwd: options.cwd,
    env: options.env,
    input: options.input,
    encoding: options.binary === true ? null : "utf8",
    timeout: options.timeout ?? 120_000,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    const detail = result.error instanceof Error
      ? result.error.message
      : Buffer.isBuffer(result.stderr)
        ? result.stderr.toString("utf8")
        : result.stderr;
    throw new Error(
      `IAT_B3_NATIVE_WSL_COMMAND_FAILED_${basename(command)}: ${String(detail).slice(0, 512)}`,
    );
  }
  return result;
}

function observeFile(path, expectedSha256) {
  if (typeof path !== "string" || !isAbsolute(path)) {
    throw new Error("IAT_B3_NATIVE_WSL_ABSOLUTE_TOOL_PATH_REQUIRED");
  }
  const stat = lstatSync(path);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`IAT_B3_NATIVE_WSL_REGULAR_TOOL_REQUIRED_${basename(path)}`);
  }
  const digest = sha256(readFileSync(path));
  if (digest !== expectedSha256) {
    throw new Error(`IAT_B3_NATIVE_WSL_TOOL_SHA256_DRIFT_${basename(path)}`);
  }
  return Object.freeze({ path, sha256: digest, byteLength: stat.size });
}

export function hashNativeToolTree(root) {
  if (typeof root !== "string" || !isAbsolute(root)) {
    throw new Error("IAT_B3_NATIVE_WSL_TOOL_TREE_ABSOLUTE_ROOT_REQUIRED");
  }
  const realRoot = realpathSync(root);
  if (realRoot !== root) throw new Error("IAT_B3_NATIVE_WSL_TOOL_TREE_REALPATH_DRIFT");
  const entries = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const relativePath = relative(root, path).replaceAll("\\", "/");
      entries.push({ path, relativePath });
      if (entry.isDirectory() && !entry.isSymbolicLink()) walk(path);
    }
  };
  walk(root);
  entries.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  const aggregate = createHash("sha256");
  let fileCount = 0;
  let directoryCount = 0;
  let symlinkCount = 0;
  let byteLength = 0;
  for (const { path, relativePath } of entries) {
    const stat = lstatSync(path);
    let type = "OTHER";
    let content = "";
    if (stat.isSymbolicLink()) {
      type = "L";
      content = readlinkSync(path);
      symlinkCount += 1;
    } else if (stat.isDirectory()) {
      type = "D";
      directoryCount += 1;
    } else if (stat.isFile()) {
      type = "F";
      const bytes = readFileSync(path);
      content = sha256(bytes);
      fileCount += 1;
      byteLength += bytes.length;
    }
    aggregate.update(
      `${type}\0${relativePath}\0${(stat.mode & 0o7777).toString(8)}\0${stat.size}\0${content}\0`,
    );
  }
  return Object.freeze({
    root,
    sha256: aggregate.digest("hex"),
    entryCount: entries.length,
    fileCount,
    directoryCount,
    symlinkCount,
    byteLength,
  });
}

function assertTreeObservation(observation, label, expectedSha256, expectedCounts) {
  if (observation.sha256 !== expectedSha256
    || canonicalJson({
      entryCount: observation.entryCount,
      fileCount: observation.fileCount,
      directoryCount: observation.directoryCount,
      symlinkCount: observation.symlinkCount,
      byteLength: observation.byteLength,
    }) !== canonicalJson(expectedCounts)) {
    throw new Error(`IAT_B3_NATIVE_WSL_${label}_TREE_DRIFT_HOLD`);
  }
}

function observeVersion(path, arguments_ = ["--version"]) {
  return execute(path, arguments_).stdout.trim();
}

function verifyNamespaceIsolationCapability() {
  const script = [
    "set -euo pipefail",
    "test \"$(readlink /proc/self/ns/net)\" != \"$IAT_PARENT_NETNS\"",
    "test \"$(readlink /proc/self/ns/mnt)\" != \"$IAT_PARENT_MNTNS\"",
    "test \"$(ip route 2>/dev/null | wc -l)\" -eq 0",
  ].join("\n");
  const parentNet = readlinkSync("/proc/self/ns/net");
  const parentMount = readlinkSync("/proc/self/ns/mnt");
  execute(NATIVE_WSL_PINNED_TOOLCHAIN_POLICY.paths.unshare, [
    "--user",
    "--map-root-user",
    "--mount",
    "--net",
    "--fork",
    NATIVE_WSL_PINNED_TOOLCHAIN_POLICY.paths.env,
    "-i",
    `IAT_PARENT_NETNS=${parentNet}`,
    `IAT_PARENT_MNTNS=${parentMount}`,
    "PATH=/usr/bin:/bin",
    NATIVE_WSL_PINNED_TOOLCHAIN_POLICY.paths.bash,
    "-ceu",
    script,
  ]);
  return true;
}

export function observeNativeWslPinnedToolchain({
  platform = process.platform,
  architecture = process.arch,
  executablePath = process.execPath,
} = {}) {
  if (platform !== "linux" || architecture !== "x64") {
    throw new Error("IAT_B3_NATIVE_WSL_REQUIRES_LINUX_AMD64");
  }
  const policy = NATIVE_WSL_PINNED_TOOLCHAIN_POLICY;
  if (realpathSync(executablePath) !== policy.paths.node) {
    throw new Error("IAT_B3_NATIVE_WSL_NODE_PATH_DRIFT_HOLD");
  }
  const files = Object.freeze({
    node: observeFile(policy.paths.node, policy.sha256.node),
    rustc: observeFile(policy.paths.rustc, policy.sha256.rustc),
    cargo: observeFile(policy.paths.cargo, policy.sha256.cargo),
    cargoBuildSbf: observeFile(policy.paths.cargoBuildSbf, policy.sha256.cargoBuildSbf),
    platformRustc: observeFile(policy.paths.platformRustc, policy.sha256.platformRustc),
    platformCargo: observeFile(policy.paths.platformCargo, policy.sha256.platformCargo),
    platformClang: observeFile(policy.paths.platformClang, policy.sha256.platformClang),
    platformObjcopy: observeFile(policy.paths.platformObjcopy, policy.sha256.platformObjcopy),
    platformVersion: observeFile(policy.paths.platformVersion, policy.sha256.platformVersion),
    unshare: observeFile(policy.paths.unshare, policy.sha256.unshare),
    mount: observeFile(policy.paths.mount, policy.sha256.mount),
    bash: observeFile(policy.paths.bash, policy.sha256.bash),
    env: observeFile(policy.paths.env, policy.sha256.env),
  });
  const versions = Object.freeze({
    node: observeVersion(policy.paths.node),
    rustc: observeVersion(policy.paths.rustc),
    cargo: observeVersion(policy.paths.cargo),
    cargoBuildSbf: observeVersion(policy.paths.cargoBuildSbf),
  });
  if (canonicalJson(versions) !== canonicalJson(policy.versions)) {
    throw new Error("IAT_B3_NATIVE_WSL_TOOL_VERSION_DRIFT_HOLD");
  }
  const trees = Object.freeze({
    rustToolchain: hashNativeToolTree(policy.paths.rustToolchainRoot),
    platformTools: hashNativeToolTree(policy.paths.platformToolsRoot),
  });
  assertTreeObservation(
    trees.rustToolchain,
    "RUST",
    policy.sha256.rustToolchainTree,
    policy.trees.rustToolchain,
  );
  assertTreeObservation(
    trees.platformTools,
    "PLATFORM_TOOLS",
    policy.sha256.platformToolsTree,
    policy.trees.platformTools,
  );
  if (!lstatSync(policy.paths.registryCacheRoot).isDirectory()
    || !lstatSync(policy.paths.registryIndexRoot).isDirectory()
    || !verifyNamespaceIsolationCapability()) {
    throw new Error("IAT_B3_NATIVE_WSL_ISOLATION_PREREQUISITE_HOLD");
  }
  const core = { backend: NATIVE_WSL_BUILD_BACKEND, files, versions, trees };
  return freezeResult({ ...core, bindingSha256: nativeCanonicalSha256(core) });
}

function parseCargoLockPackages(cargoLockText) {
  if (typeof cargoLockText !== "string" || cargoLockText.length === 0) {
    throw new Error("IAT_B3_NATIVE_WSL_CARGO_LOCK_REQUIRED");
  }
  const packages = [];
  for (const block of cargoLockText.split(/^\[\[package\]\]\s*$/mu).slice(1)) {
    const field = (name) => block.match(new RegExp(`^${name} = "([^"]+)"$`, "mu"))?.[1] ?? null;
    const name = field("name");
    const version = field("version");
    const source = field("source");
    const checksum = field("checksum");
    if (!name || !version) throw new Error("IAT_B3_NATIVE_WSL_CARGO_LOCK_PACKAGE_INVALID");
    if (source === null) continue;
    if (source !== REGISTRY_SOURCE || !HEX_SHA256.test(checksum ?? "")) {
      throw new Error("IAT_B3_NATIVE_WSL_CARGO_LOCK_NON_REGISTRY_SOURCE_HOLD");
    }
    packages.push(Object.freeze({ name, version, checksum }));
  }
  packages.sort((left, right) => (
    `${left.name}\0${left.version}`.localeCompare(`${right.name}\0${right.version}`)
  ));
  if (packages.length === 0) throw new Error("IAT_B3_NATIVE_WSL_CARGO_LOCK_CLOSURE_EMPTY");
  return packages;
}

function findCrateArchives(fileName) {
  const candidates = [];
  for (const registryDirectory of readdirSync(REGISTRY_CACHE_ROOT, { withFileTypes: true })) {
    if (!registryDirectory.isDirectory() || registryDirectory.isSymbolicLink()) continue;
    const path = join(REGISTRY_CACHE_ROOT, registryDirectory.name, fileName);
    if (existsSync(path)) candidates.push(path);
  }
  candidates.sort();
  if (candidates.length === 0) {
    throw new Error(`IAT_B3_NATIVE_WSL_CRATE_ARCHIVE_REQUIRED_${fileName}`);
  }
  return candidates;
}

export function verifyNativeCargoLockArchiveClosure(cargoLockBytes) {
  const bytes = Buffer.isBuffer(cargoLockBytes)
    ? cargoLockBytes
    : Buffer.from(cargoLockBytes ?? "", "utf8");
  const packages = parseCargoLockPackages(bytes.toString("utf8"));
  const observations = packages.map(({ name, version, checksum }) => {
    const fileName = `${name}-${version}.crate`;
    const archives = findCrateArchives(fileName).map((path) => {
      const stat = lstatSync(path);
      if (!stat.isFile() || stat.isSymbolicLink()) {
        throw new Error(`IAT_B3_NATIVE_WSL_REGULAR_CRATE_ARCHIVE_REQUIRED_${fileName}`);
      }
      const observedSha256 = sha256(readFileSync(path));
      if (observedSha256 !== checksum) {
        throw new Error(`IAT_B3_NATIVE_WSL_CRATE_ARCHIVE_CHECKSUM_DRIFT_${fileName}`);
      }
      return Object.freeze({ path, byteLength: stat.size });
    });
    const byteLengths = new Set(archives.map(({ byteLength }) => byteLength));
    if (byteLengths.size !== 1) {
      throw new Error(`IAT_B3_NATIVE_WSL_CRATE_ARCHIVE_COPY_LENGTH_DRIFT_${fileName}`);
    }
    return Object.freeze({
      name,
      version,
      checksum,
      byteLength: archives[0].byteLength,
      archiveCopies: archives.length,
    });
  });
  const core = {
    lockSha256: sha256(bytes),
    sourcePolicy: "CARGO_LOCK_REGISTRY_CHECKSUMS_AND_FRESH_ARCHIVE_EXTRACTION",
    packageCount: observations.length,
    packagesSha256: nativeCanonicalSha256(observations),
  };
  return freezeResult({ ...core, bindingSha256: nativeCanonicalSha256(core) });
}

export function selectReproducibleBuildBackend(environment = process.env) {
  const selected = environment?.[REPRODUCIBLE_BUILD_BACKEND_ENV] ?? DOCKER_BUILD_BACKEND;
  if (![DOCKER_BUILD_BACKEND, NATIVE_WSL_BUILD_BACKEND].includes(selected)) {
    throw new Error("IAT_B3_REPRODUCIBLE_BUILD_BACKEND_INVALID");
  }
  return selected;
}

function check(id, passed) {
  return Object.freeze({ id, passed: passed === true });
}

export function createNativeWslBuildPreflight({
  generatedAt,
  programKind,
  source,
  runnerBinding,
  identityReady,
  sourceClosureReady,
  toolchainObservation,
  dependencyClosure,
  disk,
  recipe,
  minimumFreeBytes,
} = {}) {
  const checks = Object.freeze([
    check("CANONICAL_GENERATED_AT", isCanonicalTimestamp(generatedAt)),
    check("EXACT_SOURCE_HEAD_DECLARED", HEX_SHA1.test(source?.declaredHeadSha ?? "")),
    check("EXACT_SOURCE_HEAD_MATCH", source?.declaredHeadSha === source?.observedHeadSha),
    check(
      "REPOSITORY_CLEAN_TRACKED_AND_UNTRACKED",
      source?.statusPorcelain === "",
    ),
    check(
      "EXECUTED_RUNNER_MATCHES_DECLARED_HEAD",
      HEX_SHA256.test(runnerBinding?.executedRunnerSha256 ?? "")
        && runnerBinding.executedRunnerSha256 === runnerBinding.committedRunnerSha256,
    ),
    check("NATIVE_WSL_PINNED_TOOLCHAIN", toolchainObservation?.backend === NATIVE_WSL_BUILD_BACKEND),
    check("EXACT_CARGO_LOCK_ARCHIVE_CLOSURE", dependencyClosure?.packageCount > 0),
    check("PRODUCTION_IDENTITY_BINDING", identityReady === true),
    check("PRODUCTION_SOURCE_CLOSURE", sourceClosureReady === true),
    check(
      "BUILD_VOLUME_MINIMUM_FREE_BYTES",
      Number.isSafeInteger(disk?.freeBytes) && disk.freeBytes >= minimumFreeBytes,
    ),
    check("FROZEN_BUILD_RECIPE", recipe?.networkPolicy === "OFFLINE_PREINSTALLED_TOOLCHAIN_ONLY"),
    check(
      "HERMETIC_IMMUTABLE_ROOTFS_DIRECTLY_PROVEN",
      NATIVE_WSL_FUTURE_EXECUTION_CONTRACT.immutableHermeticRootfsDirectlyProven,
    ),
  ]);
  const blockers = Object.freeze(checks.filter(({ passed }) => !passed).map(({ id }) => id));
  const core = {
    schema: NATIVE_WSL_BUILD_PREFLIGHT_SCHEMA,
    status: blockers.length === 0 ? NATIVE_WSL_BUILD_READY : NATIVE_WSL_BUILD_HOLD,
    exitCode: blockers.length === 0 ? 0 : 2,
    generatedAt,
    programKind,
    executionBackend: NATIVE_WSL_BUILD_BACKEND,
    executionMode: NATIVE_WSL_EXECUTION_MODE,
    executionContract: NATIVE_WSL_FUTURE_EXECUTION_CONTRACT,
    buildExecuted: false,
    source: {
      declaredHeadSha: source?.declaredHeadSha ?? null,
      observedHeadSha: source?.observedHeadSha ?? null,
      observedTreeSha: source?.observedTreeSha ?? null,
      repositoryCleanTrackedAndUntracked: source?.statusPorcelain === "",
    },
    runnerBinding,
    toolchain: toolchainObservation,
    dependencyClosure,
    identityReady: identityReady === true,
    sourceClosureReady: sourceClosureReady === true,
    disk: { path: disk?.path ?? null, freeBytes: disk?.freeBytes ?? null, minimumFreeBytes },
    recipe,
    checks,
    blockers,
    safety: {
      sourceOnlyObservation: true,
      observationPreflightOnly: true,
      immutableHermeticRootfsDirectlyProven: false,
      buildExecutionPermitted: false,
      buildReceiptCreationPermitted: false,
      buildReceiptAcceptancePermitted: false,
      artifactCreated: false,
      keyGenerated: false,
      rpcUsed: false,
      networkUsed: false,
      signing: false,
      deployment: false,
      reproducibleBuildVerified: false,
      mainnetStatus: "HOLD",
    },
  };
  return freezeResult({ ...core, preflightSha256: nativeCanonicalSha256(core) });
}

function shellQuote(value) {
  if (typeof value !== "string" || value.includes("\0")) {
    throw new Error("IAT_B3_NATIVE_WSL_SHELL_ARGUMENT_INVALID");
  }
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function assertNativeWslObservationOnlyBuildDisabled() {
  throw new Error(
    "IAT_B3_NATIVE_WSL_OBSERVATION_PREFLIGHT_ONLY_IMMUTABLE_ROOTFS_NOT_PROVEN_HOLD",
  );
}

export function createNativeWslBuildInvocation({
  sourceRoot,
  buildRoot,
  recipeArguments,
  identityEnvironment,
  declaredHeadSha,
} = {}) {
  assertNativeWslObservationOnlyBuildDisabled();
  for (const path of [sourceRoot, buildRoot]) {
    if (typeof path !== "string" || !isAbsolute(path) || /[\r\n\0,]/u.test(path)) {
      throw new Error("IAT_B3_NATIVE_WSL_BUILD_PATH_INVALID");
    }
  }
  if (!Array.isArray(recipeArguments)
    || !recipeArguments.includes("--offline")
    || !recipeArguments.includes("--skip-tools-install")
    || !HEX_SHA1.test(declaredHeadSha ?? "")) {
    throw new Error("IAT_B3_NATIVE_WSL_BUILD_RECIPE_OR_HEAD_INVALID");
  }
  const names = Object.keys(identityEnvironment ?? {}).sort();
  if (names.length < 3
    || !names.every((name) => /^IAT_B3_PRODUCTION_[A-Z0-9_]+$/u.test(name))) {
    throw new Error("IAT_B3_NATIVE_WSL_IDENTITY_ENVIRONMENT_INVALID");
  }
  const cargoHome = join(buildRoot, "cargo-home");
  const cargoRegistry = join(cargoHome, "registry");
  const cargoCache = join(cargoRegistry, "cache");
  const cargoIndex = join(cargoRegistry, "index");
  const home = join(buildRoot, "home");
  const homePlatformTools = join(home, ".cache", "solana", "v1.52", "platform-tools");
  for (const path of [
    cargoHome,
    cargoRegistry,
    cargoCache,
    cargoIndex,
    home,
    homePlatformTools,
  ]) {
    mkdirSync(path, { recursive: true, mode: 0o700 });
  }
  const policy = NATIVE_WSL_PINNED_TOOLCHAIN_POLICY;
  const remountReadonly = (path) => [
    `${shellQuote(policy.paths.mount)} --bind ${shellQuote(path)} ${shellQuote(path)}`,
    `${shellQuote(policy.paths.mount)} -o remount,bind,ro ${shellQuote(path)}`,
  ];
  const buildArguments = recipeArguments.map((argument) => {
    if (argument === "<FRESH_OUTPUT_DIRECTORY>") return join(buildRoot, "output");
    if (argument === "<FRESH_TARGET_DIRECTORY>") return join(buildRoot, "target");
    return argument;
  });
  const environmentArguments = [
    `HOME=${home}`,
    `CARGO_HOME=${cargoHome}`,
    "CARGO_NET_OFFLINE=true",
    "CARGO_INCREMENTAL=0",
    "RUSTUP_TOOLCHAIN=1.97.1-x86_64-unknown-linux-gnu",
    "LANG=C.UTF-8",
    "LC_ALL=C.UTF-8",
    "TZ=UTC",
    `PATH=${dirname(policy.paths.cargo)}:${dirname(policy.paths.cargoBuildSbf)}:/usr/bin:/bin`,
    `IAT_B3_EXACT_SOURCE_HEAD_SHA=${declaredHeadSha}`,
    ...names.map((name) => `${name}=${identityEnvironment[name]}`),
  ];
  const script = [
    "set -euo pipefail",
    `${shellQuote(policy.paths.mount)} --make-rprivate /`,
    ...remountReadonly(sourceRoot),
    `${shellQuote(policy.paths.mount)} --bind ${shellQuote(REGISTRY_CACHE_ROOT)} ${shellQuote(cargoCache)}`,
    `${shellQuote(policy.paths.mount)} -o remount,bind,ro ${shellQuote(cargoCache)}`,
    `${shellQuote(policy.paths.mount)} --bind ${shellQuote(REGISTRY_INDEX_ROOT)} ${shellQuote(cargoIndex)}`,
    `${shellQuote(policy.paths.mount)} -o remount,bind,ro ${shellQuote(cargoIndex)}`,
    `${shellQuote(policy.paths.mount)} --bind ${shellQuote(policy.paths.platformToolsRoot)} ${shellQuote(homePlatformTools)}`,
    `${shellQuote(policy.paths.mount)} -o remount,bind,ro ${shellQuote(homePlatformTools)}`,
    ...remountReadonly(policy.paths.rustToolchainRoot),
    ...remountReadonly(policy.paths.solanaReleaseRoot),
    ...remountReadonly(policy.paths.platformToolsRoot),
    `cd ${shellQuote(sourceRoot)}`,
    `exec ${shellQuote(policy.paths.env)} -i ${environmentArguments.map(shellQuote).join(" ")} ${shellQuote(policy.paths.cargo)} ${buildArguments.map(shellQuote).join(" ")}`,
  ].join("\n");
  return freezeResult({
    command: policy.paths.unshare,
    arguments: [
      "--user",
      "--map-root-user",
      "--mount",
      "--net",
      "--pid",
      "--fork",
      "--mount-proc",
      policy.paths.bash,
      "-ceu",
      script,
    ],
    networkNamespace: true,
    sourceReadonly: true,
    toolchainsReadonly: true,
    registryArchivesReadonly: true,
    freshRegistryExtraction: true,
  });
}

export function executeNativeWslFreshBuild({
  sourceRoot,
  buildRoot,
  recipe,
  identityEnvironment,
  declaredHeadSha,
  expectedOutputFileName,
  runLabel,
} = {}) {
  assertNativeWslObservationOnlyBuildDisabled();
  const invocation = createNativeWslBuildInvocation({
    sourceRoot,
    buildRoot,
    recipeArguments: recipe?.arguments,
    identityEnvironment,
    declaredHeadSha,
  });
  const result = execute(invocation.command, invocation.arguments, { timeout: 30 * 60 * 1_000 });
  const logBytes = Buffer.from(
    `IAT_B3_NATIVE_WSL_BUILD_RUN=${runLabel}\n${result.stdout}\n${result.stderr}`,
    "utf8",
  );
  if (/Stack offset of|stack frame of [0-9]+ bytes exceeds|max offset exceeded|overwrites values|undefined behavior/iu
    .test(logBytes.toString("utf8"))) {
    throw new Error("IAT_B3_NATIVE_WSL_UNSAFE_COMPILER_DIAGNOSTIC_HOLD");
  }
  const outputDirectory = join(buildRoot, "output");
  const entries = readdirSync(outputDirectory, { withFileTypes: true });
  if (entries.length !== 1
    || entries[0].name !== expectedOutputFileName
    || !entries[0].isFile()
    || entries[0].isSymbolicLink()) {
    throw new Error("IAT_B3_NATIVE_WSL_EXACT_SBF_OUTPUT_SET_REQUIRED");
  }
  const artifactPath = join(outputDirectory, expectedOutputFileName);
  const stat = lstatSync(artifactPath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0) {
    throw new Error("IAT_B3_NATIVE_WSL_REGULAR_NONEMPTY_SBF_REQUIRED");
  }
  return Object.freeze({
    fileName: expectedOutputFileName,
    bytes: readFileSync(artifactPath),
    logSha256: sha256(logBytes),
    artifactPath,
  });
}

const NATIVE_RECEIPT_KEYS = Object.freeze([
  "schema",
  "status",
  "generatedAt",
  "programKind",
  "executionBackend",
  "source",
  "identityBinding",
  "sourceClosure",
  "dependencyClosure",
  "toolchain",
  "recipe",
  "artifact",
  "safety",
  "receiptSha256",
]);
const NATIVE_SOURCE_KEYS = Object.freeze([
  "declaredHeadSha", "observedHeadSha", "observedTreeSha",
  "repositoryCleanTrackedAndUntracked", "revalidationCount",
  "executedRunnerSha256", "committedRunnerSha256", "materializationSchema",
  "materializedTreeSha", "mountedInputSha256", "materializedFileCount",
  "materializedByteLength", "lfsPointerCount", "ignoredWorktreeBytesIncluded",
  "submodulePolicy", "lfsPolicy", "materializationRevalidationCount",
]);
const NATIVE_IDENTITY_KEYS = Object.freeze([
  "manifestSha256", "environmentBindingSha256", "inputNames", "bindingSha256",
]);
const NATIVE_SOURCE_CLOSURE_KEYS = Object.freeze(["value", "bindingSha256"]);
const NATIVE_DEPENDENCY_KEYS = Object.freeze([
  "lockSha256", "sourcePolicy", "packageCount", "packagesSha256", "bindingSha256",
]);
const NATIVE_TOOLCHAIN_KEYS = Object.freeze([
  "policy", "observationBindingSha256", "revalidationCount",
]);
const NATIVE_RECIPE_KEYS = Object.freeze(["value", "bindingSha256"]);
const NATIVE_ARTIFACT_KEYS = Object.freeze([
  "fileName", "byteLength", "sha256", "firstBuildSha256", "secondBuildSha256",
  "firstBuildLogSha256", "secondBuildLogSha256", "preservedArtifactSha256",
  "preservedArtifactByteLength", "identicalBytes", "distinctBuildLogs",
  "preservedOutputAtomicNoOverwrite", "preservedOutputReadbackVerified",
]);
const NATIVE_SAFETY_KEYS = Object.freeze([
  "publicNetworkWrites", "signing", "deployment", "keyGeneration", "rpc",
  "adversarialDevnetFinalBinaryAccepted", "productionCandidate",
  "mainnetExecutionAuthorized", "reproducibleBuildVerified", "mainnetStatus",
]);

export function createNativeWslBuildReceipt({
  generatedAt,
  programKind,
  source,
  identityBinding,
  sourceClosure,
  dependencyClosure,
  toolchainObservations,
  recipe,
  firstArtifact,
  secondArtifact,
  preservedArtifact,
} = {}) {
  assertNativeWslObservationOnlyBuildDisabled();
  if (!isCanonicalTimestamp(generatedAt)
    || !["LAW", "ECONOMY"].includes(programKind)
    || !Array.isArray(toolchainObservations)
    || toolchainObservations.length < 3
    || !toolchainObservations.every(
      (value) => value?.bindingSha256 === toolchainObservations[0]?.bindingSha256,
    )) {
    throw new Error("IAT_B3_NATIVE_WSL_RECEIPT_INPUT_INVALID");
  }
  const normalize = (artifact, label) => {
    if (!artifact || !Buffer.isBuffer(artifact.bytes) || artifact.bytes.length === 0
      || !HEX_SHA256.test(artifact.logSha256 ?? "")) {
      throw new Error(`IAT_B3_NATIVE_WSL_${label}_ARTIFACT_INVALID`);
    }
    return {
      fileName: artifact.fileName,
      bytes: artifact.bytes,
      byteLength: artifact.bytes.length,
      sha256: sha256(artifact.bytes),
      logSha256: artifact.logSha256,
    };
  };
  const first = normalize(firstArtifact, "FIRST");
  const second = normalize(secondArtifact, "SECOND");
  if (first.fileName !== recipe.outputFileName
    || second.fileName !== first.fileName
    || first.logSha256 === second.logSha256
    || first.byteLength !== second.byteLength
    || first.sha256 !== second.sha256
    || !first.bytes.equals(second.bytes)
    || !preservedArtifact?.bytes?.equals(first.bytes)
    || preservedArtifact.atomicNoOverwrite !== true
    || preservedArtifact.readbackVerified !== true) {
    throw new Error("IAT_B3_NATIVE_WSL_DUAL_BUILD_OR_PRESERVED_ARTIFACT_MISMATCH_HOLD");
  }
  const normalizedIdentityBinding = {
    manifestSha256: identityBinding?.manifestSha256,
    environmentBindingSha256: identityBinding?.environmentBindingSha256,
    inputNames: [...(identityBinding?.inputNames ?? [])],
  };
  const core = {
    schema: NATIVE_WSL_BUILD_RECEIPT_SCHEMA,
    status: NATIVE_WSL_BUILD_RECEIPT_STATUS,
    generatedAt,
    programKind,
    executionBackend: NATIVE_WSL_BUILD_BACKEND,
    source,
    identityBinding: {
      ...normalizedIdentityBinding,
      bindingSha256: nativeCanonicalSha256(normalizedIdentityBinding),
    },
    sourceClosure: {
      value: sourceClosure,
      bindingSha256: nativeCanonicalSha256(sourceClosure),
    },
    dependencyClosure,
    toolchain: {
      policy: NATIVE_WSL_PINNED_TOOLCHAIN_POLICY,
      observationBindingSha256: toolchainObservations[0].bindingSha256,
      revalidationCount: toolchainObservations.length,
    },
    recipe: {
      value: recipe,
      bindingSha256: nativeCanonicalSha256(recipe),
    },
    artifact: {
      fileName: first.fileName,
      byteLength: first.byteLength,
      sha256: first.sha256,
      firstBuildSha256: first.sha256,
      secondBuildSha256: second.sha256,
      firstBuildLogSha256: first.logSha256,
      secondBuildLogSha256: second.logSha256,
      preservedArtifactSha256: first.sha256,
      preservedArtifactByteLength: first.byteLength,
      identicalBytes: true,
      distinctBuildLogs: true,
      preservedOutputAtomicNoOverwrite: true,
      preservedOutputReadbackVerified: true,
    },
    safety: {
      publicNetworkWrites: false,
      signing: false,
      deployment: false,
      keyGeneration: false,
      rpc: false,
      adversarialDevnetFinalBinaryAccepted: false,
      productionCandidate: false,
      mainnetExecutionAuthorized: false,
      reproducibleBuildVerified: true,
      mainnetStatus: "HOLD",
    },
  };
  const receipt = freezeResult({ ...core, receiptSha256: nativeCanonicalSha256(core) });
  validateNativeWslBuildReceipt(receipt, {
    programKind,
    recipe,
    outputFileName: recipe.outputFileName,
  });
  return receipt;
}

export function validateNativeWslBuildReceipt(receipt, {
  programKind,
  recipe,
  outputFileName,
} = {}) {
  assertNativeWslObservationOnlyBuildDisabled();
  if (!exactKeys(receipt, NATIVE_RECEIPT_KEYS)
    || receipt.schema !== NATIVE_WSL_BUILD_RECEIPT_SCHEMA
    || receipt.status !== NATIVE_WSL_BUILD_RECEIPT_STATUS
    || receipt.programKind !== programKind
    || receipt.executionBackend !== NATIVE_WSL_BUILD_BACKEND
    || !isCanonicalTimestamp(receipt.generatedAt)
    || !exactKeys(receipt.toolchain, NATIVE_TOOLCHAIN_KEYS)
    || canonicalJson(receipt.toolchain?.policy)
      !== canonicalJson(NATIVE_WSL_PINNED_TOOLCHAIN_POLICY)
    || !HEX_SHA256.test(receipt.toolchain?.observationBindingSha256 ?? "")
    || !Number.isSafeInteger(receipt.toolchain?.revalidationCount)
    || receipt.toolchain.revalidationCount < 3
    || !exactKeys(receipt.recipe, NATIVE_RECIPE_KEYS)
    || receipt.recipe?.bindingSha256 !== nativeCanonicalSha256(recipe)
    || canonicalJson(receipt.recipe?.value) !== canonicalJson(recipe)
    || !exactKeys(receipt.sourceClosure, NATIVE_SOURCE_CLOSURE_KEYS)
    || receipt.sourceClosure?.bindingSha256
      !== nativeCanonicalSha256(receipt.sourceClosure?.value)
    || !exactKeys(receipt.dependencyClosure, NATIVE_DEPENDENCY_KEYS)
    || !HEX_SHA256.test(receipt.dependencyClosure?.lockSha256 ?? "")
    || receipt.dependencyClosure?.sourcePolicy
      !== "CARGO_LOCK_REGISTRY_CHECKSUMS_AND_FRESH_ARCHIVE_EXTRACTION"
    || !Number.isSafeInteger(receipt.dependencyClosure?.packageCount)
    || receipt.dependencyClosure.packageCount <= 0
    || !HEX_SHA256.test(receipt.dependencyClosure?.packagesSha256 ?? "")
    || receipt.dependencyClosure?.bindingSha256
      !== nativeCanonicalSha256({
        lockSha256: receipt.dependencyClosure?.lockSha256,
        sourcePolicy: receipt.dependencyClosure?.sourcePolicy,
        packageCount: receipt.dependencyClosure?.packageCount,
        packagesSha256: receipt.dependencyClosure?.packagesSha256,
      })) {
    throw new Error("INVALID_IAT_B3_NATIVE_WSL_BUILD_RECEIPT");
  }
  if (!HEX_SHA1.test(receipt.source?.declaredHeadSha ?? "")
    || !exactKeys(receipt.source, NATIVE_SOURCE_KEYS)
    || receipt.source.declaredHeadSha !== receipt.source.observedHeadSha
    || !HEX_SHA1.test(receipt.source?.observedTreeSha ?? "")
    || receipt.source.repositoryCleanTrackedAndUntracked !== true
    || !Number.isSafeInteger(receipt.source.revalidationCount)
    || receipt.source.revalidationCount < 4
    || receipt.source.executedRunnerSha256 !== receipt.source.committedRunnerSha256
    || !HEX_SHA256.test(receipt.source.executedRunnerSha256 ?? "")
    || receipt.source.materializedTreeSha !== receipt.source.observedTreeSha
    || receipt.source.materializationSchema
      !== "iat-b3-combined-law-exact-git-object-materialization/v1"
    || !HEX_SHA256.test(receipt.source.mountedInputSha256 ?? "")
    || !Number.isSafeInteger(receipt.source.materializedFileCount)
    || receipt.source.materializedFileCount <= 0
    || !Number.isSafeInteger(receipt.source.materializedByteLength)
    || receipt.source.materializedByteLength <= 0
    || !Number.isSafeInteger(receipt.source.lfsPointerCount)
    || receipt.source.lfsPointerCount < 0
    || !Number.isSafeInteger(receipt.source.materializationRevalidationCount)
    || receipt.source.materializationRevalidationCount < 4
    || receipt.source.ignoredWorktreeBytesIncluded !== false
    || receipt.source.submodulePolicy !== "REJECT_ALL_GITLINKS"
    || receipt.source.lfsPolicy !== "RAW_COMMITTED_POINTER_BLOBS_ONLY_NO_SMUDGE") {
    throw new Error("INVALID_IAT_B3_NATIVE_WSL_SOURCE_BINDING");
  }
  const expectedInputNames = programKind === "LAW" ? [
    "IAT_B3_PRODUCTION_LAW_PROGRAM_ID",
    "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID",
    "IAT_B3_PRODUCTION_CANONICAL_MINT",
  ] : [
    "IAT_B3_PRODUCTION_LAW_PROGRAM_ID",
    "IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID",
    "IAT_B3_PRODUCTION_CANONICAL_MINT",
    "IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH",
  ];
  if (!exactKeys(receipt.identityBinding, NATIVE_IDENTITY_KEYS)
    || !HEX_SHA256.test(receipt.identityBinding?.manifestSha256 ?? "")
    || !HEX_SHA256.test(receipt.identityBinding?.environmentBindingSha256 ?? "")
    || !Array.isArray(receipt.identityBinding?.inputNames)
    || canonicalJson(receipt.identityBinding.inputNames) !== canonicalJson(expectedInputNames)
    || receipt.identityBinding.bindingSha256 !== nativeCanonicalSha256({
      manifestSha256: receipt.identityBinding.manifestSha256,
      environmentBindingSha256: receipt.identityBinding.environmentBindingSha256,
      inputNames: receipt.identityBinding.inputNames,
    })) {
    throw new Error("INVALID_IAT_B3_NATIVE_WSL_IDENTITY_BINDING");
  }
  const closure = receipt.sourceClosure.value;
  if (programKind === "LAW") {
    if (!exactKeys(closure, [
      "policy", "recipeSha256", "cargoLockSha256", "mountedInputSha256",
    ])
      || closure.policy !== "EXACT_GIT_OBJECT_SOURCE_PLUS_FROZEN_PRODUCTION_LAW_RECIPE"
      || closure.recipeSha256 !== nativeCanonicalSha256(recipe)
      || closure.cargoLockSha256 !== receipt.dependencyClosure.lockSha256
      || closure.mountedInputSha256 !== receipt.source.mountedInputSha256) {
      throw new Error("INVALID_IAT_B3_NATIVE_WSL_LAW_SOURCE_CLOSURE");
    }
  } else if (!exactKeys(closure, [
    "productionFeature", "forbiddenFeature", "checks", "sources", "bindingSha256",
  ])
    || closure.productionFeature !== "runtime-production-entrypoint"
    || closure.forbiddenFeature !== "sbf-preflight-entrypoint"
    || !exactKeys(closure.checks, [
      "productionFeatureDeclared", "productionFeatureDoesNotEnablePreflight",
      "preflightFeatureSeparate", "libraryProductionModuleGated",
      "mutualEntrypointCompileError", "productionEntrypointMacroGated",
      "buildScriptRequiresProductionFeature", "buildScriptRequiresAllFourInputs",
      "recipeUsesProductionFeatureOnly",
    ])
    || !Object.values(closure.checks).every((value) => value === true)
    || !exactKeys(closure.sources, [
      "cargoManifestSha256", "librarySha256", "entrypointSha256", "buildScriptSha256",
    ])
    || !Object.values(closure.sources).every((value) => HEX_SHA256.test(value ?? ""))
    || closure.bindingSha256 !== nativeCanonicalSha256({
      checks: closure.checks,
      sources: closure.sources,
      recipe,
    })) {
    throw new Error("INVALID_IAT_B3_NATIVE_WSL_ECONOMY_SOURCE_CLOSURE");
  }
  const artifact = receipt.artifact;
  if (!exactKeys(artifact, NATIVE_ARTIFACT_KEYS)
    || artifact?.fileName !== outputFileName
    || !Number.isSafeInteger(artifact.byteLength)
    || artifact.byteLength <= 0
    || artifact.sha256 !== artifact.firstBuildSha256
    || artifact.sha256 !== artifact.secondBuildSha256
    || artifact.sha256 !== artifact.preservedArtifactSha256
    || artifact.byteLength !== artifact.preservedArtifactByteLength
    || artifact.firstBuildLogSha256 === artifact.secondBuildLogSha256
    || ![
      artifact.sha256,
      artifact.firstBuildLogSha256,
      artifact.secondBuildLogSha256,
    ].every((value) => HEX_SHA256.test(value ?? ""))
    || artifact.identicalBytes !== true
    || artifact.distinctBuildLogs !== true
    || artifact.preservedOutputAtomicNoOverwrite !== true
    || artifact.preservedOutputReadbackVerified !== true) {
    throw new Error("INVALID_IAT_B3_NATIVE_WSL_ARTIFACT_BINDING");
  }
  if (!exactKeys(receipt.safety, NATIVE_SAFETY_KEYS)
    || receipt.safety?.publicNetworkWrites !== false
    || receipt.safety?.signing !== false
    || receipt.safety?.deployment !== false
    || receipt.safety?.keyGeneration !== false
    || receipt.safety?.rpc !== false
    || receipt.safety?.adversarialDevnetFinalBinaryAccepted !== false
    || receipt.safety?.productionCandidate !== false
    || receipt.safety?.mainnetExecutionAuthorized !== false
    || receipt.safety?.reproducibleBuildVerified !== true
    || receipt.safety?.mainnetStatus !== "HOLD") {
    throw new Error("INVALID_IAT_B3_NATIVE_WSL_SAFETY_BOUNDARY");
  }
  const { receiptSha256, ...core } = receipt;
  if (!HEX_SHA256.test(receiptSha256 ?? "")
    || receiptSha256 !== nativeCanonicalSha256(core)) {
    throw new Error("IAT_B3_NATIVE_WSL_RECEIPT_DIGEST_MISMATCH");
  }
  return receipt;
}

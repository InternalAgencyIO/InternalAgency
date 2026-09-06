import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
} from "node:fs";
import { posix, resolve } from "node:path";

export const IAT_V2_DEVNET_BUFFER_RUNTIME_BINDING_PATH =
  "scripts/data/iat-v2-devnet-buffer-runtime-binding.json";

export const IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS = Object.freeze([
  "launch/IAT_V2_DEVNET_BUFFER_FD_INCIDENT_20260828.md",
  "launch/IAT_V2_DEVNET_BUFFER_IN_PLACE_CONTINUATION_54720_INCIDENT_20260831.md",
  "launch/IAT_V2_DEVNET_BUFFER_IN_PLACE_CONTINUATION_INCIDENT_20260831.md",
  "launch/IAT_V2_DEVNET_BUFFER_PARTIAL_UPLOAD_INCIDENT_20260828.md",
  "launch/IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK.md",
  "package-lock.json",
  "package.json",
  "programs/iat_v2/artifact-binding.mjs",
  "scripts/continue-iat-v2-devnet-buffer-in-place-from-35520.sh",
  "scripts/continue-iat-v2-devnet-buffer-in-place-from-54720.sh",
  "scripts/handoff-iat-v2-devnet-buffer.sh",
  "scripts/iat-v2-devnet-buffer-handoff-cas.mjs",
  "scripts/iat-v2-devnet-buffer-preflight.mjs",
  "scripts/iat-v2-sealed-exec.py",
  "scripts/initialize-iat-v2-devnet-buffer-handoff-cas.mjs",
  "scripts/lib/iat-v2-attended-git-runtime.mjs",
  "scripts/lib/iat-v2-attended-node-runtime.mjs",
  "scripts/lib/iat-v2-attended-solana-toolchain.sh",
  "scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs",
  "scripts/rebuild-iat-v2-devnet-buffer-fresh.sh",
  "scripts/reconcile-iat-v2-devnet-buffer-finalized.mjs",
  "scripts/recover-iat-v2-devnet-buffer-in-place.sh",
  "scripts/recover-iat-v2-devnet-buffer-pre-address.sh",
  "scripts/validate-iat-v2-ci-sbf-evidence.mjs"
]);

const COMMIT = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const WORKFLOW = /^InternalAgencyIO\/InternalAgency\/\.github\/workflows\/iat-v2-proof\.yml@refs\/pull\/[1-9][0-9]*\/merge$/u;
const STDIN_CLI_MARKER = "iat-v2-devnet-buffer-runtime-binding-stdin/v1";
const EXPECTED_PROJECT_ROOT = "/mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean/projects/star-ascent/site";
const EXPECTED_WORK_TREE = "/mnt/c/Users/A/Documents/Codex/2026-08-13/can-you-take-over-b3-architecture-3/work/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean";
const EXPECTED_LINKED_GIT_DIRECTORY = "/mnt/c/Users/A/Documents/Codex/2026-07-26/realtime-voice-chat-9/.git/worktrees/iat-b3-bpk00-package-bound-fd12-owner-root-public-key-anchor-clean";
const EXPECTED_COMMON_GIT_DIRECTORY = "/mnt/c/Users/A/Documents/Codex/2026-07-26/realtime-voice-chat-9/.git";
const EXPECTED_GIT_CONFIG_SHA256 = "5f0fabfa23f272edd434c297f96bb5982905bd1a7c9bddc4da980ac76c38e592";
const EXPECTED_GIT_CONFIG_BYTES = 4_335;
const EXPECTED_GIT_PATH = "/usr/bin/git";
const EXPECTED_GIT_VERSION = "git version 2.43.0";
const EXPECTED_GIT_SHA256 = "2a8c18fbf43da9f692d75474c72bea9dfd796c260b0f3dfe456376abc3bbd668";
const EXPECTED_GIT_BYTES = 4_066_232;
const LIMITATIONS = Object.freeze([
  "Source and public-CI binding only; not a Devnet buffer upload, signature, transaction, authority handoff, or deployment result.",
  "Does not authorize signing, broadcast, funding, deployment, release, or Mainnet.",
  "Root-owned Ubuntu 24.04 OS runtime, including Bash, system utilities, loaders, shared libraries, and Python standard-library/runtime modules, plus the WSL kernel and procfs, are trusted but not individually SHA-256-bound by this source closure.",
]);

export class IatV2DevnetBufferRuntimeBindingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IatV2DevnetBufferRuntimeBindingError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new IatV2DevnetBufferRuntimeBindingError(code, message);
}

function check(condition, code, message) {
  if (!condition) fail(code, message);
}

function exactKeys(value, expected, label) {
  check(value && typeof value === "object" && !Array.isArray(value), "RUNTIME_BINDING_SCHEMA_HOLD", `${label} must be an object`);
  const actual = Object.keys(value).sort();
  check(JSON.stringify(actual) === JSON.stringify([...expected].sort()), "RUNTIME_BINDING_SCHEMA_HOLD", `${label} fields are not exact`);
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function gitBlobObjectId(bytes) {
  return createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
    .update(bytes)
    .digest("hex");
}

function sameStableFile(left, right) {
  return left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.nlink === right.nlink
    && left.mtimeNs === right.mtimeNs
    && left.ctimeNs === right.ctimeNs;
}

function readAtomicRegularBytes(path, code, label) {
  let before;
  try {
    before = lstatSync(path, { bigint: true });
  } catch {
    fail(code, `${label} is missing`);
  }
  check(before.isFile() && !before.isSymbolicLink(), code, `${label} is not a regular non-symlink file`);
  check(before.nlink === 1n, code, `${label} must be single-linked`);

  let descriptor;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor, { bigint: true });
    check(sameStableFile(opened, before), code, `${label} identity or metadata changed while opening`);
    const bytes = readFileSync(descriptor);
    const durable = fstatSync(descriptor, { bigint: true });
    const after = lstatSync(path, { bigint: true });
    check(
      sameStableFile(durable, before) && sameStableFile(after, before),
      code,
      `${label} identity or metadata changed while reading`,
    );
    check(BigInt(bytes.length) === before.size, code, `${label} byte length changed while reading`);
    return bytes;
  } catch (error) {
    if (error instanceof IatV2DevnetBufferRuntimeBindingError) throw error;
    fail(code, `${label} could not be opened atomically`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function canonicalDirectory(path, code, label) {
  let entry;
  try {
    entry = lstatSync(path);
  } catch {
    fail(code, `${label} is missing`);
  }
  check(entry.isDirectory() && !entry.isSymbolicLink(), code, `${label} is not a directory or is a symlink`);
  let canonical;
  try {
    canonical = realpathSync(path);
  } catch {
    fail(code, `${label} cannot be resolved`);
  }
  check(canonical === path, code, `${label} is not an exact canonical path`);
  return canonical;
}

function requireAbsent(path, code, label) {
  try {
    lstatSync(path);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    fail(code, `${label} could not be checked`);
  }
  fail(code, `${label} must be absent`);
}

/**
 * Resolve and validate the one reviewed Windows-form linked-worktree pointer
 * before root Git sees repository state. Production supplies exact immutable
 * expectations; the parameters keep the parser independently testable.
 */
export function resolveIatV2WslLinkedWorktreeAdministration({
  workTree,
  expectedGitDirectory,
  expectedCommonDirectory,
  expectedGitConfigBytes,
  expectedGitConfigSha256,
  windowsMountRoot = "/mnt",
} = {}) {
  const code = "RUNTIME_BINDING_GIT_HOLD";
  check(process.platform === "linux", code, "linked-worktree translation requires Linux");
  for (const [label, value] of Object.entries({
    workTree,
    expectedGitDirectory,
    expectedCommonDirectory,
    windowsMountRoot,
  })) {
    check(typeof value === "string" && posix.isAbsolute(value), code, `${label} must be an absolute POSIX path`);
  }
  check(
    Number.isSafeInteger(expectedGitConfigBytes) && expectedGitConfigBytes > 0,
    code,
    "reviewed repository config byte length is invalid",
  );
  check(SHA256.test(expectedGitConfigSha256 ?? ""), code, "reviewed repository config SHA-256 is invalid");

  const canonicalMountRoot = canonicalDirectory(windowsMountRoot, code, "Windows mount root");
  const canonicalWorkTree = canonicalDirectory(workTree, code, "reviewed Git worktree");
  const pointerBytes = readAtomicRegularBytes(posix.join(canonicalWorkTree, ".git"), code, "linked-worktree .git pointer");
  const pointerText = pointerBytes.toString("utf8");
  check(Buffer.from(pointerText, "utf8").equals(pointerBytes), code, "linked-worktree .git pointer is not exact UTF-8");
  const pointer = /^gitdir: ([A-Z]):\/([A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)*)\n$/u.exec(pointerText);
  check(pointer, code, "linked-worktree .git pointer is not one canonical Windows drive-root line");
  const [, drive, tail] = pointer;
  const segments = tail.split("/");
  check(
    segments.every((segment) => segment !== "." && segment !== ".." && !segment.endsWith(".")),
    code,
    "linked-worktree .git pointer contains an unsafe path segment",
  );
  const driveRoot = canonicalDirectory(posix.join(canonicalMountRoot, drive.toLowerCase()), code, "reviewed Windows drive mount");
  const translatedGitDirectory = posix.join(driveRoot, ...segments);
  check(
    translatedGitDirectory === expectedGitDirectory,
    code,
    "linked-worktree .git pointer does not identify the reviewed administration directory",
  );
  const canonicalGitDirectory = canonicalDirectory(expectedGitDirectory, code, "reviewed linked-worktree administration directory");
  const workTreeRelative = posix.relative(driveRoot, canonicalWorkTree);
  check(
    workTreeRelative !== ""
      && workTreeRelative !== ".."
      && !workTreeRelative.startsWith("../")
      && !posix.isAbsolute(workTreeRelative),
    code,
    "reviewed Git worktree is outside the translated Windows drive",
  );
  const expectedBackpointer = `${drive}:/${workTreeRelative}/.git\n`;
  const backpointer = readAtomicRegularBytes(posix.join(canonicalGitDirectory, "gitdir"), code, "linked-worktree administration backpointer");
  check(backpointer.equals(Buffer.from(expectedBackpointer, "utf8")), code, "linked-worktree administration backpointer drifted");
  const commondir = readAtomicRegularBytes(posix.join(canonicalGitDirectory, "commondir"), code, "linked-worktree commondir pointer");
  check(commondir.equals(Buffer.from("../..\n", "utf8")), code, "linked-worktree commondir pointer drifted");
  check(
    posix.resolve(canonicalGitDirectory, "../..") === expectedCommonDirectory,
    code,
    "linked-worktree commondir does not identify the reviewed common Git directory",
  );
  const canonicalCommonDirectory = canonicalDirectory(expectedCommonDirectory, code, "reviewed common Git directory");

  const config = readAtomicRegularBytes(posix.join(canonicalCommonDirectory, "config"), code, "reviewed repository config");
  check(config.length === expectedGitConfigBytes, code, "reviewed repository config byte length drifted");
  check(sha256(config) === expectedGitConfigSha256, code, "reviewed repository config SHA-256 drifted");
  requireAbsent(posix.join(canonicalCommonDirectory, "config.worktree"), code, "common worktree config");
  requireAbsent(posix.join(canonicalGitDirectory, "config.worktree"), code, "linked-worktree config");
  const commonInfoDirectory = canonicalDirectory(posix.join(canonicalCommonDirectory, "info"), code, "reviewed common Git info directory");
  requireAbsent(posix.join(commonInfoDirectory, "grafts"), code, "Git grafts file");
  requireAbsent(posix.join(canonicalCommonDirectory, "shallow"), code, "Git shallow boundary file");
  const objectDirectory = canonicalDirectory(posix.join(canonicalCommonDirectory, "objects"), code, "reviewed Git object directory");
  canonicalDirectory(posix.join(objectDirectory, "info"), code, "reviewed Git object info directory");
  requireAbsent(posix.join(objectDirectory, "info", "alternates"), code, "Git object alternates file");
  requireAbsent(posix.join(objectDirectory, "info", "http-alternates"), code, "Git HTTP object alternates file");

  return Object.freeze({
    commonDirectory: canonicalCommonDirectory,
    gitDirectory: canonicalGitDirectory,
    objectDirectory,
    workTree: canonicalWorkTree,
  });
}

function gitResult(git, projectRoot, args, code, message) {
  try {
    return git(projectRoot, ["--no-replace-objects", ...args]);
  } catch {
    fail(code, message);
  }
}

function exactGitEnvironment() {
  return {
    HOME: "/home/a",
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    PATH: "/usr/bin:/bin",
    GIT_ATTR_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_CONFIG_COUNT: "0",
    GIT_LFS_SKIP_SMUDGE: "1",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_PAGER: "cat",
    GIT_TERMINAL_PROMPT: "0",
  };
}

function createSelfContainedGitRunner(projectRoot) {
  check(
    process.platform === "linux" && process.getuid?.() === 1000,
    "RUNTIME_BINDING_GIT_HOLD",
    "runtime binding stdin verifier requires exact uid 1000 on Linux",
  );
  check(realpathSync(projectRoot) === EXPECTED_PROJECT_ROOT, "RUNTIME_BINDING_GIT_HOLD", "runtime binding project root drifted");
  let entry;
  try {
    entry = lstatSync(EXPECTED_GIT_PATH);
  } catch {
    fail("RUNTIME_BINDING_GIT_HOLD", "reviewed Git executable is unavailable");
  }
  check(entry.isFile() && !entry.isSymbolicLink(), "RUNTIME_BINDING_GIT_HOLD", "reviewed Git executable is not a regular non-symlink file");
  check(realpathSync(EXPECTED_GIT_PATH) === EXPECTED_GIT_PATH, "RUNTIME_BINDING_GIT_HOLD", "reviewed Git executable resolves through a symlink");
  check(entry.uid === 0 && (entry.mode & 0o022) === 0, "RUNTIME_BINDING_GIT_HOLD", "reviewed root-owned Git ownership or permissions drifted");
  check(entry.size === EXPECTED_GIT_BYTES, "RUNTIME_BINDING_GIT_HOLD", "reviewed Git byte length drifted");
  check(sha256(readFileSync(EXPECTED_GIT_PATH)) === EXPECTED_GIT_SHA256, "RUNTIME_BINDING_GIT_HOLD", "reviewed Git SHA-256 drifted");
  const cleanEnvironment = exactGitEnvironment();
  const version = execFileSync(EXPECTED_GIT_PATH, ["--version"], {
    encoding: "utf8",
    env: cleanEnvironment,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  check(version === EXPECTED_GIT_VERSION, "RUNTIME_BINDING_GIT_HOLD", "reviewed Git version drifted");
  const administrationOptions = Object.freeze({
    expectedCommonDirectory: EXPECTED_COMMON_GIT_DIRECTORY,
    expectedGitConfigBytes: EXPECTED_GIT_CONFIG_BYTES,
    expectedGitConfigSha256: EXPECTED_GIT_CONFIG_SHA256,
    expectedGitDirectory: EXPECTED_LINKED_GIT_DIRECTORY,
    windowsMountRoot: "/mnt",
    workTree: EXPECTED_WORK_TREE,
  });
  resolveIatV2WslLinkedWorktreeAdministration(administrationOptions);
  return (root, args, options = {}) => {
    check(realpathSync(root) === EXPECTED_PROJECT_ROOT, "RUNTIME_BINDING_GIT_HOLD", "runtime Git command root drifted");
    const administration = resolveIatV2WslLinkedWorktreeAdministration(administrationOptions);
    const environment = {
      ...cleanEnvironment,
      GIT_ALTERNATE_OBJECT_DIRECTORIES: "",
      GIT_CEILING_DIRECTORIES: administration.workTree,
      GIT_COMMON_DIR: administration.commonDirectory,
      GIT_DIR: administration.gitDirectory,
      GIT_DISCOVERY_ACROSS_FILESYSTEM: "0",
      GIT_INDEX_FILE: posix.join(administration.gitDirectory, "index"),
      GIT_OBJECT_DIRECTORY: administration.objectDirectory,
      GIT_WORK_TREE: administration.workTree,
    };
    return execFileSync(EXPECTED_GIT_PATH, [
      `--git-dir=${administration.gitDirectory}`,
      `--work-tree=${administration.workTree}`,
      "--no-pager",
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.hooksPath=/dev/null",
      "-c",
      "core.attributesFile=/dev/null",
      "-c",
      "diff.external=",
      "-c",
      "interactive.diffFilter=",
      ...args,
    ], {
      cwd: root,
      encoding: "utf8",
      env: environment,
      maxBuffer: options.maxBuffer ?? 50_000_000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  };
}

function readRuntimeBindingAnchor({ projectRoot, git }) {
  const path = resolve(projectRoot, IAT_V2_DEVNET_BUFFER_RUNTIME_BINDING_PATH);
  const bytes = readAtomicRegularBytes(
    path,
    "RUNTIME_BINDING_ANCHOR_HOLD",
    "runtime binding anchor",
  );

  const text = bytes.toString("utf8");
  let binding;
  try {
    binding = JSON.parse(text);
  } catch {
    fail("RUNTIME_BINDING_ANCHOR_HOLD", "runtime binding anchor is not valid JSON");
  }
  check(text === `${JSON.stringify(sortJson(binding), null, 2)}\n`, "RUNTIME_BINDING_ANCHOR_HOLD", "runtime binding anchor is not canonical sorted-key UTF-8 JSON");

  const objectFormat = gitResult(git, projectRoot, ["rev-parse", "--show-object-format"], "RUNTIME_BINDING_GIT_HOLD", "runtime Git object format is unavailable");
  check(objectFormat === "sha1", "RUNTIME_BINDING_GIT_HOLD", "runtime binding requires the reviewed SHA-1 Git object format plus explicit SHA-256 byte binding");
  const prefix = gitResult(git, projectRoot, ["rev-parse", "--show-prefix"], "RUNTIME_BINDING_GIT_HOLD", "runtime checkout prefix is unavailable");
  const repositoryPath = `${prefix}${IAT_V2_DEVNET_BUFFER_RUNTIME_BINDING_PATH}`;
  const headEntry = gitResult(git, projectRoot, ["ls-tree", "--full-tree", "HEAD", "--", repositoryPath], "RUNTIME_BINDING_ANCHOR_HOLD", "runtime binding HEAD entry is unavailable");
  const headMatch = /^100644 blob ([0-9a-f]{40})\t(.+)$/u.exec(headEntry);
  check(headMatch && headMatch[2] === repositoryPath, "RUNTIME_BINDING_ANCHOR_HOLD", "runtime binding HEAD entry is not one exact 100644 blob");
  const indexEntry = gitResult(git, projectRoot, ["ls-files", "--stage", "--full-name", "--", `:(top)${repositoryPath}`], "RUNTIME_BINDING_ANCHOR_HOLD", "runtime binding index entry is unavailable");
  const indexMatch = /^100644 ([0-9a-f]{40}) 0\t(.+)$/u.exec(indexEntry);
  check(indexMatch && indexMatch[1] === headMatch[1] && indexMatch[2] === repositoryPath, "RUNTIME_BINDING_ANCHOR_HOLD", "runtime binding index entry differs from HEAD");
  const workingObject = gitBlobObjectId(bytes);
  check(workingObject === headMatch[1], "RUNTIME_BINDING_ANCHOR_HOLD", "runtime binding working bytes differ from the HEAD blob");

  return Object.freeze({ binding: Object.freeze(binding), bindingAnchorSha256: sha256(bytes) });
}

export function observeIatV2DevnetBufferRuntimeClosure({
  projectRoot,
  sourceHeadCommit,
  git,
} = {}) {
  check(typeof git === "function", "RUNTIME_BINDING_GIT_HOLD", "reviewed Git runner is required");
  check(COMMIT.test(sourceHeadCommit ?? ""), "RUNTIME_BINDING_SCHEMA_HOLD", "runtime source-head commit is invalid");
  check(
    JSON.stringify(IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS)
      === JSON.stringify([...IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS].sort()),
    "RUNTIME_BINDING_CLOSURE_HOLD",
    "runtime closure paths are not in exact code-unit order",
  );
  check(new Set(IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS).size === IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS.length, "RUNTIME_BINDING_CLOSURE_HOLD", "runtime closure paths are not unique");
  const objectFormat = gitResult(git, projectRoot, ["rev-parse", "--show-object-format"], "RUNTIME_BINDING_GIT_HOLD", "runtime Git object format is unavailable");
  check(objectFormat === "sha1", "RUNTIME_BINDING_GIT_HOLD", "runtime closure requires the reviewed SHA-1 Git object format plus explicit SHA-256 byte binding");
  const prefix = gitResult(git, projectRoot, ["rev-parse", "--show-prefix"], "RUNTIME_BINDING_GIT_HOLD", "runtime checkout prefix is unavailable");
  const entries = IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS.map((path) => {
    check(!path.startsWith("/") && !path.split("/").includes(".."), "RUNTIME_BINDING_CLOSURE_HOLD", `runtime path is noncanonical: ${path}`);
    const repositoryPath = `${prefix}${path}`;
    const line = gitResult(git, projectRoot, ["ls-tree", "--full-tree", sourceHeadCommit, "--", repositoryPath], "RUNTIME_BINDING_CLOSURE_HOLD", `runtime source entry is unavailable: ${path}`);
    const match = /^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/u.exec(line);
    check(match && match[3] === repositoryPath, "RUNTIME_BINDING_CLOSURE_HOLD", `runtime source entry is not one exact regular blob: ${path}`);
    const indexLine = gitResult(
      git,
      projectRoot,
      ["ls-files", "--stage", "--full-name", "--", `:(top)${repositoryPath}`],
      "RUNTIME_BINDING_WORKTREE_HOLD",
      `runtime index entry is unavailable: ${path}`,
    );
    const indexMatch = /^(100644|100755) ([0-9a-f]{40}) 0\t(.+)$/u.exec(indexLine);
    check(
      indexMatch
        && indexMatch[1] === match[1]
        && indexMatch[2] === match[2]
        && indexMatch[3] === repositoryPath,
      "RUNTIME_BINDING_WORKTREE_HOLD",
      `runtime index entry differs from reviewed source S: ${path}`,
    );
    const bytes = readAtomicRegularBytes(
      resolve(projectRoot, path),
      "RUNTIME_BINDING_CLOSURE_HOLD",
      `runtime working file ${path}`,
    );
    check(
      gitBlobObjectId(bytes) === match[2],
      "RUNTIME_BINDING_CLOSURE_HOLD",
      `runtime working bytes differ from source S: ${path}`,
    );
    return Object.freeze({
      bytes: bytes.length,
      mode: match[1],
      objectId: match[2],
      path,
      sha256: sha256(bytes),
    });
  });
  return Object.freeze({
    entries: Object.freeze(entries),
    runtimeClosureSha256: sha256(Buffer.from(JSON.stringify(sortJson(entries)))),
  });
}

export function verifyIatV2DevnetBufferRuntimeBinding({
  projectRoot,
  binding,
  git,
} = {}) {
  check(typeof git === "function", "RUNTIME_BINDING_GIT_HOLD", "reviewed Git runner is required");
  const anchor = binding === undefined
    ? readRuntimeBindingAnchor({ projectRoot, git })
    : Object.freeze({
      binding: Object.freeze(binding),
      bindingAnchorSha256: sha256(Buffer.from(`${JSON.stringify(sortJson(binding), null, 2)}\n`)),
    });
  const value = anchor.binding;
  exactKeys(value, [
    "artifactBytes",
    "artifactSha256",
    "checkoutCommit",
    "checkoutRelation",
    "checkoutTree",
    "ciRunAttempt",
    "ciRunId",
    "evidenceManifestSha256",
    "limitations",
    "mainnetStatus",
    "network",
    "repository",
    "repositoryId",
    "runnerArch",
    "runnerOs",
    "runtimeClosureSha256",
    "schema",
    "sourceHeadCommit",
    "sourceHeadTree",
    "status",
    "workflowEvent",
    "workflowRef",
  ], "Devnet buffer runtime binding");
  check(value.schema === "iat-v2-devnet-buffer-runtime-binding/v1", "RUNTIME_BINDING_SCHEMA_HOLD", "runtime binding schema drifted");
  check(value.status === "BOUND", "RUNTIME_BINDING_UNBOUND_HOLD", "Devnet buffer runtime is not bound to reviewed public CI");
  check(value.network === "devnet" && value.mainnetStatus === "HOLD", "RUNTIME_BINDING_SCHEMA_HOLD", "runtime binding network or Mainnet HOLD policy drifted");
  check(JSON.stringify(value.limitations) === JSON.stringify(LIMITATIONS), "RUNTIME_BINDING_SCHEMA_HOLD", "runtime binding nonauthorization limitations drifted");
  check(value.repository === "InternalAgencyIO/InternalAgency" && value.repositoryId === 1_313_660_798, "RUNTIME_BINDING_SCHEMA_HOLD", "runtime binding repository identity drifted");
  check(value.runnerOs === "Linux" && value.runnerArch === "X64", "RUNTIME_BINDING_SCHEMA_HOLD", "runtime binding runner identity drifted");
  check(value.workflowEvent === "pull_request" && value.checkoutRelation === "PR_MERGE_SECOND_PARENT", "RUNTIME_BINDING_SCHEMA_HOLD", "runtime binding checkout relation drifted");
  check(COMMIT.test(value.sourceHeadCommit ?? "") && COMMIT.test(value.sourceHeadTree ?? ""), "RUNTIME_BINDING_SCHEMA_HOLD", "runtime source binding is invalid");
  check(COMMIT.test(value.checkoutCommit ?? "") && COMMIT.test(value.checkoutTree ?? ""), "RUNTIME_BINDING_SCHEMA_HOLD", "runtime checkout binding is invalid");
  check(SHA256.test(value.runtimeClosureSha256 ?? "") && SHA256.test(value.evidenceManifestSha256 ?? ""), "RUNTIME_BINDING_SCHEMA_HOLD", "runtime closure or evidence SHA-256 is invalid");
  check(SHA256.test(value.artifactSha256 ?? "") && Number.isSafeInteger(value.artifactBytes) && value.artifactBytes > 0, "RUNTIME_BINDING_SCHEMA_HOLD", "runtime artifact tuple is invalid");
  check(Number.isSafeInteger(value.ciRunId) && value.ciRunId > 0 && Number.isSafeInteger(value.ciRunAttempt) && value.ciRunAttempt > 0, "RUNTIME_BINDING_SCHEMA_HOLD", "runtime CI run identity is invalid");
  check(WORKFLOW.test(value.workflowRef ?? ""), "RUNTIME_BINDING_SCHEMA_HOLD", "runtime workflow reference is invalid");

  gitResult(git, projectRoot, ["cat-file", "-e", `${value.sourceHeadCommit}^{commit}`], "RUNTIME_BINDING_SOURCE_HOLD", "bound runtime source commit is unavailable");
  const sourceTree = gitResult(git, projectRoot, ["rev-parse", `${value.sourceHeadCommit}^{tree}`], "RUNTIME_BINDING_SOURCE_HOLD", "bound runtime source tree is unavailable");
  check(sourceTree === value.sourceHeadTree, "RUNTIME_BINDING_SOURCE_HOLD", "bound runtime source tree drifted");
  gitResult(git, projectRoot, ["cat-file", "-e", `${value.checkoutCommit}^{commit}`], "RUNTIME_BINDING_CHECKOUT_HOLD", "bound CI checkout commit is unavailable");
  const checkoutTree = gitResult(git, projectRoot, ["rev-parse", `${value.checkoutCommit}^{tree}`], "RUNTIME_BINDING_CHECKOUT_HOLD", "bound CI checkout tree is unavailable");
  check(checkoutTree === value.checkoutTree, "RUNTIME_BINDING_CHECKOUT_HOLD", "bound CI checkout tree drifted");
  const checkoutParents = gitResult(git, projectRoot, ["rev-list", "--parents", "-n", "1", value.checkoutCommit], "RUNTIME_BINDING_CHECKOUT_HOLD", "bound CI checkout parents are unavailable").split(" ");
  check(
    checkoutParents.length === 3
      && checkoutParents[0] === value.checkoutCommit
      && checkoutParents[2] === value.sourceHeadCommit,
    "RUNTIME_BINDING_CHECKOUT_HOLD",
    "bound CI checkout is not an exact two-parent PR merge with source S as its second parent",
  );
  const head = gitResult(git, projectRoot, ["rev-parse", "HEAD"], "RUNTIME_BINDING_SUCCESSOR_HOLD", "current checkout head is unavailable");
  const headTree = gitResult(git, projectRoot, ["rev-parse", "HEAD^{tree}"], "RUNTIME_BINDING_SUCCESSOR_HOLD", "binding successor tree is unavailable");
  const parents = gitResult(git, projectRoot, ["rev-list", "--parents", "-n", "1", "HEAD"], "RUNTIME_BINDING_SUCCESSOR_HOLD", "binding successor parents are unavailable").split(" ");
  check(parents.length === 2 && parents[0] === head && parents[1] === value.sourceHeadCommit, "RUNTIME_BINDING_SUCCESSOR_HOLD", "current head is not the direct one-parent successor of the bound runtime source");

  const prefix = gitResult(git, projectRoot, ["rev-parse", "--show-prefix"], "RUNTIME_BINDING_GIT_HOLD", "runtime checkout prefix is unavailable");
  const expectedBindingDiff = `M\t${prefix}${IAT_V2_DEVNET_BUFFER_RUNTIME_BINDING_PATH}`;
  const committedDiff = gitResult(git, projectRoot, ["diff", "--no-ext-diff", "--no-textconv", "--name-status", "--no-renames", value.sourceHeadCommit, "HEAD", "--"], "RUNTIME_BINDING_SUCCESSOR_HOLD", "binding successor diff is unavailable");
  check(committedDiff === expectedBindingDiff, "RUNTIME_BINDING_SUCCESSOR_HOLD", "binding successor changed paths beyond the one canonical runtime anchor");

  const closure = observeIatV2DevnetBufferRuntimeClosure({ projectRoot, sourceHeadCommit: value.sourceHeadCommit, git });
  check(closure.runtimeClosureSha256 === value.runtimeClosureSha256, "RUNTIME_BINDING_CLOSURE_HOLD", "bound runtime closure digest drifted");
  gitResult(git, projectRoot, ["diff", "--no-ext-diff", "--no-textconv", "--quiet", value.sourceHeadCommit, "HEAD", "--", ...IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS], "RUNTIME_BINDING_CLOSURE_HOLD", "runtime closure changed in the binding-only successor");

  return Object.freeze({
    schema: "iat-v2-devnet-buffer-runtime-verification/v1",
    status: "BOUND",
    network: "devnet",
    mainnetStatus: "HOLD",
    sourceHeadCommit: value.sourceHeadCommit,
    sourceHeadTree: value.sourceHeadTree,
    checkoutCommit: value.checkoutCommit,
    checkoutTree: value.checkoutTree,
    checkoutRelation: value.checkoutRelation,
    bindingSuccessorCommit: head,
    bindingSuccessorTree: headTree,
    bindingAnchorSha256: anchor.bindingAnchorSha256,
    runtimeClosureEntries: closure.entries,
    runtimeClosureSha256: closure.runtimeClosureSha256,
    evidenceManifestSha256: value.evidenceManifestSha256,
    artifactSha256: value.artifactSha256,
    artifactBytes: value.artifactBytes,
    ciRunId: value.ciRunId,
    ciRunAttempt: value.ciRunAttempt,
    workflowRef: value.workflowRef,
    relation: "DIRECT_BINDING_ONLY_SUCCESSOR",
    transactionExecution: false,
    signing: false,
    broadcast: false,
    mainnetAuthorized: false,
  });
}

const stdinCli = process.argv[1] === "-"
  && process.env.IAT_V2_RUNTIME_BINDING_STDIN_CLI === STDIN_CLI_MARKER;
if (stdinCli) {
  Promise.resolve().then(() => {
    check(
      process.env.IAT_V2_PROJECT_ROOT === EXPECTED_PROJECT_ROOT,
      "RUNTIME_BINDING_SCHEMA_HOLD",
      "runtime binding stdin verifier project root is not exact",
    );
    check(
      JSON.stringify(process.argv.slice(2)) === JSON.stringify(["verify"]),
      "RUNTIME_BINDING_SCHEMA_HOLD",
      "runtime binding stdin verifier arguments are not exact",
    );
    const git = createSelfContainedGitRunner(EXPECTED_PROJECT_ROOT);
    return verifyIatV2DevnetBufferRuntimeBinding({
      projectRoot: EXPECTED_PROJECT_ROOT,
      git,
    });
  }).then((value) => {
    process.stdout.write(`${JSON.stringify(value)}\n`);
  }).catch((error) => {
    process.stderr.write(`${JSON.stringify({
      schema: "iat-v2-devnet-buffer-runtime-binding-error/v1",
      status: "HOLD",
      code: error instanceof IatV2DevnetBufferRuntimeBindingError
        ? error.code
        : "UNEXPECTED_RUNTIME_BINDING_FAILURE",
      message: error instanceof Error ? error.message : String(error),
      signing: false,
      broadcast: false,
    })}\n`);
    process.exitCode = 2;
  });
}

import { createHash } from "node:crypto";
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
} from "node:fs";
import { resolve } from "node:path";

export const IAT_V2_DEVNET_BUFFER_RUNTIME_BINDING_PATH =
  "scripts/data/iat-v2-devnet-buffer-runtime-binding.json";

export const IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS = Object.freeze([
  "launch/IAT_V2_DEVNET_BUFFER_FD_INCIDENT_20260828.md",
  "launch/IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK.md",
  "package-lock.json",
  "package.json",
  "programs/iat_v2/artifact-binding.mjs",
  "scripts/iat-v2-devnet-buffer-preflight.mjs",
  "scripts/lib/iat-v2-attended-git-runtime.mjs",
  "scripts/lib/iat-v2-attended-node-runtime.mjs",
  "scripts/lib/iat-v2-attended-solana-toolchain.sh",
  "scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs",
  "scripts/rebuild-iat-v2-devnet-buffer-fresh.sh",
  "scripts/recover-iat-v2-devnet-buffer-pre-address.sh",
  "scripts/validate-iat-v2-ci-sbf-evidence.mjs"
]);

const COMMIT = /^[0-9a-f]{40}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const WORKFLOW = /^InternalAgencyIO\/InternalAgency\/\.github\/workflows\/iat-v2-proof\.yml@refs\/pull\/[1-9][0-9]*\/merge$/u;
const LIMITATIONS = Object.freeze([
  "Source and public-CI binding only; not a Devnet buffer upload, signature, transaction, authority handoff, or deployment result.",
  "Does not authorize signing, broadcast, funding, deployment, release, or Mainnet.",
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

function gitResult(git, projectRoot, args, code, message) {
  try {
    return git(projectRoot, ["--no-replace-objects", ...args]);
  } catch {
    fail(code, message);
  }
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
  const head = gitResult(git, projectRoot, ["rev-parse", "HEAD"], "RUNTIME_BINDING_SUCCESSOR_HOLD", "current checkout head is unavailable");
  const headTree = gitResult(git, projectRoot, ["rev-parse", "HEAD^{tree}"], "RUNTIME_BINDING_SUCCESSOR_HOLD", "binding successor tree is unavailable");
  const parents = gitResult(git, projectRoot, ["rev-list", "--parents", "-n", "1", "HEAD"], "RUNTIME_BINDING_SUCCESSOR_HOLD", "binding successor parents are unavailable").split(" ");
  check(parents.length === 2 && parents[0] === head && parents[1] === value.sourceHeadCommit, "RUNTIME_BINDING_SUCCESSOR_HOLD", "current head is not the direct one-parent successor of the bound runtime source");

  const prefix = gitResult(git, projectRoot, ["rev-parse", "--show-prefix"], "RUNTIME_BINDING_GIT_HOLD", "runtime checkout prefix is unavailable");
  const expectedBindingDiff = `M\t${prefix}${IAT_V2_DEVNET_BUFFER_RUNTIME_BINDING_PATH}`;
  const committedDiff = gitResult(git, projectRoot, ["diff", "--name-status", "--no-renames", value.sourceHeadCommit, "HEAD", "--"], "RUNTIME_BINDING_SUCCESSOR_HOLD", "binding successor diff is unavailable");
  check(committedDiff === expectedBindingDiff, "RUNTIME_BINDING_SUCCESSOR_HOLD", "binding successor changed paths beyond the one canonical runtime anchor");

  const closure = observeIatV2DevnetBufferRuntimeClosure({ projectRoot, sourceHeadCommit: value.sourceHeadCommit, git });
  check(closure.runtimeClosureSha256 === value.runtimeClosureSha256, "RUNTIME_BINDING_CLOSURE_HOLD", "bound runtime closure digest drifted");
  gitResult(git, projectRoot, ["diff", "--quiet", value.sourceHeadCommit, "HEAD", "--", ...IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS], "RUNTIME_BINDING_CLOSURE_HOLD", "runtime closure changed in the binding-only successor");
  const worktreeStatus = gitResult(git, projectRoot, ["status", "--porcelain=v1", "--untracked-files=all", "--", ...IAT_V2_DEVNET_BUFFER_RUNTIME_PATHS, IAT_V2_DEVNET_BUFFER_RUNTIME_BINDING_PATH], "RUNTIME_BINDING_WORKTREE_HOLD", "runtime closure worktree status is unavailable");
  check(worktreeStatus === "", "RUNTIME_BINDING_WORKTREE_HOLD", "runtime closure or binding anchor has staged, unstaged, deleted, or untracked drift");

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

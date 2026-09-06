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

import {
  parseIatV2DevnetProgramCeremonyBinding,
} from "../../programs/iat_v2/ceremony-binding.mjs";
import { validateSbfEvidence } from "../validate-iat-v2-ci-sbf-evidence.mjs";
import { createIatV2AttendedGitRunner } from "./iat-v2-attended-git-runtime.mjs";

export const IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH =
  "scripts/data/iat-v2-devnet-program-ceremony-runtime-binding.json";
export const IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH =
  "target/verifiable/iat-v2-ceremony-runtime-build-evidence.json";
export const IAT_V2_DEVNET_PROGRAM_CEREMONY_CHECKOUT_REF_PREFIX =
  "refs/heads/agent/iat-v2-devnet-ceremony-ci-";

export const IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS = Object.freeze([
  "app/mint/ceremony.mjs",
  "docs/b3/iat-v2-devnet-program-ceremony-runtime-binding.v1.schema.json",
  "engagement/iat-economic-policy.v2.json",
  "launch/IAT_V2_ATTENDED_DEVNET_SIGNING_HEADROOM_INCIDENT_20260906.md",
  "launch/IAT_V2_POST_CI_ATTENDED_DEVNET_RUNBOOK.md",
  "package-lock.json",
  "package.json",
  "programs/iat_v2/artifact-binding.mjs",
  "programs/iat_v2/attended-settlement.mjs",
  "programs/iat_v2/ceremony-binding.mjs",
  "programs/iat_v2/ceremony-horizon.mjs",
  "programs/iat_v2/client.mjs",
  "programs/iat_v2/feature-instructions.mjs",
  "programs/iat_v2/feature-rehearsal.mjs",
  "programs/iat_v2/instructions.mjs",
  "scripts/finalize-iat-v2-current-source-devnet-evidence.mjs",
  "scripts/iat-v2-devnet-buffer-preflight.mjs",
  "scripts/lib/iat-v2-attended-git-runtime.mjs",
  "scripts/lib/iat-v2-attended-node-runtime.mjs",
  "scripts/lib/iat-v2-current-source-devnet-clearance.mjs",
  "scripts/lib/iat-v2-devnet-buffer-runtime-binding.mjs",
  "scripts/lib/iat-v2-devnet-program-ceremony-runtime-binding.mjs",
  "scripts/validate-iat-v2-ci-sbf-evidence.mjs",
  "scripts/verify-iat-v2-devnet-program-ceremony-runtime-binding.mjs",
  "tools/iat-v2-admin-console/AttendedWeek9Settlement.jsx",
  "tools/iat-v2-admin-console/FeatureRehearsal.jsx",
  "tools/iat-v2-admin-console/LegacyRoundMigration.jsx",
  "tools/iat-v2-admin-console/ProgramUpgrade.jsx",
  "tools/iat-v2-admin-console/ProgramUpgradeAttendedActions.jsx",
  "tools/iat-v2-admin-console/TrezorPathSessionGate.jsx",
  "tools/iat-v2-admin-console/attended-evidence-bundle.mjs",
  "tools/iat-v2-admin-console/attended-evidence.mjs",
  "tools/iat-v2-admin-console/attended-program-broadcast-once.mjs",
  "tools/iat-v2-admin-console/attended-program-recovery.mjs",
  "tools/iat-v2-admin-console/attended-program-signed-pending.mjs",
  "tools/iat-v2-admin-console/attended-prompt-coordinator.mjs",
  "tools/iat-v2-admin-console/attended-settlement-browser.mjs",
  "tools/iat-v2-admin-console/attended-transaction-boundary.mjs",
  "tools/iat-v2-admin-console/buffer-polyfill.mjs",
  "tools/iat-v2-admin-console/crypto-browser-shim.mjs",
  "tools/iat-v2-admin-console/feature-randomness-continuity.mjs",
  "tools/iat-v2-admin-console/https-browser-shim.mjs",
  "tools/iat-v2-admin-console/index.html",
  "tools/iat-v2-admin-console/main.jsx",
  "tools/iat-v2-admin-console/original-token-decode.mjs",
  "tools/iat-v2-admin-console/program-extension-attended.mjs",
  "tools/iat-v2-admin-console/program-extension.mjs",
  "tools/iat-v2-admin-console/style.css",
  "tools/iat-v2-admin-console/trezor-path-session.mjs",
  "tools/iat-v2-admin-console/trezor-provider.mjs",
  "tools/iat-v2-admin-console/util-browser-shim.mjs",
  "tools/iat-v2-admin-console/vite.config.mjs",
]);

const COMMIT = /^[0-9a-f]{40}$/u;
const PUBLIC_REPOSITORY_REMOTE_URLS = new Set([
  "git@github.com:InternalAgencyIO/InternalAgency.git",
  "https://github.com/InternalAgencyIO/InternalAgency",
  "https://github.com/InternalAgencyIO/InternalAgency.git",
  "ssh://git@github.com/InternalAgencyIO/InternalAgency.git",
]);

export function iatV2DevnetProgramCeremonyCheckoutEvidenceRef(sourceHeadCommit) {
  check(
    COMMIT.test(sourceHeadCommit ?? ""),
    "CEREMONY_BINDING_SCHEMA_HOLD",
    "ceremony source commit is invalid for the public CI-checkout evidence ref",
  );
  return `${IAT_V2_DEVNET_PROGRAM_CEREMONY_CHECKOUT_REF_PREFIX}${sourceHeadCommit}`;
}

export class IatV2DevnetProgramCeremonyRuntimeBindingError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "IatV2DevnetProgramCeremonyRuntimeBindingError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new IatV2DevnetProgramCeremonyRuntimeBindingError(code, message);
}

function check(condition, code, message) {
  if (!condition) fail(code, message);
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
    if (error instanceof IatV2DevnetProgramCeremonyRuntimeBindingError) throw error;
    fail(code, `${label} could not be opened atomically`);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function resolvedGit(projectRoot, git) {
  if (git !== undefined) {
    check(typeof git === "function", "CEREMONY_BINDING_GIT_HOLD", "reviewed Git runner is invalid");
    return git;
  }
  try {
    return createIatV2AttendedGitRunner(projectRoot).run;
  } catch (error) {
    fail(
      "CEREMONY_BINDING_GIT_HOLD",
      `reviewed Git runtime is unavailable: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function gitResult(git, projectRoot, args, code, message) {
  try {
    return git(projectRoot, ["--no-replace-objects", ...args]);
  } catch {
    fail(code, message);
  }
}

function optionalGitResult(git, projectRoot, args) {
  try {
    return git(projectRoot, ["--no-replace-objects", ...args]);
  } catch {
    return null;
  }
}

function verifyPublicCheckoutEvidenceRef({ binding, git, projectRoot }) {
  const checkoutEvidenceRef = iatV2DevnetProgramCeremonyCheckoutEvidenceRef(binding.sourceHeadCommit);
  const remoteNames = (optionalGitResult(git, projectRoot, ["remote"]) ?? "")
    .split("\n")
    .filter(Boolean)
    .sort();
  const matches = [];
  for (const remoteName of remoteNames) {
    const configuredUrls = optionalGitResult(
      git,
      projectRoot,
      ["config", "--get-all", `remote.${remoteName}.url`],
    );
    const urls = configuredUrls?.split("\n").filter(Boolean) ?? [];
    if (urls.length !== 1 || !PUBLIC_REPOSITORY_REMOTE_URLS.has(urls[0])) continue;
    const resolvedUrls = optionalGitResult(
      git,
      projectRoot,
      ["remote", "get-url", "--all", remoteName],
    )?.split("\n").filter(Boolean) ?? [];
    if (resolvedUrls.length !== 1 || !PUBLIC_REPOSITORY_REMOTE_URLS.has(resolvedUrls[0])) continue;
    const localCheckoutEvidenceRef = checkoutEvidenceRef.replace(
      "refs/heads/",
      `refs/remotes/${remoteName}/`,
    );
    const checkoutEvidenceCommit = optionalGitResult(
      git,
      projectRoot,
      ["rev-parse", "--verify", `${localCheckoutEvidenceRef}^{commit}`],
    );
    if (checkoutEvidenceCommit === null) continue;
    check(
      checkoutEvidenceCommit === binding.checkoutCommit,
      "CEREMONY_BINDING_CHECKOUT_REF_HOLD",
      "the public ceremony CI-checkout evidence ref disagrees with the binding anchor",
    );
    matches.push(Object.freeze({
      checkoutEvidenceRemote: remoteName,
      localCheckoutEvidenceRef,
    }));
  }
  check(
    matches.length === 1,
    "CEREMONY_BINDING_CHECKOUT_REF_HOLD",
    "exactly one authenticated public ceremony CI-checkout evidence ref must be available locally",
  );
  return Object.freeze({ checkoutEvidenceRef, ...matches[0] });
}

function readBindingAnchor({ projectRoot, git }) {
  const path = resolve(projectRoot, IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH);
  const bytes = readAtomicRegularBytes(path, "CEREMONY_BINDING_ANCHOR_HOLD", "ceremony binding anchor");
  const text = bytes.toString("utf8");
  let binding;
  try {
    binding = JSON.parse(text);
  } catch {
    fail("CEREMONY_BINDING_ANCHOR_HOLD", "ceremony binding anchor is not valid JSON");
  }
  check(
    text === `${JSON.stringify(sortJson(binding), null, 2)}\n`,
    "CEREMONY_BINDING_ANCHOR_HOLD",
    "ceremony binding anchor is not canonical sorted-key UTF-8 JSON",
  );

  const objectFormat = gitResult(
    git,
    projectRoot,
    ["rev-parse", "--show-object-format"],
    "CEREMONY_BINDING_GIT_HOLD",
    "ceremony Git object format is unavailable",
  );
  check(
    objectFormat === "sha1",
    "CEREMONY_BINDING_GIT_HOLD",
    "ceremony binding requires SHA-1 Git objects plus explicit SHA-256 byte binding",
  );
  const prefix = gitResult(
    git,
    projectRoot,
    ["rev-parse", "--show-prefix"],
    "CEREMONY_BINDING_GIT_HOLD",
    "ceremony checkout prefix is unavailable",
  );
  const repositoryPath = `${prefix}${IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH}`;
  const headEntry = gitResult(
    git,
    projectRoot,
    ["ls-tree", "--full-tree", "HEAD", "--", repositoryPath],
    "CEREMONY_BINDING_ANCHOR_HOLD",
    "ceremony binding HEAD entry is unavailable",
  );
  const headMatch = /^100644 blob ([0-9a-f]{40})\t(.+)$/u.exec(headEntry);
  check(
    headMatch && headMatch[2] === repositoryPath,
    "CEREMONY_BINDING_ANCHOR_HOLD",
    "ceremony binding HEAD entry is not one exact 100644 blob",
  );
  const indexEntry = gitResult(
    git,
    projectRoot,
    ["ls-files", "--stage", "--full-name", "--", `:(top)${repositoryPath}`],
    "CEREMONY_BINDING_ANCHOR_HOLD",
    "ceremony binding index entry is unavailable",
  );
  const indexMatch = /^100644 ([0-9a-f]{40}) 0\t(.+)$/u.exec(indexEntry);
  check(
    indexMatch && indexMatch[1] === headMatch[1] && indexMatch[2] === repositoryPath,
    "CEREMONY_BINDING_ANCHOR_HOLD",
    "ceremony binding index entry differs from HEAD",
  );
  check(
    gitBlobObjectId(bytes) === headMatch[1],
    "CEREMONY_BINDING_ANCHOR_HOLD",
    "ceremony binding working bytes differ from HEAD",
  );
  return Object.freeze({
    binding: Object.freeze(binding),
    bindingAnchorSha256: sha256(bytes),
  });
}

function readSourceBindingAnchor({
  git,
  prefix,
  projectRoot,
  sourceHeadCommit,
}) {
  const repositoryPath = `${prefix}${IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH}`;
  const entry = gitResult(
    git,
    projectRoot,
    ["ls-tree", "--full-tree", sourceHeadCommit, "--", repositoryPath],
    "CEREMONY_BINDING_SOURCE_HOLD",
    "ceremony source S anchor entry is unavailable",
  );
  const match = /^100644 blob ([0-9a-f]{40})\t(.+)$/u.exec(entry);
  check(
    match && match[2] === repositoryPath,
    "CEREMONY_BINDING_SOURCE_HOLD",
    "ceremony source S anchor is not one exact 100644 blob",
  );
  const text = gitResult(
    git,
    projectRoot,
    ["cat-file", "-p", match[1]],
    "CEREMONY_BINDING_SOURCE_HOLD",
    "ceremony source S anchor bytes are unavailable",
  );
  let sourceBinding;
  try {
    sourceBinding = JSON.parse(text);
  } catch {
    fail("CEREMONY_BINDING_SOURCE_HOLD", "ceremony source S anchor is not valid JSON");
  }
  const canonicalBytes = Buffer.from(`${JSON.stringify(sortJson(sourceBinding), null, 2)}\n`, "utf8");
  check(
    gitBlobObjectId(canonicalBytes) === match[1],
    "CEREMONY_BINDING_SOURCE_HOLD",
    "ceremony source S anchor is not canonical sorted-key UTF-8 JSON",
  );
  let exact;
  try {
    exact = parseIatV2DevnetProgramCeremonyBinding(sourceBinding);
  } catch (error) {
    fail("CEREMONY_BINDING_SOURCE_HOLD", error instanceof Error ? error.message : String(error));
  }
  check(
    exact.status === "UNBOUND",
    "CEREMONY_BINDING_SOURCE_HOLD",
    "ceremony source S anchor must be the exact UNBOUND predecessor",
  );
  return Object.freeze({
    binding: exact,
    bindingAnchorSha256: sha256(canonicalBytes),
  });
}

export function observeIatV2DevnetProgramCeremonyRuntimeClosure({
  projectRoot,
  sourceHeadCommit,
  git: suppliedGit,
} = {}) {
  const git = resolvedGit(projectRoot, suppliedGit);
  check(COMMIT.test(sourceHeadCommit ?? ""), "CEREMONY_BINDING_SCHEMA_HOLD", "ceremony source commit is invalid");
  check(
    JSON.stringify(IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS)
      === JSON.stringify([...IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS].sort()),
    "CEREMONY_BINDING_CLOSURE_HOLD",
    "ceremony runtime paths are not in exact code-unit order",
  );
  check(
    new Set(IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS).size
      === IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS.length,
    "CEREMONY_BINDING_CLOSURE_HOLD",
    "ceremony runtime paths are not unique",
  );
  const objectFormat = gitResult(
    git,
    projectRoot,
    ["rev-parse", "--show-object-format"],
    "CEREMONY_BINDING_GIT_HOLD",
    "ceremony Git object format is unavailable",
  );
  check(objectFormat === "sha1", "CEREMONY_BINDING_GIT_HOLD", "ceremony runtime requires reviewed SHA-1 Git objects");
  const prefix = gitResult(
    git,
    projectRoot,
    ["rev-parse", "--show-prefix"],
    "CEREMONY_BINDING_GIT_HOLD",
    "ceremony checkout prefix is unavailable",
  );
  const entries = IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS.map((path) => {
    check(
      !path.startsWith("/") && !path.split("/").includes(".."),
      "CEREMONY_BINDING_CLOSURE_HOLD",
      `ceremony runtime path is noncanonical: ${path}`,
    );
    const repositoryPath = `${prefix}${path}`;
    const line = gitResult(
      git,
      projectRoot,
      ["ls-tree", "--full-tree", sourceHeadCommit, "--", repositoryPath],
      "CEREMONY_BINDING_CLOSURE_HOLD",
      `ceremony source entry is unavailable: ${path}`,
    );
    const match = /^(100644|100755) blob ([0-9a-f]{40})\t(.+)$/u.exec(line);
    check(
      match && match[3] === repositoryPath,
      "CEREMONY_BINDING_CLOSURE_HOLD",
      `ceremony source entry is not one exact regular blob: ${path}`,
    );
    const indexLine = gitResult(
      git,
      projectRoot,
      ["ls-files", "--stage", "--full-name", "--", `:(top)${repositoryPath}`],
      "CEREMONY_BINDING_WORKTREE_HOLD",
      `ceremony index entry is unavailable: ${path}`,
    );
    const indexMatch = /^(100644|100755) ([0-9a-f]{40}) 0\t(.+)$/u.exec(indexLine);
    check(
      indexMatch
        && indexMatch[1] === match[1]
        && indexMatch[2] === match[2]
        && indexMatch[3] === repositoryPath,
      "CEREMONY_BINDING_WORKTREE_HOLD",
      `ceremony index entry differs from source S: ${path}`,
    );
    const bytes = readAtomicRegularBytes(
      resolve(projectRoot, path),
      "CEREMONY_BINDING_CLOSURE_HOLD",
      `ceremony runtime working file ${path}`,
    );
    check(
      gitBlobObjectId(bytes) === match[2],
      "CEREMONY_BINDING_CLOSURE_HOLD",
      `ceremony runtime working bytes differ from source S: ${path}`,
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

export function inspectIatV2DevnetProgramCeremonySource({
  projectRoot,
  git: suppliedGit,
} = {}) {
  const git = resolvedGit(projectRoot, suppliedGit);
  const anchor = readBindingAnchor({ projectRoot, git });
  let binding;
  try {
    binding = parseIatV2DevnetProgramCeremonyBinding(anchor.binding);
  } catch (error) {
    fail("CEREMONY_BINDING_SCHEMA_HOLD", error instanceof Error ? error.message : String(error));
  }
  check(binding.status === "UNBOUND", "CEREMONY_BINDING_SOURCE_HOLD", "ceremony source anchor must remain UNBOUND");
  const sourceHeadCommit = gitResult(
    git,
    projectRoot,
    ["rev-parse", "HEAD"],
    "CEREMONY_BINDING_SOURCE_HOLD",
    "ceremony source HEAD is unavailable",
  );
  const sourceHeadTree = gitResult(
    git,
    projectRoot,
    ["rev-parse", "HEAD^{tree}"],
    "CEREMONY_BINDING_SOURCE_HOLD",
    "ceremony source tree is unavailable",
  );
  const closure = observeIatV2DevnetProgramCeremonyRuntimeClosure({
    projectRoot,
    sourceHeadCommit,
    git,
  });
  return Object.freeze({
    schema: "iat-v2-devnet-program-ceremony-source-inspection/v1",
    status: "UNBOUND",
    network: "devnet",
    mainnetStatus: "HOLD",
    sourceHeadCommit,
    sourceHeadTree,
    bindingAnchorSha256: anchor.bindingAnchorSha256,
    runtimeClosureEntries: closure.entries,
    runtimeClosureSha256: closure.runtimeClosureSha256,
    artifactSourceHeadCommit: binding.artifactSourceHeadCommit,
    artifactBuildRunId: binding.artifactBuildRunId,
    artifactSha256: binding.artifactSha256,
    artifactBytes: binding.artifactBytes,
    transactionExecution: false,
    signing: false,
    broadcast: false,
    mainnetAuthorized: false,
  });
}

function verifyCeremonySuccessorTopologyState({
  projectRoot,
  git: suppliedGit,
} = {}) {
  const git = resolvedGit(projectRoot, suppliedGit);
  const anchor = readBindingAnchor({ projectRoot, git });
  let binding;
  try {
    binding = parseIatV2DevnetProgramCeremonyBinding(anchor.binding, { requireBound: true });
  } catch (error) {
    fail("CEREMONY_BINDING_SCHEMA_HOLD", error instanceof Error ? error.message : String(error));
  }

  gitResult(
    git,
    projectRoot,
    ["cat-file", "-e", `${binding.sourceHeadCommit}^{commit}`],
    "CEREMONY_BINDING_SOURCE_HOLD",
    "bound ceremony source commit is unavailable",
  );
  const sourceTree = gitResult(
    git,
    projectRoot,
    ["rev-parse", `${binding.sourceHeadCommit}^{tree}`],
    "CEREMONY_BINDING_SOURCE_HOLD",
    "bound ceremony source tree is unavailable",
  );
  check(sourceTree === binding.sourceHeadTree, "CEREMONY_BINDING_SOURCE_HOLD", "bound ceremony source tree drifted");
  const prefix = gitResult(
    git,
    projectRoot,
    ["rev-parse", "--show-prefix"],
    "CEREMONY_BINDING_GIT_HOLD",
    "ceremony checkout prefix is unavailable",
  );
  const sourceAnchor = readSourceBindingAnchor({
    git,
    prefix,
    projectRoot,
    sourceHeadCommit: binding.sourceHeadCommit,
  });
  const head = gitResult(
    git,
    projectRoot,
    ["rev-parse", "HEAD"],
    "CEREMONY_BINDING_SUCCESSOR_HOLD",
    "ceremony binding successor HEAD is unavailable",
  );
  const headTree = gitResult(
    git,
    projectRoot,
    ["rev-parse", "HEAD^{tree}"],
    "CEREMONY_BINDING_SUCCESSOR_HOLD",
    "ceremony binding successor tree is unavailable",
  );
  const parents = gitResult(
    git,
    projectRoot,
    ["rev-list", "--parents", "-n", "1", "HEAD"],
    "CEREMONY_BINDING_SUCCESSOR_HOLD",
    "ceremony binding successor parents are unavailable",
  ).split(" ");
  check(
    parents.length === 2 && parents[0] === head && parents[1] === binding.sourceHeadCommit,
    "CEREMONY_BINDING_SUCCESSOR_HOLD",
    "current HEAD is not the direct one-parent binding successor B of source S",
  );
  const expectedBindingDiff = `M\t${prefix}${IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_BINDING_PATH}`;
  const committedDiff = gitResult(
    git,
    projectRoot,
    ["diff", "--no-ext-diff", "--no-textconv", "--name-status", "--no-renames", binding.sourceHeadCommit, "HEAD", "--"],
    "CEREMONY_BINDING_SUCCESSOR_HOLD",
    "ceremony binding successor diff is unavailable",
  );
  check(
    committedDiff === expectedBindingDiff,
    "CEREMONY_BINDING_SUCCESSOR_HOLD",
    "ceremony binding successor changed paths beyond the one canonical anchor",
  );
  const closure = observeIatV2DevnetProgramCeremonyRuntimeClosure({
    projectRoot,
    sourceHeadCommit: binding.sourceHeadCommit,
    git,
  });
  check(
    closure.runtimeClosureSha256 === binding.runtimeClosureSha256,
    "CEREMONY_BINDING_CLOSURE_HOLD",
    "bound ceremony runtime closure digest drifted",
  );
  gitResult(
    git,
    projectRoot,
    ["diff", "--no-ext-diff", "--no-textconv", "--quiet", binding.sourceHeadCommit, "HEAD", "--", ...IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_PATHS],
    "CEREMONY_BINDING_CLOSURE_HOLD",
    "ceremony runtime closure changed in binding-only successor B",
  );
  return Object.freeze({
    anchor,
    binding,
    closure,
    git,
    head,
    headTree,
    sourceAnchor,
  });
}

export function verifyIatV2DevnetProgramCeremonyExactHeadTopology(options = {}) {
  const {
    anchor,
    binding,
    closure,
    head,
    headTree,
    sourceAnchor,
  } = verifyCeremonySuccessorTopologyState(options);
  return Object.freeze({
    schema: "iat-v2-devnet-program-ceremony-exact-head-topology/v1",
    status: "BOUND",
    network: "devnet",
    mainnetStatus: "HOLD",
    sourceHeadCommit: binding.sourceHeadCommit,
    sourceHeadTree: binding.sourceHeadTree,
    checkoutCommit: binding.checkoutCommit,
    checkoutTree: binding.checkoutTree,
    checkoutRelation: binding.checkoutRelation,
    checkoutObjectVerified: false,
    bindingSuccessorCommit: head,
    bindingSuccessorTree: headTree,
    bindingAnchorSha256: anchor.bindingAnchorSha256,
    sourceBindingAnchorSha256: sourceAnchor.bindingAnchorSha256,
    runtimeClosureEntries: closure.entries,
    runtimeClosureSha256: closure.runtimeClosureSha256,
    runtimeEvidenceManifestSha256: binding.runtimeEvidenceManifestSha256,
    relation: "DIRECT_BINDING_ONLY_SUCCESSOR",
    transactionExecution: false,
    signing: false,
    broadcast: false,
    mainnetAuthorized: false,
  });
}

export function verifyIatV2DevnetProgramCeremonyRuntimeBinding(options = {}) {
  const {
    anchor,
    binding,
    closure,
    git,
    head,
    headTree,
    sourceAnchor,
  } = verifyCeremonySuccessorTopologyState(options);
  const { projectRoot } = options;
  gitResult(
    git,
    projectRoot,
    ["cat-file", "-e", `${binding.checkoutCommit}^{commit}`],
    "CEREMONY_BINDING_CHECKOUT_HOLD",
    "bound ceremony CI checkout commit is unavailable",
  );
  const checkoutTree = gitResult(
    git,
    projectRoot,
    ["rev-parse", `${binding.checkoutCommit}^{tree}`],
    "CEREMONY_BINDING_CHECKOUT_HOLD",
    "bound ceremony CI checkout tree is unavailable",
  );
  check(checkoutTree === binding.checkoutTree, "CEREMONY_BINDING_CHECKOUT_HOLD", "bound ceremony CI checkout tree drifted");
  const checkoutParents = gitResult(
    git,
    projectRoot,
    ["rev-list", "--parents", "-n", "1", binding.checkoutCommit],
    "CEREMONY_BINDING_CHECKOUT_HOLD",
    "bound ceremony CI checkout parents are unavailable",
  ).split(" ");
  check(
    checkoutParents.length === 3
      && checkoutParents[0] === binding.checkoutCommit
      && checkoutParents[2] === binding.sourceHeadCommit,
    "CEREMONY_BINDING_CHECKOUT_HOLD",
    "bound ceremony CI checkout is not a two-parent PR merge with source S as second parent",
  );
  const checkoutEvidence = verifyPublicCheckoutEvidenceRef({ binding, git, projectRoot });

  const evidenceBytes = readAtomicRegularBytes(
    resolve(projectRoot, IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH),
    "CEREMONY_BINDING_EVIDENCE_HOLD",
    "fresh ceremony runtime CI evidence manifest",
  );
  let manifest;
  try {
    manifest = JSON.parse(evidenceBytes.toString("utf8"));
  } catch {
    fail("CEREMONY_BINDING_EVIDENCE_HOLD", "fresh ceremony runtime CI evidence manifest is not valid JSON");
  }
  let canonicalCi;
  try {
    const evidenceGit = (root, args) => gitResult(
      git,
      root,
      args,
      "CEREMONY_BINDING_EVIDENCE_HOLD",
      "fresh ceremony runtime CI evidence Git inspection failed",
    );
    canonicalCi = validateSbfEvidence({
      projectRoot,
      manifestPath: IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH,
      allowDescendantCheckout: true,
      verifyArtifactFiles: false,
      git: evidenceGit,
    });
  } catch (error) {
    if (error instanceof IatV2DevnetProgramCeremonyRuntimeBindingError) throw error;
    fail(
      "CEREMONY_BINDING_EVIDENCE_HOLD",
      `fresh ceremony runtime CI evidence failed canonical validation: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  check(
    sha256(evidenceBytes) === binding.runtimeEvidenceManifestSha256
      && canonicalCi?.manifestSha256 === binding.runtimeEvidenceManifestSha256,
    "CEREMONY_BINDING_EVIDENCE_HOLD",
    "fresh ceremony runtime CI evidence SHA-256 disagrees with the binding anchor",
  );
  check(
    canonicalCi?.sourceHeadCommit === binding.sourceHeadCommit
      && canonicalCi?.checkoutCommit === binding.checkoutCommit
      && canonicalCi?.checkoutRelation === binding.checkoutRelation,
    "CEREMONY_BINDING_EVIDENCE_HOLD",
    "fresh ceremony runtime CI source or checkout disagrees with the binding anchor",
  );
  check(
    canonicalCi?.runUrl
      === `https://github.com/InternalAgencyIO/InternalAgency/actions/runs/${binding.ciRunId}/attempts/${binding.ciRunAttempt}`,
    "CEREMONY_BINDING_EVIDENCE_HOLD",
    "fresh ceremony runtime CI public run disagrees with the binding anchor",
  );
  check(
    manifest.sourceBinding?.sourceHeadCommit === binding.sourceHeadCommit
      && manifest.sourceBinding?.sourceHeadTree === binding.sourceHeadTree
      && manifest.sourceBinding?.checkoutCommit === binding.checkoutCommit
      && manifest.sourceBinding?.checkoutTree === binding.checkoutTree
      && manifest.sourceBinding?.checkoutRelation === binding.checkoutRelation
      && manifest.sourceBinding?.workflowEvent === binding.workflowEvent,
    "CEREMONY_BINDING_EVIDENCE_HOLD",
    "fresh ceremony runtime CI source-binding tuple disagrees with the binding anchor",
  );
  check(
    manifest.ciProvenance?.repository === binding.repository
      && manifest.ciProvenance?.repositoryId === binding.repositoryId
      && manifest.ciProvenance?.workflowRef === binding.workflowRef
      && manifest.ciProvenance?.runId === binding.ciRunId
      && manifest.ciProvenance?.runAttempt === binding.ciRunAttempt
      && manifest.ciProvenance?.runnerOs === binding.runnerOs
      && manifest.ciProvenance?.runnerArch === binding.runnerArch,
    "CEREMONY_BINDING_EVIDENCE_HOLD",
    "fresh ceremony runtime CI provenance tuple disagrees with the binding anchor",
  );
  check(
    manifest.artifacts?.programBinary?.sha256 === binding.artifactSha256
      && manifest.artifacts?.programBinary?.bytes === binding.artifactBytes,
    "CEREMONY_BINDING_EVIDENCE_HOLD",
    "fresh ceremony runtime CI artifact tuple disagrees with the immutable migration artifact",
  );
  return Object.freeze({
    schema: "iat-v2-devnet-program-ceremony-runtime-verification/v1",
    status: "BOUND",
    network: "devnet",
    mainnetStatus: "HOLD",
    sourceHeadCommit: binding.sourceHeadCommit,
    sourceHeadTree: binding.sourceHeadTree,
    checkoutCommit: binding.checkoutCommit,
    checkoutTree: binding.checkoutTree,
    checkoutRelation: binding.checkoutRelation,
    checkoutObjectVerified: true,
    checkoutEvidenceRef: checkoutEvidence.checkoutEvidenceRef,
    checkoutEvidenceRemote: checkoutEvidence.checkoutEvidenceRemote,
    localCheckoutEvidenceRef: checkoutEvidence.localCheckoutEvidenceRef,
    checkoutEvidenceRefVerified: true,
    bindingSuccessorCommit: head,
    bindingSuccessorTree: headTree,
    bindingAnchorSha256: anchor.bindingAnchorSha256,
    sourceBindingAnchorSha256: sourceAnchor.bindingAnchorSha256,
    runtimeClosureEntries: closure.entries,
    runtimeClosureSha256: closure.runtimeClosureSha256,
    runtimeEvidenceManifestSha256: binding.runtimeEvidenceManifestSha256,
    runtimeEvidencePath: IAT_V2_DEVNET_PROGRAM_CEREMONY_RUNTIME_EVIDENCE_PATH,
    runtimeEvidenceVerified: true,
    artifactSourceHeadCommit: binding.artifactSourceHeadCommit,
    artifactBuildRunId: binding.artifactBuildRunId,
    artifactEvidenceManifestSha256: binding.artifactEvidenceManifestSha256,
    artifactSha256: binding.artifactSha256,
    artifactBytes: binding.artifactBytes,
    ciRunId: binding.ciRunId,
    ciRunAttempt: binding.ciRunAttempt,
    workflowRef: binding.workflowRef,
    relation: "DIRECT_BINDING_ONLY_SUCCESSOR",
    transactionExecution: false,
    signing: false,
    broadcast: false,
    mainnetAuthorized: false,
  });
}

#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isAbsolute, normalize, relative, resolve } from "node:path";

const expectedProgramId = "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj";
const expectedRepository = "InternalAgencyIO/InternalAgency";
const expectedRepositoryId = 1313660798;
const expectedWorkflowRef = /^InternalAgencyIO\/InternalAgency\/\.github\/workflows\/iat-v2-proof\.yml@refs\/(?:heads\/.+|pull\/[1-9][0-9]*\/merge)$/;
const expectedArtifacts = {
  programBinary: "target/verifiable/iat_v2.so",
  programIdl: "target/idl/iat_v2.json",
  buildLog: "target/iat-v2-sbf-build.log",
};
const expectedManifest = "target/verifiable/iat-v2-build-evidence.json";
const expectedLimitations = [
  "Build evidence only; not signed Devnet evidence.",
  "Does not authorize deployment, signing, broadcast, funding, or Mainnet launch.",
];
const sha256Pattern = /^[0-9a-f]{64}$/;
const commitPattern = /^[0-9a-f]{40}$/;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const git = (projectRoot, args) => execFileSync("git", args, {
  cwd: projectRoot,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
}).trim();

function check(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, keys, label) {
  check(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  check(JSON.stringify(actual) === JSON.stringify(expected), `${label} fields are not exact`);
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
}

function assertCanonicalRegularFile(root, candidate, expectedPath, label) {
  const entry = lstatSync(candidate);
  check(entry.isFile() && !entry.isSymbolicLink(), `${label} must be a regular non-symlink file`);
  const resolvedRelativePath = normalize(relative(realpathSync(root), realpathSync(candidate)));
  check(resolvedRelativePath === normalize(expectedPath), `${label} does not resolve to its canonical evidence path`);
}

export function validateSbfEvidence({ projectRoot = process.cwd(), manifestPath } = {}) {
  const root = resolve(projectRoot);
  const requestedManifest = manifestPath ?? expectedManifest;
  const resolvedManifest = isAbsolute(requestedManifest) ? requestedManifest : resolve(root, requestedManifest);
  assertCanonicalRegularFile(root, resolvedManifest, expectedManifest, "manifest");
  const manifestText = readFileSync(resolvedManifest, "utf8");
  const manifest = JSON.parse(manifestText);
  check(manifestText === `${JSON.stringify(sortJson(manifest), null, 2)}\n`, "manifest JSON is not canonical sorted-key UTF-8 JSON");

  exactKeys(manifest, ["schema", "status", "ciProvenance", "sourceBinding", "programId", "toolchain", "artifacts", "limitations"], "manifest");
  check(manifest.schema === "iat-v2-ci-verifiable-sbf-evidence/v3", "unexpected evidence schema");
  check(manifest.status === "BUILD_ONLY_HOLD", "evidence status must remain BUILD_ONLY_HOLD");
  check(manifest.programId === expectedProgramId, "reviewed program ID drifted");
  check(JSON.stringify(manifest.limitations) === JSON.stringify(expectedLimitations), "HOLD limitations drifted");

  exactKeys(manifest.ciProvenance, ["serverUrl", "repository", "repositoryId", "workflowRef", "runId", "runAttempt"], "ciProvenance");
  const provenance = manifest.ciProvenance;
  check(provenance.serverUrl === "https://github.com", "CI server is not public GitHub");
  check(provenance.repository === expectedRepository, "CI repository drifted");
  check(provenance.repositoryId === expectedRepositoryId, "CI repository ID drifted");
  check(expectedWorkflowRef.test(provenance.workflowRef), "CI workflow reference drifted");
  check(Number.isSafeInteger(provenance.runId) && provenance.runId > 0, "CI run ID is invalid");
  check(Number.isSafeInteger(provenance.runAttempt) && provenance.runAttempt > 0, "CI run attempt is invalid");

  exactKeys(manifest.toolchain, ["rustc", "anchor", "solana"], "toolchain");
  check(/^rustc 1\.97\.1 \([0-9a-f]+ [0-9]{4}-[0-9]{2}-[0-9]{2}\)$/.test(manifest.toolchain.rustc), "Rust toolchain is not exact 1.97.1");
  check(manifest.toolchain.anchor === "anchor-cli 1.0.2", "Anchor toolchain drifted");
  check(/^solana-cli 3\.1\.10\b/.test(manifest.toolchain.solana), "Solana toolchain drifted");

  exactKeys(manifest.sourceBinding, [
    "workflowEvent",
    "sourceHeadCommit",
    "sourceHeadTree",
    "checkoutCommit",
    "checkoutTree",
    "checkoutRelation",
    "trackedWorktree",
  ], "sourceBinding");
  const binding = manifest.sourceBinding;
  check(commitPattern.test(binding.sourceHeadCommit), "source-head commit is malformed");
  check(commitPattern.test(binding.sourceHeadTree), "source-head tree is malformed");
  check(commitPattern.test(binding.checkoutCommit), "checkout commit is malformed");
  check(commitPattern.test(binding.checkoutTree), "checkout tree is malformed");
  check(binding.trackedWorktree === "CLEAN", "manifest does not declare a clean tracked worktree");
  check(git(root, ["status", "--porcelain=v1", "--untracked-files=no"]) === "", "tracked worktree is not clean");
  git(root, ["cat-file", "-e", `${binding.sourceHeadCommit}^{commit}`]);
  check(git(root, ["rev-parse", `${binding.sourceHeadCommit}^{tree}`]) === binding.sourceHeadTree, "source-head tree does not match Git");
  check(git(root, ["rev-parse", "HEAD"]) === binding.checkoutCommit, "checkout commit does not match Git HEAD");
  check(git(root, ["rev-parse", "HEAD^{tree}"]) === binding.checkoutTree, "checkout tree does not match Git HEAD");

  if (binding.workflowEvent === "pull_request") {
    const parents = git(root, ["rev-list", "--parents", "-n", "1", "HEAD"]).split(/\s+/);
    check(binding.checkoutRelation === "PR_MERGE_SECOND_PARENT", "pull-request relation is not fail closed");
    check(parents.length === 3, "pull-request checkout is not an exact two-parent merge");
    check(parents[2] === binding.sourceHeadCommit, "pull-request source head is not merge parent 2");
  } else {
    check(["push", "workflow_dispatch"].includes(binding.workflowEvent), "unsupported workflow event");
    check(binding.checkoutRelation === "IDENTICAL", "branch checkout relation is not IDENTICAL");
    check(binding.checkoutCommit === binding.sourceHeadCommit, "branch checkout does not equal source head");
    check(binding.checkoutTree === binding.sourceHeadTree, "branch checkout tree does not equal source-head tree");
  }

  exactKeys(manifest.artifacts, Object.keys(expectedArtifacts), "artifacts");
  for (const [name, expectedPath] of Object.entries(expectedArtifacts)) {
    const record = manifest.artifacts[name];
    exactKeys(record, ["path", "sha256", "bytes"], `artifacts.${name}`);
    check(record.path === expectedPath, `artifacts.${name}.path drifted`);
    check(sha256Pattern.test(record.sha256), `artifacts.${name}.sha256 is malformed`);
    check(Number.isSafeInteger(record.bytes) && record.bytes > 0, `artifacts.${name}.bytes is invalid`);
    const artifactPath = resolve(root, expectedPath);
    assertCanonicalRegularFile(root, artifactPath, expectedPath, `artifacts.${name}`);
    const bytes = readFileSync(artifactPath);
    check(bytes.length === record.bytes, `artifacts.${name}.bytes does not match the file`);
    check(sha256(bytes) === record.sha256, `artifacts.${name}.sha256 does not match the file`);
  }

  const idl = JSON.parse(readFileSync(resolve(root, expectedArtifacts.programIdl), "utf8"));
  check(idl.address === expectedProgramId, "generated IDL address does not match the reviewed program ID");

  return {
    status: "PASS",
    manifestSha256: sha256(readFileSync(resolvedManifest)),
    sourceHeadCommit: binding.sourceHeadCommit,
    checkoutCommit: binding.checkoutCommit,
    checkoutRelation: binding.checkoutRelation,
    artifactCount: Object.keys(expectedArtifacts).length,
    runUrl: `${provenance.serverUrl}/${provenance.repository}/actions/runs/${provenance.runId}/attempts/${provenance.runAttempt}`,
  };
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const result = validateSbfEvidence({ manifestPath: process.argv[2] });
    console.log(`IAT V2 CI SBF evidence valid: ${result.sourceHeadCommit.slice(0, 8)} -> ${result.checkoutCommit.slice(0, 8)} (${result.checkoutRelation}), ${result.artifactCount} artifacts, manifest ${result.manifestSha256}, public run ${result.runUrl}. BUILD_ONLY_HOLD.`);
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  }
}

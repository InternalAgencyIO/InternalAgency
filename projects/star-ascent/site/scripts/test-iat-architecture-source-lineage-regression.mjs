#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createArchitectureGitEnvironment,
  inspectArchitectureSourceAncestry,
  validateArchitectureSourceLineage,
} from "./iat-architecture-source-lineage.mjs";

const sandbox = mkdtempSync(join(tmpdir(), "iat-architecture-lineage-"));
const shallowSandbox = mkdtempSync(join(tmpdir(), "iat-architecture-lineage-shallow-"));
const gitAt = (cwd, ...args) => execFileSync("git", args, {
  cwd,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  env: createArchitectureGitEnvironment(),
}).trim();
const git = (...args) => gitAt(sandbox, ...args);
const gitResultAt = (cwd, ...args) => spawnSync("git", args, {
  cwd,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
  env: createArchitectureGitEnvironment(),
});
const gitStatus = (...args) => gitResultAt(sandbox, ...args).status;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const architectureRunner = join(siteRoot, "scripts", "validate-iat-v2-architecture-work.mjs");

function runArchitectureRunner(environment) {
  return spawnSync(process.execPath, [architectureRunner], {
    cwd: siteRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: environment,
  });
}

function assertCurrentRepositoryRemainsFull(expectedHead, label) {
  assert.equal(
    gitAt(siteRoot, "rev-parse", "--verify", "HEAD^{commit}"),
    expectedHead,
    `${label}: current repository HEAD changed`,
  );
  assert.equal(
    gitAt(siteRoot, "rev-parse", "--is-shallow-repository"),
    "false",
    `${label}: current repository became shallow`,
  );
}

try {
  const currentRepositoryHead = gitAt(siteRoot, "rev-parse", "--verify", "HEAD^{commit}");
  assertCurrentRepositoryRemainsFull(currentRepositoryHead, "before temporary lineage fixtures");
  git("init", "-b", "historical-v2");
  git("config", "user.email", "lineage-fixture@example.invalid");
  git("config", "user.name", "Lineage fixture");
  writeFileSync(join(sandbox, "historical.txt"), "historical V2 evidence\n");
  git("add", "historical.txt");
  git("commit", "-m", "historical V2 evidence");
  const historicalCommit = git("rev-parse", "HEAD");
  const historicalTree = git("rev-parse", "HEAD^{tree}");

  git("switch", "--orphan", "b3-successor");
  rmSync(join(sandbox, "historical.txt"), { force: true });
  writeFileSync(join(sandbox, "b3.txt"), "B3 forward source\n");
  git("add", "--all");
  git("commit", "-m", "B3 forward source");
  const b3Commit = git("rev-parse", "HEAD");
  const b3Tree = git("rev-parse", "HEAD^{tree}");
  assert.equal(gitStatus("merge-base", "--is-ancestor", historicalCommit, "HEAD"), 1, "fixture histories must be non-ancestral");

  git("branch", "source-pin", b3Commit);
  git("switch", "-c", "pr-head");
  writeFileSync(join(sandbox, "pr.txt"), "pull-request head\n");
  git("add", "pr.txt");
  git("commit", "-m", "pull-request head");
  const prHead = git("rev-parse", "HEAD");
  git("switch", "-c", "main-base", b3Commit);
  writeFileSync(join(sandbox, "base.txt"), "main base\n");
  git("add", "base.txt");
  git("commit", "-m", "main base");
  const mainBase = git("rev-parse", "HEAD");
  const mainBaseTree = git("rev-parse", "HEAD^{tree}");
  git("merge", "--no-ff", prHead, "-m", "synthetic pull-request merge");
  git("branch", "pr-merge", "HEAD");
  const prMerge = git("rev-parse", "HEAD");
  assert.equal(gitStatus("merge-base", "--is-ancestor", b3Commit, prMerge), 0, "B3 source must precede the PR merge fixture");

  git("switch", "--orphan", "unrelated-source");
  writeFileSync(join(sandbox, "unrelated.txt"), "unrelated source\n");
  git("add", "--all");
  git("commit", "-m", "unrelated source");
  const unrelatedCommit = git("rev-parse", "HEAD");
  const unrelatedTree = git("rev-parse", "HEAD^{tree}");
  git("switch", "pr-merge");

  const sourceBinding = {
    repository: "InternalAgencyIO/InternalAgency",
    branch: "agent/iat-launch-window",
    commit: historicalCommit,
    gitTree: historicalTree,
  };
  const historicalManifestBytes = Buffer.from("historical manifest fixture\n");
  const historicalManifestSha256 = sha256(historicalManifestBytes);
  const historicalManifest = { sourceBinding };
  const historicalLedger = { sourceBinding: { ...sourceBinding, draftPullRequest: "https://github.com/InternalAgencyIO/InternalAgency/pull/4" } };
  const successorManifest = {
    schema: "iat-b3-canonical-source-lineage/v1",
    status: "B3_PRIMARY_FORWARD_ARCHITECTURE",
    generatedAtUtc: "2026-08-08T00:00:00Z",
    mainnetStatus: "UNSCHEDULED_HOLD",
    relationship: "EXPLICIT_SUCCESSOR_RETAINING_HISTORICAL_V2_EVIDENCE_WITHOUT_HEAD_ANCESTRY_REQUIREMENT",
    historicalV2Audit: {
      path: "public/audits/iat-v2-architecture-work-20260805/manifest.json",
      manifestSha256: historicalManifestSha256,
      status: "RETAINED_HISTORICAL_EVIDENCE",
      sourceBinding: { ...sourceBinding },
    },
    b3SuccessorBinding: {
      repository: "InternalAgencyIO/InternalAgency",
      branch: "agent/iat-b3-architecture",
      commit: b3Commit,
      gitTree: b3Tree,
      status: "PRIMARY_FORWARD_SOURCE",
    },
    releaseBoundary: {
      deploymentApproved: false,
      fundingApproved: false,
      signingApproved: false,
      broadcastApproved: false,
      mainnetApproved: false,
    },
  };
  const validateAt = (repositoryRoot, candidate, currentHead = "HEAD") => validateArchitectureSourceLineage({
    historicalManifest,
    historicalLedger,
    historicalManifestSha256,
    successorManifest: candidate,
    commitExists: (commit) => gitResultAt(repositoryRoot, "cat-file", "-e", `${commit}^{commit}`).status === 0,
    treeForCommit: (commit) => gitAt(repositoryRoot, "rev-parse", `${commit}^{tree}`),
    inspectAncestry: (ancestor, descendant) => inspectArchitectureSourceAncestry({
      repositoryRoot,
      ancestor,
      descendant,
    }),
    currentHead,
  });
  const validate = (candidate) => validateAt(sandbox, candidate);

  assert.equal(validate(successorManifest).b3SourceCommit, b3Commit);

  const fullHistory = inspectArchitectureSourceAncestry({
    repositoryRoot: sandbox,
    ancestor: b3Commit,
  });
  assert.equal(fullHistory.observedHead, prMerge);
  assert.equal(fullHistory.shallowRepository, false);
  assert.equal(fullHistory.status, 0);
  assert.equal(fullHistory.stderr, "");
  assert.throws(
    () => validateAt(sandbox, successorManifest, prHead),
    new RegExp(`checkout HEAD does not match the declared source head ${prHead} .*observedHead=${JSON.stringify(prMerge)}`, "u"),
    "the validator must reject a synthetic-merge checkout when the declared source is the PR head",
  );

  git("switch", "pr-head");
  assert.equal(validateAt(sandbox, successorManifest, prHead).b3SourceCommit, b3Commit, "exact PR source descendant must pass");
  const mergeOnlyCandidate = structuredClone(successorManifest);
  mergeOnlyCandidate.b3SuccessorBinding.commit = mainBase;
  mergeOnlyCandidate.b3SuccessorBinding.gitTree = mainBaseTree;
  assert.equal(gitStatus("merge-base", "--is-ancestor", mainBase, prMerge), 0, "merge-base-only source must precede the synthetic merge");
  assert.equal(gitStatus("merge-base", "--is-ancestor", mainBase, prHead), 1, "merge-base-only source must not precede the exact PR source");
  assert.throws(
    () => validateAt(sandbox, mergeOnlyCandidate, prHead),
    new RegExp(`successor source commit is not an ancestor of HEAD .*observedHead=${JSON.stringify(prHead)}.*shallowState=full.*mergeBaseStatus=1`, "u"),
  );
  git("switch", "pr-merge");

  const expectFail = (name, mutate, pattern) => {
    const candidate = structuredClone(successorManifest);
    mutate(candidate);
    assert.throws(() => validate(candidate), pattern, name);
  };
  expectFail("historical binding substitution", (value) => { value.historicalV2Audit.sourceBinding.commit = b3Commit; }, /exact historical V2 source binding/);
  expectFail("historical manifest digest drift", (value) => { value.historicalV2Audit.manifestSha256 = "0".repeat(64); }, /manifest digest differs/);
  expectFail("B3 tree drift", (value) => { value.b3SuccessorBinding.gitTree = "0".repeat(40); }, /successor source tree differs/);
  expectFail("non-ancestral current binding", (value) => {
    value.b3SuccessorBinding.commit = unrelatedCommit;
    value.b3SuccessorBinding.gitTree = unrelatedTree;
  }, new RegExp(`successor source commit is not an ancestor of HEAD .*observedHead=${JSON.stringify(prMerge)}.*shallowState=full.*mergeBaseStatus=1.*mergeBaseStderr=<none>`, "u"));
  expectFail("release authority escalation", (value) => { value.releaseBoundary.deploymentApproved = true; }, /improperly grants release authority/);
  expectFail("relationship relabel", (value) => { value.relationship = "ANCESTOR_OF_HEAD"; }, /relationship is not the reviewed/);
  expectFail("hidden successor field", (value) => { value.unreviewed = true; }, /fields are not exact/);

  gitAt(shallowSandbox, "clone", "--depth=1", "--no-single-branch", "--branch", "pr-merge", pathToFileURL(sandbox).href, ".");
  assert.equal(gitAt(shallowSandbox, "rev-parse", "--is-shallow-repository"), "true");
  assert.equal(gitResultAt(shallowSandbox, "cat-file", "-e", `${b3Commit}^{commit}`).status, 0, "shallow fixture must retain the separately pinned B3 object");
  const shallowHistory = inspectArchitectureSourceAncestry({
    repositoryRoot: shallowSandbox,
    ancestor: b3Commit,
  });
  assert.equal(shallowHistory.observedHead, prMerge);
  assert.equal(shallowHistory.shallowRepository, true);
  assert.equal(shallowHistory.status, 1, "shallow split history must reproduce the hosted false-negative shape");
  assert.throws(
    () => validateAt(shallowSandbox, successorManifest),
    new RegExp(`ancestry requires a complete Git history .*observedHead=${JSON.stringify(prMerge)}.*shallowState=shallow.*mergeBaseStatus=1`, "u"),
  );
  assertCurrentRepositoryRemainsFull(currentRepositoryHead, "after temporary shallow-lineage fixture");

  const missingObject = inspectArchitectureSourceAncestry({
    repositoryRoot: sandbox,
    ancestor: "0".repeat(40),
  });
  assert.equal(missingObject.observedHead, prMerge);
  assert.equal(missingObject.shallowRepository, false);
  assert.notEqual(missingObject.status, 0);
  assert.match(missingObject.stderr, /not a valid|unknown revision|bad object/iu);

  const executionError = inspectArchitectureSourceAncestry({
    repositoryRoot: sandbox,
    ancestor: b3Commit,
    executeGit: (args) => args[0] === "merge-base"
      ? { status: null, signal: null, stdout: "", stderr: "", error: new Error("spawn EACCES") }
      : gitResultAt(sandbox, ...args),
  });
  assert.equal(executionError.status, null);
  assert.equal(executionError.error, "spawn EACCES");
  assert.throws(
    () => validateArchitectureSourceLineage({
      historicalManifest,
      historicalLedger,
      historicalManifestSha256,
      successorManifest,
      commitExists: () => true,
      treeForCommit: (commit) => commit === historicalCommit ? historicalTree : b3Tree,
      inspectAncestry: () => executionError,
    }),
    new RegExp(`ancestry command failed .*observedHead=${JSON.stringify(prMerge)}.*shallowState=full.*mergeBaseStatus=<none>.*mergeBaseError="spawn EACCES"`, "u"),
  );

  const baseEnvironment = { ...process.env };
  delete baseEnvironment.IAT_V2_SOURCE_HEAD_SHA;
  const hostedMissing = runArchitectureRunner({ ...baseEnvironment, GITHUB_ACTIONS: "true" });
  assert.notEqual(hostedMissing.status, 0);
  assert.match(hostedMissing.stderr, /IAT_V2_SOURCE_HEAD_SHA is mandatory when GITHUB_ACTIONS=true/u);
  for (const [name, value] of [
    ["empty", ""],
    ["symbolic HEAD", "HEAD"],
    ["malformed", "0".repeat(39)],
    ["uppercase", currentRepositoryHead.toUpperCase()],
  ]) {
    const result = runArchitectureRunner({
      ...baseEnvironment,
      GITHUB_ACTIONS: "true",
      IAT_V2_SOURCE_HEAD_SHA: value,
    });
    assert.notEqual(result.status, 0, `hosted ${name} source must fail`);
    assert.match(result.stderr, /IAT_V2_SOURCE_HEAD_SHA must be an exact lowercase 40-character commit/u, `hosted ${name} diagnostic`);
  }
  const hostedMismatch = runArchitectureRunner({
    ...baseEnvironment,
    GITHUB_ACTIONS: "true",
    IAT_V2_SOURCE_HEAD_SHA: b3Commit,
  });
  assert.notEqual(hostedMismatch.status, 0);
  assert.match(hostedMismatch.stderr, new RegExp(`checkout HEAD does not match the declared source head ${b3Commit} .*observedHead=${JSON.stringify(currentRepositoryHead)}`, "u"));
  const hostedExact = runArchitectureRunner({
    ...baseEnvironment,
    GITHUB_ACTIONS: "true",
    IAT_V2_SOURCE_HEAD_SHA: currentRepositoryHead,
    GIT_DIR: join(shallowSandbox, ".git"),
    GIT_WORK_TREE: shallowSandbox,
    GIT_SHALLOW_FILE: resolve(
      shallowSandbox,
      gitAt(shallowSandbox, "rev-parse", "--git-path", "shallow"),
    ),
  });
  assert.equal(hostedExact.status, 0, hostedExact.stderr);
  assert.match(hostedExact.stdout, /IAT V2 architecture work ledger valid/u);
  const localDerived = runArchitectureRunner({ ...baseEnvironment, GITHUB_ACTIONS: "false" });
  assert.equal(localDerived.status, 0, localDerived.stderr);
  const localMalformed = runArchitectureRunner({
    ...baseEnvironment,
    GITHUB_ACTIONS: "false",
    IAT_V2_SOURCE_HEAD_SHA: "HEAD",
  });
  assert.notEqual(localMalformed.status, 0);
  assert.match(localMalformed.stderr, /IAT_V2_SOURCE_HEAD_SHA must be an exact lowercase 40-character commit/u);
  assertCurrentRepositoryRemainsFull(currentRepositoryHead, "after nested architecture validators");

  console.log("IAT V2-to-B3 source-lineage regression passed: exact PR-source ancestry and hosted source-SHA binding survive hostile local-repository Git overrides; merge-base-only lineage, hosted missing/empty/HEAD/malformed/mismatched source, genuine non-ancestry, shallow split history, missing objects, and Git execution errors fail closed with exact diagnostics; local absent source derives exact HEAD; release authority stays false.");
} finally {
  rmSync(shallowSandbox, { recursive: true, force: true });
  rmSync(sandbox, { recursive: true, force: true });
}

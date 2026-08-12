#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateArchitectureSourceLineage } from "./iat-architecture-source-lineage.mjs";

const sandbox = mkdtempSync(join(tmpdir(), "iat-architecture-lineage-"));
const git = (...args) => execFileSync("git", args, {
  cwd: sandbox,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
}).trim();
const gitStatus = (...args) => spawnSync("git", args, {
  cwd: sandbox,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
}).status;
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

try {
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

  git("switch", "--orphan", "unrelated-source");
  writeFileSync(join(sandbox, "unrelated.txt"), "unrelated source\n");
  git("add", "--all");
  git("commit", "-m", "unrelated source");
  const unrelatedCommit = git("rev-parse", "HEAD");
  const unrelatedTree = git("rev-parse", "HEAD^{tree}");
  git("switch", "b3-successor");

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
  const validate = (candidate) => validateArchitectureSourceLineage({
    historicalManifest,
    historicalLedger,
    historicalManifestSha256,
    successorManifest: candidate,
    commitExists: (commit) => gitStatus("cat-file", "-e", `${commit}^{commit}`) === 0,
    treeForCommit: (commit) => git("rev-parse", `${commit}^{tree}`),
    isAncestor: (ancestor, descendant) => gitStatus("merge-base", "--is-ancestor", ancestor, descendant) === 0,
  });

  assert.equal(validate(successorManifest).b3SourceCommit, b3Commit);

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
  }, /successor source commit is not an ancestor of HEAD/);
  expectFail("release authority escalation", (value) => { value.releaseBoundary.deploymentApproved = true; }, /improperly grants release authority/);
  expectFail("relationship relabel", (value) => { value.relationship = "ANCESTOR_OF_HEAD"; }, /relationship is not the reviewed/);
  expectFail("hidden successor field", (value) => { value.unreviewed = true; }, /fields are not exact/);

  console.log("IAT V2-to-B3 source-lineage regression passed: non-ancestral historical evidence remains commit/tree/digest-bound, the B3 successor must reach HEAD, release authority stays false, and 7 mutation probes fail closed.");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

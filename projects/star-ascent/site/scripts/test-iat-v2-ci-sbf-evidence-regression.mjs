#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateSbfEvidence } from "./validate-iat-v2-ci-sbf-evidence.mjs";

const programId = "62Gth5per9yCuLTG4tnvVDf8yszDvt6Undz3xDmtsnuj";
const sandbox = mkdtempSync(join(tmpdir(), "iat-v2-ci-sbf-evidence-"));
const runGit = (...args) => execFileSync("git", args, {
  cwd: sandbox,
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
}).trim();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const paths = {
  programBinary: "target/verifiable/iat_v2.so",
  programIdl: "target/idl/iat_v2.json",
  buildLog: "target/iat-v2-sbf-build.log",
};

function writeArtifacts() {
  mkdirSync(join(sandbox, "target/verifiable"), { recursive: true });
  mkdirSync(join(sandbox, "target/idl"), { recursive: true });
  const values = {
    programBinary: Buffer.from("deterministic-sbf-fixture"),
    programIdl: Buffer.from(`${JSON.stringify({ address: programId, metadata: { name: "iat_v2" } }, null, 2)}\n`),
    buildLog: Buffer.from("fixture compiler output\n"),
  };
  for (const [name, path] of Object.entries(paths)) writeFileSync(join(sandbox, path), values[name]);
  return values;
}

function artifactRecord(path, bytes) {
  return { path, sha256: sha256(bytes), bytes: bytes.length };
}

function writeManifest(manifest) {
  const path = join(sandbox, "target/verifiable/iat-v2-build-evidence.json");
  const sortJson = (value) => {
    if (Array.isArray(value)) return value.map(sortJson);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
  };
  writeFileSync(path, `${JSON.stringify(sortJson(manifest), null, 2)}\n`);
  return path;
}

try {
  runGit("init", "-b", "main");
  runGit("config", "user.email", "fixture@example.invalid");
  runGit("config", "user.name", "SBF evidence fixture");
  writeFileSync(join(sandbox, "base.txt"), "base\n");
  runGit("add", "base.txt");
  runGit("commit", "-m", "base");
  runGit("checkout", "-b", "feature");
  writeFileSync(join(sandbox, "feature.txt"), "feature\n");
  runGit("add", "feature.txt");
  runGit("commit", "-m", "feature");
  const sourceHeadCommit = runGit("rev-parse", "HEAD");
  const sourceHeadTree = runGit("rev-parse", "HEAD^{tree}");
  runGit("checkout", "main");
  writeFileSync(join(sandbox, "main.txt"), "main\n");
  runGit("add", "main.txt");
  runGit("commit", "-m", "main");
  runGit("merge", "--no-ff", "feature", "-m", "synthetic merge");
  const checkoutCommit = runGit("rev-parse", "HEAD");
  const checkoutTree = runGit("rev-parse", "HEAD^{tree}");
  const artifactBytes = writeArtifacts();
  const baseline = {
    schema: "iat-v2-ci-verifiable-sbf-evidence/v2",
    status: "BUILD_ONLY_HOLD",
    sourceBinding: {
      workflowEvent: "pull_request",
      sourceHeadCommit,
      sourceHeadTree,
      checkoutCommit,
      checkoutTree,
      checkoutRelation: "PR_MERGE_SECOND_PARENT",
      trackedWorktree: "CLEAN",
    },
    programId,
    toolchain: {
      rustc: "rustc 1.97.1 (8bab26f4f 2026-07-14)",
      anchor: "anchor-cli 1.0.2",
      solana: "solana-cli 3.1.10 (fixture)",
    },
    artifacts: Object.fromEntries(Object.entries(paths).map(([name, path]) => [name, artifactRecord(path, artifactBytes[name])])),
    limitations: [
      "Build evidence only; not signed Devnet evidence.",
      "Does not authorize deployment, signing, broadcast, funding, or Mainnet launch.",
    ],
  };
  const manifestPath = writeManifest(baseline);
  assert.equal(validateSbfEvidence({ projectRoot: sandbox, manifestPath }).status, "PASS");

  const expectFail = (name, mutate, pattern) => {
    writeArtifacts();
    writeFileSync(join(sandbox, "base.txt"), "base\n");
    const candidate = structuredClone(baseline);
    mutate(candidate);
    writeManifest(candidate);
    assert.throws(() => validateSbfEvidence({ projectRoot: sandbox, manifestPath }), pattern, name);
  };

  expectFail("READY status", (value) => { value.status = "READY"; }, /BUILD_ONLY_HOLD/);
  expectFail("source tree drift", (value) => { value.sourceBinding.sourceHeadTree = "0".repeat(40); }, /source-head tree/);
  expectFail("relation drift", (value) => { value.sourceBinding.checkoutRelation = "IDENTICAL"; }, /pull-request relation/);
  expectFail("binary digest drift", (value) => { value.artifacts.programBinary.sha256 = "0".repeat(64); }, /sha256 does not match/);
  expectFail("IDL byte drift", (value) => { value.artifacts.programIdl.bytes += 1; }, /bytes does not match/);
  expectFail("extra manifest field", (value) => { value.unreviewed = true; }, /manifest fields are not exact/);
  expectFail("artifact path drift", (value) => { value.artifacts.buildLog.path = "other.log"; }, /path drifted/);
  expectFail("tracked source mutation", () => { writeFileSync(join(sandbox, "base.txt"), "dirty\n"); }, /tracked worktree is not clean/);
  expectFail("missing build log", () => { rmSync(join(sandbox, paths.buildLog)); }, /ENOENT/);
  expectFail("IDL address drift", (value) => {
    const bytes = Buffer.from(`${JSON.stringify({ address: "Vote111111111111111111111111111111111111111" })}\n`);
    writeFileSync(join(sandbox, paths.programIdl), bytes);
    value.artifacts.programIdl = artifactRecord(paths.programIdl, bytes);
  }, /IDL address/);

  writeArtifacts();
  writeManifest(baseline);
  writeFileSync(manifestPath, `${JSON.stringify(baseline, null, 4)}\n`);
  assert.throws(
    () => validateSbfEvidence({ projectRoot: sandbox, manifestPath }),
    /manifest JSON is not canonical/,
    "non-canonical manifest encoding",
  );

  writeArtifacts();
  writeManifest(baseline);
  const decoyDirectory = join(sandbox, "target/symlink-decoy");
  mkdirSync(decoyDirectory, { recursive: true });
  rmSync(join(sandbox, paths.buildLog));
  symlinkSync(decoyDirectory, join(sandbox, paths.buildLog), "junction");
  assert.throws(
    () => validateSbfEvidence({ projectRoot: sandbox, manifestPath }),
    /regular non-symlink file/,
    "artifact symlink indirection",
  );

  console.log("IAT V2 CI SBF evidence regression passed: exact PR head/merge binding and 12 artifact, schema, HOLD, digest, size, path, canonical-JSON, symlink, worktree, and program-ID mutations fail closed.");
} finally {
  rmSync(sandbox, { recursive: true, force: true });
}

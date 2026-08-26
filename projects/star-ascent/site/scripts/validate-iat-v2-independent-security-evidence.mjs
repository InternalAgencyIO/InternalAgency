#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  INDEPENDENT_SECURITY_SOURCE_PATHS,
  validateIndependentSecurityEvidence,
} from "./lib/iat-v2-independent-security-evidence.mjs";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(SITE_ROOT, "../../..");
const HEX_40 = /^[0-9a-f]{40}$/u;
const HEX_64 = /^[0-9a-f]{64}$/u;

function parseCli(argv) {
  const optionNames = {
    "--evidence": "evidence",
    "--github-run-receipt": "githubRun",
    "--github-jobs-receipt": "githubJobs",
    "--github-artifact-receipt": "githubArtifact",
    "--artifact-archive": "artifactArchive",
    "--source-commit": "sourceCommit",
    "--source-tree": "sourceTree",
    "--program-artifact-sha256": "programArtifactSha256",
    "--evaluation-unix-seconds": "evaluationUnixSeconds",
  };
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!Object.hasOwn(optionNames, option) || !value || Object.hasOwn(result, optionNames[option])) {
      throw new Error(`unknown, duplicate, or incomplete option: ${option}`);
    }
    result[optionNames[option]] = value;
  }
  if (Object.keys(result).length !== Object.keys(optionNames).length
    || !HEX_40.test(result.sourceCommit ?? "") || !HEX_40.test(result.sourceTree ?? "")
    || !HEX_64.test(result.programArtifactSha256 ?? "")
    || !/^(?:0|[1-9][0-9]*)$/u.test(result.evaluationUnixSeconds ?? "")) {
    throw new Error("all receipt paths, exact source bindings, and evaluation time are required");
  }
  return result;
}

function git(args, encoding = "utf8") {
  return execFileSync("git", args, {
    cwd: REPOSITORY_ROOT,
    encoding,
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 16 * 1024 * 1024,
  });
}

try {
  const options = parseCli(process.argv.slice(2));
  git(["cat-file", "-e", `${options.sourceCommit}^{commit}`]);
  if (git(["rev-parse", `${options.sourceCommit}^{tree}`]).trim() !== options.sourceTree) {
    throw new Error("expected source tree does not match the source commit");
  }
  const sourceFiles = new Map(INDEPENDENT_SECURITY_SOURCE_PATHS.map((path) => [
    path,
    git(["show", `${options.sourceCommit}:${path}`], "buffer"),
  ]));
  const result = validateIndependentSecurityEvidence({
    evidenceBytes: readFileSync(resolve(options.evidence)),
    githubRunBytes: readFileSync(resolve(options.githubRun)),
    githubJobsBytes: readFileSync(resolve(options.githubJobs)),
    githubArtifactBytes: readFileSync(resolve(options.githubArtifact)),
    artifactArchiveBytes: readFileSync(resolve(options.artifactArchive)),
    sourceFiles,
    expectedSourceCommit: options.sourceCommit,
    expectedSourceTree: options.sourceTree,
    expectedProgramArtifactSha256: options.programArtifactSha256,
    evaluationUnixSeconds: options.evaluationUnixSeconds,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadProductionIdentityIntegrationTrust,
  validateProductionIdentityIntegrationEvidence,
} from "./lib/iat-v2-production-identity-integration-evidence.mjs";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PATH = resolve(
  SITE_ROOT,
  "target/identity-integration/iat-v2-production-identity-integration-evidence.json",
);

function parseCli(argv) {
  const result = {
    path: DEFAULT_PATH,
    sourceCommit: null,
    sourceTree: null,
    programArtifactSha256: null,
    evaluationUnixSeconds: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if ([
      "--evidence",
      "--source-commit",
      "--source-tree",
      "--program-artifact-sha256",
      "--evaluation-unix-seconds",
    ].includes(argument) && value) {
      const key = {
        "--evidence": "path",
        "--source-commit": "sourceCommit",
        "--source-tree": "sourceTree",
        "--program-artifact-sha256": "programArtifactSha256",
        "--evaluation-unix-seconds": "evaluationUnixSeconds",
      }[argument];
      result[key] = value;
      index += 1;
    } else {
      throw new Error(`unknown or incomplete option: ${argument}`);
    }
  }
  if (!result.sourceCommit || !result.sourceTree
    || !result.programArtifactSha256 || !result.evaluationUnixSeconds) {
    throw new Error("source commit, tree, program artifact, and evaluation time are required");
  }
  return result;
}

try {
  const options = parseCli(process.argv.slice(2));
  const result = validateProductionIdentityIntegrationEvidence({
    evidenceBytes: readFileSync(resolve(options.path)),
    trust: loadProductionIdentityIntegrationTrust(),
    expectedSourceCommit: options.sourceCommit,
    expectedSourceTree: options.sourceTree,
    expectedProgramArtifactSha256: options.programArtifactSha256,
    evaluationUnixSeconds: options.evaluationUnixSeconds,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.valid) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

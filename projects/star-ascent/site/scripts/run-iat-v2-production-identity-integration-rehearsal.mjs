#!/usr/bin/env node

import {
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  loadProductionIdentityIntegrationTrust,
  parseProductionIdentityIntegrationEvidenceJson,
  validateProductionIdentityIntegrationEvidence,
} from "./lib/iat-v2-production-identity-integration-evidence.mjs";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CANDIDATE_ROOT = resolve(SITE_ROOT, "target/identity-integration");
const DEFAULT_INPUT = resolve(CANDIDATE_ROOT, "observer-signed-candidate.json");
const OUTPUT_PATH = resolve(
  CANDIDATE_ROOT,
  "iat-v2-production-identity-integration-evidence.json",
);

function assertCandidatePath(path) {
  const resolved = resolve(path);
  const rel = relative(CANDIDATE_ROOT, resolved);
  if (rel === "" || rel.startsWith(`..${sep}`) || rel === ".." || rel.includes(`..${sep}`)) {
    throw new Error("candidate input must remain under target/identity-integration");
  }
  const entry = lstatSync(resolved);
  if (!entry.isFile() || entry.isSymbolicLink() || realpathSync(resolved) !== resolved) {
    throw new Error("candidate input must be a canonical regular non-symlink file");
  }
  return resolved;
}

export function produceProductionIdentityIntegrationEvidence({
  candidateBytes,
  trust,
  expectedSourceCommit,
  expectedSourceTree,
  expectedProgramArtifactSha256,
  evaluationUnixSeconds,
} = {}) {
  let candidate;
  try {
    candidate = parseProductionIdentityIntegrationEvidenceJson(
      new TextDecoder("utf-8", { fatal: true }).decode(candidateBytes),
      "candidate",
    );
  } catch (error) {
    throw new Error(`CANDIDATE_HOLD: ${error.message}`);
  }
  if (candidate.environment !== "NONPRODUCTION_X_CLOUDFLARE_INTEGRATION"
    || candidate.safety?.productionResourceMutationPerformed !== false
    || candidate.safety?.mainnetRequestPerformed !== false
    || candidate.safety?.nonproductionNetworkRequestsPerformed !== true
    || candidate.safety?.nonproductionD1MutationPerformed !== true) {
    throw new Error("PRODUCTION_OR_MISSING_EXTERNAL_RECEIPTS_HOLD");
  }
  const result = validateProductionIdentityIntegrationEvidence({
    evidenceBytes: candidateBytes,
    trust,
    expectedSourceCommit,
    expectedSourceTree,
    expectedProgramArtifactSha256,
    evaluationUnixSeconds,
  });
  if (!result.valid) {
    throw new Error(`CANONICAL_OBSERVER_IDENTITY_INTEGRATION_HOLD: ${result.violations.join("; ")}`);
  }
  return `${JSON.stringify(candidate, null, 2)}\n`;
}

function parseCli(argv) {
  const result = {
    input: DEFAULT_INPUT,
    sourceCommit: null,
    sourceTree: null,
    programArtifactSha256: null,
    evaluationUnixSeconds: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];
    if ([
      "--input",
      "--source-commit",
      "--source-tree",
      "--program-artifact-sha256",
      "--evaluation-unix-seconds",
    ].includes(argument) && value) {
      const key = {
        "--input": "input",
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

function main() {
  try {
    const options = parseCli(process.argv.slice(2));
    const input = assertCandidatePath(options.input);
    const output = produceProductionIdentityIntegrationEvidence({
      candidateBytes: readFileSync(input),
      trust: loadProductionIdentityIntegrationTrust(),
      expectedSourceCommit: options.sourceCommit,
      expectedSourceTree: options.sourceTree,
      expectedProgramArtifactSha256: options.programArtifactSha256,
      evaluationUnixSeconds: options.evaluationUnixSeconds,
    });
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, output, { encoding: "utf8", flag: "wx" });
    console.log(`Canonical-trust-pinned nonproduction X/D1 observer evidence written to ${OUTPUT_PATH}. Mainnet remains HOLD.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();

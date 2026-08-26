#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  INDEPENDENT_SECURITY_ARTIFACT_ENTRIES,
  INDEPENDENT_SECURITY_ARTIFACT_NAME,
  INDEPENDENT_SECURITY_CHECK_SPECS,
  INDEPENDENT_SECURITY_EVIDENCE_SCHEMA,
  INDEPENDENT_SECURITY_EVIDENCE_STATUS,
  INDEPENDENT_SECURITY_FRESHNESS_SECONDS,
  INDEPENDENT_SECURITY_LIMITATIONS,
  INDEPENDENT_SECURITY_MAINNET_STATUS,
  INDEPENDENT_SECURITY_MANIFEST_PATH,
  INDEPENDENT_SECURITY_PREDICATE,
  INDEPENDENT_SECURITY_REPOSITORY,
  INDEPENDENT_SECURITY_REPOSITORY_ID,
  INDEPENDENT_SECURITY_SAFETY,
  INDEPENDENT_SECURITY_SOURCE_PATHS,
  INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS,
  INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY,
  INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME,
  INDEPENDENT_SECURITY_WORKFLOW_PATH,
  deriveIndependentSecurityFindingSummary,
  independentSecurityCanonicalBytes,
  parseIndependentSecurityExitCodeBytes,
  summarizeCargoAuditBytes,
  summarizeNpmAuditBytes,
  summarizeTapBytes,
} from "./lib/iat-v2-independent-security-evidence.mjs";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(SITE_ROOT, "../../..");
const HEX_40 = /^[0-9a-f]{40}$/u;
const HEX_64 = /^[0-9a-f]{64}$/u;

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function exactMapKeys(map, keys, label) {
  if (!(map instanceof Map)
    || JSON.stringify([...map.keys()].sort()) !== JSON.stringify([...keys].sort())) {
    throw new TypeError(`${label}: exact caller-supplied byte inventory required`);
  }
  for (const [path, bytes] of map) {
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1) {
      throw new TypeError(`${label}.${path}: nonempty direct bytes required`);
    }
  }
}

function wholeSecondUtc(value, label) {
  if (typeof value !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(value)
    || !Number.isFinite(Date.parse(value))
    || new Date(Date.parse(value)).toISOString().replace(".000Z", "Z") !== value) {
    throw new TypeError(`${label}: canonical whole-second UTC required`);
  }
  return value;
}

function versionLine(bytes, label) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n") || text.includes("\r")) {
    throw new TypeError(`${label}: exact LF-terminated version line required`);
  }
  return text.slice(0, -1);
}

function inputKind(path) {
  if (path.endsWith("package-lock.json") || path.endsWith("Cargo.lock")) return "LOCKFILE";
  if (path === INDEPENDENT_SECURITY_WORKFLOW_PATH) return "WORKFLOW";
  return "SECURITY_REGRESSION";
}

export function assembleIndependentSecurityEvidence({
  rawOutputs,
  sourceFiles,
  sourceBinding,
  ciContext,
  observedAtUtc,
} = {}) {
  const requiredRawPaths = [
    ...INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS,
    ...INDEPENDENT_SECURITY_CHECK_SPECS.flatMap(({ rawPath, exitCodePath }) => [
      rawPath,
      exitCodePath,
    ]),
  ];
  exactMapKeys(rawOutputs, requiredRawPaths, "rawOutputs");
  exactMapKeys(sourceFiles, INDEPENDENT_SECURITY_SOURCE_PATHS, "sourceFiles");
  if (!sourceBinding || !HEX_40.test(sourceBinding.commit ?? "")
    || !HEX_40.test(sourceBinding.tree ?? "")
    || !HEX_64.test(sourceBinding.programArtifactSha256 ?? "")
    || /^0{64}$/u.test(sourceBinding.programArtifactSha256)) {
    throw new TypeError("sourceBinding: exact non-placeholder commit/tree/program artifact required");
  }
  const expectedContextKeys = [
    "serverUrl",
    "repository",
    "repositoryId",
    "workflowRef",
    "runId",
    "runAttempt",
    "eventName",
    "sourceHeadSha",
    "checkoutSha",
    "jobKey",
    "runnerOs",
    "runnerArch",
  ];
  if (!ciContext || JSON.stringify(Object.keys(ciContext).sort())
    !== JSON.stringify(expectedContextKeys.sort())
    || ciContext.serverUrl !== "https://github.com"
    || ciContext.repository !== INDEPENDENT_SECURITY_REPOSITORY
    || ciContext.repositoryId !== INDEPENDENT_SECURITY_REPOSITORY_ID
    || !Number.isSafeInteger(ciContext.runId) || ciContext.runId <= 0
    || !Number.isSafeInteger(ciContext.runAttempt) || ciContext.runAttempt <= 0
    || !["pull_request", "push", "workflow_dispatch"].includes(ciContext.eventName)
    || ciContext.sourceHeadSha !== sourceBinding.commit
    || ciContext.checkoutSha !== sourceBinding.commit
    || ciContext.jobKey !== INDEPENDENT_SECURITY_WORKFLOW_JOB_KEY
    || ciContext.runnerOs !== "Linux" || ciContext.runnerArch !== "X64") {
    throw new TypeError("ciContext: exact public GitHub source-head job context required");
  }
  const observed = wholeSecondUtc(observedAtUtc, "observedAtUtc");
  const expires = new Date(
    Date.parse(observed) + Number(INDEPENDENT_SECURITY_FRESHNESS_SECONDS) * 1_000,
  ).toISOString().replace(".000Z", "Z");
  const checks = [];
  const cargoDatabases = [];
  for (const specification of INDEPENDENT_SECURITY_CHECK_SPECS) {
    const raw = rawOutputs.get(specification.rawPath);
    const exitCodeBytes = rawOutputs.get(specification.exitCodePath);
    const exitCode = parseIndependentSecurityExitCodeBytes(
      exitCodeBytes,
      `${specification.id} exit code`,
    );
    let observation;
    if (specification.kind === "NPM_AUDIT") {
      observation = summarizeNpmAuditBytes(raw, specification.id);
    } else if (specification.kind === "CARGO_AUDIT") {
      const summary = summarizeCargoAuditBytes(raw, specification.id);
      observation = summary.observation;
      cargoDatabases.push(summary.database);
    } else {
      observation = summarizeTapBytes(raw, specification.id);
    }
    checks.push({
      id: specification.id,
      kind: specification.kind,
      inputPath: specification.inputPath,
      rawPath: specification.rawPath,
      rawSha256: sha256(raw),
      rawBytes: raw.byteLength,
      exitCodePath: specification.exitCodePath,
      exitCodeSha256: sha256(exitCodeBytes),
      exitCodeBytes: exitCodeBytes.byteLength,
      exitCode,
      observation,
    });
  }
  if (cargoDatabases.length !== 3
    || cargoDatabases.some((database) => JSON.stringify(database) !== JSON.stringify(cargoDatabases[0]))) {
    throw new Error("all three Cargo audits must bind one exact RustSec advisory snapshot");
  }
  const nodeVersion = versionLine(
    rawOutputs.get(INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS[0]),
    "Node version",
  );
  const npmVersion = versionLine(
    rawOutputs.get(INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS[1]),
    "npm version",
  );
  const cargoAuditVersion = versionLine(
    rawOutputs.get(INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS[2]),
    "Cargo audit version",
  );
  if (!/^v24\.[0-9]+\.[0-9]+$/u.test(nodeVersion)
    || !/^(?:v)?[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/u.test(npmVersion)
    || !/^cargo-audit\s+0\.22\.2$/u.test(cargoAuditVersion)) {
    throw new Error("exact Node 24, semantic npm, and cargo-audit 0.22.2 tool versions required");
  }
  const evidence = {
    schema: INDEPENDENT_SECURITY_EVIDENCE_SCHEMA,
    status: INDEPENDENT_SECURITY_EVIDENCE_STATUS,
    predicate: INDEPENDENT_SECURITY_PREDICATE,
    sourceBinding: {
      commit: sourceBinding.commit,
      tree: sourceBinding.tree,
      programArtifactSha256: sourceBinding.programArtifactSha256,
    },
    ciProvenance: {
      serverUrl: ciContext.serverUrl,
      repository: ciContext.repository,
      repositoryId: ciContext.repositoryId,
      workflowRef: ciContext.workflowRef,
      workflowPath: INDEPENDENT_SECURITY_WORKFLOW_PATH,
      workflowSha256: sha256(sourceFiles.get(INDEPENDENT_SECURITY_WORKFLOW_PATH)),
      runId: ciContext.runId,
      runAttempt: ciContext.runAttempt,
      eventName: ciContext.eventName,
      sourceHeadSha: ciContext.sourceHeadSha,
      checkoutSha: ciContext.checkoutSha,
      checkoutRelation: "IDENTICAL",
      jobKey: ciContext.jobKey,
      jobName: INDEPENDENT_SECURITY_WORKFLOW_JOB_NAME,
      runnerOs: ciContext.runnerOs,
      runnerArch: ciContext.runnerArch,
      artifactName: INDEPENDENT_SECURITY_ARTIFACT_NAME,
    },
    inputBindings: INDEPENDENT_SECURITY_SOURCE_PATHS.map((path) => ({
      path,
      kind: inputKind(path),
      sha256: sha256(sourceFiles.get(path)),
      bytes: sourceFiles.get(path).byteLength,
    })),
    toolchain: {
      nodeVersion,
      npmVersion,
      cargoAuditVersion,
      ...cargoDatabases[0],
    },
    checks,
    findingSummary: deriveIndependentSecurityFindingSummary(checks),
    artifactContract: {
      name: INDEPENDENT_SECURITY_ARTIFACT_NAME,
      manifestPath: INDEPENDENT_SECURITY_MANIFEST_PATH,
      entries: INDEPENDENT_SECURITY_ARTIFACT_ENTRIES,
    },
    observedAtUtc: observed,
    expiresAtUtc: expires,
    safety: INDEPENDENT_SECURITY_SAFETY,
    limitations: INDEPENDENT_SECURITY_LIMITATIONS,
    mainnetStatus: INDEPENDENT_SECURITY_MAINNET_STATUS,
  };
  return Object.freeze(evidence);
}

const CLI_OPTIONS = Object.freeze({
  "--node-version": INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS[0],
  "--npm-version": INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS[1],
  "--cargo-audit-version": INDEPENDENT_SECURITY_TOOL_OUTPUT_PATHS[2],
  "--npm-root-audit": INDEPENDENT_SECURITY_CHECK_SPECS[0].rawPath,
  "--npm-root-exit-code": INDEPENDENT_SECURITY_CHECK_SPECS[0].exitCodePath,
  "--npm-site-audit": INDEPENDENT_SECURITY_CHECK_SPECS[1].rawPath,
  "--npm-site-exit-code": INDEPENDENT_SECURITY_CHECK_SPECS[1].exitCodePath,
  "--cargo-site-audit": INDEPENDENT_SECURITY_CHECK_SPECS[2].rawPath,
  "--cargo-site-exit-code": INDEPENDENT_SECURITY_CHECK_SPECS[2].exitCodePath,
  "--cargo-account-lifecycle-audit": INDEPENDENT_SECURITY_CHECK_SPECS[3].rawPath,
  "--cargo-account-lifecycle-exit-code": INDEPENDENT_SECURITY_CHECK_SPECS[3].exitCodePath,
  "--cargo-stake-ingress-audit": INDEPENDENT_SECURITY_CHECK_SPECS[4].rawPath,
  "--cargo-stake-ingress-exit-code": INDEPENDENT_SECURITY_CHECK_SPECS[4].exitCodePath,
  "--security-regression-tap": INDEPENDENT_SECURITY_CHECK_SPECS[5].rawPath,
  "--security-regression-exit-code": INDEPENDENT_SECURITY_CHECK_SPECS[5].exitCodePath,
});

function parseCli(argv) {
  const result = { rawPaths: new Map(), output: null, programArtifactSha256: null };
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!value) throw new Error(`unknown or incomplete option: ${option}`);
    if (Object.hasOwn(CLI_OPTIONS, option)) result.rawPaths.set(CLI_OPTIONS[option], value);
    else if (option === "--output") result.output = value;
    else if (option === "--program-artifact-sha256") result.programArtifactSha256 = value;
    else throw new Error(`unknown or incomplete option: ${option}`);
  }
  if (result.rawPaths.size !== Object.keys(CLI_OPTIONS).length || !result.output
    || !HEX_64.test(result.programArtifactSha256 ?? "")) {
    throw new Error("all exact raw outputs, output path, and program artifact SHA-256 are required");
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

function requiredEnvironment() {
  const sourceHeadSha = process.env.IAT_V2_SECURITY_SOURCE_HEAD_SHA;
  const context = {
    serverUrl: process.env.GITHUB_SERVER_URL,
    repository: process.env.GITHUB_REPOSITORY,
    repositoryId: Number(process.env.GITHUB_REPOSITORY_ID),
    workflowRef: process.env.GITHUB_WORKFLOW_REF,
    runId: Number(process.env.GITHUB_RUN_ID),
    runAttempt: Number(process.env.GITHUB_RUN_ATTEMPT),
    eventName: process.env.GITHUB_EVENT_NAME,
    sourceHeadSha,
    checkoutSha: git(["rev-parse", "HEAD"]).trim(),
    jobKey: process.env.GITHUB_JOB,
    runnerOs: process.env.RUNNER_OS,
    runnerArch: process.env.RUNNER_ARCH,
  };
  if (!HEX_40.test(sourceHeadSha ?? "") || context.checkoutSha !== sourceHeadSha
    || git(["status", "--porcelain=v1", "--untracked-files=no"]).trim() !== "") {
    throw new Error("CI checkout must be the exact clean tracked source head");
  }
  return context;
}

function main() {
  const options = parseCli(process.argv.slice(2));
  const context = requiredEnvironment();
  const sourceTree = git(["rev-parse", `${context.sourceHeadSha}^{tree}`]).trim();
  const sourceFiles = new Map(INDEPENDENT_SECURITY_SOURCE_PATHS.map((path) => [
    path,
    git(["show", `${context.sourceHeadSha}:${path}`], "buffer"),
  ]));
  const rawOutputs = new Map([...options.rawPaths].map(([logicalPath, diskPath]) => [
    logicalPath,
    readFileSync(resolve(diskPath)),
  ]));
  const observedAtUtc = new Date(Math.floor(Date.now() / 1_000) * 1_000)
    .toISOString().replace(".000Z", "Z");
  const evidence = assembleIndependentSecurityEvidence({
    rawOutputs,
    sourceFiles,
    sourceBinding: {
      commit: context.sourceHeadSha,
      tree: sourceTree,
      programArtifactSha256: options.programArtifactSha256,
    },
    ciContext: context,
    observedAtUtc,
  });
  const output = resolve(options.output);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, independentSecurityCanonicalBytes(evidence), { flag: "wx" });
  process.stdout.write(`${JSON.stringify({
    status: evidence.status,
    predicate: evidence.predicate,
    sourceCommit: evidence.sourceBinding.commit,
    sourceTree: evidence.sourceBinding.tree,
    programArtifactSha256: evidence.sourceBinding.programArtifactSha256,
    findingSummary: evidence.findingSummary,
    output,
    mainnetStatus: evidence.mainnetStatus,
  }, null, 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

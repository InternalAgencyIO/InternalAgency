#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const IAT_B3_MANDATORY_CI_GATE_SCHEMA = "iat-b3-mandatory-ci-gates/v1";

export const IAT_B3_MANDATORY_CI_GATES = Object.freeze({
  "ci-manifest": Object.freeze([
    "tests/iat-b3-mandatory-ci-gates.test.mjs",
  ]),
  "economy-reproducible-build": Object.freeze([
    "tests/iat-b3-economy-reproducible-build.test.mjs",
  ]),
  "native-wsl-hard-disable": Object.freeze([
    "tests/iat-b3-native-wsl-hard-disable-ci.test.mjs",
  ]),
  "local-rehearsal-readiness": Object.freeze([
    "tests/iat-b3-local-rehearsal-readiness.test.mjs",
  ]),
  "production-transaction-builders": Object.freeze([
    "tests/iat-b3-production-transaction-builders.test.mjs",
  ]),
  "production-local-rehearsal": Object.freeze([
    "tests/iat-b3-production-loopback-adapter.test.mjs",
    "tests/iat-b3-production-local-rehearsal-driver.test.mjs",
    "tests/iat-b3-production-local-rehearsal-plan.test.mjs",
  ]),
  "production-official-local-rehearsal": Object.freeze([
    "tests/iat-b3-production-official-local-rehearsal-evidence.test.mjs",
  ]),
  "all-feature-devnet-readiness": Object.freeze([
    "tests/iat-b3-all-feature-devnet-readiness.test.mjs",
    "tests/iat-b3-devnet-gate-split.test.mjs",
  ]),
});

export const IAT_B3_MANDATORY_CI_EXPECTED_TEST_COUNTS = Object.freeze({
  "ci-manifest": 6,
  "economy-reproducible-build": 9,
  "native-wsl-hard-disable": 2,
  "local-rehearsal-readiness": 9,
  "production-transaction-builders": 11,
  "production-local-rehearsal": 29,
  "production-official-local-rehearsal": 18,
  "all-feature-devnet-readiness": 25,
});

const SITE_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const FORBIDDEN_ENVIRONMENT = /^(?:IAT_B3_|NODE_(?:OPTIONS|TEST_CONTEXT|V8_COVERAGE)$|TEST_|MOCK_|FIXTURE_|SKIP_|FORCE_)/u;

function summaryCount(output, label) {
  const matches = [...output.matchAll(new RegExp(`^# ${label} ([0-9]+)$`, "gmu"))];
  if (matches.length !== 1) {
    throw new Error(`IAT_B3_MANDATORY_CI_GATE_${label.toUpperCase()}_SUMMARY_HOLD`);
  }
  return Number(matches[0][1]);
}

export function validateIatB3MandatoryCiTap(output, gate, expectedTestCount) {
  if (typeof output !== "string" || output.length === 0 || !output.startsWith("TAP version 13\n")) {
    throw new Error(`IAT_B3_MANDATORY_CI_GATE_${gate}_TAP_HOLD`);
  }
  const tests = summaryCount(output, "tests");
  const suites = summaryCount(output, "suites");
  const pass = summaryCount(output, "pass");
  const fail = summaryCount(output, "fail");
  const cancelled = summaryCount(output, "cancelled");
  const skipped = summaryCount(output, "skipped");
  const todo = summaryCount(output, "todo");
  const plans = [...output.matchAll(/^1\.\.([0-9]+)$/gmu)];
  const results = [...output.matchAll(/^(ok|not ok) ([0-9]+)(?:\s+-|\s*$)/gmu)];
  const sequentialResults = results.length === tests
    && results.every((match, index) => match[1] === "ok" && Number(match[2]) === index + 1);
  if (!Number.isSafeInteger(expectedTestCount) || expectedTestCount < 1
    || tests !== expectedTestCount || plans.length !== 1
    || Number(plans[0][1]) !== tests || !sequentialResults
    || suites !== 0 || pass !== tests || fail !== 0
    || cancelled !== 0 || skipped !== 0 || todo !== 0
    || /(?:^|\s)#\s*SKIP\b/mu.test(output)
    || /(?:^|\s)#\s*TODO\b/mu.test(output)) {
    throw new Error(`IAT_B3_MANDATORY_CI_GATE_${gate}_INCOMPLETE_HOLD`);
  }
  return Object.freeze({ gate, tests, pass, fail, cancelled, skipped, todo });
}

export function parseIatB3MandatoryCiGateArguments(arguments_) {
  if (!Array.isArray(arguments_) || arguments_.length !== 1
    || typeof arguments_[0] !== "string"
    || !Object.hasOwn(IAT_B3_MANDATORY_CI_GATES, arguments_[0])) {
    throw new Error("IAT_B3_MANDATORY_CI_GATE_EXACT_ARGUMENT_REQUIRED_HOLD");
  }
  return arguments_[0];
}

function sanitizedEnvironment(environment) {
  return Object.fromEntries(Object.entries(environment ?? {}).filter(([name, value]) =>
    !FORBIDDEN_ENVIRONMENT.test(name) && typeof value === "string"));
}

export function runIatB3MandatoryCiGate(gate, {
  runner = spawnSync,
  environment = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
} = {}) {
  if (typeof gate !== "string" || !Object.hasOwn(IAT_B3_MANDATORY_CI_GATES, gate)) {
    throw new Error("IAT_B3_MANDATORY_CI_GATE_UNKNOWN_HOLD");
  }
  if (process.versions.node.split(".")[0] !== "24") {
    throw new Error("IAT_B3_MANDATORY_CI_GATE_NODE_24_REQUIRED_HOLD");
  }
  const files = IAT_B3_MANDATORY_CI_GATES[gate];
  const expectedTestCount = IAT_B3_MANDATORY_CI_EXPECTED_TEST_COUNTS[gate];
  const arguments_ = ["--test", "--test-reporter=tap", ...files];
  const childEnvironment = sanitizedEnvironment(environment);
  const result = runner(process.execPath, arguments_, {
    cwd: SITE_ROOT,
    env: childEnvironment,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  const output = typeof result?.stdout === "string" ? result.stdout : "";
  const diagnostic = typeof result?.stderr === "string" ? result.stderr : "";
  stdout.write(output);
  stderr.write(diagnostic);
  if (result?.error || result?.signal !== null || result?.status !== 0) {
    throw new Error(`IAT_B3_MANDATORY_CI_GATE_${gate}_PROCESS_HOLD`);
  }
  return validateIatB3MandatoryCiTap(
    output.replaceAll("\r\n", "\n"),
    gate,
    expectedTestCount,
  );
}

function main() {
  const gate = parseIatB3MandatoryCiGateArguments(process.argv.slice(2));
  const result = runIatB3MandatoryCiGate(gate);
  process.stdout.write(`${JSON.stringify({
    schema: IAT_B3_MANDATORY_CI_GATE_SCHEMA,
    status: "PASS",
    ...result,
    artifactBuilt: false,
    rpcUsed: false,
    keyRead: false,
    transactionSigned: false,
    transactionSent: false,
    devnetExecuted: false,
    mainnetAuthorized: false,
  })}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

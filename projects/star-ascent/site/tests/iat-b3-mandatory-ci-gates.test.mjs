import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  IAT_B3_MANDATORY_CI_EXPECTED_TEST_COUNTS,
  IAT_B3_MANDATORY_CI_GATES,
  parseIatB3MandatoryCiGateArguments,
  runIatB3MandatoryCiGate,
  validateIatB3MandatoryCiTap,
} from "../scripts/run-iat-b3-mandatory-ci-gate.mjs";

const SITE_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const WORKFLOW_PATH = resolve(SITE_ROOT, "../../..", ".github/workflows/iat-v2-proof.yml");
const RUNNER_PATH = resolve(SITE_ROOT, "scripts/run-iat-b3-mandatory-ci-gate.mjs");

const REQUIRED_STEPS = Object.freeze([
  ["Enforce the mandatory B3 CI gate manifest", "ci-manifest"],
  ["Validate the Economy reproducible-build contract without building", "economy-reproducible-build"],
  ["Prove the native WSL build path remains hard-disabled", "native-wsl-hard-disable"],
  ["Validate the exact local-rehearsal readiness contract without execution", "local-rehearsal-readiness"],
  ["Validate all 15 source-bound production transaction builders", "production-transaction-builders"],
  ["Validate the production loopback driver and nonauthorizing plan", "production-local-rehearsal"],
  ["Validate the all-feature Devnet readiness assessor without Devnet execution", "all-feature-devnet-readiness"],
]);
const RUST_ALL_FEATURE_ENVIRONMENT = Object.freeze([
  ["IAT_B3_PRODUCTION_LAW_PROGRAM_ID", "D6UucuMprPAYyCmr5UPU5h9YhRf2ZNtn23JTS32EjdjY"],
  ["IAT_B3_PRODUCTION_ECONOMY_PROGRAM_ID", "GLb6VMiKEhRRfYnD1p3a3iCAR3kgtRr8qdHxEHAzbdDU"],
  ["IAT_B3_PRODUCTION_CANONICAL_MINT", "3JF3sEqM796hk5WFqA6EtmEwJQ9quALszsfJyvXNQKy3"],
  ["IAT_B3_PRODUCTION_MAINNET_GENESIS_HASH", "4zEL9HZwTFoanu5RbmGspF5a6uqVGP99xkJxToZoq3Pw"],
]);
const RUST_ALL_FEATURE_COMMAND = "cargo test --workspace --all-targets --all-features --locked";

const EXACT_GATE_FILES = Object.freeze({
  "ci-manifest": ["tests/iat-b3-mandatory-ci-gates.test.mjs"],
  "economy-reproducible-build": ["tests/iat-b3-economy-reproducible-build.test.mjs"],
  "native-wsl-hard-disable": ["tests/iat-b3-native-wsl-hard-disable-ci.test.mjs"],
  "local-rehearsal-readiness": ["tests/iat-b3-local-rehearsal-readiness.test.mjs"],
  "production-transaction-builders": ["tests/iat-b3-production-transaction-builders.test.mjs"],
  "production-local-rehearsal": [
    "tests/iat-b3-production-loopback-adapter.test.mjs",
    "tests/iat-b3-production-local-rehearsal-driver.test.mjs",
    "tests/iat-b3-production-local-rehearsal-plan.test.mjs",
  ],
  "all-feature-devnet-readiness": ["tests/iat-b3-all-feature-devnet-readiness.test.mjs"],
});
const EXACT_TEST_COUNTS = Object.freeze({
  "ci-manifest": 6,
  "economy-reproducible-build": 9,
  "native-wsl-hard-disable": 2,
  "local-rehearsal-readiness": 9,
  "production-transaction-builders": 11,
  "production-local-rehearsal": 29,
  "all-feature-devnet-readiness": 12,
});

function workflowFailures(workflow) {
  const failures = [];
  const normalized = workflow.replaceAll("\r\n", "\n");
  const npmCi = normalized.indexOf("      - run: npm ci\n");
  const playwright = normalized.indexOf("      - run: npx playwright install --with-deps chromium firefox webkit\n");
  let previous = npmCi;
  if (npmCi < 0 || playwright < 0 || npmCi >= playwright) {
    failures.push("mandatory gates must be between npm ci and Playwright installation");
  }
  for (const [name, gate] of REQUIRED_STEPS) {
    const exact = `      - name: ${name}\n        run: node scripts/run-iat-b3-mandatory-ci-gate.mjs ${gate}\n`;
    const position = normalized.indexOf(exact);
    if (position < 0) failures.push(`missing exact mandatory step ${gate}`);
    if (position <= previous || position >= playwright) failures.push(`mandatory step order drifted for ${gate}`);
    previous = position;
    const command = `node scripts/run-iat-b3-mandatory-ci-gate.mjs ${gate}`;
    if (normalized.split(command).length !== 2) failures.push(`mandatory command count drifted for ${gate}`);
  }
  const mandatoryRegion = normalized.slice(npmCi, playwright);
  if (/\n\s+(?:if|continue-on-error):/u.test(mandatoryRegion)
    || /--test-name-pattern|--test-only|--test-skip-pattern|\|\|\s*true|;\s*exit\s+0/u.test(mandatoryRegion)) {
    failures.push("mandatory gate region contains a conditional, skip selector, or fail-open fragment");
  }
  const setupNode = normalized.lastIndexOf("      - uses: actions/setup-node@", npmCi);
  const setupNodeBlock = setupNode >= 0 && npmCi > setupNode
    ? normalized.slice(setupNode, npmCi)
    : "";
  if (!/^\s*- uses: actions\/setup-node@[0-9a-f]{40}(?:\s+#.*)?$[\s\S]*?^\s+node-version:\s+24\s*$/mu
    .test(setupNodeBlock)) {
    failures.push("mandatory gates are not preceded by immutable setup-node on Node 24");
  }
  if (/continue-on-error:\s+true/u.test(normalized)) {
    failures.push("workflow contains continue-on-error");
  }
  const rustStep = normalized.indexOf("      - name: Test feature-gated runtime bridges\n");
  const rustStepEnd = rustStep < 0 ? -1 : normalized.indexOf("\n      - ", rustStep + 1);
  const rustBlock = rustStep < 0
    ? ""
    : normalized.slice(rustStep, rustStepEnd < 0 ? normalized.length : rustStepEnd);
  const observedRustEnvironment = [...rustBlock.matchAll(
    /^ {10}(IAT_B3_[A-Z0-9_]+): ([^\n]+)$/gmu,
  )].map((match) => [match[1], match[2]]);
  if (rustStep < 0
    || !rustBlock.includes("fixtures forbidden for production, deployment, Devnet, or Mainnet")
    || !rustBlock.includes(`        run: ${RUST_ALL_FEATURE_COMMAND}\n`)
    || JSON.stringify(observedRustEnvironment) !== JSON.stringify(RUST_ALL_FEATURE_ENVIRONMENT)) {
    failures.push("all-feature Rust gate lacks the exact four forbidden fixture bindings");
  }
  return failures;
}

function tap({ tests = 2, pass = tests, fail = 0, cancelled = 0, skipped = 0, todo = 0 } = {}) {
  const resultLines = Array.from({ length: tests }, (_, index) => {
    const ordinal = index + 1;
    if (ordinal <= fail) return `not ok ${ordinal} - failed`;
    if (ordinal <= fail + skipped) return `ok ${ordinal} - skipped # SKIP`;
    if (ordinal <= fail + skipped + todo) return `not ok ${ordinal} - todo # TODO`;
    return `ok ${ordinal} - passed`;
  });
  return [
    "TAP version 13",
    ...resultLines,
    `1..${tests}`,
    `# tests ${tests}`,
    "# suites 0",
    `# pass ${pass}`,
    `# fail ${fail}`,
    `# cancelled ${cancelled}`,
    `# skipped ${skipped}`,
    `# todo ${todo}`,
    "# duration_ms 1",
    "",
  ].join("\n");
}

test("workflow runs every exact Node 24 B3 gate mandatorily and in fail-closed order", () => {
  const workflow = readFileSync(WORKFLOW_PATH, "utf8");
  assert.deepEqual(workflowFailures(workflow), []);
  assert.deepEqual(Object.keys(IAT_B3_MANDATORY_CI_GATES), REQUIRED_STEPS.map(([, gate]) => gate));
  assert.deepEqual(IAT_B3_MANDATORY_CI_GATES, EXACT_GATE_FILES);
  assert.deepEqual(IAT_B3_MANDATORY_CI_EXPECTED_TEST_COUNTS, EXACT_TEST_COUNTS);
  const runnerSource = readFileSync(RUNNER_PATH, "utf8");
  assert.doesNotMatch(runnerSource, /--test-name-pattern|--test-only|--test-skip-pattern/u);
  assert.doesNotMatch(runnerSource, /\b(?:cargo|solana-test-validator|fetch|Connection|Keypair)\b/u);
  assert.match(runnerSource, /skipped !== 0/u);
  assert.match(runnerSource, /todo !== 0/u);
  assert.match(runnerSource, /pass !== tests/u);
  assert.match(runnerSource, /tests !== expectedTestCount/u);
  assert.match(runnerSource, /Number\(plans\[0\]\[1\]\) !== tests/u);
  assert.match(runnerSource, /FORBIDDEN_ENVIRONMENT/u);
  for (const gate of Object.keys(EXACT_GATE_FILES)) {
    assert.equal((runnerSource.match(new RegExp(`"${gate}":`, "gu")) ?? []).length, 2);
  }
});

test("workflow mutation probes reject removed, conditional, reordered, bypassed, or non-Node24 gates", () => {
  const workflow = readFileSync(WORKFLOW_PATH, "utf8").replaceAll("\r\n", "\n");
  const first = REQUIRED_STEPS[0];
  const second = REQUIRED_STEPS[1];
  const firstBlock = `      - name: ${first[0]}\n        run: node scripts/run-iat-b3-mandatory-ci-gate.mjs ${first[1]}\n`;
  const secondBlock = `      - name: ${second[0]}\n        run: node scripts/run-iat-b3-mandatory-ci-gate.mjs ${second[1]}\n`;
  const stepBlocks = REQUIRED_STEPS.map(([name, gate]) =>
    `      - name: ${name}\n        run: node scripts/run-iat-b3-mandatory-ci-gate.mjs ${gate}\n`);
  const rustEnvironmentLines = RUST_ALL_FEATURE_ENVIRONMENT.map(([name, value]) =>
    `          ${name}: ${value}\n`);
  const mutations = [
    ...stepBlocks.map((block) => workflow.replace(block, "")),
    ...stepBlocks.slice(0, -1).map((block, index) =>
      workflow.replace(block + stepBlocks[index + 1], stepBlocks[index + 1] + block)),
    workflow.replace(firstBlock, `${firstBlock}        continue-on-error: true\n`),
    workflow.replace(firstBlock, `${firstBlock}        if: false\n`),
    workflow.replace(firstBlock + secondBlock, secondBlock + firstBlock),
    workflow.replace(`node scripts/run-iat-b3-mandatory-ci-gate.mjs ${first[1]}`, "true"),
    workflow.replace("node-version: 24", "node-version: 22"),
    workflow.replace(
      `node scripts/run-iat-b3-mandatory-ci-gate.mjs ${second[1]}`,
      `node --test --test-name-pattern contract ${EXACT_GATE_FILES[second[1]][0]}`,
    ),
    ...rustEnvironmentLines.map((line) => workflow.replace(line, "")),
    ...rustEnvironmentLines.map((line, index) => workflow.replace(
      line,
      `          ${RUST_ALL_FEATURE_ENVIRONMENT[index][0]}: 11111111111111111111111111111111\n`,
    )),
    workflow.replace(RUST_ALL_FEATURE_COMMAND, "cargo test --workspace --all-targets --locked"),
  ];
  mutations.forEach((mutated, index) => {
    assert.notDeepEqual(workflowFailures(mutated), [], `mutation ${index} passed open`);
  });
});

test("TAP enforcement rejects every skip, todo, cancellation, failure, and partial pass", () => {
  assert.deepEqual(validateIatB3MandatoryCiTap(tap(), "fixture", 2), {
    gate: "fixture",
    tests: 2,
    pass: 2,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
  });
  for (const output of [
    tap({ pass: 1, fail: 1 }),
    tap({ pass: 1, skipped: 1 }),
    tap({ pass: 1, todo: 1 }),
    tap({ pass: 1, cancelled: 1 }),
    tap().replace("# pass 2", "# pass 1"),
    tap().replace("TAP version 13", "not TAP"),
    tap().replace("# skipped 0", "# skipped 0\nok 3 - hidden # SKIP"),
    tap().replace("1..2\n", ""),
    tap().replace("ok 2 - passed\n", ""),
    tap().replace("# todo 0\n", ""),
    tap().replace("ok 1 - passed\nok 2 - passed\n", ""),
  ]) assert.throws(() => validateIatB3MandatoryCiTap(output, "fixture", 2), /HOLD/u);
  assert.throws(() => validateIatB3MandatoryCiTap(tap(), "fixture", 3), /HOLD/u);
});

test("gate runner uses exact registered files and strips every test-injection environment", () => {
  let invocation = null;
  let standardOutput = "";
  let standardError = "";
  const result = runIatB3MandatoryCiGate("production-local-rehearsal", {
    environment: {
      PATH: "safe-path",
      SAFE_VALUE: "retained",
      NODE_OPTIONS: "--test-name-pattern=fake",
      NODE_TEST_CONTEXT: "child-v8",
      NODE_V8_COVERAGE: "coverage-output",
      IAT_B3_EXACT_SOURCE_HEAD_SHA: "1".repeat(40),
      IAT_B3_TEST_OVERRIDE: "true",
      TEST_ONLY_OVERRIDE: "true",
      MOCK_RECEIPT: "accepted",
      FIXTURE_STATUS: "READY",
      SKIP_VALIDATION: "true",
      FORCE_SUCCESS: "true",
    },
    runner(command, arguments_, options) {
      invocation = { command, arguments_, options };
      return { status: 0, signal: null, error: undefined, stdout: tap({ tests: 29 }), stderr: "" };
    },
    stdout: { write: (value) => { standardOutput += value; } },
    stderr: { write: (value) => { standardError += value; } },
  });
  assert.equal(result.pass, 29);
  assert.equal(invocation.command, process.execPath);
  assert.deepEqual(invocation.arguments_, [
    "--test",
    "--test-reporter=tap",
    ...EXACT_GATE_FILES["production-local-rehearsal"],
  ]);
  assert.equal(invocation.options.cwd, SITE_ROOT);
  assert.deepEqual(invocation.options.env, { PATH: "safe-path", SAFE_VALUE: "retained" });
  assert.equal(standardOutput, tap({ tests: 29 }));
  assert.equal(standardError, "");
  assert.throws(() => runIatB3MandatoryCiGate("unknown"), /UNKNOWN_HOLD/u);
  assert.equal(parseIatB3MandatoryCiGateArguments(["ci-manifest"]), "ci-manifest");
  for (const arguments_ of [
    [],
    ["unknown"],
    ["ci-manifest", "ci-manifest"],
    ["ci-manifest", "native-wsl-hard-disable"],
  ]) assert.throws(() => parseIatB3MandatoryCiGateArguments(arguments_), /EXACT_ARGUMENT_REQUIRED_HOLD/u);
});

test("nonzero, signalled, errored, omitted-test, and truncated child results cannot pass", () => {
  const quiet = { write() {} };
  const invoke = (result) => runIatB3MandatoryCiGate("ci-manifest", {
    runner: () => result,
    environment: { PATH: "safe" },
    stdout: quiet,
    stderr: quiet,
  });
  const complete = tap({ tests: 6 });
  for (const result of [
    { status: 1, signal: null, error: undefined, stdout: complete, stderr: "hidden failure" },
    { status: 0, signal: "SIGTERM", error: undefined, stdout: complete, stderr: "" },
    { status: 0, signal: null, error: new Error("child error"), stdout: complete, stderr: "" },
  ]) assert.throws(() => invoke(result), /PROCESS_HOLD/u);
  assert.throws(() => invoke({
    status: 0,
    signal: null,
    error: undefined,
    stdout: tap({ tests: 5 }),
    stderr: "",
  }), /INCOMPLETE_HOLD/u);
  assert.throws(() => invoke({
    status: 0,
    signal: null,
    error: undefined,
    stdout: complete.slice(0, complete.indexOf("# pass")),
    stderr: "",
  }), /SUMMARY_HOLD/u);
});

test("contract gates cannot be mistaken for artifact, RPC, Devnet, or Mainnet evidence", () => {
  const contract = readFileSync(
    resolve(SITE_ROOT, "scripts/lib/iat-b3-production-local-rehearsal-contract.mjs"),
    "utf8",
  );
  const plan = JSON.parse(readFileSync(
    resolve(SITE_ROOT, "docs/b3/iat-b3-production-local-rehearsal-plan.v1.json"),
    "utf8",
  ));
  const nativeHardDisable = readFileSync(
    resolve(SITE_ROOT, "tests/iat-b3-native-wsl-hard-disable-ci.test.mjs"),
    "utf8",
  );
  assert.match(contract, /!\["HOLD", "HOLD_TEST_EXECUTION_ONLY"\]\.includes\(receipt\.status\)/u);
  assert.match(contract, /receipt\.complete !== false/u);
  assert.match(contract, /receipt\.safety\.executionEvidenceAccepted !== false/u);
  assert.equal(plan.status, "HOLD");
  assert.equal(plan.scope.authorizesRpc, false);
  assert.equal(plan.scope.authorizesKeyRead, false);
  assert.equal(plan.scope.authorizesBuild, false);
  assert.equal(plan.scope.authorizesDeploy, false);
  assert.equal(plan.scope.authorizesSigning, false);
  assert.equal(plan.scope.authorizesSend, false);
  assert.equal(plan.truth.devnetExecuted, false);
  assert.equal(plan.truth.mainnetExecutionAuthorized, false);
  assert.doesNotMatch(nativeHardDisable, /\bskip\s*:|\.skip\s*\(|context\.skip/u);
});

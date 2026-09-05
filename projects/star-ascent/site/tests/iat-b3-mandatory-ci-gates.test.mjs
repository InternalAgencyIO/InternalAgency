import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

import {
  IAT_B3_MANDATORY_CI_EXPECTED_TEST_COUNTS,
  IAT_B3_MANDATORY_CI_GATES,
  IAT_B3_MANDATORY_CI_ORDERED_CASE_NAMES_SHA256,
  IAT_B3_MANDATORY_CI_PHASE_B_INTERFACE_SCHEMA,
  IAT_B3_MANDATORY_CI_PHASE_B_INTERFACE_SOURCES,
  IAT_B3_MANDATORY_CI_TEST_SOURCE_SHA256,
  createIatB3MandatoryCiHoldDiagnostic,
  evaluateIatB3MandatoryCiContainmentOracle,
  iatB3MandatoryCiOrderedCaseNamesSha256,
  parseIatB3MandatoryCiGateArguments,
  runIatB3MandatoryCiGateCanonical,
  runIatB3MandatoryCiGateInjected,
  sanitizeIatB3MandatoryCiEnvironment,
  validateIatB3MandatoryCiTap,
  validateIatB3MandatoryCiPhaseBInterfaceSources,
} from "../scripts/run-iat-b3-mandatory-ci-gate.mjs";

const SITE_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const REPOSITORY_ROOT = resolve(SITE_ROOT, "../../..");
const WORKFLOW_PATH = resolve(REPOSITORY_ROOT, ".github/workflows/iat-v2-proof.yml");
const RUNNER_PATH = resolve(SITE_ROOT, "scripts/run-iat-b3-mandatory-ci-gate.mjs");
const EXACT_TOP_LEVEL_WORKFLOW_LINES = Object.freeze([
  "name: IAT V2 release proof",
  "on:",
  "permissions:",
  "concurrency:",
  "jobs:",
]);
const EXACT_SITE_WORKING_DIRECTORY = "projects/star-ascent/site";
const EXACT_SITE_JOB_RUN_DEFAULTS = [
  "    defaults:",
  "      run:",
  `        working-directory: ${EXACT_SITE_WORKING_DIRECTORY}`,
].join("\n");
const EXACT_NON_WINDOWS_JOB_DEFAULT_ANCHORS = [
  [
    "  web-and-policy:",
    "    name: Web/policy checks (launch remains HOLD)",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 45",
    "    env:",
    "      IAT_V2_SOURCE_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}",
    EXACT_SITE_JOB_RUN_DEFAULTS,
    "    steps:",
  ].join("\n"),
  [
    "  rust-host:",
    "    name: Rust host tests",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 30",
    EXACT_SITE_JOB_RUN_DEFAULTS,
    "    steps:",
  ].join("\n"),
  [
    "  verifiable-sbf:",
    "    name: Verifiable Solana SBF build",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 90",
    EXACT_SITE_JOB_RUN_DEFAULTS,
    "    env:",
  ].join("\n"),
];
const EXACT_WINDOWS_LONG_PATHS_STEP = [
  "      - name: Enable repository long paths before checkout",
  "        shell: pwsh",
  "        run: git config --global core.longpaths true",
].join("\n");
const EXACT_WINDOWS_STRUCTURAL_STEP = [
  "      - name: Validate native containment structure (hosted smoke only; non-evidence)",
  "        run: node --test tests/iat-b3-mandatory-ci-containment.test.mjs",
  `        working-directory: ${EXACT_SITE_WORKING_DIRECTORY}`,
].join("\n");
const EXACT_WINDOWS_PREFLIGHT_STEP = [
  "      - name: Confirm native containment preflight HOLD (hosted smoke only; non-evidence)",
  "        shell: pwsh",
  "        run: |",
  "          $output = (& node scripts/build-iat-b3-mandatory-ci-containment.mjs 2>&1 | Out-String).Trim()",
  "          $status = $LASTEXITCODE",
  "          Write-Host $output",
  "          if ($status -ne 2) {",
  "            throw \"Expected containment preflight exit 2/HOLD, got $status\"",
  "          }",
  "          $value = $output | ConvertFrom-Json",
  "          if ($value.status -ne 'HOLD' -or $value.ready -ne $false -or",
  "              $value.complete -ne $false -or $value.buildAuthorized -ne $false -or",
  "              $value.buildExecuted -ne $false -or $value.outputRootTouched -ne $false -or",
  "              $value.blockers -notcontains 'PHASE_B_NATIVE_BUILD_HARD_DISABLED') {",
  "            throw 'containment preflight did not return the exact fail-closed HOLD projection'",
  "          }",
  "          exit 0",
  `        working-directory: ${EXACT_SITE_WORKING_DIRECTORY}`,
].join("\n");
const EXACT_NATIVE_WINDOWS_JOB = [
  "  native-containment-windows:",
  "    name: HOSTED_CROSS_PLATFORM_SMOKE_ONLY (non-evidence)",
  "    runs-on: windows-2025",
  "    timeout-minutes: 15",
  "    steps:",
  EXACT_WINDOWS_LONG_PATHS_STEP,
  "      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0",
  "        with:",
  "          fetch-depth: 0",
  "      - uses: actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0",
  "        with:",
  "          node-version: 24",
  EXACT_WINDOWS_STRUCTURAL_STEP,
  EXACT_WINDOWS_PREFLIGHT_STEP,
  "",
].join("\n");

const EXACT_GATE_FILES = Object.freeze({
  "native-process-containment": ["tests/iat-b3-mandatory-ci-containment.test.mjs"],
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
  "production-official-local-rehearsal": ["tests/iat-b3-production-official-local-rehearsal-evidence.test.mjs"],
  "all-feature-devnet-readiness": [
    "tests/iat-b3-all-feature-devnet-readiness.test.mjs",
    "tests/iat-b3-devnet-gate-split.test.mjs",
  ],
});

const EXACT_COUNTS = Object.freeze({
  "native-process-containment": 30,
  "ci-manifest": 14,
  "economy-reproducible-build": 9,
  "native-wsl-hard-disable": 2,
  "local-rehearsal-readiness": 9,
  "production-transaction-builders": 11,
  "production-local-rehearsal": 29,
  "production-official-local-rehearsal": 18,
  "all-feature-devnet-readiness": 25,
});

function tap(caseNames) {
  const count = caseNames.length;
  return [
    "TAP version 13",
    ...caseNames.flatMap((name, index) => [
      `# Subtest: ${name}`,
      `ok ${index + 1} - ${name}`,
    ]),
    `1..${count}`,
    `# tests ${count}`,
    "# suites 0",
    `# pass ${count}`,
    "# fail 0",
    "# cancelled 0",
    "# skipped 0",
    "# todo 0",
    "# duration_ms 1.25",
    "",
  ].join("\n");
}

function extractLiteralTestNames(sourcePath) {
  const source = readFileSync(resolve(SITE_ROOT, sourcePath), "utf8");
  return [...source.matchAll(/^\s*test\("((?:[^"\\]|\\.)+)"/gmu)]
    .map((match) => JSON.parse(`"${match[1]}"`));
}

function decodeExactWorkflowBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.at(-1) !== 0x0a) return null;
  for (const byte of bytes) {
    if (byte !== 0x0a && (byte < 0x20 || byte > 0x7e)) return null;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function topLevelWorkflowGrammarIsExact(workflowText) {
  const observed = workflowText
    .split("\n")
    .filter((line) => line.length > 0 && line.charCodeAt(0) !== 0x20);
  return observed.length === EXACT_TOP_LEVEL_WORKFLOW_LINES.length
    && observed.every((line, index) => line === EXACT_TOP_LEVEL_WORKFLOW_LINES[index]);
}

function nativeWindowsJob(workflow) {
  const start = workflow.indexOf("  native-containment-windows:\n");
  const end = workflow.indexOf("\n  rust-host:\n", start);
  return start >= 0 && end > start ? workflow.slice(start, end) : "";
}

function windowsHostedSmokeIsExact(workflowInput) {
  const workflow = decodeExactWorkflowBytes(workflowInput);
  if (workflow === null) return false;
  const topLevelDefaultsCount = (
    workflow.match(/^(?:defaults|["']defaults["'])\s*:/gmu) ?? []
  ).length;
  const jobDefaultsCount = (workflow.match(/^    defaults\s*:/gmu) ?? []).length;
  const exactSiteJobDefaultsCount = workflow.split(EXACT_SITE_JOB_RUN_DEFAULTS).length - 1;
  const workingDirectoryLines = workflow
    .split("\n")
    .filter((line) => /^\s+working-directory\s*:/u.test(line));
  return topLevelWorkflowGrammarIsExact(workflow)
    && nativeWindowsJob(workflow) === EXACT_NATIVE_WINDOWS_JOB
    && (workflow.match(/^  native-containment-windows:$/gmu) ?? []).length === 1
    && topLevelDefaultsCount === 0
    && jobDefaultsCount === 3
    && exactSiteJobDefaultsCount === 3
    && EXACT_NON_WINDOWS_JOB_DEFAULT_ANCHORS.every((anchor) => workflow.includes(anchor))
    && workingDirectoryLines.length === 5
    && workingDirectoryLines.every(
      (line) => line === `        working-directory: ${EXACT_SITE_WORKING_DIRECTORY}`,
    );
}

function passingOracle(overrides = {}) {
  return {
    helperIdentityValid: true,
    helperSpawnFailed: false,
    helperAbnormalTermination: false,
    protocolValid: true,
    containmentSetupProven: true,
    workloadResumed: true,
    workloadSpawnFailed: false,
    startupDeadlineExpired: false,
    executionDeadlineExpired: false,
    outputLimitExceeded: false,
    rootTerminalObserved: true,
    rootExitCode: 0,
    rootSignal: null,
    tapValid: true,
    stderrEmpty: true,
    descendantLeakObserved: false,
    zombieDescendantCount: 0,
    absenceProofObserved: true,
    finalizationDeadlineExpired: false,
    forcedTeardownTimeout: false,
    outerDeadlineExpired: false,
    interventionUsed: false,
    streamsClosed: true,
    ...overrides,
  };
}

test("mandatory manifest retains exact files and fixed counts", () => {
  assert.deepEqual(IAT_B3_MANDATORY_CI_GATES, EXACT_GATE_FILES);
  assert.deepEqual(IAT_B3_MANDATORY_CI_EXPECTED_TEST_COUNTS, EXACT_COUNTS);
  assert.deepEqual(Object.keys(IAT_B3_MANDATORY_CI_ORDERED_CASE_NAMES_SHA256), Object.keys(EXACT_GATE_FILES));
  assert.deepEqual(
    Object.keys(IAT_B3_MANDATORY_CI_TEST_SOURCE_SHA256).sort(),
    [...new Set(Object.values(EXACT_GATE_FILES).flat())].sort(),
  );
  for (const digest of [
    ...Object.values(IAT_B3_MANDATORY_CI_ORDERED_CASE_NAMES_SHA256),
    ...Object.values(IAT_B3_MANDATORY_CI_TEST_SOURCE_SHA256),
  ]) assert.match(digest, /^[0-9a-f]{64}$/u);
  for (const [gate, sourcePaths] of Object.entries(EXACT_GATE_FILES)) {
    const caseNames = sourcePaths.flatMap(extractLiteralTestNames);
    assert.equal(caseNames.length, EXACT_COUNTS[gate], gate);
    assert.equal(
      iatB3MandatoryCiOrderedCaseNamesSha256(caseNames),
      IAT_B3_MANDATORY_CI_ORDERED_CASE_NAMES_SHA256[gate],
      `${gate}:ordered-case-names`,
    );
    for (const sourcePath of sourcePaths) {
      const bytes = readFileSync(resolve(SITE_ROOT, sourcePath));
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        IAT_B3_MANDATORY_CI_TEST_SOURCE_SHA256[sourcePath],
        sourcePath,
      );
    }
  }
  assert.equal(parseIatB3MandatoryCiGateArguments(["ci-manifest"]), "ci-manifest");
  for (const arguments_ of [[], ["unknown"], ["ci-manifest", "ci-manifest"]]) {
    assert.throws(() => parseIatB3MandatoryCiGateArguments(arguments_), /EXACT_ARGUMENT_REQUIRED_HOLD/u);
  }
});

test("workflow validates structure before expected HOLD and labels hosted smoke as non-evidence", () => {
  const workflowBytes = readFileSync(WORKFLOW_PATH);
  const workflow = decodeExactWorkflowBytes(workflowBytes);
  assert.notEqual(workflow, null);
  const structural = "run: node --test tests/iat-b3-mandatory-ci-containment.test.mjs";
  const preflight = "node scripts/build-iat-b3-mandatory-ci-containment.mjs";
  assert.equal(workflow.split(structural).length - 1, 2);
  assert.equal(workflow.split(preflight).length - 1, 2);
  assert(workflow.indexOf(structural) < workflow.indexOf(preflight));
  assert.equal(windowsHostedSmokeIsExact(workflowBytes), true);
  assert.doesNotMatch(workflow, /setup-zig|ziglang|choco install zig|winget install zig/iu);
  assert.doesNotMatch(workflow, /run-iat-b3-mandatory-ci-gate\.mjs native-process-containment/u);
});

test("workflow mutation probes reject missing order, smoke label, and fail-open fragments", () => {
  const workflowBytes = readFileSync(WORKFLOW_PATH);
  const workflow = decodeExactWorkflowBytes(workflowBytes);
  assert.notEqual(workflow, null);
  const workingDirectory = `        working-directory: ${EXACT_SITE_WORKING_DIRECTORY}`;
  const structural = EXACT_WINDOWS_STRUCTURAL_STEP;
  const preflight = EXACT_WINDOWS_PREFLIGHT_STEP;
  const topLevelDefaults = [
    "defaults:",
    "  run:",
    `    working-directory: ${EXACT_SITE_WORKING_DIRECTORY}`,
  ].join("\n");
  const semanticMutations = [
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(structural, "")),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(`${structural}\n${preflight}`, `${preflight}\n${structural}`)),
    workflow.replace("HOSTED_CROSS_PLATFORM_SMOKE_ONLY (non-evidence)", "Native release evidence"),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, `${EXACT_NATIVE_WINDOWS_JOB}\n        continue-on-error: true`),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace("    steps:\n", "    if: false\n    steps:\n")),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace("    steps:\n", "    env:\n      NODE_OPTIONS: attacker\n    steps:\n")),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace("    steps:\n", "    defaults:\n      run:\n        shell: cmd\n    steps:\n")),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace("    steps:\n", `    defaults:\n      run:\n        working-directory: ${EXACT_SITE_WORKING_DIRECTORY}\n    steps:\n`)),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(`${preflight}`, `${preflight}\n        shell: cmd`)),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(`${preflight}`, `${preflight}\n        working-directory: .`)),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(
      "          $status = $LASTEXITCODE",
      "          $status = 2",
    )),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(
      "          exit 0\n",
      "",
    )),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(
      "          $value = $output | ConvertFrom-Json",
      "          exit 0\n          $value = $output | ConvertFrom-Json",
    )),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(
      "          if ($status -ne 2) {",
      "          if ($status -ne 0) {",
    )),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(
      "              $value.blockers -notcontains 'PHASE_B_NATIVE_BUILD_HARD_DISABLED') {",
      "              $false) {",
    )),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(`${workingDirectory}\n`, "")),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(
      `${workingDirectory}\n`,
      "        working-directory: projects/star-ascent/other\n",
    )),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(
      `${workingDirectory}\n`,
      `${workingDirectory}\n${workingDirectory}\n`,
    )),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(
      `${workingDirectory}\n`,
      "        working-directory: Projects/star-ascent/site\n",
    )),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(
      `${workingDirectory}\n`,
      "        working-directory: projects\\star-ascent\\site\n",
    )),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(
      `${workingDirectory}\n`,
      "        working-directory: .\n",
    )),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(
      `${workingDirectory}\n`,
      "        working-directory: ${{ github.workspace }}/projects/star-ascent/site\n",
    )),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(
      "          fetch-depth: 0\n",
      "          fetch-depth: 0\n          path: projects/star-ascent/site\n",
    )),
    workflow.replace(EXACT_NATIVE_WINDOWS_JOB, EXACT_NATIVE_WINDOWS_JOB.replace(
      "          fetch-depth: 0\n",
      `          fetch-depth: 0\n        working-directory: ${EXACT_SITE_WORKING_DIRECTORY}\n`,
    )),
    workflow.replace("\njobs:\n", `\n${topLevelDefaults}\n\njobs:\n`),
    workflow.replace(
      "\njobs:\n",
      `\ndefaults: { run: { working-directory: ${EXACT_SITE_WORKING_DIRECTORY} } }\n\njobs:\n`,
    ),
    workflow.replace(
      "\njobs:\n",
      `\n${topLevelDefaults}\ndefaults: { run: { shell: cmd } }\n\njobs:\n`,
    ),
    workflow.replace(
      EXACT_NON_WINDOWS_JOB_DEFAULT_ANCHORS[0],
      EXACT_NON_WINDOWS_JOB_DEFAULT_ANCHORS[0].replace(`${EXACT_SITE_JOB_RUN_DEFAULTS}\n`, ""),
    ),
    workflow.replace(
      EXACT_NON_WINDOWS_JOB_DEFAULT_ANCHORS[1],
      EXACT_NON_WINDOWS_JOB_DEFAULT_ANCHORS[1].replace(
        EXACT_SITE_WORKING_DIRECTORY,
        "projects/star-ascent/other",
      ),
    ),
    workflow.replace("      - run: npm ci\n", "      - run: npm ci\n        working-directory: .\n"),
    workflow.replace("\npermissions:\n", "\nenv:\n  NODE_OPTIONS: attacker\n\npermissions:\n"),
    workflow.replace("\npermissions:\n", "\nenv: { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    workflow.replace("\npermissions:\n", "\n'env':\n  NODE_OPTIONS: attacker\n\npermissions:\n"),
    workflow.replace("\npermissions:\n", "\n'env': { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    workflow.replace("\npermissions:\n", "\n\"env\":\n  NODE_OPTIONS: attacker\n\npermissions:\n"),
    workflow.replace("\npermissions:\n", "\n\"env\": { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    workflow.replace("\npermissions:\n", "\n? env\n: { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    workflow.replace("\npermissions:\n", "\n? \"env\"\n: { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    workflow.replace("\npermissions:\n", "\n\"\\u0065nv\": { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    workflow.replace("\npermissions:\n", "\n!!str env: { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    workflow.replace("\npermissions:\n", "\nenv: &hostile { NODE_OPTIONS: attacker }\n\npermissions:\n"),
    workflow.replace("\npermissions:\n", "\nx-env: &hostile { NODE_OPTIONS: attacker }\nenv: *hostile\n\npermissions:\n"),
    workflow.replace("\npermissions:\n", "\nx-template: &hostile { env: { NODE_OPTIONS: attacker } }\n<<: *hostile\n\npermissions:\n"),
    workflow.replace("\npermissions:\n", "\nunexpected: true\n\npermissions:\n"),
    workflow.replace("\n  rust-host:\n", `\n${EXACT_NATIVE_WINDOWS_JOB}\n\n  rust-host:\n`),
  ];
  for (const mutated of semanticMutations) {
    assert.notEqual(mutated, workflow, "mutation fixture must alter the workflow");
    assert.equal(windowsHostedSmokeIsExact(Buffer.from(mutated, "utf8")), false);
  }
  const rawMutations = [
    Buffer.from(workflow.replaceAll("\n", "\r\n"), "ascii"),
    Buffer.from(workflow.replace("\n", "\r"), "ascii"),
    Buffer.from(workflow.replace("  push:", "\tpush:"), "ascii"),
    Buffer.concat([Buffer.from([0x00]), workflowBytes]),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), workflowBytes]),
    workflowBytes.subarray(0, -1),
    ...[
      "\u00a0",
      "\u1680",
      "\u2000",
      "\u2003",
      "\u2028",
      "\u2029",
      "\u202f",
      "\u205f",
      "\u3000",
      "\ufeff",
    ].map((prefix) => Buffer.from(
      `${prefix}env: { NODE_OPTIONS: attacker }\n${workflow}`,
      "utf8",
    )),
  ];
  assert.equal(rawMutations.length, 16);
  for (const mutated of rawMutations) {
    assert.equal(mutated.equals(workflowBytes), false, "raw mutation fixture must alter bytes");
    assert.equal(windowsHostedSmokeIsExact(mutated), false);
  }
});

test("strict TAP accepts one exact EOF-bound complete stream", () => {
  const names = ["case 1", "case 2", "case 3"];
  assert.deepEqual(validateIatB3MandatoryCiTap(tap(names), "fixture", 3, names), {
    gate: "fixture", tests: 3, pass: 3, fail: 0, cancelled: 0,
    skipped: 0, todo: 0, exactEofObserved: true, bailoutObserved: false,
    orderedCaseNamesSha256: iatB3MandatoryCiOrderedCaseNamesSha256(names),
  });
});

test("strict TAP rejects bailout, trailing junk, plan, duration, summary, and result drift", () => {
  const names = ["case 1", "case 2"];
  const valid = tap(names);
  for (const mutated of [
    `${valid}Bail out! late\n`,
    valid.replace("# duration_ms 1.25\n", "# duration_ms 1.25\ntrailing\n"),
    valid.replace("1..2\n", "1..2\n1..2\n"),
    valid.replace("# duration_ms 1.25", "# duration_ms NaN"),
    valid.replace("# pass 2", "# pass 1"),
    valid.replace("ok 2 - case 2", "not ok 2 - case 2"),
    valid.replace("# Subtest: case 2", "# Subtest: substituted case"),
    valid.replace("ok 2 - case 2", "ok 2 - substituted case"),
    valid.replace("ok 1 - case 1\n# Subtest: case 2", "# Subtest: case 2\nok 1 - case 1"),
    valid.replace("# skipped 0", "# skipped 1"),
    valid.slice(0, -1),
  ]) assert.throws(() => validateIatB3MandatoryCiTap(mutated, "fixture", 2, names), /HOLD/u);
});

test("environment scrub removes every evidence and test injection namespace", () => {
  assert.deepEqual(sanitizeIatB3MandatoryCiEnvironment({
    PATH: "safe", SAFE: "yes", NODE_OPTIONS: "bad", NODE_TEST_CONTEXT: "bad",
    IAT_B3_OVERRIDE: "bad", TEST_X: "bad", MOCK_X: "bad", FIXTURE_X: "bad",
    SKIP_X: "bad", FORCE_X: "bad",
  }), { PATH: "safe", SAFE: "yes" });
});

test("injected runner callbacks are never invoked and remain all-false HOLD", () => {
  let calls = 0;
  const report = runIatB3MandatoryCiGateInjected("native-process-containment", {
    runner() {
      calls += 1;
      return { status: 0, signal: null, stdout: "PASS", stderr: "" };
    },
    ready: true,
    complete: true,
    runtimeEvidenceObserved: true,
  });
  assert.equal(calls, 0);
  assert.equal(report.status, "HOLD");
  assert.equal(report.exitCode, 2);
  assert.equal(report.ready, false);
  assert.equal(report.complete, false);
  assert.equal(report.valid, false);
  assert.equal(report.runnerInvoked, false);
  assert.equal(report.processStarted, false);
  assert.equal(report.executionProvenanceObserved, false);
  assert.equal(report.runtimeEvidenceObserved, false);
  assert.equal(report.callerInputAccepted, false);
  assert(report.blockers.includes("CALLER_INJECTED_RUNNER_FORBIDDEN_HOLD"));
});

test("HOLD diagnostics bind bounded stream edges without becoming evidence", () => {
  const diagnostic = createIatB3MandatoryCiHoldDiagnostic({
    gate: "ci-manifest",
    reason: "CALLER_INJECTION_REJECTED",
    stdout: "x".repeat(5_000),
    stderr: "bad",
  });
  assert.equal(diagnostic.status, "HOLD");
  assert.equal(diagnostic.exitCode, 2);
  assert.equal(diagnostic.reason, "CALLER_INJECTION_REJECTED");
  assert.equal(diagnostic.ready, false);
  assert.equal(diagnostic.complete, false);
  assert.equal(diagnostic.runtimeEvidenceObserved, false);
  assert.equal(diagnostic.stdout.rawBytesObserved, 5_000);
  assert.equal(diagnostic.stdout.truncated, true);
  assert.match(diagnostic.stdout.rawSha256, /^[0-9a-f]{64}$/u);
  assert.equal(Buffer.from(diagnostic.stdout.prefixBase64, "base64").length, 2_048);
  assert.equal(Buffer.from(diagnostic.stdout.tailBase64, "base64").length, 2_048);
});

test("Phase-A exported oracle cannot admit caller-derived clean completion", () => {
  const result = evaluateIatB3MandatoryCiContainmentOracle(passingOracle());
  assert.equal(result.status, "HOLD_TEST");
  assert.equal(result.exitCode, 2);
  assert.equal(result.reason, "PHASE_A_EXPORTED_ORACLE_NON_EVIDENCE");
  assert.equal(result.observedReason, "STRUCTURAL_PASS_NOT_EVIDENCE");
  assert.equal(result.ready, false);
  assert.equal(result.complete, false);
  assert.equal(result.executionProvenanceObserved, false);
});

test("K69 forced teardown and outer deadline override cached pass", () => {
  assert.equal(evaluateIatB3MandatoryCiContainmentOracle(passingOracle({ forcedTeardownTimeout: true })).observedReason, "FORCED_TEARDOWN_TIMEOUT");
  assert.equal(evaluateIatB3MandatoryCiContainmentOracle(passingOracle({ outerDeadlineExpired: true })).observedReason, "OUTER_DEADLINE");
  assert.equal(evaluateIatB3MandatoryCiContainmentOracle(passingOracle({ protocolValid: false })).observedReason, "PROTOCOL_CORRUPTION");
});

test("K69 identity, helper, setup, and workload failures remain distinct", () => {
  const cases = [
    ["helperIdentityValid", false, "HELPER_IDENTITY_UNPROVEN"],
    ["helperSpawnFailed", true, "HELPER_SPAWN_FAILED"],
    ["helperAbnormalTermination", true, "HELPER_ABNORMAL_TERMINATION"],
    ["containmentSetupProven", false, "CONTAINMENT_SETUP_UNPROVEN"],
    ["startupDeadlineExpired", true, "STARTUP_TIMEOUT"],
    ["workloadSpawnFailed", true, "WORKLOAD_SPAWN_FAILED"],
    ["workloadResumed", false, "WORKLOAD_NOT_RESUMED"],
  ];
  for (const [key, value, reason] of cases) {
    const result = evaluateIatB3MandatoryCiContainmentOracle(passingOracle({ [key]: value }));
    assert.equal(result.status, "HOLD_TEST");
    assert.equal(result.exitCode, 2);
    assert.equal(result.observedReason, reason);
  }
});

test("K69 timeout, output, terminal, TAP, leak, absence, and kill remain HOLD", () => {
  const cases = [
    [{ outputLimitExceeded: true }, "OUTPUT_LIMIT"],
    [{ executionDeadlineExpired: true }, "TIMEOUT"],
    [{ rootSignal: "SIGABRT" }, "SIGNAL"],
    [{ rootExitCode: 9 }, "NONZERO"],
    [{ streamsClosed: false }, "FINALIZATION_TIMEOUT"],
    [{ tapValid: false }, "INCOMPLETE_TAP"],
    [{ stderrEmpty: false }, "STDERR_NOT_EMPTY"],
    [{ descendantLeakObserved: true }, "DESCENDANT_LEAK"],
    [{ zombieDescendantCount: 1 }, "DESCENDANT_LEAK"],
    [{ absenceProofObserved: false }, "ABSENCE_UNPROVEN"],
    [{ interventionUsed: true }, "KILL_ASSISTED_PASS_FORBIDDEN"],
  ];
  for (const [mutation, reason] of cases) {
    const result = evaluateIatB3MandatoryCiContainmentOracle(passingOracle(mutation));
    assert.equal(result.status, "HOLD_TEST");
    assert.equal(result.exitCode, 2);
    assert.equal(result.reason, "PHASE_A_EXPORTED_ORACLE_NON_EVIDENCE");
    assert.equal(result.observedReason, reason);
  }
});

test("canonical orchestrator consumes frozen interfaces and remains machine HOLD", async () => {
  const interfaces = validateIatB3MandatoryCiPhaseBInterfaceSources();
  assert.equal(interfaces.schema, IAT_B3_MANDATORY_CI_PHASE_B_INTERFACE_SCHEMA);
  assert.equal(interfaces.status, "STATIC_SOURCE_BOUND_HOLD");
  assert.equal(interfaces.runtimeEvidenceObserved, false);
  assert.equal(interfaces.sources.length, 4);
  assert.deepEqual(
    interfaces.sources.map((source) => source.label),
    Object.keys(IAT_B3_MANDATORY_CI_PHASE_B_INTERFACE_SOURCES),
  );
  const report = await runIatB3MandatoryCiGateCanonical("ci-manifest");
  assert.equal(report.status, "HOLD");
  assert.equal(report.exitCode, 2);
  assert.equal(report.ready, false);
  assert.equal(report.complete, false);
  assert.equal(report.valid, false);
  assert.equal(report.processStarted, false);
  assert.equal(report.nativeHelperExecuted, false);
  assert.equal(report.runtimeReceiptAssessment.runtimeEvidenceObserved, false);
  assert.equal(report.publicBuildInputAuthorized, false);
  assert.equal(report.automaticRetryAuthorized, false);
  assert.equal(report.releaseAuthorized, false);
  assert(report.blockers.includes("SOURCE_BOUND_LIVE_RUNTIME_RECEIPT_UNAVAILABLE"));
});

test("shipped runner exposes no process callback, helper, retry, or legacy cleanup path", () => {
  const source = readFileSync(RUNNER_PATH, "utf8");
  for (const forbidden of [
    "node:child_process", "spawnSync", "execFile", "runner(process.execPath",
    "unshare", "process.kill(", "killpg", "taskkill", "Stop-Process", "WMIC",
    "automaticRetryAuthorized: true", "runtimeEvidenceObserved: true",
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
  assert.match(source, /SOURCE_BOUND_LIVE_RUNTIME_RECEIPT_UNAVAILABLE/u);
  assert.match(source, /B27_NO_EXECUTION_API/u);
  assert.match(source, /status:\s*"HOLD"/u);
  assert.match(source, /exitCode:\s*2/u);
});

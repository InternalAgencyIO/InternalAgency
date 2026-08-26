#!/usr/bin/env node

import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  IAT_B3_NATIVE_CONTAINMENT_RECEIPT_SCHEMA,
  IAT_B3_NATIVE_CONTAINMENT_TIMING,
  assessNativeContainmentPreflight,
  observeNativeContainmentAuthoritySource,
  observeNativeContainmentBuildContractClosure,
  observeNativeContainmentSourceClosure,
  parseJsonRejectingDuplicateKeys,
  sha256,
} from "./lib/iat-b3-mandatory-ci-containment-contract.mjs";
import {
  IAT_B3_NATIVE_RUNTIME_CONTAINMENT_ASSESSMENT_SCHEMA,
  IAT_B3_NATIVE_RUNTIME_CONTAINMENT_RECEIPT_SCHEMA,
  assessNativeRuntimeContainmentReceipt,
  createNativeRuntimeContainmentReceiptHold,
} from "./lib/iat-b3-mandatory-ci-runtime-containment-receipt.mjs";
import {
  IAT_B3_KEY_FREE_ASSESSMENT_SCHEMA,
  IAT_B3_KEY_FREE_PURPOSE,
} from "./lib/iat-b3-key-free-public-build-input.mjs";

export const IAT_B3_MANDATORY_CI_GATE_SCHEMA = "iat-b3-mandatory-ci-gates/v4";
export const IAT_B3_MANDATORY_CI_PROCESS_DIAGNOSTIC_SCHEMA =
  "iat-b3-mandatory-ci-process-diagnostic/v3";
export const IAT_B3_MANDATORY_CI_ORACLE_SCHEMA =
  "iat-b3-mandatory-ci-containment-oracle/v1";
export const IAT_B3_MANDATORY_CI_PHASE_B_INTERFACE_SCHEMA =
  "iat-b3-mandatory-ci-phase-b-interface-binding/v1";

export const IAT_B3_MANDATORY_CI_GATES = Object.freeze({
  "native-process-containment": Object.freeze([
    "tests/iat-b3-mandatory-ci-containment.test.mjs",
  ]),
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

export const IAT_B3_MANDATORY_CI_ORDERED_CASE_NAMES_SHA256 = Object.freeze({
  "native-process-containment": "7262d1251645ce869697b6afc6aa446951c3f72184b14a772a4fa2553c846e33",
  "ci-manifest": "f2506776435fced0ce7afd60efbd9c7dd5511001257f6b350f089156e52dbf86",
  "economy-reproducible-build": "40ca34fe7cda9ccb4b0f3e5fc0db5a0aa3a01701380492c942ba86213a80912e",
  "native-wsl-hard-disable": "16da3e68860b90dbf4202bdbbc63d1bff56aad90055b2b09f8912a42af75932d",
  "local-rehearsal-readiness": "f3d38df2137b4788b67d72b595da27539b866ffc3cc10a56098023df6b6116b8",
  "production-transaction-builders": "e4d434d6214a04a7223bd65ca0544c58a5b404ba6e4e95b620125b13e9a3e5fb",
  "production-local-rehearsal": "5f92c987da090a9929a4fd6ce8513d2e3094bc3ea8b4123a517b869dadf71545",
  "production-official-local-rehearsal": "67edfd4b90c5a49e23fc1d3bd3e4837b3dc321564bd98574720dfb2592ad32c5",
  "all-feature-devnet-readiness": "7435456e96cff2f45a796c27f9cc41fada4155276fb29dfff6747b5652a7af20",
});

export const IAT_B3_MANDATORY_CI_TEST_SOURCE_SHA256 = Object.freeze({
  "tests/iat-b3-mandatory-ci-containment.test.mjs": "437571821a14eb60de550bac204b2f8e3885766760a30f32296db57076df2813",
  "tests/iat-b3-mandatory-ci-gates.test.mjs": "928c1f2ad00f06ea01f1163274a173abd61f5abeceafd01ee9a9fecc8206a857",
  "tests/iat-b3-economy-reproducible-build.test.mjs": "d828b230480c4748b77d499e6e063098fe7c63b08d17945572fed46360d1980d",
  "tests/iat-b3-native-wsl-hard-disable-ci.test.mjs": "a008f18fcf9661a59517bbefc6b9745bec5e6c9a7d39cdc9891ff6653456f943",
  "tests/iat-b3-local-rehearsal-readiness.test.mjs": "a7d524acc4db736ff3fbf2ff4ad94bea31a076a6f24693203f074988fa96f0b3",
  "tests/iat-b3-production-transaction-builders.test.mjs": "81bdc5bdf130b7a6a3b2ec027cac8f15234591c67b902891620f238aeb86167d",
  "tests/iat-b3-production-loopback-adapter.test.mjs": "43762c00a6df1f4dc6376579885690991909881eefc93a0bc5ed803ce1604298",
  "tests/iat-b3-production-local-rehearsal-driver.test.mjs": "227efd4b045f4f7cb97cc43a3133919df4d82ee9b5aa3e7bb22722b7c8607511",
  "tests/iat-b3-production-local-rehearsal-plan.test.mjs": "c42ffbbb4031eee7132afe45af673133158b4605ae727a270bb9b1bddfa41afb",
  "tests/iat-b3-production-official-local-rehearsal-evidence.test.mjs": "c4a8368251a5161eed5ba122ab43795be47d26e118cb4bdd991174134f925a74",
  "tests/iat-b3-all-feature-devnet-readiness.test.mjs": "484d157718601c745aefd8a314070be4eb51a2c7fd4c419d27fb3e812507ebc7",
  "tests/iat-b3-devnet-gate-split.test.mjs": "e77b882e5c4bd571e4ad35192d386832f11ad630b730c8ddc129c0aa58693474",
});

export const IAT_B3_MANDATORY_CI_PHASE_B_INTERFACE_SOURCES = Object.freeze({
  "bp06-native-build-contract": Object.freeze({
    path: "scripts/lib/iat-b3-mandatory-ci-containment-contract.mjs",
    sha256: "d82c931bca9907ec79df3610c3bfc210a68deb0213792302febf10afe859714d",
    byteLength: 100_777,
  }),
  "bp07-runtime-receipt-contract": Object.freeze({
    path: "scripts/lib/iat-b3-mandatory-ci-runtime-containment-receipt.mjs",
    sha256: "a5f91e07b7eee8e6fff23bf051c8eeb1882fd1ea6d3aca81f513d4cd6ba65f11",
    byteLength: 45_425,
  }),
  "bp07-runtime-receipt-schema": Object.freeze({
    path: "docs/b3/iat-b3-mandatory-ci-runtime-containment-receipt.schema.v1.json",
    sha256: "2924d2b01291497dc4523b70ce6dfab1aacaed5f9a1b02c235c90b9893269276",
    byteLength: 7_545,
  }),
  "k44-key-free-public-input": Object.freeze({
    path: "scripts/lib/iat-b3-key-free-public-build-input.mjs",
    sha256: "296ba945f1842e9e0ede0158c38da3997061b465a51a4a67578216e40a2c80d0",
    byteLength: 23_017,
  }),
});

export const IAT_B3_MANDATORY_CI_GATE_DEADLINES_MS = Object.freeze(
  Object.fromEntries(Object.keys(IAT_B3_MANDATORY_CI_GATES).map((gate) => [
    gate,
    gate === "all-feature-devnet-readiness"
      ? IAT_B3_NATIVE_CONTAINMENT_TIMING.allFeatureExecutionMs
      : IAT_B3_NATIVE_CONTAINMENT_TIMING.executionMs,
  ])),
);

const SITE_ROOT = resolve(fileURLToPath(new URL("../", import.meta.url)));
const REPOSITORY_ROOT = resolve(SITE_ROOT, "../../..");
const NATIVE_TOOLCHAIN_POLICY_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-mandatory-ci-containment-toolchains.v1.json",
);
const FORBIDDEN_ENVIRONMENT = /^(?:IAT_B3_|NODE_(?:OPTIONS|TEST_CONTEXT|V8_COVERAGE)$|TEST_|MOCK_|FIXTURE_|SKIP_|FORCE_)/u;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function summaryLine(lines, offset, label, expected) {
  const exact = `# ${label} ${expected}`;
  if (lines[offset] !== exact) fail(`IAT_B3_MANDATORY_CI_GATE_${label.toUpperCase()}_SUMMARY_HOLD`);
}

export function iatB3MandatoryCiOrderedCaseNamesSha256(caseNames) {
  if (!Array.isArray(caseNames) || caseNames.length < 1
    || caseNames.some((name) => typeof name !== "string" || name.length < 1
      || name.includes("\n") || name.includes("\r"))) {
    fail("IAT_B3_MANDATORY_CI_CASE_IDENTITY_INPUT_HOLD");
  }
  return createHash("sha256").update(JSON.stringify(caseNames)).digest("hex");
}

export function validateIatB3MandatoryCiTestSourceIdentity(gate) {
  if (!Object.hasOwn(IAT_B3_MANDATORY_CI_GATES, gate)) {
    fail("IAT_B3_MANDATORY_CI_GATE_UNKNOWN_HOLD");
  }
  const observations = IAT_B3_MANDATORY_CI_GATES[gate].map((sourcePath) => {
    const expectedSha256 = IAT_B3_MANDATORY_CI_TEST_SOURCE_SHA256[sourcePath];
    if (!/^[0-9a-f]{64}$/u.test(expectedSha256 ?? "")) {
      fail("IAT_B3_MANDATORY_CI_TEST_SOURCE_POLICY_HOLD");
    }
    const absolutePath = resolve(SITE_ROOT, sourcePath);
    const stat = lstatSync(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1
      || resolve(realpathSync(absolutePath)) !== absolutePath) {
      fail("IAT_B3_MANDATORY_CI_TEST_SOURCE_FILE_IDENTITY_HOLD");
    }
    const bytes = readFileSync(absolutePath);
    const observedSha256 = createHash("sha256").update(bytes).digest("hex");
    if (observedSha256 !== expectedSha256) {
      fail("IAT_B3_MANDATORY_CI_TEST_SOURCE_SHA256_HOLD");
    }
    return Object.freeze({ sourcePath, sha256: observedSha256, byteLength: bytes.length });
  });
  return Object.freeze(observations);
}

function observeExactInterfaceSource(label, expected) {
  if (!expected || typeof expected !== "object" || Array.isArray(expected)
    || Object.keys(expected).sort().join("\0")
      !== ["byteLength", "path", "sha256"].sort().join("\0")
    || typeof expected.path !== "string"
    || !/^[0-9a-f]{64}$/u.test(expected.sha256)
    || !Number.isSafeInteger(expected.byteLength) || expected.byteLength < 1) {
    fail("IAT_B3_MANDATORY_CI_PHASE_B_INTERFACE_POLICY_HOLD");
  }
  const absolutePath = resolve(SITE_ROOT, expected.path);
  const before = lstatSync(absolutePath);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1
    || resolve(realpathSync(absolutePath)) !== absolutePath) {
    fail("IAT_B3_MANDATORY_CI_PHASE_B_INTERFACE_IDENTITY_HOLD");
  }
  const bytes = readFileSync(absolutePath);
  const after = lstatSync(absolutePath);
  const observedSha256 = sha256(bytes);
  if (before.dev !== after.dev || before.ino !== after.ino
    || before.size !== after.size || before.mtimeMs !== after.mtimeMs
    || bytes.length !== expected.byteLength
    || observedSha256 !== expected.sha256) {
    fail("IAT_B3_MANDATORY_CI_PHASE_B_INTERFACE_BYTES_HOLD");
  }
  return Object.freeze({
    label,
    path: expected.path,
    sha256: observedSha256,
    byteLength: bytes.length,
    directStaticSourceObservation: true,
    runtimeEvidence: false,
  });
}

export function validateIatB3MandatoryCiPhaseBInterfaceSources() {
  const labels = Object.keys(IAT_B3_MANDATORY_CI_PHASE_B_INTERFACE_SOURCES);
  const sources = labels.map((label) => observeExactInterfaceSource(
    label, IAT_B3_MANDATORY_CI_PHASE_B_INTERFACE_SOURCES[label],
  ));
  return Object.freeze({
    schema: IAT_B3_MANDATORY_CI_PHASE_B_INTERFACE_SCHEMA,
    status: "STATIC_SOURCE_BOUND_HOLD",
    ready: false,
    complete: false,
    runtimeEvidenceObserved: false,
    compileReceiptObserved: false,
    publicInputObserved: false,
    sources: Object.freeze(sources),
  });
}

export function validateIatB3MandatoryCiTap(
  output,
  gate,
  expectedTestCount,
  expectedCaseNames = null,
) {
  if (typeof gate !== "string" || !Number.isSafeInteger(expectedTestCount)
    || expectedTestCount < 1 || typeof output !== "string"
    || !output.startsWith("TAP version 13\n") || !output.endsWith("\n")
    || output.includes("\r") || /(?:^|\n)Bail out!/u.test(output)) {
    fail(`IAT_B3_MANDATORY_CI_GATE_${gate}_TAP_HOLD`);
  }
  const lines = output.slice(0, -1).split("\n");
  if (lines.length < 10) fail(`IAT_B3_MANDATORY_CI_GATE_${gate}_INCOMPLETE_HOLD`);
  const planIndex = lines.length - 9;
  if (lines[planIndex] !== `1..${expectedTestCount}`) {
    fail(`IAT_B3_MANDATORY_CI_GATE_${gate}_PLAN_HOLD`);
  }
  summaryLine(lines, planIndex + 1, "tests", expectedTestCount);
  summaryLine(lines, planIndex + 2, "suites", 0);
  summaryLine(lines, planIndex + 3, "pass", expectedTestCount);
  summaryLine(lines, planIndex + 4, "fail", 0);
  summaryLine(lines, planIndex + 5, "cancelled", 0);
  summaryLine(lines, planIndex + 6, "skipped", 0);
  summaryLine(lines, planIndex + 7, "todo", 0);
  if (!/^# duration_ms (?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/u.test(lines[planIndex + 8])) {
    fail(`IAT_B3_MANDATORY_CI_GATE_${gate}_DURATION_HOLD`);
  }
  const plans = lines.filter((line) => /^1\.\.[0-9]+$/u.test(line));
  const summaries = lines.filter((line) => /^# (?:tests|suites|pass|fail|cancelled|skipped|todo|duration_ms)\b/u.test(line));
  const bodyLines = lines.slice(1, planIndex);
  const results = bodyLines
    .map((line, bodyIndex) => ({ line, bodyIndex }))
    .filter(({ line }) => /^(?:ok|not ok) [0-9]+(?:\s+-|\s*$)/u.test(line));
  const subtests = bodyLines
    .map((line, bodyIndex) => ({ line, bodyIndex }))
    .filter(({ line }) => line.startsWith("# Subtest: "));
  const subtestNames = subtests.map(({ line }) => line.slice("# Subtest: ".length));
  const resultNames = results.map(({ line }, index) => {
    const match = line.match(new RegExp(`^ok ${index + 1} - (.+)$`, "u"));
    return match?.[1] ?? null;
  });
  const expectedCaseNamesSha256 = expectedCaseNames === null
    ? IAT_B3_MANDATORY_CI_ORDERED_CASE_NAMES_SHA256[gate]
    : iatB3MandatoryCiOrderedCaseNamesSha256(expectedCaseNames);
  if (plans.length !== 1 || summaries.length !== 8 || results.length !== expectedTestCount
    || results.some(({ line }, index) => !line.startsWith(`ok ${index + 1} `))
    || subtestNames.length !== expectedTestCount
    || resultNames.some((name, index) => name === null || name !== subtestNames[index])
    || subtests.some(({ bodyIndex }, index) => bodyIndex >= results[index].bodyIndex
      || (index + 1 < subtests.length && results[index].bodyIndex >= subtests[index + 1].bodyIndex))
    || !/^[0-9a-f]{64}$/u.test(expectedCaseNamesSha256 ?? "")
    || iatB3MandatoryCiOrderedCaseNamesSha256(subtestNames) !== expectedCaseNamesSha256
    || /(?:^|\s)#\s*(?:SKIP|TODO)\b/mu.test(output)
    || lines.slice(planIndex + 9).length !== 0) {
    fail(`IAT_B3_MANDATORY_CI_GATE_${gate}_INCOMPLETE_HOLD`);
  }
  return Object.freeze({
    gate,
    tests: expectedTestCount,
    pass: expectedTestCount,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
    exactEofObserved: true,
    bailoutObserved: false,
    orderedCaseNamesSha256: expectedCaseNamesSha256,
  });
}

export function parseIatB3MandatoryCiGateArguments(arguments_) {
  if (!Array.isArray(arguments_) || arguments_.length !== 1
    || typeof arguments_[0] !== "string"
    || !Object.hasOwn(IAT_B3_MANDATORY_CI_GATES, arguments_[0])) {
    fail("IAT_B3_MANDATORY_CI_GATE_EXACT_ARGUMENT_REQUIRED_HOLD");
  }
  return arguments_[0];
}

export function sanitizeIatB3MandatoryCiEnvironment(environment = process.env) {
  return Object.freeze(Object.fromEntries(
    Object.entries(environment).filter(([name, value]) =>
      !FORBIDDEN_ENVIRONMENT.test(name) && typeof value === "string"),
  ));
}

function streamDiagnostic(value) {
  const bytes = Buffer.from(typeof value === "string" ? value : "", "utf8");
  const edge = IAT_B3_NATIVE_CONTAINMENT_TIMING.diagnosticEdgeBytes;
  return Object.freeze({
    rawBytesObserved: bytes.length,
    rawSha256: createHash("sha256").update(bytes).digest("hex"),
    truncated: bytes.length > edge,
    prefixBase64: bytes.subarray(0, edge).toString("base64"),
    tailBase64: bytes.subarray(Math.max(0, bytes.length - edge)).toString("base64"),
  });
}

const ORACLE_KEYS = Object.freeze([
  "helperIdentityValid", "helperSpawnFailed", "helperAbnormalTermination",
  "protocolValid", "containmentSetupProven", "workloadResumed",
  "workloadSpawnFailed", "startupDeadlineExpired", "executionDeadlineExpired",
  "outputLimitExceeded", "rootTerminalObserved", "rootExitCode", "rootSignal",
  "tapValid", "stderrEmpty", "descendantLeakObserved", "zombieDescendantCount",
  "absenceProofObserved", "finalizationDeadlineExpired", "forcedTeardownTimeout",
  "outerDeadlineExpired", "interventionUsed", "streamsClosed",
]);

export function evaluateIatB3MandatoryCiContainmentOracle(observation) {
  if (!observation || typeof observation !== "object" || Array.isArray(observation)
    || Object.keys(observation).some((key) => !ORACLE_KEYS.includes(key))) {
    fail("IAT_B3_CONTAINMENT_ORACLE_INPUT_HOLD");
  }
  const value = Object.freeze({
    helperIdentityValid: false,
    helperSpawnFailed: false,
    helperAbnormalTermination: false,
    protocolValid: false,
    containmentSetupProven: false,
    workloadResumed: false,
    workloadSpawnFailed: false,
    startupDeadlineExpired: false,
    executionDeadlineExpired: false,
    outputLimitExceeded: false,
    rootTerminalObserved: false,
    rootExitCode: null,
    rootSignal: null,
    tapValid: false,
    stderrEmpty: false,
    descendantLeakObserved: false,
    zombieDescendantCount: 0,
    absenceProofObserved: false,
    finalizationDeadlineExpired: false,
    forcedTeardownTimeout: false,
    outerDeadlineExpired: false,
    interventionUsed: false,
    streamsClosed: false,
    ...observation,
  });
  let reason = null;
  if (value.forcedTeardownTimeout) reason = "FORCED_TEARDOWN_TIMEOUT";
  else if (value.outerDeadlineExpired) reason = "OUTER_DEADLINE";
  else if (!value.helperIdentityValid) reason = "HELPER_IDENTITY_UNPROVEN";
  else if (value.helperSpawnFailed) reason = "HELPER_SPAWN_FAILED";
  else if (value.helperAbnormalTermination) reason = "HELPER_ABNORMAL_TERMINATION";
  else if (!value.protocolValid) reason = "PROTOCOL_CORRUPTION";
  else if (!value.containmentSetupProven) reason = "CONTAINMENT_SETUP_UNPROVEN";
  else if (value.startupDeadlineExpired) reason = "STARTUP_TIMEOUT";
  else if (value.workloadSpawnFailed) reason = "WORKLOAD_SPAWN_FAILED";
  else if (!value.workloadResumed) reason = "WORKLOAD_NOT_RESUMED";
  else if (value.outputLimitExceeded) reason = "OUTPUT_LIMIT";
  else if (value.executionDeadlineExpired) reason = "TIMEOUT";
  else if (value.rootSignal !== null) reason = "SIGNAL";
  else if (!value.rootTerminalObserved) reason = "ROOT_TERMINAL_UNOBSERVED";
  else if (value.rootExitCode !== 0) reason = "NONZERO";
  else if (!value.streamsClosed || value.finalizationDeadlineExpired) reason = "FINALIZATION_TIMEOUT";
  else if (!value.tapValid) reason = "INCOMPLETE_TAP";
  else if (!value.stderrEmpty) reason = "STDERR_NOT_EMPTY";
  else if (value.descendantLeakObserved || value.zombieDescendantCount !== 0) reason = "DESCENDANT_LEAK";
  else if (!value.absenceProofObserved) reason = "ABSENCE_UNPROVEN";
  else if (value.interventionUsed) reason = "KILL_ASSISTED_PASS_FORBIDDEN";
  return Object.freeze({
    schema: IAT_B3_MANDATORY_CI_ORACLE_SCHEMA,
    status: "HOLD_TEST",
    exitCode: 2,
    reason: "PHASE_A_EXPORTED_ORACLE_NON_EVIDENCE",
    observedReason: reason ?? "STRUCTURAL_PASS_NOT_EVIDENCE",
    ready: false,
    complete: false,
    containmentProven: false,
    executionProvenanceObserved: false,
    interventionUsed: value.interventionUsed,
  });
}

export function createIatB3MandatoryCiHoldDiagnostic({
  gate,
  reason = "SOURCE_BOUND_LIVE_RECEIPTS_UNAVAILABLE",
  stdout = "",
  stderr = "",
} = {}) {
  if (!Object.hasOwn(IAT_B3_MANDATORY_CI_GATES, gate)
    || ![
      "SOURCE_BOUND_LIVE_RECEIPTS_UNAVAILABLE",
      "CALLER_INJECTION_REJECTED",
      "CANONICAL_HOLD",
    ].includes(reason)) fail("IAT_B3_MANDATORY_CI_DIAGNOSTIC_INPUT_HOLD");
  return Object.freeze({
    schema: IAT_B3_MANDATORY_CI_PROCESS_DIAGNOSTIC_SCHEMA,
    status: "HOLD",
    exitCode: 2,
    gate,
    reason,
    stdout: streamDiagnostic(stdout),
    stderr: streamDiagnostic(stderr),
    sourceBoundReceiptObserved: false,
    executionProvenanceObserved: false,
    runtimeEvidenceObserved: false,
    containmentProven: false,
    ready: false,
    complete: false,
  });
}

export function runIatB3MandatoryCiGateInjected(gate, injected = undefined) {
  if (!Object.hasOwn(IAT_B3_MANDATORY_CI_GATES, gate))
    fail("IAT_B3_MANDATORY_CI_GATE_UNKNOWN_HOLD");
  if (injected !== undefined && (injected === null
    || typeof injected !== "object" || Array.isArray(injected))) {
    fail("IAT_B3_MANDATORY_CI_INJECTED_INPUT_SHAPE_HOLD");
  }
  return Object.freeze({
    schema: IAT_B3_MANDATORY_CI_GATE_SCHEMA,
    status: "HOLD",
    exitCode: 2,
    gate,
    ready: false,
    complete: false,
    valid: false,
    runnerInvoked: false,
    processStarted: false,
    nativeHelperExecuted: false,
    executionProvenanceObserved: false,
    runtimeEvidenceObserved: false,
    containmentProven: false,
    callerInputAccepted: false,
    diagnostic: createIatB3MandatoryCiHoldDiagnostic({
      gate,
      reason: "CALLER_INJECTION_REJECTED",
    }),
    blockers: Object.freeze([
      "CALLER_INJECTED_RUNNER_FORBIDDEN_HOLD",
      "SOURCE_BOUND_LIVE_RECEIPTS_REQUIRED",
      "B27_NO_EXECUTION_API",
    ]),
  });
}

export async function runIatB3MandatoryCiGateCanonical(
  gate,
  candidate = undefined,
) {
  if (!Object.hasOwn(IAT_B3_MANDATORY_CI_GATES, gate))
    fail("IAT_B3_MANDATORY_CI_GATE_UNKNOWN_HOLD");
  if (process.versions.node.split(".")[0] !== "24")
    fail("IAT_B3_MANDATORY_CI_GATE_NODE_24_REQUIRED_HOLD");
  if (candidate !== undefined && (candidate === null
    || typeof candidate !== "object" || Array.isArray(candidate)
    || Object.keys(candidate).some((key) => key !== "runtimeReceiptBytes"))) {
    fail("IAT_B3_MANDATORY_CI_CANONICAL_CANDIDATE_EXACT_SCHEMA_HOLD");
  }
  const interfaceSources = validateIatB3MandatoryCiPhaseBInterfaceSources();
  const policyBytes = readFileSync(NATIVE_TOOLCHAIN_POLICY_PATH);
  const policy = parseJsonRejectingDuplicateKeys(policyBytes.toString("utf8"));
  const sourceClosure = observeNativeContainmentSourceClosure(REPOSITORY_ROOT);
  const buildContractClosure =
    observeNativeContainmentBuildContractClosure(REPOSITORY_ROOT);
  const authoritySourceObservation =
    observeNativeContainmentAuthoritySource(REPOSITORY_ROOT);
  const preflight = assessNativeContainmentPreflight({
    policy,
    sourceClosure,
    buildContractClosure,
    authoritySourceObservation,
    headSha: null,
    treeSha: null,
  });
  const runtimeReceiptAssessment = candidate?.runtimeReceiptBytes === undefined
    ? createNativeRuntimeContainmentReceiptHold()
    : assessNativeRuntimeContainmentReceipt(candidate.runtimeReceiptBytes);
  const testSourceIdentity = validateIatB3MandatoryCiTestSourceIdentity(gate);
  const blockers = Object.freeze([...new Set([
    "SOURCE_BOUND_LIVE_BUILD_RECEIPT_UNAVAILABLE",
    "SOURCE_BOUND_LIVE_RUNTIME_RECEIPT_UNAVAILABLE",
    "K44_DIRECT_OBSERVERS_UNAVAILABLE",
    "CANONICAL_MANDATORY_CONTAINMENT_HOLD",
    "B27_NO_EXECUTION_API",
    ...preflight.blockers,
    ...runtimeReceiptAssessment.blockers,
  ])]);
  return Object.freeze({
    schema: IAT_B3_MANDATORY_CI_GATE_SCHEMA,
    status: "HOLD",
    exitCode: 2,
    gate,
    ready: false,
    complete: false,
    valid: false,
    authorized: false,
    interfaceSources,
    interfaceSchemas: Object.freeze({
      buildReceipt: IAT_B3_NATIVE_CONTAINMENT_RECEIPT_SCHEMA,
      runtimeReceipt: IAT_B3_NATIVE_RUNTIME_CONTAINMENT_RECEIPT_SCHEMA,
      runtimeAssessment: IAT_B3_NATIVE_RUNTIME_CONTAINMENT_ASSESSMENT_SCHEMA,
      publicBuildInputAssessment: IAT_B3_KEY_FREE_ASSESSMENT_SCHEMA,
      publicBuildInputPurpose: IAT_B3_KEY_FREE_PURPOSE,
    }),
    runtimeReceiptAssessment,
    testSourceIdentity,
    diagnostic: createIatB3MandatoryCiHoldDiagnostic({
      gate,
      reason: "SOURCE_BOUND_LIVE_RECEIPTS_UNAVAILABLE",
    }),
    policySha256: sha256(policyBytes),
    sourceClosureSha256: sourceClosure.closureSha256,
    buildContractClosureSha256: buildContractClosure.closureSha256,
    declaredExecutionDeadlineMs: IAT_B3_MANDATORY_CI_GATE_DEADLINES_MS[gate],
    declaredOuterDeadlineMs: gate === "all-feature-devnet-readiness"
      ? IAT_B3_NATIVE_CONTAINMENT_TIMING.allFeatureOuterMs
      : IAT_B3_NATIVE_CONTAINMENT_TIMING.outerMs,
    sourceCheckpointObserved: false,
    buildReceiptObserved: false,
    buildReceiptValidated: false,
    publicBuildInputObserved: false,
    publicBuildInputAuthorized: false,
    runtimeReceiptSourceObserved: false,
    executionProvenanceObserved: false,
    runtimeEvidenceObserved: false,
    containmentProven: false,
    tapObserved: false,
    deadlineObserved: false,
    cleanupObserved: false,
    artifactBuilt: false,
    nativeHelperExecuted: false,
    processStarted: false,
    callerInputAccepted: false,
    injectedInputAccepted: false,
    selfAuthoredReceiptAccepted: false,
    automaticRetryAuthorized: false,
    networkUsed: false,
    rpcUsed: false,
    keyRead: false,
    transactionSigned: false,
    transactionSent: false,
    devnetExecuted: false,
    mainnetExecuted: false,
    mainnetAuthorized: false,
    releaseAuthorized: false,
    blockers,
  });
}

export const runIatB3MandatoryCiGate = runIatB3MandatoryCiGateCanonical;

async function main() {
  const gate = parseIatB3MandatoryCiGateArguments(process.argv.slice(2));
  const report = await runIatB3MandatoryCiGateCanonical(gate);
  process.stdout.write(`${JSON.stringify(report)}\n`);
  process.exitCode = 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      schema: IAT_B3_MANDATORY_CI_PROCESS_DIAGNOSTIC_SCHEMA,
      status: "HOLD",
      exitCode: 2,
      ready: false,
      complete: false,
      runtimeEvidenceObserved: false,
      code: typeof error?.code === "string"
        ? error.code : error instanceof Error ? error.message : String(error),
    })}\n`);
    process.exitCode = 2;
  });
}

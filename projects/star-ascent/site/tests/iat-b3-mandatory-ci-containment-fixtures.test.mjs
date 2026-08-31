import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const TEST_ROOT = dirname(fileURLToPath(import.meta.url));
const PRIMARY_RELATIVE_PATH =
  "tests/fixtures/iat-b3-mandatory-ci-containment-fixture.mjs";
const DESCENDANT_RELATIVE_PATH =
  "tests/fixtures/iat-b3-mandatory-ci-containment-descendant.mjs";
const PRIMARY_PATH = resolve(TEST_ROOT, "fixtures/iat-b3-mandatory-ci-containment-fixture.mjs");
const DESCENDANT_PATH = resolve(TEST_ROOT, "fixtures/iat-b3-mandatory-ci-containment-descendant.mjs");
const primaryBytes = readFileSync(PRIMARY_PATH);
const descendantBytes = readFileSync(DESCENDANT_PATH);
const primarySource = primaryBytes.toString("utf8");
const descendantSource = descendantBytes.toString("utf8");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const CASE_IDS = Object.freeze([
  "TAP_PARTIAL_EOF",
  "TAP_FORGED_CASE_IDENTITY",
  "TAP_BAILOUT",
  "TAP_TRAILING_OR_DUPLICATE_STRUCTURE",
  "TAP_FORBIDDEN_DIRECTIVE_OR_SUMMARY",
  "EXECUTION_DEADLINE",
  "IGNORED_TERMINATION_AFTER_DEADLINE",
  "DESCENDANT_RETAINED",
  "ZOMBIE_DESCENDANT",
  "SUCCESS_PATH_INTERVENTION",
]);

const REASON_PRECEDENCE = Object.freeze([
  "FORCED_TEARDOWN_TIMEOUT",
  "OUTER_DEADLINE",
  "HELPER_IDENTITY_UNPROVEN",
  "HELPER_SPAWN_FAILED",
  "HELPER_ABNORMAL_TERMINATION",
  "PROTOCOL_CORRUPTION",
  "CONTAINMENT_SETUP_UNPROVEN",
  "STARTUP_TIMEOUT",
  "WORKLOAD_SPAWN_FAILED",
  "WORKLOAD_NOT_RESUMED",
  "OUTPUT_LIMIT",
  "TIMEOUT",
  "SIGNAL",
  "ROOT_TERMINAL_UNOBSERVED",
  "NONZERO",
  "FINALIZATION_TIMEOUT",
  "INCOMPLETE_TAP",
  "STDERR_NOT_EMPTY",
  "DESCENDANT_LEAK",
  "ABSENCE_UNPROVEN",
  "KILL_ASSISTED_PASS_FORBIDDEN",
  "STRUCTURAL_PASS_NOT_EVIDENCE",
]);

const VALID_TAP =
  "TAP version 13\n" +
  "# Subtest: fixture\n" +
  "ok 1 - fixture\n" +
  "1..1\n" +
  "# tests 1\n" +
  "# suites 0\n" +
  "# pass 1\n" +
  "# fail 0\n" +
  "# cancelled 0\n" +
  "# skipped 0\n" +
  "# todo 0\n" +
  "# duration_ms 0\n";

const SYNTHETIC_STDOUT = Object.freeze({
  CANONICAL_VALID_TAP: VALID_TAP,
  TAP_PARTIAL_EOF: VALID_TAP.slice(0, -1),
  TAP_FORGED_CASE_IDENTITY:
    "TAP version 13\n" +
    "# Subtest: fixture\n" +
    "ok 1 - forged\n" +
    "1..1\n" +
    "# tests 1\n" +
    "# suites 0\n" +
    "# pass 1\n" +
    "# fail 0\n" +
    "# cancelled 0\n" +
    "# skipped 0\n" +
    "# todo 0\n" +
    "# duration_ms 0\n",
  TAP_BAILOUT: "TAP version 13\nBail out! fixture\n",
  TAP_TRAILING_OR_DUPLICATE_STRUCTURE: `${VALID_TAP}trailing\n`,
  TAP_FORBIDDEN_DIRECTIVE_OR_SUMMARY:
    "TAP version 13\n" +
    "# Subtest: fixture\n" +
    "ok 1 - fixture # SKIP forbidden\n" +
    "1..1\n" +
    "# tests 1\n" +
    "# suites 0\n" +
    "# pass 1\n" +
    "# fail 0\n" +
    "# cancelled 0\n" +
    "# skipped 1\n" +
    "# todo 0\n" +
    "# duration_ms 0\n",
});

const OUTPUT_BYTE_BINDINGS = Object.freeze({
  CANONICAL_VALID_TAP: Object.freeze({ sha256: "19ea462774f17c63d5dcd6a98c1526d03bb606c54965b3ee4010321e36755b4a", bytes: 144 }),
  TAP_PARTIAL_EOF: Object.freeze({ sha256: "0fb125c4d49334f36769d5071d221bb4221eb4670d2a527dc30a98517a4dfaed", bytes: 143 }),
  TAP_FORGED_CASE_IDENTITY: Object.freeze({ sha256: "a07dfe0b7d8988b99e3530c784cb5865210035d82507422d4ecbd9e4a6ddadb7", bytes: 143 }),
  TAP_BAILOUT: Object.freeze({ sha256: "10a5b176158cce185b438614e13515432e0d44a0db759e2fb2bd3df5850923b3", bytes: 33 }),
  TAP_TRAILING_OR_DUPLICATE_STRUCTURE: Object.freeze({ sha256: "4dbb05b766ba0e3913bf432d96c7e6edb73f7ecfbd3d0b0de251d298dd4ea0cd", bytes: 153 }),
  TAP_FORBIDDEN_DIRECTIVE_OR_SUMMARY: Object.freeze({ sha256: "a579cedfe8ebc8e86ed2320aeb1759811452959eef2e1cbcfc7a2d79b76309f2", bytes: 161 }),
});

const CASE_SPECS = Object.freeze([
  Object.freeze({ id: CASE_IDS[0], category: "PARTIAL_TAP", mutation: Object.freeze({ tapValid: false }), observedReason: "INCOMPLETE_TAP", controlOutcome: "INCOMPLETE_TAP" }),
  Object.freeze({ id: CASE_IDS[1], category: "FORGED_TAP", mutation: Object.freeze({ tapValid: false }), observedReason: "INCOMPLETE_TAP", controlOutcome: "INCOMPLETE_TAP" }),
  Object.freeze({ id: CASE_IDS[2], category: "BAILOUT_TAP", mutation: Object.freeze({ tapValid: false }), observedReason: "INCOMPLETE_TAP", controlOutcome: "INCOMPLETE_TAP" }),
  Object.freeze({ id: CASE_IDS[3], category: "TRAILING_OR_DUPLICATE_TAP_STRUCTURE", mutation: Object.freeze({ tapValid: false }), observedReason: "INCOMPLETE_TAP", controlOutcome: "INCOMPLETE_TAP" }),
  Object.freeze({ id: CASE_IDS[4], category: "FORBIDDEN_TAP_DIRECTIVE_OR_SUMMARY", mutation: Object.freeze({ tapValid: false }), observedReason: "INCOMPLETE_TAP", controlOutcome: "INCOMPLETE_TAP" }),
  Object.freeze({ id: CASE_IDS[5], category: "EXECUTION_TIMEOUT", mutation: Object.freeze({ executionDeadlineExpired: true }), observedReason: "TIMEOUT", controlOutcome: "TIMEOUT" }),
  Object.freeze({ id: CASE_IDS[6], category: "IGNORED_TERMINATION", mutation: Object.freeze({ executionDeadlineExpired: true, interventionUsed: true }), observedReason: "TIMEOUT", controlOutcome: "TIMEOUT" }),
  Object.freeze({ id: CASE_IDS[7], category: "DESCENDANT_LEAK", mutation: Object.freeze({ descendantLeakObserved: true, absenceProofObserved: false }), observedReason: "DESCENDANT_LEAK", controlOutcome: null }),
  Object.freeze({ id: CASE_IDS[8], category: "ZOMBIE_DESCENDANT", mutation: Object.freeze({ zombieDescendantCount: 1, absenceProofObserved: false }), observedReason: "DESCENDANT_LEAK", controlOutcome: null }),
  Object.freeze({ id: CASE_IDS[9], category: "SUCCESS_PATH_KILL", mutation: Object.freeze({ interventionUsed: true }), observedReason: "KILL_ASSISTED_PASS_FORBIDDEN", controlOutcome: null }),
]);

function rootNode(caseId) {
  return {
    nodeId: "ROOT",
    sourceId: "PRIMARY",
    parentNodeId: null,
    argvTail: [PRIMARY_RELATIVE_PATH, "--case", caseId],
    environmentEntries: [],
  };
}

function childNode(caseId) {
  return {
    nodeId: "CHILD_1",
    sourceId: "DESCENDANT",
    parentNodeId: "ROOT",
    argvTail: [DESCENDANT_RELATIVE_PATH, "--case", caseId],
    environmentEntries: [],
  };
}

function topology(caseId) {
  const descendantCase = caseId === "DESCENDANT_RETAINED" ||
    caseId === "ZOMBIE_DESCENDANT" ||
    caseId === "SUCCESS_PATH_INTERVENTION";
  return {
    root: rootNode(caseId),
    descendants: descendantCase ? [childNode(caseId)] : [],
    expectedLiveDescendantsAtFinalization: caseId === "DESCENDANT_RETAINED" ? 1 : 0,
    expectedZombieCount: caseId === "ZOMBIE_DESCENDANT" ? 1 : 0,
    expectedAbsence: caseId !== "DESCENDANT_RETAINED" && caseId !== "ZOMBIE_DESCENDANT",
  };
}

function signalEvents(caseId) {
  if (caseId === "IGNORED_TERMINATION_AFTER_DEADLINE") {
    return [
      { offsetMs: 120000, kind: "GRACEFUL_TERMINATION_REQUEST", targetNodeId: "ROOT" },
      { offsetMs: 125000, kind: "FORCED_TERMINATION_REQUEST", targetNodeId: "ROOT" },
    ];
  }
  if (caseId === "SUCCESS_PATH_INTERVENTION") {
    return [
      { offsetMs: 5000, kind: "FORCED_TERMINATION_REQUEST", targetNodeId: "CHILD_1" },
    ];
  }
  return [];
}

function outputDeclaration(caseId) {
  const invalidTap = CASE_IDS.indexOf(caseId) < 5;
  const stdoutKind = invalidTap ? caseId : "CANONICAL_VALID_TAP";
  return {
    stdoutKind,
    stdoutUtf8: SYNTHETIC_STDOUT[stdoutKind],
    stderrUtf8: "",
    tapValid: !invalidTap,
    stdoutTruncated: false,
    stderrTruncated: false,
  };
}

function expected(spec) {
  return {
    status: "HOLD_TEST",
    exitCode: 2,
    exportedReason: "PHASE_A_EXPORTED_ORACLE_NON_EVIDENCE",
    observedReason: spec.observedReason,
    controlOutcome: spec.controlOutcome,
    controlOutcomeMapping: spec.controlOutcome === null
      ? "NO_FROZEN_ONE_TO_ONE_MAPPING_HOLD"
      : "FROZEN_ONE_TO_ONE",
  };
}

const PLAN = {
  schema: "iat-b3-mandatory-ci-hostile-fixture-plan/v1",
  status: "HOLD_TEST",
  classification: "BP03_NEW_STRUCTURAL_SOURCE_ONLY_NON_EVIDENCE",
  constants: {
    startupMs: 10000,
    executionMs: 120000,
    finalizationMs: 5000,
    teardownMs: 15000,
    outerMs: 155000,
    stdoutCapBytes: 67108864,
    stderrCapBytes: 67108864,
    diagnosticEdgeBytes: 2048,
  },
  sourceBindings: [
    {
      sourceId: "PRIMARY",
      path: PRIMARY_RELATIVE_PATH,
      role: "HOSTILE_ROOT_FIXTURE_SOURCE",
      expectedSha256: "fd6a6a57c1c919a19c90b56df109b2a12de877b97e39728fb1ef4ec994587af4",
      expectedBytes: 1151,
    },
    {
      sourceId: "DESCENDANT",
      path: DESCENDANT_RELATIVE_PATH,
      role: "HOSTILE_DESCENDANT_FIXTURE_SOURCE",
      expectedSha256: "20d8092c7b2ab593768cdb421edd5906c2055f9adc248aa4125d8dc6d9318553",
      expectedBytes: 848,
    },
  ],
  syntheticOracleBaseline: {
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
  },
  reasonPrecedence: [...REASON_PRECEDENCE],
  cases: CASE_SPECS.map((spec) => ({
    id: spec.id,
    category: spec.category,
    topology: topology(spec.id),
    signalEvents: signalEvents(spec.id),
    outputDeclaration: outputDeclaration(spec.id),
    oracleMutation: { ...spec.mutation },
    expected: expected(spec),
  })),
  truthEnvelope: {
    fixtureExecutionAuthorized: false,
    fixtureExecutionObserved: false,
    processSpawned: false,
    helperExecuted: false,
    runtimeContainmentObserved: false,
    executionProvenanceObserved: false,
    containmentProven: false,
    ready: false,
    complete: false,
    releaseAuthorized: false,
    devnetAuthorized: false,
    mainnetAuthorized: false,
    dockerUsed: false,
    rpcUsed: false,
    keysUsed: false,
  },
  blockers: [
    "BP03_STRUCTURAL_PLAN_SELF_AUTHORED_NON_EVIDENCE",
    "BP03_FIXTURE_EXECUTION_UNOBSERVED",
    "BP03_FIXTURE_SOURCE_CHECKPOINT_UNOBSERVED",
    "BP03_PLATFORM_SIGNAL_MAPPING_UNOBSERVED",
    "BP03_RUNTIME_CONTAINMENT_RECEIPT_UNAVAILABLE",
  ],
};

const TOP_KEYS = ["schema", "status", "classification", "constants", "sourceBindings", "syntheticOracleBaseline", "reasonPrecedence", "cases", "truthEnvelope", "blockers"];
const CONSTANT_KEYS = ["startupMs", "executionMs", "finalizationMs", "teardownMs", "outerMs", "stdoutCapBytes", "stderrCapBytes", "diagnosticEdgeBytes"];
const SOURCE_KEYS = ["sourceId", "path", "role", "expectedSha256", "expectedBytes"];
const BASELINE_KEYS = ["helperIdentityValid", "helperSpawnFailed", "helperAbnormalTermination", "protocolValid", "containmentSetupProven", "workloadResumed", "workloadSpawnFailed", "startupDeadlineExpired", "executionDeadlineExpired", "outputLimitExceeded", "rootTerminalObserved", "rootExitCode", "rootSignal", "tapValid", "stderrEmpty", "descendantLeakObserved", "zombieDescendantCount", "absenceProofObserved", "finalizationDeadlineExpired", "forcedTeardownTimeout", "outerDeadlineExpired", "interventionUsed", "streamsClosed"];
const CASE_KEYS = ["id", "category", "topology", "signalEvents", "outputDeclaration", "oracleMutation", "expected"];
const TOPOLOGY_KEYS = ["root", "descendants", "expectedLiveDescendantsAtFinalization", "expectedZombieCount", "expectedAbsence"];
const NODE_KEYS = ["nodeId", "sourceId", "parentNodeId", "argvTail", "environmentEntries"];
const SIGNAL_KEYS = ["offsetMs", "kind", "targetNodeId"];
const OUTPUT_KEYS = ["stdoutKind", "stdoutUtf8", "stderrUtf8", "tapValid", "stdoutTruncated", "stderrTruncated"];
const EXPECTED_KEYS = ["status", "exitCode", "exportedReason", "observedReason", "controlOutcome", "controlOutcomeMapping"];
const TRUTH_KEYS = ["fixtureExecutionAuthorized", "fixtureExecutionObserved", "processSpawned", "helperExecuted", "runtimeContainmentObserved", "executionProvenanceObserved", "containmentProven", "ready", "complete", "releaseAuthorized", "devnetAuthorized", "mainnetAuthorized", "dockerUsed", "rpcUsed", "keysUsed"];

function exactKeys(value, keys, label) {
  assert.deepEqual(Object.keys(value), keys, label);
}

function validatePlan(candidate) {
  exactKeys(candidate, TOP_KEYS, "top-level keys");
  exactKeys(candidate.constants, CONSTANT_KEYS, "constant keys");
  exactKeys(candidate.syntheticOracleBaseline, BASELINE_KEYS, "baseline keys");
  exactKeys(candidate.truthEnvelope, TRUTH_KEYS, "truth keys");
  assert.deepEqual(candidate.constants, PLAN.constants);
  assert.deepEqual(candidate.syntheticOracleBaseline, PLAN.syntheticOracleBaseline);
  assert.deepEqual(candidate.reasonPrecedence, REASON_PRECEDENCE);
  assert.deepEqual(candidate.blockers, PLAN.blockers);
  for (const value of Object.values(candidate.truthEnvelope)) assert.equal(value, false);
  assert.equal(candidate.schema, "iat-b3-mandatory-ci-hostile-fixture-plan/v1");
  assert.equal(candidate.status, "HOLD_TEST");
  assert.equal(candidate.classification, "BP03_NEW_STRUCTURAL_SOURCE_ONLY_NON_EVIDENCE");
  assert.equal(candidate.sourceBindings.length, 2);
  for (let index = 0; index < candidate.sourceBindings.length; index += 1) {
    exactKeys(candidate.sourceBindings[index], SOURCE_KEYS, `source ${index}`);
    assert.deepEqual(candidate.sourceBindings[index], PLAN.sourceBindings[index]);
  }
  assert.equal(candidate.cases.length, 10);
  for (let index = 0; index < candidate.cases.length; index += 1) {
    const value = candidate.cases[index];
    exactKeys(value, CASE_KEYS, `case ${index}`);
    exactKeys(value.topology, TOPOLOGY_KEYS, `topology ${index}`);
    exactKeys(value.topology.root, NODE_KEYS, `root ${index}`);
    for (const child of value.topology.descendants) exactKeys(child, NODE_KEYS, `child ${index}`);
    for (const event of value.signalEvents) exactKeys(event, SIGNAL_KEYS, `signal ${index}`);
    exactKeys(value.outputDeclaration, OUTPUT_KEYS, `output ${index}`);
    exactKeys(value.expected, EXPECTED_KEYS, `expected ${index}`);
    assert.deepEqual(value, PLAN.cases[index]);
  }
  const forbiddenPlanKeys = new Set(["command", "executable", "cwd", "shell", "callback", "argv", "env", "signal"]);
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (value !== null && typeof value === "object") {
      for (const [key, nested] of Object.entries(value)) {
        assert.equal(forbiddenPlanKeys.has(key), false, key);
        walk(nested);
      }
    }
  };
  walk(candidate);
  assert.deepEqual(candidate, PLAN);
  return true;
}

const clonePlan = () => structuredClone(PLAN);
const rejectsMutation = (mutate) => {
  const candidate = clonePlan();
  mutate(candidate);
  assert.throws(() => validatePlan(candidate));
};

function extractStringArray(source, binding) {
  const start = source.indexOf(`export const ${binding} = Object.freeze([`);
  assert.notEqual(start, -1, binding);
  const end = source.indexOf("]);", start);
  assert.notEqual(end, -1, `${binding}:end`);
  return [...source.slice(start, end).matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/gu)]
    .map((match) => JSON.parse(`"${match[1]}"`));
}

test("fixture sources are exact self-authored structural inputs", () => {
  assert.equal(primaryBytes.byteLength, 1151);
  assert.equal(sha256(primaryBytes), "fd6a6a57c1c919a19c90b56df109b2a12de877b97e39728fb1ef4ec994587af4");
  assert.equal(descendantBytes.byteLength, 848);
  assert.equal(sha256(descendantBytes), "20d8092c7b2ab593768cdb421edd5906c2055f9adc248aa4125d8dc6d9318553");
  assert.deepEqual(extractStringArray(primarySource, "BP03_CASE_IDS"), CASE_IDS);
  assert.deepEqual(extractStringArray(descendantSource, "BP03_DESCENDANT_CASE_IDS"), ["DESCENDANT_RETAINED", "ZOMBIE_DESCENDANT"]);
});

test("closed v1 fixture plan validates exactly", () => {
  assert.equal(validatePlan(PLAN), true);
  assert.equal(JSON.stringify(JSON.parse(JSON.stringify(PLAN))), JSON.stringify(PLAN));
});

test("output declarations bind exact deterministic UTF-8 bytes", () => {
  for (const [kind, text] of Object.entries(SYNTHETIC_STDOUT)) {
    const bytes = Buffer.from(text, "utf8");
    assert.equal(bytes.byteLength, OUTPUT_BYTE_BINDINGS[kind].bytes, `${kind}:bytes`);
    assert.equal(sha256(bytes), OUTPUT_BYTE_BINDINGS[kind].sha256, `${kind}:sha256`);
  }
  for (const value of PLAN.cases) {
    assert.equal(value.outputDeclaration.stdoutUtf8, SYNTHETIC_STDOUT[value.outputDeclaration.stdoutKind]);
    assert.equal(value.outputDeclaration.stderrUtf8, "");
    assert.equal(value.outputDeclaration.stdoutTruncated, false);
    assert.equal(value.outputDeclaration.stderrTruncated, false);
  }
});

test("top-level, constant and source-binding mutations reject", () => {
  rejectsMutation((value) => { value.unknown = false; });
  rejectsMutation((value) => { delete value.classification; });
  rejectsMutation((value) => {
    const schema = value.schema;
    delete value.schema;
    value.schema = schema;
  });
  rejectsMutation((value) => { value.constants.executionMs = 120001; });
  rejectsMutation((value) => { value.sourceBindings[0].path = DESCENDANT_RELATIVE_PATH; });
  rejectsMutation((value) => { value.sourceBindings[0].role = "HOSTILE_DESCENDANT_FIXTURE_SOURCE"; });
  rejectsMutation((value) => { value.sourceBindings[0].expectedSha256 = "0".repeat(64); });
  rejectsMutation((value) => { value.sourceBindings[1].expectedBytes += 1; });
});

test("topology, argv-tail and environment mutations reject", () => {
  for (const forbidden of ["command", "executable", "cwd", "shell", "callback", "argv", "env", "signal"]) {
    rejectsMutation((value) => { value.cases[0].topology.root[forbidden] = null; });
  }
  rejectsMutation((value) => { value.cases[0].topology.root.argvTail[0] = DESCENDANT_RELATIVE_PATH; });
  rejectsMutation((value) => { value.cases[0].topology.root.argvTail.push("--extra"); });
  rejectsMutation((value) => { value.cases[0].topology.root.environmentEntries.push("PATH=x"); });
  rejectsMutation((value) => { value.cases[7].topology.expectedAbsence = true; });
  rejectsMutation((value) => { value.cases[9].topology.descendants = []; });
});

test("signal event mutations reject", () => {
  rejectsMutation((value) => { value.cases[6].signalEvents[0].offsetMs = 119999; });
  rejectsMutation((value) => { value.cases[6].signalEvents[1].kind = "GRACEFUL_TERMINATION_REQUEST"; });
  rejectsMutation((value) => { value.cases[9].signalEvents[0].targetNodeId = "ROOT"; });
  rejectsMutation((value) => { value.cases[0].signalEvents.push({ offsetMs: 1, kind: "FORCED_TERMINATION_REQUEST", targetNodeId: "ROOT" }); });
});

test("output and oracle mutations reject", () => {
  rejectsMutation((value) => { value.cases[0].outputDeclaration.stdoutUtf8 += "\n"; });
  rejectsMutation((value) => { value.cases[4].outputDeclaration.tapValid = true; });
  rejectsMutation((value) => { value.cases[5].outputDeclaration.stderrUtf8 = "noise"; });
  rejectsMutation((value) => { value.cases[5].outputDeclaration.stdoutTruncated = true; });
  rejectsMutation((value) => { value.cases[7].oracleMutation.absenceProofObserved = true; });
  rejectsMutation((value) => { value.cases[0].oracleMutation.unknown = false; });
});

test("reason, mapping, truth and blocker mutations reject", () => {
  rejectsMutation((value) => { value.reasonPrecedence.reverse(); });
  rejectsMutation((value) => { value.cases[0].expected.exportedReason = "INCOMPLETE_TAP"; });
  rejectsMutation((value) => { value.cases[7].expected.controlOutcome = "DESCENDANT_LEAK"; });
  rejectsMutation((value) => { value.cases[9].expected.controlOutcomeMapping = "FROZEN_ONE_TO_ONE"; });
  rejectsMutation((value) => { value.truthEnvelope.ready = true; });
  rejectsMutation((value) => { value.blockers.pop(); });
  rejectsMutation((value) => { value.blockers.reverse(); });
});

test("fixtures remain nonexecuting HOLD_TEST modules", () => {
  for (const source of [primarySource, descendantSource]) {
    assert.match(source, /STRUCTURAL_SOURCE_ONLY = true/u);
    assert.match(source, /EXECUTION_ENABLED = false/u);
    assert.match(source, /HOLD_TEST/u);
    assert.match(source, /process\.exitCode = 2/u);
    for (const forbidden of ["node:child_process", "spawn(", "fork(", "execFile(", "process.kill(", "setTimeout(", "setInterval(", "writeFile", "appendFile", "node:net", "node:http", "node:https"]) {
      assert.equal(source.includes(forbidden), false, forbidden);
    }
  }
});

test("static test reads bytes and never imports, evaluates or spawns fixtures", () => {
  const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const importSpecifiers = [...self.matchAll(/^import .* from "([^"]+)";$/gmu)]
    .map((match) => match[1]);
  const dynamicImportToken = ["import", "("].join("");
  assert.deepEqual(importSpecifiers, ["node:assert/strict", "node:crypto", "node:fs", "node:path", "node:test", "node:url"]);
  assert.equal(self.includes(dynamicImportToken), false);
  assert.match(self, /readFileSync\(PRIMARY_PATH\)/u);
  assert.match(self, /readFileSync\(DESCENDANT_PATH\)/u);
});

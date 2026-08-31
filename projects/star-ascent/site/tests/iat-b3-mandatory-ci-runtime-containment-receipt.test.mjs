import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  IAT_B3_NATIVE_RUNTIME_CONTAINMENT_ASSESSMENT_SCHEMA,
  IAT_B3_NATIVE_RUNTIME_CONTAINMENT_CONTROL_PROTOCOL,
  IAT_B3_NATIVE_RUNTIME_CONTAINMENT_LINUX_CAPABILITY_FIELDS,
  IAT_B3_NATIVE_RUNTIME_CONTAINMENT_RECEIPT_SCHEMA,
  IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TAP_MANIFEST,
  IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TARGETS,
  IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TOP_LEVEL_FIELDS,
  IAT_B3_NATIVE_RUNTIME_CONTAINMENT_WINDOWS_CAPABILITY_FIELDS,
  assessNativeRuntimeContainmentReceipt,
  createNativeRuntimeContainmentReceiptHold,
} from "../scripts/lib/iat-b3-mandatory-ci-runtime-containment-receipt.mjs";
import {
  IAT_B3_NATIVE_CONTAINMENT_RECEIPT_SCHEMA,
  IAT_B3_NATIVE_CONTAINMENT_TIMING,
  canonicalJson,
  semanticSha256,
  sha256,
} from "../scripts/lib/iat-b3-mandatory-ci-containment-contract.mjs";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(TEST_DIR, "..");
const SOURCE_PATH = resolve(
  SITE_ROOT,
  "scripts/lib/iat-b3-mandatory-ci-runtime-containment-receipt.mjs",
);
const SCHEMA_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-mandatory-ci-runtime-containment-receipt.schema.v1.json",
);
const EMPTY_SHA256 = sha256(Buffer.alloc(0));

function digest(label) {
  return sha256(Buffer.from(`bp07:${label}`, "utf8"));
}

function clone(value) {
  return structuredClone(value);
}

function withSemanticDigest(value, field) {
  return { ...value, [field]: semanticSha256(value) };
}

function artifactDescriptor(target, label, overrides = {}) {
  const windows = target === "windows-x64-gnu";
  const objectIdentity = windows
    ? {
      fileId128: label === "helper"
        ? "00112233445566778899AABBCCDDEEFF"
        : "102132435465768798A9BACBDCEDFE0F",
      kind: "WINDOWS_FILE",
      volumeSerialNumber: "89ABCDEF",
    }
    : {
      deviceId: label === "helper" ? "8:1" : "8:2",
      inode: label === "helper" ? "42001" : "42002",
      kind: "LINUX_FILE",
      mountId: label === "helper" ? "31" : "32",
    };
  const fileId = windows
    ? `${objectIdentity.volumeSerialNumber}:${objectIdentity.fileId128}`
    : `${objectIdentity.deviceId}:${objectIdentity.inode}:${objectIdentity.mountId}`;
  return {
    byteLength: label === "helper" ? 49_152 : 8_192,
    fileId,
    objectIdentity,
    realpath: windows
      ? (label === "helper"
        ? "C:\\bp07\\artifact\\iat-b3-containment.exe"
        : "C:\\bp07\\evidence\\compile-receipt.json")
      : (label === "helper"
        ? "/bp07/artifact/iat-b3-containment"
        : "/bp07/evidence/compile-receipt.json"),
    sha256: digest(label),
    ...overrides,
  };
}

function makeStream(name, bytes, contentSha256) {
  const capBytes = name === "stdout"
    ? IAT_B3_NATIVE_CONTAINMENT_TIMING.stdoutCapBytes
    : IAT_B3_NATIVE_CONTAINMENT_TIMING.stderrCapBytes;
  const edgeBytes = Math.min(
    bytes, IAT_B3_NATIVE_CONTAINMENT_TIMING.diagnosticEdgeBytes,
  );
  const semantic = {
    byteLength: bytes,
    capBytes,
    capExceeded: false,
    eofObserved: true,
    name,
    prefixByteLength: edgeBytes,
    prefixSha256: bytes === 0 ? EMPTY_SHA256 : digest(`${name}-prefix`),
    sha256: contentSha256,
    tailByteLength: edgeBytes,
    tailSha256: bytes === 0 ? EMPTY_SHA256 : digest(`${name}-tail`),
    truncated: false,
  };
  return withSemanticDigest(semantic, "streamObservationSha256");
}

function makeDeadlines(executionMs = 120_000) {
  const watchdogsArmedAtMonotonicMs = 1_000;
  const workloadStartedAtMonotonicMs = 1_100;
  const rootTerminalObservedAtMonotonicMs = 2_100;
  const streamsEofAtMonotonicMs = 2_200;
  const teardownStartedAtMonotonicMs = 2_100;
  const containmentEmptyAtMonotonicMs = 2_300;
  const receiptCommittedAtMonotonicMs = 2_400;
  const outerMs = executionMs === 180_000 ? 215_000 : 155_000;
  const policy = {
    clock: "MONOTONIC",
    executionDeadlineImmutable: true,
    executionMs,
    finalizationMs: 5_000,
    outerMs,
    parentGuardMs: 5_000,
    startupMs: 10_000,
    teardownDeadlineImmutable: true,
    teardownExtendsExecution: false,
    teardownObservationMs: 15_000,
    watchdogsArmedBeforeStart: true,
  };
  return {
    clock: policy.clock,
    containmentEmptyAtMonotonicMs,
    deadlinePolicySha256: semanticSha256(policy),
    executionDeadlineAtMonotonicMs: workloadStartedAtMonotonicMs + executionMs,
    executionDeadlineExpired: false,
    executionDeadlineImmutable: policy.executionDeadlineImmutable,
    executionMs,
    finalizationDeadlineAtMonotonicMs:
      rootTerminalObservedAtMonotonicMs + policy.finalizationMs,
    finalizationDeadlineExpired: false,
    finalizationMs: policy.finalizationMs,
    outerDeadlineAtMonotonicMs: watchdogsArmedAtMonotonicMs + outerMs,
    outerDeadlineExpired: false,
    outerMs,
    parentGuardMs: policy.parentGuardMs,
    receiptCommittedAtMonotonicMs,
    rootTerminalObservedAtMonotonicMs,
    startupDeadlineAtMonotonicMs:
      watchdogsArmedAtMonotonicMs + policy.startupMs,
    startupDeadlineExpired: false,
    startupMs: policy.startupMs,
    streamsEofAtMonotonicMs,
    teardownDeadlineAtMonotonicMs:
      teardownStartedAtMonotonicMs + policy.teardownObservationMs,
    teardownDeadlineExpired: false,
    teardownDeadlineImmutable: policy.teardownDeadlineImmutable,
    teardownExtendsExecution: policy.teardownExtendsExecution,
    teardownObservationMs: policy.teardownObservationMs,
    teardownStartedAtMonotonicMs,
    watchdogsArmedAtMonotonicMs,
    watchdogsArmedBeforeStart: policy.watchdogsArmedBeforeStart,
    workloadStartedAtMonotonicMs,
  };
}

function makeBindings(target, helperFileId) {
  const roles = target === "linux-x64-musl"
    ? [
      "control-channel", "helper-executable", "stderr-channel",
      "stdout-channel", "workload-executable",
    ]
    : [
      "completion-port", "control-channel", "helper-executable",
      "job-object", "stderr-channel", "stdout-channel", "workload-executable",
    ];
  const policy = {
    "completion-port": ["HELPER", false, false],
    "control-channel": ["OBSERVER", true, false],
    "helper-executable": ["OBSERVER", false, false],
    "job-object": ["HELPER", false, false],
    "stderr-channel": ["HELPER", false, true],
    "stdout-channel": ["HELPER", false, true],
    "workload-executable": ["HELPER", false, false],
  };
  return roles.map((role, index) => ({
    closedBeforeStart: false,
    inheritedByHelper: policy[role][1],
    inheritedByWorkload: policy[role][2],
    kind: target === "linux-x64-musl" ? "FD" : "HANDLE",
    objectId: role === "helper-executable"
      ? helperFileId : digest(`object-${target}-${role}`),
    owner: policy[role][0],
    role,
    value: target === "linux-x64-musl"
      ? String(3 + index) : `0x${(0x100 + index).toString(16).toUpperCase()}`,
  }));
}

function makePlatform(target) {
  const fields = target === "linux-x64-musl"
    ? IAT_B3_NATIVE_RUNTIME_CONTAINMENT_LINUX_CAPABILITY_FIELDS
    : IAT_B3_NATIVE_RUNTIME_CONTAINMENT_WINDOWS_CAPABILITY_FIELDS;
  const capabilities = Object.fromEntries(fields.map(
    (field) => [field, field === "numericPidCleanupUsed" ? false : true],
  ));
  return {
    arch: "x64",
    capabilities,
    capabilityObservationSha256: semanticSha256(capabilities),
    os: target === "linux-x64-musl" ? "linux" : "windows",
  };
}

function makeContainment(target, deadlines) {
  const platformEvidence = target === "linux-x64-musl"
    ? {
      allWaitFlags: ["WEXITED", "__WALL", "__WCLONE"],
      namespaceDestroyed: true,
      namespaceIdentity: digest("namespace"),
      namespacePid1ExitValidated: true,
      pid1TerminalCode: "CLD_EXITED",
      pid1TerminalStatus: 0,
      pidfdIdentity: digest("pidfd"),
      pidfdTerminalObserved: true,
    }
    : {
      activeProcessZeroAtMonotonicMs: deadlines.containmentEmptyAtMonotonicMs,
      activeProcessZeroObserved: true,
      breakawayObserved: false,
      completionPortIdentity: digest("completion-port"),
      jobCloseUsedToKill: false,
      jobObjectIdentity: digest("job-object"),
      rootExitObserved: true,
    };
  const semantic = {
    absenceProofObserved: true,
    completeDescendantReap: true,
    containmentEmpty: true,
    descendantLeakObserved: false,
    directChildReaped: true,
    interventionUsed: false,
    naturalCompletion: true,
    numericPidCleanupUsed: false,
    platformEvidence,
    rootExitCode: 0,
    rootSignal: 0,
    rootTerminalObserved: true,
    teardownKillUsed: false,
    workloadResumed: true,
    zombieDescendantCount: 0,
  };
  return withSemanticDigest(semantic, "containmentObservationSha256");
}

function makeCandidate(target = "linux-x64-musl") {
  const windows = target === "windows-x64-gnu";
  const observerSessionId = digest(`observer-${target}`);
  const helper = artifactDescriptor(target, "helper");
  const compileReceiptSha256 = digest(`compile-receipt-${target}`);
  const compileReceiptDescriptor = artifactDescriptor(
    target, "compile-receipt", { sha256: compileReceiptSha256 },
  );
  const deadlines = makeDeadlines(windows ? 180_000 : 120_000);
  const tapBytes = 12_345;
  const tapSha256 = digest(`tap-transcript-${target}`);
  const streams = {
    stderr: makeStream("stderr", 0, EMPTY_SHA256),
    stdout: makeStream("stdout", tapBytes, tapSha256),
  };
  const checkpoint = {
    buildPlanSha256: digest(`build-plan-${target}`),
    commitSha: "0123456789abcdef0123456789abcdef01234567",
    compileReceiptSha256,
    containmentContractSha256: digest("containment-contract"),
    policySha256: digest("policy"),
    sourceClosureSha256: digest("source-closure"),
    target,
    toolchainClosureSha256: digest(`toolchain-${target}`),
    treeSha: "89abcdef0123456789abcdef0123456789abcdef",
  };
  const compileProvenance = {
    artifactClaimSha256: semanticSha256(helper),
    artifactDescriptor: helper,
    buildId: `${target}-A`,
    observerSessionId,
    receiptDescriptor: compileReceiptDescriptor,
    receiptSha256: compileReceiptSha256,
    runtimeEvidenceIncluded: false,
    schema: IAT_B3_NATIVE_CONTAINMENT_RECEIPT_SCHEMA,
    target,
  };
  const runtimeArtifact = {
    bindingMethod: windows
      ? "HELD_IMAGE_SECTION_OBJECT" : "FD_EXECVEAT_AT_EMPTY_PATH",
    compileDescriptor: clone(helper),
    deleteMutationDenied: true,
    executionDescriptor: clone(helper),
    executionFromHeldObject: true,
    heldObjectIdentity: helper.fileId,
    openedBeforeWatchdog: true,
    openedDescriptor: clone(helper),
    pathLookupAfterOpen: false,
    postExecutionDescriptor: clone(helper),
    postIdentityObserved: true,
    sameObjectObserved: true,
    writeMutationDenied: true,
  };
  const workloadArgv = windows
    ? ["C:\\bp07\\runtime\\node.exe", "--test", "C:\\bp07\\tests\\gate.test.mjs"]
    : ["/bp07/runtime/node", "--test", "/bp07/tests/gate.test.mjs"];
  const environment = windows
    ? {
      HOME: "C:\\bp07\\home",
      LANG: "C",
      LC_ALL: "C",
      PATH: "",
      SOURCE_DATE_EPOCH: "0",
      SYSTEMROOT: "C:\\Windows",
      TEMP: "C:\\bp07\\tmp",
      TMP: "C:\\bp07\\tmp",
      TMPDIR: "C:\\bp07\\tmp",
      TZ: "UTC",
    }
    : {
      HOME: "/bp07/home",
      LANG: "C",
      LC_ALL: "C",
      PATH: "",
      SOURCE_DATE_EPOCH: "0",
      TEMP: "/bp07/tmp",
      TMP: "/bp07/tmp",
      TMPDIR: "/bp07/tmp",
      TZ: "UTC",
    };
  const cwd = windows ? "C:\\bp07\\work" : "/bp07/work";
  const invocationSemantic = {
    cwd,
    descriptorBindings: makeBindings(target, helper.fileId),
    environment,
    helperArgv: [
      helper.realpath,
      "--startup-ms", "10000",
      "--execution-ms", String(deadlines.executionMs),
      "--finalization-ms", "5000",
      "--teardown-ms", "15000",
      "--stdout-cap", "67108864",
      "--stderr-cap", "67108864",
      "--", ...workloadArgv,
    ],
    workloadArgv,
  };
  const invocation = withSemanticDigest(invocationSemantic, "invocationSha256");
  const tap = {
    bailout: false,
    cancelled: 0,
    directives: false,
    fail: 0,
    manifest: clone(IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TAP_MANIFEST),
    noTrailingLines: true,
    pass: 30,
    planEnd: 30,
    planStart: 1,
    skipped: 0,
    strictValidated: true,
    tests: 30,
    todo: 0,
    transcriptByteLength: tapBytes,
    transcriptEofObserved: true,
    transcriptSha256: tapSha256,
    version: 13,
  };
  const containment = makeContainment(target, deadlines);
  const cleanupSemantic = {
    afterNaturalTerminal: true,
    allOwnedDescriptorsClosed: true,
    allOwnedHandlesClosed: true,
    ambiguousIdentity: false,
    cleanupObserverIdentity: digest(`cleanup-observer-${target}`),
    containmentObjectDestroyed: true,
    deadlineArmedEvenOnSignalFailure: true,
    executionArtifactPostDescriptor: clone(helper),
    finishedAtMonotonicMs: deadlines.containmentEmptyAtMonotonicMs,
    noLeak: true,
    noLiveDescendants: true,
    noZombieDescendants: true,
    numericPidCleanupUsed: false,
    observationOnly: true,
    startedAtMonotonicMs: deadlines.teardownStartedAtMonotonicMs,
  };
  const cleanup = withSemanticDigest(
    cleanupSemantic, "cleanupObservationSha256",
  );
  const readyFrame = [
    "IAT_B3_CONTAINMENT_READY_V1",
    `protocol=${IAT_B3_NATIVE_RUNTIME_CONTAINMENT_CONTROL_PROTOCOL}`,
    `contract=${checkpoint.containmentContractSha256}`,
    "startup=10000",
    `execution=${deadlines.executionMs}`,
    "finalization=5000",
    "teardown=15000",
  ].join(" ");
  const finalFrame = [
    "IAT_B3_CONTAINMENT_FINAL_V1",
    `protocol=${IAT_B3_NATIVE_RUNTIME_CONTAINMENT_CONTROL_PROTOCOL}`,
    `contract=${checkpoint.containmentContractSha256}`,
    "outcome=PASS",
    "elapsed=1300",
    "rootTerminal=1",
    "rootExit=0",
    "rootSignal=0",
    "reaped=1",
    "empty=1",
    "leak=0",
    "zombies=0",
    "resumed=1",
    "intervention=0",
    "startupExpired=0",
    "executionExpired=0",
    "finalizationExpired=0",
    "teardownExpired=0",
    "strictTap=1",
    "protocolValid=1",
    "absence=1",
    `stdoutBytes=${streams.stdout.byteLength}`,
    `stdoutSha256=${streams.stdout.sha256}`,
    "stdoutTruncated=0",
    `stderrBytes=${streams.stderr.byteLength}`,
    `stderrSha256=${streams.stderr.sha256}`,
    "stderrTruncated=0",
  ].join(" ");
  const control = {
    boundedReadTurnBytes: 4_096,
    containmentIdentityRetainedThroughArbitration: true,
    eofObserved: true,
    eofObservedAtMonotonicMs: deadlines.receiptCommittedAtMonotonicMs - 25,
    finalCommittedAfterEof: true,
    finalFrame,
    finalObservedAtMonotonicMs: deadlines.containmentEmptyAtMonotonicMs + 50,
    firstOutcomeWriteOnce: true,
    noTrailingBytes: true,
    protocol: IAT_B3_NATIVE_RUNTIME_CONTAINMENT_CONTROL_PROTOCOL,
    readyFrame,
    readyObservedAtMonotonicMs: deadlines.watchdogsArmedAtMonotonicMs - 50,
    statusChannelNonblocking: true,
    timerPriorityBeforeStatus: true,
    transcriptSha256: sha256(Buffer.from(`${readyFrame}\n${finalFrame}\n`, "ascii")),
  };
  const semantic = {
    authorityBoundary: {
      callerSuppliedAccepted: false,
      declaredSource: "EXTERNAL_OBSERVER_OWNED_DIRECT_BYTES_ONLY",
      embeddedAuthorityAccepted: false,
      injectedAccepted: false,
      selfAuthoredAccepted: false,
      selfDigestAuthoritative: false,
      syntheticAccepted: false,
    },
    checkpoint,
    cleanup,
    compileProvenance,
    containment,
    control,
    deadlines,
    invocation,
    observerSessionId,
    platform: makePlatform(target),
    receiptSequence: 1,
    runtimeArtifact,
    schema: IAT_B3_NATIVE_RUNTIME_CONTAINMENT_RECEIPT_SCHEMA,
    status: "UNTRUSTED_OBSERVER_CANDIDATE_HOLD",
    streams,
    tap,
    target,
    truthEnvelope: {
      checkpointObserved: false,
      compileProvenanceObserved: false,
      devnetAuthorized: false,
      devnetExecuted: false,
      mainnetAuthorized: false,
      mainnetExecuted: false,
      networkUsed: false,
      publicClaimAuthorized: false,
      releaseAuthorized: false,
      rpcUsed: false,
      runtimeEvidenceObserved: false,
      runtimeExecuted: false,
      sameObjectRuntimeObserved: false,
      signed: false,
      sourceAuthorized: false,
    },
  };
  return withSemanticDigest(semantic, "semanticSha256");
}

function canonicalBytes(candidate) {
  return Buffer.from(canonicalJson(candidate), "utf8");
}

function expectBlocked(candidate, code) {
  const result = assessNativeRuntimeContainmentReceipt(canonicalBytes(candidate));
  assert.equal(result.status, "HOLD");
  assert.equal(result.valid, false);
  assert.equal(result.ready, false);
  assert.equal(result.complete, false);
  assert.equal(result.candidateSchemaConformant, false);
  assert.equal(result.blockers.includes(code), true, result.blockers.join("\n"));
}

test("default assessment is an unconditional all-false HOLD", () => {
  const result = createNativeRuntimeContainmentReceiptHold();
  assert.equal(result.schema, IAT_B3_NATIVE_RUNTIME_CONTAINMENT_ASSESSMENT_SCHEMA);
  assert.equal(result.status, "HOLD");
  assert.equal(result.ready, false);
  assert.equal(result.complete, false);
  assert.equal(result.valid, false);
  assert.equal(result.candidateSchemaConformant, false);
  for (const [name, value] of Object.entries(result)) {
    if (name.endsWith("Observed") || name.endsWith("Executed")
      || name.endsWith("Authorized") || ["networkUsed", "rpcUsed", "keyUsed", "signed"].includes(name)) {
      assert.equal(value, false, name);
    }
  }
  assert.equal(result.blockers.includes("BP07_SOURCE_ONLY_NO_EXECUTION_API"), true);
  assert.equal(result.blockers.includes("RUNTIME_EVIDENCE_NOT_OBSERVED"), true);
});

test("canonical Linux and Windows candidates remain all-false nonauthoritative HOLD", () => {
  for (const target of IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TARGETS) {
    const result = assessNativeRuntimeContainmentReceipt(
      canonicalBytes(makeCandidate(target)),
    );
    assert.equal(result.candidateSchemaConformant, false, target);
    assert.equal(
      result.candidateDisposition,
      "STRUCTURAL_CANDIDATE_NONAUTHORITATIVE",
      target,
    );
    assert.equal(result.status, "HOLD", target);
    assert.equal(result.valid, false, target);
    assert.equal(result.runtimeEvidenceObserved, false, target);
    assert.equal(result.sameObjectRuntimeObserved, false, target);
    assert.equal(result.platformCapabilitiesObserved, false, target);
    assert.equal(result.releaseAuthorized, false, target);
    assert.equal(Object.values(result).filter(
      (value) => typeof value === "boolean",
    ).every((value) => value === false), true, target);
  }
});

test("objects, strings, malformed UTF-8, noncanonical JSON and duplicate keys fail closed", () => {
  const candidate = makeCandidate();
  for (const value of [undefined, null, candidate, canonicalJson(candidate)]) {
    const result = assessNativeRuntimeContainmentReceipt(value);
    assert.equal(result.candidateSchemaConformant, false);
    assert.equal(result.blockers.includes("RUNTIME_RECEIPT_DIRECT_BYTES_REQUIRED_HOLD"), true);
  }
  const malformed = assessNativeRuntimeContainmentReceipt(
    Uint8Array.from([0xc3, 0x28]),
  );
  assert.equal(malformed.blockers.includes("RUNTIME_RECEIPT_UTF8_HOLD"), true);
  const pretty = assessNativeRuntimeContainmentReceipt(
    Buffer.from(JSON.stringify(candidate, null, 2), "utf8"),
  );
  assert.equal(pretty.blockers.includes("RUNTIME_RECEIPT_NONCANONICAL_HOLD"), true);
  const duplicate = assessNativeRuntimeContainmentReceipt(
    Buffer.from('{"schema":"first","schema":"second"}', "utf8"),
  );
  assert.equal(duplicate.blockers.includes("JSON_DUPLICATE_KEY_HOLD"), true);
});

test("receipt schema rejects unknown, missing, target-mixed and truth-promoting fields", () => {
  const unknown = makeCandidate();
  unknown.callerPass = true;
  expectBlocked(unknown, "RUNTIME_RECEIPT_EXACT_SCHEMA_HOLD");

  const missing = makeCandidate();
  delete missing.cleanup;
  expectBlocked(missing, "RUNTIME_RECEIPT_EXACT_SCHEMA_HOLD");

  const targetMix = makeCandidate();
  targetMix.checkpoint.target = "windows-x64-gnu";
  expectBlocked(targetMix, "RUNTIME_CHECKPOINT_TARGET_MIX_HOLD");

  const truth = makeCandidate();
  truth.truthEnvelope.runtimeEvidenceObserved = true;
  expectBlocked(truth, "RUNTIME_TRUTH_ENVELOPE_PROMOTION_HOLD");

  const authority = makeCandidate();
  authority.authorityBoundary.selfDigestAuthoritative = true;
  expectBlocked(authority, "RUNTIME_AUTHORITY_BOUNDARY_ESCALATION_HOLD");
});

test("compile receipt and runtime receipt remain separate and cross-bound", () => {
  const embeddedRuntime = makeCandidate();
  embeddedRuntime.compileProvenance.runtimeEvidenceIncluded = true;
  expectBlocked(embeddedRuntime, "RUNTIME_COMPILE_PROVENANCE_SEPARATION_HOLD");

  const receiptSwap = makeCandidate();
  receiptSwap.compileProvenance.receiptSha256 = digest("stale-compile-receipt");
  expectBlocked(receiptSwap, "RUNTIME_COMPILE_RECEIPT_CROSS_BINDING_HOLD");

  const artifactClaim = makeCandidate();
  artifactClaim.compileProvenance.artifactClaimSha256 = digest("forged-claim");
  expectBlocked(artifactClaim, "RUNTIME_COMPILE_RECEIPT_CROSS_BINDING_HOLD");
});

test("artifact path, hash or object substitution cannot satisfy same-object runtime", () => {
  const pathSwap = makeCandidate();
  pathSwap.runtimeArtifact.openedDescriptor.realpath = "/bp07/alias/helper";
  expectBlocked(pathSwap, "RUNTIME_ARTIFACT_SAME_OBJECT_BINDING_HOLD");

  const objectSwap = makeCandidate();
  objectSwap.runtimeArtifact.executionDescriptor.objectIdentity.inode = "99999";
  objectSwap.runtimeArtifact.executionDescriptor.fileId = "8:1:99999:31";
  expectBlocked(objectSwap, "RUNTIME_ARTIFACT_SAME_OBJECT_BINDING_HOLD");

  const pathLaunch = makeCandidate();
  pathLaunch.runtimeArtifact.pathLookupAfterOpen = true;
  expectBlocked(pathLaunch, "RUNTIME_ARTIFACT_SAME_OBJECT_BINDING_HOLD");

  const windowsUnsupported = makeCandidate("windows-x64-gnu");
  windowsUnsupported.runtimeArtifact.bindingMethod = "CREATEPROCESSW_PATH";
  expectBlocked(windowsUnsupported, "RUNTIME_ARTIFACT_SAME_OBJECT_BINDING_HOLD");
});

test("platform capability downgrades and numeric-PID cleanup fail closed", () => {
  const linux = makeCandidate();
  linux.platform.capabilities.completeWaitClasses = false;
  expectBlocked(linux, "RUNTIME_PLATFORM_CAPABILITY_UNOBSERVED_HOLD");

  const pidCleanup = makeCandidate();
  pidCleanup.platform.capabilities.numericPidCleanupUsed = true;
  expectBlocked(pidCleanup, "RUNTIME_NUMERIC_PID_CLEANUP_FORBIDDEN_HOLD");

  const windows = makeCandidate("windows-x64-gnu");
  windows.platform.capabilities.activeProcessZero = false;
  expectBlocked(windows, "RUNTIME_PLATFORM_CAPABILITY_UNOBSERVED_HOLD");
});

test("argv, environment and FD/handle inventories are exact and alias-free", () => {
  const argv = makeCandidate();
  argv.invocation.helperArgv.splice(1, 0, "--extra");
  expectBlocked(argv, "RUNTIME_HELPER_ARGV_EXACT_BINDING_HOLD");

  const environment = makeCandidate();
  environment.invocation.environment.LD_PRELOAD = "/tmp/injected.so";
  expectBlocked(environment, "RUNTIME_INVOCATION_ENVIRONMENT_EXACT_SCHEMA_HOLD");

  const environmentAlias = makeCandidate();
  environmentAlias.invocation.environment.HOME = environmentAlias.invocation.cwd;
  expectBlocked(environmentAlias, "RUNTIME_INVOCATION_ROLE_PATH_OVERLAP_HOLD");

  const role = makeCandidate();
  role.invocation.descriptorBindings[0].role = "numeric-pid";
  expectBlocked(role, "RUNTIME_NUMERIC_PID_BINDING_FORBIDDEN_HOLD");

  const alias = makeCandidate("windows-x64-gnu");
  alias.invocation.descriptorBindings[3].value =
    alias.invocation.descriptorBindings[0].value;
  expectBlocked(alias, "RUNTIME_DESCRIPTOR_BINDING_DUPLICATE_OR_ALIAS_HOLD");

  const inheritedJob = makeCandidate("windows-x64-gnu");
  inheritedJob.invocation.descriptorBindings.find(
    (binding) => binding.role === "job-object",
  ).inheritedByWorkload = true;
  expectBlocked(inheritedJob, "RUNTIME_DESCRIPTOR_BINDING_OWNERSHIP_HOLD");
});

test("execution, outer, finalization and observation-only teardown clocks are immutable", () => {
  const extended = makeCandidate();
  extended.deadlines.teardownExtendsExecution = true;
  expectBlocked(extended, "RUNTIME_DEADLINE_POLICY_HOLD");

  const mutable = makeCandidate();
  mutable.deadlines.executionDeadlineImmutable = false;
  expectBlocked(mutable, "RUNTIME_DEADLINE_POLICY_HOLD");

  const lateWatchdog = makeCandidate();
  lateWatchdog.deadlines.watchdogsArmedAtMonotonicMs = 1_100;
  expectBlocked(lateWatchdog, "RUNTIME_DEADLINE_DERIVATION_HOLD");

  const lateCleanup = makeCandidate();
  lateCleanup.deadlines.containmentEmptyAtMonotonicMs =
    lateCleanup.deadlines.teardownDeadlineAtMonotonicMs;
  expectBlocked(lateCleanup, "RUNTIME_DEADLINE_CHRONOLOGY_HOLD");
});

test("READY/FINAL arbitration requires timer priority, bounded reads and EOF before commit", () => {
  const blocking = makeCandidate();
  blocking.control.statusChannelNonblocking = false;
  expectBlocked(blocking, "RUNTIME_CONTROL_ARBITRATION_HOLD");

  const unbounded = makeCandidate();
  unbounded.control.boundedReadTurnBytes = 65_536;
  expectBlocked(unbounded, "RUNTIME_CONTROL_ARBITRATION_HOLD");

  const timerLast = makeCandidate();
  timerLast.control.timerPriorityBeforeStatus = false;
  expectBlocked(timerLast, "RUNTIME_CONTROL_ARBITRATION_HOLD");

  const earlyCommit = makeCandidate();
  earlyCommit.control.finalCommittedAfterEof = false;
  expectBlocked(earlyCommit, "RUNTIME_CONTROL_ARBITRATION_HOLD");

  const readyRace = makeCandidate();
  readyRace.control.readyObservedAtMonotonicMs =
    readyRace.deadlines.workloadStartedAtMonotonicMs;
  expectBlocked(readyRace, "RUNTIME_CONTROL_CHRONOLOGY_HOLD");
});

test("control frames require exact PASS success state without timeout or trailing data", () => {
  const reordered = makeCandidate();
  reordered.control.readyFrame = reordered.control.readyFrame.replace(
    / protocol=([^ ]+) contract=([^ ]+)/u,
    " contract=$2 protocol=$1",
  );
  expectBlocked(reordered, "RUNTIME_READY_FRAME_HOLD");

  const nonzero = makeCandidate();
  nonzero.control.finalFrame = nonzero.control.finalFrame.replace(
    "rootExit=0", "rootExit=7",
  );
  expectBlocked(nonzero, "RUNTIME_FINAL_SUCCESS_STATE_HOLD");

  const timeout = makeCandidate();
  timeout.control.finalFrame = timeout.control.finalFrame.replace(
    "executionExpired=0", "executionExpired=1",
  );
  expectBlocked(timeout, "RUNTIME_FINAL_SUCCESS_STATE_HOLD");

  const trailing = makeCandidate();
  trailing.control.noTrailingBytes = false;
  expectBlocked(trailing, "RUNTIME_CONTROL_ARBITRATION_HOLD");

  const overwrite = makeCandidate();
  overwrite.control.firstOutcomeWriteOnce = false;
  expectBlocked(overwrite, "RUNTIME_CONTROL_ARBITRATION_HOLD");
});

test("strict TAP rejects fail, skip, todo, directives, bailout and transcript drift", () => {
  for (const [field, value] of [
    ["fail", 1], ["skipped", 1], ["todo", 1], ["cancelled", 1],
    ["directives", true], ["bailout", true], ["noTrailingLines", false],
  ]) {
    const candidate = makeCandidate();
    candidate.tap[field] = value;
    expectBlocked(candidate, "RUNTIME_TAP_STRICT_SEMANTICS_HOLD");
  }
  const transcript = makeCandidate();
  transcript.tap.transcriptSha256 = digest("replayed-tap");
  expectBlocked(transcript, "RUNTIME_TAP_STRICT_SEMANTICS_HOLD");
});

test("leaks, incomplete reaping, abnormal PID1 and missing ACTIVE_PROCESS_ZERO fail", () => {
  const leak = makeCandidate();
  leak.containment.descendantLeakObserved = true;
  expectBlocked(leak, "RUNTIME_CONTAINMENT_SUCCESS_STATE_HOLD");

  const waitClass = makeCandidate();
  waitClass.containment.platformEvidence.allWaitFlags = ["WEXITED", "__WALL"];
  expectBlocked(waitClass, "RUNTIME_LINUX_CONTAINMENT_SEMANTICS_HOLD");

  const abnormalPid1 = makeCandidate();
  abnormalPid1.containment.platformEvidence.pid1TerminalCode = "CLD_KILLED";
  expectBlocked(abnormalPid1, "RUNTIME_LINUX_CONTAINMENT_SEMANTICS_HOLD");

  const active = makeCandidate("windows-x64-gnu");
  active.containment.platformEvidence.activeProcessZeroObserved = false;
  expectBlocked(active, "RUNTIME_WINDOWS_ACTIVE_ZERO_SEMANTICS_HOLD");

  const jobKill = makeCandidate("windows-x64-gnu");
  jobKill.containment.platformEvidence.jobCloseUsedToKill = true;
  expectBlocked(jobKill, "RUNTIME_WINDOWS_ACTIVE_ZERO_SEMANTICS_HOLD");
});

test("cleanup is observation-only, identity-bound and complete before commitment", () => {
  const signalDependent = makeCandidate();
  signalDependent.cleanup.deadlineArmedEvenOnSignalFailure = false;
  expectBlocked(signalDependent, "RUNTIME_CLEANUP_OBSERVATION_SEMANTICS_HOLD");

  const live = makeCandidate();
  live.cleanup.noLiveDescendants = false;
  expectBlocked(live, "RUNTIME_CLEANUP_OBSERVATION_SEMANTICS_HOLD");

  const artifactReplay = makeCandidate();
  artifactReplay.cleanup.executionArtifactPostDescriptor.sha256 =
    digest("post-cleanup-substitution");
  expectBlocked(artifactReplay, "RUNTIME_CLEANUP_OBSERVATION_SEMANTICS_HOLD");

  const ambiguous = makeCandidate();
  ambiguous.cleanup.ambiguousIdentity = true;
  expectBlocked(ambiguous, "RUNTIME_CLEANUP_OBSERVATION_SEMANTICS_HOLD");
});

test("semantic self-digests detect mutation but never become authority", () => {
  const candidate = makeCandidate();
  candidate.receiptSequence = 2;
  expectBlocked(candidate, "RUNTIME_RECEIPT_SEMANTIC_DIGEST_HOLD");

  const conformant = assessNativeRuntimeContainmentReceipt(
    canonicalBytes(makeCandidate()),
  );
  assert.equal(conformant.candidateSchemaConformant, false);
  assert.equal(
    conformant.candidateDisposition,
    "STRUCTURAL_CANDIDATE_NONAUTHORITATIVE",
  );
  assert.equal(conformant.receiptSourceObserved, false);
  assert.equal(conformant.runtimeEvidenceObserved, false);
  assert.equal(conformant.blockers.includes(
    "CALLER_INJECTED_SYNTHETIC_NONAUTHORITATIVE",
  ), true);
});

test("schema policy exactly mirrors contract constants and remains all-false", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  assert.equal(schema.receiptSchema,
    IAT_B3_NATIVE_RUNTIME_CONTAINMENT_RECEIPT_SCHEMA);
  assert.equal(schema.assessmentSchema,
    IAT_B3_NATIVE_RUNTIME_CONTAINMENT_ASSESSMENT_SCHEMA);
  assert.deepEqual(schema.targets, IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TARGETS);
  assert.deepEqual(schema.topLevelFields,
    IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TOP_LEVEL_FIELDS);
  assert.deepEqual(
    schema.platformCapabilityFields["linux-x64-musl"],
    IAT_B3_NATIVE_RUNTIME_CONTAINMENT_LINUX_CAPABILITY_FIELDS,
  );
  assert.deepEqual(
    schema.platformCapabilityFields["windows-x64-gnu"],
    IAT_B3_NATIVE_RUNTIME_CONTAINMENT_WINDOWS_CAPABILITY_FIELDS,
  );
  assert.deepEqual(schema.tapManifest, {
    ...IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TAP_MANIFEST,
    version: 13,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
    bailout: false,
    directives: false,
    trailingLines: false,
  });
  assert.equal(schema.controlProtocol.schema,
    IAT_B3_NATIVE_RUNTIME_CONTAINMENT_CONTROL_PROTOCOL);
  assert.equal(schema.status, "HOLD");
  assert.equal(schema.ready, false);
  assert.equal(schema.complete, false);
  assert.equal(schema.operative, false);
  assert.equal(schema.executionApi, false);
  assert.equal(Object.values(schema.assessmentTruth).every(
    (value) => value === false,
  ), true);
});

test("source exposes no execution, network, shell or private-material surface", () => {
  const source = readFileSync(SOURCE_PATH, "utf8");
  for (const forbidden of [
    /node:child_process/u,
    /\bspawn(?:Sync)?\s*\(/u,
    /\bexecFile(?:Sync)?\s*\(/u,
    /\bexec(?:Sync)?\s*\(/u,
    /node:(?:net|http|https|tls|dgram|dns)/u,
    /\bfetch\s*\(/u,
    /\bWebSocket\b/u,
    /\bprivateKey\b/u,
    /\bsecretKey\b/u,
    /\btaskkill\b/iu,
    /\bkill\s*\(/u,
  ]) assert.doesNotMatch(source, forbidden);
  assert.match(source, /CALLER_INJECTED_SYNTHETIC_NONAUTHORITATIVE/u);
  assert.match(source, /BP07_SOURCE_ONLY_NO_EXECUTION_API/u);
  assert.match(source, /status:\s*"HOLD"/u);
  assert.match(source, /valid:\s*false/u);
  assert.match(source, /runtimeEvidenceObserved:\s*false/u);
  assert.match(source, /sameObjectRuntimeObserved:\s*false/u);
});

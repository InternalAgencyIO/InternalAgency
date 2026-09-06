import { posix, win32 } from "node:path";
import { TextDecoder } from "node:util";

import {
  IAT_B3_NATIVE_CONTAINMENT_RECEIPT_SCHEMA,
  IAT_B3_NATIVE_CONTAINMENT_TIMING,
  canonicalJson,
  parseJsonRejectingDuplicateKeys,
  semanticSha256,
  sha256,
} from "./iat-b3-mandatory-ci-containment-contract.mjs";

export const IAT_B3_NATIVE_RUNTIME_CONTAINMENT_RECEIPT_SCHEMA =
  "iat-b3-mandatory-ci-runtime-containment-receipt/v1";
export const IAT_B3_NATIVE_RUNTIME_CONTAINMENT_ASSESSMENT_SCHEMA =
  "iat-b3-mandatory-ci-runtime-containment-assessment/v1";
export const IAT_B3_NATIVE_RUNTIME_CONTAINMENT_OBSERVER_SCHEMA =
  "iat-b3-mandatory-ci-runtime-containment-observer/v1";
export const IAT_B3_NATIVE_RUNTIME_CONTAINMENT_CONTROL_PROTOCOL =
  "iat-b3-mandatory-ci-containment/v1";

export const IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TARGETS = Object.freeze([
  "linux-x64-musl",
  "windows-x64-gnu",
]);

export const IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TAP_MANIFEST = Object.freeze({
  path: "projects/star-ascent/site/tests/iat-b3-mandatory-ci-containment.test.mjs",
  sha256: "437571821a14eb60de550bac204b2f8e3885766760a30f32296db57076df2813",
  byteLength: 18_044,
  orderedNamesSha256:
    "7262d1251645ce869697b6afc6aa446951c3f72184b14a772a4fa2553c846e33",
  orderedNamesJsonBytes: 1_855,
  caseCount: 30,
});

export const IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TOP_LEVEL_FIELDS =
  Object.freeze([
    "authorityBoundary",
    "checkpoint",
    "cleanup",
    "compileProvenance",
    "containment",
    "control",
    "deadlines",
    "invocation",
    "observerSessionId",
    "platform",
    "receiptSequence",
    "runtimeArtifact",
    "schema",
    "semanticSha256",
    "status",
    "streams",
    "tap",
    "target",
    "truthEnvelope",
  ]);

export const IAT_B3_NATIVE_RUNTIME_CONTAINMENT_LINUX_CAPABILITY_FIELDS =
  Object.freeze([
    "clone3MountNamespace",
    "clone3PidNamespace",
    "clone3UserNamespace",
    "completeWaitClasses",
    "namespaceDestructionObserved",
    "numericPidCleanupUsed",
    "pdeathsig",
    "pidNamespaceRootIsPid1",
    "pidfd",
    "watchdogArmedBeforeStart",
  ]);

export const IAT_B3_NATIVE_RUNTIME_CONTAINMENT_WINDOWS_CAPABILITY_FIELDS =
  Object.freeze([
    "activeProcessZero",
    "assignedBeforeResume",
    "breakawayDisabled",
    "completionPort",
    "createSuspended",
    "killOnClose",
    "numericPidCleanupUsed",
    "sameObjectImageLaunch",
    "startupInfoExJobList",
    "watchdogArmedBeforeStart",
  ]);

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const GIT_OBJECT_PATTERN = /^[0-9a-f]{40}$/u;
const DECIMAL_PATTERN = /^(?:0|[1-9][0-9]*)$/u;
const WINDOWS_HANDLE_PATTERN = /^0x[0-9A-F]+$/u;
const EMPTY_SHA256 = sha256(Buffer.alloc(0));
const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const CONTROL_READ_TURN_BYTES = 4_096;

const REQUIRED_LINUX_BINDING_ROLES = Object.freeze([
  "control-channel",
  "helper-executable",
  "stderr-channel",
  "stdout-channel",
  "workload-executable",
]);

const REQUIRED_WINDOWS_BINDING_ROLES = Object.freeze([
  "completion-port",
  "control-channel",
  "helper-executable",
  "job-object",
  "stderr-channel",
  "stdout-channel",
  "workload-executable",
]);

const DESCRIPTOR_BINDING_POLICY = Object.freeze({
  "completion-port": Object.freeze({
    owner: "HELPER", inheritedByHelper: false, inheritedByWorkload: false,
  }),
  "control-channel": Object.freeze({
    owner: "OBSERVER", inheritedByHelper: true, inheritedByWorkload: false,
  }),
  "helper-executable": Object.freeze({
    owner: "OBSERVER", inheritedByHelper: false, inheritedByWorkload: false,
  }),
  "job-object": Object.freeze({
    owner: "HELPER", inheritedByHelper: false, inheritedByWorkload: false,
  }),
  "stderr-channel": Object.freeze({
    owner: "HELPER", inheritedByHelper: false, inheritedByWorkload: true,
  }),
  "stdout-channel": Object.freeze({
    owner: "HELPER", inheritedByHelper: false, inheritedByWorkload: true,
  }),
  "workload-executable": Object.freeze({
    owner: "HELPER", inheritedByHelper: false, inheritedByWorkload: false,
  }),
});

const ASSESSMENT_BLOCKERS = Object.freeze([
  "BP07_SOURCE_ONLY_NO_EXECUTION_API",
  "CALLER_INJECTED_SYNTHETIC_NONAUTHORITATIVE",
  "DIRECT_CHECKPOINT_OBSERVATION_REQUIRED",
  "DIRECT_CLEANUP_OBSERVATION_REQUIRED",
  "DIRECT_COMPILE_RECEIPT_OBSERVATION_REQUIRED",
  "DIRECT_PLATFORM_CAPABILITY_OBSERVATION_REQUIRED",
  "DIRECT_RECEIPT_SOURCE_OBSERVATION_REQUIRED",
  "DIRECT_SAME_OBJECT_RUNTIME_OBSERVATION_REQUIRED",
  "DIRECT_TAP_TRANSCRIPT_OBSERVATION_REQUIRED",
  "RUNTIME_EVIDENCE_NOT_OBSERVED",
]);

function fail(code, detail = undefined) {
  const error = new Error(code);
  error.code = code;
  if (detail !== undefined) error.detail = detail;
  throw error;
}

function plainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function assertExactKeys(value, expected, code) {
  if (!plainRecord(value)
    || canonicalJson(Object.keys(value).sort())
      !== canonicalJson([...expected].sort())) fail(code);
}

function assertSha(value, code) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) fail(code);
}

function assertGitObject(value, code) {
  if (typeof value !== "string" || !GIT_OBJECT_PATTERN.test(value)) fail(code);
}

function assertSafeUnsigned(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) fail(code);
}

function checkedAdd(left, right, code) {
  assertSafeUnsigned(left, code);
  assertSafeUnsigned(right, code);
  const result = left + right;
  if (!Number.isSafeInteger(result)) fail(code);
  return result;
}

function assertCanonicalTargetPath(value, target, code) {
  if (typeof value !== "string" || value.includes("\0") || value.length < 3
    || value.length > 32_767) {
    fail(code);
  }
  if (target === "linux-x64-musl") {
    if (!value.startsWith("/") || value.includes("\\")
      || posix.normalize(value) !== value || value.includes("//")) fail(code);
    return;
  }
  if (!/^[A-Z]:\\[^\0]+$/u.test(value) || value.includes("/")
    || win32.normalize(value) !== value) fail(code);
  const segments = value.slice(3).split("\\");
  if (segments.some((segment) => segment.length < 1 || /[. ]$/u.test(segment)
    || segment.includes(":")
    || /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu.test(segment))) {
    fail(code);
  }
}

function targetPathKey(value, target) {
  return target === "windows-x64-gnu" ? value.toLowerCase() : value;
}

function targetPathsDisjoint(left, right, target) {
  const leftKey = targetPathKey(left, target);
  const rightKey = targetPathKey(right, target);
  const separator = target === "windows-x64-gnu" ? "\\" : "/";
  return leftKey !== rightKey
    && !rightKey.startsWith(`${leftKey}${separator}`)
    && !leftKey.startsWith(`${rightKey}${separator}`);
}

function assertIdentity(identity, target, code) {
  if (target === "linux-x64-musl") {
    assertExactKeys(identity, ["deviceId", "inode", "kind", "mountId"], code);
    if (identity.kind !== "LINUX_FILE"
      || !/^(?:0|[1-9][0-9]*):(?:0|[1-9][0-9]*)$/u.test(identity.deviceId)
      || !/^[1-9][0-9]*$/u.test(identity.inode)
      || !/^[1-9][0-9]*$/u.test(identity.mountId)) fail(code);
    return `${identity.deviceId}:${identity.inode}:${identity.mountId}`;
  }
  assertExactKeys(identity,
    ["fileId128", "kind", "volumeSerialNumber"], code);
  if (identity.kind !== "WINDOWS_FILE"
    || !/^[0-9A-F]{32}$/u.test(identity.fileId128)
    || !/^[0-9A-F]{8}$/u.test(identity.volumeSerialNumber)) fail(code);
  return `${identity.volumeSerialNumber}:${identity.fileId128}`;
}

function assertArtifactDescriptor(descriptor, target, code) {
  assertExactKeys(descriptor,
    ["byteLength", "fileId", "objectIdentity", "realpath", "sha256"], code);
  if (!Number.isSafeInteger(descriptor.byteLength) || descriptor.byteLength < 1
    || typeof descriptor.fileId !== "string" || descriptor.fileId.length < 1) {
    fail(code);
  }
  assertSha(descriptor.sha256, code);
  assertCanonicalTargetPath(descriptor.realpath, target, code);
  const expectedFileId = assertIdentity(descriptor.objectIdentity, target, code);
  if (descriptor.fileId !== expectedFileId) fail(code);
}

function sameArtifact(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function assertSemanticDigest(value, field, code) {
  assertSha(value[field], code);
  const { [field]: declared, ...semantic } = value;
  if (semanticSha256(semantic) !== declared) fail(code);
}

function validateCheckpoint(checkpoint, target) {
  assertExactKeys(checkpoint, [
    "buildPlanSha256", "commitSha", "compileReceiptSha256",
    "containmentContractSha256", "policySha256", "sourceClosureSha256",
    "target", "toolchainClosureSha256", "treeSha",
  ], "RUNTIME_CHECKPOINT_EXACT_SCHEMA_HOLD");
  assertGitObject(checkpoint.commitSha, "RUNTIME_CHECKPOINT_COMMIT_HOLD");
  assertGitObject(checkpoint.treeSha, "RUNTIME_CHECKPOINT_TREE_HOLD");
  for (const field of [
    "buildPlanSha256", "compileReceiptSha256",
    "containmentContractSha256", "policySha256", "sourceClosureSha256",
    "toolchainClosureSha256",
  ]) assertSha(checkpoint[field], "RUNTIME_CHECKPOINT_DIGEST_HOLD");
  if (checkpoint.target !== target) fail("RUNTIME_CHECKPOINT_TARGET_MIX_HOLD");
}

function validateCompileProvenance(value, receipt) {
  assertExactKeys(value, [
    "artifactClaimSha256", "artifactDescriptor", "buildId",
    "observerSessionId", "receiptDescriptor", "receiptSha256",
    "runtimeEvidenceIncluded", "schema", "target",
  ], "RUNTIME_COMPILE_PROVENANCE_EXACT_SCHEMA_HOLD");
  if (value.schema !== IAT_B3_NATIVE_CONTAINMENT_RECEIPT_SCHEMA
    || value.target !== receipt.target
    || ![`${receipt.target}-A`, `${receipt.target}-B`].includes(value.buildId)
    || value.observerSessionId !== receipt.observerSessionId
    || value.runtimeEvidenceIncluded !== false) {
    fail("RUNTIME_COMPILE_PROVENANCE_SEPARATION_HOLD");
  }
  assertSha(value.receiptSha256, "RUNTIME_COMPILE_RECEIPT_SHA256_HOLD");
  assertSha(value.artifactClaimSha256,
    "RUNTIME_COMPILE_ARTIFACT_CLAIM_SHA256_HOLD");
  assertArtifactDescriptor(value.receiptDescriptor, receipt.target,
    "RUNTIME_COMPILE_RECEIPT_DESCRIPTOR_HOLD");
  assertArtifactDescriptor(value.artifactDescriptor, receipt.target,
    "RUNTIME_COMPILE_ARTIFACT_DESCRIPTOR_HOLD");
  if (value.receiptSha256 !== receipt.checkpoint.compileReceiptSha256
    || value.receiptDescriptor.sha256 !== value.receiptSha256
    || semanticSha256(value.artifactDescriptor) !== value.artifactClaimSha256) {
    fail("RUNTIME_COMPILE_RECEIPT_CROSS_BINDING_HOLD");
  }
}

function validateRuntimeArtifact(value, receipt) {
  assertExactKeys(value, [
    "bindingMethod", "compileDescriptor", "deleteMutationDenied",
    "executionDescriptor", "executionFromHeldObject", "heldObjectIdentity",
    "openedBeforeWatchdog", "openedDescriptor", "pathLookupAfterOpen",
    "postExecutionDescriptor", "postIdentityObserved", "sameObjectObserved",
    "writeMutationDenied",
  ], "RUNTIME_ARTIFACT_EXACT_SCHEMA_HOLD");
  for (const field of [
    "compileDescriptor", "openedDescriptor", "executionDescriptor",
    "postExecutionDescriptor",
  ]) assertArtifactDescriptor(value[field], receipt.target,
    "RUNTIME_ARTIFACT_DESCRIPTOR_HOLD");
  const expectedMethod = receipt.target === "linux-x64-musl"
    ? "FD_EXECVEAT_AT_EMPTY_PATH" : "HELD_IMAGE_SECTION_OBJECT";
  if (value.bindingMethod !== expectedMethod
    || value.openedBeforeWatchdog !== true
    || value.executionFromHeldObject !== true
    || value.pathLookupAfterOpen !== false
    || value.writeMutationDenied !== true
    || value.deleteMutationDenied !== true
    || value.postIdentityObserved !== true
    || value.sameObjectObserved !== true
    || value.heldObjectIdentity !== value.executionDescriptor.fileId
    || !sameArtifact(value.compileDescriptor,
      receipt.compileProvenance.artifactDescriptor)
    || !sameArtifact(value.compileDescriptor, value.openedDescriptor)
    || !sameArtifact(value.compileDescriptor, value.executionDescriptor)
    || !sameArtifact(value.compileDescriptor, value.postExecutionDescriptor)) {
    fail("RUNTIME_ARTIFACT_SAME_OBJECT_BINDING_HOLD");
  }
}

function validatePlatform(value, receipt) {
  assertExactKeys(value,
    ["arch", "capabilities", "capabilityObservationSha256", "os"],
    "RUNTIME_PLATFORM_EXACT_SCHEMA_HOLD");
  const linux = receipt.target === "linux-x64-musl";
  if (value.os !== (linux ? "linux" : "windows") || value.arch !== "x64") {
    fail("RUNTIME_PLATFORM_TARGET_HOLD");
  }
  const fields = linux
    ? IAT_B3_NATIVE_RUNTIME_CONTAINMENT_LINUX_CAPABILITY_FIELDS
    : IAT_B3_NATIVE_RUNTIME_CONTAINMENT_WINDOWS_CAPABILITY_FIELDS;
  assertExactKeys(value.capabilities, fields,
    "RUNTIME_PLATFORM_CAPABILITY_EXACT_SCHEMA_HOLD");
  for (const [name, observed] of Object.entries(value.capabilities)) {
    if (name === "numericPidCleanupUsed") {
      if (observed !== false) fail("RUNTIME_NUMERIC_PID_CLEANUP_FORBIDDEN_HOLD");
    } else if (observed !== true) {
      fail("RUNTIME_PLATFORM_CAPABILITY_UNOBSERVED_HOLD", name);
    }
  }
  if (semanticSha256(value.capabilities) !== value.capabilityObservationSha256) {
    fail("RUNTIME_PLATFORM_CAPABILITY_DIGEST_HOLD");
  }
}

function validateEnvironment(environment, target, cwd) {
  const fields = [
    "HOME", "LANG", "LC_ALL", "PATH", "SOURCE_DATE_EPOCH",
    "TEMP", "TMP", "TMPDIR", "TZ",
  ];
  if (target === "windows-x64-gnu") fields.push("SYSTEMROOT");
  assertExactKeys(environment, fields,
    "RUNTIME_INVOCATION_ENVIRONMENT_EXACT_SCHEMA_HOLD");
  if (environment.LANG !== "C" || environment.LC_ALL !== "C"
    || environment.PATH !== "" || environment.SOURCE_DATE_EPOCH !== "0"
    || environment.TZ !== "UTC"
    || environment.TEMP !== environment.TMP
    || environment.TMP !== environment.TMPDIR) {
    fail("RUNTIME_INVOCATION_ENVIRONMENT_VALUE_HOLD");
  }
  for (const field of ["HOME", "TEMP", "TMP", "TMPDIR"])
    assertCanonicalTargetPath(environment[field], target,
      "RUNTIME_INVOCATION_ENVIRONMENT_PATH_HOLD");
  const rolePaths = [environment.HOME, environment.TMPDIR, cwd];
  if (rolePaths.some((left, index) => rolePaths.some(
    (right, otherIndex) => otherIndex !== index
      && !targetPathsDisjoint(left, right, target),
  ))) fail("RUNTIME_INVOCATION_ROLE_PATH_OVERLAP_HOLD");
  if (target === "windows-x64-gnu") {
    assertCanonicalTargetPath(environment.SYSTEMROOT, target,
      "RUNTIME_INVOCATION_SYSTEMROOT_PATH_HOLD");
    if (rolePaths.some(
      (path) => !targetPathsDisjoint(path, environment.SYSTEMROOT, target),
    )) fail("RUNTIME_INVOCATION_SYSTEMROOT_OVERLAP_HOLD");
  }
}

function validateDescriptorBindings(bindings, receipt) {
  const expectedRoles = receipt.target === "linux-x64-musl"
    ? REQUIRED_LINUX_BINDING_ROLES : REQUIRED_WINDOWS_BINDING_ROLES;
  if (!Array.isArray(bindings) || bindings.length !== expectedRoles.length) {
    fail("RUNTIME_DESCRIPTOR_BINDING_SET_HOLD");
  }
  const roles = [];
  const values = new Set();
  const objectIds = new Set();
  for (const binding of bindings) {
    assertExactKeys(binding, [
      "closedBeforeStart", "inheritedByHelper", "inheritedByWorkload",
      "kind", "objectId", "owner", "role", "value",
    ], "RUNTIME_DESCRIPTOR_BINDING_EXACT_SCHEMA_HOLD");
    const expectedKind = receipt.target === "linux-x64-musl" ? "FD" : "HANDLE";
    if (binding.kind !== expectedKind
      || !["OBSERVER", "HELPER", "WORKLOAD"].includes(binding.owner)
      || typeof binding.role !== "string"
      || typeof binding.objectId !== "string" || binding.objectId.length < 1
      || typeof binding.inheritedByHelper !== "boolean"
      || typeof binding.inheritedByWorkload !== "boolean"
      || typeof binding.closedBeforeStart !== "boolean"
      || (expectedKind === "FD" && !DECIMAL_PATTERN.test(binding.value))
      || (expectedKind === "HANDLE"
        && !WINDOWS_HANDLE_PATTERN.test(binding.value))) {
      fail("RUNTIME_DESCRIPTOR_BINDING_VALUE_HOLD");
    }
    if ((expectedKind === "FD"
        && (!Number.isSafeInteger(Number(binding.value))
          || Number(binding.value) < 3))
      || (expectedKind === "HANDLE" && BigInt(binding.value) === 0n)) {
      fail("RUNTIME_DESCRIPTOR_BINDING_VALUE_HOLD");
    }
    if (binding.role !== "helper-executable"
      && !SHA256_PATTERN.test(binding.objectId)) {
      fail("RUNTIME_DESCRIPTOR_BINDING_OBJECT_ID_HOLD");
    }
    if (binding.role.includes("pid") || binding.role.includes("process-id")) {
      fail("RUNTIME_NUMERIC_PID_BINDING_FORBIDDEN_HOLD");
    }
    const policy = DESCRIPTOR_BINDING_POLICY[binding.role];
    if (!policy || binding.owner !== policy.owner
      || binding.inheritedByHelper !== policy.inheritedByHelper
      || binding.inheritedByWorkload !== policy.inheritedByWorkload
      || binding.closedBeforeStart !== false) {
      fail("RUNTIME_DESCRIPTOR_BINDING_OWNERSHIP_HOLD");
    }
    const valueKey = `${binding.owner}\0${binding.value}`;
    if (roles.includes(binding.role) || values.has(valueKey)
      || objectIds.has(binding.objectId)) {
      fail("RUNTIME_DESCRIPTOR_BINDING_DUPLICATE_OR_ALIAS_HOLD");
    }
    roles.push(binding.role);
    values.add(valueKey);
    objectIds.add(binding.objectId);
  }
  if (canonicalJson(roles) !== canonicalJson(expectedRoles)) {
    fail("RUNTIME_DESCRIPTOR_BINDING_ORDER_OR_ROLE_HOLD");
  }
  const executableBinding = bindings.find(
    (binding) => binding.role === "helper-executable",
  );
  if (executableBinding.objectId !== receipt.runtimeArtifact.heldObjectIdentity) {
    fail("RUNTIME_EXECUTABLE_DESCRIPTOR_BINDING_HOLD");
  }
}

function validateInvocation(value, receipt) {
  assertExactKeys(value, [
    "cwd", "descriptorBindings", "environment", "helperArgv",
    "invocationSha256", "workloadArgv",
  ], "RUNTIME_INVOCATION_EXACT_SCHEMA_HOLD");
  assertCanonicalTargetPath(value.cwd, receipt.target,
    "RUNTIME_INVOCATION_CWD_HOLD");
  validateEnvironment(value.environment, receipt.target, value.cwd);
  if (!Array.isArray(value.workloadArgv) || value.workloadArgv.length < 1
    || value.workloadArgv.length > 256
    || value.workloadArgv.some((argument) => typeof argument !== "string"
      || argument.length < 1 || argument.length > 32_768
      || argument.includes("\0"))) {
    fail("RUNTIME_WORKLOAD_ARGV_HOLD");
  }
  assertCanonicalTargetPath(value.workloadArgv[0], receipt.target,
    "RUNTIME_WORKLOAD_EXECUTABLE_PATH_HOLD");
  const timing = receipt.deadlines;
  const expectedHelperArgv = [
    receipt.runtimeArtifact.executionDescriptor.realpath,
    "--startup-ms", String(timing.startupMs),
    "--execution-ms", String(timing.executionMs),
    "--finalization-ms", String(timing.finalizationMs),
    "--teardown-ms", String(timing.teardownObservationMs),
    "--stdout-cap", String(IAT_B3_NATIVE_CONTAINMENT_TIMING.stdoutCapBytes),
    "--stderr-cap", String(IAT_B3_NATIVE_CONTAINMENT_TIMING.stderrCapBytes),
    "--", ...value.workloadArgv,
  ];
  if (canonicalJson(value.helperArgv) !== canonicalJson(expectedHelperArgv)) {
    fail("RUNTIME_HELPER_ARGV_EXACT_BINDING_HOLD");
  }
  validateDescriptorBindings(value.descriptorBindings, receipt);
  assertSemanticDigest(value, "invocationSha256",
    "RUNTIME_INVOCATION_DIGEST_HOLD");
}

function validateDeadlines(value) {
  assertExactKeys(value, [
    "clock", "containmentEmptyAtMonotonicMs", "deadlinePolicySha256",
    "executionDeadlineAtMonotonicMs", "executionDeadlineExpired",
    "executionDeadlineImmutable", "executionMs",
    "finalizationDeadlineAtMonotonicMs", "finalizationDeadlineExpired",
    "finalizationMs", "outerDeadlineAtMonotonicMs", "outerDeadlineExpired",
    "outerMs", "parentGuardMs", "receiptCommittedAtMonotonicMs",
    "rootTerminalObservedAtMonotonicMs", "startupDeadlineAtMonotonicMs",
    "startupDeadlineExpired", "startupMs", "streamsEofAtMonotonicMs",
    "teardownDeadlineAtMonotonicMs", "teardownDeadlineExpired",
    "teardownDeadlineImmutable", "teardownExtendsExecution",
    "teardownObservationMs", "teardownStartedAtMonotonicMs",
    "watchdogsArmedAtMonotonicMs", "watchdogsArmedBeforeStart",
    "workloadStartedAtMonotonicMs",
  ], "RUNTIME_DEADLINE_EXACT_SCHEMA_HOLD");
  const executionMs = value.executionMs;
  const expectedOuter = executionMs
    === IAT_B3_NATIVE_CONTAINMENT_TIMING.allFeatureExecutionMs
    ? IAT_B3_NATIVE_CONTAINMENT_TIMING.allFeatureOuterMs
    : IAT_B3_NATIVE_CONTAINMENT_TIMING.outerMs;
  if (value.clock !== "MONOTONIC"
    || value.startupMs !== IAT_B3_NATIVE_CONTAINMENT_TIMING.startupMs
    || ![
      IAT_B3_NATIVE_CONTAINMENT_TIMING.executionMs,
      IAT_B3_NATIVE_CONTAINMENT_TIMING.allFeatureExecutionMs,
    ].includes(executionMs)
    || value.finalizationMs !== IAT_B3_NATIVE_CONTAINMENT_TIMING.finalizationMs
    || value.teardownObservationMs
      !== IAT_B3_NATIVE_CONTAINMENT_TIMING.teardownObservationMs
    || value.parentGuardMs !== IAT_B3_NATIVE_CONTAINMENT_TIMING.parentGuardMs
    || value.outerMs !== expectedOuter
    || value.watchdogsArmedBeforeStart !== true
    || value.executionDeadlineImmutable !== true
    || value.teardownDeadlineImmutable !== true
    || value.teardownExtendsExecution !== false
    || value.startupDeadlineExpired !== false
    || value.executionDeadlineExpired !== false
    || value.finalizationDeadlineExpired !== false
    || value.teardownDeadlineExpired !== false
    || value.outerDeadlineExpired !== false) {
    fail("RUNTIME_DEADLINE_POLICY_HOLD");
  }
  const timeFields = [
    "watchdogsArmedAtMonotonicMs", "workloadStartedAtMonotonicMs",
    "rootTerminalObservedAtMonotonicMs", "streamsEofAtMonotonicMs",
    "teardownStartedAtMonotonicMs", "containmentEmptyAtMonotonicMs",
    "receiptCommittedAtMonotonicMs", "startupDeadlineAtMonotonicMs",
    "executionDeadlineAtMonotonicMs", "finalizationDeadlineAtMonotonicMs",
    "teardownDeadlineAtMonotonicMs", "outerDeadlineAtMonotonicMs",
  ];
  for (const field of timeFields)
    assertSafeUnsigned(value[field], "RUNTIME_DEADLINE_TIMESTAMP_HOLD");
  if (value.startupDeadlineAtMonotonicMs !== checkedAdd(
    value.watchdogsArmedAtMonotonicMs, value.startupMs,
    "RUNTIME_STARTUP_DEADLINE_OVERFLOW_HOLD",
  ) || value.executionDeadlineAtMonotonicMs !== checkedAdd(
    value.workloadStartedAtMonotonicMs, value.executionMs,
    "RUNTIME_EXECUTION_DEADLINE_OVERFLOW_HOLD",
  ) || value.finalizationDeadlineAtMonotonicMs !== checkedAdd(
    value.rootTerminalObservedAtMonotonicMs, value.finalizationMs,
    "RUNTIME_FINALIZATION_DEADLINE_OVERFLOW_HOLD",
  ) || value.teardownDeadlineAtMonotonicMs !== checkedAdd(
    value.teardownStartedAtMonotonicMs, value.teardownObservationMs,
    "RUNTIME_TEARDOWN_DEADLINE_OVERFLOW_HOLD",
  ) || value.outerDeadlineAtMonotonicMs !== checkedAdd(
    value.watchdogsArmedAtMonotonicMs, value.outerMs,
    "RUNTIME_OUTER_DEADLINE_OVERFLOW_HOLD",
  )) fail("RUNTIME_DEADLINE_DERIVATION_HOLD");
  if (value.watchdogsArmedAtMonotonicMs
      >= value.workloadStartedAtMonotonicMs
    || value.workloadStartedAtMonotonicMs
      >= value.rootTerminalObservedAtMonotonicMs
    || value.rootTerminalObservedAtMonotonicMs
      >= value.executionDeadlineAtMonotonicMs
    || value.rootTerminalObservedAtMonotonicMs
      > value.streamsEofAtMonotonicMs
    || value.streamsEofAtMonotonicMs
      >= value.finalizationDeadlineAtMonotonicMs
    || value.teardownStartedAtMonotonicMs
      < value.rootTerminalObservedAtMonotonicMs
    || value.teardownStartedAtMonotonicMs
      > value.containmentEmptyAtMonotonicMs
    || value.containmentEmptyAtMonotonicMs
      >= value.teardownDeadlineAtMonotonicMs
    || value.streamsEofAtMonotonicMs > value.receiptCommittedAtMonotonicMs
    || value.containmentEmptyAtMonotonicMs
      > value.receiptCommittedAtMonotonicMs
    || value.receiptCommittedAtMonotonicMs
      >= value.outerDeadlineAtMonotonicMs) {
    fail("RUNTIME_DEADLINE_CHRONOLOGY_HOLD");
  }
  const policy = {
    clock: value.clock,
    executionDeadlineImmutable: value.executionDeadlineImmutable,
    executionMs: value.executionMs,
    finalizationMs: value.finalizationMs,
    outerMs: value.outerMs,
    parentGuardMs: value.parentGuardMs,
    startupMs: value.startupMs,
    teardownDeadlineImmutable: value.teardownDeadlineImmutable,
    teardownExtendsExecution: value.teardownExtendsExecution,
    teardownObservationMs: value.teardownObservationMs,
    watchdogsArmedBeforeStart: value.watchdogsArmedBeforeStart,
  };
  if (semanticSha256(policy) !== value.deadlinePolicySha256)
    fail("RUNTIME_DEADLINE_POLICY_DIGEST_HOLD");
}

function parseUnsignedToken(value, code, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== "string" || !DECIMAL_PATTERN.test(value)) fail(code);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) fail(code);
  return parsed;
}

function parseSignedToken(value, code) {
  if (typeof value !== "string" || !/^(?:0|-?[1-9][0-9]*)$/u.test(value)) {
    fail(code);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) fail(code);
  return parsed;
}

function parseBitToken(value, code) {
  if (value !== "0" && value !== "1") fail(code);
  return value === "1";
}

function parseControlLine(line, prefix, expectedKeys, code) {
  if (!line.startsWith(`${prefix} `) || line.includes("\r")
    || line.includes("\0") || /[^\x20-\x7e]/u.test(line)) fail(code);
  const tokens = line.split(" ");
  if (tokens.some((token) => token.length === 0)) fail(code);
  const entries = tokens.slice(1).map((token) => {
    const match = token.match(/^([A-Za-z][A-Za-z0-9]*)=([A-Za-z0-9._\/-]+)$/u);
    if (!match) fail(code);
    return [match[1], match[2]];
  });
  const keys = entries.map(([key]) => key);
  if (new Set(keys).size !== keys.length
    || canonicalJson(keys) !== canonicalJson(expectedKeys)) fail(code);
  return Object.fromEntries(entries);
}

function validateControl(value, receipt) {
  assertExactKeys(value, [
    "boundedReadTurnBytes", "containmentIdentityRetainedThroughArbitration",
    "eofObserved", "eofObservedAtMonotonicMs", "finalCommittedAfterEof",
    "finalFrame", "finalObservedAtMonotonicMs", "firstOutcomeWriteOnce",
    "noTrailingBytes", "protocol", "readyFrame",
    "readyObservedAtMonotonicMs", "statusChannelNonblocking",
    "timerPriorityBeforeStatus", "transcriptSha256",
  ], "RUNTIME_CONTROL_EXACT_SCHEMA_HOLD");
  if (value.protocol !== IAT_B3_NATIVE_RUNTIME_CONTAINMENT_CONTROL_PROTOCOL
    || value.statusChannelNonblocking !== true
    || value.boundedReadTurnBytes !== CONTROL_READ_TURN_BYTES
    || value.eofObserved !== true || value.noTrailingBytes !== true
    || value.finalCommittedAfterEof !== true
    || value.timerPriorityBeforeStatus !== true
    || value.firstOutcomeWriteOnce !== true
    || value.containmentIdentityRetainedThroughArbitration !== true) {
    fail("RUNTIME_CONTROL_ARBITRATION_HOLD");
  }
  for (const field of [
    "readyObservedAtMonotonicMs", "finalObservedAtMonotonicMs",
    "eofObservedAtMonotonicMs",
  ]) assertSafeUnsigned(value[field], "RUNTIME_CONTROL_TIMESTAMP_HOLD");
  if (value.readyObservedAtMonotonicMs
      >= receipt.deadlines.watchdogsArmedAtMonotonicMs
    || value.finalObservedAtMonotonicMs
      < receipt.deadlines.streamsEofAtMonotonicMs
    || value.finalObservedAtMonotonicMs
      < receipt.deadlines.containmentEmptyAtMonotonicMs
    || value.finalObservedAtMonotonicMs > value.eofObservedAtMonotonicMs
    || value.eofObservedAtMonotonicMs
      > receipt.deadlines.receiptCommittedAtMonotonicMs) {
    fail("RUNTIME_CONTROL_CHRONOLOGY_HOLD");
  }
  const readyKeys = [
    "protocol", "contract", "startup", "execution", "finalization", "teardown",
  ];
  const finalKeys = [
    "protocol", "contract", "outcome", "elapsed", "rootTerminal", "rootExit",
    "rootSignal", "reaped", "empty", "leak", "zombies", "resumed",
    "intervention", "startupExpired", "executionExpired",
    "finalizationExpired", "teardownExpired", "strictTap", "protocolValid",
    "absence", "stdoutBytes", "stdoutSha256", "stdoutTruncated",
    "stderrBytes", "stderrSha256", "stderrTruncated",
  ];
  const ready = parseControlLine(
    value.readyFrame, "IAT_B3_CONTAINMENT_READY_V1", readyKeys,
    "RUNTIME_READY_FRAME_HOLD",
  );
  const final = parseControlLine(
    value.finalFrame, "IAT_B3_CONTAINMENT_FINAL_V1", finalKeys,
    "RUNTIME_FINAL_FRAME_HOLD",
  );
  if (ready.protocol !== value.protocol || final.protocol !== value.protocol
    || ready.contract !== receipt.checkpoint.containmentContractSha256
    || final.contract !== ready.contract
    || parseUnsignedToken(ready.startup, "RUNTIME_READY_STARTUP_HOLD")
      !== receipt.deadlines.startupMs
    || parseUnsignedToken(ready.execution, "RUNTIME_READY_EXECUTION_HOLD")
      !== receipt.deadlines.executionMs
    || parseUnsignedToken(ready.finalization, "RUNTIME_READY_FINALIZATION_HOLD")
      !== receipt.deadlines.finalizationMs
    || parseUnsignedToken(ready.teardown, "RUNTIME_READY_TEARDOWN_HOLD")
      !== receipt.deadlines.teardownObservationMs) {
    fail("RUNTIME_READY_FRAME_BINDING_HOLD");
  }
  const finalState = {
    absence: parseBitToken(final.absence, "RUNTIME_FINAL_ABSENCE_HOLD"),
    empty: parseBitToken(final.empty, "RUNTIME_FINAL_EMPTY_HOLD"),
    executionExpired: parseBitToken(
      final.executionExpired, "RUNTIME_FINAL_EXECUTION_EXPIRED_HOLD",
    ),
    finalizationExpired: parseBitToken(
      final.finalizationExpired, "RUNTIME_FINAL_FINALIZATION_EXPIRED_HOLD",
    ),
    intervention: parseBitToken(
      final.intervention, "RUNTIME_FINAL_INTERVENTION_HOLD",
    ),
    leak: parseBitToken(final.leak, "RUNTIME_FINAL_LEAK_HOLD"),
    protocolValid: parseBitToken(
      final.protocolValid, "RUNTIME_FINAL_PROTOCOL_VALID_HOLD",
    ),
    reaped: parseBitToken(final.reaped, "RUNTIME_FINAL_REAPED_HOLD"),
    resumed: parseBitToken(final.resumed, "RUNTIME_FINAL_RESUMED_HOLD"),
    rootExit: parseSignedToken(final.rootExit, "RUNTIME_FINAL_ROOT_EXIT_HOLD"),
    rootSignal: parseUnsignedToken(
      final.rootSignal, "RUNTIME_FINAL_ROOT_SIGNAL_HOLD", 255,
    ),
    rootTerminal: parseBitToken(
      final.rootTerminal, "RUNTIME_FINAL_ROOT_TERMINAL_HOLD",
    ),
    startupExpired: parseBitToken(
      final.startupExpired, "RUNTIME_FINAL_STARTUP_EXPIRED_HOLD",
    ),
    stderrBytes: parseUnsignedToken(
      final.stderrBytes, "RUNTIME_FINAL_STDERR_BYTES_HOLD",
      IAT_B3_NATIVE_CONTAINMENT_TIMING.stderrCapBytes,
    ),
    stderrTruncated: parseBitToken(
      final.stderrTruncated, "RUNTIME_FINAL_STDERR_TRUNCATED_HOLD",
    ),
    stdoutBytes: parseUnsignedToken(
      final.stdoutBytes, "RUNTIME_FINAL_STDOUT_BYTES_HOLD",
      IAT_B3_NATIVE_CONTAINMENT_TIMING.stdoutCapBytes,
    ),
    stdoutTruncated: parseBitToken(
      final.stdoutTruncated, "RUNTIME_FINAL_STDOUT_TRUNCATED_HOLD",
    ),
    strictTap: parseBitToken(final.strictTap, "RUNTIME_FINAL_STRICT_TAP_HOLD"),
    teardownExpired: parseBitToken(
      final.teardownExpired, "RUNTIME_FINAL_TEARDOWN_EXPIRED_HOLD",
    ),
    zombies: parseUnsignedToken(final.zombies, "RUNTIME_FINAL_ZOMBIES_HOLD"),
  };
  if (final.outcome !== "PASS"
    || parseUnsignedToken(final.elapsed, "RUNTIME_FINAL_ELAPSED_HOLD",
      receipt.deadlines.outerMs)
      !== receipt.deadlines.containmentEmptyAtMonotonicMs
        - receipt.deadlines.watchdogsArmedAtMonotonicMs
    || canonicalJson(finalState) !== canonicalJson({
      absence: true,
      empty: true,
      executionExpired: false,
      finalizationExpired: false,
      intervention: false,
      leak: false,
      protocolValid: true,
      reaped: true,
      resumed: true,
      rootExit: 0,
      rootSignal: 0,
      rootTerminal: true,
      startupExpired: false,
      stderrBytes: receipt.streams.stderr.byteLength,
      stderrTruncated: false,
      stdoutBytes: receipt.streams.stdout.byteLength,
      stdoutTruncated: false,
      strictTap: true,
      teardownExpired: false,
      zombies: 0,
    })
    || final.stdoutSha256 !== receipt.streams.stdout.sha256
    || final.stderrSha256 !== receipt.streams.stderr.sha256) {
    fail("RUNTIME_FINAL_SUCCESS_STATE_HOLD");
  }
  const transcript = Buffer.from(`${value.readyFrame}\n${value.finalFrame}\n`, "ascii");
  if (sha256(transcript) !== value.transcriptSha256)
    fail("RUNTIME_CONTROL_TRANSCRIPT_DIGEST_HOLD");
}

function validateStream(stream, expectedName, expectedCap) {
  assertExactKeys(stream, [
    "byteLength", "capBytes", "capExceeded", "eofObserved", "name",
    "prefixByteLength", "prefixSha256", "sha256", "streamObservationSha256",
    "tailByteLength", "tailSha256", "truncated",
  ], "RUNTIME_STREAM_EXACT_SCHEMA_HOLD");
  if (stream.name !== expectedName || stream.capBytes !== expectedCap
    || !Number.isSafeInteger(stream.byteLength) || stream.byteLength < 0
    || stream.byteLength > expectedCap || stream.capExceeded !== false
    || stream.eofObserved !== true || stream.truncated !== false) {
    fail("RUNTIME_STREAM_STATE_HOLD");
  }
  for (const field of ["sha256", "prefixSha256", "tailSha256"])
    assertSha(stream[field], "RUNTIME_STREAM_DIGEST_HOLD");
  const expectedEdge = Math.min(
    stream.byteLength, IAT_B3_NATIVE_CONTAINMENT_TIMING.diagnosticEdgeBytes,
  );
  if (stream.prefixByteLength !== expectedEdge
    || stream.tailByteLength !== expectedEdge
    || (stream.byteLength === 0
      && (stream.sha256 !== EMPTY_SHA256
        || stream.prefixSha256 !== EMPTY_SHA256
        || stream.tailSha256 !== EMPTY_SHA256))) {
    fail("RUNTIME_STREAM_EDGE_HOLD");
  }
  assertSemanticDigest(stream, "streamObservationSha256",
    "RUNTIME_STREAM_OBSERVATION_DIGEST_HOLD");
}

function validateStreams(value) {
  assertExactKeys(value, ["stderr", "stdout"],
    "RUNTIME_STREAMS_EXACT_SCHEMA_HOLD");
  validateStream(value.stdout, "stdout",
    IAT_B3_NATIVE_CONTAINMENT_TIMING.stdoutCapBytes);
  validateStream(value.stderr, "stderr",
    IAT_B3_NATIVE_CONTAINMENT_TIMING.stderrCapBytes);
}

function validateTap(value, receipt) {
  assertExactKeys(value, [
    "bailout", "cancelled", "directives", "fail", "manifest",
    "noTrailingLines", "pass", "planEnd", "planStart", "skipped",
    "strictValidated", "tests", "todo", "transcriptByteLength",
    "transcriptEofObserved", "transcriptSha256", "version",
  ], "RUNTIME_TAP_EXACT_SCHEMA_HOLD");
  assertExactKeys(value.manifest, [
    "byteLength", "caseCount", "orderedNamesJsonBytes",
    "orderedNamesSha256", "path", "sha256",
  ], "RUNTIME_TAP_MANIFEST_EXACT_SCHEMA_HOLD");
  if (canonicalJson(value.manifest)
      !== canonicalJson(IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TAP_MANIFEST)
    || value.version !== 13 || value.planStart !== 1
    || value.planEnd !== IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TAP_MANIFEST.caseCount
    || value.tests !== value.planEnd || value.pass !== value.tests
    || value.fail !== 0 || value.cancelled !== 0 || value.skipped !== 0
    || value.todo !== 0 || value.bailout !== false
    || value.directives !== false || value.noTrailingLines !== true
    || value.strictValidated !== true || value.transcriptEofObserved !== true
    || value.transcriptSha256 !== receipt.streams.stdout.sha256
    || value.transcriptByteLength !== receipt.streams.stdout.byteLength) {
    fail("RUNTIME_TAP_STRICT_SEMANTICS_HOLD");
  }
}

function validateContainment(value, receipt) {
  assertExactKeys(value, [
    "absenceProofObserved", "completeDescendantReap",
    "containmentEmpty", "containmentObservationSha256",
    "descendantLeakObserved", "directChildReaped", "interventionUsed",
    "naturalCompletion", "numericPidCleanupUsed", "platformEvidence",
    "rootExitCode", "rootSignal", "rootTerminalObserved", "teardownKillUsed",
    "workloadResumed", "zombieDescendantCount",
  ], "RUNTIME_CONTAINMENT_EXACT_SCHEMA_HOLD");
  if (value.absenceProofObserved !== true
    || value.completeDescendantReap !== true || value.containmentEmpty !== true
    || value.descendantLeakObserved !== false || value.directChildReaped !== true
    || value.interventionUsed !== false || value.naturalCompletion !== true
    || value.numericPidCleanupUsed !== false || value.rootExitCode !== 0
    || value.rootSignal !== 0 || value.rootTerminalObserved !== true
    || value.teardownKillUsed !== false || value.workloadResumed !== true
    || value.zombieDescendantCount !== 0) {
    fail("RUNTIME_CONTAINMENT_SUCCESS_STATE_HOLD");
  }
  if (receipt.target === "linux-x64-musl") {
    assertExactKeys(value.platformEvidence, [
      "allWaitFlags", "namespaceDestroyed", "namespaceIdentity",
      "namespacePid1ExitValidated", "pid1TerminalCode", "pid1TerminalStatus",
      "pidfdIdentity", "pidfdTerminalObserved",
    ], "RUNTIME_LINUX_CONTAINMENT_EXACT_SCHEMA_HOLD");
    if (canonicalJson(value.platformEvidence.allWaitFlags)
        !== canonicalJson(["WEXITED", "__WALL", "__WCLONE"])
      || value.platformEvidence.namespaceDestroyed !== true
      || !SHA256_PATTERN.test(value.platformEvidence.namespaceIdentity)
      || value.platformEvidence.namespacePid1ExitValidated !== true
      || value.platformEvidence.pid1TerminalCode !== "CLD_EXITED"
      || value.platformEvidence.pid1TerminalStatus !== 0
      || !SHA256_PATTERN.test(value.platformEvidence.pidfdIdentity)
      || value.platformEvidence.pidfdTerminalObserved !== true
      || value.platformEvidence.pidfdIdentity
        === value.platformEvidence.namespaceIdentity) {
      fail("RUNTIME_LINUX_CONTAINMENT_SEMANTICS_HOLD");
    }
  } else {
    assertExactKeys(value.platformEvidence, [
      "activeProcessZeroAtMonotonicMs", "activeProcessZeroObserved",
      "breakawayObserved", "completionPortIdentity", "jobCloseUsedToKill",
      "jobObjectIdentity", "rootExitObserved",
    ], "RUNTIME_WINDOWS_CONTAINMENT_EXACT_SCHEMA_HOLD");
    if (value.platformEvidence.activeProcessZeroObserved !== true
      || value.platformEvidence.activeProcessZeroAtMonotonicMs
        !== receipt.deadlines.containmentEmptyAtMonotonicMs
      || value.platformEvidence.breakawayObserved !== false
      || !SHA256_PATTERN.test(value.platformEvidence.completionPortIdentity)
      || value.platformEvidence.jobCloseUsedToKill !== false
      || !SHA256_PATTERN.test(value.platformEvidence.jobObjectIdentity)
      || value.platformEvidence.completionPortIdentity
        === value.platformEvidence.jobObjectIdentity
      || value.platformEvidence.rootExitObserved !== true) {
      fail("RUNTIME_WINDOWS_ACTIVE_ZERO_SEMANTICS_HOLD");
    }
  }
  assertSemanticDigest(value, "containmentObservationSha256",
    "RUNTIME_CONTAINMENT_OBSERVATION_DIGEST_HOLD");
}

function validateCleanup(value, receipt) {
  assertExactKeys(value, [
    "afterNaturalTerminal", "allOwnedDescriptorsClosed",
    "allOwnedHandlesClosed", "ambiguousIdentity", "cleanupObservationSha256",
    "cleanupObserverIdentity", "containmentObjectDestroyed",
    "deadlineArmedEvenOnSignalFailure", "executionArtifactPostDescriptor",
    "finishedAtMonotonicMs", "noLeak", "noLiveDescendants",
    "noZombieDescendants", "numericPidCleanupUsed", "observationOnly",
    "startedAtMonotonicMs",
  ], "RUNTIME_CLEANUP_EXACT_SCHEMA_HOLD");
  assertSafeUnsigned(value.startedAtMonotonicMs,
    "RUNTIME_CLEANUP_TIMESTAMP_HOLD");
  assertSafeUnsigned(value.finishedAtMonotonicMs,
    "RUNTIME_CLEANUP_TIMESTAMP_HOLD");
  assertArtifactDescriptor(value.executionArtifactPostDescriptor,
    receipt.target, "RUNTIME_CLEANUP_ARTIFACT_DESCRIPTOR_HOLD");
  if (value.observationOnly !== true || value.afterNaturalTerminal !== true
    || value.deadlineArmedEvenOnSignalFailure !== true
    || value.allOwnedDescriptorsClosed !== true
    || value.allOwnedHandlesClosed !== true
    || value.ambiguousIdentity !== false
    || value.containmentObjectDestroyed !== true || value.noLeak !== true
    || value.noLiveDescendants !== true || value.noZombieDescendants !== true
    || value.numericPidCleanupUsed !== false
    || value.startedAtMonotonicMs
      !== receipt.deadlines.teardownStartedAtMonotonicMs
    || value.finishedAtMonotonicMs
      !== receipt.deadlines.containmentEmptyAtMonotonicMs
    || value.finishedAtMonotonicMs < value.startedAtMonotonicMs
    || value.finishedAtMonotonicMs
      >= receipt.deadlines.teardownDeadlineAtMonotonicMs
    || !sameArtifact(value.executionArtifactPostDescriptor,
      receipt.runtimeArtifact.postExecutionDescriptor)
    || !SHA256_PATTERN.test(value.cleanupObserverIdentity)
    || value.cleanupObserverIdentity === receipt.observerSessionId) {
    fail("RUNTIME_CLEANUP_OBSERVATION_SEMANTICS_HOLD");
  }
  assertSemanticDigest(value, "cleanupObservationSha256",
    "RUNTIME_CLEANUP_OBSERVATION_DIGEST_HOLD");
}

function validateAuthorityBoundary(value) {
  assertExactKeys(value, [
    "callerSuppliedAccepted", "declaredSource", "embeddedAuthorityAccepted",
    "injectedAccepted", "selfAuthoredAccepted", "selfDigestAuthoritative",
    "syntheticAccepted",
  ], "RUNTIME_AUTHORITY_BOUNDARY_EXACT_SCHEMA_HOLD");
  if (value.declaredSource !== "EXTERNAL_OBSERVER_OWNED_DIRECT_BYTES_ONLY"
    || value.callerSuppliedAccepted !== false
    || value.embeddedAuthorityAccepted !== false
    || value.injectedAccepted !== false
    || value.selfAuthoredAccepted !== false
    || value.selfDigestAuthoritative !== false
    || value.syntheticAccepted !== false) {
    fail("RUNTIME_AUTHORITY_BOUNDARY_ESCALATION_HOLD");
  }
}

function validateTruthEnvelope(value) {
  const fields = [
    "checkpointObserved", "compileProvenanceObserved", "devnetAuthorized",
    "devnetExecuted", "mainnetAuthorized", "mainnetExecuted", "networkUsed",
    "publicClaimAuthorized", "releaseAuthorized", "rpcUsed",
    "runtimeEvidenceObserved", "runtimeExecuted", "sameObjectRuntimeObserved",
    "signed", "sourceAuthorized",
  ];
  assertExactKeys(value, fields,
    "RUNTIME_TRUTH_ENVELOPE_EXACT_SCHEMA_HOLD");
  if (Object.values(value).some((entry) => entry !== false))
    fail("RUNTIME_TRUTH_ENVELOPE_PROMOTION_HOLD");
}

function validateReceipt(receipt) {
  assertExactKeys(receipt, IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TOP_LEVEL_FIELDS,
    "RUNTIME_RECEIPT_EXACT_SCHEMA_HOLD");
  if (receipt.schema !== IAT_B3_NATIVE_RUNTIME_CONTAINMENT_RECEIPT_SCHEMA
    || receipt.status !== "UNTRUSTED_OBSERVER_CANDIDATE_HOLD"
    || !IAT_B3_NATIVE_RUNTIME_CONTAINMENT_TARGETS.includes(receipt.target)
    || !SHA256_PATTERN.test(receipt.observerSessionId)
    || !Number.isSafeInteger(receipt.receiptSequence)
    || receipt.receiptSequence < 1) {
    fail("RUNTIME_RECEIPT_HEADER_HOLD");
  }
  validateCheckpoint(receipt.checkpoint, receipt.target);
  validateCompileProvenance(receipt.compileProvenance, receipt);
  validateRuntimeArtifact(receipt.runtimeArtifact, receipt);
  validatePlatform(receipt.platform, receipt);
  validateDeadlines(receipt.deadlines);
  validateStreams(receipt.streams);
  validateInvocation(receipt.invocation, receipt);
  validateTap(receipt.tap, receipt);
  validateContainment(receipt.containment, receipt);
  validateCleanup(receipt.cleanup, receipt);
  validateControl(receipt.control, receipt);
  validateAuthorityBoundary(receipt.authorityBoundary);
  validateTruthEnvelope(receipt.truthEnvelope);
  assertSemanticDigest(receipt, "semanticSha256",
    "RUNTIME_RECEIPT_SEMANTIC_DIGEST_HOLD");
}

function parseCanonicalReceiptBytes(receiptBytes) {
  if (!(receiptBytes instanceof Uint8Array)
    || receiptBytes.byteLength < 1 || receiptBytes.byteLength > MAX_RECEIPT_BYTES) {
    fail("RUNTIME_RECEIPT_DIRECT_BYTES_REQUIRED_HOLD");
  }
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(receiptBytes);
  } catch {
    fail("RUNTIME_RECEIPT_UTF8_HOLD");
  }
  const receipt = parseJsonRejectingDuplicateKeys(text);
  if (!plainRecord(receipt) || text !== canonicalJson(receipt))
    fail("RUNTIME_RECEIPT_NONCANONICAL_HOLD");
  validateReceipt(receipt);
  return receipt;
}

function holdAssessment({
  candidateDisposition = "NO_CANDIDATE_ACCEPTED",
  code = undefined,
} = {}) {
  const blockers = code === undefined
    ? ASSESSMENT_BLOCKERS : [code, ...ASSESSMENT_BLOCKERS];
  return Object.freeze({
    schema: IAT_B3_NATIVE_RUNTIME_CONTAINMENT_ASSESSMENT_SCHEMA,
    status: "HOLD",
    ready: false,
    complete: false,
    valid: false,
    candidateSchemaConformant: false,
    candidateDisposition,
    receiptSourceObserved: false,
    checkpointObserved: false,
    compileProvenanceObserved: false,
    runtimeEvidenceObserved: false,
    sameObjectRuntimeObserved: false,
    platformCapabilitiesObserved: false,
    invocationObserved: false,
    deadlineObserved: false,
    tapObserved: false,
    containmentEmptyObserved: false,
    cleanupObserved: false,
    networkUsed: false,
    rpcUsed: false,
    keyUsed: false,
    signed: false,
    devnetExecuted: false,
    mainnetExecuted: false,
    releaseAuthorized: false,
    blockers: Object.freeze([...new Set(blockers)]),
  });
}

export function assessNativeRuntimeContainmentReceipt(receiptBytes = undefined) {
  try {
    parseCanonicalReceiptBytes(receiptBytes);
    return holdAssessment({
      candidateDisposition: "STRUCTURAL_CANDIDATE_NONAUTHORITATIVE",
    });
  } catch (error) {
    return holdAssessment({
      candidateDisposition: "REJECTED_HOLD",
      code: typeof error?.code === "string"
        ? error.code : "RUNTIME_RECEIPT_STRUCTURAL_HOLD",
    });
  }
}

export function createNativeRuntimeContainmentReceiptHold() {
  return holdAssessment();
}

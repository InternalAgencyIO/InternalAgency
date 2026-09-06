#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const PHASE_B_AUTHORITY_STATE_SCHEMA = "iat-b3-phase-b-p00-authority-state/v1";
export const PHASE_B_AUTHORITY_VALIDATION_SCHEMA =
  "iat-b3-phase-b-p00-authority-state-validation/v1";
export const PHASE_B_AUTHORITY_STATUS = "HOLD";
export const PHASE_B_AUTHORITY_PACKET_SHA256 =
  "6b0b50d9bcc4aa1116e33a5e1cda7fe03976e53b22f72529da3ff8c291d89b7c";
export const PHASE_B_AUTHORITY_PACKET_BYTES = 5175;

const DEFAULT_PACKET_PATH = new URL(
  "../docs/b3/iat-b3-mandatory-ci-phase-b-authority-state.v1.json",
  import.meta.url,
);

export const PHASE_B_AUTHORITY_TOP_LEVEL_KEYS = Object.freeze([
  "schema",
  "status",
  "ready",
  "complete",
  "operative",
  "exitCode",
  "authorityBasis",
  "windowsLaunchLockChoice",
  "toolchainIdentityState",
  "authority",
  "loopbackSigningB",
  "p01Transition",
  "blockers",
  "releaseAuthorized",
  "devnetAuthorizationRequested",
  "mainnetAuthorized",
]);

export const PHASE_B_AUTHORITY_BLOCKERS = Object.freeze([
  "A2_SYSTEM_PROVISIONING_NOT_AUTHORIZED",
  "B_LOOPBACK_SIGNING_GRANTED_BUT_INOPERATIVE",
  "COMPILER_EXECUTION_NOT_AUTHORIZED",
  "EXACT_NODE_RUNTIME_LIVE_IDENTITY_UNRESOLVED",
  "LINUX_MUSL_COMPILER_CLOSURE_UNRESOLVED",
  "LINUX_MUSL_SYSROOT_IDENTITY_UNRESOLVED",
  "NATIVE_HELPER_EXECUTION_NOT_AUTHORIZED",
  "OBSERVER_OWNED_DUAL_BUILD_RECEIPT_UNAVAILABLE",
  "PHASE_B_RUNTIME_CONTAINMENT_EXECUTION_NOT_AUTHORIZED",
  "PINNED_ZIG_EXECUTABLE_IDENTITY_UNRESOLVED",
  "PINNED_ZIG_VERSION_OUTPUT_UNRESOLVED",
  "SAME_OBJECT_RUNTIME_RECEIPT_UNAVAILABLE",
  "SOURCE_BOUND_WINDOWS_LAUNCH_LOCK_NOT_IMPLEMENTED",
  "SYSTEM_INSTALL_DOWNLOAD_NETWORK_NOT_AUTHORIZED",
  "WINDOWS_GNU_COMPILER_CLOSURE_UNRESOLVED",
  "WINDOWS_MINGW_SYSROOT_IDENTITY_UNRESOLVED",
  "WINDOWS_PE_IMPORT_ALLOWLIST_UNRESOLVED",
]);

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export const PHASE_B_AUTHORITY_EXPECTED = deepFreeze({
  schema: PHASE_B_AUTHORITY_STATE_SCHEMA,
  status: PHASE_B_AUTHORITY_STATUS,
  ready: false,
  complete: false,
  operative: false,
  exitCode: 2,
  authorityBasis: {
    queuePacket: "FROZEN_QUEUE_AUTHORITY_REPORT",
    phaseBPlan: "K92_FROZEN",
    ownerAuthority: "K96_K97_FROZEN",
    directBytesValidated: false,
  },
  windowsLaunchLockChoice: {
    choice: "SOURCE_BOUND_NATIVE_WINDOWS_LAUNCH_AND_LOCK",
    selected: true,
    implemented: false,
    compiled: false,
    observed: false,
    executionAuthorized: false,
    requirements: [
      "COMMITTED_SOURCE_BOUND_NATIVE_IMPLEMENTATION",
      "SAME_OBJECT_OPEN_HANDLE_DENIES_SHARE_WRITE_AND_SHARE_DELETE",
      "OPEN_HANDLE_VOLUME_FILE_ID_AND_SHA256_CROSS_BIND",
      "STARTUPINFOEX_PROC_THREAD_ATTRIBUTE_JOB_LIST",
      "CREATE_SUSPENDED_BEFORE_ROOT_EXECUTION",
      "JOB_KILL_ON_CLOSE_AND_BREAKAWAY_DISABLED",
      "COMPLETION_PORT_ACTIVE_PROCESS_ZERO",
    ],
    forbiddenFallbacks: [
      "PATH_ONLY_HASH_PLUS_GENERIC_SPAWN",
      "ASSIGN_JOB_AFTER_PROCESS_START",
      "PID_ENUMERATION_OR_PID_REUSE_CLEANUP",
      "TASKKILL_WMI_CIM_PROCESS_NAME_CLEANUP",
    ],
  },
  toolchainIdentityState: {
    exactNodeRuntimeLiveIdentity: null,
    pinnedZigExecutableIdentity: null,
    pinnedZigVersionOutput: null,
    linuxMuslCompilerClosure: null,
    linuxMuslSysrootIdentity: null,
    windowsGnuCompilerClosure: null,
    windowsMingwSysrootIdentity: null,
    windowsPeImportAllowlist: null,
    observerOwnedDualBuildReceipt: null,
    sameObjectRuntimeReceipt: null,
    allResolved: false,
  },
  authority: {
    standingSourceSchemaTestDocsAuthorized: true,
    readOnlyExistingToolchainObservationAuthorized: true,
    localWslDockerInspectionPermissionRecorded: true,
    offlineDerivedImageCreationPermissionRecorded: true,
    localContainerBuildsAndKeyFreeRehearsalPermissionRecorded: true,
    sourceLockedPolicyDefaultsAccepted: true,
    policyArtifactDraftingAllowed: true,
    a2SystemProvisioningAuthorized: false,
    systemMutationOperative: false,
    installOrDownloadAuthorized: false,
    externalNetworkAuthorized: false,
    compilerExecutionAuthorized: false,
    nativeHelperExecutionAuthorized: false,
    runtimeContainmentExecutionAuthorized: false,
    dockerExecutionOperative: false,
    rpcWriteOrBroadcastAuthorized: false,
    genericOrProductionKeyGenerationAuthorized: false,
    fundingOrSpendAuthorized: false,
    publicDevnetAuthorizationOperative: false,
    mainnetAuthorized: false,
    actualCryptographicSignaturesRequireFreshExactSubjectAndModelTPhysicalConfirmation: true,
  },
  loopbackSigningB: {
    authorityGranted: true,
    disposableLoopbackKeyGenerationAuthorized: true,
    disposableLoopbackLocalTransactionSigningAuthorized: true,
    operativeNow: false,
    mayBeExercisedInP00OrP01: false,
    scopeExact:
      "ONE_FRESH_OFF_REPOSITORY_LOOPBACK_ONLY_KEY_SET; PROCESS_OWNED_PRIVATE_DIRECTORY; NEVER_PRINT_EXPORT_COMMIT_OR_USE_ON_PUBLIC_RPC_DEVNET_MAINNET; NO_FUNDING_OPERATION; NO_AUTOMATIC_RETRY; RETAIN_UNTIL_ALL_LOCAL_STATE_RECONCILED; THEN_DELETE_SECRETS_AND_RETAIN_ONLY_PUBLIC_KEYS_HASHES_RECEIPTS",
    publicRpcDevnetMainnetUseAuthorized: false,
    fundingAuthorized: false,
    automaticRetryAuthorized: false,
    holdReason:
      "ACCEPTED_RUNTIME_AND_ISOLATED_DAEMON_PATH_NOT_YET_AVAILABLE; NO_KEYS_MAY_BE_GENERATED UNTIL ALL_SOURCE_RUNTIME_STORAGE_AND_OBSERVER_PREDICATES_PASS",
  },
  p01Transition: {
    mayStartNow: true,
    allowedWorkKinds: [
      "SOURCE_ONLY",
      "SCHEMA_ONLY",
      "VALIDATOR_ONLY",
      "NODE_BUILTIN_TESTS_ONLY",
      "DOCS_ONLY",
    ],
    forbiddenWorkKinds: [
      "SYSTEM_MUTATION",
      "INSTALL_OR_DOWNLOAD",
      "COMPILER_EXECUTION",
      "NATIVE_HELPER_EXECUTION",
      "RUNTIME_CONTAINMENT_EXECUTION",
      "DOCKER_EXECUTION",
      "RPC_WRITE_OR_BROADCAST",
      "KEY_GENERATION",
      "SIGNING",
      "FUNDING",
      "PUBLIC_DEVNET",
      "MAINNET",
    ],
    requiresA2: false,
    requiresNewSigningAuthority: false,
    outputStatus: "HOLD",
    liveActionAuthorized: false,
  },
  blockers: [...PHASE_B_AUTHORITY_BLOCKERS],
  releaseAuthorized: false,
  devnetAuthorizationRequested: false,
  mainnetAuthorized: false,
});

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function compareCanonical(actual, expected, label, violations) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) {
      violations.push(`${label}: expected an array`);
      return;
    }
    if (actual.length !== expected.length) {
      violations.push(`${label}: expected exactly ${expected.length} entries`);
      return;
    }
    for (let index = 0; index < expected.length; index += 1) {
      compareCanonical(actual[index], expected[index], `${label}[${index}]`, violations);
    }
    return;
  }
  if (isRecord(expected)) {
    if (!isRecord(actual)) {
      violations.push(`${label}: expected an object`);
      return;
    }
    const actualKeys = Object.keys(actual);
    const expectedKeys = Object.keys(expected);
    if (actualKeys.length !== expectedKeys.length
      || actualKeys.some((key, index) => key !== expectedKeys[index])) {
      violations.push(`${label}: expected exact ordered keys ${expectedKeys.join(", ")}`);
      return;
    }
    for (const key of expectedKeys) {
      compareCanonical(actual[key], expected[key], `${label}.${key}`, violations);
    }
    return;
  }
  if (!Object.is(actual, expected)) {
    violations.push(`${label}: expected ${JSON.stringify(expected)}`);
  }
}

export function parsePhaseBAuthorityStateJson(text, label = "phase-b-authority-state") {
  if (typeof text !== "string") throw new TypeError(`${label}: JSON source must be a string`);
  let index = 0;
  const skipWhitespace = () => {
    while (index < text.length && /[\t\n\r ]/u.test(text[index])) index += 1;
  };
  const fail = (message) => {
    throw new SyntaxError(`${label}: ${message} at character ${index}`);
  };
  const parseString = () => {
    if (text[index] !== "\"") fail("expected JSON string");
    const start = index;
    index += 1;
    while (index < text.length) {
      if (text[index] === "\"") {
        index += 1;
        return JSON.parse(text.slice(start, index));
      }
      if (text[index] === "\\") index += 2;
      else {
        if (text[index] < " ") fail("unescaped control character");
        index += 1;
      }
    }
    fail("unterminated JSON string");
  };
  const parseValue = (path) => {
    skipWhitespace();
    if (text[index] === "{") {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (text[index] === "}") {
        index += 1;
        return;
      }
      while (index < text.length) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) throw new SyntaxError(`${label}: duplicate JSON member ${path}.${key}`);
        keys.add(key);
        skipWhitespace();
        if (text[index] !== ":") fail("expected colon");
        index += 1;
        parseValue(`${path}.${key}`);
        skipWhitespace();
        if (text[index] === "}") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing brace");
        index += 1;
      }
      fail("unterminated JSON object");
    }
    if (text[index] === "[") {
      index += 1;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return;
      }
      let item = 0;
      while (index < text.length) {
        parseValue(`${path}[${item}]`);
        item += 1;
        skipWhitespace();
        if (text[index] === "]") {
          index += 1;
          return;
        }
        if (text[index] !== ",") fail("expected comma or closing bracket");
        index += 1;
      }
      fail("unterminated JSON array");
    }
    if (text[index] === "\"") {
      parseString();
      return;
    }
    const start = index;
    while (index < text.length && !/[\t\n\r ,\]}]/u.test(text[index])) index += 1;
    if (start === index) fail("expected JSON value");
    JSON.parse(text.slice(start, index));
  };
  skipWhitespace();
  parseValue("$root");
  skipWhitespace();
  if (index !== text.length) fail("unexpected trailing data");
  return JSON.parse(text);
}

export function loadPhaseBAuthorityState() {
  const packetBytes = readFileSync(DEFAULT_PACKET_PATH);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(packetBytes);
  return {
    packet: parsePhaseBAuthorityStateJson(text, DEFAULT_PACKET_PATH.pathname),
    packetBytes,
  };
}

function buildResult(violations, sourceBytesValidated = false) {
  const valid = violations.length === 0;
  return {
    schema: PHASE_B_AUTHORITY_VALIDATION_SCHEMA,
    valid,
    status: PHASE_B_AUTHORITY_STATUS,
    ready: false,
    complete: false,
    operative: false,
    exitCode: 2,
    sourceBytesValidated: valid && sourceBytesValidated,
    windowsDesignSelected: valid,
    windowsDesignImplemented: false,
    toolchainIdentitiesResolved: false,
    compilerExecutionAuthorized: false,
    nativeHelperExecutionAuthorized: false,
    runtimeContainmentExecutionAuthorized: false,
    loopbackSigningAuthorityGranted: valid,
    loopbackSigningOperativeNow: false,
    mayExerciseLoopbackSigningInP00OrP01: false,
    releaseAuthorized: false,
    devnetAuthorizationRequested: false,
    mainnetAuthorized: false,
    blockers: [...PHASE_B_AUTHORITY_BLOCKERS],
    violations,
  };
}

export function validatePhaseBAuthorityState({ packet, packetBytes } = {}) {
  const violations = [];
  const bytes = Buffer.isBuffer(packetBytes)
    ? packetBytes
    : packetBytes instanceof Uint8Array
      ? Buffer.from(packetBytes)
      : null;
  let sourceBytesValidated = false;
  if (bytes === null) {
    violations.push("packetBytes: exact source bytes are required");
  } else {
    const digest = sha256(bytes);
    if (bytes.length !== PHASE_B_AUTHORITY_PACKET_BYTES) {
      violations.push(`packetBytes: expected exact length ${PHASE_B_AUTHORITY_PACKET_BYTES}`);
    }
    if (digest !== PHASE_B_AUTHORITY_PACKET_SHA256) {
      violations.push("packetBytes: source-bound SHA-256 mismatch");
    }
    sourceBytesValidated = bytes.length === PHASE_B_AUTHORITY_PACKET_BYTES
      && digest === PHASE_B_AUTHORITY_PACKET_SHA256;
  }
  compareCanonical(packet, PHASE_B_AUTHORITY_EXPECTED, "packet", violations);

  if (isRecord(packet)) {
    if (Object.keys(packet).some((key, index) => key !== PHASE_B_AUTHORITY_TOP_LEVEL_KEYS[index])
      || Object.keys(packet).length !== PHASE_B_AUTHORITY_TOP_LEVEL_KEYS.length) {
      violations.push("packet: top-level schema order is not canonical");
    }
    if (!Array.isArray(packet.blockers)
      || packet.blockers.length !== 17
      || new Set(packet.blockers).size !== 17
      || packet.blockers.some((blocker, index) => blocker !== PHASE_B_AUTHORITY_BLOCKERS[index])) {
      violations.push("packet.blockers: expected the exact unique lexicographically sorted 17-member list");
    }
  }

  return buildResult(violations, sourceBytesValidated);
}

function main() {
  if (process.argv.length !== 2) {
    console.error("usage: validate-iat-b3-mandatory-ci-phase-b-authority-state.mjs");
    process.exitCode = 1;
    return;
  }
  try {
    const result = validatePhaseBAuthorityState(loadPhaseBAuthorityState());
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.valid ? 2 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  PHASE_B_AUTHORITY_BLOCKERS,
  PHASE_B_AUTHORITY_EXPECTED,
  PHASE_B_AUTHORITY_PACKET_BYTES,
  PHASE_B_AUTHORITY_PACKET_SHA256,
  PHASE_B_AUTHORITY_TOP_LEVEL_KEYS,
  loadPhaseBAuthorityState,
  parsePhaseBAuthorityStateJson,
  validatePhaseBAuthorityState,
} from "../scripts/validate-iat-b3-mandatory-ci-phase-b-authority-state.mjs";

const CLI_PATH = fileURLToPath(new URL(
  "../scripts/validate-iat-b3-mandatory-ci-phase-b-authority-state.mjs",
  import.meta.url,
));

function canonicalInputs() {
  return loadPhaseBAuthorityState();
}

function cloneInputs() {
  const inputs = canonicalInputs();
  return {
    packet: structuredClone(inputs.packet),
    packetBytes: Buffer.from(inputs.packetBytes),
  };
}

function assertNonauthorizingHold(result, expectedValid) {
  assert.equal(result.valid, expectedValid);
  assert.equal(result.status, "HOLD");
  assert.equal(result.ready, false);
  assert.equal(result.complete, false);
  assert.equal(result.operative, false);
  assert.equal(result.exitCode, 2);
  assert.equal(result.windowsDesignSelected, expectedValid);
  assert.equal(result.windowsDesignImplemented, false);
  assert.equal(result.toolchainIdentitiesResolved, false);
  assert.equal(result.compilerExecutionAuthorized, false);
  assert.equal(result.nativeHelperExecutionAuthorized, false);
  assert.equal(result.runtimeContainmentExecutionAuthorized, false);
  assert.equal(result.loopbackSigningAuthorityGranted, expectedValid);
  assert.equal(result.loopbackSigningOperativeNow, false);
  assert.equal(result.mayExerciseLoopbackSigningInP00OrP01, false);
  assert.equal(result.releaseAuthorized, false);
  assert.equal(result.devnetAuthorizationRequested, false);
  assert.equal(result.mainnetAuthorized, false);
  assert.deepEqual(result.blockers, PHASE_B_AUTHORITY_BLOCKERS);
}

function expectMutationRejected(mutate, expectedPattern = /packet/iu) {
  const inputs = cloneInputs();
  mutate(inputs);
  const result = validatePhaseBAuthorityState(inputs);
  assertNonauthorizingHold(result, false);
  assert.match(result.violations.join("\n"), expectedPattern);
}

test("canonical Phase-B P00 authority state is exact, valid, and nonoperative HOLD", () => {
  const inputs = canonicalInputs();
  const result = validatePhaseBAuthorityState(inputs);
  assertNonauthorizingHold(result, true);
  assert.equal(result.sourceBytesValidated, true);
  assert.deepEqual(result.violations, []);
  assert.deepEqual(inputs.packet, PHASE_B_AUTHORITY_EXPECTED);
  assert.deepEqual(Object.keys(inputs.packet), PHASE_B_AUTHORITY_TOP_LEVEL_KEYS);
  assert.equal(inputs.packetBytes.length, PHASE_B_AUTHORITY_PACKET_BYTES);
  assert.equal(
    createHash("sha256").update(inputs.packetBytes).digest("hex"),
    PHASE_B_AUTHORITY_PACKET_SHA256,
  );
});

test("recorded local permissions remain separate from every live operability field", () => {
  const { packet } = canonicalInputs();
  assert.equal(packet.authority.standingSourceSchemaTestDocsAuthorized, true);
  assert.equal(packet.authority.readOnlyExistingToolchainObservationAuthorized, true);
  assert.equal(packet.authority.localWslDockerInspectionPermissionRecorded, true);
  assert.equal(packet.authority.offlineDerivedImageCreationPermissionRecorded, true);
  assert.equal(packet.authority.localContainerBuildsAndKeyFreeRehearsalPermissionRecorded, true);
  assert.equal(packet.authority.sourceLockedPolicyDefaultsAccepted, true);
  assert.equal(packet.authority.policyArtifactDraftingAllowed, true);
  for (const field of [
    "a2SystemProvisioningAuthorized",
    "systemMutationOperative",
    "installOrDownloadAuthorized",
    "externalNetworkAuthorized",
    "compilerExecutionAuthorized",
    "nativeHelperExecutionAuthorized",
    "runtimeContainmentExecutionAuthorized",
    "dockerExecutionOperative",
    "rpcWriteOrBroadcastAuthorized",
    "genericOrProductionKeyGenerationAuthorized",
    "fundingOrSpendAuthorized",
    "publicDevnetAuthorizationOperative",
    "mainnetAuthorized",
  ]) {
    assert.equal(packet.authority[field], false, field);
  }
  assert.equal(
    packet.authority.actualCryptographicSignaturesRequireFreshExactSubjectAndModelTPhysicalConfirmation,
    true,
  );
});

test("Windows launch-lock choice is selected only as source-bound design", () => {
  const { windowsLaunchLockChoice: choice } = canonicalInputs().packet;
  assert.equal(choice.choice, "SOURCE_BOUND_NATIVE_WINDOWS_LAUNCH_AND_LOCK");
  assert.equal(choice.selected, true);
  assert.equal(choice.implemented, false);
  assert.equal(choice.compiled, false);
  assert.equal(choice.observed, false);
  assert.equal(choice.executionAuthorized, false);
  assert.deepEqual(choice.requirements, [
    "COMMITTED_SOURCE_BOUND_NATIVE_IMPLEMENTATION",
    "SAME_OBJECT_OPEN_HANDLE_DENIES_SHARE_WRITE_AND_SHARE_DELETE",
    "OPEN_HANDLE_VOLUME_FILE_ID_AND_SHA256_CROSS_BIND",
    "STARTUPINFOEX_PROC_THREAD_ATTRIBUTE_JOB_LIST",
    "CREATE_SUSPENDED_BEFORE_ROOT_EXECUTION",
    "JOB_KILL_ON_CLOSE_AND_BREAKAWAY_DISABLED",
    "COMPLETION_PORT_ACTIVE_PROCESS_ZERO",
  ]);
  assert.deepEqual(choice.forbiddenFallbacks, [
    "PATH_ONLY_HASH_PLUS_GENERIC_SPAWN",
    "ASSIGN_JOB_AFTER_PROCESS_START",
    "PID_ENUMERATION_OR_PID_REUSE_CLEANUP",
    "TASKKILL_WMI_CIM_PROCESS_NAME_CLEANUP",
  ]);
});

test("toolchain identities and receipts are exactly unresolved", () => {
  const state = canonicalInputs().packet.toolchainIdentityState;
  for (const [field, value] of Object.entries(state)) {
    assert.equal(value, field === "allResolved" ? false : null, field);
  }
});

test("durable loopback B authority remains granted but inoperative in P00 and P01", () => {
  const state = canonicalInputs().packet.loopbackSigningB;
  assert.equal(state.authorityGranted, true);
  assert.equal(state.disposableLoopbackKeyGenerationAuthorized, true);
  assert.equal(state.disposableLoopbackLocalTransactionSigningAuthorized, true);
  assert.equal(state.operativeNow, false);
  assert.equal(state.mayBeExercisedInP00OrP01, false);
  assert.equal(state.publicRpcDevnetMainnetUseAuthorized, false);
  assert.equal(state.fundingAuthorized, false);
  assert.equal(state.automaticRetryAuthorized, false);
  assert.match(state.scopeExact, /^ONE_FRESH_OFF_REPOSITORY_LOOPBACK_ONLY_KEY_SET;/u);
  assert.match(state.holdReason, /NO_KEYS_MAY_BE_GENERATED/u);
});

test("P01 transition permits only source-schema-validator-built-in-test-doc work", () => {
  const state = canonicalInputs().packet.p01Transition;
  assert.equal(state.mayStartNow, true);
  assert.deepEqual(state.allowedWorkKinds, [
    "SOURCE_ONLY",
    "SCHEMA_ONLY",
    "VALIDATOR_ONLY",
    "NODE_BUILTIN_TESTS_ONLY",
    "DOCS_ONLY",
  ]);
  assert.deepEqual(state.forbiddenWorkKinds, [
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
  ]);
  assert.equal(state.requiresA2, false);
  assert.equal(state.requiresNewSigningAuthority, false);
  assert.equal(state.outputStatus, "HOLD");
  assert.equal(state.liveActionAuthorized, false);
});

test("blocker list is the exact unique lexicographically sorted 17-member set", () => {
  const blockers = canonicalInputs().packet.blockers;
  assert.equal(blockers.length, 17);
  assert.equal(new Set(blockers).size, 17);
  assert.deepEqual(blockers, [...blockers].sort((left, right) => left.localeCompare(right, "en")));
  assert.deepEqual(blockers, PHASE_B_AUTHORITY_BLOCKERS);

  expectMutationRejected(({ packet }) => packet.blockers.reverse(), /blockers/iu);
  expectMutationRejected(({ packet }) => packet.blockers.pop(), /blockers/iu);
  expectMutationRejected(
    ({ packet }) => { packet.blockers[0] = packet.blockers[1]; },
    /blockers/iu,
  );
});

test("strict parser rejects duplicate top-level and nested JSON members", () => {
  assert.throws(
    () => parsePhaseBAuthorityStateJson('{"schema":"one","schema":"two"}', "top"),
    /duplicate JSON member \$root\.schema/u,
  );
  assert.throws(
    () => parsePhaseBAuthorityStateJson(
      '{"authority":{"compilerExecutionAuthorized":false,"compilerExecutionAuthorized":true}}',
      "nested",
    ),
    /duplicate JSON member \$root\.authority\.compilerExecutionAuthorized/u,
  );
});

test("unknown members and canonical key-order drift fail closed", () => {
  expectMutationRejected(
    ({ packet }) => { packet.unrequestedAuthority = true; },
    /exact ordered keys|top-level schema order/iu,
  );
  expectMutationRejected(
    ({ packet }) => { packet.authority.unrequestedAuthority = true; },
    /packet\.authority.*exact ordered keys/iu,
  );
  {
    const inputs = cloneInputs();
    inputs.packet = {
      status: inputs.packet.status,
      schema: inputs.packet.schema,
      ...Object.fromEntries(Object.entries(inputs.packet).slice(2)),
    };
    const result = validatePhaseBAuthorityState(inputs);
    assertNonauthorizingHold(result, false);
    assert.match(result.violations.join("\n"), /exact ordered keys|top-level schema order/iu);
  }
  {
    const inputs = cloneInputs();
    const entries = Object.entries(inputs.packet.authority);
    inputs.packet.authority = Object.fromEntries([entries[1], entries[0], ...entries.slice(2)]);
    const result = validatePhaseBAuthorityState(inputs);
    assertNonauthorizingHold(result, false);
    assert.match(result.violations.join("\n"), /packet\.authority.*exact ordered keys/iu);
  }
  expectMutationRejected(
    ({ packet }) => packet.windowsLaunchLockChoice.requirements.reverse(),
    /windowsLaunchLockChoice\.requirements/iu,
  );
});

test("packet byte length and SHA-256 mutations fail closed", () => {
  expectMutationRejected(
    (inputs) => { inputs.packetBytes = Buffer.concat([inputs.packetBytes, Buffer.from("\n")]); },
    /packetBytes/iu,
  );
  expectMutationRejected((inputs) => {
    inputs.packetBytes = Buffer.from(inputs.packetBytes);
    inputs.packetBytes[100] ^= 1;
  }, /SHA-256/iu);
  const result = validatePhaseBAuthorityState({ packet: structuredClone(PHASE_B_AUTHORITY_EXPECTED) });
  assertNonauthorizingHold(result, false);
  assert.match(result.violations.join("\n"), /exact source bytes/iu);
});

test("exported canonical constants are recursively immutable", () => {
  assert.equal(Object.isFrozen(PHASE_B_AUTHORITY_EXPECTED), true);
  assert.equal(Object.isFrozen(PHASE_B_AUTHORITY_EXPECTED.authority), true);
  assert.equal(Object.isFrozen(PHASE_B_AUTHORITY_EXPECTED.windowsLaunchLockChoice.requirements), true);
  assert.throws(
    () => { PHASE_B_AUTHORITY_EXPECTED.authority.compilerExecutionAuthorized = true; },
    /read only|readonly|Cannot assign/iu,
  );
  assert.equal(PHASE_B_AUTHORITY_EXPECTED.authority.compilerExecutionAuthorized, false);
});

test("schema, status, readiness, authority, and public-claim mutations fail closed", () => {
  const mutators = [
    ({ packet }) => { packet.schema = "iat-b3-phase-b-p00-authority-state/v2"; },
    ({ packet }) => { packet.status = "READY"; },
    ({ packet }) => { packet.ready = true; },
    ({ packet }) => { packet.complete = true; },
    ({ packet }) => { packet.operative = true; },
    ({ packet }) => { packet.exitCode = 0; },
    ({ packet }) => { packet.authorityBasis.directBytesValidated = true; },
    ({ packet }) => { packet.windowsLaunchLockChoice.implemented = true; },
    ({ packet }) => { packet.windowsLaunchLockChoice.compiled = true; },
    ({ packet }) => { packet.windowsLaunchLockChoice.observed = true; },
    ({ packet }) => { packet.windowsLaunchLockChoice.executionAuthorized = true; },
    ({ packet }) => { packet.toolchainIdentityState.exactNodeRuntimeLiveIdentity = "self-declared"; },
    ({ packet }) => { packet.toolchainIdentityState.allResolved = true; },
    ({ packet }) => { packet.authority.standingSourceSchemaTestDocsAuthorized = false; },
    ({ packet }) => { packet.authority.readOnlyExistingToolchainObservationAuthorized = false; },
    ({ packet }) => { packet.authority.localWslDockerInspectionPermissionRecorded = false; },
    ({ packet }) => { packet.authority.offlineDerivedImageCreationPermissionRecorded = false; },
    ({ packet }) => { packet.authority.localContainerBuildsAndKeyFreeRehearsalPermissionRecorded = false; },
    ({ packet }) => { packet.authority.sourceLockedPolicyDefaultsAccepted = false; },
    ({ packet }) => { packet.authority.policyArtifactDraftingAllowed = false; },
    ({ packet }) => { packet.authority.a2SystemProvisioningAuthorized = true; },
    ({ packet }) => { packet.authority.systemMutationOperative = true; },
    ({ packet }) => { packet.authority.installOrDownloadAuthorized = true; },
    ({ packet }) => { packet.authority.externalNetworkAuthorized = true; },
    ({ packet }) => { packet.authority.compilerExecutionAuthorized = true; },
    ({ packet }) => { packet.authority.nativeHelperExecutionAuthorized = true; },
    ({ packet }) => { packet.authority.runtimeContainmentExecutionAuthorized = true; },
    ({ packet }) => { packet.authority.dockerExecutionOperative = true; },
    ({ packet }) => { packet.authority.rpcWriteOrBroadcastAuthorized = true; },
    ({ packet }) => { packet.authority.genericOrProductionKeyGenerationAuthorized = true; },
    ({ packet }) => {
      packet.authority.actualCryptographicSignaturesRequireFreshExactSubjectAndModelTPhysicalConfirmation = false;
    },
    ({ packet }) => { packet.loopbackSigningB.authorityGranted = false; },
    ({ packet }) => { packet.loopbackSigningB.disposableLoopbackKeyGenerationAuthorized = false; },
    ({ packet }) => { packet.loopbackSigningB.disposableLoopbackLocalTransactionSigningAuthorized = false; },
    ({ packet }) => { packet.loopbackSigningB.operativeNow = true; },
    ({ packet }) => { packet.loopbackSigningB.mayBeExercisedInP00OrP01 = true; },
    ({ packet }) => { packet.loopbackSigningB.publicRpcDevnetMainnetUseAuthorized = true; },
    ({ packet }) => { packet.loopbackSigningB.fundingAuthorized = true; },
    ({ packet }) => { packet.loopbackSigningB.automaticRetryAuthorized = true; },
    ({ packet }) => { packet.p01Transition.mayStartNow = false; },
    ({ packet }) => { packet.p01Transition.allowedWorkKinds.reverse(); },
    ({ packet }) => { packet.p01Transition.forbiddenWorkKinds.pop(); },
    ({ packet }) => { packet.p01Transition.requiresA2 = true; },
    ({ packet }) => { packet.p01Transition.requiresNewSigningAuthority = true; },
    ({ packet }) => { packet.p01Transition.liveActionAuthorized = true; },
    ({ packet }) => { packet.p01Transition.outputStatus = "READY"; },
    ({ packet }) => { packet.releaseAuthorized = true; },
    ({ packet }) => { packet.devnetAuthorizationRequested = true; },
    ({ packet }) => { packet.mainnetAuthorized = true; },
  ];
  for (const mutate of mutators) expectMutationRejected(mutate);
});

test("CLI emits the validated HOLD packet and exits exactly 2", () => {
  const result = spawnSync(process.execPath, [CLI_PATH], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 2, result.stderr || result.stdout);
  assert.equal(result.signal, null);
  const report = JSON.parse(result.stdout);
  assertNonauthorizingHold(report, true);
  assert.equal(report.sourceBytesValidated, true);
  assert.deepEqual(report.violations, []);

  const rejected = spawnSync(process.execPath, [CLI_PATH, "--packet", "elsewhere.json"], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(rejected.status, 1, rejected.stderr || rejected.stdout);
  assert.match(rejected.stderr, /usage:/u);
});

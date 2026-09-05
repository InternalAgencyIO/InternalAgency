import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as prerequisiteModule from "../scripts/lib/iat-b3-mandatory-ci-phase-b-prerequisite.mjs";

const {
  PHASE_B_PREREQUISITE_BLOCKERS,
  PHASE_B_PREREQUISITE_EXPECTED,
  PHASE_B_PREREQUISITE_PACKET_BYTES,
  PHASE_B_PREREQUISITE_PACKET_SHA256,
  PHASE_B_PREREQUISITE_SCHEMA,
  PHASE_B_PREREQUISITE_TOP_LEVEL_KEYS,
  loadPhaseBPrerequisiteBytes,
  parsePhaseBPrerequisiteBytes,
  parsePhaseBPrerequisiteJson,
  validatePhaseBPrerequisiteBytes,
} = prerequisiteModule;

const CLI_PATH = fileURLToPath(new URL(
  "../scripts/lib/iat-b3-mandatory-ci-phase-b-prerequisite.mjs",
  import.meta.url,
));
const MODULE_URL = new URL(
  "../scripts/lib/iat-b3-mandatory-ci-phase-b-prerequisite.mjs",
  import.meta.url,
).href;

const clone = () => JSON.parse(JSON.stringify(PHASE_B_PREREQUISITE_EXPECTED));
const encode = (packet) => Buffer.from(`${JSON.stringify(packet, null, 2)}\n`, "utf8");
const mutate = (callback) => {
  const packet = clone();
  callback(packet);
  return validatePhaseBPrerequisiteBytes(encode(packet));
};

test("canonical BP01 prerequisite packet is exact nonoperative HOLD", () => {
  const bytes = loadPhaseBPrerequisiteBytes();
  const result = validatePhaseBPrerequisiteBytes(bytes);
  assert.equal(bytes.length, PHASE_B_PREREQUISITE_PACKET_BYTES);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), PHASE_B_PREREQUISITE_PACKET_SHA256);
  assert.equal(result.valid, true);
  assert.equal(result.status, "HOLD");
  assert.equal(result.ready, false);
  assert.equal(result.complete, false);
  assert.equal(result.operative, false);
  assert.equal(result.exitCode, 2);
  assert.equal(result.sourceBytesValidated, true);
});

test("top-level group order is the exact frozen fourteen-member order", () => {
  assert.deepEqual(Object.keys(PHASE_B_PREREQUISITE_EXPECTED), PHASE_B_PREREQUISITE_TOP_LEVEL_KEYS);
  assert.equal(PHASE_B_PREREQUISITE_TOP_LEVEL_KEYS.length, 14);
  assert.equal(PHASE_B_PREREQUISITE_EXPECTED.schemaState.schema, PHASE_B_PREREQUISITE_SCHEMA);
});

test("BP00 physical descriptors bind source policy but no observation", () => {
  const binding = PHASE_B_PREREQUISITE_EXPECTED.authorityStateBinding;
  assert.equal(binding.packet.sha256, "6b0b50d9bcc4aa1116e33a5e1cda7fe03976e53b22f72529da3ff8c291d89b7c");
  assert.equal(binding.validator.sha256, "63a91ce06eceefa4c6fb737ac360d9f71fd7caf42eb34b8978cc9f20601319fd");
  assert.equal(binding.focusedTest.sha256, "1248781181051c33cf4587b457e1c2d111f437a97f2c404b48b7f57d9ef1f563");
  assert.equal(binding.descriptorBound, true);
  assert.equal(binding.physicalBytesObserved, false);
  assert.equal(binding.semanticStateObserved, false);
  assert.equal(binding.executionEvidence, false);
});

test("semantic digest remains exact null and unresolved", () => {
  assert.equal(PHASE_B_PREREQUISITE_EXPECTED.authorityStateBinding.structuralSemanticDigestSha256, null);
  assert.equal(PHASE_B_PREREQUISITE_BLOCKERS.includes(
    "BP00_STRUCTURAL_SEMANTIC_DIGEST_UNRESOLVED",
  ), true);
  for (const value of ["0".repeat(64), "null", 0, false]) {
    assert.equal(mutate((packet) => {
      packet.authorityStateBinding.structuralSemanticDigestSha256 = value;
    }).valid, false);
  }
});

test("source checkpoint and all source hashes remain unobserved null policy slots", () => {
  const source = PHASE_B_PREREQUISITE_EXPECTED.sourceCheckpointExpectation;
  assert.deepEqual(Object.values(source), [null, null, null, null, null, null, false]);
  assert.equal(mutate((packet) => { packet.sourceCheckpointExpectation.commitSha = "0".repeat(40); }).valid, false);
  assert.equal(mutate((packet) => { packet.sourceCheckpointExpectation.sourceClosureSha256 = "0".repeat(64); }).valid, false);
});

test("Windows launch-lock choice is design-only and rejects fallbacks", () => {
  const windows = PHASE_B_PREREQUISITE_EXPECTED.windowsLaunchLockExpectation;
  assert.equal(windows.mode, "SOURCE_BOUND_NATIVE_WINDOWS_LAUNCH_AND_LOCK");
  assert.equal(windows.selected, true);
  assert.equal(windows.implemented, false);
  assert.equal(windows.compiled, false);
  assert.equal(windows.capabilityObserved, false);
  assert.equal(windows.executionAuthorized, false);
  assert.equal(windows.requirements.length, 7);
  assert.equal(windows.forbiddenFallbacks.length, 4);
  assert.equal(mutate((packet) => { packet.windowsLaunchLockExpectation.implemented = true; }).valid, false);
});

test("toolchain identities cannot be supplied by BP01", () => {
  const toolchain = PHASE_B_PREREQUISITE_EXPECTED.toolchainExpectations;
  assert.equal(toolchain.identitiesObserved, false);
  assert.equal(toolchain.allResolved, false);
  for (const key of Object.keys(toolchain).slice(0, 8)) assert.equal(toolchain[key], null);
  assert.equal(mutate((packet) => { packet.toolchainExpectations.pinnedZigExecutableIdentity = "caller"; }).valid, false);
});

test("Linux and Windows platform capability facts are all false", () => {
  const platform = PHASE_B_PREREQUISITE_EXPECTED.platformCapabilityExpectations;
  assert.equal(Object.values(platform.linux).every((value) => value === false), true);
  assert.equal(Object.values(platform.windows).every((value) => value === false), true);
  assert.equal(platform.allObserved, false);
  assert.equal(mutate((packet) => { packet.platformCapabilityExpectations.linux.pidfdObserved = true; }).valid, false);
  assert.equal(mutate((packet) => { packet.platformCapabilityExpectations.windows.createSuspendedObserved = true; }).valid, false);
});

test("helper artifacts and compile/runtime receipts remain separate and absent", () => {
  const helper = PHASE_B_PREREQUISITE_EXPECTED.helperArtifactExpectations;
  assert.deepEqual(Object.values(helper), [null, null, null, null, null, null, false, false, false, false]);
  assert.equal(mutate((packet) => { packet.helperArtifactExpectations.helperCompiled = true; }).valid, false);
  assert.equal(mutate((packet) => { packet.helperArtifactExpectations.runtimeReceiptSha256 = "0".repeat(64); }).valid, false);
});

test("invocation envelope is policy-only and entirely unobserved", () => {
  const invocation = PHASE_B_PREREQUISITE_EXPECTED.invocationEnvelopeExpectations;
  assert.deepEqual(Object.values(invocation), [null, null, null, null, null, null, null, false]);
  assert.equal(mutate((packet) => { packet.invocationEnvelopeExpectations.observedInvocation = true; }).valid, false);
});

test("K44 four-file structural manifest is exact", () => {
  const structural = PHASE_B_PREREQUISITE_EXPECTED.publicInputBinding.k44StructuralBinding;
  assert.equal(structural.library.sha256, "296ba945f1842e9e0ede0158c38da3997061b465a51a4a67578216e40a2c80d0");
  assert.equal(structural.focusedTest.sha256, "ca7aee8197c9a918413f6fb35c518ed4df2a5a04cdecbcccb843d1c689467d3b");
  assert.equal(structural.documentation.sha256, "f9e65e024d2e26c1923d810fc7feba80a4b75788cf213670edcf6b2aa6689b65");
  assert.equal(structural.template.sha256, "176a855e8c53e8a9c5f6c555758e641e98e6eb1f7198220442a6531ab47b8884");
  assert.equal(structural.descriptorBound, true);
  assert.equal(structural.structuralOnly, true);
});

test("K44 exact five direct-observer booleans remain false", () => {
  const truth = PHASE_B_PREREQUISITE_EXPECTED.publicInputBinding.directObservationTruth;
  assert.deepEqual(Object.keys(truth), [
    "checkpointDirectlyObservedByThisModule",
    "wallClockDirectlyObservedByThisModule",
    "inputFilesDirectlyObservedByThisModule",
    "productionIdentityInventoryDirectlyObservedByThisModule",
    "priorLaneIdentityInventoryDirectlyObservedByThisModule",
  ]);
  assert.equal(Object.values(truth).every((value) => value === false), true);
  for (const key of Object.keys(truth)) {
    assert.equal(mutate((packet) => { packet.publicInputBinding.directObservationTruth[key] = true; }).valid, false);
  }
});

test("K44 direct observers cannot be replaced by generic observer records", () => {
  const result = mutate((packet) => {
    packet.publicInputBinding.futureDirectObservers = [{ name: "TOOLCHAIN_IDENTITY_OBSERVER" }];
  });
  assert.equal(result.valid, false);
  assert.equal(PHASE_B_PREREQUISITE_EXPECTED.publicInputBinding.allDirectObserversObserved, false);
  assert.equal(PHASE_B_PREREQUISITE_EXPECTED.publicInputBinding.callerSuppliedEvidenceAccepted, false);
});

test("daemon, storage, A2, and use-count expectations cannot authorize anything", () => {
  const daemon = PHASE_B_PREREQUISITE_EXPECTED.daemonStorageExpectations;
  assert.equal(daemon.a2SystemProvisioningAuthorized, false);
  assert.equal(daemon.daemonAvailable, false);
  assert.equal(daemon.expectedUseCount, 0);
  assert.equal(daemon.observedUseCount, null);
  assert.equal(daemon.trustDerived, false);
  assert.equal(mutate((packet) => { packet.daemonStorageExpectations.daemonAvailable = true; }).valid, false);
  assert.equal(mutate((packet) => { packet.daemonStorageExpectations.observedUseCount = 0; }).valid, false);
});

test("receipt source and abort policy forbid self-authorship, retry, and fallback", () => {
  const receipt = PHASE_B_PREREQUISITE_EXPECTED.receiptSourcePolicy;
  assert.equal(receipt.authority, "OBSERVER_OWNED_DIRECT_BYTES_ONLY");
  assert.equal(receipt.observerOwnedReceiptsRequired, true);
  assert.equal(receipt.callerSuppliedReceiptAccepted, false);
  assert.equal(receipt.selfDeclaredReceiptAccepted, false);
  assert.equal(receipt.injectedReceiptAccepted, false);
  assert.equal(receipt.compileAndRuntimeReceiptsSeparate, true);
  assert.equal(receipt.receiptSourceObserved, false);
  const abort = PHASE_B_PREREQUISITE_EXPECTED.abortPolicy;
  assert.deepEqual(Object.values(abort), ["HOLD", 2, false, false, false, false]);
});

test("truth envelope and validation projection are all nonexecuting", () => {
  const truth = PHASE_B_PREREQUISITE_EXPECTED.truthEnvelope;
  assert.equal(Object.values(truth).every((value) => value === false), true);
  for (const key of Object.keys(truth)) {
    assert.equal(mutate((packet) => { packet.truthEnvelope[key] = true; }).valid, false);
  }
  const result = validatePhaseBPrerequisiteBytes(loadPhaseBPrerequisiteBytes());
  assert.deepEqual(Object.keys(result), [
    "schema", "valid", "status", "ready", "complete", "operative", "exitCode",
    "sourceBytesValidated", "authorityDescriptorBound", "k44StructuralDescriptorBound",
    "structuralSemanticDigestResolved", "checkpointObserved", "toolchainIdentitiesResolved",
    "platformCapabilitiesObserved", "helperArtifactObserved", "invocationObserved",
    "k44DirectObserversObserved", "daemonStorageObserved", "compilerExecutionAuthorized",
    "nativeHelperExecutionAuthorized", "runtimeContainmentExecutionAuthorized", "buildExecuted",
    "runtimeExecuted", "dockerUsed", "networkUsed", "rpcUsed", "keyGenerated", "signed",
    "funded", "deployed", "publicDevnetRequested", "publicDevnetAuthorized",
    "mainnetAuthorized", "releaseAuthorized", "blockers", "violations",
  ]);
  for (const key of [
    "compilerExecutionAuthorized", "nativeHelperExecutionAuthorized",
    "runtimeContainmentExecutionAuthorized", "buildExecuted", "runtimeExecuted",
    "dockerUsed", "networkUsed", "rpcUsed", "keyGenerated", "signed", "funded",
    "deployed", "publicDevnetRequested", "publicDevnetAuthorized", "mainnetAuthorized",
    "releaseAuthorized",
  ]) assert.equal(result[key], false, key);
});

test("blockers are the exact unique code-unit-sorted 28-member closure", () => {
  assert.equal(PHASE_B_PREREQUISITE_BLOCKERS.length, 28);
  assert.equal(new Set(PHASE_B_PREREQUISITE_BLOCKERS).size, 28);
  assert.deepEqual(
    [...PHASE_B_PREREQUISITE_BLOCKERS].sort(),
    [...PHASE_B_PREREQUISITE_BLOCKERS],
  );
  assert.deepEqual(PHASE_B_PREREQUISITE_EXPECTED.blockers, [...PHASE_B_PREREQUISITE_BLOCKERS]);
  for (const index of [0, 1, 9, 13, 27]) {
    assert.equal(mutate((packet) => { packet.blockers.splice(index, 1); }).valid, false);
  }
});

test("strict parser rejects duplicate, escaped-equivalent, and nested duplicate keys", () => {
  for (const source of [
    '{"schemaState":{},"schemaState":{}}',
    '{"schemaState":{},"schema\\u0053tate":{}}',
    '{"schemaState":{"status":"HOLD","status":"GO"}}',
  ]) assert.throws(() => parsePhaseBPrerequisiteJson(source), /duplicate JSON member/u);
});

test("strict raw parser rejects malformed, trailing, BOM, and invalid UTF-8", () => {
  assert.throws(() => parsePhaseBPrerequisiteJson("{} trailing"), /unexpected trailing data/u);
  assert.throws(() => parsePhaseBPrerequisiteJson("{"), /unterminated JSON object/u);
  assert.throws(() => parsePhaseBPrerequisiteBytes(Buffer.from([0xef, 0xbb, 0xbf, 0x7b, 0x7d])));
  assert.throws(() => parsePhaseBPrerequisiteBytes(Buffer.from([0xc3, 0x28])));
});

test("physical byte mutations, truncation, append, and empty input fail closed", () => {
  const canonical = loadPhaseBPrerequisiteBytes();
  const flipped = Buffer.from(canonical);
  flipped[Math.floor(flipped.length / 2)] ^= 1;
  for (const bytes of [
    Buffer.alloc(0),
    canonical.subarray(0, canonical.length - 1),
    Buffer.concat([canonical, Buffer.from(" ")]),
    flipped,
  ]) {
    const result = validatePhaseBPrerequisiteBytes(bytes);
    assert.equal(result.valid, false);
    assert.equal(result.ready, false);
    assert.equal(result.operative, false);
    assert.equal(result.releaseAuthorized, false);
  }
});

test("non-byte object and accessor-bearing candidates fail without evidence projection", () => {
  let getterCalled = false;
  const candidate = {};
  Object.defineProperty(candidate, "packet", {
    get() { getterCalled = true; throw new Error("getter bomb"); },
  });
  const result = validatePhaseBPrerequisiteBytes(candidate);
  assert.equal(getterCalled, false);
  assert.equal(result.valid, false);
  assert.equal(result.authorityDescriptorBound, false);
  assert.equal(result.k44StructuralDescriptorBound, false);
});

test("hostile Proxy byte candidates reject without invoking traps", () => {
  let traps = 0;
  const candidate = new Proxy({}, {
    get() { traps += 1; throw new Error("get trap"); },
    getPrototypeOf() { traps += 1; throw new Error("prototype trap"); },
  });
  const result = validatePhaseBPrerequisiteBytes(candidate);
  assert.equal(traps, 0);
  assert.equal(result.valid, false);
  assert.equal(result.ready, false);
  assert.equal(result.releaseAuthorized, false);
});

test("SharedArrayBuffer-backed packet bytes are snapshotted before validation", () => {
  const canonical = loadPhaseBPrerequisiteBytes();
  const shared = new SharedArrayBuffer(canonical.length);
  const sharedView = Buffer.from(shared);
  canonical.copy(sharedView);
  const result = validatePhaseBPrerequisiteBytes(sharedView);
  sharedView.fill(0);
  assert.equal(result.valid, true);
  assert.equal(result.sourceBytesValidated, true);
  assert.equal(result.status, "HOLD");
  assert.equal(result.exitCode, 2);
  assert.equal(result.releaseAuthorized, false);
  assert.equal(validatePhaseBPrerequisiteBytes(sharedView).valid, false);
});

test("module import is silent and performs no implicit filesystem read", () => {
  const source = `
    import fs from "node:fs";
    import { syncBuiltinESMExports } from "node:module";
    const originalReadFileSync = fs.readFileSync;
    let packetReadCalls = 0;
    fs.readFileSync = (...args) => {
      if (String(args[0]).includes("iat-b3-mandatory-ci-phase-b-prerequisite.schema.v1.json")) {
        packetReadCalls += 1;
        throw new Error("implicit canonical-packet read");
      }
      return originalReadFileSync(...args);
    };
    syncBuiltinESMExports();
    await import(${JSON.stringify(`${MODULE_URL}?pure-import-check`)});
    if (packetReadCalls !== 0) process.exit(97);
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "");
});

test("nested key omission, insertion, and reorder fail closed", () => {
  assert.equal(mutate((packet) => { delete packet.receiptSourcePolicy.authority; }).valid, false);
  assert.equal(mutate((packet) => { packet.abortPolicy.unknown = false; }).valid, false);
  assert.equal(mutate((packet) => {
    packet.schemaState = {
      status: packet.schemaState.status,
      schema: packet.schemaState.schema,
      ready: false,
      complete: false,
      operative: false,
      exitCode: 2,
    };
  }).valid, false);
});

test("exported expected state is recursively immutable and exposes no execution API", () => {
  assert.equal(Object.isFrozen(PHASE_B_PREREQUISITE_EXPECTED), true);
  assert.equal(Object.isFrozen(PHASE_B_PREREQUISITE_EXPECTED.publicInputBinding), true);
  assert.throws(() => {
    PHASE_B_PREREQUISITE_EXPECTED.truthEnvelope.buildExecuted = true;
  }, TypeError);
  for (const key of Object.keys(prerequisiteModule)) {
    assert.doesNotMatch(key, /execute|build|spawn|provision|sign|deploy/iu);
  }
});

test("canonical CLI emits one validated HOLD record and exits exactly 2", () => {
  const result = spawnSync(process.execPath, [CLI_PATH], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 2);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout.endsWith("\n"), true);
  const output = JSON.parse(result.stdout);
  assert.equal(output.valid, true);
  assert.equal(output.status, "HOLD");
  assert.equal(output.ready, false);
  assert.equal(output.operative, false);
  assert.equal(output.releaseAuthorized, false);
});

test("CLI rejects every argument and cannot select a packet or action", () => {
  const result = spawnSync(process.execPath, [CLI_PATH, "--packet", "elsewhere.json"], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /^usage:/u);
});

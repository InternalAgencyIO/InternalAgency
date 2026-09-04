import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  IAT_B3_NATIVE_CONTAINMENT_COMMON_ZIG_ARGUMENTS,
  IAT_B3_NATIVE_CONTAINMENT_RECEIPT_SCHEMA,
  IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS,
  IAT_B3_NATIVE_CONTAINMENT_TIMING,
  assessNativeContainmentExecution,
  assessNativeContainmentPreflight,
  canonicalJson,
  createNativeContainmentCompileRecipe,
  inspectPortableExecutable,
  inspectStaticElf,
  observeNativeContainmentSourceClosure,
  parseJsonRejectingDuplicateKeys,
  parseNativeContainmentControlFrames,
  sanitizeNativeContainmentEnvironment,
  validateNativeContainmentBuildReceipt,
} from "../scripts/lib/iat-b3-mandatory-ci-containment-contract.mjs";
import {
  assessNativeRuntimeContainmentReceipt,
  createNativeRuntimeContainmentReceiptHold,
} from "../scripts/lib/iat-b3-mandatory-ci-runtime-containment-receipt.mjs";
import {
  assessNativeContainmentBuildAuthorization,
  parseNativeContainmentBuildArguments,
  runNativeContainmentBuildPreflight,
  runNativeContainmentReproducibleBuild,
} from "../scripts/build-iat-b3-mandatory-ci-containment.mjs";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPOSITORY_ROOT = resolve(SITE_ROOT, "../../..");
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

function readyTarget(target) {
  return {
    executablePath: "/pinned/zig",
    executableRealpath: "/pinned/zig",
    executableSha256: "a".repeat(64),
    executableByteLength: 1,
    versionStdoutSha256: "b".repeat(64),
    compilerClosureSha256: "c".repeat(64),
    binarySha256: "d".repeat(64),
    binaryByteLength: 1,
    ...(target === "linux-x64-musl"
      ? { muslSysrootClosureSha256: "e".repeat(64), elfImportAllowlist: [] }
      : { mingwSysrootClosureSha256: "f".repeat(64), peImportAllowlist: [] }),
  };
}

function readyPolicy() {
  return {
    schema: "iat-b3-mandatory-ci-containment-toolchains/v1",
    targets: {
      "linux-x64-musl": readyTarget("linux-x64-musl"),
      "windows-x64-gnu": readyTarget("windows-x64-gnu"),
    },
  };
}

function minimalPe() {
  const bytes = Buffer.alloc(512);
  bytes.write("MZ", 0, "ascii");
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.write("PE\0\0", 0x80, "ascii");
  bytes.writeUInt16LE(0x8664, 0x84);
  bytes.writeUInt16LE(1, 0x86);
  bytes.writeUInt16LE(240, 0x94);
  const optional = 0x98;
  bytes.writeUInt16LE(0x20b, optional);
  bytes.writeUInt16LE(3, optional + 68);
  bytes.writeUInt16LE(0x160, optional + 70);
  bytes.writeUInt32LE(16, optional + 108);
  const section = optional + 240;
  bytes.write(".text\0\0\0", section, "ascii");
  bytes.writeUInt32LE(80, section + 8);
  bytes.writeUInt32LE(0x1000, section + 12);
  bytes.writeUInt32LE(80, section + 16);
  bytes.writeUInt32LE(section + 40, section + 20);
  bytes.writeUInt32LE(0x60000020, section + 36);
  return bytes;
}

function minimalElf() {
  const bytes = Buffer.alloc(64 + 3 * 56);
  bytes.set([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0], 0);
  bytes.writeUInt16LE(3, 16);
  bytes.writeUInt16LE(62, 18);
  bytes.writeBigUInt64LE(64n, 32);
  bytes.writeUInt16LE(64, 52);
  bytes.writeUInt16LE(56, 54);
  bytes.writeUInt16LE(3, 56);
  let offset = 64;
  bytes.writeUInt32LE(1, offset);
  bytes.writeUInt32LE(5, offset + 4);
  offset += 56;
  bytes.writeUInt32LE(0x6474e551, offset);
  bytes.writeUInt32LE(6, offset + 4);
  offset += 56;
  bytes.writeUInt32LE(0x6474e552, offset);
  bytes.writeUInt32LE(4, offset + 4);
  return bytes;
}

function holdFrames(hash, extraReady = "", extraFinal = "") {
  return Buffer.from(
    `IAT_B3_CONTAINMENT_READY_V1 protocol=iat-b3-mandatory-ci-containment/v1 contract=${hash} startup=10000 execution=120000 finalization=5000 teardown=15000${extraReady}\n`
    + `IAT_B3_CONTAINMENT_FINAL_V1 protocol=iat-b3-mandatory-ci-containment/v1 contract=${hash} outcome=CONTAINMENT_HOLD elapsed=0 rootTerminal=0 rootExit=-1 rootSignal=0 reaped=0 empty=0 leak=0 zombies=0 resumed=0 intervention=0 startupExpired=0 executionExpired=0 finalizationExpired=0 teardownExpired=0 strictTap=0 protocolValid=0 absence=0 stdoutBytes=0 stdoutSha256=${EMPTY_SHA256} stdoutTruncated=0 stderrBytes=0 stderrSha256=${EMPTY_SHA256} stderrTruncated=0${extraFinal}\n`,
  );
}

test("timing contract fixes startup, execution, finalization, teardown, and outer ceilings", () => {
  assert.deepEqual(IAT_B3_NATIVE_CONTAINMENT_TIMING, {
    startupMs: 10_000, executionMs: 120_000, allFeatureExecutionMs: 180_000,
    finalizationMs: 5_000, teardownObservationMs: 15_000, parentGuardMs: 5_000,
    outerMs: 155_000, allFeatureOuterMs: 215_000,
    stdoutCapBytes: 64 * 1024 * 1024, stderrCapBytes: 64 * 1024 * 1024,
    diagnosticEdgeBytes: 2 * 1024,
  });
});

test("source closure contains exactly the approved 17 paths", () => {
  assert.equal(IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS.length, 7);
  assert.equal(new Set(IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS).size, 7);
  assert.equal(new Set(IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS.map((path) => path.toLowerCase())).size, 7);
  assert.equal(IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS.filter((path) => path.endsWith("/tap.c")).length, 1);
});

test("source closure directly hashes every approved current file", () => {
  const closure = observeNativeContainmentSourceClosure(REPOSITORY_ROOT);
  assert.equal(closure.files.length, 7);
  assert.match(closure.closureSha256, /^[0-9a-f]{64}$/u);
});

test("checked-in null toolchain policy remains HOLD", () => {
  const policy = JSON.parse(readFileSync(resolve(SITE_ROOT, "docs/b3/iat-b3-mandatory-ci-containment-toolchains.v1.json"), "utf8"));
  const result = assessNativeContainmentPreflight({ policy, sourceClosure: { closureSha256: "a".repeat(64) } });
  assert.equal(result.status, "HOLD");
  assert(result.blockers.includes("LINUX_X64_MUSL_TOOLCHAIN_UNMEASURED"));
});

test("40-hex Git head and tree are distinct from 64-hex artifact digests", () => {
  const result = assessNativeContainmentPreflight({ policy: readyPolicy(), sourceClosure: { closureSha256: "a".repeat(64) }, headSha: "1".repeat(40), treeSha: "2".repeat(40) });
  assert.equal(result.blockers.includes("EXACT_CLEAN_HEAD_UNOBSERVED"), false);
  assert.equal(result.blockers.includes("EXACT_CLEAN_TREE_UNOBSERVED"), false);
});

test("wrong-length Git object IDs fail closed", () => {
  for (const length of [39, 41, 64]) {
    const result = assessNativeContainmentPreflight({ policy: readyPolicy(), sourceClosure: { closureSha256: "a".repeat(64) }, headSha: "1".repeat(length), treeSha: "2".repeat(length) });
    assert(result.blockers.includes("EXACT_CLEAN_HEAD_UNOBSERVED"));
    assert(result.blockers.includes("EXACT_CLEAN_TREE_UNOBSERVED"));
  }
});

test("build authorization is a conjunction and Phase A still hard-disables it", () => {
  for (const explicit of [false, true]) for (const policy of [false, true]) {
    const result = assessNativeContainmentBuildAuthorization({ explicitExecuteRequest: explicit, checkedInPolicyAuthorization: policy });
    assert.equal(result.authorized, false);
    assert.equal(result.conjunctionObserved, explicit && policy);
    assert(result.blockers.includes("PHASE_B_NATIVE_BUILD_HARD_DISABLED"));
  }
});

test("hard-disable returns before an injected executor or output root is touched", async () => {
  let calls = 0;
  const result = await runNativeContainmentReproducibleBuild({ explicitExecuteRequest: true, checkedInPolicyAuthorization: true, outputRoot: "Z:/forbidden", executor: () => { calls += 1; } });
  assert.equal(calls, 0);
  assert.equal(result.status, "HOLD");
  assert.equal(result.outputRootTouched, false);
  assert.equal(result.buildExecuted, false);
});

test("build CLI grammar has no override or output-path surface", () => {
  assert.deepEqual(parseNativeContainmentBuildArguments([]), { mode: "PREFLIGHT" });
  for (const arguments_ of [["--execute"], ["--output-root", "x"], ["--execute", "--retry"], ["--execute", "x"]]) assert.throws(() => parseNativeContainmentBuildArguments(arguments_), /NATIVE_BUILD_EXECUTION_API_ABSENT_HOLD/u);
});

test("build preflight CLI is an exact machine HOLD", async () => {
  const report = await runNativeContainmentBuildPreflight({ repositoryRoot: REPOSITORY_ROOT });
  assert.equal(report.status, "HOLD");
  assert.equal(report.buildExecuted, false);
  assert.equal(report.outputRootTouched, false);
  assert.equal(report.runtimeEvidenceObserved, false);
});

test("compile recipes retain strict flags and remove the mismatched municode entry", () => {
  const temporaryRoot = resolve(SITE_ROOT, "bp06-static-temp");
  const environment = sanitizeNativeContainmentEnvironment({ home: resolve(SITE_ROOT, "bp06-static-home"), temporaryRoot, cacheRoot: resolve(SITE_ROOT, "bp06-static-cache") });
  const compilerPath = resolve(SITE_ROOT, "bp06-static-zig");
  const recipe = createNativeContainmentCompileRecipe({ target: "windows-x64-gnu", sourceClosureSha256: "a".repeat(64), contractSha256: "b".repeat(64), compilerPath, cwd: temporaryRoot, outputPath: resolve(temporaryRoot, "out.exe"), environment, repositoryRoot: REPOSITORY_ROOT });
  assert.equal(recipe.argv[0], compilerPath);
  assert.deepEqual(recipe.argv.slice(1, IAT_B3_NATIVE_CONTAINMENT_COMMON_ZIG_ARGUMENTS.length + 1), IAT_B3_NATIVE_CONTAINMENT_COMMON_ZIG_ARGUMENTS);
  assert.equal(recipe.argv.includes("-municode"), false);
});

test("build environment is exact and excludes inherited loader/network variables", () => {
  process.env.LD_PRELOAD = "hostile";
  const environment = sanitizeNativeContainmentEnvironment({ home: resolve(SITE_ROOT, "h"), temporaryRoot: resolve(SITE_ROOT, "t"), cacheRoot: resolve(SITE_ROOT, "c") });
  assert.equal(environment.LD_PRELOAD, undefined);
  assert.equal(environment.PATH, "");
  delete process.env.LD_PRELOAD;
});

test("canonical JSON is deterministic and integer-only", () => {
  assert.equal(canonicalJson({ z: 1, a: true }), '{"a":true,"z":1}');
  assert.throws(() => canonicalJson({ value: 1.5 }), /UNSAFE_NUMBER_HOLD/u);
});

test("strict JSON parsing rejects duplicate keys at every depth", () => {
  assert.deepEqual(parseJsonRejectingDuplicateKeys('{"a":{"b":1}}'), { a: { b: 1 } });
  assert.throws(() => parseJsonRejectingDuplicateKeys('{"a":{"b":1,"b":2}}'), /DUPLICATE_KEY_HOLD/u);
});

test("PE parser rejects malformed bytes", () => {
  assert.throws(() => inspectPortableExecutable(Buffer.alloc(512), { allowedImports: [] }), /PE_DOS_HEADER_HOLD/u);
});

test("PE structural parse cannot claim final policy validation in Phase A", () => {
  assert.throws(() => inspectPortableExecutable(minimalPe(), { allowedImports: [] }), /_HOLD/u);
});

test("ELF parser rejects malformed bytes", () => {
  assert.throws(() => inspectStaticElf(Buffer.alloc(256)), /ELF_MAGIC_HOLD/u);
});

test("ELF structural parse cannot claim final policy validation in Phase A", () => {
  assert.throws(() => inspectStaticElf(minimalElf()), /_HOLD/u);
});

test("receipt exact schema rejects unknown semantic fields", () => {
  const mutated = { forged: true };
  const result = validateNativeContainmentBuildReceipt(mutated, { policy: readyPolicy() });
  assert(result.blockers.includes("RECEIPT_EXACT_SCHEMA_INVALID"));
  assert.equal(result.valid, false);
});

test("receipt validates Git and artifact digest lengths independently", () => {
  const result = assessNativeRuntimeContainmentReceipt(Buffer.from("{}"));
  assert.equal(result.status, "HOLD");
  assert.equal(result.compileProvenanceObserved, false);
  assert.equal(result.runtimeEvidenceObserved, false);
  assert.equal(result.releaseAuthorized, false);
});

test("receipt rejects a self-rehashed semantic mutation", () => {
  const duplicate = Buffer.from('{"schema":"x","schema":"y"}');
  const result = assessNativeRuntimeContainmentReceipt(duplicate);
  assert.equal(result.candidateDisposition, "REJECTED_HOLD");
  assert(result.blockers.includes("JSON_DUPLICATE_KEY_HOLD"));
  assert.equal(result.runtimeEvidenceObserved, false);
});

test("receipt requires complete direct artifact and log paths", () => {
  const result = assessNativeRuntimeContainmentReceipt(Buffer.from('{"schema":"x"}'));
  assert.equal(result.candidateDisposition, "REJECTED_HOLD");
  assert.equal(result.sameObjectRuntimeObserved, false);
  assert.equal(result.cleanupObserved, false);
  assert.equal(result.containmentEmptyObserved, false);
});

test("receipt remains observer-owned HOLD even when structural fields are coherent", () => {
  const result = createNativeRuntimeContainmentReceiptHold();
  assert.equal(result.valid, false);
  assert.equal(result.status, "HOLD");
  assert.equal(result.ready, false);
  assert.equal(result.complete, false);
  assert.equal(result.compileProvenanceObserved, false);
  assert.equal(result.runtimeEvidenceObserved, false);
  assert(result.blockers.includes("DIRECT_RECEIPT_SOURCE_OBSERVATION_REQUIRED"));
});

test("exact HOLD control frames parse with complete exact keys", () => {
  const hash = "a".repeat(64);
  const parsed = parseNativeContainmentControlFrames(holdFrames(hash), { contractSha256: hash, executionMs: 120_000 });
  assert.equal(parsed.ready.execution, 120_000);
  assert.equal(parsed.final.outcome, "CONTAINMENT_HOLD");
  assert.equal(parsed.final.rootTerminal, false);
  assert.equal(parsed.final.rootExit, -1);
  assert.equal(parsed.final.stdoutSha256, EMPTY_SHA256);
});

test("control frames reject duplicate and unknown fields", () => {
  const hash = "a".repeat(64);
  const valid = holdFrames(hash).toString("utf8");
  for (const [mutated, code] of [
    [holdFrames(hash, " contract=duplicate"), /DUPLICATE_KEY_HOLD/u],
    [holdFrames(hash, " unknown=x"), /EXACT_KEYS_HOLD/u],
    [Buffer.from(valid.replace("startup=10000", "startup=010000")), /STARTUP_RANGE_HOLD/u],
    [Buffer.from(valid.replace("elapsed=0", "elapsed=00")), /ELAPSED_RANGE_HOLD/u],
    [Buffer.from(valid.replace("rootTerminal=0", "rootTerminal=2")), /ROOT_TERMINAL_TYPE_HOLD/u],
    [Buffer.from(valid.replace(`stdoutSha256=${EMPTY_SHA256}`, `stdoutSha256=${EMPTY_SHA256.toUpperCase()}`)), /STDOUT_DIGEST_HOLD/u],
    [Buffer.from(valid.replace("contract=aaaaaaaa", "contract=aaaaaaaa=")), /TOKEN_HOLD/u],
    [Buffer.concat([Buffer.from(valid.slice(0, -1)), Buffer.from([0xff, 0x0a])]), /UTF8_HOLD/u],
  ]) assert.throws(() => parseNativeContainmentControlFrames(mutated, { contractSha256: hash, executionMs: 120_000 }), code);
});

test("Phase A control parser categorically rejects PASS", () => {
  const hash = "a".repeat(64);
  const valid = holdFrames(hash).toString("utf8");
  for (const [mutated, code] of [
    [valid.replace("outcome=CONTAINMENT_HOLD", "outcome=PASS"), /CONTROL_PASS_FORBIDDEN_HOLD/u],
    [valid.replace("rootExit=-1", "rootExit=0"), /STATE_CROSS_FIELD_HOLD/u],
    [valid.replace("empty=0", "empty=1"), /STATE_CROSS_FIELD_HOLD/u],
    [valid.replace("outcome=CONTAINMENT_HOLD", "outcome=TIMEOUT"), /OUTCOME_CROSS_FIELD_HOLD/u],
    [valid.replace("stdoutTruncated=0", "stdoutTruncated=1"), /STREAM_CROSS_FIELD_HOLD/u],
    [valid.replace("elapsed=0", "elapsed=155001"), /ELAPSED_RANGE_HOLD/u],
    [valid.replace("startupExpired=0", "startupExpired=1").replace("resumed=0", "resumed=1"), /STATE_CROSS_FIELD_HOLD/u],
  ]) assert.throws(() => parseNativeContainmentControlFrames(Buffer.from(mutated), { contractSha256: hash, executionMs: 120_000 }), code);
});

test("external execution candidates always remain HOLD", () => {
  const result = assessNativeContainmentExecution({ status: "PASS", ready: true, complete: true, executionProvenanceObserved: true });
  assert.equal(result.status, "HOLD");
  assert.equal(result.executionProvenanceObserved, false);
});

test("platform sources are categorical no-process Phase-A state machines", () => {
  const linuxSource = readFileSync(resolve(SITE_ROOT, "native/iat-b3-mandatory-ci-containment/src/platform_linux.c"), "utf8");
  const windowsSource = readFileSync(resolve(SITE_ROOT, "native/iat-b3-mandatory-ci-containment/src/platform_windows.c"), "utf8");
  assert.match(linuxSource, /SYS_clone3/u);
  assert.match(linuxSource, /CLONE_NEWUSER \| CLONE_NEWPID \| CLONE_NEWNS/u);
  assert.match(linuxSource, /IAT_B3_OUTCOME_CONTAINMENT_HOLD/u);
  assert.match(windowsSource, /PROC_THREAD_ATTRIBUTE_JOB_LIST/u);
  assert.match(windowsSource, /CREATE_SUSPENDED/u);
  assert.match(windowsSource, /remain HOLD before CreateProcessW/u);
  assert.match(windowsSource, /same-object/u);
  assert.match(windowsSource, /IAT_B3_OUTCOME_CONTAINMENT_HOLD/u);
  const commonSource = readFileSync(resolve(SITE_ROOT, "native/iat-b3-mandatory-ci-containment/src/common.c"), "utf8");
  assert(commonSource.indexOf("#define _POSIX_C_SOURCE 200809L") < commonSource.indexOf("#include \"iat_b3_containment.h\""));
  assert.match(windowsSource, /frequency\.QuadPart > UINT64_MAX \/ 1000ULL/u);
});

test("main initializes HOLD and validates every invariant before FINAL", () => {
  const source = readFileSync(resolve(SITE_ROOT, "native/iat-b3-mandatory-ci-containment/src/main.c"), "utf8");
  assert(source.indexOf("result.outcome = IAT_B3_OUTCOME_CONTAINMENT_HOLD") < source.indexOf("iat_b3_platform_run"));
  assert(source.indexOf("!result.strict_tap_validated") < source.indexOf("iat_b3_emit_final_frame"));
  assert(source.indexOf("!result.absence_proof_observed") < source.indexOf("iat_b3_emit_final_frame"));
});

test("native and build sources expose no shell network loader key or legacy PID cleanup surface", () => {
  const sources = IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS
    .filter((path) => path.endsWith(".c") || path.endsWith(".h") || path.endsWith("build-iat-b3-mandatory-ci-containment.mjs"))
    .map((path) => readFileSync(resolve(REPOSITORY_ROOT, path), "utf8")).join("\n");
  for (const forbidden of ["system(", "popen(", "ShellExecute", "socket(", "connect(", "dlopen(", "LoadLibrary", "spawnSync", "process.kill(", "killpg", "taskkill"]) assert.equal(sources.includes(forbidden), false, forbidden);
});

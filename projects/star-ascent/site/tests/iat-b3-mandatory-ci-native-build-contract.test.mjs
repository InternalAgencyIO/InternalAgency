import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createNativeContainmentBuildPlan,
  semanticSha256,
} from "../scripts/lib/iat-b3-mandatory-ci-containment-contract.mjs";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = resolve(
  SITE_ROOT,
  "scripts/lib/iat-b3-mandatory-ci-containment-contract.mjs",
);
const BUILDER_PATH = resolve(
  SITE_ROOT,
  "scripts/build-iat-b3-mandatory-ci-containment.mjs",
);
const DOC_PATH = resolve(
  SITE_ROOT,
  "docs/b3/MANDATORY_CI_NATIVE_BUILD_PROVENANCE.md",
);
const contract = readFileSync(CONTRACT_PATH, "utf8");
const builder = readFileSync(BUILDER_PATH, "utf8");
const documentation = readFileSync(DOC_PATH, "utf8");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const nativeFreeze = Object.freeze({
  "native/iat-b3-mandatory-ci-containment/include/iat_b3_containment.h":
    [6_170, "92231be31f8769af1e2aaf1f67110e79ca6280dee623e5057b7355ef89b0c125"],
  "native/iat-b3-mandatory-ci-containment/src/common.c":
    [17_279, "b42dd6476e1b0389fa0549a3e28b4272e6d5cc627c3b73aabcc1a09b7e771523"],
  "native/iat-b3-mandatory-ci-containment/src/main.c":
    [1_967, "31e08712268fce6a850d1842d36415677af3a5d2539769b69081357a26821e60"],
  "native/iat-b3-mandatory-ci-containment/src/platform_linux.c":
    [50_129, "d0e61dea8256a6059039a57dcbc1c8b5f0bd4565fb209ea0143da6ec0e59400c"],
  "native/iat-b3-mandatory-ci-containment/src/platform_windows.c":
    [43_151, "8bd538a8eebb2ae2b511347bd2c9bd5541af90df73e11c320acf635ab51bba4a"],
  "native/iat-b3-mandatory-ci-containment/src/sha256.c":
    [5_508, "05eb096860e4d81cbdd08fe00327ee2a032f69dd9bd991ee55c62c821d791e60"],
  "native/iat-b3-mandatory-ci-containment/src/tap.c":
    [4_670, "daa5a5263ab5c53fce98a01762a42b4a9a12f984562d9e42ff5480d3872635d5"],
  "tests/iat-b3-mandatory-ci-linux-containment-source.test.mjs":
    [23_067, "1dd4a660e6c772b266b700b213ac6931783a72feb79ed469922f14ef2b269d5e"],
  "tests/iat-b3-mandatory-ci-windows-containment-source.test.mjs":
    [16_648, "eaff41d72361a55ce9f2031e3b2e970c083706d30c009892391f9f1ec353e2de"],
});

function sliceFunction(name, nextName) {
  const start = contract.indexOf(name);
  const end = nextName === undefined
    ? contract.length : contract.indexOf(nextName, start);
  assert.notEqual(start, -1, `missing ${name}`);
  assert.notEqual(end, -1, `missing ${nextName}`);
  return contract.slice(start, end);
}

test("accepted BP02, BP04 and BP05 native inputs remain byte exact", () => {
  for (const [path, [expectedLength, expectedSha256]] of Object.entries(nativeFreeze)) {
    const bytes = readFileSync(resolve(SITE_ROOT, path));
    assert.equal(bytes.byteLength, expectedLength, `${path}:length`);
    assert.equal(sha256(bytes), expectedSha256, `${path}:sha256`);
  }
});

test("source closure is the exact sorted seven-file link input including tap.c", () => {
  const match = contract.match(
    /IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS = Object\.freeze\(\[([\s\S]*?)\]\);/u,
  );
  assert.ok(match);
  const paths = [...match[1].matchAll(/"([^"]+)"/gu)].map((entry) => entry[1]);
  const expected = Object.keys(nativeFreeze)
    .filter((path) => path.startsWith("native/"))
    .map((path) => `projects/star-ascent/site/${path}`);
  assert.deepEqual(paths, expected);
  assert.equal(new Set(paths).size, 7);
  assert.equal(new Set(paths.map((path) => path.toLowerCase())).size, 7);
  assert.equal(paths.filter((path) => path.endsWith("/tap.c")).length, 1);
  assert.doesNotMatch(match[1], /workflow|package\.json|\.test\.mjs/u);
  assert.match(contract, /sourceFiles\.length !== 6[\s\S]*\/tap\.c/u);
});

test("source and contract observations reject link, alias and path races", () => {
  const read = sliceFunction(
    "function readRegularSameFile",
    "export function observeNativeContainmentSourceClosure",
  );
  const observe = sliceFunction(
    "export function observeNativeContainmentSourceClosure",
    "export function observeNativeContainmentBuildContractClosure",
  );
  assert.match(read, /lstatSync[\s\S]*isSymbolicLink[\s\S]*nlink !== 1n/u);
  assert.match(read, /openSync[\s\S]*fstatSync[\s\S]*dev[\s\S]*ino/u);
  assert.match(read, /mtimeNs[\s\S]*ctimeNs[\s\S]*EXTERNAL_FILE_CHANGED_DURING_READ_HOLD/u);
  assert.match(observe, /length !== 7[\s\S]*\.sort\(\)[\s\S]*toLowerCase[\s\S]*tap\.c/u);
  assert.match(contract, /LINK_SOURCE_SET_INCOMPLETE_HOLD/u);
});

test("recursive toolchain closure binds every required role to unchanged objects", () => {
  const closure = sliceFunction(
    "export function validateNativeContainmentToolchainClosure",
    "function readRegularSameFile",
  );
  for (const role of [
    "compiler", "compiler-runtime", "header", "linker",
    "runtime-library", "sysroot",
  ]) assert.match(contract, new RegExp(`"${role}"`, "u"));
  assert.match(closure, /before[\s\S]*after[\s\S]*sameObservedDescriptor/u);
  assert.match(closure, /DUPLICATE_CASE_ALIAS_OR_FILE_ID/u);
  assert.match(closure, /fileRoleKeys[\s\S]*TOOLCHAIN_FILE_ROLE_DUPLICATE_HOLD/u);
  assert.match(closure, /rootEntry\.roles\.includes\("compiler"\)/u);
  assert.match(closure, /adjacency[\s\S]*pending[\s\S]*reached\.size !== paths\.length/u);
  assert.ok(
    closure.indexOf("const adjacency =")
      < closure.indexOf("adjacency.has(candidate.rootExecutablePath)"),
    "the adjacency map must exist before root membership is checked",
  );
  assert.match(closure, /closureSha256[\s\S]*semanticSha256/u);
  assert.match(closure, /authoritative: false/u);
});

test("swapped target closures fail at plan receipt toolchain and sysroot boundaries", () => {
  const guard = sliceFunction(
    "function requireTargetedToolchainClosure",
    "function readRegularSameFile",
  );
  assert.match(guard, /validated\.target !== expectedTarget/u);
  for (const marker of [
    "BUILD_PLAN_TOOLCHAIN_TARGET_MAP_KEY_MISMATCH_HOLD",
    "TOOLCHAIN_PREIMAGE_TARGET_MAP_KEY_MISMATCH_HOLD",
    "RECEIPT_TOOLCHAIN_TARGET_MAP_KEY_MISMATCH_HOLD",
    "SYSROOT_PREIMAGE_CLOSURE_MISMATCH_HOLD",
  ]) assert.match(contract, new RegExp(marker, "u"));
  assert.match(contract, /toolchain\.target !== target \|\| sysroot\.target !== target/u);
  assert.match(contract, /toolchainClosures\[plan\.target\]\.target !== plan\.target/u);

  const observerSessionId = "1".repeat(64);
  const makeClosure = (target, suffix) => {
    const roles = [
      "compiler", "compiler-runtime", "header", "linker",
      "runtime-library", "sysroot",
    ];
    const entries = roles.map((role, index) => {
      const path = resolve(
        SITE_ROOT, `../../../../bp06-static-${suffix}-${index}-${role}`,
      );
      const descriptor = {
        byteLength: 1,
        fileId: `static-${suffix}-${index}`,
        realpath: path,
        sha256: "2".repeat(64),
      };
      return { path, roles: [role], before: descriptor, after: descriptor };
    });
    const executable = entries[0].path;
    const semantic = {
      schema: "iat-b3-mandatory-ci-native-toolchain-closure/v1",
      target,
      observerSessionId,
      rootExecutablePath: executable,
      entries,
      edges: entries.slice(1).map((entry) => ({
        from: executable, kind: "loads", to: entry.path,
      })),
    };
    return { ...semantic, closureSha256: semanticSha256(semantic) };
  };
  assert.throws(() => createNativeContainmentBuildPlan({
    repositoryRoot: SITE_ROOT,
    isolatedParentRoot: resolve(SITE_ROOT, "../../../../bp06-static-plan"),
    sourceClosureSha256: "3".repeat(64),
    contractSha256: "4".repeat(64),
    policySha256: "5".repeat(64),
    observerSessionId,
    toolchainClosures: {
      "linux-x64-musl": makeClosure("windows-x64-gnu", "wrong-linux"),
      "windows-x64-gnu": makeClosure("windows-x64-gnu", "windows"),
    },
  }), { code: "BUILD_PLAN_TOOLCHAIN_TARGET_MAP_KEY_MISMATCH_HOLD" });
});

test("build plan fixes executable argv environment cwd and four disjoint lanes", () => {
  const zig = sliceFunction(
    "function exactNativeContainmentZigArgv",
    "export function createNativeContainmentCompileRecipe",
  );
  const recipe = sliceFunction(
    "export function createNativeContainmentCompileRecipe",
    "export function sanitizeNativeContainmentEnvironment",
  );
  const plan = sliceFunction(
    "export function createNativeContainmentBuildPlan",
    "function readU16",
  );
  assert.match(recipe, /repositoryRoot = REPO_ROOT[\s\S]*realpathSync\.native\(resolve\(repositoryRoot\)\)/u);
  assert.match(recipe, /BUILD_ENVIRONMENT_EXACT_SCHEMA_HOLD[\s\S]*BUILD_ENVIRONMENT_VALUE_HOLD/u);
  assert.match(recipe, /executablePath: compilerPath[\s\S]*argv[\s\S]*cwd[\s\S]*environment/u);
  assert.match(zig, /compilerPath,[\s\S]*\.\.\.IAT_B3_NATIVE_CONTAINMENT_COMMON_ZIG_ARGUMENTS/u);
  assert.match(contract, /COMMON_ZIG_ARGUMENTS = Object\.freeze\(\[[\s\S]*"cc"/u);
  assert.doesNotMatch(zig, /slice\(1\)/u);
  assert.match(zig, /-ffile-prefix-map=\$\{repository\}[\s\S]*-fdebug-prefix-map=\$\{repository\}[\s\S]*sourceFiles\.map/u);
  assert.match(recipe, /recipeSha256: normalizedRecipeSha256/u);
  assert.match(plan, /sanitizeNativeContainmentEnvironment[\s\S]*environment,[\s\S]*repositoryRoot: repository/u);
  assert.match(plan, /IAT_B3_NATIVE_CONTAINMENT_TARGETS[\s\S]*IAT_B3_NATIVE_CONTAINMENT_BUILD_LANES/u);
  assert.match(plan, /pathsDisjoint\(repository, isolatedParentRoot\)/u);
  assert.match(plan, /BUILD_PLAN_LANE_ROOT_OVERLAP_HOLD/u);
  assert.match(contract, /function exactNativeContainmentLanePaths/u);
  assert.match(contract, /root = resolve\(isolatedParentRoot, `\$\{target\}-\$\{lane\}`\)/u);
  assert.match(contract, /plan\.root !== expectedPaths\.root[\s\S]*plan\.logPath !== expectedPaths\.logPath/u);
  assert.match(contract, /BUILD_PLAN_LANE_ROLE_PATH_OVERLAP_HOLD/u);
  assert.match(contract, /BUILD_PLAN_NONCANONICAL_OR_ROLE_PATH_ALIAS_HOLD/u);
  assert.match(plan, /absenceRequirements[\s\S]*invocationSha256[\s\S]*canonicalPlan/u);
  assert.match(plan, /policySha256[\s\S]*observerSessionId/u);
  assert.match(plan, /buildAuthorized: false[\s\S]*buildExecuted: false/u);
  assert.match(contract, /ZIG_GLOBAL_CACHE_DIR/u);
  assert.match(contract, /ZIG_LOCAL_CACHE_DIR/u);
  assert.match(contract, /PATH: ""/u);
  assert.match(contract, /process\.platform === "win32" \? "NUL" : "\/dev\/null"/u);
  assert.doesNotMatch(contract, /NUL_OR_DEV_NULL/u);
});

test("canonical external preimages separate bytes from trust and bind every closure", () => {
  const external = sliceFunction(
    "function openTrustedCanonicalPreimage",
    "export function validateNativeContainmentBuildReceipt",
  );
  assert.match(external, /parseCanonicalExternalJson[\s\S]*TRUST_ANCHOR_MISMATCH_HOLD/u);
  assert.match(external, /policyPreimageBytes[\s\S]*sourcePreimageBytes[\s\S]*contractPreimageBytes/u);
  assert.match(external, /toolchainPreimageBytesByTarget[\s\S]*sysrootPreimageBytesByTarget/u);
  assert.match(external, /expectedRoles: \["policy", "builder", "contract"\]/u);
  assert.match(external, /fileIds\.has\(entry\.descriptor\.fileId\)/u);
  assert.match(external, /policyPreimage\.descriptor[\s\S]*contractPreimage\.entries\[0\]\.descriptor/u);
  assert.match(external, /contractFileIds[\s\S]*SOURCE_CONTRACT_CROSS_CLOSURE_FILE_ID_ALIAS_HOLD/u);
  assert.match(external, /canonicalJson\(toolchain\)[\s\S]*receipt\.toolchainClosures/u);
  assert.match(external, /expectedSysroot[\s\S]*SYSROOT_PREIMAGE_CLOSURE_MISMATCH_HOLD/u);
  assert.match(contract, /artifactPaths = \{\}, externalEvidence = null, externalTrust = null/u);
});

test("canonical plan and observer bind absence, causation, A/B bytes and exact invocation", () => {
  const external = sliceFunction(
    "function validateCanonicalBuildPlan",
    "export function validateNativeContainmentBuildReceipt",
  );
  assert.match(external, /expectedArgv = exactNativeContainmentZigArgv/u);
  assert.match(external, /expectedEnvironment = sanitizeNativeContainmentEnvironment/u);
  assert.match(external, /plan\.root !== build\.root[\s\S]*plan\.outputPath !== build\.artifactPath/u);
  assert.match(external, /absenceRequirements[\s\S]*rootAbsentBeforeBuild: true/u);
  assert.match(external, /expectedInvocationSha256[\s\S]*invocations\.has/u);
  assert.match(external, /rootAbsenceObservedAtMonotonicMs[\s\S]*rootCreatedAtMonotonicMs[\s\S]*startedAtMonotonicMs/u);
  assert.match(external, /artifactCreatedAtMonotonicMs[\s\S]*logCreatedAtMonotonicMs[\s\S]*causationSha256/u);
  assert.match(external, /invocationSha256 !== plan\.invocationSha256/u);
  assert.match(external, /observedArgv[\s\S]*plan\.argv[\s\S]*observedEnvironment[\s\S]*plan\.environment/u);
  assert.match(external, /observedCwd !== plan\.cwd/u);
  assert.match(external, /executableDescriptor[\s\S]*rootExecutableEntry\.before/u);
  assert.match(external, /artifactCreatorProcessIdentity !== evidence\.processIdentity/u);
  assert.match(external, /logCreatorProcessIdentity !== evidence\.processIdentity/u);
  assert.match(external, /terminal\.exitCode !== 0[\s\S]*terminal\.signaled !== false/u);
  assert.match(external, /artifactBytesByBuildId[\s\S]*logBytesByBuildId[\s\S]*first\.equals\(second\)/u);
  assert.match(external, /BUILD_OBSERVER_FILE_ID_REPLAY_HOLD/u);
});

test("receipt requires exactly A and B with byte equality and no stale mixing", () => {
  const receipt = sliceFunction(
    "export function validateNativeContainmentBuildReceipt",
    "export function parseNativeContainmentControlFrames",
  );
  assert.match(receipt, /receipt\.builds\.length !== 4/u);
  assert.match(receipt, /expectedBuildIds[\s\S]*BUILD_ORDER_DUPLICATE_OR_MISSING/u);
  assert.match(receipt, /BUILD_ROOT_CROSS_LANE_MIX/u);
  assert.match(receipt, /artifactSha256 !== second\.artifactSha256[\s\S]*artifactByteLength !== second\.artifactByteLength/u);
  assert.match(receipt, /DIRECT_BYTE_EQUALITY_HOLD/u);
  assert.match(receipt, /toolchainClosureSha256 !== closureDigests/u);
  assert.match(receipt, /observerSessionId !== receipt\.observerSessionId/u);
  assert.match(receipt, /compilerClosureSha256[\s\S]*executableSha256[\s\S]*executableByteLength[\s\S]*executableRealpath/u);
  assert.match(receipt, /sysrootEntries[\s\S]*semanticSha256\(sysrootEntries\)[\s\S]*RECEIPT_TOOLCHAIN_POLICY_OBJECT_BINDING_HOLD/u);
});

test("artifacts and logs require direct same-object reads and hostile PE/ELF policy", () => {
  const receipt = sliceFunction(
    "export function validateNativeContainmentBuildReceipt",
    "export function parseNativeContainmentControlFrames",
  );
  const pe = sliceFunction(
    "export function inspectPortableExecutable",
    "export function inspectStaticElf",
  );
  const elf = sliceFunction(
    "export function inspectStaticElf",
    "function policyTargetReady",
  );
  assert.equal((receipt.match(/readRegularSameFile\(/gu) ?? []).length, 2);
  assert.match(receipt, /inspectStaticElf[\s\S]*inspectPortableExecutable/u);
  assert.match(receipt, /observerSessionId[\s\S]*claim\.descriptor\.realpath[\s\S]*RECEIPT_\$\{kind\}_OBSERVER_BINDING_HOLD/u);
  assert.match(receipt, /DIRECT_OBSERVER_PATH_RECEIPT_MISMATCH_HOLD[\s\S]*sameObservedDescriptor/u);
  assert.match(receipt, /first\.equals\(second\)[\s\S]*DIRECT_ARTIFACT_BYTE_COMPARISON_HOLD/u);
  for (const marker of [
    "PE_COFF_SYMBOL_TABLE_FORBIDDEN_HOLD", "PE_BASE_RELOCATION_REQUIRED_HOLD",
    "PE_WRITE_EXECUTE_SECTION_HOLD", "PE_ENTRY_SECTION_POLICY_HOLD",
    "PE_OVERLAY_OR_UNMAPPED_BYTES_HOLD", "PE_IMPORT_ALLOWLIST_MISMATCH_HOLD",
    "PE_DIRECTORY_RANGE_HOLD", "PE_IMPORT_DIRECTORY_RANGE_HOLD",
    "PE_DUPLICATE_IMPORT_DESCRIPTOR_HOLD",
    "PE_DIRECTORY_CONTINUOUS_MAPPING_HOLD",
    "PE_IMPORT_NAME_CONTINUOUS_MAPPING_HOLD",
    "PE_DATA_DIRECTORY_COUNT_OVER_16_HOLD",
    "PE_SECTION_RAW_OVERLAP_HOLD", "PE_SECTION_VIRTUAL_OVERLAP_HOLD",
  ]) assert.match(pe, new RegExp(marker, "u"));
  assert.doesNotMatch(pe, /Math\.min\(readU32\([^\n]+16\)/u);
  for (const marker of [
    "ELF_PT_INTERP_FORBIDDEN_HOLD", "ELF_DYNAMIC_NEEDED_FORBIDDEN_HOLD",
    "ELF_RELRO_REQUIRED_HOLD", "ELF_GNU_STACK_REQUIRED_HOLD",
    "ELF_WRITE_EXECUTE_SEGMENT_HOLD", "ELF_ENTRY_LOAD_POLICY_HOLD",
    "ELF_SYMBOL_DYNAMIC_RELOCATION_SECTION_HOLD",
    "ELF_OVERLAY_OR_UNMAPPED_BYTES_HOLD",
    "ELF_EXTENDED_SECTION_TABLE_HOLD", "ELF_PT_LOAD_VIRTUAL_OVERLAP_HOLD",
    "ELF_PT_LOAD_FILE_OVERLAP_HOLD", "ELF_RELRO_NONZERO_RANGE_HOLD",
    "ELF_RELRO_NOT_MAPPED_BY_PT_LOAD_HOLD",
  ]) assert.match(elf, new RegExp(marker, "u"));
  assert.match(elf, /rawProgramCount === 0xffff[\s\S]*sectionOffset \+ 44/u);
  assert.match(elf, /rawSectionCount === 0[\s\S]*sectionOffset \+ 32/u);
  assert.match(elf, /rawSectionNameIndex === 0xffff[\s\S]*sectionOffset \+ 40/u);
  assert.doesNotMatch(`${pe}\n${elf}`, /UNIMPLEMENTED_HOLD/u);
});

test("PE descriptor and import-name reads cannot escape their mapped raw section", () => {
  const pe = sliceFunction(
    "export function inspectPortableExecutable",
    "export function inspectStaticElf",
  );
  assert.match(pe, /const mapContinuousRawRvaRange/u);
  assert.match(pe, /end <= entry\.virtualAddress \+ entry\.rawSize/u);
  assert.match(pe, /offsetEnd > section\.rawOffset \+ section\.rawSize/u);
  assert.match(pe, /descriptor \+ 20 > descriptorEnd/u);
  assert.match(pe, /\[0, 4, 8, 12, 16\]\.every/u);
  assert.match(pe, /nameLimit = Math\.min\(nameMapping\.sectionRawEnd, cursor \+ 260\)/u);
});

test("continuous 2GiB observation covers outside writes through identity cleanup", () => {
  const receipt = sliceFunction(
    "export function validateNativeContainmentBuildReceipt",
    "export function parseNativeContainmentControlFrames",
  );
  assert.match(contract, /MAX_OBSERVED_BYTES = 2 \* 1024 \* 1024 \* 1024/u);
  assert.match(contract, /MAX_SAMPLE_GAP_MS = 250/u);
  assert.match(receipt, /monitoringStartedBeforeBuilds !== true/u);
  assert.match(receipt, /monitoringEndedAfterCleanup !== true/u);
  assert.match(receipt, /noOutsideWrites !== true/u);
  assert.match(receipt, /RESOURCE_SAMPLE_CONTINUITY_OR_CAP_HOLD/u);
  assert.match(receipt, /cumulativeOutsideWriteCount !== 0[\s\S]*writeObserverFileId/u);
  assert.match(receipt, /monitoringStartedAtMonotonicMs[\s\S]*monitoringStoppedAtMonotonicMs/u);
  assert.match(receipt, /monitoringStartedAtMonotonicMs[\s\S]*>= resource\.samples\[0\]\.monotonicMs/u);
  assert.match(receipt, /monitoringStoppedAtMonotonicMs[\s\S]*<= resource\.cleanupFinishedAtMonotonicMs/u);
  assert.match(receipt, /latestBuild[\s\S]*cleanup\.startedAtMonotonicMs < latestBuild/u);
  assert.match(receipt, /allIdentitiesMatched !== true[\s\S]*allRootsAbsent !== true[\s\S]*ambiguousIdentity !== false/u);
  assert.match(receipt, /removedAtMonotonicMs[\s\S]*CLEANUP_ROOT_IDENTITY_OR_CHRONOLOGY_HOLD/u);
  assert.match(contract, /RESOURCE_SAMPLE_ROOT_IDENTITY_CHRONOLOGY_HOLD/u);
  assert.match(contract, /expectedLiveRootFileIds[\s\S]*RESOURCE_SAMPLE_LIVE_ROOT_IDENTITY_SET_HOLD/u);
  assert.match(contract, /RESOURCE_OBSERVER_DID_NOT_PRECEDE_ROOT_ABSENCE_HOLD/u);
  assert.match(contract, /sample\.observerSessionId !== receipt\.observerSessionId/u);
  assert.match(contract, /sample\.writeObserverFileId !== resource\.writeObserverFileId/u);
  assert.match(contract, /cleanup\.writeObserverFileId !== resource\.writeObserverFileId/u);
  assert.match(contract, /CANONICAL_EXTERNAL_BUILD_PREIMAGES_REQUIRED_HOLD/u);
});

test("direct authority remains negative and self-digests cannot promote", () => {
  const authority = sliceFunction(
    "export function observeNativeContainmentAuthoritySource",
    "export function createNativeContainmentCompileRecipe",
  );
  const receipt = sliceFunction(
    "export function validateNativeContainmentBuildReceipt",
    "export function parseNativeContainmentControlFrames",
  );
  assert.match(contract, /6b0b50d9bcc4aa1116e33a5e1cda7fe03976e53b22f72529da3ff8c291d89b7c/u);
  assert.match(authority, /compilerExecutionAuthorized !== false[\s\S]*nativeHelperExecutionAuthorized !== false[\s\S]*runtimeContainmentExecutionAuthorized !== false/u);
  assert.match(receipt, /SELF_DIGEST_IS_NONAUTHORITATIVE/u);
  assert.match(receipt, /valid: false[\s\S]*ready: false[\s\S]*complete: false/u);
  assert.match(receipt, /executionProvenanceObserved: false[\s\S]*runtimeEvidenceObserved: false/u);
});

test("builder exposes preflight only and never executes a compiler or helper", () => {
  assert.match(builder, /arguments_\.length === 0[\s\S]*mode: "PREFLIGHT"/u);
  assert.match(builder, /NATIVE_BUILD_EXECUTION_API_ABSENT_HOLD/u);
  assert.match(builder, /PHASE_B_NATIVE_BUILD_HARD_DISABLED/u);
  assert.match(builder, /NO_EXECUTION_IMPLEMENTATION_IN_BP06/u);
  assert.match(builder, /CANONICAL_EXTERNAL_PREIMAGE_BUNDLE_UNAVAILABLE/u);
  assert.match(builder, /CANONICAL_BUILD_PLAN_AND_CAUSATION_UNAVAILABLE/u);
  assert.match(builder, /process\.exitCode = 2/u);
  assert.doesNotMatch(builder, /node:child_process|spawn(?:Sync)?\s*\(|exec(?:File|Sync)?\s*\(|compile\s*\(/u);
});

test("documentation states the exact structural HOLD boundary", () => {
  for (const phrase of [
    "Status: **HOLD — structural source only**",
    "exactly these seven case-sensitive paths",
    "four builds in this order",
    "2,147,483,648 bytes",
    "Self-digested",
    "Build provenance and runtime containment are separate predicates",
  ]) assert.match(documentation.toLowerCase(), new RegExp(phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(documentation, /does not observe a compiler[\s\S]*run a[\s\S]*compiler or helper/u);
  assert.doesNotMatch(documentation, /CAPABILITY_OBSERVED|BUILD_PROVENANCE_ACCEPTED|RUNTIME_READY/u);
});

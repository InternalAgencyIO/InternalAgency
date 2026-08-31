import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NATIVE_ROOT = resolve(
  SITE_ROOT,
  "native/iat-b3-mandatory-ci-containment",
);
const PATHS = Object.freeze({
  header: resolve(NATIVE_ROOT, "include/iat_b3_containment.h"),
  main: resolve(NATIVE_ROOT, "src/main.c"),
  common: resolve(NATIVE_ROOT, "src/common.c"),
  sha256: resolve(NATIVE_ROOT, "src/sha256.c"),
  tap: resolve(NATIVE_ROOT, "src/tap.c"),
});

const read = (path) => readFileSync(path, "utf8");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sources = Object.freeze(Object.fromEntries(
  Object.entries(PATHS).map(([name, path]) => [name, read(path)]),
));

const CONTRACT_PATH = resolve(
  SITE_ROOT,
  "scripts/lib/iat-b3-mandatory-ci-containment-contract.mjs",
);
const CONTRACT_TEST_PATH = resolve(
  SITE_ROOT,
  "tests/iat-b3-mandatory-ci-containment.test.mjs",
);
const contractSource = read(CONTRACT_PATH);

const READY_FIELDS = Object.freeze([
  "protocol",
  "contract",
  "startup",
  "execution",
  "finalization",
  "teardown",
]);
const FINAL_FIELDS = Object.freeze([
  "protocol",
  "contract",
  "outcome",
  "elapsed",
  "rootTerminal",
  "rootExit",
  "rootSignal",
  "reaped",
  "empty",
  "leak",
  "zombies",
  "resumed",
  "intervention",
  "startupExpired",
  "executionExpired",
  "finalizationExpired",
  "teardownExpired",
  "strictTap",
  "protocolValid",
  "absence",
  "stdoutBytes",
  "stdoutSha256",
  "stdoutTruncated",
  "stderrBytes",
  "stderrSha256",
  "stderrTruncated",
]);

const TAP_CASE_NAMES = Object.freeze([
  "timing contract fixes startup, execution, finalization, teardown, and outer ceilings",
  "source closure contains exactly the approved 17 paths",
  "source closure directly hashes every approved current file",
  "checked-in null toolchain policy remains HOLD",
  "40-hex Git head and tree are distinct from 64-hex artifact digests",
  "wrong-length Git object IDs fail closed",
  "build authorization is a conjunction and Phase A still hard-disables it",
  "hard-disable returns before an injected executor or output root is touched",
  "build CLI grammar has no override or output-path surface",
  "build preflight CLI is an exact machine HOLD",
  "compile recipes retain strict flags and remove the mismatched municode entry",
  "build environment is exact and excludes inherited loader/network variables",
  "canonical JSON is deterministic and integer-only",
  "strict JSON parsing rejects duplicate keys at every depth",
  "PE parser rejects malformed bytes",
  "PE structural parse cannot claim final policy validation in Phase A",
  "ELF parser rejects malformed bytes",
  "ELF structural parse cannot claim final policy validation in Phase A",
  "receipt exact schema rejects unknown semantic fields",
  "receipt validates Git and artifact digest lengths independently",
  "receipt rejects a self-rehashed semantic mutation",
  "receipt requires complete direct artifact and log paths",
  "receipt remains observer-owned HOLD even when structural fields are coherent",
  "exact HOLD control frames parse with complete exact keys",
  "control frames reject duplicate and unknown fields",
  "Phase A control parser categorically rejects PASS",
  "external execution candidates always remain HOLD",
  "platform sources are categorical no-process Phase-A state machines",
  "main initializes HOLD and validates every invariant before FINAL",
  "native and build sources expose no shell network loader key or legacy PID cleanup surface",
]);

function extractFormatFields(source, frameMacro) {
  const start = source.indexOf(`${frameMacro}\n      " protocol=`);
  assert.notEqual(start, -1, `${frameMacro} format missing`);
  const end = source.indexOf("\\n\",", start);
  assert.notEqual(end, -1, `${frameMacro} terminator missing`);
  return [...source.slice(start, end).matchAll(/\b([A-Za-z][A-Za-z0-9]*)=%/gu)]
    .map((match) => match[1]);
}

test("admitted native containment interface bytes remain exact", () => {
  const contract = readFileSync(CONTRACT_PATH);
  const contractTest = readFileSync(CONTRACT_TEST_PATH);
  assert.equal(contract.byteLength, 100_777);
  assert.equal(
    sha256(contract),
    "d82c931bca9907ec79df3610c3bfc210a68deb0213792302febf10afe859714d",
  );
  assert.equal(contractTest.byteLength, 18_044);
  assert.equal(
    sha256(contractTest),
    "437571821a14eb60de550bac204b2f8e3885766760a30f32296db57076df2813",
  );
});

test("BP06 source closure adds tap exactly once without weakening legacy HOLD", () => {
  const start = contractSource.indexOf(
    "export const IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS",
  );
  const end = contractSource.indexOf("]);", start);
  assert(start >= 0 && end > start);
  const paths = [...contractSource.slice(start, end).matchAll(
    /"(projects\/star-ascent\/site\/native\/[^"\r\n]+)"/gu,
  )].map((match) => match[1]);
  assert.deepEqual(paths, [
    "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/include/iat_b3_containment.h",
    "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/src/common.c",
    "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/src/main.c",
    "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/src/platform_linux.c",
    "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/src/platform_windows.c",
    "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/src/sha256.c",
    "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/src/tap.c",
  ]);
  assert.equal(new Set(paths).size, 7);
  assert.equal(new Set(paths.map((path) => path.toLowerCase())).size, 7);
  assert.equal(paths.filter((path) => path.endsWith("/tap.c")).length, 1);
  assert.match(contractSource, /SOURCE_LIST_INCOMPLETE_DUPLICATE_OR_CASE_ALIAS_HOLD/u);
  assert.match(contractSource, /COMMON_ZIG_ARGUMENTS = Object\.freeze\(\[[\s\S]*"cc"/u);
  assert.doesNotMatch(contractSource, /COMMON_ZIG_ARGUMENTS\.slice\(1\)/u);
  assert.match(contractSource, /externalEvidence = null[\s\S]*externalTrust = null/u);
  assert.match(contractSource, /CANONICAL_EXTERNAL_BUILD_PREIMAGES_REQUIRED_HOLD/u);
  assert.match(contractSource, /valid: false[\s\S]*ready: false[\s\S]*complete: false[\s\S]*executionProvenanceObserved: false[\s\S]*runtimeEvidenceObserved: false/u);
  assert.match(contractSource, /buildAuthorized: false[\s\S]*buildExecuted: false/u);
  assert.match(contractSource, /if \(final\.outcome === "PASS"\) fail\("PHASE_A_CONTROL_PASS_FORBIDDEN_HOLD"\)/u);
  assert.doesNotMatch(contractSource, /(?:buildProvenanceObserved|executionProvenanceObserved|runtimeEvidenceObserved): true/u);
});

test("header binds exact protocol, timing, caps, identifiers and HOLD defaults", () => {
  for (const literal of [
    '#define IAT_B3_CONTAINMENT_PROTOCOL "iat-b3-mandatory-ci-containment/v1"',
    '#define IAT_B3_READY_FRAME "IAT_B3_CONTAINMENT_READY_V1"',
    '#define IAT_B3_FINAL_FRAME "IAT_B3_CONTAINMENT_FINAL_V1"',
    "#define IAT_B3_STARTUP_DEADLINE_MS 10000ULL",
    "#define IAT_B3_DEFAULT_EXECUTION_DEADLINE_MS 120000ULL",
    "#define IAT_B3_ALL_FEATURE_EXECUTION_DEADLINE_MS 180000ULL",
    "#define IAT_B3_FINALIZATION_DEADLINE_MS 5000ULL",
    "#define IAT_B3_TEARDOWN_OBSERVATION_DEADLINE_MS 15000ULL",
    "#define IAT_B3_PARENT_GUARD_MS 5000ULL",
    "#define IAT_B3_DEFAULT_OUTER_DEADLINE_MS 155000ULL",
    "#define IAT_B3_ALL_FEATURE_OUTER_DEADLINE_MS 215000ULL",
    "#define IAT_B3_STREAM_CAP_BYTES (64ULL * 1024ULL * 1024ULL)",
    "#define IAT_B3_DIAGNOSTIC_EDGE_BYTES 2048U",
    "#define IAT_B3_GIT_OBJECT_HEX_LENGTH 40U",
    "#define IAT_B3_SHA256_HEX_LENGTH 64U",
    "#define IAT_B3_PHASE_A_EXECUTION_ENABLED 0",
    "#define IAT_B3_CANONICAL_TAP_MANIFEST_BOUND 1",
    "#define IAT_B3_CANONICAL_TAP_GRAMMAR_COMPLETE 0",
    "#define IAT_B3_CANONICAL_TAP_TRANSCRIPT_DIGEST_BOUND 0",
    "#define IAT_B3_CANONICAL_TAP_SOURCE_BYTES 18044ULL",
    "#define IAT_B3_CANONICAL_TAP_ORDERED_NAMES_JSON_BYTES 1855U",
    "#define IAT_B3_CANONICAL_TAP_CASE_COUNT 30U",
    '#define IAT_B3_CANONICAL_TAP_VERSION_LINE "TAP version 13"',
    '#define IAT_B3_CANONICAL_TAP_PLAN_LINE "1..30"',
    "#define IAT_B3_CANONICAL_TAP_SUMMARY_LINE_COUNT 8U",
    "#define IAT_B3_CANONICAL_TAP_PLAN_LINE_FROM_EOF 9U",
    '#define IAT_B3_CANONICAL_TAP_SUMMARY_TESTS "# tests 30"',
    '#define IAT_B3_CANONICAL_TAP_SUMMARY_SUITES "# suites 0"',
    '#define IAT_B3_CANONICAL_TAP_SUMMARY_PASS "# pass 30"',
    '#define IAT_B3_CANONICAL_TAP_SUMMARY_FAIL "# fail 0"',
    '#define IAT_B3_CANONICAL_TAP_SUMMARY_CANCELLED "# cancelled 0"',
    '#define IAT_B3_CANONICAL_TAP_SUMMARY_SKIPPED "# skipped 0"',
    '#define IAT_B3_CANONICAL_TAP_SUMMARY_TODO "# todo 0"',
    '#define IAT_B3_CANONICAL_TAP_SUMMARY_DURATION_PREFIX "# duration_ms "',
    "#define IAT_B3_CANONICAL_TAP_DIRECTIVES_ALLOWED 0",
    "#define IAT_B3_CANONICAL_TAP_BAILOUT_ALLOWED 0",
    "#define IAT_B3_CANONICAL_TAP_TRAILING_LINES_ALLOWED 0",
    '#define IAT_B3_CONTAINMENT_CONTRACT_SHA256 "UNBOUND_CONTRACT"',
  ]) assert(sources.header.includes(literal), literal);
  assert.match(sources.header, /#define IAT_B3_EXIT_PASS 0[\s\S]*#define IAT_B3_EXIT_INTERNAL 1[\s\S]*#define IAT_B3_EXIT_HOLD 2/u);
});

test("outcome source identifiers retain the exact admitted order", () => {
  const outcomeNames = [
    "PASS",
    "TIMEOUT",
    "OUTPUT_LIMIT",
    "SPAWN_ERROR",
    "SIGNAL",
    "NONZERO",
    "INCOMPLETE_TAP",
    "CONTAINMENT_HOLD",
    "INTERNAL_HOLD",
  ];
  let cursor = -1;
  for (const name of outcomeNames) {
    const next = sources.header.indexOf(`IAT_B3_OUTCOME_${name}`, cursor + 1);
    assert(next > cursor, name);
    cursor = next;
  }
  const namesBlock = sources.common.slice(
    sources.common.indexOf("static const char *names[]"),
    sources.common.indexOf("return outcome >=", sources.common.indexOf("static const char *names[]")),
  );
  assert.deepEqual(
    [...namesBlock.matchAll(/"(PASS|TIMEOUT|OUTPUT_LIMIT|SPAWN_ERROR|SIGNAL|NONZERO|INCOMPLETE_TAP|CONTAINMENT_HOLD|INTERNAL_HOLD)"/gu)]
      .map((match) => match[1]),
    outcomeNames,
  );
});

test("main is categorically HOLD before argument, workload or frame handling", () => {
  const guard = sources.main.indexOf("#if !IAT_B3_PHASE_A_EXECUTION_ENABLED");
  const hold = sources.main.indexOf("IAT_B3_CONTAINMENT_PHASE_A_HARD_DISABLED_HOLD");
  const parse = sources.main.indexOf("iat_b3_parse_config");
  const platform = sources.main.indexOf("iat_b3_platform_run");
  assert(guard >= 0 && hold > guard && parse > hold && platform > parse);
  assert.match(sources.main, /return IAT_B3_EXIT_HOLD;\n#else/u);
  assert(sources.main.indexOf("result.outcome = IAT_B3_OUTCOME_CONTAINMENT_HOLD") < platform);
  assert(sources.main.indexOf("result.root_exit_code = -1") < platform);
  assert(sources.main.indexOf("iat_b3_emit_ready_frame") < platform);
  assert(sources.main.indexOf("iat_b3_validate_result_invariants") < sources.main.indexOf("iat_b3_emit_final_frame"));
});

test("configuration parser is canonical, closed, ordered and range-bound", () => {
  const flags = [
    "--startup-ms",
    "--execution-ms",
    "--finalization-ms",
    "--teardown-ms",
    "--stdout-cap",
    "--stderr-cap",
    "--",
  ];
  let cursor = sources.common.indexOf("int iat_b3_parse_config");
  for (const flag of flags) {
    const next = sources.common.indexOf(`\"${flag}\"`, cursor + 1);
    assert(next > cursor, flag);
    cursor = next;
  }
  assert.match(sources.common, /cursor\[0\] == '0' && cursor\[1\] != '\\0'/u);
  assert.match(sources.common, /parsed > \(UINT64_MAX - digit\) \/ 10ULL/u);
  assert.match(sources.common, /MISSING_DUPLICATE_UNKNOWN_REORDERED_OR_RANGE_HOLD/u);
  assert.match(sources.common, /CHILD_COMMAND_SEPARATOR_REQUIRED/u);
  assert.match(sources.common, /CHILD_COMMAND_REQUIRED/u);
});

test("Git object and SHA-256 identifiers accept only exact lowercase hex lengths", () => {
  assert.match(sources.common, /is_lower_hex_exact\(text, IAT_B3_GIT_OBJECT_HEX_LENGTH\)/u);
  assert.match(sources.common, /is_lower_hex_exact\(text, IAT_B3_SHA256_HEX_LENGTH\)/u);
  assert.match(sources.common, /value >= '0' && value <= '9'/u);
  assert.match(sources.common, /value >= 'a' && value <= 'f'/u);
  assert.equal(/[0-9a-f]{40}/u.test("a".repeat(40)), true);
  assert.equal(/^[0-9a-f]{40}$/u.test("A".repeat(40)), false);
  assert.equal(/^[0-9a-f]{64}$/u.test("f".repeat(64)), true);
  assert.equal(/^[0-9a-f]{64}$/u.test("f".repeat(63)), false);
});

test("READY and FINAL formats bind exact ordered keys", () => {
  assert.deepEqual(extractFormatFields(sources.common, "IAT_B3_READY_FRAME"), READY_FIELDS);
  assert.deepEqual(extractFormatFields(sources.common, "IAT_B3_FINAL_FRAME"), FINAL_FIELDS);
  assert.match(sources.common, /!iat_b3_validate_config\(config\)/u);
  assert.match(sources.common, /!iat_b3_is_lower_hex_sha256\(IAT_B3_CONTAINMENT_CONTRACT_SHA256\)/u);
  const finalFunction = sources.common.slice(sources.common.indexOf("int iat_b3_emit_final_frame"));
  assert(finalFunction.indexOf("iat_b3_validate_result_invariants") < finalFunction.indexOf("snprintf"));
});

test("control numeric, boolean, digest and stream ranges are exact", () => {
  for (const literal of [
    "result->root_exit_code < -1",
    "result->root_signal < 0",
    "result->root_signal > 255",
    "result->zombie_descendant_count > 1000000ULL",
    "observation->bytes_observed > cap_bytes * 2ULL",
    "observation->bytes_observed > cap_bytes ? 1 : 0",
  ]) assert(sources.common.includes(literal), literal);
  assert.match(sources.header, /int root_exit_code;/u);
  assert.match(sources.common, /static int is_boolean\(int value\) \{ return value == 0 \|\| value == 1; \}/u);
  assert.match(sources.common, /0xe3U, 0xb0U, 0xc4U, 0x42U/u);
  assert.match(sources.common, /memcmp\(observation->digest, empty_sha256/u);
});

test("control state cross-field invariants mirror the admitted parser", () => {
  for (const required of [
    "!result->root_terminal_observed",
    "result->root_exit_code != -1",
    "result->root_terminal_observed && result->root_signal == 0",
    "result->root_terminal_observed && result->root_signal > 0",
    "result->direct_child_reaped && !result->root_terminal_observed",
    "result->containment_empty",
    "result->absence_proof_observed && !result->containment_empty",
    "result->strict_tap_validated",
    "result->startup_deadline_expired && result->workload_resumed",
    "result->execution_deadline_expired && !result->workload_resumed",
    "result->teardown_deadline_expired",
  ]) assert(sources.common.includes(required), required);
});

test("outcome cross-semantics remain fail-closed and Phase A forbids PASS", () => {
  const passCase = sources.common.slice(
    sources.common.indexOf("case IAT_B3_OUTCOME_PASS:"),
    sources.common.indexOf("case IAT_B3_OUTCOME_TIMEOUT:"),
  );
  assert.match(passCase, /Phase-A control parser rejects PASS categorically/u);
  assert.match(passCase, /return 0;/u);
  assert.match(sources.common, /case IAT_B3_OUTCOME_TIMEOUT:\n      return result->execution_deadline_expired;/u);
  assert.match(sources.common, /case IAT_B3_OUTCOME_OUTPUT_LIMIT:[\s\S]*cap_exceeded/u);
  assert.match(sources.common, /case IAT_B3_OUTCOME_SIGNAL:[\s\S]*root_signal > 0/u);
  assert.match(sources.common, /case IAT_B3_OUTCOME_NONZERO:[\s\S]*root_exit_code > 0/u);
  assert.match(sources.common, /case IAT_B3_OUTCOME_INCOMPLETE_TAP:\n      return !result->strict_tap_validated;/u);
  assert.match(sources.common, /case IAT_B3_OUTCOME_SPAWN_ERROR:[\s\S]*!result->root_terminal_observed/u);
});

test("TAP acceptance is impossible while diagnostic grammar and transcript identity are absent", () => {
  const arrayBlock = sources.tap.slice(
    sources.tap.indexOf("canonical_case_names[]"),
    sources.tap.indexOf("};", sources.tap.indexOf("canonical_case_names[]")),
  );
  const sourceNames = [...arrayBlock.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"/gu)]
    .map((match) => JSON.parse(`"${match[1]}"`));
  assert.deepEqual(sourceNames, TAP_CASE_NAMES);
  const namesJson = Buffer.from(JSON.stringify(TAP_CASE_NAMES));
  assert.equal(namesJson.byteLength, 1_855);
  assert.equal(
    sha256(namesJson),
    "7262d1251645ce869697b6afc6aa446951c3f72184b14a772a4fa2553c846e33",
  );
  assert.match(sources.header, /tests\/iat-b3-mandatory-ci-containment\.test\.mjs/u);
  assert.match(sources.header, /437571821a14eb60de550bac204b2f8e3885766760a30f32296db57076df2813/u);
  assert.match(sources.header, /--test-reporter=tap/u);
  assert.match(sources.header, /--test-concurrency=1/u);
  assert.match(sources.tap, /#if IAT_B3_CANONICAL_TAP_GRAMMAR_COMPLETE \|\|/u);
  assert.match(sources.tap, /CANONICAL_TAP_DIAGNOSTIC_GRAMMAR_OR_TRANSCRIPT_DIGEST_UNBOUND_HOLD/u);
  for (const barrier of [
    "!IAT_B3_CANONICAL_TAP_MANIFEST_BOUND",
    "!IAT_B3_CANONICAL_TAP_GRAMMAR_COMPLETE",
    "!IAT_B3_CANONICAL_TAP_TRANSCRIPT_DIGEST_BOUND",
  ]) {
    assert.equal(sources.common.split(barrier).length, 3, barrier);
  }
  const validatorBody = sources.tap.slice(sources.tap.indexOf("int iat_b3_validate_tap_transcript"));
  assert.equal(/\breturn\s+1\s*;/u.test(validatorBody), false);
  for (const mutationClass of [
    "missing",
    "duplicate",
    "unknown",
    "out-of-range",
    "bailout",
    "trailing",
    "incomplete",
    "wrong-case-name",
    "wrong-source-identity",
  ]) {
    assert.equal(sources.tap.includes(`ACCEPT_${mutationClass}`), false);
  }
});

test("SHA-256 core is bounded and fails closed before digest emission", () => {
  const constants = sources.sha256.slice(
    sources.sha256.indexOf("round_constants[64]"),
    sources.sha256.indexOf("static void transform"),
  );
  assert.equal([...constants.matchAll(/0x[0-9a-f]{8}U/gu)].length, 64);
  assert.match(sources.sha256, /context->failed = 0;/u);
  assert.match(sources.sha256, /data == NULL && length != 0U/u);
  assert.match(sources.sha256, /UINT64_MAX \/ 8ULL - context->total_bytes/u);
  assert.match(sources.sha256, /context->total_bytes > UINT64_MAX \/ 8ULL/u);
  assert.match(sources.sha256, /memset\(digest, 0, 32U\)/u);
  assert.match(sources.sha256, /bit_length = context->total_bytes \* 8ULL/u);
});

test("the six-path native core introduces no process, shell, loader or network surface", () => {
  const joined = Object.values(sources).join("\n");
  for (const forbidden of [
    "system(",
    "popen(",
    "fork(",
    "execve(",
    "CreateProcess",
    "TerminateJobObject",
    "ShellExecute",
    "socket(",
    "connect(",
    "dlopen(",
    "LoadLibrary",
    "taskkill",
    "curl ",
    "wget ",
  ]) assert.equal(joined.includes(forbidden), false, forbidden);
  assert.equal(sources.header.includes("#define IAT_B3_PHASE_A_EXECUTION_ENABLED 1"), false);
  assert.equal(sources.header.includes("#define IAT_B3_CANONICAL_TAP_GRAMMAR_COMPLETE 1"), false);
  assert.equal(sources.header.includes("#define IAT_B3_CANONICAL_TAP_TRANSCRIPT_DIGEST_BOUND 1"), false);
});

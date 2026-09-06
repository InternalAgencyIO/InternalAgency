import { createHash } from "node:crypto";
import {
  lstatSync,
  openSync,
  closeSync,
  fstatSync,
  readSync,
  realpathSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { TextDecoder } from "node:util";

export const IAT_B3_NATIVE_CONTAINMENT_CONTRACT_SCHEMA =
  "iat-b3-mandatory-ci-containment-contract/v1";
export const IAT_B3_NATIVE_CONTAINMENT_PREFLIGHT_SCHEMA =
  "iat-b3-mandatory-ci-containment-preflight/v1";
export const IAT_B3_NATIVE_CONTAINMENT_RECEIPT_SCHEMA =
  "iat-b3-mandatory-ci-containment-build-receipt/v1";
export const IAT_B3_NATIVE_CONTAINMENT_EXECUTION_SCHEMA =
  "iat-b3-mandatory-ci-containment-execution/v1";
export const IAT_B3_NATIVE_CONTAINMENT_PROVENANCE_SCHEMA =
  "iat-b3-mandatory-ci-native-build-provenance/v1";
export const IAT_B3_NATIVE_CONTAINMENT_CLOSURE_SCHEMA =
  "iat-b3-mandatory-ci-native-toolchain-closure/v1";
export const IAT_B3_NATIVE_CONTAINMENT_OBSERVER_SCHEMA =
  "iat-b3-mandatory-ci-native-build-observer/v1";

export const IAT_B3_NATIVE_CONTAINMENT_TIMING = Object.freeze({
  startupMs: 10_000,
  executionMs: 120_000,
  allFeatureExecutionMs: 180_000,
  finalizationMs: 5_000,
  teardownObservationMs: 15_000,
  parentGuardMs: 5_000,
  outerMs: 155_000,
  allFeatureOuterMs: 215_000,
  stdoutCapBytes: 64 * 1024 * 1024,
  stderrCapBytes: 64 * 1024 * 1024,
  diagnosticEdgeBytes: 2 * 1024,
});

export const IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS = Object.freeze([
  "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/include/iat_b3_containment.h",
  "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/src/common.c",
  "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/src/main.c",
  "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/src/platform_linux.c",
  "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/src/platform_windows.c",
  "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/src/sha256.c",
  "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/src/tap.c",
]);

export const IAT_B3_NATIVE_CONTAINMENT_BUILD_CONTRACT_PATHS = Object.freeze([
  "projects/star-ascent/site/docs/b3/iat-b3-mandatory-ci-containment-toolchains.v1.json",
  "projects/star-ascent/site/scripts/build-iat-b3-mandatory-ci-containment.mjs",
  "projects/star-ascent/site/scripts/lib/iat-b3-mandatory-ci-containment-contract.mjs",
]);

export const IAT_B3_NATIVE_CONTAINMENT_BUILD_LANES = Object.freeze(["A", "B"]);
export const IAT_B3_NATIVE_CONTAINMENT_TARGETS = Object.freeze([
  "linux-x64-musl",
  "windows-x64-gnu",
]);
export const IAT_B3_NATIVE_CONTAINMENT_MAX_OBSERVED_BYTES = 2 * 1024 * 1024 * 1024;
export const IAT_B3_NATIVE_CONTAINMENT_MAX_SAMPLE_GAP_MS = 250;
export const IAT_B3_NATIVE_CONTAINMENT_REQUIRED_CLOSURE_ROLES = Object.freeze([
  "compiler",
  "compiler-runtime",
  "header",
  "linker",
  "runtime-library",
  "sysroot",
]);
export const IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE = Object.freeze({
  path: "projects/star-ascent/site/docs/b3/iat-b3-mandatory-ci-phase-b-authority-state.v1.json",
  sha256: "6b0b50d9bcc4aa1116e33a5e1cda7fe03976e53b22f72529da3ff8c291d89b7c",
  status: "HOLD",
  compileOrExecuteAuthorized: false,
});

export const IAT_B3_NATIVE_CONTAINMENT_COMMON_ZIG_ARGUMENTS = Object.freeze([
  "cc", "-std=c17", "-O2", "-DNDEBUG", "-D_FORTIFY_SOURCE=2",
  "-fstack-protector-strong", "-fvisibility=hidden", "-ffunction-sections",
  "-fdata-sections", "-fno-ident", "-fno-record-gcc-switches",
  "-frandom-seed=iat-b3-mandatory-containment-v1",
  "-Wall", "-Wextra", "-Werror", "-Wconversion", "-Wformat=2",
  "-Wshadow", "-Wstrict-prototypes", "-Wundef",
]);

export const IAT_B3_NATIVE_CONTAINMENT_TARGET_ARGUMENTS = Object.freeze({
  "linux-x64-musl": Object.freeze([
    "-target", "x86_64-linux-musl", "-D_GNU_SOURCE", "-static", "-fPIE",
    "-pie", "-s", "-Wl,--build-id=none,--gc-sections,-z,relro,-z,now,-z,noexecstack,--fatal-warnings",
  ]),
  "windows-x64-gnu": Object.freeze([
    "-target", "x86_64-windows-gnu", "-D_WIN32_WINNT=0x0A00", "-DUNICODE",
    "-D_UNICODE", "-static", "-s",
    "-Wl,--gc-sections,--no-insert-timestamp,--dynamicbase,--nxcompat,--high-entropy-va,--subsystem,console,--fatal-warnings",
  ]),
});

export const IAT_B3_NATIVE_CONTAINMENT_FIXED_ENVIRONMENT = Object.freeze({
  SOURCE_DATE_EPOCH: "0",
  TZ: "UTC",
  LC_ALL: "C",
  LANG: "C",
});
export const IAT_B3_NATIVE_CONTAINMENT_HOST_NULL_GIT_CONFIG =
  process.platform === "win32" ? "NUL" : "/dev/null";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const GIT_OBJECT_ID_PATTERN = /^[0-9a-f]{40}$/u;
const SUPPORTED_TARGETS = new Set(["linux-x64-musl", "windows-x64-gnu"]);

function fail(code, detail = undefined) {
  const error = new Error(code);
  error.code = code;
  if (detail !== undefined) error.detail = detail;
  throw error;
}

export function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalize(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail("CANONICAL_JSON_UNSAFE_NUMBER_HOLD");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  fail("CANONICAL_JSON_UNSUPPORTED_VALUE_HOLD");
}

export function canonicalJson(value) {
  return canonicalize(value);
}

export function semanticSha256(value) {
  return sha256(Buffer.from(canonicalJson(value), "utf8"));
}

export function parseJsonRejectingDuplicateKeys(text) {
  const source = String(text);
  const stack = [];
  let index = 0;
  let expectingKey = false;
  function skipSpace() { while (/\s/u.test(source[index] ?? "")) index += 1; }
  function stringToken() {
    if (source[index] !== '"') fail("JSON_STRING_EXPECTED_HOLD");
    const start = index;
    index += 1;
    let escaped = false;
    while (index < source.length) {
      const character = source[index++];
      if (escaped) { escaped = false; continue; }
      if (character === "\\") { escaped = true; continue; }
      if (character === '"') return JSON.parse(source.slice(start, index));
    }
    fail("JSON_UNTERMINATED_STRING_HOLD");
  }
  while (index < source.length) {
    skipSpace();
    const character = source[index];
    if (character === "{") { stack.push({ type: "object", keys: new Set() }); expectingKey = true; index += 1; continue; }
    if (character === "[") { stack.push({ type: "array" }); expectingKey = false; index += 1; continue; }
    if (character === "}" || character === "]") { stack.pop(); expectingKey = false; index += 1; continue; }
    if (character === ",") { expectingKey = stack.at(-1)?.type === "object"; index += 1; continue; }
    if (character === '"') {
      const token = stringToken();
      skipSpace();
      if (expectingKey && source[index] === ":") {
        const frame = stack.at(-1);
        if (frame.keys.has(token)) fail("JSON_DUPLICATE_KEY_HOLD", token);
        frame.keys.add(token); expectingKey = false; index += 1;
      }
      continue;
    }
    index += 1;
  }
  let parsed;
  try { parsed = JSON.parse(source); } catch { fail("JSON_PARSE_HOLD"); }
  return parsed;
}

function exactExternalBytes(value, code, maximum = 64 * 1024 * 1024) {
  if (!(value instanceof Uint8Array) || value.byteLength < 1
    || value.byteLength > maximum) fail(code);
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

function parseCanonicalExternalJson(value, code) {
  const bytes = exactExternalBytes(value, `${code}_BYTES_HOLD`);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(`${code}_UTF8_HOLD`);
  }
  const parsed = parseJsonRejectingDuplicateKeys(text);
  if (!plainRecord(parsed) || text !== canonicalJson(parsed))
    fail(`${code}_NONCANONICAL_HOLD`);
  return Object.freeze({ bytes, parsed, sha256: sha256(bytes) });
}

function semanticExternalObject(schema, fields) {
  const semantic = { schema, ...fields };
  return { ...semantic, semanticSha256: semanticSha256(semantic) };
}

function validateSemanticExternalObject(parsed, schema, code) {
  if (parsed.schema !== schema) fail(`${code}_SCHEMA_HOLD`);
  assertSha(parsed.semanticSha256, `${code}_SEMANTIC_SHA256_HOLD`);
  const { semanticSha256: declared, ...semantic } = parsed;
  if (semanticSha256(semantic) !== declared)
    fail(`${code}_SEMANTIC_DIGEST_HOLD`);
}

function assertSha(value, code) {
  if (!SHA256_PATTERN.test(value)) fail(code);
}

function inside(parent, child) {
  const difference = relative(parent, child);
  return difference !== "" && difference !== ".." && !difference.startsWith(`..${sep}`) && !isAbsolute(difference);
}

function plainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function assertExactKeys(value, expected, code) {
  if (!plainRecord(value)
    || canonicalJson(Object.keys(value).sort()) !== canonicalJson([...expected].sort())) fail(code);
}

function assertAbsolutePath(value, code) {
  if (typeof value !== "string" || value.length < 3 || !isAbsolute(value)
    || resolve(value) !== value) fail(code);
}

function caseFoldPath(value) {
  return resolve(value).replaceAll("\\", "/").toLowerCase();
}

function pathsDisjoint(left, right) {
  const leftKey = caseFoldPath(left);
  const rightKey = caseFoldPath(right);
  return leftKey !== rightKey
    && !rightKey.startsWith(`${leftKey}/`)
    && !leftKey.startsWith(`${rightKey}/`);
}

function requireTargetedToolchainClosure(candidate, expectedTarget, code) {
  const validated = validateNativeContainmentToolchainClosure(candidate);
  if (validated.target !== expectedTarget) fail(code);
  return validated;
}

function assertObservedDescriptor(descriptor, code) {
  assertExactKeys(descriptor,
    ["byteLength", "fileId", "realpath", "sha256"], code);
  if (!Number.isSafeInteger(descriptor.byteLength) || descriptor.byteLength < 1
    || typeof descriptor.fileId !== "string" || descriptor.fileId.length < 1
    || typeof descriptor.realpath !== "string" || !isAbsolute(descriptor.realpath)
    || !SHA256_PATTERN.test(descriptor.sha256)) fail(code);
}

function sameObservedDescriptor(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

export function validateNativeContainmentToolchainClosure(candidate) {
  assertExactKeys(candidate, [
    "closureSha256", "edges", "entries", "observerSessionId",
    "rootExecutablePath", "schema", "target",
  ], "TOOLCHAIN_CLOSURE_EXACT_SCHEMA_HOLD");
  if (candidate.schema !== IAT_B3_NATIVE_CONTAINMENT_CLOSURE_SCHEMA
    || !IAT_B3_NATIVE_CONTAINMENT_TARGETS.includes(candidate.target)
    || !SHA256_PATTERN.test(candidate.observerSessionId)
    || !SHA256_PATTERN.test(candidate.closureSha256)) {
    fail("TOOLCHAIN_CLOSURE_HEADER_HOLD");
  }
  assertAbsolutePath(candidate.rootExecutablePath,
    "TOOLCHAIN_ROOT_EXECUTABLE_ABSOLUTE_HOLD");
  if (!Array.isArray(candidate.entries) || candidate.entries.length < 1
    || !Array.isArray(candidate.edges)) fail("TOOLCHAIN_CLOSURE_ARRAYS_HOLD");
  const paths = [];
  const folded = new Set();
  const realpaths = new Set();
  const fileIds = new Set();
  const fileRoleKeys = new Set();
  const roles = new Set();
  for (const entry of candidate.entries) {
    assertExactKeys(entry, ["after", "before", "path", "roles"],
      "TOOLCHAIN_ENTRY_EXACT_SCHEMA_HOLD");
    assertAbsolutePath(entry.path, "TOOLCHAIN_ENTRY_PATH_ABSOLUTE_HOLD");
    if (!Array.isArray(entry.roles) || entry.roles.length < 1
      || entry.roles.some((role) => !IAT_B3_NATIVE_CONTAINMENT_REQUIRED_CLOSURE_ROLES.includes(role))
      || new Set(entry.roles).size !== entry.roles.length
      || canonicalJson(entry.roles) !== canonicalJson([...entry.roles].sort())) {
      fail("TOOLCHAIN_ENTRY_ROLES_HOLD");
    }
    assertObservedDescriptor(entry.before, "TOOLCHAIN_ENTRY_BEFORE_HOLD");
    assertObservedDescriptor(entry.after, "TOOLCHAIN_ENTRY_AFTER_HOLD");
    if (!sameObservedDescriptor(entry.before, entry.after)
      || caseFoldPath(entry.path) !== caseFoldPath(entry.before.realpath)) {
      fail("TOOLCHAIN_ENTRY_CHANGED_OR_REBOUND_HOLD");
    }
    const foldedPath = caseFoldPath(entry.path);
    const foldedRealpath = caseFoldPath(entry.before.realpath);
    if (folded.has(foldedPath) || realpaths.has(foldedRealpath)
      || fileIds.has(entry.before.fileId)) {
      fail("TOOLCHAIN_ENTRY_DUPLICATE_CASE_ALIAS_OR_FILE_ID_HOLD");
    }
    folded.add(foldedPath);
    realpaths.add(foldedRealpath);
    fileIds.add(entry.before.fileId);
    paths.push(entry.path);
    for (const role of entry.roles) {
      const fileRoleKey = `${entry.before.fileId}\0${role}`;
      if (fileRoleKeys.has(fileRoleKey))
        fail("TOOLCHAIN_FILE_ROLE_DUPLICATE_HOLD");
      fileRoleKeys.add(fileRoleKey);
      roles.add(role);
    }
  }
  if (canonicalJson(paths) !== canonicalJson([...paths].sort())
    || IAT_B3_NATIVE_CONTAINMENT_REQUIRED_CLOSURE_ROLES.some((role) => !roles.has(role))) {
    fail("TOOLCHAIN_CLOSURE_ORDER_OR_ROLE_HOLD");
  }
  const adjacency = new Map(paths.map((path) => [path, []]));
  if (!adjacency.has(candidate.rootExecutablePath))
    fail("TOOLCHAIN_ROOT_EXECUTABLE_NOT_IN_CLOSURE_HOLD");
  const rootEntry = candidate.entries.find(
    (entry) => entry.path === candidate.rootExecutablePath,
  );
  if (!rootEntry.roles.includes("compiler"))
    fail("TOOLCHAIN_ROOT_COMPILER_ROLE_HOLD");
  const edgeKeys = new Set();
  for (const edge of candidate.edges) {
    assertExactKeys(edge, ["from", "kind", "to"],
      "TOOLCHAIN_EDGE_EXACT_SCHEMA_HOLD");
    if (!adjacency.has(edge.from) || !adjacency.has(edge.to)
      || !["includes", "invokes", "links", "loads", "sysroot"].includes(edge.kind)) {
      fail("TOOLCHAIN_EDGE_VALUE_HOLD");
    }
    const key = `${edge.from}\0${edge.kind}\0${edge.to}`;
    if (edgeKeys.has(key)) fail("TOOLCHAIN_EDGE_DUPLICATE_HOLD");
    edgeKeys.add(key);
    adjacency.get(edge.from).push(edge.to);
  }
  const reached = new Set();
  const pending = [candidate.rootExecutablePath];
  while (pending.length > 0) {
    const path = pending.pop();
    if (reached.has(path)) continue;
    reached.add(path);
    pending.push(...adjacency.get(path));
  }
  if (reached.size !== paths.length) fail("TOOLCHAIN_CLOSURE_NOT_RECURSIVE_HOLD");
  const { closureSha256, ...semanticPayload } = candidate;
  if (semanticSha256(semanticPayload) !== closureSha256)
    fail("TOOLCHAIN_CLOSURE_SEMANTIC_DIGEST_HOLD");
  return Object.freeze({
    schema: candidate.schema,
    target: candidate.target,
    structurallyValid: true,
    authoritative: false,
    observerSessionId: candidate.observerSessionId,
    closureSha256,
  });
}

function readRegularSameFile(path, expected = undefined) {
  const absolute = resolve(path);
  const before = lstatSync(absolute, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n) fail("EXTERNAL_FILE_TYPE_HOLD", absolute);
  if (realpathSync.native(absolute) !== absolute) fail("EXTERNAL_FILE_REALPATH_HOLD", absolute);
  const fd = openSync(absolute, "r");
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (opened.dev !== before.dev || opened.ino !== before.ino || opened.nlink !== 1n || !opened.isFile()) fail("EXTERNAL_FILE_OPEN_IDENTITY_HOLD", absolute);
    if (opened.size > 512n * 1024n * 1024n) fail("EXTERNAL_FILE_SIZE_HOLD", absolute);
    const bytes = Buffer.alloc(Number(opened.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (count <= 0) fail("EXTERNAL_FILE_SHORT_READ_HOLD", absolute);
      offset += count;
    }
    const after = fstatSync(fd, { bigint: true });
    const pathAfter = lstatSync(absolute, { bigint: true });
    for (const key of ["dev", "ino", "size", "mtimeNs", "ctimeNs", "nlink"]) {
      if (after[key] !== opened[key] || pathAfter[key] !== opened[key]) fail("EXTERNAL_FILE_CHANGED_DURING_READ_HOLD", absolute);
    }
    const descriptor = Object.freeze({
      byteLength: bytes.length,
      fileId: `${opened.dev.toString()}:${opened.ino.toString()}`,
      realpath: absolute,
      sha256: sha256(bytes),
    });
    if (expected && (descriptor.byteLength !== expected.byteLength || descriptor.sha256 !== expected.sha256)) fail("EXTERNAL_FILE_DESCRIPTOR_MISMATCH_HOLD", absolute);
    return Object.freeze({ bytes, descriptor });
  } finally { closeSync(fd); }
}

export function observeNativeContainmentSourceClosure(repositoryRoot = REPO_ROOT) {
  const root = realpathSync.native(resolve(repositoryRoot));
  if (IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS.length !== 7
    || canonicalJson(IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS)
      !== canonicalJson([...IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS].sort())
    || new Set(IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS.map((path) => path.toLowerCase())).size
      !== IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS.length
    || !IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS.some((path) => path.endsWith("/tap.c"))) {
    fail("SOURCE_LIST_INCOMPLETE_DUPLICATE_OR_CASE_ALIAS_HOLD");
  }
  const files = IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS.map((path) => {
    const absolute = resolve(root, path);
    if (!inside(root, absolute)) fail("SOURCE_PATH_ESCAPE_HOLD", path);
    const { descriptor } = readRegularSameFile(absolute);
    return Object.freeze({ path: path.replaceAll("\\", "/"), sha256: descriptor.sha256, byteLength: descriptor.byteLength });
  });
  return Object.freeze({ files, closureSha256: semanticSha256(files), byteLength: files.reduce((sum, file) => sum + file.byteLength, 0) });
}

export function observeNativeContainmentBuildContractClosure(
  repositoryRoot = REPO_ROOT,
) {
  const root = realpathSync.native(resolve(repositoryRoot));
  const files = IAT_B3_NATIVE_CONTAINMENT_BUILD_CONTRACT_PATHS.map((path) => {
    const absolute = resolve(root, path);
    if (!inside(root, absolute)) fail("BUILD_CONTRACT_PATH_ESCAPE_HOLD", path);
    const { descriptor } = readRegularSameFile(absolute);
    return Object.freeze({
      path,
      sha256: descriptor.sha256,
      byteLength: descriptor.byteLength,
    });
  });
  return Object.freeze({
    files: Object.freeze(files),
    closureSha256: semanticSha256(files),
    byteLength: files.reduce((sum, file) => sum + file.byteLength, 0),
  });
}

export function observeNativeContainmentAuthoritySource(
  repositoryRoot = REPO_ROOT,
) {
  const root = realpathSync.native(resolve(repositoryRoot));
  const absolute = resolve(
    root, IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE.path,
  );
  if (!inside(root, absolute)) fail("AUTHORITY_SOURCE_PATH_ESCAPE_HOLD");
  const observed = readRegularSameFile(absolute, {
    sha256: IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE.sha256,
    byteLength: 5_175,
  });
  const value = parseJsonRejectingDuplicateKeys(observed.bytes.toString("utf8"));
  if (value?.status !== "HOLD" || value?.ready !== false
    || value?.complete !== false || value?.operative !== false
    || value?.authority?.compilerExecutionAuthorized !== false
    || value?.authority?.nativeHelperExecutionAuthorized !== false
    || value?.authority?.runtimeContainmentExecutionAuthorized !== false) {
    fail("AUTHORITY_SOURCE_TRUTH_ESCALATION_HOLD");
  }
  return Object.freeze({
    ...IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE,
    byteLength: observed.descriptor.byteLength,
    sameObjectRead: true,
    directExternalObserver: false,
  });
}

function exactNativeContainmentZigArgv({
  target, compilerPath, repository, contractSha256, outputPath,
}) {
  const sourceFiles = IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS
    .filter((path) => path.endsWith(".c")).sort();
  if (sourceFiles.length !== 6
    || sourceFiles.filter((path) => path.endsWith("/tap.c")).length !== 1) {
    fail("LINK_SOURCE_SET_INCOMPLETE_HOLD");
  }
  const includePath =
    "projects/star-ascent/site/native/iat-b3-mandatory-ci-containment/include";
  return Object.freeze([
    compilerPath,
    ...IAT_B3_NATIVE_CONTAINMENT_COMMON_ZIG_ARGUMENTS,
    ...IAT_B3_NATIVE_CONTAINMENT_TARGET_ARGUMENTS[target],
    `-DIAT_B3_CONTAINMENT_CONTRACT_SHA256=\\\"${contractSha256}\\\"`,
    `-ffile-prefix-map=${repository}=/iat-b3-src`,
    `-fdebug-prefix-map=${repository}=/iat-b3-src`,
    `-I${resolve(repository, includePath)}`,
    ...sourceFiles.map((path) => resolve(repository, path)),
    "-o", outputPath,
  ]);
}

export function createNativeContainmentCompileRecipe({
  target,
  sourceClosureSha256,
  contractSha256,
  compilerPath,
  cwd,
  outputPath,
  environment,
  repositoryRoot = REPO_ROOT,
}) {
  if (!SUPPORTED_TARGETS.has(target)) fail("BUILD_TARGET_UNSUPPORTED_HOLD");
  assertSha(sourceClosureSha256, "SOURCE_CLOSURE_SHA256_HOLD");
  assertSha(contractSha256, "CONTRACT_SHA256_HOLD");
  assertAbsolutePath(compilerPath, "COMPILER_PATH_ABSOLUTE_REQUIRED_HOLD");
  assertAbsolutePath(cwd, "BUILD_CWD_ABSOLUTE_REQUIRED_HOLD");
  assertAbsolutePath(outputPath, "OUTPUT_PATH_ABSOLUTE_REQUIRED_HOLD");
  const repository = realpathSync.native(resolve(repositoryRoot));
  const environmentKeys = [
    ...Object.keys(IAT_B3_NATIVE_CONTAINMENT_FIXED_ENVIRONMENT),
    "HOME", "TMPDIR", "TMP", "TEMP", "ZIG_GLOBAL_CACHE_DIR",
    "ZIG_LOCAL_CACHE_DIR", "PATH", "GIT_CONFIG_NOSYSTEM",
    "GIT_CONFIG_GLOBAL", "GIT_TERMINAL_PROMPT", "GIT_NO_LAZY_FETCH",
  ];
  assertExactKeys(environment, environmentKeys,
    "BUILD_ENVIRONMENT_EXACT_SCHEMA_HOLD");
  for (const [name, value] of Object.entries(
    IAT_B3_NATIVE_CONTAINMENT_FIXED_ENVIRONMENT,
  )) {
    if (environment[name] !== value) fail("BUILD_ENVIRONMENT_FIXED_VALUE_HOLD", name);
  }
  for (const name of [
    "HOME", "TMPDIR", "TMP", "TEMP", "ZIG_GLOBAL_CACHE_DIR",
    "ZIG_LOCAL_CACHE_DIR",
  ]) assertAbsolutePath(environment[name], "BUILD_ENVIRONMENT_ABSOLUTE_PATH_HOLD");
  if (environment.TMP !== environment.TMPDIR
    || environment.TEMP !== environment.TMPDIR
    || environment.PATH !== ""
    || environment.GIT_CONFIG_NOSYSTEM !== "1"
    || environment.GIT_CONFIG_GLOBAL
      !== IAT_B3_NATIVE_CONTAINMENT_HOST_NULL_GIT_CONFIG
    || environment.GIT_TERMINAL_PROMPT !== "0"
    || environment.GIT_NO_LAZY_FETCH !== "1") {
    fail("BUILD_ENVIRONMENT_VALUE_HOLD");
  }
  const argv = exactNativeContainmentZigArgv({
    target, compilerPath, repository, contractSha256, outputPath,
  });
  return Object.freeze({
    target,
    repositoryRoot: repository,
    executablePath: compilerPath,
    argv,
    cwd,
    environment,
    sourceClosureSha256,
    contractSha256,
    outputPath,
    recipeSha256: normalizedRecipeSha256({
      target,
      executablePath: compilerPath,
      argv,
      environment,
      sourceClosureSha256,
      contractSha256,
      outputPath,
    }),
  });
}

export function sanitizeNativeContainmentEnvironment({ home, temporaryRoot, cacheRoot }) {
  for (const [name, path] of Object.entries({ home, temporaryRoot, cacheRoot })) {
    if (typeof path !== "string" || !isAbsolute(path)) fail(`BUILD_${name.toUpperCase()}_ABSOLUTE_HOLD`);
  }
  return Object.freeze({
    ...IAT_B3_NATIVE_CONTAINMENT_FIXED_ENVIRONMENT,
    HOME: home, TMPDIR: temporaryRoot, TMP: temporaryRoot, TEMP: temporaryRoot,
    ZIG_GLOBAL_CACHE_DIR: resolve(cacheRoot, "global"),
    ZIG_LOCAL_CACHE_DIR: resolve(cacheRoot, "local"),
    PATH: "",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: IAT_B3_NATIVE_CONTAINMENT_HOST_NULL_GIT_CONFIG,
    GIT_TERMINAL_PROMPT: "0", GIT_NO_LAZY_FETCH: "1",
  });
}

function exactNativeContainmentLanePaths({ isolatedParentRoot, target, lane }) {
  if (!IAT_B3_NATIVE_CONTAINMENT_TARGETS.includes(target)
    || !IAT_B3_NATIVE_CONTAINMENT_BUILD_LANES.includes(lane)) {
    fail("BUILD_PLAN_TARGET_OR_LANE_HOLD");
  }
  const root = resolve(isolatedParentRoot, `${target}-${lane}`);
  const outputDirectory = resolve(root, "out");
  const logDirectory = resolve(root, "log");
  const paths = Object.freeze({
    root,
    cwd: resolve(root, "work"),
    home: resolve(root, "home"),
    temporaryRoot: resolve(root, "tmp"),
    cacheRoot: resolve(root, "cache"),
    outputPath: resolve(outputDirectory, target.endsWith("gnu")
      ? "iat-b3-containment.exe" : "iat-b3-containment"),
    logPath: resolve(logDirectory, "compiler.log"),
  });
  const roleRoots = [
    paths.cwd, paths.home, paths.temporaryRoot, paths.cacheRoot,
    outputDirectory, logDirectory,
  ];
  for (let index = 0; index < roleRoots.length; index += 1) {
    if (!inside(root, roleRoots[index]) || roleRoots.some(
      (candidate, otherIndex) => otherIndex !== index
        && !pathsDisjoint(roleRoots[index], candidate),
    )) fail("BUILD_PLAN_LANE_ROLE_PATH_OVERLAP_HOLD");
  }
  return paths;
}

export function createNativeContainmentBuildPlan({
  repositoryRoot = REPO_ROOT,
  isolatedParentRoot,
  sourceClosureSha256,
  contractSha256,
  policySha256,
  observerSessionId,
  toolchainClosures,
}) {
  const repository = realpathSync.native(resolve(repositoryRoot));
  assertAbsolutePath(isolatedParentRoot, "ISOLATED_PARENT_ROOT_ABSOLUTE_HOLD");
  if (!pathsDisjoint(repository, isolatedParentRoot))
    fail("ISOLATED_PARENT_OVERLAPS_REPOSITORY_HOLD");
  assertSha(sourceClosureSha256, "BUILD_PLAN_SOURCE_CLOSURE_HOLD");
  assertSha(contractSha256, "BUILD_PLAN_CONTRACT_SHA256_HOLD");
  assertSha(policySha256, "BUILD_PLAN_POLICY_SHA256_HOLD");
  assertSha(observerSessionId, "BUILD_PLAN_OBSERVER_SESSION_HOLD");
  assertExactKeys(toolchainClosures,
    IAT_B3_NATIVE_CONTAINMENT_TARGETS,
    "BUILD_PLAN_TOOLCHAIN_TARGETS_HOLD");
  const validatedClosures = Object.fromEntries(
    IAT_B3_NATIVE_CONTAINMENT_TARGETS.map((target) => [
      target,
      requireTargetedToolchainClosure(
        toolchainClosures[target], target,
        "BUILD_PLAN_TOOLCHAIN_TARGET_MAP_KEY_MISMATCH_HOLD",
      ),
    ]),
  );
  const builds = [];
  const roots = [];
  for (const target of IAT_B3_NATIVE_CONTAINMENT_TARGETS) {
    const closure = toolchainClosures[target];
    for (const lane of IAT_B3_NATIVE_CONTAINMENT_BUILD_LANES) {
      const {
        root, cwd, home, temporaryRoot, cacheRoot, outputPath, logPath,
      } = exactNativeContainmentLanePaths({
        isolatedParentRoot, target, lane,
      });
      for (const path of [cwd, home, temporaryRoot, cacheRoot, outputPath, logPath]) {
        if (!inside(root, path)) fail("BUILD_PLAN_PATH_OUTSIDE_LANE_HOLD");
      }
      if (roots.some((other) => !pathsDisjoint(other, root)))
        fail("BUILD_PLAN_LANE_ROOT_OVERLAP_HOLD");
      roots.push(root);
      const environment = sanitizeNativeContainmentEnvironment({
        home,
        temporaryRoot,
        cacheRoot,
      });
      const recipe = createNativeContainmentCompileRecipe({
        target,
        sourceClosureSha256,
        contractSha256,
        compilerPath: closure.rootExecutablePath,
        cwd,
        outputPath,
        environment,
        repositoryRoot: repository,
      });
      builds.push(Object.freeze({
        id: `${target}-${lane}`,
        target,
        lane,
        root,
        cwd,
        home,
        temporaryRoot,
        cacheRoot,
        outputPath,
        logPath,
        environment,
        toolchainClosureSha256: validatedClosures[target].closureSha256,
        recipe,
        absenceRequirements: Object.freeze({
          cacheRootAbsentBeforeBuild: true,
          outputAbsentBeforeBuild: true,
          rootAbsentBeforeBuild: true,
        }),
        invocationSha256: semanticSha256({
          executablePath: recipe.executablePath,
          argv: recipe.argv,
          cwd: recipe.cwd,
          environment: recipe.environment,
          cacheRoot,
          outputPath,
          logPath,
        }),
      }));
    }
  }
  const canonicalPlan = semanticExternalObject(
    "iat-b3-mandatory-ci-native-build-plan/v1", {
      builds: builds.map((build) => ({
        absenceRequirements: build.absenceRequirements,
        argv: build.recipe.argv,
        cacheRoot: build.cacheRoot,
        cwd: build.cwd,
        environment: build.environment,
        executablePath: build.recipe.executablePath,
        home: build.home,
        id: build.id,
        invocationSha256: build.invocationSha256,
        lane: build.lane,
        logPath: build.logPath,
        outputPath: build.outputPath,
        recipeSha256: build.recipe.recipeSha256,
        root: build.root,
        target: build.target,
        temporaryRoot: build.temporaryRoot,
      })),
      contractSha256,
      isolatedParentRoot,
      observerSessionId,
      policySha256,
      repositoryRoot: repository,
      sourceClosureSha256,
    },
  );
  return Object.freeze({
    schema: IAT_B3_NATIVE_CONTAINMENT_PROVENANCE_SCHEMA,
    status: "STRUCTURAL_HOLD",
    ready: false,
    complete: false,
    buildAuthorized: false,
    buildExecuted: false,
    repositoryRoot: repository,
    isolatedParentRoot,
    sourceClosureSha256,
    contractSha256,
    policySha256,
    observerSessionId,
    buildPlanSha256: semanticSha256(canonicalPlan),
    canonicalPlan,
    authoritySource: IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE,
    builds: Object.freeze(builds),
    blockers: Object.freeze([
      "DIRECT_AUTHORITY_OBSERVATION_REQUIRED",
      "DIRECT_TOOLCHAIN_OBSERVATION_REQUIRED",
      "OBSERVER_OWNED_TWO_BUILD_RECEIPT_REQUIRED",
    ]),
  });
}

function readU16(bytes, offset) { if (offset + 2 > bytes.length) fail("BINARY_TRUNCATED_HOLD"); return bytes.readUInt16LE(offset); }
function readU32(bytes, offset) { if (offset + 4 > bytes.length) fail("BINARY_TRUNCATED_HOLD"); return bytes.readUInt32LE(offset); }
function readU64(bytes, offset) {
  if (offset + 8 > bytes.length) fail("BINARY_TRUNCATED_HOLD");
  const value = bytes.readBigUInt64LE(offset);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) fail("BINARY_U64_RANGE_HOLD");
  return Number(value);
}

function checkedBinaryRangeEnd(start, size, code) {
  const end = start + size;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(size)
    || start < 0 || size < 0 || !Number.isSafeInteger(end)) fail(code);
  return end;
}

export function inspectPortableExecutable(bytesLike, { allowedImports } = {}) {
  const bytes = Buffer.from(bytesLike);
  if (bytes.length < 512 || bytes.toString("ascii", 0, 2) !== "MZ") fail("PE_DOS_HEADER_HOLD");
  const pe = readU32(bytes, 0x3c);
  if (pe + 264 > bytes.length || bytes.toString("ascii", pe, pe + 4) !== "PE\0\0") fail("PE_SIGNATURE_HOLD");
  if (readU16(bytes, pe + 4) !== 0x8664) fail("PE_MACHINE_AMD64_HOLD");
  const sectionCount = readU16(bytes, pe + 6);
  if (sectionCount < 1 || sectionCount > 96) fail("PE_SECTION_COUNT_HOLD");
  if (readU32(bytes, pe + 8) !== 0) fail("PE_TIMESTAMP_NONZERO_HOLD");
  if (readU32(bytes, pe + 12) !== 0 || readU32(bytes, pe + 16) !== 0)
    fail("PE_COFF_SYMBOL_TABLE_FORBIDDEN_HOLD");
  const optionalSize = readU16(bytes, pe + 20);
  const optional = pe + 24;
  if (optionalSize < 240 || readU16(bytes, optional) !== 0x20b) fail("PE32_PLUS_HOLD");
  const subsystem = readU16(bytes, optional + 68);
  const dllCharacteristics = readU16(bytes, optional + 70);
  const entryRva = readU32(bytes, optional + 16);
  const sizeOfHeaders = readU32(bytes, optional + 60);
  if (entryRva === 0 || sizeOfHeaders < optional + optionalSize
    || sizeOfHeaders > bytes.length || readU32(bytes, optional + 64) !== 0) {
    fail("PE_ENTRY_HEADERS_CHECKSUM_HOLD");
  }
  if (subsystem !== 3) fail("PE_SUBSYSTEM_NOT_CONSOLE_HOLD");
  for (const [mask, code] of [[0x20, "PE_HIGH_ENTROPY_VA_HOLD"], [0x40, "PE_DYNAMIC_BASE_HOLD"], [0x100, "PE_NX_COMPAT_HOLD"]]) if ((dllCharacteristics & mask) === 0) fail(code);
  const directoryCount = readU32(bytes, optional + 108);
  if (directoryCount > 16)
    fail("PE_DATA_DIRECTORY_COUNT_OVER_16_HOLD");
  const directoryOffset = optional + 112;
  if (directoryOffset + directoryCount * 8 > optional + optionalSize)
    fail("PE_DATA_DIRECTORY_OPTIONAL_HEADER_RANGE_HOLD");
  const directories = Array.from({ length: directoryCount }, (_, index) => ({ rva: readU32(bytes, directoryOffset + index * 8), size: readU32(bytes, directoryOffset + index * 8 + 4) }));
  for (let index = 0; index < directories.length; index += 1) {
    const directory = directories[index];
    if ((directory.rva === 0) !== (directory.size === 0))
      fail("PE_DIRECTORY_RANGE_HOLD", index);
    if (![1, 3, 5, 12].includes(index)
      && (directory.rva !== 0 || directory.size !== 0)) {
      fail("PE_FORBIDDEN_DIRECTORY_HOLD", index);
    }
  }
  if (!directories[5]?.rva || !directories[5]?.size)
    fail("PE_BASE_RELOCATION_REQUIRED_HOLD");
  const sectionOffset = optional + optionalSize;
  const sections = [];
  const sectionNames = new Set();
  let rawImageEnd = sizeOfHeaders;
  let entrySectionObserved = false;
  for (let index = 0; index < sectionCount; index += 1) {
    const offset = sectionOffset + index * 40;
    if (offset + 40 > bytes.length) fail("PE_SECTION_TABLE_TRUNCATED_HOLD");
    const rawName = bytes.subarray(offset, offset + 8);
    const nul = rawName.indexOf(0);
    const name = rawName.toString("ascii", 0, nul === -1 ? 8 : nul);
    if (!/^[.A-Za-z0-9_$-]{1,8}$/u.test(name) || sectionNames.has(name))
      fail("PE_SECTION_NAME_HOLD");
    sectionNames.add(name);
    const virtualSize = readU32(bytes, offset + 8), virtualAddress = readU32(bytes, offset + 12);
    const rawSize = readU32(bytes, offset + 16), rawOffset = readU32(bytes, offset + 20), flags = readU32(bytes, offset + 36);
    const mappedSize = Math.max(virtualSize, rawSize);
    if (rawOffset + rawSize > bytes.length) fail("PE_SECTION_RANGE_HOLD");
    if (mappedSize === 0 || virtualAddress === 0
      || virtualAddress + mappedSize > 0x1_0000_0000) {
      fail("PE_SECTION_VIRTUAL_RANGE_HOLD");
    }
    if ((flags & 0x20000000) !== 0 && (flags & 0x80000000) !== 0) fail("PE_WRITE_EXECUTE_SECTION_HOLD");
    if (rawSize > 0 && rawOffset < sizeOfHeaders) fail("PE_SECTION_OVERLAPS_HEADERS_HOLD");
    if (sections.some((entry) => rawSize > 0 && entry.rawSize > 0
      && rawOffset < entry.rawOffset + entry.rawSize
      && entry.rawOffset < rawOffset + rawSize)) fail("PE_SECTION_RAW_OVERLAP_HOLD");
    if (sections.some((entry) => virtualAddress
        < entry.virtualAddress + entry.virtualSize
      && entry.virtualAddress < virtualAddress + mappedSize)) {
      fail("PE_SECTION_VIRTUAL_OVERLAP_HOLD");
    }
    if (entryRva >= virtualAddress
      && entryRva < virtualAddress + Math.max(virtualSize, rawSize)) {
      if ((flags & 0x20000000) === 0 || (flags & 0x80000000) !== 0)
        fail("PE_ENTRY_SECTION_POLICY_HOLD");
      entrySectionObserved = true;
    }
    rawImageEnd = Math.max(rawImageEnd, rawOffset + rawSize);
    sections.push({ virtualAddress, virtualSize: mappedSize, rawOffset, rawSize });
  }
  if (!entrySectionObserved) fail("PE_ENTRY_OUTSIDE_EXECUTABLE_SECTION_HOLD");
  if (rawImageEnd !== bytes.length) fail("PE_OVERLAY_OR_UNMAPPED_BYTES_HOLD");
  const mapContinuousRawRvaRange = (rva, size, code) => {
    const end = checkedBinaryRangeEnd(rva, size, code);
    if (size < 1 || end > 0x1_0000_0000) fail(code);
    const section = sections.find((entry) => rva >= entry.virtualAddress
      && end <= entry.virtualAddress + entry.virtualSize
      && end <= entry.virtualAddress + entry.rawSize);
    if (!section) fail(code);
    const delta = rva - section.virtualAddress;
    const offset = section.rawOffset + delta;
    const offsetEnd = offset + size;
    if (delta >= section.rawSize || offsetEnd > section.rawOffset + section.rawSize
      || offsetEnd > bytes.length) fail(code);
    return Object.freeze({
      offset,
      offsetEnd,
      sectionRawEnd: section.rawOffset + section.rawSize,
    });
  };
  const mappedDirectories = [];
  for (let index = 0; index < directories.length; index += 1) {
    const directory = directories[index];
    if (directory.rva === 0) continue;
    mappedDirectories[index] = mapContinuousRawRvaRange(
      directory.rva, directory.size, "PE_DIRECTORY_CONTINUOUS_MAPPING_HOLD",
    );
  }
  const imports = [];
  const importDirectory = directories[1];
  if (importDirectory?.rva) {
    const importMapping = mappedDirectories[1];
    let descriptor = importMapping.offset;
    const descriptorEnd = importMapping.offsetEnd;
    let terminated = false;
    for (let count = 0; count < 256; count += 1, descriptor += 20) {
      if (descriptor + 20 > descriptorEnd)
        fail("PE_IMPORT_DIRECTORY_RANGE_HOLD");
      const nameRva = readU32(bytes, descriptor + 12);
      if ([0, 4, 8, 12, 16].every(
        (fieldOffset) => readU32(bytes, descriptor + fieldOffset) === 0,
      )) {
        terminated = true;
        break;
      }
      const nameMapping = mapContinuousRawRvaRange(
        nameRva, 1, "PE_IMPORT_NAME_CONTINUOUS_MAPPING_HOLD",
      );
      const cursor = nameMapping.offset;
      let end = cursor;
      const nameLimit = Math.min(nameMapping.sectionRawEnd, cursor + 260);
      while (end < nameLimit && bytes[end] !== 0) end += 1;
      if (end >= nameLimit) fail("PE_IMPORT_NAME_HOLD");
      imports.push(bytes.toString("ascii", cursor, end).toLowerCase());
    }
    if (!terminated) fail("PE_IMPORT_TABLE_UNTERMINATED_HOLD");
  }
  if (!Array.isArray(allowedImports)) fail("PE_IMPORT_ALLOWLIST_UNMEASURED_HOLD");
  if (new Set(imports).size !== imports.length)
    fail("PE_DUPLICATE_IMPORT_DESCRIPTOR_HOLD");
  const normalized = [...new Set(imports)].sort();
  const allowed = [...allowedImports].map((entry) => String(entry).toLowerCase()).sort();
  if (new Set(allowed).size !== allowed.length
    || allowed.some((entry) => !/^[a-z0-9._-]+\.dll$/u.test(entry))) {
    fail("PE_IMPORT_ALLOWLIST_INVALID_HOLD");
  }
  if (canonicalJson(normalized) !== canonicalJson(allowed)) fail("PE_IMPORT_ALLOWLIST_MISMATCH_HOLD");
  return Object.freeze({
    format: "PE32+",
    machine: "amd64",
    imports: Object.freeze(normalized),
    sha256: sha256(bytes),
    byteLength: bytes.length,
  });
}

export function inspectStaticElf(bytesLike) {
  const bytes = Buffer.from(bytesLike);
  if (bytes.length < 64 || bytes[0] !== 0x7f || bytes.toString("ascii", 1, 4) !== "ELF") fail("ELF_MAGIC_HOLD");
  if (bytes[4] !== 2 || bytes[5] !== 1 || readU16(bytes, 18) !== 62) fail("ELF64_AMD64_HOLD");
  if (readU16(bytes, 16) !== 3) fail("ELF_ET_DYN_REQUIRED_HOLD");
  if (readU32(bytes, 20) !== 1 || readU16(bytes, 52) !== 64)
    fail("ELF_HEADER_VERSION_SIZE_HOLD");
  const entry = readU64(bytes, 24);
  const programOffset = readU64(bytes, 32);
  const sectionOffset = readU64(bytes, 40);
  const programEntrySize = readU16(bytes, 54);
  const rawProgramCount = readU16(bytes, 56);
  const sectionEntrySize = readU16(bytes, 58);
  const rawSectionCount = readU16(bytes, 60);
  const rawSectionNameIndex = readU16(bytes, 62);
  let programCount = rawProgramCount;
  let sectionCount = rawSectionCount;
  let sectionNameIndex = rawSectionNameIndex;
  if (sectionOffset === 0) {
    if (rawSectionCount !== 0 || rawSectionNameIndex !== 0
      || rawProgramCount === 0xffff) {
      fail("ELF_EXTENDED_SECTION_HEADER_REQUIRED_HOLD");
    }
  } else {
    if (sectionEntrySize < 64 || sectionOffset + 64 > bytes.length)
      fail("ELF_SECTION_ZERO_RANGE_HOLD");
    if (readU32(bytes, sectionOffset + 4) !== 0)
      fail("ELF_SECTION_ZERO_TYPE_HOLD");
    if (rawSectionCount === 0)
      sectionCount = readU64(bytes, sectionOffset + 32);
    if (rawProgramCount === 0xffff)
      programCount = readU32(bytes, sectionOffset + 44);
    if (rawSectionNameIndex === 0xffff)
      sectionNameIndex = readU32(bytes, sectionOffset + 40);
  }
  if (programEntrySize < 56 || programCount < 1 || programCount > 256
    || programOffset < 64
    || checkedBinaryRangeEnd(
      programOffset, programEntrySize * programCount, "ELF_PROGRAM_TABLE_RANGE_HOLD",
    ) > bytes.length) fail("ELF_PROGRAM_TABLE_HOLD");
  if ((sectionOffset > 0 && sectionCount < 1) || sectionCount > 4096
    || (sectionCount > 0
    && (sectionOffset === 0 || sectionEntrySize < 64
      || checkedBinaryRangeEnd(
        sectionOffset, sectionEntrySize * sectionCount,
        "ELF_SECTION_TABLE_RANGE_HOLD",
      ) > bytes.length
      || (sectionNameIndex !== 0 && sectionNameIndex >= sectionCount)))) {
    fail("ELF_EXTENDED_SECTION_TABLE_HOLD");
  }
  let interp = false, dynamic = false, stack = false;
  let execStack = false, writableExec = false, entryObserved = false;
  let fileEnd = Math.max(64, programOffset + programEntrySize * programCount);
  const loads = [];
  const relroRanges = [];
  for (let index = 0; index < programCount; index += 1) {
    const offset = programOffset + index * programEntrySize;
    if (offset + 56 > bytes.length) fail("ELF_PROGRAM_RANGE_HOLD");
    const type = readU32(bytes, offset), flags = readU32(bytes, offset + 4);
    const fileOffset = readU64(bytes, offset + 8);
    const virtualAddress = readU64(bytes, offset + 16);
    const fileSize = readU64(bytes, offset + 32);
    const memorySize = readU64(bytes, offset + 40);
    const alignment = readU64(bytes, offset + 48);
    const fileRangeEnd = checkedBinaryRangeEnd(
      fileOffset, fileSize, "ELF_SEGMENT_FILE_RANGE_OVERFLOW_HOLD",
    );
    const memoryRangeEnd = checkedBinaryRangeEnd(
      virtualAddress, memorySize, "ELF_SEGMENT_MEMORY_RANGE_OVERFLOW_HOLD",
    );
    if (fileSize > memorySize || fileRangeEnd > bytes.length
      || (alignment !== 0 && (!Number.isInteger(Math.log2(alignment))
        || fileOffset % alignment !== virtualAddress % alignment))) {
      fail("ELF_SEGMENT_RANGE_ALIGNMENT_HOLD");
    }
    fileEnd = Math.max(fileEnd, fileRangeEnd);
    if (type === 3) interp = true;
    if (type === 2) dynamic = true;
    if (type === 0x6474e552) {
      if (memorySize === 0) fail("ELF_RELRO_NONZERO_RANGE_HOLD");
      relroRanges.push({ start: virtualAddress, end: memoryRangeEnd });
    }
    if (type === 0x6474e551) {
      stack = true;
      if ((flags & 1) !== 0) execStack = true;
    }
    if ((flags & 1) !== 0 && (flags & 2) !== 0) writableExec = true;
    if (type === 1) {
      if (memorySize === 0) fail("ELF_PT_LOAD_EMPTY_HOLD");
      if (loads.some((load) => virtualAddress < load.memoryEnd
          && load.virtualAddress < memoryRangeEnd)) {
        fail("ELF_PT_LOAD_VIRTUAL_OVERLAP_HOLD");
      }
      if (loads.some((load) => fileSize > 0 && load.fileSize > 0
          && fileOffset < load.fileEnd && load.fileOffset < fileRangeEnd)) {
        fail("ELF_PT_LOAD_FILE_OVERLAP_HOLD");
      }
      loads.push({
        fileEnd: fileRangeEnd, fileOffset, fileSize,
        memoryEnd: memoryRangeEnd, virtualAddress,
      });
      if (entry >= virtualAddress && entry < memoryRangeEnd
        && entry - virtualAddress < fileSize && (flags & 1) !== 0) {
        entryObserved = true;
      }
    }
  }
  if (interp) fail("ELF_PT_INTERP_FORBIDDEN_HOLD");
  if (dynamic) fail("ELF_DYNAMIC_NEEDED_FORBIDDEN_HOLD");
  if (relroRanges.length < 1) fail("ELF_RELRO_REQUIRED_HOLD");
  if (relroRanges.some((range) => !loads.some(
    (load) => range.start >= load.virtualAddress && range.end <= load.memoryEnd,
  ))) fail("ELF_RELRO_NOT_MAPPED_BY_PT_LOAD_HOLD");
  if (!stack) fail("ELF_GNU_STACK_REQUIRED_HOLD");
  if (execStack) fail("ELF_EXECUTABLE_STACK_HOLD");
  if (writableExec) fail("ELF_WRITE_EXECUTE_SEGMENT_HOLD");
  if (entry === 0 || !entryObserved) fail("ELF_ENTRY_LOAD_POLICY_HOLD");
  if (sectionCount > 0) {
    fileEnd = Math.max(fileEnd, sectionOffset + sectionEntrySize * sectionCount);
    for (let index = 0; index < sectionCount; index += 1) {
      const offset = sectionOffset + index * sectionEntrySize;
      const type = readU32(bytes, offset + 4);
      const flags = readU64(bytes, offset + 8);
      const dataOffset = readU64(bytes, offset + 24);
      const dataSize = readU64(bytes, offset + 32);
      if ([2, 4, 6, 9, 11].includes(type))
        fail("ELF_SYMBOL_DYNAMIC_RELOCATION_SECTION_HOLD");
      if ((flags & 1) !== 0 && (flags & 4) !== 0)
        fail("ELF_WRITE_EXECUTE_SECTION_HOLD");
      if (index !== 0 && type !== 8) {
        const dataEnd = checkedBinaryRangeEnd(
          dataOffset, dataSize, "ELF_SECTION_RANGE_OVERFLOW_HOLD",
        );
        if (dataEnd > bytes.length) fail("ELF_SECTION_RANGE_HOLD");
        fileEnd = Math.max(fileEnd, dataEnd);
      }
    }
  }
  if (fileEnd !== bytes.length) fail("ELF_OVERLAY_OR_UNMAPPED_BYTES_HOLD");
  return Object.freeze({
    format: "ELF64",
    machine: "x86_64",
    sha256: sha256(bytes),
    byteLength: bytes.length,
  });
}

function policyTargetReady(target, name) {
  const common = [
    "executablePath", "executableRealpath", "executableSha256",
    "executableByteLength", "versionStdoutSha256", "compilerClosureSha256",
    "binarySha256", "binaryByteLength",
  ];
  const targetSpecific = name === "linux-x64-musl"
    ? ["muslSysrootClosureSha256", "elfImportAllowlist"]
    : ["mingwSysrootClosureSha256", "peImportAllowlist"];
  if (!target || [...common, ...targetSpecific].some((key) => target[key] === null || target[key] === undefined)) return false;
  if (!common.filter((key) => key.endsWith("Sha256")).every((key) => SHA256_PATTERN.test(target[key]))) return false;
  if (typeof target.executablePath !== "string"
    || typeof target.executableRealpath !== "string"
    || !isAbsolute(target.executablePath)
    || !isAbsolute(target.executableRealpath)
    || caseFoldPath(target.executablePath)
      !== caseFoldPath(target.executableRealpath)
    || !Number.isSafeInteger(target.executableByteLength)
    || target.executableByteLength < 1
    || !Number.isSafeInteger(target.binaryByteLength)
    || target.binaryByteLength < 1) return false;
  const sysroot = name === "linux-x64-musl"
    ? target.muslSysrootClosureSha256
    : target.mingwSysrootClosureSha256;
  const allowlist = name === "linux-x64-musl"
    ? target.elfImportAllowlist : target.peImportAllowlist;
  return SHA256_PATTERN.test(sysroot) && Array.isArray(allowlist)
    && new Set(allowlist).size === allowlist.length
    && canonicalJson(allowlist) === canonicalJson([...allowlist].sort())
    && (name === "linux-x64-musl"
      ? allowlist.length === 0
      : allowlist.every((entry) => typeof entry === "string"
        && /^[a-z0-9._-]+\.dll$/u.test(entry)));
}

export function assessNativeContainmentPreflight({
  policy,
  sourceClosure,
  buildContractClosure,
  authoritySourceObservation,
  headSha = null,
  treeSha = null,
} = {}) {
  const blockers = [];
  if (!policy || policy.schema !== "iat-b3-mandatory-ci-containment-toolchains/v1") blockers.push("TOOLCHAIN_POLICY_INVALID");
  if (!sourceClosure || !SHA256_PATTERN.test(sourceClosure.closureSha256 ?? "")
    || canonicalJson(sourceClosure.files?.map((file) => file.path) ?? [])
      !== canonicalJson(IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS)) {
    blockers.push("EXACT_SEVEN_FILE_SOURCE_CLOSURE_UNOBSERVED");
  }
  if (!buildContractClosure
    || !SHA256_PATTERN.test(buildContractClosure.closureSha256 ?? "")
    || canonicalJson(buildContractClosure.files?.map((file) => file.path) ?? [])
      !== canonicalJson(IAT_B3_NATIVE_CONTAINMENT_BUILD_CONTRACT_PATHS)) {
    blockers.push("BUILD_CONTRACT_CLOSURE_UNOBSERVED");
  }
  if (!authoritySourceObservation
    || authoritySourceObservation.path
      !== IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE.path
    || authoritySourceObservation.sha256
      !== IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE.sha256
    || authoritySourceObservation.status !== "HOLD"
    || authoritySourceObservation.compileOrExecuteAuthorized !== false) {
    blockers.push("DIRECT_AUTHORITY_SOURCE_BINDING_UNOBSERVED");
  }
  for (const target of ["linux-x64-musl", "windows-x64-gnu"]) if (!policyTargetReady(policy?.targets?.[target], target)) blockers.push(`${target.toUpperCase().replaceAll("-", "_")}_TOOLCHAIN_UNMEASURED`);
  if (!GIT_OBJECT_ID_PATTERN.test(headSha ?? "")) blockers.push("EXACT_CLEAN_HEAD_UNOBSERVED");
  if (!GIT_OBJECT_ID_PATTERN.test(treeSha ?? "")) blockers.push("EXACT_CLEAN_TREE_UNOBSERVED");
  blockers.push(
    "RECURSIVE_SAME_OBJECT_TOOLCHAIN_CLOSURE_UNOBSERVED",
    "EXACT_EXECUTABLE_ARGV_ENV_CWD_UNOBSERVED",
    "TWO_DISJOINT_A_B_BUILDS_PER_TARGET_UNOBSERVED",
    "DIRECT_ARTIFACT_LOG_BYTE_EQUALITY_UNOBSERVED",
    "PE_ELF_POLICY_UNOBSERVED",
    "TWO_GIB_CONTINUOUS_OBSERVER_UNOBSERVED",
    "IDENTITY_BOUND_CLEANUP_UNOBSERVED",
    "OBSERVER_OWNED_RECEIPT_ADMISSION_UNIMPLEMENTED_HOLD",
    "NATIVE_HELPER_RUNTIME_SEPARATE_AND_UNOBSERVED",
  );
  return Object.freeze({
    schema: IAT_B3_NATIVE_CONTAINMENT_PREFLIGHT_SCHEMA,
    status: "HOLD",
    ready: false,
    complete: false,
    buildAuthorized: false,
    compilerObserved: false,
    buildExecuted: false,
    buildProvenanceObserved: false,
    executionProvenanceObserved: false,
    runtimeEvidenceObserved: false,
    headSha,
    treeSha,
    sourceClosureSha256: sourceClosure?.closureSha256 ?? null,
    buildContractClosureSha256:
      buildContractClosure?.closureSha256 ?? null,
    authoritySource: IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE,
    blockers: Object.freeze([...new Set(blockers)]),
  });
}

function openTrustedCanonicalPreimage(bytesLike, trustedSha256, code) {
  assertSha(trustedSha256, `${code}_TRUST_ANCHOR_HOLD`);
  const preimage = parseCanonicalExternalJson(bytesLike, code);
  if (preimage.sha256 !== trustedSha256)
    fail(`${code}_TRUST_ANCHOR_MISMATCH_HOLD`);
  return preimage;
}

function validateObservedInventoryPreimage({
  preimage, schema, expectedPaths, expectedRoles, observerSessionId,
  expectedClosureSha256, code,
}) {
  validateSemanticExternalObject(preimage, schema, code);
  assertExactKeys(preimage, [
    "closureSha256", "entries", "observerSessionId", "repositoryRoot",
    "schema", "semanticSha256",
  ], `${code}_EXACT_SCHEMA_HOLD`);
  assertAbsolutePath(preimage.repositoryRoot, `${code}_REPOSITORY_ROOT_HOLD`);
  if (preimage.observerSessionId !== observerSessionId
    || !Array.isArray(preimage.entries)
    || preimage.entries.length !== expectedPaths.length) {
    fail(`${code}_HEADER_OR_COUNT_HOLD`);
  }
  const fileIds = new Set();
  const foldedPaths = new Set();
  for (let index = 0; index < preimage.entries.length; index += 1) {
    const entry = preimage.entries[index];
    assertExactKeys(entry, ["descriptor", "path", "role"],
      `${code}_ENTRY_SCHEMA_HOLD`);
    assertObservedDescriptor(entry.descriptor, `${code}_DESCRIPTOR_HOLD`);
    if (entry.path !== expectedPaths[index] || entry.role !== expectedRoles[index]
      || caseFoldPath(entry.descriptor.realpath)
        !== caseFoldPath(resolve(preimage.repositoryRoot, entry.path))
      || fileIds.has(entry.descriptor.fileId)
      || foldedPaths.has(entry.path.toLowerCase())) {
      fail(`${code}_PATH_ROLE_OR_FILE_ID_CLOSURE_HOLD`);
    }
    fileIds.add(entry.descriptor.fileId);
    foldedPaths.add(entry.path.toLowerCase());
  }
  const files = preimage.entries.map((entry) => ({
    path: entry.path,
    sha256: entry.descriptor.sha256,
    byteLength: entry.descriptor.byteLength,
  }));
  if (preimage.closureSha256 !== semanticSha256(files)
    || preimage.closureSha256 !== expectedClosureSha256) {
    fail(`${code}_CLOSURE_PREIMAGE_MISMATCH_HOLD`);
  }
  return preimage;
}

function validatePolicyPreimage({
  preimage, policy, receipt, observerSessionId,
}) {
  validateSemanticExternalObject(preimage,
    "iat-b3-mandatory-ci-native-policy-preimage/v1", "POLICY_PREIMAGE");
  assertExactKeys(preimage, [
    "descriptor", "observerSessionId", "policy", "repositoryRoot", "schema",
    "semanticSha256",
  ], "POLICY_PREIMAGE_EXACT_SCHEMA_HOLD");
  assertObservedDescriptor(preimage.descriptor,
    "POLICY_PREIMAGE_DESCRIPTOR_HOLD");
  assertAbsolutePath(preimage.repositoryRoot,
    "POLICY_PREIMAGE_REPOSITORY_ROOT_HOLD");
  const policyPath = IAT_B3_NATIVE_CONTAINMENT_BUILD_CONTRACT_PATHS[0];
  if (preimage.observerSessionId !== observerSessionId
    || preimage.descriptor.sha256 !== receipt.policySha256
    || caseFoldPath(preimage.descriptor.realpath)
      !== caseFoldPath(resolve(preimage.repositoryRoot, policyPath))
    || canonicalJson(preimage.policy) !== canonicalJson(policy)) {
    fail("POLICY_PREIMAGE_OBJECT_BINDING_HOLD");
  }
  return preimage;
}

function normalizedRecipeSha256({
  target, executablePath, argv, environment, sourceClosureSha256,
  contractSha256, outputPath,
}) {
  return semanticSha256({
    target,
    executablePath,
    argv: argv.map((argument) => argument === outputPath
      ? "<ISOLATED_OUTPUT>" : argument),
    cwd: "<ISOLATED_CWD>",
    environment: {
      ...environment,
      HOME: "<ISOLATED_HOME>",
      TMPDIR: "<ISOLATED_TMP>",
      TMP: "<ISOLATED_TMP>",
      TEMP: "<ISOLATED_TMP>",
      ZIG_GLOBAL_CACHE_DIR: "<ISOLATED_GLOBAL_CACHE>",
      ZIG_LOCAL_CACHE_DIR: "<ISOLATED_LOCAL_CACHE>",
    },
    sourceClosureSha256,
    contractSha256,
  });
}

function validateCanonicalBuildPlan({
  preimage, receipt, toolchainClosures, trustedPlanSha256,
}) {
  validateSemanticExternalObject(preimage,
    "iat-b3-mandatory-ci-native-build-plan/v1", "BUILD_PLAN_PREIMAGE");
  assertExactKeys(preimage, [
    "builds", "contractSha256", "isolatedParentRoot", "observerSessionId",
    "policySha256", "repositoryRoot", "schema", "semanticSha256",
    "sourceClosureSha256",
  ], "BUILD_PLAN_PREIMAGE_EXACT_SCHEMA_HOLD");
  assertAbsolutePath(preimage.repositoryRoot, "BUILD_PLAN_REPOSITORY_ROOT_HOLD");
  assertAbsolutePath(preimage.isolatedParentRoot,
    "BUILD_PLAN_ISOLATED_PARENT_ROOT_HOLD");
  if (!pathsDisjoint(preimage.repositoryRoot, preimage.isolatedParentRoot)
    || preimage.observerSessionId !== receipt.observerSessionId
    || preimage.policySha256 !== receipt.policySha256
    || preimage.sourceClosureSha256 !== receipt.sourceClosureSha256
    || preimage.contractSha256 !== receipt.contractSha256
    || !Array.isArray(preimage.builds) || preimage.builds.length !== 4) {
    fail("BUILD_PLAN_HEADER_BINDING_HOLD");
  }
  const expectedBuildIds = IAT_B3_NATIVE_CONTAINMENT_TARGETS.flatMap(
    (target) => IAT_B3_NATIVE_CONTAINMENT_BUILD_LANES.map(
      (lane) => `${target}-${lane}`,
    ),
  );
  const roots = [];
  const invocations = new Set();
  for (let index = 0; index < preimage.builds.length; index += 1) {
    const plan = preimage.builds[index];
    const build = receipt.builds[index];
    assertExactKeys(plan, [
      "absenceRequirements", "argv", "cacheRoot", "cwd", "environment",
      "executablePath", "home", "id", "invocationSha256", "lane",
      "logPath", "outputPath", "recipeSha256", "root", "target",
      "temporaryRoot",
    ], "BUILD_PLAN_ENTRY_EXACT_SCHEMA_HOLD");
    const id = `${plan.target}-${plan.lane}`;
    if (id !== expectedBuildIds[index] || id !== `${build.target}-${build.lane}`)
      fail("BUILD_PLAN_ORDER_OR_ID_HOLD");
    const expectedPaths = exactNativeContainmentLanePaths({
      isolatedParentRoot: preimage.isolatedParentRoot,
      target: plan.target,
      lane: plan.lane,
    });
    for (const path of [
      plan.root, plan.cwd, plan.home, plan.temporaryRoot, plan.cacheRoot,
      plan.outputPath, plan.logPath, plan.executablePath,
    ]) assertAbsolutePath(path, "BUILD_PLAN_ENTRY_ABSOLUTE_PATH_HOLD");
    if (plan.root !== expectedPaths.root
      || plan.cwd !== expectedPaths.cwd || plan.home !== expectedPaths.home
      || plan.temporaryRoot !== expectedPaths.temporaryRoot
      || plan.cacheRoot !== expectedPaths.cacheRoot
      || plan.outputPath !== expectedPaths.outputPath
      || plan.logPath !== expectedPaths.logPath
      || roots.some((root) => !pathsDisjoint(root, plan.root))) {
      fail("BUILD_PLAN_NONCANONICAL_OR_ROLE_PATH_ALIAS_HOLD");
    }
    roots.push(plan.root);
    const expectedEnvironment = sanitizeNativeContainmentEnvironment({
      home: plan.home,
      temporaryRoot: plan.temporaryRoot,
      cacheRoot: plan.cacheRoot,
    });
    const expectedArgv = exactNativeContainmentZigArgv({
      target: plan.target,
      compilerPath: plan.executablePath,
      repository: preimage.repositoryRoot,
      contractSha256: receipt.contractSha256,
      outputPath: plan.outputPath,
    });
    const expectedRecipeSha256 = normalizedRecipeSha256({
      target: plan.target,
      executablePath: plan.executablePath,
      argv: expectedArgv,
      environment: expectedEnvironment,
      sourceClosureSha256: receipt.sourceClosureSha256,
      contractSha256: receipt.contractSha256,
      outputPath: plan.outputPath,
    });
    const expectedInvocationSha256 = semanticSha256({
      executablePath: plan.executablePath,
      argv: expectedArgv,
      cwd: plan.cwd,
      environment: expectedEnvironment,
      cacheRoot: plan.cacheRoot,
      outputPath: plan.outputPath,
      logPath: plan.logPath,
    });
    if (canonicalJson(plan.absenceRequirements) !== canonicalJson({
      cacheRootAbsentBeforeBuild: true,
      outputAbsentBeforeBuild: true,
      rootAbsentBeforeBuild: true,
    })
      || plan.executablePath
        !== toolchainClosures[plan.target].rootExecutablePath
      || toolchainClosures[plan.target].target !== plan.target
      || canonicalJson(plan.argv) !== canonicalJson(expectedArgv)
      || canonicalJson(plan.environment) !== canonicalJson(expectedEnvironment)
      || plan.root !== build.root || plan.cwd !== build.cwd
      || plan.cacheRoot !== build.cacheRoot
      || plan.outputPath !== build.artifactPath || plan.logPath !== build.logPath
      || plan.recipeSha256 !== expectedRecipeSha256
      || plan.recipeSha256 !== build.recipeSha256
      || plan.invocationSha256 !== expectedInvocationSha256
      || invocations.has(plan.invocationSha256)) {
      fail("BUILD_PLAN_ARGV_ENV_CWD_CACHE_OUTPUT_OR_RECIPE_HOLD");
    }
    invocations.add(plan.invocationSha256);
  }
  if (trustedPlanSha256 !== sha256(Buffer.from(canonicalJson(preimage), "utf8")))
    fail("BUILD_PLAN_PREIMAGE_TRUST_RECHECK_HOLD");
  return preimage;
}

function validateDirectBuildBytes(receipt, artifactBytesByBuildId,
  logBytesByBuildId) {
  const expectedBuildIds = receipt.builds.map(
    (build) => `${build.target}-${build.lane}`,
  );
  assertExactKeys(artifactBytesByBuildId, expectedBuildIds,
    "EXTERNAL_ARTIFACT_BYTES_MAP_HOLD");
  assertExactKeys(logBytesByBuildId, expectedBuildIds,
    "EXTERNAL_LOG_BYTES_MAP_HOLD");
  const artifacts = new Map();
  for (const id of expectedBuildIds) {
    const artifact = exactExternalBytes(
      artifactBytesByBuildId[id], "EXTERNAL_ARTIFACT_BYTES_HOLD",
      512 * 1024 * 1024,
    );
    const log = exactExternalBytes(
      logBytesByBuildId[id], "EXTERNAL_LOG_BYTES_HOLD",
      512 * 1024 * 1024,
    );
    if (artifact.byteLength !== receipt.artifacts[id].descriptor.byteLength
      || sha256(artifact) !== receipt.artifacts[id].descriptor.sha256
      || log.byteLength !== receipt.logs[id].descriptor.byteLength
      || sha256(log) !== receipt.logs[id].descriptor.sha256) {
      fail("EXTERNAL_ARTIFACT_LOG_PREIMAGE_MISMATCH_HOLD", id);
    }
    artifacts.set(id, artifact);
  }
  for (const target of IAT_B3_NATIVE_CONTAINMENT_TARGETS) {
    const first = artifacts.get(`${target}-A`);
    const second = artifacts.get(`${target}-B`);
    if (first.byteLength !== second.byteLength || !first.equals(second))
      fail("EXTERNAL_A_B_DIRECT_BYTE_EQUALITY_HOLD", target);
  }
}

function validateCanonicalObserverEvidence({
  preimage, receipt, buildPlan, trustedBuildPlanSha256,
}) {
  validateSemanticExternalObject(preimage,
    "iat-b3-mandatory-ci-native-build-observer-evidence/v1",
    "BUILD_OBSERVER_PREIMAGE");
  assertExactKeys(preimage, [
    "buildPlanSha256", "builds", "cleanupObservation", "observerSessionId",
    "resourceObservation", "schema", "semanticSha256",
  ], "BUILD_OBSERVER_PREIMAGE_EXACT_SCHEMA_HOLD");
  if (preimage.buildPlanSha256 !== trustedBuildPlanSha256
    || preimage.observerSessionId !== receipt.observerSessionId
    || canonicalJson(preimage.resourceObservation)
      !== canonicalJson(receipt.resourceObservation)
    || canonicalJson(preimage.cleanupObservation)
      !== canonicalJson(receipt.cleanupObservation)
    || !Array.isArray(preimage.builds) || preimage.builds.length !== 4) {
    fail("BUILD_OBSERVER_HEADER_OR_RECEIPT_BINDING_HOLD");
  }
  const allFileIds = new Set();
  if (typeof receipt.resourceObservation.writeObserverFileId !== "string"
    || receipt.resourceObservation.writeObserverFileId.length < 1) {
    fail("BUILD_OBSERVER_WRITE_OBSERVER_FILE_ID_HOLD");
  }
  allFileIds.add(receipt.resourceObservation.writeObserverFileId);
  const rootFileIds = new Map();
  const rootCreatedAtByFileId = new Map();
  const processIdentities = new Set();
  const containerIdentities = new Set();
  for (let index = 0; index < preimage.builds.length; index += 1) {
    const evidence = preimage.builds[index];
    const build = receipt.builds[index];
    const plan = buildPlan.builds[index];
    const id = `${build.target}-${build.lane}`;
    assertExactKeys(evidence, [
      "artifactCreatedAtMonotonicMs", "artifactCreatorProcessIdentity",
      "artifactDescriptor", "buildId", "containerIdentity",
      "cacheRootAbsentBeforeBuild", "causationSha256",
      "executableDescriptor", "finishedAtMonotonicMs", "invocationSha256",
      "logCreatedAtMonotonicMs", "logCreatorProcessIdentity", "logDescriptor",
      "observedArgv", "observedCwd", "observedEnvironment",
      "outputAbsentBeforeBuild", "processIdentity",
      "rootAbsenceObservedAtMonotonicMs",
      "rootAbsentBeforeBuild", "rootCreatedAtMonotonicMs", "rootFileId",
      "startedAtMonotonicMs", "terminal",
    ], "BUILD_OBSERVER_ENTRY_EXACT_SCHEMA_HOLD");
    assertObservedDescriptor(evidence.artifactDescriptor,
      "BUILD_OBSERVER_ARTIFACT_DESCRIPTOR_HOLD");
    assertObservedDescriptor(evidence.logDescriptor,
      "BUILD_OBSERVER_LOG_DESCRIPTOR_HOLD");
    assertObservedDescriptor(evidence.executableDescriptor,
      "BUILD_OBSERVER_EXECUTABLE_DESCRIPTOR_HOLD");
    assertExactKeys(evidence.terminal,
      ["exitCode", "observedAtMonotonicMs", "signaled"],
      "BUILD_OBSERVER_TERMINAL_EXACT_SCHEMA_HOLD");
    for (const time of [
      evidence.rootAbsenceObservedAtMonotonicMs,
      evidence.rootCreatedAtMonotonicMs, evidence.startedAtMonotonicMs,
      evidence.artifactCreatedAtMonotonicMs, evidence.logCreatedAtMonotonicMs,
      evidence.finishedAtMonotonicMs,
    ]) if (!Number.isSafeInteger(time) || time < 0)
      fail("BUILD_OBSERVER_CHRONOLOGY_TYPE_HOLD");
    const rootExecutableEntry = receipt.toolchainClosures[build.target].entries
      .find((entry) => entry.path
        === receipt.toolchainClosures[build.target].rootExecutablePath);
    const { causationSha256, ...causation } = evidence;
    if (evidence.buildId !== id
      || evidence.rootAbsentBeforeBuild !== true
      || evidence.cacheRootAbsentBeforeBuild !== true
      || evidence.outputAbsentBeforeBuild !== true
      || evidence.rootAbsenceObservedAtMonotonicMs
        >= evidence.rootCreatedAtMonotonicMs
      || evidence.rootCreatedAtMonotonicMs > evidence.startedAtMonotonicMs
      || evidence.startedAtMonotonicMs !== build.startedAtMonotonicMs
      || evidence.finishedAtMonotonicMs !== build.finishedAtMonotonicMs
      || evidence.artifactCreatedAtMonotonicMs <= evidence.startedAtMonotonicMs
      || evidence.artifactCreatedAtMonotonicMs > evidence.finishedAtMonotonicMs
      || evidence.logCreatedAtMonotonicMs <= evidence.startedAtMonotonicMs
      || evidence.logCreatedAtMonotonicMs > evidence.finishedAtMonotonicMs
      || evidence.invocationSha256 !== plan.invocationSha256
      || canonicalJson(evidence.observedArgv) !== canonicalJson(plan.argv)
      || canonicalJson(evidence.observedEnvironment)
        !== canonicalJson(plan.environment)
      || evidence.observedCwd !== plan.cwd
      || !rootExecutableEntry
      || !sameObservedDescriptor(
        evidence.executableDescriptor, rootExecutableEntry.before,
      )
      || !SHA256_PATTERN.test(evidence.processIdentity)
      || !SHA256_PATTERN.test(evidence.containerIdentity)
      || evidence.processIdentity === evidence.containerIdentity
      || processIdentities.has(evidence.processIdentity)
      || containerIdentities.has(evidence.containerIdentity)
      || evidence.artifactCreatorProcessIdentity !== evidence.processIdentity
      || evidence.logCreatorProcessIdentity !== evidence.processIdentity
      || evidence.terminal.exitCode !== 0
      || evidence.terminal.signaled !== false
      || evidence.terminal.observedAtMonotonicMs
        !== evidence.finishedAtMonotonicMs
      || canonicalJson(evidence.artifactDescriptor)
        !== canonicalJson(receipt.artifacts[id].descriptor)
      || canonicalJson(evidence.logDescriptor)
        !== canonicalJson(receipt.logs[id].descriptor)
      || semanticSha256(causation) !== causationSha256
      || typeof evidence.rootFileId !== "string"
      || evidence.rootFileId.length < 1
      || plan.id !== id) {
      fail("BUILD_OBSERVER_ROOT_ABSENCE_OR_CAUSATION_HOLD");
    }
    processIdentities.add(evidence.processIdentity);
    containerIdentities.add(evidence.containerIdentity);
    for (const fileId of [
      evidence.rootFileId, evidence.artifactDescriptor.fileId,
      evidence.logDescriptor.fileId,
    ]) {
      if (allFileIds.has(fileId)) fail("BUILD_OBSERVER_FILE_ID_REPLAY_HOLD");
      allFileIds.add(fileId);
    }
    rootFileIds.set(plan.root, evidence.rootFileId);
    rootCreatedAtByFileId.set(
      evidence.rootFileId, evidence.rootCreatedAtMonotonicMs,
    );
  }
  const earliestRootAbsence = Math.min(...preimage.builds.map(
    (evidence) => evidence.rootAbsenceObservedAtMonotonicMs,
  ));
  if (receipt.resourceObservation.monitoringStartedAtMonotonicMs
      >= earliestRootAbsence
    || receipt.resourceObservation.samples[0].monotonicMs
      >= earliestRootAbsence) {
    fail("RESOURCE_OBSERVER_DID_NOT_PRECEDE_ROOT_ABSENCE_HOLD");
  }
  const cleanupRoots = new Map(
    receipt.cleanupObservation.roots.map((root) => [root.path, root.fileId]),
  );
  if (cleanupRoots.size !== rootFileIds.size
    || [...rootFileIds].some(([path, fileId]) => cleanupRoots.get(path) !== fileId)) {
    fail("BUILD_OBSERVER_CLEANUP_ROOT_IDENTITY_HOLD");
  }
  const sampledRootFileIds = new Set();
  const removedAtByFileId = new Map(
    receipt.cleanupObservation.roots.map(
      (root) => [root.fileId, root.removedAtMonotonicMs],
    ),
  );
  for (const sample of receipt.resourceObservation.samples) {
    const expectedLiveRootFileIds = [...rootFileIds.values()].filter(
      (fileId) => sample.monotonicMs >= rootCreatedAtByFileId.get(fileId)
        && sample.monotonicMs < removedAtByFileId.get(fileId),
    ).sort();
    if (canonicalJson(sample.rootFileIds)
      !== canonicalJson(expectedLiveRootFileIds)) {
      fail("RESOURCE_SAMPLE_LIVE_ROOT_IDENTITY_SET_HOLD");
    }
    for (const fileId of sample.rootFileIds) {
      if (!allFileIds.has(fileId) || ![...rootFileIds.values()].includes(fileId))
        fail("RESOURCE_SAMPLE_UNKNOWN_ROOT_FILE_ID_HOLD");
      if (sample.monotonicMs < rootCreatedAtByFileId.get(fileId)
        || sample.monotonicMs >= removedAtByFileId.get(fileId)) {
        fail("RESOURCE_SAMPLE_ROOT_IDENTITY_CHRONOLOGY_HOLD");
      }
      sampledRootFileIds.add(fileId);
    }
  }
  if ([...rootFileIds.values()].some((fileId) => !sampledRootFileIds.has(fileId))
    || receipt.resourceObservation.samples.at(-1).rootFileIds.length !== 0) {
    fail("RESOURCE_SAMPLE_ROOT_IDENTITY_COVERAGE_HOLD");
  }
}

function validateExternalBuildPreimages(receipt, policy, evidence, trust) {
  if (evidence === null || trust === null) return false;
  assertExactKeys(trust, [
    "buildPlanPreimageSha256", "contractPreimageSha256",
    "observerPreimageSha256", "policyPreimageSha256",
    "sourcePreimageSha256", "sysrootPreimageSha256ByTarget",
    "toolchainPreimageSha256ByTarget",
  ], "EXTERNAL_BUILD_TRUST_EXACT_SCHEMA_HOLD");
  assertExactKeys(evidence, [
    "artifactBytesByBuildId", "buildPlanBytes", "contractPreimageBytes",
    "logBytesByBuildId", "observerPreimageBytes", "policyPreimageBytes",
    "sourcePreimageBytes", "sysrootPreimageBytesByTarget",
    "toolchainPreimageBytesByTarget",
  ], "EXTERNAL_BUILD_EVIDENCE_EXACT_SCHEMA_HOLD");
  for (const map of [
    trust.sysrootPreimageSha256ByTarget,
    trust.toolchainPreimageSha256ByTarget,
    evidence.sysrootPreimageBytesByTarget,
    evidence.toolchainPreimageBytesByTarget,
  ]) assertExactKeys(map, IAT_B3_NATIVE_CONTAINMENT_TARGETS,
    "EXTERNAL_BUILD_TARGET_MAP_HOLD");
  const policyPreimage = openTrustedCanonicalPreimage(
    evidence.policyPreimageBytes, trust.policyPreimageSha256,
    "POLICY_PREIMAGE",
  ).parsed;
  validatePolicyPreimage({
    preimage: policyPreimage, policy, receipt,
    observerSessionId: receipt.observerSessionId,
  });
  const sourcePreimage = openTrustedCanonicalPreimage(
    evidence.sourcePreimageBytes, trust.sourcePreimageSha256,
    "SOURCE_PREIMAGE",
  ).parsed;
  validateObservedInventoryPreimage({
    preimage: sourcePreimage,
    schema: "iat-b3-mandatory-ci-native-source-preimage/v1",
    expectedPaths: IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS,
    expectedRoles: IAT_B3_NATIVE_CONTAINMENT_SOURCE_PATHS.map(() => "source"),
    observerSessionId: receipt.observerSessionId,
    expectedClosureSha256: receipt.sourceClosureSha256,
    code: "SOURCE_PREIMAGE",
  });
  const contractPreimage = openTrustedCanonicalPreimage(
    evidence.contractPreimageBytes, trust.contractPreimageSha256,
    "CONTRACT_PREIMAGE",
  ).parsed;
  validateObservedInventoryPreimage({
    preimage: contractPreimage,
    schema: "iat-b3-mandatory-ci-native-contract-preimage/v1",
    expectedPaths: IAT_B3_NATIVE_CONTAINMENT_BUILD_CONTRACT_PATHS,
    expectedRoles: ["policy", "builder", "contract"],
    observerSessionId: receipt.observerSessionId,
    expectedClosureSha256: receipt.contractSha256,
    code: "CONTRACT_PREIMAGE",
  });
  if (policyPreimage.repositoryRoot !== sourcePreimage.repositoryRoot
    || policyPreimage.repositoryRoot !== contractPreimage.repositoryRoot
    || canonicalJson(policyPreimage.descriptor)
      !== canonicalJson(contractPreimage.entries[0].descriptor)) {
    fail("POLICY_SOURCE_CONTRACT_PREIMAGE_MIX_HOLD");
  }
  const contractFileIds = new Set(contractPreimage.entries.map(
    (entry) => entry.descriptor.fileId,
  ));
  if (sourcePreimage.entries.some(
    (entry) => contractFileIds.has(entry.descriptor.fileId),
  )) fail("SOURCE_CONTRACT_CROSS_CLOSURE_FILE_ID_ALIAS_HOLD");
  for (const target of IAT_B3_NATIVE_CONTAINMENT_TARGETS) {
    const toolchain = openTrustedCanonicalPreimage(
      evidence.toolchainPreimageBytesByTarget[target],
      trust.toolchainPreimageSha256ByTarget[target],
      `TOOLCHAIN_${target.toUpperCase().replaceAll("-", "_")}_PREIMAGE`,
    ).parsed;
    requireTargetedToolchainClosure(
      toolchain, target, "TOOLCHAIN_PREIMAGE_TARGET_MAP_KEY_MISMATCH_HOLD",
    );
    if (canonicalJson(toolchain)
      !== canonicalJson(receipt.toolchainClosures[target])) {
      fail("TOOLCHAIN_PREIMAGE_RECEIPT_MISMATCH_HOLD", target);
    }
    const sysroot = openTrustedCanonicalPreimage(
      evidence.sysrootPreimageBytesByTarget[target],
      trust.sysrootPreimageSha256ByTarget[target],
      `SYSROOT_${target.toUpperCase().replaceAll("-", "_")}_PREIMAGE`,
    ).parsed;
    const expectedEntries = toolchain.entries.filter(
      (entry) => entry.roles.includes("sysroot"),
    );
    const expectedSysroot = semanticExternalObject(
      "iat-b3-mandatory-ci-native-sysroot-preimage/v1", {
        entries: expectedEntries,
        observerSessionId: receipt.observerSessionId,
        target,
      },
    );
    if (toolchain.target !== target || sysroot.target !== target
      || canonicalJson(sysroot) !== canonicalJson(expectedSysroot))
      fail("SYSROOT_PREIMAGE_CLOSURE_MISMATCH_HOLD", target);
  }
  const buildPlanOpen = openTrustedCanonicalPreimage(
    evidence.buildPlanBytes, trust.buildPlanPreimageSha256,
    "BUILD_PLAN_PREIMAGE",
  );
  const buildPlan = validateCanonicalBuildPlan({
    preimage: buildPlanOpen.parsed,
    receipt,
    toolchainClosures: receipt.toolchainClosures,
    trustedPlanSha256: trust.buildPlanPreimageSha256,
  });
  if (buildPlan.repositoryRoot !== policyPreimage.repositoryRoot)
    fail("BUILD_PLAN_REPOSITORY_PREIMAGE_MIX_HOLD");
  const observer = openTrustedCanonicalPreimage(
    evidence.observerPreimageBytes, trust.observerPreimageSha256,
    "BUILD_OBSERVER_PREIMAGE",
  ).parsed;
  validateCanonicalObserverEvidence({
    preimage: observer, receipt, buildPlan,
    trustedBuildPlanSha256: trust.buildPlanPreimageSha256,
  });
  validateDirectBuildBytes(
    receipt, evidence.artifactBytesByBuildId, evidence.logBytesByBuildId,
  );
  return true;
}

export function validateNativeContainmentBuildReceipt(
  receipt,
  {
    artifactPaths = {}, externalEvidence = null, externalTrust = null,
    logPaths = {}, policy,
  } = {},
) {
  const blockers = [];
  const expectedBuildIds = IAT_B3_NATIVE_CONTAINMENT_TARGETS.flatMap(
    (target) => IAT_B3_NATIVE_CONTAINMENT_BUILD_LANES.map(
      (lane) => `${target}-${lane}`,
    ),
  );
  let structurallyValid = false;
  let externalPreimagesBound = false;
  try {
    assertExactKeys(receipt, [
      "artifacts", "authorityObservation", "blockers", "builds",
      "cleanupObservation", "complete", "contractSha256",
      "executionProvenanceObserved", "logs", "observerSessionId",
      "policySha256", "ready", "resourceObservation",
      "runtimeEvidenceObserved", "schema", "semanticSha256",
      "sourceClosureSha256", "status", "toolchainClosures",
    ], "RECEIPT_EXACT_SCHEMA_INVALID");
    if (receipt.schema !== IAT_B3_NATIVE_CONTAINMENT_RECEIPT_SCHEMA
      || receipt.status !== "STRUCTURAL_HOLD" || receipt.ready !== false
      || receipt.complete !== false
      || receipt.executionProvenanceObserved !== false
      || receipt.runtimeEvidenceObserved !== false
      || !SHA256_PATTERN.test(receipt.observerSessionId)) {
      fail("RECEIPT_STATUS_ESCALATION_FORBIDDEN");
    }
    for (const key of [
      "contractSha256", "policySha256", "semanticSha256",
      "sourceClosureSha256",
    ]) assertSha(receipt[key], `RECEIPT_${key.toUpperCase()}_INVALID`);
    const requiredReceiptBlockers = [
      "DIRECT_BUILD_AUTHORITY_FALSE",
      "RUNTIME_EVIDENCE_SEPARATE_AND_UNOBSERVED",
      "SELF_DIGEST_IS_NONAUTHORITATIVE",
    ];
    if (!Array.isArray(receipt.blockers)
      || canonicalJson(receipt.blockers) !== canonicalJson(requiredReceiptBlockers)) {
      fail("RECEIPT_BLOCKER_CLOSURE_HOLD");
    }
    assertExactKeys(receipt.authorityObservation,
      ["descriptor", "observerSessionId", "source"],
      "AUTHORITY_OBSERVATION_SCHEMA_HOLD");
    if (receipt.authorityObservation.observerSessionId !== receipt.observerSessionId
      || canonicalJson(receipt.authorityObservation.source)
        !== canonicalJson(IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE)) {
      fail("AUTHORITY_SOURCE_BINDING_HOLD");
    }
    assertObservedDescriptor(receipt.authorityObservation.descriptor,
      "AUTHORITY_DESCRIPTOR_HOLD");
    if (receipt.authorityObservation.descriptor.sha256
        !== IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE.sha256
      || receipt.authorityObservation.descriptor.byteLength !== 5_175
      || !caseFoldPath(receipt.authorityObservation.descriptor.realpath)
        .endsWith(`/${IAT_B3_NATIVE_CONTAINMENT_AUTHORITY_SOURCE.path.toLowerCase()}`)) {
      fail("AUTHORITY_DIRECT_OBJECT_MISMATCH_HOLD");
    }
    assertExactKeys(receipt.toolchainClosures,
      IAT_B3_NATIVE_CONTAINMENT_TARGETS,
      "RECEIPT_TOOLCHAIN_TARGET_KEYS_HOLD");
    const closureDigests = {};
    for (const target of IAT_B3_NATIVE_CONTAINMENT_TARGETS) {
      const validated = requireTargetedToolchainClosure(
        receipt.toolchainClosures[target], target,
        "RECEIPT_TOOLCHAIN_TARGET_MAP_KEY_MISMATCH_HOLD",
      );
      if (validated.observerSessionId !== receipt.observerSessionId)
        fail("RECEIPT_TOOLCHAIN_OBSERVER_MIX_HOLD");
      const policyTarget = policy?.targets?.[target];
      const closure = receipt.toolchainClosures[target];
      const rootEntry = closure.entries.find(
        (entry) => entry.path === closure.rootExecutablePath,
      );
      const sysrootKey = target === "linux-x64-musl"
        ? "muslSysrootClosureSha256" : "mingwSysrootClosureSha256";
      const sysrootEntries = closure.entries.filter(
        (entry) => entry.roles.includes("sysroot"),
      );
      if (!policyTargetReady(policyTarget, target)
        || validated.closureSha256 !== policyTarget.compilerClosureSha256
        || !rootEntry
        || caseFoldPath(closure.rootExecutablePath)
          !== caseFoldPath(policyTarget.executablePath)
        || rootEntry.before.sha256 !== policyTarget.executableSha256
        || rootEntry.before.byteLength !== policyTarget.executableByteLength
        || caseFoldPath(rootEntry.before.realpath)
          !== caseFoldPath(policyTarget.executableRealpath)
        || semanticSha256(sysrootEntries) !== policyTarget[sysrootKey]) {
        fail("RECEIPT_TOOLCHAIN_POLICY_OBJECT_BINDING_HOLD");
      }
      closureDigests[target] = validated.closureSha256;
    }
    if (!Array.isArray(receipt.builds) || receipt.builds.length !== 4)
      fail("RECEIPT_TWO_BUILDS_PER_TARGET_REQUIRED");
    const buildIds = [];
    const roots = [];
    const artifactClaims = new Map();
    for (const build of receipt.builds) {
      assertExactKeys(build, [
        "artifactByteLength", "artifactPath", "artifactSha256", "cacheRoot",
        "contractSha256", "cwd", "finishedAtMonotonicMs", "lane", "logPath",
        "observerSessionId", "recipeSha256", "root", "sourceClosureSha256",
        "startedAtMonotonicMs", "target", "toolchainClosureSha256",
      ], "RECEIPT_BUILD_EXACT_SCHEMA_HOLD");
      const id = `${build.target}-${build.lane}`;
      buildIds.push(id);
      if (!expectedBuildIds.includes(id)
        || build.observerSessionId !== receipt.observerSessionId
        || build.contractSha256 !== receipt.contractSha256
        || build.sourceClosureSha256 !== receipt.sourceClosureSha256
        || build.toolchainClosureSha256 !== closureDigests[build.target]
        || !SHA256_PATTERN.test(build.recipeSha256)
        || !SHA256_PATTERN.test(build.artifactSha256)
        || !Number.isSafeInteger(build.artifactByteLength)
        || build.artifactByteLength < 1
        || !Number.isSafeInteger(build.startedAtMonotonicMs)
        || !Number.isSafeInteger(build.finishedAtMonotonicMs)
        || build.startedAtMonotonicMs < 0
        || build.finishedAtMonotonicMs <= build.startedAtMonotonicMs) {
        fail("RECEIPT_BUILD_BINDING_HOLD");
      }
      for (const path of [
        build.root, build.cwd, build.cacheRoot, build.artifactPath, build.logPath,
      ]) assertAbsolutePath(path, "RECEIPT_BUILD_PATH_ABSOLUTE_HOLD");
      if (![build.cwd, build.cacheRoot, build.artifactPath, build.logPath]
        .every((path) => inside(build.root, path))) {
        fail("RECEIPT_BUILD_PATH_OUTSIDE_ROOT_HOLD");
      }
      if (roots.some((root) => !pathsDisjoint(root, build.root)))
        fail("RECEIPT_BUILD_ROOT_CROSS_LANE_MIX_HOLD");
      roots.push(build.root);
      artifactClaims.set(id, Object.freeze({
        sha256: build.artifactSha256,
        byteLength: build.artifactByteLength,
      }));
    }
    if (canonicalJson(buildIds) !== canonicalJson(expectedBuildIds))
      fail("RECEIPT_BUILD_ORDER_DUPLICATE_OR_MISSING_HOLD");
    for (const target of IAT_B3_NATIVE_CONTAINMENT_TARGETS) {
      const first = receipt.builds.find(
        (build) => build.target === target && build.lane === "A",
      );
      const second = receipt.builds.find(
        (build) => build.target === target && build.lane === "B",
      );
      if (first.artifactSha256 !== second.artifactSha256
        || first.artifactByteLength !== second.artifactByteLength
        || first.recipeSha256 !== second.recipeSha256) {
        fail(`${target.toUpperCase().replaceAll("-", "_")}_DIRECT_BYTE_EQUALITY_HOLD`);
      }
    }
    assertExactKeys(receipt.artifacts, expectedBuildIds,
      "RECEIPT_ARTIFACT_CLAIMS_HOLD");
    assertExactKeys(receipt.logs, expectedBuildIds,
      "RECEIPT_LOG_CLAIMS_HOLD");
    for (const id of expectedBuildIds) {
      const build = receipt.builds.find(
        (candidate) => `${candidate.target}-${candidate.lane}` === id,
      );
      for (const [kind, claims, buildPath] of [
        ["ARTIFACT", receipt.artifacts, build.artifactPath],
        ["LOG", receipt.logs, build.logPath],
      ]) {
        const claim = claims[id];
        assertExactKeys(claim, ["descriptor", "observerSessionId", "path"],
          `RECEIPT_${kind}_OBSERVATION_SCHEMA_HOLD`);
        assertObservedDescriptor(claim.descriptor,
          `RECEIPT_${kind}_DESCRIPTOR_HOLD`);
        if (claim.observerSessionId !== receipt.observerSessionId
          || caseFoldPath(claim.path) !== caseFoldPath(buildPath)
          || caseFoldPath(claim.descriptor.realpath) !== caseFoldPath(buildPath)) {
          fail(`RECEIPT_${kind}_OBSERVER_BINDING_HOLD`);
        }
      }
      if (receipt.artifacts[id].descriptor.sha256
          !== artifactClaims.get(id).sha256
        || receipt.artifacts[id].descriptor.byteLength
          !== artifactClaims.get(id).byteLength) {
        fail("RECEIPT_ARTIFACT_BUILD_CROSS_BINDING_HOLD");
      }
    }
    assertExactKeys(receipt.resourceObservation, [
      "cleanupFinishedAtMonotonicMs", "highWaterBytes",
      "monitoringEndedAfterCleanup", "monitoringStartedBeforeBuilds",
      "monitoringStartedAtMonotonicMs", "monitoringStoppedAtMonotonicMs",
      "noOutsideWrites", "observerSessionId", "outsideWriteEventCount",
      "samples", "writeObserverFileId",
    ], "RESOURCE_OBSERVATION_SCHEMA_HOLD");
    const resource = receipt.resourceObservation;
    if (resource.observerSessionId !== receipt.observerSessionId
      || resource.monitoringStartedBeforeBuilds !== true
      || resource.monitoringEndedAfterCleanup !== true
      || resource.noOutsideWrites !== true
      || resource.outsideWriteEventCount !== 0
      || !Number.isSafeInteger(resource.highWaterBytes)
      || resource.highWaterBytes < 0
      || resource.highWaterBytes > IAT_B3_NATIVE_CONTAINMENT_MAX_OBSERVED_BYTES
      || !Number.isSafeInteger(resource.cleanupFinishedAtMonotonicMs)
      || !Number.isSafeInteger(resource.monitoringStartedAtMonotonicMs)
      || resource.monitoringStartedAtMonotonicMs < 0
      || !Number.isSafeInteger(resource.monitoringStoppedAtMonotonicMs)
      || resource.monitoringStoppedAtMonotonicMs < 0
      || typeof resource.writeObserverFileId !== "string"
      || resource.writeObserverFileId.length < 1
      || !Array.isArray(resource.samples) || resource.samples.length < 2) {
      fail("RESOURCE_OBSERVATION_HEADER_HOLD");
    }
    let observedHighWater = 0;
    let previousSample = null;
    for (const sample of resource.samples) {
      assertExactKeys(sample, [
        "cumulativeOutsideWriteCount", "monotonicMs", "observedBytes",
        "observerSessionId", "rootFileIds", "writeObserverFileId",
      ],
        "RESOURCE_SAMPLE_SCHEMA_HOLD");
      if (!Number.isSafeInteger(sample.monotonicMs) || sample.monotonicMs < 0
        || !Number.isSafeInteger(sample.observedBytes) || sample.observedBytes < 0
        || sample.observedBytes > IAT_B3_NATIVE_CONTAINMENT_MAX_OBSERVED_BYTES
        || sample.cumulativeOutsideWriteCount !== 0
        || sample.cumulativeOutsideWriteCount !== resource.outsideWriteEventCount
        || sample.observerSessionId !== receipt.observerSessionId
        || sample.writeObserverFileId !== resource.writeObserverFileId
        || !Array.isArray(sample.rootFileIds)
        || sample.rootFileIds.some(
          (fileId) => typeof fileId !== "string" || fileId.length < 1,
        )
        || new Set(sample.rootFileIds).size !== sample.rootFileIds.length
        || canonicalJson(sample.rootFileIds)
          !== canonicalJson([...sample.rootFileIds].sort())
        || (previousSample !== null
          && (sample.monotonicMs <= previousSample.monotonicMs
            || sample.monotonicMs - previousSample.monotonicMs
              > IAT_B3_NATIVE_CONTAINMENT_MAX_SAMPLE_GAP_MS))) {
        fail("RESOURCE_SAMPLE_CONTINUITY_OR_CAP_HOLD");
      }
      observedHighWater = Math.max(observedHighWater, sample.observedBytes);
      previousSample = sample;
    }
    const earliestBuild = Math.min(...receipt.builds.map(
      (build) => build.startedAtMonotonicMs,
    ));
    const latestBuild = Math.max(...receipt.builds.map(
      (build) => build.finishedAtMonotonicMs,
    ));
    if (resource.monitoringStartedAtMonotonicMs
        >= resource.samples[0].monotonicMs
      || resource.samples[0].monotonicMs >= earliestBuild
      || previousSample.monotonicMs < resource.cleanupFinishedAtMonotonicMs
      || resource.monitoringStoppedAtMonotonicMs
        <= resource.cleanupFinishedAtMonotonicMs
      || resource.monitoringStoppedAtMonotonicMs
        <= previousSample.monotonicMs
      || resource.highWaterBytes !== observedHighWater) {
      fail("RESOURCE_OBSERVER_BOUNDARY_HOLD");
    }
    assertExactKeys(receipt.cleanupObservation, [
      "allIdentitiesMatched", "allRootsAbsent", "ambiguousIdentity",
      "finishedAtMonotonicMs", "observerSessionId", "roots",
      "startedAtMonotonicMs", "writeObserverFileId",
    ], "CLEANUP_OBSERVATION_SCHEMA_HOLD");
    const cleanup = receipt.cleanupObservation;
    if (cleanup.observerSessionId !== receipt.observerSessionId
      || cleanup.writeObserverFileId !== resource.writeObserverFileId
      || cleanup.allIdentitiesMatched !== true || cleanup.allRootsAbsent !== true
      || cleanup.ambiguousIdentity !== false || !Array.isArray(cleanup.roots)
      || cleanup.roots.length !== roots.length
      || !Number.isSafeInteger(cleanup.startedAtMonotonicMs)
      || !Number.isSafeInteger(cleanup.finishedAtMonotonicMs)
      || cleanup.startedAtMonotonicMs < latestBuild
      || cleanup.finishedAtMonotonicMs <= cleanup.startedAtMonotonicMs
      || resource.cleanupFinishedAtMonotonicMs
        !== cleanup.finishedAtMonotonicMs) {
      fail("IDENTITY_BOUND_CLEANUP_HOLD");
    }
    const cleanupPaths = [];
    const cleanupFileIds = new Set();
    for (const root of cleanup.roots) {
      assertExactKeys(root, [
        "absentAfterCleanup", "fileId", "path", "removedAtMonotonicMs",
      ], "CLEANUP_ROOT_EXACT_SCHEMA_HOLD");
      assertAbsolutePath(root.path, "CLEANUP_ROOT_PATH_HOLD");
      if (root.absentAfterCleanup !== true
        || typeof root.fileId !== "string" || root.fileId.length < 1
        || cleanupFileIds.has(root.fileId)
        || !Number.isSafeInteger(root.removedAtMonotonicMs)
        || root.removedAtMonotonicMs < cleanup.startedAtMonotonicMs
        || root.removedAtMonotonicMs > cleanup.finishedAtMonotonicMs) {
        fail("CLEANUP_ROOT_IDENTITY_OR_CHRONOLOGY_HOLD");
      }
      cleanupFileIds.add(root.fileId);
      cleanupPaths.push(root.path);
    }
    if (canonicalJson(cleanupPaths) !== canonicalJson([...roots].sort()))
      fail("CLEANUP_ROOT_SET_OR_ORDER_HOLD");
    const { semanticSha256: declaredSemanticSha256, ...semanticPayload } = receipt;
    if (semanticSha256(semanticPayload) !== declaredSemanticSha256)
      fail("RECEIPT_SEMANTIC_SHA256_MISMATCH");
    externalPreimagesBound = validateExternalBuildPreimages(
      receipt, policy, externalEvidence, externalTrust,
    );
    structurallyValid = true;
  } catch (error) {
    blockers.push(typeof error?.code === "string"
      ? error.code : "RECEIPT_STRUCTURAL_VALIDATION_HOLD");
  }

  if (canonicalJson(Object.keys(artifactPaths).sort())
      !== canonicalJson(expectedBuildIds)
    || canonicalJson(Object.keys(logPaths).sort())
      !== canonicalJson(expectedBuildIds)) {
    blockers.push("DIRECT_OBSERVER_PATH_SET_INCOMPLETE_HOLD");
  } else if (structurallyValid) {
    const observedArtifacts = new Map();
    for (const id of expectedBuildIds) {
      try {
        const build = receipt.builds.find(
          (candidate) => `${candidate.target}-${candidate.lane}` === id,
        );
        if (caseFoldPath(artifactPaths[id]) !== caseFoldPath(build.artifactPath)
          || caseFoldPath(logPaths[id]) !== caseFoldPath(build.logPath)) {
          fail("DIRECT_OBSERVER_PATH_RECEIPT_MISMATCH_HOLD");
        }
        const artifact = readRegularSameFile(
          artifactPaths[id], receipt.artifacts[id].descriptor,
        );
        const log = readRegularSameFile(
          logPaths[id], receipt.logs[id].descriptor,
        );
        if (!sameObservedDescriptor(
          artifact.descriptor, receipt.artifacts[id].descriptor,
        ) || !sameObservedDescriptor(
          log.descriptor, receipt.logs[id].descriptor,
        )) fail("DIRECT_OBSERVER_OBJECT_RECEIPT_MISMATCH_HOLD");
        observedArtifacts.set(id, artifact.bytes);
        const target = build.target;
        if (target === "linux-x64-musl") {
          inspectStaticElf(artifact.bytes);
        } else {
          inspectPortableExecutable(artifact.bytes, {
            allowedImports: policy?.targets?.[target]?.peImportAllowlist,
          });
        }
      } catch {
        blockers.push(`DIRECT_ARTIFACT_OR_LOG_POLICY_${id.toUpperCase()}_HOLD`);
      }
    }
    for (const target of IAT_B3_NATIVE_CONTAINMENT_TARGETS) {
      const first = observedArtifacts.get(`${target}-A`);
      const second = observedArtifacts.get(`${target}-B`);
      if (!first || !second || first.length !== second.length
        || !first.equals(second)) {
        blockers.push(`${target.toUpperCase().replaceAll("-", "_")}_DIRECT_ARTIFACT_BYTE_COMPARISON_HOLD`);
      }
    }
  }
  if (!policyTargetReady(policy?.targets?.["linux-x64-musl"],
    "linux-x64-musl") || !policyTargetReady(
    policy?.targets?.["windows-x64-gnu"], "windows-x64-gnu")) {
    blockers.push("PINNED_TOOLCHAIN_POLICY_UNREADY");
  }
  if (!externalPreimagesBound)
    blockers.push("CANONICAL_EXTERNAL_BUILD_PREIMAGES_REQUIRED_HOLD");
  blockers.push(
    "SELF_DIGEST_IS_NONAUTHORITATIVE",
    "DIRECT_BUILD_AUTHORITY_FALSE",
    "OBSERVER_OWNED_RECEIPT_ADMISSION_UNIMPLEMENTED_HOLD",
    "RUNTIME_EVIDENCE_SEPARATE_AND_UNOBSERVED",
  );
  return Object.freeze({
    schema: IAT_B3_NATIVE_CONTAINMENT_RECEIPT_SCHEMA,
    valid: false,
    structurallyValid,
    status: "HOLD",
    ready: false,
    complete: false,
    executionProvenanceObserved: false,
    runtimeEvidenceObserved: false,
    blockers: Object.freeze([...new Set(blockers)]),
  });
}

export function parseNativeContainmentControlFrames(controlBytes, { contractSha256, executionMs }) {
  assertSha(contractSha256, "CONTROL_CONTRACT_SHA256_HOLD");
  if (executionMs !== IAT_B3_NATIVE_CONTAINMENT_TIMING.executionMs && executionMs !== IAT_B3_NATIVE_CONTAINMENT_TIMING.allFeatureExecutionMs) fail("CONTROL_EXECUTION_TIMING_HOLD");
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(controlBytes));
  } catch {
    fail("CONTROL_FRAME_UTF8_HOLD");
  }
  if (!text.endsWith("\n")) fail("CONTROL_FRAME_EOF_HOLD");
  if (text.includes("\r") || text.includes("\0") || /[^\x20-\x7e\n]/u.test(text)) fail("CONTROL_FRAME_LEXICAL_HOLD");
  const lines = text.slice(0, -1).split("\n");
  if (lines.length !== 2 || !lines[0].startsWith("IAT_B3_CONTAINMENT_READY_V1 ") || !lines[1].startsWith("IAT_B3_CONTAINMENT_FINAL_V1 ")) fail("CONTROL_FRAME_SEQUENCE_HOLD");
  const parse = (line) => {
    const tokens = line.split(" ");
    if (tokens.some((token) => token.length === 0)) fail("CONTROL_FRAME_WHITESPACE_HOLD");
    const entries = tokens.slice(1).map((token) => {
      const match = token.match(/^([A-Za-z][A-Za-z0-9]*)=([A-Za-z0-9._\/-]+)$/u);
      if (!match) fail("CONTROL_FRAME_TOKEN_HOLD");
      return [match[1], match[2]];
    });
    if (new Set(entries.map(([key]) => key)).size !== entries.length) fail("CONTROL_FRAME_DUPLICATE_KEY_HOLD");
    return Object.fromEntries(entries);
  };
  const readyRaw = parse(lines[0]), finalRaw = parse(lines[1]);
  const exactReadyKeys = ["contract", "execution", "finalization", "protocol", "startup", "teardown"].sort();
  const exactFinalKeys = [
    "absence", "contract", "elapsed", "empty", "executionExpired",
    "finalizationExpired", "intervention", "leak", "outcome", "protocol",
    "protocolValid", "reaped", "resumed", "rootExit", "rootSignal",
    "rootTerminal", "startupExpired", "stderrBytes", "stderrSha256",
    "stderrTruncated", "stdoutBytes", "stdoutSha256", "stdoutTruncated",
    "strictTap", "teardownExpired", "zombies",
  ].sort();
  if (canonicalJson(Object.keys(readyRaw).sort()) !== canonicalJson(exactReadyKeys)
    || canonicalJson(Object.keys(finalRaw).sort()) !== canonicalJson(exactFinalKeys)) fail("CONTROL_FRAME_EXACT_KEYS_HOLD");
  if (readyRaw.protocol !== IAT_B3_NATIVE_CONTAINMENT_CONTRACT_SCHEMA.replace("-contract", "")
    || finalRaw.protocol !== readyRaw.protocol || readyRaw.contract !== contractSha256
    || finalRaw.contract !== contractSha256) fail("CONTROL_FRAME_BINDING_HOLD");

  const unsigned = (value, code, maximum = Number.MAX_SAFE_INTEGER) => {
    if (!/^(?:0|[1-9][0-9]*)$/u.test(value)) fail(code);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed > maximum) fail(code);
    return parsed;
  };
  const signed = (value, code, minimum, maximum) => {
    if (!/^(?:0|-?[1-9][0-9]*)$/u.test(value)) fail(code);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) fail(code);
    return parsed;
  };
  const bit = (value, code) => {
    if (value !== "0" && value !== "1") fail(code);
    return value === "1";
  };
  const digest = (value, code) => {
    if (!SHA256_PATTERN.test(value)) fail(code);
    return value;
  };

  const ready = Object.freeze({
    protocol: readyRaw.protocol,
    contract: readyRaw.contract,
    startup: unsigned(readyRaw.startup, "CONTROL_FRAME_STARTUP_RANGE_HOLD", IAT_B3_NATIVE_CONTAINMENT_TIMING.startupMs),
    execution: unsigned(readyRaw.execution, "CONTROL_FRAME_EXECUTION_RANGE_HOLD", IAT_B3_NATIVE_CONTAINMENT_TIMING.allFeatureExecutionMs),
    finalization: unsigned(readyRaw.finalization, "CONTROL_FRAME_FINALIZATION_RANGE_HOLD", IAT_B3_NATIVE_CONTAINMENT_TIMING.finalizationMs),
    teardown: unsigned(readyRaw.teardown, "CONTROL_FRAME_TEARDOWN_RANGE_HOLD", IAT_B3_NATIVE_CONTAINMENT_TIMING.teardownObservationMs),
  });
  if (ready.startup !== IAT_B3_NATIVE_CONTAINMENT_TIMING.startupMs
    || ready.execution !== executionMs
    || ready.finalization !== IAT_B3_NATIVE_CONTAINMENT_TIMING.finalizationMs
    || ready.teardown !== IAT_B3_NATIVE_CONTAINMENT_TIMING.teardownObservationMs) fail("CONTROL_FRAME_TIMING_HOLD");

  const outerMs = executionMs === IAT_B3_NATIVE_CONTAINMENT_TIMING.allFeatureExecutionMs
    ? IAT_B3_NATIVE_CONTAINMENT_TIMING.allFeatureOuterMs
    : IAT_B3_NATIVE_CONTAINMENT_TIMING.outerMs;
  const final = Object.freeze({
    protocol: finalRaw.protocol,
    contract: finalRaw.contract,
    outcome: finalRaw.outcome,
    elapsed: unsigned(finalRaw.elapsed, "CONTROL_FRAME_ELAPSED_RANGE_HOLD", outerMs),
    rootTerminal: bit(finalRaw.rootTerminal, "CONTROL_FRAME_ROOT_TERMINAL_TYPE_HOLD"),
    rootExit: signed(finalRaw.rootExit, "CONTROL_FRAME_ROOT_EXIT_RANGE_HOLD", -1, 2_147_483_647),
    rootSignal: unsigned(finalRaw.rootSignal, "CONTROL_FRAME_ROOT_SIGNAL_RANGE_HOLD", 255),
    reaped: bit(finalRaw.reaped, "CONTROL_FRAME_REAPED_TYPE_HOLD"),
    empty: bit(finalRaw.empty, "CONTROL_FRAME_EMPTY_TYPE_HOLD"),
    leak: bit(finalRaw.leak, "CONTROL_FRAME_LEAK_TYPE_HOLD"),
    zombies: unsigned(finalRaw.zombies, "CONTROL_FRAME_ZOMBIES_RANGE_HOLD", 1_000_000),
    resumed: bit(finalRaw.resumed, "CONTROL_FRAME_RESUMED_TYPE_HOLD"),
    intervention: bit(finalRaw.intervention, "CONTROL_FRAME_INTERVENTION_TYPE_HOLD"),
    startupExpired: bit(finalRaw.startupExpired, "CONTROL_FRAME_STARTUP_EXPIRED_TYPE_HOLD"),
    executionExpired: bit(finalRaw.executionExpired, "CONTROL_FRAME_EXECUTION_EXPIRED_TYPE_HOLD"),
    finalizationExpired: bit(finalRaw.finalizationExpired, "CONTROL_FRAME_FINALIZATION_EXPIRED_TYPE_HOLD"),
    teardownExpired: bit(finalRaw.teardownExpired, "CONTROL_FRAME_TEARDOWN_EXPIRED_TYPE_HOLD"),
    strictTap: bit(finalRaw.strictTap, "CONTROL_FRAME_STRICT_TAP_TYPE_HOLD"),
    protocolValid: bit(finalRaw.protocolValid, "CONTROL_FRAME_PROTOCOL_VALID_TYPE_HOLD"),
    absence: bit(finalRaw.absence, "CONTROL_FRAME_ABSENCE_TYPE_HOLD"),
    stdoutBytes: unsigned(finalRaw.stdoutBytes, "CONTROL_FRAME_STDOUT_BYTES_RANGE_HOLD", IAT_B3_NATIVE_CONTAINMENT_TIMING.stdoutCapBytes * 2),
    stdoutSha256: digest(finalRaw.stdoutSha256, "CONTROL_FRAME_STDOUT_DIGEST_HOLD"),
    stdoutTruncated: bit(finalRaw.stdoutTruncated, "CONTROL_FRAME_STDOUT_TRUNCATED_TYPE_HOLD"),
    stderrBytes: unsigned(finalRaw.stderrBytes, "CONTROL_FRAME_STDERR_BYTES_RANGE_HOLD", IAT_B3_NATIVE_CONTAINMENT_TIMING.stderrCapBytes * 2),
    stderrSha256: digest(finalRaw.stderrSha256, "CONTROL_FRAME_STDERR_DIGEST_HOLD"),
    stderrTruncated: bit(finalRaw.stderrTruncated, "CONTROL_FRAME_STDERR_TRUNCATED_TYPE_HOLD"),
  });
  const outcomes = ["PASS", "TIMEOUT", "OUTPUT_LIMIT", "SPAWN_ERROR", "SIGNAL", "NONZERO", "INCOMPLETE_TAP", "CONTAINMENT_HOLD", "INTERNAL_HOLD"];
  if (!outcomes.includes(final.outcome)) fail("CONTROL_FRAME_OUTCOME_HOLD");
  const emptySha256 = sha256(Buffer.alloc(0));
  if ((final.stdoutBytes === 0 && final.stdoutSha256 !== emptySha256)
    || (final.stderrBytes === 0 && final.stderrSha256 !== emptySha256)
    || (!final.stdoutTruncated && final.stdoutBytes > IAT_B3_NATIVE_CONTAINMENT_TIMING.stdoutCapBytes)
    || (!final.stderrTruncated && final.stderrBytes > IAT_B3_NATIVE_CONTAINMENT_TIMING.stderrCapBytes)
    || (final.stdoutTruncated && final.stdoutBytes <= IAT_B3_NATIVE_CONTAINMENT_TIMING.stdoutCapBytes)
    || (final.stderrTruncated && final.stderrBytes <= IAT_B3_NATIVE_CONTAINMENT_TIMING.stderrCapBytes)) fail("CONTROL_FRAME_STREAM_CROSS_FIELD_HOLD");
  if ((!final.rootTerminal && (final.rootExit !== -1 || final.rootSignal !== 0))
    || (final.rootTerminal && final.rootSignal === 0 && final.rootExit < 0)
    || (final.rootTerminal && final.rootSignal > 0 && final.rootExit !== -1)
    || (final.reaped && !final.rootTerminal)
    || (final.empty && (!final.reaped || final.leak || final.zombies !== 0 || !final.absence))
    || (final.absence && !final.empty)
    || (final.strictTap && (!final.rootTerminal || final.rootExit !== 0 || final.rootSignal !== 0))
    || (final.startupExpired && final.resumed)
    || (final.executionExpired && !final.resumed)
    || (final.teardownExpired && final.absence)) fail("CONTROL_FRAME_STATE_CROSS_FIELD_HOLD");
  if ((final.outcome === "TIMEOUT" && !final.executionExpired)
    || (final.outcome === "OUTPUT_LIMIT" && !final.stdoutTruncated && !final.stderrTruncated)
    || (final.outcome === "SPAWN_ERROR" && (final.resumed || final.rootTerminal))
    || (final.outcome === "SIGNAL" && (!final.rootTerminal || final.rootSignal === 0))
    || (final.outcome === "NONZERO" && (!final.rootTerminal || final.rootSignal !== 0 || final.rootExit <= 0))
    || (final.outcome === "INCOMPLETE_TAP" && final.strictTap)) fail("CONTROL_FRAME_OUTCOME_CROSS_FIELD_HOLD");
  if (final.outcome === "PASS") fail("PHASE_A_CONTROL_PASS_FORBIDDEN_HOLD");
  return Object.freeze({ ready, final });
}

export function assessNativeContainmentExecution(candidate) {
  const blockers = ["NATIVE_HELPER_BUILD_RECEIPT_REQUIRED", "SAME_OBJECT_NATIVE_HELPER_EXECUTION_UNOBSERVED"];
  if (candidate?.schema !== IAT_B3_NATIVE_CONTAINMENT_EXECUTION_SCHEMA) blockers.unshift("EXECUTION_SCHEMA_INVALID");
  return Object.freeze({
    schema: IAT_B3_NATIVE_CONTAINMENT_EXECUTION_SCHEMA,
    status: candidate?.testOnly === true ? "HOLD_TEST" : "HOLD",
    ready: false,
    complete: false,
    executionProvenanceObserved: false,
    rootTerminalObserved: false,
    containmentEmpty: false,
    blockers: Object.freeze(blockers),
  });
}

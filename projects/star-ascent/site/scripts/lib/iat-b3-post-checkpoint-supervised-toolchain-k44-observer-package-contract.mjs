export const SUPERVISED_TOOLCHAIN_K44_OBSERVER_RECEIPT_SCHEMA =
  "iat-b3-post-checkpoint-supervised-toolchain-k44-observer-receipt/v1";
export const SUPERVISED_TOOLCHAIN_K44_PACKAGE_RESULT_SCHEMA =
  "iat-b3-post-checkpoint-prelaunch-supervisor-package-graph-result/v1";
export const SUPERVISED_TOOLCHAIN_K44_PACKAGE_STATUS = "HOLD_SOURCE_PACKAGE_ONLY";

export const FRESH_SEVEN_PATH_PACKAGE_PATHS = Object.freeze([
  "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-observer-source-design.v1.schema.json",
  "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs",
  "projects/star-ascent/site/tests/iat-b3-post-checkpoint-observer-source-design-contract.test.mjs",
  "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-receipt.v1.schema.json",
  "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package-contract.mjs",
  "projects/star-ascent/site/scripts/observe-iat-b3-post-checkpoint-supervised-toolchain-k44.mjs",
  "projects/star-ascent/site/tests/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package.test.mjs",
]);

export const FRESH_SEVEN_PATH_PACKAGE_ROLES = Object.freeze([
  Object.freeze({ code: 1, role: "BPO_SCHEMA", path: FRESH_SEVEN_PATH_PACKAGE_PATHS[0], executable: false }),
  Object.freeze({ code: 2, role: "BPO_CONTRACT", path: FRESH_SEVEN_PATH_PACKAGE_PATHS[1], executable: true }),
  Object.freeze({ code: 3, role: "BPO_TEST", path: FRESH_SEVEN_PATH_PACKAGE_PATHS[2], executable: false }),
  Object.freeze({ code: 4, role: "FRESH_BPI_SCHEMA", path: FRESH_SEVEN_PATH_PACKAGE_PATHS[3], executable: false }),
  Object.freeze({ code: 5, role: "FRESH_BPI_CONTRACT", path: FRESH_SEVEN_PATH_PACKAGE_PATHS[4], executable: true }),
  Object.freeze({ code: 6, role: "FRESH_BPI_RUNNER_ENTRY", path: FRESH_SEVEN_PATH_PACKAGE_PATHS[5], executable: true }),
  Object.freeze({ code: 7, role: "FRESH_BPI_TEST", path: FRESH_SEVEN_PATH_PACKAGE_PATHS[6], executable: false }),
]);

export const FRESH_SEVEN_PATH_RESOLVER_EDGE_MAP = Object.freeze([
  Object.freeze({
    fromRoleCode: 2,
    specifierKind: "BUILTIN",
    specifier: "node:buffer",
    toRoleCodeOrZero: 0,
  }),
  Object.freeze({
    fromRoleCode: 2,
    specifierKind: "BUILTIN",
    specifier: "node:util",
    toRoleCodeOrZero: 0,
  }),
  Object.freeze({
    fromRoleCode: 6,
    specifierKind: "RELATIVE_EXACT_REVIEWED_PATH_TO_ROLE",
    specifier: "./lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs",
    toRoleCodeOrZero: 2,
  }),
  Object.freeze({
    fromRoleCode: 6,
    specifierKind: "RELATIVE_EXACT_REVIEWED_PATH_TO_ROLE",
    specifier: "./lib/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package-contract.mjs",
    toRoleCodeOrZero: 5,
  }),
]);

export const FRESH_SEVEN_PATH_BUILTIN_EXPORT_ALLOWLIST = Object.freeze({
  "node:buffer": Object.freeze(["Buffer"]),
  "node:crypto": Object.freeze(["createHash"]),
  "node:util": Object.freeze(["types"]),
});

const HEX_40 = /^[0-9a-f]{40}$/u;
const HEX_64 = /^[0-9a-f]{64}$/u;
const BOOT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const RUN_ID = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$/u;
const DECIMAL_BOUNDED = /^(?:0|[1-9][0-9]{0,18})$/u;
const MAX_CANONICAL_INPUT_BYTES = 1_048_576;
const MAX_PACKAGE_BYTES = 2_147_483_648n;
const MAX_OBSERVATION_WINDOW_NS = 150_000_000_000n;
const RESULT_BODY_DIGEST_DOMAIN = "IAT_B3_BPS04_PACKAGE_GRAPH_RESULT_BODY_V1";
const PROJECTION_DIGEST_DOMAIN = "IAT_B3_BPI01_SUPERVISED_PROJECTION_V1";
const BPO_CANONICAL_JSON_SHA256 = "2073af13a63bd71daf8d425bbcfb253db90845c62ddf849a30c21957d9dd0586";
const BPO_CANONICAL_JSON_BYTE_LENGTH = 6115;
const FACADE_CALL_COUNTS = {
  bufferByteLength: 0,
  createHash: 0,
  isProxy: 0,
  sha256HexUtf8: 0,
  structuredClone: 0,
};

function fail(path, message) {
  throw new TypeError(path + ": " + message);
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) deepFreeze(value[key], seen);
  return Object.freeze(value);
}

function utf8Bytes(text) {
  if (typeof text !== "string") fail("$text", "expected string");
  const bytes = [];
  for (let index = 0; index < text.length; index += 1) {
    let code = text.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      const low = text.charCodeAt(index + 1);
      if (low < 0xdc00 || low > 0xdfff) fail("$text", "unpaired high surrogate");
      code = 0x10000 + ((code - 0xd800) << 10) + low - 0xdc00;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      fail("$text", "unpaired low surrogate");
    }
    if (code <= 0x7f) bytes.push(code);
    else if (code <= 0x7ff) bytes.push(0xc0 | (code >>> 6), 0x80 | (code & 0x3f));
    else if (code <= 0xffff) {
      bytes.push(0xe0 | (code >>> 12), 0x80 | ((code >>> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >>> 18),
        0x80 | ((code >>> 12) & 0x3f),
        0x80 | ((code >>> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return Uint8Array.from(bytes);
}

function compareRawUtf8Text(left, right) {
  const leftBytes = utf8Bytes(left);
  const rightBytes = utf8Bytes(right);
  const length = Math.min(leftBytes.length, rightBytes.length);
  for (let index = 0; index < length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return leftBytes[index] - rightBytes[index];
  }
  return leftBytes.length - rightBytes.length;
}

function rotateRight(value, bits) {
  return (value >>> bits) | (value << (32 - bits));
}

const SHA256_K = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Bytes(input) {
  const bytes = input instanceof Uint8Array ? input : Uint8Array.from(input);
  const bitLength = BigInt(bytes.length) * 8n;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const data = new Uint8Array(paddedLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  for (let index = 0; index < 8; index += 1) {
    data[paddedLength - 1 - index] = Number((bitLength >> BigInt(index * 8)) & 0xffn);
  }
  const hash = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const at = offset + index * 4;
      words[index] =
        ((data[at] << 24) | (data[at + 1] << 16) | (data[at + 2] << 8) | data[at + 3]) >>> 0;
    }
    for (let index = 16; index < 64; index += 1) {
      const x = words[index - 15];
      const y = words[index - 2];
      const sigma0 = rotateRight(x, 7) ^ rotateRight(x, 18) ^ (x >>> 3);
      const sigma1 = rotateRight(y, 17) ^ rotateRight(y, 19) ^ (y >>> 10);
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const upper1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + upper1 + choice + SHA256_K[index] + words[index]) >>> 0;
      const upper0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (upper0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return Array.from(hash, (value) => value.toString(16).padStart(8, "0")).join("");
}

export function sha256HexUtf8(text) {
  FACADE_CALL_COUNTS.sha256HexUtf8 += 1;
  return sha256Bytes(utf8Bytes(text));
}

export function createHash(algorithm) {
  FACADE_CALL_COUNTS.createHash += 1;
  if (algorithm !== "sha256") fail("$algorithm", "only sha256 is permitted");
  const chunks = [];
  let terminal = false;
  const api = Object.assign(Object.create(null), {
    update(value, encoding = "utf8") {
      if (terminal) fail("$hash", "hash is already terminal");
      if (encoding !== "utf8" || typeof value !== "string") fail("$hash.update", "only UTF-8 strings are permitted");
      chunks.push(utf8Bytes(value));
      return api;
    },
    digest(encoding = "hex") {
      if (terminal) fail("$hash", "hash is already terminal");
      if (encoding !== "hex") fail("$hash.digest", "only lowercase hex output is permitted");
      terminal = true;
      const length = chunks.reduce((total, chunk) => total + chunk.length, 0);
      const joined = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        joined.set(chunk, offset);
        offset += chunk.length;
      }
      return sha256Bytes(joined);
    },
  });
  return Object.freeze(api);
}

function byteLength(value, encoding = "utf8") {
  FACADE_CALL_COUNTS.bufferByteLength += 1;
  if (encoding !== "utf8" && encoding !== "utf-8") fail("$encoding", "only UTF-8 is permitted");
  return utf8Bytes(value).length;
}

function isContextPlainObject(value) {
  if (value === null || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return Array.isArray(value)
    ? prototype === Array.prototype
    : prototype === Object.prototype;
}

function isProxy(value) {
  FACADE_CALL_COUNTS.isProxy += 1;
  if (typeof Proxy !== "undefined" || globalThis["Pro" + "xy"] !== undefined) {
    fail("$realm", "Proxy capability must be unavailable before package evaluation");
  }
  if (value !== null && (typeof value === "object" || typeof value === "function") && !isContextPlainObject(value)) {
    fail("$value", "foreign, host, or non-plain value");
  }
  return false;
}

export const Buffer = Object.freeze(Object.assign(Object.create(null), { byteLength }));
export const types = Object.freeze(Object.assign(Object.create(null), { isProxy }));

function assertPlainData(value, path, seen) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) fail(path, "expected a safe canonical integer");
    return;
  }
  if (typeof value !== "object") fail(path, "expected plain JSON data");
  if (isProxy(value)) fail(path, "proxy value");
  if (seen.has(value)) fail(path, "shared or cyclic identity");
  seen.add(value);
  const isArray = Array.isArray(value);
  const prototype = Object.getPrototypeOf(value);
  if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype) {
    fail(path, "foreign or non-plain prototype");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key === "symbol")) fail(path, "symbol key");
  if (isArray) {
    if (keys.length !== value.length + 1 || descriptors.length?.value !== value.length) fail(path, "sparse or hidden array key");
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(descriptors, String(index))) fail(path + "[" + index + "]", "sparse array");
    }
  }
  for (const key of keys) {
    if (isArray && key === "length") continue;
    const descriptor = descriptors[key];
    if (!("value" in descriptor) || descriptor.enumerable !== true) fail(path + "." + String(key), "accessor or hidden key");
    assertPlainData(descriptor.value, isArray ? path + "[" + key + "]" : path + "." + key, seen);
  }
}

function copyValidatedPlain(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(copyValidatedPlain);
  const copy = {};
  for (const key of Object.keys(value)) copy[key] = copyValidatedPlain(value[key]);
  return copy;
}

function structuredClonePlain(value) {
  FACADE_CALL_COUNTS.structuredClone += 1;
  assertPlainData(value, "$structuredClone", new WeakSet());
  return copyValidatedPlain(value);
}

if (typeof Proxy !== "undefined" || globalThis["Pro" + "xy"] !== undefined) {
  fail("$realm", "role 5 requires the externally established proxy-unconstructible context");
}
if (typeof globalThis.structuredClone !== "undefined") fail("$realm", "ambient structuredClone is forbidden");
Object.defineProperty(globalThis, "structuredClone", {
  value: structuredClonePlain,
  writable: false,
  configurable: false,
  enumerable: false,
});

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  assertPlainData(value, "$value", new WeakSet());
  return JSON.stringify(canonicalize(value)) + "\n";
}

const RESOLVER_EDGE_MAP_DIGEST_DOMAIN = "IAT_B3_BPS04_RESOLVER_EDGE_MAP_V1";
const RESOLVER_EDGE_MAP_ROWS = FRESH_SEVEN_PATH_RESOLVER_EDGE_MAP.map((edge) => {
  const fromPath = FRESH_SEVEN_PATH_PACKAGE_PATHS[edge.fromRoleCode - 1];
  const toPath = edge.toRoleCodeOrZero === 0
    ? edge.specifier
    : FRESH_SEVEN_PATH_PACKAGE_PATHS[edge.toRoleCodeOrZero - 1];
  return [fromPath, edge.specifier, toPath, edge.fromRoleCode, edge.toRoleCodeOrZero].join("\0") + "\n";
}).sort(compareRawUtf8Text).join("");

export const FRESH_SEVEN_PATH_RESOLVER_EDGE_MAP_IDENTITY = deepFreeze({
  domain: RESOLVER_EDGE_MAP_DIGEST_DOMAIN,
  exactRowFieldOrder: [
    "fromRepoRelativePath",
    "specifier",
    "toRepoRelativePathOrBuiltin",
    "fromRoleCode",
    "toRoleCodeOrZero",
  ],
  edgeCount: 4,
  sha256: sha256HexUtf8(RESOLVER_EDGE_MAP_DIGEST_DOMAIN + "\0" + RESOLVER_EDGE_MAP_ROWS),
  unsignedDecimalSerializedByteLength: String(utf8Bytes(RESOLVER_EDGE_MAP_ROWS).length),
});

export function parseCanonicalJson(text) {
  if (typeof text !== "string") fail("$json", "expected primitive string");
  if (byteLength(text) > MAX_CANONICAL_INPUT_BYTES) fail("$json", "input exceeds source package cap");
  if (!text.endsWith("\n") || text.slice(0, -1).includes("\n") || text.includes("\r") || text.includes("\0")) {
    fail("$json", "expected exactly one final LF and no CR or NUL");
  }
  if (text.charCodeAt(0) === 0xfeff) fail("$json", "BOM is forbidden");
  let parsed;
  try {
    parsed = JSON.parse(text.slice(0, -1));
  } catch {
    fail("$json", "invalid JSON");
  }
  assertPlainData(parsed, "$json", new WeakSet());
  if (canonicalJson(parsed) !== text) fail("$json", "noncanonical, duplicate, escaped-key, order, or whitespace form");
  return deepFreeze(parsed);
}

function exactKeys(value, expected, path) {
  if (!isContextPlainObject(value) || Array.isArray(value)) fail(path, "expected object");
  const actual = Object.keys(value);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(path, "expected exact keys " + expected.join(","));
  }
}

function expect(value, expected, path) {
  if (value !== expected) fail(path, "expected " + String(expected));
}

function expectPattern(value, pattern, path) {
  if (typeof value !== "string" || !pattern.test(value)) fail(path, "invalid canonical value");
}

function parseDecimal(value, path) {
  expectPattern(value, DECIMAL_BOUNDED, path);
  return BigInt(value);
}

function validateEntry(entry, expectedRole, path) {
  exactKeys(entry, ["byteLength", "mode", "path", "roleCode", "sha256"], path);
  const expected = FRESH_SEVEN_PATH_PACKAGE_ROLES[expectedRole - 1];
  expect(entry.mode, "100644", path + ".mode");
  expect(entry.path, expected.path, path + ".path");
  expect(entry.roleCode, expectedRole, path + ".roleCode");
  expectPattern(entry.sha256, HEX_64, path + ".sha256");
  const length = parseDecimal(entry.byteLength, path + ".byteLength");
  if (length === 0n || length > MAX_PACKAGE_BYTES) fail(path + ".byteLength", "outside package cap");
  return length;
}

function validateProjection(value) {
  exactKeys(value, [
    "authority", "bootId", "bundleSha256", "graphSha256", "k44", "package",
    "requestSha256", "runId", "schema", "sessionId", "toolchains", "window",
  ], "$projection");
  expect(value.schema, SUPERVISED_TOOLCHAIN_K44_OBSERVER_RECEIPT_SCHEMA, "$projection.schema");
  expectPattern(value.runId, RUN_ID, "$projection.runId");
  expectPattern(value.bootId, BOOT_ID, "$projection.bootId");
  expectPattern(value.sessionId, HEX_64, "$projection.sessionId");
  expectPattern(value.requestSha256, HEX_64, "$projection.requestSha256");
  expectPattern(value.bundleSha256, HEX_64, "$projection.bundleSha256");
  expect(value.graphSha256, FRESH_SEVEN_PATH_RESOLVER_EDGE_MAP_IDENTITY.sha256, "$projection.graphSha256");

  exactKeys(value.package, [
    "commitSha", "entries", "manifestByteLength", "manifestSha256", "parentCommitSha", "treeSha",
  ], "$projection.package");
  for (const key of ["commitSha", "parentCommitSha", "treeSha"]) {
    expectPattern(value.package[key], HEX_40, "$projection.package." + key);
  }
  expectPattern(value.package.manifestSha256, HEX_64, "$projection.package.manifestSha256");
  const manifestLength = parseDecimal(value.package.manifestByteLength, "$projection.package.manifestByteLength");
  if (manifestLength === 0n || manifestLength > MAX_PACKAGE_BYTES) fail("$projection.package.manifestByteLength", "outside package cap");
  if (!Array.isArray(value.package.entries) || value.package.entries.length !== 7) {
    fail("$projection.package.entries", "expected exact seven entries");
  }
  let aggregate = 0n;
  for (let index = 0; index < 7; index += 1) {
    aggregate += validateEntry(value.package.entries[index], index + 1, "$projection.package.entries[" + index + "]");
  }
  if (aggregate > MAX_PACKAGE_BYTES) fail("$projection.package.entries", "aggregate exceeds package cap");
  const acceptedBpo = [
    ["75501ad2821d5c869d1a805ecb4764705069d9ee452f6438cab1febd7da9ecad", "8182"],
    ["1a33cf1ca99a209abccabb1abc66ea7cb7f683b80d17201abdbc207bb8a6bcfe", "13834"],
    ["85e400f30981cf433c7dc0c95b60d0018e82aaae62f208b5d48643804545035d", "15817"],
  ];
  for (let index = 0; index < acceptedBpo.length; index += 1) {
    expect(value.package.entries[index].sha256, acceptedBpo[index][0], "$projection.package.entries[" + index + "].sha256");
    expect(value.package.entries[index].byteLength, acceptedBpo[index][1], "$projection.package.entries[" + index + "].byteLength");
  }

  exactKeys(value.window, ["deadlineMonotonicNs", "observedMonotonicNs", "openedMonotonicNs"], "$projection.window");
  const deadline = parseDecimal(value.window.deadlineMonotonicNs, "$projection.window.deadlineMonotonicNs");
  const observed = parseDecimal(value.window.observedMonotonicNs, "$projection.window.observedMonotonicNs");
  const opened = parseDecimal(value.window.openedMonotonicNs, "$projection.window.openedMonotonicNs");
  if (!(opened <= observed && observed <= deadline && deadline - opened <= MAX_OBSERVATION_WINDOW_NS)) {
    fail("$projection.window", "stale, future, reversed, or extended window");
  }

  const targets = [
    ["linux-x64-musl", "PINNED_ZIG_CC"],
    ["windows-x64-gnu", "PINNED_ZIG_CC"],
    ["native-wsl-linux-x64-musl", "OPTIONAL_NATIVE_WSL_COMPILER"],
  ];
  if (!Array.isArray(value.toolchains) || value.toolchains.length !== targets.length) {
    fail("$projection.toolchains", "expected exact target tuple");
  }
  for (let index = 0; index < targets.length; index += 1) {
    const target = value.toolchains[index];
    exactKeys(target, ["accepted", "backend", "observation", "target"], "$projection.toolchains[" + index + "]");
    expect(target.accepted, false, "$projection.toolchains[" + index + "].accepted");
    expect(target.backend, targets[index][1], "$projection.toolchains[" + index + "].backend");
    expect(target.observation, null, "$projection.toolchains[" + index + "].observation");
    expect(target.target, targets[index][0], "$projection.toolchains[" + index + "].target");
  }

  exactKeys(value.k44, ["accepted", "assessment", "directFlags"], "$projection.k44");
  expect(value.k44.accepted, false, "$projection.k44.accepted");
  expect(value.k44.assessment, null, "$projection.k44.assessment");
  exactKeys(value.k44.directFlags, [
    "checkpointDirectlyObservedByThisModule",
    "inputFilesDirectlyObservedByThisModule",
    "priorLaneIdentityInventoryDirectlyObservedByThisModule",
    "productionIdentityInventoryDirectlyObservedByThisModule",
    "wallClockDirectlyObservedByThisModule",
  ], "$projection.k44.directFlags");
  for (const [key, flag] of Object.entries(value.k44.directFlags)) {
    expect(flag, false, "$projection.k44.directFlags." + key);
  }

  exactKeys(value.authority, [
    "devnetAuthorized", "gate8Go", "mainnetAuthorized", "releaseAuthorized", "signingAuthorized",
  ], "$projection.authority");
  for (const [key, flag] of Object.entries(value.authority)) {
    expect(flag, false, "$projection.authority." + key);
  }
  return value;
}

function constSchema(value) {
  if (value === null) return { type: "null", const: null };
  return { type: typeof value, const: value };
}

function exactObject(properties) {
  return { type: "object", additionalProperties: false, required: Object.keys(properties), properties };
}

function exactTuple(items) {
  return { type: "array", minItems: items.length, maxItems: items.length, prefixItems: items, items: false };
}

const hashSchema = { type: "string", pattern: "^[0-9a-f]{64}$" };
const oidSchema = { type: "string", pattern: "^[0-9a-f]{40}$" };
const decimalSchema = { type: "string", pattern: "^(?:0|[1-9][0-9]{0,18})$" };
const positiveDecimalSchema = { type: "string", pattern: "^[1-9][0-9]{0,18}$" };
const entrySchemas = FRESH_SEVEN_PATH_PACKAGE_ROLES.map((role) => exactObject({
  byteLength: positiveDecimalSchema,
  mode: constSchema("100644"),
  path: constSchema(role.path),
  roleCode: constSchema(role.code),
  sha256: hashSchema,
}));
const bpoRows = [
  ["8182", "75501ad2821d5c869d1a805ecb4764705069d9ee452f6438cab1febd7da9ecad"],
  ["13834", "1a33cf1ca99a209abccabb1abc66ea7cb7f683b80d17201abdbc207bb8a6bcfe"],
  ["15817", "85e400f30981cf433c7dc0c95b60d0018e82aaae62f208b5d48643804545035d"],
];
for (let index = 0; index < bpoRows.length; index += 1) {
  entrySchemas[index] = exactObject({
    byteLength: constSchema(bpoRows[index][0]),
    mode: constSchema("100644"),
    path: constSchema(FRESH_SEVEN_PATH_PACKAGE_PATHS[index]),
    roleCode: constSchema(index + 1),
    sha256: constSchema(bpoRows[index][1]),
  });
}
const targetSchemas = [
  ["linux-x64-musl", "PINNED_ZIG_CC"],
  ["windows-x64-gnu", "PINNED_ZIG_CC"],
  ["native-wsl-linux-x64-musl", "OPTIONAL_NATIVE_WSL_COMPILER"],
].map(([target, backend]) => exactObject({
  accepted: constSchema(false),
  backend: constSchema(backend),
  observation: constSchema(null),
  target: constSchema(target),
}));

export const SUPERVISED_TOOLCHAIN_K44_OBSERVER_RECEIPT_JSON_SCHEMA = deepFreeze({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://internal.invalid/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-receipt.v1.schema.json",
  title: "IAT-B3 supervised toolchain and K44 observer projection",
  description: "Strict nonauthorizing projection accepted only inside the reviewed BPS04 in-memory graph.",
  ...exactObject({
    authority: exactObject({
      devnetAuthorized: constSchema(false),
      gate8Go: constSchema(false),
      mainnetAuthorized: constSchema(false),
      releaseAuthorized: constSchema(false),
      signingAuthorized: constSchema(false),
    }),
    bootId: { type: "string", pattern: "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$" },
    bundleSha256: hashSchema,
    graphSha256: constSchema(FRESH_SEVEN_PATH_RESOLVER_EDGE_MAP_IDENTITY.sha256),
    k44: exactObject({
      accepted: constSchema(false),
      assessment: constSchema(null),
      directFlags: exactObject({
        checkpointDirectlyObservedByThisModule: constSchema(false),
        inputFilesDirectlyObservedByThisModule: constSchema(false),
        priorLaneIdentityInventoryDirectlyObservedByThisModule: constSchema(false),
        productionIdentityInventoryDirectlyObservedByThisModule: constSchema(false),
        wallClockDirectlyObservedByThisModule: constSchema(false),
      }),
    }),
    package: exactObject({
      commitSha: oidSchema,
      entries: exactTuple(entrySchemas),
      manifestByteLength: positiveDecimalSchema,
      manifestSha256: hashSchema,
      parentCommitSha: oidSchema,
      treeSha: oidSchema,
    }),
    requestSha256: hashSchema,
    runId: { type: "string", pattern: "^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$" },
    schema: constSchema(SUPERVISED_TOOLCHAIN_K44_OBSERVER_RECEIPT_SCHEMA),
    sessionId: hashSchema,
    toolchains: exactTuple(targetSchemas),
    window: exactObject({
      deadlineMonotonicNs: decimalSchema,
      observedMonotonicNs: decimalSchema,
      openedMonotonicNs: decimalSchema,
    }),
  }),
});

export const SUPERVISED_TOOLCHAIN_K44_PACKAGE_SOURCE_TRUTH = deepFreeze({
  status: SUPERVISED_TOOLCHAIN_K44_PACKAGE_STATUS,
  sourcePackageContractPresent: true,
  sourcePackageRunnerPresent: true,
  sourcePackageSchemaPresent: true,
  sourcePackageTestPresent: true,
  actualPackageCommitSha: null,
  actualPackageTreeSha: null,
  actualSevenPathManifestSha256: null,
  actualSupervisorIdentity: null,
  actualRuntimeProjection: null,
  actualToolchainObservation: null,
  actualK44Assessment: null,
  actualReceipt: null,
  toolchainAccepted: false,
  k44Accepted: false,
  receiptPresent: false,
  decision: "HOLD",
  authority: "NONE",
  compileAuthorized: false,
  installAuthorized: false,
  runtimeAuthorized: false,
  networkAuthorized: false,
  rpcAuthorized: false,
  signingAuthorized: false,
  devnetAuthorized: false,
  mainnetAuthorized: false,
});

export const BPI01_PREDECESSOR_BINDINGS = deepFreeze({
  accepted: [
    {
      taskId: "BPO00",
      manifestSha256: "395d97b87e2faaf91ece3845ecd26370f1fcae2b5ddcffab1f3a543c6c9c08f9",
      manifestByteLength: 521,
      pathCount: 3,
      payloadByteLength: 37833,
      reviewTaskId: "BPO00R",
      reviewOutcome: "POST_CHECKPOINT_TOOLCHAIN_K44_OBSERVER_SOURCE_DESIGN_REVIEW_ACCEPTED",
    },
    {
      taskId: "BPS00",
      manifestSha256: "83a99ef694d4e1c7e6b364a0a768999cc73fd3911fea23ea6347ba5cfa7b1c8a",
      manifestByteLength: 607,
      pathCount: 3,
      payloadByteLength: 403564,
      reviewTaskId: "BPS00R",
      reviewOutcome: "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_SOURCE_DESIGN_REVIEW_ACCEPTED",
    },
    {
      taskId: "BPS02",
      manifestSha256: "4bd831835fdd0244c1331d1af3b841dc154fc7e8cecd2ca53f6d65deb7cf47d6",
      manifestByteLength: 677,
      pathCount: 3,
      payloadByteLength: 93192,
      reviewTaskId: "BPS02R",
      reviewOutcome: "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_FD_BRIDGE_SOURCE_DESIGN_AMENDMENT_REVIEW_ACCEPTED",
    },
    {
      taskId: "BPS04",
      manifestSha256: "82d1563897dcf41f7f8f168741563231d17422a5c42e36a2e5d6e05516949832",
      manifestByteLength: 679,
      pathCount: 3,
      payloadByteLength: 244603,
      reviewTaskId: "BPS04R",
      reviewOutcome:
        "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BUNDLE_TRANSPORT_SOURCE_DESIGN_AMENDMENT_REVIEW_ACCEPTED",
    },
  ],
  rejectedDrafts: [
    {
      taskId: "BPI00",
      status: "BLOCKED_GATE",
      outcome: null,
      acceptedAsInput: false,
      files: [
        {
          path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-toolchain-k44-observer-receipt.v1.schema.json",
          sha256: "25142a35a73495cad984fc2ad3a14c1b783305fdfe3171ca59ed131345548553",
          byteLength: 12344,
        },
        {
          path: "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-toolchain-k44-observer-contract.mjs",
          sha256: "408baad07e7aca7a14e3697a2a9ed0df791352b1da92247ae65eeeb1dd41406b",
          byteLength: 82511,
        },
        {
          path: "projects/star-ascent/site/scripts/observe-iat-b3-post-checkpoint-toolchain-k44.mjs",
          sha256: "4fa97ba8825a5c68309f92b2cb93deeef75dcb08eb55843c55df94a1cdb8d1fb",
          byteLength: 2317,
        },
        {
          path: "projects/star-ascent/site/tests/iat-b3-post-checkpoint-toolchain-k44-observer.test.mjs",
          sha256: "42b07a6d56f3e5c1651bb01b31f143468facf2d7873f76f7283c69f895438fa3",
          byteLength: 27455,
        },
      ],
      absentPaths: [],
    },
    {
      taskId: "BPS01",
      status: "BLOCKED_GATE",
      outcome: null,
      acceptedAsInput: false,
      files: [
        {
          path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-bootstrap-descriptor.v1.schema.json",
          sha256: "4a71a5141e61430b5548abb48ad67eeb72b8eecb6d302cbee177341533689032",
          byteLength: 28691,
        },
        {
          path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-runtime-anchor.v1.schema.json",
          sha256: "edcea4bb60d455b2e21a89daecb496779de52d8112e36aab599edb8dcfda35f4",
          byteLength: 46468,
        },
        {
          path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-runtime-evidence.v1.schema.json",
          sha256: "c34942bbdd18603274f0cc4b916514c77eab20c1226567438d1bd8025689dac2",
          byteLength: 35729,
        },
        {
          path: "projects/star-ascent/site/native/iat-b3-post-checkpoint-prelaunch-supervisor/src/iat_b3_post_checkpoint_prelaunch_supervisor.c",
          sha256: "0f1eb6ab0604c4cae5901ff621d6bc1ec4befd214c5d00c385a9db631e63c62f",
          byteLength: 46113,
        },
        {
          path: "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-launcher.mjs",
          sha256: "29affa549618849c9aa17ed5de39db1aceba2d482f798b76943fe846c17a0cb6",
          byteLength: 38364,
        },
      ],
      absentPaths: [
        "projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-source.test.mjs",
      ],
    },
    {
      taskId: "BPS03",
      status: "BLOCKED_GATE",
      outcome: null,
      acceptedAsInput: false,
      files: [
        {
          path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-fd-bridge-bootstrap-descriptor.v1.schema.json",
          sha256: "00aca0af89fa61c65fa53de94d2fdc2d7f14cc23118a51e462dfde93155db81e",
          byteLength: 25140,
        },
        {
          path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-fd-bridge-runtime-anchor.v1.schema.json",
          sha256: "6eb4dc64452318d39b01078fdcded1b70c65252d10c6ee32fa9e069a1a655484",
          byteLength: 60539,
        },
        {
          path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-fd-bridge-runtime-evidence.v1.schema.json",
          sha256: "2f236c824f0bfebc4b6f44c00d116adfc9027e36f6b3ac336309b5fea3a0dc36",
          byteLength: 26610,
        },
        {
          path: "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-fd-bridge-launcher.mjs",
          sha256: "ab754e3e6f753746ee8cbb8a6cdb99c3c21ce0a73e01071fd72ea4e639afd8cb",
          byteLength: 62560,
        },
      ],
      absentPaths: [
        "projects/star-ascent/site/native/iat-b3-post-checkpoint-prelaunch-supervisor-fd-bridge/src/iat_b3_post_checkpoint_prelaunch_supervisor_fd_bridge.c",
        "projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-fd-bridge-source.test.mjs",
      ],
    },
  ],
  rejectedDraftBytesMayBeReadImportedExecutedCopiedOrCheckpointed: false,
  acceptedPackageMayInferAnyIdentityOrOutcomeFromRejectedDrafts: false,
});

export function evaluateBoundSupervisedProjection(canonicalProjectionJson, canonicalBpoDesignJson) {
  if (typeof canonicalProjectionJson !== "string" || typeof canonicalBpoDesignJson !== "string") {
    fail("$entry", "expected two primitive canonical UTF-8 strings");
  }
  if (
    byteLength(canonicalBpoDesignJson) !== BPO_CANONICAL_JSON_BYTE_LENGTH ||
    sha256HexUtf8(canonicalBpoDesignJson) !== BPO_CANONICAL_JSON_SHA256
  ) {
    fail("$bpo", "exact accepted BPO canonical design mismatch");
  }
  const bpo = parseCanonicalJson(canonicalBpoDesignJson);
  expect(bpo.schema, "iat-b3-post-checkpoint-observer-source-design/v1", "$bpo.schema");
  expect(bpo.observationDesign.toolchainPolicyObserved, false, "$bpo.observationDesign.toolchainPolicyObserved");
  expect(bpo.observationDesign.toolchainFactsObserved, false, "$bpo.observationDesign.toolchainFactsObserved");
  expect(bpo.observationDesign.toolchainReceipt, null, "$bpo.observationDesign.toolchainReceipt");
  expect(bpo.observationDesign.sourceDesignMayCloseObservationBlockers, false, "$bpo.observationDesign.sourceDesignMayCloseObservationBlockers");

  const projection = validateProjection(parseCanonicalJson(canonicalProjectionJson));
  const projectionSha256 = sha256HexUtf8(PROJECTION_DIGEST_DOMAIN + "\0" + canonicalProjectionJson);
  const body = {
    schema: SUPERVISED_TOOLCHAIN_K44_PACKAGE_RESULT_SCHEMA,
    runId: projection.runId,
    requestSha256: projection.requestSha256,
    bundleSha256: projection.bundleSha256,
    graphSha256: projection.graphSha256,
    projectionSha256,
    toolchainAccepted: false,
    k44Accepted: false,
    receiptPresent: false,
    decision: "HOLD",
    authority: "NONE",
  };
  const bodyJson = JSON.stringify(body) + "\n";
  const resultBodySha256 = sha256HexUtf8(RESULT_BODY_DIGEST_DOMAIN + "\0" + bodyJson);
  return JSON.stringify({ ...body, resultBodySha256 }) + "\n";
}

export function assertPackageSourceTruth() {
  return SUPERVISED_TOOLCHAIN_K44_PACKAGE_SOURCE_TRUTH;
}

export function snapshotContextNativeFacadeCallCounts() {
  return Object.freeze({
    bufferByteLength: FACADE_CALL_COUNTS.bufferByteLength,
    createHash: FACADE_CALL_COUNTS.createHash,
    isProxy: FACADE_CALL_COUNTS.isProxy,
    sha256HexUtf8: FACADE_CALL_COUNTS.sha256HexUtf8,
    structuredClone: FACADE_CALL_COUNTS.structuredClone,
  });
}

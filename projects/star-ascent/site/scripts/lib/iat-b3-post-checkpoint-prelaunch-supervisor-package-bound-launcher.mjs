import { closeSync, readSync, writeSync } from "node:fs";
import { createHash, timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { SourceTextModule, SyntheticModule, createContext, runInContext } from "node:vm";

const STARTUP_PROCESS = globalThis.process;
const EXPECTED_EXEC_ARGV = Object.freeze([
  "--experimental-vm-modules",
  "--disable-warning=ExperimentalWarning",
  "--input-type=module",
]);
if (
  STARTUP_PROCESS === null ||
  typeof STARTUP_PROCESS !== "object" ||
  STARTUP_PROCESS.version !== "v24.19.0" ||
  typeof SourceTextModule !== "function" ||
  !Array.isArray(STARTUP_PROCESS.execArgv) ||
  STARTUP_PROCESS.execArgv.length !== EXPECTED_EXEC_ARGV.length ||
  !EXPECTED_EXEC_ARGV.every((value, index) => STARTUP_PROCESS.execArgv[index] === value) ||
  STARTUP_PROCESS.cwd() !== "/opt/iat-b3/reviewed-packages/22741ccba22f8f16663c745c0496d5c0be97d534"
) {
  throw new Error("HOLD: pinned static Node v24.19.0 startup closure mismatch");
}

const REQUEST_FD = 3;
const BUNDLE_FD = 4;
const MAX_REQUEST_BYTES = 65_536;
const MAX_RESULT_BYTES = 16_384;
const MAX_CHUNK_BYTES = 65_536;
const MAX_BUNDLE_BYTES = 16 * 1024 * 1024;
const MAX_MODULE_BYTES = 1024 * 1024;
const GLOBAL_READ_LIMIT = 2_147_483_648n;
const GLOBAL_ENTRY_LIMIT = 100_000n;
const REQUEST_BODY_DOMAIN = "IAT_B3_BPS05_FD3_REQUEST_BODY_V1";
const PROJECTION_BINDING_DOMAIN = "IAT_B3_BPS05_PROJECTION_REQUEST_PREBINDING_V1";
const RESULT_BODY_DOMAIN = "IAT_B3_BPS05_FD3_PRE_GRAPH_HOLD_RESULT_BODY_V1";
const BUNDLE_MAGIC = Buffer.from("IAT_B3_BPS04_SEALED_PACKAGE_BUNDLE_V1\0", "utf8");
const BUNDLE_TRAILER_DOMAIN = Buffer.from("IAT_B3_BPS04_SEALED_PACKAGE_BUNDLE_TRAILER_V1\0", "utf8");

const PACKAGE = Object.freeze([
  Object.freeze({ roleCode: 1, role: "BPO_SCHEMA", executable: false, path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-observer-source-design.v1.schema.json", sha256: "75501ad2821d5c869d1a805ecb4764705069d9ee452f6438cab1febd7da9ecad", byteLength: "8182" }),
  Object.freeze({ roleCode: 2, role: "BPO_CONTRACT", executable: true, path: "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs", sha256: "1a33cf1ca99a209abccabb1abc66ea7cb7f683b80d17201abdbc207bb8a6bcfe", byteLength: "13834" }),
  Object.freeze({ roleCode: 3, role: "BPO_TEST", executable: false, path: "projects/star-ascent/site/tests/iat-b3-post-checkpoint-observer-source-design-contract.test.mjs", sha256: "85e400f30981cf433c7dc0c95b60d0018e82aaae62f208b5d48643804545035d", byteLength: "15817" }),
  Object.freeze({ roleCode: 4, role: "FRESH_BPI_SCHEMA", executable: false, path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-receipt.v1.schema.json", sha256: "cc1771e3fb6736d1887fd2523db15d0170eb59a5a125477498d71ea8ebc8bfb0", byteLength: "7776" }),
  Object.freeze({ roleCode: 5, role: "FRESH_BPI_CONTRACT", executable: true, path: "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package-contract.mjs", sha256: "7f47b43f8104d3d542879a666866798cf90ada9578e5a6a7e84a61d6d8b5ba16", byteLength: "35319" }),
  Object.freeze({ roleCode: 6, role: "FRESH_BPI_RUNNER_ENTRY", executable: true, path: "projects/star-ascent/site/scripts/observe-iat-b3-post-checkpoint-supervised-toolchain-k44.mjs", sha256: "da595f511a5b2004b7a1ae91ed4f6d37d5f98c071abcb2f07592807de7993fc6", byteLength: "2691" }),
  Object.freeze({ roleCode: 7, role: "FRESH_BPI_TEST", executable: false, path: "projects/star-ascent/site/tests/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package.test.mjs", sha256: "c9f7dd501e87b3077e73947e22e274a36a9e2344ebc507042ab1e11c64ca1396", byteLength: "40289" }),
]);

const PACKAGE_BY_ROLE = new Map(PACKAGE.map((entry) => [entry.roleCode, entry]));
const PACKAGE_IN_BUNDLE_ORDER = Object.freeze([...PACKAGE].sort((left, right) =>
  Buffer.compare(Buffer.from(left.path, "utf8"), Buffer.from(right.path, "utf8"))));

const ROLE2_EXPORTS = Object.freeze([
  "POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN",
  "POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_PATHS",
  "POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_SCHEMA",
  "POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_STATUS",
  "canonicalPostCheckpointObserverSourceDesignJson",
  "createPostCheckpointObserverSourceDesign",
  "parsePostCheckpointObserverSourceDesignJson",
  "postCheckpointObserverSourceDesignSafety",
  "validatePostCheckpointObserverSourceDesign",
]);
const ROLE5_EXPORTS = Object.freeze([
  "BPI01_PREDECESSOR_BINDINGS",
  "Buffer",
  "FRESH_SEVEN_PATH_BUILTIN_EXPORT_ALLOWLIST",
  "FRESH_SEVEN_PATH_PACKAGE_PATHS",
  "FRESH_SEVEN_PATH_PACKAGE_ROLES",
  "FRESH_SEVEN_PATH_RESOLVER_EDGE_MAP",
  "FRESH_SEVEN_PATH_RESOLVER_EDGE_MAP_IDENTITY",
  "SUPERVISED_TOOLCHAIN_K44_OBSERVER_RECEIPT_JSON_SCHEMA",
  "SUPERVISED_TOOLCHAIN_K44_OBSERVER_RECEIPT_SCHEMA",
  "SUPERVISED_TOOLCHAIN_K44_PACKAGE_RESULT_SCHEMA",
  "SUPERVISED_TOOLCHAIN_K44_PACKAGE_SOURCE_TRUTH",
  "SUPERVISED_TOOLCHAIN_K44_PACKAGE_STATUS",
  "assertPackageSourceTruth",
  "canonicalJson",
  "createHash",
  "evaluateBoundSupervisedProjection",
  "parseCanonicalJson",
  "sha256HexUtf8",
  "snapshotContextNativeFacadeCallCounts",
  "types",
]);
const ROLE6_EXPORTS = Object.freeze([
  "SUPERVISED_TOOLCHAIN_K44_OBSERVER_ENTRY_CONTRACT",
  "default",
  "evaluatePostCheckpointToolchainK44Observation",
]);

const GRAPH_EDGES = Object.freeze([
  Object.freeze({ fromRoleCode: 2, specifierKind: "BUILTIN", specifier: "node:buffer", toRoleCodeOrZero: 0 }),
  Object.freeze({ fromRoleCode: 2, specifierKind: "BUILTIN", specifier: "node:util", toRoleCodeOrZero: 0 }),
  Object.freeze({ fromRoleCode: 6, specifierKind: "RELATIVE_EXACT_REVIEWED_PATH_TO_ROLE", specifier: "./lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs", toRoleCodeOrZero: 2 }),
  Object.freeze({ fromRoleCode: 6, specifierKind: "RELATIVE_EXACT_REVIEWED_PATH_TO_ROLE", specifier: "./lib/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package-contract.mjs", toRoleCodeOrZero: 5 }),
]);
const GRAPH_SHA256 = "78e901dd5ef6700530a592fef599facffb6628688d444f6c780d5f76610beec1";

function fail(label, message) {
  throw new TypeError(`${label}: ${message}`);
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function equalHex(left, right) {
  if (typeof left !== "string" || typeof right !== "string" || !/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

function utf8Compare(left, right) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function assertPlainData(value, path = "$", seen = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) fail(path, "unsafe or nonintegral number");
    return;
  }
  if (typeof value !== "object" || seen.has(value)) fail(path, "non-plain, shared, or cyclic value");
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const ownKeys = Reflect.ownKeys(value);
  if (Array.isArray(value)) {
    const expected = [...Array(value.length).keys()].map(String).concat("length");
    if (ownKeys.length !== expected.length || ownKeys.some((key, index) => key !== expected[index])) fail(path, "sparse, symbol, or hidden array key");
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = descriptors[String(index)];
      if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) fail(`${path}[${index}]`, "non-data array element");
      assertPlainData(descriptor.value, `${path}[${index}]`, seen);
    }
    return;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) fail(path, "non-plain object prototype");
  if (ownKeys.some((key) => typeof key !== "string")) fail(path, "symbol key");
  for (const key of ownKeys) {
    const descriptor = descriptors[key];
    if (!descriptor || !descriptor.enumerable || descriptor.get || descriptor.set) fail(`${path}.${key}`, "hidden or accessor key");
    assertPlainData(descriptor.value, `${path}.${key}`, seen);
  }
}

function canonicalJson(value) {
  assertPlainData(value);
  const render = (item) => {
    if (item === null || typeof item !== "object") return JSON.stringify(item);
    if (Array.isArray(item)) return `[${item.map(render).join(",")}]`;
    const keys = Object.keys(item).sort(utf8Compare);
    return `{${keys.map((key) => `${JSON.stringify(key)}:${render(item[key])}`).join(",")}}`;
  };
  return render(value);
}

function parseCanonicalPacket(bytes, maximum, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 2 || bytes.length > maximum || bytes.at(-1) !== 0x0a) fail(label, "bounded one-LF packet required");
  if (bytes.includes(0) || bytes.includes(0x0d) || (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)) fail(label, "NUL, CR, or BOM");
  const text = bytes.subarray(0, -1).toString("utf8");
  if (!Buffer.from(text, "utf8").equals(bytes.subarray(0, -1))) fail(label, "noncanonical UTF-8");
  let value;
  try { value = JSON.parse(text); } catch { fail(label, "invalid JSON"); }
  assertPlainData(value, label);
  if (`${canonicalJson(value)}\n` !== bytes.toString("utf8")) fail(label, "duplicate keys, escape alias, unsafe number, or noncanonical order");
  return value;
}

function exactKeys(value, keys, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(path, "expected object");
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key, index) => key !== keys[index])) fail(path, `expected exact key order ${keys.join(",")}`);
}

function canonicalU64(value, path) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]{0,19})$/.test(value)) fail(path, "noncanonical unsigned decimal");
  const parsed = BigInt(value);
  if (parsed > 18_446_744_073_709_551_615n) fail(path, "u64 overflow");
  return parsed;
}

function exactIdentity(left, right, path) {
  exactKeys(left, ["byteLength", "sha256"], `${path}.left`);
  exactKeys(right, ["byteLength", "sha256"], `${path}.right`);
  canonicalU64(left.byteLength, `${path}.byteLength`);
  if (left.byteLength !== right.byteLength || !equalHex(left.sha256, right.sha256)) fail(path, "identity substitution");
}

function validateRequestBody(body) {
  exactKeys(body, [
    "anchorIdentity", "bootId", "cas", "childExecutionProjectionSha256", "descriptorRuntimeSchemas", "externalExpectedSchemas",
    "fd3", "fd4", "invokerRequestSha256", "ledgerSnapshot", "nativeObservedSchemas", "oneUseCapabilityDigest", "package", "projectionJson",
    "projectionRequestBindingSha256", "requestNonce", "runId", "schema", "sessionId", "supervisorReleaseId", "window",
  ], "$request.body");
  if (body.schema !== "iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd3-request/v1") fail("$request.body.schema", "version mismatch");
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$/.test(body.runId)) fail("$request.body.runId", "invalid component");
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,62}[A-Za-z0-9])?$/.test(body.supervisorReleaseId)) fail("$request.body.supervisorReleaseId", "invalid release component");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(body.bootId)) fail("$request.body.bootId", "invalid boot id");
  for (const [name, value] of [["sessionId", body.sessionId], ["requestNonce", body.requestNonce], ["oneUseCapabilityDigest", body.oneUseCapabilityDigest]]) {
    if (!/^[0-9a-f]{64}$/.test(value)) fail(`$request.body.${name}`, "invalid digest");
  }
  if (!/^[0-9a-f]{64}$/.test(body.childExecutionProjectionSha256) || !/^[0-9a-f]{64}$/.test(body.invokerRequestSha256)) fail("$request.body", "unbound child execution projection or invoker request");
  exactKeys(body.anchorIdentity, ["byteLength", "sha256", "source"], "$request.body.anchorIdentity");
  if (body.anchorIdentity.source !== "OUT_OF_BAND_TRUSTED_INVOKER_FIXED_FD") fail("$request.body.anchorIdentity.source", "self-selected anchor");
  if (!/^[0-9a-f]{64}$/.test(body.anchorIdentity.sha256)) fail("$request.body.anchorIdentity.sha256", "invalid external anchor digest");
  canonicalU64(body.anchorIdentity.byteLength, "$request.body.anchorIdentity.byteLength");
  for (const groupName of ["descriptorRuntimeSchemas", "externalExpectedSchemas", "nativeObservedSchemas"]) {
    const group = body[groupName];
    exactKeys(group, ["anchor", "bootstrap", "evidence"], `$request.body.${groupName}`);
    for (const schemaName of ["anchor", "bootstrap", "evidence"]) exactKeys(group[schemaName], ["byteLength", "sha256"], `$request.body.${groupName}.${schemaName}`);
  }
  for (const schemaName of ["anchor", "bootstrap", "evidence"]) {
    exactIdentity(body.externalExpectedSchemas[schemaName], body.descriptorRuntimeSchemas[schemaName], `$request.schemas.${schemaName}.externalDescriptor`);
    exactIdentity(body.externalExpectedSchemas[schemaName], body.nativeObservedSchemas[schemaName], `$request.schemas.${schemaName}.externalObserved`);
  }
  exactKeys(body.package, ["commitRawByteLength", "commitRawSha256", "commitSha", "manifestByteLength", "manifestSha256", "parentCommitSha", "payloadByteLength", "rawDeltaByteLength", "rawDeltaRecordCount", "rawDeltaSha256", "resolverEdgeMapSha256", "treeSha"], "$request.body.package");
  if (body.package.commitSha !== "11572110330c4b22aa89d629065574e567e9fea8" || body.package.commitRawSha256 !== "61ce1f82634a4ea41f433410d3437dbe94d37aee78e0692b79e959d3deee1c3f" || body.package.commitRawByteLength !== "257" || body.package.parentCommitSha !== "b1c65482aebb31395a763707b02224c38aa2da96" || body.package.treeSha !== "22741ccba22f8f16663c745c0496d5c0be97d534") fail("$request.body.package", "checkpoint mismatch");
  if (body.package.rawDeltaSha256 !== "1be0fac74e365d480a2b83ac7452d9a399374b0ff5e0ec68b7c9ac37064ea235" || body.package.rawDeltaByteLength !== "1411" || body.package.rawDeltaRecordCount !== 7) fail("$request.body.package", "reviewed BPC00 raw delta mismatch");
  if (body.package.manifestSha256 !== "383960b7b04fd4c3afe66b27fa1ce8de74a870ce18f15d37a8069a5a0414b9d5" || body.package.manifestByteLength !== "1334" || body.package.payloadByteLength !== "123908" || body.package.resolverEdgeMapSha256 !== GRAPH_SHA256) fail("$request.body.package", "manifest or graph mismatch");
  exactKeys(body.fd3, ["openFileDescriptionSha256", "peerIdentitySha256", "soleChildReference"], "$request.body.fd3");
  if (body.fd3.soleChildReference !== true || !/^[0-9a-f]{64}$/.test(body.fd3.openFileDescriptionSha256) || !/^[0-9a-f]{64}$/.test(body.fd3.peerIdentitySha256)) fail("$request.body.fd3", "fd identity or alias");
  exactKeys(body.fd4, ["bundleByteLength", "bundleSha256", "dev", "ino", "offset", "openFileDescriptionSha256", "seals", "soleChildReference", "writableMappingPresent", "writerPresent"], "$request.body.fd4");
  if (body.fd4.offset !== "0" || body.fd4.soleChildReference !== true || body.fd4.writerPresent !== false || body.fd4.writableMappingPresent !== false || !/^[0-9a-f]{64}$/.test(body.fd4.openFileDescriptionSha256) || !/^[0-9a-f]{64}$/.test(body.fd4.bundleSha256)) fail("$request.body.fd4", "fd4 origin, alias, offset, writer, mapping, or digest mismatch");
  canonicalU64(body.fd4.dev, "$request.body.fd4.dev");
  if (canonicalU64(body.fd4.ino, "$request.body.fd4.ino") === 0n) fail("$request.body.fd4.ino", "zero inode");
  if (canonicalU64(body.fd4.bundleByteLength, "$request.body.fd4.bundleByteLength") > BigInt(MAX_BUNDLE_BYTES)) fail("$request.body.fd4.bundleByteLength", "bundle cap");
  if (canonicalJson(body.fd4.seals) !== canonicalJson(["F_SEAL_SEAL", "F_SEAL_SHRINK", "F_SEAL_GROW", "F_SEAL_WRITE", "F_SEAL_FUTURE_WRITE"])) fail("$request.body.fd4.seals", "seal mask mismatch");
  if (body.fd3.openFileDescriptionSha256 === body.fd4.openFileDescriptionSha256) fail("$request.body", "fd3/fd4 alias");
  exactKeys(body.ledgerSnapshot, ["cumulativeBytesAfterReservation", "cumulativeEntriesAfterReservation", "globalByteLimit", "globalEntryLimit", "reservedChildBytes", "reservedChildEntries", "watchdogReceiptSha256"], "$request.body.ledgerSnapshot");
  const cumulativeBytes = canonicalU64(body.ledgerSnapshot.cumulativeBytesAfterReservation, "$request.body.ledgerSnapshot.cumulativeBytesAfterReservation");
  const cumulativeEntries = canonicalU64(body.ledgerSnapshot.cumulativeEntriesAfterReservation, "$request.body.ledgerSnapshot.cumulativeEntriesAfterReservation");
  const globalBytes = canonicalU64(body.ledgerSnapshot.globalByteLimit, "$request.body.ledgerSnapshot.globalByteLimit");
  const globalEntries = canonicalU64(body.ledgerSnapshot.globalEntryLimit, "$request.body.ledgerSnapshot.globalEntryLimit");
  const reservedBytes = canonicalU64(body.ledgerSnapshot.reservedChildBytes, "$request.body.ledgerSnapshot.reservedChildBytes");
  const reservedEntries = canonicalU64(body.ledgerSnapshot.reservedChildEntries, "$request.body.ledgerSnapshot.reservedChildEntries");
  if (globalBytes !== GLOBAL_READ_LIMIT || globalEntries !== GLOBAL_ENTRY_LIMIT || reservedBytes === 0n || reservedEntries === 0n || cumulativeBytes < reservedBytes || cumulativeEntries < reservedEntries || cumulativeBytes > globalBytes || cumulativeEntries > globalEntries || !/^[0-9a-f]{64}$/.test(body.ledgerSnapshot.watchdogReceiptSha256)) fail("$request.body.ledgerSnapshot", "unbound or overflowing global ledger reservation");
  exactKeys(body.window, ["armedMonotonicNs", "operationDeadlineMonotonicNs", "teardownDeadlineMonotonicNs"], "$request.body.window");
  const armed = canonicalU64(body.window.armedMonotonicNs, "$request.body.window.armedMonotonicNs");
  const operation = canonicalU64(body.window.operationDeadlineMonotonicNs, "$request.body.window.operationDeadlineMonotonicNs");
  const teardown = canonicalU64(body.window.teardownDeadlineMonotonicNs, "$request.body.window.teardownDeadlineMonotonicNs");
  if (!(armed < operation && operation < teardown && operation - armed <= 150_000_000_000n && teardown - operation <= 30_000_000_000n)) fail("$request.body.window", "deadline reset, reversal, or extension");
  exactKeys(body.cas, ["ledgerId", "oneUseCapabilityDigest", "requestNonce", "reservationPrekeySha256", "state", "watchdogOwnerIdentitySha256"], "$request.body.cas");
  if (body.cas.state !== "BOUND_ONCE" || body.cas.requestNonce !== body.requestNonce || body.cas.oneUseCapabilityDigest !== body.oneUseCapabilityDigest) fail("$request.body.cas", "reservation/request cross-binding mismatch");
  if (!/^[0-9a-f]{64}$/.test(body.cas.ledgerId) || !/^[0-9a-f]{64}$/.test(body.cas.reservationPrekeySha256) || !/^[0-9a-f]{64}$/.test(body.cas.watchdogOwnerIdentitySha256)) fail("$request.body.cas", "invalid CAS digest");
  const projectionPrebinding = {
    anchorIdentity: body.anchorIdentity,
    bootId: body.bootId,
    childExecutionProjectionSha256: body.childExecutionProjectionSha256,
    externalExpectedSchemas: body.externalExpectedSchemas,
    fd3: body.fd3,
    fd4: body.fd4,
    invokerRequestSha256: body.invokerRequestSha256,
    ledgerSnapshot: body.ledgerSnapshot,
    oneUseCapabilityDigest: body.oneUseCapabilityDigest,
    package: body.package,
    requestNonce: body.requestNonce,
    runId: body.runId,
    schema: "iat-b3-post-checkpoint-prelaunch-supervisor-projection-request-prebinding/v1",
    sessionId: body.sessionId,
    supervisorReleaseId: body.supervisorReleaseId,
    window: body.window,
  };
  const computedProjectionBinding = sha256Hex(Buffer.from(`${PROJECTION_BINDING_DOMAIN}\0${canonicalJson(projectionPrebinding)}\n`, "utf8"));
  if (!equalHex(body.projectionRequestBindingSha256, computedProjectionBinding)) fail("$request.body.projectionRequestBindingSha256", "non-self prebinding digest mismatch");
  if (typeof body.projectionJson !== "string" || Buffer.byteLength(body.projectionJson, "utf8") > MAX_REQUEST_BYTES / 2) fail("$request.body.projectionJson", "projection bound");
  validateProjection(body.projectionJson, body);
  return body;
}

function validateProjection(text, requestBody) {
  const bytes = Buffer.from(`${text}\n`, "utf8");
  const value = parseCanonicalPacket(bytes, MAX_REQUEST_BYTES / 2, "$projection");
  exactKeys(value, ["authority", "bootId", "bundleSha256", "graphSha256", "k44", "package", "requestSha256", "runId", "schema", "sessionId", "toolchains", "window"], "$projection");
  if (value.schema !== "iat-b3-post-checkpoint-supervised-toolchain-k44-observer-receipt/v1" || value.runId !== requestBody.runId || value.bootId !== requestBody.bootId || value.sessionId !== requestBody.sessionId || value.graphSha256 !== GRAPH_SHA256 || value.bundleSha256 !== requestBody.fd4.bundleSha256 || value.requestSha256 !== requestBody.projectionRequestBindingSha256) fail("$projection", "non-self prebinding/projection identity mismatch");
  exactKeys(value.authority, ["devnetAuthorized", "gate8Go", "mainnetAuthorized", "releaseAuthorized", "signingAuthorized"], "$projection.authority");
  if (Object.values(value.authority).some((entry) => entry !== false)) fail("$projection.authority", "authority promotion");
  exactKeys(value.package, ["commitSha", "entries", "manifestByteLength", "manifestSha256", "parentCommitSha", "treeSha"], "$projection.package");
  if (value.package.commitSha !== requestBody.package.commitSha || value.package.parentCommitSha !== requestBody.package.parentCommitSha || value.package.treeSha !== requestBody.package.treeSha || value.package.manifestSha256 !== requestBody.package.manifestSha256 || value.package.manifestByteLength !== requestBody.package.manifestByteLength) fail("$projection.package", "package substitution");
  if (!Array.isArray(value.package.entries) || value.package.entries.length !== PACKAGE.length) fail("$projection.package.entries", "cardinality");
  for (let index = 0; index < PACKAGE.length; index += 1) {
    const actual = value.package.entries[index];
    const expected = PACKAGE[index];
    exactKeys(actual, ["byteLength", "mode", "path", "roleCode", "sha256"], `$projection.package.entries[${index}]`);
    if (actual.byteLength !== expected.byteLength || actual.mode !== "100644" || actual.path !== expected.path || actual.roleCode !== expected.roleCode || actual.sha256 !== expected.sha256) fail(`$projection.package.entries[${index}]`, "exact row mismatch");
  }
  if (!Array.isArray(value.toolchains) || value.toolchains.length !== 3) fail("$projection.toolchains", "target cardinality");
  const expectedTargets = [["linux-x64-musl", "PINNED_ZIG_CC"], ["windows-x64-gnu", "PINNED_ZIG_CC"], ["native-wsl-linux-x64-musl", "OPTIONAL_NATIVE_WSL_COMPILER"]];
  for (let index = 0; index < 3; index += 1) {
    const target = value.toolchains[index];
    exactKeys(target, ["accepted", "backend", "observation", "target"], `$projection.toolchains[${index}]`);
    if (target.accepted !== false || target.observation !== null || target.target !== expectedTargets[index][0] || target.backend !== expectedTargets[index][1]) fail(`$projection.toolchains[${index}]`, "unobserved target boundary");
  }
  exactKeys(value.k44, ["accepted", "assessment", "directFlags"], "$projection.k44");
  exactKeys(value.k44.directFlags, ["checkpointDirectlyObservedByThisModule", "inputFilesDirectlyObservedByThisModule", "priorLaneIdentityInventoryDirectlyObservedByThisModule", "productionIdentityInventoryDirectlyObservedByThisModule", "wallClockDirectlyObservedByThisModule"], "$projection.k44.directFlags");
  if (value.k44.accepted !== false || value.k44.assessment !== null || Object.values(value.k44.directFlags).some((entry) => entry !== false)) fail("$projection.k44", "K44 promotion");
  exactKeys(value.window, ["deadlineMonotonicNs", "observedMonotonicNs", "openedMonotonicNs"], "$projection.window");
  const opened = canonicalU64(value.window.openedMonotonicNs, "$projection.window.openedMonotonicNs");
  const observed = canonicalU64(value.window.observedMonotonicNs, "$projection.window.observedMonotonicNs");
  const deadline = canonicalU64(value.window.deadlineMonotonicNs, "$projection.window.deadlineMonotonicNs");
  if (opened.toString() !== requestBody.window.armedMonotonicNs || deadline.toString() !== requestBody.window.operationDeadlineMonotonicNs || observed < opened || observed > deadline || deadline - opened > 150_000_000_000n) fail("$projection.window", "external window mismatch, reversal, or extension");
  return value;
}

function readOneRequestPacket() {
  const first = Buffer.allocUnsafe(MAX_REQUEST_BYTES + 1);
  const length = readSync(REQUEST_FD, first, 0, first.length, null);
  if (length < 1 || length > MAX_REQUEST_BYTES) fail("$fd3", "empty, oversized, split, or truncated packet");
  const second = Buffer.allocUnsafe(1);
  if (readSync(REQUEST_FD, second, 0, 1, null) !== 0) fail("$fd3", "second packet or trailing byte");
  return first.subarray(0, length);
}

function readExact(fd, length, state, coveredHasher, bundleHasher, payloadHasher, retain) {
  if (!Number.isSafeInteger(length) || length < 0) fail("$fd4", "invalid bounded length");
  const chunks = retain ? [] : null;
  let remaining = length;
  while (remaining > 0) {
    const chunk = Buffer.allocUnsafe(Math.min(MAX_CHUNK_BYTES, remaining));
    const count = readSync(fd, chunk, 0, chunk.length, null);
    if (count !== chunk.length) fail("$fd4", "partial read, EOF, EAGAIN, or EINTR");
    const actual = chunk.subarray(0, count);
    state.bytes += BigInt(count);
    state.entries += 1n;
    if (state.bytes > GLOBAL_READ_LIMIT || state.entries > GLOBAL_ENTRY_LIMIT) fail("$ledger", "aggregate checked-u64 budget exceeded");
    if (coveredHasher) coveredHasher.update(actual);
    if (bundleHasher) bundleHasher.update(actual);
    if (payloadHasher) payloadHasher.update(actual);
    if (retain) chunks.push(Buffer.from(actual));
    remaining -= count;
  }
  return retain ? Buffer.concat(chunks, length) : null;
}

function readU16(fd, state, covered, whole) {
  return readExact(fd, 2, state, covered, whole, null, true).readUInt16BE(0);
}

function readU32(fd, state, covered, whole) {
  return readExact(fd, 4, state, covered, whole, null, true).readUInt32BE(0);
}

function readU64(fd, state, covered, whole, label) {
  const raw = readExact(fd, 8, state, covered, whole, null, true);
  const value = raw.readBigUInt64BE(0);
  if (value > BigInt(MAX_BUNDLE_BYTES) || value > BigInt(Number.MAX_SAFE_INTEGER)) fail(label, "payload bound");
  return Number(value);
}

function readPackageBundle(requestBody, requestPacketByteLength) {
  const state = { bytes: 0n, entries: 0n };
  const covered = createHash("sha256").update(BUNDLE_TRAILER_DOMAIN);
  const whole = createHash("sha256");
  const magic = readExact(BUNDLE_FD, BUNDLE_MAGIC.length, state, covered, whole, null, true);
  if (!magic.equals(BUNDLE_MAGIC)) fail("$fd4.magic", "domain mismatch");
  if (readU16(BUNDLE_FD, state, covered, whole) !== 1 || readU32(BUNDLE_FD, state, covered, whole) !== 7) fail("$fd4.header", "version or count mismatch");
  const executableSources = new Map();
  let previousPath = null;
  let aggregatePayload = 0n;
  for (let index = 0; index < PACKAGE_IN_BUNDLE_ORDER.length; index += 1) {
    const pathLength = readU16(BUNDLE_FD, state, covered, whole);
    if (pathLength < 1 || pathLength > 4096) fail(`$fd4.entries[${index}].path`, "path length");
    const pathBytes = readExact(BUNDLE_FD, pathLength, state, covered, whole, null, true);
    const path = pathBytes.toString("utf8");
    if (!Buffer.from(path, "utf8").equals(pathBytes) || path.includes("\\") || path.includes("\0") || path.includes("\r") || path.startsWith("/") || path.endsWith("/") || path.split("/").some((part) => part === "" || part === "." || part === "..")) fail(`$fd4.entries[${index}].path`, "canonical raw UTF-8 path");
    if (previousPath !== null && Buffer.compare(Buffer.from(previousPath), pathBytes) >= 0) fail(`$fd4.entries[${index}].path`, "raw path order");
    previousPath = path;
    const roleCode = readExact(BUNDLE_FD, 1, state, covered, whole, null, true)[0];
    const payloadLength = readU64(BUNDLE_FD, state, covered, whole, `$fd4.entries[${index}].payloadByteLength`);
    const declaredSha = readExact(BUNDLE_FD, 32, state, covered, whole, null, true).toString("hex");
    const expected = PACKAGE_IN_BUNDLE_ORDER[index];
    if (path !== expected.path || roleCode !== expected.roleCode || String(payloadLength) !== expected.byteLength || declaredSha !== expected.sha256) fail(`$fd4.entries[${index}]`, "reviewed row mismatch");
    aggregatePayload += BigInt(payloadLength);
    if (aggregatePayload > GLOBAL_READ_LIMIT) fail("$fd4.entries", "aggregate payload overflow");
    const payloadHasher = createHash("sha256");
    const payload = readExact(BUNDLE_FD, payloadLength, state, covered, whole, payloadHasher, expected.executable);
    if (payloadHasher.digest("hex") !== expected.sha256) fail(`$fd4.entries[${index}].payload`, "payload hash mismatch");
    if (expected.executable) {
      if (payloadLength > MAX_MODULE_BYTES) fail(`$fd4.entries[${index}].payload`, "retained module cap");
      const source = payload.toString("utf8");
      if (!Buffer.from(source, "utf8").equals(payload) || source.includes("\0") || source.includes("\r") || source.charCodeAt(0) === 0xfeff) fail(`$fd4.entries[${index}].payload`, "module UTF-8 boundary");
      executableSources.set(roleCode, source);
    }
  }
  if (aggregatePayload !== 123_908n) fail("$fd4", "payload aggregate mismatch");
  const expectedTrailer = covered.digest();
  const trailer = readExact(BUNDLE_FD, 32, state, null, whole, null, true);
  if (!timingSafeEqual(expectedTrailer, trailer)) fail("$fd4.trailer", "domain digest mismatch");
  const eof = Buffer.allocUnsafe(1);
  if (readSync(BUNDLE_FD, eof, 0, 1, null) !== 0) fail("$fd4", "trailing byte");
  const wholeDigest = whole.digest("hex");
  if (state.bytes !== canonicalU64(requestBody.fd4.bundleByteLength, "$request.body.fd4.bundleByteLength") || !equalHex(wholeDigest, requestBody.fd4.bundleSha256)) fail("$fd4", "native transcript/bundle mismatch");
  const actualChildBytes = BigInt(requestPacketByteLength) + 1n + state.bytes + 1n;
  const actualChildEntries = 2n + state.entries + 1n;
  if (actualChildBytes > canonicalU64(requestBody.ledgerSnapshot.reservedChildBytes, "$request.body.ledgerSnapshot.reservedChildBytes") || actualChildEntries > canonicalU64(requestBody.ledgerSnapshot.reservedChildEntries, "$request.body.ledgerSnapshot.reservedChildEntries")) fail("$ledger", "child read exceeds watchdog-owned pre-reservation");
  return Object.freeze({ executableSources, wholeDigest, byteLength: state.bytes.toString(), chargedReadBytes: state.bytes.toString(), chargedReadCalls: state.entries.toString() });
}

function exactModuleRequests(module, expected, label) {
  const requests = module.moduleRequests.map((request) => request.specifier);
  if (requests.length !== expected.length || requests.some((specifier, index) => specifier !== expected[index])) fail(label, "module request graph mismatch");
  for (const request of module.moduleRequests) {
    if (request.phase !== "evaluation" || (request.attributes && Object.keys(request.attributes).length !== 0)) fail(label, "import phase or attributes forbidden");
  }
}

function exactNamespace(module, expected, label) {
  const actual = Object.getOwnPropertyNames(module.namespace);
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(label, "namespace export set mismatch");
}

function makeSourceModule(source, roleCode, context) {
  if (/\bawait\b|\bimport\s*\(|\bimport\s*\.|\bimport\.meta\b|\bWebAssembly\b|\bprocess\b|\brequire\b|node:(?:fs|path|module|vm|worker_threads|child_process|net|http|https|tls|dgram)/u.test(source)) fail(`$graph.role${roleCode}`, "dynamic, ambient, path, process, or asynchronous capability token");
  return new SourceTextModule(source, {
    context,
    identifier: `iat-b3-reviewed-role:${roleCode}`,
    initializeImportMeta() { fail(`$graph.role${roleCode}`, "import.meta forbidden"); },
    importModuleDynamically() { fail(`$graph.role${roleCode}`, "dynamic import forbidden"); },
  });
}

async function evaluatePackageGraph(sources, projectionJson, acceptedProjectionPrebindingSha256, expectedBundleSha256, expectedRunId) {
  const context = createContext(Object.create(null), {
    name: "iat-b3-bps05-proxy-free-package-context",
    codeGeneration: { strings: false, wasm: false },
  });
  runInContext(`
    "use strict";
    Reflect.deleteProperty(globalThis, "structuredClone");
    Object.defineProperty(globalThis, "Proxy", { value: undefined, writable: false, enumerable: false, configurable: false });
    for (const name of ["process","fetch","WebAssembly","SharedArrayBuffer","MessageChannel","MessagePort","BroadcastChannel"]) {
      Object.defineProperty(globalThis, name, { value: undefined, writable: false, enumerable: false, configurable: false });
    }
  `, context, { timeout: 1000 });

  const role5 = makeSourceModule(sources.get(5), 5, context);
  exactModuleRequests(role5, [], "$graph.role5.requests");
  await role5.link(() => fail("$graph.role5", "import-free facade requested a module"));
  await role5.evaluate({ timeout: 5000, breakOnSigint: false });
  exactNamespace(role5, ROLE5_EXPORTS, "$graph.role5.namespace");

  const bufferModule = new SyntheticModule(["Buffer"], function initializeBufferFacade() {
    this.setExport("Buffer", role5.namespace.Buffer);
  }, { context, identifier: "node:buffer" });
  const utilModule = new SyntheticModule(["types"], function initializeUtilFacade() {
    this.setExport("types", role5.namespace.types);
  }, { context, identifier: "node:util" });
  await bufferModule.link(() => fail("$graph.nodeBuffer", "synthetic import forbidden"));
  await utilModule.link(() => fail("$graph.nodeUtil", "synthetic import forbidden"));

  const role2 = makeSourceModule(sources.get(2), 2, context);
  exactModuleRequests(role2, ["node:buffer", "node:util"], "$graph.role2.requests");
  await role2.link((specifier) => {
    if (specifier === "node:buffer") return bufferModule;
    if (specifier === "node:util") return utilModule;
    fail("$graph.role2", "unreviewed edge");
  });
  await role2.evaluate({ timeout: 5000, breakOnSigint: false });
  exactNamespace(role2, ROLE2_EXPORTS, "$graph.role2.namespace");

  const role6 = makeSourceModule(sources.get(6), 6, context);
  exactModuleRequests(role6, [
    "./lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs",
    "./lib/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package-contract.mjs",
  ], "$graph.role6.requests");
  await role6.link((specifier) => {
    if (specifier === GRAPH_EDGES[2].specifier) return role2;
    if (specifier === GRAPH_EDGES[3].specifier) return role5;
    fail("$graph.role6", "unreviewed edge");
  });
  await role6.evaluate({ timeout: 5000, breakOnSigint: false });
  exactNamespace(role6, ROLE6_EXPORTS, "$graph.role6.namespace");
  const invocationSource = `
    import entry, { evaluatePostCheckpointToolchainK44Observation as namedEntry } from "iat-b3:role6";
    import { snapshotContextNativeFacadeCallCounts } from "iat-b3:role5";
    const projection = ${JSON.stringify(projectionJson)};
    if (typeof entry !== "function" || entry.length !== 1 || entry !== namedEntry) throw new TypeError("entry");
    const result = entry(projection);
    if (typeof result !== "string") throw new TypeError("result");
    const counts = snapshotContextNativeFacadeCallCounts();
    if (counts === null || typeof counts !== "object" || Object.getPrototypeOf(counts) !== Object.prototype || counts.isProxy < 1 || counts.structuredClone < 1) throw new TypeError("facades");
    export default result;
  `;
  const invocation = new SourceTextModule(invocationSource, {
    context,
    identifier: "iat-b3-reviewed-in-context-entry-wrapper",
    initializeImportMeta() { fail("$graph.invocation", "import.meta forbidden"); },
    importModuleDynamically() { fail("$graph.invocation", "dynamic import forbidden"); },
  });
  exactModuleRequests(invocation, ["iat-b3:role6", "iat-b3:role5"], "$graph.invocation.requests");
  await invocation.link((specifier) => {
    if (specifier === "iat-b3:role6") return role6;
    if (specifier === "iat-b3:role5") return role5;
    fail("$graph.invocation", "unreviewed wrapper edge");
  });
  await invocation.evaluate({ timeout: 5000, breakOnSigint: false });
  exactNamespace(invocation, ["default"], "$graph.invocation.namespace");
  const result = invocation.namespace.default;
  if (typeof result !== "string") fail("$graph.entry", "only a primitive result string may cross the context boundary");
  const parsed = parseCanonicalPackageResult(result);
  const expectedProjectionSha256 = sha256Hex(Buffer.from(`IAT_B3_BPI01_SUPERVISED_PROJECTION_V1\0${projectionJson}`, "utf8"));
  if (parsed.runId !== expectedRunId || parsed.requestSha256 !== acceptedProjectionPrebindingSha256 || parsed.bundleSha256 !== expectedBundleSha256 || parsed.graphSha256 !== GRAPH_SHA256 || parsed.projectionSha256 !== expectedProjectionSha256) fail("$graph.result", "accepted prebinding/projection/result cross-binding mismatch");
  return result;
}

function parseCanonicalPackageResult(text) {
  if (typeof text !== "string") fail("$graph.result", "primitive string required");
  const bytes = Buffer.from(text, "utf8");
  if (bytes.length > MAX_RESULT_BYTES || bytes.at(-1) !== 0x0a || bytes.includes(0x0d) || bytes.includes(0)) fail("$graph.result", "canonical bounded one-LF result required");
  let value;
  try { value = JSON.parse(text.slice(0, -1)); } catch { fail("$graph.result", "invalid JSON"); }
  assertPlainData(value, "$graph.result");
  exactKeys(value, ["schema", "runId", "requestSha256", "bundleSha256", "graphSha256", "projectionSha256", "toolchainAccepted", "k44Accepted", "receiptPresent", "decision", "authority", "resultBodySha256"], "$graph.result");
  if (`${JSON.stringify(value)}\n` !== text) fail("$graph.result", "result order, duplicate, or escape mismatch");
  const { resultBodySha256, ...body } = value;
  const bodyJson = `${JSON.stringify(body)}\n`;
  if (!equalHex(resultBodySha256, sha256Hex(Buffer.from(`IAT_B3_BPS04_PACKAGE_GRAPH_RESULT_BODY_V1\0${bodyJson}`, "utf8")))) fail("$graph.result", "non-self digest mismatch");
  if (value.schema !== "iat-b3-post-checkpoint-prelaunch-supervisor-package-graph-result/v1" || value.graphSha256 !== GRAPH_SHA256 || value.toolchainAccepted !== false || value.k44Accepted !== false || value.receiptPresent !== false || value.decision !== "HOLD" || value.authority !== "NONE") fail("$graph.result", "authority promotion");
  return Object.freeze(value);
}

function closeOnce(fd, state, label) {
  if (state.closed) fail(label, "duplicate close attempt");
  state.closed = true;
  closeSync(fd);
}

function makePreGraphResult(requestBody, bundle) {
  const body = {
    authority: "NONE",
    bundleByteLength: bundle.byteLength,
    bundleSha256: bundle.wholeDigest,
    decision: "HOLD",
    k44Accepted: false,
    oneUseCapabilityDigest: requestBody.oneUseCapabilityDigest,
    packageGraphPending: true,
    projectionRequestBindingSha256: requestBody.projectionRequestBindingSha256,
    receiptPresent: false,
    requestNonce: requestBody.requestNonce,
    schema: "iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-pre-graph-result/v1",
    toolchainAccepted: false,
  };
  const bodyJson = canonicalJson(body);
  const result = { body, bodySha256: sha256Hex(Buffer.from(`${RESULT_BODY_DOMAIN}\0${bodyJson}\n`, "utf8")) };
  const bytes = Buffer.from(`${canonicalJson(result)}\n`, "utf8");
  if (bytes.length > MAX_RESULT_BYTES) fail("$fd3.result", "result cap");
  return bytes;
}

async function main() {
  const fd3State = { closed: false };
  const fd4State = { closed: false };
  let request;
  let bundle;
  try {
    const packet = readOneRequestPacket();
    request = parseCanonicalPacket(packet, MAX_REQUEST_BYTES, "$request");
    exactKeys(request, ["body", "bodySha256"], "$request");
    const bodyJson = canonicalJson(request.body);
    if (!equalHex(request.bodySha256, sha256Hex(Buffer.from(`${REQUEST_BODY_DOMAIN}\0${bodyJson}\n`, "utf8")))) fail("$request.bodySha256", "non-self request digest mismatch");
    validateRequestBody(request.body);
    bundle = readPackageBundle(request.body, packet.length);
    closeOnce(BUNDLE_FD, fd4State, "$fd4.close");
    const response = makePreGraphResult(request.body, bundle);
    const written = writeSync(REQUEST_FD, response, 0, response.length, null);
    if (written !== response.length) fail("$fd3.result", "partial single-packet write");
    closeOnce(REQUEST_FD, fd3State, "$fd3.close");
    const terminalGraphResult = await evaluatePackageGraph(bundle.executableSources, request.body.projectionJson, request.body.projectionRequestBindingSha256, bundle.wholeDigest, request.body.runId);
    const terminalBytes = Buffer.from(terminalGraphResult, "utf8");
    const terminalWritten = writeSync(1, terminalBytes, 0, terminalBytes.length, null);
    if (terminalWritten !== terminalBytes.length) fail("$graph.terminal", "partial terminal graph result write");
  } finally {
    if (!fd4State.closed) {
      fd4State.closed = true;
      try { closeSync(BUNDLE_FD); } catch { /* fail path never retries the same numeric descriptor */ }
    }
    if (!fd3State.closed) {
      fd3State.closed = true;
      try { closeSync(REQUEST_FD); } catch { /* fail path never retries the same numeric descriptor */ }
    }
  }
}

await main();

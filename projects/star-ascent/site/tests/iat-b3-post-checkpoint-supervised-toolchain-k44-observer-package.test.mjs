import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const SITE_PREFIX = "projects/star-ascent/site/";
const ROLE_PATHS = Object.freeze([
  "docs/b3/iat-b3-post-checkpoint-observer-source-design.v1.schema.json",
  "scripts/lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs",
  "tests/iat-b3-post-checkpoint-observer-source-design-contract.test.mjs",
  "docs/b3/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-receipt.v1.schema.json",
  "scripts/lib/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package-contract.mjs",
  "scripts/observe-iat-b3-post-checkpoint-supervised-toolchain-k44.mjs",
  "tests/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package.test.mjs",
]);
const FULL_ROLE_PATHS = Object.freeze(ROLE_PATHS.map((path) => SITE_PREFIX + path));
const EXPECTED_BPO = Object.freeze([
  Object.freeze({ sha256: "75501ad2821d5c869d1a805ecb4764705069d9ee452f6438cab1febd7da9ecad", bytes: 8182 }),
  Object.freeze({ sha256: "1a33cf1ca99a209abccabb1abc66ea7cb7f683b80d17201abdbc207bb8a6bcfe", bytes: 13834 }),
  Object.freeze({ sha256: "85e400f30981cf433c7dc0c95b60d0018e82aaae62f208b5d48643804545035d", bytes: 15817 }),
]);
const EXPECTED_EDGES = Object.freeze([
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

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const CAPTURED = Object.freeze(ROLE_PATHS.map((path, index) => {
  const bytes = readFileSync(new URL("../" + path, import.meta.url));
  return Object.freeze({
    roleCode: index + 1,
    path,
    fullPath: FULL_ROLE_PATHS[index],
    bytes,
    byteLength: bytes.length,
    sha256: sha256(bytes),
    source: path.endsWith(".mjs") ? bytes.toString("utf8") : null,
  });
}));

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value)) + "\n";
}

function portableManifest(header, rows) {
  const ordered = [...rows].sort((left, right) =>
    Buffer.compare(Buffer.from(left.fullPath, "utf8"), Buffer.from(right.fullPath, "utf8")));
  const bytes = Buffer.from(
    header + ordered.map((row) =>
      "100644\0" + row.sha256 + "\0" + row.byteLength + "\0" + row.fullPath + "\n").join(""),
    "utf8",
  );
  return Object.freeze({ sha256: sha256(bytes), byteLength: bytes.length, count: rows.length, bytes });
}

const FOUR_MANIFEST = portableManifest(
  "BPI01_POST_CHECKPOINT_TOOLCHAIN_K44_FRESH_FOUR_PATH_SOURCE_MANIFEST_V1\n",
  CAPTURED.slice(3),
);
const SEVEN_MANIFEST = portableManifest(
  "BPI01_POST_CHECKPOINT_TOOLCHAIN_K44_FRESH_SEVEN_PATH_PACKAGE_MANIFEST_V1\n",
  CAPTURED,
);
function resolverEdgeMapIdentity(edges) {
  if (!Array.isArray(edges) || edges.length !== 4) throw new TypeError("exact four-edge map required");
  const rows = edges.map((edge) => {
    if (
      JSON.stringify(Object.keys(edge)) !==
      JSON.stringify(["fromRoleCode", "specifierKind", "specifier", "toRoleCodeOrZero"])
    ) {
      throw new TypeError("exact resolver edge keys/order required");
    }
    if (
      (edge.specifierKind === "BUILTIN" && edge.toRoleCodeOrZero !== 0) ||
      (edge.specifierKind === "RELATIVE_EXACT_REVIEWED_PATH_TO_ROLE" && edge.toRoleCodeOrZero === 0) ||
      !["BUILTIN", "RELATIVE_EXACT_REVIEWED_PATH_TO_ROLE"].includes(edge.specifierKind)
    ) {
      throw new TypeError("resolver edge kind/target mismatch");
    }
    const fromPath = FULL_ROLE_PATHS[edge.fromRoleCode - 1];
    const toPath = edge.toRoleCodeOrZero === 0
      ? edge.specifier
      : FULL_ROLE_PATHS[edge.toRoleCodeOrZero - 1];
    return [fromPath, edge.specifier, toPath, edge.fromRoleCode, edge.toRoleCodeOrZero].join("\0") + "\n";
  }).sort((left, right) => Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))).join("");
  const domain = "IAT_B3_BPS04_RESOLVER_EDGE_MAP_V1";
  return Object.freeze({
    domain,
    edgeCount: edges.length,
    sha256: sha256(Buffer.from(domain + "\0" + rows, "utf8")),
    unsignedDecimalSerializedByteLength: String(Buffer.byteLength(rows, "utf8")),
  });
}
const GRAPH_IDENTITY = resolverEdgeMapIdentity(EXPECTED_EDGES);
const GRAPH_SHA256 = GRAPH_IDENTITY.sha256;
const BUNDLE_SHA256 = sha256(Buffer.concat(CAPTURED.map((row) => row.bytes)));

function projectionFixture() {
  return {
    authority: {
      devnetAuthorized: false,
      gate8Go: false,
      mainnetAuthorized: false,
      releaseAuthorized: false,
      signingAuthorized: false,
    },
    bootId: "00000000-0000-4000-8000-000000000001",
    bundleSha256: BUNDLE_SHA256,
    graphSha256: GRAPH_SHA256,
    k44: {
      accepted: false,
      assessment: null,
      directFlags: {
        checkpointDirectlyObservedByThisModule: false,
        inputFilesDirectlyObservedByThisModule: false,
        priorLaneIdentityInventoryDirectlyObservedByThisModule: false,
        productionIdentityInventoryDirectlyObservedByThisModule: false,
        wallClockDirectlyObservedByThisModule: false,
      },
    },
    package: {
      commitSha: "1111111111111111111111111111111111111111",
      entries: CAPTURED.map((row) => ({
        byteLength: String(row.byteLength),
        mode: "100644",
        path: row.fullPath,
        roleCode: row.roleCode,
        sha256: row.sha256,
      })),
      manifestByteLength: String(SEVEN_MANIFEST.byteLength),
      manifestSha256: SEVEN_MANIFEST.sha256,
      parentCommitSha: "2222222222222222222222222222222222222222",
      treeSha: "3333333333333333333333333333333333333333",
    },
    requestSha256: "4444444444444444444444444444444444444444444444444444444444444444",
    runId: "BPI01-source-only-fixture",
    schema: "iat-b3-post-checkpoint-supervised-toolchain-k44-observer-receipt/v1",
    sessionId: "5555555555555555555555555555555555555555555555555555555555555555",
    toolchains: [
      { accepted: false, backend: "PINNED_ZIG_CC", observation: null, target: "linux-x64-musl" },
      { accepted: false, backend: "PINNED_ZIG_CC", observation: null, target: "windows-x64-gnu" },
      {
        accepted: false,
        backend: "OPTIONAL_NATIVE_WSL_COMPILER",
        observation: null,
        target: "native-wsl-linux-x64-musl",
      },
    ],
    window: {
      deadlineMonotonicNs: "1000000100",
      observedMonotonicNs: "1000000001",
      openedMonotonicNs: "1000000000",
    },
  };
}

function sourceByRole(roleCode, overrides = new Map()) {
  return overrides.get(roleCode) ?? CAPTURED[roleCode - 1].source;
}

async function buildGraph(overrides = new Map()) {
  for (const [roleCode, source] of overrides) {
    const captured = CAPTURED[roleCode - 1];
    if (!captured?.source || typeof source !== "string") throw new TypeError("invalid source override");
    if (sha256(Buffer.from(source, "utf8")) !== captured.sha256) {
      throw new TypeError("captured role " + roleCode + " source identity mismatch");
    }
  }
  const context = vm.createContext(Object.create(null), {
    codeGeneration: { strings: false, wasm: false },
  });
  vm.runInContext(
    [
      "delete globalThis.Proxy;",
      "Object.defineProperty(globalThis, 'Proxy', { value: undefined, writable: false, configurable: false });",
      "delete globalThis.structuredClone;",
    ].join("\n"),
    context,
    { timeout: 1000 },
  );

  const role5 = new vm.SourceTextModule(sourceByRole(5, overrides), {
    context,
    identifier: "iat-b3-bundle:/" + ROLE_PATHS[4],
    initializeImportMeta() { throw new Error("import.meta forbidden"); },
    importModuleDynamically() { throw new Error("dynamic import forbidden"); },
  });
  await role5.link(() => { throw new Error("role 5 must be import-free"); });
  await role5.evaluate({ timeout: 1000 });

  const bufferModule = new vm.SyntheticModule(["Buffer"], function setBuffer() {
    this.setExport("Buffer", role5.namespace.Buffer);
  }, { context, identifier: "node:buffer" });
  const utilModule = new vm.SyntheticModule(["types"], function setTypes() {
    this.setExport("types", role5.namespace.types);
  }, { context, identifier: "node:util" });
  await bufferModule.link(() => { throw new Error("synthetic buffer import"); });
  await utilModule.link(() => { throw new Error("synthetic util import"); });
  await bufferModule.evaluate();
  await utilModule.evaluate();

  const role2 = new vm.SourceTextModule(sourceByRole(2, overrides), {
    context,
    identifier: "iat-b3-bundle:/" + ROLE_PATHS[1],
    initializeImportMeta() { throw new Error("import.meta forbidden"); },
    importModuleDynamically() { throw new Error("dynamic import forbidden"); },
  });
  await role2.link((specifier) => {
    if (specifier === "node:buffer") return bufferModule;
    if (specifier === "node:util") return utilModule;
    throw new Error("role 2 unexpected import " + specifier);
  });
  await role2.evaluate({ timeout: 1000 });

  const role6 = new vm.SourceTextModule(sourceByRole(6, overrides), {
    context,
    identifier: "iat-b3-bundle:/" + ROLE_PATHS[5],
    initializeImportMeta() { throw new Error("import.meta forbidden"); },
    importModuleDynamically() { throw new Error("dynamic import forbidden"); },
  });
  await role6.link((specifier) => {
    if (specifier === "./lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs") return role2;
    if (specifier === "./lib/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package-contract.mjs") return role5;
    throw new Error("role 6 unexpected import " + specifier);
  });
  await role6.evaluate({ timeout: 1000 });
  return Object.freeze({ context, role2, role5, role6 });
}

let harnessCounter = 0;
async function invokePrimitive(graph, projectionJson) {
  harnessCounter += 1;
  const source = [
    "import { evaluatePostCheckpointToolchainK44Observation as evaluate } from " +
      JSON.stringify("./" + ROLE_PATHS[5].split("/").at(-1)) + ";",
    "let accepted = false;",
    "let result = null;",
    "let held = false;",
    "try {",
    "  result = evaluate(" + JSON.stringify(projectionJson) + ");",
    "  accepted = typeof result === 'string' && result.endsWith('\\n');",
    "} catch { held = true; }",
    "export { accepted, result, held };",
  ].join("\n");
  const harness = new vm.SourceTextModule(source, {
    context: graph.context,
    identifier: "iat-b3-bundle:/harness-" + harnessCounter + ".mjs",
  });
  await harness.link((specifier) => {
    if (specifier === "./" + ROLE_PATHS[5].split("/").at(-1)) return graph.role6;
    throw new Error("harness unexpected import " + specifier);
  });
  await harness.evaluate({ timeout: 1000 });
  return Object.freeze({
    accepted: harness.namespace.accepted,
    result: harness.namespace.result,
    held: harness.namespace.held,
  });
}

async function realmHostileProof(graph) {
  const source = [
    "import { canonicalJson, sha256HexUtf8 } from " +
      JSON.stringify("../scripts/lib/" + ROLE_PATHS[4].split("/").at(-1)) + ";",
    "const outcomes = [];",
    "const check = (factory) => { try { canonicalJson(factory()); outcomes.push(false); } catch { outcomes.push(true); } };",
    "check(() => { const v = {}; Object.defineProperty(v, 'hidden', { value: true }); return v; });",
    "check(() => { const v = {}; Object.defineProperty(v, 'x', { get() { return 1; }, enumerable: true }); return v; });",
    "check(() => { const v = {}; v[Symbol('x')] = true; return v; });",
    "check(() => { const v = []; v.length = 2; v[1] = true; return v; });",
    "check(() => { const child = {}; return { a: child, b: child }; });",
    "check(() => { const v = {}; v.self = v; return v; });",
    "check(() => ({ n: Number.MAX_SAFE_INTEGER + 1 }));",
    "check(() => ({ n: -0 }));",
    "let nestedClone = false;",
    "try { const cloned = structuredClone({ a: [{ b: true }] }); nestedClone = cloned.a[0].b === true; } catch {}",
    "export const proof = JSON.stringify({ outcomes, nestedClone, sha: sha256HexUtf8('abc') });",
  ].join("\n");
  const module = new vm.SourceTextModule(source, {
    context: graph.context,
    identifier: "iat-b3-bundle:/realm-hostile-proof.mjs",
  });
  await module.link((specifier) => {
    if (specifier === "../scripts/lib/" + ROLE_PATHS[4].split("/").at(-1)) return graph.role5;
    throw new Error("realm proof unexpected import " + specifier);
  });
  await module.evaluate({ timeout: 1000 });
  return JSON.parse(module.namespace.proof);
}

function mutate(value, callback) {
  const copy = structuredClone(value);
  callback(copy);
  return canonicalJson(copy);
}

function assertRecursiveStrictSchema(schema) {
  const seen = new Set();
  function walk(value, path) {
    if (value === null || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    if (value.type === "object") {
      assert.equal(value.additionalProperties, false, path);
      assert.ok(Array.isArray(value.required), path);
      assert.deepEqual(value.required, Object.keys(value.properties), path);
    }
    for (const [key, child] of Object.entries(value)) walk(child, path + "." + key);
  }
  walk(schema, "$schema");
}

test("exact Node24 VM flags are mandatory for the source-only graph", () => {
  assert.equal(process.version, "v24.19.0");
  assert.equal(process.execArgv.includes("--experimental-vm-modules"), true);
  assert.equal(process.execArgv.includes("--disable-warning=ExperimentalWarning"), true);
  assert.equal(typeof vm.SourceTextModule, "function");
  assert.equal(typeof vm.SyntheticModule, "function");
});

test("all seven captured files are regular LF-only immutable test inputs", () => {
  assert.equal(CAPTURED.length, 7);
  for (const row of CAPTURED) {
    const stat = statSync(new URL("../" + row.path, import.meta.url));
    assert.equal(stat.isFile(), true, row.path);
    assert.equal(row.bytes.at(-1), 0x0a, row.path);
    assert.equal(row.bytes.includes(Buffer.from("\r")), false, row.path);
    assert.equal(row.bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])), false, row.path);
  }
});

test("accepted BPO bytes and exact seven-role tuple are unchanged", () => {
  for (let index = 0; index < EXPECTED_BPO.length; index += 1) {
    assert.equal(CAPTURED[index].sha256, EXPECTED_BPO[index].sha256);
    assert.equal(CAPTURED[index].byteLength, EXPECTED_BPO[index].bytes);
  }
  assert.deepEqual(CAPTURED.map((row) => row.roleCode), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(CAPTURED.map((row) => row.fullPath), FULL_ROLE_PATHS);
});

test("role 5 is import-free and role 2 plus role 6 expose only the exact graph", async () => {
  const graph = await buildGraph();
  assert.deepEqual(Object.keys(graph.role5.namespace), [
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
  assert.deepEqual(Object.keys(graph.role2.namespace), [
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
  assert.deepEqual(Object.keys(graph.role6.namespace), [
    "SUPERVISED_TOOLCHAIN_K44_OBSERVER_ENTRY_CONTRACT",
    "default",
    "evaluatePostCheckpointToolchainK44Observation",
  ]);
  assert.deepEqual(graph.role5.moduleRequests.map((request) => request.specifier), []);
  assert.deepEqual(graph.role2.moduleRequests.map((request) => request.specifier), ["node:buffer", "node:util"]);
  assert.deepEqual(
    graph.role6.moduleRequests.map((request) => request.specifier),
    [
      "./lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs",
      "./lib/iat-b3-post-checkpoint-supervised-toolchain-k44-observer-package-contract.mjs",
    ],
  );
  const exportedEdges = JSON.parse(JSON.stringify(graph.role5.namespace.FRESH_SEVEN_PATH_RESOLVER_EDGE_MAP));
  assert.deepEqual(exportedEdges, EXPECTED_EDGES);
  for (const edge of exportedEdges) {
    assert.deepEqual(Object.keys(edge), ["fromRoleCode", "specifierKind", "specifier", "toRoleCodeOrZero"]);
  }
  const exportedEdgeIdentity = JSON.parse(
    JSON.stringify(graph.role5.namespace.FRESH_SEVEN_PATH_RESOLVER_EDGE_MAP_IDENTITY),
  );
  assert.deepEqual(Object.keys(exportedEdgeIdentity), [
    "domain",
    "exactRowFieldOrder",
    "edgeCount",
    "sha256",
    "unsignedDecimalSerializedByteLength",
  ]);
  assert.deepEqual(
    exportedEdgeIdentity,
    {
      domain: GRAPH_IDENTITY.domain,
      exactRowFieldOrder: [
        "fromRepoRelativePath",
        "specifier",
        "toRepoRelativePathOrBuiltin",
        "fromRoleCode",
        "toRoleCodeOrZero",
      ],
      edgeCount: GRAPH_IDENTITY.edgeCount,
      sha256: GRAPH_IDENTITY.sha256,
      unsignedDecimalSerializedByteLength: GRAPH_IDENTITY.unsignedDecimalSerializedByteLength,
    },
  );
  const invalidMutations = [
    EXPECTED_EDGES.map((edge, index) => index === 0 ? { ...edge, specifierKind: "RELATIVE_EXACT_REVIEWED_PATH_TO_ROLE" } : edge),
    EXPECTED_EDGES.map((edge, index) => index === 0 ? {
      fromRoleCode: edge.fromRoleCode,
      specifier: edge.specifier,
      toRoleCodeOrZero: edge.toRoleCodeOrZero,
    } : edge),
    EXPECTED_EDGES.map((edge, index) => index === 2 ? { ...edge, toRoleCodeOrZero: 0 } : edge),
  ];
  for (const mutation of invalidMutations) assert.throws(() => resolverEdgeMapIdentity(mutation));
  const validShapeWrongTarget = EXPECTED_EDGES.map((edge, index) =>
    index === 2 ? { ...edge, toRoleCodeOrZero: 5 } : edge);
  assert.notEqual(resolverEdgeMapIdentity(validShapeWrongTarget).sha256, GRAPH_SHA256);
});

test("checked-in schema is recursive strict and byte-identical to role 5 export", async () => {
  const graph = await buildGraph();
  const source = [
    "import { SUPERVISED_TOOLCHAIN_K44_OBSERVER_RECEIPT_JSON_SCHEMA as schema } from " +
      JSON.stringify("../scripts/lib/" + ROLE_PATHS[4].split("/").at(-1)) + ";",
    "export const json = JSON.stringify(schema);",
  ].join("\n");
  const module = new vm.SourceTextModule(source, {
    context: graph.context,
    identifier: "iat-b3-bundle:/schema-export.mjs",
  });
  await module.link((specifier) => {
    if (specifier === "../scripts/lib/" + ROLE_PATHS[4].split("/").at(-1)) return graph.role5;
    throw new Error("schema unexpected import");
  });
  await module.evaluate({ timeout: 1000 });
  const exported = JSON.parse(module.namespace.json);
  const checkedIn = JSON.parse(CAPTURED[3].bytes.toString("utf8"));
  assert.deepEqual(checkedIn, exported);
  assertRecursiveStrictSchema(checkedIn);
});

test("actual captured role 2 initializes, parses, and recreates under context-native facades", async () => {
  const graph = await buildGraph();
  const source = [
    "import * as bpo from " + JSON.stringify("../scripts/lib/" + ROLE_PATHS[1].split("/").at(-1)) + ";",
    "const canonical = bpo.canonicalPostCheckpointObserverSourceDesignJson(bpo.POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN);",
    "const parsed = bpo.parsePostCheckpointObserverSourceDesignJson(canonical);",
    "const created = bpo.createPostCheckpointObserverSourceDesign();",
    "export const proof = JSON.stringify({ bytes: canonical.length, parsed: parsed.schema, created: created.schema });",
  ].join("\n");
  const module = new vm.SourceTextModule(source, {
    context: graph.context,
    identifier: "iat-b3-bundle:/exact-bpo-proof.mjs",
  });
  await module.link((specifier) => {
    if (specifier === "../scripts/lib/" + ROLE_PATHS[1].split("/").at(-1)) return graph.role2;
    throw new Error("BPO proof unexpected import");
  });
  await module.evaluate({ timeout: 1000 });
  assert.deepEqual(JSON.parse(module.namespace.proof), {
    bytes: 6115,
    parsed: "iat-b3-post-checkpoint-observer-source-design/v1",
    created: "iat-b3-post-checkpoint-observer-source-design/v1",
  });
});

test("actual BPO and runner exercise context-native buffer, proxy, clone, and digest facades", async () => {
  const graph = await buildGraph();
  await invokePrimitive(graph, canonicalJson(projectionFixture()));
  const source = [
    "import { snapshotContextNativeFacadeCallCounts as snapshot } from " +
      JSON.stringify("../scripts/lib/" + ROLE_PATHS[4].split("/").at(-1)) + ";",
    "export const json = JSON.stringify(snapshot());",
  ].join("\n");
  const module = new vm.SourceTextModule(source, {
    context: graph.context,
    identifier: "iat-b3-bundle:/facade-counts.mjs",
  });
  await module.link((specifier) => {
    if (specifier === "../scripts/lib/" + ROLE_PATHS[4].split("/").at(-1)) return graph.role5;
    throw new Error("facade count unexpected import");
  });
  await module.evaluate({ timeout: 1000 });
  const counts = JSON.parse(module.namespace.json);
  assert.ok(counts.bufferByteLength > 0);
  assert.ok(counts.isProxy > 0);
  assert.ok(counts.structuredClone >= 3);
  assert.ok(counts.sha256HexUtf8 >= 3);
  assert.equal(counts.createHash, 0);
});

test("context-native SHA-256 facade matches exact UTF-8 differential vectors", async () => {
  const graph = await buildGraph();
  const vectors = ["", "abc", "IAT-B3-\ud83d\ude80", "a".repeat(1000), "\u0000\u007f\u0080\u07ff\u0800"];
  const source = [
    "import { createHash, sha256HexUtf8 } from " +
      JSON.stringify("../scripts/lib/" + ROLE_PATHS[4].split("/").at(-1)) + ";",
    "const vectors = " + JSON.stringify(vectors) + ";",
    "export const json = JSON.stringify(vectors.map((value) => ({",
    "  direct: sha256HexUtf8(value),",
    "  api: createHash('sha256').update(value).digest('hex'),",
    "})));",
  ].join("\n");
  const module = new vm.SourceTextModule(source, {
    context: graph.context,
    identifier: "iat-b3-bundle:/sha-differential.mjs",
  });
  await module.link((specifier) => {
    if (specifier === "../scripts/lib/" + ROLE_PATHS[4].split("/").at(-1)) return graph.role5;
    throw new Error("sha unexpected import");
  });
  await module.evaluate({ timeout: 1000 });
  const results = JSON.parse(module.namespace.json);
  for (let index = 0; index < vectors.length; index += 1) {
    const expected = sha256(Buffer.from(vectors[index], "utf8"));
    assert.equal(results[index].direct, expected);
    assert.equal(results[index].api, expected);
  }
});

test("valid exact graph emits only canonical primitive HOLD result with non-self digest", async () => {
  const graph = await buildGraph();
  const projectionJson = canonicalJson(projectionFixture());
  const invocation = await invokePrimitive(graph, projectionJson);
  assert.equal(invocation.accepted, true);
  assert.equal(invocation.held, false);
  const result = JSON.parse(invocation.result);
  assert.deepEqual(Object.keys(result), [
    "schema", "runId", "requestSha256", "bundleSha256", "graphSha256", "projectionSha256",
    "toolchainAccepted", "k44Accepted", "receiptPresent", "decision", "authority", "resultBodySha256",
  ]);
  assert.equal(result.schema, "iat-b3-post-checkpoint-prelaunch-supervisor-package-graph-result/v1");
  assert.equal(result.toolchainAccepted, false);
  assert.equal(result.k44Accepted, false);
  assert.equal(result.receiptPresent, false);
  assert.equal(result.decision, "HOLD");
  assert.equal(result.authority, "NONE");
  const { resultBodySha256, ...body } = result;
  const bodyJson = JSON.stringify(body) + "\n";
  assert.equal(
    resultBodySha256,
    sha256(Buffer.from("IAT_B3_BPS04_PACKAGE_GRAPH_RESULT_BODY_V1\0" + bodyJson, "utf8")),
  );
  assert.equal(
    result.projectionSha256,
    sha256(Buffer.from("IAT_B3_BPI01_SUPERVISED_PROJECTION_V1\0" + projectionJson, "utf8")),
  );
});

test("context plain-data membrane rejects hidden, accessor, symbol, sparse, shared, cyclic, and unsafe data", async () => {
  const proof = await realmHostileProof(await buildGraph());
  assert.deepEqual(proof.outcomes, [true, true, true, true, true, true, true, true]);
  assert.equal(proof.nestedClone, true);
  assert.equal(proof.sha, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("exact role 5 facade rejects every host object, function, proxy, error, promise, and thenable crossing", async () => {
  const graph = await buildGraph();
  let nullPrototypeProxyTrapCount = 0;
  const hostNullPrototype = Object.create(null);
  const hostNullPrototypeProxy = new Proxy(Object.create(null), {
    getPrototypeOf() {
      nullPrototypeProxyTrapCount += 1;
      return null;
    },
  });
  const hostValues = [
    {},
    hostNullPrototype,
    () => true,
    new Proxy({}, {}),
    hostNullPrototypeProxy,
    new Error("host"),
    Promise.resolve(true),
    { then() { return true; } },
  ];
  for (const value of hostValues) {
    assert.throws(() => graph.role5.namespace.types.isProxy(value), /foreign, host, or non-plain/u);
    assert.throws(() => graph.role5.namespace.canonicalJson(value), /foreign|expected plain JSON data/u);
    assert.throws(() => graph.context.structuredClone(value), /foreign|expected plain JSON data/u);
  }
  assert.equal(nullPrototypeProxyTrapCount, 3);
});

test("canonical parser rejects whitespace, duplicate keys, escaped keys, BOM, CR, NUL, and missing LF", async () => {
  const graph = await buildGraph();
  const valid = canonicalJson(projectionFixture());
  const attacks = [
    valid.slice(0, -1),
    "\ufeff" + valid,
    valid.replace("\n", "\r\n"),
    valid.replace('{"authority"', '{ "authority"'),
    valid.replace('"authority":', '"authority":{},"authority":'),
    valid.replace('"authority"', '"\\u0061uthority"'),
    valid.slice(0, -1) + "\0\n",
  ];
  for (const hostile of attacks) {
    const invocation = await invokePrimitive(graph, hostile);
    assert.equal(invocation.accepted, false);
    assert.equal(invocation.held, true);
  }
});

test("stale, future, reversed, extended, and cross-run window substitutions fail closed", async () => {
  const graph = await buildGraph();
  const fixture = projectionFixture();
  const attacks = [
    mutate(fixture, (value) => { value.window.observedMonotonicNs = "999999999"; }),
    mutate(fixture, (value) => { value.window.observedMonotonicNs = "1000000200"; }),
    mutate(fixture, (value) => { value.window.deadlineMonotonicNs = "999999999"; }),
    mutate(fixture, (value) => { value.window.deadlineMonotonicNs = "160000000001"; }),
    mutate(fixture, (value) => { value.runId = "../cross-run"; }),
    mutate(fixture, (value) => { value.bootId = "00000000-0000-4000-8000-000000000002"; value.sessionId = "x"; }),
  ];
  for (const hostile of attacks) {
    const invocation = await invokePrimitive(graph, hostile);
    assert.equal(invocation.held, true);
  }
});

test("package source, path, role, mode, size, and accepted BPO substitutions fail closed", async () => {
  const graph = await buildGraph();
  const fixture = projectionFixture();
  const attacks = [
    mutate(fixture, (value) => { value.package.entries[0].sha256 = "f".repeat(64); }),
    mutate(fixture, (value) => { value.package.entries[3].path += ".alias"; }),
    mutate(fixture, (value) => { value.package.entries[4].roleCode = 6; }),
    mutate(fixture, (value) => { value.package.entries[5].mode = "100755"; }),
    mutate(fixture, (value) => { value.package.entries[6].byteLength = "2147483649"; }),
    mutate(fixture, (value) => { value.package.entries.reverse(); }),
    mutate(fixture, (value) => { value.package.entries.push(value.package.entries[6]); }),
  ];
  for (const hostile of attacks) {
    const invocation = await invokePrimitive(graph, hostile);
    assert.equal(invocation.held, true);
  }
});

test("toolchain, K44, receipt, and authority promotion attempts fail closed", async () => {
  const graph = await buildGraph();
  const fixture = projectionFixture();
  const attacks = [
    mutate(fixture, (value) => { value.toolchains[0].accepted = true; }),
    mutate(fixture, (value) => { value.toolchains[1].observation = {}; }),
    mutate(fixture, (value) => { value.k44.accepted = true; }),
    mutate(fixture, (value) => { value.k44.assessment = {}; }),
    mutate(fixture, (value) => { value.k44.directFlags.wallClockDirectlyObservedByThisModule = true; }),
    mutate(fixture, (value) => { value.authority.devnetAuthorized = true; }),
    mutate(fixture, (value) => { value.receipt = {}; }),
  ];
  for (const hostile of attacks) {
    const invocation = await invokePrimitive(graph, hostile);
    assert.equal(invocation.held, true);
  }
});

test("unknown, missing, malformed, and unsafe scalar fields fail closed", async () => {
  const graph = await buildGraph();
  const fixture = projectionFixture();
  const attacks = [
    mutate(fixture, (value) => { value.unknown = true; }),
    mutate(fixture, (value) => { delete value.sessionId; }),
    mutate(fixture, (value) => { value.requestSha256 = "A".repeat(64); }),
    mutate(fixture, (value) => { value.package.commitSha = "g".repeat(40); }),
    mutate(fixture, (value) => { value.window.openedMonotonicNs = "01"; }),
    mutate(fixture, (value) => { value.package.manifestByteLength = "0"; }),
  ];
  for (const hostile of attacks) {
    const invocation = await invokePrimitive(graph, hostile);
    assert.equal(invocation.held, true);
  }
});

test("source substitutions and loader-edge escapes cannot enter the captured graph", async () => {
  const role5 = CAPTURED[4].source;
  const runner = CAPTURED[5].source;
  const mutations = [
    [5, role5 + "\nimport('node:fs');\n"],
    [5, role5.replace("export const Buffer", "import x from 'node:fs';\nexport const Buffer")],
    [6, runner.replace("./lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs", "../alias.mjs")],
    [6, runner + "\nvoid import('./dynamic.mjs');\n"],
    [6, runner + "\nvoid import.meta.url;\n"],
    [6, runner + "\nawait Promise.resolve();\n"],
  ];
  for (const [role, source] of mutations) {
    const expected = CAPTURED[role - 1];
    assert.notEqual(sha256(Buffer.from(source, "utf8")), expected.sha256);
    await assert.rejects(buildGraph(new Map([[role, source]])), /source identity mismatch/u);
  }
  assert.equal(role5.includes("node:fs"), false);
  assert.equal(runner.includes("node:fs"), false);
  assert.equal(runner.includes("node:child_process"), false);
  assert.equal(runner.includes("process."), false);
  assert.equal(runner.includes("import("), false);
  assert.equal(runner.includes("import.meta"), false);
});

test("source truth is entirely null, false, HOLD, and NONE", async () => {
  const graph = await buildGraph();
  const source = [
    "import { SUPERVISED_TOOLCHAIN_K44_PACKAGE_SOURCE_TRUTH as truth } from " +
      JSON.stringify("../scripts/lib/" + ROLE_PATHS[4].split("/").at(-1)) + ";",
    "export const json = JSON.stringify(truth);",
  ].join("\n");
  const module = new vm.SourceTextModule(source, {
    context: graph.context,
    identifier: "iat-b3-bundle:/source-truth.mjs",
  });
  await module.link((specifier) => {
    if (specifier === "../scripts/lib/" + ROLE_PATHS[4].split("/").at(-1)) return graph.role5;
    throw new Error("truth unexpected import");
  });
  await module.evaluate({ timeout: 1000 });
  const truth = JSON.parse(module.namespace.json);
  assert.equal(truth.status, "HOLD_SOURCE_PACKAGE_ONLY");
  for (const [key, value] of Object.entries(truth)) {
    if (key.startsWith("actual")) assert.equal(value, null, key);
    if (key.endsWith("Authorized")) assert.equal(value, false, key);
  }
  assert.equal(truth.toolchainAccepted, false);
  assert.equal(truth.k44Accepted, false);
  assert.equal(truth.receiptPresent, false);
  assert.equal(truth.decision, "HOLD");
  assert.equal(truth.authority, "NONE");
});

test("accepted BPS manifests and reviews plus rejected null-outcome drafts are frozen exact", async () => {
  const graph = await buildGraph();
  const source = [
    "import { BPI01_PREDECESSOR_BINDINGS as bindings } from " +
      JSON.stringify("../scripts/lib/" + ROLE_PATHS[4].split("/").at(-1)) + ";",
    "let mutationRejected = false;",
    "try { bindings.accepted[0].manifestSha256 = '0'.repeat(64); } catch { mutationRejected = true; }",
    "export const json = JSON.stringify({ bindings, mutationRejected });",
  ].join("\n");
  const module = new vm.SourceTextModule(source, {
    context: graph.context,
    identifier: "iat-b3-bundle:/predecessor-bindings.mjs",
  });
  await module.link((specifier) => {
    if (specifier === "../scripts/lib/" + ROLE_PATHS[4].split("/").at(-1)) return graph.role5;
    throw new Error("predecessor unexpected import");
  });
  await module.evaluate({ timeout: 1000 });
  const proof = JSON.parse(module.namespace.json);
  assert.equal(proof.mutationRejected, true);
  assert.deepEqual(
    proof.bindings.accepted.map((entry) => [
      entry.taskId,
      entry.manifestSha256,
      entry.manifestByteLength,
      entry.pathCount,
      entry.payloadByteLength,
      entry.reviewTaskId,
      entry.reviewOutcome,
    ]),
    [
      [
        "BPO00", "395d97b87e2faaf91ece3845ecd26370f1fcae2b5ddcffab1f3a543c6c9c08f9",
        521, 3, 37833, "BPO00R", "POST_CHECKPOINT_TOOLCHAIN_K44_OBSERVER_SOURCE_DESIGN_REVIEW_ACCEPTED",
      ],
      [
        "BPS00", "83a99ef694d4e1c7e6b364a0a768999cc73fd3911fea23ea6347ba5cfa7b1c8a",
        607, 3, 403564, "BPS00R", "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_SOURCE_DESIGN_REVIEW_ACCEPTED",
      ],
      [
        "BPS02", "4bd831835fdd0244c1331d1af3b841dc154fc7e8cecd2ca53f6d65deb7cf47d6",
        677, 3, 93192, "BPS02R",
        "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_FD_BRIDGE_SOURCE_DESIGN_AMENDMENT_REVIEW_ACCEPTED",
      ],
      [
        "BPS04", "82d1563897dcf41f7f8f168741563231d17422a5c42e36a2e5d6e05516949832",
        679, 3, 244603, "BPS04R",
        "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BUNDLE_TRANSPORT_SOURCE_DESIGN_AMENDMENT_REVIEW_ACCEPTED",
      ],
    ],
  );
  assert.deepEqual(
    proof.bindings.rejectedDrafts.map((entry) => [
      entry.taskId, entry.status, entry.outcome, entry.acceptedAsInput, entry.files.length, entry.absentPaths.length,
    ]),
    [
      ["BPI00", "BLOCKED_GATE", null, false, 4, 0],
      ["BPS01", "BLOCKED_GATE", null, false, 5, 1],
      ["BPS03", "BLOCKED_GATE", null, false, 4, 2],
    ],
  );
  for (const draft of proof.bindings.rejectedDrafts) {
    for (const file of draft.files) {
      assert.match(file.path, /^projects\/star-ascent\/site\/(?:docs|native|scripts|tests)\//u);
      assert.match(file.sha256, /^[0-9a-f]{64}$/u);
      assert.ok(Number.isSafeInteger(file.byteLength) && file.byteLength > 0);
    }
    for (const path of draft.absentPaths) {
      assert.match(path, /^projects\/star-ascent\/site\/(?:native|tests)\//u);
    }
  }
  assert.equal(
    new Set(proof.bindings.rejectedDrafts.flatMap((entry) => [
      ...entry.files.map((file) => file.path),
      ...entry.absentPaths,
    ])).size,
    16,
  );
  assert.equal(proof.bindings.rejectedDraftBytesMayBeReadImportedExecutedCopiedOrCheckpointed, false);
  assert.equal(proof.bindings.acceptedPackageMayInferAnyIdentityOrOutcomeFromRejectedDrafts, false);
});

test("four-new and combined-seven portable manifests are deterministic and disjoint from blocked drafts", () => {
  assert.equal(FOUR_MANIFEST.count, 4);
  assert.equal(SEVEN_MANIFEST.count, 7);
  assert.equal(sha256(FOUR_MANIFEST.bytes), FOUR_MANIFEST.sha256);
  assert.equal(sha256(SEVEN_MANIFEST.bytes), SEVEN_MANIFEST.sha256);
  const blockedPaths = new Set([
    "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-toolchain-k44-observer-receipt.v1.schema.json",
    "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-toolchain-k44-observer-contract.mjs",
    "projects/star-ascent/site/scripts/observe-iat-b3-post-checkpoint-toolchain-k44.mjs",
    "projects/star-ascent/site/tests/iat-b3-post-checkpoint-toolchain-k44-observer.test.mjs",
    "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-bootstrap-descriptor.v1.schema.json",
    "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-runtime-anchor.v1.schema.json",
    "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-runtime-evidence.v1.schema.json",
    "projects/star-ascent/site/native/iat-b3-post-checkpoint-prelaunch-supervisor/src/iat_b3_post_checkpoint_prelaunch_supervisor.c",
    "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-launcher.mjs",
    "projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-source.test.mjs",
    "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-fd-bridge-bootstrap-descriptor.v1.schema.json",
    "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-fd-bridge-runtime-anchor.v1.schema.json",
    "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-fd-bridge-runtime-evidence.v1.schema.json",
    "projects/star-ascent/site/native/iat-b3-post-checkpoint-prelaunch-supervisor-fd-bridge/src/iat_b3_post_checkpoint_prelaunch_supervisor_fd_bridge.c",
    "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-fd-bridge-launcher.mjs",
    "projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-fd-bridge-source.test.mjs",
  ]);
  for (const row of CAPTURED.slice(3)) assert.equal(blockedPaths.has(row.path), false, row.path);
});

test("entry is mandatory synchronous, nonthenable, primitive-only, and permanently nonauthorizing", async () => {
  const graph = await buildGraph();
  const invocation = await invokePrimitive(graph, canonicalJson(projectionFixture()));
  assert.equal(typeof invocation.result, "string");
  assert.equal(invocation.result && typeof invocation.result.then, "undefined");
  const result = JSON.parse(invocation.result);
  assert.equal(Object.values(result).some((value) => value && typeof value === "object"), false);
  assert.deepEqual(
    [result.toolchainAccepted, result.k44Accepted, result.receiptPresent, result.decision, result.authority],
    [false, false, false, "HOLD", "NONE"],
  );
});

test("no package source exposes file, process, network, persistence, or authorization capability", () => {
  const packageSources = [CAPTURED[4].source, CAPTURED[5].source].join("\n");
  const forbidden = [
    "node:" + "fs",
    "node:" + "path",
    "node:" + "child_process",
    "node:" + "net",
    "node:" + "http",
    "node:" + "https",
    "node:" + "worker_threads",
    "process." + "getBuiltinModule",
    "process." + "binding",
    "import." + "meta",
  ];
  for (const token of forbidden) assert.equal(packageSources.includes(token), false, token);
});

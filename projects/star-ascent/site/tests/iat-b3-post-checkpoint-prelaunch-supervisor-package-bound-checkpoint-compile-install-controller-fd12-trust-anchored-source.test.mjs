import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BPS09_BPC03_BINDING,
  BPS09_BPK00_BINDING,
  BPS09_BPS06_BINDING,
  BPS09_CAPABILITY_MATRIX,
  BPS09_DOCUMENT_KINDS,
  BPS09_JSON_SCHEMA,
  BPS09_PATHS,
  BPS09_SCHEMA_ID,
  BPS09_SOURCE_CANONICAL_BYTES,
  BPS09_SOURCE_CANONICAL_SHA256,
  BPS09_SOURCE_CONTRACT,
  BPS09_STATUS,
  createBps09SourceContract,
  parseCanonicalBps09Document,
  validateBps09CompileBootstrap,
  validateBps09CompileEvidence,
  validateBps09Document,
  validateBps09InstallBootstrap,
  validateBps09InstallEvidence,
  validateBps09RecoveryBootstrap,
  validateBps09RecoveryEvidence,
  validateBps09SourceContract,
  validateBps09ToolchainManifest,
} from "../scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored-contract.mjs";
import {
  compareIndependentArtifactSet,
} from "../scripts/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-executor-fd12-trust-anchored.mjs";

const SCHEMA_PATH = new URL(
  "../docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored.v1.schema.json",
  import.meta.url,
);
const CONTRACT_PATH = new URL(
  "../scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored-contract.mjs",
  import.meta.url,
);
const COMPILE_EXECUTOR_PATH = new URL(
  "../scripts/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-executor-fd12-trust-anchored.mjs",
  import.meta.url,
);
const INSTALL_CONTROLLER_PATH = new URL(
  "../native/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-install-controller-fd12-trust-anchored/src/iat_b3_post_checkpoint_prelaunch_supervisor_package_bound_checkpoint_install_controller_fd12_trust_anchored.c",
  import.meta.url,
);
const TEST_PATH = new URL(
  "./iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored-source.test.mjs",
  import.meta.url,
);

const EXPECTED_PATHS = Object.freeze([
  "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored.v1.schema.json",
  "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored-contract.mjs",
  "projects/star-ascent/site/scripts/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-executor-fd12-trust-anchored.mjs",
  "projects/star-ascent/site/native/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-install-controller-fd12-trust-anchored/src/iat_b3_post_checkpoint_prelaunch_supervisor_package_bound_checkpoint_install_controller_fd12_trust_anchored.c",
  "projects/star-ascent/site/tests/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored-source.test.mjs",
]);

const EXPECTED_BPS06 = Object.freeze({
  sha256: "9f36884b53aa4646739b24e9829c69abd9a964a2ebc01934bc9217f78faafd7c",
  byteLength: 682,
  pathCount: 3,
  payloadByteLength: 345346,
  reviewOutcome: "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_CHECKPOINT_COMPILE_INSTALL_SOURCE_DESIGN_AMENDMENT_REVIEW_ACCEPTED",
});

const EXPECTED_BPC03 = Object.freeze({
  taskId: "BPC03R",
  commit: "85d72e43869d3de7bab0e27005ba1cb95354c12a",
  tree: "6d4418655aa67d6516d18cff9a78c796f599f11b",
  manifestSha256: "caf0fd1ae601e337e86445497576339400605a817ba769d038605e7cb14c7d9a",
  reviewOutcome: "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_COMPILE_PEER_TRUST_ANCHOR_SOURCE_CHECKPOINT_REVIEW_ACCEPTED",
});

const EXPECTED_BPK00 = Object.freeze({
  taskId: "BPK00",
  commit: "512b347ebf4de80bf5a50e0d8491f14eeef0f9f0",
  tree: "c4e8e6ca1c54e9154743dd2fea7b434307d74676",
  path: "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd12-owner-root-public-key-anchor.v1.json",
  blobSha1: "8e38e773ed4f11a4aefd8787c63c535775056c1a",
  fileSha256: "7865d0fb44465fbce2100af78d2392b3bc29a2f4a7ff2969b501bc2a0134bb21",
  byteLength: 1001,
  schema: "iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-fd12-owner-root-public-key-anchor/v1",
  producer: "BPK00",
  outcome: "POST_CHECKPOINT_PRELAUNCH_SUPERVISOR_PACKAGE_BOUND_FD12_OWNER_ROOT_PUBLIC_KEY_ANCHOR_CHECKPOINT_COMMITTED",
  bps08ManifestSha256: "9e9679a7e5da6ee9b80b7774e219b91d4ca3c914a2b2fcd2459770a9e0a524ce",
  rootPublicKeyHex: "60fa8f2c48a8bc6d2ad476b094bb2f569f020211bf834deb144d2e2958ac4230",
  rootFingerprintSha256: "49e4e1637075a367448705ea703628f045cde70c489286b84d1db8f5697557f1",
  ownerProvisioningReceiptSha256: "3e1aa94f5203e882155d953e77f1036bb418929b5d6ddc5fe80070a4a0898f3a",
  decision: "HOLD",
  authority: "NONE",
});

const DOCUMENT_VALIDATORS = Object.freeze([
  validateBps09ToolchainManifest,
  validateBps09CompileBootstrap,
  validateBps09CompileEvidence,
  validateBps09InstallBootstrap,
  validateBps09InstallEvidence,
  validateBps09RecoveryBootstrap,
  validateBps09RecoveryEvidence,
]);

const EXPECTED_DOCUMENT_KINDS = Object.freeze([
  "TOOLCHAIN_MANIFEST",
  "COMPILE_BOOTSTRAP",
  "COMPILE_EVIDENCE",
  "INSTALL_BOOTSTRAP",
  "INSTALL_EVIDENCE",
  "RECOVERY_BOOTSTRAP",
  "RECOVERY_EVIDENCE",
]);

const OWNER_ROOT_PUBLIC_KEY_HEX = EXPECTED_BPK00.rootPublicKeyHex;
const OWNER_ROOT_FINGERPRINT_SHA256 = EXPECTED_BPK00.rootFingerprintSha256;
const OWNER_PROVISIONING_RECEIPT_SHA256 = EXPECTED_BPK00.ownerProvisioningReceiptSha256;
const OCMS_PREFIX_HEX = "ff736f6c616e61206f6666636861696e";
const OCMS_BODY_PREFIX = "IAT_B3_BPS08_COMPILE_PEER_ANCHOR_V1:";
const OLD_GENERIC_COMPILE_REVIEW_OUTCOME = "POST_CHECKPOINT_PACKAGE_BOUND_DETERMINISTIC_COMPILE_ARTIFACT_REVIEW_ACCEPTED_HOLD";
const FD12_TRUST_ANCHORED_COMPILE_REVIEW_OUTCOME = "POST_CHECKPOINT_PACKAGE_BOUND_FD12_TRUST_ANCHORED_DETERMINISTIC_COMPILE_ARTIFACT_REVIEW_ACCEPTED_HOLD";
const EXPECTED_BPC01_LINEAGE = Object.freeze({
  commit: "fd47774fe6523e181b792d187a4bae708f96ad9d",
  tree: "1a81c083b9207eaa6f0d4dd74c4c562aa9268201",
  manifestSha256: "504e093893403af28e7291c49cdb5bbd6a387810d438359973ff3070ac897513",
});

function clone(value) {
  return structuredClone(value);
}

function canonicalBytes(value) {
  return Buffer.from(`${JSON.stringify(value)}\n`, "utf8");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function digestFor(label) {
  return sha256(Buffer.from(`BPS09_TEST_OBSERVATION\0${label}`, "utf8"));
}

function ownEnumerableKeys(value) {
  return Reflect.ownKeys(value).filter((key) => Object.prototype.propertyIsEnumerable.call(value, key));
}

function containerPaths(value, path = [], output = []) {
  if (value === null || typeof value !== "object") return output;
  output.push(path);
  if (Array.isArray(value)) {
    value.forEach((child, index) => containerPaths(child, [...path, index], output));
  } else {
    Object.entries(value).forEach(([key, child]) => containerPaths(child, [...path, key], output));
  }
  return output;
}

function valueAtPath(value, path) {
  return path.reduce((current, key) => current[key], value);
}

function cKeySequence(keys) {
  return new RegExp(keys.map((key) => `"${key}"`).join("\\s*,\\s*"), "u");
}

function leafPaths(value, predicate, path = [], output = []) {
  if (value === null || typeof value !== "object") {
    if (predicate(path, value)) output.push(path);
    return output;
  }
  Object.entries(value).forEach(([key, child]) => leafPaths(child, predicate, [...path, key], output));
  return output;
}

function materializeDocument(kind) {
  const candidate = clone(BPS09_SOURCE_CONTRACT.documentTemplates[kind]);
  function visit(value, location) {
    if (Array.isArray(value)) return value.map((entry, index) => visit(entry, `${location}[${index}]`));
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child, `${location}.${key}`)]));
    }
    if (value === "0".repeat(64)) return digestFor(location);
    if (value === "0") return "1";
    if (typeof value === "string" && value.startsWith("/unresolved/")) {
      return value.replace("/unresolved/", "/externally-observed/").replaceAll("UNRESOLVED_", "OBSERVED_");
    }
    if (typeof value === "string" && value.includes("UNRESOLVED_")) return value.replaceAll("UNRESOLVED_", "OBSERVED_");
    return value;
  }
  const observed = visit(candidate, kind);
  if (kind === "COMPILE_BOOTSTRAP") {
    observed.fd12TrustAnchor.nlink = "0";
    observed.fd12TrustAnchor.uid = "0";
  }
  const identifiers = {
    attemptId: "OBSERVED_ATTEMPT",
    runId: "OBSERVED_RUN",
    sessionId: "OBSERVED_SESSION",
  };
  function alignIdentifiers(value) {
    if (Array.isArray(value)) {
      value.forEach(alignIdentifiers);
      return;
    }
    if (value !== null && typeof value === "object") {
      if (Object.hasOwn(value, "attemptId")) Object.assign(value, identifiers);
      Object.values(value).forEach(alignIdentifiers);
    }
  }
  alignIdentifiers(observed);

  if (kind === "COMPILE_EVIDENCE") {
    for (const role of ["target", "installer"]) {
      observed.attemptB[role].sha256 = observed.attemptA[role].sha256;
      observed.attemptB[role].byteLength = observed.attemptA[role].byteLength;
    }
    for (const key of ["objectMapSha256", "linkMapSha256", "diagnosticsSha256"]) {
      observed.attemptB[key] = observed.attemptA[key];
    }
  }
  if (kind === "INSTALL_BOOTSTRAP") {
    observed.compileReviewReceipt.subjectSha256 = createHash("sha256")
      .update("IAT_B3_BPS09_COMPILE_ARTIFACT_PAIR_V1\0", "utf8")
      .update(canonicalBytes(observed.targetArtifact))
      .update(canonicalBytes(observed.installerArtifact))
      .digest("hex");
  }
  if (kind === "INSTALL_EVIDENCE") {
    observed.finalArtifact.sha256 = observed.sourceArtifact.sha256;
    observed.finalArtifact.byteLength = observed.sourceArtifact.byteLength;
    const subject = createHash("sha256")
      .update("IAT_B3_BPS09_INSTALLED_FINAL_V1\0", "utf8")
      .update(canonicalBytes(observed.finalArtifact))
      .digest("hex");
    observed.publicationReceipt.subjectSha256 = subject;
    observed.custodyReceipt.subjectSha256 = subject;
  }
  if (kind === "RECOVERY_BOOTSTRAP") {
    observed.actualPriorReceipt.subjectSha256 = createHash("sha256")
      .update("IAT_B3_BPS09_RECOVERY_LEDGER_V2\0", "utf8")
      .update(canonicalBytes({
        identityLedger: observed.identityLedger,
        tempName: observed.tempName,
        finalName: observed.finalName,
      }))
      .digest("hex");
  }
  if (kind === "RECOVERY_EVIDENCE") {
    const receipts = [
      ["abortCasReceipt", "ABORT_CAS", {
        attemptId: observed.attemptId,
        runId: observed.runId,
        sessionId: observed.sessionId,
        bootstrapSha256: observed.bootstrapSha256,
      }],
      ["cleanupReceipt", "IDENTITY_LED_CLEANUP", {
        attemptId: observed.attemptId,
        runId: observed.runId,
        sessionId: observed.sessionId,
        bootstrapSha256: observed.bootstrapSha256,
        abortReceiptSha256: observed.abortCasReceipt.sha256,
      }],
      ["parentFsyncReceipt", "PARENT_FSYNC_AND_ZERO", {
        attemptId: observed.attemptId,
        runId: observed.runId,
        sessionId: observed.sessionId,
        bootstrapSha256: observed.bootstrapSha256,
        abortReceiptSha256: observed.abortCasReceipt.sha256,
        cleanupReceiptSha256: observed.cleanupReceipt.sha256,
        zeroProof: observed.zeroProof,
      }],
    ];
    for (const [key, purpose, projection] of receipts) {
      observed[key].subjectSha256 = createHash("sha256")
        .update(`IAT_B3_BPS09_RECOVERY_${purpose}_V1\0`, "utf8")
        .update(canonicalBytes(projection))
        .digest("hex");
    }
  }
  return observed;
}

function assertClosedSchema(node, location = "$") {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((child, index) => assertClosedSchema(child, `${location}[${index}]`));
    return;
  }
  assert.equal(Object.hasOwn(node, "anyOf"), false, `${location} cannot use anyOf`);
  if (node.type === "object") {
    assert.equal(node.additionalProperties, false, `${location} must be closed`);
    assert.deepEqual([...(node.required ?? [])].sort(), Object.keys(node.properties ?? {}).sort(), `${location} required parity`);
  }
  if (node.type === "array") {
    assert.ok(Object.hasOwn(node, "maxItems"), `${location} array bound`);
    if (Array.isArray(node.prefixItems)) {
      assert.equal(node.items, false, `${location} exact tuple`);
      assert.equal(node.minItems, node.prefixItems.length, `${location} tuple minimum`);
      assert.equal(node.maxItems, node.prefixItems.length, `${location} tuple maximum`);
    }
  }
  for (const [key, child] of Object.entries(node)) {
    if (!["const", "enum", "default", "examples"].includes(key)) assertClosedSchema(child, `${location}.${key}`);
  }
}

function assertTextInOrder(source, tokens, label) {
  let cursor = -1;
  for (const token of tokens) {
    const next = source.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `${label}: missing or reordered ${token}`);
    cursor = next;
  }
}

function extractFunctionBody(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const patterns = [
    new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${escaped}\\s*\\([^;{}]*\\)\\s*\\{`, "u"),
    new RegExp(`(?:static\\s+)?(?:int|void|bool|long|ssize_t|size_t)\\s+${escaped}\\s*\\([^;{}]*\\)\\s*\\{`, "u"),
  ];
  const match = patterns.map((pattern) => pattern.exec(source)).find(Boolean);
  assert.ok(match, `missing function ${name}`);
  const open = source.indexOf("{", match.index);
  assert.ok(open >= 0, `missing body ${name}`);
  let depth = 0;
  let quote = null;
  let lineComment = false;
  let blockComment = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote !== null) {
      if (char === "\\") index += 1;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
    } else if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
    } else if (["\"", "'", "`"].includes(char)) {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  assert.fail(`unterminated function ${name}`);
}

function makeOcmsV1Bytes(subjectSha256, signerPublicKeyHex = OWNER_ROOT_PUBLIC_KEY_HEX) {
  assert.match(subjectSha256, /^[0-9a-f]{64}$/u);
  assert.match(signerPublicKeyHex, /^[0-9a-f]{64}$/u);
  const prefix = Buffer.from(OCMS_PREFIX_HEX, "hex");
  const signer = Buffer.from(signerPublicKeyHex, "hex");
  const body = Buffer.from(`${OCMS_BODY_PREFIX}${subjectSha256}`, "utf8");
  return Buffer.concat([prefix, Buffer.from([1, 1]), signer, body]);
}

function assertBindingTokens(binding, tokens, label) {
  const encoded = JSON.stringify(binding);
  for (const token of tokens) assert.match(encoded, new RegExp(token, "u"), `${label} missing ${token}`);
}

function mutateEveryNamedLeaf(candidate, keyPattern, replacement, validate, label) {
  const paths = leafPaths(candidate, (path) => keyPattern.test(String(path.at(-1))));
  assert.ok(paths.length > 0, `${label} mutation fields exist`);
  for (const path of paths) {
    const hostile = clone(candidate);
    const parent = valueAtPath(hostile, path.slice(0, -1));
    parent[path.at(-1)] = replacement(valueAtPath(hostile, path));
    assert.throws(() => validate(hostile), `${label}: ${path.join(".")}`);
  }
}

test("BPS09 binds exactly five new paths with no predecessor path import", async () => {
  assert.equal(BPS09_SCHEMA_ID, "iat-b3-post-checkpoint-prelaunch-supervisor-package-bound-checkpoint-compile-install-controller-fd12-trust-anchored/v1");
  assert.equal(BPS09_STATUS, "HOLD_SOURCE_ONLY");
  assert.deepEqual(BPS09_PATHS, EXPECTED_PATHS);
  assert.equal(BPS09_PATHS.length, 5);
  assert.equal(new Set(BPS09_PATHS).size, 5);
  const testSource = await readFile(TEST_PATH, "utf8");
  assert.doesNotMatch(testSource, /checkpoint-compile-install-controller-contract\.mjs/u);
  assert.doesNotMatch(testSource, /checkpoint-compile-executor\.mjs/u);
  assert.doesNotMatch(testSource, /checkpoint-install-controller\/src/u);
});

test("BPS06, BPC03, and corrected BPK00 bindings are exact and non-substitutable", () => {
  assert.deepEqual(BPS09_BPS06_BINDING, EXPECTED_BPS06);
  assert.deepEqual(BPS09_BPC03_BINDING, EXPECTED_BPC03);
  assert.deepEqual(BPS09_BPK00_BINDING, EXPECTED_BPK00);
  assert.equal(BPS09_BPC03_BINDING.commit, EXPECTED_BPC03.commit);
  assert.equal(BPS09_BPC03_BINDING.tree, EXPECTED_BPC03.tree);
  assert.equal(BPS09_BPC03_BINDING.manifestSha256, EXPECTED_BPC03.manifestSha256);
  assert.equal(BPS09_BPK00_BINDING.commit, EXPECTED_BPK00.commit);
  assert.equal(BPS09_BPK00_BINDING.tree, EXPECTED_BPK00.tree);
  assert.equal(BPS09_BPK00_BINDING.fileSha256, EXPECTED_BPK00.fileSha256);
  assert.equal(BPS09_BPK00_BINDING.rootPublicKeyHex, OWNER_ROOT_PUBLIC_KEY_HEX);
  assert.equal(BPS09_BPK00_BINDING.rootFingerprintSha256, OWNER_ROOT_FINGERPRINT_SHA256);
  assert.equal(BPS09_BPK00_BINDING.ownerProvisioningReceiptSha256, OWNER_PROVISIONING_RECEIPT_SHA256);
  assert.equal(sha256(Buffer.from(OWNER_ROOT_PUBLIC_KEY_HEX, "hex")), OWNER_ROOT_FINGERPRINT_SHA256);
});

test("canonical source bytes, clone validation, and binding substitutions fail closed", () => {
  const created = createBps09SourceContract();
  assert.deepEqual(created, BPS09_SOURCE_CONTRACT);
  assert.deepEqual(Buffer.from(BPS09_SOURCE_CANONICAL_BYTES), canonicalBytes(BPS09_SOURCE_CONTRACT));
  assert.equal(BPS09_SOURCE_CANONICAL_SHA256, sha256(Buffer.from(BPS09_SOURCE_CANONICAL_BYTES)));
  assert.doesNotThrow(() => validateBps09SourceContract(created));

  for (const [section, key] of [
    ["bps06Binding", "sha256"],
    ["bpc03Binding", "commit"],
    ["bpc03Binding", "tree"],
    ["bpc03Binding", "manifestSha256"],
    ["bpk00Binding", "commit"],
    ["bpk00Binding", "tree"],
    ["bpk00Binding", "fileSha256"],
    ["bpk00Binding", "rootPublicKeyHex"],
    ["bpk00Binding", "rootFingerprintSha256"],
    ["bpk00Binding", "ownerProvisioningReceiptSha256"],
  ]) {
    const hostile = createBps09SourceContract();
    hostile[section][key] = "00".repeat(32);
    assert.throws(() => validateBps09SourceContract(hostile), `${section}.${key}`);
  }
  const unknown = createBps09SourceContract();
  unknown.unreviewedAuthority = true;
  assert.throws(() => validateBps09SourceContract(unknown));
  assert.throws(() => validateBps09SourceContract(new Proxy(created, {})));
  assert.throws(() => validateBps09SourceContract(Object.assign(Object.create(null), created)));
  const accessor = createBps09SourceContract();
  Object.defineProperty(accessor, "status", { enumerable: true, get: () => BPS09_STATUS });
  assert.throws(() => validateBps09SourceContract(accessor));
});

test("checked schema equals generated schema, uses LF, and is recursively closed", async () => {
  const bytes = await readFile(SCHEMA_PATH);
  assert.equal(bytes.at(-1), 0x0a);
  assert.equal(bytes.includes(0x0d), false);
  const checked = JSON.parse(bytes.toString("utf8"));
  assert.deepEqual(checked, BPS09_JSON_SCHEMA);
  assertClosedSchema(checked);
});

test("all seven exact document arms reject cross-arm, unknown, missing, and noncanonical data", () => {
  assert.deepEqual(BPS09_DOCUMENT_KINDS, EXPECTED_DOCUMENT_KINDS);
  assert.equal(DOCUMENT_VALIDATORS.length, 7);
  assert.equal(new Set(DOCUMENT_VALIDATORS).size, 7);
  for (let index = 0; index < BPS09_DOCUMENT_KINDS.length; index += 1) {
    const kind = BPS09_DOCUMENT_KINDS[index];
    const candidate = materializeDocument(kind);
    const validate = DOCUMENT_VALIDATORS[index];
    assert.doesNotThrow(() => validate(clone(candidate)), kind);
    assert.doesNotThrow(() => validateBps09Document(kind, clone(candidate)), `${kind} generic`);
    const bytes = canonicalBytes(candidate);
    assert.deepEqual(parseCanonicalBps09Document(kind, bytes), candidate);
    assert.throws(() => parseCanonicalBps09Document(kind, Buffer.concat([bytes, Buffer.from(" ")])), `${kind} trailing byte`);
    assert.throws(() => parseCanonicalBps09Document(kind, Buffer.concat([Buffer.from(" "), bytes])), `${kind} leading byte`);
    const duplicate = Buffer.from(bytes.toString("utf8").replace(
      "{\"schema\":",
      `{\"schema\":${JSON.stringify(candidate.schema)},\"schema\":`,
    ), "utf8");
    assert.throws(() => parseCanonicalBps09Document(kind, duplicate), `${kind} duplicate root key`);
    const unknown = clone(candidate);
    unknown.unreviewedAuthority = true;
    assert.throws(() => validateBps09Document(kind, unknown), `${kind} unknown root key`);
    const crossKind = BPS09_DOCUMENT_KINDS[(index + 1) % BPS09_DOCUMENT_KINDS.length];
    assert.throws(() => validateBps09Document(crossKind, clone(candidate)), `${kind} cross-arm`);
    for (const location of containerPaths(candidate)) {
      const original = valueAtPath(candidate, location);
      if (Array.isArray(original)) continue;
      for (const key of ownEnumerableKeys(original)) {
        const missing = clone(candidate);
        delete valueAtPath(missing, location)[key];
        assert.throws(() => validateBps09Document(kind, missing), `${kind}.${[...location, key].join(".")} missing`);
      }
    }
  }
});

test("root key, fingerprint, and provisioning-receipt substitutions fail in the compile bootstrap", () => {
  const bootstrap = materializeDocument("COMPILE_BOOTSTRAP");
  assert.doesNotThrow(() => validateBps09CompileBootstrap(clone(bootstrap)));
  mutateEveryNamedLeaf(
    bootstrap,
    /rootPublicKeyHex$/u,
    () => "61".repeat(32),
    validateBps09CompileBootstrap,
    "root public key substitution",
  );
  mutateEveryNamedLeaf(
    bootstrap,
    /rootFingerprintSha256$/u,
    () => "50".repeat(32),
    validateBps09CompileBootstrap,
    "root fingerprint substitution",
  );
  mutateEveryNamedLeaf(
    bootstrap,
    /(?:owner)?ProvisioningReceiptSha256$/u,
    () => "3f".repeat(32),
    validateBps09CompileBootstrap,
    "owner provisioning receipt substitution",
  );
});

test("FD12 verification order is immutable before FD11, FD3, and every peer", () => {
  const bootstrap = materializeDocument("COMPILE_BOOTSTRAP");
  const orderPaths = containerPaths(bootstrap).filter((entry) => String(entry.at(-1)) === "verificationOrder");
  assert.equal(orderPaths.length, 1, "one exact verificationOrder");
  const order = valueAtPath(bootstrap, orderPaths[0]);
  assert.ok(Array.isArray(order));
  const fd12 = order.findIndex((value) => /FD12/u.test(value));
  const fd11 = order.findIndex((value) => /FD11/u.test(value));
  const fd3 = order.findIndex((value) => /FD3/u.test(value));
  const peer = order.findIndex((value) => /PEER_RPC/u.test(value));
  assert.ok(fd12 >= 0 && fd11 > fd12 && fd3 > fd11 && peer > fd3, "FD12 -> FD11 -> FD3 -> peers");
  for (const index of [fd12, fd11, fd3, peer]) {
    const removed = clone(bootstrap);
    valueAtPath(removed, orderPaths[0]).splice(index, 1);
    assert.throws(() => validateBps09CompileBootstrap(removed), `removed ${order[index]}`);
  }
  const swapped = clone(bootstrap);
  [valueAtPath(swapped, orderPaths[0])[fd12], valueAtPath(swapped, orderPaths[0])[fd11]] = [
    valueAtPath(swapped, orderPaths[0])[fd11],
    valueAtPath(swapped, orderPaths[0])[fd12],
  ];
  assert.throws(() => validateBps09CompileBootstrap(swapped), "FD11 cannot precede FD12");
});

test("COMPILE_ONLY and INSTALL_OR_RECOVER_ONLY remain disjoint and non-authorizing", () => {
  const matrix = JSON.stringify(BPS09_CAPABILITY_MATRIX);
  assert.match(matrix, /COMPILE_ONLY/u);
  assert.match(matrix, /INSTALL_OR_RECOVER_ONLY/u);
  assert.doesNotMatch(matrix, /"INSTALL_ONLY"|"RECOVER_ONLY"/u);
  const contract = JSON.stringify(BPS09_SOURCE_CONTRACT);
  assert.match(contract, /"decision":"HOLD"/u);
  assert.match(contract, /"authority":"NONE"/u);
  assert.doesNotMatch(contract, /"(?:compiled|linked|installed|launched|runtimeObserved|receiptPresent|rootPublicKeyPinned|anchorSignatureVerified)":true/u);
  const promoted = createBps09SourceContract();
  const falseTruthPaths = leafPaths(
    promoted.truthBoundary,
    (_path, value) => value === false,
  );
  assert.ok(falseTruthPaths.length >= 6, "operational truth is explicitly false");
  for (const truthPath of falseTruthPaths) {
    const hostile = createBps09SourceContract();
    valueAtPath(hostile.truthBoundary, truthPath.slice(0, -1))[truthPath.at(-1)] = true;
    assert.throws(() => validateBps09SourceContract(hostile), `truth promotion ${truthPath.join(".")}`);
  }
});

test("OCMS v1 bytes are exact and every layout or signer substitution changes them", () => {
  const subject = "ab".repeat(32);
  const exact = makeOcmsV1Bytes(subject);
  assert.equal(Buffer.from(OCMS_PREFIX_HEX, "hex").length, 16);
  assert.equal(Buffer.from(OWNER_ROOT_PUBLIC_KEY_HEX, "hex").length, 32);
  assert.equal(Buffer.byteLength(`${OCMS_BODY_PREFIX}${subject}`, "utf8"), 100);
  assert.equal(exact.length, 150);
  assert.equal(exact.subarray(0, 16).toString("hex"), OCMS_PREFIX_HEX);
  assert.equal(exact[16], 1, "OCMS version/header");
  assert.equal(exact[17], 1, "one exact signer");
  assert.equal(exact.subarray(18, 50).toString("hex"), OWNER_ROOT_PUBLIC_KEY_HEX);
  assert.equal(exact.subarray(50).toString("utf8"), `${OCMS_BODY_PREFIX}${subject}`);
  assert.equal(exact.includes(Buffer.from("6400", "hex")), false, "v1 has no body-length prefix");

  const hostiles = [
    Buffer.concat([Buffer.alloc(16), exact.subarray(16)]),
    Buffer.from(exact).fill(0, 16, 17),
    Buffer.from(exact).fill(2, 17, 18),
    makeOcmsV1Bytes(subject, "61".repeat(32)),
    makeOcmsV1Bytes("ac".repeat(32)),
    Buffer.concat([exact.subarray(0, 50), Buffer.from(`${OCMS_BODY_PREFIX}${subject}\n`, "utf8")]),
  ];
  for (const hostile of hostiles) {
    assert.notDeepEqual(hostile, exact);
    assert.notEqual(sha256(hostile), sha256(exact));
  }
});

test("compile executor verifies FD12 same-handle kernel identity before FD11, FD3, or peers", async () => {
  const source = await readFile(COMPILE_EXECUTOR_PATH, "utf8");
  assert.match(source, /(?:ownerRootKeyAnchor|OWNER_ROOT_KEY_ANCHOR)\s*[:=]\s*12\b/u);
  assert.match(source, /(?:anchorReceipt|ANCHOR_RECEIPT)\s*[:=]\s*11\b/u);
  const verify = extractFunctionBody(source, "verifyFd12OwnerRootTrustAnchor");
  const snapshot = extractFunctionBody(source, "snapshotSealedMemfd");
  const descriptor = extractFunctionBody(source, "buildFd12Descriptor");
  const fd12Replay = `${verify}\n${snapshot}\n${descriptor}`;
  for (const token of [
    "F_SEAL_SEAL",
    "F_SEAL_SHRINK",
    "F_SEAL_GROW",
    "F_SEAL_WRITE",
    "F_SEAL_FUTURE_WRITE",
    "0400",
    OWNER_ROOT_PUBLIC_KEY_HEX,
    OWNER_ROOT_FINGERPRINT_SHA256,
    OWNER_PROVISIONING_RECEIPT_SHA256,
  ]) assert.match(fd12Replay, new RegExp(token, "u"), `FD12 verifier ${token}`);
  for (const token of ["nlink", "uid", "mode", "dev", "ino", "mountId", "handleSha256", "openFileDescriptionSha256", "contentSha256"]) {
    assert.match(fd12Replay, new RegExp(token, "iu"), `FD12 identity ${token}`);
  }
  assert.match(snapshot, /fstatSync\s*\(/u);
  assert.match(snapshot, /readlinkSync\s*\(/u);
  assert.match(snapshot, /fdinfo|fdInfo/u);
  assert.match(snapshot, /before|initial/u);
  assert.match(snapshot, /after|replay/u);

  const invocation = extractFunctionBody(source, "assertCompileOnlyInvocation");
  assertTextInOrder(invocation, [
    "verifyFd12OwnerRootTrustAnchor",
    "verifyFd11AnchorReceipt",
    "readCanonicalRecordFromFd(FD.bootstrap",
  ], "Node trust order");
  const fd11Alias = extractFunctionBody(source, "verifyFd11AnchorReceipt");
  assert.match(fd11Alias, /return\s+verifyFd11OcmsV1AnchorReceipt\s*\(\s*fd12Anchor\s*,\s*executorSourceSha256\s*\)/u);
  assert.doesNotMatch(invocation, /exchangeAuthenticatedReceipt\s*\(/u, "no peer RPC before FD3 is read");
  const run = extractFunctionBody(source, "runCompileExecutor");
  assertTextInOrder(run, [
    "assertCompileOnlyInvocation",
    "loadAndValidateCompileBootstrap",
    "replayExternalToolchainSameHandles",
  ], "FD3 validation precedes the first peer-capable compile phase");
});

test("compile executor rejects root, fingerprint, receipt, descriptor, and OCMS substitutions", async () => {
  const source = await readFile(COMPILE_EXECUTOR_PATH, "utf8");
  const verify = extractFunctionBody(source, "verifyFd12OwnerRootTrustAnchor");
  assert.match(verify, /rootPublicKeyHex/u);
  assert.match(verify, /rootFingerprintSha256/u);
  assert.match(verify, /(?:owner)?ProvisioningReceiptSha256/u);
  assert.match(verify, /(?:!==|!\.equals|timingSafeEqual|equalBytes)/u, "substitutions reach an equality rejection");
  assert.match(source, new RegExp(OCMS_PREFIX_HEX, "u"));
  assert.match(source, new RegExp(OCMS_BODY_PREFIX.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.match(source, /(?:signedData|signed_data)/u);
  assert.match(source, /(?:signedData|signed_data).*(?:equals|compare|timingSafeEqual)|(?:equals|compare|timingSafeEqual).*(?:signedData|signed_data)/su);
  assert.match(source, /Ed25519|ed25519/u);
  assert.match(source, /verifySignature\s*\(\s*null|verify\s*\(\s*null/u);
  assert.match(source, /2\.12\.4/u);
  assert.match(source, /(?:major|minor|patch)/u);
  assert.doesNotMatch(source, /firmwareVersion\s*[<>]=?\s*["']/u, "firmware semver cannot be lexical");
});

test("compile executor remains exact two-attempt COMPILE_ONLY with no install authority", async () => {
  const source = await readFile(COMPILE_EXECUTOR_PATH, "utf8");
  const body = extractFunctionBody(source, "runCompileExecutor");
  assertTextInOrder(body, [
    "assertCompileOnlyInvocation",
    "loadAndValidateCompileBootstrap",
    "replayExternalToolchainSameHandles",
    "reserveIndependentCompileAttempt",
    "runCompileAttempt",
    "reserveIndependentCompileAttempt",
    "runCompileAttempt",
    "compareIndependentArtifactSet",
    "verifyCompileZeroResidue",
    "persistCompileEvidenceHold",
  ], "compile flow");
  assert.equal((body.match(/reserveIndependentCompileAttempt\s*\(/gu) ?? []).length, 2);
  assert.equal((body.match(/runCompileAttempt\s*\(/gu) ?? []).length, 2);
  assert.match(source, /COMPILE_ONLY/u);
  assert.doesNotMatch(source, /INSTALL_OR_RECOVER_ONLY/u);
  assert.doesNotMatch(body, /\b(?:install|recover)Controller\s*\(/u);
  assert.match(source, /SUPERVISOR_ARTIFACT/u);
  assert.match(source, /INSTALL_CONTROLLER_ARTIFACT/u);
  assert.match(source, /shell\s*:\s*false/u);
});

test("independent compile comparison rejects same-root and unequal artifact replay", () => {
  const evidence = materializeDocument("COMPILE_EVIDENCE");
  const asAttempt = (root, artifactSet) => ({
    reservation: { root },
    outputs: [
      {
        artifact: "SUPERVISOR_ARTIFACT",
        fileIdentity: clone(artifactSet.target),
        objectMapSha256: artifactSet.objectMapSha256,
        linkMapSha256: artifactSet.linkMapSha256,
        diagnosticsSha256: artifactSet.diagnosticsSha256,
      },
      {
        artifact: "INSTALL_CONTROLLER_ARTIFACT",
        fileIdentity: clone(artifactSet.installer),
        objectMapSha256: artifactSet.objectMapSha256,
        linkMapSha256: artifactSet.linkMapSha256,
        diagnosticsSha256: artifactSet.diagnosticsSha256,
      },
    ],
  });
  const attemptA = asAttempt("/externally-observed/attempt-a", evidence.attemptA);
  const attemptB = asAttempt("/externally-observed/attempt-b", evidence.attemptB);
  assert.doesNotThrow(() => compareIndependentArtifactSet(attemptA, attemptB));
  const unequal = clone(attemptB);
  unequal.outputs[0].fileIdentity.sha256 = digestFor("unequal-target");
  assert.throws(() => compareIndependentArtifactSet(attemptA, unequal));
  const sameRoot = clone(attemptB);
  sameRoot.reservation.root = attemptA.reservation.root;
  assert.throws(() => compareIndependentArtifactSet(attemptA, sameRoot));
});

test("native controller verifies FD12 then FD11/OCMS then the pinned provider before FD3 and never compiles artifacts", async () => {
  const source = await readFile(INSTALL_CONTROLLER_PATH, "utf8");
  assert.match(source, /#define\s+BPS09_FD_OWNER_ROOT_KEY_ANCHOR\s+12\b/u);
  assert.match(source, /#define\s+BPS09_FD_ANCHOR_RECEIPT\s+11\b/u);
  assert.match(source, /#define\s+BPS09_FD_BOOTSTRAP\s+3\b/u);
  assert.match(source, /INSTALL_OR_RECOVER_ONLY/u);
  assert.doesNotMatch(source, /COMPILE_ONLY/u);
  const invocation = extractFunctionBody(source, "validate_install_or_recover_invocation");
  assertTextInOrder(invocation, [
    "verify_exact_inherited_fd_table",
    "replay_fd12_owner_root_key_anchor_same_handle",
    "verify_fd11_anchor_receipt_ocms_v1",
    "verify_runtime_binding_before_fd3",
  ], "native inherited capability and trust order");
  assert.doesNotMatch(invocation, /load_json_record\s*\(\s*BPS09_FD_BOOTSTRAP|timer_first_rpc\s*\(/u, "FD3 and peers remain unread during FD12/FD11 verification");
  const main = extractFunctionBody(source, "main");
  assertTextInOrder(main, [
    "validate_install_or_recover_invocation",
    "load_and_validate_native_bootstrap",
    "verify_independent_compile_review_gate",
  ], "native trust order");
  const bootstrap = extractFunctionBody(source, "load_and_validate_native_bootstrap");
  assert.match(bootstrap, /g_trust_anchor\.fd12_verified/u);
  assert.match(bootstrap, /g_trust_anchor\.fd11_verified/u);
  const firstPeerGate = extractFunctionBody(source, "verify_independent_compile_review_gate");
  assert.match(firstPeerGate, /timer_first_rpc\s*\(/u, "the first peer gate is an authenticated RPC after FD3 validation");
  const runtimeBinding = extractFunctionBody(source, "verify_runtime_binding_before_fd3");
  assertTextInOrder(runtimeBinding, [
    "verify_kernel_descriptor_role_signature",
    "run_runtime_binding_provider",
    "runtime_binding_verified=true",
  ], "signed descriptor, pinned provider preflight, then runtime latch");
  const provider = extractFunctionBody(source, "run_runtime_binding_provider");
  assert.match(provider, /fork\s*\(\s*\)/u);
  assert.match(provider, /SYS_execveat/u);
  assert.match(provider, /BPS09_FD_RUNTIME_BINDING_PROVIDER/u);
  assert.doesNotMatch(source, /\b(?:clang|lld|llvm-ar|clone|system|popen|posix_spawn)\s*\(/u);
});

test("native FD12 replay is sealed, same-handle, kernel-identity exact, and substitution closed", async () => {
  const source = await readFile(INSTALL_CONTROLLER_PATH, "utf8");
  const replay = extractFunctionBody(source, "replay_fd12_owner_root_key_anchor_same_handle");
  for (const token of [
    "F_SEAL_SEAL",
    "F_SEAL_SHRINK",
    "F_SEAL_GROW",
    "F_SEAL_WRITE",
    "F_SEAL_FUTURE_WRITE",
  ]) assert.match(replay, new RegExp(token, "u"), token);
  for (const [macro, value] of [
    ["BPS09_ROOT_PUBLIC_KEY_HEX", OWNER_ROOT_PUBLIC_KEY_HEX],
    ["BPS09_ROOT_FINGERPRINT_SHA256", OWNER_ROOT_FINGERPRINT_SHA256],
    ["BPS09_OWNER_PROVISIONING_RECEIPT_SHA256", OWNER_PROVISIONING_RECEIPT_SHA256],
  ]) {
    assert.match(source, new RegExp(`#define\\s+${macro}\\s+"${value}"`, "u"), `${macro} exact binding`);
    assert.match(replay, new RegExp(macro, "u"), `${macro} consumed by FD12 replay`);
  }
  for (const token of ["st_uid", "st_mode", "st_nlink", "st_dev", "st_ino", "stx_mnt_id", "handle_sha256", "ofd_sha256", "content_sha256"]) {
    assert.match(replay, new RegExp(token, "u"), token);
  }
  assert.match(replay, /F_GET_SEALS/u);
  assert.match(replay, /\/proc\/self\/fd\/12/u);
  assert.match(replay, /read_fdinfo_exact|fdinfo/u);
  assert.match(replay, /before|initial/u);
  assert.match(replay, /after|replay/u);
  assert.match(replay, /strcmp|memcmp/u);
});

test("native OCMS v1 reconstructs the exact 150 bytes and verifies the pinned root signer", async () => {
  const source = await readFile(INSTALL_CONTROLLER_PATH, "utf8");
  const verify = extractFunctionBody(source, "verify_fd11_anchor_receipt_ocms_v1");
  const cPrefix = [...Buffer.from(OCMS_PREFIX_HEX, "hex")]
    .map((byte) => `0x${byte.toString(16).padStart(2, "0")}U`)
    .join("\\s*,\\s*");
  assert.match(verify, new RegExp(`ocms_prefix\\s*\\[\\s*16\\s*\\]\\s*=\\s*\\{\\s*${cPrefix}\\s*\\}`, "u"));
  assert.match(source, new RegExp(`#define\\s+BPS09_BPS08_BODY_PREFIX\\s+"${OCMS_BODY_PREFIX}"`, "u"));
  assert.match(verify, /BPS09_BPS08_BODY_PREFIX/u);
  assert.match(verify, /150/u);
  assert.match(verify, /signed_data|signedData/u);
  assert.match(verify, /memcmp|CRYPTO_memcmp/u);
  assert.match(verify, /ED25519|Ed25519|ed25519/u);
  assert.match(verify, /BPS09_FD_OWNER_ROOT_KEY_ANCHOR|root_public_key/u);
  assert.match(verify, /signer_list\s*\[\s*0\s*\]\s*=\s*1U/u);
  assert.match(verify, /memcpy\s*\(\s*signer_list\s*\+\s*1U\s*,\s*g_trust_anchor\.root_public_key\s*,\s*32U\s*\)/u);
  assert.doesNotMatch(verify, /application_domain|message_format|body_length_u16/iu, "legacy OCMS fields cannot authorize v1");
});

test("native compile-review input and output require the exact FD12-trust-anchored outcome", async () => {
  const source = await readFile(INSTALL_CONTROLLER_PATH, "utf8");
  assert.doesNotMatch(source, new RegExp(OLD_GENERIC_COMPILE_REVIEW_OUTCOME, "u"), "old generic compile-review outcome can neither be accepted nor emitted");
  assert.match(
    source,
    new RegExp(`#define\\s+BPS09_COMPILE_REVIEW_OUTCOME\\s+"${FD12_TRUST_ANCHORED_COMPILE_REVIEW_OUTCOME}"`, "u"),
    "the one native outcome constant is the FD12-trust-anchored review",
  );
  const load = extractFunctionBody(source, "load_and_validate_native_bootstrap");
  assert.match(
    load,
    /parse_receipt_node\s*\([^;]*"INDEPENDENT_COMPILE_REVIEW"\s*,\s*BPS09_COMPILE_REVIEW_OUTCOME\s*,/su,
    "native bootstrap parsing accepts only the exact anchored outcome",
  );
  const gate = extractFunctionBody(source, "verify_independent_compile_review_gate");
  assert.match(
    gate,
    /snprintf\s*\(\s*request\.outcome\s*,\s*sizeof\s+request\.outcome\s*,\s*"%s"\s*,\s*BPS09_COMPILE_REVIEW_OUTCOME\s*\)/u,
    "native review request emits only the exact anchored outcome",
  );
  const rpc = extractFunctionBody(source, "timer_first_rpc");
  assert.match(rpc, /strcmp\s*\(\s*reply->outcome\s*,\s*request->outcome\s*\)\s*!=\s*0/u, "the authenticated reply must echo the exact anchored request outcome");
});

test("native signed FD11 nonce, one-use CAS, expiry, and predecessor lineage fail closed before FD3 or RPC", async () => {
  const source = await readFile(INSTALL_CONTROLLER_PATH, "utf8");
  const verify = extractFunctionBody(source, "verify_fd11_anchor_receipt_ocms_v1");
  assert.match(
    verify,
    cKeySequence([
      "bootId",
      "anchorNonceHex",
      "anchorCasKeySha256",
      "anchorCasAcquireReceiptSha256",
      "anchorExpiresAtMonotonicNs",
    ]),
    "the one-use projection is inside the exact signed subject field order",
  );
  assert.match(verify, /json_object_exact\s*\(\s*&parser\s*,\s*subject\s*,\s*subject_keys/u, "one-use values are parsed only from the exact signed subject");
  for (const field of [
    "anchorNonceHex",
    "anchorCasKeySha256",
    "anchorCasAcquireReceiptSha256",
    "anchorExpiresAtMonotonicNs",
  ]) assert.match(verify, new RegExp(`"${field}"`, "u"), `signed FD11 ${field}`);
  assert.match(verify, /decode_lower_hex_exact\s*\([^;]*anchor_nonce[^;]*32U\s*\)/su, "anchor nonce is exact raw32 lowercase hex");
  assert.match(verify, /lowercase_sha256\s*\(\s*anchor_cas_key_sha256\s*\)/u, "CAS key is exact lowercase SHA-256");
  assert.match(verify, /lowercase_sha256\s*\(\s*anchor_cas_acquire_receipt_sha256\s*\)/u, "CAS acquire receipt is exact lowercase SHA-256");
  assert.match(verify, /clock_gettime\s*\(\s*CLOCK_MONOTONIC\s*,/u, "expiry is checked against the current monotonic clock");
  assert.match(verify, /anchor_expires_at_monotonic_ns\s*<=\s*anchor_now_ns/u, "an already expired anchor is rejected");
  assert.match(verify, /anchor_expires_at_monotonic_ns\s*>\s*operation_deadline_monotonic_ns/u, "anchor expiry cannot outlive its operation deadline");
  assert.match(verify, /operation_deadline_monotonic_ns\s*>=\s*teardown_deadline_monotonic_ns/u, "operation and teardown chronology is exact");
  assert.match(verify, /one_use_consumed/u, "same-process replay has an explicit one-use latch");
  assertTextInOrder(verify, [
    "if(one_use_consumed)",
    "clock_gettime(CLOCK_MONOTONIC",
    "EVP_DigestVerify",
    "one_use_consumed=true",
  ], "one-use replay, current expiry, signature, then consume");
  assert.match(verify, /anchor_cas_key_sha256[^;]*(?:strcmp|memcmp)[^;]*anchor_cas_acquire_receipt_sha256|anchor_cas_acquire_receipt_sha256[^;]*(?:strcmp|memcmp)[^;]*anchor_cas_key_sha256/su, "CAS key and acquisition receipt cannot alias");
  assert.match(verify, new RegExp(`bps06ManifestSha256[^;]*${EXPECTED_BPS06.sha256}`, "su"));
  assert.match(verify, new RegExp(`bpc01Commit[^;]*${EXPECTED_BPC01_LINEAGE.commit}`, "su"));
  assert.match(verify, new RegExp(`bpc01Tree[^;]*${EXPECTED_BPC01_LINEAGE.tree}`, "su"));
  assert.match(verify, new RegExp(`bpc01ManifestSha256[^;]*${EXPECTED_BPC01_LINEAGE.manifestSha256}`, "su"));
  assert.doesNotMatch(verify, /load_json_record\s*\(\s*BPS09_FD_BOOTSTRAP|timer_first_rpc\s*\(/u, "FD11 freshness and predecessor lineage close before FD3 or peers");
});

test("native signed peer and timer projections bind actual FD6, FD7, and FD8 before every RPC", async () => {
  const source = await readFile(INSTALL_CONTROLLER_PATH, "utf8");
  const verify = extractFunctionBody(source, "verify_fd11_anchor_receipt_ocms_v1");
  for (const field of [
    "watchdogPublicKeyHex",
    "observerPublicKeyHex",
    "custodianPublicKeyHex",
    "watchdogPrincipalSha256",
    "observerPrincipalSha256",
    "custodianPrincipalSha256",
    "watchdogChannelOfdSha256",
    "observerChannelOfdSha256",
    "custodianChannelOfdSha256",
    "operationTimerOfdSha256",
    "operationDeadlineMonotonicNs",
    "teardownTimerOfdSha256",
    "teardownDeadlineMonotonicNs",
  ]) assert.match(verify, new RegExp(`"${field}"`, "u"), `signed FD11 projection ${field}`);
  assert.match(verify, /observe_native_peer_projection\s*\(\s*BPS09_FD_WATCHDOG\s*,\s*"watchdog"/u);
  assert.match(verify, /observe_native_peer_projection\s*\(\s*BPS09_FD_OBSERVER\s*,\s*"observer"/u);
  assert.match(verify, /observe_native_peer_projection\s*\(\s*BPS09_FD_CUSTODIAN\s*,\s*"custodian"/u);
  assert.match(verify, /json_string_equals\s*\([^;]*"watchdogChannelOfdSha256"\s*,\s*watchdog_ofd\s*\)/su);
  assert.match(verify, /json_string_equals\s*\([^;]*"observerChannelOfdSha256"\s*,\s*observer_ofd\s*\)/su);
  assert.match(verify, /json_string_equals\s*\([^;]*"custodianChannelOfdSha256"\s*,\s*custodian_ofd\s*\)/su);
  assert.match(verify, /decode_lower_hex_exact\s*\(\s*watchdog_principal_anchor\s*,\s*g_trust_anchor\.principal_sha256_raw\[0\]/u);
  assert.match(verify, /decode_lower_hex_exact\s*\(\s*observer_principal_anchor\s*,\s*g_trust_anchor\.principal_sha256_raw\[1\]/u);
  assert.match(verify, /decode_lower_hex_exact\s*\(\s*custodian_principal_anchor\s*,\s*g_trust_anchor\.principal_sha256_raw\[2\]/u);
  assert.match(verify, /observe_native_timer_ofd\s*\(\s*BPS09_FD_OPERATION_TIMER\s*,\s*operation_deadline_monotonic_ns\s*,\s*operation_timer\s*\)/u);
  assert.match(verify, /observe_native_timer_ofd\s*\(\s*BPS09_FD_TEARDOWN_TIMER\s*,\s*teardown_deadline_monotonic_ns\s*,\s*teardown_timer\s*\)/u);
  assert.match(verify, /json_string_equals\s*\([^;]*"teardownTimerOfdSha256"\s*,\s*teardown_timer\s*\)/su);
  assert.match(verify, /watchdog_principal_anchor[^;]*observer_principal_anchor[^;]*custodian_principal_anchor/su, "the three signed principal hashes cannot alias");
  assert.match(verify, /watchdog_ofd[^;]*observer_ofd[^;]*custodian_ofd/su, "all three native channel identities are observed");
  assert.match(verify, /strcmp\s*\(\s*operation_timer\s*,\s*teardown_timer\s*\)\s*!=\s*0/u, "the signed timers cannot alias");

  const runtimeBinding = extractFunctionBody(source, "verify_runtime_binding_before_fd3");
  assert.match(runtimeBinding, /memcmp\s*\(\s*descriptor\.principal_sha256\[role\]\s*,\s*g_trust_anchor\.principal_sha256_raw\[role\]/u);
  assert.match(runtimeBinding, /verify_kernel_descriptor_role_signature/u);
  assert.match(runtimeBinding, /run_runtime_binding_provider/u);

  const authenticatedPeer = extractFunctionBody(source, "authenticated_peer_credentials");
  for (const token of [
    "g_trust_anchor.fd11_verified",
    "observe_native_peer_projection",
    "credentials->pid!=expected->pid",
    "credentials->uid!=expected->uid",
    "credentials->gid!=expected->gid",
    "strcmp(observed_ofd,expected_ofd)",
    "g_trust_anchor.runtime_binding_verified",
    "poll(&live,1,0)",
  ]) assert.match(authenticatedPeer, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), token);
  const deadline = extractFunctionBody(source, "deadline_timer_open");
  assert.match(deadline, /g_trust_anchor\.fd11_verified/u);
  assert.match(deadline, /g_runtime\.bootstrap\.deadline_ns\s*!=\s*g_trust_anchor\.teardown_deadline_monotonic_ns/u);
  assert.match(deadline, /observe_native_timer_ofd\s*\(\s*BPS09_FD_TEARDOWN_TIMER/u);
  assert.match(deadline, /strcmp\s*\(\s*observed_timer_ofd\s*,\s*g_trust_anchor\.teardown_timer_ofd_sha256\s*\)/u);
  const rpc = extractFunctionBody(source, "timer_first_rpc");
  assert.ok((rpc.match(/authenticated_peer_credentials\s*\(/gu) ?? []).length >= 2, "peer credentials/OFD/principal replay before and after RPC");
  assert.ok((rpc.match(/deadline_timer_open\s*\(/gu) ?? []).length >= 1, "signed timer identity/deadline gates RPC");
  assert.match(rpc, /verify_rpc_role_signature\s*\(\s*endpoint_fd\s*,\s*reply\s*\)/u, "each peer response carries an Ed25519 role signature");
});

test("post-rename failure cannot retain final or synthesize custody before an authenticated custodian receipt", async () => {
  const source = await readFile(INSTALL_CONTROLLER_PATH, "utf8");
  const main = extractFunctionBody(source, "main");
  assertTextInOrder(main, [
    "publish_noreplace_and_fsync_parent",
    "request_custodian_ack",
    "supervised_failure_hold",
  ], "rename/publication, custody request, then supervised failure convergence");

  const custody = extractFunctionBody(source, "request_custodian_ack");
  assertTextInOrder(custody, [
    "timer_first_rpc",
    "g_custody_reply.state!=1U",
    "g_runtime.custody_acked = true",
  ], "custody becomes true only after an authenticated successful custodian reply");
  const validated = extractFunctionBody(source, "validated_custodian_custody_receipt");
  for (const token of [
    "g_runtime.custody_acked",
    "g_custody_reply.state==1U",
    "EVIDENCE_CUSTODIAN_CUSTODY_RECEIPT",
    "BPS09_INSTALL_PHASE_RECEIPT_ACCEPTED_HOLD",
    "g_custody_reply.resource_dev==g_runtime.final_claim.dev",
    "g_custody_reply.resource_ino==g_runtime.final_claim.ino",
    "g_custody_reply.resource_mount_id==g_runtime.final_claim.mount_id",
  ]) assert.match(validated, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"), token);

  const converge = extractFunctionBody(source, "converge_failed_install_artifacts");
  assert.doesNotMatch(converge, /custody_acked\s*=\s*true/u, "failure convergence cannot manufacture custody");
  assert.match(converge, /retain_published_final[^;]*validated_custodian_custody_receipt\s*\(\s*\)/su, "retention requires the authenticated custody receipt");
  assertTextInOrder(converge, [
    "recover_one_exact_identity(g_runtime.bootstrap.final_name",
    "g_runtime.published=false",
    "g_runtime.custody_acked=false",
    "fsync(BPS09_FD_INSTALL_PARENT)",
  ], "unacknowledged published final is removed by exact identity and parent-fsynced");
  const recover = extractFunctionBody(source, "recover_one_exact_identity");
  assertTextInOrder(recover, ["replay_claim_fd", "SYS_renameat2", "replay_claim_fd", "unlinkat", "st_nlink==0"], "held identity is renamed, reopened, unlinked, and proven linkless");
  assert.match(recover, /RENAME_NOREPLACE/u);
  assert.match(recover, /probe_errno==ENOENT/u);

  const supervised = extractFunctionBody(source, "supervised_failure_hold");
  assert.match(supervised, /authenticated_custody\s*=\s*validated_custodian_custody_receipt\s*\(\s*\)/u);
  assert.match(supervised, /retain_published_final\s*=\s*authenticated_custody\s*&&\s*g_abort_reply\.state\s*==\s*2U/u);
  assert.doesNotMatch(supervised, /custody_acked\s*=\s*true/u);
  assertTextInOrder(supervised, [
    "converge_failed_install_artifacts",
    "request_identity_cleanup_receipt",
    "verify_install_zero_residue",
    "request_parent_fsync_zero_receipt",
    "persist_install_failure_evidence_hold",
  ], "failure convergence, cleanup, zero proof, parent fsync receipt, then HOLD evidence");
});

test("compile entry requires the signed BPS08A runtime binding before FD3", async () => {
  const [contract, executor, native] = await Promise.all([
    readFile(CONTRACT_PATH, "utf8"),
    readFile(COMPILE_EXECUTOR_PATH, "utf8"),
    readFile(INSTALL_CONTROLLER_PATH, "utf8"),
  ]);
  assert.match(contract, /READ_FD17_CANONICAL_RUNTIME_BINDING_RECEIPT_WITHOUT_READING_FD3/u);
  assert.match(contract, /VERIFY_FD17_WATCHDOG_OBSERVER_CUSTODIAN_SIGNATURES_AND_SIGNED_FD28_PROVIDER_HASH/u);
  const invocation = extractFunctionBody(executor, "assertCompileOnlyInvocation");
  assertTextInOrder(invocation, [
    "verifyFd12OwnerRootTrustAnchor",
    "verifyFd11AnchorReceipt",
    "loadRuntimeBindingAfterFd11BeforeFd3",
    "readCanonicalRecordFromFd(FD.bootstrap",
  ], "FD12 and FD11 precede signed runtime binding, which precedes FD3");
  assert.match(executor, /runtimeToolchain\.toolOpenFileDescriptionManifestSha256/u);
  assert.match(executor, /verifyRuntimeDirectoryIdentity\(FD\.sysrootDirectory/u);
  const recover = extractFunctionBody(native, "recover_one_exact_identity");
  assert.match(recover, /SYS_renameat2/u);
  assert.match(recover, /held_after\.st_nlink==0/u);
});

test("native controller retains INSTALL_OR_RECOVER_ONLY publication, recovery, zero, and HOLD separation", async () => {
  const source = await readFile(INSTALL_CONTROLLER_PATH, "utf8");
  const main = extractFunctionBody(source, "main");
  assertTextInOrder(main, [
    "validate_install_or_recover_invocation",
    "verify_independent_compile_review_gate",
    "replay_source_artifact_same_object",
    "acquire_install_attempt_cas",
    "replay_install_parent_identity",
    "create_temp_beneath_openat2",
    "stream_source_to_temp_bounded",
    "fsync_temp_and_replay_identity",
    "publish_noreplace_and_fsync_parent",
    "reopen_final_same_object_statx",
    "request_custodian_ack",
    "verify_install_zero_residue",
    "persist_install_evidence_hold",
  ], "native install flow");
  for (const token of [
    "SYS_openat2",
    "RESOLVE_BENEATH",
    "RESOLVE_NO_SYMLINKS",
    "RESOLVE_NO_MAGICLINKS",
    "O_EXCL",
    "O_NOFOLLOW",
    "SYS_renameat2",
    "RENAME_NOREPLACE",
    "SYS_statx",
    "STATX_MNT_ID",
  ]) assert.match(source, new RegExp(token, "u"), token);
  assert.doesNotMatch(source, /(?:installed|launched|runtimeObserved)\s*[=:]\s*true/u);
  assert.match(source, /HOLD/u);
  assert.match(source, /NONE/u);
});

test("source suite and contract are non-operational and strict LF", async () => {
  const [contractBytes, testBytes, executorBytes, nativeBytes] = await Promise.all([
    readFile(CONTRACT_PATH),
    readFile(TEST_PATH),
    readFile(COMPILE_EXECUTOR_PATH),
    readFile(INSTALL_CONTROLLER_PATH),
  ]);
  for (const [label, bytes] of [
    ["contract", contractBytes],
    ["test", testBytes],
    ["executor", executorBytes],
    ["native", nativeBytes],
  ]) {
    assert.equal(bytes.at(-1), 0x0a, `${label} final LF`);
    assert.equal(bytes.includes(0x0d), false, `${label} no CR`);
  }
  const contract = contractBytes.toString("utf8");
  const testSource = testBytes.toString("utf8");
  assert.doesNotMatch(contract, /node:child_process|\bspawn\s*\(|\bexec(?:File)?\s*\(|\bfork\s*\(/u);
  assert.doesNotMatch(contract, /writeFile|appendFile|mkdir|rename|unlink|rmSync|fetch\s*\(/u);
  assert.doesNotMatch(testSource, /^import\s+.*["']node:(?:child_process|worker_threads)["'];?\s*$/mu);
  assert.doesNotMatch(testSource, /\bimport\s*\(/u);
  assert.doesNotMatch(testSource, /\bprocess\.(?:binding|dlopen)\s*\(/u);
});

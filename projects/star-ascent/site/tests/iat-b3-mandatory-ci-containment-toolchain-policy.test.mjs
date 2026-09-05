import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assessNativeContainmentPreflight,
  parseJsonRejectingDuplicateKeys,
} from "../scripts/lib/iat-b3-mandatory-ci-containment-contract.mjs";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const POLICY_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-mandatory-ci-containment-toolchains.v1.json",
);
const TEST_PATH = fileURLToPath(import.meta.url);
const POLICY_BYTES = readFileSync(POLICY_PATH);
const POLICY_TEXT = POLICY_BYTES.toString("utf8");
const POLICY = parseJsonRejectingDuplicateKeys(POLICY_TEXT);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

const TOP_LEVEL_KEYS = Object.freeze([
  "schema",
  "status",
  "ready",
  "complete",
  "operative",
  "exitCode",
  "evidenceClass",
  "networkPolicy",
  "schemaPolicy",
  "trustBoundary",
  "gitObjectIdAlgorithm",
  "artifactDigestAlgorithm",
  "buildBudgetBytes",
  "sourceDateEpoch",
  "targets",
  "observations",
  "blockers",
  "observerRequirements",
  "authorization",
]);

const SCHEMA_POLICY = Object.freeze({
  canonicalJsonRequired: true,
  duplicateKeysRejected: true,
  unknownKeysRejected: true,
  missingKeysRejected: true,
  keyOrderFixed: true,
  packetSelectedTrustForbidden: true,
});

const TRUST_BOUNDARY = Object.freeze({
  declaredSource: "EXTERNAL_OBSERVER_AND_SEPARATE_TRUST_ANCHOR_REQUIRED",
  packetSelectedExecutableAccepted: false,
  packetSelectedToolchainClosureAccepted: false,
  packetSelectedSysrootClosureAccepted: false,
  packetSelectedReceiptAccepted: false,
  selfAuthoredDigestAuthoritative: false,
  ambientPathAccepted: false,
  environmentOverrideAccepted: false,
  hostedSmokePromotable: false,
});

const TARGET_KEYS = Object.freeze({
  "linux-x64-musl": Object.freeze([
    "target", "backend", "observed", "executablePath",
    "executableRealpath", "executableSha256", "executableByteLength",
    "versionStdoutSha256", "compilerClosureSha256",
    "muslSysrootClosureSha256", "binarySha256", "binaryByteLength",
    "elfImportAllowlist",
  ]),
  "windows-x64-gnu": Object.freeze([
    "target", "backend", "observed", "executablePath",
    "executableRealpath", "executableSha256", "executableByteLength",
    "versionStdoutSha256", "compilerClosureSha256",
    "mingwSysrootClosureSha256", "binarySha256", "binaryByteLength",
    "peImportAllowlist",
  ]),
  "native-wsl-linux-x64-musl": Object.freeze([
    "target", "backend", "observed", "executablePath",
    "executableRealpath", "executableSha256", "executableByteLength",
    "versionStdoutSha256", "compilerClosureSha256", "linkerClosureSha256",
    "muslSysrootClosureSha256", "binarySha256", "binaryByteLength",
    "elfImportAllowlist",
  ]),
});

const TARGET_BACKENDS = Object.freeze({
  "linux-x64-musl": "PINNED_ZIG_CC",
  "windows-x64-gnu": "PINNED_ZIG_CC",
  "native-wsl-linux-x64-musl": "OPTIONAL_NATIVE_WSL_COMPILER",
});

const OBSERVATION_KEYS = Object.freeze([
  "observerSessionId",
  "sourceHeadGitObjectId",
  "sourceTreeGitObjectId",
  "sourceCheckpointSha256",
  "policyTrustAnchorSha256",
  "compilerExecutableObserved",
  "compilerVersionObserved",
  "toolchainClosureObserved",
  "sysrootClosureObserved",
  "importAllowlistObserved",
  "buildPlanObserved",
  "compilerExecuted",
  "artifactObserved",
  "receiptObserved",
  "runtimeObserved",
]);

const NULL_OBSERVATION_KEYS = Object.freeze(OBSERVATION_KEYS.slice(0, 5));
const FALSE_OBSERVATION_KEYS = Object.freeze(OBSERVATION_KEYS.slice(5));

const BLOCKERS = Object.freeze([
  "ALL_TOOLCHAIN_IDENTITIES_NULL",
  "BP11_SOURCE_POLICY_NONAUTHORITATIVE_HOLD",
  "CANONICAL_EXTERNAL_PREIMAGE_BUNDLE_UNAVAILABLE",
  "COMPILER_EXECUTION_NOT_AUTHORIZED",
  "DIRECT_BUILD_AUTHORITY_FALSE",
  "EXACT_CLEAN_SOURCE_CHECKPOINT_UNOBSERVED",
  "LINUX_MUSL_SYSROOT_CLOSURE_UNMEASURED",
  "NATIVE_HELPER_ARTIFACT_UNAVAILABLE",
  "NATIVE_WSL_TOOLCHAIN_CLOSURE_UNMEASURED",
  "OBSERVER_OWNED_TOOLCHAIN_CLOSURE_UNAVAILABLE",
  "OBSERVER_OWNED_TWO_BUILD_RECEIPT_UNAVAILABLE",
  "PACKET_SELECTED_TRUST_FORBIDDEN",
  "PHASE_B_NATIVE_BUILD_HARD_DISABLED",
  "PINNED_ZIG_EXECUTABLE_BYTES_UNMEASURED",
  "PINNED_ZIG_TOOLCHAIN_CLOSURE_UNMEASURED",
  "REPRODUCIBLE_TWO_BUILD_RECEIPT_UNAVAILABLE",
  "WINDOWS_MINGW_SYSROOT_CLOSURE_UNMEASURED",
  "WINDOWS_PE_IMPORT_ALLOWLIST_UNMEASURED",
]);

const OBSERVER_REQUIREMENT_KEYS = Object.freeze([
  "externalTrustAnchorSeparateFromPacket",
  "sameFdNoFollow",
  "recursiveToolchainClosureBeforeAndAfterEachBuild",
  "exactSourceObservationBeforeAndAfterBothBuilds",
  "twoDisjointBuildRootsPerTarget",
  "incrementalTwoGiBBudget",
  "identityBoundCleanupAndAbsence",
  "observerOwnedReceipt",
  "sameObjectExecutionBinding",
]);

const AUTHORIZATION_KEYS = Object.freeze([
  "packetMayAuthorize",
  "environmentMayAuthorize",
  "hostedSmokeMayAuthorize",
  "download",
  "install",
  "network",
  "compileOrExecuteInThisWave",
  "rpc",
  "keyAccess",
  "signing",
  "devnet",
  "mainnet",
]);

function plainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function exactKeys(value, keys, code) {
  if (!plainRecord(value)
    || JSON.stringify(Object.keys(value)) !== JSON.stringify(keys)) {
    fail(code);
  }
}

function exactObject(value, expected, code) {
  exactKeys(value, Object.keys(expected), code);
  if (JSON.stringify(value) !== JSON.stringify(expected)) fail(code);
}

function validateTarget(target, name) {
  exactKeys(target, TARGET_KEYS[name], "BP11_TARGET_EXACT_SCHEMA_HOLD");
  if (target.target !== name || target.backend !== TARGET_BACKENDS[name]
    || target.observed !== false) {
    fail("BP11_TARGET_HEADER_HOLD");
  }
  const identityKeys = TARGET_KEYS[name].filter((key) => ![
    "target", "backend", "observed", "elfImportAllowlist",
    "peImportAllowlist",
  ].includes(key));
  if (identityKeys.some((key) => target[key] !== null)) {
    fail("BP11_TARGET_IDENTITY_MUST_BE_NULL_HOLD");
  }
  if (name === "windows-x64-gnu") {
    if (target.peImportAllowlist !== null) {
      fail("BP11_WINDOWS_ALLOWLIST_UNMEASURED_HOLD");
    }
  } else if (!Array.isArray(target.elfImportAllowlist)
    || target.elfImportAllowlist.length !== 0) {
    fail("BP11_ELF_ALLOWLIST_EXACT_EMPTY_HOLD");
  }
}

function validatePolicy(candidate) {
  exactKeys(candidate, TOP_LEVEL_KEYS, "BP11_POLICY_EXACT_SCHEMA_HOLD");
  if (candidate.schema !== "iat-b3-mandatory-ci-containment-toolchains/v1"
    || candidate.status !== "HOLD_UNMEASURED"
    || candidate.ready !== false || candidate.complete !== false
    || candidate.operative !== false || candidate.exitCode !== 2
    || candidate.evidenceClass
      !== "LOCAL_CANONICAL_UNAVAILABLE_HOSTED_CROSS_PLATFORM_SMOKE_ONLY"
    || candidate.networkPolicy !== "NO_DOWNLOAD_NO_INSTALL_NO_DISCOVERY_NETWORK"
    || candidate.gitObjectIdAlgorithm !== "sha1-40-hex"
    || candidate.artifactDigestAlgorithm !== "sha256-64-hex"
    || candidate.buildBudgetBytes !== 2_147_483_648
    || candidate.sourceDateEpoch !== "0") {
    fail("BP11_POLICY_HEADER_HOLD");
  }
  exactObject(candidate.schemaPolicy, SCHEMA_POLICY,
    "BP11_SCHEMA_POLICY_HOLD");
  exactObject(candidate.trustBoundary, TRUST_BOUNDARY,
    "BP11_TRUST_BOUNDARY_HOLD");
  exactKeys(candidate.targets, Object.keys(TARGET_KEYS),
    "BP11_TARGET_SET_HOLD");
  for (const name of Object.keys(TARGET_KEYS)) {
    validateTarget(candidate.targets[name], name);
  }
  exactKeys(candidate.observations, OBSERVATION_KEYS,
    "BP11_OBSERVATION_EXACT_SCHEMA_HOLD");
  if (NULL_OBSERVATION_KEYS.some(
    (key) => candidate.observations[key] !== null,
  ) || FALSE_OBSERVATION_KEYS.some(
    (key) => candidate.observations[key] !== false,
  )) fail("BP11_OBSERVATION_PROMOTION_HOLD");
  if (!Array.isArray(candidate.blockers)
    || JSON.stringify(candidate.blockers) !== JSON.stringify(BLOCKERS)
    || new Set(candidate.blockers).size !== BLOCKERS.length
    || JSON.stringify(candidate.blockers)
      !== JSON.stringify([...candidate.blockers].sort())) {
    fail("BP11_BLOCKER_SET_HOLD");
  }
  exactKeys(candidate.observerRequirements, OBSERVER_REQUIREMENT_KEYS,
    "BP11_OBSERVER_REQUIREMENTS_EXACT_SCHEMA_HOLD");
  if (Object.values(candidate.observerRequirements).some(
    (value) => value !== true,
  )) fail("BP11_OBSERVER_REQUIREMENT_WEAKENING_HOLD");
  exactKeys(candidate.authorization, AUTHORIZATION_KEYS,
    "BP11_AUTHORIZATION_EXACT_SCHEMA_HOLD");
  if (Object.values(candidate.authorization).some(
    (value) => value !== false,
  )) fail("BP11_AUTHORIZATION_PROMOTION_HOLD");
  return true;
}

function clonePolicy() {
  return structuredClone(POLICY);
}

function assertMutationRejected(mutator, pattern = /BP11_.*_HOLD/u) {
  const candidate = clonePolicy();
  mutator(candidate);
  assert.throws(() => validatePolicy(candidate), pattern);
}

function populatePacketSelectedIdentities(candidate) {
  for (const [name, target] of Object.entries(candidate.targets)) {
    target.observed = true;
    target.executablePath = name === "windows-x64-gnu"
      ? "C:\\hostile\\zig.exe" : "/hostile/zig";
    target.executableRealpath = target.executablePath;
    target.executableSha256 = "a".repeat(64);
    target.executableByteLength = 1;
    target.versionStdoutSha256 = "b".repeat(64);
    target.compilerClosureSha256 = "c".repeat(64);
    target.binarySha256 = "d".repeat(64);
    target.binaryByteLength = 1;
    if ("muslSysrootClosureSha256" in target) {
      target.muslSysrootClosureSha256 = "e".repeat(64);
    }
    if ("mingwSysrootClosureSha256" in target) {
      target.mingwSysrootClosureSha256 = "e".repeat(64);
    }
    if ("linkerClosureSha256" in target) {
      target.linkerClosureSha256 = "f".repeat(64);
    }
    if ("peImportAllowlist" in target) {
      target.peImportAllowlist = ["kernel32.dll"];
    }
  }
}

test("BP11 policy bytes are exact and remain HOLD_UNMEASURED", () => {
  assert.equal(POLICY_BYTES.byteLength, 4_792);
  assert.equal(
    sha256(POLICY_BYTES),
    "2b1a6778049db9a42eab5131f69cded03587af61b054e66b890f56e4753d3518",
  );
  assert.equal(validatePolicy(POLICY), true);
});

test("policy encoding is canonical UTF-8 JSON with one final LF", () => {
  assert.equal(POLICY_TEXT.charCodeAt(0) === 0xfeff, false);
  assert.equal(POLICY_TEXT.includes("\r"), false);
  assert.equal(POLICY_TEXT, `${JSON.stringify(POLICY, null, 2)}\n`);
});

test("top-level HOLD, readiness and evidence classification are immutable", () => {
  for (const [field, value] of [
    ["status", "READY"], ["ready", true], ["complete", true],
    ["operative", true], ["exitCode", 0],
    ["evidenceClass", "LOCAL_CANONICAL_OBSERVED"],
    ["networkPolicy", "DOWNLOAD_ALLOWED"],
  ]) assertMutationRejected((candidate) => { candidate[field] = value; });
});

test("strict schema policy cannot be weakened or self-declared away", () => {
  for (const key of Object.keys(SCHEMA_POLICY)) {
    assertMutationRejected((candidate) => {
      candidate.schemaPolicy[key] = false;
    });
  }
  assertMutationRejected((candidate) => {
    candidate.schemaPolicy.extra = true;
  });
});

test("all target compiler, toolchain, sysroot and artifact identities are null", () => {
  for (const [name, target] of Object.entries(POLICY.targets)) {
    assert.equal(target.observed, false, name);
    for (const key of TARGET_KEYS[name]) {
      if (["target", "backend", "observed", "elfImportAllowlist",
        "peImportAllowlist"].includes(key)) continue;
      assert.equal(target[key], null, `${name}:${key}`);
    }
  }
});

test("target set, labels, key order and backend selection are exact", () => {
  assert.deepEqual(Object.keys(POLICY.targets), Object.keys(TARGET_KEYS));
  for (const name of Object.keys(TARGET_KEYS)) {
    assert.deepEqual(Object.keys(POLICY.targets[name]), TARGET_KEYS[name]);
    assert.equal(POLICY.targets[name].target, name);
    assert.equal(POLICY.targets[name].backend, TARGET_BACKENDS[name]);
  }
});

test("unknown, missing and reordered top-level keys fail closed", () => {
  assertMutationRejected((candidate) => { candidate.extra = null; });
  assertMutationRejected((candidate) => { delete candidate.status; });
  const reordered = { status: POLICY.status };
  for (const [key, value] of Object.entries(POLICY)) {
    if (key !== "status") reordered[key] = structuredClone(value);
  }
  assert.throws(() => validatePolicy(reordered),
    /BP11_POLICY_EXACT_SCHEMA_HOLD/u);
});

test("unknown, missing and reordered nested target keys fail closed", () => {
  assertMutationRejected((candidate) => {
    candidate.targets["linux-x64-musl"].extra = null;
  });
  assertMutationRejected((candidate) => {
    delete candidate.targets["windows-x64-gnu"].executablePath;
  });
  assertMutationRejected((candidate) => {
    const target = candidate.targets["native-wsl-linux-x64-musl"];
    candidate.targets["native-wsl-linux-x64-musl"] = {
      backend: target.backend,
      target: target.target,
      ...Object.fromEntries(Object.entries(target).filter(
        ([key]) => !["backend", "target"].includes(key),
      )),
    };
  });
});

test("duplicate JSON keys are rejected before structural validation", () => {
  assert.throws(
    () => parseJsonRejectingDuplicateKeys(
      '{"schema":"iat-b3-mandatory-ci-containment-toolchains/v1","schema":"forged"}',
    ),
    /JSON_DUPLICATE_KEY_HOLD/u,
  );
  assert.throws(
    () => parseJsonRejectingDuplicateKeys(
      '{"targets":{"linux-x64-musl":{"observed":false,"observed":true}}}',
    ),
    /JSON_DUPLICATE_KEY_HOLD/u,
  );
});

test("target swap, identity fill and observed promotion fail closed", () => {
  assertMutationRejected((candidate) => {
    const linux = candidate.targets["linux-x64-musl"];
    candidate.targets["linux-x64-musl"] =
      candidate.targets["windows-x64-gnu"];
    candidate.targets["windows-x64-gnu"] = linux;
  });
  assertMutationRejected((candidate) => {
    candidate.targets["linux-x64-musl"].executableSha256 = "a".repeat(64);
  });
  assertMutationRejected((candidate) => {
    candidate.targets["windows-x64-gnu"].observed = true;
  });
});

test("unmeasured import policy cannot be filled by the packet", () => {
  assertMutationRejected((candidate) => {
    candidate.targets["linux-x64-musl"].elfImportAllowlist = ["libc.so"];
  });
  assertMutationRejected((candidate) => {
    candidate.targets["windows-x64-gnu"].peImportAllowlist = [];
  });
});

test("all observation identities remain null and observations remain false", () => {
  assert.deepEqual(Object.keys(POLICY.observations), OBSERVATION_KEYS);
  for (const key of NULL_OBSERVATION_KEYS) {
    assert.equal(POLICY.observations[key], null, key);
  }
  for (const key of FALSE_OBSERVATION_KEYS) {
    assert.equal(POLICY.observations[key], false, key);
  }
  assertMutationRejected((candidate) => {
    candidate.observations.observerSessionId = "a".repeat(64);
  });
  assertMutationRejected((candidate) => {
    candidate.observations.compilerExecutableObserved = true;
  });
});

test("packet-selected, ambient, environment and hosted trust stay forbidden", () => {
  assert.deepEqual(POLICY.trustBoundary, TRUST_BOUNDARY);
  for (const key of Object.keys(TRUST_BOUNDARY)) {
    if (key === "declaredSource") continue;
    assertMutationRejected((candidate) => {
      candidate.trustBoundary[key] = true;
    });
  }
  assertMutationRejected((candidate) => {
    candidate.trustBoundary.declaredSource = "PACKET_SELECTED";
  });
});

test("download, install, compiler, RPC, key and chain authorization stay false", () => {
  assert.deepEqual(Object.keys(POLICY.authorization), AUTHORIZATION_KEYS);
  for (const key of AUTHORIZATION_KEYS) {
    assert.equal(POLICY.authorization[key], false, key);
    assertMutationRejected((candidate) => {
      candidate.authorization[key] = true;
    });
  }
});

test("blockers are exact, unique, sorted and drift rejecting", () => {
  assert.deepEqual(POLICY.blockers, BLOCKERS);
  assert.deepEqual(POLICY.blockers, [...POLICY.blockers].sort());
  assert.equal(new Set(POLICY.blockers).size, POLICY.blockers.length);
  assertMutationRejected((candidate) => { candidate.blockers.pop(); });
  assertMutationRejected((candidate) => {
    candidate.blockers.push("UNKNOWN_BLOCKER");
  });
  assertMutationRejected((candidate) => {
    [candidate.blockers[0], candidate.blockers[1]] =
      [candidate.blockers[1], candidate.blockers[0]];
  });
});

test("observer requirements cannot be weakened or treated as observations", () => {
  assert.deepEqual(
    Object.keys(POLICY.observerRequirements),
    OBSERVER_REQUIREMENT_KEYS,
  );
  assert.equal(
    Object.values(POLICY.observerRequirements).every((value) => value === true),
    true,
  );
  assertMutationRejected((candidate) => {
    candidate.observerRequirements.externalTrustAnchorSeparateFromPacket = false;
  });
  assert.equal(POLICY.observations.receiptObserved, false);
  assert.equal(POLICY.observations.runtimeObserved, false);
});

test("canonical preflight remains all-false HOLD with both primary targets unmeasured", () => {
  const result = assessNativeContainmentPreflight({ policy: POLICY });
  assert.equal(result.status, "HOLD");
  assert.equal(result.ready, false);
  assert.equal(result.complete, false);
  assert.equal(result.buildAuthorized, false);
  assert.equal(result.compilerObserved, false);
  assert.equal(result.buildExecuted, false);
  assert.equal(result.buildProvenanceObserved, false);
  assert.equal(result.executionProvenanceObserved, false);
  assert.equal(result.runtimeEvidenceObserved, false);
  assert.equal(
    result.blockers.includes("LINUX_X64_MUSL_TOOLCHAIN_UNMEASURED"),
    true,
  );
  assert.equal(
    result.blockers.includes("WINDOWS_X64_GNU_TOOLCHAIN_UNMEASURED"),
    true,
  );
});

test("a fully populated packet is rejected and cannot synthesize evidence", () => {
  const candidate = clonePolicy();
  populatePacketSelectedIdentities(candidate);
  assert.throws(() => validatePolicy(candidate),
    /BP11_TARGET_HEADER_HOLD/u);
  const result = assessNativeContainmentPreflight({ policy: candidate });
  assert.equal(result.status, "HOLD");
  assert.equal(result.ready, false);
  assert.equal(result.complete, false);
  assert.equal(result.buildAuthorized, false);
  assert.equal(result.compilerObserved, false);
  assert.equal(result.buildExecuted, false);
  assert.equal(result.buildProvenanceObserved, false);
  assert.equal(result.executionProvenanceObserved, false);
  assert.equal(result.runtimeEvidenceObserved, false);
  assert.equal(
    result.blockers.includes("DIRECT_AUTHORITY_SOURCE_BINDING_UNOBSERVED"),
    true,
  );
  assert.equal(
    result.blockers.includes("OBSERVER_OWNED_RECEIPT_ADMISSION_UNIMPLEMENTED_HOLD"),
    true,
  );
});

test("BP11 test is static, built-in only, and exposes no execution surface", () => {
  const source = readFileSync(TEST_PATH, "utf8");
  const imports = [...source.matchAll(/^import(?:[\s\S]*?) from "([^"]+)";/gmu)]
    .map((match) => match[1]);
  assert.deepEqual(imports, [
    "node:assert/strict",
    "node:crypto",
    "node:fs",
    "node:path",
    "node:test",
    "node:url",
    "../scripts/lib/iat-b3-mandatory-ci-containment-contract.mjs",
  ]);
  for (const forbidden of [
    ["node:child", "_process"].join(""),
    ["spawn", "Sync"].join(""),
    ["exec", "File"].join(""),
    ["write", "File"].join(""),
    ["append", "File"].join(""),
    ["node:", "net"].join(""),
    ["node:", "http"].join(""),
  ]) assert.equal(source.includes(forbidden), false, forbidden);
});

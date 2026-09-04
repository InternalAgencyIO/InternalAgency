import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN,
  POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_PATHS,
  POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_SCHEMA,
  POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_STATUS,
  canonicalPostCheckpointObserverSourceDesignJson,
  createPostCheckpointObserverSourceDesign,
  parsePostCheckpointObserverSourceDesignJson,
  postCheckpointObserverSourceDesignSafety,
  validatePostCheckpointObserverSourceDesign,
} from "../scripts/lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs";
import {
  IAT_B3_KEY_FREE_CHECKPOINT_SCHEMA,
  createIatB3KeyFreePublicBuildPayloads,
  validateIatB3KeyFreePublicBuildInput,
} from "../scripts/lib/iat-b3-key-free-public-build-input.mjs";

const SITE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT_ROOT = resolve(SITE_ROOT, "../../..");
const SCHEMA_PATH = resolve(
  SITE_ROOT,
  "docs/b3/iat-b3-post-checkpoint-observer-source-design.v1.schema.json",
);
const CONTRACT_PATH = resolve(
  SITE_ROOT,
  "scripts/lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs",
);

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const clone = () => structuredClone(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN);
const rejected = (mutate) => {
  const candidate = clone();
  mutate(candidate);
  assert.throws(
    () => validatePostCheckpointObserverSourceDesign(candidate),
    /exact frozen post-checkpoint observer source design/u,
  );
};

function assertDeepFrozen(value) {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

function allBindings() {
  const { bindings } = POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN;
  return [
    ...bindings.g8oSourceManifest,
    bindings.bp11ToolchainPolicy.policy,
    bindings.bp11ToolchainPolicy.policyTest,
    bindings.k44StructuralContract.library,
    bindings.k44StructuralContract.test,
    bindings.k44StructuralContract.documentation,
    bindings.k44StructuralContract.template,
  ];
}

test("schema const and module freeze the exact source-only design", () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.type, "object");
  assert.deepEqual(schema.const, POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN);
  assert.equal(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.schema, POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_SCHEMA);
  assert.equal(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.status, POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_STATUS);
  assert.equal(validatePostCheckpointObserverSourceDesign(schema.const).status, "HOLD_SOURCE_DESIGN_ONLY");
  assertDeepFrozen(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN);
});

test("factory returns an exact independently frozen packet", () => {
  const first = createPostCheckpointObserverSourceDesign();
  const second = createPostCheckpointObserverSourceDesign();
  assert.notEqual(first, second);
  assert.deepEqual(first, POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN);
  assert.deepEqual(second, POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN);
  assertDeepFrozen(first);
  assertDeepFrozen(second);
});

test("canonical parser accepts only exact sorted JSON with one LF", () => {
  const canonical = canonicalPostCheckpointObserverSourceDesignJson(
    POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN,
  );
  assert.equal(canonical.endsWith("\n"), true);
  assert.equal(canonical.endsWith("\n\n"), false);
  assert.deepEqual(parsePostCheckpointObserverSourceDesignJson(canonical), POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN);
  assert.throws(() => parsePostCheckpointObserverSourceDesignJson(JSON.stringify(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN)), /canonical sorted JSON/u);
  assert.throws(() => parsePostCheckpointObserverSourceDesignJson(`\ufeff${canonical}`), /BOM is forbidden/u);
  assert.throws(() => parsePostCheckpointObserverSourceDesignJson(canonical.replace(/\n/gu, "\r\n")), /canonical sorted JSON/u);
  assert.throws(() => parsePostCheckpointObserverSourceDesignJson(canonical.replace(/\n/gu, "\r")), /canonical sorted JSON/u);
  assert.throws(() => parsePostCheckpointObserverSourceDesignJson(canonical.slice(0, -1)), /canonical sorted JSON/u);
  assert.throws(() => parsePostCheckpointObserverSourceDesignJson(`${canonical}{}`), /unexpected trailing data/u);
  const duplicate = canonical.replace(
    '{"$schema":"./iat-b3-post-checkpoint-observer-source-design.v1.schema.json",',
    '{"$schema":"./iat-b3-post-checkpoint-observer-source-design.v1.schema.json","$schema":"./iat-b3-post-checkpoint-observer-source-design.v1.schema.json",',
  );
  assert.throws(() => parsePostCheckpointObserverSourceDesignJson(duplicate), /duplicate member/u);
});

test("source scope is exactly three new nonexecuting design paths", () => {
  assert.deepEqual(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_PATHS, [
    "projects/star-ascent/site/docs/b3/iat-b3-post-checkpoint-observer-source-design.v1.schema.json",
    "projects/star-ascent/site/scripts/lib/iat-b3-post-checkpoint-observer-source-design-contract.mjs",
    "projects/star-ascent/site/tests/iat-b3-post-checkpoint-observer-source-design-contract.test.mjs",
  ]);
  assert.deepEqual(
    POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.sourceScope.paths,
    POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_PATHS,
  );
  for (const relativePath of POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN_PATHS) {
    const absolutePath = resolve(PROJECT_ROOT, relativePath);
    assert.equal(lstatSync(absolutePath).isSymbolicLink(), false);
    assert.equal(statSync(absolutePath).isFile(), true);
  }
  const capabilityFields = Object.entries(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.sourceScope)
    .filter(([key]) => key.endsWith("Permitted"));
  assert.equal(capabilityFields.length, 8);
  assert.equal(capabilityFields.every(([, value]) => value === false), true);
});

test("all frozen upstream byte bindings reopen exactly", () => {
  for (const expected of allBindings()) {
    const bytes = readFileSync(resolve(PROJECT_ROOT, expected.path));
    assert.equal(bytes.byteLength, expected.byteLength, expected.path);
    assert.equal(sha256(bytes), expected.sha256, expected.path);
  }
});

test("G8O source manifest is independently replayed from the six bound bytes", () => {
  const rows = [...POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.bindings.g8oSourceManifest]
    .sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
  let payloadByteLength = 0;
  const manifestRows = rows.map((expected) => {
    const bytes = readFileSync(resolve(PROJECT_ROOT, expected.path));
    payloadByteLength += bytes.byteLength;
    return `${sha256(bytes)}\0${bytes.byteLength}\0${expected.path}\n`;
  });
  const manifest = Buffer.from(`G8O00_DIRECT_OBSERVER_MANIFEST_V1\n${manifestRows.join("")}`, "utf8");
  assert.equal(sha256(manifest), "4942e2b5c83b44df86da975b07b96b967df02a7f89244d7ec3a316c1c6502647");
  assert.equal(manifest.byteLength, 946);
  assert.equal(rows.length, 6);
  assert.equal(payloadByteLength, 93844);
});

test("K45 and G8C identities remain distinct exact build and observer subjects", () => {
  const { k45SourceCheckpoint, g8cObserverPackage } = POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.bindings;
  assert.deepEqual(k45SourceCheckpoint, {
    headSha: "c73d01092c58152ac396dc580055d93511bf0644",
    treeSha: "fcfd4337cfa4ba35a10e4b65849b42d1f5659d3e",
    cleanCommittedSourceRequired: true,
  });
  assert.equal(g8cObserverPackage.commitSha, "b1c65482aebb31395a763707b02224c38aa2da96");
  assert.equal(g8cObserverPackage.parentCommitSha, k45SourceCheckpoint.headSha);
  assert.notEqual(g8cObserverPackage.treeSha, k45SourceCheckpoint.treeSha);
  assert.equal(g8cObserverPackage.manifestSha256, "4942e2b5c83b44df86da975b07b96b967df02a7f89244d7ec3a316c1c6502647");
  assert.equal(g8cObserverPackage.sourcePathCount, 6);
  assert.equal(g8cObserverPackage.sourcePayloadByteLength, 93844);
});

test("BP11 remains HOLD with every toolchain identity unobserved", () => {
  const policyBinding = POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.bindings.bp11ToolchainPolicy;
  const policy = JSON.parse(readFileSync(resolve(PROJECT_ROOT, policyBinding.policy.path), "utf8"));
  assert.equal(policy.status, "HOLD_UNMEASURED");
  assert.equal(policy.ready, false);
  assert.equal(policy.complete, false);
  assert.equal(policy.operative, false);
  assert.equal(policy.exitCode, 2);
  for (const target of Object.values(policy.targets)) {
    assert.equal(target.observed, false);
    for (const [key, value] of Object.entries(target)) {
      if (/(?:Path|Realpath|Sha256|ByteLength)$/u.test(key)) assert.equal(value, null, key);
    }
  }
  assert.equal(Object.values(policy.observations).every((value) => value === null || value === false), true);
  assert.equal(Object.values(policy.authorization).every((value) => value === false), true);
});

test("K44 five-observer boundary is exact, false, and caller-unclosable", () => {
  const expected = [
    "checkpointDirectlyObservedByThisModule",
    "wallClockDirectlyObservedByThisModule",
    "inputFilesDirectlyObservedByThisModule",
    "productionIdentityInventoryDirectlyObservedByThisModule",
    "priorLaneIdentityInventoryDirectlyObservedByThisModule",
  ];
  assert.deepEqual(
    POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.bindings.k44StructuralContract.directObservationFlags,
    expected,
  );
  assert.deepEqual(
    Object.keys(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.observationDesign.k44DirectObservation),
    expected,
  );
  assert.equal(
    Object.values(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.observationDesign.k44DirectObservation)
      .every((value) => value === false),
    true,
  );
  assert.equal(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.observationDesign.sourceDesignMayCloseObservationBlockers, false);
  const checkpoint = {
    schema: IAT_B3_KEY_FREE_CHECKPOINT_SCHEMA,
    headSha: "07b58cc94d9722c80f549f979f78b013c1794add",
    treeSha: "c13387c8403747f984b0a5fdb749060282905c97",
    b26RunnerSha256: "c34b347b860d23679b39a0e6fdd5b704611b9de79638dde53db8b23dfa7129bf",
    laneId: "iat-b3-build-only-a1",
  };
  const payloads = createIatB3KeyFreePublicBuildPayloads({
    trustedCheckpoint: checkpoint,
    generatedAtUtc: "2026-08-14T06:30:00.000Z",
  });
  const assessment = validateIatB3KeyFreePublicBuildInput({
    identity: payloads.identity,
    declaredGenesis: payloads.declaredGenesis,
    trustedCheckpoint: checkpoint,
    nowUtc: "2026-08-14T06:40:00.000Z",
    forbiddenProductionIds: [],
    previouslyObservedPublicIds: [],
  });
  for (const flag of expected) assert.equal(assessment[flag], false, flag);
  assert.equal(assessment.authorizingBuildInputValidated, false);
  assert.equal(assessment.consumerPromotionPermitted, false);
  assert.equal(assessment.capabilityIssued, false);
  assert.equal(Object.values(assessment.truthBoundary).every((value) => value === false || value === "HOLD"), true);
});

test("five K44 direct-observer blockers remain present once and in order", () => {
  assert.deepEqual(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.blockers.slice(2, 7), [
    "DIRECT_CHECKPOINT_OBSERVER_REQUIRED_BY_CONSUMER",
    "DIRECT_WALL_CLOCK_OBSERVER_REQUIRED_BY_CONSUMER",
    "DIRECT_INPUT_FILE_OBSERVER_REQUIRED_BY_CONSUMER",
    "DIRECT_PRODUCTION_IDENTITY_INVENTORY_OBSERVER_REQUIRED_BY_CONSUMER",
    "DIRECT_PRIOR_LANE_IDENTITY_INVENTORY_OBSERVER_REQUIRED_BY_CONSUMER",
  ]);
  assert.equal(new Set(POST_CHECKPOINT_OBSERVER_SOURCE_DESIGN.blockers).size, 10);
  rejected((candidate) => { candidate.blockers.splice(2, 1); });
  rejected((candidate) => { [candidate.blockers[2], candidate.blockers[3]] = [candidate.blockers[3], candidate.blockers[2]]; });
  rejected((candidate) => { candidate.blockers.push("CALLER_CLOSED"); });
});

test("upstream identity, path, hash, size, and role substitutions reject", () => {
  rejected((candidate) => { candidate.bindings.k45SourceCheckpoint.headSha = candidate.bindings.g8cObserverPackage.commitSha; });
  rejected((candidate) => { candidate.bindings.g8cObserverPackage.treeSha = candidate.bindings.k45SourceCheckpoint.treeSha; });
  rejected((candidate) => { candidate.bindings.g8oSourceManifest[0].sha256 = "0".repeat(64); });
  rejected((candidate) => { candidate.bindings.bp11ToolchainPolicy.policy.byteLength += 1; });
  rejected((candidate) => {
    [candidate.bindings.k44StructuralContract.library, candidate.bindings.k44StructuralContract.test] =
      [candidate.bindings.k44StructuralContract.test, candidate.bindings.k44StructuralContract.library];
  });
  rejected((candidate) => { candidate.sourceScope.paths.push("projects/star-ascent/site/scripts/run-observer.mjs"); });
});

test("live facts and authorization promotions reject", () => {
  rejected((candidate) => { candidate.ready = true; });
  rejected((candidate) => { candidate.observationDesign.implementationPresent = true; });
  rejected((candidate) => { candidate.observationDesign.observerSessionId = "self-authored"; });
  rejected((candidate) => { candidate.observationDesign.toolchainReceipt = {}; });
  rejected((candidate) => { candidate.truthBoundary.toolchainObserved = true; });
  rejected((candidate) => { candidate.truthBoundary.publicDevnetWriteObserved = true; });
  rejected((candidate) => { candidate.truthBoundary.gate8Go = true; });
  rejected((candidate) => { candidate.authorization.sourceDesignMayAuthorizeRuntime = true; });
  rejected((candidate) => { candidate.authorization.sourceDesignMayAuthorizePublicDevnet = true; });
  rejected((candidate) => { candidate.truthBoundary.mainnetStatus = "GO"; });
});

test("unknown, missing, proxy, accessor, sparse, and cyclic input rejects", () => {
  rejected((candidate) => { candidate.extra = true; });
  rejected((candidate) => { delete candidate.truthBoundary.releaseAuthorized; });
  assert.throws(
    () => validatePostCheckpointObserverSourceDesign(new Proxy(clone(), {})),
    /proxy objects are rejected/u,
  );
  const accessor = clone();
  Object.defineProperty(accessor, "status", { enumerable: true, get: () => "HOLD_SOURCE_DESIGN_ONLY" });
  assert.throws(() => validatePostCheckpointObserverSourceDesign(accessor), /accessor properties are rejected/u);
  const sparse = clone();
  sparse.blockers = new Array(10);
  assert.throws(() => validatePostCheckpointObserverSourceDesign(sparse), /sparse arrays are rejected/u);
  const cyclic = clone();
  cyclic.truthBoundary.loop = cyclic;
  assert.throws(() => validatePostCheckpointObserverSourceDesign(cyclic), /cyclic object graph is rejected/u);
});

test("contract imports only inert Node data utilities and exposes HOLD safety", () => {
  const source = readFileSync(CONTRACT_PATH, "utf8");
  const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gmu)].map((match) => match[1]);
  assert.deepEqual(imports, ["node:buffer", "node:util"]);
  assert.doesNotMatch(source, /node:(?:fs|child_process|net|http|https|tls|dgram|worker_threads)/u);
  assert.doesNotMatch(source, /\b(?:fetch|spawn|execFile|writeFile|appendFile|createConnection)\s*\(/u);
  assert.doesNotMatch(source, /\bprocess\s*\./u);
  assert.deepEqual(postCheckpointObserverSourceDesignSafety(), {
    sourceDesignOnly: true,
    observerImplementationPresent: false,
    runtimeObserved: false,
    buildExecuted: false,
    networkContacted: false,
    rpcObserved: false,
    signingObserved: false,
    publicDevnetAuthorized: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
  });
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  linkSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { assessPreDevnetAuthorizationCandidate } from "../scripts/assess-iat-b3-pre-devnet-authorization.mjs";
import { assessPostDevnetEvidence } from "../scripts/assess-iat-b3-post-devnet-evidence.mjs";
import { canonicalSplitGateSha256 } from "../scripts/lib/iat-b3-devnet-gate-split-contract.mjs";
import {
  DIRECT_OBSERVER_MAX_AGGREGATE_BYTES,
  DIRECT_OBSERVER_MAX_RECORD_BYTES,
  DIRECT_OBSERVER_REQUEST_SCHEMA,
  IMMUTABLE_X10_BINDINGS,
  POST_DIRECT_EVIDENCE_CODES,
  POST_DIRECT_EVIDENCE_RECORD_SCHEMA,
  PRE_DIRECT_EVIDENCE_CODES,
  PRE_DIRECT_EVIDENCE_RECORD_SCHEMA,
  canonicalDirectObserverSha256,
  describeCurrentObserverSources,
  directEvidencePayloadSchema,
  directObserverSafety,
  expectedDirectEvidenceArtifactPath,
  expectedDirectEvidencePath,
  expectedDirectEvidenceReceiptPath,
  observeDirectEvidence,
  parseStrictDirectObserverJson,
  readStrictDirectObserverFile,
  validateDirectAssessmentBindings,
  validateDirectEvidenceReceipt,
  validateDirectEvidenceReceiptArtifact,
  validateDirectEvidenceRecord,
  validateDirectObserverRequest,
  validateLegacyPostAssessmentArtifact,
  validateLegacyPreAssessmentArtifact,
  verifyImmutableX10Sources,
} from "../scripts/lib/iat-b3-devnet-direct-evidence-observer-contract.mjs";
import {
  PRE_DIRECT_ASSESSMENT_INPUT_SCHEMA,
  assessPreDevnetDirectEvidence,
} from "../scripts/assess-iat-b3-pre-devnet-direct-evidence.mjs";
import {
  POST_DIRECT_ASSESSMENT_INPUT_SCHEMA,
  assessPostDevnetDirectEvidence,
} from "../scripts/assess-iat-b3-post-devnet-direct-evidence.mjs";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = resolve(TEST_DIR, "..");
const NODE = process.execPath;
const RUN_ID = "1".repeat(64);
const SOURCE_CHECKPOINT = Object.freeze({
  headSha: "c73d01092c58152ac396dc580055d93511bf0644",
  treeSha: "fcfd4337cfa4ba35a10e4b65849b42d1f5659d3e",
  statusPorcelain: "",
});
const OBSERVER_SOURCE_MANIFEST = describeCurrentObserverSources();
assert.notEqual(OBSERVER_SOURCE_MANIFEST, false);
const OBSERVER_PACKAGE = Object.freeze({
  commitSha: "d".repeat(40),
  treeSha: "e".repeat(40),
  parentCommitSha: SOURCE_CHECKPOINT.headSha,
  ...OBSERVER_SOURCE_MANIFEST,
});
const OBSERVER = Object.freeze({
  principal: "devnet_release_audit",
  processId: process.pid,
  parentProcessId: Math.max(1, process.ppid),
  sessionId: "101",
  uid: 1_001,
  gid: 2_001,
  processStartTicks: "100",
  bootId: "11111111-1111-4111-8111-111111111111",
});
const WORKLOAD = Object.freeze({
  principal: "iat_b3_bpl_workload",
  processId: process.pid + 10_000,
  parentProcessId: process.pid,
  sessionId: "202",
  uid: 1_002,
  gid: 2_002,
  processStartTicks: "200",
  bootId: "11111111-1111-4111-8111-111111111111",
});
const PRODUCTION_SOURCE_PATHS = Object.freeze([
  "scripts/lib/iat-b3-devnet-direct-evidence-observer-contract.mjs",
  "scripts/observe-iat-b3-pre-devnet-direct-evidence.mjs",
  "scripts/observe-iat-b3-post-devnet-direct-evidence.mjs",
  "scripts/assess-iat-b3-pre-devnet-direct-evidence.mjs",
  "scripts/assess-iat-b3-post-devnet-direct-evidence.mjs",
]);
const FALSE_FIELDS = Object.freeze([
  "gate8Go",
  "requestAuthorizationPermitted",
  "publicDevnetAuthorizationMayBeRequested",
  "executionAuthorized",
  "publicDevnetAuthorized",
  "signingAuthorized",
  "fundingAuthorized",
  "devnetExecuted",
  "releaseAuthorized",
  "mainnetExecutionAuthorized",
]);

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function temporaryDirectory(t) {
  const directory = mkdtempSync(join(tmpdir(), "iat-b3-direct-observer-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function makeRequest(phase) {
  const codes = phase === "PRE" ? PRE_DIRECT_EVIDENCE_CODES
    : POST_DIRECT_EVIDENCE_CODES;
  return {
    schema: DIRECT_OBSERVER_REQUEST_SCHEMA,
    phase,
    runId: RUN_ID,
    sourceCheckpoint: SOURCE_CHECKPOINT,
    observerPackage: OBSERVER_PACKAGE,
    observer: OBSERVER,
    workload: WORKLOAD,
    observations: codes.map((code, index) => ({
      code,
      path: expectedDirectEvidencePath(RUN_ID, phase, index, code),
      sha256: String(index + 1).padStart(64, "0"),
      byteLength: 256,
    })),
  };
}

function makeRecord(phase, code, capturedAtUnixSeconds) {
  const codes = phase === "PRE" ? PRE_DIRECT_EVIDENCE_CODES
    : POST_DIRECT_EVIDENCE_CODES;
  const index = codes.indexOf(code);
  const payload = {
    schema: directEvidencePayloadSchema(phase, code),
    phase,
    code,
    runId: RUN_ID,
    sourceCheckpoint: SOURCE_CHECKPOINT,
    observerPackage: OBSERVER_PACKAGE,
    workload: WORKLOAD,
    artifactPath: expectedDirectEvidenceArtifactPath(RUN_ID, phase, index, code),
    artifactSha256: "a".repeat(64),
    artifactByteLength: 1_024,
    observationState: "WORKLOAD_ARTIFACT_BYTES_OBSERVED_PENDING_REVIEW",
    directEvidenceObserved: false,
    factAccepted: false,
    authorizationEffect: "NONE",
  };
  return {
    schema: phase === "PRE" ? PRE_DIRECT_EVIDENCE_RECORD_SCHEMA
      : POST_DIRECT_EVIDENCE_RECORD_SCHEMA,
    phase,
    runId: RUN_ID,
    code,
    sourceCheckpoint: SOURCE_CHECKPOINT,
    observerPackage: OBSERVER_PACKAGE,
    workload: WORKLOAD,
    capturedAtUnixSeconds,
    payload,
    payloadSha256: canonicalDirectObserverSha256(
      `IAT_B3_${phase}_${code}_DIRECT_EVIDENCE_PAYLOAD_V1`, payload,
    ),
    payloadByteLength: Buffer.byteLength(JSON.stringify(payload), "utf8"),
    reviewState: "PENDING_INDEPENDENT_RUNTIME_REVIEW",
  };
}

function makeLegacyAssessments() {
  const now = BigInt(Math.floor(Date.now() / 1_000));
  const preInput = { sourceCheckpoint: SOURCE_CHECKPOINT };
  const postInput = { sourceCheckpoint: SOURCE_CHECKPOINT };
  return {
    preInput,
    postInput,
    pre: assessPreDevnetAuthorizationCandidate(preInput),
    post: assessPostDevnetEvidence(postInput, { evaluationUnixSeconds: now }),
  };
}

function assessmentInput(schema, legacy) {
  const pre = schema === PRE_DIRECT_ASSESSMENT_INPUT_SCHEMA;
  return {
    schema,
    expectedRunId: RUN_ID,
    expectedK45SourceCheckpoint: SOURCE_CHECKPOINT,
    expectedObserverPackage: OBSERVER_PACKAGE,
    legacyInput: pre ? legacy.preInput : legacy.postInput,
    legacyAssessment: pre ? legacy.pre : legacy.post,
    directEvidenceReceiptArtifact: null,
  };
}

function assertAllFalse(value) {
  for (const field of FALSE_FIELDS) assert.equal(value[field], false, field);
  assert.equal(value.mainnetStatus, "HOLD");
  assert.equal(value.directEvidenceObserved, false);
  assert.equal(value.directEvidenceAcceptedForAuthorization, false);
}

test("self-contained canonical digest remains byte-compatible with immutable X10", () => {
  const sample = { z: [3, false], a: { value: "bound" } };
  assert.equal(
    canonicalDirectObserverSha256("IAT_B3_DIGEST_COMPATIBILITY_V1", sample),
    canonicalSplitGateSha256("IAT_B3_DIGEST_COMPATIBILITY_V1", sample),
  );
});

test("immutable X10 dependencies are same-handle pinned without being imported by production", () => {
  const observations = verifyImmutableX10Sources();
  assert.notEqual(observations, false);
  assert.equal(observations.length, 4);
  for (const binding of Object.values(IMMUTABLE_X10_BINDINGS)) {
    const bytes = readFileSync(resolve(SITE_ROOT, binding.path));
    assert.equal(bytes.length, binding.byteLength, binding.path);
    assert.equal(sha256(bytes), binding.sha256, binding.path);
  }
});

test("request binds exact run, K45 subject, distinct package, fixed paths, and aggregate cap", () => {
  const request = makeRequest("PRE");
  assert.equal(validateDirectObserverRequest(request, { phase: "PRE" }), true);
  const wrongRun = structuredClone(request);
  wrongRun.runId = "run:cross-run:01";
  assert.equal(validateDirectObserverRequest(wrongRun, { phase: "PRE" }), false);
  const mixedSubject = structuredClone(request);
  mixedSubject.observerPackage.treeSha = SOURCE_CHECKPOINT.treeSha;
  assert.equal(validateDirectObserverRequest(mixedSubject, { phase: "PRE" }), false);
  const arbitraryManifest = structuredClone(request);
  arbitraryManifest.observerPackage.manifestSha256 = "f".repeat(64);
  assert.equal(validateDirectObserverRequest(arbitraryManifest, { phase: "PRE" }), false);
  const callerPath = structuredClone(request);
  callerPath.observations[0].path = "/tmp/caller-selected.json";
  assert.equal(validateDirectObserverRequest(callerPath, { phase: "PRE" }), false);
  const oversized = structuredClone(request);
  for (const entry of oversized.observations) {
    entry.byteLength = DIRECT_OBSERVER_MAX_RECORD_BYTES;
  }
  assert.ok(oversized.observations.reduce((sum, entry) =>
    sum + entry.byteLength, 0) > DIRECT_OBSERVER_MAX_AGGREGATE_BYTES);
  assert.equal(validateDirectObserverRequest(oversized, { phase: "PRE" }), false);
});

test("principal, UID, PID, start-tick, and session collisions fail request validation", () => {
  const request = makeRequest("POST");
  for (const field of [
    "principal", "processId", "sessionId", "uid", "gid", "processStartTicks",
  ]) {
    const collided = structuredClone(request);
    collided.workload[field] = collided.observer[field];
    assert.equal(validateDirectObserverRequest(collided, { phase: "POST" }), false);
  }
  const wrongPrincipal = structuredClone(request);
  wrongPrincipal.workload.principal = "fabricated:workload";
  assert.equal(validateDirectObserverRequest(wrongPrincipal, { phase: "POST" }), false);
});

test("strict evidence record binds phase, run, code, K45, package, workload, and freshness", () => {
  const now = Math.floor(Date.now() / 1_000);
  const record = makeRecord("POST", POST_DIRECT_EVIDENCE_CODES[0], now);
  const context = {
    phase: "POST",
    runId: RUN_ID,
    code: POST_DIRECT_EVIDENCE_CODES[0],
    index: 0,
    sourceCheckpoint: SOURCE_CHECKPOINT,
    observerPackage: OBSERVER_PACKAGE,
    workload: WORKLOAD,
    evaluationUnixSeconds: now,
  };
  assert.equal(validateDirectEvidenceRecord(record, context), true);
  for (const field of ["runId", "code", "phase"]) {
    const changed = structuredClone(record);
    changed[field] = field === "phase" ? "PRE" : `wrong-${field}`;
    assert.equal(validateDirectEvidenceRecord(changed, context), false, field);
  }
  const extra = structuredClone(record);
  extra.observed = true;
  assert.equal(validateDirectEvidenceRecord(extra, context), false);
  const opaque = structuredClone(record);
  delete opaque.payload;
  delete opaque.payloadSha256;
  delete opaque.payloadByteLength;
  opaque.evidenceSha256 = "a".repeat(64);
  opaque.evidenceByteLength = 1_024;
  assert.equal(validateDirectEvidenceRecord(opaque, context), false);
  const stale = structuredClone(record);
  stale.capturedAtUnixSeconds = now - 1_501;
  assert.equal(validateDirectEvidenceRecord(stale, context), false);
  for (const mutation of [
    (candidate) => { candidate.payload.schema = "wrong-payload-schema"; },
    (candidate) => { candidate.payload.factAccepted = true; },
    (candidate) => { candidate.payload.authorizationEffect = "AUTHORIZE"; },
    (candidate) => { candidate.payload.artifactPath = "/tmp/caller-artifact"; },
  ]) {
    const changedPayload = structuredClone(record);
    mutation(changedPayload);
    changedPayload.payloadSha256 = canonicalDirectObserverSha256(
      `IAT_B3_POST_${POST_DIRECT_EVIDENCE_CODES[0]}_DIRECT_EVIDENCE_PAYLOAD_V1`,
      changedPayload.payload,
    );
    assert.equal(validateDirectEvidenceRecord(changedPayload, context), false);
  }
});

test("Windows and synthetic Linux identities fail closed before any receipt exists", () => {
  const request = makeRequest("POST");
  assert.throws(
    () => observeDirectEvidence(request, { phase: "POST" }),
    /LINUX_ONLY_HOLD|RUNTIME_PRINCIPAL_SEPARATION_INVALID/u,
  );
});

test("receipt validator requires all expected bindings and rejects cross-run input", () => {
  assert.equal(validateDirectEvidenceReceipt(null, { phase: "PRE" }), false);
  assert.equal(validateDirectEvidenceReceipt({}, {
    phase: "PRE",
    expectedRunId: "2".repeat(64),
    expectedSourceCheckpoint: SOURCE_CHECKPOINT,
    expectedObserverPackage: OBSERVER_PACKAGE,
  }), false);
  assert.equal(
    expectedDirectEvidenceReceiptPath(RUN_ID, "PRE"),
    `/run/iat-b3-gate8/${RUN_ID}/pre-observer-receipt.json`,
  );
  assert.equal(validateDirectEvidenceReceiptArtifact({
    path: "/tmp/caller-receipt.json",
    sha256: "a".repeat(64),
    byteLength: 1,
  }, {
    phase: "PRE",
    expectedRunId: RUN_ID,
    expectedSourceCheckpoint: SOURCE_CHECKPOINT,
    expectedObserverPackage: OBSERVER_PACKAGE,
  }), false);
  assert.equal(validateDirectAssessmentBindings({
    expectedRunId: RUN_ID,
    expectedK45SourceCheckpoint: SOURCE_CHECKPOINT,
    expectedObserverPackage: OBSERVER_PACKAGE,
  }), true);
  assert.equal(validateDirectAssessmentBindings({
    expectedRunId: RUN_ID,
    expectedK45SourceCheckpoint: SOURCE_CHECKPOINT,
    expectedObserverPackage: {
      ...OBSERVER_PACKAGE,
      treeSha: SOURCE_CHECKPOINT.treeSha,
    },
  }), false);
});

test("strict JSON rejects duplicate members, trailing values, and malformed records", () => {
  assert.throws(
    () => parseStrictDirectObserverJson('{"a":1,"a":2}'),
    /duplicate/iu,
  );
  assert.throws(
    () => parseStrictDirectObserverJson('{"a":1}\n{}'),
    /trailing|JSON/iu,
  );
  assert.throws(() => parseStrictDirectObserverJson('{"a":]'), /JSON|value/iu);
});

test("same-handle control reader rejects BOM and hardlinked inputs", (t) => {
  const directory = temporaryDirectory(t);
  const bom = resolve(directory, "bom.json");
  writeFileSync(bom, Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from("{}\n"),
  ]));
  assert.throws(() => readStrictDirectObserverFile(bom), /BOM_FORBIDDEN/u);
  const source = resolve(directory, "source.json");
  const linked = resolve(directory, "linked.json");
  writeFileSync(source, "{}\n");
  linkSync(source, linked);
  assert.throws(() => readStrictDirectObserverFile(source), /FILE_INVALID/u);
  assert.throws(() => readStrictDirectObserverFile(linked), /FILE_INVALID/u);
});

test("legacy PRE and POST HOLD artifacts are locally digest-validated and preserved", () => {
  const legacy = makeLegacyAssessments();
  assert.equal(validateLegacyPreAssessmentArtifact(
    legacy.pre,
    SOURCE_CHECKPOINT,
    legacy.preInput,
  ), true);
  assert.equal(validateLegacyPostAssessmentArtifact(
    legacy.post,
    SOURCE_CHECKPOINT,
    legacy.postInput,
  ), true);
  const changed = structuredClone(legacy.pre);
  changed.blockers.find(({ code }) =>
    code === "PRE_DIRECT_EVIDENCE_OBSERVER_NOT_IMPLEMENTED").detail = "rewritten";
  changed.assessmentSha256 = canonicalSplitGateSha256(
    "IAT_B3_PRE_DEVNET_ASSESSMENT_V1",
    Object.fromEntries(Object.entries(changed)
      .filter(([key]) => key !== "assessmentSha256")),
  );
  assert.equal(validateLegacyPreAssessmentArtifact(
    changed, SOURCE_CHECKPOINT, legacy.preInput,
  ), false);
  const changedPending = structuredClone(legacy.pre);
  changedPending.preservedPendingFacts[0].state = "REWRITTEN_PENDING_MEANING";
  changedPending.assessmentSha256 = canonicalSplitGateSha256(
    "IAT_B3_PRE_DEVNET_ASSESSMENT_V1",
    Object.fromEntries(Object.entries(changedPending)
      .filter(([key]) => key !== "assessmentSha256")),
  );
  assert.equal(validateLegacyPreAssessmentArtifact(
    changedPending, SOURCE_CHECKPOINT, legacy.preInput,
  ), false);
  const changedPost = structuredClone(legacy.post);
  changedPost.factStates[0].state = "REWRITTEN_EXECUTION_MEANING";
  changedPost.assessmentSha256 = canonicalSplitGateSha256(
    "IAT_B3_POST_DEVNET_ASSESSMENT_V1",
    Object.fromEntries(Object.entries(changedPost)
      .filter(([key]) => key !== "assessmentSha256")),
  );
  assert.equal(validateLegacyPostAssessmentArtifact(
    changedPost, SOURCE_CHECKPOINT, legacy.postInput,
  ), false);
  const deletedPreBlocker = structuredClone(legacy.pre);
  deletedPreBlocker.blockers = deletedPreBlocker.blockers.filter(({ code }) =>
    code !== "PRE_24H_OBSERVATION_INVALID");
  deletedPreBlocker.assessmentSha256 = canonicalSplitGateSha256(
    "IAT_B3_PRE_DEVNET_ASSESSMENT_V1",
    Object.fromEntries(Object.entries(deletedPreBlocker)
      .filter(([key]) => key !== "assessmentSha256")),
  );
  assert.equal(validateLegacyPreAssessmentArtifact(
    deletedPreBlocker, SOURCE_CHECKPOINT, legacy.preInput,
  ), false);
  const rewrittenPreBlocker = structuredClone(legacy.pre);
  rewrittenPreBlocker.blockers.find(({ code }) =>
    code === "PRE_24H_OBSERVATION_INVALID").detail = "rewritten";
  rewrittenPreBlocker.assessmentSha256 = canonicalSplitGateSha256(
    "IAT_B3_PRE_DEVNET_ASSESSMENT_V1",
    Object.fromEntries(Object.entries(rewrittenPreBlocker)
      .filter(([key]) => key !== "assessmentSha256")),
  );
  assert.equal(validateLegacyPreAssessmentArtifact(
    rewrittenPreBlocker, SOURCE_CHECKPOINT, legacy.preInput,
  ), false);
  const deletedPostBlocker = structuredClone(legacy.post);
  deletedPostBlocker.blockers = deletedPostBlocker.blockers.filter(({ code }) =>
    code !== "POST_AUTHORITY_OR_CLEANUP_INVALID");
  deletedPostBlocker.assessmentSha256 = canonicalSplitGateSha256(
    "IAT_B3_POST_DEVNET_ASSESSMENT_V1",
    Object.fromEntries(Object.entries(deletedPostBlocker)
      .filter(([key]) => key !== "assessmentSha256")),
  );
  assert.equal(validateLegacyPostAssessmentArtifact(
    deletedPostBlocker, SOURCE_CHECKPOINT, legacy.postInput,
  ), false);
  const rewrittenPostBlocker = structuredClone(legacy.post);
  rewrittenPostBlocker.blockers.find(({ code }) =>
    code === "POST_AUTHORITY_OR_CLEANUP_INVALID").detail = "rewritten";
  rewrittenPostBlocker.assessmentSha256 = canonicalSplitGateSha256(
    "IAT_B3_POST_DEVNET_ASSESSMENT_V1",
    Object.fromEntries(Object.entries(rewrittenPostBlocker)
      .filter(([key]) => key !== "assessmentSha256")),
  );
  assert.equal(validateLegacyPostAssessmentArtifact(
    rewrittenPostBlocker, SOURCE_CHECKPOINT, legacy.postInput,
  ), false);
  assert.equal(validateLegacyPreAssessmentArtifact(
    legacy.pre, SOURCE_CHECKPOINT, {
      ...legacy.preInput,
      callerAuthoredExtra: true,
    },
  ), false);
});

test("PRE successor preserves exact legacy blockers and remains fully nonauthorizing", () => {
  const legacy = makeLegacyAssessments();
  const assessment = assessPreDevnetDirectEvidence(assessmentInput(
    PRE_DIRECT_ASSESSMENT_INPUT_SCHEMA,
    legacy,
  ));
  assert.equal(assessment.legacyAssessmentValid, true);
  assert.deepEqual(assessment.preservedLegacyBlockers, legacy.pre.blockers);
  assert.equal(assessment.directEvidenceReceiptValid, false);
  assertAllFalse(assessment);
});

test("POST successor preserves exact legacy blockers and remains fully nonauthorizing", () => {
  const legacy = makeLegacyAssessments();
  const assessment = assessPostDevnetDirectEvidence(assessmentInput(
    POST_DIRECT_ASSESSMENT_INPUT_SCHEMA,
    legacy,
  ));
  assert.equal(assessment.legacyAssessmentValid, true);
  assert.deepEqual(assessment.preservedLegacyBlockers, legacy.post.blockers);
  assert.equal(assessment.directEvidenceReceiptValid, false);
  assert.equal(assessment.devnetRehearsalEvidenceAccepted, false);
  assertAllFalse(assessment);
});

test("cross-run, mixed-subject, malformed legacy, and injected assessment paths remain HOLD", () => {
  const legacy = makeLegacyAssessments();
  const crossRun = assessmentInput(PRE_DIRECT_ASSESSMENT_INPUT_SCHEMA, legacy);
  crossRun.expectedRunId = "not-a-run";
  const crossRunAssessment = assessPreDevnetDirectEvidence(crossRun);
  assert.equal(crossRunAssessment.runId, null);
  assert.equal(crossRunAssessment.legacyAssessmentValid, false);
  assertAllFalse(crossRunAssessment);
  const injected = assessPreDevnetDirectEvidence(assessmentInput(
    PRE_DIRECT_ASSESSMENT_INPUT_SCHEMA,
    legacy,
  ), { injectedTestSeam: true });
  assert.equal(injected.legacyAssessmentValid, false);
  assertAllFalse(injected);
});

test("production observer package imports only Node built-ins and its own reviewed contract", () => {
  const forbiddenImport = /from\s+["'](?:\.\/assess-iat-b3-(?:pre|post)-devnet|\.\/iat-b3-devnet-gate-split-contract|node:(?:child_process|http|https|net|tls|dgram|worker_threads))[^"]*["']/u;
  const forbiddenCall = /\b(?:fetch|execFile|spawn|fork)\s*\(/u;
  const secret = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bxox[baprs]-[A-Za-z0-9-]{20,}\b|\bsk-[A-Za-z0-9]{32,}\b/u;
  for (const relativePath of PRODUCTION_SOURCE_PATHS) {
    const source = readFileSync(resolve(SITE_ROOT, relativePath), "utf8");
    assert.doesNotMatch(source, forbiddenImport, relativePath);
    assert.doesNotMatch(source, forbiddenCall, relativePath);
    assert.doesNotMatch(source, secret, relativePath);
  }
  const contract = readFileSync(resolve(SITE_ROOT, PRODUCTION_SOURCE_PATHS[0]), "utf8");
  assert.match(contract, /\/proc\//u);
  assert.match(contract, /DIRECT_OBSERVER_MAX_AGGREGATE_BYTES/u);
  assert.match(contract, /DIRECT_OBSERVER_MAX_OPERATION_NANOSECONDS/u);
  assert.equal(directObserverSafety().x10ExecutedByThisPackage, false);
  assert.equal(directObserverSafety().fixedX10InputOutputOracleOnly, true);
  assert.equal(directObserverSafety().workloadArtifactFactsAccepted, false);
  assert.equal(directObserverSafety().observerOwnedReceiptArtifactRequired, true);
});

test("Linux-only persistence, owner, re-enumeration, replacement, and drift guards are source-bound", () => {
  const source = readFileSync(resolve(SITE_ROOT, PRODUCTION_SOURCE_PATHS[0]), "utf8");
  assert.ok((source.match(/verifyRunDirectory\(/gu) ?? []).length >= 5);
  assert.ok((source.match(/validateLiveRuntimeSeparation\(/gu) ?? []).length >= 5);
  assert.match(source, /sameStat\(beforePath, beforeHandle\)/u);
  assert.match(source, /sameStat\(beforeHandle, afterHandle\)/u);
  assert.match(source, /sameStat\(afterHandle, afterPath\)/u);
  assert.match(source, /openSync\(path, "wx", 0o640\)/u);
  assert.match(source, /fsyncSync\(handle\)/u);
  assert.match(source, /stat\.uid !== BigInt\(process\.getuid\(\)\)/u);
  assert.match(source, /String\(receipt\?\.observer\?\.uid\) !== result\.identity\.uid/u);
  assert.match(source, /String\(receipt\?\.observer\?\.gid\) !== result\.identity\.gid/u);
  assert.match(source, /if \(created\)[\s\S]*unlinkSync\(path\)/u);
});

test("observer CLI emits no partial JSON for duplicate-key input", (t) => {
  const input = resolve(temporaryDirectory(t), "duplicate.json");
  writeFileSync(input, '{"schema":"x","schema":"y"}\n');
  const result = spawnSync(NODE, [
    resolve(SITE_ROOT, "scripts/observe-iat-b3-pre-devnet-direct-evidence.mjs"),
    "--input",
    input,
  ], { encoding: "utf8", timeout: 10_000 });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /duplicate/iu);
});

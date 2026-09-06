#!/usr/bin/env node

import { isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  IMMUTABLE_X10_BINDINGS,
  POST_DIRECT_ASSESSMENT_SCHEMA,
  POST_LEGACY_OBSERVER_BLOCKER,
  canonicalDirectObserverSha256,
  directObserverSafety,
  exactKeys,
  readStrictDirectObserverFile,
  validateDirectAssessmentBindings,
  readDirectEvidenceReceiptArtifact,
  validateLegacyPostAssessmentArtifact,
  verifyImmutableX10Sources,
} from "./lib/iat-b3-devnet-direct-evidence-observer-contract.mjs";

export const POST_DIRECT_ASSESSMENT_INPUT_SCHEMA =
  "iat-b3-post-devnet-direct-evidence-assessment-input/v1";

const INPUT_KEYS = Object.freeze([
  "schema",
  "expectedRunId",
  "expectedK45SourceCheckpoint",
  "expectedObserverPackage",
  "legacyInput",
  "legacyAssessment",
  "directEvidenceReceiptArtifact",
]);

function blocker(code, detail) {
  return Object.freeze({ code, detail });
}

function mergeBlockers(...groups) {
  const byCode = new Map();
  for (const entry of groups.flat()) {
    if (!byCode.has(entry.code)) byCode.set(entry.code, entry);
  }
  return Object.freeze([...byCode.values()].sort((left, right) =>
    left.code.localeCompare(right.code) || left.detail.localeCompare(right.detail)));
}

export function assessPostDevnetDirectEvidence(input, {
  injectedTestSeam = false,
} = {}) {
  const inputShapeValid = !injectedTestSeam
    && exactKeys(input, INPUT_KEYS)
    && input.schema === POST_DIRECT_ASSESSMENT_INPUT_SCHEMA
    && validateDirectAssessmentBindings(input);
  const immutableSourcesValid = inputShapeValid
    && verifyImmutableX10Sources() !== false;
  const legacyAssessmentValid = immutableSourcesValid
    && validateLegacyPostAssessmentArtifact(
      input.legacyAssessment,
      input.expectedK45SourceCheckpoint,
      input.legacyInput,
    );
  const directEvidenceReceiptArtifact = legacyAssessmentValid
    && readDirectEvidenceReceiptArtifact(input.directEvidenceReceiptArtifact, {
      phase: "POST",
      expectedRunId: input.expectedRunId,
      expectedSourceCheckpoint: input.expectedK45SourceCheckpoint,
      expectedObserverPackage: input.expectedObserverPackage,
    });
  const directEvidenceReceiptValid = directEvidenceReceiptArtifact !== false;
  const preservedLegacyBlockers = legacyAssessmentValid
    ? Object.freeze([...input.legacyAssessment.blockers])
    : Object.freeze([POST_LEGACY_OBSERVER_BLOCKER]);
  const blockers = mergeBlockers(
    preservedLegacyBlockers,
    legacyAssessmentValid ? [] : [blocker(
      "POST_X10_LEGACY_ASSESSMENT_UNSATISFIED",
      "an exact digest-valid immutable-X10 HOLD assessment bound to the K45 subject is required",
    )],
    directEvidenceReceiptValid ? [blocker(
      "POST_DIRECT_EVIDENCE_RUNTIME_REVIEW_REQUIRED",
      "a fresh receipt is structurally bound but source code cannot accept public execution evidence",
    )] : [blocker(
      "POST_DIRECT_EVIDENCE_RECEIPT_UNSATISFIED",
      "an exact run-bound, package-bound, Linux principal-separated six-record receipt is required",
    )],
    [blocker(
      "POST_DIRECT_EVIDENCE_SOURCE_ONLY_NONAUTHORIZING",
      "this successor is source scaffolding only and cannot accept Devnet or release evidence",
    )],
  );
  const withoutDigest = {
    schema: POST_DIRECT_ASSESSMENT_SCHEMA,
    status: "HOLD",
    runId: inputShapeValid ? input.expectedRunId : null,
    sourceCheckpoint: inputShapeValid ? input.expectedK45SourceCheckpoint : null,
    observerPackage: inputShapeValid ? input.expectedObserverPackage : null,
    immutableX10Bindings: IMMUTABLE_X10_BINDINGS,
    immutableX10SourcesValid: immutableSourcesValid,
    legacyAssessmentSha256: legacyAssessmentValid
      ? input.legacyAssessment.assessmentSha256 : null,
    legacyAssessmentValid,
    directEvidenceReceiptSha256: directEvidenceReceiptValid
      ? directEvidenceReceiptArtifact.receipt.receiptSha256 : null,
    directEvidenceReceiptValid,
    directEvidenceObserved: false,
    directEvidenceAcceptedForAuthorization: false,
    sourceContractImplemented: true,
    preservedLegacyBlockers,
    blockers,
    gate8Go: false,
    requestAuthorizationPermitted: false,
    publicDevnetAuthorizationMayBeRequested: false,
    executionAuthorized: false,
    publicDevnetAuthorized: false,
    signingAuthorized: false,
    fundingAuthorized: false,
    devnetExecuted: false,
    devnetRehearsalEvidenceAccepted: false,
    releaseAuthorized: false,
    mainnetExecutionAuthorized: false,
    mainnetStatus: "HOLD",
    safety: directObserverSafety(),
  };
  return Object.freeze({
    ...withoutDigest,
    assessmentSha256: canonicalDirectObserverSha256(
      "IAT_B3_POST_DIRECT_EVIDENCE_ASSESSMENT_V1",
      withoutDigest,
    ),
  });
}

export function parsePostDirectAssessmentArguments(arguments_) {
  if (!Array.isArray(arguments_) || arguments_.length !== 2
    || arguments_[0] !== "--input" || typeof arguments_[1] !== "string"
    || !isAbsolute(arguments_[1])) {
    throw new Error(
      "Usage: assess-iat-b3-post-devnet-direct-evidence.mjs --input <absolute-input.json>",
    );
  }
  return Object.freeze({ inputPath: arguments_[1] });
}

export function runPostDirectAssessment({ inputPath } = {}) {
  const input = readStrictDirectObserverFile(
    inputPath,
    "IAT_B3_POST_DIRECT_ASSESSMENT_INPUT",
  );
  const assessment = assessPostDevnetDirectEvidence(input);
  process.stdout.write(`${JSON.stringify(assessment, null, 2)}\n`);
  return assessment;
}

if (process.argv[1]
  && pathToFileURL(fileURLToPath(import.meta.url)).href
    === pathToFileURL(process.argv[1]).href) {
  try {
    runPostDirectAssessment(parsePostDirectAssessmentArguments(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "POST_DIRECT_ASSESSMENT_ERROR"}\n`);
    process.exitCode = 1;
  }
}

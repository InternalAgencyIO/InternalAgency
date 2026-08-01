/**
 * Validates compact UTF-8 upper-bound and illegal-lead evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateUtf8BoundaryAudit } from "./generate-settlement-contention-composition-utf8-boundary-audit.mjs";
import { UTF8_BOUNDARY_RULES } from "./settlement-contention-composition-transport-limits.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-utf8-boundary-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadUtf8BoundaryAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateUtf8BoundaryAudit(artifact = loadUtf8BoundaryAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "UTF-8 boundary version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-utf8-boundary-v1", "UTF-8 boundary ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "UTF-8 boundary HOLD drift");
  expect(JSON.stringify(generateUtf8BoundaryAudit()) === JSON.stringify(artifact), "UTF-8 boundary audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "UTF8_UPPER_BOUND_AND_ILLEGAL_LEADS", "UTF-8 boundary mode drift");
  expect(JSON.stringify(contract.utf8BoundaryRules) === JSON.stringify(UTF8_BOUNDARY_RULES), "UTF-8 boundary rules drift");
  expect(contract.acceptedControlCount === 4 && contract.rejectionCount === 16, "UTF-8 boundary counts drift");
  expect(["outOfRangeCaseCount", "obsoleteLongFormCaseCount", "illegalFeFfLeadCaseCount", "redundantContinuationCaseCount"].every((field) => contract[field] === 4), "UTF-8 boundary family counts drift");
  for (const field of ["boundaryScalarsAccepted", "outOfRangeRejectedBeforeJson", "obsoleteLongFormsRejectedBeforeJson", "illegalFeFfLeadsRejectedBeforeJson", "redundantContinuationsRejectedBeforeJson"]) expect(contract[field] === true, `UTF-8 boundary contract ${field} drift`);
  for (const field of ["serializedByteSequencesStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) expect(contract[field] === false, `UTF-8 boundary contract ${field} drift`);
  expect(contract.activationEffect === "NONE", "UTF-8 boundary activation effect drift");
  const controls = Array.isArray(artifact?.controls) ? artifact.controls : [];
  const rejections = Array.isArray(artifact?.rejections) ? artifact.rejections : [];
  expect(controls.length === 4, "UTF-8 boundary control count drift");
  expect(rejections.length === 16, "UTF-8 boundary rejection count drift");
  expect(controls.every((item) => item.utf8DecodingSucceeded === true && item.acceptedAtParser === true && item.candidateStored === false && item.mutationEvaluated === false), "UTF-8 boundary control claim drift");
  expect(rejections.every((item) => item.observedError === "INVALID_UTF8" && item.utf8DecodingSucceeded === false && item.jsonParsingAttempted === false && item.rejectedBeforeCandidate === true && item.candidateProduced === false && item.mutationEvaluated === false), "UTF-8 boundary rejection claim drift");
  expect(new Set(rejections.map((item) => item.caseId)).size === 16, "UTF-8 boundary case ID collision");
  for (const family of ["OUT_OF_RANGE_SCALAR_UTF8", "OBSOLETE_FIVE_SIX_BYTE_PREFIX", "ILLEGAL_FE_FF_LEAD", "REDUNDANT_CONTINUATION_RUN"]) expect(rejections.filter((item) => item.family === family).length === 4, `UTF-8 boundary ${family} coverage drift`);
  const summary = artifact?.summary ?? {};
  expect(summary.acceptedControlCount === "4" && summary.rejectionCount === "16", "UTF-8 boundary summary counts drift");
  expect(summary.allBoundaryControlsAccepted === true && summary.allIllegalByteSequencesRejectedBeforeJson === true, "UTF-8 boundary summary outcome drift");
  expect(summary.controlSetCommitmentSha256 === canonicalSha256(controls), "UTF-8 boundary control-set drift");
  expect(summary.rejectionSetCommitmentSha256 === canonicalSha256(rejections), "UTF-8 boundary rejection-set drift");
  expect(summary.combinedReplayCommitmentSha256 === canonicalSha256({ controls, rejections }), "UTF-8 boundary combined replay drift");
  for (const field of ["serializedByteSequencesStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `UTF-8 boundary summary ${field} drift`);
  expect(summary.activationEffect === "NONE", "UTF-8 boundary summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateUtf8BoundaryAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("UTF-8 boundary audit validated: exact scalar boundaries accept and sixteen illegal range/lead/continuation sequences reject before JSON, network NONE.");
  }
}

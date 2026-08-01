/**
 * Validates compact strict-delimiter and JSON-whitespace evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateDelimiterWhitespaceAudit } from "./generate-settlement-contention-composition-delimiter-whitespace-audit.mjs";
import { DELIMITER_WHITESPACE_RULES } from "./settlement-contention-composition-transport-limits.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-delimiter-whitespace-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadDelimiterWhitespaceAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateDelimiterWhitespaceAudit(artifact = loadDelimiterWhitespaceAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "delimiter version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-delimiter-whitespace-v1", "delimiter ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "delimiter HOLD drift");
  expect(JSON.stringify(generateDelimiterWhitespaceAudit()) === JSON.stringify(artifact), "delimiter audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "STRICT_SINGLE_DOCUMENT_JSON_DELIMITERS", "delimiter mode drift");
  expect(JSON.stringify(contract.delimiterWhitespaceRules) === JSON.stringify(DELIMITER_WHITESPACE_RULES), "delimiter rules drift");
  expect(contract.acceptedControlCount === 4 && contract.rejectionCount === 16, "delimiter counts drift");
  expect(contract.bomCaseCount === 3 && contract.unicodeWhitespaceCaseCount === 7 && contract.trailingValueCaseCount === 3 && contract.concatenatedDocumentCaseCount === 3, "delimiter family counts drift");
  for (const field of ["standardWhitespaceAccepted", "bomRejectedBeforeCandidate", "unicodeWhitespaceRejectedBeforeCandidate", "trailingValuesRejectedBeforeCandidate", "concatenatedDocumentsRejectedBeforeCandidate"]) expect(contract[field] === true, `delimiter contract ${field} drift`);
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) expect(contract[field] === false, `delimiter contract ${field} drift`);
  expect(contract.activationEffect === "NONE", "delimiter activation effect drift");
  const controls = Array.isArray(artifact?.controls) ? artifact.controls : [];
  const rejections = Array.isArray(artifact?.rejections) ? artifact.rejections : [];
  expect(controls.length === 4, "delimiter control count drift");
  expect(rejections.length === 16, "delimiter rejection count drift");
  expect(controls.every((item) => item.acceptedAtParser === true && item.candidateStored === false && item.mutationEvaluated === false), "delimiter control claim drift");
  expect(rejections.every((item) => item.expectedError === "MALFORMED_JSON" && item.observedError === "MALFORMED_JSON" && item.rejectedBeforeCandidate === true && item.candidateProduced === false && item.mutationEvaluated === false), "delimiter rejection released candidate");
  expect(new Set(rejections.map((item) => item.caseId)).size === 16, "delimiter case ID collision");
  const summary = artifact?.summary ?? {};
  expect(summary.acceptedControlCount === "4" && summary.rejectionCount === "16", "delimiter summary counts drift");
  expect(summary.allStandardWhitespaceControlsAccepted === true && summary.allAmbiguousDelimitersRejectedBeforeCandidate === true, "delimiter summary outcome drift");
  expect(summary.controlSetCommitmentSha256 === canonicalSha256(controls), "delimiter control-set drift");
  expect(summary.rejectionSetCommitmentSha256 === canonicalSha256(rejections), "delimiter rejection-set drift");
  expect(summary.combinedReplayCommitmentSha256 === canonicalSha256({ controls, rejections }), "delimiter combined replay drift");
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `delimiter summary ${field} drift`);
  expect(summary.activationEffect === "NONE", "delimiter summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateDelimiterWhitespaceAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Delimiter audit validated: BOM, Unicode whitespace, trailing values, and concatenated documents reject before candidate production, network NONE.");
  }
}

/**
 * Validates compact fatal UTF-8 byte-ingress evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateFatalUtf8IngressAudit } from "./generate-settlement-contention-composition-fatal-utf8-ingress-audit.mjs";
import { FATAL_UTF8_INGRESS_RULES } from "./settlement-contention-composition-transport-limits.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-fatal-utf8-ingress-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadFatalUtf8IngressAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateFatalUtf8IngressAudit(artifact = loadFatalUtf8IngressAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "fatal UTF-8 version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-fatal-utf8-ingress-v1", "fatal UTF-8 ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "fatal UTF-8 HOLD drift");
  expect(JSON.stringify(generateFatalUtf8IngressAudit()) === JSON.stringify(artifact), "fatal UTF-8 audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "FATAL_UTF8_BYTE_INGRESS", "fatal UTF-8 mode drift");
  expect(JSON.stringify(contract.fatalUtf8IngressRules) === JSON.stringify(FATAL_UTF8_INGRESS_RULES), "fatal UTF-8 rules drift");
  expect(contract.acceptedControlCount === 4 && contract.rejectionCount === 16, "fatal UTF-8 counts drift");
  expect(["truncatedCaseCount", "overlongCaseCount", "surrogateEncodedCaseCount", "invalidContinuationCaseCount"].every((field) => contract[field] === 4), "fatal UTF-8 family counts drift");
  for (const field of ["validScalarWidthsAccepted", "truncatedRejectedBeforeJson", "overlongRejectedBeforeJson", "surrogateEncodedRejectedBeforeJson", "invalidContinuationsRejectedBeforeJson"]) expect(contract[field] === true, `fatal UTF-8 contract ${field} drift`);
  for (const field of ["serializedByteSequencesStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) expect(contract[field] === false, `fatal UTF-8 contract ${field} drift`);
  expect(contract.activationEffect === "NONE", "fatal UTF-8 activation effect drift");
  const controls = Array.isArray(artifact?.controls) ? artifact.controls : [];
  const rejections = Array.isArray(artifact?.rejections) ? artifact.rejections : [];
  expect(controls.length === 4, "fatal UTF-8 control count drift");
  expect(rejections.length === 16, "fatal UTF-8 rejection count drift");
  expect(controls.every((item) => item.utf8DecodingSucceeded === true && item.acceptedAtParser === true && item.candidateStored === false && item.mutationEvaluated === false), "fatal UTF-8 control claim drift");
  expect(rejections.every((item) => item.observedError === "INVALID_UTF8" && item.utf8DecodingSucceeded === false && item.jsonParsingAttempted === false && item.rejectedBeforeCandidate === true && item.candidateProduced === false && item.mutationEvaluated === false), "fatal UTF-8 rejection boundary drift");
  expect(new Set(rejections.map((item) => item.caseId)).size === 16, "fatal UTF-8 case ID collision");
  for (const family of ["TRUNCATED_UTF8", "OVERLONG_UTF8", "SURROGATE_ENCODED_UTF8", "INVALID_CONTINUATION_UTF8"]) expect(rejections.filter((item) => item.family === family).length === 4, `fatal UTF-8 ${family} coverage drift`);
  const summary = artifact?.summary ?? {};
  expect(summary.acceptedControlCount === "4" && summary.rejectionCount === "16", "fatal UTF-8 summary counts drift");
  expect(summary.allValidScalarWidthControlsAccepted === true && summary.allMalformedByteSequencesRejectedBeforeJson === true, "fatal UTF-8 summary outcome drift");
  expect(summary.controlSetCommitmentSha256 === canonicalSha256(controls), "fatal UTF-8 control-set drift");
  expect(summary.rejectionSetCommitmentSha256 === canonicalSha256(rejections), "fatal UTF-8 rejection-set drift");
  expect(summary.combinedReplayCommitmentSha256 === canonicalSha256({ controls, rejections }), "fatal UTF-8 combined replay drift");
  for (const field of ["serializedByteSequencesStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `fatal UTF-8 summary ${field} drift`);
  expect(summary.activationEffect === "NONE", "fatal UTF-8 summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateFatalUtf8IngressAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Fatal UTF-8 ingress audit validated: valid scalar widths accept and sixteen malformed byte sequences reject before JSON, network NONE.");
  }
}

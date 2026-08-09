/**
 * Validates compact UTF-8 BOM-position evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateUtf8BomPositionAudit } from "./generate-settlement-contention-composition-utf8-bom-position-audit.mjs";
import { UTF8_BOM_POSITION_RULES } from "./settlement-contention-composition-transport-limits.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-utf8-bom-position-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadUtf8BomPositionAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateUtf8BomPositionAudit(artifact = loadUtf8BomPositionAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "UTF-8 BOM-position version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-utf8-bom-position-v1", "UTF-8 BOM-position ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "UTF-8 BOM-position HOLD drift");
  expect(JSON.stringify(generateUtf8BomPositionAudit()) === JSON.stringify(artifact), "UTF-8 BOM-position audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "UTF8_BOM_POSITION_DELIMITER_BOUNDARY", "UTF-8 BOM-position mode drift");
  expect(JSON.stringify(contract.utf8BomPositionRules) === JSON.stringify(UTF8_BOM_POSITION_RULES), "UTF-8 BOM-position rules drift");
  expect(contract.acceptedControlCount === 1 && contract.rejectionCount === 3, "UTF-8 BOM-position counts drift");
  expect(contract.leadingBomCaseCount === 1 && contract.postWhitespaceBomCaseCount === 1 && contract.trailingBomCaseCount === 1, "UTF-8 BOM-position family counts drift");
  for (const field of ["bomScalarInsideStringAccepted", "bomBytesPreservedByDecoder", "leadingBomRejectedByDelimiterRule", "postWhitespaceBomRejectedByDelimiterRule", "trailingBomRejectedByDelimiterRule"]) expect(contract[field] === true, `UTF-8 BOM-position contract ${field} drift`);
  for (const field of ["serializedByteSequencesStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) expect(contract[field] === false, `UTF-8 BOM-position contract ${field} drift`);
  expect(contract.activationEffect === "NONE", "UTF-8 BOM-position activation effect drift");
  const controls = Array.isArray(artifact?.controls) ? artifact.controls : [];
  const rejections = Array.isArray(artifact?.rejections) ? artifact.rejections : [];
  expect(controls.length === 1, "UTF-8 BOM-position control count drift");
  expect(rejections.length === 3, "UTF-8 BOM-position rejection count drift");
  expect(controls.every((item) => item.utf8DecodingSucceeded === true && item.acceptedAtParser === true && item.candidateStored === false && item.mutationEvaluated === false), "UTF-8 BOM-position control claim drift");
  expect(rejections.every((item) => item.observedError === "MALFORMED_JSON" && item.utf8DecodingSucceeded === true && item.jsonParsingAttempted === true && item.rejectedBeforeCandidate === true && item.candidateProduced === false && item.mutationEvaluated === false), "UTF-8 BOM-position rejection claim drift");
  expect(new Set(rejections.map((item) => item.caseId)).size === 3, "UTF-8 BOM-position case ID collision");
  expect(JSON.stringify(rejections.map((item) => item.position)) === JSON.stringify(["LEADING", "POST_WHITESPACE", "TRAILING"]), "UTF-8 BOM-position coverage drift");
  const summary = artifact?.summary ?? {};
  expect(summary.acceptedControlCount === "1" && summary.rejectionCount === "3", "UTF-8 BOM-position summary counts drift");
  expect(summary.bomInsideStringAccepted === true && summary.allDelimiterBomPositionsRejectedAfterDecode === true, "UTF-8 BOM-position summary outcome drift");
  expect(summary.controlSetCommitmentSha256 === canonicalSha256(controls), "UTF-8 BOM-position control-set drift");
  expect(summary.rejectionSetCommitmentSha256 === canonicalSha256(rejections), "UTF-8 BOM-position rejection-set drift");
  expect(summary.combinedReplayCommitmentSha256 === canonicalSha256({ controls, rejections }), "UTF-8 BOM-position combined replay drift");
  for (const field of ["serializedByteSequencesStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `UTF-8 BOM-position summary ${field} drift`);
  expect(summary.activationEffect === "NONE", "UTF-8 BOM-position summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateUtf8BomPositionAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("UTF-8 BOM-position audit validated: one in-string scalar accepts and three decoded delimiter positions reject, network NONE.");
  }
}

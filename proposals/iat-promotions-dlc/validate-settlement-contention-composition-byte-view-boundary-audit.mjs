/**
 * Validates compact byte-view boundary evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateByteViewBoundaryAudit } from "./generate-settlement-contention-composition-byte-view-boundary-audit.mjs";
import { BYTE_VIEW_BOUNDARY_RULES } from "./settlement-contention-composition-transport-limits.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-byte-view-boundary-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadByteViewBoundaryAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateByteViewBoundaryAudit(artifact = loadByteViewBoundaryAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "byte-view boundary version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-byte-view-boundary-v1", "byte-view boundary ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "byte-view boundary HOLD drift");
  expect(JSON.stringify(generateByteViewBoundaryAudit()) === JSON.stringify(artifact), "byte-view boundary audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "UINT8ARRAY_VISIBLE_BYTE_BOUNDARY", "byte-view boundary mode drift");
  expect(JSON.stringify(contract.byteViewBoundaryRules) === JSON.stringify(BYTE_VIEW_BOUNDARY_RULES), "byte-view boundary rules drift");
  expect(contract.acceptedControlCount === 3 && contract.rejectionCount === 4, "byte-view boundary counts drift");
  for (const field of ["nonzeroOffsetAccepted", "boundedLengthAccepted", "outsideSentinelsExcluded", "wrongTypesRejectedBeforeDecode"]) expect(contract[field] === true, `byte-view boundary contract ${field} drift`);
  for (const field of ["backingByteSequencesStored", "visibleByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) expect(contract[field] === false, `byte-view boundary contract ${field} drift`);
  expect(contract.activationEffect === "NONE", "byte-view boundary activation effect drift");
  const controls = Array.isArray(artifact?.controls) ? artifact.controls : [];
  const rejections = Array.isArray(artifact?.rejections) ? artifact.rejections : [];
  expect(controls.length === 3, "byte-view boundary control count drift");
  expect(rejections.length === 4, "byte-view boundary rejection count drift");
  expect(controls.every((item) => item.inputType === "Uint8Array" && item.acceptedAtParser === true && item.candidateStored === false && item.mutationEvaluated === false), "byte-view boundary control claim drift");
  expect(rejections.every((item) => item.observedError === "INVALID_BYTE_VIEW" && item.utf8DecodingAttempted === false && item.jsonParsingAttempted === false && item.rejectedBeforeCandidate === true && item.candidateProduced === false && item.mutationEvaluated === false), "byte-view boundary rejection claim drift");
  expect(JSON.stringify(rejections.map((item) => item.inputType)) === JSON.stringify(["ArrayBuffer", "DataView", "string", "Array<number>"]), "byte-view boundary rejection coverage drift");
  const summary = artifact?.summary ?? {};
  expect(summary.acceptedControlCount === "3" && summary.rejectionCount === "4", "byte-view boundary summary counts drift");
  expect(summary.allVisibleByteControlsAccepted === true && summary.allWrongTypesRejectedBeforeDecode === true, "byte-view boundary summary outcome drift");
  expect(summary.controlSetCommitmentSha256 === canonicalSha256(controls), "byte-view boundary control-set drift");
  expect(summary.rejectionSetCommitmentSha256 === canonicalSha256(rejections), "byte-view boundary rejection-set drift");
  expect(summary.combinedReplayCommitmentSha256 === canonicalSha256({ controls, rejections }), "byte-view boundary combined replay drift");
  for (const field of ["backingByteSequencesStored", "visibleByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `byte-view boundary summary ${field} drift`);
  expect(summary.activationEffect === "NONE", "byte-view boundary summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateByteViewBoundaryAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Byte-view boundary audit validated: three Uint8Array view controls accept and four wrong input types reject before UTF-8 decoding, network NONE.");
  }
}

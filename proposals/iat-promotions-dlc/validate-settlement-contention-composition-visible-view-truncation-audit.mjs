/**
 * Validates compact visible-view truncation evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateVisibleViewTruncationAudit } from "./generate-settlement-contention-composition-visible-view-truncation-audit.mjs";
import { VISIBLE_VIEW_TRUNCATION_RULES } from "./settlement-contention-composition-transport-limits.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-visible-view-truncation-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadVisibleViewTruncationAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateVisibleViewTruncationAudit(artifact = loadVisibleViewTruncationAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "visible-view truncation version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-visible-view-truncation-v1", "visible-view truncation ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "visible-view truncation HOLD drift");
  expect(JSON.stringify(generateVisibleViewTruncationAudit()) === JSON.stringify(artifact), "visible-view truncation audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "UINT8ARRAY_VISIBLE_VIEW_TRUNCATION", "visible-view truncation mode drift");
  expect(JSON.stringify(contract.visibleViewTruncationRules) === JSON.stringify(VISIBLE_VIEW_TRUNCATION_RULES), "visible-view truncation rules drift");
  expect(contract.acceptedControlCount === 1 && contract.rejectionCount === 4, "visible-view truncation counts drift");
  for (const field of ["fullViewAccepted", "emptyViewRejected", "prefixOnlyViewRejected", "suffixOnlyViewRejected", "oneByteShortViewRejected", "outsideViewBytesExcluded", "truncationsRejectedAfterDecode"]) expect(contract[field] === true, `visible-view truncation contract ${field} drift`);
  for (const field of ["backingByteSequencesStored", "visibleByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) expect(contract[field] === false, `visible-view truncation contract ${field} drift`);
  expect(contract.activationEffect === "NONE", "visible-view truncation activation effect drift");
  const controls = Array.isArray(artifact?.controls) ? artifact.controls : [];
  const rejections = Array.isArray(artifact?.rejections) ? artifact.rejections : [];
  expect(controls.length === 1, "visible-view truncation control count drift");
  expect(rejections.length === 4, "visible-view truncation rejection count drift");
  expect(controls.every((item) => item.inputType === "Uint8Array" && item.byteOffset === 0 && item.byteLength === item.backingByteLength && item.acceptedAtParser === true && item.candidateStored === false && item.mutationEvaluated === false), "visible-view truncation control claim drift");
  expect(JSON.stringify(rejections.map((item) => item.family)) === JSON.stringify(["EMPTY_VIEW", "PREFIX_ONLY_VIEW", "SUFFIX_ONLY_VIEW", "ONE_BYTE_SHORT_VIEW"]), "visible-view truncation family coverage drift");
  expect(rejections.every((item) => item.inputType === "Uint8Array" && item.observedError === "MALFORMED_JSON" && item.utf8DecodingSucceeded === true && item.jsonParsingAttempted === true && item.rejectedBeforeCandidate === true && item.candidateProduced === false && item.mutationEvaluated === false), "visible-view truncation rejection claim drift");
  const summary = artifact?.summary ?? {};
  expect(summary.acceptedControlCount === "1" && summary.rejectionCount === "4", "visible-view truncation summary counts drift");
  expect(summary.fullVisibleViewAccepted === true && summary.allTruncatedVisibleViewsRejectedAfterDecode === true, "visible-view truncation summary outcome drift");
  expect(summary.controlSetCommitmentSha256 === canonicalSha256(controls), "visible-view truncation control-set drift");
  expect(summary.rejectionSetCommitmentSha256 === canonicalSha256(rejections), "visible-view truncation rejection-set drift");
  expect(summary.combinedReplayCommitmentSha256 === canonicalSha256({ controls, rejections }), "visible-view truncation combined replay drift");
  for (const field of ["backingByteSequencesStored", "visibleByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `visible-view truncation summary ${field} drift`);
  expect(summary.activationEffect === "NONE", "visible-view truncation summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateVisibleViewTruncationAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Visible-view truncation audit validated: the full Uint8Array view accepts and four bounded truncations reject after UTF-8 decode, network NONE.");
  }
}

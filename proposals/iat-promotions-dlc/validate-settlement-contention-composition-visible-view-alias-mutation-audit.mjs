/**
 * Validates compact visible-view shared-buffer alias-mutation evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateVisibleViewAliasMutationAudit } from "./generate-settlement-contention-composition-visible-view-alias-mutation-audit.mjs";
import { VISIBLE_VIEW_ALIAS_MUTATION_RULES } from "./settlement-contention-composition-transport-limits.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-visible-view-alias-mutation-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadVisibleViewAliasMutationAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateVisibleViewAliasMutationAudit(artifact = loadVisibleViewAliasMutationAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "visible-view alias-mutation version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-visible-view-alias-mutation-v1", "visible-view alias-mutation ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "visible-view alias-mutation HOLD drift");
  expect(JSON.stringify(generateVisibleViewAliasMutationAudit()) === JSON.stringify(artifact), "visible-view alias-mutation audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "UINT8ARRAY_SHARED_BACKING_ALIAS_MUTATION", "visible-view alias-mutation mode drift");
  expect(JSON.stringify(contract.visibleViewAliasMutationRules) === JSON.stringify(VISIBLE_VIEW_ALIAS_MUTATION_RULES), "visible-view alias-mutation rules drift");
  expect(contract.outsideControlCount === 3 && contract.insideDetectionCount === 3, "visible-view alias-mutation counts drift");
  for (const field of ["outsidePrefixIsolationProven", "outsideSuffixIsolationProven", "insideCandidateChangeDetected", "insideMarkerChangeRejected", "insideDelimiterChangeRejected", "sharedBackingAliasesExercised"]) expect(contract[field] === true, `visible-view alias-mutation contract ${field} drift`);
  for (const field of ["backingByteSequencesStored", "visibleByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) expect(contract[field] === false, `visible-view alias-mutation contract ${field} drift`);
  expect(contract.activationEffect === "NONE", "visible-view alias-mutation activation effect drift");
  const outsideControls = Array.isArray(artifact?.outsideControls) ? artifact.outsideControls : [];
  const insideDetections = Array.isArray(artifact?.insideDetections) ? artifact.insideDetections : [];
  expect(outsideControls.length === 3 && insideDetections.length === 3, "visible-view alias-mutation evidence counts drift");
  expect(outsideControls.every((item) => item.family === "OUTSIDE_VIEW_ISOLATION" && item.beforeBackingRepresentationSha256 !== item.afterBackingRepresentationSha256 && item.beforeVisibleRepresentationSha256 === item.afterVisibleRepresentationSha256 && item.beforeCandidateCommitmentSha256 === item.afterCandidateCommitmentSha256 && item.visibleBytesChanged === false && item.candidateCommitmentChanged === false && item.parserRejectedAfter === false && item.outsideViewIsolationPreserved === true && item.aliasMutationEvaluated === true && item.campaignMutationEvaluated === false), "visible-view alias-mutation outside claim drift");
  expect(insideDetections.every((item) => item.family === "INSIDE_VIEW_DETECTION" && item.beforeBackingRepresentationSha256 !== item.afterBackingRepresentationSha256 && item.beforeVisibleRepresentationSha256 !== item.afterVisibleRepresentationSha256 && item.visibleBytesChanged === true && item.mutationDetected === true && item.aliasMutationEvaluated === true && item.campaignMutationEvaluated === false && (item.candidateCommitmentChanged === true || item.parserRejectedAfter === true)), "visible-view alias-mutation inside claim drift");
  expect(JSON.stringify(insideDetections.map((item) => item.observedAfterError)) === JSON.stringify([null, "INVALID_TRANSPORT_ENVELOPE", "MALFORMED_JSON"]), "visible-view alias-mutation detection modes drift");
  const summary = artifact?.summary ?? {};
  expect(summary.outsideControlCount === "3" && summary.insideDetectionCount === "3", "visible-view alias-mutation summary counts drift");
  expect(summary.allOutsideMutationsIsolated === true && summary.allInsideMutationsDetected === true, "visible-view alias-mutation summary outcome drift");
  expect(summary.outsideControlSetCommitmentSha256 === canonicalSha256(outsideControls), "visible-view alias-mutation outside-set drift");
  expect(summary.insideDetectionSetCommitmentSha256 === canonicalSha256(insideDetections), "visible-view alias-mutation inside-set drift");
  expect(summary.combinedReplayCommitmentSha256 === canonicalSha256({ outsideControls, insideDetections }), "visible-view alias-mutation combined replay drift");
  for (const field of ["backingByteSequencesStored", "visibleByteSequencesStored", "runtimeInputsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `visible-view alias-mutation summary ${field} drift`);
  expect(summary.activationEffect === "NONE", "visible-view alias-mutation summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateVisibleViewAliasMutationAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Visible-view alias-mutation audit validated: three outside mutations stay isolated and three inside mutations are detected, network NONE.");
  }
}

/**
 * Validates compact exact transport-marker value evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateMarkerValueAudit } from "./generate-settlement-contention-composition-marker-value-audit.mjs";
import { TRANSPORT_MARKER_VALUE_RULES } from "./settlement-contention-composition-transport-limits.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-marker-value-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadMarkerValueAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateMarkerValueAudit(artifact = loadMarkerValueAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "marker-value version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-marker-values-v1", "marker-value ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "marker-value HOLD drift");
  expect(JSON.stringify(generateMarkerValueAudit()) === JSON.stringify(artifact), "marker-value audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "EXACT_TRANSPORT_MARKER_VALUE", "marker-value mode drift");
  expect(JSON.stringify(contract.transportMarkerValueRules) === JSON.stringify(TRANSPORT_MARKER_VALUE_RULES), "marker-value rules drift");
  expect(contract.acceptedControlCount === 4 && contract.rejectionCount === 16, "marker-value counts drift");
  expect(contract.rawControlCaseCount === 3 && contract.escapedControlCaseCount === 4 && contract.caseVariantCount === 3 && contract.normalizationVariantCount === 4 && contract.confusableVariantCount === 2, "marker-value family counts drift");
  for (const field of ["escapedCanonicalValuesAccepted", "rawControlsRejectedBeforeCandidate", "escapedControlsRejectedBeforeCandidate", "caseVariantsRejectedBeforeCandidate", "normalizationVariantsRejectedBeforeCandidate", "confusablesRejectedBeforeCandidate"]) expect(contract[field] === true, `marker-value contract ${field} drift`);
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) expect(contract[field] === false, `marker-value contract ${field} drift`);
  expect(contract.activationEffect === "NONE", "marker-value activation effect drift");
  const controls = Array.isArray(artifact?.controls) ? artifact.controls : [];
  const rejections = Array.isArray(artifact?.rejections) ? artifact.rejections : [];
  expect(controls.length === 4, "marker-value control count drift");
  expect(rejections.length === 16, "marker-value rejection count drift");
  expect(controls.every((item) => item.acceptedAtParser === true && item.candidateStored === false && item.mutationEvaluated === false), "marker-value control claim drift");
  expect(rejections.every((item) => item.rejectedBeforeCandidate === true && item.candidateProduced === false && item.mutationEvaluated === false), "marker-value rejection released candidate");
  expect(new Set(rejections.map((item) => item.caseId)).size === 16, "marker-value case ID collision");
  expect(rejections.filter((item) => item.family === "RAW_CONTROL_IN_MARKER_VALUE").every((item) => item.observedError === "MALFORMED_JSON"), "marker-value raw-control boundary drift");
  expect(rejections.filter((item) => item.family !== "RAW_CONTROL_IN_MARKER_VALUE").every((item) => item.observedError === "INVALID_TRANSPORT_ENVELOPE"), "marker-value decoded rejection boundary drift");
  expect(rejections.filter((item) => item.family === "CASE_VARIANT").every((item) => item.caseInsensitiveMatchesCanonical === true), "marker-value case relation drift");
  expect(rejections.filter((item) => item.family === "NORMALIZATION_VARIANT").every((item) => item.nfkcMatchesCanonical === true), "marker-value normalization relation drift");
  expect(rejections.filter((item) => item.family === "CROSS_SCRIPT_CONFUSABLE").every((item) => item.confusableCrossScript === true), "marker-value confusable relation drift");
  const summary = artifact?.summary ?? {};
  expect(summary.acceptedControlCount === "4" && summary.rejectionCount === "16", "marker-value summary counts drift");
  expect(summary.allCanonicalControlsAccepted === true && summary.allNoncanonicalMarkerValuesRejectedBeforeCandidate === true, "marker-value summary outcome drift");
  expect(summary.controlSetCommitmentSha256 === canonicalSha256(controls), "marker-value control-set drift");
  expect(summary.rejectionSetCommitmentSha256 === canonicalSha256(rejections), "marker-value rejection-set drift");
  expect(summary.combinedReplayCommitmentSha256 === canonicalSha256({ controls, rejections }), "marker-value combined replay drift");
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `marker-value summary ${field} drift`);
  expect(summary.activationEffect === "NONE", "marker-value summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateMarkerValueAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Marker-value audit validated: canonical escapes accept while control, case, normalization, and cross-script variants fail exact comparison, network NONE.");
  }
}

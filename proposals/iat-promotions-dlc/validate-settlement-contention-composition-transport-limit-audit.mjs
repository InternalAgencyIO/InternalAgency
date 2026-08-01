/**
 * Validates compact duplicate-key and bounded-transport evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateTransportLimitAudit } from "./generate-settlement-contention-composition-transport-limit-audit.mjs";
import { TRANSPORT_LIMITS } from "./settlement-contention-composition-transport-limits.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-transport-limit-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadTransportLimitAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateTransportLimitAudit(artifact = loadTransportLimitAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "transport limit version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-transport-limits-v1", "transport limit ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "transport limit HOLD drift");
  expect(JSON.stringify(generateTransportLimitAudit()) === JSON.stringify(artifact), "transport limit audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "DUPLICATE_AWARE_BOUNDED_JSON_TRANSPORT", "transport limit mode drift");
  expect(JSON.stringify(contract.limits) === JSON.stringify(TRANSPORT_LIMITS), "transport limits drift");
  expect(contract.acceptedControlCount === 2 && contract.rejectionCount === 8 && contract.duplicateKeyCaseCount === 3 && contract.limitCaseCount === 5, "transport limit counts drift");
  for (const field of ["duplicateKeysRejectedAtAnyDepth", "exactByteBoundaryAccepted", "overLimitRejectedBeforeMutation"]) expect(contract[field] === true, `transport contract ${field} drift`);
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) expect(contract[field] === false, `transport contract ${field} drift`);
  expect(contract.activationEffect === "NONE", "transport activation effect drift");
  const controls = Array.isArray(artifact?.controls) ? artifact.controls : [];
  const rejections = Array.isArray(artifact?.rejections) ? artifact.rejections : [];
  expect(controls.length === 2, "transport control count drift");
  expect(rejections.length === 8, "transport rejection count drift");
  expect(controls.every((item) => item.acceptedAtParser === true && item.candidateStored === false && item.mutationEvaluated === false), "transport control claim drift");
  expect(controls[0]?.metrics?.utf8Bytes < TRANSPORT_LIMITS.maxUtf8Bytes, "transport baseline byte headroom drift");
  expect(controls[1]?.metrics?.utf8Bytes === TRANSPORT_LIMITS.maxUtf8Bytes, "transport exact byte boundary drift");
  expect(new Set(rejections.slice(0, 3).map((item) => item.expectedError)).size === 1 && rejections[0]?.expectedError === "DUPLICATE_JSON_KEY", "duplicate-key rejection drift");
  expect(rejections.every((item) => item.expectedError === item.observedError && item.rejectedBeforeMutation === true && item.candidateProduced === false), "transport rejection released candidate");
  const summary = artifact?.summary ?? {};
  expect(summary.acceptedControlCount === "2" && summary.rejectionCount === "8", "transport summary counts drift");
  for (const field of ["allControlsAcceptedAtParser", "allControlsPreserveBaseCandidate", "allAmbiguousOrOverLimitInputsRejectedBeforeMutation"]) expect(summary[field] === true, `transport summary ${field} drift`);
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `transport summary ${field} drift`);
  expect(summary.controlSetCommitmentSha256 === canonicalSha256(controls), "transport control-set drift");
  expect(summary.rejectionSetCommitmentSha256 === canonicalSha256(rejections), "transport rejection-set drift");
  expect(summary.combinedReplayCommitmentSha256 === canonicalSha256({ controls, rejections }), "transport combined replay drift");
  expect(summary.activationEffect === "NONE", "transport summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateTransportLimitAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Transport audit validated: duplicate keys and five limit classes reject before mutation, network NONE.");
  }
}

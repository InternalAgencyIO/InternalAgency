/**
 * Validates compact canonical-safe-integer JSON token evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateNumericTokenAudit } from "./generate-settlement-contention-composition-numeric-token-audit.mjs";
import { NUMERIC_TOKEN_RULES } from "./settlement-contention-composition-transport-limits.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-numeric-token-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadNumericTokenAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateNumericTokenAudit(artifact = loadNumericTokenAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "numeric token version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-numeric-tokens-v1", "numeric token ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "numeric token HOLD drift");
  expect(JSON.stringify(generateNumericTokenAudit()) === JSON.stringify(artifact), "numeric token audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "CANONICAL_SAFE_INTEGER_JSON_TRANSPORT", "numeric token mode drift");
  expect(JSON.stringify(contract.numericTokenRules) === JSON.stringify(NUMERIC_TOKEN_RULES), "numeric token rules drift");
  expect(contract.acceptedControlCount === 4 && contract.rejectionCount === 16, "numeric token counts drift");
  expect(contract.equivalentNoncanonicalCaseCount === 3 && contract.negativeZeroCaseCount === 3 && contract.unsafeIntegerCaseCount === 3 && contract.nonfiniteEquivalentCaseCount === 2 && contract.nonJsonNumberCaseCount === 5, "numeric token family counts drift");
  for (const field of ["equivalentSpellingsRejectedBeforeCandidate", "negativeZeroRejectedBeforeCandidate", "unsafeIntegersRejectedBeforeCandidate", "nonfiniteEquivalentsRejectedBeforeCandidate"]) expect(contract[field] === true, `numeric contract ${field} drift`);
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) expect(contract[field] === false, `numeric contract ${field} drift`);
  expect(contract.activationEffect === "NONE", "numeric activation effect drift");
  const controls = Array.isArray(artifact?.controls) ? artifact.controls : [];
  const rejections = Array.isArray(artifact?.rejections) ? artifact.rejections : [];
  expect(controls.length === 4, "numeric control count drift");
  expect(rejections.length === 16, "numeric rejection count drift");
  expect(controls.every((item) => item.acceptedAtParser === true && item.candidateStored === false && item.mutationEvaluated === false), "numeric control claim drift");
  expect(rejections.every((item) => item.expectedError === item.observedError && item.rejectedBeforeCandidate === true && item.candidateProduced === false && item.mutationEvaluated === false), "numeric rejection released candidate");
  expect(new Set(rejections.map((item) => item.caseId)).size === 16, "numeric case ID collision");
  const summary = artifact?.summary ?? {};
  expect(summary.acceptedControlCount === "4" && summary.rejectionCount === "16", "numeric summary counts drift");
  expect(summary.allCanonicalControlsAccepted === true && summary.allNoncanonicalOrUnsafeTokensRejectedBeforeCandidate === true, "numeric summary outcome drift");
  expect(summary.controlSetCommitmentSha256 === canonicalSha256(controls), "numeric control-set drift");
  expect(summary.rejectionSetCommitmentSha256 === canonicalSha256(rejections), "numeric rejection-set drift");
  expect(summary.combinedReplayCommitmentSha256 === canonicalSha256({ controls, rejections }), "numeric combined replay drift");
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `numeric summary ${field} drift`);
  expect(summary.activationEffect === "NONE", "numeric summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateNumericTokenAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Numeric token audit validated: sixteen noncanonical, unsafe, or non-finite spellings reject before candidate production, network NONE.");
  }
}

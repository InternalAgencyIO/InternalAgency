/**
 * Validates compact exact-key JSON string-token evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateStringTokenAudit } from "./generate-settlement-contention-composition-string-token-audit.mjs";
import { STRING_TOKEN_RULES } from "./settlement-contention-composition-transport-limits.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-string-token-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadStringTokenAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateStringTokenAudit(artifact = loadStringTokenAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "string-token version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-string-tokens-v1", "string-token ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "string-token HOLD drift");
  expect(JSON.stringify(generateStringTokenAudit()) === JSON.stringify(artifact), "string-token audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "EXACT_REQUIRED_KEY_STRING_TOKENS", "string-token mode drift");
  expect(JSON.stringify(contract.stringTokenRules) === JSON.stringify(STRING_TOKEN_RULES), "string-token rules drift");
  expect(contract.acceptedControlCount === 3 && contract.rejectionCount === 20, "string-token counts drift");
  expect(contract.rawControlCaseCount === 7 && contract.escapedControlRequiredKeyCaseCount === 7 && contract.normalizationLookalikeCaseCount === 6, "string-token family counts drift");
  for (const field of ["escapedCanonicalKeySpellingsAccepted", "rawControlsRejectedBeforeCandidate", "escapedControlsCannotMasqueradeAsRequiredKeys", "normalizationLookalikesCannotMasqueradeAsRequiredKeys"]) expect(contract[field] === true, `string-token contract ${field} drift`);
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) expect(contract[field] === false, `string-token contract ${field} drift`);
  expect(contract.activationEffect === "NONE", "string-token activation effect drift");
  const controls = Array.isArray(artifact?.controls) ? artifact.controls : [];
  const rejections = Array.isArray(artifact?.rejections) ? artifact.rejections : [];
  expect(controls.length === 3, "string-token control count drift");
  expect(rejections.length === 20, "string-token rejection count drift");
  expect(controls.every((item) => item.acceptedAtParser === true && item.candidateStored === false && item.mutationEvaluated === false), "string-token control claim drift");
  expect(rejections.every((item) => item.rejectedBeforeCandidate === true && item.candidateProduced === false && item.mutationEvaluated === false), "string-token rejection released candidate");
  expect(new Set(rejections.map((item) => item.caseId)).size === 20, "string-token case ID collision");
  expect(rejections.filter((item) => item.family === "RAW_CONTROL_IN_STRING").every((item) => item.observedError === "MALFORMED_JSON"), "raw control error drift");
  expect(rejections.filter((item) => item.family !== "RAW_CONTROL_IN_STRING").every((item) => item.observedError === "INVALID_TRANSPORT_ENVELOPE"), "decoded key rejection drift");
  expect(rejections.filter((item) => item.family === "UNICODE_NORMALIZATION_LOOKALIKE").every((item) => item.nfkcMatchesRequiredKey === true), "normalization relation drift");
  const summary = artifact?.summary ?? {};
  expect(summary.acceptedControlCount === "3" && summary.rejectionCount === "20", "string-token summary counts drift");
  expect(summary.allCanonicalControlsAccepted === true && summary.allAmbiguousStringTokensRejectedBeforeCandidate === true, "string-token summary outcome drift");
  expect(summary.controlSetCommitmentSha256 === canonicalSha256(controls), "string-token control-set drift");
  expect(summary.rejectionSetCommitmentSha256 === canonicalSha256(rejections), "string-token rejection-set drift");
  expect(summary.combinedReplayCommitmentSha256 === canonicalSha256({ controls, rejections }), "string-token combined replay drift");
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `string-token summary ${field} drift`);
  expect(summary.activationEffect === "NONE", "string-token summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateStringTokenAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("String-token audit validated: controls, escaped controls, and NFKC lookalikes cannot alter exact required keys, network NONE.");
  }
}

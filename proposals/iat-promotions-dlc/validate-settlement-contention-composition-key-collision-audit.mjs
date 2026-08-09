/**
 * Validates compact decoded-key collision evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateKeyCollisionAudit } from "./generate-settlement-contention-composition-key-collision-audit.mjs";
import { KEY_COLLISION_RULES } from "./settlement-contention-composition-transport-limits.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-key-collision-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

export function loadKeyCollisionAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateKeyCollisionAudit(artifact = loadKeyCollisionAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "key-collision version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-key-collisions-v1", "key-collision ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "key-collision HOLD drift");
  expect(JSON.stringify(generateKeyCollisionAudit()) === JSON.stringify(artifact), "key-collision audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "DECODED_REQUIRED_KEY_COLLISION_BOUNDARY", "key-collision mode drift");
  expect(JSON.stringify(contract.keyCollisionRules) === JSON.stringify(KEY_COLLISION_RULES), "key-collision rules drift");
  expect(contract.acceptedControlCount === 3 && contract.rejectionCount === 12, "key-collision counts drift");
  expect(contract.decodedDuplicateCaseCount === 6 && contract.normalizationDistinctCaseCount === 6, "key-collision family counts drift");
  for (const field of ["escapedCanonicalSpellingsRejectAsDuplicates", "normalizationLookalikesRemainDistinct", "distinctUnexpectedKeysRejectAtEnvelope"]) expect(contract[field] === true, `key-collision contract ${field} drift`);
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) expect(contract[field] === false, `key-collision contract ${field} drift`);
  expect(contract.activationEffect === "NONE", "key-collision activation effect drift");
  const controls = Array.isArray(artifact?.controls) ? artifact.controls : [];
  const rejections = Array.isArray(artifact?.rejections) ? artifact.rejections : [];
  expect(controls.length === 3, "key-collision control count drift");
  expect(rejections.length === 12, "key-collision rejection count drift");
  expect(controls.every((item) => item.acceptedAtParser === true && item.candidateStored === false && item.mutationEvaluated === false), "key-collision control claim drift");
  expect(rejections.every((item) => item.rejectedBeforeCandidate === true && item.candidateProduced === false && item.mutationEvaluated === false), "key-collision rejection released candidate");
  expect(new Set(rejections.map((item) => item.caseId)).size === 12, "key-collision case ID collision");
  expect(rejections.filter((item) => item.family === "DECODED_KEY_DUPLICATE").every((item) => item.observedError === "DUPLICATE_JSON_KEY" && item.decodedKeysCollide === true && item.distinctDecodedKey === false), "decoded duplicate drift");
  expect(rejections.filter((item) => item.family === "NORMALIZATION_LOOKALIKE_DISTINCT_KEY").every((item) => item.observedError === "INVALID_TRANSPORT_ENVELOPE" && item.decodedKeysCollide === false && item.nfkcMatchesRequiredKey === true && item.distinctDecodedKey === true), "normalization distinct-key drift");
  const summary = artifact?.summary ?? {};
  expect(summary.acceptedControlCount === "3" && summary.rejectionCount === "12", "key-collision summary counts drift");
  expect(summary.allCanonicalControlsAccepted === true && summary.allCollisionOrDistinctLookalikeCasesRejectedBeforeCandidate === true, "key-collision summary outcome drift");
  expect(summary.controlSetCommitmentSha256 === canonicalSha256(controls), "key-collision control-set drift");
  expect(summary.rejectionSetCommitmentSha256 === canonicalSha256(rejections), "key-collision rejection-set drift");
  expect(summary.combinedReplayCommitmentSha256 === canonicalSha256({ controls, rejections }), "key-collision combined replay drift");
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `key-collision summary ${field} drift`);
  expect(summary.activationEffect === "NONE", "key-collision summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateKeyCollisionAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Key-collision audit validated: decoded aliases reject as duplicates and normalization lookalikes remain distinct invalid keys, network NONE.");
  }
}

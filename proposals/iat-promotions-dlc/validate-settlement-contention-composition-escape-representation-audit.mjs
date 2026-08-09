/**
 * Validates strict JSON escaped-Unicode and solidus representation evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateEscapeRepresentationAudit } from "./generate-settlement-contention-composition-escape-representation-audit.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-escape-representation-audit.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const VALID_REPRESENTATION_IDS = [
  "BASE_ENVELOPE_LF", "REVERSED_ENVELOPE_LF", "BASE_ENVELOPE_CRLF",
  "UNICODE_KEY_ESCAPE_LF", "ESCAPED_SOLIDUS_LF", "UNICODE_AND_SOLIDUS_LF",
];

export function loadEscapeRepresentationAudit() {
  return JSON.parse(readFileSync(ARTIFACT_PATH, "utf8"));
}

export function validateEscapeRepresentationAudit(artifact = loadEscapeRepresentationAudit()) {
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "escape representation version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-escape-representations-v1", "escape representation ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "escape representation HOLD drift");
  expect(JSON.stringify(generateEscapeRepresentationAudit()) === JSON.stringify(artifact), "escape representation audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "STRICT_JSON_ESCAPE_REPRESENTATION_AUDIT", "escape representation mode drift");
  expect(contract.mutationCount === 12 && contract.validRepresentationCountPerMutation === 6 && contract.validTrialCount === 72 && contract.malformedRepresentationCount === 6, "escape representation counts drift");
  expect(JSON.stringify(contract.validRepresentationIds) === JSON.stringify(VALID_REPRESENTATION_IDS), "escape representation IDs drift");
  for (const field of ["unicodeEscapesRequired", "escapedSolidusRequired", "malformedEscapesRejectBeforeMutation", "unpairedSurrogatesRejectBeforeMutation", "canonicalCandidateStable", "diagnosticsBoundToCrossRuntimeBaseline"]) {
    expect(contract[field] === true, `escape representation contract ${field} drift`);
  }
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) {
    expect(contract[field] === false, `escape representation contract ${field} drift`);
  }
  expect(contract.activationEffect === "NONE", "escape representation activation effect drift");
  const cases = Array.isArray(artifact?.cases) ? artifact.cases : [];
  expect(cases.length === 12, "escape representation case count drift");
  for (const entry of cases) {
    expect(Array.isArray(entry.representations) && entry.representations.length === 6, `${entry.caseId} escape representation count drift`);
    expect(JSON.stringify(entry.representations?.map((trial) => trial.representationId)) === JSON.stringify(VALID_REPRESENTATION_IDS), `${entry.caseId} escape representation order drift`);
    expect(new Set(entry.representations?.map((trial) => trial.representationSha256)).size === 6, `${entry.caseId} escape representation digest collision`);
    expect(entry.representations?.every((trial) => trial.candidateCommitmentSha256 === entry.baselineCandidateCommitmentSha256 && trial.diagnosticCommitmentSha256 === entry.baselineDiagnosticCommitmentSha256 && trial.accepted === false), `${entry.caseId} escape semantic drift`);
    const { caseCommitmentSha256, ...core } = entry;
    expect(caseCommitmentSha256 === canonicalSha256(core), `${entry.caseId} escape case commitment drift`);
    for (const field of ["canonicalCandidateStable", "baselineDiagnosticStable", "allRejected"]) expect(entry[field] === true, `${entry.caseId} ${field} drift`);
    for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(entry[field] === false, `${entry.caseId} ${field} drift`);
    expect(entry.activationEffect === "NONE", `${entry.caseId} activation effect drift`);
  }
  const malformed = Array.isArray(artifact?.malformedRepresentations) ? artifact.malformedRepresentations : [];
  expect(malformed.length === 6, "malformed escape representation count drift");
  expect(new Set(malformed.map((item) => item.representationSha256)).size === 6, "malformed escape representation digest collision");
  expect(malformed.every((item) => item.expectedError === item.observedError && item.rejectedBeforeMutation === true && item.candidateProduced === false), "malformed escape representation accepted");
  const summary = artifact?.summary ?? {};
  expect(summary.mutationCount === "12" && summary.validTrialCount === "72" && summary.malformedRepresentationCount === "6", "escape representation summary counts drift");
  for (const field of ["allCanonicalCandidatesStable", "allBaselineDiagnosticsStable", "allValidRepresentationsDistinctWithinCase", "allMalformedRepresentationsRejectedBeforeMutation", "allRejected"]) expect(summary[field] === true, `escape representation summary ${field} drift`);
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) expect(summary[field] === false, `escape representation summary ${field} drift`);
  expect(summary.malformedSetCommitmentSha256 === canonicalSha256(malformed), "malformed escape set commitment drift");
  expect(summary.caseSetCommitmentSha256 === canonicalSha256(cases.map((item) => item.caseCommitmentSha256)), "escape representation case-set drift");
  expect(summary.activationEffect === "NONE", "escape representation summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateEscapeRepresentationAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Escape representation audit validated: 72 stable trials and 6 pre-mutation malformed rejections, network NONE.");
  }
}

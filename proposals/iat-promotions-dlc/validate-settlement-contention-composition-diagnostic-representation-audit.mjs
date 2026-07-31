/**
 * Validates compact cross-runtime diagnostic representation evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateDiagnosticRepresentationAudit } from "./generate-settlement-contention-composition-diagnostic-representation-audit.mjs";
import { COMPOSITION_SCHEMA_MUTATION_DEFINITIONS } from "./settlement-contention-composition-schema-mutations.mjs";
import { evaluateDiagnosticRepresentationAudit } from "./settlement-contention-composition-diagnostic-representations.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-diagnostic-representation-audit.v1.json", import.meta.url));
const BASE_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.v1.json", import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.schema.v1.json", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));

export function loadDiagnosticRepresentationAuditBundle() {
  return { artifact: parse(ARTIFACT_PATH), base: parse(BASE_PATH), schema: parse(SCHEMA_PATH) };
}

export function validateDiagnosticRepresentationAudit(bundle = loadDiagnosticRepresentationAuditBundle()) {
  const { artifact, base, schema } = bundle;
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "diagnostic representation version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-contention-composition-diagnostic-representations-v1", "diagnostic representation ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "diagnostic representation HOLD drift");
  expect(JSON.stringify(generateDiagnosticRepresentationAudit()) === JSON.stringify(artifact), "diagnostic representation audit does not regenerate");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "DETERMINISTIC_DIAGNOSTIC_REPRESENTATION_AUDIT", "diagnostic representation mode drift");
  expect(contract.mutationCount === 12 && contract.representationCountPerMutation === 3 && contract.trialCount === 36, "diagnostic representation counts drift");
  expect(JSON.stringify(contract.representationIds) === JSON.stringify(["BASE_LF", "REVERSED_KEYS_LF", "BASE_CRLF"]), "diagnostic representation IDs drift");
  for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) {
    expect(contract[field] === false, `diagnostic representation contract ${field} drift`);
  }
  for (const field of ["exactDiagnosticsStable", "canonicalCandidateStable", "distinctRepresentationDigestsRequired"]) {
    expect(contract[field] === true, `diagnostic representation contract ${field} drift`);
  }
  expect(contract.activationEffect === "NONE", "diagnostic representation activation effect drift");
  const cases = Array.isArray(artifact?.cases) ? artifact.cases : [];
  expect(cases.length === 12, "diagnostic representation case count drift");
  const commonRecords = [];
  for (const [index, definition] of COMPOSITION_SCHEMA_MUTATION_DEFINITIONS.entries()) {
    const published = cases[index];
    if (!published) continue;
    const result = evaluateDiagnosticRepresentationAudit(base, schema, definition);
    expect(published.caseId === definition.caseId, `${definition.caseId} representation case ID drift`);
    expect(JSON.stringify(published.mutation) === JSON.stringify(definition.mutation), `${definition.caseId} representation mutation drift`);
    expect(JSON.stringify(published.representations) === JSON.stringify(result.trials), `${definition.caseId} representation trial drift`);
    expect(published.representationSetCommitmentSha256 === result.commonReplayRecord.representationSetCommitmentSha256, `${definition.caseId} representation-set drift`);
    for (const field of ["diagnosticsStable", "canonicalCandidateStable", "allRejected"]) {
      expect(published[field] === true, `${definition.caseId} ${field} drift`);
    }
    for (const field of ["serializedRepresentationsStored", "runtimeCandidatesStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) {
      expect(published[field] === false, `${definition.caseId} ${field} drift`);
    }
    expect(published.activationEffect === "NONE", `${definition.caseId} activation effect drift`);
    const { caseCommitmentSha256, ...core } = published;
    expect(caseCommitmentSha256 === canonicalSha256(core), `${definition.caseId} representation case commitment drift`);
    commonRecords.push(result.commonReplayRecord);
  }
  const summary = artifact?.summary ?? {};
  expect(summary.mutationCount === "12" && summary.trialCount === "36", "diagnostic representation summary count drift");
  for (const field of ["allDiagnosticsStable", "allCanonicalCandidatesStable", "allRepresentationDigestsDistinctWithinCase", "allRejected"]) {
    expect(summary[field] === true, `diagnostic representation summary ${field} drift`);
  }
  expect(summary.commonReplayCommitmentSha256 === canonicalSha256(commonRecords), "diagnostic representation common replay drift");
  expect(summary.caseSetCommitmentSha256 === canonicalSha256(cases.map((item) => item.caseCommitmentSha256)), "diagnostic representation case-set drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateDiagnosticRepresentationAudit();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Diagnostic representation audit validated: 36 trials stable, candidates runtime-only, network NONE.");
  }
}

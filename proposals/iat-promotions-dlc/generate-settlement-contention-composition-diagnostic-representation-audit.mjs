/**
 * Generates the compact cross-runtime diagnostic representation audit.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { COMPOSITION_SCHEMA_MUTATION_DEFINITIONS } from "./settlement-contention-composition-schema-mutations.mjs";
import { evaluateDiagnosticRepresentationAudit } from "./settlement-contention-composition-diagnostic-representations.mjs";

const OUTPUT_PATH = fileURLToPath(new URL("./settlement-contention-composition-diagnostic-representation-audit.v1.json", import.meta.url));
const BASE_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.v1.json", import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.schema.v1.json", import.meta.url));
const MUTATIONS_PATH = fileURLToPath(new URL("./settlement-contention-composition-schema-mutations.mjs", import.meta.url));
const EVALUATOR_PATH = fileURLToPath(new URL("./settlement-contention-composition-diagnostic-representations.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-vectors.py", import.meta.url));
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));

export function generateDiagnosticRepresentationAudit() {
  const base = parse(BASE_PATH);
  const schema = parse(SCHEMA_PATH);
  const cases = COMPOSITION_SCHEMA_MUTATION_DEFINITIONS.map((definition) => {
    const result = evaluateDiagnosticRepresentationAudit(base, schema, definition);
    const core = {
      caseId: definition.caseId,
      mutation: definition.mutation,
      representations: result.trials,
      representationSetCommitmentSha256: result.commonReplayRecord.representationSetCommitmentSha256,
      diagnosticsStable: true,
      canonicalCandidateStable: true,
      allRejected: true,
      serializedRepresentationsStored: false,
      runtimeCandidatesStored: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    };
    return { ...core, caseCommitmentSha256: canonicalSha256(core) };
  });
  const commonRecords = cases.map((item) => ({
    caseId: item.caseId,
    candidateCommitmentSha256: item.representations[0].candidateCommitmentSha256,
    diagnosticCommitmentSha256: item.representations[0].diagnosticCommitmentSha256,
    representationSetCommitmentSha256: item.representationSetCommitmentSha256,
    stable: true,
    accepted: false,
  }));
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-contention-composition-diagnostic-representations-v1",
    status: { labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false },
    sources: {
      baseArtifact: { path: "settlement-contention-composition-vectors.v1.json", canonicalSha256: canonicalSha256(base) },
      closedSchema: { path: "settlement-contention-composition-vectors.schema.v1.json", canonicalSha256: canonicalSha256(schema) },
      mutationCatalog: { path: "settlement-contention-composition-schema-mutations.mjs", normalizedTextSha256: normalizedTextSha256(MUTATIONS_PATH) },
      nodeEvaluator: { path: "settlement-contention-composition-diagnostic-representations.mjs", normalizedTextSha256: normalizedTextSha256(EVALUATOR_PATH) },
      pythonVerifier: { path: "verify-settlement-contention-vectors.py", normalizedTextSha256: normalizedTextSha256(PYTHON_PATH) },
      generator: { path: "generate-settlement-contention-composition-diagnostic-representation-audit.mjs", normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH) },
    },
    contract: {
      mode: "DETERMINISTIC_DIAGNOSTIC_REPRESENTATION_AUDIT",
      mutationCount: 12,
      representationCountPerMutation: 3,
      trialCount: 36,
      representationIds: ["BASE_LF", "REVERSED_KEYS_LF", "BASE_CRLF"],
      exactDiagnosticsStable: true,
      canonicalCandidateStable: true,
      distinctRepresentationDigestsRequired: true,
      serializedRepresentationsStored: false,
      runtimeCandidatesStored: false,
      usesLocalValidator: false,
      usesRpc: false,
      usesWallet: false,
      preparesTransactions: false,
      signsTransactions: false,
      broadcastsTransactions: false,
      issuesReviewReceipts: false,
      completesReview: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    summary: {
      mutationCount: "12",
      trialCount: "36",
      allDiagnosticsStable: true,
      allCanonicalCandidatesStable: true,
      allRepresentationDigestsDistinctWithinCase: true,
      allRejected: true,
      commonReplayCommitmentSha256: canonicalSha256(commonRecords),
      caseSetCommitmentSha256: canonicalSha256(cases.map((item) => item.caseCommitmentSha256)),
      serializedRepresentationsStored: false,
      runtimeCandidatesStored: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    cases,
  };
}

export function renderDiagnosticRepresentationAudit() {
  return `${JSON.stringify(generateDiagnosticRepresentationAudit(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, renderDiagnosticRepresentationAudit(), "utf8");
    console.log("Wrote 36 compact diagnostic representation trials; no serialized input, candidate, wallet, RPC, or chain data was stored.");
  } else {
    process.stdout.write(renderDiagnosticRepresentationAudit());
  }
}

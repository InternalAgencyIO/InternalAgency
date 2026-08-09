/**
 * Generates compact exact-diagnostic composition-schema mutations.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  COMPOSITION_SCHEMA_MUTATION_DEFINITIONS,
  evaluateCompositionSchemaMutation,
} from "./settlement-contention-composition-schema-mutations.mjs";

const OUTPUT_PATH = fileURLToPath(new URL("./settlement-contention-composition-schema-vectors.v1.json", import.meta.url));
const BASE_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.v1.json", import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.schema.v1.json", import.meta.url));
const EVALUATOR_PATH = fileURLToPath(new URL("./settlement-contention-composition-schema-mutations.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-vectors.py", import.meta.url));
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));

export function generateCompositionSchemaVectors() {
  const base = parse(BASE_PATH);
  const schema = parse(SCHEMA_PATH);
  const cases = COMPOSITION_SCHEMA_MUTATION_DEFINITIONS.map((definition) => {
    const result = evaluateCompositionSchemaMutation(base, schema, definition);
    const core = {
      caseId: definition.caseId,
      family: definition.family,
      mutation: definition.mutation,
      expectedAccepted: false,
      candidateCommitmentSha256: result.commonReplayRecord.candidateCommitmentSha256,
      diagnostics: result.diagnostics,
      diagnosticCommitmentSha256: result.commonReplayRecord.diagnosticCommitmentSha256,
      runtimeCandidateStored: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    };
    return { ...core, caseCommitmentSha256: canonicalSha256(core) };
  });
  const commonRecords = cases.map((item) => ({
    caseId: item.caseId,
    candidateCommitmentSha256: item.candidateCommitmentSha256,
    diagnosticCommitmentSha256: item.diagnosticCommitmentSha256,
    accepted: false,
  }));
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-settlement-contention-composition-schema-v1",
    status: { labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false },
    sources: {
      baseArtifact: { path: "settlement-contention-composition-vectors.v1.json", canonicalSha256: canonicalSha256(base) },
      closedSchema: { path: "settlement-contention-composition-vectors.schema.v1.json", canonicalSha256: canonicalSha256(schema) },
      nodeEvaluator: { path: "settlement-contention-composition-schema-mutations.mjs", normalizedTextSha256: normalizedTextSha256(EVALUATOR_PATH) },
      pythonVerifier: { path: "verify-settlement-contention-vectors.py", normalizedTextSha256: normalizedTextSha256(PYTHON_PATH) },
      generator: { path: "generate-settlement-contention-composition-schema-vectors.mjs", normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH) },
    },
    contract: {
      mode: "DETERMINISTIC_CLOSED_SCHEMA_DIAGNOSTIC_PARITY",
      caseCount: cases.length,
      exactNodePythonDiagnosticsRequired: true,
      mutatedCandidatesRuntimeOnly: true,
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
      caseCount: String(cases.length),
      allRejected: true,
      exactDiagnosticsPublished: true,
      commonReplayCommitmentSha256: canonicalSha256(commonRecords),
      caseSetCommitmentSha256: canonicalSha256(cases.map((item) => item.caseCommitmentSha256)),
      runtimeCandidateStored: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    cases,
  };
}

export function renderCompositionSchemaVectors() {
  return `${JSON.stringify(generateCompositionSchemaVectors(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, renderCompositionSchemaVectors(), "utf8");
    console.log("Wrote compact composition-schema diagnostics; no candidate, wallet, validator, RPC, or chain data was stored.");
  } else {
    process.stdout.write(renderCompositionSchemaVectors());
  }
}

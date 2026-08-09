/**
 * Validates compact exact-diagnostic composition-schema mutations.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateCompositionSchemaVectors } from "./generate-settlement-contention-composition-schema-vectors.mjs";
import {
  COMPOSITION_SCHEMA_MUTATION_DEFINITIONS,
  evaluateCompositionSchemaMutation,
} from "./settlement-contention-composition-schema-mutations.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-schema-vectors.v1.json", import.meta.url));
const BASE_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.v1.json", import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.schema.v1.json", import.meta.url));
const EVALUATOR_PATH = fileURLToPath(new URL("./settlement-contention-composition-schema-mutations.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-vectors.py", import.meta.url));
const GENERATOR_PATH = fileURLToPath(new URL("./generate-settlement-contention-composition-schema-vectors.mjs", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));

export function loadCompositionSchemaVectorBundle() {
  return { artifact: parse(ARTIFACT_PATH), base: parse(BASE_PATH), schema: parse(SCHEMA_PATH) };
}

export function validateCompositionSchemaVectors(bundle = loadCompositionSchemaVectorBundle()) {
  const { artifact, base, schema } = bundle;
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "composition schema vector version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-settlement-contention-composition-schema-v1", "composition schema vector ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "composition schema HOLD drift");
  expect(JSON.stringify(generateCompositionSchemaVectors()) === JSON.stringify(artifact), "composition schema vectors do not regenerate");
  const sources = artifact?.sources ?? {};
  expect(sources.baseArtifact?.canonicalSha256 === canonicalSha256(base), "composition schema base digest drift");
  expect(sources.closedSchema?.canonicalSha256 === canonicalSha256(schema), "composition schema digest drift");
  expect(sources.nodeEvaluator?.normalizedTextSha256 === normalizedTextSha256(EVALUATOR_PATH), "composition schema evaluator digest drift");
  expect(sources.pythonVerifier?.normalizedTextSha256 === normalizedTextSha256(PYTHON_PATH), "composition schema Python digest drift");
  expect(sources.generator?.normalizedTextSha256 === normalizedTextSha256(GENERATOR_PATH), "composition schema generator digest drift");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "DETERMINISTIC_CLOSED_SCHEMA_DIAGNOSTIC_PARITY", "composition schema mode drift");
  expect(contract.caseCount === 12, "composition schema case-count drift");
  expect(contract.exactNodePythonDiagnosticsRequired === true, "composition schema diagnostic parity drift");
  expect(contract.mutatedCandidatesRuntimeOnly === true, "composition schema vectors store candidates");
  for (const field of ["usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) {
    expect(contract[field] === false, `composition schema contract ${field} drift`);
  }
  expect(contract.activationEffect === "NONE", "composition schema activation effect drift");
  const cases = Array.isArray(artifact?.cases) ? artifact.cases : [];
  expect(cases.length === 12, "composition schema case length drift");
  const commonRecords = [];
  for (const [index, definition] of COMPOSITION_SCHEMA_MUTATION_DEFINITIONS.entries()) {
    const published = cases[index];
    if (!published) continue;
    const result = evaluateCompositionSchemaMutation(base, schema, definition);
    expect(published.caseId === definition.caseId, `${definition.caseId} case ID drift`);
    expect(published.family === definition.family, `${definition.caseId} family drift`);
    expect(JSON.stringify(published.mutation) === JSON.stringify(definition.mutation), `${definition.caseId} mutation drift`);
    expect(published.expectedAccepted === false, `${definition.caseId} accepted drift`);
    expect(published.candidateCommitmentSha256 === result.commonReplayRecord.candidateCommitmentSha256, `${definition.caseId} candidate commitment drift`);
    expect(JSON.stringify(published.diagnostics) === JSON.stringify(result.diagnostics), `${definition.caseId} diagnostic drift`);
    expect(published.diagnosticCommitmentSha256 === canonicalSha256(result.diagnostics), `${definition.caseId} diagnostic commitment drift`);
    for (const field of ["runtimeCandidateStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) {
      expect(published[field] === false, `${definition.caseId} ${field} drift`);
    }
    expect(published.activationEffect === "NONE", `${definition.caseId} activation effect drift`);
    const { caseCommitmentSha256, ...core } = published;
    expect(caseCommitmentSha256 === canonicalSha256(core), `${definition.caseId} case commitment drift`);
    commonRecords.push(result.commonReplayRecord);
  }
  const summary = artifact?.summary ?? {};
  expect(summary.caseCount === "12", "composition schema summary count drift");
  expect(summary.allRejected === true, "composition schema summary releases candidate");
  expect(summary.exactDiagnosticsPublished === true, "composition schema diagnostic publication drift");
  expect(summary.commonReplayCommitmentSha256 === canonicalSha256(commonRecords), "composition schema common replay drift");
  expect(summary.caseSetCommitmentSha256 === canonicalSha256(cases.map((item) => item.caseCommitmentSha256)), "composition schema case-set drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateCompositionSchemaVectors();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Composition schema mutations validated: 12 exact diagnostics, candidates runtime-only, network NONE.");
  }
}

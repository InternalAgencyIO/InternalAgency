/**
 * Generates compact escaped-Unicode and solidus representation evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { COMPOSITION_SCHEMA_MUTATION_DEFINITIONS } from "./settlement-contention-composition-schema-mutations.mjs";
import {
  evaluateEscapeRepresentationCase,
  evaluateMalformedEscapeCorpus,
} from "./settlement-contention-composition-escape-representations.mjs";

const OUTPUT_PATH = fileURLToPath(new URL("./settlement-contention-composition-escape-representation-audit.v1.json", import.meta.url));
const BASE_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.v1.json", import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.schema.v1.json", import.meta.url));
const BASELINE_PATH = fileURLToPath(new URL("./settlement-contention-composition-schema-vectors.v1.json", import.meta.url));
const MUTATIONS_PATH = fileURLToPath(new URL("./settlement-contention-composition-schema-mutations.mjs", import.meta.url));
const EVALUATOR_PATH = fileURLToPath(new URL("./settlement-contention-composition-escape-representations.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-escape-representations.py", import.meta.url));
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const VALID_REPRESENTATION_IDS = [
  "BASE_ENVELOPE_LF", "REVERSED_ENVELOPE_LF", "BASE_ENVELOPE_CRLF",
  "UNICODE_KEY_ESCAPE_LF", "ESCAPED_SOLIDUS_LF", "UNICODE_AND_SOLIDUS_LF",
];
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));

export function generateEscapeRepresentationAudit() {
  const base = parse(BASE_PATH);
  const schema = parse(SCHEMA_PATH);
  const baseline = parse(BASELINE_PATH);
  const baselineById = new Map(baseline.cases.map((item) => [item.caseId, item]));
  const cases = COMPOSITION_SCHEMA_MUTATION_DEFINITIONS.map((definition) => {
    const baselineCase = baselineById.get(definition.caseId);
    if (!baselineCase) throw new Error(`MISSING_BASELINE_CASE:${definition.caseId}`);
    const result = evaluateEscapeRepresentationCase(base, schema, definition, baselineCase);
    const core = {
      caseId: definition.caseId,
      mutation: definition.mutation,
      baselineCandidateCommitmentSha256: baselineCase.candidateCommitmentSha256,
      baselineDiagnosticCommitmentSha256: baselineCase.diagnosticCommitmentSha256,
      representations: result.trials,
      representationSetCommitmentSha256: result.representationSetCommitmentSha256,
      canonicalCandidateStable: true,
      baselineDiagnosticStable: true,
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
  const malformedRepresentations = evaluateMalformedEscapeCorpus(base);
  const malformedSetCommitmentSha256 = canonicalSha256(malformedRepresentations);
  const replayRecords = cases.map((item) => ({
    caseId: item.caseId,
    baselineCandidateCommitmentSha256: item.baselineCandidateCommitmentSha256,
    baselineDiagnosticCommitmentSha256: item.baselineDiagnosticCommitmentSha256,
    representationSetCommitmentSha256: item.representationSetCommitmentSha256,
    stable: true,
    accepted: false,
  }));
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-contention-composition-escape-representations-v1",
    status: { labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false },
    sources: {
      baseArtifact: { path: "settlement-contention-composition-vectors.v1.json", canonicalSha256: canonicalSha256(base) },
      closedSchema: { path: "settlement-contention-composition-vectors.schema.v1.json", canonicalSha256: canonicalSha256(schema) },
      baselineDiagnostics: { path: "settlement-contention-composition-schema-vectors.v1.json", canonicalSha256: canonicalSha256(baseline) },
      mutationCatalog: { path: "settlement-contention-composition-schema-mutations.mjs", normalizedTextSha256: normalizedTextSha256(MUTATIONS_PATH) },
      nodeEvaluator: { path: "settlement-contention-composition-escape-representations.mjs", normalizedTextSha256: normalizedTextSha256(EVALUATOR_PATH) },
      pythonVerifier: { path: "verify-settlement-contention-escape-representations.py", normalizedTextSha256: normalizedTextSha256(PYTHON_PATH) },
      generator: { path: "generate-settlement-contention-composition-escape-representation-audit.mjs", normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH) },
    },
    contract: {
      mode: "STRICT_JSON_ESCAPE_REPRESENTATION_AUDIT",
      mutationCount: 12,
      validRepresentationCountPerMutation: 6,
      validTrialCount: 72,
      malformedRepresentationCount: 6,
      validRepresentationIds: VALID_REPRESENTATION_IDS,
      unicodeEscapesRequired: true,
      escapedSolidusRequired: true,
      malformedEscapesRejectBeforeMutation: true,
      unpairedSurrogatesRejectBeforeMutation: true,
      canonicalCandidateStable: true,
      diagnosticsBoundToCrossRuntimeBaseline: true,
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
      validTrialCount: "72",
      malformedRepresentationCount: "6",
      allCanonicalCandidatesStable: true,
      allBaselineDiagnosticsStable: true,
      allValidRepresentationsDistinctWithinCase: true,
      allMalformedRepresentationsRejectedBeforeMutation: true,
      allRejected: true,
      replayCommitmentSha256: canonicalSha256(replayRecords),
      malformedSetCommitmentSha256,
      caseSetCommitmentSha256: canonicalSha256(cases.map((item) => item.caseCommitmentSha256)),
      serializedRepresentationsStored: false,
      runtimeCandidatesStored: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    malformedRepresentations,
    cases,
  };
}

export function renderEscapeRepresentationAudit() {
  return `${JSON.stringify(generateEscapeRepresentationAudit(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, renderEscapeRepresentationAudit(), "utf8");
    console.log("Wrote 72 valid and 6 malformed escape trials; serialized inputs and candidates remain runtime-only.");
  } else {
    process.stdout.write(renderEscapeRepresentationAudit());
  }
}

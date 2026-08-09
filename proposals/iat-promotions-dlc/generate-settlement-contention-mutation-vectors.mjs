/**
 * Generates compact cross-runtime contention mutation evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  CONTENTION_MUTATION_DEFINITIONS,
  evaluateContentionMutation,
} from "./settlement-contention-mutations.mjs";
import { loadSettlementContentionVectorBundle } from "./validate-settlement-contention-vectors.mjs";

const OUTPUT_PATH = fileURLToPath(new URL("./settlement-contention-mutation-vectors.v1.json", import.meta.url));
const BASE_ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-vectors.v1.json", import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL("./settlement-contention-evidence.schema.v1.json", import.meta.url));
const EVALUATOR_PATH = fileURLToPath(new URL("./settlement-contention-mutations.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-vectors.py", import.meta.url));
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];

const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));

export function generateSettlementContentionMutationVectors() {
  const bundle = loadSettlementContentionVectorBundle();
  const cases = CONTENTION_MUTATION_DEFINITIONS.map((definition) => {
    const result = evaluateContentionMutation(bundle, definition);
    const core = {
      caseId: definition.caseId,
      primaryGate: definition.primaryGate,
      mutation: definition.mutation,
      rebindScenarioCommitment: definition.rebindScenarioCommitment === true,
      rebindScenarioSetCommitment: definition.rebindScenarioSetCommitment === true,
      expectedSchemaValid: definition.expectedSchemaValid,
      expectedAccepted: false,
      candidateCommitmentSha256: result.commonReplayRecord.candidateCommitmentSha256,
      nodeSchemaErrorCount: String(result.schemaErrors.length),
      nodeSemanticErrorCount: String(result.semanticErrors.length),
      nodeSemanticErrorSetCommitmentSha256: canonicalSha256(result.semanticErrors),
      runtimeCandidateStored: false,
      expandedStateStored: false,
      expandedScheduleStored: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    };
    return { ...core, caseCommitmentSha256: canonicalSha256(core) };
  });
  const gateCounts = Object.fromEntries(
    [...new Set(cases.map((item) => item.primaryGate))].sort().map((gate) => [
      gate,
      String(cases.filter((item) => item.primaryGate === gate).length),
    ]),
  );
  const commonReplayRecords = cases.map((item) => ({
    caseId: item.caseId,
    primaryGate: item.primaryGate,
    candidateCommitmentSha256: item.candidateCommitmentSha256,
    accepted: false,
  }));
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-settlement-contention-mutations-v1",
    status: {
      labels: HOLD_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      vectorsApplied: false,
    },
    sources: {
      baseArtifact: {
        path: "settlement-contention-vectors.v1.json",
        canonicalSha256: canonicalSha256(parse(BASE_ARTIFACT_PATH)),
      },
      closedSchema: {
        path: "settlement-contention-evidence.schema.v1.json",
        canonicalSha256: canonicalSha256(parse(SCHEMA_PATH)),
      },
      nodeEvaluator: {
        path: "settlement-contention-mutations.mjs",
        normalizedTextSha256: normalizedTextSha256(EVALUATOR_PATH),
      },
      pythonVerifier: {
        path: "verify-settlement-contention-vectors.py",
        normalizedTextSha256: normalizedTextSha256(PYTHON_PATH),
      },
      generator: {
        path: "generate-settlement-contention-mutation-vectors.mjs",
        normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH),
      },
    },
    contract: {
      mode: "DETERMINISTIC_COMPACT_CROSS_RUNTIME_MUTATIONS",
      caseCount: cases.length,
      primaryGates: Object.keys(gateCounts),
      mutatedCandidatesRuntimeOnly: true,
      storesExpandedState: false,
      storesExpandedSchedules: false,
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
      countsByPrimaryGate: gateCounts,
      schemaValidMutationCount: String(cases.filter((item) => item.expectedSchemaValid).length),
      schemaInvalidMutationCount: String(cases.filter((item) => !item.expectedSchemaValid).length),
      allRejected: cases.every((item) => item.expectedAccepted === false),
      commonReplayCommitmentSha256: canonicalSha256(commonReplayRecords),
      caseSetCommitmentSha256: canonicalSha256(cases.map((item) => item.caseCommitmentSha256)),
      runtimeCandidateStored: false,
      expandedStateStored: false,
      expandedScheduleStored: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    cases,
  };
}

export function renderSettlementContentionMutationVectors() {
  return `${JSON.stringify(generateSettlementContentionMutationVectors(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, renderSettlementContentionMutationVectors(), "utf8");
    console.log("Wrote compact contention mutations; no candidate, schedule, wallet, validator, RPC, or chain data was stored.");
  } else {
    process.stdout.write(renderSettlementContentionMutationVectors());
  }
}

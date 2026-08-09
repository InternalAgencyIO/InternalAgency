/**
 * Generates pairwise contention failure-gate evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  COMPOSITION_GATE_PRECEDENCE,
  CONTENTION_COMPOSITION_DEFINITIONS,
  evaluateContentionComposition,
  evaluateContentionCompositionRemoval,
} from "./settlement-contention-compositions.mjs";
import { loadSettlementContentionVectorBundle } from "./validate-settlement-contention-vectors.mjs";

const OUTPUT_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.v1.json", import.meta.url));
const BASE_PATH = fileURLToPath(new URL("./settlement-contention-vectors.v1.json", import.meta.url));
const SCHEMA_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.schema.v1.json", import.meta.url));
const MUTATIONS_PATH = fileURLToPath(new URL("./settlement-contention-mutations.mjs", import.meta.url));
const EVALUATOR_PATH = fileURLToPath(new URL("./settlement-contention-compositions.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-vectors.py", import.meta.url));
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalizedTextSha256 = (path) => sha256Hex(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));
const parse = (path) => JSON.parse(readFileSync(path, "utf8"));

export function generateSettlementContentionCompositionVectors() {
  const bundle = loadSettlementContentionVectorBundle();
  const cases = CONTENTION_COMPOSITION_DEFINITIONS.map((definition) => {
    const result = evaluateContentionComposition(bundle, definition);
    const removalChecks = definition.expectedGates.map((removedGate) => {
      const removal = evaluateContentionCompositionRemoval(bundle, definition, removedGate);
      return {
        removedGate: removal.removedGate,
        remainingGate: removal.remainingGate,
        observedGates: removal.observedGates,
        candidateCommitmentSha256: removal.candidateCommitmentSha256,
        expectedAccepted: false,
      };
    });
    const core = {
      caseId: definition.caseId,
      expectedGates: definition.expectedGates,
      mutationCaseIds: definition.mutationCaseIds,
      observedGates: result.observedGates,
      rejectionPrecedence: result.observedGates,
      bothIsolationsRejected: result.isolationRejected.every(Boolean),
      expectedAccepted: false,
      candidateCommitmentSha256: result.commonReplayRecord.candidateCommitmentSha256,
      nodeSemanticErrorCount: String(result.semanticErrors.length),
      removalChecks,
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
  const commonReplayRecords = cases.map((item) => ({
    caseId: item.caseId,
    expectedGates: item.expectedGates,
    observedGates: item.observedGates,
    candidateCommitmentSha256: item.candidateCommitmentSha256,
    bothIsolationsRejected: true,
    accepted: false,
  }));
  const removalReplayRecords = cases.flatMap((item) => item.removalChecks.map((check) => ({
    caseId: item.caseId,
    ...check,
  })));
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-settlement-contention-compositions-v1",
    status: { labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false },
    sources: {
      baseArtifact: { path: "settlement-contention-vectors.v1.json", canonicalSha256: canonicalSha256(parse(BASE_PATH)) },
      closedSchema: { path: "settlement-contention-composition-vectors.schema.v1.json", canonicalSha256: canonicalSha256(parse(SCHEMA_PATH)) },
      mutationCatalog: { path: "settlement-contention-mutations.mjs", normalizedTextSha256: normalizedTextSha256(MUTATIONS_PATH) },
      nodeEvaluator: { path: "settlement-contention-compositions.mjs", normalizedTextSha256: normalizedTextSha256(EVALUATOR_PATH) },
      pythonVerifier: { path: "verify-settlement-contention-vectors.py", normalizedTextSha256: normalizedTextSha256(PYTHON_PATH) },
      generator: { path: "generate-settlement-contention-composition-vectors.mjs", normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH) },
    },
    contract: {
      mode: "DETERMINISTIC_RUNTIME_ONLY_TWO_GATE_COMPOSITIONS",
      caseCount: cases.length,
      gatePrecedence: COMPOSITION_GATE_PRECEDENCE,
      unorderedPairsComplete: true,
      removalChecksPerPair: 2,
      removalChecksComplete: true,
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
      removalCheckCount: String(removalReplayRecords.length),
      allPairsObservedExactly: cases.every((item) => JSON.stringify(item.expectedGates) === JSON.stringify(item.observedGates)),
      noFailureMasked: cases.every((item) => item.bothIsolationsRejected),
      allRemovalsMinimal: cases.every((item) => item.removalChecks.every((check) =>
        check.observedGates.length === 1 && check.observedGates[0] === check.remainingGate && check.expectedAccepted === false)),
      allRejected: cases.every((item) => item.expectedAccepted === false),
      commonReplayCommitmentSha256: canonicalSha256(commonReplayRecords),
      removalReplayCommitmentSha256: canonicalSha256(removalReplayRecords),
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

export function renderSettlementContentionCompositionVectors() {
  return `${JSON.stringify(generateSettlementContentionCompositionVectors(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, renderSettlementContentionCompositionVectors(), "utf8");
    console.log("Wrote 28 compact two-gate compositions; no candidate, wallet, validator, RPC, or chain data was stored.");
  } else {
    process.stdout.write(renderSettlementContentionCompositionVectors());
  }
}

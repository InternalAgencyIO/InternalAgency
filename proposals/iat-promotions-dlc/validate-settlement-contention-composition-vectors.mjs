/**
 * Validator for pairwise contention failure-gate evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateSettlementContentionCompositionVectors } from "./generate-settlement-contention-composition-vectors.mjs";
import {
  COMPOSITION_GATE_PRECEDENCE,
  CONTENTION_COMPOSITION_DEFINITIONS,
  evaluateContentionComposition,
} from "./settlement-contention-compositions.mjs";
import { loadSettlementContentionVectorBundle } from "./validate-settlement-contention-vectors.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-composition-vectors.v1.json", import.meta.url));
const MUTATIONS_PATH = fileURLToPath(new URL("./settlement-contention-mutations.mjs", import.meta.url));
const EVALUATOR_PATH = fileURLToPath(new URL("./settlement-contention-compositions.mjs", import.meta.url));
const GENERATOR_PATH = fileURLToPath(new URL("./generate-settlement-contention-composition-vectors.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-vectors.py", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const HEX_32 = /^[0-9a-f]{64}$/;
const sha256Hex = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const normalizedTextSha256 = (value) => sha256Hex(value.replace(/\r\n?/g, "\n"));

export function loadSettlementContentionCompositionVectorBundle() {
  return {
    artifact: JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")),
    mutationSource: readFileSync(MUTATIONS_PATH, "utf8"),
    evaluatorSource: readFileSync(EVALUATOR_PATH, "utf8"),
    generatorSource: readFileSync(GENERATOR_PATH, "utf8"),
    pythonSource: readFileSync(PYTHON_PATH, "utf8"),
  };
}

export function validateSettlementContentionCompositionVectors(
  compositionBundle = loadSettlementContentionCompositionVectorBundle(),
) {
  const { artifact, mutationSource, evaluatorSource, generatorSource, pythonSource } = compositionBundle;
  const errors = [];
  const expect = (condition, message) => { if (!condition) errors.push(message); };
  expect(artifact?.vectorVersion === 1, "composition version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-settlement-contention-compositions-v1", "composition ID drift");
  expect(JSON.stringify(artifact?.status) === JSON.stringify({ labels: HOLD_LABELS, network: "NONE", programId: null, deployable: false, vectorsApplied: false }), "composition HOLD status drift");
  expect(JSON.stringify(generateSettlementContentionCompositionVectors()) === JSON.stringify(artifact), "compositions do not deterministically regenerate");
  const sources = artifact?.sources ?? {};
  expect(sources.mutationCatalog?.normalizedTextSha256 === normalizedTextSha256(mutationSource), "composition mutation source digest drift");
  expect(sources.nodeEvaluator?.normalizedTextSha256 === normalizedTextSha256(evaluatorSource), "composition evaluator source digest drift");
  expect(sources.generator?.normalizedTextSha256 === normalizedTextSha256(generatorSource), "composition generator source digest drift");
  expect(sources.pythonVerifier?.normalizedTextSha256 === normalizedTextSha256(pythonSource), "composition Python source digest drift");
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "DETERMINISTIC_RUNTIME_ONLY_TWO_GATE_COMPOSITIONS", "composition mode drift");
  expect(contract.caseCount === 28, "composition case-count drift");
  expect(JSON.stringify(contract.gatePrecedence) === JSON.stringify(COMPOSITION_GATE_PRECEDENCE), "composition precedence drift");
  expect(contract.unorderedPairsComplete === true, "composition pair coverage drift");
  expect(contract.mutatedCandidatesRuntimeOnly === true, "composition publishes candidates");
  for (const field of ["storesExpandedState", "storesExpandedSchedules", "usesLocalValidator", "usesRpc", "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions", "issuesReviewReceipts", "completesReview", "activationAuthorized"]) {
    expect(contract[field] === false, `composition contract ${field} drift`);
  }
  expect(contract.activationEffect === "NONE", "composition activation effect drift");

  const baseBundle = loadSettlementContentionVectorBundle();
  const cases = Array.isArray(artifact?.cases) ? artifact.cases : [];
  expect(cases.length === CONTENTION_COMPOSITION_DEFINITIONS.length, "composition case length drift");
  const commonRecords = [];
  for (const [index, definition] of CONTENTION_COMPOSITION_DEFINITIONS.entries()) {
    const published = cases[index];
    if (!published) continue;
    const result = evaluateContentionComposition(baseBundle, definition);
    expect(published.caseId === definition.caseId, `${definition.caseId} order drift`);
    expect(JSON.stringify(published.expectedGates) === JSON.stringify(definition.expectedGates), `${definition.caseId} expected gates drift`);
    expect(JSON.stringify(published.mutationCaseIds) === JSON.stringify(definition.mutationCaseIds), `${definition.caseId} mutation IDs drift`);
    expect(JSON.stringify(published.observedGates) === JSON.stringify(definition.expectedGates), `${definition.caseId} observed gates drift`);
    expect(JSON.stringify(published.rejectionPrecedence) === JSON.stringify(definition.expectedGates), `${definition.caseId} precedence drift`);
    expect(published.bothIsolationsRejected === true, `${definition.caseId} masks a failure`);
    expect(published.expectedAccepted === false, `${definition.caseId} releases a candidate`);
    expect(published.candidateCommitmentSha256 === result.commonReplayRecord.candidateCommitmentSha256, `${definition.caseId} candidate commitment drift`);
    expect(published.nodeSemanticErrorCount === String(result.semanticErrors.length), `${definition.caseId} Node error-count drift`);
    for (const field of ["runtimeCandidateStored", "expandedStateStored", "expandedScheduleStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) {
      expect(published[field] === false, `${definition.caseId} ${field} drift`);
    }
    expect(published.activationEffect === "NONE", `${definition.caseId} activation effect drift`);
    const { caseCommitmentSha256, ...core } = published;
    expect(HEX_32.test(caseCommitmentSha256 ?? ""), `${definition.caseId} case commitment shape drift`);
    expect(caseCommitmentSha256 === canonicalSha256(core), `${definition.caseId} case commitment drift`);
    commonRecords.push(result.commonReplayRecord);
  }
  const summary = artifact?.summary ?? {};
  expect(summary.caseCount === "28", "composition summary count drift");
  expect(summary.allPairsObservedExactly === true, "composition gate observation drift");
  expect(summary.noFailureMasked === true, "composition masking drift");
  expect(summary.allRejected === true, "composition summary releases a candidate");
  expect(summary.commonReplayCommitmentSha256 === canonicalSha256(commonRecords), "composition common replay drift");
  expect(summary.caseSetCommitmentSha256 === canonicalSha256(cases.map((item) => item.caseCommitmentSha256)), "composition case-set drift");
  for (const field of ["runtimeCandidateStored", "expandedStateStored", "expandedScheduleStored", "receiptIssued", "reviewCompleted", "activationAuthorized"]) {
    expect(summary[field] === false, `composition summary ${field} drift`);
  }
  expect(summary.activationEffect === "NONE", "composition summary activation effect drift");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateSettlementContentionCompositionVectors();
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Settlement contention two-gate compositions validated: 28 rejected, zero candidates stored, network NONE.");
  }
}

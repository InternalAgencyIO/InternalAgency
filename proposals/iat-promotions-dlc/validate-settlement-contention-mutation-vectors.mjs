/**
 * Validator for compact cross-runtime contention mutation evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateSettlementContentionMutationVectors } from "./generate-settlement-contention-mutation-vectors.mjs";
import {
  CONTENTION_MUTATION_DEFINITIONS,
  evaluateContentionMutation,
} from "./settlement-contention-mutations.mjs";
import { loadSettlementContentionVectorBundle } from "./validate-settlement-contention-vectors.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-mutation-vectors.v1.json", import.meta.url));
const EVALUATOR_PATH = fileURLToPath(new URL("./settlement-contention-mutations.mjs", import.meta.url));
const GENERATOR_PATH = fileURLToPath(new URL("./generate-settlement-contention-mutation-vectors.mjs", import.meta.url));
const PYTHON_PATH = fileURLToPath(new URL("./verify-settlement-contention-vectors.py", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const HEX_32 = /^[0-9a-f]{64}$/;

export function loadSettlementContentionMutationVectorBundle() {
  return {
    artifact: JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")),
    evaluatorSource: readFileSync(EVALUATOR_PATH, "utf8"),
    generatorSource: readFileSync(GENERATOR_PATH, "utf8"),
    pythonSource: readFileSync(PYTHON_PATH, "utf8"),
  };
}

export function validateSettlementContentionMutationVectors(
  mutationBundle = loadSettlementContentionMutationVectorBundle(),
) {
  const { artifact, evaluatorSource, generatorSource, pythonSource } = mutationBundle;
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(artifact?.vectorVersion === 1, "contention mutation version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-settlement-contention-mutations-v1", "contention mutation ID drift");
  expect(JSON.stringify(artifact?.status?.labels) === JSON.stringify(HOLD_LABELS), "contention mutation HOLD labels drift");
  expect(artifact?.status?.network === "NONE", "contention mutations claim a network");
  expect(artifact?.status?.programId === null, "contention mutations claim a program ID");
  expect(artifact?.status?.deployable === false, "contention mutations claim deployability");
  expect(artifact?.status?.vectorsApplied === false, "contention mutations claim application");
  expect(
    JSON.stringify(generateSettlementContentionMutationVectors()) === JSON.stringify(artifact),
    "contention mutations do not deterministically regenerate",
  );
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "DETERMINISTIC_COMPACT_CROSS_RUNTIME_MUTATIONS", "contention mutation mode drift");
  expect(contract.caseCount === 16, "contention mutation case-count drift");
  expect(JSON.stringify(contract.primaryGates) === JSON.stringify([
    "AUTHORITY", "CAPABILITY", "COMMITMENT", "ECONOMICS", "SEMANTIC_REPLAY",
    "SOURCE_BINDING", "STATUS", "STRUCTURE",
  ]), "contention mutation gate set drift");
  expect(contract.mutatedCandidatesRuntimeOnly === true, "contention mutations publish candidates");
  for (const field of [
    "storesExpandedState", "storesExpandedSchedules", "usesLocalValidator", "usesRpc",
    "usesWallet", "preparesTransactions", "signsTransactions", "broadcastsTransactions",
    "issuesReviewReceipts", "completesReview", "activationAuthorized",
  ]) {
    expect(contract[field] === false, `contention mutation contract ${field} drift`);
  }
  expect(contract.activationEffect === "NONE", "contention mutation activation effect drift");

  const bundle = loadSettlementContentionVectorBundle();
  const cases = Array.isArray(artifact?.cases) ? artifact.cases : [];
  expect(cases.length === CONTENTION_MUTATION_DEFINITIONS.length, "contention mutation case length drift");
  const commonRecords = [];
  for (const [index, definition] of CONTENTION_MUTATION_DEFINITIONS.entries()) {
    const published = cases[index];
    if (!published) continue;
    const evaluated = evaluateContentionMutation(bundle, definition);
    expect(published.caseId === definition.caseId, `contention mutation case order drift: ${definition.caseId}`);
    expect(published.primaryGate === definition.primaryGate, `${definition.caseId} gate drift`);
    expect(JSON.stringify(published.mutation) === JSON.stringify(definition.mutation), `${definition.caseId} descriptor drift`);
    expect(published.expectedSchemaValid === definition.expectedSchemaValid, `${definition.caseId} schema expectation drift`);
    expect(published.expectedAccepted === false, `${definition.caseId} releases a candidate`);
    expect(published.candidateCommitmentSha256 === evaluated.commonReplayRecord.candidateCommitmentSha256, `${definition.caseId} candidate commitment drift`);
    expect(published.nodeSchemaErrorCount === String(evaluated.schemaErrors.length), `${definition.caseId} schema-error count drift`);
    expect(published.nodeSemanticErrorCount === String(evaluated.semanticErrors.length), `${definition.caseId} semantic-error count drift`);
    expect(published.nodeSemanticErrorSetCommitmentSha256 === canonicalSha256(evaluated.semanticErrors), `${definition.caseId} semantic-error set drift`);
    for (const field of [
      "runtimeCandidateStored", "expandedStateStored", "expandedScheduleStored",
      "receiptIssued", "reviewCompleted", "activationAuthorized",
    ]) {
      expect(published[field] === false, `${definition.caseId} ${field} drift`);
    }
    expect(published.activationEffect === "NONE", `${definition.caseId} activation effect drift`);
    const { caseCommitmentSha256, ...core } = published;
    expect(HEX_32.test(caseCommitmentSha256 ?? ""), `${definition.caseId} case commitment shape drift`);
    expect(caseCommitmentSha256 === canonicalSha256(core), `${definition.caseId} case commitment drift`);
    commonRecords.push(evaluated.commonReplayRecord);
  }
  const summary = artifact?.summary ?? {};
  expect(summary.caseCount === "16", "contention mutation summary case count drift");
  expect(summary.schemaValidMutationCount === "5", "contention mutation schema-valid count drift");
  expect(summary.schemaInvalidMutationCount === "11", "contention mutation schema-invalid count drift");
  expect(summary.allRejected === true, "contention mutation summary releases a candidate");
  expect(summary.commonReplayCommitmentSha256 === canonicalSha256(commonRecords), "contention mutation common replay drift");
  expect(summary.caseSetCommitmentSha256 === canonicalSha256(cases.map((item) => item.caseCommitmentSha256)), "contention mutation case-set drift");
  for (const field of [
    "runtimeCandidateStored", "expandedStateStored", "expandedScheduleStored",
    "receiptIssued", "reviewCompleted", "activationAuthorized",
  ]) {
    expect(summary[field] === false, `contention mutation summary ${field} drift`);
  }
  expect(summary.activationEffect === "NONE", "contention mutation summary activation effect drift");
  const sources = `${evaluatorSource}\n${generatorSource}\n${pythonSource}`;
  expect(!/\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/.test(sources), "contention mutation tooling can access a network or wallet");
  expect(!/\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/.test(sources), "contention mutation tooling can create keys or signatures");
  expect(!/solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/.test(sources), "contention mutation tooling can contact a validator or cluster");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateSettlementContentionMutationVectors();
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log("Compact contention mutations reject in Node with no stored candidates or chain capability.");
  }
}

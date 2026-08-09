/**
 * Compact mutation definitions for held settlement-contention evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * Mutated candidates are created in memory only. No expanded state, schedule,
 * trace, attempt, transaction, wallet, validator, RPC, or chain data is stored.
 */

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { applyJsonPointerMutation, validateJsonSchemaSubset } from "./json-schema-subset.mjs";
import { validateSettlementContentionVectors } from "./validate-settlement-contention-vectors.mjs";

const ZERO_HASH = "0".repeat(64);

export const CONTENTION_MUTATION_DEFINITIONS = Object.freeze([
  {
    caseId: "ROOT_UNKNOWN_PROPERTY",
    primaryGate: "STRUCTURE",
    expectedSchemaValid: false,
    mutation: { operation: "add", path: "/expandedState", value: {} },
  },
  {
    caseId: "SCENARIO_EXPANDED_TIMELINE",
    primaryGate: "STRUCTURE",
    expectedSchemaValid: false,
    mutation: { operation: "add", path: "/scenarios/0/expandedTimeline", value: [] },
  },
  {
    caseId: "STATUS_NETWORK_MAINNET",
    primaryGate: "STATUS",
    expectedSchemaValid: false,
    mutation: { operation: "replace", path: "/status/network", value: "MAINNET" },
  },
  {
    caseId: "CONTRACT_RPC_ENABLED",
    primaryGate: "CAPABILITY",
    expectedSchemaValid: false,
    mutation: { operation: "replace", path: "/contract/usesRpc", value: true },
  },
  {
    caseId: "CONTRACT_LOCAL_VALIDATOR_ENABLED",
    primaryGate: "CAPABILITY",
    expectedSchemaValid: false,
    mutation: { operation: "replace", path: "/contract/usesLocalValidator", value: true },
  },
  {
    caseId: "CONTRACT_WALLET_ENABLED",
    primaryGate: "CAPABILITY",
    expectedSchemaValid: false,
    mutation: { operation: "replace", path: "/contract/usesWallet", value: true },
  },
  {
    caseId: "CONTRACT_TRANSACTION_PREPARATION_ENABLED",
    primaryGate: "CAPABILITY",
    expectedSchemaValid: false,
    mutation: { operation: "replace", path: "/contract/preparesTransactions", value: true },
  },
  {
    caseId: "SUMMARY_REVIEW_COMPLETED",
    primaryGate: "AUTHORITY",
    expectedSchemaValid: false,
    mutation: { operation: "replace", path: "/summary/reviewCompleted", value: true },
  },
  {
    caseId: "SCENARIO_ACTIVATION_AUTHORIZED_REBOUND",
    primaryGate: "AUTHORITY",
    expectedSchemaValid: false,
    mutation: { operation: "replace", path: "/scenarios/0/activationAuthorized", value: true },
    rebindScenarioCommitment: true,
    rebindScenarioSetCommitment: true,
  },
  {
    caseId: "HERO_REWARD_DRIFT_REBOUND",
    primaryGate: "ECONOMICS",
    expectedSchemaValid: false,
    mutation: { operation: "replace", path: "/scenarios/0/winnerHeroBalanceBaseUnits", value: "119999999999" },
    rebindScenarioCommitment: true,
    rebindScenarioSetCommitment: true,
  },
  {
    caseId: "VAULT_BALANCE_DRIFT_REBOUND",
    primaryGate: "ECONOMICS",
    expectedSchemaValid: false,
    mutation: { operation: "replace", path: "/scenarios/0/vaultBalanceBaseUnits", value: "1" },
    rebindScenarioCommitment: true,
    rebindScenarioSetCommitment: true,
  },
  {
    caseId: "WINNER_ID_DRIFT_REBOUND",
    primaryGate: "SEMANTIC_REPLAY",
    expectedSchemaValid: true,
    mutation: { operation: "replace", path: "/scenarios/0/winnerAttemptId", value: "B" },
    rebindScenarioCommitment: true,
    rebindScenarioSetCommitment: true,
  },
  {
    caseId: "TIMELINE_COMMITMENT_DRIFT_REBOUND",
    primaryGate: "SEMANTIC_REPLAY",
    expectedSchemaValid: true,
    mutation: { operation: "replace", path: "/scenarios/0/timelineCommitmentSha256", value: ZERO_HASH },
    rebindScenarioCommitment: true,
    rebindScenarioSetCommitment: true,
  },
  {
    caseId: "SCENARIO_COMMITMENT_DRIFT",
    primaryGate: "COMMITMENT",
    expectedSchemaValid: true,
    mutation: { operation: "replace", path: "/scenarios/0/scenarioCommitmentSha256", value: ZERO_HASH },
  },
  {
    caseId: "SCENARIO_SET_COMMITMENT_DRIFT",
    primaryGate: "COMMITMENT",
    expectedSchemaValid: true,
    mutation: { operation: "replace", path: "/summary/scenarioSetCommitmentSha256", value: ZERO_HASH },
  },
  {
    caseId: "CONTENTION_MODEL_SOURCE_DRIFT",
    primaryGate: "SOURCE_BINDING",
    expectedSchemaValid: true,
    mutation: { operation: "replace", path: "/sources/contentionModel/normalizedTextSha256", value: ZERO_HASH },
  },
]);

function scenarioIndexFromPath(path) {
  const match = /^\/scenarios\/(\d+)\//.exec(path);
  if (!match) throw new Error("SCENARIO_REBIND_PATH_REQUIRED");
  return Number(match[1]);
}

export function applyContentionMutation(baseArtifact, definition) {
  const candidate = applyJsonPointerMutation(baseArtifact, definition.mutation);
  if (definition.rebindScenarioCommitment === true) {
    const index = scenarioIndexFromPath(definition.mutation.path);
    const scenario = candidate.scenarios[index];
    if (!scenario) throw new Error("SCENARIO_REBIND_TARGET_MISSING");
    const { scenarioCommitmentSha256: ignored, ...core } = scenario;
    scenario.scenarioCommitmentSha256 = canonicalSha256(core);
  }
  if (definition.rebindScenarioSetCommitment === true) {
    candidate.summary.scenarioSetCommitmentSha256 = canonicalSha256(
      candidate.scenarios.map((scenario) => scenario.scenarioCommitmentSha256),
    );
  }
  return candidate;
}

export function evaluateContentionMutation(bundle, definition) {
  const candidate = applyContentionMutation(bundle.artifact, definition);
  const schemaErrors = validateJsonSchemaSubset(bundle.schema, candidate);
  const semanticErrors = validateSettlementContentionVectors(
    { ...bundle, artifact: candidate },
    { regenerate: false },
  );
  const schemaValid = schemaErrors.length === 0;
  const semanticValid = semanticErrors.length === 0;
  if (schemaValid !== definition.expectedSchemaValid) {
    throw new Error(`MUTATION_SCHEMA_EXPECTATION_DRIFT:${definition.caseId}`);
  }
  if (semanticValid) throw new Error(`MUTATION_UNEXPECTEDLY_ACCEPTED:${definition.caseId}`);
  return {
    candidate,
    schemaErrors,
    semanticErrors,
    commonReplayRecord: {
      caseId: definition.caseId,
      primaryGate: definition.primaryGate,
      candidateCommitmentSha256: canonicalSha256(candidate),
      accepted: false,
    },
  };
}

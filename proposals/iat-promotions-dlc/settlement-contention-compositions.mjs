/**
 * Pairwise failure-gate composition for held contention evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * Combined candidates exist only in memory. Published evidence contains only
 * mutation descriptors, gate observations, and cryptographic commitments.
 */

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { applyJsonPointerMutation } from "./json-schema-subset.mjs";
import {
  CONTENTION_MUTATION_DEFINITIONS,
  evaluateContentionMutation,
} from "./settlement-contention-mutations.mjs";
import { validateSettlementContentionVectors } from "./validate-settlement-contention-vectors.mjs";

export const COMPOSITION_GATE_PRECEDENCE = Object.freeze([
  "STRUCTURE",
  "STATUS",
  "CAPABILITY",
  "AUTHORITY",
  "ECONOMICS",
  "SEMANTIC_REPLAY",
  "COMMITMENT",
  "SOURCE_BINDING",
]);

const REPRESENTATIVE_IDS = Object.freeze({
  STRUCTURE: "ROOT_UNKNOWN_PROPERTY",
  STATUS: "STATUS_NETWORK_MAINNET",
  CAPABILITY: "CONTRACT_RPC_ENABLED",
  AUTHORITY: "SUMMARY_REVIEW_COMPLETED",
  ECONOMICS: "HERO_REWARD_DRIFT_REBOUND",
  SEMANTIC_REPLAY: "WINNER_ID_DRIFT_REBOUND",
  COMMITMENT: "SCENARIO_SET_COMMITMENT_DRIFT",
  SOURCE_BINDING: "CONTENTION_MODEL_SOURCE_DRIFT",
});

const byId = new Map(CONTENTION_MUTATION_DEFINITIONS.map((item) => [item.caseId, item]));

export const CONTENTION_COMPOSITION_DEFINITIONS = Object.freeze(
  COMPOSITION_GATE_PRECEDENCE.flatMap((firstGate, firstIndex) =>
    COMPOSITION_GATE_PRECEDENCE.slice(firstIndex + 1).map((secondGate) => ({
      caseId: `${firstGate}__${secondGate}`,
      expectedGates: [firstGate, secondGate],
      mutationCaseIds: [REPRESENTATIVE_IDS[firstGate], REPRESENTATIVE_IDS[secondGate]],
    })),
  ),
);

const jsonEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function rebindScenario(candidate, mutation) {
  const index = Number(mutation.path.split("/")[2]);
  const scenario = candidate.scenarios[index];
  const { scenarioCommitmentSha256: ignored, ...core } = scenario;
  scenario.scenarioCommitmentSha256 = canonicalSha256(core);
}

export function applyContentionComposition(baseArtifact, composition) {
  const definitions = composition.mutationCaseIds.map((caseId) => {
    const definition = byId.get(caseId);
    if (!definition) throw new Error(`UNKNOWN_COMPOSITION_MUTATION:${caseId}`);
    return definition;
  });
  let candidate = baseArtifact;
  for (const definition of definitions) {
    candidate = applyJsonPointerMutation(candidate, definition.mutation);
  }
  for (const definition of definitions.filter((item) => item.rebindScenarioCommitment === true)) {
    rebindScenario(candidate, definition.mutation);
  }
  if (definitions.some((item) => item.rebindScenarioSetCommitment === true)) {
    candidate.summary.scenarioSetCommitmentSha256 = canonicalSha256(
      candidate.scenarios.map((scenario) => scenario.scenarioCommitmentSha256),
    );
  }
  const commitmentDefinition = definitions.find((item) => item.primaryGate === "COMMITMENT");
  if (commitmentDefinition) {
    candidate = applyJsonPointerMutation(candidate, commitmentDefinition.mutation);
  }
  return candidate;
}

export function detectContentionCompositionGates(baseArtifact, candidate) {
  const gates = new Set();
  if (Object.hasOwn(candidate, "expandedState") ||
      candidate.scenarios?.some((scenario) => Object.hasOwn(scenario, "expandedTimeline"))) {
    gates.add("STRUCTURE");
  }
  if (!jsonEqual(candidate.status, baseArtifact.status)) gates.add("STATUS");
  if (candidate.contract?.usesRpc === true || candidate.contract?.usesLocalValidator === true ||
      candidate.contract?.usesWallet === true || candidate.contract?.preparesTransactions === true) {
    gates.add("CAPABILITY");
  }
  if (candidate.summary?.reviewCompleted !== baseArtifact.summary.reviewCompleted ||
      candidate.summary?.activationAuthorized !== baseArtifact.summary.activationAuthorized ||
      candidate.scenarios?.some((scenario, index) =>
        scenario.activationAuthorized !== baseArtifact.scenarios[index].activationAuthorized)) {
    gates.add("AUTHORITY");
  }
  if (candidate.scenarios?.some((scenario, index) =>
    scenario.winnerHeroBalanceBaseUnits !== baseArtifact.scenarios[index].winnerHeroBalanceBaseUnits ||
    scenario.winnerProposerBalanceBaseUnits !== baseArtifact.scenarios[index].winnerProposerBalanceBaseUnits ||
    scenario.vaultBalanceBaseUnits !== baseArtifact.scenarios[index].vaultBalanceBaseUnits)) {
    gates.add("ECONOMICS");
  }
  if (candidate.scenarios?.some((scenario, index) =>
    scenario.winnerAttemptId !== baseArtifact.scenarios[index].winnerAttemptId ||
    scenario.timelineCommitmentSha256 !== baseArtifact.scenarios[index].timelineCommitmentSha256)) {
    gates.add("SEMANTIC_REPLAY");
  }
  const scenarioCommitmentsValid = candidate.scenarios?.every((scenario) => {
    const { scenarioCommitmentSha256, ...core } = scenario;
    return scenarioCommitmentSha256 === canonicalSha256(core);
  });
  const expectedSetCommitment = canonicalSha256(
    candidate.scenarios?.map((scenario) => scenario.scenarioCommitmentSha256) ?? [],
  );
  if (!scenarioCommitmentsValid ||
      candidate.summary?.scenarioSetCommitmentSha256 !== expectedSetCommitment) {
    gates.add("COMMITMENT");
  }
  if (!jsonEqual(candidate.sources, baseArtifact.sources)) gates.add("SOURCE_BINDING");
  return COMPOSITION_GATE_PRECEDENCE.filter((gate) => gates.has(gate));
}

export function evaluateContentionComposition(bundle, composition) {
  const candidate = applyContentionComposition(bundle.artifact, composition);
  const observedGates = detectContentionCompositionGates(bundle.artifact, candidate);
  if (!jsonEqual(observedGates, composition.expectedGates)) {
    throw new Error(`COMPOSITION_GATE_DRIFT:${composition.caseId}:${observedGates.join(",")}`);
  }
  const semanticErrors = validateSettlementContentionVectors(
    { ...bundle, artifact: candidate },
    { regenerate: false },
  );
  if (semanticErrors.length === 0) throw new Error(`COMPOSITION_UNEXPECTEDLY_ACCEPTED:${composition.caseId}`);
  const isolationRejected = composition.mutationCaseIds.map((caseId) => {
    const definition = byId.get(caseId);
    return evaluateContentionMutation(bundle, definition).semanticErrors.length > 0;
  });
  if (!isolationRejected.every(Boolean)) throw new Error(`COMPOSITION_MASKING:${composition.caseId}`);
  return {
    candidate,
    observedGates,
    semanticErrors,
    isolationRejected,
    commonReplayRecord: {
      caseId: composition.caseId,
      expectedGates: composition.expectedGates,
      observedGates,
      candidateCommitmentSha256: canonicalSha256(candidate),
      bothIsolationsRejected: true,
      accepted: false,
    },
  };
}

export function evaluateContentionCompositionRemoval(bundle, composition, removedGate) {
  const removedIndex = composition.expectedGates.indexOf(removedGate);
  if (removedIndex < 0) throw new Error(`REMOVAL_GATE_NOT_FOUND:${composition.caseId}:${removedGate}`);
  const remainingIndex = removedIndex === 0 ? 1 : 0;
  const remainingGate = composition.expectedGates[remainingIndex];
  const reduced = {
    caseId: `${composition.caseId}__REMOVE_${removedGate}`,
    expectedGates: [remainingGate],
    mutationCaseIds: [composition.mutationCaseIds[remainingIndex]],
  };
  const candidate = applyContentionComposition(bundle.artifact, reduced);
  const observedGates = detectContentionCompositionGates(bundle.artifact, candidate);
  if (!jsonEqual(observedGates, reduced.expectedGates)) {
    throw new Error(`REMOVAL_GATE_DRIFT:${reduced.caseId}:${observedGates.join(",")}`);
  }
  const semanticErrors = validateSettlementContentionVectors(
    { ...bundle, artifact: candidate },
    { regenerate: false },
  );
  if (semanticErrors.length === 0) throw new Error(`REMOVAL_UNEXPECTEDLY_ACCEPTED:${reduced.caseId}`);
  return {
    removedGate,
    remainingGate,
    observedGates,
    candidateCommitmentSha256: canonicalSha256(candidate),
    semanticErrors,
    accepted: false,
  };
}

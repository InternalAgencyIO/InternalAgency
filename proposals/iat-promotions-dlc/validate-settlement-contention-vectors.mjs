/**
 * Validator for compact network-free settlement contention evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { generateSettlementContentionVectors } from "./generate-settlement-contention-vectors.mjs";

const ARTIFACT_PATH = fileURLToPath(new URL("./settlement-contention-vectors.v1.json", import.meta.url));
const MODEL_PATH = fileURLToPath(new URL("./settlement-contention-model.mjs", import.meta.url));
const GENERATOR_PATH = fileURLToPath(new URL("./generate-settlement-contention-vectors.mjs", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const HEX_32 = /^[0-9a-f]{64}$/;
const SCENARIO_NAMES = [
  "A_COMMITS_B_TERMINAL",
  "B_COMMITS_A_TERMINAL",
  "A_HERO_FAULT_B_RECOVERS",
  "A_PROPOSER_FAULT_B_RECOVERS",
  "B_HERO_FAULT_A_RECOVERS",
  "B_PROPOSER_FAULT_A_RECOVERS",
];

export function loadSettlementContentionVectorBundle() {
  return {
    artifact: JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")),
    modelSource: readFileSync(MODEL_PATH, "utf8"),
    generatorSource: readFileSync(GENERATOR_PATH, "utf8"),
  };
}

export function validateSettlementContentionVectors(
  bundle = loadSettlementContentionVectorBundle(),
) {
  const { artifact, modelSource, generatorSource } = bundle;
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  expect(artifact?.vectorVersion === 1, "contention vector version drift");
  expect(artifact?.vectorId === "iat-promotions-dlc-settlement-contention-v1", "contention vector ID drift");
  expect(JSON.stringify(artifact?.status?.labels) === JSON.stringify(HOLD_LABELS), "contention HOLD labels drift");
  expect(artifact?.status?.network === "NONE", "contention vectors claim a network");
  expect(artifact?.status?.programId === null, "contention vectors claim a program ID");
  expect(artifact?.status?.deployable === false, "contention vectors claim deployability");
  expect(artifact?.status?.vectorsApplied === false, "contention vectors claim application");
  expect(
    JSON.stringify(generateSettlementContentionVectors()) === JSON.stringify(artifact),
    "contention vectors do not deterministically regenerate",
  );
  const contract = artifact?.contract ?? {};
  expect(contract.mode === "DETERMINISTIC_NETWORK_FREE_SETTLEMENT_CONTENTION", "contention mode drift");
  expect(contract.scenarioCount === 6, "contention scenario-count contract drift");
  expect(contract.timelineStepsPerScenario === 7, "contention timeline-step contract drift");
  expect(contract.finalSlotStartsAtCompletedPairs === 999, "contention final-slot boundary drift");
  expect(contract.exactWritableLockDerivation === true, "contention writable-lock derivation disabled");
  expect(contract.campaignAndVaultLocksSerializeAllSettlements === true, "contention global serialization disabled");
  expect(
    JSON.stringify(contract.injectedFaults) === JSON.stringify([
      "AFTER_HERO_TRANSFER",
      "AFTER_PROPOSER_TRANSFER",
    ]),
    "contention injected-fault contract drift",
  );
  for (const field of [
    "storesExpandedState",
    "storesExpandedTimelineOrTrace",
    "usesLocalValidator",
    "usesRpc",
    "usesWallet",
    "preparesTransactions",
    "signsTransactions",
    "broadcastsTransactions",
    "issuesReviewReceipts",
    "completesReview",
    "activationAuthorized",
  ]) {
    expect(contract[field] === false, `contention contract ${field} drift`);
  }
  expect(contract.activationEffect === "NONE", "contention contract activation effect drift");
  const summary = artifact?.summary ?? {};
  const expectedSummary = {
    scenarioCount: "6",
    lockConflictCount: "6",
    rollbackCount: "4",
    committedAttemptCount: "6",
    terminalRejectionCount: "2",
    exactFinalCompletedPairsCount: "6",
    zeroFinalVaultBalanceCount: "6",
  };
  for (const [field, value] of Object.entries(expectedSummary)) {
    expect(summary[field] === value, `contention summary ${field} drift`);
  }
  for (const field of [
    "allCallersUnchanged",
    "allLocksReleased",
    "allLosersUnpaid",
    "allWinnersPaidExactly",
  ]) {
    expect(summary[field] === true, `contention summary ${field} drift`);
  }
  expect(
    summary.scenarioSetCommitmentSha256
      === "87dad1a11f005cbb3ea25a857026a6a009522a1a6f735e428e7bba45e510f7d8",
    "contention scenario-set commitment drift",
  );
  for (const field of [
    "expandedStateStored",
    "expandedTimelineOrTraceStored",
    "chainTransactionPrepared",
    "receiptIssued",
    "reviewCompleted",
    "activationAuthorized",
  ]) {
    expect(summary[field] === false, `contention summary ${field} drift`);
  }
  expect(summary.activationEffect === "NONE", "contention summary activation effect drift");
  const scenarios = Array.isArray(artifact?.scenarios) ? artifact.scenarios : [];
  expect(JSON.stringify(scenarios.map((scenario) => scenario.name)) === JSON.stringify(SCENARIO_NAMES), "contention scenario order drift");
  for (const scenario of scenarios) {
    expect(["A", "B"].includes(scenario.winnerAttemptId), `${scenario.name} winner drift`);
    expect(scenario.loserAttemptId !== scenario.winnerAttemptId, `${scenario.name} loser drift`);
    for (const field of [
      "initialStateSha256",
      "finalStateSha256",
      "timelineCommitmentSha256",
      "traceCommitmentSha256",
      "attemptOutcomeSetCommitmentSha256",
      "scenarioCommitmentSha256",
    ]) {
      expect(HEX_32.test(scenario[field] ?? ""), `${scenario.name} ${field} drift`);
    }
    expect(scenario.lockConflictCount === "1", `${scenario.name} lock-conflict count drift`);
    expect(scenario.committedAttemptCount === "1", `${scenario.name} committed-attempt count drift`);
    expect(scenario.completedPairs === "1000", `${scenario.name} completed-pair count drift`);
    expect(scenario.vaultBalanceBaseUnits === "0", `${scenario.name} vault balance drift`);
    expect(scenario.winnerHeroBalanceBaseUnits === "120000000000", `${scenario.name} hero reward drift`);
    expect(scenario.winnerProposerBalanceBaseUnits === "60000000000", `${scenario.name} proposer reward drift`);
    expect(scenario.loserHeroBalanceBaseUnits === "0", `${scenario.name} loser hero was paid`);
    expect(scenario.loserProposerBalanceBaseUnits === "0", `${scenario.name} loser proposer was paid`);
    expect(scenario.callerStateUnchanged === true, `${scenario.name} caller state changed`);
    expect(scenario.allLocksReleased === true, `${scenario.name} leaked locks`);
    for (const field of [
      "expandedTimelineStored",
      "expandedTraceStored",
      "attemptInputsStored",
      "chainTransactionPrepared",
      "acceptedCampaignVectorPublished",
      "receiptIssued",
      "reviewCompleted",
      "activationAuthorized",
    ]) {
      expect(scenario[field] === false, `${scenario.name} ${field} drift`);
    }
    expect(scenario.activationEffect === "NONE", `${scenario.name} activation effect drift`);
    const { scenarioCommitmentSha256, ...core } = scenario;
    expect(
      scenarioCommitmentSha256 === canonicalSha256(core),
      `${scenario.name} commitment drift`,
    );
  }
  expect(
    summary.scenarioSetCommitmentSha256
      === canonicalSha256(scenarios.map((scenario) => scenario.scenarioCommitmentSha256)),
    "contention scenario-set reconstruction drift",
  );
  const sources = `${modelSource}\n${generatorSource}`;
  expect(!/\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/.test(sources), "contention tooling can access a network or wallet");
  expect(!/\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/.test(sources), "contention tooling can create keys or signatures");
  expect(!/solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/.test(sources), "contention tooling can contact a validator or cluster");
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = validateSettlementContentionVectors();
  if (errors.length > 0) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Settlement contention vectors reproduce with one winner, atomic rollback, and no chain capability.");
  }
}

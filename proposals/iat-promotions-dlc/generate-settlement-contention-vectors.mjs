/**
 * Generates compact, network-free settlement contention evidence.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  AttestationPurpose,
  COMMUNITY_PROMOTION_SOURCE,
  GENESIS_ACTIVATION_OFFSET_SECONDS,
  MAXIMUM_BUDGET_BASE_UNITS,
  MAXIMUM_COMPLETED_PAIRS,
  activateCampaign,
  createCampaign,
  fundCampaign,
  nominateHero,
  settlePair,
} from "./reference-engine.mjs";
import {
  ScheduleOperation,
  runDeterministicSettlementSchedule,
} from "./settlement-contention-model.mjs";

const OUTPUT_PATH = fileURLToPath(new URL("./settlement-contention-vectors.v1.json", import.meta.url));
const GENERATOR_PATH = fileURLToPath(import.meta.url);
const MODEL_PATH = fileURLToPath(new URL("./settlement-contention-model.mjs", import.meta.url));
const REFERENCE_ENGINE_PATH = fileURLToPath(new URL("./reference-engine.mjs", import.meta.url));
const HOLD_LABELS = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
const GENESIS = 1_800_000_000;
const ACTIVE_AT = GENESIS + GENESIS_ACTIVATION_OFFSET_SECONDS;
const HASH = "a".repeat(64);

function sha256Hex(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizedTextSha256(path) {
  return sha256Hex(readFileSync(path, "utf8").replace(/\r\n?/g, "\n"));
}

function commitment(value) {
  return sha256Hex(`iat-promotions-dlc-contention-v1\0${value}`);
}

function attestation(state, purpose, identity, nonce, now) {
  return {
    verified: true,
    campaignId: state.config.campaignId,
    purpose,
    nodeId: `node-${identity}`,
    wallet: `wallet-${identity}`,
    xIdentityCommitment: commitment(`x-${identity}`),
    nonce,
    issuedAt: now - 1,
    expiresAt: now + 300,
  };
}

function activateReferenceCampaign() {
  let state = createCampaign({
    campaignId: "iat-promotions-dlc-contention-reference-only",
    genesisTimestamp: GENESIS,
  });
  state = fundCampaign(state, {
    amountBaseUnits: MAXIMUM_BUDGET_BASE_UNITS,
    source: COMMUNITY_PROMOTION_SOURCE,
  });
  return activateCampaign(state, {
    now: ACTIVE_AT,
    network: "MAINNET",
    separatelyReviewed: true,
    reviewHash: HASH,
    artifactHash: HASH,
    policyHash: HASH,
  });
}

function nominate(state, proposerIdentity, heroIdentity, sequence) {
  return nominateHero(state, {
    now: ACTIVE_AT + 1,
    proposerAttestation: attestation(
      state,
      AttestationPurpose.NOMINATE,
      proposerIdentity,
      `contention-nominate-${sequence}`,
      ACTIVE_AT + 1,
    ),
    heroXIdentityCommitment: commitment(`x-${heroIdentity}`),
    heroDisplayHandle: `@candidate_${sequence}`,
  });
}

function settlementAttempt(state, attemptId, nominationId, heroIdentity, sequence, faultAt = null) {
  return {
    attemptId,
    now: ACTIVE_AT + 2,
    nominationId,
    heroAttestation: attestation(
      state,
      AttestationPurpose.SETTLE,
      heroIdentity,
      `contention-settle-${sequence}`,
      ACTIVE_AT + 2,
    ),
    heroDisplayHandle: `@candidate_${sequence}`,
    faultAt,
  };
}

function finalSlotFixture() {
  let state = activateReferenceCampaign();
  for (let sequence = 0; sequence < MAXIMUM_COMPLETED_PAIRS - 1; sequence += 1) {
    const proposerIdentity = `prior-proposer-${sequence}`;
    const heroIdentity = `prior-hero-${sequence}`;
    const nomination = nominate(state, proposerIdentity, heroIdentity, sequence);
    state = settlePair(nomination.state, settlementAttempt(
      nomination.state,
      `PRIOR-${sequence}`,
      nomination.nominationId,
      heroIdentity,
      sequence,
    ));
  }
  const nominationA = nominate(state, "final-proposer-a", "final-hero-a", 2_000);
  const nominationB = nominate(nominationA.state, "final-proposer-b", "final-hero-b", 2_001);
  return {
    state: nominationB.state,
    nominationIds: { A: nominationA.nominationId, B: nominationB.nominationId },
  };
}

function schedule(first, second) {
  return [
    { operation: ScheduleOperation.ACQUIRE, attemptId: first },
    { operation: ScheduleOperation.ACQUIRE, attemptId: second },
    { operation: ScheduleOperation.EXECUTE, attemptId: first },
    { operation: ScheduleOperation.RELEASE, attemptId: first },
    { operation: ScheduleOperation.ACQUIRE, attemptId: second },
    { operation: ScheduleOperation.EXECUTE, attemptId: second },
    { operation: ScheduleOperation.RELEASE, attemptId: second },
  ];
}

const SCENARIO_DEFINITIONS = Object.freeze([
  { name: "A_COMMITS_B_TERMINAL", first: "A", second: "B", firstFault: null },
  { name: "B_COMMITS_A_TERMINAL", first: "B", second: "A", firstFault: null },
  { name: "A_HERO_FAULT_B_RECOVERS", first: "A", second: "B", firstFault: "AFTER_HERO_TRANSFER" },
  { name: "A_PROPOSER_FAULT_B_RECOVERS", first: "A", second: "B", firstFault: "AFTER_PROPOSER_TRANSFER" },
  { name: "B_HERO_FAULT_A_RECOVERS", first: "B", second: "A", firstFault: "AFTER_HERO_TRANSFER" },
  { name: "B_PROPOSER_FAULT_A_RECOVERS", first: "B", second: "A", firstFault: "AFTER_PROPOSER_TRANSFER" },
]);

export function generateSettlementContentionVectors() {
  const fixture = finalSlotFixture();
  const scenarios = SCENARIO_DEFINITIONS.map((definition) => {
    const faults = { A: null, B: null };
    faults[definition.first] = definition.firstFault;
    const attempts = [
      settlementAttempt(
        fixture.state,
        "A",
        fixture.nominationIds.A,
        "final-hero-a",
        2_000,
        faults.A,
      ),
      settlementAttempt(
        fixture.state,
        "B",
        fixture.nominationIds.B,
        "final-hero-b",
        2_001,
        faults.B,
      ),
    ];
    const timeline = schedule(definition.first, definition.second);
    const result = runDeterministicSettlementSchedule(fixture.state, { attempts, timeline });
    const winner = definition.firstFault === null ? definition.first : definition.second;
    const loser = winner === "A" ? "B" : "A";
    const runtimeWinnerHero = winner === "A" ? "final-hero-a" : "final-hero-b";
    const runtimeWinnerProposer = winner === "A" ? "final-proposer-a" : "final-proposer-b";
    const runtimeLoserHero = loser === "A" ? "final-hero-a" : "final-hero-b";
    const runtimeLoserProposer = loser === "A" ? "final-proposer-a" : "final-proposer-b";
    const outcomeCore = {
      name: definition.name,
      firstAttemptId: definition.first,
      secondAttemptId: definition.second,
      injectedFault: definition.firstFault,
      winnerAttemptId: winner,
      loserAttemptId: loser,
      initialStateSha256: result.initialStateSha256,
      finalStateSha256: result.finalStateSha256,
      timelineCommitmentSha256: canonicalSha256(timeline),
      traceCommitmentSha256: canonicalSha256(result.trace),
      attemptOutcomeSetCommitmentSha256: canonicalSha256(result.attempts),
      lockConflictCount: String(result.trace.filter((entry) => entry.outcome === "LOCK_CONFLICT").length),
      rollbackCount: String(result.attempts.filter((attempt) => attempt.status === "ROLLED_BACK").length),
      committedAttemptCount: String(result.attempts.filter((attempt) => attempt.status === "COMMITTED").length),
      terminalRejectionCount: String(result.attempts.filter((attempt) =>
        attempt.errorCode === "CAMPAIGN_PERMANENTLY_EXHAUSTED").length),
      completedPairs: String(result.state.completedPairs),
      vaultBalanceBaseUnits: String(result.state.vaultBalanceBaseUnits),
      winnerHeroBalanceBaseUnits: String(result.state.walletBalances.get(`wallet-${runtimeWinnerHero}`) ?? 0n),
      winnerProposerBalanceBaseUnits: String(result.state.walletBalances.get(`wallet-${runtimeWinnerProposer}`) ?? 0n),
      loserHeroBalanceBaseUnits: String(result.state.walletBalances.get(`wallet-${runtimeLoserHero}`) ?? 0n),
      loserProposerBalanceBaseUnits: String(result.state.walletBalances.get(`wallet-${runtimeLoserProposer}`) ?? 0n),
      callerStateUnchanged: result.callerStateUnchanged,
      allLocksReleased: result.allLocksReleased,
      expandedTimelineStored: false,
      expandedTraceStored: false,
      attemptInputsStored: false,
      chainTransactionPrepared: false,
      acceptedCampaignVectorPublished: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    };
    return { ...outcomeCore, scenarioCommitmentSha256: canonicalSha256(outcomeCore) };
  });
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-settlement-contention-v1",
    status: {
      labels: HOLD_LABELS,
      network: "NONE",
      programId: null,
      deployable: false,
      vectorsApplied: false,
    },
    sources: {
      referenceEngine: {
        path: "reference-engine.mjs",
        normalizedTextSha256: normalizedTextSha256(REFERENCE_ENGINE_PATH),
      },
      contentionModel: {
        path: "settlement-contention-model.mjs",
        normalizedTextSha256: normalizedTextSha256(MODEL_PATH),
      },
      generator: {
        path: "generate-settlement-contention-vectors.mjs",
        normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH),
      },
    },
    contract: {
      mode: "DETERMINISTIC_NETWORK_FREE_SETTLEMENT_CONTENTION",
      scenarioCount: SCENARIO_DEFINITIONS.length,
      timelineStepsPerScenario: 7,
      finalSlotStartsAtCompletedPairs: 999,
      exactWritableLockDerivation: true,
      campaignAndVaultLocksSerializeAllSettlements: true,
      injectedFaults: ["AFTER_HERO_TRANSFER", "AFTER_PROPOSER_TRANSFER"],
      storesExpandedState: false,
      storesExpandedTimelineOrTrace: false,
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
      scenarioCount: String(scenarios.length),
      lockConflictCount: String(scenarios.reduce((total, scenario) =>
        total + Number(scenario.lockConflictCount), 0)),
      rollbackCount: String(scenarios.reduce((total, scenario) =>
        total + Number(scenario.rollbackCount), 0)),
      committedAttemptCount: String(scenarios.reduce((total, scenario) =>
        total + Number(scenario.committedAttemptCount), 0)),
      terminalRejectionCount: String(scenarios.reduce((total, scenario) =>
        total + Number(scenario.terminalRejectionCount), 0)),
      exactFinalCompletedPairsCount: String(scenarios.filter((scenario) =>
        scenario.completedPairs === "1000").length),
      zeroFinalVaultBalanceCount: String(scenarios.filter((scenario) =>
        scenario.vaultBalanceBaseUnits === "0").length),
      allCallersUnchanged: scenarios.every((scenario) => scenario.callerStateUnchanged),
      allLocksReleased: scenarios.every((scenario) => scenario.allLocksReleased),
      allLosersUnpaid: scenarios.every((scenario) =>
        scenario.loserHeroBalanceBaseUnits === "0"
          && scenario.loserProposerBalanceBaseUnits === "0"),
      allWinnersPaidExactly: scenarios.every((scenario) =>
        scenario.winnerHeroBalanceBaseUnits === "120000000000"
          && scenario.winnerProposerBalanceBaseUnits === "60000000000"),
      scenarioSetCommitmentSha256: canonicalSha256(
        scenarios.map((scenario) => scenario.scenarioCommitmentSha256),
      ),
      expandedStateStored: false,
      expandedTimelineOrTraceStored: false,
      chainTransactionPrepared: false,
      receiptIssued: false,
      reviewCompleted: false,
      activationAuthorized: false,
      activationEffect: "NONE",
    },
    scenarios,
  };
}

export function renderSettlementContentionVectors() {
  return `${JSON.stringify(generateSettlementContentionVectors(), null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, renderSettlementContentionVectors(), "utf8");
    console.log("Wrote network-free settlement contention vectors; no validator, RPC, wallet, or chain was used.");
  } else {
    process.stdout.write(renderSettlementContentionVectors());
  }
}

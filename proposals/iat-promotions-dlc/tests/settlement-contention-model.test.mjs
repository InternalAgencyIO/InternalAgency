/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  AttestationPurpose,
  COMMUNITY_PROMOTION_SOURCE,
  GENESIS_ACTIVATION_OFFSET_SECONDS,
  MAXIMUM_BUDGET_BASE_UNITS,
  MAXIMUM_COMPLETED_PAIRS,
  NominationStatus,
  activateCampaign,
  assertStateInvariants,
  createCampaign,
  fundCampaign,
  nominateHero,
  settlePair,
  snapshotState,
} from "../reference-engine.mjs";
import { generateSettlementContentionVectors } from "../generate-settlement-contention-vectors.mjs";
import {
  ScheduleOperation,
  runDeterministicSettlementSchedule,
  settlementWritableLockNames,
} from "../settlement-contention-model.mjs";
import { loadReviewManifest } from "../validate-review-manifest.mjs";
import {
  loadSettlementContentionVectorBundle,
  validateSettlementContentionVectors,
} from "../validate-settlement-contention-vectors.mjs";

const GENESIS = 1_800_000_000;
const ACTIVE_AT = GENESIS + GENESIS_ACTIVATION_OFFSET_SECONDS;
const HASH = "a".repeat(64);
const MODEL = fileURLToPath(new URL("../settlement-contention-model.mjs", import.meta.url));
const GENERATOR = fileURLToPath(new URL("../generate-settlement-contention-vectors.mjs", import.meta.url));
const bundle = loadSettlementContentionVectorBundle();
const artifact = bundle.artifact;
const commitment = (value) => createHash("sha256").update(`iat-contention-test\0${value}`).digest("hex");

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

function nominate(state, proposerIdentity, heroIdentity, sequence) {
  return nominateHero(state, {
    now: ACTIVE_AT + 1,
    proposerAttestation: attestation(
      state,
      AttestationPurpose.NOMINATE,
      proposerIdentity,
      `nominate-${sequence}`,
      ACTIVE_AT + 1,
    ),
    heroXIdentityCommitment: commitment(`x-${heroIdentity}`),
    heroDisplayHandle: `@test_${sequence}`,
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
      `settle-${sequence}`,
      ACTIVE_AT + 2,
    ),
    heroDisplayHandle: `@test_${sequence}`,
    faultAt,
  };
}

function finalSlotFixture() {
  let state = createCampaign({
    campaignId: "iat-contention-test-reference-only",
    genesisTimestamp: GENESIS,
  });
  state = fundCampaign(state, {
    amountBaseUnits: MAXIMUM_BUDGET_BASE_UNITS,
    source: COMMUNITY_PROMOTION_SOURCE,
  });
  state = activateCampaign(state, {
    now: ACTIVE_AT,
    network: "MAINNET",
    separatelyReviewed: true,
    reviewHash: HASH,
    artifactHash: HASH,
    policyHash: HASH,
  });
  for (let sequence = 0; sequence < MAXIMUM_COMPLETED_PAIRS - 1; sequence += 1) {
    const hero = `prior-hero-${sequence}`;
    const pending = nominate(state, `prior-proposer-${sequence}`, hero, sequence);
    state = settlePair(pending.state, settlementAttempt(
      pending.state,
      `PRIOR-${sequence}`,
      pending.nominationId,
      hero,
      sequence,
    ));
  }
  const a = nominate(state, "final-proposer-a", "final-hero-a", 2_000);
  const b = nominate(a.state, "final-proposer-b", "final-hero-b", 2_001);
  return { state: b.state, nominationIds: { A: a.nominationId, B: b.nominationId } };
}

const fixture = finalSlotFixture();

function attempts(faults = {}) {
  return [
    settlementAttempt(
      fixture.state,
      "A",
      fixture.nominationIds.A,
      "final-hero-a",
      2_000,
      faults.A ?? null,
    ),
    settlementAttempt(
      fixture.state,
      "B",
      fixture.nominationIds.B,
      "final-hero-b",
      2_001,
      faults.B ?? null,
    ),
  ];
}

function timeline(first, second) {
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

test("compact contention vectors deterministically regenerate and stay held", () => {
  assert.deepEqual(validateSettlementContentionVectors(bundle), []);
  assert.deepEqual(generateSettlementContentionVectors(), artifact);
  assert.deepEqual(artifact.status.labels, [
    "DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE",
  ]);
  assert.equal(artifact.status.network, "NONE");
  assert.equal(artifact.summary.scenarioSetCommitmentSha256,
    "87dad1a11f005cbb3ea25a857026a6a009522a1a6f735e428e7bba45e510f7d8");
});

test("both final-slot attempts derive shared campaign and vault write locks", () => {
  const [attemptA, attemptB] = attempts();
  const locksA = settlementWritableLockNames(fixture.state, attemptA);
  const locksB = settlementWritableLockNames(fixture.state, attemptB);
  assert.deepEqual(locksA, [...locksA].sort());
  assert.deepEqual(locksB, [...locksB].sort());
  assert.equal(new Set(locksA).size, locksA.length);
  assert.equal(new Set(locksB).size, locksB.length);
  const shared = locksA.filter((lock) => locksB.includes(lock));
  assert.ok(shared.includes(`campaign:${fixture.state.config.campaignId}`));
  assert.ok(shared.includes(`promotion-vault:${fixture.state.config.campaignId}`));
  assert.ok(shared.includes(`settlement-sequence:${fixture.state.completedPairs}`));
});

test("one lock winner commits the final slot and the retrying loser stays unpaid", () => {
  const before = snapshotState(fixture.state);
  const result = runDeterministicSettlementSchedule(fixture.state, {
    attempts: attempts(),
    timeline: timeline("A", "B"),
  });
  assert.equal(snapshotState(fixture.state), before);
  assert.equal(result.trace.filter((entry) => entry.outcome === "LOCK_CONFLICT").length, 1);
  assert.deepEqual(result.attempts.map((attempt) => [attempt.attemptId, attempt.status]), [
    ["A", "COMMITTED"],
    ["B", "REJECTED"],
  ]);
  assert.equal(result.attempts[1].errorCode, "CAMPAIGN_PERMANENTLY_EXHAUSTED");
  assert.equal(result.state.completedPairs, 1_000);
  assert.equal(result.state.vaultBalanceBaseUnits, 0n);
  assert.equal(result.state.walletBalances.get("wallet-final-hero-a"), 120_000_000_000n);
  assert.equal(result.state.walletBalances.get("wallet-final-proposer-a"), 60_000_000_000n);
  assert.equal(result.state.walletBalances.has("wallet-final-hero-b"), false);
  assert.equal(result.state.walletBalances.has("wallet-final-proposer-b"), false);
  assert.equal(result.state.nominations.get(fixture.nominationIds.B).status, NominationStatus.EXPIRED);
  assert.equal(result.allLocksReleased, true);
  assertStateInvariants(result.state);
});

test("either transfer fault rolls back exactly before the blocked contender recovers", () => {
  for (const faultAt of ["AFTER_HERO_TRANSFER", "AFTER_PROPOSER_TRANSFER"]) {
    const result = runDeterministicSettlementSchedule(fixture.state, {
      attempts: attempts({ A: faultAt }),
      timeline: timeline("A", "B"),
    });
    const [attemptA, attemptB] = result.attempts;
    assert.equal(attemptA.status, "ROLLED_BACK");
    assert.equal(attemptA.rollbackPreserved, true);
    assert.equal(attemptA.beforeExecuteStateSha256, attemptA.afterExecuteStateSha256);
    assert.equal(attemptB.status, "COMMITTED");
    assert.equal(result.state.walletBalances.has("wallet-final-hero-a"), false);
    assert.equal(result.state.walletBalances.has("wallet-final-proposer-a"), false);
    assert.equal(result.state.walletBalances.get("wallet-final-hero-b"), 120_000_000_000n);
    assert.equal(result.state.walletBalances.get("wallet-final-proposer-b"), 60_000_000_000n);
    assert.equal(result.state.completedPairs, 1_000);
    assert.equal(result.state.vaultBalanceBaseUnits, 0n);
    assertStateInvariants(result.state);
  }
});

test("reversing admission order deterministically reverses the final-slot winner", () => {
  const result = runDeterministicSettlementSchedule(fixture.state, {
    attempts: attempts(),
    timeline: timeline("B", "A"),
  });
  assert.deepEqual(result.attempts.map((attempt) => [attempt.attemptId, attempt.status]), [
    ["A", "REJECTED"],
    ["B", "COMMITTED"],
  ]);
  assert.equal(result.state.walletBalances.has("wallet-final-hero-a"), false);
  assert.equal(result.state.walletBalances.get("wallet-final-hero-b"), 120_000_000_000n);
  assert.equal(result.state.nominations.get(fixture.nominationIds.A).status, NominationStatus.EXPIRED);
});

test("invalid scheduler operations fail without mutating caller state", () => {
  const before = snapshotState(fixture.state);
  assert.throws(
    () => runDeterministicSettlementSchedule(fixture.state, {
      attempts: attempts(),
      timeline: [{ operation: ScheduleOperation.EXECUTE, attemptId: "A" }],
    }),
    /SCHEDULER_EXECUTE_WITHOUT_LOCK/,
  );
  assert.equal(snapshotState(fixture.state), before);
  assert.throws(
    () => runDeterministicSettlementSchedule(fixture.state, {
      attempts: attempts(),
      timeline: [{ operation: ScheduleOperation.ACQUIRE, attemptId: "A" }],
    }),
    /SCHEDULER_UNRELEASED_LOCKS/,
  );
  assert.equal(snapshotState(fixture.state), before);
});

test("contention tooling is offline, powerless, compact, and manifest-bound", () => {
  const sources = `${readFileSync(MODEL, "utf8")}\n${readFileSync(GENERATOR, "utf8")}`;
  assert.doesNotMatch(sources, /\bfetch\s*\(|\bWebSocket\s*\(|wallet-adapter|sendTransaction/);
  assert.doesNotMatch(sources, /solana-test-validator|api\.devnet\.solana\.com|api\.mainnet-beta\.solana\.com/);
  assert.doesNotMatch(sources, /\bgenerateKeyPair(?:Sync)?\s*\(|\bcreatePrivateKey\s*\(|\bsign\s*\(/);
  assert.equal(artifact.contract.storesExpandedState, false);
  assert.equal(artifact.contract.storesExpandedTimelineOrTrace, false);
  assert.equal(artifact.contract.preparesTransactions, false);
  assert.equal(artifact.contract.broadcastsTransactions, false);
  const expectedRoles = {
    "SETTLEMENT_CONTENTION_MODEL.md": "ARTIFACT",
    "generate-settlement-contention-vectors.mjs": "GENERATOR",
    "settlement-contention-model.mjs": "SUPPORTING_SOURCE",
    "settlement-contention-vectors.v1.json": "ARTIFACT",
    "tests/settlement-contention-model.test.mjs": "TEST",
    "validate-settlement-contention-vectors.mjs": "VALIDATOR",
  };
  const roles = Object.fromEntries(loadReviewManifest().entries
    .filter((entry) => Object.hasOwn(expectedRoles, entry.path))
    .map((entry) => [entry.path, entry.role]));
  assert.deepEqual(roles, expectedRoles);
});

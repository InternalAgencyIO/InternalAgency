import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  AttestationPurpose,
  CampaignStatus,
  COMMUNITY_PROMOTION_SOURCE,
  GENESIS_ACTIVATION_OFFSET_SECONDS,
  HERO_REWARD_BASE_UNITS,
  MAXIMUM_BUDGET_BASE_UNITS,
  MAXIMUM_COMPLETED_PAIRS,
  NominationStatus,
  PAIR_REWARD_BASE_UNITS,
  PROPOSER_REWARD_BASE_UNITS,
  RewardRole,
  activateCampaign,
  assertStateInvariants,
  cancelNomination,
  createCampaign,
  fundCampaign,
  nominateHero,
  settlePair,
  snapshotState,
} from "../reference-engine.mjs";

const GENESIS = 1_800_000_000;
const ACTIVE_AT = GENESIS + GENESIS_ACTIVATION_OFFSET_SECONDS;
const HASH = "a".repeat(64);
const commitment = (value) => createHash("sha256").update(value).digest("hex");

function attestation(state, purpose, identity, now = ACTIVE_AT, overrides = {}) {
  return {
    verified: true,
    campaignId: state.config.campaignId,
    purpose,
    nodeId: `node-${identity}`,
    wallet: `wallet-${identity}`,
    xIdentityCommitment: commitment(`x-${identity}`),
    nonce: `${purpose.toLowerCase()}-${identity}-${now}`,
    issuedAt: now - 1,
    expiresAt: now + 300,
    ...overrides,
  };
}

function activeCampaign() {
  let state = createCampaign({ genesisTimestamp: GENESIS });
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
  return state;
}

function nominate(state, proposerIdentity, heroIdentity, sequence, now = ACTIVE_AT) {
  return nominateHero(state, {
    now,
    proposerAttestation: attestation(state, AttestationPurpose.NOMINATE, proposerIdentity, now, {
      nonce: `nominate-${sequence}`,
    }),
    heroXIdentityCommitment: commitment(`x-${heroIdentity}`),
    heroDisplayHandle: `@hero_${sequence}`,
  });
}

function settle(state, nominationId, heroIdentity, sequence, now = ACTIVE_AT + 1, overrides = {}) {
  return settlePair(state, {
    now,
    nominationId,
    heroAttestation: attestation(state, AttestationPurpose.SETTLE, heroIdentity, now, {
      nonce: `settle-${sequence}`,
      ...overrides.heroAttestation,
    }),
    heroDisplayHandle: overrides.heroDisplayHandle ?? `@hero_${sequence}`,
    faultAt: overrides.faultAt ?? null,
  });
}

function settleGeneratedPair(state, sequence) {
  const proposer = `proposer-${sequence}`;
  const hero = `hero-${sequence}`;
  const nominated = nominate(state, proposer, hero, sequence);
  return settle(nominated.state, nominated.nominationId, hero, sequence);
}

test("activation requires isolated full funding, review, mainnet binding, and Genesis plus eight hours", () => {
  const initialized = createCampaign({ genesisTimestamp: GENESIS });
  const before = snapshotState(initialized);
  assert.throws(
    () =>
      fundCampaign(initialized, {
        amountBaseUnits: MAXIMUM_BUDGET_BASE_UNITS,
        source: "V2_TREASURY",
      }),
    /FUNDING_SOURCE_NOT_ISOLATED_COMMUNITY_VAULT/,
  );
  assert.equal(snapshotState(initialized), before);

  const funded = fundCampaign(initialized, {
    amountBaseUnits: MAXIMUM_BUDGET_BASE_UNITS,
    source: COMMUNITY_PROMOTION_SOURCE,
  });
  const activation = {
    network: "MAINNET",
    separatelyReviewed: true,
    reviewHash: HASH,
    artifactHash: HASH,
    policyHash: HASH,
  };
  assert.throws(
    () => activateCampaign(funded, { ...activation, now: ACTIVE_AT - 1 }),
    /GENESIS_PLUS_EIGHT_HOURS_NOT_REACHED/,
  );
  assert.throws(
    () => activateCampaign(funded, { ...activation, now: ACTIVE_AT, network: "DEVNET" }),
    /ACTIVATION_REQUIRES_MAINNET_BINDING/,
  );
  assert.throws(
    () => activateCampaign(funded, { ...activation, now: ACTIVE_AT, separatelyReviewed: false }),
    /SEPARATE_REVIEW_REQUIRED/,
  );
  assert.equal(activateCampaign(funded, { ...activation, now: ACTIVE_AT }).status, CampaignStatus.ACTIVE);
});

test("pending and cancelled nominations consume no completed capacity", () => {
  let state = activeCampaign();
  const { state: pending, nominationId } = nominate(state, "proposer-a", "hero-a", 1);
  assert.equal(pending.completedPairs, 0);
  assert.equal(pending.vaultBalanceBaseUnits, MAXIMUM_BUDGET_BASE_UNITS);

  state = cancelNomination(pending, {
    now: ACTIVE_AT + 1,
    nominationId,
    proposerAttestation: attestation(pending, AttestationPurpose.CANCEL, "proposer-a", ACTIVE_AT + 1),
  });
  assert.equal(state.completedPairs, 0);
  assert.equal(state.vaultBalanceBaseUnits, MAXIMUM_BUDGET_BASE_UNITS);
  assert.equal(state.heroReservations.size, 0);
  assert.equal(state.activeNominationByProposer.size, 0);
  assertStateInvariants(state);
});

test("invalid and expired attestations fail without state change or capacity use", () => {
  const state = activeCampaign();
  const before = snapshotState(state);
  assert.throws(
    () =>
      nominateHero(state, {
        now: ACTIVE_AT,
        proposerAttestation: attestation(state, AttestationPurpose.NOMINATE, "invalid", ACTIVE_AT, {
          verified: false,
        }),
        heroXIdentityCommitment: commitment("x-hero-invalid"),
        heroDisplayHandle: "@invalid",
      }),
    /UNVERIFIED_ATTESTATION/,
  );
  assert.throws(
    () =>
      nominateHero(state, {
        now: ACTIVE_AT,
        proposerAttestation: attestation(state, AttestationPurpose.NOMINATE, "expired", ACTIVE_AT, {
          expiresAt: ACTIVE_AT,
        }),
        heroXIdentityCommitment: commitment("x-hero-expired"),
        heroDisplayHandle: "@expired",
      }),
    /ATTESTATION_EXPIRED/,
  );
  assert.equal(snapshotState(state), before);
  assert.equal(state.completedPairs, 0);
});

test("paired settlement pays exact amounts and creates all role markers atomically", () => {
  let state = activeCampaign();
  const { state: pending, nominationId } = nominate(state, "proposer-a", "hero-a", 1);
  state = settle(pending, nominationId, "hero-a", 1);

  assert.equal(state.completedPairs, 1);
  assert.equal(state.heroPaidBaseUnits, HERO_REWARD_BASE_UNITS);
  assert.equal(state.proposerPaidBaseUnits, PROPOSER_REWARD_BASE_UNITS);
  assert.equal(state.vaultBalanceBaseUnits, MAXIMUM_BUDGET_BASE_UNITS - PAIR_REWARD_BASE_UNITS);
  assert.equal(state.walletBalances.get("wallet-hero-a"), HERO_REWARD_BASE_UNITS);
  assert.equal(state.walletBalances.get("wallet-proposer-a"), PROPOSER_REWARD_BASE_UNITS);
  for (const role of Object.values(RewardRole)) {
    assert.equal(state.roleMarkers[role].nodes.size, 1);
    assert.equal(state.roleMarkers[role].wallets.size, 1);
    assert.equal(state.roleMarkers[role].xIdentityCommitments.size, 1);
  }
  assertStateInvariants(state);
});

test("a handle change is safe because settlement keys the immutable X commitment", () => {
  const state = activeCampaign();
  const { state: pending, nominationId } = nominate(state, "proposer-a", "hero-a", 1);
  const settled = settle(pending, nominationId, "hero-a", 1, ACTIVE_AT + 1, {
    heroDisplayHandle: "@renamed_hero",
  });
  assert.equal(settled.completedPairs, 1);
  assert.equal(
    settled.settlements[0].heroXIdentityCommitment,
    commitment("x-hero-a"),
  );
});

test("self-proposals are rejected by X identity, node, and wallet", () => {
  const state = activeCampaign();
  const proposer = attestation(state, AttestationPurpose.NOMINATE, "same", ACTIVE_AT);
  assert.throws(
    () =>
      nominateHero(state, {
        now: ACTIVE_AT,
        proposerAttestation: proposer,
        heroXIdentityCommitment: proposer.xIdentityCommitment,
        heroDisplayHandle: "@same",
      }),
    /SELF_PROPOSAL_X_IDENTITY/,
  );

  const nodeNomination = nominate(state, "proposer-node", "hero-node", 2);
  assert.throws(
    () =>
      settle(nodeNomination.state, nodeNomination.nominationId, "hero-node", 2, ACTIVE_AT + 1, {
        heroAttestation: { nodeId: "node-proposer-node" },
      }),
    /SELF_PROPOSAL_NODE/,
  );

  const walletNomination = nominate(state, "proposer-wallet", "hero-wallet", 3);
  assert.throws(
    () =>
      settle(walletNomination.state, walletNomination.nominationId, "hero-wallet", 3, ACTIVE_AT + 1, {
        heroAttestation: { wallet: "wallet-proposer-wallet" },
      }),
    /SELF_PROPOSAL_WALLET/,
  );
});

test("settlement failure after either modeled transfer rolls back every effect", () => {
  const state = activeCampaign();
  const { state: pending, nominationId } = nominate(state, "proposer-a", "hero-a", 1);
  const before = snapshotState(pending);

  assert.throws(
    () => settle(pending, nominationId, "hero-a", 1, ACTIVE_AT + 1, { faultAt: "AFTER_HERO_TRANSFER" }),
    /INJECTED_FAILURE_AFTER_HERO_TRANSFER/,
  );
  assert.equal(snapshotState(pending), before);

  assert.throws(
    () => settle(pending, nominationId, "hero-a", 1, ACTIVE_AT + 1, { faultAt: "AFTER_PROPOSER_TRANSFER" }),
    /INJECTED_FAILURE_AFTER_PROPOSER_TRANSFER/,
  );
  assert.equal(snapshotState(pending), before);
  assert.equal(pending.completedPairs, 0);
});

test("attestation nonces cannot be replayed across nominations", () => {
  let state = activeCampaign();
  const first = nominate(state, "proposer-a", "hero-a", 1);
  state = settle(first.state, first.nominationId, "hero-a", 1);
  const second = nominate(state, "proposer-b", "hero-b", 2);
  const before = snapshotState(second.state);

  assert.throws(
    () =>
      settle(second.state, second.nominationId, "hero-b", 2, ACTIVE_AT + 1, {
        heroAttestation: { nonce: "settle-1" },
      }),
    /ATTESTATION_REPLAY/,
  );
  assert.equal(snapshotState(second.state), before);
});

test("node, wallet, and X uniqueness are independent for each role", () => {
  let state = settleGeneratedPair(activeCampaign(), 0);

  assert.throws(
    () =>
      nominateHero(state, {
        now: ACTIVE_AT,
        proposerAttestation: attestation(state, AttestationPurpose.NOMINATE, "new-proposer", ACTIVE_AT, {
          wallet: "wallet-proposer-0",
          nonce: "duplicate-proposer-wallet",
        }),
        heroXIdentityCommitment: commitment("x-new-hero"),
        heroDisplayHandle: "@new_hero",
      }),
    /PROPOSER_WALLET_ALREADY_REWARDED/,
  );

  const duplicateHeroWallet = nominate(state, "proposer-b", "hero-new-x", 10);
  assert.throws(
    () =>
      settle(duplicateHeroWallet.state, duplicateHeroWallet.nominationId, "hero-new-x", 10, ACTIVE_AT + 1, {
        heroAttestation: { wallet: "wallet-hero-0" },
      }),
    /HERO_WALLET_ALREADY_REWARDED/,
  );

  // A prior HERO may still receive one PROPOSER reward because roles are independent.
  const heroAsProposer = nominate(state, "hero-0", "hero-c", 11);
  state = settle(heroAsProposer.state, heroAsProposer.nominationId, "hero-c", 11);
  assert.equal(state.completedPairs, 2);
  assert.ok(state.roleMarkers[RewardRole.PROPOSER].nodes.has("node-hero-0"));
  assertStateInvariants(state);
});

test("every proposer and hero identity dimension rejects reuse", () => {
  const state = settleGeneratedPair(activeCampaign(), 0);
  const proposerCases = [
    ["node", { nodeId: "node-proposer-0" }, /PROPOSER_NODE_ALREADY_REWARDED/],
    ["wallet", { wallet: "wallet-proposer-0" }, /PROPOSER_WALLET_ALREADY_REWARDED/],
    [
      "x",
      { xIdentityCommitment: commitment("x-proposer-0") },
      /PROPOSER_X_IDENTITY_ALREADY_REWARDED/,
    ],
  ];
  for (const [dimension, overrides, error] of proposerCases) {
    assert.throws(
      () =>
        nominateHero(state, {
          now: ACTIVE_AT,
          proposerAttestation: attestation(
            state,
            AttestationPurpose.NOMINATE,
            `duplicate-proposer-${dimension}`,
            ACTIVE_AT,
            { nonce: `duplicate-proposer-${dimension}`, ...overrides },
          ),
          heroXIdentityCommitment: commitment(`x-fresh-hero-${dimension}`),
          heroDisplayHandle: `@fresh_${dimension}`,
        }),
      error,
    );
  }

  assert.throws(
    () => nominate(state, "fresh-proposer-x", "hero-0", 20),
    /HERO_X_IDENTITY_ALREADY_REWARDED/,
  );

  const heroNode = nominate(state, "fresh-proposer-node", "fresh-hero-node", 21);
  assert.throws(
    () =>
      settle(heroNode.state, heroNode.nominationId, "fresh-hero-node", 21, ACTIVE_AT + 1, {
        heroAttestation: { nodeId: "node-hero-0" },
      }),
    /HERO_NODE_ALREADY_REWARDED/,
  );

  const heroWallet = nominate(state, "fresh-proposer-wallet", "fresh-hero-wallet", 22);
  assert.throws(
    () =>
      settle(heroWallet.state, heroWallet.nominationId, "fresh-hero-wallet", 22, ACTIVE_AT + 1, {
        heroAttestation: { wallet: "wallet-hero-0" },
      }),
    /HERO_WALLET_ALREADY_REWARDED/,
  );
});

test("cancellation and settlement ordering has exactly one terminal winner", () => {
  const state = activeCampaign();
  const pending = nominate(state, "race-proposer", "race-hero", 30);

  const cancelled = cancelNomination(pending.state, {
    now: ACTIVE_AT + 1,
    nominationId: pending.nominationId,
    proposerAttestation: attestation(
      pending.state,
      AttestationPurpose.CANCEL,
      "race-proposer",
      ACTIVE_AT + 1,
      { nonce: "race-cancel-first" },
    ),
  });
  const cancelledSnapshot = snapshotState(cancelled);
  assert.throws(
    () => settle(cancelled, pending.nominationId, "race-hero", 30, ACTIVE_AT + 2),
    /NOMINATION_NOT_PENDING/,
  );
  assert.equal(snapshotState(cancelled), cancelledSnapshot);
  assert.equal(cancelled.completedPairs, 0);

  const settled = settle(pending.state, pending.nominationId, "race-hero", 30, ACTIVE_AT + 1);
  const settledSnapshot = snapshotState(settled);
  assert.throws(
    () =>
      cancelNomination(settled, {
        now: ACTIVE_AT + 2,
        nominationId: pending.nominationId,
        proposerAttestation: attestation(
          settled,
          AttestationPurpose.CANCEL,
          "race-proposer",
          ACTIVE_AT + 2,
          { nonce: "race-settle-first" },
        ),
      }),
    /NOMINATION_NOT_PENDING/,
  );
  assert.equal(snapshotState(settled), settledSnapshot);
  assert.equal(settled.completedPairs, 1);
  assertStateInvariants(settled);
});

test("exactly 1,000 pairs spend exactly 180,000 IAT and permanently exhaust the campaign", () => {
  let state = activeCampaign();
  for (let sequence = 0; sequence < MAXIMUM_COMPLETED_PAIRS; sequence += 1) {
    state = settleGeneratedPair(state, sequence);
  }

  assert.equal(state.completedPairs, MAXIMUM_COMPLETED_PAIRS);
  assert.equal(state.status, CampaignStatus.EXHAUSTED);
  assert.equal(state.heroPaidBaseUnits, 120_000_000_000_000n);
  assert.equal(state.proposerPaidBaseUnits, 60_000_000_000_000n);
  assert.equal(state.heroPaidBaseUnits + state.proposerPaidBaseUnits, MAXIMUM_BUDGET_BASE_UNITS);
  assert.equal(state.vaultBalanceBaseUnits, 0n);
  assertStateInvariants(state);
  assert.throws(() => nominate(state, "late-proposer", "late-hero", 1_001), /CAMPAIGN_PERMANENTLY_EXHAUSTED/);
});

test("the final slot is serialized: one pending pair wins and the other remains unpaid", () => {
  let state = activeCampaign();
  for (let sequence = 0; sequence < MAXIMUM_COMPLETED_PAIRS - 1; sequence += 1) {
    state = settleGeneratedPair(state, sequence);
  }
  const candidateA = nominate(state, "final-proposer-a", "final-hero-a", 2_000);
  const candidateB = nominate(candidateA.state, "final-proposer-b", "final-hero-b", 2_001);
  state = settle(candidateB.state, candidateA.nominationId, "final-hero-a", 2_000);
  const terminalSnapshot = snapshotState(state);

  assert.equal(state.status, CampaignStatus.EXHAUSTED);
  assert.equal(state.completedPairs, MAXIMUM_COMPLETED_PAIRS);
  assert.throws(
    () => settle(state, candidateB.nominationId, "final-hero-b", 2_001),
    /CAMPAIGN_PERMANENTLY_EXHAUSTED/,
  );
  assert.equal(snapshotState(state), terminalSnapshot);
  assert.equal(state.walletBalances.has("wallet-final-hero-b"), false);
  assert.equal(state.walletBalances.has("wallet-final-proposer-b"), false);
  assert.equal(state.nominations.get(candidateB.nominationId).status, NominationStatus.EXPIRED);
  assert.equal(
    state.nominations.get(candidateB.nominationId).terminalReason,
    "CAMPAIGN_EXHAUSTED",
  );
  assert.equal(state.activeNominationByProposer.size, 0);
  assert.equal(state.heroReservations.size, 0);
});

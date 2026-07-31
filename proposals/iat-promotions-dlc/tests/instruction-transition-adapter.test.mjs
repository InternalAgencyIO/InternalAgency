/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { encodeInstruction } from "../program-interface-codec.mjs";
import {
  ADAPTER_COMMUNITY_SOURCE,
  applyInstructionBytes,
} from "../instruction-transition-adapter.mjs";
import {
  AttestationPurpose,
  CampaignStatus,
  HERO_REWARD_BASE_UNITS,
  MAXIMUM_BUDGET_BASE_UNITS,
  MAXIMUM_COMPLETED_PAIRS,
  NominationStatus,
  PROPOSER_REWARD_BASE_UNITS,
  assertStateInvariants,
  snapshotState,
} from "../reference-engine.mjs";

const GENESIS = 1_800_000_000;
const ACTIVE_AT = GENESIS + 28_800;
const hash = (value) => createHash("sha256").update(String(value)).digest("hex");

const initializationData = Object.freeze({
  campaign_id: hash("campaign"),
  activation_offset_seconds: "28800",
  hero_reward_base_units: "120000000000",
  proposer_reward_base_units: "60000000000",
  maximum_budget_base_units: "180000000000000",
  maximum_completed_pairs: "1000",
  policy_hash: hash("policy"),
  identity_domain_hash: hash("identity-domain"),
  verifier_ed25519_key: hash("public-verifier-key"),
});

function apply(state, name, data, context = {}) {
  return applyInstructionBytes(state, encodeInstruction(name, data), context);
}

function initialize() {
  return apply(null, "initialize_campaign", initializationData, {
    mint: "REFERENCE_IAT_MINT",
    genesisTimestamp: GENESIS,
    communityRefundWallet: "REFERENCE_COMMUNITY_REFUND_WALLET",
  }).state;
}

function fund(state) {
  return apply(state, "fund_campaign", { amount_base_units: "180000000000000" }, {
    source: ADAPTER_COMMUNITY_SOURCE,
  }).state;
}

function activate(state, overrides = {}) {
  return apply(state, "activate_campaign", {
    review_hash: hash("review"),
    artifact_hash: hash("artifact"),
    policy_hash: initializationData.policy_hash,
    ...overrides.data,
  }, {
    now: ACTIVE_AT,
    networkBinding: "MAINNET",
    reviewAuthorityApproved: true,
    ...overrides.context,
  }).state;
}

function activeCampaign() {
  return activate(fund(initialize()));
}

function nominationData(sequence, proposerX, heroX, now = ACTIVE_AT + 1) {
  return {
    attestation_id: hash(`nomination-attestation-${sequence}`),
    proposer_node_commitment: hash(`proposer-node-${sequence}`),
    proposer_x_identity_commitment: proposerX,
    hero_x_identity_commitment: heroX,
    nonce_hash: hash(`nomination-nonce-${sequence}`),
    issued_at: String(now - 1),
    expires_at: String(now + 299),
  };
}

function settlementData(sequence, heroX, now = ACTIVE_AT + 2) {
  return {
    attestation_id: hash(`settlement-attestation-${sequence}`),
    hero_node_commitment: hash(`hero-node-${sequence}`),
    hero_x_identity_commitment: heroX,
    nonce_hash: hash(`settlement-nonce-${sequence}`),
    issued_at: String(now - 1),
    expires_at: String(now + 299),
  };
}

function verification(state, purpose, data, identity) {
  return {
    ed25519Verified: true,
    exactMessageMatch: true,
    verifierEd25519Key: state.config.verifierEd25519Key,
    attestation: {
      purpose,
      campaignId: state.config.campaignId,
      attestationId: data.attestation_id,
      nodeCommitment: identity.nodeCommitment,
      wallet: identity.wallet,
      xIdentityCommitment: identity.xIdentityCommitment,
      nonceHash: data.nonce_hash,
      issuedAt: data.issued_at,
      expiresAt: data.expires_at,
    },
  };
}

function nominate(state, sequence, now = ACTIVE_AT + 1) {
  const proposerX = hash(`proposer-x-${sequence}`);
  const heroX = hash(`hero-x-${sequence}`);
  const data = nominationData(sequence, proposerX, heroX, now);
  return {
    data,
    heroX,
    result: apply(state, "nominate_hero", data, {
      now,
      heroDisplayHandle: `@h${sequence}`,
      verification: verification(state, AttestationPurpose.NOMINATE, data, {
        nodeCommitment: data.proposer_node_commitment,
        wallet: `proposer-wallet-${sequence}`,
        xIdentityCommitment: proposerX,
      }),
    }),
  };
}

function settle(state, nominationId, sequence, heroX, now = ACTIVE_AT + 2, overrides = {}) {
  const data = settlementData(sequence, heroX, now);
  return {
    data,
    result: apply(state, "settle_pair", data, {
      now,
      nominationId,
      heroDisplayHandle: `@h${sequence}`,
      verification: verification(state, AttestationPurpose.SETTLE, data, {
        nodeCommitment: data.hero_node_commitment,
        wallet: `hero-wallet-${sequence}`,
        xIdentityCommitment: heroX,
      }),
      ...overrides,
    }),
  };
}

test("encoded initialization, funding, activation, nomination, and settlement form one exact lifecycle", () => {
  let state = initialize();
  assert.equal(state.config.campaignId, initializationData.campaign_id);
  assert.equal(state.config.policyHash, initializationData.policy_hash);
  assert.equal(state.config.verifierEd25519Key, initializationData.verifier_ed25519_key);

  state = fund(state);
  assert.equal(state.status, CampaignStatus.FUNDED);
  state = activate(state);
  assert.equal(state.status, CampaignStatus.ACTIVE);

  const pending = nominate(state, 1);
  state = pending.result.state;
  assert.equal(pending.result.outcome.type, "HERO_NOMINATED");
  const settled = settle(state, pending.result.outcome.nominationId, 1, pending.heroX);
  state = settled.result.state;

  assert.equal(settled.result.outcome.type, "PAIR_SETTLED");
  assert.equal(state.completedPairs, 1);
  assert.equal(state.heroPaidBaseUnits, HERO_REWARD_BASE_UNITS);
  assert.equal(state.proposerPaidBaseUnits, PROPOSER_REWARD_BASE_UNITS);
  assertStateInvariants(state);
});

test("pre-activation cancellation returns only the isolated promotion balance", () => {
  const funded = fund(initialize());
  const cancelled = apply(funded, "cancel_campaign_pre_activation", {}).state;

  assert.equal(cancelled.status, CampaignStatus.CANCELLED);
  assert.equal(cancelled.vaultBalanceBaseUnits, 0n);
  assert.equal(cancelled.refundedBaseUnits, MAXIMUM_BUDGET_BASE_UNITS);
  assertStateInvariants(cancelled);
  assert.throws(
    () => apply(cancelled, "cancel_campaign_pre_activation", {}),
    /ACTIVE_OR_TERMINAL_CAMPAIGN_CANNOT_BE_CANCELLED/,
  );
});

test("encoded nomination cancellation releases reservations and pays nothing", () => {
  let state = activeCampaign();
  const pending = nominate(state, 2);
  state = pending.result.state;
  const nominationId = pending.result.outcome.nominationId;
  const nomination = state.nominations.get(nominationId);
  const now = ACTIVE_AT + 2;
  const data = {
    attestation_id: hash("cancel-attestation-2"),
    nonce_hash: hash("cancel-nonce-2"),
    issued_at: String(now - 1),
    expires_at: String(now + 299),
  };
  state = apply(state, "cancel_nomination", data, {
    now,
    nominationId,
    verification: verification(state, AttestationPurpose.CANCEL, data, {
      nodeCommitment: nomination.proposerNodeId,
      wallet: nomination.proposerWallet,
      xIdentityCommitment: nomination.proposerXIdentityCommitment,
    }),
  }).state;

  assert.equal(state.nominations.get(nominationId).status, NominationStatus.CANCELLED);
  assert.equal(state.completedPairs, 0);
  assert.equal(state.vaultBalanceBaseUnits, MAXIMUM_BUDGET_BASE_UNITS);
  assert.equal(state.heroReservations.size, 0);
  assertStateInvariants(state);
});

test("verification, policy, and injected-transfer failures leave caller state unchanged", () => {
  const funded = fund(initialize());
  const wrongPolicy = hash("wrong-policy");
  const fundedBefore = snapshotState(funded);
  assert.throws(
    () => activate(funded, { data: { policy_hash: wrongPolicy } }),
    /ACTIVATION_POLICY_HASH_MISMATCH/,
  );
  assert.equal(snapshotState(funded), fundedBefore);

  const state = activate(funded);
  const pending = nominate(state, 3);
  const pendingState = pending.result.state;
  const nominationId = pending.result.outcome.nominationId;
  const settleData = settlementData(3, pending.heroX);
  const validVerification = verification(pendingState, AttestationPurpose.SETTLE, settleData, {
    nodeCommitment: settleData.hero_node_commitment,
    wallet: "hero-wallet-3",
    xIdentityCommitment: pending.heroX,
  });
  const before = snapshotState(pendingState);

  assert.throws(
    () => apply(pendingState, "settle_pair", settleData, {
      now: ACTIVE_AT + 2,
      nominationId,
      heroDisplayHandle: "@h3",
      verification: { ...validVerification, exactMessageMatch: false },
    }),
    /ATTESTATION_BYTES_NOT_EXACT/,
  );
  assert.throws(
    () => apply(pendingState, "settle_pair", settleData, {
      now: ACTIVE_AT + 2,
      nominationId,
      heroDisplayHandle: "@h3",
      verification: {
        ...validVerification,
        attestation: { ...validVerification.attestation, attestationId: hash("tampered") },
      },
    }),
    /ATTESTATION_ID_MISMATCH/,
  );
  assert.throws(
    () => settle(pendingState, nominationId, 3, pending.heroX, ACTIVE_AT + 2, {
      faultAt: "AFTER_HERO_TRANSFER",
    }),
    /INJECTED_FAILURE_AFTER_HERO_TRANSFER/,
  );
  assert.equal(snapshotState(pendingState), before);
});

test("pair 1,000 exhausts through encoded transitions and surplus finalization is terminal", () => {
  let state = activeCampaign();
  for (let sequence = 0; sequence < MAXIMUM_COMPLETED_PAIRS; sequence += 1) {
    const pending = nominate(state, sequence);
    state = pending.result.state;
    state = settle(
      state,
      pending.result.outcome.nominationId,
      sequence,
      pending.heroX,
    ).result.state;
  }

  assert.equal(state.status, CampaignStatus.EXHAUSTED);
  assert.equal(state.completedPairs, MAXIMUM_COMPLETED_PAIRS);
  assert.equal(state.vaultBalanceBaseUnits, 0n);
  const finalized = apply(state, "finalize_exhausted_surplus", {});
  assert.equal(finalized.outcome.returnedBaseUnits, 0n);
  assertStateInvariants(finalized.state);
  assert.throws(
    () => apply(finalized.state, "finalize_exhausted_surplus", {}),
    /EXHAUSTED_SURPLUS_ALREADY_FINALIZED/,
  );
});

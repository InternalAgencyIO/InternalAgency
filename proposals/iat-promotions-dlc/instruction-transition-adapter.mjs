/**
 * Network-free bridge between the proposed binary interface and reference model.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * This is not a Solana program, client, transaction builder, or signing route.
 */

import { decodeInstruction } from "./program-interface-codec.mjs";
import {
  AttestationPurpose,
  COMMUNITY_PROMOTION_SOURCE,
  CampaignStatus,
  GENESIS_ACTIVATION_OFFSET_SECONDS,
  HERO_REWARD_BASE_UNITS,
  MAXIMUM_BUDGET_BASE_UNITS,
  MAXIMUM_COMPLETED_PAIRS,
  PROPOSER_REWARD_BASE_UNITS,
  activateCampaign,
  assertStateInvariants,
  cancelCampaignBeforeActivation,
  cancelNomination,
  cloneState,
  createCampaign,
  fundCampaign,
  nominateHero,
  settlePair,
} from "./reference-engine.mjs";

function fail(code) {
  throw new Error(code);
}

function requireString(value, code) {
  if (typeof value !== "string" || value.length === 0) fail(code);
  return value;
}

function requireSafeTimestamp(value, code) {
  let parsed;
  try {
    parsed = BigInt(value);
  } catch {
    fail(code);
  }
  if (parsed < 0n || parsed > BigInt(Number.MAX_SAFE_INTEGER)) fail(code);
  return Number(parsed);
}

function requireDecimalEqual(actual, expected, code) {
  if (actual !== String(expected)) fail(code);
}

function requireState(state) {
  if (!state) fail("CAMPAIGN_STATE_REQUIRED");
  return state;
}

function requireExactVerification(state, data, context, purpose, bindingFields = {}) {
  const verification = context?.verification;
  if (!verification || verification.ed25519Verified !== true) {
    fail("ED25519_PREINSTRUCTION_NOT_VERIFIED");
  }
  if (verification.exactMessageMatch !== true) fail("ATTESTATION_BYTES_NOT_EXACT");
  if (verification.verifierEd25519Key !== state.config.verifierEd25519Key) {
    fail("VERIFIER_KEY_MISMATCH");
  }

  const attestation = verification.attestation;
  if (!attestation || typeof attestation !== "object") fail("ATTESTATION_CONTEXT_REQUIRED");
  if (attestation.purpose !== purpose) fail("ATTESTATION_PURPOSE_MISMATCH");
  if (attestation.campaignId !== state.config.campaignId) fail("ATTESTATION_CAMPAIGN_MISMATCH");
  if (attestation.attestationId !== data.attestation_id) fail("ATTESTATION_ID_MISMATCH");
  if (attestation.nonceHash !== data.nonce_hash) fail("ATTESTATION_NONCE_HASH_MISMATCH");
  if (String(attestation.issuedAt) !== data.issued_at) fail("ATTESTATION_ISSUED_AT_MISMATCH");
  if (String(attestation.expiresAt) !== data.expires_at) fail("ATTESTATION_EXPIRES_AT_MISMATCH");
  for (const [attestationField, expected] of Object.entries(bindingFields)) {
    if (attestation[attestationField] !== expected) {
      fail(`ATTESTATION_${attestationField.toUpperCase()}_MISMATCH`);
    }
  }

  return {
    verified: true,
    campaignId: state.config.campaignId,
    purpose,
    nodeId: requireString(attestation.nodeCommitment, "INVALID_NODE_COMMITMENT"),
    wallet: requireString(attestation.wallet, "INVALID_ATTESTED_WALLET"),
    xIdentityCommitment: requireString(
      attestation.xIdentityCommitment,
      "INVALID_ATTESTED_X_COMMITMENT",
    ),
    nonce: attestation.nonceHash,
    issuedAt: requireSafeTimestamp(attestation.issuedAt, "INVALID_ATTESTATION_ISSUED_AT"),
    expiresAt: requireSafeTimestamp(attestation.expiresAt, "INVALID_ATTESTATION_EXPIRES_AT"),
  };
}

function initializeCampaign(state, data, context) {
  if (state !== null && state !== undefined) fail("CAMPAIGN_ALREADY_INITIALIZED");
  requireDecimalEqual(
    data.activation_offset_seconds,
    GENESIS_ACTIVATION_OFFSET_SECONDS,
    "ACTIVATION_OFFSET_MISMATCH",
  );
  requireDecimalEqual(data.hero_reward_base_units, HERO_REWARD_BASE_UNITS, "HERO_REWARD_MISMATCH");
  requireDecimalEqual(
    data.proposer_reward_base_units,
    PROPOSER_REWARD_BASE_UNITS,
    "PROPOSER_REWARD_MISMATCH",
  );
  requireDecimalEqual(
    data.maximum_budget_base_units,
    MAXIMUM_BUDGET_BASE_UNITS,
    "MAXIMUM_BUDGET_MISMATCH",
  );
  requireDecimalEqual(
    data.maximum_completed_pairs,
    MAXIMUM_COMPLETED_PAIRS,
    "MAXIMUM_COMPLETED_PAIRS_MISMATCH",
  );

  const next = createCampaign({
    campaignId: data.campaign_id,
    mint: requireString(context?.mint, "MINT_CONTEXT_REQUIRED"),
    genesisTimestamp: requireSafeTimestamp(
      context?.genesisTimestamp,
      "GENESIS_TIMESTAMP_CONTEXT_REQUIRED",
    ),
    communityRefundWallet: requireString(
      context?.communityRefundWallet,
      "COMMUNITY_REFUND_CONTEXT_REQUIRED",
    ),
  });
  next.config.policyHash = data.policy_hash;
  next.config.identityDomainHash = data.identity_domain_hash;
  next.config.verifierEd25519Key = data.verifier_ed25519_key;
  assertStateInvariants(next);
  return { state: next, outcome: { type: "CAMPAIGN_INITIALIZED" } };
}

function applyDecodedInstruction(state, decoded, context) {
  const { name, data } = decoded;
  if (name === "initialize_campaign") return initializeCampaign(state, data, context);

  const current = requireState(state);
  if (name === "fund_campaign") {
    const next = fundCampaign(current, {
      amountBaseUnits: data.amount_base_units,
      source: context?.source,
    });
    return { state: next, outcome: { type: "CAMPAIGN_FUNDED" } };
  }

  if (name === "activate_campaign") {
    if (data.policy_hash !== current.config.policyHash) fail("ACTIVATION_POLICY_HASH_MISMATCH");
    const next = activateCampaign(current, {
      now: requireSafeTimestamp(context?.now, "ACTIVATION_TIMESTAMP_CONTEXT_REQUIRED"),
      network: context?.networkBinding,
      separatelyReviewed: context?.reviewAuthorityApproved,
      reviewHash: data.review_hash,
      artifactHash: data.artifact_hash,
      policyHash: data.policy_hash,
    });
    return { state: next, outcome: { type: "CAMPAIGN_ACTIVATED" } };
  }

  if (name === "cancel_campaign_pre_activation") {
    return {
      state: cancelCampaignBeforeActivation(current),
      outcome: { type: "CAMPAIGN_CANCELLED_PRE_ACTIVATION" },
    };
  }

  if (name === "nominate_hero") {
    const proposerAttestation = requireExactVerification(
      current,
      data,
      context,
      AttestationPurpose.NOMINATE,
      {
        nodeCommitment: data.proposer_node_commitment,
        xIdentityCommitment: data.proposer_x_identity_commitment,
      },
    );
    const nominated = nominateHero(current, {
      now: requireSafeTimestamp(context?.now, "NOMINATION_TIMESTAMP_CONTEXT_REQUIRED"),
      proposerAttestation,
      heroXIdentityCommitment: data.hero_x_identity_commitment,
      heroDisplayHandle: context?.heroDisplayHandle,
    });
    return {
      state: nominated.state,
      outcome: { type: "HERO_NOMINATED", nominationId: nominated.nominationId },
    };
  }

  if (name === "cancel_nomination") {
    const proposerAttestation = requireExactVerification(
      current,
      data,
      context,
      AttestationPurpose.CANCEL,
    );
    const nominationId = requireString(context?.nominationId, "NOMINATION_ID_CONTEXT_REQUIRED");
    return {
      state: cancelNomination(current, {
        now: requireSafeTimestamp(context?.now, "CANCELLATION_TIMESTAMP_CONTEXT_REQUIRED"),
        nominationId,
        proposerAttestation,
      }),
      outcome: { type: "NOMINATION_CANCELLED", nominationId },
    };
  }

  if (name === "settle_pair") {
    const heroAttestation = requireExactVerification(
      current,
      data,
      context,
      AttestationPurpose.SETTLE,
      {
        nodeCommitment: data.hero_node_commitment,
        xIdentityCommitment: data.hero_x_identity_commitment,
      },
    );
    const nominationId = requireString(context?.nominationId, "NOMINATION_ID_CONTEXT_REQUIRED");
    return {
      state: settlePair(current, {
        now: requireSafeTimestamp(context?.now, "SETTLEMENT_TIMESTAMP_CONTEXT_REQUIRED"),
        nominationId,
        heroAttestation,
        heroDisplayHandle: context?.heroDisplayHandle,
        faultAt: context?.faultAt ?? null,
      }),
      outcome: { type: "PAIR_SETTLED", nominationId },
    };
  }

  if (name === "finalize_exhausted_surplus") {
    if (current.status !== CampaignStatus.EXHAUSTED) fail("CAMPAIGN_NOT_EXHAUSTED");
    if (current.events.some((event) => event.type === "ExhaustedSurplusFinalized")) {
      fail("EXHAUSTED_SURPLUS_ALREADY_FINALIZED");
    }
    const next = cloneState(current);
    const returnedBaseUnits = next.vaultBalanceBaseUnits;
    next.refundedBaseUnits += returnedBaseUnits;
    next.vaultBalanceBaseUnits = 0n;
    next.events.push({ type: "ExhaustedSurplusFinalized", returnedBaseUnits });
    assertStateInvariants(next);
    return {
      state: next,
      outcome: { type: "EXHAUSTED_SURPLUS_FINALIZED", returnedBaseUnits },
    };
  }

  fail("UNSUPPORTED_DECODED_INSTRUCTION");
}

export function applyInstructionBytes(state, bytes, context = {}) {
  return applyDecodedInstruction(state, decodeInstruction(bytes), context);
}

export const ADAPTER_COMMUNITY_SOURCE = COMMUNITY_PROMOTION_SOURCE;

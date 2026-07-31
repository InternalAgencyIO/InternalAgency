/**
 * Network-free reference model for the IAT "Propose a Hero" draft.
 *
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * This module never imports wallet, RPC, Solana, site, or production code. It
 * exists only to make the proposal's state and accounting invariants executable.
 */

export const IAT_DECIMALS = 9;
export const HERO_REWARD_BASE_UNITS = 120_000_000_000n;
export const PROPOSER_REWARD_BASE_UNITS = 60_000_000_000n;
export const PAIR_REWARD_BASE_UNITS = 180_000_000_000n;
export const MAXIMUM_COMPLETED_PAIRS = 1_000;
export const MAXIMUM_BUDGET_BASE_UNITS = 180_000_000_000_000n;
export const GENESIS_ACTIVATION_OFFSET_SECONDS = 28_800;
export const COMMUNITY_PROMOTION_SOURCE = "COMMUNITY_ALLOCATION_SEPARATE_PROMOTION_VAULT";

export const CampaignStatus = Object.freeze({
  INITIALIZED: "INITIALIZED",
  FUNDED: "FUNDED",
  ACTIVE: "ACTIVE",
  EXHAUSTED: "EXHAUSTED",
  CANCELLED: "CANCELLED",
});

export const NominationStatus = Object.freeze({
  PENDING: "PENDING",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  SETTLED: "SETTLED",
});

export const RewardRole = Object.freeze({ HERO: "HERO", PROPOSER: "PROPOSER" });
export const AttestationPurpose = Object.freeze({
  NOMINATE: "NOMINATE",
  CANCEL: "CANCEL",
  SETTLE: "SETTLE",
});

function fail(code) {
  throw new Error(code);
}

function requireString(value, code) {
  if (typeof value !== "string" || value.length === 0) fail(code);
  return value;
}

function requireTimestamp(value, code) {
  if (!Number.isSafeInteger(value) || value < 0) fail(code);
  return value;
}

function requireHash(value, code) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/i.test(value)) fail(code);
  return value.toLowerCase();
}

function requireCommitment(value) {
  return requireHash(value, "INVALID_X_IDENTITY_COMMITMENT");
}

function normalizeHandle(value) {
  if (typeof value !== "string" || !/^@?[A-Za-z0-9_]{1,15}$/.test(value)) {
    fail("INVALID_X_HANDLE");
  }
  return `@${value.replace(/^@/, "").toLowerCase()}`;
}

function toAmount(value) {
  try {
    const amount = BigInt(value);
    if (amount < 0n) fail("INVALID_AMOUNT");
    return amount;
  } catch {
    fail("INVALID_AMOUNT");
  }
}

function emptyMarkers() {
  return {
    nodes: new Set(),
    wallets: new Set(),
    xIdentityCommitments: new Set(),
  };
}

function cloneMarkers(markers) {
  return {
    nodes: new Set(markers.nodes),
    wallets: new Set(markers.wallets),
    xIdentityCommitments: new Set(markers.xIdentityCommitments),
  };
}

export function cloneState(state) {
  return {
    ...state,
    config: { ...state.config },
    activationEvidence: state.activationEvidence ? { ...state.activationEvidence } : null,
    nominations: new Map(
      [...state.nominations.entries()].map(([id, nomination]) => [id, { ...nomination }]),
    ),
    activeNominationByProposer: new Map(state.activeNominationByProposer),
    heroReservations: new Map(state.heroReservations),
    roleMarkers: {
      [RewardRole.HERO]: cloneMarkers(state.roleMarkers[RewardRole.HERO]),
      [RewardRole.PROPOSER]: cloneMarkers(state.roleMarkers[RewardRole.PROPOSER]),
    },
    usedAttestationNonces: new Set(state.usedAttestationNonces),
    walletBalances: new Map(state.walletBalances),
    settlements: state.settlements.map((receipt) => ({ ...receipt })),
    events: state.events.map((event) => ({ ...event })),
  };
}

export function createCampaign({
  campaignId = "iat-promotions-dlc-v0-reference",
  mint = "REFERENCE_IAT_MINT",
  genesisTimestamp,
  communityRefundWallet = "REFERENCE_COMMUNITY_REFUND_WALLET",
} = {}) {
  requireString(campaignId, "INVALID_CAMPAIGN_ID");
  requireString(mint, "INVALID_MINT");
  requireTimestamp(genesisTimestamp, "INVALID_GENESIS_TIMESTAMP");
  requireString(communityRefundWallet, "INVALID_COMMUNITY_REFUND_WALLET");

  return {
    config: {
      campaignId,
      mint,
      mintDecimals: IAT_DECIMALS,
      genesisTimestamp,
      earliestActivationTimestamp: genesisTimestamp + GENESIS_ACTIVATION_OFFSET_SECONDS,
      heroRewardBaseUnits: HERO_REWARD_BASE_UNITS,
      proposerRewardBaseUnits: PROPOSER_REWARD_BASE_UNITS,
      pairRewardBaseUnits: PAIR_REWARD_BASE_UNITS,
      maximumCompletedPairs: MAXIMUM_COMPLETED_PAIRS,
      maximumBudgetBaseUnits: MAXIMUM_BUDGET_BASE_UNITS,
      vaultScope: "PROMOTIONS_DLC_ONLY",
      communityRefundWallet,
    },
    status: CampaignStatus.INITIALIZED,
    vaultBalanceBaseUnits: 0n,
    refundedBaseUnits: 0n,
    completedPairs: 0,
    heroPaidBaseUnits: 0n,
    proposerPaidBaseUnits: 0n,
    nextNominationSequence: 0,
    activationEvidence: null,
    nominations: new Map(),
    activeNominationByProposer: new Map(),
    heroReservations: new Map(),
    roleMarkers: {
      [RewardRole.HERO]: emptyMarkers(),
      [RewardRole.PROPOSER]: emptyMarkers(),
    },
    usedAttestationNonces: new Set(),
    walletBalances: new Map(),
    settlements: [],
    events: [{ type: "CampaignInitialized", campaignId }],
  };
}

export function fundCampaign(state, { amountBaseUnits, source }) {
  if (state.status !== CampaignStatus.INITIALIZED) fail("CAMPAIGN_NOT_INITIALIZED");
  if (source !== COMMUNITY_PROMOTION_SOURCE) fail("FUNDING_SOURCE_NOT_ISOLATED_COMMUNITY_VAULT");
  const amount = toAmount(amountBaseUnits);
  if (amount !== MAXIMUM_BUDGET_BASE_UNITS) fail("CAMPAIGN_REQUIRES_EXACT_MAXIMUM_BUDGET");

  const next = cloneState(state);
  next.vaultBalanceBaseUnits = amount;
  next.status = CampaignStatus.FUNDED;
  next.events.push({ type: "CampaignFunded", amountBaseUnits: amount, source });
  assertStateInvariants(next);
  return next;
}

export function activateCampaign(
  state,
  { now, network, separatelyReviewed, reviewHash, artifactHash, policyHash },
) {
  if (state.status !== CampaignStatus.FUNDED) fail("CAMPAIGN_NOT_FUNDED");
  requireTimestamp(now, "INVALID_ACTIVATION_TIMESTAMP");
  if (network !== "MAINNET") fail("ACTIVATION_REQUIRES_MAINNET_BINDING");
  if (now < state.config.earliestActivationTimestamp) fail("GENESIS_PLUS_EIGHT_HOURS_NOT_REACHED");
  if (separatelyReviewed !== true) fail("SEPARATE_REVIEW_REQUIRED");
  if (state.vaultBalanceBaseUnits !== MAXIMUM_BUDGET_BASE_UNITS) fail("CAMPAIGN_NOT_FULLY_FUNDED");

  const next = cloneState(state);
  next.activationEvidence = {
    activatedAt: now,
    network,
    reviewHash: requireHash(reviewHash, "INVALID_REVIEW_HASH"),
    artifactHash: requireHash(artifactHash, "INVALID_ARTIFACT_HASH"),
    policyHash: requireHash(policyHash, "INVALID_POLICY_HASH"),
  };
  next.status = CampaignStatus.ACTIVE;
  next.events.push({ type: "CampaignActivated", ...next.activationEvidence });
  assertStateInvariants(next);
  return next;
}

export function cancelCampaignBeforeActivation(state) {
  if (![CampaignStatus.INITIALIZED, CampaignStatus.FUNDED].includes(state.status)) {
    fail("ACTIVE_OR_TERMINAL_CAMPAIGN_CANNOT_BE_CANCELLED");
  }
  const next = cloneState(state);
  next.refundedBaseUnits += next.vaultBalanceBaseUnits;
  next.vaultBalanceBaseUnits = 0n;
  next.status = CampaignStatus.CANCELLED;
  next.events.push({ type: "CampaignCancelled", refundedBaseUnits: next.refundedBaseUnits });
  assertStateInvariants(next);
  return next;
}

function validateAttestation(state, attestation, purpose, now) {
  if (!attestation || attestation.verified !== true) fail("UNVERIFIED_ATTESTATION");
  if (attestation.campaignId !== state.config.campaignId) fail("ATTESTATION_CAMPAIGN_MISMATCH");
  if (attestation.purpose !== purpose) fail("ATTESTATION_PURPOSE_MISMATCH");
  requireTimestamp(now, "INVALID_CURRENT_TIMESTAMP");
  requireTimestamp(attestation.issuedAt, "INVALID_ATTESTATION_ISSUED_AT");
  requireTimestamp(attestation.expiresAt, "INVALID_ATTESTATION_EXPIRY");
  if (attestation.issuedAt > now) fail("ATTESTATION_NOT_YET_VALID");
  if (attestation.expiresAt <= now) fail("ATTESTATION_EXPIRED");

  const nonce = requireString(attestation.nonce, "INVALID_ATTESTATION_NONCE");
  if (state.usedAttestationNonces.has(nonce)) fail("ATTESTATION_REPLAY");

  return {
    nonce,
    nodeId: requireString(attestation.nodeId, "INVALID_NODE_ID"),
    wallet: requireString(attestation.wallet, "INVALID_WALLET"),
    xIdentityCommitment: requireCommitment(attestation.xIdentityCommitment),
  };
}

function assertRoleAvailable(state, role, binding) {
  const markers = state.roleMarkers[role];
  if (markers.nodes.has(binding.nodeId)) fail(`${role}_NODE_ALREADY_REWARDED`);
  if (markers.wallets.has(binding.wallet)) fail(`${role}_WALLET_ALREADY_REWARDED`);
  if (markers.xIdentityCommitments.has(binding.xIdentityCommitment)) {
    fail(`${role}_X_IDENTITY_ALREADY_REWARDED`);
  }
}

function addRoleMarkers(state, role, binding) {
  const markers = state.roleMarkers[role];
  markers.nodes.add(binding.nodeId);
  markers.wallets.add(binding.wallet);
  markers.xIdentityCommitments.add(binding.xIdentityCommitment);
}

function creditWallet(state, wallet, amount) {
  state.walletBalances.set(wallet, (state.walletBalances.get(wallet) ?? 0n) + amount);
}

function assertCampaignAcceptsWork(state) {
  if (state.status === CampaignStatus.EXHAUSTED) fail("CAMPAIGN_PERMANENTLY_EXHAUSTED");
  if (state.status !== CampaignStatus.ACTIVE) fail("CAMPAIGN_NOT_ACTIVE");
}

export function nominateHero(
  state,
  { now, proposerAttestation, heroXIdentityCommitment, heroDisplayHandle },
) {
  assertCampaignAcceptsWork(state);
  const proposer = validateAttestation(
    state,
    proposerAttestation,
    AttestationPurpose.NOMINATE,
    now,
  );
  const heroCommitment = requireCommitment(heroXIdentityCommitment);
  const displayHandle = normalizeHandle(heroDisplayHandle);

  assertRoleAvailable(state, RewardRole.PROPOSER, proposer);
  if (proposer.xIdentityCommitment === heroCommitment) fail("SELF_PROPOSAL_X_IDENTITY");
  if (state.activeNominationByProposer.has(proposer.nodeId)) fail("PROPOSER_ALREADY_HAS_ACTIVE_NOMINATION");
  if (state.heroReservations.has(heroCommitment)) fail("HERO_ALREADY_RESERVED");

  const next = cloneState(state);
  const nominationId = `nomination-${next.nextNominationSequence}`;
  next.nextNominationSequence += 1;
  next.nominations.set(nominationId, {
    nominationId,
    status: NominationStatus.PENDING,
    createdAt: now,
    proposerNodeId: proposer.nodeId,
    proposerWallet: proposer.wallet,
    proposerXIdentityCommitment: proposer.xIdentityCommitment,
    heroXIdentityCommitment: heroCommitment,
    heroDisplayHandleAtNomination: displayHandle,
    settledAt: null,
    cancelledAt: null,
    expiredAt: null,
    terminalReason: null,
  });
  next.activeNominationByProposer.set(proposer.nodeId, nominationId);
  next.heroReservations.set(heroCommitment, nominationId);
  next.usedAttestationNonces.add(proposer.nonce);
  next.events.push({
    type: "NominationCreated",
    nominationId,
    proposerNodeId: proposer.nodeId,
    heroXIdentityCommitment: heroCommitment,
    heroDisplayHandleAtNomination: displayHandle,
  });
  assertStateInvariants(next);
  return { state: next, nominationId };
}

export function cancelNomination(state, { now, nominationId, proposerAttestation }) {
  assertCampaignAcceptsWork(state);
  const proposer = validateAttestation(
    state,
    proposerAttestation,
    AttestationPurpose.CANCEL,
    now,
  );
  const nomination = state.nominations.get(nominationId);
  if (!nomination) fail("NOMINATION_NOT_FOUND");
  if (nomination.status !== NominationStatus.PENDING) fail("NOMINATION_NOT_PENDING");
  if (
    nomination.proposerNodeId !== proposer.nodeId ||
    nomination.proposerWallet !== proposer.wallet ||
    nomination.proposerXIdentityCommitment !== proposer.xIdentityCommitment
  ) {
    fail("NOMINATION_PROPOSER_MISMATCH");
  }

  const next = cloneState(state);
  const nextNomination = next.nominations.get(nominationId);
  nextNomination.status = NominationStatus.CANCELLED;
  nextNomination.cancelledAt = now;
  nextNomination.terminalReason = "PROPOSER_CANCELLED";
  next.activeNominationByProposer.delete(proposer.nodeId);
  next.heroReservations.delete(nomination.heroXIdentityCommitment);
  next.usedAttestationNonces.add(proposer.nonce);
  next.events.push({ type: "NominationCancelled", nominationId });
  assertStateInvariants(next);
  return next;
}

export function settlePair(
  state,
  { now, nominationId, heroAttestation, heroDisplayHandle, faultAt = null },
) {
  assertCampaignAcceptsWork(state);
  const hero = validateAttestation(state, heroAttestation, AttestationPurpose.SETTLE, now);
  const nomination = state.nominations.get(nominationId);
  if (!nomination) fail("NOMINATION_NOT_FOUND");
  if (nomination.status !== NominationStatus.PENDING) fail("NOMINATION_NOT_PENDING");
  if (nomination.heroXIdentityCommitment !== hero.xIdentityCommitment) {
    fail("HERO_X_IDENTITY_MISMATCH");
  }
  normalizeHandle(heroDisplayHandle);
  if (nomination.proposerNodeId === hero.nodeId) fail("SELF_PROPOSAL_NODE");
  if (nomination.proposerWallet === hero.wallet) fail("SELF_PROPOSAL_WALLET");
  if (nomination.proposerXIdentityCommitment === hero.xIdentityCommitment) {
    fail("SELF_PROPOSAL_X_IDENTITY");
  }

  const proposer = {
    nodeId: nomination.proposerNodeId,
    wallet: nomination.proposerWallet,
    xIdentityCommitment: nomination.proposerXIdentityCommitment,
  };
  assertRoleAvailable(state, RewardRole.HERO, hero);
  assertRoleAvailable(state, RewardRole.PROPOSER, proposer);
  if (state.completedPairs >= MAXIMUM_COMPLETED_PAIRS) fail("COMPLETED_PAIR_CAP_REACHED");
  if (state.vaultBalanceBaseUnits < PAIR_REWARD_BASE_UNITS) fail("PROMOTION_VAULT_UNDERFUNDED");

  // All mutations occur on a private draft. Throwing at either injected fault
  // proves the caller's original state cannot observe a partial settlement.
  const next = cloneState(state);
  next.vaultBalanceBaseUnits -= HERO_REWARD_BASE_UNITS;
  next.heroPaidBaseUnits += HERO_REWARD_BASE_UNITS;
  creditWallet(next, hero.wallet, HERO_REWARD_BASE_UNITS);
  if (faultAt === "AFTER_HERO_TRANSFER") fail("INJECTED_FAILURE_AFTER_HERO_TRANSFER");

  next.vaultBalanceBaseUnits -= PROPOSER_REWARD_BASE_UNITS;
  next.proposerPaidBaseUnits += PROPOSER_REWARD_BASE_UNITS;
  creditWallet(next, proposer.wallet, PROPOSER_REWARD_BASE_UNITS);
  if (faultAt === "AFTER_PROPOSER_TRANSFER") fail("INJECTED_FAILURE_AFTER_PROPOSER_TRANSFER");

  addRoleMarkers(next, RewardRole.HERO, hero);
  addRoleMarkers(next, RewardRole.PROPOSER, proposer);
  next.usedAttestationNonces.add(hero.nonce);

  const nextNomination = next.nominations.get(nominationId);
  nextNomination.status = NominationStatus.SETTLED;
  nextNomination.settledAt = now;
  next.activeNominationByProposer.delete(proposer.nodeId);
  next.heroReservations.delete(hero.xIdentityCommitment);

  const sequence = next.completedPairs;
  next.completedPairs += 1;
  const receipt = {
    sequence,
    nominationId,
    settledAt: now,
    heroNodeId: hero.nodeId,
    heroWallet: hero.wallet,
    heroXIdentityCommitment: hero.xIdentityCommitment,
    proposerNodeId: proposer.nodeId,
    proposerWallet: proposer.wallet,
    proposerXIdentityCommitment: proposer.xIdentityCommitment,
    heroRewardBaseUnits: HERO_REWARD_BASE_UNITS,
    proposerRewardBaseUnits: PROPOSER_REWARD_BASE_UNITS,
  };
  next.settlements.push(receipt);
  next.events.push({ type: "PairSettled", ...receipt });

  if (next.completedPairs === MAXIMUM_COMPLETED_PAIRS) {
    let expiredNominations = 0;
    for (const pendingNomination of next.nominations.values()) {
      if (pendingNomination.status !== NominationStatus.PENDING) continue;
      pendingNomination.status = NominationStatus.EXPIRED;
      pendingNomination.expiredAt = now;
      pendingNomination.terminalReason = "CAMPAIGN_EXHAUSTED";
      expiredNominations += 1;
    }
    next.activeNominationByProposer.clear();
    next.heroReservations.clear();
    next.status = CampaignStatus.EXHAUSTED;
    next.events.push({
      type: "CampaignExhausted",
      completedPairs: next.completedPairs,
      totalPaidBaseUnits: next.heroPaidBaseUnits + next.proposerPaidBaseUnits,
      expiredNominations,
    });
  }

  assertStateInvariants(next);
  return next;
}

export function validateStateInvariants(state) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const completed = BigInt(state.completedPairs);

  expect(Number.isInteger(state.completedPairs), "completedPairs must be an integer");
  expect(state.completedPairs >= 0, "completedPairs cannot be negative");
  expect(state.completedPairs <= MAXIMUM_COMPLETED_PAIRS, "completedPairs exceeds hard cap");
  expect(state.settlements.length === state.completedPairs, "settlement count mismatch");
  expect(
    state.heroPaidBaseUnits === completed * HERO_REWARD_BASE_UNITS,
    "hero paid accounting mismatch",
  );
  expect(
    state.proposerPaidBaseUnits === completed * PROPOSER_REWARD_BASE_UNITS,
    "proposer paid accounting mismatch",
  );

  if ([CampaignStatus.FUNDED, CampaignStatus.ACTIVE, CampaignStatus.EXHAUSTED].includes(state.status)) {
    expect(
      state.vaultBalanceBaseUnits === MAXIMUM_BUDGET_BASE_UNITS - completed * PAIR_REWARD_BASE_UNITS,
      "vault accounting mismatch",
    );
  }
  if (state.status === CampaignStatus.INITIALIZED) {
    expect(state.vaultBalanceBaseUnits === 0n, "initialized vault must be empty");
  }
  if (state.status === CampaignStatus.CANCELLED) {
    expect(state.vaultBalanceBaseUnits === 0n, "cancelled vault must be empty");
  }
  if (state.status === CampaignStatus.EXHAUSTED) {
    expect(state.completedPairs === MAXIMUM_COMPLETED_PAIRS, "exhausted before hard cap");
    expect(state.vaultBalanceBaseUnits === 0n, "exhausted vault must be empty");
    expect(state.activeNominationByProposer.size === 0, "exhausted campaign has active proposer locks");
    expect(state.heroReservations.size === 0, "exhausted campaign has active hero reservations");
  }
  if (state.completedPairs === MAXIMUM_COMPLETED_PAIRS) {
    expect(state.status === CampaignStatus.EXHAUSTED, "hard cap must be terminal");
  }

  for (const role of Object.values(RewardRole)) {
    const markers = state.roleMarkers[role];
    expect(markers.nodes.size === state.completedPairs, `${role} node marker count mismatch`);
    expect(markers.wallets.size === state.completedPairs, `${role} wallet marker count mismatch`);
    expect(
      markers.xIdentityCommitments.size === state.completedPairs,
      `${role} X identity marker count mismatch`,
    );
  }

  const settledNominations = [...state.nominations.values()].filter(
    (nomination) => nomination.status === NominationStatus.SETTLED,
  ).length;
  expect(settledNominations === state.completedPairs, "settled nomination count mismatch");

  for (const [proposerNodeId, nominationId] of state.activeNominationByProposer) {
    const nomination = state.nominations.get(nominationId);
    expect(Boolean(nomination), `active proposer map references missing ${nominationId}`);
    expect(nomination?.status === NominationStatus.PENDING, `${nominationId} is not pending`);
    expect(nomination?.proposerNodeId === proposerNodeId, `${nominationId} proposer map mismatch`);
  }
  for (const [heroCommitment, nominationId] of state.heroReservations) {
    const nomination = state.nominations.get(nominationId);
    expect(Boolean(nomination), `hero reservation references missing ${nominationId}`);
    expect(nomination?.status === NominationStatus.PENDING, `${nominationId} reservation is not pending`);
    expect(
      nomination?.heroXIdentityCommitment === heroCommitment,
      `${nominationId} hero reservation mismatch`,
    );
  }

  return errors;
}

export function assertStateInvariants(state) {
  const errors = validateStateInvariants(state);
  if (errors.length) fail(`STATE_INVARIANT_FAILURE: ${errors.join("; ")}`);
  return true;
}

export function snapshotState(state) {
  return JSON.stringify(state, (_key, value) => {
    if (typeof value === "bigint") return `${value}n`;
    if (value instanceof Map) return { map: [...value.entries()] };
    if (value instanceof Set) return { set: [...value.values()] };
    return value;
  });
}

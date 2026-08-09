/**
 * Network-free event/account reconciliation for the Promotions DLC draft.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * Inputs are inert bytes and plain semantic snapshots. This module imports no
 * wallet, RPC, Solana, site, or production code and cannot authorize a state
 * transition. Accounts and receipts remain authoritative.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import { decodeProgramEvent, loadProgramEventInterface } from "./program-event-codec.mjs";

const POLICY_PATH = fileURLToPath(
  new URL("./event-reconciliation-policy.v1.json", import.meta.url),
);

const ZERO_HASH = "0".repeat(64);
const CAMPAIGN_STATUSES = new Set(["INITIALIZED", "FUNDED", "ACTIVE", "EXHAUSTED", "CANCELLED"]);
const REGISTRY_STATUSES = new Set(["ACTIVE", "EMERGENCY_DISABLED"]);
const CAMPAIGN_EVENT_NAMES = new Set([
  "CampaignInitialized",
  "CampaignFunded",
  "CampaignActivated",
  "CampaignCancelledPreActivation",
  "HeroNominated",
  "NominationCancelled",
  "PairSettled",
  "CampaignExhausted",
  "ExhaustedSurplusFinalized",
]);
const VERIFIER_EVENT_NAMES = new Set([
  "VerifierRegistryInitialized",
  "VerifierKeyRotationScheduled",
  "VerifierKeyRotationActivated",
  "VerifierKeyRetirementFinalized",
  "VerifierRegistryEmergencyDisabled",
]);

const CAMPAIGN_KEYS = [
  "address",
  "mint",
  "status",
  "promo_vault",
  "community_refund_token_account",
  "verifier_registry",
  "genesis_timestamp",
  "earliest_activation_timestamp",
  "maximum_budget_base_units",
  "maximum_completed_pairs",
  "completed_pairs",
  "hero_paid_base_units",
  "proposer_paid_base_units",
  "policy_hash",
  "identity_domain_hash",
];
const VAULT_KEYS = ["address", "balance_base_units"];
const RECEIPT_KEYS = [
  "address",
  "campaign",
  "nomination",
  "hero_wallet",
  "proposer_wallet",
  "hero_node_commitment",
  "proposer_node_commitment",
  "hero_x_identity_commitment",
  "proposer_x_identity_commitment",
  "settled_at",
  "sequence",
  "hero_reward_base_units",
  "proposer_reward_base_units",
];
const REGISTRY_KEYS = ["address", "campaign", "status", "last_event_hash"];
const RECORD_KEYS = ["ordinal", "transaction_message_hash", "log_index", "bytes_hex"];

function fail(code) {
  throw new Error(code);
}

function exactKeys(value, keys, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(`${code}_NOT_OBJECT`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail(`${code}_FIELDS_MISMATCH`);
  }
}

function decimal(value, code, maximum = null) {
  if (typeof value !== "string" || !/^[0-9]+$/.test(value)) fail(code);
  const parsed = BigInt(value);
  if (maximum !== null && parsed > maximum) fail(code);
  return parsed;
}

function hex32(value, code) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) fail(code);
  return value;
}

function requireEqual(actual, expected, code) {
  if (actual !== expected) fail(code);
}

export function loadEventReconciliationPolicy() {
  return JSON.parse(readFileSync(POLICY_PATH, "utf8"));
}

export function validateEventReconciliationPolicy(
  policy = loadEventReconciliationPolicy(),
  eventInterface = loadProgramEventInterface(),
) {
  const errors = [];
  const expect = (condition, message) => {
    if (!condition) errors.push(message);
  };
  const labels = ["DRAFT", "INACTIVE", "NOT PART OF GENESIS", "NOT DEPLOYED", "NO CLAIM ROUTE"];
  expect(policy?.reconciliationPolicyVersion === 1, "reconciliation policy version must equal one");
  expect(policy?.status?.network === "NONE", "reconciliation policy must remain network-free");
  expect(policy?.status?.programId === null, "reconciliation policy must not claim a program ID");
  expect(policy?.status?.deployable === false, "reconciliation policy must remain undeployable");
  expect(policy?.status?.reconciliationApplied === false, "reconciliation policy must remain unapplied");
  expect(
    JSON.stringify(policy?.status?.labels) === JSON.stringify(labels),
    "reconciliation policy HOLD labels drift",
  );
  expect(
    policy?.sourceEventInterface?.canonicalSha256 === canonicalSha256(eventInterface),
    "reconciliation event-interface digest mismatch",
  );
  const economics = policy?.economics ?? {};
  expect(economics.heroRewardBaseUnits === "120000000000", "hero reward drift");
  expect(economics.proposerRewardBaseUnits === "60000000000", "proposer reward drift");
  expect(economics.pairRewardBaseUnits === "180000000000", "pair reward drift");
  expect(economics.maximumCompletedPairs === "1000", "pair cap drift");
  expect(economics.maximumBudgetBaseUnits === "180000000000000", "budget cap drift");
  for (const [name, enabled] of Object.entries(policy?.requiredEvidence ?? {})) {
    expect(enabled === true, `required evidence disabled: ${name}`);
  }
  for (const [name, enabled] of Object.entries(policy?.invariants ?? {})) {
    expect(enabled === true, `reconciliation invariant disabled: ${name}`);
  }
  return errors;
}

export function decodeOrderedEventRecords(records, eventInterface = loadProgramEventInterface()) {
  if (!Array.isArray(records) || records.length === 0) fail("EVENT_RECORDS_REQUIRED");
  const seenCursors = new Set();
  const lastLogByTransaction = new Map();
  return records.map((record, index) => {
    exactKeys(record, RECORD_KEYS, "EVENT_RECORD");
    const ordinal = decimal(record.ordinal, "INVALID_EVENT_ORDINAL", BigInt(Number.MAX_SAFE_INTEGER));
    if (ordinal !== BigInt(index)) fail("EVENT_ORDINAL_GAP_OR_REORDER");
    const transactionMessageHash = hex32(
      record.transaction_message_hash,
      "INVALID_TRANSACTION_MESSAGE_HASH",
    );
    const logIndex = decimal(record.log_index, "INVALID_LOG_INDEX", 65535n);
    const cursor = `${transactionMessageHash}:${logIndex}`;
    if (seenCursors.has(cursor)) fail("DUPLICATE_EVENT_CURSOR");
    seenCursors.add(cursor);
    const lastLog = lastLogByTransaction.get(transactionMessageHash);
    if (lastLog !== undefined && logIndex <= lastLog) fail("TRANSACTION_LOG_ORDER_INVALID");
    lastLogByTransaction.set(transactionMessageHash, logIndex);
    if (typeof record.bytes_hex !== "string" || !/^(?:[0-9a-f]{2})+$/.test(record.bytes_hex)) {
      fail("INVALID_EVENT_BYTES_HEX");
    }
    const decoded = decodeProgramEvent(Buffer.from(record.bytes_hex, "hex"), eventInterface);
    if (decoded.data.version !== "1") fail("UNSUPPORTED_EVENT_VERSION");
    return {
      ordinal: record.ordinal,
      transactionMessageHash,
      logIndex: record.log_index,
      name: decoded.name,
      data: decoded.data,
    };
  });
}

function validateSnapshotShape(snapshot) {
  exactKeys(snapshot, ["campaign", "promotionVault", "settlementReceipts", "verifierRegistries"], "SNAPSHOT");
  exactKeys(snapshot.campaign, CAMPAIGN_KEYS, "CAMPAIGN_SNAPSHOT");
  exactKeys(snapshot.promotionVault, VAULT_KEYS, "VAULT_SNAPSHOT");
  if (!Array.isArray(snapshot.settlementReceipts)) fail("SETTLEMENT_RECEIPTS_NOT_ARRAY");
  if (!Array.isArray(snapshot.verifierRegistries)) fail("VERIFIER_REGISTRIES_NOT_ARRAY");
  snapshot.settlementReceipts.forEach((receipt) => exactKeys(receipt, RECEIPT_KEYS, "RECEIPT_SNAPSHOT"));
  snapshot.verifierRegistries.forEach((registry) => exactKeys(registry, REGISTRY_KEYS, "REGISTRY_SNAPSHOT"));
  if (!CAMPAIGN_STATUSES.has(snapshot.campaign.status)) fail("INVALID_CAMPAIGN_SNAPSHOT_STATUS");
  for (const registry of snapshot.verifierRegistries) {
    if (!REGISTRY_STATUSES.has(registry.status)) fail("INVALID_REGISTRY_SNAPSHOT_STATUS");
  }
}

function matchingReceipt(receipt, event) {
  const data = event.data;
  const mapping = {
    address: data.settlement_receipt,
    campaign: data.campaign,
    nomination: data.nomination,
    hero_wallet: data.hero_wallet,
    proposer_wallet: data.proposer_wallet,
    hero_node_commitment: data.hero_node_commitment,
    proposer_node_commitment: data.proposer_node_commitment,
    hero_x_identity_commitment: data.hero_x_identity_commitment,
    proposer_x_identity_commitment: data.proposer_x_identity_commitment,
    settled_at: data.settled_at,
    sequence: data.sequence,
    hero_reward_base_units: data.hero_reward_base_units,
    proposer_reward_base_units: data.proposer_reward_base_units,
  };
  return Object.entries(mapping).every(([key, value]) => receipt[key] === value);
}

function reconcileCampaign(events, snapshot, policy) {
  const campaign = snapshot.campaign;
  const vault = snapshot.promotionVault;
  hex32(campaign.address, "INVALID_CAMPAIGN_ADDRESS");
  hex32(campaign.mint, "INVALID_CAMPAIGN_MINT");
  hex32(campaign.promo_vault, "INVALID_PROMO_VAULT_ADDRESS");
  hex32(campaign.community_refund_token_account, "INVALID_COMMUNITY_REFUND_ADDRESS");
  hex32(campaign.verifier_registry, "INVALID_VERIFIER_REGISTRY_ADDRESS");
  requireEqual(vault.address, campaign.promo_vault, "PROMO_VAULT_BINDING_MISMATCH");

  const economics = policy.economics;
  const heroReward = BigInt(economics.heroRewardBaseUnits);
  const proposerReward = BigInt(economics.proposerRewardBaseUnits);
  const pairReward = BigInt(economics.pairRewardBaseUnits);
  const maximumPairs = BigInt(economics.maximumCompletedPairs);
  const maximumBudget = BigInt(economics.maximumBudgetBaseUnits);
  requireEqual(campaign.maximum_budget_base_units, economics.maximumBudgetBaseUnits, "CAMPAIGN_BUDGET_POLICY_MISMATCH");
  requireEqual(campaign.maximum_completed_pairs, economics.maximumCompletedPairs, "CAMPAIGN_PAIR_CAP_POLICY_MISMATCH");

  let phase = "UNSEEN";
  let funded = false;
  let activated = false;
  let completedPairs = 0n;
  let heroPaid = 0n;
  let proposerPaid = 0n;
  let lastVaultBalance = 0n;
  let unattributedSurplus = 0n;
  let exhaustion = null;
  let surplusFinalized = false;
  const nominations = new Map();
  const settlements = new Map();

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    if (!CAMPAIGN_EVENT_NAMES.has(event.name)) continue;
    const data = event.data;
    requireEqual(data.campaign, campaign.address, "EVENT_CAMPAIGN_MISMATCH");
    if (["CANCELLED", "EXHAUSTED"].includes(phase) && !(
      phase === "EXHAUSTED" && event.name === "ExhaustedSurplusFinalized" && !surplusFinalized
    )) {
      fail("CAMPAIGN_EVENT_AFTER_TERMINAL_STATE");
    }

    if (event.name === "CampaignInitialized") {
      if (phase !== "UNSEEN") fail("CAMPAIGN_INITIALIZED_MORE_THAN_ONCE_OR_OUT_OF_ORDER");
      requireEqual(data.mint, campaign.mint, "INITIALIZED_MINT_MISMATCH");
      requireEqual(data.genesis_timestamp, campaign.genesis_timestamp, "GENESIS_TIMESTAMP_MISMATCH");
      requireEqual(
        data.earliest_activation_timestamp,
        campaign.earliest_activation_timestamp,
        "EARLIEST_ACTIVATION_MISMATCH",
      );
      requireEqual(data.maximum_budget_base_units, campaign.maximum_budget_base_units, "INITIALIZED_BUDGET_MISMATCH");
      requireEqual(data.maximum_completed_pairs, campaign.maximum_completed_pairs, "INITIALIZED_PAIR_CAP_MISMATCH");
      requireEqual(data.policy_hash, campaign.policy_hash, "INITIALIZED_POLICY_HASH_MISMATCH");
      requireEqual(data.identity_domain_hash, campaign.identity_domain_hash, "INITIALIZED_IDENTITY_DOMAIN_MISMATCH");
      phase = "INITIALIZED";
    } else if (event.name === "CampaignFunded") {
      if (phase !== "INITIALIZED" || funded) fail("CAMPAIGN_FUNDING_OUT_OF_ORDER");
      requireEqual(data.amount_base_units, economics.maximumBudgetBaseUnits, "FUNDED_AMOUNT_MISMATCH");
      requireEqual(data.vault_balance_base_units, data.amount_base_units, "FUNDED_VAULT_MISMATCH");
      lastVaultBalance = maximumBudget;
      funded = true;
      phase = "FUNDED";
    } else if (event.name === "CampaignActivated") {
      if (phase !== "FUNDED" || activated) fail("CAMPAIGN_ACTIVATION_OUT_OF_ORDER");
      requireEqual(data.policy_hash, campaign.policy_hash, "ACTIVATED_POLICY_HASH_MISMATCH");
      activated = true;
      phase = "ACTIVE";
    } else if (event.name === "CampaignCancelledPreActivation") {
      if (!["INITIALIZED", "FUNDED"].includes(phase)) fail("CAMPAIGN_CANCELLATION_OUT_OF_ORDER");
      requireEqual(data.refund_destination, campaign.community_refund_token_account, "CANCELLATION_REFUND_REDIRECTED");
      requireEqual(data.refunded_base_units, String(lastVaultBalance), "CANCELLATION_REFUND_AMOUNT_MISMATCH");
      lastVaultBalance = 0n;
      phase = "CANCELLED";
    } else if (event.name === "HeroNominated") {
      if (phase !== "ACTIVE") fail("NOMINATION_EVENT_WHILE_CAMPAIGN_NOT_ACTIVE");
      if (nominations.has(data.nomination)) fail("DUPLICATE_NOMINATION_EVENT");
      nominations.set(data.nomination, { status: "PENDING", ...data });
    } else if (event.name === "NominationCancelled") {
      if (phase !== "ACTIVE") fail("NOMINATION_CANCELLATION_WHILE_CAMPAIGN_NOT_ACTIVE");
      const nomination = nominations.get(data.nomination);
      if (!nomination || nomination.status !== "PENDING") fail("CANCELLED_NOMINATION_NOT_PENDING");
      requireEqual(data.proposer_wallet, nomination.proposer_wallet, "CANCELLED_NOMINATION_PROPOSER_MISMATCH");
      nomination.status = "CANCELLED";
    } else if (event.name === "PairSettled") {
      if (phase !== "ACTIVE") fail("SETTLEMENT_EVENT_WHILE_CAMPAIGN_NOT_ACTIVE");
      const nomination = nominations.get(data.nomination);
      if (!nomination || nomination.status !== "PENDING") fail("SETTLED_NOMINATION_NOT_PENDING");
      requireEqual(data.proposer_wallet, nomination.proposer_wallet, "SETTLEMENT_PROPOSER_WALLET_MISMATCH");
      requireEqual(data.proposer_node_commitment, nomination.proposer_node_commitment, "SETTLEMENT_PROPOSER_NODE_MISMATCH");
      requireEqual(data.proposer_x_identity_commitment, nomination.proposer_x_identity_commitment, "SETTLEMENT_PROPOSER_X_MISMATCH");
      requireEqual(data.hero_x_identity_commitment, nomination.hero_x_identity_commitment, "SETTLEMENT_HERO_X_MISMATCH");
      requireEqual(data.hero_reward_base_units, economics.heroRewardBaseUnits, "HERO_REWARD_MISMATCH");
      requireEqual(data.proposer_reward_base_units, economics.proposerRewardBaseUnits, "PROPOSER_REWARD_MISMATCH");
      if (settlements.has(data.settlement_receipt)) fail("DUPLICATE_SETTLEMENT_RECEIPT_EVENT");
      completedPairs += 1n;
      if (completedPairs > maximumPairs) fail("COMPLETED_PAIR_CAP_EXCEEDED");
      requireEqual(data.completed_pairs, String(completedPairs), "SETTLEMENT_COUNTER_GAP_OR_REORDER");
      heroPaid += heroReward;
      proposerPaid += proposerReward;
      const reportedVault = decimal(data.vault_balance_base_units, "INVALID_SETTLEMENT_VAULT_BALANCE");
      const accountingFloor = maximumBudget - completedPairs * pairReward;
      if (reportedVault < accountingFloor) fail("PROMOTION_VAULT_DEFICIT");
      const nextSurplus = reportedVault - accountingFloor;
      if (nextSurplus < unattributedSurplus) fail("UNEXPLAINED_PROMOTION_VAULT_OUTFLOW");
      unattributedSurplus = nextSurplus;
      lastVaultBalance = reportedVault;
      nomination.status = "SETTLED";
      settlements.set(data.settlement_receipt, event);
    } else if (event.name === "CampaignExhausted") {
      if (phase !== "ACTIVE" || exhaustion) fail("CAMPAIGN_EXHAUSTION_OUT_OF_ORDER");
      requireEqual(data.completed_pairs, economics.maximumCompletedPairs, "EXHAUSTION_PAIR_COUNT_MISMATCH");
      requireEqual(data.completed_pairs, String(completedPairs), "EXHAUSTION_COUNTER_EVENT_MISMATCH");
      requireEqual(data.total_paid_base_units, economics.maximumBudgetBaseUnits, "EXHAUSTION_TOTAL_PAID_MISMATCH");
      requireEqual(data.vault_balance_base_units, String(lastVaultBalance), "EXHAUSTION_VAULT_MISMATCH");
      const previous = events[index - 1];
      if (!previous || previous.name !== "PairSettled") fail("EXHAUSTION_NOT_AFTER_FINAL_SETTLEMENT");
      requireEqual(
        data.triggering_settlement_receipt,
        previous.data.settlement_receipt,
        "EXHAUSTION_TRIGGER_RECEIPT_MISMATCH",
      );
      requireEqual(
        event.transactionMessageHash,
        previous.transactionMessageHash,
        "EXHAUSTION_NOT_IN_FINAL_SETTLEMENT_TRANSACTION",
      );
      exhaustion = event;
      phase = "EXHAUSTED";
    } else if (event.name === "ExhaustedSurplusFinalized") {
      requireEqual(data.refund_destination, campaign.community_refund_token_account, "SURPLUS_REFUND_REDIRECTED");
      requireEqual(data.returned_base_units, String(lastVaultBalance), "SURPLUS_RETURN_AMOUNT_MISMATCH");
      lastVaultBalance = 0n;
      surplusFinalized = true;
    }
  }

  if (phase === "UNSEEN") fail("CAMPAIGN_INITIALIZATION_EVENT_MISSING");
  if (completedPairs === maximumPairs && !exhaustion) fail("FINAL_EXHAUSTION_EVENT_MISSING");
  requireEqual(campaign.status, phase, "CAMPAIGN_TERMINAL_STATUS_MISMATCH");
  requireEqual(campaign.completed_pairs, String(completedPairs), "CAMPAIGN_COMPLETED_PAIRS_MISMATCH");
  requireEqual(campaign.hero_paid_base_units, String(heroPaid), "CAMPAIGN_HERO_PAID_MISMATCH");
  requireEqual(campaign.proposer_paid_base_units, String(proposerPaid), "CAMPAIGN_PROPOSER_PAID_MISMATCH");
  requireEqual(vault.balance_base_units, String(lastVaultBalance), "PROMOTION_VAULT_SNAPSHOT_MISMATCH");

  const receiptSnapshots = new Map();
  for (const receipt of snapshot.settlementReceipts) {
    if (receiptSnapshots.has(receipt.address)) fail("DUPLICATE_RECEIPT_SNAPSHOT");
    receiptSnapshots.set(receipt.address, receipt);
  }
  requireEqual(String(receiptSnapshots.size), String(settlements.size), "SETTLEMENT_RECEIPT_SET_SIZE_MISMATCH");
  for (const [address, event] of settlements) {
    const receipt = receiptSnapshots.get(address);
    if (!receipt) fail("SETTLEMENT_RECEIPT_SNAPSHOT_MISSING");
    if (!matchingReceipt(receipt, event)) fail("SETTLEMENT_RECEIPT_SNAPSHOT_DRIFT");
  }

  return {
    status: phase,
    completedPairs: String(completedPairs),
    heroPaidBaseUnits: String(heroPaid),
    proposerPaidBaseUnits: String(proposerPaid),
    vaultBalanceBaseUnits: String(lastVaultBalance),
    unattributedSurplusBaseUnits: String(unattributedSurplus),
    settlementReceiptCount: String(settlements.size),
    pendingNominationCountAtEnd: String(
      [...nominations.values()].filter((nomination) => nomination.status === "PENDING").length,
    ),
    terminalPendingNominationsAreIneligible: phase === "EXHAUSTED",
    surplusFinalized,
  };
}

function reconcileVerifierRegistries(events, snapshot, campaign) {
  const derived = new Map();
  for (const event of events) {
    if (!VERIFIER_EVENT_NAMES.has(event.name)) continue;
    const data = event.data;
    requireEqual(data.verifier_registry, campaign.verifier_registry, "EVENT_VERIFIER_REGISTRY_MISMATCH");
    let registry = derived.get(data.verifier_registry);
    if (event.name === "VerifierRegistryInitialized") {
      if (registry) fail("VERIFIER_REGISTRY_INITIALIZED_MORE_THAN_ONCE");
      requireEqual(data.campaign, campaign.address, "VERIFIER_REGISTRY_CAMPAIGN_MISMATCH");
      requireEqual(data.identity_domain_hash, campaign.identity_domain_hash, "VERIFIER_IDENTITY_DOMAIN_MISMATCH");
      requireEqual(data.previous_event_hash, ZERO_HASH, "VERIFIER_CHAIN_MUST_START_AT_ZERO_HASH");
      if (data.event_hash === ZERO_HASH) fail("VERIFIER_EVENT_HASH_MUST_ADVANCE");
      registry = { status: "ACTIVE", head: data.event_hash, eventCount: 1n };
      derived.set(data.verifier_registry, registry);
      continue;
    }
    if (!registry) fail("VERIFIER_EVENT_BEFORE_REGISTRY_INITIALIZATION");
    if (registry.status === "EMERGENCY_DISABLED") fail("VERIFIER_EVENT_AFTER_EMERGENCY_DISABLE");
    requireEqual(data.previous_event_hash, registry.head, "VERIFIER_PREVIOUS_HASH_MISMATCH");
    if (data.event_hash === registry.head || data.event_hash === ZERO_HASH) {
      fail("VERIFIER_EVENT_HASH_MUST_ADVANCE");
    }
    registry.head = data.event_hash;
    registry.eventCount += 1n;
    if (event.name === "VerifierRegistryEmergencyDisabled") {
      registry.status = "EMERGENCY_DISABLED";
    }
  }

  const snapshots = new Map();
  for (const registry of snapshot.verifierRegistries) {
    if (snapshots.has(registry.address)) fail("DUPLICATE_VERIFIER_REGISTRY_SNAPSHOT");
    snapshots.set(registry.address, registry);
  }
  requireEqual(String(snapshots.size), String(derived.size), "VERIFIER_REGISTRY_SET_SIZE_MISMATCH");
  for (const [address, state] of derived) {
    const registry = snapshots.get(address);
    if (!registry) fail("VERIFIER_REGISTRY_SNAPSHOT_MISSING");
    requireEqual(registry.campaign, campaign.address, "REGISTRY_SNAPSHOT_CAMPAIGN_MISMATCH");
    requireEqual(registry.status, state.status, "REGISTRY_SNAPSHOT_STATUS_MISMATCH");
    requireEqual(registry.last_event_hash, state.head, "REGISTRY_SNAPSHOT_HEAD_MISMATCH");
  }
  if (campaign.verifier_registry === ZERO_HASH) {
    if (derived.size !== 0) fail("UNBOUND_VERIFIER_REGISTRY_EVENTS");
  } else if (derived.size !== 1 || !derived.has(campaign.verifier_registry)) {
    fail("BOUND_VERIFIER_REGISTRY_EVIDENCE_MISSING");
  }
  if (["FUNDED", "ACTIVE", "EXHAUSTED"].includes(campaign.status) && campaign.verifier_registry === ZERO_HASH) {
    fail("FUNDED_OR_LIVE_CAMPAIGN_REQUIRES_VERIFIER_REGISTRY");
  }
  return [...derived.entries()].map(([address, state]) => ({
    address,
    status: state.status,
    lastEventHash: state.head,
    eventCount: String(state.eventCount),
  }));
}

export function reconcileEventEvidence(
  evidence,
  {
    policy = loadEventReconciliationPolicy(),
    eventInterface = loadProgramEventInterface(),
  } = {},
) {
  const policyErrors = validateEventReconciliationPolicy(policy, eventInterface);
  if (policyErrors.length) fail(`RECONCILIATION_POLICY_INVALID:${policyErrors.join("|")}`);
  exactKeys(evidence, ["records", "snapshot"], "RECONCILIATION_EVIDENCE");
  validateSnapshotShape(evidence.snapshot);
  const events = decodeOrderedEventRecords(evidence.records, eventInterface);
  const campaignInitializationIndex = events.findIndex(
    (event) => event.name === "CampaignInitialized",
  );
  const campaignLeavesInitializedIndex = events.findIndex(
    (event, index) =>
      index > campaignInitializationIndex &&
      ["CampaignFunded", "CampaignCancelledPreActivation"].includes(event.name),
  );
  for (const [index, event] of events.entries()) {
    if (
      event.name === "VerifierRegistryInitialized" &&
      (
        campaignInitializationIndex < 0 ||
        index < campaignInitializationIndex ||
        (campaignLeavesInitializedIndex >= 0 && index > campaignLeavesInitializedIndex)
      )
    ) {
      fail("VERIFIER_REGISTRY_OUTSIDE_INITIALIZED_CAMPAIGN_WINDOW");
    }
  }
  const campaign = reconcileCampaign(events, evidence.snapshot, policy);
  const verifierRegistries = reconcileVerifierRegistries(
    events,
    evidence.snapshot,
    evidence.snapshot.campaign,
  );
  return {
    status: { ...policy.status },
    eventCount: String(events.length),
    campaign,
    verifierRegistries,
    accountsAndReceiptsRemainAuthoritative: true,
    eventStreamAuthorizedNoStateChange: true,
  };
}

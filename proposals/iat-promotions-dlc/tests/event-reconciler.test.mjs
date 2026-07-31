/**
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  decodeOrderedEventRecords,
  loadEventReconciliationPolicy,
  reconcileEventEvidence,
  validateEventReconciliationPolicy,
} from "../event-reconciler.mjs";
import { encodeProgramEvent, loadProgramEventInterface } from "../program-event-codec.mjs";

const eventInterface = loadProgramEventInterface();
const policy = loadEventReconciliationPolicy();
const MAXIMUM_BUDGET = 180_000_000_000_000n;
const PAIR_REWARD = 180_000_000_000n;
const HERO_REWARD = "120000000000";
const PROPOSER_REWARD = "60000000000";
const ZERO_HASH = "0".repeat(64);

const hash = (label) => createHash("sha256").update(label).digest("hex");

const FIXTURE = Object.freeze({
  campaign: hash("campaign"),
  mint: hash("mint"),
  vault: hash("promotion-vault"),
  refund: hash("community-refund"),
  registry: hash("verifier-registry"),
  policy: hash("policy"),
  identityDomain: hash("identity-domain"),
  review: hash("review"),
  artifact: hash("artifact"),
});

function initializedEvent() {
  return {
    name: "CampaignInitialized",
    data: {
      version: "1",
      campaign: FIXTURE.campaign,
      mint: FIXTURE.mint,
      genesis_timestamp: "1800000000",
      earliest_activation_timestamp: "1800028800",
      maximum_budget_base_units: String(MAXIMUM_BUDGET),
      maximum_completed_pairs: "1000",
      policy_hash: FIXTURE.policy,
      identity_domain_hash: FIXTURE.identityDomain,
    },
    tx: "initialize-campaign",
  };
}

function registryInitializedEvent() {
  return {
    name: "VerifierRegistryInitialized",
    data: {
      version: "1",
      verifier_registry: FIXTURE.registry,
      campaign: FIXTURE.campaign,
      initial_key_record: hash("initial-key-record"),
      key_id: hash("initial-key-id"),
      public_key: hash("initial-public-key"),
      identity_domain_hash: FIXTURE.identityDomain,
      occurred_at: "1800000001",
      previous_event_hash: ZERO_HASH,
      event_hash: hash("registry-event-0"),
    },
    tx: "initialize-registry",
  };
}

function fundedEvent() {
  return {
    name: "CampaignFunded",
    data: {
      version: "1",
      campaign: FIXTURE.campaign,
      amount_base_units: String(MAXIMUM_BUDGET),
      vault_balance_base_units: String(MAXIMUM_BUDGET),
    },
    tx: "fund-campaign",
  };
}

function activatedEvent() {
  return {
    name: "CampaignActivated",
    data: {
      version: "1",
      campaign: FIXTURE.campaign,
      activated_at: "1800028800",
      review_hash: FIXTURE.review,
      artifact_hash: FIXTURE.artifact,
      policy_hash: FIXTURE.policy,
    },
    tx: "activate-campaign",
  };
}

function nominationEvent(index) {
  return {
    name: "HeroNominated",
    data: {
      version: "1",
      campaign: FIXTURE.campaign,
      nomination: hash(`nomination-${index}`),
      proposer_wallet: hash(`proposer-wallet-${index}`),
      proposer_node_commitment: hash(`proposer-node-${index}`),
      proposer_x_identity_commitment: hash(`proposer-x-${index}`),
      hero_x_identity_commitment: hash(`hero-x-${index}`),
      attestation_id: hash(`nomination-attestation-${index}`),
      nonce_hash: hash(`nomination-nonce-${index}`),
      occurred_at: String(1_800_028_900 + index * 2),
    },
    tx: `nominate-${index}`,
  };
}

function settlementEvent(index, surplus = 0n) {
  const completedPairs = BigInt(index + 1);
  return {
    name: "PairSettled",
    data: {
      version: "1",
      campaign: FIXTURE.campaign,
      nomination: hash(`nomination-${index}`),
      settlement_receipt: hash(`settlement-receipt-${index}`),
      hero_wallet: hash(`hero-wallet-${index}`),
      proposer_wallet: hash(`proposer-wallet-${index}`),
      hero_node_commitment: hash(`hero-node-${index}`),
      proposer_node_commitment: hash(`proposer-node-${index}`),
      hero_x_identity_commitment: hash(`hero-x-${index}`),
      proposer_x_identity_commitment: hash(`proposer-x-${index}`),
      hero_reward_base_units: HERO_REWARD,
      proposer_reward_base_units: PROPOSER_REWARD,
      sequence: String(index),
      completed_pairs: String(completedPairs),
      vault_balance_base_units: String(MAXIMUM_BUDGET - completedPairs * PAIR_REWARD + surplus),
      settled_at: String(1_800_028_901 + index * 2),
    },
    tx: `settle-${index}`,
  };
}

function receiptFromSettlement(event) {
  const data = event.data;
  return {
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
}

function toRecords(events) {
  const nextLogByTransaction = new Map();
  return events.map((event, index) => {
    const transactionMessageHash = hash(`transaction:${event.tx}`);
    const logIndex = nextLogByTransaction.get(transactionMessageHash) ?? 0;
    nextLogByTransaction.set(transactionMessageHash, logIndex + 1);
    return {
      ordinal: String(index),
      transaction_message_hash: transactionMessageHash,
      log_index: String(logIndex),
      bytes_hex: encodeProgramEvent(event.name, event.data, eventInterface).toString("hex"),
    };
  });
}

function buildEvidence({
  completedPairs = 2,
  exhausted = false,
  omitExhaustion = false,
  exhaustionSeparateTransaction = false,
  surplus = 0n,
  finalizeSurplus = false,
  extraPending = false,
} = {}) {
  const events = [initializedEvent(), registryInitializedEvent(), fundedEvent(), activatedEvent()];
  const receipts = [];
  if (extraPending) events.push(nominationEvent(completedPairs + 1));
  for (let index = 0; index < completedPairs; index += 1) {
    const nomination = nominationEvent(index);
    const settlement = settlementEvent(index, surplus);
    events.push(nomination, settlement);
    receipts.push(receiptFromSettlement(settlement));
  }
  if (exhausted && !omitExhaustion) {
    const finalSettlement = events.findLast((event) => event.name === "PairSettled");
    events.push({
      name: "CampaignExhausted",
      data: {
        version: "1",
        campaign: FIXTURE.campaign,
        triggering_settlement_receipt: finalSettlement.data.settlement_receipt,
        completed_pairs: "1000",
        total_paid_base_units: String(MAXIMUM_BUDGET),
        vault_balance_base_units: String(surplus),
        occurred_at: "1800031000",
      },
      tx: exhaustionSeparateTransaction ? "exhaust-separate" : finalSettlement.tx,
    });
    if (finalizeSurplus) {
      events.push({
        name: "ExhaustedSurplusFinalized",
        data: {
          version: "1",
          campaign: FIXTURE.campaign,
          refund_destination: FIXTURE.refund,
          returned_base_units: String(surplus),
          occurred_at: "1800031001",
        },
        tx: "finalize-surplus",
      });
    }
  }
  const paidHero = BigInt(completedPairs) * BigInt(HERO_REWARD);
  const paidProposer = BigInt(completedPairs) * BigInt(PROPOSER_REWARD);
  const finalVault = exhausted && finalizeSurplus
    ? 0n
    : MAXIMUM_BUDGET - BigInt(completedPairs) * PAIR_REWARD + surplus;
  return {
    records: toRecords(events),
    snapshot: {
      campaign: {
        address: FIXTURE.campaign,
        mint: FIXTURE.mint,
        status: exhausted ? "EXHAUSTED" : "ACTIVE",
        promo_vault: FIXTURE.vault,
        community_refund_token_account: FIXTURE.refund,
        verifier_registry: FIXTURE.registry,
        genesis_timestamp: "1800000000",
        earliest_activation_timestamp: "1800028800",
        maximum_budget_base_units: String(MAXIMUM_BUDGET),
        maximum_completed_pairs: "1000",
        completed_pairs: String(completedPairs),
        hero_paid_base_units: String(paidHero),
        proposer_paid_base_units: String(paidProposer),
        policy_hash: FIXTURE.policy,
        identity_domain_hash: FIXTURE.identityDomain,
      },
      promotionVault: {
        address: FIXTURE.vault,
        balance_base_units: String(finalVault),
      },
      settlementReceipts: receipts,
      verifierRegistries: [{
        address: FIXTURE.registry,
        campaign: FIXTURE.campaign,
        status: "ACTIVE",
        last_event_hash: hash("registry-event-0"),
      }],
    },
  };
}

function clone(value) {
  return structuredClone(value);
}

test("the held reconciliation policy is network-free and source-bound", () => {
  assert.deepEqual(validateEventReconciliationPolicy(policy, eventInterface), []);
  assert.equal(policy.status.network, "NONE");
  assert.equal(policy.status.programId, null);
  assert.equal(policy.status.deployable, false);
  assert.equal(policy.status.reconciliationApplied, false);
});

test("ordered encoded events reconcile exactly with campaign, vault, receipts, and registry head", () => {
  const result = reconcileEventEvidence(buildEvidence());
  assert.equal(result.campaign.status, "ACTIVE");
  assert.equal(result.campaign.completedPairs, "2");
  assert.equal(result.campaign.settlementReceiptCount, "2");
  assert.equal(result.campaign.unattributedSurplusBaseUnits, "0");
  assert.equal(result.verifierRegistries[0].lastEventHash, hash("registry-event-0"));
  assert.equal(result.accountsAndReceiptsRemainAuthoritative, true);
  assert.equal(result.eventStreamAuthorizedNoStateChange, true);
});

test("a complete 1,000-pair stream reaches one permanent terminal state", () => {
  const evidence = buildEvidence({ completedPairs: 1000, exhausted: true, extraPending: true });
  const result = reconcileEventEvidence(evidence);
  assert.equal(result.campaign.status, "EXHAUSTED");
  assert.equal(result.campaign.completedPairs, "1000");
  assert.equal(result.campaign.heroPaidBaseUnits, "120000000000000");
  assert.equal(result.campaign.proposerPaidBaseUnits, "60000000000000");
  assert.equal(result.campaign.vaultBalanceBaseUnits, "0");
  assert.equal(result.campaign.pendingNominationCountAtEnd, "1");
  assert.equal(result.campaign.terminalPendingNominationsAreIneligible, true);
});

test("receipt set, receipt body, campaign counters, and vault snapshot cannot drift", () => {
  const missingReceipt = buildEvidence();
  missingReceipt.snapshot.settlementReceipts.pop();
  assert.throws(() => reconcileEventEvidence(missingReceipt), /SETTLEMENT_RECEIPT_SET_SIZE_MISMATCH/);

  const changedReceipt = buildEvidence();
  changedReceipt.snapshot.settlementReceipts[0].hero_wallet = hash("redirected-hero-wallet");
  assert.throws(() => reconcileEventEvidence(changedReceipt), /SETTLEMENT_RECEIPT_SNAPSHOT_DRIFT/);

  const changedCounter = buildEvidence();
  changedCounter.snapshot.campaign.completed_pairs = "1";
  assert.throws(() => reconcileEventEvidence(changedCounter), /CAMPAIGN_COMPLETED_PAIRS_MISMATCH/);

  const changedVault = buildEvidence();
  changedVault.snapshot.promotionVault.balance_base_units = "1";
  assert.throws(() => reconcileEventEvidence(changedVault), /PROMOTION_VAULT_SNAPSHOT_MISMATCH/);
});

test("pair 1,000 requires one same-transaction exhaustion event and no resumed work", () => {
  const missing = buildEvidence({ completedPairs: 1000, exhausted: true, omitExhaustion: true });
  assert.throws(() => reconcileEventEvidence(missing), /FINAL_EXHAUSTION_EVENT_MISSING/);

  const separate = buildEvidence({
    completedPairs: 1000,
    exhausted: true,
    exhaustionSeparateTransaction: true,
  });
  assert.throws(
    () => reconcileEventEvidence(separate),
    /EXHAUSTION_NOT_IN_FINAL_SETTLEMENT_TRANSACTION/,
  );

  const resumed = buildEvidence({ completedPairs: 1000, exhausted: true });
  const extra = nominationEvent(1001);
  resumed.records.push(...toRecords([extra]).map((record) => ({
    ...record,
    ordinal: String(resumed.records.length),
  })));
  assert.throws(() => reconcileEventEvidence(resumed), /CAMPAIGN_EVENT_AFTER_TERMINAL_STATE/);
});

test("unattributed deposits remain surplus, cannot cover a deficit, and return only after exhaustion", () => {
  const surplus = buildEvidence({
    completedPairs: 1000,
    exhausted: true,
    surplus: 500n,
    finalizeSurplus: true,
  });
  const result = reconcileEventEvidence(surplus);
  assert.equal(result.campaign.unattributedSurplusBaseUnits, "500");
  assert.equal(result.campaign.vaultBalanceBaseUnits, "0");
  assert.equal(result.campaign.surplusFinalized, true);

  const deficit = buildEvidence();
  const decoded = decodeOrderedEventRecords(deficit.records, eventInterface);
  const settlementIndex = decoded.findIndex((event) => event.name === "PairSettled");
  const settlement = decoded[settlementIndex];
  settlement.data.vault_balance_base_units = String(MAXIMUM_BUDGET - PAIR_REWARD - 1n);
  deficit.records[settlementIndex].bytes_hex = encodeProgramEvent(
    settlement.name,
    settlement.data,
    eventInterface,
  ).toString("hex");
  assert.throws(() => reconcileEventEvidence(deficit), /PROMOTION_VAULT_DEFICIT/);
});

test("verifier hash-chain forks, snapshot-head drift, and post-disable events are rejected", () => {
  const forked = buildEvidence();
  const registryIndex = decodeOrderedEventRecords(forked.records, eventInterface)
    .findIndex((event) => event.name === "VerifierRegistryInitialized");
  const registryEvent = decodeOrderedEventRecords(forked.records, eventInterface)[registryIndex];
  registryEvent.data.previous_event_hash = hash("not-zero");
  forked.records[registryIndex].bytes_hex = encodeProgramEvent(
    registryEvent.name,
    registryEvent.data,
    eventInterface,
  ).toString("hex");
  assert.throws(() => reconcileEventEvidence(forked), /VERIFIER_CHAIN_MUST_START_AT_ZERO_HASH/);

  const headDrift = buildEvidence();
  headDrift.snapshot.verifierRegistries[0].last_event_hash = hash("wrong-head");
  assert.throws(() => reconcileEventEvidence(headDrift), /REGISTRY_SNAPSHOT_HEAD_MISMATCH/);

  const disabled = buildEvidence();
  const previousHead = hash("registry-event-0");
  const disable = {
    name: "VerifierRegistryEmergencyDisabled",
    data: {
      version: "1",
      verifier_registry: FIXTURE.registry,
      reason: "1",
      review_id: hash("disable-review"),
      review_hash: hash("disable-review-evidence"),
      cancelled_rotation_id: ZERO_HASH,
      occurred_at: "1800029900",
      previous_event_hash: previousHead,
      event_hash: hash("registry-disabled"),
    },
    tx: "disable-registry",
  };
  const retirement = {
    name: "VerifierKeyRetirementFinalized",
    data: {
      version: "1",
      verifier_registry: FIXTURE.registry,
      key_id: hash("initial-key-id"),
      occurred_at: "1800029901",
      previous_event_hash: hash("registry-disabled"),
      event_hash: hash("event-after-disable"),
    },
    tx: "retire-after-disable",
  };
  const appended = toRecords([disable, retirement]);
  for (const record of appended) {
    record.ordinal = String(disabled.records.length);
    disabled.records.push(record);
  }
  disabled.snapshot.verifierRegistries[0].status = "EMERGENCY_DISABLED";
  disabled.snapshot.verifierRegistries[0].last_event_hash = hash("event-after-disable");
  assert.throws(() => reconcileEventEvidence(disabled), /VERIFIER_EVENT_AFTER_EMERGENCY_DISABLE/);
});

test("record truncation, duplicate cursors, and ordinal reordering fail before reconciliation", () => {
  const truncated = buildEvidence();
  truncated.records[0].bytes_hex = truncated.records[0].bytes_hex.slice(0, -2);
  assert.throws(() => reconcileEventEvidence(truncated), /TRUNCATED_EVENT_DATA/);

  const duplicate = buildEvidence();
  duplicate.records[1].transaction_message_hash = duplicate.records[0].transaction_message_hash;
  duplicate.records[1].log_index = duplicate.records[0].log_index;
  assert.throws(() => reconcileEventEvidence(duplicate), /DUPLICATE_EVENT_CURSOR/);

  const reordered = buildEvidence();
  reordered.records[1].ordinal = "9";
  assert.throws(() => reconcileEventEvidence(reordered), /EVENT_ORDINAL_GAP_OR_REORDER/);
});

test("pre-activation cancellation reconciles only the immutable refund and zero vault", () => {
  const events = [initializedEvent(), fundedEvent(), {
    name: "CampaignCancelledPreActivation",
    data: {
      version: "1",
      campaign: FIXTURE.campaign,
      refund_destination: FIXTURE.refund,
      refunded_base_units: String(MAXIMUM_BUDGET),
      occurred_at: "1800000100",
    },
    tx: "cancel-campaign",
  }];
  const evidence = buildEvidence();
  evidence.records = toRecords(events);
  evidence.snapshot.campaign.status = "CANCELLED";
  evidence.snapshot.campaign.completed_pairs = "0";
  evidence.snapshot.campaign.hero_paid_base_units = "0";
  evidence.snapshot.campaign.proposer_paid_base_units = "0";
  evidence.snapshot.campaign.verifier_registry = ZERO_HASH;
  evidence.snapshot.promotionVault.balance_base_units = "0";
  evidence.snapshot.settlementReceipts = [];
  evidence.snapshot.verifierRegistries = [];
  const result = reconcileEventEvidence(evidence);
  assert.equal(result.campaign.status, "CANCELLED");
  assert.equal(result.campaign.vaultBalanceBaseUnits, "0");

  const redirected = clone(evidence);
  const decoded = decodeOrderedEventRecords(redirected.records, eventInterface);
  decoded.at(-1).data.refund_destination = hash("attacker-refund");
  redirected.records.at(-1).bytes_hex = encodeProgramEvent(
    decoded.at(-1).name,
    decoded.at(-1).data,
    eventInterface,
  ).toString("hex");
  assert.throws(() => reconcileEventEvidence(redirected), /CANCELLATION_REFUND_REDIRECTED/);
});

test("deployment claims, source drift, disabled evidence, and disabled invariants fail closed", () => {
  const network = clone(policy);
  network.status.network = "mainnet-beta";
  network.status.programId = hash("fake-program-id");
  network.status.deployable = true;
  network.status.reconciliationApplied = true;
  network.sourceEventInterface.canonicalSha256 = ZERO_HASH;
  network.requiredEvidence.walletOrRpcAccessForbidden = false;
  network.invariants.eventsRemainNonAuthoritative = false;
  const errors = validateEventReconciliationPolicy(network, eventInterface);
  assert.ok(errors.includes("reconciliation policy must remain network-free"));
  assert.ok(errors.includes("reconciliation policy must not claim a program ID"));
  assert.ok(errors.includes("reconciliation policy must remain undeployable"));
  assert.ok(errors.includes("reconciliation policy must remain unapplied"));
  assert.ok(errors.includes("reconciliation event-interface digest mismatch"));
  assert.ok(errors.includes("required evidence disabled: walletOrRpcAccessForbidden"));
  assert.ok(errors.includes("reconciliation invariant disabled: eventsRemainNonAuthoritative"));
  assert.throws(
    () => reconcileEventEvidence(buildEvidence(), { policy: network, eventInterface }),
    /RECONCILIATION_POLICY_INVALID/,
  );
});

/**
 * Deterministic compact reconciliation evidence for the Promotions DLC draft.
 * DRAFT / INACTIVE / NOT PART OF GENESIS / NOT DEPLOYED / NO CLAIM ROUTE
 *
 * This generator creates no key, signature, transaction, wallet request, RPC
 * call, or chain state. All fixture identifiers are public SHA-256 labels.
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { canonicalJson } from "./attestation-transparency.mjs";
import { canonicalSha256 } from "./compose-program-interface-preview.mjs";
import {
  loadEventReconciliationPolicy,
  reconcileEventEvidence,
} from "./event-reconciler.mjs";
import { encodeProgramEvent, loadProgramEventInterface } from "./program-event-codec.mjs";

const GENERATOR_PATH = fileURLToPath(import.meta.url);
const RECONCILER_PATH = fileURLToPath(new URL("./event-reconciler.mjs", import.meta.url));
const OUTPUT_PATH = fileURLToPath(
  new URL("./event-reconciliation-vectors.v1.json", import.meta.url),
);

const MAXIMUM_BUDGET = 180_000_000_000_000n;
const PAIR_REWARD = 180_000_000_000n;
const HERO_REWARD = "120000000000";
const PROPOSER_REWARD = "60000000000";
const ZERO_HASH = "0".repeat(64);

const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const fixtureHash = (label) => sha256Hex(`iat-promotions-dlc-reconciliation:${label}`);
const normalizedTextSha256 = (path) => sha256Hex(
  readFileSync(path, "utf8").replace(/\r\n/g, "\n"),
);

const FIXTURE = Object.freeze({
  campaign: fixtureHash("campaign"),
  mint: fixtureHash("mint"),
  vault: fixtureHash("promotion-vault"),
  refund: fixtureHash("community-refund"),
  registry: fixtureHash("verifier-registry"),
  policy: fixtureHash("policy"),
  identityDomain: fixtureHash("identity-domain"),
  review: fixtureHash("review"),
  artifact: fixtureHash("artifact"),
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
    transactionLabel: "initialize-campaign",
  };
}

function registryInitializedEvent() {
  return {
    name: "VerifierRegistryInitialized",
    data: {
      version: "1",
      verifier_registry: FIXTURE.registry,
      campaign: FIXTURE.campaign,
      initial_key_record: fixtureHash("initial-key-record"),
      key_id: fixtureHash("initial-key-id"),
      public_key: fixtureHash("initial-public-key"),
      identity_domain_hash: FIXTURE.identityDomain,
      occurred_at: "1800000001",
      previous_event_hash: ZERO_HASH,
      event_hash: fixtureHash("registry-event-0"),
    },
    transactionLabel: "initialize-registry",
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
    transactionLabel: "fund-campaign",
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
    transactionLabel: "activate-campaign",
  };
}

function nominationEvent(index) {
  return {
    name: "HeroNominated",
    data: {
      version: "1",
      campaign: FIXTURE.campaign,
      nomination: fixtureHash(`nomination-${index}`),
      proposer_wallet: fixtureHash(`proposer-wallet-${index}`),
      proposer_node_commitment: fixtureHash(`proposer-node-${index}`),
      proposer_x_identity_commitment: fixtureHash(`proposer-x-${index}`),
      hero_x_identity_commitment: fixtureHash(`hero-x-${index}`),
      attestation_id: fixtureHash(`nomination-attestation-${index}`),
      nonce_hash: fixtureHash(`nomination-nonce-${index}`),
      occurred_at: String(1_800_028_900 + index * 2),
    },
    transactionLabel: `nominate-${index}`,
  };
}

function settlementEvent(index, surplus) {
  const completedPairs = BigInt(index + 1);
  return {
    name: "PairSettled",
    data: {
      version: "1",
      campaign: FIXTURE.campaign,
      nomination: fixtureHash(`nomination-${index}`),
      settlement_receipt: fixtureHash(`settlement-receipt-${index}`),
      hero_wallet: fixtureHash(`hero-wallet-${index}`),
      proposer_wallet: fixtureHash(`proposer-wallet-${index}`),
      hero_node_commitment: fixtureHash(`hero-node-${index}`),
      proposer_node_commitment: fixtureHash(`proposer-node-${index}`),
      hero_x_identity_commitment: fixtureHash(`hero-x-${index}`),
      proposer_x_identity_commitment: fixtureHash(`proposer-x-${index}`),
      hero_reward_base_units: HERO_REWARD,
      proposer_reward_base_units: PROPOSER_REWARD,
      sequence: String(index),
      completed_pairs: String(completedPairs),
      vault_balance_base_units: String(MAXIMUM_BUDGET - completedPairs * PAIR_REWARD + surplus),
      settled_at: String(1_800_028_901 + index * 2),
    },
    transactionLabel: `settle-${index}`,
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

function encodeRecords(events, eventInterface) {
  const nextLog = new Map();
  return events.map((event, index) => {
    const transactionMessageHash = fixtureHash(`transaction:${event.transactionLabel}`);
    const logIndex = nextLog.get(transactionMessageHash) ?? 0;
    nextLog.set(transactionMessageHash, logIndex + 1);
    return {
      ordinal: String(index),
      transaction_message_hash: transactionMessageHash,
      log_index: String(logIndex),
      bytes_hex: encodeProgramEvent(event.name, event.data, eventInterface).toString("hex"),
    };
  });
}

function campaignSnapshot({ status, completedPairs, verifierRegistry = FIXTURE.registry }) {
  return {
    address: FIXTURE.campaign,
    mint: FIXTURE.mint,
    status,
    promo_vault: FIXTURE.vault,
    community_refund_token_account: FIXTURE.refund,
    verifier_registry: verifierRegistry,
    genesis_timestamp: "1800000000",
    earliest_activation_timestamp: "1800028800",
    maximum_budget_base_units: String(MAXIMUM_BUDGET),
    maximum_completed_pairs: "1000",
    completed_pairs: String(completedPairs),
    hero_paid_base_units: String(BigInt(completedPairs) * BigInt(HERO_REWARD)),
    proposer_paid_base_units: String(BigInt(completedPairs) * BigInt(PROPOSER_REWARD)),
    policy_hash: FIXTURE.policy,
    identity_domain_hash: FIXTURE.identityDomain,
  };
}

function activeOrExhaustedEvidence(
  {
    completedPairs,
    exhausted = false,
    surplus = 0n,
    finalizeSurplus = false,
    extraPending = false,
    verifierDisabled = false,
  },
  eventInterface,
) {
  const events = [initializedEvent(), registryInitializedEvent(), fundedEvent(), activatedEvent()];
  const receipts = [];
  if (extraPending) events.push(nominationEvent(completedPairs + 1));
  for (let index = 0; index < completedPairs; index += 1) {
    const nomination = nominationEvent(index);
    const settlement = settlementEvent(index, surplus);
    events.push(nomination, settlement);
    receipts.push(receiptFromSettlement(settlement));
  }
  if (exhausted) {
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
      transactionLabel: finalSettlement.transactionLabel,
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
        transactionLabel: "finalize-surplus",
      });
    }
  }
  let registryStatus = "ACTIVE";
  let registryHead = fixtureHash("registry-event-0");
  if (verifierDisabled) {
    const nextHead = fixtureHash("registry-disabled");
    events.push({
      name: "VerifierRegistryEmergencyDisabled",
      data: {
        version: "1",
        verifier_registry: FIXTURE.registry,
        reason: "1",
        review_id: fixtureHash("disable-review"),
        review_hash: fixtureHash("disable-review-evidence"),
        cancelled_rotation_id: ZERO_HASH,
        occurred_at: "1800032000",
        previous_event_hash: registryHead,
        event_hash: nextHead,
      },
      transactionLabel: "disable-registry",
    });
    registryStatus = "EMERGENCY_DISABLED";
    registryHead = nextHead;
  }
  const finalVault = exhausted && finalizeSurplus
    ? 0n
    : MAXIMUM_BUDGET - BigInt(completedPairs) * PAIR_REWARD + surplus;
  return {
    records: encodeRecords(events, eventInterface),
    snapshot: {
      campaign: campaignSnapshot({
        status: exhausted ? "EXHAUSTED" : "ACTIVE",
        completedPairs,
      }),
      promotionVault: { address: FIXTURE.vault, balance_base_units: String(finalVault) },
      settlementReceipts: receipts,
      verifierRegistries: [{
        address: FIXTURE.registry,
        campaign: FIXTURE.campaign,
        status: registryStatus,
        last_event_hash: registryHead,
      }],
    },
  };
}

function cancelledEvidence(eventInterface) {
  const events = [initializedEvent(), fundedEvent(), {
    name: "CampaignCancelledPreActivation",
    data: {
      version: "1",
      campaign: FIXTURE.campaign,
      refund_destination: FIXTURE.refund,
      refunded_base_units: String(MAXIMUM_BUDGET),
      occurred_at: "1800000100",
    },
    transactionLabel: "cancel-campaign",
  }];
  return {
    records: encodeRecords(events, eventInterface),
    snapshot: {
      campaign: campaignSnapshot({
        status: "CANCELLED",
        completedPairs: 0,
        verifierRegistry: ZERO_HASH,
      }),
      promotionVault: { address: FIXTURE.vault, balance_base_units: "0" },
      settlementReceipts: [],
      verifierRegistries: [],
    },
  };
}

export function buildReconciliationScenarioEvidence(
  scenario,
  eventInterface = loadProgramEventInterface(),
) {
  if (scenario === "ACTIVE_TWO_PAIRS") {
    return activeOrExhaustedEvidence({ completedPairs: 2 }, eventInterface);
  }
  if (scenario === "CANCELLED_PRE_ACTIVATION") return cancelledEvidence(eventInterface);
  if (scenario === "EXHAUSTED_1000") {
    return activeOrExhaustedEvidence(
      { completedPairs: 1000, exhausted: true, extraPending: true },
      eventInterface,
    );
  }
  if (scenario === "SURPLUS_FINALIZED") {
    return activeOrExhaustedEvidence(
      { completedPairs: 1000, exhausted: true, surplus: 500n, finalizeSurplus: true },
      eventInterface,
    );
  }
  if (scenario === "VERIFIER_DISABLED") {
    return activeOrExhaustedEvidence(
      { completedPairs: 2, verifierDisabled: true },
      eventInterface,
    );
  }
  throw new Error("UNKNOWN_RECONCILIATION_SCENARIO");
}

export function reconciliationMerkleRoot(items, domain) {
  if (!Array.isArray(items)) throw new Error("MERKLE_ITEMS_NOT_ARRAY");
  if (typeof domain !== "string" || domain.length === 0) throw new Error("MERKLE_DOMAIN_REQUIRED");
  if (items.length === 0) return sha256Hex(`${domain}:empty`);
  let level = items.map((item) => Buffer.from(
    sha256Hex(`${domain}:leaf:${canonicalJson(item)}`),
    "hex",
  ));
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) {
      const left = level[index];
      const right = level[index + 1] ?? left;
      next.push(createHash("sha256")
        .update(`${domain}:node:`)
        .update(left)
        .update(right)
        .digest());
    }
    level = next;
  }
  return level[0].toString("hex");
}

export const RECONCILIATION_SCENARIOS = Object.freeze([
  "ACTIVE_TWO_PAIRS",
  "CANCELLED_PRE_ACTIVATION",
  "EXHAUSTED_1000",
  "SURPLUS_FINALIZED",
  "VERIFIER_DISABLED",
]);

export function generateEventReconciliationVectors({
  policy = loadEventReconciliationPolicy(),
  eventInterface = loadProgramEventInterface(),
} = {}) {
  if (
    policy.status.network !== "NONE" ||
    policy.status.programId !== null ||
    policy.status.deployable !== false ||
    policy.status.reconciliationApplied !== false
  ) {
    throw new Error("reconciliation vectors require a held, network-free policy");
  }
  return {
    vectorVersion: 1,
    vectorId: "iat-promotions-dlc-reconciliation-vectors-v1",
    status: { ...policy.status },
    sources: {
      reconciliationPolicy: {
        path: "event-reconciliation-policy.v1.json",
        canonicalSha256: canonicalSha256(policy),
      },
      eventInterface: {
        path: "program-event-interface.v1.json",
        canonicalSha256: canonicalSha256(eventInterface),
      },
      reconciler: {
        path: "event-reconciler.mjs",
        normalizedTextSha256: normalizedTextSha256(RECONCILER_PATH),
      },
      generator: {
        path: "generate-event-reconciliation-vectors.mjs",
        normalizedTextSha256: normalizedTextSha256(GENERATOR_PATH),
      },
    },
    digestContract: {
      canonicalJson: "recursive lexical object-key order; arrays retain order; JSON scalars unchanged",
      hash: "SHA-256",
      merkleLeaves: "SHA-256(domain + ':leaf:' + canonical_json(item))",
      merkleNodes: "SHA-256(domain + ':node:' + left_32_bytes + right_32_bytes)",
      oddNode: "duplicate final node",
      emptyRoot: "SHA-256(domain + ':empty')",
    },
    scenarios: RECONCILIATION_SCENARIOS.map((scenario) => {
      const evidence = buildReconciliationScenarioEvidence(scenario, eventInterface);
      const result = reconcileEventEvidence(evidence, { policy, eventInterface });
      return {
        name: scenario,
        eventRecordCount: String(evidence.records.length),
        settlementReceiptCount: String(evidence.snapshot.settlementReceipts.length),
        digests: {
          evidenceCanonicalSha256: canonicalSha256(evidence),
          recordsCanonicalSha256: canonicalSha256(evidence.records),
          snapshotCanonicalSha256: canonicalSha256(evidence.snapshot),
          recordMerkleRoot: reconciliationMerkleRoot(
            evidence.records,
            "iat-promotions-dlc-reconciliation-records-v1",
          ),
          receiptMerkleRoot: reconciliationMerkleRoot(
            evidence.snapshot.settlementReceipts,
            "iat-promotions-dlc-reconciliation-receipts-v1",
          ),
          resultCanonicalSha256: canonicalSha256(result),
        },
        result,
      };
    }),
  };
}

if (process.argv[1] === GENERATOR_PATH) {
  const rendered = `${JSON.stringify(generateEventReconciliationVectors(), null, 2)}\n`;
  if (process.argv.includes("--write")) {
    writeFileSync(OUTPUT_PATH, rendered, "utf8");
    console.log("Wrote compact reconciliation vectors; no network or wallet was used.");
  } else {
    process.stdout.write(rendered);
  }
}

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { fileURLToPath } from "node:url";

const schemaUrl = new URL("../engagement/reward-ledger.v2.schema.sql", import.meta.url);
const validatorUrl = new URL("../scripts/validate-reward-ledger-v2-schema.mjs", import.meta.url);
const schema = readFileSync(schemaUrl, "utf8");
const digest = (value) => createHash("sha256").update(value).digest("hex");
const DAILY_SELECTION_ALGORITHM = "IAT_DAILY_BUDGET_V1_ASCENDING_SHA256";
const DAILY_SELECTION_DOMAIN = "IAT_DAILY_BUDGET_V1";
const base58Alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const walletFor = (value) => [...createHash("sha256").update(`wallet:${value}`).digest()]
  .map((byte) => base58Alphabet[byte % base58Alphabet.length])
  .join("");
const utcPlus = (value, milliseconds) => new Date(new Date(value).valueOf() + milliseconds).toISOString();

const openLedger = () => {
  const db = new DatabaseSync(":memory:");
  db.exec(schema);
  return db;
};

const addHistory = (db, { id, nodeId, kind, acceptedAt, evidence }) => Number(db.prepare(
  "INSERT INTO reward_v2_history_events (event_id, node_id, event_kind, accepted_at_utc, evidence_digest) VALUES (?, ?, ?, ?, ?)",
).run(id, nodeId, kind, acceptedAt, evidence).lastInsertRowid);

const addNode = (db, {
  suffix,
  wallet = walletFor(suffix),
  xUserId = String(9_000_000_000_000_000n + BigInt(suffix.replace(/\D/gu, "") || 1)),
  createdAt = "2026-06-01T00:00:00.000Z",
  observedAt = "2026-07-11T00:00:00.000Z",
  acceptedAt = "2026-07-11T00:00:01.000Z",
} = {}) => {
  const nodeId = `node-v2-${suffix}`;
  const identityDigest = digest(`identity:${suffix}`);
  const oauthDigest = digest(`oauth:${suffix}`);
  db.prepare(
    "INSERT INTO reward_v2_identity_tombstones (node_id, immutable_x_user_id, wallet_address, identity_digest, tombstoned_at_utc) VALUES (?, ?, ?, ?, ?)",
  ).run(nodeId, xUserId, wallet, identityDigest, acceptedAt);
  const nodeSequence = addHistory(db, {
    id: `history-node-${suffix}`,
    nodeId,
    kind: "node_bound",
    acceptedAt,
    evidence: oauthDigest,
  });
  db.prepare(`
    INSERT INTO reward_v2_nodes (
      node_id, immutable_x_user_id, wallet_address, wallet_proof_digest,
      wallet_proof_accepted_at_utc, oauth_control_evidence_digest, country_code,
      x_account_created_at_utc, x_control_observed_at_utc, node_accepted_at_utc,
      node_history_sequence
    ) VALUES (?, ?, ?, ?, ?, ?, 'TR', ?, ?, ?, ?)
  `).run(
    nodeId,
    xUserId,
    wallet,
    digest(`wallet-proof:${suffix}`),
    acceptedAt,
    oauthDigest,
    createdAt,
    observedAt,
    acceptedAt,
    nodeSequence,
  );
  return { nodeId, wallet, xUserId, nodeSequence };
};

const addTier = (db, node, {
  suffix,
  tier,
  observedAt,
  acceptedAt = utcPlus(observedAt, 1_000),
} = {}) => {
  const evidence = digest(`tier:${suffix}`);
  const observationId = `tier-v2-${suffix}`;
  const sequence = addHistory(db, {
    id: `history-tier-${suffix}`,
    nodeId: node.nodeId,
    kind: "tier_observed",
    acceptedAt,
    evidence,
  });
  db.prepare(`
    INSERT INTO reward_v2_tier_observations (
      observation_id, node_id, immutable_x_user_id, tier, provider_evidence_digest,
      observed_at_utc, accepted_at_utc, fresh_until_utc, observation_history_sequence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    observationId,
    node.nodeId,
    node.xUserId,
    tier,
    evidence,
    observedAt,
    acceptedAt,
    utcPlus(observedAt, 86_400_000),
    sequence,
  );
  return { observationId, sequence, acceptedAt, freshUntil: utcPlus(observedAt, 86_400_000) };
};

const addAction = (db, node, {
  suffix,
  type = "original",
  effectiveAt = "2026-08-01T10:00:00.000Z",
  acceptedAt = "2026-08-01T10:00:01.000Z",
  slot = null,
  providerActivityId = String(8_000_000_000_000_000n + BigInt(suffix.replace(/\D/gu, "") || 1)),
  targetDigest = digest(`target:${suffix}`),
} = {}) => {
  const evidence = digest(`action:${suffix}`);
  const actionId = `action-v2-${suffix}`;
  const sequence = addHistory(db, {
    id: `history-action-${suffix}`,
    nodeId: node.nodeId,
    kind: "action_accepted",
    acceptedAt,
    evidence,
  });
  const lookupOnly = type === "like" || type === "follow";
  db.prepare(`
    INSERT INTO reward_v2_qualifying_actions (
      action_id, node_id, utc_day, action_type, provider_activity_id,
      provider_activity_at_utc, first_observed_at_utc,
      first_observed_finalized_slot, effective_activity_at_utc,
      canonical_campaign_target_digest, evidence_digest, accepted_at_utc,
      action_history_sequence
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    actionId,
    node.nodeId,
    effectiveAt.slice(0, 10),
    type,
    lookupOnly ? null : providerActivityId,
    lookupOnly ? null : effectiveAt,
    lookupOnly ? effectiveAt : null,
    lookupOnly ? slot : null,
    effectiveAt,
    targetDigest,
    evidence,
    acceptedAt,
    sequence,
  );
  return { actionId, sequence };
};

const addFundingRound = (db, day, suffix = day.replaceAll("-", "")) => {
  const roundId = `funding-v2-${suffix}`;
  const opensAt = `${day}T00:00:00.000Z`;
  const missDecidableAt = utcPlus(opensAt, 1_000);
  const snapshotDigest = digest(`snapshot:${suffix}`);
  const laneSnapshotDigest = digest(`lane-reservation-snapshot:${suffix}`);
  db.prepare(`
    INSERT INTO reward_v2_funding_rounds (
      funding_round_id, utc_day, opens_at_utc, miss_decidable_at_utc,
      funding_class, state, created_at_utc
    ) VALUES (?, ?, ?, ?, 'STANDARD_10_PERCENT_AND_X_CAMPAIGN', 'collecting', ?)
  `).run(roundId, day, opensAt, missDecidableAt, utcPlus(opensAt, -86_400_000));
  return { roundId, opensAt, missDecidableAt, snapshotDigest, laneSnapshotDigest };
};

const sealFundingRound = (db, round) => {
  db.prepare(`
    UPDATE reward_v2_funding_rounds
    SET state = 'sealed', sealed_at_utc = ?, candidate_snapshot_digest = ?,
      lane_reservation_snapshot_digest = ?
    WHERE funding_round_id = ?
  `).run(round.opensAt, round.snapshotDigest, round.laneSnapshotDigest, round.roundId);
  db.prepare("UPDATE reward_v2_funding_rounds SET state = 'global_allocator_pending' WHERE funding_round_id = ?")
    .run(round.roundId);
  return round;
};

const addGenesisAcceptance = (db, node, {
  suffix,
  rank,
  day,
  acceptedAt = `${day}T12:00:00.000Z`,
} = {}) => {
  const acceptanceId = `genesis-v2-${suffix}`;
  db.prepare(`
    INSERT INTO reward_v2_genesis_acceptances (
      acceptance_id, genesis_rank, node_id, origin_utc_day,
      accepted_at_utc, acceptance_evidence_digest
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(acceptanceId, rank, node.nodeId, day, acceptedAt, digest(`genesis:${suffix}`));
  return { acceptanceId, rank, acceptedAt };
};

const addCandidate = (db, node, observation, {
  suffix,
  kind = "DAILY",
  day = "2026-08-01",
  action = null,
  genesisAcceptance = null,
  genesisRank = null,
  originalRound,
  createdAt = `${day}T10:00:02.000Z`,
} = {}) => {
  const candidateId = `candidate-v2-${suffix}`;
  const baseSequence = Math.max(node.nodeSequence, observation.sequence, action?.sequence ?? node.nodeSequence);
  const amount = kind === "GENESIS" ? 100_000_000_000 : 12_000_000_000;
  const expiresAt = utcPlus(originalRound.opensAt, 30 * 86_400_000);
  db.prepare(`
    INSERT INTO reward_v2_candidates (
      candidate_id, campaign_kind, origin_utc_day, node_id, action_id,
      genesis_acceptance_id, original_funding_round_at_utc,
      initial_tier_observation_id, genesis_rank, nominal_full_reward_base_units,
      base_eligibility_sequence, claim_expires_at_utc, created_at_utc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    candidateId,
    kind,
    day,
    node.nodeId,
    action?.actionId ?? null,
    genesisAcceptance?.acceptanceId ?? null,
    originalRound.opensAt,
    observation.observationId,
    genesisRank,
    amount,
    baseSequence,
    expiresAt,
    createdAt,
  );
  return {
    candidateId,
    baseSequence,
    amount,
    expiresAt,
    kind,
    genesisAcceptanceId: genesisAcceptance?.acceptanceId ?? null,
  };
};

const addDailyEpoch = (db, round, {
  suffix,
  ordinal = Number(db.prepare("SELECT coalesce(max(epoch_ordinal), 0) + 1 AS ordinal FROM reward_v2_daily_epochs").get().ordinal),
  selectedCount = 1,
  selectedNominal = selectedCount * 12_000_000_000,
  cumulativeNominal,
  previousChainDigest,
  policyHash = digest("frozen-daily-sha-lottery-v1"),
  finalizedSlot = 700_000 + ordinal,
  finalizedSlotHash = digest(`finalized-slot:${suffix}`),
  chainDigest = digest(`daily-epoch-chain:${suffix}`),
  finalizedAt = round.opensAt,
} = {}) => {
  const previous = db.prepare(`
    SELECT epoch_chain_digest, cumulative_selected_nominal_base_units
    FROM reward_v2_daily_epochs ORDER BY epoch_ordinal DESC LIMIT 1
  `).get();
  const dailyEpochId = `daily-epoch-v2-${suffix}`;
  const resolvedPreviousChain = previousChainDigest === undefined ? (previous?.epoch_chain_digest ?? null) : previousChainDigest;
  const resolvedCumulative = cumulativeNominal === undefined
    ? Number(previous?.cumulative_selected_nominal_base_units ?? 0) + selectedNominal
    : cumulativeNominal;
  const originDay = utcPlus(round.opensAt, -86_400_000).slice(0, 10);
  db.prepare(`
    INSERT INTO reward_v2_daily_epochs (
      daily_epoch_id, epoch_ordinal, origin_utc_day, funding_round_id,
      nominal_reward_per_selected_base_units, selected_count,
      selected_nominal_base_units, cumulative_selected_nominal_base_units,
      candidate_snapshot_digest, selection_policy_hash, selection_algorithm,
      selection_domain, finalized_slot,
      finalized_slot_hash, previous_epoch_chain_digest, epoch_chain_digest,
      budget_attestation_digest, finalized_at_utc, refill_allowed, recycling_allowed
    ) VALUES (?, ?, ?, ?, 12000000000, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
  `).run(
    dailyEpochId,
    ordinal,
    originDay,
    round.roundId,
    selectedCount,
    selectedNominal,
    resolvedCumulative,
    round.snapshotDigest,
    policyHash,
    DAILY_SELECTION_ALGORITHM,
    DAILY_SELECTION_DOMAIN,
    finalizedSlot,
    finalizedSlotHash,
    resolvedPreviousChain,
    chainDigest,
    digest(`daily-budget-attestation:${suffix}`),
    finalizedAt,
  );
  return {
    dailyEpochId,
    ordinal,
    policyHash,
    finalizedSlot,
    finalizedSlotHash,
    chainDigest,
  };
};

const addDailySelection = (db, candidate, round, epoch, {
  suffix,
  rank = 1,
  score = digest(`v1-selection-score:${suffix}`),
  selectedAt = round.opensAt,
} = {}) => {
  const dailySelectionId = `daily-selection-v2-${suffix}`;
  db.prepare(`
    INSERT INTO reward_v2_daily_selections (
      daily_selection_id, daily_epoch_id, funding_round_id, candidate_id,
      selection_rank, selection_policy_hash, selection_algorithm,
      selection_domain, candidate_snapshot_digest,
      finalized_slot, finalized_slot_hash, v1_selection_score,
      selection_attestation_digest, selected_at_utc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    dailySelectionId,
    epoch.dailyEpochId,
    round.roundId,
    candidate.candidateId,
    rank,
    epoch.policyHash,
    DAILY_SELECTION_ALGORITHM,
    DAILY_SELECTION_DOMAIN,
    round.snapshotDigest,
    epoch.finalizedSlot,
    epoch.finalizedSlotHash,
    score,
    digest(`daily-selection-attestation:${suffix}`),
    selectedAt,
  );
  return { dailySelectionId, rank, score };
};

const ensureAllocatorBatch = (db, round, {
  suffix,
  decidedAt,
  kind = "GLOBAL_ALLOCATOR_V1",
} = {}) => {
  const existing = db.prepare(`
    SELECT allocator_batch_id AS allocatorBatchId,
      allocator_batch_digest AS allocatorBatchDigest,
      candidate_snapshot_digest AS candidateSnapshotDigest,
      lane_reservation_snapshot_digest AS laneReservationSnapshotDigest,
      decided_at_utc AS decidedAt
    FROM reward_v2_allocator_batches
    WHERE funding_round_id = ?
  `).get(round.roundId);
  if (existing) return existing;
  const allocatorBatchId = `allocator-batch-v2-${suffix}`;
  const allocatorBatchDigest = digest(`allocator-batch:${suffix}`);
  db.prepare(`
    INSERT INTO reward_v2_allocator_batches (
      allocator_batch_id, funding_round_id, batch_kind, allocator_batch_digest,
      candidate_snapshot_digest, lane_reservation_snapshot_digest,
      authentication_evidence_digest, decided_at_utc, recorded_at_utc,
      runtime_authentication_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(
    allocatorBatchId,
    round.roundId,
    kind,
    allocatorBatchDigest,
    round.snapshotDigest,
    round.laneSnapshotDigest,
    digest(`allocator-authentication:${suffix}`),
    decidedAt,
    decidedAt,
  );
  return {
    allocatorBatchId,
    allocatorBatchDigest,
    candidateSnapshotDigest: round.snapshotDigest,
    laneReservationSnapshotDigest: round.laneSnapshotDigest,
    decidedAt,
  };
};

const addAllocatorReceipt = (db, node, candidate, round, {
  suffix,
  tranche = "X_BASE_10",
  premium = null,
  selection = null,
  amount = tranche === "X_BASE_10"
    ? candidate.amount / 10
    : tranche === "X_PREMIUM_FULL_100"
      ? candidate.amount
      : candidate.amount - candidate.amount / 10,
  eligibilitySequence = tranche === "X_PREMIUM_UPGRADE_90" ? (premium?.sequence ?? 0) : candidate.baseSequence,
  decidedAt = utcPlus(round.opensAt, 12 * 3_600_000),
  disposition = "ADMITTED_RESERVED",
  nullReason = null,
  batchKind = "GLOBAL_ALLOCATOR_V1",
} = {}) => {
  const batch = ensureAllocatorBatch(db, round, { suffix: `${suffix}-batch`, decidedAt, kind: batchKind });
  const allocatorReceiptId = `allocator-receipt-v2-${suffix}`;
  const decisionDigest = digest(`allocator-decision:${suffix}`);
  const receiptDigest = digest(`allocator-receipt:${suffix}`);
  db.prepare(`
    INSERT INTO reward_v2_allocator_receipts (
      allocator_receipt_id, allocator_batch_id, funding_round_id,
      allocator_batch_digest, candidate_id, node_id, daily_selection_id,
      genesis_acceptance_id, tranche_kind, tranche_basis_points, funding_class,
      amount_base_units, premium_observation_id, eligibility_sequence,
      candidate_snapshot_digest, lane_reservation_snapshot_digest,
      allocator_decision_digest, allocator_receipt_digest, disposition,
      null_reason, decided_at_utc, partial_payment_allowed, retry_allowed,
      recycling_allowed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
      'STANDARD_10_PERCENT_AND_X_CAMPAIGN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
  `).run(
    allocatorReceiptId,
    batch.allocatorBatchId,
    round.roundId,
    batch.allocatorBatchDigest,
    candidate.candidateId,
    node.nodeId,
    selection?.dailySelectionId ?? null,
    candidate.kind === "GENESIS" ? candidate.genesisAcceptanceId : null,
    tranche,
    tranche === "X_BASE_10" ? 1_000 : tranche === "X_PREMIUM_FULL_100" ? 10_000 : 9_000,
    amount,
    premium?.observationId ?? null,
    eligibilitySequence,
    batch.candidateSnapshotDigest,
    batch.laneReservationSnapshotDigest,
    decisionDigest,
    receiptDigest,
    disposition,
    nullReason,
    batch.decidedAt,
  );
  return {
    allocatorReceiptId,
    allocatorBatchDigest: batch.allocatorBatchDigest,
    decisionDigest,
    receiptDigest,
    amount,
    eligibilitySequence,
    decidedAt: batch.decidedAt,
  };
};

const addGrant = (db, node, candidate, round, {
  suffix,
  tranche = "X_BASE_10",
  premium = null,
  selection = null,
  amount = tranche === "X_BASE_10"
    ? candidate.amount / 10
    : tranche === "X_PREMIUM_FULL_100"
      ? candidate.amount
      : candidate.amount - candidate.amount / 10,
  eligibilitySequence = tranche === "X_PREMIUM_UPGRADE_90" ? (premium?.sequence ?? 0) : candidate.baseSequence,
  allocatedAt = utcPlus(round.opensAt, 12 * 3_600_000),
} = {}) => {
  const receipt = addAllocatorReceipt(db, node, candidate, round, {
    suffix,
    tranche,
    premium,
    selection,
    amount,
    eligibilitySequence,
    decidedAt: allocatedAt,
  });
  const grantId = `grant-v2-${suffix}`;
  db.prepare(`
    INSERT INTO reward_v2_allocator_grants (
      grant_id, allocator_receipt_id, funding_round_id, candidate_id, node_id, daily_selection_id,
      genesis_acceptance_id, tranche_kind, tranche_basis_points,
      funding_class, amount_base_units, premium_observation_id,
      eligibility_sequence, candidate_snapshot_digest, lane_reservation_snapshot_digest,
      allocator_decision_digest, allocator_receipt_digest, allocated_at_utc,
      partial_payment_allowed, retry_allowed, recycling_allowed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'STANDARD_10_PERCENT_AND_X_CAMPAIGN', ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
  `).run(
    grantId,
    receipt.allocatorReceiptId,
    round.roundId,
    candidate.candidateId,
    node.nodeId,
    selection?.dailySelectionId ?? null,
    candidate.kind === "GENESIS" ? candidate.genesisAcceptanceId : null,
    tranche,
    tranche === "X_BASE_10" ? 1_000 : tranche === "X_PREMIUM_FULL_100" ? 10_000 : 9_000,
    amount,
    premium?.observationId ?? null,
    eligibilitySequence,
    round.snapshotDigest,
    round.laneSnapshotDigest,
    receipt.decisionDigest,
    receipt.receiptDigest,
    receipt.decidedAt,
  );
  return { grantId, amount, allocatedAt };
};

const addNullReceipt = (db, node, candidate, round, {
  suffix,
  tranche = "X_BASE_10",
  premium = null,
  selection = null,
  disposition = "NULL_MISSED",
  nullReason = "daily_unfulfilled_at_utc_boundary",
  nullifiedAt = round.missDecidableAt,
} = {}) => {
  const allocatorReceipt = addAllocatorReceipt(db, node, candidate, round, {
    suffix,
    tranche,
    premium,
    selection,
    decidedAt: nullifiedAt,
    disposition,
    nullReason,
  });
  const trancheBasisPoints = tranche === "X_BASE_10" ? 1_000 : tranche === "X_PREMIUM_FULL_100" ? 10_000 : 9_000;
  const nullReceiptId = `null-receipt-v2-${suffix}`;
  db.prepare(`
    INSERT INTO reward_v2_null_receipts (
      null_receipt_id, allocator_receipt_id, funding_round_id,
      allocator_batch_digest, candidate_id, node_id, tranche_kind,
      tranche_basis_points, funding_class, amount_base_units,
      eligibility_sequence, candidate_snapshot_digest,
      lane_reservation_snapshot_digest, allocator_decision_digest,
      allocator_receipt_digest, null_reason, nullified_at_utc,
      null_receipt_digest, retry_allowed, recycling_allowed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?,
      'STANDARD_10_PERCENT_AND_X_CAMPAIGN', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
  `).run(
    nullReceiptId,
    allocatorReceipt.allocatorReceiptId,
    round.roundId,
    allocatorReceipt.allocatorBatchDigest,
    candidate.candidateId,
    node.nodeId,
    tranche,
    trancheBasisPoints,
    allocatorReceipt.amount,
    allocatorReceipt.eligibilitySequence,
    round.snapshotDigest,
    round.laneSnapshotDigest,
    allocatorReceipt.decisionDigest,
    allocatorReceipt.receiptDigest,
    nullReason,
    allocatorReceipt.decidedAt,
    digest(`null-receipt:${suffix}`),
  );
  return { nullReceiptId, allocatorReceipt };
};

test("the schema is isolated, executable, STRICT, and permanently non-activating", () => {
  const db = openLedger();
  const guard = db.prepare("SELECT * FROM reward_v2_blueprint_guard").get();
  assert.equal(guard.status, "BLUEPRINT_ONLY_NON_ACTIVATING");
  assert.equal(guard.runtime_wiring_allowed, 0);
  assert.equal(guard.migration_path_present, 0);
  assert.equal(guard.global_allocator_present, 0);
  assert.equal(db.prepare("SELECT count(*) AS count FROM pragma_table_list WHERE name LIKE 'reward_v2_%' AND strict = 1").get().count, 16);
  assert.equal(db.prepare("PRAGMA recursive_triggers").get().recursive_triggers, 1);
  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  assert.throws(() => db.prepare("UPDATE reward_v2_blueprint_guard SET runtime_wiring_allowed = 1").run(), /immutable|CHECK/);
  assert.doesNotMatch(schema, /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?node_bindings/iu);
  db.close();
});

test("INSERT OR REPLACE cannot bypass any append-only table even with recursive triggers disabled", () => {
  const db = openLedger();
  assert.equal(
    db.prepare("SELECT count(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'reward_v2_%_no_replace'").get().count,
    16,
  );
  db.exec("PRAGMA recursive_triggers = OFF");
  db.prepare(`
    INSERT INTO reward_v2_identity_tombstones (
      node_id, immutable_x_user_id, wallet_address, identity_digest, tombstoned_at_utc
    ) VALUES (?, ?, ?, ?, ?)
  `).run("node-v2-replace-a", "7000000000000001", walletFor("replace-a"), digest("replace-a"), "2026-07-11T00:00:00.000Z");
  assert.throws(
    () => db.prepare(`
      INSERT OR REPLACE INTO reward_v2_identity_tombstones (
        node_id, immutable_x_user_id, wallet_address, identity_digest, tombstoned_at_utc
      ) VALUES (?, ?, ?, ?, ?)
    `).run("node-v2-replace-b", "7000000000000001", walletFor("replace-b"), digest("replace-b"), "2026-07-12T00:00:00.000Z"),
    /cannot be replaced/,
  );

  const firstNode = addNode(db, { suffix: "replace-701" });
  const secondNode = addNode(db, { suffix: "replace-702" });
  addGenesisAcceptance(db, firstNode, { suffix: "replace-701", rank: 1, day: "2026-08-01" });
  assert.throws(
    () => db.prepare(`
      INSERT OR REPLACE INTO reward_v2_genesis_acceptances (
        acceptance_id, genesis_rank, node_id, origin_utc_day,
        accepted_at_utc, acceptance_evidence_digest
      ) VALUES (?, 1, ?, '2026-08-02', '2026-08-02T12:00:00.000Z', ?)
    `).run("genesis-v2-replace-702", secondNode.nodeId, digest("genesis-replace-702")),
    /cannot be replaced|next contiguous/,
  );
  assert.equal(db.prepare("SELECT node_id FROM reward_v2_genesis_acceptances WHERE genesis_rank = 1").get().node_id, firstNode.nodeId);
  db.exec(schema);
  db.close();
});

test("OAuth-bound numeric X identity, signed wallet, country, exact 40 days, and tombstones fail closed", () => {
  const db = openLedger();
  const node = addNode(db, { suffix: "101" });
  assert.throws(() => addNode(db, { suffix: "102", wallet: node.wallet }), /UNIQUE|cannot be replaced/);
  assert.throws(() => addNode(db, { suffix: "103", xUserId: "x-user-103" }), /CHECK/);
  assert.throws(
    () => addNode(db, { suffix: "104", observedAt: "2026-07-10T23:59:59.000Z" }),
    /CHECK/,
  );
  assert.throws(() => db.prepare("DELETE FROM reward_v2_identity_tombstones WHERE node_id = ?").run(node.nodeId), /permanent/);
  assert.throws(() => db.prepare("UPDATE reward_v2_nodes SET country_code = 'US' WHERE node_id = ?").run(node.nodeId), /immutable/);
  db.close();
});

test("tier evidence is exact, fresh for 24 hours, append-only, and unknown values are rejected", () => {
  const db = openLedger();
  const node = addNode(db, { suffix: "201" });
  const none = addTier(db, node, { suffix: "201-none", tier: "None", observedAt: "2026-08-01T09:00:00.000Z" });
  assert.equal(none.freshUntil, "2026-08-02T09:00:00.000Z");
  assert.throws(
    () => addTier(db, node, { suffix: "201-unknown", tier: "Verified", observedAt: "2026-08-01T10:00:00.000Z" }),
    /CHECK/,
  );
  const premium = addTier(db, node, { suffix: "201-premium", tier: "Premium", observedAt: "2026-08-01T09:30:00.000Z" });
  const action = addAction(db, node, { suffix: "201-action" });
  const round = addFundingRound(db, "2026-08-02", "201-origin");
  assert.throws(
    () => addCandidate(db, node, none, { suffix: "201-stale-tier", action, originalRound: round }),
    /latest current known tier/,
  );
  addCandidate(db, node, premium, { suffix: "201-current-tier", action, originalRound: round });
  assert.throws(() => db.prepare("UPDATE reward_v2_tier_observations SET tier = 'Premium' WHERE observation_id = ?").run(none.observationId), /append-only/);
  db.close();
});

test("the six-action enum rejects unattributable types and like/follow require first-observed finalized slots", () => {
  const db = openLedger();
  const originalNode = addNode(db, { suffix: "301" });
  addAction(db, originalNode, { suffix: "301-original", type: "original" });

  const likeNode = addNode(db, { suffix: "302" });
  addAction(db, likeNode, { suffix: "302-like", type: "like", slot: 500_001 });
  const followNode = addNode(db, { suffix: "303" });
  addAction(db, followNode, { suffix: "303-follow", type: "follow", slot: 500_002 });

  for (const forbidden of ["bookmark", "view", "impression", "unattributable"]) {
    const node = addNode(db, { suffix: `31${forbidden.length}` });
    assert.throws(() => addAction(db, node, { suffix: `forbidden-${forbidden}`, type: forbidden }), /CHECK/);
  }
  const missingSlotNode = addNode(db, { suffix: "304" });
  assert.throws(() => addAction(db, missingSlotNode, { suffix: "304-like", type: "like", slot: null }), /CHECK/);
  assert.equal(db.prepare("SELECT first_observed_finalized_slot FROM reward_v2_qualifying_actions WHERE action_type = 'follow'").get().first_observed_finalized_slot, 500_002);
  db.close();
});

test("lookup targets and immutable post IDs are replay-unique across UTC epochs", () => {
  const db = openLedger();
  const targetDigest = digest("same-like-target");
  const likeNode = addNode(db, { suffix: "replay-351" });
  addAction(db, likeNode, {
    suffix: "replay-351-day-1",
    type: "like",
    effectiveAt: "2026-08-01T10:00:00.000Z",
    acceptedAt: "2026-08-01T10:00:01.000Z",
    slot: 510_001,
    targetDigest,
  });
  assert.throws(
    () => addAction(db, likeNode, {
      suffix: "replay-351-day-2",
      type: "like",
      effectiveAt: "2026-08-02T10:00:00.000Z",
      acceptedAt: "2026-08-02T10:00:01.000Z",
      slot: 510_002,
      targetDigest,
    }),
    /replay keys cannot be replaced|UNIQUE/,
  );

  const firstPostNode = addNode(db, { suffix: "replay-352" });
  const secondPostNode = addNode(db, { suffix: "replay-353" });
  const providerActivityId = "8111111111111111";
  addAction(db, firstPostNode, { suffix: "replay-post-1", providerActivityId });
  assert.throws(
    () => addAction(db, secondPostNode, {
      suffix: "replay-post-2",
      effectiveAt: "2026-08-02T10:00:00.000Z",
      acceptedAt: "2026-08-02T10:00:01.000Z",
      providerActivityId,
    }),
    /replay keys cannot be replaced|UNIQUE/,
  );
  db.close();
});

test("campaign-scoped daily uniqueness, same-day Genesis coexistence, and the Genesis first-1,000 boundary are structural", () => {
  const db = openLedger();
  const dailyNode = addNode(db, { suffix: "401" });
  const dailyTier = addTier(db, dailyNode, { suffix: "401-none", tier: "None", observedAt: "2026-08-01T09:00:00.000Z" });
  const dailyAction = addAction(db, dailyNode, { suffix: "401-action" });
  const dailyRound = addFundingRound(db, "2026-08-02", "401-origin");
  const daily = addCandidate(db, dailyNode, dailyTier, { suffix: "401-daily", action: dailyAction, originalRound: dailyRound });
  assert.throws(
    () => addCandidate(db, dailyNode, dailyTier, { suffix: "401-duplicate", action: dailyAction, originalRound: dailyRound }),
    /UNIQUE|cannot be replaced/,
  );

  db.exec("BEGIN IMMEDIATE");
  const genesisAcceptance = addGenesisAcceptance(db, dailyNode, { suffix: "401", rank: 1, day: "2026-08-01" });
  assert.throws(
    () => addCandidate(db, dailyNode, dailyTier, {
      suffix: "401-genesis-predated",
      kind: "GENESIS",
      day: "2026-08-01",
      genesisAcceptance,
      genesisRank: 1,
      originalRound: dailyRound,
      createdAt: "2026-08-01T11:59:59.000Z",
    }),
    /cannot predate/,
  );
  const genesis = addCandidate(db, dailyNode, dailyTier, {
    suffix: "401-genesis",
    kind: "GENESIS",
    day: "2026-08-01",
    genesisAcceptance,
    genesisRank: 1,
    originalRound: dailyRound,
    createdAt: "2026-08-01T12:00:01.000Z",
  });
  db.exec("COMMIT");
  sealFundingRound(db, dailyRound);
  assert.equal(db.prepare("SELECT count(*) AS count FROM reward_v2_candidates WHERE node_id = ? AND origin_utc_day = '2026-08-01'").get(dailyNode.nodeId).count, 2);
  assert.equal(daily.amount, 12_000_000_000);
  assert.equal(genesis.amount, 100_000_000_000);
  assert.equal(genesis.expiresAt, "2026-09-01T00:00:00.000Z");

  const overflowNode = addNode(db, { suffix: "403" });
  assert.throws(
    () => addGenesisAcceptance(db, overflowNode, { suffix: "403-gap", rank: 3, day: "2026-08-03" }),
    /next contiguous/,
  );
  assert.throws(
    () => addGenesisAcceptance(db, dailyNode, { suffix: "401-reentry", rank: 2, day: "2026-08-03" }),
    /UNIQUE|cannot be replaced/,
  );
  assert.throws(() => db.prepare("UPDATE reward_v2_genesis_acceptances SET genesis_rank = 2 WHERE acceptance_id = ?").run(genesisAcceptance.acceptanceId), /immutable/);
  db.close();
});

test("daily epoch records pin the 1,000/day, 12,000-IAT/day, 365-epoch, and 4,380,000-IAT cumulative caps", () => {
  const db = openLedger();
  const round = addFundingRound(db, "2026-08-02", "budget-boundaries");
  sealFundingRound(db, round);
  assert.throws(
    () => addDailyEpoch(db, round, { suffix: "count-1001", selectedCount: 1_001 }),
    /CHECK/,
  );
  assert.throws(
    () => addDailyEpoch(db, round, {
      suffix: "daily-cap-plus-one",
      selectedCount: 1_000,
      selectedNominal: 12_000_000_000_001,
    }),
    /CHECK/,
  );
  assert.throws(
    () => addDailyEpoch(db, round, { suffix: "epoch-366", ordinal: 366 }),
    /CHECK|ordinal/,
  );
  assert.throws(
    () => addDailyEpoch(db, round, {
      suffix: "cumulative-cap-plus-one",
      cumulativeNominal: 4_380_000_000_000_001,
    }),
    /CHECK|cumulative/,
  );
  const epoch = addDailyEpoch(db, round, { suffix: "valid-budget" });
  const nextRound = addFundingRound(db, "2026-08-03", "budget-gap");
  sealFundingRound(db, nextRound);
  assert.throws(
    () => addDailyEpoch(db, nextRound, { suffix: "ordinal-gap", ordinal: 3 }),
    /ordinal|chain|cumulative/,
  );
  assert.throws(
    () => db.prepare("DELETE FROM reward_v2_daily_epochs WHERE daily_epoch_id = ?").run(epoch.dailyEpochId),
    /refilled or recycled/,
  );
  db.close();
});

test("daily SHA-lottery selection attestations reject rank overflow, duplicate rank/candidate/score, and unselected grants", () => {
  const db = openLedger();
  const round = addFundingRound(db, "2026-08-02", "selection-boundaries");
  const candidates = ["451", "452", "453"].map((suffix) => {
    const node = addNode(db, { suffix });
    const tier = addTier(db, node, { suffix: `${suffix}-none`, tier: "None", observedAt: "2026-08-01T09:00:00.000Z" });
    const action = addAction(db, node, { suffix: `${suffix}-action` });
    const candidate = addCandidate(db, node, tier, { suffix: `${suffix}-daily`, action, originalRound: round });
    return { node, candidate };
  });
  sealFundingRound(db, round);
  const epoch = addDailyEpoch(db, round, { suffix: "selection-boundaries", selectedCount: 2 });
  const selectionContract = db.prepare("SELECT selection_algorithm, selection_domain FROM reward_v2_daily_epochs WHERE daily_epoch_id = ?").get(epoch.dailyEpochId);
  assert.equal(selectionContract.selection_algorithm, DAILY_SELECTION_ALGORITHM);
  assert.equal(selectionContract.selection_domain, DAILY_SELECTION_DOMAIN);
  const lateNode = addNode(db, { suffix: "454" });
  const lateTier = addTier(db, lateNode, { suffix: "454-none", tier: "None", observedAt: "2026-08-01T09:00:00.000Z" });
  const lateAction = addAction(db, lateNode, { suffix: "454-action" });
  assert.throws(
    () => addCandidate(db, lateNode, lateTier, { suffix: "454-late", action: lateAction, originalRound: round }),
    /before its boundary seal/,
  );
  const first = addDailySelection(db, candidates[0].candidate, round, epoch, {
    suffix: "451",
    rank: 1,
    score: `${"0".repeat(63)}1`,
  });
  assert.throws(
    () => addDailySelection(db, candidates[1].candidate, round, epoch, { suffix: "452-duplicate-rank", rank: 1 }),
    /UNIQUE|contiguous|cannot be replaced/,
  );
  assert.throws(
    () => addDailySelection(db, candidates[0].candidate, round, epoch, { suffix: "451-duplicate-candidate", rank: 2 }),
    /UNIQUE|cannot be replaced/,
  );
  assert.throws(
    () => addDailySelection(db, candidates[1].candidate, round, epoch, {
      suffix: "452-duplicate-score",
      rank: 2,
      score: first.score,
    }),
    /UNIQUE|ascending V1 score|cannot be replaced/,
  );
  assert.throws(
    () => addDailySelection(db, candidates[2].candidate, round, epoch, {
      suffix: "453-descending-score",
      rank: 2,
      score: "0".repeat(64),
    }),
    /ascending V1 score/,
  );
  assert.throws(
    () => addDailySelection(db, candidates[2].candidate, round, epoch, { suffix: "453-rank-1001", rank: 1_001 }),
    /CHECK|eligible|contiguous/,
  );
  assert.throws(
    () => addGrant(db, candidates[1].node, candidates[1].candidate, round, { suffix: "452-unselected" }),
    /Daily selection|daily selection|campaign/,
  );
  const second = addDailySelection(db, candidates[1].candidate, round, epoch, {
    suffix: "452",
    rank: 2,
    score: `${"0".repeat(63)}2`,
  });
  assert.throws(
    () => db.prepare(`
      INSERT INTO reward_v2_allocator_grants (
        grant_id, allocator_receipt_id, funding_round_id, candidate_id, node_id,
        daily_selection_id, genesis_acceptance_id, tranche_kind,
        tranche_basis_points, funding_class, amount_base_units,
        premium_observation_id, eligibility_sequence, candidate_snapshot_digest,
        lane_reservation_snapshot_digest, allocator_decision_digest,
        allocator_receipt_digest, allocated_at_utc, partial_payment_allowed,
        retry_allowed, recycling_allowed
      ) VALUES ('grant-v2-forged-receipt', 'allocator-receipt-v2-forged', ?, ?, ?, ?,
        NULL, 'X_BASE_10', 1000, 'STANDARD_10_PERCENT_AND_X_CAMPAIGN',
        1200000000, NULL, ?, ?, ?, ?, ?, '2026-08-02T12:00:00.000Z', 0, 0, 0)
    `).run(
      round.roundId,
      candidates[1].candidate.candidateId,
      candidates[1].node.nodeId,
      second.dailySelectionId,
      candidates[1].candidate.baseSequence,
      round.snapshotDigest,
      round.laneSnapshotDigest,
      digest("forged-decision"),
      digest("forged-receipt"),
    ),
    /antecedent admitted allocator receipt|FOREIGN KEY/,
  );
  const grant = addGrant(db, candidates[1].node, candidates[1].candidate, round, { suffix: "452-selected", selection: second });
  assert.equal(grant.amount, 1_200_000_000);
  db.close();
});

test("base and later same-identity Premium upgrade are exact allocator-only atomic grants", () => {
  const db = openLedger();
  const node = addNode(db, { suffix: "501" });
  const initial = addTier(db, node, { suffix: "501-none", tier: "None", observedAt: "2026-08-01T09:00:00.000Z" });
  const action = addAction(db, node, { suffix: "501-action" });
  const originRound = addFundingRound(db, "2026-08-02");
  const candidate = addCandidate(db, node, initial, { suffix: "501-daily", action, originalRound: originRound });
  sealFundingRound(db, originRound);
  const originEpoch = addDailyEpoch(db, originRound, { suffix: "501-origin" });
  const selection = addDailySelection(db, candidate, originRound, originEpoch, { suffix: "501" });

  assert.throws(
    () => addGrant(db, node, candidate, originRound, { suffix: "501-partial", amount: 1_199_999_999, selection }),
    /atomic base|tranche/,
  );
  const earlyPremium = addTier(db, node, { suffix: "501-premium-early", tier: "Premium", observedAt: "2026-08-01T11:00:00.000Z" });
  const premium = addTier(db, node, { suffix: "501-premium", tier: "Premium", observedAt: "2026-08-05T09:00:00.000Z" });
  const upgradeRound = addFundingRound(db, "2026-08-06");
  sealFundingRound(db, upgradeRound);
  assert.throws(
    () => addGrant(db, node, candidate, upgradeRound, {
      suffix: "501-bonus-without-base",
      tranche: "X_PREMIUM_UPGRADE_90",
      premium,
      selection,
      allocatedAt: "2026-08-06T00:00:00.000Z",
    }),
    /Premium-upgrade ancestry/,
  );

  const base = addGrant(db, node, candidate, originRound, { suffix: "501-base", selection });
  assert.equal(base.amount, 1_200_000_000);
  assert.throws(
    () => addGrant(db, node, candidate, originRound, {
      suffix: "501-upgrade-before-original-round",
      tranche: "X_PREMIUM_UPGRADE_90",
      premium: earlyPremium,
      selection,
      allocatedAt: "2026-08-02T12:00:00.000Z",
    }),
    /exact round|Premium-upgrade ancestry/,
  );

  const bonus = addGrant(db, node, candidate, upgradeRound, {
    suffix: "501-bonus",
    tranche: "X_PREMIUM_UPGRADE_90",
    premium,
    selection,
    allocatedAt: "2026-08-06T00:00:00.000Z",
  });
  assert.equal(bonus.amount, 10_800_000_000);
  assert.equal(db.prepare("SELECT eligibility_sequence FROM reward_v2_allocator_grants WHERE grant_id = ?").get(bonus.grantId).eligibility_sequence, Math.max(candidate.baseSequence, premium.sequence));

  const otherNode = addNode(db, { suffix: "502" });
  const otherPremium = addTier(db, otherNode, { suffix: "502-premium", tier: "Premium", observedAt: "2026-08-06T09:00:00.000Z" });
  const otherRound = addFundingRound(db, "2026-08-07");
  sealFundingRound(db, otherRound);
  assert.throws(
    () => addGrant(db, node, candidate, otherRound, {
      suffix: "501-wrong-identity",
      tranche: "X_PREMIUM_UPGRADE_90",
      premium: otherPremium,
      selection,
      allocatedAt: "2026-08-07T00:00:00.000Z",
    }),
    /FOREIGN KEY|same-identity|round|Premium-upgrade ancestry/,
  );

  const fullNode = addNode(db, { suffix: "503" });
  const fullTier = addTier(db, fullNode, { suffix: "503-premium", tier: "PremiumPlus", observedAt: "2026-08-08T09:00:00.000Z" });
  const fullAction = addAction(db, fullNode, {
    suffix: "503-action",
    effectiveAt: "2026-08-08T10:00:00.000Z",
    acceptedAt: "2026-08-08T10:00:01.000Z",
  });
  const fullRound = addFundingRound(db, "2026-08-09", "503-origin");
  const fullCandidate = addCandidate(db, fullNode, fullTier, {
    suffix: "503-daily",
    day: "2026-08-08",
    action: fullAction,
    originalRound: fullRound,
  });
  sealFundingRound(db, fullRound);
  const fullEpoch = addDailyEpoch(db, fullRound, { suffix: "503-origin" });
  const fullSelection = addDailySelection(db, fullCandidate, fullRound, fullEpoch, { suffix: "503" });
  assert.throws(
    () => addGrant(db, fullNode, fullCandidate, fullRound, { suffix: "503-base-forbidden", selection: fullSelection }),
    /atomic base|tranche/,
  );
  const full = addGrant(db, fullNode, fullCandidate, fullRound, {
    suffix: "503-full",
    tranche: "X_PREMIUM_FULL_100",
    selection: fullSelection,
  });
  assert.equal(full.amount, 12_000_000_000);
  assert.equal(db.prepare("SELECT tranche_basis_points FROM reward_v2_allocator_grants WHERE grant_id = ?").get(full.grantId).tranche_basis_points, 10_000);
  db.close();
});

test("UTC boundary nulls, no-retry exclusion, full receipts, expiry, and no recycling are enforced", () => {
  const db = openLedger();
  assert.throws(
    () => db.prepare(`
      INSERT INTO reward_v2_funding_rounds (
        funding_round_id, utc_day, opens_at_utc, miss_decidable_at_utc,
        funding_class, state, sealed_at_utc, candidate_snapshot_digest,
        lane_reservation_snapshot_digest, allocator_batch_digest,
        created_at_utc
      ) VALUES ('funding-v2-direct-terminal', '2026-07-31',
        '2026-07-31T00:00:00.000Z', '2026-07-31T00:00:01.000Z',
        'STANDARD_10_PERCENT_AND_X_CAMPAIGN', 'terminal',
        '2026-07-31T00:00:00.000Z', ?, ?, ?, '2026-07-30T00:00:00.000Z')
    `).run(digest("direct-terminal-candidates"), digest("direct-terminal-lanes"), digest("direct-terminal-batch")),
    /must begin collecting/,
  );
  const missedRound = addFundingRound(db, "2026-08-01", "missed-seal");
  assert.throws(
    () => db.prepare(`
      UPDATE reward_v2_funding_rounds
      SET state = 'null', null_reason = 'daily_unfulfilled_at_utc_boundary',
        nullified_at_utc = '2026-08-01T00:00:00.999Z'
      WHERE funding_round_id = ?
    `).run(missedRound.roundId),
    /miss-decidable/,
  );
  db.prepare(`
    UPDATE reward_v2_funding_rounds
    SET state = 'null', null_reason = 'daily_unfulfilled_at_utc_boundary',
      nullified_at_utc = '2026-08-01T00:00:01.000Z'
    WHERE funding_round_id = ?
  `).run(missedRound.roundId);
  assert.equal(db.prepare("SELECT state FROM reward_v2_funding_rounds WHERE funding_round_id = ?").get(missedRound.roundId).state, "null");

  const node = addNode(db, { suffix: "601" });
  const initial = addTier(db, node, { suffix: "601-none", tier: "Basic", observedAt: "2026-08-01T09:00:00.000Z" });
  const action = addAction(db, node, { suffix: "601-action" });
  const round = addFundingRound(db, "2026-08-02", "null-boundary");
  const candidate = addCandidate(db, node, initial, { suffix: "601-daily", action, originalRound: round });
  sealFundingRound(db, round);
  const epoch = addDailyEpoch(db, round, { suffix: "601-origin" });
  const selection = addDailySelection(db, candidate, round, epoch, { suffix: "601" });
  db.exec("BEGIN IMMEDIATE");
  assert.throws(
    () => addAllocatorReceipt(db, node, candidate, round, {
      suffix: "601-too-early",
      selection,
      decidedAt: "2026-08-02T00:00:00.999Z",
      disposition: "NULL_MISSED",
      nullReason: "daily_unfulfilled_at_utc_boundary",
    }),
    /miss-decidable|exact round/,
  );
  db.exec("ROLLBACK");
  addNullReceipt(db, node, candidate, round, { suffix: "601-boundary", selection });
  assert.throws(
    () => addGrant(db, node, candidate, round, { suffix: "601-retry", selection }),
    /nulled tranche|cannot be replaced|tranche keys/,
  );

  const paidNode = addNode(db, { suffix: "602" });
  const paidTier = addTier(db, paidNode, { suffix: "602-none", tier: "None", observedAt: "2026-08-02T09:00:00.000Z" });
  const paidAction = addAction(db, paidNode, { suffix: "602-action", effectiveAt: "2026-08-02T10:00:00.000Z", acceptedAt: "2026-08-02T10:00:01.000Z" });
  const paidRound = addFundingRound(db, "2026-08-03", "paid");
  const paidCandidate = addCandidate(db, paidNode, paidTier, { suffix: "602-daily", day: "2026-08-02", action: paidAction, originalRound: paidRound });
  sealFundingRound(db, paidRound);
  const paidEpoch = addDailyEpoch(db, paidRound, { suffix: "602-origin" });
  const paidSelection = addDailySelection(db, paidCandidate, paidRound, paidEpoch, { suffix: "602" });
  const grant = addGrant(db, paidNode, paidCandidate, paidRound, { suffix: "602-base", selection: paidSelection });
  assert.throws(
    () => db.prepare(`
      INSERT INTO reward_v2_terminal_receipts (
        terminal_receipt_id, grant_id, outcome, destination_wallet_address,
        amount_base_units, transaction_evidence_digest, terminal_at_utc,
        terminal_receipt_digest, retry_count, recycling_allowed
      ) VALUES ('terminal-v2-at-expiry', ?, 'paid_full', ?, ?, ?, ?, ?, 0, 0)
    `).run(grant.grantId, paidNode.wallet, grant.amount, digest("tx-at-expiry"), paidCandidate.expiresAt, digest("terminal-at-expiry")),
    /full payment/,
  );
  assert.throws(
    () => db.prepare(`
      INSERT INTO reward_v2_terminal_receipts (
        terminal_receipt_id, grant_id, outcome, destination_wallet_address,
        amount_base_units, transaction_evidence_digest, terminal_at_utc,
        terminal_receipt_digest, retry_count, recycling_allowed
      ) VALUES ('terminal-v2-partial', ?, 'paid_full', ?, ?, ?, ?, ?, 0, 0)
    `).run(grant.grantId, paidNode.wallet, grant.amount - 1, digest("tx-partial"), "2026-08-03T12:00:00.000Z", digest("terminal-partial")),
    /full payment/,
  );
  db.prepare(`
    INSERT INTO reward_v2_terminal_receipts (
      terminal_receipt_id, grant_id, outcome, destination_wallet_address,
      amount_base_units, transaction_evidence_digest, terminal_at_utc,
      terminal_receipt_digest, retry_count, recycling_allowed
    ) VALUES ('terminal-v2-paid', ?, 'paid_full', ?, ?, ?, ?, ?, 0, 0)
  `).run(grant.grantId, paidNode.wallet, grant.amount, digest("tx-paid"), "2026-08-03T12:00:00.000Z", digest("terminal-paid"));
  const allocatorBatchDigest = db.prepare("SELECT allocator_batch_digest FROM reward_v2_allocator_batches WHERE funding_round_id = ?").get(paidRound.roundId).allocator_batch_digest;
  db.prepare(`
    UPDATE reward_v2_funding_rounds
    SET state = 'allocator_recorded', allocator_batch_digest = ?
    WHERE funding_round_id = ?
  `).run(allocatorBatchDigest, paidRound.roundId);
  assert.throws(
    () => db.prepare("UPDATE reward_v2_funding_rounds SET allocator_batch_digest = ? WHERE funding_round_id = ?")
      .run(digest("mutated-terminal-batch"), paidRound.roundId),
    /immutable/,
  );
  db.prepare("UPDATE reward_v2_funding_rounds SET state = 'terminal' WHERE funding_round_id = ?").run(paidRound.roundId);
  assert.throws(
    () => db.prepare("UPDATE reward_v2_funding_rounds SET null_reason = 'policy_hold' WHERE funding_round_id = ?").run(paidRound.roundId),
    /terminal.*immutable/,
  );
  assert.throws(
    () => db.prepare("DELETE FROM reward_v2_terminal_receipts WHERE grant_id = ?").run(grant.grantId),
    /retried or recycled/,
  );
  db.close();
});

test("the standalone validator pins nonactivation and the complete schema contract", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(validatorUrl)], { encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /REWARD LEDGER V2 SCHEMA VALID/);
  assert.match(result.stdout, /without activation/);
});

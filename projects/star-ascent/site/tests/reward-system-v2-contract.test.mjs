import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import {
  buildDailyEpoch,
  buildGenesisRewardPlan,
  dailyLeafHash,
  dailySelectionScore,
  genesisLeafHash,
  policyHash,
  rewardTranches,
  verifyProof,
} from "../engagement/epoch-engine.mjs";
import { encodeBase58 } from "../engagement/solana-wallet-proof.mjs";
import {
  CLAIM_EXPIRY_DAYS,
  REWARD_CAPACITY_POLICY,
  REWARD_LANE_ORDER,
  REWARD_PRIORITY_CLASSES,
  UTC_DAY_SECONDS,
  X_BOUND_SOURCE_PRIORITY,
  X_TRANCHE_BASIS_POINTS,
  X_TRANCHE_KIND,
  buildXBoundFundingObligation,
  createCccPrecommitRegistrySnapshot,
  createXBoundReward,
  logicalMissedFundingOutcome,
  nextUtcMidnight,
  sealRewardCapacityRound,
  validateXBoundRewardReferenceState,
} from "../programs/iat_b3_reference/reward-capacity-waterfall.mjs";
import {
  createDailyLawState,
  createImmutableSchedule,
  createLockdownDecision,
  protocolLocalDay,
} from "../programs/iat_b3_reference/daily-lockdown-consensus.mjs";
import { sha256CanonicalJson } from "../scripts/iat-v2-canonical-json.mjs";

const SITE = fileURLToPath(new URL("../", import.meta.url));
const POLICY_PATH = join(SITE, "engagement", "reward-policy.v1.json");
const CAPACITY_POLICY_PATH = join(SITE, "docs", "b3", "iat-b3-reward-capacity-waterfall.v1.json");
const LEDGER_PATH = join(SITE, "engagement", "reward-ledger.v2.schema.sql");
const EPOCH_ENGINE_PATH = join(SITE, "engagement", "epoch-engine.mjs");
const CAPACITY_REFERENCE_PATH = join(SITE, "programs", "iat_b3_reference", "reward-capacity-waterfall.mjs");
const RECEIPT_CODEC_PATH = join(SITE, "programs", "iat_b3_reference", "reward-allocator-receipt-codec.mjs");
const RECEIPT_BOUNDARY_PATH = join(SITE, "docs", "b3", "REWARD_ALLOCATOR_RECEIPT_BOUNDARY.md");
const X_BOUND_STATE_INVARIANTS_PATH = join(SITE, "docs", "b3", "X_BOUND_REWARD_REFERENCE_STATE_INVARIANTS.md");

const offchainPolicy = JSON.parse(readFileSync(POLICY_PATH, "utf8"));
const capacityPolicy = JSON.parse(readFileSync(CAPACITY_POLICY_PATH, "utf8"));
const ledgerSchema = readFileSync(LEDGER_PATH, "utf8");
const epochEngineSource = readFileSync(EPOCH_ENGINE_PATH, "utf8");
const capacityReferenceSource = readFileSync(CAPACITY_REFERENCE_PATH, "utf8");
const receiptCodecSource = readFileSync(RECEIPT_CODEC_PATH, "utf8");
const receiptBoundarySource = readFileSync(RECEIPT_BOUNDARY_PATH, "utf8");
const xBoundStateInvariantsSource = readFileSync(X_BOUND_STATE_INVARIANTS_PATH, "utf8");

const EXACT_TRANCHE_KINDS = ["X_BASE_10", "X_PREMIUM_FULL_100", "X_PREMIUM_UPGRADE_90"];
const EXACT_TRANCHE_BASIS_POINTS = {
  X_BASE_10: 1_000,
  X_PREMIUM_FULL_100: 10_000,
  X_PREMIUM_UPGRADE_90: 9_000,
};
const EXACT_SOURCE_PRIORITY = {
  GENESIS_AIRDROP: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
  X_INTERACTION: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
  STANDARD_POSITION: "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
  CCC_AGENT: "CCC_AGENT",
  CCC_ASSOCIATE: "CCC_ASSOCIATE",
  FACTION_FOLLOWER: "WEEKLY_FACTION",
};
const EXACT_PRIORITY_CLASSES = [
  "CCC_AGENT",
  "CCC_ASSOCIATE",
  "STANDARD_10_PERCENT_AND_X_CAMPAIGN",
  "WEEKLY_FACTION",
  "CORE",
];
const EXACT_LANE_ORDER = ["treasury", "ecosystem", "liquidity"];
const HOLD = "HOLD_PENDING_GLOBAL_REWARD_WATERFALL";
const DAY_MILLISECONDS = 86_400_000;
const DAILY_EPOCH = "2026-08-02";
const DAILY_ROUND_AT = "2026-08-03T00:00:00.000Z";
const GENESIS_SNAPSHOT_AT = "2026-08-03T12:00:00.000Z";
const GENESIS_ROUND_AT = "2026-08-04T00:00:00.000Z";
const SNAPSHOT_DIGEST = "ab".repeat(32);
const FINALIZED_SLOT_HASH = "cd".repeat(32);
const GENESIS_SNAPSHOT_DIGEST = "12".repeat(32);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const unixSeconds = (value) => BigInt(Date.parse(value) / 1_000);
const walletFor = (value) => {
  const bytes = Buffer.alloc(32);
  bytes[0] = 1;
  bytes.writeUInt32BE(value, 28);
  return encodeBase58(bytes);
};

const LOCAL_0001_UTC = 1_786_050_060n;
const TEST_SCHEDULE = createImmutableSchedule({
  genesisHeight: 0n,
  genesisNominalUnixSeconds: LOCAL_0001_UTC - 86_520n,
  nominalBlockSeconds: 1n,
  networkId: "iat-b3-testnet-1",
});
const OPEN_DAILY_LAW = createDailyLawState({
  protocolHeight: 86_520n,
  schedule: TEST_SCHEDULE,
  currentDecision: createLockdownDecision({
    localDay: protocolLocalDay(LOCAL_0001_UTC),
    randomnessOutputHex: "00".repeat(32),
    schedule: TEST_SCHEDULE,
  }),
});

const dailyRow = Object.freeze({
  wallet: walletFor(701),
  xUserId: "9000000000000701",
  xAccountCreatedAtUtc: new Date(Date.parse(DAILY_ROUND_AT) - 41 * DAY_MILLISECONDS).toISOString(),
  oauthVerified: true,
  walletSignatureVerified: true,
  countryCode: "US",
  subscriptionType: "Basic",
  subscriptionObservedAtUtc: "2026-08-02T23:00:00.000Z",
  verified: false,
  nodeHistoryStartSlot: "4000701",
  activityStartSlot: "5000701",
  actionType: "original",
  actionId: "7000000000000701",
  actorXUserId: "9000000000000701",
  xPostCreatedAtUtc: "2026-08-02T12:00:00.000Z",
  canonicalCampaignTargetId: "8000000000000701",
  canonicalCampaignTargetEvidenceSha256: "ef".repeat(32),
});

const genesisRow = Object.freeze({
  wallet: walletFor(702),
  xUserId: "9000000000000702",
  xAccountCreatedAtUtc: new Date(Date.parse(GENESIS_ROUND_AT) - 41 * DAY_MILLISECONDS).toISOString(),
  oauthVerified: true,
  walletSignatureVerified: true,
  countryCode: "TR",
  subscriptionType: "PremiumPlus",
  subscriptionObservedAtUtc: "2026-08-03T23:00:00.000Z",
  verified: false,
  bindingReservationSequence: "1",
  bindingReservedAtUtc: "2026-08-03T11:00:00.000Z",
  bindingReservationReceiptSha256: "34".repeat(32),
  designatedFundingRoundAtUtc: GENESIS_ROUND_AT,
  activityStartSlot: "5000702",
  nodeHistoryStartSlot: "4000702",
});

function buildHeldPlans() {
  const daily = buildDailyEpoch({
    epoch: DAILY_EPOCH,
    mint: "MINT_PUBLISHED_ONLY_AFTER_INDEPENDENT_VERIFICATION",
    policy: offchainPolicy,
    snapshotDigest: SNAPSHOT_DIGEST,
    finalizedSlotHash: FINALIZED_SLOT_HASH,
    snapshotAtUtc: DAILY_ROUND_AT,
    rows: [dailyRow],
    publishedEpochs: 0,
    consumedLifetimeBaseUnits: "0",
  });
  const genesis = buildGenesisRewardPlan({
    mint: "MINT_PUBLISHED_ONLY_AFTER_INDEPENDENT_VERIFICATION",
    policy: offchainPolicy,
    bindingSnapshotDigest: GENESIS_SNAPSHOT_DIGEST,
    reservationSnapshotAtUtc: GENESIS_SNAPSHOT_AT,
    fundingRoundAtUtc: GENESIS_ROUND_AT,
    rows: [genesisRow],
  });
  return { daily, genesis };
}

const PLAN_SOURCE = Object.freeze({
  "star-ascent-daily-reward-plan/v2": "X_INTERACTION",
  "star-ascent-genesis-reward-plan/v2": "GENESIS_AIRDROP",
});

const COMMON_ADAPTER_FIELDS = Object.freeze([
  "claimId",
  "rewardSourceKind",
  "policyHash",
  "policyVersion",
  "wallet",
  "xUserId",
  "countryCode",
  "subscriptionType",
  "subscriptionObservedAtUtc",
  "candidateCommitmentSha256",
  "activityStartSlot",
  "nodeHistoryStartSlot",
  "nominalAmountBaseUnits",
  "amountBaseUnits",
  "basisPoints",
  "trancheKind",
  "rewardClass",
  "admissionRoundAtUtc",
  "expiresAtUtc",
  "rewardLineage",
  "rewardLineageDigest",
  "status",
  "admitted",
  "reserved",
  "publicationAllowed",
  "leaf",
  "merkleProof",
]);

function requireContract(condition, message) {
  if (!condition) throw new Error(`HELD_CLAIM_CONTRACT: ${message}`);
}

function expectedNominalAmount(sourceKind) {
  const displayUnits = sourceKind === "GENESIS_AIRDROP"
    ? offchainPolicy.genesis.rewardDisplayUnits
    : offchainPolicy.daily.rewardDisplayUnits;
  return (BigInt(displayUnits) * (10n ** BigInt(offchainPolicy.asset.decimals))).toString();
}

function verifySourceEvidence({ plan, claim, sourceKind, trustedSubscriptionType }) {
  if (sourceKind === "X_INTERACTION") {
    for (const field of [
      "actionType",
      "actionId",
      "actorXUserId",
      "actionEvidenceAtUtc",
      "canonicalActionKey",
      "actionEvidenceSha256",
      "snapshotDigest",
      "finalizedSlotHash",
      "canonicalCampaignTargetId",
      "canonicalCampaignTargetEvidenceSha256",
    ]) requireContract(Object.hasOwn(claim, field), `daily claim is missing ${field}`);
    const evidence = sha256([
      "star-ascent/x-action-evidence/v2",
      offchainPolicy.schema,
      plan.epoch,
      plan.snapshotAtUtc,
      plan.snapshotDigest,
      plan.finalizedSlotHash,
      claim.actorXUserId,
      claim.actionType,
      claim.actionId,
      claim.actionEvidenceAtUtc,
      claim.activityStartSlot,
      claim.nodeHistoryStartSlot,
      claim.canonicalCampaignTargetId,
      claim.canonicalCampaignTargetEvidenceSha256,
    ].join("|"));
    requireContract(evidence === claim.actionEvidenceSha256, "daily action evidence commitment mismatch");
    return {
      sourceRoundKey: plan.epoch,
      sourceRoundAtUtc: plan.snapshotAtUtc,
      sourceSnapshotDigest: plan.snapshotDigest,
      sourceFinalizedSlotHash: plan.finalizedSlotHash,
      sourceEvidenceDigest: evidence,
    };
  }

  for (const field of [
    "bindingReservationSequence",
    "bindingReservedAtUtc",
    "bindingReservationReceiptSha256",
    "bindingEvidenceSha256",
    "reservationRank",
  ]) requireContract(Object.hasOwn(claim, field), `Genesis claim is missing ${field}`);
  const evidence = sha256([
    "star-ascent/genesis-binding-evidence/v2",
    offchainPolicy.schema,
    plan.bindingSnapshotDigest,
    claim.bindingReservationSequence,
    claim.bindingReservedAtUtc,
    claim.bindingReservationReceiptSha256,
    plan.fundingRoundAtUtc,
    claim.xUserId,
    claim.wallet,
    claim.countryCode,
    trustedSubscriptionType,
    claim.subscriptionObservedAtUtc,
    claim.activityStartSlot,
    claim.nodeHistoryStartSlot,
  ].join("|"));
  requireContract(evidence === claim.bindingEvidenceSha256, "Genesis binding evidence commitment mismatch");
  return {
    sourceRoundKey: "GENESIS",
    sourceRoundAtUtc: plan.fundingRoundAtUtc,
    sourceSnapshotDigest: plan.bindingSnapshotDigest,
    sourceFinalizedSlotHash: null,
    sourceEvidenceDigest: evidence,
  };
}

function testOnlyAuthenticatedProjection({ plan, claim, authenticatedTierLookup }) {
  const sourceKind = PLAN_SOURCE[plan?.schema];
  requireContract(sourceKind !== undefined, "unknown held plan schema");
  requireContract(plan.status === HOLD && plan.publicationAllowed === false, "plan is not held");
  requireContract(plan.globalRewardWaterfall?.implemented === false, "plan bypasses the global waterfall hold");
  requireContract(plan.policyHash === policyHash(offchainPolicy), "plan policy digest mismatch");

  for (const field of COMMON_ADAPTER_FIELDS) {
    requireContract(Object.hasOwn(claim, field), `claim is missing ${field}`);
  }
  const heldClaim = plan.immediateClaims.find(({ claimId }) => claimId === claim.claimId);
  requireContract(heldClaim !== undefined, "claim is absent from the authenticated held plan");
  requireContract(
    sha256CanonicalJson(heldClaim) === sha256CanonicalJson(claim),
    "caller claim differs from the authenticated held-plan record",
  );
  requireContract(claim.status === HOLD, "claim is not held");
  requireContract(claim.admitted === false && claim.reserved === false && claim.publicationAllowed === false, "claim is activating");
  requireContract(claim.rewardSourceKind === sourceKind, "caller-selected reward source differs from plan schema");
  requireContract(claim.policyVersion === offchainPolicy.schema && claim.policyHash === plan.policyHash, "claim policy binding mismatch");

  const tier = authenticatedTierLookup({
    immutableXUserId: claim.xUserId,
    observedAtUtc: claim.subscriptionObservedAtUtc,
  });
  requireContract(tier !== null, "authenticated tier observation is absent");
  requireContract(tier.subscriptionType === claim.subscriptionType, "caller-selected tier differs from authenticated observation");
  requireContract(tier.observedAtUtc === claim.subscriptionObservedAtUtc, "tier observation timestamp mismatch");

  const grossBaseUnits = expectedNominalAmount(sourceKind);
  const tranches = rewardTranches({
    nominalAmountBaseUnits: grossBaseUnits,
    subscriptionType: tier.subscriptionType,
    payoutTiers: offchainPolicy.payoutTiers,
  });
  const priorityClass = X_BOUND_SOURCE_PRIORITY[sourceKind];
  requireContract(priorityClass === capacityPolicy.xBoundRewards.sourceKindPriorityMap[sourceKind], "source-to-class map drifted");
  requireContract(claim.rewardClass === priorityClass, "caller-selected reward class differs from source-derived class");
  requireContract(claim.nominalAmountBaseUnits === grossBaseUnits, "caller-selected gross amount differs from policy-derived amount");
  requireContract(claim.amountBaseUnits === tranches.immediateAmountBaseUnits, "immediate amount differs from exact tier math");
  requireContract(claim.basisPoints === tranches.immediateBasisPoints, "basis points differ from exact tier math");
  requireContract(claim.trancheKind === tranches.immediateTrancheKind, "tranche kind differs from exact tier math");

  const source = verifySourceEvidence({
    plan,
    claim,
    sourceKind,
    trustedSubscriptionType: tier.subscriptionType,
  });
  const expectedCandidateCommitment = sha256([
    "star-ascent/x-reward-candidate/v2",
    sourceKind,
    offchainPolicy.schema,
    source.sourceRoundKey,
    source.sourceRoundAtUtc,
    source.sourceSnapshotDigest,
    source.sourceFinalizedSlotHash ?? "NONE",
    source.sourceEvidenceDigest,
    claim.xUserId,
    claim.wallet,
  ].join("|"));
  requireContract(claim.candidateCommitmentSha256 === expectedCandidateCommitment, "candidate commitment mismatch");

  const expiresAtUtc = new Date(Date.parse(source.sourceRoundAtUtc) + 30 * DAY_MILLISECONDS).toISOString();
  requireContract(claim.admissionRoundAtUtc === source.sourceRoundAtUtc, "admission round mismatch");
  requireContract(claim.expiresAtUtc === expiresAtUtc, "claim does not retain the exact 30-day expiry");
  const expectedClaimId = sha256([
    "star-ascent/x-original-claim-plan/v2",
    sourceKind,
    expectedCandidateCommitment,
    grossBaseUnits,
    tranches.immediateAmountBaseUnits,
    tranches.immediateBasisPoints,
    tranches.immediateTrancheKind,
    source.sourceRoundAtUtc,
    expiresAtUtc,
    plan.policyHash,
  ].join("|"));
  requireContract(claim.claimId === expectedClaimId, "original claim commitment mismatch");

  const lineage = claim.rewardLineage;
  requireContract(lineage?.schema === "star-ascent-x-reward-lineage/v2", "typed reward lineage is absent");
  requireContract(sha256CanonicalJson(lineage) === claim.rewardLineageDigest, "reward lineage digest mismatch");
  for (const [actual, expected, label] of [
    [lineage.rewardSourceKind, sourceKind, "lineage source"],
    [lineage.policyVersion, offchainPolicy.schema, "lineage policy version"],
    [lineage.policyHash, plan.policyHash, "lineage policy hash"],
    [lineage.sourceRoundKey, source.sourceRoundKey, "lineage source round key"],
    [lineage.sourceRoundAtUtc, source.sourceRoundAtUtc, "lineage source round"],
    [lineage.sourceSnapshotDigest, source.sourceSnapshotDigest, "lineage source snapshot"],
    [lineage.sourceFinalizedSlotHash, source.sourceFinalizedSlotHash, "lineage finalized slot"],
    [lineage.sourceEvidenceDigest, source.sourceEvidenceDigest, "lineage source evidence"],
    [lineage.candidateCommitmentSha256, expectedCandidateCommitment, "lineage candidate"],
    [lineage.originalImmediateClaimId, expectedClaimId, "lineage original claim"],
    [lineage.wallet, claim.wallet, "lineage wallet"],
    [lineage.xUserId, claim.xUserId, "lineage X ID"],
    [lineage.originalSubscriptionType, tier.subscriptionType, "lineage tier"],
    [lineage.originalSubscriptionObservedAtUtc, tier.observedAtUtc, "lineage tier observation"],
    [lineage.activityStartSlot, claim.activityStartSlot, "lineage activity sequence"],
    [lineage.nodeHistoryStartSlot, claim.nodeHistoryStartSlot, "lineage node sequence"],
    [lineage.nominalAmountBaseUnits, grossBaseUnits, "lineage gross"],
    [lineage.immediateAmountBaseUnits, tranches.immediateAmountBaseUnits, "lineage immediate amount"],
    [lineage.immediateBasisPoints, tranches.immediateBasisPoints, "lineage immediate basis points"],
    [lineage.immediateTrancheKind, tranches.immediateTrancheKind, "lineage immediate kind"],
    [lineage.deferredAmountBaseUnits, tranches.deferredAmountBaseUnits, "lineage deferred amount"],
    [lineage.deferredBasisPoints, tranches.deferredBasisPoints, "lineage deferred basis points"],
    [lineage.deferredTrancheKind, tranches.deferredTrancheKind, "lineage deferred kind"],
    [lineage.expiresAtUtc, expiresAtUtc, "lineage expiry"],
  ]) requireContract(actual === expected, `${label} mismatch`);

  const expectedLeaf = sourceKind === "X_INTERACTION"
    ? dailyLeafHash({
      rewardSourceKind: sourceKind,
      epoch: plan.epoch,
      wallet: claim.wallet,
      xUserId: claim.xUserId,
      actionEvidenceSha256: claim.actionEvidenceSha256,
      amountBaseUnits: claim.amountBaseUnits,
      trancheKind: claim.trancheKind,
      policyHash: plan.policyHash,
    })
    : genesisLeafHash({
      fundingRoundAtUtc: plan.fundingRoundAtUtc,
      wallet: claim.wallet,
      xUserId: claim.xUserId,
      bindingEvidenceSha256: claim.bindingEvidenceSha256,
      amountBaseUnits: claim.amountBaseUnits,
      trancheKind: claim.trancheKind,
      policyHash: plan.policyHash,
    });
  requireContract(expectedLeaf === claim.leaf, "claim leaf mismatch");
  requireContract(
    verifyProof({ leaf: claim.leaf, proof: claim.merkleProof, root: plan.candidateMerkleRoot }),
    "claim is absent from the held-plan Merkle root",
  );

  return createXBoundReward({
    dailyLawState: OPEN_DAILY_LAW,
    rewardId: claim.claimId,
    rewardSourceKind: sourceKind,
    wallet: claim.wallet,
    xUserId: claim.xUserId,
    grossBaseUnits: BigInt(grossBaseUnits),
    epochClosedAtUnixSeconds: unixSeconds(source.sourceRoundAtUtc),
    subscriptionType: tier.subscriptionType,
    subscriptionObservedAtUnixSeconds: unixSeconds(tier.observedAtUtc),
    activityQualificationSequence: BigInt(claim.activityStartSlot),
    nodeActivationSequence: BigInt(claim.nodeHistoryStartSlot),
  });
}

function immutableTierLookup(records) {
  const observations = new Map(records.map((record) => [
    `${record.immutableXUserId}|${record.observedAtUtc}`,
    Object.freeze({ ...record }),
  ]));
  return ({ immutableXUserId, observedAtUtc }) => observations.get(`${immutableXUserId}|${observedAtUtc}`) ?? null;
}

function textFilesUnder(root) {
  const extensions = new Set([".cjs", ".js", ".json", ".mjs", ".rs", ".sql", ".toml", ".ts", ".tsx"]);
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (extensions.has(entry.name.slice(entry.name.lastIndexOf(".")))) files.push(path);
    }
  };
  visit(root);
  return files;
}

test("the offchain policy, capacity policy, ledger blueprint, and executable exports pin one exact reward contract", () => {
  assert.deepEqual(Object.values(offchainPolicy.payoutTiers.trancheKinds), EXACT_TRANCHE_KINDS);
  assert.deepEqual(offchainPolicy.payoutTiers.trancheBasisPoints, EXACT_TRANCHE_BASIS_POINTS);
  assert.deepEqual(capacityPolicy.xBoundRewards.trancheKinds, EXACT_TRANCHE_KINDS);
  assert.deepEqual(capacityPolicy.xBoundRewards.trancheBasisPoints, EXACT_TRANCHE_BASIS_POINTS);
  assert.deepEqual(Object.values(X_TRANCHE_KIND), EXACT_TRANCHE_KINDS);
  assert.deepEqual(X_TRANCHE_BASIS_POINTS, EXACT_TRANCHE_BASIS_POINTS);

  const sqlTrancheKinds = [...new Set(ledgerSchema.match(/\bX_[A-Z0-9_]+\b/gu))];
  assert.deepEqual(sqlTrancheKinds, EXACT_TRANCHE_KINDS);
  assert.match(ledgerSchema, /\(tranche_kind = 'X_BASE_10' AND tranche_basis_points = 1000\)[\s\S]*\(tranche_kind = 'X_PREMIUM_FULL_100' AND tranche_basis_points = 10000\)[\s\S]*\(tranche_kind = 'X_PREMIUM_UPGRADE_90' AND tranche_basis_points = 9000\)/u);

  assert.deepEqual(capacityPolicy.xBoundRewards.sourceKindPriorityMap, EXACT_SOURCE_PRIORITY);
  assert.deepEqual(X_BOUND_SOURCE_PRIORITY, EXACT_SOURCE_PRIORITY);
  assert.deepEqual(capacityPolicy.capacity.priorityClasses, EXACT_PRIORITY_CLASSES);
  assert.deepEqual(REWARD_PRIORITY_CLASSES, EXACT_PRIORITY_CLASSES);
  assert.deepEqual(capacityPolicy.capacity.physicalRewardLanes, EXACT_LANE_ORDER);
  assert.deepEqual(REWARD_LANE_ORDER, EXACT_LANE_ORDER);
  assert.match(ledgerSchema, /funding_class TEXT NOT NULL\s+CHECK \(funding_class = 'STANDARD_10_PERCENT_AND_X_CAMPAIGN'\)/u);

  assert.equal(offchainPolicy.payoutTiers.deferredEntitlementExpiryDays, 30);
  assert.equal(offchainPolicy.daily.claimExpiryDays, 30);
  assert.equal(capacityPolicy.xBoundRewards.claimExpiryDays, 30);
  assert.equal(CLAIM_EXPIRY_DAYS, 30n);
  assert.equal(UTC_DAY_SECONDS, 86_400n);
  assert.match(ledgerSchema, /unixepoch\(claim_expires_at_utc\) = unixepoch\(original_funding_round_at_utc\) \+ 2592000/u);

  assert.equal(offchainPolicy.budget.oversubscriptionRule, "IAT_DAILY_BUDGET_V1_ASCENDING_SHA256");
  assert.deepEqual(offchainPolicy.budget.oversubscriptionInputs, [
    "closed UTC epoch",
    "canonical candidate snapshot SHA-256",
    "predeclared finalized Solana slot hash after snapshot",
    "immutable X user ID",
    "wallet",
  ]);
  assert.match(ledgerSchema, /selection_algorithm = 'IAT_DAILY_BUDGET_V1_ASCENDING_SHA256'/u);
  assert.match(ledgerSchema, /selection_domain = 'IAT_DAILY_BUDGET_V1'/u);
  const expectedScore = sha256(`IAT_DAILY_BUDGET_V1|${DAILY_EPOCH}|${SNAPSHOT_DIGEST}|${FINALIZED_SLOT_HASH}|${dailyRow.xUserId}|${dailyRow.wallet}`);
  assert.equal(dailySelectionScore({
    epoch: DAILY_EPOCH,
    snapshotDigest: SNAPSHOT_DIGEST,
    finalizedSlotHash: FINALIZED_SLOT_HASH,
    xUserId: dailyRow.xUserId,
    wallet: dailyRow.wallet,
  }), expectedScore);

  assert.equal(offchainPolicy.status, HOLD);
  assert.equal(offchainPolicy.publicationAllowed, false);
  assert.equal(offchainPolicy.globalRewardWaterfall.implemented, false);
  assert.equal(offchainPolicy.globalRewardWaterfall.publicationAllowed, false);
  assert.equal(capacityPolicy.status, "REFERENCE_ONLY_BLOCKED_NON_ACTIVATING");
  assert.equal(capacityPolicy.activationReady, false);
  assert.equal(capacityPolicy.directApplicationPermitted, false);
  assert.equal(capacityPolicy.runtimeDependency, false);
  assert.deepEqual(REWARD_CAPACITY_POLICY, capacityPolicy);

  const database = new DatabaseSync(":memory:");
  try {
    database.exec(ledgerSchema);
    assert.deepEqual(
      { ...database.prepare("SELECT status, runtime_wiring_allowed, migration_path_present, global_allocator_present FROM reward_v2_blueprint_guard WHERE singleton_id = 1").get() },
      {
        status: "BLUEPRINT_ONLY_NON_ACTIVATING",
        runtime_wiring_allowed: 0,
        migration_path_present: 0,
        global_allocator_present: 0,
      },
    );
  } finally {
    database.close();
  }
});

test("real held Daily and Genesis claims are complete authenticated inputs without caller-selected source, class, amount, or tier", () => {
  const { daily, genesis } = buildHeldPlans();
  const tierLookup = immutableTierLookup([
    {
      immutableXUserId: dailyRow.xUserId,
      observedAtUtc: dailyRow.subscriptionObservedAtUtc,
      subscriptionType: dailyRow.subscriptionType,
      observationEvidenceDigest: "56".repeat(32),
    },
    {
      immutableXUserId: genesisRow.xUserId,
      observedAtUtc: genesisRow.subscriptionObservedAtUtc,
      subscriptionType: genesisRow.subscriptionType,
      observationEvidenceDigest: "78".repeat(32),
    },
  ]);
  const dailyClaim = daily.immediateClaims[0];
  const genesisClaim = genesis.immediateClaims[0];
  const dailyCapacityReward = testOnlyAuthenticatedProjection({ plan: daily, claim: dailyClaim, authenticatedTierLookup: tierLookup });
  const genesisCapacityReward = testOnlyAuthenticatedProjection({ plan: genesis, claim: genesisClaim, authenticatedTierLookup: tierLookup });
  assert.equal(validateXBoundRewardReferenceState(dailyCapacityReward), dailyCapacityReward);
  assert.equal(validateXBoundRewardReferenceState(genesisCapacityReward), genesisCapacityReward);

  assert.equal(dailyCapacityReward.rewardSourceKind, "X_INTERACTION");
  assert.equal(dailyCapacityReward.priorityClass, "STANDARD_10_PERCENT_AND_X_CAMPAIGN");
  assert.equal(dailyCapacityReward.grossBaseUnits, 12_000_000_000n);
  assert.equal(dailyCapacityReward.initialSubscriptionType, "Basic");
  assert.equal(dailyCapacityReward.premiumProofAcceptedAtUnixSeconds, null);
  assert.equal(dailyCapacityReward.baseTranche.kind, "X_BASE_10");
  assert.equal(dailyCapacityReward.baseTranche.amount, 1_200_000_000n);
  assert.equal(dailyCapacityReward.upgradeTranche.kind, "X_PREMIUM_UPGRADE_90");
  assert.equal(dailyCapacityReward.upgradeTranche.amount, 10_800_000_000n);
  assert.equal(dailyCapacityReward.claimExpiresAtUnixSeconds - dailyCapacityReward.epochClosedAtUnixSeconds, 30n * UTC_DAY_SECONDS);

  assert.equal(genesisCapacityReward.rewardSourceKind, "GENESIS_AIRDROP");
  assert.equal(genesisCapacityReward.priorityClass, "STANDARD_10_PERCENT_AND_X_CAMPAIGN");
  assert.equal(genesisCapacityReward.grossBaseUnits, 100_000_000_000n);
  assert.equal(genesisCapacityReward.initialSubscriptionType, "PremiumPlus");
  assert.equal(genesisCapacityReward.premiumProofAcceptedAtUnixSeconds, genesisCapacityReward.epochClosedAtUnixSeconds);
  assert.equal(genesisCapacityReward.baseTranche, null);
  assert.equal(genesisCapacityReward.premiumFullTranche.kind, "X_PREMIUM_FULL_100");
  assert.equal(genesisCapacityReward.premiumFullTranche.amount, 100_000_000_000n);
  assert.equal(genesisCapacityReward.upgradeTranche, null);

  for (const forged of [
    { ...dailyClaim, rewardSourceKind: "CCC_AGENT" },
    { ...dailyClaim, rewardClass: "CORE" },
    { ...dailyClaim, nominalAmountBaseUnits: "120000000000" },
    { ...dailyClaim, subscriptionType: "Premium" },
  ]) {
    assert.throws(
      () => testOnlyAuthenticatedProjection({ plan: daily, claim: forged, authenticatedTierLookup: tierLookup }),
      /HELD_CLAIM_CONTRACT/u,
    );
  }
});

test("the round contract seals only at exact 00:00 UTC and makes an absent seal null only at boundary plus one second", () => {
  assert.equal(capacityPolicy.roundSealing.sealedAtMustEqualFundingRound, true);
  assert.equal(capacityPolicy.roundSealing.missDecidableAtRule, "FUNDING_ROUND_PLUS_ONE_SECOND_EARLIEST");
  assert.equal(capacityPolicy.roundSealing.allocationExecutionDelayChangesSealedResult, false);
  assert.match(ledgerSchema, /substr\(opens_at_utc, 12\) = '00:00:00\.000Z'/u);
  assert.match(ledgerSchema, /unixepoch\(miss_decidable_at_utc\) = unixepoch\(opens_at_utc\) \+ 1/u);
  assert.match(ledgerSchema, /sealed_at_utc = opens_at_utc/u);

  const { daily } = buildHeldPlans();
  const tierLookup = immutableTierLookup([{
    immutableXUserId: dailyRow.xUserId,
    observedAtUtc: dailyRow.subscriptionObservedAtUtc,
    subscriptionType: dailyRow.subscriptionType,
    observationEvidenceDigest: "56".repeat(32),
  }]);
  const reward = testOnlyAuthenticatedProjection({
    plan: daily,
    claim: daily.immediateClaims[0],
    authenticatedTierLookup: tierLookup,
  });
  const fundingRound = reward.epochClosedAtUnixSeconds;
  const obligation = buildXBoundFundingObligation({ reward, fundingRoundAtUnixSeconds: fundingRound });
  const ledgerSnapshot = {
    lanes: Object.fromEntries(EXACT_LANE_ORDER.map((lane) => [lane, {
      unlocked: lane === "treasury" ? reward.grossBaseUnits : 0n,
      reserved: 0n,
      paid: 0n,
      withdrawn: 0n,
    }])),
  };
  const cccPrecommitRegistrySnapshot = createCccPrecommitRegistrySnapshot({
    fundingRoundAtUnixSeconds: fundingRound,
    commitments: [],
  });

  assert.equal(nextUtcMidnight(fundingRound - 1n), fundingRound);
  assert.throws(() => sealRewardCapacityRound({
    dailyLawState: OPEN_DAILY_LAW,
    fundingRoundAtUnixSeconds: fundingRound,
    sealedAtUnixSeconds: fundingRound + 1n,
    obligations: [obligation],
    ledgerSnapshot,
    cccPrecommitRegistrySnapshot,
  }), /MUST_SEAL_AT_DESIGNATED_UTC_BOUNDARY/u);
  const sealed = sealRewardCapacityRound({
    dailyLawState: OPEN_DAILY_LAW,
    fundingRoundAtUnixSeconds: fundingRound,
    sealedAtUnixSeconds: fundingRound,
    obligations: [obligation],
    ledgerSnapshot,
    cccPrecommitRegistrySnapshot,
  });
  assert.equal(sealed.roundSeal.sealedAtUnixSeconds, fundingRound);
  assert.throws(
    () => logicalMissedFundingOutcome(obligation, { nowUnixSeconds: fundingRound }),
    /FUNDING_ROUND_NOT_YET_DECIDABLE/u,
  );
  const missed = logicalMissedFundingOutcome(obligation, { nowUnixSeconds: fundingRound + 1n });
  assert.equal(missed.disposition, "NULL_MISSED");
  assert.equal(missed.missDecidableAtUnixSeconds, fundingRound + 1n);
});

test("the ledger and allocator remain static reference artifacts with no runtime import, migration, or publication wiring", () => {
  assert.match(epochEngineSource, /const DAILY_HOLD = "HOLD_PENDING_GLOBAL_REWARD_WATERFALL"/u);
  assert.doesNotMatch(epochEngineSource, /reward-capacity-waterfall|reward-ledger\.v2/u);
  assert.match(capacityReferenceSource, /status: "NON_ACTIVATING_REFERENCE_RECEIPT"/u);
  assert.match(capacityReferenceSource, /activationReady: false/u);
  assert.match(capacityReferenceSource, /NON_ACTIVATING_UNAUTHENTICATED_REFERENCE_LINEAGE/u);
  assert.match(capacityReferenceSource, /deriveAllocatorReceiptLineage/u);
  assert.doesNotMatch(capacityReferenceSource, /engagement\/epoch-engine|engagement\/reward-policy|reward-ledger\.v2/u);
  assert.match(receiptCodecSource, /IAT_B3_DEPLOYMENT_DOMAIN_UNFROZEN_V1/u);
  assert.match(receiptCodecSource, /ALLOCATOR_BATCH_TRANSCRIPT_LENGTH = 320/u);
  assert.match(receiptCodecSource, /ALLOCATOR_RECEIPT_TRANSCRIPT_LENGTH = 288/u);
  assert.doesNotMatch(receiptCodecSource, /node:fs|node:http|node:https|fetch\(|AccountInfo|invoke\(/u);
  assert.match(receiptBoundarySource, /not an\s+authenticated allocator/u);
  assert.match(receiptBoundarySource, /not a one-to-one persistence contract/u);
  assert.match(receiptBoundarySource, /Mainnet remains HOLD/u);
  assert.match(xBoundStateInvariantsSource, /non-activating reference contract/u);
  assert.match(xBoundStateInvariantsSource, /does not define an account codec/u);
  assert.match(xBoundStateInvariantsSource, /initial-tier|Premium-at-qualification sequence model/iu);
  assert.match(xBoundStateInvariantsSource, /authenticated X-tier and wallet-binding evidence/u);
  assert.match(capacityReferenceSource, /premiumProofAcceptedAtUnixSeconds/u);
  assert.match(capacityReferenceSource, /upgradeRound !== nextUtcMidnight\(acceptedAt\)/u);
  assert.match(ledgerSchema, /Blueprint only\. No active route, migration, allocator, signer, or transfer path/u);
  assert.doesNotMatch(ledgerSchema, /ATTACH DATABASE|load_extension|http:|https:/iu);

  const runtimeRoots = [
    "app",
    "worker",
    "db",
    "drizzle",
    "launch",
    join("programs", "iat_b3_consensus"),
    join("programs", "iat_b3_economy"),
    join("programs", "iat_b3_law"),
    join("programs", "iat_b3_vault"),
    join("programs", "iat_v2"),
  ];
  const forbiddenRuntimeWiring = /iat_b3_reference|reward-capacity-waterfall|reward-ledger\.v2|reward_v2_|engagement[\\/]epoch-engine|engagement[\\/]reward-policy\.v1/u;
  for (const root of runtimeRoots) {
    const runtimeRoot = join(SITE, root);
    if (!existsSync(runtimeRoot)) continue;
    for (const file of textFilesUnder(runtimeRoot)) {
      assert.doesNotMatch(
        readFileSync(file, "utf8"),
        forbiddenRuntimeWiring,
        `${relative(SITE, file)} must not wire the non-activating reward references into runtime`,
      );
    }
  }

  for (const config of ["drizzle.config.ts", "next.config.ts", "vite.config.ts"]) {
    assert.doesNotMatch(readFileSync(join(SITE, config), "utf8"), forbiddenRuntimeWiring, `${config} must not wire reward v2`);
  }
  const productionScripts = JSON.parse(readFileSync(join(SITE, "package.json"), "utf8")).scripts;
  for (const name of ["predev", "dev", "prebuild", "build", "postbuild", "start", "db:generate"]) {
    assert.doesNotMatch(productionScripts[name] ?? "", forbiddenRuntimeWiring, `${name} must not activate reward v2`);
  }
});

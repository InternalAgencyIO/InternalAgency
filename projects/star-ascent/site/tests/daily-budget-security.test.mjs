import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildDailyEpoch,
  buildEpoch,
  buildGenesisRewardPlan,
  dailySelectionPriority,
  dailySelectionScore,
  leafHash,
  policyHash,
  resolveDeferredPremiumEntitlement,
  rewardTranches,
  selectDailyBudgetWinners,
  selectGenesisRewardCandidates,
  validateRows,
  verifyProof,
} from "../engagement/epoch-engine.mjs";
import { encodeBase58 } from "../engagement/solana-wallet-proof.mjs";

const policy = JSON.parse(readFileSync(new URL("../engagement/reward-policy.v1.json", import.meta.url), "utf8"));
const snapshotDigest = "ab".repeat(32);
const finalizedSlotHash = "cd".repeat(32);
const EPOCH = "2026-08-02";
const SNAPSHOT_AT = "2026-08-03T00:00:00.000Z";
const GENESIS_RESERVATION_SNAPSHOT_AT = "2026-08-03T12:00:00.000Z";
const GENESIS_FUNDING_ROUND_AT = "2026-08-04T00:00:00.000Z";
const GENESIS_BINDING_SNAPSHOT_DIGEST = "12".repeat(32);
const ADMISSION_RECEIPT_DIGEST = "34".repeat(32);
const DAY_MILLISECONDS = 86_400_000;
const walletFor = (index) => {
  const bytes = Buffer.alloc(32);
  bytes[0] = 1;
  bytes.writeUInt32BE(index, 28);
  return encodeBase58(bytes);
};

const candidate = (index, overrides = {}, snapshotAtUtc = SNAPSHOT_AT) => {
  const actionType = overrides.actionType ?? "original";
  const activityStartSlot = overrides.activityStartSlot ?? String(2_000_000 + index);
  const xUserId = overrides.xUserId ?? String(9_000_000_000_000_000n + BigInt(index));
  const row = {
    wallet: walletFor(index + 1),
    xUserId,
    xAccountCreatedAtUtc: new Date(new Date(snapshotAtUtc).valueOf() - 41 * DAY_MILLISECONDS).toISOString(),
    oauthVerified: true,
    walletSignatureVerified: true,
    countryCode: "US",
    subscriptionType: "Premium",
    subscriptionObservedAtUtc: new Date(new Date(snapshotAtUtc).valueOf() - 3_600_000).toISOString(),
    nodeHistoryStartSlot: String(1_000_000 + index),
    activityStartSlot,
    actionType,
    actionId: String(7_000_000_000_000_000n + BigInt(index)),
    actorXUserId: overrides.actorXUserId ?? xUserId,
    xPostCreatedAtUtc: new Date(new Date(snapshotAtUtc).valueOf() - 12 * 3_600_000).toISOString(),
    canonicalCampaignTargetId: String(8_000_000_000_000_000n + BigInt(index)),
    canonicalCampaignTargetEvidenceSha256: "ef".repeat(32),
    sourcePostIds: [String(8_000_000_000_000_000n + BigInt(index))],
    ...overrides,
  };
  if (["like", "follow"].includes(actionType)) {
    if (!Object.hasOwn(overrides, "actionId")) delete row.actionId;
    delete row.xPostCreatedAtUtc;
    if (row.collectorFirstObservedFinalizedSlot === undefined) row.collectorFirstObservedFinalizedSlot = row.activityStartSlot;
    if (row.collectorFirstObservedAtUtc === undefined) row.collectorFirstObservedAtUtc = new Date(new Date(snapshotAtUtc).valueOf() - 12 * 3_600_000).toISOString();
  }
  return row;
};

const rows = (count, snapshotAtUtc = SNAPSHOT_AT) => Array.from({ length: count }, (_, index) => candidate(index, {}, snapshotAtUtc));

const genesisCandidate = (index, overrides = {}) => {
  const xUserId = overrides.xUserId ?? String(6_000_000_000_000_000n + BigInt(index));
  return {
    wallet: walletFor(20_000 + index),
    xUserId,
    xAccountCreatedAtUtc: new Date(new Date(GENESIS_FUNDING_ROUND_AT).valueOf() - 41 * DAY_MILLISECONDS).toISOString(),
    oauthVerified: true,
    walletSignatureVerified: true,
    countryCode: "US",
    subscriptionType: "Premium",
    subscriptionObservedAtUtc: new Date(new Date(GENESIS_FUNDING_ROUND_AT).valueOf() - 3_600_000).toISOString(),
    bindingReservationSequence: String(index + 1),
    bindingReservedAtUtc: "2026-08-03T11:00:00.000Z",
    bindingReservationReceiptSha256: (index % 255).toString(16).padStart(2, "0").repeat(32),
    designatedFundingRoundAtUtc: GENESIS_FUNDING_ROUND_AT,
    activityStartSlot: String(4_000_000 + index),
    nodeHistoryStartSlot: String(3_000_000 + index),
    ...overrides,
  };
};

const selectionArguments = (candidateRows, maximumClaims = candidateRows.length, snapshotAtUtc = SNAPSHOT_AT) => ({
  epoch: new Date(new Date(snapshotAtUtc).valueOf() - DAY_MILLISECONDS).toISOString().slice(0, 10),
  snapshotDigest,
  finalizedSlotHash,
  policyVersion: policy.schema,
  rows: candidateRows,
  maximumClaims,
  identityModel: policy.identityModel,
  dailyModel: policy.daily,
  snapshotAtUtc,
});

const buildArguments = (candidateRows, overrides = {}) => ({
  epoch: EPOCH,
  mint: "MINT_PUBLISHED_AFTER_VERIFICATION",
  policy,
  snapshotDigest,
  finalizedSlotHash,
  snapshotAtUtc: SNAPSHOT_AT,
  rows: candidateRows,
  publishedEpochs: 0,
  consumedLifetimeBaseUnits: "0",
  ...overrides,
});

const genesisBuildArguments = (candidateRows, overrides = {}) => ({
  mint: "MINT_PUBLISHED_AFTER_VERIFICATION",
  policy,
  bindingSnapshotDigest: GENESIS_BINDING_SNAPSHOT_DIGEST,
  reservationSnapshotAtUtc: GENESIS_RESERVATION_SNAPSHOT_AT,
  fundingRoundAtUtc: GENESIS_FUNDING_ROUND_AT,
  rows: candidateRows,
  ...overrides,
});

test("canonical policy hashing and generic Genesis buildEpoch primitives remain unchanged", () => {
  assert.equal(policyHash({ alpha: 1, nested: { beta: 2, gamma: 3 } }), policyHash({ nested: { gamma: 3, beta: 2 }, alpha: 1 }));
  assert.throws(() => validateRows([{ wallet: "22222222222222222222222222222222", amountDisplayUnits: 100 }], 1), /invalid public wallet/);
  const hash = policyHash(policy);
  const epoch = buildEpoch({
    epoch: "GENESIS",
    mint: "MINT",
    policyHash: hash,
    maximumClaims: 2,
    rows: [
      { wallet: walletFor(1), amountDisplayUnits: 100, sourcePostIds: ["2", "1"] },
      { wallet: walletFor(2), amountDisplayUnits: 100, sourcePostIds: ["3"] },
    ],
  });
  assert.equal(epoch.totalClaimableBaseUnits, "200000000000");
  for (const claim of epoch.claims) {
    const leaf = leafHash({ epoch: epoch.epoch, wallet: claim.wallet, amountBaseUnits: claim.amountBaseUnits, policyHash: hash });
    assert.equal(verifyProof({ leaf, proof: claim.merkleProof, root: epoch.merkleRoot }), true);
  }
});

test("held Genesis planner independently enforces first-1,000 reservations, exact nominal amount, source, tiers, and half-open expiry", () => {
  const plan = buildGenesisRewardPlan(genesisBuildArguments([
    genesisCandidate(0, { subscriptionType: "None", verified: true }),
    genesisCandidate(1, { subscriptionType: "Basic" }),
    genesisCandidate(2, { subscriptionType: "Premium", verified: false }),
    genesisCandidate(3, { subscriptionType: "PremiumPlus" }),
  ]));
  assert.equal(plan.schema, "star-ascent-genesis-reward-plan/v2");
  assert.equal(plan.rewardSourceKind, "GENESIS_AIRDROP");
  assert.equal(plan.status, "HOLD_PENDING_GLOBAL_REWARD_WATERFALL");
  assert.equal(plan.publicationAllowed, false);
  assert.equal(plan.eligibleWalletCount, 4);
  assert.equal(plan.nominalRewardBaseUnitsPerNode, "100000000000");
  assert.equal(plan.nominalTotalBaseUnits, "400000000000");
  assert.equal(plan.totalImmediateCandidateBaseUnits, "220000000000");
  assert.equal(plan.deferredEntitlementCandidateTotalBaseUnits, "180000000000");
  assert.equal(plan.expiresAtUtc, "2026-09-03T00:00:00.000Z");
  assert.equal(plan.validityInterval, "[2026-08-04T00:00:00.000Z,2026-09-03T00:00:00.000Z)");
  assert.equal(plan.bindingSnapshotAuthentication, "BLOCKED_REQUIRES_DURABLE_REGISTRY_ADAPTER");
  assert.deepEqual(plan.immediateClaims.map(({ trancheKind }) => trancheKind), ["X_BASE_10", "X_BASE_10", "X_PREMIUM_FULL_100", "X_PREMIUM_FULL_100"]);
  assert.ok(plan.immediateClaims.every((claim) => claim.rewardSourceKind === "GENESIS_AIRDROP" && claim.rewardLineage.rewardSourceKind === "GENESIS_AIRDROP" && claim.publicationAllowed === false));
  assert.ok(plan.deferredEntitlements.every((entry) => entry.rewardSourceKind === "GENESIS_AIRDROP" && entry.entitlementState === "INACTIVE_CONDITIONAL_CANDIDATE" && !Object.hasOwn(entry, "active")));
  assert.equal(Object.hasOwn(plan, "claims"), false);
});

test("Genesis selector preserves immutable reservation numbers and never promotes an omitted partial snapshot", () => {
  const selected = selectGenesisRewardCandidates({
    policy,
    rows: [genesisCandidate(998), genesisCandidate(1_000)],
    bindingSnapshotDigest: GENESIS_BINDING_SNAPSHOT_DIGEST,
    reservationSnapshotAtUtc: GENESIS_RESERVATION_SNAPSHOT_AT,
    fundingRoundAtUtc: GENESIS_FUNDING_ROUND_AT,
  });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].bindingReservationSequence, "999");
  assert.equal(selected[0].reservationRank, 999);
  const plan = buildGenesisRewardPlan(genesisBuildArguments([genesisCandidate(998)]));
  assert.equal(plan.immediateClaims[0].reservationRank, 999);
  assert.equal(plan.bindingSnapshotRequirement, "COMPLETE_AUTHENTICATED_FIRST_1000_REGISTRY_SNAPSHOT_NO_PARTIAL_OR_OMITTED_INPUT");
});

test("Genesis planner fails closed on duplicate immutable bindings, invalid funding round, identity drift, or stale tier", () => {
  const first = genesisCandidate(0);
  const second = genesisCandidate(1);
  const selection = (candidateRows) => selectGenesisRewardCandidates({ policy, rows: candidateRows, bindingSnapshotDigest: GENESIS_BINDING_SNAPSHOT_DIGEST, reservationSnapshotAtUtc: GENESIS_RESERVATION_SNAPSHOT_AT, fundingRoundAtUtc: GENESIS_FUNDING_ROUND_AT });
  assert.throws(() => selection([first, { ...second, wallet: first.wallet }]), /duplicate Genesis wallet/);
  assert.throws(() => selection([first, { ...second, xUserId: first.xUserId }]), /duplicate Genesis X user ID/);
  assert.throws(() => selection([first, { ...second, bindingReservationSequence: first.bindingReservationSequence }]), /duplicate Genesis binding reservation sequence/);
  assert.throws(() => buildGenesisRewardPlan(genesisBuildArguments([first], { fundingRoundAtUtc: "2026-08-05T00:00:00.000Z" })), /designated next UTC 00:00/);
  assert.throws(() => selection([{ ...first, oauthVerified: false }]), /OAuth/);
  assert.throws(() => selection([{ ...first, subscriptionObservedAtUtc: "2026-08-02T23:59:59.999Z" }]), /stale or invalid/);
  assert.throws(() => buildGenesisRewardPlan(genesisBuildArguments([genesisCandidate(1_000)])), /no first-1,000/);
});

test("daily oversubscription preserves the frozen V1 snapshot lottery while carrying allocator chronology", () => {
  const candidates = [
    candidate(1, { activityStartSlot: "9", nodeHistoryStartSlot: "1", xUserId: "90" }),
    candidate(2, { activityStartSlot: "8", nodeHistoryStartSlot: "9", xUserId: "91" }),
    candidate(3, { activityStartSlot: "8", nodeHistoryStartSlot: "7", xUserId: "99" }),
    candidate(4, { activityStartSlot: "8", nodeHistoryStartSlot: "7", xUserId: "89" }),
  ];
  const winners = selectDailyBudgetWinners(selectionArguments(candidates));
  const expected = candidates.map((row) => ({
    xUserId: row.xUserId,
    wallet: row.wallet,
    score: dailySelectionScore({ epoch: EPOCH, snapshotDigest, finalizedSlotHash, xUserId: row.xUserId, wallet: row.wallet }),
  })).sort((left, right) => left.score.localeCompare(right.score) || left.xUserId.localeCompare(right.xUserId) || left.wallet.localeCompare(right.wallet));
  assert.deepEqual(winners.map(({ xUserId }) => xUserId), expected.map(({ xUserId }) => xUserId));
  assert.deepEqual(
    winners.find(({ xUserId }) => xUserId === "89").selectionPriority,
    dailySelectionPriority({ activityStartSlot: "8", nodeHistoryStartSlot: "7", xUserId: "89", wallet: candidates[3].wallet }),
  );
  assert.ok(winners.every(({ selectionScore }) => /^[0-9a-f]{64}$/u.test(selectionScore)));
  const reverse = selectDailyBudgetWinners(selectionArguments([...candidates].reverse()));
  assert.deepEqual(reverse.map(({ xUserId }) => xUserId), winners.map(({ xUserId }) => xUserId));
  const rebound = selectDailyBudgetWinners({ ...selectionArguments(candidates), snapshotDigest: "aa".repeat(32) });
  const originalByX = new Map(winners.map((row) => [row.xUserId, row]));
  for (const row of rebound) {
    assert.notEqual(row.selectionScore, originalByX.get(row.xUserId).selectionScore);
    assert.notEqual(row.actionEvidenceSha256, originalByX.get(row.xUserId).actionEvidenceSha256);
    assert.notEqual(row.candidateCommitmentSha256, originalByX.get(row.xUserId).candidateCommitmentSha256);
  }
});

test("10,000 qualifying nodes deterministically yield at most 1,000 winners independent of input order", () => {
  const candidates = rows(10_000);
  const forward = selectDailyBudgetWinners(selectionArguments(candidates, 1_000));
  const reverse = selectDailyBudgetWinners(selectionArguments([...candidates].reverse(), 1_000));
  assert.equal(forward.length, 1_000);
  assert.deepEqual(forward.map(({ wallet }) => wallet), reverse.map(({ wallet }) => wallet));
  assert.equal(new Set(forward.map(({ selectionScore }) => selectionScore)).size, 1_000);
});

test("all six public X interactions qualify, with like/follow collector-slot evidence and no fake timestamp", () => {
  for (const [index, actionType] of policy.daily.qualifyingActions.entries()) {
    const row = candidate(index, { actionType });
    assert.doesNotThrow(() => selectDailyBudgetWinners(selectionArguments([row])));
  }
  const like = candidate(20, { actionType: "like" });
  const [normalizedLike] = selectDailyBudgetWinners(selectionArguments([like]));
  const [reboundLike] = selectDailyBudgetWinners({ ...selectionArguments([like]), finalizedSlotHash: "aa".repeat(32) });
  assert.match(normalizedLike.actionId, /^[0-9a-f]{64}$/u);
  assert.equal(reboundLike.actionId, normalizedLike.actionId);
  assert.notEqual(reboundLike.actionEvidenceSha256, normalizedLike.actionEvidenceSha256);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([{ ...like, collectorFirstObservedFinalizedSlot: "999" }])), /must equal the collector/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([{ ...like, likedAtUtc: "2026-08-02T12:00:00.000Z" }])), /must not contain/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([{ ...like, actionId: "123" }])), /must be derived internally/);
  const follow = candidate(21, { actionType: "follow" });
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([{ ...follow, followedAtUtc: "2026-08-02T12:00:00.000Z" }])), /must not contain/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([candidate(22, { actionType: "bookmark" })])), /private or unattributable/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([candidate(23, { canonicalCampaignTargetEvidenceSha256: "missing" })])), /lowercase SHA-256/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([candidate(24, { actorXUserId: "999" })])), /must equal the bound/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([candidate(25, { actionId: "not-numeric" })])), /canonical unsigned/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([candidate(26, { xPostCreatedAtUtc: SNAPSHOT_AT })])), /outside the closed UTC epoch/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([candidate(27, { actionType: "follow", collectorFirstObservedAtUtc: SNAPSHOT_AT })])), /outside the closed UTC epoch/);

  const repost = candidate(30, { actionType: "repost" });
  const retweet = { ...repost, actionType: "retweet" };
  const [normalizedRepost] = selectDailyBudgetWinners(selectionArguments([repost]));
  const [normalizedRetweet] = selectDailyBudgetWinners(selectionArguments([retweet]));
  assert.equal(normalizedRetweet.actionType, "repost");
  assert.equal(normalizedRetweet.rawActionType, "retweet");
  assert.equal(normalizedRetweet.canonicalActionKey, normalizedRepost.canonicalActionKey);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([repost, { ...retweet, wallet: walletFor(99) }])), /duplicate canonical daily action evidence/);
});

test("known None/Basic tiers receive exact atomic 10/90 while fresh Premium tiers receive 100%", () => {
  const genesisNone = rewardTranches({ nominalDisplayUnits: policy.genesis.rewardDisplayUnits, subscriptionType: "None", payoutTiers: policy.payoutTiers });
  assert.equal(genesisNone.immediateAmountBaseUnits, "10000000000");
  assert.equal(genesisNone.deferredAmountBaseUnits, "90000000000");
  assert.equal(genesisNone.immediateTrancheKind, "X_BASE_10");
  assert.equal(genesisNone.immediateBasisPoints, 1_000);
  assert.equal(genesisNone.deferredTrancheKind, "X_PREMIUM_UPGRADE_90");
  assert.equal(genesisNone.rewardClass, "STANDARD_10_PERCENT_AND_X_CAMPAIGN");
  const verifiedNone = rewardTranches({ nominalDisplayUnits: 100, subscriptionType: "None", payoutTiers: policy.payoutTiers, verified: true });
  assert.equal(verifiedNone.immediateTrancheKind, "X_BASE_10");
  assert.equal(verifiedNone.immediateAmountBaseUnits, "10000000000");
  for (const subscriptionType of ["Premium", "PremiumPlus"]) {
    const full = rewardTranches({ nominalDisplayUnits: 100, subscriptionType, payoutTiers: policy.payoutTiers, verified: false });
    assert.equal(full.immediateAmountBaseUnits, "100000000000");
    assert.equal(full.deferredAmountBaseUnits, "0");
    assert.equal(full.immediateTrancheKind, "X_PREMIUM_FULL_100");
    assert.equal(full.immediateBasisPoints, 10_000);
    assert.equal(full.subscriptionDecisionKey, "subscription_type");
  }
  assert.throws(() => rewardTranches({ nominalDisplayUnits: 100, subscriptionType: "Premium", payoutTiers: { ...policy.payoutTiers, trancheKinds: { ...policy.payoutTiers.trancheKinds, premiumImmediate: "X_BASE_10" } } }), /tranche-kind basis-point invariants/);
});

test("identity eligibility fails closed on absent proofs, young accounts, and missing/unknown/stale tiers", () => {
  const row = candidate(1);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([{ ...row, oauthVerified: false }])), /OAuth/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([{ ...row, walletSignatureVerified: false }])), /wallet-signature/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([{ ...row, countryCode: "" }])), /country/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([{ ...row, xUserId: "handle" }])), /canonical unsigned/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([{ ...row, xAccountCreatedAtUtc: "2026-06-24T00:00:00.001Z" }])), /younger/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([{ ...row, subscriptionType: undefined }])), /missing or unknown/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([{ ...row, subscriptionType: "Unknown" }])), /missing or unknown/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([{ ...row, subscriptionObservedAtUtc: "2026-08-01T23:59:59.999Z" }])), /stale or invalid/);
});

test("daily plan accounts nominal 100%, emits held immediate candidates and conditional 90% entitlement candidates", () => {
  const plan = buildDailyEpoch(buildArguments([
    candidate(1, { subscriptionType: "None", verified: true }),
    candidate(2, { subscriptionType: "Basic" }),
    candidate(3, { subscriptionType: "Premium", verified: false }),
    candidate(4, { subscriptionType: "PremiumPlus", actionType: "follow" }),
  ]));
  assert.equal(plan.status, "HOLD_PENDING_GLOBAL_REWARD_WATERFALL");
  assert.equal(plan.rewardSourceKind, "X_INTERACTION");
  assert.equal(plan.publicationAllowed, false);
  assert.equal(plan.eligibleWalletCount, 4);
  assert.equal(plan.nominalTotalBaseUnits, "48000000000");
  assert.equal(plan.nominalLifetimeConsumedAfterEpochBaseUnits, "48000000000");
  assert.equal(plan.totalImmediateCandidateBaseUnits, "26400000000");
  assert.equal(plan.deferredEntitlementCandidateTotalBaseUnits, "21600000000");
  assert.equal(plan.immediateClaims.length, 4);
  assert.equal(plan.deferredEntitlements.length, 2);
  assert.deepEqual(plan.immediateClaims.map(({ trancheKind }) => trancheKind).sort(), ["X_BASE_10", "X_BASE_10", "X_PREMIUM_FULL_100", "X_PREMIUM_FULL_100"].sort());
  assert.ok(plan.immediateClaims.every((claim) => ((claim.trancheKind === "X_BASE_10" && claim.basisPoints === 1_000) || (claim.trancheKind === "X_PREMIUM_FULL_100" && claim.basisPoints === 10_000)) && claim.admitted === false && claim.publicationAllowed === false));
  assert.ok(plan.deferredEntitlements.every((entry) => entry.status === "HOLD_PENDING_ORIGINAL_X_BASE_10_ADMISSION" && entry.entitlementState === "INACTIVE_CONDITIONAL_CANDIDATE" && !Object.hasOwn(entry, "active") && !Object.hasOwn(entry, "originalTrancheAdmitted")));
  assert.ok(plan.deferredEntitlements.every((entry) => entry.trancheKind === "X_PREMIUM_UPGRADE_90" && entry.basisPoints === 9_000));
  assert.ok(plan.immediateClaims.every((claim) => claim.rewardSourceKind === "X_INTERACTION" && claim.rewardLineage.rewardSourceKind === "X_INTERACTION"));
  assert.equal(plan.globalRewardWaterfall.originalAdmissionRequiredBeforeEntitlementCreation, true);
});

test("daily plan enforces 12,000 IAT epoch and 4,380,000 IAT lifetime caps against nominal 100%", () => {
  const epoch = buildDailyEpoch(buildArguments(rows(1_005)));
  assert.equal(epoch.eligibleWalletCount, 1_000);
  assert.equal(epoch.nominalTotalBaseUnits, policy.budget.maximumEpochBaseUnits);
  assert.equal(epoch.totalClaimableBaseUnits, policy.budget.maximumEpochBaseUnits);
  assert.equal(epoch.selectionRule, "IAT_DAILY_BUDGET_V1_ASCENDING_SHA256");

  const nextSnapshot = "2027-08-01T00:00:00.000Z";
  const oneClaimRemaining = buildDailyEpoch(buildArguments(
    [candidate(1, { subscriptionType: "Basic" }, nextSnapshot)],
    {
      epoch: "2027-07-31",
      snapshotAtUtc: nextSnapshot,
      publishedEpochs: 364,
      consumedLifetimeBaseUnits: (BigInt(policy.budget.maximumLifetimeBaseUnits) - 12_000_000_000n).toString(),
    },
  ));
  assert.equal(oneClaimRemaining.eligibleWalletCount, 1);
  assert.equal(oneClaimRemaining.nominalTotalBaseUnits, "12000000000");
  assert.equal(oneClaimRemaining.totalImmediateCandidateBaseUnits, "1200000000");
  assert.equal(oneClaimRemaining.deferredEntitlementCandidateTotalBaseUnits, "10800000000");
  assert.throws(() => buildDailyEpoch(buildArguments(rows(1), { publishedEpochs: 365 })), /epoch limit exhausted/);
  assert.throws(() => buildDailyEpoch(buildArguments(rows(1), { consumedLifetimeBaseUnits: policy.budget.maximumLifetimeBaseUnits })), /lifetime budget exhausted/);
});

test("daily selection rejects duplicate wallet or immutable X identity", () => {
  const first = candidate(1);
  const second = candidate(2);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([first, { ...second, wallet: first.wallet }])), /duplicate daily wallet/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([first, { ...second, xUserId: first.xUserId, actorXUserId: first.xUserId }])), /duplicate daily X user ID/);
  assert.throws(() => selectDailyBudgetWinners(selectionArguments([first, { ...first, wallet: second.wallet }])), /duplicate canonical daily action evidence/);
});

const activeEntitlement = () => {
  const plan = buildDailyEpoch(buildArguments([candidate(1, { subscriptionType: "Basic", activityStartSlot: "200", nodeHistoryStartSlot: "100" })]));
  return {
    policy,
    candidate: plan.deferredEntitlements[0],
    entitlement: {
      ...plan.deferredEntitlements[0],
      recordKind: "X_PREMIUM_UPGRADE_90_ENTITLEMENT",
      status: "PENDING_PREMIUM_UPGRADE",
      entitlementState: "ACTIVE_FROM_IMMUTABLE_FULL_ADMISSION_RECEIPT",
      originalAdmissionReceiptDigest: ADMISSION_RECEIPT_DIGEST,
    },
  };
};

test("90% entitlement activates only after full original admission and prepares one exact next-midnight allocator obligation", () => {
  const { candidate: held, entitlement } = activeEntitlement();
  const arguments_ = {
    entitlement,
    policy,
    immutableLedgerReceiptDigest: ADMISSION_RECEIPT_DIGEST,
    wallet: entitlement.wallet,
    xUserId: entitlement.xUserId,
    subscriptionType: "PremiumPlus",
    subscriptionObservedAtUtc: "2026-08-04T10:00:00.000Z",
    premiumProofAcceptedAtUtc: "2026-08-04T10:00:01.000Z",
    premiumProofAcceptedFinalizedSlot: "300",
    roundAtUtc: "2026-08-05T00:00:00.000Z",
  };
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...arguments_, entitlement: held }), /not typed as active/);
  const resolution = resolveDeferredPremiumEntitlement(arguments_);
  assert.equal(resolution.eligibility, "ELIGIBLE_FOR_EXACT_NEXT_UTC_00:00_GLOBAL_WATERFALL");
  assert.equal(resolution.amountBaseUnits, "10800000000");
  assert.equal(resolution.rewardSourceKind, "X_INTERACTION");
  assert.equal(resolution.originalAdmissionReceiptDigest, ADMISSION_RECEIPT_DIGEST);
  assert.equal(resolution.premiumProofAcceptedAtUtc, "2026-08-04T10:00:01.000Z");
  assert.equal(resolution.selectionPriority.activityStartSlot, "300");
  assert.equal(resolution.selectionPriority.nodeHistoryStartSlot, "100");
  assert.equal(resolution.allocatorDecision, null);
  assert.equal(resolution.entitlementConsumed, false);
  assert.equal(resolution.terminal, false);
  assert.equal(resolution.partialPaymentAllowed, false);
  assert.equal(resolution.publicationAllowed, false);
});

test("the pure upgrade preparer cannot accept or infer reward-lane capacity", () => {
  const { entitlement } = activeEntitlement();
  assert.throws(() => resolveDeferredPremiumEntitlement({
    entitlement,
    policy,
    immutableLedgerReceiptDigest: ADMISSION_RECEIPT_DIGEST,
    wallet: entitlement.wallet,
    xUserId: entitlement.xUserId,
    subscriptionType: "Premium",
    subscriptionObservedAtUtc: "2026-08-04T23:59:59.999Z",
    premiumProofAcceptedAtUtc: "2026-08-04T23:59:59.999Z",
    premiumProofAcceptedFinalizedSlot: "301",
    roundAtUtc: "2026-08-05T00:00:00.000Z",
    availableLaneBaseUnits: (BigInt(entitlement.amountBaseUnits) - 1n).toString(),
  }), /must not accept caller-supplied reward-lane capacity/);
});

test("upgrade preparation rejects attacker flags, missing receipts, oversized amounts, and broken lineage commitments", () => {
  const { entitlement } = activeEntitlement();
  const valid = {
    entitlement,
    policy,
    immutableLedgerReceiptDigest: ADMISSION_RECEIPT_DIGEST,
    wallet: entitlement.wallet,
    xUserId: entitlement.xUserId,
    subscriptionType: "Premium",
    subscriptionObservedAtUtc: "2026-08-04T10:00:00.000Z",
    premiumProofAcceptedAtUtc: "2026-08-04T10:00:01.000Z",
    premiumProofAcceptedFinalizedSlot: "300",
    roundAtUtc: "2026-08-05T00:00:00.000Z",
  };
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, immutableLedgerReceiptDigest: undefined }), /immutable original-admission ledger receipt/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, immutableLedgerReceiptDigest: "56".repeat(32) }), /does not match/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, entitlement: { ...entitlement, active: true } }), /mutable active flag/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, entitlement: { ...entitlement, amountBaseUnits: "18446744073709551616" } }), /unsigned 64-bit token amount limit/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, entitlement: { ...entitlement, originalImmediateClaimId: "00".repeat(32) } }), /original claim commitment mismatch/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, entitlement: { ...entitlement, entitlementId: "00".repeat(32) } }), /entitlement commitment mismatch/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, entitlement: { ...entitlement, rewardLineage: { ...entitlement.rewardLineage, nominalAmountBaseUnits: "999" } } }), /lineage digest mismatch/);
});

test("Genesis deferred lineage prepares an exact 90-IAT source-bound obligation and respects original half-open expiry", () => {
  const plan = buildGenesisRewardPlan(genesisBuildArguments([genesisCandidate(0, { subscriptionType: "Basic", activityStartSlot: "400", nodeHistoryStartSlot: "300" })]));
  const held = plan.deferredEntitlements[0];
  const receipt = "56".repeat(32);
  const entitlement = {
    ...held,
    recordKind: "X_PREMIUM_UPGRADE_90_ENTITLEMENT",
    status: "PENDING_PREMIUM_UPGRADE",
    entitlementState: "ACTIVE_FROM_IMMUTABLE_FULL_ADMISSION_RECEIPT",
    originalAdmissionReceiptDigest: receipt,
  };
  const valid = {
    entitlement,
    policy,
    immutableLedgerReceiptDigest: receipt,
    wallet: entitlement.wallet,
    xUserId: entitlement.xUserId,
    subscriptionType: "PremiumPlus",
    subscriptionObservedAtUtc: "2026-08-05T10:00:00.000Z",
    premiumProofAcceptedAtUtc: "2026-08-05T10:00:01.000Z",
    premiumProofAcceptedFinalizedSlot: "500",
    roundAtUtc: "2026-08-06T00:00:00.000Z",
  };
  const obligation = resolveDeferredPremiumEntitlement(valid);
  assert.equal(obligation.rewardSourceKind, "GENESIS_AIRDROP");
  assert.equal(obligation.amountBaseUnits, "90000000000");
  assert.equal(obligation.trancheKind, "X_PREMIUM_UPGRADE_90");
  assert.equal(obligation.expiresAtUtc, "2026-09-03T00:00:00.000Z");
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, subscriptionObservedAtUtc: "2026-09-02T23:00:00.000Z", premiumProofAcceptedAtUtc: "2026-09-02T23:00:01.000Z", premiumProofAcceptedFinalizedSlot: "999", roundAtUtc: "2026-09-03T00:00:00.000Z" }), /on or after the original expiry/);
});

test("upgrade funding follows proof acceptance across midnight rather than the earlier observation", () => {
  const { entitlement } = activeEntitlement();
  const valid = {
    entitlement,
    policy,
    immutableLedgerReceiptDigest: ADMISSION_RECEIPT_DIGEST,
    wallet: entitlement.wallet,
    xUserId: entitlement.xUserId,
    subscriptionType: "Premium",
    subscriptionObservedAtUtc: "2026-08-04T23:59:00.000Z",
    premiumProofAcceptedAtUtc: "2026-08-05T00:01:00.000Z",
    premiumProofAcceptedFinalizedSlot: "302",
    roundAtUtc: "2026-08-06T00:00:00.000Z",
  };
  const resolution = resolveDeferredPremiumEntitlement(valid);
  assert.equal(resolution.roundAtUtc, "2026-08-06T00:00:00.000Z");
  assert.equal(resolution.premiumProofAcceptedAtUtc, "2026-08-05T00:01:00.000Z");
  const laterAcceptance = resolveDeferredPremiumEntitlement({ ...valid, premiumProofAcceptedAtUtc: "2026-08-05T00:02:00.000Z" });
  assert.notEqual(laterAcceptance.obligationId, resolution.obligationId);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, roundAtUtc: "2026-08-05T00:00:00.000Z" }), /strictly after proof acceptance/);
});

test("upgrade resolution fails on identity, tier, ordering, boundary, freshness, or expiry drift", () => {
  const { entitlement } = activeEntitlement();
  const valid = {
    entitlement,
    policy,
    immutableLedgerReceiptDigest: ADMISSION_RECEIPT_DIGEST,
    wallet: entitlement.wallet,
    xUserId: entitlement.xUserId,
    subscriptionType: "Premium",
    subscriptionObservedAtUtc: "2026-08-04T10:00:00.000Z",
    premiumProofAcceptedAtUtc: "2026-08-04T10:00:01.000Z",
    premiumProofAcceptedFinalizedSlot: "300",
    roundAtUtc: "2026-08-05T00:00:00.000Z",
  };
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, wallet: walletFor(99) }), /identity must match/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, subscriptionType: "Basic" }), /requires a fresh Premium/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, subscriptionObservedAtUtc: SNAPSHOT_AT }), /observed later/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, premiumProofAcceptedAtUtc: "2026-08-04T09:59:59.999Z" }), /at or after the fresh Premium observation/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, subscriptionObservedAtUtc: "2026-08-04T00:00:00.000Z", premiumProofAcceptedAtUtc: "2026-08-05T00:00:00.001Z", roundAtUtc: "2026-08-06T00:00:00.000Z" }), /stale at proof acceptance/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, subscriptionObservedAtUtc: "2026-09-01T23:59:00.000Z", premiumProofAcceptedAtUtc: "2026-09-02T00:00:00.000Z", roundAtUtc: "2026-09-03T00:00:00.000Z" }), /proof acceptance must be after the original funding round and before the original expiry/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, premiumProofAcceptedFinalizedSlot: "150" }), /acceptance must be later/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, roundAtUtc: "2026-08-06T00:00:00.000Z" }), /only at the first UTC/);
  assert.throws(() => resolveDeferredPremiumEntitlement({ ...valid, subscriptionObservedAtUtc: "2026-09-01T23:00:00.000Z", premiumProofAcceptedAtUtc: "2026-09-01T23:00:01.000Z", premiumProofAcceptedFinalizedSlot: "999", roundAtUtc: "2026-09-02T00:00:00.000Z" }), /on or after the original expiry/);
});

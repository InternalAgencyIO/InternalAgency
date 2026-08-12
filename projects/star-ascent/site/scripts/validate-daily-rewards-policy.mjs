import { readFileSync } from "node:fs";

const path = process.argv[2] ?? "engagement/reward-policy.v1.json";
const policy = JSON.parse(readFileSync(path, "utf8"));
const fail = (message) => { console.error(`FAIL: ${message}`); process.exit(1); };
const ok = (message) => console.log(`OK: ${message}`);
const same = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);

if (policy.schema !== "star-ascent-daily-rewards-policy/v2") fail("unexpected policy schema");
if (policy.status !== "HOLD_PENDING_GLOBAL_REWARD_WATERFALL" || policy.publicationAllowed !== false) fail("policy must remain nonpublishing until the global reward waterfall exists");
ok("v2 policy is on the nonpublishing global-waterfall HOLD");

if (policy.asset.symbol !== "IAT" || policy.asset.decimals !== 9 || policy.asset.network !== "mainnet-beta" || policy.asset.mint !== "PUBLISH_ONLY_AFTER_INDEPENDENT_VERIFICATION") fail("asset configuration drifted from the held Genesis target");
if (policy.genesis.rewardSourceKind !== "GENESIS_AIRDROP" || policy.genesis.rewardDisplayUnits !== 100 || policy.genesis.maximumClaims !== 1_000 || !policy.genesis.onePerWallet || !policy.genesis.onePerXAccount) fail("Genesis must remain exactly 100 IAT for at most 1,000 bound nodes");
if (policy.genesis.selectionRule !== "FIRST_1000_ASCENDING_IMMUTABLE_BINDING_RESERVATION_SEQUENCE" || policy.genesis.bindingSnapshotRequirement !== "COMPLETE_AUTHENTICATED_FIRST_1000_REGISTRY_SNAPSHOT_NO_PARTIAL_OR_OMITTED_INPUT" || !same(policy.genesis.requiredReservationEvidence, ["bindingReservationSequence", "bindingReservedAtUtc", "bindingReservationReceiptSha256", "designatedFundingRoundAtUtc"]) || policy.genesis.fundingRoundRule !== "NEXT_UTC_00:00_AFTER_RESERVATION_SNAPSHOT" || policy.genesis.claimValidityInterval !== "HALF_OPEN_[FUNDING_ROUND,FUNDING_ROUND_PLUS_30_DAYS)") fail("Genesis immutable reservation, complete snapshot, next-midnight funding, or half-open expiry rule drifted");
ok("Genesis remains nominal 100 IAT for the first 1,000 nodes");
ok("Genesis requires immutable sequence rank, a complete authenticated registry snapshot, next-midnight funding, and half-open expiry");

const identity = policy.identityModel;
if (identity.unit !== "UNIQUE_OAUTH_X_ID_PLUS_SIGNED_WALLET_PLUS_COUNTRY_WITH_OBSERVED_X_TIER") fail("identity unit drifted");
if (!identity.oauthRequired || !identity.immutableNumericXUserIdRequired || !identity.walletSignatureRequired || !identity.countryRequired || !identity.oneWalletPerPair || !identity.oneImmutableXUserIdPerPair) fail("OAuth, immutable numeric X ID, signed wallet, country, and one-to-one pair binding are mandatory");
if (identity.oneHumanPerAccountRequired || !identity.multipleQualifyingPairsPerPersonAllowed || identity.xHandleIsIdentityKey) fail("existing independent-pair identity semantics changed");
if (!same(identity.recognizedSubscriptionTypes, ["None", "Basic", "Premium", "PremiumPlus"]) || !same(identity.tenPercentSubscriptionTypes, ["None", "Basic"]) || !same(identity.fullRewardSubscriptionTypes, ["Premium", "PremiumPlus"])) fail("known 10% and 100% X tier sets drifted");
if (identity.minimumXAccountAgeDays !== 40 || identity.subscriptionObservationMaximumAgeHours !== 24 || identity.missingUnknownOrStaleObservationAction !== "FAIL_CLOSED") fail("40-day identity or 24-hour observation freshness boundary drifted");
if (identity.subscriptionDecisionKey !== "subscription_type" || identity.verifiedBooleanPayoutRole !== "INFORMATIONAL_ONLY_NEVER_ELIGIBILITY_OR_AMOUNT_KEY") fail("X verified boolean must never replace exact subscription_type payout classification");
ok("identity and fresh subscription_type evidence fail closed; verified boolean cannot control payout tier");

const tiers = policy.payoutTiers;
if (tiers.denominatorBasisPoints !== 10_000 || tiers.nonPremiumImmediateBasisPoints !== 1_000 || tiers.nonPremiumDeferredBasisPoints !== 9_000 || tiers.premiumImmediateBasisPoints !== 10_000) fail("atomic 10/90 and 100% tier math drifted");
if (!tiers.atomicTranches || tiers.partialPaymentsAllowed || tiers.deferredEntitlementReserved || tiers.deferredEntitlementCreatesDebt || tiers.deferredEntitlementExpiryDays !== 30) fail("atomic, unreserved, no-debt, 30-day entitlement rules drifted");
if (tiers.rewardClass !== "STANDARD_10_PERCENT_AND_X_CAMPAIGN" || tiers.ownerRewardLaneLabel !== "10% reward lanes" || tiers.trancheKinds?.nonPremiumImmediate !== "X_BASE_10" || tiers.trancheKinds?.premiumImmediate !== "X_PREMIUM_FULL_100" || tiers.trancheKinds?.premiumUpgrade !== "X_PREMIUM_UPGRADE_90") fail("machine tranche kinds or owner reward-lane mapping drifted");
if (!same(tiers.rewardSourceKinds, ["X_INTERACTION", "GENESIS_AIRDROP"])) fail("reward source kind enum drifted");
if (!same(tiers.trancheBasisPoints, { X_BASE_10: 1_000, X_PREMIUM_FULL_100: 10_000, X_PREMIUM_UPGRADE_90: 9_000 })) fail("tranche-kind basis-point invariants drifted");
if (tiers.deferredEntitlementActivationRule !== "CREATE_ONLY_AFTER_ORIGINAL_X_BASE_10_IS_ADMITTED_IN_FULL_AT_ITS_ORIGINAL_UTC_00:00_ROUND") fail("90% entitlement must not exist after an unfunded/null original tranche");
if (tiers.deferredEntitlementAuthorizationRule !== "TYPED_BUILDER_LINEAGE_PLUS_AUTHENTICATED_IMMUTABLE_ORIGINAL_ADMISSION_LEDGER_RECEIPT_DIGEST") fail("deferred entitlement authorization must require typed lineage and an authenticated immutable admission receipt");
if (tiers.upgradeIdentityRule !== "SAME_IMMUTABLE_X_ID_AND_WALLET"
  || tiers.upgradeTierRule !== "FRESH_PREMIUM_OR_PREMIUMPLUS_OBSERVED_LATER_AND_FRESH_AT_PROOF_ACCEPTANCE_BEFORE_EXPIRY"
  || tiers.upgradeProofAcceptanceTimeRule !== "AT_OR_AFTER_OBSERVATION_AFTER_ORIGINAL_FUNDING_ROUND_AND_BEFORE_EXPIRY"
  || tiers.upgradeDecisionBoundary !== "NEXT_UTC_00:00_STRICTLY_AFTER_PREMIUM_PROOF_ACCEPTANCE"
  || tiers.unfundedUpgradeAction !== "NULL_NO_DEBT_NO_RETRY") fail("Premium-upgrade identity, proof-acceptance timing, or nulling rule drifted");
if (tiers.upgradePriorityRule !== "MAX_ORIGINAL_ACTIVITY_SLOT_NODE_HISTORY_START_SLOT_PREMIUM_PROOF_ACCEPTED_FINALIZED_SLOT_THEN_NODE_HISTORY_START_SLOT_NUMERIC_X_ID_WALLET") fail("Premium-upgrade acceptance must receive a fresh queue position");
ok("10/90 tranches, conditional creation, fresh upgrade ordering, and no-partial nulling are exact");

const daily = policy.daily;
if (daily.rewardSourceKind !== "X_INTERACTION") fail("daily reward source kind drifted");
if (daily.snapshotAtUtc !== "00:00" || daily.claimOpenAtUtc !== "00:05") fail("daily UTC schedule drifted");
if (daily.rewardDisplayUnits !== 12 || daily.maximumClaimsPerEpoch !== 1_000 || daily.maximumQualifyingActionsPerEpoch !== 1 || daily.claimExpiryDays !== 30) fail("daily nominal reward, node cap, action cap, or expiry drifted");
if (!same(daily.qualifyingActions, ["original", "reply", "quote", "repost", "like", "follow"])) fail("public X interaction set must contain exactly six actions");
if (!same(daily.actionAliases, { retweet: "repost" })) fail("raw retweet must normalize to canonical repost before evidence and replay checks");
if (!same(daily.allocatorOrderingInputs, ["activityStartSlot", "nodeHistoryStartSlot", "numericXUserId", "wallet"])) fail("post-selection allocator chronology inputs drifted");
if (!same(daily.requiredCommonActionEvidence, ["actionType", "actorXUserId", "activityStartSlot", "nodeHistoryStartSlot", "canonicalCampaignTargetId", "canonicalCampaignTargetEvidenceSha256"])) fail("common canonical action evidence contract drifted");
if (!same(daily.requiredPostActionEvidence, ["numeric actionId", "xPostCreatedAtUtc"]) || !daily.postEvidenceRule.includes("created_at inside the closed UTC epoch") || !daily.postEvidenceRule.includes("actor immutable X ID equal to the bound X ID")) fail("canonical public-post time, ID, or actor evidence drifted");
if (!same(daily.requiredLikeFollowActionEvidence, ["collectorFirstObservedAtUtc", "collectorFirstObservedFinalizedSlot", "internally derived synthetic action ID"])) fail("like/follow collector evidence contract drifted");
if (!daily.likeAndFollowEvidenceRule.includes("first-observed finalized Solana slot") || !daily.likeAndFollowEvidenceRule.includes("Caller action IDs and occurrence timestamps are forbidden")) fail("like/follow evidence must use append-only finalized-slot observation, not fabricated identifiers or timestamps");
if (!daily.actionCommitmentRule.includes("policy schema version") || !daily.actionCommitmentRule.includes("candidate snapshot digest") || !daily.actionCommitmentRule.includes("finalized-slot hash") || !daily.persistentReplayRule.includes("across epochs")) fail("action commitments or persistent v2 replay defense drifted");
for (const excluded of ["private or unattributable bookmark", "private or unattributable view", "private or unattributable impression"]) {
  if (!daily.excludedActions.includes(excluded)) fail(`missing private interaction exclusion: ${excluded}`);
}
ok("six public actions use canonical campaign evidence; private signals stay excluded");

const budget = policy.budget;
const perNodeBaseUnits = BigInt(daily.rewardDisplayUnits) * 1_000_000_000n;
const derivedEpochMaximum = perNodeBaseUnits * BigInt(daily.maximumClaimsPerEpoch);
const derivedLifetimeMaximum = derivedEpochMaximum * BigInt(budget.maximumPublishedEpochs);
if (budget.maximumPublishedEpochs !== 365 || BigInt(budget.maximumEpochBaseUnits) !== derivedEpochMaximum || BigInt(budget.maximumLifetimeBaseUnits) !== derivedLifetimeMaximum) fail("12 IAT x 1,000 x 365 nominal budget derivation failed");
if (budget.refillAllowed || budget.expiredClaimsRecycled || budget.oversubscriptionRule !== "IAT_DAILY_BUDGET_V1_ASCENDING_SHA256") fail("budget refill, recycling, or frozen V1 daily selection rule drifted");
if (!same(budget.oversubscriptionInputs, ["closed UTC epoch", "canonical candidate snapshot SHA-256", "predeclared finalized Solana slot hash after snapshot", "immutable X user ID", "wallet"]) || !budget.consumptionRule.includes("full nominal 12 IAT")) fail("nominal 100% budget accounting or frozen daily selection inputs drifted");
ok("daily and lifetime caps consume nominal 100%, never the smaller immediate tranche");

const waterfall = policy.globalRewardWaterfall;
if (waterfall.status !== "HOLD_PENDING_GLOBAL_REWARD_WATERFALL" || waterfall.implemented || waterfall.publicationAllowed || waterfall.requiredDecisionBoundary !== "UTC_00:00" || !waterfall.requiresExactUnlockedLaneSnapshot || !waterfall.noPartialPayments || waterfall.unfundedRewardAction !== "NULL_NO_DEBT") fail("global reward waterfall HOLD or all-or-nothing boundary drifted");
ok("no plan can publish before the exact global 00:00 waterfall exists");

if (!policy.distribution.model.includes("non-publishable") || !policy.distribution.payer.includes("Trezor Model T") || policy.distribution.serverSigningAllowed || policy.distribution.automaticBroadcastAllowed) fail("distribution must preserve the owner-selected single-Trezor, no-server-signing boundary");
if (!policy.distribution.proofPayload.includes("rewardSourceKind") || !policy.distribution.proofPayload.includes("rewardLineageDigest")) fail("future proof payload must bind reward source and typed lineage");
const disclosure = policy.disclosure.toLowerCase();
if (!disclosure.includes("not yield") || !disclosure.includes("not interest") || !disclosure.includes("unreserved") || !disclosure.includes("creates no debt")) fail("reward and deferred-entitlement disclosure drifted");
ok("single-Trezor authority and no-yield/no-debt disclosure remain explicit");

console.log("REWARDS POLICY VALID: held Genesis and daily source kinds, immutable reservation rank, V1 SHA selection, retweet normalization, exact subscription_type tranches, typed deferred lineage, nominal caps, and the nonpublishing waterfall HOLD are internally consistent.");

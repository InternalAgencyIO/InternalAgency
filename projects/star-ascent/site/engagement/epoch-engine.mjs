import { createHash } from "node:crypto";
import { sha256CanonicalJson } from "../scripts/iat-v2-canonical-json.mjs";
import { assertSolanaPublicKey } from "./solana-wallet-proof.mjs";

const DISPLAY_MULTIPLIER = 1_000_000_000n;

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const policyHash = (policy) => sha256CanonicalJson(policy);
export const baseUnits = (displayUnits) => {
  if (!Number.isInteger(displayUnits) || displayUnits <= 0) throw new Error("display units must be a positive integer");
  return (BigInt(displayUnits) * DISPLAY_MULTIPLIER).toString();
};

export function validateRows(rows, maximumClaims) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("epoch requires at least one eligible row");
  if (rows.length > maximumClaims) throw new Error(`epoch has ${rows.length} rows, exceeding ${maximumClaims}`);
  const seen = new Set();
  for (const row of rows) {
    try { assertSolanaPublicKey(row.wallet); } catch { throw new Error(`invalid public wallet: ${row.wallet}`); }
    if (seen.has(row.wallet)) throw new Error(`duplicate wallet: ${row.wallet}`);
    seen.add(row.wallet);
    baseUnits(row.amountDisplayUnits);
  }
}

const DAY_MILLISECONDS = 86_400_000;
const HOUR_MILLISECONDS = 3_600_000;
const MAX_U64 = (1n << 64n) - 1n;
const DAILY_HOLD = "HOLD_PENDING_GLOBAL_REWARD_WATERFALL";
const REWARD_CLASS = "STANDARD_10_PERCENT_AND_X_CAMPAIGN";
const NON_PREMIUM_TRANCHE_KIND = "X_BASE_10";
const PREMIUM_FULL_TRANCHE_KIND = "X_PREMIUM_FULL_100";
const UPGRADE_TRANCHE_KIND = "X_PREMIUM_UPGRADE_90";
const DAILY_REWARD_SOURCE = "X_INTERACTION";
const GENESIS_REWARD_SOURCE = "GENESIS_AIRDROP";
const REWARD_LINEAGE_SCHEMA = "star-ascent-x-reward-lineage/v2";
const POST_ACTIONS = new Set(["original", "reply", "quote", "repost"]);
const COLLECTOR_SLOT_ACTIONS = new Set(["like", "follow"]);
const PRIVATE_ACTIONS = new Set(["bookmark", "view", "impression"]);
const FORBIDDEN_COLLECTOR_TIMESTAMP_FIELDS = ["actionOccurredAtUtc", "likeTimestampUtc", "likedAtUtc", "followTimestampUtc", "followedAtUtc"];

const assertDigest = (value, label) => {
  if (!/^[0-9a-f]{64}$/u.test(value ?? "")) throw new Error(`${label} must be a lowercase SHA-256 digest`);
  return value;
};

const assertCanonicalUnsigned = (value, label, { positive = false } = {}) => {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/u.test(value)) throw new Error(`${label} must be a canonical unsigned integer string`);
  const parsed = BigInt(value);
  if (parsed > MAX_U64 || (positive && parsed === 0n)) throw new Error(`${label} is outside the supported unsigned 64-bit range`);
  return parsed;
};

const assertStrictUtc = (value, label) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)) throw new Error(`${label} must be a canonical UTC timestamp`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString() !== value) throw new Error(`${label} must be a valid canonical UTC timestamp`);
  return parsed;
};

const assertEpochAndSnapshot = (epoch, snapshotAtUtc) => {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(epoch ?? "")) throw new Error("daily epoch must be YYYY-MM-DD");
  const epochStart = new Date(`${epoch}T00:00:00.000Z`);
  if (!Number.isFinite(epochStart.valueOf()) || epochStart.toISOString().slice(0, 10) !== epoch) throw new Error("daily epoch must be a real UTC calendar date");
  const snapshot = assertStrictUtc(snapshotAtUtc, "daily snapshot time");
  if (snapshot.getUTCHours() !== 0 || snapshot.getUTCMinutes() !== 0 || snapshot.getUTCSeconds() !== 0 || snapshot.getUTCMilliseconds() !== 0) throw new Error("daily snapshot must be exactly 00:00 UTC");
  if (snapshot.valueOf() !== epochStart.valueOf() + DAY_MILLISECONDS) throw new Error("daily snapshot must be the next 00:00 UTC after the closed epoch");
  return snapshot;
};

const assertCanonicalAmount = (value, label) => {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/u.test(value)) throw new Error(`${label} must be a canonical non-negative base-unit string`);
  const parsed = BigInt(value);
  if (parsed > MAX_U64) throw new Error(`${label} exceeds the unsigned 64-bit token amount limit`);
  return parsed;
};

const addDays = (date, days) => new Date(date.valueOf() + days * DAY_MILLISECONDS).toISOString();

const nextUtcMidnight = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)).toISOString();

const assertRewardSourceKind = (value, policy) => {
  if (!policy?.payoutTiers?.rewardSourceKinds?.includes(value) || ![DAILY_REWARD_SOURCE, GENESIS_REWARD_SOURCE].includes(value)) throw new Error(`unknown reward source kind: ${value}`);
  return value;
};

const sourceNominalAmount = (policy, rewardSourceKind) => {
  assertRewardSourceKind(rewardSourceKind, policy);
  const displayUnits = rewardSourceKind === GENESIS_REWARD_SOURCE ? policy.genesis.rewardDisplayUnits : policy.daily.rewardDisplayUnits;
  const expectedDisplayUnits = rewardSourceKind === GENESIS_REWARD_SOURCE ? 100 : 12;
  if (displayUnits !== expectedDisplayUnits) throw new Error(`reward source ${rewardSourceKind} nominal amount policy drifted`);
  return assertCanonicalAmount(baseUnits(displayUnits), `${rewardSourceKind} nominal reward`).toString();
};

const rewardCandidateCommitment = ({ rewardSourceKind, policyVersion, sourceRoundKey, sourceRoundAtUtc, sourceSnapshotDigest, sourceFinalizedSlotHash, sourceEvidenceDigest, xUserId, wallet }) => {
  if (typeof sourceRoundKey !== "string" || sourceRoundKey.length === 0 || sourceRoundKey.length > 128) throw new Error("reward source round key is invalid");
  assertStrictUtc(sourceRoundAtUtc, "reward source round time");
  assertDigest(sourceSnapshotDigest, "reward source snapshot");
  if (sourceFinalizedSlotHash !== null) assertDigest(sourceFinalizedSlotHash, "reward source finalized-slot evidence");
  assertDigest(sourceEvidenceDigest, "reward source evidence");
  assertCanonicalUnsigned(xUserId, "immutable numeric X user ID", { positive: true });
  assertSolanaPublicKey(wallet);
  return sha256(["star-ascent/x-reward-candidate/v2", rewardSourceKind, policyVersion, sourceRoundKey, sourceRoundAtUtc, sourceSnapshotDigest, sourceFinalizedSlotHash ?? "NONE", sourceEvidenceDigest, xUserId, wallet].join("|"));
};

const originalRewardClaimId = ({ rewardSourceKind, candidateCommitmentSha256, nominalAmountBaseUnits, amountBaseUnits, basisPoints, trancheKind, sourceRoundAtUtc, expiresAtUtc, hash }) => {
  assertDigest(candidateCommitmentSha256, "reward candidate commitment");
  assertCanonicalAmount(nominalAmountBaseUnits, "original nominal amount");
  assertCanonicalAmount(amountBaseUnits, "original immediate amount");
  assertStrictUtc(sourceRoundAtUtc, "original admission round");
  assertStrictUtc(expiresAtUtc, "original claim expiry");
  return sha256(["star-ascent/x-original-claim-plan/v2", rewardSourceKind, candidateCommitmentSha256, nominalAmountBaseUnits, amountBaseUnits, basisPoints, trancheKind, sourceRoundAtUtc, expiresAtUtc, hash].join("|"));
};

const buildRewardLineage = ({ rewardSourceKind, policyVersion, hash, sourceRoundKey, sourceRoundAtUtc, sourceSnapshotDigest, sourceFinalizedSlotHash, sourceEvidenceDigest, candidateCommitmentSha256, originalImmediateClaimId, wallet, xUserId, originalSubscriptionType, originalSubscriptionObservedAtUtc, activityStartSlot, nodeHistoryStartSlot, tranches, expiresAtUtc }) => {
  const lineage = {
    schema: REWARD_LINEAGE_SCHEMA,
    rewardSourceKind,
    policyVersion,
    policyHash: hash,
    sourceRoundKey,
    sourceRoundAtUtc,
    sourceSnapshotDigest,
    sourceFinalizedSlotHash,
    sourceEvidenceDigest,
    candidateCommitmentSha256,
    originalImmediateClaimId,
    wallet,
    xUserId,
    originalSubscriptionType,
    originalSubscriptionObservedAtUtc,
    activityStartSlot,
    nodeHistoryStartSlot,
    nominalAmountBaseUnits: tranches.nominalAmountBaseUnits,
    immediateAmountBaseUnits: tranches.immediateAmountBaseUnits,
    immediateBasisPoints: tranches.immediateBasisPoints,
    immediateTrancheKind: tranches.immediateTrancheKind,
    deferredAmountBaseUnits: tranches.deferredAmountBaseUnits,
    deferredBasisPoints: tranches.deferredBasisPoints,
    deferredTrancheKind: tranches.deferredTrancheKind,
    expiresAtUtc,
  };
  return { rewardLineage: lineage, rewardLineageDigest: sha256CanonicalJson(lineage) };
};

const deferredEntitlementId = ({ rewardSourceKind, rewardLineageDigest, hash }) => {
  assertDigest(rewardLineageDigest, "reward lineage");
  return sha256(`star-ascent/x-premium-upgrade-entitlement-candidate/v2|${rewardSourceKind}|${rewardLineageDigest}|${hash}`);
};

function assertDailyPolicy(identityModel, dailyModel) {
  if (!identityModel || identityModel.minimumXAccountAgeDays !== 40 || identityModel.subscriptionObservationMaximumAgeHours !== 24) throw new Error("daily identity policy is missing the exact anti-Sybil boundaries");
  if (identityModel.oauthRequired !== true || identityModel.immutableNumericXUserIdRequired !== true || identityModel.walletSignatureRequired !== true || identityModel.countryRequired !== true) throw new Error("daily identity policy must require OAuth, immutable numeric X ID, wallet signature, and country");
  if (JSON.stringify(identityModel.recognizedSubscriptionTypes) !== JSON.stringify(["None", "Basic", "Premium", "PremiumPlus"])) throw new Error("daily identity policy has unknown or reordered X subscription tiers");
  if (identityModel.subscriptionDecisionKey !== "subscription_type" || identityModel.verifiedBooleanPayoutRole !== "INFORMATIONAL_ONLY_NEVER_ELIGIBILITY_OR_AMOUNT_KEY") throw new Error("subscription_type must remain the sole payout-tier decision key");
  if (!dailyModel || dailyModel.rewardSourceKind !== DAILY_REWARD_SOURCE || JSON.stringify(dailyModel.qualifyingActions) !== JSON.stringify(["original", "reply", "quote", "repost", "like", "follow"]) || dailyModel.actionAliases?.retweet !== "repost" || dailyModel.maximumQualifyingActionsPerEpoch !== 1) throw new Error("daily action policy must contain the exact public actions, retweet alias, source kind, and one-reward limit");
}

export function dailySelectionPriority({ activityStartSlot, nodeHistoryStartSlot, xUserId, wallet }) {
  const activity = assertCanonicalUnsigned(activityStartSlot, "activityStartSlot");
  const node = assertCanonicalUnsigned(nodeHistoryStartSlot, "nodeHistoryStartSlot");
  assertCanonicalUnsigned(xUserId, "immutable numeric X user ID", { positive: true });
  assertSolanaPublicKey(wallet);
  return { activityStartSlot: activity.toString(), nodeHistoryStartSlot: node.toString(), numericXUserId: xUserId, wallet };
}

// Preserve the frozen V1 daily oversubscription lottery. Activity/node chronology
// is carried separately for the later capacity allocator and never replaces this
// snapshot-bound fair-selection rule.
export function dailySelectionScore({ epoch, snapshotDigest, finalizedSlotHash, xUserId, wallet }) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(epoch ?? "")) throw new Error("daily epoch must be YYYY-MM-DD");
  assertDigest(snapshotDigest, "daily candidate snapshot");
  assertDigest(finalizedSlotHash, "daily finalized-slot evidence");
  assertCanonicalUnsigned(xUserId, "immutable numeric X user ID", { positive: true });
  assertSolanaPublicKey(wallet);
  return sha256(`IAT_DAILY_BUDGET_V1|${epoch}|${snapshotDigest}|${finalizedSlotHash}|${xUserId}|${wallet}`);
}

function assertRewardIdentityEligibility(row, identityModel, snapshot) {
  try { assertSolanaPublicKey(row.wallet); } catch { throw new Error(`invalid public wallet: ${row.wallet}`); }
  assertCanonicalUnsigned(row.xUserId, "immutable numeric X user ID", { positive: true });
  if (row.oauthVerified !== true) throw new Error(`OAuth verification is required: ${row.xUserId}`);
  if (row.walletSignatureVerified !== true) throw new Error(`wallet-signature verification is required: ${row.xUserId}`);
  if (typeof row.countryCode !== "string" || !/^[A-Z]{2}$/u.test(row.countryCode)) throw new Error(`country selection is required: ${row.xUserId}`);
  if (Object.hasOwn(row, "verified") && typeof row.verified !== "boolean") throw new Error(`X verified boolean must be boolean when present: ${row.xUserId}`);
  if (!identityModel.recognizedSubscriptionTypes.includes(row.subscriptionType)) throw new Error(`missing or unknown X subscription observation: ${row.xUserId}`);
  const created = assertStrictUtc(row.xAccountCreatedAtUtc, "X account creation time");
  if (created.valueOf() > snapshot.valueOf() - identityModel.minimumXAccountAgeDays * DAY_MILLISECONDS) throw new Error(`X account is younger than the policy minimum: ${row.xUserId}`);
  const observed = assertStrictUtc(row.subscriptionObservedAtUtc, "X subscription observation time");
  if (observed.valueOf() > snapshot.valueOf() || observed.valueOf() < snapshot.valueOf() - identityModel.subscriptionObservationMaximumAgeHours * HOUR_MILLISECONDS) throw new Error(`X subscription observation is stale or invalid: ${row.xUserId}`);
}

function normalizeDailyAction(row, dailyModel, { epoch, snapshot, snapshotAtUtc, snapshotDigest, finalizedSlotHash, policyVersion }) {
  const actionType = dailyModel.actionAliases?.[row.actionType] ?? row.actionType;
  if (PRIVATE_ACTIONS.has(actionType)) throw new Error(`private or unattributable ${actionType} activity is forbidden`);
  if (!dailyModel.qualifyingActions.includes(actionType)) throw new Error(`ineligible daily action: ${actionType}`);
  const activityStartSlot = assertCanonicalUnsigned(row.activityStartSlot, "activityStartSlot").toString();
  const nodeHistoryStartSlot = assertCanonicalUnsigned(row.nodeHistoryStartSlot, "nodeHistoryStartSlot").toString();
  assertCanonicalUnsigned(row.actorXUserId, "action actor immutable X user ID", { positive: true });
  if (row.actorXUserId !== row.xUserId) throw new Error("action actor immutable X user ID must equal the bound X user ID");
  assertCanonicalUnsigned(row.canonicalCampaignTargetId, "canonical campaign target ID", { positive: true });
  assertDigest(row.canonicalCampaignTargetEvidenceSha256, "canonical campaign target evidence");
  const epochStart = new Date(`${epoch}T00:00:00.000Z`);
  let canonicalActionId;
  let evidenceAtUtc;
  if (POST_ACTIONS.has(actionType)) {
    canonicalActionId = assertCanonicalUnsigned(row.actionId, "canonical X post ID", { positive: true }).toString();
    const created = assertStrictUtc(row.xPostCreatedAtUtc, "canonical X post created_at");
    if (created.valueOf() < epochStart.valueOf() || created.valueOf() >= snapshot.valueOf()) throw new Error("canonical X post created_at is outside the closed UTC epoch");
    if (Object.hasOwn(row, "actionOccurredAtUtc")) throw new Error("canonical X post evidence must not contain a caller-authored occurrence timestamp");
    evidenceAtUtc = created.toISOString();
  } else if (COLLECTOR_SLOT_ACTIONS.has(actionType)) {
    if (Object.hasOwn(row, "actionId")) throw new Error(`${actionType} action ID must be derived internally, not supplied by the caller`);
    for (const field of FORBIDDEN_COLLECTOR_TIMESTAMP_FIELDS) {
      if (Object.hasOwn(row, field)) throw new Error(`${actionType} evidence must not contain a caller-authored occurrence timestamp`);
    }
    const observedSlot = assertCanonicalUnsigned(row.collectorFirstObservedFinalizedSlot, `${actionType} collector first-observed finalized slot`).toString();
    if (observedSlot !== activityStartSlot) throw new Error(`${actionType} activityStartSlot must equal the collector first-observed finalized slot`);
    const firstObserved = assertStrictUtc(row.collectorFirstObservedAtUtc, `${actionType} collector first-observed time`);
    if (firstObserved.valueOf() < epochStart.valueOf() || firstObserved.valueOf() >= snapshot.valueOf()) throw new Error(`${actionType} collector first-observed time is outside the closed UTC epoch`);
    evidenceAtUtc = firstObserved.toISOString();
    canonicalActionId = sha256(`star-ascent/x-synthetic-action/v2|${actionType}|${row.actorXUserId}|${row.canonicalCampaignTargetId}`);
  } else {
    throw new Error(`unsupported daily action: ${actionType}`);
  }
  const canonicalActionKey = sha256(`star-ascent/x-canonical-action-key/v2|${row.actorXUserId}|${canonicalActionId}`);
  const actionEvidenceSha256 = sha256([
    "star-ascent/x-action-evidence/v2",
    policyVersion,
    epoch,
    snapshotAtUtc,
    snapshotDigest,
    finalizedSlotHash,
    row.actorXUserId,
    actionType,
    canonicalActionId,
    evidenceAtUtc,
    activityStartSlot,
    nodeHistoryStartSlot,
    row.canonicalCampaignTargetId,
    row.canonicalCampaignTargetEvidenceSha256,
  ].join("|"));
  const candidateCommitmentSha256 = rewardCandidateCommitment({ rewardSourceKind: DAILY_REWARD_SOURCE, policyVersion, sourceRoundKey: epoch, sourceRoundAtUtc: snapshotAtUtc, sourceSnapshotDigest: snapshotDigest, sourceFinalizedSlotHash: finalizedSlotHash, sourceEvidenceDigest: actionEvidenceSha256, xUserId: row.xUserId, wallet: row.wallet });
  return { actionType, rawActionType: row.actionType, actionId: canonicalActionId, actorXUserId: row.actorXUserId, evidenceAtUtc, activityStartSlot, nodeHistoryStartSlot, canonicalActionKey, actionEvidenceSha256, candidateCommitmentSha256 };
}

export function rewardTranches({ nominalAmountBaseUnits, nominalDisplayUnits, subscriptionType, payoutTiers, verified }) {
  const nominal = nominalAmountBaseUnits === undefined ? BigInt(baseUnits(nominalDisplayUnits)) : assertCanonicalAmount(nominalAmountBaseUnits, "nominal reward");
  if (nominal <= 0n) throw new Error("nominal reward must be positive");
  if (!payoutTiers || payoutTiers.denominatorBasisPoints !== 10_000 || payoutTiers.nonPremiumImmediateBasisPoints !== 1_000 || payoutTiers.nonPremiumDeferredBasisPoints !== 9_000 || payoutTiers.premiumImmediateBasisPoints !== 10_000) throw new Error("reward tier policy must preserve exact 10/90 and 100% basis points");
  if (payoutTiers.trancheKinds?.nonPremiumImmediate !== NON_PREMIUM_TRANCHE_KIND || payoutTiers.trancheKinds?.premiumImmediate !== PREMIUM_FULL_TRANCHE_KIND || payoutTiers.trancheKinds?.premiumUpgrade !== UPGRADE_TRANCHE_KIND || payoutTiers.trancheBasisPoints?.[NON_PREMIUM_TRANCHE_KIND] !== 1_000 || payoutTiers.trancheBasisPoints?.[PREMIUM_FULL_TRANCHE_KIND] !== 10_000 || payoutTiers.trancheBasisPoints?.[UPGRADE_TRANCHE_KIND] !== 9_000) throw new Error("reward tier policy must preserve exact tranche-kind basis-point invariants");
  const isNonPremium = ["None", "Basic"].includes(subscriptionType);
  const isPremium = ["Premium", "PremiumPlus"].includes(subscriptionType);
  if (!isNonPremium && !isPremium) throw new Error("reward tranche requires a known X subscription observation");
  if (verified !== undefined && typeof verified !== "boolean") throw new Error("X verified signal must be boolean when present");
  const immediateBasisPoints = isNonPremium ? payoutTiers.nonPremiumImmediateBasisPoints : payoutTiers.premiumImmediateBasisPoints;
  const immediateNumerator = nominal * BigInt(immediateBasisPoints);
  if (immediateNumerator % BigInt(payoutTiers.denominatorBasisPoints) !== 0n) throw new Error("nominal reward cannot be split into an exact atomic tranche");
  const immediate = immediateNumerator / BigInt(payoutTiers.denominatorBasisPoints);
  const deferred = nominal - immediate;
  assertCanonicalAmount(immediate.toString(), "immediate reward tranche");
  assertCanonicalAmount(deferred.toString(), "deferred reward tranche");
  return {
    nominalAmountBaseUnits: nominal.toString(),
    immediateAmountBaseUnits: immediate.toString(),
    deferredAmountBaseUnits: deferred.toString(),
    immediateBasisPoints,
    deferredBasisPoints: isNonPremium ? payoutTiers.nonPremiumDeferredBasisPoints : 0,
    immediateTrancheKind: isNonPremium ? NON_PREMIUM_TRANCHE_KIND : PREMIUM_FULL_TRANCHE_KIND,
    deferredTrancheKind: isNonPremium ? UPGRADE_TRANCHE_KIND : null,
    rewardClass: REWARD_CLASS,
    subscriptionDecisionKey: "subscription_type",
    verifiedSignalIgnored: verified !== undefined,
  };
}

function assertGenesisPolicy(policy) {
  if (policy?.status !== DAILY_HOLD || policy.publicationAllowed !== false || policy.globalRewardWaterfall?.implemented !== false) throw new Error("Genesis reward policy must remain on the nonpublishing global-waterfall HOLD");
  assertDailyPolicy(policy.identityModel, policy.daily);
  if (policy.genesis?.rewardSourceKind !== GENESIS_REWARD_SOURCE || policy.genesis.rewardDisplayUnits !== 100 || policy.genesis.maximumClaims !== 1_000) throw new Error("Genesis source, nominal amount, or first-1,000 cap drifted");
  if (policy.genesis.selectionRule !== "FIRST_1000_ASCENDING_IMMUTABLE_BINDING_RESERVATION_SEQUENCE" || policy.genesis.bindingSnapshotRequirement !== "COMPLETE_AUTHENTICATED_FIRST_1000_REGISTRY_SNAPSHOT_NO_PARTIAL_OR_OMITTED_INPUT" || policy.genesis.fundingRoundRule !== "NEXT_UTC_00:00_AFTER_RESERVATION_SNAPSHOT" || policy.genesis.claimValidityInterval !== "HALF_OPEN_[FUNDING_ROUND,FUNDING_ROUND_PLUS_30_DAYS)") throw new Error("Genesis sequence, complete registry snapshot, funding round, or half-open expiry policy drifted");
}

export function selectGenesisRewardCandidates({ policy, rows, reservationSnapshotAtUtc, fundingRoundAtUtc, bindingSnapshotDigest }) {
  assertGenesisPolicy(policy);
  if (!Array.isArray(rows)) throw new Error("Genesis candidates must be an array");
  assertDigest(bindingSnapshotDigest, "Genesis binding snapshot");
  const reservationSnapshot = assertStrictUtc(reservationSnapshotAtUtc, "Genesis reservation snapshot time");
  const fundingRound = assertStrictUtc(fundingRoundAtUtc, "Genesis funding round time");
  if (fundingRound.toISOString() !== nextUtcMidnight(reservationSnapshot)) throw new Error("Genesis funding round must be the designated next UTC 00:00 after the reservation snapshot");
  const wallets = new Set();
  const xIds = new Set();
  const sequences = new Set();
  const candidates = rows.map((row) => {
    assertRewardIdentityEligibility(row, policy.identityModel, fundingRound);
    const sequence = assertCanonicalUnsigned(row.bindingReservationSequence, "immutable Genesis binding reservation sequence", { positive: true });
    const reservedAt = assertStrictUtc(row.bindingReservedAtUtc, "Genesis binding reservation time");
    if (reservedAt.valueOf() > reservationSnapshot.valueOf()) throw new Error("Genesis binding reservation occurs after the sealed reservation snapshot");
    if (row.designatedFundingRoundAtUtc !== fundingRoundAtUtc) throw new Error("Genesis candidate funding round does not match the designated next UTC 00:00");
    assertDigest(row.bindingReservationReceiptSha256, "immutable Genesis binding reservation receipt");
    const activityStartSlot = assertCanonicalUnsigned(row.activityStartSlot, "activityStartSlot").toString();
    const nodeHistoryStartSlot = assertCanonicalUnsigned(row.nodeHistoryStartSlot, "nodeHistoryStartSlot").toString();
    if (wallets.has(row.wallet)) throw new Error(`duplicate Genesis wallet: ${row.wallet}`);
    if (xIds.has(row.xUserId)) throw new Error(`duplicate Genesis X user ID: ${row.xUserId}`);
    if (sequences.has(sequence.toString())) throw new Error(`duplicate Genesis binding reservation sequence: ${sequence}`);
    wallets.add(row.wallet);
    xIds.add(row.xUserId);
    sequences.add(sequence.toString());
    const bindingEvidenceSha256 = sha256(["star-ascent/genesis-binding-evidence/v2", policy.schema, bindingSnapshotDigest, sequence, row.bindingReservedAtUtc, row.bindingReservationReceiptSha256, fundingRoundAtUtc, row.xUserId, row.wallet, row.countryCode, row.subscriptionType, row.subscriptionObservedAtUtc, activityStartSlot, nodeHistoryStartSlot].join("|"));
    const candidateCommitmentSha256 = rewardCandidateCommitment({ rewardSourceKind: GENESIS_REWARD_SOURCE, policyVersion: policy.schema, sourceRoundKey: "GENESIS", sourceRoundAtUtc: fundingRoundAtUtc, sourceSnapshotDigest: bindingSnapshotDigest, sourceFinalizedSlotHash: null, sourceEvidenceDigest: bindingEvidenceSha256, xUserId: row.xUserId, wallet: row.wallet });
    return { ...row, bindingReservationSequence: sequence.toString(), bindingEvidenceSha256, candidateCommitmentSha256, activityStartSlot, nodeHistoryStartSlot };
  });
  return candidates
    .filter(({ bindingReservationSequence }) => BigInt(bindingReservationSequence) <= BigInt(policy.genesis.maximumClaims))
    .sort((left, right) => {
      const sequence = BigInt(left.bindingReservationSequence) - BigInt(right.bindingReservationSequence);
      if (sequence !== 0n) return sequence < 0n ? -1 : 1;
      const xId = BigInt(left.xUserId) - BigInt(right.xUserId);
      if (xId !== 0n) return xId < 0n ? -1 : 1;
      return left.wallet.localeCompare(right.wallet);
    })
    .slice(0, policy.genesis.maximumClaims)
    .map((row) => ({ ...row, reservationRank: Number(row.bindingReservationSequence) }));
}

export function genesisLeafHash({ fundingRoundAtUtc, wallet, xUserId, bindingEvidenceSha256, amountBaseUnits, trancheKind, policyHash: hash }) {
  assertCanonicalAmount(amountBaseUnits, "Genesis leaf amount");
  assertDigest(bindingEvidenceSha256, "Genesis binding evidence");
  return sha256(`star-ascent/iat-reward-claim-plan/v2|${GENESIS_REWARD_SOURCE}|${fundingRoundAtUtc}|${wallet}|${xUserId}|${bindingEvidenceSha256}|${amountBaseUnits}|${trancheKind}|${hash}`);
}

export function buildGenesisRewardPlan({ mint, policy, bindingSnapshotDigest, reservationSnapshotAtUtc, fundingRoundAtUtc, rows }) {
  assertGenesisPolicy(policy);
  const winners = selectGenesisRewardCandidates({ policy, rows, reservationSnapshotAtUtc, fundingRoundAtUtc, bindingSnapshotDigest });
  if (winners.length === 0) throw new Error("Genesis plan has no first-1,000 budget-eligible reservations");
  const hash = policyHash(policy);
  const nominalAmountBaseUnits = sourceNominalAmount(policy, GENESIS_REWARD_SOURCE);
  const expiresAtUtc = addDays(assertStrictUtc(fundingRoundAtUtc, "Genesis funding round time"), policy.payoutTiers.deferredEntitlementExpiryDays);
  const claimPlans = winners.map((row) => {
    const tranches = rewardTranches({ nominalAmountBaseUnits, subscriptionType: row.subscriptionType, payoutTiers: policy.payoutTiers, verified: row.verified });
    const claimId = originalRewardClaimId({ rewardSourceKind: GENESIS_REWARD_SOURCE, candidateCommitmentSha256: row.candidateCommitmentSha256, nominalAmountBaseUnits, amountBaseUnits: tranches.immediateAmountBaseUnits, basisPoints: tranches.immediateBasisPoints, trancheKind: tranches.immediateTrancheKind, sourceRoundAtUtc: fundingRoundAtUtc, expiresAtUtc, hash });
    const lineage = buildRewardLineage({ rewardSourceKind: GENESIS_REWARD_SOURCE, policyVersion: policy.schema, hash, sourceRoundKey: "GENESIS", sourceRoundAtUtc: fundingRoundAtUtc, sourceSnapshotDigest: bindingSnapshotDigest, sourceFinalizedSlotHash: null, sourceEvidenceDigest: row.bindingEvidenceSha256, candidateCommitmentSha256: row.candidateCommitmentSha256, originalImmediateClaimId: claimId, wallet: row.wallet, xUserId: row.xUserId, originalSubscriptionType: row.subscriptionType, originalSubscriptionObservedAtUtc: row.subscriptionObservedAtUtc, activityStartSlot: row.activityStartSlot, nodeHistoryStartSlot: row.nodeHistoryStartSlot, tranches, expiresAtUtc });
    const leaf = genesisLeafHash({ fundingRoundAtUtc, wallet: row.wallet, xUserId: row.xUserId, bindingEvidenceSha256: row.bindingEvidenceSha256, amountBaseUnits: tranches.immediateAmountBaseUnits, trancheKind: tranches.immediateTrancheKind, policyHash: hash });
    return {
      claimId,
      rewardSourceKind: GENESIS_REWARD_SOURCE,
      policyHash: hash,
      policyVersion: policy.schema,
      wallet: row.wallet,
      xUserId: row.xUserId,
      countryCode: row.countryCode,
      subscriptionType: row.subscriptionType,
      subscriptionObservedAtUtc: row.subscriptionObservedAtUtc,
      subscriptionDecisionKey: "subscription_type",
      bindingReservationSequence: row.bindingReservationSequence,
      bindingReservedAtUtc: row.bindingReservedAtUtc,
      bindingReservationReceiptSha256: row.bindingReservationReceiptSha256,
      bindingEvidenceSha256: row.bindingEvidenceSha256,
      candidateCommitmentSha256: row.candidateCommitmentSha256,
      activityStartSlot: row.activityStartSlot,
      nodeHistoryStartSlot: row.nodeHistoryStartSlot,
      reservationRank: row.reservationRank,
      nominalAmountBaseUnits,
      amountBaseUnits: tranches.immediateAmountBaseUnits,
      basisPoints: tranches.immediateBasisPoints,
      trancheKind: tranches.immediateTrancheKind,
      rewardClass: tranches.rewardClass,
      ownerRewardLaneLabel: policy.payoutTiers.ownerRewardLaneLabel,
      admissionRoundAtUtc: fundingRoundAtUtc,
      expiresAtUtc,
      validityInterval: `[${fundingRoundAtUtc},${expiresAtUtc})`,
      ...lineage,
      status: DAILY_HOLD,
      admitted: false,
      reserved: false,
      publicationAllowed: false,
      leaf,
    };
  });
  const tree = buildMerkle(claimPlans.map(({ leaf }) => leaf));
  const immediateClaims = claimPlans.map((claim) => ({ ...claim, merkleProof: proofForLeaf(claim.leaf, tree) }));
  const deferredEntitlements = immediateClaims.flatMap((original) => {
    if (original.rewardLineage.deferredAmountBaseUnits === "0") return [];
    return [{
      recordKind: "X_PREMIUM_UPGRADE_90_ENTITLEMENT_CANDIDATE",
      entitlementId: deferredEntitlementId({ rewardSourceKind: GENESIS_REWARD_SOURCE, rewardLineageDigest: original.rewardLineageDigest, hash }),
      rewardSourceKind: GENESIS_REWARD_SOURCE,
      originalImmediateClaimId: original.claimId,
      policyHash: hash,
      policyVersion: policy.schema,
      createdAtUtc: fundingRoundAtUtc,
      expiresAtUtc,
      wallet: original.wallet,
      xUserId: original.xUserId,
      originalSubscriptionType: original.subscriptionType,
      originalSubscriptionObservedAtUtc: original.subscriptionObservedAtUtc,
      activityStartSlot: original.activityStartSlot,
      nodeHistoryStartSlot: original.nodeHistoryStartSlot,
      candidateCommitmentSha256: original.candidateCommitmentSha256,
      nominalAmountBaseUnits,
      amountBaseUnits: original.rewardLineage.deferredAmountBaseUnits,
      basisPoints: original.rewardLineage.deferredBasisPoints,
      trancheKind: UPGRADE_TRANCHE_KIND,
      rewardClass: REWARD_CLASS,
      ownerRewardLaneLabel: policy.payoutTiers.ownerRewardLaneLabel,
      rewardLineage: original.rewardLineage,
      rewardLineageDigest: original.rewardLineageDigest,
      entitlementState: "INACTIVE_CONDITIONAL_CANDIDATE",
      activationCondition: policy.payoutTiers.deferredEntitlementActivationRule,
      authorizationRule: policy.payoutTiers.deferredEntitlementAuthorizationRule,
      reserved: false,
      createsDebt: false,
      publicationAllowed: false,
    }];
  });
  const nominalTotal = BigInt(nominalAmountBaseUnits) * BigInt(winners.length);
  const immediateTotal = immediateClaims.reduce((total, claim) => total + BigInt(claim.amountBaseUnits), 0n);
  const deferredTotal = deferredEntitlements.reduce((total, entitlement) => total + BigInt(entitlement.amountBaseUnits), 0n);
  assertCanonicalAmount(nominalTotal.toString(), "Genesis nominal total");
  assertCanonicalAmount(immediateTotal.toString(), "Genesis immediate total");
  assertCanonicalAmount(deferredTotal.toString(), "Genesis deferred total");
  if (immediateTotal + deferredTotal !== nominalTotal) throw new Error("Genesis reward tranches do not reconcile to the exact nominal 100% total");
  return {
    schema: "star-ascent-genesis-reward-plan/v2",
    rewardSourceKind: GENESIS_REWARD_SOURCE,
    status: DAILY_HOLD,
    publicationAllowed: false,
    mint,
    policyHash: hash,
    bindingSnapshotDigest,
    bindingSnapshotRequirement: policy.genesis.bindingSnapshotRequirement,
    bindingSnapshotAuthentication: "BLOCKED_REQUIRES_DURABLE_REGISTRY_ADAPTER",
    reservationSnapshotAtUtc,
    fundingRoundAtUtc,
    expiresAtUtc,
    validityInterval: `[${fundingRoundAtUtc},${expiresAtUtc})`,
    selectionRule: policy.genesis.selectionRule,
    eligibleWalletCount: winners.length,
    nominalRewardBaseUnitsPerNode: nominalAmountBaseUnits,
    nominalTotalBaseUnits: nominalTotal.toString(),
    totalImmediateCandidateBaseUnits: immediateTotal.toString(),
    deferredEntitlementCandidateTotalBaseUnits: deferredTotal.toString(),
    candidateMerkleRoot: tree.root,
    immediateClaims,
    deferredEntitlements,
    globalRewardWaterfall: { status: DAILY_HOLD, implemented: false, publicationAllowed: false, originalAdmissionRequiredBeforeEntitlementCreation: true },
  };
}

export function selectDailyBudgetWinners({ epoch, snapshotDigest, finalizedSlotHash, policyVersion, rows, maximumClaims, identityModel, dailyModel, snapshotAtUtc }) {
  if (!Array.isArray(rows)) throw new Error("daily candidates must be an array");
  if (!Number.isSafeInteger(maximumClaims) || maximumClaims < 0) throw new Error("daily maximum claims must be a non-negative safe integer");
  assertDigest(snapshotDigest, "daily candidate snapshot");
  assertDigest(finalizedSlotHash, "daily finalized-slot evidence");
  if (policyVersion !== "star-ascent-daily-rewards-policy/v2") throw new Error("daily action commitment requires the exact policy schema version");
  const snapshot = assertEpochAndSnapshot(epoch, snapshotAtUtc);
  assertDailyPolicy(identityModel, dailyModel);
  const wallets = new Set();
  const xIds = new Set();
  const canonicalActionKeys = new Set();
  const candidates = rows.map((row) => {
    assertRewardIdentityEligibility(row, identityModel, snapshot);
    const action = normalizeDailyAction(row, dailyModel, { epoch, snapshot, snapshotAtUtc, snapshotDigest, finalizedSlotHash, policyVersion });
    if (canonicalActionKeys.has(action.canonicalActionKey)) throw new Error(`duplicate canonical daily action evidence: ${action.canonicalActionKey}`);
    if (wallets.has(row.wallet)) throw new Error(`duplicate daily wallet: ${row.wallet}`);
    if (xIds.has(row.xUserId)) throw new Error(`duplicate daily X user ID: ${row.xUserId}`);
    canonicalActionKeys.add(action.canonicalActionKey);
    wallets.add(row.wallet);
    xIds.add(row.xUserId);
    const selectionPriority = dailySelectionPriority({ ...row, ...action });
    const selectionScore = dailySelectionScore({ epoch, snapshotDigest, finalizedSlotHash, xUserId: row.xUserId, wallet: row.wallet });
    return { ...row, ...action, selectionPriority, selectionScore };
  });
  return candidates
    .sort((left, right) => left.selectionScore.localeCompare(right.selectionScore)
      || left.xUserId.localeCompare(right.xUserId)
      || left.wallet.localeCompare(right.wallet))
    .slice(0, maximumClaims)
    .map((row, index) => ({ ...row, priorityRank: index + 1 }));
}

export function dailyLeafHash({ rewardSourceKind, epoch, wallet, xUserId, actionEvidenceSha256, amountBaseUnits, trancheKind, policyHash: hash }) {
  if (rewardSourceKind !== DAILY_REWARD_SOURCE) throw new Error("daily leaf must bind X_INTERACTION reward source");
  assertCanonicalAmount(amountBaseUnits, "daily leaf amount");
  assertDigest(actionEvidenceSha256, "daily action evidence");
  return sha256(`star-ascent/iat-reward-claim-plan/v2|${rewardSourceKind}|${epoch}|${wallet}|${xUserId}|${actionEvidenceSha256}|${amountBaseUnits}|${trancheKind}|${hash}`);
}

export function buildDailyEpoch({ epoch, mint, policy, snapshotDigest, finalizedSlotHash, snapshotAtUtc, rows, publishedEpochs, consumedLifetimeBaseUnits }) {
  if (policy?.status !== DAILY_HOLD || policy.publicationAllowed !== false || policy.globalRewardWaterfall?.implemented !== false) throw new Error("daily reward policy must remain on the nonpublishing global-waterfall HOLD");
  const budget = policy.budget;
  assertDailyPolicy(policy.identityModel, policy.daily);
  assertEpochAndSnapshot(epoch, snapshotAtUtc);
  if (!Number.isSafeInteger(publishedEpochs) || publishedEpochs < 0) throw new Error("accounted epoch count must be a non-negative safe integer");
  if (publishedEpochs >= budget.maximumPublishedEpochs) throw new Error("daily campaign epoch limit exhausted");
  const consumed = assertCanonicalAmount(consumedLifetimeBaseUnits, "consumed lifetime budget");
  const lifetime = assertCanonicalAmount(budget.maximumLifetimeBaseUnits, "maximum lifetime budget");
  const epochMaximum = assertCanonicalAmount(budget.maximumEpochBaseUnits, "maximum epoch budget");
  if (consumed > lifetime) throw new Error("consumed lifetime budget exceeds the policy maximum");
  const nominalAmountBaseUnits = sourceNominalAmount(policy, DAILY_REWARD_SOURCE);
  const perClaim = BigInt(nominalAmountBaseUnits);
  const remaining = lifetime - consumed;
  if (remaining < perClaim) throw new Error("daily campaign lifetime budget exhausted");
  const remainingClaims = remaining / perClaim;
  const epochClaims = epochMaximum / perClaim;
  const policyClaims = BigInt(policy.daily.maximumClaimsPerEpoch);
  const maximumClaims = Number([remainingClaims, epochClaims, policyClaims].reduce((minimum, value) => value < minimum ? value : minimum));
  const winners = selectDailyBudgetWinners({ epoch, snapshotDigest, finalizedSlotHash, policyVersion: policy.schema, rows, maximumClaims, identityModel: policy.identityModel, dailyModel: policy.daily, snapshotAtUtc });
  if (winners.length === 0) throw new Error("daily epoch has no budget-eligible winners");

  const hash = policyHash(policy);
  const expiresAtUtc = addDays(assertStrictUtc(snapshotAtUtc, "daily snapshot time"), policy.daily.claimExpiryDays);
  const claimPlans = winners.map((row) => {
    const tranches = rewardTranches({ nominalAmountBaseUnits, subscriptionType: row.subscriptionType, payoutTiers: policy.payoutTiers, verified: row.verified });
    const claimId = originalRewardClaimId({ rewardSourceKind: DAILY_REWARD_SOURCE, candidateCommitmentSha256: row.candidateCommitmentSha256, nominalAmountBaseUnits, amountBaseUnits: tranches.immediateAmountBaseUnits, basisPoints: tranches.immediateBasisPoints, trancheKind: tranches.immediateTrancheKind, sourceRoundAtUtc: snapshotAtUtc, expiresAtUtc, hash });
    const lineage = buildRewardLineage({ rewardSourceKind: DAILY_REWARD_SOURCE, policyVersion: policy.schema, hash, sourceRoundKey: epoch, sourceRoundAtUtc: snapshotAtUtc, sourceSnapshotDigest: snapshotDigest, sourceFinalizedSlotHash: finalizedSlotHash, sourceEvidenceDigest: row.actionEvidenceSha256, candidateCommitmentSha256: row.candidateCommitmentSha256, originalImmediateClaimId: claimId, wallet: row.wallet, xUserId: row.xUserId, originalSubscriptionType: row.subscriptionType, originalSubscriptionObservedAtUtc: row.subscriptionObservedAtUtc, activityStartSlot: row.activityStartSlot, nodeHistoryStartSlot: row.nodeHistoryStartSlot, tranches, expiresAtUtc });
    const leaf = dailyLeafHash({ rewardSourceKind: DAILY_REWARD_SOURCE, epoch, wallet: row.wallet, xUserId: row.xUserId, actionEvidenceSha256: row.actionEvidenceSha256, amountBaseUnits: tranches.immediateAmountBaseUnits, trancheKind: tranches.immediateTrancheKind, policyHash: hash });
    return {
      claimId,
      rewardSourceKind: DAILY_REWARD_SOURCE,
      policyHash: hash,
      wallet: row.wallet,
      xUserId: row.xUserId,
      countryCode: row.countryCode,
      subscriptionType: row.subscriptionType,
      subscriptionObservedAtUtc: row.subscriptionObservedAtUtc,
      actionType: row.actionType,
      rawActionType: row.rawActionType,
      actionId: row.actionId,
      actorXUserId: row.actorXUserId,
      actionEvidenceAtUtc: row.evidenceAtUtc,
      canonicalActionKey: row.canonicalActionKey,
      actionEvidenceSha256: row.actionEvidenceSha256,
      candidateCommitmentSha256: row.candidateCommitmentSha256,
      policyVersion: policy.schema,
      snapshotDigest,
      finalizedSlotHash,
      canonicalCampaignTargetId: row.canonicalCampaignTargetId,
      canonicalCampaignTargetEvidenceSha256: row.canonicalCampaignTargetEvidenceSha256,
      activityStartSlot: row.activityStartSlot,
      nodeHistoryStartSlot: row.nodeHistoryStartSlot,
      selectionPriority: row.selectionPriority,
      priorityRank: row.priorityRank,
      nominalAmountBaseUnits: tranches.nominalAmountBaseUnits,
      amountBaseUnits: tranches.immediateAmountBaseUnits,
      basisPoints: tranches.immediateBasisPoints,
      trancheKind: tranches.immediateTrancheKind,
      rewardClass: tranches.rewardClass,
      ownerRewardLaneLabel: policy.payoutTiers.ownerRewardLaneLabel,
      admissionRoundAtUtc: snapshotAtUtc,
      expiresAtUtc,
      validityInterval: `[${snapshotAtUtc},${expiresAtUtc})`,
      ...lineage,
      status: DAILY_HOLD,
      admitted: false,
      reserved: false,
      publicationAllowed: false,
      leaf,
    };
  });
  const tree = buildMerkle(claimPlans.map(({ leaf }) => leaf));
  const immediateClaims = claimPlans.map((claim) => ({ ...claim, merkleProof: proofForLeaf(claim.leaf, tree) }));
  const deferredEntitlements = winners.flatMap((row, index) => {
    const tranches = rewardTranches({ nominalAmountBaseUnits, subscriptionType: row.subscriptionType, payoutTiers: policy.payoutTiers, verified: row.verified });
    if (tranches.deferredAmountBaseUnits === "0") return [];
    const original = immediateClaims[index];
    return [{
      recordKind: "X_PREMIUM_UPGRADE_90_ENTITLEMENT_CANDIDATE",
      entitlementId: deferredEntitlementId({ rewardSourceKind: DAILY_REWARD_SOURCE, rewardLineageDigest: original.rewardLineageDigest, hash }),
      rewardSourceKind: DAILY_REWARD_SOURCE,
      originalImmediateClaimId: original.claimId,
      originalEpoch: epoch,
      policyHash: hash,
      policyVersion: policy.schema,
      snapshotDigest,
      finalizedSlotHash,
      createdAtUtc: snapshotAtUtc,
      expiresAtUtc,
      wallet: row.wallet,
      xUserId: row.xUserId,
      originalSubscriptionType: row.subscriptionType,
      originalSubscriptionObservedAtUtc: row.subscriptionObservedAtUtc,
      activityStartSlot: row.activityStartSlot,
      nodeHistoryStartSlot: row.nodeHistoryStartSlot,
      canonicalActionKey: row.canonicalActionKey,
      actionEvidenceSha256: row.actionEvidenceSha256,
      candidateCommitmentSha256: row.candidateCommitmentSha256,
      nominalAmountBaseUnits: tranches.nominalAmountBaseUnits,
      amountBaseUnits: tranches.deferredAmountBaseUnits,
      basisPoints: tranches.deferredBasisPoints,
      trancheKind: tranches.deferredTrancheKind,
      rewardClass: tranches.rewardClass,
      ownerRewardLaneLabel: policy.payoutTiers.ownerRewardLaneLabel,
      rewardLineage: original.rewardLineage,
      rewardLineageDigest: original.rewardLineageDigest,
      status: "HOLD_PENDING_ORIGINAL_X_BASE_10_ADMISSION",
      entitlementState: "INACTIVE_CONDITIONAL_CANDIDATE",
      activationCondition: policy.payoutTiers.deferredEntitlementActivationRule,
      authorizationRule: policy.payoutTiers.deferredEntitlementAuthorizationRule,
      reserved: false,
      createsDebt: false,
      retryAllowedAfterUnfundedRound: false,
      publicationAllowed: false,
    }];
  });
  const nominalTotal = perClaim * BigInt(winners.length);
  const immediateTotal = immediateClaims.reduce((total, claim) => total + BigInt(claim.amountBaseUnits), 0n);
  const deferredTotal = deferredEntitlements.reduce((total, entitlement) => total + BigInt(entitlement.amountBaseUnits), 0n);
  assertCanonicalAmount(nominalTotal.toString(), "daily nominal total");
  assertCanonicalAmount(immediateTotal.toString(), "daily immediate total");
  assertCanonicalAmount(deferredTotal.toString(), "daily deferred total");
  if (nominalTotal > epochMaximum || consumed + nominalTotal > lifetime) throw new Error("daily epoch exceeds an exact nominal budget cap");
  if (immediateTotal + deferredTotal !== nominalTotal) throw new Error("daily reward tranches do not reconcile to the nominal 100% budget");
  return {
    schema: "star-ascent-daily-reward-plan/v2",
    rewardSourceKind: DAILY_REWARD_SOURCE,
    status: DAILY_HOLD,
    publicationAllowed: false,
    epoch,
    mint,
    policyHash: hash,
    snapshotAtUtc,
    snapshotDigest,
    finalizedSlotHash,
    selectionRule: budget.oversubscriptionRule,
    eligibleWalletCount: winners.length,
    nominalRewardBaseUnitsPerNode: perClaim.toString(),
    nominalTotalBaseUnits: nominalTotal.toString(),
    nominalLifetimeConsumedAfterEpochBaseUnits: (consumed + nominalTotal).toString(),
    totalClaimableBaseUnits: immediateTotal.toString(),
    totalImmediateCandidateBaseUnits: immediateTotal.toString(),
    deferredEntitlementCandidateTotalBaseUnits: deferredTotal.toString(),
    candidateMerkleRoot: tree.root,
    merkleRoot: tree.root,
    immediateClaims,
    deferredEntitlements,
    globalRewardWaterfall: {
      status: policy.globalRewardWaterfall.status,
      implemented: false,
      publicationAllowed: false,
      originalAdmissionRequiredBeforeEntitlementCreation: true,
    },
  };
}

function verifyDeferredEntitlementLineage({ entitlement, policy, immutableLedgerReceiptDigest }) {
  if (policy.payoutTiers.deferredEntitlementAuthorizationRule !== "TYPED_BUILDER_LINEAGE_PLUS_AUTHENTICATED_IMMUTABLE_ORIGINAL_ADMISSION_LEDGER_RECEIPT_DIGEST" || entitlement?.authorizationRule !== policy.payoutTiers.deferredEntitlementAuthorizationRule) throw new Error("deferred entitlement typed-lineage authorization policy mismatch");
  for (const attackerFlag of ["active", "originalTrancheAdmitted", "entitlementCreated"]) {
    if (Object.hasOwn(entitlement ?? {}, attackerFlag)) throw new Error(`mutable ${attackerFlag} flag cannot authorize a deferred entitlement`);
  }
  if (entitlement?.recordKind !== "X_PREMIUM_UPGRADE_90_ENTITLEMENT" || entitlement.status !== "PENDING_PREMIUM_UPGRADE" || entitlement.entitlementState !== "ACTIVE_FROM_IMMUTABLE_FULL_ADMISSION_RECEIPT") throw new Error("deferred entitlement is not typed as active from an immutable full-admission receipt");
  assertDigest(immutableLedgerReceiptDigest, "immutable original-admission ledger receipt");
  if (entitlement.originalAdmissionReceiptDigest !== immutableLedgerReceiptDigest) throw new Error("immutable original-admission ledger receipt does not match the entitlement");
  const lineage = entitlement.rewardLineage;
  if (!lineage || lineage.schema !== REWARD_LINEAGE_SCHEMA) throw new Error("deferred entitlement is missing typed reward lineage");
  assertDigest(entitlement.rewardLineageDigest, "reward lineage");
  if (sha256CanonicalJson(lineage) !== entitlement.rewardLineageDigest) throw new Error("deferred entitlement reward lineage digest mismatch");
  const rewardSourceKind = assertRewardSourceKind(lineage.rewardSourceKind, policy);
  const hash = policyHash(policy);
  if (lineage.policyVersion !== policy.schema || lineage.policyHash !== hash || entitlement.policyVersion !== policy.schema || entitlement.policyHash !== hash) throw new Error("deferred entitlement policy commitment does not match the active held policy");
  const nominalAmountBaseUnits = sourceNominalAmount(policy, rewardSourceKind);
  if (lineage.nominalAmountBaseUnits !== nominalAmountBaseUnits || entitlement.nominalAmountBaseUnits !== nominalAmountBaseUnits) throw new Error("deferred entitlement nominal amount does not match its exact policy reward source");
  const tranches = rewardTranches({ nominalAmountBaseUnits, subscriptionType: lineage.originalSubscriptionType, payoutTiers: policy.payoutTiers });
  if (tranches.immediateTrancheKind !== NON_PREMIUM_TRANCHE_KIND || tranches.immediateBasisPoints !== 1_000 || tranches.deferredTrancheKind !== UPGRADE_TRANCHE_KIND || tranches.deferredBasisPoints !== 9_000) throw new Error("deferred entitlement source was not an exact 10/90 non-Premium reward");
  for (const [actual, expected, label] of [
    [lineage.immediateAmountBaseUnits, tranches.immediateAmountBaseUnits, "lineage immediate amount"],
    [lineage.deferredAmountBaseUnits, tranches.deferredAmountBaseUnits, "lineage deferred amount"],
    [entitlement.amountBaseUnits, tranches.deferredAmountBaseUnits, "entitlement deferred amount"],
  ]) {
    assertCanonicalAmount(actual, label);
    if (actual !== expected) throw new Error(`${label} does not match exact policy-source tranche math`);
  }
  if (lineage.immediateBasisPoints !== 1_000 || lineage.immediateTrancheKind !== NON_PREMIUM_TRANCHE_KIND || lineage.deferredBasisPoints !== 9_000 || lineage.deferredTrancheKind !== UPGRADE_TRANCHE_KIND || entitlement.basisPoints !== 9_000 || entitlement.trancheKind !== UPGRADE_TRANCHE_KIND || entitlement.rewardClass !== REWARD_CLASS) throw new Error("deferred entitlement tranche kind/basis-point invariant mismatch");
  const expectedCandidateCommitment = rewardCandidateCommitment({ rewardSourceKind, policyVersion: lineage.policyVersion, sourceRoundKey: lineage.sourceRoundKey, sourceRoundAtUtc: lineage.sourceRoundAtUtc, sourceSnapshotDigest: lineage.sourceSnapshotDigest, sourceFinalizedSlotHash: lineage.sourceFinalizedSlotHash, sourceEvidenceDigest: lineage.sourceEvidenceDigest, xUserId: lineage.xUserId, wallet: lineage.wallet });
  if (lineage.candidateCommitmentSha256 !== expectedCandidateCommitment || entitlement.candidateCommitmentSha256 !== expectedCandidateCommitment) throw new Error("deferred entitlement candidate commitment mismatch");
  const expectedClaimId = originalRewardClaimId({ rewardSourceKind, candidateCommitmentSha256: expectedCandidateCommitment, nominalAmountBaseUnits, amountBaseUnits: tranches.immediateAmountBaseUnits, basisPoints: tranches.immediateBasisPoints, trancheKind: tranches.immediateTrancheKind, sourceRoundAtUtc: lineage.sourceRoundAtUtc, expiresAtUtc: lineage.expiresAtUtc, hash });
  if (lineage.originalImmediateClaimId !== expectedClaimId || entitlement.originalImmediateClaimId !== expectedClaimId) throw new Error("deferred entitlement original claim commitment mismatch");
  const expectedEntitlementId = deferredEntitlementId({ rewardSourceKind, rewardLineageDigest: entitlement.rewardLineageDigest, hash });
  if (entitlement.entitlementId !== expectedEntitlementId) throw new Error("deferred entitlement commitment mismatch");
  for (const field of ["rewardSourceKind", "wallet", "xUserId", "originalSubscriptionType", "originalSubscriptionObservedAtUtc", "activityStartSlot", "nodeHistoryStartSlot", "expiresAtUtc"]) {
    if (entitlement[field] !== lineage[field]) throw new Error(`deferred entitlement ${field} does not match immutable reward lineage`);
  }
  if (entitlement.createdAtUtc !== lineage.sourceRoundAtUtc) throw new Error("deferred entitlement creation time does not match its original funding round");
  const created = assertStrictUtc(lineage.sourceRoundAtUtc, "original reward funding round");
  const expires = assertStrictUtc(lineage.expiresAtUtc, "deferred entitlement expiry time");
  if (expires.valueOf() !== created.valueOf() + policy.payoutTiers.deferredEntitlementExpiryDays * DAY_MILLISECONDS) throw new Error("deferred entitlement must retain the exact original 30-day half-open expiry");
  return { lineage, rewardSourceKind, tranches, created, expires };
}

export function resolveDeferredPremiumEntitlement(input) {
  if (Object.hasOwn(input, "availableLaneBaseUnits")) throw new Error("the pure upgrade preparer must not accept caller-supplied reward-lane capacity");
  const { entitlement, policy, immutableLedgerReceiptDigest, wallet, xUserId, subscriptionType, subscriptionObservedAtUtc, premiumProofAcceptedAtUtc, premiumProofAcceptedFinalizedSlot, roundAtUtc } = input;
  if (policy?.status !== DAILY_HOLD || policy.publicationAllowed !== false) throw new Error("deferred upgrade resolution requires the nonpublishing policy HOLD");
  if (policy.identityModel?.subscriptionObservationMaximumAgeHours !== 24
    || policy.payoutTiers?.upgradeTierRule !== "FRESH_PREMIUM_OR_PREMIUMPLUS_OBSERVED_LATER_AND_FRESH_AT_PROOF_ACCEPTANCE_BEFORE_EXPIRY"
    || policy.payoutTiers?.upgradeProofAcceptanceTimeRule !== "AT_OR_AFTER_OBSERVATION_AFTER_ORIGINAL_FUNDING_ROUND_AND_BEFORE_EXPIRY"
    || policy.payoutTiers?.upgradeDecisionBoundary !== "NEXT_UTC_00:00_STRICTLY_AFTER_PREMIUM_PROOF_ACCEPTANCE") {
    throw new Error("Premium upgrade proof-acceptance timing policy drifted");
  }
  const { lineage, rewardSourceKind, tranches, created, expires } = verifyDeferredEntitlementLineage({ entitlement, policy, immutableLedgerReceiptDigest });
  if (wallet !== entitlement.wallet || xUserId !== entitlement.xUserId) throw new Error("Premium upgrade identity must match the original immutable X ID and wallet");
  assertCanonicalUnsigned(xUserId, "immutable numeric X user ID", { positive: true });
  try { assertSolanaPublicKey(wallet); } catch { throw new Error("Premium upgrade wallet must remain a valid Solana public key"); }
  if (!["Premium", "PremiumPlus"].includes(subscriptionType)) throw new Error("deferred entitlement requires a fresh Premium or PremiumPlus observation");
  const originalObserved = assertStrictUtc(lineage.originalSubscriptionObservedAtUtc, "original X subscription observation time");
  const observed = assertStrictUtc(subscriptionObservedAtUtc, "Premium upgrade observation time");
  const proofAcceptedAt = assertStrictUtc(premiumProofAcceptedAtUtc, "Premium proof acceptance time");
  const round = assertStrictUtc(roundAtUtc, "Premium upgrade round time");
  if (observed.valueOf() <= originalObserved.valueOf() || observed.valueOf() <= created.valueOf() || observed.valueOf() >= expires.valueOf()) throw new Error("Premium upgrade must be observed later and before the original expiry");
  if (proofAcceptedAt.valueOf() < observed.valueOf()) throw new Error("Premium proof acceptance must be at or after the fresh Premium observation");
  if (proofAcceptedAt.valueOf() <= created.valueOf() || proofAcceptedAt.valueOf() >= expires.valueOf()) throw new Error("Premium proof acceptance must be after the original funding round and before the original expiry");
  if (proofAcceptedAt.valueOf() - observed.valueOf() > policy.identityModel.subscriptionObservationMaximumAgeHours * HOUR_MILLISECONDS) throw new Error("Premium upgrade observation is stale at proof acceptance");
  if (round.toISOString() !== nextUtcMidnight(proofAcceptedAt)) throw new Error("Premium upgrade may be decided only at the first UTC 00:00 strictly after proof acceptance");
  if (round.valueOf() >= expires.valueOf()) throw new Error("Premium upgrade decision falls on or after the original expiry");
  const originalActivity = assertCanonicalUnsigned(lineage.activityStartSlot, "original activityStartSlot");
  const nodeHistory = assertCanonicalUnsigned(lineage.nodeHistoryStartSlot, "nodeHistoryStartSlot");
  const proofAccepted = assertCanonicalUnsigned(premiumProofAcceptedFinalizedSlot, "Premium proof accepted finalized slot");
  if (proofAccepted <= originalActivity || proofAccepted <= nodeHistory) throw new Error("Premium proof acceptance must be later than the original activity and node-history start slots");
  const priorityActivity = [originalActivity, nodeHistory, proofAccepted].reduce((maximum, value) => value > maximum ? value : maximum);
  const amount = assertCanonicalAmount(tranches.deferredAmountBaseUnits, "deferred entitlement amount");
  const obligationId = sha256(`star-ascent/x-premium-upgrade-obligation/v2|${rewardSourceKind}|${entitlement.rewardLineageDigest}|${immutableLedgerReceiptDigest}|${entitlement.entitlementId}|${subscriptionType}|${subscriptionObservedAtUtc}|${premiumProofAcceptedAtUtc}|${proofAccepted}|${roundAtUtc}|${amount}|${policyHash(policy)}`);
  return {
    schema: "star-ascent-x-premium-upgrade-obligation-candidate/v2",
    obligationId,
    rewardSourceKind,
    rewardLineageDigest: entitlement.rewardLineageDigest,
    originalAdmissionReceiptDigest: immutableLedgerReceiptDigest,
    entitlementId: entitlement.entitlementId,
    originalImmediateClaimId: entitlement.originalImmediateClaimId,
    wallet,
    xUserId,
    subscriptionType,
    subscriptionObservedAtUtc,
    premiumProofAcceptedAtUtc,
    premiumProofAcceptedFinalizedSlot: proofAccepted.toString(),
    roundAtUtc,
    expiresAtUtc: lineage.expiresAtUtc,
    trancheKind: UPGRADE_TRANCHE_KIND,
    rewardClass: REWARD_CLASS,
    ownerRewardLaneLabel: policy.payoutTiers.ownerRewardLaneLabel,
    selectionPriority: {
      activityStartSlot: priorityActivity.toString(),
      nodeHistoryStartSlot: nodeHistory.toString(),
      numericXUserId: xUserId,
      wallet,
    },
    eligibility: "ELIGIBLE_FOR_EXACT_NEXT_UTC_00:00_GLOBAL_WATERFALL",
    amountBaseUnits: amount.toString(),
    allocatorDecision: null,
    allocatorMustDecideAtomically: true,
    entitlementConsumed: false,
    terminal: false,
    partialPaymentAllowed: false,
    createsDebt: false,
    retryAllowedAfterAllocatorDecision: false,
    status: DAILY_HOLD,
    publicationAllowed: false,
  };
}

export function leafHash({ epoch, wallet, amountBaseUnits, policyHash: hash }) {
  return sha256(`star-ascent/iat-claim/v1|${epoch}|${wallet}|${amountBaseUnits}|${hash}`);
}

const parentHash = (left, right) => sha256(left < right ? `${left}${right}` : `${right}${left}`);

export function buildMerkle(leaves) {
  if (leaves.length === 0) throw new Error("cannot build a Merkle tree without leaves");
  let level = [...leaves].sort();
  const levels = [level];
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) next.push(index + 1 < level.length ? parentHash(level[index], level[index + 1]) : level[index]);
    level = next;
    levels.push(level);
  }
  return { root: level[0], levels };
}

export function proofForLeaf(leaf, tree) {
  let target = leaf;
  const proof = [];
  for (const level of tree.levels.slice(0, -1)) {
    const index = level.indexOf(target);
    if (index < 0) throw new Error("leaf is absent from tree");
    const sibling = index % 2 === 0 ? level[index + 1] : level[index - 1];
    if (sibling) proof.push(sibling);
    target = sibling ? parentHash(target, sibling) : target;
  }
  return proof;
}

export function verifyProof({ leaf, proof, root }) {
  return proof.reduce((current, sibling) => parentHash(current, sibling), leaf) === root;
}

export function buildEpoch({ epoch, mint, policyHash: hash, rows, maximumClaims }) {
  validateRows(rows, maximumClaims);
  const claims = rows.map((row) => ({
    wallet: row.wallet,
    amountDisplayUnits: row.amountDisplayUnits,
    amountBaseUnits: baseUnits(row.amountDisplayUnits),
    sourcePostIds: [...new Set(row.sourcePostIds ?? [])].sort(),
  })).sort((a, b) => a.wallet.localeCompare(b.wallet));
  const leaves = claims.map((claim) => leafHash({ epoch, wallet: claim.wallet, amountBaseUnits: claim.amountBaseUnits, policyHash: hash }));
  const tree = buildMerkle(leaves);
  return {
    epoch,
    mint,
    policyHash: hash,
    eligibleWalletCount: claims.length,
    totalClaimableBaseUnits: claims.reduce((total, claim) => total + BigInt(claim.amountBaseUnits), 0n).toString(),
    merkleRoot: tree.root,
    claims: claims.map((claim, index) => ({ ...claim, leaf: leaves[index], merkleProof: proofForLeaf(leaves[index], tree) })),
  };
}

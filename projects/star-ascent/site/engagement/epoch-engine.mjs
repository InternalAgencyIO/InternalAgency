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

export function dailySelectionScore({ epoch, snapshotDigest, finalizedSlotHash, xUserId, wallet }) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(epoch ?? "")) throw new Error("daily epoch must be YYYY-MM-DD");
  if (!/^[0-9a-f]{64}$/u.test(snapshotDigest ?? "") || !/^[0-9a-f]{64}$/u.test(finalizedSlotHash ?? "")) throw new Error("daily selection requires lowercase SHA-256 snapshot and finalized-slot hashes");
  if (!/^[0-9]{1,32}$/u.test(xUserId ?? "")) throw new Error("daily selection requires an immutable numeric X user ID");
  assertSolanaPublicKey(wallet);
  return sha256(`IAT_DAILY_BUDGET_V1|${epoch}|${snapshotDigest}|${finalizedSlotHash}|${xUserId}|${wallet}`);
}

function assertDailyIdentityEligibility(row, identityModel, snapshotAtUtc) {
  const snapshot = new Date(snapshotAtUtc);
  const created = new Date(row.xAccountCreatedAtUtc);
  const premiumObserved = new Date(row.premiumObservedAtUtc);
  if (!Number.isFinite(snapshot.valueOf())) throw new Error("daily snapshot time must be valid UTC");
  if (!identityModel.allowedSubscriptionTypes.includes(row.subscriptionType)) throw new Error(`ineligible X subscription tier: ${row.xUserId}`);
  if (!Number.isFinite(created.valueOf()) || created.valueOf() > snapshot.valueOf() - identityModel.minimumXAccountAgeDays * 86_400_000) throw new Error(`X account is younger than the policy minimum: ${row.xUserId}`);
  if (!Number.isFinite(premiumObserved.valueOf()) || premiumObserved.valueOf() > snapshot.valueOf() || premiumObserved.valueOf() < snapshot.valueOf() - identityModel.premiumObservationMaximumAgeHours * 3_600_000) throw new Error(`X Premium observation is stale or invalid: ${row.xUserId}`);
}

export function selectDailyBudgetWinners({ epoch, snapshotDigest, finalizedSlotHash, rows, maximumClaims, identityModel, snapshotAtUtc }) {
  if (!Array.isArray(rows)) throw new Error("daily candidates must be an array");
  if (!Number.isSafeInteger(maximumClaims) || maximumClaims < 0) throw new Error("daily maximum claims must be a non-negative safe integer");
  if (!identityModel || identityModel.minimumXAccountAgeDays !== 40 || identityModel.premiumObservationMaximumAgeHours !== 24) throw new Error("daily identity policy is missing the exact anti-Sybil boundaries");
  const wallets = new Set(), xIds = new Set();
  const scored = rows.map((row) => {
    assertDailyIdentityEligibility(row, identityModel, snapshotAtUtc);
    if (wallets.has(row.wallet)) throw new Error(`duplicate daily wallet: ${row.wallet}`);
    if (xIds.has(row.xUserId)) throw new Error(`duplicate daily X user ID: ${row.xUserId}`);
    wallets.add(row.wallet);
    xIds.add(row.xUserId);
    return { ...row, selectionScore: dailySelectionScore({ epoch, snapshotDigest, finalizedSlotHash, xUserId: row.xUserId, wallet: row.wallet }) };
  });
  return scored.sort((left, right) => left.selectionScore.localeCompare(right.selectionScore) || left.xUserId.localeCompare(right.xUserId) || left.wallet.localeCompare(right.wallet)).slice(0, maximumClaims);
}

export function buildDailyEpoch({ epoch, mint, policy, snapshotDigest, finalizedSlotHash, snapshotAtUtc, rows, publishedEpochs, consumedLifetimeBaseUnits }) {
  const budget = policy.budget;
  if (!Number.isSafeInteger(publishedEpochs) || publishedEpochs < 0) throw new Error("published epoch count must be a non-negative safe integer");
  if (publishedEpochs >= budget.maximumPublishedEpochs) throw new Error("daily campaign epoch limit exhausted");
  const consumed = BigInt(consumedLifetimeBaseUnits);
  const lifetime = BigInt(budget.maximumLifetimeBaseUnits);
  const perClaim = BigInt(baseUnits(policy.daily.rewardDisplayUnits));
  const remaining = lifetime - consumed;
  if (remaining < perClaim) throw new Error("daily campaign lifetime budget exhausted");
  const remainingClaims = remaining / perClaim;
  const maximumClaims = Number(remainingClaims < BigInt(policy.daily.maximumClaimsPerEpoch) ? remainingClaims : BigInt(policy.daily.maximumClaimsPerEpoch));
  const winners = selectDailyBudgetWinners({ epoch, snapshotDigest, finalizedSlotHash, rows, maximumClaims, identityModel: policy.identityModel, snapshotAtUtc });
  if (winners.length === 0) throw new Error("daily epoch has no budget-eligible winners");
  const result = buildEpoch({
    epoch,
    mint,
    policyHash: policyHash(policy),
    maximumClaims,
    rows: winners.map((row) => ({ wallet: row.wallet, amountDisplayUnits: policy.daily.rewardDisplayUnits, sourcePostIds: row.sourcePostIds })),
  });
  if (BigInt(result.totalClaimableBaseUnits) > BigInt(budget.maximumEpochBaseUnits)) throw new Error("daily epoch exceeds the exact epoch budget");
  if (consumed + BigInt(result.totalClaimableBaseUnits) > lifetime) throw new Error("daily epoch exceeds the exact lifetime budget");
  return { ...result, snapshotDigest, finalizedSlotHash, selectionRule: budget.oversubscriptionRule };
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

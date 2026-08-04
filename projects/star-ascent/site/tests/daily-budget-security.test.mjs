import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildDailyEpoch, policyHash, selectDailyBudgetWinners, validateRows } from "../engagement/epoch-engine.mjs";
import { encodeBase58 } from "../engagement/solana-wallet-proof.mjs";

const policy = JSON.parse(readFileSync(new URL("../engagement/reward-policy.v1.json", import.meta.url), "utf8"));
const snapshotDigest = "ab".repeat(32);
const finalizedSlotHash = "cd".repeat(32);
const SNAPSHOT_AT = "2026-08-03T00:00:00.000Z";
const walletFor = (index) => {
  const bytes = Buffer.alloc(32);
  bytes[0] = 1;
  bytes.writeUInt32BE(index, 28);
  return encodeBase58(bytes);
};
const rows = (count, snapshotAtUtc = SNAPSHOT_AT) => Array.from({ length: count }, (_, index) => ({
  wallet: walletFor(index + 1),
  xUserId: String(9_000_000_000_000_000n + BigInt(index)),
  xAccountCreatedAtUtc: new Date(new Date(snapshotAtUtc).valueOf() - 41 * 86_400_000).toISOString(),
  subscriptionType: "Premium",
  premiumObservedAtUtc: new Date(new Date(snapshotAtUtc).valueOf() - 3_600_000).toISOString(),
  sourcePostIds: [String(8_000_000_000_000_000n + BigInt(index))],
}));

test("policy hash uses canonical JSON rather than insertion order", () => {
  assert.equal(policyHash({ alpha: 1, nested: { beta: 2, gamma: 3 } }), policyHash({ nested: { gamma: 3, beta: 2 }, alpha: 1 }));
});

test("wallet validation rejects Base58-shaped values that are not exact 32-byte public keys", () => {
  assert.throws(() => validateRows([{ wallet: "22222222222222222222222222222222", amountDisplayUnits: 12 }], 1), /invalid public wallet/);
  assert.doesNotThrow(() => validateRows([{ wallet: walletFor(1), amountDisplayUnits: 12 }], 1));
});

test("10,000 qualifying pairs deterministically produce no more than 1,000 budget winners", () => {
  const candidates = rows(10_000);
  const forward = selectDailyBudgetWinners({ epoch: "2026-08-02", snapshotDigest, finalizedSlotHash, rows: candidates, maximumClaims: 1_000, identityModel: policy.identityModel, snapshotAtUtc: SNAPSHOT_AT });
  const reverse = selectDailyBudgetWinners({ epoch: "2026-08-02", snapshotDigest, finalizedSlotHash, rows: [...candidates].reverse(), maximumClaims: 1_000, identityModel: policy.identityModel, snapshotAtUtc: SNAPSHOT_AT });
  assert.equal(forward.length, 1_000);
  assert.deepEqual(forward.map(({ wallet }) => wallet), reverse.map(({ wallet }) => wallet));
  assert.equal(new Set(forward.map(({ selectionScore }) => selectionScore)).size, 1_000);
});

test("daily epoch enforces 12,000 IAT epoch cap and 4,380,000 IAT lifetime cap", () => {
  const epoch = buildDailyEpoch({
    epoch: "2026-08-02",
    mint: "MINT_PUBLISHED_AFTER_VERIFICATION",
    policy,
    snapshotDigest,
    finalizedSlotHash,
    snapshotAtUtc: SNAPSHOT_AT,
    rows: rows(1_005),
    publishedEpochs: 0,
    consumedLifetimeBaseUnits: "0",
  });
  assert.equal(epoch.eligibleWalletCount, 1_000);
  assert.equal(epoch.totalClaimableBaseUnits, policy.budget.maximumEpochBaseUnits);
  assert.equal(epoch.selectionRule, "IAT_DAILY_BUDGET_V1_ASCENDING_SHA256");

  const oneClaimRemaining = buildDailyEpoch({
    epoch: "2027-07-31",
    mint: "MINT_PUBLISHED_AFTER_VERIFICATION",
    policy,
    snapshotDigest,
    finalizedSlotHash,
    snapshotAtUtc: "2027-08-01T00:00:00.000Z",
    rows: rows(10, "2027-08-01T00:00:00.000Z"),
    publishedEpochs: 364,
    consumedLifetimeBaseUnits: (BigInt(policy.budget.maximumLifetimeBaseUnits) - 12_000_000_000n).toString(),
  });
  assert.equal(oneClaimRemaining.eligibleWalletCount, 1);
  assert.equal(oneClaimRemaining.totalClaimableBaseUnits, "12000000000");
  assert.throws(() => buildDailyEpoch({ epoch: "2027-08-01", mint: "mint", policy, snapshotDigest, finalizedSlotHash, snapshotAtUtc: "2027-08-02T00:00:00.000Z", rows: rows(1, "2027-08-02T00:00:00.000Z"), publishedEpochs: 365, consumedLifetimeBaseUnits: "0" }), /epoch limit exhausted/);
  assert.throws(() => buildDailyEpoch({ epoch: "2027-07-31", mint: "mint", policy, snapshotDigest, finalizedSlotHash, snapshotAtUtc: "2027-08-01T00:00:00.000Z", rows: rows(1, "2027-08-01T00:00:00.000Z"), publishedEpochs: 364, consumedLifetimeBaseUnits: policy.budget.maximumLifetimeBaseUnits }), /lifetime budget exhausted/);
});

test("daily selection rejects duplicate wallet or immutable X identity", () => {
  const [first, second] = rows(2);
  const args = { epoch: "2026-08-02", snapshotDigest, finalizedSlotHash, maximumClaims: 2, identityModel: policy.identityModel, snapshotAtUtc: SNAPSHOT_AT };
  assert.throws(() => selectDailyBudgetWinners({ ...args, rows: [first, { ...second, wallet: first.wallet }] }), /duplicate daily wallet/);
  assert.throws(() => selectDailyBudgetWinners({ ...args, rows: [first, { ...second, xUserId: first.xUserId }] }), /duplicate daily X user ID/);
});

test("daily selection rejects young, non-Premium, and stale-Premium identities", () => {
  const [candidate] = rows(1);
  const args = { epoch: "2026-08-02", snapshotDigest, finalizedSlotHash, maximumClaims: 1, identityModel: policy.identityModel, snapshotAtUtc: SNAPSHOT_AT };
  assert.throws(() => selectDailyBudgetWinners({ ...args, rows: [{ ...candidate, xAccountCreatedAtUtc: "2026-06-24T00:00:00.001Z" }] }), /younger/);
  assert.throws(() => selectDailyBudgetWinners({ ...args, rows: [{ ...candidate, subscriptionType: "Basic" }] }), /subscription tier/);
  assert.throws(() => selectDailyBudgetWinners({ ...args, rows: [{ ...candidate, premiumObservedAtUtc: "2026-08-01T23:59:59.999Z" }] }), /stale/);
});

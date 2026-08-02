import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const nodeChallenges = sqliteTable("node_challenges", {
  id: text("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  nonceHash: text("nonce_hash").notNull(),
  origin: text("origin").notNull(),
  issuedAtUtc: text("issued_at_utc").notNull(),
  expiresAtUtc: text("expires_at_utc").notNull(),
  consumedAtUtc: text("consumed_at_utc"),
});

export const nodeChallengeRateLimits = sqliteTable("node_challenge_rate_limits", {
  subjectHash: text("subject_hash").primaryKey(),
  nextAllowedAtUtc: text("next_allowed_at_utc").notNull(),
  updatedAtUtc: text("updated_at_utc").notNull(),
});

export const networkReadRateLimits = sqliteTable("network_read_rate_limits", {
  subjectHash: text("subject_hash").primaryKey(),
  windowStartUtc: text("window_start_utc").notNull(),
  requestCount: integer("request_count").notNull(),
}, (table) => [
  check("network_read_rate_limits_positive", sql`${table.requestCount} >= 1`),
]);

export const nodeBindings = sqliteTable("node_bindings", {
  id: text("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  xUserId: text("x_user_id"),
  xAccountCreatedAtUtc: text("x_account_created_at_utc"),
  countryCode: text("country_code"),
  sessionNonceHash: text("session_nonce_hash"),
  sessionExpiresAtUtc: text("session_expires_at_utc"),
  oauthNonceHash: text("oauth_nonce_hash"),
  oauthExpiresAtUtc: text("oauth_expires_at_utc"),
  xSubscriptionType: text("x_subscription_type", { enum: ["Premium", "PremiumPlus"] }),
  xPremiumObservedAtUtc: text("x_premium_observed_at_utc"),
  xPremiumRevalidateAfterUtc: text("x_premium_revalidate_after_utc"),
  state: text("state", { enum: ["pending", "active", "held"] }).notNull().default("pending"),
  genesisSlot: integer("genesis_slot"),
  createdAtUtc: text("created_at_utc").notNull(),
  activatedAtUtc: text("activated_at_utc"),
}, (table) => [
  uniqueIndex("node_bindings_wallet_unique").on(table.walletAddress),
  uniqueIndex("node_bindings_x_user_unique").on(table.xUserId),
  uniqueIndex("node_bindings_genesis_slot_unique").on(table.genesisSlot),
]);

export const genesisSlots = sqliteTable("genesis_slots", {
  slotNumber: integer("slot_number").primaryKey(),
  nodeBindingId: text("node_binding_id").notNull().references(() => nodeBindings.id),
  amountBaseUnits: text("amount_base_units").notNull(),
  reservedAtUtc: text("reserved_at_utc").notNull(),
  claimStatus: text("claim_status", { enum: ["reserved", "held", "claimed", "expired"] }).notNull().default("reserved"),
  claimTransaction: text("claim_transaction"),
  claimedAtUtc: text("claimed_at_utc"),
}, (table) => [
  uniqueIndex("genesis_slots_node_binding_unique").on(table.nodeBindingId),
  check("genesis_slots_number_range", sql`${table.slotNumber} BETWEEN 1 AND 1000`),
  check("genesis_slots_amount_exact", sql`${table.amountBaseUnits} = '100000000000'`),
]);

export const rewardEpochs = sqliteTable("reward_epochs", {
  id: text("id").primaryKey(),
  epochDateUtc: text("epoch_date_utc").notNull(),
  state: text("state", { enum: ["collecting", "published", "held"] }).notNull().default("collecting"),
  policyHash: text("policy_hash").notNull(),
  merkleRoot: text("merkle_root"),
  manifestDigest: text("manifest_digest"),
  eligibleWalletCount: integer("eligible_wallet_count").notNull().default(0),
  totalClaimableBaseUnits: text("total_claimable_base_units").notNull().default("0"),
  publishedAtUtc: text("published_at_utc"),
}, (table) => [uniqueIndex("reward_epochs_date_unique").on(table.epochDateUtc)]);

export const rewardClaims = sqliteTable("reward_claims", {
  id: text("id").primaryKey(),
  epochId: text("epoch_id").notNull().references(() => rewardEpochs.id),
  walletAddress: text("wallet_address").notNull(),
  amountBaseUnits: text("amount_base_units").notNull(),
  leaf: text("leaf").notNull(),
  proofJson: text("proof_json").notNull(),
  state: text("state", { enum: ["eligible", "held", "claimed", "expired"] }).notNull().default("eligible"),
  claimTransaction: text("claim_transaction"),
  createdAtUtc: text("created_at_utc").notNull(),
  claimedAtUtc: text("claimed_at_utc"),
}, (table) => [uniqueIndex("reward_claims_epoch_wallet_unique").on(table.epochId, table.walletAddress)]);

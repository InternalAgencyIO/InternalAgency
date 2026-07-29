import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const nodeBindings = sqliteTable("node_bindings", {
  id: text("id").primaryKey(),
  walletAddress: text("wallet_address").notNull(),
  xUserId: text("x_user_id"),
  countryCode: text("country_code"),
  state: text("state", { enum: ["pending", "active", "held"] }).notNull().default("pending"),
  genesisSlot: integer("genesis_slot"),
  createdAtUtc: text("created_at_utc").notNull(),
  activatedAtUtc: text("activated_at_utc"),
}, (table) => [
  uniqueIndex("node_bindings_wallet_unique").on(table.walletAddress),
  uniqueIndex("node_bindings_x_user_unique").on(table.xUserId),
  uniqueIndex("node_bindings_genesis_slot_unique").on(table.genesisSlot),
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

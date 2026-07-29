CREATE TABLE `node_bindings` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_address` text NOT NULL,
	`x_user_id` text,
	`state` text DEFAULT 'pending' NOT NULL,
	`genesis_slot` integer,
	`created_at_utc` text NOT NULL,
	`activated_at_utc` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `node_bindings_wallet_unique` ON `node_bindings` (`wallet_address`);--> statement-breakpoint
CREATE UNIQUE INDEX `node_bindings_x_user_unique` ON `node_bindings` (`x_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `node_bindings_genesis_slot_unique` ON `node_bindings` (`genesis_slot`);--> statement-breakpoint
CREATE TABLE `node_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`wallet_address` text NOT NULL,
	`nonce_hash` text NOT NULL,
	`origin` text NOT NULL,
	`issued_at_utc` text NOT NULL,
	`expires_at_utc` text NOT NULL,
	`consumed_at_utc` text
);
--> statement-breakpoint
CREATE TABLE `reward_claims` (
	`id` text PRIMARY KEY NOT NULL,
	`epoch_id` text NOT NULL,
	`wallet_address` text NOT NULL,
	`amount_base_units` text NOT NULL,
	`leaf` text NOT NULL,
	`proof_json` text NOT NULL,
	`state` text DEFAULT 'eligible' NOT NULL,
	`claim_transaction` text,
	`created_at_utc` text NOT NULL,
	`claimed_at_utc` text,
	FOREIGN KEY (`epoch_id`) REFERENCES `reward_epochs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reward_claims_epoch_wallet_unique` ON `reward_claims` (`epoch_id`,`wallet_address`);--> statement-breakpoint
CREATE TABLE `reward_epochs` (
	`id` text PRIMARY KEY NOT NULL,
	`epoch_date_utc` text NOT NULL,
	`state` text DEFAULT 'collecting' NOT NULL,
	`policy_hash` text NOT NULL,
	`merkle_root` text,
	`manifest_digest` text,
	`eligible_wallet_count` integer DEFAULT 0 NOT NULL,
	`total_claimable_base_units` text DEFAULT '0' NOT NULL,
	`published_at_utc` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reward_epochs_date_unique` ON `reward_epochs` (`epoch_date_utc`);
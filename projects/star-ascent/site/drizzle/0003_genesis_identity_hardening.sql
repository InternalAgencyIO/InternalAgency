CREATE TABLE `genesis_slots` (
	`slot_number` integer PRIMARY KEY NOT NULL,
	`node_binding_id` text NOT NULL,
	`amount_base_units` text NOT NULL,
	`reserved_at_utc` text NOT NULL,
	`claim_status` text DEFAULT 'reserved' NOT NULL CHECK (`claim_status` IN ('reserved', 'held', 'claimed', 'expired')),
	`claim_transaction` text,
	`claimed_at_utc` text,
	FOREIGN KEY (`node_binding_id`) REFERENCES `node_bindings`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "genesis_slots_number_range" CHECK("genesis_slots"."slot_number" BETWEEN 1 AND 1000),
	CONSTRAINT "genesis_slots_amount_exact" CHECK("genesis_slots"."amount_base_units" = '100000000000')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `genesis_slots_node_binding_unique` ON `genesis_slots` (`node_binding_id`);--> statement-breakpoint
ALTER TABLE `node_bindings` ADD `session_nonce_hash` text;--> statement-breakpoint
ALTER TABLE `node_bindings` ADD `session_expires_at_utc` text;--> statement-breakpoint
ALTER TABLE `node_bindings` ADD `oauth_nonce_hash` text;--> statement-breakpoint
ALTER TABLE `node_bindings` ADD `oauth_expires_at_utc` text;--> statement-breakpoint
ALTER TABLE `node_bindings` ADD `x_subscription_type` text;--> statement-breakpoint
ALTER TABLE `node_bindings` ADD `x_premium_observed_at_utc` text;--> statement-breakpoint
ALTER TABLE `node_bindings` ADD `x_premium_revalidate_after_utc` text;

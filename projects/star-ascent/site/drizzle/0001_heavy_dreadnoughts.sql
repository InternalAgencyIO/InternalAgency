CREATE TABLE `node_challenge_rate_limits` (
	`subject_hash` text PRIMARY KEY NOT NULL,
	`next_allowed_at_utc` text NOT NULL,
	`updated_at_utc` text NOT NULL
);

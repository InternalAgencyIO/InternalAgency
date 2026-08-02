CREATE TABLE `network_read_rate_limits` (
	`subject_hash` text PRIMARY KEY NOT NULL,
	`window_start_utc` text NOT NULL,
	`request_count` integer NOT NULL,
	CONSTRAINT "network_read_rate_limits_positive" CHECK("network_read_rate_limits"."request_count" >= 1)
);

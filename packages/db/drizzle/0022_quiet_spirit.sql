CREATE TABLE `trust_grants` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_type` text NOT NULL,
	`subject_key` text NOT NULL,
	`checksum` text NOT NULL,
	`reason` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `trust_grants_subject_type_idx` ON `trust_grants` (`subject_type`);--> statement-breakpoint
CREATE INDEX `trust_grants_subject_key_idx` ON `trust_grants` (`subject_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `trust_grants_unique` ON `trust_grants` (`subject_type`,`subject_key`,`checksum`);
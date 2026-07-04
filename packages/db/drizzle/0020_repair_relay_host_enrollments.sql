CREATE TABLE IF NOT EXISTS `relay_host_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`relay_url` text NOT NULL,
	`room_id` text NOT NULL,
	`host_pubkey` text NOT NULL,
	`host_private_key_secret_id` text NOT NULL,
	`pinned_controller_pubkey` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`pairing_code` text,
	`last_error` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `relay_host_enrollments_status_idx` ON `relay_host_enrollments` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `relay_host_enrollments_room_idx` ON `relay_host_enrollments` (`room_id`);

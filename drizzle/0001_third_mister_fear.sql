CREATE TABLE `project_evidence_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`evidence_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`from_status` text DEFAULT '' NOT NULL,
	`to_status` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `project_evidence_events_item_idx` ON `project_evidence_events` (`evidence_id`);--> statement-breakpoint
CREATE TABLE `project_evidence_items` (
	`id` text PRIMARY KEY NOT NULL,
	`project_slug` text NOT NULL,
	`target_type` text NOT NULL,
	`target_key` text NOT NULL,
	`claim_value` text DEFAULT '' NOT NULL,
	`source_label` text NOT NULL,
	`internal_note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`file_key` text,
	`file_name` text,
	`content_type` text,
	`file_size` integer,
	`file_sha256` text,
	`created_by` text NOT NULL,
	`reviewed_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`reviewed_at` text,
	`published_at` text
);
--> statement-breakpoint
CREATE INDEX `project_evidence_project_idx` ON `project_evidence_items` (`project_slug`);--> statement-breakpoint
CREATE INDEX `project_evidence_status_idx` ON `project_evidence_items` (`status`);--> statement-breakpoint
CREATE INDEX `project_evidence_project_target_idx` ON `project_evidence_items` (`project_slug`,`target_type`,`target_key`);
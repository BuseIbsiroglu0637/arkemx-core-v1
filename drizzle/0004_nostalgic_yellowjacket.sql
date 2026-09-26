CREATE TABLE `project_intake_files` (
	`id` text PRIMARY KEY NOT NULL,
	`intake_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`file_sha256` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_intake_files_object_idx` ON `project_intake_files` (`object_key`);--> statement-breakpoint
CREATE INDEX `project_intake_files_intake_idx` ON `project_intake_files` (`intake_id`);--> statement-breakpoint
CREATE TABLE `project_intakes` (
	`id` text PRIMARY KEY NOT NULL,
	`reference_code` text NOT NULL,
	`name` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`location` text NOT NULL,
	`building_type` text NOT NULL,
	`area` text DEFAULT '' NOT NULL,
	`stage` text NOT NULL,
	`request_type` text NOT NULL,
	`message` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_intakes_reference_idx` ON `project_intakes` (`reference_code`);--> statement-breakpoint
CREATE INDEX `project_intakes_created_idx` ON `project_intakes` (`created_at`);--> statement-breakpoint
CREATE INDEX `project_intakes_status_idx` ON `project_intakes` (`status`);
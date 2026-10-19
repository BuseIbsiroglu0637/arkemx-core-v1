CREATE TABLE `customer_activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_email` text NOT NULL,
	`event_type` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_activities_owner_idx` ON `customer_activities` (`owner_email`);--> statement-breakpoint
CREATE TABLE `customer_meetings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`project_id` text DEFAULT '' NOT NULL,
	`subject` text NOT NULL,
	`meeting_at` text NOT NULL,
	`channel` text DEFAULT 'Teknik görüşme' NOT NULL,
	`status` text DEFAULT 'Planlandı' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_meetings_owner_idx` ON `customer_meetings` (`owner_email`);--> statement-breakpoint
CREATE TABLE `customer_profiles` (
	`email` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`preferred_language` text DEFAULT 'tr' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`name` text NOT NULL,
	`phase` text DEFAULT 'Başlangıç' NOT NULL,
	`revision` text DEFAULT 'R00' NOT NULL,
	`status` text DEFAULT 'Taslak' NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `customer_projects_owner_idx` ON `customer_projects` (`owner_email`);--> statement-breakpoint
CREATE UNIQUE INDEX `customer_projects_owner_id_idx` ON `customer_projects` (`owner_email`,`id`);
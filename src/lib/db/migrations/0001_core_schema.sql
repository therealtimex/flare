CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`industry` text,
	`size` text,
	`hq` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `accounts_domain_idx` ON `accounts` (`domain`);--> statement-breakpoint
CREATE INDEX `accounts_status_idx` ON `accounts` (`status`);--> statement-breakpoint
CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_kind` text NOT NULL,
	`tool` text NOT NULL,
	`summary` text NOT NULL,
	`entity_type` text,
	`entity_id` integer,
	`lead_id` integer,
	`data` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_created_idx` ON `activity` (`created_at`);--> statement-breakpoint
CREATE INDEX `activity_lead_idx` ON `activity` (`lead_id`);--> statement-breakpoint
CREATE TABLE `credits` (
	`id` integer PRIMARY KEY NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `edges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`from_type` text NOT NULL,
	`from_id` integer NOT NULL,
	`to_type` text NOT NULL,
	`to_id` integer NOT NULL,
	`type` text NOT NULL,
	`meta` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `edges_from_idx` ON `edges` (`from_type`,`from_id`);--> statement-breakpoint
CREATE INDEX `edges_to_idx` ON `edges` (`to_type`,`to_id`);--> statement-breakpoint
CREATE INDEX `edges_type_idx` ON `edges` (`type`);--> statement-breakpoint
CREATE TABLE `icps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`industries` text DEFAULT '[]' NOT NULL,
	`size_bands` text DEFAULT '[]' NOT NULL,
	`personas` text DEFAULT '[]' NOT NULL,
	`triggers` text DEFAULT '[]' NOT NULL,
	`confidence` text DEFAULT '{"industries":0,"sizeBands":0,"personas":0,"triggers":0}' NOT NULL,
	`expansions` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `icps_product_idx` ON `icps` (`product_id`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`person_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`fit_score` real DEFAULT 0 NOT NULL,
	`tier` text DEFAULT 'C' NOT NULL,
	`rationale` text DEFAULT '' NOT NULL,
	`stage` text DEFAULT 'matched' NOT NULL,
	`owner_kind` text DEFAULT 'agent' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `leads_person_product_idx` ON `leads` (`person_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `leads_stage_idx` ON `leads` (`stage`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lead_id` integer NOT NULL,
	`channel` text NOT NULL,
	`step` integer DEFAULT 1 NOT NULL,
	`variant` text DEFAULT 'A' NOT NULL,
	`subject` text,
	`body` text NOT NULL,
	`signals_used` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`decided_by` text,
	`decided_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_lead_idx` ON `messages` (`lead_id`);--> statement-breakpoint
CREATE INDEX `messages_status_idx` ON `messages` (`status`);--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`title` text,
	`account_id` integer,
	`linkedin_url` text,
	`email` text,
	`email_status` text DEFAULT 'unverified' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `people_account_idx` ON `people` (`account_id`);--> statement-breakpoint
CREATE INDEX `people_status_idx` ON `people` (`status`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`website` text,
	`description` text NOT NULL,
	`pricing` text,
	`customers` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `schools` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`domain` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`account_id` integer NOT NULL,
	`kind` text NOT NULL,
	`summary` text NOT NULL,
	`date` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `signals_account_idx` ON `signals` (`account_id`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`url` text NOT NULL,
	`quote` text,
	`retrieved_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sources_entity_idx` ON `sources` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `usage_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event` text NOT NULL,
	`units` integer DEFAULT 1 NOT NULL,
	`lead_id` integer,
	`flexprice_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `usage_events_event_idx` ON `usage_events` (`event`);
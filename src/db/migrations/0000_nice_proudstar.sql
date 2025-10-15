CREATE TABLE `admin_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_keys_key_hash_unique` ON `admin_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `admin_keys_key_hash_idx` ON `admin_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `admin_keys_workspace_idx` ON `admin_keys` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `guardrails` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`checks` text NOT NULL,
	`actions` text,
	`async` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `guardrails_workspace_idx` ON `guardrails` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `prompt_partials` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`template` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `prompt_partials_workspace_idx` ON `prompt_partials` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `prompt_partials_name_idx` ON `prompt_partials` (`name`);--> statement-breakpoint
CREATE TABLE `prompt_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_id` text NOT NULL,
	`version` integer NOT NULL,
	`template` text NOT NULL,
	`variables` text,
	`params` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`prompt_id`) REFERENCES `prompts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `prompt_versions_prompt_idx` ON `prompt_versions` (`prompt_id`);--> statement-breakpoint
CREATE INDEX `prompt_versions_status_idx` ON `prompt_versions` (`status`);--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`folder` text,
	`description` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `prompts_workspace_idx` ON `prompts` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `prompts_name_idx` ON `prompts` (`name`);--> statement-breakpoint
CREATE TABLE `provider_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`provider` text NOT NULL,
	`encrypted_key` text NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `provider_keys_workspace_provider_idx` ON `provider_keys` (`workspace_id`,`provider`);--> statement-breakpoint
CREATE TABLE `rate_limit_usage` (
	`id` text PRIMARY KEY NOT NULL,
	`virtual_key_id` text NOT NULL,
	`window_start` integer NOT NULL,
	`requests_count` integer DEFAULT 0 NOT NULL,
	`tokens_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`virtual_key_id`) REFERENCES `virtual_keys`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rate_limit_usage_virtual_key_window_idx` ON `rate_limit_usage` (`virtual_key_id`,`window_start`);--> statement-breakpoint
CREATE TABLE `request_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`virtual_key_id` text NOT NULL,
	`model` text,
	`provider` text,
	`endpoint` text NOT NULL,
	`method` text NOT NULL,
	`status_code` integer NOT NULL,
	`tokens_used` integer DEFAULT 0 NOT NULL,
	`response_time` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`virtual_key_id`) REFERENCES `virtual_keys`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `request_logs_workspace_idx` ON `request_logs` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `request_logs_virtual_key_idx` ON `request_logs` (`virtual_key_id`);--> statement-breakpoint
CREATE INDEX `request_logs_created_at_idx` ON `request_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `request_logs_model_idx` ON `request_logs` (`model`);--> statement-breakpoint
CREATE INDEX `request_logs_status_code_idx` ON `request_logs` (`status_code`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'viewer' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_workspace_idx` ON `users` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `virtual_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider_key_id` text NOT NULL,
	`key_hash` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`rate_limit_rpm` integer,
	`rate_limit_tpm` integer,
	`allowed_models` text,
	`metadata` text,
	`created_by` text,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`is_active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_key_id`) REFERENCES `provider_keys`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `virtual_keys_key_hash_unique` ON `virtual_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `virtual_keys_key_hash_idx` ON `virtual_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `virtual_keys_workspace_idx` ON `virtual_keys` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `virtual_keys_provider_key_idx` ON `virtual_keys` (`provider_key_id`);--> statement-breakpoint
CREATE TABLE `workspace_guardrails` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`guardrail_id` text NOT NULL,
	`virtual_key_id` text,
	`mode` text DEFAULT 'observe' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`guardrail_id`) REFERENCES `guardrails`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`virtual_key_id`) REFERENCES `virtual_keys`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_guardrails_workspace_idx` ON `workspace_guardrails` (`workspace_id`);--> statement-breakpoint
CREATE INDEX `workspace_guardrails_guardrail_idx` ON `workspace_guardrails` (`guardrail_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

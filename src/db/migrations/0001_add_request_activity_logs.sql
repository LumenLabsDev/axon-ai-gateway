CREATE TABLE `request_activity_logs` (
        `id` text PRIMARY KEY NOT NULL,
        `workspace_id` text,
        `virtual_key_id` text,
        `method` text NOT NULL,
        `endpoint` text NOT NULL,
        `status_code` integer NOT NULL,
        `duration` integer,
        `request_options` text,
        `created_at` integer NOT NULL,
        FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE set null,
        FOREIGN KEY (`virtual_key_id`) REFERENCES `virtual_keys`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `request_activity_logs_workspace_idx` ON `request_activity_logs` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `request_activity_logs_created_at_idx` ON `request_activity_logs` (`created_at`);
--> statement-breakpoint
CREATE INDEX `request_activity_logs_status_idx` ON `request_activity_logs` (`status_code`);

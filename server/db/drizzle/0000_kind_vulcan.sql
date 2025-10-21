CREATE TABLE `service_logs` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`service_id` bigint unsigned NOT NULL,
	`data` json NOT NULL,
	`record_id` bigint unsigned NOT NULL,
	`recorded_at` timestamp NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `service_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `services` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` varchar(255) NOT NULL,
	`type` tinyint NOT NULL DEFAULT 1,
	`status` tinyint NOT NULL DEFAULT 1,
	`res_status_api_url` varchar(255) NOT NULL,
	`res_status_api_key` text NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `services_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_refresh_tokens` (
	`id` varchar(36) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`token` varchar(255) NOT NULL,
	`is_revoked` tinyint DEFAULT 0,
	`device_info` varchar(255),
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `user_refresh_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	`deleted_at` timestamp,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `service_logs` ADD CONSTRAINT `service_logs_service_id_services_id_fk` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_refresh_tokens` ADD CONSTRAINT `user_refresh_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_service_logs_service_id` ON `service_logs` (`service_id`);--> statement-breakpoint
CREATE INDEX `idx_refresh_tokens_user_id` ON `user_refresh_tokens` (`user_id`);
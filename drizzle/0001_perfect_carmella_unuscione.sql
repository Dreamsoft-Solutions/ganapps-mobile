CREATE TABLE `ganap_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`cached_at` integer NOT NULL
);
--> statement-breakpoint
DROP TABLE `feature_cache`;
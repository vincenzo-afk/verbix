CREATE TABLE `importIngestionJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`requestedById` int NOT NULL,
	`status` enum('queued','fetching','extracting','completed','partial','blocked','failed') NOT NULL DEFAULT 'queued',
	`candidatesCreated` int NOT NULL DEFAULT 0,
	`outputsFound` int NOT NULL DEFAULT 0,
	`errorMessage` varchar(500),
	`startedAt` timestamp,
	`finishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `importIngestionJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `import_ingestion_jobs_source_idx` ON `importIngestionJobs` (`sourceId`);--> statement-breakpoint
CREATE INDEX `import_ingestion_jobs_status_idx` ON `importIngestionJobs` (`status`);
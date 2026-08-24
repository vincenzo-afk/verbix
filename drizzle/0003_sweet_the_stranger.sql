CREATE TABLE `importCandidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceId` int NOT NULL,
	`submittedById` int NOT NULL,
	`sourcePromptText` text NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`structuredPrompt` text NOT NULL,
	`modality` enum('text','image','video','code','audio','three_d') NOT NULL DEFAULT 'text',
	`modelHints` json NOT NULL,
	`variables` json NOT NULL,
	`constraints` json NOT NULL,
	`outputFormat` text NOT NULL,
	`acceptanceCriteria` json NOT NULL,
	`confidence` int NOT NULL DEFAULT 0,
	`normalizationProvider` varchar(80) NOT NULL,
	`status` enum('pending_review','approved','rejected','duplicate','promoted') NOT NULL DEFAULT 'pending_review',
	`duplicatePromptId` int,
	`promotedPromptId` int,
	`reviewedById` int,
	`reviewedAt` timestamp,
	`reviewerNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `importCandidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `importExampleOutputs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`candidateId` int NOT NULL,
	`sourceUrl` text NOT NULL,
	`mediaUrl` text NOT NULL,
	`mediaType` enum('image','video','audio','other') NOT NULL,
	`altText` varchar(500),
	`rightsState` enum('public_reference','permission_confirmed','unknown','excluded') NOT NULL DEFAULT 'public_reference',
	`status` enum('pending_review','approved','rejected') NOT NULL DEFAULT 'pending_review',
	`reviewedById` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `importExampleOutputs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `importSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`submittedById` int NOT NULL,
	`submittedUrl` text NOT NULL,
	`urlHash` varchar(64) NOT NULL,
	`canonicalUrl` text,
	`domain` varchar(255) NOT NULL,
	`pageTitle` varchar(360),
	`displayedAuthor` varchar(240),
	`licenseNotice` text,
	`robotsState` enum('unknown','allowed','blocked','unavailable') NOT NULL DEFAULT 'unknown',
	`status` enum('submitted','fetching','extracted','blocked','failed','archived') NOT NULL DEFAULT 'submitted',
	`httpStatus` int,
	`contentHash` varchar(64),
	`excerpt` text,
	`failureReason` varchar(500),
	`fetchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `importSources_id` PRIMARY KEY(`id`),
	CONSTRAINT `importSources_urlHash_unique` UNIQUE(`urlHash`)
);
--> statement-breakpoint
ALTER TABLE `prompts` ADD `importCandidateId` int;--> statement-breakpoint
ALTER TABLE `prompts` ADD `sourceAttribution` varchar(240);--> statement-breakpoint
ALTER TABLE `prompts` ADD `sourceUrl` text;--> statement-breakpoint
ALTER TABLE `prompts` ADD `sourceLicense` text;--> statement-breakpoint
CREATE INDEX `import_candidates_source_idx` ON `importCandidates` (`sourceId`);--> statement-breakpoint
CREATE INDEX `import_candidates_status_idx` ON `importCandidates` (`status`);--> statement-breakpoint
CREATE INDEX `import_example_outputs_candidate_idx` ON `importExampleOutputs` (`candidateId`);--> statement-breakpoint
CREATE INDEX `import_example_outputs_status_idx` ON `importExampleOutputs` (`status`);--> statement-breakpoint
CREATE INDEX `import_sources_submitter_idx` ON `importSources` (`submittedById`);--> statement-breakpoint
CREATE INDEX `import_sources_status_idx` ON `importSources` (`status`);
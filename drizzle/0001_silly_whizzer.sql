CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(96) NOT NULL,
	`name` varchar(120) NOT NULL,
	`description` text,
	`accent` varchar(24) NOT NULL DEFAULT 'teal',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `creatorAnalytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creatorId` int NOT NULL,
	`promptId` int NOT NULL,
	`metricDate` timestamp NOT NULL,
	`views` int NOT NULL DEFAULT 0,
	`runs` int NOT NULL DEFAULT 0,
	`saves` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `creatorAnalytics_id` PRIMARY KEY(`id`),
	CONSTRAINT `creator_analytics_unique` UNIQUE(`creatorId`,`promptId`,`metricDate`)
);
--> statement-breakpoint
CREATE TABLE `deployedAgents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promptId` int NOT NULL,
	`ownerId` int NOT NULL,
	`slug` varchar(144) NOT NULL,
	`name` varchar(180) NOT NULL,
	`isPublic` boolean NOT NULL DEFAULT false,
	`isEnabled` boolean NOT NULL DEFAULT true,
	`rateLimitPerHour` int NOT NULL DEFAULT 30,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deployedAgents_id` PRIMARY KEY(`id`),
	CONSTRAINT `deployedAgents_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `moderationRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`targetType` enum('prompt','review','tag','category','report') NOT NULL,
	`targetId` int NOT NULL,
	`action` enum('approve','reject','hide','restore','archive','dismiss_report') NOT NULL,
	`reason` text,
	`moderatorId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `moderationRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promptImprovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promptId` int,
	`userId` int,
	`originalPrompt` text NOT NULL,
	`improvedPrompt` text NOT NULL,
	`intentSummary` text NOT NULL,
	`assumptions` json NOT NULL,
	`missingInformation` json NOT NULL,
	`variables` json NOT NULL,
	`constraints` json NOT NULL,
	`outputFormat` text NOT NULL,
	`acceptanceCriteria` json NOT NULL,
	`agentNotes` text NOT NULL,
	`warnings` json NOT NULL,
	`provider` varchar(48) NOT NULL,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `promptImprovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promptReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promptId` int NOT NULL,
	`reporterId` int NOT NULL,
	`reason` varchar(280) NOT NULL,
	`details` text,
	`status` enum('open','reviewed','dismissed','actioned') NOT NULL DEFAULT 'open',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `promptReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promptRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promptId` int,
	`promptVersionId` int,
	`userId` int,
	`provider` varchar(80) NOT NULL,
	`model` varchar(120) NOT NULL,
	`inputPayload` json,
	`outputPreview` text,
	`status` enum('queued','running','completed','failed','cancelled') NOT NULL DEFAULT 'queued',
	`errorCode` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `promptRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promptTags` (
	`promptId` int NOT NULL,
	`tagId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prompt_tags_unique` UNIQUE(`promptId`,`tagId`)
);
--> statement-breakpoint
CREATE TABLE `promptVariables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promptId` int NOT NULL,
	`name` varchar(120) NOT NULL,
	`label` varchar(180) NOT NULL,
	`description` varchar(500),
	`variableType` enum('text','number','select') NOT NULL DEFAULT 'text',
	`defaultValue` text,
	`options` json,
	`isRequired` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `promptVariables_id` PRIMARY KEY(`id`),
	CONSTRAINT `prompt_variables_unique` UNIQUE(`promptId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `promptVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promptId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`body` text NOT NULL,
	`changeNote` varchar(500),
	`source` enum('manual','ai_improvement','restore') NOT NULL DEFAULT 'manual',
	`createdById` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `promptVersions_id` PRIMARY KEY(`id`),
	CONSTRAINT `prompt_versions_unique` UNIQUE(`promptId`,`versionNumber`)
);
--> statement-breakpoint
CREATE TABLE `prompts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(144) NOT NULL,
	`title` varchar(180) NOT NULL,
	`description` text NOT NULL,
	`body` text NOT NULL,
	`promptType` enum('text','image','video','code','audio','three_d') NOT NULL DEFAULT 'text',
	`visibility` enum('public','unlisted','private') NOT NULL DEFAULT 'public',
	`status` enum('draft','submitted','published','rejected','archived') NOT NULL DEFAULT 'draft',
	`priceType` enum('free','premium') NOT NULL DEFAULT 'free',
	`categoryId` int,
	`authorId` int NOT NULL,
	`modelCompatibility` json NOT NULL,
	`averageRating` int NOT NULL DEFAULT 0,
	`ratingCount` int NOT NULL DEFAULT 0,
	`savesCount` int NOT NULL DEFAULT 0,
	`runsCount` int NOT NULL DEFAULT 0,
	`viewsCount` int NOT NULL DEFAULT 0,
	`featuredRank` int,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `prompts_id` PRIMARY KEY(`id`),
	CONSTRAINT `prompts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `providerCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(80) NOT NULL,
	`encryptedSecret` text NOT NULL,
	`secretHint` varchar(12) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `providerCredentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `provider_credentials_unique` UNIQUE(`userId`,`provider`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promptId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`comment` text NOT NULL,
	`status` enum('published','hidden','flagged') NOT NULL DEFAULT 'published',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`),
	CONSTRAINT `reviews_unique` UNIQUE(`promptId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `savedPrompts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`promptId` int NOT NULL,
	`customValues` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `savedPrompts_id` PRIMARY KEY(`id`),
	CONSTRAINT `saved_prompts_unique` UNIQUE(`userId`,`promptId`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(96) NOT NULL,
	`name` varchar(120) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tags_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `bio` text;--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;--> statement-breakpoint
CREATE INDEX `deployed_agents_owner_idx` ON `deployedAgents` (`ownerId`);--> statement-breakpoint
CREATE INDEX `deployed_agents_prompt_idx` ON `deployedAgents` (`promptId`);--> statement-breakpoint
CREATE INDEX `moderation_records_target_idx` ON `moderationRecords` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `prompt_improvements_user_idx` ON `promptImprovements` (`userId`);--> statement-breakpoint
CREATE INDEX `prompt_improvements_prompt_idx` ON `promptImprovements` (`promptId`);--> statement-breakpoint
CREATE INDEX `prompt_runs_user_idx` ON `promptRuns` (`userId`);--> statement-breakpoint
CREATE INDEX `prompt_runs_prompt_idx` ON `promptRuns` (`promptId`);--> statement-breakpoint
CREATE INDEX `prompt_tags_tag_idx` ON `promptTags` (`tagId`);--> statement-breakpoint
CREATE INDEX `prompt_versions_prompt_idx` ON `promptVersions` (`promptId`);--> statement-breakpoint
CREATE INDEX `prompts_author_idx` ON `prompts` (`authorId`);--> statement-breakpoint
CREATE INDEX `prompts_category_idx` ON `prompts` (`categoryId`);--> statement-breakpoint
CREATE INDEX `prompts_discovery_idx` ON `prompts` (`status`,`visibility`,`publishedAt`);--> statement-breakpoint
CREATE INDEX `reviews_prompt_idx` ON `reviews` (`promptId`);--> statement-breakpoint
CREATE INDEX `saved_prompts_prompt_idx` ON `savedPrompts` (`promptId`);
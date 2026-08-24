CREATE TABLE `importDomainPolicies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`domain` varchar(255) NOT NULL,
	`status` enum('approved','blocked','review_required') NOT NULL DEFAULT 'review_required',
	`termsUrl` text,
	`reuseNotes` text,
	`reviewedById` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `importDomainPolicies_id` PRIMARY KEY(`id`),
	CONSTRAINT `importDomainPolicies_domain_unique` UNIQUE(`domain`)
);
--> statement-breakpoint
CREATE INDEX `import_domain_policies_status_idx` ON `importDomainPolicies` (`status`);
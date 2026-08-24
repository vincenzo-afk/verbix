CREATE TABLE `deployedAgentRateLimits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentId` int NOT NULL,
	`visitorHash` varchar(128) NOT NULL,
	`windowStart` timestamp NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deployedAgentRateLimits_id` PRIMARY KEY(`id`),
	CONSTRAINT `deployed_agent_rate_limits_unique` UNIQUE(`agentId`,`visitorHash`,`windowStart`)
);
--> statement-breakpoint
CREATE INDEX `deployed_agent_rate_limits_window_idx` ON `deployedAgentRateLimits` (`agentId`,`windowStart`);
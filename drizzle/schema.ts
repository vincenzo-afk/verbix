import {
  boolean,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatarUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 96 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  description: text("description"),
  accent: varchar("accent", { length: 24 }).default("teal").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 96 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const prompts = mysqlTable(
  "prompts",
  {
    id: int("id").autoincrement().primaryKey(),
    slug: varchar("slug", { length: 144 }).notNull().unique(),
    title: varchar("title", { length: 180 }).notNull(),
    description: text("description").notNull(),
    body: text("body").notNull(),
    promptType: mysqlEnum("promptType", ["text", "image", "video", "code", "audio", "three_d"]).default("text").notNull(),
    visibility: mysqlEnum("visibility", ["public", "unlisted", "private"]).default("public").notNull(),
    status: mysqlEnum("status", ["draft", "submitted", "published", "rejected", "archived"]).default("draft").notNull(),
    priceType: mysqlEnum("priceType", ["free", "premium"]).default("free").notNull(),
    categoryId: int("categoryId"),
    authorId: int("authorId").notNull(),
    modelCompatibility: json("modelCompatibility").$type<string[]>().notNull(),
    averageRating: int("averageRating").default(0).notNull(),
    ratingCount: int("ratingCount").default(0).notNull(),
    savesCount: int("savesCount").default(0).notNull(),
    runsCount: int("runsCount").default(0).notNull(),
    viewsCount: int("viewsCount").default(0).notNull(),
    featuredRank: int("featuredRank"),
    publishedAt: timestamp("publishedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("prompts_author_idx").on(table.authorId),
    index("prompts_category_idx").on(table.categoryId),
    index("prompts_discovery_idx").on(table.status, table.visibility, table.publishedAt),
  ],
);

export const promptVersions = mysqlTable(
  "promptVersions",
  {
    id: int("id").autoincrement().primaryKey(),
    promptId: int("promptId").notNull(),
    versionNumber: int("versionNumber").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    body: text("body").notNull(),
    changeNote: varchar("changeNote", { length: 500 }),
    source: mysqlEnum("source", ["manual", "ai_improvement", "restore"]).default("manual").notNull(),
    createdById: int("createdById").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("prompt_versions_unique").on(table.promptId, table.versionNumber),
    index("prompt_versions_prompt_idx").on(table.promptId),
  ],
);

export const promptVariables = mysqlTable(
  "promptVariables",
  {
    id: int("id").autoincrement().primaryKey(),
    promptId: int("promptId").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    label: varchar("label", { length: 180 }).notNull(),
    description: varchar("description", { length: 500 }),
    variableType: mysqlEnum("variableType", ["text", "number", "select"]).default("text").notNull(),
    defaultValue: text("defaultValue"),
    options: json("options").$type<string[]>(),
    isRequired: boolean("isRequired").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("prompt_variables_unique").on(table.promptId, table.name)],
);

export const promptTags = mysqlTable(
  "promptTags",
  {
    promptId: int("promptId").notNull(),
    tagId: int("tagId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("prompt_tags_unique").on(table.promptId, table.tagId), index("prompt_tags_tag_idx").on(table.tagId)],
);

export const promptImprovements = mysqlTable(
  "promptImprovements",
  {
    id: int("id").autoincrement().primaryKey(),
    promptId: int("promptId"),
    userId: int("userId"),
    originalPrompt: text("originalPrompt").notNull(),
    improvedPrompt: text("improvedPrompt").notNull(),
    intentSummary: text("intentSummary").notNull(),
    assumptions: json("assumptions").$type<string[]>().notNull(),
    missingInformation: json("missingInformation").$type<string[]>().notNull(),
    variables: json("variables").$type<Array<{ name: string; purpose: string }>>().notNull(),
    constraints: json("constraints").$type<string[]>().notNull(),
    outputFormat: text("outputFormat").notNull(),
    acceptanceCriteria: json("acceptanceCriteria").$type<string[]>().notNull(),
    agentNotes: text("agentNotes").notNull(),
    warnings: json("warnings").$type<string[]>().notNull(),
    provider: varchar("provider", { length: 48 }).notNull(),
    acceptedAt: timestamp("acceptedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("prompt_improvements_user_idx").on(table.userId), index("prompt_improvements_prompt_idx").on(table.promptId)],
);

export const savedPrompts = mysqlTable(
  "savedPrompts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    promptId: int("promptId").notNull(),
    customValues: json("customValues").$type<Record<string, string>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("saved_prompts_unique").on(table.userId, table.promptId), index("saved_prompts_prompt_idx").on(table.promptId)],
);

export const reviews = mysqlTable(
  "reviews",
  {
    id: int("id").autoincrement().primaryKey(),
    promptId: int("promptId").notNull(),
    userId: int("userId").notNull(),
    rating: int("rating").notNull(),
    comment: text("comment").notNull(),
    status: mysqlEnum("status", ["published", "hidden", "flagged"]).default("published").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("reviews_unique").on(table.promptId, table.userId), index("reviews_prompt_idx").on(table.promptId)],
);

export const promptRuns = mysqlTable(
  "promptRuns",
  {
    id: int("id").autoincrement().primaryKey(),
    promptId: int("promptId"),
    promptVersionId: int("promptVersionId"),
    userId: int("userId"),
    provider: varchar("provider", { length: 80 }).notNull(),
    model: varchar("model", { length: 120 }).notNull(),
    inputPayload: json("inputPayload").$type<Record<string, string>>(),
    outputPreview: text("outputPreview"),
    status: mysqlEnum("status", ["queued", "running", "completed", "failed", "cancelled"]).default("queued").notNull(),
    errorCode: varchar("errorCode", { length: 120 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    completedAt: timestamp("completedAt"),
  },
  table => [index("prompt_runs_user_idx").on(table.userId), index("prompt_runs_prompt_idx").on(table.promptId)],
);

export const providerCredentials = mysqlTable(
  "providerCredentials",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    provider: varchar("provider", { length: 80 }).notNull(),
    encryptedSecret: text("encryptedSecret").notNull(),
    secretHint: varchar("secretHint", { length: 12 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("provider_credentials_unique").on(table.userId, table.provider)],
);

export const deployedAgents = mysqlTable(
  "deployedAgents",
  {
    id: int("id").autoincrement().primaryKey(),
    promptId: int("promptId").notNull(),
    ownerId: int("ownerId").notNull(),
    slug: varchar("slug", { length: 144 }).notNull().unique(),
    name: varchar("name", { length: 180 }).notNull(),
    isPublic: boolean("isPublic").default(false).notNull(),
    isEnabled: boolean("isEnabled").default(true).notNull(),
    rateLimitPerHour: int("rateLimitPerHour").default(30).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("deployed_agents_owner_idx").on(table.ownerId), index("deployed_agents_prompt_idx").on(table.promptId)],
);

export const promptReports = mysqlTable("promptReports", {
  id: int("id").autoincrement().primaryKey(),
  promptId: int("promptId").notNull(),
  reporterId: int("reporterId").notNull(),
  reason: varchar("reason", { length: 280 }).notNull(),
  details: text("details"),
  status: mysqlEnum("status", ["open", "reviewed", "dismissed", "actioned"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export const moderationRecords = mysqlTable(
  "moderationRecords",
  {
    id: int("id").autoincrement().primaryKey(),
    targetType: mysqlEnum("targetType", ["prompt", "review", "tag", "category", "report"]).notNull(),
    targetId: int("targetId").notNull(),
    action: mysqlEnum("action", ["approve", "reject", "hide", "restore", "archive", "dismiss_report"]).notNull(),
    reason: text("reason"),
    moderatorId: int("moderatorId").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("moderation_records_target_idx").on(table.targetType, table.targetId)],
);

export const creatorAnalytics = mysqlTable(
  "creatorAnalytics",
  {
    id: int("id").autoincrement().primaryKey(),
    creatorId: int("creatorId").notNull(),
    promptId: int("promptId").notNull(),
    metricDate: timestamp("metricDate").notNull(),
    views: int("views").default(0).notNull(),
    runs: int("runs").default(0).notNull(),
    saves: int("saves").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("creator_analytics_unique").on(table.creatorId, table.promptId, table.metricDate)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Prompt = typeof prompts.$inferSelect;
export type PromptVersion = typeof promptVersions.$inferSelect;

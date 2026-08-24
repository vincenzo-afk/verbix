import { and, desc, eq, inArray, like, max, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  categories,
  creatorAnalytics,
  deployedAgents,
  deployedAgentRateLimits,
  importCandidates,
  importDomainPolicies,
  importExampleOutputs,
  importIngestionJobs,
  importSources,
  InsertUser,
  moderationRecords,
  promptImprovements,
  promptReports,
  promptRuns,
  promptTags,
  promptVariables,
  promptVersions,
  prompts,
  providerCredentials,
  reviews,
  savedPrompts,
  tags,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export type PromptSearchInput = {
  query?: string;
  category?: string;
  model?: string;
  tag?: string;
  sort?: "recent" | "trending" | "featured";
  limit?: number;
};

async function tagsForPromptIds(promptIds: number[]) {
  const db = await getDb();
  if (!db || promptIds.length === 0) return new Map<number, string[]>();
  const rows = await db
    .select({ promptId: promptTags.promptId, tagName: tags.name })
    .from(promptTags)
    .innerJoin(tags, eq(tags.id, promptTags.tagId))
    .where(inArray(promptTags.promptId, promptIds));
  const grouped = new Map<number, string[]>();
  for (const row of rows) {
    grouped.set(row.promptId, [...(grouped.get(row.promptId) ?? []), row.tagName]);
  }
  return grouped;
}

export async function listPublicPrompts(input: PromptSearchInput = {}) {
  const db = await getDb();
  if (!db) return [];
  const filters = [eq(prompts.status, "published"), eq(prompts.visibility, "public")];

  if (input.query?.trim()) {
    const pattern = `%${input.query.trim()}%`;
    filters.push(or(like(prompts.title, pattern), like(prompts.description, pattern))!);
  }

  if (input.category) filters.push(eq(categories.slug, input.category));
  if (input.model) filters.push(like(prompts.modelCompatibility, `%${input.model}%`));
  if (input.tag) {
    const matchingPromptIds = db
      .select({ promptId: promptTags.promptId })
      .from(promptTags)
      .innerJoin(tags, eq(tags.id, promptTags.tagId))
      .where(eq(tags.slug, input.tag));
    filters.push(inArray(prompts.id, matchingPromptIds));
  }

  const orderBy = input.sort === "trending"
    ? [desc(prompts.runsCount), desc(prompts.savesCount)]
    : input.sort === "featured"
      ? [prompts.featuredRank, desc(prompts.publishedAt)]
      : [desc(prompts.publishedAt)];

  const rows = await db
    .select({
      id: prompts.id,
      slug: prompts.slug,
      title: prompts.title,
      description: prompts.description,
      promptType: prompts.promptType,
      modelCompatibility: prompts.modelCompatibility,
      averageRating: prompts.averageRating,
      ratingCount: prompts.ratingCount,
      savesCount: prompts.savesCount,
      runsCount: prompts.runsCount,
      viewsCount: prompts.viewsCount,
      featuredRank: prompts.featuredRank,
      publishedAt: prompts.publishedAt,
      categoryName: categories.name,
      categorySlug: categories.slug,
      authorId: users.id,
      authorName: users.name,
    })
    .from(prompts)
    .leftJoin(categories, eq(categories.id, prompts.categoryId))
    .leftJoin(users, eq(users.id, prompts.authorId))
    .where(and(...filters))
    .orderBy(...orderBy)
    .limit(Math.min(input.limit ?? 24, 60));

  const tagsByPrompt = await tagsForPromptIds(rows.map(row => row.id));
  return rows.map(row => ({ ...row, tags: tagsByPrompt.get(row.id) ?? [] }));
}

export async function getPublicPromptBySlug(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      prompt: prompts,
      categoryName: categories.name,
      categorySlug: categories.slug,
      authorId: users.id,
      authorName: users.name,
    })
    .from(prompts)
    .leftJoin(categories, eq(categories.id, prompts.categoryId))
    .leftJoin(users, eq(users.id, prompts.authorId))
    .where(and(eq(prompts.slug, slug), eq(prompts.status, "published"), eq(prompts.visibility, "public")))
    .limit(1);
  const row = rows[0];
  if (!row) return null;

  const [variables, promptTagsRows, versionRows, reviewRows, importedExamples] = await Promise.all([
    db.select().from(promptVariables).where(eq(promptVariables.promptId, row.prompt.id)),
    db
      .select({ name: tags.name, slug: tags.slug })
      .from(promptTags)
      .innerJoin(tags, eq(tags.id, promptTags.tagId))
      .where(eq(promptTags.promptId, row.prompt.id)),
    db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.promptId, row.prompt.id))
      .orderBy(desc(promptVersions.versionNumber)),
    db
      .select({ id: reviews.id, rating: reviews.rating, comment: reviews.comment, createdAt: reviews.createdAt, authorName: users.name })
      .from(reviews)
      .leftJoin(users, eq(users.id, reviews.userId))
      .where(and(eq(reviews.promptId, row.prompt.id), eq(reviews.status, "published")))
      .orderBy(desc(reviews.createdAt))
      .limit(30),
    row.prompt.importCandidateId
      ? db.select().from(importExampleOutputs).where(and(eq(importExampleOutputs.candidateId, row.prompt.importCandidateId), eq(importExampleOutputs.status, "approved"))).limit(12)
      : Promise.resolve([]),
  ]);

  return { ...row, variables, tags: promptTagsRows, versions: versionRows, reviews: reviewRows, importedExamples };
}

export async function getPromptOwner(promptId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ authorId: prompts.authorId }).from(prompts).where(eq(prompts.id, promptId)).limit(1);
  return rows[0]?.authorId ?? null;
}

export async function getPublicCreatorProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const creatorRows = await db
    .select({ id: users.id, name: users.name, bio: users.bio, avatarUrl: users.avatarUrl, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const creator = creatorRows[0];
  if (!creator) return null;
  const promptRows = await db
    .select({
      id: prompts.id,
      slug: prompts.slug,
      title: prompts.title,
      description: prompts.description,
      promptType: prompts.promptType,
      modelCompatibility: prompts.modelCompatibility,
      averageRating: prompts.averageRating,
      ratingCount: prompts.ratingCount,
      savesCount: prompts.savesCount,
      runsCount: prompts.runsCount,
      viewsCount: prompts.viewsCount,
      featuredRank: prompts.featuredRank,
      publishedAt: prompts.publishedAt,
      categoryName: categories.name,
      categorySlug: categories.slug,
      authorId: users.id,
      authorName: users.name,
    })
    .from(prompts)
    .leftJoin(categories, eq(categories.id, prompts.categoryId))
    .leftJoin(users, eq(users.id, prompts.authorId))
    .where(and(eq(prompts.authorId, userId), eq(prompts.status, "published"), eq(prompts.visibility, "public")))
    .orderBy(desc(prompts.publishedAt));
  const tagsByPrompt = await tagsForPromptIds(promptRows.map(row => row.id));
  const promptList = promptRows.map(row => ({ ...row, tags: tagsByPrompt.get(row.id) ?? [] }));
  const metrics = promptList.reduce((total, prompt) => ({
    views: total.views + prompt.viewsCount,
    runs: total.runs + prompt.runsCount,
    saves: total.saves + prompt.savesCount,
  }), { views: 0, runs: 0, saves: 0 });
  return { creator, prompts: promptList, metrics };
}

export async function listPromptsForOwner(authorId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(prompts).where(eq(prompts.authorId, authorId)).orderBy(desc(prompts.updatedAt));
}

export async function getPromptForOwner(promptId: number, authorId: number) {
  const db = await getDb();
  if (!db) return null;
  const promptRows = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.id, promptId), eq(prompts.authorId, authorId)))
    .limit(1);
  const prompt = promptRows[0];
  if (!prompt) return null;
  const [variables, versions] = await Promise.all([
    db.select().from(promptVariables).where(eq(promptVariables.promptId, promptId)),
    db.select().from(promptVersions).where(eq(promptVersions.promptId, promptId)).orderBy(desc(promptVersions.versionNumber)),
  ]);
  return { prompt, variables, versions };
}

export async function createPromptWithInitialVersion(input: {
  slug: string;
  title: string;
  description: string;
  body: string;
  authorId: number;
  promptType: "text" | "image" | "video" | "code" | "audio" | "three_d";
  visibility: "public" | "unlisted" | "private";
  categoryId?: number | null;
  modelCompatibility: string[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [inserted] = await db.insert(prompts).values({ ...input, status: "draft", priceType: "free" });
  const promptId = inserted.insertId;
  await db.insert(promptVersions).values({
    promptId,
    versionNumber: 1,
    title: input.title,
    body: input.body,
    source: "manual",
    createdById: input.authorId,
    changeNote: "Initial draft",
  });
  return promptId;
}

export async function addPromptVersion(input: {
  promptId: number;
  title: string;
  body: string;
  changeNote?: string;
  source: "manual" | "ai_improvement" | "restore";
  userId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [versionInfo] = await db.select({ value: max(promptVersions.versionNumber) }).from(promptVersions).where(eq(promptVersions.promptId, input.promptId));
  const nextVersion = (versionInfo?.value ?? 0) + 1;
  await db.transaction(async tx => {
    await tx.insert(promptVersions).values({
      promptId: input.promptId,
      versionNumber: nextVersion,
      title: input.title,
      body: input.body,
      changeNote: input.changeNote,
      source: input.source,
      createdById: input.userId,
    });
    await tx.update(prompts).set({ title: input.title, body: input.body }).where(eq(prompts.id, input.promptId));
  });
  return nextVersion;
}

export async function setPromptVariables(promptId: number, variables: Array<{
  name: string;
  label: string;
  description?: string;
  variableType: "text" | "number" | "select";
  defaultValue?: string;
  options?: string[];
  isRequired: boolean;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.transaction(async tx => {
    await tx.delete(promptVariables).where(eq(promptVariables.promptId, promptId));
    if (variables.length) await tx.insert(promptVariables).values(variables.map(variable => ({ ...variable, promptId })));
  });
}

export async function toggleSavedPrompt(userId: number, promptId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const existing = await db.select().from(savedPrompts).where(and(eq(savedPrompts.userId, userId), eq(savedPrompts.promptId, promptId))).limit(1);
  if (existing[0]) {
    await db.delete(savedPrompts).where(eq(savedPrompts.id, existing[0].id));
    await bumpCreatorMetric(promptId, "saves", -1);
    return false;
  }
  await db.insert(savedPrompts).values({ userId, promptId });
  await bumpCreatorMetric(promptId, "saves", 1);
  return true;
}

export async function upsertReview(input: { promptId: number; userId: number; rating: number; comment: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.insert(reviews).values(input).onDuplicateKeyUpdate({ set: { rating: input.rating, comment: input.comment, status: "published" } });
  return true;
}

export async function createPromptReport(input: { promptId: number; reporterId: number; reason: string; details?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [result] = await db.insert(promptReports).values(input);
  return result.insertId;
}

export async function recordPromptImprovement(input: {
  promptId?: number;
  userId?: number;
  originalPrompt: string;
  improvedPrompt: string;
  intentSummary: string;
  assumptions: string[];
  missingInformation: string[];
  variables: Array<{ name: string; purpose: string }>;
  constraints: string[];
  outputFormat: string;
  acceptanceCriteria: string[];
  agentNotes: string;
  warnings: string[];
  provider: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [result] = await db.insert(promptImprovements).values(input);
  return result.insertId;
}

export async function acceptPromptImprovement(input: {
  improvementId: number;
  promptId: number;
  title: string;
  body: string;
  userId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [versionInfo] = await db.select({ value: max(promptVersions.versionNumber) }).from(promptVersions).where(eq(promptVersions.promptId, input.promptId));
  const nextVersion = (versionInfo?.value ?? 0) + 1;
  await db.transaction(async tx => {
    await tx.insert(promptVersions).values({
      promptId: input.promptId,
      versionNumber: nextVersion,
      title: input.title,
      body: input.body,
      source: "ai_improvement",
      createdById: input.userId,
      changeNote: "Accepted AI improvement",
    });
    await tx.update(prompts).set({ title: input.title, body: input.body }).where(eq(prompts.id, input.promptId));
    await tx.update(promptImprovements).set({ acceptedAt: new Date() }).where(eq(promptImprovements.id, input.improvementId));
  });
  return nextVersion;
}

export async function updatePromptStatus(promptId: number, status: "draft" | "submitted" | "published" | "rejected" | "archived") {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db
    .update(prompts)
    .set({ status, publishedAt: status === "published" ? new Date() : undefined })
    .where(eq(prompts.id, promptId));
}

export async function listModerationQueue() {
  const db = await getDb();
  if (!db) return { prompts: [], reviews: [] };
  const [promptQueue, reviewQueue] = await Promise.all([
    db.select().from(prompts).where(eq(prompts.status, "submitted")).orderBy(desc(prompts.updatedAt)).limit(60),
    db.select().from(reviews).where(eq(reviews.status, "flagged")).orderBy(desc(reviews.updatedAt)).limit(60),
  ]);
  return { prompts: promptQueue, reviews: reviewQueue };
}

export async function recordModeration(input: {
  targetType: "prompt" | "review" | "tag" | "category" | "report";
  targetId: number;
  action: "approve" | "reject" | "hide" | "restore" | "archive" | "dismiss_report";
  reason?: string;
  moderatorId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.insert(moderationRecords).values(input);
}

export async function createPromptRun(input: {
  promptId?: number;
  promptVersionId?: number;
  userId: number;
  provider: string;
  model: string;
  inputPayload: Record<string, string>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [result] = await db.insert(promptRuns).values({ ...input, status: "running" });
  return result.insertId;
}

export async function completePromptRun(input: {
  runId: number;
  status: "completed" | "failed" | "cancelled";
  outputPreview?: string;
  errorCode?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.update(promptRuns).set({ ...input, completedAt: new Date() }).where(eq(promptRuns.id, input.runId));
}

export async function listPromptRunsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(promptRuns).where(eq(promptRuns.userId, userId)).orderBy(desc(promptRuns.createdAt)).limit(80);
}

export async function createDeployedAgent(input: { promptId: number; ownerId: number; slug: string; name: string; isPublic: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [result] = await db.insert(deployedAgents).values({ ...input, isEnabled: true, rateLimitPerHour: 30 });
  return result.insertId;
}

export async function listDeployedAgentsForOwner(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deployedAgents).where(eq(deployedAgents.ownerId, ownerId)).orderBy(desc(deployedAgents.updatedAt));
}

export async function getPublicDeployedAgent(slug: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ agent: deployedAgents, prompt: prompts })
    .from(deployedAgents)
    .innerJoin(prompts, eq(prompts.id, deployedAgents.promptId))
    .where(and(eq(deployedAgents.slug, slug), eq(deployedAgents.isPublic, true), eq(deployedAgents.isEnabled, true)))
    .limit(1);
  return rows[0] ?? null;
}

export async function consumeDeployedAgentRateLimit(input: { agentId: number; visitorHash: string; hourlyLimit: number }) {
  const db = await getDb();
  if (!db) throw new Error("Public agent execution is temporarily unavailable.");
  const windowStart = new Date();
  windowStart.setUTCMinutes(0, 0, 0);

  return db.transaction(async tx => {
    await tx.insert(deployedAgentRateLimits).values({
      agentId: input.agentId,
      visitorHash: input.visitorHash,
      windowStart,
      requestCount: 1,
    }).onDuplicateKeyUpdate({
      set: { requestCount: sql`${deployedAgentRateLimits.requestCount} + 1` },
    });
    const rows = await tx
      .select({ requestCount: deployedAgentRateLimits.requestCount })
      .from(deployedAgentRateLimits)
      .where(and(
        eq(deployedAgentRateLimits.agentId, input.agentId),
        eq(deployedAgentRateLimits.visitorHash, input.visitorHash),
        eq(deployedAgentRateLimits.windowStart, windowStart),
      ))
      .limit(1);
    return (rows[0]?.requestCount ?? 1) <= input.hourlyLimit;
  });
}

export async function upsertProviderCredential(input: { userId: number; provider: string; encryptedSecret: string; secretHint: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.insert(providerCredentials).values(input).onDuplicateKeyUpdate({
    set: { encryptedSecret: input.encryptedSecret, secretHint: input.secretHint },
  });
}

export async function listProviderCredentialHints(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ provider: providerCredentials.provider, secretHint: providerCredentials.secretHint, updatedAt: providerCredentials.updatedAt })
    .from(providerCredentials)
    .where(eq(providerCredentials.userId, userId));
}

export async function removeProviderCredential(userId: number, provider: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.delete(providerCredentials).where(and(eq(providerCredentials.userId, userId), eq(providerCredentials.provider, provider)));
}

export async function bumpCreatorMetric(promptId: number, metric: "views" | "runs" | "saves", increment = 1) {
  const db = await getDb();
  if (!db) return;
  const promptRows = await db.select({ authorId: prompts.authorId }).from(prompts).where(eq(prompts.id, promptId)).limit(1);
  const authorId = promptRows[0]?.authorId;
  if (!authorId) return;

  const metricDate = new Date();
  metricDate.setUTCHours(0, 0, 0, 0);
  const promptCounter = metric === "views" ? prompts.viewsCount : metric === "runs" ? prompts.runsCount : prompts.savesCount;
  const analyticsCounter = metric === "views" ? creatorAnalytics.views : metric === "runs" ? creatorAnalytics.runs : creatorAnalytics.saves;
  await db.transaction(async tx => {
    await tx.update(prompts).set({ [promptCounter.name]: sql`${promptCounter} + ${increment}` }).where(eq(prompts.id, promptId));
    await tx.insert(creatorAnalytics).values({
      creatorId: authorId,
      promptId,
      metricDate,
      views: metric === "views" ? Math.max(increment, 0) : 0,
      runs: metric === "runs" ? Math.max(increment, 0) : 0,
      saves: metric === "saves" ? Math.max(increment, 0) : 0,
    }).onDuplicateKeyUpdate({ set: { [analyticsCounter.name]: sql`${analyticsCounter} + ${increment}` } });
  });
}

export async function recordPublicPromptView(promptId: number) {
  await bumpCreatorMetric(promptId, "views", 1);
}

export async function getImportSourceByHash(urlHash: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(importSources).where(eq(importSources.urlHash, urlHash)).limit(1);
  return rows[0] ?? null;
}

export async function getImportDomainPolicy(domain: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(importDomainPolicies).where(eq(importDomainPolicies.domain, domain)).limit(1);
  return rows[0] ?? null;
}

export async function upsertImportDomainPolicy(input: { domain: string; status: "approved" | "blocked" | "review_required"; reviewerId: number; termsUrl?: string; reuseNotes?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.insert(importDomainPolicies).values({
    domain: input.domain,
    status: input.status,
    reviewedById: input.reviewerId,
    reviewedAt: new Date(),
    termsUrl: input.termsUrl,
    reuseNotes: input.reuseNotes,
  }).onDuplicateKeyUpdate({
    set: {
      status: input.status,
      reviewedById: input.reviewerId,
      reviewedAt: new Date(),
      termsUrl: input.termsUrl,
      reuseNotes: input.reuseNotes,
    },
  });
}

export async function createImportSource(input: { submittedById: number; submittedUrl: string; urlHash: string; domain: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [result] = await db.insert(importSources).values(input);
  return Number(result.insertId);
}

export async function getImportSourceForUser(sourceId: number, userId: number, isAdmin = false) {
  const db = await getDb();
  if (!db) return null;
  const filters = isAdmin ? [eq(importSources.id, sourceId)] : [eq(importSources.id, sourceId), eq(importSources.submittedById, userId)];
  const rows = await db.select().from(importSources).where(and(...filters)).limit(1);
  return rows[0] ?? null;
}

export async function listImportSourcesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(importSources).where(eq(importSources.submittedById, userId)).orderBy(desc(importSources.updatedAt)).limit(60);
}

export async function createImportJob(input: { sourceId: number; requestedById: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  const [result] = await db.insert(importIngestionJobs).values({ ...input, status: "queued" });
  return Number(result.insertId);
}

export async function updateImportSource(sourceId: number, values: Partial<typeof importSources.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.update(importSources).set(values).where(eq(importSources.id, sourceId));
}

export async function updateImportJob(jobId: number, values: Partial<typeof importIngestionJobs.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.update(importIngestionJobs).set(values).where(eq(importIngestionJobs.id, jobId));
}

export type StoredImportCandidate = {
  sourcePromptText: string;
  title: string;
  description: string;
  structuredPrompt: string;
  modality: "text" | "image" | "video" | "code" | "audio" | "three_d";
  modelHints: string[];
  variables: Array<{ name: string; purpose: string }>;
  constraints: string[];
  outputFormat: string;
  acceptanceCriteria: string[];
  confidence: number;
  normalizationProvider: string;
};

export type StoredExampleOutput = {
  sourceUrl: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "audio" | "other";
  altText?: string;
};

export async function storeImportExtraction(input: {
  sourceId: number;
  submittedById: number;
  source: Partial<typeof importSources.$inferInsert>;
  jobId: number;
  candidates: StoredImportCandidate[];
  exampleOutputs: StoredExampleOutput[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  return db.transaction(async tx => {
    await tx.update(importSources).set({ ...input.source, status: "extracted", fetchedAt: new Date() }).where(eq(importSources.id, input.sourceId));
    const candidateIds: number[] = [];
    for (const candidate of input.candidates) {
      const [result] = await tx.insert(importCandidates).values({
        sourceId: input.sourceId,
        submittedById: input.submittedById,
        ...candidate,
        status: "pending_review",
      });
      candidateIds.push(Number(result.insertId));
    }
    const firstCandidateId = candidateIds[0];
    if (firstCandidateId && input.exampleOutputs.length) {
      await tx.insert(importExampleOutputs).values(input.exampleOutputs.slice(0, 12).map(output => ({
        candidateId: firstCandidateId,
        ...output,
        rightsState: "public_reference" as const,
        status: "pending_review" as const,
      })));
    }
    await tx.update(importIngestionJobs).set({
      status: input.candidates.length ? "completed" : "partial",
      candidatesCreated: candidateIds.length,
      outputsFound: input.exampleOutputs.length,
      finishedAt: new Date(),
    }).where(eq(importIngestionJobs.id, input.jobId));
    return { candidateIds, outputsFound: input.exampleOutputs.length };
  });
}

export async function markImportFailed(input: { sourceId: number; jobId: number; status: "blocked" | "failed"; reason: string; robotsState?: "blocked" | "unavailable" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.transaction(async tx => {
    await tx.update(importSources).set({
      status: input.status === "blocked" ? "blocked" : "failed",
      failureReason: input.reason.slice(0, 500),
      ...(input.robotsState ? { robotsState: input.robotsState } : {}),
      fetchedAt: new Date(),
    }).where(eq(importSources.id, input.sourceId));
    await tx.update(importIngestionJobs).set({ status: input.status, errorMessage: input.reason.slice(0, 500), finishedAt: new Date() }).where(eq(importIngestionJobs.id, input.jobId));
  });
}

export async function listImportCandidatesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ candidate: importCandidates, source: importSources })
    .from(importCandidates)
    .innerJoin(importSources, eq(importSources.id, importCandidates.sourceId))
    .where(eq(importCandidates.submittedById, userId))
    .orderBy(desc(importCandidates.updatedAt))
    .limit(80);
}

export async function listImportReviewQueue() {
  const db = await getDb();
  if (!db) return { candidates: [], approvedCandidates: [], outputs: [], sources: [], policies: [] };
  const [candidates, approvedCandidates, outputs, sources, policies] = await Promise.all([
    db.select({ candidate: importCandidates, source: importSources }).from(importCandidates).innerJoin(importSources, eq(importSources.id, importCandidates.sourceId)).where(eq(importCandidates.status, "pending_review")).orderBy(desc(importCandidates.createdAt)).limit(80),
    db.select({ candidate: importCandidates, source: importSources }).from(importCandidates).innerJoin(importSources, eq(importSources.id, importCandidates.sourceId)).where(eq(importCandidates.status, "approved")).orderBy(desc(importCandidates.reviewedAt)).limit(80),
    db.select({ output: importExampleOutputs, candidate: importCandidates, source: importSources }).from(importExampleOutputs).innerJoin(importCandidates, eq(importCandidates.id, importExampleOutputs.candidateId)).innerJoin(importSources, eq(importSources.id, importCandidates.sourceId)).where(eq(importExampleOutputs.status, "pending_review")).orderBy(desc(importExampleOutputs.createdAt)).limit(80),
    db.select().from(importSources).where(or(eq(importSources.status, "submitted"), eq(importSources.status, "blocked"), eq(importSources.status, "failed"))).orderBy(desc(importSources.updatedAt)).limit(40),
    db.select().from(importDomainPolicies).orderBy(desc(importDomainPolicies.updatedAt)).limit(80),
  ]);
  return { candidates, approvedCandidates, outputs, sources, policies };
}

export async function reviewImportCandidate(input: { candidateId: number; reviewerId: number; action: "approve" | "reject"; note?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.update(importCandidates).set({
    status: input.action === "approve" ? "approved" : "rejected",
    reviewedById: input.reviewerId,
    reviewedAt: new Date(),
    reviewerNote: input.note,
  }).where(eq(importCandidates.id, input.candidateId));
}

export async function reviewImportOutput(input: { outputId: number; reviewerId: number; action: "approve" | "reject" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  await db.update(importExampleOutputs).set({
    status: input.action === "approve" ? "approved" : "rejected",
    reviewedById: input.reviewerId,
    reviewedAt: new Date(),
  }).where(eq(importExampleOutputs.id, input.outputId));
}

export async function promoteImportCandidate(input: { candidateId: number; reviewerId: number; slug: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable.");
  return db.transaction(async tx => {
    const rows = await tx
      .select({ candidate: importCandidates, source: importSources })
      .from(importCandidates)
      .innerJoin(importSources, eq(importSources.id, importCandidates.sourceId))
      .where(eq(importCandidates.id, input.candidateId))
      .limit(1);
    const record = rows[0];
    if (!record) throw new Error("Import candidate not found.");
    if (record.candidate.status !== "approved") throw new Error("Approve the import candidate before promoting it.");
    const [result] = await tx.insert(prompts).values({
      slug: input.slug,
      title: record.candidate.title,
      description: record.candidate.description,
      body: record.candidate.structuredPrompt,
      promptType: record.candidate.modality,
      visibility: "public",
      status: "published",
      priceType: "free",
      authorId: record.candidate.submittedById,
      importCandidateId: record.candidate.id,
      sourceAttribution: record.source.displayedAuthor ?? record.source.domain,
      sourceUrl: record.source.canonicalUrl ?? record.source.submittedUrl,
      sourceLicense: record.source.licenseNotice,
      modelCompatibility: record.candidate.modelHints,
      publishedAt: new Date(),
    });
    const promptId = Number(result.insertId);
    await tx.insert(promptVersions).values({
      promptId,
      versionNumber: 1,
      title: record.candidate.title,
      body: record.candidate.structuredPrompt,
      changeNote: "Imported from an approved external source with attribution.",
      source: "manual",
      createdById: input.reviewerId,
    });
    await tx.update(importCandidates).set({ status: "promoted", promotedPromptId: promptId, reviewedById: input.reviewerId, reviewedAt: new Date() }).where(eq(importCandidates.id, input.candidateId));
    return promptId;
  });
}

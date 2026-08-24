import { and, desc, eq, inArray, like, max, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  categories,
  creatorAnalytics,
  deployedAgents,
  deployedAgentRateLimits,
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

  const [variables, promptTagsRows, versionRows, reviewRows] = await Promise.all([
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
  ]);

  return { ...row, variables, tags: promptTagsRows, versions: versionRows, reviews: reviewRows };
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

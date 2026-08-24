import { eq } from "drizzle-orm";
import { z } from "zod";
import { categories, promptReports, prompts, reviews, tags } from "../../drizzle/schema";
import { getDb, listModerationQueue, recordModeration, updatePromptStatus } from "../db";
import { adminProcedure, router } from "../_core/trpc";

export const adminRouter = router({
  queue: adminProcedure.query(() => listModerationQueue()),
  reports: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(promptReports).where(eq(promptReports.status, "open")).limit(80);
  }),
  taxonomy: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { categories: [], tags: [] };
    const [categoryRows, tagRows] = await Promise.all([
      db.select().from(categories).orderBy(categories.name),
      db.select().from(tags).orderBy(tags.name),
    ]);
    return { categories: categoryRows, tags: tagRows };
  }),
  moderatePrompt: adminProcedure.input(z.object({
    promptId: z.number().int().positive(),
    action: z.enum(["approve", "reject", "archive"]),
    reason: z.string().max(2000).optional(),
  })).mutation(async ({ ctx, input }) => {
    const status = input.action === "approve" ? "published" : input.action === "reject" ? "rejected" : "archived";
    await updatePromptStatus(input.promptId, status);
    await recordModeration({ targetType: "prompt", targetId: input.promptId, action: input.action, reason: input.reason, moderatorId: ctx.user.id });
    return { success: true };
  }),
  moderateReview: adminProcedure.input(z.object({ reviewId: z.number().int().positive(), action: z.enum(["hide", "restore"]), reason: z.string().max(2000).optional() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database is unavailable.");
    await db.update(reviews).set({ status: input.action === "hide" ? "hidden" : "published" }).where(eq(reviews.id, input.reviewId));
    await recordModeration({ targetType: "review", targetId: input.reviewId, action: input.action, reason: input.reason, moderatorId: ctx.user.id });
    return { success: true };
  }),
  setCategoryActive: adminProcedure.input(z.object({ categoryId: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database is unavailable.");
    await db.update(categories).set({ isActive: input.isActive }).where(eq(categories.id, input.categoryId));
    await recordModeration({ targetType: "category", targetId: input.categoryId, action: input.isActive ? "restore" : "archive", moderatorId: ctx.user.id });
    return { success: true };
  }),
  setTagActive: adminProcedure.input(z.object({ tagId: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database is unavailable.");
    await db.update(tags).set({ isActive: input.isActive }).where(eq(tags.id, input.tagId));
    await recordModeration({ targetType: "tag", targetId: input.tagId, action: input.isActive ? "restore" : "archive", moderatorId: ctx.user.id });
    return { success: true };
  }),
  resolveReport: adminProcedure.input(z.object({ reportId: z.number().int().positive(), status: z.enum(["reviewed", "dismissed", "actioned"]) })).mutation(async ({ ctx, input }) => {
    const db = await getDb();
    if (!db) throw new Error("Database is unavailable.");
    await db.update(promptReports).set({ status: input.status, resolvedAt: new Date() }).where(eq(promptReports.id, input.reportId));
    await recordModeration({ targetType: "report", targetId: input.reportId, action: "dismiss_report", moderatorId: ctx.user.id });
    return { success: true };
  }),
});

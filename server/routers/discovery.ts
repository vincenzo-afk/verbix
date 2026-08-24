import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { categories, tags } from "../../drizzle/schema";
import { getDb, getPublicCreatorProfile, getPublicPromptBySlug, listPublicPrompts, recordPublicPromptView } from "../db";
import { publicProcedure, router } from "../_core/trpc";

export const discoveryRouter = router({
  list: publicProcedure
    .input(z.object({
      query: z.string().max(180).optional(),
      category: z.string().max(96).optional(),
      model: z.string().max(96).optional(),
      tag: z.string().max(96).optional(),
      sort: z.enum(["recent", "trending", "featured"]).optional(),
      limit: z.number().int().min(1).max(60).optional(),
    }).optional())
    .query(({ input }) => listPublicPrompts(input)),
  bySlug: publicProcedure.input(z.object({ slug: z.string().min(1).max(144) })).query(({ input }) => getPublicPromptBySlug(input.slug)),
  creator: publicProcedure.input(z.object({ userId: z.number().int().positive() })).query(({ input }) => getPublicCreatorProfile(input.userId)),
  categories: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(categories).where(eq(categories.isActive, true)).orderBy(categories.name);
  }),
  tags: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(tags).where(eq(tags.isActive, true)).orderBy(tags.name).limit(80);
  }),
  related: publicProcedure.input(z.object({ promptId: z.number().int().positive(), category: z.string().optional() })).query(({ input }) =>
    listPublicPrompts({ category: input.category, sort: "trending", limit: 4 }),
  ),
  recordView: publicProcedure.input(z.object({ promptId: z.number().int().positive() })).mutation(async ({ input }) => {
    await recordPublicPromptView(input.promptId);
    return { success: true };
  }),
});

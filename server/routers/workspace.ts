import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  addPromptVersion,
  createPromptWithInitialVersion,
  createPromptReport,
  getPromptForOwner,
  getPromptOwner,
  listPromptsForOwner,
  setPromptVariables,
  toggleSavedPrompt,
  updatePromptStatus,
  upsertReview,
} from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const promptTypeSchema = z.enum(["text", "image", "video", "code", "audio", "three_d"]);
const visibilitySchema = z.enum(["public", "unlisted", "private"]);
const variableSchema = z.object({
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,119}$/),
  label: z.string().min(1).max(180),
  description: z.string().max(500).optional(),
  variableType: z.enum(["text", "number", "select"]),
  defaultValue: z.string().optional(),
  options: z.array(z.string().min(1).max(160)).max(24).optional(),
  isRequired: z.boolean(),
});

async function assertOwner(promptId: number, userId: number) {
  const ownerId = await getPromptOwner(promptId);
  if (ownerId !== userId) throw new TRPCError({ code: "FORBIDDEN", message: "You do not own this prompt." });
}

export const workspaceRouter = router({
  mine: protectedProcedure.query(({ ctx }) => listPromptsForOwner(ctx.user.id)),
  byId: protectedProcedure.input(z.object({ promptId: z.number().int().positive() })).query(({ ctx, input }) =>
    getPromptForOwner(input.promptId, ctx.user.id),
  ),
  create: protectedProcedure.input(z.object({
    title: z.string().min(3).max(180),
    description: z.string().min(8).max(2000),
    body: z.string().min(1).max(12_000),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(144),
    promptType: promptTypeSchema,
    visibility: visibilitySchema,
    categoryId: z.number().int().positive().nullable().optional(),
    modelCompatibility: z.array(z.string().min(1).max(100)).max(12),
  })).mutation(({ ctx, input }) => createPromptWithInitialVersion({ ...input, authorId: ctx.user.id })),
  saveVersion: protectedProcedure.input(z.object({
    promptId: z.number().int().positive(),
    title: z.string().min(3).max(180),
    body: z.string().min(1).max(12_000),
    changeNote: z.string().max(500).optional(),
  })).mutation(async ({ ctx, input }) => {
    await assertOwner(input.promptId, ctx.user.id);
    return addPromptVersion({ ...input, source: "manual", userId: ctx.user.id });
  }),
  variables: protectedProcedure.input(z.object({ promptId: z.number().int().positive(), variables: z.array(variableSchema).max(40) })).mutation(async ({ ctx, input }) => {
    await assertOwner(input.promptId, ctx.user.id);
    await setPromptVariables(input.promptId, input.variables);
    return { success: true };
  }),
  submit: protectedProcedure.input(z.object({ promptId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await assertOwner(input.promptId, ctx.user.id);
    await updatePromptStatus(input.promptId, "submitted");
    return { success: true };
  }),
  toggleSave: protectedProcedure.input(z.object({ promptId: z.number().int().positive() })).mutation(({ ctx, input }) =>
    toggleSavedPrompt(ctx.user.id, input.promptId),
  ),
  review: protectedProcedure.input(z.object({ promptId: z.number().int().positive(), rating: z.number().int().min(1).max(5), comment: z.string().min(2).max(3000) })).mutation(({ ctx, input }) =>
    upsertReview({ ...input, userId: ctx.user.id }),
  ),
  report: protectedProcedure.input(z.object({ promptId: z.number().int().positive(), reason: z.string().min(3).max(280), details: z.string().max(4000).optional() })).mutation(({ ctx, input }) =>
    createPromptReport({ ...input, reporterId: ctx.user.id }),
  ),
});

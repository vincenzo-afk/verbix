import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { acceptPromptImprovement, getPromptOwner, recordPromptImprovement } from "../db";
import { improvePromptWithFreeChatbot } from "../services/free-chatbot";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const enhancementInput = z.object({
  prompt: z.string().min(1).max(12_000),
  target: z.string().max(180).optional(),
  tone: z.string().max(100).optional(),
  outputStrictness: z.enum(["concise", "balanced", "detailed"]).optional(),
  promptId: z.number().int().positive().optional(),
});

export const improvementRouter = router({
  enhance: publicProcedure.input(enhancementInput).mutation(async ({ ctx, input }) => {
    const identity = ctx.user ? `user:${ctx.user.id}` : `anonymous:${ctx.req.ip || "unknown"}`;
    const result = await improvePromptWithFreeChatbot({ ...input, identity });
    const improvementId = await recordPromptImprovement({
      promptId: input.promptId,
      userId: ctx.user?.id,
      ...result,
    });
    return { improvementId, ...result };
  }),
  accept: protectedProcedure.input(z.object({
    improvementId: z.number().int().positive(),
    promptId: z.number().int().positive(),
    title: z.string().min(3).max(180),
    body: z.string().min(1).max(12_000),
  })).mutation(async ({ ctx, input }) => {
    const ownerId = await getPromptOwner(input.promptId);
    if (ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the prompt owner can accept an improvement." });
    const versionNumber = await acceptPromptImprovement({ ...input, userId: ctx.user.id });
    return { success: true, versionNumber };
  }),
});

import { z } from "zod";
import { bumpCreatorMetric, completePromptRun, createPromptRun, listPromptRunsForUser } from "../db";
import { executePromptWithFreeChatbot } from "../services/free-chatbot";
import { protectedProcedure, router } from "../_core/trpc";

export const executionRouter = router({
  run: protectedProcedure.input(z.object({
    prompt: z.string().min(1).max(12_000),
    promptId: z.number().int().positive().optional(),
    promptVersionId: z.number().int().positive().optional(),
    variables: z.record(z.string(), z.string()).default({}),
  })).mutation(async ({ ctx, input }) => {
    const runId = await createPromptRun({
      promptId: input.promptId,
      promptVersionId: input.promptVersionId,
      userId: ctx.user.id,
      provider: "free-chatbot",
      model: "fallback-chain",
      inputPayload: input.variables,
    });
    try {
      const result = await executePromptWithFreeChatbot({ prompt: input.prompt, identity: `user:${ctx.user.id}` });
      await completePromptRun({ runId, status: "completed", outputPreview: result.output.slice(0, 5000) });
      if (input.promptId) await bumpCreatorMetric(input.promptId, "runs", 1);
      return { runId, ...result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Execution failed.";
      await completePromptRun({ runId, status: "failed", errorCode: message.slice(0, 120) });
      throw error;
    }
  }),
  history: protectedProcedure.query(({ ctx }) => listPromptRunsForUser(ctx.user.id)),
});

import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { z } from "zod";
import { consumeDeployedAgentRateLimit, createDeployedAgent, getPromptOwner, getPublicDeployedAgent, listDeployedAgentsForOwner } from "../db";
import { executePromptWithFreeChatbot } from "../services/free-chatbot";
import { compilePrompt } from "../../shared/prompt-engine";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 110);
}

export const agentsRouter = router({
  mine: protectedProcedure.query(({ ctx }) => listDeployedAgentsForOwner(ctx.user.id)),
  create: protectedProcedure.input(z.object({ promptId: z.number().int().positive(), name: z.string().min(3).max(180), isPublic: z.boolean().default(false) })).mutation(async ({ ctx, input }) => {
    const ownerId = await getPromptOwner(input.promptId);
    if (ownerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the prompt owner can deploy an agent." });
    const slug = `${slugify(input.name) || "verbix-agent"}-${nanoid(7).toLowerCase()}`;
    const agentId = await createDeployedAgent({ promptId: input.promptId, ownerId: ctx.user.id, slug, name: input.name, isPublic: input.isPublic });
    return { agentId, slug };
  }),
  publicBySlug: publicProcedure.input(z.object({ slug: z.string().min(1).max(144) })).query(({ input }) => getPublicDeployedAgent(input.slug)),
  invoke: publicProcedure.input(z.object({ slug: z.string().min(1).max(144), variables: z.record(z.string(), z.string()).default({}) })).mutation(async ({ ctx, input }) => {
    const payload = await getPublicDeployedAgent(input.slug);
    if (!payload) throw new TRPCError({ code: "NOT_FOUND", message: "This agent is unavailable or private." });
    const visitorHash = createHash("sha256").update(ctx.req.ip || "anonymous").digest("hex");
    const allowed = await consumeDeployedAgentRateLimit({
      agentId: payload.agent.id,
      visitorHash,
      hourlyLimit: payload.agent.rateLimitPerHour,
    });
    if (!allowed) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "This agent has reached its hourly usage limit. Please try again later." });
    const compiledPrompt = compilePrompt(payload.prompt.body, input.variables);
    return executePromptWithFreeChatbot({ prompt: compiledPrompt, identity: `agent:${payload.agent.id}:${ctx.req.ip || "anonymous"}` });
  }),
});

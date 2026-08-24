import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  addPromptVersion: vi.fn().mockResolvedValue(2),
  acceptPromptImprovement: vi.fn().mockResolvedValue(3),
  bumpCreatorMetric: vi.fn().mockResolvedValue(undefined),
  completePromptRun: vi.fn().mockResolvedValue(undefined),
  consumeDeployedAgentRateLimit: vi.fn().mockResolvedValue(true),
  createDeployedAgent: vi.fn().mockResolvedValue(21),
  createPromptReport: vi.fn().mockResolvedValue(31),
  createPromptRun: vi.fn().mockResolvedValue(41),
  createPromptWithInitialVersion: vi.fn().mockResolvedValue(11),
  getDb: vi.fn().mockResolvedValue(null),
  getPromptForOwner: vi.fn().mockResolvedValue({ prompt: { id: 7, title: "Owned prompt", body: "Plan {{topic}}" }, variables: [], versions: [] }),
  getPromptOwner: vi.fn().mockResolvedValue(1),
  getPublicCreatorProfile: vi.fn().mockResolvedValue({ creator: { id: 1, name: "Creator" }, prompts: [], metrics: { views: 3, runs: 2, saves: 1 } }),
  getPublicDeployedAgent: vi.fn().mockResolvedValue({ agent: { id: 21, slug: "owned-agent", name: "Owned agent", rateLimitPerHour: 30 }, prompt: { id: 7, body: "Answer about {{topic}}" } }),
  getPublicPromptBySlug: vi.fn().mockResolvedValue({ prompt: { id: 7, slug: "owned-prompt", body: "Plan {{topic}}" }, variables: [], tags: [], versions: [], reviews: [] }),
  listDeployedAgentsForOwner: vi.fn().mockResolvedValue([{ id: 21, slug: "owned-agent" }]),
  listModerationQueue: vi.fn().mockResolvedValue({ prompts: [], reviews: [] }),
  listPromptsForOwner: vi.fn().mockResolvedValue([{ id: 7, title: "Owned prompt" }]),
  listPromptRunsForUser: vi.fn().mockResolvedValue([{ id: 41, status: "completed" }]),
  listProviderCredentialHints: vi.fn().mockResolvedValue([{ provider: "openai", secretHint: "••••1234" }]),
  listPublicPrompts: vi.fn().mockResolvedValue([{ id: 7, slug: "owned-prompt", title: "Owned prompt", tags: [] }]),
  recordModeration: vi.fn().mockResolvedValue(undefined),
  recordPromptImprovement: vi.fn().mockResolvedValue(51),
  recordPublicPromptView: vi.fn().mockResolvedValue(undefined),
  removeProviderCredential: vi.fn().mockResolvedValue(undefined),
  setPromptVariables: vi.fn().mockResolvedValue(undefined),
  toggleSavedPrompt: vi.fn().mockResolvedValue(true),
  updatePromptStatus: vi.fn().mockResolvedValue(undefined),
  upsertProviderCredential: vi.fn().mockResolvedValue(undefined),
  upsertReview: vi.fn().mockResolvedValue(true),
}));

vi.mock("./db", () => dbMocks);
vi.mock("./services/free-chatbot", () => ({
  improvePromptWithFreeChatbot: vi.fn().mockResolvedValue({ originalPrompt: "Draft", improvedPrompt: "Improved draft", intentSummary: "Improve", assumptions: [], missingInformation: [], variables: [], constraints: [], outputFormat: "Text", acceptanceCriteria: [], agentNotes: "Notes", warnings: [], provider: "phind", isFallback: false }),
  executePromptWithFreeChatbot: vi.fn().mockResolvedValue({ output: "Completed", provider: "phind", model: "Phind-70B" }),
}));
vi.mock("./services/credential-vault", () => ({
  credentialHint: vi.fn().mockReturnValue("••••1234"),
  encryptCredential: vi.fn().mockReturnValue("encrypted"),
}));

import { appRouter } from "./routers";

function context(role: "user" | "admin" = "user"): TrpcContext {
  return {
    user: { id: 1, openId: "test-user", name: "Tester", email: "tester@example.com", loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {}, ip: "127.0.0.1" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Verbix procedure success coverage", () => {
  it("exercises public discovery, creator, prompt, and agent procedures", async () => {
    const caller = appRouter.createCaller(context());
    expect(await caller.discovery.list({ sort: "trending", limit: 3 })).toHaveLength(1);
    expect((await caller.discovery.bySlug({ slug: "owned-prompt" }))?.prompt.id).toBe(7);
    expect((await caller.discovery.creator({ userId: 1 }))?.metrics.views).toBe(3);
    await expect(caller.discovery.recordView({ promptId: 7 })).resolves.toEqual({ success: true });
    expect((await caller.agents.publicBySlug({ slug: "owned-agent" }))?.agent.id).toBe(21);
    await expect(caller.agents.invoke({ slug: "owned-agent", variables: { topic: "testing" } })).resolves.toMatchObject({ output: "Completed" });
  });

  it("surfaces a public-agent provider failure to the caller", async () => {
    const service = await import("./services/free-chatbot");
    vi.mocked(service.executePromptWithFreeChatbot).mockRejectedValueOnce(new Error("All providers unavailable."));
    const caller = appRouter.createCaller(context());
    await expect(caller.agents.invoke({ slug: "owned-agent", variables: { topic: "testing" } })).rejects.toThrow("All providers unavailable.");
  });

  it("rejects public-agent calls after the persisted hourly visitor limit is exhausted", async () => {
    dbMocks.consumeDeployedAgentRateLimit.mockResolvedValueOnce(false);
    const caller = appRouter.createCaller(context());
    await expect(caller.agents.invoke({ slug: "owned-agent", variables: { topic: "testing" } })).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("exercises authenticated workspace, improvements, execution, agents, and credential procedures", async () => {
    const caller = appRouter.createCaller(context());
    expect(await caller.workspace.mine()).toHaveLength(1);
    expect(await caller.workspace.create({ title: "Owned prompt", description: "A valid prompt description.", body: "Plan {{topic}}", slug: "owned-prompt", promptType: "text", visibility: "private", modelCompatibility: ["General"] })).toBe(11);
    await expect(caller.workspace.saveVersion({ promptId: 7, title: "Owned prompt", body: "Plan {{topic}}" })).resolves.toBe(2);
    await expect(caller.workspace.variables({ promptId: 7, variables: [{ name: "topic", label: "Topic", variableType: "text", isRequired: true }] })).resolves.toEqual({ success: true });
    await expect(caller.workspace.submit({ promptId: 7 })).resolves.toEqual({ success: true });
    await expect(caller.workspace.toggleSave({ promptId: 7 })).resolves.toBe(true);
    await expect(caller.workspace.review({ promptId: 7, rating: 5, comment: "Useful and precise." })).resolves.toBe(true);
    await expect(caller.workspace.report({ promptId: 7, reason: "Needs review" })).resolves.toBe(31);
    expect((await caller.improvement.enhance({ prompt: "Draft" })).improvementId).toBe(51);
    await expect(caller.improvement.accept({ improvementId: 51, promptId: 7, title: "Owned prompt", body: "Improved draft" })).resolves.toEqual({ success: true, versionNumber: 3 });
    await expect(caller.execution.run({ prompt: "Run this prompt.", promptId: 7, variables: {} })).resolves.toMatchObject({ runId: 41, output: "Completed" });
    expect(await caller.execution.history()).toHaveLength(1);
    expect((await caller.agents.create({ promptId: 7, name: "Owned agent", isPublic: true })).agentId).toBe(21);
    expect(await caller.agents.mine()).toHaveLength(1);
    await expect(caller.credentials.set({ provider: "openai", secret: "secret-value-123" })).resolves.toEqual({ success: true });
    expect(await caller.credentials.list()).toHaveLength(1);
    await expect(caller.credentials.remove({ provider: "openai" })).resolves.toEqual({ success: true });
  });

  it("exercises administrator moderation success paths", async () => {
    const caller = appRouter.createCaller(context("admin"));
    await expect(caller.admin.queue()).resolves.toEqual({ prompts: [], reviews: [] });
    await expect(caller.admin.moderatePrompt({ promptId: 7, action: "approve" })).resolves.toEqual({ success: true });
    expect(dbMocks.updatePromptStatus).toHaveBeenCalledWith(7, "published");
  });
});

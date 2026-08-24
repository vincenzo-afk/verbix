import { z } from "zod";

type ChatClient = {
  chat(input: string, options?: { model?: string; maxTokens?: number; previousMessages?: Array<{ role: "user" | "assistant"; content: string }> }): Promise<string>;
};

type FreeChatbotModule = {
  createPhindChat: () => ChatClient;
  createDuckDuckGoChat: () => ChatClient;
  createBlackboxChat: () => ChatClient;
};

const freeChatbotModuleName = "free-chatbot";
let freeChatbotModulePromise: Promise<FreeChatbotModule> | null = null;

function loadFreeChatbotModule() {
  freeChatbotModulePromise ??= import(freeChatbotModuleName) as Promise<FreeChatbotModule>;
  return freeChatbotModulePromise;
}

export const FREE_CHATBOT_ADAPTER_NAME = "free-chatbot";

const improvementSchema = z.object({
  improvedPrompt: z.string().min(1),
  intentSummary: z.string().min(1),
  assumptions: z.array(z.string()).default([]),
  missingInformation: z.array(z.string()).default([]),
  variables: z.array(z.object({ name: z.string(), purpose: z.string() })).default([]),
  constraints: z.array(z.string()).default([]),
  outputFormat: z.string().default("A clear, directly usable response."),
  acceptanceCriteria: z.array(z.string()).default([]),
  agentNotes: z.string().default("Follow the improved prompt while preserving user intent."),
  warnings: z.array(z.string()).default([]),
});

export type PromptImprovement = z.infer<typeof improvementSchema> & {
  originalPrompt: string;
  provider: "phind" | "duckduckgo" | "blackbox" | "local-fallback";
  isFallback: boolean;
};

export type ImprovePromptInput = {
  prompt: string;
  target?: string;
  tone?: string;
  outputStrictness?: "concise" | "balanced" | "detailed";
  identity: string;
};

export class FreeChatbotUnavailableError extends Error {
  constructor(message = "The free-chatbot providers are temporarily unavailable.") {
    super(message);
    this.name = "FreeChatbotUnavailableError";
  }
}

const MAX_PROMPT_LENGTH = 12_000;
const MAX_PROVIDER_RESPONSE_LENGTH = 24_000;
const REQUEST_TIMEOUT_MS = 16_000;
const MAX_REQUESTS_PER_WINDOW = 8;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const requestWindows = new Map<string, number[]>();

function enforceRateLimit(identity: string) {
  const now = Date.now();
  const recent = (requestWindows.get(identity) ?? []).filter(
    timestamp => now - timestamp < RATE_LIMIT_WINDOW_MS,
  );

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new Error("Prompt improvement limit reached. Please wait a few minutes before trying again.");
  }

  recent.push(now);
  requestWindows.set(identity, recent);
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), REQUEST_TIMEOUT_MS);
    }),
  ]);
}

function extractJson(raw: string) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1];
  const candidate = fenced ?? raw.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) return null;

  try {
    return JSON.parse(candidate) as unknown;
  } catch {
    return null;
  }
}

function providerResponseError(raw: string) {
  const sample = raw.trim().slice(0, 400);
  if (raw.length > MAX_PROVIDER_RESPONSE_LENGTH) return "returned an oversized response";
  if (/<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]|<script[\s>]/i.test(sample)) return "returned an HTML page instead of model output";
  return null;
}

function localFallback(prompt: string, warning: string): PromptImprovement {
  const variableNames = Array.from(
    prompt.matchAll(/\{\{\s*([^{}\s]+)\s*\}\}/g),
    match => match[1],
  );
  const improvedPrompt = [
    "## Objective",
    "Complete the user’s request faithfully, preserving all stated requirements and avoiding unsupported assumptions.",
    "",
    "## User prompt",
    prompt.trim(),
    "",
    "## Execution guidance",
    "Clarify ambiguous details before committing to irreversible actions. Make constraints explicit, reason step by step when useful, and deliver the requested output in a directly usable format.",
  ].join("\n");

  return {
    originalPrompt: prompt,
    improvedPrompt,
    intentSummary: "Preserve the user’s request while making intent, inputs, constraints, and expected output explicit.",
    assumptions: [],
    missingInformation: ["Confirm any scope, audience, deadline, or required output format that is not stated."],
    variables: variableNames.map(name => ({ name, purpose: "User-supplied prompt variable" })),
    constraints: ["Do not invent facts or requirements.", "Preserve the original prompt text and intent."],
    outputFormat: "A concise, actionable response matching the user’s requested format.",
    acceptanceCriteria: ["Addresses the stated goal.", "Respects all explicit constraints.", "Surfaces material ambiguities instead of guessing."],
    agentNotes: "Use the original prompt as the source of truth. Ask a concise clarifying question only when missing information blocks safe completion.",
    warnings: [warning],
    provider: "local-fallback",
    isFallback: true,
  };
}

function buildEnhancementRequest(input: ImprovePromptInput) {
  const target = input.target?.trim() || "a capable downstream AI agent";
  const tone = input.tone?.trim() || "clear and professional";
  const strictness = input.outputStrictness ?? "balanced";

  return `You are a prompt architect. Improve the user prompt below for ${target} while preserving the original intent exactly. Do not invent facts. Return ONLY valid JSON with this exact shape:
{
  "improvedPrompt": "string",
  "intentSummary": "string",
  "assumptions": ["string"],
  "missingInformation": ["string"],
  "variables": [{"name": "string", "purpose": "string"}],
  "constraints": ["string"],
  "outputFormat": "string",
  "acceptanceCriteria": ["string"],
  "agentNotes": "string",
  "warnings": ["string"]
}

The improved prompt should be ${strictness}, use a ${tone} tone, retain {{variable}} tokens exactly, distinguish stated requirements from assumptions, and give downstream agents a useful execution structure.

USER PROMPT:
${input.prompt}`;
}

function normalizeResponse(raw: string, originalPrompt: string, provider: PromptImprovement["provider"]): PromptImprovement {
  const responseError = providerResponseError(raw);
  if (responseError) return localFallback(originalPrompt, `The provider ${responseError}; Verbix generated a safe editable fallback.`);
  const parsed = extractJson(raw);
  const validation = improvementSchema.safeParse(parsed);

  if (validation.success) {
    return { ...validation.data, originalPrompt, provider, isFallback: false };
  }

  return localFallback(originalPrompt, "The provider returned unstructured output; Verbix generated a safe editable fallback.");
}

export async function improvePromptWithFreeChatbot(input: ImprovePromptInput): Promise<PromptImprovement> {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Enter a prompt before requesting an improvement.");
  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(`Prompts must be ${MAX_PROMPT_LENGTH.toLocaleString()} characters or fewer.`);
  }

  enforceRateLimit(input.identity);
  const request = buildEnhancementRequest({ ...input, prompt });
  const { createBlackboxChat, createDuckDuckGoChat, createPhindChat } = await loadFreeChatbotModule();
  const providers = [
    {
      id: "phind" as const,
      run: () => createPhindChat().chat(request, { model: "Phind-70B" }),
    },
    {
      id: "duckduckgo" as const,
      run: () => createDuckDuckGoChat().chat(request, { model: "gpt-4o-mini" }),
    },
    {
      id: "blackbox" as const,
      run: () => createBlackboxChat().chat(request, { maxTokens: 2200 }),
    },
  ];

  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const response = await withTimeout(Promise.resolve(provider.run()), provider.id);
      const raw = typeof response === "string" ? response : JSON.stringify(response);
      if (!raw.trim()) throw new Error("returned an empty response");
      const responseError = providerResponseError(raw);
      if (responseError) throw new Error(responseError);
      return normalizeResponse(raw, prompt, provider.id);
    } catch (error) {
      failures.push(`${provider.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  const fallback = localFallback(prompt, "All free-chatbot providers are currently unavailable. Your original prompt is preserved and can still be edited or exported.");
  fallback.warnings.push(`Provider diagnostics: ${failures.join(" | ")}`);
  return fallback;
}

export async function executePromptWithFreeChatbot(input: { prompt: string; identity: string }) {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Enter a compiled prompt before running it.");
  if (prompt.length > MAX_PROMPT_LENGTH) throw new Error(`Prompts must be ${MAX_PROMPT_LENGTH.toLocaleString()} characters or fewer.`);
  enforceRateLimit(`run:${input.identity}`);

  const { createBlackboxChat, createDuckDuckGoChat, createPhindChat } = await loadFreeChatbotModule();
  const providers = [
    { id: "phind" as const, model: "Phind-70B", run: () => createPhindChat().chat(prompt, { model: "Phind-70B" }) },
    { id: "duckduckgo" as const, model: "gpt-4o-mini", run: () => createDuckDuckGoChat().chat(prompt, { model: "gpt-4o-mini" }) },
    { id: "blackbox" as const, model: "Blackbox", run: () => createBlackboxChat().chat(prompt, { maxTokens: 2200 }) },
  ];

  const failures: string[] = [];
  for (const provider of providers) {
    try {
      const response = await withTimeout(Promise.resolve(provider.run()), provider.id);
      const output = typeof response === "string" ? response.trim() : JSON.stringify(response);
      if (!output) throw new Error("returned an empty response");
      const responseError = providerResponseError(output);
      if (responseError) throw new Error(responseError);
      return { output, provider: provider.id, model: provider.model };
    } catch (error) {
      failures.push(`${provider.id}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  throw new FreeChatbotUnavailableError(`No free-chatbot provider responded successfully. ${failures.join(" | ")}`);
}

export { buildEnhancementRequest, localFallback, normalizeResponse, providerResponseError };

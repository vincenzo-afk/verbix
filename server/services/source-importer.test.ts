import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]),
}));

vi.mock("./free-chatbot", () => ({
  improvePromptWithFreeChatbot: vi.fn().mockResolvedValue({
    originalPrompt: "Generate an image",
    improvedPrompt: "## Objective\nGenerate a detailed image.",
    intentSummary: "Create a visual concept.",
    variables: [{ name: "subject", purpose: "Visual subject" }],
    constraints: ["Keep the composition coherent."],
    outputFormat: "A complete image-generation prompt.",
    acceptanceCriteria: ["Includes subject and style."],
    provider: "phind",
    isFallback: false,
  }),
}));

import { ImportBlockedError, inspectApprovedSource, normalizeSourcePrompts, sourceDomain, sourceUrlHash } from "./source-importer";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => vi.unstubAllGlobals());

describe("review-first source importer", () => {
  it("normalizes supported public source addresses and rejects unsafe URL forms", () => {
    expect(sourceDomain("https://www.example.com/path?x=1")).toBe("www.example.com");
    expect(sourceUrlHash("https://www.example.com/path")).toHaveLength(64);
    expect(() => sourceDomain("ftp://example.com/file")).toThrow("Only public HTTP(S) URLs");
    expect(() => sourceDomain("https://user:secret@example.com/private")).toThrow("credentials");
  });

  it("uses AI normalization while preserving source prompt text and classifying an image-generation candidate", async () => {
    const candidates = await normalizeSourcePrompts({ promptBlocks: ["Create a Midjourney image of {{subject}} in a cinematic style."], identity: "test-import" });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ modality: "image", normalizationProvider: "phind", sourcePromptText: "Create a Midjourney image of {{subject}} in a cinematic style." });
    expect(candidates[0]?.variables).toEqual([{ name: "subject", purpose: "Visual subject" }]);
  });

  it("extracts bounded public HTML with provenance and reference-only example outputs after an allowed robots check", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("User-agent: *\nAllow: /", { status: 200 }))
      .mockResolvedValueOnce(new Response(`<!doctype html><html><head><title>Image prompt guide</title><meta name="author" content="Source Author" /><link rel="canonical" href="https://example.com/prompt-guide" /></head><body><main><h2>Image prompt</h2><pre>Create a Midjourney image of {{subject}} with cinematic lighting.</pre><figure><img src="/example-output.jpg" alt="Example output" /></figure></main></body></html>`, { status: 200, headers: { "content-type": "text/html" } }));
    const inspected = await inspectApprovedSource("https://example.com/prompt-guide");
    expect(inspected).toMatchObject({ canonicalUrl: "https://example.com/prompt-guide", pageTitle: "Image prompt guide", displayedAuthor: "Source Author", robotsState: "allowed" });
    expect(inspected.promptBlocks[0]).toContain("Midjourney image");
    expect(inspected.exampleOutputs).toEqual([expect.objectContaining({ mediaUrl: "https://example.com/example-output.jpg", mediaType: "image", altText: "Example output" })]);
  });

  it("blocks source extraction when the requested path is disallowed by robots policy", async () => {
    fetchMock.mockResolvedValueOnce(new Response("User-agent: *\nDisallow: /private", { status: 200 }));
    await expect(inspectApprovedSource("https://example.com/private/prompt-guide")).rejects.toBeInstanceOf(ImportBlockedError);
  });
});

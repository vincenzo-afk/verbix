import { describe, expect, it } from "vitest";
import { localFallback, normalizeResponse, providerResponseError } from "./free-chatbot";

describe("free-chatbot adapter result normalization", () => {
  it("normalizes a valid structured provider response while preserving original prompt text", () => {
    const originalPrompt = "Draft an email for {{audience}}.";
    const result = normalizeResponse(JSON.stringify({
      improvedPrompt: "Write a concise email for {{audience}}.",
      intentSummary: "Create a concise audience-specific email.",
      assumptions: [],
      missingInformation: [],
      variables: [{ name: "audience", purpose: "Recipient group" }],
      constraints: ["Preserve {{audience}}"],
      outputFormat: "Email with subject and body",
      acceptanceCriteria: ["Includes a clear call to action"],
      agentNotes: "Do not invent recipient facts.",
      warnings: [],
    }), originalPrompt, "phind");

    expect(result.originalPrompt).toBe(originalPrompt);
    expect(result.provider).toBe("phind");
    expect(result.isFallback).toBe(false);
    expect(result.improvedPrompt).toContain("{{audience}}");
  });

  it("returns an editable safe fallback when a provider response is not structured JSON", () => {
    const result = normalizeResponse("Useful but unstructured provider text", "Plan {{project}}", "duckduckgo");
    expect(result.isFallback).toBe(true);
    expect(result.originalPrompt).toBe("Plan {{project}}");
    expect(result.variables).toEqual([{ name: "project", purpose: "User-supplied prompt variable" }]);
    expect(result.warnings[0]).toContain("unstructured");
  });

  it("rejects HTML pages and oversized provider payloads before they can be stored or rendered", () => {
    const html = "<!doctype html><html><head><title>Provider error</title></head><body>Unavailable</body></html>";
    expect(providerResponseError(html)).toContain("HTML page");
    expect(providerResponseError("x".repeat(24_001))).toContain("oversized");
    const fallback = normalizeResponse(html, "Plan {{project}}", "blackbox");
    expect(fallback.provider).toBe("local-fallback");
    expect(fallback.improvedPrompt).not.toContain("<html");
    expect(fallback.improvedPrompt).toContain("{{project}}");
  });

  it("makes a local fallback that retains variable tokens and constraints", () => {
    const result = localFallback("Build {{artifact}}", "Provider unavailable");
    expect(result.improvedPrompt).toContain("{{artifact}}");
    expect(result.constraints).toContain("Preserve the original prompt text and intent.");
  });
});

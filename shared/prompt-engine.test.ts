import { describe, expect, it } from "vitest";
import { compilePrompt, parsePromptVariables, validateVariableValues } from "./prompt-engine";

describe("prompt variable engine", () => {
  it("parses unique {{variable}} tokens while retaining occurrence counts", () => {
    const result = parsePromptVariables("Write for {{audience}} about {{topic}}. Keep {{audience}} engaged.");
    expect(result).toEqual([
      { name: "audience", label: "Audience", occurrences: 2 },
      { name: "topic", label: "Topic", occurrences: 1 },
    ]);
  });

  it("leaves missing values as exact variable tokens in a compiled preview", () => {
    expect(compilePrompt("Create {{deliverable}} for {{audience}}", { deliverable: "brief" })).toBe("Create brief for {{audience}}");
  });

  it("validates required, numeric, and select values", () => {
    const errors = validateVariableValues([
      { name: "budget", label: "Budget", isRequired: true, variableType: "number" },
      { name: "tone", label: "Tone", isRequired: false, variableType: "select", options: ["formal", "friendly"] },
    ], { budget: "many", tone: "casual" });

    expect(errors.budget).toBe("Budget must be a number.");
    expect(errors.tone).toBe("Tone must use one of the available options.");
  });
});

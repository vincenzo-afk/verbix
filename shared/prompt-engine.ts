export type ParsedVariable = {
  name: string;
  label: string;
  occurrences: number;
};

const tokenPattern = /\{\{\s*([A-Za-z][A-Za-z0-9_-]{0,119})\s*\}\}/g;

export function parsePromptVariables(prompt: string): ParsedVariable[] {
  const seen = new Map<string, ParsedVariable>();

  for (const match of Array.from(prompt.matchAll(tokenPattern))) {
    const name = match[1];
    const current = seen.get(name);
    if (current) {
      current.occurrences += 1;
      continue;
    }

    seen.set(name, {
      name,
      label: name.replace(/[-_]/g, " ").replace(/\b\w/g, (character: string) => character.toUpperCase()),
      occurrences: 1,
    });
  }

  return Array.from(seen.values());
}

export function compilePrompt(prompt: string, values: Record<string, string>): string {
  return prompt.replace(tokenPattern, (_token, variableName: string) => values[variableName]?.trim() || `{{${variableName}}}`);
}

export function validateVariableValues(
  variables: Array<{ name: string; label: string; isRequired: boolean; variableType: "text" | "number" | "select"; options?: string[] | null }>,
  values: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const variable of variables) {
    const value = values[variable.name]?.trim() ?? "";
    if (variable.isRequired && !value) {
      errors[variable.name] = `${variable.label} is required.`;
      continue;
    }

    if (value && variable.variableType === "number" && Number.isNaN(Number(value))) {
      errors[variable.name] = `${variable.label} must be a number.`;
    }

    if (value && variable.variableType === "select" && variable.options?.length && !variable.options.includes(value)) {
      errors[variable.name] = `${variable.label} must use one of the available options.`;
    }
  }

  return errors;
}

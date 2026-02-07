/**
 * LLM-powered color suggestion generator.
 *
 * Uses Ollama to suggest semantic color replacements for hard-coded colors.
 * Runs synchronously via child process (ESLint rules must be sync).
 */

import { spawnSync } from "child_process";
import { relative } from "path";
import { UILINT_DEFAULT_OLLAMA_MODEL } from "uilint-core";
import {
  discoverSemanticColors,
  findProjectRoot,
} from "./semantic-color-discovery.js";
import {
  getCachedSuggestions,
  setCachedSuggestions,
  simpleHash,
  type ColorSuggestion,
} from "./color-suggestion-cache.js";

export interface SuggestionResult {
  suggestions: ColorSuggestion[];
  fromCache: boolean;
}

/**
 * Build prompt for color suggestion
 */
function buildColorSuggestionPrompt(
  hardcodedColors: string[],
  availableSemanticColors: string[]
): string {
  return `You are a UI/CSS expert. Given a list of hard-coded Tailwind color classes and available semantic color names, suggest the best semantic replacement for each.

Hard-coded colors found:
${hardcodedColors.map((c) => `- ${c}`).join("\n")}

Available semantic colors in this project:
${availableSemanticColors.map((c) => `- ${c}`).join("\n")}

For each hard-coded color, suggest the most appropriate semantic replacement based on:
- Color hue similarity (red → destructive, blue → primary, etc.)
- Common UI patterns (error states use destructive, links use primary, etc.)
- The utility prefix (bg-, text-, border-, etc.) should be preserved

Respond with ONLY a JSON object in this exact format:
{
  "suggestions": [
    { "hardcoded": "bg-red-500", "suggested": "bg-destructive" },
    { "hardcoded": "text-blue-600", "suggested": "text-primary" }
  ]
}

If no good semantic match exists for a color, suggest the closest alternative or omit it.`;
}

/**
 * Get color suggestions using LLM (synchronously via child process)
 *
 * Returns suggestions from cache if available, otherwise calls LLM.
 */
export function getColorSuggestions(
  hardcodedColors: string[],
  fileDir: string,
  fileContent: string,
  model?: string
): SuggestionResult {
  if (hardcodedColors.length === 0) {
    return { suggestions: [], fromCache: true };
  }

  const projectRoot = findProjectRoot(fileDir);
  const relativeFilePath = relative(projectRoot, fileDir);
  const fileHash = simpleHash(fileContent);

  // Discover available semantic colors
  const discovery = discoverSemanticColors(fileDir);
  const configHash = discovery.configHash;

  // Check cache first
  const cached = getCachedSuggestions(
    projectRoot,
    relativeFilePath,
    fileHash,
    configHash
  );

  if (cached) {
    // Filter to only suggestions for colors we're currently asking about
    const relevantSuggestions = cached.filter((s) =>
      hardcodedColors.includes(s.hardcoded)
    );
    if (relevantSuggestions.length > 0) {
      return { suggestions: relevantSuggestions, fromCache: true };
    }
  }

  // Cache miss - call LLM
  const suggestions = callLlmForSuggestions(
    hardcodedColors,
    discovery.colors,
    model || UILINT_DEFAULT_OLLAMA_MODEL
  );

  // Update cache with new suggestions
  if (suggestions.length > 0) {
    const existingSuggestions = cached || [];
    const mergedSuggestions = [...existingSuggestions];

    // Add new suggestions, replacing any with same hardcoded color
    for (const newSugg of suggestions) {
      const existingIdx = mergedSuggestions.findIndex(
        (s) => s.hardcoded === newSugg.hardcoded
      );
      if (existingIdx >= 0) {
        mergedSuggestions[existingIdx] = newSugg;
      } else {
        mergedSuggestions.push(newSugg);
      }
    }

    setCachedSuggestions(
      projectRoot,
      relativeFilePath,
      fileHash,
      configHash,
      mergedSuggestions
    );
  }

  return { suggestions, fromCache: false };
}

/**
 * Call LLM synchronously for color suggestions
 */
function callLlmForSuggestions(
  hardcodedColors: string[],
  availableSemanticColors: string[],
  model: string
): ColorSuggestion[] {
  const prompt = buildColorSuggestionPrompt(
    hardcodedColors,
    availableSemanticColors
  );

  // Resolve uilint-core/node for child process
  const coreNodeUrl = new URL(
    "../../../../node_modules/uilint-core/dist/node.js",
    import.meta.url
  ).href;

  const childScript = `
    import * as coreNode from ${JSON.stringify(coreNodeUrl)};
    const { OllamaClient } = coreNode;

    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    const input = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    const client = new OllamaClient({ model: input.model });
    const ok = await client.isAvailable();

    if (!ok) {
      process.stdout.write(JSON.stringify({ suggestions: [], error: "ollama_unavailable" }));
      process.exit(0);
    }

    try {
      const response = await client.complete(input.prompt, { json: true });
      process.stdout.write(response);
    } catch (e) {
      process.stdout.write(JSON.stringify({ suggestions: [], error: e.message }));
    }
  `;

  try {
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", childScript],
      {
        input: JSON.stringify({ model, prompt }),
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        maxBuffer: 10 * 1024 * 1024,
        timeout: 30000, // 30 second timeout
      }
    );

    if (child.error || child.status !== 0) {
      return [];
    }

    const responseText = (child.stdout || "").trim();
    if (!responseText) {
      return [];
    }

    const parsed = JSON.parse(responseText) as {
      suggestions?: ColorSuggestion[];
      error?: string;
    };

    if (parsed.error === "ollama_unavailable") {
      return [];
    }

    return parsed.suggestions || [];
  } catch {
    return [];
  }
}

/**
 * Check if Ollama is available (synchronously via child process)
 */
export function isOllamaAvailableSync(): boolean {
  const childScript = `
    try {
      const response = await fetch("http://localhost:11434/api/tags", {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      process.stdout.write(response.ok ? "true" : "false");
    } catch {
      process.stdout.write("false");
    }
  `;

  try {
    const child = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", childScript],
      {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        timeout: 5000,
      }
    );

    return child.stdout?.trim() === "true";
  } catch {
    return false;
  }
}

/**
 * Format suggestions for error message (succinct)
 *
 * Returns a string like "Try: bg-destructive, text-primary"
 * Limited to 1-2 suggestions for brevity.
 */
export function formatSuggestionsForMessage(
  suggestions: ColorSuggestion[],
  limit: number = 2
): string {
  if (suggestions.length === 0) return "";

  const limited = suggestions.slice(0, limit);
  const formatted = limited.map((s) => s.suggested).join(", ");

  return `Try: ${formatted}`;
}

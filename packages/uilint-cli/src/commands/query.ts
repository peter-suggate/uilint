/**
 * Query command - queries the style guide for specific rules
 */

import { OllamaClient, parseStyleGuide, extractStyleValues } from "uilint-core";
import {
  ensureOllamaReady,
  readStyleGuide,
  readStyleGuideFromProject,
} from "uilint-core/node";
import { existsSync } from "fs";
import {
  intro,
  outro,
  withSpinner,
  note,
  logError,
  pc,
} from "../utils/prompts.js";
import { printJSON } from "../utils/output.js";

export interface QueryOptions {
  styleguide?: string;
  output?: "text" | "json";
  model?: string;
}

export async function query(
  queryText: string,
  options: QueryOptions
): Promise<void> {
  const isJsonOutput = options.output === "json";

  if (!isJsonOutput) {
    intro("Query Style Guide");
  }

  try {
    // Get style guide
    const projectPath = process.cwd();
    let styleGuide: string | null = null;

    if (options.styleguide) {
      if (existsSync(options.styleguide)) {
        styleGuide = await readStyleGuide(options.styleguide);
      } else {
        styleGuide = await readStyleGuideFromProject(options.styleguide);
      }
    } else {
      styleGuide = await readStyleGuideFromProject(projectPath);
    }

    if (!styleGuide) {
      if (isJsonOutput) {
        printJSON({ query: queryText, error: "No style guide found" });
      } else {
        logError("No style guide found");
        note(
          `Create ${pc.cyan(
            ".uilint/styleguide.md"
          )} first (recommended: run ${pc.cyan("/genstyleguide")} in Cursor).`,
          "Tip"
        );
      }
      process.exit(1);
    }

    // Check if we can answer without LLM
    const simpleAnswer = getSimpleAnswer(queryText, styleGuide);
    if (simpleAnswer) {
      if (isJsonOutput) {
        printJSON({ query: queryText, answer: simpleAnswer });
      } else {
        note(simpleAnswer, "Answer");
        outro("Query complete");
      }
      return;
    }

    // Use LLM for complex queries
    if (!isJsonOutput) {
      await withSpinner("Preparing Ollama", async () => {
        await ensureOllamaReady({ model: options.model });
      });
    } else {
      await ensureOllamaReady({ model: options.model });
    }

    const client = new OllamaClient({ model: options.model });
    let answer: string;

    if (isJsonOutput) {
      answer = await client.queryStyleGuide(queryText, styleGuide);
    } else {
      answer = await withSpinner("Querying with LLM", async () => {
        return await client.queryStyleGuide(queryText, styleGuide);
      });
    }

    if (isJsonOutput) {
      printJSON({ query: queryText, answer });
    } else {
      note(answer, "Answer");
      outro("Query complete");
    }
  } catch (error) {
    if (isJsonOutput) {
      printJSON({
        query: queryText,
        error: error instanceof Error ? error.message : "Query failed",
      });
    } else {
      logError(error instanceof Error ? error.message : "Query failed");
    }
    process.exit(1);
  }
}

/**
 * Attempts to answer simple queries without LLM
 */
function getSimpleAnswer(queryText: string, styleGuide: string): string | null {
  const lowerQuery = queryText.toLowerCase();
  const values = extractStyleValues(styleGuide);
  const parsed = parseStyleGuide(styleGuide);

  // Colors query
  if (lowerQuery.includes("color")) {
    if (parsed.colors.length > 0) {
      const colors = parsed.colors
        .map((c) => `  ${c.name}: ${c.value}${c.usage ? ` (${c.usage})` : ""}`)
        .join("\n");
      return `Colors in the style guide:\n${colors}`;
    }
    if (values.colors.length > 0) {
      return `Colors found: ${values.colors.join(", ")}`;
    }
    return "No colors defined in the style guide.";
  }

  // Font query
  if (lowerQuery.includes("font") && !lowerQuery.includes("size")) {
    if (values.fontFamilies.length > 0) {
      return `Font families: ${values.fontFamilies.join(", ")}`;
    }
    return "No font families defined in the style guide.";
  }

  // Font size query
  if (lowerQuery.includes("font size") || lowerQuery.includes("fontsize")) {
    if (values.fontSizes.length > 0) {
      return `Font sizes: ${values.fontSizes.join(", ")}`;
    }
    return "No font sizes defined in the style guide.";
  }

  // Spacing query
  if (
    lowerQuery.includes("spacing") ||
    lowerQuery.includes("padding") ||
    lowerQuery.includes("margin")
  ) {
    if (parsed.spacing.length > 0) {
      const spacing = parsed.spacing
        .map((s) => `  ${s.name}: ${s.value}`)
        .join("\n");
      return `Spacing values:\n${spacing}`;
    }
    return "No spacing values defined in the style guide.";
  }

  // Component query
  if (
    lowerQuery.includes("component") ||
    lowerQuery.includes("button") ||
    lowerQuery.includes("card")
  ) {
    if (parsed.components.length > 0) {
      const components = parsed.components
        .map((c) => `  ${c.name}: ${c.styles.join(", ")}`)
        .join("\n");
      return `Component styles:\n${components}`;
    }
    return "No component styles defined in the style guide.";
  }

  // Can't answer simply, need LLM
  return null;
}

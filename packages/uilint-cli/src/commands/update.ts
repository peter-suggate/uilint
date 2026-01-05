/**
 * Update command - updates existing style guide with new styles
 */

import { dirname, resolve } from "path";
import {
  createStyleSummary,
  parseStyleGuide,
  mergeStyleGuides,
  styleGuideToMarkdown,
} from "uilint-core";
import {
  readStyleGuide,
  writeStyleGuide,
  findStyleGuidePath,
  ensureOllamaReady,
  readTailwindThemeTokens,
} from "uilint-core/node";
import { getInput, type InputOptions } from "../utils/input.js";
import { createLLMClient, flushLangfuse } from "../utils/llm-client.js";
import {
  intro,
  outro,
  withSpinner,
  note,
  logSuccess,
  logInfo,
  logError,
  pc,
} from "../utils/prompts.js";

export interface UpdateOptions extends InputOptions {
  styleguide?: string;
  model?: string;
  llm?: boolean;
}

export async function update(options: UpdateOptions): Promise<void> {
  intro("Update Style Guide");

  try {
    const projectPath = process.cwd();
    const styleGuidePath =
      options.styleguide || findStyleGuidePath(projectPath);

    if (!styleGuidePath) {
      logError("No style guide found");
      note(
        `Create ${pc.cyan(
          ".uilint/styleguide.md"
        )} first (recommended: run ${pc.cyan("/genstyleguide")} in Cursor).`,
        "Tip"
      );
      await flushLangfuse();
      process.exit(1);
    }

    logInfo(`Using styleguide: ${pc.dim(styleGuidePath)}`);

    // Read existing style guide
    const existingContent = await readStyleGuide(styleGuidePath);
    const existingGuide = parseStyleGuide(existingContent);

    // Get input
    let snapshot;
    try {
      snapshot = await withSpinner("Analyzing project", async () => {
        return await getInput(options);
      });
    } catch {
      logError("No input provided. Use --input-file or pipe HTML to stdin.");
      await flushLangfuse();
      process.exit(1);
    }

    logInfo(`Found ${pc.cyan(String(snapshot.elementCount))} elements`);

    const tailwindSearchDir = options.inputFile
      ? dirname(resolve(projectPath, options.inputFile))
      : projectPath;
    const tailwindTheme = readTailwindThemeTokens(tailwindSearchDir);

    if (options.llm) {
      // Use LLM to suggest updates
      await withSpinner("Preparing Ollama", async () => {
        await ensureOllamaReady({ model: options.model });
      });

      const result = await withSpinner(
        "Analyzing styles with LLM",
        async () => {
          const client = await createLLMClient({ model: options.model });
          const styleSummary = createStyleSummary(snapshot.styles, {
            html: snapshot.html,
            tailwindTheme,
          });
          return await client.analyzeStyles(styleSummary, existingContent);
        }
      );

      if (result.issues.length > 0) {
        const suggestions = result.issues.map((issue) => {
          let line = `• ${issue.message}`;
          if (issue.suggestion) {
            line += `\n  ${pc.cyan("→")} ${issue.suggestion}`;
          }
          return line;
        });

        note(
          suggestions.join("\n\n"),
          `Found ${result.issues.length} suggestion(s)`
        );
        logInfo("Edit the styleguide manually to apply these changes.");
        outro("Analysis complete");
      } else {
        logSuccess("Style guide is up to date!");
        outro("No changes needed");
      }
    } else {
      // Parse new styles and merge
      const updatedContent = await withSpinner("Merging styles", async () => {
        // Create a new guide from detected styles
        const mergedColors = new Map(snapshot.styles.colors);
        for (const m of (snapshot.html || "").matchAll(/#[A-Fa-f0-9]{6}\b/g)) {
          const hex = (m[0] || "").toUpperCase();
          if (!hex) continue;
          mergedColors.set(hex, (mergedColors.get(hex) || 0) + 1);
        }

        const detectedColors = [...mergedColors.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([value], index) => ({
            name: `Color ${index + 1}`,
            value: value.toUpperCase(),
            usage: "",
          }));

        const detectedGuide = {
          colors: detectedColors,
          typography: [],
          spacing: [],
          components: [],
        };

        // Merge with existing
        const mergedGuide = mergeStyleGuides(existingGuide, detectedGuide);
        return styleGuideToMarkdown(mergedGuide);
      });

      // Check if there are any changes
      if (updatedContent === existingContent) {
        logSuccess("Style guide is already up to date!");
        outro("No changes needed");
        return;
      }

      // Write updated style guide
      await withSpinner("Writing styleguide", async () => {
        await writeStyleGuide(styleGuidePath, updatedContent);
      });

      note(`Updated: ${pc.dim(styleGuidePath)}`, "Success");
      outro("Style guide updated!");
    }
  } catch (error) {
    logError(error instanceof Error ? error.message : "Update failed");
    await flushLangfuse();
    process.exit(1);
  }

  // Flush before normal exit
  await flushLangfuse();
}

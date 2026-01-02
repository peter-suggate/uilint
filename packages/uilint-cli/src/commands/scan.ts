/**
 * Scan command - scans HTML for UI consistency issues
 */

import { dirname, resolve } from "path";
import {
  OllamaClient,
  createStyleSummary,
  type UILintIssue,
  type StreamProgressCallback,
} from "uilint-core";
import {
  ensureOllamaReady,
  readStyleGuideFromProject,
  findStyleGuidePath,
  STYLEGUIDE_PATHS,
  readTailwindThemeTokens,
} from "uilint-core/node";
import { getInput, type InputOptions } from "../utils/input.js";
import {
  intro,
  outro,
  withSpinner,
  createSpinner,
  note,
  logInfo,
  logWarning,
  logError,
  logSuccess,
  pc,
} from "../utils/prompts.js";
import { printJSON } from "../utils/output.js";

export interface ScanOptions extends InputOptions {
  styleguide?: string;
  output?: "text" | "json";
  model?: string;
}

/**
 * Format issues for clack-styled output
 */
function formatIssuesClack(issues: UILintIssue[]): string {
  if (issues.length === 0) {
    return pc.green("✓ No UI consistency issues found");
  }

  const lines: string[] = [];

  issues.forEach((issue, index) => {
    const icon = getTypeIcon(issue.type);
    const typeLabel = pc.dim(`[${issue.type}]`);
    lines.push(
      `${pc.yellow(String(index + 1))}. ${icon} ${typeLabel} ${issue.message}`
    );

    if (issue.currentValue && issue.expectedValue) {
      lines.push(
        `   ${pc.red(issue.currentValue)} ${pc.dim("→")} ${pc.green(
          issue.expectedValue
        )}`
      );
    } else if (issue.currentValue) {
      lines.push(`   ${pc.dim("Value:")} ${issue.currentValue}`);
    }

    if (issue.suggestion) {
      lines.push(`   ${pc.cyan("💡")} ${pc.dim(issue.suggestion)}`);
    }
  });

  return lines.join("\n");
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    color: "🎨",
    typography: "📝",
    spacing: "📏",
    component: "🧩",
    responsive: "📱",
    accessibility: "♿",
  };
  return icons[type] || "•";
}

export async function scan(options: ScanOptions): Promise<void> {
  // For JSON output, skip the fancy UI
  const isJsonOutput = options.output === "json";

  if (!isJsonOutput) {
    intro("Scan for UI Issues");
  }

  try {
    // Get input
    let snapshot;
    try {
      if (isJsonOutput) {
        snapshot = await getInput(options);
      } else {
        snapshot = await withSpinner("Parsing input", async () => {
          return await getInput(options);
        });
      }
    } catch {
      if (isJsonOutput) {
        printJSON({ error: "No input provided", issues: [] });
      } else {
        logError("No input provided. Use --input-file or pipe HTML to stdin.");
      }
      process.exit(1);
    }

    if (!isJsonOutput) {
      logInfo(`Scanning ${pc.cyan(String(snapshot.elementCount))} elements`);
    }

    // Get style guide
    const projectPath = options.styleguide || process.cwd();
    const styleguideLocation = findStyleGuidePath(projectPath);

    let styleGuide: string | null = null;
    if (styleguideLocation) {
      styleGuide = await readStyleGuideFromProject(projectPath);
      if (!isJsonOutput) {
        logSuccess(`Using styleguide: ${pc.dim(styleguideLocation)}`);
      }
    } else {
      if (!isJsonOutput) {
        logWarning("No styleguide found");
        note(
          [
            `Searched in: ${projectPath}`,
            "",
            "Looked for:",
            ...STYLEGUIDE_PATHS.map((p) => `  • ${p}`),
            "",
            `Create ${pc.cyan(
              ".uilint/styleguide.md"
            )} (recommended: run ${pc.cyan("/genstyleguide")} in Cursor).`,
          ].join("\n"),
          "Missing Styleguide"
        );
      }
    }

    // Create style summary
    const tailwindSearchDir = options.inputFile
      ? dirname(resolve(process.cwd(), options.inputFile))
      : projectPath;
    const tailwindTheme = readTailwindThemeTokens(tailwindSearchDir);
    const styleSummary = createStyleSummary(snapshot.styles, {
      html: snapshot.html,
      tailwindTheme,
    });

    // Prepare Ollama
    if (!isJsonOutput) {
      await withSpinner("Preparing Ollama", async () => {
        await ensureOllamaReady({ model: options.model });
      });
    } else {
      await ensureOllamaReady({ model: options.model });
    }

    // Call Ollama for analysis
    const client = new OllamaClient({ model: options.model });
    let result;

    if (isJsonOutput) {
      result = await client.analyzeStyles(styleSummary, styleGuide);
    } else {
      // Use streaming to show progress
      const s = createSpinner();
      s.start("Analyzing with LLM");

      const onProgress: StreamProgressCallback = (latestLine) => {
        // Truncate line if too long for terminal
        const maxLen = 60;
        const displayLine =
          latestLine.length > maxLen
            ? latestLine.slice(0, maxLen) + "…"
            : latestLine;
        s.message(`Analyzing: ${pc.dim(displayLine || "...")}`);
      };

      try {
        result = await client.analyzeStyles(
          styleSummary,
          styleGuide,
          onProgress
        );
        s.stop(pc.green("✓ ") + "Analyzing with LLM");
      } catch (error) {
        s.stop(pc.red("✗ ") + "Analyzing with LLM");
        throw error;
      }
    }

    // Output results
    if (isJsonOutput) {
      printJSON({
        issues: result.issues,
        analysisTime: result.analysisTime,
        elementCount: snapshot.elementCount,
      });
    } else {
      if (result.issues.length === 0) {
        logSuccess("No issues found!");
        outro(`Scan completed in ${result.analysisTime}ms`);
      } else {
        note(
          formatIssuesClack(result.issues),
          `Found ${result.issues.length} issue(s)`
        );
        outro(`Scan completed in ${result.analysisTime}ms`);
      }
    }

    // Exit with error code if issues found
    if (result.issues.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    if (options.output === "json") {
      printJSON({
        error: error instanceof Error ? error.message : "Unknown error",
        issues: [],
      });
    } else {
      logError(error instanceof Error ? error.message : "Scan failed");
    }
    process.exit(1);
  }
}

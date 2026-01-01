/**
 * Init command - creates a style guide from detected styles
 */

import { dirname, join, resolve } from "path";
import ora from "ora";
import {
  OllamaClient,
  createStyleSummary,
  generateStyleGuideFromStyles,
} from "uilint-core";
import {
  ensureOllamaReady,
  writeStyleGuide,
  styleGuideExists,
  readTailwindThemeTokens,
} from "uilint-core/node";
import { getInput, type InputOptions } from "../utils/input.js";
import { printSuccess, printError, printWarning } from "../utils/output.js";

export interface InitOptions extends InputOptions {
  output?: string;
  model?: string;
  force?: boolean;
  llm?: boolean;
}

export async function init(options: InitOptions): Promise<void> {
  const spinner = ora("Initializing style guide...").start();

  try {
    const projectPath = process.cwd();
    const outputPath =
      options.output || join(projectPath, ".uilint", "styleguide.md");

    // Check if style guide already exists
    if (!options.force && styleGuideExists(projectPath)) {
      spinner.warn("Style guide already exists");
      printWarning(
        'Use --force to overwrite, or "uilint update" to merge new styles.'
      );
      process.exit(1);
    }

    // Get input
    const snapshot = await getInput(options);
    spinner.text = `Detected ${snapshot.elementCount} elements...`;

    const tailwindSearchDir = options.inputFile
      ? dirname(resolve(projectPath, options.inputFile))
      : projectPath;
    const tailwindTheme = readTailwindThemeTokens(tailwindSearchDir);

    let styleGuideContent: string;

    if (options.llm) {
      // Use LLM to generate a more polished style guide
      spinner.text = "Generating style guide with LLM...";
      spinner.stop();
      await ensureOllamaReady({ model: options.model });
      spinner.start();
      spinner.text = "Generating style guide with LLM...";
      const client = new OllamaClient({ model: options.model });

      const styleSummary = createStyleSummary(snapshot.styles, {
        html: snapshot.html,
        tailwindTheme,
      });
      const llmGuide = await client.generateStyleGuide(styleSummary);

      if (!llmGuide) {
        spinner.warn("LLM generation failed, falling back to basic generation");
        styleGuideContent = generateStyleGuideFromStyles(snapshot.styles, {
          html: snapshot.html,
          tailwindTheme,
        });
      } else {
        styleGuideContent = llmGuide;
      }
    } else {
      // Generate basic style guide from extracted styles
      spinner.text = "Generating style guide from detected styles...";
      styleGuideContent = generateStyleGuideFromStyles(snapshot.styles, {
        html: snapshot.html,
        tailwindTheme,
      });
    }

    // Write the style guide
    await writeStyleGuide(outputPath, styleGuideContent);

    spinner.stop();
    printSuccess(`Style guide created at ${outputPath}`);
    console.log("\nNext steps:");
    console.log("  1. Review and edit the generated style guide");
    console.log("  2. Run 'uilint scan' to check for inconsistencies");
  } catch (error) {
    spinner.fail("Initialization failed");
    printError(error instanceof Error ? error.message : "Unknown error");
    process.exit(1);
  }
}

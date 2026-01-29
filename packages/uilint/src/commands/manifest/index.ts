/**
 * Build Manifest Command
 *
 * Generates a static lint manifest for production deployment.
 *
 * Usage:
 *   uilint build-manifest [options]
 *
 * Options:
 *   -o, --output <path>         Output path (default: .uilint/manifest.json)
 *   --include <patterns...>     File patterns to include (default: **\/*.tsx **\/*.jsx)
 *   --exclude <patterns...>     File patterns to exclude
 *   --no-snippets               Exclude source code snippets
 *   --context-lines <n>         Number of context lines for snippets (default: 3)
 *   --pretty                    Pretty-print JSON output
 */

import { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { generateManifest } from "./generator.js";
import { logInfo, logSuccess, logError, logWarning, pc } from "../../utils/prompts.js";

/**
 * Create the build-manifest command
 */
export function createManifestCommand(): Command {
  const cmd = new Command("build-manifest")
    .description("Generate static lint manifest for production deployment")
    .option("-o, --output <path>", "Output path for manifest", ".uilint/manifest.json")
    .option("--include <patterns...>", "File patterns to include")
    .option("--exclude <patterns...>", "File patterns to exclude")
    .option("--no-snippets", "Exclude source code snippets from manifest")
    .option("--context-lines <n>", "Number of context lines for snippets", "3")
    .option("--pretty", "Pretty-print JSON output")
    .option("--quiet", "Suppress progress output")
    .action(async (options) => {
      await buildManifest({
        output: options.output,
        include: options.include,
        exclude: options.exclude,
        includeSnippets: options.snippets !== false,
        contextLines: parseInt(options.contextLines, 10),
        pretty: options.pretty,
        quiet: options.quiet,
      });
    });

  return cmd;
}

interface BuildManifestOptions {
  output: string;
  include?: string[];
  exclude?: string[];
  includeSnippets: boolean;
  contextLines: number;
  pretty?: boolean;
  quiet?: boolean;
}

/**
 * Build manifest action
 */
async function buildManifest(options: BuildManifestOptions): Promise<void> {
  const startTime = Date.now();
  const outputPath = resolve(process.cwd(), options.output);

  if (!options.quiet) {
    logInfo(`Building lint manifest...`);
    logInfo(`Output: ${pc.dim(outputPath)}`);
  }

  try {
    const manifest = await generateManifest({
      cwd: process.cwd(),
      include: options.include,
      exclude: options.exclude,
      includeSnippets: options.includeSnippets,
      snippetContextLines: options.contextLines,
      onProgress: options.quiet
        ? undefined
        : (message, current, total) => {
            if (current !== undefined && total !== undefined) {
              logInfo(`  [${current}/${total}] ${message}`);
            } else {
              logInfo(`  ${message}`);
            }
          },
    });

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Write manifest
    const json = options.pretty
      ? JSON.stringify(manifest, null, 2)
      : JSON.stringify(manifest);

    writeFileSync(outputPath, json, "utf-8");

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const sizeKb = Math.round(Buffer.byteLength(json) / 1024);

    if (!options.quiet) {
      logSuccess(`Manifest generated in ${elapsed}s`);
      logInfo(`  Files scanned: ${pc.bold(String(manifest.summary.filesScanned))}`);
      logInfo(`  Files with issues: ${pc.bold(String(manifest.summary.filesWithIssues))}`);
      logInfo(`  Total issues: ${pc.bold(String(manifest.summary.totalIssues))}`);
      if (manifest.summary.bySeverity.error > 0) {
        logInfo(`    Errors: ${pc.red(String(manifest.summary.bySeverity.error))}`);
      }
      if (manifest.summary.bySeverity.warn > 0) {
        logInfo(`    Warnings: ${pc.yellow(String(manifest.summary.bySeverity.warn))}`);
      }
      logInfo(`  Output size: ${pc.dim(`${sizeKb}kb`)}`);

      if (manifest.commitSha) {
        logInfo(`  Git commit: ${pc.dim(manifest.commitSha.substring(0, 7))}`);
      }
      if (manifest.branch) {
        logInfo(`  Git branch: ${pc.dim(manifest.branch)}`);
      }

      logSuccess(`Wrote ${pc.cyan(options.output)}`);
    }

    // Exit with error code if there are errors
    if (manifest.summary.bySeverity.error > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    logError(`Failed to generate manifest: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// Re-export types and generator
export * from "./types.js";
export { generateManifest } from "./generator.js";

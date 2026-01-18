/**
 * Similar command - find code similar to a specific location
 */

import { Command } from "commander";
import { relative, resolve, isAbsolute } from "path";
import chalk from "chalk";

export function similarCommand(): Command {
  return new Command("similar")
    .description("Find code similar to a specific location")
    .argument("<location>", "File location in format file:line (e.g., src/Button.tsx:15)")
    .option("-k, --top <n>", "Number of results (default: 10)", parseInt)
    .option("--threshold <n>", "Minimum similarity (default: 0.7)", parseFloat)
    .option("-o, --output <format>", "Output format: text or json", "text")
    .action(async (location: string, options) => {
      const { findSimilarAtLocation } = await import("uilint-duplicates");

      const projectRoot = process.cwd();
      const isJson = options.output === "json";

      // Parse location
      const colonIdx = location.lastIndexOf(":");
      if (colonIdx === -1) {
        const message = "Invalid location format. Use file:line (e.g., src/Button.tsx:15)";
        if (isJson) {
          console.log(JSON.stringify({ error: message }, null, 2));
        } else {
          console.error(chalk.red(`Error: ${message}`));
        }
        process.exit(1);
      }

      const filePart = location.slice(0, colonIdx);
      const linePart = location.slice(colonIdx + 1);
      const line = parseInt(linePart, 10);

      if (isNaN(line)) {
        const message = `Invalid line number: ${linePart}`;
        if (isJson) {
          console.log(JSON.stringify({ error: message }, null, 2));
        } else {
          console.error(chalk.red(`Error: ${message}`));
        }
        process.exit(1);
      }

      const filePath = isAbsolute(filePart)
        ? filePart
        : resolve(projectRoot, filePart);

      try {
        const results = await findSimilarAtLocation({
          path: projectRoot,
          filePath,
          line,
          top: options.top,
          threshold: options.threshold ?? 0.7,
        });

        if (isJson) {
          console.log(JSON.stringify({ results }, null, 2));
          return;
        }

        if (results.length === 0) {
          console.log(chalk.yellow("No similar code found."));
          return;
        }

        console.log(
          chalk.bold(
            `Found ${results.length} similar code locations to ${relative(projectRoot, filePath)}:${line}:\n`
          )
        );

        results.forEach((result, idx) => {
          const relPath = relative(projectRoot, result.filePath);
          const locationStr = `${relPath}:${result.startLine}-${result.endLine}`;
          const name = result.name || "(anonymous)";
          const score = Math.round(result.score * 100);
          const kindLabel = result.kind.padEnd(10);

          console.log(
            `${chalk.dim(`${idx + 1}.`)} ${chalk.cyan(locationStr)}`
          );
          console.log(
            `   ${chalk.dim(kindLabel)} ${chalk.bold(name)} ${chalk.green(`(${score}% similar)`)}`
          );
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        if (isJson) {
          console.log(JSON.stringify({ error: message }, null, 2));
        } else {
          console.error(chalk.red(`Error: ${message}`));
        }
        process.exit(1);
      }
    });
}

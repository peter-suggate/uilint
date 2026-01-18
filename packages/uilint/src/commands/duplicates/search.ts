/**
 * Search command - semantic search for code
 */

import { Command } from "commander";
import { relative } from "path";
import chalk from "chalk";

export function searchCommand(): Command {
  return new Command("search")
    .description("Semantic search for similar code")
    .argument("<query>", "Search query (natural language)")
    .option("-k, --top <n>", "Number of results (default: 10)", parseInt)
    .option("--threshold <n>", "Minimum similarity (default: 0.5)", parseFloat)
    .option("-o, --output <format>", "Output format: text or json", "text")
    .action(async (query: string, options) => {
      const { searchSimilar } = await import("uilint-duplicates");

      const projectRoot = process.cwd();
      const isJson = options.output === "json";

      try {
        const results = await searchSimilar(query, {
          path: projectRoot,
          top: options.top,
          threshold: options.threshold,
        });

        if (isJson) {
          console.log(JSON.stringify({ results }, null, 2));
          return;
        }

        if (results.length === 0) {
          console.log(chalk.yellow("No matching code found."));
          return;
        }

        console.log(chalk.bold(`Found ${results.length} matching results:\n`));

        results.forEach((result, idx) => {
          const relPath = relative(projectRoot, result.filePath);
          const location = `${relPath}:${result.startLine}-${result.endLine}`;
          const name = result.name || "(anonymous)";
          const score = Math.round(result.score * 100);
          const kindLabel = result.kind.padEnd(10);

          console.log(
            `${chalk.dim(`${idx + 1}.`)} ${chalk.cyan(location)}`
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

/**
 * Index command - build or update the semantic duplicates index
 */

import { Command } from "commander";
import { resolve } from "path";
import chalk from "chalk";
import ora from "ora";

export function indexCommand(): Command {
  return new Command("index")
    .description("Build or update the semantic duplicates index")
    .option("--force", "Rebuild index from scratch")
    .option("--model <name>", "Embedding model (default: nomic-embed-text)")
    .option(
      "--exclude <glob>",
      "Exclude patterns (repeatable)",
      (val: string, prev: string[]) => [...prev, val],
      [] as string[]
    )
    .option("-o, --output <format>", "Output format: text or json", "text")
    .action(async (options) => {
      const { indexDirectory } = await import("uilint-duplicates");

      const projectRoot = process.cwd();
      const isJson = options.output === "json";

      let spinner: ReturnType<typeof ora> | undefined;
      if (!isJson) {
        spinner = ora("Initializing indexer...").start();
      }

      try {
        const result = await indexDirectory(projectRoot, {
          force: options.force,
          model: options.model,
          exclude: options.exclude,
          onProgress: (message, current, total) => {
            if (spinner) {
              if (current && total) {
                spinner.text = `${message} (${current}/${total})`;
              } else {
                spinner.text = message;
              }
            }
          },
        });

        if (isJson) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          spinner?.succeed(chalk.green("Index complete"));
          console.log();
          console.log(chalk.bold("Index Statistics:"));
          console.log(`  Files added:    ${result.added}`);
          console.log(`  Files modified: ${result.modified}`);
          console.log(`  Files deleted:  ${result.deleted}`);
          console.log(`  Total chunks:   ${result.totalChunks}`);
          console.log(`  Duration:       ${(result.duration / 1000).toFixed(2)}s`);
        }
      } catch (error) {
        if (spinner) {
          spinner.fail(chalk.red("Index failed"));
        }
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

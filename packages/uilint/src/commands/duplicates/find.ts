/**
 * Find command - find semantic duplicate groups
 */

import { Command } from "commander";
import { relative } from "path";
import chalk from "chalk";
import type { ChunkKind } from "uilint-duplicates";

export function findCommand(): Command {
  return new Command("find")
    .description("Find semantic duplicate groups in the codebase")
    .option(
      "--threshold <n>",
      "Similarity threshold 0-1 (default: 0.85)",
      parseFloat
    )
    .option("--min-size <n>", "Minimum group size (default: 2)", parseInt)
    .option("--kind <type>", "Filter: component, hook, function")
    .option("-o, --output <format>", "Output format: text or json", "text")
    .action(async (options) => {
      const { findDuplicates } = await import("uilint-duplicates");

      const projectRoot = process.cwd();
      const isJson = options.output === "json";

      try {
        const groups = await findDuplicates({
          path: projectRoot,
          threshold: options.threshold,
          minGroupSize: options.minSize,
          kind: options.kind as ChunkKind | undefined,
        });

        if (isJson) {
          console.log(JSON.stringify({ groups }, null, 2));
          return;
        }

        if (groups.length === 0) {
          console.log(chalk.green("No semantic duplicates found."));
          return;
        }

        console.log(
          chalk.bold(
            `Found ${groups.length} duplicate group${groups.length > 1 ? "s" : ""}:\n`
          )
        );

        groups.forEach((group, idx) => {
          const similarity = Math.round(group.avgSimilarity * 100);
          console.log(
            chalk.yellow(
              `Duplicate Group ${idx + 1} (${similarity}% similar, ${group.members.length} occurrences):`
            )
          );

          group.members.forEach((member) => {
            const relPath = relative(projectRoot, member.filePath);
            const location = `${relPath}:${member.startLine}-${member.endLine}`;
            const name = member.name || "(anonymous)";
            const score =
              member.score === 1.0
                ? ""
                : chalk.dim(` (${Math.round(member.score * 100)}%)`);
            console.log(`  ${chalk.cyan(location.padEnd(50))} ${name}${score}`);
          });

          console.log(
            chalk.dim(
              `  Suggestion: Consider extracting shared logic into a reusable ${group.kind}\n`
            )
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

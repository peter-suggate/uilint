/**
 * Output formatting utilities for CLI
 */

import chalk from "chalk";
import {
  formatViolationsText,
  sanitizeIssues,
  type UILintIssue,
} from "uilint-core";

/**
 * Formats UILint issues for console output
 */
export function formatIssues(issues: UILintIssue[]): string {
  const sanitized = sanitizeIssues(issues);
  const text = formatViolationsText(sanitized, {
    includeFooter: sanitized.length > 0,
  });
  // Preserve existing callers expecting a string; apply minimal coloring only.
  return sanitized.length === 0 ? chalk.green(text) : text;
}

/**
 * Prints JSON output
 */
export function printJSON(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/**
 * Prints an error message
 */
export function printError(message: string): void {
  console.error(chalk.red(`Error: ${message}`));
}

/**
 * Prints a success message
 */
export function printSuccess(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

/**
 * Prints a warning message
 */
export function printWarning(message: string): void {
  console.log(chalk.yellow(`⚠️ ${message}`));
}

/**
 * Prints an info message
 */
export function printInfo(message: string): void {
  console.log(chalk.blue(`ℹ ${message}`));
}

/**
 * Prints a debug/path message (dimmed)
 */
export function printPath(label: string, path: string): void {
  console.log(chalk.gray(`  ${label}: ${chalk.dim(path)}`));
}

/**
 * Prints a styled box for important messages
 */
export function printBox(
  title: string,
  lines: string[],
  style: "warning" | "error" | "info" = "info"
): void {
  const colors = {
    warning: { border: chalk.yellow, title: chalk.yellow.bold, icon: "⚠" },
    error: { border: chalk.red, title: chalk.red.bold, icon: "✖" },
    info: { border: chalk.blue, title: chalk.blue.bold, icon: "ℹ" },
  };
  const { border, title: titleColor, icon } = colors[style];

  const maxLen = Math.max(title.length, ...lines.map((l) => l.length)) + 4;
  const horizontal = "─".repeat(maxLen);

  console.log();
  console.log(border(`╭${horizontal}╮`));
  console.log(border(`│ ${icon} ${titleColor(title.padEnd(maxLen - 3))}│`));
  console.log(border(`├${horizontal}┤`));
  lines.forEach((line) => {
    console.log(border(`│ ${chalk.gray(line.padEnd(maxLen - 1))}│`));
  });
  console.log(border(`╰${horizontal}╯`));
  console.log();
}

/**
 * Prints styleguide status information
 */
export function printStyleguideNotFound(
  searchedPaths: string[],
  projectPath: string
): void {
  printBox(
    "No styleguide found",
    [
      `Searched in: ${projectPath}`,
      "",
      "Looked for:",
      ...searchedPaths.map((p) => `  • ${p}`),
      "",
      "To create one, run:",
      `  ${chalk.cyan("/genstyleguide")} ${chalk.gray("(Cursor)")}`,
    ],
    "warning"
  );
}

/**
 * Prints styleguide found confirmation
 */
export function printStyleguideFound(path: string): void {
  console.log(chalk.green(`📋 Using styleguide: ${chalk.dim(path)}`));
}

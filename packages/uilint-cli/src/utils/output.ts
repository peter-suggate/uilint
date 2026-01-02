/**
 * Output formatting utilities for CLI
 */

import chalk from "chalk";
import type { UILintIssue } from "uilint-core";

/**
 * Formats UILint issues for console output
 */
export function formatIssues(issues: UILintIssue[]): string {
  if (issues.length === 0) {
    return chalk.green("✓ No UI consistency issues found");
  }

  const lines: string[] = [];
  lines.push(chalk.yellow(`Found ${issues.length} issue(s):\n`));

  issues.forEach((issue, index) => {
    const icon = getTypeIcon(issue.type);
    lines.push(chalk.white(`${index + 1}. ${icon} ${issue.message}`));

    if (issue.currentValue && issue.expectedValue) {
      lines.push(
        chalk.gray(
          `   Current: ${issue.currentValue} → Expected: ${issue.expectedValue}`
        )
      );
    } else if (issue.currentValue) {
      lines.push(chalk.gray(`   Value: ${issue.currentValue}`));
    }

    if (issue.suggestion) {
      lines.push(chalk.cyan(`   💡 ${issue.suggestion}`));
    }
    lines.push("");
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

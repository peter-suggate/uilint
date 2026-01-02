import type { UILintIssue } from "../types.js";

export interface FormatViolationsOptions {
  /**
   * Optional context label (e.g., filename) to include as a single header line.
   * Keep this empty for the most minimal output.
   */
  context?: string;
  /**
   * Include the trailing "consult the style guide" message.
   * Defaults to true.
   */
  includeFooter?: boolean;
  /**
   * Override the footer message.
   */
  footerMessage?: string;
}

const DEFAULT_FOOTER = "Consult the style guide for guidance.";

/**
 * Ensures issues are safe/minimal to print or serialize:
 * - drops `suggestion` (we only want violations)
 * - trims string fields
 */
export function sanitizeIssues(issues: UILintIssue[]): UILintIssue[] {
  return issues.map((issue) => ({
    id: String(issue.id ?? "").trim(),
    type: issue.type,
    message: String(issue.message ?? "").trim(),
    element: issue.element ? String(issue.element).trim() : undefined,
    selector: issue.selector ? String(issue.selector).trim() : undefined,
    currentValue: issue.currentValue ? String(issue.currentValue).trim() : undefined,
    expectedValue: issue.expectedValue
      ? String(issue.expectedValue).trim()
      : undefined,
    // Intentionally omit `suggestion`
  }));
}

/**
 * Minimal human-readable rendering of violations.
 * Intended for CLI/MCP text output.
 */
export function formatViolationsText(
  issues: UILintIssue[],
  options: FormatViolationsOptions = {}
): string {
  const { context, includeFooter = true, footerMessage = DEFAULT_FOOTER } =
    options;

  if (!issues || issues.length === 0) {
    return "No violations found.";
  }

  const lines: string[] = [];

  if (context && context.trim()) {
    lines.push(`Violations in ${context.trim()}:`);
    lines.push("");
  }

  const sanitized = sanitizeIssues(issues);
  sanitized.forEach((issue, i) => {
    lines.push(`${i + 1}. [${issue.type}] ${issue.message}`);
    if (issue.currentValue && issue.expectedValue) {
      lines.push(`   ${issue.currentValue} → ${issue.expectedValue}`);
    } else if (issue.currentValue) {
      lines.push(`   ${issue.currentValue}`);
    }
    lines.push("");
  });

  // remove trailing blank line
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  if (includeFooter) {
    lines.push("");
    lines.push(footerMessage);
  }

  return lines.join("\n");
}

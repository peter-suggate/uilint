/**
 * Unified Issue type for UILint UI
 * Replaces: ESLintIssue, ElementIssue, VisionIssue, PluginIssue
 */

/** Issue severity levels */
export type IssueSeverity = "error" | "warning" | "info";

/** Issue scan status for a dataLoc */
export type IssueStatus = "pending" | "scanning" | "complete" | "error";

/**
 * Unified Issue type - single representation used everywhere
 */
export interface Issue {
  /** Unique ID: `${pluginId}:${ruleId}:${dataLoc}:${line}` */
  id: string;
  /** Issue message */
  message: string;
  /** Severity level */
  severity: IssueSeverity;
  /** Source location key (format: "path:line:column") */
  dataLoc: string;
  /** Rule ID that generated this issue */
  ruleId: string;
  /** Plugin that provided this issue */
  pluginId: string;
  /** Source file path */
  filePath: string;
  /** Line number (1-indexed) */
  line: number;
  /** Column number (1-indexed, optional) */
  column?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/** Raw ESLint issue from WebSocket */
export interface RawESLintIssue {
  line: number;
  column?: number;
  message: string;
  ruleId?: string;
  dataLoc?: string;
  severity?: 1 | 2;
}

/**
 * Parse dataLoc string into components
 * Format: "path:line:column" or "path:line"
 */
export function parseDataLoc(dataLoc: string): {
  filePath: string;
  line: number;
  column: number;
} {
  const parts = dataLoc.split(":");
  const column = parseInt(parts.pop() || "0", 10);
  const line = parseInt(parts.pop() || "0", 10);
  const filePath = parts.join(":");
  return { filePath, line, column };
}

/**
 * Create unique issue ID
 */
export function createIssueId(
  pluginId: string,
  ruleId: string,
  dataLoc: string,
  line: number
): string {
  return `${pluginId}:${ruleId}:${dataLoc}:${line}`;
}

/**
 * Convert severity number to string
 */
export function severityFromNumber(num: 1 | 2 | number): IssueSeverity {
  return num === 2 ? "error" : "warning";
}

/**
 * Get CSS color for severity
 */
export function severityToColor(severity: IssueSeverity): string {
  switch (severity) {
    case "error":
      return "#ef4444"; // red-500
    case "warning":
      return "#f59e0b"; // amber-500
    case "info":
      return "#3b82f6"; // blue-500
  }
}

/**
 * Convert raw ESLint issue to unified Issue
 * Returns null if issue is invalid
 */
export function fromESLintIssue(
  raw: RawESLintIssue,
  pluginId: string = "eslint"
): Issue | null {
  if (!raw.message || !raw.line) return null;

  const dataLoc = raw.dataLoc || "";
  const { filePath } = dataLoc ? parseDataLoc(dataLoc) : { filePath: "" };
  const ruleId = raw.ruleId || "unknown";
  const severity = raw.severity ? severityFromNumber(raw.severity) : "warning";

  return {
    id: createIssueId(pluginId, ruleId, dataLoc, raw.line),
    message: raw.message,
    severity,
    dataLoc,
    ruleId,
    pluginId,
    filePath,
    line: raw.line,
    column: raw.column,
  };
}

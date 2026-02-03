/**
 * File Groups Selector
 *
 * Core selector for the unified inspector view.
 * Groups issues by file for display in the inspector.
 * This is the single source of truth for what the inspector displays.
 *
 * Note: Filtering is no longer used. All issues are always shown.
 * Selection/expansion state determines visual emphasis (additive model).
 */

import type { ComposedState } from "./composed-store";
import type { Issue, IssueSeverity } from "../../ui/types";

// ============================================================================
// Types
// ============================================================================

/**
 * Issues grouped by rule within a file.
 */
export interface RuleGroup {
  /** Rule ID (e.g., "no-unused-vars") */
  ruleId: string;
  /** Human-readable rule name */
  ruleName: string;
  /** Number of issues for this rule in this file */
  count: number;
  /** Highest severity among issues in this group */
  highestSeverity: IssueSeverity;
}

/**
 * A file with its issues grouped by rule.
 */
export interface FileGroup {
  /** Full file path */
  filePath: string;
  /** File name only (e.g., "App.tsx") */
  fileName: string;
  /** Directory path (e.g., "src/components") */
  directory: string;
  /** Total number of issues in this file */
  totalCount: number;
  /** Severity counts for this file */
  severityCounts: { error: number; warning: number; info: number };
  /** Highest severity among all issues in this file */
  highestSeverity: IssueSeverity;
  /** Issues grouped by rule */
  ruleGroups: RuleGroup[];
  /** All issues in this file (flat, for expansion) */
  issues: Issue[];
}

/**
 * Summary statistics for the current filter state.
 */
export interface FileGroupsSummary {
  /** Total issues across all files */
  totalIssues: number;
  /** Number of files with issues */
  totalFiles: number;
  /** Number of unique rules with issues */
  totalRules: number;
  /** Overall severity counts */
  severityCounts: { error: number; warning: number; info: number };
}

// ============================================================================
// Stable Empty Values (prevent unnecessary re-renders)
// ============================================================================

const EMPTY_FILE_GROUPS: FileGroup[] = [];
const EMPTY_SUMMARY: FileGroupsSummary = {
  totalIssues: 0,
  totalFiles: 0,
  totalRules: 0,
  severityCounts: { error: 0, warning: 0, info: 0 },
};

// ============================================================================
// Memoization Cache
// ============================================================================

let cachedIssuesMap: Map<string, Issue[]> | null = null;
let cachedFileGroups: FileGroup[] = EMPTY_FILE_GROUPS;
let cachedSummary: FileGroupsSummary = EMPTY_SUMMARY;

/**
 * Clear the file groups cache. Call this when the store is reset.
 */
export function clearFileGroupsCache(): void {
  cachedIssuesMap = null;
  cachedFileGroups = EMPTY_FILE_GROUPS;
  cachedSummary = EMPTY_SUMMARY;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Determine the highest severity from a list of issues.
 */
function getHighestSeverity(issues: Issue[]): IssueSeverity {
  let highest: IssueSeverity = "info";
  for (const issue of issues) {
    if (issue.severity === "error") return "error";
    if (issue.severity === "warning") highest = "warning";
  }
  return highest;
}

/**
 * Count issues by severity.
 */
function countSeverities(issues: Issue[]): { error: number; warning: number; info: number } {
  const counts = { error: 0, warning: 0, info: 0 };
  for (const issue of issues) {
    counts[issue.severity]++;
  }
  return counts;
}

/**
 * Extract file name from path.
 */
function getFileName(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}

/**
 * Extract directory from path.
 */
function getDirectory(filePath: string): string {
  const parts = filePath.split("/");
  parts.pop();
  return parts.join("/") || "/";
}

/**
 * Get a short rule name from a potentially namespaced rule ID.
 */
function getShortRuleName(ruleId: string): string {
  // Handle namespaced rules like "@typescript-eslint/no-unused-vars"
  if (ruleId.includes("/")) {
    return ruleId.split("/").pop() || ruleId;
  }
  return ruleId;
}

/**
 * Sort severity for comparison (error > warning > info).
 */
function severityOrder(severity: IssueSeverity): number {
  switch (severity) {
    case "error": return 0;
    case "warning": return 1;
    case "info": return 2;
  }
}

// ============================================================================
// Core Selector Logic
// ============================================================================

/**
 * Build file groups from issues.
 * Returns all issues grouped by file (no filtering).
 */
function buildFileGroups(
  issuesMap: Map<string, Issue[]>
): { fileGroups: FileGroup[]; summary: FileGroupsSummary } {
  // Collect all issues by file path
  const issuesByFile = new Map<string, Issue[]>();
  const allRuleIds = new Set<string>();

  for (const issues of issuesMap.values()) {
    for (const issue of issues) {
      const existing = issuesByFile.get(issue.filePath) || [];
      existing.push(issue);
      issuesByFile.set(issue.filePath, existing);
      allRuleIds.add(issue.ruleId);
    }
  }

  // Build file groups
  const fileGroups: FileGroup[] = [];
  let totalIssues = 0;
  const overallSeverityCounts = { error: 0, warning: 0, info: 0 };

  for (const [filePath, issues] of issuesByFile) {
    // Sort issues by line number
    const sortedIssues = [...issues].sort((a, b) => a.line - b.line);

    // Group by rule
    const issuesByRule = new Map<string, Issue[]>();
    for (const issue of sortedIssues) {
      const existing = issuesByRule.get(issue.ruleId) || [];
      existing.push(issue);
      issuesByRule.set(issue.ruleId, existing);
    }

    // Build rule groups
    const ruleGroups: RuleGroup[] = [];
    for (const [ruleId, ruleIssues] of issuesByRule) {
      ruleGroups.push({
        ruleId,
        ruleName: getShortRuleName(ruleId),
        count: ruleIssues.length,
        highestSeverity: getHighestSeverity(ruleIssues),
      });
    }

    // Sort rule groups by severity (errors first), then by count
    ruleGroups.sort((a, b) => {
      const severityDiff = severityOrder(a.highestSeverity) - severityOrder(b.highestSeverity);
      if (severityDiff !== 0) return severityDiff;
      return b.count - a.count;
    });

    const severityCounts = countSeverities(sortedIssues);
    totalIssues += sortedIssues.length;
    overallSeverityCounts.error += severityCounts.error;
    overallSeverityCounts.warning += severityCounts.warning;
    overallSeverityCounts.info += severityCounts.info;

    fileGroups.push({
      filePath,
      fileName: getFileName(filePath),
      directory: getDirectory(filePath),
      totalCount: sortedIssues.length,
      severityCounts,
      highestSeverity: getHighestSeverity(sortedIssues),
      ruleGroups,
      issues: sortedIssues,
    });
  }

  // Sort file groups by severity (errors first), then by count
  fileGroups.sort((a, b) => {
    const severityDiff = severityOrder(a.highestSeverity) - severityOrder(b.highestSeverity);
    if (severityDiff !== 0) return severityDiff;
    return b.totalCount - a.totalCount;
  });

  const summary: FileGroupsSummary = {
    totalIssues,
    totalFiles: fileGroups.length,
    totalRules: allRuleIds.size,
    severityCounts: overallSeverityCounts,
  };

  return { fileGroups, summary };
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select all file groups (no filtering).
 * This is the main selector for the inspector view.
 *
 * Results are memoized to ensure stable references.
 *
 * @param state - The composed store state
 * @returns Array of FileGroup objects
 */
export function selectFileGroups(state: ComposedState): FileGroup[] {
  const issuesMap = state.plugins?.eslint?.issues;

  // Return cached result if inputs haven't changed
  if (issuesMap === cachedIssuesMap) {
    return cachedFileGroups;
  }

  // Update cache references
  cachedIssuesMap = issuesMap ?? null;

  // No issues = empty result
  if (!issuesMap || issuesMap.size === 0) {
    cachedFileGroups = EMPTY_FILE_GROUPS;
    cachedSummary = EMPTY_SUMMARY;
    return cachedFileGroups;
  }

  // Build file groups
  const { fileGroups, summary } = buildFileGroups(issuesMap);

  cachedFileGroups = fileGroups.length > 0 ? fileGroups : EMPTY_FILE_GROUPS;
  cachedSummary = summary;

  return cachedFileGroups;
}

/**
 * @deprecated Use selectFileGroups instead. Filtering has been removed.
 */
export const selectFilteredFileGroups = selectFileGroups;

/**
 * Select summary statistics for all issues.
 * Must be called after selectFileGroups for accurate results.
 *
 * @param state - The composed store state
 * @returns Summary statistics
 */
export function selectFileGroupsSummary(state: ComposedState): FileGroupsSummary {
  // Ensure cache is up to date
  selectFileGroups(state);
  return cachedSummary;
}

/**
 * Select the expanded rule ID (for additive selection model).
 * Replaces the old filter-based approach.
 *
 * @param state - The composed store state
 * @returns The expanded rule ID or null
 */
export function selectExpandedRuleId(state: ComposedState): string | null {
  return state.inspector.expandedRuleId;
}

/**
 * Select the expanded file path (for additive selection model).
 * Replaces the old filter-based approach.
 *
 * @param state - The composed store state
 * @returns The expanded file path or null
 */
export function selectExpandedFilePath(state: ComposedState): string | null {
  return state.inspector.expandedFilePath;
}

/**
 * Check if there are any issues to display.
 *
 * @param state - The composed store state
 * @returns true if there are any issues
 */
export function selectHasIssues(state: ComposedState): boolean {
  const fileGroups = selectFileGroups(state);
  return fileGroups.length > 0;
}

/**
 * @deprecated Use selectHasIssues instead. Filtering has been removed.
 */
export const selectHasFilteredIssues = selectHasIssues;

/**
 * ESLint Tile Provider
 *
 * Helper functions for generating tile data for the masonry grid view.
 * Provides aggregation by rule and by file, with severity breakdowns.
 */

import type {
  TileItem,
  TileFilter,
  TileSeverityCounts,
  PluginServices,
} from "../../core/plugin-system/types";
import type { Issue } from "../../ui/types";
import type { ESLintPluginSlice } from "./slice";
import type { AvailableRule } from "./types";

/**
 * Count issues by severity level.
 *
 * @param issues - Array of issues to count
 * @returns Object with error, warning, and info counts
 */
export function countSeverities(issues: Issue[]): TileSeverityCounts {
  const counts: TileSeverityCounts = {
    error: 0,
    warning: 0,
    info: 0,
  };

  for (const issue of issues) {
    if (issue.severity === "error") {
      counts.error++;
    } else if (issue.severity === "warning") {
      counts.warning++;
    } else if (issue.severity === "info") {
      counts.info++;
    }
  }

  return counts;
}

/**
 * Aggregate issues by rule.
 * Returns tiles for each rule with issue counts and severity breakdowns.
 *
 * @param issues - Flat array of all issues
 * @param availableRules - Available rule metadata for descriptions
 * @returns Array of TileItem objects, one per rule
 */
export function aggregateByRule(
  issues: Issue[],
  availableRules: AvailableRule[] = []
): TileItem[] {
  // Group issues by ruleId
  const issuesByRule = new Map<string, Issue[]>();

  for (const issue of issues) {
    const ruleId = issue.ruleId;
    const existing = issuesByRule.get(ruleId) || [];
    issuesByRule.set(ruleId, [...existing, issue]);
  }

  // Create a lookup map for rule metadata
  const ruleMetadata = new Map<string, AvailableRule>();
  for (const rule of availableRules) {
    ruleMetadata.set(rule.id, rule);
  }

  // Convert to tiles
  const tiles: TileItem[] = [];

  for (const [ruleId, ruleIssues] of issuesByRule) {
    const meta = ruleMetadata.get(ruleId);
    const severityCounts = countSeverities(ruleIssues);

    // Extract short rule name (e.g., "no-unused-vars" from "@typescript-eslint/no-unused-vars")
    const shortName = ruleId.includes("/") ? ruleId.split("/").pop()! : ruleId;

    tiles.push({
      id: `rule:${ruleId}`,
      label: meta?.name || shortName,
      subtitle: meta?.description || ruleId,
      count: ruleIssues.length,
      severityCounts,
      metadata: {
        isRule: true,
        ruleId,
      },
    });
  }

  // Sort by count (descending), then by errors (descending)
  tiles.sort((a, b) => {
    // First by error count
    const aErrors = a.severityCounts?.error ?? 0;
    const bErrors = b.severityCounts?.error ?? 0;
    if (aErrors !== bErrors) return bErrors - aErrors;

    // Then by total count
    return b.count - a.count;
  });

  return tiles;
}

/**
 * Aggregate issues by file for a specific rule.
 * Returns tiles for each file that has issues for the given rule.
 *
 * @param issues - Flat array of all issues
 * @param ruleId - Rule ID to filter by
 * @returns Array of TileItem objects, one per file
 */
export function aggregateByFile(issues: Issue[], ruleId: string): TileItem[] {
  // Filter issues to only those for the specified rule
  const ruleIssues = issues.filter((issue) => issue.ruleId === ruleId);

  // Group by file path
  const issuesByFile = new Map<string, Issue[]>();

  for (const issue of ruleIssues) {
    const filePath = issue.filePath;
    const existing = issuesByFile.get(filePath) || [];
    issuesByFile.set(filePath, [...existing, issue]);
  }

  // Convert to tiles
  const tiles: TileItem[] = [];

  for (const [filePath, fileIssues] of issuesByFile) {
    const severityCounts = countSeverities(fileIssues);

    // Extract filename and directory for display
    const parts = filePath.split("/");
    const fileName = parts.pop() || filePath;
    const directory = parts.join("/") || "/";

    tiles.push({
      id: `file:${filePath}:${ruleId}`,
      label: fileName,
      subtitle: directory,
      count: fileIssues.length,
      severityCounts,
      metadata: {
        isFile: true,
        filePath,
        ruleId,
      },
    });
  }

  // Sort by count (descending), then by errors (descending)
  tiles.sort((a, b) => {
    const aErrors = a.severityCounts?.error ?? 0;
    const bErrors = b.severityCounts?.error ?? 0;
    if (aErrors !== bErrors) return bErrors - aErrors;

    return b.count - a.count;
  });

  return tiles;
}

/**
 * Get all issues from the ESLint plugin state as a flat array.
 *
 * @param services - Plugin services for state access
 * @returns Flat array of all issues
 */
export function getAllIssues(services: PluginServices): Issue[] {
  const fullState = services.getState<{ plugins?: { eslint?: ESLintPluginSlice } }>();
  const state = fullState?.plugins?.eslint;

  if (!state?.issues) {
    return [];
  }

  // Flatten the Map<dataLoc, Issue[]> to Issue[]
  const allIssues: Issue[] = [];
  for (const issues of state.issues.values()) {
    allIssues.push(...issues);
  }

  return allIssues;
}

/**
 * Get available rules from the ESLint plugin state.
 *
 * @param services - Plugin services for state access
 * @returns Array of available rules
 */
export function getAvailableRules(services: PluginServices): AvailableRule[] {
  const fullState = services.getState<{ plugins?: { eslint?: ESLintPluginSlice } }>();
  const state = fullState?.plugins?.eslint;

  return state?.availableRules ?? [];
}

/**
 * Get tile items based on current filter state.
 *
 * - No filters: Return rules as tiles (aggregateByRule)
 * - Has rule filter: Return files for that rule as tiles (aggregateByFile)
 * - Has rule + file filter: Return empty (terminal state)
 *
 * @param services - Plugin services for state access
 * @param filters - Currently active tile filters
 * @returns Array of tile items
 */
export function getTileItems(
  services: PluginServices,
  filters: TileFilter[]
): TileItem[] {
  const allIssues = getAllIssues(services);

  if (allIssues.length === 0) {
    return [];
  }

  // Find rule and file filters
  const ruleFilter = filters.find((f) => f.type === "rule");
  const fileFilter = filters.find((f) => f.type === "file");

  // Terminal state: has both rule and file filter
  if (ruleFilter && fileFilter) {
    return [];
  }

  // Has rule filter: show files for that rule
  if (ruleFilter) {
    return aggregateByFile(allIssues, ruleFilter.id);
  }

  // No filters: show rules
  const availableRules = getAvailableRules(services);
  return aggregateByRule(allIssues, availableRules);
}

/**
 * Create a filter from a clicked tile.
 *
 * @param item - The clicked tile item
 * @returns TileFilter object
 */
export function createFilter(item: TileItem): TileFilter {
  const metadata = item.metadata ?? {};

  if (metadata.isRule) {
    const ruleId = metadata.ruleId as string;
    return {
      type: "rule",
      id: ruleId,
      label: item.label,
      providerId: "eslint",
    };
  }

  if (metadata.isFile) {
    const filePath = metadata.filePath as string;
    // Use just the filename for the label
    const fileName = filePath.split("/").pop() || filePath;
    return {
      type: "file",
      id: filePath,
      label: fileName,
      providerId: "eslint",
    };
  }

  // Fallback for unknown tile types
  return {
    type: "scope",
    id: item.id,
    label: item.label,
    providerId: "eslint",
  };
}

/**
 * Check if current filter state is terminal (no more drill-down).
 * Returns true if filters include both a rule AND a file.
 *
 * @param filters - Currently active filters
 * @returns True if terminal state
 */
export function isTerminal(filters: TileFilter[]): boolean {
  const hasRule = filters.some((f) => f.type === "rule");
  const hasFile = filters.some((f) => f.type === "file");

  return hasRule && hasFile;
}

/**
 * Get inspector data for a terminal tile click.
 * Returns the panel ID and data needed to open the inspector.
 *
 * @param item - The clicked tile item
 * @returns Object with panelId and data
 */
export function getInspectorData(item: TileItem): {
  panelId: string;
  data: Record<string, unknown>;
} {
  const metadata = item.metadata ?? {};

  if (metadata.isRule) {
    return {
      panelId: "eslint-rule",
      data: {
        ruleId: metadata.ruleId,
      },
    };
  }

  if (metadata.isFile) {
    return {
      panelId: "eslint-rule",
      data: {
        ruleId: metadata.ruleId,
        filePath: metadata.filePath,
      },
    };
  }

  if (metadata.isIssue) {
    return {
      panelId: "eslint-rule",
      data: {
        ruleId: metadata.ruleId,
        filePath: metadata.filePath,
        issueId: metadata.issueId,
        line: metadata.line,
      },
    };
  }

  // Fallback
  return {
    panelId: "eslint-rule",
    data: {},
  };
}

// ============================================================================
// Expandable Tile Support
// ============================================================================

/**
 * Create issue tiles for a specific file.
 * Used when expanding a file tile to show individual issues.
 *
 * @param issues - All issues
 * @param filePath - File path to filter by
 * @param ruleId - Optional rule ID to filter by
 * @returns Array of TileItem objects, one per issue
 */
export function aggregateIssuesForFile(
  issues: Issue[],
  filePath: string,
  ruleId?: string
): TileItem[] {
  // Filter issues for this file (and optionally this rule)
  let fileIssues = issues.filter((issue) => issue.filePath === filePath);
  if (ruleId) {
    fileIssues = fileIssues.filter((issue) => issue.ruleId === ruleId);
  }

  // Sort by line number
  fileIssues.sort((a, b) => a.line - b.line);

  // Convert to tiles
  return fileIssues.map((issue) => ({
    id: `issue:${issue.id}`,
    label: issue.message,
    subtitle: `Line ${issue.line}${issue.column ? `:${issue.column}` : ""}`,
    count: 1, // Each issue counts as 1
    severityCounts: {
      error: issue.severity === "error" ? 1 : 0,
      warning: issue.severity === "warning" ? 1 : 0,
      info: issue.severity === "info" ? 1 : 0,
    },
    metadata: {
      isIssue: true,
      issueId: issue.id,
      ruleId: issue.ruleId,
      filePath: issue.filePath,
      line: issue.line,
      column: issue.column,
      severity: issue.severity,
      issue, // Full issue object for detailed display
    },
  }));
}

/**
 * Get child items for an expanded tile (for expandable tile UI).
 *
 * - Rule tile -> returns file tiles for that rule
 * - File tile -> returns issue tiles for that file (and rule if specified)
 * - Issue tile -> returns undefined (terminal, no children)
 *
 * @param item - The expanded tile item
 * @param services - Plugin services for state access
 * @returns Array of child tile items, or undefined if not expandable
 */
export function getChildItems(
  item: TileItem,
  services: PluginServices
): TileItem[] | undefined {
  const metadata = item.metadata ?? {};
  const allIssues = getAllIssues(services);

  if (allIssues.length === 0) {
    return undefined;
  }

  // Rule tile -> file tiles
  if (metadata.isRule) {
    const ruleId = metadata.ruleId as string;
    return aggregateByFile(allIssues, ruleId);
  }

  // File tile -> issue tiles
  if (metadata.isFile) {
    const filePath = metadata.filePath as string;
    const ruleId = metadata.ruleId as string | undefined;
    return aggregateIssuesForFile(allIssues, filePath, ruleId);
  }

  // Issue tile -> no children (terminal)
  if (metadata.isIssue) {
    return undefined;
  }

  return undefined;
}

/**
 * Check if a tile can be expanded (has children).
 *
 * @param item - The tile to check
 * @returns True if the tile can be expanded
 */
export function canExpand(item: TileItem): boolean {
  const metadata = item.metadata ?? {};

  // Rule tiles can expand to show files
  if (metadata.isRule) {
    return true;
  }

  // File tiles can expand to show issues
  if (metadata.isFile) {
    return true;
  }

  // Issue tiles cannot expand (terminal)
  return false;
}

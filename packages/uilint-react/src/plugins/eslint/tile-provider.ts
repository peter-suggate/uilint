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
 * Tile type for distinguishing rule tiles from file tiles
 */
export type TileType = "rule" | "file";

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
        tileType: "rule" as TileType,
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

    // Extract filename for display
    const parts = filePath.split("/");
    const fileName = parts.pop() || filePath;

    tiles.push({
      id: `file:${filePath}:${ruleId}`,
      label: fileName,
      subtitle: filePath,
      count: fileIssues.length,
      severityCounts,
      metadata: {
        isFile: true,
        filePath,
        ruleId,
        tileType: "file" as TileType,
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
 * Aggregate all issues by file globally (across all rules).
 * Returns a single tile per file showing total issues.
 *
 * @param issues - Flat array of all issues
 * @returns Array of TileItem objects, one per unique file
 */
export function aggregateByFileGlobal(issues: Issue[]): TileItem[] {
  // Group all issues by file path
  const issuesByFile = new Map<string, Issue[]>();

  for (const issue of issues) {
    const filePath = issue.filePath;
    const existing = issuesByFile.get(filePath) || [];
    issuesByFile.set(filePath, [...existing, issue]);
  }

  // Convert to tiles
  const tiles: TileItem[] = [];

  for (const [filePath, fileIssues] of issuesByFile) {
    const severityCounts = countSeverities(fileIssues);

    // Extract filename for display
    const parts = filePath.split("/");
    const fileName = parts.pop() || filePath;

    // Get unique rule count for this file
    const uniqueRules = new Set(fileIssues.map((i) => i.ruleId));

    tiles.push({
      id: `file:${filePath}`,
      label: fileName,
      subtitle: filePath,
      count: fileIssues.length,
      severityCounts,
      metadata: {
        isFile: true,
        filePath,
        tileType: "file" as TileType,
        ruleCount: uniqueRules.size,
        // Store issues for search filtering
        issues: fileIssues,
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
 * Get all tiles (rules + files) in a flat list, sorted by issue count.
 * This is the new primary method for the redesigned command palette.
 *
 * @param issues - Flat array of all issues
 * @param availableRules - Available rule metadata for descriptions
 * @returns Array of TileItem objects (both rules and files), sorted by count
 */
export function getAllTilesFlat(
  issues: Issue[],
  availableRules: AvailableRule[] = []
): TileItem[] {
  // Get rule tiles (with issues stored for search filtering)
  // This includes rules with zero issues
  const ruleTiles = aggregateByRuleWithIssues(issues, availableRules);

  // Get global file tiles
  const fileTiles = issues.length > 0 ? aggregateByFileGlobal(issues) : [];

  // Combine all tiles
  const allTiles = [...ruleTiles, ...fileTiles];

  // Sort by count (descending), then by errors (descending)
  allTiles.sort((a, b) => {
    const aErrors = a.severityCounts?.error ?? 0;
    const bErrors = b.severityCounts?.error ?? 0;
    if (aErrors !== bErrors) return bErrors - aErrors;

    return b.count - a.count;
  });

  return allTiles;
}

/**
 * Aggregate issues by rule, including issues in metadata for search filtering.
 * Internal helper for getAllTilesFlat.
 *
 * @param issues - Flat array of all issues
 * @param availableRules - Available rule metadata for descriptions
 * @returns Array of TileItem objects, one per rule
 */
function aggregateByRuleWithIssues(
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

  // Collect all rule IDs: from issues + from available rules
  const allRuleIds = new Set<string>([
    ...issuesByRule.keys(),
    ...availableRules.map((r) => r.id),
  ]);

  // Convert to tiles
  const tiles: TileItem[] = [];

  for (const ruleId of allRuleIds) {
    const ruleIssues = issuesByRule.get(ruleId) || [];
    const meta = ruleMetadata.get(ruleId);
    const severityCounts = countSeverities(ruleIssues);

    // Extract short rule name (e.g., "no-unused-vars" from "@typescript-eslint/no-unused-vars")
    const shortName = ruleId.includes("/") ? ruleId.split("/").pop()! : ruleId;

    // Get unique file count for this rule
    const uniqueFiles = new Set(ruleIssues.map((i) => i.filePath));

    tiles.push({
      id: `rule:${ruleId}`,
      label: meta?.name || shortName,
      subtitle: meta?.description || ruleId,
      count: ruleIssues.length,
      severityCounts,
      fileCount: uniqueFiles.size,
      metadata: {
        isRule: true,
        ruleId,
        tileType: "rule" as TileType,
        // Store issues for search filtering
        issues: ruleIssues,
      },
    });
  }

  return tiles;
}

/**
 * Get all issues from the ESLint plugin state as a flat array.
 * Filters out issues from disabled rules.
 *
 * @param services - Plugin services for state access
 * @returns Flat array of all issues (excluding disabled rules)
 */
export function getAllIssues(services: PluginServices): Issue[] {
  const fullState = services.getState<{ plugins?: { eslint?: ESLintPluginSlice } }>();
  const state = fullState?.plugins?.eslint;

  if (!state?.issues) {
    return [];
  }

  // Get disabled rules set
  const disabledRules = state.disabledRules ?? new Set<string>();

  // Flatten the Map<dataLoc, Issue[]> to Issue[]
  const allIssues: Issue[] = [];
  for (const issues of state.issues.values()) {
    // Filter out issues from disabled rules
    for (const issue of issues) {
      if (!disabledRules.has(issue.ruleId)) {
        allIssues.push(issue);
      }
    }
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
 * NEW BEHAVIOR (flat command palette):
 * - Always returns all tiles (rules + files) in a flat list
 * - Filters are ignored (flat design has no drill-down)
 *
 * @param services - Plugin services for state access
 * @param filters - Currently active tile filters (ignored in flat mode)
 * @returns Array of tile items (rules and files combined)
 */
export function getTileItems(
  services: PluginServices,
  _filters: TileFilter[]
): TileItem[] {
  const allIssues = getAllIssues(services);
  const availableRules = getAvailableRules(services);

  if (allIssues.length === 0 && availableRules.length === 0) {
    return [];
  }

  // Use the new flat tile generation (includes rules with zero issues)
  return getAllTilesFlat(allIssues, availableRules);
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

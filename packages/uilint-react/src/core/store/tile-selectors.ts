/**
 * Tile Selectors
 *
 * Zustand selectors and helper functions for tile-related operations.
 * Note: Tile items are computed on-demand in useTileItems hook,
 * not stored in state.
 */

import type { CoreSlice } from "./core-slice";
import type { TileItem } from "../plugin-system/types";

// Issue type for search filtering (matches the structure in tile metadata)
interface IssueForSearch {
  message?: string;
  ruleId?: string;
  filePath?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Filter tile items by query text.
 * Enhanced to search within underlying issues, not just tile labels.
 *
 * Matches against (case-insensitive):
 * - Tile label (rule name or filename)
 * - Tile subtitle (rule description or file path)
 * - Issue messages within the tile (if stored in metadata.issues)
 * - Issue rule IDs (for file tiles)
 */
export function filterByQuery(items: TileItem[], query: string): TileItem[] {
  if (!query.trim()) {
    return items;
  }

  const normalizedQuery = query.toLowerCase().trim();

  return items.filter((item) => {
    // Check tile label and subtitle
    const label = item.label?.toLowerCase() ?? "";
    const subtitle = item.subtitle?.toLowerCase() ?? "";

    if (label.includes(normalizedQuery) || subtitle.includes(normalizedQuery)) {
      return true;
    }

    // Check underlying issues (stored in metadata for search filtering)
    const issues = item.metadata?.issues as IssueForSearch[] | undefined;
    if (issues && Array.isArray(issues)) {
      for (const issue of issues) {
        // Check issue message
        if (issue.message?.toLowerCase().includes(normalizedQuery)) {
          return true;
        }
        // Check rule ID (useful for file tiles)
        if (issue.ruleId?.toLowerCase().includes(normalizedQuery)) {
          return true;
        }
      }
    }

    // Check ruleId directly (for rule tiles)
    const ruleId = item.metadata?.ruleId as string | undefined;
    if (ruleId?.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    // Check filePath (for file tiles)
    const filePath = item.metadata?.filePath as string | undefined;
    if (filePath?.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    return false;
  });
}

/**
 * Deduplicate tile items by id, keeping the first occurrence.
 */
export function dedupeItems(items: TileItem[]): TileItem[] {
  const seen = new Set<string>();
  const result: TileItem[] = [];

  for (const item of items) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }

  return result;
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * Selector to get the current command palette query.
 */
export function selectTileQuery(state: CoreSlice): string {
  return state.commandPalette.query;
}

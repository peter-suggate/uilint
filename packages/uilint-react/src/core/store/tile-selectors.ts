/**
 * Tile Selectors
 *
 * Zustand selectors and helper functions for tile-related operations.
 * Note: Tile items are computed on-demand in useTileItems hook,
 * not stored in state.
 */

import type { CoreSlice } from "./core-slice";
import type { TileItem } from "../plugin-system/types";

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Filter tile items by query text.
 * Matches against label and subtitle (case-insensitive).
 */
export function filterByQuery(items: TileItem[], query: string): TileItem[] {
  if (!query.trim()) {
    return items;
  }

  const normalizedQuery = query.toLowerCase().trim();

  return items.filter((item) => {
    const label = item.label?.toLowerCase() ?? "";
    const subtitle = item.subtitle?.toLowerCase() ?? "";

    return label.includes(normalizedQuery) || subtitle.includes(normalizedQuery);
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

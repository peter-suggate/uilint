/**
 * Tile Selectors
 *
 * Zustand selectors for computing derived tile state.
 * These selectors are used by the useTileItems hook and CommandPalette.
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

// Stable empty array for selectors (avoid creating new references)
const EMPTY_TILE_ITEMS: TileItem[] = [];

// ============================================================================
// Selectors
// ============================================================================

/**
 * Selector to get filtered and deduplicated tile items.
 * Returns a selector function that can be used with useComposedStore.
 *
 * @param query - Search query for filtering items
 * @returns Selector function
 *
 * @example
 * ```tsx
 * const items = useComposedStore(selectTileItems("search text"));
 * ```
 */
export function selectTileItems(query: string) {
  return (state: CoreSlice): TileItem[] => {
    const rawItems = state.commandPalette.tileItems;
    if (rawItems.length === 0) {
      return EMPTY_TILE_ITEMS;
    }

    const filtered = filterByQuery(rawItems, query);
    return dedupeItems(filtered);
  };
}

/**
 * Selector to get raw tile items without filtering.
 */
export function selectRawTileItems(state: CoreSlice): TileItem[] {
  return state.commandPalette.tileItems;
}

/**
 * Selector to get tile items loading state.
 */
export function selectTileItemsLoading(state: CoreSlice): boolean {
  return state.commandPalette.tileItemsLoading;
}

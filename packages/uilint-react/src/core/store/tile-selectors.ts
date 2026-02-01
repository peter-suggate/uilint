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
// Memoization Cache for Filtered Tile Items
// ============================================================================

// Cache for selectFilteredTileItems to ensure stable references
let cachedRawItems: TileItem[] | null = null;
let cachedQuery: string | null = null;
let cachedResult: TileItem[] = EMPTY_TILE_ITEMS;

/**
 * Clear the tile items cache. Call this when the store is reset.
 */
export function clearTileItemsCache(): void {
  cachedRawItems = null;
  cachedQuery = null;
  cachedResult = EMPTY_TILE_ITEMS;
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * Selector to get filtered and deduplicated tile items.
 * Uses the query from commandPalette.query in the store.
 * Results are memoized to ensure stable references for React.
 *
 * @example
 * ```tsx
 * const items = useComposedStore(selectFilteredTileItems);
 * ```
 */
export function selectFilteredTileItems(state: CoreSlice): TileItem[] {
  const rawItems = state.commandPalette.tileItems;
  const query = state.commandPalette.query;

  // Return cached result if inputs haven't changed
  if (rawItems === cachedRawItems && query === cachedQuery) {
    return cachedResult;
  }

  // Update cache
  cachedRawItems = rawItems;
  cachedQuery = query;

  if (rawItems.length === 0) {
    cachedResult = EMPTY_TILE_ITEMS;
    return cachedResult;
  }

  const filtered = filterByQuery(rawItems, query);
  cachedResult = dedupeItems(filtered);
  return cachedResult;
}

/**
 * Selector to get the current command palette query.
 */
export function selectTileQuery(state: CoreSlice): string {
  return state.commandPalette.query;
}

/**
 * Selector to get the current tile filters.
 */
export function selectTileFilters(state: CoreSlice): CoreSlice["commandPalette"]["filters"] {
  return state.commandPalette.filters;
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


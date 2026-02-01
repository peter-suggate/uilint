/**
 * useTileItems - React hook for computing tile items based on filters
 *
 * Uses Zustand store with selectors for derived state.
 * Aggregates tile items from providers, filters by query text,
 * and handles loading states. Used by the masonry grid tile view.
 */

import { useMemo } from "react";
import { useComposedStore } from "../../core/store";
import {
  selectRawTileItems,
  selectTileItemsLoading,
  filterByQuery,
  dedupeItems,
} from "../../core/store/tile-selectors";
import { pluginRegistry } from "../../core/plugin-system/registry";
import type { TileItem, TileFilter } from "../../core/plugin-system/types";

/**
 * Return type for the useTileItems hook
 */
export interface UseTileItemsResult {
  /** Filtered and deduplicated tile items to display */
  items: TileItem[];
  /** Whether any provider is still loading */
  isLoading: boolean;
  /** Whether current filters represent a terminal state (no more drill-down) */
  isTerminal: boolean;
}

/**
 * Hook that returns tile items to display based on current filters.
 *
 * This hook uses Zustand selectors to derive state from the store:
 * 1. Gets raw tile items from the store (populated by refreshTileItems action)
 * 2. Filters results by query text (matching label and subtitle)
 * 3. Deduplicates items by id
 * 4. Determines if the current filter state is terminal
 *
 * Note: The actual data fetching is triggered by the CommandPalette component
 * calling refreshTileItems() when filters change.
 *
 * @param filters - Currently active tile filters
 * @param query - Search query for filtering items
 * @returns Object containing items, loading state, and terminal state
 *
 * @example
 * ```tsx
 * function TileGrid() {
 *   const [filters, setFilters] = useState<TileFilter[]>([]);
 *   const [query, setQuery] = useState("");
 *
 *   const { items, isLoading, isTerminal } = useTileItems(filters, query);
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <MasonryGrid>
 *       {items.map(item => (
 *         <Tile
 *           key={item.id}
 *           item={item}
 *           onClick={() => isTerminal ? openInspector(item) : addFilter(item)}
 *         />
 *       ))}
 *     </MasonryGrid>
 *   );
 * }
 * ```
 */
export function useTileItems(
  filters: TileFilter[],
  query: string
): UseTileItemsResult {
  // Get raw state from store using stable selectors
  const rawItems = useComposedStore(selectRawTileItems);
  const isLoading = useComposedStore(selectTileItemsLoading);

  // Filter and dedupe items - derived from raw items and query
  const items = useMemo((): TileItem[] => {
    if (rawItems.length === 0) {
      return rawItems; // Return same empty array reference
    }
    const filtered = filterByQuery(rawItems, query);
    return dedupeItems(filtered);
  }, [rawItems, query]);

  // Compute isTerminal from providers - this is cheap and doesn't need store state
  const isTerminal = useMemo((): boolean => {
    const tileProviders = pluginRegistry.getAllTileProviders();

    for (const { provider } of tileProviders) {
      if (provider.isTerminal && provider.isTerminal(filters)) {
        return true;
      }
    }
    return false;
  }, [filters]);

  return {
    items,
    isLoading,
    isTerminal,
  };
}

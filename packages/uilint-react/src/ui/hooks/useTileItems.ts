/**
 * useTileItems - React hook for accessing filtered tile items
 *
 * Uses Zustand store selectors for derived state.
 * All filtering and deduplication is performed in the store selectors,
 * keeping React code focused on presentation.
 */

import { useMemo } from "react";
import {
  useComposedStore,
  selectFilteredTileItems,
  selectTileFilters,
  selectTileItemsLoading,
} from "../../core/store";
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
 * This hook uses Zustand selectors for all derived state:
 * 1. Gets filtered and deduplicated tile items via selectFilteredTileItems
 * 2. Gets loading state via selectTileItemsLoading
 * 3. Determines if the current filter state is terminal (from plugin registry)
 *
 * Note: The query parameter is ignored - filtering uses commandPalette.query
 * from the store. This parameter is kept for API compatibility but will be
 * removed in a future version.
 *
 * @param _filters - Deprecated: filters come from the store
 * @param _query - Deprecated: query comes from the store
 * @returns Object containing items, loading state, and terminal state
 *
 * @example
 * ```tsx
 * function TileGrid() {
 *   const { items, isLoading, isTerminal } = useTileItems();
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
  _filters?: TileFilter[],
  _query?: string
): UseTileItemsResult {
  // Use stable selectors from the store
  const items = useComposedStore(selectFilteredTileItems);
  const isLoading = useComposedStore(selectTileItemsLoading);
  const filters = useComposedStore(selectTileFilters);

  // Compute isTerminal from providers - this queries the plugin registry
  // which is external to the store
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

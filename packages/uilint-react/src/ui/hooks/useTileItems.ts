/**
 * useTileItems - React hook for accessing filtered tile items
 *
 * Computes tile items on demand from plugin providers based on current filters.
 * This makes filters the single source of truth - tile items automatically
 * update when filters change.
 */

import { useMemo } from "react";
import { devWarn } from "uilint-core";
import {
  useComposedStore,
  selectTileFilters,
  selectIssuesMap,
  getPluginServices,
} from "../../core/store";
import { filterByQuery, dedupeItems } from "../../core/store/tile-selectors";
import { pluginRegistry } from "../../core/plugin-system/registry";
import type { TileItem, TileFilter } from "../../core/plugin-system/types";

/**
 * Return type for the useTileItems hook
 */
export interface UseTileItemsResult {
  /** Filtered and deduplicated tile items to display */
  items: TileItem[];
  /** Whether any provider is still loading (always false - computation is sync) */
  isLoading: boolean;
  /** Whether current filters represent a terminal state (no more drill-down) */
  isTerminal: boolean;
}

// Stable empty array to avoid creating new references
const EMPTY_ITEMS: TileItem[] = [];

/**
 * Compute tile items from all registered providers.
 * This is the core computation that was previously in refreshTileItems().
 */
function computeTileItems(filters: TileFilter[]): TileItem[] {
  const services = getPluginServices();
  if (!services) {
    devWarn("[useTileItems] Plugin services not available");
    return EMPTY_ITEMS;
  }

  const tileProviders = pluginRegistry.getAllTileProviders();
  if (tileProviders.length === 0) {
    return EMPTY_ITEMS;
  }

  const allItems: TileItem[] = [];

  for (const { pluginId, provider } of tileProviders) {
    try {
      const result = provider.getTileItems(services, filters);

      // Add providerId to each item's metadata for filter creation
      const itemsWithProvider = result.map((item) => ({
        ...item,
        metadata: {
          ...item.metadata,
          providerId: pluginId,
        },
      }));

      allItems.push(...itemsWithProvider);
    } catch (error) {
      devWarn(
        `[useTileItems] Error getting tile items from plugin "${pluginId}":`,
        error
      );
    }
  }

  return allItems;
}

/**
 * Hook that returns tile items to display based on current filters.
 *
 * Tile items are computed on demand from plugin providers whenever filters
 * change. This makes filters the single source of truth - no need to manually
 * call refreshTileItems().
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
  // Get filters and query from store - these are the source of truth
  const filters = useComposedStore(selectTileFilters);
  const query = useComposedStore((s) => s.commandPalette.query);

  // Subscribe to issues changes to trigger re-computation when lint results arrive
  // This ensures the tile grid updates when new issues come in via WebSocket
  const issuesMap = useComposedStore(selectIssuesMap);

  // Compute raw tile items when filters or issues change
  // This replaces the manual refreshTileItems() calls
  const rawItems = useMemo(() => computeTileItems(filters), [filters, issuesMap]);

  // Apply query filtering and deduplication
  const items = useMemo(() => {
    if (rawItems.length === 0) return EMPTY_ITEMS;
    const filtered = filterByQuery(rawItems, query);
    return dedupeItems(filtered);
  }, [rawItems, query]);

  // Compute isTerminal from providers
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
    // Always false since computation is synchronous
    // Kept for API compatibility
    isLoading: false,
    isTerminal,
  };
}

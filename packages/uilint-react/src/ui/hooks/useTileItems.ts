/**
 * useTileItems - React hook for computing tile items based on filters and categories
 *
 * Aggregates tile items from category providers, filters by query text,
 * and handles async loading states. Used by the masonry grid tile view.
 */

import { useMemo, useState, useEffect } from "react";
import { getPluginServices } from "../../core/store";
import { pluginRegistry } from "../../core/plugin-system/registry";
import type { TileItem, TileFilter, CategoryProvider } from "../../core/plugin-system/types";

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
 * Filter tile items by query text.
 * Matches against label and subtitle (case-insensitive).
 *
 * @param items - Tile items to filter
 * @param query - Search query string
 * @returns Filtered items matching the query
 */
function filterByQuery(items: TileItem[], query: string): TileItem[] {
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
 *
 * @param items - Tile items to deduplicate
 * @returns Deduplicated items
 */
function dedupeItems(items: TileItem[]): TileItem[] {
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

/**
 * Hook that computes tile items to display based on current filters and categories.
 *
 * This hook:
 * 1. Gets active category providers from the plugin registry
 * 2. Calls getTileItems on each provider with the current filters
 * 3. Filters results by query text (matching label and subtitle)
 * 4. Merges and deduplicates items by id
 * 5. Determines if the current filter state is terminal
 *
 * @param filters - Currently active tile filters
 * @param query - Search query for filtering items
 * @param selectedCategoryIds - Set of category IDs to include (empty = all)
 * @returns Object containing items, loading state, and terminal state
 *
 * @example
 * ```tsx
 * function TileGrid() {
 *   const [filters, setFilters] = useState<TileFilter[]>([]);
 *   const [query, setQuery] = useState("");
 *   const [selectedCategories] = useState(new Set<string>());
 *
 *   const { items, isLoading, isTerminal } = useTileItems(
 *     filters,
 *     query,
 *     selectedCategories
 *   );
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
  query: string,
  selectedCategoryIds: Set<string>
): UseTileItemsResult {
  const [asyncItems, setAsyncItems] = useState<TileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get active category providers based on selection
  const activeProviders = useMemo((): CategoryProvider[] => {
    const allProviders = pluginRegistry.getAllCategoryProviders();

    // If no categories selected, use all providers that have getTileItems
    if (selectedCategoryIds.size === 0) {
      return allProviders.filter((provider) => provider.getTileItems !== undefined);
    }

    // Filter to only selected categories that have getTileItems
    return allProviders.filter(
      (provider) =>
        selectedCategoryIds.has(provider.id) && provider.getTileItems !== undefined
    );
  }, [selectedCategoryIds]);

  // Check if current filter state is terminal
  const isTerminal = useMemo((): boolean => {
    // Check if any active provider indicates terminal state
    for (const provider of activeProviders) {
      if (provider.isTerminal && provider.isTerminal(filters)) {
        return true;
      }
    }
    return false;
  }, [activeProviders, filters]);

  // Fetch tile items from all active providers
  useEffect(() => {
    const services = getPluginServices();
    if (!services) {
      // Services not initialized yet
      setAsyncItems([]);
      setIsLoading(false);
      return;
    }

    if (activeProviders.length === 0) {
      setAsyncItems([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    // Collect all items from providers (sync and async)
    const fetchAllItems = async (): Promise<TileItem[]> => {
      const allItems: TileItem[] = [];

      // Call getTileItems on each provider
      const promises = activeProviders.map(async (provider: CategoryProvider) => {
        if (!provider.getTileItems) return [];

        try {
          const result = provider.getTileItems(services, filters);

          // Handle both sync and async results
          if (result instanceof Promise) {
            return await result;
          }
          return result;
        } catch (error) {
          console.error(
            `[useTileItems] Error getting tile items from provider "${provider.id}":`,
            error
          );
          return [];
        }
      });

      // Wait for all providers to complete
      const results = await Promise.all(promises);

      // Merge all items
      for (const items of results) {
        allItems.push(...items);
      }

      return allItems;
    };

    fetchAllItems().then((items) => {
      if (!cancelled) {
        setAsyncItems(items);
        setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeProviders, filters]);

  // Filter by query and dedupe
  const items = useMemo((): TileItem[] => {
    const filtered = filterByQuery(asyncItems, query);
    return dedupeItems(filtered);
  }, [asyncItems, query]);

  return {
    items,
    isLoading,
    isTerminal,
  };
}

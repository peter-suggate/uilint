/**
 * useTileItems - React hook for accessing tile items
 *
 * Computes tile items on demand from plugin providers.
 * With the new expandable tile model, this always returns root-level tiles (rules).
 * Expansion to children (files, issues) is handled by the ExpandableTileGrid component.
 */

import { useMemo } from "react";
import { devWarn } from "uilint-core";
import {
  useComposedStore,
  selectIssuesMap,
  getPluginServices,
} from "../../core/store";
import { filterByQuery, dedupeItems } from "../../core/store/tile-selectors";
import { pluginRegistry } from "../../core/plugin-system/registry";
import type { TileItem } from "../../core/plugin-system/types";

/**
 * Return type for the useTileItems hook
 */
export interface UseTileItemsResult {
  /** Tile items to display */
  items: TileItem[];
  /** Whether any provider is still loading (always false - computation is sync) */
  isLoading: boolean;
  /** Whether current state represents a terminal state (no more drill-down) */
  isTerminal: boolean;
}

// Stable empty array to avoid creating new references
const EMPTY_ITEMS: TileItem[] = [];

// Empty filters - we always show root-level tiles now
const EMPTY_FILTERS: never[] = [];

/**
 * Compute tile items from all registered providers.
 * Always returns root-level tiles (no filters applied).
 */
function computeTileItems(): TileItem[] {
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
      // Always pass empty filters to get root-level tiles
      const result = provider.getTileItems(services, EMPTY_FILTERS);

      // Add providerId to each item's metadata for expansion handling
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
 * Hook that returns tile items to display.
 *
 * With the new expandable tile model, this always returns root-level tiles.
 * Child tiles (files, issues) are fetched by the ExpandableTileGrid when
 * tiles are expanded.
 *
 * @param query - Optional search query to filter tiles
 * @returns Object containing items, loading state, and terminal state
 *
 * @example
 * ```tsx
 * function TileGrid() {
 *   const { items, isLoading } = useTileItems();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <ExpandableTileGrid items={items} ... />
 *   );
 * }
 * ```
 */
export function useTileItems(query?: string): UseTileItemsResult {
  // Get query from store if not provided
  const storeQuery = useComposedStore((s) => s.commandPalette.query);
  const effectiveQuery = query ?? storeQuery;

  // Subscribe to issues changes to trigger re-computation when lint results arrive
  const issuesMap = useComposedStore(selectIssuesMap);

  // Subscribe to disabled rules to re-compute when rules are toggled
  const disabledRules = useComposedStore(
    (s) => (s.plugins?.eslint as { disabledRules?: Set<string> } | undefined)?.disabledRules
  );

  // Subscribe to available rules to re-compute when rule metadata arrives
  // (rules:metadata may arrive after lint:result, so tiles need to recompute
  // to pick up category, severity, options, and human-readable names)
  const availableRules = useComposedStore(
    (s) => (s.plugins?.eslint as { availableRules?: unknown[] } | undefined)?.availableRules
  );

  // Compute raw tile items when issues, disabled rules, or available rules change
  const rawItems = useMemo(() => computeTileItems(), [issuesMap, disabledRules, availableRules]);

  // Apply query filtering and deduplication
  const items = useMemo(() => {
    if (rawItems.length === 0) return EMPTY_ITEMS;
    const filtered = filterByQuery(rawItems, effectiveQuery);
    return dedupeItems(filtered);
  }, [rawItems, effectiveQuery]);

  return {
    items,
    // Always false since computation is synchronous
    isLoading: false,
    // Never terminal at root level - expansion handles drill-down
    isTerminal: false,
  };
}

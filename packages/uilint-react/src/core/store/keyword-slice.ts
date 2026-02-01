/**
 * Keyword Slice
 *
 * Zustand slice for managing keyword-based filtering in the command palette.
 * Replaces the complex category system with a simple flat list of keywords.
 *
 * Items have keywords like ["Lint", "no-unused-vars", "Button.tsx", "error"].
 * The sidebar shows unique keywords sorted by frequency (most first).
 * Clicking a keyword filters items to those containing that keyword.
 */

import type { StateCreator } from "zustand";
import { devLog, devWarn } from "uilint-core";
import type { PaletteItem, KeywordCount, PluginServices, Plugin } from "../plugin-system/types";
import { pluginRegistry } from "../plugin-system/registry";

// ============================================================================
// Slice Interface
// ============================================================================

/**
 * Keyword slice state and actions.
 */
export interface KeywordSlice {
  // === State ===
  /** All items from all plugins */
  paletteItems: PaletteItem[];
  /** Currently selected keywords (empty = show all) */
  selectedKeywords: Set<string>;
  /** Cached keyword counts (recomputed when items change) */
  keywordCounts: KeywordCount[];
  /** Loading state for items */
  paletteItemsLoading: boolean;

  // === Actions ===
  /** Refresh items from all plugins */
  refreshPaletteItems: () => Promise<void>;
  /** Toggle a keyword filter on/off */
  toggleKeyword: (keyword: string) => void;
  /** Clear all keyword filters */
  clearKeywords: () => void;
  /** Reset keyword state (called on palette close) */
  resetKeywordState: () => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Compute keyword counts from items.
 * Returns keywords sorted by count (most frequent first).
 */
function computeKeywordCounts(items: PaletteItem[]): KeywordCount[] {
  const counts = new Map<string, number>();

  for (const item of items) {
    for (const keyword of item.keywords) {
      counts.set(keyword, (counts.get(keyword) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================================
// Slice Creator
// ============================================================================

// Slice type includes categoryServices from CategorySlice for accessing services
interface KeywordSliceWithServices extends KeywordSlice {
  categoryServices: PluginServices | null;
}

/**
 * Create the keyword slice.
 */
export const createKeywordSlice: StateCreator<KeywordSliceWithServices, [], [], KeywordSlice> = (
  set,
  get
) => ({
  // === State ===
  paletteItems: [],
  selectedKeywords: new Set<string>(),
  keywordCounts: [],
  paletteItemsLoading: false,

  // === Actions ===
  refreshPaletteItems: async () => {
    const services = get().categoryServices;
    if (!services) {
      devWarn("[KeywordSlice] Services not initialized, cannot refresh palette items");
      return;
    }

    set({ paletteItemsLoading: true });

    try {
      const allItems: PaletteItem[] = [];
      const plugins = pluginRegistry.getPlugins();

      // Collect items from all plugins that implement getPaletteItems
      for (const plugin of plugins) {
        if (plugin.getPaletteItems) {
          try {
            const items = await plugin.getPaletteItems(services);
            allItems.push(...items);
          } catch (error) {
            devWarn(`[KeywordSlice] Failed to get items from plugin "${plugin.id}":`, error);
          }
        }
      }

      // Compute and cache keyword counts
      const keywordCounts = computeKeywordCounts(allItems);

      devLog(`[KeywordSlice] Loaded ${allItems.length} items with ${keywordCounts.length} unique keywords`);

      set({
        paletteItems: allItems,
        keywordCounts,
        paletteItemsLoading: false,
      });
    } catch (error) {
      devWarn("[KeywordSlice] Failed to refresh palette items:", error);
      set({ paletteItemsLoading: false });
    }
  },

  toggleKeyword: (keyword: string) => {
    const current = get().selectedKeywords;
    const next = new Set(current);

    if (next.has(keyword)) {
      next.delete(keyword);
    } else {
      next.add(keyword);
    }

    set({ selectedKeywords: next });
  },

  clearKeywords: () => {
    set({ selectedKeywords: new Set<string>() });
  },

  resetKeywordState: () => {
    // Clear filters but keep items cached for fast re-open
    set({ selectedKeywords: new Set<string>() });
  },
});

// ============================================================================
// Selectors
// ============================================================================

// Stable empty arrays for selectors (avoid creating new references)
const EMPTY_ITEMS: PaletteItem[] = [];
const EMPTY_COUNTS: KeywordCount[] = [];

/**
 * Select filtered palette items based on selected keywords.
 * When no keywords are selected, returns all items.
 * When keywords are selected, returns items that contain ALL selected keywords.
 */
export function selectFilteredPaletteItems(state: KeywordSlice): PaletteItem[] {
  if (state.paletteItems.length === 0) {
    return EMPTY_ITEMS;
  }

  if (state.selectedKeywords.size === 0) {
    return state.paletteItems;
  }

  const selectedArray = Array.from(state.selectedKeywords);
  return state.paletteItems.filter((item) =>
    selectedArray.every((kw) => item.keywords.includes(kw))
  );
}

/**
 * Select keyword counts for sidebar display.
 */
export function selectKeywordCounts(state: KeywordSlice): KeywordCount[] {
  return state.keywordCounts.length > 0 ? state.keywordCounts : EMPTY_COUNTS;
}

/**
 * Check if a specific keyword is selected.
 */
export function selectIsKeywordSelected(state: KeywordSlice, keyword: string): boolean {
  return state.selectedKeywords.has(keyword);
}

/**
 * Check if any keyword filters are active.
 */
export function selectHasKeywordFilters(state: KeywordSlice): boolean {
  return state.selectedKeywords.size > 0;
}

/**
 * Get the count of selected keywords.
 */
export function selectSelectedKeywordCount(state: KeywordSlice): number {
  return state.selectedKeywords.size;
}

/**
 * Select items filtered by query text (searches title, subtitle, keywords).
 * This is applied on top of keyword filtering.
 */
export function selectItemsFilteredByQuery(
  state: KeywordSlice,
  query: string
): PaletteItem[] {
  const items = selectFilteredPaletteItems(state);

  if (!query.trim()) {
    return items;
  }

  const lowerQuery = query.toLowerCase();
  return items.filter(
    (item) =>
      item.title.toLowerCase().includes(lowerQuery) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(lowerQuery)) ||
      item.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery))
  );
}

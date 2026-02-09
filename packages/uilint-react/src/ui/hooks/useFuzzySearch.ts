/**
 * useFuzzySearch - Fuzzy search hook for SearchItem arrays
 *
 * Uses fuse.js for fuzzy matching with configurable weights.
 * Groups results by section for the command palette result list.
 */

import { useMemo } from "react";
import Fuse, { type IFuseOptions } from "fuse.js";
import type { SearchItem } from "../../core/plugin-system/types";

// ============================================================================
// Fuse.js Configuration
// ============================================================================

const FUSE_OPTIONS: IFuseOptions<SearchItem> = {
  keys: [
    { name: "searchFields.label", weight: 2.0 },
    { name: "searchFields.keywords", weight: 1.5 },
    { name: "searchFields.subtitle", weight: 1.0 },
    { name: "searchFields.extra", weight: 0.5 },
  ],
  threshold: 0.4,
  includeScore: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
};

/** Canonical section ordering */
const SECTION_ORDER = ["rules", "files", "commands"];

// ============================================================================
// Types
// ============================================================================

export interface UseFuzzySearchResult {
  /** Filtered and ranked items (flat list) */
  results: SearchItem[];
  /** Grouped by section, preserving sort order within each group */
  grouped: Map<string, SearchItem[]>;
  /** Flattened list in display order (respecting section grouping) */
  flatItems: SearchItem[];
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Fuzzy search over SearchItem arrays with section grouping.
 *
 * @param items - All search items from plugins
 * @param query - Current search query (empty returns all items)
 * @returns Filtered results, grouped by section, and a flat display list
 */
export function useFuzzySearch(
  items: SearchItem[],
  query: string
): UseFuzzySearchResult {
  const fuse = useMemo(() => new Fuse(items, FUSE_OPTIONS), [items]);

  return useMemo(() => {
    const trimmedQuery = query.trim();
    let results: SearchItem[];

    if (!trimmedQuery) {
      results = items;
    } else {
      results = fuse.search(trimmedQuery).map((r) => r.item);
    }

    // Group by section, preserving order within each group
    const grouped = new Map<string, SearchItem[]>();

    // Initialize known sections in canonical order
    for (const section of SECTION_ORDER) {
      grouped.set(section, []);
    }

    for (const item of results) {
      const section = item.section;
      if (!grouped.has(section)) {
        grouped.set(section, []);
      }
      grouped.get(section)!.push(item);
    }

    // Remove empty sections
    for (const [key, value] of grouped) {
      if (value.length === 0) grouped.delete(key);
    }

    // Build flat display list (section-ordered)
    const flatItems: SearchItem[] = [];
    for (const [, sectionItems] of grouped) {
      flatItems.push(...sectionItems);
    }

    return { results, grouped, flatItems };
  }, [fuse, items, query]);
}

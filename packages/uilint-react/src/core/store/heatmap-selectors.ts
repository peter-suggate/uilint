/**
 * Heatmap Selectors
 *
 * Selectors for filtering heatmap overlay elements.
 * Used by HeatmapOverlay component to determine which elements to show.
 *
 * The heatmap automatically reflects the current tile filters:
 * - No filters: show all issues
 * - Rule filter: show issues for that rule
 * - Rule + File filter: show issues for that rule in that file
 */

import type { ComposedState } from "./composed-store";
import type { HeatmapFilterState } from "./core-slice";
import type { TileFilter } from "../plugin-system/types";
import type { Issue } from "../../ui/types";

// ============================================================================
// Stable Empty Values
// ============================================================================

const EMPTY_DATA_LOCS: string[] = [];

// ============================================================================
// Memoization Cache for Heatmap DataLocs
// ============================================================================

// Cache for selectHeatmapDataLocs to ensure stable references
let cachedFilters: TileFilter[] | null = null;
let cachedIssuesMap: Map<string, Issue[]> | null = null;
let cachedDataLocs: string[] = EMPTY_DATA_LOCS;

/**
 * Clear the heatmap data locs cache. Call this when the store is reset.
 */
export function clearHeatmapDataLocsCache(): void {
  cachedFilters = null;
  cachedIssuesMap = null;
  cachedDataLocs = EMPTY_DATA_LOCS;
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select the heatmap filter state.
 *
 * @param state - The composed store state
 * @returns The heatmap filter state object
 *
 * @example
 * ```tsx
 * const heatmapFilter = useComposedStore(selectHeatmapFilter);
 * console.log(heatmapFilter.mode); // "all" | "related-only"
 * ```
 */
export function selectHeatmapFilter(state: ComposedState): HeatmapFilterState {
  return state.heatmapFilter;
}

/**
 * Select the filter label (if any).
 * The label describes what the current filter is showing (e.g., "Duplicate Pair").
 *
 * @param state - The composed store state
 * @returns The filter label string or null if no label is set
 *
 * @example
 * ```tsx
 * const filterLabel = useComposedStore(selectHeatmapFilterLabel);
 * if (filterLabel) {
 *   console.log(`Showing: ${filterLabel}`);
 * }
 * ```
 */
export function selectHeatmapFilterLabel(state: ComposedState): string | null {
  return state.heatmapFilter.filterLabel;
}

/**
 * Select if heatmap is in filtered mode.
 * Returns true when the heatmap is showing only a subset of elements
 * (mode is "related-only" AND there are highlighted locations).
 *
 * @param state - The composed store state
 * @returns true if the heatmap is currently filtered
 *
 * @example
 * ```tsx
 * const isFiltered = useComposedStore(selectIsHeatmapFiltered);
 * if (isFiltered) {
 *   // Show "Clear filter" button
 * }
 * ```
 */
export function selectIsHeatmapFiltered(state: ComposedState): boolean {
  const { mode, highlightedLocs } = state.heatmapFilter;
  return mode === "related-only" && highlightedLocs.length > 0;
}

/**
 * Select the highlighted locations array.
 *
 * @param state - The composed store state
 * @returns Array of dataLoc strings that are highlighted
 *
 * @example
 * ```tsx
 * const highlightedLocs = useComposedStore(selectHighlightedLocs);
 * console.log(`${highlightedLocs.length} locations highlighted`);
 * ```
 */
export function selectHighlightedLocs(state: ComposedState): string[] {
  return state.heatmapFilter.highlightedLocs;
}

/**
 * Select the count of highlighted locations.
 *
 * @param state - The composed store state
 * @returns Number of highlighted locations
 *
 * @example
 * ```tsx
 * const count = useComposedStore(selectHighlightedLocsCount);
 * console.log(`Showing ${count} related elements`);
 * ```
 */
export function selectHighlightedLocsCount(state: ComposedState): number {
  return state.heatmapFilter.highlightedLocs.length;
}

/**
 * Derive the dataLocs to highlight based on current tile filters.
 * This connects tile navigation to heatmap visualization.
 *
 * Filter logic:
 * - No filters: return empty array (show all issues)
 * - Rule filter only: return all dataLocs for that rule
 * - Rule + File filter: return dataLocs for that rule in that file
 *
 * Results are memoized to ensure stable references for React.
 *
 * @param state - The composed store state
 * @returns Array of dataLoc strings that should be highlighted
 *
 * @example
 * ```tsx
 * const dataLocs = useComposedStore(selectHeatmapDataLocs);
 * // When user filters to "no-unused-vars" rule, dataLocs contains
 * // all dataLoc values for issues with that rule
 * ```
 */
export function selectHeatmapDataLocs(state: ComposedState): string[] {
  const filters = state.commandPalette.filters;
  const issuesMap = state.plugins?.eslint?.issues;

  // Return cached result if inputs haven't changed
  if (filters === cachedFilters && issuesMap === cachedIssuesMap) {
    return cachedDataLocs;
  }

  // Update cache references
  cachedFilters = filters;
  cachedIssuesMap = issuesMap ?? null;

  // No issues = no dataLocs to highlight
  if (!issuesMap || issuesMap.size === 0) {
    cachedDataLocs = EMPTY_DATA_LOCS;
    return cachedDataLocs;
  }

  // No filters = show all (return empty to indicate "all")
  if (filters.length === 0) {
    cachedDataLocs = EMPTY_DATA_LOCS;
    return cachedDataLocs;
  }

  // Extract rule and file filters
  const ruleFilter = filters.find((f) => f.type === "rule");
  const fileFilter = filters.find((f) => f.type === "file");

  // Collect matching dataLocs
  const dataLocs: string[] = [];

  for (const [dataLoc, issues] of issuesMap) {
    for (const issue of issues) {
      // Check if issue matches the filters
      const matchesRule = !ruleFilter || issue.ruleId === ruleFilter.id;
      const matchesFile = !fileFilter || issue.filePath === fileFilter.id;

      if (matchesRule && matchesFile) {
        dataLocs.push(dataLoc);
        break; // Only need to add dataLoc once
      }
    }
  }

  cachedDataLocs = dataLocs.length > 0 ? dataLocs : EMPTY_DATA_LOCS;
  return cachedDataLocs;
}

/**
 * Check if heatmap filtering is active based on tile filters.
 * Returns true when there are tile filters that scope which issues to show.
 *
 * @param state - The composed store state
 * @returns true if tile filters are limiting the heatmap display
 */
export function selectHasActiveTileFilters(state: ComposedState): boolean {
  return state.commandPalette.filters.length > 0;
}

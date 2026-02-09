/**
 * Heatmap Selectors
 *
 * Selectors for the heatmap overlay.
 * Uses the additive selection model: all elements are visible,
 * selected ones are emphasized (full opacity), others are dimmed.
 *
 * Selection is based on inspector expansion state:
 * - expandedRuleId: emphasize all elements with that rule
 * - expandedFilePath: further narrow to that file
 */

import type { ComposedState } from "./composed-store";
import type { HeatmapFilterState } from "./core-slice";
import type { Issue } from "../../ui/types";

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


// ============================================================================
// Additive Selection Model (New)
// ============================================================================

// Stable empty Set for when nothing is selected
const EMPTY_SET: Set<string> = new Set();

// Cache for selectSelectedDataLocs
let cachedExpandedRuleId: string | null = null;
let cachedExpandedFilePath: string | null = null;
let cachedIssuesMapForSelection: Map<string, Issue[]> | null = null;
let cachedSelectedDataLocs: Set<string> = EMPTY_SET;

/**
 * Clear the selected data locs cache. Call this when the store is reset.
 */
export function clearSelectedDataLocsCache(): void {
  cachedExpandedRuleId = null;
  cachedExpandedFilePath = null;
  cachedIssuesMapForSelection = null;
  cachedSelectedDataLocs = EMPTY_SET;
}

/**
 * Select dataLocs that match the current selection (expanded rule/file).
 * Used for the additive selection model where all elements are visible
 * but selected ones are emphasized (full opacity) and others are dimmed.
 *
 * Returns empty Set when nothing is selected, meaning all elements
 * should be displayed with equal emphasis.
 *
 * @param state - The composed store state
 * @returns Set of dataLoc strings that should be emphasized
 *
 * @example
 * ```tsx
 * const selectedDataLocs = useComposedStore(selectSelectedDataLocs);
 * const isEmphasized = selectedDataLocs.size === 0 || selectedDataLocs.has(dataLoc);
 * // isEmphasized true = full opacity, false = dimmed
 * ```
 */
export function selectSelectedDataLocs(state: ComposedState): Set<string> {
  const expandedRuleId = state.inspector.expandedRuleId;
  const expandedFilePath = state.inspector.expandedFilePath;
  const issuesMap = state.plugins?.eslint?.issues;

  // Return cached result if inputs haven't changed
  if (
    expandedRuleId === cachedExpandedRuleId &&
    expandedFilePath === cachedExpandedFilePath &&
    issuesMap === cachedIssuesMapForSelection
  ) {
    return cachedSelectedDataLocs;
  }

  // Update cache references
  cachedExpandedRuleId = expandedRuleId;
  cachedExpandedFilePath = expandedFilePath;
  cachedIssuesMapForSelection = issuesMap ?? null;

  // No selection or no issues = empty set (all elements equal emphasis)
  if (!expandedRuleId || !issuesMap || issuesMap.size === 0) {
    cachedSelectedDataLocs = EMPTY_SET;
    return cachedSelectedDataLocs;
  }

  // Build set of dataLocs that match the selection
  const selected = new Set<string>();

  for (const [dataLoc, issues] of issuesMap) {
    for (const issue of issues) {
      // Check if issue matches the expanded rule
      if (issue.ruleId === expandedRuleId) {
        // If file is also expanded, must match that too
        if (!expandedFilePath || issue.filePath === expandedFilePath) {
          selected.add(dataLoc);
          break; // Only need to add dataLoc once
        }
      }
    }
  }

  cachedSelectedDataLocs = selected.size > 0 ? selected : EMPTY_SET;
  return cachedSelectedDataLocs;
}

/**
 * Check if there's an active selection (expanded rule).
 * Useful for determining whether to apply emphasis styling.
 *
 * @param state - The composed store state
 * @returns true if a rule is currently expanded/selected
 */
export function selectHasActiveSelection(state: ComposedState): boolean {
  return state.inspector.expandedRuleId !== null;
}


// ============================================================================
// Heatmap Preview (Command Palette hover/keyboard)
// ============================================================================

// Cache for selectPreviewedDataLocs
let cachedPreviewedRuleId: string | null = null;
let cachedPreviewedFilePath: string | null = null;
let cachedIssuesMapForPreview: Map<string, Issue[]> | null = null;
let cachedPreviewedDataLocs: Set<string> = EMPTY_SET;

/**
 * Clear the previewed data locs cache. Call this when the store is reset.
 */
export function clearPreviewedDataLocsCache(): void {
  cachedPreviewedRuleId = null;
  cachedPreviewedFilePath = null;
  cachedIssuesMapForPreview = null;
  cachedPreviewedDataLocs = EMPTY_SET;
}

/**
 * Select dataLocs that match the current preview (command palette hover/keyboard).
 * Similar to selectSelectedDataLocs but reads preview state instead of inspector expansion.
 *
 * Returns empty Set when nothing is previewed.
 *
 * @param state - The composed store state
 * @returns Set of dataLoc strings that should show preview animation
 */
export function selectPreviewedDataLocs(state: ComposedState): Set<string> {
  const previewedRuleId = state.previewedRuleId;
  const previewedFilePath = state.previewedFilePath;
  const issuesMap = state.plugins?.eslint?.issues;

  // Return cached result if inputs haven't changed
  if (
    previewedRuleId === cachedPreviewedRuleId &&
    previewedFilePath === cachedPreviewedFilePath &&
    issuesMap === cachedIssuesMapForPreview
  ) {
    return cachedPreviewedDataLocs;
  }

  // Update cache references
  cachedPreviewedRuleId = previewedRuleId;
  cachedPreviewedFilePath = previewedFilePath;
  cachedIssuesMapForPreview = issuesMap ?? null;

  // No preview or no issues = empty set
  if (!previewedRuleId || !issuesMap || issuesMap.size === 0) {
    cachedPreviewedDataLocs = EMPTY_SET;
    return cachedPreviewedDataLocs;
  }

  // Build set of dataLocs that match the preview
  const previewed = new Set<string>();

  for (const [dataLoc, issues] of issuesMap) {
    for (const issue of issues) {
      if (issue.ruleId === previewedRuleId) {
        if (!previewedFilePath || issue.filePath === previewedFilePath) {
          previewed.add(dataLoc);
          break;
        }
      }
    }
  }

  cachedPreviewedDataLocs = previewed.size > 0 ? previewed : EMPTY_SET;
  return cachedPreviewedDataLocs;
}

/**
 * Check if there's an active heatmap preview.
 *
 * @param state - The composed store state
 * @returns true if a rule is currently being previewed
 */
export function selectHasActivePreview(state: ComposedState): boolean {
  return state.previewedRuleId !== null;
}

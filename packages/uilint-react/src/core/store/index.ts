/**
 * Core Store - UI state management
 */

// Core slice
export {
  createCoreSlice,
  type CoreSlice,
  type CommandPaletteState,
  type CommandPaletteFilter,
  type InspectorState,
  type HeatmapFilterState,
  type ConnectionStatus,
} from "./core-slice";

// Tile selectors
export {
  selectTileQuery,
  filterByQuery,
  dedupeItems,
} from "./tile-selectors";

// Heatmap selectors (additive selection model)
export {
  selectHeatmapFilter,
  selectHeatmapFilterLabel,
  selectIsHeatmapFiltered,
  selectHighlightedLocs,
  selectHighlightedLocsCount,
  // Additive selection model
  selectSelectedDataLocs,
  selectHasActiveSelection,
  clearSelectedDataLocsCache,
  // Preview (command palette hover/keyboard)
  selectPreviewedDataLocs,
  selectHasActivePreview,
  clearPreviewedDataLocsCache,
} from "./heatmap-selectors";

// File groups selector
export {
  selectFileGroups,
  selectFilteredFileGroups, // deprecated alias
  selectFileGroupsSummary,
  selectExpandedRuleId,
  selectExpandedFilePath,
  selectHasIssues as selectHasFileGroupIssues,
  selectHasFilteredIssues, // deprecated alias
  clearFileGroupsCache,
  type FileGroup,
  type RuleGroup,
  type FileGroupsSummary,
} from "./file-groups-selector";

// Issues selectors
export {
  selectIssuesMap,
  selectAllIssues,
  selectIssuesByFile,
  selectTotalIssueCount,
  selectSeverityCounts,
  selectHasIssues,
  selectHasErrors,
  type SeverityCounts,
} from "./issues-selectors";

// Composed store - unified store with plugin slices
export {
  // Store creation and hooks
  createComposedStore,
  createComposedStoreFactory,
  useComposedStore,
  initializePlugins,
  // Store utilities
  getStoreApi,
  getPluginServices,
  resetStore,
  hasPluginSlice,
  getPluginSlice,
  createScopedPluginServices,
  // Types
  type ComposedStoreOptions,
  type PluginSliceMap,
  type AnyPluginSlice,
  type PluginSlices,
  type ComposedState,
  type ComposedStoreActions,
  type ComposedStore,
} from "./composed-store";

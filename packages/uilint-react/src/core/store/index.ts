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
} from "./core-slice";

// Tile selectors
export {
  selectTileQuery,
  selectTileFilters,
  filterByQuery,
  dedupeItems,
} from "./tile-selectors";

// Heatmap selectors
export {
  selectHeatmapFilter,
  selectHeatmapFilterLabel,
  selectIsHeatmapFiltered,
  selectHighlightedLocs,
  selectHighlightedLocsCount,
  selectHeatmapDataLocs,
  selectHasActiveTileFilters,
  clearHeatmapDataLocsCache,
} from "./heatmap-selectors";

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

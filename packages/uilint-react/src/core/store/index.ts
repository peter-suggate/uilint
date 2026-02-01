/**
 * Core Store - UI state management
 */

// Core slice
export {
  createCoreSlice,
  type CoreSlice,
  type FloatingIconPosition,
  type CommandPaletteState,
  type CommandPaletteFilter,
  type InspectorState,
  type HeatmapFilterState,
} from "./core-slice";

// Tile selectors
export {
  selectTileItems,
  selectRawTileItems,
  selectTileItemsLoading,
  selectIsTerminalFilter,
  selectActiveProviders,
  filterByQuery,
  dedupeItems,
} from "./tile-selectors";

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

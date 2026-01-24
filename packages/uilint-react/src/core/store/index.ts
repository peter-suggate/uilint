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
} from "./core-slice";

// Composed store - unified store with plugin slices
export {
  // Store creation and hooks
  createComposedStore,
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
  type PluginSliceMap,
  type AnyPluginSlice,
  type PluginSlices,
  type ComposedState,
  type ComposedStoreActions,
  type ComposedStore,
} from "./composed-store";

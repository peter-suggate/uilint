/**
 * Composed Store
 *
 * Creates a unified Zustand store that merges the core slice with all
 * registered plugin slices. This enables a plugin architecture where
 * plugins can contribute their own state slices that get merged into
 * a single store.
 *
 * Key features:
 * - Core slice is always initialized first
 * - Plugin slices are merged as plugins are registered
 * - Dynamic slice registration is supported
 * - Provides PluginServices-compatible getState/setState
 * - Full TypeScript support for combined state
 */

import { create, type StoreApi, type UseBoundStore } from "zustand";
import { createCoreSlice, type CoreSlice } from "./core-slice";
import { pluginRegistry, type PluginRegistry } from "../plugin-system/registry";
import type {
  Plugin,
  PluginServices,
  WebSocketService,
  DOMObserverService,
} from "../plugin-system/types";

// ============================================================================
// Factory Options
// ============================================================================

/**
 * Options for creating a composed store instance.
 * Allows dependency injection for testing and customization.
 */
export interface ComposedStoreOptions {
  /** Custom WebSocket service implementation */
  websocket?: WebSocketService;
  /** Custom DOM observer service implementation */
  domObserver?: DOMObserverService;
  /** Custom plugin registry instance */
  registry?: PluginRegistry;
}

// ============================================================================
// Plugin Slice Types
// ============================================================================

// Import plugin slice types for type composition
import type { ESLintPluginSlice } from "../../plugins/eslint/slice";
import type { VisionSlice } from "../../plugins/vision/slice";
import type { SemanticPluginSlice } from "../../plugins/semantic/slice";

/**
 * Map of plugin IDs to their slice types.
 * Extend this interface when adding new plugins.
 */
export interface PluginSliceMap {
  eslint: ESLintPluginSlice;
  vision: VisionSlice;
  semantic: SemanticPluginSlice;
}

/**
 * Type for all possible plugin slices (union of all plugin slice types).
 */
export type AnyPluginSlice = PluginSliceMap[keyof PluginSliceMap];

/**
 * Namespace-prefixed plugin slices.
 * Each plugin's state is accessible via `plugins.{pluginId}`.
 */
export interface PluginSlices {
  plugins: {
    [K in keyof PluginSliceMap]?: PluginSliceMap[K];
  };
}

// ============================================================================
// Composed Store Type
// ============================================================================

/**
 * The composed store state combines:
 * 1. CoreSlice - Core UI state (floating icon, command palette, inspector, etc.)
 * 2. PluginSlices - Namespaced plugin state accessible via `plugins.{pluginId}`
 */
export type ComposedState = CoreSlice & PluginSlices;

/**
 * Actions for managing the composed store
 */
export interface ComposedStoreActions {
  /**
   * Register a plugin's slice into the store.
   * Called when a plugin is initialized with its createSlice method.
   *
   * @param pluginId - The unique plugin identifier
   * @param slice - The plugin's state slice
   */
  registerPluginSlice: <K extends keyof PluginSliceMap>(
    pluginId: K,
    slice: PluginSliceMap[K]
  ) => void;

  /**
   * Unregister a plugin's slice from the store.
   * Called when a plugin is disposed.
   *
   * @param pluginId - The unique plugin identifier
   */
  unregisterPluginSlice: (pluginId: keyof PluginSliceMap) => void;

  /**
   * Get a specific plugin's slice.
   * Returns undefined if the plugin is not registered.
   *
   * @param pluginId - The unique plugin identifier
   * @returns The plugin's slice or undefined
   */
  getPluginSlice: <K extends keyof PluginSliceMap>(
    pluginId: K
  ) => PluginSliceMap[K] | undefined;

  /**
   * Update a specific plugin's slice.
   * Merges the partial update with the existing slice.
   *
   * @param pluginId - The unique plugin identifier
   * @param partial - Partial update to merge into the slice
   */
  setPluginSlice: <K extends keyof PluginSliceMap>(
    pluginId: K,
    partial: Partial<PluginSliceMap[K]>
  ) => void;
}

/**
 * Full composed store type including state and actions
 */
export type ComposedStore = ComposedState & ComposedStoreActions;

// ============================================================================
// Store Instance
// ============================================================================

/**
 * Reference to the store instance.
 * Initialized lazily via createComposedStore().
 */
let storeInstance: UseBoundStore<StoreApi<ComposedStore>> | null = null;

/**
 * Plugin services instance for providing to plugins.
 * Created alongside the store.
 */
let pluginServicesInstance: PluginServices | null = null;

/**
 * Default WebSocket service stub.
 * In practice, this would be replaced with a real implementation.
 */
const createDefaultWebSocketService = (): WebSocketService => ({
  isConnected: false,
  url: "ws://localhost:9234",
  connect: () => {
    console.warn("[ComposedStore] WebSocket connect called but not implemented");
  },
  disconnect: () => {
    console.warn("[ComposedStore] WebSocket disconnect called but not implemented");
  },
  send: () => {
    console.warn("[ComposedStore] WebSocket send called but not implemented");
  },
  on: () => {
    console.warn("[ComposedStore] WebSocket on called but not implemented");
    return () => {};
  },
  onConnectionChange: () => {
    console.warn("[ComposedStore] WebSocket onConnectionChange called but not implemented");
    return () => {};
  },
});

/**
 * Default DOM observer service stub.
 * In practice, this would be replaced with a real implementation.
 */
const createDefaultDOMObserverService = (): DOMObserverService => ({
  start: () => {
    console.warn("[ComposedStore] DOMObserver start called but not implemented");
  },
  stop: () => {
    console.warn("[ComposedStore] DOMObserver stop called but not implemented");
  },
  onElementsAdded: () => {
    console.warn("[ComposedStore] DOMObserver onElementsAdded called but not implemented");
    return () => {};
  },
  onElementsRemoved: () => {
    console.warn("[ComposedStore] DOMObserver onElementsRemoved called but not implemented");
    return () => {};
  },
});

// ============================================================================
// Store Creation
// ============================================================================

/**
 * Internal result from creating a store with factory function.
 * Contains both the store and the plugin services for that store.
 */
interface StoreCreationResult {
  store: UseBoundStore<StoreApi<ComposedStore>>;
  services: PluginServices;
}

/**
 * Internal factory function that creates a new store instance.
 * Does NOT use singletons - creates a fresh store every time.
 * Used internally by both createComposedStore and createComposedStoreFactory.
 *
 * @param options - Configuration for the store
 * @returns The created store and plugin services
 */
function createStoreInternal(options: ComposedStoreOptions = {}): StoreCreationResult {
  // Create plugin services that the core slice and plugins will use
  const websocket = options.websocket ?? createDefaultWebSocketService();
  const domObserver = options.domObserver ?? createDefaultDOMObserverService();

  let services: PluginServices;

  // Create the store
  const store = create<ComposedStore>()((set, get) => {
    // Create plugin services that wrap the store's getState/setState
    services = {
      websocket: {
        get isConnected() {
          return websocket.isConnected;
        },
        get url() {
          return websocket.url;
        },
        connect: websocket.connect,
        disconnect: websocket.disconnect,
        send: websocket.send,
        on: websocket.on,
        onConnectionChange: websocket.onConnectionChange,
      },
      domObserver,
      getState: <T = unknown>() => {
        const state = get();
        return state as unknown as T;
      },
      setState: <T = unknown>(partial: Partial<T>) => {
        set(partial as Partial<ComposedStore>);
      },
      openInspector: (mode, data) => {
        const state = get();
        // Map to core slice's openInspector
        if (data.ruleId) {
          state.openInspector("rule", { ruleId: data.ruleId });
        } else if (data.elementId) {
          state.openInspector("element", { elementId: data.elementId });
        } else {
          // Generic inspector open
          set({
            inspector: {
              ...state.inspector,
              open: true,
              panelId: mode,
              data: data as Record<string, unknown>,
            },
          });
        }
      },
      closeCommandPalette: () => {
        get().closeCommandPalette();
      },
    };

    // Initialize the core slice with services
    const coreSliceCreator = createCoreSlice(services);
    const coreSlice = coreSliceCreator(set, get, {
      setState: set,
      getState: get,
      getInitialState: () => get(),
      subscribe: () => () => {},
    });

    return {
      // Core slice state and actions
      ...coreSlice,

      // Plugin slices namespace (empty initially)
      plugins: {},

      // Actions for managing plugin slices
      registerPluginSlice: <K extends keyof PluginSliceMap>(
        pluginId: K,
        slice: PluginSliceMap[K]
      ) => {
        console.log(`[ComposedStore] Registering plugin slice: ${String(pluginId)}`);
        set((state) => ({
          plugins: {
            ...state.plugins,
            [pluginId]: slice,
          },
        }));
      },

      unregisterPluginSlice: (pluginId: keyof PluginSliceMap) => {
        console.log(`[ComposedStore] Unregistering plugin slice: ${String(pluginId)}`);
        set((state) => {
          const { [pluginId]: removed, ...rest } = state.plugins;
          return { plugins: rest };
        });
      },

      getPluginSlice: <K extends keyof PluginSliceMap>(
        pluginId: K
      ): PluginSliceMap[K] | undefined => {
        return get().plugins[pluginId] as PluginSliceMap[K] | undefined;
      },

      setPluginSlice: <K extends keyof PluginSliceMap>(
        pluginId: K,
        partial: Partial<PluginSliceMap[K]>
      ) => {
        set((state) => {
          const existingSlice = state.plugins[pluginId];
          if (!existingSlice) {
            console.warn(
              `[ComposedStore] Cannot update unregistered plugin slice: ${String(pluginId)}`
            );
            return state;
          }

          return {
            plugins: {
              ...state.plugins,
              [pluginId]: {
                ...existingSlice,
                ...partial,
              },
            },
          };
        });
      },
    };
  });

  // services is definitely assigned after store creation
  return { store, services: services! };
}

/**
 * Factory function for creating isolated store instances.
 * Use this in tests to get fresh stores with injected dependencies.
 *
 * Unlike createComposedStore(), this does NOT use a singleton pattern.
 * Each call creates a completely new, isolated store instance.
 *
 * @param options - Dependencies and configuration for the store
 * @returns A new store instance (not a singleton)
 *
 * @example
 * ```typescript
 * // In tests
 * const mockWebSocket = createMockWebSocketService();
 * const mockDomObserver = createMockDOMObserverService();
 * const testRegistry = createPluginRegistry();
 *
 * const store = createComposedStoreFactory({
 *   websocket: mockWebSocket,
 *   domObserver: mockDomObserver,
 *   registry: testRegistry,
 * });
 *
 * // Each test gets its own isolated store
 * expect(store.getState().commandPalette.open).toBe(false);
 * ```
 */
export function createComposedStoreFactory(
  options: ComposedStoreOptions = {}
): UseBoundStore<StoreApi<ComposedStore>> {
  const { store } = createStoreInternal(options);
  return store;
}

/**
 * Create the composed store with core slice and plugin support.
 * Uses a singleton pattern - returns the same instance if already created.
 *
 * For testing, use createComposedStoreFactory() instead which creates
 * isolated instances.
 *
 * @param options - Optional configuration for the store
 * @returns The singleton store instance
 */
export function createComposedStore(
  options?: ComposedStoreOptions
): UseBoundStore<StoreApi<ComposedStore>> {
  // Return existing instance if already created
  if (storeInstance) {
    return storeInstance;
  }

  // Create new store and services
  const result = createStoreInternal(options);
  storeInstance = result.store;
  pluginServicesInstance = result.services;

  return storeInstance;
}

// ============================================================================
// Store Hook
// ============================================================================

/**
 * Hook to access the composed store.
 * This is the primary way components should access the store.
 *
 * If the store hasn't been created yet, it will be created with default options.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   // Access core state
 *   const isOpen = useComposedStore((state) => state.commandPalette.open);
 *
 *   // Access plugin state
 *   const eslintSlice = useComposedStore((state) => state.plugins.eslint);
 *
 *   return <div>...</div>;
 * }
 * ```
 */
export function useComposedStore(): ComposedStore;
export function useComposedStore<T>(selector: (state: ComposedStore) => T): T;
export function useComposedStore<T>(selector?: (state: ComposedStore) => T) {
  // Ensure the store is created
  if (!storeInstance) {
    createComposedStore();
  }

  // Use the store with optional selector
  if (selector) {
    return storeInstance!(selector);
  }
  return storeInstance!();
}

// ============================================================================
// Plugin Integration
// ============================================================================

/**
 * Initialize all registered plugins and merge their slices into the store.
 * This should be called after the store is created and before rendering.
 *
 * @param options - Optional configuration for services and registry
 * @returns Promise that resolves when all plugins are initialized
 */
export async function initializePlugins(
  options?: ComposedStoreOptions
): Promise<void> {
  // Ensure the store is created with the provided services
  const store = createComposedStore(options);

  // Get the plugin services
  if (!pluginServicesInstance) {
    throw new Error("[ComposedStore] Plugin services not initialized");
  }

  // Use provided registry or default singleton
  const registry = options?.registry ?? pluginRegistry;

  // Initialize all registered plugins
  await registry.initializeAll(pluginServicesInstance);

  // Collect slices from plugins that have createSlice
  const plugins = registry.getPlugins();

  for (const plugin of plugins) {
    if (plugin.createSlice && plugin.id) {
      try {
        const slice = plugin.createSlice(pluginServicesInstance);

        // Register the slice in the store
        // We need to cast here since not all plugin IDs are in PluginSliceMap
        if (plugin.id in ({} as PluginSliceMap)) {
          store.getState().registerPluginSlice(
            plugin.id as keyof PluginSliceMap,
            slice as PluginSliceMap[keyof PluginSliceMap]
          );
        } else {
          // For unknown plugins, still register them but without strict typing
          console.log(
            `[ComposedStore] Registering unknown plugin slice: ${plugin.id}`
          );
          store.setState((state) => ({
            plugins: {
              ...state.plugins,
              [plugin.id]: slice,
            },
          }));
        }
      } catch (error) {
        console.error(
          `[ComposedStore] Failed to create slice for plugin ${plugin.id}:`,
          error
        );
      }
    }
  }

  console.log(
    `[ComposedStore] Initialized ${plugins.length} plugins with slices`
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get the raw store API for advanced use cases.
 * Prefer using useComposedStore hook in React components.
 *
 * @returns The store API or null if not created
 */
export function getStoreApi(): StoreApi<ComposedStore> | null {
  return storeInstance ?? null;
}

/**
 * Get the plugin services instance.
 * Useful for plugins that need to access services outside of React.
 *
 * @returns The plugin services or null if not created
 */
export function getPluginServices(): PluginServices | null {
  return pluginServicesInstance;
}

/**
 * Reset the store instance.
 * Primarily useful for testing.
 *
 * @param options - Optional configuration to immediately create a new store with
 * @returns The new store instance if options were provided, undefined otherwise
 *
 * @example
 * ```typescript
 * // Simple reset
 * resetStore();
 *
 * // Reset and immediately create new store with mocks
 * const store = resetStore({
 *   websocket: mockWebSocket,
 *   domObserver: mockDomObserver,
 * });
 * ```
 */
export function resetStore(
  options?: ComposedStoreOptions
): UseBoundStore<StoreApi<ComposedStore>> | void {
  // Zustand stores don't have a destroy method, just clear the reference
  storeInstance = null;
  pluginServicesInstance = null;

  // If options provided, immediately create a new store
  if (options) {
    return createComposedStore(options);
  }
}

// ============================================================================
// Type Guards & Utilities
// ============================================================================

/**
 * Check if a plugin slice is registered in the store.
 *
 * @param pluginId - The plugin ID to check
 * @returns true if the plugin slice is registered
 */
export function hasPluginSlice(pluginId: string): boolean {
  if (!storeInstance) return false;
  return pluginId in storeInstance.getState().plugins;
}

/**
 * Get typed plugin slice with proper type inference.
 *
 * @param pluginId - The plugin ID
 * @returns The plugin slice or undefined
 */
export function getPluginSlice<K extends keyof PluginSliceMap>(
  pluginId: K
): PluginSliceMap[K] | undefined {
  if (!storeInstance) return undefined;
  return storeInstance.getState().plugins[pluginId] as PluginSliceMap[K] | undefined;
}

/**
 * Create typed plugin services for a specific plugin.
 * This provides getState/setState scoped to the plugin's slice.
 *
 * @param pluginId - The plugin ID
 * @returns Scoped plugin services
 */
export function createScopedPluginServices<K extends keyof PluginSliceMap>(
  pluginId: K
): PluginServices | null {
  if (!pluginServicesInstance || !storeInstance) return null;

  return {
    ...pluginServicesInstance,
    getState: <T = PluginSliceMap[K]>() => {
      const slice = storeInstance!.getState().plugins[pluginId];
      return slice as unknown as T;
    },
    setState: <T = PluginSliceMap[K]>(partial: Partial<T>) => {
      storeInstance!.getState().setPluginSlice(pluginId, partial as Partial<PluginSliceMap[K]>);
    },
  };
}

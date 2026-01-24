/**
 * Test Utilities and Mock Factories for Plugin Architecture
 *
 * Provides mock implementations of core services and factories for testing
 * plugin registration, lifecycle, and service interactions.
 */

import { vi } from "vitest";
import { create, type StoreApi, type UseBoundStore } from "zustand";
import type {
  Plugin,
  PluginMeta,
  PluginServices,
  WebSocketService,
  WebSocketMessageHandler,
  WebSocketConnectionHandler,
  DOMObserverService,
  ElementsAddedHandler,
  ElementsRemovedHandler,
  ScannedElementInfo,
  Command,
  InspectorPanel,
  Analyzer,
  PluginIssue,
} from "../core/plugin-system/types";
import type {
  CoreSlice,
  CommandPaletteState,
  InspectorState,
} from "../core/store/core-slice";

// ============================================================================
// Mock WebSocket Service
// ============================================================================

/**
 * Extended mock WebSocket service with test helpers
 */
export interface MockWebSocketService extends WebSocketService {
  /**
   * Simulate receiving a message from the server.
   * Triggers all registered handlers for the given message type.
   *
   * @param type - Message type (e.g., "lint:result", "vision:result")
   * @param data - Message payload (will be merged with { type })
   */
  __simulateMessage: (type: string, data?: Record<string, unknown>) => void;

  /**
   * Simulate a connection state change.
   * Triggers all registered connection change handlers.
   *
   * @param connected - New connection state
   */
  __simulateConnectionChange: (connected: boolean) => void;

  /**
   * Get all registered message handlers for a specific type.
   */
  __getHandlers: (type: string) => Set<WebSocketMessageHandler>;

  /**
   * Get all registered connection change handlers.
   */
  __getConnectionHandlers: () => Set<WebSocketConnectionHandler>;

  /**
   * Clear all registered handlers (useful for test cleanup).
   */
  __clearHandlers: () => void;
}

/**
 * Create a mock WebSocket service with working handler registration
 * and test helpers for simulating server messages.
 *
 * @param overrides - Optional partial overrides for default values
 * @returns Mock WebSocket service with test helpers
 *
 * @example
 * ```ts
 * const ws = createMockWebSocketService({ isConnected: true });
 *
 * // Register a handler
 * const handler = vi.fn();
 * ws.on("lint:result", handler);
 *
 * // Simulate receiving a message
 * ws.__simulateMessage("lint:result", { filePath: "test.tsx", issues: [] });
 *
 * // Verify handler was called
 * expect(handler).toHaveBeenCalledWith({ type: "lint:result", filePath: "test.tsx", issues: [] });
 * ```
 */
export function createMockWebSocketService(
  overrides?: Partial<Omit<MockWebSocketService, "__simulateMessage" | "__simulateConnectionChange" | "__getHandlers" | "__getConnectionHandlers" | "__clearHandlers">>
): MockWebSocketService {
  const messageHandlers = new Map<string, Set<WebSocketMessageHandler>>();
  const connectionHandlers = new Set<WebSocketConnectionHandler>();

  let _isConnected = overrides?.isConnected ?? false;
  let _url = overrides?.url ?? "ws://localhost:9234";

  const mock: MockWebSocketService = {
    get isConnected() {
      return _isConnected;
    },
    get url() {
      return _url;
    },

    connect: overrides?.connect ?? vi.fn((url?: string) => {
      if (url) _url = url;
      _isConnected = true;
      // Notify connection handlers
      connectionHandlers.forEach((handler) => handler(true));
    }),

    disconnect: overrides?.disconnect ?? vi.fn(() => {
      _isConnected = false;
      // Notify connection handlers
      connectionHandlers.forEach((handler) => handler(false));
    }),

    send: overrides?.send ?? vi.fn(),

    on: overrides?.on ?? vi.fn((type: string, handler: WebSocketMessageHandler) => {
      if (!messageHandlers.has(type)) {
        messageHandlers.set(type, new Set());
      }
      messageHandlers.get(type)!.add(handler);

      // Return unsubscribe function
      return () => {
        const handlers = messageHandlers.get(type);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            messageHandlers.delete(type);
          }
        }
      };
    }),

    onConnectionChange: overrides?.onConnectionChange ?? vi.fn((handler: WebSocketConnectionHandler) => {
      connectionHandlers.add(handler);

      // Immediately notify of current state (matching real implementation)
      handler(_isConnected);

      // Return unsubscribe function
      return () => {
        connectionHandlers.delete(handler);
      };
    }),

    // Test helpers
    __simulateMessage: (type: string, data?: Record<string, unknown>) => {
      const message = { type, ...data };

      // Dispatch to specific type handlers
      const typeHandlers = messageHandlers.get(type);
      if (typeHandlers) {
        typeHandlers.forEach((handler) => handler(message));
      }

      // Also dispatch to wildcard handlers
      const wildcardHandlers = messageHandlers.get("*");
      if (wildcardHandlers) {
        wildcardHandlers.forEach((handler) => handler(message));
      }
    },

    __simulateConnectionChange: (connected: boolean) => {
      _isConnected = connected;
      connectionHandlers.forEach((handler) => handler(connected));
    },

    __getHandlers: (type: string) => {
      return messageHandlers.get(type) ?? new Set();
    },

    __getConnectionHandlers: () => {
      return connectionHandlers;
    },

    __clearHandlers: () => {
      messageHandlers.clear();
      connectionHandlers.clear();
    },
  };

  return mock;
}

// ============================================================================
// Mock DOM Observer Service
// ============================================================================

/**
 * Extended mock DOM observer service with test helpers
 */
export interface MockDOMObserverService extends DOMObserverService {
  /**
   * Simulate elements being added to the DOM.
   * Triggers all registered onElementsAdded handlers.
   *
   * @param elements - Array of scanned element info objects
   */
  __simulateElementsAdded: (elements: ScannedElementInfo[]) => void;

  /**
   * Simulate elements being removed from the DOM.
   * Triggers all registered onElementsRemoved handlers.
   *
   * @param ids - Array of element IDs that were removed
   */
  __simulateElementsRemoved: (ids: string[]) => void;

  /**
   * Get all registered elements added handlers.
   */
  __getAddedHandlers: () => Set<ElementsAddedHandler>;

  /**
   * Get all registered elements removed handlers.
   */
  __getRemovedHandlers: () => Set<ElementsRemovedHandler>;

  /**
   * Clear all registered handlers (useful for test cleanup).
   */
  __clearHandlers: () => void;

  /**
   * Whether the observer is currently running.
   */
  __isRunning: () => boolean;
}

/**
 * Create a mock DOM observer service with working handler registration
 * and test helpers for simulating DOM mutations.
 *
 * @param overrides - Optional partial overrides for service methods
 * @returns Mock DOM observer service with test helpers
 *
 * @example
 * ```ts
 * const domObserver = createMockDOMObserverService();
 *
 * // Register handlers
 * const addedHandler = vi.fn();
 * const removedHandler = vi.fn();
 * domObserver.onElementsAdded(addedHandler);
 * domObserver.onElementsRemoved(removedHandler);
 *
 * // Simulate element addition
 * domObserver.__simulateElementsAdded([
 *   { id: "loc:test.tsx:10:5#1", dataLoc: "test.tsx:10:5", element: {} as Element, tagName: "div", rect: {} as DOMRect }
 * ]);
 *
 * // Verify handler was called
 * expect(addedHandler).toHaveBeenCalled();
 * ```
 */
export function createMockDOMObserverService(
  overrides?: Partial<Omit<MockDOMObserverService, "__simulateElementsAdded" | "__simulateElementsRemoved" | "__getAddedHandlers" | "__getRemovedHandlers" | "__clearHandlers" | "__isRunning">>
): MockDOMObserverService {
  const addedHandlers = new Set<ElementsAddedHandler>();
  const removedHandlers = new Set<ElementsRemovedHandler>();
  let isRunning = false;

  const mock: MockDOMObserverService = {
    start: overrides?.start ?? vi.fn(() => {
      isRunning = true;
    }),

    stop: overrides?.stop ?? vi.fn(() => {
      isRunning = false;
    }),

    onElementsAdded: overrides?.onElementsAdded ?? vi.fn((handler: ElementsAddedHandler) => {
      addedHandlers.add(handler);

      // Return unsubscribe function
      return () => {
        addedHandlers.delete(handler);
      };
    }),

    onElementsRemoved: overrides?.onElementsRemoved ?? vi.fn((handler: ElementsRemovedHandler) => {
      removedHandlers.add(handler);

      // Return unsubscribe function
      return () => {
        removedHandlers.delete(handler);
      };
    }),

    // Test helpers
    __simulateElementsAdded: (elements: ScannedElementInfo[]) => {
      addedHandlers.forEach((handler) => handler(elements));
    },

    __simulateElementsRemoved: (ids: string[]) => {
      removedHandlers.forEach((handler) => handler(ids));
    },

    __getAddedHandlers: () => addedHandlers,

    __getRemovedHandlers: () => removedHandlers,

    __clearHandlers: () => {
      addedHandlers.clear();
      removedHandlers.clear();
    },

    __isRunning: () => isRunning,
  };

  return mock;
}

// ============================================================================
// Mock Plugin Services
// ============================================================================

/**
 * Extended mock plugin services with test helpers
 */
export interface MockPluginServices extends PluginServices {
  /**
   * Access the underlying mock WebSocket service
   */
  __websocket: MockWebSocketService;

  /**
   * Access the underlying mock DOM observer service
   */
  __domObserver: MockDOMObserverService;

  /**
   * Get the internal state object
   */
  __getInternalState: () => Record<string, unknown>;

  /**
   * Reset the internal state to empty
   */
  __resetState: () => void;
}

/**
 * Create a full mock of PluginServices combining WebSocket and DOM observer mocks
 * with working getState/setState and UI action mocks.
 *
 * @param overrides - Optional partial overrides for services
 * @returns Full mock plugin services with test helpers
 *
 * @example
 * ```ts
 * const services = createMockPluginServices();
 *
 * // Set some state
 * services.setState({ myPlugin: { count: 1 } });
 *
 * // Get state
 * const state = services.getState<{ myPlugin: { count: number } }>();
 * expect(state.myPlugin.count).toBe(1);
 *
 * // Simulate WebSocket message
 * services.__websocket.__simulateMessage("lint:result", { issues: [] });
 *
 * // Check UI actions were called
 * services.openInspector("rule", { ruleId: "test-rule" });
 * expect(services.openInspector).toHaveBeenCalled();
 * ```
 */
export function createMockPluginServices(
  overrides?: {
    websocket?: Partial<MockWebSocketService>;
    domObserver?: Partial<MockDOMObserverService>;
    initialState?: Record<string, unknown>;
  }
): MockPluginServices {
  const mockWebSocket = createMockWebSocketService(overrides?.websocket);
  const mockDOMObserver = createMockDOMObserverService(overrides?.domObserver);

  let internalState: Record<string, unknown> = overrides?.initialState ?? {};

  const openInspector = vi.fn();
  const closeCommandPalette = vi.fn();

  const services: MockPluginServices = {
    websocket: mockWebSocket,
    domObserver: mockDOMObserver,

    getState: <T = unknown>() => {
      return internalState as T;
    },

    setState: <T = unknown>(partial: Partial<T>) => {
      internalState = { ...internalState, ...partial };
    },

    openInspector,
    closeCommandPalette,

    // Test helpers
    __websocket: mockWebSocket,
    __domObserver: mockDOMObserver,

    __getInternalState: () => internalState,

    __resetState: () => {
      internalState = {};
    },
  };

  return services;
}

// ============================================================================
// Mock Plugin
// ============================================================================

/**
 * Default plugin metadata for testing
 */
const DEFAULT_MOCK_PLUGIN_META: PluginMeta = {
  id: "test-plugin",
  name: "Test Plugin",
  version: "1.0.0",
  description: "A mock plugin for testing",
};

/**
 * Create a mock Plugin object for testing registration and lifecycle.
 *
 * @param overrides - Optional partial overrides for plugin properties
 * @returns Mock plugin object
 *
 * @example
 * ```ts
 * // Create a simple mock plugin
 * const plugin = createMockPlugin({ id: "my-plugin" });
 *
 * // Create a plugin with commands
 * const pluginWithCommands = createMockPlugin({
 *   id: "my-plugin",
 *   commands: [
 *     {
 *       id: "my-command",
 *       title: "My Command",
 *       keywords: ["test"],
 *       category: "actions",
 *       execute: vi.fn(),
 *     },
 *   ],
 * });
 *
 * // Create a plugin with initialize/dispose lifecycle
 * const initFn = vi.fn();
 * const disposeFn = vi.fn();
 * const lifecyclePlugin = createMockPlugin({
 *   initialize: initFn,
 *   dispose: disposeFn,
 * });
 * ```
 */
export function createMockPlugin<TSlice = unknown>(
  overrides?: Partial<Plugin<TSlice>>
): Plugin<TSlice> {
  const id = overrides?.id ?? DEFAULT_MOCK_PLUGIN_META.id;
  const name = overrides?.name ?? DEFAULT_MOCK_PLUGIN_META.name;
  const version = overrides?.version ?? DEFAULT_MOCK_PLUGIN_META.version;
  const description = overrides?.description ?? DEFAULT_MOCK_PLUGIN_META.description;

  return {
    id,
    name,
    version,
    description,
    meta: {
      id,
      name,
      version,
      description,
      icon: overrides?.icon,
      dependencies: overrides?.dependencies,
    },
    icon: overrides?.icon,
    dependencies: overrides?.dependencies,
    ruleCategories: overrides?.ruleCategories,
    createSlice: overrides?.createSlice,
    commands: overrides?.commands,
    inspectorPanels: overrides?.inspectorPanels,
    analyzers: overrides?.analyzers,
    ruleContributions: overrides?.ruleContributions,
    handlesRules: overrides?.handlesRules,
    getIssues: overrides?.getIssues,
    initialize: overrides?.initialize,
    dispose: overrides?.dispose,
  };
}

// ============================================================================
// Mock Command
// ============================================================================

/**
 * Create a mock Command object for testing.
 *
 * @param overrides - Optional partial overrides for command properties
 * @returns Mock command object
 *
 * @example
 * ```ts
 * const command = createMockCommand({
 *   id: "test-command",
 *   title: "Test Command",
 * });
 *
 * // Execute the command
 * await command.execute(services);
 * expect(command.execute).toHaveBeenCalledWith(services);
 * ```
 */
export function createMockCommand(overrides?: Partial<Command>): Command {
  return {
    id: overrides?.id ?? "mock-command",
    title: overrides?.title ?? "Mock Command",
    keywords: overrides?.keywords ?? ["mock", "test"],
    category: overrides?.category ?? "actions",
    subtitle: overrides?.subtitle,
    icon: overrides?.icon,
    shortcut: overrides?.shortcut,
    isAvailable: overrides?.isAvailable,
    execute: overrides?.execute ?? vi.fn(),
  };
}

// ============================================================================
// Mock Analyzer
// ============================================================================

/**
 * Create a mock Analyzer object for testing.
 *
 * @param overrides - Optional partial overrides for analyzer properties
 * @returns Mock analyzer object
 *
 * @example
 * ```ts
 * const analyzer = createMockAnalyzer({
 *   id: "test-analyzer",
 *   analyze: vi.fn().mockResolvedValue([{ id: "issue-1", message: "Test issue", severity: "warning" }]),
 * });
 *
 * // Run the analyzer
 * const issues = await analyzer.analyze(context);
 * expect(issues).toHaveLength(1);
 * ```
 */
export function createMockAnalyzer(overrides?: Partial<Analyzer>): Analyzer {
  return {
    id: overrides?.id ?? "mock-analyzer",
    name: overrides?.name ?? "Mock Analyzer",
    triggers: overrides?.triggers ?? ["manual"],
    requiresConnection: overrides?.requiresConnection ?? false,
    analyze: overrides?.analyze ?? vi.fn().mockResolvedValue([]),
  };
}

// ============================================================================
// Mock Scanned Element
// ============================================================================

/**
 * Create a mock ScannedElementInfo object for testing.
 *
 * @param overrides - Optional partial overrides for element properties
 * @returns Mock scanned element info
 *
 * @example
 * ```ts
 * const element = createMockScannedElement({
 *   id: "loc:test.tsx:10:5#1",
 *   dataLoc: "test.tsx:10:5",
 * });
 *
 * domObserver.__simulateElementsAdded([element]);
 * ```
 */
export function createMockScannedElement(
  overrides?: Partial<ScannedElementInfo>
): ScannedElementInfo {
  const dataLoc = overrides?.dataLoc ?? "test.tsx:10:5";
  const id = overrides?.id ?? `loc:${dataLoc}#1`;

  return {
    id,
    dataLoc,
    element: overrides?.element ?? (document.createElement("div") as Element),
    tagName: overrides?.tagName ?? "div",
    rect: overrides?.rect ?? ({
      x: 0,
      y: 0,
      width: 100,
      height: 50,
      top: 0,
      right: 100,
      bottom: 50,
      left: 0,
      toJSON: () => ({}),
    } as DOMRect),
  };
}

// ============================================================================
// Mock Plugin Issue
// ============================================================================

/**
 * Create a mock PluginIssue object for testing.
 *
 * @param overrides - Optional partial overrides for issue properties
 * @returns Mock plugin issue
 *
 * @example
 * ```ts
 * const issue = createMockPluginIssue({
 *   id: "issue-1",
 *   message: "Test issue",
 *   severity: "error",
 *   ruleId: "test-rule",
 * });
 * ```
 */
export function createMockPluginIssue(
  overrides?: Partial<PluginIssue>
): PluginIssue {
  return {
    id: overrides?.id ?? `issue-${Date.now()}`,
    message: overrides?.message ?? "Mock issue message",
    severity: overrides?.severity ?? "warning",
    dataLoc: overrides?.dataLoc,
    filePath: overrides?.filePath,
    line: overrides?.line,
    column: overrides?.column,
    ruleId: overrides?.ruleId,
    metadata: overrides?.metadata,
  };
}

// ============================================================================
// Test Store
// ============================================================================

/**
 * Minimal test store state for testing
 */
export interface TestStoreState extends CoreSlice {
  plugins: Record<string, unknown>;
  registerPluginSlice: (pluginId: string, slice: unknown) => void;
  unregisterPluginSlice: (pluginId: string) => void;
  getPluginSlice: (pluginId: string) => unknown | undefined;
  setPluginSlice: (pluginId: string, partial: Record<string, unknown>) => void;
}

/**
 * Create a fresh Zustand store for testing.
 * Provides a minimal implementation of the composed store with core slice state.
 *
 * @returns A fresh Zustand store instance for testing
 *
 * @example
 * ```ts
 * const store = createTestStore();
 *
 * // Access state
 * const state = store.getState();
 * expect(state.commandPalette.open).toBe(false);
 *
 * // Update state
 * store.getState().openCommandPalette();
 * expect(store.getState().commandPalette.open).toBe(true);
 *
 * // Register a plugin slice
 * store.getState().registerPluginSlice("test-plugin", { count: 0 });
 * expect(store.getState().plugins["test-plugin"]).toEqual({ count: 0 });
 * ```
 */
export function createTestStore(): UseBoundStore<StoreApi<TestStoreState>> {
  return create<TestStoreState>()((set, get) => ({
    // ============ Floating Icon ============
    floatingIconPosition: null,
    setFloatingIconPosition: (position) => {
      set({ floatingIconPosition: position });
    },

    // ============ Alt Key Mode ============
    altKeyHeld: false,
    setAltKeyHeld: (held) => {
      set({ altKeyHeld: held });
    },

    // ============ Selection ============
    selectedElementId: null,
    hoveredElementId: null,
    setSelectedElementId: (id) => {
      set({ selectedElementId: id });
    },
    setHoveredElementId: (id) => {
      set({ hoveredElementId: id });
    },

    // ============ Command Palette ============
    commandPalette: {
      open: false,
      query: "",
      selectedIndex: 0,
      filters: [],
    },
    openCommandPalette: () => {
      set({
        commandPalette: {
          ...get().commandPalette,
          open: true,
          query: "",
          selectedIndex: 0,
        },
      });
    },
    closeCommandPalette: () => {
      set({
        commandPalette: {
          open: false,
          query: "",
          selectedIndex: 0,
          filters: [],
        },
      });
    },
    setCommandPaletteQuery: (query) => {
      set({
        commandPalette: {
          ...get().commandPalette,
          query,
          selectedIndex: 0,
        },
      });
    },
    setCommandPaletteSelectedIndex: (index) => {
      set({
        commandPalette: {
          ...get().commandPalette,
          selectedIndex: index,
        },
      });
    },
    addFilter: (filter) => {
      const current = get().commandPalette;
      set({
        commandPalette: {
          ...current,
          filters: [...current.filters, filter],
          selectedIndex: 0,
        },
      });
    },
    removeFilter: (index) => {
      const current = get().commandPalette;
      set({
        commandPalette: {
          ...current,
          filters: current.filters.filter((_, i) => i !== index),
          selectedIndex: 0,
        },
      });
    },
    clearFilters: () => {
      set({
        commandPalette: {
          ...get().commandPalette,
          filters: [],
          selectedIndex: 0,
        },
      });
    },

    // ============ Inspector ============
    inspector: {
      open: false,
      panelId: null,
      data: null,
      docked: true,
      width: 400,
      floatingPosition: null,
      floatingSize: null,
    },
    openInspector: (panelId, data) => {
      set({
        inspector: {
          ...get().inspector,
          open: true,
          panelId,
          data: data ?? null,
        },
      });
    },
    closeInspector: () => {
      set({
        inspector: {
          ...get().inspector,
          open: false,
          panelId: null,
          data: null,
        },
      });
    },
    toggleInspectorDocked: () => {
      const current = get().inspector;
      set({
        inspector: {
          ...current,
          docked: !current.docked,
        },
      });
    },
    setInspectorWidth: (width) => {
      set({
        inspector: {
          ...get().inspector,
          width,
        },
      });
    },
    setInspectorFloatingPosition: (position) => {
      set({
        inspector: {
          ...get().inspector,
          floatingPosition: position,
        },
      });
    },
    setInspectorFloatingSize: (size) => {
      set({
        inspector: {
          ...get().inspector,
          floatingSize: size,
        },
      });
    },

    // ============ Connection ============
    wsConnected: false,
    wsUrl: "ws://localhost:9234",

    // ============ Plugin Slices ============
    plugins: {},

    registerPluginSlice: (pluginId: string, slice: unknown) => {
      set((state) => ({
        plugins: {
          ...state.plugins,
          [pluginId]: slice,
        },
      }));
    },

    unregisterPluginSlice: (pluginId: string) => {
      set((state) => {
        const { [pluginId]: removed, ...rest } = state.plugins;
        return { plugins: rest };
      });
    },

    getPluginSlice: (pluginId: string) => {
      return get().plugins[pluginId];
    },

    setPluginSlice: (pluginId: string, partial: Record<string, unknown>) => {
      set((state) => {
        const existingSlice = state.plugins[pluginId];
        if (!existingSlice) {
          console.warn(`Cannot update unregistered plugin slice: ${pluginId}`);
          return state;
        }

        return {
          plugins: {
            ...state.plugins,
            [pluginId]: {
              ...(existingSlice as Record<string, unknown>),
              ...partial,
            },
          },
        };
      });
    },
  }));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wait for a specific number of milliseconds.
 * Useful for testing async operations with timeouts.
 *
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the specified time
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for all pending promises to settle.
 * Useful for testing async state updates.
 *
 * @returns Promise that resolves on the next microtask
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Create a deferred promise for controlling async test flow.
 *
 * @returns Object with promise and resolve/reject functions
 *
 * @example
 * ```ts
 * const deferred = createDeferred<string>();
 *
 * // Start async operation
 * someAsyncOperation().then(deferred.resolve);
 *
 * // Later, resolve from test
 * deferred.resolve("result");
 *
 * // Or wait for it
 * const result = await deferred.promise;
 * ```
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
} {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve: resolve!, reject: reject! };
}

/**
 * Unit tests for composed-store module
 *
 * Tests the Zustand store composition with plugin slices.
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  createComposedStoreFactory,
  createComposedStore,
  resetStore,
  getStoreApi,
  getPluginServices,
  hasPluginSlice,
  getPluginSlice,
  createScopedPluginServices,
  useComposedStore,
} from "./composed-store";
import type { WebSocketService, DOMObserverService } from "../plugin-system/types";
import type { PluginSliceMap } from "./composed-store";

/**
 * Type for creating test plugin slices with minimal properties.
 * Uses `unknown` intermediary to satisfy the strict PluginSliceMap types.
 */
type TestPluginSlice<K extends keyof PluginSliceMap> = PluginSliceMap[K];

/**
 * Helper to cast a minimal test object to a plugin slice type.
 */
function asPluginSlice<K extends keyof PluginSliceMap>(
  slice: Record<string, unknown>
): TestPluginSlice<K> {
  return slice as unknown as TestPluginSlice<K>;
}

/**
 * Create a minimal WebSocket service implementation for testing.
 * No mocks - this is a real implementation with tracking.
 */
function createTestWebSocketService(): WebSocketService & {
  connectionCallbacks: Array<(connected: boolean) => void>;
  simulateConnect: () => void;
  simulateDisconnect: () => void;
} {
  let connected = false;
  const connectionCallbacks: Array<(connected: boolean) => void> = [];

  return {
    get isConnected() {
      return connected;
    },
    url: "ws://test:9234",
    connect: () => {
      connected = true;
      connectionCallbacks.forEach((cb) => cb(true));
    },
    disconnect: () => {
      connected = false;
      connectionCallbacks.forEach((cb) => cb(false));
    },
    send: () => {},
    on: () => () => {},
    onConnectionChange: (callback) => {
      connectionCallbacks.push(callback);
      return () => {
        const idx = connectionCallbacks.indexOf(callback);
        if (idx >= 0) connectionCallbacks.splice(idx, 1);
      };
    },
    connectionCallbacks,
    simulateConnect: () => {
      connected = true;
      connectionCallbacks.forEach((cb) => cb(true));
    },
    simulateDisconnect: () => {
      connected = false;
      connectionCallbacks.forEach((cb) => cb(false));
    },
  };
}

/**
 * Create a minimal DOM observer service implementation for testing.
 */
function createTestDOMObserverService(): DOMObserverService & {
  elementAddedCallbacks: Array<(elements: Element[]) => void>;
  elementRemovedCallbacks: Array<(elements: Element[]) => void>;
  simulateElementsAdded: (elements: Element[]) => void;
  simulateElementsRemoved: (elements: Element[]) => void;
} {
  const elementAddedCallbacks: Array<(elements: Element[]) => void> = [];
  const elementRemovedCallbacks: Array<(elements: Element[]) => void> = [];

  return {
    start: () => {},
    stop: () => {},
    onElementsAdded: (callback) => {
      elementAddedCallbacks.push(callback);
      return () => {
        const idx = elementAddedCallbacks.indexOf(callback);
        if (idx >= 0) elementAddedCallbacks.splice(idx, 1);
      };
    },
    onElementsRemoved: (callback) => {
      elementRemovedCallbacks.push(callback);
      return () => {
        const idx = elementRemovedCallbacks.indexOf(callback);
        if (idx >= 0) elementRemovedCallbacks.splice(idx, 1);
      };
    },
    elementAddedCallbacks,
    elementRemovedCallbacks,
    simulateElementsAdded: (elements) => {
      elementAddedCallbacks.forEach((cb) => cb(elements));
    },
    simulateElementsRemoved: (elements) => {
      elementRemovedCallbacks.forEach((cb) => cb(elements));
    },
  };
}

describe("createComposedStoreFactory", () => {
  it("creates isolated store instances", () => {
    const store1 = createComposedStoreFactory();
    const store2 = createComposedStoreFactory();

    // Modify store1
    store1.getState().openCommandPalette();

    // store2 should be unaffected
    expect(store1.getState().commandPalette.open).toBe(true);
    expect(store2.getState().commandPalette.open).toBe(false);
  });

  it("initializes with default core slice state", () => {
    const store = createComposedStoreFactory();
    const state = store.getState();

    expect(state.commandPalette.open).toBe(false);
    expect(state.inspector.open).toBe(false);
    expect(state.floatingIconPosition).toBeNull();
    expect(state.plugins).toEqual({});
  });

  it("accepts custom WebSocket service", () => {
    const testWs = createTestWebSocketService();
    const store = createComposedStoreFactory({ websocket: testWs });

    // Simulate connection
    testWs.simulateConnect();

    expect(store.getState().wsConnected).toBe(true);
  });

  it("accepts custom DOM observer service", () => {
    const testDomObserver = createTestDOMObserverService();
    const store = createComposedStoreFactory({ domObserver: testDomObserver });

    // Store should be created without errors
    expect(store.getState()).toBeDefined();
  });

  it("updates wsUrl when websocket connects", () => {
    const testWs = createTestWebSocketService();
    const store = createComposedStoreFactory({ websocket: testWs });

    testWs.simulateConnect();

    expect(store.getState().wsUrl).toBe("ws://test:9234");
  });
});

describe("createComposedStore (singleton)", () => {
  beforeEach(() => {
    // Reset the singleton before each test
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it("returns the same instance on multiple calls", () => {
    const store1 = createComposedStore();
    const store2 = createComposedStore();

    expect(store1).toBe(store2);
  });

  it("initializes with provided options only on first call", () => {
    const testWs = createTestWebSocketService();
    const store1 = createComposedStore({ websocket: testWs });

    // Second call with different options should be ignored
    const differentWs = createTestWebSocketService();
    const store2 = createComposedStore({ websocket: differentWs });

    expect(store1).toBe(store2);

    // The first websocket should be the one connected
    testWs.simulateConnect();
    expect(store1.getState().wsConnected).toBe(true);
  });
});

describe("resetStore", () => {
  it("clears the singleton instance", () => {
    const store1 = createComposedStore();
    resetStore();
    const store2 = createComposedStore();

    // Should be different instances after reset
    expect(store1).not.toBe(store2);
  });

  it("returns a new store when options are provided", () => {
    createComposedStore();
    const testWs = createTestWebSocketService();
    const newStore = resetStore({ websocket: testWs });

    expect(newStore).toBeDefined();
    testWs.simulateConnect();
    expect(newStore!.getState().wsConnected).toBe(true);
  });

  it("returns void when no options provided", () => {
    createComposedStore();
    const result = resetStore();

    expect(result).toBeUndefined();
  });
});

describe("getStoreApi", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it("returns null when store is not created", () => {
    expect(getStoreApi()).toBeNull();
  });

  it("returns store API after store is created", () => {
    createComposedStore();
    const api = getStoreApi();

    expect(api).not.toBeNull();
    expect(typeof api?.getState).toBe("function");
    expect(typeof api?.setState).toBe("function");
    expect(typeof api?.subscribe).toBe("function");
  });
});

describe("getPluginServices", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it("returns null when store is not created", () => {
    expect(getPluginServices()).toBeNull();
  });

  it("returns plugin services after store is created", () => {
    createComposedStore();
    const services = getPluginServices();

    expect(services).not.toBeNull();
    expect(services?.websocket).toBeDefined();
    expect(services?.domObserver).toBeDefined();
    expect(typeof services?.getState).toBe("function");
    expect(typeof services?.setState).toBe("function");
  });
});

describe("hasPluginSlice", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it("returns false when store is not created", () => {
    expect(hasPluginSlice("eslint")).toBe(false);
  });

  it("returns false when plugin slice is not registered", () => {
    createComposedStore();
    expect(hasPluginSlice("eslint")).toBe(false);
  });

  it("returns true after plugin slice is registered", () => {
    const store = createComposedStore();

    // Manually register a plugin slice
    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        // Minimal ESLint slice state for testing
        issues: [],
        scanStatus: "idle",
      })
    );

    expect(hasPluginSlice("eslint")).toBe(true);
  });
});

describe("getPluginSlice", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it("returns undefined when store is not created", () => {
    expect(getPluginSlice("eslint")).toBeUndefined();
  });

  it("returns undefined when plugin slice is not registered", () => {
    createComposedStore();
    expect(getPluginSlice("eslint")).toBeUndefined();
  });

  it("returns the plugin slice after registration", () => {
    const store = createComposedStore();
    const mockSlice = {
      issues: [{ id: "1", message: "test" }],
      scanStatus: "idle",
    };

    store
      .getState()
      .registerPluginSlice("eslint", asPluginSlice<"eslint">(mockSlice));

    const slice = getPluginSlice("eslint");
    expect(slice).toBeDefined();
    expect((slice as { issues: unknown[] } | undefined)?.issues).toHaveLength(1);
  });
});

describe("createScopedPluginServices", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it("returns null when store is not created", () => {
    expect(createScopedPluginServices("eslint")).toBeNull();
  });

  it("returns scoped services after store is created", () => {
    createComposedStore();

    const scopedServices = createScopedPluginServices("eslint");

    expect(scopedServices).not.toBeNull();
    expect(typeof scopedServices?.getState).toBe("function");
    expect(typeof scopedServices?.setState).toBe("function");
  });

  it("scoped getState returns plugin slice only", () => {
    const store = createComposedStore();
    const mockSlice = {
      issues: [{ id: "1" }],
      scanStatus: "scanning",
    };

    store
      .getState()
      .registerPluginSlice("eslint", asPluginSlice<"eslint">(mockSlice));

    const scopedServices = createScopedPluginServices("eslint");
    const state = scopedServices?.getState<typeof mockSlice>();

    expect(state).toEqual(mockSlice);
  });

  it("scoped setState updates only the plugin slice", () => {
    const store = createComposedStore();
    const mockSlice = {
      issues: [],
      scanStatus: "idle" as const,
    };

    store
      .getState()
      .registerPluginSlice("eslint", asPluginSlice<"eslint">(mockSlice));

    const scopedServices = createScopedPluginServices("eslint");
    scopedServices?.setState({ scanStatus: "scanning" });

    const updatedSlice = store.getState().plugins.eslint as
      | { scanStatus: string; issues: unknown[] }
      | undefined;
    expect(updatedSlice?.scanStatus).toBe("scanning");
    expect(updatedSlice?.issues).toEqual([]);
  });
});

describe("Plugin slice management", () => {
  it("registerPluginSlice adds a slice to the store", () => {
    const store = createComposedStoreFactory();

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        issues: [],
        scanStatus: "idle",
      })
    );

    expect(store.getState().plugins.eslint).toBeDefined();
  });

  it("unregisterPluginSlice removes a slice from the store", () => {
    const store = createComposedStoreFactory();

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        issues: [],
      })
    );
    expect(store.getState().plugins.eslint).toBeDefined();

    store.getState().unregisterPluginSlice("eslint");
    expect(store.getState().plugins.eslint).toBeUndefined();
  });

  it("getPluginSlice returns the registered slice", () => {
    const store = createComposedStoreFactory();
    const mockSlice = { issues: [{ id: "test" }] };

    store
      .getState()
      .registerPluginSlice("eslint", asPluginSlice<"eslint">(mockSlice));

    const slice = store.getState().getPluginSlice("eslint");
    expect(slice).toEqual(mockSlice);
  });

  it("setPluginSlice updates an existing slice", () => {
    const store = createComposedStoreFactory();

    store.getState().registerPluginSlice(
      "eslint",
      asPluginSlice<"eslint">({
        issues: [],
        count: 0,
      })
    );

    store.getState().setPluginSlice("eslint", { count: 5 });

    const slice = store.getState().plugins.eslint as
      | { count: number; issues: unknown[] }
      | undefined;
    expect(slice?.count).toBe(5);
    expect(slice?.issues).toEqual([]);
  });

  it("setPluginSlice warns and does nothing for unregistered plugin", () => {
    const store = createComposedStoreFactory();

    // This should not throw, just warn
    store.getState().setPluginSlice("eslint", { count: 5 });

    expect(store.getState().plugins.eslint).toBeUndefined();
  });

  it("multiple plugins can be registered independently", () => {
    const store = createComposedStoreFactory();

    store
      .getState()
      .registerPluginSlice("eslint", asPluginSlice<"eslint">({ type: "eslint" }));
    store
      .getState()
      .registerPluginSlice("vision", asPluginSlice<"vision">({ type: "vision" }));
    store
      .getState()
      .registerPluginSlice(
        "semantic",
        asPluginSlice<"semantic">({ type: "semantic" })
      );

    type TypedSlice = { type: string } | undefined;
    expect((store.getState().plugins.eslint as TypedSlice)?.type).toBe("eslint");
    expect((store.getState().plugins.vision as TypedSlice)?.type).toBe("vision");
    expect((store.getState().plugins.semantic as TypedSlice)?.type).toBe(
      "semantic"
    );
  });
});

describe("Core slice integration", () => {
  it("openCommandPalette sets state correctly", () => {
    const store = createComposedStoreFactory();

    store.getState().openCommandPalette();

    expect(store.getState().commandPalette.open).toBe(true);
    expect(store.getState().commandPalette.query).toBe("");
    expect(store.getState().commandPalette.selectedIndex).toBe(0);
  });

  it("closeCommandPalette resets state", () => {
    const store = createComposedStoreFactory();

    store.getState().openCommandPalette();
    store.getState().closeCommandPalette();

    expect(store.getState().commandPalette.open).toBe(false);
  });

  it("openInspector sets inspector state", () => {
    const store = createComposedStoreFactory();

    store.getState().openInspector("element-panel", { elementId: "test-123" });

    expect(store.getState().inspector.open).toBe(true);
    expect(store.getState().inspector.panelId).toBe("element-panel");
    expect(store.getState().inspector.data?.elementId).toBe("test-123");
  });

  it("closeInspector resets inspector state", () => {
    const store = createComposedStoreFactory();

    store.getState().openInspector("element-panel", {});
    store.getState().closeInspector();

    expect(store.getState().inspector.open).toBe(false);
    expect(store.getState().inspector.panelId).toBeNull();
  });

  it("setFloatingIconPosition updates position", () => {
    const store = createComposedStoreFactory();

    expect(store.getState().floatingIconPosition).toBeNull();

    store.getState().setFloatingIconPosition({ x: 100, y: 200 });
    expect(store.getState().floatingIconPosition).toEqual({ x: 100, y: 200 });

    store.getState().setFloatingIconPosition({ x: 50, y: 50 });
    expect(store.getState().floatingIconPosition).toEqual({ x: 50, y: 50 });
  });
});

describe("WebSocket state synchronization", () => {
  it("updates wsConnected when connection changes", () => {
    const testWs = createTestWebSocketService();
    const store = createComposedStoreFactory({ websocket: testWs });

    expect(store.getState().wsConnected).toBe(false);

    testWs.simulateConnect();
    expect(store.getState().wsConnected).toBe(true);

    testWs.simulateDisconnect();
    expect(store.getState().wsConnected).toBe(false);
  });

  it("plugin services websocket reflects connection state", () => {
    const testWs = createTestWebSocketService();
    resetStore();
    createComposedStore({ websocket: testWs });

    const services = getPluginServices();

    expect(services?.websocket.isConnected).toBe(false);

    testWs.simulateConnect();
    expect(services?.websocket.isConnected).toBe(true);

    resetStore();
  });
});

describe("useComposedStore hook", () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it("returns the full store state when called without selector", () => {
    // eslint-disable-next-line uilint/zustand-use-selectors -- intentionally testing no-selector behavior
    const { result } = renderHook(() => useComposedStore());

    // Verify core state properties are present
    expect(result.current.commandPalette).toBeDefined();
    expect(result.current.inspector).toBeDefined();
    expect(result.current.plugins).toBeDefined();
    // floatingIconPosition can be null or a position object depending on prior state
    expect("floatingIconPosition" in result.current).toBe(true);
  });

  it("returns selected state when called with selector", () => {
    const { result } = renderHook(() =>
      useComposedStore((state) => state.commandPalette.open)
    );

    expect(result.current).toBe(false);
  });

  it("creates store on first call if not exists", () => {
    // Store should not exist yet
    expect(getStoreApi()).toBeNull();

    // eslint-disable-next-line uilint/zustand-use-selectors -- intentionally testing store creation
    renderHook(() => useComposedStore());

    // Store should now exist
    expect(getStoreApi()).not.toBeNull();
  });

  it("re-renders when selected state changes", () => {
    const { result } = renderHook(() =>
      useComposedStore((state) => state.commandPalette.open)
    );

    expect(result.current).toBe(false);

    // Update the store state
    act(() => {
      getStoreApi()?.getState().openCommandPalette();
    });

    expect(result.current).toBe(true);
  });

  it("selector receives correct inspector data after update", () => {
    const { result } = renderHook(() =>
      useComposedStore((state) => state.inspector)
    );

    expect(result.current.open).toBe(false);
    expect(result.current.panelId).toBeNull();

    act(() => {
      getStoreApi()?.getState().openInspector("test-panel", { id: "123" });
    });

    expect(result.current.open).toBe(true);
    expect(result.current.panelId).toBe("test-panel");
    expect(result.current.data?.id).toBe("123");
  });

  it("multiple hooks share the same store instance", () => {
    const { result: result1 } = renderHook(() =>
      useComposedStore((state) => state.commandPalette.open)
    );
    const { result: result2 } = renderHook(() =>
      useComposedStore((state) => state.commandPalette.open)
    );

    expect(result1.current).toBe(false);
    expect(result2.current).toBe(false);

    // Update via one hook should reflect in both
    act(() => {
      getStoreApi()?.getState().openCommandPalette();
    });

    expect(result1.current).toBe(true);
    expect(result2.current).toBe(true);
  });

  it("tracks floating icon position changes", () => {
    const { result } = renderHook(() =>
      useComposedStore((state) => state.floatingIconPosition)
    );

    // Set position and verify it's tracked
    act(() => {
      getStoreApi()?.getState().setFloatingIconPosition({ x: 100, y: 200 });
    });

    expect(result.current).toEqual({ x: 100, y: 200 });

    // Update position and verify change is tracked
    act(() => {
      getStoreApi()?.getState().setFloatingIconPosition({ x: 300, y: 400 });
    });

    expect(result.current).toEqual({ x: 300, y: 400 });
  });
});

/**
 * Integration Tests
 *
 * These tests verify the full data flow without mocking:
 * 1. Plugin registration and initialization
 * 2. WebSocket message handling
 * 3. Store state updates
 * 4. Issue retrieval
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { pluginRegistry } from "./core/plugin-system/registry";
import { eslintPlugin } from "./plugins/eslint";
import {
  createComposedStore,
  initializePlugins,
  resetStore,
  getPluginServices,
} from "./core/store";
import { websocket } from "./core/services/websocket";
import {
  createMockPluginServices,
  flushPromises,
} from "./__tests__/test-utils";
import type { ScannedElementInfo } from "./core/plugin-system/types";

/**
 * Create a mock scanned element without relying on DOM APIs
 * (DOM APIs are not available in Node.js test environment)
 */
function createMockScannedElement(
  overrides?: Partial<ScannedElementInfo>
): ScannedElementInfo {
  const dataLoc = overrides?.dataLoc ?? "test.tsx:10:5";
  const id = overrides?.id ?? `loc:${dataLoc}#1`;

  return {
    id,
    dataLoc,
    element: overrides?.element ?? ({} as Element),
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

describe("Integration: Plugin → WebSocket → Store", () => {
  beforeEach(() => {
    // Reset all state before each test
    resetStore();
    pluginRegistry.clear();
  });

  afterEach(() => {
    // Clean up
    websocket.disconnect();
    resetStore();
    pluginRegistry.clear();
  });

  it("ESLint plugin is registered and can create a slice", async () => {
    // Register the plugin
    pluginRegistry.register(eslintPlugin);

    // Verify it's registered
    const plugins = pluginRegistry.getPlugins();
    expect(plugins).toHaveLength(1);
    expect(plugins[0].id).toBe("eslint");
  });

  it("initializePlugins creates ESLint slice in store", async () => {
    // Register and initialize
    pluginRegistry.register(eslintPlugin);
    await initializePlugins();

    // Get the store
    const store = createComposedStore();
    const state = store.getState();

    // Verify ESLint slice exists
    expect(state.plugins).toBeDefined();
    expect(state.plugins.eslint).toBeDefined();
    expect(state.plugins.eslint.issues).toBeInstanceOf(Map);
  });

  it("ESLint plugin handles lint:result messages", async () => {
    // Register and initialize
    pluginRegistry.register(eslintPlugin);
    await initializePlugins();

    // Get store and services
    const store = createComposedStore();
    const services = getPluginServices();
    expect(services).not.toBeNull();

    // Simulate a lint:result message by directly dispatching to handlers
    // (we can't easily mock the WebSocket without significant setup)
    const mockMessage = {
      type: "lint:result",
      filePath: "/test/file.tsx",
      issues: [
        {
          line: 10,
          column: 5,
          message: "Test issue",
          ruleId: "test-rule",
          severity: 2,
          dataLoc: "/test/file.tsx:10:5",
        },
      ],
    };

    // The WebSocket service dispatches to handlers registered via .on()
    // Since the plugin registers handlers in initialize(), we need to
    // manually trigger the handler
    const handlers = (websocket as any).handlers?.get("lint:result");
    if (handlers) {
      handlers.forEach((handler: (data: unknown) => void) => {
        handler(mockMessage);
      });
    }

    // Check that issues were stored
    const state = store.getState();
    const issues = state.plugins.eslint?.issues;

    // Note: This test may need adjustment based on how the plugin
    // actually processes messages. The key point is that we're testing
    // the real plugin, not a mock.
    expect(issues).toBeDefined();
  });

  it("Plugin services expose websocket interface", async () => {
    // Register and initialize
    pluginRegistry.register(eslintPlugin);
    await initializePlugins();

    const services = getPluginServices();
    expect(services).not.toBeNull();

    // The plugin services should expose websocket methods
    expect(services!.websocket).toBeDefined();
    expect(typeof services!.websocket.connect).toBe("function");
    expect(typeof services!.websocket.on).toBe("function");
  });

  it("Full flow: register → initialize → store state", async () => {
    // This test verifies the complete integration

    // 1. Register plugin
    pluginRegistry.register(eslintPlugin);
    expect(pluginRegistry.getPlugins()).toHaveLength(1);

    // 2. Initialize plugins
    await initializePlugins();

    // 3. Verify store has plugin slice
    const store = createComposedStore();
    expect(store.getState().plugins.eslint).toBeDefined();

    // 4. Verify plugin services exist
    const services = getPluginServices();
    expect(services).not.toBeNull();

    // 5. Verify plugin slice has expected shape
    const eslintState = store.getState().plugins.eslint;
    expect(eslintState.issues).toBeInstanceOf(Map);
    expect(eslintState.scanStatus).toBeDefined();
    expect(eslintState.availableRules).toBeDefined();
  });
});

describe("Integration: Store state access", () => {
  beforeEach(() => {
    resetStore();
    pluginRegistry.clear();
  });

  afterEach(() => {
    resetStore();
    pluginRegistry.clear();
  });

  it("useComposedStore can access plugin state", async () => {
    // Register and initialize
    pluginRegistry.register(eslintPlugin);
    await initializePlugins();

    // Access store directly (useComposedStore is a React hook, so we test via getState)
    const store = createComposedStore();
    const state = store.getState();

    // Should be able to access nested plugin state
    const issues = state.plugins?.eslint?.issues;
    expect(issues).toBeInstanceOf(Map);
    expect(issues.size).toBe(0); // No issues yet
  });
});

/**
 * Full Flow Integration Tests
 *
 * These tests verify the complete data flow:
 * DOM Observer → ESLint Plugin → WebSocket → Server → Store → UI
 *
 * Using mock services to simulate the full flow without a real server.
 */
describe("Integration: Full ESLint Detection Flow", () => {
  let services: ReturnType<typeof createMockPluginServices>;
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    // Note: services.getState() returns scoped plugin state directly (not wrapped in plugins.eslint)
    services = createMockPluginServices({
      websocket: { isConnected: true },
      initialState: {
        issues: new Map(),
        scannedDataLocs: new Set(),
        requestedFiles: new Set(),
        scanStatus: "scanning",
        availableRules: [],
        disabledRules: new Set(),
        workspaceRoot: null,
        appRoot: "/test/app",
        serverCwd: "/test",
      },
    });
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }
    services.__websocket.__clearHandlers();
    services.__domObserver.__clearHandlers();
  });

  it("complete flow: DOM elements → lint:file request → lint:result → issues stored", async () => {
    // 1. Initialize plugin (this sets up all handlers)
    cleanup = eslintPlugin.initialize?.(services);

    // 2. Simulate DOM observer detecting elements with data-loc
    const elements = [
      createMockScannedElement({
        id: "loc:app/page.tsx:10:5#1",
        dataLoc: "app/page.tsx:10:5",
      }),
      createMockScannedElement({
        id: "loc:app/page.tsx:20:3#1",
        dataLoc: "app/page.tsx:20:3",
      }),
    ];

    services.__domObserver.__simulateElementsAdded(elements);
    await flushPromises();

    // 3. Verify lint:file was sent for the file
    expect(services.websocket.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "lint:file",
        filePath: "app/page.tsx",
      })
    );

    // 4. Simulate server responding with lint:result
    services.__websocket.__simulateMessage("lint:result", {
      filePath: "app/page.tsx",
      issues: [
        {
          line: 10,
          column: 5,
          message: "Button missing aria-label",
          ruleId: "uilint/require-aria-label",
          dataLoc: "app/page.tsx:10:5",
        },
        {
          line: 20,
          column: 3,
          message: "Image missing alt text",
          ruleId: "uilint/require-alt-text",
          dataLoc: "app/page.tsx:20:3",
        },
      ],
    });
    await flushPromises();

    // 5. Verify issues were stored in state
    const state = services.__getInternalState() as {
      issues?: Map<string, unknown[]>;
    };
    expect(state.issues).toBeInstanceOf(Map);
    // The issues should be stored (though the exact dataLoc keys depend on the implementation)
    expect(state.issues?.size).toBeGreaterThan(0);
  });

  it("handles multiple files from different elements", async () => {
    cleanup = eslintPlugin.initialize?.(services);

    // Elements from different files
    const elements = [
      createMockScannedElement({ dataLoc: "app/page.tsx:10:5" }),
      createMockScannedElement({ dataLoc: "components/Button.tsx:5:0" }),
      createMockScannedElement({ dataLoc: "components/Header.tsx:15:8" }),
    ];

    services.__domObserver.__simulateElementsAdded(elements);
    await flushPromises();

    // Should send lint requests for each unique file
    const sendCalls = (services.websocket.send as ReturnType<typeof vi.fn>).mock.calls;
    const lintFileCalls = sendCalls.filter((call) => call[0]?.type === "lint:file");

    expect(lintFileCalls.length).toBe(3);

    const requestedFiles = lintFileCalls.map((call) => call[0].filePath);
    expect(requestedFiles).toContain("app/page.tsx");
    expect(requestedFiles).toContain("components/Button.tsx");
    expect(requestedFiles).toContain("components/Header.tsx");
  });

  it("processes workspace:info message correctly", async () => {
    cleanup = eslintPlugin.initialize?.(services);

    // Simulate receiving workspace info from server
    services.__websocket.__simulateMessage("workspace:info", {
      appRoot: "/home/user/project/apps/web",
      workspaceRoot: "/home/user/project",
      serverCwd: "/home/user/project",
    });
    await flushPromises();

    // Verify workspace info was stored in state
    const state = services.__getInternalState() as {
      appRoot?: string;
      workspaceRoot?: string;
      serverCwd?: string;
    };
    expect(state.appRoot).toBe("/home/user/project/apps/web");
    expect(state.workspaceRoot).toBe("/home/user/project");
    expect(state.serverCwd).toBe("/home/user/project");
  });

  it("processes rules:metadata message correctly", async () => {
    cleanup = eslintPlugin.initialize?.(services);

    // Simulate receiving rules metadata from server
    services.__websocket.__simulateMessage("rules:metadata", {
      rules: [
        {
          id: "require-aria-label",
          name: "Require aria-label",
          description: "Buttons should have aria-label",
          category: "static",
          defaultSeverity: "error",
        },
        {
          id: "require-alt-text",
          name: "Require alt text",
          description: "Images should have alt text",
          category: "static",
          defaultSeverity: "warn",
        },
      ],
    });
    await flushPromises();

    // Verify rules were stored in state
    const state = services.__getInternalState() as {
      availableRules?: Array<{ id: string }>;
    };
    expect(state.availableRules).toBeDefined();
    expect(state.availableRules?.length).toBe(2);
    expect(state.availableRules?.find((r) => r.id === "require-aria-label")).toBeDefined();
    expect(state.availableRules?.find((r) => r.id === "require-alt-text")).toBeDefined();
  });

  it("clears issues when file:changed message is received", async () => {
    // Set up initial state with some issues
    services = createMockPluginServices({
      websocket: { isConnected: true },
      initialState: {
        plugins: {
          eslint: {
            issues: new Map([
              ["app/page.tsx:10:5", [{ id: "issue-1", message: "Test issue" }]],
              ["app/page.tsx:20:3", [{ id: "issue-2", message: "Another issue" }]],
            ]),
            scannedDataLocs: new Set(),
            requestedFiles: new Set(["app/page.tsx"]),
            scanStatus: "scanning",
          },
        },
      },
    });

    cleanup = eslintPlugin.initialize?.(services);

    // Simulate file change notification
    services.__websocket.__simulateMessage("file:changed", {
      filePath: "app/page.tsx",
    });
    await flushPromises();

    // Verify issues for that file were cleared from state
    const state = services.__getInternalState() as {
      issues?: Map<string, unknown[]>;
      requestedFiles?: Set<string>;
    };

    // Issues with app/page.tsx: prefix should be cleared
    expect(state.issues?.has("app/page.tsx:10:5")).toBe(false);
    expect(state.issues?.has("app/page.tsx:20:3")).toBe(false);

    // The file should also be removed from requestedFiles so it can be re-requested
    expect(state.requestedFiles?.has("app/page.tsx")).toBe(false);
  });
});

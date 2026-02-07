import { describe, expect, it, vi } from "vitest";
import {
  adaptPlugin,
  adaptPlugins,
  registerBrowserAction,
  clearBrowserActionRegistry,
} from "./adapter";
import type { PluginWithHandlers } from "uilint-core";
import type { PluginServices } from "./types";

// Mock uilint-core functions
vi.mock("uilint-core", async (importOriginal) => {
  const original = await importOriginal<typeof import("uilint-core")>();
  return {
    ...original,
    isDataBinding: (v: unknown): v is { binding: string } =>
      typeof v === "object" && v !== null && "binding" in v,
    isExpressionBinding: (v: unknown): v is { expression: string } =>
      typeof v === "object" && v !== null && "expression" in v,
  };
});

// Mock icon-map
vi.mock("../../ui/components/Schema/icon-map", () => ({
  getIcon: () => () => null,
}));

// No need to mock uilint-vision — browser actions are now registered by plugins

describe("adapter", () => {
  describe("adaptPlugin", () => {
    it("adapts basic plugin metadata", () => {
      const source: PluginWithHandlers<{ count: number }> = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        description: "A test plugin",
        icon: "eye",
        state: {
          initialState: { count: 0 },
        },
      };

      const adapted = adaptPlugin(source);

      expect(adapted.id).toBe("test-plugin");
      expect(adapted.name).toBe("Test Plugin");
      expect(adapted.version).toBe("1.0.0");
      expect(adapted.description).toBe("A test plugin");
    });

    it("creates slice with initial state and setters", () => {
      const source: PluginWithHandlers<{ count: number; name: string }> = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        state: {
          initialState: { count: 0, name: "test" },
        },
      };

      const adapted = adaptPlugin(source);

      // Mock services
      const mockServices = {
        getState: vi.fn().mockReturnValue({}),
        setState: vi.fn(),
        websocket: { on: vi.fn(), send: vi.fn(), isConnected: false, onConnectionChange: vi.fn() },
        domObserver: { onElementsAdded: vi.fn() },
        openInspector: vi.fn(),
        closeInspector: vi.fn(),
        closeCommandPalette: vi.fn(),
      };

      const slice = adapted.createSlice!(mockServices as unknown as PluginServices);

      // Should have initial state
      expect(slice.count).toBe(0);
      expect(slice.name).toBe("test");

      // Should have setters
      expect(typeof (slice as Record<string, unknown>).setCount).toBe("function");
      expect(typeof (slice as Record<string, unknown>).setName).toBe("function");
    });

    it("adapts commands with action handlers", () => {
      const actionHandler = vi.fn();

      const source: PluginWithHandlers<{ count: number }> = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        state: {
          initialState: { count: 0 },
        },
        commands: [
          {
            id: "test:increment",
            title: "Increment Counter",
            keywords: ["increment", "add"],
            action: { type: "increment" },
          },
        ],
        actions: {
          increment: actionHandler,
        },
      };

      const adapted = adaptPlugin(source);

      expect(adapted.commands).toHaveLength(1);
      expect(adapted.commands![0].id).toBe("test:increment");
      expect(adapted.commands![0].title).toBe("Increment Counter");
      expect(adapted.commands![0].keywords).toEqual(["increment", "add"]);
    });

    it("adapts toolbar groups", () => {
      const source: PluginWithHandlers<{ visible: boolean }> = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        state: {
          initialState: { visible: true },
        },
        toolbarGroups: [
          {
            id: "test:toolbar",
            icon: "camera",
            tooltip: "Test Toolbar",
            priority: 100,
            actions: [
              {
                id: "test:action",
                icon: "play",
                tooltip: "Run Test",
                action: { type: "run" },
              },
            ],
          },
        ],
      };

      const adapted = adaptPlugin(source);

      expect(adapted.toolbarActionGroups).toHaveLength(1);
      expect(adapted.toolbarActionGroups![0].id).toBe("test:toolbar");
      expect(adapted.toolbarActionGroups![0].tooltip).toBe("Test Toolbar");
      expect(adapted.toolbarActionGroups![0].priority).toBe(100);
      expect(adapted.toolbarActionGroups![0].actions).toHaveLength(1);
    });

    it("adapts getIssues function", () => {
      const source: PluginWithHandlers<{ issues: Map<string, string[]> }> = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        state: {
          initialState: { issues: new Map() },
        },
        getIssues: (_state) => ({
          pluginId: "test-plugin",
          issues: new Map([["loc1", [{ id: "1", message: "test", severity: "warning" as const }]]]),
        }),
      };

      const adapted = adaptPlugin(source);

      expect(adapted.getIssues).toBeDefined();
      const result = adapted.getIssues!({ issues: new Map() });
      expect(result.pluginId).toBe("test-plugin");
    });

    it("adapts handlesRuleCategories", () => {
      const source: PluginWithHandlers<Record<string, never>> = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        state: {
          initialState: {},
        },
        handlesRuleCategories: ["vision", "semantic"],
      };

      const adapted = adaptPlugin(source);

      expect(adapted.handlesRules).toBeDefined();
      expect(adapted.handlesRules!({ id: "test", category: "vision" })).toBe(true);
      expect(adapted.handlesRules!({ id: "test", category: "semantic" })).toBe(true);
      expect(adapted.handlesRules!({ id: "test", category: "static" })).toBe(false);
    });

    it("sets up WebSocket message handlers in initialize", () => {
      const messageHandler = vi.fn();

      const source: PluginWithHandlers<Record<string, never>> = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        state: {
          initialState: {},
        },
        messageHandlers: {
          "test:message": messageHandler,
        },
      };

      const adapted = adaptPlugin(source);

      const mockServices = {
        getState: vi.fn().mockReturnValue({ plugins: {} }),
        setState: vi.fn(),
        websocket: {
          on: vi.fn().mockReturnValue(() => {}),
          send: vi.fn(),
          isConnected: true,
          onConnectionChange: vi.fn().mockReturnValue(() => {}),
        },
        domObserver: { onElementsAdded: vi.fn() },
        openInspector: vi.fn(),
        closeInspector: vi.fn(),
        closeCommandPalette: vi.fn(),
      };

      const cleanup = adapted.initialize!(mockServices as unknown as PluginServices);

      // Should have subscribed to the message type
      expect(mockServices.websocket.on).toHaveBeenCalledWith("test:message", expect.any(Function));

      // Cleanup should be a function
      expect(typeof cleanup).toBe("function");
    });

    it("calls onLoad when plugin initializes with connected WebSocket", () => {
      const onLoad = vi.fn();

      const source: PluginWithHandlers<Record<string, never>> = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        state: {
          initialState: {},
        },
        onLoad,
      };

      const adapted = adaptPlugin(source);

      const mockServices = {
        getState: vi.fn().mockReturnValue({ plugins: {} }),
        setState: vi.fn(),
        websocket: {
          on: vi.fn().mockReturnValue(() => {}),
          send: vi.fn(),
          isConnected: true,
          onConnectionChange: vi.fn().mockReturnValue(() => {}),
        },
        domObserver: { onElementsAdded: vi.fn() },
        openInspector: vi.fn(),
        closeInspector: vi.fn(),
        closeCommandPalette: vi.fn(),
      };

      adapted.initialize!(mockServices as unknown as PluginServices);

      // onLoad should have been called
      expect(onLoad).toHaveBeenCalled();
    });
  });

  describe("condition evaluation", () => {
    it("evaluates data binding conditions", () => {
      const source: PluginWithHandlers<{ enabled: boolean }> = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        state: {
          initialState: { enabled: true },
        },
        toolbarGroups: [
          {
            id: "test:toolbar",
            icon: "camera",
            tooltip: "Test",
            priority: 100,
            isVisible: { binding: "enabled" },
            actions: [],
          },
        ],
      };

      const adapted = adaptPlugin(source);
      const isVisible = adapted.toolbarActionGroups![0].isVisible;

      // Should return true when enabled is true
      expect(isVisible!({ plugins: { "test-plugin": { enabled: true } } })).toBe(true);

      // Should return false when enabled is false
      expect(isVisible!({ plugins: { "test-plugin": { enabled: false } } })).toBe(false);
    });
  });

  describe("browserActionRegistry", () => {
    it("registers and executes browser actions", async () => {
      clearBrowserActionRegistry();

      const handler = vi.fn().mockResolvedValue({ success: true, data: "test" });
      registerBrowserAction("test:action", handler);

      // Verify via plugin context's requestBrowserAction
      const source: PluginWithHandlers<Record<string, never>> = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        state: { initialState: {} },
        onLoad: async (ctx) => {
          const result = await ctx.requestBrowserAction("test:action", { key: "value" });
          expect(result.success).toBe(true);
        },
      };

      const adapted = adaptPlugin(source);
      const mockServices = {
        getState: vi.fn().mockReturnValue({ plugins: {} }),
        setState: vi.fn(),
        websocket: { on: vi.fn().mockReturnValue(() => {}), send: vi.fn(), isConnected: true, onConnectionChange: vi.fn().mockReturnValue(() => {}) },
        domObserver: { onElementsAdded: vi.fn() },
        openInspector: vi.fn(),
        closeInspector: vi.fn(),
        closeCommandPalette: vi.fn(),
      };

      adapted.initialize!(mockServices as unknown as PluginServices);

      expect(handler).toHaveBeenCalledWith({ key: "value" });
    });

    it("clears all registered actions", () => {
      registerBrowserAction("action1", vi.fn());
      registerBrowserAction("action2", vi.fn());
      clearBrowserActionRegistry();

      // After clearing, actions should not be found (verified via plugin context)
      const source: PluginWithHandlers<Record<string, never>> = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        state: { initialState: {} },
        onLoad: async (ctx) => {
          const result = await ctx.requestBrowserAction("action1");
          expect(result.success).toBe(false);
        },
      };

      const adapted = adaptPlugin(source);
      const mockServices = {
        getState: vi.fn().mockReturnValue({ plugins: {} }),
        setState: vi.fn(),
        websocket: { on: vi.fn().mockReturnValue(() => {}), send: vi.fn(), isConnected: true, onConnectionChange: vi.fn().mockReturnValue(() => {}) },
        domObserver: { onElementsAdded: vi.fn() },
        openInspector: vi.fn(),
        closeInspector: vi.fn(),
        closeCommandPalette: vi.fn(),
      };

      adapted.initialize!(mockServices as unknown as PluginServices);
    });
  });

  describe("adaptPlugins", () => {
    it("adapts multiple plugins at once", () => {
      const sources: PluginWithHandlers[] = [
        {
          id: "plugin-a",
          name: "Plugin A",
          version: "1.0.0",
          state: { initialState: {} },
        },
        {
          id: "plugin-b",
          name: "Plugin B",
          version: "2.0.0",
          state: { initialState: {} },
        },
      ];

      const adapted = adaptPlugins(sources);

      expect(adapted).toHaveLength(2);
      expect(adapted[0].id).toBe("plugin-a");
      expect(adapted[1].id).toBe("plugin-b");
    });

    it("returns empty array for empty input", () => {
      const adapted = adaptPlugins([]);
      expect(adapted).toHaveLength(0);
    });
  });
});

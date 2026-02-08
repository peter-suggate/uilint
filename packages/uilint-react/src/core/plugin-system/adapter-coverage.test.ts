/**
 * Tests for plugin adapter covering condition evaluation, browser action registry,
 * and plugin adaptation. These test behavior, not implementation details.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  registerBrowserAction,
  clearBrowserActionRegistry,
  adaptPlugin,
  adaptPlugins,
} from "./adapter";
import type { PluginWithHandlers } from "uilint-core";
import type { PluginServices } from "./types";

// Reset browser action registry between tests
beforeEach(() => {
  clearBrowserActionRegistry();
});

function makeMinimalPlugin(overrides: Partial<PluginWithHandlers> = {}): PluginWithHandlers {
  return {
    id: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    state: {
      initialState: { count: 0, enabled: true },
    },
    actions: {
      increment: (ctx) => {
        const state = ctx.getState() as { count: number };
        ctx.setState({ count: state.count + 1 } as never);
      },
    },
    ...overrides,
  } as PluginWithHandlers;
}

function makeServices(state: Record<string, unknown> = {}): PluginServices {
  const fullState: Record<string, unknown> = {
    plugins: {
      "test-plugin": { count: 0, enabled: true, ...state },
    },
  };

  return {
    getState: (() => fullState) as PluginServices["getState"],
    setState: vi.fn((partial) => {
      Object.assign(fullState.plugins!["test-plugin" as keyof typeof fullState.plugins] as Record<string, unknown>, partial);
    }),
    subscribe: vi.fn(() => vi.fn()),
    websocket: {
      send: vi.fn(),
      on: vi.fn(() => vi.fn()),
      onConnectionChange: vi.fn(() => vi.fn()),
    },
    domObserver: {
      start: vi.fn(),
      stop: vi.fn(),
      onElementsAdded: vi.fn(() => vi.fn()),
      onElementsRemoved: vi.fn(() => vi.fn()),
      getElements: vi.fn(() => new Map()),
      setHideNodeModules: vi.fn(),
    },
    openInspector: vi.fn(),
    closeInspector: vi.fn(),
    closeCommandPalette: vi.fn(),
  };
}

describe("browser action registry", () => {
  it("registers and executes a browser action", async () => {
    const handler = vi.fn().mockResolvedValue({ success: true });
    registerBrowserAction("screenshot", handler);

    // Adapt a plugin that uses browser actions
    const plugin = makeMinimalPlugin({
      onLoad: async (ctx) => {
        const result = await ctx.requestBrowserAction("screenshot", { url: "https://example.com" });
        expect(result.success).toBe(true);
      },
    });

    const adapted = adaptPlugin(plugin);
    const services = makeServices();
    adapted.initialize!(services);

    expect(handler).toHaveBeenCalledWith({ url: "https://example.com" });
  });

  it("returns error for unknown browser action", async () => {
    const plugin = makeMinimalPlugin({
      onLoad: async (ctx) => {
        const result = await ctx.requestBrowserAction("unknown-action");
        expect(result.success).toBe(false);
        expect(result.error).toContain("Unknown browser action");
      },
    });

    const adapted = adaptPlugin(plugin);
    adapted.initialize!(makeServices());
  });

  it("clearBrowserActionRegistry removes all handlers", async () => {
    registerBrowserAction("test", vi.fn().mockResolvedValue({ success: true }));
    clearBrowserActionRegistry();

    const plugin = makeMinimalPlugin({
      onLoad: async (ctx) => {
        const result = await ctx.requestBrowserAction("test");
        expect(result.success).toBe(false);
      },
    });

    const adapted = adaptPlugin(plugin);
    adapted.initialize!(makeServices());
  });
});

describe("adaptPlugin", () => {
  it("preserves plugin metadata", () => {
    const source = makeMinimalPlugin({
      id: "my-plugin",
      name: "My Plugin",
      version: "2.0.0",
      description: "A test plugin",
    });

    const adapted = adaptPlugin(source);

    expect(adapted.id).toBe("my-plugin");
    expect(adapted.name).toBe("My Plugin");
    expect(adapted.version).toBe("2.0.0");
    expect(adapted.description).toBe("A test plugin");
  });

  it("creates a slice with initial state and setters", () => {
    const source = makeMinimalPlugin({
      state: {
        initialState: { count: 0, label: "hello" },
      },
    });

    const adapted = adaptPlugin(source);
    const services = makeServices();
    const slice = adapted.createSlice!(services);

    expect((slice as Record<string, unknown>).count).toBe(0);
    expect((slice as Record<string, unknown>).label).toBe("hello");
    // Setters should be generated
    expect(typeof (slice as Record<string, unknown>).setCount).toBe("function");
    expect(typeof (slice as Record<string, unknown>).setLabel).toBe("function");
  });

  it("adapts commands from CommandDefinitions", () => {
    const source = makeMinimalPlugin({
      commands: [
        {
          id: "test:run",
          title: "Run Test",
          keywords: ["run", "test"],
          category: "testing",
          action: { type: "increment" },
        },
      ],
    });

    const adapted = adaptPlugin(source);

    expect(adapted.commands).toHaveLength(1);
    expect(adapted.commands![0].id).toBe("test:run");
    expect(adapted.commands![0].title).toBe("Run Test");
    expect(adapted.commands![0].keywords).toEqual(["run", "test"]);
  });

  it("command execute dispatches the action", () => {
    const actionHandler = vi.fn();
    const source = makeMinimalPlugin({
      actions: { doStuff: actionHandler },
      commands: [
        {
          id: "test:do",
          title: "Do Stuff",
          keywords: ["do"],
          category: "testing",
          action: { type: "doStuff", payload: { key: "value" } },
        },
      ],
    });

    const adapted = adaptPlugin(source);
    const services = makeServices();
    adapted.commands![0].execute(services);

    expect(actionHandler).toHaveBeenCalled();
  });

  it("sets up websocket message handlers in initialize", () => {
    const handler = vi.fn();
    const source = makeMinimalPlugin({
      messageHandlers: {
        "lint:result": handler,
      },
    });

    const adapted = adaptPlugin(source);
    const services = makeServices();
    adapted.initialize!(services);

    expect(services.websocket.on).toHaveBeenCalledWith("lint:result", expect.any(Function));
  });

  it("initialize returns cleanup function for subscriptions", () => {
    const source = makeMinimalPlugin({
      messageHandlers: {
        "lint:result": vi.fn(),
      },
    });

    const adapted = adaptPlugin(source);
    const services = makeServices();
    const cleanup = adapted.initialize!(services);

    expect(typeof cleanup).toBe("function");
  });

  it("calls onLoad during initialize", () => {
    const onLoad = vi.fn();
    const source = makeMinimalPlugin({ onLoad });

    const adapted = adaptPlugin(source);
    adapted.initialize!(makeServices());

    expect(onLoad).toHaveBeenCalled();
  });

  it("calls onUnload during dispose", () => {
    const onUnload = vi.fn();
    const source = makeMinimalPlugin({ onUnload });

    const adapted = adaptPlugin(source);
    adapted.dispose!(makeServices());

    expect(onUnload).toHaveBeenCalled();
  });

  it("adapts getIssues when defined", () => {
    const source = makeMinimalPlugin({
      getIssues: (_state) => ({
        pluginId: "test-plugin",
        issues: [],
      }),
    });

    const adapted = adaptPlugin(source);
    expect(adapted.getIssues).toBeDefined();

    const result = adapted.getIssues!({ count: 0, enabled: true });
    expect(result.pluginId).toBe("test-plugin");
    expect(result.issues).toEqual([]);
  });

  it("adapts handlesRules based on handlesRuleCategories", () => {
    const source = makeMinimalPlugin({
      handlesRuleCategories: ["style", "layout"],
    });

    const adapted = adaptPlugin(source);
    expect(adapted.handlesRules).toBeDefined();

    expect(adapted.handlesRules!({ category: "style" } as never)).toBe(true);
    expect(adapted.handlesRules!({ category: "logic" } as never)).toBe(false);
    expect(adapted.handlesRules!({} as never)).toBe(false);
  });
});

describe("evaluateCondition via command isAvailable", () => {
  // evaluateCondition is not exported, so we test it through the public API:
  // command.isAvailable and toolbar isVisible/isEnabled

  function makeCommandPlugin(
    isAvailable: Record<string, unknown>,
    actionHandlers: Record<string, ReturnType<typeof vi.fn>> = {}
  ) {
    return makeMinimalPlugin({
      actions: { doStuff: vi.fn(), ...actionHandlers },
      commands: [
        {
          id: "test:cmd",
          title: "Test",
          keywords: ["test"],
          category: "testing",
          isAvailable: isAvailable as never,
          action: { type: "doStuff" },
        },
      ],
    });
  }

  it("DataBinding: truthy value returns true", () => {
    const plugin = makeCommandPlugin({ binding: "enabled" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 0, enabled: true } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(true);
  });

  it("DataBinding: falsy value returns false", () => {
    const plugin = makeCommandPlugin({ binding: "enabled" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 0, enabled: false } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(false);
  });

  it("DataBinding: nested dotted path navigates correctly", () => {
    const plugin = makeCommandPlugin({ binding: "config.lint.active" });
    const adapted = adaptPlugin(plugin);
    const state = {
      plugins: { "test-plugin": { count: 0, enabled: true, config: { lint: { active: true } } } },
    };
    expect(adapted.commands![0].isAvailable!(state)).toBe(true);
  });

  it("DataBinding: missing nested path returns false", () => {
    const plugin = makeCommandPlugin({ binding: "config.lint.active" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 0, enabled: true } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(false);
  });

  it("DataBinding: non-object in path returns false", () => {
    const plugin = makeCommandPlugin({ binding: "count.nested" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 5, enabled: true } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(false);
  });

  it("ExpressionBinding: equality with true literal", () => {
    const plugin = makeCommandPlugin({ expression: "enabled === true" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 0, enabled: true } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(true);
  });

  it("ExpressionBinding: equality with false literal", () => {
    const plugin = makeCommandPlugin({ expression: "enabled === false" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 0, enabled: true } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(false);
  });

  it("ExpressionBinding: equality with null", () => {
    const plugin = makeCommandPlugin({ expression: "result === null" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 0, enabled: true, result: null } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(true);
  });

  it("ExpressionBinding: equality with number 0", () => {
    const plugin = makeCommandPlugin({ expression: "count === 0" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 0, enabled: true } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(true);
  });

  it("ExpressionBinding: equality with quoted string", () => {
    const plugin = makeCommandPlugin({ expression: 'status === "active"' });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 0, enabled: true, status: "active" } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(true);
  });

  it("ExpressionBinding: equality with string fallback", () => {
    const plugin = makeCommandPlugin({ expression: "status === running" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 0, enabled: true, status: "running" } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(true);
  });

  it("ExpressionBinding: equality with dotted path", () => {
    const plugin = makeCommandPlugin({ expression: "config.mode === true" });
    const adapted = adaptPlugin(plugin);
    const state = {
      plugins: { "test-plugin": { count: 0, enabled: true, config: { mode: true } } },
    };
    expect(adapted.commands![0].isAvailable!(state)).toBe(true);
  });

  it("ExpressionBinding: equality with undefined path returns false", () => {
    const plugin = makeCommandPlugin({ expression: "missing.prop === true" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 0, enabled: true } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(false);
  });

  it("ExpressionBinding: length check on array", () => {
    const plugin = makeCommandPlugin({ expression: "items.length === 0" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 0, enabled: true, items: [] } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(true);
  });

  it("ExpressionBinding: length check on non-empty array", () => {
    const plugin = makeCommandPlugin({ expression: "items.length === 3" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 0, enabled: true, items: [1, 2, 3] } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(true);
  });

  it("ExpressionBinding: length check on string - caught by equality pattern first", () => {
    // Note: "name.length === 5" matches the equality regex first (property=name.length, value=5)
    // Since strings aren't objects in the path walker, it resolves to undefined
    const plugin = makeCommandPlugin({ expression: "name.length === 5" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 0, enabled: true, name: "hello" } } };
    // The equality pattern matches first: path "name.length" → name is "hello" (string, not object) → undefined
    expect(adapted.commands![0].isAvailable!(state)).toBe(false);
  });

  it("ExpressionBinding: length check on non-array/string returns false", () => {
    const plugin = makeCommandPlugin({ expression: "count.length === 0" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 5, enabled: true } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(false);
  });

  it("ExpressionBinding: unsupported expression returns false", () => {
    const plugin = makeCommandPlugin({ expression: "count > 5 && enabled" });
    const adapted = adaptPlugin(plugin);
    const state = { plugins: { "test-plugin": { count: 10, enabled: true } } };
    expect(adapted.commands![0].isAvailable!(state)).toBe(false);
  });

  it("no isAvailable means command is always available (undefined)", () => {
    const plugin = makeMinimalPlugin({
      actions: { doStuff: vi.fn() },
      commands: [
        {
          id: "test:cmd",
          title: "Test",
          keywords: ["test"],
          category: "testing",
          action: { type: "doStuff" },
        },
      ],
    });
    const adapted = adaptPlugin(plugin);
    expect(adapted.commands![0].isAvailable).toBeUndefined();
  });
});

describe("toolbar adaptation", () => {
  it("adapts toolbar groups with actions", () => {
    const actionHandler = vi.fn();
    const source = makeMinimalPlugin({
      actions: { toggleScan: actionHandler },
      toolbarGroups: [
        {
          id: "lint-group",
          icon: "play",
          tooltip: "Lint controls",
          priority: 10,
          actions: [
            {
              id: "toggle-scan",
              icon: "play",
              tooltip: "Toggle scan",
              action: { type: "toggleScan" },
            },
          ],
        },
      ],
    });

    const adapted = adaptPlugin(source);
    expect(adapted.toolbarActionGroups).toHaveLength(1);
    expect(adapted.toolbarActionGroups![0].id).toBe("lint-group");
    expect(adapted.toolbarActionGroups![0].tooltip).toBe("Lint controls");
    expect(adapted.toolbarActionGroups![0].priority).toBe(10);
    expect(adapted.toolbarActionGroups![0].actions).toHaveLength(1);
    expect(adapted.toolbarActionGroups![0].actions[0].id).toBe("toggle-scan");
  });

  it("toolbar action onClick executes the action handler", () => {
    const actionHandler = vi.fn();
    const source = makeMinimalPlugin({
      actions: { toggleScan: actionHandler },
      toolbarGroups: [
        {
          id: "lint-group",
          icon: "play",
          tooltip: "Lint controls",
          priority: 10,
          actions: [
            {
              id: "toggle-scan",
              icon: "play",
              tooltip: "Toggle scan",
              action: { type: "toggleScan" },
            },
          ],
        },
      ],
    });

    const adapted = adaptPlugin(source);
    const services = makeServices();
    adapted.toolbarActionGroups![0].actions[0].onClick(services);
    expect(actionHandler).toHaveBeenCalled();
  });

  it("toolbar group isVisible evaluates condition", () => {
    const source = makeMinimalPlugin({
      actions: { doStuff: vi.fn() },
      toolbarGroups: [
        {
          id: "group",
          icon: "play",
          tooltip: "test",
          priority: 1,
          isVisible: { binding: "enabled" },
          actions: [
            {
              id: "action",
              icon: "play",
              tooltip: "test",
              action: { type: "doStuff" },
            },
          ],
        },
      ],
    });

    const adapted = adaptPlugin(source);
    const visibleState = { plugins: { "test-plugin": { count: 0, enabled: true } } };
    const hiddenState = { plugins: { "test-plugin": { count: 0, enabled: false } } };

    expect(adapted.toolbarActionGroups![0].isVisible!(visibleState)).toBe(true);
    expect(adapted.toolbarActionGroups![0].isVisible!(hiddenState)).toBe(false);
  });

  it("toolbar action isEnabled evaluates condition", () => {
    const source = makeMinimalPlugin({
      actions: { doStuff: vi.fn() },
      toolbarGroups: [
        {
          id: "group",
          icon: "play",
          tooltip: "test",
          priority: 1,
          actions: [
            {
              id: "action",
              icon: "play",
              tooltip: "test",
              isEnabled: { expression: "count === 0" },
              action: { type: "doStuff" },
            },
          ],
        },
      ],
    });

    const adapted = adaptPlugin(source);
    const enabledState = { plugins: { "test-plugin": { count: 0, enabled: true } } };
    const disabledState = { plugins: { "test-plugin": { count: 5, enabled: true } } };

    expect(adapted.toolbarActionGroups![0].actions[0].isEnabled!(enabledState)).toBe(true);
    expect(adapted.toolbarActionGroups![0].actions[0].isEnabled!(disabledState)).toBe(false);
  });

  it("toolbar action isVisible evaluates condition", () => {
    const source = makeMinimalPlugin({
      actions: { doStuff: vi.fn() },
      toolbarGroups: [
        {
          id: "group",
          icon: "play",
          tooltip: "test",
          priority: 1,
          actions: [
            {
              id: "action",
              icon: "play",
              tooltip: "test",
              isVisible: { binding: "enabled" },
              action: { type: "doStuff" },
            },
          ],
        },
      ],
    });

    const adapted = adaptPlugin(source);
    const state = { plugins: { "test-plugin": { count: 0, enabled: true } } };
    expect(adapted.toolbarActionGroups![0].actions[0].isVisible!(state)).toBe(true);
  });
});

describe("executeAction with payload bindings", () => {
  it("passes static payload to action handler", () => {
    const actionHandler = vi.fn();
    const source = makeMinimalPlugin({
      actions: { doStuff: actionHandler },
      commands: [
        {
          id: "test:cmd",
          title: "Test",
          keywords: [],
          category: "testing",
          action: { type: "doStuff", payload: { key: "value", num: 42 } },
        },
      ],
    });

    const adapted = adaptPlugin(source);
    adapted.commands![0].execute(makeServices());

    expect(actionHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ key: "value", num: 42 })
    );
  });

  it("resolves payload bindings from state", () => {
    const actionHandler = vi.fn();
    const source = makeMinimalPlugin({
      actions: { doStuff: actionHandler },
      commands: [
        {
          id: "test:cmd",
          title: "Test",
          keywords: [],
          category: "testing",
          action: {
            type: "doStuff",
            payload: { extra: "static" },
            payloadBindings: { currentCount: "count" },
          },
        },
      ],
    });

    const adapted = adaptPlugin(source);
    adapted.commands![0].execute(makeServices({ count: 42 }));

    expect(actionHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ extra: "static", currentCount: 42 })
    );
  });

  it("resolves nested payload bindings", () => {
    const actionHandler = vi.fn();
    const source = makeMinimalPlugin({
      actions: { doStuff: actionHandler },
      commands: [
        {
          id: "test:cmd",
          title: "Test",
          keywords: [],
          category: "testing",
          action: {
            type: "doStuff",
            payloadBindings: { value: "config.setting" },
          },
        },
      ],
    });

    const adapted = adaptPlugin(source);
    adapted.commands![0].execute(makeServices({ config: { setting: "abc" } }));

    expect(actionHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ value: "abc" })
    );
  });

  it("sets undefined for missing binding paths", () => {
    const actionHandler = vi.fn();
    const source = makeMinimalPlugin({
      actions: { doStuff: actionHandler },
      commands: [
        {
          id: "test:cmd",
          title: "Test",
          keywords: [],
          category: "testing",
          action: {
            type: "doStuff",
            payloadBindings: { missing: "nonexistent.deep.path" },
          },
        },
      ],
    });

    const adapted = adaptPlugin(source);
    adapted.commands![0].execute(makeServices());

    expect(actionHandler).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ missing: undefined })
    );
  });

  it("warns and returns for unknown action type", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const source = makeMinimalPlugin({
      commands: [
        {
          id: "test:cmd",
          title: "Test",
          keywords: [],
          category: "testing",
          action: { type: "nonexistent" },
        },
      ],
    });

    const adapted = adaptPlugin(source);
    adapted.commands![0].execute(makeServices());

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("nonexistent"));
    warnSpy.mockRestore();
  });
});

describe("plugin context via initialize", () => {
  it("dispatch calls action handlers with context", () => {
    const incrementHandler = vi.fn();
    const source = makeMinimalPlugin({
      actions: {
        increment: incrementHandler,
        dispatchTest: (ctx) => {
          ctx.dispatch("increment");
        },
      },
      onLoad: (ctx) => {
        ctx.dispatch("dispatchTest");
      },
    });

    const adapted = adaptPlugin(source);
    adapted.initialize!(makeServices());

    expect(incrementHandler).toHaveBeenCalled();
  });

  it("ctx.getState reads plugin-specific state", () => {
    let capturedState: unknown;
    const source = makeMinimalPlugin({
      onLoad: (ctx) => {
        capturedState = ctx.getState();
      },
    });

    const adapted = adaptPlugin(source);
    adapted.initialize!(makeServices({ count: 42, enabled: false }));

    expect(capturedState).toEqual({ count: 42, enabled: false });
  });

  it("ctx.setState calls services.setState", () => {
    const source = makeMinimalPlugin({
      onLoad: (ctx) => {
        ctx.setState({ count: 99 } as never);
      },
    });

    const adapted = adaptPlugin(source);
    const services = makeServices();
    adapted.initialize!(services);

    expect(services.setState).toHaveBeenCalledWith({ count: 99 });
  });

  it("ctx.openInspector delegates to services", () => {
    const source = makeMinimalPlugin({
      onLoad: (ctx) => {
        ctx.openInspector("my-panel", { foo: "bar" });
      },
    });

    const adapted = adaptPlugin(source);
    const services = makeServices();
    adapted.initialize!(services);

    expect(services.openInspector).toHaveBeenCalledWith("my-panel", { foo: "bar" });
  });

  it("ctx.closeInspector delegates to services", () => {
    const source = makeMinimalPlugin({
      onLoad: (ctx) => {
        ctx.closeInspector();
      },
    });

    const adapted = adaptPlugin(source);
    const services = makeServices();
    adapted.initialize!(services);

    expect(services.closeInspector).toHaveBeenCalled();
  });

  it("ctx.registerBrowserAction registers handler for later use", async () => {
    const handler = vi.fn().mockResolvedValue({ success: true, data: "screenshot" });

    const source = makeMinimalPlugin({
      onLoad: async (ctx) => {
        ctx.registerBrowserAction("capture", handler);
        const result = await ctx.requestBrowserAction("capture", { sel: ".btn" });
        expect(result.success).toBe(true);
      },
    });

    const adapted = adaptPlugin(source);
    adapted.initialize!(makeServices());
    expect(handler).toHaveBeenCalledWith({ sel: ".btn" });
  });

  it("initialize sets up onConnectionChange for re-triggering onLoad", () => {
    const onLoad = vi.fn();
    const source = makeMinimalPlugin({
      messageHandlers: { "test:msg": vi.fn() },
      onLoad,
    });

    const adapted = adaptPlugin(source);
    const services = makeServices();
    adapted.initialize!(services);

    // onLoad called once during initialize
    expect(onLoad).toHaveBeenCalledTimes(1);

    // onConnectionChange should have been called
    expect(services.websocket.onConnectionChange).toHaveBeenCalled();

    // Simulate reconnection by calling the connection handler
    const connectionHandler = (services.websocket.onConnectionChange as ReturnType<typeof vi.fn>).mock.calls[0][0];
    connectionHandler(true);

    // onLoad should be called again
    expect(onLoad).toHaveBeenCalledTimes(2);
  });

  it("initialize without onLoad or messageHandlers returns undefined", () => {
    const source = makeMinimalPlugin();
    const adapted = adaptPlugin(source);
    const result = adapted.initialize!(makeServices());
    expect(result).toBeUndefined();
  });

  it("cleanup function unsubscribes all websocket handlers", () => {
    const unsub1 = vi.fn();
    const unsub2 = vi.fn();
    const unsubConn = vi.fn();

    const services = makeServices();
    (services.websocket.on as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce(unsub1)
      .mockReturnValueOnce(unsub2);
    (services.websocket.onConnectionChange as ReturnType<typeof vi.fn>).mockReturnValueOnce(unsubConn);

    const source = makeMinimalPlugin({
      messageHandlers: {
        "msg:one": vi.fn(),
        "msg:two": vi.fn(),
      },
    });

    const adapted = adaptPlugin(source);
    const cleanup = adapted.initialize!(services) as () => void;

    // Call cleanup
    cleanup();

    expect(unsub1).toHaveBeenCalled();
    expect(unsub2).toHaveBeenCalled();
    expect(unsubConn).toHaveBeenCalled();
  });

  it("websocket message handler calls plugin handler with context", () => {
    const messageHandler = vi.fn();
    const source = makeMinimalPlugin({
      messageHandlers: {
        "lint:result": messageHandler,
      },
    });

    const adapted = adaptPlugin(source);
    const services = makeServices();
    adapted.initialize!(services);

    // Get the registered handler and call it
    const registeredHandler = (services.websocket.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
    const testMessage = { type: "lint:result", data: [1, 2, 3] };
    registeredHandler(testMessage);

    expect(messageHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        getState: expect.any(Function),
        setState: expect.any(Function),
        dispatch: expect.any(Function),
      }),
      testMessage
    );
  });
});

describe("createSlice setters", () => {
  it("generated setter calls services.setState", () => {
    const source = makeMinimalPlugin({
      state: {
        initialState: { count: 0, label: "hi" },
      },
    });

    const adapted = adaptPlugin(source);
    const services = makeServices();
    const slice = adapted.createSlice!(services) as Record<string, unknown>;

    // Call the generated setter
    (slice.setCount as (v: number) => void)(42);
    expect(services.setState).toHaveBeenCalledWith({ count: 42 });

    (slice.setLabel as (v: string) => void)("world");
    expect(services.setState).toHaveBeenCalledWith({ label: "world" });
  });
});

describe("adaptPlugins", () => {
  it("adapts multiple plugins", () => {
    const sources = [
      makeMinimalPlugin({ id: "p1", name: "Plugin 1" }),
      makeMinimalPlugin({ id: "p2", name: "Plugin 2" }),
    ];

    const adapted = adaptPlugins(sources);

    expect(adapted).toHaveLength(2);
    expect(adapted[0].id).toBe("p1");
    expect(adapted[1].id).toBe("p2");
  });

  it("returns empty array for empty input", () => {
    const adapted = adaptPlugins([]);
    expect(adapted).toHaveLength(0);
  });
});

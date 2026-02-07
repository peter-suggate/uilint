import { describe, it, expect, beforeEach } from "vitest";
import {
  PluginRegistry,
  PluginRegistrationError,
  type PluginWithHandlers,
} from "../../src/plugin/index.js";

/**
 * Helper to create a minimal valid plugin for testing.
 */
function createTestPlugin(
  overrides: Partial<PluginWithHandlers> = {}
): PluginWithHandlers {
  return {
    id: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    state: {
      initialState: { counter: 0 },
    },
    ...overrides,
  };
}

describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  describe("registration", () => {
    it("registers a plugin and retrieves it by id", () => {
      const plugin = createTestPlugin({ id: "my-plugin" });

      registry.register(plugin);

      const retrieved = registry.get("my-plugin");
      expect(retrieved).toBe(plugin);
    });

    it("returns undefined for unregistered plugin id", () => {
      const result = registry.get("nonexistent");
      expect(result).toBeUndefined();
    });

    it("reports whether a plugin is registered via has()", () => {
      const plugin = createTestPlugin({ id: "check-plugin" });

      expect(registry.has("check-plugin")).toBe(false);

      registry.register(plugin);

      expect(registry.has("check-plugin")).toBe(true);
    });

    it("returns all registered plugins via getAll()", () => {
      const plugin1 = createTestPlugin({ id: "plugin-1", name: "Plugin 1" });
      const plugin2 = createTestPlugin({ id: "plugin-2", name: "Plugin 2" });

      registry.register(plugin1);
      registry.register(plugin2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(plugin1);
      expect(all).toContain(plugin2);
    });

    it("returns plugin IDs via getIds()", () => {
      registry.register(createTestPlugin({ id: "alpha" }));
      registry.register(createTestPlugin({ id: "beta" }));

      const ids = registry.getIds();
      expect(ids).toEqual(["alpha", "beta"]);
    });

    it("tracks plugin count via size property", () => {
      expect(registry.size).toBe(0);

      registry.register(createTestPlugin({ id: "first" }));
      expect(registry.size).toBe(1);

      registry.register(createTestPlugin({ id: "second" }));
      expect(registry.size).toBe(2);
    });

    it("maintains registration order", () => {
      registry.register(createTestPlugin({ id: "c-plugin" }));
      registry.register(createTestPlugin({ id: "a-plugin" }));
      registry.register(createTestPlugin({ id: "b-plugin" }));

      const ids = registry.getIds();
      expect(ids).toEqual(["c-plugin", "a-plugin", "b-plugin"]);

      const all = registry.getAll();
      expect(all.map((p) => p.id)).toEqual(["c-plugin", "a-plugin", "b-plugin"]);
    });

    it("throws when registering plugin without id", () => {
      const plugin = createTestPlugin({ id: "" });

      expect(() => registry.register(plugin)).toThrow(PluginRegistrationError);
      expect(() => registry.register(plugin)).toThrow("must have an id");
    });

    it("throws when registering plugin without name", () => {
      const plugin = createTestPlugin({ id: "no-name", name: "" });

      expect(() => registry.register(plugin)).toThrow(PluginRegistrationError);
      expect(() => registry.register(plugin)).toThrow("must have a name");
    });

    it("throws when registering plugin without version", () => {
      const plugin = createTestPlugin({ id: "no-version", version: "" });

      expect(() => registry.register(plugin)).toThrow(PluginRegistrationError);
      expect(() => registry.register(plugin)).toThrow("must have a version");
    });

    it("throws when registering plugin without state definition", () => {
      const plugin = {
        id: "no-state",
        name: "No State Plugin",
        version: "1.0.0",
        state: undefined,
      } as unknown as PluginWithHandlers;

      expect(() => registry.register(plugin)).toThrow(PluginRegistrationError);
      expect(() => registry.register(plugin)).toThrow("must have a state");
    });

    it("throws when registering duplicate plugin id", () => {
      const plugin1 = createTestPlugin({ id: "duplicate" });
      const plugin2 = createTestPlugin({ id: "duplicate", name: "Duplicate 2" });

      registry.register(plugin1);

      expect(() => registry.register(plugin2)).toThrow(PluginRegistrationError);
      expect(() => registry.register(plugin2)).toThrow("already registered");
    });
  });

  describe("unregistration", () => {
    it("unregisters a plugin and returns true", () => {
      registry.register(createTestPlugin({ id: "to-remove" }));
      expect(registry.has("to-remove")).toBe(true);

      const result = registry.unregister("to-remove");

      expect(result).toBe(true);
      expect(registry.has("to-remove")).toBe(false);
    });

    it("returns false when unregistering nonexistent plugin", () => {
      const result = registry.unregister("nonexistent");
      expect(result).toBe(false);
    });

    it("removes plugin from getAll() results", () => {
      registry.register(createTestPlugin({ id: "keep" }));
      registry.register(createTestPlugin({ id: "remove" }));

      registry.unregister("remove");

      const all = registry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe("keep");
    });

    it("removes plugin from getIds() results", () => {
      registry.register(createTestPlugin({ id: "stay" }));
      registry.register(createTestPlugin({ id: "go" }));

      registry.unregister("go");

      expect(registry.getIds()).toEqual(["stay"]);
    });

    it("decrements size after unregistration", () => {
      registry.register(createTestPlugin({ id: "one" }));
      registry.register(createTestPlugin({ id: "two" }));
      expect(registry.size).toBe(2);

      registry.unregister("one");
      expect(registry.size).toBe(1);
    });
  });

  describe("clear()", () => {
    it("removes all registered plugins", () => {
      registry.register(createTestPlugin({ id: "first" }));
      registry.register(createTestPlugin({ id: "second" }));
      registry.register(createTestPlugin({ id: "third" }));

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getAll()).toEqual([]);
      expect(registry.getIds()).toEqual([]);
    });
  });

  describe("subscription", () => {
    it("notifies listeners when plugin is registered", () => {
      const events: Array<{ type: string; pluginId?: string }> = [];
      registry.subscribe((event) => {
        events.push({
          type: event.type,
          pluginId: event.type === "registered" ? event.plugin.id : event.pluginId,
        });
      });

      registry.register(createTestPlugin({ id: "notified" }));

      expect(events).toEqual([{ type: "registered", pluginId: "notified" }]);
    });

    it("notifies listeners when plugin is unregistered", () => {
      const events: Array<{ type: string; pluginId?: string }> = [];
      registry.register(createTestPlugin({ id: "to-unregister" }));

      registry.subscribe((event) => {
        events.push({
          type: event.type,
          pluginId: event.type === "registered" ? event.plugin.id : event.pluginId,
        });
      });

      registry.unregister("to-unregister");

      expect(events).toEqual([{ type: "unregistered", pluginId: "to-unregister" }]);
    });

    it("returns unsubscribe function that stops notifications", () => {
      const events: string[] = [];
      const unsubscribe = registry.subscribe((event) => {
        events.push(event.type);
      });

      registry.register(createTestPlugin({ id: "before-unsub" }));
      expect(events).toEqual(["registered"]);

      unsubscribe();

      registry.register(createTestPlugin({ id: "after-unsub" }));
      expect(events).toEqual(["registered"]); // No new events
    });

    it("handles listener errors gracefully", () => {
      const goodEvents: string[] = [];

      registry.subscribe(() => {
        throw new Error("Listener error");
      });
      registry.subscribe((event) => {
        goodEvents.push(event.type);
      });

      // Should not throw, and good listener should still be called
      expect(() => registry.register(createTestPlugin({ id: "error-test" }))).not.toThrow();
      expect(goodEvents).toEqual(["registered"]);
    });
  });

  describe("dependency sorting", () => {
    it("sorts plugins with no dependencies in registration order", () => {
      registry.register(createTestPlugin({ id: "c" }));
      registry.register(createTestPlugin({ id: "a" }));
      registry.register(createTestPlugin({ id: "b" }));

      const sorted = registry.getSortedByDependencies();
      expect(sorted.map((p) => p.id)).toEqual(["c", "a", "b"]);
    });

    it("places dependencies before dependents", () => {
      registry.register(createTestPlugin({ id: "child", dependencies: ["parent"] }));
      registry.register(createTestPlugin({ id: "parent" }));

      const sorted = registry.getSortedByDependencies();
      const ids = sorted.map((p) => p.id);

      expect(ids.indexOf("parent")).toBeLessThan(ids.indexOf("child"));
    });

    it("handles deep dependency chains", () => {
      registry.register(createTestPlugin({ id: "level-3", dependencies: ["level-2"] }));
      registry.register(createTestPlugin({ id: "level-1" }));
      registry.register(createTestPlugin({ id: "level-2", dependencies: ["level-1"] }));

      const sorted = registry.getSortedByDependencies();
      const ids = sorted.map((p) => p.id);

      expect(ids.indexOf("level-1")).toBeLessThan(ids.indexOf("level-2"));
      expect(ids.indexOf("level-2")).toBeLessThan(ids.indexOf("level-3"));
    });

    it("throws on circular dependency", () => {
      registry.register(createTestPlugin({ id: "a", dependencies: ["b"] }));
      registry.register(createTestPlugin({ id: "b", dependencies: ["a"] }));

      expect(() => registry.getSortedByDependencies()).toThrow("Circular dependency");
    });

    it("throws when dependency is not registered", () => {
      registry.register(createTestPlugin({ id: "orphan", dependencies: ["missing"] }));

      expect(() => registry.getSortedByDependencies()).toThrow(
        'depends on "missing" which is not registered'
      );
    });
  });
});

describe("type guards", () => {
  it("isDataBinding identifies data bindings", async () => {
    const { isDataBinding } = await import("../../src/plugin/types.js");

    expect(isDataBinding({ binding: "foo.bar" })).toBe(true);
    expect(isDataBinding({ binding: "" })).toBe(true);
    expect(isDataBinding({ expression: "foo" })).toBe(false);
    expect(isDataBinding("string")).toBe(false);
    expect(isDataBinding(null)).toBe(false);
    expect(isDataBinding(undefined)).toBe(false);
  });

  it("isExpressionBinding identifies expression bindings", async () => {
    const { isExpressionBinding } = await import("../../src/plugin/types.js");

    expect(isExpressionBinding({ expression: "a > b" })).toBe(true);
    expect(isExpressionBinding({ expression: "" })).toBe(true);
    expect(isExpressionBinding({ binding: "foo" })).toBe(false);
    expect(isExpressionBinding("string")).toBe(false);
    expect(isExpressionBinding(null)).toBe(false);
  });

  it("isConditionalValue identifies conditional values", async () => {
    const { isConditionalValue } = await import("../../src/plugin/types.js");

    expect(
      isConditionalValue({
        condition: { binding: "active" },
        true: "Yes",
        false: "No",
      })
    ).toBe(true);

    expect(isConditionalValue({ binding: "foo" })).toBe(false);
    expect(isConditionalValue({ condition: {} })).toBe(false);
    expect(isConditionalValue("string")).toBe(false);
  });
});

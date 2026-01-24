/**
 * Tests for Plugin Registry
 *
 * Comprehensive tests for the plugin registration system, dependency resolution,
 * and aggregation of plugin contributions.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sortByDependencies, PluginRegistry } from "./registry";
import type {
  Plugin,
  PluginServices,
  Command,
  Analyzer,
  InspectorPanel,
  RuleUIContribution,
  RuleMeta,
} from "./types";

// ============================================================================
// Mock Factory Functions
// ============================================================================

/**
 * Create a minimal mock plugin for testing
 */
function createMockPlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    id: "test-plugin",
    name: "Test Plugin",
    version: "1.0.0",
    ...overrides,
  };
}

/**
 * Create mock plugin services for testing
 */
function createMockPluginServices(): PluginServices {
  return {
    websocket: {
      isConnected: false,
      url: "ws://localhost:3000",
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn(),
      on: vi.fn(() => vi.fn()),
      onConnectionChange: vi.fn(() => vi.fn()),
    },
    domObserver: {
      start: vi.fn(),
      stop: vi.fn(),
      onElementsAdded: vi.fn(() => vi.fn()),
      onElementsRemoved: vi.fn(() => vi.fn()),
    },
    getState: vi.fn(() => ({})),
    setState: vi.fn(),
    openInspector: vi.fn(),
    closeCommandPalette: vi.fn(),
  };
}

/**
 * Create a mock command for testing
 */
function createMockCommand(overrides: Partial<Command> = {}): Command {
  return {
    id: "test-command",
    title: "Test Command",
    keywords: ["test"],
    category: "actions",
    execute: vi.fn(),
    ...overrides,
  };
}

/**
 * Create a mock analyzer for testing
 */
function createMockAnalyzer(overrides: Partial<Analyzer> = {}): Analyzer {
  return {
    id: "test-analyzer",
    name: "Test Analyzer",
    triggers: ["manual"],
    requiresConnection: false,
    analyze: vi.fn(() => []),
    ...overrides,
  };
}

/**
 * Create a mock inspector panel for testing
 */
function createMockInspectorPanel(
  overrides: Partial<InspectorPanel> = {}
): InspectorPanel {
  return {
    id: "test-panel",
    title: "Test Panel",
    component: () => null,
    ...overrides,
  };
}

/**
 * Create a mock rule meta for testing
 */
function createMockRuleMeta(overrides: Partial<RuleMeta> = {}): RuleMeta {
  return {
    id: "test/rule",
    name: "Test Rule",
    description: "A test rule",
    category: "static",
    defaultSeverity: "warn",
    ...overrides,
  };
}

// ============================================================================
// sortByDependencies Tests
// ============================================================================

describe("sortByDependencies", () => {
  it("returns empty array for empty input", () => {
    const result = sortByDependencies([]);
    expect(result).toEqual([]);
  });

  it("returns single plugin unchanged when it has no dependencies", () => {
    const plugin = createMockPlugin({ id: "solo" });
    const result = sortByDependencies([plugin]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("solo");
  });

  it("sorts plugins with dependencies in correct order", () => {
    const pluginA = createMockPlugin({ id: "a", dependencies: ["b", "c"] });
    const pluginB = createMockPlugin({ id: "b", dependencies: ["c"] });
    const pluginC = createMockPlugin({ id: "c" });

    // Input in wrong order
    const result = sortByDependencies([pluginA, pluginB, pluginC]);

    // C should come first (no deps), then B (depends on C), then A (depends on B, C)
    expect(result.map((p) => p.id)).toEqual(["c", "b", "a"]);
  });

  it("handles diamond dependency pattern correctly", () => {
    // Diamond: D depends on B and C, both B and C depend on A
    const pluginA = createMockPlugin({ id: "a" });
    const pluginB = createMockPlugin({ id: "b", dependencies: ["a"] });
    const pluginC = createMockPlugin({ id: "c", dependencies: ["a"] });
    const pluginD = createMockPlugin({ id: "d", dependencies: ["b", "c"] });

    const result = sortByDependencies([pluginD, pluginC, pluginB, pluginA]);

    // A must come first, then B and C (order between them doesn't matter), then D
    const indexA = result.findIndex((p) => p.id === "a");
    const indexB = result.findIndex((p) => p.id === "b");
    const indexC = result.findIndex((p) => p.id === "c");
    const indexD = result.findIndex((p) => p.id === "d");

    expect(indexA).toBeLessThan(indexB);
    expect(indexA).toBeLessThan(indexC);
    expect(indexB).toBeLessThan(indexD);
    expect(indexC).toBeLessThan(indexD);
  });

  it("throws error on circular dependency", () => {
    const pluginA = createMockPlugin({ id: "a", dependencies: ["b"] });
    const pluginB = createMockPlugin({ id: "b", dependencies: ["a"] });

    expect(() => sortByDependencies([pluginA, pluginB])).toThrow(
      /Circular dependency detected/
    );
  });

  it("throws error on self-dependency (circular)", () => {
    const plugin = createMockPlugin({ id: "self", dependencies: ["self"] });

    expect(() => sortByDependencies([plugin])).toThrow(
      /Circular dependency detected/
    );
  });

  it("throws error on longer circular chain", () => {
    const pluginA = createMockPlugin({ id: "a", dependencies: ["b"] });
    const pluginB = createMockPlugin({ id: "b", dependencies: ["c"] });
    const pluginC = createMockPlugin({ id: "c", dependencies: ["a"] });

    expect(() => sortByDependencies([pluginA, pluginB, pluginC])).toThrow(
      /Circular dependency detected/
    );
  });

  it("handles missing dependencies gracefully by ignoring them", () => {
    // Plugin depends on a plugin that doesn't exist in the array
    const pluginA = createMockPlugin({ id: "a", dependencies: ["missing"] });
    const pluginB = createMockPlugin({ id: "b" });

    // Should not throw, just ignores missing dependency
    const result = sortByDependencies([pluginA, pluginB]);

    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toContain("a");
    expect(result.map((p) => p.id)).toContain("b");
  });

  it("preserves relative order for plugins with no dependency relationship", () => {
    const pluginA = createMockPlugin({ id: "a" });
    const pluginB = createMockPlugin({ id: "b" });
    const pluginC = createMockPlugin({ id: "c" });

    const result = sortByDependencies([pluginA, pluginB, pluginC]);

    // Order should be preserved when there are no dependencies
    expect(result.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("handles plugins with undefined dependencies", () => {
    const plugin = createMockPlugin({ id: "a", dependencies: undefined });
    const result = sortByDependencies([plugin]);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("a");
  });
});

// ============================================================================
// PluginRegistry Tests
// ============================================================================

describe("PluginRegistry", () => {
  let registry: PluginRegistry;
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    registry = new PluginRegistry();
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  // --------------------------------------------------------------------------
  // register() Tests
  // --------------------------------------------------------------------------

  describe("register()", () => {
    it("adds plugin to internal map", () => {
      const plugin = createMockPlugin({ id: "my-plugin" });

      registry.register(plugin);

      expect(registry.isRegistered("my-plugin")).toBe(true);
      expect(registry.getPlugin("my-plugin")).toBe(plugin);
    });

    it("logs registration message", () => {
      const plugin = createMockPlugin({ id: "my-plugin" });

      registry.register(plugin);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Registering plugin: my-plugin")
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("registered successfully")
      );
    });

    it("warns and skips on duplicate registration", () => {
      const plugin = createMockPlugin({ id: "duplicate" });

      registry.register(plugin);
      registry.register(plugin);

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Plugin "duplicate" is already registered')
      );
      // Should still only have one plugin
      expect(registry.getPlugins()).toHaveLength(1);
    });

    it("warns about missing dependencies but still registers", () => {
      const plugin = createMockPlugin({
        id: "dependent",
        dependencies: ["missing-dep-1", "missing-dep-2"],
      });

      registry.register(plugin);

      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining("has unregistered dependencies")
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining("missing-dep-1")
      );
      expect(registry.isRegistered("dependent")).toBe(true);
    });

    it("does not warn when dependencies are already registered", () => {
      const depPlugin = createMockPlugin({ id: "dependency" });
      const plugin = createMockPlugin({
        id: "dependent",
        dependencies: ["dependency"],
      });

      registry.register(depPlugin);
      registry.register(plugin);

      // Should not warn about missing dependencies
      expect(consoleSpy.warn).not.toHaveBeenCalledWith(
        expect.stringContaining("has unregistered dependencies")
      );
    });
  });

  // --------------------------------------------------------------------------
  // getPlugin() Tests
  // --------------------------------------------------------------------------

  describe("getPlugin()", () => {
    it("returns registered plugin by ID", () => {
      const plugin = createMockPlugin({ id: "findme" });
      registry.register(plugin);

      const found = registry.getPlugin("findme");

      expect(found).toBe(plugin);
    });

    it("returns undefined for unknown plugin ID", () => {
      const found = registry.getPlugin("nonexistent");

      expect(found).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // getPlugins() Tests
  // --------------------------------------------------------------------------

  describe("getPlugins()", () => {
    it("returns empty array when no plugins registered", () => {
      const plugins = registry.getPlugins();

      expect(plugins).toEqual([]);
    });

    it("returns all registered plugins", () => {
      const plugin1 = createMockPlugin({ id: "plugin-1" });
      const plugin2 = createMockPlugin({ id: "plugin-2" });
      const plugin3 = createMockPlugin({ id: "plugin-3" });

      registry.register(plugin1);
      registry.register(plugin2);
      registry.register(plugin3);

      const plugins = registry.getPlugins();

      expect(plugins).toHaveLength(3);
      expect(plugins).toContain(plugin1);
      expect(plugins).toContain(plugin2);
      expect(plugins).toContain(plugin3);
    });
  });

  // --------------------------------------------------------------------------
  // isRegistered() Tests
  // --------------------------------------------------------------------------

  describe("isRegistered()", () => {
    it("returns true for registered plugin", () => {
      const plugin = createMockPlugin({ id: "registered" });
      registry.register(plugin);

      expect(registry.isRegistered("registered")).toBe(true);
    });

    it("returns false for unregistered plugin", () => {
      expect(registry.isRegistered("not-registered")).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // getAllCommands() Tests
  // --------------------------------------------------------------------------

  describe("getAllCommands()", () => {
    it("returns empty array when no plugins have commands", () => {
      const plugin = createMockPlugin({ id: "no-commands" });
      registry.register(plugin);

      const commands = registry.getAllCommands();

      expect(commands).toEqual([]);
    });

    it("aggregates commands from all plugins", () => {
      const cmd1 = createMockCommand({ id: "cmd-1" });
      const cmd2 = createMockCommand({ id: "cmd-2" });
      const cmd3 = createMockCommand({ id: "cmd-3" });

      const plugin1 = createMockPlugin({ id: "p1", commands: [cmd1, cmd2] });
      const plugin2 = createMockPlugin({ id: "p2", commands: [cmd3] });
      const plugin3 = createMockPlugin({ id: "p3" }); // No commands

      registry.register(plugin1);
      registry.register(plugin2);
      registry.register(plugin3);

      const commands = registry.getAllCommands();

      expect(commands).toHaveLength(3);
      expect(commands).toContain(cmd1);
      expect(commands).toContain(cmd2);
      expect(commands).toContain(cmd3);
    });
  });

  // --------------------------------------------------------------------------
  // getAllAnalyzers() Tests
  // --------------------------------------------------------------------------

  describe("getAllAnalyzers()", () => {
    it("returns empty array when no plugins have analyzers", () => {
      const plugin = createMockPlugin({ id: "no-analyzers" });
      registry.register(plugin);

      const analyzers = registry.getAllAnalyzers();

      expect(analyzers).toEqual([]);
    });

    it("aggregates analyzers from all plugins", () => {
      const analyzer1 = createMockAnalyzer({ id: "analyzer-1" });
      const analyzer2 = createMockAnalyzer({ id: "analyzer-2" });

      const plugin1 = createMockPlugin({ id: "p1", analyzers: [analyzer1] });
      const plugin2 = createMockPlugin({ id: "p2", analyzers: [analyzer2] });

      registry.register(plugin1);
      registry.register(plugin2);

      const analyzers = registry.getAllAnalyzers();

      expect(analyzers).toHaveLength(2);
      expect(analyzers).toContain(analyzer1);
      expect(analyzers).toContain(analyzer2);
    });
  });

  // --------------------------------------------------------------------------
  // getAllInspectorPanels() Tests
  // --------------------------------------------------------------------------

  describe("getAllInspectorPanels()", () => {
    it("returns empty array when no plugins have panels", () => {
      const plugin = createMockPlugin({ id: "no-panels" });
      registry.register(plugin);

      const panels = registry.getAllInspectorPanels();

      expect(panels).toEqual([]);
    });

    it("aggregates panels from all plugins", () => {
      const panel1 = createMockInspectorPanel({ id: "panel-1" });
      const panel2 = createMockInspectorPanel({ id: "panel-2" });

      const plugin1 = createMockPlugin({ id: "p1", inspectorPanels: [panel1] });
      const plugin2 = createMockPlugin({ id: "p2", inspectorPanels: [panel2] });

      registry.register(plugin1);
      registry.register(plugin2);

      const panels = registry.getAllInspectorPanels();

      expect(panels).toHaveLength(2);
      expect(panels).toContain(panel1);
      expect(panels).toContain(panel2);
    });

    it("sorts panels by priority (higher priority first)", () => {
      const lowPriority = createMockInspectorPanel({
        id: "low",
        priority: 10,
      });
      const highPriority = createMockInspectorPanel({
        id: "high",
        priority: 100,
      });
      const mediumPriority = createMockInspectorPanel({
        id: "medium",
        priority: 50,
      });
      const noPriority = createMockInspectorPanel({ id: "none" }); // defaults to 0

      const plugin = createMockPlugin({
        id: "p1",
        inspectorPanels: [lowPriority, highPriority, mediumPriority, noPriority],
      });

      registry.register(plugin);

      const panels = registry.getAllInspectorPanels();

      expect(panels[0].id).toBe("high");
      expect(panels[1].id).toBe("medium");
      expect(panels[2].id).toBe("low");
      expect(panels[3].id).toBe("none");
    });
  });

  // --------------------------------------------------------------------------
  // getPluginForRule() Tests
  // --------------------------------------------------------------------------

  describe("getPluginForRule()", () => {
    it("finds plugin by explicit ruleContributions", () => {
      const contribution: RuleUIContribution = {
        ruleId: "my-rule/specific",
      };

      const plugin = createMockPlugin({
        id: "rule-contributor",
        ruleContributions: [contribution],
      });
      const otherPlugin = createMockPlugin({ id: "other" });

      registry.register(plugin);
      registry.register(otherPlugin);

      const ruleMeta = createMockRuleMeta({ id: "my-rule/specific" });
      const found = registry.getPluginForRule("my-rule/specific", ruleMeta);

      expect(found).toBe(plugin);
    });

    it("finds plugin by rule prefix matching plugin ID", () => {
      const plugin = createMockPlugin({ id: "semantic" });

      registry.register(plugin);

      const ruleMeta = createMockRuleMeta({ id: "semantic/button-role" });
      const found = registry.getPluginForRule("semantic/button-role", ruleMeta);

      expect(found).toBe(plugin);
    });

    it("finds plugin by ruleCategories match", () => {
      const plugin = createMockPlugin({
        id: "category-handler",
        ruleCategories: ["semantic", "accessibility"],
      });

      registry.register(plugin);

      const ruleMeta = createMockRuleMeta({
        id: "other/rule",
        category: "semantic",
      });
      const found = registry.getPluginForRule("other/rule", ruleMeta);

      expect(found).toBe(plugin);
    });

    it("returns core plugin as fallback when available", () => {
      const corePlugin = createMockPlugin({ id: "core" });
      const otherPlugin = createMockPlugin({ id: "other" });

      registry.register(corePlugin);
      registry.register(otherPlugin);

      const ruleMeta = createMockRuleMeta({ id: "unknown/rule" });
      const found = registry.getPluginForRule("unknown/rule", ruleMeta);

      expect(found).toBe(corePlugin);
    });

    it("returns first registered plugin when no core plugin exists", () => {
      const firstPlugin = createMockPlugin({ id: "first" });
      const secondPlugin = createMockPlugin({ id: "second" });

      registry.register(firstPlugin);
      registry.register(secondPlugin);

      const ruleMeta = createMockRuleMeta({ id: "unknown/rule" });
      const found = registry.getPluginForRule("unknown/rule", ruleMeta);

      expect(found).toBe(firstPlugin);
    });

    it("returns minimal default plugin when no plugins registered", () => {
      const ruleMeta = createMockRuleMeta({ id: "any/rule" });
      const found = registry.getPluginForRule("any/rule", ruleMeta);

      expect(found.id).toBe("default");
      expect(found.name).toBe("Default");
      expect(found.version).toBe("1.0.0");
    });

    it("prioritizes explicit ruleContributions over prefix matching", () => {
      const contribution: RuleUIContribution = {
        ruleId: "semantic/button-role",
      };

      const contributorPlugin = createMockPlugin({
        id: "contributor",
        ruleContributions: [contribution],
      });
      const prefixPlugin = createMockPlugin({ id: "semantic" });

      registry.register(contributorPlugin);
      registry.register(prefixPlugin);

      const ruleMeta = createMockRuleMeta({ id: "semantic/button-role" });
      const found = registry.getPluginForRule("semantic/button-role", ruleMeta);

      expect(found).toBe(contributorPlugin);
    });
  });

  // --------------------------------------------------------------------------
  // getRuleContribution() Tests
  // --------------------------------------------------------------------------

  describe("getRuleContribution()", () => {
    it("returns contribution config for matching rule", () => {
      const contribution: RuleUIContribution = {
        ruleId: "test/rule",
        heatmapColor: "#ff0000",
      };

      const plugin = createMockPlugin({
        id: "contributor",
        ruleContributions: [contribution],
      });

      registry.register(plugin);

      const found = registry.getRuleContribution("test/rule");

      expect(found).toBe(contribution);
    });

    it("returns undefined for unknown rule", () => {
      const plugin = createMockPlugin({
        id: "contributor",
        ruleContributions: [{ ruleId: "other/rule" }],
      });

      registry.register(plugin);

      const found = registry.getRuleContribution("unknown/rule");

      expect(found).toBeUndefined();
    });

    it("returns undefined when no plugins have contributions", () => {
      const plugin = createMockPlugin({ id: "no-contributions" });
      registry.register(plugin);

      const found = registry.getRuleContribution("any/rule");

      expect(found).toBeUndefined();
    });

    it("finds contribution across multiple plugins", () => {
      const contribution: RuleUIContribution = {
        ruleId: "target/rule",
        icon: "icon",
      };

      const plugin1 = createMockPlugin({
        id: "p1",
        ruleContributions: [{ ruleId: "other/rule" }],
      });
      const plugin2 = createMockPlugin({
        id: "p2",
        ruleContributions: [contribution],
      });

      registry.register(plugin1);
      registry.register(plugin2);

      const found = registry.getRuleContribution("target/rule");

      expect(found).toBe(contribution);
    });
  });

  // --------------------------------------------------------------------------
  // initializeAll() Tests
  // --------------------------------------------------------------------------

  describe("initializeAll()", () => {
    it("initializes plugins in dependency order", async () => {
      const initOrder: string[] = [];

      const pluginA = createMockPlugin({
        id: "a",
        dependencies: ["b"],
        initialize: vi.fn(() => {
          initOrder.push("a");
        }),
      });
      const pluginB = createMockPlugin({
        id: "b",
        initialize: vi.fn(() => {
          initOrder.push("b");
        }),
      });

      registry.register(pluginB);
      registry.register(pluginA);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      expect(initOrder).toEqual(["b", "a"]);
    });

    it("sets initialized flag after successful initialization", async () => {
      const plugin = createMockPlugin({
        id: "init-me",
        initialize: vi.fn(),
      });

      registry.register(plugin);

      expect(registry.isInitialized("init-me")).toBe(false);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      expect(registry.isInitialized("init-me")).toBe(true);
    });

    it("skips already initialized plugins", async () => {
      const initFn = vi.fn();
      const plugin = createMockPlugin({
        id: "skip-me",
        initialize: initFn,
      });

      registry.register(plugin);
      const services = createMockPluginServices();

      await registry.initializeAll(services);
      await registry.initializeAll(services);

      expect(initFn).toHaveBeenCalledTimes(1);
    });

    it("continues initialization even if one plugin fails", async () => {
      const successInit = vi.fn();

      const failPlugin = createMockPlugin({
        id: "fail",
        initialize: vi.fn(() => {
          throw new Error("Init failed");
        }),
      });
      const successPlugin = createMockPlugin({
        id: "success",
        initialize: successInit,
      });

      registry.register(failPlugin);
      registry.register(successPlugin);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize plugin "fail"'),
        expect.any(Error)
      );
      expect(successInit).toHaveBeenCalled();
      expect(registry.isInitialized("success")).toBe(true);
      // Failed plugin should not be marked as initialized
      expect(registry.isInitialized("fail")).toBe(false);
    });

    it("passes services to initialize function", async () => {
      const initFn = vi.fn();
      const plugin = createMockPlugin({
        id: "service-consumer",
        initialize: initFn,
      });

      registry.register(plugin);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      expect(initFn).toHaveBeenCalledWith(services);
    });

    it("stores services for later access", async () => {
      const plugin = createMockPlugin({ id: "p" });
      registry.register(plugin);

      expect(registry.getServices()).toBeNull();

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      expect(registry.getServices()).toBe(services);
    });

    it("handles plugins without initialize method", async () => {
      const plugin = createMockPlugin({ id: "no-init" });

      registry.register(plugin);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      expect(registry.isInitialized("no-init")).toBe(true);
    });

    it("handles async initialize functions", async () => {
      const initOrder: string[] = [];

      const plugin = createMockPlugin({
        id: "async-init",
        initialize: vi.fn(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          initOrder.push("async-init");
        }),
      });

      registry.register(plugin);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      expect(initOrder).toContain("async-init");
      expect(registry.isInitialized("async-init")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // disposeAll() Tests
  // --------------------------------------------------------------------------

  describe("disposeAll()", () => {
    it("calls dispose on all initialized plugins", async () => {
      const dispose1 = vi.fn();
      const dispose2 = vi.fn();

      const plugin1 = createMockPlugin({
        id: "p1",
        initialize: vi.fn(),
        dispose: dispose1,
      });
      const plugin2 = createMockPlugin({
        id: "p2",
        initialize: vi.fn(),
        dispose: dispose2,
      });

      registry.register(plugin1);
      registry.register(plugin2);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      registry.disposeAll();

      expect(dispose1).toHaveBeenCalled();
      expect(dispose2).toHaveBeenCalled();
    });

    it("disposes in reverse dependency order", async () => {
      const disposeOrder: string[] = [];

      const pluginA = createMockPlugin({
        id: "a",
        dependencies: ["b"],
        initialize: vi.fn(),
        dispose: vi.fn(() => {
          disposeOrder.push("a");
        }),
      });
      const pluginB = createMockPlugin({
        id: "b",
        initialize: vi.fn(),
        dispose: vi.fn(() => {
          disposeOrder.push("b");
        }),
      });

      registry.register(pluginB);
      registry.register(pluginA);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      registry.disposeAll();

      // A depends on B, so A should be disposed first (reverse order)
      expect(disposeOrder).toEqual(["a", "b"]);
    });

    it("skips uninitialized plugins", async () => {
      const dispose = vi.fn();
      const plugin = createMockPlugin({
        id: "not-initialized",
        dispose,
      });

      registry.register(plugin);

      // Don't call initializeAll

      registry.disposeAll();

      expect(dispose).not.toHaveBeenCalled();
    });

    it("clears initialized flag after dispose", async () => {
      const plugin = createMockPlugin({
        id: "disposable",
        initialize: vi.fn(),
        dispose: vi.fn(),
      });

      registry.register(plugin);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      expect(registry.isInitialized("disposable")).toBe(true);

      registry.disposeAll();

      expect(registry.isInitialized("disposable")).toBe(false);
    });

    it("clears services reference", async () => {
      const plugin = createMockPlugin({ id: "p" });
      registry.register(plugin);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      expect(registry.getServices()).toBe(services);

      registry.disposeAll();

      expect(registry.getServices()).toBeNull();
    });

    it("continues even if one plugin dispose fails", async () => {
      const dispose2 = vi.fn();

      const plugin1 = createMockPlugin({
        id: "fail-dispose",
        initialize: vi.fn(),
        dispose: vi.fn(() => {
          throw new Error("Dispose failed");
        }),
      });
      const plugin2 = createMockPlugin({
        id: "success-dispose",
        initialize: vi.fn(),
        dispose: dispose2,
      });

      registry.register(plugin1);
      registry.register(plugin2);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      registry.disposeAll();

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to dispose plugin "fail-dispose"'),
        expect.any(Error)
      );
      expect(dispose2).toHaveBeenCalled();
    });

    it("handles plugins without dispose method", async () => {
      const plugin = createMockPlugin({
        id: "no-dispose",
        initialize: vi.fn(),
      });

      registry.register(plugin);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      // Should not throw
      expect(() => registry.disposeAll()).not.toThrow();
    });
  });

  // --------------------------------------------------------------------------
  // clear() Tests
  // --------------------------------------------------------------------------

  describe("clear()", () => {
    it("removes all registered plugins", async () => {
      const plugin1 = createMockPlugin({ id: "p1" });
      const plugin2 = createMockPlugin({ id: "p2" });

      registry.register(plugin1);
      registry.register(plugin2);

      expect(registry.getPlugins()).toHaveLength(2);

      registry.clear();

      expect(registry.getPlugins()).toHaveLength(0);
      expect(registry.isRegistered("p1")).toBe(false);
      expect(registry.isRegistered("p2")).toBe(false);
    });

    it("calls disposeAll before clearing", async () => {
      const dispose = vi.fn();
      const plugin = createMockPlugin({
        id: "will-dispose",
        initialize: vi.fn(),
        dispose,
      });

      registry.register(plugin);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      registry.clear();

      expect(dispose).toHaveBeenCalled();
    });

    it("clears services reference", async () => {
      const plugin = createMockPlugin({ id: "p" });
      registry.register(plugin);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      registry.clear();

      expect(registry.getServices()).toBeNull();
    });

    it("allows re-registration after clear", () => {
      const plugin = createMockPlugin({ id: "reusable" });

      registry.register(plugin);
      registry.clear();
      registry.register(plugin);

      expect(registry.isRegistered("reusable")).toBe(true);
      expect(registry.getPlugins()).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------------
  // isInitialized() Tests
  // --------------------------------------------------------------------------

  describe("isInitialized()", () => {
    it("returns false for unregistered plugin", () => {
      expect(registry.isInitialized("nonexistent")).toBe(false);
    });

    it("returns false for registered but uninitialized plugin", () => {
      const plugin = createMockPlugin({ id: "registered" });
      registry.register(plugin);

      expect(registry.isInitialized("registered")).toBe(false);
    });

    it("returns true for initialized plugin", async () => {
      const plugin = createMockPlugin({
        id: "initialized",
        initialize: vi.fn(),
      });
      registry.register(plugin);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      expect(registry.isInitialized("initialized")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // getServices() Tests
  // --------------------------------------------------------------------------

  describe("getServices()", () => {
    it("returns null before initialization", () => {
      expect(registry.getServices()).toBeNull();
    });

    it("returns services after initialization", async () => {
      const plugin = createMockPlugin({ id: "p" });
      registry.register(plugin);

      const services = createMockPluginServices();
      await registry.initializeAll(services);

      expect(registry.getServices()).toBe(services);
    });
  });
});

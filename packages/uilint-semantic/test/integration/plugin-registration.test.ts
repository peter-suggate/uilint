/**
 * Integration Tests: Styleguide Plugin Registration
 *
 * Tests that verify the styleguide plugin integrates correctly with the
 * core plugin registry system.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PluginRegistry, pluginRegistry } from "uilint-core";

describe("Styleguide Plugin Integration", () => {
  describe("auto-registration", () => {
    it("registers with global pluginRegistry on import", async () => {
      // Import the styleguide package - this should trigger auto-registration
      await import("../../src/index.js");

      // Verify plugin is registered
      expect(pluginRegistry.has("styleguide")).toBe(true);

      const plugin = pluginRegistry.get("styleguide");
      expect(plugin).toBeDefined();
      expect(plugin?.name).toBe("Styleguide Checking");
    });

    it("exports plugin definition", async () => {
      const mod = await import("../../src/index.js");

      // Check plugin is exported
      expect(mod.styleguidePlugin).toBeDefined();
      expect(mod.styleguidePlugin.id).toBe("styleguide");
      expect(mod.styleguidePlugin.state).toBeDefined();
      expect(mod.styleguidePlugin.commands).toBeDefined();
      expect(mod.styleguidePlugin.panels).toBeDefined();
      expect(mod.styleguidePlugin.rules).toBeDefined();
    });
  });

  describe("plugin definition completeness", () => {
    it("has all required metadata", async () => {
      const { styleguidePlugin } = await import("../../src/index.js");

      expect(styleguidePlugin.id).toBe("styleguide");
      expect(styleguidePlugin.name).toBe("Styleguide Checking");
      expect(styleguidePlugin.version).toBe("1.0.0");
      expect(styleguidePlugin.description).toBeTruthy();
    });

    it("has valid state definition", async () => {
      const { styleguidePlugin } = await import("../../src/index.js");

      expect(styleguidePlugin.state).toBeDefined();
      expect(styleguidePlugin.state.initialState).toBeDefined();
      expect(styleguidePlugin.state.computed).toBeDefined();

      // Verify computed functions work
      const initialState = styleguidePlugin.state.initialState;
      const computed = styleguidePlugin.state.computed!;

      expect(computed.isReady(initialState)).toBe(false);
      expect(computed.isAnalyzing(initialState)).toBe(false);
      expect(computed.hasError(initialState)).toBe(false);
      expect(computed.progressPercent(initialState)).toBe(0);
    });

    it("has action handlers", async () => {
      const { styleguidePlugin } = await import("../../src/index.js");

      expect(styleguidePlugin.actions).toBeDefined();
      expect(typeof styleguidePlugin.actions!["check-styleguide-status"]).toBe("function");
      expect(typeof styleguidePlugin.actions!["handle-analysis-complete"]).toBe("function");
      expect(typeof styleguidePlugin.actions!["reload-styleguide"]).toBe("function");
    });

    it("has message handlers for WebSocket messages", async () => {
      const { styleguidePlugin } = await import("../../src/index.js");

      expect(styleguidePlugin.messageHandlers).toBeDefined();
      expect(typeof styleguidePlugin.messageHandlers!["styleguide:status"]).toBe("function");
      expect(typeof styleguidePlugin.messageHandlers!["styleguide:analysis:progress"]).toBe("function");
      expect(typeof styleguidePlugin.messageHandlers!["styleguide:analysis:complete"]).toBe("function");
      expect(typeof styleguidePlugin.messageHandlers!["styleguide:analysis:error"]).toBe("function");
    });

    it("handles styleguide rule category", async () => {
      const { styleguidePlugin } = await import("../../src/index.js");

      expect(styleguidePlugin.handlesRuleCategories).toContain("styleguide");
    });
  });

  describe("isolated registry usage", () => {
    let isolatedRegistry: PluginRegistry;

    beforeEach(() => {
      isolatedRegistry = new PluginRegistry();
    });

    it("can register plugin with isolated registry", async () => {
      const { styleguidePlugin } = await import("../../src/index.js");

      expect(() => isolatedRegistry.register(styleguidePlugin)).not.toThrow();
      expect(isolatedRegistry.has("styleguide")).toBe(true);
    });

    it("can unregister and re-register", async () => {
      const { styleguidePlugin } = await import("../../src/index.js");

      isolatedRegistry.register(styleguidePlugin);
      expect(isolatedRegistry.has("styleguide")).toBe(true);

      isolatedRegistry.unregister("styleguide");
      expect(isolatedRegistry.has("styleguide")).toBe(false);

      isolatedRegistry.register(styleguidePlugin);
      expect(isolatedRegistry.has("styleguide")).toBe(true);
    });
  });

  describe("rule definitions", () => {
    it("provides semantic rule", async () => {
      const { styleguidePlugin } = await import("../../src/index.js");

      const rule = styleguidePlugin.rules?.find((r) => r.id === "semantic");
      expect(rule).toBeDefined();
      expect(rule!.name).toBe("Semantic Analysis");
      expect(rule!.category).toBe("styleguide");
    });

    it("rule has proper requirements", async () => {
      const { styleguidePlugin } = await import("../../src/index.js");

      const rule = styleguidePlugin.rules?.find((r) => r.id === "semantic");
      expect(rule!.requirements).toHaveLength(2);
      expect(rule!.requirements![0].type).toBe("ollama");
      expect(rule!.requirements![1].type).toBe("styleguide");
    });

    it("does not contain duplicates rules (moved to uilint-duplicates)", async () => {
      const { styleguidePlugin } = await import("../../src/index.js");

      const dupRule = styleguidePlugin.rules?.find((r) => r.id === "no-semantic-duplicates");
      expect(dupRule).toBeUndefined();
    });
  });
});

/**
 * Integration Tests: Semantic Plugin Registration
 *
 * Tests that verify the semantic plugin integrates correctly with the
 * core plugin registry system.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PluginRegistry, pluginRegistry } from "uilint-core";

describe("Semantic Plugin Integration", () => {
  describe("auto-registration", () => {
    it("registers with global pluginRegistry on import", async () => {
      // Import the semantic package - this should trigger auto-registration
      await import("../../src/index.js");

      // Verify plugin is registered
      expect(pluginRegistry.has("semantic")).toBe(true);

      const plugin = pluginRegistry.get("semantic");
      expect(plugin).toBeDefined();
      expect(plugin?.name).toBe("Semantic Analysis");
    });

    it("exports plugin definition", async () => {
      const semantic = await import("../../src/index.js");

      // Check plugin is exported
      expect(semantic.semanticPlugin).toBeDefined();
      expect(semantic.semanticPlugin.id).toBe("semantic");
      expect(semantic.semanticPlugin.state).toBeDefined();
      expect(semantic.semanticPlugin.commands).toBeDefined();
      expect(semantic.semanticPlugin.panels).toBeDefined();
      expect(semantic.semanticPlugin.rules).toBeDefined();
    });
  });

  describe("plugin definition completeness", () => {
    it("has all required metadata", async () => {
      const { semanticPlugin } = await import("../../src/index.js");

      expect(semanticPlugin.id).toBe("semantic");
      expect(semanticPlugin.name).toBe("Semantic Analysis");
      expect(semanticPlugin.version).toBe("1.0.0");
      expect(semanticPlugin.description).toBeTruthy();
    });

    it("has valid state definition", async () => {
      const { semanticPlugin } = await import("../../src/index.js");

      expect(semanticPlugin.state).toBeDefined();
      expect(semanticPlugin.state.initialState).toBeDefined();
      expect(semanticPlugin.state.computed).toBeDefined();

      // Verify computed functions work
      const initialState = semanticPlugin.state.initialState;
      const computed = semanticPlugin.state.computed!;

      expect(computed.isIndexReady(initialState)).toBe(false);
      expect(computed.isIndexing(initialState)).toBe(false);
      expect(computed.hasError(initialState)).toBe(false);
      expect(computed.progressPercent(initialState)).toBe(0);
    });

    it("has action handlers", async () => {
      const { semanticPlugin } = await import("../../src/index.js");

      expect(semanticPlugin.actions).toBeDefined();
      expect(typeof semanticPlugin.actions!["start-indexing"]).toBe("function");
      expect(typeof semanticPlugin.actions!["handle-indexing-complete"]).toBe("function");
      expect(typeof semanticPlugin.actions!["select-duplicate"]).toBe("function");
    });

    it("has message handlers for WebSocket messages", async () => {
      const { semanticPlugin } = await import("../../src/index.js");

      expect(semanticPlugin.messageHandlers).toBeDefined();
      expect(typeof semanticPlugin.messageHandlers!["duplicates:indexing:start"]).toBe("function");
      expect(typeof semanticPlugin.messageHandlers!["duplicates:indexing:progress"]).toBe("function");
      expect(typeof semanticPlugin.messageHandlers!["duplicates:indexing:complete"]).toBe("function");
      expect(typeof semanticPlugin.messageHandlers!["duplicates:indexing:error"]).toBe("function");
    });

    it("handles semantic rule category", async () => {
      const { semanticPlugin } = await import("../../src/index.js");

      expect(semanticPlugin.handlesRuleCategories).toContain("semantic");
    });
  });

  describe("isolated registry usage", () => {
    let isolatedRegistry: PluginRegistry;

    beforeEach(() => {
      isolatedRegistry = new PluginRegistry();
    });

    it("can register plugin with isolated registry", async () => {
      const { semanticPlugin } = await import("../../src/index.js");

      expect(() => isolatedRegistry.register(semanticPlugin)).not.toThrow();
      expect(isolatedRegistry.has("semantic")).toBe(true);
    });

    it("can unregister and re-register", async () => {
      const { semanticPlugin } = await import("../../src/index.js");

      isolatedRegistry.register(semanticPlugin);
      expect(isolatedRegistry.has("semantic")).toBe(true);

      isolatedRegistry.unregister("semantic");
      expect(isolatedRegistry.has("semantic")).toBe(false);

      isolatedRegistry.register(semanticPlugin);
      expect(isolatedRegistry.has("semantic")).toBe(true);
    });
  });

  describe("rule definitions", () => {
    it("provides no-semantic-duplicates rule", async () => {
      const { semanticPlugin } = await import("../../src/index.js");

      const rule = semanticPlugin.rules?.find((r) => r.id === "no-semantic-duplicates");
      expect(rule).toBeDefined();
      expect(rule!.name).toBe("No Semantic Duplicates");
      expect(rule!.category).toBe("semantic");
      expect(rule!.defaultSeverity).toBe("warn");
    });

    it("rule has proper requirements", async () => {
      const { semanticPlugin } = await import("../../src/index.js");

      const rule = semanticPlugin.rules?.find((r) => r.id === "no-semantic-duplicates");
      expect(rule!.requirements).toHaveLength(1);
      expect(rule!.requirements![0].type).toBe("semantic-index");
    });
  });
});

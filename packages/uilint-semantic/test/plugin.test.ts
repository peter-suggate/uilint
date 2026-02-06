/**
 * Semantic Plugin Tests
 *
 * Behavioral tests for the semantic plugin - no mocking implementation details.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PluginRegistry } from "uilint-core";
import { semanticPlugin } from "../src/plugin/index.js";
import { semanticInitialState, type SemanticState } from "../src/plugin/state.js";

describe("Semantic Plugin", () => {
  describe("registration", () => {
    it("has required plugin metadata", () => {
      expect(semanticPlugin.id).toBe("semantic");
      expect(semanticPlugin.name).toBe("Semantic Analysis");
      expect(semanticPlugin.version).toBe("1.0.0");
    });

    it("can be registered with PluginRegistry", () => {
      const registry = new PluginRegistry();

      // Should not throw
      expect(() => registry.register(semanticPlugin)).not.toThrow();
      expect(registry.has("semantic")).toBe(true);
    });

    it("auto-registers on import", async () => {
      // The plugin auto-registers when imported
      const { pluginRegistry } = await import("uilint-core");
      expect(pluginRegistry.has("semantic")).toBe(true);
    });
  });

  describe("state definition", () => {
    it("provides valid initial state", () => {
      expect(semanticPlugin.state.initialState).toEqual(semanticInitialState);
    });

    it("initializes with indexStatus: idle", () => {
      const state = semanticPlugin.state.initialState;
      expect(state.indexStatus).toBe("idle");
    });

    it("initializes with null indexProgress", () => {
      const state = semanticPlugin.state.initialState;
      expect(state.indexProgress).toBeNull();
    });

    it("initializes with null indexStats", () => {
      const state = semanticPlugin.state.initialState;
      expect(state.indexStats).toBeNull();
    });

    it("initializes with null lastIndexError", () => {
      const state = semanticPlugin.state.initialState;
      expect(state.lastIndexError).toBeNull();
    });

    it("initializes with null selectedDuplicate", () => {
      const state = semanticPlugin.state.initialState;
      expect(state.selectedDuplicate).toBeNull();
    });

    it("provides computed values", () => {
      expect(semanticPlugin.state.computed).toBeDefined();
      expect(semanticPlugin.state.computed!.isIndexReady).toBeDefined();
      expect(semanticPlugin.state.computed!.isIndexing).toBeDefined();
      expect(semanticPlugin.state.computed!.hasError).toBeDefined();
      expect(semanticPlugin.state.computed!.progressPercent).toBeDefined();
    });

    it("computed isIndexReady returns true when status is ready", () => {
      const state: SemanticState = {
        ...semanticPlugin.state.initialState,
        indexStatus: "ready",
      };
      const isReady = semanticPlugin.state.computed!.isIndexReady(state);
      expect(isReady).toBe(true);
    });

    it("computed isIndexReady returns false for other statuses", () => {
      const idleState = semanticPlugin.state.initialState;
      expect(semanticPlugin.state.computed!.isIndexReady(idleState)).toBe(false);

      const indexingState: SemanticState = {
        ...semanticPlugin.state.initialState,
        indexStatus: "indexing",
      };
      expect(semanticPlugin.state.computed!.isIndexReady(indexingState)).toBe(false);
    });

    it("computed isIndexing returns true when status is indexing", () => {
      const state: SemanticState = {
        ...semanticPlugin.state.initialState,
        indexStatus: "indexing",
      };
      const isIndexing = semanticPlugin.state.computed!.isIndexing(state);
      expect(isIndexing).toBe(true);
    });

    it("computed hasError returns true when status is error", () => {
      const state: SemanticState = {
        ...semanticPlugin.state.initialState,
        indexStatus: "error",
      };
      expect(semanticPlugin.state.computed!.hasError(state)).toBe(true);
    });

    it("computed hasError returns true when lastIndexError is set", () => {
      const state: SemanticState = {
        ...semanticPlugin.state.initialState,
        lastIndexError: "Something went wrong",
      };
      expect(semanticPlugin.state.computed!.hasError(state)).toBe(true);
    });

    it("computed progressPercent returns correct percentage", () => {
      const state: SemanticState = {
        ...semanticPlugin.state.initialState,
        indexProgress: { current: 50, total: 100 },
      };
      expect(semanticPlugin.state.computed!.progressPercent(state)).toBe(50);
    });

    it("computed progressPercent returns 0 when no progress", () => {
      const state = semanticPlugin.state.initialState;
      expect(semanticPlugin.state.computed!.progressPercent(state)).toBe(0);
    });

    it("computed progressPercent returns 0 when total is 0", () => {
      const state: SemanticState = {
        ...semanticPlugin.state.initialState,
        indexProgress: { current: 0, total: 0 },
      };
      expect(semanticPlugin.state.computed!.progressPercent(state)).toBe(0);
    });
  });

  describe("commands", () => {
    it("provides rebuild index command", () => {
      const cmd = semanticPlugin.commands?.find((c) => c.id === "semantic:rebuild-index");
      expect(cmd).toBeDefined();
      expect(cmd!.title).toBe("Rebuild Duplicates Index");
      expect(cmd!.action.type).toBe("start-indexing");
    });

    it("provides clear filter command", () => {
      const cmd = semanticPlugin.commands?.find((c) => c.id === "semantic:clear-filter");
      expect(cmd).toBeDefined();
      expect(cmd!.title).toBe("Clear Duplicate Filter");
      expect(cmd!.action.type).toBe("clear-heatmap-filter");
    });

    it("all commands have required fields", () => {
      for (const cmd of semanticPlugin.commands || []) {
        expect(cmd.id).toBeTruthy();
        expect(cmd.title).toBeTruthy();
        expect(cmd.keywords).toBeInstanceOf(Array);
        expect(cmd.category).toBe("Semantic");
        expect(cmd.action).toBeDefined();
        expect(cmd.action.type).toBeTruthy();
      }
    });
  });

  describe("panels", () => {
    it("provides duplicates panel", () => {
      const panel = semanticPlugin.panels?.find((p) => p.id === "duplicates");
      expect(panel).toBeDefined();
      expect(panel!.title).toBe("Duplicate Code");
      expect(panel!.layout).toBeInstanceOf(Array);
      expect(panel!.layout.length).toBeGreaterThan(0);
    });

    it("provides index status panel", () => {
      const panel = semanticPlugin.panels?.find((p) => p.id === "semantic-index-status");
      expect(panel).toBeDefined();
      expect(panel!.title).toBe("Index Status");
    });

    it("duplicates panel has empty state configuration", () => {
      const panel = semanticPlugin.panels?.find((p) => p.id === "duplicates");
      expect(panel!.empty).toBeDefined();
      expect(panel!.empty!.message).toBeTruthy();
    });

    it("duplicates panel has loading configuration", () => {
      const panel = semanticPlugin.panels?.find((p) => p.id === "duplicates");
      expect(panel!.loading).toBeDefined();
      expect(panel!.loading!.message).toBeTruthy();
    });

    it("duplicates panel has code viewer sections", () => {
      const panel = semanticPlugin.panels?.find((p) => p.id === "duplicates");
      const codeViewers = panel!.layout.filter((s: any) => s.type === "code-viewer");
      expect(codeViewers.length).toBe(2);
    });

    it("index status panel has progress section", () => {
      const panel = semanticPlugin.panels?.find((p) => p.id === "semantic-index-status");
      const conditionals = panel!.layout.filter((s: any) => s.type === "conditional");
      expect(conditionals.length).toBeGreaterThan(0);
    });
  });

  describe("rules", () => {
    it("provides no-semantic-duplicates rule", () => {
      const rule = semanticPlugin.rules?.find((r) => r.id === "no-semantic-duplicates");
      expect(rule).toBeDefined();
      expect(rule!.name).toBe("No Semantic Duplicates");
      expect(rule!.category).toBe("semantic");
    });

    it("rule has requirements defined", () => {
      const rule = semanticPlugin.rules?.find((r) => r.id === "no-semantic-duplicates");
      expect(rule!.requirements).toHaveLength(1);
      expect(rule!.requirements![0].type).toBe("semantic-index");
    });

    it("rule has custom inspector panel", () => {
      const rule = semanticPlugin.rules?.find((r) => r.id === "no-semantic-duplicates");
      expect(rule!.customInspectorPanel).toBe("duplicates");
    });

    it("rule has option schema", () => {
      const rule = semanticPlugin.rules?.find((r) => r.id === "no-semantic-duplicates");
      expect(rule!.optionSchema).toBeDefined();
      expect(rule!.optionSchema!.fields.length).toBeGreaterThan(0);
    });

    it("rule has default options", () => {
      const rule = semanticPlugin.rules?.find((r) => r.id === "no-semantic-duplicates");
      expect(rule!.defaultOptions).toBeDefined();
      expect(rule!.defaultOptions![0].threshold).toBe(0.75);
    });
  });

  describe("rule categories", () => {
    it("handles semantic rule category", () => {
      expect(semanticPlugin.handlesRuleCategories).toContain("semantic");
    });
  });

  describe("issue aggregation", () => {
    it("returns empty issues (semantic issues come from ESLint)", () => {
      const state = semanticPlugin.state.initialState;
      const contribution = semanticPlugin.getIssues!(state);
      expect(contribution.pluginId).toBe("semantic");
      expect(contribution.issues.size).toBe(0);
    });
  });

  describe("actions", () => {
    it("provides action handlers", () => {
      expect(semanticPlugin.actions).toBeDefined();
      expect(semanticPlugin.actions!["start-indexing"]).toBeDefined();
      expect(semanticPlugin.actions!["handle-indexing-start"]).toBeDefined();
      expect(semanticPlugin.actions!["handle-indexing-progress"]).toBeDefined();
      expect(semanticPlugin.actions!["handle-indexing-complete"]).toBeDefined();
      expect(semanticPlugin.actions!["handle-indexing-error"]).toBeDefined();
      expect(semanticPlugin.actions!["select-duplicate"]).toBeDefined();
      expect(semanticPlugin.actions!["clear-selected-duplicate"]).toBeDefined();
      expect(semanticPlugin.actions!["toggle-heatmap-filter"]).toBeDefined();
      expect(semanticPlugin.actions!["clear-heatmap-filter"]).toBeDefined();
      expect(semanticPlugin.actions!["open-editor"]).toBeDefined();
    });
  });

  describe("message handlers", () => {
    it("provides WebSocket message handlers", () => {
      expect(semanticPlugin.messageHandlers).toBeDefined();
      expect(semanticPlugin.messageHandlers!["duplicates:indexing:start"]).toBeDefined();
      expect(semanticPlugin.messageHandlers!["duplicates:indexing:progress"]).toBeDefined();
      expect(semanticPlugin.messageHandlers!["duplicates:indexing:complete"]).toBeDefined();
      expect(semanticPlugin.messageHandlers!["duplicates:indexing:error"]).toBeDefined();
    });
  });

  describe("browser actions", () => {
    it("declares no browser actions (semantic runs on server)", () => {
      expect(semanticPlugin.browserActions).toEqual([]);
    });
  });
});

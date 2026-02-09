/**
 * Duplicates Plugin Tests
 *
 * Behavioral tests for the duplicates plugin - no mocking implementation details.
 */

import { describe, it, expect } from "vitest";
import { PluginRegistry } from "uilint-core";
import { duplicatesPlugin } from "../src/plugin/index.js";
import { duplicatesInitialState, type DuplicatesState } from "../src/plugin/state.js";

describe("Duplicates Plugin", () => {
  describe("registration", () => {
    it("has required plugin metadata", () => {
      expect(duplicatesPlugin.id).toBe("duplicates");
      expect(duplicatesPlugin.name).toBe("Duplicate Detection");
      expect(duplicatesPlugin.version).toBe("1.0.0");
    });

    it("can be registered with PluginRegistry", () => {
      const registry = new PluginRegistry();

      expect(() => registry.register(duplicatesPlugin)).not.toThrow();
      expect(registry.has("duplicates")).toBe(true);
    });

    it("auto-registers on import", async () => {
      const { pluginRegistry } = await import("uilint-core");
      expect(pluginRegistry.has("duplicates")).toBe(true);
    });

    it("can unregister and re-register", () => {
      const registry = new PluginRegistry();

      registry.register(duplicatesPlugin);
      expect(registry.has("duplicates")).toBe(true);

      registry.unregister("duplicates");
      expect(registry.has("duplicates")).toBe(false);

      registry.register(duplicatesPlugin);
      expect(registry.has("duplicates")).toBe(true);
    });
  });

  describe("state definition", () => {
    it("provides valid initial state", () => {
      expect(duplicatesPlugin.state.initialState).toEqual(duplicatesInitialState);
    });

    it("initializes with indexStatus: idle", () => {
      const state = duplicatesPlugin.state.initialState;
      expect(state.indexStatus).toBe("idle");
    });

    it("initializes with null indexProgress", () => {
      const state = duplicatesPlugin.state.initialState;
      expect(state.indexProgress).toBeNull();
    });

    it("initializes with null indexStats", () => {
      const state = duplicatesPlugin.state.initialState;
      expect(state.indexStats).toBeNull();
    });

    it("initializes with null lastIndexError", () => {
      const state = duplicatesPlugin.state.initialState;
      expect(state.lastIndexError).toBeNull();
    });

    it("initializes with null selectedDuplicate", () => {
      const state = duplicatesPlugin.state.initialState;
      expect(state.selectedDuplicate).toBeNull();
    });

    it("provides computed values", () => {
      expect(duplicatesPlugin.state.computed).toBeDefined();
      expect(duplicatesPlugin.state.computed!.isIndexReady).toBeDefined();
      expect(duplicatesPlugin.state.computed!.isIndexing).toBeDefined();
      expect(duplicatesPlugin.state.computed!.hasError).toBeDefined();
      expect(duplicatesPlugin.state.computed!.progressPercent).toBeDefined();
    });

    it("computed isIndexReady returns true when status is ready", () => {
      const state: DuplicatesState = {
        ...duplicatesPlugin.state.initialState,
        indexStatus: "ready",
      };
      expect(duplicatesPlugin.state.computed!.isIndexReady(state)).toBe(true);
    });

    it("computed isIndexReady returns false for other statuses", () => {
      const idleState = duplicatesPlugin.state.initialState;
      expect(duplicatesPlugin.state.computed!.isIndexReady(idleState)).toBe(false);

      const indexingState: DuplicatesState = {
        ...duplicatesPlugin.state.initialState,
        indexStatus: "indexing",
      };
      expect(duplicatesPlugin.state.computed!.isIndexReady(indexingState)).toBe(false);
    });

    it("computed isIndexing returns true when status is indexing", () => {
      const state: DuplicatesState = {
        ...duplicatesPlugin.state.initialState,
        indexStatus: "indexing",
      };
      expect(duplicatesPlugin.state.computed!.isIndexing(state)).toBe(true);
    });

    it("computed hasError returns true when status is error", () => {
      const state: DuplicatesState = {
        ...duplicatesPlugin.state.initialState,
        indexStatus: "error",
      };
      expect(duplicatesPlugin.state.computed!.hasError(state)).toBe(true);
    });

    it("computed hasError returns true when lastIndexError is set", () => {
      const state: DuplicatesState = {
        ...duplicatesPlugin.state.initialState,
        lastIndexError: "Something went wrong",
      };
      expect(duplicatesPlugin.state.computed!.hasError(state)).toBe(true);
    });

    it("computed progressPercent returns correct percentage", () => {
      const state: DuplicatesState = {
        ...duplicatesPlugin.state.initialState,
        indexProgress: { current: 50, total: 100 },
      };
      expect(duplicatesPlugin.state.computed!.progressPercent(state)).toBe(50);
    });

    it("computed progressPercent returns 0 when no progress", () => {
      const state = duplicatesPlugin.state.initialState;
      expect(duplicatesPlugin.state.computed!.progressPercent(state)).toBe(0);
    });

    it("computed progressPercent returns 0 when total is 0", () => {
      const state: DuplicatesState = {
        ...duplicatesPlugin.state.initialState,
        indexProgress: { current: 0, total: 0 },
      };
      expect(duplicatesPlugin.state.computed!.progressPercent(state)).toBe(0);
    });
  });

  describe("commands", () => {
    it("provides rebuild index command", () => {
      const cmd = duplicatesPlugin.commands?.find((c) => c.id === "duplicates:rebuild-index");
      expect(cmd).toBeDefined();
      expect(cmd!.title).toBe("Rebuild Duplicates Index");
      expect(cmd!.action.type).toBe("start-indexing");
    });

    it("provides clear filter command", () => {
      const cmd = duplicatesPlugin.commands?.find((c) => c.id === "duplicates:clear-filter");
      expect(cmd).toBeDefined();
      expect(cmd!.title).toBe("Clear Duplicate Filter");
      expect(cmd!.action.type).toBe("clear-heatmap-filter");
    });

    it("all commands have required fields", () => {
      for (const cmd of duplicatesPlugin.commands || []) {
        expect(cmd.id).toBeTruthy();
        expect(cmd.title).toBeTruthy();
        expect(cmd.keywords).toBeInstanceOf(Array);
        expect(cmd.category).toBe("Duplicates");
        expect(cmd.action).toBeDefined();
        expect(cmd.action.type).toBeTruthy();
      }
    });
  });

  describe("panels", () => {
    it("provides duplicates panel", () => {
      const panel = duplicatesPlugin.panels?.find((p) => p.id === "duplicates");
      expect(panel).toBeDefined();
      expect(panel!.title).toBe("Duplicate Code");
      expect(panel!.layout).toBeInstanceOf(Array);
      expect(panel!.layout.length).toBeGreaterThan(0);
    });

    it("provides index status panel", () => {
      const panel = duplicatesPlugin.panels?.find((p) => p.id === "duplicates-index-status");
      expect(panel).toBeDefined();
      expect(panel!.title).toBe("Index Status");
    });

    it("duplicates panel has empty state configuration", () => {
      const panel = duplicatesPlugin.panels?.find((p) => p.id === "duplicates");
      expect(panel!.empty).toBeDefined();
      expect(panel!.empty!.message).toBeTruthy();
    });

    it("duplicates panel has loading configuration", () => {
      const panel = duplicatesPlugin.panels?.find((p) => p.id === "duplicates");
      expect(panel!.loading).toBeDefined();
      expect(panel!.loading!.message).toBeTruthy();
    });

    it("duplicates panel has code viewer sections", () => {
      const panel = duplicatesPlugin.panels?.find((p) => p.id === "duplicates");
      const codeViewers = panel!.layout.filter((s: any) => s.type === "code-viewer");
      expect(codeViewers.length).toBe(2);
    });

    it("index status panel has progress section", () => {
      const panel = duplicatesPlugin.panels?.find((p) => p.id === "duplicates-index-status");
      const conditionals = panel!.layout.filter((s: any) => s.type === "conditional");
      expect(conditionals.length).toBeGreaterThan(0);
    });
  });

  describe("rules", () => {
    it("provides no-duplicates rule", () => {
      const rule = duplicatesPlugin.rules?.find((r) => r.id === "no-duplicates");
      expect(rule).toBeDefined();
      expect(rule!.name).toBe("No Duplicates");
      expect(rule!.category).toBe("duplicates");
    });

    it("rule has requirements defined", () => {
      const rule = duplicatesPlugin.rules?.find((r) => r.id === "no-duplicates");
      expect(rule!.requirements).toHaveLength(1);
      expect(rule!.requirements![0].type).toBe("semantic-index");
    });

    it("rule has custom inspector panel", () => {
      const rule = duplicatesPlugin.rules?.find((r) => r.id === "no-duplicates");
      expect(rule!.customInspectorPanel).toBe("duplicates");
    });

    it("rule has option schema", () => {
      const rule = duplicatesPlugin.rules?.find((r) => r.id === "no-duplicates");
      expect(rule!.optionSchema).toBeDefined();
      expect(rule!.optionSchema!.fields.length).toBeGreaterThan(0);
    });

    it("rule has default options", () => {
      const rule = duplicatesPlugin.rules?.find((r) => r.id === "no-duplicates");
      expect(rule!.defaultOptions).toBeDefined();
      expect(rule!.defaultOptions![0].threshold).toBe(0.75);
    });
  });

  describe("rule categories", () => {
    it("handles duplicates rule category", () => {
      expect(duplicatesPlugin.handlesRuleCategories).toContain("duplicates");
    });
  });

  describe("issue aggregation", () => {
    it("returns empty issues (duplicate issues come from ESLint)", () => {
      const state = duplicatesPlugin.state.initialState;
      const contribution = duplicatesPlugin.getIssues!(state);
      expect(contribution.pluginId).toBe("duplicates");
      expect(contribution.issues.size).toBe(0);
    });
  });

  describe("actions", () => {
    it("provides action handlers", () => {
      expect(duplicatesPlugin.actions).toBeDefined();
      expect(duplicatesPlugin.actions!["start-indexing"]).toBeDefined();
      expect(duplicatesPlugin.actions!["handle-indexing-start"]).toBeDefined();
      expect(duplicatesPlugin.actions!["handle-indexing-progress"]).toBeDefined();
      expect(duplicatesPlugin.actions!["handle-indexing-complete"]).toBeDefined();
      expect(duplicatesPlugin.actions!["handle-indexing-error"]).toBeDefined();
      expect(duplicatesPlugin.actions!["select-duplicate"]).toBeDefined();
      expect(duplicatesPlugin.actions!["clear-selected-duplicate"]).toBeDefined();
      expect(duplicatesPlugin.actions!["toggle-heatmap-filter"]).toBeDefined();
      expect(duplicatesPlugin.actions!["clear-heatmap-filter"]).toBeDefined();
      expect(duplicatesPlugin.actions!["open-editor"]).toBeDefined();
    });
  });

  describe("message handlers", () => {
    it("provides WebSocket message handlers", () => {
      expect(duplicatesPlugin.messageHandlers).toBeDefined();
      expect(duplicatesPlugin.messageHandlers!["duplicates:indexing:start"]).toBeDefined();
      expect(duplicatesPlugin.messageHandlers!["duplicates:indexing:progress"]).toBeDefined();
      expect(duplicatesPlugin.messageHandlers!["duplicates:indexing:complete"]).toBeDefined();
      expect(duplicatesPlugin.messageHandlers!["duplicates:indexing:error"]).toBeDefined();
    });
  });

  describe("browser actions", () => {
    it("declares no browser actions (duplicates runs on server)", () => {
      expect(duplicatesPlugin.browserActions).toEqual([]);
    });
  });
});

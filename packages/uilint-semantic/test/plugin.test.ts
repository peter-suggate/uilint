/**
 * Styleguide Plugin Tests
 *
 * Behavioral tests for the styleguide plugin - no mocking implementation details.
 */

import { describe, it, expect } from "vitest";
import { PluginRegistry } from "uilint-core";
import { styleguidePlugin } from "../src/plugin/index.js";
import { styleguideInitialState, type StyleguideState } from "../src/plugin/state.js";

describe("Styleguide Plugin", () => {
  describe("registration", () => {
    it("has required plugin metadata", () => {
      expect(styleguidePlugin.id).toBe("styleguide");
      expect(styleguidePlugin.name).toBe("Styleguide Checking");
      expect(styleguidePlugin.version).toBe("1.0.0");
    });

    it("can be registered with PluginRegistry", () => {
      const registry = new PluginRegistry();

      expect(() => registry.register(styleguidePlugin)).not.toThrow();
      expect(registry.has("styleguide")).toBe(true);
    });

    it("auto-registers on import", async () => {
      const { pluginRegistry } = await import("uilint-core");
      expect(pluginRegistry.has("styleguide")).toBe(true);
    });

    it("can unregister and re-register", () => {
      const registry = new PluginRegistry();

      registry.register(styleguidePlugin);
      expect(registry.has("styleguide")).toBe(true);

      registry.unregister("styleguide");
      expect(registry.has("styleguide")).toBe(false);

      registry.register(styleguidePlugin);
      expect(registry.has("styleguide")).toBe(true);
    });
  });

  describe("state definition", () => {
    it("provides valid initial state", () => {
      expect(styleguidePlugin.state.initialState).toEqual(styleguideInitialState);
    });

    it("initializes with styleguideLoaded: false", () => {
      const state = styleguidePlugin.state.initialState;
      expect(state.styleguideLoaded).toBe(false);
    });

    it("initializes with null styleguidePath", () => {
      const state = styleguidePlugin.state.initialState;
      expect(state.styleguidePath).toBeNull();
    });

    it("initializes with modelAvailable: false", () => {
      const state = styleguidePlugin.state.initialState;
      expect(state.modelAvailable).toBe(false);
    });

    it("initializes with default modelName", () => {
      const state = styleguidePlugin.state.initialState;
      expect(state.modelName).toBe("qwen3-vl:8b-instruct");
    });

    it("initializes with analysis status: idle", () => {
      const state = styleguidePlugin.state.initialState;
      expect(state.analysis.status).toBe("idle");
    });

    it("initializes with null analysis progress", () => {
      const state = styleguidePlugin.state.initialState;
      expect(state.analysis.progress).toBeNull();
    });

    it("initializes with null analysis lastError", () => {
      const state = styleguidePlugin.state.initialState;
      expect(state.analysis.lastError).toBeNull();
    });

    it("initializes with null analysis stats", () => {
      const state = styleguidePlugin.state.initialState;
      expect(state.analysis.stats).toBeNull();
    });

    it("provides computed values", () => {
      expect(styleguidePlugin.state.computed).toBeDefined();
      expect(styleguidePlugin.state.computed!.isReady).toBeDefined();
      expect(styleguidePlugin.state.computed!.isAnalyzing).toBeDefined();
      expect(styleguidePlugin.state.computed!.hasError).toBeDefined();
      expect(styleguidePlugin.state.computed!.progressPercent).toBeDefined();
    });

    it("computed isReady returns true when styleguide loaded and model available", () => {
      const state: StyleguideState = {
        ...styleguidePlugin.state.initialState,
        styleguideLoaded: true,
        modelAvailable: true,
      };
      expect(styleguidePlugin.state.computed!.isReady(state)).toBe(true);
    });

    it("computed isReady returns false when styleguide not loaded", () => {
      const state: StyleguideState = {
        ...styleguidePlugin.state.initialState,
        styleguideLoaded: false,
        modelAvailable: true,
      };
      expect(styleguidePlugin.state.computed!.isReady(state)).toBe(false);
    });

    it("computed isReady returns false when model not available", () => {
      const state: StyleguideState = {
        ...styleguidePlugin.state.initialState,
        styleguideLoaded: true,
        modelAvailable: false,
      };
      expect(styleguidePlugin.state.computed!.isReady(state)).toBe(false);
    });

    it("computed isAnalyzing returns true when status is active", () => {
      const state: StyleguideState = {
        ...styleguidePlugin.state.initialState,
        analysis: { ...styleguidePlugin.state.initialState.analysis, status: "active" },
      };
      expect(styleguidePlugin.state.computed!.isAnalyzing(state)).toBe(true);
    });

    it("computed hasError returns true when status is error", () => {
      const state: StyleguideState = {
        ...styleguidePlugin.state.initialState,
        analysis: { ...styleguidePlugin.state.initialState.analysis, status: "error" },
      };
      expect(styleguidePlugin.state.computed!.hasError(state)).toBe(true);
    });

    it("computed hasError returns true when lastError is set", () => {
      const state: StyleguideState = {
        ...styleguidePlugin.state.initialState,
        analysis: { ...styleguidePlugin.state.initialState.analysis, lastError: "Model not available" },
      };
      expect(styleguidePlugin.state.computed!.hasError(state)).toBe(true);
    });

    it("computed progressPercent returns correct percentage", () => {
      const state: StyleguideState = {
        ...styleguidePlugin.state.initialState,
        analysis: { ...styleguidePlugin.state.initialState.analysis, progress: { current: 3, total: 10 } },
      };
      expect(styleguidePlugin.state.computed!.progressPercent(state)).toBe(30);
    });

    it("computed progressPercent returns 0 when no progress", () => {
      const state = styleguidePlugin.state.initialState;
      expect(styleguidePlugin.state.computed!.progressPercent(state)).toBe(0);
    });

    it("computed progressPercent returns 0 when total is 0", () => {
      const state: StyleguideState = {
        ...styleguidePlugin.state.initialState,
        analysis: { ...styleguidePlugin.state.initialState.analysis, progress: { current: 0, total: 0 } },
      };
      expect(styleguidePlugin.state.computed!.progressPercent(state)).toBe(0);
    });
  });

  describe("commands", () => {
    it("provides check status command", () => {
      const cmd = styleguidePlugin.commands?.find((c) => c.id === "styleguide:check-status");
      expect(cmd).toBeDefined();
      expect(cmd!.title).toBe("Check Styleguide Status");
      expect(cmd!.action.type).toBe("check-styleguide-status");
    });

    it("provides reload command", () => {
      const cmd = styleguidePlugin.commands?.find((c) => c.id === "styleguide:reload");
      expect(cmd).toBeDefined();
      expect(cmd!.title).toBe("Reload Styleguide");
      expect(cmd!.action.type).toBe("reload-styleguide");
    });

    it("all commands have required fields", () => {
      for (const cmd of styleguidePlugin.commands || []) {
        expect(cmd.id).toBeTruthy();
        expect(cmd.title).toBeTruthy();
        expect(cmd.keywords).toBeInstanceOf(Array);
        expect(cmd.category).toBe("Styleguide");
        expect(cmd.action).toBeDefined();
        expect(cmd.action.type).toBeTruthy();
      }
    });
  });

  describe("panels", () => {
    it("provides styleguide status panel", () => {
      const panel = styleguidePlugin.panels?.find((p) => p.id === "styleguide-status");
      expect(panel).toBeDefined();
      expect(panel!.title).toBe("Styleguide Status");
    });

    it("status panel has conditional sections", () => {
      const panel = styleguidePlugin.panels?.find((p) => p.id === "styleguide-status");
      const conditionals = panel!.layout.filter((s: any) => s.type === "conditional");
      expect(conditionals.length).toBeGreaterThan(0);
    });

    it("status panel has action buttons", () => {
      const panel = styleguidePlugin.panels?.find((p) => p.id === "styleguide-status");
      const actions = panel!.layout.filter((s: any) => s.type === "actions");
      expect(actions.length).toBeGreaterThan(0);
    });
  });

  describe("rules", () => {
    it("provides semantic rule", () => {
      const rule = styleguidePlugin.rules?.find((r) => r.id === "semantic");
      expect(rule).toBeDefined();
      expect(rule!.name).toBe("Semantic Analysis");
      expect(rule!.category).toBe("styleguide");
    });

    it("rule has requirements defined", () => {
      const rule = styleguidePlugin.rules?.find((r) => r.id === "semantic");
      expect(rule!.requirements).toHaveLength(2);
      expect(rule!.requirements![0].type).toBe("ollama");
      expect(rule!.requirements![1].type).toBe("styleguide");
    });

    it("rule has custom inspector panel", () => {
      const rule = styleguidePlugin.rules?.find((r) => r.id === "semantic");
      expect(rule!.customInspectorPanel).toBe("semantic-issue");
    });

    it("rule has option schema", () => {
      const rule = styleguidePlugin.rules?.find((r) => r.id === "semantic");
      expect(rule!.optionSchema).toBeDefined();
      expect(rule!.optionSchema!.fields.length).toBeGreaterThan(0);
    });

    it("rule has default options", () => {
      const rule = styleguidePlugin.rules?.find((r) => r.id === "semantic");
      expect(rule!.defaultOptions).toBeDefined();
      expect(rule!.defaultOptions![0].model).toBe("qwen3-vl:8b-instruct");
    });
  });

  describe("rule categories", () => {
    it("handles styleguide rule category", () => {
      expect(styleguidePlugin.handlesRuleCategories).toContain("styleguide");
    });
  });

  describe("issue aggregation", () => {
    it("returns empty issues (styleguide issues come from ESLint)", () => {
      const state = styleguidePlugin.state.initialState;
      const contribution = styleguidePlugin.getIssues!(state);
      expect(contribution.pluginId).toBe("styleguide");
      expect(contribution.issues.size).toBe(0);
    });
  });

  describe("actions", () => {
    it("provides action handlers", () => {
      expect(styleguidePlugin.actions).toBeDefined();
      expect(styleguidePlugin.actions!["check-styleguide-status"]).toBeDefined();
      expect(styleguidePlugin.actions!["handle-styleguide-status"]).toBeDefined();
      expect(styleguidePlugin.actions!["handle-analysis-progress"]).toBeDefined();
      expect(styleguidePlugin.actions!["handle-analysis-complete"]).toBeDefined();
      expect(styleguidePlugin.actions!["handle-analysis-error"]).toBeDefined();
      expect(styleguidePlugin.actions!["reload-styleguide"]).toBeDefined();
      expect(styleguidePlugin.actions!["open-editor"]).toBeDefined();
    });
  });

  describe("message handlers", () => {
    it("provides WebSocket message handlers", () => {
      expect(styleguidePlugin.messageHandlers).toBeDefined();
      expect(styleguidePlugin.messageHandlers!["styleguide:status"]).toBeDefined();
      expect(styleguidePlugin.messageHandlers!["styleguide:analysis:progress"]).toBeDefined();
      expect(styleguidePlugin.messageHandlers!["styleguide:analysis:complete"]).toBeDefined();
      expect(styleguidePlugin.messageHandlers!["styleguide:analysis:error"]).toBeDefined();
    });
  });

  describe("browser actions", () => {
    it("declares no browser actions (styleguide runs on server)", () => {
      expect(styleguidePlugin.browserActions).toEqual([]);
    });
  });

  describe("lifecycle", () => {
    it("has onLoad hook", () => {
      expect(styleguidePlugin.onLoad).toBeDefined();
    });
  });
});

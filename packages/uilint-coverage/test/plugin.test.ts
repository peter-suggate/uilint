/**
 * Coverage Plugin Tests
 *
 * Behavioral tests for the coverage plugin - no mocking implementation details.
 */

import { describe, it, expect } from "vitest";
import { PluginRegistry } from "uilint-core";
import { coveragePlugin } from "../src/plugin/index.js";
import { coverageInitialState, type CoverageState } from "../src/plugin/state.js";

describe("Coverage Plugin", () => {
  describe("registration", () => {
    it("has required plugin metadata", () => {
      expect(coveragePlugin.id).toBe("coverage");
      expect(coveragePlugin.name).toBe("Test Coverage");
      expect(coveragePlugin.version).toBe("1.0.0");
    });

    it("can be registered with PluginRegistry", () => {
      const registry = new PluginRegistry();

      expect(() => registry.register(coveragePlugin)).not.toThrow();
      expect(registry.has("coverage")).toBe(true);
    });

    it("auto-registers on import", async () => {
      const { pluginRegistry } = await import("uilint-core");
      expect(pluginRegistry.has("coverage")).toBe(true);
    });

    it("can unregister and re-register", () => {
      const registry = new PluginRegistry();

      registry.register(coveragePlugin);
      expect(registry.has("coverage")).toBe(true);

      registry.unregister("coverage");
      expect(registry.has("coverage")).toBe(false);

      registry.register(coveragePlugin);
      expect(registry.has("coverage")).toBe(true);
    });
  });

  describe("state definition", () => {
    it("provides valid initial state", () => {
      expect(coveragePlugin.state.initialState).toEqual(coverageInitialState);
    });

    it("initializes preparation with status: idle", () => {
      const state = coveragePlugin.state.initialState;
      expect(state.preparation.status).toBe("idle");
    });

    it("initializes preparation with null progress", () => {
      const state = coveragePlugin.state.initialState;
      expect(state.preparation.progress).toBeNull();
    });

    it("initializes preparation with null stats", () => {
      const state = coveragePlugin.state.initialState;
      expect(state.preparation.stats).toBeNull();
    });

    it("initializes preparation with null lastError", () => {
      const state = coveragePlugin.state.initialState;
      expect(state.preparation.lastError).toBeNull();
    });

    it("initializes coverageAvailable as false", () => {
      const state = coveragePlugin.state.initialState;
      expect(state.coverageAvailable).toBe(false);
    });

    it("initializes fileCount as 0", () => {
      const state = coveragePlugin.state.initialState;
      expect(state.fileCount).toBe(0);
    });

    it("provides computed values", () => {
      expect(coveragePlugin.state.computed).toBeDefined();
      expect(coveragePlugin.state.computed!.isReady).toBeDefined();
      expect(coveragePlugin.state.computed!.isActive).toBeDefined();
      expect(coveragePlugin.state.computed!.hasError).toBeDefined();
      expect(coveragePlugin.state.computed!.progressPercent).toBeDefined();
    });

    it("computed isReady returns true when preparation status is complete", () => {
      const state: CoverageState = {
        ...coveragePlugin.state.initialState,
        preparation: {
          ...coveragePlugin.state.initialState.preparation,
          status: "complete",
        },
      };
      expect(coveragePlugin.state.computed!.isReady(state)).toBe(true);
    });

    it("computed isReady returns false for other statuses", () => {
      const idleState = coveragePlugin.state.initialState;
      expect(coveragePlugin.state.computed!.isReady(idleState)).toBe(false);

      const activeState: CoverageState = {
        ...coveragePlugin.state.initialState,
        preparation: {
          ...coveragePlugin.state.initialState.preparation,
          status: "active",
        },
      };
      expect(coveragePlugin.state.computed!.isReady(activeState)).toBe(false);
    });

    it("computed isActive returns true when preparation status is active", () => {
      const state: CoverageState = {
        ...coveragePlugin.state.initialState,
        preparation: {
          ...coveragePlugin.state.initialState.preparation,
          status: "active",
        },
      };
      expect(coveragePlugin.state.computed!.isActive(state)).toBe(true);
    });

    it("computed isActive returns false for other statuses", () => {
      const idleState = coveragePlugin.state.initialState;
      expect(coveragePlugin.state.computed!.isActive(idleState)).toBe(false);
    });

    it("computed hasError returns true when preparation status is error", () => {
      const state: CoverageState = {
        ...coveragePlugin.state.initialState,
        preparation: {
          ...coveragePlugin.state.initialState.preparation,
          status: "error",
        },
      };
      expect(coveragePlugin.state.computed!.hasError(state)).toBe(true);
    });

    it("computed hasError returns true when lastError is set", () => {
      const state: CoverageState = {
        ...coveragePlugin.state.initialState,
        preparation: {
          ...coveragePlugin.state.initialState.preparation,
          lastError: "Something went wrong",
        },
      };
      expect(coveragePlugin.state.computed!.hasError(state)).toBe(true);
    });

    it("computed hasError returns false when no error", () => {
      const state = coveragePlugin.state.initialState;
      expect(coveragePlugin.state.computed!.hasError(state)).toBe(false);
    });

    it("computed progressPercent returns correct percentage", () => {
      const state: CoverageState = {
        ...coveragePlugin.state.initialState,
        preparation: {
          ...coveragePlugin.state.initialState.preparation,
          progress: { current: 50, total: 100 },
        },
      };
      expect(coveragePlugin.state.computed!.progressPercent(state)).toBe(50);
    });

    it("computed progressPercent returns 0 when no progress", () => {
      const state = coveragePlugin.state.initialState;
      expect(coveragePlugin.state.computed!.progressPercent(state)).toBe(0);
    });

    it("computed progressPercent returns 0 when total is 0", () => {
      const state: CoverageState = {
        ...coveragePlugin.state.initialState,
        preparation: {
          ...coveragePlugin.state.initialState.preparation,
          progress: { current: 0, total: 0 },
        },
      };
      expect(coveragePlugin.state.computed!.progressPercent(state)).toBe(0);
    });
  });

  describe("commands", () => {
    it("provides regenerate command", () => {
      const cmd = coveragePlugin.commands?.find((c) => c.id === "coverage:regenerate");
      expect(cmd).toBeDefined();
      expect(cmd!.title).toBe("Regenerate Coverage Data");
      expect(cmd!.action.type).toBe("start-preparation");
    });

    it("all commands have required fields", () => {
      for (const cmd of coveragePlugin.commands || []) {
        expect(cmd.id).toBeTruthy();
        expect(cmd.title).toBeTruthy();
        expect(cmd.keywords).toBeInstanceOf(Array);
        expect(cmd.category).toBe("Coverage");
        expect(cmd.action).toBeDefined();
        expect(cmd.action.type).toBeTruthy();
      }
    });
  });

  describe("panels", () => {
    it("provides coverage-status panel", () => {
      const panel = coveragePlugin.panels?.find((p) => p.id === "coverage-status");
      expect(panel).toBeDefined();
      expect(panel!.title).toBe("Coverage Status");
    });

    it("coverage-status panel has layout", () => {
      const panel = coveragePlugin.panels?.find((p) => p.id === "coverage-status");
      expect(panel!.layout).toBeInstanceOf(Array);
      expect(panel!.layout.length).toBeGreaterThan(0);
    });

    it("coverage-status panel has conditional sections", () => {
      const panel = coveragePlugin.panels?.find((p) => p.id === "coverage-status");
      const conditionals = panel!.layout.filter((s: any) => s.type === "conditional");
      expect(conditionals.length).toBeGreaterThan(0);
    });
  });

  describe("rules", () => {
    it("provides require-test-coverage rule", () => {
      const rule = coveragePlugin.rules?.find((r) => r.id === "require-test-coverage");
      expect(rule).toBeDefined();
      expect(rule!.name).toBe("Require Test Coverage");
      expect(rule!.category).toBe("coverage");
    });

    it("rule has requirements defined", () => {
      const rule = coveragePlugin.rules?.find((r) => r.id === "require-test-coverage");
      expect(rule!.requirements).toBeDefined();
      expect(rule!.requirements!.length).toBeGreaterThan(0);
      expect(rule!.requirements![0].type).toBe("coverage");
    });

    it("rule has option schema", () => {
      const rule = coveragePlugin.rules?.find((r) => r.id === "require-test-coverage");
      expect(rule!.optionSchema).toBeDefined();
      expect(rule!.optionSchema!.fields.length).toBeGreaterThan(0);
    });

    it("rule has default options", () => {
      const rule = coveragePlugin.rules?.find((r) => r.id === "require-test-coverage");
      expect(rule!.defaultOptions).toBeDefined();
      expect(rule!.defaultOptions![0].threshold).toBe(80);
    });
  });

  describe("rule categories", () => {
    it("handles coverage rule category", () => {
      expect(coveragePlugin.handlesRuleCategories).toContain("coverage");
    });
  });

  describe("issue aggregation", () => {
    it("returns empty issues (coverage issues come from ESLint)", () => {
      const state = coveragePlugin.state.initialState;
      const contribution = coveragePlugin.getIssues!(state);
      expect(contribution.pluginId).toBe("coverage");
      expect(contribution.issues.size).toBe(0);
    });
  });

  describe("actions", () => {
    it("provides action handlers", () => {
      expect(coveragePlugin.actions).toBeDefined();
      expect(coveragePlugin.actions!["start-preparation"]).toBeDefined();
      expect(coveragePlugin.actions!["set-coverage-available"]).toBeDefined();
      expect(coveragePlugin.actions!["handle-preparation-start"]).toBeDefined();
      expect(coveragePlugin.actions!["handle-preparation-progress"]).toBeDefined();
      expect(coveragePlugin.actions!["handle-preparation-complete"]).toBeDefined();
      expect(coveragePlugin.actions!["handle-preparation-error"]).toBeDefined();
    });
  });

  describe("message handlers", () => {
    it("provides WebSocket message handlers", () => {
      expect(coveragePlugin.messageHandlers).toBeDefined();
      expect(coveragePlugin.messageHandlers!["coverage:setup:start"]).toBeDefined();
      expect(coveragePlugin.messageHandlers!["coverage:setup:progress"]).toBeDefined();
      expect(coveragePlugin.messageHandlers!["coverage:setup:complete"]).toBeDefined();
      expect(coveragePlugin.messageHandlers!["coverage:setup:error"]).toBeDefined();
    });
  });

  describe("browser actions", () => {
    it("declares no browser actions (coverage runs on server)", () => {
      expect(coveragePlugin.browserActions).toEqual([]);
    });
  });
});

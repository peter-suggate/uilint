/**
 * Vision Plugin Tests
 *
 * Behavioral tests for the vision plugin - no mocking implementation details.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { PluginRegistry } from "uilint-core";
import { visionPlugin } from "../src/plugin/index.js";
import { visionInitialState, type VisionState } from "../src/plugin/state.js";

describe("Vision Plugin", () => {
  describe("registration", () => {
    it("has required plugin metadata", () => {
      expect(visionPlugin.id).toBe("vision");
      expect(visionPlugin.name).toBe("Vision Analysis");
      expect(visionPlugin.version).toBe("1.0.0");
    });

    it("can be registered with PluginRegistry", () => {
      const registry = new PluginRegistry();

      // Should not throw
      expect(() => registry.register(visionPlugin)).not.toThrow();
      expect(registry.has("vision")).toBe(true);
    });

    it("auto-registers on import", async () => {
      // The plugin auto-registers when imported
      const { pluginRegistry } = await import("uilint-core");
      expect(pluginRegistry.has("vision")).toBe(true);
    });
  });

  describe("state definition", () => {
    it("provides valid initial state", () => {
      expect(visionPlugin.state.initialState).toEqual(visionInitialState);
    });

    it("initializes with visionAvailable: false", () => {
      const state = visionPlugin.state.initialState;
      expect(state.visionAvailable).toBe(false);
    });

    it("initializes with empty screenshot history", () => {
      const state = visionPlugin.state.initialState;
      expect(state.screenshotHistory.size).toBe(0);
    });

    it("initializes with empty issues cache", () => {
      const state = visionPlugin.state.initialState;
      expect(state.visionIssuesCache.size).toBe(0);
    });

    it("provides computed values", () => {
      expect(visionPlugin.state.computed).toBeDefined();
      expect(visionPlugin.state.computed!.hasScreenshots).toBeDefined();
      expect(visionPlugin.state.computed!.totalIssues).toBeDefined();
    });

    it("computed hasScreenshots returns false for empty history", () => {
      const state = visionPlugin.state.initialState;
      const hasScreenshots = visionPlugin.state.computed!.hasScreenshots(state);
      expect(hasScreenshots).toBe(false);
    });

    it("computed totalIssues returns 0 for empty cache", () => {
      const state = visionPlugin.state.initialState;
      const totalIssues = visionPlugin.state.computed!.totalIssues(state);
      expect(totalIssues).toBe(0);
    });

    it("computed totalIssues counts issues across routes", () => {
      const state: VisionState = {
        ...visionPlugin.state.initialState,
        visionIssuesCache: new Map([
          ["/page1", [
            { elementText: "btn", message: "Issue 1", category: "spacing", severity: "warning" },
            { elementText: "link", message: "Issue 2", category: "color", severity: "error" },
          ]],
          ["/page2", [
            { elementText: "text", message: "Issue 3", category: "typography", severity: "info" },
          ]],
        ]),
      };
      const totalIssues = visionPlugin.state.computed!.totalIssues(state);
      expect(totalIssues).toBe(3);
    });
  });

  describe("commands", () => {
    it("provides capture full page command", () => {
      const cmd = visionPlugin.commands?.find((c) => c.id === "vision:capture-full-page");
      expect(cmd).toBeDefined();
      expect(cmd!.title).toBe("Capture Full Page");
      expect(cmd!.action.type).toBe("capture-full-page");
    });

    it("provides capture region command", () => {
      const cmd = visionPlugin.commands?.find((c) => c.id === "vision:capture-region");
      expect(cmd).toBeDefined();
      expect(cmd!.title).toBe("Capture Region");
      expect(cmd!.action.type).toBe("enter-region-selection");
    });

    it("commands have availability conditions", () => {
      const captureCmd = visionPlugin.commands?.find((c) => c.id === "vision:capture-full-page");
      expect(captureCmd!.isAvailable).toEqual({ binding: "visionAvailable" });
    });

    it("all commands have required fields", () => {
      for (const cmd of visionPlugin.commands || []) {
        expect(cmd.id).toBeTruthy();
        expect(cmd.title).toBeTruthy();
        expect(cmd.keywords).toBeInstanceOf(Array);
        expect(cmd.category).toBe("Vision");
        expect(cmd.action).toBeDefined();
        expect(cmd.action.type).toBeTruthy();
      }
    });
  });

  describe("toolbar groups", () => {
    it("provides capture toolbar group", () => {
      expect(visionPlugin.toolbarGroups).toHaveLength(1);
      const group = visionPlugin.toolbarGroups![0];
      expect(group.id).toBe("vision:capture");
      expect(group.icon).toBe("camera");
    });

    it("toolbar group has visibility condition", () => {
      const group = visionPlugin.toolbarGroups![0];
      expect(group.isVisible).toEqual({ binding: "visionAvailable" });
    });

    it("toolbar group has capture actions", () => {
      const group = visionPlugin.toolbarGroups![0];
      expect(group.actions).toHaveLength(2);
      expect(group.actions[0].id).toBe("vision:capture-full");
      expect(group.actions[1].id).toBe("vision:capture-region");
    });
  });

  describe("panels", () => {
    it("provides vision issue panel", () => {
      const panel = visionPlugin.panels?.find((p) => p.id === "vision-issue");
      expect(panel).toBeDefined();
      expect(panel!.layout).toBeInstanceOf(Array);
      expect(panel!.layout.length).toBeGreaterThan(0);
    });

    it("provides screenshot gallery panel", () => {
      const panel = visionPlugin.panels?.find((p) => p.id === "vision-gallery");
      expect(panel).toBeDefined();
    });

    it("panels have empty state configuration", () => {
      const issuePanel = visionPlugin.panels?.find((p) => p.id === "vision-issue");
      expect(issuePanel!.empty).toBeDefined();
      expect(issuePanel!.empty!.message).toBeTruthy();
    });
  });

  describe("rules", () => {
    it("provides semantic-vision rule", () => {
      const rule = visionPlugin.rules?.find((r) => r.id === "semantic-vision");
      expect(rule).toBeDefined();
      expect(rule!.name).toBe("Vision Analysis");
      expect(rule!.category).toBe("vision");
    });

    it("rule has requirements defined", () => {
      const rule = visionPlugin.rules?.find((r) => r.id === "semantic-vision");
      expect(rule!.requirements).toHaveLength(2);
      expect(rule!.requirements![0].type).toBe("ollama");
    });
  });

  describe("issue aggregation", () => {
    it("aggregates issues from cache into PluginIssue format", () => {
      const state: VisionState = {
        ...visionPlugin.state.initialState,
        visionIssuesCache: new Map([
          ["/page1", [
            {
              elementText: "button",
              message: "Spacing issue",
              category: "spacing",
              severity: "warning",
              dataLoc: "src/Button.tsx:10:5"
            },
          ]],
        ]),
      };

      const contribution = visionPlugin.getIssues!(state);
      expect(contribution.pluginId).toBe("vision");
      expect(contribution.issues.size).toBe(1);

      const issues = contribution.issues.get("src/Button.tsx:10:5");
      expect(issues).toHaveLength(1);
      expect(issues![0].message).toBe("Spacing issue");
      expect(issues![0].ruleId).toBe("semantic-vision");
    });

    it("returns empty map when no issues", () => {
      const state = visionPlugin.state.initialState;
      const contribution = visionPlugin.getIssues!(state);
      expect(contribution.pluginId).toBe("vision");
      expect(contribution.issues.size).toBe(0);
    });

    it("skips issues without dataLoc", () => {
      const state: VisionState = {
        ...visionPlugin.state.initialState,
        visionIssuesCache: new Map([
          ["/page1", [
            {
              elementText: "button",
              message: "No location",
              category: "spacing",
              severity: "warning",
              // No dataLoc
            },
          ]],
        ]),
      };

      const contribution = visionPlugin.getIssues!(state);
      expect(contribution.issues.size).toBe(0);
    });
  });

  describe("actions", () => {
    it("provides action handlers", () => {
      expect(visionPlugin.actions).toBeDefined();
      expect(visionPlugin.actions!["capture-full-page"]).toBeDefined();
      expect(visionPlugin.actions!["enter-region-selection"]).toBeDefined();
      expect(visionPlugin.actions!["handle-vision-result"]).toBeDefined();
      expect(visionPlugin.actions!["clear-screenshots"]).toBeDefined();
    });
  });

  describe("message handlers", () => {
    it("provides WebSocket message handlers", () => {
      expect(visionPlugin.messageHandlers).toBeDefined();
      expect(visionPlugin.messageHandlers!["vision:status"]).toBeDefined();
      expect(visionPlugin.messageHandlers!["vision:progress"]).toBeDefined();
      expect(visionPlugin.messageHandlers!["vision:result"]).toBeDefined();
    });
  });

  describe("browser actions", () => {
    it("declares required browser actions", () => {
      expect(visionPlugin.browserActions).toContain("capture-screenshot");
      expect(visionPlugin.browserActions).toContain("collect-manifest");
    });
  });
});

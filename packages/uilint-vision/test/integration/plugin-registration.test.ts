/**
 * Integration Tests: Vision Plugin Registration
 *
 * Tests that verify the vision plugin integrates correctly with the
 * core plugin registry system.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PluginRegistry, pluginRegistry } from "uilint-core";

describe("Vision Plugin Integration", () => {
  describe("auto-registration", () => {
    it("registers with global pluginRegistry on import", async () => {
      // Import the vision package - this should trigger auto-registration
      await import("../../src/index.js");

      // Verify plugin is registered
      expect(pluginRegistry.has("vision")).toBe(true);

      const plugin = pluginRegistry.get("vision");
      expect(plugin).toBeDefined();
      expect(plugin?.name).toBe("Vision Analysis");
    });

    it("exports all expected browser utilities", async () => {
      const vision = await import("../../src/index.js");

      // Check browser utilities are exported
      expect(typeof vision.collectElementManifest).toBe("function");
      expect(typeof vision.captureScreenshot).toBe("function");
      expect(typeof vision.captureRegion).toBe("function");
      expect(typeof vision.captureScreenshotRegion).toBe("function");
      expect(typeof vision.getCurrentRoute).toBe("function");
      expect(typeof vision.matchIssuesToManifest).toBe("function");
      expect(typeof vision.buildVisionAnalysisPayload).toBe("function");
    });

    it("exports all expected types via plugin", async () => {
      const vision = await import("../../src/index.js");

      // Check plugin is exported
      expect(vision.visionPlugin).toBeDefined();
      expect(vision.visionPlugin.id).toBe("vision");
      expect(vision.visionPlugin.state).toBeDefined();
      expect(vision.visionPlugin.commands).toBeDefined();
      expect(vision.visionPlugin.panels).toBeDefined();
      expect(vision.visionPlugin.rules).toBeDefined();
    });
  });

  describe("plugin definition completeness", () => {
    it("has all required metadata", async () => {
      const { visionPlugin } = await import("../../src/index.js");

      expect(visionPlugin.id).toBe("vision");
      expect(visionPlugin.name).toBe("Vision Analysis");
      expect(visionPlugin.version).toBe("1.0.0");
      expect(visionPlugin.description).toBeTruthy();
    });

    it("has valid state definition", async () => {
      const { visionPlugin } = await import("../../src/index.js");

      expect(visionPlugin.state).toBeDefined();
      expect(visionPlugin.state.initialState).toBeDefined();
      expect(visionPlugin.state.computed).toBeDefined();

      // Verify computed functions work
      const initialState = visionPlugin.state.initialState;
      const computed = visionPlugin.state.computed!;

      expect(computed.hasScreenshots(initialState)).toBe(false);
      expect(computed.totalIssues(initialState)).toBe(0);
    });

    it("has action handlers", async () => {
      const { visionPlugin } = await import("../../src/index.js");

      expect(visionPlugin.actions).toBeDefined();
      expect(typeof visionPlugin.actions!["capture-full-page"]).toBe("function");
      expect(typeof visionPlugin.actions!["trigger-vision-analysis"]).toBe("function");
      expect(typeof visionPlugin.actions!["handle-vision-result"]).toBe("function");
    });

    it("has message handlers for WebSocket messages", async () => {
      const { visionPlugin } = await import("../../src/index.js");

      expect(visionPlugin.messageHandlers).toBeDefined();
      expect(typeof visionPlugin.messageHandlers!["vision:result"]).toBe("function");
      expect(typeof visionPlugin.messageHandlers!["vision:progress"]).toBe("function");
      expect(typeof visionPlugin.messageHandlers!["vision:status"]).toBe("function");
    });
  });

  describe("isolated registry usage", () => {
    let isolatedRegistry: PluginRegistry;

    beforeEach(() => {
      isolatedRegistry = new PluginRegistry();
    });

    it("can register plugin with isolated registry", async () => {
      const { visionPlugin } = await import("../../src/index.js");

      expect(() => isolatedRegistry.register(visionPlugin)).not.toThrow();
      expect(isolatedRegistry.has("vision")).toBe(true);
    });

    it("can unregister and re-register", async () => {
      const { visionPlugin } = await import("../../src/index.js");

      isolatedRegistry.register(visionPlugin);
      expect(isolatedRegistry.has("vision")).toBe(true);

      isolatedRegistry.unregister("vision");
      expect(isolatedRegistry.has("vision")).toBe(false);

      isolatedRegistry.register(visionPlugin);
      expect(isolatedRegistry.has("vision")).toBe(true);
    });
  });
});

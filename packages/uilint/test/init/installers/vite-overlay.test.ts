/**
 * Tests for Vite Overlay Installer
 *
 * Tests the Vite installer's detection, target identification, and installation execution.
 */

import { describe, it, expect } from "vitest";
import { viteOverlayInstaller } from "../../../src/commands/init/installers/vite-overlay.js";
import {
  createMockProjectState,
  createMockViteApp,
} from "../helpers/mock-state.js";
import type { ProgressEvent } from "../../../src/commands/init/installers/types.js";

describe("ViteOverlayInstaller", () => {
  describe("metadata", () => {
    it("has correct id and metadata", () => {
      expect(viteOverlayInstaller.id).toBe("vite");
      expect(viteOverlayInstaller.name).toBe("Vite overlay");
      expect(viteOverlayInstaller.icon).toBe("⚡");
    });
  });

  describe("isApplicable", () => {
    it("returns true when Vite apps are detected", () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp()],
      });

      expect(viteOverlayInstaller.isApplicable(state)).toBe(true);
    });

    it("returns false when no Vite apps are detected", () => {
      const state = createMockProjectState({
        viteApps: [],
      });

      expect(viteOverlayInstaller.isApplicable(state)).toBe(false);
    });
  });

  describe("getTargets", () => {
    it("returns one target per Vite app", () => {
      const app1 = createMockViteApp("/test/apps/web");
      const app2 = createMockViteApp("/test/apps/admin");
      const state = createMockProjectState({
        viteApps: [app1, app2],
      });

      const targets = viteOverlayInstaller.getTargets(state);

      expect(targets).toHaveLength(2);
      expect(targets[0].id).toBe("vite-/test/apps/web");
      expect(targets[0].label).toBe("web");
      expect(targets[1].label).toBe("admin");
    });

    it("returns empty array when no Vite apps", () => {
      const state = createMockProjectState({
        viteApps: [],
      });

      const targets = viteOverlayInstaller.getTargets(state);

      expect(targets).toHaveLength(0);
    });

    it("includes path and hint", () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project/apps/web")],
      });

      const targets = viteOverlayInstaller.getTargets(state);

      expect(targets[0].path).toBe("/test/project/apps/web");
      expect(targets[0].hint).toBe("React + Vite");
    });

    it("marks as installed based on hasUilintOverlay", () => {
      const app = createMockViteApp("/test/project/apps/web");
      app.hasUilintOverlay = true;
      const state = createMockProjectState({
        viteApps: [app],
      });

      const targets = viteOverlayInstaller.getTargets(state);

      expect(targets[0].isInstalled).toBe(true);
    });
  });

  describe("plan", () => {
    it("generates correct actions for Vite installation", () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
        packageManager: "pnpm",
      });
      const targets = viteOverlayInstaller.getTargets(state);

      const { actions, dependencies } = viteOverlayInstaller.plan(
        targets,
        {},
        state
      );

      // Should have inject_react action with mode="vite"
      const reactAction = actions.find((a) => a.type === "inject_react");
      expect(reactAction).toBeDefined();
      if (reactAction?.type === "inject_react") {
        expect(reactAction.projectPath).toBe("/test/project");
        expect(reactAction.appRoot).toBe("src");
        expect(reactAction.mode).toBe("vite");
      }

      // Should have inject_vite_config action
      const configAction = actions.find((a) => a.type === "inject_vite_config");
      expect(configAction).toBeDefined();
      if (configAction?.type === "inject_vite_config") {
        expect(configAction.projectPath).toBe("/test/project");
      }
    });

    it("generates dependency installation for uilint packages", () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
        packageManager: "yarn",
      });
      const targets = viteOverlayInstaller.getTargets(state);

      const { dependencies } = viteOverlayInstaller.plan(targets, {}, state);

      expect(dependencies).toHaveLength(1);

      const dep = dependencies[0];
      expect(dep.packagePath).toBe("/test/project");
      expect(dep.packageManager).toBe("yarn");
      expect(dep.packages).toContain("jsx-loc-plugin");
    });

    it("returns empty plan when no targets provided", () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
      });

      const { actions, dependencies } = viteOverlayInstaller.plan([], {}, state);

      expect(actions).toHaveLength(0);
      expect(dependencies).toHaveLength(0);
    });

    it("does not generate install_next_routes action", () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
      });
      const targets = viteOverlayInstaller.getTargets(state);

      const { actions } = viteOverlayInstaller.plan(targets, {}, state);

      // Vite doesn't need Next.js routes
      const routesAction = actions.find((a) => a.type === "install_next_routes");
      expect(routesAction).toBeUndefined();
    });
  });

  describe("execute", () => {
    it("yields progress events during installation", async () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
        packageManager: "pnpm",
      });
      const targets = viteOverlayInstaller.getTargets(state);

      const events: ProgressEvent[] = [];
      const generator = viteOverlayInstaller.execute(targets, {}, state);

      for await (const event of generator) {
        events.push(event);
      }

      // Should have start, progress events, and complete
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe("start");
      expect(events[events.length - 1].type).toBe("complete");

      // Should have progress events for different steps
      const progressEvents = events.filter((e) => e.type === "progress");
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it("returns early when no targets provided", async () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
      });

      const generator = viteOverlayInstaller.execute([], {}, state);

      const events: ProgressEvent[] = [];
      for await (const event of generator) {
        events.push(event);
      }

      // Should have no events when no targets
      expect(events).toHaveLength(0);
    });
  });
});

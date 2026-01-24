/**
 * Tests for Next.js Overlay Installer
 *
 * Tests the Next.js installer's detection, target identification, and installation execution.
 */

import { describe, it, expect } from "vitest";
import { nextOverlayInstaller } from "../../../src/commands/init/installers/next-overlay.js";
import {
  createMockProjectState,
  createMockNextApp,
} from "../helpers/mock-state.js";
import type { ProgressEvent } from "../../../src/commands/init/installers/types.js";

describe("NextOverlayInstaller", () => {
  describe("metadata", () => {
    it("has correct id and metadata", () => {
      expect(nextOverlayInstaller.id).toBe("next");
      expect(nextOverlayInstaller.name).toBe("Next.js overlay");
      expect(nextOverlayInstaller.icon).toBe("🔷");
    });
  });

  describe("isApplicable", () => {
    it("returns true when Next.js apps are detected", () => {
      const state = createMockProjectState({
        nextApps: [createMockNextApp()],
      });

      expect(nextOverlayInstaller.isApplicable(state)).toBe(true);
    });

    it("returns false when no Next.js apps are detected", () => {
      const state = createMockProjectState({
        nextApps: [],
      });

      expect(nextOverlayInstaller.isApplicable(state)).toBe(false);
    });
  });

  describe("getTargets", () => {
    it("returns one target per Next.js app", () => {
      const app1 = createMockNextApp("/test/apps/web");
      const app2 = createMockNextApp("/test/apps/admin");
      const state = createMockProjectState({
        nextApps: [app1, app2],
      });

      const targets = nextOverlayInstaller.getTargets(state);

      expect(targets).toHaveLength(2);
      expect(targets[0].id).toBe("next-/test/apps/web");
      expect(targets[0].label).toBe("web");
      expect(targets[1].label).toBe("admin");
    });

    it("returns empty array when no Next.js apps", () => {
      const state = createMockProjectState({
        nextApps: [],
      });

      const targets = nextOverlayInstaller.getTargets(state);

      expect(targets).toHaveLength(0);
    });

    it("includes path and hint", () => {
      const state = createMockProjectState({
        nextApps: [createMockNextApp("/test/project/apps/web")],
      });

      const targets = nextOverlayInstaller.getTargets(state);

      expect(targets[0].path).toBe("/test/project/apps/web");
      expect(targets[0].hint).toBe("App Router");
    });

    it("marks as installed based on hasUilintOverlay", () => {
      const app = createMockNextApp("/test/project/apps/web");
      app.hasUilintOverlay = true;
      const state = createMockProjectState({
        nextApps: [app],
      });

      const targets = nextOverlayInstaller.getTargets(state);

      expect(targets[0].isInstalled).toBe(true);
    });
  });

  describe("plan", () => {
    it("generates correct actions for Next.js installation", () => {
      const state = createMockProjectState({
        nextApps: [createMockNextApp("/test/project")],
        packageManager: "pnpm",
      });
      const targets = nextOverlayInstaller.getTargets(state);

      const { actions, dependencies } = nextOverlayInstaller.plan(
        targets,
        {},
        state
      );

      // Should have install_next_routes action
      const routesAction = actions.find((a) => a.type === "install_next_routes");
      expect(routesAction).toBeDefined();
      if (routesAction?.type === "install_next_routes") {
        expect(routesAction.projectPath).toBe("/test/project");
        expect(routesAction.appRoot).toBe("app");
      }

      // Should have inject_react action
      const reactAction = actions.find((a) => a.type === "inject_react");
      expect(reactAction).toBeDefined();
      if (reactAction?.type === "inject_react") {
        expect(reactAction.projectPath).toBe("/test/project");
        expect(reactAction.appRoot).toBe("app");
        expect(reactAction.mode).toBe("next");
      }

      // Should have inject_next_config action
      const configAction = actions.find((a) => a.type === "inject_next_config");
      expect(configAction).toBeDefined();
      if (configAction?.type === "inject_next_config") {
        expect(configAction.projectPath).toBe("/test/project");
      }
    });

    it("generates dependency installation for uilint packages", () => {
      const state = createMockProjectState({
        nextApps: [createMockNextApp("/test/project")],
        packageManager: "npm",
      });
      const targets = nextOverlayInstaller.getTargets(state);

      const { dependencies } = nextOverlayInstaller.plan(targets, {}, state);

      expect(dependencies).toHaveLength(1);

      const dep = dependencies[0];
      expect(dep.packagePath).toBe("/test/project");
      expect(dep.packageManager).toBe("npm");
      expect(dep.packages).toContain("jsx-loc-plugin");
    });

    it("returns empty plan when no targets provided", () => {
      const state = createMockProjectState({
        nextApps: [createMockNextApp("/test/project")],
      });

      const { actions, dependencies } = nextOverlayInstaller.plan([], {}, state);

      expect(actions).toHaveLength(0);
      expect(dependencies).toHaveLength(0);
    });
  });

  describe("execute", () => {
    it("yields progress events during installation", async () => {
      const state = createMockProjectState({
        nextApps: [createMockNextApp("/test/project")],
        packageManager: "pnpm",
      });
      const targets = nextOverlayInstaller.getTargets(state);

      const events: ProgressEvent[] = [];
      const generator = nextOverlayInstaller.execute(targets, {}, state);

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
        nextApps: [createMockNextApp("/test/project")],
      });

      const generator = nextOverlayInstaller.execute([], {}, state);

      const events: ProgressEvent[] = [];
      for await (const event of generator) {
        events.push(event);
      }

      // Should have no events when no targets
      expect(events).toHaveLength(0);
    });
  });
});

/**
 * Tests for Vite Overlay Installer
 *
 * Tests the Vite installer's detection, target identification, and installation execution.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createViteOverlayInstaller } from "../../../src/commands/install/installers/vite-overlay.js";
import {
  createMockProjectState,
  createMockViteApp,
} from "../helpers/mock-state.js";
import type { ProgressEvent } from "../../../src/commands/install/installers/types.js";

describe("ViteOverlayInstaller", () => {
  let installer: ReturnType<typeof createViteOverlayInstaller>;

  beforeEach(() => {
    installer = createViteOverlayInstaller();
  });

  describe("metadata", () => {
    it("has correct id and metadata", () => {
      expect(installer.id).toBe("vite-overlay");
      expect(installer.name).toBe("Vite Overlay");
      expect(installer.category).toBe("framework");
      expect(installer.priority).toBe(90);
    });
  });

  describe("isApplicable", () => {
    it("returns true when Vite apps are detected", () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp()],
      });

      expect(installer.isApplicable(state)).toBe(true);
    });

    it("returns false when no Vite apps are detected", () => {
      const state = createMockProjectState({
        viteApps: [],
      });

      expect(installer.isApplicable(state)).toBe(false);
    });
  });

  describe("getTargets", () => {
    it("returns one target per Vite app", () => {
      const app1 = createMockViteApp("/test/apps/web");
      const app2 = createMockViteApp("/test/apps/admin");
      const state = createMockProjectState({
        viteApps: [app1, app2],
      });

      const targets = installer.getTargets(state);

      expect(targets).toHaveLength(2);
      expect(targets[0].id).toBe("/test/apps/web");
      expect(targets[0].displayName).toContain("Vite + React");
      expect(targets[0].displayName).toContain("/test/apps/web");
      expect(targets[0].metadata?.entryRoot).toBe("src");
    });

    it("returns empty array when no Vite apps", () => {
      const state = createMockProjectState({
        viteApps: [],
      });

      const targets = installer.getTargets(state);

      expect(targets).toHaveLength(0);
    });

    it("includes metadata with entryRoot and configPath", () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
      });

      const targets = installer.getTargets(state);

      expect(targets[0].metadata).toBeDefined();
      expect(targets[0].metadata?.entryRoot).toBe("src");
      expect(targets[0].metadata?.configPath).toBe("/test/project/vite.config.ts");
    });
  });

  describe("isAlreadyInstalled", () => {
    it("returns not installed for fresh project", async () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
      });
      const targets = installer.getTargets(state);

      const status = await installer.isAlreadyInstalled(state, targets[0]);

      expect(status.installed).toBe(false);
    });

    it("returns not installed when target app not found", async () => {
      const state = createMockProjectState({
        viteApps: [],
      });
      const fakeTarget = {
        id: "/nonexistent",
        displayName: "Fake",
        metadata: {},
      };

      const status = await installer.isAlreadyInstalled(state, fakeTarget);

      expect(status.installed).toBe(false);
    });
  });

  describe("execute", () => {
    it("yields progress events during installation", async () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
        packageManager: "pnpm",
      });
      const targets = installer.getTargets(state);

      const events: ProgressEvent[] = [];
      const generator = installer.execute({
        state,
        targets,
        dryRun: true,
      });

      for await (const event of generator) {
        if (typeof event === "object" && "type" in event) {
          events.push(event);
        }
      }

      // Should have start, progress events, and complete
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe("start");
      expect(events[events.length - 1].type).toBe("complete");

      // Should have progress events for different steps
      const progressEvents = events.filter((e) => e.type === "progress");
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it("generates correct actions for Vite installation", async () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
        packageManager: "pnpm",
      });
      const targets = installer.getTargets(state);

      const generator = installer.execute({
        state,
        targets,
        dryRun: true,
      });

      let result;
      for await (const value of generator) {
        result = value;
      }

      expect(result).toBeDefined();
      expect(result!.success).toBe(true);
      expect(result!.actions).toBeDefined();

      // Should have inject_react action with mode="vite"
      const reactAction = result!.actions.find((a) => a.type === "inject_react");
      expect(reactAction).toBeDefined();
      if (reactAction?.type === "inject_react") {
        expect(reactAction.projectPath).toBe("/test/project");
        expect(reactAction.appRoot).toBe("src");
        expect(reactAction.mode).toBe("vite");
      }

      // Should have inject_vite_config action
      const configAction = result!.actions.find(
        (a) => a.type === "inject_vite_config"
      );
      expect(configAction).toBeDefined();
      if (configAction?.type === "inject_vite_config") {
        expect(configAction.projectPath).toBe("/test/project");
      }
    });

    it("generates dependency installation for uilint packages", async () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
        packageManager: "yarn",
      });
      const targets = installer.getTargets(state);

      const generator = installer.execute({
        state,
        targets,
        dryRun: true,
      });

      let result;
      for await (const value of generator) {
        result = value;
      }

      expect(result!.dependencies).toBeDefined();
      expect(result!.dependencies).toHaveLength(1);

      const dep = result!.dependencies[0];
      expect(dep.packagePath).toBe("/test/project");
      expect(dep.packageManager).toBe("yarn");
      expect(dep.packages).toEqual([
        "uilint-react",
        "uilint-core",
        "jsx-loc-plugin",
      ]);
    });

    it("handles multiple Vite apps correctly", async () => {
      const state = createMockProjectState({
        viteApps: [
          createMockViteApp("/test/apps/web"),
          createMockViteApp("/test/apps/admin"),
        ],
        packageManager: "pnpm",
      });
      const targets = installer.getTargets(state);

      const generator = installer.execute({
        state,
        targets,
        dryRun: true,
      });

      let result;
      for await (const value of generator) {
        result = value;
      }

      // Should have actions for both apps
      const reactActions = result!.actions.filter((a) => a.type === "inject_react");
      expect(reactActions).toHaveLength(2);

      // Should have dependencies for both apps
      expect(result!.dependencies).toHaveLength(2);
    });

    it("yields error event when app not found", async () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
      });
      const fakeTarget = {
        id: "/nonexistent",
        displayName: "Fake Vite App",
        metadata: {},
      };

      const events: ProgressEvent[] = [];
      const generator = installer.execute({
        state,
        targets: [fakeTarget],
        dryRun: true,
      });

      for await (const event of generator) {
        if (typeof event === "object" && "type" in event) {
          events.push(event);
        }
      }

      const errorEvent = events.find((e) => e.type === "error");
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.message).toContain("not found");
    });

    it("respects dryRun flag", async () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
      });
      const targets = installer.getTargets(state);

      // Dry run should still work
      const generator = installer.execute({
        state,
        targets,
        dryRun: true,
      });

      let result;
      for await (const value of generator) {
        result = value;
      }

      expect(result!.success).toBe(true);
      expect(result!.actions.length).toBeGreaterThan(0);
    });

    it("does not generate install_next_routes action", async () => {
      const state = createMockProjectState({
        viteApps: [createMockViteApp("/test/project")],
      });
      const targets = installer.getTargets(state);

      const generator = installer.execute({
        state,
        targets,
        dryRun: true,
      });

      let result;
      for await (const value of generator) {
        result = value;
      }

      // Vite doesn't need Next.js routes
      const routesAction = result!.actions.find(
        (a) => a.type === "install_next_routes"
      );
      expect(routesAction).toBeUndefined();
    });
  });
});

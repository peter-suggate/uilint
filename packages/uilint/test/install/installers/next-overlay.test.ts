/**
 * Tests for Next.js Overlay Installer
 *
 * Tests the Next.js installer's detection, target identification, and installation execution.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createNextInstaller } from "../../../src/commands/install/installers/next-overlay.js";
import {
  createMockProjectState,
  createMockNextApp,
  consumeGenerator,
} from "../helpers/index.js";
import type { ProgressEvent } from "../../../src/commands/install/installers/types.js";

describe("NextOverlayInstaller", () => {
  let installer: ReturnType<typeof createNextInstaller>;

  beforeEach(() => {
    installer = createNextInstaller();
  });

  describe("metadata", () => {
    it("has correct id and metadata", () => {
      expect(installer.id).toBe("next");
      expect(installer.name).toBe("Next.js Overlay");
      expect(installer.category).toBe("framework");
      expect(installer.priority).toBe(90);
    });
  });

  describe("isApplicable", () => {
    it("returns true when Next.js apps are detected", () => {
      const state = createMockProjectState({
        nextApps: [createMockNextApp()],
      });

      expect(installer.isApplicable(state)).toBe(true);
    });

    it("returns false when no Next.js apps are detected", () => {
      const state = createMockProjectState({
        nextApps: [],
      });

      expect(installer.isApplicable(state)).toBe(false);
    });
  });

  describe("getTargets", () => {
    it("returns one target per Next.js app", () => {
      const app1 = createMockNextApp("/test/apps/web");
      const app2 = createMockNextApp("/test/apps/admin");
      const state = createMockProjectState({
        nextApps: [app1, app2],
      });

      const targets = installer.getTargets(state);

      expect(targets).toHaveLength(2);
      expect(targets[0].id).toBe("/test/apps/web");
      expect(targets[0].displayName).toBe("web");
      expect(targets[1].displayName).toBe("admin");
    });

    it("returns empty array when no Next.js apps", () => {
      const state = createMockProjectState({
        nextApps: [],
      });

      const targets = installer.getTargets(state);

      expect(targets).toHaveLength(0);
    });

    it("includes metadata with appInfo", () => {
      const state = createMockProjectState({
        nextApps: [createMockNextApp("/test/project")],
      });

      const targets = installer.getTargets(state);

      expect(targets[0].metadata).toBeDefined();
      const metadata = targets[0].metadata as { appInfo: any };
      expect(metadata.appInfo).toBeDefined();
      expect(metadata.appInfo.detection.appRoot).toBe("app");
    });
  });

  describe("isAlreadyInstalled", () => {
    it("returns not installed for fresh project", async () => {
      const state = createMockProjectState({
        nextApps: [createMockNextApp("/test/project")],
      });
      const targets = installer.getTargets(state);

      const status = await installer.isAlreadyInstalled(state, targets[0]);

      expect(status.installed).toBe(false);
    });

    it("returns not installed when target app not found", async () => {
      const state = createMockProjectState({
        nextApps: [],
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
        nextApps: [createMockNextApp("/test/project")],
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

    it("generates correct actions for Next.js installation", async () => {
      const state = createMockProjectState({
        nextApps: [createMockNextApp("/test/project")],
        packageManager: "pnpm",
      });
      const targets = installer.getTargets(state);

      const { result } = await consumeGenerator(
        installer.execute({
          state,
          targets,
          dryRun: true,
        })
      );

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.actions).toBeDefined();

      // Should have install_next_routes action
      const routesAction = result.actions.find(
        (a: any) => a.type === "install_next_routes"
      );
      expect(routesAction).toBeDefined();
      if (routesAction?.type === "install_next_routes") {
        expect(routesAction.projectPath).toBe("/test/project");
        expect(routesAction.appRoot).toBe("app");
      }

      // Should have inject_react action
      const reactAction = result.actions.find((a: any) => a.type === "inject_react");
      expect(reactAction).toBeDefined();
      if (reactAction?.type === "inject_react") {
        expect(reactAction.projectPath).toBe("/test/project");
        expect(reactAction.appRoot).toBe("app");
        expect(reactAction.mode).toBe("next");
      }

      // Should have inject_next_config action
      const configAction = result.actions.find(
        (a: any) => a.type === "inject_next_config"
      );
      expect(configAction).toBeDefined();
      if (configAction?.type === "inject_next_config") {
        expect(configAction.projectPath).toBe("/test/project");
      }
    });

    it("generates dependency installation for uilint packages", async () => {
      const state = createMockProjectState({
        nextApps: [createMockNextApp("/test/project")],
        packageManager: "npm",
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
      expect(dep.packageManager).toBe("npm");
      expect(dep.packages).toEqual([
        "uilint-react",
        "uilint-core",
        "jsx-loc-plugin",
      ]);
    });

    it("handles multiple Next.js apps by using first one", async () => {
      const state = createMockProjectState({
        nextApps: [
          createMockNextApp("/test/apps/web"),
          createMockNextApp("/test/apps/admin"),
        ],
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

      // Should have a skip event mentioning multiple apps
      const skipEvent = events.find((e) => e.type === "skip");
      expect(skipEvent).toBeDefined();
      expect(skipEvent?.message).toContain("Multiple Next.js apps");
    });

    it("yields error event when no targets provided", async () => {
      const state = createMockProjectState({
        nextApps: [createMockNextApp("/test/project")],
      });

      const generator = installer.execute({
        state,
        targets: [],
        dryRun: true,
      });

      let result;
      for await (const value of generator) {
        result = value;
      }

      expect(result).toBeDefined();
      expect(result!.success).toBe(false);
      expect(result!.error).toContain("No targets");
    });

    it("respects dryRun flag", async () => {
      const state = createMockProjectState({
        nextApps: [createMockNextApp("/test/project")],
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
  });
});

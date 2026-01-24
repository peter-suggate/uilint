/**
 * Tests for Genstyleguide Installer
 *
 * Tests the genstyleguide command installer's functionality.
 */

import { describe, it, expect } from "vitest";
import { genstyleguideInstaller } from "../../../src/commands/init/installers/genstyleguide.js";
import { createMockProjectState } from "../helpers/mock-state.js";
import type { ProgressEvent } from "../../../src/commands/init/installers/types.js";

describe("GenstyleguideInstaller", () => {
  describe("metadata", () => {
    it("has correct id and metadata", () => {
      expect(genstyleguideInstaller.id).toBe("genstyleguide");
      expect(genstyleguideInstaller.name).toBe("/genstyleguide command");
      expect(genstyleguideInstaller.icon).toBe("📝");
    });
  });

  describe("isApplicable", () => {
    it("is always applicable to any project", () => {
      const state = createMockProjectState();
      expect(genstyleguideInstaller.isApplicable(state)).toBe(true);

      const stateWithApps = createMockProjectState({
        nextApps: [],
        viteApps: [],
      });
      expect(genstyleguideInstaller.isApplicable(stateWithApps)).toBe(true);
    });
  });

  describe("getTargets", () => {
    it("returns single target for project-level installation", () => {
      const state = createMockProjectState();
      const targets = genstyleguideInstaller.getTargets(state);

      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe("genstyleguide-command");
      expect(targets[0].label).toBe(".cursor/commands/genstyleguide.md");
    });

    it("includes path to the command file", () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: false,
          path: "/test/project/.cursor",
        },
      });
      const targets = genstyleguideInstaller.getTargets(state);

      expect(targets[0].path).toBe(
        "/test/project/.cursor/commands/genstyleguide.md"
      );
    });

    it("marks as installed when command already exists", () => {
      const state = createMockProjectState({
        commands: {
          genstyleguide: true,
        },
      });
      const targets = genstyleguideInstaller.getTargets(state);

      expect(targets[0].isInstalled).toBe(true);
    });

    it("marks as not installed when command does not exist", () => {
      const state = createMockProjectState({
        commands: {
          genstyleguide: false,
        },
      });
      const targets = genstyleguideInstaller.getTargets(state);

      expect(targets[0].isInstalled).toBe(false);
    });
  });

  describe("plan", () => {
    it("generates actions to create .cursor and commands directories", () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: false,
          path: "/test/project/.cursor",
        },
      });
      const targets = genstyleguideInstaller.getTargets(state);

      const { actions, dependencies } = genstyleguideInstaller.plan(
        targets,
        {},
        state
      );

      // Should create .cursor directory
      const cursorDirAction = actions.find(
        (a) =>
          a.type === "create_directory" && a.path === "/test/project/.cursor"
      );
      expect(cursorDirAction).toBeDefined();

      // Should create commands directory
      const commandsDirAction = actions.find(
        (a) =>
          a.type === "create_directory" &&
          a.path === "/test/project/.cursor/commands"
      );
      expect(commandsDirAction).toBeDefined();

      // Should have no dependencies
      expect(dependencies).toHaveLength(0);
    });

    it("generates action to create genstyleguide.md file", () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: true,
          path: "/test/project/.cursor",
        },
      });
      const targets = genstyleguideInstaller.getTargets(state);

      const { actions } = genstyleguideInstaller.plan(targets, {}, state);

      const createFileAction = actions.find(
        (a) =>
          a.type === "create_file" &&
          a.path === "/test/project/.cursor/commands/genstyleguide.md"
      );
      expect(createFileAction).toBeDefined();

      if (createFileAction?.type === "create_file") {
        // The content should be defined and be non-empty
        expect(createFileAction.content.length).toBeGreaterThan(0);
      }
    });

    it("skips creating .cursor directory if it already exists", () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: true,
          path: "/test/project/.cursor",
        },
      });
      const targets = genstyleguideInstaller.getTargets(state);

      const { actions } = genstyleguideInstaller.plan(targets, {}, state);

      // Should not create .cursor directory if it exists
      const cursorDirAction = actions.find(
        (a) =>
          a.type === "create_directory" && a.path === "/test/project/.cursor"
      );
      expect(cursorDirAction).toBeUndefined();

      // But should still create commands directory
      const commandsDirAction = actions.find(
        (a) =>
          a.type === "create_directory" &&
          a.path === "/test/project/.cursor/commands"
      );
      expect(commandsDirAction).toBeDefined();
    });

    it("does not generate any dependencies", () => {
      const state = createMockProjectState();
      const targets = genstyleguideInstaller.getTargets(state);

      const { dependencies } = genstyleguideInstaller.plan(targets, {}, state);

      expect(dependencies).toHaveLength(0);
    });
  });

  describe("execute", () => {
    it("yields progress events during installation", async () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: false,
          path: "/test/project/.cursor",
        },
      });
      const targets = genstyleguideInstaller.getTargets(state);

      const events: ProgressEvent[] = [];
      const generator = genstyleguideInstaller.execute(targets, {}, state);

      for await (const event of generator) {
        events.push(event);
      }

      // Should have start, progress events, and complete
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe("start");
      expect(events[events.length - 1].type).toBe("complete");

      const progressEvents = events.filter((e) => e.type === "progress");
      expect(progressEvents.length).toBeGreaterThan(0);
    });
  });
});

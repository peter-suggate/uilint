/**
 * Tests for Genstyleguide Installer
 *
 * Tests the genstyleguide command installer's functionality.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createGenstyleguideInstaller } from "../../../src/commands/install/installers/genstyleguide.js";
import { createMockProjectState } from "../helpers/mock-state.js";
import type { ProgressEvent } from "../../../src/commands/install/installers/types.js";

describe("GenstyleguideInstaller", () => {
  let installer: ReturnType<typeof createGenstyleguideInstaller>;

  beforeEach(() => {
    installer = createGenstyleguideInstaller();
  });

  describe("metadata", () => {
    it("has correct id and metadata", () => {
      expect(installer.id).toBe("genstyleguide");
      expect(installer.name).toBe("Genstyleguide Command");
      expect(installer.category).toBe("tooling");
      expect(installer.priority).toBe(50);
    });
  });

  describe("isApplicable", () => {
    it("is always applicable to any project", () => {
      const state = createMockProjectState();
      expect(installer.isApplicable(state)).toBe(true);

      const stateWithApps = createMockProjectState({
        nextApps: [],
        viteApps: [],
      });
      expect(installer.isApplicable(stateWithApps)).toBe(true);
    });
  });

  describe("getTargets", () => {
    it("returns single target for project-level installation", () => {
      const state = createMockProjectState();
      const targets = installer.getTargets(state);

      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe("genstyleguide-command");
      expect(targets[0].displayName).toBe("Genstyleguide Command");
    });

    it("includes metadata with command path", () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: false,
          path: "/test/project/.cursor",
        },
      });
      const targets = installer.getTargets(state);

      expect(targets[0].metadata).toBeDefined();
      expect(targets[0].metadata?.commandPath).toBe(
        "/test/project/.cursor/commands/genstyleguide.md"
      );
    });
  });

  describe("isAlreadyInstalled", () => {
    it("returns installed when command already exists", async () => {
      const state = createMockProjectState({
        commands: {
          genstyleguide: true,
        },
      });
      const targets = installer.getTargets(state);

      const status = await installer.isAlreadyInstalled(state, targets[0]);

      expect(status.installed).toBe(true);
      expect(status.details).toContain("already exists");
    });

    it("returns not installed when command does not exist", async () => {
      const state = createMockProjectState({
        commands: {
          genstyleguide: false,
        },
      });
      const targets = installer.getTargets(state);

      const status = await installer.isAlreadyInstalled(state, targets[0]);

      expect(status.installed).toBe(false);
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

      const progressEvents = events.filter((e) => e.type === "progress");
      expect(progressEvents.length).toBeGreaterThan(0);
    });

    it("generates actions to create .cursor and commands directories", async () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: false,
          path: "/test/project/.cursor",
        },
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

      // Should create .cursor directory
      const cursorDirAction = result!.actions.find(
        (a) => a.type === "create_directory" && a.path === "/test/project/.cursor"
      );
      expect(cursorDirAction).toBeDefined();

      // Should create commands directory
      const commandsDirAction = result!.actions.find(
        (a) =>
          a.type === "create_directory" &&
          a.path === "/test/project/.cursor/commands"
      );
      expect(commandsDirAction).toBeDefined();
    });

    it("generates action to create genstyleguide.md file", async () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: true,
          path: "/test/project/.cursor",
        },
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

      const createFileAction = result!.actions.find(
        (a) =>
          a.type === "create_file" &&
          a.path === "/test/project/.cursor/commands/genstyleguide.md"
      );
      expect(createFileAction).toBeDefined();

      if (createFileAction?.type === "create_file") {
        expect(createFileAction.content).toContain("React Style Guide Generator");
        expect(createFileAction.content).toContain("# Stack");
        expect(createFileAction.content).toContain("semantics:");
      }
    });

    it("skips creating .cursor directory if it already exists", async () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: true,
          path: "/test/project/.cursor",
        },
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

      // Should not create .cursor directory if it exists
      const cursorDirAction = result!.actions.find(
        (a) => a.type === "create_directory" && a.path === "/test/project/.cursor"
      );
      expect(cursorDirAction).toBeUndefined();

      // But should still create commands directory
      const commandsDirAction = result!.actions.find(
        (a) =>
          a.type === "create_directory" &&
          a.path === "/test/project/.cursor/commands"
      );
      expect(commandsDirAction).toBeDefined();
    });

    it("does not generate any dependencies", async () => {
      const state = createMockProjectState();
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

      expect(result!.dependencies).toHaveLength(0);
    });

    it("returns summary with created files", async () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: true,
          path: "/test/project/.cursor",
        },
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

      expect(result!.summary).toBeDefined();
      expect(result!.summary?.created).toContain(
        "/test/project/.cursor/commands/genstyleguide.md"
      );
      expect(result!.summary?.modified).toHaveLength(0);
    });

    it("respects dryRun flag", async () => {
      const state = createMockProjectState();
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

      expect(result!.success).toBe(true);
      expect(result!.actions.length).toBeGreaterThan(0);
    });
  });
});

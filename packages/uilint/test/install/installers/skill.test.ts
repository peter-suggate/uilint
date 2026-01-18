/**
 * Tests for Skill Installer
 *
 * Tests the Agent Skill installer's functionality for installing UI consistency skills.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { skillInstaller } from "../../../src/commands/install/installers/skill.js";
import { createMockProjectState } from "../helpers/mock-state.js";
import type { ProgressEvent } from "../../../src/commands/install/installers/types.js";

// Mock existsSync to control skill installation state
vi.mock("fs", async (importOriginal) => {
  const original = await importOriginal<typeof import("fs")>();
  return {
    ...original,
    existsSync: vi.fn((path: string) => {
      // Return false for skill paths by default (not installed)
      if (typeof path === "string" && path.includes("ui-consistency-enforcer")) {
        return false;
      }
      return original.existsSync(path);
    }),
  };
});

describe("SkillInstaller", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("metadata", () => {
    it("has correct id and metadata", () => {
      expect(skillInstaller.id).toBe("skill");
      expect(skillInstaller.name).toBe("UI Consistency Agent skill");
      expect(skillInstaller.icon).toBe("⚡");
    });
  });

  describe("isApplicable", () => {
    it("is always applicable to any project", () => {
      const state = createMockProjectState();
      expect(skillInstaller.isApplicable(state)).toBe(true);

      const stateWithApps = createMockProjectState({
        nextApps: [],
        viteApps: [],
      });
      expect(skillInstaller.isApplicable(stateWithApps)).toBe(true);
    });
  });

  describe("getTargets", () => {
    it("returns target for ui-consistency-skill", () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: false,
          path: "/test/project/.cursor",
        },
      });
      const targets = skillInstaller.getTargets(state);

      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe("ui-consistency-skill");
      expect(targets[0].label).toBe(".cursor/skills/ui-consistency-enforcer");
    });

    it("includes path and hint", () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: false,
          path: "/test/project/.cursor",
        },
      });
      const targets = skillInstaller.getTargets(state);

      expect(targets[0].path).toBe(
        "/test/project/.cursor/skills/ui-consistency-enforcer"
      );
      expect(targets[0].hint).toBe("Agent skill for UI consistency checks");
    });
  });

  describe("plan", () => {
    it("generates actions to create .cursor and skills directories", () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: false,
          path: "/test/project/.cursor",
        },
      });
      const targets = skillInstaller.getTargets(state);

      const { actions, dependencies } = skillInstaller.plan(targets, {}, state);

      // Should create .cursor directory
      const cursorDirAction = actions.find(
        (a) =>
          a.type === "create_directory" && a.path === "/test/project/.cursor"
      );
      expect(cursorDirAction).toBeDefined();

      // Should create skills directory
      const skillsDirAction = actions.find(
        (a) =>
          a.type === "create_directory" &&
          a.path === "/test/project/.cursor/skills"
      );
      expect(skillsDirAction).toBeDefined();

      // Should have no dependencies
      expect(dependencies).toHaveLength(0);
    });

    it("always generates skills directory even if skill loading fails", () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: true,
          path: "/test/project/.cursor",
        },
      });
      const targets = skillInstaller.getTargets(state);

      const { actions } = skillInstaller.plan(targets, {}, state);

      // Should always create the skills directory regardless of skill loading
      const skillsDirAction = actions.find(
        (a) =>
          a.type === "create_directory" &&
          a.path === "/test/project/.cursor/skills"
      );
      expect(skillsDirAction).toBeDefined();

      // Note: If skill loading fails (skill file doesn't exist in test env),
      // the individual skill directory won't be created, but that's expected
      // since loadSkill catches the error
    });

    it("does not generate any dependencies", () => {
      const state = createMockProjectState();
      const targets = skillInstaller.getTargets(state);

      const { dependencies } = skillInstaller.plan(targets, {}, state);

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
      const targets = skillInstaller.getTargets(state);

      const events: ProgressEvent[] = [];
      const generator = skillInstaller.execute(targets, {}, state);

      for await (const event of generator) {
        events.push(event);
      }

      // Should have start and complete events
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe("start");

      // Last event should be complete or error
      const lastEvent = events[events.length - 1];
      expect(["complete", "error"]).toContain(lastEvent.type);
    });
  });
});

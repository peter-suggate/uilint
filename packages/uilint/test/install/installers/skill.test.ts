/**
 * Tests for Skill Installer
 *
 * Tests the Agent Skill installer's functionality for installing UI consistency skills.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSkillInstaller } from "../../../src/commands/install/installers/skill.js";
import { createMockProjectState } from "../helpers/mock-state.js";
import type { ProgressEvent } from "../../../src/commands/install/installers/types.js";

// Mock the skill-loader module
vi.mock("../../../src/utils/skill-loader.js", () => ({
  getAvailableSkillNames: vi.fn(() => ["ui-consistency-enforcer"]),
  loadSkill: vi.fn((name: string) => ({
    name,
    files: [
      {
        relativePath: "SKILL.md",
        content: "# UI Consistency Enforcer\n\nAgent skill content...",
      },
      {
        relativePath: "references/example.ts",
        content: "// Example reference file",
      },
      {
        relativePath: "references/patterns.md",
        content: "# Patterns\n\nCommon patterns...",
      },
    ],
  })),
}));

describe("SkillInstaller", () => {
  let installer: ReturnType<typeof createSkillInstaller>;

  beforeEach(() => {
    installer = createSkillInstaller();
    vi.clearAllMocks();
  });

  describe("metadata", () => {
    it("has correct id and metadata", () => {
      expect(installer.id).toBe("skill");
      expect(installer.name).toBe("UI Consistency Agent Skill");
      expect(installer.category).toBe("agent");
      expect(installer.priority).toBe(40);
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
    it("returns target for ui-consistency-enforcer skill", () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: false,
          path: "/test/project/.cursor",
        },
      });
      const targets = installer.getTargets(state);

      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe("ui-consistency-enforcer");
      expect(targets[0].displayName).toBe("UI Consistency Enforcer");
    });

    it("includes metadata with skill name and path", () => {
      const state = createMockProjectState({
        cursorDir: {
          exists: false,
          path: "/test/project/.cursor",
        },
      });
      const targets = installer.getTargets(state);

      expect(targets[0].metadata).toBeDefined();
      expect(targets[0].metadata?.skillName).toBe("ui-consistency-enforcer");
      expect(targets[0].metadata?.skillPath).toBe(
        "/test/project/.cursor/skills/ui-consistency-enforcer"
      );
    });

    it("returns empty array if no skills are available", () => {
      // Mock no skills available
      const { getAvailableSkillNames } = await import(
        "../../../src/utils/skill-loader.js"
      );
      vi.mocked(getAvailableSkillNames).mockReturnValue([]);

      const state = createMockProjectState();
      const targets = installer.getTargets(state);

      expect(targets).toHaveLength(0);
    });
  });

  describe("isAlreadyInstalled", () => {
    it("returns not installed for fresh project", async () => {
      const state = createMockProjectState();
      const targets = installer.getTargets(state);

      const status = await installer.isAlreadyInstalled(state, targets[0]);

      expect(status.installed).toBe(false);
    });

    it("returns not installed when target metadata is missing", async () => {
      const state = createMockProjectState();
      const fakeTarget = {
        id: "test-skill",
        displayName: "Test Skill",
        metadata: {},
      };

      const status = await installer.isAlreadyInstalled(state, fakeTarget);

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

      // Should have progress for loading skill
      const loadingEvent = events.find(
        (e) => e.type === "progress" && e.message?.includes("Loading skill")
      );
      expect(loadingEvent).toBeDefined();
    });

    it("generates actions to create .cursor and skills directories", async () => {
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

      // Should create skills directory
      const skillsDirAction = result!.actions.find(
        (a) =>
          a.type === "create_directory" &&
          a.path === "/test/project/.cursor/skills"
      );
      expect(skillsDirAction).toBeDefined();

      // Should create skill-specific directory
      const skillDirAction = result!.actions.find(
        (a) =>
          a.type === "create_directory" &&
          a.path === "/test/project/.cursor/skills/ui-consistency-enforcer"
      );
      expect(skillDirAction).toBeDefined();
    });

    it("generates actions to create all skill files", async () => {
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

      // Should create SKILL.md
      const skillMdAction = result!.actions.find(
        (a) =>
          a.type === "create_file" &&
          a.path.endsWith("ui-consistency-enforcer/SKILL.md")
      );
      expect(skillMdAction).toBeDefined();

      // Should create reference files
      const referenceActions = result!.actions.filter(
        (a) => a.type === "create_file" && a.path.includes("references/")
      );
      expect(referenceActions.length).toBeGreaterThan(0);
    });

    it("creates subdirectories for nested skill files", async () => {
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

      // Should create references/ subdirectory
      const referencesDirAction = result!.actions.find(
        (a) =>
          a.type === "create_directory" &&
          a.path.endsWith("ui-consistency-enforcer/references")
      );
      expect(referencesDirAction).toBeDefined();
    });

    it("yields progress with file count", async () => {
      const state = createMockProjectState();
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

      // Should have progress events with current/total counts
      const fileProgressEvents = events.filter(
        (e) =>
          e.type === "progress" &&
          e.message?.includes("Installing file") &&
          "current" in e &&
          "total" in e
      );
      expect(fileProgressEvents.length).toBeGreaterThan(0);

      // First file should be 1/3
      const firstFileEvent = fileProgressEvents[0];
      expect(firstFileEvent.current).toBe(1);
      expect(firstFileEvent.total).toBe(3);
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
      expect(result!.summary?.created).toBeDefined();
      expect(result!.summary?.created!.length).toBeGreaterThan(0);

      // Should include SKILL.md
      const hasSkillMd = result!.summary?.created?.some((path) =>
        path.endsWith("SKILL.md")
      );
      expect(hasSkillMd).toBe(true);
    });

    it("yields error event when skill fails to load", async () => {
      // Mock loadSkill to throw error
      const { loadSkill } = await import("../../../src/utils/skill-loader.js");
      vi.mocked(loadSkill).mockImplementation(() => {
        throw new Error("Skill not found");
      });

      const state = createMockProjectState();
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

      const errorEvent = events.find((e) => e.type === "error");
      expect(errorEvent).toBeDefined();
      expect(errorEvent?.message).toContain("Failed to load skill");
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

      // But should still create skills directory
      const skillsDirAction = result!.actions.find(
        (a) =>
          a.type === "create_directory" &&
          a.path === "/test/project/.cursor/skills"
      );
      expect(skillsDirAction).toBeDefined();
    });
  });
});

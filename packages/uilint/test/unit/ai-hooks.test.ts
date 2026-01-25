/**
 * Tests for AI Hooks utility functions
 *
 * Tests hook detection and action planning for Claude Code and Cursor
 * using real filesystem operations in temp directories.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  isHookInstalled,
  planClaudeHook,
  planCursorHook,
  planRemoveClaudeHook,
  planRemoveCursorHook,
} from "../../src/commands/init/installers/ai-hooks.js";

describe("AI Hooks utility", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "uilint-ai-hooks-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ============================================================================
  // isHookInstalled tests
  // ============================================================================

  describe("isHookInstalled", () => {
    describe("Claude hooks", () => {
      it("returns false when .claude directory does not exist", () => {
        expect(isHookInstalled(tempDir, "claude")).toBe(false);
      });

      it("returns false when settings.json does not exist", () => {
        mkdirSync(join(tempDir, ".claude"), { recursive: true });
        expect(isHookInstalled(tempDir, "claude")).toBe(false);
      });

      it("returns false when settings.json has no hooks", () => {
        mkdirSync(join(tempDir, ".claude"), { recursive: true });
        writeFileSync(
          join(tempDir, ".claude", "settings.json"),
          JSON.stringify({ someOtherSetting: true })
        );
        expect(isHookInstalled(tempDir, "claude")).toBe(false);
      });

      it("returns false when PostToolUse hooks exist but do not match Edit", () => {
        mkdirSync(join(tempDir, ".claude"), { recursive: true });
        writeFileSync(
          join(tempDir, ".claude", "settings.json"),
          JSON.stringify({
            hooks: {
              PostToolUse: [
                {
                  matcher: "Read",
                  hooks: [{ type: "command", command: "echo hello" }],
                },
              ],
            },
          })
        );
        expect(isHookInstalled(tempDir, "claude")).toBe(false);
      });

      it("returns true when PostToolUse hook for Edit with post-edit command exists", () => {
        mkdirSync(join(tempDir, ".claude"), { recursive: true });
        writeFileSync(
          join(tempDir, ".claude", "settings.json"),
          JSON.stringify({
            hooks: {
              PostToolUse: [
                {
                  matcher: "Edit|Write",
                  hooks: [
                    { type: "command", command: "bash .claude/hooks/post-edit.sh" },
                  ],
                },
              ],
            },
          })
        );
        expect(isHookInstalled(tempDir, "claude")).toBe(true);
      });

      it("returns true when Edit matcher exists (without Write)", () => {
        mkdirSync(join(tempDir, ".claude"), { recursive: true });
        writeFileSync(
          join(tempDir, ".claude", "settings.json"),
          JSON.stringify({
            hooks: {
              PostToolUse: [
                {
                  matcher: "Edit",
                  hooks: [{ type: "command", command: "post-edit" }],
                },
              ],
            },
          })
        );
        expect(isHookInstalled(tempDir, "claude")).toBe(true);
      });

      it("handles malformed JSON gracefully", () => {
        mkdirSync(join(tempDir, ".claude"), { recursive: true });
        writeFileSync(join(tempDir, ".claude", "settings.json"), "not valid json");
        expect(isHookInstalled(tempDir, "claude")).toBe(false);
      });
    });

    describe("Cursor hooks", () => {
      it("returns false when .cursor directory does not exist", () => {
        expect(isHookInstalled(tempDir, "cursor")).toBe(false);
      });

      it("returns false when hooks.json does not exist", () => {
        mkdirSync(join(tempDir, ".cursor"), { recursive: true });
        expect(isHookInstalled(tempDir, "cursor")).toBe(false);
      });

      it("returns false when hooks.json has no afterFileEdit hooks", () => {
        mkdirSync(join(tempDir, ".cursor"), { recursive: true });
        writeFileSync(
          join(tempDir, ".cursor", "hooks.json"),
          JSON.stringify({ hooks: { beforeFileEdit: [] } })
        );
        expect(isHookInstalled(tempDir, "cursor")).toBe(false);
      });

      it("returns false when afterFileEdit is empty", () => {
        mkdirSync(join(tempDir, ".cursor"), { recursive: true });
        writeFileSync(
          join(tempDir, ".cursor", "hooks.json"),
          JSON.stringify({ hooks: { afterFileEdit: [] } })
        );
        expect(isHookInstalled(tempDir, "cursor")).toBe(false);
      });

      it("returns true when afterFileEdit hook with post-edit command exists", () => {
        mkdirSync(join(tempDir, ".cursor"), { recursive: true });
        writeFileSync(
          join(tempDir, ".cursor", "hooks.json"),
          JSON.stringify({
            hooks: {
              afterFileEdit: [
                { command: "bash .cursor/hooks/post-edit.sh", filePattern: "**/*.ts" },
              ],
            },
          })
        );
        expect(isHookInstalled(tempDir, "cursor")).toBe(true);
      });

      it("handles malformed JSON gracefully", () => {
        mkdirSync(join(tempDir, ".cursor"), { recursive: true });
        writeFileSync(join(tempDir, ".cursor", "hooks.json"), "{broken");
        expect(isHookInstalled(tempDir, "cursor")).toBe(false);
      });
    });
  });

  // ============================================================================
  // planClaudeHook tests
  // ============================================================================

  describe("planClaudeHook", () => {
    it("generates actions to create .claude directory structure", () => {
      const actions = planClaudeHook(tempDir);

      // Should create .claude directory
      const claudeDirAction = actions.find(
        (a) => a.type === "create_directory" && a.path === join(tempDir, ".claude")
      );
      expect(claudeDirAction).toBeDefined();

      // Should create hooks directory
      const hooksDirAction = actions.find(
        (a) =>
          a.type === "create_directory" &&
          a.path === join(tempDir, ".claude", "hooks")
      );
      expect(hooksDirAction).toBeDefined();
    });

    it("generates action to create post-edit.sh with executable permissions", () => {
      const actions = planClaudeHook(tempDir);

      const scriptAction = actions.find(
        (a) =>
          a.type === "create_file" &&
          a.path === join(tempDir, ".claude", "hooks", "post-edit.sh")
      );
      expect(scriptAction).toBeDefined();
      expect(scriptAction?.type).toBe("create_file");

      if (scriptAction?.type === "create_file") {
        expect(scriptAction.permissions).toBe(0o755);
        expect(scriptAction.content).toContain("#!/bin/bash");
        expect(scriptAction.content).toContain("eslint");
        expect(scriptAction.content).toContain("jq");
      }
    });

    it("generates action to create settings.json when it does not exist", () => {
      const actions = planClaudeHook(tempDir);

      const settingsAction = actions.find(
        (a) =>
          a.type === "create_file" &&
          a.path === join(tempDir, ".claude", "settings.json")
      );
      expect(settingsAction).toBeDefined();

      if (settingsAction?.type === "create_file") {
        const content = JSON.parse(settingsAction.content);
        expect(content.hooks.PostToolUse).toBeDefined();
        expect(content.hooks.PostToolUse[0].matcher).toContain("Edit");
      }
    });

    it("generates action to merge settings.json when it already exists", () => {
      // Create existing settings.json
      mkdirSync(join(tempDir, ".claude"), { recursive: true });
      writeFileSync(
        join(tempDir, ".claude", "settings.json"),
        JSON.stringify({ existingSetting: true })
      );

      const actions = planClaudeHook(tempDir);

      const mergeAction = actions.find(
        (a) =>
          a.type === "merge_json" &&
          a.path === join(tempDir, ".claude", "settings.json")
      );
      expect(mergeAction).toBeDefined();

      if (mergeAction?.type === "merge_json") {
        expect(mergeAction.merge.hooks).toBeDefined();
      }
    });
  });

  // ============================================================================
  // planCursorHook tests
  // ============================================================================

  describe("planCursorHook", () => {
    it("generates actions to create .cursor directory structure", () => {
      const actions = planCursorHook(tempDir);

      // Should create .cursor directory
      const cursorDirAction = actions.find(
        (a) => a.type === "create_directory" && a.path === join(tempDir, ".cursor")
      );
      expect(cursorDirAction).toBeDefined();

      // Should create hooks directory
      const hooksDirAction = actions.find(
        (a) =>
          a.type === "create_directory" &&
          a.path === join(tempDir, ".cursor", "hooks")
      );
      expect(hooksDirAction).toBeDefined();
    });

    it("generates action to create post-edit.sh with executable permissions", () => {
      const actions = planCursorHook(tempDir);

      const scriptAction = actions.find(
        (a) =>
          a.type === "create_file" &&
          a.path === join(tempDir, ".cursor", "hooks", "post-edit.sh")
      );
      expect(scriptAction).toBeDefined();

      if (scriptAction?.type === "create_file") {
        expect(scriptAction.permissions).toBe(0o755);
        expect(scriptAction.content).toContain("#!/bin/bash");
      }
    });

    it("generates action to create hooks.json when it does not exist", () => {
      const actions = planCursorHook(tempDir);

      const hooksAction = actions.find(
        (a) =>
          a.type === "create_file" &&
          a.path === join(tempDir, ".cursor", "hooks.json")
      );
      expect(hooksAction).toBeDefined();

      if (hooksAction?.type === "create_file") {
        const content = JSON.parse(hooksAction.content);
        expect(content.hooks.afterFileEdit).toBeDefined();
        expect(content.hooks.afterFileEdit[0].command).toContain("post-edit");
      }
    });

    it("generates action to merge hooks.json when it already exists", () => {
      // Create existing hooks.json
      mkdirSync(join(tempDir, ".cursor"), { recursive: true });
      writeFileSync(
        join(tempDir, ".cursor", "hooks.json"),
        JSON.stringify({ hooks: { beforeFileEdit: [] } })
      );

      const actions = planCursorHook(tempDir);

      const mergeAction = actions.find(
        (a) =>
          a.type === "merge_json" &&
          a.path === join(tempDir, ".cursor", "hooks.json")
      );
      expect(mergeAction).toBeDefined();
    });
  });

  // ============================================================================
  // planRemove tests
  // ============================================================================

  describe("planRemoveClaudeHook", () => {
    it("generates action to delete post-edit.sh", () => {
      const actions = planRemoveClaudeHook(tempDir);

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe("delete_file");
      expect(actions[0].path).toBe(join(tempDir, ".claude", "hooks", "post-edit.sh"));
    });
  });

  describe("planRemoveCursorHook", () => {
    it("generates action to delete post-edit.sh", () => {
      const actions = planRemoveCursorHook(tempDir);

      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe("delete_file");
      expect(actions[0].path).toBe(join(tempDir, ".cursor", "hooks", "post-edit.sh"));
    });
  });
});

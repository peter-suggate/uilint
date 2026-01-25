/**
 * AI Hooks utility - Post-tool-use ESLint hooks for Claude Code and Cursor
 *
 * Provides functions to generate installation actions for AI editor hooks
 * that automatically run ESLint when files are edited.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { InstallAction } from "../types.js";

export type AIHookProvider = "claude" | "cursor";

/**
 * Bash script that runs ESLint on edited files and returns results
 * Works for both Claude and Cursor hooks
 */
const POST_EDIT_HOOK_SCRIPT = `#!/bin/bash
# AI Editor Hook: Run ESLint on edited files
# Triggered after file edits to provide lint feedback
#
# Output: JSON with lint errors for the AI to see

# Read JSON input from stdin
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // .file_path // empty')

# Exit if no file path
if [[ -z "$file_path" ]]; then
  exit 0
fi

# Only lint TypeScript/JavaScript files
if [[ "$file_path" =~ \\.(ts|tsx|js|jsx)$ ]]; then
  # Find the package directory (look for eslint.config.ts or package.json)
  dir=$(dirname "$file_path")
  while [[ "$dir" != "/" ]]; do
    if [[ -f "$dir/eslint.config.ts" ]] || [[ -f "$dir/eslint.config.js" ]] || [[ -f "$dir/eslint.config.mjs" ]]; then
      break
    fi
    dir=$(dirname "$dir")
  done

  # If no config found, exit
  if [[ "$dir" == "/" ]]; then
    exit 0
  fi

  # Run ESLint with --fix first (auto-fix what we can), suppress output
  (cd "$dir" && npx eslint "$file_path" --fix >/dev/null 2>&1) || true

  # Then report ALL remaining issues
  remaining=$( (cd "$dir" && npx eslint "$file_path" --format stylish 2>/dev/null) | grep -E "^\\s+[0-9]+:[0-9]+" | head -10)

  if [[ -n "$remaining" ]]; then
    # Output JSON so the AI sees the lint errors
    jq -n --arg issues "$remaining" '{"additionalContext": ("ESLint errors - fix these:\\n" + $issues)}'
    # Exit with error code to signal lint issues
    exit 1
  fi
fi
`;

/**
 * Claude settings.json content for the PostToolUse hook
 */
const CLAUDE_HOOK_CONFIG = {
  hooks: {
    PostToolUse: [
      {
        matcher: "Edit|Write",
        hooks: [
          {
            type: "command",
            command: "bash .claude/hooks/post-edit.sh",
          },
        ],
      },
    ],
  },
};

/**
 * Cursor hooks.json content for the afterFileEdit hook
 */
const CURSOR_HOOK_CONFIG = {
  hooks: {
    afterFileEdit: [
      {
        command: "bash .cursor/hooks/post-edit.sh",
        filePattern: "**/*.{ts,tsx,js,jsx}",
      },
    ],
  },
};

/**
 * Check if a hook is already installed for the given provider
 */
export function isHookInstalled(projectPath: string, provider: AIHookProvider): boolean {
  if (provider === "claude") {
    const settingsPath = join(projectPath, ".claude", "settings.json");
    if (!existsSync(settingsPath)) return false;

    try {
      const content = readFileSync(settingsPath, "utf-8");
      const settings = JSON.parse(content);
      const hooks = settings.hooks?.PostToolUse;
      if (!Array.isArray(hooks)) return false;

      return hooks.some(
        (h: { matcher?: string; hooks?: Array<{ command?: string }> }) =>
          h.matcher?.includes("Edit") &&
          h.hooks?.some((hh) => hh.command?.includes("post-edit"))
      );
    } catch {
      return false;
    }
  } else {
    const hooksPath = join(projectPath, ".cursor", "hooks.json");
    if (!existsSync(hooksPath)) return false;

    try {
      const content = readFileSync(hooksPath, "utf-8");
      const hooks = JSON.parse(content);
      const afterFileEdit = hooks.hooks?.afterFileEdit;
      if (!Array.isArray(afterFileEdit)) return false;

      return afterFileEdit.some(
        (h: { command?: string }) => h.command?.includes("post-edit")
      );
    } catch {
      return false;
    }
  }
}

/**
 * Generate installation actions for Claude Code hook
 */
export function planClaudeHook(projectPath: string): InstallAction[] {
  const actions: InstallAction[] = [];
  const claudeDir = join(projectPath, ".claude");
  const hooksDir = join(claudeDir, "hooks");
  const settingsPath = join(claudeDir, "settings.json");

  // Create .claude directory
  actions.push({
    type: "create_directory",
    path: claudeDir,
  });

  // Create hooks directory
  actions.push({
    type: "create_directory",
    path: hooksDir,
  });

  // Create post-edit.sh script (executable)
  actions.push({
    type: "create_file",
    path: join(hooksDir, "post-edit.sh"),
    content: POST_EDIT_HOOK_SCRIPT,
    permissions: 0o755,
  });

  // Create or merge settings.json
  if (existsSync(settingsPath)) {
    actions.push({
      type: "merge_json",
      path: settingsPath,
      merge: CLAUDE_HOOK_CONFIG,
    });
  } else {
    actions.push({
      type: "create_file",
      path: settingsPath,
      content: JSON.stringify(CLAUDE_HOOK_CONFIG, null, 2),
    });
  }

  return actions;
}

/**
 * Generate installation actions for Cursor hook
 */
export function planCursorHook(projectPath: string): InstallAction[] {
  const actions: InstallAction[] = [];
  const cursorDir = join(projectPath, ".cursor");
  const hooksDir = join(cursorDir, "hooks");
  const hooksJsonPath = join(cursorDir, "hooks.json");

  // Create .cursor directory
  actions.push({
    type: "create_directory",
    path: cursorDir,
  });

  // Create hooks directory
  actions.push({
    type: "create_directory",
    path: hooksDir,
  });

  // Create post-edit.sh script (executable)
  actions.push({
    type: "create_file",
    path: join(hooksDir, "post-edit.sh"),
    content: POST_EDIT_HOOK_SCRIPT,
    permissions: 0o755,
  });

  // Create or merge hooks.json
  if (existsSync(hooksJsonPath)) {
    actions.push({
      type: "merge_json",
      path: hooksJsonPath,
      merge: CURSOR_HOOK_CONFIG,
    });
  } else {
    actions.push({
      type: "create_file",
      path: hooksJsonPath,
      content: JSON.stringify(CURSOR_HOOK_CONFIG, null, 2),
    });
  }

  return actions;
}

/**
 * Generate removal actions for Claude Code hook
 */
export function planRemoveClaudeHook(projectPath: string): InstallAction[] {
  const claudeDir = join(projectPath, ".claude");
  return [
    {
      type: "delete_file",
      path: join(claudeDir, "hooks", "post-edit.sh"),
    },
  ];
}

/**
 * Generate removal actions for Cursor hook
 */
export function planRemoveCursorHook(projectPath: string): InstallAction[] {
  const cursorDir = join(projectPath, ".cursor");
  return [
    {
      type: "delete_file",
      path: join(cursorDir, "hooks", "post-edit.sh"),
    },
  ];
}

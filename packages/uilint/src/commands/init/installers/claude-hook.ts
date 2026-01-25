/**
 * Claude Hook installer - Post-tool-use ESLint hook for Claude Code
 *
 * Installs a hook that automatically runs ESLint when Claude edits files,
 * enabling condensed fix prompts (since the hook provides issue details on edit).
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import type { Installer, InstallTarget, InstallerConfig, ProgressEvent } from "./types.js";
import type { ProjectState, InstallAction, DependencyInstall } from "../types.js";

/**
 * Bash script that runs ESLint on edited files and returns results to Claude
 */
const POST_EDIT_HOOK_SCRIPT = `#!/bin/bash
# Claude hook: Run ESLint on edited files
# Triggered by PostToolUse on Edit|Write
#
# Output: JSON with additionalContext for Claude to see lint errors

# Read JSON input from stdin
input=$(cat)
file_path=$(echo "$input" | jq -r '.tool_input.file_path // empty')

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
    # Output JSON so Claude sees the lint errors via additionalContext
    jq -n --arg issues "$remaining" '{"additionalContext": ("ESLint errors - fix these:\\n" + $issues)}'
    # Exit with error code to signal lint issues to the agent
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
 * Check if Claude post-edit hook is already configured
 */
function isHookInstalled(projectPath: string): boolean {
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
}

export const claudeHookInstaller: Installer = {
  id: "claude-hook",
  name: "Claude Post-Edit Hook",
  description: "Auto-lint files when Claude edits them (enables condensed fix prompts)",
  icon: "🔗",

  isApplicable(_project: ProjectState): boolean {
    // Applicable to any project
    return true;
  },

  getTargets(project: ProjectState): InstallTarget[] {
    const claudeDir = join(project.projectPath, ".claude");
    const isInstalled = isHookInstalled(project.projectPath);

    return [
      {
        id: "claude-post-edit-hook",
        label: ".claude/hooks/post-edit.sh",
        path: claudeDir,
        isInstalled,
        hint: "Auto-runs ESLint when Claude edits files",
      },
    ];
  },

  plan(
    _targets: InstallTarget[],
    _config: InstallerConfig,
    project: ProjectState
  ): {
    actions: InstallAction[];
    dependencies: DependencyInstall[];
  } {
    const actions: InstallAction[] = [];
    const claudeDir = join(project.projectPath, ".claude");
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
      // Merge with existing settings
      actions.push({
        type: "merge_json",
        path: settingsPath,
        merge: CLAUDE_HOOK_CONFIG,
      });
    } else {
      // Create new settings.json
      actions.push({
        type: "create_file",
        path: settingsPath,
        content: JSON.stringify(CLAUDE_HOOK_CONFIG, null, 2),
      });
    }

    return {
      actions,
      dependencies: [],
    };
  },

  async *execute(
    _targets: InstallTarget[],
    _config: InstallerConfig,
    _project: ProjectState
  ): AsyncGenerator<ProgressEvent> {
    yield {
      type: "start",
      message: "Installing Claude post-edit hook",
    };

    yield {
      type: "progress",
      message: "Creating .claude/hooks directory",
    };

    yield {
      type: "progress",
      message: "Writing post-edit.sh script",
      detail: "→ .claude/hooks/post-edit.sh",
    };

    yield {
      type: "progress",
      message: "Configuring settings.json",
      detail: "→ .claude/settings.json",
    };

    yield {
      type: "complete",
      message: "Installed Claude post-edit hook",
    };
  },

  planRemove(
    _targets: InstallTarget[],
    project: ProjectState
  ): {
    actions: InstallAction[];
  } {
    const actions: InstallAction[] = [];
    const claudeDir = join(project.projectPath, ".claude");

    // Delete the hook script
    actions.push({
      type: "delete_file",
      path: join(claudeDir, "hooks", "post-edit.sh"),
    });

    // Note: We don't delete settings.json as it may have other hooks

    return { actions };
  },
};

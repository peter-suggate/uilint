/**
 * Skill installer - Claude Code Agent Skills for UI consistency
 */

import { existsSync } from "fs";
import { join } from "path";
import type { Installer, InstallTarget, InstallerConfig, ProgressEvent } from "./types.js";
import type { ProjectState, InstallAction, DependencyInstall } from "../types.js";
import { loadSkill } from "../../../utils/skill-loader.js";

export const skillInstaller: Installer = {
  id: "skill",
  name: "UI Consistency Agent skill",
  description: "Claude Code skill for enforcing UI consistency",
  icon: "⚡",

  isApplicable(project: ProjectState): boolean {
    // Always applicable - works in any project
    return true;
  },

  getTargets(project: ProjectState): InstallTarget[] {
    const skillsDir = join(project.cursorDir.path, "skills", "ui-consistency-enforcer");
    const skillMdPath = join(skillsDir, "SKILL.md");

    // Check if skill is already installed by checking for SKILL.md
    const isInstalled = existsSync(skillMdPath);

    return [
      {
        id: "ui-consistency-skill",
        label: ".cursor/skills/ui-consistency-enforcer",
        path: skillsDir,
        isInstalled,
        hint: "Agent skill for UI consistency checks",
      },
    ];
  },

  plan(
    targets: InstallTarget[],
    config: InstallerConfig,
    project: ProjectState
  ): {
    actions: InstallAction[];
    dependencies: DependencyInstall[];
  } {
    const actions: InstallAction[] = [];

    // Ensure .cursor directory exists
    if (!project.cursorDir.exists) {
      actions.push({
        type: "create_directory",
        path: project.cursorDir.path,
      });
    }

    // Create skills directory
    const skillsDir = join(project.cursorDir.path, "skills");
    actions.push({
      type: "create_directory",
      path: skillsDir,
    });

    // Load and install the ui-consistency-enforcer skill
    try {
      const skill = loadSkill("ui-consistency-enforcer");
      const skillDir = join(skillsDir, skill.name);

      // Create skill directory
      actions.push({
        type: "create_directory",
        path: skillDir,
      });

      // Create all skill files
      for (const file of skill.files) {
        const filePath = join(skillDir, file.relativePath);

        // Ensure subdirectories exist (e.g., references/)
        const fileDir = join(
          skillDir,
          file.relativePath.split("/").slice(0, -1).join("/")
        );
        if (fileDir !== skillDir && file.relativePath.includes("/")) {
          actions.push({
            type: "create_directory",
            path: fileDir,
          });
        }

        actions.push({
          type: "create_file",
          path: filePath,
          content: file.content,
        });
      }
    } catch (error) {
      // Skill not found - this shouldn't happen in normal install
      console.warn("Failed to load ui-consistency-enforcer skill:", error);
    }

    return {
      actions,
      dependencies: [],
    };
  },

  async *execute(
    targets: InstallTarget[],
    config: InstallerConfig,
    project: ProjectState
  ): AsyncGenerator<ProgressEvent> {
    yield {
      type: "start",
      message: "Installing UI Consistency Agent skill",
    };

    yield {
      type: "progress",
      message: "Creating .cursor/skills directory",
    };

    try {
      const skill = loadSkill("ui-consistency-enforcer");

      for (const file of skill.files) {
        yield {
          type: "progress",
          message: "Writing skill file",
          detail: `→ ${file.relativePath}`,
        };
      }

      yield {
        type: "complete",
        message: "Installed UI Consistency Agent skill",
      };
    } catch (error) {
      yield {
        type: "error",
        message: "Failed to install skill",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

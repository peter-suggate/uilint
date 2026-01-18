/**
 * Genstyleguide installer - Cursor command for generating style guides
 */

import { join } from "path";
import type { Installer, InstallTarget, InstallerConfig, ProgressEvent } from "./types.js";
import type { ProjectState, InstallAction, DependencyInstall } from "../types.js";
import { GENSTYLEGUIDE_COMMAND_MD } from "../constants.js";

export const genstyleguideInstaller: Installer = {
  id: "genstyleguide",
  name: "/genstyleguide command",
  description: "Cursor command to generate UI style guides",
  icon: "📝",

  isApplicable(project: ProjectState): boolean {
    // Always applicable - works in any project
    return true;
  },

  getTargets(project: ProjectState): InstallTarget[] {
    const commandPath = join(project.cursorDir.path, "commands", "genstyleguide.md");
    const isInstalled = project.commands.genstyleguide;

    return [
      {
        id: "genstyleguide-command",
        label: ".cursor/commands/genstyleguide.md",
        path: commandPath,
        isInstalled,
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

    // Ensure .cursor/commands directory exists
    const commandsDir = join(project.cursorDir.path, "commands");

    if (!project.cursorDir.exists) {
      actions.push({
        type: "create_directory",
        path: project.cursorDir.path,
      });
    }

    actions.push({
      type: "create_directory",
      path: commandsDir,
    });

    // Create the command file
    actions.push({
      type: "create_file",
      path: join(commandsDir, "genstyleguide.md"),
      content: GENSTYLEGUIDE_COMMAND_MD,
    });

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
      message: "Installing /genstyleguide command",
    };

    yield {
      type: "progress",
      message: "Creating .cursor/commands directory",
    };

    yield {
      type: "progress",
      message: "Writing command file",
      detail: "→ .cursor/commands/genstyleguide.md",
    };

    yield {
      type: "complete",
      message: "Installed /genstyleguide command",
    };
  },

  planUninstall(
    targets: InstallTarget[],
    project: ProjectState
  ): {
    actions: InstallAction[];
  } {
    const actions: InstallAction[] = [];

    // Delete the command file
    const commandPath = join(project.cursorDir.path, "commands", "genstyleguide.md");
    actions.push({
      type: "delete_file",
      path: commandPath,
    });

    return { actions };
  },
};

/**
 * Generic plugin installer factory.
 *
 * Given a PluginCLIManifest (exported by each plugin package), creates an
 * Installer that installs the plugin as a dev dependency. This keeps all
 * display metadata in the plugin while core provides the installer mechanics.
 */

import { createRequire } from "module";
import { join } from "path";
import type { Installer, InstallTarget, InstallerConfig, ProgressEvent } from "./types.js";
import type { ProjectState, InstallAction, DependencyInstall } from "../types.js";
import type { PluginCLIManifest } from "../../../utils/plugin-loader.js";
import { detectPackageManager } from "../../../utils/package-manager.js";
import { toInstallSpecifier } from "../versioning.js";

/**
 * Check if a package is installed in a project's node_modules.
 */
function isPackageInstalled(packageName: string, projectPath: string): boolean {
  try {
    const req = createRequire(join(projectPath, "package.json"));
    req.resolve(packageName);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create an Installer from a plugin's CLI manifest.
 *
 * The manifest provides all display metadata (name, description, icon) and
 * the package name. The factory wires up detection, planning, and execution.
 */
export function createPluginInstaller(manifest: PluginCLIManifest): Installer {
  return {
    id: `plugin-${manifest.cliFlag}`,
    name: manifest.displayName,
    description: manifest.displayDescription,
    icon: manifest.displayIcon,

    isApplicable(_project: ProjectState): boolean {
      // Plugins are always applicable — any project can use them
      return true;
    },

    getTargets(project: ProjectState): InstallTarget[] {
      const installed = isPackageInstalled(manifest.packageName, project.projectPath);
      return [
        {
          id: `${manifest.cliFlag}-plugin`,
          label: manifest.packageName,
          path: project.projectPath,
          isInstalled: installed,
          hint: manifest.displayDescription,
        },
      ];
    },

    plan(
      targets: InstallTarget[],
      _config: InstallerConfig,
      project: ProjectState,
    ): {
      actions: InstallAction[];
      dependencies: DependencyInstall[];
    } {
      const dependencies: DependencyInstall[] = [];

      if (targets.length > 0) {
        dependencies.push({
          packagePath: project.projectPath,
          packageManager: detectPackageManager(project.projectPath),
          packages: [toInstallSpecifier(manifest.packageName)],
        });
      }

      return { actions: [], dependencies };
    },

    async *execute(
      _targets: InstallTarget[],
      _config: InstallerConfig,
      _project: ProjectState,
    ): AsyncGenerator<ProgressEvent> {
      yield {
        type: "start",
        message: `Installing ${manifest.displayName}`,
      };

      yield {
        type: "progress",
        message: `Adding ${manifest.packageName}`,
        detail: "→ Installing as dev dependency",
      };

      yield {
        type: "complete",
        message: `Installed ${manifest.displayName}`,
      };
    },

    planRemove(
      _targets: InstallTarget[],
      project: ProjectState,
    ): {
      actions: InstallAction[];
    } {
      return {
        actions: [
          {
            type: "remove_dependencies",
            packagePath: project.projectPath,
            packages: [manifest.packageName],
          },
        ],
      };
    },
  };
}

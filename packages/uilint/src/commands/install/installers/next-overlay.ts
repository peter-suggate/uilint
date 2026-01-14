/**
 * Next.js overlay installer - UI devtools for Next.js App Router apps
 */

import type { Installer, InstallTarget, InstallerConfig, ProgressEvent } from "./types.js";
import type { ProjectState, InstallAction, DependencyInstall } from "../types.js";

export const nextOverlayInstaller: Installer = {
  id: "next",
  name: "Next.js overlay",
  description: "Alt+Click UI inspector for Next.js App Router",
  icon: "🔷",

  isApplicable(project: ProjectState): boolean {
    return project.nextApps.length > 0;
  },

  getTargets(project: ProjectState): InstallTarget[] {
    return project.nextApps.map((app) => ({
      id: `next-${app.projectPath}`,
      label: app.projectPath.split("/").pop() || app.projectPath,
      path: app.projectPath,
      hint: "App Router",
      isInstalled: false, // TODO: Detect if already installed
    }));
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
    const dependencies: DependencyInstall[] = [];

    // Only install for the first selected target
    if (targets.length === 0) return { actions, dependencies };

    const target = targets[0];
    const appInfo = project.nextApps.find((app) => app.projectPath === target.path);
    if (!appInfo) return { actions, dependencies };

    const { projectPath, detection } = appInfo;

    // Install Next.js routes
    actions.push({
      type: "install_next_routes",
      projectPath,
      appRoot: detection.appRoot,
    });

    // Install React overlay dependencies
    dependencies.push({
      packagePath: projectPath,
      packageManager: project.packageManager,
      packages: ["uilint-react", "uilint-core", "jsx-loc-plugin"],
    });

    // Inject <uilint-devtools /> web component into React
    actions.push({
      type: "inject_react",
      projectPath,
      appRoot: detection.appRoot,
      mode: "next",
    });

    // Inject jsx-loc-plugin into next.config
    actions.push({
      type: "inject_next_config",
      projectPath,
    });

    return { actions, dependencies };
  },

  async *execute(
    targets: InstallTarget[],
    config: InstallerConfig,
    project: ProjectState
  ): AsyncGenerator<ProgressEvent> {
    if (targets.length === 0) return;

    const target = targets[0];

    yield {
      type: "start",
      message: "Installing Next.js overlay",
    };

    yield {
      type: "progress",
      message: `Installing in ${target.label}`,
      detail: "→ Adding API routes",
    };

    yield {
      type: "progress",
      message: "Installing dependencies",
      detail: "→ uilint-react, uilint-core, jsx-loc-plugin",
    };

    yield {
      type: "progress",
      message: "Injecting devtools component",
      detail: "→ <uilint-devtools /> in root layout",
    };

    yield {
      type: "progress",
      message: "Configuring jsx-loc-plugin",
      detail: "→ next.config.js",
    };

    yield {
      type: "complete",
      message: "Next.js overlay installed",
    };
  },
};

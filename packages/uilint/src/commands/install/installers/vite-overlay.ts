/**
 * Vite overlay installer - UI devtools for Vite + React apps
 */

import type { Installer, InstallTarget, InstallerConfig, ProgressEvent } from "./types.js";
import type { ProjectState, InstallAction, DependencyInstall } from "../types.js";

export const viteOverlayInstaller: Installer = {
  id: "vite",
  name: "Vite overlay",
  description: "Alt+Click UI inspector for Vite + React apps",
  icon: "⚡",

  isApplicable(project: ProjectState): boolean {
    return project.viteApps.length > 0;
  },

  getTargets(project: ProjectState): InstallTarget[] {
    return project.viteApps.map((app) => ({
      id: `vite-${app.projectPath}`,
      label: app.projectPath.split("/").pop() || app.projectPath,
      path: app.projectPath,
      hint: "React + Vite",
      isInstalled: app.hasUilintOverlay,
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
    const appInfo = project.viteApps.find((app) => app.projectPath === target.path);
    if (!appInfo) return { actions, dependencies };

    const { projectPath, detection } = appInfo;

    // Install React overlay dependencies
    dependencies.push({
      packagePath: projectPath,
      packageManager: project.packageManager,
      packages: ["uilint-react", "uilint-core", "jsx-loc-plugin"],
    });

    // Inject <uilint-devtools /> web component into React entry
    actions.push({
      type: "inject_react",
      projectPath,
      appRoot: detection.entryRoot,
      mode: "vite",
    });

    // Inject jsx-loc-plugin into vite.config
    actions.push({
      type: "inject_vite_config",
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
      message: "Installing Vite overlay",
    };

    yield {
      type: "progress",
      message: `Installing in ${target.label}`,
      detail: "→ Adding dependencies",
    };

    yield {
      type: "progress",
      message: "Installing dependencies",
      detail: "→ uilint-react, uilint-core, jsx-loc-plugin",
    };

    yield {
      type: "progress",
      message: "Injecting devtools component",
      detail: "→ <uilint-devtools /> in entry file",
    };

    yield {
      type: "progress",
      message: "Configuring jsx-loc-plugin",
      detail: "→ vite.config.ts",
    };

    yield {
      type: "complete",
      message: "Vite overlay installed",
    };
  },

  planUninstall(
    targets: InstallTarget[],
    project: ProjectState
  ): {
    actions: InstallAction[];
  } {
    const actions: InstallAction[] = [];

    if (targets.length === 0) return { actions };

    const target = targets[0]!;
    const appInfo = project.viteApps.find(
      (app) => app.projectPath === target.path
    );
    if (!appInfo) return { actions };

    const { projectPath, detection } = appInfo;

    // Remove React overlay injection
    actions.push({
      type: "remove_react",
      projectPath,
      appRoot: detection.entryRoot,
      mode: "vite",
    });

    // Remove jsx-loc-plugin from vite.config
    actions.push({
      type: "remove_vite_config",
      projectPath,
    });

    return { actions };
  },
};

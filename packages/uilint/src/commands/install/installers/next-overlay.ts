/**
 * Next.js overlay installer - UI devtools for Next.js App Router apps
 *
 * Smart client boundary detection:
 * - Traces imports from root layout to find "use client" files
 * - Lets user choose which client component to inject into
 * - Can create a new providers.tsx if no client boundaries found
 */

import type {
  Installer,
  InstallTarget,
  InstallerConfig,
  ProgressEvent,
} from "./types.js";
import type {
  ProjectState,
  InstallAction,
  DependencyInstall,
} from "../types.js";
import {
  traceClientBoundaries,
  providersFileExists,
  type ClientBoundary,
  type TraceResult,
} from "../../../utils/client-boundary-tracer.js";

/**
 * Configuration returned by the configure() step
 */
interface NextOverlayConfig extends InstallerConfig {
  /** Traced client boundaries for the target */
  traceResult?: TraceResult;
  /** Selected target file (absolute path) */
  selectedTargetFile?: string;
  /** Whether to create a new providers.tsx */
  createProviders?: boolean;
}

export const nextOverlayInstaller: Installer = {
  id: "next",
  name: "Next.js overlay",
  description: "Alt+Click UI inspector for Next.js App Router",
  icon: "🔷",

  isApplicable(project: ProjectState): boolean {
    return project.nextApps.length > 0;
  },

  getTargets(project: ProjectState): InstallTarget[] {
    // For each Next.js app, trace client boundaries and create targets
    const targets: InstallTarget[] = [];

    for (const app of project.nextApps) {
      const traceResult = traceClientBoundaries(
        app.projectPath,
        app.detection.appRoot
      );

      if (!traceResult) {
        // No layout found - shouldn't happen but handle gracefully
        targets.push({
          id: `next-${app.projectPath}`,
          label: app.projectPath.split("/").pop() || app.projectPath,
          path: app.projectPath,
          hint: "App Router (no layout found)",
          isInstalled: false,
        });
        continue;
      }

      if (traceResult.layoutIsClient) {
        // Layout is already a client component - can inject directly
        targets.push({
          id: `next-${app.projectPath}`,
          label: app.projectPath.split("/").pop() || app.projectPath,
          path: app.projectPath,
          hint: "App Router",
          isInstalled: false,
          targetFile: traceResult.layoutFile,
        });
        continue;
      }

      // Layout is a server component - offer client boundary choices
      const existingProviders = providersFileExists(
        app.projectPath,
        app.detection.appRoot
      );

      // First option: create new providers.tsx (recommended if none exists)
      if (!existingProviders) {
        targets.push({
          id: `next-${app.projectPath}-create-providers`,
          label: `${app.projectPath.split("/").pop() || app.projectPath}`,
          path: app.projectPath,
          hint: "Create providers.tsx (Recommended)",
          isInstalled: false,
          createProviders: true,
        });
      }

      // Add existing client boundaries as options
      for (const boundary of traceResult.clientBoundaries) {
        const componentNames =
          boundary.componentNames.length > 0
            ? boundary.componentNames.join(", ")
            : "default";

        targets.push({
          id: `next-${app.projectPath}-${boundary.relativePath}`,
          label: `${app.projectPath.split("/").pop() || app.projectPath}`,
          path: app.projectPath,
          hint: `${boundary.relativePath} (${componentNames})`,
          isInstalled: false,
          targetFile: boundary.filePath,
        });
      }

      // If existing providers file found, add it as an option
      if (existingProviders) {
        const relativePath = existingProviders
          .replace(app.projectPath + "/", "")
          .replace(app.projectPath, "");

        // Check if it's already in the client boundaries list
        const alreadyListed = traceResult.clientBoundaries.some(
          (b) => b.filePath === existingProviders
        );

        if (!alreadyListed) {
          targets.push({
            id: `next-${app.projectPath}-existing-providers`,
            label: `${app.projectPath.split("/").pop() || app.projectPath}`,
            path: app.projectPath,
            hint: `${relativePath} (existing)`,
            isInstalled: false,
            targetFile: existingProviders,
          });
        }
      }

      // If no options found at all, still offer to create providers
      if (
        targets.filter((t) => t.path === app.projectPath).length === 0
      ) {
        targets.push({
          id: `next-${app.projectPath}-create-providers`,
          label: `${app.projectPath.split("/").pop() || app.projectPath}`,
          path: app.projectPath,
          hint: "Create providers.tsx",
          isInstalled: false,
          createProviders: true,
        });
      }
    }

    return targets;
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

    const target = targets[0]!;
    const appInfo = project.nextApps.find(
      (app) => app.projectPath === target.path
    );
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
    // Use the target's specific file or createProviders flag
    actions.push({
      type: "inject_react",
      projectPath,
      appRoot: detection.appRoot,
      mode: "next",
      targetFile: target.targetFile,
      createProviders: target.createProviders,
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

    const target = targets[0]!;

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

    const injectDetail = target.createProviders
      ? "→ Creating providers.tsx"
      : target.targetFile
      ? `→ ${target.hint || "client component"}`
      : "→ <uilint-devtools /> in root layout";

    yield {
      type: "progress",
      message: "Injecting devtools component",
      detail: injectDetail,
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

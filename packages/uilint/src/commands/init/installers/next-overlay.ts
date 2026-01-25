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
import { toInstallSpecifier } from "../versioning.js";
import {
  traceClientBoundaries,
  providersFileExists,
  type TraceResult,
} from "../../../utils/client-boundary-tracer.js";

/**
 * Represents an injection point option within a Next.js app
 */
export interface InjectionPoint {
  /** Unique ID */
  id: string;
  /** Display label (e.g., "providers.tsx") */
  label: string;
  /** Hint text (e.g., "Recommended", "existing") */
  hint?: string;
  /** Absolute path to the file */
  filePath?: string;
  /** Whether to create a new providers.tsx */
  createProviders?: boolean;
  /** Whether this is the recommended option */
  recommended?: boolean;
}

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

/**
 * Get injection points for a specific Next.js app
 * This is called after the user selects a Next.js app to configure
 */
export function getInjectionPoints(
  projectPath: string,
  appRoot: string
): InjectionPoint[] {
  const points: InjectionPoint[] = [];

  const traceResult = traceClientBoundaries(projectPath, appRoot);

  if (!traceResult) {
    // No layout found - offer to create providers
    points.push({
      id: "create-providers",
      label: "Create providers.tsx",
      hint: "Recommended",
      createProviders: true,
      recommended: true,
    });
    return points;
  }

  if (traceResult.layoutIsClient) {
    // Layout is already a client component - single option
    points.push({
      id: "layout",
      label: "Root layout",
      hint: "Already a client component",
      filePath: traceResult.layoutFile,
      recommended: true,
    });
    return points;
  }

  // Layout is a server component - offer client boundary choices
  const existingProviders = providersFileExists(projectPath, appRoot);

  // First option: create new providers.tsx (recommended if none exists)
  if (!existingProviders) {
    points.push({
      id: "create-providers",
      label: "Create providers.tsx",
      hint: "Recommended",
      createProviders: true,
      recommended: true,
    });
  }

  // Add existing client boundaries as options
  for (const boundary of traceResult.clientBoundaries) {
    const componentNames =
      boundary.componentNames.length > 0
        ? boundary.componentNames.join(", ")
        : "default";

    points.push({
      id: boundary.relativePath,
      label: boundary.relativePath,
      hint: componentNames,
      filePath: boundary.filePath,
      // Mark existing providers as recommended if it exists
      recommended: existingProviders === boundary.filePath,
    });
  }

  // If existing providers file found and not in boundaries, add it
  if (existingProviders) {
    const relativePath = existingProviders
      .replace(projectPath + "/", "")
      .replace(projectPath, "");

    const alreadyListed = traceResult.clientBoundaries.some(
      (b) => b.filePath === existingProviders
    );

    if (!alreadyListed) {
      points.push({
        id: "existing-providers",
        label: relativePath,
        hint: "Existing providers",
        filePath: existingProviders,
        recommended: true,
      });
    }
  }

  // Fallback: if no options, offer to create providers
  if (points.length === 0) {
    points.push({
      id: "create-providers",
      label: "Create providers.tsx",
      hint: "Recommended",
      createProviders: true,
      recommended: true,
    });
  }

  return points;
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
    // Return a single target per Next.js app
    // Injection point selection happens in a follow-up step
    return project.nextApps.map((app) => ({
      id: `next-${app.projectPath}`,
      label: app.projectPath.split("/").pop() || app.projectPath,
      path: app.projectPath,
      hint: "App Router",
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

    const target = targets[0]!;
    const appInfo = project.nextApps.find(
      (app) => app.projectPath === target.path
    );
    if (!appInfo) return { actions, dependencies };

    const { projectPath, detection } = appInfo;

    // Get injection point from config (selected in follow-up UI)
    const nextConfig = config as NextOverlayConfig;
    const targetFile = nextConfig.selectedTargetFile;
    const createProviders = nextConfig.createProviders;

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
      packages: [
        toInstallSpecifier("uilint-react", {
          preferWorkspaceProtocol: project.packageManager === "pnpm",
          workspaceRoot: project.workspaceRoot,
          targetProjectPath: projectPath,
        }),
        toInstallSpecifier("uilint-core", {
          preferWorkspaceProtocol: project.packageManager === "pnpm",
          workspaceRoot: project.workspaceRoot,
          targetProjectPath: projectPath,
        }),
        "jsx-loc-plugin",
      ],
    });

    // Inject <uilint-devtools /> web component into React
    // Use the selected injection point from config
    actions.push({
      type: "inject_react",
      projectPath,
      appRoot: detection.appRoot,
      mode: "next",
      targetFile,
      createProviders,
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
    const nextConfig = config as NextOverlayConfig;

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

    const injectDetail = nextConfig.createProviders
      ? "→ Creating providers.tsx"
      : nextConfig.selectedTargetFile
      ? `→ ${
          nextConfig.selectedTargetFile.split("/").pop() || "client component"
        }`
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

  planRemove(
    targets: InstallTarget[],
    project: ProjectState
  ): {
    actions: InstallAction[];
  } {
    const actions: InstallAction[] = [];

    if (targets.length === 0) return { actions };

    const target = targets[0]!;
    const appInfo = project.nextApps.find(
      (app) => app.projectPath === target.path
    );
    if (!appInfo) return { actions };

    const { projectPath, detection } = appInfo;

    // Remove React overlay injection
    actions.push({
      type: "remove_react",
      projectPath,
      appRoot: detection.appRoot,
      mode: "next",
    });

    // Remove jsx-loc-plugin from next.config
    actions.push({
      type: "remove_next_config",
      projectPath,
    });

    // Remove Next.js API routes
    actions.push({
      type: "remove_next_routes",
      projectPath,
      appRoot: detection.appRoot,
    });

    return { actions };
  },
};

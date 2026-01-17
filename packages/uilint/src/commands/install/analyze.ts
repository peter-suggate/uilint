/**
 * Analyze phase - scan project and return ProjectState
 *
 * This is a pure scanning function with no prompts or mutations.
 * It aggregates detection from existing utilities to build a complete
 * picture of the project state.
 */

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { findWorkspaceRoot } from "uilint-core/node";
import {
  detectNextAppRouter,
  findNextAppRouterProjects,
} from "../../utils/next-detect.js";
import {
  detectViteReact,
  findViteReactProjects,
} from "../../utils/vite-detect.js";
import { findPackages } from "../../utils/package-detect.js";
import { detectPackageManager } from "../../utils/package-manager.js";
import {
  findEslintConfigFile,
  getEslintConfigFilename,
  getUilintEslintConfigInfoFromSource,
} from "../../utils/eslint-config-inject.js";
import type {
  ProjectState,
  EslintPackageInfo,
  NextAppInfo,
  ViteAppInfo,
} from "./types.js";

// NOTE: uilint rule detection must ignore commented-out keys and handle spreads.
// We re-use the AST-backed detector from eslint-config-inject.

/**
 * Safely parse JSON file, returning undefined on error
 */
function safeParseJson<T>(filePath: string): T | undefined {
  try {
    const content = readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return undefined;
  }
}

/**
 * Check if uilint-react overlay is installed in a project
 * Detects by checking if uilint-react is in dependencies
 */
function hasUilintOverlayInstalled(projectPath: string): boolean {
  const pkgPath = join(projectPath, "package.json");
  const pkg = safeParseJson<{
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  }>(pkgPath);

  if (!pkg) return false;

  return !!(
    pkg.dependencies?.["uilint-react"] ||
    pkg.devDependencies?.["uilint-react"]
  );
}

/**
 * Analyze a project and return its state
 *
 * @param projectPath - The project directory to analyze (defaults to cwd)
 * @returns ProjectState describing what exists in the project
 */
export async function analyze(
  projectPath: string = process.cwd()
): Promise<ProjectState> {
  // Find workspace root (may differ from projectPath in monorepos)
  const workspaceRoot = findWorkspaceRoot(projectPath);

  // Detect package manager
  const packageManager = detectPackageManager(projectPath);

  // .cursor directory
  const cursorDir = join(projectPath, ".cursor");
  const cursorDirExists = existsSync(cursorDir);

  // Styleguide
  const styleguidePath = join(projectPath, ".uilint", "styleguide.md");
  const styleguideExists = existsSync(styleguidePath);

  // Cursor commands
  const commandsDir = join(cursorDir, "commands");
  const genstyleguideExists = existsSync(join(commandsDir, "genstyleguide.md"));

  // Detect Next.js App Router projects
  const nextApps: NextAppInfo[] = [];
  const directDetection = detectNextAppRouter(projectPath);
  if (directDetection) {
    nextApps.push({
      projectPath,
      detection: directDetection,
      hasUilintOverlay: hasUilintOverlayInstalled(projectPath),
    });
  } else {
    // Search in workspace for Next.js apps
    const matches = findNextAppRouterProjects(workspaceRoot, { maxDepth: 5 });
    for (const match of matches) {
      nextApps.push({
        projectPath: match.projectPath,
        detection: match.detection,
        hasUilintOverlay: hasUilintOverlayInstalled(match.projectPath),
      });
    }
  }

  // Detect Vite + React projects
  const viteApps: ViteAppInfo[] = [];
  const directVite = detectViteReact(projectPath);
  if (directVite) {
    viteApps.push({
      projectPath,
      detection: directVite,
      hasUilintOverlay: hasUilintOverlayInstalled(projectPath),
    });
  } else {
    const matches = findViteReactProjects(workspaceRoot, { maxDepth: 5 });
    for (const match of matches) {
      viteApps.push({
        projectPath: match.projectPath,
        detection: match.detection,
        hasUilintOverlay: hasUilintOverlayInstalled(match.projectPath),
      });
    }
  }

  // Find all packages and enrich with ESLint info
  const rawPackages = findPackages(workspaceRoot);
  const packages: EslintPackageInfo[] = rawPackages.map((pkg) => {
    const eslintConfigPath = findEslintConfigFile(pkg.path);
    let eslintConfigFilename: string | null = null;
    let hasRules = false;
    let configuredRuleIds: string[] = [];

    if (eslintConfigPath) {
      eslintConfigFilename = getEslintConfigFilename(eslintConfigPath);
      try {
        const source = readFileSync(eslintConfigPath, "utf-8");
        const info = getUilintEslintConfigInfoFromSource(source);
        hasRules = info.configuredRuleIds.size > 0;
        configuredRuleIds = Array.from(info.configuredRuleIds);
      } catch {
        // Ignore read errors
      }
    }

    return {
      ...pkg,
      eslintConfigPath,
      eslintConfigFilename,
      hasUilintRules: hasRules,
      configuredRuleIds,
    };
  });

  return {
    projectPath,
    workspaceRoot,
    packageManager,
    cursorDir: {
      exists: cursorDirExists,
      path: cursorDir,
    },
    styleguide: {
      exists: styleguideExists,
      path: styleguidePath,
    },
    commands: {
      genstyleguide: genstyleguideExists,
    },
    nextApps,
    viteApps,
    packages,
  };
}

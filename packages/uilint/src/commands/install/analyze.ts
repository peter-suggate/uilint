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
import { findPackages } from "../../utils/package-detect.js";
import { detectPackageManager } from "../../utils/package-manager.js";
import {
  findEslintConfigFile,
  getEslintConfigFilename,
  getUilintEslintConfigInfoFromSource,
} from "../../utils/eslint-config-inject.js";
import type {
  ProjectState,
  MCPConfig,
  HooksConfig,
  EslintPackageInfo,
  NextAppInfo,
} from "./types.js";

// Legacy hook commands to detect for upgrade path
const LEGACY_HOOK_FILES = ["uilint-validate.sh", "uilint-validate.js"];

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

  // MCP configuration
  const mcpPath = join(cursorDir, "mcp.json");
  const mcpExists = existsSync(mcpPath);
  const mcpConfig = mcpExists ? safeParseJson<MCPConfig>(mcpPath) : undefined;

  // Hooks configuration
  const hooksPath = join(cursorDir, "hooks.json");
  const hooksExists = existsSync(hooksPath);
  const hooksConfig = hooksExists
    ? safeParseJson<HooksConfig>(hooksPath)
    : undefined;

  // Check for legacy hooks
  const hooksDir = join(cursorDir, "hooks");
  const legacyPaths: string[] = [];
  for (const legacyFile of LEGACY_HOOK_FILES) {
    const legacyPath = join(hooksDir, legacyFile);
    if (existsSync(legacyPath)) {
      legacyPaths.push(legacyPath);
    }
  }

  // Styleguide
  const styleguidePath = join(projectPath, ".uilint", "styleguide.md");
  const styleguideExists = existsSync(styleguidePath);

  // Cursor commands
  const commandsDir = join(cursorDir, "commands");
  const genstyleguideExists = existsSync(join(commandsDir, "genstyleguide.md"));
  const genrulesExists = existsSync(join(commandsDir, "genrules.md"));

  // Detect Next.js App Router projects
  const nextApps: NextAppInfo[] = [];
  const directDetection = detectNextAppRouter(projectPath);
  if (directDetection) {
    nextApps.push({ projectPath, detection: directDetection });
  } else {
    // Search in workspace for Next.js apps
    const matches = findNextAppRouterProjects(workspaceRoot, { maxDepth: 5 });
    for (const match of matches) {
      nextApps.push({
        projectPath: match.projectPath,
        detection: match.detection,
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
        hasRules = info.configuredRuleIds.size > 0 || info.usesUilintConfigs;
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
    mcp: {
      exists: mcpExists,
      path: mcpPath,
      config: mcpConfig,
    },
    hooks: {
      exists: hooksExists,
      path: hooksPath,
      config: hooksConfig,
      hasLegacy: legacyPaths.length > 0,
      legacyPaths,
    },
    styleguide: {
      exists: styleguideExists,
      path: styleguidePath,
    },
    commands: {
      genstyleguide: genstyleguideExists,
      genrules: genrulesExists,
    },
    nextApps,
    packages,
  };
}

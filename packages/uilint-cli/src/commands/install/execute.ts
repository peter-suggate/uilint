/**
 * Execute phase - perform side effects from InstallPlan
 *
 * This module takes an InstallPlan and performs all the actual file operations,
 * dependency installations, and config modifications.
 */

import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  unlinkSync,
  chmodSync,
} from "fs";
import { dirname } from "path";
import type {
  InstallPlan,
  InstallAction,
  InstallResult,
  ActionResult,
  DependencyResult,
  InstallSummary,
  ExecuteOptions,
  InjectEslintAction,
  InjectReactAction,
  InjectNextConfigAction,
  InstallNextRoutesAction,
} from "./types.js";
import { installDependencies as defaultInstallDependencies } from "../../utils/package-manager.js";
import { installEslintPlugin } from "../../utils/eslint-config-inject.js";
import { installReactUILintOverlay } from "../../utils/react-inject.js";
import { installJsxLocPlugin } from "../../utils/next-config-inject.js";
import { installNextUILintRoutes } from "../../utils/next-routes.js";

/**
 * Execute a single action and return the result
 */
async function executeAction(
  action: InstallAction,
  options: ExecuteOptions
): Promise<ActionResult> {
  const { dryRun = false } = options;

  try {
    switch (action.type) {
      case "create_directory": {
        if (dryRun) {
          return {
            action,
            success: true,
            wouldDo: `Create directory: ${action.path}`,
          };
        }
        if (!existsSync(action.path)) {
          mkdirSync(action.path, { recursive: true });
        }
        return { action, success: true };
      }

      case "create_file": {
        if (dryRun) {
          return {
            action,
            success: true,
            wouldDo: `Create file: ${action.path}${
              action.permissions
                ? ` (mode: ${action.permissions.toString(8)})`
                : ""
            }`,
          };
        }
        // Ensure parent directory exists
        const dir = dirname(action.path);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(action.path, action.content, "utf-8");
        if (action.permissions) {
          chmodSync(action.path, action.permissions);
        }
        return { action, success: true };
      }

      case "merge_json": {
        if (dryRun) {
          return {
            action,
            success: true,
            wouldDo: `Merge JSON into: ${action.path}`,
          };
        }
        let existing: Record<string, unknown> = {};
        if (existsSync(action.path)) {
          try {
            existing = JSON.parse(readFileSync(action.path, "utf-8"));
          } catch {
            // Start fresh if parse fails
          }
        }
        const merged = deepMerge(existing, action.merge);
        // Ensure parent directory exists
        const dir = dirname(action.path);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
        writeFileSync(action.path, JSON.stringify(merged, null, 2), "utf-8");
        return { action, success: true };
      }

      case "delete_file": {
        if (dryRun) {
          return {
            action,
            success: true,
            wouldDo: `Delete file: ${action.path}`,
          };
        }
        if (existsSync(action.path)) {
          unlinkSync(action.path);
        }
        return { action, success: true };
      }

      case "append_to_file": {
        if (dryRun) {
          return {
            action,
            success: true,
            wouldDo: `Append to file: ${action.path}`,
          };
        }
        if (existsSync(action.path)) {
          const content = readFileSync(action.path, "utf-8");
          if (action.ifNotContains && content.includes(action.ifNotContains)) {
            // Already contains the content, skip
            return { action, success: true };
          }
          writeFileSync(action.path, content + action.content, "utf-8");
        }
        // If file doesn't exist, skip (don't create .gitignore from scratch)
        return { action, success: true };
      }

      case "inject_eslint": {
        return await executeInjectEslint(action, options);
      }

      case "inject_react": {
        return await executeInjectReact(action, options);
      }

      case "inject_next_config": {
        return await executeInjectNextConfig(action, options);
      }

      case "install_next_routes": {
        return await executeInstallNextRoutes(action, options);
      }

      default: {
        // Exhaustiveness check
        const _exhaustive: never = action;
        return {
          action: _exhaustive,
          success: false,
          error: `Unknown action type`,
        };
      }
    }
  } catch (error) {
    return {
      action,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Execute ESLint injection
 */
async function executeInjectEslint(
  action: InjectEslintAction,
  options: ExecuteOptions
): Promise<ActionResult> {
  const { dryRun = false } = options;

  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Inject ESLint rules into: ${action.configPath}`,
    };
  }

  // Use the existing installEslintPlugin function
  // It handles all the complexity of parsing and modifying the config
  const result = await installEslintPlugin({
    projectPath: action.packagePath,
    selectedRules: action.rules,
    force: !action.hasExistingRules, // Don't force if already has rules
    // Auto-confirm for execute phase (choices were made during planning)
    confirmOverwrite: async () => true,
    confirmAddMissingRules: async () => true,
  });

  return {
    action,
    success: result.configFile !== null && result.configured,
    error:
      result.configFile === null
        ? "No ESLint config found"
        : result.configured
        ? undefined
        : result.error ?? "Failed to configure uilint in ESLint config",
  };
}

/**
 * Execute React overlay injection
 */
async function executeInjectReact(
  action: InjectReactAction,
  options: ExecuteOptions
): Promise<ActionResult> {
  const { dryRun = false } = options;

  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Inject UILintProvider into React app: ${action.projectPath}`,
    };
  }

  const result = await installReactUILintOverlay({
    projectPath: action.projectPath,
    appRoot: action.appRoot,
    force: false,
    // Auto-select first choice for execute phase
    confirmFileChoice: async (choices) => choices[0],
    confirmOverwrite: async () => true,
  });

  return {
    action,
    success: result.modified,
    error: result.modified ? undefined : "Already configured",
  };
}

/**
 * Execute Next.js config injection
 */
async function executeInjectNextConfig(
  action: InjectNextConfigAction,
  options: ExecuteOptions
): Promise<ActionResult> {
  const { dryRun = false } = options;

  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Inject jsx-loc-plugin into next.config: ${action.projectPath}`,
    };
  }

  const result = await installJsxLocPlugin({
    projectPath: action.projectPath,
    force: false,
    confirmOverwrite: async () => true,
  });

  return {
    action,
    success: result.modified || result.configFile !== null,
    error: result.configFile === null ? "No next.config found" : undefined,
  };
}

/**
 * Execute Next.js routes installation
 */
async function executeInstallNextRoutes(
  action: InstallNextRoutesAction,
  options: ExecuteOptions
): Promise<ActionResult> {
  const { dryRun = false } = options;

  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Install Next.js API routes: ${action.projectPath}`,
    };
  }

  await installNextUILintRoutes({
    projectPath: action.projectPath,
    appRoot: action.appRoot,
    force: false,
    confirmOverwrite: async () => true,
  });

  return { action, success: true };
}

/**
 * Deep merge two objects
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = target[key];

    if (
      sourceVal &&
      typeof sourceVal === "object" &&
      !Array.isArray(sourceVal) &&
      targetVal &&
      typeof targetVal === "object" &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      );
    } else {
      result[key] = sourceVal;
    }
  }

  return result;
}

/**
 * Build the install summary from results
 */
function buildSummary(
  actionsPerformed: ActionResult[],
  dependencyResults: DependencyResult[],
  items: string[]
): InstallSummary {
  const filesCreated: string[] = [];
  const filesModified: string[] = [];
  const filesDeleted: string[] = [];
  const eslintTargets: { displayName: string; configFile: string }[] = [];
  let nextApp: { appRoot: string } | undefined;

  for (const result of actionsPerformed) {
    if (!result.success) continue;

    const { action } = result;
    switch (action.type) {
      case "create_file":
        filesCreated.push(action.path);
        break;
      case "merge_json":
      case "append_to_file":
        filesModified.push(action.path);
        break;
      case "delete_file":
        filesDeleted.push(action.path);
        break;
      case "inject_eslint":
        filesModified.push(action.configPath);
        eslintTargets.push({
          displayName: action.packagePath,
          configFile: action.configPath,
        });
        break;
      case "inject_react":
      case "install_next_routes":
        nextApp = { appRoot: action.appRoot };
        break;
    }
  }

  const dependenciesInstalled: { packagePath: string; packages: string[] }[] =
    [];
  for (const result of dependencyResults) {
    if (result.success && !result.skipped) {
      dependenciesInstalled.push({
        packagePath: result.install.packagePath,
        packages: result.install.packages,
      });
    }
  }

  return {
    installedItems: items as InstallSummary["installedItems"],
    filesCreated,
    filesModified,
    filesDeleted,
    dependenciesInstalled,
    eslintTargets,
    nextApp,
  };
}

/**
 * Execute an install plan
 *
 * @param plan - The install plan to execute
 * @param options - Execution options
 * @returns InstallResult with details of what was done
 */
export async function execute(
  plan: InstallPlan,
  options: ExecuteOptions = {}
): Promise<InstallResult> {
  const { dryRun = false, installDependencies = defaultInstallDependencies } =
    options;

  const actionsPerformed: ActionResult[] = [];
  const dependencyResults: DependencyResult[] = [];

  // Execute all actions in order
  for (const action of plan.actions) {
    const result = await executeAction(action, options);
    actionsPerformed.push(result);
  }

  // Install dependencies
  for (const dep of plan.dependencies) {
    if (dryRun) {
      dependencyResults.push({
        install: dep,
        success: true,
        skipped: true,
      });
      continue;
    }

    try {
      await installDependencies(
        dep.packageManager,
        dep.packagePath,
        dep.packages
      );
      dependencyResults.push({
        install: dep,
        success: true,
      });
    } catch (error) {
      dependencyResults.push({
        install: dep,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Determine overall success
  const actionsFailed = actionsPerformed.filter((r) => !r.success);
  const depsFailed = dependencyResults.filter((r) => !r.success);
  const success = actionsFailed.length === 0 && depsFailed.length === 0;

  // Collect items from actions (reverse engineer what was installed)
  const items: string[] = [];
  for (const result of actionsPerformed) {
    if (!result.success) continue;
    const { action } = result;
    if (action.type === "create_file") {
      if (action.path.includes("mcp.json")) items.push("mcp");
      if (action.path.includes("hooks.json")) items.push("hooks");
      if (action.path.includes("genstyleguide.md")) items.push("genstyleguide");
      if (action.path.includes("genrules.md")) items.push("genrules");
    }
    if (action.type === "inject_eslint") items.push("eslint");
    if (
      action.type === "inject_react" ||
      action.type === "install_next_routes"
    ) {
      items.push("next");
    }
  }
  // Dedupe
  const uniqueItems = [...new Set(items)];

  const summary = buildSummary(
    actionsPerformed,
    dependencyResults,
    uniqueItems
  );

  return {
    success,
    actionsPerformed,
    dependencyResults,
    summary,
  };
}

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
  rmSync,
} from "fs";
import { dirname, join } from "path";
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
  InjectViteConfigAction,
  InstallNextRoutesAction,
  RemoveEslintAction,
  RemoveReactAction,
  RemoveNextConfigAction,
  RemoveViteConfigAction,
  RemoveNextRoutesAction,
  RemoveDirectoryAction,
} from "./types.js";
import { installDependencies as defaultInstallDependencies } from "../../utils/package-manager.js";
import { installEslintPlugin, uninstallEslintPlugin } from "../../utils/eslint-config-inject.js";
import { installReactUILintOverlay, uninstallReactUILintOverlay } from "../../utils/react-inject.js";
import { installJsxLocPlugin, uninstallJsxLocPlugin } from "../../utils/next-config-inject.js";
import { installViteJsxLocPlugin, uninstallViteJsxLocPlugin } from "../../utils/vite-config-inject.js";
import { installNextUILintRoutes, uninstallNextUILintRoutes } from "../../utils/next-routes.js";
import { formatFilesWithPrettier, touchFiles } from "../../utils/prettier.js";
import { findWorkspaceRoot } from "uilint-core/node";

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

      case "inject_vite_config": {
        return await executeInjectViteConfig(action, options);
      }

      case "install_next_routes": {
        return await executeInstallNextRoutes(action, options);
      }

      // Uninstall actions
      case "remove_eslint": {
        return await executeRemoveEslint(action, options);
      }

      case "remove_react": {
        return await executeRemoveReact(action, options);
      }

      case "remove_next_config": {
        return await executeRemoveNextConfig(action, options);
      }

      case "remove_vite_config": {
        return await executeRemoveViteConfig(action, options);
      }

      case "remove_next_routes": {
        return await executeRemoveNextRoutes(action, options);
      }

      case "remove_directory": {
        return await executeRemoveDirectory(action, options);
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

  const dryRunDescription = action.createProviders
    ? `Create providers.tsx and inject <uilint-devtools /> in: ${action.projectPath}`
    : action.targetFile
    ? `Inject <uilint-devtools /> into: ${action.targetFile}`
    : `Inject <uilint-devtools /> into React app: ${action.projectPath}`;

  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: dryRunDescription,
    };
  }

  const result = await installReactUILintOverlay({
    projectPath: action.projectPath,
    appRoot: action.appRoot,
    mode: action.mode,
    force: false,
    // Pass through targetFile and createProviders from the action
    targetFile: action.targetFile,
    createProviders: action.createProviders,
    // Auto-select first choice for execute phase (fallback if no targetFile)
    confirmFileChoice: async (choices) => choices[0]!,
  });

  // Success if modified OR already configured (goal achieved either way)
  const success = result.modified || result.alreadyConfigured === true;

  return {
    action,
    success,
    error: success ? undefined : "Failed to configure React overlay",
    modifiedFiles: result.modifiedFiles,
  };
}

/**
 * Execute Vite config injection
 */
async function executeInjectViteConfig(
  action: InjectViteConfigAction,
  options: ExecuteOptions
): Promise<ActionResult> {
  const { dryRun = false } = options;

  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Inject jsx-loc-plugin into vite.config: ${action.projectPath}`,
    };
  }

  const result = await installViteJsxLocPlugin({
    projectPath: action.projectPath,
    force: false,
  });

  return {
    action,
    success: result.modified || result.configFile !== null,
    error: result.configFile === null ? "No vite.config found" : undefined,
    modifiedFiles: result.modifiedFiles,
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
  });

  return {
    action,
    success: result.modified || result.configFile !== null,
    error: result.configFile === null ? "No next.config found" : undefined,
    modifiedFiles: result.modifiedFiles,
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
  });

  return { action, success: true };
}

// ============================================================================
// Uninstall action executors
// ============================================================================

/**
 * Execute ESLint uninstallation
 */
async function executeRemoveEslint(
  action: RemoveEslintAction,
  options: ExecuteOptions
): Promise<ActionResult> {
  const { dryRun = false } = options;

  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Remove uilint ESLint rules from: ${action.configPath}`,
    };
  }

  const result = await uninstallEslintPlugin({
    projectPath: action.packagePath,
  });

  return {
    action,
    success: result.success,
    error: result.error,
    modifiedFiles: result.modifiedFiles,
  };
}

/**
 * Execute React overlay removal
 */
async function executeRemoveReact(
  action: RemoveReactAction,
  options: ExecuteOptions
): Promise<ActionResult> {
  const { dryRun = false } = options;

  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Remove <uilint-devtools /> from: ${action.projectPath}`,
    };
  }

  const result = await uninstallReactUILintOverlay({
    projectPath: action.projectPath,
    appRoot: action.appRoot,
    mode: action.mode,
  });

  return {
    action,
    success: result.success,
    error: result.error,
    modifiedFiles: result.modifiedFiles,
  };
}

/**
 * Execute Next.js config plugin removal
 */
async function executeRemoveNextConfig(
  action: RemoveNextConfigAction,
  options: ExecuteOptions
): Promise<ActionResult> {
  const { dryRun = false } = options;

  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Remove jsx-loc-plugin from next.config: ${action.projectPath}`,
    };
  }

  const result = await uninstallJsxLocPlugin({
    projectPath: action.projectPath,
  });

  return {
    action,
    success: result.success,
    error: result.error,
    modifiedFiles: result.modifiedFiles,
  };
}

/**
 * Execute Vite config plugin removal
 */
async function executeRemoveViteConfig(
  action: RemoveViteConfigAction,
  options: ExecuteOptions
): Promise<ActionResult> {
  const { dryRun = false } = options;

  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Remove jsx-loc-plugin from vite.config: ${action.projectPath}`,
    };
  }

  const result = await uninstallViteJsxLocPlugin({
    projectPath: action.projectPath,
  });

  return {
    action,
    success: result.success,
    error: result.error,
    modifiedFiles: result.modifiedFiles,
  };
}

/**
 * Execute Next.js routes removal
 */
async function executeRemoveNextRoutes(
  action: RemoveNextRoutesAction,
  options: ExecuteOptions
): Promise<ActionResult> {
  const { dryRun = false } = options;

  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Remove Next.js API routes: ${action.projectPath}`,
    };
  }

  const result = await uninstallNextUILintRoutes({
    projectPath: action.projectPath,
    appRoot: action.appRoot,
  });

  return {
    action,
    success: result.success,
    error: result.error,
  };
}

/**
 * Execute directory removal
 */
async function executeRemoveDirectory(
  action: RemoveDirectoryAction,
  options: ExecuteOptions
): Promise<ActionResult> {
  const { dryRun = false } = options;

  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Remove directory: ${action.path}`,
    };
  }

  if (existsSync(action.path)) {
    rmSync(action.path, { recursive: true, force: true });
  }

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
  let viteApp: { entryRoot: string } | undefined;

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
        if (action.mode === "vite") {
          viteApp = { entryRoot: action.appRoot };
        } else {
          nextApp = { appRoot: action.appRoot };
        }
        break;
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
    viteApp,
  };
}

/**
 * Collect files that should be formatted with prettier
 * Includes source files (.ts, .tsx, .js, .jsx, .mjs, .cjs) but excludes markdown
 */
function collectFormattableFiles(actionsPerformed: ActionResult[]): string[] {
  const formattableExtensions = new Set([
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".mjs",
    ".cjs",
    ".json",
  ]);

  const files: string[] = [];

  for (const result of actionsPerformed) {
    if (!result.success) continue;
    const { action } = result;

    let filePath: string | undefined;

    switch (action.type) {
      case "create_file":
        filePath = action.path;
        break;
      case "merge_json":
        filePath = action.path;
        break;
      case "append_to_file":
        filePath = action.path;
        break;
      case "inject_eslint":
        filePath = action.configPath;
        break;
      case "inject_next_config":
      case "inject_vite_config":
      case "inject_react":
        // These actions now return modifiedFiles, which are collected below
        break;
    }

    if (filePath) {
      const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
      if (formattableExtensions.has(ext)) {
        files.push(filePath);
      }
    }

    // Also collect any modifiedFiles from injection actions
    if (result.modifiedFiles) {
      for (const modifiedPath of result.modifiedFiles) {
        const ext = modifiedPath.slice(modifiedPath.lastIndexOf(".")).toLowerCase();
        if (formattableExtensions.has(ext) && !files.includes(modifiedPath)) {
          files.push(modifiedPath);
        }
      }
    }
  }

  return files;
}

/**
 * Extract project path from actions
 */
function getProjectPathFromActions(
  actionsPerformed: ActionResult[]
): string | undefined {
  for (const result of actionsPerformed) {
    if (!result.success) continue;
    const { action } = result;

    switch (action.type) {
      case "inject_eslint":
        return action.packagePath;
      case "inject_react":
      case "inject_next_config":
      case "inject_vite_config":
      case "install_next_routes":
        return action.projectPath;
    }
  }
  return undefined;
}

function normalizePnpmWorkspaceUilintSpecs(
  packagePath: string,
  packages: string[]
): string[] {
  // If we're in a pnpm workspace, prefer linking internal packages from the
  // workspace to avoid registry mismatches during local dev.
  const workspaceRoot = findWorkspaceRoot(packagePath);
  if (!existsSync(join(workspaceRoot, "pnpm-workspace.yaml"))) return packages;

  // Only attempt normalization when the install is touching uilint packages.
  const touchesUilint = packages.some((p) => p === "uilint-eslint" || p.startsWith("uilint-"));
  if (!touchesUilint) return packages;

  const pkgJsonPath = join(packagePath, "package.json");
  if (!existsSync(pkgJsonPath)) return packages;

  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null = null;
  try {
    pkg = JSON.parse(readFileSync(pkgJsonPath, "utf-8")) as typeof pkg;
  } catch {
    return packages;
  }

  const wanted = ["uilint-core", "uilint-eslint", "uilint-react"] as const;
  const present = new Set<string>();
  for (const name of wanted) {
    const range =
      pkg?.dependencies?.[name] ??
      pkg?.devDependencies?.[name];
    if (typeof range === "string") {
      present.add(name);
    }
  }

  if (present.size === 0) return packages;

  // Remove any existing uilint-* specs, then re-add as workspace:* for packages
  // that are already present in the target package.json.
  const filtered = packages.filter(
    (p) => !/^uilint-(core|eslint|react)(@.+)?$/.test(p)
  );

  for (const name of present) {
    filtered.push(`${name}@workspace:*`);
  }

  return filtered;
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
  const {
    dryRun = false,
    installDependencies = defaultInstallDependencies,
    projectPath,
    skipPrettier = false,
  } = options;

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
      const pkgs =
        dep.packageManager === "pnpm"
          ? normalizePnpmWorkspaceUilintSpecs(dep.packagePath, dep.packages)
          : dep.packages;
      await installDependencies(
        dep.packageManager,
        dep.packagePath,
        pkgs
      );
      dependencyResults.push({
        install: { ...dep, packages: pkgs },
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

  // Format modified files with prettier (if available)
  if (!dryRun && !skipPrettier) {
    const filesToFormat = collectFormattableFiles(actionsPerformed);
    if (filesToFormat.length > 0) {
      // Determine project path from options or from first dependency/action
      const formatProjectPath =
        projectPath ||
        plan.dependencies[0]?.packagePath ||
        getProjectPathFromActions(actionsPerformed);

      if (formatProjectPath) {
        // Run prettier silently - don't fail install if formatting fails
        await formatFilesWithPrettier(filesToFormat, formatProjectPath).catch(
          () => {
            // Ignore formatting errors
          }
        );

        // Touch files to trigger IDE file watchers (for format-on-save)
        // Small delay to ensure file system has flushed
        await new Promise((resolve) => setTimeout(resolve, 100));
        touchFiles(filesToFormat);
      }
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
      if (action.path.includes("genstyleguide.md")) items.push("genstyleguide");
      if (action.path.includes("/skills/") && action.path.includes("SKILL.md")) items.push("skill");
    }
    if (action.type === "inject_eslint") items.push("eslint");
    if (action.type === "install_next_routes") items.push("next");
    if (action.type === "inject_react") {
      items.push(action.mode === "vite" ? "vite" : "next");
    }
    if (action.type === "inject_vite_config") items.push("vite");
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

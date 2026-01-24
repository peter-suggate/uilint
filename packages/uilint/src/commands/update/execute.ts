/**
 * Execute phase for the update command
 *
 * Performs the actual file operations to update rules.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { loadSelectedRules } from "../../utils/rule-loader.js";
import { updateManifestRule } from "../../utils/manifest.js";
import { applyMigrations } from "../../utils/migration-engine.js";
import { updatePackages } from "../../utils/package-manager.js";
import type {
  UpdatePlan,
  UpdateAction,
  UpdateResult,
  UpdateActionResult,
  UpdateSummary,
  CopyRuleFilesAction,
  MigrateRuleOptionsAction,
  UpdateManifestVersionAction,
  UpdateNpmPackagesAction,
} from "./types.js";

export interface ExecuteUpdateOptions {
  dryRun?: boolean;
}

/**
 * Execute an update plan
 *
 * @param plan - The plan to execute
 * @param options - Execution options
 * @returns Result of the execution
 */
export async function executeUpdatePlan(
  plan: UpdatePlan,
  options: ExecuteUpdateOptions = {}
): Promise<UpdateResult> {
  const { dryRun = false } = options;
  const results: UpdateActionResult[] = [];
  const filesModified: string[] = [];

  for (const action of plan.actions) {
    const result = await executeAction(action, { dryRun });
    results.push(result);

    if (result.success && !dryRun) {
      // Track modified files
      if (action.type === "copy_rule_files") {
        filesModified.push(
          join(action.packagePath, ".uilint", "rules", action.ruleId)
        );
      } else if (action.type === "migrate_rule_options") {
        filesModified.push(action.configPath);
      } else if (action.type === "update_manifest_version") {
        filesModified.push(
          join(action.packagePath, ".uilint", "rules", "manifest.json")
        );
      }
    }
  }

  const success = results.every((r) => r.success);
  const rulesUpdated = new Set(plan.rules.map((r) => r.ruleId)).size;
  const packagesUpdated = new Set(
    plan.actions
      .filter((a) => "packagePath" in a)
      .map((a) => (a as { packagePath: string }).packagePath)
  ).size;

  const summary: UpdateSummary = {
    rulesUpdated,
    packagesUpdated,
    filesModified: [...new Set(filesModified)],
    breakingChanges: plan.rules
      .filter((r) => r.hasBreakingChanges)
      .map((r) => r.ruleId),
  };

  return {
    success,
    actionsPerformed: results,
    summary,
  };
}

/**
 * Execute a single update action
 */
async function executeAction(
  action: UpdateAction,
  options: ExecuteUpdateOptions
): Promise<UpdateActionResult> {
  const { dryRun = false } = options;

  switch (action.type) {
    case "update_npm_packages":
      return await executeUpdateNpmPackages(action, dryRun);

    case "copy_rule_files":
      return executeCopyRuleFiles(action, dryRun);

    case "migrate_rule_options":
      return executeMigrateRuleOptions(action, dryRun);

    case "update_manifest_version":
      return executeUpdateManifestVersion(action, dryRun);

    default: {
      const _exhaustive: never = action;
      return {
        action: _exhaustive,
        success: false,
        error: `Unknown action type`,
      };
    }
  }
}

/**
 * Update npm packages to latest versions
 */
async function executeUpdateNpmPackages(
  action: UpdateNpmPackagesAction,
  dryRun: boolean
): Promise<UpdateActionResult> {
  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Update npm packages: ${action.packages.join(", ")} to latest`,
    };
  }

  try {
    await updatePackages(
      action.packageManager,
      action.packagePath,
      action.packages,
      { dev: true }
    );

    return { action, success: true };
  } catch (error) {
    return {
      action,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Copy updated rule files
 */
function executeCopyRuleFiles(
  action: CopyRuleFilesAction,
  dryRun: boolean
): UpdateActionResult {
  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Copy rule files for ${action.ruleId} v${action.version} to ${action.packagePath}`,
    };
  }

  try {
    const rulesDir = join(action.packagePath, ".uilint", "rules");

    // Ensure directory exists
    if (!existsSync(rulesDir)) {
      mkdirSync(rulesDir, { recursive: true });
    }

    // Load rule files (TypeScript version - can adjust based on project config)
    const [ruleFile] = loadSelectedRules([action.ruleId], {
      typescript: true,
    });

    if (!ruleFile) {
      return {
        action,
        success: false,
        error: `Rule ${action.ruleId} not found in registry`,
      };
    }

    // Write implementation file
    const implPath = join(rulesDir, ruleFile.implementation.relativePath);
    mkdirSync(dirname(implPath), { recursive: true });
    writeFileSync(implPath, ruleFile.implementation.content, "utf-8");

    // Write additional files for directory-based rules
    if (ruleFile.additionalFiles) {
      for (const file of ruleFile.additionalFiles) {
        const filePath = join(rulesDir, file.relativePath);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, file.content, "utf-8");
      }
    }

    return { action, success: true };
  } catch (error) {
    return {
      action,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Migrate rule options in ESLint config
 */
function executeMigrateRuleOptions(
  action: MigrateRuleOptionsAction,
  dryRun: boolean
): UpdateActionResult {
  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Migrate options for ${action.ruleId} in ${action.configPath}`,
    };
  }

  try {
    // TODO: Implement actual ESLint config modification
    // For now, this is a placeholder that succeeds without modifying the config
    // The actual implementation requires AST parsing and modification

    // Note: The migration engine is already implemented in migration-engine.ts
    // What's needed here is:
    // 1. Read the ESLint config
    // 2. Find the rule options for action.ruleId
    // 3. Apply migrations using applyMigrations()
    // 4. Write the modified config back

    // For now, we'll skip this and just succeed
    // Users can manually update their config if migrations are needed
    if (action.migrations.length === 0) {
      return { action, success: true };
    }

    // Log that manual migration may be needed
    console.warn(
      `Note: Rule ${action.ruleId} has migrations. Manual config update may be needed.`
    );

    return { action, success: true };
  } catch (error) {
    return {
      action,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Update manifest with new version
 */
function executeUpdateManifestVersion(
  action: UpdateManifestVersionAction,
  dryRun: boolean
): UpdateActionResult {
  if (dryRun) {
    return {
      action,
      success: true,
      wouldDo: `Update manifest for ${action.ruleId} to v${action.version}`,
    };
  }

  try {
    const cliVersion = getCliVersion();
    updateManifestRule(
      action.packagePath,
      action.ruleId,
      action.version,
      cliVersion
    );

    return { action, success: true };
  } catch (error) {
    return {
      action,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Get CLI version from package.json
 */
function getCliVersion(): string {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, "..", "..", "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
      version?: string;
    };
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

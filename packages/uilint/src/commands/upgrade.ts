/**
 * Upgrade command - update installed rules to latest versions
 *
 * Usage:
 *   uilint upgrade             # Interactive upgrade
 *   uilint upgrade --check     # Show available updates only
 *   uilint upgrade --yes       # Auto-confirm all updates
 *   uilint upgrade --dry-run   # Show what would change
 *   uilint upgrade --rule <id> # Upgrade specific rule
 */

import {
  analyzeForUpdates,
  formatUpdateSummary,
} from "./update/analyze.js";
import {
  createUpdatePlan,
  formatPlanSummary,
  planHasBreakingChanges,
} from "./update/plan.js";
import { executeUpdatePlan } from "./update/execute.js";
import type { UpdateOptions, UpdateChoices } from "./update/types.js";
import {
  intro,
  outro,
  logInfo,
  logSuccess,
  logError,
  logWarning,
  note,
  pc,
  confirm,
} from "../utils/prompts.js";

export interface UpgradeCommandOptions {
  check?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  rule?: string;
}

/**
 * Run the upgrade command
 */
export async function upgrade(options: UpgradeCommandOptions): Promise<void> {
  intro("UILint Upgrade");

  try {
    const projectPath = process.cwd();

    // Phase 1: Analyze
    logInfo("Analyzing installed rules...");
    const analysis = analyzeForUpdates(projectPath);

    const hasPackageUpdates = analysis.packages.some(
      (p) => p.installedPackages.length > 0
    );

    if (analysis.totalUpdates === 0 && !hasPackageUpdates) {
      logSuccess("All packages and rules are up to date!");
      outro("No upgrades needed");
      return;
    }

    // Display available updates
    note(formatUpdateSummary(analysis), "Available Updates");

    // --check mode: just show what's available
    if (options.check) {
      outro("Run 'uilint upgrade' to apply updates");
      return;
    }

    // Filter by specific rule if requested
    let ruleIds: string[] = [];
    if (options.rule) {
      const ruleExists = analysis.packages.some((pkg) =>
        pkg.rules.some((r) => r.ruleId === options.rule && r.hasUpdate)
      );

      if (!ruleExists) {
        logError(`Rule '${options.rule}' not found or already up to date`);
        outro("Upgrade cancelled");
        process.exit(1);
      }

      ruleIds = [options.rule];
      logInfo(`Upgrading only: ${options.rule}`);
    }

    // Phase 2: Plan
    const choices: UpdateChoices = {
      packagePaths: analysis.packages.map((p) => p.packagePath),
      ruleIds,
      confirmBreaking: false,
    };

    const plan = createUpdatePlan(analysis, choices);

    if (plan.actions.length === 0) {
      logSuccess("No updates to apply");
      outro("Done");
      return;
    }

    // Display plan
    note(formatPlanSummary(plan), "Upgrade Plan");

    // Handle breaking changes
    if (planHasBreakingChanges(plan) && !options.yes) {
      logWarning("This upgrade includes breaking changes!");
      const confirmed = await confirm({
        message: "Continue with breaking changes?",
        initialValue: false,
      });

      if (!confirmed) {
        outro("Upgrade cancelled");
        return;
      }
    }

    // Confirm upgrade (unless --yes)
    if (!options.yes && !options.dryRun) {
      const npmPkgCount = plan.actions.filter(
        (a) => a.type === "update_npm_packages"
      ).length;
      const rulePkgCount = plan.rules.length;

      const parts: string[] = [];
      if (npmPkgCount > 0) {
        parts.push(`${npmPkgCount} package(s)`);
      }
      if (rulePkgCount > 0) {
        parts.push(`${rulePkgCount} rule(s)`);
      }

      const confirmed = await confirm({
        message: `Apply ${parts.join(" and ")} upgrade?`,
        initialValue: true,
      });

      if (!confirmed) {
        outro("Upgrade cancelled");
        return;
      }
    }

    // Phase 3: Execute
    if (options.dryRun) {
      logInfo("Dry run mode - no changes will be made");
    }

    const result = await executeUpdatePlan(plan, {
      dryRun: options.dryRun,
    });

    // Report results
    if (options.dryRun) {
      logInfo("Dry run complete. Would perform:");
      for (const action of result.actionsPerformed) {
        if (action.wouldDo) {
          console.log(`  • ${action.wouldDo}`);
        }
      }
    } else if (result.success) {
      // Count npm package updates
      const npmUpdates = plan.actions.filter(
        (a) => a.type === "update_npm_packages"
      ).length;

      const parts: string[] = [];
      if (npmUpdates > 0) {
        parts.push(`${npmUpdates} package(s)`);
      }
      if (result.summary.rulesUpdated > 0) {
        parts.push(`${result.summary.rulesUpdated} rule(s)`);
      }

      logSuccess(`Upgraded ${parts.join(" and ")}`);

      if (result.summary.filesModified.length > 0) {
        note(
          result.summary.filesModified.map((f) => `  ${f}`).join("\n"),
          "Modified files"
        );
      }

      if (result.summary.breakingChanges.length > 0) {
        logWarning("Breaking changes applied to:");
        for (const rule of result.summary.breakingChanges) {
          console.log(`  • ${rule}`);
        }
        console.log(
          "\nPlease review your ESLint config for any manual adjustments."
        );
      }
    } else {
      logError("Some upgrades failed");
      for (const action of result.actionsPerformed) {
        if (!action.success && action.error) {
          console.log(`  • ${action.error}`);
        }
      }
      process.exit(1);
    }

    outro("Upgrade complete");
  } catch (error) {
    logError(error instanceof Error ? error.message : "Upgrade failed");
    process.exit(1);
  }
}

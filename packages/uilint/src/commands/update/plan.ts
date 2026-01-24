/**
 * Plan phase for the update command
 *
 * Creates a plan of actions to update rules based on analysis and user choices.
 */

import type {
  UpdateAnalysis,
  UpdatePlan,
  UpdateAction,
  UpdateChoices,
  RuleUpdateInfo,
} from "./types.js";

/**
 * Create an update plan based on analysis and user choices
 *
 * @param analysis - Result from the analyze phase
 * @param choices - User selections for what to update
 * @returns Plan of actions to execute
 */
export function createUpdatePlan(
  analysis: UpdateAnalysis,
  choices: UpdateChoices
): UpdatePlan {
  const actions: UpdateAction[] = [];
  const rules: RuleUpdateInfo[] = [];

  for (const pkg of analysis.packages) {
    // Skip packages not selected
    if (!choices.packagePaths.includes(pkg.packagePath)) {
      continue;
    }

    // Action: Update npm packages (do this first)
    if (pkg.installedPackages.length > 0) {
      actions.push({
        type: "update_npm_packages",
        packagePath: pkg.packagePath,
        packageManager: pkg.packageManager,
        packages: pkg.installedPackages.map((p) => p.name),
      });
    }

    for (const rule of pkg.rules) {
      // Skip rules that don't have updates
      if (!rule.hasUpdate) {
        continue;
      }

      // Skip rules not in the specific rule filter (if set)
      if (choices.ruleIds.length > 0 && !choices.ruleIds.includes(rule.ruleId)) {
        continue;
      }

      // Track this rule for the plan
      rules.push(rule);

      // Action 1: Copy updated rule files
      actions.push({
        type: "copy_rule_files",
        packagePath: pkg.packagePath,
        ruleId: rule.ruleId,
        version: rule.availableVersion,
      });

      // Action 2: Migrate options in ESLint config (if migrations exist)
      if (rule.migrations.length > 0 && pkg.eslintConfigPath) {
        actions.push({
          type: "migrate_rule_options",
          configPath: pkg.eslintConfigPath,
          ruleId: rule.ruleId,
          migrations: rule.migrations,
        });
      }

      // Action 3: Update manifest with new version
      actions.push({
        type: "update_manifest_version",
        packagePath: pkg.packagePath,
        ruleId: rule.ruleId,
        version: rule.availableVersion,
      });
    }
  }

  return { actions, rules };
}

/**
 * Get a summary of what the plan will do
 */
export function formatPlanSummary(plan: UpdatePlan): string {
  if (plan.actions.length === 0) {
    return "No updates to apply.";
  }

  const lines: string[] = [];
  lines.push(`Update plan (${plan.rules.length} rule(s)):\n`);

  for (const rule of plan.rules) {
    const breaking = rule.hasBreakingChanges ? " ⚠️  BREAKING" : "";
    lines.push(
      `  ${rule.ruleId}: ${rule.installedVersion} → ${rule.availableVersion}${breaking}`
    );

    // Show migration descriptions
    if (rule.migrations.length > 0) {
      for (const migration of rule.migrations) {
        lines.push(`    - ${migration.description}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Check if the plan has any breaking changes that require confirmation
 */
export function planHasBreakingChanges(plan: UpdatePlan): boolean {
  return plan.rules.some((r) => r.hasBreakingChanges);
}

/**
 * Filter plan to only include specific rules
 */
export function filterPlanByRules(
  plan: UpdatePlan,
  ruleIds: string[]
): UpdatePlan {
  if (ruleIds.length === 0) {
    return plan;
  }

  const ruleIdSet = new Set(ruleIds);
  const filteredRules = plan.rules.filter((r) => ruleIdSet.has(r.ruleId));
  const filteredActions = plan.actions.filter((a) => {
    if ("ruleId" in a) {
      return ruleIdSet.has(a.ruleId);
    }
    return true;
  });

  return {
    actions: filteredActions,
    rules: filteredRules,
  };
}

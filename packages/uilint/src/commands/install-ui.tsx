/**
 * Install command with new Ink-based UI
 *
 * This is the new installer flow that shows:
 * 1. Project selection (which Next.js/Vite app to configure)
 * 2. Feature selection (what to install)
 * 3. ESLint rule configuration (if ESLint selected)
 * 4. Completion summary
 */

import React from "react";
import { render } from "ink";
import { InstallApp, type InjectionPointConfig } from "./install/components/InstallApp.js";
import { analyze } from "./install/analyze.js";
import { execute } from "./install/execute.js";
import type {
  InstallOptions,
  ExecuteOptions,
  UserChoices,
  InstallItem,
  ProjectState,
} from "./install/types.js";
import type {
  InstallerSelection,
  InstallTarget,
} from "./install/installers/types.js";
import type { ConfiguredRule } from "./install/components/RuleSelector.js";
import { ruleRegistry } from "uilint-eslint";
import { pc } from "../utils/prompts.js";

// Import installers to trigger registration
import "./install/installers/index.js";

function limitList(items: string[], max: number): string[] {
  if (items.length <= max) return items;
  return [...items.slice(0, max), pc.dim(`…and ${items.length - max} more`)];
}

function printInstallReport(result: Awaited<ReturnType<typeof execute>>): void {
  const failedDeps = result.dependencyResults.filter((r) => !r.success);
  const okDeps = result.dependencyResults.filter((r) => r.success);
  const failedActions = result.actionsPerformed.filter((r) => !r.success);
  const okActions = result.actionsPerformed.filter((r) => r.success);

  // High-level header
  if (result.success) {
    console.log(`\n${pc.green("✓")} Operation completed successfully`);
  } else {
    console.log(`\n${pc.yellow("⚠")} Operation completed with errors`);
  }

  // What was installed/changed (summary)
  const { summary } = result;
  const installed = summary.installedItems.map((x) => String(x));
  const created = summary.filesCreated;
  const modified = summary.filesModified;
  const deleted = summary.filesDeleted;

  if (installed.length > 0) {
    console.log(`\n${pc.bold("Installed:")}`);
    for (const item of installed) console.log(`- ${pc.green("✓")} ${item}`);
  }

  if (summary.eslintTargets.length > 0) {
    console.log(`\n${pc.bold("ESLint configured:")}`);
    for (const t of summary.eslintTargets) {
      console.log(
        `- ${pc.green("✓")} ${t.displayName} ${pc.dim(`(${t.configFile})`)}`
      );
    }
  }

  if (created.length + modified.length + deleted.length > 0) {
    console.log(`\n${pc.bold("Files:")}`);
    for (const p of limitList(created, 20))
      console.log(`- ${pc.green("+")} ${p}`);
    for (const p of limitList(modified, 20))
      console.log(`- ${pc.yellow("~")} ${p}`);
    for (const p of limitList(deleted, 20))
      console.log(`- ${pc.red("-")} ${p}`);
  }

  if (summary.dependenciesInstalled.length > 0) {
    console.log(`\n${pc.bold("Dependencies installed:")}`);
    for (const d of summary.dependenciesInstalled) {
      console.log(
        `- ${pc.green("✓")} ${d.packagePath} ${pc.dim(`← ${d.packages.join(", ")}`)}`
      );
    }
  }

  // Failures (include error info)
  if (failedDeps.length > 0 || failedActions.length > 0) {
    console.log(`\n${pc.bold(pc.red("Failures:"))}`);
  }

  if (failedDeps.length > 0) {
    console.log(`\n${pc.bold("Dependency installs failed:")}`);
    for (const dep of failedDeps) {
      const pkgs = dep.install.packages.join(", ");
      console.log(
        `- ${pc.red("✗")} ${dep.install.packageManager} in ${dep.install.packagePath} ${pc.dim(`← ${pkgs}`)}`
      );
      if (dep.error) console.log(pc.dim(dep.error.split("\n").slice(0, 30).join("\n")));
    }
  }

  if (failedActions.length > 0) {
    console.log(`\n${pc.bold("Actions failed:")}`);
    for (const a of failedActions) {
      const action = a.action as Record<string, unknown>;
      const type = String(action.type || "unknown");
      const pathish =
        (typeof action.path === "string" && action.path) ||
        (typeof action.projectPath === "string" && action.projectPath) ||
        (typeof action.packagePath === "string" && action.packagePath) ||
        "";

      console.error(`- ${type}${pathish ? ` (${pathish})` : ""}`);
      if (a.error) console.error(`  ${a.error}`);
    }
  }

  // Quick stats (useful for CI logs)
  console.log(
    pc.dim(
      `\nSummary: ${okActions.length} action(s) ok, ${failedActions.length} failed · ` +
        `${okDeps.length} dep install(s) ok, ${failedDeps.length} failed`
    )
  );
}

/**
 * Convert installer selections and configured rules to UserChoices for the execute phase
 */
function selectionsToUserChoices(
  selections: InstallerSelection[],
  project: ProjectState,
  eslintRules?: ConfiguredRule[],
  injectionPointConfig?: InjectionPointConfig
): UserChoices {
  const items: InstallItem[] = [];
  const choices: UserChoices = { items };

  for (const selection of selections) {
    if (!selection.selected || selection.targets.length === 0) continue;

    const { installer, targets } = selection;

    if (installer.id === "genstyleguide") {
      items.push("genstyleguide");
    } else if (installer.id === "skill") {
      items.push("skill");
    } else if (installer.id === "eslint") {
      items.push("eslint");
      // Add ESLint choices with configured rules
      choices.eslint = {
        packagePaths: targets.map((t: InstallTarget) => t.path),
        // Use configured rules if provided, otherwise fall back to all rules
        selectedRules: eslintRules
          ? eslintRules.map((cr) => ({
              ...cr.rule,
              // Override severity with user's selection
              defaultSeverity: cr.severity,
              defaultOptions: cr.options,
            }))
          : ruleRegistry,
      };
    } else if (installer.id === "next") {
      items.push("next");
      // Add Next.js choices
      const target = targets[0];
      const appInfo = project.nextApps.find(
        (app) => app.projectPath === target?.path
      );
      if (appInfo) {
        choices.next = {
          projectPath: appInfo.projectPath,
          detection: appInfo.detection,
          // Use injection point from follow-up UI selection
          targetFile: injectionPointConfig?.targetFile,
          createProviders: injectionPointConfig?.createProviders,
        };
      }
    } else if (installer.id === "vite") {
      items.push("vite");
      // Add Vite choices
      const target = targets[0];
      const appInfo = project.viteApps.find(
        (app) => app.projectPath === target?.path
      );
      if (appInfo) {
        choices.vite = {
          projectPath: appInfo.projectPath,
          detection: appInfo.detection,
        };
      }
    }
  }

  return choices;
}

/**
 * Check if terminal supports interactive mode
 */
function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Main install function with new UI
 *
 * @param options - CLI options
 * @param executeOptions - Options for the execute phase
 */
export async function installUI(
  options: InstallOptions = {},
  executeOptions: ExecuteOptions = {}
): Promise<void> {
  const projectPath = process.cwd();

  // Check if terminal supports interactive mode
  if (!isInteractiveTerminal()) {
    console.error("\n✗ Interactive mode requires a TTY terminal.");
    console.error("Run uilint install in an interactive terminal.\n");
    process.exit(1);
  }

  // Start project analysis
  const projectPromise = analyze(projectPath);

  // Render the Ink app
  const { waitUntilExit } = render(
    <InstallApp
      projectPromise={projectPromise}
      onComplete={async (selections, eslintRules, injectionPointConfig, uninstallSelections) => {
        // When user completes selection, proceed with installation
        const project = await projectPromise;
        const choices = selectionsToUserChoices(selections, project, eslintRules, injectionPointConfig);

        const hasInstalls = choices.items.length > 0;
        const hasUninstalls = uninstallSelections && uninstallSelections.length > 0;

        if (!hasInstalls && !hasUninstalls) {
          console.log("\nNo changes selected");
          process.exit(0);
        }

        // Generate install plan using existing plan logic
        const { createPlan } = await import("./install/plan.js");
        const plan = createPlan(project, choices, { force: options.force });

        // Generate uninstall plan actions
        if (hasUninstalls && uninstallSelections) {
          for (const selection of uninstallSelections) {
            if (!selection.selected || selection.targets.length === 0) continue;
            const { installer, targets } = selection;

            // Call planUninstall if the installer supports it
            if (installer.planUninstall) {
              const uninstallPlan = installer.planUninstall(targets, project);
              // Prepend uninstall actions to the plan (uninstall first, then install)
              plan.actions = [...uninstallPlan.actions, ...plan.actions];
            }
          }
        }

        // Execute the plan with projectPath for prettier formatting
        const result = await execute(plan, {
          ...executeOptions,
          projectPath: project.projectPath,
        });

        // Display results
        printInstallReport(result);

        process.exit(result.success ? 0 : 1);
      }}
      onError={(error) => {
        console.error("\n✗ Error:", error.message);
        process.exit(1);
      }}
    />
  );

  // Wait for the app to exit
  await waitUntilExit();
}

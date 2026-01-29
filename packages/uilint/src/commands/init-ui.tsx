/**
 * Init command with Ink-based UI
 *
 * This is the init flow that shows:
 * 1. Project selection (which Next.js/Vite app to configure)
 * 2. Feature selection (what to install)
 * 3. ESLint rule configuration (if ESLint selected)
 * 4. Completion summary
 *
 * Non-interactive mode:
 * Use --react, --eslint, --genstyleguide, or --skill flags to skip prompts.
 */

import React from "react";
import { render } from "ink";
import { InstallApp, type InjectionPointConfig } from "./init/components/InstallApp.js";
import { analyze } from "./init/analyze.js";
import { execute } from "./init/execute.js";
import { createPlan } from "./init/plan.js";
import { gatherChoices, type Prompter } from "./init/test-helpers.js";
import type {
  InstallOptions,
  ExecuteOptions,
  UserChoices,
  InstallItem,
  ProjectState,
} from "./init/types.js";
import type {
  InstallerSelection,
  InstallTarget,
} from "./init/installers/types.js";
import type { ConfiguredRule } from "./init/components/RuleSelector.js";
import { ruleRegistry } from "uilint-eslint";
import { pc } from "../utils/prompts.js";
import { detectCoverageSetup } from "../utils/coverage-detect.js";
import { runTestsWithCoverage, detectPackageManager } from "../utils/package-manager.js";

// Import installers to trigger registration
import "./init/installers/index.js";

/**
 * Auto-selecting prompter for non-interactive mode.
 * Automatically selects the first option when choices are needed.
 */
const autoPrompter: Prompter = {
  async selectInstallItems() {
    // This shouldn't be called in non-interactive mode since flags determine items
    return [];
  },
  async selectNextApp(apps) {
    // Auto-select first app
    return apps[0];
  },
  async selectViteApp(apps) {
    // Auto-select first app
    return apps[0];
  },
  async selectEslintPackages(packages) {
    // Auto-select all packages with ESLint config
    return packages.map((p) => p.path);
  },
  async selectEslintRules() {
    // Use all available rules with defaults
    return ruleRegistry;
  },
  async selectEslintRuleSeverity() {
    return "defaults";
  },
  async confirmCustomizeRuleOptions() {
    return false;
  },
  async configureRuleOptions() {
    return undefined;
  },
};

function limitList(items: string[], max: number): string[] {
  if (items.length <= max) return items;
  return [...items.slice(0, max), pc.dim(`…and ${items.length - max} more`)];
}

function printInstallReport(
  result: Awaited<ReturnType<typeof execute>>,
  testCoverageResult?: { ran: boolean; success: boolean; error?: string }
): void {
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

  // Test coverage result
  if (testCoverageResult?.ran) {
    console.log(`\n${pc.bold("Test coverage:")}`);
    if (testCoverageResult.success) {
      console.log(`- ${pc.green("✓")} Coverage data generated successfully`);
    } else {
      console.log(`- ${pc.yellow("⚠")} Tests ran with errors`);
      if (testCoverageResult.error) {
        console.log(pc.dim(`  ${testCoverageResult.error.split("\n")[0]}`));
      }
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
      const action = a.action as unknown as Record<string, unknown>;
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
 * Check if non-interactive flags are provided
 */
function hasNonInteractiveFlags(options: InstallOptions): boolean {
  return Boolean(
    options.react || options.eslint || options.genstyleguide || options.skill
  );
}

/**
 * Run init in non-interactive mode using CLI flags
 */
async function initNonInteractive(
  options: InstallOptions,
  executeOptions: ExecuteOptions = {}
): Promise<void> {
  const projectPath = process.cwd();

  console.log(pc.blue("UILint init (non-interactive mode)"));
  console.log(pc.dim("Analyzing project..."));

  const project = await analyze(projectPath);

  // Gather choices using flags (auto-prompter handles edge cases)
  const choices = await gatherChoices(project, options, autoPrompter);

  if (choices.items.length === 0) {
    console.log("\nNo features selected. Use --react, --eslint, --genstyleguide, or --skill.");
    process.exit(1);
  }

  console.log(pc.dim(`Installing: ${choices.items.join(", ")}`));

  // Create and execute plan
  const plan = createPlan(project, choices, { force: options.force });
  const result = await execute(plan, {
    ...executeOptions,
    projectPath: project.projectPath,
  });

  // Display results
  printInstallReport(result);

  process.exit(result.success ? 0 : 1);
}

/**
 * Main init function with Ink UI
 *
 * @param options - CLI options
 * @param executeOptions - Options for the execute phase
 */
export async function initUI(
  options: InstallOptions = {},
  executeOptions: ExecuteOptions = {}
): Promise<void> {
  const projectPath = process.cwd();

  // Non-interactive mode: use flags directly without TTY
  if (hasNonInteractiveFlags(options)) {
    await initNonInteractive(options, executeOptions);
    return;
  }

  // Check if terminal supports interactive mode
  if (!isInteractiveTerminal()) {
    console.error("\n✗ Interactive mode requires a TTY terminal.");
    console.error("Use --react, --eslint, --genstyleguide, or --skill for non-interactive mode.\n");
    process.exit(1);
  }

  // Start project analysis
  const projectPromise = analyze(projectPath);

  // Render the Ink app
  const { waitUntilExit } = render(
    <InstallApp
      projectPromise={projectPromise}
      onComplete={async (selections, eslintRules, injectionPointConfig, removeSelections) => {
        // When user completes selection, proceed with installation
        const project = await projectPromise;
        const choices = selectionsToUserChoices(selections, project, eslintRules, injectionPointConfig);

        const hasInstalls = choices.items.length > 0;
        const hasRemovals = removeSelections && removeSelections.length > 0;

        if (!hasInstalls && !hasRemovals) {
          console.log("\nNo changes selected");
          process.exit(0);
        }

        // Generate install plan using existing plan logic
        const { createPlan } = await import("./init/plan.js");
        const plan = createPlan(project, choices, { force: options.force });

        // Generate removal plan actions
        if (hasRemovals && removeSelections) {
          for (const selection of removeSelections) {
            if (!selection.selected || selection.targets.length === 0) continue;
            const { installer, targets } = selection;

            // Call planRemove if the installer supports it
            if (installer.planRemove) {
              const removePlan = installer.planRemove(targets, project);
              // Prepend removal actions to the plan (remove first, then install)
              plan.actions = [...removePlan.actions, ...plan.actions];
            }
          }
        }

        // Execute the plan with projectPath for prettier formatting
        const result = await execute(plan, {
          ...executeOptions,
          projectPath: project.projectPath,
        });

        // Run tests with coverage if require-test-coverage was installed
        let testCoverageResult: { ran: boolean; success: boolean; error?: string } | undefined;

        if (result.success && eslintRules?.some(r => r.rule.id === "require-test-coverage")) {
          // Get the target paths where ESLint was configured
          const eslintTargetPaths = choices.eslint?.packagePaths ?? [];

          for (const targetPath of eslintTargetPaths) {
            const coverageSetup = detectCoverageSetup(targetPath);

            // Only run tests if vitest and coverage config are set up
            if (coverageSetup.hasVitest && coverageSetup.hasCoverageConfig) {
              console.log(`\n${pc.blue("Running tests with coverage...")}`);
              const pm = detectPackageManager(targetPath);

              try {
                await runTestsWithCoverage(pm, targetPath);
                testCoverageResult = { ran: true, success: true };
                console.log(`${pc.green("✓")} Coverage data generated`);
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                testCoverageResult = { ran: true, success: false, error: errorMsg };
                console.log(`${pc.yellow("⚠")} Tests completed with errors`);
              }
            }
          }
        }

        // Display results
        printInstallReport(result, testCoverageResult);

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

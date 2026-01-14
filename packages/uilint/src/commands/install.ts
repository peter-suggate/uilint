/**
 * Install command - interactive setup wizard for UILint
 *
 * This is the main orchestrator that coordinates:
 * 1. Analyze - scan project state
 * 2. Gather choices - via prompts or CLI flags
 * 3. Plan - generate install plan
 * 4. Execute - perform side effects
 * 5. Display results
 *
 * The actual logic is split into separate modules for testability:
 * - install/analyze.ts - Project scanning
 * - install/plan.ts - Pure planning logic
 * - install/execute.ts - Side effect execution
 * - install/prompter.ts - User interaction abstraction
 */

import { join } from "path";
import { ruleRegistry } from "uilint-eslint";
import {
  intro,
  outro,
  note,
  logSuccess,
  logInfo,
  logWarning,
  withSpinner,
  pc,
} from "../utils/prompts.js";
import { analyze } from "./install/analyze.js";
import { createPlan } from "./install/plan.js";
import { execute } from "./install/execute.js";
import {
  cliPrompter,
  gatherChoices,
  type Prompter,
} from "./install/prompter.js";
import type {
  InstallOptions,
  InstallResult,
  ExecuteOptions,
} from "./install/types.js";

// Re-export types for external use
export type { InstallOptions } from "./install/types.js";

/**
 * Display the installation results
 */
function displayResults(result: InstallResult): void {
  const { summary } = result;
  const installedItems: string[] = [];

  // Commands
  if (summary.installedItems.includes("genstyleguide")) {
    installedItems.push(
      `${pc.cyan("Command")} → .cursor/commands/genstyleguide.md`
    );
  }

  // Next.js
  if (summary.nextApp) {
    installedItems.push(
      `${pc.cyan("Next Routes")} → ${pc.dim(
        join(summary.nextApp.appRoot, "api/.uilint")
      )}`
    );
    installedItems.push(
      `${pc.cyan("Next Devtools")} → ${pc.dim("<uilint-devtools /> injected")}`
    );
    installedItems.push(
      `${pc.cyan("JSX Loc Plugin")} → ${pc.dim(
        "next.config wrapped with withJsxLoc"
      )}`
    );
  }

  // Vite
  if (summary.viteApp) {
    installedItems.push(
      `${pc.cyan("Vite Devtools")} → ${pc.dim("<uilint-devtools /> injected")}`
    );
    installedItems.push(
      `${pc.cyan("JSX Loc Plugin")} → ${pc.dim(
        "vite.config plugins patched with jsxLoc()"
      )}`
    );
  }

  // ESLint
  if (summary.eslintTargets.length > 0) {
    installedItems.push(
      `${pc.cyan("ESLint Plugin")} → installed in ${
        summary.eslintTargets.length
      } package(s)`
    );
    for (let i = 0; i < summary.eslintTargets.length; i++) {
      const isLast = i === summary.eslintTargets.length - 1;
      const prefix = isLast ? "└" : "├";
      installedItems.push(
        `  ${pc.dim(prefix)} ${summary.eslintTargets[i].displayName}`
      );
    }
    installedItems.push(`${pc.cyan("Available Rules")}:`);
    for (let i = 0; i < ruleRegistry.length; i++) {
      const isLast = i === ruleRegistry.length - 1;
      const prefix = isLast ? "└" : "├";
      const rule = ruleRegistry[i];
      const suffix =
        rule.id === "semantic" ? ` ${pc.dim("(LLM-powered)")}` : "";
      installedItems.push(
        `  ${pc.dim(prefix)} ${pc.cyan(`uilint/${rule.id}`)}${suffix}`
      );
    }
  }

  note(installedItems.join("\n"), "Installed");

  // Next steps
  const steps: string[] = [];

  const hasStyleguide = summary.filesCreated.some((f) =>
    f.includes("styleguide.md")
  );
  if (!hasStyleguide) {
    steps.push(`Create a styleguide: ${pc.cyan("/genstyleguide")}`);
  }

  if (summary.installedItems.includes("genstyleguide")) {
    steps.push("Restart Cursor to load the new configuration");
  }

  if (summary.nextApp) {
    steps.push(
      "Run your Next.js dev server - use Alt+Click on any element to inspect"
    );
  }

  if (summary.viteApp) {
    steps.push(
      "Run your Vite dev server - use Alt+Click on any element to inspect"
    );
  }

  if (summary.eslintTargets.length > 0) {
    steps.push(`Run ${pc.cyan("npx eslint src/")} to check for issues`);
    steps.push(
      `For real-time overlay integration, run ${pc.cyan(
        "uilint serve"
      )} alongside your dev server`
    );
  }

  if (steps.length > 0) {
    note(steps.join("\n"), "Next Steps");
  }
}

/**
 * Main install function - orchestrates the entire installation process
 *
 * @param options - CLI options
 * @param prompter - Prompter implementation (defaults to CLI prompts, can be mocked for tests)
 * @param executeOptions - Options for the execute phase (for testing)
 */
export async function install(
  options: InstallOptions = {},
  prompter: Prompter = cliPrompter,
  executeOptions: ExecuteOptions = {}
): Promise<InstallResult> {
  const projectPath = process.cwd();

  intro("Setup Wizard");

  // Phase 1: Analyze
  logInfo("Analyzing project...");
  const state = await analyze(projectPath);

  // Phase 2: Gather choices
  const choices = await gatherChoices(state, options, prompter);

  if (choices.items.length === 0) {
    logWarning("No items selected for installation");
    outro("Nothing to install");
    return {
      success: true,
      actionsPerformed: [],
      dependencyResults: [],
      summary: {
        installedItems: [],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [],
        eslintTargets: [],
      },
    };
  }

  // Phase 3: Plan
  const plan = createPlan(state, choices, { force: options.force });

  // Phase 4: Execute
  logInfo("Installing...");

  // Execute actions with spinners for better UX
  const result = await withSpinner("Running installation", async () => {
    return execute(plan, executeOptions);
  });

  // Handle any errors
  const failedActions = result.actionsPerformed.filter((r) => !r.success);
  const failedDeps = result.dependencyResults.filter((r) => !r.success);

  if (failedActions.length > 0) {
    for (const failed of failedActions) {
      logWarning(`Failed: ${failed.action.type} - ${failed.error}`);
    }
  }

  if (failedDeps.length > 0) {
    for (const failed of failedDeps) {
      logWarning(
        `Failed to install dependencies in ${failed.install.packagePath}: ${failed.error}`
      );
    }
  }

  // Phase 5: Display results
  displayResults(result);

  if (result.success) {
    outro("UILint installed successfully!");
  } else {
    outro("UILint installation completed with some errors");
  }

  return result;
}

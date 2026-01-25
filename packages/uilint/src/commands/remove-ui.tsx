/**
 * Remove command with Ink-based UI
 *
 * Dedicated flow for removing UILint components from a project:
 * 1. Analyze project to find installed components
 * 2. Show selection UI with only installed items
 * 3. Confirm selection
 * 4. Execute removal
 */

import React from "react";
import { render } from "ink";
import { RemoveApp } from "./remove/components/RemoveApp.js";
import { analyze } from "./init/analyze.js";
import { execute } from "./init/execute.js";
import type { ExecuteOptions, InstallAction } from "./init/types.js";
import type { InstallerSelection } from "./init/installers/types.js";
import { pc } from "../utils/prompts.js";

// Import installers to trigger registration
import "./init/installers/index.js";

function limitList(items: string[], max: number): string[] {
  if (items.length <= max) return items;
  return [...items.slice(0, max), pc.dim(`…and ${items.length - max} more`)];
}

function printRemoveReport(
  result: Awaited<ReturnType<typeof execute>>
): void {
  const failedActions = result.actionsPerformed.filter((r) => !r.success);
  const okActions = result.actionsPerformed.filter((r) => r.success);

  // High-level header
  if (result.success) {
    console.log(`\n${pc.green("✓")} Removal completed successfully`);
  } else {
    console.log(`\n${pc.yellow("⚠")} Removal completed with errors`);
  }

  // Files changed
  const { summary } = result;
  const modified = summary.filesModified;
  const deleted = summary.filesDeleted;

  if (modified.length + deleted.length > 0) {
    console.log(`\n${pc.bold("Files:")}`);
    for (const p of limitList(modified, 20))
      console.log(`- ${pc.yellow("~")} ${p}`);
    for (const p of limitList(deleted, 20))
      console.log(`- ${pc.red("-")} ${p}`);
  }

  // Failures
  if (failedActions.length > 0) {
    console.log(`\n${pc.bold(pc.red("Failures:"))}`);
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

  // Quick stats
  console.log(
    pc.dim(
      `\nSummary: ${okActions.length} action(s) ok, ${failedActions.length} failed`
    )
  );
}

/**
 * Build removal plan from installer selections
 */
function buildRemovalPlan(
  selections: InstallerSelection[],
  project: Awaited<ReturnType<typeof analyze>>
): InstallAction[] {
  const actions: InstallAction[] = [];

  for (const selection of selections) {
    if (!selection.selected || selection.targets.length === 0) continue;
    const { installer, targets } = selection;

    // Call planRemove if the installer supports it
    if (installer.planRemove) {
      const removePlan = installer.planRemove(targets, project);
      actions.push(...removePlan.actions);
    }
  }

  return actions;
}

export interface RemoveOptions {
  /** Preview changes without actually removing */
  dryRun?: boolean;
  /** Skip confirmation prompt */
  yes?: boolean;
}

/**
 * Check if terminal supports interactive mode
 */
function isInteractiveTerminal(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Main remove function with Ink UI
 */
export async function removeUI(
  options: RemoveOptions = {}
): Promise<void> {
  const projectPath = process.cwd();

  // Check if terminal supports interactive mode
  if (!isInteractiveTerminal()) {
    console.error("\n✗ Interactive mode requires a TTY terminal.");
    console.error("Run uilint remove in an interactive terminal.\n");
    process.exit(1);
  }

  // Start project analysis
  const projectPromise = analyze(projectPath);

  // Render the Ink app
  const { waitUntilExit } = render(
    <RemoveApp
      projectPromise={projectPromise}
      skipConfirmation={options.yes}
      dryRun={options.dryRun}
      onComplete={async (selections) => {
        const project = await projectPromise;

        if (selections.length === 0) {
          console.log("\nNo components selected for removal");
          process.exit(0);
        }

        // Build removal plan
        const actions = buildRemovalPlan(selections, project);

        if (actions.length === 0) {
          console.log("\nNo removal actions to perform");
          process.exit(0);
        }

        // Execute the plan
        const result = await execute(
          { actions, dependencies: [] },
          {
            dryRun: options.dryRun,
            projectPath: project.projectPath,
          }
        );

        // Display results
        printRemoveReport(result);

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

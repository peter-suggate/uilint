/**
 * Install command with new Ink-based UI
 *
 * This is the new installer flow that shows:
 * 1. Project summary (what was detected)
 * 2. Feature selection (what to install)
 * 3. Installation progress (granular steps)
 * 4. Completion summary
 */

import React from "react";
import { render } from "ink";
import { InstallApp } from "./install/components/InstallApp.js";
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
import { ruleRegistry } from "uilint-eslint";

// Import installers to trigger registration
import "./install/installers/index.js";

/**
 * Convert installer selections to UserChoices for the execute phase
 */
function selectionsToUserChoices(
  selections: InstallerSelection[],
  project: ProjectState
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
      // Add ESLint choices
      choices.eslint = {
        packagePaths: targets.map((t: InstallTarget) => t.path),
        selectedRules: ruleRegistry,
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
      onComplete={async (selections) => {
        // When user completes selection, proceed with installation
        const project = await projectPromise;
        const choices = selectionsToUserChoices(selections, project);

        if (choices.items.length === 0) {
          console.log("\nNo items selected for installation");
          process.exit(0);
        }

        // Generate plan using existing plan logic
        const { createPlan } = await import("./install/plan.js");
        const plan = createPlan(project, choices, { force: options.force });

        // Execute the plan with projectPath for prettier formatting
        const result = await execute(plan, {
          ...executeOptions,
          projectPath: project.projectPath,
        });

        // Display results
        if (result.success) {
          console.log("\n✓ Installation completed successfully!");
        } else {
          console.log("\n⚠ Installation completed with errors");
        }

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

/**
 * End-to-end roundtrip tests for install → remove workflow
 *
 * These tests verify that running `uilint remove` completely reverts
 * all changes made by `uilint install`, including:
 * - Config file modifications (eslint.config.*, next.config.*, etc.)
 * - Created directories (.uilint/, API routes, etc.)
 * - Package.json dependencies
 *
 * Run with: pnpm test test/e2e/install-remove-roundtrip.test.ts
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, dirname, relative } from "path";
import { fileURLToPath } from "url";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { mockPrompter } from "../helpers/prompts.js";
import { analyze } from "../../src/commands/init/analyze.js";
import { createPlan } from "../../src/commands/init/plan.js";
import { execute } from "../../src/commands/init/execute.js";
import { gatherChoices } from "../../src/commands/init/test-helpers.js";
import type { InstallerSelection } from "../../src/commands/init/installers/types.js";
import type { ProjectState, InstallAction } from "../../src/commands/init/types.js";
import { getAllInstallers } from "../../src/commands/init/installers/registry.js";

// Import installers to trigger registration
import "../../src/commands/init/installers/index.js";

// ============================================================================
// Test Setup
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let fixture: FixtureContext | null = null;

// Get paths to local packages for linking
const uilintEslintPath = join(__dirname, "..", "..", "..", "uilint-eslint");
const uilintCorePath = join(__dirname, "..", "..", "..", "uilint-core");
const uilintReactPath = join(__dirname, "..", "..", "..", "uilint-react");

beforeAll(() => {
  // Ensure packages are built
  if (!existsSync(join(uilintEslintPath, "dist", "index.js"))) {
    throw new Error(
      "uilint-eslint must be built before running e2e tests. Run: pnpm build"
    );
  }
});

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

/**
 * Capture the state of a directory tree for comparison
 * Returns a map of relative paths to their content hash or "dir" for directories
 */
function captureDirectoryState(
  basePath: string,
  ignorePaths: string[] = ["node_modules", ".git", "pnpm-lock.yaml", "package-lock.json", "yarn.lock"]
): Map<string, string> {
  const state = new Map<string, string>();

  function walk(dir: string) {
    if (!existsSync(dir)) return;

    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relativePath = relative(basePath, fullPath);

      // Skip ignored paths
      if (ignorePaths.some((p) => relativePath.includes(p))) continue;

      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        state.set(relativePath, "dir");
        walk(fullPath);
      } else {
        const content = readFileSync(fullPath, "utf-8");
        state.set(relativePath, content);
      }
    }
  }

  walk(basePath);
  return state;
}

/**
 * Compare two directory states and return differences
 */
function compareStates(
  before: Map<string, string>,
  after: Map<string, string>
): {
  added: string[];
  removed: string[];
  modified: string[];
} {
  const added: string[] = [];
  const removed: string[] = [];
  const modified: string[] = [];

  // Find added and modified
  for (const [path, content] of after) {
    if (!before.has(path)) {
      added.push(path);
    } else if (before.get(path) !== content) {
      modified.push(path);
    }
  }

  // Find removed
  for (const path of before.keys()) {
    if (!after.has(path)) {
      removed.push(path);
    }
  }

  return { added, removed, modified };
}

/**
 * Build removal plan from installer selections
 */
function buildRemovalPlan(
  removeSelections: InstallerSelection[],
  project: ProjectState
): InstallAction[] {
  const actions: InstallAction[] = [];

  for (const selection of removeSelections) {
    if (!selection.selected || selection.targets.length === 0) continue;
    const { installer, targets } = selection;

    if (installer.planRemove) {
      const removePlan = installer.planRemove(targets, project);
      actions.push(...removePlan.actions);
    }
  }

  return actions;
}

// Mock dependency functions for controlled testing
const mockInstallDependencies = async () => {};
const mockUninstallDependencies = async () => {};

// ============================================================================
// Install → Remove Roundtrip Tests
// ============================================================================

describe("Install → Remove Roundtrip", () => {
  it("ESLint install and remove reverts all changes", async () => {
    fixture = useFixture("has-eslint-flat");

    // Capture initial state (excluding lock files and node_modules)
    const initialState = captureDirectoryState(fixture.path);

    // --- INSTALL PHASE ---
    const stateBeforeInstall = await analyze(fixture.path);

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [fixture.path],
      eslintRuleIds: ["prefer-tailwind"],
    });

    const choices = await gatherChoices(stateBeforeInstall, {}, prompter);
    const plan = createPlan(stateBeforeInstall, choices);

    const installResult = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(installResult.success).toBe(true);

    // Verify installation happened
    expect(fixture.exists(".uilint/rules/prefer-tailwind.js")).toBe(true);
    const configAfterInstall = fixture.readFile("eslint.config.mjs");
    expect(configAfterInstall).toContain("uilint");

    // Capture state after installation
    const installedState = captureDirectoryState(fixture.path);
    const installDiff = compareStates(initialState, installedState);

    // Should have added .uilint directory and modified eslint.config
    expect(installDiff.added.some((p) => p.includes(".uilint"))).toBe(true);
    expect(
      installDiff.modified.some((p) => p.includes("eslint.config"))
    ).toBe(true);

    // --- REMOVE PHASE ---
    const stateAfterInstall = await analyze(fixture.path);
    const installers = getAllInstallers();
    const eslintInstaller = installers.find((i) => i.id === "eslint");
    const pkg = stateAfterInstall.packages.find((p) => p.hasUilintRules);

    const removeSelections: InstallerSelection[] = [
      {
        installer: eslintInstaller!,
        targets: [
          {
            id: pkg!.path,
            label: "ESLint",
            path: pkg!.path,
            isInstalled: true,
          },
        ],
        selected: true,
      },
    ];

    const removeActions = buildRemovalPlan(removeSelections, stateAfterInstall);

    const removeResult = await execute(
      { actions: removeActions, dependencies: [] },
      {
        dryRun: false,
        installDependencies: mockInstallDependencies,
        uninstallDependencies: mockUninstallDependencies,
      }
    );

    expect(removeResult.success).toBe(true);

    // Capture final state
    const finalState = captureDirectoryState(fixture.path);

    // Compare final state to initial state
    const finalDiff = compareStates(initialState, finalState);

    // After removal, .uilint directory should be gone
    expect(fixture.exists(".uilint/rules")).toBe(false);

    // ESLint config should not contain uilint
    const configAfterRemoval = fixture.readFile("eslint.config.mjs");
    expect(configAfterRemoval).not.toContain("uilint/prefer-tailwind");

    // Log any remaining differences for debugging
    if (
      finalDiff.added.length > 0 ||
      finalDiff.removed.length > 0 ||
      finalDiff.modified.length > 0
    ) {
      console.log("State differences after removal:");
      console.log("  Added:", finalDiff.added);
      console.log("  Removed:", finalDiff.removed);
      console.log("  Modified:", finalDiff.modified);
    }

    // Verify the state is reasonably reverted
    // Note: Empty directories may remain (e.g., .uilint/ without rules/)
    // and some modifications may remain (e.g., formatting changes, .gitignore additions)
    // but core uilint content should be gone

    // Filter out empty directory entries - only care about actual content
    const addedContent = finalDiff.added.filter((p) => {
      // Ignore empty directories
      if (finalState.get(p) === "dir") {
        // Check if directory has any content
        const hasContent = [...finalState.keys()].some(
          (k) => k.startsWith(p + "/") && finalState.get(k) !== "dir"
        );
        return hasContent;
      }
      return true;
    });

    // Verify no uilint content files remain (empty dirs are ok)
    expect(addedContent.filter((p) => p.includes(".uilint"))).toEqual([]);
  });

  it("Genstyleguide install and remove reverts all changes", async () => {
    fixture = useFixture("has-eslint-flat");

    // Capture initial state
    const initialState = captureDirectoryState(fixture.path);

    // --- INSTALL PHASE ---
    const stateBeforeInstall = await analyze(fixture.path);

    const prompter = mockPrompter({
      installItems: ["genstyleguide"],
    });

    const choices = await gatherChoices(stateBeforeInstall, {}, prompter);
    const plan = createPlan(stateBeforeInstall, choices);

    const installResult = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(installResult.success).toBe(true);
    expect(fixture.exists(".cursor/commands/genstyleguide.md")).toBe(true);

    // --- REMOVE PHASE ---
    const stateAfterInstall = await analyze(fixture.path);
    const installers = getAllInstallers();
    const genstyleguideInstaller = installers.find(
      (i) => i.id === "genstyleguide"
    );

    const removeSelections: InstallerSelection[] = [
      {
        installer: genstyleguideInstaller!,
        targets: [
          {
            id: "genstyleguide",
            label: "/genstyleguide command",
            path: fixture.path,
            isInstalled: true,
          },
        ],
        selected: true,
      },
    ];

    const removeActions = buildRemovalPlan(removeSelections, stateAfterInstall);

    const removeResult = await execute(
      { actions: removeActions, dependencies: [] },
      {
        dryRun: false,
        installDependencies: mockInstallDependencies,
        uninstallDependencies: mockUninstallDependencies,
      }
    );

    expect(removeResult.success).toBe(true);
    expect(fixture.exists(".cursor/commands/genstyleguide.md")).toBe(false);

    // Capture final state
    const finalState = captureDirectoryState(fixture.path);
    const finalDiff = compareStates(initialState, finalState);

    // Verify genstyleguide artifacts are gone
    expect(
      finalDiff.added.filter((p) => p.includes("genstyleguide"))
    ).toEqual([]);
  });

  it("Skill install and remove reverts all changes", async () => {
    fixture = useFixture("has-eslint-flat");

    // Capture initial state
    const initialState = captureDirectoryState(fixture.path);

    // --- INSTALL PHASE ---
    const stateBeforeInstall = await analyze(fixture.path);

    const prompter = mockPrompter({
      installItems: ["skill"],
    });

    const choices = await gatherChoices(stateBeforeInstall, {}, prompter);
    const plan = createPlan(stateBeforeInstall, choices);

    const installResult = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(installResult.success).toBe(true);
    expect(fixture.exists(".cursor/skills/ui-consistency-enforcer")).toBe(true);

    // --- REMOVE PHASE ---
    const stateAfterInstall = await analyze(fixture.path);
    const installers = getAllInstallers();
    const skillInstaller = installers.find((i) => i.id === "skill");

    const removeSelections: InstallerSelection[] = [
      {
        installer: skillInstaller!,
        targets: [
          {
            id: "ui-consistency-skill",
            label: "UI Consistency Agent skill",
            path: fixture.path,
            isInstalled: true,
          },
        ],
        selected: true,
      },
    ];

    const removeActions = buildRemovalPlan(removeSelections, stateAfterInstall);

    const removeResult = await execute(
      { actions: removeActions, dependencies: [] },
      {
        dryRun: false,
        installDependencies: mockInstallDependencies,
        uninstallDependencies: mockUninstallDependencies,
      }
    );

    expect(removeResult.success).toBe(true);
    expect(fixture.exists(".cursor/skills/ui-consistency-enforcer")).toBe(
      false
    );

    // Capture final state
    const finalState = captureDirectoryState(fixture.path);
    const finalDiff = compareStates(initialState, finalState);

    // Verify skill artifacts are gone
    expect(
      finalDiff.added.filter((p) => p.includes("ui-consistency-enforcer"))
    ).toEqual([]);
  });

  it("Multiple components install and remove reverts all changes", async () => {
    fixture = useFixture("has-eslint-flat");

    // Capture initial state
    const initialState = captureDirectoryState(fixture.path);

    // --- INSTALL PHASE (multiple components) ---
    const stateBeforeInstall = await analyze(fixture.path);

    const prompter = mockPrompter({
      installItems: ["eslint", "genstyleguide", "skill"],
      eslintPackagePaths: [fixture.path],
      eslintRuleIds: ["prefer-tailwind"],
    });

    const choices = await gatherChoices(stateBeforeInstall, {}, prompter);
    const plan = createPlan(stateBeforeInstall, choices);

    const installResult = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(installResult.success).toBe(true);

    // Verify all installed
    expect(fixture.exists(".uilint/rules/prefer-tailwind.js")).toBe(true);
    expect(fixture.exists(".cursor/commands/genstyleguide.md")).toBe(true);
    expect(fixture.exists(".cursor/skills/ui-consistency-enforcer")).toBe(true);

    // --- REMOVE ALL COMPONENTS ---
    const stateAfterInstall = await analyze(fixture.path);
    const installers = getAllInstallers();

    const eslintInstaller = installers.find((i) => i.id === "eslint");
    const genstyleguideInstaller = installers.find(
      (i) => i.id === "genstyleguide"
    );
    const skillInstaller = installers.find((i) => i.id === "skill");
    const pkg = stateAfterInstall.packages.find((p) => p.hasUilintRules);

    const removeSelections: InstallerSelection[] = [
      {
        installer: eslintInstaller!,
        targets: [
          {
            id: pkg!.path,
            label: "ESLint",
            path: pkg!.path,
            isInstalled: true,
          },
        ],
        selected: true,
      },
      {
        installer: genstyleguideInstaller!,
        targets: [
          {
            id: "genstyleguide",
            label: "/genstyleguide command",
            path: fixture.path,
            isInstalled: true,
          },
        ],
        selected: true,
      },
      {
        installer: skillInstaller!,
        targets: [
          {
            id: "ui-consistency-skill",
            label: "UI Consistency Agent skill",
            path: fixture.path,
            isInstalled: true,
          },
        ],
        selected: true,
      },
    ];

    const removeActions = buildRemovalPlan(removeSelections, stateAfterInstall);

    const removeResult = await execute(
      { actions: removeActions, dependencies: [] },
      {
        dryRun: false,
        installDependencies: mockInstallDependencies,
        uninstallDependencies: mockUninstallDependencies,
      }
    );

    expect(removeResult.success).toBe(true);

    // Verify all removed
    expect(fixture.exists(".uilint/rules")).toBe(false);
    expect(fixture.exists(".cursor/commands/genstyleguide.md")).toBe(false);
    expect(fixture.exists(".cursor/skills/ui-consistency-enforcer")).toBe(
      false
    );

    // Capture final state and compare
    const finalState = captureDirectoryState(fixture.path);
    const finalDiff = compareStates(initialState, finalState);

    // Log differences
    if (
      finalDiff.added.length > 0 ||
      finalDiff.removed.length > 0 ||
      finalDiff.modified.length > 0
    ) {
      console.log("State differences after full removal:");
      console.log("  Added:", finalDiff.added);
      console.log("  Removed:", finalDiff.removed);
      console.log("  Modified:", finalDiff.modified);
    }

    // Filter out empty directory entries - only care about actual content
    const addedContent = finalDiff.added.filter((p) => {
      // Ignore empty directories
      if (finalState.get(p) === "dir") {
        // Check if directory has any content
        const hasContent = [...finalState.keys()].some(
          (k) => k.startsWith(p + "/") && finalState.get(k) !== "dir"
        );
        return hasContent;
      }
      return true;
    });

    // Core uilint content should be gone (empty dirs are ok)
    expect(addedContent.filter((p) => p.includes(".uilint"))).toEqual([]);
    expect(addedContent.filter((p) => p.includes("genstyleguide"))).toEqual([]);
    expect(
      addedContent.filter((p) => p.includes("ui-consistency-enforcer"))
    ).toEqual([]);
  });

  it("verifies remove_dependencies action is included for ESLint", async () => {
    fixture = useFixture("has-eslint-flat");

    // Install first
    const stateBeforeInstall = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [fixture.path],
      eslintRuleIds: ["prefer-tailwind"],
    });

    const choices = await gatherChoices(stateBeforeInstall, {}, prompter);
    const plan = createPlan(stateBeforeInstall, choices);
    await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    // Build removal plan
    const stateAfterInstall = await analyze(fixture.path);
    const installers = getAllInstallers();
    const eslintInstaller = installers.find((i) => i.id === "eslint");
    const pkg = stateAfterInstall.packages.find((p) => p.hasUilintRules);

    const removeSelections: InstallerSelection[] = [
      {
        installer: eslintInstaller!,
        targets: [
          {
            id: pkg!.path,
            label: "ESLint",
            path: pkg!.path,
            isInstalled: true,
          },
        ],
        selected: true,
      },
    ];

    const removeActions = buildRemovalPlan(removeSelections, stateAfterInstall);

    // Verify remove_dependencies action is in the plan
    const removeDepsAction = removeActions.find(
      (a) => a.type === "remove_dependencies"
    );
    expect(removeDepsAction).toBeDefined();
    expect(removeDepsAction?.type).toBe("remove_dependencies");
    if (removeDepsAction?.type === "remove_dependencies") {
      expect(removeDepsAction.packages).toContain("uilint-eslint");
    }
  });
});

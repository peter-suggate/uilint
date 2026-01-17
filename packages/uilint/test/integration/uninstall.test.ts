/**
 * Integration tests for component uninstallation
 *
 * These tests verify that the uninstall functionality correctly removes
 * UILint components from various project configurations.
 */

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { mockPrompter } from "../helpers/prompts.js";
import { analyze } from "../../src/commands/install/analyze.js";
import { createPlan } from "../../src/commands/install/plan.js";
import { execute } from "../../src/commands/install/execute.js";
import { gatherChoices } from "../../src/commands/install/test-helpers.js";
import { getAllInstallers } from "../../src/commands/install/installers/registry.js";
import type { ProjectState, InstallAction } from "../../src/commands/install/types.js";
import type { InstallerSelection, InstallTarget } from "../../src/commands/install/installers/types.js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

// Import installers to trigger registration
import "../../src/commands/install/installers/index.js";

// ============================================================================
// Test Setup
// ============================================================================

let fixture: FixtureContext | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

// Mock dependency installer (never actually install packages)
const mockInstallDependencies = async () => {
  // No-op - we don't want to actually run npm/pnpm install
};

/**
 * Helper to simulate an installed state by running install first
 */
async function installFirst(
  fixtureName: string,
  installItems: string[]
): Promise<{ fixture: FixtureContext; state: ProjectState }> {
  const f = useFixture(fixtureName);

  // Run analyze
  const state = await analyze(f.path);

  // Create choices for installation
  const pkg = state.packages.find((p) => p.eslintConfigPath !== null);
  const prompter = mockPrompter({
    installItems: installItems as any,
    eslintPackagePaths: pkg ? [pkg.path] : [],
    eslintRuleIds: ["no-arbitrary-tailwind", "consistent-spacing"],
  });

  const choices = await gatherChoices(state, {}, prompter);

  // Create and execute install plan
  const plan = createPlan(state, choices);
  const result = await execute(plan, {
    dryRun: false,
    installDependencies: mockInstallDependencies,
  });

  expect(result.success).toBe(true);

  // Re-analyze to get updated state
  const newState = await analyze(f.path);
  return { fixture: f, state: newState };
}

/**
 * Helper to build uninstall plan from installer selections
 */
function buildUninstallPlan(
  uninstallSelections: InstallerSelection[],
  project: ProjectState
): InstallAction[] {
  const actions: InstallAction[] = [];

  for (const selection of uninstallSelections) {
    if (!selection.selected || selection.targets.length === 0) continue;
    const { installer, targets } = selection;

    // Call planUninstall if the installer supports it
    if (installer.planUninstall) {
      const uninstallPlan = installer.planUninstall(targets, project);
      actions.push(...uninstallPlan.actions);
    }
  }

  return actions;
}

// ============================================================================
// ESLint Uninstallation Tests
// ============================================================================

describe("ESLint uninstallation", () => {
  it("removes uilint rules from eslint.config.mjs", async () => {
    // First install ESLint rules
    const { fixture: f, state } = await installFirst("has-eslint-flat", [
      "eslint",
    ]);
    fixture = f;

    // Verify installation happened
    expect(fixture.exists(".uilint/rules/no-arbitrary-tailwind.js")).toBe(true);
    const configAfterInstall = fixture.readFile("eslint.config.mjs");
    expect(configAfterInstall).toContain("uilint");

    // Get installers and find ESLint
    const installers = getAllInstallers();
    const eslintInstaller = installers.find((i) => i.id === "eslint");
    expect(eslintInstaller).toBeDefined();

    // Build uninstall selection
    const pkg = state.packages.find((p) => p.hasUilintRules);
    expect(pkg).toBeDefined();

    const uninstallSelections: InstallerSelection[] = [
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

    // Build and execute uninstall plan
    const uninstallActions = buildUninstallPlan(uninstallSelections, state);
    expect(uninstallActions.length).toBeGreaterThan(0);

    const result = await execute(
      { actions: uninstallActions, dependencies: [] },
      { dryRun: false, installDependencies: mockInstallDependencies }
    );

    expect(result.success).toBe(true);

    // Verify rules are removed
    expect(fixture.exists(".uilint/rules")).toBe(false);

    // Verify ESLint config no longer has uilint rules
    const configAfterUninstall = fixture.readFile("eslint.config.mjs");
    expect(configAfterUninstall).not.toContain("uilint/no-arbitrary-tailwind");
    expect(configAfterUninstall).not.toContain("uilint/consistent-spacing");
  });

  it("removes uilint from eslint.config.ts", async () => {
    const { fixture: f, state } = await installFirst("has-eslint-flat-ts", [
      "eslint",
    ]);
    fixture = f;

    // Verify installation
    expect(fixture.exists(".uilint/rules/no-arbitrary-tailwind.ts")).toBe(true);
    const configAfterInstall = fixture.readFile("eslint.config.ts");
    expect(configAfterInstall).toContain("uilint");

    // Get installers
    const installers = getAllInstallers();
    const eslintInstaller = installers.find((i) => i.id === "eslint");
    const pkg = state.packages.find((p) => p.hasUilintRules);

    const uninstallSelections: InstallerSelection[] = [
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

    const uninstallActions = buildUninstallPlan(uninstallSelections, state);
    const result = await execute(
      { actions: uninstallActions, dependencies: [] },
      { dryRun: false, installDependencies: mockInstallDependencies }
    );

    expect(result.success).toBe(true);
    expect(fixture.exists(".uilint/rules")).toBe(false);

    const configAfterUninstall = fixture.readFile("eslint.config.ts");
    expect(configAfterUninstall).not.toContain("uilint/");
  });

  it("dry run does not modify files", async () => {
    const { fixture: f, state } = await installFirst("has-eslint-flat", [
      "eslint",
    ]);
    fixture = f;

    // Capture state before dry run
    const configBefore = fixture.readFile("eslint.config.mjs");
    const rulesExistBefore = fixture.exists(".uilint/rules");

    // Get installers and build uninstall plan
    const installers = getAllInstallers();
    const eslintInstaller = installers.find((i) => i.id === "eslint");
    const pkg = state.packages.find((p) => p.hasUilintRules);

    const uninstallSelections: InstallerSelection[] = [
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

    const uninstallActions = buildUninstallPlan(uninstallSelections, state);

    // Execute with dryRun: true
    const result = await execute(
      { actions: uninstallActions, dependencies: [] },
      { dryRun: true, installDependencies: mockInstallDependencies }
    );

    expect(result.success).toBe(true);

    // Verify nothing was modified
    const configAfter = fixture.readFile("eslint.config.mjs");
    expect(configAfter).toBe(configBefore);
    expect(fixture.exists(".uilint/rules")).toBe(rulesExistBefore);
  });
});

// ============================================================================
// Genstyleguide Uninstallation Tests
// ============================================================================

describe("Genstyleguide uninstallation", () => {
  it("removes genstyleguide.md command file", async () => {
    // First install genstyleguide
    const { fixture: f, state } = await installFirst("has-eslint-flat", [
      "genstyleguide",
    ]);
    fixture = f;

    // Verify installation
    expect(fixture.exists(".cursor/commands/genstyleguide.md")).toBe(true);

    // Get installers
    const installers = getAllInstallers();
    const genstyleguideInstaller = installers.find(
      (i) => i.id === "genstyleguide"
    );
    expect(genstyleguideInstaller).toBeDefined();

    const uninstallSelections: InstallerSelection[] = [
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

    const uninstallActions = buildUninstallPlan(uninstallSelections, state);
    expect(uninstallActions.length).toBeGreaterThan(0);

    const result = await execute(
      { actions: uninstallActions, dependencies: [] },
      { dryRun: false, installDependencies: mockInstallDependencies }
    );

    expect(result.success).toBe(true);
    expect(fixture.exists(".cursor/commands/genstyleguide.md")).toBe(false);
  });
});

// ============================================================================
// Skill Uninstallation Tests
// ============================================================================

describe("Skill uninstallation", () => {
  it("removes skill directory", async () => {
    // First install skill
    const { fixture: f, state } = await installFirst("has-eslint-flat", [
      "skill",
    ]);
    fixture = f;

    // Verify installation
    expect(fixture.exists(".cursor/skills/ui-consistency-enforcer")).toBe(true);

    // Get installers
    const installers = getAllInstallers();
    const skillInstaller = installers.find((i) => i.id === "skill");
    expect(skillInstaller).toBeDefined();

    const uninstallSelections: InstallerSelection[] = [
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

    const uninstallActions = buildUninstallPlan(uninstallSelections, state);
    expect(uninstallActions.length).toBeGreaterThan(0);

    const result = await execute(
      { actions: uninstallActions, dependencies: [] },
      { dryRun: false, installDependencies: mockInstallDependencies }
    );

    expect(result.success).toBe(true);
    expect(fixture.exists(".cursor/skills/ui-consistency-enforcer")).toBe(
      false
    );
  });
});

// ============================================================================
// Combined Install + Uninstall Tests
// ============================================================================

describe("Combined install and uninstall", () => {
  it("uninstalls one component while installing another", async () => {
    // First install ESLint
    const { fixture: f, state: stateAfterInstall } = await installFirst(
      "has-eslint-flat",
      ["eslint"]
    );
    fixture = f;

    // Verify ESLint is installed
    expect(fixture.exists(".uilint/rules")).toBe(true);

    // Now build a plan that:
    // 1. Uninstalls ESLint
    // 2. Installs genstyleguide
    const installers = getAllInstallers();
    const eslintInstaller = installers.find((i) => i.id === "eslint");
    const genstyleguideInstaller = installers.find(
      (i) => i.id === "genstyleguide"
    );

    const pkg = stateAfterInstall.packages.find((p) => p.hasUilintRules);

    // Build uninstall actions
    const uninstallSelections: InstallerSelection[] = [
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

    const uninstallActions = buildUninstallPlan(
      uninstallSelections,
      stateAfterInstall
    );

    // Build install plan for genstyleguide
    const prompter = mockPrompter({
      installItems: ["genstyleguide"],
    });
    const choices = await gatherChoices(stateAfterInstall, {}, prompter);
    const installPlan = createPlan(stateAfterInstall, choices);

    // Combine: uninstall first, then install
    const combinedPlan = {
      actions: [...uninstallActions, ...installPlan.actions],
      dependencies: installPlan.dependencies,
    };

    const result = await execute(combinedPlan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // ESLint should be removed
    expect(fixture.exists(".uilint/rules")).toBe(false);

    // Genstyleguide should be installed
    expect(fixture.exists(".cursor/commands/genstyleguide.md")).toBe(true);
  });

  it("handles empty uninstall selection gracefully", async () => {
    fixture = useFixture("has-eslint-flat");

    // Build empty uninstall plan
    const uninstallActions = buildUninstallPlan([], await analyze(fixture.path));
    expect(uninstallActions).toEqual([]);

    const result = await execute(
      { actions: [], dependencies: [] },
      { dryRun: false, installDependencies: mockInstallDependencies }
    );

    expect(result.success).toBe(true);
  });
});

// ============================================================================
// Fully Installed ESLint (no upgrade available) Tests
// ============================================================================

describe("Fully installed ESLint uninstallation", () => {
  it("detects ESLint as installed without upgrade when all rules configured", async () => {
    fixture = useFixture("has-eslint-with-uilint-all-rules");
    const state = await analyze(fixture.path);

    // Get the ESLint installer and its targets
    const installers = getAllInstallers();
    const eslintInstaller = installers.find((i) => i.id === "eslint");
    expect(eslintInstaller).toBeDefined();

    const targets = eslintInstaller!.getTargets(state);
    expect(targets).toHaveLength(1);

    // The target should be marked as installed with no upgrade available
    const target = targets[0];
    expect(target.isInstalled).toBe(true);
    expect(target.canUpgrade).toBe(false);
  });

  it("can uninstall fully-installed ESLint (no upgrade available)", async () => {
    fixture = useFixture("has-eslint-with-uilint-all-rules");
    const state = await analyze(fixture.path);

    // Verify ESLint is configured with all rules
    const pkg = state.packages.find((p) => p.hasUilintRules);
    expect(pkg).toBeDefined();
    expect(pkg!.hasUilintRules).toBe(true);

    // Get installers
    const installers = getAllInstallers();
    const eslintInstaller = installers.find((i) => i.id === "eslint");
    expect(eslintInstaller).toBeDefined();

    // Verify no upgrade is available
    const targets = eslintInstaller!.getTargets(state);
    expect(targets[0].canUpgrade).toBe(false);

    // Build uninstall selection
    const uninstallSelections: InstallerSelection[] = [
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

    // Build and execute uninstall plan
    const uninstallActions = buildUninstallPlan(uninstallSelections, state);
    expect(uninstallActions.length).toBeGreaterThan(0);

    const result = await execute(
      { actions: uninstallActions, dependencies: [] },
      { dryRun: false, installDependencies: mockInstallDependencies }
    );

    expect(result.success).toBe(true);

    // Verify ESLint config no longer has uilint rules
    const configAfterUninstall = fixture.readFile("eslint.config.mjs");
    expect(configAfterUninstall).not.toContain("uilint/no-arbitrary-tailwind");
    expect(configAfterUninstall).not.toContain("uilint/semantic");
  });

  it("shows correct status for fully-installed vs upgradeable ESLint", async () => {
    // Test with partial installation (has-eslint-with-uilint has only 1 rule)
    const partialFixture = useFixture("has-eslint-with-uilint");
    const partialState = await analyze(partialFixture.path);

    const installers = getAllInstallers();
    const eslintInstaller = installers.find((i) => i.id === "eslint");

    // Partial: should be upgradeable
    const partialTargets = eslintInstaller!.getTargets(partialState);
    expect(partialTargets[0].isInstalled).toBe(true);
    expect(partialTargets[0].canUpgrade).toBe(true);

    partialFixture.cleanup();

    // Full: should be installed without upgrade
    fixture = useFixture("has-eslint-with-uilint-all-rules");
    const fullState = await analyze(fixture.path);

    const fullTargets = eslintInstaller!.getTargets(fullState);
    expect(fullTargets[0].isInstalled).toBe(true);
    expect(fullTargets[0].canUpgrade).toBe(false);
  });
});

// ============================================================================
// Overlay Detection Tests
// ============================================================================

describe("Overlay installation detection", () => {
  it("detects Next.js overlay as installed when uilint-react is in dependencies", async () => {
    fixture = useFixture("nextjs-with-uilint-overlay");
    const state = await analyze(fixture.path);

    // Should detect the Next.js app
    expect(state.nextApps).toHaveLength(1);

    // Should detect that overlay is already installed
    expect(state.nextApps[0].hasUilintOverlay).toBe(true);

    // Get the Next.js installer and its targets
    const installers = getAllInstallers();
    const nextInstaller = installers.find((i) => i.id === "next");
    expect(nextInstaller).toBeDefined();

    const targets = nextInstaller!.getTargets(state);
    expect(targets).toHaveLength(1);

    // The target should be marked as installed
    expect(targets[0].isInstalled).toBe(true);
  });

  it("detects Next.js overlay as NOT installed when uilint-react is missing", async () => {
    fixture = useFixture("fresh-nextjs-app");
    const state = await analyze(fixture.path);

    // Should detect the Next.js app
    expect(state.nextApps).toHaveLength(1);

    // Should detect that overlay is NOT installed
    expect(state.nextApps[0].hasUilintOverlay).toBe(false);

    // Get the Next.js installer and its targets
    const installers = getAllInstallers();
    const nextInstaller = installers.find((i) => i.id === "next");
    expect(nextInstaller).toBeDefined();

    const targets = nextInstaller!.getTargets(state);
    expect(targets).toHaveLength(1);

    // The target should NOT be marked as installed
    expect(targets[0].isInstalled).toBe(false);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("Uninstall error handling", () => {
  it("succeeds when files are already removed", async () => {
    fixture = useFixture("has-eslint-flat");
    const state = await analyze(fixture.path);

    // Build uninstall plan for non-existent installation
    const installers = getAllInstallers();
    const genstyleguideInstaller = installers.find(
      (i) => i.id === "genstyleguide"
    );

    const uninstallSelections: InstallerSelection[] = [
      {
        installer: genstyleguideInstaller!,
        targets: [
          {
            id: "genstyleguide",
            label: "/genstyleguide command",
            path: fixture.path,
            isInstalled: true, // Marked as installed but file doesn't exist
          },
        ],
        selected: true,
      },
    ];

    const uninstallActions = buildUninstallPlan(uninstallSelections, state);

    // Should succeed even though file doesn't exist
    const result = await execute(
      { actions: uninstallActions, dependencies: [] },
      { dryRun: false, installDependencies: mockInstallDependencies }
    );

    expect(result.success).toBe(true);
  });
});

/**
 * Integration tests for ESLint plugin installation
 *
 * These tests use real fixtures and run actual file operations
 * (with prompts and dependencies mocked).
 */

import { describe, it, expect, afterEach } from "vitest";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { mockPrompter } from "../helpers/prompts.js";
import { analyze } from "../../src/commands/install/analyze.js";
import { createPlan } from "../../src/commands/install/plan.js";
import { execute } from "../../src/commands/install/execute.js";
import { gatherChoices } from "../../src/commands/install/prompter.js";
import { ruleRegistry } from "uilint-eslint";
import type { InstallOptions } from "../../src/commands/install/types.js";

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

// ============================================================================
// Fresh ESLint Config Tests
// ============================================================================

describe("ESLint installation - fresh config", () => {
  it("injects uilint block into existing eslint.config.mjs", async () => {
    fixture = useFixture("has-eslint-flat");

    // Verify initial state
    const initialConfig = fixture.readFile("eslint.config.mjs");
    expect(initialConfig).not.toContain("uilint");

    // Run analyze
    const state = await analyze(fixture.path);
    expect(state.packages.length).toBeGreaterThan(0);

    const pkg = state.packages.find((p) => p.eslintConfigPath !== null);
    expect(pkg).toBeDefined();
    expect(pkg?.hasUilintRules).toBe(false);

    // Create choices
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg!.path],
      eslintRuleIds: ["no-arbitrary-tailwind", "consistent-spacing"],
    });

    const options: InstallOptions = {};
    const choices = await gatherChoices(state, options, prompter);

    // Create and execute plan
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    // Verify result
    expect(result.success).toBe(true);

    // Read updated config
    const updatedConfig = fixture.readFile("eslint.config.mjs");
    expect(updatedConfig).toContain('import uilint from "uilint-eslint"');
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).toContain("uilint/consistent-spacing");
    expect(updatedConfig).toContain("plugins: { uilint: uilint }");
  });

  it("injects uilint block into existing eslint.config.ts", async () => {
    fixture = useFixture("has-eslint-flat-ts");

    // Verify initial state
    const initialConfig = fixture.readFile("eslint.config.ts");
    expect(initialConfig).not.toContain("uilint");

    // Run analyze
    const state = await analyze(fixture.path);
    expect(state.packages.length).toBeGreaterThan(0);

    const pkg = state.packages.find((p) => p.eslintConfigPath !== null);
    expect(pkg).toBeDefined();
    expect(pkg?.eslintConfigPath).toContain("eslint.config.ts");
    expect(pkg?.hasUilintRules).toBe(false);

    // Create choices
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg!.path],
      eslintRuleIds: ["no-arbitrary-tailwind", "consistent-spacing"],
    });

    const choices = await gatherChoices(state, {}, prompter);

    // Create and execute plan
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    // Verify result
    expect(result.success).toBe(true);

    // Read updated config
    const updatedConfig = fixture.readFile("eslint.config.ts");
    expect(updatedConfig).toContain('import uilint from "uilint-eslint"');
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).toContain("uilint/consistent-spacing");
    expect(updatedConfig).toContain("plugins: { uilint: uilint }");
  });

  it("preserves comments and ignores commented-out uilint rule keys (spread rules config)", async () => {
    fixture = useFixture("has-eslint-flat-comments-spread");

    const initialConfig = fixture.readFile("eslint.config.mjs");
    expect(initialConfig).toContain("Keep this comment");
    expect(initialConfig).toContain('"uilint/no-arbitrary-tailwind"');

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;
    expect(pkg.hasUilintRules).toBe(false);

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["no-arbitrary-tailwind", "consistent-spacing"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    const updatedConfig = fixture.readFile("eslint.config.mjs");
    // Preserve comments
    expect(updatedConfig).toContain("Keep this comment");
    // And the commented-out rule remains commented (still present in file)
    expect(updatedConfig).toContain('"uilint/no-arbitrary-tailwind": "warn"');
    // But we also add actual configured rules in an appended uilint block
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).toContain("uilint/consistent-spacing");
    expect(updatedConfig).toContain('import uilint from "uilint-eslint"');
  });

  it("injects into CommonJS defineConfig([...]) config and adds require binding", async () => {
    fixture = useFixture("has-eslint-flat-cjs-define-config");

    const initialConfig = fixture.readFile("eslint.config.cjs");
    expect(initialConfig).not.toContain("uilint/no-arbitrary-tailwind");
    expect(initialConfig).toContain("Keep this comment");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;
    expect(pkg.hasUilintRules).toBe(false);

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["no-arbitrary-tailwind"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    const updatedConfig = fixture.readFile("eslint.config.cjs");
    expect(updatedConfig).toContain('const uilint = require("uilint-eslint")');
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).toContain("plugins: { uilint: uilint }");
    expect(updatedConfig).toContain("Keep this comment");
  });

  it("injects uilint block into defineConfig([...]) flat config (FlatCompat)", async () => {
    fixture = useFixture("has-eslint-flat-define-config");

    const initialConfig = fixture.readFile("eslint.config.mjs");
    expect(initialConfig).toContain("export default defineConfig");
    expect(initialConfig).not.toContain("uilint/no-arbitrary-tailwind");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null);
    expect(pkg).toBeDefined();
    expect(pkg?.hasUilintRules).toBe(false);

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg!.path],
      eslintRuleIds: ["no-arbitrary-tailwind", "consistent-spacing"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    const updatedConfig = fixture.readFile("eslint.config.mjs");
    expect(updatedConfig).toContain('import uilint from "uilint-eslint"');
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).toContain("uilint/consistent-spacing");
    expect(updatedConfig).toContain("plugins: { uilint: uilint }");
  });

  it("respects selected rules only", async () => {
    fixture = useFixture("has-eslint-flat");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["no-arbitrary-tailwind"], // Only one rule
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    const updatedConfig = fixture.readFile("eslint.config.mjs");
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).not.toContain("uilint/consistent-spacing");
    expect(updatedConfig).not.toContain("uilint/consistent-dark-mode");
  });

  it("is idempotent on subsequent installs", async () => {
    fixture = useFixture("has-eslint-flat-comments-spread");

    const state1 = await analyze(fixture.path);
    const pkg1 = state1.packages.find((p) => p.eslintConfigPath !== null)!;

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg1.path],
      eslintRuleIds: ["no-arbitrary-tailwind", "consistent-spacing"],
    });

    const choices1 = await gatherChoices(state1, {}, prompter);
    const plan1 = createPlan(state1, choices1);
    const result1 = await execute(plan1, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });
    expect(result1.success).toBe(true);

    const afterFirst = fixture.readFile("eslint.config.mjs");

    const state2 = await analyze(fixture.path);
    const pkg2 = state2.packages.find((p) => p.eslintConfigPath !== null)!;
    const choices2 = await gatherChoices(state2, {}, prompter);
    const plan2 = createPlan(state2, choices2);
    const result2 = await execute(plan2, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });
    expect(result2.success).toBe(true);

    const afterSecond = fixture.readFile("eslint.config.mjs");
    expect(afterSecond).toBe(afterFirst);
  });
});

// ============================================================================
// Existing UILint Rules Tests
// ============================================================================

describe("ESLint installation - existing uilint rules", () => {
  it("detects existing uilint rules in config", async () => {
    fixture = useFixture("has-eslint-with-uilint");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null);

    expect(pkg).toBeDefined();
    expect(pkg?.hasUilintRules).toBe(true);
    expect(pkg?.configuredRuleIds).toContain("no-arbitrary-tailwind");
  });

  it("adds missing rules to existing config", async () => {
    fixture = useFixture("has-eslint-with-uilint");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Select rules including one that's already configured
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: [
        "no-arbitrary-tailwind",
        "consistent-spacing",
        "consistent-dark-mode",
      ],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    // Verify plan marks existing rules correctly
    const eslintAction = plan.actions.find((a) => a.type === "inject_eslint");
    expect(eslintAction).toBeDefined();
    if (eslintAction?.type === "inject_eslint") {
      expect(eslintAction.hasExistingRules).toBe(true);
    }

    await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    const updatedConfig = fixture.readFile("eslint.config.mjs");
    // Should still have original rule
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    // Should have new rules added
    expect(updatedConfig).toContain("uilint/consistent-spacing");
    expect(updatedConfig).toContain("uilint/consistent-dark-mode");
  });
});

// ============================================================================
// Monorepo Tests
// ============================================================================

describe("ESLint installation - monorepo", () => {
  it("discovers multiple packages with ESLint configs", async () => {
    fixture = useFixture("monorepo-multi-app");

    const state = await analyze(fixture.path);

    // Should find all packages
    expect(state.packages.length).toBeGreaterThanOrEqual(3);

    // Filter to packages with ESLint config
    const packagesWithEslint = state.packages.filter(
      (p) => p.eslintConfigPath !== null
    );
    expect(packagesWithEslint.length).toBeGreaterThanOrEqual(2);

    // Should identify frontend packages
    const frontendPackages = packagesWithEslint.filter((p) => p.isFrontend);
    expect(frontendPackages.length).toBeGreaterThanOrEqual(2);
  });

  it("installs ESLint plugin to selected packages only", async () => {
    fixture = useFixture("monorepo-multi-app");

    const state = await analyze(fixture.path);
    const packagesWithEslint = state.packages.filter(
      (p) => p.eslintConfigPath !== null
    );

    // Select only the web app
    const webPkg = packagesWithEslint.find((p) => p.path.includes("web"));
    expect(webPkg).toBeDefined();

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [webPkg!.path],
      eslintRuleIds: ["no-arbitrary-tailwind"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    // Should only have one dependency install
    expect(plan.dependencies).toHaveLength(1);
    expect(plan.dependencies[0].packagePath).toBe(webPkg!.path);

    // Should only have one eslint action
    const eslintActions = plan.actions.filter(
      (a) => a.type === "inject_eslint"
    );
    expect(eslintActions).toHaveLength(1);
  });

  it("installs ESLint plugin to multiple packages", async () => {
    fixture = useFixture("monorepo-multi-app");

    const state = await analyze(fixture.path);
    const packagesWithEslint = state.packages.filter(
      (p) => p.eslintConfigPath !== null
    );

    // Select both web and admin
    const selectedPaths = packagesWithEslint
      .filter((p) => p.path.includes("apps/"))
      .map((p) => p.path);

    expect(selectedPaths.length).toBeGreaterThanOrEqual(2);

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: selectedPaths,
      eslintRuleIds: ["no-arbitrary-tailwind", "consistent-dark-mode"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    // Verify both configs were updated
    for (const pkgPath of selectedPaths) {
      const pkg = packagesWithEslint.find((p) => p.path === pkgPath)!;
      const relativePath = pkg.eslintConfigPath!.replace(
        fixture.path + "/",
        ""
      );
      const config = fixture.readFile(relativePath);
      expect(config).toContain("uilint");
    }
  });
});

// ============================================================================
// Rule Options Tests
// ============================================================================

describe("ESLint installation - rule options", () => {
  it("includes rule options in config", async () => {
    fixture = useFixture("has-eslint-flat");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Select consistent-spacing which has default options
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["consistent-spacing"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    const config = fixture.readFile("eslint.config.mjs");
    // Should include the scale option from defaultOptions
    expect(config).toContain("consistent-spacing");
    expect(config).toContain("scale");
  });

  it("handles no-mixed-component-libraries with preferred library", async () => {
    fixture = useFixture("has-eslint-flat");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["no-mixed-component-libraries"],
      customizeRuleOptions: true,
      ruleOptions: {
        "no-mixed-component-libraries": {
          preferred: "shadcn",
        },
      },
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    const config = fixture.readFile("eslint.config.mjs");
    expect(config).toContain("no-mixed-component-libraries");
    expect(config).toContain("preferred");
    expect(config).toContain("shadcn");
  });

  it("updates existing rule with new options", async () => {
    fixture = useFixture("has-eslint-with-uilint-options");

    // Verify initial state - rule exists without preferred option
    const initialConfig = fixture.readFile("eslint.config.mjs");
    expect(initialConfig).toContain("no-mixed-component-libraries");
    expect(initialConfig).toContain("libraries");
    expect(initialConfig).not.toContain("preferred");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Select the same rule but with new options (including preferred)
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["no-mixed-component-libraries"],
      customizeRuleOptions: true,
      ruleOptions: {
        "no-mixed-component-libraries": {
          preferred: "mui",
        },
      },
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    const updatedConfig = fixture.readFile("eslint.config.mjs");
    // Should still have the rule
    expect(updatedConfig).toContain("no-mixed-component-libraries");
    // Should now have preferred option
    expect(updatedConfig).toContain("preferred");
    expect(updatedConfig).toContain("mui");
    // Should still have libraries (merged with defaults)
    expect(updatedConfig).toContain("libraries");
  });
});

// ============================================================================
// Gitignore Tests
// ============================================================================

describe("ESLint installation - gitignore", () => {
  it("creates .gitignore entry only if file exists", async () => {
    fixture = useFixture("has-eslint-flat");

    // Create a .gitignore file
    const { writeFileSync } = await import("fs");
    const { join } = await import("path");
    writeFileSync(join(fixture.path, ".gitignore"), "node_modules/\n");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["no-arbitrary-tailwind"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    const gitignore = fixture.readFile(".gitignore");
    expect(gitignore).toContain(".uilint/.cache");
  });

  it("does not duplicate .uilint/.cache in gitignore", async () => {
    fixture = useFixture("has-eslint-flat");

    // Create a .gitignore that already has the entry
    const { writeFileSync } = await import("fs");
    const { join } = await import("path");
    writeFileSync(
      join(fixture.path, ".gitignore"),
      "node_modules/\n.uilint/.cache\n"
    );

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["no-arbitrary-tailwind"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    const gitignore = fixture.readFile(".gitignore");
    // Should only appear once
    const matches = gitignore.match(/\.uilint\/\.cache/g);
    expect(matches?.length).toBe(1);
  });
});

// ============================================================================
// Dry Run Tests
// ============================================================================

describe("ESLint installation - dry run", () => {
  it("does not modify files in dry run mode", async () => {
    fixture = useFixture("has-eslint-flat");

    const initialConfig = fixture.readFile("eslint.config.mjs");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["no-arbitrary-tailwind"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: true,
      installDependencies: mockInstallDependencies,
    });

    // Should report what would be done
    expect(result.actionsPerformed.length).toBeGreaterThan(0);
    for (const action of result.actionsPerformed) {
      expect(action.wouldDo).toBeDefined();
    }

    // File should be unchanged
    const finalConfig = fixture.readFile("eslint.config.mjs");
    expect(finalConfig).toBe(initialConfig);
  });

  it("skips dependency installation in dry run mode", async () => {
    fixture = useFixture("has-eslint-flat");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["no-arbitrary-tailwind"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    let depsInstalled = false;
    const result = await execute(plan, {
      dryRun: true,
      installDependencies: async () => {
        depsInstalled = true;
      },
    });

    expect(depsInstalled).toBe(false);
    expect(result.dependencyResults.every((r) => r.skipped)).toBe(true);
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("ESLint installation - error handling", () => {
  it("throws when no packages have ESLint config", async () => {
    fixture = useFixture("not-nextjs");

    const state = await analyze(fixture.path);
    const packagesWithEslint = state.packages.filter(
      (p) => p.eslintConfigPath !== null
    );
    expect(packagesWithEslint).toHaveLength(0);

    const prompter = mockPrompter({
      installItems: ["eslint"],
    });

    await expect(gatherChoices(state, {}, prompter)).rejects.toThrow(
      /No packages with eslint\.config/
    );
  });
});

// ============================================================================
// All Static Rules Test
// ============================================================================

describe("ESLint installation - all static rules", () => {
  it("can install all static rules at once", async () => {
    fixture = useFixture("has-eslint-flat");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Get all static rule IDs
    const staticRuleIds = ruleRegistry
      .filter((r) => r.category === "static")
      .map((r) => r.id);

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: staticRuleIds,
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    const config = fixture.readFile("eslint.config.mjs");
    for (const ruleId of staticRuleIds) {
      expect(config).toContain(`uilint/${ruleId}`);
    }
  });
});

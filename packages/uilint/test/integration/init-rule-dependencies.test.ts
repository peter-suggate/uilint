/**
 * Integration tests for ESLint rule installation with utility dependencies
 *
 * These tests verify that rules with internal utility dependencies
 * are correctly transformed when copied to the target project, and
 * that external plugin rules (like require-test-coverage from uilint-coverage)
 * are handled via package imports rather than local file copies.
 */

import { describe, it, expect, afterEach } from "vitest";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { mockPrompter } from "../helpers/prompts.js";
import { analyze } from "../../src/commands/init/analyze.js";
import { createPlan } from "../../src/commands/init/plan.js";
import { execute } from "../../src/commands/init/execute.js";
import { gatherChoices } from "../../src/commands/init/test-helpers.js";
import type { InstallOptions } from "../../src/commands/init/types.js";

// Load coverage plugin ESLint rules so require-test-coverage is in the registry
import "uilint-coverage/eslint-rules/register";

// ============================================================================
// Test Setup
// ============================================================================

let fixture: FixtureContext | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

// Mock dependency installer
const mockInstallDependencies = async () => {};

// ============================================================================
// Rule Dependency Transform Tests
// ============================================================================

describe("Rule installation - utility dependencies", () => {
  it("require-test-coverage is treated as external plugin rule (not copied locally)", async () => {
    fixture = useFixture("has-eslint-flat-ts");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["require-test-coverage"],
    });

    const options: InstallOptions = {};
    const choices = await gatherChoices(state, options, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // require-test-coverage is now an external plugin rule (eslintImport set)
    // It should NOT be copied to .uilint/rules/ — it's imported from the package
    expect(fixture.exists(".uilint/rules/require-test-coverage/index.ts")).toBe(
      false
    );
    expect(fixture.exists(".uilint/rules/require-test-coverage.ts")).toBe(
      false
    );
  });

  it("handles rules without utility dependencies (simple rules)", async () => {
    fixture = useFixture("has-eslint-flat-ts");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // prefer-tailwind has no utility dependencies beyond create-rule
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["prefer-tailwind"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);
    expect(fixture.exists(".uilint/rules/prefer-tailwind/index.ts")).toBe(true);

    const ruleContent = fixture.readFile(
      ".uilint/rules/prefer-tailwind/index.ts"
    );

    // Should import from uilint-eslint
    expect(ruleContent).toContain('from "uilint-eslint"');
    expect(ruleContent).toContain("createRule");
    expect(ruleContent).toContain("defineRuleMeta");

    // Should not have any relative utils imports
    expect(ruleContent).not.toContain("../utils/");
  });

  it("can install multiple rules with different structures (local and external)", async () => {
    fixture = useFixture("has-eslint-flat-ts");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Mix of rules: simple single-file local, directory-based local, and external plugin
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: [
        "prefer-tailwind", // Simple - single file (local)
        "require-test-coverage", // External plugin rule (uilint-coverage)
        "no-mixed-component-libraries", // Directory-based - colocated lib/ (local)
      ],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // Simple local rule should be a single file
    expect(fixture.exists(".uilint/rules/prefer-tailwind/index.ts")).toBe(true);

    // External plugin rule should NOT be copied locally
    expect(fixture.exists(".uilint/rules/require-test-coverage/index.ts")).toBe(
      false
    );
    expect(fixture.exists(".uilint/rules/require-test-coverage.ts")).toBe(
      false
    );

    // Directory-based local rule should be a directory with index.ts and lib/
    expect(
      fixture.exists(".uilint/rules/no-mixed-component-libraries/index.ts")
    ).toBe(true);
    expect(
      fixture.exists(".uilint/rules/no-mixed-component-libraries/lib")
    ).toBe(true);

    // Simple rule should import from uilint-eslint
    const tailwindContent = fixture.readFile(
      ".uilint/rules/prefer-tailwind/index.ts"
    );
    expect(tailwindContent).toContain('from "uilint-eslint"');
    expect(tailwindContent).not.toContain("../utils/");

    const mixedContent = fixture.readFile(
      ".uilint/rules/no-mixed-component-libraries/index.ts"
    );
    expect(mixedContent).toContain("./lib/import-graph");
    expect(mixedContent).toContain('from "uilint-eslint"');
  });
});

// ============================================================================
// ESLint Config Integration Tests
// ============================================================================

describe("Rule installation - config integration", () => {
  it("require-test-coverage rule is imported from uilint-coverage package in ESLint config", async () => {
    fixture = useFixture("has-eslint-flat-ts");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["require-test-coverage"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    const config = fixture.readFile("eslint.config.ts");

    // External plugin rule should be imported from its package (not local .uilint/rules/)
    expect(config).toMatch(
      /from\s+["']uilint-coverage\/eslint-rules\/require-test-coverage["']/
    );

    // Rule should be configured
    expect(config).toContain("uilint/require-test-coverage");

    // Plugin should be registered
    expect(config).toMatch(/plugins:\s*{\s*uilint:/);
  });
});

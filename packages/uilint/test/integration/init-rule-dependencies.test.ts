/**
 * Integration tests for ESLint rule installation with utility dependencies
 *
 * These tests verify that rules with internal utility dependencies
 * (like require-test-coverage which uses coverage-aggregator) are
 * correctly transformed when copied to the target project.
 */

import { describe, it, expect, afterEach } from "vitest";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { mockPrompter } from "../helpers/prompts.js";
import { analyze } from "../../src/commands/init/analyze.js";
import { createPlan } from "../../src/commands/init/plan.js";
import { execute } from "../../src/commands/init/execute.js";
import { gatherChoices } from "../../src/commands/init/test-helpers.js";
import type { InstallOptions } from "../../src/commands/init/types.js";

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
  it("installs require-test-coverage as directory-based rule in TypeScript projects", async () => {
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

    // require-test-coverage is a directory-based rule with colocated lib/ utilities
    // For TypeScript projects, it should be copied as a directory structure
    expect(fixture.exists(".uilint/rules/require-test-coverage/index.ts")).toBe(true);
    expect(fixture.exists(".uilint/rules/require-test-coverage/lib")).toBe(true);

    // Read the copied rule content
    const ruleContent = fixture.readFile(".uilint/rules/require-test-coverage/index.ts");

    // Directory-based rules have colocated utilities, so imports should be local ./lib/
    expect(ruleContent).toContain('./lib/coverage-aggregator');
    expect(ruleContent).toContain('./lib/jsx-coverage-analyzer');

    // Should import createRule and defineRuleMeta from uilint-eslint package
    expect(ruleContent).toContain('from "uilint-eslint"');
    expect(ruleContent).toContain("createRule");
    expect(ruleContent).toContain("defineRuleMeta");
  });

  it("transforms require-test-coverage rule for JavaScript projects", async () => {
    fixture = useFixture("has-eslint-flat-js");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["require-test-coverage"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // Verify .js rule was copied
    expect(fixture.exists(".uilint/rules/require-test-coverage.js")).toBe(true);
    expect(fixture.exists(".uilint/rules/require-test-coverage.ts")).toBe(false);

    // Read the copied rule content - JS files are pre-bundled so don't need transform check
    const ruleContent = fixture.readFile(".uilint/rules/require-test-coverage.js");

    // JS files should not have relative utils imports (bundled)
    expect(ruleContent).not.toContain('../utils/');
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
    expect(fixture.exists(".uilint/rules/prefer-tailwind.ts")).toBe(true);

    const ruleContent = fixture.readFile(".uilint/rules/prefer-tailwind.ts");

    // Should import from uilint-eslint
    expect(ruleContent).toContain('from "uilint-eslint"');
    expect(ruleContent).toContain("createRule");
    expect(ruleContent).toContain("defineRuleMeta");

    // Should not have any relative utils imports
    expect(ruleContent).not.toContain('../utils/');
  });

  it("can install multiple rules with different structures (single-file and directory-based)", async () => {
    fixture = useFixture("has-eslint-flat-ts");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Mix of rules: simple single-file and complex directory-based
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: [
        "prefer-tailwind",               // Simple - single file
        "require-test-coverage",         // Directory-based - colocated lib/
        "no-mixed-component-libraries",  // Directory-based - colocated lib/
      ],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // Simple rule should be a single file
    expect(fixture.exists(".uilint/rules/prefer-tailwind.ts")).toBe(true);

    // Directory-based rules should be directories with index.ts and lib/
    expect(fixture.exists(".uilint/rules/require-test-coverage/index.ts")).toBe(true);
    expect(fixture.exists(".uilint/rules/require-test-coverage/lib")).toBe(true);
    expect(fixture.exists(".uilint/rules/no-mixed-component-libraries/index.ts")).toBe(true);
    expect(fixture.exists(".uilint/rules/no-mixed-component-libraries/lib")).toBe(true);

    // Simple rule should import from uilint-eslint
    const tailwindContent = fixture.readFile(".uilint/rules/prefer-tailwind.ts");
    expect(tailwindContent).toContain('from "uilint-eslint"');
    expect(tailwindContent).not.toContain('../utils/');

    // Directory-based rules use colocated lib/ and import createRule from uilint-eslint
    const coverageContent = fixture.readFile(".uilint/rules/require-test-coverage/index.ts");
    expect(coverageContent).toContain('./lib/coverage-aggregator');
    expect(coverageContent).toContain('from "uilint-eslint"');

    const mixedContent = fixture.readFile(".uilint/rules/no-mixed-component-libraries/index.ts");
    expect(mixedContent).toContain('./lib/import-graph');
    expect(mixedContent).toContain('from "uilint-eslint"');
  });
});

// ============================================================================
// ESLint Config Integration Tests
// ============================================================================

describe("Rule installation - config integration", () => {
  it("require-test-coverage rule appears correctly in ESLint config with /index path", async () => {
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

    // Directory-based rule should be imported with /index path (TypeScript project)
    expect(config).toMatch(/from\s+["']\.\/\.uilint\/rules\/require-test-coverage\/index["']/);

    // Rule should be configured
    expect(config).toContain("uilint/require-test-coverage");

    // Plugin should be registered
    expect(config).toMatch(/plugins:\s*{\s*uilint:/);
  });
});

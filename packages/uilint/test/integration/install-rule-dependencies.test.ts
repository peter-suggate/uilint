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
import { analyze } from "../../src/commands/install/analyze.js";
import { createPlan } from "../../src/commands/install/plan.js";
import { execute } from "../../src/commands/install/execute.js";
import { gatherChoices } from "../../src/commands/install/test-helpers.js";
import type { InstallOptions } from "../../src/commands/install/types.js";

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
  it("transforms require-test-coverage rule imports from relative to uilint-eslint", async () => {
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

    // Verify rule was copied
    expect(fixture.exists(".uilint/rules/require-test-coverage.ts")).toBe(true);

    // Read the copied rule content
    const ruleContent = fixture.readFile(".uilint/rules/require-test-coverage.ts");

    // Verify imports were transformed to use uilint-eslint package
    // Should NOT have relative imports to ../utils/
    expect(ruleContent).not.toContain('from "../utils/coverage-aggregator.js"');
    expect(ruleContent).not.toContain('from "../utils/dependency-graph.js"');
    expect(ruleContent).not.toContain('from "../utils/file-categorizer.js"');
    expect(ruleContent).not.toContain('from "../utils/create-rule.js"');

    // Should have imports from uilint-eslint
    expect(ruleContent).toContain('from "uilint-eslint"');

    // Verify specific imports are present
    expect(ruleContent).toContain("createRule");
    expect(ruleContent).toContain("defineRuleMeta");
    expect(ruleContent).toContain("aggregateCoverage");
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

    // no-arbitrary-tailwind has no utility dependencies beyond create-rule
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
    expect(fixture.exists(".uilint/rules/no-arbitrary-tailwind.ts")).toBe(true);

    const ruleContent = fixture.readFile(".uilint/rules/no-arbitrary-tailwind.ts");

    // Should import from uilint-eslint
    expect(ruleContent).toContain('from "uilint-eslint"');
    expect(ruleContent).toContain("createRule");
    expect(ruleContent).toContain("defineRuleMeta");

    // Should not have any relative utils imports
    expect(ruleContent).not.toContain('../utils/');
  });

  it("can install multiple rules with different dependency requirements", async () => {
    fixture = useFixture("has-eslint-flat-ts");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Mix of rules: some with complex deps, some simple
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: [
        "no-arbitrary-tailwind",     // Simple - no extra utils
        "require-test-coverage",      // Complex - uses coverage-aggregator
        "no-mixed-component-libraries", // Medium - uses import-graph
      ],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // All rules should be copied
    expect(fixture.exists(".uilint/rules/no-arbitrary-tailwind.ts")).toBe(true);
    expect(fixture.exists(".uilint/rules/require-test-coverage.ts")).toBe(true);
    expect(fixture.exists(".uilint/rules/no-mixed-component-libraries.ts")).toBe(true);

    // Each rule should have proper imports
    const arbitraryContent = fixture.readFile(".uilint/rules/no-arbitrary-tailwind.ts");
    expect(arbitraryContent).toContain('from "uilint-eslint"');
    expect(arbitraryContent).not.toContain('../utils/');

    const coverageContent = fixture.readFile(".uilint/rules/require-test-coverage.ts");
    expect(coverageContent).toContain('from "uilint-eslint"');
    expect(coverageContent).not.toContain('../utils/');
    expect(coverageContent).toContain("aggregateCoverage");

    const mixedContent = fixture.readFile(".uilint/rules/no-mixed-component-libraries.ts");
    expect(mixedContent).toContain('from "uilint-eslint"');
    expect(mixedContent).not.toContain('../utils/');
  });
});

// ============================================================================
// ESLint Config Integration Tests
// ============================================================================

describe("Rule installation - config integration", () => {
  it("require-test-coverage rule appears correctly in ESLint config", async () => {
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

    // Rule should be imported
    expect(config).toMatch(/from\s+["']\.\/\.uilint\/rules\/require-test-coverage["']/);

    // Rule should be configured
    expect(config).toContain("uilint/require-test-coverage");

    // Plugin should be registered
    expect(config).toMatch(/plugins:\s*{\s*uilint:/);
  });
});

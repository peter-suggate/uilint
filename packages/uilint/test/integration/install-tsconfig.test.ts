/**
 * Integration tests for tsconfig.json exclusion injection
 *
 * When uilint installs ESLint rules to .uilint/rules/, we need to exclude
 * this directory from TypeScript compilation to prevent build errors.
 */

import { describe, it, expect, afterEach } from "vitest";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { mockPrompter } from "../helpers/prompts.js";
import { analyze } from "../../src/commands/install/analyze.js";
import { createPlan } from "../../src/commands/install/plan.js";
import { execute } from "../../src/commands/install/execute.js";
import { gatherChoices } from "../../src/commands/install/test-helpers.js";

// ============================================================================
// Test Setup
// ============================================================================

let fixture: FixtureContext | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

// Mock dependency installer
const mockInstallDependencies = async () => {
  // No-op
};

// ============================================================================
// tsconfig.json Exclusion Tests
// ============================================================================

describe("tsconfig.json exclusion injection", () => {
  it("adds .uilint to existing exclude array", async () => {
    fixture = useFixture("has-eslint-flat-ts-with-tsconfig");

    // Verify initial state
    const initialTsconfig = fixture.readJson("tsconfig.json") as {
      exclude?: string[];
    };
    expect(initialTsconfig.exclude).toEqual(["node_modules"]);
    expect(initialTsconfig.exclude).not.toContain(".uilint");

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
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // Verify tsconfig was updated
    const updatedTsconfig = fixture.readJson("tsconfig.json") as {
      exclude?: string[];
    };
    expect(updatedTsconfig.exclude).toContain("node_modules");
    expect(updatedTsconfig.exclude).toContain(".uilint");
  });

  it("creates exclude array if missing", async () => {
    fixture = useFixture("has-eslint-flat-ts-with-tsconfig");

    // Remove exclude from tsconfig
    const tsconfig = fixture.readJson("tsconfig.json") as {
      exclude?: string[];
      [key: string]: unknown;
    };
    delete tsconfig.exclude;
    fixture.writeJson("tsconfig.json", tsconfig);

    // Verify exclude is gone
    const modifiedTsconfig = fixture.readJson("tsconfig.json") as {
      exclude?: string[];
    };
    expect(modifiedTsconfig.exclude).toBeUndefined();

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
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    // Verify exclude array was created with .uilint
    const updatedTsconfig = fixture.readJson("tsconfig.json") as {
      exclude?: string[];
    };
    expect(updatedTsconfig.exclude).toEqual([".uilint"]);
  });

  it("skips if .uilint already in exclude (idempotent)", async () => {
    fixture = useFixture("has-eslint-flat-ts-with-tsconfig");

    // Add .uilint to exclude first
    const tsconfig = fixture.readJson("tsconfig.json") as {
      exclude?: string[];
      [key: string]: unknown;
    };
    tsconfig.exclude = ["node_modules", ".uilint"];
    fixture.writeJson("tsconfig.json", tsconfig);

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
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // Verify .uilint appears only once
    const updatedTsconfig = fixture.readJson("tsconfig.json") as {
      exclude?: string[];
    };
    const uilintCount = updatedTsconfig.exclude?.filter(
      (e) => e === ".uilint"
    ).length;
    expect(uilintCount).toBe(1);
  });

  it("succeeds if no tsconfig.json exists (soft failure)", async () => {
    fixture = useFixture("has-eslint-flat-js"); // JS-only project, no tsconfig

    // Verify no tsconfig
    expect(fixture.exists("tsconfig.json")).toBe(false);

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
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    // Install should still succeed
    expect(result.success).toBe(true);

    // Verify tsconfig was not created
    expect(fixture.exists("tsconfig.json")).toBe(false);
  });

  it("reports what would be done in dry run mode", async () => {
    fixture = useFixture("has-eslint-flat-ts-with-tsconfig");

    const initialTsconfig = fixture.readJson("tsconfig.json") as {
      exclude?: string[];
    };

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

    // Find the tsconfig action result
    const tsconfigAction = result.actionsPerformed.find(
      (r) => r.action.type === "inject_tsconfig"
    );
    expect(tsconfigAction).toBeDefined();
    expect(tsconfigAction?.wouldDo).toContain("tsconfig.json");
    expect(tsconfigAction?.wouldDo).toContain(".uilint");

    // Verify file was not modified
    const finalTsconfig = fixture.readJson("tsconfig.json") as {
      exclude?: string[];
    };
    expect(finalTsconfig.exclude).toEqual(initialTsconfig.exclude);
  });

  it("works in monorepo - each package gets tsconfig updated", async () => {
    fixture = useFixture("monorepo-multi-app");

    const state = await analyze(fixture.path);
    const packagesWithEslint = state.packages.filter(
      (p) => p.eslintConfigPath !== null
    );

    // Select multiple packages
    const selectedPaths = packagesWithEslint
      .filter((p) => p.path.includes("apps/"))
      .map((p) => p.path);

    expect(selectedPaths.length).toBeGreaterThanOrEqual(2);

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: selectedPaths,
      eslintRuleIds: ["no-arbitrary-tailwind"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    // Verify each package gets a tsconfig action
    const tsconfigActions = plan.actions.filter(
      (a) => a.type === "inject_tsconfig"
    );
    expect(tsconfigActions.length).toBe(selectedPaths.length);

    // Verify each action targets a different package
    const targetPaths = tsconfigActions.map((a) =>
      a.type === "inject_tsconfig" ? a.projectPath : ""
    );
    expect(new Set(targetPaths).size).toBe(selectedPaths.length);
  });
});

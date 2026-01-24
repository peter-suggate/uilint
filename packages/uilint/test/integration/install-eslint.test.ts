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
import { gatherChoices } from "../../src/commands/install/test-helpers.js";
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

// Rule file extension is based on ESLint config file extension (not project TypeScript status)
function ruleFileExt(pkg: { eslintConfigPath?: string | null }): ".ts" | ".js" {
  return pkg.eslintConfigPath?.endsWith(".ts") ? ".ts" : ".js";
}

// Import extension: TypeScript configs omit extension to avoid allowImportingTsExtensions requirement
function ruleImportExt(pkg: { eslintConfigPath?: string | null }): "" | ".js" {
  return pkg.eslintConfigPath?.endsWith(".ts") ? "" : ".js";
}

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
    const ext = ruleFileExt(pkg!);

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

    // Verify rules were copied to .uilint/rules/
    expect(fixture.exists(`.uilint/rules/no-arbitrary-tailwind${ext}`)).toBe(
      true
    );
    expect(fixture.exists(`.uilint/rules/consistent-spacing${ext}`)).toBe(true);

    // Read updated config
    const updatedConfig = fixture.readFile("eslint.config.mjs");
    expect(updatedConfig).toContain('from "uilint-eslint"');
    expect(updatedConfig).toMatch(
      new RegExp(
        `from\\s+["']\\.\\/\\.uilint\\/rules\\/no-arbitrary-tailwind\\${ext}["']`
      )
    );
    expect(updatedConfig).toMatch(
      new RegExp(
        `from\\s+["']\\.\\/\\.uilint\\/rules\\/consistent-spacing\\${ext}["']`
      )
    );
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).toContain("uilint/consistent-spacing");
    expect(updatedConfig).toMatch(/plugins:\s*{\s*uilint:/);
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
    const ext = ruleFileExt(pkg!);
    const importExt = ruleImportExt(pkg!);

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

    // Verify rules were copied to .uilint/rules/
    expect(fixture.exists(`.uilint/rules/no-arbitrary-tailwind${ext}`)).toBe(
      true
    );
    expect(fixture.exists(`.uilint/rules/consistent-spacing${ext}`)).toBe(true);

    // Read updated config
    const updatedConfig = fixture.readFile("eslint.config.ts");
    expect(updatedConfig).toContain('from "uilint-eslint"');
    // Note: TypeScript configs omit extension to avoid allowImportingTsExtensions requirement
    expect(updatedConfig).toMatch(
      new RegExp(
        `from\\s+["']\\.\\/\\.uilint\\/rules\\/no-arbitrary-tailwind${importExt}["']`
      )
    );
    expect(updatedConfig).toMatch(
      new RegExp(
        `from\\s+["']\\.\\/\\.uilint\\/rules\\/consistent-spacing${importExt}["']`
      )
    );
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).toContain("uilint/consistent-spacing");
    expect(updatedConfig).toMatch(/plugins:\s*{\s*uilint:/);
  });

  it("copies .test.ts file when selected rule has a test (TypeScript project)", async () => {
    fixture = useFixture("has-eslint-flat-ts");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;
    expect(pkg.isTypeScript).toBe(true);

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["consistent-dark-mode"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);
    expect(fixture.exists(".uilint/rules/consistent-dark-mode.ts")).toBe(true);
    expect(fixture.exists(".uilint/rules/consistent-dark-mode.test.ts")).toBe(
      true
    );
  });

  it("preserves comments and ignores commented-out uilint rule keys (spread rules config)", async () => {
    fixture = useFixture("has-eslint-flat-comments-spread");

    const initialConfig = fixture.readFile("eslint.config.mjs");
    expect(initialConfig).toContain("Keep this comment");
    expect(initialConfig).toContain('"uilint/no-arbitrary-tailwind"');

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;
    expect(pkg.hasUilintRules).toBe(false);
    const ext = ruleFileExt(pkg);

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

    // Verify rules were copied
    expect(fixture.exists(`.uilint/rules/no-arbitrary-tailwind${ext}`)).toBe(
      true
    );
    expect(fixture.exists(`.uilint/rules/consistent-spacing${ext}`)).toBe(true);

    const updatedConfig = fixture.readFile("eslint.config.mjs");
    // Preserve comments
    expect(updatedConfig).toContain("Keep this comment");
    // And the commented-out rule remains commented (still present in file)
    expect(updatedConfig).toContain('"uilint/no-arbitrary-tailwind": "warn"');
    // But we also add actual configured rules in an appended uilint block
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).toContain("uilint/consistent-spacing");
    expect(updatedConfig).toContain('from "uilint-eslint"');
    expect(updatedConfig).toContain("./.uilint/rules/");
  });

  it("injects into CommonJS defineConfig([...]) config and adds require binding", async () => {
    fixture = useFixture("has-eslint-flat-cjs-define-config");

    const initialConfig = fixture.readFile("eslint.config.cjs");
    expect(initialConfig).not.toContain("uilint/no-arbitrary-tailwind");
    expect(initialConfig).toContain("Keep this comment");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;
    expect(pkg.hasUilintRules).toBe(false);
    const ext = ruleFileExt(pkg);

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

    // Verify rules were copied
    expect(fixture.exists(`.uilint/rules/no-arbitrary-tailwind${ext}`)).toBe(
      true
    );

    const updatedConfig = fixture.readFile("eslint.config.cjs");
    expect(updatedConfig).toContain(
      'const { createRule } = require("uilint-eslint")'
    );
    expect(updatedConfig).toContain(
      `require("./.uilint/rules/no-arbitrary-tailwind${ext}")`
    );
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).toMatch(/plugins:\s*{\s*uilint:/);
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
    const ext = ruleFileExt(pkg!);

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

    // Verify rules were copied
    expect(fixture.exists(`.uilint/rules/no-arbitrary-tailwind${ext}`)).toBe(
      true
    );
    expect(fixture.exists(`.uilint/rules/consistent-spacing${ext}`)).toBe(true);

    const updatedConfig = fixture.readFile("eslint.config.mjs");
    expect(updatedConfig).toContain('from "uilint-eslint"');
    expect(updatedConfig).toMatch(
      new RegExp(
        `from\\s+["']\\.\\/\\.uilint\\/rules\\/no-arbitrary-tailwind\\${ext}["']`
      )
    );
    expect(updatedConfig).toMatch(
      new RegExp(
        `from\\s+["']\\.\\/\\.uilint\\/rules\\/consistent-spacing\\${ext}["']`
      )
    );
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).toContain("uilint/consistent-spacing");
    expect(updatedConfig).toMatch(/plugins:\s*{\s*uilint:/);
  });

  it("respects selected rules only", async () => {
    fixture = useFixture("has-eslint-flat");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;
    const ext = ruleFileExt(pkg);

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

    // Verify only selected rule was copied
    expect(fixture.exists(`.uilint/rules/no-arbitrary-tailwind${ext}`)).toBe(
      true
    );
    expect(fixture.exists(`.uilint/rules/consistent-spacing${ext}`)).toBe(
      false
    );

    const updatedConfig = fixture.readFile("eslint.config.mjs");
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).not.toContain("uilint/consistent-spacing");
    expect(updatedConfig).not.toContain("uilint/consistent-dark-mode");
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
    const ext = ruleFileExt(pkg);

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

    // Verify new rules were copied
    expect(fixture.exists(`.uilint/rules/consistent-spacing${ext}`)).toBe(true);
    expect(fixture.exists(`.uilint/rules/consistent-dark-mode${ext}`)).toBe(
      true
    );
    // Verify test file was copied only for TypeScript projects
    if (ext === ".ts") {
      expect(fixture.exists(".uilint/rules/consistent-dark-mode.test.ts")).toBe(
        true
      );
    }

    const updatedConfig = fixture.readFile("eslint.config.mjs");
    // Should still have original rule (from old config)
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    // Should have new rules added
    expect(updatedConfig).toContain("uilint/consistent-spacing");
    expect(updatedConfig).toContain("uilint/consistent-dark-mode");
  });

  it("does not create duplicate plugins sections when adding rules", async () => {
    fixture = useFixture("has-eslint-with-uilint");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Get initial config to verify structure
    const initialConfig = fixture.readFile("eslint.config.mjs");
    // Count how many times 'plugins:' appears in initial config
    const initialPluginsCount = (initialConfig.match(/plugins\s*:/g) || [])
      .length;

    // Select additional rules to add
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["consistent-spacing", "consistent-dark-mode"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    const updatedConfig = fixture.readFile("eslint.config.mjs");

    // Count plugins sections - should be the same as before (no duplicates)
    const updatedPluginsCount = (updatedConfig.match(/plugins\s*:/g) || [])
      .length;
    expect(updatedPluginsCount).toBe(initialPluginsCount);

    // Verify new rules were added to the existing config block
    expect(updatedConfig).toContain("uilint/consistent-spacing");
    expect(updatedConfig).toContain("uilint/consistent-dark-mode");

    // Verify the original rule is still there
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
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

    // Verify rules were copied to each package's .uilint/rules/ directory
    for (const pkgPath of selectedPaths) {
      const pkg = packagesWithEslint.find((p) => p.path === pkgPath)!;
      const pkgRelPath = pkgPath.replace(fixture.path + "/", "");
      const ext = ruleFileExt(pkg);

      // Check implementation files
      expect(
        fixture.exists(
          `${pkgRelPath}/.uilint/rules/no-arbitrary-tailwind${ext}`
        )
      ).toBe(true);
      expect(
        fixture.exists(`${pkgRelPath}/.uilint/rules/consistent-dark-mode${ext}`)
      ).toBe(true);

      // Check test file was copied only for TypeScript packages
      if (ext === ".ts") {
        expect(
          fixture.exists(
            `${pkgRelPath}/.uilint/rules/consistent-dark-mode.test.ts`
          )
        ).toBe(true);
      }

      // Verify config was updated
      const relativePath = pkg.eslintConfigPath!.replace(
        fixture.path + "/",
        ""
      );
      const config = fixture.readFile(relativePath);
      expect(config).toContain("uilint/");
      expect(config).toContain(".uilint/rules/");
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
    const ext = ruleFileExt(pkg);

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

    // Verify rule was copied
    expect(fixture.exists(`.uilint/rules/consistent-spacing${ext}`)).toBe(true);

    const config = fixture.readFile("eslint.config.mjs");
    // Should include the scale option from defaultOptions
    expect(config).toContain("uilint/consistent-spacing");
    expect(config).toContain("scale");
  });

  it("handles no-mixed-component-libraries with preferred library", async () => {
    fixture = useFixture("has-eslint-flat");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;
    const ext = ruleFileExt(pkg);

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

    // Verify rule was copied
    expect(
      fixture.exists(`.uilint/rules/no-mixed-component-libraries${ext}`)
    ).toBe(true);

    const config = fixture.readFile("eslint.config.mjs");
    expect(config).toContain("uilint/no-mixed-component-libraries");
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
    const ext = ruleFileExt(pkg);

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

    // Verify rule was copied
    expect(
      fixture.exists(`.uilint/rules/no-mixed-component-libraries${ext}`)
    ).toBe(true);

    const updatedConfig = fixture.readFile("eslint.config.mjs");
    // Should still have the rule
    expect(updatedConfig).toContain("uilint/no-mixed-component-libraries");
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
    const ext = ruleFileExt(pkg);

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

    // Verify all rules were copied
    for (const ruleId of staticRuleIds) {
      expect(fixture.exists(`.uilint/rules/${ruleId}${ext}`)).toBe(true);
    }

    const config = fixture.readFile("eslint.config.mjs");
    for (const ruleId of staticRuleIds) {
      expect(config).toContain(`uilint/${ruleId}`);
    }
  });
});

// ============================================================================
// JavaScript/TypeScript File Format Tests
// ============================================================================

describe("ESLint installation - JavaScript vs TypeScript file formats", () => {
  it("copies .js rule files for JavaScript-only projects", async () => {
    fixture = useFixture("has-eslint-flat-js");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null);
    expect(pkg).toBeDefined();
    expect(pkg?.isTypeScript).toBe(false);

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

    // Verify .js files were copied (not .ts)
    expect(fixture.exists(".uilint/rules/no-arbitrary-tailwind.js")).toBe(true);
    expect(fixture.exists(".uilint/rules/consistent-spacing.js")).toBe(true);
    expect(fixture.exists(".uilint/rules/no-arbitrary-tailwind.ts")).toBe(
      false
    );
    expect(fixture.exists(".uilint/rules/consistent-spacing.ts")).toBe(false);

    // Verify config imports .js files
    const updatedConfig = fixture.readFile("eslint.config.mjs");
    expect(updatedConfig).toMatch(
      /from\s+["']\.\/\.uilint\/rules\/no-arbitrary-tailwind\.js["']/
    );
    expect(updatedConfig).toMatch(
      /from\s+["']\.\/\.uilint\/rules\/consistent-spacing\.js["']/
    );
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).toContain("uilint/consistent-spacing");
  });

  it("copies .ts rule files for TypeScript projects", async () => {
    fixture = useFixture("has-eslint-flat-ts");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null);
    expect(pkg).toBeDefined();
    expect(pkg?.isTypeScript).toBe(true);

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

    // Verify .ts files were copied (not .js)
    expect(fixture.exists(".uilint/rules/no-arbitrary-tailwind.ts")).toBe(true);
    expect(fixture.exists(".uilint/rules/consistent-spacing.ts")).toBe(true);
    expect(fixture.exists(".uilint/rules/no-arbitrary-tailwind.js")).toBe(
      false
    );
    expect(fixture.exists(".uilint/rules/consistent-spacing.js")).toBe(false);

    // Verify config imports without .ts extension (to avoid allowImportingTsExtensions requirement)
    const updatedConfig = fixture.readFile("eslint.config.ts");
    expect(updatedConfig).toMatch(
      /from\s+["']\.\/\.uilint\/rules\/no-arbitrary-tailwind["']/
    );
    expect(updatedConfig).toMatch(
      /from\s+["']\.\/\.uilint\/rules\/consistent-spacing["']/
    );
    expect(updatedConfig).toContain("uilint/no-arbitrary-tailwind");
    expect(updatedConfig).toContain("uilint/consistent-spacing");
  });
});

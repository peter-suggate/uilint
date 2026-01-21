/**
 * End-to-end tests for ESLint rule execution
 *
 * These tests actually install dependencies and run ESLint to verify
 * that the installed rules load and execute correctly. They are slower
 * than unit/integration tests but catch real-world issues like:
 * - Missing chunk files
 * - Module resolution errors
 * - Runtime import failures
 *
 * Run with: pnpm test test/e2e/eslint-execution.test.ts
 */

import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { execSync } from "child_process";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { mockPrompter } from "../helpers/prompts.js";
import { analyze } from "../../src/commands/install/analyze.js";
import { createPlan } from "../../src/commands/install/plan.js";
import { execute } from "../../src/commands/install/execute.js";
import { gatherChoices } from "../../src/commands/install/test-helpers.js";

// ============================================================================
// Test Setup
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let fixture: FixtureContext | null = null;

// Get path to uilint-eslint dist directory for linking
// From: packages/uilint/test/e2e/ -> packages/uilint-eslint
const uilintEslintPath = join(
  __dirname,
  "..",
  "..",
  "..",
  "uilint-eslint"
);

beforeAll(() => {
  // Ensure uilint-eslint is built
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
 * Run a command and return stdout/stderr
 */
function runCommand(
  command: string,
  cwd: string
): { stdout: string; stderr: string; exitCode: number } {
  try {
    const stdout = execSync(command, {
      cwd,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 120000, // 2 minute timeout
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (error: unknown) {
    const execError = error as {
      stdout?: string;
      stderr?: string;
      status?: number;
    };
    return {
      stdout: execError.stdout || "",
      stderr: execError.stderr || "",
      exitCode: execError.status || 1,
    };
  }
}

/**
 * Install dependencies in the fixture using npm
 * Links uilint-eslint from the monorepo instead of installing from npm
 */
async function installDependencies(fixturePath: string): Promise<void> {
  // Create a minimal package.json if it doesn't have the right deps
  const pkgJsonPath = join(fixturePath, "package.json");
  const pkgJson = JSON.parse(
    existsSync(pkgJsonPath)
      ? readFileSync(pkgJsonPath, "utf-8")
      : "{}"
  );

  // Add required dependencies
  pkgJson.dependencies = pkgJson.dependencies || {};
  pkgJson.devDependencies = pkgJson.devDependencies || {};
  pkgJson.devDependencies["uilint-eslint"] = `file:${uilintEslintPath}`;
  pkgJson.devDependencies["typescript-eslint"] = "^8.0.0";
  pkgJson.devDependencies["@typescript-eslint/utils"] = "^8.0.0";
  pkgJson.devDependencies["eslint"] = "^9.0.0";
  // These are transitive dependencies of uilint-eslint rules that need to be
  // explicitly installed when using file: protocol (npm doesn't always resolve
  // nested deps correctly with file links)
  pkgJson.devDependencies["oxc-resolver"] = "^11.0.0";
  pkgJson.devDependencies["@typescript-eslint/typescript-estree"] = "^8.0.0";
  pkgJson.devDependencies["typescript"] = "^5.0.0";

  writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));

  // Install dependencies
  const result = runCommand("npm install --legacy-peer-deps", fixturePath);
  if (result.exitCode !== 0) {
    throw new Error(`npm install failed: ${result.stderr}`);
  }
}

// ============================================================================
// ESLint Execution Tests
// ============================================================================

describe("ESLint execution - JavaScript projects", { timeout: 180000 }, () => {
  it("runs ESLint successfully with installed .js rules", async () => {
    fixture = useFixture("has-eslint-flat-js");

    // Run analyze
    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null);
    expect(pkg).toBeDefined();

    // Create choices - select a simple rule
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg!.path],
      eslintRuleIds: ["no-arbitrary-tailwind"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    // Execute installation (without actually installing deps - we'll do that manually)
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: async () => {
        // Skip - we'll install manually below
      },
    });

    expect(result.success).toBe(true);

    // Verify .js rule file was created
    expect(fixture.exists(".uilint/rules/no-arbitrary-tailwind.js")).toBe(true);

    // Read the rule file to verify it doesn't have chunk imports
    const ruleContent = fixture.readFile(
      ".uilint/rules/no-arbitrary-tailwind.js"
    );
    expect(ruleContent).not.toContain("chunk-");
    expect(ruleContent).not.toContain("../chunk");

    // Install real dependencies
    await installDependencies(fixture.path);

    // Run ESLint - should not error with module not found
    const eslintResult = runCommand("npx eslint src/ --max-warnings=999", fixture.path);

    // Check for module resolution errors (the bug we're testing for)
    expect(eslintResult.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(eslintResult.stderr).not.toContain("Cannot find module");
    expect(eslintResult.stderr).not.toContain("chunk-");

    // ESLint should run without crashing (exit code 0 or 1 for lint errors is OK)
    // Exit code 2 means ESLint crashed
    expect(eslintResult.exitCode).not.toBe(2);
  });

  it("runs ESLint successfully with multiple .js rules", async () => {
    fixture = useFixture("has-eslint-flat-js");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Select multiple rules to test they all load correctly
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: [
        "no-arbitrary-tailwind",
        "consistent-spacing",
        "no-secrets-in-code",
      ],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    await execute(plan, {
      dryRun: false,
      installDependencies: async () => {},
    });

    // Verify all .js rule files were created
    expect(fixture.exists(".uilint/rules/no-arbitrary-tailwind.js")).toBe(true);
    expect(fixture.exists(".uilint/rules/consistent-spacing.js")).toBe(true);
    expect(fixture.exists(".uilint/rules/no-secrets-in-code.js")).toBe(true);

    // Install dependencies and run ESLint
    await installDependencies(fixture.path);
    const eslintResult = runCommand("npx eslint src/ --max-warnings=999", fixture.path);

    expect(eslintResult.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(eslintResult.stderr).not.toContain("Cannot find module");
    expect(eslintResult.exitCode).not.toBe(2);
  });
});

describe("ESLint execution - TypeScript projects", { timeout: 180000 }, () => {
  it("runs ESLint successfully with installed .ts rules", async () => {
    fixture = useFixture("has-eslint-flat-ts");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null);
    expect(pkg).toBeDefined();
    expect(pkg?.eslintConfigPath).toContain(".ts");

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg!.path],
      eslintRuleIds: ["no-arbitrary-tailwind"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    await execute(plan, {
      dryRun: false,
      installDependencies: async () => {},
    });

    // Verify .ts rule file was created
    expect(fixture.exists(".uilint/rules/no-arbitrary-tailwind.ts")).toBe(true);

    // Create a src directory with a sample file to lint (fixture doesn't have one)
    const { mkdirSync } = await import("fs");
    mkdirSync(join(fixture.path, "src"), { recursive: true });
    writeFileSync(
      join(fixture.path, "src", "App.tsx"),
      `export function App() { return <div>Hello</div>; }\n`
    );

    // Install dependencies
    await installDependencies(fixture.path);

    // Add typescript and jiti to devDependencies for TS config
    const pkgJsonPath = join(fixture.path, "package.json");
    const pkgJson = JSON.parse(
      readFileSync(pkgJsonPath, "utf-8")
    );
    pkgJson.devDependencies["typescript"] = "^5.0.0";
    pkgJson.devDependencies["jiti"] = "^2.0.0"; // Required for ESLint to load .ts configs
    writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
    runCommand("npm install --legacy-peer-deps", fixture.path);

    // Run ESLint
    const eslintResult = runCommand("npx eslint src/ --max-warnings=999", fixture.path);

    // The key test: no module resolution errors (the bug we're preventing)
    expect(eslintResult.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(eslintResult.stderr).not.toContain("Cannot find module");
    expect(eslintResult.stderr).not.toContain("chunk-");

    // Exit code 2 means ESLint crashed (config/module error)
    // Exit codes 0 or 1 are acceptable (no errors or lint errors)
    // If exit code is 2, make sure it's not a module resolution error
    if (eslintResult.exitCode === 2) {
      const isModuleError =
        eslintResult.stderr.includes("ERR_MODULE_NOT_FOUND") ||
        eslintResult.stderr.includes("Cannot find module") ||
        eslintResult.stderr.includes("chunk-");
      expect(isModuleError).toBe(false);
    }
  });
});

describe("ESLint execution - rule content validation", () => {
  it("bundled .js rules are self-contained without chunk imports", async () => {
    fixture = useFixture("has-eslint-flat-js");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Select all static rules
    const { ruleRegistry } = await import("uilint-eslint");
    const staticRuleIds = ruleRegistry
      .filter((r: { category: string }) => r.category === "static")
      .map((r: { id: string }) => r.id);

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: staticRuleIds,
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    await execute(plan, {
      dryRun: false,
      installDependencies: async () => {},
    });

    // Check each rule file for chunk imports
    for (const ruleId of staticRuleIds) {
      const rulePath = `.uilint/rules/${ruleId}.js`;
      expect(fixture.exists(rulePath)).toBe(true);

      const content = fixture.readFile(rulePath);

      // Should not have chunk imports
      expect(content).not.toMatch(/from\s+["']\.\.\/chunk-/);
      expect(content).not.toMatch(/from\s+["']\.\/chunk-/);
      expect(content).not.toContain("chunk-");

      // Should have proper imports from uilint-eslint or inline code
      // Either it imports from uilint-eslint or has createRule inlined
      const hasUilintEslintImport = content.includes('from "uilint-eslint"');
      const hasInlinedCreateRule = content.includes("ESLintUtils.RuleCreator");
      expect(hasUilintEslintImport || hasInlinedCreateRule).toBe(true);
    }
  });
});

// ============================================================================
// Directory-based Rules Tests
// ============================================================================

describe("ESLint execution - directory-based rules", { timeout: 180000 }, () => {
  it("installs and runs directory-based rules as bundled JS (no-mixed-component-libraries)", async () => {
    fixture = useFixture("has-eslint-flat-js");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Test a directory-based rule in a JS project
    // Note: For JS projects, directory-based rules are bundled into single .js files
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["no-mixed-component-libraries"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    await execute(plan, {
      dryRun: false,
      installDependencies: async () => {},
    });

    // For JS projects, directory-based rules are bundled into single .js files
    // (the bundler inlines all lib/ dependencies)
    expect(fixture.exists(".uilint/rules/no-mixed-component-libraries.js")).toBe(true);

    // Install dependencies and run ESLint
    await installDependencies(fixture.path);
    const eslintResult = runCommand("npx eslint src/ --max-warnings=999", fixture.path);

    // Check for module resolution errors
    expect(eslintResult.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(eslintResult.stderr).not.toContain("Cannot find module");
    expect(eslintResult.exitCode).not.toBe(2);
  });

  it("installs directory-based TypeScript rules correctly", async () => {
    fixture = useFixture("has-eslint-flat-ts");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["no-mixed-component-libraries", "require-test-coverage"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    await execute(plan, {
      dryRun: false,
      installDependencies: async () => {},
    });

    // Verify TypeScript directory structure for directory-based rules
    expect(fixture.exists(".uilint/rules/no-mixed-component-libraries/index.ts")).toBe(true);
    expect(fixture.exists(".uilint/rules/no-mixed-component-libraries/lib/import-graph.ts")).toBe(true);

    expect(fixture.exists(".uilint/rules/require-test-coverage/index.ts")).toBe(true);
    expect(fixture.exists(".uilint/rules/require-test-coverage/lib/coverage-aggregator.ts")).toBe(true);
    expect(fixture.exists(".uilint/rules/require-test-coverage/lib/dependency-graph.ts")).toBe(true);

    // Verify imports are transformed correctly
    const indexContent = fixture.readFile(".uilint/rules/no-mixed-component-libraries/index.ts");
    expect(indexContent).toContain('from "uilint-eslint"');
    expect(indexContent).not.toContain("../../utils/");
  });
});

// ============================================================================
// All Rules Installation Test
// ============================================================================

describe("ESLint execution - all rules", { timeout: 300000 }, () => {
  it("installs and runs ALL static rules successfully", async () => {
    fixture = useFixture("has-eslint-flat-js");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Get all static rules (both single-file and directory-based)
    const { ruleRegistry } = await import("uilint-eslint");
    const staticRuleIds = ruleRegistry
      .filter((r: { category: string }) => r.category === "static")
      .map((r: { id: string }) => r.id);

    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: staticRuleIds,
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    await execute(plan, {
      dryRun: false,
      installDependencies: async () => {},
    });

    // Verify all rules are installed
    for (const ruleId of staticRuleIds) {
      // Check for either single-file or directory-based rule
      const singleFilePath = `.uilint/rules/${ruleId}.js`;
      const directoryPath = `.uilint/rules/${ruleId}/index.js`;

      const exists = fixture.exists(singleFilePath) || fixture.exists(directoryPath);
      expect(exists).toBe(true);
    }

    // Install dependencies
    await installDependencies(fixture.path);

    // Run ESLint with all rules
    const eslintResult = runCommand("npx eslint src/ --max-warnings=999", fixture.path);

    // No module resolution errors
    expect(eslintResult.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(eslintResult.stderr).not.toContain("Cannot find module");
    expect(eslintResult.stderr).not.toContain("chunk-");

    // ESLint should not crash
    expect(eslintResult.exitCode).not.toBe(2);
  });

  it("ESLint config correctly imports all rules with .js extension in JS projects", async () => {
    fixture = useFixture("has-eslint-flat-js");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Install a mix of single-file and directory-based rules
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: [
        "no-arbitrary-tailwind",           // single-file
        "no-mixed-component-libraries",    // directory-based in source, but bundled to .js
        "consistent-spacing",              // single-file
      ],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    await execute(plan, {
      dryRun: false,
      installDependencies: async () => {},
    });

    // Read the ESLint config and verify import paths
    const configContent = fixture.readFile("eslint.config.mjs");

    // All rules in JS projects use single .js files (directory-based rules are bundled)
    expect(configContent).toMatch(/no-arbitrary-tailwind\.js/);
    expect(configContent).toMatch(/consistent-spacing\.js/);
    expect(configContent).toMatch(/no-mixed-component-libraries\.js/);

    // Should NOT have /index.js paths in JS projects
    expect(configContent).not.toMatch(/no-mixed-component-libraries\/index\.js/);
  });

  it("ESLint config correctly imports directory-based rules in TS projects", async () => {
    fixture = useFixture("has-eslint-flat-ts");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    // Install a mix of single-file and directory-based rules
    const prompter = mockPrompter({
      installItems: ["eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: [
        "no-arbitrary-tailwind",           // single-file
        "no-mixed-component-libraries",    // directory-based
        "consistent-spacing",              // single-file
      ],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    await execute(plan, {
      dryRun: false,
      installDependencies: async () => {},
    });

    // Read the ESLint config and verify import paths
    const configContent = fixture.readFile("eslint.config.ts");

    // In TS projects, imports don't include extensions (TypeScript resolver handles it)
    // Single-file rules use direct path without extension
    expect(configContent).toMatch(/rules\/no-arbitrary-tailwind[^\/]/);
    expect(configContent).toMatch(/rules\/consistent-spacing[^\/]/);

    // Directory-based rules use /index path (TypeScript needs explicit index reference)
    expect(configContent).toMatch(/rules\/no-mixed-component-libraries\/index[^\/]/);

    // Verify actual files were created as directories
    expect(fixture.exists(".uilint/rules/no-mixed-component-libraries/index.ts")).toBe(true);
    expect(fixture.exists(".uilint/rules/no-mixed-component-libraries/lib/import-graph.ts")).toBe(true);
  });
});

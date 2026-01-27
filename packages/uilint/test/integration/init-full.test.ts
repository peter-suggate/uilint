/**
 * Integration tests for full installation scenarios
 *
 * Tests end-to-end installation with all options.
 */

import { describe, it, expect, afterEach } from "vitest";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { mockPrompter } from "../helpers/prompts.js";
import { analyze } from "../../src/commands/init/analyze.js";
import { createPlan } from "../../src/commands/init/plan.js";
import { execute } from "../../src/commands/init/execute.js";
import { gatherChoices } from "../../src/commands/init/test-helpers.js";
import { ruleRegistry } from "uilint-eslint";

// ============================================================================
// Test Setup
// ============================================================================

let fixture: FixtureContext | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

const mockInstallDependencies = async () => {};

// ============================================================================
// Full Installation Tests
// ============================================================================

describe("Full installation", () => {
  it("installs genstyleguide command and skill together", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["genstyleguide", "skill"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // Verify all items installed
    expect(fixture.exists(".cursor/commands/genstyleguide.md")).toBe(true);
    expect(fixture.exists(".cursor/skills/ui-consistency-enforcer/SKILL.md")).toBe(true);
  });

  it("installs ESLint alongside genstyleguide", async () => {
    fixture = useFixture("has-eslint-flat");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    const prompter = mockPrompter({
      installItems: ["genstyleguide", "eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["prefer-tailwind"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // Verify all items installed
    expect(fixture.exists(".cursor/commands/genstyleguide.md")).toBe(true);

    const eslintConfig = fixture.readFile("eslint.config.mjs");
    expect(eslintConfig).toContain("uilint");
  });
});

// ============================================================================
// Command Tests
// ============================================================================

describe("Command installation", () => {
  it("creates genstyleguide command with proper content", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["genstyleguide"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    const content = fixture.readFile(".cursor/commands/genstyleguide.md");

    // Should have key sections
    expect(content).toContain("# React Style Guide Generator");
    expect(content).toContain("## Philosophy");
    expect(content).toContain("## Analysis Steps");
    expect(content).toContain("## Output Format");
    expect(content).toContain("styleguide.md");
  });

});

// ============================================================================
// CLI Flags Tests
// ============================================================================

describe("CLI flag handling", () => {
  it("uses --genstyleguide flag for non-interactive mode", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({}); // Shouldn't be called

    const choices = await gatherChoices(state, { genstyleguide: true }, prompter);

    expect(choices.items).toContain("genstyleguide");
  });
});

// ============================================================================
// Result Summary Tests
// ============================================================================

describe("Installation result summary", () => {
  it("summarizes files created", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["genstyleguide"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    expect(result.summary.filesCreated.length).toBeGreaterThan(0);
    expect(result.summary.filesCreated).toContainEqual(
      expect.stringContaining("genstyleguide.md")
    );
  });

  it("summarizes installed items", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["genstyleguide", "skill"],
    });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    expect(result.summary.installedItems).toContain("genstyleguide");
    expect(result.summary.installedItems).toContain("skill");
  });
});

// ============================================================================
// Idempotency Tests
// ============================================================================

describe("Installation idempotency", () => {
  it("can run installation twice without errors", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["genstyleguide"],
    });

    // First installation
    const choices1 = await gatherChoices(state, {}, prompter);
    const plan1 = createPlan(state, choices1);
    const result1 = await execute(plan1, {
      installDependencies: mockInstallDependencies,
    });
    expect(result1.success).toBe(true);

    // Second installation (re-analyze to see existing state)
    const state2 = await analyze(fixture.path);
    const prompter2 = mockPrompter({
      installItems: ["genstyleguide"],
    });

    const choices2 = await gatherChoices(state2, {}, prompter2);
    const plan2 = createPlan(state2, choices2);
    const result2 = await execute(plan2, {
      installDependencies: mockInstallDependencies,
    });
    expect(result2.success).toBe(true);

    // Verify command still exists
    expect(fixture.exists(".cursor/commands/genstyleguide.md")).toBe(true);
  });
});

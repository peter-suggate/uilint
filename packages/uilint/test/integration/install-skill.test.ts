/**
 * Integration tests for Agent Skill installation
 *
 * Tests the installation of the UI Consistency Enforcer skill
 * into .cursor/skills/ directory.
 */

import { describe, it, expect, afterEach } from "vitest";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { mockPrompter } from "../helpers/prompts.js";
import { analyze } from "../../src/commands/install/analyze.js";
import { createPlan } from "../../src/commands/install/plan.js";
import { execute } from "../../src/commands/install/execute.js";
import { gatherChoices } from "../../src/commands/install/prompter.js";

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
// Skill Installation Tests
// ============================================================================

describe("Agent Skill installation", () => {
  it("installs ui-consistency-enforcer skill with all files", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["skill"] });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // Verify skill directory structure
    expect(fixture.exists(".cursor/skills")).toBe(true);
    expect(fixture.exists(".cursor/skills/ui-consistency-enforcer")).toBe(true);
    expect(
      fixture.exists(".cursor/skills/ui-consistency-enforcer/SKILL.md")
    ).toBe(true);
    expect(
      fixture.exists(".cursor/skills/ui-consistency-enforcer/references")
    ).toBe(true);
    expect(
      fixture.exists(
        ".cursor/skills/ui-consistency-enforcer/references/RULE-TEMPLATE.ts"
      )
    ).toBe(true);
    expect(
      fixture.exists(
        ".cursor/skills/ui-consistency-enforcer/references/TEST-TEMPLATE.ts"
      )
    ).toBe(true);
    expect(
      fixture.exists(
        ".cursor/skills/ui-consistency-enforcer/references/REGISTRY-ENTRY.md"
      )
    ).toBe(true);
  });

  it("SKILL.md has valid Agent Skills frontmatter", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["skill"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    const skillContent = fixture.readFile(
      ".cursor/skills/ui-consistency-enforcer/SKILL.md"
    );

    // Verify frontmatter fields per Agent Skills spec
    expect(skillContent).toMatch(/^---\s*\n/); // Starts with frontmatter
    expect(skillContent).toContain("name: ui-consistency-enforcer");
    expect(skillContent).toContain("description:");
    expect(skillContent).toContain("license: MIT");
  });

  it("SKILL.md contains ESLint rule generation instructions", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["skill"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    const skillContent = fixture.readFile(
      ".cursor/skills/ui-consistency-enforcer/SKILL.md"
    );

    // Should have key sections for ESLint rule generation
    expect(skillContent).toContain("# UI Consistency Enforcer Skill");
    expect(skillContent).toContain("## When to Activate");
    expect(skillContent).toContain("## Step-by-Step Process");
    expect(skillContent).toContain("createRule");
    expect(skillContent).toContain("RuleTester");
    expect(skillContent).toContain("rule-registry.ts");
    expect(skillContent).toContain("packages/uilint-eslint");
  });

  it("RULE-TEMPLATE.ts is a valid TypeScript template", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["skill"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    const templateContent = fixture.readFile(
      ".cursor/skills/ui-consistency-enforcer/references/RULE-TEMPLATE.ts"
    );

    // Should have proper ESLint rule structure
    expect(templateContent).toContain(
      'import { createRule } from "../utils/create-rule.js"'
    );
    expect(templateContent).toContain('import type { TSESTree }');
    expect(templateContent).toContain("type MessageIds =");
    expect(templateContent).toContain("type Options =");
    expect(templateContent).toContain("export default createRule");
    expect(templateContent).toContain("create(context)");
  });

  it("TEST-TEMPLATE.ts has proper test structure", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["skill"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    const testContent = fixture.readFile(
      ".cursor/skills/ui-consistency-enforcer/references/TEST-TEMPLATE.ts"
    );

    // Should have proper test setup
    expect(testContent).toContain(
      'import { RuleTester } from "@typescript-eslint/rule-tester"'
    );
    expect(testContent).toContain('import { describe, it, afterAll');
    expect(testContent).toContain("RuleTester.afterAll = afterAll");
    expect(testContent).toContain("valid:");
    expect(testContent).toContain("invalid:");
    expect(testContent).toContain("errors:");
  });

  it("tracks skill in install result summary", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["skill"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    expect(result.summary.installedItems).toContain("skill");
    expect(result.summary.filesCreated).toContainEqual(
      expect.stringContaining("SKILL.md")
    );
  });
});

// ============================================================================
// Skill with Other Items Tests
// ============================================================================

describe("Skill installation with other items", () => {
  it("installs skill alongside MCP and hooks", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["mcp", "hooks", "skill"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // Verify all items installed
    expect(fixture.exists(".cursor/mcp.json")).toBe(true);
    expect(fixture.exists(".cursor/hooks.json")).toBe(true);
    expect(
      fixture.exists(".cursor/skills/ui-consistency-enforcer/SKILL.md")
    ).toBe(true);

    // Verify summary includes all items
    expect(result.summary.installedItems).toContain("mcp");
    expect(result.summary.installedItems).toContain("hooks");
    expect(result.summary.installedItems).toContain("skill");
  });

  it("installs skill with genstyleguide and genrules commands", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["genstyleguide", "genrules", "skill"],
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // Both commands and skill directory should exist
    expect(fixture.exists(".cursor/commands/genstyleguide.md")).toBe(true);
    expect(fixture.exists(".cursor/commands/genrules.md")).toBe(true);
    expect(fixture.exists(".cursor/skills/ui-consistency-enforcer")).toBe(true);
  });
});

// ============================================================================
// CLI Flag Tests
// ============================================================================

describe("Skill CLI flags", () => {
  it("uses --skill flag for non-interactive mode", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({});

    const choices = await gatherChoices(state, { skill: true }, prompter);

    expect(choices.items).toContain("skill");
    expect(choices.items).not.toContain("mcp");
    expect(choices.items).not.toContain("hooks");
  });

  it("combines --skill with other flags", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({});

    const choices = await gatherChoices(
      state,
      { skill: true, mcp: true, genstyleguide: true },
      prompter
    );

    expect(choices.items).toContain("skill");
    expect(choices.items).toContain("mcp");
    expect(choices.items).toContain("genstyleguide");
  });
});

// ============================================================================
// Idempotency Tests
// ============================================================================

describe("Skill installation idempotency", () => {
  it("can reinstall skill without errors", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["skill"] });

    // First installation
    const choices1 = await gatherChoices(state, {}, prompter);
    const plan1 = createPlan(state, choices1);
    const result1 = await execute(plan1, {
      installDependencies: mockInstallDependencies,
    });
    expect(result1.success).toBe(true);

    // Second installation
    const state2 = await analyze(fixture.path);
    const prompter2 = mockPrompter({ installItems: ["skill"] });
    const choices2 = await gatherChoices(state2, {}, prompter2);
    const plan2 = createPlan(state2, choices2);
    const result2 = await execute(plan2, {
      installDependencies: mockInstallDependencies,
    });
    expect(result2.success).toBe(true);

    // Verify skill is still there
    expect(
      fixture.exists(".cursor/skills/ui-consistency-enforcer/SKILL.md")
    ).toBe(true);
  });
});

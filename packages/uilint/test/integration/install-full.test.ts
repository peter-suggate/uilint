/**
 * Integration tests for full installation scenarios
 *
 * Tests end-to-end installation with all options.
 */

import { describe, it, expect, afterEach } from "vitest";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { mockPrompter } from "../helpers/prompts.js";
import { analyze } from "../../src/commands/install/analyze.js";
import { createPlan } from "../../src/commands/install/plan.js";
import { execute } from "../../src/commands/install/execute.js";
import { gatherChoices } from "../../src/commands/install/prompter.js";
import { ruleRegistry } from "uilint-eslint";
import type { HooksConfig, MCPConfig } from "../../src/commands/install/types.js";

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
  it("installs MCP, hooks, commands, and skill together", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["mcp", "hooks", "genstyleguide", "genrules", "skill"],
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
    expect(fixture.exists(".cursor/commands/genstyleguide.md")).toBe(true);
    expect(fixture.exists(".cursor/commands/genrules.md")).toBe(true);
    expect(fixture.exists(".cursor/hooks/uilint-session-start.sh")).toBe(true);
    expect(fixture.exists(".cursor/hooks/uilint-track.sh")).toBe(true);
    expect(fixture.exists(".cursor/hooks/uilint-session-end.sh")).toBe(true);
    expect(fixture.exists(".cursor/skills/ui-consistency-enforcer/SKILL.md")).toBe(true);

    // Verify configs are valid JSON
    const mcpConfig = fixture.readJson<MCPConfig>(".cursor/mcp.json");
    expect(mcpConfig.mcpServers.uilint).toBeDefined();

    const hooksConfig = fixture.readJson<HooksConfig>(".cursor/hooks.json");
    expect(hooksConfig.version).toBe(1);
  });

  it("installs ESLint alongside MCP and hooks", async () => {
    fixture = useFixture("has-eslint-flat");

    const state = await analyze(fixture.path);
    const pkg = state.packages.find((p) => p.eslintConfigPath !== null)!;

    const prompter = mockPrompter({
      installItems: ["mcp", "hooks", "eslint"],
      eslintPackagePaths: [pkg.path],
      eslintRuleIds: ["no-arbitrary-tailwind"],
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

  it("creates genrules command with proper content", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["genrules"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    const content = fixture.readFile(".cursor/commands/genrules.md");

    // Should have key sections
    expect(content).toContain("# ESLint Rule Generator");
    expect(content).toContain("## Purpose");
    expect(content).toContain("## Analysis Steps");
    expect(content).toContain("createRule");
  });
});

// ============================================================================
// CLI Flags Tests
// ============================================================================

describe("CLI flag handling", () => {
  it("uses --mcp flag for non-interactive mode", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({}); // Shouldn't be called

    const choices = await gatherChoices(state, { mcp: true }, prompter);

    expect(choices.items).toContain("mcp");
    expect(choices.items).not.toContain("hooks");
  });

  it("uses --hooks flag for non-interactive mode", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({});

    const choices = await gatherChoices(state, { hooks: true }, prompter);

    expect(choices.items).toContain("hooks");
    expect(choices.items).not.toContain("mcp");
  });

  it("uses --mode=both for MCP and hooks", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({});

    const choices = await gatherChoices(state, { mode: "both" }, prompter);

    expect(choices.items).toContain("mcp");
    expect(choices.items).toContain("hooks");
    expect(choices.items).toContain("genstyleguide"); // Default with mode
  });
});

// ============================================================================
// Result Summary Tests
// ============================================================================

describe("Installation result summary", () => {
  it("summarizes files created", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["mcp", "hooks"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    expect(result.summary.filesCreated.length).toBeGreaterThan(0);
    expect(result.summary.filesCreated).toContainEqual(
      expect.stringContaining("mcp.json")
    );
    expect(result.summary.filesCreated).toContainEqual(
      expect.stringContaining("hooks.json")
    );
  });

  it("summarizes installed items", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["mcp", "hooks", "genstyleguide"],
    });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    expect(result.summary.installedItems).toContain("mcp");
    expect(result.summary.installedItems).toContain("hooks");
    expect(result.summary.installedItems).toContain("genstyleguide");
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
      installItems: ["mcp", "hooks", "genstyleguide"],
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
      installItems: ["mcp", "hooks", "genstyleguide"],
      mcpMerge: true,
      hooksMerge: true,
    });

    const choices2 = await gatherChoices(state2, {}, prompter2);
    const plan2 = createPlan(state2, choices2);
    const result2 = await execute(plan2, {
      installDependencies: mockInstallDependencies,
    });
    expect(result2.success).toBe(true);

    // Verify everything still works
    const mcpConfig = fixture.readJson<MCPConfig>(".cursor/mcp.json");
    expect(mcpConfig.mcpServers.uilint).toBeDefined();
  });
});

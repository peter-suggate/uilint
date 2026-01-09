/**
 * Integration tests for MCP server installation
 *
 * Tests MCP configuration creation and merging scenarios.
 */

import { describe, it, expect, afterEach } from "vitest";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { mockPrompter } from "../helpers/prompts.js";
import { analyze } from "../../src/commands/install/analyze.js";
import { createPlan } from "../../src/commands/install/plan.js";
import { execute } from "../../src/commands/install/execute.js";
import { gatherChoices } from "../../src/commands/install/prompter.js";
import type { MCPConfig } from "../../src/commands/install/types.js";

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
// Fresh MCP Installation Tests
// ============================================================================

describe("MCP installation - fresh project", () => {
  it("creates .cursor directory and mcp.json", async () => {
    fixture = useFixture("fresh-nextjs-app");

    // Verify .cursor doesn't exist
    expect(fixture.exists(".cursor")).toBe(false);

    const state = await analyze(fixture.path);
    expect(state.mcp.exists).toBe(false);

    const prompter = mockPrompter({ installItems: ["mcp"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // Verify .cursor/mcp.json was created
    expect(fixture.exists(".cursor")).toBe(true);
    expect(fixture.exists(".cursor/mcp.json")).toBe(true);

    const mcpConfig = fixture.readJson<MCPConfig>(".cursor/mcp.json");
    expect(mcpConfig.mcpServers).toBeDefined();
    expect(mcpConfig.mcpServers.uilint).toBeDefined();
    expect(mcpConfig.mcpServers.uilint.command).toBe("npx");
    expect(mcpConfig.mcpServers.uilint.args).toContain("uilint-mcp");
  });
});

// ============================================================================
// Existing MCP Configuration Tests
// ============================================================================

describe("MCP installation - existing config", () => {
  it("detects existing mcp.json", async () => {
    fixture = useFixture("has-cursor-mcp");

    const state = await analyze(fixture.path);

    expect(state.mcp.exists).toBe(true);
    expect(state.mcp.config).toBeDefined();
    expect(state.mcp.config?.mcpServers["other-mcp"]).toBeDefined();
  });

  it("merges uilint into existing mcp.json when confirmed", async () => {
    fixture = useFixture("has-cursor-mcp");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["mcp"],
      mcpMerge: true,
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    const mcpConfig = fixture.readJson<MCPConfig>(".cursor/mcp.json");

    // Should have both existing and new server
    expect(mcpConfig.mcpServers["other-mcp"]).toBeDefined();
    expect(mcpConfig.mcpServers.uilint).toBeDefined();
    expect(mcpConfig.mcpServers.uilint.command).toBe("npx");
  });

  it("skips MCP installation when merge declined", async () => {
    fixture = useFixture("has-cursor-mcp");

    const originalConfig = fixture.readFile(".cursor/mcp.json");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["mcp"],
      mcpMerge: false,
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    // Config should be unchanged
    const finalConfig = fixture.readFile(".cursor/mcp.json");
    expect(finalConfig).toBe(originalConfig);
  });

  it("overwrites existing config with force option", async () => {
    fixture = useFixture("has-cursor-mcp");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["mcp"],
    });

    const choices = await gatherChoices(state, { force: true }, prompter);
    const plan = createPlan(state, choices, { force: true });
    await execute(plan, { installDependencies: mockInstallDependencies });

    const mcpConfig = fixture.readJson<MCPConfig>(".cursor/mcp.json");

    // Should only have uilint (force overwrites)
    expect(mcpConfig.mcpServers["other-mcp"]).toBeUndefined();
    expect(mcpConfig.mcpServers.uilint).toBeDefined();
  });
});

// ============================================================================
// MCP Configuration Validation Tests
// ============================================================================

describe("MCP installation - configuration validation", () => {
  it("creates valid MCP config structure", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["mcp"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    const mcpConfig = fixture.readJson<MCPConfig>(".cursor/mcp.json");

    // Validate structure
    expect(mcpConfig).toHaveProperty("mcpServers");
    expect(typeof mcpConfig.mcpServers).toBe("object");

    // Validate uilint server config
    const uilintServer = mcpConfig.mcpServers.uilint;
    expect(uilintServer).toHaveProperty("command");
    expect(uilintServer).toHaveProperty("args");
    expect(typeof uilintServer.command).toBe("string");
    expect(Array.isArray(uilintServer.args)).toBe(true);
  });

  it("mcp.json is valid JSON", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["mcp"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    const content = fixture.readFile(".cursor/mcp.json");

    // Should not throw
    expect(() => JSON.parse(content)).not.toThrow();

    // Should be pretty-printed (indented)
    expect(content).toContain("  ");
  });
});

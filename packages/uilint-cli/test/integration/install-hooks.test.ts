/**
 * Integration tests for Cursor hooks installation
 *
 * Tests hooks.json creation, merging, and legacy hook cleanup.
 */

import { describe, it, expect, afterEach } from "vitest";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { mockPrompter } from "../helpers/prompts.js";
import { analyze } from "../../src/commands/install/analyze.js";
import { createPlan } from "../../src/commands/install/plan.js";
import { execute } from "../../src/commands/install/execute.js";
import { gatherChoices } from "../../src/commands/install/prompter.js";
import type { HooksConfig } from "../../src/commands/install/types.js";

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
// Fresh Hooks Installation Tests
// ============================================================================

describe("Hooks installation - fresh project", () => {
  it("creates hooks.json and hook scripts", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    expect(state.hooks.exists).toBe(false);

    const prompter = mockPrompter({ installItems: ["hooks"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // Verify hooks.json
    expect(fixture.exists(".cursor/hooks.json")).toBe(true);
    const hooksConfig = fixture.readJson<HooksConfig>(".cursor/hooks.json");
    expect(hooksConfig.version).toBe(1);
    expect(hooksConfig.hooks.beforeSubmitPrompt).toBeDefined();
    expect(hooksConfig.hooks.afterFileEdit).toBeDefined();
    expect(hooksConfig.hooks.stop).toBeDefined();

    // Verify hook scripts exist
    expect(fixture.exists(".cursor/hooks/uilint-session-start.sh")).toBe(true);
    expect(fixture.exists(".cursor/hooks/uilint-track.sh")).toBe(true);
    expect(fixture.exists(".cursor/hooks/uilint-session-end.sh")).toBe(true);
  });

  it("creates hook scripts with executable permissions", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["hooks"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    // Check permissions (0o755 = 493 in decimal)
    const sessionStartMode = fixture.fileMode(".cursor/hooks/uilint-session-start.sh");
    const trackMode = fixture.fileMode(".cursor/hooks/uilint-track.sh");
    const sessionEndMode = fixture.fileMode(".cursor/hooks/uilint-session-end.sh");

    // Should be executable by owner (at least 0o100)
    expect(sessionStartMode & 0o100).toBe(0o100);
    expect(trackMode & 0o100).toBe(0o100);
    expect(sessionEndMode & 0o100).toBe(0o100);
  });

  it("hook scripts contain proper shebang and structure", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["hooks"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    const sessionStart = fixture.readFile(".cursor/hooks/uilint-session-start.sh");
    const track = fixture.readFile(".cursor/hooks/uilint-track.sh");
    const sessionEnd = fixture.readFile(".cursor/hooks/uilint-session-end.sh");

    // All should start with bash shebang
    expect(sessionStart.startsWith("#!/bin/bash")).toBe(true);
    expect(track.startsWith("#!/bin/bash")).toBe(true);
    expect(sessionEnd.startsWith("#!/bin/bash")).toBe(true);

    // All should use uilint CLI
    expect(sessionStart).toContain("uilint");
    expect(track).toContain("uilint");
    expect(sessionEnd).toContain("uilint");

    // Track should handle file_path
    expect(track).toContain("file_path");

    // Session end should handle loop_count
    expect(sessionEnd).toContain("loop_count");
  });
});

// ============================================================================
// Existing Hooks Configuration Tests
// ============================================================================

describe("Hooks installation - existing config", () => {
  it("detects existing hooks.json", async () => {
    fixture = useFixture("has-cursor-hooks");

    const state = await analyze(fixture.path);

    expect(state.hooks.exists).toBe(true);
    expect(state.hooks.config).toBeDefined();
    expect(state.hooks.config?.hooks.beforeSubmitPrompt).toBeDefined();
  });

  it("merges uilint hooks into existing config", async () => {
    fixture = useFixture("has-cursor-hooks");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["hooks"],
      hooksMerge: true,
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    const hooksConfig = fixture.readJson<HooksConfig>(".cursor/hooks.json");

    // Should have both existing and new hooks
    expect(hooksConfig.hooks.beforeSubmitPrompt).toHaveLength(2);
    expect(hooksConfig.hooks.beforeSubmitPrompt).toContainEqual({
      command: ".cursor/hooks/existing-hook.sh",
    });
    expect(hooksConfig.hooks.beforeSubmitPrompt).toContainEqual({
      command: ".cursor/hooks/uilint-session-start.sh",
    });

    // Should have new UILint hooks
    expect(hooksConfig.hooks.afterFileEdit).toBeDefined();
    expect(hooksConfig.hooks.stop).toBeDefined();
  });

  it("does not duplicate hooks when already present", async () => {
    fixture = useFixture("has-cursor-hooks");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["hooks"],
      hooksMerge: true,
    });

    // Run installation twice
    for (let i = 0; i < 2; i++) {
      const choices = await gatherChoices(state, {}, prompter);
      const plan = createPlan(state, choices);
      await execute(plan, { installDependencies: mockInstallDependencies });
    }

    const hooksConfig = fixture.readJson<HooksConfig>(".cursor/hooks.json");

    // Should still only have 2 beforeSubmitPrompt hooks (1 existing + 1 uilint)
    expect(hooksConfig.hooks.beforeSubmitPrompt).toHaveLength(2);
  });
});

// ============================================================================
// Legacy Hooks Cleanup Tests
// ============================================================================

describe("Hooks installation - legacy cleanup", () => {
  it("detects legacy uilint-validate.sh", async () => {
    fixture = useFixture("has-legacy-hooks");

    const state = await analyze(fixture.path);

    expect(state.hooks.hasLegacy).toBe(true);
    expect(state.hooks.legacyPaths).toHaveLength(1);
    expect(state.hooks.legacyPaths[0]).toContain("uilint-validate.sh");
  });

  it("removes legacy uilint-validate.sh during upgrade", async () => {
    fixture = useFixture("has-legacy-hooks");

    // Verify legacy file exists before
    expect(fixture.exists(".cursor/hooks/uilint-validate.sh")).toBe(true);

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["hooks"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    // Legacy file should be deleted
    expect(fixture.exists(".cursor/hooks/uilint-validate.sh")).toBe(false);

    // New hooks should exist
    expect(fixture.exists(".cursor/hooks/uilint-session-start.sh")).toBe(true);
    expect(fixture.exists(".cursor/hooks/uilint-track.sh")).toBe(true);
    expect(fixture.exists(".cursor/hooks/uilint-session-end.sh")).toBe(true);
  });

  it("removes legacy hook command from hooks.json", async () => {
    fixture = useFixture("has-legacy-hooks");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({
      installItems: ["hooks"],
      hooksMerge: true,
    });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    const hooksConfig = fixture.readJson<HooksConfig>(".cursor/hooks.json");

    // Should not contain legacy command
    for (const hookArray of Object.values(hooksConfig.hooks)) {
      if (Array.isArray(hookArray)) {
        for (const hook of hookArray) {
          expect(hook.command).not.toContain("uilint-validate.sh");
        }
      }
    }

    // Should have new UILint hooks
    expect(hooksConfig.hooks.afterFileEdit).toContainEqual({
      command: ".cursor/hooks/uilint-track.sh",
    });
  });
});

// ============================================================================
// Hooks Configuration Validation Tests
// ============================================================================

describe("Hooks installation - configuration validation", () => {
  it("hooks.json has correct structure", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["hooks"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    await execute(plan, { installDependencies: mockInstallDependencies });

    const hooksConfig = fixture.readJson<HooksConfig>(".cursor/hooks.json");

    // Validate structure
    expect(hooksConfig).toHaveProperty("version");
    expect(hooksConfig).toHaveProperty("hooks");
    expect(typeof hooksConfig.version).toBe("number");
    expect(typeof hooksConfig.hooks).toBe("object");

    // Validate hook arrays
    expect(Array.isArray(hooksConfig.hooks.beforeSubmitPrompt)).toBe(true);
    expect(Array.isArray(hooksConfig.hooks.afterFileEdit)).toBe(true);
    expect(Array.isArray(hooksConfig.hooks.stop)).toBe(true);

    // Validate hook commands point to correct scripts
    expect(hooksConfig.hooks.beforeSubmitPrompt?.[0]?.command).toBe(
      ".cursor/hooks/uilint-session-start.sh"
    );
    expect(hooksConfig.hooks.afterFileEdit?.[0]?.command).toBe(
      ".cursor/hooks/uilint-track.sh"
    );
    expect(hooksConfig.hooks.stop?.[0]?.command).toBe(
      ".cursor/hooks/uilint-session-end.sh"
    );
  });
});

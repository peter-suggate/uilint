/**
 * Integration tests for Next.js overlay installation
 *
 * Tests Next.js detection and overlay installation scenarios.
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
// Next.js Detection Tests
// ============================================================================

describe("Next.js detection", () => {
  it("detects Next.js App Router project", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);

    expect(state.nextApps).toHaveLength(1);
    expect(state.nextApps[0].detection.appRoot).toBe("app");
    expect(state.nextApps[0].detection.candidates).toContain("app/layout.tsx");
  });

  it("detects multiple Next.js apps in monorepo", async () => {
    fixture = useFixture("monorepo-multi-app");

    const state = await analyze(fixture.path);

    // Should find both apps/web and apps/admin
    const nextAppPaths = state.nextApps.map((a) => a.projectPath);
    expect(nextAppPaths.some((p) => p.includes("apps/web"))).toBe(true);
    expect(nextAppPaths.some((p) => p.includes("apps/admin"))).toBe(true);
  });

  it("does not detect Next.js in non-Next project", async () => {
    fixture = useFixture("not-nextjs");

    const state = await analyze(fixture.path);

    expect(state.nextApps).toHaveLength(0);
  });
});

// ============================================================================
// Next.js Overlay Planning Tests
// ============================================================================

describe("Next.js overlay planning", () => {
  it("plans Next.js routes installation", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const nextApp = state.nextApps[0];

    const prompter = mockPrompter({ installItems: ["next"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    // Should have install_next_routes action
    const routesAction = plan.actions.find((a) => a.type === "install_next_routes");
    expect(routesAction).toBeDefined();
    if (routesAction?.type === "install_next_routes") {
      expect(routesAction.projectPath).toBe(fixture.path);
      expect(routesAction.appRoot).toBe("app");
    }
  });

  it("plans React overlay injection", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["next"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    // Should have inject_react action
    const reactAction = plan.actions.find((a) => a.type === "inject_react");
    expect(reactAction).toBeDefined();
  });

  it("plans next.config injection", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["next"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    // Should have inject_next_config action
    const configAction = plan.actions.find((a) => a.type === "inject_next_config");
    expect(configAction).toBeDefined();
  });

  it("plans dependency installation", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["next"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    // Should plan to install uilint-react, uilint-core, jsx-loc-plugin
    expect(plan.dependencies).toContainEqual(
      expect.objectContaining({
        packages: expect.arrayContaining([
          "uilint-react",
          "uilint-core",
          "jsx-loc-plugin",
        ]),
      })
    );
  });
});

// ============================================================================
// Next.js App Selection Tests
// ============================================================================

describe("Next.js app selection in monorepo", () => {
  it("selects specific app from monorepo", async () => {
    fixture = useFixture("monorepo-multi-app");

    const state = await analyze(fixture.path);

    // Find the web app
    const webAppIndex = state.nextApps.findIndex((a) =>
      a.projectPath.includes("apps/web")
    );

    const prompter = mockPrompter({
      installItems: ["next"],
      nextAppIndex: webAppIndex,
    });

    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    // Should only install to the selected app
    const routesActions = plan.actions.filter((a) => a.type === "install_next_routes");
    expect(routesActions).toHaveLength(1);
    if (routesActions[0]?.type === "install_next_routes") {
      expect(routesActions[0].projectPath).toContain("apps/web");
    }
  });
});

// ============================================================================
// Error Handling Tests
// ============================================================================

describe("Next.js installation - error handling", () => {
  it("throws when no Next.js app found", async () => {
    fixture = useFixture("not-nextjs");

    const state = await analyze(fixture.path);
    expect(state.nextApps).toHaveLength(0);

    const prompter = mockPrompter({ installItems: ["next"] });

    await expect(gatherChoices(state, {}, prompter)).rejects.toThrow(
      /Could not find a Next\.js App Router/
    );
  });
});

// ============================================================================
// Dry Run Tests
// ============================================================================

describe("Next.js installation - dry run", () => {
  it("reports what would be done in dry run mode", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["next"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: true,
      installDependencies: mockInstallDependencies,
    });

    // Should have wouldDo messages
    const routesResult = result.actionsPerformed.find(
      (r) => r.action.type === "install_next_routes"
    );
    expect(routesResult?.wouldDo).toBeDefined();
    expect(routesResult?.wouldDo).toContain("Install Next.js API routes");
  });
});

// ============================================================================
// Execution Tests (file modifications)
// ============================================================================

describe("Next.js installation - execute", () => {
  it("injects uilint-devtools into app layout and wraps next.config export", async () => {
    fixture = useFixture("fresh-nextjs-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["next"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    const updatedLayout = fixture.readFile("app/layout.tsx");
    expect(updatedLayout).toContain('import "uilint-react/devtools"');
    expect(updatedLayout).toContain("<uilint-devtools");

    const updatedNextConfig = fixture.readFile("next.config.ts");
    expect(updatedNextConfig).toContain('from "jsx-loc-plugin"');
    expect(updatedNextConfig).toContain("withJsxLoc(");
  });

  it('keeps "use client" first and preserves comments (idempotent)', async () => {
    fixture = useFixture("nextjs-app-use-client");

    const state1 = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["next"] });
    const choices1 = await gatherChoices(state1, {}, prompter);
    const plan1 = createPlan(state1, choices1);

    const result1 = await execute(plan1, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });
    expect(result1.success).toBe(true);

    const afterFirstLayout = fixture.readFile("app/layout.tsx");
    const afterFirstNextConfig = fixture.readFile("next.config.ts");

    // "use client" should remain the very first statement.
    expect(afterFirstLayout.trimStart().startsWith('"use client";')).toBe(true);
    // Comments should remain.
    expect(afterFirstLayout).toContain("Preserve this comment too.");
    expect(afterFirstNextConfig).toContain("Preserve this comment.");

    // Run again (should be idempotent)
    const state2 = await analyze(fixture.path);
    const choices2 = await gatherChoices(state2, {}, prompter);
    const plan2 = createPlan(state2, choices2);
    const result2 = await execute(plan2, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });
    expect(result2.success).toBe(true);

    const afterSecondLayout = fixture.readFile("app/layout.tsx");
    const afterSecondNextConfig = fixture.readFile("next.config.ts");

    expect(afterSecondLayout).toBe(afterFirstLayout);
    expect(afterSecondNextConfig).toBe(afterFirstNextConfig);
  });
});

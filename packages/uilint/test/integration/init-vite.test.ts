/**
 * Integration tests for Vite overlay installation
 *
 * Tests Vite detection and overlay installation scenarios.
 */

import { describe, it, expect, afterEach } from "vitest";
import { useFixture, type FixtureContext } from "../helpers/fixtures.js";
import { mockPrompter } from "../helpers/prompts.js";
import { analyze } from "../../src/commands/init/analyze.js";
import { createPlan } from "../../src/commands/init/plan.js";
import { execute } from "../../src/commands/init/execute.js";
import { gatherChoices } from "../../src/commands/init/test-helpers.js";

let fixture: FixtureContext | null = null;

afterEach(() => {
  fixture?.cleanup();
  fixture = null;
});

const mockInstallDependencies = async () => {};

// ============================================================================
// Vite Detection Tests
// ============================================================================

describe("Vite detection", () => {
  it("detects Vite + React project", async () => {
    fixture = useFixture("fresh-vite-react-app");

    const state = await analyze(fixture.path);

    expect(state.viteApps).toHaveLength(1);
    expect(state.viteApps[0].detection.entryRoot).toBe("src");
    expect(state.viteApps[0].detection.configFile).toBe("vite.config.ts");
    expect(state.viteApps[0].detection.candidates).toContain("src/main.tsx");
  });

  it("does not detect Vite in non-React project", async () => {
    fixture = useFixture("not-nextjs");

    const state = await analyze(fixture.path);
    expect(state.viteApps).toHaveLength(0);
  });
});

// ============================================================================
// Vite Overlay Planning Tests
// ============================================================================

describe("Vite overlay planning", () => {
  it("plans React overlay injection and Vite config injection", async () => {
    fixture = useFixture("fresh-vite-react-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["vite"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    const reactAction = plan.actions.find((a) => a.type === "inject_react");
    expect(reactAction).toBeDefined();
    if (reactAction?.type === "inject_react") {
      expect(reactAction.mode).toBe("vite");
      expect(reactAction.appRoot).toBe("src");
    }

    const configAction = plan.actions.find((a) => a.type === "inject_vite_config");
    expect(configAction).toBeDefined();

    expect(plan.dependencies).toContainEqual(
      expect.objectContaining({
        packages: expect.arrayContaining(["uilint-react", "uilint-core", "jsx-loc-plugin"]),
      })
    );
  });

  it("plans tsconfig injection with devtools types", async () => {
    fixture = useFixture("fresh-vite-react-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["vite"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);

    const tsconfigAction = plan.actions.find((a) => a.type === "inject_tsconfig");
    expect(tsconfigAction).toBeDefined();
    if (tsconfigAction?.type === "inject_tsconfig") {
      expect(tsconfigAction.addDevtoolsTypes).toBe(true);
    }
  });
});

// ============================================================================
// Vite Installation - execute
// ============================================================================

describe("Vite installation - execute", () => {
  it("injects uilint-devtools into Vite entry and adds jsxLoc() to vite.config", async () => {
    fixture = useFixture("fresh-vite-react-app");

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["vite"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    const updatedMain = fixture.readFile("src/main.tsx");
    expect(updatedMain).toContain('import "uilint-react/devtools"');
    expect(updatedMain).toContain("<uilint-devtools");

    const updatedViteConfig = fixture.readFile("vite.config.ts");
    expect(updatedViteConfig).toContain('from "jsx-loc-plugin/vite"');
    expect(updatedViteConfig).toContain("jsxLoc(");
  });

  it("adds uilint-react/devtools to tsconfig.json types", async () => {
    fixture = useFixture("fresh-vite-react-app");

    // Verify initial tsconfig state
    const initialTsconfig = fixture.readJson("tsconfig.json") as {
      compilerOptions?: { types?: string[] };
    };
    expect(initialTsconfig.compilerOptions?.types).toBeUndefined();

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["vite"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    // Verify tsconfig was updated with devtools types
    const updatedTsconfig = fixture.readJson("tsconfig.json") as {
      compilerOptions: { types: string[] };
    };
    expect(updatedTsconfig.compilerOptions.types).toContain("uilint-react/devtools");
  });

  it("adds devtools types to existing types array", async () => {
    fixture = useFixture("fresh-vite-react-app");

    // Set up tsconfig with existing types
    const tsconfig = fixture.readJson("tsconfig.json") as {
      compilerOptions: Record<string, unknown>;
    };
    tsconfig.compilerOptions.types = ["node", "vite/client"];
    fixture.writeJson("tsconfig.json", tsconfig);

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["vite"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    const updatedTsconfig = fixture.readJson("tsconfig.json") as {
      compilerOptions: { types: string[] };
    };
    expect(updatedTsconfig.compilerOptions.types).toContain("node");
    expect(updatedTsconfig.compilerOptions.types).toContain("vite/client");
    expect(updatedTsconfig.compilerOptions.types).toContain("uilint-react/devtools");
  });

  it("skips adding devtools types if already present (idempotent)", async () => {
    fixture = useFixture("fresh-vite-react-app");

    // Set up tsconfig with devtools types already present
    const tsconfig = fixture.readJson("tsconfig.json") as {
      compilerOptions: Record<string, unknown>;
    };
    tsconfig.compilerOptions.types = ["uilint-react/devtools"];
    fixture.writeJson("tsconfig.json", tsconfig);

    const state = await analyze(fixture.path);
    const prompter = mockPrompter({ installItems: ["vite"] });
    const choices = await gatherChoices(state, {}, prompter);
    const plan = createPlan(state, choices);
    const result = await execute(plan, {
      dryRun: false,
      installDependencies: mockInstallDependencies,
    });

    expect(result.success).toBe(true);

    const updatedTsconfig = fixture.readJson("tsconfig.json") as {
      compilerOptions: { types: string[] };
    };
    // Should not have duplicates
    const devtoolsCount = updatedTsconfig.compilerOptions.types.filter(
      (t) => t === "uilint-react/devtools"
    ).length;
    expect(devtoolsCount).toBe(1);
  });
});

// ============================================================================
// Error Handling
// ============================================================================

describe("Vite installation - error handling", () => {
  it("throws when no Vite + React app found", async () => {
    fixture = useFixture("not-nextjs");

    const state = await analyze(fixture.path);
    expect(state.viteApps).toHaveLength(0);

    const prompter = mockPrompter({ installItems: ["vite"] });
    await expect(gatherChoices(state, {}, prompter)).rejects.toThrow(
      /Could not find a Vite \+ React project/
    );
  });
});

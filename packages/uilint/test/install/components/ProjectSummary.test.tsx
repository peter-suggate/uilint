/**
 * Tests for ProjectSummary component
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ProjectSummary } from "../../../src/commands/install/components/ProjectSummary.js";
import type { ProjectState } from "../../../src/commands/install/types.js";

// Helper to create mock state
function createMockState(
  overrides?: Partial<ProjectState>
): ProjectState {
  return {
    projectPath: "/test/project",
    workspaceRoot: "/test/workspace",
    packageManager: "npm",
    cursorDir: { exists: false, path: "/test/.cursor" },
    styleguide: { exists: false, path: "/test/.uilint/styleguide.md" },
    commands: { genstyleguide: false },
    nextApps: [],
    viteApps: [],
    packages: [],
    ...overrides,
  };
}

describe("ProjectSummary", () => {
  it("should render package manager", () => {
    const state = createMockState({ packageManager: "pnpm" });
    const { lastFrame } = render(<ProjectSummary state={state} />);

    expect(lastFrame()).toContain("Package Manager: pnpm");
  });

  it("should show Next.js apps when detected", () => {
    const state = createMockState({
      nextApps: [
        {
          projectPath: "/test/workspace/apps/web",
          detection: {
            appRoot: "app",
            appRootAbs: "/test/workspace/apps/web/app",
            candidates: [],
          },
        },
      ],
    });

    const { lastFrame } = render(<ProjectSummary state={state} />);

    expect(lastFrame()).toContain("Next.js Apps: 1 detected");
    expect(lastFrame()).toContain("apps/web");
    expect(lastFrame()).toContain("(app)");
  });

  it("should show multiple Next.js apps", () => {
    const state = createMockState({
      nextApps: [
        {
          projectPath: "/test/workspace/apps/web",
          detection: {
            appRoot: "app",
            appRootAbs: "/test/workspace/apps/web/app",
            candidates: [],
          },
        },
        {
          projectPath: "/test/workspace/apps/admin",
          detection: {
            appRoot: "src/app",
            appRootAbs: "/test/workspace/apps/admin/src/app",
            candidates: [],
          },
        },
      ],
    });

    const { lastFrame } = render(<ProjectSummary state={state} />);

    expect(lastFrame()).toContain("Next.js Apps: 2 detected");
    expect(lastFrame()).toContain("apps/web");
    expect(lastFrame()).toContain("apps/admin");
  });

  it("should show Vite apps when detected", () => {
    const state = createMockState({
      viteApps: [
        {
          projectPath: "/test/workspace/apps/app",
          detection: {
            entryRoot: "src",
            entryRootAbs: "/test/workspace/apps/app/src",
            candidates: [],
          },
        },
      ],
    });

    const { lastFrame } = render(<ProjectSummary state={state} />);

    expect(lastFrame()).toContain("Vite Apps: 1 detected");
    expect(lastFrame()).toContain("apps/app");
    expect(lastFrame()).toContain("(src)");
  });

  it("should show packages with ESLint config", () => {
    const state = createMockState({
      packages: [
        {
          path: "/test/workspace/packages/ui",
          name: "ui",
          version: "1.0.0",
          isTypeScript: true,
          dependencies: {},
          devDependencies: {},
          eslintConfigPath: "/test/workspace/packages/ui/eslint.config.mjs",
          eslintConfigFilename: "eslint.config.mjs",
          hasUilintRules: false,
          configuredRuleIds: [],
        },
        {
          path: "/test/workspace/packages/lib",
          name: "lib",
          version: "1.0.0",
          isTypeScript: true,
          dependencies: {},
          devDependencies: {},
          eslintConfigPath: "/test/workspace/packages/lib/eslint.config.mjs",
          eslintConfigFilename: "eslint.config.mjs",
          hasUilintRules: true,
          configuredRuleIds: ["consistent-spacing"],
        },
      ],
    });

    const { lastFrame } = render(<ProjectSummary state={state} />);

    expect(lastFrame()).toContain("ESLint Configs: 2 found");
    expect(lastFrame()).toContain("packages/ui");
    expect(lastFrame()).toContain("packages/lib");
    expect(lastFrame()).toContain("(has uilint)");
  });

  it("should show ... more for many packages", () => {
    const state = createMockState({
      packages: Array.from({ length: 5 }, (_, i) => ({
        path: `/test/workspace/packages/pkg${i}`,
        name: `pkg${i}`,
        version: "1.0.0",
        isTypeScript: true,
        dependencies: {},
        devDependencies: {},
        eslintConfigPath: `/test/workspace/packages/pkg${i}/eslint.config.mjs`,
        eslintConfigFilename: "eslint.config.mjs",
        hasUilintRules: false,
        configuredRuleIds: [],
      })),
    });

    const { lastFrame } = render(<ProjectSummary state={state} />);

    expect(lastFrame()).toContain("ESLint Configs: 5 found");
    expect(lastFrame()).toContain("... and 2 more");
  });

  it("should show styleguide when exists", () => {
    const state = createMockState({
      styleguide: { exists: true, path: "/test/.uilint/styleguide.md" },
    });

    const { lastFrame } = render(<ProjectSummary state={state} />);

    expect(lastFrame()).toContain("Styleguide: Found");
  });

  it("should show cursor commands when installed", () => {
    const state = createMockState({
      commands: { genstyleguide: true },
    });

    const { lastFrame } = render(<ProjectSummary state={state} />);

    expect(lastFrame()).toContain("Cursor Commands: genstyleguide installed");
  });

  it("should render bordered box", () => {
    const state = createMockState();
    const { lastFrame } = render(<ProjectSummary state={state} />);

    expect(lastFrame()).toContain("Project Detected");
  });

  it("should show minimal state for fresh project", () => {
    const state = createMockState();
    const { lastFrame } = render(<ProjectSummary state={state} />);

    expect(lastFrame()).toContain("Package Manager: npm");
    expect(lastFrame()).not.toContain("Next.js Apps");
    expect(lastFrame()).not.toContain("Vite Apps");
    expect(lastFrame()).not.toContain("ESLint Configs");
  });
});

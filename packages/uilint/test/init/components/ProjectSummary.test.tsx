/**
 * Tests for ProjectSummary component
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ProjectSummary } from "../../../src/commands/init/components/ProjectSummary.js";
import type { ProjectState } from "../../../src/commands/init/types.js";

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
    const project = createMockState({ packageManager: "pnpm" });
    const { lastFrame } = render(<ProjectSummary project={project} />);

    expect(lastFrame()).toContain("Package Manager: pnpm");
  });

  it("should show Next.js apps when detected", () => {
    const project = createMockState({
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

    const { lastFrame } = render(<ProjectSummary project={project} />);

    expect(lastFrame()).toContain("Next.js Apps");
    expect(lastFrame()).toContain("web");
  });

  it("should show multiple Next.js apps", () => {
    const project = createMockState({
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

    const { lastFrame } = render(<ProjectSummary project={project} />);

    expect(lastFrame()).toContain("Next.js Apps");
    expect(lastFrame()).toContain("web");
    expect(lastFrame()).toContain("admin");
  });

  it("should show Vite apps when detected", () => {
    const project = createMockState({
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

    const { lastFrame } = render(<ProjectSummary project={project} />);

    expect(lastFrame()).toContain("Vite Apps");
    expect(lastFrame()).toContain("app");
  });

  it("should show packages with ESLint config", () => {
    const project = createMockState({
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

    const { lastFrame } = render(<ProjectSummary project={project} />);

    expect(lastFrame()).toContain("ESLint Configs");
    expect(lastFrame()).toContain("ui");
    expect(lastFrame()).toContain("lib");
  });

  it("should show styleguide when exists", () => {
    const project = createMockState({
      styleguide: { exists: true, path: "/test/.uilint/styleguide.md" },
    });

    const { lastFrame } = render(<ProjectSummary project={project} />);

    expect(lastFrame()).toContain("Already Installed");
    expect(lastFrame()).toContain("styleguide.md");
  });

  it("should show cursor commands when installed", () => {
    const project = createMockState({
      commands: { genstyleguide: true },
    });

    const { lastFrame } = render(<ProjectSummary project={project} />);

    expect(lastFrame()).toContain("Already Installed");
    expect(lastFrame()).toContain("genstyleguide");
  });

  it("should render the title", () => {
    const project = createMockState();
    const { lastFrame } = render(<ProjectSummary project={project} />);

    expect(lastFrame()).toContain("Your Project");
  });

  it("should show minimal state for fresh project", () => {
    const project = createMockState();
    const { lastFrame } = render(<ProjectSummary project={project} />);

    expect(lastFrame()).toContain("Package Manager: npm");
    expect(lastFrame()).not.toContain("Next.js Apps");
    expect(lastFrame()).not.toContain("Vite Apps");
    expect(lastFrame()).not.toContain("ESLint Configs");
  });
});

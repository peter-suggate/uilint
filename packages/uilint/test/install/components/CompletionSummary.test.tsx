/**
 * Tests for CompletionSummary component
 */

import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { CompletionSummary } from "../../../src/commands/install/components/CompletionSummary.js";
import type { InstallResult } from "../../../src/commands/install/types.js";

// Helper to create mock result
function createMockResult(
  overrides?: Partial<InstallResult>
): InstallResult {
  return {
    success: true,
    actionsPerformed: [],
    dependencyResults: [],
    summary: {
      installedItems: [],
      filesCreated: [],
      filesModified: [],
      filesDeleted: [],
      dependenciesInstalled: [],
      eslintTargets: [],
    },
    ...overrides,
  };
}

describe("CompletionSummary", () => {
  it("should show success message for successful installation", () => {
    const result = createMockResult({ success: true });
    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("✓");
    expect(lastFrame()).toContain("Installation completed successfully!");
  });

  it("should show warning message for failed installation", () => {
    const result = createMockResult({ success: false });
    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("⚠");
    expect(lastFrame()).toContain("Installation completed with some errors");
  });

  it("should show installed items count", () => {
    const result = createMockResult({
      summary: {
        installedItems: ["eslint", "next"],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [],
        eslintTargets: [],
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("2 feature(s) installed");
  });

  it("should show files affected count", () => {
    const result = createMockResult({
      summary: {
        installedItems: ["eslint"],
        filesCreated: ["/test/file1.ts", "/test/file2.ts"],
        filesModified: ["/test/file3.ts"],
        filesDeleted: [],
        dependenciesInstalled: [],
        eslintTargets: [],
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("3 file(s) affected");
  });

  it("should show packages installed count", () => {
    const result = createMockResult({
      summary: {
        installedItems: ["eslint"],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [
          { packagePath: "/test", packages: ["pkg1", "pkg2", "pkg3"] },
        ],
        eslintTargets: [],
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("3 package(s) installed");
  });

  it("should show genstyleguide feature", () => {
    const result = createMockResult({
      summary: {
        installedItems: ["genstyleguide"],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [],
        eslintTargets: [],
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("Cursor Command: genstyleguide");
  });

  it("should show skill feature", () => {
    const result = createMockResult({
      summary: {
        installedItems: ["skill"],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [],
        eslintTargets: [],
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("UI Consistency Agent Skill");
  });

  it("should show Next.js overlay feature", () => {
    const result = createMockResult({
      summary: {
        installedItems: ["next"],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [],
        eslintTargets: [],
        nextApp: { appRoot: "app" },
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("Next.js Overlay");
    expect(lastFrame()).toContain("(app)");
  });

  it("should show Vite overlay feature", () => {
    const result = createMockResult({
      summary: {
        installedItems: ["vite"],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [],
        eslintTargets: [],
        viteApp: { entryRoot: "src" },
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("Vite Overlay");
    expect(lastFrame()).toContain("(src)");
  });

  it("should show ESLint plugin feature with config count", () => {
    const result = createMockResult({
      summary: {
        installedItems: ["eslint"],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [],
        eslintTargets: [
          { displayName: "app1", configFile: "/app1/eslint.config.mjs" },
          { displayName: "app2", configFile: "/app2/eslint.config.mjs" },
        ],
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("ESLint Plugin (2 config(s))");
  });

  it("should show next steps for genstyleguide", () => {
    const result = createMockResult({
      summary: {
        installedItems: ["genstyleguide"],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [],
        eslintTargets: [],
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("Next Steps:");
    expect(lastFrame()).toContain("Restart Cursor");
  });

  it("should show next steps for Next.js/Vite overlay", () => {
    const result = createMockResult({
      summary: {
        installedItems: ["next"],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [],
        eslintTargets: [],
        nextApp: { appRoot: "app" },
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("Alt+Click to inspect elements");
  });

  it("should show next steps for ESLint", () => {
    const result = createMockResult({
      summary: {
        installedItems: ["eslint"],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [],
        eslintTargets: [
          { displayName: "app", configFile: "/app/eslint.config.mjs" },
        ],
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("Run ESLint");
    expect(lastFrame()).toContain("uilint serve");
  });

  it("should show error warning for failed installation", () => {
    const result = createMockResult({ success: false });
    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("Some operations failed");
  });

  it("should not show error warning for successful installation", () => {
    const result = createMockResult({ success: true });
    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).not.toContain("Some operations failed");
  });

  it("should show multiple features", () => {
    const result = createMockResult({
      summary: {
        installedItems: ["genstyleguide", "skill", "eslint", "next"],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [],
        eslintTargets: [
          { displayName: "app", configFile: "/app/eslint.config.mjs" },
        ],
        nextApp: { appRoot: "app" },
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("Cursor Command: genstyleguide");
    expect(lastFrame()).toContain("UI Consistency Agent Skill");
    expect(lastFrame()).toContain("ESLint Plugin");
    expect(lastFrame()).toContain("Next.js Overlay");
  });

  it("should handle zero installed items", () => {
    const result = createMockResult({
      summary: {
        installedItems: [],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [],
        eslintTargets: [],
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("0 feature(s) installed");
  });

  it("should count packages across multiple dependency installs", () => {
    const result = createMockResult({
      summary: {
        installedItems: ["eslint", "next"],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
        dependenciesInstalled: [
          { packagePath: "/app1", packages: ["pkg1", "pkg2"] },
          { packagePath: "/app2", packages: ["pkg3"] },
        ],
        eslintTargets: [],
      },
    });

    const { lastFrame } = render(<CompletionSummary result={result} />);

    expect(lastFrame()).toContain("3 package(s) installed");
  });
});

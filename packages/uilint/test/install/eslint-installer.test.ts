/**
 * Tests for ESLint installer
 */

import { describe, it, expect } from "vitest";
import { eslintInstaller } from "../../src/commands/install/installers/eslint.js";
import type { ProjectState, EslintPackageInfo } from "../../src/commands/install/types.js";
import type { ProgressEvent } from "../../src/commands/install/installers/types.js";

// Helper to create mock project state
function createMockState(overrides?: Partial<ProjectState>): ProjectState {
  return {
    projectPath: "/test/project",
    workspaceRoot: "/test",
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

// Helper to create mock package info
function createMockPackage(overrides?: Partial<EslintPackageInfo>): EslintPackageInfo {
  return {
    path: "/test/project/packages/app",
    displayPath: "packages/app",
    name: "test-app",
    hasEslintConfig: true,
    isFrontend: true,
    isRoot: false,
    isTypeScript: true,
    eslintConfigPath: "/test/project/packages/app/eslint.config.mjs",
    eslintConfigFilename: "eslint.config.mjs",
    hasUilintRules: false,
    configuredRuleIds: [],
    ...overrides,
  };
}

describe("EslintInstaller", () => {
  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(eslintInstaller.id).toBe("eslint");
      expect(eslintInstaller.name).toBe("ESLint plugin");
      expect(eslintInstaller.icon).toBe("🔍");
    });
  });

  describe("isApplicable", () => {
    it("should return false when no packages have ESLint config", () => {
      const state = createMockState({
        packages: [
          createMockPackage({
            eslintConfigPath: null,
            eslintConfigFilename: null,
          }),
        ],
      });

      expect(eslintInstaller.isApplicable(state)).toBe(false);
    });

    it("should return true when at least one package has ESLint config", () => {
      const state = createMockState({
        packages: [
          createMockPackage({
            eslintConfigPath: "/test/project/eslint.config.mjs",
          }),
        ],
      });

      expect(eslintInstaller.isApplicable(state)).toBe(true);
    });

    it("should return true with multiple packages when one has config", () => {
      const state = createMockState({
        packages: [
          createMockPackage({
            eslintConfigPath: null,
            eslintConfigFilename: null,
          }),
          createMockPackage({
            path: "/test/project/packages/other",
            eslintConfigPath: "/test/project/packages/other/eslint.config.mjs",
          }),
        ],
      });

      expect(eslintInstaller.isApplicable(state)).toBe(true);
    });
  });

  describe("getTargets", () => {
    it("should return empty array when no packages have ESLint config", () => {
      const state = createMockState({
        packages: [
          createMockPackage({
            eslintConfigPath: null,
            eslintConfigFilename: null,
          }),
        ],
      });

      const targets = eslintInstaller.getTargets(state);
      expect(targets).toEqual([]);
    });

    it("should return targets for packages with ESLint config", () => {
      const pkg = createMockPackage({
        path: "/test/project/packages/app",
        name: "test-app",
        eslintConfigPath: "/test/project/packages/app/eslint.config.mjs",
      });

      const state = createMockState({
        packages: [pkg],
      });

      const targets = eslintInstaller.getTargets(state);
      expect(targets).toHaveLength(1);
      expect(targets[0].id).toBe("eslint-test-app");
      expect(targets[0].label).toBe("test-app");
      expect(targets[0].path).toBe("/test/project/packages/app");
    });

    it("should return multiple targets for multiple packages", () => {
      const state = createMockState({
        packages: [
          createMockPackage({
            path: "/test/project/packages/app1",
            name: "app1",
            eslintConfigPath: "/test/project/packages/app1/eslint.config.mjs",
          }),
          createMockPackage({
            path: "/test/project/packages/app2",
            name: "app2",
            eslintConfigPath: "/test/project/packages/app2/eslint.config.mjs",
          }),
        ],
      });

      const targets = eslintInstaller.getTargets(state);
      expect(targets).toHaveLength(2);
      expect(targets[0].label).toBe("app1");
      expect(targets[1].label).toBe("app2");
    });

    it("should mark as installed when hasUilintRules is true", () => {
      const state = createMockState({
        packages: [
          createMockPackage({
            hasUilintRules: true,
            configuredRuleIds: ["consistent-spacing"],
          }),
        ],
      });

      const targets = eslintInstaller.getTargets(state);
      expect(targets[0].isInstalled).toBe(true);
    });

    it("should mark as not installed when hasUilintRules is false", () => {
      const state = createMockState({
        packages: [
          createMockPackage({
            hasUilintRules: false,
            configuredRuleIds: [],
          }),
        ],
      });

      const targets = eslintInstaller.getTargets(state);
      expect(targets[0].isInstalled).toBe(false);
    });

    it("should include upgrade info for packages with some rules configured", () => {
      const state = createMockState({
        packages: [
          createMockPackage({
            hasUilintRules: true,
            configuredRuleIds: ["consistent-spacing"],
          }),
        ],
      });

      const targets = eslintInstaller.getTargets(state);
      expect(targets[0].canUpgrade).toBe(true);
      expect(targets[0].upgradeInfo).toBeDefined();
    });
  });

  describe("plan", () => {
    it("should generate correct actions", () => {
      const pkg = createMockPackage({
        path: "/test/project",
        name: "test-app",
        eslintConfigPath: "/test/project/eslint.config.mjs",
      });

      const state = createMockState({
        packages: [pkg],
        workspaceRoot: "/test/project",
      });

      const targets = eslintInstaller.getTargets(state);
      const mockConfig = {
        configuredRules: [
          {
            rule: { id: "test-rule", name: "Test Rule", defaultSeverity: "warn" },
            severity: "warn" as const,
          },
        ],
      };

      const { actions, dependencies } = eslintInstaller.plan(
        targets,
        mockConfig,
        state
      );

      // Should have create_directory action for .uilint/rules
      const createDirAction = actions.find(
        (a) => a.type === "create_directory" && a.path.includes(".uilint/rules")
      );
      expect(createDirAction).toBeDefined();

      // Should have inject_eslint action
      const eslintAction = actions.find((a) => a.type === "inject_eslint");
      expect(eslintAction).toBeDefined();

      // Should have dependencies
      expect(dependencies).toHaveLength(1);
      expect(dependencies[0].packagePath).toBe("/test/project");
    });

    it("should add .uilint/.cache to gitignore", () => {
      const pkg = createMockPackage({
        path: "/test/project",
        eslintConfigPath: "/test/project/eslint.config.mjs",
      });

      const state = createMockState({
        packages: [pkg],
        workspaceRoot: "/test/project",
      });

      const targets = eslintInstaller.getTargets(state);
      const mockConfig = { configuredRules: [] };

      const { actions } = eslintInstaller.plan(targets, mockConfig, state);

      const gitignoreAction = actions.find((a) => a.type === "append_to_file");
      expect(gitignoreAction).toBeDefined();
      if (gitignoreAction?.type === "append_to_file") {
        expect(gitignoreAction.path).toBe("/test/project/.gitignore");
        expect(gitignoreAction.content).toContain(".uilint/.cache");
      }
    });
  });

  describe("execute", () => {
    it("should yield progress events during installation", async () => {
      const pkg = createMockPackage({
        path: "/test/project",
        name: "test-app",
        eslintConfigPath: "/test/project/eslint.config.mjs",
      });

      const state = createMockState({
        packages: [pkg],
        workspaceRoot: "/test/project",
      });

      const targets = eslintInstaller.getTargets(state);
      const mockConfig = {
        configuredRules: [
          {
            rule: { id: "test-rule", name: "Test Rule", defaultSeverity: "warn" },
            severity: "warn" as const,
          },
        ],
      };

      const events: ProgressEvent[] = [];
      const generator = eslintInstaller.execute(targets, mockConfig, state);

      for await (const event of generator) {
        events.push(event);
      }

      // Should have start, progress events, and complete
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe("start");
      expect(events[events.length - 1].type).toBe("complete");

      const progressEvents = events.filter((e) => e.type === "progress");
      expect(progressEvents.length).toBeGreaterThan(0);
    });
  });
});

/**
 * Tests for ESLint installer
 */

import { describe, it, expect, beforeEach } from "vitest";
import { join } from "path";
import { EslintInstaller } from "../../src/commands/install/installers/eslint.js";
import type { ProjectState, EslintPackageInfo } from "../../src/commands/install/types.js";
import type { RuleMetadata } from "uilint-eslint";

// Mock rule metadata
const mockRules: RuleMetadata[] = [
  {
    id: "consistent-spacing",
    name: "consistent-spacing",
    description: "Enforce consistent spacing",
    recommended: true,
    requiresTypeChecking: false,
  },
  {
    id: "semantic",
    name: "semantic",
    description: "Semantic consistency check",
    recommended: true,
    requiresTypeChecking: false,
  },
];

// Helper to create mock project state
function createMockState(
  overrides?: Partial<ProjectState>
): ProjectState {
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
function createMockPackage(
  overrides?: Partial<EslintPackageInfo>
): EslintPackageInfo {
  return {
    path: "/test/project/packages/app",
    name: "test-app",
    version: "1.0.0",
    isTypeScript: true,
    dependencies: {},
    devDependencies: {},
    eslintConfigPath: "/test/project/packages/app/eslint.config.mjs",
    eslintConfigFilename: "eslint.config.mjs",
    hasUilintRules: false,
    configuredRuleIds: [],
    ...overrides,
  };
}

describe("EslintInstaller", () => {
  let installer: EslintInstaller;

  beforeEach(() => {
    installer = new EslintInstaller();
    installer.setSelectedRules(mockRules);
  });

  describe("metadata", () => {
    it("should have correct metadata", () => {
      expect(installer.id).toBe("eslint");
      expect(installer.name).toBe("ESLint Plugin");
      expect(installer.category).toBe("tooling");
      expect(installer.priority).toBe(100);
      expect(installer.description).toContain("uilint-eslint");
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

      expect(installer.isApplicable(state)).toBe(false);
    });

    it("should return true when at least one package has ESLint config", () => {
      const state = createMockState({
        packages: [
          createMockPackage({
            eslintConfigPath: "/test/project/eslint.config.mjs",
          }),
        ],
      });

      expect(installer.isApplicable(state)).toBe(true);
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

      expect(installer.isApplicable(state)).toBe(true);
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

      const targets = installer.getTargets(state);
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

      const targets = installer.getTargets(state);
      expect(targets).toHaveLength(1);
      expect(targets[0]).toMatchObject({
        id: "/test/project/packages/app",
        displayName: "test-app",
      });
      expect(targets[0].metadata).toHaveProperty("packageInfo");
      expect(targets[0].metadata).toHaveProperty("configPath");
    });

    it("should use directory name when package name is missing", () => {
      const pkg = createMockPackage({
        path: "/test/project/packages/my-app",
        name: "",
        eslintConfigPath: "/test/project/packages/my-app/eslint.config.mjs",
      });

      const state = createMockState({
        packages: [pkg],
      });

      const targets = installer.getTargets(state);
      expect(targets[0].displayName).toBe("my-app");
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

      const targets = installer.getTargets(state);
      expect(targets).toHaveLength(2);
      expect(targets[0].displayName).toBe("app1");
      expect(targets[1].displayName).toBe("app2");
    });
  });

  describe("isAlreadyInstalled", () => {
    it("should return not installed when no uilint rules configured", async () => {
      const state = createMockState();
      const target = {
        id: "/test/project",
        displayName: "test-app",
        metadata: {
          packageInfo: createMockPackage({
            hasUilintRules: false,
            configuredRuleIds: [],
          }),
        },
      };

      const status = await installer.isAlreadyInstalled(state, target);
      expect(status.installed).toBe(false);
      expect(status.partial).toBeUndefined();
    });

    it("should return installed when all selected rules are configured", async () => {
      const state = createMockState();
      const target = {
        id: "/test/project",
        displayName: "test-app",
        metadata: {
          packageInfo: createMockPackage({
            hasUilintRules: true,
            configuredRuleIds: ["consistent-spacing", "semantic"],
          }),
        },
      };

      const status = await installer.isAlreadyInstalled(state, target);
      expect(status.installed).toBe(true);
      expect(status.details).toContain("2 rule(s)");
    });

    it("should return partial when some rules are missing", async () => {
      const state = createMockState();
      const target = {
        id: "/test/project",
        displayName: "test-app",
        metadata: {
          packageInfo: createMockPackage({
            hasUilintRules: true,
            configuredRuleIds: ["consistent-spacing"],
          }),
        },
      };

      const status = await installer.isAlreadyInstalled(state, target);
      expect(status.installed).toBe(false);
      expect(status.partial).toBeDefined();
      expect(status.partial?.missingItems).toContain("semantic");
      expect(status.partial?.message).toContain("1 rule(s) configured");
      expect(status.partial?.message).toContain("1 missing");
    });
  });

  describe("execute", () => {
    it("should return error when no targets provided", async () => {
      const state = createMockState();
      const context = {
        state,
        targets: [],
        dryRun: true,
      };

      const generator = installer.execute(context);
      const result = await generator.next();

      expect(result.done).toBe(true);
      expect(result.value).toMatchObject({
        success: false,
        error: "No targets selected",
      });
    });

    it("should generate correct actions in dry run mode", async () => {
      const pkg = createMockPackage({
        path: "/test/project",
        name: "test-app",
        eslintConfigPath: "/test/project/eslint.config.mjs",
      });

      const state = createMockState({
        packages: [pkg],
        workspaceRoot: "/test/project",
      });

      const target = {
        id: "/test/project",
        displayName: "test-app",
        metadata: {
          packageInfo: pkg,
          configPath: pkg.eslintConfigPath!,
          selectedRules: mockRules,
        },
      };

      const context = {
        state,
        targets: [target],
        dryRun: true,
      };

      const events: ProgressEvent[] = [];
      const generator = installer.execute(context);

      let result = await generator.next();
      while (!result.done) {
        events.push(result.value);
        result = await generator.next();
      }

      // Check progress events
      expect(events.length).toBeGreaterThanOrEqual(4); // start, progress x2+, complete
      expect(events[0].type).toBe("start");
      expect(events[events.length - 1].type).toBe("complete");

      // Check result
      const finalResult = result.value;
      expect(finalResult.success).toBe(true);
      expect(finalResult.actions).not.toHaveLength(0);
      expect(finalResult.dependencies).toHaveLength(1);

      // Check actions
      const createDirActions = finalResult.actions.filter(
        (a) => a.type === "create_directory"
      );
      expect(createDirActions).toHaveLength(1);
      expect(createDirActions[0]).toMatchObject({
        type: "create_directory",
        path: "/test/project/.uilint/rules",
      });

      // Check dependencies
      expect(finalResult.dependencies[0]).toMatchObject({
        packagePath: "/test/project",
        packageManager: "npm",
      });
      expect(finalResult.dependencies[0].packages).toContain("typescript-eslint");
      expect(
        finalResult.dependencies[0].packages.some((p) => p.includes("uilint-eslint"))
      ).toBe(true);

      // Check gitignore action
      const gitignoreAction = finalResult.actions.find(
        (a) => a.type === "append_to_file"
      );
      expect(gitignoreAction).toBeDefined();
      expect(gitignoreAction).toMatchObject({
        type: "append_to_file",
        path: "/test/project/.gitignore",
      });
    });

    it("should handle multiple targets", async () => {
      const pkg1 = createMockPackage({
        path: "/test/project/packages/app1",
        name: "app1",
        eslintConfigPath: "/test/project/packages/app1/eslint.config.mjs",
      });
      const pkg2 = createMockPackage({
        path: "/test/project/packages/app2",
        name: "app2",
        eslintConfigPath: "/test/project/packages/app2/eslint.config.mjs",
      });

      const state = createMockState({
        packages: [pkg1, pkg2],
        workspaceRoot: "/test/project",
      });

      const targets = [
        {
          id: pkg1.path,
          displayName: "app1",
          metadata: {
            packageInfo: pkg1,
            configPath: pkg1.eslintConfigPath!,
            selectedRules: mockRules,
          },
        },
        {
          id: pkg2.path,
          displayName: "app2",
          metadata: {
            packageInfo: pkg2,
            configPath: pkg2.eslintConfigPath!,
            selectedRules: mockRules,
          },
        },
      ];

      const context = {
        state,
        targets,
        dryRun: true,
      };

      const generator = installer.execute(context);
      let result = await generator.next();
      while (!result.done) {
        result = await generator.next();
      }

      const finalResult = result.value;
      expect(finalResult.success).toBe(true);
      expect(finalResult.dependencies).toHaveLength(2);

      // Check that both packages have create_directory actions
      const createDirActions = finalResult.actions.filter(
        (a) => a.type === "create_directory"
      );
      expect(createDirActions.length).toBeGreaterThanOrEqual(2);
    });

    it("should set selectedRules and use them in getTargets", () => {
      const newRules: RuleMetadata[] = [
        {
          id: "new-rule",
          name: "new-rule",
          description: "New rule",
          recommended: true,
          requiresTypeChecking: false,
        },
      ];

      installer.setSelectedRules(newRules);

      const state = createMockState({
        packages: [
          createMockPackage({
            path: "/test/project",
            eslintConfigPath: "/test/project/eslint.config.mjs",
          }),
        ],
      });

      const targets = installer.getTargets(state);
      expect(targets[0].metadata).toHaveProperty("selectedRules");
    });
  });
});

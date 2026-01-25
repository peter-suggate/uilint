/**
 * Unit tests for plan.ts
 *
 * Tests the pure planning logic with fake ProjectState objects.
 * No fixtures or filesystem access needed.
 */

import { describe, it, expect } from "vitest";
import {
  createPlan,
  getMissingRules,
} from "../../src/commands/init/plan.js";
import type {
  ProjectState,
  UserChoices,
  EslintPackageInfo,
} from "../../src/commands/init/types.js";
import { ruleRegistry, type RuleMetadata } from "uilint-eslint";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockProjectState(
  overrides: Partial<ProjectState> = {}
): ProjectState {
  return {
    projectPath: "/test/project",
    workspaceRoot: "/test/project",
    packageManager: "npm",
    cursorDir: {
      exists: false,
      path: "/test/project/.cursor",
    },
    styleguide: {
      exists: false,
      path: "/test/project/.uilint/styleguide.md",
    },
    commands: {
      genstyleguide: false,
    },
    nextApps: [],
    viteApps: [],
    packages: [],
    ...overrides,
  };
}

function createMockPackage(
  overrides: Partial<EslintPackageInfo> = {}
): EslintPackageInfo {
  return {
    path: "/test/project",
    displayPath: ".",
    name: "test-project",
    hasEslintConfig: true,
    isFrontend: true,
    isRoot: true,
    isTypeScript: true,
    eslintConfigPath: "/test/project/eslint.config.mjs",
    eslintConfigFilename: "eslint.config.mjs",
    hasUilintRules: false,
    configuredRuleIds: [],
    ...overrides,
  };
}

function createMockChoices(overrides: Partial<UserChoices> = {}): UserChoices {
  return {
    items: [],
    ...overrides,
  };
}

// ============================================================================
// Commands Planning Tests
// ============================================================================

describe("createPlan - Commands", () => {
  it("creates genstyleguide command", () => {
    const state = createMockProjectState();
    const choices = createMockChoices({ items: ["genstyleguide"] });

    const plan = createPlan(state, choices);

    expect(plan.actions).toContainEqual({
      type: "create_directory",
      path: "/test/project/.cursor/commands",
    });

    const cmdAction = plan.actions.find(
      (a) => a.type === "create_file" && a.path.includes("genstyleguide.md")
    );
    expect(cmdAction).toBeDefined();
  });
});

// ============================================================================
// Agent Skill Planning Tests
// ============================================================================

describe("createPlan - Agent Skill", () => {
  it("creates skill directory and files", () => {
    const state = createMockProjectState();
    const choices = createMockChoices({ items: ["skill"] });

    const plan = createPlan(state, choices);

    // Should create .cursor directory
    expect(plan.actions).toContainEqual({
      type: "create_directory",
      path: "/test/project/.cursor",
    });

    // Should create skills directory
    expect(plan.actions).toContainEqual({
      type: "create_directory",
      path: "/test/project/.cursor/skills",
    });

    // Should create skill directory
    expect(plan.actions).toContainEqual({
      type: "create_directory",
      path: "/test/project/.cursor/skills/ui-consistency-enforcer",
    });

    // Should create SKILL.md
    const skillMdAction = plan.actions.find(
      (a) => a.type === "create_file" && a.path.includes("SKILL.md")
    );
    expect(skillMdAction).toBeDefined();
    if (skillMdAction?.type === "create_file") {
      expect(skillMdAction.content).toContain("name: ui-consistency-enforcer");
      expect(skillMdAction.content).toContain("createRule");
    }
  });

  it("creates reference files in subdirectory", () => {
    const state = createMockProjectState();
    const choices = createMockChoices({ items: ["skill"] });

    const plan = createPlan(state, choices);

    // Should create references directory
    const referencesDir = plan.actions.find(
      (a) => a.type === "create_directory" && a.path.includes("references")
    );
    expect(referencesDir).toBeDefined();

    // Should create RULE-TEMPLATE.ts
    const ruleTemplate = plan.actions.find(
      (a) => a.type === "create_file" && a.path.includes("RULE-TEMPLATE.ts")
    );
    expect(ruleTemplate).toBeDefined();

    // Should create TEST-TEMPLATE.ts
    const testTemplate = plan.actions.find(
      (a) => a.type === "create_file" && a.path.includes("TEST-TEMPLATE.ts")
    );
    expect(testTemplate).toBeDefined();

    // Should create REGISTRY-ENTRY.md
    const registryEntry = plan.actions.find(
      (a) => a.type === "create_file" && a.path.includes("REGISTRY-ENTRY.md")
    );
    expect(registryEntry).toBeDefined();
  });

  it("does not add dependencies for skill installation", () => {
    const state = createMockProjectState();
    const choices = createMockChoices({ items: ["skill"] });

    const plan = createPlan(state, choices);

    // Skill installation doesn't require npm packages
    expect(plan.dependencies).toHaveLength(0);
  });

  it("creates skill alongside other items", () => {
    const state = createMockProjectState();
    const choices = createMockChoices({
      items: ["skill", "genstyleguide"],
    });

    const plan = createPlan(state, choices);

    // Should have genstyleguide command
    const cmdAction = plan.actions.find(
      (a) => a.type === "create_file" && a.path.includes("genstyleguide.md")
    );
    expect(cmdAction).toBeDefined();

    // Should have skill
    const skillAction = plan.actions.find(
      (a) => a.type === "create_file" && a.path.includes("SKILL.md")
    );
    expect(skillAction).toBeDefined();
  });
});

// ============================================================================
// ESLint Planning Tests
// ============================================================================

describe("createPlan - ESLint", () => {
  it("plans ESLint installation for selected packages", () => {
    // Use .mjs ESLint config which should generate .js rule files
    const pkg = createMockPackage();
    const state = createMockProjectState({ packages: [pkg] });
    const choices = createMockChoices({
      items: ["eslint"],
      eslint: {
        packagePaths: [pkg.path],
        selectedRules: ruleRegistry.filter(
          (r) => r.id === "no-arbitrary-tailwind"
        ),
      },
    });

    const plan = createPlan(state, choices);

    // Should create .uilint/rules directory
    expect(plan.actions).toContainEqual({
      type: "create_directory",
      path: expect.stringContaining(".uilint/rules"),
    });

    // Should copy rule files (as .js since ESLint config is .mjs)
    const ruleFileAction = plan.actions.find(
      (a) =>
        a.type === "create_file" && a.path.includes("no-arbitrary-tailwind.js")
    );
    expect(ruleFileAction).toBeDefined();
    if (ruleFileAction?.type === "create_file") {
      // .mjs ESLint config should produce .js rule files
      expect(ruleFileAction.path).toContain(
        ".uilint/rules/no-arbitrary-tailwind.js"
      );
      expect(ruleFileAction.content).toContain("createRule");
    }

    // Should install dependencies
    expect(plan.dependencies).toContainEqual(
      expect.objectContaining({
        packagePath: pkg.path,
        packages: expect.arrayContaining([
          expect.stringContaining("uilint-eslint"),
          "typescript-eslint",
        ]),
      })
    );

    // Should inject ESLint rules
    const eslintAction = plan.actions.find((a) => a.type === "inject_eslint");
    expect(eslintAction).toBeDefined();
    if (eslintAction?.type === "inject_eslint") {
      expect(eslintAction.packagePath).toBe(pkg.path);
      expect(eslintAction.rules).toHaveLength(1);
      expect(eslintAction.rules[0].id).toBe("no-arbitrary-tailwind");
    }
  });

  it("adds .uilint/.cache to .gitignore", () => {
    const pkg = createMockPackage();
    const state = createMockProjectState({ packages: [pkg] });
    const choices = createMockChoices({
      items: ["eslint"],
      eslint: {
        packagePaths: [pkg.path],
        selectedRules: [],
      },
    });

    const plan = createPlan(state, choices);

    const gitignoreAction = plan.actions.find(
      (a) => a.type === "append_to_file" && a.path.includes(".gitignore")
    );
    expect(gitignoreAction).toBeDefined();
    if (gitignoreAction?.type === "append_to_file") {
      expect(gitignoreAction.content).toContain(".uilint/.cache");
      expect(gitignoreAction.ifNotContains).toBe(".uilint/.cache");
    }
  });

  it("handles multiple packages in monorepo", () => {
    const pkg1 = createMockPackage({
      path: "/test/project/apps/web",
      displayPath: "apps/web",
      name: "@monorepo/web",
    });
    const pkg2 = createMockPackage({
      path: "/test/project/apps/admin",
      displayPath: "apps/admin",
      name: "@monorepo/admin",
      eslintConfigPath: "/test/project/apps/admin/eslint.config.mjs",
    });

    const state = createMockProjectState({ packages: [pkg1, pkg2] });
    const choices = createMockChoices({
      items: ["eslint"],
      eslint: {
        packagePaths: [pkg1.path, pkg2.path],
        selectedRules: ruleRegistry.filter((r) => r.category === "static"),
      },
    });

    const plan = createPlan(state, choices);

    // Should have dependencies for both packages
    expect(plan.dependencies).toHaveLength(2);

    // Should have inject actions for both packages
    const eslintActions = plan.actions.filter(
      (a) => a.type === "inject_eslint"
    );
    expect(eslintActions).toHaveLength(2);
  });

  it("marks hasExistingRules correctly for packages with uilint rules", () => {
    const pkg = createMockPackage({
      hasUilintRules: true,
      configuredRuleIds: ["no-arbitrary-tailwind"],
    });
    const state = createMockProjectState({ packages: [pkg] });
    const choices = createMockChoices({
      items: ["eslint"],
      eslint: {
        packagePaths: [pkg.path],
        selectedRules: ruleRegistry.filter((r) => r.category === "static"),
      },
    });

    const plan = createPlan(state, choices);

    const eslintAction = plan.actions.find((a) => a.type === "inject_eslint");
    expect(eslintAction).toBeDefined();
    if (eslintAction?.type === "inject_eslint") {
      expect(eslintAction.hasExistingRules).toBe(true);
    }
  });

  it("copies .js files for JavaScript-only packages", () => {
    const pkg = createMockPackage({
      isTypeScript: false,
    });
    const state = createMockProjectState({ packages: [pkg] });
    const choices = createMockChoices({
      items: ["eslint"],
      eslint: {
        packagePaths: [pkg.path],
        selectedRules: ruleRegistry.filter(
          (r) => r.id === "no-arbitrary-tailwind"
        ),
      },
    });

    const plan = createPlan(state, choices);

    const ruleFileAction = plan.actions.find(
      (a) =>
        a.type === "create_file" && a.path.includes("no-arbitrary-tailwind")
    );
    expect(ruleFileAction).toBeDefined();
    if (ruleFileAction?.type === "create_file") {
      expect(ruleFileAction.path).toContain(
        ".uilint/rules/no-arbitrary-tailwind.js"
      );
    }
  });

  it("copies .ts files for TypeScript ESLint configs", () => {
    // TypeScript rule files are generated when the ESLint config is .ts
    const pkg = createMockPackage({
      isTypeScript: true,
      eslintConfigPath: "/test/project/eslint.config.ts",
      eslintConfigFilename: "eslint.config.ts",
    });
    const state = createMockProjectState({ packages: [pkg] });
    const choices = createMockChoices({
      items: ["eslint"],
      eslint: {
        packagePaths: [pkg.path],
        selectedRules: ruleRegistry.filter(
          (r) => r.id === "no-arbitrary-tailwind"
        ),
      },
    });

    const plan = createPlan(state, choices);

    const ruleFileAction = plan.actions.find(
      (a) =>
        a.type === "create_file" && a.path.includes("no-arbitrary-tailwind")
    );
    expect(ruleFileAction).toBeDefined();
    if (ruleFileAction?.type === "create_file") {
      expect(ruleFileAction.path).toContain(
        ".uilint/rules/no-arbitrary-tailwind.ts"
      );
    }
  });

  it("copies .test.ts files for TypeScript ESLint configs when rule has test file", () => {
    // Test files are only copied for TypeScript ESLint configs
    const pkg = createMockPackage({
      isTypeScript: true,
      eslintConfigPath: "/test/project/eslint.config.ts",
      eslintConfigFilename: "eslint.config.ts",
    });
    const state = createMockProjectState({ packages: [pkg] });
    // Use consistent-dark-mode which has a test file
    const choices = createMockChoices({
      items: ["eslint"],
      eslint: {
        packagePaths: [pkg.path],
        selectedRules: ruleRegistry.filter(
          (r) => r.id === "consistent-dark-mode"
        ),
      },
    });

    const plan = createPlan(state, choices);

    // Should copy implementation file
    const implAction = plan.actions.find(
      (a) =>
        a.type === "create_file" &&
        a.path.includes("consistent-dark-mode.ts") &&
        !a.path.includes(".test.ts")
    );
    expect(implAction).toBeDefined();
    if (implAction?.type === "create_file") {
      expect(implAction.path).toContain(
        ".uilint/rules/consistent-dark-mode.ts"
      );
    }

    // Should copy test file
    const testAction = plan.actions.find(
      (a) =>
        a.type === "create_file" &&
        a.path.includes("consistent-dark-mode.test.ts")
    );
    expect(testAction).toBeDefined();
    if (testAction?.type === "create_file") {
      expect(testAction.path).toContain(
        ".uilint/rules/consistent-dark-mode.test.ts"
      );
      expect(testAction.content).toContain("consistent-dark-mode");
    }
  });

  it("does not copy .test.ts files for JavaScript-only packages", () => {
    const pkg = createMockPackage({
      isTypeScript: false,
    });
    const state = createMockProjectState({ packages: [pkg] });
    // Use consistent-dark-mode which has a test file
    const choices = createMockChoices({
      items: ["eslint"],
      eslint: {
        packagePaths: [pkg.path],
        selectedRules: ruleRegistry.filter(
          (r) => r.id === "consistent-dark-mode"
        ),
      },
    });

    const plan = createPlan(state, choices);

    // Should copy implementation file (.js)
    const implAction = plan.actions.find(
      (a) =>
        a.type === "create_file" && a.path.includes("consistent-dark-mode.js")
    );
    expect(implAction).toBeDefined();

    // Should NOT copy test file for JS projects
    const testAction = plan.actions.find(
      (a) =>
        a.type === "create_file" &&
        a.path.includes("consistent-dark-mode.test.ts")
    );
    expect(testAction).toBeUndefined();
  });

  it("adds @vitest/coverage-v8 dependency when require-test-coverage rule is selected", () => {
    const pkg = createMockPackage();
    const state = createMockProjectState({ packages: [pkg] });
    const choices = createMockChoices({
      items: ["eslint"],
      eslint: {
        packagePaths: [pkg.path],
        selectedRules: ruleRegistry.filter(
          (r) => r.id === "require-test-coverage"
        ),
      },
    });

    const plan = createPlan(state, choices);

    // Should include @vitest/coverage-v8 in dependencies
    const deps = plan.dependencies.find((d) => d.packagePath === pkg.path);
    expect(deps).toBeDefined();
    expect(deps?.packages).toContain("@vitest/coverage-v8");
  });

  it("adds inject_vitest_coverage action when require-test-coverage rule is selected", () => {
    const pkg = createMockPackage();
    const state = createMockProjectState({ packages: [pkg] });
    const choices = createMockChoices({
      items: ["eslint"],
      eslint: {
        packagePaths: [pkg.path],
        selectedRules: ruleRegistry.filter(
          (r) => r.id === "require-test-coverage"
        ),
      },
    });

    const plan = createPlan(state, choices);

    // Should include inject_vitest_coverage action
    const coverageAction = plan.actions.find(
      (a) => a.type === "inject_vitest_coverage"
    );
    expect(coverageAction).toBeDefined();
    if (coverageAction?.type === "inject_vitest_coverage") {
      expect(coverageAction.projectPath).toBe(pkg.path);
    }
  });

  it("does not add coverage dependencies when require-test-coverage is not selected", () => {
    const pkg = createMockPackage();
    const state = createMockProjectState({ packages: [pkg] });
    const choices = createMockChoices({
      items: ["eslint"],
      eslint: {
        packagePaths: [pkg.path],
        selectedRules: ruleRegistry.filter(
          (r) => r.id === "no-arbitrary-tailwind"
        ),
      },
    });

    const plan = createPlan(state, choices);

    // Should NOT include @vitest/coverage-v8 in dependencies
    const deps = plan.dependencies.find((d) => d.packagePath === pkg.path);
    expect(deps).toBeDefined();
    expect(deps?.packages).not.toContain("@vitest/coverage-v8");

    // Should NOT include inject_vitest_coverage action
    const coverageAction = plan.actions.find(
      (a) => a.type === "inject_vitest_coverage"
    );
    expect(coverageAction).toBeUndefined();
  });
});

// ============================================================================
// Next.js Planning Tests
// ============================================================================

describe("createPlan - Next.js", () => {
  it("plans Next.js overlay installation", () => {
    const state = createMockProjectState({
      nextApps: [
        {
          projectPath: "/test/project",
          detection: {
            appRoot: "app",
            appRootAbs: "/test/project/app",
            candidates: ["app/layout.tsx"],
          },
        },
      ],
    });
    const choices = createMockChoices({
      items: ["next"],
      next: {
        projectPath: "/test/project",
        detection: state.nextApps[0].detection,
      },
    });

    const plan = createPlan(state, choices);

    // Should install Next.js routes
    expect(plan.actions).toContainEqual(
      expect.objectContaining({
        type: "install_next_routes",
        projectPath: "/test/project",
        appRoot: "app",
      })
    );

    // Should inject React overlay
    expect(plan.actions).toContainEqual(
      expect.objectContaining({
        type: "inject_react",
        projectPath: "/test/project",
        appRoot: "app",
      })
    );

    // Should inject next.config
    expect(plan.actions).toContainEqual(
      expect.objectContaining({
        type: "inject_next_config",
        projectPath: "/test/project",
      })
    );

    // Should install dependencies
    expect(plan.dependencies).toContainEqual(
      expect.objectContaining({
        packagePath: "/test/project",
        packages: ["uilint-react", "uilint-core", "jsx-loc-plugin"],
      })
    );
  });
});

// ============================================================================
// getMissingRules Tests
// ============================================================================

describe("getMissingRules", () => {
  it("returns rules not in configured list", () => {
    const configured = ["no-arbitrary-tailwind"];
    const selected: RuleMetadata[] = [
      {
        id: "no-arbitrary-tailwind",
        name: "Test",
        description: "",
        defaultSeverity: "error",
        category: "static",
      },
      {
        id: "prefer-tailwind",
        name: "Test2",
        description: "",
        defaultSeverity: "warn",
        category: "static",
      },
    ];

    const missing = getMissingRules(configured, selected);

    expect(missing).toHaveLength(1);
    expect(missing[0].id).toBe("prefer-tailwind");
  });

  it("returns empty array when all rules are configured", () => {
    const configured = ["no-arbitrary-tailwind", "prefer-tailwind"];
    const selected: RuleMetadata[] = [
      {
        id: "no-arbitrary-tailwind",
        name: "Test",
        description: "",
        defaultSeverity: "error",
        category: "static",
      },
      {
        id: "prefer-tailwind",
        name: "Test2",
        description: "",
        defaultSeverity: "warn",
        category: "static",
      },
    ];

    const missing = getMissingRules(configured, selected);

    expect(missing).toHaveLength(0);
  });

  it("returns all rules when none are configured", () => {
    const configured: string[] = [];
    const selected: RuleMetadata[] = [
      {
        id: "no-arbitrary-tailwind",
        name: "Test",
        description: "",
        defaultSeverity: "error",
        category: "static",
      },
    ];

    const missing = getMissingRules(configured, selected);

    expect(missing).toHaveLength(1);
  });
});

// ============================================================================
// Combined Scenarios
// ============================================================================

describe("createPlan - Combined scenarios", () => {
  it("plans full installation with all items including skill", () => {
    const pkg = createMockPackage();
    const state = createMockProjectState({
      packages: [pkg],
      nextApps: [
        {
          projectPath: "/test/project",
          detection: {
            appRoot: "app",
            appRootAbs: "/test/project/app",
            candidates: ["app/layout.tsx"],
          },
        },
      ],
    });
    const choices = createMockChoices({
      items: [
        "genstyleguide",
        "skill",
        "next",
        "eslint",
      ],
      next: {
        projectPath: "/test/project",
        detection: state.nextApps[0].detection,
      },
      eslint: {
        packagePaths: [pkg.path],
        selectedRules: ruleRegistry.filter((r) => r.category === "static"),
      },
    });

    const plan = createPlan(state, choices);

    // Should have actions for all items (10+ base + skill files)
    expect(plan.actions.length).toBeGreaterThan(15);

    // Should have dependencies
    expect(plan.dependencies.length).toBeGreaterThanOrEqual(2);

    // Verify skill is included
    const skillAction = plan.actions.find(
      (a) => a.type === "create_file" && a.path.includes("SKILL.md")
    );
    expect(skillAction).toBeDefined();
  });

  it("creates no actions when items array is empty", () => {
    const state = createMockProjectState();
    const choices = createMockChoices({ items: [] });

    const plan = createPlan(state, choices);

    expect(plan.actions).toHaveLength(0);
    expect(plan.dependencies).toHaveLength(0);
  });
});

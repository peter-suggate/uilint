/**
 * Unit tests for update/plan.ts
 *
 * Tests the planning phase of the update command.
 */

import { describe, it, expect } from "vitest";
import type { RuleMigration } from "uilint-eslint";
import { createUpdatePlan } from "../../src/commands/update/plan.js";
import type {
  UpdateAnalysis,
  PackageUpdateInfo,
  RuleUpdateInfo,
  UpdateChoices,
} from "../../src/commands/update/types.js";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockRuleUpdateInfo(
  overrides: Partial<RuleUpdateInfo> = {}
): RuleUpdateInfo {
  return {
    ruleId: "test-rule",
    installedVersion: "1.0.0",
    availableVersion: "1.1.0",
    hasUpdate: true,
    migrations: [],
    hasBreakingChanges: false,
    ...overrides,
  };
}

function createMockPackageUpdateInfo(
  overrides: Partial<PackageUpdateInfo> = {}
): PackageUpdateInfo {
  return {
    packagePath: "/test/project",
    displayName: "test-project",
    eslintConfigPath: "/test/project/eslint.config.mjs",
    packageManager: "npm",
    installedPackages: [],
    rules: [],
    updatableCount: 0,
    hasBreakingChanges: false,
    ...overrides,
  };
}

function createMockAnalysis(
  overrides: Partial<UpdateAnalysis> = {}
): UpdateAnalysis {
  return {
    workspaceRoot: "/test/project",
    packageManager: "npm",
    packages: [],
    totalUpdates: 0,
    hasBreakingChanges: false,
    ...overrides,
  };
}

function createMockChoices(
  overrides: Partial<UpdateChoices> = {}
): UpdateChoices {
  return {
    packagePaths: ["/test/project"],
    ruleIds: [],
    confirmBreaking: false,
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("Update Plan", () => {
  describe("createUpdatePlan", () => {
    it("creates plan to copy new rule files", () => {
      const rule = createMockRuleUpdateInfo({
        ruleId: "prefer-tailwind",
        installedVersion: "1.0.0",
        availableVersion: "1.1.0",
        hasUpdate: true,
      });

      const pkg = createMockPackageUpdateInfo({
        packagePath: "/test/project",
        rules: [rule],
        updatableCount: 1,
      });

      const analysis = createMockAnalysis({
        packages: [pkg],
        totalUpdates: 1,
      });

      const choices = createMockChoices({
        packagePaths: ["/test/project"],
      });

      const plan = createUpdatePlan(analysis, choices);

      expect(plan.actions).toContainEqual({
        type: "copy_rule_files",
        packagePath: "/test/project",
        ruleId: "prefer-tailwind",
        version: "1.1.0",
      });
    });

    it("creates plan to update manifest", () => {
      const rule = createMockRuleUpdateInfo({
        ruleId: "consistent-dark-mode",
        installedVersion: "1.0.0",
        availableVersion: "1.2.0",
        hasUpdate: true,
      });

      const pkg = createMockPackageUpdateInfo({
        packagePath: "/test/project",
        rules: [rule],
        updatableCount: 1,
      });

      const analysis = createMockAnalysis({
        packages: [pkg],
        totalUpdates: 1,
      });

      const choices = createMockChoices();

      const plan = createUpdatePlan(analysis, choices);

      expect(plan.actions).toContainEqual({
        type: "update_manifest_version",
        packagePath: "/test/project",
        ruleId: "consistent-dark-mode",
        version: "1.2.0",
      });
    });

    it("creates plan to migrate ESLint config options when migrations exist", () => {
      const mockMigration: RuleMigration = {
        from: "1.0.0",
        to: "1.1.0",
        description: "Add new option",
        migrate: (opts) => opts,
      };

      const rule = createMockRuleUpdateInfo({
        ruleId: "prefer-tailwind",
        installedVersion: "1.0.0",
        availableVersion: "1.1.0",
        hasUpdate: true,
        migrations: [mockMigration],
      });

      const pkg = createMockPackageUpdateInfo({
        packagePath: "/test/project",
        eslintConfigPath: "/test/project/eslint.config.mjs",
        rules: [rule],
        updatableCount: 1,
      });

      const analysis = createMockAnalysis({
        packages: [pkg],
        totalUpdates: 1,
      });

      const choices = createMockChoices();

      const plan = createUpdatePlan(analysis, choices);

      expect(plan.actions).toContainEqual({
        type: "migrate_rule_options",
        configPath: "/test/project/eslint.config.mjs",
        ruleId: "prefer-tailwind",
        migrations: [mockMigration],
      });
    });

    it("handles multiple packages in monorepo", () => {
      const rule1 = createMockRuleUpdateInfo({
        ruleId: "rule-a",
        hasUpdate: true,
      });

      const rule2 = createMockRuleUpdateInfo({
        ruleId: "rule-b",
        hasUpdate: true,
      });

      const pkg1 = createMockPackageUpdateInfo({
        packagePath: "/test/project/apps/web",
        rules: [rule1],
        updatableCount: 1,
      });

      const pkg2 = createMockPackageUpdateInfo({
        packagePath: "/test/project/apps/admin",
        rules: [rule2],
        updatableCount: 1,
      });

      const analysis = createMockAnalysis({
        packages: [pkg1, pkg2],
        totalUpdates: 2,
      });

      const choices = createMockChoices({
        packagePaths: ["/test/project/apps/web", "/test/project/apps/admin"],
      });

      const plan = createUpdatePlan(analysis, choices);

      // Should have actions for both packages
      const copyActions = plan.actions.filter(
        (a) => a.type === "copy_rule_files"
      );
      expect(copyActions).toHaveLength(2);
      expect(copyActions.map((a) => a.packagePath)).toContain(
        "/test/project/apps/web"
      );
      expect(copyActions.map((a) => a.packagePath)).toContain(
        "/test/project/apps/admin"
      );
    });

    it("handles partial update (specific rules only)", () => {
      const rule1 = createMockRuleUpdateInfo({
        ruleId: "rule-a",
        hasUpdate: true,
      });

      const rule2 = createMockRuleUpdateInfo({
        ruleId: "rule-b",
        hasUpdate: true,
      });

      const pkg = createMockPackageUpdateInfo({
        packagePath: "/test/project",
        rules: [rule1, rule2],
        updatableCount: 2,
      });

      const analysis = createMockAnalysis({
        packages: [pkg],
        totalUpdates: 2,
      });

      // Only update rule-a
      const choices = createMockChoices({
        ruleIds: ["rule-a"],
      });

      const plan = createUpdatePlan(analysis, choices);

      // Should only have actions for rule-a
      const copyActions = plan.actions.filter(
        (a) => a.type === "copy_rule_files"
      );
      expect(copyActions).toHaveLength(1);
      expect((copyActions[0] as { ruleId: string }).ruleId).toBe("rule-a");
    });

    it("skips packages not in choices", () => {
      const rule = createMockRuleUpdateInfo({
        ruleId: "test-rule",
        hasUpdate: true,
      });

      const pkg1 = createMockPackageUpdateInfo({
        packagePath: "/test/project/selected",
        rules: [rule],
        updatableCount: 1,
      });

      const pkg2 = createMockPackageUpdateInfo({
        packagePath: "/test/project/skipped",
        rules: [rule],
        updatableCount: 1,
      });

      const analysis = createMockAnalysis({
        packages: [pkg1, pkg2],
        totalUpdates: 2,
      });

      // Only include first package
      const choices = createMockChoices({
        packagePaths: ["/test/project/selected"],
      });

      const plan = createUpdatePlan(analysis, choices);

      const copyActions = plan.actions.filter(
        (a) => a.type === "copy_rule_files"
      );
      expect(copyActions).toHaveLength(1);
      expect(copyActions[0]!.packagePath).toBe("/test/project/selected");
    });

    it("skips rules that are already up to date", () => {
      const outdatedRule = createMockRuleUpdateInfo({
        ruleId: "outdated-rule",
        hasUpdate: true,
      });

      const currentRule = createMockRuleUpdateInfo({
        ruleId: "current-rule",
        hasUpdate: false,
      });

      const pkg = createMockPackageUpdateInfo({
        packagePath: "/test/project",
        rules: [outdatedRule, currentRule],
        updatableCount: 1,
      });

      const analysis = createMockAnalysis({
        packages: [pkg],
        totalUpdates: 1,
      });

      const choices = createMockChoices();

      const plan = createUpdatePlan(analysis, choices);

      const copyActions = plan.actions.filter(
        (a) => a.type === "copy_rule_files"
      );
      expect(copyActions).toHaveLength(1);
      expect((copyActions[0] as { ruleId: string }).ruleId).toBe("outdated-rule");
    });

    it("returns empty plan when no updates selected", () => {
      const analysis = createMockAnalysis({
        packages: [],
        totalUpdates: 0,
      });

      const choices = createMockChoices();

      const plan = createUpdatePlan(analysis, choices);

      expect(plan.actions).toHaveLength(0);
      expect(plan.rules).toHaveLength(0);
    });
  });
});

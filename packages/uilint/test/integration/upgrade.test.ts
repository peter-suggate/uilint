/**
 * Integration tests for the upgrade command
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { execSync } from "child_process";
import {
  readManifest,
  writeManifest,
  MANIFEST_SCHEMA_VERSION,
  type RuleManifest,
} from "../../src/utils/manifest.js";
import { analyzeForUpdates } from "../../src/commands/update/analyze.js";
import { createUpdatePlan } from "../../src/commands/update/plan.js";
import { executeUpdatePlan } from "../../src/commands/update/execute.js";
import type { UpdateChoices } from "../../src/commands/update/types.js";

describe("Upgrade Integration", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `uilint-upgrade-integ-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(join(testDir, ".uilint", "rules"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("Fresh install creates manifest", () => {
    it("manifest is created in .uilint/rules/", () => {
      // Create manifest programmatically
      const manifest: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: new Date().toISOString(),
        uilintVersion: "0.2.0",
        rules: {
          "consistent-spacing": {
            version: "1.0.0",
            installedAt: new Date().toISOString(),
          },
        },
      };
      writeManifest(testDir, manifest);

      const manifestPath = join(testDir, ".uilint", "rules", "manifest.json");
      expect(existsSync(manifestPath)).toBe(true);

      const read = readManifest(testDir);
      expect(read).not.toBeNull();
      expect(read?.rules["consistent-spacing"]).toBeDefined();
    });
  });

  describe("upgrade --check detects outdated rules", () => {
    it("shows available updates in analysis", () => {
      const manifest: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {
          "consistent-spacing": {
            version: "0.9.0", // Older than current 1.0.0
            installedAt: "2024-01-01T00:00:00Z",
          },
        },
      };
      writeManifest(testDir, manifest);

      const analysis = analyzeForUpdates(testDir);

      expect(analysis.totalUpdates).toBe(1);

      const pkg = analysis.packages.find((p) => p.packagePath === testDir);
      expect(pkg).toBeDefined();

      const rule = pkg?.rules.find((r) => r.ruleId === "consistent-spacing");
      expect(rule?.hasUpdate).toBe(true);
      expect(rule?.installedVersion).toBe("0.9.0");
      expect(rule?.availableVersion).toBe("1.0.0");
    });
  });

  describe("upgrade copies new rule files and updates manifest", () => {
    it("updates manifest version after upgrade", async () => {
      const manifest: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {
          "consistent-spacing": {
            version: "0.9.0",
            installedAt: "2024-01-01T00:00:00Z",
          },
        },
      };
      writeManifest(testDir, manifest);

      const analysis = analyzeForUpdates(testDir);
      const choices: UpdateChoices = {
        packagePaths: [testDir],
        ruleIds: [],
        confirmBreaking: false,
      };

      const plan = createUpdatePlan(analysis, choices);
      expect(plan.actions.length).toBeGreaterThan(0);

      const result = await executeUpdatePlan(plan, { dryRun: false });

      // Debug: check errors if any
      if (!result.success) {
        const errors = result.actionsPerformed
          .filter((a) => !a.success)
          .map((a) => a.error);
        console.log("Errors:", errors);
      }

      expect(result.success).toBe(true);

      // Verify manifest was updated
      const updated = readManifest(testDir);
      expect(updated?.rules["consistent-spacing"]?.version).toBe("1.0.0");
    });
  });

  describe("upgrade --dry-run shows changes without modifying", () => {
    it("does not modify files in dry-run mode", async () => {
      const manifest: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {
          "consistent-spacing": {
            version: "0.9.0",
            installedAt: "2024-01-01T00:00:00Z",
          },
        },
      };
      writeManifest(testDir, manifest);

      const analysis = analyzeForUpdates(testDir);
      const choices: UpdateChoices = {
        packagePaths: [testDir],
        ruleIds: [],
        confirmBreaking: false,
      };

      const plan = createUpdatePlan(analysis, choices);
      const result = await executeUpdatePlan(plan, { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.actionsPerformed.some((a) => a.wouldDo)).toBe(true);

      // Verify manifest was NOT updated
      const unchanged = readManifest(testDir);
      expect(unchanged?.rules["consistent-spacing"]?.version).toBe("0.9.0");
    });
  });

  describe("upgrade --rule updates only specified rule", () => {
    it("updates only the specified rule", async () => {
      const manifest: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {
          "consistent-spacing": {
            version: "0.9.0",
            installedAt: "2024-01-01T00:00:00Z",
          },
          "no-arbitrary-tailwind": {
            version: "0.9.0",
            installedAt: "2024-01-01T00:00:00Z",
          },
        },
      };
      writeManifest(testDir, manifest);

      const analysis = analyzeForUpdates(testDir);
      const choices: UpdateChoices = {
        packagePaths: [testDir],
        ruleIds: ["consistent-spacing"], // Only update this rule
        confirmBreaking: false,
      };

      const plan = createUpdatePlan(analysis, choices);
      const result = await executeUpdatePlan(plan, { dryRun: false });

      expect(result.success).toBe(true);

      // Verify only consistent-spacing was updated
      const updated = readManifest(testDir);
      expect(updated?.rules["consistent-spacing"]?.version).toBe("1.0.0");
      // no-arbitrary-tailwind should still be at old version
      expect(updated?.rules["no-arbitrary-tailwind"]?.version).toBe("0.9.0");
    });
  });
});

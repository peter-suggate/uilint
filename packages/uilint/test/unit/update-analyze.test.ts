/**
 * Unit tests for update/analyze.ts
 *
 * Tests the analysis phase of the update command.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { analyzeForUpdates } from "../../src/commands/update/analyze.js";
import {
  writeManifest,
  MANIFEST_SCHEMA_VERSION,
  type RuleManifest,
} from "../../src/utils/manifest.js";

describe("Update Analyze", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(
      tmpdir(),
      `uilint-update-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    mkdirSync(join(testDir, ".uilint", "rules"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("analyzeForUpdates", () => {
    it("detects outdated rules (installed 1.0.0, available 1.1.0)", () => {
      // Create manifest with old version
      const manifest: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {
          // This rule exists in registry with version 1.0.0
          // When we bump the registry version, this test will detect it
          "consistent-spacing": {
            version: "0.9.0", // Older than current
            installedAt: "2024-01-01T00:00:00Z",
          },
        },
      };
      writeManifest(testDir, manifest);

      const result = analyzeForUpdates(testDir);

      // Should find at least one update (consistent-spacing)
      const pkg = result.packages.find((p) => p.packagePath === testDir);
      expect(pkg).toBeDefined();

      const rule = pkg?.rules.find((r) => r.ruleId === "consistent-spacing");
      expect(rule).toBeDefined();
      expect(rule?.hasUpdate).toBe(true);
      expect(rule?.installedVersion).toBe("0.9.0");
      // Available version should be current (1.0.0)
      expect(rule?.availableVersion).toBe("1.0.0");
    });

    it("detects up-to-date rules (installed = available)", () => {
      // Create manifest with current version
      const manifest: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {
          "consistent-spacing": {
            version: "1.0.0", // Same as registry
            installedAt: "2024-01-01T00:00:00Z",
          },
        },
      };
      writeManifest(testDir, manifest);

      const result = analyzeForUpdates(testDir);

      const pkg = result.packages.find((p) => p.packagePath === testDir);
      const rule = pkg?.rules.find((r) => r.ruleId === "consistent-spacing");

      expect(rule?.hasUpdate).toBe(false);
      expect(rule?.installedVersion).toBe("1.0.0");
      expect(rule?.availableVersion).toBe("1.0.0");
    });

    it("handles missing manifest (treats as version 0.0.0)", () => {
      // No manifest written - should still work
      const result = analyzeForUpdates(testDir);

      // When no manifest exists, there are no installed rules to update
      const pkg = result.packages.find((p) => p.packagePath === testDir);
      expect(pkg?.rules).toHaveLength(0);
    });

    it("returns empty updates when all rules are current", () => {
      // Create manifest with all rules at current versions
      const manifest: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {
          "no-arbitrary-tailwind": {
            version: "1.0.0",
            installedAt: "2024-01-01T00:00:00Z",
          },
          "consistent-spacing": {
            version: "1.0.0",
            installedAt: "2024-01-01T00:00:00Z",
          },
        },
      };
      writeManifest(testDir, manifest);

      const result = analyzeForUpdates(testDir);

      const pkg = result.packages.find((p) => p.packagePath === testDir);
      const updatableRules = pkg?.rules.filter((r) => r.hasUpdate) ?? [];

      expect(updatableRules).toHaveLength(0);
      expect(result.totalUpdates).toBe(0);
    });

    it("identifies breaking migrations", () => {
      // This test would require a rule with breaking migrations defined
      // For now, we test that the field is populated correctly
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

      const result = analyzeForUpdates(testDir);

      const pkg = result.packages.find((p) => p.packagePath === testDir);
      const rule = pkg?.rules.find((r) => r.ruleId === "consistent-spacing");

      // hasBreakingChanges should be defined (currently no breaking migrations)
      expect(typeof rule?.hasBreakingChanges).toBe("boolean");
    });

    it("calculates total updates correctly", () => {
      const manifest: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {
          "no-arbitrary-tailwind": {
            version: "0.9.0", // Outdated
            installedAt: "2024-01-01T00:00:00Z",
          },
          "consistent-spacing": {
            version: "0.9.0", // Outdated
            installedAt: "2024-01-01T00:00:00Z",
          },
          "consistent-dark-mode": {
            version: "1.0.0", // Current
            installedAt: "2024-01-01T00:00:00Z",
          },
        },
      };
      writeManifest(testDir, manifest);

      const result = analyzeForUpdates(testDir);

      // Should have 2 updates (no-arbitrary-tailwind and consistent-spacing)
      expect(result.totalUpdates).toBe(2);
    });
  });
});

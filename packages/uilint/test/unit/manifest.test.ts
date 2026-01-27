/**
 * Unit tests for manifest.ts
 *
 * Tests the manifest system for tracking installed rule versions.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  readManifest,
  writeManifest,
  updateManifestRule,
  createEmptyManifest,
  MANIFEST_SCHEMA_VERSION,
  type RuleManifest,
} from "../../src/utils/manifest.js";

describe("Manifest System", () => {
  let testDir: string;
  let manifestPath: string;

  beforeEach(() => {
    // Create a unique temp directory for each test
    testDir = join(tmpdir(), `uilint-manifest-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(testDir, ".uilint", "rules"), { recursive: true });
    manifestPath = join(testDir, ".uilint", "rules", "manifest.json");
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("readManifest", () => {
    it("returns null for missing manifest", () => {
      const result = readManifest(testDir);
      expect(result).toBeNull();
    });

    it("parses valid manifest JSON", () => {
      const validManifest: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {
          "prefer-tailwind": {
            version: "1.0.0",
            installedAt: "2024-01-01T00:00:00Z",
          },
        },
      };
      writeFileSync(manifestPath, JSON.stringify(validManifest, null, 2));

      const result = readManifest(testDir);

      expect(result).toEqual(validManifest);
    });

    it("handles corrupt JSON gracefully", () => {
      writeFileSync(manifestPath, "{ invalid json }");

      const result = readManifest(testDir);

      expect(result).toBeNull();
    });

    it("returns null for manifest with invalid schema version", () => {
      const invalidManifest = {
        schemaVersion: 999,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {},
      };
      writeFileSync(manifestPath, JSON.stringify(invalidManifest, null, 2));

      const result = readManifest(testDir);

      expect(result).toBeNull();
    });

    it("returns null for manifest missing required fields", () => {
      writeFileSync(manifestPath, JSON.stringify({ rules: {} }, null, 2));

      const result = readManifest(testDir);

      expect(result).toBeNull();
    });
  });

  describe("writeManifest", () => {
    it("creates new manifest with correct structure", () => {
      const manifest: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-15T12:00:00Z",
        uilintVersion: "0.2.0",
        rules: {
          "consistent-dark-mode": {
            version: "1.0.0",
            installedAt: "2024-01-15T12:00:00Z",
          },
        },
      };

      writeManifest(testDir, manifest);

      expect(existsSync(manifestPath)).toBe(true);
      const written = JSON.parse(readFileSync(manifestPath, "utf-8"));
      expect(written).toEqual(manifest);
    });

    it("overwrites existing manifest", () => {
      // Write initial manifest
      const initial: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {},
      };
      writeManifest(testDir, initial);

      // Write updated manifest
      const updated: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.2.0",
        rules: {
          "prefer-tailwind": {
            version: "1.0.0",
            installedAt: "2024-01-15T12:00:00Z",
          },
        },
      };
      writeManifest(testDir, updated);

      const result = readManifest(testDir);
      expect(result).toEqual(updated);
    });

    it("creates .uilint/rules directory if it does not exist", () => {
      // Remove the rules directory
      rmSync(join(testDir, ".uilint", "rules"), { recursive: true });

      const manifest: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-15T12:00:00Z",
        uilintVersion: "0.2.0",
        rules: {},
      };

      writeManifest(testDir, manifest);

      expect(existsSync(manifestPath)).toBe(true);
    });
  });

  describe("updateManifestRule", () => {
    it("updates single rule version in existing manifest", () => {
      const initial: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {
          "prefer-tailwind": {
            version: "1.0.0",
            installedAt: "2024-01-01T00:00:00Z",
          },
        },
      };
      writeManifest(testDir, initial);

      updateManifestRule(testDir, "prefer-tailwind", "1.1.0", "0.2.0");

      const result = readManifest(testDir);
      expect(result?.rules["prefer-tailwind"]?.version).toBe("1.1.0");
      // Should have updated installedAt timestamp
      expect(result?.rules["prefer-tailwind"]?.installedAt).not.toBe(
        "2024-01-01T00:00:00Z"
      );
    });

    it("adds new rule to existing manifest", () => {
      const initial: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {
          "prefer-tailwind": {
            version: "1.0.0",
            installedAt: "2024-01-01T00:00:00Z",
          },
        },
      };
      writeManifest(testDir, initial);

      updateManifestRule(testDir, "consistent-dark-mode", "1.0.0", "0.2.0");

      const result = readManifest(testDir);
      expect(result?.rules["prefer-tailwind"]).toBeDefined();
      expect(result?.rules["consistent-dark-mode"]).toBeDefined();
      expect(result?.rules["consistent-dark-mode"]?.version).toBe("1.0.0");
    });

    it("creates manifest if it does not exist", () => {
      // No manifest exists
      expect(readManifest(testDir)).toBeNull();

      updateManifestRule(testDir, "prefer-tailwind", "1.0.0", "0.2.0");

      const result = readManifest(testDir);
      expect(result).not.toBeNull();
      expect(result?.rules["prefer-tailwind"]?.version).toBe("1.0.0");
      expect(result?.uilintVersion).toBe("0.2.0");
    });

    it("preserves other rules when updating one rule", () => {
      const initial: RuleManifest = {
        schemaVersion: MANIFEST_SCHEMA_VERSION,
        installedAt: "2024-01-01T00:00:00Z",
        uilintVersion: "0.1.0",
        rules: {
          "rule-a": { version: "1.0.0", installedAt: "2024-01-01T00:00:00Z" },
          "rule-b": { version: "2.0.0", installedAt: "2024-01-01T00:00:00Z" },
          "rule-c": { version: "3.0.0", installedAt: "2024-01-01T00:00:00Z" },
        },
      };
      writeManifest(testDir, initial);

      updateManifestRule(testDir, "rule-b", "2.1.0", "0.2.0");

      const result = readManifest(testDir);
      expect(result?.rules["rule-a"]?.version).toBe("1.0.0");
      expect(result?.rules["rule-b"]?.version).toBe("2.1.0");
      expect(result?.rules["rule-c"]?.version).toBe("3.0.0");
    });
  });

  describe("createEmptyManifest", () => {
    it("creates manifest with correct schema version", () => {
      const manifest = createEmptyManifest("0.2.0");

      expect(manifest.schemaVersion).toBe(MANIFEST_SCHEMA_VERSION);
    });

    it("creates manifest with uilint version", () => {
      const manifest = createEmptyManifest("0.2.5");

      expect(manifest.uilintVersion).toBe("0.2.5");
    });

    it("creates manifest with empty rules object", () => {
      const manifest = createEmptyManifest("0.2.0");

      expect(manifest.rules).toEqual({});
    });

    it("creates manifest with ISO timestamp", () => {
      const before = new Date().toISOString();
      const manifest = createEmptyManifest("0.2.0");
      const after = new Date().toISOString();

      expect(manifest.installedAt >= before).toBe(true);
      expect(manifest.installedAt <= after).toBe(true);
    });
  });
});

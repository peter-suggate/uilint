/**
 * Tests for rule versioning requirements
 *
 * Ensures all rules have valid version fields and migration definitions.
 */

import { describe, it, expect } from "vitest";
import { ruleRegistry, type RuleMeta } from "../src/rule-registry.js";

describe("Rule Versioning", () => {
  it("all rules have a valid semver version field", () => {
    const semverRegex = /^\d+\.\d+\.\d+$/;

    for (const rule of ruleRegistry) {
      expect(rule.version, `Rule "${rule.id}" missing version`).toBeDefined();
      expect(
        semverRegex.test(rule.version),
        `Rule "${rule.id}" has invalid version "${rule.version}" (expected semver format X.Y.Z)`
      ).toBe(true);
    }
  });

  it("migration from/to versions are valid semver", () => {
    const semverRegex = /^\d+\.\d+\.\d+$/;

    for (const rule of ruleRegistry) {
      if (!rule.migrations) continue;

      for (const migration of rule.migrations) {
        expect(
          semverRegex.test(migration.from),
          `Rule "${rule.id}" migration has invalid "from" version "${migration.from}"`
        ).toBe(true);
        expect(
          semverRegex.test(migration.to),
          `Rule "${rule.id}" migration has invalid "to" version "${migration.to}"`
        ).toBe(true);
      }
    }
  });

  it("migration chains are continuous (no gaps)", () => {
    for (const rule of ruleRegistry) {
      if (!rule.migrations || rule.migrations.length < 2) continue;

      // Sort migrations by "from" version
      const sorted = [...rule.migrations].sort((a, b) =>
        compareVersions(a.from, b.from)
      );

      // Check that each migration's "to" matches next migration's "from"
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i]!;
        const next = sorted[i + 1]!;

        expect(
          current.to,
          `Rule "${rule.id}" has gap in migration chain: ${current.to} -> ${next.from}`
        ).toBe(next.from);
      }
    }
  });

  it("migration functions are callable", () => {
    for (const rule of ruleRegistry) {
      if (!rule.migrations) continue;

      for (const migration of rule.migrations) {
        expect(
          typeof migration.migrate,
          `Rule "${rule.id}" migration ${migration.from} -> ${migration.to} has non-function migrate property`
        ).toBe("function");

        // Test that migrate can be called with empty array without throwing
        expect(() => {
          migration.migrate([]);
        }).not.toThrow();
      }
    }
  });

  it("all rules have unique IDs", () => {
    const ids = new Set<string>();

    for (const rule of ruleRegistry) {
      expect(
        ids.has(rule.id),
        `Duplicate rule ID: ${rule.id}`
      ).toBe(false);
      ids.add(rule.id);
    }
  });
});

/**
 * Compare two semver versions
 * Returns negative if a < b, positive if a > b, 0 if equal
 */
function compareVersions(a: string, b: string): number {
  const aParts = a.split(".").map(Number);
  const bParts = b.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const diff = (aParts[i] ?? 0) - (bParts[i] ?? 0);
    if (diff !== 0) return diff;
  }

  return 0;
}

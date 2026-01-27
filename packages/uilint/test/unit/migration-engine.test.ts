/**
 * Unit tests for migration-engine.ts
 *
 * Tests the migration engine for transforming rule options between versions.
 */

import { describe, it, expect } from "vitest";
import type { RuleMigration } from "uilint-eslint";
import {
  findMigrationPath,
  applyMigrations,
  getMigrationsForRule,
} from "../../src/utils/migration-engine.js";

describe("Migration Engine", () => {
  describe("findMigrationPath", () => {
    it("finds direct migration (1.0.0 → 1.1.0)", () => {
      const migrations: RuleMigration[] = [
        {
          from: "1.0.0",
          to: "1.1.0",
          description: "Add new option",
          migrate: (opts) => opts,
        },
      ];

      const path = findMigrationPath("1.0.0", "1.1.0", migrations);

      expect(path).toHaveLength(1);
      expect(path[0]!.from).toBe("1.0.0");
      expect(path[0]!.to).toBe("1.1.0");
    });

    it("chains migrations (1.0.0 → 1.1.0 → 1.2.0)", () => {
      const migrations: RuleMigration[] = [
        {
          from: "1.0.0",
          to: "1.1.0",
          description: "First step",
          migrate: (opts) => opts,
        },
        {
          from: "1.1.0",
          to: "1.2.0",
          description: "Second step",
          migrate: (opts) => opts,
        },
      ];

      const path = findMigrationPath("1.0.0", "1.2.0", migrations);

      expect(path).toHaveLength(2);
      expect(path[0]!.from).toBe("1.0.0");
      expect(path[0]!.to).toBe("1.1.0");
      expect(path[1]!.from).toBe("1.1.0");
      expect(path[1]!.to).toBe("1.2.0");
    });

    it("chains longer migration paths", () => {
      const migrations: RuleMigration[] = [
        {
          from: "1.0.0",
          to: "1.1.0",
          description: "Step 1",
          migrate: (opts) => opts,
        },
        {
          from: "1.1.0",
          to: "1.2.0",
          description: "Step 2",
          migrate: (opts) => opts,
        },
        {
          from: "1.2.0",
          to: "2.0.0",
          description: "Step 3",
          migrate: (opts) => opts,
        },
        {
          from: "2.0.0",
          to: "2.1.0",
          description: "Step 4",
          migrate: (opts) => opts,
        },
      ];

      const path = findMigrationPath("1.0.0", "2.1.0", migrations);

      expect(path).toHaveLength(4);
      expect(path[0]!.from).toBe("1.0.0");
      expect(path[3]!.to).toBe("2.1.0");
    });

    it("returns empty array when no path exists", () => {
      const migrations: RuleMigration[] = [
        {
          from: "1.0.0",
          to: "1.1.0",
          description: "Some migration",
          migrate: (opts) => opts,
        },
      ];

      const path = findMigrationPath("1.0.0", "2.0.0", migrations);

      expect(path).toHaveLength(0);
    });

    it("returns empty array when versions are the same", () => {
      const migrations: RuleMigration[] = [
        {
          from: "1.0.0",
          to: "1.1.0",
          description: "Some migration",
          migrate: (opts) => opts,
        },
      ];

      const path = findMigrationPath("1.0.0", "1.0.0", migrations);

      expect(path).toHaveLength(0);
    });

    it("returns empty array for empty migrations", () => {
      const path = findMigrationPath("1.0.0", "2.0.0", []);

      expect(path).toHaveLength(0);
    });

    it("handles circular migration definitions gracefully", () => {
      const migrations: RuleMigration[] = [
        {
          from: "1.0.0",
          to: "1.1.0",
          description: "Forward",
          migrate: (opts) => opts,
        },
        {
          from: "1.1.0",
          to: "1.0.0",
          description: "Backward (should be ignored)",
          migrate: (opts) => opts,
        },
      ];

      // Should not get stuck in infinite loop
      const path = findMigrationPath("1.0.0", "1.1.0", migrations);

      expect(path).toHaveLength(1);
      expect(path[0]!.to).toBe("1.1.0");
    });

    it("finds path when migrations are out of order", () => {
      const migrations: RuleMigration[] = [
        {
          from: "1.1.0",
          to: "1.2.0",
          description: "Second step",
          migrate: (opts) => opts,
        },
        {
          from: "1.0.0",
          to: "1.1.0",
          description: "First step",
          migrate: (opts) => opts,
        },
      ];

      const path = findMigrationPath("1.0.0", "1.2.0", migrations);

      expect(path).toHaveLength(2);
      expect(path[0]!.from).toBe("1.0.0");
      expect(path[1]!.to).toBe("1.2.0");
    });
  });

  describe("applyMigrations", () => {
    it("applies single migration", () => {
      const migrations: RuleMigration[] = [
        {
          from: "1.0.0",
          to: "1.1.0",
          description: "Add newOption",
          migrate: (opts) => {
            const [first = {}] = opts as [Record<string, unknown>?];
            return [{ ...first, newOption: true }];
          },
        },
      ];

      const result = applyMigrations([{ existingOption: "value" }], migrations);

      expect(result).toEqual([
        { existingOption: "value", newOption: true },
      ]);
    });

    it("chains multiple migrations in order", () => {
      const migrations: RuleMigration[] = [
        {
          from: "1.0.0",
          to: "1.1.0",
          description: "Add fieldA",
          migrate: (opts) => {
            const [first = {}] = opts as [Record<string, unknown>?];
            return [{ ...first, fieldA: 1 }];
          },
        },
        {
          from: "1.1.0",
          to: "1.2.0",
          description: "Add fieldB based on fieldA",
          migrate: (opts) => {
            const [first = {}] = opts as [Record<string, unknown>?];
            return [{ ...first, fieldB: (first.fieldA as number) * 2 }];
          },
        },
      ];

      const result = applyMigrations([{}], migrations);

      expect(result).toEqual([{ fieldA: 1, fieldB: 2 }]);
    });

    it("preserves options not affected by migration", () => {
      const migrations: RuleMigration[] = [
        {
          from: "1.0.0",
          to: "1.1.0",
          description: "Add only newField",
          migrate: (opts) => {
            const [first = {}] = opts as [Record<string, unknown>?];
            return [{ ...first, newField: "added" }];
          },
        },
      ];

      const result = applyMigrations(
        [{ existing: "preserved", another: 42 }],
        migrations
      );

      expect(result).toEqual([
        { existing: "preserved", another: 42, newField: "added" },
      ]);
    });

    it("handles empty migrations array", () => {
      const original = [{ option: "value" }];
      const result = applyMigrations(original, []);

      expect(result).toEqual(original);
    });

    it("handles empty options array", () => {
      const migrations: RuleMigration[] = [
        {
          from: "1.0.0",
          to: "1.1.0",
          description: "Handle empty",
          migrate: (opts) => opts,
        },
      ];

      const result = applyMigrations([], migrations);

      expect(result).toEqual([]);
    });

    it("handles migration that renames a field", () => {
      const migrations: RuleMigration[] = [
        {
          from: "1.0.0",
          to: "1.1.0",
          description: "Rename oldName to newName",
          migrate: (opts) => {
            const [first = {}] = opts as [Record<string, unknown>?];
            const { oldName, ...rest } = first as { oldName?: unknown };
            return [{ ...rest, newName: oldName }];
          },
        },
      ];

      const result = applyMigrations([{ oldName: "value" }], migrations);

      expect(result).toEqual([{ newName: "value" }]);
      expect((result[0] as Record<string, unknown>).oldName).toBeUndefined();
    });
  });

  describe("getMigrationsForRule", () => {
    it("returns migrations from rule registry", () => {
      // This test depends on actual rules having migrations
      // For rules without migrations, it should return empty array
      const migrations = getMigrationsForRule("consistent-dark-mode");

      // Currently no migrations defined, so should be empty
      expect(Array.isArray(migrations)).toBe(true);
    });

    it("returns empty array for unknown rule", () => {
      const migrations = getMigrationsForRule("nonexistent-rule");

      expect(migrations).toEqual([]);
    });

    it("returns empty array for rule without migrations", () => {
      // prefer-tailwind has no migrations defined
      const migrations = getMigrationsForRule("prefer-tailwind");

      expect(migrations).toEqual([]);
    });
  });
});

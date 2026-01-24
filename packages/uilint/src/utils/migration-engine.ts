/**
 * Migration Engine
 *
 * Handles migrating rule options between versions using migration definitions.
 */

import { getRuleMetadata, type RuleMigration } from "uilint-eslint";

/**
 * Find a path of migrations to get from one version to another.
 *
 * Uses BFS to find the shortest path through the migration graph.
 *
 * @param from - Starting version (installed version)
 * @param to - Target version (available version)
 * @param migrations - Available migrations for the rule
 * @returns Array of migrations to apply in order, or empty array if no path exists
 */
export function findMigrationPath(
  from: string,
  to: string,
  migrations: RuleMigration[]
): RuleMigration[] {
  // No migration needed if versions are the same
  if (from === to) {
    return [];
  }

  // No migrations available
  if (migrations.length === 0) {
    return [];
  }

  // Build a map of version -> outgoing migrations
  const migrationMap = new Map<string, RuleMigration[]>();
  for (const migration of migrations) {
    const existing = migrationMap.get(migration.from) ?? [];
    existing.push(migration);
    migrationMap.set(migration.from, existing);
  }

  // BFS to find path
  const visited = new Set<string>();
  const queue: { version: string; path: RuleMigration[] }[] = [
    { version: from, path: [] },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (visited.has(current.version)) {
      continue;
    }
    visited.add(current.version);

    const outgoing = migrationMap.get(current.version) ?? [];
    for (const migration of outgoing) {
      const newPath = [...current.path, migration];

      // Found the target
      if (migration.to === to) {
        return newPath;
      }

      // Add to queue for further exploration
      if (!visited.has(migration.to)) {
        queue.push({ version: migration.to, path: newPath });
      }
    }
  }

  // No path found
  return [];
}

/**
 * Apply a sequence of migrations to transform options.
 *
 * @param options - The current rule options array
 * @param migrations - Migrations to apply in order
 * @returns Transformed options array
 */
export function applyMigrations(
  options: unknown[],
  migrations: RuleMigration[]
): unknown[] {
  let current = options;

  for (const migration of migrations) {
    current = migration.migrate(current);
  }

  return current;
}

/**
 * Get migrations defined for a specific rule.
 *
 * @param ruleId - The rule ID to look up
 * @returns Array of migrations, or empty array if none defined
 */
export function getMigrationsForRule(ruleId: string): RuleMigration[] {
  const ruleMeta = getRuleMetadata(ruleId);
  if (!ruleMeta) {
    return [];
  }

  return ruleMeta.migrations ?? [];
}

/**
 * Check if there are any breaking migrations in a migration path.
 *
 * @param migrations - The migration path to check
 * @returns True if any migration is marked as breaking
 */
export function hasBreakingMigrations(migrations: RuleMigration[]): boolean {
  return migrations.some((m) => m.breaking === true);
}

/**
 * Get descriptions of all migrations in a path.
 *
 * @param migrations - The migration path
 * @returns Array of migration descriptions
 */
export function getMigrationDescriptions(migrations: RuleMigration[]): string[] {
  return migrations.map(
    (m) => `${m.from} → ${m.to}: ${m.description}${m.breaking ? " (BREAKING)" : ""}`
  );
}

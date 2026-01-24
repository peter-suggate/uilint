/**
 * Manifest System
 *
 * Manages the manifest file that tracks installed rule versions.
 * Location: .uilint/rules/manifest.json
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";

/**
 * Current schema version for the manifest file.
 * Increment when making breaking changes to the manifest structure.
 */
export const MANIFEST_SCHEMA_VERSION = 1;

/**
 * Information about an installed rule
 */
export interface InstalledRuleInfo {
  /** Semantic version of the installed rule */
  version: string;
  /** ISO timestamp of when this rule was installed/updated */
  installedAt: string;
}

/**
 * The manifest file structure
 */
export interface RuleManifest {
  /** Schema version for forward compatibility */
  schemaVersion: number;
  /** ISO timestamp of initial installation */
  installedAt: string;
  /** Version of uilint CLI that created/updated this manifest */
  uilintVersion: string;
  /** Map of rule IDs to their installation info */
  rules: Record<string, InstalledRuleInfo>;
}

/**
 * Get the path to the manifest file for a project
 */
export function getManifestPath(projectPath: string): string {
  return join(projectPath, ".uilint", "rules", "manifest.json");
}

/**
 * Read the manifest file for a project
 *
 * @param projectPath - Path to the project root
 * @returns The parsed manifest, or null if not found or invalid
 */
export function readManifest(projectPath: string): RuleManifest | null {
  const manifestPath = getManifestPath(projectPath);

  if (!existsSync(manifestPath)) {
    return null;
  }

  try {
    const content = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(content) as unknown;

    // Validate manifest structure
    if (!isValidManifest(manifest)) {
      return null;
    }

    return manifest as RuleManifest;
  } catch {
    // Invalid JSON or read error
    return null;
  }
}

/**
 * Validate that an object is a valid manifest
 */
function isValidManifest(obj: unknown): obj is RuleManifest {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }

  const manifest = obj as Record<string, unknown>;

  // Check required fields
  if (typeof manifest.schemaVersion !== "number") {
    return false;
  }
  if (manifest.schemaVersion !== MANIFEST_SCHEMA_VERSION) {
    return false;
  }
  if (typeof manifest.installedAt !== "string") {
    return false;
  }
  if (typeof manifest.uilintVersion !== "string") {
    return false;
  }
  if (typeof manifest.rules !== "object" || manifest.rules === null) {
    return false;
  }

  return true;
}

/**
 * Write a manifest file to a project
 *
 * @param projectPath - Path to the project root
 * @param manifest - The manifest to write
 */
export function writeManifest(
  projectPath: string,
  manifest: RuleManifest
): void {
  const manifestPath = getManifestPath(projectPath);
  const dir = dirname(manifestPath);

  // Ensure directory exists
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

/**
 * Update a single rule's version in the manifest
 *
 * Creates the manifest if it doesn't exist.
 *
 * @param projectPath - Path to the project root
 * @param ruleId - The rule ID to update
 * @param version - The new version of the rule
 * @param uilintVersion - The version of uilint CLI performing the update
 */
export function updateManifestRule(
  projectPath: string,
  ruleId: string,
  version: string,
  uilintVersion: string
): void {
  const now = new Date().toISOString();
  let manifest = readManifest(projectPath);

  if (!manifest) {
    manifest = createEmptyManifest(uilintVersion);
  }

  // Update the rule entry
  manifest.rules[ruleId] = {
    version,
    installedAt: now,
  };

  // Update uilint version to the latest
  manifest.uilintVersion = uilintVersion;

  writeManifest(projectPath, manifest);
}

/**
 * Create an empty manifest with default values
 *
 * @param uilintVersion - The version of uilint CLI
 * @returns A new empty manifest
 */
export function createEmptyManifest(uilintVersion: string): RuleManifest {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    installedAt: new Date().toISOString(),
    uilintVersion,
    rules: {},
  };
}

/**
 * Get the installed version of a specific rule
 *
 * @param projectPath - Path to the project root
 * @param ruleId - The rule ID to look up
 * @returns The installed version, or null if not installed
 */
export function getInstalledRuleVersion(
  projectPath: string,
  ruleId: string
): string | null {
  const manifest = readManifest(projectPath);
  if (!manifest) {
    return null;
  }

  return manifest.rules[ruleId]?.version ?? null;
}

/**
 * Get all installed rule versions
 *
 * @param projectPath - Path to the project root
 * @returns Map of rule IDs to versions, or empty object if no manifest
 */
export function getInstalledRuleVersions(
  projectPath: string
): Record<string, string> {
  const manifest = readManifest(projectPath);
  if (!manifest) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [ruleId, info] of Object.entries(manifest.rules)) {
    result[ruleId] = info.version;
  }
  return result;
}

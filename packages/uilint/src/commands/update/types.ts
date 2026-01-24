/**
 * Type definitions for the update command
 *
 * The update process follows the same pattern as install:
 * 1. Analyze - compare installed vs available versions
 * 2. Plan - generate update actions
 * 3. Execute - perform updates and migrations
 */

import type { RuleMigration } from "uilint-eslint";
import type { PackageManager, UilintPackage } from "../../utils/package-manager.js";

// ============================================================================
// Phase 1: Analyze - UpdateAnalysis
// ============================================================================

/**
 * Information about a single rule that can be updated
 */
export interface RuleUpdateInfo {
  /** Rule identifier */
  ruleId: string;
  /** Currently installed version (from manifest), or "0.0.0" if not in manifest */
  installedVersion: string;
  /** Latest available version (from rule registry) */
  availableVersion: string;
  /** Whether an update is available */
  hasUpdate: boolean;
  /** Migration path from installed to available version */
  migrations: RuleMigration[];
  /** Whether any migration is breaking */
  hasBreakingChanges: boolean;
}

/**
 * Information about an installed uilint npm package
 */
export interface InstalledPackageInfo {
  /** Package name */
  name: UilintPackage;
  /** Currently installed version */
  installedVersion: string;
}

/**
 * Information about a package that has rules to update
 */
export interface PackageUpdateInfo {
  /** Path to the package */
  packagePath: string;
  /** Display name for the package */
  displayName: string;
  /** Path to ESLint config if found */
  eslintConfigPath: string | null;
  /** Detected package manager */
  packageManager: PackageManager;
  /** Installed uilint npm packages */
  installedPackages: InstalledPackageInfo[];
  /** Rules that can be updated */
  rules: RuleUpdateInfo[];
  /** Total number of rules with updates */
  updatableCount: number;
  /** Whether any updates have breaking changes */
  hasBreakingChanges: boolean;
}

/**
 * Analysis result for the update command
 */
export interface UpdateAnalysis {
  /** Workspace root path */
  workspaceRoot: string;
  /** Detected package manager */
  packageManager: PackageManager;
  /** Packages with potential updates */
  packages: PackageUpdateInfo[];
  /** Total rules that can be updated across all packages */
  totalUpdates: number;
  /** Whether any updates have breaking changes */
  hasBreakingChanges: boolean;
}

// ============================================================================
// Phase 2: Plan - UpdatePlan
// ============================================================================

/**
 * Action to copy updated rule files
 */
export interface CopyRuleFilesAction {
  type: "copy_rule_files";
  packagePath: string;
  ruleId: string;
  version: string;
}

/**
 * Action to migrate rule options in ESLint config
 */
export interface MigrateRuleOptionsAction {
  type: "migrate_rule_options";
  configPath: string;
  ruleId: string;
  migrations: RuleMigration[];
}

/**
 * Action to update manifest with new version
 */
export interface UpdateManifestVersionAction {
  type: "update_manifest_version";
  packagePath: string;
  ruleId: string;
  version: string;
}

/**
 * Action to update npm packages
 */
export interface UpdateNpmPackagesAction {
  type: "update_npm_packages";
  packagePath: string;
  packageManager: PackageManager;
  packages: string[];
}

export type UpdateAction =
  | CopyRuleFilesAction
  | MigrateRuleOptionsAction
  | UpdateManifestVersionAction
  | UpdateNpmPackagesAction;

/**
 * Plan for updating rules
 */
export interface UpdatePlan {
  /** Actions to execute */
  actions: UpdateAction[];
  /** Rules being updated */
  rules: RuleUpdateInfo[];
}

// ============================================================================
// User Choices
// ============================================================================

/**
 * User choices for the update command
 */
export interface UpdateChoices {
  /** Package paths to update */
  packagePaths: string[];
  /** Specific rule IDs to update (empty = all) */
  ruleIds: string[];
  /** Whether to confirm breaking changes */
  confirmBreaking: boolean;
}

// ============================================================================
// Options
// ============================================================================

/**
 * Options for the update command
 */
export interface UpdateOptions {
  /** Show available updates without applying */
  check?: boolean;
  /** Auto-confirm all updates */
  yes?: boolean;
  /** Show what would change without modifying files */
  dryRun?: boolean;
  /** Update only a specific rule */
  rule?: string;
}

// ============================================================================
// Phase 3: Execute - UpdateResult
// ============================================================================

/**
 * Result of executing a single update action
 */
export interface UpdateActionResult {
  action: UpdateAction;
  success: boolean;
  error?: string;
  wouldDo?: string;
}

/**
 * Summary of the update operation
 */
export interface UpdateSummary {
  /** Number of rules updated */
  rulesUpdated: number;
  /** Number of packages affected */
  packagesUpdated: number;
  /** Files that were modified */
  filesModified: string[];
  /** Rules that had breaking changes */
  breakingChanges: string[];
}

/**
 * Result of the update execution
 */
export interface UpdateResult {
  success: boolean;
  actionsPerformed: UpdateActionResult[];
  summary: UpdateSummary;
}

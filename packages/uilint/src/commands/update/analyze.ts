/**
 * Analyze phase for the update command
 *
 * Compares installed rule versions against available versions
 * and identifies what can be updated.
 */

import { basename, relative } from "path";
import { getRuleMetadata, ruleRegistry } from "uilint-eslint";
import {
  detectPackageManager,
  getInstalledUilintPackages,
} from "../../utils/package-manager.js";
import { findWorkspaceRoot } from "uilint-core/node";
import { readManifest, getInstalledRuleVersions } from "../../utils/manifest.js";
import {
  findMigrationPath,
  getMigrationsForRule,
  hasBreakingMigrations,
} from "../../utils/migration-engine.js";
import type {
  UpdateAnalysis,
  PackageUpdateInfo,
  RuleUpdateInfo,
  InstalledPackageInfo,
} from "./types.js";

/**
 * Compare two semver versions
 * Returns true if available > installed
 */
function isNewerVersion(installed: string, available: string): boolean {
  const installedParts = installed.split(".").map(Number);
  const availableParts = available.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const a = availableParts[i] ?? 0;
    const b = installedParts[i] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }

  return false;
}

/**
 * Analyze a single rule for updates
 */
function analyzeRule(
  ruleId: string,
  installedVersion: string
): RuleUpdateInfo | null {
  const ruleMeta = getRuleMetadata(ruleId);
  if (!ruleMeta) {
    // Rule no longer exists in registry
    return null;
  }

  const availableVersion = ruleMeta.version ?? "1.0.0";
  const hasUpdate = isNewerVersion(installedVersion, availableVersion);

  // Find migration path if update is available
  const migrations = hasUpdate
    ? findMigrationPath(
        installedVersion,
        availableVersion,
        getMigrationsForRule(ruleId)
      )
    : [];

  return {
    ruleId,
    installedVersion,
    availableVersion,
    hasUpdate,
    migrations,
    hasBreakingChanges: hasBreakingMigrations(migrations),
  };
}

/**
 * Analyze a package for rule updates
 */
function analyzePackage(packagePath: string): PackageUpdateInfo {
  const installedVersions = getInstalledRuleVersions(packagePath);
  const rules: RuleUpdateInfo[] = [];

  // Check each installed rule
  for (const [ruleId, version] of Object.entries(installedVersions)) {
    const ruleInfo = analyzeRule(ruleId, version);
    if (ruleInfo) {
      rules.push(ruleInfo);
    }
  }

  const updatableRules = rules.filter((r) => r.hasUpdate);

  // Get installed uilint npm packages
  const installedPackagesMap = getInstalledUilintPackages(packagePath);
  const installedPackages: InstalledPackageInfo[] = [];
  for (const [name, version] of installedPackagesMap) {
    installedPackages.push({ name, installedVersion: version });
  }

  return {
    packagePath,
    displayName: basename(packagePath) || packagePath,
    eslintConfigPath: null, // TODO: detect ESLint config
    packageManager: detectPackageManager(packagePath),
    installedPackages,
    rules,
    updatableCount: updatableRules.length,
    hasBreakingChanges: updatableRules.some((r) => r.hasBreakingChanges),
  };
}

/**
 * Analyze a project for available rule updates
 *
 * @param projectPath - Path to the project (or package in a monorepo)
 * @returns Analysis of available updates
 */
export function analyzeForUpdates(projectPath: string): UpdateAnalysis {
  const workspaceRoot = findWorkspaceRoot(projectPath);
  const packageManager = detectPackageManager(projectPath);

  // For now, just analyze the single project path
  // TODO: In monorepo, scan all packages with manifests
  const packageInfo = analyzePackage(projectPath);
  const packages = [packageInfo];

  const totalUpdates = packages.reduce((sum, p) => sum + p.updatableCount, 0);
  const hasBreakingChanges = packages.some((p) => p.hasBreakingChanges);

  return {
    workspaceRoot,
    packageManager,
    packages,
    totalUpdates,
    hasBreakingChanges,
  };
}

/**
 * Get a summary of available updates for display
 */
export function formatUpdateSummary(analysis: UpdateAnalysis): string {
  const hasRuleUpdates = analysis.totalUpdates > 0;
  const hasPackages = analysis.packages.some(
    (p) => p.installedPackages.length > 0
  );

  if (!hasRuleUpdates && !hasPackages) {
    return "No uilint packages or rules found.";
  }

  const lines: string[] = [];

  for (const pkg of analysis.packages) {
    const hasUpdates =
      pkg.updatableCount > 0 || pkg.installedPackages.length > 0;
    if (!hasUpdates) continue;

    lines.push(`${pkg.displayName}:`);

    // Show installed npm packages
    if (pkg.installedPackages.length > 0) {
      lines.push("  npm packages:");
      for (const npmPkg of pkg.installedPackages) {
        lines.push(`    ${npmPkg.name}: ${npmPkg.installedVersion} → latest`);
      }
    }

    // Show rule updates
    if (pkg.updatableCount > 0) {
      lines.push("  rules:");
      for (const rule of pkg.rules) {
        if (!rule.hasUpdate) continue;

        const breaking = rule.hasBreakingChanges ? " (BREAKING)" : "";
        lines.push(
          `    ${rule.ruleId}: ${rule.installedVersion} → ${rule.availableVersion}${breaking}`
        );
      }
    }

    lines.push("");
  }

  if (analysis.hasBreakingChanges) {
    lines.push("⚠️  Some rule updates contain breaking changes.");
  }

  return lines.join("\n");
}

/**
 * Package.json detection utilities for monorepo discovery
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

export interface PackageInfo {
  /** Absolute path to the package directory */
  path: string;
  /** Display name (relative path from workspace root) */
  displayPath: string;
  /** Package name from package.json */
  name: string;
  /** Whether this package has ESLint config */
  hasEslintConfig: boolean;
  /** Whether this appears to be a frontend/UI package */
  isFrontend: boolean;
  /** Whether this is the workspace root */
  isRoot: boolean;
}

const DEFAULT_IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "out",
  ".turbo",
  ".vercel",
  ".cursor",
  "coverage",
  ".uilint",
  ".pnpm",
]);

const ESLINT_CONFIG_FILES = [
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  ".eslintrc.js",
  ".eslintrc.cjs",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
  ".eslintrc",
];

const FRONTEND_INDICATORS = [
  "react",
  "react-dom",
  "next",
  "vue",
  "svelte",
  "@angular/core",
  "solid-js",
  "preact",
];

/**
 * Check if a package.json indicates a frontend project
 */
function isFrontendPackage(pkgJson: Record<string, unknown>): boolean {
  const deps = {
    ...(pkgJson.dependencies as Record<string, string> | undefined),
    ...(pkgJson.devDependencies as Record<string, string> | undefined),
  };

  return FRONTEND_INDICATORS.some((pkg) => pkg in deps);
}

/**
 * Check if directory has ESLint config
 */
function hasEslintConfig(dir: string): boolean {
  for (const file of ESLINT_CONFIG_FILES) {
    if (existsSync(join(dir, file))) {
      return true;
    }
  }

  // Also check package.json for eslintConfig field
  try {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      if (pkg.eslintConfig) return true;
    }
  } catch {
    // Ignore parse errors
  }

  return false;
}

/**
 * Find all packages in a workspace that could have ESLint installed
 */
export function findPackages(
  rootDir: string,
  options?: { maxDepth?: number; ignoreDirs?: Set<string> }
): PackageInfo[] {
  const maxDepth = options?.maxDepth ?? 5;
  const ignoreDirs = options?.ignoreDirs ?? DEFAULT_IGNORE_DIRS;
  const results: PackageInfo[] = [];
  const visited = new Set<string>();

  function processPackage(dir: string, isRoot: boolean): PackageInfo | null {
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) return null;

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const name = pkg.name || relative(rootDir, dir) || ".";

      return {
        path: dir,
        displayPath: relative(rootDir, dir) || ".",
        name,
        hasEslintConfig: hasEslintConfig(dir),
        isFrontend: isFrontendPackage(pkg),
        isRoot,
      };
    } catch {
      return null;
    }
  }

  function walk(dir: string, depth: number) {
    if (depth > maxDepth) return;
    if (visited.has(dir)) return;
    visited.add(dir);

    // Check for package.json in this dir
    const pkg = processPackage(dir, depth === 0);
    if (pkg) {
      results.push(pkg);
    }

    // Continue walking (even if we found a package - monorepos have nested packages)
    let entries: Array<{ name: string; isDirectory: boolean }> = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true }).map((d) => ({
        name: d.name,
        isDirectory: d.isDirectory(),
      }));
    } catch {
      return;
    }

    for (const ent of entries) {
      if (!ent.isDirectory) continue;
      if (ignoreDirs.has(ent.name)) continue;
      if (ent.name.startsWith(".")) continue;
      walk(join(dir, ent.name), depth + 1);
    }
  }

  walk(rootDir, 0);

  // Sort: frontend packages first, then by path
  return results.sort((a, b) => {
    // Root package first
    if (a.isRoot && !b.isRoot) return -1;
    if (!a.isRoot && b.isRoot) return 1;
    // Frontend packages next
    if (a.isFrontend && !b.isFrontend) return -1;
    if (!a.isFrontend && b.isFrontend) return 1;
    // Then alphabetically by path
    return a.displayPath.localeCompare(b.displayPath);
  });
}

/**
 * Format package info for display in selection menu
 */
export function formatPackageOption(pkg: PackageInfo): {
  value: string;
  label: string;
  hint?: string;
} {
  const hints: string[] = [];

  if (pkg.isRoot) hints.push("workspace root");
  if (pkg.isFrontend) hints.push("frontend");
  if (pkg.hasEslintConfig) hints.push("has ESLint config");

  return {
    value: pkg.path,
    label:
      pkg.displayPath === "." ? pkg.name : `${pkg.name} (${pkg.displayPath})`,
    hint: hints.length > 0 ? hints.join(", ") : undefined,
  };
}

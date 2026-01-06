/**
 * Styleguide loader for the LLM semantic rule
 *
 * Only the semantic rule reads the styleguide - static rules use ESLint options.
 */

import { existsSync, readFileSync } from "fs";
import { dirname, isAbsolute, join, resolve } from "path";

const DEFAULT_STYLEGUIDE_PATHS = [
  ".uilint/styleguide.md",
  ".uilint/styleguide.yaml",
  ".uilint/styleguide.yml",
];

/**
 * Find workspace root by walking up looking for pnpm-workspace.yaml, package.json, or .git
 */
function findWorkspaceRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 20; i++) {
    if (
      existsSync(join(dir, "pnpm-workspace.yaml")) ||
      existsSync(join(dir, ".git"))
    ) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

/**
 * Find the nearest package root (directory containing package.json),
 * stopping at the workspace root.
 */
function findNearestPackageRoot(startDir: string, workspaceRoot: string): string {
  let dir = startDir;
  for (let i = 0; i < 30; i++) {
    if (existsSync(join(dir, "package.json"))) return dir;
    if (dir === workspaceRoot) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

/**
 * Find the styleguide file path
 */
export function findStyleguidePath(
  startDir: string,
  explicitPath?: string
): string | null {
  // Explicit path takes precedence
  if (explicitPath) {
    if (isAbsolute(explicitPath)) {
      return existsSync(explicitPath) ? explicitPath : null;
    }

    // For relative explicit paths, try:
    // 1) relative to the file dir (back-compat)
    // 2) relative to the nearest package root (typical "project root")
    // 3) relative to workspace root (monorepo root)
    const workspaceRoot = findWorkspaceRoot(startDir);
    const packageRoot = findNearestPackageRoot(startDir, workspaceRoot);

    const candidates = [
      resolve(startDir, explicitPath),
      resolve(packageRoot, explicitPath),
      resolve(workspaceRoot, explicitPath),
    ];

    for (const p of candidates) {
      if (existsSync(p)) return p;
    }

    return null;
  }

  // Check from start dir up to workspace root
  const workspaceRoot = findWorkspaceRoot(startDir);
  let dir = startDir;

  while (true) {
    for (const relativePath of DEFAULT_STYLEGUIDE_PATHS) {
      const fullPath = join(dir, relativePath);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }

    // Stop at workspace root
    if (dir === workspaceRoot) break;

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

/**
 * Load styleguide content from file
 */
export function loadStyleguide(
  startDir: string,
  explicitPath?: string
): string | null {
  const path = findStyleguidePath(startDir, explicitPath);
  if (!path) return null;

  try {
    return readFileSync(path, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Get styleguide path and content
 */
export function getStyleguide(
  startDir: string,
  explicitPath?: string
): { path: string | null; content: string | null } {
  const path = findStyleguidePath(startDir, explicitPath);
  if (!path) return { path: null, content: null };

  try {
    const content = readFileSync(path, "utf-8");
    return { path, content };
  } catch {
    return { path, content: null };
  }
}

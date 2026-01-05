/**
 * Style guide file operations
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";

export const STYLEGUIDE_PATHS = [
  ".uilint/styleguide.md",
  "styleguide.md",
  ".uilint/style-guide.md",
];

/**
 * Walk upward from a starting directory and look specifically for `.uilint/styleguide.md`.
 *
 * This is intended for flows where the "project root" is ambiguous (e.g., analyzing
 * an arbitrary file path) and we want the nearest `.uilint` config on the way up.
 */
export function findUILintStyleGuideUpwards(startDir: string): string | null {
  let dir = startDir;
  for (;;) {
    const candidate = join(dir, ".uilint", "styleguide.md");
    if (existsSync(candidate)) return candidate;

    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Finds the style guide file in a project
 */
export function findStyleGuidePath(projectPath: string): string | null {
  for (const relativePath of STYLEGUIDE_PATHS) {
    const fullPath = join(projectPath, relativePath);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Reads the style guide content
 */
export async function readStyleGuide(path: string): Promise<string> {
  return readFile(path, "utf-8");
}

/**
 * Reads style guide from project path, finding it automatically
 */
export async function readStyleGuideFromProject(
  projectPath: string
): Promise<string | null> {
  const path = findStyleGuidePath(projectPath);
  if (!path) return null;
  return readStyleGuide(path);
}

/**
 * Writes style guide content to file
 */
export async function writeStyleGuide(
  path: string,
  content: string
): Promise<void> {
  const dir = dirname(path);
  await mkdir(dir, { recursive: true });
  await writeFile(path, content, "utf-8");
}

/**
 * Gets the default style guide path for a project
 */
export function getDefaultStyleGuidePath(projectPath: string): string {
  return join(projectPath, ".uilint", "styleguide.md");
}

/**
 * Checks if a style guide exists
 */
export function styleGuideExists(projectPath: string): boolean {
  return findStyleGuidePath(projectPath) !== null;
}

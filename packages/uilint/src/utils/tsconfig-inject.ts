/**
 * Utility to add .uilint to tsconfig.json exclude array
 *
 * When uilint installs ESLint rules to .uilint/rules/, we need to exclude
 * this directory from the app's TypeScript compilation to prevent build errors.
 * The rules are loaded dynamically by ESLint at runtime, not compiled with the app.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export interface TsconfigInjectResult {
  /** Whether the file was modified */
  modified: boolean;
  /** Path to tsconfig.json if found */
  tsconfigPath?: string;
  /** Error message if something went wrong */
  error?: string;
}

/**
 * Add .uilint to tsconfig.json exclude array
 *
 * @param projectPath - Path to the project root containing tsconfig.json
 * @returns Result indicating whether the file was modified
 */
export function injectTsconfigExclusion(
  projectPath: string
): TsconfigInjectResult {
  const tsconfigPath = join(projectPath, "tsconfig.json");

  // If no tsconfig.json, that's fine - project might be JS-only
  if (!existsSync(tsconfigPath)) {
    return { modified: false };
  }

  try {
    const content = readFileSync(tsconfigPath, "utf-8");
    const tsconfig = JSON.parse(content) as {
      exclude?: string[];
      [key: string]: unknown;
    };

    // Check if .uilint is already in exclude
    const exclude = tsconfig.exclude ?? [];
    if (exclude.includes(".uilint")) {
      return { modified: false, tsconfigPath };
    }

    // Add .uilint to exclude array
    tsconfig.exclude = [...exclude, ".uilint"];

    // Write back with same formatting (2-space indent is standard for tsconfig)
    writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n", "utf-8");

    return { modified: true, tsconfigPath };
  } catch (err) {
    return {
      modified: false,
      tsconfigPath,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

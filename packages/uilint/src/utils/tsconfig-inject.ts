/**
 * Utility to modify tsconfig.json for uilint integration
 *
 * When uilint installs ESLint rules to .uilint/rules/, we need to exclude
 * this directory from the app's TypeScript compilation to prevent build errors.
 * The rules are loaded dynamically by ESLint at runtime, not compiled with the app.
 *
 * When uilint-react devtools are installed, we need to add the devtools types
 * to compilerOptions.types so TypeScript recognizes the uilint-devtools custom element.
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

export interface TsconfigInjectOptions {
  /** Whether to add uilint-react/devtools to compilerOptions.types */
  addDevtoolsTypes?: boolean;
}

const DEVTOOLS_TYPE = "uilint-react/devtools";

/**
 * Modify tsconfig.json for uilint integration
 *
 * @param projectPath - Path to the project root containing tsconfig.json
 * @param options - Options for what to inject
 * @returns Result indicating whether the file was modified
 */
export function injectTsconfigExclusion(
  projectPath: string,
  options: TsconfigInjectOptions = {}
): TsconfigInjectResult {
  const { addDevtoolsTypes = false } = options;
  const tsconfigPath = join(projectPath, "tsconfig.json");

  // If no tsconfig.json, that's fine - project might be JS-only
  if (!existsSync(tsconfigPath)) {
    return { modified: false };
  }

  try {
    const content = readFileSync(tsconfigPath, "utf-8");
    const tsconfig = JSON.parse(content) as {
      exclude?: string[];
      compilerOptions?: {
        types?: string[];
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };

    let modified = false;

    // Check if .uilint is already in exclude
    const exclude = tsconfig.exclude ?? [];
    if (!exclude.includes(".uilint")) {
      // Add .uilint to exclude array
      tsconfig.exclude = [...exclude, ".uilint"];
      modified = true;
    }

    // Add devtools types if requested
    if (addDevtoolsTypes) {
      // Ensure compilerOptions exists
      if (!tsconfig.compilerOptions) {
        tsconfig.compilerOptions = {};
      }

      const types = tsconfig.compilerOptions.types;

      if (types === undefined) {
        // types field doesn't exist - add it with the devtools type
        tsconfig.compilerOptions.types = [DEVTOOLS_TYPE];
        modified = true;
      } else if (Array.isArray(types) && !types.includes(DEVTOOLS_TYPE)) {
        // types exists as array but doesn't have devtools - add it
        tsconfig.compilerOptions.types = [...types, DEVTOOLS_TYPE];
        modified = true;
      }
      // If types already includes DEVTOOLS_TYPE, no change needed
    }

    if (!modified) {
      return { modified: false, tsconfigPath };
    }

    // Write back with same formatting (2-space indent is standard for tsconfig)
    writeFileSync(
      tsconfigPath,
      JSON.stringify(tsconfig, null, 2) + "\n",
      "utf-8"
    );

    return { modified: true, tsconfigPath };
  } catch (err) {
    return {
      modified: false,
      tsconfigPath,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

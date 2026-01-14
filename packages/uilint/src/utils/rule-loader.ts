/**
 * Rule Loader Utility
 *
 * Loads ESLint rule source files from the uilint-eslint package for installation
 * into user projects. Rules are copied to .uilint/rules/ in the target project.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

function getUilintEslintPackageRoot(): string {
  // `uilint-eslint` uses package.json "exports", so we cannot rely on
  // require.resolve("uilint-eslint/package.json") (it throws ERR_PACKAGE_PATH_NOT_EXPORTED).
  //
  // Instead, resolve the entrypoint and walk up to the package root.
  const entry = require.resolve("uilint-eslint"); // typically .../dist/index.js
  const entryDir = dirname(entry); // typically .../dist
  return dirname(entryDir); // package root
}

/**
 * Represents a file for a rule (implementation or test)
 */
export interface RuleFile {
  /** Relative path within the rules directory (e.g., "no-arbitrary-tailwind.ts") */
  relativePath: string;
  /** File content */
  content: string;
}

/**
 * Represents a complete rule ready for installation
 */
export interface RuleFiles {
  /** Rule identifier (e.g., "no-arbitrary-tailwind") */
  ruleId: string;
  /** Implementation file */
  implementation: RuleFile;
  /** Test file (if exists) */
  test?: RuleFile;
}

/**
 * Get the path to the uilint-eslint package source directory
 */
function getUilintEslintSrcDir(): string {
  // In development: packages/uilint-eslint/src/
  // In production (installed): node_modules/uilint-eslint/src/

  // Try workspace/dev path first (repo layout)
  const devPath = join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "uilint-eslint",
    "src"
  );
  if (existsSync(devPath)) return devPath;

  // Try from installed package root (works with "exports")
  const pkgRoot = getUilintEslintPackageRoot();
  const srcPath = join(pkgRoot, "src");
  if (existsSync(srcPath)) return srcPath;

  throw new Error(
    'Could not find uilint-eslint "src/" directory. If you are using a published install of uilint-eslint, ensure it includes source files, or run a JS-only rules install.'
  );
}

/**
 * Get the path to the uilint-eslint package dist directory
 */
function getUilintEslintDistDir(): string {
  // In development: packages/uilint-eslint/dist/
  // In production (installed): node_modules/uilint-eslint/dist/

  // Try workspace/dev path first (repo layout)
  const devPath = join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "uilint-eslint",
    "dist"
  );
  if (existsSync(devPath)) return devPath;

  // Try from installed package root (works with "exports")
  const pkgRoot = getUilintEslintPackageRoot();
  const distPath = join(pkgRoot, "dist");
  if (existsSync(distPath)) return distPath;

  throw new Error(
    'Could not find uilint-eslint "dist/" directory. This is a bug in uilint installation.'
  );
}

/**
 * Transform rule content to fix imports for copied location
 * Changes imports from "../utils/create-rule.js" to "uilint-eslint"
 */
function transformRuleContent(content: string): string {
  // Replace relative imports to utils with uilint-eslint imports
  // Pattern: import { ... } from "../utils/create-rule.js" or similar
  let transformed = content;

  // Replace: import { createRule } from "../utils/create-rule.js"
  transformed = transformed.replace(
    /import\s+{\s*createRule\s*}\s+from\s+["']\.\.\/utils\/create-rule\.js["'];?/g,
    'import { createRule } from "uilint-eslint";'
  );

  // Replace: import createRule from "../utils/create-rule.js"
  transformed = transformed.replace(
    /import\s+createRule\s+from\s+["']\.\.\/utils\/create-rule\.js["'];?/g,
    'import { createRule } from "uilint-eslint";'
  );

  // Replace other utility imports (cache, styleguide-loader, etc.)
  transformed = transformed.replace(
    /import\s+{([^}]+)}\s+from\s+["']\.\.\/utils\/([^"']+)\.js["'];?/g,
    (match, imports, utilFile) => {
      // Check if it's a utility that's exported from uilint-eslint
      const utilsFromPackage = ["cache", "styleguide-loader", "import-graph"];
      if (utilsFromPackage.includes(utilFile)) {
        return `import {${imports}} from "uilint-eslint";`;
      }
      return match; // Keep original if not a known utility
    }
  );

  return transformed;
}

/**
 * Load a specific rule by ID
 */
export function loadRule(
  ruleId: string,
  options: { typescript: boolean } = { typescript: true }
): RuleFiles {
  const { typescript } = options;
  const extension = typescript ? ".ts" : ".js";

  if (typescript) {
    // Load TypeScript source files
    const rulesDir = join(getUilintEslintSrcDir(), "rules");
    const implPath = join(rulesDir, `${ruleId}.ts`);
    const testPath = join(rulesDir, `${ruleId}.test.ts`);

    if (!existsSync(implPath)) {
      throw new Error(`Rule "${ruleId}" not found at ${implPath}`);
    }

    const rawContent = readFileSync(implPath, "utf-8");
    const transformedContent = transformRuleContent(rawContent);

    const implementation: RuleFile = {
      relativePath: `${ruleId}.ts`,
      content: transformedContent,
    };

    const test: RuleFile | undefined = existsSync(testPath)
      ? {
          relativePath: `${ruleId}.test.ts`,
          content: transformRuleContent(readFileSync(testPath, "utf-8")),
        }
      : undefined;

    return {
      ruleId,
      implementation,
      test,
    };
  } else {
    // Load compiled JavaScript files
    const rulesDir = join(getUilintEslintDistDir(), "rules");
    const implPath = join(rulesDir, `${ruleId}.js`);

    if (!existsSync(implPath)) {
      throw new Error(
        `Rule "${ruleId}" not found at ${implPath}. Make sure uilint-eslint has been built.`
      );
    }

    // Compiled JS files don't need transformation - they already use uilint-eslint imports
    const content = readFileSync(implPath, "utf-8");

    const implementation: RuleFile = {
      relativePath: `${ruleId}.js`,
      content,
    };

    // Test files are not compiled, so we don't copy them for JS projects
    return {
      ruleId,
      implementation,
    };
  }
}

/**
 * Load multiple rules by their IDs
 */
export function loadSelectedRules(
  ruleIds: string[],
  options: { typescript: boolean } = { typescript: true }
): RuleFiles[] {
  return ruleIds.map((id) => loadRule(id, options));
}

/**
 * Get the list of available rule IDs from the registry
 */
export function getAvailableRuleIds(): string[] {
  try {
    // Import the rule registry from uilint-eslint
    const { ruleRegistry } = require("uilint-eslint");
    return ruleRegistry.map((rule: { id: string }) => rule.id);
  } catch {
    // Fallback: try to read from filesystem
    const rulesDir = join(getUilintEslintSrcDir(), "rules");
    if (!existsSync(rulesDir)) {
      return [];
    }

    // This is a fallback - ideally we'd use the registry
    // But if we can't import it, we can at least try to list files
    const fs = require("fs");
    const files = fs.readdirSync(rulesDir);
    return files
      .filter((f: string) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .map((f: string) => f.replace(".ts", ""));
  }
}

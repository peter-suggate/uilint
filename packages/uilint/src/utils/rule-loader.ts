/**
 * Rule Loader Utility
 *
 * Loads ESLint rule source files from the uilint-eslint package for installation
 * into user projects. Rules are copied to .uilint/rules/ in the target project.
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url);

function findNodeModulesPackageRoot(
  pkgName: string,
  startDir: string
): string | null {
  let dir = startDir;
  while (true) {
    const candidate = join(dir, "node_modules", pkgName);
    if (existsSync(join(candidate, "package.json"))) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function getUilintEslintPackageRoot(): string {
  // Prefer a filesystem-based lookup first. This avoids Node resolution edge
  // cases with package.json "exports" (especially ESM-only packages), and works
  // well for monorepos + pnpm where node_modules contains symlinks.
  //
  // Search upwards from process.cwd() (the user's project) and from this file
  // location (for test/dev environments).
  const fromCwd = findNodeModulesPackageRoot("uilint-eslint", process.cwd());
  if (fromCwd) return fromCwd;

  const fromHere = findNodeModulesPackageRoot("uilint-eslint", __dirname);
  if (fromHere) return fromHere;

  // Last resort: try resolver-based lookup.
  try {
    const entry = require.resolve("uilint-eslint"); // typically .../dist/index.js
    const entryDir = dirname(entry); // typically .../dist
    return dirname(entryDir); // package root
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Unable to locate uilint-eslint in node_modules (searched upwards from cwd and uilint's install path).\n` +
        `Resolver error: ${msg}\n` +
        `Fix: ensure uilint-eslint is installed in the target project (or workspace) and try again.`
    );
  }
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
  /** Implementation file (main entry point - index.ts for directory rules, or single file) */
  implementation: RuleFile;
  /** Additional files for directory-based rules (lib/ utilities, etc.) */
  additionalFiles?: RuleFile[];
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
 * All utilities that are exported from uilint-eslint and can be imported.
 * When adding a new utility to uilint-eslint that rules may import,
 * add it here AND export it from uilint-eslint/src/index.ts.
 *
 * Rules can also declare their dependencies via the `internalDependencies`
 * field in defineRuleMeta() - this serves as documentation and can be
 * used for validation.
 */
const EXPORTED_UTILITIES = [
  "create-rule",
  "cache",
  "styleguide-loader",
  "import-graph",
  "component-parser",
  "export-resolver",
  "coverage-aggregator",
  "dependency-graph",
  "file-categorizer",
  "jsx-coverage-analyzer",
];

/**
 * Maps internal export names to their uilint-eslint export names.
 * Some exports are renamed when re-exported from the main package
 * to avoid naming conflicts.
 *
 * Format: "utilFile:internalName" -> "externalName"
 */
const EXPORT_RENAMES: Record<string, string> = {
  "import-graph:clearCache": "clearImportGraphCache",
};

/**
 * Transform an import specifier, applying any necessary renames.
 * Handles both simple imports (foo) and aliased imports (foo as bar).
 */
function transformImportSpecifier(specifier: string, utilFile: string): string {
  const trimmed = specifier.trim();

  // Check for aliased import: "localName as alias"
  const aliasMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/);
  if (aliasMatch) {
    const [, localName, alias] = aliasMatch;
    const renameKey = `${utilFile}:${localName}`;
    const externalName = EXPORT_RENAMES[renameKey];
    if (externalName) {
      // If the alias matches the external name, simplify to just the name
      if (alias === externalName) {
        return externalName;
      }
      // Otherwise, use the external name with the original alias
      return `${externalName} as ${alias}`;
    }
    // No rename needed, keep original
    return trimmed;
  }

  // Simple import: check if it needs renaming
  const renameKey = `${utilFile}:${trimmed}`;
  const externalName = EXPORT_RENAMES[renameKey];
  if (externalName) {
    return externalName;
  }

  return trimmed;
}

/**
 * External packages that are re-exported from uilint-eslint.
 * When rules import these packages directly, transform them to import from uilint-eslint instead.
 * This ensures the dependencies are resolved correctly when rules are copied to user projects.
 */
const REEXPORTED_PACKAGES: Record<string, string[]> = {
  "oxc-resolver": ["ResolverFactory"],
};

/**
 * Transform rule content to fix imports for copied location
 * Changes imports from "../utils/..." or "../../utils/..." to "uilint-eslint"
 * Also transforms external package imports that are re-exported from uilint-eslint
 */
function transformRuleContent(content: string): string {
  let transformed = content;

  // Replace all relative utility imports with uilint-eslint imports
  // Pattern: import { ... } from "../utils/create-rule.js" or "../../utils/create-rule.js"
  // This handles any combination of imports like { createRule, defineRuleMeta }
  transformed = transformed.replace(
    /import\s+{([^}]+)}\s+from\s+["'](?:\.\.\/)+utils\/([^"']+)\.js["'];?/g,
    (match, imports, utilFile) => {
      if (EXPORTED_UTILITIES.includes(utilFile)) {
        // Transform each import specifier
        const specifiers = imports.split(",").map((s: string) =>
          transformImportSpecifier(s, utilFile)
        );
        return `import { ${specifiers.join(", ")} } from "uilint-eslint";`;
      }
      return match; // Keep original if not a known utility
    }
  );

  // Also handle default imports: import createRule from "../utils/create-rule.js"
  transformed = transformed.replace(
    /import\s+(\w+)\s+from\s+["'](?:\.\.\/)+utils\/([^"']+)\.js["'];?/g,
    (match, importName, utilFile) => {
      if (EXPORTED_UTILITIES.includes(utilFile)) {
        return `import { ${importName} } from "uilint-eslint";`;
      }
      return match;
    }
  );

  // Transform external package imports that are re-exported from uilint-eslint
  // Pattern: import { ResolverFactory } from "oxc-resolver"
  for (const [pkgName, exports] of Object.entries(REEXPORTED_PACKAGES)) {
    const escapedPkgName = pkgName.replace(/-/g, "\\-");
    const regex = new RegExp(
      `import\\s+{([^}]+)}\\s+from\\s+["']${escapedPkgName}["'];?`,
      "g"
    );
    transformed = transformed.replace(regex, (match, imports) => {
      const importNames = imports.split(",").map((s: string) => s.trim());
      // Only transform if all imported names are re-exported from uilint-eslint
      const allReexported = importNames.every((name: string) => {
        // Handle "Foo as Bar" syntax - extract the original name
        const originalName = name.split(/\s+as\s+/)[0].trim();
        return exports.includes(originalName);
      });
      if (allReexported) {
        return `import { ${imports} } from "uilint-eslint";`;
      }
      return match;
    });
  }

  return transformed;
}

/**
 * Check if a rule is directory-based (has index.ts/index.js) or single-file
 */
function isDirectoryBasedRule(rulesDir: string, ruleId: string): boolean {
  const ruleDir = join(rulesDir, ruleId);
  return existsSync(ruleDir) && existsSync(join(ruleDir, "index.ts"));
}

/**
 * Load all files from a directory-based rule
 */
function loadDirectoryRule(
  rulesDir: string,
  ruleId: string
): { files: RuleFile[]; testFile?: RuleFile } {
  const ruleDir = join(rulesDir, ruleId);
  const files: RuleFile[] = [];
  let testFile: RuleFile | undefined;

  function collectFiles(dir: string, relativeTo: string): void {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = join(relativeTo, entry.name);

      if (entry.isDirectory()) {
        collectFiles(fullPath, relativePath);
      } else if (entry.name.endsWith(".ts")) {
        if (entry.name.endsWith(".test.ts")) {
          // Handle test file separately
          testFile = {
            relativePath,
            content: transformRuleContent(readFileSync(fullPath, "utf-8")),
          };
        } else {
          files.push({
            relativePath,
            content: transformRuleContent(readFileSync(fullPath, "utf-8")),
          });
        }
      }
    }
  }

  collectFiles(ruleDir, ruleId);
  return { files, testFile };
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

    // Check if this is a directory-based rule
    if (isDirectoryBasedRule(rulesDir, ruleId)) {
      const { files, testFile } = loadDirectoryRule(rulesDir, ruleId);

      if (files.length === 0) {
        throw new Error(`Rule "${ruleId}" directory exists but contains no TypeScript files`);
      }

      // Find the index.ts as the main implementation
      const indexFile = files.find((f) => f.relativePath === join(ruleId, "index.ts"));
      if (!indexFile) {
        throw new Error(`Rule "${ruleId}" directory missing index.ts`);
      }

      return {
        ruleId,
        implementation: indexFile,
        additionalFiles: files.filter((f) => f !== indexFile),
        test: testFile,
      };
    }

    // Single-file rule
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
        `Rule "${ruleId}" not found at ${implPath}. ` +
          `For JavaScript-only projects, uilint-eslint must be built to include compiled rule files in dist/rules/. ` +
          `If you're developing uilint-eslint, run 'pnpm build' in packages/uilint-eslint. ` +
          `If you're using a published package, ensure it includes the dist/ directory.`
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
    const files = readdirSync(rulesDir);
    return files
      .filter((f: string) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
      .map((f: string) => f.replace(".ts", ""));
  }
}

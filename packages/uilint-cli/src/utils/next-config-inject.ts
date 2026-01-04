/**
 * Inject jsx-loc-plugin into Next.js config
 *
 * Modifies next.config.{ts,js,mjs,cjs} to wrap the export with withJsxLoc()
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export interface InstallJsxLocPluginOptions {
  projectPath: string;
  force?: boolean;
  confirmOverwrite?: (relPath: string) => Promise<boolean>;
}

const CONFIG_EXTENSIONS = [".ts", ".mjs", ".js", ".cjs"];

/**
 * Find the next.config file in a project
 */
export function findNextConfigFile(projectPath: string): string | null {
  for (const ext of CONFIG_EXTENSIONS) {
    const configPath = join(projectPath, `next.config${ext}`);
    if (existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

/**
 * Get the relative config filename for display
 */
export function getNextConfigFilename(configPath: string): string {
  const parts = configPath.split("/");
  return parts[parts.length - 1] || "next.config.ts";
}

/**
 * Check if the source already has withJsxLoc imported
 */
function hasJsxLocImport(source: string): boolean {
  return (
    source.includes('from "jsx-loc-plugin"') ||
    source.includes("from 'jsx-loc-plugin'")
  );
}

/**
 * Check if the source already uses withJsxLoc
 */
function hasJsxLocWrapper(source: string): boolean {
  return source.includes("withJsxLoc(");
}

/**
 * Add the withJsxLoc import to the source if not present
 */
function ensureJsxLocImport(source: string): string {
  if (hasJsxLocImport(source)) {
    // Check if withJsxLoc is already imported
    if (source.includes("withJsxLoc")) {
      return source;
    }
    // Add withJsxLoc to existing import
    return source.replace(
      /import\s*{([^}]*?)}\s*from\s*["']jsx-loc-plugin["']/,
      (match, imports) => {
        const trimmedImports = imports.trim();
        if (trimmedImports) {
          return `import { ${trimmedImports}, withJsxLoc } from "jsx-loc-plugin"`;
        }
        return `import { withJsxLoc } from "jsx-loc-plugin"`;
      }
    );
  }

  const importLine = `import { withJsxLoc } from "jsx-loc-plugin";\n`;

  // Find the last import statement and insert after it
  const header = source.slice(0, Math.min(source.length, 5000));
  const importRegex = /^import[\s\S]*?;\s*$/gm;
  let lastImportEnd = -1;
  for (const m of header.matchAll(importRegex)) {
    lastImportEnd = (m.index ?? 0) + m[0].length;
  }

  if (lastImportEnd !== -1) {
    return (
      source.slice(0, lastImportEnd) +
      "\n" +
      importLine +
      source.slice(lastImportEnd)
    );
  }

  // No imports found, add at the beginning
  return importLine + source;
}

/**
 * Wrap the export default with withJsxLoc()
 *
 * Handles patterns:
 * - export default nextConfig
 * - export default { ... }
 * - export default someFunction(config)
 */
function wrapExportWithJsxLoc(source: string): string {
  if (hasJsxLocWrapper(source)) {
    return source;
  }

  // Pattern 1: export default identifier;
  // e.g., export default nextConfig;
  const simpleExportMatch = source.match(
    /export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*;/
  );
  if (simpleExportMatch) {
    const identifier = simpleExportMatch[1];
    return source.replace(
      /export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*;/,
      `export default withJsxLoc(${identifier});`
    );
  }

  // Pattern 2: export default { ... } or export default someCall(...)
  // Find "export default" and wrap whatever comes after
  const exportDefaultMatch = source.match(/export\s+default\s+/);
  if (exportDefaultMatch && exportDefaultMatch.index !== undefined) {
    const exportStart = exportDefaultMatch.index;
    const afterExport = exportStart + exportDefaultMatch[0].length;

    // Find the end of the export statement
    // This is tricky - we need to find the matching ; at the end
    // For objects/function calls, we need to handle nested braces/parens

    const rest = source.slice(afterExport);

    // Simple case: ends with semicolon on same logical expression
    // We'll use a heuristic: find the last semicolon or end of file
    const semicolonMatch = findExportEnd(rest);

    if (semicolonMatch !== -1) {
      const exportedValue = rest.slice(0, semicolonMatch).trim();
      const afterSemicolon = rest.slice(semicolonMatch);

      return (
        source.slice(0, afterExport) +
        `withJsxLoc(${exportedValue})` +
        afterSemicolon
      );
    }
  }

  // Fallback: couldn't parse, return unchanged
  return source;
}

/**
 * Find the end of the export default statement (position of semicolon or end)
 */
function findExportEnd(source: string): number {
  let depth = 0;
  let inString: string | null = null;
  let escaped = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const prevChar = i > 0 ? source[i - 1] : "";

    // Handle escape sequences in strings
    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    // Handle string boundaries
    if (inString) {
      if (char === inString) {
        inString = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      continue;
    }

    // Track depth of brackets/parens/braces
    if (char === "(" || char === "[" || char === "{") {
      depth++;
      continue;
    }

    if (char === ")" || char === "]" || char === "}") {
      depth--;
      continue;
    }

    // Found semicolon at depth 0 - this is our end
    if (char === ";" && depth === 0) {
      return i;
    }
  }

  // No semicolon found, return end of source
  return source.length;
}

/**
 * Install jsx-loc-plugin into next.config
 */
export async function installJsxLocPlugin(
  opts: InstallJsxLocPluginOptions
): Promise<{ configFile: string | null; modified: boolean }> {
  const configPath = findNextConfigFile(opts.projectPath);

  if (!configPath) {
    return { configFile: null, modified: false };
  }

  const configFilename = getNextConfigFilename(configPath);
  const original = readFileSync(configPath, "utf-8");

  // Check if already configured
  if (hasJsxLocWrapper(original)) {
    if (!opts.force) {
      const ok = await opts.confirmOverwrite?.(configFilename);
      if (!ok) {
        return { configFile: configFilename, modified: false };
      }
    }
  }

  // Apply transformations
  let updated = original;
  updated = ensureJsxLocImport(updated);
  updated = wrapExportWithJsxLoc(updated);

  if (updated !== original) {
    writeFileSync(configPath, updated, "utf-8");
    return { configFile: configFilename, modified: true };
  }

  return { configFile: configFilename, modified: false };
}


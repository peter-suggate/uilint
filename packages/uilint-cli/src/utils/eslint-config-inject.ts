/**
 * Inject uilint-eslint rules into ESLint config
 *
 * Modifies eslint.config.{mjs,js,cjs} to add uilint import and selected rules
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { RuleMetadata } from "uilint-eslint";

export interface InstallEslintPluginOptions {
  projectPath: string;
  selectedRules: RuleMetadata[];
  force?: boolean;
  confirmOverwrite?: (relPath: string) => Promise<boolean>;
}

const CONFIG_EXTENSIONS = [".mjs", ".js", ".cjs"];

/**
 * Find the eslint.config file in a project
 */
export function findEslintConfigFile(projectPath: string): string | null {
  for (const ext of CONFIG_EXTENSIONS) {
    const configPath = join(projectPath, `eslint.config${ext}`);
    if (existsSync(configPath)) {
      return configPath;
    }
  }
  return null;
}

/**
 * Get the relative config filename for display
 */
export function getEslintConfigFilename(configPath: string): string {
  const parts = configPath.split("/");
  return parts[parts.length - 1] || "eslint.config.mjs";
}

/**
 * Check if the source already has uilint imported
 */
function hasUilintImport(source: string): boolean {
  return (
    source.includes('from "uilint-eslint"') ||
    source.includes("from 'uilint-eslint'") ||
    source.includes('require("uilint-eslint")') ||
    source.includes("require('uilint-eslint')")
  );
}

/**
 * Check if the source already has uilint rules configured
 */
function hasUilintRules(source: string): boolean {
  return source.includes('"uilint/') || source.includes("'uilint/");
}

/**
 * Add the uilint import to the source if not present
 */
function ensureUilintImport(source: string, isCommonJS: boolean): string {
  if (hasUilintImport(source)) {
    return source;
  }

  const importLine = isCommonJS
    ? `const uilint = require("uilint-eslint");\n`
    : `import uilint from "uilint-eslint";\n`;

  // Find the last import/require statement and insert after it
  const header = source.slice(0, Math.min(source.length, 5000));
  const importRegex = isCommonJS
    ? /^(?:const|var|let)\s+.*?=\s*require\([^)]+\);?\s*$/gm
    : /^import[\s\S]*?;\s*$/gm;
  
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
 * Generate the rules config object from selected rules
 */
function generateRulesConfig(selectedRules: RuleMetadata[]): string {
  const lines: string[] = [];
  
  for (const rule of selectedRules) {
    const ruleKey = `"uilint/${rule.id}"`;
    
    if (rule.defaultOptions && rule.defaultOptions.length > 0) {
      // Rule with options
      const optionsStr = JSON.stringify(rule.defaultOptions, null, 6)
        .split("\n")
        .join("\n      ");
      lines.push(`      ${ruleKey}: ["${rule.defaultSeverity}", ...${optionsStr}],`);
    } else {
      // Simple rule
      lines.push(`      ${ruleKey}: "${rule.defaultSeverity}",`);
    }
  }
  
  return lines.join("\n");
}

/**
 * Inject uilint rules into the export default array
 */
function injectUilintRules(
  source: string,
  selectedRules: RuleMetadata[]
): string {
  if (hasUilintRules(source)) {
    // Already has uilint rules - don't inject again
    return source;
  }

  const rulesConfig = generateRulesConfig(selectedRules);

  const configBlock = `  {
    files: [
      "src/**/*.{js,jsx,ts,tsx}",
      "app/**/*.{js,jsx,ts,tsx}",
      "pages/**/*.{js,jsx,ts,tsx}",
    ],
    plugins: { uilint: uilint },
    rules: {
${rulesConfig}
    },
  },`;

  // Find the export default array
  const exportMatch = source.match(/export\s+default\s+\[/);
  if (!exportMatch || exportMatch.index === undefined) {
    // No export default array found - can't inject
    return source;
  }

  const exportStart = exportMatch.index + exportMatch[0].length;
  
  // Find a good insertion point - after the opening bracket
  // Look for the first existing config object or the closing bracket
  const afterExport = source.slice(exportStart);
  
  // Insert at the beginning of the array (after opening bracket)
  // Add a newline if the array doesn't start on a new line
  const needsNewline = !afterExport.trimStart().startsWith("\n");
  const insertion = needsNewline ? "\n" + configBlock + "\n" : configBlock + "\n";
  
  return (
    source.slice(0, exportStart) +
    insertion +
    source.slice(exportStart)
  );
}

/**
 * Inject uilint rules into the CommonJS export
 */
function injectUilintRulesCommonJS(
  source: string,
  selectedRules: RuleMetadata[]
): string {
  if (hasUilintRules(source)) {
    return source;
  }

  const rulesConfig = generateRulesConfig(selectedRules);

  const configBlock = `  {
    files: [
      "src/**/*.{js,jsx,ts,tsx}",
      "app/**/*.{js,jsx,ts,tsx}",
      "pages/**/*.{js,jsx,ts,tsx}",
    ],
    plugins: { uilint: uilint },
    rules: {
${rulesConfig}
    },
  },`;

  // Find module.exports = [ pattern
  const exportMatch = source.match(/module\.exports\s*=\s*\[/);
  if (!exportMatch || exportMatch.index === undefined) {
    return source;
  }

  const exportStart = exportMatch.index + exportMatch[0].length;
  const afterExport = source.slice(exportStart);
  const needsNewline = !afterExport.trimStart().startsWith("\n");
  const insertion = needsNewline ? "\n" + configBlock + "\n" : configBlock + "\n";
  
  return (
    source.slice(0, exportStart) +
    insertion +
    source.slice(exportStart)
  );
}

/**
 * Install uilint-eslint into eslint config
 */
export async function installEslintPlugin(
  opts: InstallEslintPluginOptions
): Promise<{ configFile: string | null; modified: boolean }> {
  const configPath = findEslintConfigFile(opts.projectPath);

  if (!configPath) {
    return { configFile: null, modified: false };
  }

  const configFilename = getEslintConfigFilename(configPath);
  const original = readFileSync(configPath, "utf-8");
  const isCommonJS = configPath.endsWith(".cjs");

  // Check if already configured
  if (hasUilintRules(original)) {
    if (!opts.force) {
      const ok = await opts.confirmOverwrite?.(configFilename);
      if (!ok) {
        return { configFile: configFilename, modified: false };
      }
    }
  }

  // Apply transformations
  let updated = original;
  updated = ensureUilintImport(updated, isCommonJS);
  
  if (isCommonJS) {
    updated = injectUilintRulesCommonJS(updated, opts.selectedRules);
  } else {
    updated = injectUilintRules(updated, opts.selectedRules);
  }

  if (updated !== original) {
    writeFileSync(configPath, updated, "utf-8");
    return { configFile: configFilename, modified: true };
  }

  return { configFile: configFilename, modified: false };
}

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
  confirmAddMissingRules?: (
    relPath: string,
    missingRules: RuleMetadata[]
  ) => Promise<boolean>;
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

function isUilintConfigured(source: string): boolean {
  return hasUilintConfigsUsage(source) || hasUilintRules(source);
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

function hasUilintConfigsUsage(source: string): boolean {
  // e.g. export default [uilint.configs.recommended]
  // This implies the rule set will evolve with the installed uilint-eslint version,
  // so we should not inject/patch per-rule keys.
  return /\builint\s*\.\s*configs\s*\./.test(source);
}

function findEsmExportedConfigArrayStartIndex(source: string): number | null {
  // Supported:
  // - export default [ ... ]
  // - export default defineConfig([ ... ])
  const patterns: RegExp[] = [
    /export\s+default\s+\[/,
    /export\s+default\s+defineConfig\s*\(\s*\[/,
  ];

  for (const re of patterns) {
    const m = source.match(re);
    if (!m || m.index === undefined) continue;
    return m.index + m[0].length;
  }

  return null;
}

function findCommonJsExportedConfigArrayStartIndex(source: string): number | null {
  // Supported:
  // - module.exports = [ ... ]
  // - module.exports = defineConfig([ ... ])  (best-effort)
  const patterns: RegExp[] = [
    /module\.exports\s*=\s*\[/,
    /module\.exports\s*=\s*defineConfig\s*\(\s*\[/,
  ];

  for (const re of patterns) {
    const m = source.match(re);
    if (!m || m.index === undefined) continue;
    return m.index + m[0].length;
  }

  return null;
}

/**
 * Extract configured uilint rule IDs from source.
 * Matches keys like: "uilint/no-arbitrary-tailwind": "error"
 */
function extractConfiguredUilintRuleIds(source: string): Set<string> {
  const ids = new Set<string>();
  const re = /["']uilint\/([^"']+)["']\s*:/g;
  for (const m of source.matchAll(re)) {
    if (m[1]) ids.add(m[1]);
  }
  return ids;
}

function getMissingSelectedRules(
  selectedRules: RuleMetadata[],
  configuredIds: Set<string>
): RuleMetadata[] {
  return selectedRules.filter((r) => !configuredIds.has(r.id));
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
      lines.push(
        `      ${ruleKey}: ["${rule.defaultSeverity}", ...${optionsStr}],`
      );
    } else {
      // Simple rule
      lines.push(`      ${ruleKey}: "${rule.defaultSeverity}",`);
    }
  }

  return lines.join("\n");
}

function detectIndent(source: string, index: number): string {
  const lineStart = source.lastIndexOf("\n", index);
  const start = lineStart === -1 ? 0 : lineStart + 1;
  const line = source.slice(start, index);
  const m = line.match(/^\s*/);
  return m?.[0] ?? "";
}

/**
 * Insert missing uilint rule keys into an existing `rules: { ... }` object
 * that already contains at least one "uilint/" key.
 *
 * This is intentionally a best-effort string transform (no JS AST dependency).
 */
function insertMissingRulesIntoExistingRulesObject(
  source: string,
  missingRules: RuleMetadata[]
): string {
  if (missingRules.length === 0) return source;

  // Anchor on an existing uilint rule key, then look backwards for the
  // nearest `rules:` preceding it.
  const uilintKeyMatch = source.match(/["']uilint\/[^"']+["']\s*:/);
  if (!uilintKeyMatch || uilintKeyMatch.index === undefined) return source;

  const uilintKeyIndex = uilintKeyMatch.index;
  const searchStart = Math.max(0, uilintKeyIndex - 4000);
  const before = source.slice(searchStart, uilintKeyIndex);
  const rulesKwIndexRel = before.lastIndexOf("rules");
  if (rulesKwIndexRel === -1) return source;

  const rulesKwIndex = searchStart + rulesKwIndexRel;
  const braceOpenIndex = source.indexOf("{", rulesKwIndex);
  if (braceOpenIndex === -1 || braceOpenIndex > uilintKeyIndex) return source;

  // Find the matching closing brace for the rules object.
  let depth = 0;
  let braceCloseIndex = -1;
  for (let i = braceOpenIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        braceCloseIndex = i;
        break;
      }
    }
  }
  if (braceCloseIndex === -1) return source;

  const rulesIndent = detectIndent(source, braceOpenIndex);
  const entryIndent = rulesIndent + "  ";
  const entryTextRaw = generateRulesConfig(missingRules);
  const entryText = entryTextRaw
    .split("\n")
    .map((l) => (l.trim().length === 0 ? l : entryIndent + l.trimStart()))
    .join("\n");

  const insertion =
    (source.slice(braceOpenIndex + 1, braceCloseIndex).trim().length === 0
      ? "\n"
      : "\n") +
    entryText +
    "\n" +
    rulesIndent;

  return (
    source.slice(0, braceCloseIndex) + insertion + source.slice(braceCloseIndex)
  );
}

/**
 * Inject uilint rules into the export default array
 */
function injectUilintRules(
  source: string,
  selectedRules: RuleMetadata[]
): { source: string; injected: boolean } {
  if (hasUilintRules(source)) {
    // Already has uilint rules - don't inject again
    return { source, injected: false };
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

  const arrayStart = findEsmExportedConfigArrayStartIndex(source);
  if (arrayStart === null) {
    return { source, injected: false };
  }

  const afterExport = source.slice(arrayStart);

  // Insert at the beginning of the array (after opening bracket)
  // Add a newline if the array doesn't start on a new line
  const needsNewline = !afterExport.trimStart().startsWith("\n");
  const insertion = needsNewline
    ? "\n" + configBlock + "\n"
    : configBlock + "\n";

  return {
    source: source.slice(0, arrayStart) + insertion + source.slice(arrayStart),
    injected: true,
  };
}

/**
 * Inject uilint rules into the CommonJS export
 */
function injectUilintRulesCommonJS(
  source: string,
  selectedRules: RuleMetadata[]
): { source: string; injected: boolean } {
  if (hasUilintRules(source)) {
    return { source, injected: false };
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

  const arrayStart = findCommonJsExportedConfigArrayStartIndex(source);
  if (arrayStart === null) {
    return { source, injected: false };
  }

  const afterExport = source.slice(arrayStart);
  const needsNewline = !afterExport.trimStart().startsWith("\n");
  const insertion = needsNewline
    ? "\n" + configBlock + "\n"
    : configBlock + "\n";

  return {
    source: source.slice(0, arrayStart) + insertion + source.slice(arrayStart),
    injected: true,
  };
}

/**
 * Install uilint-eslint into eslint config
 */
export async function installEslintPlugin(
  opts: InstallEslintPluginOptions
): Promise<{
  configFile: string | null;
  modified: boolean;
  missingRuleIds: string[];
  configured: boolean;
  error?: string;
}> {
  const configPath = findEslintConfigFile(opts.projectPath);

  if (!configPath) {
    return {
      configFile: null,
      modified: false,
      missingRuleIds: [],
      configured: false,
    };
  }

  const configFilename = getEslintConfigFilename(configPath);
  const original = readFileSync(configPath, "utf-8");
  const isCommonJS = configPath.endsWith(".cjs");

  const configuredIds = extractConfiguredUilintRuleIds(original);
  const usesUilintConfigs = hasUilintConfigsUsage(original);
  const hasAnyUilint =
    usesUilintConfigs || hasUilintRules(original) || configuredIds.size > 0;
  const missingRules = usesUilintConfigs
    ? []
    : getMissingSelectedRules(opts.selectedRules, configuredIds);

  // Apply transformations
  let updated = original;

  if (hasAnyUilint) {
    // Already configured: optionally add only missing rules.
    if (missingRules.length > 0) {
      if (!opts.force) {
        const ok = await opts.confirmAddMissingRules?.(
          configFilename,
          missingRules
        );
        if (!ok) {
          return {
            configFile: configFilename,
            modified: false,
            missingRuleIds: missingRules.map((r) => r.id),
            configured: true,
          };
        }
      }
      const beforeInsert = updated;
      updated = insertMissingRulesIntoExistingRulesObject(
        updated,
        missingRules
      );
      const inserted = updated !== beforeInsert;

      // If we couldn't safely update in-place, fall back to the previous behavior:
      // ask to inject a new block (may duplicate). This is opt-in via confirmOverwrite.
      if (!inserted) {
        const ok = await opts.confirmOverwrite?.(configFilename);
        if (ok) {
          if (isCommonJS) {
            updated = injectUilintRulesCommonJS(updated, opts.selectedRules).source;
          } else {
            updated = injectUilintRules(updated, opts.selectedRules).source;
          }
        }
      }
    }

    // Best-effort: if the config appears to use uilint rules/configs but is missing
    // the uilint import, add it.
    if (isUilintConfigured(updated) && !hasUilintImport(updated)) {
      updated = ensureUilintImport(updated, isCommonJS);
    }
  } else {
    // Not configured: inject a fresh block.
    if (isCommonJS) {
      const injected = injectUilintRulesCommonJS(updated, opts.selectedRules);
      if (!injected.injected) {
        return {
          configFile: configFilename,
          modified: false,
          missingRuleIds: [],
          configured: false,
          error:
            "Could not locate a CommonJS exported config array to inject into.",
        };
      }
      updated = injected.source;
    } else {
      const injected = injectUilintRules(updated, opts.selectedRules);
      if (!injected.injected) {
        return {
          configFile: configFilename,
          modified: false,
          missingRuleIds: [],
          configured: false,
          error:
            "Could not locate an exported config array to inject into (expected `export default [` or `export default defineConfig([`).",
        };
      }
      updated = injected.source;
    }

    // Only add import when we successfully injected the block (avoid import-only edits).
    updated = ensureUilintImport(updated, isCommonJS);
  }

  if (updated !== original) {
    writeFileSync(configPath, updated, "utf-8");
    return {
      configFile: configFilename,
      modified: true,
      missingRuleIds: missingRules.map((r) => r.id),
      configured: isUilintConfigured(updated),
    };
  }

  return {
    configFile: configFilename,
    modified: false,
    missingRuleIds: missingRules.map((r) => r.id),
    configured: isUilintConfigured(updated),
  };
}

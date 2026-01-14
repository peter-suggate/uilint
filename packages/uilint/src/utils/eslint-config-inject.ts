/**
 * Inject uilint-eslint rules into ESLint config
 *
 * Modifies eslint.config.{ts,mjs,js,cjs} to add uilint import and selected rules
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, relative, dirname } from "path";
import type { RuleMetadata } from "uilint-eslint";
import { parseExpression, parseModule, generateCode } from "magicast";
import { findWorkspaceRoot } from "uilint-core/node";

export interface InstallEslintPluginOptions {
  projectPath: string;
  selectedRules: RuleMetadata[];
  force?: boolean;
  confirmAddMissingRules?: (
    relPath: string,
    missingRules: RuleMetadata[]
  ) => Promise<boolean>;
}

const CONFIG_EXTENSIONS = [".ts", ".mjs", ".js", ".cjs"];

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
 * Check if the source already has uilint rules configured
 */
function hasUilintRules(source: string): boolean {
  return source.includes('"uilint/') || source.includes("'uilint/");
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

type UilintEslintConfigInfo = {
  /** Set of configured `uilint/*` rule IDs (without the `uilint/` prefix). */
  configuredRuleIds: Set<string>;
  /** Whether config appears to configure uilint rules. */
  configured: boolean;
};

function walkAst(node: any, visit: (n: any) => void): void {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const key of Object.keys(node)) {
    const v = (node as any)[key];
    if (!v) continue;
    if (Array.isArray(v)) {
      for (const item of v) walkAst(item, visit);
    } else if (typeof v === "object" && v.type) {
      walkAst(v, visit);
    }
  }
}

function isIdentifier(node: any, name?: string): boolean {
  return (
    !!node &&
    node.type === "Identifier" &&
    (name ? node.name === name : typeof node.name === "string")
  );
}

function isStringLiteral(node: any): node is { type: string; value: string } {
  return (
    !!node &&
    (node.type === "StringLiteral" || node.type === "Literal") &&
    typeof node.value === "string"
  );
}

function getObjectPropertyValue(obj: any, keyName: string): any | null {
  if (!obj || obj.type !== "ObjectExpression") return null;
  for (const prop of obj.properties ?? []) {
    if (!prop) continue;
    if (prop.type === "ObjectProperty" || prop.type === "Property") {
      const key = prop.key;
      const keyMatch =
        (key?.type === "Identifier" && key.name === keyName) ||
        (isStringLiteral(key) && key.value === keyName);
      if (keyMatch) return prop.value;
    }
  }
  return null;
}

function hasSpreadProperties(obj: any): boolean {
  if (!obj || obj.type !== "ObjectExpression") return false;
  return (obj.properties ?? []).some(
    (p: any) => p && (p.type === "SpreadElement" || p.type === "SpreadProperty")
  );
}

const IGNORED_AST_KEYS = new Set([
  "loc",
  "start",
  "end",
  "extra",
  "leadingComments",
  "trailingComments",
  "innerComments",
]);

function normalizeAstForCompare(node: any): any {
  if (node === null) return null;
  if (node === undefined) return undefined;
  if (typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map(normalizeAstForCompare);

  const out: Record<string, any> = {};
  const keys = Object.keys(node)
    .filter((k) => !IGNORED_AST_KEYS.has(k))
    .sort();
  for (const k of keys) {
    // Avoid proxy-ish or non-serializable fields if present.
    if (k.startsWith("$")) continue;
    out[k] = normalizeAstForCompare(node[k]);
  }
  return out;
}

function astEquivalent(a: any, b: any): boolean {
  try {
    return (
      JSON.stringify(normalizeAstForCompare(a)) ===
      JSON.stringify(normalizeAstForCompare(b))
    );
  } catch {
    return false;
  }
}

function collectUilintRuleIdsFromRulesObject(rulesObj: any): Set<string> {
  const ids = new Set<string>();
  if (!rulesObj || rulesObj.type !== "ObjectExpression") return ids;
  for (const prop of rulesObj.properties ?? []) {
    if (!prop) continue;
    if (prop.type !== "ObjectProperty" && prop.type !== "Property") continue;
    const key = prop.key;
    if (!isStringLiteral(key)) continue;
    const val = key.value;
    if (typeof val !== "string") continue;
    if (val.startsWith("uilint/")) {
      ids.add(val.slice("uilint/".length));
    }
  }
  return ids;
}

function findExportedConfigArrayExpression(mod: any): {
  kind: "esm" | "cjs";
  arrayExpr: any;
  program: any;
} | null {
  function unwrapExpression(expr: any): any {
    let e = expr;
    // Best-effort unwrap for TS/parenthesized wrappers. (These can appear if the
    // config is authored in TS/JS with type assertions or parentheses.)
    while (e) {
      if (e.type === "TSAsExpression" || e.type === "TSNonNullExpression") {
        e = e.expression;
        continue;
      }
      if (e.type === "TSSatisfiesExpression") {
        e = e.expression;
        continue;
      }
      if (e.type === "ParenthesizedExpression") {
        e = e.expression;
        continue;
      }
      break;
    }
    return e;
  }

  function resolveTopLevelIdentifierToArrayExpr(
    program: any,
    name: string
  ): any | null {
    if (!program || program.type !== "Program") return null;
    for (const stmt of program.body ?? []) {
      if (stmt?.type !== "VariableDeclaration") continue;
      for (const decl of stmt.declarations ?? []) {
        const id = decl?.id;
        if (!isIdentifier(id, name)) continue;
        const init = unwrapExpression(decl?.init);
        if (!init) return null;
        if (init.type === "ArrayExpression") return init;
        if (
          init.type === "CallExpression" &&
          isIdentifier(init.callee, "defineConfig") &&
          unwrapExpression(init.arguments?.[0])?.type === "ArrayExpression"
        ) {
          return unwrapExpression(init.arguments?.[0]);
        }
        return null;
      }
    }
    return null;
  }

  // Prefer reading directly from the program AST so we can handle:
  // - export default [ ... ]
  // - export default defineConfig([ ... ])
  // - export default eslintConfig;  (where eslintConfig is a top-level array)
  const program = mod?.$ast;
  if (program && program.type === "Program") {
    for (const stmt of program.body ?? []) {
      if (!stmt || stmt.type !== "ExportDefaultDeclaration") continue;
      const decl = unwrapExpression(stmt.declaration);
      if (!decl) break;

      if (decl.type === "ArrayExpression") {
        return { kind: "esm", arrayExpr: decl, program };
      }
      if (
        decl.type === "CallExpression" &&
        isIdentifier(decl.callee, "defineConfig") &&
        unwrapExpression(decl.arguments?.[0])?.type === "ArrayExpression"
      ) {
        return {
          kind: "esm",
          arrayExpr: unwrapExpression(decl.arguments?.[0]),
          program,
        };
      }
      if (decl.type === "Identifier" && typeof decl.name === "string") {
        const resolved = resolveTopLevelIdentifierToArrayExpr(
          program,
          decl.name
        );
        if (resolved) return { kind: "esm", arrayExpr: resolved, program };
      }
      break;
    }
  }

  // CommonJS: module.exports = [ ... ] OR module.exports = defineConfig([ ... ])
  if (!program || program.type !== "Program") return null;

  for (const stmt of program.body ?? []) {
    if (!stmt || stmt.type !== "ExpressionStatement") continue;
    const expr = stmt.expression;
    if (!expr || expr.type !== "AssignmentExpression") continue;
    const left = expr.left;
    const right = expr.right;
    const isModuleExports =
      left?.type === "MemberExpression" &&
      isIdentifier(left.object, "module") &&
      isIdentifier(left.property, "exports");
    if (!isModuleExports) continue;

    if (right?.type === "ArrayExpression") {
      return { kind: "cjs", arrayExpr: right, program };
    }
    if (
      right?.type === "CallExpression" &&
      isIdentifier(right.callee, "defineConfig") &&
      right.arguments?.[0]?.type === "ArrayExpression"
    ) {
      return { kind: "cjs", arrayExpr: right.arguments[0], program };
    }
    if (right?.type === "Identifier" && typeof right.name === "string") {
      const resolved = resolveTopLevelIdentifierToArrayExpr(
        program,
        right.name
      );
      if (resolved) return { kind: "cjs", arrayExpr: resolved, program };
    }
  }

  return null;
}

function collectConfiguredUilintRuleIdsFromConfigArray(
  arrayExpr: any
): Set<string> {
  const ids = new Set<string>();
  if (!arrayExpr || arrayExpr.type !== "ArrayExpression") return ids;
  for (const el of arrayExpr.elements ?? []) {
    if (!el || el.type !== "ObjectExpression") continue;
    const rules = getObjectPropertyValue(el, "rules");
    for (const id of collectUilintRuleIdsFromRulesObject(rules)) ids.add(id);
  }
  return ids;
}

function findExistingUilintRulesObject(arrayExpr: any): {
  configObj: any | null;
  rulesObj: any | null;
  safeToMutate: boolean;
} {
  if (!arrayExpr || arrayExpr.type !== "ArrayExpression") {
    return { configObj: null, rulesObj: null, safeToMutate: false };
  }

  for (const el of arrayExpr.elements ?? []) {
    if (!el || el.type !== "ObjectExpression") continue;

    const plugins = getObjectPropertyValue(el, "plugins");
    const rules = getObjectPropertyValue(el, "rules");

    const hasUilintPlugin =
      plugins?.type === "ObjectExpression" &&
      getObjectPropertyValue(plugins, "uilint") !== null;

    const uilintIds = collectUilintRuleIdsFromRulesObject(rules);
    const hasUilintRules = uilintIds.size > 0;

    if (!hasUilintPlugin && !hasUilintRules) continue;

    const safe =
      rules?.type === "ObjectExpression" && !hasSpreadProperties(rules);
    return { configObj: el, rulesObj: rules, safeToMutate: safe };
  }

  return { configObj: null, rulesObj: null, safeToMutate: false };
}

function collectTopLevelBindings(program: any): Set<string> {
  const names = new Set<string>();
  if (!program || program.type !== "Program") return names;

  for (const stmt of program.body ?? []) {
    if (stmt?.type === "VariableDeclaration") {
      for (const decl of stmt.declarations ?? []) {
        const id = decl?.id;
        if (id?.type === "Identifier" && typeof id.name === "string") {
          names.add(id.name);
        }
      }
    } else if (stmt?.type === "FunctionDeclaration") {
      if (stmt.id?.type === "Identifier" && typeof stmt.id.name === "string") {
        names.add(stmt.id.name);
      }
    }
  }
  return names;
}

function chooseUniqueIdentifier(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

/**
 * Add imports for local rules from .uilint/rules/
 */
function addLocalRuleImportsAst(
  mod: any,
  selectedRules: RuleMetadata[],
  configPath: string,
  rulesRoot: string,
  fileExtension: string = ".js"
): { importNames: Map<string, string>; changed: boolean } {
  const importNames = new Map<string, string>();
  let changed = false;

  // Calculate relative path from config file to .uilint/rules/
  const configDir = dirname(configPath);
  const rulesDir = join(rulesRoot, ".uilint", "rules");
  const relativeRulesPath = relative(configDir, rulesDir).replace(/\\/g, "/");

  // Ensure it starts with ./ or ../ (note: `.foo` is NOT a valid relative import)
  const normalizedRulesPath =
    relativeRulesPath.startsWith("./") || relativeRulesPath.startsWith("../")
      ? relativeRulesPath
      : `./${relativeRulesPath}`;

  const used = collectTopLevelBindings(mod.$ast);

  for (const rule of selectedRules) {
    // Generate a safe import name (e.g., noArbitraryTailwindRule)
    const importName = chooseUniqueIdentifier(
      `${rule.id
        .replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase())
        .replace(/^./, (c: string) => c.toUpperCase())}Rule`,
      used
    );
    importNames.set(rule.id, importName);
    used.add(importName);

    // Add import statement
    const rulePath = `${normalizedRulesPath}/${rule.id}${fileExtension}`;
    mod.imports.$add({
      imported: "default",
      local: importName,
      from: rulePath,
    });
    changed = true;
  }

  return { importNames, changed };
}

/**
 * Add require statements for local rules (CommonJS)
 */
function addLocalRuleRequiresAst(
  program: any,
  selectedRules: RuleMetadata[],
  configPath: string,
  rulesRoot: string,
  fileExtension: string = ".js"
): { importNames: Map<string, string>; changed: boolean } {
  const importNames = new Map<string, string>();
  let changed = false;

  if (!program || program.type !== "Program") {
    return { importNames, changed };
  }

  // Calculate relative path from config file to .uilint/rules/
  const configDir = dirname(configPath);
  const rulesDir = join(rulesRoot, ".uilint", "rules");
  const relativeRulesPath = relative(configDir, rulesDir).replace(/\\/g, "/");

  // Ensure it starts with ./ or ../ (note: `.foo` is NOT a valid relative require)
  const normalizedRulesPath =
    relativeRulesPath.startsWith("./") || relativeRulesPath.startsWith("../")
      ? relativeRulesPath
      : `./${relativeRulesPath}`;

  const used = collectTopLevelBindings(program);

  for (const rule of selectedRules) {
    // Generate a safe import name
    const importName = chooseUniqueIdentifier(
      `${rule.id
        .replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase())
        .replace(/^./, (c: string) => c.toUpperCase())}Rule`,
      used
    );
    importNames.set(rule.id, importName);
    used.add(importName);

    // Add require statement
    const rulePath = `${normalizedRulesPath}/${rule.id}${fileExtension}`;
    const stmtMod = parseModule(
      `const ${importName} = require("${rulePath}");`
    );
    const stmt = (stmtMod.$ast as any).body?.[0];
    if (stmt) {
      // Place after a leading "use strict" if present.
      let insertAt = 0;
      const first = program.body?.[0];
      if (
        first?.type === "ExpressionStatement" &&
        first.expression?.type === "StringLiteral" &&
        first.expression.value === "use strict"
      ) {
        insertAt = 1;
      }
      program.body.splice(insertAt, 0, stmt);
      changed = true;
    }
  }

  return { importNames, changed };
}

function appendUilintConfigBlockToArray(
  arrayExpr: any,
  selectedRules: RuleMetadata[],
  ruleImportNames: Map<string, string>
): void {
  // Build plugin object with local rule imports
  const pluginRulesCode = Array.from(ruleImportNames.entries())
    .map(([ruleId, importName]) => `      "${ruleId}": ${importName},`)
    .join("\n");

  const rulesPropsCode = selectedRules
    .map((r) => {
      const ruleKey = `uilint/${r.id}`;
      const valueCode =
        r.defaultOptions && r.defaultOptions.length > 0
          ? `["${r.defaultSeverity}", ...${JSON.stringify(
              r.defaultOptions,
              null,
              2
            )}]`
          : `"${r.defaultSeverity}"`;
      return `      "${ruleKey}": ${valueCode},`;
    })
    .join("\n");

  const blockCode = `{
    files: [
      "src/**/*.{js,jsx,ts,tsx}",
      "app/**/*.{js,jsx,ts,tsx}",
      "pages/**/*.{js,jsx,ts,tsx}",
    ],
    plugins: {
      uilint: {
        rules: {
${pluginRulesCode}
        },
      },
    },
    rules: {
${rulesPropsCode}
    },
  }`;

  const objExpr = (parseExpression(blockCode) as any).$ast;
  arrayExpr.elements.push(objExpr);
}

function getUilintEslintConfigInfoFromSourceAst(source: string):
  | {
      info: UilintEslintConfigInfo;
      mod: any;
      arrayExpr: any;
      kind: "esm" | "cjs";
    }
  | { error: string } {
  try {
    const mod = parseModule(source);
    const found = findExportedConfigArrayExpression(mod);
    if (!found) {
      return {
        error:
          "Could not locate an exported ESLint flat config array (expected `export default [...]`, `export default defineConfig([...])`, `module.exports = [...]`, or `module.exports = defineConfig([...])`).",
      };
    }

    const configuredRuleIds = collectConfiguredUilintRuleIdsFromConfigArray(
      found.arrayExpr
    );
    const existingUilint = findExistingUilintRulesObject(found.arrayExpr);
    const configured =
      configuredRuleIds.size > 0 || existingUilint.configObj !== null;

    return {
      info: { configuredRuleIds, configured },
      mod,
      arrayExpr: found.arrayExpr,
      kind: found.kind,
    };
  } catch {
    return {
      error:
        "Unable to parse ESLint config as JavaScript. Please update it manually or simplify the config so it can be safely auto-modified.",
    };
  }
}

export function getUilintEslintConfigInfoFromSource(
  source: string
): UilintEslintConfigInfo {
  const ast = getUilintEslintConfigInfoFromSourceAst(source);
  if ("error" in ast) {
    // Fallback (best-effort) to string heuristics for scan-only scenarios.
    const configuredRuleIds = extractConfiguredUilintRuleIds(source);
    return {
      configuredRuleIds,
      configured: configuredRuleIds.size > 0,
    };
  }
  return ast.info;
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

function findCommonJsExportedConfigArrayStartIndex(
  source: string
): number | null {
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
 * Get rules that exist but need updating (different options or severity)
 */
function buildDesiredRuleValueExpression(rule: RuleMetadata): string {
  if (rule.defaultOptions && rule.defaultOptions.length > 0) {
    // Match the shape we generate elsewhere: ["severity", ...[options...]]
    return `["${rule.defaultSeverity}", ...${JSON.stringify(
      rule.defaultOptions,
      null,
      2
    )}]`;
  }
  return `"${rule.defaultSeverity}"`;
}

function collectUilintRuleValueNodesFromConfigArray(
  arrayExpr: any
): Map<string, any> {
  const out = new Map<string, any>();
  if (!arrayExpr || arrayExpr.type !== "ArrayExpression") return out;

  for (const el of arrayExpr.elements ?? []) {
    if (!el || el.type !== "ObjectExpression") continue;
    const rules = getObjectPropertyValue(el, "rules");
    if (!rules || rules.type !== "ObjectExpression") continue;

    for (const prop of rules.properties ?? []) {
      if (!prop) continue;
      if (prop.type !== "ObjectProperty" && prop.type !== "Property") continue;
      const key = prop.key;
      if (!isStringLiteral(key)) continue;
      const k = key.value;
      if (typeof k !== "string" || !k.startsWith("uilint/")) continue;
      const id = k.slice("uilint/".length);
      // First occurrence wins; that's enough for detecting up-to-date configs.
      if (!out.has(id)) out.set(id, prop.value);
    }
  }

  return out;
}

function getRulesNeedingUpdate(
  selectedRules: RuleMetadata[],
  configuredIds: Set<string>,
  arrayExpr: any
): RuleMetadata[] {
  // Only consider rules that are already configured, and only update if the
  // existing severity/options differ from what we would generate.
  const existingVals = collectUilintRuleValueNodesFromConfigArray(arrayExpr);

  return selectedRules.filter((r) => {
    if (!configuredIds.has(r.id)) return false;
    const existing = existingVals.get(r.id);
    if (!existing) return true;

    const desiredExpr = buildDesiredRuleValueExpression(r);
    const desiredAst = (parseExpression(desiredExpr) as any).$ast;
    return !astEquivalent(existing, desiredAst);
  });
}

/**
 * Generate a single rule config string
 */
function generateSingleRuleConfig(rule: RuleMetadata): string {
  const ruleKey = `"uilint/${rule.id}"`;

  if (rule.defaultOptions && rule.defaultOptions.length > 0) {
    // Rule with options
    const optionsStr = JSON.stringify(rule.defaultOptions, null, 6)
      .split("\n")
      .join("\n      ");
    return `      ${ruleKey}: ["${rule.defaultSeverity}", ...${optionsStr}],`;
  } else {
    // Simple rule
    return `      ${ruleKey}: "${rule.defaultSeverity}",`;
  }
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
 * Find the end of a rule value in the source code
 * Handles: "error", ["error"], ["error", {...}], ["error", ...[{...}]]
 */
function findRuleValueEnd(source: string, startIndex: number): number {
  let pos = startIndex;
  let depth = 0;
  let inString = false;
  let stringChar = "";
  let foundArray = false;

  while (pos < source.length) {
    const ch = source[pos];
    const prevCh = pos > 0 ? source[pos - 1] : "";

    // Handle string literals
    if (!inString && (ch === '"' || ch === "'")) {
      inString = true;
      stringChar = ch;
    } else if (inString && ch === stringChar && prevCh !== "\\") {
      inString = false;
    } else if (!inString) {
      // Track brackets/braces
      if (ch === "[") {
        depth++;
        foundArray = true;
      } else if (ch === "]") {
        depth--;
        if (depth === 0 && foundArray) {
          // Found the end of the array
          pos++;
          // Skip whitespace and include trailing comma if present
          while (pos < source.length && /\s/.test(source[pos])) {
            pos++;
          }
          if (pos < source.length && source[pos] === ",") {
            pos++;
          }
          return pos;
        }
      } else if (ch === "{" || ch === "(") {
        depth++;
      } else if (ch === "}" || ch === ")") {
        depth--;
      } else if (!foundArray && depth === 0) {
        // Simple string value - ends at comma or closing brace
        if (ch === "," || ch === "}") {
          return pos + (ch === "," ? 1 : 0);
        }
      }
    }

    pos++;
  }

  return pos;
}

/**
 * Update existing uilint rule configurations with new options/severity
 *
 * This finds existing rule entries and replaces them with updated configurations.
 * Uses a more robust approach to handle multi-line rules with spread syntax.
 */
function updateExistingRulesWithNewOptions(
  source: string,
  rulesToUpdate: RuleMetadata[]
): string {
  if (rulesToUpdate.length === 0) return source;

  let updated = source;

  // Process rules in reverse order to avoid index shifting issues
  for (let i = rulesToUpdate.length - 1; i >= 0; i--) {
    const rule = rulesToUpdate[i]!;
    const ruleKeyPattern = new RegExp(
      `["']uilint/${rule.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\s*:`,
      "g"
    );

    // Find all occurrences (should only be one, but be safe)
    const matches: Array<{ index: number; length: number }> = [];
    let match;
    while ((match = ruleKeyPattern.exec(updated)) !== null) {
      if (match.index !== undefined) {
        matches.push({ index: match.index, length: match[0].length });
      }
    }

    // Process matches in reverse order
    for (let j = matches.length - 1; j >= 0; j--) {
      const keyMatch = matches[j]!;
      const keyStart = keyMatch.index;
      const keyEnd = keyStart + keyMatch.length;

      // Find the value start (after colon and whitespace)
      let valueStart = keyEnd;
      while (valueStart < updated.length && /\s/.test(updated[valueStart])) {
        valueStart++;
      }

      // Find the value end
      const valueEnd = findRuleValueEnd(updated, valueStart);

      // Generate new rule config
      const newRuleConfig = generateSingleRuleConfig(rule);

      // Find the indentation of the rule key line
      const indent = detectIndent(updated, keyStart);

      // Replace the old rule with the new one
      const before = updated.slice(0, keyStart);
      const after = updated.slice(valueEnd);

      updated = before + newRuleConfig + "\n" + indent + after;
    }
  }

  return updated;
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

  const ast = getUilintEslintConfigInfoFromSourceAst(original);
  if ("error" in ast) {
    return {
      configFile: configFilename,
      modified: false,
      missingRuleIds: [],
      configured: false,
      error: ast.error,
    };
  }

  const { info, mod, arrayExpr, kind } = ast;
  const configuredIds = info.configuredRuleIds;

  const missingRules = getMissingSelectedRules(
    opts.selectedRules,
    configuredIds
  );
  const rulesToUpdate = getRulesNeedingUpdate(
    opts.selectedRules,
    configuredIds,
    arrayExpr
  );

  // Decide what rules to apply, respecting prompts.
  let rulesToApply: RuleMetadata[] = [];
  if (!info.configured) {
    rulesToApply = opts.selectedRules;
  } else {
    // When already configured, we only apply updates + missing rules.
    rulesToApply = [...missingRules, ...rulesToUpdate];
    if (missingRules.length > 0 && !opts.force) {
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
  }

  if (rulesToApply.length === 0) {
    return {
      configFile: configFilename,
      modified: false,
      missingRuleIds: missingRules.map((r) => r.id),
      configured: info.configured,
    };
  }

  let modifiedAst = false;

  // Check if .uilint/rules/ directory exists alongside this target package/app.
  // (Also allow a fallback to workspace root for backwards compatibility.)
  const localRulesDir = join(opts.projectPath, ".uilint", "rules");
  const workspaceRoot = findWorkspaceRoot(opts.projectPath);
  const workspaceRulesDir = join(workspaceRoot, ".uilint", "rules");

  const rulesRoot = existsSync(localRulesDir)
    ? opts.projectPath
    : workspaceRoot;

  // Always use local rules (they should have been copied by the plan phase)
  // Detect file extension by checking what files exist
  let fileExtension = ".js";
  if (rulesToApply.length > 0) {
    const firstRulePath = join(
      rulesRoot,
      ".uilint",
      "rules",
      `${rulesToApply[0]!.id}.ts`
    );
    if (existsSync(firstRulePath)) {
      fileExtension = ".ts";
    }
  }

  let ruleImportNames: Map<string, string> | undefined;

  // Add imports for local rules
  if (kind === "esm") {
    const result = addLocalRuleImportsAst(
      mod,
      rulesToApply,
      configPath,
      rulesRoot,
      fileExtension
    );
    ruleImportNames = result.importNames;
    if (result.changed) modifiedAst = true;
  } else {
    const result = addLocalRuleRequiresAst(
      mod.$ast,
      rulesToApply,
      configPath,
      rulesRoot,
      fileExtension
    );
    ruleImportNames = result.importNames;
    if (result.changed) modifiedAst = true;
  }

  // Add config block with local rules
  if (ruleImportNames && ruleImportNames.size > 0) {
    appendUilintConfigBlockToArray(arrayExpr, rulesToApply, ruleImportNames);
    modifiedAst = true;
  }

  // Ensure uilint-eslint import for utilities (createRule, etc.)
  if (!info.configured) {
    if (kind === "esm") {
      // Import createRule utility from uilint-eslint
      mod.imports.$add({
        imported: "createRule",
        local: "createRule",
        from: "uilint-eslint",
      });
      modifiedAst = true;
    } else {
      // CommonJS: add require for createRule
      const stmtMod = parseModule(
        `const { createRule } = require("uilint-eslint");`
      );
      const stmt = (stmtMod.$ast as any).body?.[0];
      if (stmt) {
        let insertAt = 0;
        const first = mod.$ast.body?.[0];
        if (
          first?.type === "ExpressionStatement" &&
          first.expression?.type === "StringLiteral" &&
          first.expression.value === "use strict"
        ) {
          insertAt = 1;
        }
        mod.$ast.body.splice(insertAt, 0, stmt);
        modifiedAst = true;
      }
    }
  }

  const updated = modifiedAst ? generateCode(mod).code : original;

  if (updated !== original) {
    writeFileSync(configPath, updated, "utf-8");
    return {
      configFile: configFilename,
      modified: true,
      missingRuleIds: missingRules.map((r) => r.id),
      configured: getUilintEslintConfigInfoFromSource(updated).configured,
    };
  }

  return {
    configFile: configFilename,
    modified: false,
    missingRuleIds: missingRules.map((r) => r.id),
    configured: getUilintEslintConfigInfoFromSource(updated).configured,
  };
}

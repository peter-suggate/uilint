/**
 * Inject jsx-loc-plugin into Vite config
 *
 * Modifies vite.config.{ts,js,mjs,cjs} to add `jsxLoc()` to the `plugins` array.
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parseModule, generateCode } from "magicast";

export interface InstallViteJsxLocPluginOptions {
  projectPath: string;
  force?: boolean;
}

const CONFIG_EXTENSIONS = [".ts", ".mjs", ".js", ".cjs"];

export function findViteConfigFile(projectPath: string): string | null {
  for (const ext of CONFIG_EXTENSIONS) {
    const configPath = join(projectPath, `vite.config${ext}`);
    if (existsSync(configPath)) return configPath;
  }
  return null;
}

export function getViteConfigFilename(configPath: string): string {
  const parts = configPath.split("/");
  return parts[parts.length - 1] || "vite.config.ts";
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

function unwrapExpression(expr: any): any {
  let e = expr;
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

function findExportedConfigObjectExpression(mod: any): {
  kind: "esm" | "cjs";
  objExpr: any;
  program: any;
} | null {
  const program = mod?.$ast;
  if (!program || program.type !== "Program") return null;

  // ESM: export default { ... } OR export default defineConfig({ ... })
  for (const stmt of program.body ?? []) {
    if (!stmt || stmt.type !== "ExportDefaultDeclaration") continue;
    const decl = unwrapExpression(stmt.declaration);
    if (!decl) break;

    if (decl.type === "ObjectExpression") {
      return { kind: "esm", objExpr: decl, program };
    }
    if (
      decl.type === "CallExpression" &&
      isIdentifier(decl.callee, "defineConfig") &&
      unwrapExpression(decl.arguments?.[0])?.type === "ObjectExpression"
    ) {
      return {
        kind: "esm",
        objExpr: unwrapExpression(decl.arguments?.[0]),
        program,
      };
    }
    break;
  }

  // CJS: module.exports = { ... } OR module.exports = defineConfig({ ... })
  for (const stmt of program.body ?? []) {
    if (!stmt || stmt.type !== "ExpressionStatement") continue;
    const expr = stmt.expression;
    if (!expr || expr.type !== "AssignmentExpression") continue;
    const left = expr.left;
    const right = unwrapExpression(expr.right);
    const isModuleExports =
      left?.type === "MemberExpression" &&
      isIdentifier(left.object, "module") &&
      isIdentifier(left.property, "exports");
    if (!isModuleExports) continue;

    if (right?.type === "ObjectExpression") {
      return { kind: "cjs", objExpr: right, program };
    }
    if (
      right?.type === "CallExpression" &&
      isIdentifier(right.callee, "defineConfig") &&
      unwrapExpression(right.arguments?.[0])?.type === "ObjectExpression"
    ) {
      return {
        kind: "cjs",
        objExpr: unwrapExpression(right.arguments?.[0]),
        program,
      };
    }
  }

  return null;
}

function getObjectProperty(obj: any, keyName: string): any | null {
  if (!obj || obj.type !== "ObjectExpression") return null;
  for (const prop of obj.properties ?? []) {
    if (!prop) continue;
    if (prop.type !== "ObjectProperty" && prop.type !== "Property") continue;
    const key = prop.key;
    const keyMatch =
      (key?.type === "Identifier" && key.name === keyName) ||
      (isStringLiteral(key) && key.value === keyName);
    if (keyMatch) return prop;
  }
  return null;
}

function ensureEsmJsxLocImport(program: any): { changed: boolean } {
  if (!program || program.type !== "Program") return { changed: false };

  // Find existing import from jsx-loc-plugin/vite
  const existing = (program.body ?? []).find(
    (s: any) =>
      s?.type === "ImportDeclaration" && s.source?.value === "jsx-loc-plugin/vite"
  );
  if (existing) {
    const has = (existing.specifiers ?? []).some(
      (sp: any) =>
        sp?.type === "ImportSpecifier" &&
        (sp.imported?.name === "jsxLoc" || sp.imported?.value === "jsxLoc")
    );
    if (has) return { changed: false };
    const spec = (
      parseModule('import { jsxLoc } from "jsx-loc-plugin/vite";').$ast as any
    ).body?.[0]?.specifiers?.[0];
    if (!spec) return { changed: false };
    existing.specifiers = [...(existing.specifiers ?? []), spec];
    return { changed: true };
  }

  const importDecl = (
    parseModule('import { jsxLoc } from "jsx-loc-plugin/vite";').$ast as any
  ).body?.[0];
  if (!importDecl) return { changed: false };

  // Insert after last import
  const body = program.body ?? [];
  let insertAt = 0;
  while (insertAt < body.length && body[insertAt]?.type === "ImportDeclaration") {
    insertAt++;
  }
  program.body.splice(insertAt, 0, importDecl);
  return { changed: true };
}

function ensureCjsJsxLocRequire(program: any): { changed: boolean } {
  if (!program || program.type !== "Program") return { changed: false };

  // Detect an existing require("jsx-loc-plugin/vite") that binds jsxLoc
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== "VariableDeclaration") continue;
    for (const decl of stmt.declarations ?? []) {
      const init = decl?.init;
      if (
        init?.type === "CallExpression" &&
        isIdentifier(init.callee, "require") &&
        isStringLiteral(init.arguments?.[0]) &&
        init.arguments[0].value === "jsx-loc-plugin/vite"
      ) {
        // If destructuring, ensure property exists
        if (decl.id?.type === "ObjectPattern") {
          const has = (decl.id.properties ?? []).some((p: any) => {
            if (p?.type !== "ObjectProperty" && p?.type !== "Property") return false;
            return isIdentifier(p.key, "jsxLoc");
          });
          if (has) return { changed: false };
          const prop = (
            parseModule('const { jsxLoc } = require("jsx-loc-plugin/vite");')
              .$ast as any
          ).body?.[0]?.declarations?.[0]?.id?.properties?.[0];
          if (!prop) return { changed: false };
          decl.id.properties = [...(decl.id.properties ?? []), prop];
          return { changed: true };
        }
        return { changed: false };
      }
    }
  }

  // Insert: const { jsxLoc } = require("jsx-loc-plugin/vite");
  const reqDecl = (
    parseModule('const { jsxLoc } = require("jsx-loc-plugin/vite");').$ast as any
  ).body?.[0];
  if (!reqDecl) return { changed: false };
  program.body.unshift(reqDecl);
  return { changed: true };
}

function pluginsHasJsxLoc(arr: any): boolean {
  if (!arr || arr.type !== "ArrayExpression") return false;
  for (const el of arr.elements ?? []) {
    const e = unwrapExpression(el);
    if (!e) continue;
    if (e.type === "CallExpression" && isIdentifier(e.callee, "jsxLoc")) return true;
  }
  return false;
}

function ensurePluginsContainsJsxLoc(configObj: any): { changed: boolean } {
  const pluginsProp = getObjectProperty(configObj, "plugins");

  // No plugins: create plugins: [jsxLoc()]
  if (!pluginsProp) {
    const prop = (parseModule("export default { plugins: [jsxLoc()] };").$ast as any)
      .body?.find((s: any) => s.type === "ExportDefaultDeclaration")
      ?.declaration?.properties?.find((p: any) => {
        const k = p?.key;
        return (k?.type === "Identifier" && k.name === "plugins") ||
          (isStringLiteral(k) && k.value === "plugins");
      });
    if (!prop) return { changed: false };
    configObj.properties = [...(configObj.properties ?? []), prop];
    return { changed: true };
  }

  const value = unwrapExpression(pluginsProp.value);
  if (!value) return { changed: false };

  // plugins: [ ... ]
  if (value.type === "ArrayExpression") {
    if (pluginsHasJsxLoc(value)) return { changed: false };
    const jsxLocCall = (parseModule("const __x = jsxLoc();").$ast as any).body?.[0]
      ?.declarations?.[0]?.init;
    if (!jsxLocCall) return { changed: false };
    value.elements.push(jsxLocCall);
    return { changed: true };
  }

  // Non-array plugins: best-effort wrap into array with spread.
  // plugins: something  -> plugins: [...something, jsxLoc()]
  const jsxLocCall = (parseModule("const __x = jsxLoc();").$ast as any).body?.[0]
    ?.declarations?.[0]?.init;
  if (!jsxLocCall) return { changed: false };
  const spread = { type: "SpreadElement", argument: value };
  pluginsProp.value = { type: "ArrayExpression", elements: [spread, jsxLocCall] };
  return { changed: true };
}

export async function installViteJsxLocPlugin(
  opts: InstallViteJsxLocPluginOptions
): Promise<{
  configFile: string | null;
  modified: boolean;
  /** Absolute paths of all files that were modified (for formatting) */
  modifiedFiles: string[];
}> {
  const configPath = findViteConfigFile(opts.projectPath);
  if (!configPath) return { configFile: null, modified: false, modifiedFiles: [] };

  const configFilename = getViteConfigFilename(configPath);
  const original = readFileSync(configPath, "utf-8");
  const isCjs = configPath.endsWith(".cjs");

  let mod: any;
  try {
    mod = parseModule(original);
  } catch {
    return { configFile: configFilename, modified: false, modifiedFiles: [] };
  }

  const found = findExportedConfigObjectExpression(mod);
  if (!found) return { configFile: configFilename, modified: false, modifiedFiles: [] };

  let changed = false;

  // Ensure import/require first (so generated code has the symbol)
  if (isCjs) {
    const reqRes = ensureCjsJsxLocRequire(found.program);
    if (reqRes.changed) changed = true;
  } else {
    const impRes = ensureEsmJsxLocImport(found.program);
    if (impRes.changed) changed = true;
  }

  const pluginsRes = ensurePluginsContainsJsxLoc(found.objExpr);
  if (pluginsRes.changed) changed = true;

  const updated = changed ? generateCode(mod).code : original;
  if (updated !== original) {
    writeFileSync(configPath, updated, "utf-8");
    return { configFile: configFilename, modified: true, modifiedFiles: [configPath] };
  }

  return { configFile: configFilename, modified: false, modifiedFiles: [] };
}

export interface RemoveViteJsxLocPluginOptions {
  projectPath: string;
}

export interface RemoveViteJsxLocPluginResult {
  success: boolean;
  error?: string;
  modifiedFiles?: string[];
}

/**
 * Remove jsx-loc-plugin from vite.config
 *
 * This is a best-effort removal that:
 * 1. Removes jsx-loc-plugin import
 * 2. Removes jsxLoc() from plugins array
 */
export async function removeViteJsxLocPlugin(
  options: RemoveViteJsxLocPluginOptions
): Promise<RemoveViteJsxLocPluginResult> {
  const { projectPath } = options;

  const configPath = findViteConfigFile(projectPath);
  if (!configPath) {
    return {
      success: true,
      modifiedFiles: [],
    };
  }

  try {
    const original = readFileSync(configPath, "utf-8");

    // Remove jsx-loc-plugin import
    let updated = original.replace(
      /^import\s+\{[^}]*jsxLoc[^}]*\}\s+from\s+["']jsx-loc-plugin\/vite["'];?\s*$/gm,
      ""
    );

    // Remove jsx-loc-plugin default import
    updated = updated.replace(
      /^import\s+jsxLoc\s+from\s+["']jsx-loc-plugin\/vite["'];?\s*$/gm,
      ""
    );

    // Remove jsx-loc-plugin require
    updated = updated.replace(
      /^const\s+\{[^}]*jsxLoc[^}]*\}\s*=\s*require\s*\(\s*["']jsx-loc-plugin\/vite["']\s*\)\s*;?\s*$/gm,
      ""
    );

    // Remove jsxLoc() from plugins array
    updated = updated.replace(/jsxLoc\s*\(\s*\)\s*,?\s*/g, "");

    // Clean up empty lines
    updated = updated.replace(/\n{3,}/g, "\n\n");

    if (updated !== original) {
      writeFileSync(configPath, updated, "utf-8");
      return {
        success: true,
        modifiedFiles: [configPath],
      };
    }

    return {
      success: true,
      modifiedFiles: [],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

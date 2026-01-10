/**
 * Inject jsx-loc-plugin into Next.js config
 *
 * Modifies next.config.{ts,js,mjs,cjs} to wrap the export with withJsxLoc()
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parseModule, generateCode } from "magicast";

export interface InstallJsxLocPluginOptions {
  projectPath: string;
  force?: boolean;
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

function ensureEsmWithJsxLocImport(program: any): { changed: boolean } {
  if (!program || program.type !== "Program") return { changed: false };

  // Find existing import from jsx-loc-plugin
  const existing = (program.body ?? []).find(
    (s: any) => s?.type === "ImportDeclaration" && s.source?.value === "jsx-loc-plugin"
  );

  if (existing) {
    const has = (existing.specifiers ?? []).some(
      (sp: any) =>
        sp?.type === "ImportSpecifier" &&
        (sp.imported?.name === "withJsxLoc" || sp.imported?.value === "withJsxLoc")
    );
    if (has) return { changed: false };

    const spec = (parseModule('import { withJsxLoc } from "jsx-loc-plugin";')
      .$ast as any).body?.[0]?.specifiers?.[0];
    if (!spec) return { changed: false };
    existing.specifiers = [...(existing.specifiers ?? []), spec];
    return { changed: true };
  }

  const importDecl = (parseModule('import { withJsxLoc } from "jsx-loc-plugin";')
    .$ast as any).body?.[0];
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

function ensureCjsWithJsxLocRequire(program: any): { changed: boolean } {
  if (!program || program.type !== "Program") return { changed: false };

  // Detect an existing require("jsx-loc-plugin") that binds withJsxLoc
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== "VariableDeclaration") continue;
    for (const decl of stmt.declarations ?? []) {
      const init = decl?.init;
      if (
        init?.type === "CallExpression" &&
        isIdentifier(init.callee, "require") &&
        isStringLiteral(init.arguments?.[0]) &&
        init.arguments[0].value === "jsx-loc-plugin"
      ) {
        // If destructuring, ensure property exists
        if (decl.id?.type === "ObjectPattern") {
          const has = (decl.id.properties ?? []).some((p: any) => {
            if (p?.type !== "ObjectProperty" && p?.type !== "Property") return false;
            return isIdentifier(p.key, "withJsxLoc");
          });
          if (has) return { changed: false };
          const prop = (parseModule('const { withJsxLoc } = require("jsx-loc-plugin");')
            .$ast as any).body?.[0]?.declarations?.[0]?.id?.properties?.[0];
          if (!prop) return { changed: false };
          decl.id.properties = [...(decl.id.properties ?? []), prop];
          return { changed: true };
        }

        // Already requiring the module in some other shape; don't try to rewrite.
        return { changed: false };
      }
    }
  }

  // Insert: const { withJsxLoc } = require("jsx-loc-plugin");
  const reqDecl = (parseModule('const { withJsxLoc } = require("jsx-loc-plugin");')
    .$ast as any).body?.[0];
  if (!reqDecl) return { changed: false };
  program.body.unshift(reqDecl);
  return { changed: true };
}

function wrapEsmExportDefault(program: any): { changed: boolean } {
  if (!program || program.type !== "Program") return { changed: false };

  const exportDecl = (program.body ?? []).find(
    (s: any) => s?.type === "ExportDefaultDeclaration"
  );
  if (!exportDecl) return { changed: false };

  const decl = exportDecl.declaration;
  if (
    decl?.type === "CallExpression" &&
    isIdentifier(decl.callee, "withJsxLoc")
  ) {
    return { changed: false };
  }

  exportDecl.declaration = {
    type: "CallExpression",
    callee: { type: "Identifier", name: "withJsxLoc" },
    arguments: [decl],
  };
  return { changed: true };
}

function wrapCjsModuleExports(program: any): { changed: boolean } {
  if (!program || program.type !== "Program") return { changed: false };

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

    if (
      right?.type === "CallExpression" &&
      isIdentifier(right.callee, "withJsxLoc")
    ) {
      return { changed: false };
    }

    expr.right = {
      type: "CallExpression",
      callee: { type: "Identifier", name: "withJsxLoc" },
      arguments: [right],
    };
    return { changed: true };
  }

  return { changed: false };
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

  let mod: any;
  try {
    mod = parseModule(original);
  } catch {
    return { configFile: configFilename, modified: false };
  }

  const program = mod.$ast;
  const isCjs = configPath.endsWith(".cjs");

  // No confirmOverwrite needed: injector is idempotent.

  let changed = false;
  if (isCjs) {
    const reqRes = ensureCjsWithJsxLocRequire(program);
    if (reqRes.changed) changed = true;
    const wrapRes = wrapCjsModuleExports(program);
    if (wrapRes.changed) changed = true;
  } else {
    const impRes = ensureEsmWithJsxLocImport(program);
    if (impRes.changed) changed = true;
    const wrapRes = wrapEsmExportDefault(program);
    if (wrapRes.changed) changed = true;
  }

  const updated = changed ? generateCode(mod).code : original;

  if (updated !== original) {
    writeFileSync(configPath, updated, "utf-8");
    return { configFile: configFilename, modified: true };
  }

  return { configFile: configFilename, modified: false };
}

import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parseModule, generateCode } from "magicast";

export interface InstallReactOverlayOptions {
  projectPath: string;
  /**
   * Relative app root: "app" or "src/app"
   */
  appRoot: string;
  force?: boolean;
  /**
   * If multiple candidates are found, prompt user to choose.
   */
  confirmFileChoice?: (choices: string[]) => Promise<string>;
}

/**
 * Find top-level layout.* or page.* files in the app root.
 * Prefer layout.* over page.* (layouts are better for providers).
 */
function getDefaultCandidates(projectPath: string, appRoot: string): string[] {
  // Check layout files first (preferred)
  const layoutCandidates = [
    join(appRoot, "layout.tsx"),
    join(appRoot, "layout.jsx"),
    join(appRoot, "layout.ts"),
    join(appRoot, "layout.js"),
  ];

  const existingLayouts = layoutCandidates.filter((rel) =>
    existsSync(join(projectPath, rel))
  );

  if (existingLayouts.length > 0) {
    return existingLayouts;
  }

  // Fall back to page files if no layouts found
  const pageCandidates = [join(appRoot, "page.tsx"), join(appRoot, "page.jsx")];

  return pageCandidates.filter((rel) => existsSync(join(projectPath, rel)));
}

function isUseClientDirective(stmt: any): boolean {
  return (
    stmt?.type === "ExpressionStatement" &&
    stmt.expression?.type === "StringLiteral" &&
    stmt.expression.value === "use client"
  );
}

function findImportDeclaration(program: any, from: string): any | null {
  if (!program || program.type !== "Program") return null;
  for (const stmt of program.body ?? []) {
    if (stmt?.type !== "ImportDeclaration") continue;
    if (stmt.source?.value === from) return stmt;
  }
  return null;
}

function walkAst(node: any, visit: (n: any) => void): void {
  if (!node || typeof node !== "object") return;
  if (node.type) visit(node);
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

function ensureNamedImport(
  program: any,
  from: string,
  name: string
): { changed: boolean } {
  if (!program || program.type !== "Program") return { changed: false };

  const existing = findImportDeclaration(program, from);
  if (existing) {
    const has = (existing.specifiers ?? []).some(
      (s: any) =>
        s?.type === "ImportSpecifier" &&
        (s.imported?.name === name || s.imported?.value === name)
    );
    if (has) return { changed: false };

    const spec = (parseModule(`import { ${name} } from "${from}";`).$ast as any)
      .body?.[0]?.specifiers?.[0];
    if (!spec) return { changed: false };

    existing.specifiers = [...(existing.specifiers ?? []), spec];
    return { changed: true };
  }

  // Insert a fresh import after directives, and after existing imports.
  const importDecl = (
    parseModule(`import { ${name} } from "${from}";`).$ast as any
  ).body?.[0];
  if (!importDecl) return { changed: false };

  const body = program.body ?? [];
  let insertAt = 0;
  while (insertAt < body.length && isUseClientDirective(body[insertAt])) {
    insertAt++;
  }
  // Skip over existing imports
  while (
    insertAt < body.length &&
    body[insertAt]?.type === "ImportDeclaration"
  ) {
    insertAt++;
  }
  program.body.splice(insertAt, 0, importDecl);
  return { changed: true };
}

function hasUILintProviderJsx(program: any): boolean {
  let found = false;
  walkAst(program, (node) => {
    if (found) return;
    if (node.type !== "JSXElement") return;
    const name = node.openingElement?.name;
    if (name?.type === "JSXIdentifier" && name.name === "UILintProvider") {
      found = true;
    }
  });
  return found;
}

function wrapFirstChildrenExpressionWithProvider(program: any): {
  changed: boolean;
} {
  if (!program || program.type !== "Program") return { changed: false };
  if (hasUILintProviderJsx(program)) return { changed: false };

  const providerMod = parseModule(
    'const __uilint_provider = (<UILintProvider enabled={process.env.NODE_ENV !== "production"}>{children}</UILintProvider>);'
  );
  const providerJsx =
    (providerMod.$ast as any).body?.[0]?.declarations?.[0]?.init ?? null;
  if (!providerJsx || providerJsx.type !== "JSXElement")
    return { changed: false };

  let replaced = false;
  walkAst(program, (node) => {
    if (replaced) return;
    if (
      node.type === "JSXExpressionContainer" &&
      node.expression?.type === "Identifier" &&
      node.expression.name === "children"
    ) {
      // Replace `{children}` with `<UILintProvider ...>{children}</UILintProvider>`
      // by replacing the expression container node with the provider JSX element.
      Object.keys(node).forEach((k) => delete (node as any)[k]);
      Object.assign(node, providerJsx);
      replaced = true;
    }
  });

  if (!replaced) {
    throw new Error("Could not find `{children}` in target file to wrap.");
  }
  return { changed: true };
}

export async function installReactUILintOverlay(
  opts: InstallReactOverlayOptions
): Promise<{
  targetFile: string;
  modified: boolean;
  alreadyConfigured?: boolean;
}> {
  const candidates = getDefaultCandidates(opts.projectPath, opts.appRoot);
  if (!candidates.length) {
    throw new Error(
      `No suitable Next.js entry files found under ${opts.appRoot} (expected layout.* or page.*).`
    );
  }

  let chosen: string;

  // If there are multiple candidates, ask user to choose
  if (candidates.length > 1 && opts.confirmFileChoice) {
    chosen = await opts.confirmFileChoice(candidates);
  } else {
    // Single candidate - use it
    chosen = candidates[0]!;
  }

  const absTarget = join(opts.projectPath, chosen);
  const original = readFileSync(absTarget, "utf-8");

  let mod: any;
  try {
    mod = parseModule(original);
  } catch {
    throw new Error(
      `Unable to parse ${chosen} as JavaScript/TypeScript. Please update it manually.`
    );
  }

  const program = mod.$ast;
  const alreadyConfigured =
    !!findImportDeclaration(program, "uilint-react") &&
    hasUILintProviderJsx(program);

  let changed = false;
  const importRes = ensureNamedImport(
    program,
    "uilint-react",
    "UILintProvider"
  );
  if (importRes.changed) changed = true;
  const wrapRes = wrapFirstChildrenExpressionWithProvider(program);
  if (wrapRes.changed) changed = true;

  const updated = changed ? generateCode(mod).code : original;

  const modified = updated !== original;
  if (modified) {
    writeFileSync(absTarget, updated, "utf-8");
  }

  return {
    targetFile: chosen,
    modified,
    alreadyConfigured: alreadyConfigured && !modified,
  };
}

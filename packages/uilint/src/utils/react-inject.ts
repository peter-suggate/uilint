import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parseModule, generateCode } from "magicast";

export interface InstallReactOverlayOptions {
  projectPath: string;
  /**
   * Relative entry root:
   * - Next.js: "app" or "src/app"
   * - Vite: typically "src"
   */
  appRoot: string;
  /**
   * Injection mode:
   * - "next": wraps `{children}` (App Router layout/page)
   * - "vite": wraps the first `*.render(<...>)` argument
   */
  mode?: "next" | "vite";
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
  // Vite entry files (prefer src/main.*)
  const viteMainCandidates = [
    join(appRoot, "main.tsx"),
    join(appRoot, "main.jsx"),
    join(appRoot, "main.ts"),
    join(appRoot, "main.js"),
  ];
  const existingViteMain = viteMainCandidates.filter((rel) =>
    existsSync(join(projectPath, rel))
  );
  if (existingViteMain.length > 0) return existingViteMain;

  // Vite fallback: src/App.* (some templates wire provider there)
  const viteAppCandidates = [join(appRoot, "App.tsx"), join(appRoot, "App.jsx")];
  const existingViteApp = viteAppCandidates.filter((rel) =>
    existsSync(join(projectPath, rel))
  );
  if (existingViteApp.length > 0) return existingViteApp;

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

function hasUILintDevtoolsJsx(program: any): boolean {
  let found = false;
  walkAst(program, (node) => {
    if (found) return;
    if (node.type !== "JSXElement") return;
    const name = node.openingElement?.name;
    // Check for both old UILintProvider and new uilint-devtools
    if (name?.type === "JSXIdentifier") {
      if (name.name === "UILintProvider" || name.name === "uilint-devtools") {
        found = true;
      }
    }
  });
  return found;
}

/**
 * Add <uilint-devtools /> element as a sibling to {children} in Next.js layouts.
 * This injects the devtools web component without wrapping the children.
 */
function addDevtoolsElementNextJs(program: any): {
  changed: boolean;
} {
  if (!program || program.type !== "Program") return { changed: false };
  if (hasUILintDevtoolsJsx(program)) return { changed: false };

  // Create the devtools JSX element: <uilint-devtools />
  const devtoolsMod = parseModule(
    'const __uilint_devtools = (<uilint-devtools />);'
  );
  const devtoolsJsx =
    (devtoolsMod.$ast as any).body?.[0]?.declarations?.[0]?.init ?? null;
  if (!devtoolsJsx || devtoolsJsx.type !== "JSXElement")
    return { changed: false };

  // Find the return statement that contains {children} and add devtools as sibling
  let added = false;
  walkAst(program, (node) => {
    if (added) return;

    // Look for JSX elements that contain {children}
    if (node.type !== "JSXElement" && node.type !== "JSXFragment") return;

    const children = node.children ?? [];
    const childrenIndex = children.findIndex(
      (child: any) =>
        child?.type === "JSXExpressionContainer" &&
        child.expression?.type === "Identifier" &&
        child.expression.name === "children"
    );

    if (childrenIndex === -1) return;

    // Add devtools element after {children}
    children.splice(childrenIndex + 1, 0, devtoolsJsx);
    added = true;
  });

  if (!added) {
    throw new Error("Could not find `{children}` in target file to add devtools.");
  }
  return { changed: true };
}

/**
 * Add <uilint-devtools /> element to Vite's render call.
 * Wraps the existing render argument in a fragment with the devtools element.
 */
function addDevtoolsElementVite(program: any): {
  changed: boolean;
} {
  if (!program || program.type !== "Program") return { changed: false };
  if (hasUILintDevtoolsJsx(program)) return { changed: false };

  // Create a fragment containing the original content + devtools:
  // <>...original...<uilint-devtools /></>
  let added = false;
  walkAst(program, (node) => {
    if (added) return;
    if (node.type !== "CallExpression") return;
    const callee = node.callee;
    // Match: something.render(<JSX />)
    if (callee?.type !== "MemberExpression") return;
    const prop = callee.property;
    const isRender =
      (prop?.type === "Identifier" && prop.name === "render") ||
      (prop?.type === "StringLiteral" && prop.value === "render") ||
      (prop?.type === "Literal" && prop.value === "render");
    if (!isRender) return;

    const arg0 = node.arguments?.[0];
    if (!arg0) return;
    if (arg0.type !== "JSXElement" && arg0.type !== "JSXFragment") return;

    // Create the devtools JSX element
    const devtoolsMod = parseModule(
      'const __uilint_devtools = (<uilint-devtools />);'
    );
    const devtoolsJsx =
      (devtoolsMod.$ast as any).body?.[0]?.declarations?.[0]?.init ?? null;
    if (!devtoolsJsx) return;

    // Create a fragment wrapping original + devtools
    const fragmentMod = parseModule(
      'const __fragment = (<></>);'
    );
    const fragmentJsx =
      (fragmentMod.$ast as any).body?.[0]?.declarations?.[0]?.init ?? null;
    if (!fragmentJsx) return;

    // Add original content and devtools as children of the fragment
    fragmentJsx.children = [arg0, devtoolsJsx];
    node.arguments[0] = fragmentJsx;
    added = true;
  });

  if (!added) {
    throw new Error(
      'Could not find a `.render(<...>)` call to add devtools. Expected a React entry like `createRoot(...).render(<App />)`.'
    );
  }
  return { changed: true };
}

/**
 * Ensure a side-effect import exists in the program.
 * e.g., import "uilint-react/devtools";
 */
function ensureSideEffectImport(
  program: any,
  from: string
): { changed: boolean } {
  if (!program || program.type !== "Program") return { changed: false };

  // Check if import already exists
  const existing = findImportDeclaration(program, from);
  if (existing) return { changed: false };

  // Create a side-effect import
  const importDecl = (
    parseModule(`import "${from}";`).$ast as any
  ).body?.[0];
  if (!importDecl) return { changed: false };

  const body = program.body ?? [];
  let insertAt = 0;
  // Skip "use client" directive
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
      `No suitable entry files found under ${opts.appRoot} (expected Next.js layout/page or Vite main/App).`
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

  // Check if already configured (either old UILintProvider or new devtools approach)
  const hasDevtoolsImport = !!findImportDeclaration(program, "uilint-react/devtools");
  const hasOldImport = !!findImportDeclaration(program, "uilint-react");
  const alreadyConfigured =
    (hasDevtoolsImport || hasOldImport) && hasUILintDevtoolsJsx(program);

  let changed = false;

  // Add side-effect import for the devtools web component
  const importRes = ensureSideEffectImport(program, "uilint-react/devtools");
  if (importRes.changed) changed = true;

  const mode = opts.mode ?? "next";
  const addRes =
    mode === "vite"
      ? addDevtoolsElementVite(program)
      : addDevtoolsElementNextJs(program);
  if (addRes.changed) changed = true;

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

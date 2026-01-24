import { existsSync, readFileSync, writeFileSync } from "fs";
import { join, relative, dirname, basename } from "path";
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
  /**
   * Specific file to inject into (absolute path).
   * If provided, skips candidate detection.
   */
  targetFile?: string;
  /**
   * If true, create a new providers.tsx file and wrap the layout's children.
   * Used when no existing client boundaries are found.
   */
  createProviders?: boolean;
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
  // Note: Parse without parentheses to avoid extra.parenthesized in AST
  const devtoolsMod = parseModule(
    'const __uilint_devtools = <uilint-devtools />;'
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
    // Note: Parse without parentheses to avoid extra.parenthesized in AST
    const devtoolsMod = parseModule(
      'const __uilint_devtools = <uilint-devtools />;'
    );
    const devtoolsJsx =
      (devtoolsMod.$ast as any).body?.[0]?.declarations?.[0]?.init ?? null;
    if (!devtoolsJsx) return;

    // Create a fragment wrapping original + devtools
    // Note: Parse without parentheses to avoid extra.parenthesized in AST
    const fragmentMod = parseModule(
      'const __fragment = <></>;'
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

/**
 * Add <uilint-devtools /> to a client component file.
 * Finds the main component's return statement and wraps JSX in a fragment.
 */
function addDevtoolsToClientComponent(program: any): {
  changed: boolean;
} {
  if (!program || program.type !== "Program") return { changed: false };
  if (hasUILintDevtoolsJsx(program)) return { changed: false };

  // Create the devtools JSX element
  // Note: Parse without parentheses to avoid extra.parenthesized in AST
  const devtoolsMod = parseModule(
    'const __uilint_devtools = <uilint-devtools />;'
  );
  const devtoolsJsx =
    (devtoolsMod.$ast as any).body?.[0]?.declarations?.[0]?.init ?? null;
  if (!devtoolsJsx || devtoolsJsx.type !== "JSXElement")
    return { changed: false };

  // First try: look for {children} pattern (common in provider components)
  let added = false;
  walkAst(program, (node) => {
    if (added) return;
    if (node.type !== "JSXElement" && node.type !== "JSXFragment") return;

    const children = node.children ?? [];
    const childrenIndex = children.findIndex(
      (child: any) =>
        child?.type === "JSXExpressionContainer" &&
        child.expression?.type === "Identifier" &&
        child.expression.name === "children"
    );

    if (childrenIndex !== -1) {
      // Add devtools element after {children}
      children.splice(childrenIndex + 1, 0, devtoolsJsx);
      added = true;
    }
  });

  if (added) return { changed: true };

  // Second try: find the first return statement with JSX and wrap it in a fragment
  walkAst(program, (node) => {
    if (added) return;
    if (node.type !== "ReturnStatement") return;
    const arg = node.argument;
    if (!arg) return;
    if (arg.type !== "JSXElement" && arg.type !== "JSXFragment") return;

    // Create a fragment wrapping original + devtools
    // Note: Parse without parentheses to avoid extra.parenthesized in AST
    const fragmentMod = parseModule('const __fragment = <></>;');
    const fragmentJsx =
      (fragmentMod.$ast as any).body?.[0]?.declarations?.[0]?.init ?? null;
    if (!fragmentJsx) return;

    // Add original content and devtools as children of the fragment
    fragmentJsx.children = [arg, devtoolsJsx];
    node.argument = fragmentJsx;
    added = true;
  });

  if (!added) {
    throw new Error(
      "Could not find a suitable location to add devtools. Expected a component with JSX return or {children}."
    );
  }
  return { changed: true };
}

/**
 * Generate the content for a new providers.tsx file
 */
function generateProvidersContent(isTypeScript: boolean): string {
  const ext = isTypeScript ? "tsx" : "jsx";
  const typeAnnotation = isTypeScript
    ? ": { children: React.ReactNode }"
    : "";

  return `"use client";

import React from "react";
import "uilint-react/devtools";

export function Providers({ children }${typeAnnotation}) {
  return (
    <>
      {children}
      <uilint-devtools />
    </>
  );
}
`;
}

/**
 * Wrap {children} in a layout file with a <Providers> component
 */
function wrapChildrenWithProviders(
  program: any,
  providersImportPath: string
): { changed: boolean } {
  if (!program || program.type !== "Program") return { changed: false };

  // Check if Providers is already imported
  let hasProvidersImport = false;
  for (const stmt of (program as any).body ?? []) {
    if (stmt?.type !== "ImportDeclaration") continue;
    if (stmt.source?.value === providersImportPath) {
      hasProvidersImport = true;
      break;
    }
  }

  // Add Providers import if not present
  if (!hasProvidersImport) {
    const importRes = ensureNamedImport(program, providersImportPath, "Providers");
    if (!importRes.changed) return { changed: false };
  }

  // Find {children} and wrap with <Providers>
  let wrapped = false;
  walkAst(program, (node) => {
    if (wrapped) return;
    if (node.type !== "JSXElement" && node.type !== "JSXFragment") return;

    const children = node.children ?? [];
    const childrenIndex = children.findIndex(
      (child: any) =>
        child?.type === "JSXExpressionContainer" &&
        child.expression?.type === "Identifier" &&
        child.expression.name === "children"
    );

    if (childrenIndex === -1) return;

    // Create <Providers>{children}</Providers>
    // Note: Parse without parentheses to avoid extra.parenthesized in AST
    const providersMod = parseModule(
      'const __providers = <Providers>{children}</Providers>;'
    );
    const providersJsx =
      (providersMod.$ast as any).body?.[0]?.declarations?.[0]?.init ?? null;
    if (!providersJsx) return;

    // Replace {children} with <Providers>{children}</Providers>
    children[childrenIndex] = providersJsx;
    wrapped = true;
  });

  if (!wrapped) {
    throw new Error(
      "Could not find {children} in layout to wrap with Providers."
    );
  }

  return { changed: true };
}

/**
 * Find the layout file in the app root
 */
function findLayoutFile(projectPath: string, appRoot: string): string | null {
  const extensions = [".tsx", ".jsx", ".ts", ".js"];
  for (const ext of extensions) {
    const layoutPath = join(projectPath, appRoot, `layout${ext}`);
    if (existsSync(layoutPath)) return layoutPath;
  }
  return null;
}

/**
 * Create providers.tsx file and modify the layout to use it
 */
async function createProvidersAndModifyLayout(
  projectPath: string,
  appRoot: string
): Promise<{
  providersFile: string;
  layoutFile: string;
  modified: boolean;
}> {
  // Find the layout file
  const layoutPath = findLayoutFile(projectPath, appRoot);
  if (!layoutPath) {
    throw new Error(`Could not find layout file in ${appRoot}`);
  }

  // Determine if TypeScript based on layout extension
  const isTypeScript = layoutPath.endsWith(".tsx") || layoutPath.endsWith(".ts");
  const providersExt = isTypeScript ? ".tsx" : ".jsx";
  const providersPath = join(projectPath, appRoot, `providers${providersExt}`);

  // Check if providers already exists
  if (existsSync(providersPath)) {
    throw new Error(
      `providers${providersExt} already exists. Please select it from the list instead.`
    );
  }

  // Create the providers file
  const providersContent = generateProvidersContent(isTypeScript);
  writeFileSync(providersPath, providersContent, "utf-8");

  // Modify the layout to import and use Providers
  const layoutContent = readFileSync(layoutPath, "utf-8");
  let layoutMod: any;
  try {
    layoutMod = parseModule(layoutContent);
  } catch {
    throw new Error(
      `Unable to parse ${relative(projectPath, layoutPath)} as JavaScript/TypeScript.`
    );
  }

  const layoutProgram = layoutMod.$ast;
  const wrapRes = wrapChildrenWithProviders(layoutProgram, "./providers");

  if (wrapRes.changed) {
    const updatedLayout = generateCode(layoutMod).code;
    writeFileSync(layoutPath, updatedLayout, "utf-8");
  }

  return {
    providersFile: relative(projectPath, providersPath),
    layoutFile: relative(projectPath, layoutPath),
    modified: true,
  };
}

export async function installReactUILintOverlay(
  opts: InstallReactOverlayOptions
): Promise<{
  targetFile: string;
  modified: boolean;
  alreadyConfigured?: boolean;
  /** Additional file created (e.g., providers.tsx) */
  createdFile?: string;
  /** Layout file modified to wrap children */
  layoutModified?: string;
  /** Absolute paths of all files that were modified/created (for formatting) */
  modifiedFiles: string[];
}> {
  // Handle createProviders mode: create providers.tsx and modify layout
  if (opts.createProviders) {
    const result = await createProvidersAndModifyLayout(
      opts.projectPath,
      opts.appRoot
    );
    // Collect absolute paths of modified files
    const modifiedFiles: string[] = [];
    if (result.modified) {
      modifiedFiles.push(join(opts.projectPath, result.providersFile));
      modifiedFiles.push(join(opts.projectPath, result.layoutFile));
    }
    return {
      targetFile: result.providersFile,
      modified: result.modified,
      createdFile: result.providersFile,
      layoutModified: result.layoutFile,
      modifiedFiles,
    };
  }

  // Handle targetFile mode: inject into a specific client component
  if (opts.targetFile) {
    const absTarget = opts.targetFile;
    const relTarget = relative(opts.projectPath, absTarget);

    if (!existsSync(absTarget)) {
      throw new Error(`Target file not found: ${relTarget}`);
    }

    const original = readFileSync(absTarget, "utf-8");
    let mod: any;
    try {
      mod = parseModule(original);
    } catch {
      throw new Error(
        `Unable to parse ${relTarget} as JavaScript/TypeScript. Please update it manually.`
      );
    }

    const program = mod.$ast;

    // Check if already configured
    const hasDevtoolsImport = !!findImportDeclaration(program, "uilint-react/devtools");
    const hasOldImport = !!findImportDeclaration(program, "uilint-react");
    const alreadyConfigured =
      (hasDevtoolsImport || hasOldImport) && hasUILintDevtoolsJsx(program);

    if (alreadyConfigured) {
      return {
        targetFile: relTarget,
        modified: false,
        alreadyConfigured: true,
        modifiedFiles: [],
      };
    }

    let changed = false;

    // Add side-effect import for the devtools web component
    const importRes = ensureSideEffectImport(program, "uilint-react/devtools");
    if (importRes.changed) changed = true;

    // Use client component injection (handles both {children} and return JSX)
    const addRes = addDevtoolsToClientComponent(program);
    if (addRes.changed) changed = true;

    const updated = changed ? generateCode(mod).code : original;
    const modified = updated !== original;

    if (modified) {
      writeFileSync(absTarget, updated, "utf-8");
    }

    return {
      targetFile: relTarget,
      modified,
      alreadyConfigured: false,
      modifiedFiles: modified ? [absTarget] : [],
    };
  }

  // Default mode: auto-detect candidates (original behavior)
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
    modifiedFiles: modified ? [absTarget] : [],
  };
}

export interface RemoveReactOverlayOptions {
  projectPath: string;
  appRoot: string;
  mode?: "next" | "vite";
}

export interface RemoveReactOverlayResult {
  success: boolean;
  error?: string;
  modifiedFiles?: string[];
}

/**
 * Remove uilint-react devtools from React files
 *
 * This is a best-effort removal that:
 * 1. Removes uilint-react/devtools import
 * 2. Removes <uilint-devtools /> element
 */
export async function removeReactUILintOverlay(
  options: RemoveReactOverlayOptions
): Promise<RemoveReactOverlayResult> {
  const { projectPath, appRoot, mode = "next" } = options;

  const candidates = getDefaultCandidates(projectPath, appRoot);
  const modifiedFiles: string[] = [];

  for (const candidate of candidates) {
    const absPath = join(projectPath, candidate);
    if (!existsSync(absPath)) continue;

    try {
      const original = readFileSync(absPath, "utf-8");

      // Remove uilint-react/devtools import
      let updated = original.replace(
        /^import\s+["']uilint-react\/devtools["'];?\s*$/gm,
        ""
      );

      // Remove uilint-react import (legacy)
      updated = updated.replace(
        /^import\s+\{[^}]*UILintProvider[^}]*\}\s+from\s+["']uilint-react["'];?\s*$/gm,
        ""
      );

      // Remove <uilint-devtools /> or <uilint-devtools></uilint-devtools>
      updated = updated.replace(/<uilint-devtools\s*\/>/g, "");
      updated = updated.replace(/<uilint-devtools><\/uilint-devtools>/g, "");
      updated = updated.replace(/<uilint-devtools\s*>\s*<\/uilint-devtools>/g, "");

      // Remove UILintProvider wrapper (legacy)
      updated = updated.replace(
        /<UILintProvider[^>]*>([\s\S]*?)<\/UILintProvider>/g,
        "$1"
      );

      // Clean up empty lines
      updated = updated.replace(/\n{3,}/g, "\n\n");

      if (updated !== original) {
        writeFileSync(absPath, updated, "utf-8");
        modifiedFiles.push(absPath);
      }
    } catch {
      // Skip files that fail to process
    }
  }

  return {
    success: true,
    modifiedFiles,
  };
}

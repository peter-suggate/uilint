/**
 * Client Boundary Tracer
 *
 * Traces imports from a Next.js root layout to find all files with "use client" directive.
 * Used to help users choose where to inject the UILint devtools component.
 */

import { existsSync, readFileSync } from "fs";
import { join, dirname, relative } from "path";
import { parseModule } from "magicast";

/**
 * Information about a client boundary file
 */
export interface ClientBoundary {
  /** Absolute file path */
  filePath: string;
  /** Relative path for display (e.g., "./providers.tsx") */
  relativePath: string;
  /** Names of components/exports imported from this file */
  componentNames: string[];
  /** Import source as written in the layout (e.g., "./providers") */
  importSource: string;
}

/**
 * Result of tracing client boundaries from a layout file
 */
export interface TraceResult {
  /** Whether the root layout itself has "use client" directive */
  layoutIsClient: boolean;
  /** Client boundary files found in the layout's imports */
  clientBoundaries: ClientBoundary[];
  /** The root layout file path (absolute) */
  layoutFile: string;
  /** Relative path to layout from project root */
  layoutRelative: string;
}

/**
 * Check if a file has "use client" directive
 */
function hasUseClientDirective(filePath: string): boolean {
  try {
    const content = readFileSync(filePath, "utf-8");
    const mod = parseModule(content);
    const program = mod.$ast;

    if (!program || program.type !== "Program") return false;

    const firstStmt = (program as any).body?.[0];
    return (
      firstStmt?.type === "ExpressionStatement" &&
      firstStmt.expression?.type === "StringLiteral" &&
      (firstStmt.expression.value === "use client" ||
        firstStmt.expression.value === "use client")
    );
  } catch {
    return false;
  }
}

/**
 * Extract imports from a parsed module
 */
function extractImports(
  program: any
): Array<{ source: string; specifiers: string[] }> {
  const imports: Array<{ source: string; specifiers: string[] }> = [];

  if (!program || program.type !== "Program") return imports;

  for (const stmt of (program as any).body ?? []) {
    if (stmt?.type !== "ImportDeclaration") continue;

    const source = stmt.source?.value;
    if (typeof source !== "string") continue;

    // Skip non-relative imports (node_modules, etc.)
    // We only trace local imports for client boundaries
    if (!source.startsWith(".") && !source.startsWith("@/") && !source.startsWith("~/")) {
      continue;
    }

    const specifiers: string[] = [];
    for (const spec of stmt.specifiers ?? []) {
      if (spec.type === "ImportDefaultSpecifier") {
        specifiers.push("default");
      } else if (spec.type === "ImportSpecifier") {
        const name = spec.imported?.name ?? spec.imported?.value;
        if (name) specifiers.push(name);
      } else if (spec.type === "ImportNamespaceSpecifier") {
        specifiers.push("*");
      }
    }

    imports.push({ source, specifiers });
  }

  return imports;
}

/**
 * Try to resolve an import source to an absolute file path
 */
function resolveImportPath(
  importSource: string,
  fromFile: string,
  projectPath: string
): string | null {
  const fromDir = dirname(fromFile);

  // Handle path aliases
  let basePath: string;
  if (importSource.startsWith("@/")) {
    // Common Next.js alias - @/ -> project root or src/
    const withoutAlias = importSource.slice(2);
    // Try src/ first, then project root
    const srcPath = join(projectPath, "src", withoutAlias);
    const rootPath = join(projectPath, withoutAlias);
    basePath = existsSync(dirname(srcPath)) ? srcPath : rootPath;
  } else if (importSource.startsWith("~/")) {
    // Another common alias
    basePath = join(projectPath, importSource.slice(2));
  } else if (importSource.startsWith(".")) {
    // Relative import
    basePath = join(fromDir, importSource);
  } else {
    // Likely a node_modules import, skip
    return null;
  }

  // Try different extensions
  const extensions = [".tsx", ".ts", ".jsx", ".js"];

  // Try exact path with extensions
  for (const ext of extensions) {
    const fullPath = basePath + ext;
    if (existsSync(fullPath)) return fullPath;
  }

  // Try as directory with index file
  for (const ext of extensions) {
    const indexPath = join(basePath, `index${ext}`);
    if (existsSync(indexPath)) return indexPath;
  }

  // Try exact path (might already have extension)
  if (existsSync(basePath)) return basePath;

  return null;
}

/**
 * Find the root layout file in a Next.js App Router project
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
 * Trace imports from a Next.js root layout to find client boundaries
 */
export function traceClientBoundaries(
  projectPath: string,
  appRoot: string
): TraceResult | null {
  const layoutFile = findLayoutFile(projectPath, appRoot);
  if (!layoutFile) {
    return null;
  }

  const layoutIsClient = hasUseClientDirective(layoutFile);
  const layoutRelative = relative(projectPath, layoutFile);

  // If layout is already a client component, no need to trace further
  if (layoutIsClient) {
    return {
      layoutIsClient: true,
      clientBoundaries: [],
      layoutFile,
      layoutRelative,
    };
  }

  // Parse the layout file
  let program: any;
  try {
    const content = readFileSync(layoutFile, "utf-8");
    const mod = parseModule(content);
    program = mod.$ast;
  } catch {
    return {
      layoutIsClient: false,
      clientBoundaries: [],
      layoutFile,
      layoutRelative,
    };
  }

  // Extract and trace imports
  const imports = extractImports(program);
  const clientBoundaries: ClientBoundary[] = [];

  for (const imp of imports) {
    const resolvedPath = resolveImportPath(imp.source, layoutFile, projectPath);
    if (!resolvedPath) continue;

    if (hasUseClientDirective(resolvedPath)) {
      clientBoundaries.push({
        filePath: resolvedPath,
        relativePath: relative(projectPath, resolvedPath),
        componentNames: imp.specifiers,
        importSource: imp.source,
      });
    }
  }

  return {
    layoutIsClient: false,
    clientBoundaries,
    layoutFile,
    layoutRelative,
  };
}

/**
 * Check if a providers file already exists in the app root
 */
export function providersFileExists(
  projectPath: string,
  appRoot: string
): string | null {
  const extensions = [".tsx", ".jsx", ".ts", ".js"];
  const names = ["providers", "Providers"];

  for (const name of names) {
    for (const ext of extensions) {
      const providersPath = join(projectPath, appRoot, `${name}${ext}`);
      if (existsSync(providersPath)) return providersPath;
    }
  }

  return null;
}

/**
 * Export Resolver
 *
 * Resolves import paths and finds export definitions, following re-exports
 * to their original source files.
 */

import { ResolverFactory } from "oxc-resolver";
import { parse } from "@typescript-eslint/typescript-estree";
import { readFileSync, existsSync } from "fs";
import { dirname, join, extname } from "path";
import type { TSESTree } from "@typescript-eslint/utils";

// Module-level resolver instance (reused across calls)
let resolverInstance: ReturnType<typeof ResolverFactory.prototype.sync> | null =
  null;
let resolverFactory: ResolverFactory | null = null;

/**
 * Information about a resolved export
 */
export interface ResolvedExport {
  /** The name of the export (e.g., "Button") */
  name: string;
  /** Absolute path to the file containing the actual definition */
  filePath: string;
  /** The local name in the source file (may differ from export name) */
  localName: string;
  /** Whether this is a re-export (export { X } from './other') */
  isReexport: boolean;
}

/**
 * Cache for file exports to avoid re-parsing
 */
const exportCache = new Map<
  string,
  Map<string, { localName: string; reexportSource?: string }>
>();

/**
 * Cache for parsed ASTs
 */
const astCache = new Map<string, TSESTree.Program>();

/**
 * Cache for resolved paths
 */
const resolvedPathCache = new Map<string, string | null>();

/**
 * Get or create the resolver factory
 */
function getResolverFactory(): ResolverFactory {
  if (!resolverFactory) {
    resolverFactory = new ResolverFactory({
      extensions: [".tsx", ".ts", ".jsx", ".js"],
      mainFields: ["module", "main"],
      conditionNames: ["import", "require", "node", "default"],
      // Enable TypeScript path resolution
      tsconfig: {
        configFile: "tsconfig.json",
        references: "auto",
      },
    });
  }
  return resolverFactory;
}

/**
 * Resolve an import path to an absolute file path
 */
export function resolveImportPath(
  importSource: string,
  fromFile: string
): string | null {
  const cacheKey = `${fromFile}::${importSource}`;

  if (resolvedPathCache.has(cacheKey)) {
    return resolvedPathCache.get(cacheKey) ?? null;
  }

  // Skip node_modules
  if (
    importSource.startsWith("react") ||
    importSource.startsWith("next") ||
    (!importSource.startsWith(".") &&
      !importSource.startsWith("@/") &&
      !importSource.startsWith("~/"))
  ) {
    // Check if it's a known external package
    if (
      importSource.includes("@mui/") ||
      importSource.includes("@chakra-ui/") ||
      importSource.includes("antd") ||
      importSource.includes("@radix-ui/")
    ) {
      // Return a marker for external packages - we don't resolve them but track them
      resolvedPathCache.set(cacheKey, null);
      return null;
    }
    resolvedPathCache.set(cacheKey, null);
    return null;
  }

  try {
    const factory = getResolverFactory();
    const fromDir = dirname(fromFile);
    const result = factory.sync(fromDir, importSource);

    if (result.path) {
      resolvedPathCache.set(cacheKey, result.path);
      return result.path;
    }
  } catch {
    // Fallback: try manual resolution for common patterns
    const resolved = manualResolve(importSource, fromFile);
    resolvedPathCache.set(cacheKey, resolved);
    return resolved;
  }

  resolvedPathCache.set(cacheKey, null);
  return null;
}

/**
 * Manual fallback resolution for common patterns
 */
function manualResolve(importSource: string, fromFile: string): string | null {
  const fromDir = dirname(fromFile);
  const extensions = [".tsx", ".ts", ".jsx", ".js"];

  // Handle @/ alias - find tsconfig and resolve
  if (importSource.startsWith("@/")) {
    const projectRoot = findProjectRoot(fromFile);
    if (projectRoot) {
      const relativePath = importSource.slice(2); // Remove @/
      for (const ext of extensions) {
        const candidate = join(projectRoot, relativePath + ext);
        if (existsSync(candidate)) {
          return candidate;
        }
        // Try index file
        const indexCandidate = join(projectRoot, relativePath, `index${ext}`);
        if (existsSync(indexCandidate)) {
          return indexCandidate;
        }
      }
    }
  }

  // Handle relative imports
  if (importSource.startsWith(".")) {
    for (const ext of extensions) {
      const candidate = join(fromDir, importSource + ext);
      if (existsSync(candidate)) {
        return candidate;
      }
      // Try index file
      const indexCandidate = join(fromDir, importSource, `index${ext}`);
      if (existsSync(indexCandidate)) {
        return indexCandidate;
      }
    }
  }

  return null;
}

/**
 * Find the project root by looking for tsconfig.json or package.json
 */
function findProjectRoot(fromFile: string): string | null {
  let dir = dirname(fromFile);
  const root = "/";

  while (dir !== root) {
    if (existsSync(join(dir, "tsconfig.json"))) {
      return dir;
    }
    if (existsSync(join(dir, "package.json"))) {
      return dir;
    }
    dir = dirname(dir);
  }

  return null;
}

/**
 * Parse a file and cache the AST
 */
export function parseFile(filePath: string): TSESTree.Program | null {
  if (astCache.has(filePath)) {
    return astCache.get(filePath)!;
  }

  try {
    const content = readFileSync(filePath, "utf-8");
    const ast = parse(content, {
      jsx: true,
      loc: true,
      range: true,
    });
    astCache.set(filePath, ast);
    return ast;
  } catch {
    return null;
  }
}

/**
 * Extract export information from a file
 */
function extractExports(
  filePath: string
): Map<string, { localName: string; reexportSource?: string }> {
  if (exportCache.has(filePath)) {
    return exportCache.get(filePath)!;
  }

  const exports = new Map<
    string,
    { localName: string; reexportSource?: string }
  >();
  const ast = parseFile(filePath);

  if (!ast) {
    exportCache.set(filePath, exports);
    return exports;
  }

  for (const node of ast.body) {
    // Handle: export function Button() {}
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "FunctionDeclaration" &&
      node.declaration.id
    ) {
      exports.set(node.declaration.id.name, {
        localName: node.declaration.id.name,
      });
    }

    // Handle: export const Button = () => {}
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "VariableDeclaration"
    ) {
      for (const decl of node.declaration.declarations) {
        if (decl.id.type === "Identifier") {
          exports.set(decl.id.name, { localName: decl.id.name });
        }
      }
    }

    // Handle: export { Button } or export { Button as Btn }
    if (node.type === "ExportNamedDeclaration" && node.specifiers.length > 0) {
      const source = node.source?.value as string | undefined;
      for (const spec of node.specifiers) {
        if (spec.type === "ExportSpecifier") {
          const exportedName =
            spec.exported.type === "Identifier"
              ? spec.exported.name
              : spec.exported.value;
          const localName =
            spec.local.type === "Identifier"
              ? spec.local.name
              : spec.local.value;

          exports.set(exportedName, {
            localName,
            reexportSource: source,
          });
        }
      }
    }

    // Handle: export default function Button() {}
    if (
      node.type === "ExportDefaultDeclaration" &&
      node.declaration.type === "FunctionDeclaration" &&
      node.declaration.id
    ) {
      exports.set("default", { localName: node.declaration.id.name });
    }

    // Handle: export default Button
    if (
      node.type === "ExportDefaultDeclaration" &&
      node.declaration.type === "Identifier"
    ) {
      exports.set("default", { localName: node.declaration.name });
    }
  }

  exportCache.set(filePath, exports);
  return exports;
}

/**
 * Resolve an export to its original definition, following re-exports
 */
export function resolveExport(
  exportName: string,
  filePath: string,
  visited = new Set<string>()
): ResolvedExport | null {
  // Cycle detection
  const key = `${filePath}::${exportName}`;
  if (visited.has(key)) {
    return null;
  }
  visited.add(key);

  const exports = extractExports(filePath);
  const exportInfo = exports.get(exportName);

  if (!exportInfo) {
    return null;
  }

  // If it's a re-export, follow the chain
  if (exportInfo.reexportSource) {
    const resolvedPath = resolveImportPath(exportInfo.reexportSource, filePath);
    if (resolvedPath) {
      return resolveExport(exportInfo.localName, resolvedPath, visited);
    }
    return null;
  }

  // This is the actual definition
  return {
    name: exportName,
    filePath,
    localName: exportInfo.localName,
    isReexport: false,
  };
}

/**
 * Clear all caches (useful for testing or watch mode)
 */
export function clearResolverCaches(): void {
  exportCache.clear();
  astCache.clear();
  resolvedPathCache.clear();
}

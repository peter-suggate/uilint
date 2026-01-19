/**
 * Dependency Graph Builder
 *
 * Builds a dependency graph by tracing all imports from an entry file.
 * Used for calculating aggregate test coverage across a component and its dependencies.
 *
 * Key behaviors:
 * - Traces transitive dependencies (full depth)
 * - Excludes node_modules (external packages)
 * - Handles circular dependencies via visited set
 * - Follows re-exports to actual source files
 * - Caches results for performance
 */

import { existsSync, readFileSync, statSync } from "fs";
import { dirname, resolve } from "path";
import { parse } from "@typescript-eslint/typescript-estree";
import type { TSESTree } from "@typescript-eslint/utils";
import { resolveImportPath, parseFile } from "./export-resolver";

export interface DependencyGraph {
  /** The entry file that was analyzed */
  root: string;
  /** All transitive dependencies (absolute paths, project files only) */
  allDependencies: Set<string>;
}

interface CacheEntry {
  graph: DependencyGraph;
  mtime: number;
}

/**
 * Cache for dependency graphs (per entry file)
 */
const dependencyCache = new Map<string, CacheEntry>();

/**
 * Build a dependency graph starting from an entry file
 *
 * @param entryFile - Absolute path to the entry file
 * @param projectRoot - Project root directory (used for determining project boundaries)
 * @returns DependencyGraph with all transitive dependencies
 */
export function buildDependencyGraph(
  entryFile: string,
  projectRoot: string
): DependencyGraph {
  // Check cache
  const cached = dependencyCache.get(entryFile);
  if (cached) {
    // Validate cache by checking entry file mtime
    try {
      const currentMtime = statSync(entryFile).mtimeMs;
      if (currentMtime === cached.mtime) {
        return cached.graph;
      }
    } catch {
      // File doesn't exist or can't be read, invalidate cache
    }
  }

  const allDependencies = new Set<string>();
  const visited = new Set<string>();

  // Recursively collect dependencies
  collectDependencies(entryFile, projectRoot, allDependencies, visited);

  const graph: DependencyGraph = {
    root: entryFile,
    allDependencies,
  };

  // Cache the result
  try {
    const mtime = statSync(entryFile).mtimeMs;
    dependencyCache.set(entryFile, { graph, mtime });
  } catch {
    // If we can't get mtime, don't cache
  }

  return graph;
}

/**
 * Recursively collect dependencies from a file
 */
function collectDependencies(
  filePath: string,
  projectRoot: string,
  allDependencies: Set<string>,
  visited: Set<string>
): void {
  // Prevent infinite loops from circular dependencies
  if (visited.has(filePath)) {
    return;
  }
  visited.add(filePath);

  // Parse the file to extract imports
  const imports = extractImports(filePath);

  for (const importSource of imports) {
    // Resolve the import to an absolute path
    const resolvedPath = resolveImportPath(importSource, filePath);

    if (!resolvedPath) {
      // Could not resolve (external package or unresolvable)
      continue;
    }

    // Skip node_modules
    if (resolvedPath.includes("node_modules")) {
      continue;
    }

    // Skip files outside the project
    if (!resolvedPath.startsWith(projectRoot)) {
      continue;
    }

    // Skip already visited files (handles circular dependencies)
    // This prevents adding the root file back as a dependency
    if (visited.has(resolvedPath)) {
      continue;
    }

    // Add to dependencies
    allDependencies.add(resolvedPath);

    // Recurse into this dependency
    collectDependencies(resolvedPath, projectRoot, allDependencies, visited);
  }
}

/**
 * Extract all import sources from a file
 */
function extractImports(filePath: string): string[] {
  if (!existsSync(filePath)) {
    return [];
  }

  const ast = parseFile(filePath);
  if (!ast) {
    return [];
  }

  const imports: string[] = [];

  for (const node of ast.body) {
    // import ... from "source"
    if (node.type === "ImportDeclaration" && node.source.value) {
      imports.push(node.source.value as string);
    }

    // export ... from "source" (re-exports)
    if (
      node.type === "ExportNamedDeclaration" &&
      node.source?.value
    ) {
      imports.push(node.source.value as string);
    }

    // export * from "source"
    if (node.type === "ExportAllDeclaration" && node.source.value) {
      imports.push(node.source.value as string);
    }
  }

  // Also check for dynamic imports in the AST
  const dynamicImports = extractDynamicImports(ast);
  imports.push(...dynamicImports);

  return imports;
}

/**
 * Extract dynamic import() calls from the AST
 */
function extractDynamicImports(ast: TSESTree.Program): string[] {
  const imports: string[] = [];

  function visit(node: TSESTree.Node): void {
    // import("source")
    if (
      node.type === "ImportExpression" &&
      node.source.type === "Literal" &&
      typeof node.source.value === "string"
    ) {
      imports.push(node.source.value);
    }

    // Recurse into children
    for (const key of Object.keys(node)) {
      const child = (node as unknown as Record<string, unknown>)[key];
      if (child && typeof child === "object") {
        if (Array.isArray(child)) {
          for (const item of child) {
            if (item && typeof item === "object" && "type" in item) {
              visit(item as TSESTree.Node);
            }
          }
        } else if ("type" in child) {
          visit(child as TSESTree.Node);
        }
      }
    }
  }

  for (const node of ast.body) {
    visit(node);
  }

  return imports;
}

/**
 * Invalidate the cache for a specific file
 *
 * Call this when a file changes to ensure fresh data
 */
export function invalidateDependencyCache(filePath: string): void {
  dependencyCache.delete(filePath);

  // Also invalidate any graphs that include this file as a dependency
  for (const [entryFile, entry] of dependencyCache) {
    if (entry.graph.allDependencies.has(filePath)) {
      dependencyCache.delete(entryFile);
    }
  }
}

/**
 * Clear the entire dependency cache
 */
export function clearDependencyCache(): void {
  dependencyCache.clear();
}

/**
 * Get cache statistics (for debugging/monitoring)
 */
export function getDependencyCacheStats(): {
  size: number;
  entries: string[];
} {
  return {
    size: dependencyCache.size,
    entries: Array.from(dependencyCache.keys()),
  };
}

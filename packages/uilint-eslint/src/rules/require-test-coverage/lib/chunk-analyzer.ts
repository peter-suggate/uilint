/**
 * Chunk Analyzer
 *
 * Analyzes individual "chunks" (exported functions, classes, hooks, stores)
 * for test coverage. Used for granular coverage reporting at the function level
 * instead of file level.
 *
 * Categories:
 * - utility: formatters, validators, helpers (strict threshold)
 * - hook: React hooks (use* pattern) (strict threshold)
 * - store: Zustand/Redux stores (strict threshold)
 * - handler: event handler functions (relaxed threshold)
 * - component: JSX-returning functions (relaxed threshold)
 */

import type { TSESTree } from "@typescript-eslint/utils";
import {
  findStatementsInRange,
  calculateCoverageFromStatements,
  type IstanbulFileCoverage,
  type SourceLocation,
  type CoverageStats,
} from "./jsx-coverage-analyzer.js";

export type ChunkCategory =
  | "utility"
  | "hook"
  | "store"
  | "handler"
  | "component";

export interface ChunkInfo {
  /** Function/export name */
  name: string;
  /** Category of this chunk */
  category: ChunkCategory;
  /** Whether this is React-related code */
  isReactRelated: boolean;
  /** Location in source (full function body) */
  loc: SourceLocation;
  /** Location of just the declaration line (for error highlighting) */
  declarationLoc: SourceLocation;
  /** Function ID in fnMap (if found) */
  fnId: string | null;
  /** Is this an export? */
  isExport: boolean;
}

export interface ChunkCoverageResult extends ChunkInfo {
  /** Coverage stats for this chunk */
  coverage: {
    /** Was the function ever called during tests? */
    functionCalled: boolean;
    /** Number of statements covered */
    statementsCovered: number;
    /** Total statements in the function */
    statementsTotal: number;
    /** Coverage percentage (0-100) */
    percentage: number;
  };
}

/**
 * Check if an AST node contains JSX elements
 */
function containsJSX(
  node: TSESTree.Node,
  visited: WeakSet<object> = new WeakSet()
): boolean {
  if (!node || typeof node !== "object") return false;
  if (visited.has(node)) return false;
  visited.add(node);

  if (
    node.type === "JSXElement" ||
    node.type === "JSXFragment" ||
    node.type === "JSXText"
  ) {
    return true;
  }

  // Only traverse known child properties to avoid parent references
  const childKeys = [
    "body",
    "declarations",
    "declaration",
    "expression",
    "expressions",
    "argument",
    "arguments",
    "callee",
    "elements",
    "properties",
    "value",
    "init",
    "consequent",
    "alternate",
    "test",
    "left",
    "right",
    "object",
    "property",
    "children",
    "openingElement",
    "closingElement",
  ];

  for (const key of childKeys) {
    const child = (node as unknown as Record<string, unknown>)[key];
    if (child && typeof child === "object") {
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === "object" && "type" in item) {
            if (containsJSX(item as TSESTree.Node, visited)) return true;
          }
        }
      } else if ("type" in child) {
        if (containsJSX(child as TSESTree.Node, visited)) return true;
      }
    }
  }

  return false;
}

/**
 * Categorize a function based on its name and content
 */
export function categorizeChunk(
  name: string,
  functionBody: TSESTree.Node | null,
  isInStoreFile: boolean
): { category: ChunkCategory; isReactRelated: boolean } {
  // Hooks: starts with "use" followed by uppercase
  if (/^use[A-Z]/.test(name)) {
    return { category: "hook", isReactRelated: true };
  }

  // Store: in a .store.ts file or name ends with Store
  if (isInStoreFile || /Store$/.test(name)) {
    return { category: "store", isReactRelated: false };
  }

  // Handler: starts with "handle" or "on" followed by uppercase
  if (/^handle[A-Z]/.test(name) || /^on[A-Z]/.test(name)) {
    return { category: "handler", isReactRelated: true };
  }

  // Component: contains JSX (check the function body)
  if (functionBody && containsJSX(functionBody)) {
    return { category: "component", isReactRelated: true };
  }

  // Default: utility
  return { category: "utility", isReactRelated: false };
}

/**
 * Extract function name from various AST patterns
 */
function getFunctionName(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionExpression,
  parent: TSESTree.Node | undefined
): string | null {
  // Named function declaration
  if (node.type === "FunctionDeclaration" && node.id) {
    return node.id.name;
  }

  // Variable declarator: const foo = () => {}
  if (parent?.type === "VariableDeclarator" && parent.id.type === "Identifier") {
    return parent.id.name;
  }

  // Property: { foo: () => {} }
  if (parent?.type === "Property" && parent.key.type === "Identifier") {
    return parent.key.name;
  }

  return null;
}

/**
 * Find function ID in fnMap by matching name and location
 */
function findFnId(
  name: string,
  loc: SourceLocation,
  fileCoverage: IstanbulFileCoverage | null
): string | null {
  if (!fileCoverage) return null;

  for (const [fnId, fnInfo] of Object.entries(fileCoverage.fnMap)) {
    // Match by name first
    if (fnInfo.name === name) {
      return fnId;
    }

    // If name doesn't match (anonymous or different), match by location
    // Function declaration location should be close to our AST location
    if (
      fnInfo.decl.start.line === loc.start.line ||
      fnInfo.loc.start.line === loc.start.line
    ) {
      return fnId;
    }
  }

  return null;
}

/**
 * Calculate coverage for a specific function
 */
function calculateChunkCoverage(
  fnId: string | null,
  loc: SourceLocation,
  fileCoverage: IstanbulFileCoverage | null
): ChunkCoverageResult["coverage"] {
  if (!fileCoverage) {
    return {
      functionCalled: false,
      statementsCovered: 0,
      statementsTotal: 0,
      percentage: 0,
    };
  }

  // Check if function was called
  const functionCalled = fnId !== null && (fileCoverage.f[fnId] ?? 0) > 0;

  // Find statements within function body
  const statementIds = findStatementsInRange(loc, fileCoverage);
  const stats = calculateCoverageFromStatements(statementIds, fileCoverage);

  return {
    functionCalled,
    statementsCovered: stats.covered,
    statementsTotal: stats.total,
    percentage: stats.percentage,
  };
}

/**
 * Collect all exported functions/classes from an AST
 */
interface ExportedFunction {
  name: string;
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionExpression;
  loc: SourceLocation;
  /** Location of just the declaration line (for highlighting) */
  declarationLoc: SourceLocation;
  body: TSESTree.Node | null;
}

/**
 * Get declaration location - just the first line of the function
 * This is used for error highlighting to avoid highlighting the entire function body
 */
function getDeclarationLoc(loc: SourceLocation): SourceLocation {
  return {
    start: loc.start,
    end: { line: loc.start.line, column: 999 },
  };
}

function collectExportedFunctions(ast: TSESTree.Program): ExportedFunction[] {
  const exports: ExportedFunction[] = [];

  for (const node of ast.body) {
    // export function foo() {}
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "FunctionDeclaration" &&
      node.declaration.id
    ) {
      const loc = node.declaration.loc;
      exports.push({
        name: node.declaration.id.name,
        node: node.declaration,
        loc,
        declarationLoc: getDeclarationLoc(loc),
        body: node.declaration.body,
      });
    }

    // export const foo = () => {}
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "VariableDeclaration"
    ) {
      for (const decl of node.declaration.declarations) {
        if (
          decl.id.type === "Identifier" &&
          decl.init &&
          (decl.init.type === "ArrowFunctionExpression" ||
            decl.init.type === "FunctionExpression")
        ) {
          // For arrow functions, use the variable declaration line, not the function body
          const loc = decl.init.loc;
          const declarationLoc = getDeclarationLoc(decl.loc);
          exports.push({
            name: decl.id.name,
            node: decl.init,
            loc,
            declarationLoc,
            body: decl.init.body,
          });
        }
      }
    }

    // export default function foo() {}
    if (
      node.type === "ExportDefaultDeclaration" &&
      node.declaration.type === "FunctionDeclaration"
    ) {
      const name = node.declaration.id?.name ?? "default";
      const loc = node.declaration.loc;
      exports.push({
        name,
        node: node.declaration,
        loc,
        declarationLoc: getDeclarationLoc(loc),
        body: node.declaration.body,
      });
    }

    // export default () => {}
    if (
      node.type === "ExportDefaultDeclaration" &&
      (node.declaration.type === "ArrowFunctionExpression" ||
        node.declaration.type === "FunctionExpression")
    ) {
      const loc = node.declaration.loc;
      exports.push({
        name: "default",
        node: node.declaration,
        loc,
        declarationLoc: getDeclarationLoc(loc),
        body: node.declaration.body,
      });
    }
  }

  return exports;
}

/**
 * Analyze all exported chunks in a file for coverage
 *
 * @param ast - The parsed AST of the file
 * @param filePath - Path to the file (used for store detection)
 * @param fileCoverage - Istanbul coverage data for the file (or null)
 * @returns Array of chunks with their coverage information
 */
export function analyzeChunks(
  ast: TSESTree.Program,
  filePath: string,
  fileCoverage: IstanbulFileCoverage | null
): ChunkCoverageResult[] {
  const isInStoreFile = /\.store\.(ts|tsx)$/.test(filePath);
  const exportedFunctions = collectExportedFunctions(ast);
  const results: ChunkCoverageResult[] = [];

  for (const exported of exportedFunctions) {
    const { category, isReactRelated } = categorizeChunk(
      exported.name,
      exported.body,
      isInStoreFile
    );

    const fnId = findFnId(exported.name, exported.loc, fileCoverage);
    const coverage = calculateChunkCoverage(fnId, exported.loc, fileCoverage);

    results.push({
      name: exported.name,
      category,
      isReactRelated,
      loc: exported.loc,
      declarationLoc: exported.declarationLoc,
      fnId,
      isExport: true,
      coverage,
    });
  }

  return results;
}

/**
 * Get the appropriate threshold for a chunk based on options
 */
export function getChunkThreshold(
  chunk: ChunkCoverageResult,
  options: {
    focusNonReact?: boolean;
    chunkThreshold?: number;
    relaxedThreshold?: number;
  }
): number {
  const strictThreshold = options.chunkThreshold ?? 80;
  const relaxedThreshold = options.relaxedThreshold ?? 50;

  if (!options.focusNonReact) {
    // Uniform threshold for all chunks
    return strictThreshold;
  }

  // focusNonReact mode: relaxed threshold for React-related code
  if (chunk.category === "component" || chunk.category === "handler") {
    return relaxedThreshold;
  }

  // Strict threshold for utility, hook, store
  return strictThreshold;
}

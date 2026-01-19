/**
 * File Categorizer
 *
 * Categorizes TypeScript/React files by their role in the codebase.
 * Used for smart weighting in coverage aggregation.
 *
 * Categories:
 * - core (1.0): hooks, components, services, stores - critical logic
 * - utility (0.5): formatters, validators, helpers - supporting code
 * - constant (0.25): config, constants, enums - static data
 * - type (0): .d.ts files, type-only exports - no runtime impact
 */

import { existsSync, readFileSync } from "fs";
import { basename } from "path";
import { parse } from "@typescript-eslint/typescript-estree";
import type { TSESTree } from "@typescript-eslint/utils";

export type FileCategory = "core" | "utility" | "constant" | "type";

export interface FileCategoryResult {
  category: FileCategory;
  weight: number;
  reason: string;
}

const CATEGORY_WEIGHTS: Record<FileCategory, number> = {
  core: 1.0,
  utility: 0.5,
  constant: 0.25,
  type: 0,
};

/**
 * Categorize a TypeScript/React file by its role
 */
export function categorizeFile(
  filePath: string,
  _projectRoot: string
): FileCategoryResult {
  const fileName = basename(filePath);

  // 1. Type definition files are always "type"
  if (filePath.endsWith(".d.ts")) {
    return {
      category: "type",
      weight: 0,
      reason: "TypeScript declaration file (.d.ts)",
    };
  }

  // 2. Check file name patterns for core files
  // Hooks: use*.ts or use*.tsx
  if (/^use[A-Z]/.test(fileName)) {
    return {
      category: "core",
      weight: 1.0,
      reason: "React hook (use* pattern)",
    };
  }

  // Services: *.service.ts
  if (/\.service\.(ts|tsx)$/.test(fileName)) {
    return {
      category: "core",
      weight: 1.0,
      reason: "Service file (*.service.ts pattern)",
    };
  }

  // Stores: *.store.ts
  if (/\.store\.(ts|tsx)$/.test(fileName)) {
    return {
      category: "core",
      weight: 1.0,
      reason: "Store file (*.store.ts pattern)",
    };
  }

  // API files: *.api.ts
  if (/\.api\.(ts|tsx)$/.test(fileName)) {
    return {
      category: "core",
      weight: 1.0,
      reason: "API file (*.api.ts pattern)",
    };
  }

  // 3. Parse AST to analyze exports
  if (!existsSync(filePath)) {
    return {
      category: "utility",
      weight: 0.5,
      reason: "File not found, defaulting to utility",
    };
  }

  let ast: TSESTree.Program;
  try {
    const content = readFileSync(filePath, "utf-8");
    ast = parse(content, {
      jsx: true,
      loc: true,
      range: true,
    });
  } catch {
    return {
      category: "utility",
      weight: 0.5,
      reason: "Failed to parse file, defaulting to utility",
    };
  }

  // Analyze the file's exports
  const analysis = analyzeExports(ast);

  // 4. Type-only files (only type/interface exports, no runtime code)
  if (analysis.hasOnlyTypeExports) {
    return {
      category: "type",
      weight: 0,
      reason: "File contains only type/interface exports",
    };
  }

  // 5. Check for JSX (React component)
  if (analysis.hasJSX) {
    return {
      category: "core",
      weight: 1.0,
      reason: "React component (contains JSX)",
    };
  }

  // 6. Constant files (only const/enum exports, no functions)
  if (analysis.hasOnlyConstantExports) {
    return {
      category: "constant",
      weight: 0.25,
      reason: "File contains only constant/enum exports",
    };
  }

  // 7. Default to utility
  return {
    category: "utility",
    weight: 0.5,
    reason: "General utility file with function exports",
  };
}

interface ExportAnalysis {
  hasOnlyTypeExports: boolean;
  hasOnlyConstantExports: boolean;
  hasJSX: boolean;
  hasFunctionExports: boolean;
  hasConstExports: boolean;
  hasTypeExports: boolean;
}

/**
 * Analyze exports in an AST to determine file category
 */
function analyzeExports(ast: TSESTree.Program): ExportAnalysis {
  let hasFunctionExports = false;
  let hasConstExports = false;
  let hasTypeExports = false;
  let hasJSX = false;

  // Walk the AST to find exports and JSX
  function visit(node: TSESTree.Node): void {
    // Check for JSX
    if (
      node.type === "JSXElement" ||
      node.type === "JSXFragment" ||
      node.type === "JSXText"
    ) {
      hasJSX = true;
    }

    // Export named declaration
    if (node.type === "ExportNamedDeclaration") {
      const decl = node.declaration;

      // Type/interface exports
      if (
        node.exportKind === "type" ||
        decl?.type === "TSTypeAliasDeclaration" ||
        decl?.type === "TSInterfaceDeclaration"
      ) {
        hasTypeExports = true;
      }
      // Function exports
      else if (
        decl?.type === "FunctionDeclaration" ||
        (decl?.type === "VariableDeclaration" &&
          decl.declarations.some(
            (d) =>
              d.init?.type === "ArrowFunctionExpression" ||
              d.init?.type === "FunctionExpression"
          ))
      ) {
        hasFunctionExports = true;
      }
      // Const/enum exports
      else if (
        decl?.type === "VariableDeclaration" ||
        decl?.type === "TSEnumDeclaration"
      ) {
        // Check if it's a const with non-function value
        if (decl.type === "VariableDeclaration") {
          const hasNonFunctionInit = decl.declarations.some(
            (d) =>
              d.init &&
              d.init.type !== "ArrowFunctionExpression" &&
              d.init.type !== "FunctionExpression"
          );
          if (hasNonFunctionInit) {
            hasConstExports = true;
          }
        } else {
          hasConstExports = true;
        }
      }
      // Re-exports without declaration - check specifiers
      else if (!decl && node.specifiers.length > 0) {
        // For re-exports, we can't easily determine the type without resolving
        // Treat as potential function exports to be safe
        // Note: if exportKind was "type", we would have matched the first branch
        hasFunctionExports = true;
      }
    }

    // Export default
    if (node.type === "ExportDefaultDeclaration") {
      const decl = node.declaration;
      if (
        decl.type === "FunctionDeclaration" ||
        decl.type === "ArrowFunctionExpression" ||
        decl.type === "FunctionExpression"
      ) {
        hasFunctionExports = true;
      } else if (decl.type === "ClassDeclaration") {
        // Classes are typically core logic
        hasFunctionExports = true;
      } else {
        hasConstExports = true;
      }
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

  // Determine derived properties
  const hasOnlyTypeExports =
    hasTypeExports && !hasFunctionExports && !hasConstExports;
  const hasOnlyConstantExports =
    hasConstExports && !hasFunctionExports && !hasTypeExports;

  return {
    hasOnlyTypeExports,
    hasOnlyConstantExports,
    hasJSX,
    hasFunctionExports,
    hasConstExports,
    hasTypeExports,
  };
}

/**
 * Get the weight for a category
 */
export function getCategoryWeight(category: FileCategory): number {
  return CATEGORY_WEIGHTS[category];
}

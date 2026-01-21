/**
 * Component Parser
 *
 * Parses a single component's body to extract styling information
 * and identify nested component usage.
 */

import type { TSESTree } from "@typescript-eslint/utils";
import { parseFile } from "./export-resolver.js";

/**
 * Known UI library import patterns
 */
export type LibraryName = "shadcn" | "mui" | "chakra" | "antd";

export const LIBRARY_PATTERNS: Record<LibraryName, string[]> = {
  shadcn: ["@/components/ui", "@radix-ui/", "components/ui/"],
  mui: ["@mui/material", "@mui/icons-material", "@emotion/"],
  chakra: ["@chakra-ui/"],
  antd: ["antd", "@ant-design/"],
};

/**
 * Information about a component used within another component
 */
export interface UsedComponent {
  /** Component name (e.g., "Button", "Card") */
  name: string;
  /** Import source path (e.g., "@mui/material", "./button") */
  importSource: string;
  /** Line number where the component is used */
  line: number;
  /** Column number where the component is used */
  column: number;
}

/**
 * Styling information extracted from a component
 */
export interface ComponentStyleInfo {
  /** Tailwind classes used in the component */
  tailwindClasses: string[];
  /** Inline style objects (as string representations) */
  inlineStyles: string[];
  /** Other components used within this component */
  usedComponents: UsedComponent[];
  /** Directly detected library (from import source) */
  directLibrary: LibraryName | null;
}

/**
 * Import map for a file: localName -> importSource
 */
export type ImportMap = Map<string, string>;

/**
 * Extract imports from a file's AST
 */
export function extractImports(ast: TSESTree.Program): ImportMap {
  const imports = new Map<string, string>();

  for (const node of ast.body) {
    if (node.type === "ImportDeclaration") {
      const source = node.source.value as string;
      for (const spec of node.specifiers) {
        if (spec.type === "ImportSpecifier") {
          imports.set(spec.local.name, source);
        } else if (spec.type === "ImportDefaultSpecifier") {
          imports.set(spec.local.name, source);
        } else if (spec.type === "ImportNamespaceSpecifier") {
          imports.set(spec.local.name, source);
        }
      }
    }
  }

  return imports;
}

/**
 * Detect which UI library an import source belongs to
 */
export function detectLibraryFromSource(
  importSource: string
): LibraryName | null {
  for (const [library, patterns] of Object.entries(LIBRARY_PATTERNS)) {
    if (patterns.some((p) => importSource.includes(p))) {
      return library as LibraryName;
    }
  }
  return null;
}

/**
 * Find a function/arrow function component definition by name in an AST
 */
export function findComponentDefinition(
  ast: TSESTree.Program,
  componentName: string
): TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | null {
  for (const node of ast.body) {
    // export function ComponentName() {}
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "FunctionDeclaration" &&
      node.declaration.id?.name === componentName
    ) {
      return node.declaration;
    }

    // export const ComponentName = () => {}
    if (
      node.type === "ExportNamedDeclaration" &&
      node.declaration?.type === "VariableDeclaration"
    ) {
      for (const decl of node.declaration.declarations) {
        if (
          decl.id.type === "Identifier" &&
          decl.id.name === componentName &&
          decl.init?.type === "ArrowFunctionExpression"
        ) {
          return decl.init;
        }
      }
    }

    // function ComponentName() {} (not exported directly)
    if (
      node.type === "FunctionDeclaration" &&
      node.id?.name === componentName
    ) {
      return node;
    }

    // const ComponentName = () => {}
    if (node.type === "VariableDeclaration") {
      for (const decl of node.declarations) {
        if (
          decl.id.type === "Identifier" &&
          decl.id.name === componentName &&
          decl.init?.type === "ArrowFunctionExpression"
        ) {
          return decl.init;
        }
      }
    }

    // export default function ComponentName() {}
    if (
      node.type === "ExportDefaultDeclaration" &&
      node.declaration.type === "FunctionDeclaration" &&
      node.declaration.id?.name === componentName
    ) {
      return node.declaration;
    }
  }

  return null;
}

/**
 * Extract Tailwind classes from a className string
 */
function extractTailwindClasses(classString: string): string[] {
  return classString.split(/\s+/).filter(Boolean);
}

/**
 * Recursively traverse a node and extract styling info
 */
function traverseForStyling(
  node: TSESTree.Node,
  imports: ImportMap,
  result: ComponentStyleInfo
): void {
  if (!node || typeof node !== "object") return;

  // Handle JSX elements
  if (node.type === "JSXElement" && node.openingElement) {
    const opening = node.openingElement;

    // Check if this is a component (PascalCase) or HTML element
    if (
      opening.name.type === "JSXIdentifier" &&
      /^[A-Z]/.test(opening.name.name)
    ) {
      const componentName = opening.name.name;
      const importSource = imports.get(componentName);

      if (importSource) {
        result.usedComponents.push({
          name: componentName,
          importSource,
          line: opening.loc.start.line,
          column: opening.loc.start.column,
        });

        // Check if this import is from a known UI library
        const library = detectLibraryFromSource(importSource);
        if (library && !result.directLibrary) {
          result.directLibrary = library;
        }
      }
    }

    // Handle JSX member expressions like Modal.Header
    if (opening.name.type === "JSXMemberExpression") {
      let objectName: string | null = null;
      let current = opening.name.object;
      while (current.type === "JSXMemberExpression") {
        current = current.object;
      }
      if (current.type === "JSXIdentifier") {
        objectName = current.name;
      }

      if (objectName) {
        const importSource = imports.get(objectName);
        if (importSource) {
          const library = detectLibraryFromSource(importSource);
          if (library && !result.directLibrary) {
            result.directLibrary = library;
          }
        }
      }
    }

    // Extract className/class attributes
    for (const attr of opening.attributes) {
      if (
        attr.type === "JSXAttribute" &&
        attr.name.type === "JSXIdentifier" &&
        (attr.name.name === "className" || attr.name.name === "class")
      ) {
        if (
          attr.value?.type === "Literal" &&
          typeof attr.value.value === "string"
        ) {
          result.tailwindClasses.push(
            ...extractTailwindClasses(attr.value.value)
          );
        }
        if (attr.value?.type === "JSXExpressionContainer") {
          const expr = attr.value.expression;
          if (expr.type === "Literal" && typeof expr.value === "string") {
            result.tailwindClasses.push(...extractTailwindClasses(expr.value));
          }
          if (expr.type === "TemplateLiteral") {
            for (const quasi of expr.quasis) {
              result.tailwindClasses.push(
                ...extractTailwindClasses(quasi.value.raw)
              );
            }
          }
        }
      }

      // Extract inline styles
      if (
        attr.type === "JSXAttribute" &&
        attr.name.type === "JSXIdentifier" &&
        attr.name.name === "style"
      ) {
        if (attr.value?.type === "JSXExpressionContainer") {
          // Just note that there's an inline style - we don't parse the object
          result.inlineStyles.push("[inline style]");
        }
      }
    }
  }

  // Handle cn(), clsx(), twMerge() calls
  if (
    node.type === "CallExpression" &&
    node.callee.type === "Identifier" &&
    ["cn", "clsx", "classnames", "twMerge"].includes(node.callee.name)
  ) {
    for (const arg of node.arguments) {
      if (arg.type === "Literal" && typeof arg.value === "string") {
        result.tailwindClasses.push(...extractTailwindClasses(arg.value));
      }
      if (arg.type === "TemplateLiteral") {
        for (const quasi of arg.quasis) {
          result.tailwindClasses.push(
            ...extractTailwindClasses(quasi.value.raw)
          );
        }
      }
    }
  }

  // Recursively traverse all properties
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;

    const child = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object") {
          traverseForStyling(item as TSESTree.Node, imports, result);
        }
      }
    } else if (child && typeof child === "object") {
      traverseForStyling(child as TSESTree.Node, imports, result);
    }
  }
}

/**
 * Parse a component's body and extract styling information
 */
export function parseComponentBody(
  filePath: string,
  componentName: string
): ComponentStyleInfo | null {
  const ast = parseFile(filePath);
  if (!ast) return null;

  const imports = extractImports(ast);
  const componentDef = findComponentDefinition(ast, componentName);

  if (!componentDef) {
    return null;
  }

  const result: ComponentStyleInfo = {
    tailwindClasses: [],
    inlineStyles: [],
    usedComponents: [],
    directLibrary: null,
  };

  // Traverse the component body
  if (componentDef.body) {
    traverseForStyling(componentDef.body, imports, result);
  }

  // Deduplicate classes
  result.tailwindClasses = [...new Set(result.tailwindClasses)];

  return result;
}

/**
 * Analyze a file and extract all component usages with their libraries
 * (used for the entry file analysis)
 */
export function analyzeFileImports(
  filePath: string
): Map<string, { importSource: string; library: LibraryName | null }> {
  const ast = parseFile(filePath);
  if (!ast) return new Map();

  const result = new Map<
    string,
    { importSource: string; library: LibraryName | null }
  >();
  const imports = extractImports(ast);

  for (const [name, source] of imports) {
    result.set(name, {
      importSource: source,
      library: detectLibraryFromSource(source),
    });
  }

  return result;
}

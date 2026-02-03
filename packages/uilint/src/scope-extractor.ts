/**
 * Scope Extractor Utility
 *
 * Extracts enclosing context (function name, component name, etc.) from AST
 * based on line/column position. Used to enrich ESLint issues with context
 * about where they occur in the code.
 */

import { createRequire } from "module";

/**
 * Scope information extracted from AST
 */
export interface ScopeInfo {
  /** Name of the enclosing scope: "handleClick", "Button", "useEffect", etc. */
  enclosingScope: string | null;
  /** Type of scope */
  scopeType:
    | "function"
    | "arrow-function"
    | "component"
    | "hook"
    | "method"
    | "class"
    | "module";
  /** For nested functions, the parent scope name */
  parentScope?: string;
  /** If inside JSX, the element type (e.g., "div", "Button") */
  jsxElementType?: string;
}

/**
 * Options for scope extraction
 */
export interface ScopeExtractorOptions {
  /** Parser to use (defaults to "typescript" which handles both TS and JS) */
  parser?: "babel" | "typescript";
}

/**
 * Internal representation of a scope boundary in the AST
 */
interface ScopeBoundary {
  name: string | null;
  type: ScopeInfo["scopeType"];
  start: number;
  end: number;
  line: number;
  column: number;
}

/**
 * Check if a name represents a React component (PascalCase)
 */
function isComponentName(name: string | null): boolean {
  if (!name) return false;
  // Component names start with uppercase letter
  return /^[A-Z]/.test(name);
}

/**
 * Check if a name represents a React hook (starts with "use")
 */
function isHookName(name: string | null): boolean {
  if (!name) return false;
  return /^use[A-Z]/.test(name);
}

/**
 * Check if a function body contains JSX return
 */
function containsJsxReturn(node: any): boolean {
  if (!node) return false;

  // Direct JSX return
  if (node.type === "JSXElement" || node.type === "JSXFragment") {
    return true;
  }

  // Check block body for return statements with JSX
  if (node.type === "BlockStatement" && node.body) {
    for (const stmt of node.body) {
      if (stmt.type === "ReturnStatement" && stmt.argument) {
        if (
          stmt.argument.type === "JSXElement" ||
          stmt.argument.type === "JSXFragment"
        ) {
          return true;
        }
        // Check for conditional expressions returning JSX
        if (stmt.argument.type === "ConditionalExpression") {
          if (
            stmt.argument.consequent?.type === "JSXElement" ||
            stmt.argument.consequent?.type === "JSXFragment" ||
            stmt.argument.alternate?.type === "JSXElement" ||
            stmt.argument.alternate?.type === "JSXFragment"
          ) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Determine the scope type for a function based on its characteristics
 */
function determineScopeType(
  name: string | null,
  isArrow: boolean,
  isMethod: boolean,
  returnsJsx: boolean
): ScopeInfo["scopeType"] {
  if (isMethod) return "method";
  if (isHookName(name)) return "hook";
  if (isComponentName(name) && returnsJsx) return "component";
  if (isArrow) return "arrow-function";
  return "function";
}

/**
 * Get the name from various identifier patterns
 */
function getIdentifierName(node: any): string | null {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "PrivateIdentifier") return `#${node.name}`;
  return null;
}

/**
 * Extract the JSX element type from a JSXElement node
 */
function getJsxElementType(node: any): string | null {
  if (!node || node.type !== "JSXElement") return null;
  const opening = node.openingElement;
  if (!opening || !opening.name) return null;

  const name = opening.name;
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") {
    // Handle Foo.Bar
    const parts: string[] = [];
    let current = name;
    while (current) {
      if (current.type === "JSXMemberExpression") {
        parts.unshift(current.property.name);
        current = current.object;
      } else if (current.type === "JSXIdentifier") {
        parts.unshift(current.name);
        break;
      } else {
        break;
      }
    }
    return parts.join(".");
  }
  return null;
}

/**
 * Convert line (1-indexed) and column (0-indexed) to character offset
 */
function lineColToOffset(code: string, line: number, column: number): number {
  const lines = code.split("\n");
  let offset = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }
  return offset + column;
}

/**
 * Walk AST and collect all scope boundaries
 */
function collectScopeBoundaries(ast: any): ScopeBoundary[] {
  const boundaries: ScopeBoundary[] = [];

  function walk(node: any, parentName: string | null = null): void {
    if (!node || typeof node !== "object") return;

    const range = node.range as [number, number] | undefined;
    const loc = node.loc;

    // Function Declaration: function foo() {}
    if (node.type === "FunctionDeclaration") {
      const name = getIdentifierName(node.id);
      const returnsJsx = containsJsxReturn(node.body);
      const scopeType = determineScopeType(name, false, false, returnsJsx);

      if (range && loc) {
        boundaries.push({
          name,
          type: scopeType,
          start: range[0],
          end: range[1],
          line: loc.start.line,
          column: loc.start.column,
        });
      }

      // Walk body with this function as parent
      walk(node.body, name);
      return;
    }

    // Arrow Function Expression: const foo = () => {}
    if (node.type === "ArrowFunctionExpression") {
      // Try to get name from parent VariableDeclarator
      let name: string | null = null;
      const returnsJsx = containsJsxReturn(node.body);

      if (range && loc) {
        const scopeType = determineScopeType(name, true, false, returnsJsx);
        boundaries.push({
          name,
          type: scopeType,
          start: range[0],
          end: range[1],
          line: loc.start.line,
          column: loc.start.column,
        });
      }

      walk(node.body, name || parentName);
      return;
    }

    // Function Expression: const foo = function() {}
    if (node.type === "FunctionExpression") {
      const name = getIdentifierName(node.id);
      const returnsJsx = containsJsxReturn(node.body);
      const scopeType = determineScopeType(name, false, false, returnsJsx);

      if (range && loc) {
        boundaries.push({
          name,
          type: scopeType,
          start: range[0],
          end: range[1],
          line: loc.start.line,
          column: loc.start.column,
        });
      }

      walk(node.body, name || parentName);
      return;
    }

    // Variable Declarator with function: const foo = () => {} or const foo = function() {}
    if (node.type === "VariableDeclarator" && node.init) {
      const varName = getIdentifierName(node.id);
      const init = node.init;

      if (
        init.type === "ArrowFunctionExpression" ||
        init.type === "FunctionExpression"
      ) {
        const returnsJsx = containsJsxReturn(init.body);
        const isArrow = init.type === "ArrowFunctionExpression";
        const scopeType = determineScopeType(varName, isArrow, false, returnsJsx);

        const initRange = init.range as [number, number] | undefined;
        const initLoc = init.loc;

        if (initRange && initLoc) {
          // Update any existing boundary for this arrow/function to have the name
          const existing = boundaries.find(
            (b) => b.start === initRange[0] && b.end === initRange[1]
          );
          if (existing) {
            existing.name = varName;
            existing.type = scopeType;
          } else {
            boundaries.push({
              name: varName,
              type: scopeType,
              start: initRange[0],
              end: initRange[1],
              line: initLoc.start.line,
              column: initLoc.start.column,
            });
          }
        }

        walk(init.body, varName);
        return;
      }
    }

    // Method Definition: class methods and object methods
    if (node.type === "MethodDefinition" || node.type === "Property") {
      const isMethod =
        node.type === "MethodDefinition" ||
        (node.type === "Property" && node.method);

      if (isMethod && node.value) {
        const name = getIdentifierName(node.key);
        const returnsJsx = containsJsxReturn(node.value.body);
        const scopeType = determineScopeType(name, false, true, returnsJsx);

        if (range && loc) {
          boundaries.push({
            name,
            type: scopeType,
            start: range[0],
            end: range[1],
            line: loc.start.line,
            column: loc.start.column,
          });
        }

        walk(node.value.body, name);
        return;
      }
    }

    // Class Declaration: class Foo {}
    if (node.type === "ClassDeclaration" || node.type === "ClassExpression") {
      const name = getIdentifierName(node.id);

      if (range && loc) {
        boundaries.push({
          name,
          type: "class",
          start: range[0],
          end: range[1],
          line: loc.start.line,
          column: loc.start.column,
        });
      }

      // Walk class body
      if (node.body) {
        walk(node.body, name);
      }
      return;
    }

    // Export default function/class
    if (node.type === "ExportDefaultDeclaration" && node.declaration) {
      const decl = node.declaration;

      if (
        decl.type === "FunctionDeclaration" ||
        decl.type === "ClassDeclaration"
      ) {
        // The declaration itself will be visited
        walk(decl, parentName);
        return;
      }

      // Anonymous export default function
      if (
        decl.type === "FunctionExpression" ||
        decl.type === "ArrowFunctionExpression"
      ) {
        const name = getIdentifierName(decl.id) || "default";
        const returnsJsx = containsJsxReturn(decl.body);
        const isArrow = decl.type === "ArrowFunctionExpression";
        const scopeType = determineScopeType(name, isArrow, false, returnsJsx);

        const declRange = decl.range as [number, number] | undefined;
        const declLoc = decl.loc;

        if (declRange && declLoc) {
          boundaries.push({
            name,
            type: scopeType,
            start: declRange[0],
            end: declRange[1],
            line: declLoc.start.line,
            column: declLoc.start.column,
          });
        }

        walk(decl.body, name);
        return;
      }
    }

    // Walk all children
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "range" || key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          walk(item, parentName);
        }
      } else if (child && typeof child === "object" && child.type) {
        walk(child, parentName);
      }
    }
  }

  walk(ast);
  return boundaries;
}

/**
 * Find the innermost JSX element containing a position
 */
function findContainingJsxElement(ast: any, offset: number): string | null {
  let innermost: { type: string; size: number } | null = null;

  function walk(node: any): void {
    if (!node || typeof node !== "object") return;

    if (node.type === "JSXElement") {
      const range = node.range as [number, number] | undefined;
      if (range && range[0] <= offset && offset < range[1]) {
        const size = range[1] - range[0];
        if (!innermost || size < innermost.size) {
          const elementType = getJsxElementType(node);
          if (elementType) {
            innermost = { type: elementType, size };
          }
        }
      }
    }

    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "range" || key === "parent") continue;
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) walk(item);
      } else if (child && typeof child === "object" && child.type) {
        walk(child);
      }
    }
  }

  walk(ast);
  return innermost?.type ?? null;
}

/**
 * Find the enclosing scope for a given line/column position in source code.
 *
 * @param source - The source code to parse
 * @param line - Line number (1-indexed)
 * @param column - Column number (0-indexed)
 * @param options - Parser options
 * @returns Scope information or null if at module level
 */
export function findEnclosingScope(
  source: string,
  line: number,
  column: number,
  options?: ScopeExtractorOptions
): ScopeInfo | null {
  // Use typescript-estree parser (handles both TS and JS/JSX)
  const localRequire = createRequire(import.meta.url);
  const { parse } = localRequire("@typescript-eslint/typescript-estree") as {
    parse: (src: string, options: Record<string, unknown>) => any;
  };

  let ast: any;
  try {
    ast = parse(source, {
      loc: true,
      range: true,
      jsx: true,
      comment: false,
      errorOnUnknownASTType: false,
    });
  } catch {
    return null;
  }

  const offset = lineColToOffset(source, line, column);
  const boundaries = collectScopeBoundaries(ast);

  // Find all scopes containing this offset, sorted by size (smallest first)
  const containingScopes = boundaries
    .filter((b) => b.start <= offset && offset < b.end)
    .sort((a, b) => a.end - a.start - (b.end - b.start));

  // Find JSX element context
  const jsxElementType = findContainingJsxElement(ast, offset);

  // If no containing scope, return module scope
  if (containingScopes.length === 0) {
    return {
      enclosingScope: null,
      scopeType: "module",
      jsxElementType: jsxElementType ?? undefined,
    };
  }

  const innermost = containingScopes[0];
  const parent = containingScopes.length > 1 ? containingScopes[1] : null;

  // Handle anonymous functions
  const scopeName = innermost.name || "anonymous";

  return {
    enclosingScope: scopeName,
    scopeType: innermost.type,
    parentScope: parent?.name ?? undefined,
    jsxElementType: jsxElementType ?? undefined,
  };
}

/**
 * Batch extract scope information for multiple positions in the same source.
 * More efficient than calling findEnclosingScope multiple times.
 *
 * @param source - The source code to parse
 * @param positions - Array of {line, column} positions
 * @param options - Parser options
 * @returns Array of scope information (null for errors)
 */
export function findEnclosingScopeBatch(
  source: string,
  positions: Array<{ line: number; column: number }>,
  options?: ScopeExtractorOptions
): Array<ScopeInfo | null> {
  // Use typescript-estree parser
  const localRequire = createRequire(import.meta.url);
  const { parse } = localRequire("@typescript-eslint/typescript-estree") as {
    parse: (src: string, options: Record<string, unknown>) => any;
  };

  let ast: any;
  try {
    ast = parse(source, {
      loc: true,
      range: true,
      jsx: true,
      comment: false,
      errorOnUnknownASTType: false,
    });
  } catch {
    return positions.map(() => null);
  }

  const boundaries = collectScopeBoundaries(ast);

  return positions.map(({ line, column }) => {
    const offset = lineColToOffset(source, line, column);

    // Find all scopes containing this offset, sorted by size (smallest first)
    const containingScopes = boundaries
      .filter((b) => b.start <= offset && offset < b.end)
      .sort((a, b) => a.end - a.start - (b.end - b.start));

    // Find JSX element context
    const jsxElementType = findContainingJsxElement(ast, offset);

    // If no containing scope, return module scope
    if (containingScopes.length === 0) {
      return {
        enclosingScope: null,
        scopeType: "module" as const,
        jsxElementType: jsxElementType ?? undefined,
      };
    }

    const innermost = containingScopes[0];
    const parent = containingScopes.length > 1 ? containingScopes[1] : null;

    // Handle anonymous functions
    const scopeName = innermost.name || "anonymous";

    return {
      enclosingScope: scopeName,
      scopeType: innermost.type,
      parentScope: parent?.name ?? undefined,
      jsxElementType: jsxElementType ?? undefined,
    };
  });
}

/**
 * JSX Source Location Transform
 *
 * Parses JSX/TSX files and injects data-loc attributes to track source locations.
 * Inspired by babel-plugin-jsx-source-loc.
 */

import { parse, ParserOptions } from "@babel/parser";
import MagicString from "magic-string";

/**
 * Valid file extensions for processing
 */
const VALID_EXTENSIONS = new Set([".jsx", ".tsx"]);

/**
 * Default parser options for Babel
 */
const DEFAULT_PARSER_OPTIONS: ParserOptions = {
  sourceType: "module",
  plugins: [
    "jsx",
    "typescript",
    "decorators-legacy",
    "classProperties",
    "classPrivateProperties",
    "classPrivateMethods",
    "exportDefaultFrom",
    "exportNamespaceFrom",
    "asyncGenerators",
    "functionBind",
    "functionSent",
    "dynamicImport",
    "numericSeparator",
    "optionalChaining",
    "importMeta",
    "bigInt",
    "optionalCatchBinding",
    "throwExpressions",
    "nullishCoalescingOperator",
    "topLevelAwait",
  ],
  errorRecovery: true,
};

/**
 * Elements to skip (React internals, fragments, etc.)
 */
const SKIP_ELEMENTS = new Set([
  "Fragment",
  "React.Fragment",
  "Suspense",
  "React.Suspense",
  "StrictMode",
  "React.StrictMode",
  "Profiler",
  "React.Profiler",
]);

/**
 * Check if a file should be processed based on extension
 */
export function shouldProcessFile(filePath: string): boolean {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  return VALID_EXTENSIONS.has(ext);
}

/**
 * Extract element name from JSXOpeningElement node
 * Handles Identifier, MemberExpression, and JSXNamespacedName
 */
export function getElementName(node: any): string | null {
  if (!node || !node.name) return null;

  const name = node.name;

  // Simple identifier: <div>, <MyComponent>
  if (name.type === "JSXIdentifier") {
    return name.name;
  }

  // Member expression: <Foo.Bar>, <React.Fragment>
  if (name.type === "JSXMemberExpression") {
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

  // Namespaced name: <xml:tag>
  if (name.type === "JSXNamespacedName") {
    return `${name.namespace.name}:${name.name.name}`;
  }

  return null;
}

/**
 * Check if an element should be skipped
 */
export function shouldSkipElement(elementName: string | null): boolean {
  if (!elementName) return true;
  return SKIP_ELEMENTS.has(elementName);
}

/**
 * Check if an element already has a data-loc attribute
 */
function hasDataLocAttribute(node: any): boolean {
  if (!node.attributes) return false;
  return node.attributes.some(
    (attr: any) =>
      attr.type === "JSXAttribute" &&
      attr.name?.type === "JSXIdentifier" &&
      attr.name.name === "data-loc"
  );
}

/**
 * Find the correct insertion point for the data-loc attribute
 * This handles TypeScript generics: <Component<T> ... />
 */
export function findInsertionPoint(node: any, source: string): number {
  // Start after the element name
  let insertPos = node.name.end;

  // Check for TypeScript type parameters
  if (node.typeParameters) {
    insertPos = node.typeParameters.end;
  }

  // Handle any edge cases where we need to skip whitespace
  // to insert before existing attributes
  if (node.attributes && node.attributes.length > 0) {
    // Insert before the first attribute
    const firstAttr = node.attributes[0];
    // Find a good position - after name/generics but before first attr
    const nameEnd = node.typeParameters ? node.typeParameters.end : node.name.end;

    // Make sure we insert after any whitespace following the name
    let pos = nameEnd;
    while (pos < firstAttr.start && /\s/.test(source[pos])) {
      pos++;
    }
    insertPos = pos;
  }

  return insertPos;
}

/**
 * Normalize file path
 * Keeps the full absolute path for source fetching, but normalizes separators
 */
function normalizeFilePath(filePath: string): string {
  // Normalize path separators (Windows -> Unix style)
  return filePath.replace(/\\/g, "/");
}

/**
 * Transform result with code and source map
 */
export interface TransformResult {
  code: string;
  map: ReturnType<MagicString["generateMap"]>;
}

/**
 * Transform options
 */
export interface TransformOptions {
  parserOptions?: ParserOptions;
}

/**
 * Transform JSX code to add data-loc attributes
 */
export function transformJsxCode(
  source: string,
  filePath: string,
  options: TransformOptions = {}
): TransformResult | null {
  const parserOptions: ParserOptions = {
    ...DEFAULT_PARSER_OPTIONS,
    ...options.parserOptions,
  };

  let ast: any;
  try {
    ast = parse(source, parserOptions);
  } catch (error) {
    console.error(`[jsx-loc] Failed to parse ${filePath}:`, error);
    return null;
  }

  const magicString = new MagicString(source);
  const normalizedPath = normalizeFilePath(filePath);
  let hasChanges = false;

  /**
   * Recursively walk the AST and process JSX elements
   */
  function walk(node: any): void {
    if (!node || typeof node !== "object") return;

    // Process JSXOpeningElement nodes
    if (node.type === "JSXOpeningElement") {
      const elementName = getElementName(node);

      // Skip fragments, providers, and elements that already have data-loc
      if (!shouldSkipElement(elementName) && !hasDataLocAttribute(node)) {
        const loc = node.loc;
        if (loc && loc.start) {
          const line = loc.start.line;
          const column = loc.start.column;
          const locValue = `${normalizedPath}:${line}:${column}`;

          // Find insertion point
          const insertPos = findInsertionPoint(node, source);

          // Insert the data-loc attribute
          magicString.appendLeft(insertPos, ` data-loc="${locValue}"`);
          hasChanges = true;
        }
      }
    }

    // Walk child nodes
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          walk(item);
        }
      } else if (child && typeof child === "object" && child.type) {
        walk(child);
      }
    }
  }

  // Start walking from program body
  if (ast.program && ast.program.body) {
    for (const node of ast.program.body) {
      walk(node);
    }
  }

  if (!hasChanges) {
    return null;
  }

  return {
    code: magicString.toString(),
    map: magicString.generateMap({
      source: filePath,
      file: filePath,
      includeContent: true,
    }),
  };
}

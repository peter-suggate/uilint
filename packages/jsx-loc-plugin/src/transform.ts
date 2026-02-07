/**
 * JSX Source Location Transform
 *
 * Parses JSX/TSX files and injects data-loc attributes to track source locations.
 * Inspired by babel-plugin-jsx-source-loc.
 */

import { parse, ParserOptions } from "@babel/parser";
import MagicString from "magic-string";
import { relative, resolve } from "path";

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
export function getElementName(node: Record<string, unknown>): string | null {
  if (!node || !node.name) return null;

  const name = node.name as Record<string, unknown>;

  // Simple identifier: <div>, <MyComponent>
  if (name.type === "JSXIdentifier") {
    return name.name as string;
  }

  // Member expression: <Foo.Bar>, <React.Fragment>
  if (name.type === "JSXMemberExpression") {
    const parts: string[] = [];
    let current = name as Record<string, unknown> | null;
    while (current) {
      if (current.type === "JSXMemberExpression") {
        parts.unshift((current.property as Record<string, unknown>).name as string);
        current = current.object as Record<string, unknown>;
      } else if (current.type === "JSXIdentifier") {
        parts.unshift(current.name as string);
        break;
      } else {
        break;
      }
    }
    return parts.join(".");
  }

  // Namespaced name: <xml:tag>
  if (name.type === "JSXNamespacedName") {
    return `${(name.namespace as Record<string, unknown>).name}:${(name.name as Record<string, unknown>).name}`;
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
 * The data attribute name used to mark elements with source location
 */
const DATA_ATTR = "data-loc";

/**
 * Check if an element already has a data-loc attribute
 */
function hasDataAttribute(node: Record<string, unknown>): boolean {
  if (!node.attributes) return false;
  return (node.attributes as Record<string, unknown>[]).some(
    (attr: Record<string, unknown>) =>
      attr.type === "JSXAttribute" &&
      (attr.name as Record<string, unknown>)?.type === "JSXIdentifier" &&
      (attr.name as Record<string, unknown>).name === DATA_ATTR
  );
}

/**
 * Find the correct insertion point for the data-loc attribute
 * This handles TypeScript generics: <Component<T> ... />
 */
export function findInsertionPoint(node: Record<string, unknown>, source: string): number {
  // Start after the element name
  let insertPos = (node.name as Record<string, unknown>).end as number;

  // Check for TypeScript type parameters
  if (node.typeParameters) {
    insertPos = (node.typeParameters as Record<string, unknown>).end as number;
  }

  // Handle any edge cases where we need to skip whitespace
  // to insert before existing attributes
  const attributes = node.attributes as Record<string, unknown>[] | undefined;
  if (attributes && attributes.length > 0) {
    // Insert before the first attribute
    const firstAttr = attributes[0];
    // Find a good position - after name/generics but before first attr
    const nameEnd = node.typeParameters
      ? (node.typeParameters as Record<string, unknown>).end as number
      : (node.name as Record<string, unknown>).end as number;

    // Make sure we insert after any whitespace following the name
    let pos = nameEnd;
    while (pos < (firstAttr.start as number) && /\s/.test(source[pos])) {
      pos++;
    }
    insertPos = pos;
  }

  return insertPos;
}

/**
 * Normalize file path
 * Prefer a stable, project-relative path when possible (more portable across machines),
 * otherwise keep the absolute path, but normalize separators.
 */
function normalizeFilePath(filePath: string): string {
  const abs = resolve(filePath).replace(/\\/g, "/");
  const cwd = resolve(process.cwd()).replace(/\\/g, "/");

  // If the file is inside the current working directory (Next app root),
  // use a relative path to avoid machine-specific absolute prefixes.
  if (abs === cwd || abs.startsWith(cwd + "/")) {
    return relative(cwd, abs).replace(/\\/g, "/");
  }

  // Fallback: absolute path (still normalized)
  return abs;
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

  let ast: ReturnType<typeof parse>;
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
  function walk(node: Record<string, unknown>): void {
    if (!node || typeof node !== "object") return;

    // Process JSXOpeningElement nodes
    if (node.type === "JSXOpeningElement") {
      const elementName = getElementName(node);

      // Skip fragments, providers, and elements that already have data-loc
      if (!shouldSkipElement(elementName) && !hasDataAttribute(node)) {
        const loc = node.loc as { start: { line: number; column: number } } | undefined;
        if (loc && loc.start) {
          const line = loc.start.line;
          const column = loc.start.column;
          const locValue = `${normalizedPath}:${line}:${column}`;

          // Find insertion point
          const insertPos = findInsertionPoint(node, source);

          // Insert the data-loc attribute
          magicString.appendLeft(insertPos, ` ${DATA_ATTR}="${locValue}"`);
          hasChanges = true;
        }
      }
    }

    // Walk child nodes
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          walk(item as Record<string, unknown>);
        }
      } else if (child && typeof child === "object" && (child as Record<string, unknown>).type) {
        walk(child as Record<string, unknown>);
      }
    }
  }

  // Start walking from program body
  if (ast.program && ast.program.body) {
    for (const node of ast.program.body) {
      walk(node as unknown as Record<string, unknown>);
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

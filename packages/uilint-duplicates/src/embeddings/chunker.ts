/**
 * Code chunker - extracts meaningful code units from TypeScript/TSX files
 *
 * Uses @typescript-eslint/typescript-estree for parsing.
 * Supports splitting large components into smaller, embeddable chunks.
 */

import { parse, TSESTree, AST_NODE_TYPES } from "@typescript-eslint/typescript-estree";
import type { CodeChunk, ChunkKind, ChunkMetadata, ChunkingOptions } from "./types.js";

const DEFAULT_MAX_LINES = 100;
const MIN_SECTION_LINES = 3;

/**
 * Hash function for generating chunk IDs
 * Simple djb2 hash - consistent with existing codebase pattern
 */
function hashChunk(content: string, filePath: string, startLine: number): string {
  let hash = 5381;
  const input = `${filePath}:${startLine}:${content}`;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Parse a file and extract code chunks
 */
export function chunkFile(
  filePath: string,
  content: string,
  options: ChunkingOptions = {}
): CodeChunk[] {
  const {
    minLines = 3,
    maxLines = DEFAULT_MAX_LINES,
    includeAnonymous = false,
    kinds,
    splitStrategy = "jsx-children",
  } = options;

  // Parse the file
  let ast: TSESTree.Program;
  try {
    ast = parse(content, {
      jsx: true,
      loc: true,
      range: true,
      tokens: false,
      comment: false,
    });
  } catch (error) {
    // Return empty array if parsing fails
    console.warn(`Failed to parse ${filePath}:`, error);
    return [];
  }

  const chunks: CodeChunk[] = [];
  const lines = content.split("\n");

  // Track exports for metadata
  const exportedNames = new Set<string>();
  let defaultExportName: string | null = null;

  // First pass: collect exports
  for (const node of ast.body) {
    if (node.type === AST_NODE_TYPES.ExportNamedDeclaration) {
      if (node.declaration) {
        const names = getDeclarationNames(node.declaration);
        names.forEach((name) => exportedNames.add(name));
      }
      if (node.specifiers) {
        node.specifiers.forEach((spec) => {
          if (spec.type === AST_NODE_TYPES.ExportSpecifier) {
            exportedNames.add(
              spec.exported.type === AST_NODE_TYPES.Identifier
                ? spec.exported.name
                : spec.exported.value
            );
          }
        });
      }
    } else if (node.type === AST_NODE_TYPES.ExportDefaultDeclaration) {
      if (node.declaration.type === AST_NODE_TYPES.Identifier) {
        defaultExportName = node.declaration.name;
      } else if (
        node.declaration.type === AST_NODE_TYPES.FunctionDeclaration &&
        node.declaration.id
      ) {
        defaultExportName = node.declaration.id.name;
      }
    }
  }

  // Second pass: extract chunks
  function visit(node: TSESTree.Node) {
    // Check function declarations
    if (node.type === AST_NODE_TYPES.FunctionDeclaration && node.id) {
      const chunk = processFunction(
        node,
        node.id.name,
        filePath,
        content,
        lines,
        exportedNames,
        defaultExportName
      );
      if (chunk && shouldIncludeChunk(chunk, minLines, includeAnonymous, kinds)) {
        // Check if chunk needs splitting
        const lineCount = chunk.endLine - chunk.startLine + 1;
        if (lineCount > maxLines && splitStrategy !== "none") {
          const splitChunks = splitLargeChunk(node, chunk, content, lines, maxLines, splitStrategy);
          chunks.push(...splitChunks.filter(c => shouldIncludeChunk(c, minLines, includeAnonymous, kinds)));
        } else {
          chunks.push(chunk);
        }
      }
    }

    // Check variable declarations with arrow functions
    if (node.type === AST_NODE_TYPES.VariableDeclaration) {
      for (const decl of node.declarations) {
        if (
          decl.id.type === AST_NODE_TYPES.Identifier &&
          decl.init &&
          (decl.init.type === AST_NODE_TYPES.ArrowFunctionExpression ||
            decl.init.type === AST_NODE_TYPES.FunctionExpression)
        ) {
          const chunk = processFunction(
            decl.init,
            decl.id.name,
            filePath,
            content,
            lines,
            exportedNames,
            defaultExportName,
            node // Use the variable declaration for location
          );
          if (chunk && shouldIncludeChunk(chunk, minLines, includeAnonymous, kinds)) {
            // Check if chunk needs splitting
            const lineCount = chunk.endLine - chunk.startLine + 1;
            if (lineCount > maxLines && splitStrategy !== "none") {
              const splitChunks = splitLargeChunk(decl.init, chunk, content, lines, maxLines, splitStrategy);
              chunks.push(...splitChunks.filter(c => shouldIncludeChunk(c, minLines, includeAnonymous, kinds)));
            } else {
              chunks.push(chunk);
            }
          }
        }
      }
    }

    // Recursively visit children
    for (const key of Object.keys(node)) {
      if (key === "parent" || key === "loc" || key === "range") continue;

      const child = (node as unknown as Record<string, unknown>)[key];
      if (child && typeof child === "object") {
        if (Array.isArray(child)) {
          child.forEach((c) => {
            if (c && typeof c === "object" && "type" in c) {
              visit(c as TSESTree.Node);
            }
          });
        } else if ("type" in child) {
          visit(child as TSESTree.Node);
        }
      }
    }
  }

  visit(ast);
  return chunks;
}

function processFunction(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionExpression,
  name: string,
  filePath: string,
  content: string,
  lines: string[],
  exportedNames: Set<string>,
  defaultExportName: string | null,
  locationNode?: TSESTree.Node
): CodeChunk | null {
  const loc = (locationNode || node).loc;
  if (!loc) return null;

  const startLine = loc.start.line;
  const endLine = loc.end.line;
  const startColumn = loc.start.column;
  const endColumn = loc.end.column;

  // Extract the chunk content
  const chunkContent = lines.slice(startLine - 1, endLine).join("\n");

  // Determine the kind
  const kind = classifyFunction(name, node);

  // Extract metadata
  const metadata = extractMetadata(node, name, exportedNames, defaultExportName);

  return {
    id: hashChunk(chunkContent, filePath, startLine),
    filePath,
    startLine,
    endLine,
    startColumn,
    endColumn,
    kind,
    name,
    content: chunkContent,
    metadata,
  };
}

function classifyFunction(
  name: string,
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionExpression
): ChunkKind {
  // Check for hook (useXxx pattern)
  if (/^use[A-Z]/.test(name)) {
    return "hook";
  }

  // Check for component (PascalCase + returns JSX)
  if (/^[A-Z]/.test(name) && containsJSX(node)) {
    return "component";
  }

  // Check for JSX fragment (returns JSX but not PascalCase)
  if (containsJSX(node)) {
    return "jsx-fragment";
  }

  return "function";
}

function containsJSX(node: TSESTree.Node): boolean {
  let found = false;

  function search(n: TSESTree.Node) {
    if (found) return;
    if (n.type === AST_NODE_TYPES.JSXElement || n.type === AST_NODE_TYPES.JSXFragment) {
      found = true;
      return;
    }
    for (const key of Object.keys(n)) {
      if (key === "parent" || key === "loc" || key === "range") continue;

      const child = (n as unknown as Record<string, unknown>)[key];
      if (child && typeof child === "object") {
        if (Array.isArray(child)) {
          child.forEach((c) => {
            if (c && typeof c === "object" && "type" in c) {
              search(c as TSESTree.Node);
            }
          });
        } else if ("type" in child) {
          search(child as TSESTree.Node);
        }
      }
    }
  }

  search(node);
  return found;
}

function extractMetadata(
  node:
    | TSESTree.FunctionDeclaration
    | TSESTree.ArrowFunctionExpression
    | TSESTree.FunctionExpression,
  name: string,
  exportedNames: Set<string>,
  defaultExportName: string | null
): ChunkMetadata {
  const metadata: ChunkMetadata = {
    isExported: exportedNames.has(name) || defaultExportName === name,
    isDefaultExport: defaultExportName === name,
  };

  // Extract props from parameters
  const params = node.params;
  if (params.length > 0) {
    const firstParam = params[0];
    const props = extractPropsFromParam(firstParam);
    if (props.length > 0) {
      metadata.props = props;
    }
  }

  // Extract hooks and JSX elements
  const hooks: string[] = [];
  const jsxElements: string[] = [];

  function searchForHooksAndJSX(n: TSESTree.Node) {
    // Find hook calls
    if (
      n.type === AST_NODE_TYPES.CallExpression &&
      n.callee.type === AST_NODE_TYPES.Identifier &&
      /^use[A-Z]/.test(n.callee.name)
    ) {
      hooks.push(n.callee.name);
    }

    // Find JSX elements
    if (n.type === AST_NODE_TYPES.JSXOpeningElement) {
      if (n.name.type === AST_NODE_TYPES.JSXIdentifier) {
        jsxElements.push(n.name.name);
      } else if (n.name.type === AST_NODE_TYPES.JSXMemberExpression) {
        // Handle React.Fragment, etc.
        const parts: string[] = [];
        let current: TSESTree.JSXMemberExpression | TSESTree.JSXIdentifier = n.name;
        while (current.type === AST_NODE_TYPES.JSXMemberExpression) {
          if (current.property.type === AST_NODE_TYPES.JSXIdentifier) {
            parts.unshift(current.property.name);
          }
          current = current.object as TSESTree.JSXMemberExpression | TSESTree.JSXIdentifier;
        }
        if (current.type === AST_NODE_TYPES.JSXIdentifier) {
          parts.unshift(current.name);
        }
        jsxElements.push(parts.join("."));
      }
    }

    // Recurse
    for (const key of Object.keys(n)) {
      if (key === "parent" || key === "loc" || key === "range") continue;

      const child = (n as unknown as Record<string, unknown>)[key];
      if (child && typeof child === "object") {
        if (Array.isArray(child)) {
          child.forEach((c) => {
            if (c && typeof c === "object" && "type" in c) {
              searchForHooksAndJSX(c as TSESTree.Node);
            }
          });
        } else if ("type" in child) {
          searchForHooksAndJSX(child as TSESTree.Node);
        }
      }
    }
  }

  searchForHooksAndJSX(node);

  if (hooks.length > 0) {
    metadata.hooks = [...new Set(hooks)]; // Deduplicate
  }
  if (jsxElements.length > 0) {
    metadata.jsxElements = [...new Set(jsxElements)]; // Deduplicate
  }

  return metadata;
}

function extractPropsFromParam(param: TSESTree.Parameter): string[] {
  const props: string[] = [];

  if (param.type === AST_NODE_TYPES.ObjectPattern) {
    for (const prop of param.properties) {
      if (prop.type === AST_NODE_TYPES.Property && prop.key.type === AST_NODE_TYPES.Identifier) {
        props.push(prop.key.name);
      } else if (
        prop.type === AST_NODE_TYPES.RestElement &&
        prop.argument.type === AST_NODE_TYPES.Identifier
      ) {
        props.push(`...${prop.argument.name}`);
      }
    }
  } else if (param.type === AST_NODE_TYPES.Identifier) {
    props.push(param.name);
  }

  return props;
}

function getDeclarationNames(
  decl:
    | TSESTree.FunctionDeclaration
    | TSESTree.VariableDeclaration
    | TSESTree.ClassDeclaration
    | TSESTree.TSInterfaceDeclaration
    | TSESTree.TSTypeAliasDeclaration
    | TSESTree.TSEnumDeclaration
    | TSESTree.TSModuleDeclaration
    | TSESTree.TSDeclareFunction
    | TSESTree.TSImportEqualsDeclaration
): string[] {
  const names: string[] = [];

  if (decl.type === AST_NODE_TYPES.FunctionDeclaration && decl.id) {
    names.push(decl.id.name);
  } else if (decl.type === AST_NODE_TYPES.VariableDeclaration) {
    for (const d of decl.declarations) {
      if (d.id.type === AST_NODE_TYPES.Identifier) {
        names.push(d.id.name);
      }
    }
  } else if (decl.type === AST_NODE_TYPES.ClassDeclaration && decl.id) {
    names.push(decl.id.name);
  }

  return names;
}

function shouldIncludeChunk(
  chunk: CodeChunk,
  minLines: number,
  includeAnonymous: boolean,
  kinds?: ChunkKind[]
): boolean {
  const lineCount = chunk.endLine - chunk.startLine + 1;
  if (lineCount < minLines) {
    return false;
  }
  if (!includeAnonymous && chunk.name === null) {
    return false;
  }
  if (kinds && !kinds.includes(chunk.kind)) {
    return false;
  }
  return true;
}

/** Maximum characters for embedding input (safe limit for nomic-embed-text with 2048 token context) */
const DEFAULT_MAX_EMBEDDING_CHARS = 6000;

export interface EmbeddingInputOptions {
  /** Maximum characters for the embedding input (default: 6000) */
  maxChars?: number;
}

/**
 * Prepare chunk content for embedding by enriching with context
 */
export function prepareEmbeddingInput(
  chunk: CodeChunk,
  options: EmbeddingInputOptions = {}
): string {
  const { maxChars = DEFAULT_MAX_EMBEDDING_CHARS } = options;
  const parts: string[] = [];

  // Add structural context based on kind
  if (chunk.kind === "component") {
    parts.push(`React component: ${chunk.name || "anonymous"}`);
    if (chunk.metadata.props?.length) {
      parts.push(`Props: ${chunk.metadata.props.join(", ")}`);
    }
  } else if (chunk.kind === "component-summary") {
    parts.push(`React component summary: ${chunk.name || "anonymous"}`);
    if (chunk.metadata.props?.length) {
      parts.push(`Props: ${chunk.metadata.props.join(", ")}`);
    }
    parts.push("(Large component - see sections for JSX details)");
  } else if (chunk.kind === "jsx-section") {
    const parentName = chunk.name || "anonymous";
    const label = chunk.sectionLabel || `section-${chunk.sectionIndex}`;
    parts.push(`JSX section from ${parentName}: ${label}`);
  } else if (chunk.kind === "hook") {
    parts.push(`React hook: ${chunk.name || "anonymous"}`);
  } else if (chunk.kind === "function") {
    parts.push(`Function: ${chunk.name || "anonymous"}`);
  } else if (chunk.kind === "function-summary") {
    parts.push(`Function summary: ${chunk.name || "anonymous"}`);
    parts.push("(Large function - split into sections)");
  } else if (chunk.kind === "function-section") {
    const parentName = chunk.name || "anonymous";
    const label = chunk.sectionLabel || `section-${chunk.sectionIndex}`;
    parts.push(`Function section from ${parentName}: ${label}`);
  } else if (chunk.kind === "jsx-fragment") {
    parts.push(`JSX fragment: ${chunk.name || "anonymous"}`);
  }

  // Add the code
  parts.push(chunk.content);

  // Add JSX structure for components
  if (chunk.metadata.jsxElements?.length) {
    parts.push(`JSX elements: ${chunk.metadata.jsxElements.join(", ")}`);
  }

  // Add hooks used
  if (chunk.metadata.hooks?.length) {
    parts.push(`Hooks used: ${chunk.metadata.hooks.join(", ")}`);
  }

  let result = parts.join("\n\n");

  // Truncate if exceeds max chars (safety net for edge cases)
  if (result.length > maxChars) {
    result = result.slice(0, maxChars - 50) + "\n\n[... content truncated for embedding ...]";
  }

  return result;
}

// ============================================================================
// Large Component Splitting
// ============================================================================

/**
 * Split a large chunk into smaller chunks
 * For components, tries JSX-based splitting first, then falls back to line-based
 * For functions/hooks, uses line-based splitting
 */
function splitLargeChunk(
  node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
  originalChunk: CodeChunk,
  content: string,
  lines: string[],
  maxLines: number,
  strategy: "jsx-children" | "line-based"
): CodeChunk[] {
  // Only try JSX splitting for components
  if (strategy === "jsx-children" && originalChunk.kind === "component") {
    const jsxChunks = splitByJSXChildren(node, originalChunk, content, lines);
    if (jsxChunks.length > 0) {
      return jsxChunks;
    }
    // Fall back to line-based if no JSX children found
  }

  return splitByLines(originalChunk, lines, maxLines);
}

/**
 * Split a component by its top-level JSX children
 */
function splitByJSXChildren(
  node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
  originalChunk: CodeChunk,
  content: string,
  lines: string[]
): CodeChunk[] {
  // Find the return statement with JSX
  const returnStatement = findJSXReturnStatement(node);
  if (!returnStatement || !returnStatement.argument) {
    return [];
  }

  // Get the root JSX element
  const jsxRoot = getJSXRoot(returnStatement.argument);
  if (!jsxRoot) {
    return [];
  }

  // Get significant JSX children
  const children = getSignificantJSXChildren(jsxRoot);
  if (children.length < 2) {
    // Not worth splitting if there's only one child
    return [];
  }

  const chunks: CodeChunk[] = [];

  // Create a summary chunk (signature + hooks + state, without the full JSX)
  const summaryChunk = createSummaryChunk(node, originalChunk, returnStatement, lines);
  chunks.push(summaryChunk);

  // Create section chunks for each significant JSX child
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const sectionChunk = createJSXSectionChunk(
      originalChunk,
      child,
      lines,
      i,
      summaryChunk.id
    );
    if (sectionChunk) {
      chunks.push(sectionChunk);
    }
  }

  return chunks;
}

/**
 * Find the return statement containing JSX
 */
function findJSXReturnStatement(
  node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression
): TSESTree.ReturnStatement | null {
  // For arrow functions with expression body, create a synthetic return
  if (node.type === AST_NODE_TYPES.ArrowFunctionExpression && node.expression) {
    if (isJSXNode(node.body)) {
      return {
        type: AST_NODE_TYPES.ReturnStatement,
        argument: node.body as TSESTree.Expression,
        loc: node.body.loc,
        range: node.body.range,
        parent: node as unknown as TSESTree.Node,
      } as TSESTree.ReturnStatement;
    }
    return null;
  }

  // For function bodies, find the return statement
  const body = node.body;
  if (body.type !== AST_NODE_TYPES.BlockStatement) {
    return null;
  }

  // Look for return statements in the body (not nested in other blocks)
  for (const stmt of body.body) {
    if (stmt.type === AST_NODE_TYPES.ReturnStatement && stmt.argument && isJSXNode(stmt.argument)) {
      return stmt;
    }
  }

  return null;
}

/**
 * Check if a node is a JSX element or fragment
 */
function isJSXNode(node: TSESTree.Node): boolean {
  return (
    node.type === AST_NODE_TYPES.JSXElement ||
    node.type === AST_NODE_TYPES.JSXFragment
  );
}

/**
 * Get the root JSX element, unwrapping parentheses and fragments if needed
 */
function getJSXRoot(
  node: TSESTree.Expression
): TSESTree.JSXElement | TSESTree.JSXFragment | null {
  // Handle parenthesized expressions
  if (node.type === AST_NODE_TYPES.JSXElement) {
    return node;
  }
  if (node.type === AST_NODE_TYPES.JSXFragment) {
    return node;
  }
  return null;
}

/**
 * Get significant JSX children (skip whitespace-only text nodes)
 */
function getSignificantJSXChildren(
  jsxRoot: TSESTree.JSXElement | TSESTree.JSXFragment
): TSESTree.JSXChild[] {
  const children: TSESTree.JSXChild[] = [];

  for (const child of jsxRoot.children) {
    // Skip JSXText that's just whitespace
    if (child.type === AST_NODE_TYPES.JSXText) {
      if (child.value.trim() === "") {
        continue;
      }
    }

    // Include JSX elements, expressions, and non-empty text
    if (
      child.type === AST_NODE_TYPES.JSXElement ||
      child.type === AST_NODE_TYPES.JSXFragment ||
      child.type === AST_NODE_TYPES.JSXExpressionContainer
    ) {
      children.push(child);
    }
  }

  return children;
}

/**
 * Create a summary chunk containing function signature, hooks, and state
 */
function createSummaryChunk(
  node: TSESTree.FunctionDeclaration | TSESTree.ArrowFunctionExpression | TSESTree.FunctionExpression,
  originalChunk: CodeChunk,
  returnStatement: TSESTree.ReturnStatement,
  lines: string[]
): CodeChunk {
  // Get lines from function start to just before the return statement
  const startLine = originalChunk.startLine;
  const returnLine = returnStatement.loc?.start.line || originalChunk.endLine;

  // Include the first line of the return (e.g., "return (") but not the JSX body
  const summaryEndLine = Math.min(returnLine, originalChunk.endLine);

  // Extract the summary content
  const summaryLines = lines.slice(startLine - 1, summaryEndLine);

  // Add closing brace to make it syntactically valid-ish
  const summaryContent = summaryLines.join("\n") + "\n    // ... JSX content (see sections)\n  );";

  return {
    id: hashChunk(summaryContent, originalChunk.filePath, startLine),
    filePath: originalChunk.filePath,
    startLine: startLine,
    endLine: summaryEndLine,
    startColumn: originalChunk.startColumn,
    endColumn: originalChunk.endColumn,
    kind: "component-summary",
    name: originalChunk.name,
    content: summaryContent,
    metadata: {
      ...originalChunk.metadata,
      // Keep hooks but clear JSX elements (they're in the sections)
      jsxElements: undefined,
    },
  };
}

/**
 * Create a JSX section chunk from a JSX child element
 */
function createJSXSectionChunk(
  originalChunk: CodeChunk,
  jsxChild: TSESTree.JSXChild,
  lines: string[],
  index: number,
  parentId: string
): CodeChunk | null {
  const loc = jsxChild.loc;
  if (!loc) {
    return null;
  }

  const startLine = loc.start.line;
  const endLine = loc.end.line;
  const lineCount = endLine - startLine + 1;

  // Skip very small sections
  if (lineCount < MIN_SECTION_LINES) {
    return null;
  }

  // Extract the content
  const sectionContent = lines.slice(startLine - 1, endLine).join("\n");

  // Infer a label from the JSX element
  const label = inferSectionLabel(jsxChild, index);

  // Extract JSX elements in this section
  const jsxElements = extractJSXElementsFromNode(jsxChild);

  return {
    id: hashChunk(sectionContent, originalChunk.filePath, startLine),
    filePath: originalChunk.filePath,
    startLine,
    endLine,
    startColumn: loc.start.column,
    endColumn: loc.end.column,
    kind: "jsx-section",
    name: originalChunk.name,
    content: sectionContent,
    metadata: {
      jsxElements: jsxElements.length > 0 ? jsxElements : undefined,
      isExported: originalChunk.metadata.isExported,
      isDefaultExport: originalChunk.metadata.isDefaultExport,
    },
    parentId,
    sectionIndex: index,
    sectionLabel: label,
  };
}

/**
 * Infer a human-readable label for a JSX section
 */
function inferSectionLabel(jsxChild: TSESTree.JSXChild, index: number): string {
  if (jsxChild.type === AST_NODE_TYPES.JSXElement) {
    const opening = jsxChild.openingElement;

    // Try to get a meaningful name from attributes
    for (const attr of opening.attributes) {
      if (attr.type === AST_NODE_TYPES.JSXAttribute && attr.name.type === AST_NODE_TYPES.JSXIdentifier) {
        const attrName = attr.name.name;

        // Look for common identifying attributes
        if (attrName === "aria-label" || attrName === "aria-labelledby") {
          if (attr.value?.type === AST_NODE_TYPES.Literal && typeof attr.value.value === "string") {
            return attr.value.value.toLowerCase().replace(/\s+/g, "-").slice(0, 30);
          }
        }

        // Check className for semantic hints
        if (attrName === "className" || attrName === "class") {
          if (attr.value?.type === AST_NODE_TYPES.Literal && typeof attr.value.value === "string") {
            const className = attr.value.value;
            // Extract first meaningful class
            const classes = className.split(/\s+/);
            for (const cls of classes) {
              // Skip utility classes (Tailwind patterns)
              if (!cls.match(/^(bg-|text-|p-|m-|w-|h-|flex|grid|border|rounded|shadow|hover:|focus:)/)) {
                return cls.slice(0, 30);
              }
            }
          }
        }
      }
    }

    // Fall back to element name
    if (opening.name.type === AST_NODE_TYPES.JSXIdentifier) {
      return `${opening.name.name}-${index}`;
    }
  }

  return `section-${index}`;
}

/**
 * Extract JSX element names from a node
 */
function extractJSXElementsFromNode(node: TSESTree.Node): string[] {
  const elements: string[] = [];

  function search(n: TSESTree.Node) {
    if (n.type === AST_NODE_TYPES.JSXOpeningElement) {
      if (n.name.type === AST_NODE_TYPES.JSXIdentifier) {
        elements.push(n.name.name);
      } else if (n.name.type === AST_NODE_TYPES.JSXMemberExpression) {
        const parts: string[] = [];
        let current: TSESTree.JSXMemberExpression | TSESTree.JSXIdentifier = n.name;
        while (current.type === AST_NODE_TYPES.JSXMemberExpression) {
          if (current.property.type === AST_NODE_TYPES.JSXIdentifier) {
            parts.unshift(current.property.name);
          }
          current = current.object as TSESTree.JSXMemberExpression | TSESTree.JSXIdentifier;
        }
        if (current.type === AST_NODE_TYPES.JSXIdentifier) {
          parts.unshift(current.name);
        }
        elements.push(parts.join("."));
      }
    }

    // Recurse
    for (const key of Object.keys(n)) {
      if (key === "parent" || key === "loc" || key === "range") continue;

      const child = (n as unknown as Record<string, unknown>)[key];
      if (child && typeof child === "object") {
        if (Array.isArray(child)) {
          child.forEach((c) => {
            if (c && typeof c === "object" && "type" in c) {
              search(c as TSESTree.Node);
            }
          });
        } else if ("type" in child) {
          search(child as TSESTree.Node);
        }
      }
    }
  }

  search(node);
  return [...new Set(elements)];
}

/**
 * Split a chunk by line count (fallback strategy)
 */
function splitByLines(
  originalChunk: CodeChunk,
  lines: string[],
  maxLines: number
): CodeChunk[] {
  const totalLines = originalChunk.endLine - originalChunk.startLine + 1;

  // If it fits, return as-is
  if (totalLines <= maxLines) {
    return [originalChunk];
  }

  // Determine the appropriate kinds based on original chunk type
  const isComponent = originalChunk.kind === "component" || originalChunk.kind === "jsx-fragment";
  const summaryKind: ChunkKind = isComponent ? "component-summary" : "function-summary";
  const sectionKind: ChunkKind = isComponent ? "jsx-section" : "function-section";

  const chunks: CodeChunk[] = [];
  const overlap = Math.min(10, Math.floor(maxLines / 5)); // 10 lines overlap, or 20% of maxLines

  let currentStart = originalChunk.startLine;
  let sectionIndex = 0;

  while (currentStart <= originalChunk.endLine) {
    const currentEnd = Math.min(currentStart + maxLines - 1, originalChunk.endLine);
    const sectionContent = lines.slice(currentStart - 1, currentEnd).join("\n");

    const isFirstSection = sectionIndex === 0;

    chunks.push({
      id: hashChunk(sectionContent, originalChunk.filePath, currentStart),
      filePath: originalChunk.filePath,
      startLine: currentStart,
      endLine: currentEnd,
      startColumn: isFirstSection ? originalChunk.startColumn : 0,
      endColumn: currentEnd === originalChunk.endLine ? originalChunk.endColumn : lines[currentEnd - 1]?.length || 0,
      kind: isFirstSection ? summaryKind : sectionKind,
      name: originalChunk.name,
      content: sectionContent,
      metadata: isFirstSection ? originalChunk.metadata : {
        isExported: originalChunk.metadata.isExported,
        isDefaultExport: originalChunk.metadata.isDefaultExport,
      },
      parentId: isFirstSection ? undefined : chunks[0]?.id,
      sectionIndex: isFirstSection ? undefined : sectionIndex,
      sectionLabel: isFirstSection ? undefined : `lines-${currentStart}-${currentEnd}`,
    });

    // Move to next section with overlap
    currentStart = currentEnd - overlap + 1;
    sectionIndex++;

    // Prevent infinite loop
    if (currentStart <= originalChunk.startLine + sectionIndex * (maxLines - overlap)) {
      currentStart = originalChunk.startLine + sectionIndex * (maxLines - overlap);
    }
  }

  return chunks;
}

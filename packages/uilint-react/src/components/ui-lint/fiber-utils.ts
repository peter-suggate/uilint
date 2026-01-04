/**
 * React Fiber inspection utilities for source file visualization
 *
 * In development mode, React attaches debug information to Fiber nodes:
 * - _debugSource: { fileName, lineNumber, columnNumber }
 * - _debugOwner: The component that rendered this element
 * - return: Parent fiber in the tree
 */

import type {
  SourceLocation,
  ComponentInfo,
  ScannedElement,
  SourceFile,
  FILE_COLORS,
  DATA_UILINT_ID,
} from "./types";

// Re-import constants
const DATA_ATTR = "data-ui-lint-id";
const COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#10B981",
  "#F59E0B",
  "#06B6D4",
  "#EF4444",
  "#84CC16",
  "#6366F1",
  "#F97316",
  "#14B8A6",
  "#A855F7",
];

/** Tags to skip during DOM traversal */
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "SVG",
  "NOSCRIPT",
  "TEMPLATE",
  "HEAD",
  "META",
  "LINK",
]);

/** React Fiber type (simplified) */
interface Fiber {
  tag: number;
  type: string | Function | null;
  stateNode: Element | null;
  return: Fiber | null;
  _debugSource?: {
    fileName: string;
    lineNumber: number;
    columnNumber?: number;
  } | null;
  _debugOwner?: Fiber | null;
}

let elementCounter = 0;

/**
 * Generate a stable element ID from data-loc or fallback to counter
 * Using data-loc ensures the same element always gets the same ID across scans
 */
function generateStableId(
  element: Element,
  source: SourceLocation | null
): string {
  // Prefer data-loc as it's injected by the build plugin and is stable
  const dataLoc = element.getAttribute("data-loc");
  if (dataLoc) {
    return `loc:${dataLoc}`;
  }

  // Fallback: use source location if available
  if (source) {
    return `src:${source.fileName}:${source.lineNumber}:${
      source.columnNumber ?? 0
    }`;
  }

  // Last resort: use counter (not stable across scans)
  return `uilint-${++elementCounter}`;
}

/**
 * Get React Fiber from a DOM element
 * React attaches fiber via __reactFiber$xxx key
 */
export function getFiberFromElement(element: Element): Fiber | null {
  const keys = Object.keys(element);
  const fiberKey = keys.find((k) => k.startsWith("__reactFiber$"));
  if (!fiberKey) return null;
  return (element as any)[fiberKey] as Fiber;
}

/**
 * Get the internal props from a DOM element
 * React attaches props via __reactProps$xxx key
 */
export function getPropsFromElement(
  element: Element
): Record<string, any> | null {
  const keys = Object.keys(element);
  const propsKey = keys.find((k) => k.startsWith("__reactProps$"));
  if (!propsKey) return null;
  return (element as any)[propsKey];
}

/**
 * Extract source location from a fiber's _debugSource
 */
export function getDebugSource(fiber: Fiber): SourceLocation | null {
  if (!fiber._debugSource) return null;
  return {
    fileName: fiber._debugSource.fileName,
    lineNumber: fiber._debugSource.lineNumber,
    columnNumber: fiber._debugSource.columnNumber,
  };
}

/**
 * Parse source location from data-loc attribute
 * Format: "path/to/file.tsx:line:column" (injected by jsx-loc-plugin)
 * Also supports legacy format: "path/to/file.tsx:line"
 */
export function getSourceFromDataLoc(element: Element): SourceLocation | null {
  const loc = element.getAttribute("data-loc");
  if (!loc) return null;

  // Split by colon - need to handle paths that may contain colons (Windows)
  // Format is: path:line:column or path:line
  // We parse from the end since line and column are always numbers
  const parts = loc.split(":");

  if (parts.length < 2) return null;

  // Check if we have path:line:column format
  const lastPart = parts[parts.length - 1];
  const secondLastPart = parts[parts.length - 2];

  const lastIsNumber = /^\d+$/.test(lastPart);
  const secondLastIsNumber = /^\d+$/.test(secondLastPart);

  if (lastIsNumber && secondLastIsNumber) {
    // Format: path:line:column
    const columnNumber = parseInt(lastPart, 10);
    const lineNumber = parseInt(secondLastPart, 10);
    const fileName = parts.slice(0, -2).join(":");

    if (isNaN(lineNumber) || isNaN(columnNumber) || !fileName) return null;

    return { fileName, lineNumber, columnNumber };
  } else if (lastIsNumber) {
    // Format: path:line (legacy)
    const lineNumber = parseInt(lastPart, 10);
    const fileName = parts.slice(0, -1).join(":");

    if (isNaN(lineNumber) || !fileName) return null;

    return { fileName, lineNumber };
  }

  return null;
}

/**
 * Get the debug owner fiber (component that rendered this element)
 */
export function getDebugOwner(fiber: Fiber): Fiber | null {
  return fiber._debugOwner ?? null;
}

/**
 * Get a readable component name from a fiber
 */
function getComponentName(fiber: Fiber): string {
  if (!fiber.type) return "Unknown";
  if (typeof fiber.type === "string") return fiber.type;
  if (typeof fiber.type === "function") {
    // Cast to access React component properties
    const fn = fiber.type as Function & { displayName?: string; name?: string };
    return fn.displayName || fn.name || "Anonymous";
  }
  return "Unknown";
}

/**
 * Build a component stack by walking up the fiber tree
 * Returns an array from innermost to outermost component
 */
export function getComponentStack(fiber: Fiber): ComponentInfo[] {
  const stack: ComponentInfo[] = [];
  let current: Fiber | null = fiber._debugOwner ?? null;

  while (current && stack.length < 20) {
    // Limit depth
    const name = getComponentName(current);
    const source = getDebugSource(current);

    // Only include function/class components (tag 0, 1, 2)
    if (current.tag <= 2 && name !== "Unknown") {
      stack.push({ name, source });
    }

    current = current._debugOwner ?? current.return;
  }

  return stack;
}

/**
 * Check if a file path is from node_modules
 */
export function isNodeModulesPath(path: string): boolean {
  return path.includes("node_modules");
}

/**
 * Get display name from a file path (just the filename)
 */
export function getDisplayName(path: string): string {
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

/**
 * Check if an element should be skipped during scanning
 */
function shouldSkipElement(element: Element): boolean {
  // Skip by tag
  if (SKIP_TAGS.has(element.tagName.toUpperCase())) return true;

  // Skip elements already marked by UILint
  if (element.hasAttribute("data-ui-lint")) return true;

  // Skip aria-hidden elements
  if (element.getAttribute("aria-hidden") === "true") return true;

  // Skip invisible elements
  const styles = window.getComputedStyle(element);
  if (styles.display === "none" || styles.visibility === "hidden") return true;

  // Skip zero-size elements
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return true;

  return false;
}

/**
 * Generate a unique element ID (deprecated - use generateStableId instead)
 */
function generateElementId(): string {
  return `uilint-${++elementCounter}`;
}

/**
 * Scan the DOM tree and extract React source information
 */
export function scanDOMForSources(
  root: Element = document.body,
  hideNodeModules: boolean = true
): ScannedElement[] {
  const elements: ScannedElement[] = [];

  // Reset counter
  elementCounter = 0;

  // Clean up previous scan
  cleanupDataAttributes();

  // Use TreeWalker for efficient DOM traversal
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) => {
      const el = node as Element;
      if (shouldSkipElement(el)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let node: Node | null = walker.currentNode;
  while (node) {
    if (node instanceof Element) {
      // Strategy 1: Prefer React Fiber _debugSource for file paths (keeps absolute paths).
      let source: SourceLocation | null = null;
      let componentStack: ComponentInfo[] = [];

      const fiber = getFiberFromElement(node);
      if (fiber) {
        source = getDebugSource(fiber);
        if (!source && fiber._debugOwner) {
          source = getDebugSource(fiber._debugOwner);
        }
        componentStack = getComponentStack(fiber);
      }

      // Strategy 2: Fall back to data-loc attribute (injected by jsx-loc-plugin)
      if (!source) {
        source = getSourceFromDataLoc(node);
      }

      // Skip node_modules if setting enabled
      if (hideNodeModules && source && isNodeModulesPath(source.fileName)) {
        // Try to find a non-node_modules source in the component stack
        const appSource = componentStack.find(
          (c) => c.source && !isNodeModulesPath(c.source.fileName)
        );
        if (appSource?.source) {
          source = appSource.source;
        } else {
          node = walker.nextNode();
          continue;
        }
      }

      if (source) {
        // Use stable ID based on data-loc for consistent tracking across scans
        const id = generateStableId(node, source);
        node.setAttribute(DATA_ATTR, id);

        const scannedElement: ScannedElement = {
          id,
          element: node,
          tagName: node.tagName.toLowerCase(),
          className: typeof node.className === "string" ? node.className : "",
          source,
          componentStack,
          rect: node.getBoundingClientRect(),
        };

        elements.push(scannedElement);
      }
    }
    node = walker.nextNode();
  }

  return elements;
}

/**
 * Group scanned elements by their source file
 */
export function groupBySourceFile(elements: ScannedElement[]): SourceFile[] {
  const fileMap = new Map<string, ScannedElement[]>();

  for (const element of elements) {
    if (!element.source) continue;
    const path = element.source.fileName;
    const existing = fileMap.get(path) || [];
    existing.push(element);
    fileMap.set(path, existing);
  }

  // Convert to array and assign colors
  const sourceFiles: SourceFile[] = [];
  let colorIndex = 0;

  for (const [path, elements] of fileMap) {
    sourceFiles.push({
      path,
      displayName: getDisplayName(path),
      color: COLORS[colorIndex % COLORS.length],
      elements,
    });
    colorIndex++;
  }

  // Sort by element count (most elements first)
  sourceFiles.sort((a, b) => b.elements.length - a.elements.length);

  return sourceFiles;
}

/**
 * Clean up data attributes from previous scans
 */
export function cleanupDataAttributes(): void {
  const elements = document.querySelectorAll(`[${DATA_ATTR}]`);
  elements.forEach((el) => el.removeAttribute(DATA_ATTR));
  elementCounter = 0;
}

/**
 * Get an element by its UILint ID
 */
export function getElementById(id: string): Element | null {
  return document.querySelector(`[${DATA_ATTR}="${id}"]`);
}

/**
 * Update element rects (for scroll/resize handling)
 */
export function updateElementRects(
  elements: ScannedElement[]
): ScannedElement[] {
  return elements.map((el) => ({
    ...el,
    rect: el.element.getBoundingClientRect(),
  }));
}

/**
 * Build an "Open in Editor" URL
 */
export function buildEditorUrl(
  source: SourceLocation,
  editor: "cursor" | "vscode" = "cursor"
): string {
  const { fileName, lineNumber, columnNumber } = source;
  const column = columnNumber ?? 1;

  if (editor === "cursor") {
    return `cursor://file/${encodeURIComponent(
      fileName
    )}:${lineNumber}:${column}`;
  }

  return `vscode://file/${encodeURIComponent(
    fileName
  )}:${lineNumber}:${column}`;
}

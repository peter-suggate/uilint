/**
 * DOM utilities for UILint source file visualization
 *
 * Uses data-loc attributes injected by the jsx-loc-plugin build transform.
 * This works uniformly for both server and client components in Next.js 15+.
 */

import type { SourceLocation, ScannedElement, SourceFile } from "./types";

// Data attribute used to mark scanned elements
const DATA_ATTR = "data-ui-lint-id";

// Color palette for source file differentiation
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
 * Scan the DOM tree and extract elements with data-loc attributes
 */
export function scanDOMForSources(
  root: Element = document.body,
  hideNodeModules: boolean = true
): ScannedElement[] {
  const elements: ScannedElement[] = [];

  // data-loc values are not guaranteed to be unique across the DOM (e.g. the same
  // component line rendered in a list). Track occurrences so we can produce a
  // stable, unique per-instance id.
  const occurrenceByDataLoc = new Map<string, number>();

  // Clean up previous scan
  cleanupDataAttributes();

  // Query all elements with data-loc attribute
  const locElements = root.querySelectorAll("[data-loc]");

  for (const el of locElements) {
    if (shouldSkipElement(el)) continue;

    const source = getSourceFromDataLoc(el);
    if (!source) continue;

    // Skip node_modules if setting enabled
    if (hideNodeModules && isNodeModulesPath(source.fileName)) {
      continue;
    }

    const dataLoc = el.getAttribute("data-loc")!;
    const occurrence = (occurrenceByDataLoc.get(dataLoc) ?? 0) + 1;
    occurrenceByDataLoc.set(dataLoc, occurrence);
    const id = `loc:${dataLoc}#${occurrence}`;

    el.setAttribute(DATA_ATTR, id);

    elements.push({
      id,
      element: el,
      tagName: el.tagName.toLowerCase(),
      className: typeof el.className === "string" ? el.className : "",
      source,
      rect: el.getBoundingClientRect(),
    });
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

  for (const [path, fileElements] of fileMap) {
    sourceFiles.push({
      path,
      displayName: getDisplayName(path),
      color: COLORS[colorIndex % COLORS.length],
      elements: fileElements,
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
 * Identify the top-level (first declared) element for each source file.
 * The top-level element is determined by the earliest line number within each file.
 * This is used to display file-level issues on the appropriate element in heatmap mode.
 *
 * @returns Map of filePath -> elementId for the top-level element
 */
export function identifyTopLevelElements(
  elements: ScannedElement[]
): Map<string, string> {
  const topLevelByFile = new Map<string, string>();

  // Group elements by file
  const byFile = new Map<string, ScannedElement[]>();
  for (const el of elements) {
    const path = el.source.fileName;
    const existing = byFile.get(path) || [];
    existing.push(el);
    byFile.set(path, existing);
  }

  // For each file, find the element with the earliest line number
  for (const [filePath, fileElements] of byFile) {
    if (fileElements.length === 0) continue;

    // Sort by line number, then column number for determinism
    const sorted = [...fileElements].sort((a, b) => {
      const lineDiff = a.source.lineNumber - b.source.lineNumber;
      if (lineDiff !== 0) return lineDiff;
      return (a.source.columnNumber ?? 0) - (b.source.columnNumber ?? 0);
    });

    topLevelByFile.set(filePath, sorted[0].id);
  }

  return topLevelByFile;
}

/**
 * Build an "Open in Editor" URL
 * @param source - The source location (fileName may be relative or absolute)
 * @param editor - The editor to open in (cursor or vscode)
 * @param workspaceRoot - Optional workspace root to prepend for relative paths
 */
export function buildEditorUrl(
  source: SourceLocation,
  editor: "cursor" | "vscode" = "cursor",
  workspaceRoot?: string | null
): string {
  const { fileName, lineNumber, columnNumber } = source;
  const column = columnNumber ?? 1;

  // Build absolute file path
  let absolutePath = fileName;
  if (workspaceRoot && !fileName.startsWith("/")) {
    // Ensure workspace root ends without slash for clean concatenation
    const root = workspaceRoot.endsWith("/")
      ? workspaceRoot.slice(0, -1)
      : workspaceRoot;
    absolutePath = `${root}/${fileName}`;
  }

  if (editor === "cursor") {
    return `cursor://file/${encodeURIComponent(
      absolutePath
    )}:${lineNumber}:${column}`;
  }

  return `vscode://file/${encodeURIComponent(
    absolutePath
  )}:${lineNumber}:${column}`;
}

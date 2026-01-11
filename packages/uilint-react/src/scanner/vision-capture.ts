/**
 * Vision Capture Module
 *
 * Provides screenshot capture and element manifest building for vision-based analysis.
 * Uses html-to-image for DOM-to-image capture.
 */

import type { SourceLocation } from "../components/ui-lint/types";

/**
 * Element manifest entry for vision analysis
 */
export interface ElementManifest {
  /** Unique ID (data-ui-lint-id if present, otherwise generated) */
  id: string;
  /** Visible text content (truncated to 100 chars) */
  text: string;
  /** data-loc value: "path:line:column" */
  dataLoc: string;
  /** Bounding rectangle */
  rect: { x: number; y: number; width: number; height: number };
  /** HTML tag name */
  tagName: string;
  /** Inferred semantic role (button, heading, link, etc.) */
  role?: string;
  /** Total instances with same dataLoc (if deduplicated) */
  instanceCount?: number;
}

/**
 * Vision analysis issue from the LLM
 */
export interface VisionIssue {
  /** Text of the element this issue refers to */
  elementText: string;
  /** Issue description */
  message: string;
  /** Issue category */
  category:
    | "spacing"
    | "alignment"
    | "color"
    | "typography"
    | "layout"
    | "contrast"
    | "visual-hierarchy"
    // backward/defensive (older payloads or custom models)
    | "other";
  /** Severity level */
  severity: "error" | "warning" | "info";
  /** Matched dataLoc from manifest (filled in after text matching) */
  dataLoc?: string;
  /** Matched element ID (filled in after text matching) */
  elementId?: string;
}

/**
 * Vision analysis result
 */
export interface VisionAnalysisResult {
  /** Route/path that was analyzed */
  route: string;
  /** Timestamp of capture */
  timestamp: number;
  /** Screenshot as base64 data URL */
  screenshotDataUrl?: string;
  /** Element manifest */
  manifest: ElementManifest[];
  /** Issues found by vision analysis */
  issues: VisionIssue[];
  /** Analysis duration in ms */
  analysisTime: number;
  /** Error message if analysis failed */
  error?: string;
}

/**
 * Tags to skip when collecting manifest
 */
const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "SVG",
  "PATH",
  "CIRCLE",
  "RECT",
  "LINE",
  "POLYGON",
  "POLYLINE",
  "ELLIPSE",
  "NOSCRIPT",
  "TEMPLATE",
  "SLOT",
]);

/**
 * Max instances per dataLoc to include in manifest (for deduplication)
 */
const MAX_INSTANCES_PER_DATALOC = 3;

/**
 * Max text length for element text
 */
const MAX_TEXT_LENGTH = 100;

/**
 * Infer semantic role from element
 */
function inferRole(element: Element): string | undefined {
  const tagName = element.tagName.toUpperCase();

  // Check explicit role attribute
  const explicitRole = element.getAttribute("role");
  if (explicitRole) return explicitRole;

  // Infer from tag name
  switch (tagName) {
    case "BUTTON":
      return "button";
    case "A":
      return "link";
    case "H1":
    case "H2":
    case "H3":
    case "H4":
    case "H5":
    case "H6":
      return "heading";
    case "INPUT": {
      const type = (element as HTMLInputElement).type;
      if (type === "submit" || type === "button") return "button";
      if (type === "checkbox") return "checkbox";
      if (type === "radio") return "radio";
      return "textbox";
    }
    case "TEXTAREA":
      return "textbox";
    case "SELECT":
      return "combobox";
    case "IMG":
      return "img";
    case "NAV":
      return "navigation";
    case "MAIN":
      return "main";
    case "HEADER":
      return "banner";
    case "FOOTER":
      return "contentinfo";
    case "ASIDE":
      return "complementary";
    case "ARTICLE":
      return "article";
    case "SECTION":
      return "region";
    case "FORM":
      return "form";
    case "TABLE":
      return "table";
    case "UL":
    case "OL":
      return "list";
    case "LI":
      return "listitem";
    default:
      return undefined;
  }
}

/**
 * Get visible text content from element
 */
function getVisibleText(element: Element): string {
  // Try innerText first (respects visibility)
  const innerText = (element as HTMLElement).innerText?.trim();
  if (innerText) {
    return innerText.length > MAX_TEXT_LENGTH
      ? innerText.slice(0, MAX_TEXT_LENGTH) + "…"
      : innerText;
  }

  // Fallback to aria-label
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  // Fallback to title
  const title = element.getAttribute("title");
  if (title) return title;

  // Fallback to placeholder for inputs
  const placeholder = element.getAttribute("placeholder");
  if (placeholder) return placeholder;

  // Fallback to alt for images
  const alt = element.getAttribute("alt");
  if (alt) return alt;

  return "";
}

/**
 * Check if element is visible
 */
function isElementVisible(element: Element): boolean {
  const htmlEl = element as HTMLElement;

  // Check computed style
  const style = window.getComputedStyle(htmlEl);
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;

  // Check dimensions
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  // Check if in viewport (with some margin)
  if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return false;
  if (rect.right < -100 || rect.left > window.innerWidth + 100) return false;

  return true;
}

/**
 * Collect element manifest from DOM
 *
 * Scans all elements with data-loc attributes and builds a manifest
 * with deduplication for repeated elements (e.g., list items).
 */
export function collectElementManifest(
  container: Element = document.body
): ElementManifest[] {
  const manifest: ElementManifest[] = [];
  const dataLocCounts = new Map<string, number>();
  const dataLocInstances = new Map<string, ElementManifest[]>();

  // Find all elements with data-loc
  const elements = container.querySelectorAll("[data-loc]");

  for (const element of elements) {
    // Skip UILint's own elements
    if (element.closest("[data-ui-lint]")) continue;

    // Skip certain tag types
    if (SKIP_TAGS.has(element.tagName)) continue;

    // Skip hidden elements
    if (!isElementVisible(element)) continue;

    const dataLoc = element.getAttribute("data-loc");
    if (!dataLoc) continue;

    // Track instance count
    const currentCount = dataLocCounts.get(dataLoc) || 0;
    dataLocCounts.set(dataLoc, currentCount + 1);

    // Get or create instances array for this dataLoc
    let instances = dataLocInstances.get(dataLoc);
    if (!instances) {
      instances = [];
      dataLocInstances.set(dataLoc, instances);
    }

    // Only collect up to MAX_INSTANCES_PER_DATALOC
    if (instances.length >= MAX_INSTANCES_PER_DATALOC) continue;

    const rect = element.getBoundingClientRect();
    const text = getVisibleText(element);
    const id =
      element.getAttribute("data-ui-lint-id") ||
      `loc:${dataLoc}#${currentCount}`;

    const entry: ElementManifest = {
      id,
      text,
      dataLoc,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      tagName: element.tagName.toLowerCase(),
      role: inferRole(element),
    };

    instances.push(entry);
  }

  // Build final manifest with instance counts
  for (const [dataLoc, instances] of dataLocInstances) {
    const totalCount = dataLocCounts.get(dataLoc) || instances.length;

    instances.forEach((entry, index) => {
      // Add instance count to first entry if there are more than shown
      if (index === 0 && totalCount > instances.length) {
        entry.instanceCount = totalCount;
      }
      manifest.push(entry);
    });
  }

  return manifest;
}

/**
 * Match vision issues to manifest entries by element text
 *
 * The LLM returns issues with elementText; we need to map back to dataLoc
 */
export function matchIssuesToManifest(
  issues: VisionIssue[],
  manifest: ElementManifest[]
): VisionIssue[] {
  return issues.map((issue) => {
    // Try exact match first
    let match = manifest.find(
      (m) => m.text.toLowerCase() === issue.elementText.toLowerCase()
    );

    // Try partial match (text starts with or contains)
    if (!match) {
      match = manifest.find(
        (m) =>
          m.text.toLowerCase().includes(issue.elementText.toLowerCase()) ||
          issue.elementText.toLowerCase().includes(m.text.toLowerCase())
      );
    }

    if (match) {
      return {
        ...issue,
        dataLoc: match.dataLoc,
        elementId: match.id,
      };
    }

    return issue;
  });
}

/**
 * Capture screenshot of the current page
 *
 * Uses html-to-image library for DOM-to-image capture.
 * Falls back to canvas if html-to-image is not available.
 */
export async function captureScreenshot(): Promise<string> {
  // Try to use html-to-image if available
  const htmlToImage = await import("html-to-image").catch(() => null);

  if (!htmlToImage) {
    throw new Error(
      "Screenshot capture unavailable: `html-to-image` failed to load (check the uilint-react bundle/deps)"
    );
  }

  try {
    const dataUrl = await htmlToImage.toPng(document.body, {
      // Keep file size down for WS transport
      pixelRatio: 1,
      cacheBust: true,
      filter: (node) => {
        // Skip UILint overlay elements
        if (node instanceof Element && node.closest("[data-ui-lint]")) {
          return false;
        }
        return true;
      },
    });
    return dataUrl;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const msg = err.message || "Unknown error";

    // Common failure modes: cross-origin images/fonts taint the canvas.
    const hint = /tainted|cross[- ]origin|CORS|security/i.test(msg)
      ? " Hint: this is often caused by cross-origin images/fonts; try removing external images or ensuring they allow CORS."
      : "";

    throw new Error(
      `Screenshot capture failed (html-to-image): ${msg}.${hint}`
    );
  }
}

/**
 * Get current route from URL
 */
export function getCurrentRoute(): string {
  const path = window.location.pathname;
  // Normalize: remove trailing slashes, handle index
  const normalized = path.replace(/\/+$/, "") || "/";
  return normalized;
}

/**
 * Generate filename-safe timestamp
 */
export function generateTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Build vision analysis request payload
 */
export function buildVisionAnalysisPayload(options: {
  screenshotDataUrl?: string;
  manifest: ElementManifest[];
  route: string;
}) {
  return {
    type: "vision:analyze" as const,
    route: options.route,
    timestamp: Date.now(),
    screenshot: options.screenshotDataUrl,
    manifest: options.manifest,
  };
}

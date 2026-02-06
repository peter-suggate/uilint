/**
 * Element Manifest Collection
 *
 * Collects visible elements with data-loc attributes for vision analysis.
 * Uses DOM APIs - no React.
 */

import type { ElementManifest, CaptureRegion } from "../types.js";
import { MANIFEST_SKIP_TAGS, MANIFEST_TEXT_MAX_LENGTH } from "../constants.js";

/**
 * Infer semantic role from element
 */
function inferRole(el: Element): string | undefined {
  const tagName = el.tagName.toUpperCase();
  const role = el.getAttribute("role");

  if (role) return role;

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
    case "INPUT":
      return el.getAttribute("type") || "textbox";
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
    case "FORM":
      return "form";
    case "UL":
    case "OL":
      return "list";
    case "LI":
      return "listitem";
    case "TABLE":
      return "table";
    default:
      return undefined;
  }
}

/**
 * Get visible text content from element
 */
function getVisibleText(el: Element): string {
  // Get direct text content, not from children
  let text = "";

  // Check for specific attributes first
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.slice(0, MANIFEST_TEXT_MAX_LENGTH);

  const alt = el.getAttribute("alt");
  if (alt) return alt.slice(0, MANIFEST_TEXT_MAX_LENGTH);

  const placeholder = el.getAttribute("placeholder");
  if (placeholder) return placeholder.slice(0, MANIFEST_TEXT_MAX_LENGTH);

  // Get text content
  const textContent = el.textContent || "";
  text = textContent.trim().replace(/\s+/g, " ");

  return text.slice(0, MANIFEST_TEXT_MAX_LENGTH);
}

/**
 * Check if element is within region
 */
function isInRegion(rect: DOMRect, region: CaptureRegion | null): boolean {
  if (!region) return true;

  return (
    rect.left < region.x + region.width &&
    rect.right > region.x &&
    rect.top < region.y + region.height &&
    rect.bottom > region.y
  );
}

/**
 * Check if element is visible
 */
function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === "none") return false;
  if (style.visibility === "hidden") return false;
  if (style.opacity === "0") return false;

  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return false;

  return true;
}

/**
 * Collect element manifest from the DOM
 *
 * @param region - Optional region to filter elements
 * @returns Array of element manifest entries
 */
export function collectElementManifest(region?: CaptureRegion | null): ElementManifest[] {
  const manifest: ElementManifest[] = [];
  const seenDataLocs = new Map<string, number>();

  // Find all elements with data-loc
  const elements = document.querySelectorAll("[data-loc]");

  for (const el of elements) {
    // Skip certain tags
    if (MANIFEST_SKIP_TAGS.includes(el.tagName.toUpperCase() as typeof MANIFEST_SKIP_TAGS[number])) {
      continue;
    }

    // Check visibility
    if (!isVisible(el)) {
      continue;
    }

    const rect = el.getBoundingClientRect();

    // Check if in region
    if (!isInRegion(rect, region ?? null)) {
      continue;
    }

    const dataLoc = el.getAttribute("data-loc") || "";
    const text = getVisibleText(el);

    // Track instance count for deduplication
    const instanceCount = (seenDataLocs.get(dataLoc) || 0) + 1;
    seenDataLocs.set(dataLoc, instanceCount);

    manifest.push({
      id: dataLoc || `element-${manifest.length}`,
      text,
      dataLoc,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      tagName: el.tagName.toLowerCase(),
      role: inferRole(el),
      instanceCount,
    });
  }

  return manifest;
}

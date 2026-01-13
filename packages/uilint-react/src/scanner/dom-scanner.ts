/**
 * DOM scanner for browser environment
 * Re-exports and wraps uilint-core functions for browser use
 */

import {
  extractStylesFromDOM,
  createStyleSummary,
  serializeStyles,
  truncateHTML,
  type DOMSnapshot,
} from "uilint-core";

// Re-export for backwards compatibility
export { createStyleSummary, serializeStyles };

/**
 * Scans the DOM and extracts a snapshot of all styles
 */
export function scanDOM(root?: Element | Document): DOMSnapshot {
  const targetRoot = root || document.body;

  const styles = extractStylesFromDOM(targetRoot);
  const html =
    targetRoot instanceof Element
      ? targetRoot.outerHTML
      : targetRoot.body?.outerHTML || "";

  return {
    html: truncateHTML(html, 50000),
    styles,
    elementCount: targetRoot.querySelectorAll("*").length,
    timestamp: Date.now(),
  };
}

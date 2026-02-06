/**
 * Vision Browser Utilities
 *
 * Utility functions for vision analysis in the browser.
 */

import type { VisionIssue, ElementManifest } from "../types.js";

/**
 * Get the current route/URL path
 */
export function getCurrentRoute(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname + window.location.search;
}

/**
 * Generate a timestamp string
 */
export function generateTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/**
 * Match vision issues to manifest elements by their dataLoc
 *
 * @param issues - Vision issues from analysis
 * @param manifest - Element manifest
 * @returns Issues with element references attached
 */
export function matchIssuesToManifest(
  issues: VisionIssue[],
  manifest: ElementManifest[]
): VisionIssue[] {
  const manifestMap = new Map<string, ElementManifest>();
  for (const el of manifest) {
    manifestMap.set(el.dataLoc, el);
  }

  return issues.map((issue) => {
    const match = issue.dataLoc ? manifestMap.get(issue.dataLoc) : undefined;
    return {
      ...issue,
      element: match,
    };
  });
}

/**
 * Build vision analysis payload for WebSocket
 */
export function buildVisionAnalysisPayload(options: {
  route: string;
  timestamp: number;
  screenshot: string;
  manifest: ElementManifest[];
  requestId?: string;
}): {
  type: "vision:analyze";
  route: string;
  timestamp: number;
  screenshot: string;
  manifest: ElementManifest[];
  requestId?: string;
} {
  return {
    type: "vision:analyze",
    route: options.route,
    timestamp: options.timestamp,
    screenshot: options.screenshot,
    manifest: options.manifest,
    requestId: options.requestId,
  };
}

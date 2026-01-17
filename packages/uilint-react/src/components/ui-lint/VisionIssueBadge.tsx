"use client";

/**
 * Vision Issue Badge Component
 *
 * Displays overlay badges on elements that have vision-detected issues.
 * Similar to ESLint badges but with a distinct visual style for vision issues.
 */

import React, { useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintStore, type UILintStore } from "./store";
import type { VisionIssue } from "../../scanner/vision-capture";
import { getUILintPortalHost } from "./portal-host";
import { DATA_UILINT_ID } from "./types";

/**
 * Design tokens for vision badges - uses CSS variables for theme support
 */
const STYLES = {
  // Vision-specific colors (purple/violet theme to distinguish from ESLint)
  badgeBg: "oklch(0.585 0.233 283.04 / 95%)", // violet-500
  badgeBgWarning: "var(--uilint-warning)",
  badgeBgInfo: "var(--uilint-accent)",
  badgeText: "var(--uilint-text-primary)",
  badgeShadow: "var(--uilint-shadow)",
  highlightBorder: "oklch(0.585 0.233 283.04 / 80%)",
  highlightBg: "oklch(0.585 0.233 283.04 / 10%)",
  // Severity-based highlight colors
  error: "var(--uilint-error)",
  warning: "var(--uilint-warning)",
  info: "var(--uilint-accent)",
};

/**
 * Get badge color based on severity
 */
function getBadgeColor(severity: VisionIssue["severity"]): string {
  switch (severity) {
    case "error":
      return STYLES.badgeBg;
    case "warning":
      return STYLES.badgeBgWarning;
    case "info":
      return STYLES.badgeBgInfo;
    default:
      return STYLES.badgeBg;
  }
}

/**
 * Get highest severity from issues
 */
function getHighestSeverity(issues: VisionIssue[]): VisionIssue["severity"] {
  if (issues.some((i) => i.severity === "error")) return "error";
  if (issues.some((i) => i.severity === "warning")) return "warning";
  return "info";
}

interface VisionBadgeProps {
  element: Element;
  issues: VisionIssue[];
  isHighlighted: boolean;
  onBadgeClick: () => void;
}

/**
 * Single vision issue badge positioned on an element
 */
function VisionBadge({
  element,
  issues,
  isHighlighted,
  onBadgeClick,
}: VisionBadgeProps) {
  const rect = useMemo(() => {
    return element.getBoundingClientRect();
  }, [element]);

  const severity = getHighestSeverity(issues);
  const badgeColor = getBadgeColor(severity);

  // Get color for highlight border based on severity
  const highlightColor = useMemo(() => {
    switch (severity) {
      case "error":
        return STYLES.error;
      case "warning":
        return STYLES.warning;
      case "info":
        return STYLES.info;
      default:
        return STYLES.highlightBorder;
    }
  }, [severity]);

  // Position badge at top-right of element
  const badgeStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.top - 8,
    left: rect.right - 8,
    zIndex: 99997,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    borderRadius: "9px",
    backgroundColor: badgeColor,
    color: STYLES.badgeText,
    fontSize: "10px",
    fontWeight: 600,
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    boxShadow: STYLES.badgeShadow,
    cursor: "pointer",
    transition: "transform 0.15s ease",
    transform: isHighlighted ? "scale(1.2)" : "scale(1)",
    pointerEvents: "auto",
  };

  // Highlight overlay for the element
  const highlightStyle: React.CSSProperties = isHighlighted
    ? {
        position: "fixed",
        top: rect.top - 2,
        left: rect.left - 2,
        width: rect.width + 4,
        height: rect.height + 4,
        border: `2px solid ${highlightColor}`,
        backgroundColor: `${highlightColor}15`,
        borderRadius: "4px",
        zIndex: 99996,
        pointerEvents: "none",
      }
    : {};

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onBadgeClick();
    },
    [onBadgeClick]
  );

  return (
    <>
      {isHighlighted && <div style={highlightStyle} />}
      <div
        style={badgeStyle}
        onClick={handleClick}
        title={`${issues.length} vision issue${issues.length !== 1 ? "s" : ""}`}
        role="button"
        aria-label={`${issues.length} vision issues detected`}
      >
        {issues.length}
      </div>
    </>
  );
}

/**
 * Container component for all vision issue badges
 */
export function VisionIssueBadges() {
  const visionIssuesCache = useUILintStore(
    (s: UILintStore) => s.visionIssuesCache
  );
  const highlightedVisionElementId = useUILintStore(
    (s: UILintStore) => s.highlightedVisionElementId
  );
  const setHighlightedVisionElementId = useUILintStore(
    (s: UILintStore) => s.setHighlightedVisionElementId
  );

  // Group issues by elementId
  const issuesByElement = useMemo(() => {
    const map = new Map<string, VisionIssue[]>();

    visionIssuesCache.forEach((issues) => {
      issues.forEach((issue) => {
        if (issue.elementId) {
          const existing = map.get(issue.elementId) || [];
          existing.push(issue);
          map.set(issue.elementId, existing);
        }
      });
    });

    return map;
  }, [visionIssuesCache]);

  // Find elements and render badges
  const badges = useMemo(() => {
    const result: Array<{
      element: Element;
      issues: VisionIssue[];
      elementId: string;
    }> = [];

    issuesByElement.forEach((issues, elementId) => {
      // Try to find element by data-loc
      const dataLoc = issues[0]?.dataLoc;
      if (!dataLoc) return;

      // Try both formats (source location and runtime ID)
      let element = document.querySelector(`[${DATA_UILINT_ID}="${dataLoc}"]`);
      if (!element) {
        // Try with "loc:" prefix for runtime IDs
        element = document.querySelector(
          `[${DATA_UILINT_ID}^="loc:${dataLoc}"]`
        );
      }
      if (element && !element.closest("[data-ui-lint]")) {
        result.push({ element, issues, elementId });
      }
    });

    return result;
  }, [issuesByElement]);

  const handleBadgeClick = useCallback(
    (elementId: string) => {
      setHighlightedVisionElementId(
        highlightedVisionElementId === elementId ? null : elementId
      );
    },
    [highlightedVisionElementId, setHighlightedVisionElementId]
  );

  if (badges.length === 0) return null;

  return createPortal(
    <div data-ui-lint style={{ pointerEvents: "none" }}>
      {badges.map(({ element, issues, elementId }) => (
        <VisionBadge
          key={elementId}
          element={element}
          issues={issues}
          isHighlighted={highlightedVisionElementId === elementId}
          onBadgeClick={() => handleBadgeClick(elementId)}
        />
      ))}
    </div>,
    getUILintPortalHost()
  );
}

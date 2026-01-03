"use client";

/**
 * ElementBadges - Shows issue count badges on scanned elements
 *
 * Renders notification-style badges at the top-right corner of each
 * scanned element during auto-scan mode.
 */

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import type { ScannedElement, ElementIssue } from "./types";

/**
 * Design tokens
 */
const STYLES = {
  bg: "rgba(17, 24, 39, 0.95)",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  text: "#FFFFFF",
  border: "rgba(255, 255, 255, 0.2)",
  font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  shadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
};

/**
 * Get badge color based on issue count
 */
function getBadgeColor(issueCount: number): string {
  if (issueCount === 0) return STYLES.success;
  if (issueCount <= 2) return STYLES.warning;
  return STYLES.error;
}

/**
 * Badge for a single element
 */
interface ElementBadgeProps {
  element: ScannedElement;
  issue: ElementIssue;
}

function ElementBadge({ element, issue }: ElementBadgeProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Update rect on mount and on scroll/resize
  useEffect(() => {
    const updateRect = () => {
      if (element.element && document.contains(element.element)) {
        setRect(element.element.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };

    updateRect();

    // Use requestAnimationFrame for smooth updates
    let rafId: number;
    const handleUpdate = () => {
      updateRect();
      rafId = requestAnimationFrame(handleUpdate);
    };

    // Start watching
    rafId = requestAnimationFrame(handleUpdate);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [element.element]);

  if (!rect) return null;

  // Position at top-right corner of element
  const badgeStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.top - 8,
    left: rect.right - 8,
    zIndex: 99995,
    pointerEvents: "none",
  };

  // Don't show badges for elements that are not visible
  if (rect.top < -50 || rect.top > window.innerHeight + 50) return null;
  if (rect.left < -50 || rect.left > window.innerWidth + 50) return null;

  return (
    <div style={badgeStyle} data-ui-lint>
      {issue.status === "scanning" && <ScanningBadge />}
      {issue.status === "complete" && <IssueBadge count={issue.issues.length} />}
      {issue.status === "error" && <ErrorBadge />}
      {issue.status === "pending" && <PendingBadge />}
    </div>
  );
}

/**
 * Badge showing issue count or checkmark
 */
function IssueBadge({ count }: { count: number }) {
  const color = getBadgeColor(count);

  if (count === 0) {
    // Checkmark badge
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "18px",
          height: "18px",
          borderRadius: "50%",
          backgroundColor: color,
          boxShadow: STYLES.shadow,
          border: `1px solid ${STYLES.border}`,
        }}
      >
        <CheckIcon />
      </div>
    );
  }

  // Number badge
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: "18px",
        height: "18px",
        padding: "0 5px",
        borderRadius: "9px",
        backgroundColor: color,
        color: STYLES.text,
        fontSize: "10px",
        fontWeight: 700,
        fontFamily: STYLES.font,
        boxShadow: STYLES.shadow,
        border: `1px solid ${STYLES.border}`,
      }}
    >
      {count > 9 ? "9+" : count}
    </div>
  );
}

/**
 * Spinning badge for scanning state
 */
function ScanningBadge() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        backgroundColor: STYLES.bg,
        boxShadow: STYLES.shadow,
        border: `1px solid ${STYLES.border}`,
      }}
    >
      <style>{`
        @keyframes uilint-badge-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          width: "10px",
          height: "10px",
          border: "2px solid rgba(59, 130, 246, 0.3)",
          borderTopColor: "#3B82F6",
          borderRadius: "50%",
          animation: "uilint-badge-spin 0.8s linear infinite",
        }}
      />
    </div>
  );
}

/**
 * Small gray badge for pending state
 */
function PendingBadge() {
  return (
    <div
      style={{
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        backgroundColor: "rgba(156, 163, 175, 0.5)",
        boxShadow: STYLES.shadow,
      }}
    />
  );
}

/**
 * Error badge
 */
function ErrorBadge() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        backgroundColor: STYLES.error,
        boxShadow: STYLES.shadow,
        border: `1px solid ${STYLES.border}`,
      }}
    >
      <ExclamationIcon />
    </div>
  );
}

/**
 * Main ElementBadges component
 */
export function ElementBadges() {
  const { autoScanState, elementIssuesCache } = useUILintContext();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  if (autoScanState.status === "idle") return null;

  const content = (
    <div data-ui-lint>
      {autoScanState.elements.map((element) => {
        const issue = elementIssuesCache.get(element.id);
        if (!issue) return null;

        return (
          <ElementBadge key={element.id} element={element} issue={issue} />
        );
      })}
    </div>
  );

  return createPortal(content, document.body);
}

// Icons

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6L9 17l-5-5"
        stroke={STYLES.text}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExclamationIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 8v4M12 16h.01"
        stroke={STYLES.text}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

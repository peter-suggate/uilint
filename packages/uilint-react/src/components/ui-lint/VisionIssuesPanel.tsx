"use client";

/**
 * Vision Issues Panel
 *
 * Sidebar panel that displays vision-detected issues grouped by category.
 * Provides click-to-highlight functionality to locate elements in the page.
 */

import React, { useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUILintStore, type UILintStore } from "./store";
import type { VisionIssue } from "../../scanner/vision-capture";
import { getUILintPortalHost } from "./portal-host";
import { DATA_UILINT_ID } from "./types";

/**
 * Design tokens - uses CSS variables for theme support
 */
const STYLES = {
  bg: "var(--uilint-backdrop)",
  bgSurface: "var(--uilint-surface-elevated)",
  border: "var(--uilint-border)",
  text: "var(--uilint-text-primary)",
  textMuted: "var(--uilint-text-secondary)",
  textDim: "var(--uilint-text-muted)",
  // Category colors - keeping distinct for visual differentiation
  error: "var(--uilint-error)",
  warning: "var(--uilint-warning)",
  info: "var(--uilint-accent)",
  // Category-specific colors (these are semantic, not theme-dependent)
  spacing: "oklch(0.585 0.233 283.04)", // violet
  typography: "oklch(0.656 0.241 354.31)", // pink
  color: "var(--uilint-success)", // emerald
  alignment: "oklch(0.715 0.143 215.22)", // cyan
  layout: "oklch(0.702 0.191 41.12)", // orange
  contrast: "var(--uilint-error)", // red
  visualHierarchy: "oklch(0.627 0.265 303.9)", // purple
  other: "var(--uilint-text-muted)", // gray
  shadow: "var(--uilint-shadow)",
  blur: "blur(12px)",
  font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
};

const PANEL_WIDTH = 360;

/**
 * Get color for issue category
 */
function getCategoryColor(category: VisionIssue["category"]): string {
  switch (category) {
    case "spacing":
      return STYLES.spacing;
    case "typography":
      return STYLES.typography;
    case "color":
      return STYLES.color;
    case "alignment":
      return STYLES.alignment;
    case "layout":
      return STYLES.layout;
    case "contrast":
      return STYLES.contrast;
    case "visual-hierarchy":
      return STYLES.visualHierarchy;
    default:
      return STYLES.other;
  }
}

/**
 * Get color for severity
 */
function getSeverityColor(severity: VisionIssue["severity"]): string {
  switch (severity) {
    case "error":
      return STYLES.error;
    case "warning":
      return STYLES.warning;
    case "info":
      return STYLES.info;
    default:
      return STYLES.textMuted;
  }
}

/**
 * Category icon component
 */
function CategoryIcon({ category }: { category: VisionIssue["category"] }) {
  const color = getCategoryColor(category);

  switch (category) {
    case "spacing":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <path d="M21 6H3M21 12H3M21 18H3" />
        </svg>
      );
    case "typography":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      );
    case "color":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <circle cx="13.5" cy="6.5" r="0.5" fill={color} />
          <circle cx="17.5" cy="10.5" r="0.5" fill={color} />
          <circle cx="8.5" cy="7.5" r="0.5" fill={color} />
          <circle cx="6.5" cy="12.5" r="0.5" fill={color} />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
        </svg>
      );
    case "alignment":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <line x1="21" y1="10" x2="3" y2="10" />
          <line x1="21" y1="6" x2="3" y2="6" />
          <line x1="21" y1="14" x2="3" y2="14" />
          <line x1="21" y1="18" x2="3" y2="18" />
        </svg>
      );
    case "layout":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="9" x2="9" y2="21" />
        </svg>
      );
    case "contrast":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 0 0 20z" fill={color} opacity="0.2" />
        </svg>
      );
    case "visual-hierarchy":
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <path d="M12 2l7 7-7 7-7-7z" />
          <path d="M5 15l7 7 7-7" opacity="0.6" />
        </svg>
      );
    default:
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

/**
 * Severity badge
 */
function SeverityBadge({ severity }: { severity: VisionIssue["severity"] }) {
  const color = getSeverityColor(severity);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 6px",
        borderRadius: "4px",
        backgroundColor: `${color}20`,
        color,
        fontSize: "10px",
        fontWeight: 600,
        textTransform: "uppercase",
      }}
    >
      {severity}
    </span>
  );
}

interface VisionIssueItemProps {
  issue: VisionIssue;
  isHighlighted: boolean;
  onShowInPage: () => void;
  onOpenSource: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * Single issue item in the panel
 */
function VisionIssueItem({
  issue,
  isHighlighted,
  onShowInPage,
  onOpenSource,
  onMouseEnter,
  onMouseLeave,
}: VisionIssueItemProps) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        padding: "12px",
        borderRadius: "8px",
        backgroundColor: isHighlighted ? STYLES.bgSurface : "transparent",
        border: isHighlighted
          ? `1px solid ${STYLES.border}`
          : "1px solid transparent",
        transition: "all 0.15s",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <CategoryIcon category={issue.category} />
        <span
          style={{
            flex: 1,
            fontSize: "12px",
            fontWeight: 600,
            color: STYLES.text,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
          title={issue.elementText}
        >
          "{issue.elementText || "(no text)"}"
        </span>
        <SeverityBadge severity={issue.severity} />
      </div>

      {/* Message */}
      <p
        style={{
          margin: 0,
          fontSize: "12px",
          lineHeight: 1.5,
          color: STYLES.textMuted,
        }}
      >
        {issue.message}
      </p>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "10px",
        }}
      >
        <button
          onClick={onShowInPage}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            borderRadius: "4px",
            border: `1px solid ${STYLES.border}`,
            backgroundColor: "transparent",
            color: STYLES.textMuted,
            fontSize: "11px",
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = STYLES.bgSurface;
            e.currentTarget.style.color = STYLES.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = STYLES.textMuted;
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          Show in page
        </button>

        {issue.dataLoc && (
          <button
            onClick={onOpenSource}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              borderRadius: "4px",
              border: `1px solid ${STYLES.border}`,
              backgroundColor: "transparent",
              color: STYLES.textMuted,
              fontSize: "11px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = STYLES.bgSurface;
              e.currentTarget.style.color = STYLES.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = STYLES.textMuted;
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Open in Cursor
          </button>
        )}
      </div>
    </div>
  );
}

interface VisionIssuesPanelProps {
  show: boolean;
  onClose: () => void;
  /** If true, renders inline instead of as a portal */
  embedded?: boolean;
}

/**
 * Vision Issues Panel Component
 */
export function VisionIssuesPanel({
  show,
  onClose,
  embedded = false,
}: VisionIssuesPanelProps) {
  const visionIssuesCache = useUILintStore(
    (s: UILintStore) => s.visionIssuesCache
  );
  const visionResult = useUILintStore((s: UILintStore) => s.visionResult);
  const visionAnalyzing = useUILintStore((s: UILintStore) => s.visionAnalyzing);
  const visionProgressPhase = useUILintStore(
    (s: UILintStore) => s.visionProgressPhase
  );
  const visionLastError = useUILintStore((s: UILintStore) => s.visionLastError);
  const clearVisionLastError = useUILintStore(
    (s: UILintStore) => s.clearVisionLastError
  );
  const triggerVisionAnalysis = useUILintStore(
    (s: UILintStore) => s.triggerVisionAnalysis
  );
  const highlightedVisionElementId = useUILintStore(
    (s: UILintStore) => s.highlightedVisionElementId
  );
  const setHighlightedVisionElementId = useUILintStore(
    (s: UILintStore) => s.setHighlightedVisionElementId
  );
  const setHoveredVisionIssue = useUILintStore(
    (s: UILintStore) => s.setHoveredVisionIssue
  );
  const appRoot = useUILintStore((s: UILintStore) => s.appRoot);
  const workspaceRoot = useUILintStore((s: UILintStore) => s.workspaceRoot);

  // Flatten all issues
  const allIssues = useMemo(() => {
    const issues: VisionIssue[] = [];
    visionIssuesCache.forEach((routeIssues) => {
      issues.push(...routeIssues);
    });
    return issues;
  }, [visionIssuesCache]);

  // Group issues by category
  const issuesByCategory = useMemo(() => {
    const map = new Map<VisionIssue["category"], VisionIssue[]>();

    allIssues.forEach((issue) => {
      const existing = map.get(issue.category) || [];
      existing.push(issue);
      map.set(issue.category, existing);
    });

    return map;
  }, [allIssues]);

  const handleShowInPage = useCallback(
    (issue: VisionIssue) => {
      if (!issue.dataLoc) return;

      // Highlight the element
      setHighlightedVisionElementId(issue.elementId || null);

      // Scroll to element - try both formats (source location and runtime ID)
      let element = document.querySelector(`[${DATA_UILINT_ID}="${issue.dataLoc}"]`);
      if (!element) {
        // Try with "loc:" prefix for runtime IDs
        element = document.querySelector(`[${DATA_UILINT_ID}^="loc:${issue.dataLoc}"]`);
      }
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    },
    [setHighlightedVisionElementId]
  );

  const handleOpenSource = useCallback(
    (issue: VisionIssue) => {
      if (!issue.dataLoc) return;

      const [filePath, line, column] = issue.dataLoc.split(":");
      const baseDir = appRoot || workspaceRoot || "";
      const fullPath = filePath.startsWith("/")
        ? filePath
        : `${baseDir}/${filePath}`;

      const url = `cursor://file/${fullPath}:${line}:${column || 1}`;
      window.open(url, "_blank");
    },
    [appRoot, workspaceRoot]
  );

  if (!show) return null;

  const panelStyle: React.CSSProperties = embedded
    ? {
        position: "relative",
        width: PANEL_WIDTH,
        maxHeight: "60vh",
        backgroundColor: STYLES.bg,
        backdropFilter: STYLES.blur,
        WebkitBackdropFilter: STYLES.blur,
        border: `1px solid ${STYLES.border}`,
        borderRadius: "12px",
        boxShadow: STYLES.shadow,
        fontFamily: STYLES.font,
        color: STYLES.text,
        overflow: "hidden",
      }
    : {
        position: "fixed",
        bottom: "80px",
        left: "20px",
        width: PANEL_WIDTH,
        maxHeight: "60vh",
        backgroundColor: STYLES.bg,
        backdropFilter: STYLES.blur,
        WebkitBackdropFilter: STYLES.blur,
        border: `1px solid ${STYLES.border}`,
        borderRadius: "12px",
        boxShadow: STYLES.shadow,
        fontFamily: STYLES.font,
        color: STYLES.text,
        overflow: "hidden",
        zIndex: 99998,
        animation: "uilint-panel-appear 0.2s ease-out",
        pointerEvents: "auto",
      };

  const content = (
    <div data-ui-lint={!embedded ? true : undefined} style={panelStyle}>
      <style>{`
        @keyframes uilint-panel-appear {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: `1px solid ${STYLES.border}`,
          backgroundColor: STYLES.bgSurface,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={STYLES.spacing}
            strokeWidth="2"
          >
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>
            Vision Issues
          </span>
          {allIssues.length > 0 && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "20px",
                height: "20px",
                padding: "0 6px",
                borderRadius: "10px",
                backgroundColor: STYLES.warning,
                color: "#FFFFFF",
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {allIssues.length}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => triggerVisionAnalysis()}
            disabled={visionAnalyzing}
            title="Capture & Analyze Page"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              border: `1px solid ${STYLES.border}`,
              backgroundColor: visionAnalyzing ? "transparent" : STYLES.bg,
              color: visionLastError ? STYLES.error : STYLES.textMuted,
              cursor: visionAnalyzing ? "not-allowed" : "pointer",
              opacity: visionAnalyzing ? 0.6 : 1,
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              if (visionAnalyzing) return;
              e.currentTarget.style.backgroundColor = STYLES.bgSurface;
              e.currentTarget.style.color = STYLES.text;
            }}
            onMouseLeave={(e) => {
              if (visionAnalyzing) return;
              e.currentTarget.style.backgroundColor = STYLES.bg;
              e.currentTarget.style.color = visionLastError
                ? STYLES.error
                : STYLES.textMuted;
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          </button>

          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "26px",
              height: "26px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "transparent",
              color: STYLES.textMuted,
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = STYLES.bg;
              e.currentTarget.style.color = STYLES.text;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = STYLES.textMuted;
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          maxHeight: "calc(60vh - 60px)",
          overflowY: "auto",
          padding: "8px",
        }}
      >
        {/* Last error (compact + actionable) */}
        {visionLastError && !visionAnalyzing && (
          <div
            style={{
              margin: "6px 6px 10px",
              padding: "10px 10px",
              borderRadius: "10px",
              border: `1px solid ${STYLES.error}40`,
              backgroundColor: `${STYLES.error}12`,
              color: STYLES.text,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                marginBottom: "6px",
              }}
            >
              <div style={{ fontSize: "12px", fontWeight: 600 }}>
                Vision failed ({visionLastError.stage})
              </div>
              <button
                onClick={() => clearVisionLastError()}
                style={{
                  border: "none",
                  background: "transparent",
                  color: STYLES.textMuted,
                  cursor: "pointer",
                  fontSize: "12px",
                }}
                title="Dismiss"
              >
                Dismiss
              </button>
            </div>
            <div
              style={{
                fontSize: "12px",
                lineHeight: 1.4,
                color: STYLES.textMuted,
                wordBreak: "break-word",
                fontFamily: STYLES.fontMono,
              }}
            >
              {visionLastError.message}
            </div>
          </div>
        )}

        {/* Loading state */}
        {visionAnalyzing && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                border: `2px solid ${STYLES.border}`,
                borderTopColor: STYLES.spacing,
                borderRadius: "50%",
                animation: "uilint-spin 0.8s linear infinite",
              }}
            />
            <span style={{ color: STYLES.textMuted, fontSize: "13px" }}>
              {visionProgressPhase || "Analyzing..."}
            </span>
          </div>
        )}

        {/* Error state */}
        {visionResult?.error && !visionAnalyzing && (
          <div
            style={{
              padding: "16px",
              borderRadius: "8px",
              backgroundColor: `${STYLES.error}10`,
              border: `1px solid ${STYLES.error}30`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
                color: STYLES.error,
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              Analysis Error
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: STYLES.textMuted }}>
              {visionResult.error}
            </p>
          </div>
        )}

        {/* No issues state */}
        {!visionAnalyzing && allIssues.length === 0 && !visionResult?.error && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px",
              gap: "12px",
              textAlign: "center",
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={STYLES.textDim}
              strokeWidth="1.5"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            <p style={{ margin: 0, fontSize: "13px", color: STYLES.textMuted }}>
              No vision issues found.
              <br />
              Click the camera button to analyze the page.
            </p>
          </div>
        )}

        {/* Issues grouped by category */}
        {!visionAnalyzing &&
          allIssues.length > 0 &&
          Array.from(issuesByCategory.entries()).map(([category, issues]) => (
            <div key={category} style={{ marginBottom: "12px" }}>
              {/* Category header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  color: getCategoryColor(category),
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                <CategoryIcon category={category} />
                {category}
                <span
                  style={{
                    marginLeft: "auto",
                    color: STYLES.textDim,
                    fontWeight: 500,
                  }}
                >
                  {issues.length}
                </span>
              </div>

              {/* Issues */}
              {issues.map((issue, index) => (
                <VisionIssueItem
                  key={`${issue.elementId || index}`}
                  issue={issue}
                  isHighlighted={highlightedVisionElementId === issue.elementId}
                  onShowInPage={() => handleShowInPage(issue)}
                  onOpenSource={() => handleOpenSource(issue)}
                  onMouseEnter={() => setHoveredVisionIssue(issue)}
                  onMouseLeave={() => setHoveredVisionIssue(null)}
                />
              ))}
            </div>
          ))}
      </div>

      {/* Footer with analysis time */}
      {visionResult && !visionAnalyzing && (
        <div
          style={{
            padding: "10px 16px",
            borderTop: `1px solid ${STYLES.border}`,
            backgroundColor: STYLES.bgSurface,
            fontSize: "11px",
            color: STYLES.textDim,
          }}
        >
          Analyzed in {visionResult.analysisTime}ms
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return createPortal(content, getUILintPortalHost());
}

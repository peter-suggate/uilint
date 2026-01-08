"use client";

/**
 * Inspection Panel - Lightweight floating popover showing element issues
 * with inline code previews and "Open in Cursor" actions
 *
 * Positions near the clicked badge, avoiding overlap with the element itself.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { useUILintContext } from "./UILintProvider";
import { useUILintStore, type UILintStore } from "./store";
import { fetchSourceWithWindow } from "./source-fetcher";
import { buildEditorUrl } from "./dom-utils";
import type {
  InspectedElement,
  SourceLocation,
  ElementIssue,
  ESLintIssue,
} from "./types";

/**
 * Design tokens
 */
const STYLES = {
  bg: "rgba(17, 24, 39, 0.98)",
  bgSurface: "rgba(31, 41, 55, 0.95)",
  border: "rgba(75, 85, 99, 0.6)",
  text: "#F9FAFB",
  textMuted: "#9CA3AF",
  textDim: "#6B7280",
  accent: "#3B82F6",
  accentHover: "#2563EB",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  shadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
  blur: "blur(12px)",
  font: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
};

const POPOVER_WIDTH = 380;
const POPOVER_MAX_HEIGHT = 450;

/**
 * Main Inspection Panel Component - Floating Popover
 */
export function InspectionPanel() {
  const {
    inspectedElement,
    setInspectedElement,
    elementIssuesCache,
    autoScanState,
  } = useUILintContext();
  const appRoot = useUILintStore((s: UILintStore) => s.appRoot);
  const workspaceRoot = useUILintStore((s: UILintStore) => s.workspaceRoot);
  const editorBaseDir = appRoot || workspaceRoot;

  const [mounted, setMounted] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle click outside to close
  useEffect(() => {
    if (!inspectedElement) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element | null;
      // Ignore clicks on UILint UI elements
      if (target?.closest?.("[data-ui-lint]")) return;
      setInspectedElement(null);
    };

    // Delay adding listener to avoid immediate close from the badge click
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [inspectedElement, setInspectedElement]);

  // Find cached issue for this element from auto-scan
  const cachedIssue = useMemo((): ElementIssue | null => {
    if (!inspectedElement) return null;

    // First try to match by scannedElementId if available
    if (inspectedElement.scannedElementId) {
      const cached = elementIssuesCache.get(inspectedElement.scannedElementId);
      if (cached) return cached;
    }

    // Fallback: match by source file path
    if (inspectedElement.source) {
      for (const [, issue] of elementIssuesCache) {
        const scannedElement = autoScanState.elements.find(
          (el) => el.id === issue.elementId
        );
        if (
          scannedElement?.source?.fileName === inspectedElement.source.fileName
        ) {
          return issue;
        }
      }
    }

    return null;
  }, [inspectedElement, elementIssuesCache, autoScanState.elements]);

  const eslintIssues = useMemo(() => cachedIssue?.issues || [], [cachedIssue]);

  // Calculate popover position
  const position = useMemo(() => {
    if (!inspectedElement) return { top: 0, left: 0 };

    const { rect } = inspectedElement;
    const padding = 12;

    // Badge is at top-right of element
    // Popover appears to the RIGHT of the badge by default
    let left = rect.right + padding;
    let top = rect.top;

    // If popover would go off right edge, position to the left of the element
    if (left + POPOVER_WIDTH > window.innerWidth - padding) {
      left = rect.left - POPOVER_WIDTH - padding;
    }

    // If that would go off left edge, position below the element
    if (left < padding) {
      left = Math.max(padding, rect.left);
      top = rect.bottom + padding;
    }

    // Ensure popover stays within viewport vertically
    if (top + POPOVER_MAX_HEIGHT > window.innerHeight - padding) {
      top = Math.max(
        padding,
        window.innerHeight - POPOVER_MAX_HEIGHT - padding
      );
    }

    if (top < padding) {
      top = padding;
    }

    return { top, left };
  }, [inspectedElement]);

  if (!mounted || !inspectedElement) return null;

  const content = (
    <div
      ref={popoverRef}
      data-ui-lint
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        width: POPOVER_WIDTH,
        maxHeight: POPOVER_MAX_HEIGHT,
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
        animation: "uilint-popover-appear 0.15s ease-out",
      }}
    >
      <style>{`
        @keyframes uilint-popover-appear {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes uilint-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Header */}
      <PopoverHeader
        element={inspectedElement}
        issueCount={eslintIssues.length}
        workspaceRoot={editorBaseDir}
        onClose={() => setInspectedElement(null)}
      />

      {/* Content */}
      <div
        style={{
          maxHeight: POPOVER_MAX_HEIGHT - 60,
          overflowY: "auto",
        }}
      >
        {cachedIssue?.status === "scanning" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "20px",
                height: "20px",
                border: `2px solid ${STYLES.border}`,
                borderTopColor: STYLES.accent,
                borderRadius: "50%",
                animation: "uilint-spin 0.8s linear infinite",
              }}
            />
            <span style={{ color: STYLES.textMuted, fontSize: "13px" }}>
              Scanning...
            </span>
          </div>
        )}

        {cachedIssue?.status === "error" && (
          <div
            style={{
              padding: "16px",
              margin: "12px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: STYLES.error,
              fontSize: "12px",
              textAlign: "center",
            }}
          >
            Failed to analyze this element
          </div>
        )}

        {cachedIssue?.status === "complete" && eslintIssues.length === 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px",
              gap: "8px",
              color: STYLES.success,
              fontSize: "13px",
            }}
          >
            <CheckIcon />
            No issues found
          </div>
        )}

        {cachedIssue?.status === "complete" && eslintIssues.length > 0 && (
          <IssuesList
            issues={eslintIssues}
            source={inspectedElement.source}
            workspaceRoot={editorBaseDir}
          />
        )}

        {!cachedIssue && (
          <div
            style={{
              padding: "24px 16px",
              textAlign: "center",
              color: STYLES.textMuted,
              fontSize: "12px",
            }}
          >
            Enable live scanning to analyze this element
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

/**
 * Popover header with file name, issue count, and close button
 */
function PopoverHeader({
  element,
  issueCount,
  workspaceRoot,
  onClose,
}: {
  element: InspectedElement;
  issueCount: number;
  workspaceRoot: string | null;
  onClose: () => void;
}) {
  const fileName = element.source.fileName.split("/").pop() || "Unknown";
  const lineNumber = element.source.lineNumber;

  const handleOpenInCursor = useCallback(() => {
    const url = buildEditorUrl(element.source, "cursor", workspaceRoot);
    window.open(url, "_blank");
  }, [element.source, workspaceRoot]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        borderBottom: `1px solid ${STYLES.border}`,
        backgroundColor: STYLES.bgSurface,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            <span style={{ fontFamily: STYLES.fontMono }}>{fileName}</span>
            <span style={{ color: STYLES.textDim, fontWeight: 400 }}>
              :{lineNumber}
            </span>
          </div>
        </div>
        {issueCount > 0 && (
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
              fontWeight: 700,
            }}
          >
            {issueCount}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: "6px" }}>
        <button
          onClick={handleOpenInCursor}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "5px 8px",
            borderRadius: "6px",
            border: "none",
            backgroundColor: STYLES.accent,
            color: "#FFFFFF",
            fontSize: "11px",
            fontWeight: 500,
            cursor: "pointer",
            transition: "background-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = STYLES.accentHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = STYLES.accent;
          }}
          title="Open in Cursor"
        >
          <ExternalLinkIcon />
          Open in Cursor
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
            e.currentTarget.style.backgroundColor = STYLES.bgSurface;
            e.currentTarget.style.color = STYLES.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = STYLES.textMuted;
          }}
        >
          <CloseIcon />
        </button>
      </div>
    </div>
  );
}

/**
 * Issues list with expandable code previews
 */
function IssuesList({
  issues,
  source,
  workspaceRoot,
}: {
  issues: ESLintIssue[];
  source: SourceLocation;
  workspaceRoot: string | null;
}) {
  return (
    <div style={{ padding: "8px" }}>
      {issues.map((issue, index) => (
        <IssueCard
          key={index}
          issue={issue}
          source={source}
          workspaceRoot={workspaceRoot}
          isLast={index === issues.length - 1}
        />
      ))}
    </div>
  );
}

/**
 * Single issue card with code preview
 */
function IssueCard({
  issue,
  source,
  workspaceRoot,
  isLast,
}: {
  issue: ESLintIssue;
  source: SourceLocation;
  workspaceRoot: string | null;
  isLast: boolean;
}) {
  const [linesAbove, setLinesAbove] = useState(1);
  const [linesBelow, setLinesBelow] = useState(1);
  const [codeData, setCodeData] = useState<{
    lines: string[];
    startLine: number;
    highlightLine: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch source code for this issue
  useEffect(() => {
    const issueSource: SourceLocation = {
      fileName: source.fileName,
      lineNumber: issue.line,
      columnNumber: issue.column,
    };

    setLoading(true);
    fetchSourceWithWindow(issueSource, { linesAbove, linesBelow })
      .then((data) => {
        if (data) {
          setCodeData({
            lines: data.lines,
            startLine: data.startLine,
            highlightLine: data.highlightLine,
          });
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [source.fileName, issue.line, issue.column, linesAbove, linesBelow]);

  const handleOpenInCursor = useCallback(() => {
    const issueSource: SourceLocation = {
      fileName: source.fileName,
      lineNumber: issue.line,
      columnNumber: issue.column,
    };
    const url = buildEditorUrl(issueSource, "cursor", workspaceRoot);
    window.open(url, "_blank");
  }, [source.fileName, issue.line, issue.column, workspaceRoot]);

  return (
    <div
      style={{
        padding: "10px",
        marginBottom: isLast ? 0 : "8px",
        backgroundColor: STYLES.bgSurface,
        borderRadius: "8px",
        border: `1px solid ${STYLES.border}`,
      }}
    >
      {/* Issue message */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <WarningIcon />
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "12px",
              color: STYLES.text,
              lineHeight: 1.4,
              marginBottom: "4px",
            }}
          >
            {issue.message}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "10px",
              color: STYLES.textDim,
            }}
          >
            {issue.ruleId && (
              <span
                style={{
                  padding: "2px 5px",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  borderRadius: "4px",
                  color: STYLES.error,
                  fontFamily: STYLES.fontMono,
                }}
              >
                {issue.ruleId}
              </span>
            )}
            <span style={{ fontFamily: STYLES.fontMono }}>
              Line {issue.line}
              {issue.column ? `:${issue.column}` : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Code preview */}
      <div
        style={{
          backgroundColor: STYLES.bg,
          borderRadius: "6px",
          overflow: "hidden",
          border: `1px solid ${STYLES.border}`,
        }}
      >
        {/* Expand above */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "6px",
            borderBottom: `1px solid ${STYLES.border}`,
            backgroundColor: "rgba(17, 24, 39, 0.35)",
          }}
        >
          <button
            onClick={() => setLinesAbove((n) => n + 3)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 8px",
              borderRadius: "999px",
              border: `1px solid ${STYLES.border}`,
              backgroundColor: "transparent",
              color: STYLES.textMuted,
              fontSize: "10px",
              cursor: "pointer",
            }}
            title="Show more lines above"
          >
            <ChevronUpIcon />
            +3 above
          </button>
        </div>

        {loading ? (
          <div
            style={{
              padding: "12px",
              textAlign: "center",
              color: STYLES.textDim,
              fontSize: "11px",
            }}
          >
            Loading...
          </div>
        ) : codeData ? (
          <pre
            style={{
              margin: 0,
              padding: "8px 0",
              overflow: "auto",
              fontSize: "11px",
              lineHeight: "1.5",
              fontFamily: STYLES.fontMono,
            }}
          >
            {codeData.lines.map((line, index) => {
              const lineNumber = codeData.startLine + index;
              const isHighlight = lineNumber === codeData.highlightLine;

              return (
                <div
                  key={lineNumber}
                  style={{
                    display: "flex",
                    backgroundColor: isHighlight
                      ? "rgba(239, 68, 68, 0.15)"
                      : "transparent",
                    borderLeft: isHighlight
                      ? `2px solid ${STYLES.error}`
                      : "2px solid transparent",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: "36px",
                      paddingRight: "8px",
                      paddingLeft: "8px",
                      textAlign: "right",
                      color: isHighlight ? STYLES.error : STYLES.textDim,
                      userSelect: "none",
                      flexShrink: 0,
                    }}
                  >
                    {lineNumber}
                  </span>
                  <code
                    style={{
                      color: isHighlight ? STYLES.text : STYLES.textMuted,
                      whiteSpace: "pre",
                      paddingRight: "8px",
                    }}
                  >
                    {line || " "}
                  </code>
                </div>
              );
            })}
          </pre>
        ) : (
          <div
            style={{
              padding: "12px",
              textAlign: "center",
              color: STYLES.textDim,
              fontSize: "11px",
            }}
          >
            Could not load source
          </div>
        )}

        {/* Expand below */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "6px",
            borderTop: `1px solid ${STYLES.border}`,
            backgroundColor: "rgba(17, 24, 39, 0.35)",
          }}
        >
          <button
            onClick={() => setLinesBelow((n) => n + 3)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "3px 8px",
              borderRadius: "999px",
              border: `1px solid ${STYLES.border}`,
              backgroundColor: "transparent",
              color: STYLES.textMuted,
              fontSize: "10px",
              cursor: "pointer",
            }}
            title="Show more lines below"
          >
            +3 below
            <ChevronDownIcon />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "8px",
        }}
      >
        <button
          onClick={() => {
            setLinesAbove(1);
            setLinesBelow(1);
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            borderRadius: "4px",
            border: "none",
            backgroundColor: "transparent",
            color: STYLES.textMuted,
            fontSize: "10px",
            cursor: "pointer",
            transition: "color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = STYLES.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = STYLES.textMuted;
          }}
        >
          Reset context
        </button>

        <button
          onClick={handleOpenInCursor}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            borderRadius: "4px",
            border: "none",
            backgroundColor: "transparent",
            color: STYLES.accent,
            fontSize: "10px",
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.8";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
          }}
        >
          <ExternalLinkIcon />
          Open in Cursor
        </button>
      </div>
    </div>
  );
}

// Icons

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 6L6 18M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      style={{ flexShrink: 0, marginTop: "1px" }}
    >
      <path
        d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke={STYLES.warning}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <path
        d="M18 15l-6-6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

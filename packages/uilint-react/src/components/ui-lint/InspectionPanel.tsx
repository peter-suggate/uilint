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
import { dedentLines } from "./code-formatting";
import { computeInspectionPanelPosition } from "./inspection-panel-positioning";
import { Badge } from "./Badge";
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

const POPOVER_WIDTH = 450;
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
  const fileIssuesCache = useUILintStore((s: UILintStore) => s.fileIssuesCache);
  const appRoot = useUILintStore((s: UILintStore) => s.appRoot);
  const workspaceRoot = useUILintStore((s: UILintStore) => s.workspaceRoot);
  const editorBaseDir = appRoot || workspaceRoot;

  const [mounted, setMounted] = useState(false);
  const [showFullContext, setShowFullContext] = useState(true);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle click outside to close and cleanup dummy elements
  useEffect(() => {
    if (!inspectedElement) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element | null;
      // Ignore clicks on UILint UI elements
      if (target?.closest?.("[data-ui-lint]")) return;

      // Clean up dummy element if it's off-screen (file-level issue)
      const rect = inspectedElement.element.getBoundingClientRect();
      if (rect.top < -1000 || rect.left < -1000) {
        inspectedElement.element.remove();
      }

      setInspectedElement(null);
    };

    // Delay adding listener to avoid immediate close from the badge click
    // Use capture phase to check before app handlers, but still allow app to see the event
    const timer = setTimeout(() => {
      document.addEventListener("click", handleClickOutside, true);
    }, 50);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("click", handleClickOutside, true);
    };
  }, [inspectedElement, setInspectedElement]);

  // Check if this is a file-level issue (dummy element off-screen)
  const isFileLevelIssue = useMemo(() => {
    if (!inspectedElement) return false;
    const rect = inspectedElement.element.getBoundingClientRect();
    return rect.top < -1000 || rect.left < -1000;
  }, [inspectedElement]);

  // Find cached issue for this element from auto-scan, or file-level issues
  const cachedIssue = useMemo((): ElementIssue | null => {
    if (!inspectedElement) return null;

    // For file-level issues, check fileIssuesCache
    if (isFileLevelIssue && inspectedElement.source) {
      const fileIssues = fileIssuesCache.get(inspectedElement.source.fileName);
      if (fileIssues && fileIssues.length > 0) {
        // Filter to issues matching the line/column if specified
        const matchingIssues = fileIssues.filter((issue) => {
          if (issue.line !== inspectedElement.source.lineNumber) return false;
          if (
            inspectedElement.source.columnNumber &&
            issue.column !== inspectedElement.source.columnNumber
          ) {
            return false;
          }
          return true;
        });

        // Return a synthetic ElementIssue for file-level issues
        return {
          elementId: `file:${inspectedElement.source.fileName}`,
          issues: matchingIssues.length > 0 ? matchingIssues : fileIssues,
          status: "complete",
        };
      }
      return null;
    }

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
  }, [
    inspectedElement,
    elementIssuesCache,
    fileIssuesCache,
    autoScanState.elements,
    isFileLevelIssue,
  ]);

  const eslintIssues = useMemo(() => cachedIssue?.issues || [], [cachedIssue]);

  // Get line range for header display
  const lineRange = useMemo(() => {
    if (!eslintIssues.length) {
      return inspectedElement?.source.lineNumber.toString() || "0";
    }
    const lines = eslintIssues.map((i) => i.line).sort((a, b) => a - b);
    const min = lines[0];
    const max = lines[lines.length - 1];
    return min === max ? min.toString() : `${min}-${max}`;
  }, [eslintIssues, inspectedElement]);

  // Keep the popover positioned near the inspected element, updating on scroll/resize.
  useEffect(() => {
    if (!inspectedElement) return;

    let rafId: number | null = null;

    const update = () => {
      rafId = null;

      // For file-level issues, position to the right of the scan results popover
      if (isFileLevelIssue) {
        const measured = popoverRef.current
          ? {
              width: popoverRef.current.offsetWidth,
              height: popoverRef.current.offsetHeight,
            }
          : null;

        const popoverSize = measured ?? {
          width: POPOVER_WIDTH,
          height: POPOVER_MAX_HEIGHT,
        };

        // Find the scan results popover element
        // The ScanResultsPopover has data-ui-lint, width 320px, and position relative
        // Exclude this InspectionPanel itself (which is fixed)
        const allUILintElements = document.querySelectorAll("[data-ui-lint]");
        let scanResultsPopover: HTMLElement | null = null;

        for (const el of allUILintElements) {
          const htmlEl = el as HTMLElement;
          // Skip this InspectionPanel itself
          if (htmlEl === popoverRef.current) continue;

          const style = window.getComputedStyle(htmlEl);
          // ScanResultsPopover has width 320px (or close to it accounting for borders)
          const width = htmlEl.offsetWidth;
          const isRightWidth = width >= 310 && width <= 330;

          // It should be positioned relative (ScanResultsPopover) or absolute (container)
          // But NOT fixed (which is InspectionPanel)
          const isRightPosition =
            style.position === "relative" || style.position === "absolute";

          // Check if it's visible (has non-zero dimensions)
          const rect = htmlEl.getBoundingClientRect();
          const isVisible = rect.width > 0 && rect.height > 0;

          if (isRightWidth && isRightPosition && isVisible) {
            scanResultsPopover = htmlEl;
            break;
          }
        }

        const gap = 12;
        const padding = 12;

        if (scanResultsPopover) {
          const scanRect = scanResultsPopover.getBoundingClientRect();
          // Position to the right of scan results popover, top-aligned
          const left = scanRect.right + gap;
          const top = scanRect.top;

          // Ensure it doesn't go off the right edge
          const maxLeft = window.innerWidth - popoverSize.width - padding;
          const adjustedLeft = Math.min(left, maxLeft);

          // Ensure it doesn't go off the top edge
          const adjustedTop = Math.max(padding, top);

          setPosition({ top: adjustedTop, left: adjustedLeft });
        } else {
          // Fallback: position to the right side of viewport, top-aligned
          // This happens if scan results popover isn't found or isn't visible yet
          const top = padding;
          const left = Math.max(
            padding,
            window.innerWidth - popoverSize.width - padding
          );
          setPosition({ top, left });
        }
        return;
      }

      const rect = inspectedElement.element.getBoundingClientRect();

      const measured = popoverRef.current
        ? {
            width: popoverRef.current.offsetWidth,
            height: popoverRef.current.offsetHeight,
          }
        : null;

      const popoverSize = measured ?? {
        width: POPOVER_WIDTH,
        height: POPOVER_MAX_HEIGHT,
      };

      const next = computeInspectionPanelPosition({
        rect,
        popover: popoverSize,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        padding: 12,
      });

      setPosition({ top: next.top, left: next.left });
    };

    const schedule = () => {
      if (rafId != null) return;
      rafId = window.requestAnimationFrame(update);
    };

    // Initial + whenever content changes (e.g. showFullContext)
    schedule();

    // For file-level issues, also update on resize (in case scan results popover moves)
    // But don't listen to scroll since the popover is fixed relative to toolbar
    if (isFileLevelIssue) {
      window.addEventListener("resize", schedule);
    } else {
      window.addEventListener("scroll", schedule, true);
      window.addEventListener("resize", schedule);
    }

    return () => {
      if (rafId != null) window.cancelAnimationFrame(rafId);
      if (isFileLevelIssue) {
        window.removeEventListener("resize", schedule);
      } else {
        window.removeEventListener("scroll", schedule, true);
        window.removeEventListener("resize", schedule);
      }
    };
  }, [inspectedElement, showFullContext, isFileLevelIssue]);

  const handleOpenInCursor = useCallback(() => {
    if (!inspectedElement) return;
    const url = buildEditorUrl(
      inspectedElement.source,
      "cursor",
      editorBaseDir
    );
    window.open(url, "_blank");
  }, [inspectedElement, editorBaseDir]);

  // Event handlers to prevent UILint interactions from propagating to the app
  const handleUILintInteraction = useCallback(
    (e: React.MouseEvent | React.KeyboardEvent | React.PointerEvent) => {
      e.stopPropagation();
    },
    []
  );

  if (!mounted || !inspectedElement) return null;

  const content = (
    <div
      ref={popoverRef}
      data-ui-lint
      onMouseDown={handleUILintInteraction}
      onPointerDown={handleUILintInteraction}
      onClick={handleUILintInteraction}
      onKeyDown={handleUILintInteraction}
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
        pointerEvents: "auto", // Ensure panel is interactive
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
        lineRange={lineRange}
        onClose={() => setInspectedElement(null)}
      />

      {/* Content */}
      <div
        style={{
          maxHeight: POPOVER_MAX_HEIGHT - 120,
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
            showFullContext={showFullContext}
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

      {/* Footer */}
      {cachedIssue?.status === "complete" && eslintIssues.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            borderTop: `1px solid ${STYLES.border}`,
            backgroundColor: STYLES.bgSurface,
          }}
        >
          <button
            onClick={() => setShowFullContext(!showFullContext)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 10px",
              borderRadius: "6px",
              border: `1px solid ${STYLES.border}`,
              backgroundColor: "transparent",
              color: STYLES.textMuted,
              fontSize: "11px",
              fontWeight: 500,
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
            {showFullContext ? <CollapseIcon /> : <ExpandIcon />}
            {showFullContext ? "Hide context" : "Show full context"}
          </button>

          <button
            onClick={handleOpenInCursor}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "5px 10px",
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
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
}

/**
 * Popover header with file name:line range, issue count, and close button
 */
function PopoverHeader({
  element,
  issueCount,
  lineRange,
  onClose,
}: {
  element: InspectedElement;
  issueCount: number;
  lineRange: string;
  onClose: () => void;
}) {
  const fileName = element.source.fileName.split("/").pop() || "Unknown";

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
            :{lineRange}
          </span>
        </div>
        {issueCount > 0 && (
          <Badge count={issueCount} backgroundColor={STYLES.error} />
        )}
      </div>

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
        <CloseIcon />
      </button>
    </div>
  );
}

/**
 * Issues list with inline annotations
 */
function IssuesList({
  issues,
  source,
  showFullContext,
}: {
  issues: ESLintIssue[];
  source: SourceLocation;
  showFullContext: boolean;
}) {
  // Group issues by line number
  const issuesByLine = useMemo(() => {
    const map = new Map<number, ESLintIssue[]>();
    issues.forEach((issue) => {
      const existing = map.get(issue.line) || [];
      existing.push(issue);
      map.set(issue.line, existing);
    });
    return map;
  }, [issues]);

  const sortedLines = useMemo(
    () => Array.from(issuesByLine.keys()).sort((a, b) => a - b),
    [issuesByLine]
  );

  return (
    <div style={{ padding: "12px" }}>
      {sortedLines.map((lineNumber, index) => (
        <CodeBlockWithAnnotations
          key={lineNumber}
          lineNumber={lineNumber}
          issues={issuesByLine.get(lineNumber)!}
          source={source}
          showFullContext={showFullContext}
          isLast={index === sortedLines.length - 1}
        />
      ))}
    </div>
  );
}

/**
 * Code block with inline annotations (VS Code style)
 */
function CodeBlockWithAnnotations({
  lineNumber,
  issues,
  source,
  showFullContext,
  isLast,
}: {
  lineNumber: number;
  issues: ESLintIssue[];
  source: SourceLocation;
  showFullContext: boolean;
  isLast: boolean;
}) {
  const [codeData, setCodeData] = useState<{
    lines: string[];
    startLine: number;
    highlightLine: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const contextLines = showFullContext ? 5 : 0;

  // Fetch source code
  useEffect(() => {
    const issueSource: SourceLocation = {
      fileName: source.fileName,
      lineNumber: lineNumber,
      columnNumber: issues[0]?.column || 0,
    };

    setLoading(true);
    fetchSourceWithWindow(issueSource, {
      linesAbove: contextLines,
      linesBelow: contextLines,
    })
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
  }, [source.fileName, lineNumber, issues, contextLines]);

  return (
    <div
      style={{
        marginBottom: isLast ? 0 : "12px",
        backgroundColor: STYLES.bg,
        borderRadius: "8px",
        overflow: "hidden",
        border: `1px solid ${STYLES.border}`,
      }}
    >
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
        <div>
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
            {dedentLines(codeData.lines).lines.map((line, index) => {
              const currentLineNumber = codeData.startLine + index;
              const isHighlight = currentLineNumber === codeData.highlightLine;

              return (
                <React.Fragment key={currentLineNumber}>
                  <div
                    style={{
                      display: "flex",
                      backgroundColor: isHighlight
                        ? "rgba(239, 68, 68, 0.1)"
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
                      {currentLineNumber}
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
                  {isHighlight &&
                    issues.map((issue, issueIndex) => (
                      <InlineAnnotation key={issueIndex} issue={issue} />
                    ))}
                </React.Fragment>
              );
            })}
          </pre>
        </div>
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
    </div>
  );
}

/**
 * Inline annotation (VS Code style)
 */
function InlineAnnotation({ issue }: { issue: ESLintIssue }) {
  const ruleUrl = issue.ruleId
    ? `https://github.com/peter-suggate/uilint/blob/main/packages/uilint-eslint/src/rules/${issue.ruleId
        .split("/")
        .pop()}.ts`
    : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "8px",
        padding: "6px 8px 6px 46px",
        backgroundColor: "rgba(239, 68, 68, 0.08)",
        borderLeft: `2px solid ${STYLES.error}`,
      }}
    >
      <ErrorSquiggleIcon />
      <div style={{ flex: 1, fontSize: "11px", lineHeight: "1.4" }}>
        <span style={{ color: STYLES.text }}>{issue.message}</span>
        {issue.ruleId && (
          <>
            {" "}
            <a
              href={ruleUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: STYLES.textDim,
                textDecoration: "none",
                fontFamily: STYLES.fontMono,
                fontSize: "10px",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = STYLES.accent;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = STYLES.textDim;
              }}
            >
              ({issue.ruleId})
            </a>
          </>
        )}
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

function ErrorSquiggleIcon() {
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
        stroke={STYLES.error}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 14h6m0 0v6m0-6l-7 7m17-11h-6m0 0V4m0 6l7-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

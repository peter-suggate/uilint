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
import { useUILintStore, type UILintStore } from "./store";
import { getUILintPortalHost } from "./portal-host";
import { fetchSourceWithWindow } from "./source-fetcher";
import { buildEditorUrl } from "./dom-utils";
import { dedentLines } from "./code-formatting";
import { computeInspectionPanelPosition } from "./inspection-panel-positioning";
import { IssueCountBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PopoverHeader,
  PopoverBody,
  PopoverFooter,
} from "@/components/ui/popover";
import {
  Expandable,
  ExpandableTrigger,
  ExpandableContent,
} from "@/components/ui/expandable";
import { cn } from "@/lib/utils";
import type {
  InspectedElement,
  SourceLocation,
  ElementIssue,
  ESLintIssue,
} from "./types";

const POPOVER_WIDTH = 450;
const POPOVER_MAX_HEIGHT = 450;

/**
 * Main Inspection Panel Component - Floating Popover
 */
export function InspectionPanel() {
  const inspectedElement = useUILintStore(
    (s: UILintStore) => s.inspectedElement
  );
  const setInspectedElement = useUILintStore(
    (s: UILintStore) => s.setInspectedElement
  );
  const elementIssuesCache = useUILintStore(
    (s: UILintStore) => s.elementIssuesCache
  );
  const autoScanState = useUILintStore((s: UILintStore) => s.autoScanState);
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
      className="fixed w-[450px] max-h-[450px] overflow-hidden z-99998 pointer-events-auto bg-white/92 dark:bg-zinc-900/92 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {/* Header */}
      <InspectionPanelHeader
        element={inspectedElement}
        issueCount={eslintIssues.length}
        lineRange={lineRange}
        onClose={() => setInspectedElement(null)}
      />

      {/* Content */}
      <div className="max-h-[330px] overflow-y-auto">
        {cachedIssue?.status === "scanning" && (
          <div className="flex items-center justify-center py-8 gap-3">
            <div className="w-5 h-5 border-2 border-zinc-200 dark:border-zinc-800 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              Scanning...
            </span>
          </div>
        )}

        {cachedIssue?.status === "complete" && eslintIssues.length === 0 && (
          <div className="flex items-center justify-center py-8 gap-2 text-green-600 dark:text-green-400 text-sm">
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
          <div className="py-6 px-4 text-center text-zinc-500 dark:text-zinc-400 text-xs">
            Enable live scanning to analyze this element
          </div>
        )}
      </div>

      {/* Footer */}
      {cachedIssue?.status === "complete" && eslintIssues.length > 0 && (
        <PopoverFooter className="flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <Button
            onClick={() => setShowFullContext(!showFullContext)}
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5"
          >
            {showFullContext ? <CollapseIcon /> : <ExpandIcon />}
            {showFullContext ? "Hide context" : "Show full context"}
          </Button>

          <Button
            onClick={handleOpenInCursor}
            size="sm"
            className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <ExternalLinkIcon />
            Open in Cursor
          </Button>
        </PopoverFooter>
      )}
    </div>
  );

  return createPortal(content, getUILintPortalHost());
}

/**
 * Inspection Panel Header with file name:line range, issue count, and close button
 */
function InspectionPanelHeader({
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
    <PopoverHeader className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <span className="font-mono">{fileName}</span>
          <span className="text-zinc-500 dark:text-zinc-400 font-normal">
            :{lineRange}
          </span>
        </div>
        {issueCount > 0 && <IssueCountBadge count={issueCount} error />}
      </div>

      <Button onClick={onClose} variant="ghost" size="icon" className="h-6 w-6">
        <CloseIcon />
      </Button>
    </PopoverHeader>
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
    <div className="p-3">
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
      className={cn(
        "rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800",
        !isLast && "mb-3"
      )}
    >
      {loading ? (
        <div className="p-3 text-center text-zinc-400 dark:text-zinc-500 text-xs">
          Loading...
        </div>
      ) : codeData ? (
        <div>
          <pre className="m-0 py-2 overflow-auto text-xs leading-relaxed font-mono">
            {dedentLines(codeData.lines).lines.map((line, index) => {
              const currentLineNumber = codeData.startLine + index;
              const isHighlight = currentLineNumber === codeData.highlightLine;

              return (
                <React.Fragment key={currentLineNumber}>
                  <div
                    className={cn(
                      "flex",
                      isHighlight &&
                        "bg-red-500/10 border-l-2 border-l-red-600 dark:border-l-red-400"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block w-9 pr-2 pl-2 text-right select-none shrink-0",
                        isHighlight
                          ? "text-red-600 dark:text-red-400"
                          : "text-zinc-400 dark:text-zinc-500"
                      )}
                    >
                      {currentLineNumber}
                    </span>
                    <code
                      className={cn(
                        "whitespace-pre pr-2",
                        isHighlight
                          ? "text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-500 dark:text-zinc-400"
                      )}
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
        <div className="p-3 text-center text-zinc-400 dark:text-zinc-500 text-xs">
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
    <div className="flex items-start gap-2 py-1.5 px-2 pl-[46px] bg-red-500/8 border-l-2 border-l-red-600 dark:border-l-red-400">
      <ErrorSquiggleIcon />
      <div className="flex-1 text-xs leading-snug">
        <span className="text-zinc-900 dark:text-zinc-100">
          {issue.message}
        </span>
        {issue.ruleId && (
          <>
            {" "}
            <a
              href={ruleUrl || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 dark:text-zinc-500 font-mono text-[10px] no-underline hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
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
      className="shrink-0 mt-0.5"
    >
      <path
        d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-red-600 dark:text-red-400"
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

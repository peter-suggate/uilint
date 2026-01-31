/**
 * ScrollableCodeSection - Scroll-to-reveal code block with infinite scroll
 *
 * Features:
 * - Shows code with a labeled header
 * - Scroll up/down to dynamically load more lines
 * - Subtle fade at edges indicates more content
 * - Diff highlighting integrated with opacity-based styling
 * - File path clickable to navigate to file
 */
import React, { useRef, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { DiffLine } from "./useDiffHighlights";
import { getSegmentOpacity } from "./useDiffHighlights";
import { dedentLines } from "../../../components/ui-lint/code-formatting";

interface ScrollableCodeSectionProps {
  /** Section label ("This Code" | "Similar Code") */
  label: string;
  /** Icon to show next to label */
  icon: ReactNode;
  /** File path to display */
  filePath: string;
  /** Full source code string */
  code: string;
  /** Starting line number (1-indexed) */
  startLine: number;
  /** Ending line number (1-indexed) */
  endLine: number;
  /** Line to center on initially (1-indexed) */
  focusLine: number;
  /** Pre-computed diff highlights (optional) */
  diffLines?: DiffLine[];
  /** Callback when file path is clicked */
  onNavigate?: () => void;
  /** Maximum height for the code section */
  maxHeight?: number;
}

/** Number of lines to show initially */
const INITIAL_VISIBLE_LINES = 20;
/** Number of lines to load when scrolling */
const LOAD_CHUNK_SIZE = 20;
/** Line height in pixels */
const LINE_HEIGHT = 19.2; // 12px font * 1.6 line-height

export function ScrollableCodeSection({
  label,
  icon,
  filePath,
  code,
  startLine,
  endLine,
  focusLine,
  diffLines,
  onNavigate,
  maxHeight = 300,
}: ScrollableCodeSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);

  // Parse code into lines
  const allLines = code.split("\n");
  const totalLines = allLines.length;

  // Track visible range (0-indexed into allLines)
  const [visibleStart, setVisibleStart] = useState(() => {
    // Start centered on focusLine
    const focusIndex = focusLine - startLine;
    const halfVisible = Math.floor(INITIAL_VISIBLE_LINES / 2);
    return Math.max(0, Math.min(focusIndex - halfVisible, totalLines - INITIAL_VISIBLE_LINES));
  });
  const [visibleEnd, setVisibleEnd] = useState(() => {
    const start = Math.max(0, Math.min(focusLine - startLine - Math.floor(INITIAL_VISIBLE_LINES / 2), totalLines - INITIAL_VISIBLE_LINES));
    return Math.min(start + INITIAL_VISIBLE_LINES, totalLines);
  });

  // Dedent visible lines for cleaner display
  const visibleLines = allLines.slice(visibleStart, visibleEnd);
  const dedented = dedentLines(visibleLines);

  // Check if there's more content above/below
  const hasMoreAbove = visibleStart > 0;
  const hasMoreBelow = visibleEnd < totalLines;

  // Calculate gutter width
  const maxLineNumber = startLine + totalLines - 1;
  const gutterWidth = Math.max(3, String(maxLineNumber).length) * 8 + 16;

  // Load more lines when scrolling
  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;

    // Load more above when near top
    if (scrollTop < 50 && hasMoreAbove) {
      const newStart = Math.max(0, visibleStart - LOAD_CHUNK_SIZE);
      if (newStart < visibleStart) {
        // Calculate how much content we're adding
        const linesAdded = visibleStart - newStart;
        const heightAdded = linesAdded * LINE_HEIGHT;

        setVisibleStart(newStart);

        // Preserve scroll position after adding content above
        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = scrollTop + heightAdded;
          }
        });
      }
    }

    // Load more below when near bottom
    if (scrollTop + clientHeight > scrollHeight - 50 && hasMoreBelow) {
      const newEnd = Math.min(totalLines, visibleEnd + LOAD_CHUNK_SIZE);
      if (newEnd > visibleEnd) {
        setVisibleEnd(newEnd);
      }
    }
  }, [visibleStart, visibleEnd, hasMoreAbove, hasMoreBelow, totalLines]);

  // Scroll to focus line on mount
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Calculate position of focus line within visible range
    const focusIndex = focusLine - startLine - visibleStart;
    if (focusIndex >= 0 && focusIndex < visibleEnd - visibleStart) {
      const targetScroll = focusIndex * LINE_HEIGHT - container.clientHeight / 2 + LINE_HEIGHT / 2;
      container.scrollTop = Math.max(0, targetScroll);
    }
  }, []);

  // Get diff info for a line if available
  const getDiffLine = (lineIndex: number): DiffLine | undefined => {
    if (!diffLines) return undefined;
    const actualLineNumber = startLine + visibleStart + lineIndex;
    return diffLines.find((dl) => dl.lineNumber === actualLineNumber);
  };

  return (
    <div
      style={{
        background: "var(--uilint-background)",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--uilint-border)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "var(--uilint-surface-elevated)",
          borderBottom: "1px solid var(--uilint-border)",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", color: "var(--uilint-text-muted)" }}>
          {icon}
        </span>
        <span
          style={{
            fontWeight: 600,
            fontSize: 12,
            color: "var(--uilint-text-primary)",
          }}
        >
          {label}
        </span>
        <button
          onClick={onNavigate}
          style={{
            marginLeft: "auto",
            padding: "2px 6px",
            fontSize: 11,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            color: "var(--uilint-text-muted)",
            background: "transparent",
            border: "none",
            cursor: onNavigate ? "pointer" : "default",
            borderRadius: 4,
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => {
            if (onNavigate) e.currentTarget.style.background = "var(--uilint-surface)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {filePath}:{startLine}-{endLine}
        </button>
      </div>

      {/* Code container with scroll */}
      <div
        style={{
          position: "relative",
        }}
      >
        {/* Fade indicator - top */}
        {hasMoreAbove && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 24,
              background: "linear-gradient(to bottom, var(--uilint-background) 0%, transparent 100%)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
        )}

        {/* Scrollable code area */}
        <div
          ref={containerRef}
          onScroll={handleScroll}
          style={{
            maxHeight,
            overflowY: "auto",
            overflowX: "auto",
            fontSize: 12,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
            lineHeight: 1.6,
          }}
        >
          <div ref={codeRef}>
            {dedented.lines.map((lineContent, index) => {
              const actualLineNumber = startLine + visibleStart + index;
              const isHighlighted = actualLineNumber === focusLine;
              const diffLine = getDiffLine(index);

              return (
                <div
                  key={actualLineNumber}
                  style={{
                    display: "flex",
                    background: isHighlighted
                      ? "rgba(251, 191, 36, 0.12)"
                      : "transparent",
                    borderLeft: isHighlighted
                      ? "3px solid #f59e0b"
                      : "3px solid transparent",
                  }}
                >
                  {/* Line number gutter */}
                  <span
                    style={{
                      width: gutterWidth,
                      minWidth: gutterWidth,
                      padding: "0 8px",
                      textAlign: "right",
                      color: isHighlighted
                        ? "var(--uilint-text-primary)"
                        : "var(--uilint-text-disabled)",
                      background: "var(--uilint-surface-elevated)",
                      userSelect: "none",
                      flexShrink: 0,
                      borderRight: "1px solid var(--uilint-border)",
                    }}
                  >
                    {actualLineNumber}
                  </span>

                  {/* Code content with diff highlighting */}
                  <code
                    style={{
                      padding: "0 12px",
                      color: isHighlighted
                        ? "var(--uilint-text-primary)"
                        : "var(--uilint-text-secondary)",
                      whiteSpace: "pre",
                      flex: 1,
                    }}
                  >
                    {diffLine && diffLine.segments.length > 0 ? (
                      // Render with diff highlighting
                      diffLine.segments.map((segment, segIndex) => (
                        <span
                          key={segIndex}
                          style={{
                            opacity: getSegmentOpacity(segment.type),
                          }}
                        >
                          {segment.text}
                        </span>
                      ))
                    ) : (
                      // Render plain text
                      lineContent || " "
                    )}
                  </code>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fade indicator - bottom */}
        {hasMoreBelow && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 24,
              background: "linear-gradient(to top, var(--uilint-background) 0%, transparent 100%)",
              pointerEvents: "none",
              zIndex: 1,
            }}
          />
        )}
      </div>
    </div>
  );
}

export default ScrollableCodeSection;

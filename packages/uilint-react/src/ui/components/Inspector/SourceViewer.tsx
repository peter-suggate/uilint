/**
 * SourceViewer - Displays source code with line highlighting
 *
 * Features:
 * - Shows context lines around the issue
 * - Highlights the issue line with accent color
 * - Line numbers in gutter
 * - Collapsible
 * - Handles loading/error states
 */
import React, { useState } from "react";
import { ChevronDownIcon, ChevronRightIcon } from "../../icons";
import { useSourceCode } from "../../hooks/useSourceCode";
import { dedentLines } from "../../../components/ui-lint/code-formatting";

interface SourceViewerProps {
  filePath: string;
  line: number;
  column?: number;
  contextLines?: number;
  defaultExpanded?: boolean;
}

export function SourceViewer({
  filePath,
  line,
  column,
  contextLines = 5,
  defaultExpanded = true,
}: SourceViewerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const { context, isLoading, error } = useSourceCode({
    filePath,
    line,
    contextAbove: contextLines,
    contextBelow: contextLines,
    enabled: expanded,
  });

  // Dedent for cleaner display
  const dedented = context ? dedentLines(context.lines) : null;

  // Calculate gutter width based on max line number
  const maxLineNumber = context ? context.startLine + context.lines.length - 1 : 0;
  const gutterWidth = Math.max(3, String(maxLineNumber).length) * 8 + 16;

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
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          background: "var(--uilint-surface-elevated)",
          border: "none",
          borderBottom: expanded ? "1px solid var(--uilint-border)" : "none",
          cursor: "pointer",
          color: "var(--uilint-text-primary)",
          fontSize: 12,
          fontFamily: "inherit",
        }}
      >
        {expanded ? (
          <ChevronDownIcon size={14} />
        ) : (
          <ChevronRightIcon size={14} />
        )}
        <span style={{ fontWeight: 500 }}>Source</span>
        <span
          style={{
            color: "var(--uilint-text-muted)",
            marginLeft: "auto",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
          }}
        >
          L{line}
          {column ? `:${column}` : ""}
        </span>
      </button>

      {/* Content */}
      {expanded && (
        <div style={{ padding: 0 }}>
          {isLoading && (
            <div
              style={{
                padding: 24,
                color: "var(--uilint-text-muted)",
                textAlign: "center",
                fontSize: 12,
              }}
            >
              Loading...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: 24,
                color: "var(--uilint-error, #ef4444)",
                textAlign: "center",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          {dedented && context && (
            <div
              style={{
                overflowX: "auto",
                fontSize: 12,
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
                lineHeight: 1.6,
              }}
            >
              {dedented.lines.map((lineContent, index) => {
                const lineNumber = context.startLine + index;
                const isHighlighted = lineNumber === line;

                return (
                  <div
                    key={lineNumber}
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
                      {lineNumber}
                    </span>
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
                      {lineContent || " "}
                    </code>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

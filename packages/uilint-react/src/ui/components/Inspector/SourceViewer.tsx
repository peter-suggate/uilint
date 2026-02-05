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
import { cn } from "../../../lib/utils";

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
  const maxLineNumber = context
    ? context.startLine + context.lines.length - 1
    : 0;
  const gutterWidth = Math.max(3, String(maxLineNumber).length) * 8 + 16;

  return (
    <div className="bg-background rounded-lg overflow-hidden border border-border">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full flex items-center gap-2 py-2 px-3 bg-surface-elevated border-none cursor-pointer text-text-primary text-xs font-inherit",
          expanded && "border-b border-border"
        )}
      >
        {expanded ? (
          <ChevronDownIcon size={14} />
        ) : (
          <ChevronRightIcon size={14} />
        )}
        <span className="font-medium">Source</span>
        <span className="text-text-muted ml-auto font-mono">
          L{line}
          {column ? `:${column}` : ""}
        </span>
      </button>

      {/* Content */}
      {expanded && (
        <div className="p-0">
          {isLoading && (
            <div className="p-6 text-text-muted text-center text-xs">
              Loading...
            </div>
          )}

          {error && (
            <div className="p-6 text-error text-center text-xs">{error}</div>
          )}

          {dedented && context && (
            <div className="overflow-x-auto text-xs font-mono leading-relaxed">
              {dedented.lines.map((lineContent, index) => {
                const lineNumber = context.startLine + index;
                const isHighlighted = lineNumber === line;

                return (
                  <div
                    key={lineNumber}
                    className={cn(
                      "flex border-l-[3px]",
                      isHighlighted
                        ? "bg-[rgba(251,191,36,0.12)] border-l-[#fbbf24]"
                        : "bg-transparent border-l-transparent"
                    )}
                  >
                    <span
                      className={cn(
                        "py-0 px-2 text-right bg-surface-elevated select-none shrink-0 border-r border-border",
                        isHighlighted
                          ? "text-text-primary"
                          : "text-text-disabled"
                      )}
                      style={{
                        width: gutterWidth,
                        minWidth: gutterWidth,
                      }}
                    >
                      {lineNumber}
                    </span>
                    <code
                      className={cn(
                        "py-0 px-3 whitespace-pre flex-1",
                        isHighlighted
                          ? "text-text-primary"
                          : "text-text-secondary"
                      )}
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

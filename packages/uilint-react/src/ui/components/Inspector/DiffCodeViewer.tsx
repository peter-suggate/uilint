/**
 * DiffCodeViewer - Code viewer with line-level diff highlighting
 *
 * Displays code with lines classified as common, added, or removed.
 * Uses the design system's warning/info colors for diff highlighting.
 */
import React from "react";
import { cn } from "../../../lib/utils";
import type { DiffLine } from "./diff-utils";

interface DiffCodeViewerProps {
  lines: DiffLine[];
  label: string;
  maxHeight?: number;
  className?: string;
}

const LINE_TYPE_STYLES = {
  common: {
    bg: "bg-transparent",
    border: "border-l-transparent",
    gutter: "text-text-disabled",
    code: "text-text-secondary",
  },
  removed: {
    bg: "bg-warning-bg",
    border: "border-l-warning",
    gutter: "text-text-primary",
    code: "text-text-primary",
  },
  added: {
    bg: "bg-warning-bg",
    border: "border-l-warning",
    gutter: "text-text-primary",
    code: "text-text-primary",
  },
  modified: {
    bg: "bg-info-bg",
    border: "border-l-info",
    gutter: "text-text-primary",
    code: "text-text-primary",
  },
} as const;

export function DiffCodeViewer({
  lines,
  label,
  maxHeight = 250,
  className,
}: DiffCodeViewerProps) {
  const maxLineNumber = lines.length > 0
    ? Math.max(...lines.map((l) => l.lineNumber))
    : 0;
  const gutterWidth = Math.max(3, String(maxLineNumber).length) * 8 + 16;

  return (
    <div
      className={cn(
        "bg-background rounded-lg overflow-hidden border border-border",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 py-1.5 px-3 bg-surface-elevated border-b border-border">
        <span className="text-xs font-medium text-text-primary">{label}</span>
      </div>

      {/* Code lines */}
      <div
        className="overflow-auto text-xs font-mono leading-relaxed"
        style={{ maxHeight }}
      >
        {lines.map((line, index) => {
          const styles = LINE_TYPE_STYLES[line.type];
          return (
            <div
              key={index}
              className={cn("flex border-l-[3px]", styles.bg, styles.border)}
            >
              <span
                className={cn(
                  "py-0 px-2 text-right bg-surface-elevated select-none shrink-0 border-r border-border",
                  styles.gutter
                )}
                style={{ width: gutterWidth, minWidth: gutterWidth }}
              >
                {line.lineNumber}
              </span>
              <code
                className={cn("py-0 px-3 whitespace-pre flex-1", styles.code)}
              >
                {line.content || " "}
              </code>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DiffCodeViewer;

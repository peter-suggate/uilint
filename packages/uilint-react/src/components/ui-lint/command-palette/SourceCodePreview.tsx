"use client";

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";
import { fetchSourceWithContext } from "../source-fetcher";

interface SourceCodePreviewProps {
  filePath: string;
  lineNumber: number;
  columnNumber?: number;
  /** Whether to show context controls (default: true) */
  showControls?: boolean;
  /** Initial context lines (default: 3) */
  initialContextLines?: number;
  /** Maximum height of the preview (default: "max-h-64") */
  maxHeightClass?: string;
}

/**
 * Source code preview component with context controls
 */
export function SourceCodePreview({
  filePath,
  lineNumber,
  columnNumber,
  showControls = true,
  initialContextLines = 3,
  maxHeightClass = "max-h-64",
}: SourceCodePreviewProps) {
  const [sourceData, setSourceData] = useState<{
    lines: string[];
    startLine: number;
    highlightLine: number;
    relativePath: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [contextLines, setContextLines] = useState(initialContextLines);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const result = await fetchSourceWithContext(
          {
            fileName: filePath,
            lineNumber,
            columnNumber,
          },
          contextLines
        );
        if (!cancelled && result) {
          setSourceData(result);
        }
      } catch (e) {
        console.error("[SourceCodePreview] Failed to fetch source:", e);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [filePath, lineNumber, columnNumber, contextLines]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Icons.Spinner className="w-4 h-4 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (!sourceData) {
    return (
      <div className="text-xs text-muted-foreground py-4 text-center">
        Unable to load source code
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      className={cn(
        "rounded-lg overflow-hidden",
        "bg-surface",
        "border border-border"
      )}
    >
      {/* Context controls */}
      {showControls && (
        <div className="flex items-center justify-end gap-1 px-2 py-1.5 border-b border-border">
          <button
            onClick={() => setContextLines((c) => Math.max(1, c - 2))}
            disabled={contextLines <= 1}
            className={cn(
              "w-5 h-5 rounded flex items-center justify-center text-xs font-medium",
              "transition-colors duration-100",
              contextLines <= 1
                ? "text-text-disabled cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground hover:bg-hover"
            )}
            title="Show less context"
          >
            −
          </button>
          <span className="text-[10px] text-muted-foreground w-4 text-center tabular-nums">
            {contextLines}
          </span>
          <button
            onClick={() => setContextLines((c) => Math.min(15, c + 2))}
            disabled={contextLines >= 15}
            className={cn(
              "w-5 h-5 rounded flex items-center justify-center text-xs font-medium",
              "transition-colors duration-100",
              contextLines >= 15
                ? "text-text-disabled cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground hover:bg-hover"
            )}
            title="Show more context"
          >
            +
          </button>
        </div>
      )}
      {/* Code content */}
      <div className={cn("overflow-auto", maxHeightClass)}>
        <pre className="text-[11px] leading-5 font-mono">
          {sourceData.lines.map((line, idx) => {
            const lineNum = sourceData.startLine + idx;
            const isHighlighted = lineNum === sourceData.highlightLine;

            return (
              <div
                key={lineNum}
                className={cn(
                  "flex",
                  isHighlighted
                    ? "bg-active"
                    : "hover:bg-hover"
                )}
              >
                {/* Line number */}
                <span
                  className={cn(
                    "w-10 shrink-0 text-right pr-3 select-none",
                    isHighlighted
                      ? "text-text-secondary font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {lineNum}
                </span>
                {/* Code */}
                <code
                  className={cn(
                    "flex-1 pr-4",
                    isHighlighted
                      ? "text-foreground"
                      : "text-text-secondary"
                  )}
                >
                  {line || " "}
                </code>
              </div>
            );
          })}
        </pre>
      </div>
    </motion.div>
  );
}

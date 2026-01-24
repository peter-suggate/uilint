"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "../command-palette/icons";
import { fetchSource } from "../source-fetcher";

interface FullFileViewerProps {
  /** Path to the source file */
  filePath: string;
  /** Line number to highlight and scroll to */
  highlightLine?: number;
  /** Column number for additional highlighting */
  highlightColumn?: number;
  /** Additional class names */
  className?: string;
}

/**
 * Full file code viewer with line numbers and scroll-to-line
 * Loads and displays entire source files with syntax highlighting
 */
export function FullFileViewer({
  filePath,
  highlightLine,
  highlightColumn,
  className,
}: FullFileViewerProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relativePath, setRelativePath] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Load file content
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchSource(filePath);
        if (cancelled) return;

        if (!result) {
          setError("Unable to load source file");
          setLines([]);
        } else {
          setLines(result.content.split("\n"));
          setRelativePath(result.relativePath);
        }
      } catch (e) {
        if (!cancelled) {
          setError("Error loading source file");
          setLines([]);
        }
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
  }, [filePath]);

  // Scroll to highlighted line after content loads
  useEffect(() => {
    if (!loading && highlightLine && highlightRef.current) {
      // Small delay to ensure render is complete
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 100);
    }
  }, [loading, highlightLine]);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Icons.Spinner className="w-5 h-5 text-muted-foreground animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
        <Icons.AlertTriangle className="w-6 h-6 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <p className="text-xs text-muted-foreground mt-1 font-mono">{filePath}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full", className)} data-ui-lint>
      {/* File path header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/50">
        <Icons.File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-xs font-mono text-muted-foreground truncate">
          {relativePath || filePath}
        </span>
        {highlightLine && (
          <span className="text-xs text-muted-foreground">:{highlightLine}</span>
        )}
      </div>

      {/* Code content */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        <pre className="text-[11px] leading-5 font-mono min-w-fit">
          {lines.map((line, idx) => {
            const lineNum = idx + 1;
            const isHighlighted = lineNum === highlightLine;

            return (
              <div
                key={lineNum}
                ref={isHighlighted ? highlightRef : undefined}
                className={cn(
                  "flex",
                  isHighlighted ? "bg-active" : "hover:bg-hover"
                )}
              >
                {/* Line number - sticky */}
                <span
                  className={cn(
                    "w-12 shrink-0 text-right pr-3 select-none sticky left-0 bg-inherit",
                    isHighlighted
                      ? "text-text-secondary font-medium bg-active"
                      : "text-muted-foreground"
                  )}
                >
                  {lineNum}
                </span>
                {/* Code line */}
                <code
                  className={cn(
                    "flex-1 pr-4 whitespace-pre",
                    isHighlighted ? "text-foreground" : "text-text-secondary"
                  )}
                >
                  {line || " "}
                </code>
              </div>
            );
          })}
        </pre>
      </div>
    </div>
  );
}

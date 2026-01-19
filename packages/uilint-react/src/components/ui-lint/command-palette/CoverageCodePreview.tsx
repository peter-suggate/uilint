"use client";

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";
import { fetchSourceWithContext } from "../source-fetcher";
import { useUILintStore, type UILintStore } from "../store";
import type { IstanbulFileCoverage } from "./types";

interface CoverageCodePreviewProps {
  filePath: string;
  lineNumber: number;
  columnNumber?: number;
  /** Initial context lines (default: 5) */
  initialContextLines?: number;
  /** Maximum height of the preview (default: "max-h-96") */
  maxHeightClass?: string;
}

/**
 * Determine the coverage status of a line based on Istanbul statement data
 */
function getLineCoverageStatus(
  lineNumber: number,
  coverage: IstanbulFileCoverage | undefined
): "covered" | "uncovered" | "none" {
  if (!coverage) return "none";

  const { statementMap, s } = coverage;
  let hasStatement = false;
  let anyCovered = false;

  for (const [key, statement] of Object.entries(statementMap)) {
    // Check if this line is within the statement's range
    if (
      lineNumber >= statement.start.line &&
      lineNumber <= statement.end.line
    ) {
      hasStatement = true;
      if (s[key] > 0) {
        anyCovered = true;
        break; // Line is covered if ANY statement covering it is hit
      }
    }
  }

  if (!hasStatement) return "none";
  return anyCovered ? "covered" : "uncovered";
}

/**
 * Find coverage data for a file by matching paths
 */
function findCoverageForFile(
  filePath: string,
  coverageRawData: Map<string, IstanbulFileCoverage>
): IstanbulFileCoverage | undefined {
  // Try exact match first
  if (coverageRawData.has(filePath)) {
    return coverageRawData.get(filePath);
  }

  // Try suffix matching (coverage paths may be absolute while filePath is relative)
  for (const [coveragePath, data] of coverageRawData.entries()) {
    if (
      coveragePath.endsWith(filePath) ||
      filePath.endsWith(coveragePath.replace(/^\//, ""))
    ) {
      return data;
    }
  }

  return undefined;
}

/**
 * Source code preview component with line-level coverage highlighting
 */
export function CoverageCodePreview({
  filePath,
  lineNumber,
  columnNumber,
  initialContextLines = 5,
  maxHeightClass = "max-h-96",
}: CoverageCodePreviewProps) {
  const coverageRawData = useUILintStore((s: UILintStore) => s.coverageRawData);

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
        console.error("[CoverageCodePreview] Failed to fetch source:", e);
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

  const coverage = findCoverageForFile(filePath, coverageRawData);

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
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-border">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-green-500/30" />
            covered
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm bg-red-500/30" />
            uncovered
          </span>
        </div>
        <div className="flex items-center gap-1">
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
      </div>
      {/* Code content */}
      <div className={cn("overflow-auto", maxHeightClass)}>
        <pre className="text-[11px] leading-5 font-mono">
          {sourceData.lines.map((line, idx) => {
            const lineNum = sourceData.startLine + idx;
            const isHighlighted = lineNum === sourceData.highlightLine;
            const coverageStatus = getLineCoverageStatus(lineNum, coverage);

            return (
              <div
                key={lineNum}
                className={cn(
                  "flex",
                  // Coverage-based background colors
                  coverageStatus === "covered" && "bg-green-500/10",
                  coverageStatus === "uncovered" && "bg-red-500/10",
                  // Highlighted line gets stronger background
                  isHighlighted &&
                    coverageStatus === "covered" &&
                    "bg-green-500/20",
                  isHighlighted &&
                    coverageStatus === "uncovered" &&
                    "bg-red-500/20",
                  isHighlighted && coverageStatus === "none" && "bg-active",
                  // Hover effect for non-highlighted lines
                  !isHighlighted && "hover:bg-hover/50"
                )}
              >
                {/* Coverage indicator */}
                <span
                  className={cn(
                    "w-1 shrink-0",
                    coverageStatus === "covered" && "bg-green-500/50",
                    coverageStatus === "uncovered" && "bg-red-500/50"
                  )}
                />
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
    </motion.div>
  );
}

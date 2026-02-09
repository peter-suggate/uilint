/**
 * DuplicateComparison - Side-by-side or stacked code comparison for a duplicate pair.
 *
 * Extracts source/target code and locations from issue metadata,
 * computes a line-level diff, and renders both snippets with diff highlighting.
 */
import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Columns2, Rows2, ExternalLink, Filter, EyeOff } from "lucide-react";
import { cn } from "../../../lib/utils";
import { DiffCodeViewer } from "./DiffCodeViewer";
import { computeLineDiff } from "./diff-utils";
import { Badge } from "../primitives";
import type { Issue } from "../../types";

// ============================================================================
// Types
// ============================================================================

interface CodeLocation {
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface DuplicateComparisonProps {
  issue: Issue;
  onIgnore?: (issueId: string) => void;
  isIgnored?: boolean;
  className?: string;
}

// ============================================================================
// Helpers
// ============================================================================

function parseLocation(json: unknown): CodeLocation | null {
  if (typeof json !== "string") return null;
  try {
    const parsed = JSON.parse(json);
    return {
      filePath: parsed.filePath ?? "",
      startLine: parsed.startLine ?? 1,
      endLine: parsed.endLine ?? 1,
    };
  } catch {
    return null;
  }
}

function getFileName(filePath: string): string {
  const parts = filePath.split("/");
  return parts[parts.length - 1] || filePath;
}

function getSimilarityVariant(score: number): "error" | "warning" | "info" {
  if (score >= 90) return "error";
  if (score >= 80) return "warning";
  return "info";
}

// ============================================================================
// Component
// ============================================================================

export function DuplicateComparison({
  issue,
  onIgnore,
  isIgnored = false,
  className,
}: DuplicateComparisonProps) {
  const [mode, setMode] = useState<"stacked" | "side-by-side">("stacked");

  const meta = issue.metadata ?? {};
  const sourceCode = (meta.sourceCode as string) || "";
  const targetCode = (meta.targetCode as string) || "";
  const sourceName = (meta.sourceName as string) || "(anonymous)";
  const targetName = (meta.targetName as string) || "(anonymous)";
  const similarity = parseInt((meta.similarity as string) || "0", 10);
  const kind = (meta.kind as string) || "code";

  const sourceLoc = parseLocation(meta.sourceLocation);
  const targetLoc = parseLocation(meta.targetLocation);

  const diff = useMemo(
    () =>
      computeLineDiff(
        sourceCode,
        targetCode,
        sourceLoc?.startLine ?? 1,
        targetLoc?.startLine ?? 1
      ),
    [sourceCode, targetCode, sourceLoc?.startLine, targetLoc?.startLine]
  );

  if (!sourceCode && !targetCode) {
    return (
      <div className="p-6 text-center text-muted-foreground text-xs">
        No code comparison data available for this issue.
      </div>
    );
  }

  const isSideBySide = mode === "side-by-side";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isIgnored ? 0.4 : 1 }}
      transition={{ duration: 0.15 }}
      className={cn("flex flex-col gap-3", className)}
    >
      {/* Header: similarity + kind + mode toggle */}
      <div className="flex items-center gap-2 px-1">
        <Badge
          variant={getSimilarityVariant(similarity)}
          size="sm"
          disableAnimation
        >
          {similarity}% similar
        </Badge>
        <span className="text-[11px] text-muted-foreground">{kind}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setMode("stacked")}
            className={cn(
              "p-1 rounded transition-colors",
              !isSideBySide
                ? "bg-foreground/[0.08] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Stacked view"
          >
            <Rows2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => setMode("side-by-side")}
            className={cn(
              "p-1 rounded transition-colors",
              isSideBySide
                ? "bg-foreground/[0.08] text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            title="Side by side view"
          >
            <Columns2 size={14} />
          </button>
        </div>
      </div>

      {/* Code comparison */}
      <div
        className={cn(
          isSideBySide ? "grid grid-cols-2 gap-3" : "flex flex-col gap-3"
        )}
      >
        {/* Source panel */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-xs font-medium text-text-primary truncate">
              {sourceName}
            </span>
            {sourceLoc && (
              <span className="text-[11px] text-muted-foreground font-mono truncate">
                {getFileName(sourceLoc.filePath)}:{sourceLoc.startLine}
              </span>
            )}
          </div>
          <DiffCodeViewer
            lines={diff.sourceLines}
            label="This Code"
            maxHeight={isSideBySide ? 300 : 220}
          />
        </div>

        {/* Target panel */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 px-1">
            <span className="text-xs font-medium text-text-primary truncate">
              {targetName}
            </span>
            {targetLoc && (
              <span className="text-[11px] text-muted-foreground font-mono truncate">
                {getFileName(targetLoc.filePath)}:{targetLoc.startLine}
              </span>
            )}
          </div>
          <DiffCodeViewer
            lines={diff.targetLines}
            label="Similar Code"
            maxHeight={isSideBySide ? 300 : 220}
          />
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-1">
        {sourceLoc && (
          <ActionLink
            icon={<ExternalLink size={12} />}
            label={`Open ${sourceName}`}
            href={sourceLoc.filePath}
          />
        )}
        {targetLoc && (
          <ActionLink
            icon={<ExternalLink size={12} />}
            label={`Open ${targetName}`}
            href={targetLoc.filePath}
          />
        )}
        <div className="flex-1" />
        {onIgnore && (
          <button
            type="button"
            onClick={() => onIgnore(issue.id)}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded",
              "text-[11px] transition-colors",
              isIgnored
                ? "text-foreground/80 bg-foreground/[0.06]"
                : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
            )}
          >
            {isIgnored ? <Filter size={12} /> : <EyeOff size={12} />}
            {isIgnored ? "Restore" : "Ignore"}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function ActionLink({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 truncate"
      title={href}
    >
      {icon}
      <span className="truncate">{label}</span>
    </span>
  );
}

export default DuplicateComparison;

/**
 * FilePill - Small pill showing a file name.
 *
 * Hover triggers heatmap preview for that file within the current rule.
 * Click expands the rule and pre-selects the file.
 */
import React, { useCallback } from "react";
import { cn } from "../../../lib/utils";
import { useComposedStore } from "../../../core/store";

export interface FilePillProps {
  fileName: string;
  filePath: string;
  ruleId: string;
  issueCount: number;
  className?: string;
  onClick?: () => void;
}

export function FilePill({
  fileName,
  filePath,
  ruleId,
  issueCount,
  className,
  onClick,
}: FilePillProps) {
  const setHeatmapPreview = useComposedStore((s) => s.setHeatmapPreview);
  const clearHeatmapPreview = useComposedStore((s) => s.clearHeatmapPreview);

  const handleMouseEnter = useCallback(() => {
    setHeatmapPreview(ruleId, filePath);
  }, [setHeatmapPreview, ruleId, filePath]);

  const handleMouseLeave = useCallback(() => {
    clearHeatmapPreview();
  }, [clearHeatmapPreview]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      e.stopPropagation();
      onClick?.();
    },
    [onClick]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }
    },
    [onClick]
  );

  return (
    <span
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "inline-flex items-center gap-1",
        "px-1.5 py-0.5 rounded",
        "text-[11px] text-muted-foreground/50",
        "hover:text-foreground/70 hover:bg-foreground/4",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/25 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "transition-colors duration-75",
        onClick ? "cursor-pointer" : "cursor-default",
        className
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      title={`${filePath} (${issueCount} issue${issueCount !== 1 ? "s" : ""})`}
      aria-label={`${fileName} (${issueCount} issue${
        issueCount !== 1 ? "s" : ""
      })`}
    >
      {fileName}
      <span className="text-muted-foreground/30 tabular-nums">
        {issueCount}
      </span>
    </span>
  );
}

/**
 * TreemapCell - Individual cell in the zoomable treemap
 *
 * A colored rectangle that encodes:
 * - Area → issue count (handled by layout algorithm)
 * - Color → severity (red=error, amber=warning, blue=info)
 * - Opacity → relative importance (areaFraction)
 *
 * Content adapts to cell dimensions:
 * - Large: label + count + fileCount
 * - Medium: truncated label + count
 * - Small: colored rectangle only (tooltip on hover)
 */
import React, { useMemo } from "react";
import { motion } from "motion/react";
import { cn } from "../../../lib/utils";
import {
  treemapCellVariants,
  treemapCellTransition,
  ghostCellVariants,
  getCellStaggerDelay,
} from "./animations/treemap-animations";

// ============================================================================
// Types
// ============================================================================

export interface TreemapCellProps {
  id: string;
  label: string;
  subtitle?: string;
  count: number;
  fileCount?: number;
  severityCounts?: { error: number; warning: number; info: number };
  /** Cell position and dimensions (absolute) */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Normalized value fraction (0-1) for intensity */
  areaFraction: number;
  /** Whether this cell is the currently zoomed one */
  isZoomed?: boolean;
  /** Stagger index for entrance animation */
  index?: number;
  onClick: () => void;
  className?: string;
  /** Framer Motion layoutId for cross-view spatial animations */
  layoutId?: string;
  /** Ghost mode: invisible, non-interactive, no content — just a positioned anchor for layoutId */
  ghost?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum dimensions for showing different content levels */
const LABEL_MIN_WIDTH = 60;
const LABEL_MIN_HEIGHT = 50;
const FULL_CONTENT_MIN_WIDTH = 120;
const FULL_CONTENT_MIN_HEIGHT = 70;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Determine the dominant severity and return Tailwind color classes.
 */
function getSeverityStyles(severityCounts?: {
  error: number;
  warning: number;
  info: number;
}): { bg: string; text: string; border: string } {
  if (!severityCounts) {
    return {
      bg: "bg-foreground/[0.04]",
      text: "text-foreground/70",
      border: "border-foreground/[0.04]",
    };
  }

  const { error, warning, info } = severityCounts;

  if (error > 0 && error >= warning && error >= info) {
    return {
      bg: "bg-error/10",
      text: "text-error",
      border: "border-foreground/[0.04]",
    };
  }
  if (warning > 0 && warning >= info) {
    return {
      bg: "bg-warning/10",
      text: "text-warning",
      border: "border-foreground/[0.04]",
    };
  }
  if (info > 0) {
    return {
      bg: "bg-info/10",
      text: "text-info",
      border: "border-foreground/[0.04]",
    };
  }
  return {
    bg: "bg-foreground/[0.04]",
    text: "text-foreground/70",
    border: "border-foreground/[0.04]",
  };
}

/**
 * Get opacity scale based on area fraction.
 * Range: 0.6 (smallest) to 1.0 (largest)
 */
function getIntensityOpacity(areaFraction: number): number {
  return 0.6 + areaFraction * 0.4;
}

/**
 * Determine what content level to show based on cell dimensions.
 */
function getContentLevel(
  width: number,
  height: number
): "full" | "compact" | "minimal" {
  if (width >= FULL_CONTENT_MIN_WIDTH && height >= FULL_CONTENT_MIN_HEIGHT) {
    return "full";
  }
  if (width >= LABEL_MIN_WIDTH && height >= LABEL_MIN_HEIGHT) {
    return "compact";
  }
  return "minimal";
}

// ============================================================================
// Content Renderers
// ============================================================================

function FullContent({
  label,
  subtitle,
  count,
  fileCount,
  textClass,
}: {
  label: string;
  subtitle?: string;
  count: number;
  fileCount?: number;
  textClass: string;
}) {
  const issueWord = count === 1 ? "issue" : "issues";
  const fileSuffix =
    fileCount !== undefined && fileCount > 0
      ? ` in ${fileCount} ${fileCount === 1 ? "file" : "files"}`
      : "";

  return (
    <div className="flex flex-col justify-between h-full p-2 overflow-hidden">
      <div className="min-w-0">
        {subtitle && (
          <div className="text-[9px] text-muted-foreground/50 truncate mb-0.5 font-mono">
            {subtitle}
          </div>
        )}
        <div className={cn("text-xs font-light truncate", textClass)} title={label}>
          {label}
        </div>
      </div>
      <div className="flex items-baseline gap-1 mt-auto">
        <span className={cn("text-sm font-light tabular-nums", textClass)}>
          {count}
        </span>
        <span className="text-[9px] text-muted-foreground/50">
          {issueWord}{fileSuffix}
        </span>
      </div>
    </div>
  );
}

function CompactContent({
  label,
  count,
  textClass,
}: {
  label: string;
  count: number;
  textClass: string;
}) {
  return (
    <div className="flex flex-col justify-between h-full p-1.5 overflow-hidden">
      <div className={cn("text-[10px] font-light truncate", textClass)} title={label}>
        {label}
      </div>
      <div className={cn("text-xs font-light tabular-nums", textClass)}>
        {count}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function TreemapCell({
  id,
  label,
  subtitle,
  count,
  fileCount,
  severityCounts,
  x,
  y,
  width,
  height,
  areaFraction,
  isZoomed,
  index = 0,
  onClick,
  className,
  layoutId,
  ghost,
}: TreemapCellProps) {
  const styles = useMemo(() => getSeverityStyles(severityCounts), [severityCounts]);
  const contentLevel = useMemo(() => getContentLevel(width, height), [width, height]);
  const opacity = useMemo(() => getIntensityOpacity(areaFraction), [areaFraction]);

  return (
    <motion.div
      data-treemap-cell={id}
      layoutId={layoutId}
      variants={ghost ? ghostCellVariants : treemapCellVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={
        ghost
          ? { duration: 0.01 }
          : {
              ...treemapCellTransition,
              delay: getCellStaggerDelay(index),
            }
      }
      onClick={ghost ? undefined : onClick}
      whileHover={ghost ? undefined : { scale: 1.01 }}
      whileTap={ghost ? undefined : { scale: 0.98 }}
      title={
        ghost
          ? undefined
          : contentLevel === "minimal"
            ? `${label}: ${count}`
            : undefined
      }
      className={cn(
        "absolute overflow-hidden",
        ghost
          ? "pointer-events-none"
          : cn(
              "rounded-xl cursor-pointer",
              "border transition-[background,border-color] duration-100",
              styles.bg,
              styles.border,
              isZoomed && "ring-1 ring-foreground/20",
              "hover:bg-foreground/[0.03] hover:border-foreground/[0.08]"
            ),
        className
      )}
      style={{
        left: x,
        top: y,
        width,
        height,
        opacity: ghost ? 0 : opacity,
      }}
    >
      {!ghost && contentLevel === "full" && (
        <FullContent
          label={label}
          subtitle={subtitle}
          count={count}
          fileCount={fileCount}
          textClass={styles.text}
        />
      )}
      {!ghost && contentLevel === "compact" && (
        <CompactContent label={label} count={count} textClass={styles.text} />
      )}
    </motion.div>
  );
}

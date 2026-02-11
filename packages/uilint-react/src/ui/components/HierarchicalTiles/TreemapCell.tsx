/**
 * TreemapCell - Individual cell in the zoomable treemap
 *
 * Glassmorphic design matching the rest of the application:
 * - Translucent background with backdrop blur
 * - Severity encoded as a colored left-edge accent strip
 * - Supports nested children (e.g., file cells inside rule cells)
 *
 * Content adapts to cell dimensions:
 * - Large: label + count + fileCount + nested children
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
  /** Nested content rendered below the cell header (e.g., file mini-cells inside a rule cell) */
  children?: React.ReactNode;
}

// ============================================================================
// Constants
// ============================================================================

/** Minimum dimensions for showing different content levels */
const LABEL_MIN_WIDTH = 60;
const LABEL_MIN_HEIGHT = 50;
const FULL_CONTENT_MIN_WIDTH = 120;
const FULL_CONTENT_MIN_HEIGHT = 70;
/** Height reserved for the compact header when children are present */
const HEADER_HEIGHT = 28;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Determine the dominant severity and return accent color class for the left strip.
 */
function getSeverityAccent(severityCounts?: {
  error: number;
  warning: number;
  info: number;
}): string {
  if (!severityCounts) return "bg-foreground/10";

  const { error, warning, info } = severityCounts;
  if (error > 0 && error >= warning && error >= info) return "bg-error";
  if (warning > 0 && warning >= info) return "bg-warning";
  if (info > 0) return "bg-info";
  return "bg-foreground/10";
}

/**
 * Determine the dominant severity text color.
 */
function getSeverityTextColor(severityCounts?: {
  error: number;
  warning: number;
  info: number;
}): string {
  if (!severityCounts) return "text-foreground/70";

  const { error, warning, info } = severityCounts;
  if (error > 0 && error >= warning && error >= info) return "text-error";
  if (warning > 0 && warning >= info) return "text-warning";
  if (info > 0) return "text-info";
  return "text-foreground/70";
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
  hasChildren,
}: {
  label: string;
  subtitle?: string;
  count: number;
  fileCount?: number;
  textClass: string;
  hasChildren: boolean;
}) {
  const issueWord = count === 1 ? "issue" : "issues";
  const fileSuffix =
    fileCount !== undefined && fileCount > 0
      ? ` in ${fileCount} ${fileCount === 1 ? "file" : "files"}`
      : "";

  // When children are present, render a compact single-line header
  if (hasChildren) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 min-w-0" style={{ height: HEADER_HEIGHT }}>
        <span className={cn("text-[10px] font-medium truncate", textClass)} title={label}>
          {label}
        </span>
        <span className="text-[9px] text-muted-foreground/50 tabular-nums shrink-0">
          {count}
        </span>
      </div>
    );
  }

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
  areaFraction: _areaFraction,
  isZoomed,
  index = 0,
  onClick,
  className,
  layoutId,
  ghost,
  children,
}: TreemapCellProps) {
  const accentClass = useMemo(() => getSeverityAccent(severityCounts), [severityCounts]);
  const textClass = useMemo(() => getSeverityTextColor(severityCounts), [severityCounts]);
  const contentLevel = useMemo(() => getContentLevel(width, height), [width, height]);
  const hasChildren = !!children;

  // For cells with children, compute available height for the children area
  const childrenHeight = hasChildren && contentLevel === "full"
    ? Math.max(height - HEADER_HEIGHT, 0)
    : 0;

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
              "border border-foreground/[0.06]",
              "bg-background/40 backdrop-blur-sm",
              "transition-all duration-100",
              isZoomed && "ring-1 ring-foreground/20",
              "hover:bg-background/50 hover:border-foreground/[0.1]"
            ),
        className
      )}
      style={{
        left: x,
        top: y,
        width,
        height,
        opacity: ghost ? 0 : undefined,
      }}
    >
      {/* Severity accent strip on the left edge */}
      {!ghost && contentLevel !== "minimal" && (
        <div
          className={cn("absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl", accentClass)}
        />
      )}

      {!ghost && contentLevel === "full" && (
        <FullContent
          label={label}
          subtitle={subtitle}
          count={count}
          fileCount={fileCount}
          textClass={textClass}
          hasChildren={hasChildren}
        />
      )}
      {!ghost && contentLevel === "compact" && (
        <CompactContent label={label} count={count} textClass={textClass} />
      )}

      {/* Nested children (e.g., file cells inside a rule cell) */}
      {!ghost && hasChildren && contentLevel === "full" && (
        <div
          className="relative overflow-hidden mx-0.5 mb-0.5"
          style={{ height: childrenHeight }}
        >
          {children}
        </div>
      )}
    </motion.div>
  );
}

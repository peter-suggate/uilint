/**
 * ContextStrip - Proportional sibling strip for treemap zoom navigation
 *
 * Displays a horizontal strip of compressed sibling items when zoomed into
 * a treemap cell. Each item's width is proportional to its value (count),
 * providing spatial context while allowing quick navigation between siblings.
 */
import React, { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import {
  crispEase,
  DURATIONS,
} from "./animations/expansion-animations";
import {
  contextStripVariants,
  contextStripTransition,
} from "./animations/treemap-animations";

// ============================================================================
// Types
// ============================================================================

export interface ContextStripItem {
  id: string;
  label: string;
  count: number;
  severityCounts?: { error: number; warning: number; info: number };
}

export interface ContextStripProps {
  items: ContextStripItem[];
  activeId: string;
  onItemClick: (id: string) => void;
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const STRIP_HEIGHT = 28;
const MIN_ITEM_WIDTH = 32;
const LABEL_MIN_WIDTH = 52;
const ITEM_GAP = 2;

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the dominant severity color class for an item.
 */
function getSeverityColorClass(severityCounts?: {
  error: number;
  warning: number;
  info: number;
}): string {
  if (!severityCounts) return "bg-foreground/[0.03]";
  const { error, warning } = severityCounts;
  if (error > 0) return "bg-error/10";
  if (warning > 0) return "bg-warning/10";
  return "bg-info/10";
}

/**
 * Calculate proportional widths for items, respecting minimum width.
 */
function calculateItemWidths(
  items: ContextStripItem[],
  containerWidth: number
): Map<string, number> {
  const totalCount = items.reduce((sum, item) => sum + item.count, 0);
  const totalGap = (items.length - 1) * ITEM_GAP;
  const availableWidth = containerWidth - totalGap;

  const widths = new Map<string, number>();

  if (totalCount === 0 || availableWidth <= 0) {
    // Equal distribution
    const equalWidth = Math.max(MIN_ITEM_WIDTH, availableWidth / items.length);
    for (const item of items) {
      widths.set(item.id, equalWidth);
    }
    return widths;
  }

  // First pass: proportional widths
  for (const item of items) {
    const proportional = (item.count / totalCount) * availableWidth;
    widths.set(item.id, Math.max(MIN_ITEM_WIDTH, proportional));
  }

  // If minimum widths caused overflow, normalize
  const totalAllocated = [...widths.values()].reduce((sum, w) => sum + w, 0);
  if (totalAllocated > availableWidth && availableWidth > 0) {
    const scale = availableWidth / totalAllocated;
    for (const [id, w] of widths) {
      widths.set(id, Math.max(MIN_ITEM_WIDTH, w * scale));
    }
  }

  return widths;
}

// ============================================================================
// Sub-components
// ============================================================================

interface StripItemProps {
  item: ContextStripItem;
  width: number;
  isActive: boolean;
  onClick: () => void;
  index: number;
}

function StripItem({ item, width, isActive, onClick, index }: StripItemProps) {
  const showLabel = width >= LABEL_MIN_WIDTH;
  const colorClass = getSeverityColorClass(item.severityCounts);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{
        duration: DURATIONS.standard,
        ease: crispEase,
        delay: index * 0.02,
      }}
      onClick={onClick}
      title={`${item.label} (${item.count})`}
      className={cn(
        "shrink-0 rounded-xl overflow-hidden transition-all duration-100",
        "border border-foreground/[0.04] cursor-pointer",
        colorClass,
        isActive
          ? "ring-1 ring-foreground/20"
          : "opacity-70 hover:opacity-100 hover:bg-foreground/[0.06] hover:border-foreground/[0.08]"
      )}
      style={{
        width,
        height: STRIP_HEIGHT,
      }}
    >
      {showLabel && (
        <span className="block truncate px-1.5 text-[10px] leading-[28px] text-foreground/70 font-medium">
          {item.label}
        </span>
      )}
    </motion.button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ContextStrip({
  items,
  activeId,
  onItemClick,
  className,
}: ContextStripProps) {
  // We use a fixed reference width for proportional calculation.
  // The actual container width will flex to fit.
  const itemWidths = useMemo(
    () => calculateItemWidths(items, 500),
    [items]
  );

  if (items.length === 0) return null;

  return (
    <motion.div
      variants={contextStripVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={contextStripTransition}
      className={cn("overflow-hidden", className)}
    >
      <div
        className={cn(
          "flex overflow-x-auto px-3 py-2",
          "scrollbar-thin scrollbar-thumb-foreground/10 scrollbar-track-transparent",
          "[&::-webkit-scrollbar]:h-0.5",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:bg-foreground/10",
          "[&::-webkit-scrollbar-thumb]:rounded-full"
        )}
        style={{ gap: ITEM_GAP }}
      >
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => (
            <StripItem
              key={item.id}
              item={item}
              width={itemWidths.get(item.id) ?? MIN_ITEM_WIDTH}
              isActive={item.id === activeId}
              onClick={() => onItemClick(item.id)}
              index={index}
            />
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

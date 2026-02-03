/**
 * SiblingStrip - Generic horizontal strip of collapsed sibling items
 *
 * A generalized component for displaying sibling items in a horizontal
 * scrollable strip. When an item is expanded, its siblings collapse into
 * this strip, keeping context visible while allowing the user to switch
 * to a different sibling.
 *
 * @template T - Item type that must have id, label, and optional count
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import {
  collapsedStripVariants,
  collapsedStripTransition,
  collapsedTileVariants,
  crispEase,
  DURATIONS,
} from "./animations/expansion-animations";

// ============================================================================
// Types
// ============================================================================

/** Base constraint for items that can be displayed in the strip */
export interface SiblingStripItem {
  id: string;
  label: string;
  count?: number;
}

export interface SiblingStripProps<T extends SiblingStripItem> {
  /** Items to display in the strip */
  items: T[];
  /** Callback when an item is clicked */
  onItemClick: (item: T) => void;
  /** Optional custom renderer for items */
  renderItem?: (item: T, index: number) => React.ReactNode;
  /** Optional additional class names */
  className?: string;
  /** Level indicator for visual hierarchy */
  level?: number;
}

interface DefaultItemProps<T extends SiblingStripItem> {
  item: T;
  onClick: () => void;
  index: number;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Default item renderer - individual collapsed item in the strip
 */
function DefaultItem<T extends SiblingStripItem>({
  item,
  onClick,
  index,
}: DefaultItemProps<T>) {
  return (
    <motion.button
      variants={collapsedTileVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{
        duration: DURATIONS.standard,
        ease: crispEase,
        delay: index * 0.03,
      }}
      onClick={onClick}
      whileHover={{ scale: 1.05, opacity: 1 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "flex-shrink-0",
        "px-3 py-2 rounded-xl",
        "bg-foreground/[0.03] hover:bg-foreground/[0.06]",
        "border border-foreground/[0.04] hover:border-foreground/[0.08]",
        "transition-colors duration-150",
        "cursor-pointer",
        "min-w-[80px] max-w-[140px]"
      )}
    >
      <div className="flex flex-col items-start gap-0.5">
        {/* Label - truncated */}
        <span className="text-xs font-normal text-foreground/80 truncate max-w-full">
          {item.label}
        </span>
        {/* Count - only show if present */}
        {item.count !== undefined && (
          <span className="text-sm font-extralight text-foreground/50 tabular-nums">
            {item.count}
          </span>
        )}
      </div>
    </motion.button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SiblingStrip<T extends SiblingStripItem>({
  items,
  onItemClick,
  renderItem,
  className,
  level = 0,
}: SiblingStripProps<T>) {
  // Don't render if no siblings
  if (items.length === 0) return null;

  return (
    <motion.div
      variants={collapsedStripVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={collapsedStripTransition}
      className={cn("overflow-hidden", className)}
    >
      {/* Scrollable container */}
      <div
        className={cn(
          "flex gap-2 overflow-x-auto",
          "px-4 py-3",
          "scrollbar-thin scrollbar-thumb-foreground/10 scrollbar-track-transparent",
          // Hide scrollbar on mobile but keep functionality
          "[-ms-overflow-style:none] [scrollbar-width:thin]",
          "[&::-webkit-scrollbar]:h-1",
          "[&::-webkit-scrollbar-track]:bg-transparent",
          "[&::-webkit-scrollbar-thumb]:bg-foreground/10",
          "[&::-webkit-scrollbar-thumb]:rounded-full"
        )}
      >
        <AnimatePresence mode="popLayout">
          {items.map((item, index) =>
            renderItem ? (
              <React.Fragment key={item.id}>
                {renderItem(item, index)}
              </React.Fragment>
            ) : (
              <DefaultItem<T>
                key={item.id}
                item={item}
                onClick={() => onItemClick(item)}
                index={index}
              />
            )
          )}
        </AnimatePresence>
      </div>

      {/* Level indicator line */}
      {level > 0 && (
        <div
          className="h-px bg-foreground/[0.04] mx-4"
          style={{ marginLeft: `${level * 8 + 16}px` }}
        />
      )}
    </motion.div>
  );
}

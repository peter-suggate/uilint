/**
 * CollapsedTileStrip - Horizontal strip of collapsed sibling tiles
 *
 * When a tile is expanded, its siblings collapse into a horizontal
 * scrollable strip at the bottom. This keeps context visible while
 * allowing the user to switch to a different sibling.
 */
import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../../../lib/utils";
import type { TileItem } from "../../../core/plugin-system/types";
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

interface CollapsedTileStripProps {
  /** Sibling tiles to display */
  tiles: TileItem[];
  /** Callback when a collapsed tile is clicked */
  onTileClick: (tile: TileItem) => void;
  /** Optional additional class names */
  className?: string;
  /** Level indicator for visual hierarchy */
  level?: number;
}

interface CollapsedTileProps {
  item: TileItem;
  onClick: () => void;
  index: number;
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Individual collapsed tile in the strip
 */
function CollapsedTile({ item, onClick, index }: CollapsedTileProps) {
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
        {/* Count */}
        <span className="text-sm font-extralight text-foreground/50 tabular-nums">
          {item.count}
        </span>
      </div>
    </motion.button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function CollapsedTileStrip({
  tiles,
  onTileClick,
  className,
  level = 0,
}: CollapsedTileStripProps) {
  // Don't render if no siblings
  if (tiles.length === 0) return null;

  return (
    <motion.div
      variants={collapsedStripVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={collapsedStripTransition}
      className={cn(
        "overflow-hidden",
        className
      )}
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
          {tiles.map((tile, index) => (
            <CollapsedTile
              key={tile.id}
              item={tile}
              onClick={() => onTileClick(tile)}
              index={index}
            />
          ))}
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

export type { CollapsedTileStripProps };

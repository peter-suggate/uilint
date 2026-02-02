/**
 * ExpandedTileHeader - Header for expanded tiles
 *
 * Shows:
 * - Back button (arrow) to collapse
 * - Tile label and subtitle
 * - Issue count
 *
 * Clicking the back button or pressing Escape collapses the tile.
 */
import React from "react";
import { motion } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { cn } from "../../../lib/utils";
import type { TileItem } from "../../../core/plugin-system/types";
import {
  headerVariants,
  headerTransition,
  backButtonVariants,
  backButtonTransition,
  crispEase,
} from "./animations/expansion-animations";

// ============================================================================
// Types
// ============================================================================

interface ExpandedTileHeaderProps {
  /** The tile item being displayed */
  item: TileItem;
  /** Callback when back button is clicked */
  onBack: () => void;
  /** Optional additional class names */
  className?: string;
  /** Depth level (for visual indication) */
  level?: number;
}

// ============================================================================
// Component
// ============================================================================

export function ExpandedTileHeader({
  item,
  onBack,
  className,
  level = 0,
}: ExpandedTileHeaderProps) {
  return (
    <motion.div
      variants={headerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={headerTransition}
      className={cn(
        "flex items-center justify-between gap-3 px-4 py-3",
        "border-b border-foreground/[0.06]",
        className
      )}
    >
      {/* Left side: Back button + label */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {/* Back button */}
        <motion.button
          onClick={onBack}
          variants={backButtonVariants}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
          transition={backButtonTransition}
          className={cn(
            "flex items-center justify-center",
            "w-7 h-7 rounded-lg",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-foreground/[0.05]",
            "transition-colors duration-150",
            "flex-shrink-0"
          )}
          aria-label="Go back"
        >
          <ChevronLeft size={18} strokeWidth={2} />
        </motion.button>

        {/* Label and subtitle */}
        <div className="min-w-0 flex-1">
          <motion.h3
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: crispEase, delay: 0.05 }}
            className="text-base font-medium text-foreground truncate"
          >
            {item.label}
          </motion.h3>
          {item.subtitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.1 }}
              className="text-xs text-muted-foreground/70 truncate mt-0.5"
            >
              {item.subtitle}
            </motion.p>
          )}
        </div>
      </div>

      {/* Right side: Count */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: crispEase, delay: 0.1 }}
        className="flex-shrink-0"
      >
        <span className="text-2xl font-extralight text-foreground/60 tabular-nums">
          {item.count}
        </span>
      </motion.div>
    </motion.div>
  );
}

export type { ExpandedTileHeaderProps };

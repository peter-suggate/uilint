/**
 * TileHeader - Generalized header for hierarchical tiles
 *
 * Shows:
 * - Back button (arrow) to navigate up
 * - Label and optional subtitle
 * - Optional count display
 * - Optional icon
 *
 * Reusable across different tile-based UIs.
 */
import React from "react";
import { motion } from "motion/react";
import { ChevronLeft } from "lucide-react";
import { cn } from "../../../lib/utils";
import {
  headerVariants,
  headerTransition,
  backButtonVariants,
  backButtonTransition,
} from "./animations/expansion-animations";

// ============================================================================
// Types
// ============================================================================

export interface TileHeaderProps {
  /** Main label text */
  label: string;
  /** Optional subtitle text */
  subtitle?: string;
  /** Optional count to display */
  count?: number;
  /** Optional icon element */
  icon?: React.ReactNode;
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

export function TileHeader({
  label,
  subtitle,
  count,
  icon,
  onBack,
  className,
}: TileHeaderProps) {
  return (
    <motion.div
      variants={headerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={headerTransition}
      className={cn(
        "flex items-center justify-between gap-2 px-3 py-2",
        "border-b border-foreground/[0.04]",
        className
      )}
    >
      {/* Left side: Back button + icon + label */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
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
            "w-6 h-6 rounded-md",
            "text-muted-foreground/70 hover:text-foreground",
            "hover:bg-foreground/[0.05]",
            "transition-colors duration-100",
            "flex-shrink-0"
          )}
          aria-label="Go back"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </motion.button>

        {/* Optional icon */}
        {icon && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
            className="flex-shrink-0 text-muted-foreground/70"
          >
            {icon}
          </motion.div>
        )}

        {/* Label and subtitle - inline */}
        <div className="min-w-0 flex-1 flex items-baseline gap-2">
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.1 }}
            className="text-sm font-medium text-foreground truncate"
          >
            {label}
          </motion.h3>
          {subtitle && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.1, delay: 0.05 }}
              className="text-[11px] text-muted-foreground/50 truncate hidden sm:inline"
            >
              {subtitle}
            </motion.span>
          )}
        </div>
      </div>

      {/* Right side: Count - smaller */}
      {count !== undefined && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.1 }}
          className="flex-shrink-0"
        >
          <span className="text-lg font-light text-foreground/50 tabular-nums">
            {count}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

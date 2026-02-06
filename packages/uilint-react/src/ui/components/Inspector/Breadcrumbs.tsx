/**
 * Breadcrumbs - Navigation trail for the inspector hierarchy
 *
 * Shows the current navigation path:
 * - "All Rules" (root, always shown)
 * - "→ [Rule Name]" (when rule expanded)
 * - "→ [File Name]" (when file expanded within rule)
 *
 * Each segment is clickable to navigate back to that level.
 */
import React from "react";
import { motion } from "motion/react";
import { ChevronRight, Layers } from "lucide-react";
import { cn } from "../../../lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface BreadcrumbsProps {
  /** Name of the expanded rule (null if at root) */
  expandedRuleName: string | null;
  /** Name of the expanded file (null if no file expanded) */
  expandedFileName: string | null;
  /** Called when "All Rules" is clicked */
  onCollapseToRoot: () => void;
  /** Called when rule name is clicked (collapses file only) */
  onCollapseFile: () => void;
  /** Visual variant - 'standalone' has border/bg, 'embedded' is minimal */
  variant?: "standalone" | "embedded";
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Separator between breadcrumb segments
 */
function Separator() {
  return (
    <ChevronRight
      size={12}
      className="text-muted-foreground/30 flex-shrink-0 mx-1"
    />
  );
}

/**
 * Individual breadcrumb segment
 */
function Segment({
  children,
  onClick,
  isActive = false,
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  isActive?: boolean;
  icon?: React.ReactNode;
}) {
  const isClickable = !!onClick && !isActive;

  return (
    <motion.button
      onClick={isClickable ? onClick : undefined}
      disabled={!isClickable}
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs",
        "transition-colors duration-100",
        isClickable && "hover:bg-foreground/[0.05] cursor-pointer",
        isActive
          ? "text-foreground/80 font-medium"
          : "text-muted-foreground/60",
        !isClickable && !isActive && "cursor-default"
      )}
      whileHover={isClickable ? { scale: 1.02 } : undefined}
      whileTap={isClickable ? { scale: 0.98 } : undefined}
    >
      {icon}
      <span className="truncate max-w-[120px]">{children}</span>
    </motion.button>
  );
}

// ============================================================================
// Component
// ============================================================================

export function Breadcrumbs({
  expandedRuleName,
  expandedFileName,
  onCollapseToRoot,
  onCollapseFile,
  variant = "standalone",
  className,
}: BreadcrumbsProps) {
  // Don't render if at root level (no rule expanded)
  if (!expandedRuleName) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className={cn(
        "flex items-center px-4 py-2",
        variant !== "embedded" && "border-b border-foreground/[0.04] bg-foreground/[0.01]",
        className
      )}
    >
      {/* Root: All Rules */}
      <Segment
        onClick={onCollapseToRoot}
        icon={<Layers size={11} className="opacity-50" />}
      >
        All Rules
      </Segment>

      {/* Rule segment */}
      <Separator />
      <Segment
        onClick={expandedFileName ? onCollapseFile : undefined}
        isActive={!expandedFileName}
      >
        {expandedRuleName}
      </Segment>

      {/* File segment (if expanded) */}
      {expandedFileName && (
        <>
          <Separator />
          <Segment isActive>{expandedFileName}</Segment>
        </>
      )}
    </motion.div>
  );
}

export default Breadcrumbs;

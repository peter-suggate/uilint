/**
 * Tile - Glassmorphic tile component for mosaic grid
 *
 * iOS-style glassmorphic design:
 * - Translucent background with backdrop blur
 * - Minimal color palette with proper light/dark mode contrast
 * - Large, light-weight fonts
 * - Clean, modern aesthetic using shadcn conventions
 */
import React from "react";
import { motion } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../../lib/utils";
import { ExternalLinkIcon } from "../../icons";
import type { TileItem, TileBucket } from "../../../core/plugin-system/types";

// ============================================================================
// Variants
// ============================================================================

const tileVariants = cva(
  [
    "h-full cursor-pointer overflow-hidden relative box-border",
    "flex flex-col justify-between",
    "rounded-2xl",
    "transition-all duration-150",
  ],
  {
    variants: {
      selected: {
        true: "bg-foreground/[0.04] border border-foreground/12",
        false: "border border-foreground/[0.04] hover:bg-foreground/[0.03] hover:border-foreground/[0.08]",
      },
      size: {
        xs: "p-4",
        sm: "p-4",
        md: "p-5",
        lg: "p-6",
        xl: "p-6",
      },
    },
    defaultVariants: {
      selected: false,
      size: "md",
    },
  }
);

const titleVariants = cva(
  [
    "font-light leading-tight tracking-tight",
    "text-foreground",
    "overflow-hidden text-ellipsis",
    "[-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]",
  ],
  {
    variants: {
      size: {
        xs: "text-[15px] [-webkit-line-clamp:1]",
        sm: "text-[17px] [-webkit-line-clamp:1]",
        md: "text-xl",
        lg: "text-2xl",
        xl: "text-[28px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

const countVariants = cva(
  [
    "font-extralight leading-none tracking-tighter",
    "text-foreground/70",
  ],
  {
    variants: {
      size: {
        xs: "text-xl",
        sm: "text-2xl",
        md: "text-[32px]",
        lg: "text-[40px]",
        xl: "text-[52px]",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

// ============================================================================
// Types
// ============================================================================

interface TileProps extends VariantProps<typeof tileVariants> {
  item: TileItem;
  bucket: TileBucket;
  isSelected: boolean;
  onClick: () => void;
  onOpenInInspector?: () => void;
}

// ============================================================================
// Animation
// ============================================================================

const crispEase = [0.32, 0.72, 0, 1] as const;

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Severity indicator dot
 */
function SeverityDot({
  type,
  count,
  showCount,
}: {
  type: "error" | "warning" | "info";
  count: number;
  showCount: boolean;
}) {
  if (count === 0) return null;

  const colorClasses = {
    error: "bg-error/70",
    warning: "bg-warning/70",
    info: "bg-info/70",
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-1.5 h-1.5 rounded-full", colorClasses[type])} />
      {showCount && (
        <span className="text-[11px] font-normal text-muted-foreground/70">
          {count}
        </span>
      )}
    </div>
  );
}

/**
 * Severity indicators section
 */
function SeverityIndicators({
  severityCounts,
  showCounts,
}: {
  severityCounts: TileItem["severityCounts"];
  showCounts: boolean;
}) {
  if (!severityCounts) return null;

  const hasAny =
    severityCounts.error > 0 ||
    severityCounts.warning > 0 ||
    severityCounts.info > 0;

  if (!hasAny) return null;

  return (
    <div className="flex items-center gap-2">
      <SeverityDot type="error" count={severityCounts.error} showCount={showCounts} />
      <SeverityDot type="warning" count={severityCounts.warning} showCount={showCounts} />
      <SeverityDot type="info" count={severityCounts.info} showCount={showCounts} />
    </div>
  );
}

/**
 * Hover highlight overlay - subtle top-left shine
 */
function HoverOverlay({ isHovered }: { isHovered: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isHovered ? 1 : 0 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br from-foreground/[0.02] to-transparent"
    />
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function Tile({ item, bucket, isSelected, onClick, onOpenInInspector }: TileProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const isCompact = bucket === "xs" || bucket === "sm";

  const handleOpenInInspector = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenInInspector?.();
  };

  return (
    <motion.div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        duration: 0.15,
        ease: crispEase,
      }}
      className={cn(tileVariants({ selected: isSelected, size: bucket }))}
    >
      {/* Top section: Label and open in inspector button */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className={cn(titleVariants({ size: bucket }))}>
            {item.label}
          </span>

          {/* Subtitle - path or description */}
          {item.subtitle && !isCompact && (
            <div className="mt-2 text-xs font-normal text-muted-foreground/60 truncate tracking-wide">
              {item.subtitle}
            </div>
          )}
        </div>

        {/* Open in inspector button */}
        {onOpenInInspector && (
          <motion.button
            onClick={handleOpenInInspector}
            initial={{ opacity: 0 }}
            animate={{ opacity: isHovered ? 1 : 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className="flex-shrink-0 p-1.5 -mt-1 -mr-1 rounded-lg text-muted-foreground/50 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-colors"
            title="Open in inspector"
            aria-label="Open in inspector"
          >
            <ExternalLinkIcon size={isCompact ? 12 : 14} />
          </motion.button>
        )}
      </div>

      {/* Bottom section: Count and severity */}
      <div className="flex items-end justify-between gap-4">
        {/* Large count number */}
        <span className={cn(countVariants({ size: bucket }))}>
          {item.count}
        </span>

        {/* Severity indicators - minimal dots */}
        <SeverityIndicators
          severityCounts={item.severityCounts}
          showCounts={!isCompact}
        />
      </div>

      {/* Hover highlight overlay */}
      <HoverOverlay isHovered={isHovered} />
    </motion.div>
  );
}

export type { TileProps };

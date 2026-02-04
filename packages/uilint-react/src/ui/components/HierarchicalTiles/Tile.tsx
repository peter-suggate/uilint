/**
 * Tile - Glassmorphic tile component for mosaic grid
 *
 * iOS-style glassmorphic design:
 * - Translucent background with backdrop blur
 * - Minimal color palette with proper light/dark mode contrast
 * - Large, light-weight fonts
 * - Clean, modern aesthetic using shadcn conventions
 *
 * Responsive features:
 * - Dynamic font scaling for small tiles to ensure readability
 * - Extra context display for large tiles
 * - Compact severity indicators for xs tiles
 */
import React, { useMemo } from "react";
import { motion } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../../lib/utils";
import { ExternalLinkIcon } from "../../icons";
import { useTileAdaptiveText, TILE_PADDING } from "../../hooks/useAdaptiveText";

// ============================================================================
// Types
// ============================================================================

export type TileBucket = "xs" | "sm" | "md" | "lg" | "xl";

export interface SeverityCounts {
  error: number;
  warning: number;
  info: number;
}

export interface TileProps extends VariantProps<typeof tileVariants> {
  id: string;
  label: string;
  subtitle?: string;
  icon?: React.ReactNode;
  count: number;
  severityCounts?: SeverityCounts;
  bucket: TileBucket;
  /** Width of the tile in pixels (for adaptive text calculation) */
  tileWidth?: number;
  isSelected: boolean;
  onClick: () => void;
  onOpenInInspector?: () => void;
  /** Optional preview messages for large tiles */
  previewMessages?: string[];
  /** Optional file count for large tiles */
  fileCount?: number;
}

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
        xs: "p-3",
        sm: "p-3.5",
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

const countVariants = cva(
  [
    "font-extralight leading-none tracking-tighter",
    "text-foreground/70",
  ],
  {
    variants: {
      size: {
        xs: "text-lg",
        sm: "text-xl",
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
  size = "normal",
}: {
  type: "error" | "warning" | "info";
  count: number;
  showCount: boolean;
  size?: "compact" | "normal";
}) {
  if (count === 0) return null;

  const colorClasses = {
    error: "bg-error/70",
    warning: "bg-warning/70",
    info: "bg-info/70",
  };

  const dotSize = size === "compact" ? "w-1 h-1" : "w-1.5 h-1.5";

  return (
    <div className="flex items-center gap-1.5">
      <div className={cn(dotSize, "rounded-full", colorClasses[type])} />
      {showCount && (
        <span className="text-[11px] font-normal text-muted-foreground/70">
          {count}
        </span>
      )}
    </div>
  );
}

/**
 * Compact severity indicator - single dot showing highest severity
 */
function CompactSeverityIndicator({
  severityCounts,
}: {
  severityCounts?: SeverityCounts;
}) {
  if (!severityCounts) return null;

  const { error, warning, info } = severityCounts;
  const hasAny = error > 0 || warning > 0 || info > 0;

  if (!hasAny) return null;

  // Show highest severity only
  const highestSeverity = error > 0 ? "error" : warning > 0 ? "warning" : "info";
  const colorClasses = {
    error: "bg-error/80",
    warning: "bg-warning/80",
    info: "bg-info/80",
  };

  return (
    <div className="flex items-center gap-1">
      <div className={cn("w-1.5 h-1.5 rounded-full", colorClasses[highestSeverity])} />
    </div>
  );
}

/**
 * Severity indicators section
 */
function SeverityIndicators({
  severityCounts,
  showCounts,
  compact = false,
}: {
  severityCounts?: SeverityCounts;
  showCounts: boolean;
  compact?: boolean;
}) {
  if (!severityCounts) return null;

  const hasAny =
    severityCounts.error > 0 ||
    severityCounts.warning > 0 ||
    severityCounts.info > 0;

  if (!hasAny) return null;

  // For compact (xs) tiles, show single highest severity dot
  if (compact) {
    return <CompactSeverityIndicator severityCounts={severityCounts} />;
  }

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

/**
 * Preview content for large tiles - shows issue messages or file info
 */
function LargeTilePreview({
  previewMessages,
  fileCount,
  bucket,
}: {
  previewMessages?: string[];
  fileCount?: number;
  bucket: TileBucket;
}) {
  const showPreview = bucket === "xl" || bucket === "lg";
  if (!showPreview) return null;

  const maxMessages = bucket === "xl" ? 2 : 1;
  const messagesToShow = previewMessages?.slice(0, maxMessages) || [];

  if (messagesToShow.length === 0 && !fileCount) return null;

  return (
    <div className="mt-2 space-y-1">
      {/* Preview messages */}
      {messagesToShow.map((msg, i) => (
        <div
          key={i}
          className="text-[11px] text-muted-foreground/50 truncate leading-tight"
        >
          {msg}
        </div>
      ))}

      {/* File count badge */}
      {fileCount !== undefined && fileCount > 0 && (
        <div className="text-[10px] text-muted-foreground/40 font-medium tracking-wide">
          {fileCount} {fileCount === 1 ? "file" : "files"}
        </div>
      )}
    </div>
  );
}

/**
 * Adaptive title component with dynamic font scaling
 */
function AdaptiveTitle({
  label,
  bucket,
  tileWidth,
  icon,
}: {
  label: string;
  bucket: TileBucket;
  tileWidth: number;
  icon?: React.ReactNode;
}) {
  const { fontSize, isScaled, needsTruncation } = useTileAdaptiveText(
    label,
    bucket,
    tileWidth
  );

  // Base styles for title
  const baseStyles = cn(
    "font-light leading-tight tracking-tight",
    "text-foreground",
    "overflow-hidden text-ellipsis",
    // Line clamp based on size
    bucket === "xs" || bucket === "sm"
      ? "[-webkit-line-clamp:1]"
      : "[-webkit-line-clamp:2]",
    "[-webkit-box-orient:vertical] [display:-webkit-box]"
  );

  return (
    <div className="flex items-center gap-2">
      {icon && (
        <span className="flex-shrink-0 text-muted-foreground/60">
          {icon}
        </span>
      )}
      <span
        className={baseStyles}
        style={{
          fontSize: `${fontSize}px`,
          // Slightly tighter tracking when scaled down
          letterSpacing: isScaled ? "-0.03em" : "-0.025em",
        }}
        title={needsTruncation ? label : undefined}
      >
        {label}
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function Tile({
  id,
  label,
  subtitle,
  icon,
  count,
  severityCounts,
  bucket,
  tileWidth = 166, // Default tile width
  isSelected,
  onClick,
  onOpenInInspector,
  previewMessages,
  fileCount,
}: TileProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  // Determine tile characteristics
  const isCompact = bucket === "xs" || bucket === "sm";
  const isXs = bucket === "xs";
  const isLarge = bucket === "lg" || bucket === "xl";

  const handleOpenInInspector = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenInInspector?.();
  };

  // Icon size based on bucket
  const iconSize = useMemo(() => {
    if (isXs) return 10;
    if (bucket === "sm") return 12;
    return 14;
  }, [bucket, isXs]);

  return (
    <motion.div
      data-tile-id={id}
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
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex-1 min-w-0">
          <AdaptiveTitle
            label={label}
            bucket={bucket}
            tileWidth={tileWidth}
            icon={icon}
          />

          {/* Subtitle - path or description (hidden for compact tiles) */}
          {subtitle && !isCompact && (
            <div className="mt-2 text-xs font-normal text-muted-foreground/60 truncate tracking-wide">
              {subtitle}
            </div>
          )}

          {/* Large tile preview content */}
          {isLarge && (
            <LargeTilePreview
              previewMessages={previewMessages}
              fileCount={fileCount}
              bucket={bucket}
            />
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
            className="flex-shrink-0 p-1 -mt-0.5 -mr-0.5 rounded-lg text-muted-foreground/50 hover:text-foreground/70 hover:bg-foreground/[0.06] transition-colors"
            title="Open in inspector"
            aria-label="Open in inspector"
          >
            <ExternalLinkIcon size={iconSize} />
          </motion.button>
        )}
      </div>

      {/* Bottom section: Count and severity */}
      <div className="flex items-end justify-between gap-2">
        {/* Large count number */}
        <span className={cn(countVariants({ size: bucket }))}>
          {count}
        </span>

        {/* Severity indicators - compact for xs, minimal for sm, full for others */}
        <SeverityIndicators
          severityCounts={severityCounts}
          showCounts={!isCompact}
          compact={isXs}
        />
      </div>

      {/* Hover highlight overlay */}
      <HoverOverlay isHovered={isHovered} />
    </motion.div>
  );
}

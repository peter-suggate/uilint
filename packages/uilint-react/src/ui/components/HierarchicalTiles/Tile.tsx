/**
 * Tile - Glassmorphic tile component for mosaic grid
 *
 * iOS-style glassmorphic design:
 * - Translucent background with backdrop blur
 * - Minimal color palette with proper light/dark mode contrast
 * - Large, light-weight fonts
 * - Clean, modern aesthetic using shadcn conventions
 *
 * Display format:
 * - Line 1: Rule/file name (label)
 * - Line 2: "X issues in Y files" or "X issues"
 */
import React, { useMemo } from "react";
import { motion } from "motion/react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../../lib/utils";
import { ExternalLinkIcon } from "../../icons";

// ============================================================================
// Types
// ============================================================================

export type TileBucket = "xs" | "sm" | "md" | "lg" | "xl";

export interface ConfigTag {
  label: string;
  accent?: boolean;
}

export interface TileProps extends VariantProps<typeof tileVariants> {
  id: string;
  label: string;
  /** Optional subtitle (e.g., file path) shown above label */
  subtitle?: string;
  /** Tile type for visual differentiation (gradient color) */
  tileType?: "rule" | "file";
  count: number;
  /** Number of files (for "X issues in Y files" display) */
  fileCount?: number;
  /** Compact config tags shown on lg/xl tiles */
  configTags?: ConfigTag[];
  bucket: TileBucket;
  isSelected: boolean;
  onClick: () => void;
  onOpenInInspector?: () => void;
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
        false:
          "border border-foreground/[0.04] hover:bg-foreground/[0.03] hover:border-foreground/[0.08]",
      },
      size: {
        xs: "p-3",
        sm: "p-4",
        md: "p-5",
        lg: "p-6",
        xl: "p-7",
      },
    },
    defaultVariants: {
      selected: false,
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
 * Hover highlight overlay - subtle top-left shine
 */
function HoverOverlay({ isHovered }: { isHovered: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: isHovered ? 1 : 0 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-0 rounded-2xl pointer-events-none bg-linear-to-br from-foreground/2 to-transparent"
    />
  );
}

/**
 * Type gradient flourish - corner gradient to differentiate tile types
 */
function TypeGradient({ tileType }: { tileType?: "rule" | "file" }) {
  if (!tileType) return null;

  // Use CSS variable for the color based on tile type
  const colorVar = tileType === "rule" ? "var(--color-tile-rule)" : "var(--color-tile-file)";

  return (
    <div
      className="absolute top-0 right-0 w-20 h-20 pointer-events-none rounded-tr-2xl"
      style={{
        background: `radial-gradient(circle at top right, ${colorVar} 0%, transparent 70%)`,
        opacity: 0.25,
      }}
    />
  );
}

/**
 * Config tags - small pills showing rule config info on larger tiles
 */
function ConfigTags({
  tags,
  bucket,
}: {
  tags: ConfigTag[];
  bucket: TileBucket;
}) {
  if (tags.length === 0) return null;

  // Only show on lg/xl buckets
  const maxTags = bucket === "xl" ? 3 : 2;
  const visibleTags = tags.slice(0, maxTags);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: 0.15 }}
      className="flex flex-wrap gap-1 mt-1.5 overflow-hidden max-h-[2.25rem]"
    >
      {visibleTags.map((tag) => (
        <span
          key={tag.label}
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] leading-tight",
            "border border-foreground/[0.06]",
            tag.accent
              ? "text-purple-500/70 bg-purple-500/[0.06] border-purple-500/10 dark:text-purple-400/70 dark:bg-purple-400/[0.06] dark:border-purple-400/10"
              : "text-muted-foreground/60 bg-foreground/[0.03]"
          )}
        >
          {tag.label}
        </span>
      ))}
    </motion.div>
  );
}

/**
 * Format the issue summary parts (e.g., "72" and "issues in 4 files")
 * Returns count separately for prominent styling
 */
function formatIssueSummaryParts(
  count: number,
  fileCount?: number
): { count: number; suffix: string } {
  const issueWord = count === 1 ? "issue" : "issues";
  if (fileCount !== undefined && fileCount > 0) {
    const fileWord = fileCount === 1 ? "file" : "files";
    return { count, suffix: `${issueWord} in ${fileCount} ${fileWord}` };
  }
  return { count, suffix: issueWord };
}

/**
 * Get font size for label based on bucket (larger tiles = larger fonts)
 */
function getLabelFontSize(bucket: TileBucket): string {
  switch (bucket) {
    case "xl":
      return "text-2xl";
    case "lg":
      return "text-xl";
    case "md":
      return "text-lg";
    case "sm":
      return "text-base";
    case "xs":
      return "text-sm";
    default:
      return "text-lg";
  }
}

/**
 * Get font size for summary based on bucket
 */
function getSummaryFontSize(bucket: TileBucket): string {
  switch (bucket) {
    case "xl":
      return "text-base";
    case "lg":
      return "text-sm";
    case "md":
      return "text-sm";
    case "sm":
      return "text-xs";
    case "xs":
      return "text-[11px]";
    default:
      return "text-sm";
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function Tile({
  id,
  label,
  subtitle,
  tileType,
  count,
  fileCount,
  configTags,
  bucket,
  isSelected,
  onClick,
  onOpenInInspector,
}: TileProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const handleOpenInInspector = (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenInInspector?.();
  };

  // Icon size for external link button based on bucket
  const iconSize = useMemo(() => {
    if (bucket === "xl") return 16;
    if (bucket === "lg") return 14;
    if (bucket === "md") return 14;
    if (bucket === "sm") return 12;
    return 10;
  }, [bucket]);

  // Format the issue summary parts (count separate for prominent styling)
  const { count: issueCount, suffix } = formatIssueSummaryParts(
    count,
    fileCount
  );

  // Get font sizes based on bucket
  const labelFontSize = getLabelFontSize(bucket);
  const summaryFontSize = getSummaryFontSize(bucket);

  // Get path font size (smaller than summary)
  const pathFontSize = bucket === "xs" ? "text-[10px]" : "text-xs";

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
      {/* Content: path + label at top, issue summary at bottom */}
      <div className="flex flex-col justify-between h-full">
        {/* Top section: path, icon + label, and inspector button */}
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex-1 min-w-0 flex flex-col">
            {/* Path (subtitle) - small subdued text above label, mono for files */}
            {subtitle && (
              <div
                className={cn(
                  "text-muted-foreground/50 truncate mb-0.5",
                  pathFontSize,
                  tileType === "file" && "font-mono"
                )}
              >
                {subtitle}
              </div>
            )}

            {/* Label */}
            <span
              className={cn(
                "font-light leading-tight tracking-tight text-foreground line-clamp-2",
                labelFontSize
              )}
              title={label}
            >
              {label}
            </span>
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
              className="shrink-0 p-1 -mt-0.5 -mr-0.5 rounded-lg text-muted-foreground/50 hover:text-foreground/70 hover:bg-foreground/6 transition-colors"
              title="Open in inspector"
              aria-label="Open in inspector"
            >
              <ExternalLinkIcon size={iconSize} />
            </motion.button>
          )}
        </div>

        {/* Config tags - only on lg/xl rule tiles */}
        {configTags &&
          configTags.length > 0 &&
          (bucket === "lg" || bucket === "xl") && (
            <ConfigTags tags={configTags} bucket={bucket} />
          )}

        {/* Bottom section: Issue summary */}
        <div
          className={cn(
            "flex items-baseline gap-1 mt-auto pt-2",
            summaryFontSize
          )}
        >
          <span className={cn("font-light text-foreground", labelFontSize)}>
            {issueCount}
          </span>
          <span className="font-normal text-muted-foreground/60">{suffix}</span>
        </div>
      </div>

      {/* Hover highlight overlay */}
      <HoverOverlay isHovered={isHovered} />

      {/* Type gradient flourish */}
      <TypeGradient tileType={tileType} />
    </motion.div>
  );
}

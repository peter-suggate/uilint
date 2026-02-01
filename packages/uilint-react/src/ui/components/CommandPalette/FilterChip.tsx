/**
 * FilterChip - Compact filter chip for the command palette search bar
 *
 * Displays active filters as removable pills with:
 * - Color coding by filter type (scope, rule, file, severity, category)
 * - Smooth enter/exit animations
 * - Inline × button for removal
 */

import * as React from "react";
import { useState } from "react";
import { motion } from "motion/react";
import type { TileFilter } from "../../../core/plugin-system/types";

// ============================================================================
// Types
// ============================================================================

export interface FilterChipProps {
  /** The filter to display */
  filter: TileFilter;
  /** Callback when the filter is removed */
  onRemove: () => void;
}

// ============================================================================
// Color mapping by filter type
// ============================================================================

type FilterColors = {
  background: string;
  text: string;
  border: string;
};

const filterColorMap: Record<string, FilterColors> = {
  scope: {
    background: "rgba(59, 130, 246, 0.12)", // blue tint
    text: "var(--uilint-info, #3b82f6)",
    border: "rgba(59, 130, 246, 0.25)",
  },
  rule: {
    background: "rgba(147, 51, 234, 0.12)", // purple tint
    text: "var(--uilint-accent, #9333ea)",
    border: "rgba(147, 51, 234, 0.25)",
  },
  file: {
    background: "rgba(34, 197, 94, 0.12)", // green tint
    text: "var(--uilint-success, #22c55e)",
    border: "rgba(34, 197, 94, 0.25)",
  },
  severity: {
    background: "rgba(245, 158, 11, 0.12)", // yellow/amber tint
    text: "var(--uilint-warning, #f59e0b)",
    border: "rgba(245, 158, 11, 0.25)",
  },
  category: {
    background: "var(--uilint-surface-elevated, rgba(128, 128, 128, 0.12))", // gray tint
    text: "var(--uilint-text-secondary, #a1a1aa)",
    border: "var(--uilint-border, rgba(128, 128, 128, 0.25))",
  },
};

// Fallback colors for unknown filter types
const defaultColors: FilterColors = filterColorMap.category;

// ============================================================================
// Animation variants
// ============================================================================

// Crisp easing curve matching the codebase animation style
const crispEase = [0.32, 0.72, 0, 1] as const;

const chipMotionVariants = {
  initial: {
    opacity: 0,
    x: -8,
    scale: 0.9,
  },
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
  },
  exit: {
    opacity: 0,
    scale: 0.85,
    width: 0,
    marginRight: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
};

// ============================================================================
// Component
// ============================================================================

/**
 * FilterChip - Displays a filter as a removable pill
 *
 * @example
 * ```tsx
 * <FilterChip
 *   filter={{ type: "rule", id: "uilint/semantic", label: "semantic" }}
 *   onRemove={() => removeFilter(filter.id)}
 * />
 * ```
 */
export function FilterChip({ filter, onRemove }: FilterChipProps) {
  const [isRemoveHovered, setIsRemoveHovered] = useState(false);

  const colors = filterColorMap[filter.type] || defaultColors;

  const containerStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "2px 6px 2px 8px",
    borderRadius: 999, // pill shape
    background: colors.background,
    border: `1px solid ${colors.border}`,
    fontSize: 11,
    fontWeight: 500,
    lineHeight: 1.2,
    color: colors.text,
    whiteSpace: "nowrap",
    overflow: "hidden",
  };

  const labelStyle: React.CSSProperties = {
    maxWidth: 120,
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const removeButtonStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 14,
    height: 14,
    padding: 0,
    margin: 0,
    border: "none",
    background: isRemoveHovered
      ? "rgba(255, 255, 255, 0.15)"
      : "transparent",
    borderRadius: "50%",
    color: "inherit",
    cursor: "pointer",
    opacity: isRemoveHovered ? 1 : 0.7,
    transition: "background 0.1s ease, opacity 0.1s ease",
    fontSize: 12,
    lineHeight: 1,
    fontFamily: "inherit",
  };

  return (
    <motion.span
      style={containerStyle}
      variants={chipMotionVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: 0.15,
        ease: crispEase,
      }}
      layout
    >
      <span style={labelStyle}>{filter.label}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        onMouseEnter={() => setIsRemoveHovered(true)}
        onMouseLeave={() => setIsRemoveHovered(false)}
        style={removeButtonStyle}
        aria-label={`Remove ${filter.label} filter`}
      >
        ×
      </button>
    </motion.span>
  );
}

export default FilterChip;

"use client";

/**
 * FilterChips - Visual filter chip component for the command palette
 *
 * Renders active filters as removable chips in the search input area.
 * Each chip shows a type prefix (colored) and value text.
 */

import React from "react";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";
import type { CommandPaletteFilter } from "./types";

interface FilterChipsProps {
  filters: CommandPaletteFilter[];
  onRemove: (index: number) => void;
}

/**
 * Color configuration for filter types
 */
const FILTER_TYPE_COLORS: Record<
  CommandPaletteFilter["type"],
  { bg: string; text: string; border: string }
> = {
  rule: {
    bg: "bg-accent/10",
    text: "text-accent",
    border: "border-accent/20",
  },
  issue: {
    bg: "bg-warning-bg",
    text: "text-warning",
    border: "border-warning/20",
  },
  loc: {
    bg: "bg-accent/10",
    text: "text-accent",
    border: "border-accent/20",
  },
  file: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  },
  capture: {
    bg: "bg-success-bg",
    text: "text-success",
    border: "border-success/20",
  },
  coverage: {
    bg: "bg-blue-500/10",
    text: "text-blue-500",
    border: "border-blue-500/20",
  },
};

/**
 * Single filter chip
 */
function FilterChip({
  filter,
  onRemove,
}: {
  filter: CommandPaletteFilter;
  onRemove: () => void;
}) {
  const colors = FILTER_TYPE_COLORS[filter.type];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md",
        "text-xs font-medium",
        "border",
        colors.bg,
        colors.border,
        "transition-colors duration-75"
      )}
    >
      {/* Type prefix */}
      <span className={cn("font-semibold", colors.text)}>{filter.type}:</span>

      {/* Label */}
      <span className="text-foreground max-w-[120px] truncate">
        {filter.label}
      </span>

      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className={cn(
          "ml-0.5 p-0.5 rounded-sm",
          "text-muted-foreground hover:text-foreground",
          "hover:bg-hover",
          "transition-colors"
        )}
      >
        <Icons.X className="w-3 h-3" />
      </button>
    </div>
  );
}

/**
 * FilterChips - Renders all active filter chips
 */
export function FilterChips({ filters, onRemove }: FilterChipsProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {filters.map((filter, index) => (
        <FilterChip
          key={`${filter.type}:${filter.value}`}
          filter={filter}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  );
}

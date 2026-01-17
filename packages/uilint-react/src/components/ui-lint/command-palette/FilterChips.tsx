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
    bg: "bg-blue-500/10 dark:bg-blue-400/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20 dark:border-blue-400/20",
  },
  issue: {
    bg: "bg-amber-500/10 dark:bg-amber-400/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/20 dark:border-amber-400/20",
  },
  loc: {
    bg: "bg-purple-500/10 dark:bg-purple-400/10",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/20 dark:border-purple-400/20",
  },
  file: {
    bg: "bg-zinc-500/10 dark:bg-zinc-400/10",
    text: "text-zinc-600 dark:text-zinc-400",
    border: "border-zinc-500/20 dark:border-zinc-400/20",
  },
  capture: {
    bg: "bg-teal-500/10 dark:bg-teal-400/10",
    text: "text-teal-600 dark:text-teal-400",
    border: "border-teal-500/20 dark:border-teal-400/20",
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
      <span className="text-zinc-700 dark:text-zinc-300 max-w-[120px] truncate">
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
          "text-zinc-400 hover:text-zinc-600",
          "dark:text-zinc-500 dark:hover:text-zinc-300",
          "hover:bg-black/5 dark:hover:bg-white/10",
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

"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";
import { FilterChips } from "./FilterChips";
import type { CommandPaletteFilter } from "./types";

interface CommandPaletteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Connection status indicator */
  isConnected?: boolean;
  /** Active filters shown as chips */
  filters?: CommandPaletteFilter[];
  /** Callback to remove a filter by index */
  onRemoveFilter?: (index: number) => void;
}

/**
 * Search input for command palette - unified search, no mode tabs
 */
export function CommandPaletteInput({
  value,
  onChange,
  placeholder = "Search actions, rules, files, issues...",
  isConnected,
  filters = [],
  onRemoveFilter,
}: CommandPaletteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle Backspace to remove last filter when input is empty
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (
        e.key === "Backspace" &&
        value === "" &&
        filters.length > 0 &&
        onRemoveFilter
      ) {
        e.preventDefault();
        onRemoveFilter(filters.length - 1);
      }
    },
    [value, filters, onRemoveFilter]
  );

  // Platform detection for shortcut display
  const isMac =
    typeof navigator !== "undefined" && navigator.platform?.includes("Mac");
  const shortcutKey = isMac ? "⌘" : "Ctrl";

  const hasFilters = filters.length > 0;

  return (
    <div
      className={cn(
        "flex flex-col",
        "border-b border-border"
      )}
      data-ui-lint
    >
      {/* Search input row */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3",
          "bg-surface-elevated",
          hasFilters && "flex-wrap"
        )}
      >
        {/* Keyboard shortcut indicator */}
        <kbd
          className={cn(
            "px-1.5 py-0.5",
            "text-[10px] font-medium",
            "bg-muted",
            "rounded border border-border",
            "text-muted-foreground",
            "shadow-sm",
            "flex-shrink-0"
          )}
        >
          {shortcutKey}K
        </kbd>

        {/* Search icon */}
        <Icons.Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />

        {/* Filter chips */}
        {hasFilters && onRemoveFilter && (
          <FilterChips filters={filters} onRemove={onRemoveFilter} />
        )}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={hasFilters ? "Add more filters..." : placeholder}
          className={cn(
            "flex-1 min-w-[120px] bg-transparent border-0 outline-none",
            "text-sm text-foreground",
            "placeholder-muted-foreground"
          )}
          data-ui-lint
        />

        {/* Clear button */}
        {(value || hasFilters) && (
          <button
            type="button"
            onClick={() => {
              onChange("");
              if (onRemoveFilter) {
                // Clear all filters when clicking clear
                filters.forEach((_, i) => onRemoveFilter(filters.length - 1 - i));
              }
            }}
            className={cn(
              "p-1 rounded-full flex-shrink-0",
              "text-muted-foreground hover:text-foreground",
              "hover:bg-hover",
              "transition-colors"
            )}
            data-ui-lint
          >
            <Icons.X className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Connection status indicator */}
        {isConnected !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full flex-shrink-0",
              "text-[10px] font-medium",
              isConnected
                ? "text-success bg-success-bg"
                : "text-muted-foreground bg-muted"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                isConnected ? "bg-success" : "bg-muted-foreground"
              )}
            />
            {isConnected ? "Connected" : "Disconnected"}
          </div>
        )}
      </div>
    </div>
  );
}

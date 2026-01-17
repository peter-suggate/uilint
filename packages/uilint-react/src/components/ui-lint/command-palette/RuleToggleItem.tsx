"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface RuleToggleItemProps {
  id: string;
  name: string;
  description: string;
  category: "static" | "semantic";
  enabled: boolean;
  isSelected?: boolean;
  onToggle: (id: string) => void;
  onMouseEnter?: () => void;
  issueCount?: number;
}

/**
 * Rule item with toggle switch for command palette
 */
export function RuleToggleItem({
  id,
  name,
  description,
  category,
  enabled,
  isSelected = false,
  onToggle,
  onMouseEnter,
  issueCount = 0,
}: RuleToggleItemProps) {
  return (
    <div
      className={cn(
        "px-4 py-2.5 cursor-pointer transition-colors duration-75",
        isSelected && "bg-white/40 dark:bg-white/10",
        !isSelected && "hover:bg-white/20 dark:hover:bg-white/5"
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle(id);
      }}
      onMouseEnter={onMouseEnter}
      data-ui-lint
    >
      <div className="flex items-center gap-3">
        {/* Category indicator */}
        <span
          className={cn(
            "text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
            category === "semantic"
              ? "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300"
              : "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
          )}
        >
          {category === "semantic" ? "AI" : "STC"}
        </span>

        {/* Rule info */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {name}
          </div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
            {description}
          </div>
        </div>

        {/* Issue count badge */}
        {issueCount > 0 && (
          <span
            className={cn(
              "inline-flex items-center justify-center",
              "min-w-[22px] h-5 px-1.5",
              "text-[10px] font-semibold",
              "rounded-full",
              "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
            )}
          >
            {issueCount}
          </span>
        )}

        {/* Toggle switch */}
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={(e) => {
            e.stopPropagation();
            onToggle(id);
          }}
          className={cn(
            "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            enabled
              ? "bg-blue-600"
              : "bg-zinc-300 dark:bg-zinc-600"
          )}
          data-ui-lint
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform",
              enabled ? "translate-x-[18px]" : "translate-x-0.5"
            )}
          />
        </button>
      </div>
    </div>
  );
}

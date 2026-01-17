"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface CommandPaletteItemProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  isSelected?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * Generic item component for command palette results
 */
export function CommandPaletteItem({
  icon,
  title,
  subtitle,
  rightElement,
  isSelected = false,
  onClick,
  onMouseEnter,
  onMouseLeave,
}: CommandPaletteItemProps) {
  return (
    <div
      className={cn(
        "px-4 py-2.5 cursor-pointer transition-colors duration-75",
        // Selected state with glass effect
        isSelected && "bg-white/40 dark:bg-white/10",
        // Hover state (when not selected)
        !isSelected && "hover:bg-white/20 dark:hover:bg-white/5"
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      data-ui-lint
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span className="text-zinc-500 dark:text-zinc-400 flex-shrink-0">
            {icon}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {subtitle}
            </div>
          )}
        </div>
        {rightElement && (
          <div className="flex-shrink-0">{rightElement}</div>
        )}
      </div>
    </div>
  );
}

/**
 * Section header for grouping results
 */
export function CommandPaletteSectionHeader({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "px-4 py-2",
        "text-[10px] font-semibold uppercase tracking-wider",
        "text-zinc-500 dark:text-zinc-400",
        "bg-black/5 dark:bg-white/5",
        "flex items-center gap-2"
      )}
      data-ui-lint
    >
      {icon && (
        <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
      )}
      {children}
    </div>
  );
}

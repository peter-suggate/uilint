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
        // Hover and selected states - consistent subtle highlight
        "hover:bg-hover",
        isSelected && "bg-hover"
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
          <span className="text-muted-foreground flex-shrink-0">{icon}</span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-muted-foreground truncate">
              {subtitle}
            </div>
          )}
        </div>
        {rightElement && <div className="flex-shrink-0">{rightElement}</div>}
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
  categoryId,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  /** Used for scroll-to-category navigation */
  categoryId?: string;
}) {
  return (
    <div
      className={cn(
        "px-4 py-2",
        "text-[10px] font-semibold uppercase tracking-wider",
        "text-muted-foreground",
        "flex items-center gap-2"
      )}
      data-ui-lint
      data-category-id={categoryId}
    >
      {icon && <span className="text-text-disabled">{icon}</span>}
      {children}
    </div>
  );
}

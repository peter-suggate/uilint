"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface RuleToggleItemProps {
  id: string;
  name: string;
  description: string;
  category: "static" | "semantic";
  severity: "error" | "warn" | "off";
  isSelected?: boolean;
  isUpdating?: boolean;
  onSeverityChange: (id: string, severity: "error" | "warn" | "off") => void;
  onClick: (id: string) => void;
  onMouseEnter?: () => void;
  issueCount?: number;
}

/**
 * Compact severity toggle - 3-state inline toggle
 */
function SeverityToggle({
  value,
  onChange,
  disabled,
}: {
  value: "error" | "warn" | "off";
  onChange: (severity: "error" | "warn" | "off") => void;
  disabled?: boolean;
}) {
  const options: Array<{
    value: "error" | "warn" | "off";
    label: string;
    activeClass: string;
  }> = [
    {
      value: "error",
      label: "E",
      activeClass: "bg-red-500 text-white",
    },
    {
      value: "warn",
      label: "W",
      activeClass: "bg-amber-500 text-white",
    },
    {
      value: "off",
      label: "Off",
      activeClass: "bg-zinc-500 text-white",
    },
  ];

  return (
    <div
      className="flex items-center gap-0.5 p-0.5 bg-zinc-200 dark:bg-zinc-700 rounded"
      onClick={(e) => e.stopPropagation()}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (opt.value !== value && !disabled) {
              onChange(opt.value);
            }
          }}
          disabled={disabled}
          className={cn(
            "px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all",
            value === opt.value
              ? opt.activeClass
              : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-600",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          data-ui-lint
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Rule item with severity toggle for command palette
 * Click adds a rule filter to show issues for this rule
 */
export function RuleToggleItem({
  id,
  name,
  description,
  category,
  severity,
  isSelected = false,
  isUpdating = false,
  onSeverityChange,
  onClick,
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
      onClick={() => onClick(id)}
      onMouseEnter={onMouseEnter}
      data-ui-lint
    >
      <div className="flex items-center gap-3">
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
              severity === "error"
                ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300"
            )}
          >
            {issueCount}
          </span>
        )}

        {/* Severity toggle */}
        <SeverityToggle
          value={severity}
          onChange={(sev) => onSeverityChange(id, sev)}
          disabled={isUpdating}
        />

        {/* Loading indicator */}
        {isUpdating && (
          <div className="w-4 h-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
        )}
      </div>
    </div>
  );
}

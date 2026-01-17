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
  isExpanded?: boolean;
  isUpdating?: boolean;
  hasOptions?: boolean;
  onSeverityChange: (id: string, severity: "error" | "warn" | "off") => void;
  onExpandClick: (id: string) => void;
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
 * Settings icon button
 */
function SettingsButton({
  onClick,
  isExpanded,
  disabled,
}: {
  onClick: () => void;
  isExpanded?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      className={cn(
        "p-1 rounded transition-colors",
        isExpanded
          ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
          : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      title="Edit rule options"
      data-ui-lint
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    </button>
  );
}

/**
 * Rule item with severity toggle and settings button for command palette
 */
export function RuleToggleItem({
  id,
  name,
  description,
  category,
  severity,
  isSelected = false,
  isExpanded = false,
  isUpdating = false,
  hasOptions = false,
  onSeverityChange,
  onExpandClick,
  onMouseEnter,
  issueCount = 0,
}: RuleToggleItemProps) {
  return (
    <div
      className={cn(
        "px-4 py-2.5 cursor-pointer transition-colors duration-75",
        isSelected && "bg-white/40 dark:bg-white/10",
        !isSelected && "hover:bg-white/20 dark:hover:bg-white/5",
        isExpanded && "bg-zinc-100/50 dark:bg-zinc-800/50"
      )}
      onClick={() => onExpandClick(id)}
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

        {/* Settings button - only show if rule has configurable options */}
        {hasOptions && (
          <SettingsButton
            onClick={() => onExpandClick(id)}
            isExpanded={isExpanded}
            disabled={isUpdating}
          />
        )}

        {/* Loading indicator */}
        {isUpdating && (
          <div className="w-4 h-4 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-500" />
        )}
      </div>
    </div>
  );
}

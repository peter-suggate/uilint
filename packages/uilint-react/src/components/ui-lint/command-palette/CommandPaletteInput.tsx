"use client";

import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Icons } from "./icons";

interface CommandPaletteInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Connection status indicator */
  isConnected?: boolean;
}

/**
 * Search input for command palette - unified search, no mode tabs
 */
export function CommandPaletteInput({
  value,
  onChange,
  placeholder = "Search actions, rules, files, issues...",
  isConnected,
}: CommandPaletteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Platform detection for shortcut display
  const isMac =
    typeof navigator !== "undefined" && navigator.platform?.includes("Mac");
  const shortcutKey = isMac ? "⌘" : "Ctrl";

  return (
    <div
      className={cn(
        "flex flex-col",
        "border-b border-white/10 dark:border-white/5"
      )}
      data-ui-lint
    >
      {/* Search input row */}
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3",
          "bg-white/30 dark:bg-black/20"
        )}
      >
        {/* Keyboard shortcut indicator */}
        <kbd
          className={cn(
            "px-1.5 py-0.5",
            "text-[10px] font-medium",
            "bg-white/50 dark:bg-white/10",
            "rounded border border-white/30 dark:border-white/10",
            "text-zinc-500 dark:text-zinc-400",
            "shadow-sm"
          )}
        >
          {shortcutKey}K
        </kbd>

        {/* Search icon */}
        <Icons.Search className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "flex-1 bg-transparent border-0 outline-none",
            "text-sm text-zinc-900 dark:text-zinc-100",
            "placeholder-zinc-500 dark:placeholder-zinc-400"
          )}
          data-ui-lint
        />

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className={cn(
              "p-1 rounded-full",
              "text-zinc-400 hover:text-zinc-600",
              "dark:text-zinc-500 dark:hover:text-zinc-300",
              "hover:bg-white/50 dark:hover:bg-white/10",
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
              "flex items-center gap-1.5 px-2 py-1 rounded-full",
              "text-[10px] font-medium",
              isConnected
                ? "text-green-600 dark:text-green-400 bg-green-500/10"
                : "text-zinc-500 dark:text-zinc-400 bg-zinc-500/10"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                isConnected ? "bg-green-500" : "bg-zinc-400"
              )}
            />
            {isConnected ? "Connected" : "Disconnected"}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

/**
 * SearchFilter - Filter input component for scan results
 */

"use client";

/**
 * SearchFilter - Filter input component for scan results
 */

import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchFilterProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchFilter({
  value,
  onChange,
  placeholder = "Filter by file or tag...",
}: SearchFilterProps) {
  return (
    <div className="relative flex items-center gap-2 px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800/60 rounded-md border border-zinc-200 dark:border-zinc-800">
      <div className="flex-shrink-0">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          className="text-zinc-500"
        >
          <circle
            cx="11"
            cy="11"
            r="7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M21 21l-4.35-4.35"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-0 outline-none text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-500"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="flex-shrink-0 flex items-center justify-center w-4 h-4 rounded-full bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300 transition-colors"
          title="Clear search"
        >
          <X className="h-2 w-2" />
        </button>
      )}
    </div>
  );
}

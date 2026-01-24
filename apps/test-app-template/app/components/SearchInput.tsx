"use client";

import React, { useState, useCallback } from "react";
import { SearchIcon, XIcon } from "lucide-react";

interface SearchInputProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  debounceMs?: number;
}

/**
 * Search input with debounced callback
 * Uses useState and setTimeout for debouncing
 */
export function SearchInput({
  placeholder = "Search...",
  onSearch,
  debounceMs = 300,
}: SearchInputProps) {
  const [value, setValue] = useState("");
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setValue(newValue);

      // Clear previous timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Set new timeout for debounced search
      const id = setTimeout(() => {
        onSearch(newValue);
      }, debounceMs);
      setTimeoutId(id);
    },
    [onSearch, debounceMs, timeoutId]
  );

  const handleClear = useCallback(() => {
    setValue("");
    onSearch("");
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }, [onSearch, timeoutId]);

  return (
    <div className="relative">
      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <XIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

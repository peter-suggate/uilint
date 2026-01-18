"use client";

import React, { useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

interface SearchBoxProps {
  placeholderText?: string;
  onQueryChange: (query: string) => void;
  delay?: number;
}

/**
 * Search box with debounced input
 * Uses useRef for debounce timer instead of useState
 * NOTE: Same visual output as SearchInput but different debounce implementation
 */
export function SearchBox({
  placeholderText = "Search...",
  onQueryChange,
  delay = 300,
}: SearchBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;

    // Cancel pending debounced call
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Schedule new debounced call
    timerRef.current = setTimeout(() => {
      onQueryChange(query);
    }, delay);
  };

  const clearInput = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    onQueryChange("");
  };

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
      <input
        ref={inputRef}
        type="text"
        onChange={handleInputChange}
        placeholder={placeholderText}
        className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <button
        onClick={clearInput}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

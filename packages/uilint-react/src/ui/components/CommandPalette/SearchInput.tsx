/**
 * SearchInput - Search bar for command palette
 */
import React, { useRef, useEffect } from "react";
import { SearchIcon } from "../../icons";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchInput({ value, onChange, placeholder = "Search issues, rules, files..." }: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center px-4 py-3 border-b border-gray-200 gap-3">
      <SearchIcon size={20} color="#9ca3af" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 border-none outline-none text-base bg-transparent text-gray-900"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="border-none bg-none cursor-pointer p-1 text-gray-400"
        >
          ✕
        </button>
      )}
    </div>
  );
}

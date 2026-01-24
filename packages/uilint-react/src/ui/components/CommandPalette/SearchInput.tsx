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
    <div style={{
      display: "flex",
      alignItems: "center",
      padding: "12px 16px",
      borderBottom: "1px solid #e5e7eb",
      gap: 12,
    }}>
      <SearchIcon size={20} color="#9ca3af" />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          border: "none",
          outline: "none",
          fontSize: 16,
          background: "transparent",
          color: "#111827",
        }}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            padding: 4,
            color: "#9ca3af",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
